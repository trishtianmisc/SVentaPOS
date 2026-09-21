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
  Select,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  credit_limit?: number | null;
  balance: number;
}

const PAY_METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other'];

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [limit, setLimit] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editLimit, setEditLimit] = useState('');

  const load = async (q = '') => {
    const res = await api.get('/customers', { params: q ? { search: q } : {} });
    setItems(res.data.data);
  };

  useEffect(() => {
    load()
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load(search).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

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
      toast('success', 'Customer added');
      await load(search);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Create failed');
    }
  };

  const open = async (id: string) => {
    setMsg('');
    try {
      const [d, l] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/ledger`),
      ]);
      setDetail(d.data.data);
      setLedger(l.data.data);
      setPayAmt('');
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not open customer');
    }
  };

  const pay = async () => {
    if (!detail) return;
    setMsg('');
    try {
      await api.post(`/customers/${detail.id}/payment`, {
        amount: Number(payAmt),
        method: payMethod,
      });
      toast('success', 'Payment recorded');
      await open(detail.id);
      await load(search);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Payment failed');
    }
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setEditPhone(c.phone ?? '');
    setEditLimit(c.credit_limit != null ? String(c.credit_limit) : '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setMsg('');
    try {
      await api.put(`/customers/${editing.id}`, {
        phone: editPhone || undefined,
        credit_limit: editLimit === '' ? null : Number(editLimit),
      });
      setEditing(null);
      toast('success', 'Customer updated');
      await open(editing.id);
      await load(search);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Update failed');
    }
  };

  const visible = useMemo(() => items, [items]);

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Customers & Utang" sub="Balances, ledger, and payments" />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <div className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
        <Section title="Add customer">
          <div className="grid gap-3">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone" hint="Optional.">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Credit limit (₱)" hint="Optional. Empty means no limit.">
              <TextInput
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Button disabled={!name.trim()} onClick={create}>
              Add customer
            </Button>
          </div>
        </Section>
        <Section
          title="Balances"
          action={
            <div className="w-48">
              <SearchInput
                label="Search customers"
                placeholder="Search name"
                value={search}
                onChange={setSearch}
              />
            </div>
          }
        >
          {loading ? (
            <Spinner label="Loading customers…" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={search ? 'No customers match' : 'No customers yet'}
              hint={search ? 'Try a different search.' : 'Add your first customer on the left.'}
            />
          ) : (
            <>
              <Table head={['Customer', 'Balance', '']}>
                {visible.map((c) => (
                  <tr key={c.id} className={detail?.id === c.id ? 'bg-primary-soft/50' : ''}>
                    <td className="px-3 py-2 first:pl-0">
                      <button className="text-left font-medium text-primary" onClick={() => open(c.id)}>
                        {c.name}
                      </button>
                      <p className="text-xs text-gray-400">
                        {c.phone ?? 'No phone'}
                        {c.credit_limit != null && ` · limit ${formatPHP(c.credit_limit)}`}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.balance > 0 ? (
                        <Badge tone="amber">{formatPHP(c.balance)}</Badge>
                      ) : (
                        <span className="text-gray-400">{formatPHP(0)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right last:pr-0">
                      <Button size="compact" variant="secondary" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
              <ListFooter count={visible.length} noun="customer" />
            </>
          )}
        </Section>
        <Section title={detail ? detail.name : 'Ledger'}>
          {detail ? (
            <>
              <p className="text-sm">
                Outstanding: <span className="font-semibold">{formatPHP(detail.balance)}</span>
              </p>
              <div className="mt-3 grid gap-3">
                <Field label="Payment amount (₱)">
                  <TextInput
                    value={payAmt}
                    onChange={(e) => setPayAmt(e.target.value)}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Method">
                  <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAY_METHODS.map((m) => (
                      <option key={m} value={m} className="capitalize">
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button disabled={!payAmt || Number(payAmt) <= 0} onClick={pay}>
                  Record payment
                </Button>
              </div>
              <Table head={['Type', 'Amount']}>
                {ledger.map((e: any) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 first:pl-0 text-[13px]">{e.transaction_type}</td>
                    <td
                      className={`px-3 py-2 text-right last:pr-0 ${
                        Number(e.amount) < 0 ? 'text-green-700' : ''
                      }`}
                    >
                      {formatPHP(e.amount)}
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          ) : (
            <EmptyState title="No customer selected" hint="Pick a customer for ledger and payments." />
          )}
        </Section>
      </div>

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="grid gap-3">
            <Field label="Phone">
              <TextInput value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </Field>
            <Field label="Credit limit (₱)" hint="Leave as-is to keep the current limit.">
              <TextInput
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Button onClick={saveEdit}>Save changes</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
