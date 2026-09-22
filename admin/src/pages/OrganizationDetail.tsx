import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, EmptyState, PageHeader, Section, Spinner, Table } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

interface Detail {
  organization: any;
  subscription: {
    plan?: string;
    status?: string;
    effective_plan?: string;
    downgraded?: string | null;
    provider?: string;
    current_period_end?: string | null;
    upgrade_request?: { plan?: string; note?: string } | null;
    limits?: Record<string, unknown>;
  };
  usage: { stores?: number; products?: number; users?: number };
  stores: any[];
  members: any[];
  audit_logs: any[];
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export default function OrganizationDetailPage() {
  const { orgId } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!orgId) return;
    api
      .get(`/admin/organizations/${orgId}`)
      .then((r) => setDetail(r.data.data))
      .catch((e) => {
        if (e.response?.status === 403) setDenied(true);
        else setMsg(e.response?.data?.error?.message ?? 'Load failed');
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  if (denied) return <AccessDenied />;

  const sub = detail?.subscription;
  const usage = detail?.usage ?? {};
  const limits = sub?.limits ?? {};

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title={detail?.organization?.name ?? 'Organization'}
        sub="Profile, subscription, stores, members, and audit trail"
        actions={
          <Link to="/organizations" className="text-sm text-primary hover:underline">
            ← All organizations
          </Link>
        }
      />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      {loading ? (
        <Spinner label="Loading organization…" />
      ) : !detail ? (
        <EmptyState title="Organization not found" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Profile">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <Badge tone={detail.organization.status === 'active' ? 'green' : 'amber'}>
                  {detail.organization.status}
                </Badge>
              </dd>
              <dt className="text-gray-500">Slug</dt>
              <dd>{fmt(detail.organization.slug)}</dd>
              <dt className="text-gray-500">Created</dt>
              <dd>
                {detail.organization.created_at
                  ? new Date(detail.organization.created_at).toLocaleString()
                  : '—'}
              </dd>
            </dl>
          </Section>

          <Section title="Subscription">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Plan</dt>
              <dd>
                <Badge tone={sub?.status === 'active' ? 'green' : 'amber'}>
                  {sub?.plan ?? '—'}
                  {sub?.effective_plan && sub.effective_plan !== sub.plan
                    ? ` (effective: ${sub.effective_plan})`
                    : ''}
                </Badge>
              </dd>
              <dt className="text-gray-500">Status</dt>
              <dd>{fmt(sub?.status)}</dd>
              <dt className="text-gray-500">Provider</dt>
              <dd>{fmt(sub?.provider)}</dd>
              <dt className="text-gray-500">Renews</dt>
              <dd>
                {sub?.current_period_end
                  ? new Date(sub.current_period_end).toLocaleDateString()
                  : '—'}
              </dd>
              <dt className="text-gray-500">Downgraded</dt>
              <dd>{fmt(sub?.downgraded)}</dd>
              <dt className="text-gray-500">Upgrade request</dt>
              <dd>
                {sub?.upgrade_request?.plan
                  ? `${sub.upgrade_request.plan}${sub.upgrade_request.note ? ` · “${sub.upgrade_request.note}”` : ''}`
                  : '—'}
              </dd>
            </dl>
          </Section>

          <Section title="Usage vs limits">
            <ul className="space-y-1 text-[13px] text-gray-600">
              {(
                [
                  ['Stores', usage.stores, limits.max_stores],
                  ['Products', usage.products, limits.max_products],
                  ['Users', usage.users, limits.max_users],
                ] as const
              ).map(([label, used, max]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span>
                    {used ?? 0} / {fmt(max)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Stores (${detail.stores.length})`}>
            {detail.stores.length === 0 ? (
              <EmptyState title="No stores" />
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {detail.stores.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{s.code}</span>
                    </span>
                    <Badge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Members (${detail.members.length})`}>
            {detail.members.length === 0 ? (
              <EmptyState title="No members" />
            ) : (
              <Table head={['Name', 'Status', 'Joined']}>
                {detail.members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 first:pl-0">
                      {m.full_name ?? m.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone={m.status === 'active' ? 'green' : 'amber'}>{m.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500 last:pr-0">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title={`Recent activity (${detail.audit_logs.length})`}>
            {detail.audit_logs.length === 0 ? (
              <EmptyState title="No audit entries" />
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {detail.audit_logs.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{a.action}</span>
                      <span className="text-xs text-gray-400"> · {a.entity_type}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                    </span>
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
