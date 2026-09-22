import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useCategories, useInventory, useProducts, } from '../hooks/useCatalog';
import { Badge, Button, EmptyState, Field, ListFooter, Modal, SearchInput, Section, Select, Spinner, TextInput, toast, } from '../components/ui';
import { formatPHP } from '../utils/currency';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore } from '../stores/session';
function stockStatus(p, qty) {
    if (!p.track_inventory)
        return 'active';
    const q = qty ?? 0;
    if (q <= 0)
        return 'out';
    const threshold = Math.max(p.minimum_stock ?? 0, p.reorder_level ?? 0);
    if (threshold > 0 && q <= threshold)
        return 'low';
    return 'active';
}
function formatDate(iso) {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
    });
}
function exportCsv(rows) {
    const header = [
        'Name',
        'SKU',
        'Barcode',
        'Brand',
        'Category',
        'Cost',
        'Price',
        'Wholesale',
        'Min stock',
        'Reorder',
        'Stock',
        'Status',
        'VAT exempt',
        'Active',
    ];
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
        header.join(','),
        ...rows.map((r) => [
            r.product.name,
            r.product.sku,
            r.product.barcode,
            r.product.brand,
            r.categoryName,
            r.product.cost_price,
            r.product.retail_price,
            r.product.wholesale_price ?? '',
            r.product.minimum_stock ?? 0,
            r.product.reorder_level ?? 0,
            r.stock ?? '',
            r.status,
            r.product.vat_exempt ? 'yes' : 'no',
            r.product.active === false ? 'no' : 'yes',
        ]
            .map(esc)
            .join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
function ProductThumb({ product }) {
    const [broken, setBroken] = useState(false);
    return (_jsx("span", { "aria-hidden": "true", className: "relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-900 text-gray-400", children: product.image_path && !broken ? (_jsx("img", { src: product.image_path, alt: "", className: "h-full w-full object-cover", onError: () => setBroken(true) })) : (_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }), _jsx("circle", { cx: "9", cy: "11", r: "2" }), _jsx("path", { d: "m21 16-5-5-4 4-2-2-5 5" })] })) }));
}
function StatusBadge({ status }) {
    if (status === 'out')
        return _jsx(Badge, { tone: "red", children: "Out" });
    if (status === 'low')
        return _jsx(Badge, { tone: "amber", children: "Low" });
    return _jsx(Badge, { tone: "green", children: "Active" });
}
export default function ProductsPage() {
    const { data: items = [], error, isPending } = useProducts();
    const { data: categories = [] } = useCategories();
    const { data: inventory = [] } = useInventory();
    const userId = useAuthStore((s) => s.userId);
    const storeId = useSessionStore((s) => s.storeId);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [popularOnly, setPopularOnly] = useState(false);
    const [view, setView] = useState('list');
    const [selected, setSelected] = useState(new Set());
    const [menuFor, setMenuFor] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [editCost, setEditCost] = useState('');
    const [editExempt, setEditExempt] = useState(false);
    const [msg, setMsg] = useState('');
    const [unitsFor, setUnitsFor] = useState(null);
    const [units, setUnits] = useState([]);
    const [unitName, setUnitName] = useState('');
    const [unitFactor, setUnitFactor] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    // Top sellers → Popular badge/filter (best-effort; 403 on free plan is fine).
    const popularQ = useQuery({
        queryKey: ['reports', 'products', storeId ?? 'none', userId ?? 'anon'],
        queryFn: () => api.get('/reports/products').then((r) => r.data.data ?? []),
        staleTime: 5 * 60000,
        enabled: !!userId && !!storeId,
        retry: false,
    });
    const popularIds = useMemo(() => {
        const list = popularQ.data ?? [];
        return new Set(list
            .filter((r) => (r.quantity ?? 0) > 0)
            .map((r) => String(r.product_id)));
    }, [popularQ.data]);
    const catName = useMemo(() => {
        const m = new Map(categories.map((c) => [c.id, c.name]));
        return (id) => (id ? (m.get(id) ?? '—') : '—');
    }, [categories]);
    const stockByProduct = useMemo(() => {
        const m = new Map();
        for (const r of inventory)
            m.set(r.product_id, r.quantity ?? 0);
        return m;
    }, [inventory]);
    const rows = useMemo(() => items.map((p) => {
        const stock = p.track_inventory ? (stockByProduct.get(p.id) ?? 0) : null;
        return {
            product: p,
            stock,
            status: stockStatus(p, stock),
            categoryName: catName(p.category_id),
            popular: popularIds.has(p.id),
        };
    }), [items, stockByProduct, catName, popularIds]);
    const stats = useMemo(() => ({
        total: rows.length,
        low: rows.filter((r) => r.status === 'low').length,
        out: rows.filter((r) => r.status === 'out').length,
        popular: rows.filter((r) => r.popular).length,
    }), [rows]);
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            const p = r.product;
            if (q &&
                !p.name.toLowerCase().includes(q) &&
                !(p.barcode ?? '').toLowerCase().includes(q) &&
                !(p.sku ?? '').toLowerCase().includes(q) &&
                !(p.brand ?? '').toLowerCase().includes(q)) {
                return false;
            }
            if (categoryFilter !== 'all' && p.category_id !== categoryFilter) {
                return false;
            }
            if (statusFilter !== 'all' && r.status !== statusFilter)
                return false;
            if (popularOnly && !r.popular)
                return false;
            return true;
        });
    }, [rows, search, categoryFilter, statusFilter, popularOnly]);
    const hasFilters = search.trim() !== '' ||
        categoryFilter !== 'all' ||
        statusFilter !== 'all' ||
        popularOnly;
    const clearFilters = () => {
        setSearch('');
        setCategoryFilter('all');
        setStatusFilter('all');
        setPopularOnly(false);
    };
    useEffect(() => {
        if (!menuFor)
            return;
        const close = () => setMenuFor(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menuFor]);
    const openEditPage = (p) => {
        setMenuFor(null);
        navigate(`/products/${p.id}/edit`);
    };
    const openQuickEdit = (p) => {
        setMenuFor(null);
        setEditing(p);
        setEditPrice(String(p.retail_price ?? ''));
        setEditCost(String(p.cost_price ?? ''));
        setEditExempt(!!p.vat_exempt);
        setMsg('');
    };
    const saveEdit = async () => {
        if (!editing)
            return;
        setMsg('');
        try {
            await api.put(`/products/${editing.id}`, {
                retail_price: Number(editPrice),
                cost_price: editCost === '' ? undefined : Number(editCost),
                vat_exempt: editExempt,
            });
            setEditing(null);
            toast('success', 'Product updated');
            qc.invalidateQueries({ queryKey: qk.products });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Update failed');
        }
    };
    const deactivate = async (p) => {
        setMenuFor(null);
        if (!window.confirm(`Deactivate ${p.name}? It stays in past sales history.`)) {
            return;
        }
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
    const openUnits = async (p) => {
        setMenuFor(null);
        setUnitsFor(p);
        setMsg('');
        try {
            const res = await api.get(`/products/${p.id}/units`);
            setUnits(res.data.data ?? []);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not load units');
        }
    };
    const addUnit = async () => {
        if (!unitsFor || !unitName.trim() || Number(unitFactor) <= 0)
            return;
        setMsg('');
        try {
            await api.post(`/products/${unitsFor.id}/units`, {
                unit_name: unitName.trim(),
                conversion_factor: Number(unitFactor),
                selling_price: unitPrice === '' ? undefined : Number(unitPrice),
            });
            setUnitName('');
            setUnitFactor('');
            setUnitPrice('');
            const res = await api.get(`/products/${unitsFor.id}/units`);
            setUnits(res.data.data ?? []);
            toast('success', 'Unit added');
            qc.invalidateQueries({ queryKey: qk.units });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Add unit failed');
        }
    };
    const delUnit = async (u) => {
        if (!unitsFor || !window.confirm(`Remove unit "${u.unit_name}"?`))
            return;
        setMsg('');
        try {
            await api.delete(`/products/${unitsFor.id}/units/${u.id}`);
            setUnits(units.filter((x) => x.id !== u.id));
            toast('success', 'Unit removed');
            qc.invalidateQueries({ queryKey: qk.units });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Remove failed');
        }
    };
    const toggleAll = () => {
        if (selected.size === visible.length && visible.length > 0) {
            setSelected(new Set());
        }
        else {
            setSelected(new Set(visible.map((r) => r.product.id)));
        }
    };
    const toggleOne = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const thCls = 'px-3 py-2.5 text-left text-xs font-medium text-gray-500 first:pl-0 last:pr-0';
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": "true", className: "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700", children: _jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M5 7h14l-1.4 13H6.4L5 7Z" }), _jsx("path", { d: "M9 7V6a3 3 0 0 1 6 0v1" })] }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight md:text-2xl", children: "Product Management" }), _jsx("p", { className: "mt-0.5 text-[13px] text-gray-500", children: "Manage inventory and product catalog" })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => exportCsv(visible), disabled: visible.length === 0, children: "\u2193 Export" }), _jsx(Button, { variant: "secondary", title: "More actions", onClick: () => setMsg(''), children: "\u00B7\u00B7\u00B7 More" }), _jsx(Button, { onClick: () => navigate('/products/new'), children: "+ Add" })] })] }), msg && (_jsx("p", { className: "mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700", children: msg })), _jsxs("div", { className: "mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4", children: [_jsxs("button", { type: "button", onClick: clearFilters, className: `flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${statusFilter === 'all' && !popularOnly && !search && categoryFilter === 'all'
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`, children: [_jsx("span", { className: "text-red-500", "aria-hidden": "true", children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M5 7h14l-1.4 13H6.4L5 7Z" }), _jsx("path", { d: "M9 7V6a3 3 0 0 1 6 0v1" })] }) }), _jsxs("span", { className: "text-sm text-gray-600", children: [_jsx("strong", { className: "mr-1 text-base font-semibold text-gray-900", children: stats.total }), "Products"] })] }), _jsxs("button", { type: "button", onClick: () => setStatusFilter(statusFilter === 'low' ? 'all' : 'low'), className: `flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${statusFilter === 'low'
                            ? 'border-gray-300 bg-gray-100'
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`, children: [_jsx("span", { className: "text-gray-500", "aria-hidden": "true", children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M12 3 2 20h20L12 3Z" }), _jsx("path", { d: "M12 10v4" }), _jsx("path", { d: "M12 17h.01" })] }) }), _jsxs("span", { className: "text-sm text-gray-600", children: [_jsx("strong", { className: "mr-1 text-base font-semibold text-gray-900", children: stats.low }), "Low"] })] }), _jsxs("button", { type: "button", onClick: () => setStatusFilter(statusFilter === 'out' ? 'all' : 'out'), className: `flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${statusFilter === 'out'
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`, children: [_jsx("span", { className: "text-red-400", "aria-hidden": "true", children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 8v5" }), _jsx("path", { d: "M12 16h.01" })] }) }), _jsxs("span", { className: "text-sm text-gray-600", children: [_jsx("strong", { className: "mr-1 text-base font-semibold text-gray-900", children: stats.out }), "Out"] })] }), _jsxs("button", { type: "button", onClick: () => setPopularOnly((v) => !v), className: `flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${popularOnly
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`, "aria-pressed": popularOnly, children: [_jsx("span", { className: "text-red-400", "aria-hidden": "true", children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M3 17l6-6 4 4 8-8" }), _jsx("path", { d: "M14 7h7v7" })] }) }), _jsxs("span", { className: "text-sm text-gray-600", children: [_jsx("strong", { className: "mr-1 text-base font-semibold text-gray-900", children: stats.popular }), "Popular"] })] })] }), _jsxs(Section, { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("div", { className: "min-w-[200px] flex-1", children: _jsx(SearchInput, { label: "Search products", placeholder: "Search products, names, or barcodes\u2026", value: search, onChange: setSearch }) }), _jsx("div", { className: "w-44", children: _jsxs(Select, { "aria-label": "Category", value: categoryFilter, onChange: (e) => setCategoryFilter(e.target.value), children: [_jsxs("option", { value: "all", children: ["All Categories", categories.length ? ` (${categories.length})` : ''] }), categories.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }) }), _jsx("div", { className: "w-36", children: _jsxs(Select, { "aria-label": "Status", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "active", children: "In stock" }), _jsx("option", { value: "low", children: "Low stock" }), _jsx("option", { value: "out", children: "Out of stock" })] }) }), _jsx("button", { type: "button", onClick: () => setPopularOnly((v) => !v), className: `inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${popularOnly
                                    ? 'border-primary bg-primary-soft text-primary-ink'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`, "aria-pressed": popularOnly, children: "\u2606 Popular" }), _jsxs("div", { className: "ml-auto inline-flex overflow-hidden rounded-lg border border-gray-300", role: "group", "aria-label": "View mode", children: [_jsx("button", { type: "button", "aria-label": "Grid view", "aria-pressed": view === 'grid', onClick: () => setView('grid'), className: `h-11 w-11 text-sm ${view === 'grid'
                                            ? 'bg-primary text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'}`, children: "\u25A6" }), _jsx("button", { type: "button", "aria-label": "List view", "aria-pressed": view === 'list', onClick: () => setView('list'), className: `h-11 w-11 text-sm ${view === 'list'
                                            ? 'bg-primary text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'}`, children: "\u2630" })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 font-medium text-gray-700", children: [_jsx("span", { "aria-hidden": "true", children: "\u2691" }), "Filters"] }), hasFilters && (_jsx("button", { type: "button", onClick: clearFilters, className: "font-medium text-gray-700 underline-offset-2 hover:underline", children: "Clear all" })), _jsx("button", { type: "button", onClick: () => setStatusFilter(statusFilter === 'low' ? 'all' : 'low'), className: statusFilter === 'low'
                                    ? 'font-semibold text-primary'
                                    : 'text-gray-700 hover:text-gray-900', children: "Low stock" }), _jsx("button", { type: "button", onClick: () => setStatusFilter(statusFilter === 'out' ? 'all' : 'out'), className: statusFilter === 'out'
                                    ? 'font-semibold text-primary'
                                    : 'text-gray-700 hover:text-gray-900', children: "Out of stock" }), _jsxs("span", { className: "ml-auto text-gray-500", children: ["Showing ", visible.length, " of ", rows.length, " products"] })] })] }), _jsx("div", { className: "mt-4", children: isPending ? (_jsx(Spinner, { label: "Loading products\u2026" })) : error ? (_jsx("p", { className: "py-2 text-sm text-red-600", children: "Could not load products." })) : visible.length === 0 ? (_jsx(EmptyState, { title: hasFilters ? 'No products match' : 'No products yet', hint: hasFilters
                        ? 'Try different filters or clear all.'
                        : 'Add your first product to get started.' })) : view === 'list' ? (_jsxs(Section, { children: [_jsx("div", { className: "-mx-4 overflow-x-auto px-4", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-200", children: [_jsx("th", { scope: "col", className: `${thCls} w-10`, children: _jsx("input", { type: "checkbox", "aria-label": "Select all", checked: visible.length > 0 && selected.size === visible.length, onChange: toggleAll }) }), _jsx("th", { scope: "col", className: thCls, children: "Product \u21C5" }), _jsx("th", { scope: "col", className: thCls, children: "Category \u21C5" }), _jsx("th", { scope: "col", className: `${thCls} text-right`, children: "Price \u21C5" }), _jsx("th", { scope: "col", className: `${thCls} text-right`, children: "Stock \u21C5" }), _jsx("th", { scope: "col", className: thCls, children: "Status \u21C5" }), _jsx("th", { scope: "col", className: `${thCls} text-right`, children: "ACTIONS" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: visible.map((r) => {
                                            const p = r.product;
                                            return (_jsxs("tr", { className: "hover:bg-gray-50/80", children: [_jsx("td", { className: "px-3 py-3 first:pl-0", children: _jsx("input", { type: "checkbox", "aria-label": `Select ${p.name}`, checked: selected.has(p.id), onChange: () => toggleOne(p.id) }) }), _jsx("td", { className: "px-3 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "relative", children: [_jsx(ProductThumb, { product: p }), p.track_inventory && (_jsx("span", { className: `absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${r.status === 'out'
                                                                                ? 'bg-red-500'
                                                                                : r.status === 'low'
                                                                                    ? 'bg-amber-400'
                                                                                    : 'bg-emerald-500'}` }))] }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium text-gray-900", children: p.name }), _jsxs("p", { className: "truncate text-xs text-gray-400", children: [formatDate(p.created_at) || p.id.slice(0, 8), p.vat_exempt && ' · VAT-exempt'] })] })] }) }), _jsx("td", { className: "px-3 py-3", children: _jsx(Badge, { tone: "brand", children: r.categoryName }) }), _jsx("td", { className: "px-3 py-3 text-right font-medium", children: formatPHP(p.retail_price) }), _jsx("td", { className: "px-3 py-3 text-right", children: r.stock == null ? (_jsx("span", { className: "text-gray-400", children: "\u2014" })) : r.status === 'low' || r.status === 'out' ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-amber-700", children: [_jsx("span", { "aria-hidden": "true", children: "\u26A0" }), r.stock] })) : (_jsx("span", { children: r.stock })) }), _jsx("td", { className: "px-3 py-3", children: _jsx(StatusBadge, { status: r.status }) }), _jsxs("td", { className: "relative px-3 py-3 text-right last:pr-0", children: [_jsx("button", { type: "button", "aria-label": `Actions for ${p.name}`, onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setMenuFor(menuFor === p.id ? null : p.id);
                                                                }, className: "rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-500 hover:bg-gray-100", children: "\u00B7\u00B7\u00B7" }), menuFor === p.id && (_jsxs("div", { onClick: (e) => e.stopPropagation(), className: "absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg", children: [_jsx("button", { type: "button", className: "block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50", onClick: () => openQuickEdit(p), children: "Quick edit" }), _jsx("button", { type: "button", className: "block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50", onClick: () => openEditPage(p), children: "Full edit" }), _jsx("button", { type: "button", className: "block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50", onClick: () => openUnits(p), children: "Sell units" }), _jsx("button", { type: "button", className: "block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50", onClick: () => deactivate(p), children: "Deactivate" })] }))] })] }, p.id));
                                        }) })] }) }), _jsx(ListFooter, { count: visible.length, noun: "product" })] })) : (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: visible.map((r) => {
                        const p = r.product;
                        return (_jsxs("article", { className: "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm", children: [_jsx("div", { className: "mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-gray-500", children: p.image_path ? (_jsx("img", { src: p.image_path, alt: "", className: "h-full w-full object-cover", onError: (e) => {
                                            e.currentTarget.style.display = 'none';
                                        } })) : (_jsxs("svg", { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }), _jsx("circle", { cx: "9", cy: "11", r: "2" }), _jsx("path", { d: "m21 16-5-5-4 4-2-2-5 5" })] })) }), _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium text-gray-900", children: p.name }), _jsx("p", { className: "text-xs text-gray-400", children: formatDate(p.created_at) })] }), _jsx(StatusBadge, { status: r.status })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between", children: [_jsx(Badge, { tone: "brand", children: r.categoryName }), _jsx("span", { className: "font-semibold", children: formatPHP(p.retail_price) })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between border-t border-gray-100 pt-3", children: [_jsxs("span", { className: "text-sm text-gray-600", children: ["Stock: ", _jsx("strong", { children: r.stock == null ? '—' : r.stock })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { size: "compact", variant: "secondary", onClick: () => openEditPage(p), children: "Edit" }), _jsx(Button, { size: "compact", variant: "ghost", onClick: () => deactivate(p), children: "Off" })] })] })] }, p.id));
                    }) })) }), selected.size > 0 && (_jsxs("div", { className: "fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg md:bottom-6", children: [_jsxs("span", { className: "text-sm text-gray-600", children: [selected.size, " selected"] }), _jsx(Button, { size: "compact", variant: "ghost", onClick: () => setSelected(new Set()), children: "Clear" }), _jsx(Button, { size: "compact", variant: "secondary", onClick: () => exportCsv(rows.filter((r) => selected.has(r.product.id))), children: "Export selected" })] })), unitsFor && (_jsx(Modal, { title: `Units — ${unitsFor.name}`, onClose: () => setUnitsFor(null), children: _jsxs("div", { className: "grid gap-3", children: [_jsx("p", { className: "text-[13px] text-gray-500", children: "Base unit is \u201Cpc\u201D. Add alternates like \u201Ccase of 12\u201D: 1 case deducts 12 from stock. Leave price blank for linear pricing (base \u00D7 12)." }), units.length === 0 ? (_jsx("p", { className: "text-sm text-gray-400", children: "No extra units yet." })) : (_jsx("div", { className: "-mx-4 overflow-x-auto px-4", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-200 text-xs text-gray-500", children: [_jsx("th", { className: "px-3 py-2 font-medium first:pl-0", children: "Unit" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Factor" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Price" }), _jsx("th", { className: "px-3 py-2 last:pr-0" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: units.map((u) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: u.unit_name }), _jsxs("td", { className: "px-3 py-2 text-right", children: ["\u00D7", u.conversion_factor] }), _jsx("td", { className: "px-3 py-2 text-right", children: u.selling_price != null
                                                        ? formatPHP(u.selling_price)
                                                        : 'linear' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsx(Button, { size: "compact", variant: "ghost", onClick: () => delUnit(u), children: "Remove" }) })] }, u.id))) })] }) })), _jsxs("div", { className: "grid grid-cols-[1fr_72px_88px_auto] items-end gap-2", children: [_jsx(Field, { label: "Unit", children: _jsx(TextInput, { placeholder: "case", value: unitName, onChange: (e) => setUnitName(e.target.value) }) }), _jsx(Field, { label: "Factor", children: _jsx(TextInput, { placeholder: "12", value: unitFactor, onChange: (e) => setUnitFactor(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Price \u20B1", children: _jsx(TextInput, { placeholder: "optional", value: unitPrice, onChange: (e) => setUnitPrice(e.target.value), inputMode: "decimal" }) }), _jsx(Button, { variant: "secondary", disabled: !unitName.trim() || Number(unitFactor) <= 0, onClick: addUnit, children: "Add" })] }), msg && _jsx("p", { className: "text-[13px] text-red-600", children: msg })] }) })), editing && (_jsx(Modal, { title: `Quick edit — ${editing.name}`, onClose: () => setEditing(null), children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Retail price (\u20B1)", children: _jsx(TextInput, { value: editPrice, onChange: (e) => setEditPrice(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Cost price (\u20B1)", hint: "Used for profit reports.", children: _jsx(TextInput, { value: editCost, onChange: (e) => setEditCost(e.target.value), inputMode: "decimal" }) }), _jsxs("label", { className: "flex items-center gap-2 text-[13px] text-gray-600", children: [_jsx("input", { type: "checkbox", checked: editExempt, onChange: (e) => setEditExempt(e.target.checked) }), "VAT exempt (excluded from the VAT base)"] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        const id = editing.id;
                                        setEditing(null);
                                        navigate(`/products/${id}/edit`);
                                    }, children: "Full form" }), _jsx(Button, { onClick: saveEdit, children: "Save changes" })] }), msg && _jsx("p", { className: "text-[13px] text-red-600", children: msg })] }) }))] }));
}
