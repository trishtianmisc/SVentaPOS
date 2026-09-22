import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { useSessionStore, confirmStoreSwitch } from '../../stores/session';
import { ToastHost } from '../ui';
import { api } from '../../lib/api-client';
const NAV = [
    { to: '/pos', label: 'POS' },
    { to: '/products', label: 'Products' },
    { to: '/inventory', label: 'Stock' },
    { to: '/sales', label: 'Sales' },
    { to: '/customers', label: 'Customers' },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/transfers', label: 'Transfers' },
    { to: '/expenses', label: 'Expenses' },
    { to: '/reports', label: 'Reports' },
    { to: '/settings', label: 'Settings' },
    { to: '/billing', label: 'Billing' },
    { to: '/dashboard', label: 'Dashboard' },
];
// Mobile keeps 5 thumb-friendly tabs; the rest live in Dashboard hub.
const TABS = [
    { to: '/pos', label: 'POS' },
    { to: '/products', label: 'Products' },
    { to: '/inventory', label: 'Stock' },
    { to: '/sales', label: 'Sales' },
    { to: '/dashboard', label: 'More' },
];
function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export default function AppLayout() {
    const { email, signOut } = useAuthStore();
    const navigate = useNavigate();
    const storeId = useSessionStore((s) => s.storeId);
    const setStore = useSessionStore((s) => s.setStore);
    const [stores, setStores] = useState([]);
    const clock = useClock();
    const storeName = stores.find((s) => s.id === storeId)?.name ?? null;
    useEffect(() => {
        api
            .get('/stores')
            .then((r) => {
            const list = r.data.data ?? [];
            setStores(list);
            if (!storeId && list.length === 1)
                setStore(list[0].id);
        })
            .catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const pickStore = (id) => {
        if (!id || id === storeId)
            return;
        if (!confirmStoreSwitch())
            return;
        setStore(id);
    };
    const logout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
    return (_jsxs("div", { className: "min-h-dvh bg-gray-50 text-gray-900 md:flex", children: [_jsx("a", { href: "#main-content", className: "sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm", children: "Skip to content" }), _jsx(ToastHost, {}), _jsxs("aside", { className: "hidden w-60 shrink-0 flex-col bg-slate-900 print:hidden md:flex", children: [_jsxs("div", { className: "border-b border-slate-800 px-5 py-4", children: [_jsx("p", { className: "text-lg font-bold text-white", children: "VentaPOS" }), stores.length > 1 ? (_jsxs("select", { "aria-label": "Active store", className: "mt-2 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 text-[13px] text-slate-100", value: storeId ?? '', onChange: (e) => pickStore(e.target.value), children: [_jsx("option", { value: "", children: "Select store\u2026" }), stores.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })) : (_jsxs("p", { className: "mt-1 truncate text-xs text-slate-400", children: [storeName ?? 'Loading store…', " \u00B7 ", clock] }))] }), _jsx("nav", { className: "flex flex-1 flex-col gap-1 p-3", children: NAV.map((t) => (_jsx(NavLink, { to: t.to, className: ({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive
                                ? 'bg-white/10 font-semibold text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`, children: t.label }, t.to))) }), _jsxs("div", { className: "border-t border-slate-800 p-4", children: [_jsx("p", { className: "truncate text-xs text-slate-400", children: email ?? '' }), _jsx("button", { className: "mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-white/5", onClick: logout, children: "Sign out" })] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex items-center justify-between border-b bg-white px-4 py-3 print:hidden md:hidden", children: [_jsx("span", { className: "font-bold text-primary-ink", children: "VentaPOS" }), _jsxs("span", { className: "truncate text-xs text-gray-500", children: [storeName ?? '…', " \u00B7 ", clock] }), _jsx("button", { className: "text-sm text-primary", onClick: logout, children: "Sign out" })] }), _jsx("main", { id: "main-content", className: "flex-1 pb-20 md:pb-0", children: _jsx(Outlet, {}) }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white print:hidden md:hidden", children: TABS.map((t) => (_jsx(NavLink, { to: t.to, className: ({ isActive }) => `py-3 text-center text-xs ${isActive ? 'font-bold text-primary' : 'text-gray-500'}`, children: t.label }, t.to))) })] })] }));
}
