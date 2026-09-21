import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { Badge, Button, Field, PageHeader, Section, Select, Table, TextInput } from '../components/ui';
import { useInventory, useProducts } from '../hooks/useCatalog';
export default function InventoryPage() {
    // Shared keys: product list comes from the same cache as POS (no extra
    // request); stock list is the store-scoped inventory cache.
    const inventoryQ = useInventory();
    const productsQ = useProducts();
    const qc = useQueryClient();
    const rows = inventoryQ.data ?? [];
    const products = productsQ.data ?? [];
    const [productId, setProductId] = useState('');
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState('');
    const [msg, setMsg] = useState('');
    const adjustM = useMutation({
        mutationFn: () => api.post('/inventory/adjust', {
            product_id: productId,
            quantity: Number(qty),
            movement_type: Number(qty) >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
            reason: reason.trim(),
        }),
        onSuccess: () => {
            setProductId('');
            setQty('');
            setReason('');
            setMsg('');
            qc.invalidateQueries({ queryKey: qk.inventory });
        },
        onError: (e) => setMsg(e.response?.data?.error?.message ?? 'Adjust failed'),
    });
    const err = msg || (inventoryQ.error ? 'Could not load inventory.' : '');
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Inventory", sub: "Stock levels and adjustments by store" }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs(Section, { title: "Adjust stock", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Product", children: _jsxs(Select, { value: productId, onChange: (e) => setProductId(e.target.value), children: [_jsx("option", { value: "", children: "Select product\u2026" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Quantity", hint: "Positive receives stock, negative removes it.", children: _jsx(TextInput, { placeholder: "+/- qty", value: qty, onChange: (e) => setQty(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Reason", children: _jsx(TextInput, { placeholder: "Required, e.g. delivery from supplier", value: reason, onChange: (e) => setReason(e.target.value) }) }), _jsx(Button, { disabled: adjustM.isPending || !productId || !qty || !reason.trim(), onClick: () => adjustM.mutate(), children: adjustM.isPending ? 'Adjusting…' : 'Adjust stock' })] }), err && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: err })] }), _jsxs(Section, { title: "Stock levels", children: [_jsx(Table, { head: ['Product', 'On hand', 'Status'], children: rows.map((r) => {
                                    const low = (r.reorder_level ?? 0) > 0 && r.quantity <= (r.reorder_level ?? 0);
                                    return (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name ?? r.product_id }), _jsx("td", { className: "px-3 py-2 text-right", children: r.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: r.quantity <= 0 ? (_jsx(Badge, { tone: "red", children: "Out of stock" })) : low ? (_jsx(Badge, { tone: "amber", children: "Low" })) : (_jsx(Badge, { tone: "green", children: "OK" })) })] }, r.product_id));
                                }) }), rows.length === 0 && !inventoryQ.isPending && (_jsx("p", { className: "py-2 text-sm text-gray-400", children: "No stock rows yet." }))] })] })] }));
}
