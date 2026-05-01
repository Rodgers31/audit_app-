/**
 * /admin/etl — ETL schedule + manual trigger.
 *
 * Reads the existing /admin/etl/schedule and /admin/etl/health
 * endpoints to show what the smart scheduler is doing today, then
 * exposes a per-source "trigger now" button that POSTs to
 * /admin/etl/trigger/{source}. The trigger queues a row in
 * ingestion_jobs with status=pending — the long-running seeder
 * picks pending jobs up on its next cycle, so the operator can
 * follow the run on /admin/ingestion.
 */
'use client';

import api from '@/lib/api/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCcw,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface ScheduleSourceDecision {
  should_run: boolean;
  reason: string;
  next_run: string | null;
  next_reason?: string;
  current_period?: string;
}

interface ScheduleResponse {
  timestamp: string;
  summary: {
    sources_running_today: number;
    sources_skipping_today: number;
    total_sources: number;
    skip_percentage: number;
    efficiency_vs_fixed_schedule: string;
    sources_to_run: Array<{ source: string; reason: string }>;
    sources_not_running: string[];
  };
  sources: Record<string, ScheduleSourceDecision>;
}

interface EtlHealth {
  timestamp: string;
  scheduler_status: string;
  schedule_summary: unknown;
}

interface TriggerResponse {
  ok: boolean;
  job_id: number;
  source: string;
  status: string;
  dry_run: boolean;
  note: string;
}

export default function AdminEtlPage() {
  const qc = useQueryClient();

  const schedule = useQuery<ScheduleResponse>({
    queryKey: ['admin', 'etl-schedule'],
    queryFn: async () => (await api.get('/admin/etl/schedule')).data,
    staleTime: 30_000,
  });

  const health = useQuery<EtlHealth>({
    queryKey: ['admin', 'etl-health'],
    queryFn: async () => (await api.get('/admin/etl/health')).data,
    staleTime: 30_000,
  });

  const trigger = useMutation<TriggerResponse, unknown, { source: string; dryRun: boolean }>({
    mutationFn: async ({ source, dryRun }) =>
      (await api.post(`/admin/etl/trigger/${source}`, { dry_run: dryRun })).data,
    onSuccess: () => {
      // Refresh the schedule view + bust the ingestion list cache
      // so the operator sees the new job appear immediately.
      qc.invalidateQueries({ queryKey: ['admin', 'etl-schedule'] });
      qc.invalidateQueries({ queryKey: ['admin', 'ingestion-jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'ingestion-stats'] });
    },
  });

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <Link
            href='/admin'
            className='inline-flex items-center gap-1 text-xs text-gov-sage hover:text-gov-forest mb-1'>
            <ArrowLeft className='w-3 h-3' />
            Back to overview
          </Link>
          <h1 className='text-2xl sm:text-3xl font-bold text-gov-dark'>ETL Schedule</h1>
          <p className='text-gov-forest/60 text-sm mt-1'>
            Smart-scheduler decisions for today, plus manual trigger controls per source.
          </p>
        </div>
        <button
          onClick={() => {
            schedule.refetch();
            health.refetch();
          }}
          className='inline-flex items-center gap-2 px-3 py-2 bg-white border border-gov-sage/30 hover:border-gov-sage text-gov-forest rounded-lg text-sm transition-colors'>
          <RefreshCcw
            className={`w-4 h-4 ${schedule.isFetching || health.isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card icon={PlayCircle} label='Running today'>
          <p className='text-2xl font-bold text-gov-dark'>
            {schedule.data
              ? `${schedule.data.summary.sources_running_today}/${schedule.data.summary.total_sources}`
              : '…'}
          </p>
        </Card>
        <Card icon={Activity} label='Scheduler health'>
          <p className='text-2xl font-bold text-gov-dark capitalize'>
            {health.data ? health.data.scheduler_status.split(':')[0] : '…'}
          </p>
        </Card>
        <Card icon={Zap} label='Efficiency vs fixed schedule'>
          <p className='text-sm font-medium text-gov-forest mt-2'>
            {schedule.data?.summary.efficiency_vs_fixed_schedule ?? '—'}
          </p>
        </Card>
      </div>

      {/* ── Trigger feedback ── */}
      {trigger.isSuccess && trigger.data && (
        <div className='bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm'>
          <CheckCircle2 className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
          <div>
            <p className='font-medium text-emerald-900'>
              Queued <span className='font-mono'>{trigger.data.source}</span> · job #
              <Link
                href={`/admin/ingestion/${trigger.data.job_id}`}
                className='underline underline-offset-2 hover:text-emerald-700'>
                {trigger.data.job_id}
              </Link>
              {trigger.data.dry_run && ' (dry-run)'}
            </p>
            <p className='text-emerald-800/80 text-xs mt-0.5'>{trigger.data.note}</p>
          </div>
        </div>
      )}
      {trigger.isError && (
        <div className='bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm'>
          <XCircle className='w-4 h-4 text-red-600 mt-0.5 shrink-0' />
          <p className='text-red-900'>
            Failed to queue trigger:{' '}
            {(trigger.error as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail || 'unknown error'}
          </p>
        </div>
      )}

      {/* ── Per-source table ── */}
      <section className='bg-white border border-gov-sage/20 rounded-xl overflow-hidden shadow-sm'>
        <header className='px-5 py-3 border-b border-gov-sage/20 bg-gov-cream'>
          <h2 className='text-sm font-semibold text-gov-dark'>Sources</h2>
        </header>
        {schedule.isLoading ? (
          <div className='py-16 flex justify-center'>
            <Loader2 className='w-5 h-5 text-gov-sage animate-spin' />
          </div>
        ) : !schedule.data ? (
          <div className='py-12 px-6 text-center text-red-600 text-sm'>
            <AlertTriangle className='w-6 h-6 mx-auto mb-2' />
            Could not load schedule.
          </div>
        ) : (
          <ul className='divide-y divide-gov-sage/10'>
            {Object.entries(schedule.data.sources).map(([source, decision]) => (
              <SourceRow
                key={source}
                source={source}
                decision={decision}
                pending={trigger.isPending && trigger.variables?.source === source}
                onTrigger={(dryRun) => trigger.mutate({ source, dryRun })}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
      <div className='flex items-center gap-2 mb-2'>
        <Icon className='w-4 h-4 text-gov-sage' />
        <p className='text-xs uppercase tracking-wide text-gov-forest/60 font-semibold'>{label}</p>
      </div>
      {children}
    </div>
  );
}

function SourceRow({
  source,
  decision,
  pending,
  onTrigger,
}: {
  source: string;
  decision: ScheduleSourceDecision;
  pending: boolean;
  onTrigger: (dryRun: boolean) => void;
}) {
  const [confirming, setConfirming] = useState<null | 'real' | 'dry'>(null);
  const Icon = decision.should_run ? CheckCircle2 : Clock;
  const colour = decision.should_run ? 'text-emerald-600' : 'text-gov-forest/40';

  return (
    <li className='px-5 py-4 flex flex-wrap items-center gap-4'>
      <div className='flex items-center gap-3 min-w-[12rem]'>
        <Icon className={`w-5 h-5 ${colour}`} />
        <div>
          <p className='font-mono text-sm font-semibold text-gov-dark'>{source}</p>
          {decision.current_period && (
            <p className='text-[10px] uppercase tracking-wide text-gov-forest/50 mt-0.5'>
              {decision.current_period}
            </p>
          )}
        </div>
      </div>

      <div className='flex-1 min-w-[16rem] text-xs text-gov-forest/70'>
        <p>
          <span className='text-gov-forest/50 mr-1'>Reason:</span>
          {decision.reason}
        </p>
        {decision.next_run && (
          <p className='mt-0.5'>
            <span className='text-gov-forest/50 mr-1'>Next run:</span>
            {new Date(decision.next_run).toLocaleString()}
            {decision.next_reason ? ` · ${decision.next_reason}` : ''}
          </p>
        )}
      </div>

      <div className='flex items-center gap-2 ml-auto'>
        {confirming ? (
          <div className='flex items-center gap-2'>
            <span className='text-xs text-gov-forest/60'>
              Run {source} {confirming === 'dry' ? '(dry-run)' : 'now'}?
            </span>
            <button
              disabled={pending}
              onClick={() => {
                onTrigger(confirming === 'dry');
                setConfirming(null);
              }}
              className='px-2 py-1 bg-gov-sage text-white text-xs rounded-md hover:bg-gov-sage/90 disabled:opacity-50'>
              {pending ? <Loader2 className='w-3 h-3 animate-spin' /> : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirming(null)}
              className='px-2 py-1 text-xs text-gov-forest/60 hover:text-gov-forest'>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirming('dry')}
              className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gov-sage/30 hover:border-gov-sage text-gov-forest transition-colors'>
              Dry-run
            </button>
            <button
              onClick={() => setConfirming('real')}
              className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gov-forest text-white hover:bg-gov-dark transition-colors'>
              <PlayCircle className='w-3 h-3' />
              Trigger
            </button>
          </>
        )}
      </div>
    </li>
  );
}
