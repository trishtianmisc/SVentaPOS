import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { formatPHP } from '../utils/currency';
import { Badge } from '../components/ui';
import { useSessionStore } from '../stores/session';
import {
  useCategories,
  useCustomers,
  useInventory,
  useProducts,
  type Product,
} from '../hooks/useCatalog';

interface CartLine {
  product: Product;
  qty: number;
  discount: number;
}
interface Receipt {
  receipt_number: string;
  total: number;
  paid: number;
  change: number;
  status: string;
}

const METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other', 'utang'] as const;
const NEEDS_REF = new Set(['gcash', 'maya', 'card', 'bank']);
const QUICK_CASH = [20, 50, 100, 200, 500, 1000];
const TILE_COLORS = [
  'bg-primary-soft text-primary-ink',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-lime-100 text-lime-800',
  'bg-violet-100 text-violet-800',
];

function tileColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return TILE_COLORS[h % TILE_COLORS.length];
}

/** Client mirror of the server wholesale tier (server stays authoritative). */
function unitPrice(p: Product, qty: number) {
  const w = (p as any).wholesale_price;
  const m = (p as any).wholesale_min_qty;
  if (w != null && m != null && qty >= m) return Number(w);
  return Number(p.retail_price);
}

function isWholesale(p: Product, qty: number) {
  const w = (p as any).wholesale_price;
  const m = (p as any).wholesale_min_qty;
  return w != null && m != null && qty >= m;
}

export default function POSPage() {
  const qc = useQueryClient();
  // Shared cached queries: mount any number of times (incl. StrictMode
  // double-mount) with a single network request per key. Sales history is
  // owned by /sales and never fetched here.
  const productsQ = useProducts();
  const categoriesQ = useCategories();
  const inventoryQ = useInventory();
  const customersQ = useCustomers();

  const products = productsQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const customers = customersQ.data ?? [];
  const stock = useMemo(() => {
    const inv: Record<string, { qty: number; reorder: number }> = {};
    for (const r of inventoryQ.data ?? [])
      inv[r.product_id] = { qty: r.quantity, reorder: r.reorder_level ?? 0 };
    return inv;
  }, [inventoryQ.data]);

  const loadError =
    productsQ.error ?? inventoryQ.error ?? customersQ.error ?? categoriesQ.error;
  const loading = productsQ.isPending || inventoryQ.isPending;

  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [walkIn, setWalkIn] = useState(true);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptLines, setReceiptLines] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [msg, setMsg] = useState('');
  const [charging, setCharging] = useState(false);
  const [discFor, setDiscFor] = useState<string | null>(null);
  const [discVal, setDiscVal] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Cart marker lets the store picker confirm before clearing (prices and
  // stock differ between stores). Cleared whenever the active store changes.
  const storeVersion = useSessionStore((s) => s.storeVersion);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  useEffect(() => {
    localStorage.setItem('ventapos:cartCount', String(count));
  }, [count]);
  const firstVersion = useRef(storeVersion);
  useEffect(() => {
    if (storeVersion !== firstVersion.current) setCart([]);
  }, [storeVersion]);
  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReceipt(null);
        setReceiptLines([]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [receipt]);

  // Register shortcuts: Ctrl+K focuses search, F4 charges when ready.
  const canChargeRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (canChargeRef.current) checkoutRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const outOfStock = (p: Product) =>
    p.track_inventory && (stock[p.id]?.qty ?? 0) <= 0;

  const lowStock = (p: Product) => {
    const s = stock[p.id];
    return (
      p.track_inventory && s !== undefined && s.reorder > 0 && s.qty > 0 && s.qty <= s.reorder
    );
  };

  const setQty = (id: string, qty: number) => {
    setCart((c) => {
      const line = c.find((l) => l.product.id === id);
      if (!line) return c;
      if (qty <= 0) return c.filter((l) => l.product.id !== id);
      const max = line.product.track_inventory ? (stock[id]?.qty ?? 0) : Infinity;
      if (qty > max) {
        setMsg(`Only ${max} left in stock`);
        return c;
      }
      return c.map((l) => (l.product.id === id ? { ...l, qty } : l));
    });
  };

  const add = (p: Product) => {
    if (outOfStock(p)) return;
    const line = cart.find((l) => l.product.id === p.id);
    setQty(p.id, line ? line.qty + 1 : 1);
    if (!line) setCart((c) => [...c, { product: p, qty: 1, discount: 0 }]);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear the current order?')) setCart([]);
  };

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) {
      const k = p.category_id ?? '';
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!inStockOnly || !outOfStock(p)) &&
        (!q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, cat, query, inStockOnly, inventoryQ.data]);

  const subtotal = cart.reduce((s, l) => s + unitPrice(l.product, l.qty) * l.qty, 0);
  const lineDisc = cart.reduce(
    (s, l) => s + Math.min(l.discount, unitPrice(l.product, l.qty) * l.qty),
    0,
  );
  const estimate = Math.max(0, Math.round((subtotal - lineDisc) * 100) / 100);

  const pickMethod = (m: (typeof METHODS)[number]) => {
    setMethod(m);
    setWalkIn(m !== 'utang');
    if (m !== 'utang') setCustomerId('');
  };

  const pickParty = (isWalkIn: boolean) => {
    setWalkIn(isWalkIn);
    if (isWalkIn) {
      if (method === 'utang') setMethod('cash');
      setCustomerId('');
    } else {
      setMethod('utang');
    }
  };

  const canCharge =
    cart.length > 0 &&
    (method === 'utang'
      ? !!customerId
      : method !== 'cash' || Number(tendered) >= estimate);
  canChargeRef.current = canCharge;

  const checkout = async (override = false, reason = '', key = crypto.randomUUID()) => {
    setMsg('');
    if (method === 'utang' && !customerId) {
      setMsg('Select a customer for utang');
      return;
    }
    if (NEEDS_REF.has(method) && !reference.trim()) {
      setMsg(`Enter the ${method.toUpperCase()} reference number`);
      return;
    }
    const amount = method === 'cash' ? Number(tendered) : estimate;
    setCharging(true);
    try {
      const res = await api.post('/sales', {
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.qty,
          discount: l.discount,
        })),
        payments: [
          {
            method,
            amount,
            reference: reference.trim() || undefined,
          },
        ],
        idempotency_key: key,
        customer_id: method === 'utang' ? customerId : undefined,
        limit_override: override,
        limit_reason: reason || undefined,
      });
      setReceipt(res.data.data);
      setCart([]);
      setTendered('');
      setReference('');
      // Line items for the printed receipt (best-effort; totals already shown).
      api
        .get(`/sales/${res.data.data.sale_id}`)
        .then((d) => setReceiptLines(d.data.data.items ?? []))
        .catch(() => setReceiptLines([]));
      // Stock and balances changed server-side: mark stale so the next
      // read refetches exactly once, instead of refetching everything here.
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.inventory }),
        ...(method === 'utang'
          ? [qc.invalidateQueries({ queryKey: qk.customers })]
          : []),
      ]);
    } catch (e: any) {
      const errMsg: string = e.response?.data?.error?.message ?? 'Sale failed';
      if (errMsg.toLowerCase().includes('credit limit') && !override) {
        const ok = window.confirm(`${errMsg}\n\nCharge anyway with manager approval?`);
        if (ok) {
          const why = window.prompt('Override reason (logged):', 'manager approved') ?? '';
          await checkout(true, why, key);
          return;
        }
      }
      setMsg(errMsg);
    } finally {
      setCharging(false);
    }
  };
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;

  const applyDisc = (id: string) => {
    const v = Math.max(0, Number(discVal) || 0);
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, discount: v } : l)));
    setDiscFor(null);
    setDiscVal('');
  };

  return (
    <div className="w-full p-4 md:p-6">
      {loading && <p className="text-sm text-gray-500">Loading register…</p>}
      {loadError && (
        <p className="text-sm text-red-600">Could not load catalog. Check connection and retry.</p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Catalog */}
        <section aria-label="Product catalog">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              title="Focus search (Ctrl+K). Barcode scanners type here."
              className="h-11 shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Scan
            </button>
            <input
              ref={searchRef}
              className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Scan barcode or type a product  (Ctrl+K)"
              aria-label="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              aria-pressed={inStockOnly}
              title="Show in-stock only"
              onClick={() => setInStockOnly((v) => !v)}
              className={`h-11 shrink-0 rounded-lg border px-3 text-sm font-medium ${
                inStockOnly ? 'border-primary bg-primary-soft text-primary-ink' : 'border-gray-300 bg-white text-gray-600'
              }`}
            >
              Stock
            </button>
            <div role="group" aria-label="Catalog view" className="flex shrink-0 overflow-hidden rounded-lg border border-gray-300">
              {(['grid', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`h-11 px-3 text-sm capitalize ${
                    view === v ? 'bg-primary font-semibold text-white' : 'bg-white text-gray-500'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Categories">
              <button
                onClick={() => setCat(null)}
                aria-pressed={cat === null}
                className={`h-9 rounded-full px-3 text-[13px] ${cat === null ? 'bg-primary font-medium text-white' : 'border border-gray-300 bg-white text-gray-600'}`}
              >
                All · {products.length}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(cat === c.id ? null : c.id)}
                  aria-pressed={cat === c.id}
                  className={`h-9 rounded-full px-3 text-[13px] ${cat === c.id ? 'bg-primary font-medium text-white' : 'border border-gray-300 bg-white text-gray-600'}`}
                >
                  {c.name} · {catCounts[c.id] ?? 0}
                </button>
              ))}
            </div>
          )}
          {msg && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {msg}
            </p>
          )}

          {view === 'grid' ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {visible.map((p) => {
                const oos = outOfStock(p);
                const line = cart.find((l) => l.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col items-center rounded-xl border bg-white p-3 text-center ${
                      oos ? 'opacity-40' : ''
                    }`}
                  >
                    <button
                      disabled={oos}
                      onClick={() => add(p)}
                      aria-label={`Add ${p.name} to order`}
                      className={`flex w-full flex-col items-center ${oos ? '' : 'hover:opacity-80'}`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${tileColor(p.id)}`}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="mt-1 w-full truncate text-xs font-medium">{p.name}</span>
                      <span className="text-xs font-bold text-primary-ink">
                        {formatPHP(p.retail_price)}
                      </span>
                    </button>
                    {line ? (
                      <span className="mt-2 inline-flex items-center rounded-full bg-primary px-1 py-0.5 text-white">
                        <button aria-label={`Decrease ${p.name}`} className="px-2 py-0.5" onClick={() => setQty(p.id, line.qty - 1)}>
                          −
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold">{line.qty}</span>
                        <button aria-label={`Increase ${p.name}`} className="px-2 py-0.5" onClick={() => add(p)}>
                          +
                        </button>
                      </span>
                    ) : (
                      <span className="mt-2">
                        {oos ? (
                          <Badge tone="red">Out of stock</Badge>
                        ) : lowStock(p) ? (
                          <Badge tone="amber">Low · {stock[p.id]?.qty} left</Badge>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            {p.track_inventory ? `${stock[p.id]?.qty ?? 0} left` : '•'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <ul className="mt-3 divide-y rounded-xl border bg-white px-4">
              {visible.map((p) => {
                const oos = outOfStock(p);
                const line = cart.find((l) => l.product.id === p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <button
                      disabled={oos}
                      onClick={() => add(p)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium disabled:text-gray-400"
                    >
                      {p.name}
                      <span className="ml-2 text-xs text-gray-400">
                        {formatPHP(p.retail_price)}
                        {oos ? ' · out of stock' : lowStock(p) ? ` · low (${stock[p.id]?.qty})` : ''}
                      </span>
                    </button>
                    {line ? (
                      <span className="inline-flex items-center">
                        <button aria-label={`Decrease ${p.name}`} className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => setQty(p.id, line.qty - 1)}>
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{line.qty}</span>
                        <button aria-label={`Increase ${p.name}`} className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => add(p)}>
                          +
                        </button>
                      </span>
                    ) : (
                      <button
                        disabled={oos}
                        onClick={() => add(p)}
                        className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-white disabled:opacity-40"
                      >
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="py-4 text-center text-sm text-gray-400">
                  No products match. Try another search.
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Current order */}
        <section
          aria-label="Current order"
          className="h-fit rounded-xl border border-gray-200 bg-white lg:sticky lg:top-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="text-base font-semibold">
              Current Order{' '}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                  {count} items
                </span>
              )}
            </h2>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-[13px] font-medium text-gray-400 hover:text-red-700 disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="p-4">
            <div role="group" aria-label="Order party" className="grid grid-cols-2 gap-2">
              {[
                { key: true, label: 'Walk-in' },
                { key: false, label: 'Customer' },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => pickParty(o.key)}
                  aria-pressed={walkIn === o.key}
                  className={`h-11 rounded-xl text-sm font-medium ${
                    walkIn === o.key ? 'bg-primary font-semibold text-white' : 'border border-gray-300 text-gray-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <ul className="mt-2 max-h-64 divide-y divide-gray-100 overflow-auto">
              {cart.map((l) => {
                const ws = isWholesale(l.product, l.qty);
                const max = l.product.track_inventory ? (stock[l.product.id]?.qty ?? 0) : Infinity;
                return (
                  <li key={l.product.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatPHP(unitPrice(l.product, l.qty))} each
                          {ws && (
                            <span className="ml-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink">
                              Wholesale
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {formatPHP(unitPrice(l.product, l.qty) * l.qty - Math.min(l.discount, unitPrice(l.product, l.qty) * l.qty))}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="inline-flex items-center rounded-full border border-gray-200">
                        <button aria-label={`Decrease ${l.product.name}`} className="px-2.5 py-1" onClick={() => setQty(l.product.id, l.qty - 1)}>
                          −
                        </button>
                        <span className="min-w-10 text-center text-sm font-bold">
                          {l.qty}
                          <span className="font-normal text-gray-400"> pcs</span>
                        </span>
                        <button aria-label={`Increase ${l.product.name}`} className="px-2.5 py-1" onClick={() => add(l.product)}>
                          +
                        </button>
                      </span>
                      {discFor === l.product.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            aria-label={`Discount for ${l.product.name}`}
                            className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm"
                            inputMode="decimal"
                            autoFocus
                            value={discVal}
                            onChange={(e) => setDiscVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyDisc(l.product.id);
                            }}
                          />
                          <button
                            className="h-9 rounded-lg bg-primary px-2 text-sm font-medium text-white"
                            onClick={() => applyDisc(l.product.id)}
                          >
                            OK
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {l.discount > 0 && (
                            <span className="text-xs text-gray-500">−{formatPHP(l.discount)}</span>
                          )}
                          <button
                            className="text-xs font-medium text-gray-500 hover:text-primary"
                            onClick={() => {
                              setDiscFor(l.product.id);
                              setDiscVal(l.discount ? String(l.discount) : '');
                            }}
                          >
                            Discount
                          </button>
                          <button
                            aria-label={`Remove ${l.product.name}`}
                            className="text-gray-400 hover:text-red-700"
                            onClick={() => setQty(l.product.id, 0)}
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                    {l.qty >= max && max !== Infinity && (
                      <p className="mt-1 text-xs text-amber-700">Only {max} pcs in stock</p>
                    )}
                  </li>
                );
              })}
              {cart.length === 0 && (
                <li className="py-4 text-center text-sm text-gray-400">
                  Tap a product to start an order.
                </li>
              )}
            </ul>

            <div className="mt-2 border-t border-gray-100 pt-3 text-sm">
              <p className="flex justify-between text-gray-500">
                <span>Net Sales</span>
                <span>{formatPHP(subtotal)}</span>
              </p>
              {lineDisc > 0 && (
                <p className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>−{formatPHP(lineDisc)}</span>
                </p>
              )}
              <p className="mt-1 flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatPHP(estimate)}</span>
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1" role="group" aria-label="Payment method">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => pickMethod(m)}
                  aria-pressed={method === m}
                  className={`h-10 rounded-lg border px-2 text-xs capitalize ${
                    method === m ? 'border-primary bg-primary-soft font-bold text-primary-ink' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {method === 'utang' && (
              <select
                aria-label="Customer for utang"
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer…</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatPHP(c.balance ?? 0)})
                  </option>
                ))}
              </select>
            )}

            {NEEDS_REF.has(method) && (
              <input
                aria-label={`${method} reference number`}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
                placeholder={`${method.toUpperCase()} reference no.`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            )}

            {method === 'cash' && (
              <>
                <input
                  aria-label="Cash received"
                  className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
                  placeholder="Cash received"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  inputMode="decimal"
                />
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-medium"
                    onClick={() => setTendered(String(estimate))}
                  >
                    Exact
                  </button>
                  {QUICK_CASH.filter((q) => q >= estimate)
                    .slice(0, 5)
                    .map((q) => (
                      <button
                        key={q}
                        className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-medium"
                        onClick={() => setTendered(String(q))}
                      >
                        {q}
                      </button>
                    ))}
                </div>
                {Number(tendered) >= estimate && estimate > 0 && (
                  <p className="mt-2 text-sm">
                    Change: <span className="font-bold">{formatPHP(Number(tendered) - estimate)}</span>
                  </p>
                )}
              </>
            )}

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <Link
                to="/sales"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 text-sm font-medium text-gray-700"
              >
                History
              </Link>
              <button
                disabled={!canCharge || charging}
                onClick={() => checkout()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-white disabled:opacity-40"
              >
                {charging ? 'Charging…' : `Checkout ${formatPHP(estimate)}`}
              </button>
            </div>
            <p className="mt-1 text-center text-[11px] text-gray-400">F4 to charge · Ctrl+K to search</p>
          </div>
        </section>
      </div>

      {/* Sticky mobile charge bar */}
      {cart.length > 0 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed inset-x-4 bottom-20 rounded-xl bg-primary-hover p-3 font-bold text-white shadow-lg lg:hidden"
        >
          Cart · {count} items · {formatPHP(estimate)} — review & charge
        </button>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt ${receipt.receipt_number}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 print:static print:block print:bg-white sm:items-center"
        >
          <div className="receipt-80 w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
            <p className="text-center font-bold">VentaPOS</p>
            <p className="text-center">{receipt.receipt_number}</p>
            <p className="text-center text-gray-500">
              {new Date().toLocaleString()} · {method.toUpperCase()}
            </p>
            <hr />
            {receiptLines.map((i: any) => (
              <p key={i.id} className="flex justify-between">
                <span>
                  {i.product_name_snapshot} × {i.quantity}
                </span>
                <span>{formatPHP(i.line_total)}</span>
              </p>
            ))}
            <hr />
            <div className="mt-4 space-y-1 text-sm print:mt-0">
              <p className="flex justify-between">
                <span>Total</span>
                <span className="font-bold">{formatPHP(receipt.total)}</span>
              </p>
              <p className="flex justify-between">
                <span>Paid ({method})</span>
                <span>{formatPHP(receipt.paid)}</span>
              </p>
              <p className="flex justify-between">
                <span>Change</span>
                <span className="font-bold">{formatPHP(receipt.change)}</span>
              </p>
              {(receipt as any).utang > 0 && (
                <p className="flex justify-between">
                  <span>New balance</span>
                  <span className="font-bold">{formatPHP((receipt as any).balance ?? 0)}</span>
                </p>
              )}
            </div>
            <p className="mt-2 hidden text-center print:block">Thank you for shopping!</p>
            <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
              <button
                className="h-10 rounded-lg border border-gray-300 text-sm font-medium"
                onClick={() => {
                  setReceipt(null);
                  setReceiptLines([]);
                }}
              >
                New sale
              </button>
              <button
                className="h-10 rounded-lg bg-primary text-sm font-medium text-white"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
