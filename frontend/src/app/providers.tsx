import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { useAuthStore } from '../stores/auth-store';

export function Providers({ children }: { children: ReactNode }) {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
