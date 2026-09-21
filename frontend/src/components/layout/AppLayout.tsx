import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { api } from '../../lib/api-client';

const NAV = [
  { to: '/pos', label: 'POS' },
  { to: '/products', label: 'Products' },
  { to: '/inventory', label: 'Stock' },
  { to: '/sales', label: 'Sales' },
  { to: '/customers', label: 'Customers' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/reports', label: 'Reports' },
  { to: '/dashboard', label: 'Dashboard' },
];

// Mobile keeps 5 thumb-friendly tabs; the rest live in Dashboard hub.
const TABS = [
  { to: '/pos', label: 'POS' },
  { to: '/products', label: 'Products' },
  { to: '/inventory', label: 'Stock' },
  { to: '/sales', label: 'Sales' },
  { to: '/dashboard', label: 'More' },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AppLayout() {
  const { email, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState<string | null>(null);
  const clock = useClock();

  useEffect(() => {
    api
      .get('/stores')
      .then((r) => {
        const list = r.data.data ?? [];
        const active = localStorage.getItem('ventapos:storeId');
        const match = list.find((s: any) => s.id === active) ?? list[0];
        if (match) {
          setStoreName(match.name);
          if (!active) localStorage.setItem('ventapos:storeId', match.id);
        }
      })
      .catch(() => undefined);
  }, []);

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white print:hidden md:flex">
        <div className="border-b px-5 py-4">
          <p className="text-lg font-bold text-teal-800">VentaPOS</p>
          <p className="mt-1 truncate text-xs text-gray-500">
            {storeName ?? 'Loading store…'} · {clock}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-teal-50 font-semibold text-teal-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <p className="truncate text-xs text-gray-500">{email ?? ''}</p>
          <button
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 print:hidden md:hidden">
          <span className="font-bold text-teal-800">VentaPOS</span>
          <span className="truncate text-xs text-gray-500">
            {storeName ?? '…'} · {clock}
          </span>
          <button className="text-sm text-teal-700" onClick={logout}>
            Sign out
          </button>
        </header>

        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white print:hidden md:hidden">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `py-3 text-center text-xs ${
                  isActive ? 'font-bold text-teal-700' : 'text-gray-500'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
