import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import OnboardingPage from '../pages/Onboarding';
import AcceptInvitePage from '../pages/AcceptInvite';
import DashboardPage from '../pages/Dashboard';
import ProductsPage from '../pages/Products';
import ProductFormPage from '../pages/ProductForm';
import POSPage from '../pages/POS';
import SalesPage from '../pages/Sales';
import ShiftsPage from '../pages/Shifts';
import CustomersPage from '../pages/Customers';
import SuppliersPage from '../pages/Suppliers';
import ExpensesPage from '../pages/Expenses';
import TransfersPage from '../pages/Transfers';
import ReportsPage from '../pages/Reports';
import UsersPage from '../pages/Users';
import SettingsPage from '../pages/Settings';
import BillingPage from '../pages/Billing';
import OwnerHubPage from '../pages/OwnerHub';
import ConsoleLayout from '../pages/owner/ConsoleLayout';
import ConsoleHubPage from '../pages/owner/ConsoleHub';
import ConsoleBranchesPage from '../pages/owner/ConsoleBranches';
import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../stores/auth-store';
import { usePermissions } from '../hooks/usePermissions';

function Guard({ children }: { children: JSX.Element }) {
  const { userId, initialized } = useAuthStore();
  const location = useLocation();
  const { canPath, firstAllowedPath, loadingRole, isOwner } = usePermissions();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (!userId) return <Navigate to="/login" replace />;
  if (loadingRole) return <div className="p-6">Loading…</div>;
  // Owner Hub + Owner Console are owner-only; others stay in the store app.
  if (location.pathname.startsWith('/owner') && !isOwner) {
    return <Navigate to="/pos" replace />;
  }
  if (!canPath(location.pathname)) {
    return <Navigate to={firstAllowedPath} replace />;
  }
  return children;
}

function RootRedirect() {
  const { userId, initialized } = useAuthStore();
  const { isOwner, loadingRole } = usePermissions();
  if (!initialized) return <div className="p-6">Loading…</div>;
  if (!userId) return <Navigate to="/login" replace />;
  // Fresh signups have no org yet; Onboarding bounces back here if set up.
  if (!localStorage.getItem('ventapos:orgId'))
    return <Navigate to="/onboarding" replace />;
  if (loadingRole) return <div className="p-6">Loading…</div>;
  return <Navigate to={isOwner ? '/owner-hub' : '/pos'} replace />;
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
  { path: '/accept-invite', element: <AcceptInvitePage /> },
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
          { path: '/sales', element: <SalesPage /> },
          { path: '/shifts', element: <ShiftsPage /> },
          { path: '/customers', element: <CustomersPage /> },
          { path: '/suppliers', element: <SuppliersPage /> },
          { path: '/expenses', element: <ExpensesPage /> },
          { path: '/transfers', element: <TransfersPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/users', element: <UsersPage /> },
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
  // Owner Hub (branch picker) — chromeless dark page.
  {
    element: (
      <Guard>
        <Outlet />
      </Guard>
    ),
    children: [{ path: '/owner-hub', element: <OwnerHubPage /> }],
  },
  // Owner Console — dark sidebar shell reusing existing admin pages.
  {
    element: (
      <Guard>
        <Outlet />
      </Guard>
    ),
    children: [
      {
        path: '/owner/console',
        element: <ConsoleLayout />,
        children: [
          { index: true, element: <ConsoleHubPage /> },
          { path: 'branches', element: <ConsoleBranchesPage /> },
          { path: 'transfers', element: <TransfersPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'subscription', element: <BillingPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
