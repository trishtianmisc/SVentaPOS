import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '../lib/query-keys';
import {
  FEATURES,
  FEATURE_PERM_COUNT,
  MATRIX_ROLES,
  defaultMatrix,
  mergeMatrix,
  roleLabel,
  roleTone,
  type PermMatrix,
} from '../lib/role-perms';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  Select,
  Spinner,
  TextInput,
  toast,
} from '../components/ui';

interface UserRow {
  id: string;
  full_name?: string | null;
  email?: string | null;
  status: string;
  role: string;
  is_self: boolean;
  last_login?: string | null;
}

const ASSIGNABLE = ['owner', 'manager', 'cashier', 'inventory'] as const;

const ROLE_CARDS = [
  { role: 'owner', title: 'Owner', desc: 'Full access to all features and settings', icon: '👑' },
  { role: 'manager', title: 'Manager', desc: 'Manage inventory, view reports, process voids/refunds', icon: '🛡️' },
  { role: 'cashier', title: 'Cashier', desc: 'POS operations, discounts, and credits', icon: '🧾' },
  { role: 'inventory', title: 'Staff', desc: 'Basic POS access only', icon: '👤' },
] as const;

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-40 ${
        on ? 'bg-red-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function PlanBanner({
  planName,
  used,
  max,
  showUpgrade,
}: {
  planName: string;
  used: number;
  max: number | null;
  showUpgrade: boolean;
}) {
  const full = max != null && used >= max;
  if (!full && !showUpgrade) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {planName} Plan — {used}/{max ?? '—'} User{used === 1 && max === 1 ? '' : 's'}
          </p>
          <p className="text-[13px] text-amber-800">
            {full
              ? 'Upgrade to add cashiers or staff members'
              : `Upgrade to add more users (currently ${used} of ${max ?? '—'})`}
          </p>
        </div>
      </div>
      <Link
        to="/billing"
        className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
      >
        Upgrade Now
      </Link>
    </div>
  );
}

function UsersTab({
  items,
  isOwner,
  onChangeRole,
  onRemove,
  changingId,
}: {
  items: UserRow[];
  isOwner: boolean;
  onChangeRole: (id: string, role: string) => void;
  onRemove: (u: UserRow) => void;
  changingId: string | null;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, roleFilter]);

  const counts = useMemo(() => {
    const map: Record<string, { active: number; inactive: number }> = {};
    for (const c of ROLE_CARDS) {
      map[c.role] = { active: 0, inactive: 0 };
    }
    for (const u of items) {
      if (!map[u.role]) map[u.role] = { active: 0, inactive: 0 };
      if (u.status === 'active') map[u.role].active += 1;
      else map[u.role].inactive += 1;
    }
    return map;
  }, [items]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchInput
            label="Search users"
            placeholder="Search users by name or email…"
            value={search}
            onChange={setSearch}
          />
        </div>
        <Select
          aria-label="Filter by role"
          className="h-11 w-40"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_CARDS.map((card) => {
          const c = counts[card.role] ?? { active: 0, inactive: 0 };
          const total = c.active + c.inactive;
          return (
            <div
              key={card.role}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span
                  aria-hidden
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                    card.role === 'owner'
                      ? 'bg-indigo-50'
                      : card.role === 'manager'
                        ? 'bg-red-50'
                        : card.role === 'cashier'
                          ? 'bg-rose-50'
                          : 'bg-sky-50'
                  }`}
                >
                  {card.icon}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  {total}
                </span>
              </div>
              <p className="mt-3 text-base font-bold text-gray-900">{card.title}</p>
              <p className="mt-1 min-h-10 text-xs leading-snug text-gray-500">{card.desc}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-700">{c.active} active</span>
                <span className="text-gray-400">{c.inactive} inactive</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-xs text-gray-500">
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Last Login</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title={search || roleFilter !== 'all' ? 'No users match' : 'No users yet'}
                      hint={
                        search || roleFilter !== 'all'
                          ? 'Try a different search or filter.'
                          : isOwner
                            ? 'Add a staff account by email.'
                            : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white"
                        >
                          {initials(u.full_name, u.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {u.full_name || u.email || '—'}
                            {u.is_self && (
                              <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>
                            )}
                          </p>
                          {u.email && (
                            <p className="truncate text-xs text-gray-400">{u.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone(u.role)}>{roleLabel(u.role)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.status === 'active' ? 'green' : 'red'}>
                        {u.status === 'active' ? '● Active' : u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-500">
                      {relTime(u.last_login)}
                    </td>
                    <td className="relative px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${u.full_name || u.email || 'user'}`}
                        onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                        className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 hover:bg-gray-100"
                      >
                        ···
                      </button>
                      {menuId === u.id && (
                        <div className="absolute right-4 top-12 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg">
                          <div className="px-3 py-2">
                            <label className="mb-1 block text-[11px] font-medium uppercase text-gray-400">
                              Role
                            </label>
                            <Select
                              aria-label={`Change role for ${u.full_name || u.email || 'user'}`}
                              className="h-9"
                              value={u.role}
                              disabled={changingId === u.id}
                              onChange={(e) => {
                                setMenuId(null);
                                onChangeRole(u.id, e.target.value);
                              }}
                            >
                              {ASSIGNABLE.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </Select>
                          </div>
                          {isOwner && !u.is_self && (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setMenuId(null);
                                onRemove(u);
                              }}
                            >
                              Remove user
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {items.length} user{items.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function RolesTab({
  matrix,
  counts,
  disabled,
  onToggle,
  saving,
}: {
  matrix: PermMatrix;
  counts: Record<string, number>;
  disabled: boolean;
  onToggle: (feature: string, role: string, value: boolean) => void;
  saving?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-xs text-gray-500">
              <th scope="col" className="px-4 py-3 font-medium">Page / Feature</th>
              {MATRIX_ROLES.map((r) => (
                <th key={r.key} scope="col" className="px-4 py-3 text-center font-medium">
                  <span className="block text-sm font-semibold text-gray-800">{r.label}</span>
                  <span className="block font-normal text-gray-400">
                    {counts[r.key] ?? 0} users
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FEATURES.map((f) => (
              <tr key={f.key} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 1.5l5.5 2.5v4c0 3.5-2.4 5.8-5.5 6.5-3.1-.7-5.5-3-5.5-6.5V4L8 1.5z" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{f.label}</p>
                      <p className="text-xs text-gray-400">{f.path}</p>
                    </div>
                  </div>
                </td>
                {MATRIX_ROLES.map((r) => {
                  const on = matrix[f.key]?.[r.key] ?? false;
                  return (
                    <td key={r.key} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Toggle
                          on={on}
                          disabled={disabled}
                          label={`${f.label} for ${r.label}`}
                          onChange={(v) => onToggle(f.key, r.key, v)}
                        />
                        <span className="text-[11px] text-gray-400">
                          {FEATURE_PERM_COUNT[f.key]} perm{FEATURE_PERM_COUNT[f.key] === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        Owner always has full access. Changes save automatically for this business
        and control what each role sees in the app navigation and API access.
        {saving ? ' Saving…' : ''}
      </p>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(
    localStorage.getItem('ventapos:orgId'),
  );
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [matrix, setMatrix] = useState<PermMatrix>(() => defaultMatrix());
  const [savingPerms, setSavingPerms] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('cashier');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

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
    setIsOwner(list.some((s: any) => s.role === 'owner'));
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
    const c: Record<string, number> = { manager: 0, cashier: 0, staff: 0, owner: 0 };
    for (const u of items) {
      if (u.role === 'inventory') c.staff += 1;
      else if (u.role in c) c[u.role] += 1;
    }
    return c;
  }, [items]);

  const planName = sub?.effective_plan || sub?.plan?.name || 'Free';
  const maxUsers = sub?.limits?.max_users ?? null;
  const usedUsers = usage?.users ?? items.length;
  const atLimit = maxUsers != null && usedUsers >= maxUsers;

  const togglePerm = (feature: string, roleKey: string, value: boolean) => {
    setMatrix((prev) => {
      const next: PermMatrix = {
        ...prev,
        [feature]: {
          ...prev[feature as keyof PermMatrix],
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
    } catch (e: any) {
      const status = e.response?.status;
      if (status === 404) {
        setAddErr(
          'No account with that email. Ask them to register first, then try again.',
        );
      } else if (status === 409) {
        setAddErr(e.response?.data?.error?.message ?? 'Already a member.');
      } else if (status === 403) {
        setAddErr(
          e.response?.data?.error?.message ??
            'Plan limit reached — upgrade to add more users.',
        );
      } else {
        setAddErr(e.response?.data?.error?.message ?? 'Could not add user');
      }
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (id: string, next: string) => {
    if (!next) return;
    setChangingId(id);
    setMsg('');
    try {
      await api.patch(`/users/${id}`, { role: next });
      toast('success', 'Role updated');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not change role');
      await load();
    } finally {
      setChangingId(null);
    }
  };

  const remove = async (u: UserRow) => {
    const label = u.full_name || u.email || 'this user';
    if (!window.confirm(`Remove ${label} from this business?`)) return;
    setMsg('');
    try {
      await api.delete(`/users/${u.id}`);
      toast('success', 'User removed');
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not remove user');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-xl"
          >
            👥
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              User Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage store users and access permissions
            </p>
          </div>
        </div>
        <Button
          disabled={!isOwner || atLimit}
          title={!isOwner ? 'Only owners can add users' : atLimit ? 'Upgrade plan to add users' : undefined}
          onClick={() => {
            resetAdd();
            setShowAdd(true);
          }}
        >
          <span className="mr-1.5" aria-hidden>＋</span> Add User
        </Button>
      </div>

      <div className="mb-5 inline-flex rounded-full bg-slate-900 p-1">
        {(
          [
            { key: 'users', label: 'Users', icon: '👥' },
            { key: 'roles', label: 'Roles', icon: '🛡️' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'bg-red-500 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <PlanBanner
        planName={planName}
        used={usedUsers}
        max={maxUsers}
        showUpgrade={true}
      />

      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      {!isOwner && !loading && tab === 'users' && (
        <p className="mb-4 rounded-xl bg-gray-100 p-4 text-sm text-gray-600">
          Only an owner can add users or change roles. You can still see the team list.
        </p>
      )}

      {loading ? (
        <Spinner label="Loading users…" />
      ) : tab === 'users' ? (
        <UsersTab
          items={items}
          isOwner={isOwner}
          onChangeRole={changeRole}
          onRemove={remove}
          changingId={changingId}
        />
      ) : (
        <RolesTab
          matrix={matrix}
          counts={roleCounts}
          disabled={!isOwner}
          onToggle={togglePerm}
          saving={savingPerms}
        />
      )}

      {showAdd && (
        <Modal title="Add user" onClose={() => setShowAdd(false)}>
          <div className="grid gap-3">
            <p className="text-[13px] text-gray-500">
              They must already have a VentaPOS account. Enter the email they
              registered with — no invite email is sent.
            </p>
            <Field label="Email" error={addErr || undefined}>
              <TextInput
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
            </Field>
            <Field
              label="Role"
              hint="Owner: full access. Manager: run the store. Cashier: POS. Staff: basic POS."
            >
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ASSIGNABLE.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button disabled={adding || !email.trim() || atLimit} onClick={add}>
              {adding ? 'Adding…' : 'Add user'}
            </Button>
            {atLimit && (
              <p className="text-xs text-amber-700">
                Plan user limit reached.{' '}
                <Link to="/billing" className="font-semibold underline">
                  Upgrade
                </Link>{' '}
                to add more.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
