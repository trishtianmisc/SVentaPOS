import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [pos, setPos] = useState([]);
    const [name, setName] = useState('');
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState('');
    const load = async () => {
        const [s, p] = await Promise.all([api.get('/suppliers'), api.get('/purchase-orders')]);
        setSuppliers(s.data.data);
        setPos(p.data.data);
    };
    useEffect(() => {
        load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
    }, []);
    const create = async () => {
        setMsg('');
        try {
            await api.post('/suppliers', { name });
            setName('');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Create failed');
        }
    };
    const open = async (id) => {
        const res = await api.get(`/purchase-orders/${id}`);
        setDetail(res.data.data);
    };
    const act = async (id, action) => {
        setMsg('');
        try {
            await api.post(`/purchase-orders/${id}/${action}`);
            await load();
            await open(id);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Action failed');
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
            await load();
            await open(detail.id);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Receive failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-bold", children: "Suppliers & Purchasing" }), msg && _jsx("p", { className: "mt-2 text-sm text-red-600", children: msg }), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-3", children: [_jsxs("section", { className: "h-fit rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Suppliers" }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("input", { className: "flex-1 rounded-lg border p-2", placeholder: "Supplier name", value: name, onChange: (e) => setName(e.target.value) }), _jsx("button", { className: "rounded-lg bg-teal-700 px-3 text-white", onClick: create, children: "Add" })] }), _jsx("ul", { className: "mt-2 divide-y text-sm", children: suppliers.map((s) => (_jsx("li", { className: "py-2", children: s.name }, s.id))) }), _jsx("p", { className: "mt-3 text-xs text-gray-400", children: "Create a PO from the Products page stock flow \u2014 select a supplier, add lines, then receive here." })] }), _jsxs("section", { className: "rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Purchase orders" }), _jsxs("ul", { className: "mt-2 divide-y text-sm", children: [pos.map((p) => (_jsx("li", { children: _jsxs("button", { className: "flex w-full justify-between py-2 text-left", onClick: () => open(p.id), children: [_jsx("span", { className: "font-medium", children: p.po_number }), _jsx("span", { children: p.status })] }) }, p.id))), pos.length === 0 && _jsx("li", { className: "py-2 text-sm text-gray-400", children: "No purchase orders." })] })] }), _jsx("section", { className: "h-fit rounded-xl border bg-white p-4", children: detail ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "font-bold", children: [detail.po_number, " \u00B7 ", detail.status] }), _jsx("ul", { className: "mt-2 text-sm", children: detail.items?.map((i) => (_jsxs("li", { className: "flex justify-between py-1", children: [_jsxs("span", { children: [i.quantity, " \u00D7 @ ", formatPHP(i.unit_cost)] }), _jsxs("span", { children: ["got ", i.received_qty] })] }, i.id))) }), _jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2", children: [_jsx("button", { className: "rounded-lg border p-2 text-sm", onClick: () => act(detail.id, 'approve'), children: "Order" }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-sm text-white", onClick: receiveAll, children: "Receive all" }), _jsx("button", { className: "rounded-lg border p-2 text-sm", onClick: () => act(detail.id, 'cancel'), children: "Cancel" })] })] })) : (_jsx("p", { className: "text-sm text-gray-400", children: "Select a PO to approve, receive, or cancel." })) })] })] }));
}
