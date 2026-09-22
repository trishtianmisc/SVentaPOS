import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { Badge, Button, EmptyState, Field, ListFooter, PageHeader, Section, Select, Spinner, Table, TextInput, toast, } from '../components/ui';
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
    const [moveType, setMoveType] = useState('AUTO');
    const [msg, setMsg] = useState('');
    const [moves, setMoves] = useState([]);
    // Forecast: trailing-velocity restock estimates (see /reports/forecast).
    // Paid-plan feature (advanced_reports); 403 renders an upgrade lock.
    const [forecast, setForecast] = useState(null);
    const [forecastLocked, setForecastLocked] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [poSupplier, setPoSupplier] = useState('');
    const [poBusy, setPoBusy] = useState('');
    useEffect(() => {
        api
            .get('/inventory/movements')
            .then((r) => setMoves((r.data.data ?? []).slice(0, 20)))
            .catch(() => undefined);
        api
            .get('/reports/forecast')
            .then((r) => setForecast(r.data.data))
            .catch((e) => {
            if (e.response?.status === 403)
                setForecastLocked(true);
        });
        api
            .get('/suppliers')
            .then((r) => setSuppliers(r.data.data ?? []))
            .catch(() => undefined);
    }, []);
    const draftPO = async (row) => {
        if (!poSupplier || !row.suggested_qty)
            return;
        setMsg('');
        setPoBusy(row.product_id);
        try {
            await api.post('/purchase-orders', {
                supplier_id: poSupplier,
                items: [
                    {
                        product_id: row.product_id,
                        quantity: row.suggested_qty,
                        unit_cost: row.cost_price ?? 0,
                    },
                ],
            });
            toast('success', `PO drafted for ${row.product_name}`);
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'PO draft failed');
        }
        finally {
            setPoBusy('');
        }
    };
    const adjustM = useMutation({
        mutationFn: () => {
            const n = Number(qty);
            const type = moveType === 'AUTO'
                ? n >= 0
                    ? 'PURCHASE'
                    : 'ADJUSTMENT'
                : moveType;
            // Damage/Expired write-offs must be negative.
            const signed = (type === 'DAMAGE' || type === 'EXPIRED') && n > 0 ? -n : n;
            return api.post('/inventory/adjust', {
                product_id: productId,
                quantity: signed,
                movement_type: type,
                reason: reason.trim(),
            });
        },
        onSuccess: () => {
            setProductId('');
            setQty('');
            setReason('');
            setMsg('');
            toast('success', 'Stock adjusted');
            qc.invalidateQueries({ queryKey: qk.inventory });
        },
        onError: (e) => setMsg(e.response?.data?.error?.message ?? 'Adjust failed'),
    });
    const err = msg || (inventoryQ.error ? 'Could not load inventory.' : '');
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Inventory", sub: "Stock levels and adjustments by store" }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs("div", { className: "grid content-start gap-4", children: [_jsxs(Section, { title: "Adjust stock", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Product", children: _jsxs(Select, { value: productId, onChange: (e) => setProductId(e.target.value), children: [_jsx("option", { value: "", children: "Select product\u2026" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Quantity", hint: "Positive receives stock, negative removes it.", children: _jsx(TextInput, { placeholder: "+/- qty", value: qty, onChange: (e) => setQty(e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Type", children: _jsxs(Select, { value: moveType, onChange: (e) => setMoveType(e.target.value), children: [_jsx("option", { value: "AUTO", children: "Auto (receive if +, correction if \u2212)" }), _jsx("option", { value: "PURCHASE", children: "Received" }), _jsx("option", { value: "ADJUSTMENT", children: "Correction" }), _jsx("option", { value: "DAMAGE", children: "Damage write-off" }), _jsx("option", { value: "EXPIRED", children: "Expired write-off" })] }) }), _jsx(Field, { label: "Reason", children: _jsx(TextInput, { placeholder: "Required, e.g. delivery from supplier", value: reason, onChange: (e) => setReason(e.target.value) }) }), _jsx(Button, { disabled: adjustM.isPending || !productId || !qty || !reason.trim(), onClick: () => adjustM.mutate(), children: adjustM.isPending ? 'Adjusting…' : 'Adjust stock' })] }), err && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: err })] }), _jsx(Section, { title: "Recent movements", children: moves.length === 0 ? (_jsx("p", { className: "py-2 text-sm text-gray-400", children: "No movements yet." })) : (_jsx("ul", { className: "divide-y text-sm", children: moves.map((m) => (_jsxs("li", { className: "flex justify-between py-2", children: [_jsx("span", { children: _jsx(Badge, { tone: "gray", children: m.movement_type }) }), _jsxs("span", { className: Number(m.quantity) < 0 ? 'text-red-700' : '', children: [Number(m.quantity) > 0 ? '+' : '', m.quantity] })] }, m.id))) })) })] }), _jsx(Section, { title: "Stock levels", action: _jsxs("span", { className: "text-[13px] text-gray-500", children: [rows.length, " line", rows.length === 1 ? '' : 's'] }), children: inventoryQ.isPending ? (_jsx(Spinner, { label: "Loading stock\u2026" })) : rows.length === 0 ? (_jsx(EmptyState, { title: "No stock rows yet", hint: "Receive stock with an adjustment to create the first row." })) : (_jsxs(_Fragment, { children: [_jsx(Table, { head: ['Product', 'On hand', 'Status'], children: rows.map((r) => {
                                        const low = (r.reorder_level ?? 0) > 0 && r.quantity <= (r.reorder_level ?? 0);
                                        return (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name ?? r.product_id }), _jsx("td", { className: "px-3 py-2 text-right", children: r.quantity }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: r.quantity <= 0 ? (_jsx(Badge, { tone: "red", children: "Out of stock" })) : low ? (_jsx(Badge, { tone: "amber", children: "Low" })) : (_jsx(Badge, { tone: "green", children: "OK" })) })] }, r.product_id));
                                    }) }), _jsx(ListFooter, { count: rows.length, noun: "line" })] })) })] }), _jsx("div", { className: "mt-4", children: _jsx(Section, { title: "Restock forecast", action: _jsx("span", { className: "text-[13px] text-gray-500", children: forecast
                            ? `14-day velocity · as of ${forecast.as_of} · estimates`
                            : 'Loading…' }), children: !forecast || forecast.rows.length === 0 ? (forecastLocked ? (_jsxs("div", { className: "py-4 text-center", children: [_jsx("p", { className: "font-semibold", children: "Restock forecast is a paid feature" }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Upgrade to unlock demand forecasting." }), _jsx("p", { className: "mt-3", children: _jsx(Link, { to: "/billing", className: "font-medium text-primary", children: "View plans \u2192" }) })] })) : (_jsx("p", { className: "py-2 text-sm text-gray-400", children: "No restock signals \u2014 nothing is selling faster than its cover, or no sales in the last 14 days." }))) : (_jsxs(_Fragment, { children: [_jsx(Field, { label: "PO supplier", hint: "One-click drafts order from this supplier.", children: _jsx("div", { className: "max-w-xs", children: _jsxs(Select, { value: poSupplier, onChange: (e) => setPoSupplier(e.target.value), children: [_jsx("option", { value: "", children: "Select supplier\u2026" }), suppliers.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }) }) }), _jsx(Table, { head: ['Product', 'On hand', 'Sells/day', 'Cover', 'Suggest', ''], children: forecast.rows.slice(0, 20).map((r) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: r.product_name }), _jsx("td", { className: "px-3 py-2 text-right", children: r.on_hand }), _jsx("td", { className: "px-3 py-2 text-right", children: r.daily_velocity }), _jsx("td", { className: "px-3 py-2 text-right", children: r.days_cover == null ? (_jsx(Badge, { tone: "gray", children: "no sales" })) : r.days_cover < 3 ? (_jsxs(Badge, { tone: "red", children: [r.days_cover, "d"] })) : r.days_cover < 7 ? (_jsxs(Badge, { tone: "amber", children: [r.days_cover, "d"] })) : (_jsxs(Badge, { tone: "green", children: [r.days_cover, "d"] })) }), _jsx("td", { className: "px-3 py-2 text-right", children: r.suggested_qty > 0 ? r.suggested_qty : '—' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: r.suggested_qty > 0 && (_jsx(Button, { variant: "secondary", disabled: !poSupplier || poBusy === r.product_id, onClick: () => draftPO(r), children: poBusy === r.product_id ? '…' : 'PO draft' })) })] }, r.product_id))) }), _jsx(ListFooter, { count: Math.min(forecast.rows.length, 20), noun: "signal" })] })) }) })] }));
}
