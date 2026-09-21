import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useProducts } from '../hooks/useCatalog';
export default function ProductsPage() {
    // Shared with POS: one network request no matter which pages mount.
    const { data: items = [], error } = useProducts();
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [msg, setMsg] = useState('');
    const createM = useMutation({
        mutationFn: () => api.post('/products', { name, retail_price: Number(price) }),
        onSuccess: () => {
            setName('');
            setPrice('');
            setMsg('');
            // Writers invalidate; readers (here + POS) refetch once on next read.
            qc.invalidateQueries({ queryKey: qk.products });
        },
        onError: (e) => setMsg(e.response?.data?.error?.message ?? 'Create failed'),
    });
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: "Products" }), _jsxs("div", { className: "mt-4 grid gap-6 lg:grid-cols-[320px_1fr]", children: [_jsxs("section", { className: "h-fit rounded-xl border bg-white p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Add product" }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsx("input", { className: "rounded-lg border p-2", placeholder: "Name", value: name, onChange: (e) => setName(e.target.value) }), _jsx("input", { className: "rounded-lg border p-2", placeholder: "Price", value: price, onChange: (e) => setPrice(e.target.value), inputMode: "decimal" }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-white disabled:opacity-40", disabled: createM.isPending, onClick: () => createM.mutate(), children: createM.isPending ? 'Adding…' : 'Add' })] }), (msg || error) && (_jsx("p", { className: "mt-2 text-sm text-red-600", children: msg || 'Could not load products.' }))] }), _jsx("section", { className: "rounded-xl border bg-white p-4", children: _jsx("ul", { className: "divide-y", children: items.map((p) => (_jsxs("li", { className: "flex justify-between py-2", children: [_jsx("span", { children: p.name }), _jsx("span", { className: "truncate text-xs text-gray-400", children: p.id.slice(0, 8) }), _jsxs("span", { children: ["\u20B1", Number(p.retail_price).toFixed(2)] })] }, p.id))) }) })] })] }));
}
