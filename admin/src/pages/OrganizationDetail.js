import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, EmptyState, PageHeader, Section, Spinner, Table } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';
function fmt(v) {
    if (v === null || v === undefined || v === '')
        return '—';
    return String(v);
}
export default function OrganizationDetailPage() {
    const { orgId } = useParams();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [msg, setMsg] = useState('');
    useEffect(() => {
        if (!orgId)
            return;
        api
            .get(`/admin/organizations/${orgId}`)
            .then((r) => setDetail(r.data.data))
            .catch((e) => {
            if (e.response?.status === 403)
                setDenied(true);
            else
                setMsg(e.response?.data?.error?.message ?? 'Load failed');
        })
            .finally(() => setLoading(false));
    }, [orgId]);
    if (denied)
        return _jsx(AccessDenied, {});
    const sub = detail?.subscription;
    const usage = detail?.usage ?? {};
    const limits = sub?.limits ?? {};
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: detail?.organization?.name ?? 'Organization', sub: "Profile, subscription, stores, members, and audit trail", actions: _jsx(Link, { to: "/organizations", className: "text-sm text-primary hover:underline", children: "\u2190 All organizations" }) }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), loading ? (_jsx(Spinner, { label: "Loading organization\u2026" })) : !detail ? (_jsx(EmptyState, { title: "Organization not found" })) : (_jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(Section, { title: "Profile", children: _jsxs("dl", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsx("dt", { className: "text-gray-500", children: "Status" }), _jsx("dd", { children: _jsx(Badge, { tone: detail.organization.status === 'active' ? 'green' : 'amber', children: detail.organization.status }) }), _jsx("dt", { className: "text-gray-500", children: "Slug" }), _jsx("dd", { children: fmt(detail.organization.slug) }), _jsx("dt", { className: "text-gray-500", children: "Created" }), _jsx("dd", { children: detail.organization.created_at
                                        ? new Date(detail.organization.created_at).toLocaleString()
                                        : '—' })] }) }), _jsx(Section, { title: "Subscription", children: _jsxs("dl", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsx("dt", { className: "text-gray-500", children: "Plan" }), _jsx("dd", { children: _jsxs(Badge, { tone: sub?.status === 'active' ? 'green' : 'amber', children: [sub?.plan ?? '—', sub?.effective_plan && sub.effective_plan !== sub.plan
                                                ? ` (effective: ${sub.effective_plan})`
                                                : ''] }) }), _jsx("dt", { className: "text-gray-500", children: "Status" }), _jsx("dd", { children: fmt(sub?.status) }), _jsx("dt", { className: "text-gray-500", children: "Provider" }), _jsx("dd", { children: fmt(sub?.provider) }), _jsx("dt", { className: "text-gray-500", children: "Renews" }), _jsx("dd", { children: sub?.current_period_end
                                        ? new Date(sub.current_period_end).toLocaleDateString()
                                        : '—' }), _jsx("dt", { className: "text-gray-500", children: "Downgraded" }), _jsx("dd", { children: fmt(sub?.downgraded) }), _jsx("dt", { className: "text-gray-500", children: "Upgrade request" }), _jsx("dd", { children: sub?.upgrade_request?.plan
                                        ? `${sub.upgrade_request.plan}${sub.upgrade_request.note ? ` · “${sub.upgrade_request.note}”` : ''}`
                                        : '—' })] }) }), _jsx(Section, { title: "Usage vs limits", children: _jsx("ul", { className: "space-y-1 text-[13px] text-gray-600", children: [
                                ['Stores', usage.stores, limits.max_stores],
                                ['Products', usage.products, limits.max_products],
                                ['Users', usage.users, limits.max_users],
                            ].map(([label, used, max]) => (_jsxs("li", { className: "flex justify-between", children: [_jsx("span", { children: label }), _jsxs("span", { children: [used ?? 0, " / ", fmt(max)] })] }, label))) }) }), _jsx(Section, { title: `Stores (${detail.stores.length})`, children: detail.stores.length === 0 ? (_jsx(EmptyState, { title: "No stores" })) : (_jsx("ul", { className: "divide-y divide-gray-100 text-sm", children: detail.stores.map((s) => (_jsxs("li", { className: "flex items-center justify-between py-2", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium", children: s.name }), _jsx("span", { className: "ml-2 text-xs text-gray-400", children: s.code })] }), _jsx(Badge, { tone: s.status === 'active' ? 'green' : 'gray', children: s.status })] }, s.id))) })) }), _jsx(Section, { title: `Members (${detail.members.length})`, children: detail.members.length === 0 ? (_jsx(EmptyState, { title: "No members" })) : (_jsx(Table, { head: ['Name', 'Status', 'Joined'], children: detail.members.map((m) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: m.full_name ?? m.id.slice(0, 8) }), _jsx("td", { className: "px-3 py-2 text-right", children: _jsx(Badge, { tone: m.status === 'active' ? 'green' : 'amber', children: m.status }) }), _jsx("td", { className: "px-3 py-2 text-right text-xs text-gray-500 last:pr-0", children: m.created_at ? new Date(m.created_at).toLocaleDateString() : '—' })] }, m.id))) })) }), _jsx(Section, { title: `Recent activity (${detail.audit_logs.length})`, children: detail.audit_logs.length === 0 ? (_jsx(EmptyState, { title: "No audit entries" })) : (_jsx("ul", { className: "divide-y divide-gray-100 text-sm", children: detail.audit_logs.map((a) => (_jsxs("li", { className: "flex items-start justify-between gap-2 py-2", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium", children: a.action }), _jsxs("span", { className: "text-xs text-gray-400", children: [" \u00B7 ", a.entity_type] })] }), _jsx("span", { className: "shrink-0 text-xs text-gray-400", children: a.created_at ? new Date(a.created_at).toLocaleString() : '—' })] }, a.id))) })) })] }))] }));
}
