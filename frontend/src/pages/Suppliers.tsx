import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');
  // New PO draft.
  const [poSupplier, setPoSupplier] = useState('');
  const [poProduct, setPoProduct] = useState('');
  const [poQty, setPoQty] = useState('');
  const [poCost, setPoCost] = useState('');
  const [poLines, setPoLines] = useState<any[]>([]);
  const { data: products = [] } = useProducts();

  const load = async () => {
    const [s, p] = await Promise.all([api.get('/suppliers'), api.get('/purchase-orders')]);
    setSuppliers(s.data.data);
    setPos(p.data.data);
  };
  useEffect(() => {
    load()
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    setMsg('');
    try {
      await api.post('/suppliers', { name });
      setName('');
      toast('success', 'Supplier added');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  const open = async (id: string) => {
    setMsg('');
    try {
      const res = await api.get(`/purchase-orders/${id}`);
      setDetail(res.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open PO');
    }
  };

  const act = async (id: string, action: 'approve' | 'cancel') => {
    setMsg('');
    try {
      await api.post(`/purchase-orders/${id}/${action}`);
      toast('success', action === 'approve' ? 'PO ordered' : 'PO cancelled');
      await load();
      await open(id);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Action failed');
    }
  };

  const addLine = () => {
    if (!poProduct || !poQty || Number(poQty) <= 0) return;
    const p = products.find((x) => x.id === poProduct);
    setPoLines([
      ...poLines,
      {
        product_id: poProduct,
        name: p?.name ?? poProduct,
        quantity: Number(poQty),
        unit_cost: Number(poCost || 0),
      },
    ]);
    setPoProduct('');
    setPoQty('');
    setPoCost('');
  };

  const submitPO = async () => {
    if (!poSupplier || poLines.length === 0) return;
    setMsg('');
    try {
      await api.post('/purchase-orders', {
        supplier_id: poSupplier,
        items: poLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        })),
      });
      setPoLines([]);
      setPoSupplier('');
      toast('success', 'Purchase order created as draft');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'PO create failed');
    }
  };

  const receiveAll = async () => {
    if (!detail) return;
    setMsg('');
    try {
      await api.post(`/purchase-orders/${detail.id}/receive`, {
        lines: detail.items
          .filter((i: any) => i.received_qty < i.quantity)
          .map((i: any) => ({ item_id: i.id, quantity: i.quantity - i.received_qty })),
      });
      toast('success', 'Stock received');
      await load();
      await open(detail.id);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Receive failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Suppliers & Purchasing" sub="Suppliers, orders, and receiving" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      {loading ? (
        <Spinner label="Loading purchasing…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
          <div className="grid content-start gap-4">
            <Section title="Suppliers">
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    aria-label="Supplier name"
                    placeholder="Supplier name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <Button disabled={!name.trim()} onClick={create}>
                  Add
                </Button>
              </div>
              <ul className="mt-2 divide-y text-sm">
                {suppliers.map((s) => (
                  <li key={s.id} className="py-2">{s.name}</li>
                ))}
                {suppliers.length === 0 && (
                  <li className="py-2 text-sm text-gray-400">No suppliers yet.</li>
                )}
              </ul>
            </Section>
            <Section title="New purchase order">
              <div className="grid gap-3">
                <Field label="Supplier">
                  <Select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}>
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-[1fr_64px_72px_auto] items-end gap-2">
                  <Field label="Product">
                    <Select value={poProduct} onChange={(e) => setPoProduct(e.target.value)}>
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
                      value={poQty}
                      onChange={(e) => setPoQty(e.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="Cost">
                    <TextInput
                      value={poCost}
                      onChange={(e) => setPoCost(e.target.value)}
                      inputMode="decimal"
                    />
                  </Field>
                  <Button variant="secondary" onClick={addLine}>
                    +
                  </Button>
                </div>
                {poLines.length > 0 && (
                  <ul className="divide-y text-[13px]">
                    {poLines.map((l, i) => (
                      <li key={i} className="flex justify-between py-1">
                        <span>
                          {l.name} × {l.quantity}
                        </span>
                        <span>{formatPHP(l.quantity * l.unit_cost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button disabled={!poSupplier || poLines.length === 0} onClick={submitPO}>
                  Create draft PO
                </Button>
              </div>
            </Section>
          </div>
          <Section
            title="Purchase orders"
            action={
              <span className="text-[13px] text-gray-500">
                {pos.length} order{pos.length === 1 ? '' : 's'}
              </span>
            }
          >
            {pos.length === 0 ? (
              <EmptyState title="No purchase orders" hint="Create a draft on the left." />
            ) : (
              <Table head={['PO', 'Status', 'Total']}>
                {pos.map((p) => (
                  <tr key={p.id} className={detail?.id === p.id ? 'bg-primary-soft/50' : ''}>
                    <td className="px-3 py-2 first:pl-0">
                      <button className="font-medium text-primary" onClick={() => open(p.id)}>
                        {p.po_number}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone={p.status === 'RECEIVED' ? 'green' : p.status === 'CANCELLED' ? 'gray' : 'amber'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right last:pr-0">{formatPHP(p.total)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
          <Section title={detail ? `${detail.po_number} · ${detail.status}` : 'Order detail'}>
            {detail ? (
              <>
                <Table head={['Line', 'Ordered', 'Got']}>
                  {detail.items?.map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 first:pl-0 text-[13px]">@ {formatPHP(i.unit_cost)}</td>
                      <td className="px-3 py-2 text-right">{i.quantity}</td>
                      <td className="px-3 py-2 text-right last:pr-0">{i.received_qty}</td>
                    </tr>
                  ))}
                </Table>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="secondary" size="compact" onClick={() => act(detail.id, 'approve')}>
                    Order
                  </Button>
                  <Button size="compact" onClick={receiveAll}>
                    Receive all
                  </Button>
                  <Button variant="secondary" size="compact" onClick={() => act(detail.id, 'cancel')}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState title="No order selected" hint="Pick an order to approve, receive, or cancel." />
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
