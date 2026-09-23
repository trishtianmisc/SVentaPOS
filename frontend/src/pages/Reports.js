import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { EmptyState, Section, Spinner, Table } from '../components/ui';
import { KpiCard } from '../components/KpiCard';
const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'];
const RANGED = new Set(['sales', 'products', 'profit', 'expenses']);
const RANGES = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'year', label: 'Year' },
];
function pad(n) {
    return String(n).padStart(2, '0');
}
function iso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function rangeDates(key) {
    const now = new Date();
    const today = iso(now);
    switch (key) {
        case 'today':
            return { from: today, to: today };
        case 'yesterday': {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return { from: iso(y), to: iso(y) };
        }
        case '7d': {
            const f = new Date(now);
            f.setDate(f.getDate() - 6);
            return { from: iso(f), to: today };
        }
        case '30d': {
            const f = new Date(now);
            f.setDate(f.getDate() - 29);
            return { from: iso(f), to: today };
        }
        case 'year':
            return { from: `${now.getFullYear()}-01-01`, to: today };
    }
}
function rangeLabel(_key, from, to) {
    if (from && to && from === to) {
        const d = new Date(`${from}T12:00:00`);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
    if (from && to)
        return `${from} → ${to}`;
    return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function StoreBreakdown({ rows, value, hint, }) {
    return (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "mb-1 text-[13px] font-semibold text-gray-500 dark:text-[#6f6a62]", children: "Per store" }), _jsx(Table, { head: ['Store', hint ? 'Detail' : '', 'Total'], children: rows.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: s.store_name ?? s.store_id.slice(0, 8) }), _jsx("td", { className: "px-3 py-2 text-sm text-gray-500 dark:text-[#6f6a62]", children: hint?.(s) ?? '' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: value(s) })] }, s.store_id))) })] }));
}
export default function ReportsPage() {
    const [tab, setTab] = useState('sales');
    const [data, setData] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [rangeKey, setRangeKey] = useState('today');
    const [from, setFrom] = useState(() => rangeDates('today').from);
    const [to, setTo] = useState(() => rangeDates('today').to);
    const [allStores, setAllStores] = useState(false);
    const [advanced, setAdvanced] = useState(true);
    const [locked, setLocked] = useState(false);
    // KPI summary for the header strip (independent of active tab).
    const [kpis, setKpis] = useState(null);
    const [kpiLoading, setKpiLoading] = useState(false);
    const [branchCount, setBranchCount] = useState(1);
    const loadKpis = useCallback(async (f, e, all, canAdvanced) => {
        setKpiLoading(true);
        setKpis(null);
        try {
            if (all && canAdvanced) {
                const [s, p, x] = await Promise.all([
                    api.get('/reports/consolidated/sales', { params: { from: f, to: e } }),
                    api.get('/reports/consolidated/profit', { params: { from: f, to: e } }),
                    api.get('/reports/consolidated/expenses', { params: { from: f, to: e } }),
                ]);
                const total = Number(s.data.data?.total) || 0;
                const count = Number(s.data.data?.count) || 0;
                const expenses = Number(x.data.data?.total) || 0;
                const profit = Number(p.data.data?.gross_profit) || 0;
                setKpis({
                    total,
                    count,
                    average: count ? total / count : 0,
                    profit,
                    expenses,
                    margin: total > 0 ? (profit / total) * 100 : 0,
                });
            }
            else {
                const [s, p, x] = await Promise.all([
                    api.get('/reports/sales', { params: { from: f, to: e } }),
                    api.get('/reports/profit', { params: { from: f, to: e } }),
                    api.get('/reports/expenses', { params: { from: f, to: e } }),
                ]);
                const total = Number(s.data.data?.total) || 0;
                const count = Number(s.data.data?.count) || 0;
                const expenses = Number(x.data.data?.total) || 0;
                const profit = Number(p.data.data?.gross_profit) || 0;
                setKpis({
                    total,
                    count,
                    average: count ? total / count : 0,
                    profit,
                    expenses,
                    margin: total > 0 ? (profit / total) * 100 : 0,
                });
            }
        }
        catch {
            setKpis(null);
        }
        finally {
            setKpiLoading(false);
        }
    }, []);
    const load = useCallback(async (t, f = from, e = to, all = allStores, canAdvanced = advanced) => {
        setTab(t);
        setMsg('');
        setData(null);
        const wantAll = all && t !== 'utang' && t !== 'products';
        if (wantAll && !canAdvanced) {
            setLoading(false);
            setLocked(true);
            return;
        }
        setLocked(false);
        setLoading(true);
        try {
            const params = {};
            if (RANGED.has(t)) {
                if (f)
                    params.from = f;
                if (e)
                    params.to = e;
            }
            const path = wantAll ? `/reports/consolidated/${t}` : `/reports/${t}`;
            const res = await api.get(path, { params });
            setData(res.data.data);
        }
        catch (err) {
            if (err.response?.status === 403 && wantAll)
                setLocked(true);
            else
                setMsg(err.response?.data?.error?.message ?? 'Load failed');
        }
        finally {
            setLoading(false);
        }
    }, [from, to, allStores, advanced]);
    const applyRange = (key) => {
        const { from: f, to: e } = rangeDates(key);
        setRangeKey(key);
        setFrom(f);
        setTo(e);
        load(tab, f, e);
        loadKpis(f, e, allStores, advanced);
    };
    const toggleStores = (all) => {
        setAllStores(all);
        load(tab, from, to, all);
        loadKpis(from, to, all, advanced);
    };
    const downloadCSV = () => {
        if (tab !== 'products' || !Array.isArray(data))
            return;
        const rows = [['Product', 'Qty', 'Revenue']];
        for (const r of data)
            rows.push([r.product_name, r.quantity, r.revenue]);
        const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
            type: 'text/csv',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `products-${iso(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    useEffect(() => {
        let canAdvanced = true;
        (async () => {
            try {
                const [sub, stores] = await Promise.all([
                    api.get('/subscriptions/current'),
                    api.get('/users/branch-stores').catch(() => null),
                ]);
                canAdvanced = (sub.data.data?.limits ?? {}).advanced_reports !== false;
                setAdvanced(canAdvanced);
                const n = (stores?.data?.data ?? []).length;
                if (n)
                    setBranchCount(n);
            }
            catch {
                /* keep defaults */
            }
            load('sales', from, to, allStores, canAdvanced);
            loadKpis(from, to, allStores, canAdvanced);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const upgradeBase = typeof window !== 'undefined' && window.location.pathname.startsWith('/owner')
        ? '/owner/console/subscription'
        : '/billing';
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-[#15243a] dark:text-[#60a5fa]", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" }) }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight text-gray-900 dark:text-white", children: "Business Reports" }), _jsx("span", { className: `rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${allStores
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-[#123528] dark:text-[#3dd68c]'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-[#1a1a1e] dark:text-[#9b958c]'}`, children: allStores ? 'Live Rollup' : 'This store' })] }), _jsxs("p", { className: "mt-0.5 text-sm text-gray-500 dark:text-[#9b958c]", children: ["Cross-branch executive analytics \u00B7", ' ', allStores
                                                ? `${branchCount} branch${branchCount === 1 ? '' : 'es'} reporting`
                                                : 'single branch'] })] })] }), _jsx("div", { className: "flex flex-wrap items-center gap-2", children: tab === 'products' && data && (_jsx("button", { type: "button", onClick: downloadCSV, className: "inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#e8e4dc] dark:hover:bg-[#1c1c20]", children: "Export" })) })] }), _jsxs("div", { className: "mb-5 flex flex-wrap items-center justify-between gap-3", children: [_jsx("div", { className: "inline-flex h-10 items-center rounded-full bg-gray-100 p-1 dark:bg-[#1a1a1e]", children: RANGES.map((r) => (_jsx("button", { type: "button", "aria-pressed": rangeKey === r.key, onClick: () => applyRange(r.key), className: `h-8 rounded-full px-3.5 text-[13px] font-semibold ${rangeKey === r.key
                                ? 'bg-primary text-white shadow'
                                : 'text-gray-600 hover:text-gray-900 dark:text-[#9b958c] dark:hover:text-[#e8e4dc]'}`, children: r.label }, r.key))) }), _jsxs("span", { className: "inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#c9c3b8]", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M8 3v4M16 3v4M3 11h18" })] }), rangeLabel(rangeKey, from, to)] })] }), _jsx("div", { className: "mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: kpiLoading || !kpis ? (_jsx("div", { className: "rounded-3xl border border-gray-200 bg-white p-5 sm:col-span-2 xl:col-span-4 dark:border-[#1e1e22] dark:bg-[#121214]", children: _jsx(Spinner, { label: "Loading performance\u2026" }) })) : (_jsxs(_Fragment, { children: [_jsx(KpiCard, { tone: "green", label: "Total sales", value: formatPHP(kpis.total), hint: `${kpis.count} orders · avg ${formatPHP(kpis.average)}`, icon: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 2v20M17 7H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7H6" }) }) }), _jsx(KpiCard, { tone: "teal", label: "Net profit", value: `${kpis.profit >= 0 ? '+' : ''}${formatPHP(kpis.profit)}`, hint: "Revenue minus COGS", badge: kpis.total > 0 ? `${kpis.margin.toFixed(1)}% margin` : undefined, icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M3 17 9 11l4 4 8-8" }), _jsx("path", { d: "M14 7h7v7" })] }) }), _jsx(KpiCard, { tone: "blue", label: "Orders", value: String(kpis.count), hint: "Completed sales in range", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "4", y: "3", width: "16", height: "18", rx: "2" }), _jsx("path", { d: "M8 7h8M8 11h8M8 15h5" })] }) }), _jsx(KpiCard, { tone: "rose", label: "Expenses", value: formatPHP(kpis.expenses), hint: "Recorded in range", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M20 12V8H6a2 2 0 1 1 0-4h12v4" }), _jsx("path", { d: "M4 6v12a2 2 0 0 0 2 2h14v-4" }), _jsx("path", { d: "M18 12a2 2 0 0 0 0 4h4v-4h-4Z" })] }) })] })) }), _jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [TABS.map((t) => (_jsxs("button", { type: "button", onClick: () => load(t), "aria-pressed": tab === t, className: `inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold capitalize ${tab === t
                            ? 'bg-primary text-white shadow'
                            : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-[#2a2a2e] dark:bg-[#141416] dark:text-[#9b958c] dark:hover:bg-[#1c1c20]'}`, children: [t === 'utang' ? 'Credit' : t, (t === 'inventory' || t === 'profit' || t === 'expenses' || t === 'sales') &&
                                allStores && (_jsx("span", { className: `rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${tab === t
                                    ? 'bg-white/20 text-white'
                                    : 'bg-rose-100 text-rose-700 dark:bg-[#2a1a1c] dark:text-[#f08a8a]'}`, children: "PRO" }))] }, t))), tab !== 'utang' && tab !== 'products' && (_jsxs("div", { className: "ml-1 inline-flex h-10 items-center rounded-full border border-gray-300 bg-white px-1 text-sm dark:border-[#2a2a2e] dark:bg-[#141416]", role: "group", "aria-label": "Report scope", children: [_jsx("button", { type: "button", onClick: () => toggleStores(false), "aria-pressed": !allStores, className: `rounded-full px-3 py-1.5 font-medium ${!allStores
                                    ? 'bg-primary text-white'
                                    : 'text-gray-600 dark:text-[#9b958c]'}`, children: "This store" }), _jsx("button", { type: "button", onClick: () => toggleStores(true), "aria-pressed": allStores, className: `rounded-full px-3 py-1.5 font-medium ${allStores
                                    ? 'bg-primary text-white'
                                    : 'text-gray-600 dark:text-[#9b958c]'}`, children: "All stores" })] }))] }), msg && (_jsx("p", { className: "mb-3 text-[13px] text-red-600 dark:text-[#f0a090]", children: msg })), _jsxs(Section, { title: tab === 'utang' ? 'Credit' : tab.charAt(0).toUpperCase() + tab.slice(1), children: [locked ? (_jsxs("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-[#3a3010] dark:bg-[#141208]", children: [_jsx("p", { className: "font-semibold text-amber-900 dark:text-white", children: "All-stores reports are a paid feature" }), _jsx("p", { className: "mt-1 text-sm text-amber-700 dark:text-[#9b958c]", children: "Upgrade to unlock org-wide rollups." }), _jsx("p", { className: "mt-3", children: _jsx(Link, { to: upgradeBase, className: "font-semibold text-primary hover:underline", children: "View plans \u2192" }) })] })) : loading ? (_jsx(Spinner, { label: "Loading report\u2026" })) : !data ? (_jsx(EmptyState, { title: "No data", hint: "Try a wider date range." })) : null, tab === 'sales' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: formatPHP(data.total) }), _jsxs("p", { className: "text-sm text-gray-500 dark:text-[#9b958c]", children: [data.count, " sales \u00B7 avg ", formatPHP(data.average)] }), (data.vat_collected ?? 0) > 0 && (_jsxs("p", { className: "flex justify-between py-1 text-sm text-gray-600 dark:text-[#c9c3b8]", children: [_jsx("span", { children: "VAT collected" }), _jsx("span", { children: formatPHP(data.vat_collected) })] })), data.by_method?.map((m) => (_jsxs("p", { className: "flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]", children: [_jsx("span", { className: "capitalize", children: m.method }), _jsx("span", { children: formatPHP(m.total) })] }, m.method))), data.by_store && (_jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.total), hint: (s) => `${s.count} sales` }))] })), tab === 'products' && data && (_jsx(Table, { head: ['Product', 'Qty', 'Revenue'], children: (Array.isArray(data) ? data : []).slice(0, 20).map((r) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name }), _jsx("td", { className: "px-3 py-2 text-right", children: r.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(r.revenue) })] }, r.product_id))) })), tab === 'inventory' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-gray-700 dark:text-[#c9c3b8]", children: ["Lines: ", data.lines, " \u00B7 Value: ", formatPHP(data.stock_value), " \u00B7 Low:", ' ', data.low_stock] }), data.by_store && (_jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.stock_value), hint: (s) => `${s.lines} lines` }))] })), tab === 'profit' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-gray-600 dark:text-[#9b958c]", children: ["Revenue: ", formatPHP(data.revenue)] }), _jsxs("p", { className: "text-sm text-gray-600 dark:text-[#9b958c]", children: ["COGS: ", formatPHP(data.cogs)] }), _jsxs("p", { className: "text-lg font-bold text-gray-900 dark:text-white", children: ["Gross profit: ", formatPHP(data.gross_profit)] }), data.by_store && (_jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.gross_profit), hint: (s) => formatPHP(s.revenue) }))] })), tab === 'expenses' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: formatPHP(data.total) }), _jsxs("p", { className: "text-sm text-gray-500 dark:text-[#9b958c]", children: [data.count ?? 0, " entries", (data.count ?? 0) > 0
                                        ? ` · avg ${formatPHP(data.average ?? 0)}`
                                        : ''] }), data.by_category?.map((c) => (_jsxs("p", { className: "flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]", children: [_jsx("span", { children: c.category }), _jsx("span", { children: formatPHP(c.total) })] }, c.category))), data.by_method?.length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsx("p", { className: "mb-1 text-[13px] font-semibold text-gray-500 dark:text-[#6f6a62]", children: "By payment method" }), data.by_method.map((m) => (_jsxs("p", { className: "flex justify-between py-1 text-sm text-gray-700 dark:text-[#c9c3b8]", children: [_jsx("span", { className: "capitalize", children: m.method }), _jsx("span", { children: formatPHP(m.total) })] }, m.method)))] })), data.by_day?.length > 0 && (_jsx(Table, { head: ['Day', 'Total'], children: data.by_day.map((d) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: d.day }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(d.total) })] }, d.day))) })), data.by_store && (_jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.total), hint: (s) => `${s.count ?? 0} entries` }))] })), tab === 'utang' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-lg font-semibold text-gray-900 dark:text-white", children: [formatPHP(data.total_outstanding), " outstanding"] }), _jsx(Table, { head: ['Customer', 'Balance'], children: data.customers?.map((c) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: c.name }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(c.balance) })] }, c.id))) })] }))] })] }));
}
