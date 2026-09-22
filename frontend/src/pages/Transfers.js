import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Badge, Button, EmptyState, Field, ListFooter, PageHeader, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
import { useProducts } from '../hooks/useCatalog';
const TONE = {
    DRAFT: 'gray',
    IN_TRANSIT: 'amber',
    RECEIVED: 'green',
    CANCELLED: 'red',
};
export default function TransfersPage() {
    const [stores, setStores] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
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
    }, []);
    const storeName = (id) => stores.find((s) => s.id === id)?.name ?? id.slice(0, 8);
    const productName = (id) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
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
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Stock Transfers", sub: "Move stock between your stores" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), loading ? (_jsx(Spinner, { label: "Loading transfers\u2026" })) : (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[300px_1fr_1fr]", children: [_jsx("div", { className: "grid content-start gap-4", children: _jsx(Section, { title: "New transfer", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "From store", children: _jsxs(Select, { value: from, onChange: (e) => setFrom(e.target.value), children: [_jsx("option", { value: "", children: "Select source\u2026" }), stores.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }), _jsx(Field, { label: "To store", children: _jsxs(Select, { value: to, onChange: (e) => setTo(e.target.value), children: [_jsx("option", { value: "", children: "Select destination\u2026" }), stores
                                                    .filter((s) => s.id !== from)
                                                    .map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }), _jsxs("div", { className: "grid grid-cols-[1fr_64px_auto] items-end gap-2", children: [_jsx(Field, { label: "Product", children: _jsxs(Select, { value: product, onChange: (e) => setProduct(e.target.value), children: [_jsx("option", { value: "", children: "\u2026" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Qty", children: _jsx(TextInput, { value: qty, onChange: (e) => setQty(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { variant: "secondary", onClick: addLine, children: "Add" })] }), lines.length > 0 && (_jsx("ul", { className: "divide-y text-sm", children: lines.map((l) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsx("span", { children: productName(l.product_id) }), _jsxs("span", { children: [l.quantity, ' ', _jsx("button", { className: "ml-2 text-xs text-red-600", onClick: () => setLines(lines.filter((x) => x.product_id !== l.product_id)), children: "remove" })] })] }, l.product_id))) })), _jsx(Button, { disabled: !from || !to || lines.length === 0, onClick: submit, children: "Draft transfer" }), stores.length < 2 && (_jsx("p", { className: "text-[13px] text-gray-500", children: "You need at least two stores to transfer stock." }))] }) }) }), _jsx(Section, { title: "Transfers", action: _jsxs("span", { className: "text-[13px] text-gray-500", children: [transfers.length, " transfer", transfers.length === 1 ? '' : 's'] }), children: transfers.length === 0 ? (_jsx(EmptyState, { title: "No transfers yet", hint: "Draft one to move stock between stores." })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Ref', 'Route', 'Status'], children: transfers.map((t) => (_jsxs("tr", { className: "cursor-pointer hover:bg-gray-50", onClick: () => open(t.id), children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: t.reference_no }), _jsxs("td", { className: "px-3 py-2 text-sm", children: [storeName(t.from_store_id), " \u2192 ", storeName(t.to_store_id)] }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsx(Badge, { tone: TONE[t.status] ?? 'gray', children: t.status }) })] }, t.id))) }), _jsx(ListFooter, { count: transfers.length, noun: "transfer" })] })) }), _jsx(Section, { title: "Detail", children: !detail ? (_jsx(EmptyState, { title: "Nothing selected", hint: "Open a transfer to act on it." })) : (_jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-semibold", children: detail.reference_no }), _jsx(Badge, { tone: TONE[detail.status] ?? 'gray', children: detail.status })] }), _jsxs("p", { className: "text-sm text-gray-600", children: [storeName(detail.from_store_id), " \u2192 ", storeName(detail.to_store_id)] }), _jsx(Table, { head: ['Product', 'Qty'], children: (detail.items ?? []).map((i) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: productName(i.product_id) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: i.quantity })] }, i.id))) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [detail.status === 'DRAFT' && (_jsxs(_Fragment, { children: [_jsx(Button, { onClick: () => act(detail.id, 'dispatch'), children: "Dispatch" }), _jsx(Button, { variant: "secondary", onClick: () => act(detail.id, 'cancel'), children: "Cancel" })] })), detail.status === 'IN_TRANSIT' && (_jsx(Button, { onClick: () => act(detail.id, 'receive'), children: "Confirm receipt" }))] }), detail.status === 'IN_TRANSIT' && (_jsxs("p", { className: "text-[13px] text-gray-500", children: ["Stock has left ", storeName(detail.from_store_id), " and is in transit \u2014 it cannot be sold until ", storeName(detail.to_store_id), " confirms receipt."] }))] })) })] }))] }));
}
