import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { Badge, Button, EmptyState, PageHeader, Section, Spinner, Table, toast } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';
export default function UpgradeRequestsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [denied, setDenied] = useState(false);
    const load = async () => {
        const r = await api.get('/admin/upgrade-requests');
        setRequests(r.data.data ?? []);
    };
    useEffect(() => {
        load()
            .catch((e) => {
            if (e.response?.status === 403)
                setDenied(true);
            else
                setMsg(e.response?.data?.error?.message ?? 'Load failed');
        })
            .finally(() => setLoading(false));
    }, []);
    const approve = async (orgId, plan) => {
        setMsg('');
        try {
            await api.post(`/admin/organizations/${orgId}/subscription`, { plan });
            toast('success', `Approved — plan set to ${plan}`);
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Approve failed');
        }
    };
    const decline = async (orgId) => {
        setMsg('');
        try {
            await api.post(`/admin/upgrade-requests/${orgId}/decline`);
            toast('success', 'Request declined');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Decline failed');
        }
    };
    if (denied)
        return _jsx(AccessDenied, {});
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Upgrade requests", sub: "Approve or decline manual plan changes" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsx(Section, { title: requests.length > 0 ? `Pending (${requests.length})` : 'Pending', children: loading ? (_jsx(Spinner, { label: "Loading requests\u2026" })) : requests.length === 0 ? (_jsx(EmptyState, { title: "No pending upgrade requests" })) : (_jsx(Table, { head: ['Organization', 'Requested', ''], children: requests.map((r) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-3 py-2 first:pl-0", children: [_jsx(Link, { to: `/organizations/${r.organization_id}`, className: "font-medium text-primary hover:underline", children: r.organization_name ?? r.organization_id.slice(0, 8) }), _jsxs("p", { className: "text-xs text-gray-400", children: ["now ", r.plan ?? '—', r.request?.note ? ` · “${r.request.note}”` : ''] })] }), _jsx("td", { className: "px-3 py-2 text-right", children: _jsx(Badge, { tone: "amber", children: r.request?.plan }) }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsxs("span", { className: "inline-flex gap-1", children: [_jsx(Button, { size: "compact", onClick: () => approve(r.organization_id, r.request.plan), children: "Approve" }), _jsx(Button, { size: "compact", variant: "ghost", onClick: () => decline(r.organization_id), children: "Decline" })] }) })] }, r.organization_id))) })) })] }));
}
