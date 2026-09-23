import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { formatPHP } from '../../utils/currency';
import { Spinner } from '../../components/ui';
import { KpiCard } from '../../components/KpiCard';
function todayIso() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
function todayLabel() {
    return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function firstName(full, email) {
    if (full?.trim())
        return full.trim().split(/\s+/)[0];
    return (email ?? 'there').split('@')[0];
}
function OpsCard({ to, title, desc, badge, icon, }) {
    return (_jsxs(Link, { to: to, className: "group flex items-start gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow", children: [_jsx("span", { "aria-hidden": true, className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary", children: icon }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-bold text-gray-900", children: title }), badge && (_jsx("span", { className: "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700", children: badge }))] }), _jsx("p", { className: "mt-1 text-[13px] leading-snug text-gray-500", children: desc })] }), _jsx("span", { "aria-hidden": true, className: "mt-1 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-primary", children: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "m9 18 6-6-6-6" }) }) })] }));
}
export default function ConsoleHubPage() {
    const ctx = useOutletContext();
    const [branches, setBranches] = useState([]);
    const [sales, setSales] = useState(null);
    const [expenses, setExpenses] = useState(null);
    const [loading, setLoading] = useState(true);
    const [metricsBlocked, setMetricsBlocked] = useState(false);
    const welcomeName = firstName(ctx.fullName);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setMetricsBlocked(false);
            try {
                const br = await api.get('/users/branch-stores');
                if (cancelled)
                    return;
                setBranches((br.data.data ?? []));
            }
            catch {
                if (!cancelled)
                    setBranches([]);
            }
            const day = todayIso();
            try {
                const [s, e] = await Promise.all([
                    api.get('/reports/consolidated/sales', { params: { from: day, to: day } }),
                    api.get('/reports/consolidated/expenses', { params: { from: day, to: day } }),
                ]);
                if (cancelled)
                    return;
                setSales({
                    total: Number(s.data.data?.total) || 0,
                    count: Number(s.data.data?.count) || 0,
                    by_store: (s.data.data?.by_store ?? []),
                });
                setExpenses({
                    total: Number(e.data.data?.total) || 0,
                    by_store: (e.data.data?.by_store ?? []),
                });
            }
            catch {
                if (cancelled)
                    return;
                setSales(null);
                setExpenses(null);
                setMetricsBlocked(true);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    const net = sales && expenses ? sales.total - expenses.total : 0;
    const margin = sales && sales.total > 0 && expenses
        ? ((sales.total - expenses.total) / sales.total) * 100
        : 0;
    const expenseByStore = new Map((expenses?.by_store ?? []).map((r) => [r.store_id, Number(r.total) || 0]));
    const ranked = [...(sales?.by_store ?? [])]
        .map((r) => ({
        ...r,
        expense: expenseByStore.get(r.store_id) ?? 0,
        net: (Number(r.total) || 0) - (expenseByStore.get(r.store_id) ?? 0),
    }))
        .sort((a, b) => b.total - a.total);
    const branchMeta = new Map(branches.map((b) => [b.id, b]));
    const activeBranches = ctx.branchCount || branches.length || sales?.by_store.length || 1;
    return (_jsxs("div", { className: "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8", children: [_jsxs("div", { className: "mb-8 flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary", children: _jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })] }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight text-gray-900 md:text-3xl", children: ctx.orgName }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary-ink", children: [_jsx("span", { "aria-hidden": true, children: "\uD83D\uDC51" }), " Owner Console"] })] }), _jsxs("p", { className: "mt-1 text-sm text-gray-500", children: ["Welcome back, ", welcomeName, " \u00B7", ' ', _jsxs("span", { className: "font-semibold text-gray-900", children: [activeBranches, " active branch", activeBranches === 1 ? '' : 'es'] })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: "inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M8 3v4M16 3v4M3 11h18" })] }), "Today \u00B7 ", todayLabel()] }), _jsxs("button", { type: "button", onClick: () => ctx.goToStoreApp(), className: "inline-flex h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary-soft px-4 text-sm font-semibold text-primary-ink hover:bg-primary-soft/80", children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M3 9h18M5 9V5h14v4M5 9v10h14V9" }) }), "Return to Store App"] })] })] }), loading ? (_jsx("div", { className: "rounded-3xl border border-gray-200 bg-white p-6", children: _jsx(Spinner, { label: "Loading today\u2019s performance\u2026" }) })) : metricsBlocked || !sales || !expenses ? (_jsx("div", { className: "mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 md:p-8", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "max-w-xl", children: [_jsx("p", { className: "text-[11px] font-bold uppercase tracking-wider text-amber-700", children: "Today\u2019s live performance" }), _jsx("h2", { className: "mt-1 text-xl font-bold text-gray-900", children: "Cross-branch stats need a paid plan" }), _jsx("p", { className: "mt-1.5 text-sm text-gray-600", children: "Upgrade to unlock live sales, profit, and branch rankings across every location. You can still open the console tools below and enter any branch." })] }), _jsx(Link, { to: "/owner/console/subscription", className: "inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover", children: "Upgrade plan" })] }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-[11px] font-bold uppercase tracking-wider text-gray-500", children: "Today\u2019s live performance" }), _jsxs("p", { className: "inline-flex items-center gap-1.5 text-xs text-emerald-600", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-emerald-500", "aria-hidden": true }), "Live cross-branch rollup"] })] }), _jsxs("div", { className: "mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiCard, { tone: "green", label: "Total sales", value: formatPHP(sales.total), hint: "Gross sales across all active branches", icon: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 2v20M17 7H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7H6" }) }) }), _jsx(KpiCard, { tone: "teal", label: "Estimated net profit", value: `${net >= 0 ? '+' : ''}${formatPHP(net)}`, hint: "Revenue minus recorded expenses", badge: sales.total > 0
                                    ? `${margin.toFixed(1)}% margin`
                                    : undefined, icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M3 17 9 11l4 4 8-8" }), _jsx("path", { d: "M14 7h7v7" })] }) }), _jsx(KpiCard, { tone: "blue", label: "Total transactions", value: String(sales.count), hint: "Completed orders placed today", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "4", y: "3", width: "16", height: "18", rx: "2" }), _jsx("path", { d: "M8 7h8M8 11h8M8 15h5" })] }) }), _jsx(KpiCard, { tone: "rose", label: "Recorded expenses", value: formatPHP(expenses.total), hint: "Petty cash, utility & operational entries", badge: "Daily outflow", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M20 12V8H6a2 2 0 1 1 0-4h12v4" }), _jsx("path", { d: "M4 6v12a2 2 0 0 0 2 2h14v-4" }), _jsx("path", { d: "M18 12a2 2 0 0 0 0 4h4v-4h-4Z" })] }) })] }), _jsxs("div", { className: "mb-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary", children: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) }) }), _jsxs("div", { children: [_jsx("p", { className: "font-bold text-gray-900", children: "Branch Performance Pulse" }), _jsxs("p", { className: "text-[13px] text-gray-500", children: ["Ranked by sales volume \u00B7 ", ranked.length || 1, " branch", (ranked.length || 1) === 1 ? '' : 'es', " reporting"] })] })] }), _jsx(Link, { to: "/owner/console/reports", className: "text-sm font-semibold text-primary hover:underline", children: "Full Comparison \u203A" })] }), ranked.length === 0 ? (_jsx("p", { className: "px-5 py-6 text-sm text-gray-500", children: "No sales yet today. Enter a branch to start ringing up orders." })) : (_jsx("ul", { className: "divide-y divide-gray-100", children: ranked.map((row, i) => {
                                    const meta = branchMeta.get(row.store_id);
                                    const loc = meta?.address || meta?.code || '';
                                    return (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-5 py-4", children: [_jsxs("span", { className: "w-8 text-sm font-bold text-gray-400", children: ["#", i + 1] }), _jsx("span", { "aria-hidden": true, className: `flex h-9 w-9 items-center justify-center rounded-xl ${meta?.is_hq
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-gray-100 text-gray-500'}`, children: meta?.is_hq ? (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5Zm0 2h14v2H5v-2Z" }) })) : (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14" }) })) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-bold text-gray-900", children: row.store_name }), meta?.is_hq && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900", children: "HQ" }))] }), _jsxs("p", { className: "text-[13px] text-gray-500", children: [loc ? `${loc} · ` : '', row.count, " order", row.count === 1 ? '' : 's'] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-bold text-gray-900", children: formatPHP(row.total) }), _jsxs("p", { className: "text-sm font-semibold text-emerald-600", children: [row.net >= 0 ? '+' : '', formatPHP(row.net), " net"] })] }), _jsx("span", { "aria-hidden": true, className: "text-gray-400", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "m9 18 6-6-6-6" }) }) })] }, row.store_id));
                                }) }))] })] })), _jsx("p", { className: "mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500", children: "Operations & Administration" }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: [_jsx(OpsCard, { to: "/owner/console/branches", title: "Branches", badge: `${branches.length || ctx.branchCount || 1} active`, desc: "Manage branch details, status & settings", icon: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) }) }), _jsx(OpsCard, { to: "/owner/console/transfers", title: "Transfers", badge: "Cross-store inventory", desc: "Approve stock movements between stores", icon: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" }) }) }), _jsx(OpsCard, { to: "/owner/console/reports", title: "Reports", badge: "Real-time sync", desc: "Executive analytics, BIR receipts & trends", icon: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" }) }) }), _jsx(OpsCard, { to: "/owner/console/users", title: "Users", badge: "Role access", desc: "Assign cashiers, managers & permissions", icon: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("circle", { cx: "9", cy: "8", r: "3" }), _jsx("path", { d: "M3 19c0-3 2.5-5 6-5s6 2 6 5" }), _jsx("path", { d: "M16 11a3 3 0 1 0 0-6M21 19c0-2-1.5-3.5-4-4" })] }) }), _jsx(OpsCard, { to: "/owner/console/subscription", title: "Subscription", badge: "Plan details", desc: "Plan limits, add-on features & billing", icon: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M2 10h20" })] }) }), _jsx(OpsCard, { to: "/owner/console/settings", title: "Settings", badge: "Configuration", desc: "Tax IDs, business details & defaults", icon: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" })] }) })] })] }));
}
