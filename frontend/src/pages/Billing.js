import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Badge, Button, EmptyState, Field, PageHeader, Section, Spinner, TextInput, toast, } from '../components/ui';
import { formatPHP } from '../utils/currency';
function limitLines(limits) {
    return [
        `${limits.max_stores ?? '—'} store${limits.max_stores === 1 ? '' : 's'}`,
        `${limits.max_products ?? '—'} products`,
        `${limits.max_users ?? '—'} users`,
        limits.wholesale ? 'Wholesale pricing' : null,
        limits.advanced_reports ? 'Advanced reports' : 'Basic reports',
    ].filter(Boolean);
}
export default function BillingPage() {
    const [plans, setPlans] = useState([]);
    const [sub, setSub] = useState(null);
    const [usage, setUsage] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [reqPlan, setReqPlan] = useState(null);
    const [reqNote, setReqNote] = useState('');
    const [busy, setBusy] = useState(false);
    const load = async () => {
        const [p, s, u, stores] = await Promise.all([
            api.get('/subscriptions/plans'),
            api.get('/subscriptions/current'),
            api.get('/subscriptions/usage'),
            api.get('/stores'),
        ]);
        setPlans(p.data.data ?? []);
        setSub(s.data.data);
        setUsage(u.data.data);
        setCanManage((stores.data.data ?? []).some((r) => ['owner', 'manager'].includes(String(r.role ?? '').toLowerCase())));
    };
    useEffect(() => {
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const requestUpgrade = async () => {
        if (!reqPlan)
            return;
        setBusy(true);
        setMsg('');
        try {
            await api.post('/subscriptions/request-upgrade', {
                plan: reqPlan,
                note: reqNote.trim() || undefined,
            });
            setReqPlan(null);
            setReqNote('');
            toast('success', 'Upgrade requested — an admin will apply it');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Request failed');
        }
        finally {
            setBusy(false);
        }
    };
    const downgrade = async () => {
        if (!window.confirm('Downgrade to Free now? Paid features lock immediately.'))
            return;
        setBusy(true);
        setMsg('');
        try {
            await api.post('/subscriptions/downgrade');
            toast('success', 'Downgraded to Free');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Downgrade failed');
        }
        finally {
            setBusy(false);
        }
    };
    const planName = sub?.plan?.name ?? '—';
    const effective = sub?.effective_plan ?? planName;
    const limited = !!sub?.downgraded;
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Billing", sub: "Plans, usage, and upgrades", actions: sub ? (_jsxs(Badge, { tone: limited ? 'amber' : 'green', children: [effective, limited ? ` · ${sub.downgraded}` : ''] })) : undefined }), loading ? (_jsx(Spinner, { label: "Loading billing\u2026" })) : !sub ? (_jsx(EmptyState, { title: "No subscription", hint: "Could not load billing." })) : (_jsxs("div", { className: "grid gap-4", children: [limited && (_jsxs("p", { className: "rounded-xl bg-amber-50 p-4 text-sm text-amber-700", children: ["Your ", sub.raw_plan?.name ?? 'paid', " plan is ", sub.downgraded, " \u2014 the store is running on Free limits until it is renewed. Paid features (all-stores reports, forecast, wholesale pricing) are locked."] })), sub.upgrade_request && (_jsxs("p", { className: "rounded-xl bg-sky-50 p-4 text-sm text-sky-800", children: ["Upgrade to ", sub.upgrade_request.plan, " requested", sub.upgrade_request.requested_at
                                ? ` on ${new Date(sub.upgrade_request.requested_at).toLocaleDateString()}`
                                : '', ' ', "\u2014 waiting for approval."] })), _jsx(Section, { title: "Current plan", action: sub.current_period_end ? (_jsxs("span", { className: "text-[13px] text-gray-500", children: ["Renews ", new Date(sub.current_period_end).toLocaleDateString()] })) : undefined, children: _jsxs("div", { className: "grid gap-1 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: planName }), _jsx("span", { className: "ml-2 text-gray-500", children: sub.status })] }), usage && (_jsx("ul", { className: "mt-2 space-y-1 text-[13px] text-gray-600", children: [
                                        ['Stores', usage.stores, sub.limits?.max_stores],
                                        ['Products', usage.products, sub.limits?.max_products],
                                        ['Team', usage.users, sub.limits?.max_users],
                                    ].map(([label, used, cap]) => (_jsxs("li", { className: "flex justify-between", children: [_jsx("span", { children: label }), _jsxs("span", { children: [used, cap != null ? ` / ${cap}` : ''] })] }, label))) }))] }) }), _jsxs(Section, { title: "Plans", children: [_jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: plans.map((p) => {
                                    const isCurrent = p.name === planName;
                                    const pending = sub.upgrade_request?.plan === p.name;
                                    return (_jsxs("div", { className: `rounded-xl border p-4 ${isCurrent ? 'border-primary' : 'border-gray-200'}`, children: [_jsxs("p", { className: "font-bold", children: [p.name, ' ', isCurrent && (_jsx(Badge, { tone: "green", children: "current" }))] }), _jsxs("p", { className: "mt-1 text-2xl font-bold", children: [formatPHP(p.price), _jsxs("span", { className: "text-sm font-normal text-gray-500", children: ["/", p.billing_interval] })] }), _jsx("ul", { className: "mt-2 space-y-1 text-[13px] text-gray-600", children: limitLines(p.feature_limits ?? {}).map((l) => (_jsxs("li", { children: ["\u00B7 ", l] }, l))) }), _jsxs("div", { className: "mt-3", children: [!isCurrent && canManage && p.name !== 'Free' && !pending && (_jsx(Button, { size: "compact", variant: "secondary", onClick: () => setReqPlan(p.name), children: "Request upgrade" })), pending && _jsx(Badge, { tone: "amber", children: "requested" })] })] }, p.id));
                                }) }), !canManage && (_jsx("p", { className: "mt-3 text-[13px] text-gray-500", children: "Owner or manager role required to change plans." }))] }), msg && _jsx("p", { className: "text-[13px] text-red-600", children: msg }), canManage && planName !== 'Free' && (_jsx("div", { children: _jsx(Button, { variant: "ghost", disabled: busy, onClick: downgrade, children: "Downgrade to Free" }) }))] })), reqPlan && (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "Request upgrade", className: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center", onClick: () => setReqPlan(null), children: _jsxs("div", { className: "w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("p", { className: "font-bold", children: ["Request ", reqPlan] }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Manual billing: an admin reviews and applies the plan. No payment is taken here." }), _jsx("div", { className: "mt-3", children: _jsx(Field, { label: "Note (optional)", children: _jsx(TextInput, { value: reqNote, onChange: (e) => setReqNote(e.target.value), placeholder: "e.g. need 2 more stores" }) }) }), _jsxs("div", { className: "mt-4 grid grid-cols-2 gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setReqPlan(null), children: "Cancel" }), _jsx(Button, { disabled: busy, onClick: requestUpgrade, children: busy ? 'Sending…' : 'Send request' })] })] }) }))] }));
}
