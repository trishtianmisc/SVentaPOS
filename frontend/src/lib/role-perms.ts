/**
 * Role permission matrix for User Management → Roles tab + enforcement.
 * Source of truth: GET/PUT /users/role-permissions (org settings.role_matrix).
 * Owner always has full access and is not shown as a column.
 */

export type MatrixRole = 'manager' | 'cashier' | 'staff';

export type FeatureKey =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'customers'
  | 'credits'
  | 'expenses'
  | 'sales'
  | 'reports'
  | 'transfers'
  | 'settings'
  | 'billing'
  | 'suppliers'
  | 'users';

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  path: string;
  /** Default perms when nothing is saved yet: manager, cashier, staff. */
  defaults: Record<MatrixRole, boolean>;
}

export const FEATURES: FeatureDef[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard',
    defaults: { manager: true, cashier: false, staff: false } },
  { key: 'pos', label: 'POS', path: '/pos',
    defaults: { manager: true, cashier: true, staff: true } },
  { key: 'inventory', label: 'Inventory', path: '/products',
    defaults: { manager: true, cashier: true, staff: true } },
  { key: 'customers', label: 'Customers', path: '/customers',
    defaults: { manager: true, cashier: true, staff: true } },
  { key: 'credits', label: 'Credits', path: '/customers',
    defaults: { manager: true, cashier: true, staff: true } },
  { key: 'expenses', label: 'Expenses', path: '/expenses',
    defaults: { manager: true, cashier: false, staff: false } },
  { key: 'sales', label: 'Sales', path: '/sales',
    defaults: { manager: true, cashier: true, staff: false } },
  { key: 'reports', label: 'Reports', path: '/reports',
    defaults: { manager: true, cashier: false, staff: false } },
  { key: 'transfers', label: 'Transfers', path: '/transfers',
    defaults: { manager: true, cashier: false, staff: true } },
  { key: 'settings', label: 'Settings', path: '/settings',
    defaults: { manager: true, cashier: false, staff: false } },
  { key: 'billing', label: 'Billing', path: '/billing',
    defaults: { manager: false, cashier: false, staff: false } },
  { key: 'suppliers', label: 'Suppliers', path: '/suppliers',
    defaults: { manager: true, cashier: false, staff: false } },
  { key: 'users', label: 'Users', path: '/users',
    defaults: { manager: true, cashier: false, staff: false } },
];

export type PermMatrix = Record<FeatureKey, Record<MatrixRole, boolean>>;

export const MATRIX_ROLES: { key: MatrixRole; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'staff', label: 'Staff' },
];

/** Rough action counts shown under each toggle in the mockup. */
export const FEATURE_PERM_COUNT: Record<FeatureKey, number> = {
  dashboard: 2,
  pos: 4,
  inventory: 4,
  customers: 3,
  credits: 3,
  expenses: 2,
  sales: 3,
  reports: 3,
  transfers: 3,
  settings: 4,
  billing: 2,
  suppliers: 3,
  users: 4,
};

export function defaultMatrix(): PermMatrix {
  const out = {} as PermMatrix;
  for (const f of FEATURES) {
    out[f.key] = { ...f.defaults };
  }
  return out;
}

/** Merge API payload over defaults (unknown keys ignored, missing → default). */
export function mergeMatrix(raw: unknown): PermMatrix {
  const base = defaultMatrix();
  if (!raw || typeof raw !== 'object') return base;
  const parsed = raw as Partial<PermMatrix>;
  for (const f of FEATURES) {
    const row = parsed[f.key];
    if (row && typeof row === 'object') {
      base[f.key] = {
        manager: row.manager ?? f.defaults.manager,
        cashier: row.cashier ?? f.defaults.cashier,
        staff: row.staff ?? f.defaults.staff,
      };
    }
  }
  return base;
}

export function roleLabel(role: string): string {
  if (role === 'inventory') return 'Staff';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleTone(role: string): 'green' | 'brand' | 'amber' | 'gray' {
  if (role === 'owner') return 'green';
  if (role === 'manager') return 'brand';
  if (role === 'cashier') return 'amber';
  return 'gray';
}

/** API role value for a matrix column (Staff maps to inventory). */
export function apiRoleFor(matrixRole: MatrixRole): string {
  return matrixRole === 'staff' ? 'inventory' : matrixRole;
}

/** Map API role → matrix column (inventory → staff); owner has no column. */
export function matrixRoleFor(apiRole: string): MatrixRole | null {
  if (apiRole === 'inventory') return 'staff';
  if (apiRole === 'manager' || apiRole === 'cashier') return apiRole;
  return null;
}

/** Feature key for a pathname (null = always allowed for signed-in users). */
export function featureForPath(pathname: string): FeatureKey | null {
  if (pathname === '/inventory') return 'inventory';
  if (pathname.startsWith('/products')) return 'inventory';
  if (pathname.startsWith('/pos')) return 'pos';
  if (pathname.startsWith('/sales')) return 'sales';
  if (pathname.startsWith('/customers')) return 'customers';
  if (pathname.startsWith('/suppliers')) return 'suppliers';
  if (pathname.startsWith('/transfers')) return 'transfers';
  if (pathname.startsWith('/expenses')) return 'expenses';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/billing')) return 'billing';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return null;
}

/**
 * One-time migrate legacy localStorage matrix to the API, then drop the key.
 * Safe to call after a successful fetch when the org had a local copy.
 */
export function takeLegacyMatrix(orgId: string | null | undefined): PermMatrix | null {
  try {
    const key = `ventapos:rolePerms:${orgId || 'default'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    return mergeMatrix(JSON.parse(raw));
  } catch {
    return null;
  }
}
