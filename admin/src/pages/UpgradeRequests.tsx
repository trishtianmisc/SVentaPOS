import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, Button, EmptyState, PageHeader, Section, Spinner, Table, toast } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

export default function UpgradeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [denied, setDenied] = useState(false);

  const load = async () => {
    const r = await api.get('/admin/upgrade-requests');
    setRequests(r.data.data ?? []);
  };

  useEffect(() => {
    load()
      .catch((e) => {
        if (e.response?.status === 403) setDenied(true);
        else setMsg(e.response?.data?.error?.message ?? 'Load failed');
      })
      .finally(() => setLoading(false));
  }, []);

  const approve = async (orgId: string, plan: string) => {
    setMsg('');
    try {
      await api.post(`/admin/organizations/${orgId}/subscription`, { plan });
      toast('success', `Approved — plan set to ${plan}`);
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Approve failed');
    }
  };

  const decline = async (orgId: string) => {
    setMsg('');
    try {
      await api.post(`/admin/upgrade-requests/${orgId}/decline`);
      toast('success', 'Request declined');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Decline failed');
    }
  };

  if (denied) return <AccessDenied />;

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Upgrade requests" sub="Approve or decline manual plan changes" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <Section title={requests.length > 0 ? `Pending (${requests.length})` : 'Pending'}>
        {loading ? (
          <Spinner label="Loading requests…" />
        ) : requests.length === 0 ? (
          <EmptyState title="No pending upgrade requests" />
        ) : (
          <Table head={['Organization', 'Requested', '']}>
            {requests.map((r: any) => (
              <tr key={r.organization_id}>
                <td className="px-3 py-2 first:pl-0">
                  <Link
                    to={`/organizations/${r.organization_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.organization_name ?? r.organization_id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-gray-400">
                    now {r.plan ?? '—'}
                    {r.request?.note ? ` · “${r.request.note}”` : ''}
                  </p>
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge tone="amber">{r.request?.plan}</Badge>
                </td>
                <td className="px-3 py-2 text-right last:pr-0">
                  <span className="inline-flex gap-1">
                    <Button
                      size="compact"
                      onClick={() => approve(r.organization_id, r.request.plan)}
                    >
                      Approve
                    </Button>
                    <Button size="compact" variant="ghost" onClick={() => decline(r.organization_id)}>
                      Decline
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
