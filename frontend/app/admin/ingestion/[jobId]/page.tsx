/**
 * /admin/ingestion/[jobId] — single-job detail view.
 *
 * Drill-in target from the ingestion list. Shows the full
 * ``IngestionJobResponse`` payload — all timing fields, every metric,
 * every error, plus the raw metadata blob — so an operator can see
 * exactly what an ETL run did and what (if anything) went wrong.
 */
'use client';

import api from '@/lib/api/axios';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

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

export default function IngestionJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const { data, isLoading, error, refetch, isFetching } = useQuery<IngestionJob>({
    queryKey: ['admin', 'ingestion-job', jobId],
    queryFn: async () => (await api.get(`/admin/ingestion-jobs/${jobId}`)).data,
    staleTime: 15_000,
  });

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <Link
          href='/admin/ingestion'
          className='inline-flex items-center gap-1 text-sm text-gov-sage hover:text-gov-forest'>
          <ArrowLeft className='w-4 h-4' />
          Back to ingestion jobs
        </Link>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className='inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gov-sage/30 hover:border-gov-sage text-gov-forest rounded-lg text-sm transition-colors disabled:opacity-50'>
          <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <BodyState>
          <Loader2 className='w-6 h-6 text-gov-sage animate-spin' />
          <p className='text-gov-forest/60 text-sm'>Loading job…</p>
        </BodyState>
      ) : error || !data ? (
        <BodyState>
          <XCircle className='w-8 h-8 text-red-500' />
          <p className='text-red-600 text-sm'>Job not found or failed to load.</p>
        </BodyState>
      ) : (
        <>
          {/* ── Header card ── */}
          <div className='bg-white border border-gov-sage/20 rounded-xl p-6 shadow-sm'>
            <div className='flex items-start justify-between gap-3 flex-wrap'>
              <div>
                <p className='text-xs uppercase tracking-wide text-gov-forest/60 font-semibold'>
                  Ingestion Job #{data.id}
                </p>
                <h1 className='text-2xl font-bold text-gov-dark mt-1 font-mono'>{data.domain}</h1>
                <div className='flex items-center gap-2 mt-3'>
                  <StatusBadge status={data.status} hasErrors={data.errors.length > 0} />
                  {data.dry_run && (
                    <span className='inline-flex items-center text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded'>
                      dry-run
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Timing + metrics grid */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gov-sage/10'>
              <Field label='Items processed' value={data.items_processed.toLocaleString()} />
              <Field
                label='Created'
                value={data.items_created.toLocaleString()}
                tone='ok'
              />
              <Field
                label='Updated'
                value={data.items_updated.toLocaleString()}
                tone='info'
              />
              <Field label='Errors' value={data.errors.length.toString()} tone={data.errors.length > 0 ? 'bad' : 'muted'} />
              <Field label='Started' value={formatDate(data.started_at)} />
              <Field
                label='Finished'
                value={data.finished_at ? formatDate(data.finished_at) : '—'}
              />
              <Field label='Duration' value={formatDuration(data.duration_seconds)} />
              <Field label='Created at' value={formatDate(data.created_at)} />
            </div>
          </div>

          {/* ── Errors ── */}
          {data.errors.length > 0 && (
            <section className='bg-white border border-red-200 rounded-xl p-5 shadow-sm'>
              <div className='flex items-center gap-2 mb-3'>
                <AlertTriangle className='w-4 h-4 text-red-600' />
                <h2 className='text-sm font-semibold text-gov-dark'>
                  Errors ({data.errors.length})
                </h2>
              </div>
              <ul className='space-y-2'>
                {data.errors.map((err, i) => (
                  <li
                    key={i}
                    className='bg-red-50 border border-red-100 rounded-lg p-3 text-xs font-mono text-red-900 overflow-x-auto'>
                    <pre className='whitespace-pre-wrap break-all'>
                      {typeof err === 'string' ? err : JSON.stringify(err, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Metadata ── */}
          {Object.keys(data.metadata).length > 0 && (
            <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
              <h2 className='text-sm font-semibold text-gov-dark mb-3'>Metadata</h2>
              <pre className='text-xs font-mono bg-gov-cream/50 border border-gov-sage/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-gov-dark'>
                {JSON.stringify(data.metadata, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

function Field({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'bad' | 'info' | 'muted' | 'default';
}) {
  const colour = {
    ok: 'text-emerald-600',
    bad: 'text-red-600',
    info: 'text-blue-600',
    muted: 'text-gov-forest/50',
    default: 'text-gov-dark',
  }[tone];
  return (
    <div>
      <p className='text-[10px] uppercase tracking-wide text-gov-forest/60 font-semibold'>
        {label}
      </p>
      <p className={`text-sm font-medium mt-0.5 ${colour}`}>{value}</p>
    </div>
  );
}

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
          ? { bg: 'bg-amber-100', text: 'text-amber-800', icon: AlertTriangle, label: 'completed*' }
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

function BodyState({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-white border border-gov-sage/20 rounded-xl py-16 flex flex-col items-center justify-center gap-3 shadow-sm'>
      {children}
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
