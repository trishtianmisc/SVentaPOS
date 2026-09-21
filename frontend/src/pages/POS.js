import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { formatPHP } from '../utils/currency';
import { useCategories, useCustomers, useInventory, useProducts, } from '../hooks/useCatalog';
const METHODS = ['cash', 'gcash', 'maya', 'card', 'bank', 'other', 'utang'];
const NEEDS_REF = new Set(['gcash', 'maya', 'card', 'bank']);
const QUICK_CASH = [20, 50, 100, 200, 500, 1000];
const TILE_COLORS = [
    'bg-teal-100 text-teal-800',
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
            inv[r.product_id] = r.quantity;
        return inv;
    }, [inventoryQ.data]);
    const loadError = productsQ.error ?? inventoryQ.error ?? customersQ.error ?? categoriesQ.error;
    const loading = productsQ.isPending || inventoryQ.isPending;
    const [cat, setCat] = useState(null);
    const [query, setQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [method, setMethod] = useState('cash');
    const [tendered, setTendered] = useState('');
    const [reference, setReference] = useState('');
    const [receipt, setReceipt] = useState(null);
    const [customerId, setCustomerId] = useState('');
    const [msg, setMsg] = useState('');
    const [charging, setCharging] = useState(false);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter((p) => (!cat || p.category_id === cat) &&
            (!q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)));
    }, [products, cat, query]);
    const outOfStock = (p) => p.track_inventory && (stock[p.id] ?? 0) <= 0;
    const add = (p) => {
        if (outOfStock(p))
            return;
        setCart((c) => {
            const line = c.find((l) => l.product.id === p.id);
            if (line) {
                const max = p.track_inventory ? (stock[p.id] ?? 0) : Infinity;
                if (line.qty + 1 > max) {
                    setMsg(`Only ${max} left in stock`);
                    return c;
                }
                return c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
            }
            return [...c, { product: p, qty: 1 }];
        });
    };
    const estimate = cart.reduce((s, l) => s + l.product.retail_price * l.qty, 0);
    const count = cart.reduce((s, l) => s + l.qty, 0);
    const canCharge = cart.length > 0 &&
        (method === 'utang'
            ? !!customerId
            : method !== 'cash' || Number(tendered) >= estimate);
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
                items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
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
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [loading && _jsx("p", { className: "text-sm text-gray-500", children: "Loading register\u2026" }), loadError && (_jsx("p", { className: "text-sm text-red-600", children: "Could not load catalog. Check connection and retry." })), _jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-[1fr_360px]", children: [_jsxs("section", { children: [_jsx("div", { className: "flex gap-2", children: _jsx("input", { className: "flex-1 rounded-lg border bg-white p-2", placeholder: "Scan barcode or type a product", value: query, onChange: (e) => setQuery(e.target.value) }) }), categories.length > 0 && (_jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [_jsx("button", { onClick: () => setCat(null), className: `rounded-full px-3 py-1 text-xs ${cat === null ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`, children: "All" }), categories.map((c) => (_jsx("button", { onClick: () => setCat(cat === c.id ? null : c.id), className: `rounded-full px-3 py-1 text-xs ${cat === c.id ? 'bg-teal-700 text-white' : 'border bg-white text-gray-600'}`, children: c.name }, c.id)))] })), msg && _jsx("p", { className: "mt-2 text-sm text-red-600", children: msg }), _jsx("div", { className: "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5", children: visible.map((p) => {
                                    const oos = outOfStock(p);
                                    return (_jsxs("button", { disabled: oos, onClick: () => add(p), className: `flex flex-col items-center rounded-xl border bg-white p-3 text-center ${oos ? 'opacity-40' : 'hover:border-teal-600 active:bg-teal-50'}`, children: [_jsx("span", { className: `flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${tileColor(p.id)}`, children: p.name.charAt(0).toUpperCase() }), _jsx("span", { className: "mt-1 w-full truncate text-xs font-medium", children: p.name }), _jsx("span", { className: "text-xs font-bold text-teal-800", children: formatPHP(p.retail_price) }), _jsx("span", { className: "text-[11px] text-gray-400", children: oos ? 'Out of stock' : p.track_inventory ? `${stock[p.id] ?? 0} left` : '•' })] }, p.id));
                                }) })] }), _jsxs("section", { className: "h-fit rounded-xl border bg-white p-4 lg:sticky lg:top-4", children: [_jsxs("h2", { className: "font-bold", children: ["Cart ", count > 0 && _jsxs("span", { className: "text-teal-700", children: ["(", count, ")"] })] }), _jsxs("ul", { className: "mt-2 max-h-56 divide-y overflow-auto", children: [cart.map((l) => (_jsxs("li", { className: "flex items-center justify-between py-2 text-sm", children: [_jsx("span", { className: "min-w-0 flex-1 truncate", children: l.product.name }), _jsxs("span", { className: "flex items-center", children: [_jsx("button", { className: "rounded px-2 py-1 hover:bg-gray-100", onClick: () => setCart((c) => c
                                                            .map((x) => x.product.id === l.product.id ? { ...x, qty: x.qty - 1 } : x)
                                                            .filter((x) => x.qty > 0)), children: "\u2212" }), _jsx("span", { className: "w-6 text-center", children: l.qty }), _jsx("button", { className: "rounded px-2 py-1 hover:bg-gray-100", onClick: () => add(l.product), children: "+" })] }), _jsx("span", { className: "w-20 text-right font-medium", children: formatPHP(l.product.retail_price * l.qty) })] }, l.product.id))), cart.length === 0 && (_jsx("li", { className: "py-3 text-sm text-gray-400", children: "Tap a product to start a sale." }))] }), _jsxs("div", { className: "mt-3 border-t pt-3", children: [_jsxs("p", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-500", children: "Total" }), _jsx("span", { className: "text-lg font-bold", children: formatPHP(estimate) })] }), _jsx("div", { className: "mt-2 grid grid-cols-3 gap-1", children: METHODS.map((m) => (_jsx("button", { onClick: () => setMethod(m), className: `rounded-lg border px-2 py-2 text-xs capitalize ${method === m ? 'border-teal-700 bg-teal-50 font-bold text-teal-800' : 'text-gray-600'}`, children: m }, m))) }), method === 'utang' && (_jsxs("select", { className: "mt-2 w-full rounded-lg border p-2 text-sm", value: customerId, onChange: (e) => setCustomerId(e.target.value), children: [_jsx("option", { value: "", children: "Select customer\u2026" }), customers.map((c) => (_jsxs("option", { value: c.id, children: [c.name, " (", formatPHP(c.balance ?? 0), ")"] }, c.id)))] })), NEEDS_REF.has(method) && (_jsx("input", { className: "mt-2 w-full rounded-lg border p-2 text-sm", placeholder: `${method.toUpperCase()} reference no.`, value: reference, onChange: (e) => setReference(e.target.value) })), method === 'cash' && (_jsxs(_Fragment, { children: [_jsx("input", { className: "mt-2 w-full rounded-lg border p-2", placeholder: "Cash received", value: tendered, onChange: (e) => setTendered(e.target.value), inputMode: "decimal" }), _jsxs("div", { className: "mt-2 grid grid-cols-3 gap-1", children: [_jsx("button", { className: "rounded-lg border px-2 py-1 text-xs", onClick: () => setTendered(String(estimate)), children: "Exact" }), QUICK_CASH.filter((q) => q >= estimate)
                                                        .slice(0, 5)
                                                        .map((q) => (_jsx("button", { className: "rounded-lg border px-2 py-1 text-xs", onClick: () => setTendered(String(q)), children: q }, q)))] }), Number(tendered) >= estimate && estimate > 0 && (_jsxs("p", { className: "mt-2 text-sm", children: ["Change: ", _jsx("span", { className: "font-bold", children: formatPHP(Number(tendered) - estimate) })] }))] })), _jsx("button", { disabled: !canCharge || charging, onClick: () => checkout(), className: "mt-3 w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-40", children: charging ? 'Charging…' : `Charge ${formatPHP(estimate)}` })] })] })] }), cart.length > 0 && (_jsxs("button", { onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), className: "fixed inset-x-4 bottom-20 rounded-xl bg-teal-800 p-3 font-bold text-white shadow-lg lg:hidden", children: ["Cart \u00B7 ", count, " items \u00B7 ", formatPHP(estimate), " \u2014 review & charge"] })), receipt && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center", children: _jsxs("div", { className: "w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl", children: [_jsx("p", { className: "text-center text-sm text-gray-500", children: "Payment successful" }), _jsx("p", { className: "mt-1 text-center text-lg font-bold", children: receipt.receipt_number }), _jsxs("div", { className: "mt-4 space-y-1 text-sm", children: [_jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "Total" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.total) })] }), _jsxs("p", { className: "flex justify-between", children: [_jsxs("span", { children: ["Paid (", method, ")"] }), _jsx("span", { children: formatPHP(receipt.paid) })] }), _jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "Change" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.change) })] }), receipt.utang > 0 && (_jsxs("p", { className: "flex justify-between", children: [_jsx("span", { children: "New balance" }), _jsx("span", { className: "font-bold", children: formatPHP(receipt.balance ?? 0) })] }))] }), _jsxs("div", { className: "mt-5 grid grid-cols-2 gap-2 print:hidden", children: [_jsx("button", { className: "rounded-lg border p-2", onClick: () => setReceipt(null), children: "New sale" }), _jsx("button", { className: "rounded-lg bg-teal-700 p-2 text-white", onClick: () => window.print(), children: "Print" })] })] }) }))] }));
}
