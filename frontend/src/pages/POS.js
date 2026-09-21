import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { formatPHP } from '../utils/currency';
import { Badge } from '../components/ui';
import { useSessionStore } from '../stores/session';
import { useCategories, useCustomers, useInventory, useProducts, } from '../hooks/useCatalog';
const METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other', 'utang'];
const NEEDS_REF = new Set(['gcash', 'maya', 'card', 'bank']);
const QUICK_CASH = [20, 50, 100, 200, 500, 1000];
const TILE_COLORS = [
    'bg-primary-soft text-primary-ink',
    'bg-amber-100 text-amber-800',
    'bg-sky-100 text-sky-800',
    'bg-rose-100 text-rose-800',
    'bg-lime-100 text-lime-800',
    'bg-violet-100 text-violet-800',
];
function tileColor(id) {
    let h = 0;
    for (const c of id)
        h = (h * 31 + c.charCodeAt(0)) % 997;
    return TILE_COLORS[h % TILE_COLORS.length];
}
/** Client mirror of the server wholesale tier (server stays authoritative). */
function unitPrice(p, qty) {
    const w = p.wholesale_price;
    const m = p.wholesale_min_qty;
    if (w != null && m != null && qty >= m)
        return Number(w);
    return Number(p.retail_price);
}
function isWholesale(p, qty) {
    const w = p.wholesale_price;
    const m = p.wholesale_min_qty;
    return w != null && m != null && qty >= m;
}
export default function POSPage() {
    const qc = useQueryClient();
    // Shared cached queries: mount any number of times (incl. StrictMode
    // double-mount) with a single network request per key. Sales history is
    // owned by /sales and never fetched here.
    const productsQ = useProducts();
    const categoriesQ = useCategories();
    const inventoryQ = useInventory();
    const customersQ = useCustomers();
    const products = productsQ.data ?? [];
    const categories = categoriesQ.data ?? [];
    const customers = customersQ.data ?? [];
    const stock = useMemo(() => {
        const inv = {};
        for (const r of inventoryQ.data ?? [])
            inv[r.product_id] = { qty: r.quantity, reorder: r.reorder_level ?? 0 };
        return inv;
    }, [inventoryQ.data]);
    const loadError = productsQ.error ?? inventoryQ.error ?? customersQ.error ?? categoriesQ.error;
    const loading = productsQ.isPending || inventoryQ.isPending;
    const [cat, setCat] = useState(null);
    const [query, setQuery] = useState('');
    const [view, setView] = useState('grid');
    const [inStockOnly, setInStockOnly] = useState(false);
    const [cart, setCart] = useState([]);
    const [walkIn, setWalkIn] = useState(true);
    const [method, setMethod] = useState('cash');
    const [tendered, setTendered] = useState('');
    const [reference, setReference] = useState('');
    const [receipt, setReceipt] = useState(null);
    const [receiptLines, setReceiptLines] = useState([]);
    const [customerId, setCustomerId] = useState('');
    const [msg, setMsg] = useState('');
    const [charging, setCharging] = useState(false);
    const [discFor, setDiscFor] = useState(null);
    const [discVal, setDiscVal] = useState('');
    const searchRef = useRef(null);
    // Cart marker lets the store picker confirm before clearing (prices and
    // stock differ between stores). Cleared whenever the active store changes.
    const storeVersion = useSessionStore((s) => s.storeVersion);
    const count = cart.reduce((s, l) => s + l.qty, 0);
    useEffect(() => {
        localStorage.setItem('ventapos:cartCount', String(count));
    }, [count]);
    const firstVersion = useRef(storeVersion);
    useEffect(() => {
        if (storeVersion !== firstVersion.current)
            setCart([]);
    }, [storeVersion]);
    useEffect(() => {
        if (!receipt)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setReceipt(null);
                setReceiptLines([]);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [receipt]);
    // Register shortcuts: Ctrl+K focuses search, F4 charges when ready.
    const canChargeRef = useRef(false);
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            else if (e.key === 'F4') {
                e.preventDefault();
                if (canChargeRef.current)
                    checkoutRef.current();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    const outOfStock = (p) => p.track_inventory && (stock[p.id]?.qty ?? 0) <= 0;
    const lowStock = (p) => {
        const s = stock[p.id];
        return (p.track_inventory && s !== undefined && s.reorder > 0 && s.qty > 0 && s.qty <= s.reorder);
    };
    const setQty = (id, qty) => {
        setCart((c) => {
            const line = c.find((l) => l.product.id === id);
            if (!line)
                return c;
            if (qty <= 0)
                return c.filter((l) => l.product.id !== id);
            const max = line.product.track_inventory ? (stock[id]?.qty ?? 0) : Infinity;
            if (qty > max) {
                setMsg(`Only ${max} left in stock`);
                return c;
            }
            return c.map((l) => (l.product.id === id ? { ...l, qty } : l));
        });
    };
    const add = (p) => {
        if (outOfStock(p))
            return;
        const line = cart.find((l) => l.product.id === p.id);
        setQty(p.id, line ? line.qty + 1 : 1);
        if (!line)
            setCart((c) => [...c, { product: p, qty: 1, discount: 0 }]);
    };
    const clearCart = () => {
        if (cart.length === 0)
            return;
        if (window.confirm('Clear the current order?'))
            setCart([]);
    };
    const catCounts = useMemo(() => {
        const m = {};
        for (const p of products) {
            const k = p.category_id ?? '';
            m[k] = (m[k] ?? 0) + 1;
        }
        return m;
    }, [products]);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter((p) => (!cat || p.category_id === cat) &&
            (!inStockOnly || !outOfStock(p)) &&
            (!q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [products, cat, query, inStockOnly, inventoryQ.data]);
    const subtotal = cart.reduce((s, l) => s + unitPrice(l.product, l.qty) * l.qty, 0);
    const lineDisc = cart.reduce((s, l) => s + Math.min(l.discount, unitPrice(l.product, l.qty) * l.qty), 0);
    const estimate = Math.max(0, Math.round((subtotal - lineDisc) * 100) / 100);
    const pickMethod = (m) => {
        setMethod(m);
        setWalkIn(m !== 'utang');
        if (m !== 'utang')
            setCustomerId('');
    };
    const pickParty = (isWalkIn) => {
        setWalkIn(isWalkIn);
        if (isWalkIn) {
            if (method === 'utang')
                setMethod('cash');
            setCustomerId('');
        }
        else {
            setMethod('utang');
        }
    };
    const canCharge = cart.length > 0 &&
        (method === 'utang'
            ? !!customerId
            : method !== 'cash' || Number(tendered) >= estimate);
    canChargeRef.current = canCharge;
    const checkout = async (override = false, reason = '', key = crypto.randomUUID()) => {
        setMsg('');
        if (method === 'utang' && !customerId) {
            setMsg('Select a customer for utang');
            return;
        }
        if (NEEDS_REF.has(method) && !reference.trim()) {
            setMsg(`Enter the ${method.toUpperCase()} reference number`);
            return;
        }
        const amount = method === 'cash' ? Number(tendered) : estimate;
        setCharging(true);
        try {
            const res = await api.post('/sales', {
                items: cart.map((l) => ({
                    product_id: l.product.id,
                    quantity: l.qty,
                    discount: l.discount,
                })),
                payments: [
                    {
                        method,
                        amount,
                        reference: reference.trim() || undefined,
                    },
                ],
                idempotency_key: key,
                customer_id: method === 'utang' ? customerId : undefined,
                limit_override: override,
                limit_reason: reason || undefined,
            });
            setReceipt(res.data.data);
            setCart([]);
            setTendered('');
            setReference('');
            // Line items for the printed receipt (best-effort; totals already shown).
            api
                .get(`/sales/${res.data.data.sale_id}`)
                .then((d) => setReceiptLines(d.data.data.items ?? []))
                .catch(() => setReceiptLines([]));
            // Stock and balances changed server-side: mark stale so the next
            // read refetches exactly once, instead of refetching everything here.
            await Promise.all([
                qc.invalidateQueries({ queryKey: qk.inventory }),
                ...(method === 'utang'
                    ? [qc.invalidateQueries({ queryKey: qk.customers })]
                    : []),
            ]);
        }
        catch (e) {
            const errMsg = e.response?.data?.error?.message ?? 'Sale failed';
            if (errMsg.toLowerCase().includes('credit limit') && !override) {
                const ok = window.confirm(`${errMsg}\n\nCharge anyway with manager approval?`);
                if (ok) {
                    const why = window.prompt('Override reason (logged):', 'manager approved') ?? '';
                    await checkout(true, why, key);
                    return;
                }
            }
            setMsg(errMsg);
        }
        finally {
            setCharging(false);
        }
    };
    const checkoutRef = useRef(checkout);
    checkoutRef.current = checkout;
    const applyDisc = (id) => {
        const v = Math.max(0, Number(discVal) || 0);
        setCart((c) => c.map((l) => (l.product.id === id ? { ...l, discount: v } : l)));
        setDiscFor(null);
        setDiscVal('');
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [loading && _jsx("p", { className: "text-sm text-gray-500", children: "Loading register\u2026" }), loadError && (_jsx("p", { className: "text-sm text-red-600", children: "Could not load catalog. Check connection and retry." })), _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-[1fr_380px]", children: [_jsxs("section", { "aria-label": "Product catalog", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => searchRef.current?.focus(), title: "Focus search (Ctrl+K). Barcode scanners type here.", className: "h-11 shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100", children: "Scan" }), _jsx("input", { ref: searchRef, className: "h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", placeholder: "Scan barcode or type a product  (Ctrl+K)", "aria-label": "Search products", value: query, onChange: (e) => setQuery(e.target.value) }), _jsx("button", { type: "button", "aria-pressed": inStockOnly, title: "Show in-stock only", onClick: () => setInStockOnly((v) => !v), className: `h-11 shrink-0 rounded-lg border px-3 text-sm font-medium ${inStockOnly ? 'border-primary bg-primary-soft text-primary-ink' : 'border-gray-300 bg-white text-gray-600'}`, children: "Stock" }), _jsx("div", { role: "group", "aria-label": "Catalog view", className: "flex shrink-0 overflow-hidden rounded-lg border border-gray-300", children: ['grid', 'list'].map((v) => (_jsx("button", { type: "button", "aria-pressed": view === v, onClick: () => setView(v), className: `h-11 px-3 text-sm capitalize ${view === v ? 'bg-primary font-semibold text-white' : 'bg-white text-gray-500'}`, children: v }, v))) })] }), categories.length > 0 && (_jsxs("div", { className: "mt-2 flex flex-wrap gap-2", role: "group", "aria-label": "Categories", children: [_jsxs("button", { onClick: () => setCat(null), "aria-pressed": cat === null, className: `h-9 rounded-full px-3 text-[13px] ${cat === null ? 'bg-primary font-medium text-white' : 'border border-gray-300 bg-white text-gray-600'}`, children: ["All \u00B7 ", products.length] }), categories.map((c) => (_jsxs("button", { onClick: () => setCat(cat === c.id ? null : c.id), "aria-pressed": cat === c.id, className: `h-9 rounded-full px-3 text-[13px] ${cat === c.id ? 'bg-primary font-medium text-white' : 'border border-gray-300 bg-white text-gray-600'}`, children: [c.name, " \u00B7 ", catCounts[c.id] ?? 0] }, c.id)))] })), msg && (_jsx("p", { role: "alert", className: "mt-2 text-sm text-red-600", children: msg })), view === 'grid' ? (_jsx("div", { className: "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5", children: visible.map((p) => {
                                    const oos = outOfStock(p);
                                    const line = cart.find((l) => l.product.id === p.id);
                                    return (_jsxs("div", { className: `flex flex-col items-center rounded-xl border bg-white p-3 text-center ${oos ? 'opacity-40' : ''}`, children: [_jsxs("button", { disabled: oos, onClick: () => add(p), "aria-label": `Add ${p.name} to order`, className: `flex w-full flex-col items-center ${oos ? '' : 'hover:opacity-80'}`, children: [_jsx("span", { className: `flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${tileColor(p.id)}`, children: p.name.charAt(0).toUpperCase() }), _jsx("span", { className: "mt-1 w-full truncate text-xs font-medium", children: p.name }), _jsx("span", { className: "text-xs font-bold text-primary-ink", children: formatPHP(p.retail_price) })] }), line ? (_jsxs("span", { className: "mt-2 inline-flex items-center rounded-full bg-primary px-1 py-0.5 text-white", children: [_jsx("button", { "aria-label": `Decrease ${p.name}`, className: "px-2 py-0.5", onClick: () => setQty(p.id, line.qty - 1), children: "\u2212" }), _jsx("span", { className: "min-w-6 text-center text-sm font-bold", children: line.qty }), _jsx("button", { "aria-label": `Increase ${p.name}`, className: "px-2 py-0.5", onClick: () => add(p), children: "+" })] })) : (_jsx("span", { className: "mt-2", children: oos ? (_jsx(Badge, { tone: "red", children: "Out of stock" })) : lowStock(p) ? (_jsxs(Badge, { tone: "amber", children: ["Low \u00B7 ", stock[p.id]?.qty, " left"] })) : (_jsx("span", { className: "text-[11px] text-gray-400", children: p.track_inventory ? `${stock[p.id]?.qty ?? 0} left` : '•' })) }))] }, p.id));
                                }) })) : (_jsxs("ul", { className: "mt-3 divide-y rounded-xl border bg-white px-4", children: [visible.map((p) => {
                                        const oos = outOfStock(p);
                                        const line = cart.find((l) => l.product.id === p.id);
                                        return (_jsxs("li", { className: "flex items-center justify-between gap-2 py-2", children: [_jsxs("button", { disabled: oos, onClick: () => add(p), className: "min-w-0 flex-1 truncate text-left text-sm font-medium disabled:text-gray-400", children: [p.name, _jsxs("span", { className: "ml-2 text-xs text-gray-400", children: [formatPHP(p.retail_price), oos ? ' · out of stock' : lowStock(p) ? ` · low (${stock[p.id]?.qty})` : ''] })] }), line ? (_jsxs("span", { className: "inline-flex items-center", children: [_jsx("button", { "aria-label": `Decrease ${p.name}`, className: "rounded px-2 py-1 hover:bg-gray-100", onClick: () => setQty(p.id, line.qty - 1), children: "\u2212" }), _jsx("span", { className: "w-8 text-center text-sm font-bold", children: line.qty }), _jsx("button", { "aria-label": `Increase ${p.name}`, className: "rounded px-2 py-1 hover:bg-gray-100", onClick: () => add(p), children: "+" })] })) : (_jsx("button", { disabled: oos, onClick: () => add(p), className: "h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-white disabled:opacity-40", children: "Add" }))] }, p.id));
                                    }), visible.length === 0 && (_jsx("li", { className: "py-4 text-center text-sm text-gray-400", children: "No products match. Try another search." }))] }))] }), _jsxs("section", { "aria-label": "Current order", className: "h-fit rounded-xl border border-gray-200 bg-white lg:sticky lg:top-4", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-100 p-4", children: [_jsxs("h2", { className: "text-base font-semibold", children: ["Current Order", ' ', count > 0 && (_jsxs("span", { className: "ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white", children: [count, " items"] }))] }), _jsx("button", { onClick: clearCart, disabled: cart.length === 0, className: "text-[13px] font-medium text-gray-400 hover:text-red-700 disabled:opacity-40", children: "Clear" })] }), _jsxs("div", { className: "p-4", children: [_jsx("div", { role: "group", "aria-label": "Order party", className: "grid grid-cols-2 gap-2", children: [
                                            { key: true, label: 'Walk-in' },
                                            { key: false, label: 'Customer' },
                                        ].map((o) => (_jsx("button", { onClick: () => pickParty(o.key), "aria-pressed": walkIn === o.key, className: `h-11 rounded-xl text-sm font-medium ${walkIn === o.key ? 'bg-primary font-semibold text-white' : 'border border-gray-300 text-gray-600'}`, children: o.label }, o.label))) }), _jsxs("ul", { className: "mt-2 max-h-64 divide-y divide-gray-100 overflow-auto", children: [cart.map((l) => {
                                                const ws = isWholesale(l.product, l.qty);
                                                const max = l.product.track_inventory ? (stock[l.product.id]?.qty ?? 0) : Infinity;
                                                return (_jsxs("li", { className: "py-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium", children: l.product.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [formatPHP(unitPrice(l.product, l.qty)), " each", ws && (_jsx("span", { className: "ml-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink", children: "Wholesale" }))] })] }), _jsx("p", { className: "text-sm font-semibold", children: formatPHP(unitPrice(l.product, l.qty) * l.qty - Math.min(l.discount, unitPrice(l.product, l.qty) * l.qty)) })] }), _jsxs("div", { className: "mt-1 flex items-center justify-between", children: [_jsxs("span", { className: "inline-flex items-center rounded-full border border-gray-200", children: [_jsx("button", { "aria-label": `Decrease ${l.product.name}`, className: "px-2.5 py-1", onClick: () => setQty(l.product.id, l.qty - 1), children: "\u2212" }), _jsxs("span", { className: "min-w-10 text-center text-sm font-bold", children: [l.qty, _jsx("span", { className: "font-normal text-gray-400", children: " pcs" })] }), _jsx("button", { "aria-label": `Increase ${l.product.name}`, className: "px-2.5 py-1", onClick: () => add(l.product), children: "+" })] }), discFor === l.product.id ? (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("input", { "aria-label": `Discount for ${l.product.name}`, className: "h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm", inputMode: "decimal", autoFocus: true, value: discVal, onChange: (e) => setDiscVal(e.target.value), onKeyDown: (e) => {
                                                                                if (e.key === 'Enter')
                                                                                    applyDisc(l.product.id);
                                                                            } }), _jsx("button", { className: "h-9 rounded-lg bg-primary px-2 text-sm font-medium text-white", onClick: () => applyDisc(l.product.id), children: "OK" })] })) : (_jsxs("span", { className: "inline-flex items-center gap-2", children: [l.discount > 0 && (_jsxs("span", { className: "text-xs text-gray-500", children: ["\u2212", formatPHP(l.discount)] })), _jsx("button", { className: "text-xs font-medium text-gray-500 hover:text-primary", onClick: () => {
                                                                                setDiscFor(l.product.id);
                                                                                setDiscVal(l.discount ? String(l.discount) : '');
                                                                            }, children: "Discount" }), _jsx("button", { "aria-label": `Remove ${l.product.name}`, className: "text-gray-400 hover:text-red-700", onClick: () => setQty(l.product.id, 0), children: "\u00D7" })] }))] }), l.qty >= max && max !== Infinity && (_jsxs("p", { className: "mt-1 text-xs text-amber-700", children: ["Only ", max, " pcs in stock"] }))] }, l.product.id));
                                            }), cart.length === 0 && (_jsx("li", { className: "py-4 text-center text-sm text-gray-400", children: "Tap a product to start an order." }))] }), _jsxs("div", { className: "mt-2 border-t border-gray-100 pt-3 text-sm", children: [_jsxs("p", { className: "flex justify-between text-gray-500", children: [_jsx("span", { children: "Net Sales" }), _jsx("span", { children: formatPHP(subtotal) })] }), lineDisc > 0 && (_jsxs("p", { className: "flex justify-between text-gray-500", children: [_jsx("span", { children: "Discount" }), _jsxs("span", { children: ["\u2212", formatPHP(lineDisc)] })] })), _jsxs("p", { className: "mt-1 flex justify-between text-base font-bold", children: [_jsx("span", { children: "Total" }), _jsx("span", { children: formatPHP(estimate) })] })] }), _jsx("div", { className: "mt-3 grid grid-cols-3 gap-1", role: "group", "aria-label": "Payment method", children: METHODS.map((m) => (_jsx("button", { onClick: () => pickMethod(m), "aria-pressed": method === m, className: `h-10 rounded-lg border px-2 text-xs capitalize ${method === m ? 'border-primary bg-primary-soft font-bold text-primary-ink' : 'border-gray-200 text-gray-600'}`, children: m }, m))) }), method === 'utang' && (_jsxs("select", { "aria-label": "Customer for utang", className: "mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm", value: customerId, onChange: (e) => setCustomerId(e.target.value), children: [_jsx("option", { value: "", children: "Select customer\u2026" }), customers.map((c) => (_jsxs("option", { value: c.id, children: [c.name, " (", formatPHP(c.balance ?? 0), ")"] }, c.id)))] })), NEEDS_REF.has(method) && (_jsx("input", { "aria-label": `${method} reference number`, className: "mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm", placeholder: `${method.toUpperCase()} reference no.`, value: reference, onChange: (e) => setReference(e.target.value) })), method === 'cash' && (_jsxs(_Fragment, { children: [_jsx("input", { "aria-label": "Cash received", className: "mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm", placeholder: "Cash received", value: tendered, onChange: (e) => setTendered(e.target.value), inputMode: "decimal" }), _jsxs("div", { className: "mt-2 grid grid-cols-3 gap-1", children: [_jsx("button", { className: "h-9 rounded-lg border border-gray-200 px-2 text-xs font-medium", onClick: () => setTendered(String(estimate)), children: "Exact" }), QUICK_CASH.filter((q) => q >= estimate)
                                                        .slice(0, 5)
                                                        .map((q) => (_jsx("button", { className: "h-9 rounded-lg border border-gray-200 px-2 text-xs font-medium", onClick: () => setTendered(String(q)), children: q }, q)))] }), Number(tendered) >= estimate && estimate > 0 && (_jsxs("p", { className: "mt-2 text-sm", children: ["Change: ", _jsx("span", { className: "font-bold", children: formatPHP(Number(tendered) - estimate) })] }))] })), _jsxs("div", { className: "mt-3 grid grid-cols-[1fr_auto] gap-2", children: [_jsx(Link, { to: "/sales", className: "inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 text-sm font-medium text-gray-700", children: "History" }), _jsx("button", { disabled: !canCharge || charging, onClick: () => checkout(), className: "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-white disabled:opacity-40", children: charging ? 'Charging…' : `Checkout ${formatPHP(estimate)}` })] }), _jsx("p", { className: "mt-1 text-center text-[11px] text-gray-400", children: "F4 to charge \u00B7 Ctrl+K to search" })] })] })] }), cart.length > 0 && (_jsxs("button", { onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), className: "fixed inset-x-4 bottom-20 rounded-xl bg-primary-hover p-3 font-bold text-white shadow-lg lg:hidden", children: ["Cart \u00B7 ", count, " items \u00B7 ", formatPHP(estimate), " \u2014 review & charge"] })), receipt && (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": `Receipt ${receipt.receipt_number}`, className: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 print:static print:block print:bg-white sm:items-center", children: _jsxs("div", { className: "receipt-80 w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none", children: [_jsx("p", { className: "text-center font-bold", children: "VentaPOS" }), _jsx("p", { className: "text-center", children: receipt.receipt_number }), _jsxs("p", { className: "text-center text-gray-500", children: [new Date().toLocaleString(), " \u00B7 ", method.toUpperCase()] }), _jsx("hr", {}), receiptLines.map((i) => (_jsxs("p", { className: "flex justify-between", children: [_jsxs("span", { children: [i.product_name_snapshot, " \u00D7 ", i.quantity] }), _jsx("span", { children: formatPHP(i.line_total) })] }, i.id))), _jsx("hr", {}), _jsxs("div", { className: "mt-4 space-y-1 text-sm print:mt-0", children: [_jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "Total" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.total) })] }), _jsxs("p", { className: "flex justify-between", children: [_jsxs("span", { children: ["Paid (", method, ")"] }), _jsx("span", { children: formatPHP(receipt.paid) })] }), _jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "Change" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.change) })] }), receipt.utang > 0 && (_jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "New balance" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.balance ?? 0) })] }))] }), _jsx("p", { className: "mt-2 hidden text-center print:block", children: "Thank you for shopping!" }), _jsxs("div", { className: "mt-5 grid grid-cols-2 gap-2 print:hidden", children: [_jsx("button", { className: "h-10 rounded-lg border border-gray-300 text-sm font-medium", onClick: () => {
                                        setReceipt(null);
                                        setReceiptLines([]);
                                    }, children: "New sale" }), _jsx("button", { className: "h-10 rounded-lg bg-primary text-sm font-medium text-white", onClick: () => window.print(), children: "Print" })] })] }) }))] }));
}
