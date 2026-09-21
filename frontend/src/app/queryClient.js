import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            retry: 1,
            // A shared register refocuses constantly; refetch explicitly via
            // invalidation after mutations instead of ambient refetch storms.
            refetchOnWindowFocus: false,
        },
    },
});
