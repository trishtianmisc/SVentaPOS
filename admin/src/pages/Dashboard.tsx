import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { EmptyState, PageHeader, Section, Spinner } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

interface Metrics {
  organizations: { total: number; active: number; suspended: number; last_30_days: number };
  totals: { stores: number; products: number; users: number };
  plans: Record<string, number>;
  pending_upgrade_requests: number;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary-ink">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .get('/admin/metrics')
      .then((r) => setMetrics(r.data.data))
      .catch((e) => {
        if (e.response?.status === 403) setDenied(true);
        else setMsg(e.response?.data?.error?.message ?? 'Load failed');
      })
      .finally(() => setLoading(false));
  }, []);

  if (denied) return <AccessDenied />;

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Dashboard" sub="Platform metrics across all organizations" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      {loading ? (
        <Spinner label="Loading metrics…" />
      ) : !metrics ? (
        <EmptyState title="No metrics available" />
      ) : (
        <div className="grid gap-4">
          <Section title="Organizations">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Total" value={metrics.organizations.total} />
              <Stat label="Active" value={metrics.organizations.active} />
              <Stat label="Suspended" value={metrics.organizations.suspended} />
              <Stat label="New (30 days)" value={metrics.organizations.last_30_days} />
            </div>
          </Section>
          <Section title="Platform totals">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Stores" value={metrics.totals.stores} />
              <Stat label="Products" value={metrics.totals.products} />
              <Stat label="Users" value={metrics.totals.users} />
              <Stat label="Pending upgrades" value={metrics.pending_upgrade_requests} />
            </div>
          </Section>
          <Section title="Plans">
            {Object.keys(metrics.plans).length === 0 ? (
              <EmptyState title="No subscriptions yet" />
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                {Object.entries(metrics.plans).map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="font-medium">{name}</span>
                    <span className="text-gray-500">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
