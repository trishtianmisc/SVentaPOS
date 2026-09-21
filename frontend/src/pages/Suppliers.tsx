import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [s, p] = await Promise.all([api.get('/suppliers'), api.get('/purchase-orders')]);
    setSuppliers(s.data.data);
    setPos(p.data.data);
  };
  useEffect(() => {
    load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
  }, []);

  const create = async () => {
    setMsg('');
    try {
      await api.post('/suppliers', { name });
      setName('');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  const open = async (id: string) => {
    const res = await api.get(`/purchase-orders/${id}`);
    setDetail(res.data.data);
  };

  const act = async (id: string, action: 'approve' | 'cancel') => {
    setMsg('');
    try {
      await api.post(`/purchase-orders/${id}/${action}`);
      await load();
      await open(id);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Action failed');
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
      await load();
      await open(detail.id);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Receive failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Suppliers & Purchasing</h1>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="h-fit rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Suppliers</h2>
          <div className="mt-2 flex gap-2">
            <input className="flex-1 rounded-lg border p-2" placeholder="Supplier name"
              value={name} onChange={(e) => setName(e.target.value)} />
            <button className="rounded-lg bg-teal-700 px-3 text-white" onClick={create}>Add</button>
          </div>
          <ul className="mt-2 divide-y text-sm">
            {suppliers.map((s) => (
              <li key={s.id} className="py-2">{s.name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            Create a PO from the Products page stock flow — select a supplier, add lines, then receive here.
          </p>
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Purchase orders</h2>
          <ul className="mt-2 divide-y text-sm">
            {pos.map((p) => (
              <li key={p.id}>
                <button className="flex w-full justify-between py-2 text-left" onClick={() => open(p.id)}>
                  <span className="font-medium">{p.po_number}</span>
                  <span>{p.status}</span>
                </button>
              </li>
            ))}
            {pos.length === 0 && <li className="py-2 text-sm text-gray-400">No purchase orders.</li>}
          </ul>
        </section>
        <section className="h-fit rounded-xl border bg-white p-4">
          {detail ? (
            <>
              <p className="font-bold">{detail.po_number} · {detail.status}</p>
              <ul className="mt-2 text-sm">
                {detail.items?.map((i: any) => (
                  <li key={i.id} className="flex justify-between py-1">
                    <span>{i.quantity} × @ {formatPHP(i.unit_cost)}</span>
                    <span>got {i.received_qty}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="rounded-lg border p-2 text-sm" onClick={() => act(detail.id, 'approve')}>
                  Order
                </button>
                <button className="rounded-lg bg-teal-700 p-2 text-sm text-white" onClick={receiveAll}>
                  Receive all
                </button>
                <button className="rounded-lg border p-2 text-sm" onClick={() => act(detail.id, 'cancel')}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a PO to approve, receive, or cancel.</p>
          )}
        </section>
      </div>
    </div>
  );
}
