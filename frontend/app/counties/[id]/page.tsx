'use client';

import FollowTheMoney, { YearSelector } from '@/components/FollowTheMoney';
import PageShell from '@/components/layout/PageShell';
import PDFExportButton from '@/components/PDFExportButton';
import WatchButton from '@/components/WatchButton';
import { useAvailableFiscalYears } from '@/lib/react-query';
import { useCountyAccountability, useCountyComprehensive } from '@/lib/react-query/useCounties';
import { useCountyPendingBills } from '@/lib/react-query/useDebt';
import { useCountyMoneyFlow } from '@/lib/react-query/useMoneyFlow';
import { generateFiscalYears } from '@/lib/utils';
import { CountyComprehensive } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  ExternalLink,
  FileWarning,
  HardHat,
  Info,
  Landmark,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

/* ═══════════ Utilities ═══════════ */
function fmtKES(n: number): string {
  if (n >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`;
  return `KES ${n.toLocaleString()}`;
}
function fmtPop(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
/** Convert snake_case to Title Case (e.g. "financial_services" → "Financial Services") */
function fmtLabel(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/* ═══════════ Shared constants ═══════════ */
const PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#a855f7',
  '#84cc16',
  '#0ea5e9',
  '#e11d48',
  '#94a3b8',
];

type Tab = 'overview' | 'budget' | 'audit' | 'accountability' | 'projects' | 'money';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Landmark },
  { id: 'money', label: 'Follow the Money', icon: Banknote },
  { id: 'budget', label: 'Budget & Debt', icon: CircleDollarSign },
  { id: 'audit', label: 'Audit Findings', icon: ShieldAlert },
  { id: 'accountability', label: 'Accountability', icon: Award },
  { id: 'projects', label: 'Projects', icon: HardHat },
];

const SEVERITY_STYLE: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800' },
  warning: { label: 'Warning', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800' },
  info: { label: 'Info', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-800' },
};

/* ═══════════ Grade Badge ═══════════ */
// Financial Health grade (budget execution, pending bills, debt sustainability — COB driven)
const HEALTH_GRADE_BG: Record<string, string> = {
  A: 'from-emerald-500 to-emerald-600',
  'B+': 'from-green-500 to-green-600',
  B: 'from-amber-500 to-amber-600',
  'B-': 'from-orange-500 to-orange-600',
  C: 'from-red-500 to-red-600',
};
// Accountability grade (audit findings, unresolved items, flagged amounts — OAG driven)
const ACCT_GRADE_BG: Record<string, string> = {
  A: 'from-emerald-500 to-emerald-600',
  B: 'from-teal-500 to-teal-600',
  C: 'from-yellow-500 to-amber-500',
  D: 'from-orange-500 to-orange-600',
  F: 'from-rose-500 to-red-600',
};

function GradeBadge({
  grade,
  score,
  label,
  title,
  palette,
  onClick,
}: {
  grade: string;
  score: number | null;
  label: string;
  title: string;
  palette: Record<string, string>;
  onClick?: () => void;
}) {
  return (
    <button
      type='button'
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={title}
      style={{ position: 'relative', zIndex: 100 }}
      aria-label={`${label} grade: ${grade}${score !== null ? `, score ${score.toFixed(0)} out of 100` : ''}`}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r ${palette[grade] || palette.C || palette.F || 'from-gray-500 to-gray-600'} text-white shadow-lg cursor-pointer hover:brightness-110 hover:scale-105 transition-all group`}>
      <span className='text-2xl font-black leading-none' aria-hidden='true'>
        {grade}
      </span>
      <div className='border-l border-white/30 pl-2 text-left'>
        <div className='text-[9px] uppercase tracking-widest opacity-80 flex items-center gap-1'>
          {label}
          <Info size={9} className='opacity-0 group-hover:opacity-100 transition-opacity' />
        </div>
        <div className='text-sm font-bold leading-tight tabular-nums'>
          {score !== null ? score.toFixed(0) : '—'}
        </div>
      </div>
    </button>
  );
}

/* ═══════════ Health Score Methodology Modal ═══════════ */
const GRADE_THRESHOLDS = [
  { min: 85, grade: 'A', label: 'Excellent', color: 'bg-emerald-500' },
  { min: 70, grade: 'B+', label: 'Good', color: 'bg-green-500' },
  { min: 55, grade: 'B', label: 'Fair', color: 'bg-amber-500' },
  { min: 40, grade: 'B-', label: 'Needs Improvement', color: 'bg-orange-500' },
  { min: 0, grade: 'C', label: 'Poor', color: 'bg-red-500' },
];

function HealthScoreModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: CountyComprehensive;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const { financial_summary, budget, debt, audit, stalled_projects } = data;
  const utilization = budget.utilization_rate;
  const healthScore = financial_summary.health_score;
  const grade = financial_summary.grade;

  // Determine which threshold is active
  const activeThreshold =
    GRADE_THRESHOLDS.find((t) => healthScore >= t.min) ||
    GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];

  return (
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className='bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='bg-gradient-to-r from-gov-dark to-gov-forest px-6 py-5 rounded-t-2xl flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-bold text-white'>Financial Health Score</h2>
            <p className='text-sm text-white/70 mt-0.5'>{data.name} County</p>
          </div>
          <button
            onClick={onClose}
            className='text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10'>
            <X size={20} />
          </button>
        </div>

        <div className='px-6 py-5 space-y-6'>
          {/* Score display */}
          <div className='text-center'>
            <div className='inline-flex items-center gap-3 bg-gray-50 rounded-xl px-6 py-4'>
              <span
                className={`text-4xl font-black ${activeThreshold.color} text-white w-14 h-14 rounded-xl flex items-center justify-center`}>
                {grade}
              </span>
              <div className='text-left'>
                <div className='text-2xl font-bold text-gray-900'>
                  {healthScore.toFixed(1)}
                  <span className='text-sm text-gray-500 font-normal'> / 100</span>
                </div>
                <div className='text-sm text-gray-500'>{activeThreshold.label}</div>
              </div>
            </div>
          </div>

          {/* How it's calculated */}
          <div>
            <h3 className='text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3'>
              How It&apos;s Calculated
            </h3>
            <div className='bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700'>
              <p>
                The health score is derived from the county&apos;s{' '}
                <strong>budget execution rate</strong> &mdash; how much of the allocated budget was
                actually spent in the fiscal year.
              </p>
              <div className='border-l-2 border-gov-sage pl-3 space-y-1'>
                <p>
                  <strong>If utilization &le; 95%:</strong> Score = utilization percentage
                </p>
                <p>
                  <strong>If 95% &lt; utilization &le; 100%:</strong> Score = 90 (near-perfect
                  execution)
                </p>
                <p>
                  <strong>If utilization &gt; 100% (overspend):</strong> Score = 80 &minus;
                  overspend %, penalizing excess spending
                </p>
              </div>
              <p className='text-xs text-gray-500 italic'>
                A score of 95 is the maximum — counties that spend close to their budget without
                overspending demonstrate the best fiscal discipline.
              </p>
            </div>
          </div>

          {/* This county's breakdown */}
          <div>
            <h3 className='text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3'>
              This County&apos;s Numbers
            </h3>
            <div className='space-y-2'>
              {[
                { label: 'Budget Allocated', value: fmtKES(budget.total_allocated) },
                { label: 'Budget Spent', value: fmtKES(budget.total_spent) },
                {
                  label: 'Execution Rate',
                  value: `${utilization.toFixed(1)}%`,
                  highlight: true,
                },
                { label: 'Pending Bills', value: fmtKES(debt.pending_bills) },
                { label: 'Total Debt', value: fmtKES(debt.total_debt) },
                { label: 'Audit Issues', value: String(audit.findings_count) },
                { label: 'Stalled Projects', value: String(stalled_projects.count) },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                    row.highlight ? 'bg-gov-sage/10 font-semibold' : 'even:bg-gray-50'
                  }`}>
                  <span className='text-sm text-gray-600'>{row.label}</span>
                  <span className='text-sm text-gray-900 font-medium'>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grade scale */}
          <div>
            <h3 className='text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3'>
              Grade Scale
            </h3>
            <div className='space-y-1.5'>
              {GRADE_THRESHOLDS.map((t) => (
                <div
                  key={t.grade}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${
                    t.grade === grade ? 'bg-gray-100 ring-1 ring-gray-300 font-semibold' : ''
                  }`}>
                  <span
                    className={`${t.color} text-white font-bold w-8 h-8 rounded-lg flex items-center justify-center text-xs`}>
                    {t.grade}
                  </span>
                  <span className='text-gray-700 flex-1'>{t.label}</span>
                  <span className='text-gray-400 text-xs'>{t.min > 0 ? `≥ ${t.min}` : `< 40`}</span>
                  {t.grade === grade && (
                    <span className='text-xs bg-gov-forest text-white px-2 py-0.5 rounded-full'>
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Data source note */}
          <p className='text-xs text-gray-400 text-center'>
            Source: Office of the Auditor General &middot; County financial statements
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════ KPI Pill ═══════════ */
function KPI({
  label,
  value,
  sub,
  accent = 'text-gray-900',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <div className='text-[10px] uppercase tracking-wider text-gray-400 mb-0.5'>{label}</div>
      <div className={`text-base font-bold leading-tight ${accent}`}>{value}</div>
      {sub && <div className='text-[11px] text-gray-500'>{sub}</div>}
    </div>
  );
}

/* ═══════════ Circular progress ═══════════ */
function CircleProgress({
  value,
  size = 72,
  stroke = 5,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const color = value >= 70 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div
      className='relative inline-flex items-center justify-center'
      style={{ width: size, height: size }}>
      <svg width={size} height={size} className='-rotate-90'>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='#f3f4f6'
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap='round'
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className='transition-all duration-700'
        />
      </svg>
      <span className='absolute text-sm font-bold text-gray-800'>{value.toFixed(0)}%</span>
    </div>
  );
}

/* ═══════════ Summary Metric Card ═══════════ */
function SummaryMetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className='bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3'>
      <div
        className='w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0'
        style={{ backgroundColor: color ? `${color}15` : '#1a563210' }}>
        {icon}
      </div>
      <div className='min-w-0'>
        <div className='text-xs font-medium text-gray-500 uppercase tracking-wider'>{label}</div>
        <div className='text-lg font-bold text-gray-900 truncate'>{value}</div>
      </div>
    </div>
  );
}

/* ═══════════ Tab: Overview ═══════════ */
function OverviewTab({ data }: { data: CountyComprehensive }) {
  const {
    demographics,
    economic_profile,
    budget,
    debt,
    audit,
    stalled_projects,
    financial_summary,
    missing_funds,
    revenue,
  } = data;

  const sustainLabel: Record<string, { text: string; color: string; Icon: React.ElementType }> = {
    sustainable: { text: 'Sustainable', color: 'text-emerald-700', Icon: TrendingUp },
    moderate: { text: 'Moderate Risk', color: 'text-amber-700', Icon: Scale },
    at_risk: { text: 'At Risk', color: 'text-red-700', Icon: TrendingDown },
  };
  const sust = sustainLabel[financial_summary.debt_sustainability] ?? sustainLabel.moderate;

  const typeLabels: Record<string, string> = {
    capital_city: 'Capital City',
    standard_county: 'Standard County',
    major_urban: 'Major Urban',
    pastoral: 'Pastoral',
    arid_semi_arid: 'Arid / Semi-Arid',
  };

  // Summary card helpers
  const utilColor =
    budget.utilization_rate >= 70
      ? '#22c55e'
      : budget.utilization_rate >= 50
        ? '#f59e0b'
        : '#ef4444';
  const gradeColor: Record<string, string> = {
    A: '#22c55e',
    'B+': '#22c55e',
    B: '#f59e0b',
    'B-': '#f97316',
    C: '#ef4444',
  };

  return (
    <div className='space-y-6'>
      {/* Hero row: Budget execution as a magazine-style feature */}
      <div className='grid grid-cols-1 lg:grid-cols-5 gap-5'>
        {/* Budget execution — large, editorial */}
        <div className='lg:col-span-3 rounded-2xl bg-gradient-to-br from-white via-white to-gov-sage/5 border border-gray-100 p-6 shadow-sm'>
          <div className='flex items-start gap-6'>
            <CircleProgress value={budget.utilization_rate} />
            <div className='min-w-0 flex-1'>
              <div className='text-[11px] uppercase tracking-widest font-semibold text-gray-400 mb-1'>
                Budget Execution
              </div>
              <div className='text-2xl font-bold text-gray-900 mb-2'>
                {pct(budget.utilization_rate)}
                <span className='text-sm font-normal text-gray-500 ml-2'>utilized</span>
              </div>
              <div className='text-sm text-gray-600 leading-relaxed'>
                <span className='font-semibold tabular-nums'>
                  {fmtKES(budget.total_spent)}
                </span>{' '}
                spent of{' '}
                <span className='font-semibold tabular-nums'>
                  {fmtKES(budget.total_allocated)}
                </span>{' '}
                allocated
              </div>
              {budget.fiscal_year && (
                <div className='mt-2 text-[11px] text-gray-400'>
                  Source: Controller of Budget · {budget.fiscal_year}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Debt sustainability — minimal, gradient tinted */}
        <div
          className={`lg:col-span-2 rounded-2xl border p-6 shadow-sm ${
            financial_summary.debt_sustainability === 'sustainable'
              ? 'bg-gradient-to-br from-emerald-50/70 to-white border-emerald-100'
              : financial_summary.debt_sustainability === 'at_risk'
                ? 'bg-gradient-to-br from-rose-50/70 to-white border-rose-100'
                : 'bg-gradient-to-br from-amber-50/70 to-white border-amber-100'
          }`}>
          <div className='flex items-center gap-2 mb-3'>
            <sust.Icon size={18} className={sust.color} />
            <span className={`text-sm font-semibold ${sust.color}`}>
              {sust.text}
            </span>
          </div>
          <div className='text-[11px] uppercase tracking-widest font-semibold text-gray-400 mb-2'>
            Debt Position
          </div>
          <div className='space-y-1.5 text-sm'>
            <div className='flex justify-between'>
              <span className='text-gray-500'>Total debt</span>
              <span className='font-semibold text-gray-800 tabular-nums'>
                {fmtKES(debt.total_debt)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-500'>Debt-to-budget</span>
              <span className='font-semibold text-gray-800 tabular-nums'>
                {pct(debt.debt_to_budget_ratio)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-500'>Pending bills</span>
              <span className='font-semibold text-gray-800 tabular-nums'>
                {fmtKES(debt.pending_bills)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit snapshot — wide banner */}
      <div className='relative rounded-2xl bg-white border border-gray-100 p-5 overflow-hidden'>
        <div
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${
            audit.findings_count === 0
              ? 'bg-emerald-400'
              : (audit.by_severity.critical || 0) > 0
                ? 'bg-rose-500'
                : 'bg-amber-400'
          }`}
        />
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2'>
          <div>
            <div className='text-[11px] uppercase tracking-widest font-semibold text-gray-400 mb-1'>
              Audit Snapshot
            </div>
            <div className='flex items-center gap-4 flex-wrap'>
              {(['critical', 'warning', 'info'] as const).map((sev) => {
                const count = audit.by_severity[sev] || 0;
                const s = SEVERITY_STYLE[sev];
                return (
                  <div key={sev} className='flex items-center gap-1.5'>
                    <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className='text-sm text-gray-700'>
                      <span className='font-semibold tabular-nums'>{count}</span>{' '}
                      {s.label.toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {audit.total_amount_involved > 0 && (
            <div className='text-right'>
              <div className='text-xs text-gray-500'>Total amount involved</div>
              <div className='text-base font-bold text-rose-700 tabular-nums'>
                {fmtKES(audit.total_amount_involved)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Missing funds banner */}
      {(missing_funds.total_amount > 0 || missing_funds.cases_count > 0) && (
        <div className='bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4'>
          <div className='w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0'>
            <AlertTriangle size={20} className='text-red-600' />
          </div>
          <div>
            <div className='text-sm font-semibold text-red-900'>
              {fmtKES(missing_funds.total_amount)} Unaccounted
            </div>
            <div className='text-xs text-red-700'>
              {missing_funds.cases_count} cases identified by OAG
            </div>
          </div>
        </div>
      )}

      {/* About this county */}
      <div className='bg-white rounded-xl border border-gray-100 p-5'>
        <h3 className='text-sm font-semibold text-gray-800 mb-3'>County Profile</h3>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6'>
          <KPI
            label='Population'
            value={fmtPop(demographics.population)}
            sub={
              demographics.population_year ? `Census ${demographics.population_year}` : undefined
            }
            accent='text-blue-700'
          />
          <KPI label='Governor' value={data.governor || 'N/A'} accent='text-purple-700' />
          <KPI
            label='Economic Base'
            value={fmtLabel(economic_profile.economic_base)}
            accent='text-emerald-700'
          />
          <KPI
            label='Total Revenue'
            value={fmtKES(revenue.total_revenue)}
            sub={revenue.local_revenue > 0 ? `Local: ${fmtKES(revenue.local_revenue)}` : undefined}
            accent='text-green-700'
          />
        </div>

        {economic_profile.major_issues.length > 0 && (
          <div className='mt-4 pt-4 border-t border-gray-100'>
            <div className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
              Key Challenges
            </div>
            <div className='flex flex-wrap gap-2'>
              {economic_profile.major_issues.map((issue, i) => (
                <span
                  key={i}
                  className='text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-1'>
                  {issue}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stalled projects summary */}
      {stalled_projects.count > 0 && (
        <div className='bg-white rounded-xl border border-gray-100 p-5'>
          <div className='flex items-center gap-2 mb-2'>
            <HardHat size={16} className='text-red-600' />
            <h3 className='text-sm font-semibold text-gray-800'>
              {stalled_projects.count} Stalled Project{stalled_projects.count !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className='text-xs text-gray-500 mb-1'>
            Total contracted: {fmtKES(stalled_projects.total_contracted_value)} &middot; Paid:{' '}
            {fmtKES(stalled_projects.total_amount_paid)} (
            {pct(
              (stalled_projects.total_amount_paid /
                (stalled_projects.total_contracted_value || 1)) *
                100
            )}{' '}
            disbursed)
          </div>
          <p className='text-xs text-gray-400'>See the Projects tab for full details.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════ Tab: Budget & Debt ═══════════ */
function BudgetTab({ data }: { data: CountyComprehensive }) {
  const { budget, debt } = data;
  const { data: countyPendingBills } = useCountyPendingBills(data.id.toString());
  const [activeSector, setActiveSector] = useState<string | null>(null);

  const sectors = useMemo(
    () =>
      Object.entries(budget.sector_breakdown)
        .map(([name, vals], i) => ({
          name: name.length > 22 ? name.slice(0, 20) + '...' : name,
          fullName: name,
          allocated: vals.allocated,
          spent: vals.spent,
          fill: PALETTE[i % PALETTE.length],
        }))
        .sort((a, b) => b.allocated - a.allocated)
        .slice(0, 10),
    [budget.sector_breakdown]
  );

  const totalSectorAlloc = sectors.reduce((sum, s) => sum + s.allocated, 0);
  const totalSectorSpent = sectors.reduce((sum, s) => sum + s.spent, 0);
  const topSector = sectors[0];
  const active = activeSector
    ? sectors.find((s) => s.fullName === activeSector) || null
    : null;
  const displayed = active || topSector || null;
  const displayedPct = displayed && totalSectorAlloc > 0
    ? (displayed.allocated / totalSectorAlloc) * 100
    : 0;
  const displayedUtil = displayed && displayed.allocated > 0
    ? (displayed.spent / displayed.allocated) * 100
    : 0;
  const pieData = sectors.map((s) => ({
    name: s.name,
    fullName: s.fullName,
    value: s.allocated,
    fill: s.fill,
  }));

  return (
    <div className='space-y-5'>
      {/* Top-level budget stats */}
      <div className='bg-white rounded-xl border border-gray-100 p-5'>
        <h3 className='text-sm font-semibold text-gray-800 mb-4'>Budget Summary</h3>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6'>
          <KPI
            label='Total Allocated'
            value={fmtKES(budget.total_allocated)}
            accent='text-blue-700'
          />
          <KPI
            label='Total Spent'
            value={fmtKES(budget.total_spent)}
            sub={`${pct(budget.utilization_rate)} execution`}
            accent='text-emerald-700'
          />
          <KPI
            label='Development'
            value={budget.development_budget ? fmtKES(budget.development_budget) : 'Unavailable'}
            sub={budget.development_budget ? undefined : 'Not classified in source data'}
            accent='text-amber-700'
          />
          <KPI
            label='Recurrent'
            value={budget.recurrent_budget ? fmtKES(budget.recurrent_budget) : 'Unavailable'}
            sub={budget.recurrent_budget ? undefined : 'Not classified in source data'}
            accent='text-purple-700'
          />
        </div>
      </div>

      {/* Sector spending — editorial donut + ranked list */}
      {sectors.length > 0 && (
        <div className='relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-white via-white to-gov-sage/5'>
          {/* Ambient color wash from top sector */}
          <div
            aria-hidden
            className='absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20'
            style={{ backgroundColor: displayed?.fill || '#3b82f6' }}
          />

          {/* Header */}
          <div className='relative flex items-start justify-between gap-4 px-5 pt-5 pb-2'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <div className='h-5 w-1 rounded-full bg-gov-forest' />
                <h3 className='text-base font-semibold text-gray-900'>Sector Spending</h3>
              </div>
              <p className='text-xs text-gray-500 ml-3'>
                Top {sectors.length} sectors · hover to explore allocation vs. spend
              </p>
            </div>
            <div className='hidden sm:flex items-center gap-3 text-[11px] text-gray-500'>
              <div className='flex items-center gap-1.5'>
                <div className='w-2.5 h-2.5 rounded-sm bg-gray-200' />
                <span>Allocated</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2.5 h-2.5 rounded-sm bg-emerald-500' />
                <span>Spent</span>
              </div>
            </div>
          </div>

          <div className='relative grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 pb-5 pt-2'>
            {/* LEFT: interactive donut with live center label (5/12) */}
            <div className='lg:col-span-5'>
              <div className='relative h-[320px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey='value'
                      nameKey='fullName'
                      cx='50%'
                      cy='50%'
                      outerRadius='90%'
                      innerRadius='62%'
                      paddingAngle={1.5}
                      strokeWidth={0}
                      onMouseEnter={(e) => setActiveSector(e?.fullName || null)}
                      onMouseLeave={() => setActiveSector(null)}>
                      {pieData.map((e, i) => (
                        <Cell
                          key={i}
                          fill={e.fill}
                          opacity={
                            activeSector && activeSector !== e.fullName ? 0.35 : 1
                          }
                          style={{ transition: 'opacity 200ms ease-out', cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center label — swaps between total + hovered sector */}
                <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center'>
                  {active ? (
                    <>
                      <div
                        className='w-2 h-2 rounded-full mb-2'
                        style={{ backgroundColor: active.fill }}
                      />
                      <div className='text-[10px] uppercase tracking-widest font-semibold text-gray-400 px-4 leading-tight'>
                        {active.fullName}
                      </div>
                      <div className='text-lg font-bold tabular-nums text-gray-900 mt-1'>
                        {fmtKES(active.allocated)}
                      </div>
                      <div className='text-[11px] text-gray-500 tabular-nums mt-0.5'>
                        {displayedPct.toFixed(1)}% of top 10
                      </div>
                      <div className='mt-2 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100'>
                        <span className='text-[10px] font-semibold text-emerald-700 tabular-nums'>
                          {displayedUtil.toFixed(0)}% executed
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='text-[10px] uppercase tracking-widest font-semibold text-gray-400'>
                        Top 10 Sectors
                      </div>
                      <div className='text-2xl font-bold tabular-nums text-gray-900 mt-1'>
                        {fmtKES(totalSectorAlloc)}
                      </div>
                      <div className='text-[11px] text-gray-500 mt-0.5'>allocated</div>
                      <div className='mt-2 flex items-baseline gap-1'>
                        <span className='text-sm font-bold text-emerald-700 tabular-nums'>
                          {fmtKES(totalSectorSpent)}
                        </span>
                        <span className='text-[10px] text-gray-400'>spent</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: ranked sector cards with allocation + utilization (7/12) */}
            <div className='lg:col-span-7 space-y-1.5'>
              {sectors.map((s, idx) => {
                const pctOfTotal =
                  totalSectorAlloc > 0 ? (s.allocated / totalSectorAlloc) * 100 : 0;
                const utilization = s.allocated > 0 ? (s.spent / s.allocated) * 100 : 0;
                const isActive = activeSector === s.fullName;
                const utilColor =
                  utilization >= 85
                    ? 'text-emerald-700'
                    : utilization >= 60
                      ? 'text-teal-700'
                      : utilization >= 30
                        ? 'text-amber-700'
                        : 'text-rose-700';
                return (
                  <button
                    key={s.fullName}
                    type='button'
                    onMouseEnter={() => setActiveSector(s.fullName)}
                    onMouseLeave={() => setActiveSector(null)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${
                      isActive
                        ? 'border-gray-200 bg-white shadow-sm'
                        : 'border-transparent hover:bg-white/60'
                    }`}>
                    <div className='flex items-center gap-3'>
                      {/* Rank */}
                      <div className='text-[10px] font-bold text-gray-400 tabular-nums w-4 flex-shrink-0'>
                        {(idx + 1).toString().padStart(2, '0')}
                      </div>
                      {/* Color dot */}
                      <div
                        className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                        style={{ backgroundColor: s.fill }}
                      />
                      {/* Name */}
                      <div className='flex-1 min-w-0'>
                        <div className='text-sm font-semibold text-gray-800 truncate'>
                          {s.fullName}
                        </div>
                      </div>
                      {/* Allocation */}
                      <div className='text-right flex-shrink-0'>
                        <div className='text-sm font-bold text-gray-900 tabular-nums'>
                          {fmtKES(s.allocated)}
                        </div>
                        <div className='text-[10px] text-gray-400 tabular-nums'>
                          {pctOfTotal.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Layered progress bar: allocated track + spent fill */}
                    <div className='mt-2 ml-11'>
                      <div className='relative h-1.5 bg-gray-100 rounded-full overflow-hidden'>
                        <div
                          className='absolute inset-y-0 left-0 rounded-full'
                          style={{
                            width: `${Math.min(utilization, 100)}%`,
                            backgroundColor: s.fill,
                            transition: 'width 400ms ease-out',
                          }}
                        />
                      </div>
                      <div className='flex items-center justify-between mt-1'>
                        <span className='text-[10px] text-gray-500 tabular-nums'>
                          <span className={`font-semibold ${utilColor}`}>
                            {utilization.toFixed(0)}%
                          </span>{' '}
                          executed
                        </span>
                        <span className='text-[10px] text-gray-400 tabular-nums'>
                          {fmtKES(s.spent)} spent
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Debt breakdown */}
      {debt.breakdown.length > 0 && (
        <div className='bg-white rounded-xl border border-gray-100 p-5'>
          <h3 className='text-sm font-semibold text-gray-800 mb-4'>Debt Breakdown</h3>
          <div className='space-y-3'>
            {debt.breakdown.map((d, i) => {
              const pctOfTotal = debt.total_debt > 0 ? (d.outstanding / debt.total_debt) * 100 : 0;
              return (
                <div key={i}>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-sm text-gray-700'>{d.lender}</span>
                    <span className='text-sm font-semibold text-gray-900 tabular-nums'>
                      {fmtKES(d.outstanding)}
                    </span>
                  </div>
                  <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
                    <div
                      className='h-full rounded-full bg-red-400'
                      style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                    />
                  </div>
                  <div className='text-[10px] text-gray-400 mt-0.5'>
                    {pct(pctOfTotal)} of total debt
                  </div>
                </div>
              );
            })}
          </div>
          <div className='mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-sm'>
            <span className='text-gray-500'>Total Debt</span>
            <span className='font-bold text-red-700'>{fmtKES(debt.total_debt)}</span>
          </div>
        </div>
      )}

      {/* County Pending Bills Breakdown */}
      {(countyPendingBills || debt.pending_bills > 0) && (
        <div className='bg-white rounded-xl border border-red-200 p-5'>
          <div className='flex items-center gap-2 mb-4'>
            <FileWarning size={16} className='text-red-600' />
            <h3 className='text-sm font-semibold text-gray-800'>Pending Bills</h3>
            <span className='text-sm font-bold text-red-700 ml-auto'>
              {fmtKES(countyPendingBills?.total_pending || debt.pending_bills)}
            </span>
          </div>

          {/* Breakdown by type */}
          {countyPendingBills?.breakdown_by_type &&
            countyPendingBills.breakdown_by_type.length > 0 && (
              <div className='space-y-2 mb-4'>
                <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                  By Type
                </h4>
                {countyPendingBills.breakdown_by_type.map((t) => {
                  const colors: Record<string, string> = {
                    supplier_arrears: 'bg-red-500',
                    salary: 'bg-blue-500',
                    pension: 'bg-purple-500',
                    statutory: 'bg-amber-500',
                    court_awards: 'bg-orange-500',
                  };
                  const bgColor =
                    Object.entries(colors).find(([k]) => t.type.toLowerCase().includes(k))?.[1] ||
                    'bg-gray-400';
                  return (
                    <div key={t.type}>
                      <div className='flex items-center justify-between mb-0.5'>
                        <span className='text-xs text-gray-700'>
                          {t.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className='text-xs font-semibold text-gray-800'>
                          {fmtKES(t.amount)}
                        </span>
                      </div>
                      <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
                        <div
                          className={`h-full rounded-full ${bgColor}`}
                          style={{ width: `${Math.min(t.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* Aging buckets */}
          {countyPendingBills?.aging_buckets && countyPendingBills.aging_buckets.length > 0 && (
            <div>
              <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
                Aging
              </h4>
              <div className='flex h-4 rounded-full overflow-hidden'>
                {countyPendingBills.aging_buckets.map((bucket) => {
                  const colors: Record<string, string> = {
                    '0-30d': '#22c55e',
                    '31-90d': '#f59e0b',
                    '91-180d': '#f97316',
                    '180d+': '#ef4444',
                  };
                  return (
                    <div
                      key={bucket.bucket}
                      className='transition-all'
                      style={{
                        width: `${bucket.percentage}%`,
                        backgroundColor: colors[bucket.bucket] || '#94a3b8',
                      }}
                      title={`${bucket.bucket}: ${fmtKES(bucket.amount)} (${bucket.percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              <div className='flex items-center gap-3 mt-2 text-[10px] text-gray-400 flex-wrap'>
                {countyPendingBills.aging_buckets.map((bucket) => {
                  const colors: Record<string, string> = {
                    '0-30d': '#22c55e',
                    '31-90d': '#f59e0b',
                    '91-180d': '#f97316',
                    '180d+': '#ef4444',
                  };
                  return (
                    <div key={bucket.bucket} className='flex items-center gap-1'>
                      <div
                        className='w-2 h-2 rounded-full'
                        style={{ backgroundColor: colors[bucket.bucket] || '#94a3b8' }}
                      />
                      <span>
                        {bucket.bucket}: {fmtKES(bucket.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!countyPendingBills && debt.pending_bills > 0 && (
            <p className='text-xs text-gray-500'>
              This county has {fmtKES(debt.pending_bills)} in pending bills. Detailed breakdown data
              will be available once the county reports are processed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════ Tab: Audit ═══════════ */

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> =
  {
    'Financial Irregularity': {
      label: 'Financial Irregularity',
      color: 'text-red-700',
      bg: 'bg-red-50 border-red-200',
      icon: '💰',
    },
    'Asset Management': {
      label: 'Asset Management',
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
      icon: '🏗️',
    },
    'Missing Funds': {
      label: 'Missing / Unaccounted Funds',
      color: 'text-red-800',
      bg: 'bg-red-100 border-red-300',
      icon: '🚨',
    },
    'Procurement Issues': {
      label: 'Procurement Issues',
      color: 'text-orange-700',
      bg: 'bg-orange-50 border-orange-200',
      icon: '📋',
    },
    'Payroll Issues': {
      label: 'Payroll Issues',
      color: 'text-purple-700',
      bg: 'bg-purple-50 border-purple-200',
      icon: '👥',
    },
    'Revenue Collection': {
      label: 'Revenue Collection',
      color: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-200',
      icon: '🏦',
    },
    other: { label: 'Other', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '📄' },
  };

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'Under Review': {
    label: 'Under Review',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    dot: 'bg-yellow-500',
  },
  Escalated: {
    label: 'Escalated',
    color: 'text-red-700 bg-red-50 border-red-200',
    dot: 'bg-red-500',
  },
  Resolved: {
    label: 'Resolved',
    color: 'text-green-700 bg-green-50 border-green-200',
    dot: 'bg-green-500',
  },
  Pending: {
    label: 'Pending',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    dot: 'bg-gray-400',
  },
  open: {
    label: 'Open',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    dot: 'bg-yellow-500',
  },
};

function AuditTab({ data }: { data: CountyComprehensive }) {
  const { audit, missing_funds } = data;
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Group findings by category for the summary
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const f of audit.findings) {
      const cat = f.category || 'other';
      if (!map[cat]) map[cat] = { count: 0, amount: 0 };
      map[cat].count++;
      map[cat].amount += f.amount_involved || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [audit.findings]);

  const filteredFindings = useMemo(() => {
    if (filterCategory === 'all') return audit.findings;
    return audit.findings.filter((f) => (f.category || 'other') === filterCategory);
  }, [audit.findings, filterCategory]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of audit.findings) {
      const st = f.status || 'open';
      map[st] = (map[st] || 0) + 1;
    }
    return map;
  }, [audit.findings]);

  return (
    <div className='space-y-5'>
      {/* ── What this means (plain language intro) ── */}
      <div className='bg-gov-forest/5 border border-gov-forest/20 rounded-xl p-4'>
        <h3 className='text-sm font-semibold text-gov-dark mb-1'>What are audit findings?</h3>
        <p className='text-xs text-gray-600 leading-relaxed'>
          The Office of the Auditor-General examines how your county government spends public money.
          When they find problems — like missing funds, irregular spending, or poor record-keeping —
          they report them as &quot;audit findings.&quot; Each finding below shows{' '}
          <strong>what went wrong</strong>, <strong>how much money is involved</strong>, and the{' '}
          <strong>current status</strong> of the issue.
        </p>
      </div>

      {/* ── Top-level stats ── */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <div className='bg-white rounded-xl border border-gray-100 p-4 text-center'>
          <div className='text-2xl font-bold text-gray-900'>{audit.findings_count}</div>
          <div className='text-[11px] text-gray-500 mt-0.5'>Total Findings</div>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 p-4 text-center'>
          <div className='text-2xl font-bold text-red-700'>
            {audit.total_amount_involved > 0 ? fmtKES(audit.total_amount_involved) : 'KES 0'}
          </div>
          <div className='text-[11px] text-gray-500 mt-0.5'>Total Money Questioned</div>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 p-4 text-center'>
          <div className='flex items-center justify-center gap-1.5'>
            <div className='w-2 h-2 rounded-full bg-red-500' />
            <span className='text-2xl font-bold text-gray-900'>
              {audit.by_severity.critical || 0}
            </span>
          </div>
          <div className='text-[11px] text-gray-500 mt-0.5'>Critical Issues</div>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 p-4 text-center'>
          <div className='text-2xl font-bold text-green-700'>{statusCounts['Resolved'] || 0}</div>
          <div className='text-[11px] text-gray-500 mt-0.5'>Resolved</div>
        </div>
      </div>

      {/* ── Category breakdown ── */}
      {categoryBreakdown.length > 0 && (
        <div className='bg-white rounded-xl border border-gray-100 p-5'>
          <h3 className='text-sm font-semibold text-gray-800 mb-3'>Findings by Category</h3>
          <div className='space-y-2'>
            {categoryBreakdown.map(([cat, { count, amount }]) => {
              const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
              const pctOfTotal =
                audit.total_amount_involved > 0 ? (amount / audit.total_amount_involved) * 100 : 0;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    filterCategory === cat
                      ? 'ring-2 ring-gov-forest/30 border-gov-forest/40 bg-gov-forest/5'
                      : 'hover:bg-gray-50 border-gray-100'
                  }`}>
                  <div className='flex items-center justify-between mb-1'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm'>{cfg.icon}</span>
                      <span className='text-sm font-medium text-gray-800'>{cfg.label}</span>
                      <span className='text-xs text-gray-400'>
                        {count} finding{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {amount > 0 && (
                      <span className={`text-sm font-semibold ${cfg.color}`}>{fmtKES(amount)}</span>
                    )}
                  </div>
                  {pctOfTotal > 0 && (
                    <div className='h-1.5 bg-gray-100 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-red-400 rounded-full transition-all'
                        style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {filterCategory !== 'all' && (
            <button
              onClick={() => setFilterCategory('all')}
              className='mt-2 text-xs text-gov-forest hover:underline'>
              ← Show all categories
            </button>
          )}
        </div>
      )}

      {/* ── Status summary row ── */}
      <div className='flex flex-wrap gap-2'>
        {Object.entries(statusCounts).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
          return (
            <div
              key={status}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${cfg.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}: {count}
            </div>
          );
        })}
      </div>

      {/* ── Missing funds alert ── */}
      {(missing_funds.total_amount > 0 || missing_funds.cases_count > 0) && (
        <div className='bg-red-50 border border-red-200 rounded-xl p-4'>
          <div className='flex items-center gap-2 mb-1'>
            <AlertTriangle size={16} className='text-red-600' />
            <span className='text-sm font-semibold text-red-900'>
              {fmtKES(missing_funds.total_amount)} Missing / Unaccounted
            </span>
          </div>
          <div className='text-xs text-red-700'>
            {missing_funds.cases_count} case(s) flagged by the Auditor-General as money that cannot
            be accounted for.
          </div>
        </div>
      )}

      {/* ── Findings list ── */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-gray-800'>
            {filterCategory === 'all'
              ? 'All Audit Findings'
              : `${(CATEGORY_CONFIG[filterCategory] || CATEGORY_CONFIG.other).label} Findings`}
          </h3>
          <span className='text-xs text-gray-400'>
            {filteredFindings.length} finding{filteredFindings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredFindings.slice(0, 20).map((f) => {
          const s = SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.info;
          const catCfg = CATEGORY_CONFIG[f.category] || CATEGORY_CONFIG.other;
          const stCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.open;
          const open = expanded === f.id;

          return (
            <div
              key={f.id}
              className={`rounded-xl border border-gray-100 bg-white overflow-hidden transition-shadow ${
                open ? 'shadow-md ring-1 ring-gray-200' : 'hover:shadow-sm'
              }`}>
              <button
                onClick={() => setExpanded(open ? null : f.id)}
                className='w-full text-left px-4 py-3.5 hover:bg-gray-50/50 transition-colors'>
                {/* Top row: category tag + status + amount */}
                <div className='flex items-center gap-2 flex-wrap mb-2'>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catCfg.bg} ${catCfg.color}`}>
                    {catCfg.icon} {catCfg.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${stCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                    {stCfg.label}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>
                    {s.label}
                  </span>
                  {f.audit_year && (
                    <span className='text-[10px] text-gray-400 ml-auto'>FY {f.audit_year}</span>
                  )}
                </div>

                {/* Finding text */}
                <p className='text-sm text-gray-800 leading-relaxed mb-1.5'>{f.finding}</p>

                {/* Bottom row: amount + reference + expand arrow */}
                <div className='flex items-center gap-3'>
                  {f.amount_involved > 0 && (
                    <span className='text-sm font-bold text-red-700 tabular-nums'>
                      {fmtKES(f.amount_involved)}
                    </span>
                  )}
                  {f.reference && (
                    <span className='text-[10px] text-gray-400 font-mono'>Ref: {f.reference}</span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className='overflow-hidden'>
                    <div className='px-4 pb-4 pt-0 border-t border-gray-100'>
                      {/* What this means section */}
                      <div className='mt-3 mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3'>
                        <h4 className='text-xs font-semibold text-blue-800 mb-1'>
                          What does this mean?
                        </h4>
                        <p className='text-xs text-blue-700 leading-relaxed'>
                          {f.category === 'Missing Funds' &&
                            `The auditors found KES ${f.amount_involved > 0 ? f.amount_involved.toLocaleString() : 'an undisclosed amount'} that the county government cannot explain where it went. This money was meant for public services.`}
                          {f.category === 'Financial Irregularity' &&
                            `The county spent KES ${f.amount_involved > 0 ? f.amount_involved.toLocaleString() : 'an amount'} without proper documentation or following financial rules. This makes it impossible to verify the money was used correctly.`}
                          {f.category === 'Asset Management' &&
                            `County assets worth KES ${f.amount_involved > 0 ? f.amount_involved.toLocaleString() : 'an undisclosed value'} are not being properly tracked, insured, or maintained — putting public property at risk.`}
                          {f.category === 'Procurement Issues' &&
                            `KES ${f.amount_involved > 0 ? f.amount_involved.toLocaleString() : 'Funds'} were spent on purchases that didn't follow proper procurement rules — potentially meaning taxpayers didn't get value for money.`}
                          {f.category === 'Payroll Issues' &&
                            `There are irregularities in how county staff are paid, involving KES ${f.amount_involved > 0 ? f.amount_involved.toLocaleString() : 'undisclosed amounts'}. This could mean ghost workers or unauthorized payments.`}
                          {![
                            'Missing Funds',
                            'Financial Irregularity',
                            'Asset Management',
                            'Procurement Issues',
                            'Payroll Issues',
                          ].includes(f.category || '') &&
                            `The auditors flagged an issue with how public money was managed${f.amount_involved > 0 ? `, involving KES ${f.amount_involved.toLocaleString()}` : ''}. This requires attention to ensure taxpayer money is protected.`}
                        </p>
                      </div>

                      {/* Recommendation */}
                      {f.recommendation && (
                        <div className='bg-green-50 border border-green-100 rounded-lg p-3'>
                          <h4 className='text-xs font-semibold text-green-800 mb-1'>
                            <CheckCircle2 size={12} className='inline mr-1' />
                            Auditor&apos;s Recommendation
                          </h4>
                          <p className='text-xs text-green-700 leading-relaxed'>
                            {f.recommendation}
                          </p>
                        </div>
                      )}

                      {/* Status explanation */}
                      <div className='mt-2 text-[11px] text-gray-500'>
                        {f.status === 'Resolved' &&
                          '✅ This issue has been addressed by the county government.'}
                        {f.status === 'Escalated' &&
                          '⚠️ This issue has been escalated for further investigation or action.'}
                        {f.status === 'Under Review' &&
                          '🔍 This issue is currently being reviewed by the relevant authorities.'}
                        {f.status === 'Pending' &&
                          '⏳ This issue is awaiting action from the county government.'}
                        {!['Resolved', 'Escalated', 'Under Review', 'Pending'].includes(
                          f.status || ''
                        ) && '📋 Status of this issue is being tracked.'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {filteredFindings.length > 20 && (
        <p className='text-xs text-gray-500 text-center'>
          Showing 20 of {filteredFindings.length} findings
        </p>
      )}
    </div>
  );
}

/* ═══════════ Tab: Projects ═══════════ */
function ProjectsTab({ data }: { data: CountyComprehensive }) {
  const { stalled_projects } = data;

  if (stalled_projects.count === 0) {
    return (
      <div className='bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center'>
        <CheckCircle2 size={32} className='mx-auto text-emerald-500 mb-2' />
        <p className='text-sm text-emerald-800 font-medium'>
          No stalled or significantly delayed projects
        </p>
        <p className='text-xs text-emerald-600 mt-1'>
          All audited development projects are progressing within acceptable parameters.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Summary */}
      <div className='bg-white rounded-xl border border-gray-100 p-5'>
        <div className='grid grid-cols-3 gap-4'>
          <KPI
            label='Stalled / Delayed'
            value={String(stalled_projects.count)}
            accent='text-red-700'
          />
          <KPI
            label='Contracted Value'
            value={fmtKES(stalled_projects.total_contracted_value)}
            accent='text-blue-700'
          />
          <KPI
            label='Already Paid'
            value={fmtKES(stalled_projects.total_amount_paid)}
            sub={`${pct((stalled_projects.total_amount_paid / (stalled_projects.total_contracted_value || 1)) * 100)} disbursed`}
            accent='text-amber-700'
          />
        </div>
      </div>

      {/* Project cards */}
      {stalled_projects.projects.map((p, i) => (
        <div key={i} className='bg-white rounded-xl border border-gray-100 p-5'>
          <div className='flex items-start justify-between gap-3 mb-3'>
            <div className='min-w-0'>
              <h4 className='text-sm font-semibold text-gray-900'>{p.project_name}</h4>
              <div className='flex items-center gap-2 mt-0.5 flex-wrap'>
                <span className='text-xs text-gray-500'>{p.sector}</span>
                {p.oag_reference && (
                  <span className='text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5'>
                    {p.oag_reference}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0 ${
                p.status === 'stalled'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
              {p.status === 'stalled' ? 'Stalled' : 'Delayed'}
            </span>
          </div>

          {/* Progress */}
          <div className='mb-3'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-xs text-gray-500'>{p.completion_pct}% complete</span>
              <span className='text-xs text-gray-500 tabular-nums'>
                {fmtKES(p.amount_paid)} / {fmtKES(p.contracted_amount)}
              </span>
            </div>
            <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
              <div
                className={`h-full rounded-full transition-all ${
                  p.status === 'stalled' ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ width: `${p.completion_pct}%` }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className='flex items-center gap-4 text-xs text-gray-500 flex-wrap'>
            <span className='flex items-center gap-1'>
              <Clock size={11} />
              Started {p.start_year}
            </span>
            <span className='flex items-center gap-1'>
              <Clock size={11} />
              Expected {p.expected_completion}
            </span>
          </div>
          {p.reason && (
            <p className='text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-100 italic'>
              {p.reason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════ Accountability Grade Colors ═══════════ */
const ACCT_GRADE_STYLE: Record<
  string,
  { bg: string; text: string; border: string; label: string; glow: string }
> = {
  A: {
    bg: 'bg-emerald-500',
    text: 'text-white',
    border: 'border-emerald-600',
    label: 'Excellent',
    glow: 'bg-emerald-300',
  },
  B: {
    bg: 'bg-teal-500',
    text: 'text-white',
    border: 'border-teal-600',
    label: 'Good',
    glow: 'bg-teal-300',
  },
  C: {
    bg: 'bg-yellow-400',
    text: 'text-yellow-900',
    border: 'border-yellow-500',
    label: 'Fair',
    glow: 'bg-yellow-300',
  },
  D: {
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
    label: 'Needs Improvement',
    glow: 'bg-orange-300',
  },
  F: {
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-700',
    label: 'Poor',
    glow: 'bg-rose-300',
  },
};

const IMPACT_STYLE: Record<
  string,
  { chip: string; dot: string; label: string }
> = {
  positive: {
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Positive',
  },
  minor: {
    chip: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500',
    label: 'Minor',
  },
  moderate: {
    chip: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    label: 'Moderate',
  },
  major: {
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Major',
  },
};

const OPINION_COLOR: Record<string, string> = {
  Unqualified: 'bg-emerald-500 text-white',
  Qualified: 'bg-yellow-400 text-yellow-900',
  Adverse: 'bg-red-500 text-white',
  Disclaimer: 'bg-red-700 text-white',
};

/* ═══════════ Tab: Accountability ═══════════ */
function AccountabilityTab({ data: countyData }: { data: CountyComprehensive }) {
  const { data, isLoading, error } = useCountyAccountability(countyData.id);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-gov-forest' />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className='bg-red-50 border border-red-200 rounded-xl p-6 text-center'>
        <ShieldAlert size={28} className='mx-auto text-red-400 mb-2' />
        <p className='text-sm text-red-700'>Failed to load accountability data</p>
      </div>
    );
  }

  const gradeStyle = ACCT_GRADE_STYLE[data.accountability_grade] || ACCT_GRADE_STYLE.F;
  const peer = data.peer_comparison;
  const isBelowRegion = data.total_flagged_amount > peer.region_avg_flagged_amount;
  const isBelowBracket = data.total_flagged_amount > peer.population_bracket_avg;
  const score =
    typeof data.accountability_score === 'number' ? data.accountability_score : null;
  const factors = data.grade_factors || [];

  // Score arc — 0 to 100 maps to stroke-dashoffset on a circle
  const CIRC = 2 * Math.PI * 42; // r=42
  const scorePct = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const dashOffset = CIRC - (scorePct / 100) * CIRC;
  const arcColor =
    score === null
      ? '#9ca3af'
      : score >= 85
        ? '#10b981'
        : score >= 70
          ? '#14b8a6'
          : score >= 55
            ? '#eab308'
            : score >= 40
              ? '#f97316'
              : '#dc2626';

  return (
    <div className='space-y-6'>
      {/* A. GRADE — editorial hero with score ring */}
      <div className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gov-sage/5 border border-gray-100 p-6'>
        <div
          aria-hidden
          className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-30 ${gradeStyle.glow}`}
        />
        <div className='relative flex flex-col sm:flex-row items-center sm:items-start gap-6'>
          {/* Score ring with grade letter centered */}
          <div className='relative flex-shrink-0'>
            <svg width='112' height='112' viewBox='0 0 100 100' className='-rotate-90'>
              <circle
                cx='50'
                cy='50'
                r='42'
                fill='none'
                stroke='#f1f5f9'
                strokeWidth='8'
              />
              <circle
                cx='50'
                cy='50'
                r='42'
                fill='none'
                stroke={arcColor}
                strokeWidth='8'
                strokeLinecap='round'
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className='absolute inset-0 flex flex-col items-center justify-center'>
              <span
                className={`text-4xl font-black leading-none ${
                  score !== null && score >= 55 ? 'text-gray-800' : 'text-gray-800'
                }`}
                style={{ color: arcColor }}>
                {data.accountability_grade}
              </span>
              {score !== null && (
                <span className='text-[10px] font-semibold text-gray-500 tabular-nums mt-0.5'>
                  {score.toFixed(0)}/100
                </span>
              )}
            </div>
          </div>

          <div className='text-center sm:text-left flex-1'>
            <div className='text-[11px] uppercase tracking-widest font-semibold text-gray-400 mb-1'>
              Accountability Grade
            </div>
            <h3 className='text-2xl font-bold text-gray-900 mb-1'>{gradeStyle.label}</h3>
            <p className='text-sm text-gray-600 max-w-xl'>
              Scored out of 100 across five dimensions: audit opinions, finding volume &amp;
              severity, recurring issues, unresolved items, flagged spend, and absorption.
              Grade bands: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else F.
            </p>
          </div>
        </div>
      </div>

      {/* A2. HOW THIS GRADE WAS CALCULATED */}
      {factors.length > 0 && (
        <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
          <div className='px-5 pt-5 pb-3 flex items-center gap-2'>
            <div className='h-5 w-1 rounded-full bg-gov-forest' />
            <h3 className='text-base font-semibold text-gray-900'>
              How this grade was calculated
            </h3>
          </div>
          <div className='px-5 pb-3 text-[12px] text-gray-500'>
            Starting from 100, we subtract points for each risk factor. Mouse-over each row
            for the specific threshold triggered.
          </div>
          <div className='divide-y divide-gray-50'>
            {/* Score bar summary */}
            <div className='px-5 py-3'>
              <div className='flex items-center justify-between text-[11px] text-gray-500 mb-1.5'>
                <span className='font-semibold uppercase tracking-widest'>Score</span>
                <span className='tabular-nums font-semibold text-gray-800'>
                  {score !== null ? `${score.toFixed(1)} / 100` : '—'}
                </span>
              </div>
              <div className='relative h-2 bg-gray-100 rounded-full overflow-hidden'>
                <div
                  className='absolute inset-y-0 left-0 rounded-full'
                  style={{
                    width: `${scorePct}%`,
                    backgroundColor: arcColor,
                    transition: 'width 0.8s ease-out',
                  }}
                />
                {/* Grade band markers */}
                {[40, 55, 70, 85].map((threshold) => (
                  <div
                    key={threshold}
                    className='absolute inset-y-0 w-px bg-white/80'
                    style={{ left: `${threshold}%` }}
                  />
                ))}
              </div>
              <div className='flex justify-between text-[9px] text-gray-400 mt-1 tabular-nums'>
                <span>F</span>
                <span className='ml-[28%]'>D</span>
                <span className='ml-[10%]'>C</span>
                <span className='ml-[10%]'>B</span>
                <span className='ml-[10%]'>A</span>
              </div>
            </div>

            {factors.map((f, idx) => {
              const style = IMPACT_STYLE[f.impact] || IMPACT_STYLE.minor;
              const pts = typeof f.points === 'number' ? f.points : 0;
              return (
                <div
                  key={idx}
                  className='px-5 py-3 flex items-start gap-3 hover:bg-gray-50/60 transition-colors'>
                  <div
                    className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${style.dot}`}
                    aria-hidden
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between gap-2 mb-0.5'>
                      <span className='text-sm font-semibold text-gray-800'>
                        {f.label}
                      </span>
                      <span
                        className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md border ${
                          pts < 0
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : pts > 0
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-gray-600 bg-gray-50 border-gray-200'
                        }`}>
                        {pts > 0 ? `+${pts}` : pts} pt
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`inline-block text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded border ${style.chip}`}>
                        {style.label}
                      </span>
                      <span className='text-xs text-gray-500'>{f.detail}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {factors.length === 0 && (
              <div className='px-5 py-6 text-center text-sm text-gray-500'>
                No penalty factors triggered — clean accountability record.
              </div>
            )}
          </div>
          <div className='px-5 py-3 bg-gray-50/60 border-t border-gray-100 text-[11px] text-gray-500 flex items-start gap-2'>
            <Info size={12} className='mt-0.5 flex-shrink-0 text-gray-400' />
            <span>
              Penalties are derived from OAG audit records and COB budget implementation
              reports. &ldquo;Unresolved&rdquo; counts any finding not explicitly resolved,
              closed, dismissed, or settled — including items marked &ldquo;Under
              Review&rdquo; or &ldquo;Escalated&rdquo;.
            </span>
          </div>
        </div>
      )}

      {/* C. KEY METRICS — stat strip with colour accent */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {[
          {
            value:
              data.total_flagged_amount > 0 ? fmtKES(data.total_flagged_amount) : 'KES 0',
            label: 'Total Flagged',
            sub:
              typeof data.flagged_pct_of_budget === 'number' && data.flagged_pct_of_budget > 0
                ? `${data.flagged_pct_of_budget.toFixed(1)}% of budget`
                : undefined,
            Icon: FileWarning,
            tone: 'rose' as const,
          },
          {
            value: String(data.total_findings ?? 0),
            label: 'Audit Findings',
            sub:
              typeof data.critical_findings === 'number' &&
              typeof data.warning_findings === 'number'
                ? `${data.critical_findings} critical · ${data.warning_findings} warning`
                : undefined,
            Icon: AlertTriangle,
            tone: 'amber' as const,
          },
          {
            value: String(data.unresolved_findings_count),
            label: 'Unresolved',
            sub: `${data.recurring_findings_count} recurring`,
            Icon: Clock,
            tone: 'orange' as const,
          },
          {
            value:
              data.absorption_rate !== null
                ? `${(data.absorption_rate * 100).toFixed(1)}%`
                : 'N/A',
            label: 'Absorption Rate',
            sub: data.absorption_rate !== null ? 'Spent / allocated' : undefined,
            Icon: TrendingUp,
            tone: 'blue' as const,
          },
        ].map((m) => {
          const toneCls = {
            rose: 'border-l-rose-400 text-rose-700',
            amber: 'border-l-amber-400 text-amber-700',
            orange: 'border-l-orange-400 text-orange-700',
            blue: 'border-l-blue-400 text-blue-700',
          }[m.tone];
          return (
            <div
              key={m.label}
              className={`bg-white rounded-xl border border-gray-100 border-l-4 ${toneCls} p-4`}>
              <div className='flex items-center gap-2 mb-1'>
                <m.Icon size={14} />
                <div className='text-[10px] uppercase tracking-widest font-semibold text-gray-400'>
                  {m.label}
                </div>
              </div>
              <div className='text-xl font-bold tabular-nums text-gray-900'>{m.value}</div>
              {m.sub && <div className='text-[10px] text-gray-500 mt-0.5'>{m.sub}</div>}
            </div>
          );
        })}
      </div>

      {/* B. AUDIT OPINION HISTORY */}
      {data.audit_opinion_history.length > 0 && (
        <div className='bg-white rounded-xl border border-gray-100 p-5'>
          <h3 className='text-sm font-semibold text-gray-800 mb-4'>Audit Opinion History</h3>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='border-b border-gray-100'>
                  <th className='text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-2 px-3'>
                    Year
                  </th>
                  <th className='text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-2 px-3'>
                    Opinion
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.audit_opinion_history]
                  .sort((a, b) => b.year - a.year)
                  .map((entry) => {
                    const opinionCls = OPINION_COLOR[entry.opinion] || 'bg-gray-200 text-gray-700';
                    return (
                      <tr key={entry.year} className='border-b border-gray-50 last:border-0'>
                        <td className='py-2.5 px-3 text-sm text-gray-700 tabular-nums font-medium'>
                          FY {entry.year}/{(entry.year + 1).toString().slice(-2)}
                        </td>
                        <td className='py-2.5 px-3'>
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${opinionCls}`}>
                            {entry.opinion}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* D. PEER COMPARISON — side-by-side with better visual cues */}
      <div>
        <div className='flex items-center gap-2 mb-3'>
          <div className='h-5 w-1 rounded-full bg-gov-forest' />
          <h3 className='text-base font-semibold text-gray-900'>Peer Comparison</h3>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {/* vs Region */}
          <div
            className={`rounded-2xl border p-5 ${
              isBelowRegion
                ? 'bg-gradient-to-br from-rose-50/60 to-white border-rose-100'
                : 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-100'
            }`}>
            <div className='text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3'>
              vs{' '}
              {peer.region
                ? peer.region.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                : 'Region'}{' '}
              Average
            </div>
            <div className='flex items-center gap-2 mb-3'>
              {isBelowRegion ? (
                <ArrowUp size={20} className='text-rose-500' />
              ) : (
                <ArrowDown size={20} className='text-emerald-500' />
              )}
              <span
                className={`text-lg font-bold ${isBelowRegion ? 'text-rose-700' : 'text-emerald-700'}`}>
                {isBelowRegion ? 'Above' : 'Below'} peer average
              </span>
            </div>
            <div className='space-y-1 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-500'>This county</span>
                <span className='font-semibold text-gray-800 tabular-nums'>
                  {fmtKES(data.total_flagged_amount)}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-500'>Region avg</span>
                <span className='font-semibold text-gray-800 tabular-nums'>
                  {fmtKES(peer.region_avg_flagged_amount)}
                </span>
              </div>
              {peer.region_avg_grade && (
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Region avg grade</span>
                  <span className='font-semibold text-gray-800'>{peer.region_avg_grade}</span>
                </div>
              )}
            </div>
          </div>

          {/* vs Population Bracket */}
          <div
            className={`rounded-2xl border p-5 ${
              isBelowBracket
                ? 'bg-gradient-to-br from-rose-50/60 to-white border-rose-100'
                : 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-100'
            }`}>
            <div className='text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3'>
              vs {peer.population_bracket || 'Population Bracket'} Average
            </div>
            <div className='flex items-center gap-2 mb-3'>
              {isBelowBracket ? (
                <ArrowUp size={20} className='text-rose-500' />
              ) : (
                <ArrowDown size={20} className='text-emerald-500' />
              )}
              <span
                className={`text-lg font-bold ${isBelowBracket ? 'text-rose-700' : 'text-emerald-700'}`}>
                {isBelowBracket ? 'Above' : 'Below'} bracket average
              </span>
            </div>
            <div className='space-y-1 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-500'>This county</span>
                <span className='font-semibold text-gray-800 tabular-nums'>
                  {fmtKES(data.total_flagged_amount)}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-500'>Bracket avg</span>
                <span className='font-semibold text-gray-800 tabular-nums'>
                  {fmtKES(peer.population_bracket_avg)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className='text-[11px] text-gray-400 mt-3 italic'>
          Higher flagged amounts indicate more audit issues. Lower is better.
        </p>
      </div>
    </div>
  );
}

/* ═══════════ Tab: Follow the Money ═══════════ */
const DEFAULT_FISCAL_YEARS = generateFiscalYears();

function MoneyFlowTab({ data: countyData }: { data: CountyComprehensive }) {
  const [selectedYear, setSelectedYear] = useState(DEFAULT_FISCAL_YEARS[0]);
  const { data: fiscalYears } = useAvailableFiscalYears();
  const { data, isLoading } = useCountyMoneyFlow(countyData.id, selectedYear);

  const years = fiscalYears && fiscalYears.length > 0 ? fiscalYears : DEFAULT_FISCAL_YEARS;

  return (
    <div className='space-y-5'>
      {/* Section header — no nested card, just typography */}
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1'>
        <div>
          <div className='flex items-center gap-2 mb-1'>
            <div className='h-6 w-1 rounded-full bg-gov-forest' />
            <h3 className='text-base font-semibold text-gray-900'>
              Follow the Money · {countyData.name}
            </h3>
          </div>
          <p className='text-xs text-gray-500 ml-3'>
            Trace how public funds flow from allocation to expenditure · {selectedYear}
          </p>
        </div>
        <YearSelector value={selectedYear} onChange={setSelectedYear} years={years} />
      </div>

      {/* The visualization itself renders its own cards — no wrapper */}
      <FollowTheMoney data={data} isLoading={isLoading} />
    </div>
  );
}

/* ═══════════ Data Sources Footer ═══════════ */
function SourcesFooter({ data }: { data: CountyComprehensive }) {
  const sources = [
    {
      key: 'budget',
      label: 'Budget',
      url: 'https://cob.go.ke/publications/county-budget-implementation-review-reports/',
    },
    {
      key: 'audit',
      label: 'Audit',
      url: 'https://www.oagkenya.go.ke/county-government-audit-reports/',
    },
    { key: 'debt', label: 'Debt', url: 'https://www.treasury.go.ke/county-governments/' },
    { key: 'population', label: 'Population', url: 'https://www.knbs.or.ke/publications/' },
  ];

  return (
    <div className='flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-gray-100'>
      <span className='text-[10px] text-gray-400 uppercase tracking-wider font-semibold'>
        Sources:
      </span>
      {sources.map((s) => (
        <a
          key={s.key}
          href={s.url}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 text-[11px] text-gov-forest hover:underline'>
          {s.label}
          <ExternalLink size={9} />
        </a>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════ */
export default function CountyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const countyId = params.id as string;
  const { data, isLoading, error } = useCountyComprehensive(countyId);
  // Prefetch accountability so the hero can show the grade immediately
  const { data: acctData } = useCountyAccountability(countyId);

  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const validTabs: Tab[] = ['overview', 'money', 'budget', 'audit', 'accountability', 'projects'];
  const [tab, setTab] = useState<Tab>(validTabs.includes(initialTab) ? initialTab : 'overview');
  const [showHealthModal, setShowHealthModal] = useState(false);

  /* Loading */
  if (isLoading) {
    return (
      <PageShell title='County Details' subtitle='Loading county data...'>
        <div className='flex items-center justify-center py-24'>
          <div className='animate-spin rounded-full h-14 w-14 border-b-2 border-gov-forest' />
        </div>
      </PageShell>
    );
  }

  /* Error */
  if (error || !data) {
    const from = searchParams.get('from');
    const backHref = from === 'transparency' ? '/transparency' : '/counties';
    const backLabel =
      from === 'transparency' ? 'Back to Follow the Money' : 'Back to County Explorer';
    return (
      <PageShell title='County Details'>
        <div className='text-center py-16'>
          <ShieldAlert size={40} className='mx-auto text-red-400 mb-3' />
          <p className='text-red-600 mb-4'>Failed to load county data</p>
          <Link href={backHref} className='text-sm text-gov-forest hover:underline'>
            &larr; {backLabel}
          </Link>
        </div>
      </PageShell>
    );
  }

  /* Tab content */
  const TabContent = {
    overview: OverviewTab,
    money: MoneyFlowTab,
    budget: BudgetTab,
    audit: AuditTab,
    accountability: AccountabilityTab,
    projects: ProjectsTab,
  }[tab];

  const fromParam = searchParams.get('from');
  const topBackHref = fromParam === 'transparency' ? '/transparency' : '/counties';
  const topBackLabel = fromParam === 'transparency' ? 'Follow the Money' : 'All Counties';

  return (
    <>
      <PageShell title={`${data.name} County`} subtitle='County government transparency report'>
        {/* Back */}
        <Link
          href={topBackHref}
          className='inline-flex items-center gap-1.5 text-sm text-gov-forest hover:text-gov-dark transition-colors'>
          <ArrowLeft size={14} />
          {topBackLabel}
        </Link>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-gov-dark via-gov-forest to-gov-forest text-white shadow-lg'>
          {/* Decorative blurred blobs for depth */}
          <div
            aria-hidden
            className='pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl'
          />
          <div
            aria-hidden
            className='pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl'
          />

          <div className='relative px-6 pt-6 pb-5 flex flex-col lg:flex-row lg:items-start justify-between gap-6'>
            {/* Identity */}
            <div className='min-w-0'>
              <div className='flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60 mb-2'>
                <Landmark size={12} />
                County Government · Kenya
              </div>
              <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>
                {data.name} County
              </h1>
              <p className='text-sm text-white/75 mt-1.5 max-w-md'>
                {fmtPop(data.demographics.population)} residents ·{' '}
                {fmtLabel(data.economic_profile.economic_base)} economy
                {data.governor ? ` · Gov. ${data.governor}` : ''}
              </p>
              {data.budget.fiscal_year && (
                <div className='mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10'>
                  <Clock size={10} />
                  Financial data from {data.budget.fiscal_year}
                </div>
              )}
            </div>

            {/* Actions + Grades */}
            <div className='flex items-center gap-3 flex-shrink-0 flex-wrap justify-end'>
              <WatchButton itemType='county' itemId={countyId} label={`${data.name} County`} />
              <PDFExportButton
                compact
                documentTitle={`${data.name} County Report`}
                className='text-white/70 hover:text-white hover:bg-white/10'
              />
              <div className='flex items-center gap-2'>
                <GradeBadge
                  grade={data.financial_summary.grade}
                  score={data.financial_summary.health_score}
                  label='Health'
                  title='Financial health — budget execution, debt, pending bills. Click for methodology.'
                  palette={HEALTH_GRADE_BG}
                  onClick={() => setShowHealthModal(true)}
                />
                <GradeBadge
                  grade={acctData?.accountability_grade || '—'}
                  score={
                    typeof acctData?.accountability_score === 'number'
                      ? acctData.accountability_score
                      : null
                  }
                  label='Audit'
                  title='Accountability — audit findings, unresolved items, flagged spend. Click to view breakdown.'
                  palette={ACCT_GRADE_BG}
                  onClick={() => setTab('accountability')}
                />
              </div>
            </div>
          </div>

          {/* Quick KPIs — glassy strip */}
          <div className='relative grid grid-cols-3 sm:grid-cols-6 bg-black/15 backdrop-blur-sm border-t border-white/10'>
            {[
              { label: 'Budget', value: fmtKES(data.budget.total_allocated), accent: 'text-white' },
              {
                label: 'Execution',
                value: pct(data.budget.utilization_rate),
                accent:
                  data.budget.utilization_rate >= 70
                    ? 'text-emerald-300'
                    : data.budget.utilization_rate >= 40
                      ? 'text-amber-300'
                      : 'text-rose-300',
              },
              { label: 'Total Debt', value: fmtKES(data.debt.total_debt), accent: 'text-white' },
              {
                label: 'Pending Bills',
                value: fmtKES(data.debt.pending_bills),
                accent: 'text-white',
              },
              {
                label: 'Audit Issues',
                value: String(data.audit.findings_count),
                accent: data.audit.findings_count > 0 ? 'text-rose-300' : 'text-white',
              },
              {
                label: 'Stalled',
                value: String(data.stalled_projects.count),
                accent: data.stalled_projects.count > 0 ? 'text-amber-300' : 'text-white',
              },
            ].map((kpi, i, arr) => (
              <div
                key={kpi.label}
                className={`px-4 py-3.5 ${i < arr.length - 1 ? 'border-r border-white/10' : ''} text-center`}>
                <div className={`text-sm font-bold tabular-nums ${kpi.accent}`}>{kpi.value}</div>
                <div className='text-[10px] uppercase tracking-wider text-white/55 mt-0.5'>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tabs ── underline style, no nested box */}
        <div className='flex items-center gap-1 border-b border-gray-200 overflow-x-auto -mb-px'>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  active ? 'text-gov-forest' : 'text-gray-500 hover:text-gray-800'
                }`}>
                <t.icon size={14} className={active ? 'text-gov-forest' : 'text-gray-400'} />
                {t.label}
                {active && (
                  <motion.div
                    layoutId='county-tab-underline'
                    className='absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-gov-forest'
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}>
          <TabContent data={data} />
        </motion.div>

        {/* ── Sources ── */}
        <SourcesFooter data={data} />
      </PageShell>

      {/* ── Health Score Modal ── rendered outside PageShell to avoid stacking context */}
      <HealthScoreModal
        open={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        data={data}
      />
    </>
  );
}
