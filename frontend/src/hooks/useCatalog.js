import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore } from '../stores/session';
const list = (path) => api.get(path).then((r) => r.data.data ?? []);
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
    return useQuery({
        queryKey: [...qk.products, userId ?? 'anon'],
        queryFn: () => list('/products'),
        staleTime: 5 * 60000,
        enabled: !!userId,
    });
}
export function useCategories() {
    const userId = useAuthStore((s) => s.userId);
    return useQuery({
        queryKey: [...qk.categories, userId ?? 'anon'],
        queryFn: () => list('/categories'),
        staleTime: 10 * 60000,
        enabled: !!userId,
    });
}
export function useInventory() {
    // Store-scoped key: switching stores must never show another store's cache.
    const storeId = useSessionStore((s) => s.storeId);
    return useQuery({
        queryKey: [...qk.inventory, storeId ?? 'none'],
        queryFn: () => list('/inventory'),
        staleTime: 15000,
        enabled: !!storeId,
    });
}
export function useCustomers() {
    const userId = useAuthStore((s) => s.userId);
    return useQuery({
        queryKey: [...qk.customers, userId ?? 'anon'],
        queryFn: () => list('/customers'),
        staleTime: 2 * 60000,
        enabled: !!userId,
    });
}
/** Sell units (case/bundle alternates). Rarely change; invalidated on unit CRUD. */
export function useUnits() {
    const userId = useAuthStore((s) => s.userId);
    return useQuery({
        queryKey: [...qk.units, userId ?? 'anon'],
        queryFn: () => list('/products/units'),
        staleTime: 5 * 60000,
        enabled: !!userId,
    });
}
/**
 * Sell units for a single product (product form / edit).
 * Separate cache key from the org-wide useUnits list used by POS.
 */
export function useProductUnits(productId) {
    const userId = useAuthStore((s) => s.userId);
    return useQuery({
        queryKey: [...qk.productUnits, productId ?? 'none', userId ?? 'anon'],
        queryFn: () => list(`/products/${productId}/units`),
        enabled: !!productId && !!userId,
        staleTime: 5 * 60000,
    });
}
/** Call after any mutation that changes stock (sale, adjust, PO receive). */
export function useInvalidateInventory() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: qk.inventory });
}
