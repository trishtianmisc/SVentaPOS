import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { useSessionStore, confirmStoreSwitch } from '../../stores/session';
import { Field, Modal, Spinner, TextInput, toast } from '../../components/ui';
import { KpiCard } from '../../components/KpiCard';
import { formatPHP } from '../../utils/currency';
function todayIso() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
function locationLine(b) {
    const parts = [b.address, b.code].filter(Boolean);
    return parts.length ? parts.join(' · ') : b.name;
}
function Segmented({ value, onChange, options, }) {
    return (_jsx("div", { className: "inline-flex h-11 items-center rounded-full bg-gray-100 p-1 dark:bg-[#1a1a1e]", children: options.map((o) => (_jsx("button", { type: "button", onClick: () => onChange(o.value), "aria-pressed": value === o.value, className: `h-9 rounded-full px-4 text-sm font-semibold transition ${value === o.value
                ? 'bg-primary text-white shadow'
                : 'text-gray-600 hover:text-gray-900 dark:text-[#9b958c] dark:hover:text-[#e8e4dc]'}`, children: o.label }, o.value))) }));
}
export default function ConsoleBranchesPage() {
    const navigate = useNavigate();
    const setStore = useSessionStore((s) => s.setStore);
    const [branches, setBranches] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [hasMetrics, setHasMetrics] = useState(false);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [view, setView] = useState('grid');
    const [tab, setTab] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [createErr, setCreateErr] = useState('');
    const [creating, setCreating] = useState(false);
    const [limitHit, setLimitHit] = useState(false);
    const [maxStores, setMaxStores] = useState(null);
    const load = useCallback(async () => {
        setLoading(true);
        setMsg('');
        try {
            const [branchRes] = await Promise.all([
                api.get('/users/branch-stores').catch(() => ({ data: { data: [] } })),
            ]);
            setBranches((branchRes.data.data ?? []));
            api
                .get('/subscriptions/current')
                .then((r) => {
                const lim = r.data.data?.limits ?? {};
                setMaxStores(typeof lim.stores === 'number' ? lim.stores : null);
            })
                .catch(() => undefined);
            try {
                const day = todayIso();
                const sales = await api.get('/reports/consolidated/sales', {
                    params: { from: day, to: day },
                });
                const byStore = sales.data.data?.by_store ?? [];
                const next = {};
                for (const row of byStore) {
                    next[row.store_id] = {
                        total: Number(row.total) || 0,
                        count: Number(row.count) || 0,
                    };
                }
                setMetrics(next);
                setHasMetrics(true);
            }
            catch {
                setMetrics({});
                setHasMetrics(false);
            }
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not load branches.');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    const totalSales = Object.values(metrics).reduce((a, m) => a + m.total, 0);
    const totalOrders = Object.values(metrics).reduce((a, m) => a + m.count, 0);
    const avgSale = totalOrders > 0 ? totalSales / totalOrders : 0;
    const limitReached = maxStores !== null && branches.length >= maxStores;
    const enterBranch = (id) => {
        if (!confirmStoreSwitch())
            return;
        setStore(id);
        navigate('/pos', { replace: true });
    };
    const resetCreate = () => {
        setNewName('');
        setNewCode('');
        setNewAddress('');
        setNewPhone('');
        setCreateErr('');
        setLimitHit(false);
    };
    const createBranch = async () => {
        const name = newName.trim();
        const code = newCode.trim().toUpperCase();
        if (!name || !code) {
            setCreateErr('Branch name and code are required.');
            return;
        }
        setCreating(true);
        setCreateErr('');
        setLimitHit(false);
        try {
            await api.post('/stores', {
                name,
                code,
                address: newAddress.trim() || undefined,
                phone: newPhone.trim() || undefined,
            });
            setShowAdd(false);
            resetCreate();
            toast('success', 'Branch added');
            await load();
        }
        catch (e) {
            if (e.response?.status === 403)
                setLimitHit(true);
            setCreateErr(e.response?.status === 409
                ? 'Branch code already exists.'
                : (e.response?.data?.error?.message ?? 'Could not add branch'));
        }
        finally {
            setCreating(false);
        }
    };
    const dash = '—';
    const perf = [...branches].sort((a, b) => (metrics[b.id]?.total ?? 0) - (metrics[a.id]?.total ?? 0));
    const shown = tab === 'performance' ? perf : branches;
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsxs("div", { className: "mb-6 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-[#15243a] dark:text-[#60a5fa]", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight text-gray-900 dark:text-white", children: "Branches" }), _jsx("p", { className: "mt-0.5 text-sm text-gray-500 dark:text-[#9b958c]", children: "Your store locations." })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "inline-flex h-10 items-center rounded-full border border-gray-200 bg-white p-1 dark:border-[#2a2a2e] dark:bg-[#141416]", role: "group", "aria-label": "Branch view", children: [_jsx("button", { type: "button", "aria-label": "Grid view", "aria-pressed": view === 'grid', onClick: () => setView('grid'), className: `flex h-8 w-8 items-center justify-center rounded-full ${view === 'grid'
                                            ? 'bg-primary text-white'
                                            : 'text-gray-500 dark:text-[#6f6a62]'}`, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" })] }) }), _jsx("button", { type: "button", "aria-label": "List view", "aria-pressed": view === 'list', onClick: () => setView('list'), className: `flex h-8 w-8 items-center justify-center rounded-full ${view === 'list'
                                            ? 'bg-primary text-white'
                                            : 'text-gray-500 dark:text-[#6f6a62]'}`, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" }) }) })] }), _jsxs("button", { type: "button", onClick: () => {
                                    resetCreate();
                                    setShowAdd(true);
                                }, className: "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover", children: [_jsx("span", { "aria-hidden": true, children: "\uFF0B" }), " Add Branch"] })] })] }), _jsxs("div", { className: "mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiCard, { tone: "blue", label: "Branches", value: maxStores !== null
                            ? `${branches.length} of ${maxStores}`
                            : String(branches.length), hint: limitReached ? '' : hasMetrics ? 'Active locations' : 'Upgrade for branch metrics', badge: limitReached ? 'Branch limit reached' : undefined, icon: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) }) }), _jsx(KpiCard, { tone: "green", label: "Sales", value: hasMetrics ? formatPHP(totalSales) : dash, hint: "Today, all branches", icon: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 2v20M17 7H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7H6" }) }) }), _jsx(KpiCard, { tone: "amber", label: "Orders", value: hasMetrics ? String(totalOrders) : dash, hint: "Today, all branches", icon: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "4", y: "3", width: "16", height: "18", rx: "2" }), _jsx("path", { d: "M8 7h8M8 11h8M8 15h5" })] }) }), _jsx(KpiCard, { tone: "teal", label: "Avg sale", value: hasMetrics ? formatPHP(avgSale) : dash, hint: "Today, per order", icon: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M3 12h4l3-8 4 16 3-8h4" }) }) })] }), _jsx("div", { className: "mb-5", children: _jsx(Segmented, { value: tab, onChange: (v) => setTab(v), options: [
                        { value: 'all', label: 'All branches' },
                        { value: 'performance', label: 'Performance' },
                    ] }) }), msg && (_jsx("p", { className: "mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-[#3a2420] dark:bg-[#1a1210] dark:text-[#f0a090]", children: msg })), loading ? (_jsx("div", { className: "rounded-3xl border border-gray-200 bg-white p-6 dark:border-[#1e1e22] dark:bg-[#121214]", children: _jsx(Spinner, { label: "Loading branches\u2026" }) })) : shown.length === 0 ? (_jsxs("div", { className: "rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-[#2a2a2e] dark:bg-[#121214]", children: [_jsx("p", { className: "font-semibold text-gray-900 dark:text-white", children: "No branches yet" }), _jsx("p", { className: "mt-1 text-sm text-gray-500 dark:text-[#9b958c]", children: "Add your first branch to start selling." }), _jsx("button", { type: "button", onClick: () => {
                            resetCreate();
                            setShowAdd(true);
                        }, className: "mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover", children: "\uFF0B Add branch" })] })) : (_jsx("div", { className: view === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid gap-3', children: shown.map((b) => {
                    const m = metrics[b.id];
                    return (_jsxs("article", { className: "flex flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1e1e22] dark:bg-[#121214] dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${b.is_hq
                                            ? 'bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#E8A100]'
                                            : 'bg-gray-100 text-gray-500 dark:bg-[#1a1a1e] dark:text-[#9b958c]'}`, children: b.is_hq ? (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5Zm0 2h14v2H5v-2Z" }) })) : (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) })) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "truncate font-bold text-gray-900 dark:text-white", children: b.name }), b.is_hq && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-[#E8A100] dark:text-[#1a1400]", children: "HQ" }))] }), _jsxs("p", { className: "mt-0.5 flex items-center gap-1 truncate text-[13px] text-gray-500 dark:text-[#6f6a62]", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" }), _jsx("circle", { cx: "12", cy: "10", r: "2.5" })] }), locationLine(b)] })] }), _jsx("button", { type: "button", "aria-label": `Actions for ${b.name}`, className: "rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:text-[#6f6a62] dark:hover:bg-[#1a1a1e]", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "5", r: "1.8" }), _jsx("circle", { cx: "12", cy: "12", r: "1.8" }), _jsx("circle", { cx: "12", cy: "19", r: "1.8" })] }) })] }), _jsxs("div", { className: "mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-[#0e0e10]", children: [_jsx("p", { className: "text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-[#6f6a62]", children: "Sales today" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-gray-900 dark:text-white", children: hasMetrics && m ? formatPHP(m.total) : dash }), _jsxs("p", { className: "mt-1 text-[13px] text-gray-500 dark:text-[#6f6a62]", children: [hasMetrics && m ? m.count : 0, " order", (hasMetrics ? m?.count : 0) === 1 ? '' : 's', " \u00B7", ' ', hasMetrics && m?.profit != null ? formatPHP(m.profit) : dash, " profit"] })] }), _jsxs("div", { className: "mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-[#1a1a1e]", children: [_jsx("span", { className: "text-[13px] text-gray-500 dark:text-[#6f6a62]", children: b.code ?? '' }), _jsxs("button", { type: "button", onClick: () => enterBranch(b.id), className: "inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline", children: ["View", _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M7 17 17 7M9 7h8v8" }) })] })] })] }, b.id));
                }) })), !loading && branches.length > 0 && !hasMetrics && (_jsxs("p", { className: "mt-4 text-sm text-gray-500 dark:text-[#9b958c]", children: ["Sales & orders today require a paid plan.", ' ', _jsx(Link, { to: "/owner/console/subscription", className: "font-semibold text-primary hover:underline", children: "Upgrade \u2192" })] })), showAdd && (_jsx(Modal, { title: "Add Branch", onClose: () => setShowAdd(false), wide: true, children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Branch name", children: _jsx(TextInput, { value: newName, autoFocus: true, onChange: (e) => setNewName(e.target.value), placeholder: "e.g. ATTN Store" }) }), _jsx(Field, { label: "Branch code", hint: "Unique within your business, e.g. BR-001.", children: _jsx(TextInput, { value: newCode, onChange: (e) => setNewCode(e.target.value.toUpperCase()), placeholder: "BR-001" }) }), _jsx(Field, { label: "Address", hint: "Shown on printed receipts.", children: _jsx(TextInput, { value: newAddress, onChange: (e) => setNewAddress(e.target.value), placeholder: "City / street" }) }), _jsx(Field, { label: "Phone", children: _jsx(TextInput, { value: newPhone, onChange: (e) => setNewPhone(e.target.value) }) }), limitHit && (_jsxs("p", { className: "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-[#3a3010] dark:bg-[#1a1608] dark:text-[#e8c86a]", children: ["Plan limit reached \u2014 upgrade to add another branch.", ' ', _jsx(Link, { to: "/owner/console/subscription", className: "font-semibold underline", children: "View plans \u2192" })] })), createErr && (_jsx("p", { className: "text-[13px] text-red-600 dark:text-[#f0a090]", children: createErr })), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { type: "button", disabled: creating || !newName.trim() || !newCode.trim(), onClick: createBranch, className: "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45", children: creating ? 'Creating…' : 'Add Branch' }), _jsx("button", { type: "button", onClick: () => setShowAdd(false), className: "inline-flex h-11 items-center justify-center rounded-full border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#2a2a2e] dark:text-[#e8e4dc] dark:hover:bg-[#1c1c20]", children: "Cancel" })] })] }) }))] }));
}
