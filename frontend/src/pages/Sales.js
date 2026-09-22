import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { Badge, Button, EmptyState, Field, ListFooter, Modal, PageHeader, SearchInput, Section, Spinner, Table, TextInput, toast, } from '../components/ui';
const FILTERS = ['All', 'Completed', 'Voided'];
export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');
    const [voiding, setVoiding] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [shifts, setShifts] = useState([]);
    useEffect(() => {
        api
            .get('/sales')
            .then((r) => setSales(r.data.data))
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
        api
            .get('/shifts')
            .then((r) => setShifts(r.data.data ?? []))
            .catch(() => undefined);
    }, []);
    const open = async (id) => {
        setMsg('');
        try {
            const res = await api.get(`/sales/${id}`);
            setDetail(res.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not open sale');
        }
    };
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return sales.filter((s) => (filter === 'All' || s.status === filter.toUpperCase()) &&
            (!q || s.receipt_number.toLowerCase().includes(q)));
    }, [sales, search, filter]);
    const submitVoid = async () => {
        if (!detail || !voidReason.trim())
            return;
        setMsg('');
        try {
            await api.post(`/sales/${detail.id}/void`, { reason: voidReason.trim() });
            setVoiding(false);
            setVoidReason('');
            toast('success', 'Sale voided — stock restored');
            const res = await api.get(`/sales/${detail.id}`);
            setDetail(res.data.data);
            const list = await api.get('/sales');
            setSales(list.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Void failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Sales history", sub: "Receipts, payments, and voids", actions: _jsx("div", { className: "flex flex-wrap gap-2", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f), "aria-pressed": filter === f, className: `h-9 rounded-full px-3 text-[13px] ${filter === f ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-600'}`, children: f }, f))) }) }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(Section, { title: "Receipts", action: _jsx("div", { className: "w-56", children: _jsx(SearchInput, { label: "Search receipts", placeholder: "Search receipt no.", value: search, onChange: setSearch }) }), children: loading ? (_jsx(Spinner, { label: "Loading sales\u2026" })) : visible.length === 0 ? (_jsx(EmptyState, { title: search || filter !== 'All' ? 'No sales match' : 'No sales yet', hint: search || filter !== 'All' ? 'Clear search or filters.' : 'Completed sales appear here.' })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Receipt', 'Total', 'Status'], children: visible.map((s) => (_jsxs("tr", { className: detail?.id === s.id ? 'bg-primary-soft/50' : '', children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: _jsx("button", { className: "font-medium text-primary", onClick: () => open(s.id), children: s.receipt_number }) }), _jsx("td", { className: "px-3 py-2 text-right", children: formatPHP(s.total) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsx(Badge, { tone: s.status === 'COMPLETED' ? 'green' : 'gray', children: s.status }) })] }, s.id))) }), _jsx(ListFooter, { count: visible.length, noun: "receipt" })] })) }), _jsx(Section, { title: detail ? `Receipt ${detail.receipt_number}` : 'Receipt detail', action: detail?.status === 'COMPLETED' ? (_jsx(Button, { size: "compact", variant: "danger", onClick: () => setVoiding(true), children: "Void sale" })) : undefined, children: detail ? (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Item', 'Qty', 'Total'], children: (detail.items ?? []).map((i) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: i.product_name_snapshot }), _jsxs("td", { className: "px-3 py-2 text-right", children: [i.unit_quantity ?? i.quantity, " ", i.unit_name ?? 'pc'] }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(i.line_total) })] }, i.id))) }), _jsxs("p", { className: "mt-3 flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-500", children: "Total" }), _jsx("span", { className: "font-semibold", children: formatPHP(detail.total) })] }), (detail.tax_amount ?? 0) > 0 && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "flex justify-between text-[13px] text-gray-500", children: [_jsx("span", { children: "VATABLE SALES" }), _jsx("span", { children: formatPHP(Math.round(((detail.vatable_amount ?? 0) - detail.tax_amount) * 100) / 100) })] }), _jsxs("p", { className: "flex justify-between text-[13px] text-gray-500", children: [_jsxs("span", { children: ["VAT (", detail.tax_rate ?? 12, "%)"] }), _jsx("span", { children: formatPHP(detail.tax_amount) })] }), _jsxs("p", { className: "flex justify-between text-[13px] text-gray-500", children: [_jsx("span", { children: "VAT EXEMPT" }), _jsx("span", { children: formatPHP(Math.round((detail.total - (detail.vatable_amount ?? 0)) * 100) / 100) })] })] })), (detail.payments ?? []).map((p) => (_jsxs("p", { className: "flex justify-between text-[13px] text-gray-500", children: [_jsx("span", { className: "capitalize", children: p.payment_method }), _jsx("span", { children: formatPHP(p.amount) })] }, p.id))), detail.status === 'VOIDED' && (_jsxs("p", { className: "mt-2 text-[13px] text-gray-500", children: ["Voided", detail.void_reason ? `: ${detail.void_reason}` : ''] }))] })) : (_jsx(EmptyState, { title: "No receipt selected", hint: "Pick a receipt on the left." })) })] }), _jsx("div", { className: "mt-4", children: _jsx(Section, { title: "Shifts", action: _jsxs("span", { className: "text-[13px] text-gray-500", children: [shifts.length, " shift", shifts.length === 1 ? '' : 's'] }), children: shifts.length === 0 ? (_jsx("p", { className: "py-2 text-sm text-gray-400", children: "No shifts yet \u2014 open one from the POS register." })) : (_jsx(Table, { head: ['Opened', 'Float', 'Closed', 'Expected', 'Counted', 'Variance'], children: shifts.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: new Date(s.opened_at).toLocaleString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    }) }), _jsx("td", { className: "px-3 py-2 text-right", children: formatPHP(s.opening_float ?? 0) }), _jsx("td", { className: "px-3 py-2 text-right", children: s.closed_at
                                        ? new Date(s.closed_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })
                                        : (_jsx(Badge, { tone: "green", children: "OPEN" })) }), _jsx("td", { className: "px-3 py-2 text-right", children: s.expected_cash != null ? formatPHP(s.expected_cash) : '—' }), _jsx("td", { className: "px-3 py-2 text-right", children: s.counted_cash != null ? formatPHP(s.counted_cash) : '—' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: s.variance != null ? (_jsx(Badge, { tone: Number(s.variance) === 0 ? 'green' : 'red', children: formatPHP(s.variance) })) : ('—') })] }, s.id))) })) }) }), voiding && (_jsxs(Modal, { title: "Void this sale?", onClose: () => setVoiding(false), children: [_jsx("p", { className: "text-sm text-gray-600", children: "The sale stays in history as voided and its stock is restored. This cannot be undone." }), _jsxs("div", { className: "mt-3 grid gap-3", children: [_jsx(Field, { label: "Reason", hint: "Required \u2014 recorded in the audit log.", children: _jsx(TextInput, { value: voidReason, onChange: (e) => setVoidReason(e.target.value), placeholder: "e.g. wrong item scanned" }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setVoiding(false), children: "Cancel" }), _jsx(Button, { variant: "danger", disabled: !voidReason.trim(), onClick: submitVoid, children: "Void sale" })] })] })] }))] }));
}
