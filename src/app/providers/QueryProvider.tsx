import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '../../lib/api/client'

// oxlint-disable-next-line react/only-export-components -- the singleton and provider must share one cache instance.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false
        if (error instanceof ApiError && [400, 401, 403, 404, 409].includes(error.status)) return false
        return failureCount < 2
      },
      retryDelay: (attempt, error) =>
        error instanceof ApiError && error.retryAfterMs
          ? error.retryAfterMs
          : Math.min(500 * 2 ** attempt, 4_000),
    },
    mutations: { retry: false },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
