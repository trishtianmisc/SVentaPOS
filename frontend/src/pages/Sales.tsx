import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  ListFooter,
  Modal,
  PageHeader,
  SearchInput,
  Section,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';

interface Sale {
  id: string;
  receipt_number: string;
  total: number;
  status: string;
  created_at?: string;
}

const FILTERS = ['All', 'Completed', 'Voided'] as const;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    api
      .get('/sales')
      .then((r) => setSales(r.data.data))
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
  }, []);

  const open = async (id: string) => {
    setMsg('');
    try {
      const res = await api.get(`/sales/${id}`);
      setDetail(res.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open sale');
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter(
      (s) =>
        (filter === 'All' || s.status === filter.toUpperCase()) &&
        (!q || s.receipt_number.toLowerCase().includes(q)),
    );
  }, [sales, search, filter]);

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
      const list = await api.get('/sales');
      setSales(list.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Void failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Sales history"
        sub="Receipts, payments, and voids"
        actions={
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`h-9 rounded-full px-3 text-[13px] ${
                  filter === f ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Receipts"
          action={
            <div className="w-56">
              <SearchInput
                label="Search receipts"
                placeholder="Search receipt no."
                value={search}
                onChange={setSearch}
              />
            </div>
          }
        >
          {loading ? (
            <Spinner label="Loading sales…" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={search || filter !== 'All' ? 'No sales match' : 'No sales yet'}
              hint={search || filter !== 'All' ? 'Clear search or filters.' : 'Completed sales appear here.'}
            />
          ) : (
            <>
              <Table head={['Receipt', 'Total', 'Status']}>
                {visible.map((s) => (
                  <tr key={s.id} className={detail?.id === s.id ? 'bg-primary-soft/50' : ''}>
                    <td className="px-3 py-2 first:pl-0">
                      <button className="font-medium text-primary" onClick={() => open(s.id)}>
                        {s.receipt_number}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">{formatPHP(s.total)}</td>
                    <td className="px-3 py-2 text-right last:pr-0">
                      <Badge tone={s.status === 'COMPLETED' ? 'green' : 'gray'}>{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </Table>
              <ListFooter count={visible.length} noun="receipt" />
            </>
          )}
        </Section>
        <Section
          title={detail ? `Receipt ${detail.receipt_number}` : 'Receipt detail'}
          action={
            detail?.status === 'COMPLETED' ? (
              <Button size="compact" variant="danger" onClick={() => setVoiding(true)}>
                Void sale
              </Button>
            ) : undefined
          }
        >
          {detail ? (
            <>
              <Table head={['Item', 'Qty', 'Total']}>
                {(detail.items ?? []).map((i: any) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 first:pl-0">{i.product_name_snapshot}</td>
                    <td className="px-3 py-2 text-right">{i.quantity}</td>
                    <td className="px-3 py-2 text-right last:pr-0">{formatPHP(i.line_total)}</td>
                  </tr>
                ))}
              </Table>
              <p className="mt-3 flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold">{formatPHP(detail.total)}</span>
              </p>
              {(detail.payments ?? []).map((p: any) => (
                <p key={p.id} className="flex justify-between text-[13px] text-gray-500">
                  <span className="capitalize">{p.payment_method}</span>
                  <span>{formatPHP(p.amount)}</span>
                </p>
              ))}
              {detail.status === 'VOIDED' && (
                <p className="mt-2 text-[13px] text-gray-500">
                  Voided{detail.void_reason ? `: ${detail.void_reason}` : ''}
                </p>
              )}
            </>
          ) : (
            <EmptyState title="No receipt selected" hint="Pick a receipt on the left." />
          )}
        </Section>
      </div>

      {voiding && (
        <Modal title="Void this sale?" onClose={() => setVoiding(false)}>
          <p className="text-sm text-gray-600">
            The sale stays in history as voided and its stock is restored. This cannot be undone.
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
              <Button variant="danger" disabled={!voidReason.trim()} onClick={submitVoid}>
                Void sale
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
