import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '../lib/query-keys';
import { FEATURES, FEATURE_PERM_COUNT, MATRIX_ROLES, defaultMatrix, mergeMatrix, roleLabel, roleTone, } from '../lib/role-perms';
import { Badge, Button, EmptyState, Modal, PasswordInput, SearchInput, Select, Spinner, toast, } from '../components/ui';
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
    const [branchStores, setBranchStores] = useState([]);
    const [storeId, setStoreId] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('cashier');
    const [password, setPassword] = useState('');
    const [addErr, setAddErr] = useState('');
    const [adding, setAdding] = useState(false);
    const [changingId, setChangingId] = useState(null);
    const [invites, setInvites] = useState([]);
    const [lastInviteUrl, setLastInviteUrl] = useState(null);
    const load = async () => {
        const [u, stores, s, usageRes, perms, inv, branches] = await Promise.all([
            api.get('/users'),
            api.get('/stores').catch(() => ({ data: { data: [] } })),
            api.get('/subscriptions/current').catch(() => ({ data: { data: null } })),
            api.get('/subscriptions/usage').catch(() => ({ data: { data: null } })),
            api.get('/users/role-permissions').catch(() => ({ data: { data: null } })),
            api.get('/users/invites').catch(() => ({ data: { data: [] } })),
            api.get('/users/branch-stores').catch(() => ({ data: { data: [] } })),
        ]);
        setItems(u.data.data ?? []);
        setInvites(inv.data.data ?? []);
        const list = stores.data.data ?? [];
        setIsOwner(list.some((s) => s.role === 'owner'));
        const branchList = (branches.data.data ?? []);
        setBranchStores(branchList);
        if (!storeId && branchList.length)
            setStoreId(branchList[0].id);
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
        setStoreId(branchStores[0]?.id ?? '');
        setFullName('');
        setEmail('');
        setPhone('');
        setRole('cashier');
        setPassword('');
        setAddErr('');
    };
    const add = async () => {
        const value = email.trim();
        const name = fullName.trim();
        if (!storeId) {
            setAddErr('Branch assignment is required.');
            return;
        }
        if (!name) {
            setAddErr('Full name is required.');
            return;
        }
        if (!value) {
            setAddErr('Email is required.');
            return;
        }
        if (!password || password.length < 6) {
            setAddErr('Password must be at least 6 characters.');
            return;
        }
        setAdding(true);
        setAddErr('');
        setLastInviteUrl(null);
        try {
            const res = await api.post('/users', {
                store_id: storeId,
                full_name: name,
                email: value,
                phone: phone.trim() || null,
                role,
                password,
            });
            const data = res.data.data;
            const message = res.data.message ?? 'User added';
            setShowAdd(false);
            resetAdd();
            if (data?.status === 'invited' && data?.invite_url) {
                setLastInviteUrl(data.invite_url);
                toast('success', 'Invite sent — share the link if email fails');
            }
            else {
                toast('success', message || 'Account created');
            }
            await load();
        }
        catch (e) {
            const status = e.response?.status;
            if (status === 409) {
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
    const copyInvite = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            toast('success', 'Invite link copied');
        }
        catch {
            toast('error', 'Could not copy — select the link manually');
        }
    };
    const resendInvite = async (id) => {
        setMsg('');
        try {
            const res = await api.post(`/users/invites/${id}/resend`);
            if (res.data.data?.invite_url)
                setLastInviteUrl(res.data.data.invite_url);
            toast('success', 'Invite resent');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not resend invite');
        }
    };
    const revokeInvite = async (id) => {
        setMsg('');
        try {
            await api.delete(`/users/invites/${id}`);
            toast('success', 'Invite revoked');
            await load();
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not revoke invite');
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
                        }, children: [_jsx("span", { className: "mr-1.5", "aria-hidden": true, children: "\uFF0B" }), " Add Team Member"] })] }), _jsx("div", { className: "mb-5 inline-flex rounded-full bg-gray-100 p-1", children: [
                    { key: 'users', label: 'Users', icon: '👥' },
                    { key: 'roles', label: 'Roles', icon: '🛡️' },
                ].map((t) => (_jsxs("button", { type: "button", "aria-pressed": tab === t.key, onClick: () => setTab(t.key), className: `flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t.key
                        ? 'bg-primary text-white shadow'
                        : 'text-gray-600 hover:text-gray-900'}`, children: [_jsx("span", { "aria-hidden": true, children: t.icon }), t.label] }, t.key))) }), _jsx(PlanBanner, { planName: planName, used: usedUsers, max: maxUsers, showUpgrade: true }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), lastInviteUrl && (_jsxs("div", { className: "mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-emerald-900", children: "Invite ready" }), _jsx("p", { className: "mb-2 text-[13px] text-emerald-800", children: "Email may be disabled in Supabase \u2014 share this link directly." }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("code", { className: "min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs text-gray-700", children: lastInviteUrl }), _jsx(Button, { size: "compact", variant: "secondary", onClick: () => copyInvite(lastInviteUrl), children: "Copy link" }), _jsx("button", { type: "button", className: "text-xs text-gray-500 underline", onClick: () => setLastInviteUrl(null), children: "Dismiss" })] })] })), !isOwner && !loading && tab === 'users' && (_jsx("p", { className: "mb-4 rounded-xl bg-gray-100 p-4 text-sm text-gray-600", children: "Only an owner can add users or change roles. You can still see the team list." })), loading ? (_jsx(Spinner, { label: "Loading users\u2026" })) : tab === 'users' ? (_jsxs(_Fragment, { children: [_jsx(UsersTab, { items: items, isOwner: isOwner, onChangeRole: changeRole, onRemove: remove, changingId: changingId }), isOwner && invites.length > 0 && (_jsxs("div", { className: "mt-6 grid gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-sm font-semibold text-gray-800", children: ["Pending invites (", invites.length, ")"] }), _jsx("span", { className: "text-xs text-gray-400", children: "Links expire in 7 days" })] }), _jsx("div", { className: "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm", children: _jsx("ul", { className: "divide-y divide-gray-50", children: invites.map((inv) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-4 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-gray-900", children: inv.email }), _jsxs("span", { className: "text-xs text-gray-400", children: [_jsx(Badge, { tone: roleTone(inv.role), children: roleLabel(inv.role) }), _jsx("span", { className: "ml-2", children: inv.expires_at
                                                                    ? `expires ${relTime(inv.expires_at)}`
                                                                    : '' })] })] }), _jsxs("div", { className: "flex shrink-0 gap-2", children: [_jsx(Button, { size: "compact", variant: "secondary", onClick: () => resendInvite(inv.id), children: "Resend" }), _jsx(Button, { size: "compact", variant: "danger", onClick: () => revokeInvite(inv.id), children: "Revoke" })] })] }, inv.id))) }) })] }))] })) : (_jsx(RolesTab, { matrix: matrix, counts: roleCounts, disabled: !isOwner, onToggle: togglePerm, saving: savingPerms })), showAdd && (_jsx(Modal, { title: "Add Team Member", onClose: () => setShowAdd(false), wide: true, panelClassName: "bg-[#FAF7F2]", header: _jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx("span", { "aria-hidden": "true", className: "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8F7F5] text-[#0D9488]", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M12 5v14M5 12h14" }) }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-base font-bold tracking-tight text-[#172033]", children: "Add Team Member" }), _jsx("p", { className: "truncate text-[13px] text-[#8b857c]", children: "Create a staff account and grant branch permissions." })] })] }), footer: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("p", { className: `text-sm ${addErr ? 'text-[#e8794a]' : 'text-transparent'}`, "aria-live": "polite", children: addErr || '·' }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setShowAdd(false), className: "h-12 rounded-full border border-[#e5e0d8] bg-white px-6 text-sm font-semibold text-[#172033] hover:bg-[#f3efe8]", children: "Cancel" }), _jsx("button", { type: "button", disabled: adding ||
                                        !storeId ||
                                        !fullName.trim() ||
                                        !email.trim() ||
                                        !password ||
                                        password.length < 6 ||
                                        atLimit, onClick: add, className: "inline-flex h-12 items-center gap-2 rounded-full bg-[#f08a8a] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#e87a7a] disabled:cursor-not-allowed disabled:opacity-45", children: adding ? 'Creating…' : 'Create Account' })] })] }), children: _jsxs("div", { className: "grid gap-4", children: [_jsx("div", { className: "rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(23,32,51,0.04)]", children: _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-branch", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Branch Assignment ", _jsx("span", { className: "text-[#e8794a]", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("span", { "aria-hidden": "true", className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#E8A100]", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M5 16 3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5Zm0 2h14v2H5v-2Z" }) }) }), _jsxs("select", { id: "tm-branch", value: storeId, onChange: (e) => setStoreId(e.target.value), className: "h-12 w-full appearance-none rounded-2xl border border-[#e5e0d8] bg-white pl-10 pr-10 text-sm font-medium text-[#172033] focus:border-[#172033] focus:outline-none focus:ring-1 focus:ring-[#172033]", children: [branchStores.length === 0 && (_jsx("option", { value: "", children: "No branches yet" })), branchStores.map((s) => (_jsxs("option", { value: s.id, children: [s.name, s.is_hq ? ' (HQ)' : ''] }, s.id)))] }), _jsx("span", { "aria-hidden": "true", className: "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b857c]", children: "\u25BE" })] }), branchStores.find((s) => s.id === storeId)?.is_hq && (_jsx("p", { className: "mt-1.5 text-[13px] text-[#8b857c]", children: "Headquarters branch" }))] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-name", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Full Name ", _jsx("span", { className: "text-[#e8794a]", children: "*" })] }), _jsx("input", { id: "tm-name", className: "h-12 w-full rounded-2xl border border-[#e5e0d8] bg-white px-4 text-sm text-[#172033] placeholder:text-[#b0a89e] focus:border-[#172033] focus:outline-none focus:ring-1 focus:ring-[#172033]", placeholder: "e.g., Juan Dela Cruz", value: fullName, onChange: (e) => setFullName(e.target.value), autoComplete: "name" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-email", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Email Address ", _jsx("span", { className: "text-[#e8794a]", children: "*" })] }), _jsx("input", { id: "tm-email", type: "email", className: "h-12 w-full rounded-2xl border border-[#e5e0d8] bg-white px-4 text-sm text-[#172033] placeholder:text-[#b0a89e] focus:border-[#172033] focus:outline-none focus:ring-1 focus:ring-[#172033]", placeholder: "e.g., juan@example.com", value: email, onChange: (e) => setEmail(e.target.value), autoComplete: "email" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-phone", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Phone Number ", _jsx("span", { className: "font-normal text-[#8b857c]", children: "(optional)" })] }), _jsx("input", { id: "tm-phone", type: "tel", className: "h-12 w-full rounded-2xl border border-[#e5e0d8] bg-white px-4 text-sm text-[#172033] placeholder:text-[#b0a89e] focus:border-[#172033] focus:outline-none focus:ring-1 focus:ring-[#172033]", placeholder: "e.g., 09171234567", value: phone, onChange: (e) => setPhone(e.target.value), autoComplete: "tel" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-role", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Operational Role ", _jsx("span", { className: "text-[#e8794a]", children: "*" })] }), _jsx("select", { id: "tm-role", value: role, onChange: (e) => setRole(e.target.value), className: "h-12 w-full rounded-2xl border border-[#e5e0d8] bg-white px-4 text-sm font-medium text-[#172033] focus:border-[#172033] focus:outline-none focus:ring-1 focus:ring-[#172033]", children: ASSIGNABLE.map((r) => (_jsx("option", { value: r, children: roleLabel(r) }, r))) })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "tm-password", className: "mb-1.5 block text-sm font-semibold text-[#172033]", children: ["Initial Password ", _jsx("span", { className: "text-[#e8794a]", children: "*" })] }), _jsx(PasswordInput, { id: "tm-password", placeholder: "At least 6 characters", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "new-password", className: "rounded-2xl border-[#e5e0d8]" }), _jsx("p", { className: "mt-1.5 text-[13px] text-[#8b857c]", children: "Staff can log in with this password and set their PIN on first shift." })] })] }) }), atLimit && (_jsxs("p", { className: "text-[13px] text-[#e8794a]", children: ["Plan user limit reached.", ' ', _jsx(Link, { to: "/billing", className: "font-semibold underline", children: "Upgrade" }), ' ', "to add more."] }))] }) }))] }));
}
