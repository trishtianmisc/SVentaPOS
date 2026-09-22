import { create } from 'zustand';
import { supabase } from '../lib/supabase-client';
import { queryClient } from '../app/queryClient';

interface AuthState {
  userId: string | null;
  email: string | null;
  initialized: boolean;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
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
    queryClient.clear();
    set({ userId: null, email: null });
  },
}));
