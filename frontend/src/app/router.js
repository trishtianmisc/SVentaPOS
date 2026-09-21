import { jsx as _jsx } from "react/jsx-runtime";
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
function Guard({ children }) {
    const { userId, initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (!userId)
        return _jsx(Navigate, { to: "/login", replace: true });
    return children;
}
function RootRedirect() {
    const { userId, initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    return _jsx(Navigate, { to: userId ? '/pos' : '/login', replace: true });
}
function LoginRoute() {
    const { userId, initialized } = useAuthStore();
    if (!initialized)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    if (userId)
        return _jsx(Navigate, { to: "/pos", replace: true });
    return _jsx(LoginPage, {});
}
export const router = createBrowserRouter([
    { path: '/', element: _jsx(RootRedirect, {}) },
    { path: '/login', element: _jsx(LoginRoute, {}) },
    {
        element: (_jsx(Guard, { children: _jsx(Outlet, {}) })),
        children: [
            {
                element: _jsx(AppLayout, {}),
                children: [
                    { path: '/pos', element: _jsx(POSPage, {}) },
                    { path: '/products', element: _jsx(ProductsPage, {}) },
                    { path: '/inventory', element: _jsx(InventoryPage, {}) },
                    { path: '/sales', element: _jsx(SalesPage, {}) },
                    { path: '/customers', element: _jsx(CustomersPage, {}) },
                    { path: '/suppliers', element: _jsx(SuppliersPage, {}) },
                    { path: '/expenses', element: _jsx(ExpensesPage, {}) },
                    { path: '/reports', element: _jsx(ReportsPage, {}) },
                    { path: '/admin', element: _jsx(AdminPage, {}) },
                    { path: '/dashboard', element: _jsx(DashboardPage, {}) },
                ],
            },
        ],
    },
    { path: '*', element: _jsx(RootRedirect, {}) },
]);
