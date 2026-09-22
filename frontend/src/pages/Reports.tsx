import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

function StoreBreakdown({
  rows,
  value,
  hint,
}: {
  rows: any[];
  value: (s: any) => string;
  hint?: (s: any) => string;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-[13px] font-semibold text-gray-500">Per store</p>
      <Table head={['Store', hint ? 'Detail' : '', 'Total']}>
        {rows.map((s: any) => (
          <tr key={s.store_id}>
            <td className="px-3 py-2 first:pl-0">{s.store_name ?? s.store_id.slice(0, 8)}</td>
            <td className="px-3 py-2 text-sm text-gray-500">{hint?.(s) ?? ''}</td>
            <td className="px-3 py-2 text-right last:pr-0">{value(s)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('sales');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Consolidated = org-wide rollup across all stores (per-store API frozen).
  const [allStores, setAllStores] = useState(false);
  // All-stores rollups are a paid-plan feature (advanced_reports flag).
  // Ref (not state): load() reads it and sets render states itself.
  const advancedRef = useRef(true);
  const [locked, setLocked] = useState(false);

  const load = useCallback(
    async (t: (typeof TABS)[number], f = from, e = to, all = allStores) => {
      setTab(t);
      setMsg('');
      setData(null);
      const wantAll = all && t !== 'utang' && t !== 'products';
      if (wantAll && !advancedRef.current) {
        setLoading(false);
        setLocked(true);
        return;
      }
      setLocked(false);
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (RANGED.has(t)) {
          if (f) params.from = f;
          if (e) params.to = e;
        }
        const path = wantAll ? `/reports/consolidated/${t}` : `/reports/${t}`;
        const res = await api.get(path, { params });
        setData(res.data.data);
      } catch (err: any) {
        if (err.response?.status === 403 && wantAll) setLocked(true);
        else setMsg(err.response?.data?.error?.message ?? 'Load failed');
      } finally {
        setLoading(false);
      }
    },
    [from, to, allStores],
  );

  const toggleStores = (all: boolean) => {
    setAllStores(all);
    load(tab, from, to, all);
  };

  const downloadCSV = () => {
    if (tab !== 'products' || !Array.isArray(data)) return;
    const rows = [['Product', 'Qty', 'Revenue']];
    for (const r of data) rows.push([r.product_name, r.quantity, r.revenue]);
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `products-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    load('sales', '', '');
    api
      .get('/subscriptions/current')
      .then((r) => {
        advancedRef.current =
          (r.data.data?.limits ?? {}).advanced_reports !== false;
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Reports" sub="Sales, stock, profit, and balances" />
      <div className="flex flex-wrap items-center gap-2">
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
        {tab !== 'utang' && tab !== 'products' && (
          <div
            className="ml-1 flex h-9 items-center rounded-full border border-gray-300 bg-white px-1 text-[13px]"
            role="group"
            aria-label="Report scope"
          >
            <button
              onClick={() => toggleStores(false)}
              aria-pressed={!allStores}
              className={`rounded-full px-3 py-1 ${!allStores ? 'bg-primary text-white' : 'text-gray-600'}`}
            >
              This store
            </button>
            <button
              onClick={() => toggleStores(true)}
              aria-pressed={allStores}
              className={`rounded-full px-3 py-1 ${allStores ? 'bg-primary text-white' : 'text-gray-600'}`}
            >
              All stores
            </button>
          </div>
        )}
        {tab === 'products' && data && (
          <button
            onClick={downloadCSV}
            className="ml-1 h-9 rounded-full border border-gray-300 bg-white px-3 text-[13px] text-gray-600"
          >
            Export CSV
          </button>
        )}
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
        {locked ? (
          <div className="py-4 text-center">
            <p className="font-semibold">All-stores reports are a paid feature</p>
            <p className="mt-1 text-sm text-gray-500">
              Upgrade to unlock org-wide rollups.
            </p>
            <p className="mt-3">
              <Link to="/billing" className="font-medium text-primary">
                View plans →
              </Link>
            </p>
          </div>
        ) : loading ? (
          <Spinner label="Loading report…" />
        ) : !data ? (
          <EmptyState title="No data" hint="Try a wider date range." />
        ) : null}
        {tab === 'sales' && data && (
          <>
            <p className="text-2xl font-bold">{formatPHP(data.total)}</p>
            <p className="text-sm text-gray-500">{data.count} sales · avg {formatPHP(data.average)}</p>
            {(data.vat_collected ?? 0) > 0 && (
              <p className="flex justify-between py-1 text-sm text-gray-500">
                <span>VAT collected</span>
                <span>{formatPHP(data.vat_collected)}</span>
              </p>
            )}
            {data.by_method?.map((m: any) => (
              <p key={m.method} className="flex justify-between py-1 text-sm">
                <span className="capitalize">{m.method}</span>
                <span>{formatPHP(m.total)}</span>
              </p>
            ))}
            {data.by_store && <StoreBreakdown rows={data.by_store} value={(s: any) => formatPHP(s.total)} hint={(s: any) => `${s.count} sales`} />}
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
          <>
            <p className="text-sm">Lines: {data.lines} · Value: {formatPHP(data.stock_value)} · Low: {data.low_stock}</p>
            {data.by_store && <StoreBreakdown rows={data.by_store} value={(s: any) => formatPHP(s.stock_value)} hint={(s: any) => `${s.lines} lines`} />}
          </>
        )}
        {tab === 'profit' && data && (
          <>
            <p className="text-sm">Revenue: {formatPHP(data.revenue)}</p>
            <p className="text-sm">COGS: {formatPHP(data.cogs)}</p>
            <p className="text-lg font-bold">Gross profit: {formatPHP(data.gross_profit)}</p>
            {data.by_store && <StoreBreakdown rows={data.by_store} value={(s: any) => formatPHP(s.gross_profit)} hint={(s: any) => formatPHP(s.revenue)} />}
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
            {data.by_store && <StoreBreakdown rows={data.by_store} value={(s: any) => formatPHP(s.total)} />}
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
