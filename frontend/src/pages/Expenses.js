import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
export default function ExpensesPage() {
    const [items, setItems] = useState([]);
    const [cats, setCats] = useState([]);
    const [catId, setCatId] = useState('');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [msg, setMsg] = useState('');
    const load = async () => {
        const [e, c] = await Promise.all([
            api.get('/expenses'),
            api.get('/expenses/categories'),
        ]);
        setItems(e.data.data);
        setCats(c.data.data);
        if (c.data.data.length > 0 && !catId)
            setCatId(c.data.data[0].id);
    };
    useEffect(() => {
        load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const seed = async () => {
        await api.post('/expenses/categories');
        await load();
    };
    const create = async () => {
        setMsg('');
        try {
            await api.post('/expenses', {
                category_id: catId,
                amount: Number(amount),
                payment_method: 'cash',
                notes: notes || undefined,
            });
            setAmount('');
            setNotes('');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: "Expenses" }), msg && _jsx("p", { className: "mt-2 text-sm text-red-600", children: msg }), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs("section", { className: "h-fit rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Record expense" }), cats.length === 0 ? (_jsx("button", { className: "mt-2 w-full rounded-lg bg-teal-700 p-2 text-white", onClick: seed, children: "Load default categories" })) : (_jsxs("div", { className: "mt-2 grid gap-2", children: [_jsx("select", { className: "rounded-lg border p-2", value: catId, onChange: (e) => setCatId(e.target.value), children: cats.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id))) }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Amount", value: amount, onChange: (e) => setAmount(e.target.value), inputMode: "decimal" }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Notes (optional)", value: notes, onChange: (e) => setNotes(e.target.value) }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-white", onClick: create, children: "Add" })] }))] }), _jsx("section", { className: "rounded-xl border bg-white p-4", children: _jsxs("ul", { className: "divide-y text-sm", children: [items.map((x) => (_jsxs("li", { className: "flex justify-between py-2", children: [_jsxs("span", { children: [x.category_name ?? '', " \u00B7 ", x.expense_date] }), _jsx("span", { className: "font-medium", children: formatPHP(x.amount) })] }, x.id))), items.length === 0 && _jsx("li", { className: "py-2 text-sm text-gray-400", children: "No expenses yet." })] }) })] })] }));
}
