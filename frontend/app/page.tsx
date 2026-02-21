/**
 * Homepage — Server Component with SSR data prefetching.
 *
 * Pre-fetches all 6 API calls in parallel on the server, then passes
 * the dehydrated cache to the client component via HydrationBoundary.
 * Result: zero loading spinners on first paint, no waterfall.
 *
 * On subsequent client-side navigations React Query serves from its
 * in-memory cache (staleTime 10min–1hr) so no extra fetches occur.
 */
import { getFederalAudits } from '@/lib/api/audits';
import { getNationalBudgetSummary } from '@/lib/api/budget';
import { getCounties } from '@/lib/api/counties';
import { getDebtTimeline, getNationalDebtOverview, getNationalLoans } from '@/lib/api/debt';
import { getFiscalSummary } from '@/lib/api/fiscal';
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import HomeDashboardClient from './HomeDashboardClient';

export default async function HomePage() {
  const queryClient = getQueryClient();

  // Prefetch all homepage data in parallel (server → backend is fast, same machine)
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['debt', 'national-timeline'],
      queryFn: getDebtTimeline,
    }),
    queryClient.prefetchQuery({
      queryKey: ['debt', 'national'],
      queryFn: getNationalDebtOverview,
    }),
    queryClient.prefetchQuery({
      queryKey: ['fiscal', 'summary'],
      queryFn: getFiscalSummary,
    }),
    queryClient.prefetchQuery({
      queryKey: ['audits', 'federal'],
      queryFn: getFederalAudits,
    }),
    queryClient.prefetchQuery({
      queryKey: ['budget', 'national', undefined],
      queryFn: () => getNationalBudgetSummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: ['debt', 'national-loans'],
      queryFn: getNationalLoans,
    }),
    queryClient.prefetchQuery({
      queryKey: ['counties', 'filtered', undefined],
      queryFn: () => getCounties(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeDashboardClient />
    </HydrationBoundary>
  );
}
