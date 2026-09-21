import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
export default function InventoryPage() {
    const [rows, setRows] = useState([]);
    const [productId, setProductId] = useState('');
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState('');
    const [msg, setMsg] = useState('');
    const load = async () => {
        const res = await api.get('/inventory');
        setRows(res.data.data);
    };
    useEffect(() => {
        load().catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
    }, []);
    const adjust = async () => {
        setMsg('');
        try {
            await api.post('/inventory/adjust', {
                product_id: productId,
                quantity: Number(qty),
                movement_type: Number(qty) >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
                reason: reason || 'manual adjustment',
            });
            setProductId('');
            setQty('');
            setReason('');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Adjust failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-bold", children: "Inventory" }), _jsxs("div", { className: "mt-4 grid gap-6 lg:grid-cols-[320px_1fr]", children: [_jsxs("section", { className: "h-fit rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Adjust stock" }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsx("input", { className: "rounded-lg border p-2", placeholder: "Product ID", value: productId, onChange: (e) => setProductId(e.target.value) }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "+/- qty", value: qty, onChange: (e) => setQty(e.target.value), inputMode: "decimal" }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Reason (required)", value: reason, onChange: (e) => setReason(e.target.value) }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-white", onClick: adjust, children: "Adjust stock" })] }), msg && _jsx("p", { className: "mt-2 text-sm", children: msg })] }), _jsx("section", { className: "rounded-xl border bg-white p-4", children: _jsx("ul", { className: "divide-y", children: rows.map((r) => (_jsxs("li", { className: "flex justify-between py-2", children: [_jsx("span", { children: r.product_name ?? r.product_id }), _jsx("span", { children: r.quantity })] }, r.product_id))) }) })] })] }));
}
