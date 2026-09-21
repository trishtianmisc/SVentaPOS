import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { Button, EmptyState, Field, ListFooter, PageHeader, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
const METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other'];
export default function ExpensesPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cats, setCats] = useState([]);
    const [catId, setCatId] = useState('');
    const [newCat, setNewCat] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
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
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const seed = async () => {
        setMsg('');
        try {
            await api.post('/expenses/categories');
            toast('success', 'Default categories ready');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Seed failed');
        }
    };
    const addCategory = async () => {
        if (!newCat.trim())
            return;
        setMsg('');
        try {
            const res = await api.post('/expenses/categories/new', { name: newCat.trim() });
            setNewCat('');
            toast('success', 'Category added');
            await load();
            setCatId(res.data.data.id);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Category create failed');
        }
    };
    const create = async () => {
        setMsg('');
        try {
            await api.post('/expenses', {
                category_id: catId,
                amount: Number(amount),
                payment_method: method,
                notes: notes || undefined,
            });
            setAmount('');
            setNotes('');
            toast('success', 'Expense recorded');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Expenses", sub: "Track store costs by category" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs("div", { className: "grid content-start gap-4", children: [_jsx(Section, { title: "Record expense", children: cats.length === 0 ? (_jsx(Button, { className: "w-full", onClick: seed, children: "Load default categories" })) : (_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Category", children: _jsx(Select, { value: catId, onChange: (e) => setCatId(e.target.value), children: cats.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id))) }) }), _jsx(Field, { label: "Amount (\u20B1)", children: _jsx(TextInput, { value: amount, onChange: (e) => setAmount(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Paid with", children: _jsx(Select, { value: method, onChange: (e) => setMethod(e.target.value), children: METHODS.map((m) => (_jsx("option", { value: m, className: "capitalize", children: m }, m))) }) }), _jsx(Field, { label: "Notes", hint: "Optional.", children: _jsx(TextInput, { value: notes, onChange: (e) => setNotes(e.target.value) }) }), _jsx(Button, { disabled: !catId || !amount, onClick: create, children: "Add expense" })] })) }), cats.length > 0 && (_jsx(Section, { title: "New category", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "flex-1", children: _jsx(TextInput, { "aria-label": "New category name", placeholder: "e.g. Packaging", value: newCat, onChange: (e) => setNewCat(e.target.value) }) }), _jsx(Button, { variant: "secondary", disabled: !newCat.trim(), onClick: addCategory, children: "Add" })] }) }))] }), _jsx(Section, { title: "Recent expenses", children: loading ? (_jsx(Spinner, { label: "Loading expenses\u2026" })) : items.length === 0 ? (_jsx(EmptyState, { title: "No expenses yet", hint: "Record your first cost on the left." })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Category', 'Date', 'Method', 'Amount'], children: items.map((x) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-3 py-2 first:pl-0", children: [x.category_name ?? '', x.notes && (_jsx("p", { className: "text-xs text-gray-400", children: x.notes }))] }), _jsx("td", { className: "px-3 py-2 text-right text-gray-500", children: x.expense_date }), _jsx("td", { className: "px-3 py-2 text-right capitalize text-gray-500", children: x.payment_method }), _jsx("td", { className: "px-3 py-2 text-right font-medium last:pr-0", children: formatPHP(x.amount) })] }, x.id))) }), _jsx(ListFooter, { count: items.length, noun: "expense" })] })) })] })] }));
}
