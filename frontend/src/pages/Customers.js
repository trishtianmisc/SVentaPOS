import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
export default function CustomersPage() {
    const [items, setItems] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [limit, setLimit] = useState('');
    const [detail, setDetail] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [payAmt, setPayAmt] = useState('');
    const [msg, setMsg] = useState('');
    const load = async () => {
        const res = await api.get('/customers');
        setItems(res.data.data);
    };
    useEffect(() => {
        load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
    }, []);
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
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    const open = async (id) => {
        const [d, l] = await Promise.all([
            api.get(`/customers/${id}`),
            api.get(`/customers/${id}/ledger`),
        ]);
        setDetail(d.data.data);
        setLedger(l.data.data);
        setPayAmt('');
    };
    const pay = async () => {
        if (!detail)
            return;
        setMsg('');
        try {
            await api.post(`/customers/${detail.id}/payment`, {
                amount: Number(payAmt),
                method: 'cash',
            });
            await open(detail.id);
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Payment failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: "Customers & Utang" }), msg && _jsx("p", { className: "mt-2 text-sm text-red-600", children: msg }), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-[320px_1fr_1fr]", children: [_jsxs("section", { className: "h-fit rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Add customer" }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsx("input", { className: "rounded-lg border p-2", placeholder: "Name", value: name, onChange: (e) => setName(e.target.value) }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Phone (optional)", value: phone, onChange: (e) => setPhone(e.target.value) }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Credit limit (optional)", value: limit, onChange: (e) => setLimit(e.target.value), inputMode: "decimal" }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-white", onClick: create, children: "Add" })] })] }), _jsxs("section", { className: "rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Balances" }), _jsxs("ul", { className: "mt-2 divide-y", children: [items.map((c) => (_jsx("li", { children: _jsxs("button", { className: "flex w-full justify-between py-2 text-left", onClick: () => open(c.id), children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium", children: c.name }), c.credit_limit != null && (_jsxs("span", { className: "ml-2 text-xs text-gray-400", children: ["limit ", formatPHP(c.credit_limit)] }))] }), _jsx("span", { className: c.balance > 0 ? 'font-bold text-amber-700' : '', children: formatPHP(c.balance) })] }) }, c.id))), items.length === 0 && _jsx("li", { className: "py-2 text-sm text-gray-400", children: "No customers yet." })] })] }), _jsx("section", { className: "h-fit rounded-xl border bg-white p-4", children: detail ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "font-bold", children: detail.name }), _jsxs("p", { className: "text-sm", children: ["Outstanding: ", _jsx("span", { className: "font-bold", children: formatPHP(detail.balance) })] }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("input", { className: "flex-1 rounded-lg border p-2", placeholder: "Payment amount", value: payAmt, onChange: (e) => setPayAmt(e.target.value), inputMode: "decimal" }), _jsx("button", { className: "rounded-lg bg-teal-700 px-3 text-white", onClick: pay, children: "Record" })] }), _jsx("ul", { className: "mt-3 divide-y text-sm", children: ledger.map((e) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsx("span", { children: e.transaction_type }), _jsx("span", { children: formatPHP(e.amount) })] }, e.id))) })] })) : (_jsx("p", { className: "text-sm text-gray-400", children: "Select a customer for ledger + payments." })) })] })] }));
}
