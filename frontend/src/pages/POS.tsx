import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { formatPHP } from '../utils/currency';
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
  'bg-teal-100 text-teal-800',
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
    const inv: Record<string, number> = {};
    for (const r of inventoryQ.data ?? []) inv[r.product_id] = r.quantity;
    return inv;
  }, [inventoryQ.data]);

  const loadError =
    productsQ.error ?? inventoryQ.error ?? customersQ.error ?? categoriesQ.error;
  const loading = productsQ.isPending || inventoryQ.isPending;

  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [msg, setMsg] = useState('');
  const [charging, setCharging] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)),
    );
  }, [products, cat, query]);

  const outOfStock = (p: Product) =>
    p.track_inventory && (stock[p.id] ?? 0) <= 0;

  const add = (p: Product) => {
    if (outOfStock(p)) return;
    setCart((c) => {
      const line = c.find((l) => l.product.id === p.id);
      if (line) {
        const max = p.track_inventory ? (stock[p.id] ?? 0) : Infinity;
        if (line.qty + 1 > max) {
          setMsg(`Only ${max} left in stock`);
          return c;
        }
        return c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { product: p, qty: 1 }];
    });
  };

  const estimate = cart.reduce((s, l) => s + l.product.retail_price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const canCharge =
    cart.length > 0 &&
    (method === 'utang'
      ? !!customerId
      : method !== 'cash' || Number(tendered) >= estimate);

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
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
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

  return (
    <div className="w-full p-4 md:p-6">
      {loading && <p className="text-sm text-gray-500">Loading register…</p>}
      {loadError && (
        <p className="text-sm text-red-600">Could not load catalog. Check connection and retry.</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Catalog */}
        <section>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border bg-white p-2"
              placeholder="Scan barcode or type a product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setCat(null)}
                className={`rounded-full px-3 py-1 text-xs ${cat === null ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(cat === c.id ? null : c.id)}
                  className={`rounded-full px-3 py-1 text-xs ${cat === c.id ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => {
              const oos = outOfStock(p);
              return (
                <button
                  key={p.id}
                  disabled={oos}
                  onClick={() => add(p)}
                  className={`flex flex-col items-center rounded-xl border bg-white p-3 text-center ${
                    oos ? 'opacity-40' : 'hover:border-teal-600 active:bg-teal-50'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${tileColor(p.id)}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="mt-1 w-full truncate text-xs font-medium">{p.name}</span>
                  <span className="text-xs font-bold text-teal-800">{formatPHP(p.retail_price)}</span>
                  <span className="text-[11px] text-gray-400">
                    {oos ? 'Out of stock' : p.track_inventory ? `${stock[p.id] ?? 0} left` : '•'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Cart / payment */}
        <section className="h-fit rounded-xl border bg-white p-4 lg:sticky lg:top-4">
          <h2 className="font-bold">
            Cart {count > 0 && <span className="text-teal-700">({count})</span>}
          </h2>
          <ul className="mt-2 max-h-56 divide-y overflow-auto">
            {cart.map((l) => (
              <li key={l.product.id} className="flex items-center justify-between py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.product.name}</span>
                <span className="flex items-center">
                  <button
                    className="rounded px-2 py-1 hover:bg-gray-100"
                    onClick={() =>
                      setCart((c) =>
                        c
                          .map((x) =>
                            x.product.id === l.product.id ? { ...x, qty: x.qty - 1 } : x,
                          )
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <button className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => add(l.product)}>
                    +
                  </button>
                </span>
                <span className="w-20 text-right font-medium">
                  {formatPHP(l.product.retail_price * l.qty)}
                </span>
              </li>
            ))}
            {cart.length === 0 && (
              <li className="py-3 text-sm text-gray-400">Tap a product to start a sale.</li>
            )}
          </ul>

          <div className="mt-3 border-t pt-3">
            <p className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="text-lg font-bold">{formatPHP(estimate)}</span>
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-lg border px-2 py-2 text-xs capitalize ${
                    method === m ? 'border-teal-700 bg-teal-50 font-bold text-teal-800' : 'text-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {method === 'utang' && (
              <select
                className="mt-2 w-full rounded-lg border p-2 text-sm"
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
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                placeholder={`${method.toUpperCase()} reference no.`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            )}

            {method === 'cash' && (
              <>
                <input
                  className="mt-2 w-full rounded-lg border p-2"
                  placeholder="Cash received"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  inputMode="decimal"
                />
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={() => setTendered(String(estimate))}
                  >
                    Exact
                  </button>
                  {QUICK_CASH.filter((q) => q >= estimate)
                    .slice(0, 5)
                    .map((q) => (
                      <button
                        key={q}
                        className="rounded-lg border px-2 py-1 text-xs"
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

            <button
              disabled={!canCharge || charging}
              onClick={() => checkout()}
              className="mt-3 w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-40"
            >
              {charging ? 'Charging…' : `Charge ${formatPHP(estimate)}`}
            </button>
          </div>
        </section>
      </div>

      {/* Sticky mobile charge bar */}
      {cart.length > 0 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed inset-x-4 bottom-20 rounded-xl bg-teal-800 p-3 font-bold text-white shadow-lg lg:hidden"
        >
          Cart · {count} items · {formatPHP(estimate)} — review & charge
        </button>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <p className="text-center text-sm text-gray-500">Payment successful</p>
            <p className="mt-1 text-center text-lg font-bold">{receipt.receipt_number}</p>
            <div className="mt-4 space-y-1 text-sm">
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
            <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
              <button
                className="rounded-lg border p-2"
                onClick={() => setReceipt(null)}
              >
                New sale
              </button>
              <button
                className="rounded-lg bg-teal-700 p-2 text-white"
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
