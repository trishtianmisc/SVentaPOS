import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import {
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

const METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other'];

export default function ExpensesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<any[]>([]);
  const [catId, setCatId] = useState('');
  const [newCat, setNewCat] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
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
    load()
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = async () => {
    setMsg('');
    try {
      await api.post('/expenses/categories');
      toast('success', 'Default categories ready');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Seed failed');
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setMsg('');
    try {
      const res = await api.post('/expenses/categories/new', { name: newCat.trim() });
      setNewCat('');
      toast('success', 'Category added');
      await load();
      setCatId(res.data.data.id);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Category create failed');
    }
  };

  const create = async () => {
    setMsg('');
    try {
      await api.post('/expenses', {
        category_id: catId,
        amount: Number(amount),
        payment_method: method,
        notes: notes || undefined,
      });
      setAmount('');
      setNotes('');
      toast('success', 'Expense recorded');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Expenses" sub="Track store costs by category" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-4">
          <Section title="Record expense">
            {cats.length === 0 ? (
              <Button className="w-full" onClick={seed}>
                Load default categories
              </Button>
            ) : (
              <div className="grid gap-3">
                <Field label="Category">
                  <Select value={catId} onChange={(e) => setCatId(e.target.value)}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount (₱)">
                  <TextInput
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Paid with">
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((m) => (
                      <option key={m} value={m} className="capitalize">
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notes" hint="Optional.">
                  <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <Button disabled={!catId || !amount} onClick={create}>
                  Add expense
                </Button>
              </div>
            )}
          </Section>
          {cats.length > 0 && (
            <Section title="New category">
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    aria-label="New category name"
                    placeholder="e.g. Packaging"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                  />
                </div>
                <Button variant="secondary" disabled={!newCat.trim()} onClick={addCategory}>
                  Add
                </Button>
              </div>
            </Section>
          )}
        </div>
        <Section title="Recent expenses">
          {loading ? (
            <Spinner label="Loading expenses…" />
          ) : items.length === 0 ? (
            <EmptyState title="No expenses yet" hint="Record your first cost on the left." />
          ) : (
            <>
              <Table head={['Category', 'Date', 'Method', 'Amount']}>
                {items.map((x) => (
                  <tr key={x.id}>
                    <td className="px-3 py-2 first:pl-0">
                      {x.category_name ?? ''}
                      {x.notes && (
                        <p className="text-xs text-gray-400">{x.notes}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{x.expense_date}</td>
                    <td className="px-3 py-2 text-right capitalize text-gray-500">
                      {x.payment_method}
                    </td>
                    <td className="px-3 py-2 text-right font-medium last:pr-0">
                      {formatPHP(x.amount)}
                    </td>
                  </tr>
                ))}
              </Table>
              <ListFooter count={items.length} noun="expense" />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
