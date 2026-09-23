import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import {
  Badge,
  Button,
  Field,
  ListFooter,
  Modal,
  Section,
  Select,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';
import { KpiCard } from '../components/KpiCard';
import { useProducts } from '../hooks/useCatalog';
import { useSessionStore } from '../stores/session';

const TONE: Record<string, 'gray' | 'amber' | 'green' | 'red'> = {
  DRAFT: 'gray',
  IN_TRANSIT: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
};

type ShowFilter = 'all' | 'incoming' | 'outgoing';

export default function TransfersPage() {
  const storeId = useSessionStore((s) => s.storeId);
  const [stores, setStores] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  // New draft.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [product, setProduct] = useState('');
  const [qty, setQty] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const { data: products = [] } = useProducts();

  const load = async () => {
    const [s, t] = await Promise.all([api.get('/stores'), api.get('/transfers')]);
    setStores(s.data.data ?? []);
    setTransfers(t.data.data ?? []);
  };
  useEffect(() => {
    load()
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stores.length >= 2 && !from) {
      const preferred = storeId || stores[0]?.id;
      if (preferred) setFrom(preferred);
      const other = stores.find((s) => s.id !== preferred);
      if (other) setTo(other.id);
    }
  }, [stores, storeId, from]);

  const storeName = (id: string) =>
    stores.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const pending = transfers.filter((t) => t.status === 'DRAFT').length;
  const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const completed = transfers.filter((t) => t.status === 'RECEIVED').length;
  const unitsMoved = useMemo(() => {
    return transfers
      .filter((t) => t.status === 'RECEIVED')
      .reduce(
        (sum, t) =>
          sum +
          (t.items ?? []).reduce((n: number, i: any) => n + (Number(i.quantity) || 0), 0),
        0,
      );
  }, [transfers]);

  const filtered = transfers.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (showFilter === 'incoming' && t.to_store_id !== storeId) return false;
    if (showFilter === 'outgoing' && t.from_store_id !== storeId) return false;
    return true;
  });

  const addLine = () => {
    if (!product || !qty || Number(qty) <= 0) return;
    if (lines.some((l) => l.product_id === product)) {
      setMsg('Product already in this transfer');
      return;
    }
    setLines([...lines, { product_id: product, quantity: Number(qty) }]);
    setProduct('');
    setQty('');
    setMsg('');
  };

  const resetDraft = () => {
    setLines([]);
    setProduct('');
    setQty('');
    setMsg('');
    if (stores.length >= 2) {
      const preferred = storeId || stores[0]?.id;
      setFrom(preferred);
      setTo(stores.find((s) => s.id !== preferred)?.id ?? '');
    } else {
      setFrom('');
      setTo('');
    }
  };

  const openNew = () => {
    resetDraft();
    setShowNew(true);
  };

  const submit = async () => {
    if (!from || !to || lines.length === 0) return;
    setMsg('');
    try {
      const res = await api.post('/transfers', {
        from_store_id: from,
        to_store_id: to,
        items: lines,
      });
      setLines([]);
      toast('success', `Transfer ${res.data.data.reference_no} drafted`);
      setShowNew(false);
      await load();
      setDetail(res.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  const open = async (id: string) => {
    setMsg('');
    try {
      const res = await api.get(`/transfers/${id}`);
      setDetail(res.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open transfer');
    }
  };

  const act = async (id: string, action: 'dispatch' | 'receive' | 'cancel') => {
    setMsg('');
    try {
      const res = await api.post(`/transfers/${id}/${action}`);
      setDetail(res.data.data);
      toast(
        'success',
        action === 'dispatch'
          ? 'Transfer dispatched'
          : action === 'receive'
            ? 'Transfer received'
            : 'Transfer cancelled',
      );
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Action failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#e8c86a]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" />
              <path d="M7 7h4v4M17 17h-4v-4" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Transfers
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-[#9b958c]">
              Move stock between branches.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={stores.length < 2}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden>＋</span> New Transfer
        </button>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="amber"
          label="Pending"
          value={String(pending)}
          hint="Awaiting approval"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        />
        <KpiCard
          tone="blue"
          label="In transit"
          value={String(inTransit)}
          hint="On the way"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          }
        />
        <KpiCard
          tone="green"
          label="Completed"
          value={String(completed)}
          hint="All time"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 3 3 5-6" />
            </svg>
          }
        />
        <KpiCard
          tone="teal"
          label="Units moved"
          value={String(unitsMoved)}
          hint="All time"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 8 12 3 3 8l9 5 9-5Z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
          }
        />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6f6a62]">
            Show:
          </span>
          <div className="inline-flex h-10 items-center rounded-full bg-gray-100 p-1 dark:bg-[#1a1a1e]">
            {(
              [
                ['all', 'All'],
                ['incoming', 'Incoming'],
                ['outgoing', 'Outgoing'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={showFilter === v}
                onClick={() => setShowFilter(v)}
                className={`h-8 rounded-full px-4 text-sm font-semibold ${
                  showFilter === v
                    ? 'bg-primary text-white shadow'
                    : 'text-gray-600 dark:text-[#9b958c]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6f6a62]">
            Status:
          </span>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-40"
            aria-label="Status filter"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_TRANSIT">In transit</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {msg && (
        <p className="mb-4 text-[13px] text-red-600 dark:text-[#f0a090]">{msg}</p>
      )}

      {loading ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-[#1e1e22] dark:bg-[#121214]">
          <Spinner label="Loading transfers…" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          {/* List */}
          <Section>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-[#2a2a2e]">
                <span
                  aria-hidden
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#e8c86a]"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" />
                    <path d="M7 7h4v4M17 17h-4v-4" />
                  </svg>
                </span>
                <p className="text-[15px] text-gray-700 dark:text-[#c9c3b8]">
                  {transfers.length === 0
                    ? 'Create your first transfer to move stock between branches.'
                    : 'No transfers match these filters.'}
                </p>
                {transfers.length === 0 && (
                  <button
                    type="button"
                    onClick={openNew}
                    disabled={stores.length < 2}
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-45"
                  >
                    <span aria-hidden>＋</span> New Transfer
                  </button>
                )}
                {stores.length < 2 && (
                  <p className="mt-3 text-[13px] text-gray-500 dark:text-[#6f6a62]">
                    You need at least two stores to transfer stock.
                  </p>
                )}
              </div>
            ) : (
              <>
                <Table head={['Ref', 'Route', 'Status']}>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0e0e10]"
                      onClick={() => open(t.id)}
                    >
                      <td className="px-3 py-2.5 first:pl-0">{t.reference_no}</td>
                      <td className="px-3 py-2.5 text-sm">
                        {storeName(t.from_store_id)} → {storeName(t.to_store_id)}
                      </td>
                      <td className="px-3 py-2.5 text-right last:pr-0">
                        <Badge tone={TONE[t.status] ?? 'gray'}>{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
                <ListFooter count={filtered.length} noun="transfer" />
              </>
            )}
          </Section>

          {/* Detail */}
          <Section title="Detail">
            {!detail ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-[#c9c3b8]">
                  Nothing selected
                </p>
                <p className="mt-1 text-[13px] text-gray-400 dark:text-[#6f6a62]">
                  Open a transfer to act on it.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold dark:text-white">
                    {detail.reference_no}
                  </p>
                  <Badge tone={TONE[detail.status] ?? 'gray'}>{detail.status}</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-[#9b958c]">
                  {storeName(detail.from_store_id)} → {storeName(detail.to_store_id)}
                </p>
                <Table head={['Product', 'Qty']}>
                  {(detail.items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 first:pl-0">
                        {productName(i.product_id)}
                      </td>
                      <td className="px-3 py-2 text-right last:pr-0">
                        {i.quantity}
                      </td>
                    </tr>
                  ))}
                </Table>
                <div className="flex flex-wrap gap-2">
                  {detail.status === 'DRAFT' && (
                    <>
                      <Button onClick={() => act(detail.id, 'dispatch')}>
                        Dispatch
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => act(detail.id, 'cancel')}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {detail.status === 'IN_TRANSIT' && (
                    <Button onClick={() => act(detail.id, 'receive')}>
                      Confirm receipt
                    </Button>
                  )}
                </div>
                {detail.status === 'IN_TRANSIT' && (
                  <p className="text-[13px] text-gray-500 dark:text-[#6f6a62]">
                    Stock has left {storeName(detail.from_store_id)} and is in transit —
                    it cannot be sold until {storeName(detail.to_store_id)} confirms
                    receipt.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* New transfer modal */}
      {showNew && (
        <Modal title="New Transfer" onClose={() => setShowNew(false)} wide>
          <div className="grid gap-3">
            <Field label="From store">
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Select source…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To store">
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Select destination…</option>
                {stores
                  .filter((s) => s.id !== from)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_72px_auto] items-end gap-2">
              <Field label="Product">
                <Select value={product} onChange={(e) => setProduct(e.target.value)}>
                  <option value="">…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Qty">
                <TextInput
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                />
              </Field>
              <Button variant="secondary" onClick={addLine}>
                Add
              </Button>
            </div>
            {lines.length > 0 && (
              <ul className="divide-y divide-gray-100 text-sm dark:divide-[#1a1a1e]">
                {lines.map((l) => (
                  <li key={l.product_id} className="flex justify-between py-1.5">
                    <span>{productName(l.product_id)}</span>
                    <span>
                      {l.quantity}{' '}
                      <button
                        className="ml-2 text-xs text-red-600 dark:text-[#f0a090]"
                        onClick={() =>
                          setLines(lines.filter((x) => x.product_id !== l.product_id))
                        }
                      >
                        remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {msg && (
              <p className="text-[13px] text-red-600 dark:text-[#f0a090]">{msg}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={!from || !to || lines.length === 0}
                onClick={submit}
              >
                Draft transfer
              </Button>
              <Button variant="secondary" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </div>
            {stores.length < 2 && (
              <p className="text-[13px] text-gray-500 dark:text-[#6f6a62]">
                You need at least two stores to transfer stock.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
