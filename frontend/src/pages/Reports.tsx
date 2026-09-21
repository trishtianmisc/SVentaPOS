import { useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';

const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'] as const;

export default function ReportsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('sales');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = async (t: (typeof TABS)[number]) => {
    setTab(t);
    setMsg('');
    setData(null);
    try {
      const res = await api.get(`/reports/${t}`);
      setData(res.data.data);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Load failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-semibold md:text-2xl">Reports</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => load(t)}
            className={`rounded-full px-3 py-1 text-xs capitalize ${tab === t ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      <section className="mt-4 rounded-xl border bg-white p-4">
        {!data && <p className="text-sm text-gray-400">Pick a report above.</p>}
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
          <ul className="divide-y text-sm">
            {(Array.isArray(data) ? data : []).slice(0, 20).map((r: any) => (
              <li key={r.product_id} className="flex justify-between py-1">
                <span>{r.product_name} × {r.quantity}</span>
                <span>{formatPHP(r.revenue)}</span>
              </li>
            ))}
          </ul>
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
            <p className="text-lg font-bold">{formatPHP(data.total_outstanding)} outstanding</p>
            <ul className="mt-2 divide-y text-sm">
              {data.customers?.map((c: any) => (
                <li key={c.id} className="flex justify-between py-1">
                  <span>{c.name}</span>
                  <span>{formatPHP(c.balance)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
