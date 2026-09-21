import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { Badge, Button, EmptyState, Field, ListFooter, Modal, PageHeader, SearchInput, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
const PAY_METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other'];
export default function CustomersPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [limit, setLimit] = useState('');
    const [detail, setDetail] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [payAmt, setPayAmt] = useState('');
    const [payMethod, setPayMethod] = useState('cash');
    const [msg, setMsg] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [editPhone, setEditPhone] = useState('');
    const [editLimit, setEditLimit] = useState('');
    const load = async (q = '') => {
        const res = await api.get('/customers', { params: q ? { search: q } : {} });
        setItems(res.data.data);
    };
    useEffect(() => {
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        const t = setTimeout(() => {
            load(search).catch(() => undefined);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);
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
            toast('success', 'Customer added');
            await load(search);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    const open = async (id) => {
        setMsg('');
        try {
            const [d, l] = await Promise.all([
                api.get(`/customers/${id}`),
                api.get(`/customers/${id}/ledger`),
            ]);
            setDetail(d.data.data);
            setLedger(l.data.data);
            setPayAmt('');
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not open customer');
        }
    };
    const pay = async () => {
        if (!detail)
            return;
        setMsg('');
        try {
            await api.post(`/customers/${detail.id}/payment`, {
                amount: Number(payAmt),
                method: payMethod,
            });
            toast('success', 'Payment recorded');
            await open(detail.id);
            await load(search);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Payment failed');
        }
    };
    const openEdit = (c) => {
        setEditing(c);
        setEditPhone(c.phone ?? '');
        setEditLimit(c.credit_limit != null ? String(c.credit_limit) : '');
    };
    const saveEdit = async () => {
        if (!editing)
            return;
        setMsg('');
        try {
            await api.put(`/customers/${editing.id}`, {
                phone: editPhone || undefined,
                credit_limit: editLimit === '' ? null : Number(editLimit),
            });
            setEditing(null);
            toast('success', 'Customer updated');
            await open(editing.id);
            await load(search);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Update failed');
        }
    };
    const visible = useMemo(() => items, [items]);
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Customers & Utang", sub: "Balances, ledger, and payments" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[300px_1fr_1fr]", children: [_jsx(Section, { title: "Add customer", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Name", children: _jsx(TextInput, { value: name, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { label: "Phone", hint: "Optional.", children: _jsx(TextInput, { value: phone, onChange: (e) => setPhone(e.target.value) }) }), _jsx(Field, { label: "Credit limit (\u20B1)", hint: "Optional. Empty means no limit.", children: _jsx(TextInput, { value: limit, onChange: (e) => setLimit(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { disabled: !name.trim(), onClick: create, children: "Add customer" })] }) }), _jsx(Section, { title: "Balances", action: _jsx("div", { className: "w-48", children: _jsx(SearchInput, { label: "Search customers", placeholder: "Search name", value: search, onChange: setSearch }) }), children: loading ? (_jsx(Spinner, { label: "Loading customers\u2026" })) : visible.length === 0 ? (_jsx(EmptyState, { title: search ? 'No customers match' : 'No customers yet', hint: search ? 'Try a different search.' : 'Add your first customer on the left.' })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Customer', 'Balance', ''], children: visible.map((c) => (_jsxs("tr", { className: detail?.id === c.id ? 'bg-primary-soft/50' : '', children: [_jsxs("td", { className: "px-3 py-2 first:pl-0", children: [_jsx("button", { className: "text-left font-medium text-primary", onClick: () => open(c.id), children: c.name }), _jsxs("p", { className: "text-xs text-gray-400", children: [c.phone ?? 'No phone', c.credit_limit != null && ` · limit ${formatPHP(c.credit_limit)}`] })] }), _jsx("td", { className: "px-3 py-2 text-right", children: c.balance > 0 ? (_jsx(Badge, { tone: "amber", children: formatPHP(c.balance) })) : (_jsx("span", { className: "text-gray-400", children: formatPHP(0) })) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsx(Button, { size: "compact", variant: "secondary", onClick: () => openEdit(c), children: "Edit" }) })] }, c.id))) }), _jsx(ListFooter, { count: visible.length, noun: "customer" })] })) }), _jsx(Section, { title: detail ? detail.name : 'Ledger', children: detail ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Outstanding: ", _jsx("span", { className: "font-semibold", children: formatPHP(detail.balance) })] }), _jsxs("div", { className: "mt-3 grid gap-3", children: [_jsx(Field, { label: "Payment amount (\u20B1)", children: _jsx(TextInput, { value: payAmt, onChange: (e) => setPayAmt(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Method", children: _jsx(Select, { value: payMethod, onChange: (e) => setPayMethod(e.target.value), children: PAY_METHODS.map((m) => (_jsx("option", { value: m, className: "capitalize", children: m }, m))) }) }), _jsx(Button, { disabled: !payAmt || Number(payAmt) <= 0, onClick: pay, children: "Record payment" })] }), _jsx(Table, { head: ['Type', 'Amount'], children: ledger.map((e) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0 text-[13px]", children: e.transaction_type }), _jsx("td", { className: `px-3 py-2 text-right last:pr-0 ${Number(e.amount) < 0 ? 'text-green-700' : ''}`, children: formatPHP(e.amount) })] }, e.id))) })] })) : (_jsx(EmptyState, { title: "No customer selected", hint: "Pick a customer for ledger and payments." })) })] }), editing && (_jsx(Modal, { title: `Edit ${editing.name}`, onClose: () => setEditing(null), children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Phone", children: _jsx(TextInput, { value: editPhone, onChange: (e) => setEditPhone(e.target.value) }) }), _jsx(Field, { label: "Credit limit (\u20B1)", hint: "Leave as-is to keep the current limit.", children: _jsx(TextInput, { value: editLimit, onChange: (e) => setEditLimit(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { onClick: saveEdit, children: "Save changes" })] }) }))] }));
}
