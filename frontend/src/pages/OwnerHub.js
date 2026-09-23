import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore, confirmStoreSwitch } from '../stores/session';
import { Field, Modal, Spinner, TextInput, toast } from '../components/ui';
import { formatPHP } from '../utils/currency';
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
export default function OwnerHubPage() {
    const navigate = useNavigate();
    const { email, signOut } = useAuthStore();
    const setStore = useSessionStore((s) => s.setStore);
    const [branches, setBranches] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [hasMetrics, setHasMetrics] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [createErr, setCreateErr] = useState('');
    const [creating, setCreating] = useState(false);
    const [limitHit, setLimitHit] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setMsg('');
        try {
            const [branchRes, meRes, orgRes] = await Promise.all([
                api.get('/users/branch-stores'),
                api.get('/auth/me').catch(() => null),
                api.get('/organizations/current').catch(() => null),
            ]);
            const list = (branchRes.data.data ?? []);
            setBranches(list);
            setFullName(meRes?.data.data?.full_name ?? '');
            setOrgName(orgRes?.data.data?.name ?? list[0]?.name ?? 'Your business');
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
    const enterBranch = (id) => {
        if (!confirmStoreSwitch())
            return;
        setStore(id);
        navigate('/pos', { replace: true });
    };
    const logout = async () => {
        await signOut();
        navigate('/login', { replace: true });
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
    const welcome = fullName ? fullName.split(/\s+/)[0] : (email?.split('@')[0] ?? 'there');
    return (_jsxs("div", { className: "min-h-dvh bg-gray-50 text-gray-900", children: [_jsxs("div", { className: "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-8 md:py-12", children: [_jsxs("div", { className: "mb-8 flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight text-gray-900 md:text-4xl", children: orgName }), _jsxs("p", { className: "mt-1 text-sm text-gray-500", children: ["Welcome back, ", welcome] }), _jsx("p", { className: "mt-0.5 text-[13px] text-gray-400", children: "Pick a branch to open the store app, or jump into the owner console." })] }), _jsxs("button", { type: "button", onClick: logout, className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-100", children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("path", { d: "m16 17 5-5-5-5" }), _jsx("path", { d: "M21 12H9" })] }), "Sign out"] })] }), _jsxs(Link, { to: "/owner/console", className: "group mb-10 flex items-center gap-4 rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm transition hover:border-primary/40 hover:shadow md:px-6", children: [_jsx("span", { "aria-hidden": true, className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary", children: _jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5" })] }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-lg font-bold text-gray-900", children: "Owner Console" }), _jsx("p", { className: "truncate text-sm text-gray-500", children: "Branches, users, reports, subscription, and business settings." })] }), _jsx("span", { "aria-hidden": true, className: "text-primary transition group-hover:translate-x-0.5", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "m9 18 6-6-6-6" }) }) })] }), _jsxs("div", { className: "mb-4 flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Your branches" }), _jsxs("p", { className: "mt-0.5 text-sm text-gray-500", children: [branches.length, " branch", branches.length === 1 ? '' : 'es', !hasMetrics && branches.length > 0 && (_jsx("span", { className: "ml-2 text-gray-400", children: "\u00B7 Upgrade for sales & orders today" }))] })] }), _jsxs("button", { type: "button", onClick: () => {
                                    resetCreate();
                                    setShowAdd(true);
                                }, className: "inline-flex h-11 items-center gap-2 rounded-full border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-100", children: [_jsx("span", { "aria-hidden": true, children: "\uFF0B" }), " Add"] })] }), msg && (_jsx("p", { className: "mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700", children: msg })), loading ? (_jsx("div", { className: "rounded-3xl border border-gray-200 bg-white p-6", children: _jsx(Spinner, { label: "Loading branches\u2026" }) })) : branches.length === 0 ? (_jsxs("div", { className: "rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center", children: [_jsx("p", { className: "font-semibold text-gray-900", children: "No branches yet" }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Add your first branch to start selling." }), _jsx("button", { type: "button", onClick: () => {
                                    resetCreate();
                                    setShowAdd(true);
                                }, className: "mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover", children: "\uFF0B Add branch" })] })) : (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: branches.map((b) => {
                            const m = metrics[b.id];
                            return (_jsxs("article", { className: "flex flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${b.is_hq
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-gray-100 text-gray-500'}`, children: b.is_hq ? (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5Zm0 2h14v2H5v-2Z" }) })) : (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: _jsx("path", { d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" }) })) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "truncate font-bold text-gray-900", children: b.name }), b.is_hq && (_jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900", children: "HQ" }))] }), _jsx("p", { className: "mt-0.5 truncate text-[13px] text-gray-500", children: locationLine(b) })] })] }), _jsxs("div", { className: "mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-gray-400", children: "Sales today" }), _jsx("p", { className: "mt-1 text-xl font-bold text-gray-900", children: hasMetrics && m ? formatPHP(m.total) : '—' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-gray-400", children: "Orders today" }), _jsx("p", { className: "mt-1 text-xl font-bold text-gray-900", children: hasMetrics && m ? String(m.count) : '—' })] })] }), _jsxs("button", { type: "button", onClick: () => enterBranch(b.id), className: "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white shadow-sm hover:bg-primary-hover", children: ["Enter branch", _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "m9 18 6-6-6-6" }) })] })] }, b.id));
                        }) }))] }), showAdd && (_jsx(Modal, { title: "Add branch", onClose: () => setShowAdd(false), wide: true, header: _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-base font-bold text-gray-900", children: "Add branch" }), _jsx("p", { className: "truncate text-[13px] text-gray-500", children: "Create a new store location for your business." })] }), children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Branch name", children: _jsx(TextInput, { value: newName, autoFocus: true, onChange: (e) => setNewName(e.target.value), placeholder: "e.g. ATTN Store" }) }), _jsx(Field, { label: "Branch code", hint: "Unique within your business, e.g. BR-001.", children: _jsx(TextInput, { value: newCode, onChange: (e) => setNewCode(e.target.value.toUpperCase()), placeholder: "BR-001" }) }), _jsx(Field, { label: "Address", hint: "Shown on printed receipts.", children: _jsx(TextInput, { value: newAddress, onChange: (e) => setNewAddress(e.target.value), placeholder: "City / street" }) }), _jsx(Field, { label: "Phone", children: _jsx(TextInput, { value: newPhone, onChange: (e) => setNewPhone(e.target.value) }) }), limitHit && (_jsxs("p", { className: "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800", children: ["Plan limit reached \u2014 upgrade to add another branch.", ' ', _jsx(Link, { to: "/owner/console/subscription", className: "font-semibold text-primary underline", children: "View plans \u2192" })] })), createErr && (_jsx("p", { className: "text-[13px] text-red-600", children: createErr })), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { type: "button", disabled: creating || !newName.trim() || !newCode.trim(), onClick: createBranch, className: "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45", children: creating ? 'Creating…' : 'Add branch' }), _jsx("button", { type: "button", onClick: () => setShowAdd(false), className: "inline-flex h-11 items-center justify-center rounded-full border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-100", children: "Cancel" })] })] }) }))] }));
}
