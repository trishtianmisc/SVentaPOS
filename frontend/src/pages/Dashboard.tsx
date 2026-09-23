import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, PageHeader, Section, Select } from '../components/ui';
import { useInventory } from '../hooks/useCatalog';
import { useSessionStore, confirmStoreSwitch } from '../stores/session';

const CARDS = [
  { to: '/pos', title: 'New sale', desc: 'POS cart + cash checkout' },
  { to: '/products', title: 'Products', desc: 'Catalog + stock adjustments' },
  { to: '/sales', title: 'Sales', desc: 'Transaction records + receipts' },
  { to: '/shifts', title: 'Shifts', desc: 'Float, close-out, variance' },
  { to: '/customers', title: 'Customers', desc: 'Utang ledger + payments' },
  { to: '/suppliers', title: 'Suppliers', desc: 'Suppliers + purchase orders' },
  { to: '/transfers', title: 'Transfers', desc: 'Move stock between stores' },
  { to: '/expenses', title: 'Expenses', desc: 'Costs + categories' },
  { to: '/reports', title: 'Reports', desc: 'Sales, profit, utang' },
  { to: '/users', title: 'Users', desc: 'Staff roles and access' },
  { to: '/settings', title: 'Settings', desc: 'Store profile + tax' },
  { to: '/billing', title: 'Billing', desc: 'Plans, usage, upgrades' },
];

export default function DashboardPage() {
  const storeId = useSessionStore((s) => s.storeId);
  const setStore = useSessionStore((s) => s.setStore);
  const [stores, setStores] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const { data: rows = [] } = useInventory();
  const lowCount = rows.filter(
    (r) => (r.reorder_level ?? 0) > 0 && r.quantity <= (r.reorder_level ?? 0),
  ).length;

  useEffect(() => {
    api
      .get('/stores')
      .then((r) => setStores(r.data.data ?? []))
      .catch(() => undefined);
    api
      .get('/subscriptions/current')
      .then((r) => setSub(r.data.data))
      .catch(() => undefined);
    api
      .get('/subscriptions/usage')
      .then((r) => setUsage(r.data.data))
      .catch(() => undefined);
    api
      .get('/notifications?unread_only=true')
      .then((r) => setNotifs(r.data.data ?? []))
      .catch(() => undefined);
  }, []);

  const pick = (id: string) => {
    if (!id || id === storeId) return;
    if (!confirmStoreSwitch()) return;
    setStore(id);
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Dashboard" sub="Store overview and shortcuts" />
      {!storeId && (
        <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
          No store assigned yet. Ask an owner to add you to a store.
        </p>
      )}
      {lowCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            {lowCount} product{lowCount === 1 ? '' : 's'} at or below reorder level.
          </p>
          <Link to="/products">
            <Badge tone="amber">Review stock</Badge>
          </Link>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-4">
        <Section title="Active store">
          {stores.length > 1 && !storeId ? (
            <Select aria-label="Active store" value={storeId ?? ''} onChange={(e) => pick(e.target.value)}>
              <option value="">Select store…</option>
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-gray-500">
              {stores.find((s: any) => s.id === storeId)?.name ??
                stores[0]?.name ??
                'Loading stores…'}
            </p>
          )}
          {stores.length > 1 && !storeId && (
            <p className="mt-2 text-xs text-gray-400">
              Switching stores reloads stock, sales, and balances for that store.
            </p>
          )}
        </Section>
        <Section title="Subscription">
          {sub ? (
            <>
              <p className="text-sm">
                <span className="font-semibold">{sub.plan?.name ?? '—'}</span>
                <span className="ml-2 text-xs text-gray-500">{sub.status}</span>
              </p>
              {usage && (
                <ul className="mt-2 space-y-1 text-[13px] text-gray-600">
                  <li className="flex justify-between">
                    <span>Stores</span>
                    <span>{usage.stores} / {sub.limits?.max_stores ?? '—'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Products</span>
                    <span>{usage.products} / {sub.limits?.max_products ?? '—'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Users</span>
                    <span>{usage.users} / {sub.limits?.max_users ?? '—'}</span>
                  </li>
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Loading plan…</p>
          )}
        </Section>
        {notifs.length > 0 && (
          <Section title={`Notifications (${notifs.length})`}>
            <ul className="space-y-2">
              {notifs.slice(0, 5).map((n: any) => (
                <li key={n.id} className="flex items-start justify-between gap-2 text-[13px]">
                  <span>
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="text-gray-500">{n.body}</p>}
                  </span>
                  <button
                    type="button"
                    aria-label={`Dismiss notification: ${n.title}`}
                    onClick={async () => {
                      await api.post(`/notifications/${n.id}/read`).catch(() => undefined);
                      setNotifs((ns: any[]) => ns.filter((x) => x.id !== n.id));
                    }}
                    className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARDS.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="rounded-xl border border-gray-200 bg-white p-4 hover:border-primary md:p-5"
            >
              <p className="text-sm font-semibold text-primary-ink">{c.title}</p>
              <p className="mt-1 text-xs text-gray-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
