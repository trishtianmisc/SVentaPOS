import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import OnboardingPage from '../pages/Onboarding';
import DashboardPage from '../pages/Dashboard';
import ProductsPage from '../pages/Products';
import ProductFormPage from '../pages/ProductForm';
import InventoryPage from '../pages/Inventory';
import POSPage from '../pages/POS';
import SalesPage from '../pages/Sales';
import CustomersPage from '../pages/Customers';
import SuppliersPage from '../pages/Suppliers';
import ExpensesPage from '../pages/Expenses';
import TransfersPage from '../pages/Transfers';
import ReportsPage from '../pages/Reports';
import SettingsPage from '../pages/Settings';
import BillingPage from '../pages/Billing';
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
  if (!userId) return <Navigate to="/login" replace />;
  // Fresh signups have no org yet; Onboarding bounces back here if set up.
  if (!localStorage.getItem('ventapos:orgId'))
    return <Navigate to="/onboarding" replace />;
  return <Navigate to="/pos" replace />;
}

function LoginRoute() {
  const { initialized } = useAuthStore();
  // Do not bounce on userId alone: mid-login that races Login.tsx and forces
  // /onboarding before /auth/me can persist ventapos:orgId.
  // LoginPage resolves an existing session itself after context loads.
  if (!initialized) return <div className="p-6">Loading…</div>;
  return <LoginPage />;
}

function RegisterRoute() {
  const { initialized } = useAuthStore();
  if (!initialized) return <div className="p-6">Loading…</div>;
  return <RegisterPage />;
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginRoute /> },
  { path: '/register', element: <RegisterRoute /> },
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
          { path: '/products/new', element: <ProductFormPage /> },
          { path: '/products/:productId/edit', element: <ProductFormPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/sales', element: <SalesPage /> },
          { path: '/customers', element: <CustomersPage /> },
          { path: '/suppliers', element: <SuppliersPage /> },
          { path: '/expenses', element: <ExpensesPage /> },
          { path: '/transfers', element: <TransfersPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/billing', element: <BillingPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
  // Chromeless: account setup happens outside the app shell.
  {
    element: (
      <Guard>
        <Outlet />
      </Guard>
    ),
    children: [{ path: '/onboarding', element: <OnboardingPage /> }],
  },
]);
