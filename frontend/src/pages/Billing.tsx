import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Section,
  Spinner,
  TextInput,
  toast,
} from '../components/ui';
import { formatPHP } from '../utils/currency';

interface Plan {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  feature_limits: Record<string, any>;
}

function limitLines(limits: Record<string, any>) {
  return [
    `${limits.max_stores ?? '—'} store${limits.max_stores === 1 ? '' : 's'}`,
    `${limits.max_products ?? '—'} products`,
    `${limits.max_users ?? '—'} users`,
    limits.wholesale ? 'Wholesale pricing' : null,
    limits.advanced_reports ? 'Advanced reports' : 'Basic reports',
  ].filter(Boolean) as string[];
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [reqPlan, setReqPlan] = useState<string | null>(null);
  const [reqNote, setReqNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [p, s, u, stores] = await Promise.all([
      api.get('/subscriptions/plans'),
      api.get('/subscriptions/current'),
      api.get('/subscriptions/usage'),
      api.get('/stores'),
    ]);
    setPlans(p.data.data ?? []);
    setSub(s.data.data);
    setUsage(u.data.data);
    setCanManage(
      ((stores.data.data ?? []) as any[]).some((r) =>
        ['owner', 'manager'].includes(String(r.role ?? '').toLowerCase()),
      ),
    );
  };

  useEffect(() => {
    load()
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestUpgrade = async () => {
    if (!reqPlan) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post('/subscriptions/request-upgrade', {
        plan: reqPlan,
        note: reqNote.trim() || undefined,
      });
      setReqPlan(null);
      setReqNote('');
      toast('success', 'Upgrade requested — an admin will apply it');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const downgrade = async () => {
    if (!window.confirm('Downgrade to Free now? Paid features lock immediately.'))
      return;
    setBusy(true);
    setMsg('');
    try {
      await api.post('/subscriptions/downgrade');
      toast('success', 'Downgraded to Free');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Downgrade failed');
    } finally {
      setBusy(false);
    }
  };

  const planName = sub?.plan?.name ?? '—';
  const effective = sub?.effective_plan ?? planName;
  const limited = !!sub?.downgraded;

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Billing"
        sub="Plans, usage, and upgrades"
        actions={
          sub ? (
            <Badge tone={limited ? 'amber' : 'green'}>
              {effective}
              {limited ? ` · ${sub.downgraded}` : ''}
            </Badge>
          ) : undefined
        }
      />
      {loading ? (
        <Spinner label="Loading billing…" />
      ) : !sub ? (
        <EmptyState title="No subscription" hint="Could not load billing." />
      ) : (
        <div className="grid gap-4">
          {limited && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              Your {sub.raw_plan?.name ?? 'paid'} plan is {sub.downgraded} — the
              store is running on Free limits until it is renewed. Paid
              features (all-stores reports, forecast, wholesale pricing) are
              locked.
            </p>
          )}
          {sub.upgrade_request && (
            <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-800">
              Upgrade to {sub.upgrade_request.plan} requested
              {sub.upgrade_request.requested_at
                ? ` on ${new Date(sub.upgrade_request.requested_at).toLocaleDateString()}`
                : ''}
              {' '}— waiting for approval.
            </p>
          )}
          <Section
            title="Current plan"
            action={
              sub.current_period_end ? (
                <span className="text-[13px] text-gray-500">
                  Renews {new Date(sub.current_period_end).toLocaleDateString()}
                </span>
              ) : undefined
            }
          >
            <div className="grid gap-1 text-sm">
              <p>
                <span className="font-semibold">{planName}</span>
                <span className="ml-2 text-gray-500">{sub.status}</span>
              </p>
              {usage && (
                <ul className="mt-2 space-y-1 text-[13px] text-gray-600">
                  {[
                    ['Stores', usage.stores, sub.limits?.max_stores],
                    ['Products', usage.products, sub.limits?.max_products],
                    ['Team', usage.users, sub.limits?.max_users],
                  ].map(([label, used, cap]: any[]) => (
                    <li key={label} className="flex justify-between">
                      <span>{label}</span>
                      <span>
                        {used}
                        {cap != null ? ` / ${cap}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
          <Section title="Plans">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((p) => {
                const isCurrent = p.name === planName;
                const pending = sub.upgrade_request?.plan === p.name;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-4 ${isCurrent ? 'border-primary' : 'border-gray-200'}`}
                  >
                    <p className="font-bold">
                      {p.name}{' '}
                      {isCurrent && (
                        <Badge tone="green">current</Badge>
                      )}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatPHP(p.price)}
                      <span className="text-sm font-normal text-gray-500">
                        /{p.billing_interval}
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1 text-[13px] text-gray-600">
                      {limitLines(p.feature_limits ?? {}).map((l) => (
                        <li key={l}>· {l}</li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      {!isCurrent && canManage && p.name !== 'Free' && !pending && (
                        <Button
                          size="compact"
                          variant="secondary"
                          onClick={() => setReqPlan(p.name)}
                        >
                          Request upgrade
                        </Button>
                      )}
                      {pending && <Badge tone="amber">requested</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
            {!canManage && (
              <p className="mt-3 text-[13px] text-gray-500">
                Owner or manager role required to change plans.
              </p>
            )}
          </Section>
          {msg && <p className="text-[13px] text-red-600">{msg}</p>}
          {canManage && planName !== 'Free' && (
            <div>
              <Button variant="ghost" disabled={busy} onClick={downgrade}>
                Downgrade to Free
              </Button>
            </div>
          )}
        </div>
      )}

      {reqPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request upgrade"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setReqPlan(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold">Request {reqPlan}</p>
            <p className="mt-1 text-sm text-gray-500">
              Manual billing: an admin reviews and applies the plan. No payment
              is taken here.
            </p>
            <div className="mt-3">
              <Field label="Note (optional)">
                <TextInput
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  placeholder="e.g. need 2 more stores"
                />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setReqPlan(null)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={requestUpgrade}>
                {busy ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
