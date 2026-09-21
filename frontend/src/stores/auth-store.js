import { create } from 'zustand';
import { supabase } from '../lib/supabase-client';
export const useAuthStore = create((set) => ({
    userId: null,
    email: null,
    orgId: localStorage.getItem('ventapos:orgId'),
    initialized: false,
    init: async () => {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        set({
            userId: session?.user.id ?? null,
            email: session?.user.email ?? null,
            initialized: true,
        });
        supabase.auth.onAuthStateChange((_e, s) => {
            set({ userId: s?.user.id ?? null, email: s?.user.email ?? null });
        });
    },
    signOut: async () => {
        await supabase.auth.signOut();
        // Session store clears persisted org/store ids (shared-device safe).
        const { useSessionStore } = await import('./session');
        useSessionStore.getState().clear();
        set({ userId: null, email: null, orgId: null });
    },
}));
