import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { useAuthStore } from '../stores/auth-store';
export function Providers({ children }) {
    const init = useAuthStore((s) => s.init);
    useEffect(() => {
        init();
    }, [init]);
    return _jsx(QueryClientProvider, { client: queryClient, children: children });
}
