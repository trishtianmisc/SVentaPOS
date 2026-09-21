import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { Badge, Button, EmptyState, Field, PageHeader, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
import { useProducts } from '../hooks/useCatalog';
export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
    // New PO draft.
    const [poSupplier, setPoSupplier] = useState('');
    const [poProduct, setPoProduct] = useState('');
    const [poQty, setPoQty] = useState('');
    const [poCost, setPoCost] = useState('');
    const [poLines, setPoLines] = useState([]);
    const { data: products = [] } = useProducts();
    const load = async () => {
        const [s, p] = await Promise.all([api.get('/suppliers'), api.get('/purchase-orders')]);
        setSuppliers(s.data.data);
        setPos(p.data.data);
    };
    useEffect(() => {
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
    }, []);
    const create = async () => {
        setMsg('');
        try {
            await api.post('/suppliers', { name });
            setName('');
            toast('success', 'Supplier added');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    const open = async (id) => {
        setMsg('');
        try {
            const res = await api.get(`/purchase-orders/${id}`);
            setDetail(res.data.data);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not open PO');
        }
    };
    const act = async (id, action) => {
        setMsg('');
        try {
            await api.post(`/purchase-orders/${id}/${action}`);
            toast('success', action === 'approve' ? 'PO ordered' : 'PO cancelled');
            await load();
            await open(id);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Action failed');
        }
    };
    const addLine = () => {
        if (!poProduct || !poQty || Number(poQty) <= 0)
            return;
        const p = products.find((x) => x.id === poProduct);
        setPoLines([
            ...poLines,
            {
                product_id: poProduct,
                name: p?.name ?? poProduct,
                quantity: Number(poQty),
                unit_cost: Number(poCost || 0),
            },
        ]);
        setPoProduct('');
        setPoQty('');
        setPoCost('');
    };
    const submitPO = async () => {
        if (!poSupplier || poLines.length === 0)
            return;
        setMsg('');
        try {
            await api.post('/purchase-orders', {
                supplier_id: poSupplier,
                items: poLines.map((l) => ({
                    product_id: l.product_id,
                    quantity: l.quantity,
                    unit_cost: l.unit_cost,
                })),
            });
            setPoLines([]);
            setPoSupplier('');
            toast('success', 'Purchase order created as draft');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'PO create failed');
        }
    };
    const receiveAll = async () => {
        if (!detail)
            return;
        setMsg('');
        try {
            await api.post(`/purchase-orders/${detail.id}/receive`, {
                lines: detail.items
                    .filter((i) => i.received_qty < i.quantity)
                    .map((i) => ({ item_id: i.id, quantity: i.quantity - i.received_qty })),
            });
            toast('success', 'Stock received');
            await load();
            await open(detail.id);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Receive failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Suppliers & Purchasing", sub: "Suppliers, orders, and receiving" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), loading ? (_jsx(Spinner, { label: "Loading purchasing\u2026" })) : (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[300px_1fr_1fr]", children: [_jsxs("div", { className: "grid content-start gap-4", children: [_jsxs(Section, { title: "Suppliers", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "flex-1", children: _jsx(TextInput, { "aria-label": "Supplier name", placeholder: "Supplier name", value: name, onChange: (e) => setName(e.target.value) }) }), _jsx(Button, { disabled: !name.trim(), onClick: create, children: "Add" })] }), _jsxs("ul", { className: "mt-2 divide-y text-sm", children: [suppliers.map((s) => (_jsx("li", { className: "py-2", children: s.name }, s.id))), suppliers.length === 0 && (_jsx("li", { className: "py-2 text-sm text-gray-400", children: "No suppliers yet." }))] })] }), _jsx(Section, { title: "New purchase order", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Supplier", children: _jsxs(Select, { value: poSupplier, onChange: (e) => setPoSupplier(e.target.value), children: [_jsx("option", { value: "", children: "Select supplier\u2026" }), suppliers.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }), _jsxs("div", { className: "grid grid-cols-[1fr_64px_72px_auto] items-end gap-2", children: [_jsx(Field, { label: "Product", children: _jsxs(Select, { value: poProduct, onChange: (e) => setPoProduct(e.target.value), children: [_jsx("option", { value: "", children: "\u2026" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Qty", children: _jsx(TextInput, { value: poQty, onChange: (e) => setPoQty(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Cost", children: _jsx(TextInput, { value: poCost, onChange: (e) => setPoCost(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { variant: "secondary", onClick: addLine, children: "+" })] }), poLines.length > 0 && (_jsx("ul", { className: "divide-y text-[13px]", children: poLines.map((l, i) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsxs("span", { children: [l.name, " \u00D7 ", l.quantity] }), _jsx("span", { children: formatPHP(l.quantity * l.unit_cost) })] }, i))) })), _jsx(Button, { disabled: !poSupplier || poLines.length === 0, onClick: submitPO, children: "Create draft PO" })] }) })] }), _jsx(Section, { title: "Purchase orders", action: _jsxs("span", { className: "text-[13px] text-gray-500", children: [pos.length, " order", pos.length === 1 ? '' : 's'] }), children: pos.length === 0 ? (_jsx(EmptyState, { title: "No purchase orders", hint: "Create a draft on the left." })) : (_jsx(Table, { head: ['PO', 'Status', 'Total'], children: pos.map((p) => (_jsxs("tr", { className: detail?.id === p.id ? 'bg-primary-soft/50' : '', children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: _jsx("button", { className: "font-medium text-primary", onClick: () => open(p.id), children: p.po_number }) }), _jsx("td", { className: "px-3 py-2 text-right", children: _jsx(Badge, { tone: p.status === 'RECEIVED' ? 'green' : p.status === 'CANCELLED' ? 'gray' : 'amber', children: p.status }) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: formatPHP(p.total) })] }, p.id))) })) }), _jsx(Section, { title: detail ? `${detail.po_number} · ${detail.status}` : 'Order detail', children: detail ? (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Line', 'Ordered', 'Got'], children: detail.items?.map((i) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-3 py-2 first:pl-0 text-[13px]", children: ["@ ", formatPHP(i.unit_cost)] }), _jsx("td", { className: "px-3 py-2 text-right", children: i.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: i.received_qty })] }, i.id))) }), _jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2", children: [_jsx(Button, { variant: "secondary", size: "compact", onClick: () => act(detail.id, 'approve'), children: "Order" }), _jsx(Button, { size: "compact", onClick: receiveAll, children: "Receive all" }), _jsx(Button, { variant: "secondary", size: "compact", onClick: () => act(detail.id, 'cancel'), children: "Cancel" })] })] })) : (_jsx(EmptyState, { title: "No order selected", hint: "Pick an order to approve, receive, or cancel." })) })] }))] }));
}
