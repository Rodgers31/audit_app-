/**
 * /admin/ingestion — list + filter ingestion jobs.
 *
 * Operator's primary tool for inspecting what the data pipeline did
 * recently. Reads the existing ``GET /api/v1/admin/ingestion-jobs``
 * endpoint with filters (domain, status, days, page). Each row links
 * to /admin/ingestion/[jobId] for full details and errors.
 */
'use client';

import api from '@/lib/api/axios';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Pause,
  PlayCircle,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

interface IngestionJob {
  id: number;
  domain: string;
  status: string;
  dry_run: boolean;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  items_processed: number;
  items_created: number;
  items_updated: number;
  errors: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
}

interface IngestionJobList {
  jobs: IngestionJob[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'completed_with_errors', label: 'Completed w/ errors' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'pending', label: 'Pending' },
];

const DAYS_OPTIONS = [
  { value: 1, label: '24 hours' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const PAGE_SIZE = 20;

export default function IngestionJobsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <IngestionJobsInner />
    </Suspense>
  );
}

function IngestionJobsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state mirrors URL query params so links/refresh work cleanly.
  const domain = searchParams.get('domain') ?? '';
  const status = searchParams.get('status') ?? '';
  const days = Number(searchParams.get('days') ?? '7');
  const page = Number(searchParams.get('page') ?? '1');

  const setQuery = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      // Reset page to 1 whenever a filter (other than page itself) changes.
      if (!('page' in updates)) next.delete('page');
      router.replace(`/admin/ingestion${next.size ? '?' + next.toString() : ''}`);
    },
    [router, searchParams]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery<IngestionJobList>({
    queryKey: ['admin', 'ingestion-jobs', { domain, status, days, page }],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE, days };
      if (domain) params.domain = domain;
      if (status) params.status = status;
      return (await api.get('/admin/ingestion-jobs', { params })).data;
    },
    staleTime: 15_000,
  });

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5'>
      {/* ── Header row ── */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <Link
            href='/admin'
            className='inline-flex items-center gap-1 text-xs text-gov-sage hover:text-gov-forest mb-1'>
            <ArrowLeft className='w-3 h-3' />
            Back to overview
          </Link>
          <h1 className='text-2xl sm:text-3xl font-bold text-gov-dark'>Ingestion Jobs</h1>
          <p className='text-gov-forest/60 text-sm mt-1'>
            {data
              ? `${data.total.toLocaleString()} job${data.total === 1 ? '' : 's'} match the current filters.`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className='inline-flex items-center gap-2 px-3 py-2 bg-white border border-gov-sage/30 hover:border-gov-sage text-gov-forest rounded-lg text-sm transition-colors disabled:opacity-50'>
          <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className='bg-white border border-gov-sage/20 rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-3'>
        <FilterField label='Domain'>
          <input
            type='text'
            value={domain}
            onChange={(e) => setQuery({ domain: e.target.value || null })}
            placeholder='e.g. counties_budget'
            className='w-44 px-3 py-1.5 text-sm rounded-lg border border-gov-sage/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:border-gov-sage/40 bg-gov-cream/30'
          />
        </FilterField>
        <FilterField label='Status'>
          <select
            value={status}
            onChange={(e) => setQuery({ status: e.target.value || null })}
            className='w-48 px-3 py-1.5 text-sm rounded-lg border border-gov-sage/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:border-gov-sage/40 bg-gov-cream/30'>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label='Time window'>
          <select
            value={days}
            onChange={(e) => setQuery({ days: e.target.value })}
            className='w-36 px-3 py-1.5 text-sm rounded-lg border border-gov-sage/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:border-gov-sage/40 bg-gov-cream/30'>
            {DAYS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Last {opt.label}
              </option>
            ))}
          </select>
        </FilterField>

        {(domain || status || days !== 7) && (
          <button
            onClick={() => router.replace('/admin/ingestion')}
            className='ml-auto text-xs text-gov-forest/60 hover:text-gov-forest underline underline-offset-2'>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <BodyState>
          <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
          <p className='text-gov-forest/60 text-sm'>Loading jobs…</p>
        </BodyState>
      ) : error ? (
        <BodyState>
          <XCircle className='w-8 h-8 text-red-500' />
          <p className='text-red-600 text-sm'>Could not load jobs.</p>
          <button
            onClick={() => refetch()}
            className='px-3 py-1.5 bg-gov-sage/10 hover:bg-gov-sage/20 text-gov-forest rounded-lg text-sm'>
            Retry
          </button>
        </BodyState>
      ) : !data || data.jobs.length === 0 ? (
        <BodyState>
          <Pause className='w-8 h-8 text-gov-forest/30' />
          <p className='text-gov-forest/60 text-sm'>No jobs match these filters.</p>
        </BodyState>
      ) : (
        <>
          <div className='bg-white border border-gov-sage/20 rounded-xl overflow-hidden shadow-sm'>
            {/* Desktop table */}
            <table className='hidden md:table w-full text-sm'>
              <thead className='bg-gov-cream border-b border-gov-sage/20 text-xs uppercase tracking-wide text-gov-forest/60'>
                <tr>
                  <th className='px-4 py-3 text-left font-semibold'>Domain</th>
                  <th className='px-4 py-3 text-left font-semibold'>Status</th>
                  <th className='px-4 py-3 text-left font-semibold'>Started</th>
                  <th className='px-4 py-3 text-right font-semibold'>Duration</th>
                  <th className='px-4 py-3 text-right font-semibold'>Items</th>
                  <th className='px-4 py-3 text-right font-semibold'>Created</th>
                  <th className='px-4 py-3 text-right font-semibold'>Updated</th>
                  <th className='px-2 py-3'></th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/admin/ingestion/${job.id}`)}
                    className='border-b last:border-0 border-gov-sage/10 hover:bg-gov-cream/50 cursor-pointer transition-colors'>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <span className='font-mono text-xs font-medium text-gov-dark'>
                          {job.domain}
                        </span>
                        {job.dry_run && (
                          <span className='text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded'>
                            dry-run
                          </span>
                        )}
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={job.status} hasErrors={job.errors.length > 0} />
                    </td>
                    <td className='px-4 py-3 text-gov-forest/70 whitespace-nowrap'>
                      {timeAgo(job.started_at)}
                    </td>
                    <td className='px-4 py-3 text-right text-gov-forest/70 whitespace-nowrap'>
                      {formatDuration(job.duration_seconds)}
                    </td>
                    <td className='px-4 py-3 text-right text-gov-dark font-medium'>
                      {job.items_processed.toLocaleString()}
                    </td>
                    <td className='px-4 py-3 text-right text-emerald-600'>
                      {job.items_created.toLocaleString()}
                    </td>
                    <td className='px-4 py-3 text-right text-blue-600'>
                      {job.items_updated.toLocaleString()}
                    </td>
                    <td className='px-2 py-3'>
                      <ChevronRight className='w-4 h-4 text-gov-forest/30' />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list */}
            <ul className='md:hidden divide-y divide-gov-sage/10'>
              {data.jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/admin/ingestion/${job.id}`}
                    className='block px-4 py-3 hover:bg-gov-cream/50 transition-colors'>
                    <div className='flex items-center justify-between gap-2 mb-1'>
                      <span className='font-mono text-xs font-medium text-gov-dark'>
                        {job.domain}
                      </span>
                      <StatusBadge status={job.status} hasErrors={job.errors.length > 0} />
                    </div>
                    <div className='flex items-center justify-between text-xs text-gov-forest/60'>
                      <span>{timeAgo(job.started_at)}</span>
                      <span>{formatDuration(job.duration_seconds)}</span>
                    </div>
                    <div className='flex items-center gap-3 text-xs text-gov-forest/70 mt-1'>
                      <span>{job.items_processed.toLocaleString()} processed</span>
                      <span className='text-emerald-600'>
                        +{job.items_created.toLocaleString()}
                      </span>
                      <span className='text-blue-600'>~{job.items_updated.toLocaleString()}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Pagination ── */}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            hasMore={data.has_more}
            onChange={(p) => setQuery({ page: p })}
          />
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

function StatusBadge({ status, hasErrors }: { status: string; hasErrors: boolean }) {
  const config = ((): {
    bg: string;
    text: string;
    icon: React.ElementType;
    label: string;
  } => {
    switch (status) {
      case 'completed':
        return hasErrors
          ? {
              bg: 'bg-amber-100',
              text: 'text-amber-800',
              icon: AlertTriangle,
              label: 'completed*',
            }
          : { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle2, label: status };
      case 'completed_with_errors':
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-800',
          icon: AlertTriangle,
          label: 'completed w/ errors',
        };
      case 'failed':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: status };
      case 'running':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: PlayCircle, label: status };
      case 'pending':
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: status };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: status };
    }
  })();
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className='w-3 h-3' />
      {config.label}
    </span>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col'>
      <label className='text-[10px] uppercase tracking-wide text-gov-forest/60 font-semibold mb-1'>
        {label}
      </label>
      {children}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  hasMore,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className='flex items-center justify-between text-sm'>
      <span className='text-gov-forest/60'>
        Showing <span className='font-medium text-gov-dark'>{start.toLocaleString()}</span>–
        <span className='font-medium text-gov-dark'>{end.toLocaleString()}</span> of{' '}
        <span className='font-medium text-gov-dark'>{total.toLocaleString()}</span>
      </span>
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gov-sage/30 hover:border-gov-sage text-gov-forest disabled:opacity-40 disabled:hover:border-gov-sage/30'>
          <ArrowLeft className='w-3.5 h-3.5' />
          Prev
        </button>
        <span className='text-gov-forest/60'>Page {page}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={!hasMore}
          className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gov-sage/30 hover:border-gov-sage text-gov-forest disabled:opacity-40 disabled:hover:border-gov-sage/30'>
          Next
          <ArrowRight className='w-3.5 h-3.5' />
        </button>
      </div>
    </div>
  );
}

function BodyState({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-white border border-gov-sage/20 rounded-xl py-16 flex flex-col items-center justify-center gap-3 shadow-sm'>
      {children}
    </div>
  );
}

function PageLoader() {
  return (
    <div className='max-w-6xl mx-auto py-32 flex justify-center'>
      <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
    </div>
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${rem}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}
