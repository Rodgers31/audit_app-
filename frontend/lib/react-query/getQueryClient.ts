/**
 * Server-side QueryClient factory for React Query SSR prefetching.
 *
 * Use this in Server Components to prefetch data before rendering.
 * The dehydrated state is passed to HydrationBoundary so client
 * components get data immediately — no loading spinners on first paint.
 */
import { QueryClient } from '@tanstack/react-query';

// Create a new QueryClient for each server request (no shared state)
export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000, // 10 min — matches client defaults
        gcTime: 60 * 60 * 1000,
      },
    },
  });
}
