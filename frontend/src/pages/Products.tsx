import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import {
  useCategories,
  useInventory,
  useProducts,
  type Product,
} from '../hooks/useCatalog';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  ListFooter,
  Modal,
  SearchInput,
  Section,
  Select,
  Spinner,
  TextInput,
  toast,
} from '../components/ui';
import { formatPHP } from '../utils/currency';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore } from '../stores/session';

type StatusFilter = 'all' | 'active' | 'low' | 'out';
type ViewMode = 'list' | 'grid';
type StockStatus = 'active' | 'low' | 'out';

type Row = {
  product: Product;
  stock: number | null;
  status: StockStatus;
  categoryName: string;
  popular: boolean;
};

function stockStatus(p: Product, qty: number | null): StockStatus {
  if (!p.track_inventory) return 'active';
  const q = qty ?? 0;
  if (q <= 0) return 'out';
  const threshold = Math.max(p.minimum_stock ?? 0, p.reorder_level ?? 0);
  if (threshold > 0 && q <= threshold) return 'low';
  return 'active';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function exportCsv(rows: Row[]) {
  const header = [
    'Name',
    'SKU',
    'Barcode',
    'Brand',
    'Category',
    'Cost',
    'Price',
    'Wholesale',
    'Min stock',
    'Reorder',
    'Stock',
    'Status',
    'VAT exempt',
    'Active',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.product.name,
        r.product.sku,
        r.product.barcode,
        r.product.brand,
        r.categoryName,
        r.product.cost_price,
        r.product.retail_price,
        r.product.wholesale_price ?? '',
        r.product.minimum_stock ?? 0,
        r.product.reorder_level ?? 0,
        r.stock ?? '',
        r.status,
        r.product.vat_exempt ? 'yes' : 'no',
        r.product.active === false ? 'no' : 'yes',
      ]
        .map(esc)
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ProductThumb({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-900 text-gray-400"
    >
      {product.image_path && !broken ? (
        <img
          src={product.image_path}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="m21 16-5-5-4 4-2-2-5 5" />
        </svg>
      )}
    </span>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  if (status === 'out') return <Badge tone="red">Out</Badge>;
  if (status === 'low') return <Badge tone="amber">Low</Badge>;
  return <Badge tone="green">Active</Badge>;
}

export default function ProductsPage() {
  const { data: items = [], error, isPending } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: inventory = [] } = useInventory();
  const userId = useAuthStore((s) => s.userId);
  const storeId = useSessionStore((s) => s.storeId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [popularOnly, setPopularOnly] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editExempt, setEditExempt] = useState(false);
  const [msg, setMsg] = useState('');
  const [unitsFor, setUnitsFor] = useState<Product | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [unitName, setUnitName] = useState('');
  const [unitFactor, setUnitFactor] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  // Top sellers → Popular badge/filter (best-effort; 403 on free plan is fine).
  const popularQ = useQuery({
    queryKey: ['reports', 'products', storeId ?? 'none', userId ?? 'anon'],
    queryFn: () =>
      api.get('/reports/products').then((r) => r.data.data ?? []),
    staleTime: 5 * 60_000,
    enabled: !!userId && !!storeId,
    retry: false,
  });
  const popularIds = useMemo(() => {
    const list = popularQ.data ?? [];
    return new Set(
      list
        .filter((r: any) => (r.quantity ?? 0) > 0)
        .map((r: any) => String(r.product_id)),
    );
  }, [popularQ.data]);

  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? (m.get(id) ?? '—') : '—');
  }, [categories]);

  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inventory) m.set(r.product_id, r.quantity ?? 0);
    return m;
  }, [inventory]);

  const rows: Row[] = useMemo(
    () =>
      items.map((p) => {
        const stock = p.track_inventory ? (stockByProduct.get(p.id) ?? 0) : null;
        return {
          product: p,
          stock,
          status: stockStatus(p, stock),
          categoryName: catName(p.category_id),
          popular: popularIds.has(p.id),
        };
      }),
    [items, stockByProduct, catName, popularIds],
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      low: rows.filter((r) => r.status === 'low').length,
      out: rows.filter((r) => r.status === 'out').length,
      popular: rows.filter((r) => r.popular).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const p = r.product;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.barcode ?? '').toLowerCase().includes(q) &&
        !(p.sku ?? '').toLowerCase().includes(q) &&
        !(p.brand ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (popularOnly && !r.popular) return false;
      return true;
    });
  }, [rows, search, categoryFilter, statusFilter, popularOnly]);

  const hasFilters =
    search.trim() !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    popularOnly;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setPopularOnly(false);
  };

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  const openEditPage = (p: Product) => {
    setMenuFor(null);
    navigate(`/products/${p.id}/edit`);
  };

  const openQuickEdit = (p: Product) => {
    setMenuFor(null);
    setEditing(p);
    setEditPrice(String(p.retail_price ?? ''));
    setEditCost(String((p as any).cost_price ?? ''));
    setEditExempt(!!p.vat_exempt);
    setMsg('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setMsg('');
    try {
      await api.put(`/products/${editing.id}`, {
        retail_price: Number(editPrice),
        cost_price: editCost === '' ? undefined : Number(editCost),
        vat_exempt: editExempt,
      });
      setEditing(null);
      toast('success', 'Product updated');
      qc.invalidateQueries({ queryKey: qk.products });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Update failed');
    }
  };

  const deactivate = async (p: Product) => {
    setMenuFor(null);
    if (!window.confirm(`Deactivate ${p.name}? It stays in past sales history.`)) {
      return;
    }
    setMsg('');
    try {
      await api.delete(`/products/${p.id}`);
      toast('success', 'Product deactivated');
      qc.invalidateQueries({ queryKey: qk.products });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Deactivate failed');
    }
  };

  const openUnits = async (p: Product) => {
    setMenuFor(null);
    setUnitsFor(p);
    setMsg('');
    try {
      const res = await api.get(`/products/${p.id}/units`);
      setUnits(res.data.data ?? []);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not load units');
    }
  };

  const addUnit = async () => {
    if (!unitsFor || !unitName.trim() || Number(unitFactor) <= 0) return;
    setMsg('');
    try {
      await api.post(`/products/${unitsFor.id}/units`, {
        unit_name: unitName.trim(),
        conversion_factor: Number(unitFactor),
        selling_price: unitPrice === '' ? undefined : Number(unitPrice),
      });
      setUnitName('');
      setUnitFactor('');
      setUnitPrice('');
      const res = await api.get(`/products/${unitsFor.id}/units`);
      setUnits(res.data.data ?? []);
      toast('success', 'Unit added');
      qc.invalidateQueries({ queryKey: qk.units });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Add unit failed');
    }
  };

  const delUnit = async (u: any) => {
    if (!unitsFor || !window.confirm(`Remove unit "${u.unit_name}"?`)) return;
    setMsg('');
    try {
      await api.delete(`/products/${unitsFor.id}/units/${u.id}`);
      setUnits(units.filter((x) => x.id !== u.id));
      toast('success', 'Unit removed');
      qc.invalidateQueries({ queryKey: qk.units });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Remove failed');
    }
  };

  const toggleAll = () => {
    if (selected.size === visible.length && visible.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((r) => r.product.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const thCls =
    'px-3 py-2.5 text-left text-xs font-medium text-gray-500 first:pl-0 last:pr-0';

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 7h14l-1.4 13H6.4L5 7Z" />
              <path d="M9 7V6a3 3 0 0 1 6 0v1" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Product Management
            </h1>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Manage inventory and product catalog
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => exportCsv(visible)}
            disabled={visible.length === 0}
          >
            ↓ Export
          </Button>
          <Button variant="secondary" title="More actions" onClick={() => setMsg('')}>
            ··· More
          </Button>
          <Button onClick={() => navigate('/products/new')}>+ Add</Button>
        </div>
      </div>

      {msg && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={clearFilters}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
            statusFilter === 'all' && !popularOnly && !search && categoryFilter === 'all'
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <span className="text-red-500" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 7h14l-1.4 13H6.4L5 7Z" />
              <path d="M9 7V6a3 3 0 0 1 6 0v1" />
            </svg>
          </span>
          <span className="text-sm text-gray-600">
            <strong className="mr-1 text-base font-semibold text-gray-900">
              {stats.total}
            </strong>
            Products
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
            statusFilter === 'low'
              ? 'border-gray-300 bg-gray-100'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <span className="text-gray-500" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3 2 20h20L12 3Z" />
              <path d="M12 10v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <span className="text-sm text-gray-600">
            <strong className="mr-1 text-base font-semibold text-gray-900">
              {stats.low}
            </strong>
            Low
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
            statusFilter === 'out'
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <span className="text-red-400" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <span className="text-sm text-gray-600">
            <strong className="mr-1 text-base font-semibold text-gray-900">
              {stats.out}
            </strong>
            Out
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPopularOnly((v) => !v)}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
            popularOnly
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
          aria-pressed={popularOnly}
        >
          <span className="text-red-400" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          </span>
          <span className="text-sm text-gray-600">
            <strong className="mr-1 text-base font-semibold text-gray-900">
              {stats.popular}
            </strong>
            Popular
          </span>
        </button>
      </div>

      <Section>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <SearchInput
              label="Search products"
              placeholder="Search products, names, or barcodes…"
              value={search}
              onChange={setSearch}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">
                All Categories{categories.length ? ` (${categories.length})` : ''}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="active">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setPopularOnly((v) => !v)}
            className={`inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
              popularOnly
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            aria-pressed={popularOnly}
          >
            ☆ Popular
          </button>
          <div
            className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-300"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={`h-11 w-11 text-sm ${
                view === 'grid'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ▦
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={`h-11 w-11 text-sm ${
                view === 'list'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ☰
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
            <span aria-hidden="true">⚑</span>
            Filters
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-medium text-gray-700 underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
            className={
              statusFilter === 'low'
                ? 'font-semibold text-primary'
                : 'text-gray-700 hover:text-gray-900'
            }
          >
            Low stock
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')}
            className={
              statusFilter === 'out'
                ? 'font-semibold text-primary'
                : 'text-gray-700 hover:text-gray-900'
            }
          >
            Out of stock
          </button>
          <span className="ml-auto text-gray-500">
            Showing {visible.length} of {rows.length} products
          </span>
        </div>
      </Section>

      <div className="mt-4">
        {isPending ? (
          <Spinner label="Loading products…" />
        ) : error ? (
          <p className="py-2 text-sm text-red-600">Could not load products.</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No products match' : 'No products yet'}
            hint={
              hasFilters
                ? 'Try different filters or clear all.'
                : 'Add your first product to get started.'
            }
          />
        ) : view === 'list' ? (
          <Section>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className={`${thCls} w-10`}>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={
                          visible.length > 0 && selected.size === visible.length
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th scope="col" className={thCls}>
                      Product ⇅
                    </th>
                    <th scope="col" className={thCls}>
                      Category ⇅
                    </th>
                    <th scope="col" className={`${thCls} text-right`}>
                      Price ⇅
                    </th>
                    <th scope="col" className={`${thCls} text-right`}>
                      Stock ⇅
                    </th>
                    <th scope="col" className={thCls}>
                      Status ⇅
                    </th>
                    <th scope="col" className={`${thCls} text-right`}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((r) => {
                    const p = r.product;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/80">
                        <td className="px-3 py-3 first:pl-0">
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.name}`}
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <ProductThumb product={p} />
                              {p.track_inventory && (
                                <span
                                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                                    r.status === 'out'
                                      ? 'bg-red-500'
                                      : r.status === 'low'
                                        ? 'bg-amber-400'
                                        : 'bg-emerald-500'
                                  }`}
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">
                                {p.name}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {formatDate(p.created_at) || p.id.slice(0, 8)}
                                {p.vat_exempt && ' · VAT-exempt'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="brand">{r.categoryName}</Badge>
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatPHP(p.retail_price)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.stock == null ? (
                            <span className="text-gray-400">—</span>
                          ) : r.status === 'low' || r.status === 'out' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <span aria-hidden="true">⚠</span>
                              {r.stock}
                            </span>
                          ) : (
                            <span>{r.stock}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="relative px-3 py-3 text-right last:pr-0">
                          <button
                            type="button"
                            aria-label={`Actions for ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(menuFor === p.id ? null : p.id);
                            }}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-500 hover:bg-gray-100"
                          >
                            ···
                          </button>
                          {menuFor === p.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg"
                            >
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => openQuickEdit(p)}
                              >
                                Quick edit
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => openEditPage(p)}
                              >
                                Full edit
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => openUnits(p)}
                              >
                                Sell units
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                onClick={() => deactivate(p)}
                              >
                                Deactivate
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListFooter count={visible.length} noun="product" />
          </Section>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((r) => {
              const p = r.product;
              return (
                <article
                  key={p.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-gray-500">
                    {p.image_path ? (
                      <img
                        src={p.image_path}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="9" cy="11" r="2" />
                        <path d="m21 16-5-5-4 4-2-2-5 5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(p.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone="brand">{r.categoryName}</Badge>
                    <span className="font-semibold">{formatPHP(p.retail_price)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-sm text-gray-600">
                      Stock: <strong>{r.stock == null ? '—' : r.stock}</strong>
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="compact"
                        variant="secondary"
                        onClick={() => openEditPage(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="compact"
                        variant="ghost"
                        onClick={() => deactivate(p)}
                      >
                        Off
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg md:bottom-6">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <Button size="compact" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button
            size="compact"
            variant="secondary"
            onClick={() => exportCsv(rows.filter((r) => selected.has(r.product.id)))}
          >
            Export selected
          </Button>
        </div>
      )}

      {unitsFor && (
        <Modal title={`Units — ${unitsFor.name}`} onClose={() => setUnitsFor(null)}>
          <div className="grid gap-3">
            <p className="text-[13px] text-gray-500">
              Base unit is “pc”. Add alternates like “case of 12”: 1 case deducts 12
              from stock. Leave price blank for linear pricing (base × 12).
            </p>
            {units.length === 0 ? (
              <p className="text-sm text-gray-400">No extra units yet.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="px-3 py-2 font-medium first:pl-0">Unit</th>
                      <th className="px-3 py-2 text-right font-medium">Factor</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 last:pr-0" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {units.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2 first:pl-0">{u.unit_name}</td>
                        <td className="px-3 py-2 text-right">×{u.conversion_factor}</td>
                        <td className="px-3 py-2 text-right">
                          {u.selling_price != null
                            ? formatPHP(u.selling_price)
                            : 'linear'}
                        </td>
                        <td className="px-3 py-2 text-right last:pr-0">
                          <Button
                            size="compact"
                            variant="ghost"
                            onClick={() => delUnit(u)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-[1fr_72px_88px_auto] items-end gap-2">
              <Field label="Unit">
                <TextInput
                  placeholder="case"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                />
              </Field>
              <Field label="Factor">
                <TextInput
                  placeholder="12"
                  value={unitFactor}
                  onChange={(e) => setUnitFactor(e.target.value)}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Price ₱">
                <TextInput
                  placeholder="optional"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  inputMode="decimal"
                />
              </Field>
              <Button
                variant="secondary"
                disabled={!unitName.trim() || Number(unitFactor) <= 0}
                onClick={addUnit}
              >
                Add
              </Button>
            </div>
            {msg && <p className="text-[13px] text-red-600">{msg}</p>}
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Quick edit — ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <div className="grid gap-3">
            <Field label="Retail price (₱)">
              <TextInput
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Cost price (₱)" hint="Used for profit reports.">
              <TextInput
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-gray-600">
              <input
                type="checkbox"
                checked={editExempt}
                onChange={(e) => setEditExempt(e.target.checked)}
              />
              VAT exempt (excluded from the VAT base)
            </label>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const id = editing.id;
                  setEditing(null);
                  navigate(`/products/${id}/edit`);
                }}
              >
                Full form
              </Button>
              <Button onClick={saveEdit}>Save changes</Button>
            </div>
            {msg && <p className="text-[13px] text-red-600">{msg}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
