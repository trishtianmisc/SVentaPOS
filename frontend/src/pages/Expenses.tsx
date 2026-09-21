import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';

export default function ExpensesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [catId, setCatId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [e, c] = await Promise.all([
      api.get('/expenses'),
      api.get('/expenses/categories'),
    ]);
    setItems(e.data.data);
    setCats(c.data.data);
    if (c.data.data.length > 0 && !catId) setCatId(c.data.data[0].id);
  };
  useEffect(() => {
    load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = async () => {
    await api.post('/expenses/categories');
    await load();
  };

  const create = async () => {
    setMsg('');
    try {
      await api.post('/expenses', {
        category_id: catId,
        amount: Number(amount),
        payment_method: 'cash',
        notes: notes || undefined,
      });
      setAmount('');
      setNotes('');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-semibold md:text-2xl">Expenses</h1>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Record expense</h2>
          {cats.length === 0 ? (
            <button className="mt-2 w-full rounded-lg bg-teal-700 p-2 text-white" onClick={seed}>
              Load default categories
            </button>
          ) : (
            <div className="mt-2 grid gap-2">
              <select className="rounded-lg border p-2" value={catId}
                onChange={(e) => setCatId(e.target.value)}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input className="rounded-lg border p-2" placeholder="Amount"
                value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              <input className="rounded-lg border p-2" placeholder="Notes (optional)"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="rounded-lg bg-teal-700 p-2 text-white" onClick={create}>
                Add
              </button>
            </div>
          )}
        </section>
        <section className="rounded-xl border bg-white p-4">
          <ul className="divide-y text-sm">
            {items.map((x) => (
              <li key={x.id} className="flex justify-between py-2">
                <span>{x.category_name ?? ''} · {x.expense_date}</span>
                <span className="font-medium">{formatPHP(x.amount)}</span>
              </li>
            ))}
            {items.length === 0 && <li className="py-2 text-sm text-gray-400">No expenses yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
