/**
 * Shared query key factory for React Query cache management.
 *
 * NOTE: The actual QueryClient is created inside QueryProvider.tsx (via
 *       useState) so it is stable across re-renders while still scoped
 *       to the React tree.  Do NOT create a singleton QueryClient here
 *       — it causes SSR issues and can leak between requests in Next.js.
 */

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
