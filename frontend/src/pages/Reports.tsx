import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { EmptyState, Section, Spinner, Table } from '../components/ui';
import { KpiCard } from '../components/KpiCard';

const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'] as const;
type Tab = (typeof TABS)[number];
const RANGED = new Set<Tab>(['sales', 'products', 'profit', 'expenses']);

type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'year';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'year', label: 'Year' },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeDates(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case '7d': {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { from: iso(f), to: today };
    }
    case '30d': {
      const f = new Date(now);
      f.setDate(f.getDate() - 29);
      return { from: iso(f), to: today };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today };
  }
}

function rangeLabel(_key: RangeKey, from: string, to: string): string {
  if (from && to && from === to) {
    const d = new Date(`${from}T12:00:00`);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (from && to)
    return `${from} → ${to}`;
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StoreBreakdown({
  rows,
  value,
  hint,
}: {
  rows: any[];
  value: (s: any) => string;
  hint?: (s: any) => string;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-[13px] font-semibold text-gray-500 dark:text-[#6f6a62]">
        Per store
      </p>
      <Table head={['Store', hint ? 'Detail' : '', 'Total']}>
        {rows.map((s: any) => (
          <tr key={s.store_id}>
            <td className="px-3 py-2 first:pl-0">
              {s.store_name ?? s.store_id.slice(0, 8)}
            </td>
            <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#6f6a62]">
              {hint?.(s) ?? ''}
            </td>
            <td className="px-3 py-2 text-right last:pr-0">{value(s)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const [from, setFrom] = useState(() => rangeDates('today').from);
  const [to, setTo] = useState(() => rangeDates('today').to);
  const [allStores, setAllStores] = useState(false);
  const [advanced, setAdvanced] = useState(true);
  const [locked, setLocked] = useState(false);
  // KPI summary for the header strip (independent of active tab).
  const [kpis, setKpis] = useState<{
    total: number;
    count: number;
    average: number;
    profit: number;
    expenses: number;
    margin: number;
  } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [branchCount, setBranchCount] = useState(1);

  const loadKpis = useCallback(
    async (f: string, e: string, all: boolean, canAdvanced: boolean) => {
      setKpiLoading(true);
      setKpis(null);
      try {
        if (all && canAdvanced) {
          const [s, p, x] = await Promise.all([
            api.get('/reports/consolidated/sales', { params: { from: f, to: e } }),
            api.get('/reports/consolidated/profit', { params: { from: f, to: e } }),
            api.get('/reports/consolidated/expenses', { params: { from: f, to: e } }),
          ]);
          const total = Number(s.data.data?.total) || 0;
          const count = Number(s.data.data?.count) || 0;
          const expenses = Number(x.data.data?.total) || 0;
          const profit = Number(p.data.data?.gross_profit) || 0;
          setKpis({
            total,
            count,
            average: count ? total / count : 0,
            profit,
            expenses,
            margin: total > 0 ? (profit / total) * 100 : 0,
          });
        } else {
          const [s, p, x] = await Promise.all([
            api.get('/reports/sales', { params: { from: f, to: e } }),
            api.get('/reports/profit', { params: { from: f, to: e } }),
            api.get('/reports/expenses', { params: { from: f, to: e } }),
          ]);
          const total = Number(s.data.data?.total) || 0;
          const count = Number(s.data.data?.count) || 0;
          const expenses = Number(x.data.data?.total) || 0;
          const profit = Number(p.data.data?.gross_profit) || 0;
          setKpis({
            total,
            count,
            average: count ? total / count : 0,
            profit,
            expenses,
            margin: total > 0 ? (profit / total) * 100 : 0,
          });
        }
      } catch {
        setKpis(null);
      } finally {
        setKpiLoading(false);
      }
    },
    [],
  );

  const load = useCallback(
    async (
      t: Tab,
      f = from,
      e = to,
      all = allStores,
      canAdvanced = advanced,
    ) => {
      setTab(t);
      setMsg('');
      setData(null);
      const wantAll = all && t !== 'utang' && t !== 'products';
      if (wantAll && !canAdvanced) {
        setLoading(false);
        setLocked(true);
        return;
      }
      setLocked(false);
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (RANGED.has(t)) {
          if (f) params.from = f;
          if (e) params.to = e;
        }
        const path = wantAll ? `/reports/consolidated/${t}` : `/reports/${t}`;
        const res = await api.get(path, { params });
        setData(res.data.data);
      } catch (err: any) {
        if (err.response?.status === 403 && wantAll) setLocked(true);
        else setMsg(err.response?.data?.error?.message ?? 'Load failed');
      } finally {
        setLoading(false);
      }
    },
    [from, to, allStores, advanced],
  );

  const applyRange = (key: RangeKey) => {
    const { from: f, to: e } = rangeDates(key);
    setRangeKey(key);
    setFrom(f);
    setTo(e);
    load(tab, f, e);
    loadKpis(f, e, allStores, advanced);
  };

  const toggleStores = (all: boolean) => {
    setAllStores(all);
    load(tab, from, to, all);
    loadKpis(from, to, all, advanced);
  };

  const downloadCSV = () => {
    if (tab !== 'products' || !Array.isArray(data)) return;
    const rows = [['Product', 'Qty', 'Revenue']];
    for (const r of data) rows.push([r.product_name, r.quantity, r.revenue]);
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `products-${iso(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    let canAdvanced = true;
    (async () => {
      try {
        const [sub, stores] = await Promise.all([
          api.get('/subscriptions/current'),
          api.get('/users/branch-stores').catch(() => null),
        ]);
        canAdvanced = (sub.data.data?.limits ?? {}).advanced_reports !== false;
        setAdvanced(canAdvanced);
        const n = (stores?.data?.data ?? []).length;
        if (n) setBranchCount(n);
      } catch {
        /* keep defaults */
      }
      load('sales', from, to, allStores, canAdvanced);
      loadKpis(from, to, allStores, canAdvanced);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upgradeBase =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/owner')
      ? '/owner/console/subscription'
      : '/billing';

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-[#15243a] dark:text-[#60a5fa]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" />
            </svg>
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Business Reports
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  allStores
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-[#123528] dark:text-[#3dd68c]'
                    : 'bg-gray-100 text-gray-600 dark:bg-[#1a1a1e] dark:text-[#9b958c]'
                }`}
              >
                {allStores ? 'Live Rollup' : 'This store'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-[#9b958c]">
              Cross-branch executive analytics ·{' '}
              {allStores
                ? `${branchCount} branch${branchCount === 1 ? '' : 'es'} reporting`
                : 'single branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'products' && data && (
            <button
              type="button"
              onClick={downloadCSV}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#e8e4dc] dark:hover:bg-[#1c1c20]"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* Date range pills */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-10 items-center rounded-full bg-gray-100 p-1 dark:bg-[#1a1a1e]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={rangeKey === r.key}
              onClick={() => applyRange(r.key)}
              className={`h-8 rounded-full px-3.5 text-[13px] font-semibold ${
                rangeKey === r.key
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 dark:text-[#9b958c] dark:hover:text-[#e8e4dc]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#c9c3b8]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" />
          </svg>
          {rangeLabel(rangeKey, from, to)}
        </span>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiLoading || !kpis ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:col-span-2 xl:col-span-4 dark:border-[#1e1e22] dark:bg-[#121214]">
            <Spinner label="Loading performance…" />
          </div>
        ) : (
          <>
            <KpiCard
              tone="green"
              label="Total sales"
              value={formatPHP(kpis.total)}
              hint={`${kpis.count} orders · avg ${formatPHP(kpis.average)}`}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 7H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7H6" />
                </svg>
              }
            />
            <KpiCard
              tone="teal"
              label="Net profit"
              value={`${kpis.profit >= 0 ? '+' : ''}${formatPHP(kpis.profit)}`}
              hint="Revenue minus COGS"
              badge={
                kpis.total > 0 ? `${kpis.margin.toFixed(1)}% margin` : undefined
              }
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 17 9 11l4 4 8-8" />
                  <path d="M14 7h7v7" />
                </svg>
              }
            />
            <KpiCard
              tone="blue"
              label="Orders"
              value={String(kpis.count)}
              hint="Completed sales in range"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M8 7h8M8 11h8M8 15h5" />
                </svg>
              }
            />
            <KpiCard
              tone="rose"
              label="Expenses"
              value={formatPHP(kpis.expenses)}
              hint="Recorded in range"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 12V8H6a2 2 0 1 1 0-4h12v4" />
                  <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Tabs + scope */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => load(t)}
            aria-pressed={tab === t}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold capitalize ${
              tab === t
                ? 'bg-primary text-white shadow'
                : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#9b958c] dark:hover:bg-[#1c1c20]'
            }`}
          >
            {t === 'utang' ? 'Credit' : t}
            {(t === 'inventory' || t === 'profit' || t === 'expenses' || t === 'sales') &&
              allStores && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    tab === t
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 text-rose-700 dark:bg-[#2a1a1c] dark:text-[#f08a8a]'
                  }`}
                >
                  PRO
                </span>
              )}
          </button>
        ))}
        {tab !== 'utang' && tab !== 'products' && (
          <div
            className="ml-1 inline-flex h-10 items-center rounded-full border border-gray-300 bg-white px-1 text-sm dark:border-[#2a2a2e] dark:bg-[#141416]"
            role="group"
            aria-label="Report scope"
          >
            <button
              type="button"
              onClick={() => toggleStores(false)}
              aria-pressed={!allStores}
              className={`rounded-full px-3 py-1.5 font-medium ${
                !allStores
                  ? 'bg-primary text-white'
                  : 'text-gray-600 dark:text-[#9b958c]'
              }`}
            >
              This store
            </button>
            <button
              type="button"
              onClick={() => toggleStores(true)}
              aria-pressed={allStores}
              className={`rounded-full px-3 py-1.5 font-medium ${
                allStores
                  ? 'bg-primary text-white'
                  : 'text-gray-600 dark:text-[#9b958c]'
              }`}
            >
              All stores
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p className="mb-3 text-[13px] text-red-600 dark:text-[#f0a090]">{msg}</p>
      )}

      <Section title={tab === 'utang' ? 'Credit' : tab.charAt(0).toUpperCase() + tab.slice(1)}>
        {locked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-[#3a3010] dark:bg-[#141208]">
            <p className="font-semibold text-amber-900 dark:text-white">
              All-stores reports are a paid feature
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-[#9b958c]">
              Upgrade to unlock org-wide rollups.
            </p>
            <p className="mt-3">
              <Link
                to={upgradeBase}
                className="font-semibold text-primary hover:underline"
              >
                View plans →
              </Link>
            </p>
          </div>
        ) : loading ? (
          <Spinner label="Loading report…" />
        ) : !data ? (
          <EmptyState title="No data" hint="Try a wider date range." />
        ) : null}
        {tab === 'sales' && data && (
          <>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPHP(data.total)}
            </p>
            <p className="text-sm text-gray-500 dark:text-[#9b958c]">
              {data.count} sales · avg {formatPHP(data.average)}
            </p>
            {(data.vat_collected ?? 0) > 0 && (
              <p className="flex justify-between py-1 text-sm text-gray-600 dark:text-[#c9c3b8]">
                <span>VAT collected</span>
                <span>{formatPHP(data.vat_collected)}</span>
              </p>
            )}
            {data.by_method?.map((m: any) => (
              <p
                key={m.method}
                className="flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]"
              >
                <span className="capitalize">{m.method}</span>
                <span>{formatPHP(m.total)}</span>
              </p>
            ))}
            {data.by_store && (
              <StoreBreakdown
                rows={data.by_store}
                value={(s: any) => formatPHP(s.total)}
                hint={(s: any) => `${s.count} sales`}
              />
            )}
          </>
        )}
        {tab === 'products' && data && (
          <Table head={['Product', 'Qty', 'Revenue']}>
            {(Array.isArray(data) ? data : []).slice(0, 20).map((r: any) => (
              <tr key={r.product_id}>
                <td className="px-3 py-2 first:pl-0">{r.product_name}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2 text-right last:pr-0">
                  {formatPHP(r.revenue)}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'inventory' && data && (
          <>
            <p className="text-sm text-gray-700 dark:text-[#c9c3b8]">
              Lines: {data.lines} · Value: {formatPHP(data.stock_value)} · Low:{' '}
              {data.low_stock}
            </p>
            {data.by_store && (
              <StoreBreakdown
                rows={data.by_store}
                value={(s: any) => formatPHP(s.stock_value)}
                hint={(s: any) => `${s.lines} lines`}
              />
            )}
          </>
        )}
        {tab === 'profit' && data && (
          <>
            <p className="text-sm text-gray-600 dark:text-[#9b958c]">
              Revenue: {formatPHP(data.revenue)}
            </p>
            <p className="text-sm text-gray-600 dark:text-[#9b958c]">
              COGS: {formatPHP(data.cogs)}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Gross profit: {formatPHP(data.gross_profit)}
            </p>
            {data.by_store && (
              <StoreBreakdown
                rows={data.by_store}
                value={(s: any) => formatPHP(s.gross_profit)}
                hint={(s: any) => formatPHP(s.revenue)}
              />
            )}
          </>
        )}
        {tab === 'expenses' && data && (
          <>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPHP(data.total)}
            </p>
            <p className="text-sm text-gray-500 dark:text-[#9b958c]">
              {data.count ?? 0} entries
              {(data.count ?? 0) > 0
                ? ` · avg ${formatPHP(data.average ?? 0)}`
                : ''}
            </p>
            {data.by_category?.map((c: any) => (
              <p
                key={c.category}
                className="flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]"
              >
                <span>{c.category}</span>
                <span>{formatPHP(c.total)}</span>
              </p>
            ))}
            {data.by_method?.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[13px] font-semibold text-gray-500 dark:text-[#6f6a62]">
                  By payment method
                </p>
                {data.by_method.map((m: any) => (
                  <p
                    key={m.method}
                    className="flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]"
                  >
                    <span className="capitalize">{m.method}</span>
                    <span>{formatPHP(m.total)}</span>
                  </p>
                ))}
              </div>
            )}
            {data.by_day?.length > 0 && (
              <Table head={['Day', 'Total']}>
                {data.by_day.map((d: any) => (
                  <tr key={d.day}>
                    <td className="px-3 py-2 first:pl-0">{d.day}</td>
                    <td className="px-3 py-2 text-right last:pr-0">
                      {formatPHP(d.total)}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {data.by_store && (
              <StoreBreakdown
                rows={data.by_store}
                value={(s: any) => formatPHP(s.total)}
                hint={(s: any) => `${s.count ?? 0} entries`}
              />
            )}
          </>
        )}
        {tab === 'utang' && data && (
          <>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatPHP(data.total_outstanding)} outstanding
            </p>
            <Table head={['Customer', 'Balance']}>
              {data.customers?.map((c: any) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 first:pl-0">{c.name}</td>
                  <td className="px-3 py-2 text-right last:pr-0">
                    {formatPHP(c.balance)}
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Section>
    </div>
  );
}
