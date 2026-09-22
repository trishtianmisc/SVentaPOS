import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import OrganizationsPage from '../pages/Organizations';
import OrganizationDetailPage from '../pages/OrganizationDetail';
import UpgradeRequestsPage from '../pages/UpgradeRequests';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuthStore } from '../stores/auth-store';

function Guard({ children }: { children: JSX.Element }) {
  const { userId, initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (!userId) return <Navigate to="/login" replace />;
  return children;
}

function LoginRoute() {
  const { userId, initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (userId) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    element: (
      <Guard>
        <Outlet />
      </Guard>
    ),
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/organizations', element: <OrganizationsPage /> },
          { path: '/organizations/:orgId', element: <OrganizationDetailPage /> },
          { path: '/upgrade-requests', element: <UpgradeRequestsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
