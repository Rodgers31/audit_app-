/**
 * County Detail — Server Component with SSR data prefetching.
 *
 * Pre-fetches the comprehensive + accountability datasets for this
 * county on the server so the client component hydrates with a fully
 * populated React Query cache — no loading spinner on first paint,
 * no waterfall.
 *
 * Matches the homepage pattern (`app/page.tsx`): Promise.allSettled
 * wrapped in a 5s Promise.race guard so cold-start backends don't
 * block the page render.
 *
 * Query keys MUST match what `useCountyComprehensive` /
 * `useCountyAccountability` use client-side:
 *   • ['counties', id, 'comprehensive', fiscalYear ?? null]
 *   • ['counties', id, 'accountability']
 * Otherwise React Query treats them as cache misses and refetches.
 */
import { Metadata } from 'next';
import { getCountyAccountability, getCountyComprehensive } from '@/lib/api/counties';
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { getLatestReportedFiscalYear } from '@/lib/utils';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import CountyDetailClient from './CountyDetailClient';

const SSR_TIMEOUT_MS = 5000;

/**
 * Resolve a friendly title at request time. Fetches against the same
 * endpoint the client will, short-circuits on failure back to a generic
 * title so we never crash the page if the backend is asleep.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await Promise.race([
      getCountyComprehensive(id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ssr-metadata-timeout')), 3000)
      ),
    ]);
    if (data?.name) {
      return {
        title: `${data.name} County — AuditGava`,
        description: `Budget execution, debt, audit findings, and stalled projects for ${data.name} County.`,
      };
    }
  } catch {
    // Cold backend or 404 — fall through to generic metadata
  }
  return {
    title: 'County Detail — AuditGava',
    description: 'Budget execution, debt, audit findings, and stalled projects for this county.',
  };
}

export default async function CountyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fy?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const fiscalYear = resolvedSearchParams.fy || getLatestReportedFiscalYear();
  const queryClient = getQueryClient();

  try {
    await Promise.race([
      Promise.allSettled([
        queryClient.prefetchQuery({
          // Matches useCountyComprehensive's queryKey shape.
          queryKey: ['counties', id, 'comprehensive', fiscalYear ?? null] as const,
          queryFn: () => getCountyComprehensive(id, fiscalYear),
        }),
        queryClient.prefetchQuery({
          // Matches useCountyAccountability's queryKey shape.
          queryKey: ['counties', id, 'accountability'] as const,
          queryFn: () => getCountyAccountability(id),
        }),
      ]),
      new Promise((resolve) => setTimeout(resolve, SSR_TIMEOUT_MS)),
    ]);
  } catch {
    // Timeout or SSR error — client React Query will handle it
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CountyDetailClient />
    </HydrationBoundary>
  );
}
