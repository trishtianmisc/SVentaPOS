import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { defaultMatrix, featureForPath, isOwnerStores, matrixRoleFor, mergeMatrix, takeLegacyMatrix, } from '../lib/role-perms';
import { useAuthStore } from '../stores/auth-store';
/**
 * Membership role (from GET /stores) + org role matrix (GET /users/role-permissions).
 * Owner bypasses the matrix. Non-owner can() = matrix[feature][mapped role].
 */
export function usePermissions() {
    const orgId = useAuthStore((s) => s.orgId) ?? localStorage.getItem('ventapos:orgId');
    const userId = useAuthStore((s) => s.userId);
    const qc = useQueryClient();
    const [role, setRole] = useState(null);
    const storesQuery = useQuery({
        queryKey: [...qk.stores, userId ?? 'anon'],
        queryFn: async () => {
            const r = await api.get('/stores');
            return (r.data.data ?? []);
        },
        enabled: !!userId,
        staleTime: 60000,
    });
    const storeId = (typeof window !== 'undefined' && localStorage.getItem('ventapos:storeId')) || null;
    useEffect(() => {
        const list = storesQuery.data;
        if (!list)
            return;
        const active = storeId ? list.find((s) => s.id === storeId) : undefined;
        const next = active?.role ?? list[0]?.role ?? null;
        setRole(next);
    }, [storesQuery.data, storeId]);
    const matrixQuery = useQuery({
        queryKey: [...qk.rolePerms, orgId ?? 'none'],
        queryFn: async () => {
            try {
                const r = await api.get('/users/role-permissions');
                return mergeMatrix(r.data.data);
            }
            catch {
                // 403/network: still render with defaults — backend is source of truth.
                return defaultMatrix();
            }
        },
        enabled: !!userId && !!orgId,
        staleTime: 30000,
        retry: false,
    });
    // One-time migrate legacy localStorage matrix → API (owner sessions).
    useEffect(() => {
        if (!orgId || !matrixQuery.data)
            return;
        const legacy = takeLegacyMatrix(orgId);
        if (!legacy)
            return;
        if (role && role !== 'owner')
            return;
        api
            .put('/users/role-permissions', legacy)
            .then(() => {
            qc.invalidateQueries({ queryKey: [...qk.rolePerms, orgId] });
        })
            .catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId, matrixQuery.data]);
    const matrix = matrixQuery.data ?? defaultMatrix();
    // Owner of ANY membership bypasses the matrix (mirrors backend require_feature).
    const isOwner = role === 'owner' || isOwnerStores(storesQuery.data);
    const can = (feature) => {
        if (isOwner)
            return true;
        if (!role)
            return true; // before role loads — avoid locking UI
        const col = matrixRoleFor(role);
        if (!col)
            return false;
        return !!matrix[feature]?.[col];
    };
    const canPath = (pathname) => {
        const feat = featureForPath(pathname);
        if (!feat)
            return true;
        return can(feat);
    };
    /** First allowed path for redirect when access is denied. */
    const firstAllowedPath = useMemo(() => {
        const candidates = [
            { feature: 'pos', path: '/pos' },
            { feature: 'inventory', path: '/products' },
            { feature: 'sales', path: '/sales' },
            { feature: 'customers', path: '/customers' },
            { feature: 'dashboard', path: '/dashboard' },
            { feature: 'suppliers', path: '/suppliers' },
            { feature: 'transfers', path: '/transfers' },
            { feature: 'expenses', path: '/expenses' },
            { feature: 'reports', path: '/reports' },
            { feature: 'users', path: '/users' },
            { feature: 'settings', path: '/settings' },
            { feature: 'billing', path: '/billing' },
        ];
        for (const c of candidates) {
            if (can(c.feature))
                return c.path;
        }
        return '/pos';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOwner, role, matrix]);
    const saveMatrix = async (next) => {
        await api.put('/users/role-permissions', next);
        qc.invalidateQueries({ queryKey: [...qk.rolePerms, orgId ?? 'none'] });
    };
    return {
        role,
        isOwner,
        matrix,
        loadingRole: storesQuery.isLoading || matrixQuery.isLoading,
        can,
        canPath,
        firstAllowedPath,
        saveMatrix,
        refetchMatrix: () => matrixQuery.refetch(),
    };
}
