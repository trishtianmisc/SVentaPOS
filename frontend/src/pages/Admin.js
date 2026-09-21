import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Badge, Button, EmptyState, PageHeader, Section, Select, Spinner, Table, toast } from '../components/ui';
export default function AdminPage() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [sel, setSel] = useState({});
    const [msg, setMsg] = useState('');
    const [denied, setDenied] = useState(false);
    const load = async () => {
        const [o, p] = await Promise.all([
            api.get('/admin/organizations'),
            api.get('/subscriptions/plans'),
        ]);
        setOrgs(o.data.data);
        setPlans(p.data.data);
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
    const setPlan = async (orgId) => {
        const plan = sel[orgId];
        if (!plan)
            return;
        setMsg('');
        try {
            await api.post(`/admin/organizations/${orgId}/subscription`, { plan });
            toast('success', `Plan set to ${plan}`);
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Update failed');
        }
    };
    if (denied) {
        return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Admin", sub: "Platform administration" }), _jsx("p", { className: "text-sm text-gray-500", children: "Platform administrators only. Your account is not allowlisted." })] }));
    }
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Admin", sub: "Organizations, plans, and usage" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsx(Section, { title: "Organizations", children: loading ? (_jsx(Spinner, { label: "Loading organizations\u2026" })) : orgs.length === 0 ? (_jsx(EmptyState, { title: "No organizations found" })) : (_jsx(Table, { head: ['Organization', 'Plan', 'Usage', ''], children: orgs.map((o) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 first:pl-0", children: o.organization.name }), _jsx("td", { className: "px-3 py-2 text-right", children: _jsxs(Badge, { tone: o.status === 'active' ? 'green' : 'amber', children: [o.plan ?? '—', " \u00B7 ", o.status ?? ''] }) }), _jsx("td", { className: "px-3 py-2 text-right text-xs text-gray-500", children: o.usage
                                    ? `${o.usage.stores ?? '?'} st · ${o.usage.products ?? '?'} pr · ${o.usage.users ?? '?'} users`
                                    : '—' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: _jsxs("span", { className: "inline-flex gap-2", children: [_jsxs(Select, { "aria-label": "Plan", className: "h-9", value: sel[o.organization.id] ?? '', onChange: (e) => setSel({ ...sel, [o.organization.id]: e.target.value }), children: [_jsx("option", { value: "", children: "Set plan\u2026" }), plans.map((p) => (_jsx("option", { value: p.name, children: p.name }, p.id)))] }), _jsx(Button, { size: "compact", disabled: !sel[o.organization.id], onClick: () => setPlan(o.organization.id), children: "Apply" })] }) })] }, o.organization.id))) })) })] }));
}
