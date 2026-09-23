import { jsx as _jsx } from "react/jsx-runtime";
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
function Guard({ children }) {
    const { userId, initialized } = useAuthStore();
    const location = useLocation();
    const { canPath, firstAllowedPath, loadingRole, isOwner } = usePermissions();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (!userId)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (loadingRole)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    // Owner Hub + Owner Console are owner-only; others stay in the store app.
    if (location.pathname.startsWith('/owner') && !isOwner) {
        return _jsx(Navigate, { to: "/pos", replace: true });
    }
    if (!canPath(location.pathname)) {
        return _jsx(Navigate, { to: firstAllowedPath, replace: true });
    }
    return children;
}
function RootRedirect() {
    const { userId, initialized } = useAuthStore();
    const { isOwner, loadingRole } = usePermissions();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (!userId)
        return _jsx(Navigate, { to: "/login", replace: true });
    // Fresh signups have no org yet; Onboarding bounces back here if set up.
    if (!localStorage.getItem('ventapos:orgId'))
        return _jsx(Navigate, { to: "/onboarding", replace: true });
    if (loadingRole)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    return _jsx(Navigate, { to: isOwner ? '/owner-hub' : '/pos', replace: true });
}
function LoginRoute() {
    const { initialized } = useAuthStore();
    // Do not bounce on userId alone: mid-login that races Login.tsx and forces
    // /onboarding before /auth/me can persist ventapos:orgId.
    // LoginPage resolves an existing session itself after context loads.
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    return _jsx(LoginPage, {});
}
function RegisterRoute() {
    const { initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    return _jsx(RegisterPage, {});
}
export const router = createBrowserRouter([
    { path: '/', element: _jsx(RootRedirect, {}) },
    { path: '/login', element: _jsx(LoginRoute, {}) },
    { path: '/register', element: _jsx(RegisterRoute, {}) },
    { path: '/accept-invite', element: _jsx(AcceptInvitePage, {}) },
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [
            {
                element: _jsx(AppLayout, {}),
                children: [
                    { path: '/pos', element: _jsx(POSPage, {}) },
                    { path: '/products', element: _jsx(ProductsPage, {}) },
                    { path: '/products/new', element: _jsx(ProductFormPage, {}) },
                    { path: '/products/:productId/edit', element: _jsx(ProductFormPage, {}) },
                    { path: '/sales', element: _jsx(SalesPage, {}) },
                    { path: '/shifts', element: _jsx(ShiftsPage, {}) },
                    { path: '/customers', element: _jsx(CustomersPage, {}) },
                    { path: '/suppliers', element: _jsx(SuppliersPage, {}) },
                    { path: '/expenses', element: _jsx(ExpensesPage, {}) },
                    { path: '/transfers', element: _jsx(TransfersPage, {}) },
                    { path: '/reports', element: _jsx(ReportsPage, {}) },
                    { path: '/users', element: _jsx(UsersPage, {}) },
                    { path: '/settings', element: _jsx(SettingsPage, {}) },
                    { path: '/billing', element: _jsx(BillingPage, {}) },
                    { path: '/dashboard', element: _jsx(DashboardPage, {}) },
                ],
            },
        ],
    },
    { path: '*', element: _jsx(RootRedirect, {}) },
    // Chromeless: account setup happens outside the app shell.
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [{ path: '/onboarding', element: _jsx(OnboardingPage, {}) }],
    },
    // Owner Hub (branch picker) — chromeless dark page.
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [{ path: '/owner-hub', element: _jsx(OwnerHubPage, {}) }],
    },
    // Owner Console — dark sidebar shell reusing existing admin pages.
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [
            {
                path: '/owner/console',
                element: _jsx(ConsoleLayout, {}),
                children: [
                    { index: true, element: _jsx(ConsoleHubPage, {}) },
                    { path: 'branches', element: _jsx(ConsoleBranchesPage, {}) },
                    { path: 'transfers', element: _jsx(TransfersPage, {}) },
                    { path: 'reports', element: _jsx(ReportsPage, {}) },
                    { path: 'users', element: _jsx(UsersPage, {}) },
                    { path: 'subscription', element: _jsx(BillingPage, {}) },
                    { path: 'settings', element: _jsx(SettingsPage, {}) },
                ],
            },
        ],
    },
]);
