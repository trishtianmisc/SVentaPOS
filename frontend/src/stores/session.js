import { create } from 'zustand';
import { queryClient } from '../app/queryClient';
/**
 * Confirm a store switch when the POS cart holds items. Prices and stock
 * differ between stores, so the cart is cleared on switch (POS subscribes
 * to storeVersion). Returns true when the switch may proceed.
 */
export function confirmStoreSwitch() {
    const count = Number(typeof localStorage !== 'undefined'
        ? (localStorage.getItem('ventapos:cartCount') ?? 0)
        : 0);
    if (count <= 0)
        return true;
    return window.confirm(`Switch store? Your cart (${count} items) will be cleared because prices and stock may differ between stores.`);
}
const KEY = 'ventapos:storeId';
export const useSessionStore = create((set) => ({
    storeId: typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null,
    storeVersion: 0,
    setStore: (id) => {
        if (id)
            localStorage.setItem(KEY, id);
        else
            localStorage.removeItem(KEY);
        set((s) => ({ storeId: id, storeVersion: s.storeVersion + 1 }));
        // Store switch changes every store-scoped resource: refetch all.
        queryClient.invalidateQueries();
    },
    clear: () => {
        localStorage.removeItem(KEY);
        localStorage.removeItem('ventapos:orgId');
        set({ storeId: null });
    },
}));
