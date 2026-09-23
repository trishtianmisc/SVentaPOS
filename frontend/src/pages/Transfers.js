import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { Badge, Button, Field, ListFooter, Modal, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
import { KpiCard } from '../components/KpiCard';
import { useProducts } from '../hooks/useCatalog';
import { useSessionStore } from '../stores/session';
const TONE = {
    DRAFT: 'gray',
    IN_TRANSIT: 'amber',
    RECEIVED: 'green',
    CANCELLED: 'red',
};
export default function TransfersPage() {
    const storeId = useSessionStore((s) => s.storeId);
    const [stores, setStores] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showFilter, setShowFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');
    // New draft.
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [product, setProduct] = useState('');
    const [qty, setQty] = useState('');
    const [lines, setLines] = useState([]);
    const { data: products = [] } = useProducts();
    const load = async () => {
        const [s, t] = await Promise.all([api.get('/stores'), api.get('/transfers')]);
        setStores(s.data.data ?? []);
        setTransfers(t.data.data ?? []);
    };
    useEffect(() => {
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (stores.length >= 2 && !from) {
            const preferred = storeId || stores[0]?.id;
            if (preferred)
                setFrom(preferred);
            const other = stores.find((s) => s.id !== preferred);
            if (other)
                setTo(other.id);
        }
    }, [stores, storeId, from]);
    const storeName = (id) => stores.find((s) => s.id === id)?.name ?? id.slice(0, 8);
    const productName = (id) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
    const pending = transfers.filter((t) => t.status === 'DRAFT').length;
    const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
    const completed = transfers.filter((t) => t.status === 'RECEIVED').length;
    const unitsMoved = useMemo(() => {
        return transfers
            .filter((t) => t.status === 'RECEIVED')
            .reduce((sum, t) => sum +
            (t.items ?? []).reduce((n, i) => n + (Number(i.quantity) || 0), 0), 0);
    }, [transfers]);
    const filtered = transfers.filter((t) => {
        if (statusFilter && t.status !== statusFilter)
            return false;
        if (showFilter === 'incoming' && t.to_store_id !== storeId)
            return false;
        if (showFilter === 'outgoing' && t.from_store_id !== storeId)
            return false;
        return true;
    });
    const addLine = () => {
        if (!product || !qty || Number(qty) <= 0)
            return;
        if (lines.some((l) => l.product_id === product)) {
            setMsg('Product already in this transfer');
            return;
        }
        setLines([...lines, { product_id: product, quantity: Number(qty) }]);
        setProduct('');
        setQty('');
        setMsg('');
    };
    const resetDraft = () => {
        setLines([]);
        setProduct('');
        setQty('');
        setMsg('');
        if (stores.length >= 2) {
            const preferred = storeId || stores[0]?.id;
            setFrom(preferred);
            setTo(stores.find((s) => s.id !== preferred)?.id ?? '');
        }
        else {
            setFrom('');
            setTo('');
        }
    };
    const openNew = () => {
        resetDraft();
        setShowNew(true);
    };
    const submit = async () => {
        if (!from || !to || lines.length === 0)
            return;
        setMsg('');
        try {
            const res = await api.post('/transfers', {
                from_store_id: from,
                to_store_id: to,
                items: lines,
            });
            setLines([]);
            toast('success', `Transfer ${res.data.data.reference_no} drafted`);
            setShowNew(false);
            await load();
            setDetail(res.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    const open = async (id) => {
        setMsg('');
        try {
            const res = await api.get(`/transfers/${id}`);
            setDetail(res.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not open transfer');
        }
    };
    const act = async (id, action) => {
        setMsg('');
        try {
            const res = await api.post(`/transfers/${id}/${action}`);
            setDetail(res.data.data);
            toast('success', action === 'dispatch'
                ? 'Transfer dispatched'
                : action === 'receive'
                    ? 'Transfer received'
                    : 'Transfer cancelled');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Action failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsxs("div", { className: "mb-6 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#e8c86a]", children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("path", { d: "M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" }), _jsx("path", { d: "M7 7h4v4M17 17h-4v-4" })] }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight text-gray-900 dark:text-white", children: "Transfers" }), _jsx("p", { className: "mt-0.5 text-sm text-gray-500 dark:text-[#9b958c]", children: "Move stock between branches." })] })] }), _jsxs("button", { type: "button", onClick: openNew, disabled: stores.length < 2, className: "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45", children: [_jsx("span", { "aria-hidden": true, children: "\uFF0B" }), " New Transfer"] })] }), _jsxs("div", { className: "mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiCard, { tone: "amber", label: "Pending", value: String(pending), hint: "Awaiting approval", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 7v5l3 2" })] }) }), _jsx(KpiCard, { tone: "blue", label: "In transit", value: String(inTransit), hint: "On the way", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("path", { d: "M3 7h11v10H3zM14 10h4l3 3v4h-7" }), _jsx("circle", { cx: "7", cy: "18", r: "2" }), _jsx("circle", { cx: "17", cy: "18", r: "2" })] }) }), _jsx(KpiCard, { tone: "green", label: "Completed", value: String(completed), hint: "All time", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "m8 12 3 3 5-6" })] }) }), _jsx(KpiCard, { tone: "teal", label: "Units moved", value: String(unitsMoved), hint: "All time", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("path", { d: "M21 8 12 3 3 8l9 5 9-5Z" }), _jsx("path", { d: "M3 8v8l9 5 9-5V8" }), _jsx("path", { d: "M12 13v8" })] }) })] }), _jsxs("div", { className: "mb-5 flex flex-wrap items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6f6a62]", children: "Show:" }), _jsx("div", { className: "inline-flex h-10 items-center rounded-full bg-gray-100 p-1 dark:bg-[#1a1a1e]", children: [
                                    ['all', 'All'],
                                    ['incoming', 'Incoming'],
                                    ['outgoing', 'Outgoing'],
                                ].map(([v, label]) => (_jsx("button", { type: "button", "aria-pressed": showFilter === v, onClick: () => setShowFilter(v), className: `h-8 rounded-full px-4 text-sm font-semibold ${showFilter === v
                                        ? 'bg-primary text-white shadow'
                                        : 'text-gray-600 dark:text-[#9b958c]'}`, children: label }, v))) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6f6a62]", children: "Status:" }), _jsxs(Select, { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "h-10 w-40", "aria-label": "Status filter", children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "DRAFT", children: "Draft" }), _jsx("option", { value: "IN_TRANSIT", children: "In transit" }), _jsx("option", { value: "RECEIVED", children: "Received" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" })] })] })] }), msg && (_jsx("p", { className: "mb-4 text-[13px] text-red-600 dark:text-[#f0a090]", children: msg })), loading ? (_jsx("div", { className: "rounded-3xl border border-gray-200 bg-white p-6 dark:border-[#1e1e22] dark:bg-[#121214]", children: _jsx(Spinner, { label: "Loading transfers\u2026" }) })) : (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[1fr_360px]", children: [_jsx(Section, { children: filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center rounded-3xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-[#2a2a2e]", children: [_jsx("span", { "aria-hidden": true, className: "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#e8c86a]", children: _jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("path", { d: "M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" }), _jsx("path", { d: "M7 7h4v4M17 17h-4v-4" })] }) }), _jsx("p", { className: "text-[15px] text-gray-700 dark:text-[#c9c3b8]", children: transfers.length === 0
                                        ? 'Create your first transfer to move stock between branches.'
                                        : 'No transfers match these filters.' }), transfers.length === 0 && (_jsxs("button", { type: "button", onClick: openNew, disabled: stores.length < 2, className: "mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-45", children: [_jsx("span", { "aria-hidden": true, children: "\uFF0B" }), " New Transfer"] })), stores.length < 2 && (_jsx("p", { className: "mt-3 text-[13px] text-gray-500 dark:text-[#6f6a62]", children: "You need at least two stores to transfer stock." }))] })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Ref', 'Route', 'Status'], children: filtered.map((t) => (_jsxs("tr", { className: "cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0e0e10]", onClick: () => open(t.id), children: [_jsx("td", { className: "px-3 py-2.5 first:pl-0", children: t.reference_no }), _jsxs("td", { className: "px-3 py-2.5 text-sm", children: [storeName(t.from_store_id), " \u2192 ", storeName(t.to_store_id)] }), _jsx("td", { className: "px-3 py-2.5 text-right last:pr-0", children: _jsx(Badge, { tone: TONE[t.status] ?? 'gray', children: t.status }) })] }, t.id))) }), _jsx(ListFooter, { count: filtered.length, noun: "transfer" })] })) }), _jsx(Section, { title: "Detail", children: !detail ? (_jsxs("div", { className: "py-6 text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-700 dark:text-[#c9c3b8]", children: "Nothing selected" }), _jsx("p", { className: "mt-1 text-[13px] text-gray-400 dark:text-[#6f6a62]", children: "Open a transfer to act on it." })] })) : (_jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-semibold dark:text-white", children: detail.reference_no }), _jsx(Badge, { tone: TONE[detail.status] ?? 'gray', children: detail.status })] }), _jsxs("p", { className: "text-sm text-gray-600 dark:text-[#9b958c]", children: [storeName(detail.from_store_id), " \u2192 ", storeName(detail.to_store_id)] }), _jsx(Table, { head: ['Product', 'Qty'], children: (detail.items ?? []).map((i) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: productName(i.product_id) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: i.quantity })] }, i.id))) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [detail.status === 'DRAFT' && (_jsxs(_Fragment, { children: [_jsx(Button, { onClick: () => act(detail.id, 'dispatch'), children: "Dispatch" }), _jsx(Button, { variant: "secondary", onClick: () => act(detail.id, 'cancel'), children: "Cancel" })] })), detail.status === 'IN_TRANSIT' && (_jsx(Button, { onClick: () => act(detail.id, 'receive'), children: "Confirm receipt" }))] }), detail.status === 'IN_TRANSIT' && (_jsxs("p", { className: "text-[13px] text-gray-500 dark:text-[#6f6a62]", children: ["Stock has left ", storeName(detail.from_store_id), " and is in transit \u2014 it cannot be sold until ", storeName(detail.to_store_id), " confirms receipt."] }))] })) })] })), showNew && (_jsx(Modal, { title: "New Transfer", onClose: () => setShowNew(false), wide: true, children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "From store", children: _jsxs(Select, { value: from, onChange: (e) => setFrom(e.target.value), children: [_jsx("option", { value: "", children: "Select source\u2026" }), stores.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }), _jsx(Field, { label: "To store", children: _jsxs(Select, { value: to, onChange: (e) => setTo(e.target.value), children: [_jsx("option", { value: "", children: "Select destination\u2026" }), stores
                                        .filter((s) => s.id !== from)
                                        .map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }), _jsxs("div", { className: "grid grid-cols-[1fr_72px_auto] items-end gap-2", children: [_jsx(Field, { label: "Product", children: _jsxs(Select, { value: product, onChange: (e) => setProduct(e.target.value), children: [_jsx("option", { value: "", children: "\u2026" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Qty", children: _jsx(TextInput, { value: qty, onChange: (e) => setQty(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { variant: "secondary", onClick: addLine, children: "Add" })] }), lines.length > 0 && (_jsx("ul", { className: "divide-y divide-gray-100 text-sm dark:divide-[#1a1a1e]", children: lines.map((l) => (_jsxs("li", { className: "flex justify-between py-1.5", children: [_jsx("span", { children: productName(l.product_id) }), _jsxs("span", { children: [l.quantity, ' ', _jsx("button", { className: "ml-2 text-xs text-red-600 dark:text-[#f0a090]", onClick: () => setLines(lines.filter((x) => x.product_id !== l.product_id)), children: "remove" })] })] }, l.product_id))) })), msg && (_jsx("p", { className: "text-[13px] text-red-600 dark:text-[#f0a090]", children: msg })), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx(Button, { className: "flex-1", disabled: !from || !to || lines.length === 0, onClick: submit, children: "Draft transfer" }), _jsx(Button, { variant: "secondary", onClick: () => setShowNew(false), children: "Cancel" })] }), stores.length < 2 && (_jsx("p", { className: "text-[13px] text-gray-500 dark:text-[#6f6a62]", children: "You need at least two stores to transfer stock." }))] }) }))] }));
}
