import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import {
  EmptyState,
  Field,
  PageHeader,
  Section,
  Spinner,
  Table,
  TextInput,
} from '../components/ui';

const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'] as const;
const RANGED = new Set(['sales', 'products', 'profit', 'expenses']);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('sales');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(
    async (t: (typeof TABS)[number], f = from, e = to) => {
      setTab(t);
      setMsg('');
      setData(null);
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (RANGED.has(t)) {
          if (f) params.from = f;
          if (e) params.to = e;
        }
        const res = await api.get(`/reports/${t}`, { params });
        setData(res.data.data);
      } catch (err: any) {
        setMsg(err.response?.data?.error?.message ?? 'Load failed');
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    load('sales', '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Reports" sub="Sales, stock, profit, and balances" />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => load(t)}
            aria-pressed={tab === t}
            className={`h-9 rounded-full px-3 text-[13px] capitalize ${tab === t ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-600'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {RANGED.has(tab) && (
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <Field label="From">
            <TextInput
              type="date"
              max={todayISO()}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                load(tab, e.target.value, to);
              }}
            />
          </Field>
          <Field label="To">
            <TextInput
              type="date"
              max={todayISO()}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                load(tab, from, e.target.value);
              }}
            />
          </Field>
        </div>
      )}
      {msg && <p className="mt-3 text-[13px] text-red-600">{msg}</p>}
      <Section title={tab.charAt(0).toUpperCase() + tab.slice(1)}>
        {loading ? (
          <Spinner label="Loading report…" />
        ) : !data ? (
          <EmptyState title="No data" hint="Try a wider date range." />
        ) : null}
        {tab === 'sales' && data && (
          <>
            <p className="text-2xl font-bold">{formatPHP(data.total)}</p>
            <p className="text-sm text-gray-500">{data.count} sales · avg {formatPHP(data.average)}</p>
            {data.by_method?.map((m: any) => (
              <p key={m.method} className="flex justify-between py-1 text-sm">
                <span className="capitalize">{m.method}</span>
                <span>{formatPHP(m.total)}</span>
              </p>
            ))}
          </>
        )}
        {tab === 'products' && data && (
          <Table head={['Product', 'Qty', 'Revenue']}>
            {(Array.isArray(data) ? data : []).slice(0, 20).map((r: any) => (
              <tr key={r.product_id}>
                <td className="px-3 py-2 first:pl-0">{r.product_name}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2 text-right last:pr-0">{formatPHP(r.revenue)}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'inventory' && data && (
          <p className="text-sm">Lines: {data.lines} · Value: {formatPHP(data.stock_value)} · Low: {data.low_stock}</p>
        )}
        {tab === 'profit' && data && (
          <>
            <p className="text-sm">Revenue: {formatPHP(data.revenue)}</p>
            <p className="text-sm">COGS: {formatPHP(data.cogs)}</p>
            <p className="text-lg font-bold">Gross profit: {formatPHP(data.gross_profit)}</p>
          </>
        )}
        {tab === 'expenses' && data && (
          <>
            <p className="text-lg font-bold">{formatPHP(data.total)}</p>
            {data.by_category?.map((c: any) => (
              <p key={c.category} className="flex justify-between py-1 text-sm">
                <span>{c.category}</span>
                <span>{formatPHP(c.total)}</span>
              </p>
            ))}
          </>
        )}
        {tab === 'utang' && data && (
          <>
            <p className="text-lg font-semibold">{formatPHP(data.total_outstanding)} outstanding</p>
            <Table head={['Customer', 'Balance']}>
              {data.customers?.map((c: any) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 first:pl-0">{c.name}</td>
                  <td className="px-3 py-2 text-right last:pr-0">{formatPHP(c.balance)}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Section>
    </div>
  );
}
