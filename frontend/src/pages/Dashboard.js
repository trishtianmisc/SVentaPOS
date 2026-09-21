import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, PageHeader, Section, Select } from '../components/ui';
import { useInventory } from '../hooks/useCatalog';
import { useSessionStore, confirmStoreSwitch } from '../stores/session';
const CARDS = [
    { to: '/pos', title: 'New sale', desc: 'POS cart + cash checkout' },
    { to: '/products', title: 'Products', desc: 'Catalog management' },
    { to: '/inventory', title: 'Inventory', desc: 'Stock levels + adjustments' },
    { to: '/sales', title: 'Sales', desc: 'History + receipts' },
    { to: '/customers', title: 'Customers', desc: 'Utang ledger + payments' },
    { to: '/suppliers', title: 'Suppliers', desc: 'Suppliers + purchase orders' },
    { to: '/expenses', title: 'Expenses', desc: 'Costs + categories' },
    { to: '/reports', title: 'Reports', desc: 'Sales, profit, utang' },
    { to: '/admin', title: 'Admin', desc: 'Plans, organizations, support' },
];
export default function DashboardPage() {
    const storeId = useSessionStore((s) => s.storeId);
    const setStore = useSessionStore((s) => s.setStore);
    const [stores, setStores] = useState([]);
    const [sub, setSub] = useState(null);
    const [usage, setUsage] = useState(null);
    const [notifs, setNotifs] = useState([]);
    const { data: rows = [] } = useInventory();
    const lowCount = rows.filter((r) => (r.reorder_level ?? 0) > 0 && r.quantity <= (r.reorder_level ?? 0)).length;
    useEffect(() => {
        api
            .get('/stores')
            .then((r) => setStores(r.data.data ?? []))
            .catch(() => undefined);
        api
            .get('/subscriptions/current')
            .then((r) => setSub(r.data.data))
            .catch(() => undefined);
        api
            .get('/subscriptions/usage')
            .then((r) => setUsage(r.data.data))
            .catch(() => undefined);
        api
            .get('/notifications?unread_only=true')
            .then((r) => setNotifs(r.data.data ?? []))
            .catch(() => undefined);
    }, []);
    const pick = (id) => {
        if (!id || id === storeId)
            return;
        if (!confirmStoreSwitch())
            return;
        setStore(id);
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Dashboard", sub: "Store overview and shortcuts" }), !storeId && (_jsx("p", { className: "mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-700", children: "No store assigned yet. Ask an owner to add you to a store." })), lowCount > 0 && (_jsxs("div", { className: "mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4", children: [_jsxs("p", { className: "text-sm text-amber-800", children: [lowCount, " product", lowCount === 1 ? '' : 's', " at or below reorder level."] }), _jsx(Link, { to: "/inventory", children: _jsx(Badge, { tone: "amber", children: "Review stock" }) })] })), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px_1fr]", children: [_jsxs("div", { className: "grid content-start gap-4", children: [_jsxs(Section, { title: "Active store", children: [stores.length > 1 ? (_jsxs(Select, { "aria-label": "Active store", value: storeId ?? '', onChange: (e) => pick(e.target.value), children: [_jsx("option", { value: "", children: "Select store\u2026" }), stores.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })) : (_jsx("p", { className: "text-sm text-gray-500", children: stores[0]?.name ?? 'Loading stores…' })), _jsx("p", { className: "mt-2 text-xs text-gray-400", children: "Switching stores reloads stock, sales, and balances for that store." })] }), _jsx(Section, { title: "Subscription", children: sub ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: sub.plan?.name ?? '—' }), _jsx("span", { className: "ml-2 text-xs text-gray-500", children: sub.status })] }), usage && (_jsxs("ul", { className: "mt-2 space-y-1 text-[13px] text-gray-600", children: [_jsxs("li", { className: "flex justify-between", children: [_jsx("span", { children: "Stores" }), _jsxs("span", { children: [usage.stores, " / ", sub.limits?.max_stores ?? '—'] })] }), _jsxs("li", { className: "flex justify-between", children: [_jsx("span", { children: "Products" }), _jsxs("span", { children: [usage.products, " / ", sub.limits?.max_products ?? '—'] })] }), _jsxs("li", { className: "flex justify-between", children: [_jsx("span", { children: "Users" }), _jsxs("span", { children: [usage.users, " / ", sub.limits?.max_users ?? '—'] })] })] }))] })) : (_jsx("p", { className: "text-sm text-gray-400", children: "Loading plan\u2026" })) }), notifs.length > 0 && (_jsx(Section, { title: `Notifications (${notifs.length})`, children: _jsx("ul", { className: "space-y-2", children: notifs.slice(0, 5).map((n) => (_jsxs("li", { className: "text-[13px]", children: [_jsx("p", { className: "font-medium", children: n.title }), n.body && _jsx("p", { className: "text-gray-500", children: n.body })] }, n.id))) }) }))] }), _jsx("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4", children: CARDS.map((c) => (_jsxs(Link, { to: c.to, className: "rounded-xl border border-gray-200 bg-white p-4 hover:border-teal-600 md:p-5", children: [_jsx("p", { className: "text-sm font-semibold text-teal-800", children: c.title }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: c.desc })] }, c.to))) })] })] }));
}
