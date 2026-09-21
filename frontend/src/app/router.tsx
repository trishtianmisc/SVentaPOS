import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import ProductsPage from '../pages/Products';
import InventoryPage from '../pages/Inventory';
import POSPage from '../pages/POS';
import SalesPage from '../pages/Sales';
import CustomersPage from '../pages/Customers';
import SuppliersPage from '../pages/Suppliers';
import ExpensesPage from '../pages/Expenses';
import ReportsPage from '../pages/Reports';
import AdminPage from '../pages/Admin';
import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../stores/auth-store';

function Guard({ children }: { children: JSX.Element }) {
  const { userId, initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (!userId) return <Navigate to="/login" replace />;
  return children;
}

function RootRedirect() {
  const { userId, initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  return <Navigate to={userId ? '/pos' : '/login'} replace />;
}

function LoginRoute() {
  const { userId, initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (userId) return <Navigate to="/pos" replace />;
  return <LoginPage />;
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginRoute /> },
  {
    element: (
      <Guard>
        <Outlet />
      </Guard>
    ),
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/pos', element: <POSPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/sales', element: <SalesPage /> },
          { path: '/customers', element: <CustomersPage /> },
          { path: '/suppliers', element: <SuppliersPage /> },
          { path: '/expenses', element: <ExpensesPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/admin', element: <AdminPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
]);
