'use client';

import DataFreshnessBadge from '@/components/DataFreshnessBadge';
import DataIntegrityBanner from '@/components/DataIntegrityBanner';
import InfoTip from '@/components/InfoTip';
import PageShell from '@/components/layout/PageShell';
import PDFExportButton from '@/components/PDFExportButton';
import LenderTreemap from '@/components/debt/LenderTreemap';
import MaturityLadder from '@/components/debt/MaturityLadder';
import PeerStrip from '@/components/debt/PeerStrip';
import {
  useDebtSustainability,
  useDebtTimeline,
  useNationalDebtOverview,
  useNationalLoans,
  usePendingBills,
  usePendingBillsSummary,
} from '@/lib/react-query/useDebt';
import { useFiscalSummary } from '@/lib/react-query/useFiscal';
import { apiClient } from '@/lib/api/axios';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileWarning,
  Flame,
  Gauge,
  Scale,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function fmtT(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '—';
  if (val >= 1_000_000_000_000) return `${(val / 1_000_000_000_000).toFixed(2)}T`;
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  return val.toLocaleString();
}

function fmtKES(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '—';
  return `KES ${fmtT(val)}`;
}

function pct(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '—';
  return `${val.toFixed(1)}%`;
}

/* ═══════════════════════════════════════════════════════
   Animated number — counts up on mount, tabular-nums
   ═══════════════════════════════════════════════════════ */

function AnimatedCurrency({
  value,
  duration = 1.6,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(value * 0.6);
  const display = useTransform(mv, (v) => {
    if (v >= 1_000_000_000_000) return `KES ${(v / 1_000_000_000_000).toFixed(2)}T`;
    if (v >= 1_000_000_000) return `KES ${(v / 1_000_000_000).toFixed(1)}B`;
    return `KES ${Math.round(v).toLocaleString()}`;
  });

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={`tabular-nums ${className}`}>{display}</motion.span>;
}

/* ═══════════════════════════════════════════════════════
   Small inline atoms
   ═══════════════════════════════════════════════════════ */

function RingGauge({
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  color = '#C94A4A',
  track = 'rgba(31,58,42,0.10)',
  threshold,
  label,
  subLabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  track?: string;
  threshold?: number;
  label: string;
  subLabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, max));
  const offset = circumference - (clamped / max) * circumference;
  const thresholdAngle = threshold != null ? (threshold / max) * 360 : null;

  return (
    <div className='flex flex-col items-center'>
      <div className='relative inline-flex items-center justify-center' style={{ width: size, height: size }}>
        <svg width={size} height={size} className='-rotate-90'>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={track}
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
          {thresholdAngle != null && (
            <line
              x1={size / 2}
              y1={strokeWidth / 2}
              x2={size / 2}
              y2={strokeWidth + 8}
              stroke='#1B3A2A'
              strokeWidth={2}
              strokeLinecap='round'
              transform={`rotate(${thresholdAngle - 90}, ${size / 2}, ${size / 2})`}
            />
          )}
        </svg>
        <div className='absolute inset-0 flex flex-col items-center justify-center'>
          <span className='text-2xl font-bold text-gov-dark tabular-nums'>{value.toFixed(1)}%</span>
          {threshold != null && (
            <span className='text-[10px] text-neutral-muted'>IMF {threshold}%</span>
          )}
        </div>
      </div>
      <div className='text-xs font-semibold text-gov-dark text-center mt-2'>{label}</div>
      {subLabel && <div className='text-[11px] text-neutral-muted mt-0.5 text-center max-w-[160px]'>{subLabel}</div>}
    </div>
  );
}

function Sparkline({
  data,
  color = '#C94A4A',
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const series = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className='w-full'>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id='spark-grad' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor={color} stopOpacity={0.45} />
              <stop offset='100%' stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type='monotone'
            dataKey='v'
            stroke={color}
            strokeWidth={2}
            fill='url(#spark-grad)'
            dot={false}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */

export default function NationalDebtPage() {
  const {
    data: overview,
    isLoading: ovLoading,
    isError: ovError,
    refetch: refetchOverview,
  } = useNationalDebtOverview();

  const backendReady = !!overview;

  const {
    data: loansResp,
    isLoading: loansLoading,
    isError: loansError,
    refetch: refetchLoans,
  } = useNationalLoans({ enabled: backendReady });
  const {
    data: timelineResp,
    isLoading: tlLoading,
    isError: tlError,
    refetch: refetchTimeline,
  } = useDebtTimeline({ enabled: backendReady });
  const { data: fiscalResp } = useFiscalSummary({ enabled: backendReady });
  const { data: pendingBillsData } = usePendingBills({ enabled: backendReady });
  const { data: rawPendingBillsSummary } = usePendingBillsSummary({ enabled: backendReady });
  const { data: rawDebtSustainability } = useDebtSustainability({ enabled: backendReady });

  /* ── Normalize pending bills summary (API returns dicts) ── */
  const pendingBillsSummary = useMemo(() => {
    if (!rawPendingBillsSummary) return null;
    const raw = rawPendingBillsSummary as any;
    const totalPending = raw.total_pending_amount || 0;

    let breakdownByType = raw.breakdown_by_type;
    if (breakdownByType && !Array.isArray(breakdownByType)) {
      breakdownByType = Object.entries(breakdownByType).map(([type, amount]: [string, any]) => ({
        type,
        amount: Number(amount) || 0,
        percentage: totalPending > 0 ? ((Number(amount) || 0) / totalPending) * 100 : 0,
      }));
    }

    let agingBuckets = raw.aging_buckets;
    if (agingBuckets && !Array.isArray(agingBuckets)) {
      agingBuckets = Object.entries(agingBuckets).map(([bucket, amount]: [string, any]) => ({
        bucket,
        amount: Number(amount) || 0,
        percentage: totalPending > 0 ? ((Number(amount) || 0) / totalPending) * 100 : 0,
        count: 0,
      }));
    }

    const topCounties = (raw.top_counties_by_amount || []).map((c: any) => ({
      ...c,
      county_name: c.county_name || c.county || 'Unknown',
      county_id: c.county_id || c.entity_id || c.id,
    }));

    return {
      ...raw,
      breakdown_by_type: breakdownByType || [],
      aging_buckets: agingBuckets || [],
      top_counties_by_amount: topCounties,
    };
  }, [rawPendingBillsSummary]);

  /* ── Normalize sustainability indicators ── */
  const debtSustainability = useMemo(() => {
    if (!rawDebtSustainability) return null;
    const raw = rawDebtSustainability as any;
    const extractNum = (field: any): number | null => {
      if (field == null) return null;
      if (typeof field === 'number') return field;
      if (typeof field === 'object' && field.value != null) return Number(field.value);
      return null;
    };
    return {
      ...raw,
      debt_to_gdp: extractNum(raw.debt_to_gdp) ?? 0,
      debt_service_to_revenue: extractNum(raw.debt_service_to_revenue) ?? 0,
      external_debt_share: extractNum(raw.external_debt_share) ?? 0,
      projections: raw.projections || [],
      regional_peers: (raw.regional_peers || []).map((p: any) => ({
        ...p,
        debt_to_gdp: extractNum(p.debt_to_gdp) ?? 0,
        debt_service_to_revenue: extractNum(p.debt_service_to_revenue) ?? 0,
        external_debt_share: extractNum(p.external_debt_share) ?? 0,
      })),
    };
  }, [rawDebtSustainability]);

  const [loanSort, setLoanSort] = useState<'outstanding' | 'rate' | 'service'>('outstanding');
  const [fetchedPopulation, setFetchedPopulation] = useState<number | null>(null);
  const [pbView, setPbView] = useState<'national' | 'counties'>('national');
  const [showAllLoans, setShowAllLoans] = useState(false);

  useEffect(() => {
    if (!backendReady) return;
    apiClient
      .get('/economic/population/latest')
      .then((res) => setFetchedPopulation(res.data?.population ?? null))
      .catch(() => setFetchedPopulation(null));
  }, [backendReady]);

  /* ── Derived data ── */
  const d = useMemo(() => {
    const api = overview?.data || overview || {};
    const hasData = Object.keys(api).length > 0;
    const totalDebt = api.total_outstanding ?? api.total_debt ?? null;
    const gdp = api.gdp ?? null;
    const gdpRatio = api.debt_to_gdp_ratio ?? (gdp && totalDebt ? (totalDebt / gdp) * 100 : null);
    const summary = api.summary || {};
    const categories = api.categories || {};
    const population = fetchedPopulation || api.population || null;
    const perCapita = totalDebt != null && totalDebt > 0 && population ? totalDebt / population : null;
    const asOf = api.as_of || api.last_updated || null;
    const source = api.source || 'CBK / Treasury';

    return {
      hasData,
      totalDebt,
      gdp,
      gdpRatio,
      summary,
      categories,
      loanCount: api.loan_count ?? null,
      perCapita,
      population,
      externalDebt: summary.external_debt ?? null,
      domesticDebt: summary.domestic_debt ?? null,
      externalPct: summary.external_percentage ?? null,
      domesticPct: summary.domestic_percentage ?? null,
      asOf,
      source,
    };
  }, [overview, fetchedPopulation]);

  const loans = useMemo(() => {
    if (!loansResp?.loans) return [];
    const arr = [...loansResp.loans];
    if (loanSort === 'rate') {
      arr.sort((a, b) => {
        const rA = parseFloat((a.interest_rate || '0').replace('%', ''));
        const rB = parseFloat((b.interest_rate || '0').replace('%', ''));
        return rB - rA;
      });
    } else if (loanSort === 'service') {
      arr.sort((a, b) => (b.annual_service_cost || 0) - (a.annual_service_cost || 0));
    } else {
      arr.sort((a, b) => (b.outstanding_numeric || 0) - (a.outstanding_numeric || 0));
    }
    return arr;
  }, [loansResp, loanSort]);

  const timeline = useMemo(() => timelineResp?.timeline || [], [timelineResp]);

  const fiscal = useMemo(() => {
    if (!fiscalResp) return null;
    const years = fiscalResp.history || [];
    const current = fiscalResp.current || years[years.length - 1];
    return { current, years };
  }, [fiscalResp]);

  const yoyGrowth = useMemo(() => {
    if (timeline.length < 2) return null;
    const last = timeline[timeline.length - 1];
    const prev = timeline[timeline.length - 2];
    const change = ((last.total - prev.total) / prev.total) * 100;
    return { change, amount: last.total - prev.total, year: last.year };
  }, [timeline]);

  const pb = useMemo(() => {
    if (!pendingBillsData || pendingBillsData.status === 'no_data') return null;
    const s = pendingBillsData.summary;
    return {
      total: s.total_pending,
      national: s.national_total,
      county: s.county_total,
      count: s.record_count,
      bills: pendingBillsData.pending_bills || [],
      source: pendingBillsData.source,
      sourceUrl: pendingBillsData.source_url,
    };
  }, [pendingBillsData]);

  /* ── Treemap data adapter ── */
  const lenderCategories = useMemo(() => {
    return Object.entries(d.categories)
      .map(([key, val]: [string, any]) => {
        const outstanding = val.total_outstanding || val.total_principal || 0;
        const label = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          category: key,
          label,
          outstanding,
          share: val.percentage_of_total || 0,
          lenders: (val.items || []).map((it: any) => ({
            lender: it.lender,
            outstanding: Number(it.outstanding) || 0,
            rate: it.interest_rate,
            annual_service_cost: it.annual_service_cost,
          })),
        };
      })
      .filter((c) => c.outstanding > 0);
  }, [d.categories]);

  /* ── Risk band from debt-to-GDP ── */
  const riskBand = useMemo(() => {
    const r = d.gdpRatio ?? 0;
    if (r >= 60) return { level: 'High', tone: 'text-gov-copper', bg: 'bg-gov-copper/15', pill: 'pill-risk' };
    if (r >= 40) return { level: 'Moderate', tone: 'text-gov-gold', bg: 'bg-gov-gold/15', pill: 'pill-risk' };
    return { level: 'Low', tone: 'text-gov-sage', bg: 'bg-gov-sage/15', pill: 'pill-safe' };
  }, [d.gdpRatio]);

  /* ── Debt service allocation (KES 100 breakdown) ── */
  const taxAllocation = useMemo(() => {
    if (!fiscal?.current) return null;
    const c: any = fiscal.current;
    const rev = c.total_revenue || 0;
    if (!rev) return null;
    const ds = c.debt_service_cost || 0;
    const rec = Math.max((c.recurrent_spending || 0) - ds, 0);
    const dev = c.development_spending || 0;
    const counties = c.county_allocation || 0;
    const total = ds + rec + dev + counties;
    const scale = total > 0 ? 100 / total : 0;
    return {
      debtService: ds * scale,
      recurrent: rec * scale,
      development: dev * scale,
      counties: counties * scale,
      rev,
      ds,
      debtServicePct: rev > 0 ? (ds / rev) * 100 : 0,
    };
  }, [fiscal]);

  /* ── Loading / Error states ── */
  const isLoading = ovLoading || loansLoading || tlLoading;
  const isError = ovError || loansError || tlError;

  if (isLoading) {
    return (
      <PageShell title="Kenya's National Debt" subtitle='Pulling the latest numbers from CBK, Treasury and COB…'>
        <div className='flex flex-col items-center justify-center py-24' role='status' aria-live='polite'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gov-forest mb-4' />
          <span className='text-sm text-neutral-muted'>Loading comprehensive debt data…</span>
        </div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell title="Kenya's National Debt" subtitle='Data temporarily unavailable.'>
        <div className='flex flex-col items-center justify-center py-20 text-center'>
          <AlertTriangle size={48} className='text-gov-copper mb-4' />
          <h3 className='text-lg font-semibold text-gov-dark mb-1'>Failed to load debt data</h3>
          <p className='text-sm text-neutral-muted mb-5 max-w-md'>
            Upstream sources (CBK, Treasury) may be slow. You can retry without leaving the page.
          </p>
          <button
            onClick={() => {
              refetchOverview();
              refetchLoans();
              refetchTimeline();
            }}
            className='btn btn-primary'>
            Retry fetch
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Kenya's National Debt"
      subtitle='Every shilling owed, every lender named, every cent of interest — so you can hold power to account.'>
      {!d.hasData && (
        <DataIntegrityBanner
          severity='warning'
          message='The backend returned no debt-overview record. Sections below may be blank until the seeding pipeline publishes fresh numbers.'
        />
      )}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <DataFreshnessBadge sources='CBK/Treasury' variant='inline' />
        <PDFExportButton />
      </div>

      {/* ═══════════ SECTION 1 — DEBT CLOCK HERO ═══════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-gov-dark via-gov-forest to-gov-dark text-white p-6 sm:p-8'>
        <div
          className='absolute inset-0 opacity-20 pointer-events-none'
          aria-hidden='true'
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(217,164,65,0.25), transparent 40%), radial-gradient(circle at 80% 80%, rgba(201,74,74,0.22), transparent 45%)',
          }}
        />
        <div className='relative grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-8 items-center'>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <Flame className='text-gov-gold' size={18} />
              <span className='text-[11px] uppercase tracking-[0.2em] font-semibold text-gov-gold/90'>
                Live national debt counter
              </span>
            </div>
            <div className='metric-hero leading-none'>
              {d.totalDebt != null ? (
                <AnimatedCurrency value={d.totalDebt} />
              ) : (
                <span className='opacity-50'>KES —</span>
              )}
            </div>
            <p className='mt-3 text-white/70 text-sm sm:text-base max-w-xl'>
              Outstanding public debt — money borrowed by the Kenyan government that must be
              repaid, with interest, from taxes you pay.
            </p>
            {yoyGrowth && (
              <div className='mt-4 flex flex-wrap items-center gap-2 text-sm'>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                    yoyGrowth.change >= 0
                      ? 'bg-gov-copper/20 text-gov-copper border border-gov-copper/40'
                      : 'bg-gov-sage/20 text-gov-sage border border-gov-sage/40'
                  }`}>
                  {yoyGrowth.change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {yoyGrowth.change >= 0 ? '+' : ''}
                  {yoyGrowth.change.toFixed(1)}% YoY
                </span>
                <span className='text-white/70'>
                  Added KES {fmtT(Math.abs(yoyGrowth.amount) * 1_000_000_000)} in {yoyGrowth.year}
                </span>
              </div>
            )}
            {timeline.length > 1 && (
              <div className='mt-4'>
                <p className='text-[10px] uppercase tracking-wider text-white/50 mb-1'>
                  10-year trajectory
                </p>
                <Sparkline data={timeline.map((t) => t.total)} color='#D9A441' height={48} />
              </div>
            )}
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3'>
            <div className='rounded-xl bg-white/8 backdrop-blur border border-white/15 p-4'>
              <div className='flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60 mb-1.5'>
                <Users size={12} />
                Per citizen
              </div>
              <div className='text-2xl sm:text-3xl font-bold text-white tabular-nums'>
                {d.perCapita != null ? `KES ${Math.round(d.perCapita).toLocaleString()}` : '—'}
              </div>
              <p className='text-[11px] text-white/50 mt-1'>
                If every Kenyan paid an equal share
              </p>
            </div>
            <div className='rounded-xl bg-white/8 backdrop-blur border border-white/15 p-4'>
              <div className='flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60 mb-1.5'>
                <Scale size={12} />
                Debt-to-GDP
                <InfoTip term='debt-to-gdp' size={11} />
              </div>
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl sm:text-3xl font-bold text-white tabular-nums'>
                  {pct(d.gdpRatio)}
                </span>
                <span className='text-[11px] text-white/50'>vs IMF 55%</span>
              </div>
              {d.gdpRatio != null && (
                <div className='mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden'>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(d.gdpRatio, 100)}%` }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className='h-full rounded-full'
                    style={{
                      background:
                        d.gdpRatio >= 60
                          ? 'linear-gradient(90deg,#D9A441,#C94A4A)'
                          : d.gdpRatio >= 40
                            ? '#D9A441'
                            : '#4A7C5C',
                    }}
                  />
                </div>
              )}
            </div>
            <div className='rounded-xl bg-white/8 backdrop-blur border border-white/15 p-4'>
              <div className='flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60 mb-1.5'>
                <ShieldAlert size={12} />
                Risk level
              </div>
              <div className='flex items-center gap-2'>
                <span className={`text-2xl sm:text-3xl font-bold ${riskBand.tone.replace('text-', 'text-')}`}>
                  {riskBand.level}
                </span>
              </div>
              <p className='text-[11px] text-white/50 mt-1'>
                Based on IMF debt-sustainability thresholds
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════ SECTION 2 — WHO KENYA OWES ═══════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className='space-y-4'>
        <div>
          <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
            <Building2 className='text-gov-forest' size={24} />
            Who Kenya owes
          </h2>
          <p className='text-sm text-neutral-muted mt-1'>
            The debt broken down by lender category — foreign creditors (external) vs. local banks
            and pension funds (domestic). Tile size reflects outstanding amount.
          </p>
        </div>
        <LenderTreemap
          categories={lenderCategories}
          totalOutstanding={d.totalDebt || 0}
        />
      </motion.section>

      {/* ═══════════ SECTION 3 — MATURITY LADDER ═══════════ */}
      {loans.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}>
          <MaturityLadder loans={loans} />
        </motion.section>
      )}

      {/* ═══════════ SECTION 4 — REGIONAL PEERS ═══════════ */}
      {debtSustainability?.regional_peers?.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}>
          <PeerStrip peers={debtSustainability.regional_peers} />
        </motion.section>
      )}

      {/* ═══════════ SECTION 5 — SUSTAINABILITY GAUGES + PROJECTION ═══════════ */}
      {debtSustainability && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className='space-y-4'>
          <div>
            <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
              <Gauge className='text-gov-forest' size={24} />
              Can Kenya keep paying?
            </h2>
            <p className='text-sm text-neutral-muted mt-1'>
              Three sustainability ratios compared against internationally-agreed thresholds.
              Crossing them signals fiscal stress.
            </p>
          </div>
          <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface p-5 sm:p-6'>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6'>
              <RingGauge
                value={debtSustainability.debt_to_gdp}
                color={debtSustainability.debt_to_gdp >= 55 ? '#C94A4A' : '#4A7C5C'}
                threshold={55}
                label='Debt-to-GDP'
                subLabel='Total debt as % of the economy'
              />
              <RingGauge
                value={debtSustainability.debt_service_to_revenue}
                color={debtSustainability.debt_service_to_revenue >= 30 ? '#C94A4A' : '#D9A441'}
                threshold={30}
                label='Service / Revenue'
                subLabel='% of tax revenue going to debt repayment'
              />
              <RingGauge
                value={debtSustainability.external_debt_share}
                color='#8b5cf6'
                label='External share'
                subLabel='% of debt held by foreign lenders (FX-exposed)'
              />
            </div>

            {debtSustainability.projections?.length > 0 && (
              <div>
                <div className='flex items-center gap-2 mb-2'>
                  <TrendingUp size={16} className='text-gov-forest' />
                  <h3 className='text-sm font-semibold text-gov-dark'>5-year projection</h3>
                </div>
                <ResponsiveContainer width='100%' height={220}>
                  <LineChart data={debtSustainability.projections} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#E2DDD5' vertical={false} />
                    <XAxis dataKey='year' tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid rgba(226,221,213,0.4)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => `${Number(v).toFixed(1)}%`}
                    />
                    <ReferenceLine y={55} stroke='#C94A4A' strokeDasharray='4 4'>
                      <text x='90%' y={-4} fill='#C94A4A' fontSize={10} fontWeight={600}>
                        IMF 55%
                      </text>
                    </ReferenceLine>
                    <Line
                      type='monotone'
                      dataKey='projected_debt_to_gdp'
                      name='Debt-to-GDP'
                      stroke='#C94A4A'
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#C94A4A' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* ═══════════ SECTION 6 — TAX SHILLING ALLOCATION ═══════════ */}
      {taxAllocation && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className='space-y-4'>
          <div>
            <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
              <CircleDollarSign className='text-gov-forest' size={24} />
              Where every KES 100 of tax goes
            </h2>
            <p className='text-sm text-neutral-muted mt-1'>
              How each shilling of revenue is spent — debt service comes{' '}
              <span className='font-semibold text-gov-copper'>first</span> by law before anything
              else.
            </p>
          </div>
          <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface p-5'>
            <div className='flex items-baseline gap-3 mb-4'>
              <div>
                <div className='text-[11px] uppercase tracking-wider text-neutral-muted'>
                  Debt service eats
                </div>
                <div className='metric-large text-gov-copper'>
                  KES {taxAllocation.debtService.toFixed(0)}
                </div>
                <div className='text-[11px] text-neutral-muted'>
                  out of every KES 100 in spending
                </div>
              </div>
            </div>
            <div className='flex w-full h-12 rounded-lg overflow-hidden border border-neutral-border/40'>
              <div
                className='flex items-center justify-center bg-gov-copper text-white text-xs font-bold'
                style={{ width: `${taxAllocation.debtService}%` }}
                title={`Debt service: KES ${taxAllocation.debtService.toFixed(1)}`}>
                {taxAllocation.debtService > 8 ? `${taxAllocation.debtService.toFixed(0)}%` : ''}
              </div>
              <div
                className='flex items-center justify-center bg-gov-forest text-white text-xs font-bold'
                style={{ width: `${taxAllocation.recurrent}%` }}
                title={`Recurrent: KES ${taxAllocation.recurrent.toFixed(1)}`}>
                {taxAllocation.recurrent > 8 ? `${taxAllocation.recurrent.toFixed(0)}%` : ''}
              </div>
              <div
                className='flex items-center justify-center bg-gov-sage text-white text-xs font-bold'
                style={{ width: `${taxAllocation.development}%` }}
                title={`Development: KES ${taxAllocation.development.toFixed(1)}`}>
                {taxAllocation.development > 8 ? `${taxAllocation.development.toFixed(0)}%` : ''}
              </div>
              <div
                className='flex items-center justify-center bg-gov-gold text-white text-xs font-bold'
                style={{ width: `${taxAllocation.counties}%` }}
                title={`Counties: KES ${taxAllocation.counties.toFixed(1)}`}>
                {taxAllocation.counties > 8 ? `${taxAllocation.counties.toFixed(0)}%` : ''}
              </div>
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]'>
              <div className='flex items-center gap-1.5'>
                <span className='w-2.5 h-2.5 rounded-sm bg-gov-copper' />
                <span className='text-neutral-muted'>Debt service</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='w-2.5 h-2.5 rounded-sm bg-gov-forest' />
                <span className='text-neutral-muted'>Recurrent (salaries, ops)</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='w-2.5 h-2.5 rounded-sm bg-gov-sage' />
                <span className='text-neutral-muted'>Development</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='w-2.5 h-2.5 rounded-sm bg-gov-gold' />
                <span className='text-neutral-muted'>Counties</span>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ═══════════ SECTION 7 — PENDING BILLS AGING ═══════════ */}
      {pb && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className='space-y-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
                <FileWarning className='text-gov-forest' size={24} />
                Stalled payments
                <InfoTip term='pending-bills' size={14} />
              </h2>
              <p className='text-sm text-neutral-muted mt-1'>
                Money already owed to suppliers, contractors and staff — but not yet paid. Older
                bills are a signal of cashflow distress.
              </p>
            </div>
            <div className='inline-flex rounded-lg bg-white/70 border border-white/70 p-1'>
              <button
                onClick={() => setPbView('national')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  pbView === 'national' ? 'bg-gov-dark text-white' : 'text-gov-dark hover:bg-white'
                }`}>
                National
              </button>
              <button
                onClick={() => setPbView('counties')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  pbView === 'counties' ? 'bg-gov-dark text-white' : 'text-gov-dark hover:bg-white'
                }`}>
                Counties
              </button>
            </div>
          </div>

          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            <div className='rounded-xl bg-gov-copper/10 border border-gov-copper/30 p-4'>
              <div className='text-[10px] uppercase tracking-wider text-gov-copper font-semibold'>
                Total stalled
              </div>
              <div className='metric-medium text-gov-dark'>{fmtKES(pb.total)}</div>
            </div>
            <div className='rounded-xl bg-white/70 border border-white/70 p-4'>
              <div className='text-[10px] uppercase tracking-wider text-neutral-muted font-semibold'>
                National
              </div>
              <div className='metric-medium text-gov-dark'>{fmtKES(pb.national)}</div>
            </div>
            <div className='rounded-xl bg-white/70 border border-white/70 p-4'>
              <div className='text-[10px] uppercase tracking-wider text-neutral-muted font-semibold'>
                Counties
              </div>
              <div className='metric-medium text-gov-dark'>{fmtKES(pb.county)}</div>
            </div>
            <div className='rounded-xl bg-white/70 border border-white/70 p-4'>
              <div className='text-[10px] uppercase tracking-wider text-neutral-muted font-semibold'>
                Entities affected
              </div>
              <div className='metric-medium text-gov-dark'>{pb.count.toLocaleString()}</div>
            </div>
          </div>

          {pendingBillsSummary?.aging_buckets?.length > 0 && (
            <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface p-5'>
              <h3 className='text-sm font-semibold text-gov-dark mb-3'>
                Aging — how long bills have gone unpaid
              </h3>
              <ResponsiveContainer width='100%' height={220}>
                <BarChart
                  data={pendingBillsSummary.aging_buckets}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id='agingGrad0' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#4A7C5C' stopOpacity={0.95} />
                      <stop offset='100%' stopColor='#2E5A3E' />
                    </linearGradient>
                    <linearGradient id='agingGrad1' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#D9A441' stopOpacity={0.95} />
                      <stop offset='100%' stopColor='#BA8B33' />
                    </linearGradient>
                    <linearGradient id='agingGrad2' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#E07B45' stopOpacity={0.95} />
                      <stop offset='100%' stopColor='#B05A2F' />
                    </linearGradient>
                    <linearGradient id='agingGrad3' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#C94A4A' stopOpacity={0.95} />
                      <stop offset='100%' stopColor='#8C2E2E' />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' stroke='#E2DDD5' vertical={false} />
                  <XAxis dataKey='bucket' tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => fmtT(v)}
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid rgba(226,221,213,0.4)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => fmtKES(Number(v))}
                  />
                  <Bar dataKey='amount' radius={[6, 6, 0, 0]}>
                    {pendingBillsSummary.aging_buckets.map((b: any, i: number) => (
                      <Cell key={b.bucket} fill={`url(#agingGrad${Math.min(i, 3)})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className='text-[11px] text-neutral-muted mt-2'>
                Bills older than 180 days are often referred to the Pending Bills Verification
                Committee — shown in deep copper.
              </p>
            </div>
          )}

          {pbView === 'counties' && pendingBillsSummary?.top_counties_by_amount?.length > 0 && (
            <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface p-5'>
              <h3 className='text-sm font-semibold text-gov-dark mb-3'>
                Top counties by stalled payments
              </h3>
              <div className='space-y-2'>
                {pendingBillsSummary.top_counties_by_amount.slice(0, 8).map((c: any, i: number) => {
                  const max = pendingBillsSummary.top_counties_by_amount[0]?.amount || 1;
                  const w = (c.amount / max) * 100;
                  return (
                    <div key={c.county_id || c.county_name} className='flex items-center gap-3'>
                      <span className='text-[11px] text-neutral-muted font-bold w-5'>
                        {i + 1}
                      </span>
                      <span className='text-xs font-medium text-gov-dark w-28 truncate'>
                        {c.county_name}
                      </span>
                      <div className='flex-1 h-4 bg-neutral-border/20 rounded-full overflow-hidden'>
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${w}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                          className='h-full rounded-full bg-gradient-to-r from-gov-copper/80 to-gov-copper'
                        />
                      </div>
                      <span className='text-xs font-bold text-gov-dark tabular-nums w-20 text-right'>
                        {fmtT(c.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>
      )}

      {/* ═══════════ SECTION 8 — DEBT SERVICE TREND ═══════════ */}
      {fiscal?.years && fiscal.years.length > 1 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className='space-y-4'>
          <div>
            <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
              <TrendingUp className='text-gov-forest' size={24} />
              The cost of debt over time
            </h2>
            <p className='text-sm text-neutral-muted mt-1'>
              Annual debt service (interest + principal repayments) and what share of revenue it
              consumes.
            </p>
          </div>
          <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface p-5'>
            <ResponsiveContainer width='100%' height={260}>
              <ComposedChart
                data={fiscal.years.map((y: any) => ({
                  year: y.fiscal_year,
                  service: y.debt_service_cost || 0,
                  ratio:
                    y.debt_service_cost && y.total_revenue
                      ? (y.debt_service_cost / y.total_revenue) * 100
                      : 0,
                }))}
                margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id='serviceFill' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#C94A4A' stopOpacity={0.5} />
                    <stop offset='100%' stopColor='#C94A4A' stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' stroke='#E2DDD5' vertical={false} />
                <XAxis dataKey='year' tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} />
                <YAxis
                  yAxisId='left'
                  tickFormatter={(v) => fmtT(v)}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  tickLine={false}
                  width={60}
                />
                <YAxis
                  yAxisId='right'
                  orientation='right'
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#D9A441', fontSize: 11 }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(226,221,213,0.4)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any, name: any) => {
                    if (name === 'ratio') return [`${Number(v).toFixed(1)}%`, 'Service / Revenue'];
                    return [fmtKES(Number(v)), 'Debt service'];
                  }}
                />
                <Area
                  yAxisId='left'
                  type='monotone'
                  dataKey='service'
                  stroke='#C94A4A'
                  strokeWidth={2.5}
                  fill='url(#serviceFill)'
                  name='service'
                />
                <Line
                  yAxisId='right'
                  type='monotone'
                  dataKey='ratio'
                  stroke='#D9A441'
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#D9A441' }}
                  name='ratio'
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      )}

      {/* ═══════════ SECTION 9 — FULL LOAN REGISTER ═══════════ */}
      {loans.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className='space-y-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='font-display text-2xl sm:text-3xl text-gov-dark flex items-center gap-2'>
                <BadgeDollarSign className='text-gov-forest' size={24} />
                The full loan register
              </h2>
              <p className='text-sm text-neutral-muted mt-1'>
                Every active loan facility, sortable by what matters most to you.
              </p>
            </div>
            <div className='inline-flex rounded-lg bg-white/70 border border-white/70 p-1 text-xs'>
              {(['outstanding', 'rate', 'service'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setLoanSort(key)}
                  className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                    loanSort === key ? 'bg-gov-dark text-white' : 'text-gov-dark hover:bg-white'
                  }`}>
                  {key === 'outstanding'
                    ? 'Balance'
                    : key === 'rate'
                      ? 'Interest rate'
                      : 'Service cost'}
                </button>
              ))}
            </div>
          </div>

          <div className='rounded-xl bg-white/70 border border-white/70 shadow-surface overflow-hidden'>
            {/* Desktop table */}
            <table className='w-full hidden md:table'>
              <thead className='bg-gov-dark/5 border-b border-neutral-border/40'>
                <tr className='text-[11px] uppercase tracking-wider text-neutral-muted'>
                  <th className='text-left px-4 py-3 font-semibold'>Lender</th>
                  <th className='text-left px-4 py-3 font-semibold'>Type</th>
                  <th className='text-right px-4 py-3 font-semibold'>Outstanding</th>
                  <th className='text-right px-4 py-3 font-semibold'>Rate</th>
                  <th className='text-right px-4 py-3 font-semibold'>Annual cost</th>
                  <th className='text-left px-4 py-3 font-semibold'>Maturity</th>
                </tr>
              </thead>
              <tbody>
                {(showAllLoans ? loans : loans.slice(0, 10)).map((l, i) => (
                  <tr
                    key={`${l.lender}-${i}`}
                    className='border-b border-neutral-border/20 hover:bg-white/40 transition-colors'>
                    <td className='px-4 py-3 text-sm font-medium text-gov-dark'>{l.lender}</td>
                    <td className='px-4 py-3 text-xs text-neutral-muted'>
                      {l.lender_type?.replace(/_/g, ' ')}
                    </td>
                    <td className='px-4 py-3 text-sm font-semibold text-gov-dark text-right tabular-nums'>
                      {fmtKES(l.outstanding_numeric)}
                    </td>
                    <td className='px-4 py-3 text-xs text-gov-copper text-right tabular-nums'>
                      {l.interest_rate || '—'}
                    </td>
                    <td className='px-4 py-3 text-xs text-neutral-muted text-right tabular-nums'>
                      {fmtKES(l.annual_service_cost)}
                    </td>
                    <td className='px-4 py-3 text-xs text-neutral-muted'>
                      {l.maturity_date || 'Revolving'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className='md:hidden divide-y divide-neutral-border/20'>
              {(showAllLoans ? loans : loans.slice(0, 10)).map((l, i) => (
                <div key={`${l.lender}-${i}`} className='p-4'>
                  <div className='text-sm font-semibold text-gov-dark mb-0.5'>{l.lender}</div>
                  <div className='text-[11px] text-neutral-muted mb-2'>
                    {l.lender_type?.replace(/_/g, ' ')}
                  </div>
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div>
                      <span className='text-neutral-muted block text-[10px] uppercase'>Outstanding</span>
                      <span className='font-semibold text-gov-dark tabular-nums'>
                        {fmtKES(l.outstanding_numeric)}
                      </span>
                    </div>
                    <div>
                      <span className='text-neutral-muted block text-[10px] uppercase'>Rate</span>
                      <span className='font-semibold text-gov-copper tabular-nums'>
                        {l.interest_rate || '—'}
                      </span>
                    </div>
                    <div>
                      <span className='text-neutral-muted block text-[10px] uppercase'>Annual cost</span>
                      <span className='font-semibold text-gov-dark tabular-nums'>
                        {fmtKES(l.annual_service_cost)}
                      </span>
                    </div>
                    <div>
                      <span className='text-neutral-muted block text-[10px] uppercase'>Maturity</span>
                      <span className='text-gov-dark'>{l.maturity_date || 'Revolving'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {loans.length > 10 && (
              <button
                onClick={() => setShowAllLoans((v) => !v)}
                className='w-full py-3 text-xs font-semibold text-gov-forest hover:bg-white/40 transition-colors border-t border-neutral-border/20'>
                {showAllLoans
                  ? `Show top 10 only`
                  : `Show all ${loans.length} loans`}{' '}
                {showAllLoans ? (
                  <ChevronUp size={14} className='inline' />
                ) : (
                  <ChevronDown size={14} className='inline' />
                )}
              </button>
            )}
          </div>
        </motion.section>
      )}

      {/* ═══════════ FOOTER / SOURCES ═══════════ */}
      <div className='rounded-xl bg-gov-dark/5 border border-gov-dark/10 p-5 text-xs text-neutral-muted'>
        <p className='font-semibold text-gov-dark mb-1'>Sources</p>
        <ul className='space-y-0.5'>
          <li>• Central Bank of Kenya — Monthly Statistical Bulletin &amp; Public Debt Register</li>
          <li>• National Treasury — Budget Policy Statement, Budget Review &amp; Outlook</li>
          <li>• Office of the Controller of Budget — Budget Implementation Review Reports</li>
          <li>
            • Peer comparison: IMF World Economic Outlook, World Bank International Debt Statistics
          </li>
        </ul>
      </div>
    </PageShell>
  );
}
