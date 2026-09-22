import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import OrganizationsPage from '../pages/Organizations';
import OrganizationDetailPage from '../pages/OrganizationDetail';
import UpgradeRequestsPage from '../pages/UpgradeRequests';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuthStore } from '../stores/auth-store';
function Guard({ children }) {
    const { userId, initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (!userId)
        return _jsx(Navigate, { to: "/login", replace: true });
    return children;
}
function LoginRoute() {
    const { userId, initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (userId)
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(LoginPage, {});
}
export const router = createBrowserRouter([
    { path: '/login', element: _jsx(LoginRoute, {}) },
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [
            {
                element: _jsx(AdminLayout, {}),
                children: [
                    { path: '/', element: _jsx(DashboardPage, {}) },
                    { path: '/organizations', element: _jsx(OrganizationsPage, {}) },
                    { path: '/organizations/:orgId', element: _jsx(OrganizationDetailPage, {}) },
                    { path: '/upgrade-requests', element: _jsx(UpgradeRequestsPage, {}) },
                ],
            },
        ],
    },
    { path: '*', element: _jsx(Navigate, { to: "/", replace: true }) },
]);
