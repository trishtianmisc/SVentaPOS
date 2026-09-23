import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { useSessionStore } from '../../stores/session';
import { ToastHost } from '../../components/ui';

type Section = 'overview' | 'operations' | 'admin';

const NAV: {
  to: string;
  label: string;
  section: Section;
  icon: JSX.Element;
}[] = [
  {
    to: '/owner/console',
    label: 'Hub',
    section: 'overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/owner/console/branches',
    label: 'Branches',
    section: 'operations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    to: '/owner/console/transfers',
    label: 'Transfers',
    section: 'operations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M7 17H3m0 0 3-3m-3 3 3 3M17 7h4m0 0-3-3m3 3-3 3" />
        <path d="M7 7h4v4M17 17h-4v-4" />
      </svg>
    ),
  },
  {
    to: '/owner/console/reports',
    label: 'Reports',
    section: 'operations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-3" />
      </svg>
    ),
  },
  {
    to: '/owner/console/users',
    label: 'Users',
    section: 'admin',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
        <path d="M16 11a3 3 0 1 0 0-6M21 19c0-2-1.5-3.5-4-4" />
      </svg>
    ),
  },
  {
    to: '/owner/console/subscription',
    label: 'Subscription',
    section: 'admin',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    to: '/owner/console/settings',
    label: 'Settings',
    section: 'admin',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
];

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'operations', label: 'Operations' },
  { key: 'admin', label: 'Administration' },
];

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function ConsoleLayout() {
  const navigate = useNavigate();
  const { email, signOut } = useAuthStore();
  const storeId = useSessionStore((s) => s.storeId);
  const setStore = useSessionStore((s) => s.setStore);
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [branchCount, setBranchCount] = useState(0);

  useEffect(() => {
    api
      .get('/users/branch-stores')
      .then((r) => setBranchCount((r.data.data ?? []).length))
      .catch(() => undefined);
    api
      .get('/organizations/current')
      .then((r) => setOrgName(r.data.data?.name ?? ''))
      .catch(() => undefined);
    api
      .get('/auth/me')
      .then((r) => setFullName(r.data.data?.full_name ?? ''))
      .catch(() => undefined);
  }, []);

  /** Store App / Return to Store App → /pos (auto-pick first membership store). */
  const goToStoreApp = async () => {
    let sid = storeId;
    if (!sid) {
      try {
        const r = await api.get('/stores');
        const list = r.data.data ?? [];
        if (list.length) {
          sid = list[0].id;
          setStore(sid);
        } else {
          navigate('/owner-hub', { replace: true });
          return;
        }
      } catch {
        navigate('/owner-hub', { replace: true });
        return;
      }
    }
    navigate('/pos', { replace: true });
  };

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const displayOrg = orgName || 'Your business';
  const userLabel = fullName || email || '';

  return (
    <div className="flex min-h-dvh bg-gray-50 text-gray-900">
      <ToastHost />

      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex print:hidden">
        <div className="border-b border-gray-200 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-sm font-black text-primary"
            >
              K
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">
                Owner Console
                <span className="ml-1" aria-hidden>👑</span>
              </p>
              <p className="truncate text-xs text-gray-500">{displayOrg}</p>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={goToStoreApp}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <span className="inline-flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M3 9h18M5 9V5h14v4M5 9v10h14V9" />
              </svg>
              Store App
            </span>
            <span className="text-[11px] font-medium text-gray-500">Exit →</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map((sec) => {
            const items = NAV.filter((n) => n.section === sec.key);
            if (!items.length) return null;
            return (
              <div key={sec.key} className="mb-4">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {sec.label}
                </p>
                <div className="grid gap-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/owner/console'}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                          isActive
                            ? 'bg-primary-soft font-semibold text-primary-ink'
                            : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary"
            >
              {initials(fullName, email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{userLabel}</p>
              <p className="truncate text-xs text-gray-500">{displayOrg}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={logout}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden print:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">Owner Console</p>
            <p className="truncate text-xs text-gray-500">{displayOrg}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToStoreApp}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Store App
            </button>
            <button type="button" onClick={logout} className="text-xs text-gray-500">
              Sign out
            </button>
          </div>
        </header>

        {/* Mobile nav pills */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 md:hidden print:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/owner/console'}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="min-h-0 flex-1 bg-gray-50">
          <Outlet
            context={{
              orgName: displayOrg,
              fullName,
              branchCount,
              goToStoreApp,
            }}
          />
        </main>
      </div>
    </div>
  );
}
