import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { formatPHP } from '../utils/currency';
import { Badge, toast } from '../components/ui';
import {
  Receipt as SharedReceipt,
  type ReceiptSale,
} from '../components/Receipt';
import { useSessionStore } from '../stores/session';
import {
  baseEquivalent,
  baseUnitName,
  convertQtyBetween,
  formatQty,
  qtyStep,
  roundQty,
  unitFactor,
} from '../lib/units';
import {
  useCategories,
  useCustomers,
  useInventory,
  useProducts,
  useUnits,
  type Product,
  type SellUnit,
} from '../hooks/useCatalog';

interface CartLine {
  product: Product;
  qty: number;
  discount: number;
  /** Sell unit; base unit is implicit (today 'pc'). Line qty is in this unit. */
  unit: string;
}
type Receipt = ReceiptSale;

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

/** Factor converting a line's sell unit to base units (base factor = 1). */
function lineFactorFor(l: CartLine, units: SellUnit[] | undefined) {
  const base = baseUnitName(l.product).toLowerCase();
  if (l.unit.toLowerCase() === base) return 1;
  return unitFactor(l.unit, units);
}

/** Client mirror of the server unit price (server stays authoritative):
 * explicit unit price wins, else tiered base price × factor. Tier triggers
 * on base-unit quantity. */
function linePrice(l: CartLine, units: SellUnit[] | undefined) {
  const f = lineFactorFor(l, units);
  const base = unitPrice(l.product, l.qty * f);
  const baseName = baseUnitName(l.product).toLowerCase();
  if (l.unit.toLowerCase() === baseName) return base;
  const sp = units?.find(
    (u) => u.unit_name.toLowerCase() === l.unit.toLowerCase(),
  )?.selling_price;
  return sp != null ? Number(sp) : Math.round(base * f * 100) / 100;
}

function lineIsWholesale(l: CartLine, units: SellUnit[] | undefined) {
  return isWholesale(l.product, l.qty * lineFactorFor(l, units));
}

/**
 * Editable cart quantity. Local draft so intermediate keystrokes
 * ("" / "0." / "12.") never remove the line. Commit uses roundQty:
 * measurement → 2 dp; count → snap near-integers only, keep real
 * decimals (0.5 kg-as-pc, 1.5 pack from a unit switch).
 */
function CartQtyInput({
  qty,
  unit,
  max,
  name,
  onSetQty,
  onRemove,
}: {
  qty: number;
  unit: string;
  max: number;
  name: string;
  onSetQty: (n: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(formatQty(qty));
  const focused = useRef(false);

  // Sync from cart when qty changes externally (±, unit switch) and we are idle.
  useEffect(() => {
    if (!focused.current) setDraft(formatQty(qty));
  }, [qty, unit]);

  const parse = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    return cleaned;
  };

  const commit = () => {
    const raw = draft.trim();
    if (raw === '' || raw === '.') {
      onRemove();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      onRemove();
      return;
    }
    // Do NOT Math.round count here — that turns typed 0.5 into 1.
    // roundQty: kg/L → 2 dp; count → keep 0.5 / 1.5, snap 1.0000001 → 1.
    const committed = roundQty(n, unit);
    if (committed <= 0) {
      onRemove();
      return;
    }
    if (committed > max + 1e-9) {
      setDraft(formatQty(qty));
      onSetQty(committed); // setQty surfaces the stock message and rejects
      return;
    }
    setDraft(formatQty(committed));
    onSetQty(committed);
  };

  return (
    <input
      aria-label={`Quantity for ${name}`}
      className="w-16 border-0 bg-transparent text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const raw = parse(e.target.value);
        setDraft(raw);
        // Live preview for valid positive numbers; never remove mid-typing.
        if (raw === '' || raw === '.') return;
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) onSetQty(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          focused.current = false;
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(formatQty(qty));
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
    />
  );
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
  const unitsQ = useUnits();
  const unitsByProduct = useMemo(() => {
    const m: Record<string, SellUnit[]> = {};
    for (const u of unitsQ.data ?? []) (m[u.product_id] ??= []).push(u);
    return m;
  }, [unitsQ.data]);

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
  const clearReceipt = () => {
    setReceipt(null);
    setReceiptLines([]);
    setReceiptAt(null);
    setReceiptPays([]);
  };

  // Shift gate (Phase 4): checkout requires an open shift.
  const [shift, setShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openFloat, setOpenFloat] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [closeCash, setCloseCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [zReport, setZReport] = useState<any>(null);
  const [shiftBusy, setShiftBusy] = useState(false);

  const loadShift = async () => {
    setShiftLoading(true);
    try {
      const res = await api.get('/shifts/current');
      setShift(res.data.data ?? null);
    } catch {
      setShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  // Cart marker lets the store picker confirm before clearing (prices and
  // stock differ between stores). Cleared whenever the active store changes.
  const storeVersion = useSessionStore((s) => s.storeVersion);
  const storeId = useSessionStore((s) => s.storeId);
  // Store profile for the receipt header (name/address/TIN) + VAT flag.
  const [storeInfo, setStoreInfo] = useState<any>(null);
  // Cashier display name for the printed receipt (from /auth/me).
  const [cashierName, setCashierName] = useState('');
  // Sale timestamp + payments captured once checkout succeeds.
  const [receiptAt, setReceiptAt] = useState<Date | null>(null);
  const [receiptPays, setReceiptPays] = useState<any[]>([]);
  useEffect(() => {
    api
      .get('/stores')
      .then((r) => {
        const list = r.data.data ?? [];
        setStoreInfo(list.find((s: any) => s.id === storeId) ?? list[0] ?? null);
      })
      .catch(() => undefined);
  }, [storeId, storeVersion]);
  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setCashierName(r.data.data?.full_name ?? ''))
      .catch(() => undefined);
  }, []);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  useEffect(() => {
    localStorage.setItem('ventapos:cartCount', String(count));
  }, [count]);
  const firstVersion = useRef(storeVersion);
  useEffect(() => {
    if (storeVersion !== firstVersion.current) setCart([]);
  }, [storeVersion]);
  useEffect(() => {
    loadShift();
    setZReport(null);
    setShowClose(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeVersion]);
  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearReceipt();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const setQty = (id: string, qty: number, unit?: string) => {
    setCart((c) => {
      const line = c.find((l) => l.product.id === id);
      if (!line) return c;
      const u = unit ?? line.unit;
      if (qty <= 0)
        return u === line.unit ? c.filter((l) => l.product.id !== id) : c;
      const f = lineFactorFor({ ...line, unit: u }, unitsByProduct[id]);
      const max = line.product.track_inventory
        ? (stock[id]?.qty ?? 0) / f
        : Infinity;
      const rounded = roundQty(qty, u);
      if (rounded > max + 1e-9) {
        setMsg(`Only ${formatQty(max)} ${u} left in stock`);
        return c;
      }
      return c.map((l) =>
        l.product.id === id ? { ...l, qty: rounded, unit: u } : l,
      );
    });
  };

  /**
   * Change selected unit while preserving base quantity:
   *   base = qty * fromFactor; next = base / toFactor
   * Never silent-rounds away stock accuracy (see roundQty).
   */
  const switchUnit = (id: string, nextUnit: string) => {
    setCart((c) => {
      const line = c.find((l) => l.product.id === id);
      if (!line || line.unit === nextUnit) return c;
      const units = unitsByProduct[id];
      const newQty = convertQtyBetween(
        line.qty,
        line.unit,
        nextUnit,
        units,
        baseUnitName(line.product),
      );
      if (newQty <= 0) return c;
      const f = lineFactorFor({ ...line, unit: nextUnit }, units);
      const max = line.product.track_inventory
        ? (stock[id]?.qty ?? 0) / f
        : Infinity;
      if (newQty > max + 1e-9) {
        setMsg(
          `Only ${formatQty(max)} ${nextUnit} left in stock (base equivalent exceeded)`,
        );
        return c;
      }
      return c.map((l) =>
        l.product.id === id ? { ...l, unit: nextUnit, qty: newQty } : l,
      );
    });
  };

  const bumpQty = (id: string, direction: 1 | -1) => {
    const line = cart.find((l) => l.product.id === id);
    if (!line) return;
    const step = qtyStep(line.unit);
    const next = roundQty(line.qty + direction * step, line.unit);
    setQty(id, next);
  };

  const add = (p: Product) => {
    if (outOfStock(p)) return;
    const line = cart.find((l) => l.product.id === p.id);
    if (!line) {
      setCart((c) => [
        ...c,
        { product: p, qty: 1, discount: 0, unit: baseUnitName(p) },
      ]);
      return;
    }
    const step = qtyStep(line.unit);
    setQty(p.id, roundQty(line.qty + step, line.unit));
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

  const subtotal = cart.reduce(
    (s, l) => s + linePrice(l, unitsByProduct[l.product.id]) * l.qty,
    0,
  );
  const lineDisc = cart.reduce((s, l) => {
    const gross = linePrice(l, unitsByProduct[l.product.id]) * l.qty;
    return s + Math.min(l.discount, gross);
  }, 0);
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
    !!shift &&
    cart.length > 0 &&
    (method === 'utang'
      ? !!customerId
      : method !== 'cash' || Number(tendered) >= estimate);
  canChargeRef.current = canCharge;

  const openShift = async () => {
    setMsg('');
    setShiftBusy(true);
    try {
      const res = await api.post('/shifts/open', {
        opening_float: Number(openFloat) || 0,
      });
      setShift(res.data.data);
      setOpenFloat('');
      toast('success', 'Shift opened');
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open shift');
      await loadShift();
    } finally {
      setShiftBusy(false);
    }
  };

  const closeShift = async () => {
    if (!shift) return;
    setMsg('');
    setShiftBusy(true);
    try {
      const res = await api.post(`/shifts/${shift.id}/close`, {
        counted_cash: Number(closeCash) || 0,
        notes: closeNotes.trim() || undefined,
      });
      setShift(null);
      setZReport(res.data.data);
      setShowClose(false);
      setCloseCash('');
      setCloseNotes('');
      toast(
        'success',
        Number(res.data.data.variance) === 0
          ? 'Shift closed — cash exact'
          : `Shift closed — variance ${formatPHP(res.data.data.variance)}`,
      );
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not close shift');
    } finally {
      setShiftBusy(false);
    }
  };

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
        items: cart.map((l) => {
          const base = baseUnitName(l.product);
          return {
            product_id: l.product.id,
            quantity: l.qty,
            discount: l.discount,
            // Server still accepts omit for the implicit base unit name.
            ...(l.unit.toLowerCase() !== base.toLowerCase()
              ? { unit_name: l.unit }
              : {}),
          };
        }),
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
      setReceiptAt(new Date());
      setReceiptPays([
        { payment_method: method, amount, reference: reference.trim() || null },
      ]);
      setCart([]);
      setTendered('');
      setReference('');
      // Line items + exact sale timestamp for the printed receipt.
      api
        .get(`/sales/${res.data.data.sale_id}`)
        .then((d) => {
          const sale = d.data.data ?? {};
          setReceiptLines(sale.items ?? []);
          if (sale.created_at) setReceiptAt(new Date(sale.created_at));
          if (Array.isArray(sale.payments) && sale.payments.length) {
            setReceiptPays(sale.payments);
          }
          if (sale.receipt_number || sale.total != null) {
            setReceipt((prev) => ({ ...(prev as Receipt), ...sale, paid: sale.paid ?? prev?.paid, change: sale.change ?? prev?.change }));
          }
        })
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
      if (errMsg.toLowerCase().includes('shift')) await loadShift();
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

      {/* Shift bar: hard gate — checkout requires an open shift. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
        {shiftLoading ? (
          <span className="text-sm text-gray-500">Checking shift…</span>
        ) : shift ? (
          <>
            <Badge tone="green">Shift open</Badge>
            <span className="text-sm text-gray-600">
              Float {formatPHP(Number(shift.opening_float) || 0)} · since{' '}
              {new Date(shift.opened_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {shift.opened_by_name ? ` · ${shift.opened_by_name}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setShowClose(true)}
              className="ml-auto h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Close shift
            </button>
          </>
        ) : (
          <>
            <Badge tone="amber">No open shift</Badge>
            <span className="text-sm text-gray-600">Open a shift to start selling.</span>
            <input
              aria-label="Opening float"
              className="ml-auto h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm"
              placeholder="Float ₱"
              inputMode="decimal"
              value={openFloat}
              onChange={(e) => setOpenFloat(e.target.value)}
            />
            <button
              type="button"
              disabled={shiftBusy}
              onClick={openShift}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              {shiftBusy ? 'Opening…' : 'Open shift'}
            </button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-[13px] text-red-600">{msg}</p>}

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
                        <button aria-label={`Decrease ${p.name}`} className="px-2 py-0.5" onClick={() => bumpQty(p.id, -1)}>
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
                        <button aria-label={`Decrease ${p.name}`} className="rounded px-2 py-1 hover:bg-gray-100" onClick={() => bumpQty(p.id, -1)}>
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
          className="h-fit rounded-xl border border-gray-20 bg-white lg:sticky lg:top-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4 ">
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
                const units = unitsByProduct[l.product.id] ?? [];
                const price = linePrice(l, units);
                const gross = price * l.qty;
                const ws = lineIsWholesale(l, units);
                const f = lineFactorFor(l, units);
                const baseName = baseUnitName(l.product);
                const baseQty = baseEquivalent(l.qty, l.unit, units, baseName);
                const max = l.product.track_inventory
                  ? (stock[l.product.id]?.qty ?? 0) / f
                  : Infinity;
                return (
                  <li key={l.product.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatPHP(price)} per {l.unit}
                          {ws && (
                            <span className="ml-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink">
                              Wholesale
                            </span>
                          )}
                        </p>
                        {f !== 1 || l.unit.toLowerCase() !== baseName.toLowerCase() ? (
                          <p className="text-[11px] text-gray-400">
                            ≈ {formatQty(baseQty)} {baseName}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold">
                        {formatPHP(gross - Math.min(l.discount, gross))}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex items-center rounded-full border border-gray-200">
                          <button
                            aria-label={`Decrease ${l.product.name}`}
                            className="px-2.5 py-1"
                            onClick={() => bumpQty(l.product.id, -1)}
                          >
                            −
                          </button>
                            <CartQtyInput
                              qty={l.qty}
                              unit={l.unit}
                              max={max}
                              name={l.product.name}
                              onSetQty={(n) => setQty(l.product.id, n)}
                              onRemove={() => setQty(l.product.id, 0)}
                            />
                          <span className="pr-1 text-sm font-normal text-gray-400">
                            {l.unit}
                          </span>
                          <button
                            aria-label={`Increase ${l.product.name}`}
                            className="px-2.5 py-1"
                            onClick={() => bumpQty(l.product.id, 1)}
                          >
                            +
                          </button>
                        </span>
                        {units.length > 0 && (
                          <select
                            aria-label={`Unit for ${l.product.name}`}
                            className="h-8 rounded-lg border border-gray-200 bg-white px-1 text-xs"
                            value={l.unit}
                            onChange={(e) => switchUnit(l.product.id, e.target.value)}
                          >
                            <option value={baseName}>{baseName}</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.unit_name}>
                                {u.unit_name}
                              </option>
                            ))}
                          </select>
                        )}
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
                      <p className="mt-1 text-xs text-amber-700">
                        Only {formatQty(max)} {l.unit} in stock
                      </p>
                    )}
                  </li>
                );
              })}
              {cart.length > 0 && (
                <li className="py-2 text-center text-[11px] text-gray-400">
                  Inventory is deducted in base units.
                </li>
              )}
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

      {/* Close-shift modal */}
      {showClose && shift && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Close shift"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <p className="font-bold">Close shift</p>
            <p className="mt-1 text-sm text-gray-500">
              Count the cash drawer and enter the total.
            </p>
            <label className="mt-3 block text-[13px] font-medium text-gray-600">
              Counted cash
              <input
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="₱"
                inputMode="decimal"
                value={closeCash}
                onChange={(e) => setCloseCash(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-[13px] font-medium text-gray-600">
              Notes (optional)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="e.g. handed over to Aling Maria"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="h-10 rounded-lg border border-gray-300 text-sm font-medium"
                onClick={() => setShowClose(false)}
              >
                Back
              </button>
              <button
                className="h-10 rounded-lg bg-primary text-sm font-medium text-white disabled:opacity-40"
                disabled={shiftBusy || !closeCash}
                onClick={closeShift}
              >
                {shiftBusy ? 'Closing…' : 'Close + Z-report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Z-report modal */}
      {zReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Z-report"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <p className="text-center font-bold">Z-Report</p>
            <p className="text-center text-sm text-gray-500">
              {zReport.z_report?.sales_count ?? 0} sales · Revenue{' '}
              {formatPHP(zReport.z_report?.revenue ?? 0)}
            </p>
            <hr />
            {(zReport.z_report?.by_method ?? []).map((m: any) => (
              <p key={m.method} className="flex justify-between py-1 text-sm">
                <span className="capitalize">{m.method}</span>
                <span>{formatPHP(m.total)}</span>
              </p>
            ))}
            <hr />
            <div className="mt-2 space-y-1 text-sm">
              {(zReport.z_report?.vat_collected ?? 0) > 0 && (
                <p className="flex justify-between">
                  <span>VAT collected</span>
                  <span>{formatPHP(zReport.z_report?.vat_collected ?? 0)}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span>Opening float</span>
                <span>{formatPHP(zReport.z_report?.opening_float ?? 0)}</span>
              </p>
              <p className="flex justify-between">
                <span>Cash tendered</span>
                <span>{formatPHP(zReport.z_report?.cash_tendered ?? 0)}</span>
              </p>
              <p className="flex justify-between">
                <span>Change given</span>
                <span>{formatPHP(zReport.z_report?.change_given ?? 0)}</span>
              </p>
              {(zReport.z_report?.expenses_total ?? 0) > 0 && (
                <p className="flex justify-between">
                  <span>Expenses</span>
                  <span>{formatPHP(zReport.z_report?.expenses_total ?? 0)}</span>
                </p>
              )}
              {(zReport.z_report?.cash_expenses ?? 0) > 0 && (
                <p className="flex justify-between text-rose-600">
                  <span>Cash paid out</span>
                  <span>-{formatPHP(zReport.z_report?.cash_expenses ?? 0)}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span>Expected cash</span>
                <span className="font-bold">{formatPHP(zReport.expected_cash ?? 0)}</span>
              </p>
              <p className="flex justify-between">
                <span>Counted cash</span>
                <span className="font-bold">{formatPHP(zReport.counted_cash ?? 0)}</span>
              </p>
              <p className="flex justify-between">
                <span>Variance</span>
                <Badge tone={Number(zReport.variance) === 0 ? 'green' : 'red'}>
                  {formatPHP(Number(zReport.variance) || 0)}
                </Badge>
              </p>
            </div>
            <button
              className="mt-4 h-10 w-full rounded-lg bg-primary text-sm font-medium text-white"
              onClick={() => setZReport(null)}
            >
              Done — open a new shift to continue
            </button>
          </div>
        </div>
      )}

      {/* Receipt modal — shared thermal component (portal: print isolates to body) */}
      {receipt && (
        <SharedReceipt
          sale={receipt}
          items={receiptLines}
          payments={receiptPays}
          storeInfo={storeInfo}
          cashierName={cashierName}
          method={method}
          at={receiptAt}
          closeLabel="New sale"
          printLabel="Print"
          onClose={clearReceipt}
          onCloseExtra={() => {
            setReceiptLines([]);
            setReceiptAt(null);
            setReceiptPays([]);
          }}
        />
      )}
    </div>
  );
}
