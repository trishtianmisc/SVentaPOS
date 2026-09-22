import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { EmptyState, PageHeader, Section, Spinner } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';
function Stat({ label, value }) {
    return (_jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-gray-500", children: label }), _jsx("p", { className: "mt-1 text-2xl font-semibold text-primary-ink", children: value })] }));
}
export default function DashboardPage() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [msg, setMsg] = useState('');
    useEffect(() => {
        api
            .get('/admin/metrics')
            .then((r) => setMetrics(r.data.data))
            .catch((e) => {
            if (e.response?.status === 403)
                setDenied(true);
            else
                setMsg(e.response?.data?.error?.message ?? 'Load failed');
        })
            .finally(() => setLoading(false));
    }, []);
    if (denied)
        return _jsx(AccessDenied, {});
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Dashboard", sub: "Platform metrics across all organizations" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), loading ? (_jsx(Spinner, { label: "Loading metrics\u2026" })) : !metrics ? (_jsx(EmptyState, { title: "No metrics available" })) : (_jsxs("div", { className: "grid gap-4", children: [_jsx(Section, { title: "Organizations", children: _jsxs("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4", children: [_jsx(Stat, { label: "Total", value: metrics.organizations.total }), _jsx(Stat, { label: "Active", value: metrics.organizations.active }), _jsx(Stat, { label: "Suspended", value: metrics.organizations.suspended }), _jsx(Stat, { label: "New (30 days)", value: metrics.organizations.last_30_days })] }) }), _jsx(Section, { title: "Platform totals", children: _jsxs("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4", children: [_jsx(Stat, { label: "Stores", value: metrics.totals.stores }), _jsx(Stat, { label: "Products", value: metrics.totals.products }), _jsx(Stat, { label: "Users", value: metrics.totals.users }), _jsx(Stat, { label: "Pending upgrades", value: metrics.pending_upgrade_requests })] }) }), _jsx(Section, { title: "Plans", children: Object.keys(metrics.plans).length === 0 ? (_jsx(EmptyState, { title: "No subscriptions yet" })) : (_jsx("ul", { className: "grid grid-cols-2 gap-2 text-sm lg:grid-cols-4", children: Object.entries(metrics.plans).map(([name, count]) => (_jsxs("li", { className: "flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2", children: [_jsx("span", { className: "font-medium", children: name }), _jsx("span", { className: "text-gray-500", children: count })] }, name))) })) })] }))] }));
}
