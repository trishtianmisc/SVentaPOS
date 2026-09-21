import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useProducts } from '../hooks/useCatalog';
import { Button, EmptyState, Field, ListFooter, Modal, PageHeader, SearchInput, Section, Spinner, Table, TextInput, toast, } from '../components/ui';
import { formatPHP } from '../utils/currency';
export default function ProductsPage() {
    // Shared with POS: one network request no matter which pages mount.
    const { data: items = [], error, isPending } = useProducts();
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [msg, setMsg] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [editCost, setEditCost] = useState('');
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return items;
        return items.filter((p) => p.name.toLowerCase().includes(q) ||
            (p.barcode ?? '').toLowerCase().includes(q));
    }, [items, search]);
    const createM = useMutation({
        mutationFn: () => api.post('/products', { name, retail_price: Number(price) }),
        onSuccess: () => {
            setName('');
            setPrice('');
            setMsg('');
            toast('success', 'Product created');
            // Writers invalidate; readers (here + POS) refetch once on next read.
            qc.invalidateQueries({ queryKey: qk.products });
        },
        onError: (e) => setMsg(e.response?.data?.error?.message ?? 'Create failed'),
    });
    const openEdit = (p) => {
        setEditing(p);
        setEditPrice(String(p.retail_price ?? ''));
        setEditCost(String(p.cost_price ?? ''));
    };
    const saveEdit = async () => {
        if (!editing)
            return;
        setMsg('');
        try {
            await api.put(`/products/${editing.id}`, {
                retail_price: Number(editPrice),
                cost_price: editCost === '' ? undefined : Number(editCost),
            });
            setEditing(null);
            toast('success', 'Price updated');
            qc.invalidateQueries({ queryKey: qk.products });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Update failed');
        }
    };
    const deactivate = async (p) => {
        if (!window.confirm(`Deactivate ${p.name}? It stays in past sales history.`))
            return;
        setMsg('');
        try {
            await api.delete(`/products/${p.id}`);
            toast('success', 'Product deactivated');
            qc.invalidateQueries({ queryKey: qk.products });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Deactivate failed');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Products", sub: "Manage your product catalog", actions: _jsxs("span", { className: "text-[13px] text-gray-500", children: [items.length, " product", items.length === 1 ? '' : 's'] }) }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs(Section, { title: "Add product", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Name", children: _jsx(TextInput, { value: name, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { label: "Retail price (\u20B1)", children: _jsx(TextInput, { value: price, onChange: (e) => setPrice(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { disabled: createM.isPending, onClick: () => createM.mutate(), children: createM.isPending ? 'Adding…' : 'Add product' })] }), msg && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: msg })] }), _jsx(Section, { title: "Catalog", action: _jsx("div", { className: "w-56", children: _jsx(SearchInput, { label: "Search products", placeholder: "Search name or barcode", value: search, onChange: setSearch }) }), children: isPending ? (_jsx(Spinner, { label: "Loading products\u2026" })) : error ? (_jsx("p", { className: "py-2 text-sm text-red-600", children: "Could not load products." })) : visible.length === 0 ? (_jsx(EmptyState, { title: search ? 'No products match' : 'No products yet', hint: search ? 'Try a different search.' : 'Add your first product on the left.' })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Product', 'Price', 'Barcode', ''], children: visible.map((p) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-3 py-2 first:pl-0", children: [_jsx("p", { className: "font-medium", children: p.name }), _jsx("p", { className: "text-xs text-gray-400", children: p.id.slice(0, 8) })] }), _jsx("td", { className: "px-3 py-2 text-right", children: formatPHP(p.retail_price) }), _jsx("td", { className: "px-3 py-2 text-right text-gray-500", children: p.barcode ?? '—' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsxs("span", { className: "inline-flex gap-1", children: [_jsx(Button, { size: "compact", variant: "secondary", onClick: () => openEdit(p), children: "Edit" }), _jsx(Button, { size: "compact", variant: "ghost", onClick: () => deactivate(p), children: "Off" })] }) })] }, p.id))) }), _jsx(ListFooter, { count: visible.length, noun: "product" })] })) })] }), editing && (_jsx(Modal, { title: `Edit ${editing.name}`, onClose: () => setEditing(null), children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Retail price (\u20B1)", children: _jsx(TextInput, { value: editPrice, onChange: (e) => setEditPrice(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Cost price (\u20B1)", hint: "Used for profit reports.", children: _jsx(TextInput, { value: editCost, onChange: (e) => setEditCost(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { onClick: saveEdit, children: "Save changes" })] }) }))] }));
}
