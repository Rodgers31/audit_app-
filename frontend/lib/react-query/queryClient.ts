/**
 * React Query client configuration
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long before data is considered stale (5 minutes)
      staleTime: 5 * 60 * 1000,
      // Cache time: How long to keep unused data in cache (30 minutes)
      gcTime: 30 * 60 * 1000,
      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus in production only
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      // Background refetch interval (10 minutes)
      refetchInterval: 10 * 60 * 1000,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Mutation retry delay
      retryDelay: 1000,
    },
  },
});

// Query keys factory for consistent key management
export const queryKeys = {
  // Counties
  counties: {
    all: ['counties'] as const,
    lists: () => [...queryKeys.counties.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.counties.lists(), filters] as const,
    details: () => [...queryKeys.counties.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.counties.details(), id] as const,
  },

  // Audits
  audits: {
    all: ['audits'] as const,
    lists: () => [...queryKeys.audits.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.audits.lists(), filters] as const,
    details: () => [...queryKeys.audits.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.audits.details(), id] as const,
    byCounty: (countyId: string) => [...queryKeys.audits.all, 'byCounty', countyId] as const,
  },

  // Budget
  budget: {
    all: ['budget'] as const,
    allocations: () => [...queryKeys.budget.all, 'allocations'] as const,
    allocation: (countyId: string, year?: string) =>
      [...queryKeys.budget.allocations(), countyId, year] as const,
    comparison: (countyIds: string[]) =>
      [...queryKeys.budget.all, 'comparison', countyIds] as const,
  },

  // Debt
  debt: {
    all: ['debt'] as const,
    overview: () => [...queryKeys.debt.all, 'overview'] as const,
    breakdown: (countyId: string) => [...queryKeys.debt.all, 'breakdown', countyId] as const,
    timeline: (countyId: string) => [...queryKeys.debt.all, 'timeline', countyId] as const,
    national: () => [...queryKeys.debt.all, 'national'] as const,
  },

  // National Statistics
  stats: {
    all: ['stats'] as const,
    overview: () => [...queryKeys.stats.all, 'overview'] as const,
    dashboard: () => [...queryKeys.stats.all, 'dashboard'] as const,
  },
} as const;
