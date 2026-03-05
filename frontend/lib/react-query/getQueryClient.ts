/**
 * Server-side QueryClient factory for React Query SSR prefetching.
 *
 * Use this in Server Components to prefetch data before rendering.
 * The dehydrated state is passed to HydrationBoundary so client
 * components get data immediately — no loading spinners on first paint.
 *
 * NOTE: retry is set to 1 for SSR so a cold-start failure gets one
 * fast retry (the axios interceptor already retries at the HTTP level,
 * but React Query retry gives an additional layer of resilience).
 */
import { QueryClient } from '@tanstack/react-query';

// Create a new QueryClient for each server request (no shared state)
export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000, // 10 min — matches client defaults
        gcTime: 60 * 60 * 1000,
        retry: 1, // One quick retry for cold-start recovery
        retryDelay: 2000, // 2s — enough for the backend to wake up
      },
    },
  });
}
