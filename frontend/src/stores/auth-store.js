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
        localStorage.removeItem('ventapos:orgId');
        localStorage.removeItem('ventapos:storeId');
        set({ userId: null, email: null, orgId: null });
    },
}));
