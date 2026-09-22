import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  ListFooter,
  PageHeader,
  Section,
  Select,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';
import { useProducts } from '../hooks/useCatalog';

const TONE: Record<string, 'gray' | 'amber' | 'green' | 'red'> = {
  DRAFT: 'gray',
  IN_TRANSIT: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
};

export default function TransfersPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');
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
  }, []);

  const storeName = (id: string) =>
    stores.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

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
      <PageHeader title="Stock Transfers" sub="Move stock between your stores" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      {loading ? (
        <Spinner label="Loading transfers…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
          <div className="grid content-start gap-4">
            <Section title="New transfer">
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
                <div className="grid grid-cols-[1fr_64px_auto] items-end gap-2">
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
                  <ul className="divide-y text-sm">
                    {lines.map((l) => (
                      <li key={l.product_id} className="flex justify-between py-1">
                        <span>{productName(l.product_id)}</span>
                        <span>
                          {l.quantity}{' '}
                          <button
                            className="ml-2 text-xs text-red-600"
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
                <Button disabled={!from || !to || lines.length === 0} onClick={submit}>
                  Draft transfer
                </Button>
                {stores.length < 2 && (
                  <p className="text-[13px] text-gray-500">
                    You need at least two stores to transfer stock.
                  </p>
                )}
              </div>
            </Section>
          </div>

          <Section
            title="Transfers"
            action={
              <span className="text-[13px] text-gray-500">
                {transfers.length} transfer{transfers.length === 1 ? '' : 's'}
              </span>
            }
          >
            {transfers.length === 0 ? (
              <EmptyState
                title="No transfers yet"
                hint="Draft one to move stock between stores."
              />
            ) : (
              <>
                <Table head={['Ref', 'Route', 'Status']}>
                  {transfers.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => open(t.id)}
                    >
                      <td className="px-3 py-2 first:pl-0">{t.reference_no}</td>
                      <td className="px-3 py-2 text-sm">
                        {storeName(t.from_store_id)} → {storeName(t.to_store_id)}
                      </td>
                      <td className="px-3 py-2 text-right last:pr-0">
                        <Badge tone={TONE[t.status] ?? 'gray'}>{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
                <ListFooter count={transfers.length} noun="transfer" />
              </>
            )}
          </Section>

          <Section title="Detail">
            {!detail ? (
              <EmptyState title="Nothing selected" hint="Open a transfer to act on it." />
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{detail.reference_no}</p>
                  <Badge tone={TONE[detail.status] ?? 'gray'}>{detail.status}</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {storeName(detail.from_store_id)} → {storeName(detail.to_store_id)}
                </p>
                <Table head={['Product', 'Qty']}>
                  {(detail.items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 first:pl-0">{productName(i.product_id)}</td>
                      <td className="px-3 py-2 text-right last:pr-0">{i.quantity}</td>
                    </tr>
                  ))}
                </Table>
                <div className="flex flex-wrap gap-2">
                  {detail.status === 'DRAFT' && (
                    <>
                      <Button onClick={() => act(detail.id, 'dispatch')}>
                        Dispatch
                      </Button>
                      <Button variant="secondary" onClick={() => act(detail.id, 'cancel')}>
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
                  <p className="text-[13px] text-gray-500">
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
    </div>
  );
}
