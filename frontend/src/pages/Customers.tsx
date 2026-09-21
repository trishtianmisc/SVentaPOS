import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  credit_limit?: number | null;
  balance: number;
}

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [limit, setLimit] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [payAmt, setPayAmt] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/customers');
    setItems(res.data.data);
  };
  useEffect(() => {
    load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
  }, []);

  const create = async () => {
    setMsg('');
    try {
      await api.post('/customers', {
        name,
        phone: phone || undefined,
        credit_limit: limit ? Number(limit) : undefined,
      });
      setName('');
      setPhone('');
      setLimit('');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  const open = async (id: string) => {
    const [d, l] = await Promise.all([
      api.get(`/customers/${id}`),
      api.get(`/customers/${id}/ledger`),
    ]);
    setDetail(d.data.data);
    setLedger(l.data.data);
    setPayAmt('');
  };

  const pay = async () => {
    if (!detail) return;
    setMsg('');
    try {
      await api.post(`/customers/${detail.id}/payment`, {
        amount: Number(payAmt),
        method: 'cash',
      });
      await open(detail.id);
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Payment failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Customers & Utang</h1>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr_1fr]">
        <section className="h-fit rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Add customer</h2>
          <div className="mt-2 grid gap-2">
            <input className="rounded-lg border p-2" placeholder="Name"
              value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border p-2" placeholder="Phone (optional)"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="rounded-lg border p-2" placeholder="Credit limit (optional)"
              value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" />
            <button className="rounded-lg bg-teal-700 p-2 text-white" onClick={create}>
              Add
            </button>
          </div>
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Balances</h2>
          <ul className="mt-2 divide-y">
            {items.map((c) => (
              <li key={c.id}>
                <button className="flex w-full justify-between py-2 text-left" onClick={() => open(c.id)}>
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.credit_limit != null && (
                      <span className="ml-2 text-xs text-gray-400">limit {formatPHP(c.credit_limit)}</span>
                    )}
                  </span>
                  <span className={c.balance > 0 ? 'font-bold text-amber-700' : ''}>
                    {formatPHP(c.balance)}
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="py-2 text-sm text-gray-400">No customers yet.</li>}
          </ul>
        </section>
        <section className="h-fit rounded-xl border bg-white p-4">
          {detail ? (
            <>
              <p className="font-bold">{detail.name}</p>
              <p className="text-sm">Outstanding: <span className="font-bold">{formatPHP(detail.balance)}</span></p>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-lg border p-2" placeholder="Payment amount"
                  value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" />
                <button className="rounded-lg bg-teal-700 px-3 text-white" onClick={pay}>
                  Record
                </button>
              </div>
              <ul className="mt-3 divide-y text-sm">
                {ledger.map((e: any) => (
                  <li key={e.id} className="flex justify-between py-1">
                    <span>{e.transaction_type}</span>
                    <span>{formatPHP(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a customer for ledger + payments.</p>
          )}
        </section>
      </div>
    </div>
  );
}
