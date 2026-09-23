import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { useSessionStore } from '../../stores/session';
import { ToastHost } from '../../components/ui';
const NAV = [
    {
        to: '/owner/console',
        label: 'Hub',
        section: 'overview',
        icon: (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })] })),
    },
    {
        to: '/owner/console/branches',
        label: 'Branches',
        section: 'operations',
        icon: (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) })),
    },
    {
        to: '/owner/console/transfers',
        label: 'Transfers',
        section: 'operations',
        icon: (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("path", { d: "M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" }), _jsx("path", { d: "M7 7h4v4M17 17h-4v-4" })] })),
    },
    {
        to: '/owner/console/reports',
        label: 'Reports',
        section: 'operations',
        icon: (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: _jsx("path", { d: "M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" }) })),
    },
    {
        to: '/owner/console/users',
        label: 'Users',
        section: 'admin',
        icon: (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("circle", { cx: "9", cy: "8", r: "3" }), _jsx("path", { d: "M3 19c0-3 2.5-5 6-5s6 2 6 5" }), _jsx("path", { d: "M16 11a3 3 0 1 0 0-6M21 19c0-2-1.5-3.5-4-4" })] })),
    },
    {
        to: '/owner/console/subscription',
        label: 'Subscription',
        section: 'admin',
        icon: (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M2 10h20" })] })),
    },
    {
        to: '/owner/console/settings',
        label: 'Settings',
        section: 'admin',
        icon: (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" })] })),
    },
];
const SECTIONS = [
    { key: 'overview', label: 'Overview' },
    { key: 'operations', label: 'Operations' },
    { key: 'admin', label: 'Administration' },
];
function initials(name, email) {
    const src = (name || email || '?').trim();
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
}
export default function ConsoleLayout() {
    const navigate = useNavigate();
    const { email, signOut } = useAuthStore();
    const storeId = useSessionStore((s) => s.storeId);
    const setStore = useSessionStore((s) => s.setStore);
    const [orgName, setOrgName] = useState('');
    const [fullName, setFullName] = useState('');
    const [branchCount, setBranchCount] = useState(0);
    useEffect(() => {
        api
            .get('/users/branch-stores')
            .then((r) => setBranchCount((r.data.data ?? []).length))
            .catch(() => undefined);
        api
            .get('/organizations/current')
            .then((r) => setOrgName(r.data.data?.name ?? ''))
            .catch(() => undefined);
        api
            .get('/auth/me')
            .then((r) => setFullName(r.data.data?.full_name ?? ''))
            .catch(() => undefined);
    }, []);
    /** Store App / Return to Store App → /pos (auto-pick first membership store). */
    const goToStoreApp = async () => {
        let sid = storeId;
        if (!sid) {
            try {
                const r = await api.get('/stores');
                const list = r.data.data ?? [];
                if (list.length) {
                    sid = list[0].id;
                    setStore(sid);
                }
                else {
                    navigate('/owner-hub', { replace: true });
                    return;
                }
            }
            catch {
                navigate('/owner-hub', { replace: true });
                return;
            }
        }
        navigate('/pos', { replace: true });
    };
    const logout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
    const displayOrg = orgName || 'Your business';
    const userLabel = fullName || email || '';
    return (_jsxs("div", { className: "flex min-h-dvh bg-gray-50 text-gray-900", children: [_jsx(ToastHost, {}), _jsxs("aside", { className: "hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex print:hidden", children: [_jsx("div", { className: "border-b border-gray-200 px-5 py-5", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("span", { "aria-hidden": true, className: "flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-sm font-black text-primary", children: "K" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "truncate text-sm font-bold text-gray-900", children: ["Owner Console", _jsx("span", { className: "ml-1", "aria-hidden": true, children: "\uD83D\uDC51" })] }), _jsx("p", { className: "truncate text-xs text-gray-500", children: displayOrg })] })] }) }), _jsx("div", { className: "px-3 pt-3", children: _jsxs("button", { type: "button", onClick: goToStoreApp, className: "flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50", children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: _jsx("path", { d: "M3 9h18M5 9V5h14v4M5 9v10h14V9" }) }), "Store App"] }), _jsx("span", { className: "text-[11px] font-medium text-gray-500", children: "Exit \u2192" })] }) }), _jsx("nav", { className: "flex-1 overflow-y-auto px-3 py-4", children: SECTIONS.map((sec) => {
                            const items = NAV.filter((n) => n.section === sec.key);
                            if (!items.length)
                                return null;
                            return (_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400", children: sec.label }), _jsx("div", { className: "grid gap-0.5", children: items.map((item) => (_jsxs(NavLink, { to: item.to, end: item.to === '/owner/console', className: ({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${isActive
                                                ? 'bg-primary-soft font-semibold text-primary-ink'
                                                : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`, children: [item.icon, item.label] }, item.to))) })] }, sec.key));
                        }) }), _jsx("div", { className: "border-t border-gray-200 px-4 py-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary", children: initials(fullName, email) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-gray-900", children: userLabel }), _jsx("p", { className: "truncate text-xs text-gray-500", children: displayOrg })] }), _jsx("button", { type: "button", "aria-label": "Sign out", onClick: logout, className: "rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("path", { d: "m16 17 5-5-5-5" }), _jsx("path", { d: "M21 12H9" })] }) })] }) })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden print:hidden", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-bold text-gray-900", children: "Owner Console" }), _jsx("p", { className: "truncate text-xs text-gray-500", children: displayOrg })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: goToStoreApp, className: "rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50", children: "Store App" }), _jsx("button", { type: "button", onClick: logout, className: "text-xs text-gray-500", children: "Sign out" })] })] }), _jsx("nav", { className: "flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 md:hidden print:hidden", children: NAV.map((item) => (_jsx(NavLink, { to: item.to, end: item.to === '/owner/console', className: ({ isActive }) => `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${isActive
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-600'}`, children: item.label }, item.to))) }), _jsx("main", { className: "min-h-0 flex-1 bg-gray-50", children: _jsx(Outlet, { context: {
                                orgName: displayOrg,
                                fullName,
                                branchCount,
                                goToStoreApp,
                            } }) })] })] }));
}
