import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '../lib/query-keys';
import { FEATURES, FEATURE_PERM_COUNT, MATRIX_ROLES, defaultMatrix, mergeMatrix, roleLabel, roleTone, } from '../lib/role-perms';
import { Badge, Button, EmptyState, Field, Modal, SearchInput, Select, Spinner, TextInput, toast, } from '../components/ui';
const ASSIGNABLE = ['owner', 'manager', 'cashier', 'inventory'];
const ROLE_CARDS = [
    { role: 'owner', title: 'Owner', desc: 'Full access to all features and settings', icon: '👑' },
    { role: 'manager', title: 'Manager', desc: 'Manage inventory, view reports, process voids/refunds', icon: '🛡️' },
    { role: 'cashier', title: 'Cashier', desc: 'POS operations, discounts, and credits', icon: '🧾' },
    { role: 'inventory', title: 'Staff', desc: 'Basic POS access only', icon: '👤' },
];
function initials(name, email) {
    const src = (name || email || '?').trim();
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
}
function relTime(iso) {
    if (!iso)
        return '—';
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return '—';
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1)
        return 'Just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)
        return '1d ago';
    if (days < 30)
        return `${days}d ago`;
    return new Date(t).toLocaleDateString();
}
function Toggle({ on, disabled, onChange, label, }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": label, disabled: disabled, onClick: () => onChange(!on), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-40 ${on ? 'bg-red-500' : 'bg-gray-300'}`, children: _jsx("span", { className: `inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}` }) }));
}
function PlanBanner({ planName, used, max, showUpgrade, }) {
    const full = max != null && used >= max;
    if (!full && !showUpgrade)
        return null;
    return (_jsxs("div", { className: "mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "mt-0.5 text-lg", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-amber-900", children: [planName, " Plan \u2014 ", used, "/", max ?? '—', " User", used === 1 && max === 1 ? '' : 's'] }), _jsx("p", { className: "text-[13px] text-amber-800", children: full
                                    ? 'Upgrade to add cashiers or staff members'
                                    : `Upgrade to add more users (currently ${used} of ${max ?? '—'})` })] })] }), _jsx(Link, { to: "/billing", className: "rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600", children: "Upgrade Now" })] }));
}
function UsersTab({ items, isOwner, onChangeRole, onRemove, changingId, }) {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [menuId, setMenuId] = useState(null);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((u) => {
            if (roleFilter !== 'all' && u.role !== roleFilter)
                return false;
            if (!q)
                return true;
            return ((u.full_name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q));
        });
    }, [items, search, roleFilter]);
    const counts = useMemo(() => {
        const map = {};
        for (const c of ROLE_CARDS) {
            map[c.role] = { active: 0, inactive: 0 };
        }
        for (const u of items) {
            if (!map[u.role])
                map[u.role] = { active: 0, inactive: 0 };
            if (u.status === 'active')
                map[u.role].active += 1;
            else
                map[u.role].inactive += 1;
        }
        return map;
    }, [items]);
    return (_jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsx(SearchInput, { label: "Search users", placeholder: "Search users by name or email\u2026", value: search, onChange: setSearch }) }), _jsxs(Select, { "aria-label": "Filter by role", className: "h-11 w-40", value: roleFilter, onChange: (e) => setRoleFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Roles" }), ASSIGNABLE.map((r) => (_jsx("option", { value: r, children: roleLabel(r) }, r)))] })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: ROLE_CARDS.map((card) => {
                    const c = counts[card.role] ?? { active: 0, inactive: 0 };
                    const total = c.active + c.inactive;
                    return (_jsxs("div", { className: "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsx("span", { "aria-hidden": true, className: `flex h-11 w-11 items-center justify-center rounded-xl text-lg ${card.role === 'owner'
                                            ? 'bg-indigo-50'
                                            : card.role === 'manager'
                                                ? 'bg-red-50'
                                                : card.role === 'cashier'
                                                    ? 'bg-rose-50'
                                                    : 'bg-sky-50'}`, children: card.icon }), _jsx("span", { className: "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600", children: total })] }), _jsx("p", { className: "mt-3 text-base font-bold text-gray-900", children: card.title }), _jsx("p", { className: "mt-1 min-h-10 text-xs leading-snug text-gray-500", children: card.desc }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-xs", children: [_jsxs("span", { className: "font-semibold text-emerald-700", children: [c.active, " active"] }), _jsxs("span", { className: "text-gray-400", children: [c.inactive, " inactive"] })] })] }, card.role));
                }) }), _jsx("div", { className: "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-100 bg-gray-50/80 text-xs text-gray-500", children: [_jsx("th", { scope: "col", className: "px-4 py-3 font-medium", children: "User" }), _jsx("th", { scope: "col", className: "px-4 py-3 font-medium", children: "Role" }), _jsx("th", { scope: "col", className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { scope: "col", className: "px-4 py-3 font-medium", children: "Last Login" }), _jsx("th", { scope: "col", className: "px-4 py-3 text-right font-medium", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-50", children: filtered.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, children: _jsx(EmptyState, { title: search || roleFilter !== 'all' ? 'No users match' : 'No users yet', hint: search || roleFilter !== 'all'
                                                ? 'Try a different search or filter.'
                                                : isOwner
                                                    ? 'Add a staff account by email.'
                                                    : undefined }) }) })) : (filtered.map((u) => (_jsxs("tr", { className: "hover:bg-gray-50/60", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white", children: initials(u.full_name, u.email) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "truncate font-semibold text-gray-900", children: [u.full_name || u.email || '—', u.is_self && (_jsx("span", { className: "ml-2 text-xs font-normal text-gray-400", children: "(you)" }))] }), u.email && (_jsx("p", { className: "truncate text-xs text-gray-400", children: u.email }))] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx(Badge, { tone: roleTone(u.role), children: roleLabel(u.role) }) }), _jsx("td", { className: "px-4 py-3", children: _jsx(Badge, { tone: u.status === 'active' ? 'green' : 'red', children: u.status === 'active' ? '● Active' : u.status }) }), _jsx("td", { className: "px-4 py-3 text-[13px] text-gray-500", children: relTime(u.last_login) }), _jsxs("td", { className: "relative px-4 py-3 text-right", children: [_jsx("button", { type: "button", "aria-label": `Actions for ${u.full_name || u.email || 'user'}`, onClick: () => setMenuId(menuId === u.id ? null : u.id), className: "rounded-full border border-gray-200 px-3 py-1 text-gray-500 hover:bg-gray-100", children: "\u00B7\u00B7\u00B7" }), menuId === u.id && (_jsxs("div", { className: "absolute right-4 top-12 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg", children: [_jsxs("div", { className: "px-3 py-2", children: [_jsx("label", { className: "mb-1 block text-[11px] font-medium uppercase text-gray-400", children: "Role" }), _jsx(Select, { "aria-label": `Change role for ${u.full_name || u.email || 'user'}`, className: "h-9", value: u.role, disabled: changingId === u.id, onChange: (e) => {
                                                                        setMenuId(null);
                                                                        onChangeRole(u.id, e.target.value);
                                                                    }, children: ASSIGNABLE.map((r) => (_jsx("option", { value: r, children: roleLabel(r) }, r))) })] }), isOwner && !u.is_self && (_jsx("button", { type: "button", className: "block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50", onClick: () => {
                                                                setMenuId(null);
                                                                onRemove(u);
                                                            }, children: "Remove user" }))] }))] })] }, u.id)))) })] }) }) }), _jsxs("p", { className: "text-xs text-gray-400", children: ["Showing ", filtered.length, " of ", items.length, " user", items.length === 1 ? '' : 's'] })] }));
}
function RolesTab({ matrix, counts, disabled, onToggle, saving, }) {
    return (_jsxs("div", { className: "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[640px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-200 bg-gray-50/80 text-xs text-gray-500", children: [_jsx("th", { scope: "col", className: "px-4 py-3 font-medium", children: "Page / Feature" }), MATRIX_ROLES.map((r) => (_jsxs("th", { scope: "col", className: "px-4 py-3 text-center font-medium", children: [_jsx("span", { className: "block text-sm font-semibold text-gray-800", children: r.label }), _jsxs("span", { className: "block font-normal text-gray-400", children: [counts[r.key] ?? 0, " users"] })] }, r.key)))] }) }), _jsx("tbody", { className: "divide-y divide-gray-50", children: FEATURES.map((f) => (_jsxs("tr", { className: "hover:bg-gray-50/50", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M8 1.5l5.5 2.5v4c0 3.5-2.4 5.8-5.5 6.5-3.1-.7-5.5-3-5.5-6.5V4L8 1.5z" }) }) }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-gray-900", children: f.label }), _jsx("p", { className: "text-xs text-gray-400", children: f.path })] })] }) }), MATRIX_ROLES.map((r) => {
                                        const on = matrix[f.key]?.[r.key] ?? false;
                                        return (_jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx(Toggle, { on: on, disabled: disabled, label: `${f.label} for ${r.label}`, onChange: (v) => onToggle(f.key, r.key, v) }), _jsxs("span", { className: "text-[11px] text-gray-400", children: [FEATURE_PERM_COUNT[f.key], " perm", FEATURE_PERM_COUNT[f.key] === 1 ? '' : 's'] })] }) }, r.key));
                                    })] }, f.key))) })] }) }), _jsxs("p", { className: "border-t border-gray-100 px-4 py-3 text-xs text-gray-400", children: ["Owner always has full access. Changes save automatically for this business and control what each role sees in the app navigation and API access.", saving ? ' Saving…' : ''] })] }));
}
export default function UsersPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState('users');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [orgId, setOrgId] = useState(localStorage.getItem('ventapos:orgId'));
    const [sub, setSub] = useState(null);
    const [usage, setUsage] = useState(null);
    const [matrix, setMatrix] = useState(() => defaultMatrix());
    const [savingPerms, setSavingPerms] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('cashier');
    const [addErr, setAddErr] = useState('');
    const [adding, setAdding] = useState(false);
    const [changingId, setChangingId] = useState(null);
    const load = async () => {
        const [u, stores, s, usageRes, perms] = await Promise.all([
            api.get('/users'),
            api.get('/stores').catch(() => ({ data: { data: [] } })),
            api.get('/subscriptions/current').catch(() => ({ data: { data: null } })),
            api.get('/subscriptions/usage').catch(() => ({ data: { data: null } })),
            api.get('/users/role-permissions').catch(() => ({ data: { data: null } })),
        ]);
        setItems(u.data.data ?? []);
        const list = stores.data.data ?? [];
        setIsOwner(list.some((s) => s.role === 'owner'));
        setSub(s.data.data);
        setUsage(usageRes.data.data);
        const oid = localStorage.getItem('ventapos:orgId');
        setOrgId(oid);
        setMatrix(mergeMatrix(perms.data.data));
    };
    useEffect(() => {
        load()
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
    }, []);
    const roleCounts = useMemo(() => {
        const c = { manager: 0, cashier: 0, staff: 0, owner: 0 };
        for (const u of items) {
            if (u.role === 'inventory')
                c.staff += 1;
            else if (u.role in c)
                c[u.role] += 1;
        }
        return c;
    }, [items]);
    const planName = sub?.effective_plan || sub?.plan?.name || 'Free';
    const maxUsers = sub?.limits?.max_users ?? null;
    const usedUsers = usage?.users ?? items.length;
    const atLimit = maxUsers != null && usedUsers >= maxUsers;
    const togglePerm = (feature, roleKey, value) => {
        setMatrix((prev) => {
            const next = {
                ...prev,
                [feature]: {
                    ...prev[feature],
                    [roleKey]: value,
                },
            };
            setSavingPerms(true);
            api
                .put('/users/role-permissions', next)
                .then(() => {
                qc.invalidateQueries({ queryKey: [...qk.rolePerms, orgId ?? 'none'] });
            })
                .catch((e) => {
                setMsg(e.response?.data?.error?.message ?? 'Could not save permissions');
                setMatrix(prev);
            })
                .finally(() => setSavingPerms(false));
            return next;
        });
    };
    const resetAdd = () => {
        setEmail('');
        setRole('cashier');
        setAddErr('');
    };
    const add = async () => {
        const value = email.trim();
        if (!value) {
            setAddErr('Email is required.');
            return;
        }
        setAdding(true);
        setAddErr('');
        try {
            await api.post('/users', { email: value, role });
            setShowAdd(false);
            resetAdd();
            toast('success', 'User added');
            await load();
        }
        catch (e) {
            const status = e.response?.status;
            if (status === 404) {
                setAddErr('No account with that email. Ask them to register first, then try again.');
            }
            else if (status === 409) {
                setAddErr(e.response?.data?.error?.message ?? 'Already a member.');
            }
            else if (status === 403) {
                setAddErr(e.response?.data?.error?.message ??
                    'Plan limit reached — upgrade to add more users.');
            }
            else {
                setAddErr(e.response?.data?.error?.message ?? 'Could not add user');
            }
        }
        finally {
            setAdding(false);
        }
    };
    const changeRole = async (id, next) => {
        if (!next)
            return;
        setChangingId(id);
        setMsg('');
        try {
            await api.patch(`/users/${id}`, { role: next });
            toast('success', 'Role updated');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not change role');
            await load();
        }
        finally {
            setChangingId(null);
        }
    };
    const remove = async (u) => {
        const label = u.full_name || u.email || 'this user';
        if (!window.confirm(`Remove ${label} from this business?`))
            return;
        setMsg('');
        try {
            await api.delete(`/users/${u.id}`);
            toast('success', 'User removed');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not remove user');
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": true, className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-xl", children: "\uD83D\uDC65" }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold tracking-tight md:text-2xl", children: "User Management" }), _jsx("p", { className: "mt-0.5 text-sm text-gray-500", children: "Manage store users and access permissions" })] })] }), _jsxs(Button, { disabled: !isOwner || atLimit, title: !isOwner ? 'Only owners can add users' : atLimit ? 'Upgrade plan to add users' : undefined, onClick: () => {
                            resetAdd();
                            setShowAdd(true);
                        }, children: [_jsx("span", { className: "mr-1.5", "aria-hidden": true, children: "\uFF0B" }), " Add User"] })] }), _jsx("div", { className: "mb-5 inline-flex rounded-full bg-slate-900 p-1", children: [
                    { key: 'users', label: 'Users', icon: '👥' },
                    { key: 'roles', label: 'Roles', icon: '🛡️' },
                ].map((t) => (_jsxs("button", { type: "button", "aria-pressed": tab === t.key, onClick: () => setTab(t.key), className: `flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t.key
                        ? 'bg-red-500 text-white shadow'
                        : 'text-slate-300 hover:text-white'}`, children: [_jsx("span", { "aria-hidden": true, children: t.icon }), t.label] }, t.key))) }), _jsx(PlanBanner, { planName: planName, used: usedUsers, max: maxUsers, showUpgrade: true }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), !isOwner && !loading && tab === 'users' && (_jsx("p", { className: "mb-4 rounded-xl bg-gray-100 p-4 text-sm text-gray-600", children: "Only an owner can add users or change roles. You can still see the team list." })), loading ? (_jsx(Spinner, { label: "Loading users\u2026" })) : tab === 'users' ? (_jsx(UsersTab, { items: items, isOwner: isOwner, onChangeRole: changeRole, onRemove: remove, changingId: changingId })) : (_jsx(RolesTab, { matrix: matrix, counts: roleCounts, disabled: !isOwner, onToggle: togglePerm, saving: savingPerms })), showAdd && (_jsx(Modal, { title: "Add user", onClose: () => setShowAdd(false), children: _jsxs("div", { className: "grid gap-3", children: [_jsx("p", { className: "text-[13px] text-gray-500", children: "They must already have a VentaPOS account. Enter the email they registered with \u2014 no invite email is sent." }), _jsx(Field, { label: "Email", error: addErr || undefined, children: _jsx(TextInput, { type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === 'Enter' && add() }) }), _jsx(Field, { label: "Role", hint: "Owner: full access. Manager: run the store. Cashier: POS. Staff: basic POS.", children: _jsx(Select, { value: role, onChange: (e) => setRole(e.target.value), children: ASSIGNABLE.map((r) => (_jsx("option", { value: r, children: roleLabel(r) }, r))) }) }), _jsx(Button, { disabled: adding || !email.trim() || atLimit, onClick: add, children: adding ? 'Adding…' : 'Add user' }), atLimit && (_jsxs("p", { className: "text-xs text-amber-700", children: ["Plan user limit reached.", ' ', _jsx(Link, { to: "/billing", className: "font-semibold underline", children: "Upgrade" }), ' ', "to add more."] }))] }) }))] }));
}
