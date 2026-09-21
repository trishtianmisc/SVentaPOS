import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

interface Row {
  product_id: string;
  quantity: number;
  product_name?: string;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/inventory');
    setRows(res.data.data);
  };
  useEffect(() => {
    load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
  }, []);

  const adjust = async () => {
    setMsg('');
    try {
      await api.post('/inventory/adjust', {
        product_id: productId,
        quantity: Number(qty),
        movement_type: Number(qty) >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
        reason: reason || 'manual adjustment',
      });
      setProductId('');
      setQty('');
      setReason('');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Adjust failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Inventory</h1>
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Adjust stock</h2>
          <div className="mt-2 grid gap-2">
            <input className="rounded-lg border p-2" placeholder="Product ID" value={productId}
              onChange={(e) => setProductId(e.target.value)} />
            <input className="rounded-lg border p-2" placeholder="+/- qty" value={qty}
              onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
            <input className="rounded-lg border p-2" placeholder="Reason (required)" value={reason}
              onChange={(e) => setReason(e.target.value)} />
            <button className="rounded-lg bg-teal-700 p-2 text-white" onClick={adjust}>Adjust stock</button>
          </div>
          {msg && <p className="mt-2 text-sm">{msg}</p>}
        </section>
        <section className="rounded-xl border bg-white p-4">
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.product_id} className="flex justify-between py-2">
                <span>{r.product_name ?? r.product_id}</span>
                <span>{r.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
