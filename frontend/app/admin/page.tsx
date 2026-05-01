/**
 * /admin — admin overview dashboard.
 *
 * Top-level landing page for admins. Aggregates a few "what's the
 * system doing right now?" widgets pulled from the existing backend
 * admin endpoints — ingestion jobs, ETL schedule, and ETL health.
 * Kept intentionally lean: each card answers a single question and
 * links to the sub-page where the operator can drill in.
 */
'use client';

import api from '@/lib/api/axios';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  ListChecks,
  PlayCircle,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

/* ── API response shapes (mirroring backend/routers/admin.py + etl_admin.py) ── */
interface IngestionStats {
  total_jobs: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  completed_with_errors: number;
  total_items_processed: number;
  total_items_created: number;
  total_items_updated: number;
  domains: Record<string, number>;
}

interface ScheduleSummary {
  timestamp: string;
  running_today: number;
  skipping_today: number;
  total_sources: number;
  efficiency: { skip_percentage: number; vs_fixed_schedule: string };
  sources_to_run: Array<{ source: string; reason: string }>;
}

interface EtlHealth {
  timestamp: string;
  scheduler_status: string;
  schedule_summary: unknown;
}

interface UserStats {
  total_users: number;
  admin_users: number;
  new_last_7_days: number;
  new_last_30_days: number;
}

interface AuditEntry {
  id: number;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface AuditList {
  entries: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export default function AdminOverviewPage() {
  // Each query is independent — failing one doesn't blank the others.
  const ingestion = useQuery<IngestionStats>({
    queryKey: ['admin', 'ingestion-stats', 7],
    queryFn: async () =>
      (await api.get('/admin/ingestion-jobs/stats/summary', { params: { days: 7 } })).data,
    staleTime: 30_000,
  });

  const schedule = useQuery<ScheduleSummary>({
    queryKey: ['admin', 'etl-schedule-summary'],
    queryFn: async () => (await api.get('/admin/etl/schedule/summary')).data,
    staleTime: 60_000,
  });

  const health = useQuery<EtlHealth>({
    queryKey: ['admin', 'etl-health'],
    queryFn: async () => (await api.get('/admin/etl/health')).data,
    staleTime: 60_000,
  });

  const userStats = useQuery<UserStats>({
    queryKey: ['admin', 'user-stats'],
    queryFn: async () => (await api.get('/admin/users/stats')).data,
    staleTime: 60_000,
  });

  const recentActions = useQuery<AuditList>({
    queryKey: ['admin', 'audit-log', { recent: true }],
    queryFn: async () =>
      (await api.get('/admin/audit-log', { params: { page_size: 5, days: 30 } })).data,
    staleTime: 30_000,
  });

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6'>
      <header>
        <h1 className='text-2xl sm:text-3xl font-bold text-gov-dark'>Admin Overview</h1>
        <p className='text-gov-forest/60 text-sm mt-1'>
          Monitor ingestion pipelines, ETL schedule, and system health at a glance.
        </p>
      </header>

      {/* ── Top stat grid ── */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          title='Ingestion (last 7 days)'
          icon={ListChecks}
          query={ingestion}
          href='/admin/ingestion'
          renderValue={(d) => (
            <>
              <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold text-gov-dark'>{d.total_jobs}</span>
                <span className='text-xs text-gov-forest/60'>jobs</span>
              </div>
              <div className='flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs'>
                <SubStat label='Completed' value={d.completed} tone='ok' />
                {d.completed_with_errors > 0 && (
                  <SubStat
                    label='Completed w/ errors'
                    value={d.completed_with_errors}
                    tone='warn'
                  />
                )}
                <SubStat label='Failed' value={d.failed} tone={d.failed > 0 ? 'bad' : 'muted'} />
                {d.running > 0 && <SubStat label='Running' value={d.running} tone='info' />}
              </div>
            </>
          )}
        />

        <StatCard
          title='ETL schedule today'
          icon={PlayCircle}
          query={schedule}
          href='/status'
          renderValue={(d) => (
            <>
              <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold text-gov-dark'>
                  {d.running_today}
                  <span className='text-base text-gov-forest/50'>/{d.total_sources}</span>
                </span>
                <span className='text-xs text-gov-forest/60'>sources running</span>
              </div>
              <p className='text-xs text-gov-forest/60 mt-3 line-clamp-1'>
                {d.efficiency.vs_fixed_schedule}
              </p>
            </>
          )}
        />

        <StatCard
          title='ETL system health'
          icon={Activity}
          query={health}
          href='/status'
          renderValue={(d) => {
            const ok = d.scheduler_status === 'healthy';
            return (
              <>
                <div className='flex items-center gap-2'>
                  {ok ? (
                    <CheckCircle2 className='w-6 h-6 text-emerald-500' />
                  ) : (
                    <XCircle className='w-6 h-6 text-red-500' />
                  )}
                  <span className='text-2xl font-bold text-gov-dark capitalize'>
                    {d.scheduler_status.split(':')[0]}
                  </span>
                </div>
                <p className='text-xs text-gov-forest/60 mt-3'>
                  Updated {timeAgo(d.timestamp)}
                </p>
              </>
            );
          }}
        />

        <StatCard
          title='Users'
          icon={Users}
          query={userStats}
          href='/admin/users'
          renderValue={(d) => (
            <>
              <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold text-gov-dark'>{d.total_users}</span>
                <span className='text-xs text-gov-forest/60'>total</span>
              </div>
              <div className='flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs'>
                <SubStat label='admins' value={d.admin_users} tone='info' />
                <SubStat label='new this week' value={d.new_last_7_days} tone='ok' />
              </div>
            </>
          )}
        />
      </div>

      {/* ── Ingestion: items processed widget ── */}
      {ingestion.data && (
        <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
          <div className='flex items-center gap-2 mb-3'>
            <TrendingUp className='w-4 h-4 text-gov-sage' />
            <h2 className='text-sm font-semibold text-gov-dark'>
              Ingestion volume (last 7 days)
            </h2>
          </div>
          <div className='grid grid-cols-3 gap-4'>
            <Metric label='Items processed' value={ingestion.data.total_items_processed} />
            <Metric label='Created' value={ingestion.data.total_items_created} tone='ok' />
            <Metric label='Updated' value={ingestion.data.total_items_updated} tone='info' />
          </div>

          {Object.keys(ingestion.data.domains).length > 0 && (
            <>
              <p className='text-xs text-gov-forest/60 mt-5 mb-2 uppercase tracking-wide font-medium'>
                Jobs by domain
              </p>
              <div className='flex flex-wrap gap-2'>
                {Object.entries(ingestion.data.domains)
                  .sort(([, a], [, b]) => b - a)
                  .map(([domain, count]) => (
                    <Link
                      key={domain}
                      href={`/admin/ingestion?domain=${encodeURIComponent(domain)}`}
                      className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gov-sage/10 hover:bg-gov-sage/20 text-xs text-gov-forest font-medium transition-colors'>
                      <span className='font-mono'>{domain}</span>
                      <span className='text-gov-forest/50'>·</span>
                      <span className='text-gov-sage font-semibold'>{count}</span>
                    </Link>
                  ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Recent admin actions ── */}
      {recentActions.data && recentActions.data.entries.length > 0 && (
        <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center gap-2'>
              <History className='w-4 h-4 text-gov-sage' />
              <h2 className='text-sm font-semibold text-gov-dark'>Recent admin actions</h2>
            </div>
            <Link
              href='/admin/audit-log'
              className='text-xs text-gov-sage hover:text-gov-forest inline-flex items-center gap-1'>
              View all
              <ArrowRight className='w-3 h-3' />
            </Link>
          </div>
          <ul className='space-y-2'>
            {recentActions.data.entries.map((entry) => (
              <li
                key={entry.id}
                className='flex items-center gap-3 px-3 py-2 rounded-lg bg-gov-cream text-sm'>
                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-white text-gov-forest border border-gov-sage/20'>
                  {entry.action}
                </span>
                {entry.target_type && (
                  <span className='text-xs text-gov-forest/70 truncate'>
                    on <span className='font-mono'>{entry.target_type}</span>
                    {entry.target_id && (
                      <>
                        {' / '}
                        <span className='font-mono text-gov-dark'>{entry.target_id}</span>
                      </>
                    )}
                  </span>
                )}
                <span className='text-xs text-gov-forest/60 ml-auto whitespace-nowrap'>
                  {entry.actor_email ?? entry.actor_id.slice(0, 8) + '…'} ·{' '}
                  {timeAgo(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── ETL sources to run today ── */}
      {schedule.data && schedule.data.sources_to_run.length > 0 && (
        <section className='bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm'>
          <div className='flex items-center gap-2 mb-3'>
            <Clock className='w-4 h-4 text-gov-sage' />
            <h2 className='text-sm font-semibold text-gov-dark'>Sources scheduled today</h2>
          </div>
          <ul className='space-y-2'>
            {schedule.data.sources_to_run.map(({ source, reason }) => (
              <li
                key={source}
                className='flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-gov-cream'>
                <div>
                  <span className='text-sm font-mono font-semibold text-gov-dark'>{source}</span>
                  <p className='text-xs text-gov-forest/60 mt-0.5'>{reason}</p>
                </div>
                <PlayCircle className='w-4 h-4 text-gov-sage shrink-0 mt-0.5' />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ── Building blocks ── */

interface QueryLike<T> {
  data?: T;
  isLoading: boolean;
  error: unknown;
}

function StatCard<T>({
  title,
  icon: Icon,
  query,
  href,
  renderValue,
}: {
  title: string;
  icon: React.ElementType;
  query: QueryLike<T>;
  href: string;
  renderValue: (data: T) => React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className='group bg-white border border-gov-sage/20 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gov-sage/40 transition-all'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Icon className='w-4 h-4 text-gov-sage' />
          <h3 className='text-xs font-semibold uppercase tracking-wide text-gov-forest/60'>
            {title}
          </h3>
        </div>
        <ArrowRight className='w-4 h-4 text-gov-forest/30 group-hover:text-gov-sage transition-colors' />
      </div>

      {query.isLoading ? (
        <div className='flex items-center gap-2 text-gov-forest/50 text-sm h-16'>
          <Loader2 className='w-4 h-4 animate-spin' />
          Loading…
        </div>
      ) : query.error || !query.data ? (
        <div className='flex items-center gap-2 text-amber-600 text-sm h-16'>
          <AlertTriangle className='w-4 h-4' />
          Could not load
        </div>
      ) : (
        renderValue(query.data)
      )}
    </Link>
  );
}

function SubStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'bad' | 'warn' | 'info' | 'muted';
}) {
  const colour = {
    ok: 'text-emerald-600',
    bad: 'text-red-600',
    warn: 'text-amber-600',
    info: 'text-blue-600',
    muted: 'text-gov-forest/50',
  }[tone];
  return (
    <span className={`${colour}`}>
      <span className='font-semibold'>{value}</span>{' '}
      <span className='text-gov-forest/60'>{label}</span>
    </span>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'info' | 'default';
}) {
  const colour = {
    ok: 'text-emerald-600',
    info: 'text-blue-600',
    default: 'text-gov-dark',
  }[tone];
  return (
    <div>
      <p className='text-xs text-gov-forest/60 font-medium'>{label}</p>
      <p className={`text-2xl font-bold ${colour}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
