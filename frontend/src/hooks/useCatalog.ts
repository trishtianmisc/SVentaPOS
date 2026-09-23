import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore } from '../stores/session';

export interface Product {
  id: string;
  name: string;
  retail_price: number;
  cost_price?: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  barcode?: string | null;
  sku?: string | null;
  brand?: string | null;
  track_inventory: boolean;
  category_id?: string | null;
  vat_exempt?: boolean;
  minimum_stock?: number;
  reorder_level?: number;
  image_path?: string | null;
  active?: boolean;
  created_at?: string | null;
  /** Phase C: explicit base unit name; falls back to 'pc' until migration. */
  base_unit_name?: string | null;
}
export interface Category {
  id: string;
  name: string;
}
export interface InventoryRow {
  product_id: string;
  quantity: number;
  product_name?: string;
  minimum_stock?: number | null;
  reorder_level?: number | null;
}
export interface Customer {
  id: string;
  name: string;
  balance?: number;
}
export interface SellUnit {
  id: string;
  product_id: string;
  unit_name: string;
  conversion_factor: number;
  selling_price?: number | null;
  barcode?: string | null;
}

const list = (path: string) => api.get(path).then((r) => r.data.data ?? []);

/**
 * Shared catalog queries. One network request per key no matter how many
 * components mount (StrictMode-safe): concurrent identical queries deduplicate
 * in the QueryClient cache.
 *
 * Cache policy (safe because every writer invalidates, see below):
 * - products:   5 min stale. Changes only via product CRUD, which
 *               invalidates ['products'] on success.
 * - categories: 10 min stale. Rarely change; same invalidation on CRUD.
 * - inventory:  15 s stale AND invalidated on every checkout/adjust, because
 *               stock guardrails must be near-fresh. Never relied on for
 *               correctness — the server re-checks stock in the RPC.
 * - customers:  2 min stale AND invalidated on utang checkout/payment,
 *               because balances drive credit-limit decisions (server is
 *               authoritative; UI balances are display-only).
 */
export function useProducts() {
  // Account-scoped key: two logins on one device can never read each
  // other's cache, even if a transition clear were ever missed.
  const userId = useAuthStore((s) => s.userId);
  return useQuery<Product[]>({
    queryKey: [...qk.products, userId ?? 'anon'],
    queryFn: () => list('/products'),
    staleTime: 5 * 60_000,
    enabled: !!userId,
  });
}

export function useCategories() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery<Category[]>({
    queryKey: [...qk.categories, userId ?? 'anon'],
    queryFn: () => list('/categories'),
    staleTime: 10 * 60_000,
    enabled: !!userId,
  });
}

export function useInventory() {
  // Store-scoped key: switching stores must never show another store's cache.
  const storeId = useSessionStore((s) => s.storeId);
  return useQuery<InventoryRow[]>({
    queryKey: [...qk.inventory, storeId ?? 'none'],
    queryFn: () => list('/inventory'),
    staleTime: 15_000,
    enabled: !!storeId,
  });
}

export function useCustomers() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery<Customer[]>({
    queryKey: [...qk.customers, userId ?? 'anon'],
    queryFn: () => list('/customers'),
    staleTime: 2 * 60_000,
    enabled: !!userId,
  });
}

/** Sell units (case/bundle alternates). Rarely change; invalidated on unit CRUD. */
export function useUnits() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery<SellUnit[]>({
    queryKey: [...qk.units, userId ?? 'anon'],
    queryFn: () => list('/products/units'),
    staleTime: 5 * 60_000,
    enabled: !!userId,
  });
}

/**
 * Sell units for a single product (product form / edit).
 * Separate cache key from the org-wide useUnits list used by POS.
 */
export function useProductUnits(productId?: string) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery<SellUnit[]>({
    queryKey: [...qk.productUnits, productId ?? 'none', userId ?? 'anon'],
    queryFn: () => list(`/products/${productId}/units`),
    enabled: !!productId && !!userId,
    staleTime: 5 * 60_000,
  });
}

/** Call after any mutation that changes stock (sale, adjust, PO receive). */
export function useInvalidateInventory() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.inventory });
}
