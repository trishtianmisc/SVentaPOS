import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { ToastHost } from '../ui';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/organizations', label: 'Organizations' },
  { to: '/upgrade-requests', label: 'Upgrade requests' },
];

export default function AdminLayout() {
  const { email, signOut } = useAuthStore();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <ToastHost />
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 md:flex">
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="text-lg font-bold text-white">VentaPOS</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            Platform admin
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-white/10 font-semibold text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <p className="truncate text-xs text-slate-400">{email ?? ''}</p>
          <button
            className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <span className="font-bold text-primary-ink">VentaPOS Admin</span>
          <button className="text-sm text-primary" onClick={logout}>
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 border-b bg-white px-3 py-2 md:hidden">
          {NAV.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm ${
                  isActive ? 'bg-primary-soft font-semibold text-primary-ink' : 'text-gray-600'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <main id="main-content" className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
