import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { api } from '../../lib/api-client';
const NAV = [
    { to: '/pos', label: 'POS' },
    { to: '/products', label: 'Products' },
    { to: '/inventory', label: 'Stock' },
    { to: '/sales', label: 'Sales' },
    { to: '/customers', label: 'Customers' },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/expenses', label: 'Expenses' },
    { to: '/reports', label: 'Reports' },
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
    const [storeName, setStoreName] = useState(null);
    const clock = useClock();
    useEffect(() => {
        api
            .get('/stores')
            .then((r) => {
            const list = r.data.data ?? [];
            const active = localStorage.getItem('ventapos:storeId');
            const match = list.find((s) => s.id === active) ?? list[0];
            if (match) {
                setStoreName(match.name);
                if (!active)
                    localStorage.setItem('ventapos:storeId', match.id);
            }
        })
            .catch(() => undefined);
    }, []);
    const logout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
    return (_jsxs("div", { className: "min-h-dvh bg-gray-50 text-gray-900 md:flex", children: [_jsxs("aside", { className: "hidden w-60 shrink-0 flex-col border-r bg-white print:hidden md:flex", children: [_jsxs("div", { className: "border-b px-5 py-4", children: [_jsx("p", { className: "text-lg font-bold text-teal-800", children: "VentaPOS" }), _jsxs("p", { className: "mt-1 truncate text-xs text-gray-500", children: [storeName ?? 'Loading store…', " \u00B7 ", clock] })] }), _jsx("nav", { className: "flex flex-1 flex-col gap-1 p-3", children: NAV.map((t) => (_jsx(NavLink, { to: t.to, className: ({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive
                                ? 'bg-teal-50 font-semibold text-teal-800'
                                : 'text-gray-600 hover:bg-gray-100'}`, children: t.label }, t.to))) }), _jsxs("div", { className: "border-t p-4", children: [_jsx("p", { className: "truncate text-xs text-gray-500", children: email ?? '' }), _jsx("button", { className: "mt-2 w-full rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100", onClick: logout, children: "Sign out" })] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex items-center justify-between border-b bg-white px-4 py-3 print:hidden md:hidden", children: [_jsx("span", { className: "font-bold text-teal-800", children: "VentaPOS" }), _jsxs("span", { className: "truncate text-xs text-gray-500", children: [storeName ?? '…', " \u00B7 ", clock] }), _jsx("button", { className: "text-sm text-teal-700", onClick: logout, children: "Sign out" })] }), _jsx("main", { className: "flex-1 pb-20 md:pb-0", children: _jsx(Outlet, {}) }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white print:hidden md:hidden", children: TABS.map((t) => (_jsx(NavLink, { to: t.to, className: ({ isActive }) => `py-3 text-center text-xs ${isActive ? 'font-bold text-teal-700' : 'text-gray-500'}`, children: t.label }, t.to))) })] })] }));
}
