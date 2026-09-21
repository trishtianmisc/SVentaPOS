import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Badge, Button, PageHeader, Section, Select, Table } from '../components/ui';

export default function AdminPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [denied, setDenied] = useState(false);

  const load = async () => {
    const [o, p] = await Promise.all([
      api.get('/admin/organizations'),
      api.get('/subscriptions/plans'),
    ]);
    setOrgs(o.data.data);
    setPlans(p.data.data);
  };

  useEffect(() => {
    load().catch((e) => {
      if (e.response?.status === 403) setDenied(true);
      else setMsg(e.response?.data?.error?.message ?? 'Load failed');
    });
  }, []);

  const setPlan = async (orgId: string) => {
    const plan = sel[orgId];
    if (!plan) return;
    setMsg('');
    try {
      await api.post(`/admin/organizations/${orgId}/subscription`, { plan });
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Update failed');
    }
  };

  if (denied) {
    return (
      <div className="w-full p-4 md:p-6">
        <PageHeader title="Admin" sub="Platform administration" />
        <p className="text-sm text-gray-500">
          Platform administrators only. Your account is not allowlisted.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Admin" sub="Organizations, plans, and usage" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <Section title="Organizations">
        <Table head={['Organization', 'Plan', 'Usage', '']}>
          {orgs.map((o: any) => (
            <tr key={o.organization.id}>
              <td className="px-3 py-2 first:pl-0">{o.organization.name}</td>
              <td className="px-3 py-2 text-right">
                <Badge tone={o.status === 'active' ? 'green' : 'amber'}>
                  {o.plan ?? '—'} · {o.status ?? ''}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right text-xs text-gray-500">
                {o.usage
                  ? `${o.usage.stores ?? '?'} st · ${o.usage.products ?? '?'} pr · ${o.usage.users ?? '?'} users`
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right last:pr-0">
                <span className="inline-flex gap-2">
                  <Select
                    aria-label="Plan"
                    className="h-9"
                    value={sel[o.organization.id] ?? ''}
                    onChange={(e) =>
                      setSel({ ...sel, [o.organization.id]: e.target.value })
                    }
                  >
                    <option value="">Set plan…</option>
                    {plans.map((p: any) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="compact"
                    disabled={!sel[o.organization.id]}
                    onClick={() => setPlan(o.organization.id)}
                  >
                    Apply
                  </Button>
                </span>
              </td>
            </tr>
          ))}
        </Table>
        {orgs.length === 0 && (
          <p className="py-2 text-sm text-gray-400">No organizations found.</p>
        )}
      </Section>
    </div>
  );
}
