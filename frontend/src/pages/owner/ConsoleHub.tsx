import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { formatPHP } from '../../utils/currency';
import { Spinner } from '../../components/ui';
import { KpiCard } from '../../components/KpiCard';

interface BranchRow {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  is_hq: boolean;
}

interface StoreSales {
  store_id: string;
  store_name: string;
  total: number;
  count: number;
}

interface StoreExpense {
  store_id: string;
  store_name: string;
  total: number;
}

interface HubContext {
  orgName: string;
  fullName: string;
  branchCount: number;
  goToStoreApp: () => void | Promise<void>;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function firstName(full: string, email?: string | null): string {
  if (full?.trim()) return full.trim().split(/\s+/)[0];
  return (email ?? 'there').split('@')[0];
}

function OpsCard({
  to,
  title,
  desc,
  badge,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  badge?: string;
  icon: JSX.Element;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-gray-900">{title}</p>
          {badge && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-gray-500">{desc}</p>
      </div>
      <span
        aria-hidden
        className="mt-1 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </Link>
  );
}

export default function ConsoleHubPage() {
  const ctx = useOutletContext<HubContext>();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [sales, setSales] = useState<{
    total: number;
    count: number;
    by_store: StoreSales[];
  } | null>(null);
  const [expenses, setExpenses] = useState<{
    total: number;
    by_store: StoreExpense[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsBlocked, setMetricsBlocked] = useState(false);

  const welcomeName = firstName(ctx.fullName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMetricsBlocked(false);
      try {
        const br = await api.get('/users/branch-stores');
        if (cancelled) return;
        setBranches((br.data.data ?? []) as BranchRow[]);
      } catch {
        if (!cancelled) setBranches([]);
      }
      const day = todayIso();
      try {
        const [s, e] = await Promise.all([
          api.get('/reports/consolidated/sales', { params: { from: day, to: day } }),
          api.get('/reports/consolidated/expenses', { params: { from: day, to: day } }),
        ]);
        if (cancelled) return;
        setSales({
          total: Number(s.data.data?.total) || 0,
          count: Number(s.data.data?.count) || 0,
          by_store: (s.data.data?.by_store ?? []) as StoreSales[],
        });
        setExpenses({
          total: Number(e.data.data?.total) || 0,
          by_store: (e.data.data?.by_store ?? []) as StoreExpense[],
        });
      } catch {
        if (cancelled) return;
        setSales(null);
        setExpenses(null);
        setMetricsBlocked(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const net = sales && expenses ? sales.total - expenses.total : 0;
  const margin =
    sales && sales.total > 0 && expenses
      ? ((sales.total - expenses.total) / sales.total) * 100
      : 0;

  const expenseByStore = new Map(
    (expenses?.by_store ?? []).map((r) => [r.store_id, Number(r.total) || 0]),
  );
  const ranked = [...(sales?.by_store ?? [])]
    .map((r) => ({
      ...r,
      expense: expenseByStore.get(r.store_id) ?? 0,
      net: (Number(r.total) || 0) - (expenseByStore.get(r.store_id) ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const branchMeta = new Map(branches.map((b) => [b.id, b]));
  const activeBranches =
    ctx.branchCount || branches.length || sales?.by_store.length || 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                {ctx.orgName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary-ink">
                <span aria-hidden>👑</span> Owner Console
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {welcomeName} ·{' '}
              <span className="font-semibold text-gray-900">
                {activeBranches} active branch{activeBranches === 1 ? '' : 'es'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 11h18" />
            </svg>
            Today · {todayLabel()}
          </span>
          <button
            type="button"
            onClick={() => ctx.goToStoreApp()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary-soft px-4 text-sm font-semibold text-primary-ink hover:bg-primary-soft/80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 9h18M5 9V5h14v4M5 9v10h14V9" />
            </svg>
            Return to Store App
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-6">
          <Spinner label="Loading today’s performance…" />
        </div>
      ) : metricsBlocked || !sales || !expenses ? (
        <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Today’s live performance
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">
                Cross-branch stats need a paid plan
              </h2>
              <p className="mt-1.5 text-sm text-gray-600">
                Upgrade to unlock live sales, profit, and branch rankings across every
                location. You can still open the console tools below and enter any branch.
              </p>
            </div>
            <Link
              to="/owner/console/subscription"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Upgrade plan
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Today’s live performance
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Live cross-branch rollup
            </p>
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              tone="green"
              label="Total sales"
              value={formatPHP(sales.total)}
              hint="Gross sales across all active branches"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 7H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7H6" />
                </svg>
              }
            />
            <KpiCard
              tone="teal"
              label="Estimated net profit"
              value={`${net >= 0 ? '+' : ''}${formatPHP(net)}`}
              hint="Revenue minus recorded expenses"
              badge={
                sales.total > 0
                  ? `${margin.toFixed(1)}% margin`
                  : undefined
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
              label="Total transactions"
              value={String(sales.count)}
              hint="Completed orders placed today"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M8 7h8M8 11h8M8 15h5" />
                </svg>
              }
            />
            <KpiCard
              tone="rose"
              label="Recorded expenses"
              value={formatPHP(expenses.total)}
              hint="Petty cash, utility & operational entries"
              badge="Daily outflow"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 12V8H6a2 2 0 1 1 0-4h12v4" />
                  <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z" />
                </svg>
              }
            />
          </div>

          {/* Branch performance pulse */}
          <div className="mb-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
                  </svg>
                </span>
                <div>
                  <p className="font-bold text-gray-900">Branch Performance Pulse</p>
                  <p className="text-[13px] text-gray-500">
                    Ranked by sales volume · {ranked.length || 1} branch
                    {(ranked.length || 1) === 1 ? '' : 'es'} reporting
                  </p>
                </div>
              </div>
              <Link
                to="/owner/console/reports"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Full Comparison ›
              </Link>
            </div>

            {ranked.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">
                No sales yet today. Enter a branch to start ringing up orders.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {ranked.map((row, i) => {
                  const meta = branchMeta.get(row.store_id);
                  const loc = meta?.address || meta?.code || '';
                  return (
                    <li
                      key={row.store_id}
                      className="flex flex-wrap items-center gap-3 px-5 py-4"
                    >
                      <span className="w-8 text-sm font-bold text-gray-400">
                        #{i + 1}
                      </span>
                      <span
                        aria-hidden
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          meta?.is_hq
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {meta?.is_hq ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5Zm0 2h14v2H5v-2Z" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">{row.store_name}</p>
                          {meta?.is_hq && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                              HQ
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-500">
                          {loc ? `${loc} · ` : ''}
                          {row.count} order{row.count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatPHP(row.total)}</p>
                        <p className="text-sm font-semibold text-emerald-600">
                          {row.net >= 0 ? '+' : ''}
                          {formatPHP(row.net)} net
                        </p>
                      </div>
                      <span aria-hidden className="text-gray-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Operations & Administration */}
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        Operations &amp; Administration
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OpsCard
          to="/owner/console/branches"
          title="Branches"
          badge={`${branches.length || ctx.branchCount || 1} active`}
          desc="Manage branch details, status & settings"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          }
        />
        <OpsCard
          to="/owner/console/transfers"
          title="Transfers"
          badge="Cross-store inventory"
          desc="Approve stock movements between stores"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" />
            </svg>
          }
        />
        <OpsCard
          to="/owner/console/reports"
          title="Reports"
          badge="Real-time sync"
          desc="Executive analytics, BIR receipts & trends"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" />
            </svg>
          }
        />
        <OpsCard
          to="/owner/console/users"
          title="Users"
          badge="Role access"
          desc="Assign cashiers, managers & permissions"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
              <path d="M16 11a3 3 0 1 0 0-6M21 19c0-2-1.5-3.5-4-4" />
            </svg>
          }
        />
        <OpsCard
          to="/owner/console/subscription"
          title="Subscription"
          badge="Plan details"
          desc="Plan limits, add-on features & billing"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          }
        />
        <OpsCard
          to="/owner/console/settings"
          title="Settings"
          badge="Configuration"
          desc="Tax IDs, business details & defaults"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
