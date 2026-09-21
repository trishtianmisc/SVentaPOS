import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
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
    return useQuery({
        queryKey: qk.products,
        queryFn: () => list('/products'),
        staleTime: 5 * 60000,
    });
}
export function useCategories() {
    return useQuery({
        queryKey: qk.categories,
        queryFn: () => list('/categories'),
        staleTime: 10 * 60000,
    });
}
export function useInventory() {
    return useQuery({
        queryKey: qk.inventory,
        queryFn: () => list('/inventory'),
        staleTime: 15000,
    });
}
export function useCustomers() {
    return useQuery({
        queryKey: qk.customers,
        queryFn: () => list('/customers'),
        staleTime: 2 * 60000,
    });
}
/** Call after any mutation that changes stock (sale, adjust, PO receive). */
export function useInvalidateInventory() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: qk.inventory });
}
