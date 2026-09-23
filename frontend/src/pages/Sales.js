import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { saleDayKey, parseSaleDate } from '../utils/receipt';
import { usePermissions } from '../hooks/usePermissions';
import { useSessionStore } from '../stores/session';
import { Receipt } from '../components/Receipt';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, SearchInput, Select, Spinner, TextInput, toast, } from '../components/ui';
const DATE_TABS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'all', label: 'All Time' },
    { key: 'custom', label: 'Custom' },
];
const PAY_METHODS = [
    { value: '', label: 'All methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'gcash', label: 'GCash' },
    { value: 'maya', label: 'Maya' },
    { value: 'card', label: 'Card' },
    { value: 'bank', label: 'Bank' },
    { value: 'other', label: 'Other' },
    { value: 'utang', label: 'Utang' },
];
function isoDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function dayOffset(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d;
}
function rangeFor(tab, customFrom, customTo) {
    const today = new Date();
    switch (tab) {
        case 'today':
            return { from: isoDay(today), to: isoDay(today) };
        case 'yesterday':
            return { from: isoDay(dayOffset(1)), to: isoDay(dayOffset(1)) };
        case '7d':
            return { from: isoDay(dayOffset(6)), to: isoDay(today) };
        case '30d':
            return { from: isoDay(dayOffset(29)), to: isoDay(today) };
        case 'custom':
            return {
                from: customFrom || undefined,
                to: customTo || undefined,
            };
        default:
            return { from: undefined, to: undefined };
    }
}
function formatDayChip(key) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const today = isoDay(new Date());
    const yest = isoDay(dayOffset(1));
    if (key === today)
        return `Today · ${dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    if (key === yest)
        return `Yesterday · ${dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return dt.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function formatTime(iso) {
    const d = parseSaleDate(iso);
    if (!d)
        return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function exportCsv(rows) {
    const header = [
        'Receipt',
        'Date',
        'Time',
        'Customer',
        'Items',
        'Payment',
        'Status',
        'Total',
        'Cashier',
    ];
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
        header.join(','),
        ...rows.map((r) => [
            r.receipt_number,
            r.created_at ? isoDay(new Date(r.created_at)) : '',
            formatTime(r.created_at),
            r.customer_name || 'Walk-in',
            r.items_count ?? '',
            r.payment_method ?? '',
            r.status,
            r.total,
            r.cashier_name ?? '',
        ]
            .map(esc)
            .join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${isoDay(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
function StatCard({ label, value, sub, }) {
    return (_jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-4", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-gray-500", children: label }), _jsx("p", { className: "mt-1 text-xl font-semibold text-gray-900", children: value }), sub && _jsx("p", { className: "mt-0.5 text-xs text-gray-400", children: sub })] }));
}
function statusTone(status) {
    if (status === 'COMPLETED')
        return 'green';
    if (status === 'VOIDED')
        return 'red';
    if (status === 'REFUNDED')
        return 'amber';
    return 'gray';
}
export default function SalesPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [tab, setTab] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [type, setType] = useState('all');
    const [method, setMethod] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [voiding, setVoiding] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [reportsOpen, setReportsOpen] = useState(false);
    const [storeLabel, setStoreLabel] = useState('');
    const storeId = useSessionStore((s) => s.storeId);
    const storeVersion = useSessionStore((s) => s.storeVersion);
    const { role, isOwner } = usePermissions();
    const canVoid = isOwner || role === 'owner' || role === 'manager' || role == null;
    useEffect(() => {
        api
            .get('/stores')
            .then((r) => {
            const list = r.data.data ?? [];
            const active = storeId
                ? list.find((s) => s.id === storeId)
                : list[0];
            const code = active?.code ?? active?.name;
            setStoreLabel(code ? `Store ${code}` : 'Store');
        })
            .catch(() => setStoreLabel('Store'));
    }, [storeId, storeVersion]);
    const load = async (opts) => {
        if (!opts?.silent)
            setLoading(true);
        setMsg('');
        try {
            const { from, to } = rangeFor(tab, customFrom, customTo);
            const params = { limit: 500 };
            if (from)
                params.from = from;
            if (to)
                params.to = to;
            if (method)
                params.payment_method = method;
            if (status)
                params.status = status;
            if (search.trim())
                params.q = search.trim();
            const res = await api.get('/sales', { params });
            setRows(res.data.data ?? []);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Load failed');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, customFrom, customTo, method, status, storeVersion]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (type !== 'all' && r.status === 'VOIDED')
                return false;
            if (q && !r.receipt_number.toLowerCase().includes(q))
                return false;
            if (status && r.status !== status)
                return false;
            if (method && (r.payment_method || '') !== method)
                return false;
            return true;
        });
    }, [rows, search, type, status, method]);
    const stats = useMemo(() => {
        const completed = filtered.filter((r) => r.status === 'COMPLETED');
        const revenue = completed.reduce((s, r) => s + Number(r.total || 0), 0);
        const count = filtered.length;
        return {
            count,
            revenue,
            completed: completed.length,
            avg: completed.length ? revenue / completed.length : 0,
        };
    }, [filtered]);
    const groups = useMemo(() => {
        const map = new Map();
        for (const r of filtered) {
            const key = saleDayKey(r.created_at);
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(r);
        }
        return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [filtered]);
    const openDetail = async (id) => {
        setMsg('');
        try {
            const res = await api.get(`/sales/${id}`);
            setDetail(res.data.data);
            setShowReceipt(true);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not open sale');
        }
    };
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
            await load({ silent: true });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Void failed');
        }
    };
    const dayTotal = (list) => list
        .filter((r) => r.status === 'COMPLETED')
        .reduce((s, r) => s + Number(r.total || 0), 0);
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Transaction Records", sub: "Receipts, payments, and voids", actions: _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "secondary", size: "compact", onClick: () => exportCsv(filtered), children: "Export" }), _jsxs("div", { className: "relative", children: [_jsx(Button, { variant: "secondary", size: "compact", onClick: () => setReportsOpen((v) => !v), "aria-expanded": reportsOpen, children: "Reports \u25BE" }), reportsOpen && (_jsxs("div", { className: "absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg", children: [_jsx("a", { href: "/reports", className: "block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50", onClick: () => setReportsOpen(false), children: "Sales report" }), _jsx("a", { href: "/reports", className: "block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50", onClick: () => setReportsOpen(false), children: "Z-report history" }), _jsx("a", { href: "/shifts", className: "block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50", onClick: () => setReportsOpen(false), children: "Shifts" })] }))] }), _jsx(Button, { size: "compact", onClick: () => load(), children: "\u21BB" })] }) }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsx("div", { className: "mb-4 flex flex-wrap gap-2", children: DATE_TABS.map((t) => (_jsx("button", { type: "button", onClick: () => setTab(t.key), "aria-pressed": tab === t.key, className: `h-9 rounded-full px-3 text-[13px] ${tab === t.key
                        ? 'bg-primary text-white'
                        : 'border border-gray-300 bg-white text-gray-600'}`, children: t.label }, t.key))) }), tab === 'custom' && (_jsxs("div", { className: "mb-4 grid max-w-md grid-cols-2 gap-3", children: [_jsx(Field, { label: "From", children: _jsx(TextInput, { type: "date", value: customFrom, onChange: (e) => setCustomFrom(e.target.value) }) }), _jsx(Field, { label: "To", children: _jsx(TextInput, { type: "date", value: customTo, onChange: (e) => setCustomTo(e.target.value) }) })] })), _jsxs("div", { className: "mb-4 flex flex-wrap items-end gap-3", children: [_jsx("div", { className: "w-56", children: _jsx(SearchInput, { label: "Search receipts", placeholder: "Receipt #", value: search, onChange: setSearch }) }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1.5 block text-sm font-medium text-gray-700", children: "Type" }), _jsxs(Select, { value: type, onChange: (e) => setType(e.target.value), "aria-label": "Transaction type", children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "sale", children: "Sale" })] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1.5 block text-sm font-medium text-gray-700", children: "Payment" }), _jsx(Select, { value: method, onChange: (e) => setMethod(e.target.value), "aria-label": "Payment method", children: PAY_METHODS.map((m) => (_jsx("option", { value: m.value, children: m.label }, m.value))) })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1.5 block text-sm font-medium text-gray-700", children: "Status" }), _jsxs(Select, { value: status, onChange: (e) => setStatus(e.target.value), "aria-label": "Status", children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "COMPLETED", children: "Completed" }), _jsx("option", { value: "VOIDED", children: "Voided" })] })] }), _jsx(Button, { variant: "secondary", size: "compact", onClick: () => load(), children: "Apply" })] }), _jsxs("div", { className: "mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(StatCard, { label: "Transactions", value: String(stats.count) }), _jsx(StatCard, { label: "Revenue", value: formatPHP(stats.revenue), sub: "Completed only" }), _jsx(StatCard, { label: "Completed", value: String(stats.completed) }), _jsx(StatCard, { label: "Avg Value", value: formatPHP(stats.avg) })] }), loading ? (_jsx(Spinner, { label: "Loading transactions\u2026" })) : groups.length === 0 ? (_jsx(EmptyState, { title: search || method || status || tab !== 'all'
                    ? 'No transactions match'
                    : 'No transactions yet', hint: search || method || status || tab !== 'all'
                    ? 'Clear search or adjust filters.'
                    : 'Completed sales appear here after checkout.' })) : (_jsx("div", { className: "space-y-6", children: groups.map(([dayKey, list]) => (_jsxs("div", { className: "overflow-hidden rounded-xl border border-gray-200 bg-white", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700", children: formatDayChip(dayKey) }), _jsxs("span", { className: "text-[13px] text-gray-500", children: [list.length, " transaction", list.length === 1 ? '' : 's'] })] }), _jsx("span", { className: "text-sm font-semibold text-gray-900", children: formatPHP(dayTotal(list)) })] }), _jsx("ul", { className: "divide-y divide-gray-100", children: list.map((s) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50/80", children: [_jsx("span", { "aria-hidden": "true", className: `h-2.5 w-2.5 shrink-0 rounded-full ${s.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-gray-400'}` }), _jsx("span", { className: "w-16 shrink-0 text-sm text-gray-600", children: formatTime(s.created_at) }), _jsx("span", { className: "font-medium text-primary", children: s.receipt_number }), _jsx("span", { className: "min-w-0 flex-1 truncate text-sm text-gray-600", children: s.customer_name || 'Walk-in' }), _jsx("span", { className: "hidden text-[13px] text-gray-400 sm:inline", children: storeLabel || 'Store' }), _jsxs("span", { className: "w-16 text-right text-[13px] text-gray-500", children: [s.items_count ?? 0, " item", (s.items_count ?? 0) === 1 ? '' : 's'] }), _jsx("span", { className: "w-16 text-right text-[13px] capitalize text-gray-500", children: s.payment_method || '—' }), _jsx(Badge, { tone: statusTone(s.status), children: s.status }), _jsx("span", { className: "w-24 text-right font-semibold", children: formatPHP(s.total) }), _jsxs("span", { className: "flex shrink-0 items-center gap-1 print:hidden", children: [_jsx("button", { type: "button", "aria-label": `View receipt ${s.receipt_number}`, title: "View receipt", onClick: () => openDetail(s.id), className: "rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:border-primary hover:text-primary", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": "true", children: [_jsx("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }) }), _jsx("button", { type: "button", "aria-label": `Print receipt ${s.receipt_number}`, title: "Print receipt", onClick: () => openDetail(s.id), className: "rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:border-primary hover:text-primary", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": "true", children: [_jsx("path", { d: "M6 9V2h12v7" }), _jsx("path", { d: "M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" }), _jsx("path", { d: "M6 14h12v8H6z" })] }) })] })] }, s.id))) })] }, dayKey))) })), showReceipt && detail && (_jsx(Receipt, { sale: detail, items: detail.items ?? [], payments: detail.payments ?? [], storeInfo: null, cashierName: detail.cashier_name ?? '', at: parseSaleDate(detail.created_at), onClose: () => setShowReceipt(false), closeLabel: "Close", printLabel: "Print Receipt", footer: _jsxs("div", { className: "mt-5 grid grid-cols-2 gap-2 print:hidden", children: [_jsx("button", { className: "h-10 rounded-lg border border-gray-300 text-sm font-medium", onClick: () => window.print(), children: "Print Receipt" }), _jsx("button", { className: "h-10 rounded-lg border border-gray-300 text-sm font-medium", onClick: () => window.print(), title: "Opens the browser print dialog \u2014 choose Save as PDF", children: "Download PDF" }), canVoid && detail.status === 'COMPLETED' && (_jsx("button", { className: "col-span-2 h-10 rounded-lg bg-red-700 text-sm font-medium text-white hover:bg-red-800", onClick: () => {
                                setShowReceipt(false);
                                setVoiding(true);
                            }, children: "Void" }))] }) })), voiding && (_jsxs(Modal, { title: "Void this sale?", onClose: () => setVoiding(false), children: [_jsx("p", { className: "text-sm text-gray-600", children: "The sale stays in history as voided and its stock is restored. This cannot be undone." }), _jsxs("div", { className: "mt-3 grid gap-3", children: [_jsx(Field, { label: "Reason", hint: "Required \u2014 recorded in the audit log.", children: _jsx(TextInput, { value: voidReason, onChange: (e) => setVoidReason(e.target.value), placeholder: "e.g. wrong item scanned" }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setVoiding(false), children: "Cancel" }), _jsx(Button, { variant: "danger", disabled: !voidReason.trim(), onClick: submitVoid, children: "Void sale" })] })] })] }))] }));
}
