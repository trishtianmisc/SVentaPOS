import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { ToastHost } from '../ui';
const NAV = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/organizations', label: 'Organizations' },
    { to: '/upgrade-requests', label: 'Upgrade requests' },
];
export default function AdminLayout() {
    const { email, signOut } = useAuthStore();
    const navigate = useNavigate();
    const logout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
    return (_jsxs("div", { className: "min-h-dvh bg-gray-50 text-gray-900 md:flex", children: [_jsx("a", { href: "#main-content", className: "sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm", children: "Skip to content" }), _jsx(ToastHost, {}), _jsxs("aside", { className: "hidden w-60 shrink-0 flex-col bg-slate-900 md:flex", children: [_jsxs("div", { className: "border-b border-slate-800 px-5 py-4", children: [_jsx("p", { className: "text-lg font-bold text-white", children: "VentaPOS" }), _jsx("p", { className: "mt-1 text-xs uppercase tracking-wide text-slate-400", children: "Platform admin" })] }), _jsx("nav", { className: "flex flex-1 flex-col gap-1 p-3", children: NAV.map((t) => (_jsx(NavLink, { to: t.to, end: t.end, className: ({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive
                                ? 'bg-white/10 font-semibold text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`, children: t.label }, t.to))) }), _jsxs("div", { className: "border-t border-slate-800 p-4", children: [_jsx("p", { className: "truncate text-xs text-slate-400", children: email ?? '' }), _jsx("button", { className: "mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-white/5", onClick: logout, children: "Sign out" })] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex items-center justify-between border-b bg-white px-4 py-3 md:hidden", children: [_jsx("span", { className: "font-bold text-primary-ink", children: "VentaPOS Admin" }), _jsx("button", { className: "text-sm text-primary", onClick: logout, children: "Sign out" })] }), _jsx("nav", { className: "flex gap-1 border-b bg-white px-3 py-2 md:hidden", children: NAV.map((t) => (_jsx(NavLink, { to: t.to, end: t.end, className: ({ isActive }) => `rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-primary-soft font-semibold text-primary-ink' : 'text-gray-600'}`, children: t.label }, t.to))) }), _jsx("main", { id: "main-content", className: "flex-1", children: _jsx(Outlet, {}) })] })] }));
}
