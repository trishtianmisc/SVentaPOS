import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { EmptyState, Field, PageHeader, Section, Spinner, Table, TextInput, } from '../components/ui';
const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'];
const RANGED = new Set(['sales', 'products', 'profit', 'expenses']);
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
function StoreBreakdown({ rows, value, hint, }) {
    return (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "mb-1 text-[13px] font-semibold text-gray-500", children: "Per store" }), _jsx(Table, { head: ['Store', hint ? 'Detail' : '', 'Total'], children: rows.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: s.store_name ?? s.store_id.slice(0, 8) }), _jsx("td", { className: "px-3 py-2 text-sm text-gray-500", children: hint?.(s) ?? '' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: value(s) })] }, s.store_id))) })] }));
}
export default function ReportsPage() {
    const [tab, setTab] = useState('sales');
    const [data, setData] = useState(null);
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
    const load = useCallback(async (t, f = from, e = to, all = allStores) => {
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
    }, [from, to, allStores]);
    const toggleStores = (all) => {
        setAllStores(all);
        load(tab, from, to, all);
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
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Reports", sub: "Sales, stock, profit, and balances" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [TABS.map((t) => (_jsx("button", { onClick: () => load(t), "aria-pressed": tab === t, className: `h-9 rounded-full px-3 text-[13px] capitalize ${tab === t ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-600'}`, children: t }, t))), tab !== 'utang' && tab !== 'products' && (_jsxs("div", { className: "ml-1 flex h-9 items-center rounded-full border border-gray-300 bg-white px-1 text-[13px]", role: "group", "aria-label": "Report scope", children: [_jsx("button", { onClick: () => toggleStores(false), "aria-pressed": !allStores, className: `rounded-full px-3 py-1 ${!allStores ? 'bg-primary text-white' : 'text-gray-600'}`, children: "This store" }), _jsx("button", { onClick: () => toggleStores(true), "aria-pressed": allStores, className: `rounded-full px-3 py-1 ${allStores ? 'bg-primary text-white' : 'text-gray-600'}`, children: "All stores" })] })), tab === 'products' && data && (_jsx("button", { onClick: downloadCSV, className: "ml-1 h-9 rounded-full border border-gray-300 bg-white px-3 text-[13px] text-gray-600", children: "Export CSV" }))] }), RANGED.has(tab) && (_jsxs("div", { className: "mt-3 grid max-w-md grid-cols-2 gap-3", children: [_jsx(Field, { label: "From", children: _jsx(TextInput, { type: "date", max: todayISO(), value: from, onChange: (e) => {
                                setFrom(e.target.value);
                                load(tab, e.target.value, to);
                            } }) }), _jsx(Field, { label: "To", children: _jsx(TextInput, { type: "date", max: todayISO(), value: to, onChange: (e) => {
                                setTo(e.target.value);
                                load(tab, from, e.target.value);
                            } }) })] })), msg && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: msg }), _jsxs(Section, { title: tab.charAt(0).toUpperCase() + tab.slice(1), children: [locked ? (_jsxs("div", { className: "py-4 text-center", children: [_jsx("p", { className: "font-semibold", children: "All-stores reports are a paid feature" }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Upgrade to unlock org-wide rollups." }), _jsx("p", { className: "mt-3", children: _jsx(Link, { to: "/billing", className: "font-medium text-primary", children: "View plans \u2192" }) })] })) : loading ? (_jsx(Spinner, { label: "Loading report\u2026" })) : !data ? (_jsx(EmptyState, { title: "No data", hint: "Try a wider date range." })) : null, tab === 'sales' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-2xl font-bold", children: formatPHP(data.total) }), _jsxs("p", { className: "text-sm text-gray-500", children: [data.count, " sales \u00B7 avg ", formatPHP(data.average)] }), (data.vat_collected ?? 0) > 0 && (_jsxs("p", { className: "flex justify-between py-1 text-sm text-gray-500", children: [_jsx("span", { children: "VAT collected" }), _jsx("span", { children: formatPHP(data.vat_collected) })] })), data.by_method?.map((m) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { className: "capitalize", children: m.method }), _jsx("span", { children: formatPHP(m.total) })] }, m.method))), data.by_store && _jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.total), hint: (s) => `${s.count} sales` })] })), tab === 'products' && data && (_jsx(Table, { head: ['Product', 'Qty', 'Revenue'], children: (Array.isArray(data) ? data : []).slice(0, 20).map((r) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name }), _jsx("td", { className: "px-3 py-2 text-right", children: r.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(r.revenue) })] }, r.product_id))) })), tab === 'inventory' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Lines: ", data.lines, " \u00B7 Value: ", formatPHP(data.stock_value), " \u00B7 Low: ", data.low_stock] }), data.by_store && _jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.stock_value), hint: (s) => `${s.lines} lines` })] })), tab === 'profit' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Revenue: ", formatPHP(data.revenue)] }), _jsxs("p", { className: "text-sm", children: ["COGS: ", formatPHP(data.cogs)] }), _jsxs("p", { className: "text-lg font-bold", children: ["Gross profit: ", formatPHP(data.gross_profit)] }), data.by_store && _jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.gross_profit), hint: (s) => formatPHP(s.revenue) })] })), tab === 'expenses' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-lg font-bold", children: formatPHP(data.total) }), data.by_category?.map((c) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { children: c.category }), _jsx("span", { children: formatPHP(c.total) })] }, c.category))), data.by_store && _jsx(StoreBreakdown, { rows: data.by_store, value: (s) => formatPHP(s.total) })] })), tab === 'utang' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-lg font-semibold", children: [formatPHP(data.total_outstanding), " outstanding"] }), _jsx(Table, { head: ['Customer', 'Balance'], children: data.customers?.map((c) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: c.name }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(c.balance) })] }, c.id))) })] }))] })] }));
}
