import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { EmptyState, Field, PageHeader, Section, Spinner, Table, TextInput, } from '../components/ui';
const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'];
const RANGED = new Set(['sales', 'products', 'profit', 'expenses']);
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
export default function ReportsPage() {
    const [tab, setTab] = useState('sales');
    const [data, setData] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const load = useCallback(async (t, f = from, e = to) => {
        setTab(t);
        setMsg('');
        setData(null);
        setLoading(true);
        try {
            const params = {};
            if (RANGED.has(t)) {
                if (f)
                    params.from = f;
                if (e)
                    params.to = e;
            }
            const res = await api.get(`/reports/${t}`, { params });
            setData(res.data.data);
        }
        catch (err) {
            setMsg(err.response?.data?.error?.message ?? 'Load failed');
        }
        finally {
            setLoading(false);
        }
    }, [from, to]);
    useEffect(() => {
        load('sales', '', '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Reports", sub: "Sales, stock, profit, and balances" }), _jsx("div", { className: "flex flex-wrap gap-2", children: TABS.map((t) => (_jsx("button", { onClick: () => load(t), "aria-pressed": tab === t, className: `h-9 rounded-full px-3 text-[13px] capitalize ${tab === t ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-600'}`, children: t }, t))) }), RANGED.has(tab) && (_jsxs("div", { className: "mt-3 grid max-w-md grid-cols-2 gap-3", children: [_jsx(Field, { label: "From", children: _jsx(TextInput, { type: "date", max: todayISO(), value: from, onChange: (e) => {
                                setFrom(e.target.value);
                                load(tab, e.target.value, to);
                            } }) }), _jsx(Field, { label: "To", children: _jsx(TextInput, { type: "date", max: todayISO(), value: to, onChange: (e) => {
                                setTo(e.target.value);
                                load(tab, from, e.target.value);
                            } }) })] })), msg && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: msg }), _jsxs(Section, { title: tab.charAt(0).toUpperCase() + tab.slice(1), children: [loading ? (_jsx(Spinner, { label: "Loading report\u2026" })) : !data ? (_jsx(EmptyState, { title: "No data", hint: "Try a wider date range." })) : null, tab === 'sales' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-2xl font-bold", children: formatPHP(data.total) }), _jsxs("p", { className: "text-sm text-gray-500", children: [data.count, " sales \u00B7 avg ", formatPHP(data.average)] }), data.by_method?.map((m) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { className: "capitalize", children: m.method }), _jsx("span", { children: formatPHP(m.total) })] }, m.method)))] })), tab === 'products' && data && (_jsx(Table, { head: ['Product', 'Qty', 'Revenue'], children: (Array.isArray(data) ? data : []).slice(0, 20).map((r) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name }), _jsx("td", { className: "px-3 py-2 text-right", children: r.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(r.revenue) })] }, r.product_id))) })), tab === 'inventory' && data && (_jsxs("p", { className: "text-sm", children: ["Lines: ", data.lines, " \u00B7 Value: ", formatPHP(data.stock_value), " \u00B7 Low: ", data.low_stock] })), tab === 'profit' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Revenue: ", formatPHP(data.revenue)] }), _jsxs("p", { className: "text-sm", children: ["COGS: ", formatPHP(data.cogs)] }), _jsxs("p", { className: "text-lg font-bold", children: ["Gross profit: ", formatPHP(data.gross_profit)] })] })), tab === 'expenses' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-lg font-bold", children: formatPHP(data.total) }), data.by_category?.map((c) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { children: c.category }), _jsx("span", { children: formatPHP(c.total) })] }, c.category)))] })), tab === 'utang' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-lg font-semibold", children: [formatPHP(data.total_outstanding), " outstanding"] }), _jsx(Table, { head: ['Customer', 'Balance'], children: data.customers?.map((c) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: c.name }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(c.balance) })] }, c.id))) })] }))] })] }));
}
