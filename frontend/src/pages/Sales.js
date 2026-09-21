import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
    useEffect(() => {
        api
            .get('/sales')
            .then((r) => setSales(r.data.data))
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
    }, []);
    const open = async (id) => {
        const res = await api.get(`/sales/${id}`);
        setDetail(res.data.data);
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: "Sales history" }), msg && _jsx("p", { className: "mt-2 text-sm", children: msg }), _jsxs("div", { className: "mt-4 grid gap-6 lg:grid-cols-2", children: [_jsx("section", { className: "rounded-xl border bg-white p-4", children: _jsx("ul", { className: "divide-y", children: sales.map((s) => (_jsxs("li", { className: "flex justify-between py-2", children: [_jsx("button", { className: "text-teal-700", onClick: () => open(s.id), children: s.receipt_number }), _jsxs("span", { children: [formatPHP(s.total), " \u00B7 ", s.status] })] }, s.id))) }) }), _jsx("section", { className: "h-fit rounded-xl border bg-white p-4", children: detail ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "font-bold", children: ["Receipt ", detail.receipt_number] }), detail.items?.map((i) => (_jsxs("p", { children: [i.product_name_snapshot, " \u00D7 ", i.quantity, " \u2014 ", formatPHP(i.line_total)] }, i.id))), _jsxs("p", { className: "mt-2", children: ["Total: ", formatPHP(detail.total)] })] })) : (_jsx("p", { className: "text-sm text-gray-400", children: "Select a receipt to view details." })) })] })] }));
}
