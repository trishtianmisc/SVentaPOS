import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
const TABS = ['sales', 'products', 'inventory', 'profit', 'expenses', 'utang'];
export default function ReportsPage() {
    const [tab, setTab] = useState('sales');
    const [data, setData] = useState(null);
    const [msg, setMsg] = useState('');
    const load = async (t) => {
        setTab(t);
        setMsg('');
        setData(null);
        try {
            const res = await api.get(`/reports/${t}`);
            setData(res.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Load failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: "Reports" }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: TABS.map((t) => (_jsx("button", { onClick: () => load(t), className: `rounded-full px-3 py-1 text-xs capitalize ${tab === t ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`, children: t }, t))) }), msg && _jsx("p", { className: "mt-2 text-sm text-red-600", children: msg }), _jsxs("section", { className: "mt-4 rounded-xl border bg-white p-4", children: [!data && _jsx("p", { className: "text-sm text-gray-400", children: "Pick a report above." }), tab === 'sales' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-2xl font-bold", children: formatPHP(data.total) }), _jsxs("p", { className: "text-sm text-gray-500", children: [data.count, " sales \u00B7 avg ", formatPHP(data.average)] }), data.by_method?.map((m) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { className: "capitalize", children: m.method }), _jsx("span", { children: formatPHP(m.total) })] }, m.method)))] })), tab === 'products' && data && (_jsx("ul", { className: "divide-y text-sm", children: (Array.isArray(data) ? data : []).slice(0, 20).map((r) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsxs("span", { children: [r.product_name, " \u00D7 ", r.quantity] }), _jsx("span", { children: formatPHP(r.revenue) })] }, r.product_id))) })), tab === 'inventory' && data && (_jsxs("p", { className: "text-sm", children: ["Lines: ", data.lines, " \u00B7 Value: ", formatPHP(data.stock_value), " \u00B7 Low: ", data.low_stock] })), tab === 'profit' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Revenue: ", formatPHP(data.revenue)] }), _jsxs("p", { className: "text-sm", children: ["COGS: ", formatPHP(data.cogs)] }), _jsxs("p", { className: "text-lg font-bold", children: ["Gross profit: ", formatPHP(data.gross_profit)] })] })), tab === 'expenses' && data && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-lg font-bold", children: formatPHP(data.total) }), data.by_category?.map((c) => (_jsxs("p", { className: "flex justify-between py-1 text-sm", children: [_jsx("span", { children: c.category }), _jsx("span", { children: formatPHP(c.total) })] }, c.category)))] })), tab === 'utang' && data && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-lg font-bold", children: [formatPHP(data.total_outstanding), " outstanding"] }), _jsx("ul", { className: "mt-2 divide-y text-sm", children: data.customers?.map((c) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsx("span", { children: c.name }), _jsx("span", { children: formatPHP(c.balance) })] }, c.id))) })] }))] })] }));
}
