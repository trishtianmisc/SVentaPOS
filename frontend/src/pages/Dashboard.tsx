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
  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      {!hasStore && (
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          No store assigned yet. Ask an owner to add you to a store.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-xl border bg-white p-4 hover:border-teal-600">
            <p className="font-bold text-teal-800">{c.title}</p>
            <p className="mt-1 text-xs text-gray-500">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
