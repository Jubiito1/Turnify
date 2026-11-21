import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Do not retry client errors (4xx); retry network/server errors twice.
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
