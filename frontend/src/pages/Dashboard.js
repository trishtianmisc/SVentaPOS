import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const CARDS = [
    { to: '/pos', title: 'New sale', desc: 'POS cart + cash checkout' },
    { to: '/products', title: 'Products', desc: 'Catalog management' },
    { to: '/inventory', title: 'Inventory', desc: 'Stock levels + adjustments' },
    { to: '/sales', title: 'Sales', desc: 'History + receipts' },
    { to: '/customers', title: 'Customers', desc: 'Utang ledger + payments' },
    { to: '/suppliers', title: 'Suppliers', desc: 'Suppliers + purchase orders' },
    { to: '/expenses', title: 'Expenses', desc: 'Costs + categories' },
    { to: '/reports', title: 'Reports', desc: 'Sales, profit, utang' },
];
export default function DashboardPage() {
    const hasStore = !!localStorage.getItem('ventapos:storeId');
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx("h1", { className: "text-xl font-bold", children: "Dashboard" }), !hasStore && (_jsx("p", { className: "mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700", children: "No store assigned yet. Ask an owner to add you to a store." })), _jsx("div", { className: "mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4", children: CARDS.map((c) => (_jsxs(Link, { to: c.to, className: "rounded-xl border bg-white p-4 hover:border-teal-600", children: [_jsx("p", { className: "font-bold text-teal-800", children: c.title }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: c.desc })] }, c.to))) })] }));
}
