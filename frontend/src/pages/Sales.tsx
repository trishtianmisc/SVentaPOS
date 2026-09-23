import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { saleDayKey, parseSaleDate } from '../utils/receipt';
import { usePermissions } from '../hooks/usePermissions';
import { useSessionStore } from '../stores/session';
import { Receipt } from '../components/Receipt';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  TextInput,
  toast,
} from '../components/ui';

type DateTab = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';
type TypeFilter = 'all' | 'sale';

interface SaleRow {
  id: string;
  receipt_number: string;
  total: number;
  paid?: number;
  change?: number;
  status: string;
  created_at?: string;
  customer_name?: string | null;
  items_count?: number;
  payment_method?: string | null;
  store_id?: string | null;
  cashier_name?: string | null;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  discount_amount?: number;
}

const DATE_TABS: { key: DateTab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

const PAY_METHODS = [
  { value: '', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
  { value: 'utang', label: 'Utang' },
];

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffset(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function rangeFor(tab: DateTab, customFrom: string, customTo: string) {
  const today = new Date();
  switch (tab) {
    case 'today':
      return { from: isoDay(today), to: isoDay(today) };
    case 'yesterday':
      return { from: isoDay(dayOffset(1)), to: isoDay(dayOffset(1)) };
    case '7d':
      return { from: isoDay(dayOffset(6)), to: isoDay(today) };
    case '30d':
      return { from: isoDay(dayOffset(29)), to: isoDay(today) };
    case 'custom':
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
    default:
      return { from: undefined, to: undefined };
  }
}

function formatDayChip(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const today = isoDay(new Date());
  const yest = isoDay(dayOffset(1));
  if (key === today) return `Today · ${dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  if (key === yest) return `Yesterday · ${dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return dt.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso?: string): string {
  const d = parseSaleDate(iso);
  if (!d) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function exportCsv(rows: SaleRow[]) {
  const header = [
    'Receipt',
    'Date',
    'Time',
    'Customer',
    'Items',
    'Payment',
    'Status',
    'Total',
    'Cashier',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.receipt_number,
        r.created_at ? isoDay(new Date(r.created_at)) : '',
        formatTime(r.created_at),
        r.customer_name || 'Walk-in',
        r.items_count ?? '',
        r.payment_method ?? '',
        r.status,
        r.total,
        r.cashier_name ?? '',
      ]
        .map(esc)
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${isoDay(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function statusTone(status: string): 'green' | 'gray' | 'red' | 'amber' {
  if (status === 'COMPLETED') return 'green';
  if (status === 'VOIDED') return 'red';
  if (status === 'REFUNDED') return 'amber';
  return 'gray';
}

export default function SalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<DateTab>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [reportsOpen, setReportsOpen] = useState(false);
  const [storeLabel, setStoreLabel] = useState('');
  const storeId = useSessionStore((s) => s.storeId);
  const storeVersion = useSessionStore((s) => s.storeVersion);
  const { role, isOwner } = usePermissions();
  const canVoid = isOwner || role === 'owner' || role === 'manager' || role == null;

  useEffect(() => {
    api
      .get('/stores')
      .then((r) => {
        const list = r.data.data ?? [];
        const active = storeId
          ? list.find((s: any) => s.id === storeId)
          : list[0];
        const code = active?.code ?? active?.name;
        setStoreLabel(code ? `Store ${code}` : 'Store');
      })
      .catch(() => setStoreLabel('Store'));
  }, [storeId, storeVersion]);

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setMsg('');
    try {
      const { from, to } = rangeFor(tab, customFrom, customTo);
      const params: Record<string, string | number> = { limit: 500 };
      if (from) params.from = from;
      if (to) params.to = to;
      if (method) params.payment_method = method;
      if (status) params.status = status;
      if (search.trim()) params.q = search.trim();
      const res = await api.get('/sales', { params });
      setRows(res.data.data ?? []);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, customFrom, customTo, method, status, storeVersion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== 'all' && r.status === 'VOIDED') return false;
      if (q && !r.receipt_number.toLowerCase().includes(q)) return false;
      if (status && r.status !== status) return false;
      if (method && (r.payment_method || '') !== method) return false;
      return true;
    });
  }, [rows, search, type, status, method]);

  const stats = useMemo(() => {
    const completed = filtered.filter((r) => r.status === 'COMPLETED');
    const revenue = completed.reduce((s, r) => s + Number(r.total || 0), 0);
    const count = filtered.length;
    return {
      count,
      revenue,
      completed: completed.length,
      avg: completed.length ? revenue / completed.length : 0,
    };
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, SaleRow[]>();
    for (const r of filtered) {
      const key = saleDayKey(r.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const openDetail = async (id: string) => {
    setMsg('');
    try {
      const res = await api.get(`/sales/${id}`);
      setDetail(res.data.data);
      setShowReceipt(true);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open sale');
    }
  };

  const submitVoid = async () => {
    if (!detail || !voidReason.trim()) return;
    setMsg('');
    try {
      await api.post(`/sales/${detail.id}/void`, { reason: voidReason.trim() });
      setVoiding(false);
      setVoidReason('');
      toast('success', 'Sale voided — stock restored');
      const res = await api.get(`/sales/${detail.id}`);
      setDetail(res.data.data);
      await load({ silent: true });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Void failed');
    }
  };

  const dayTotal = (list: SaleRow[]) =>
    list
      .filter((r) => r.status === 'COMPLETED')
      .reduce((s, r) => s + Number(r.total || 0), 0);

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Transaction Records"
        sub="Receipts, payments, and voids"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="compact" onClick={() => exportCsv(filtered)}>
              Export
            </Button>
            <div className="relative">
              <Button
                variant="secondary"
                size="compact"
                onClick={() => setReportsOpen((v) => !v)}
                aria-expanded={reportsOpen}
              >
                Reports ▾
              </Button>
              {reportsOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <a
                    href="/reports"
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setReportsOpen(false)}
                  >
                    Sales report
                  </a>
                  <a
                    href="/reports"
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setReportsOpen(false)}
                  >
                    Z-report history
                  </a>
                  <a
                    href="/shifts"
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setReportsOpen(false)}
                  >
                    Shifts
                  </a>
                </div>
              )}
            </div>
            <Button size="compact" onClick={() => load()}>
              ↻
            </Button>
          </div>
        }
      />

      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {DATE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`h-9 rounded-full px-3 text-[13px] ${
              tab === t.key
                ? 'bg-primary text-white'
                : 'border border-gray-300 bg-white text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'custom' && (
        <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
          <Field label="From">
            <TextInput
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <TextInput
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <SearchInput
            label="Search receipts"
            placeholder="Receipt #"
            value={search}
            onChange={setSearch}
          />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Type
          </span>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            aria-label="Transaction type"
          >
            <option value="all">All</option>
            <option value="sale">Sale</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Payment
          </span>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-label="Payment method"
          >
            {PAY_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Status
          </span>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status"
          >
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </Select>
        </label>
        <Button variant="secondary" size="compact" onClick={() => load()}>
          Apply
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Transactions" value={String(stats.count)} />
        <StatCard label="Revenue" value={formatPHP(stats.revenue)} sub="Completed only" />
        <StatCard label="Completed" value={String(stats.completed)} />
        <StatCard label="Avg Value" value={formatPHP(stats.avg)} />
      </div>

      {loading ? (
        <Spinner label="Loading transactions…" />
      ) : groups.length === 0 ? (
        <EmptyState
          title={
            search || method || status || tab !== 'all'
              ? 'No transactions match'
              : 'No transactions yet'
          }
          hint={
            search || method || status || tab !== 'all'
              ? 'Clear search or adjust filters.'
              : 'Completed sales appear here after checkout.'
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([dayKey, list]) => (
            <div key={dayKey} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    {formatDayChip(dayKey)}
                  </span>
                  <span className="text-[13px] text-gray-500">
                    {list.length} transaction{list.length === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatPHP(dayTotal(list))}
                </span>
              </div>

              <ul className="divide-y divide-gray-100">
                {list.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50/80"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        s.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                    <span className="w-16 shrink-0 text-sm text-gray-600">
                      {formatTime(s.created_at)}
                    </span>
                    <span className="font-medium text-primary">
                      {s.receipt_number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                      {s.customer_name || 'Walk-in'}
                    </span>
                    <span className="hidden text-[13px] text-gray-400 sm:inline">
                      {storeLabel || 'Store'}
                    </span>
                    <span className="w-16 text-right text-[13px] text-gray-500">
                      {s.items_count ?? 0} item{(s.items_count ?? 0) === 1 ? '' : 's'}
                    </span>
                    <span className="w-16 text-right text-[13px] capitalize text-gray-500">
                      {s.payment_method || '—'}
                    </span>
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    <span className="w-24 text-right font-semibold">
                      {formatPHP(s.total)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 print:hidden">
                      <button
                        type="button"
                        aria-label={`View receipt ${s.receipt_number}`}
                        title="View receipt"
                        onClick={() => openDetail(s.id)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:border-primary hover:text-primary"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Print receipt ${s.receipt_number}`}
                        title="Print receipt"
                        onClick={() => openDetail(s.id)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:border-primary hover:text-primary"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                          <path d="M6 9V2h12v7" />
                          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                          <path d="M6 14h12v8H6z" />
                        </svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showReceipt && detail && (
        <Receipt
          sale={detail}
          items={detail.items ?? []}
          payments={detail.payments ?? []}
          storeInfo={null}
          cashierName={detail.cashier_name ?? ''}
          at={parseSaleDate(detail.created_at)}
          onClose={() => setShowReceipt(false)}
          closeLabel="Close"
          printLabel="Print Receipt"
          footer={
            <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
              <button
                className="h-10 rounded-lg border border-gray-300 text-sm font-medium"
                onClick={() => window.print()}
              >
                Print Receipt
              </button>
              <button
                className="h-10 rounded-lg border border-gray-300 text-sm font-medium"
                onClick={() => window.print()}
                title="Opens the browser print dialog — choose Save as PDF"
              >
                Download PDF
              </button>
              {canVoid && detail.status === 'COMPLETED' && (
                <button
                  className="col-span-2 h-10 rounded-lg bg-red-700 text-sm font-medium text-white hover:bg-red-800"
                  onClick={() => {
                    setShowReceipt(false);
                    setVoiding(true);
                  }}
                >
                  Void
                </button>
              )}
            </div>
          }
        />
      )}

      {voiding && (
        <Modal title="Void this sale?" onClose={() => setVoiding(false)}>
          <p className="text-sm text-gray-600">
            The sale stays in history as voided and its stock is restored. This
            cannot be undone.
          </p>
          <div className="mt-3 grid gap-3">
            <Field label="Reason" hint="Required — recorded in the audit log.">
              <TextInput
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. wrong item scanned"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setVoiding(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!voidReason.trim()}
                onClick={submitVoid}
              >
                Void sale
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
