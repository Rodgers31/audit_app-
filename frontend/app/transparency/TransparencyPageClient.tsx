'use client';

/**
 * Follow the Money — narrative-first redesign.
 *
 * The page now mirrors the Budget and Debt pages:
 *   1. A small intro strip
 *   2. FiscalYearPicker drives the entire page
 *   3. MoneyFlowHero — the centrepiece waterfall (Allocated → Released →
 *      Spent → Flagged) with explicit gap callouts between stages
 *   4. KPI cards — allocated / unspent / flagged / national efficiency
 *   5. County comparison table (sortable, searchable)
 *   6. "What can you do" action cards
 *   7. Source reconciliation panel so every figure is traceable to an
 *      official CoB / OAG / CRA document for the chosen fiscal year
 */

import MoneyFlowHero from '@/components/transparency/MoneyFlowHero';
import MoneyFlowSourceReconciliation from '@/components/transparency/MoneyFlowSourceReconciliation';
import FiscalYearPicker from '@/components/budget/FiscalYearPicker';
import PageShell from '@/components/layout/PageShell';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { useAvailableFiscalYears } from '@/lib/react-query';
import { useAllCountiesMoneyFlow, useNationalMoneyFlow } from '@/lib/react-query/useMoneyFlow';
import { generateFiscalYears } from '@/lib/utils';
import { MoneyFlowData } from '@/types';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  ExternalLink,
  GraduationCap,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

/* ═══════════ Helpers ═══════════ */

function fmtKES(n: number | null | undefined): string {
  if (n == null || n === 0) return 'KES 0';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `KES ${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`;
  return `KES ${n.toLocaleString()}`;
}

function fundingImpact(amount: number): string {
  if (amount >= 5e9) return `${Math.floor(amount / 10e6)} schools`;
  if (amount >= 1e9) return `${Math.floor(amount / 3e6)} classrooms`;
  if (amount >= 100e6) return `${Math.floor(amount / 500e3)} boreholes`;
  if (amount >= 10e6) return `${Math.floor(amount / 2e6)} health posts`;
  return '';
}

/** Convert a raw "YYYY/YY" string into the shape FiscalYearPicker wants. */
function toPickerOptions(years: string[]): { fiscal_year: string; is_current?: boolean }[] {
  if (!years || years.length === 0) return [];
  const now = new Date();
  const startYr = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const currentLabel = `${startYr}/${String(startYr + 1).slice(-2)}`;
  return years.map((y) => ({ fiscal_year: y, is_current: y === currentLabel }));
}

const DEFAULT_FISCAL_YEARS = generateFiscalYears();

type SortKey = 'efficiency' | 'flagged' | 'gap' | 'name';
type SortDir = 'asc' | 'desc';

/* ═══════════ Animation Wrapper ═══════════ */

function Section({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className={className}>
      {children}
    </motion.div>
  );
}

/* ═══════════ County Row Type ═══════════ */

interface CountyFlowRow {
  county_id: string;
  county_name: string;
  efficiency_score: number | null;
  flagged_amount: number | null;
  total_gap: number;
  allocated: number | null;
  spent: number | null;
}

/* ═══════════ Mini Efficiency Bar ═══════════ */

function EfficiencyBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor =
    score >= 70 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className='flex items-center gap-2 min-w-[120px]'>
      <div className='flex-1 h-2 bg-gray-100 rounded-full overflow-hidden'>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(score, 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-10 text-right ${textColor}`}>
        {score.toFixed(0)}%
      </span>
    </div>
  );
}

/* ═══════════ Page ═══════════ */

export default function TransparencyPage() {
  const { data: fiscalYearsRaw } = useAvailableFiscalYears();
  const years = fiscalYearsRaw && fiscalYearsRaw.length > 0 ? fiscalYearsRaw : DEFAULT_FISCAL_YEARS;
  const pickerYears = useMemo(() => toPickerOptions(years), [years]);

  const defaultYear = pickerYears.find((y) => y.is_current)?.fiscal_year ?? years[0];
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [sortKey, setSortKey] = useState<SortKey>('efficiency');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: nationalFlow, isLoading: nationalLoading } = useNationalMoneyFlow(selectedYear);
  const { data: allCountyFlows, isLoading: allCountyFlowsLoading } =
    useAllCountiesMoneyFlow(selectedYear);

  /* ── Derived national insights ── */
  const insights = useMemo(() => {
    if (!nationalFlow?.stages) return null;
    const allocated = nationalFlow.stages.find((s) => s.stage === 'Allocated')?.amount ?? 0;
    const spent = nationalFlow.stages.find((s) => s.stage === 'Spent')?.amount ?? 0;
    const flagged = nationalFlow.stages.find((s) => s.stage === 'Flagged')?.amount ?? 0;
    const gap = (allocated ?? 0) - (spent ?? 0);
    const lostPct = allocated > 0 ? (gap / allocated) * 100 : 0;
    return {
      allocated: allocated ?? 0,
      spent: spent ?? 0,
      flagged: flagged ?? 0,
      gap,
      lostPct,
      efficiency: nationalFlow.efficiency_score,
    };
  }, [nationalFlow]);

  /* ── County rows ── */
  const countyRows: CountyFlowRow[] = useMemo(() => {
    if (!allCountyFlows || allCountyFlows.length === 0) return [];
    return allCountyFlows
      .map((flowData: MoneyFlowData) => {
        const flaggedStage = flowData.stages?.find((s) => s.stage === 'Flagged');
        const allocatedStage = flowData.stages?.find((s) => s.stage === 'Allocated');
        const spentStage = flowData.stages?.find((s) => s.stage === 'Spent');
        const totalGap = (flowData.stages || []).reduce(
          (sum, s) => sum + (s.gap_from_prev && s.gap_from_prev > 0 ? s.gap_from_prev : 0),
          0
        );
        return {
          county_id: String(flowData.county_id),
          county_name: (flowData.county_name || '').replace(' County', ''),
          efficiency_score: flowData.efficiency_score ?? null,
          flagged_amount: flaggedStage?.amount || null,
          total_gap: totalGap,
          allocated: allocatedStage?.amount || null,
          spent: spentStage?.amount || null,
        };
      })
      .filter((row) => {
        if (!searchQuery) return true;
        return row.county_name.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [allCountyFlows, searchQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...countyRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.county_name.localeCompare(b.county_name);
          break;
        case 'efficiency':
          cmp = (a.efficiency_score ?? 999) - (b.efficiency_score ?? 999);
          break;
        case 'flagged':
          cmp = (b.flagged_amount ?? 0) - (a.flagged_amount ?? 0);
          break;
        case 'gap':
          cmp = b.total_gap - a.total_gap;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [countyRows, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'name' ? 'asc' : 'asc');
      }
    },
    [sortKey]
  );

  const countiesWithData = countyRows.filter((r) => r.allocated != null).length;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className='py-3 pr-3 font-semibold text-gov-dark/60 text-xs uppercase tracking-wider cursor-pointer select-none group'
      onClick={() => toggleSort(field)}>
      <span className='inline-flex items-center gap-1'>
        {label}
        <ArrowUpDown
          size={11}
          className={`transition-colors ${
            sortKey === field ? 'text-gov-forest' : 'text-gray-300 group-hover:text-gray-400'
          }`}
        />
      </span>
    </th>
  );

  return (
    <PageShell
      title='Follow the Money'
      subtitle='Trace every shilling from the Treasury to citizens — and see where it leaks.'>
      {/* ═══ 1. Narrative intro ═══ */}
      <Section>
        <div className='max-w-3xl'>
          <p className='text-base text-gov-dark/70 leading-relaxed'>
            Every year, the Treasury allocates trillions of shillings to Kenya&apos;s 47
            counties. But how much actually reaches citizens? The waterfall below traces
            the journey — from <strong>allocation</strong> by the Commission on Revenue
            Allocation, to <strong>release</strong> by the Exchequer, to what counties
            actually <strong>spent</strong>, to the portion the Auditor General
            <strong> flagged</strong> as irregular.
          </p>
        </div>
      </Section>

      {/* ═══ 2. Fiscal year picker drives the page ═══ */}
      <Section delay={0.05}>
        <FiscalYearPicker
          years={pickerYears}
          selected={selectedYear}
          onSelect={setSelectedYear}
        />
      </Section>

      {/* ═══ 3. The waterfall hero ═══ */}
      <Section delay={0.08}>
        {nationalLoading ? (
          <div className='rounded-2xl bg-white border border-neutral-border/40 shadow-surface p-16 flex items-center justify-center'>
            <Loader2 className='w-6 h-6 animate-spin text-gov-sage' />
            <span className='ml-3 text-gov-dark/60 font-medium'>
              Loading money-flow waterfall…
            </span>
          </div>
        ) : (
          <MoneyFlowHero data={nationalFlow} />
        )}
      </Section>

      {/* ═══ 4. KPI cards ═══ */}
      {insights && insights.allocated > 0 && (
        <Section delay={0.12}>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <InsightCard
              label='Total allocated'
              value={fmtKES(insights.allocated)}
              sublabel={`47 counties · FY ${selectedYear.replace(/^FY\s*/, '')}`}
              accent='blue'
            />
            <InsightCard
              label='Gap to spend'
              value={fmtKES(insights.gap)}
              sublabel={`${insights.lostPct.toFixed(1)}% of allocation never reached programmes`}
              accent='amber'
            />
            <InsightCard
              label='Flagged by Auditor General'
              value={fmtKES(insights.flagged)}
              sublabel={
                insights.flagged > 0
                  ? `≈ ${fundingImpact(insights.flagged) || 'irregular expenditure'}`
                  : 'No flagged findings'
              }
              accent='red'
            />
            <InsightCard
              label='National efficiency'
              value={insights.efficiency != null ? `${insights.efficiency.toFixed(1)}%` : '—'}
              sublabel={
                insights.efficiency != null
                  ? insights.efficiency >= 70
                    ? 'Good — above target'
                    : insights.efficiency >= 50
                      ? 'Fair — needs improvement'
                      : 'Poor — significant waste'
                  : 'Execution data pending'
              }
              accent={
                insights.efficiency != null
                  ? insights.efficiency >= 70
                    ? 'green'
                    : insights.efficiency >= 50
                      ? 'amber'
                      : 'red'
                  : 'gray'
              }
            />
          </div>
        </Section>
      )}

      {/* ═══ 5. County comparison ═══ */}
      <Section delay={0.15}>
        <div className='space-y-4'>
          <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
            <div>
              <h2 className='font-display text-xl text-gov-dark'>County-by-county breakdown</h2>
              <p className='text-sm text-gov-dark/50'>
                {countiesWithData > 0
                  ? `${countiesWithData} of 47 counties have CoB + OAG data for FY ${selectedYear.replace(/^FY\s*/, '')}`
                  : 'Loading county data…'}
              </p>
            </div>
            <div className='relative'>
              <Search
                size={14}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'
              />
              <input
                type='text'
                placeholder='Search county…'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-gov-sage/30 focus:border-gov-sage w-60'
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            {[
              { key: 'efficiency' as SortKey, label: 'Least efficient' },
              { key: 'flagged' as SortKey, label: 'Most flagged' },
              { key: 'gap' as SortKey, label: 'Highest gap' },
              { key: 'name' as SortKey, label: 'A–Z' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => toggleSort(btn.key)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  sortKey === btn.key
                    ? 'bg-gov-forest text-white shadow-sm'
                    : 'bg-white/60 text-gov-dark/60 hover:bg-white border border-gray-200/60'
                }`}>
                {btn.label}
              </button>
            ))}
          </div>

          {allCountyFlowsLoading ? (
            <div className='flex items-center justify-center py-20'>
              <Loader2 className='w-6 h-6 animate-spin text-gov-sage' />
              <span className='ml-3 text-gov-dark/60 font-medium'>Loading county data…</span>
            </div>
          ) : (
            <ResponsiveTable>
              <div className='rounded-xl border border-gray-200/60 bg-white/60'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-gray-200 bg-gray-50/50 text-left'>
                      <th className='py-3 pl-4 pr-3 font-semibold text-gov-dark/60 text-xs uppercase tracking-wider w-8'>
                        #
                      </th>
                      <SortHeader label='County' field='name' />
                      <th className='py-3 pr-3 font-semibold text-gov-dark/60 text-xs uppercase tracking-wider text-right'>
                        Allocated
                      </th>
                      <th className='py-3 pr-3 font-semibold text-gov-dark/60 text-xs uppercase tracking-wider text-right'>
                        Spent
                      </th>
                      <SortHeader label='Efficiency' field='efficiency' />
                      <SortHeader label='Flagged' field='flagged' />
                      <SortHeader label='Gap' field='gap' />
                      <th className='py-3 pr-4 font-semibold text-gov-dark/60 text-xs uppercase tracking-wider hidden lg:table-cell'>
                        Impact
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => {
                      const impact = row.flagged_amount ? fundingImpact(row.flagged_amount) : '';
                      return (
                        <tr
                          key={row.county_id}
                          className={`border-b border-gray-100 hover:bg-gov-forest/[0.04] transition-colors ${
                            i % 2 === 0 ? 'bg-white/40' : 'bg-gray-50/30'
                          }`}>
                          <td className='py-3 pl-4 pr-3 text-gov-dark/30 font-mono text-xs'>
                            {i + 1}
                          </td>
                          <td className='py-3 pr-3'>
                            <Link
                              href={`/counties/${row.county_id}?tab=money`}
                              className='text-gov-forest font-medium hover:underline decoration-gov-sage/30 underline-offset-2'>
                              {row.county_name}
                            </Link>
                          </td>
                          <td className='py-3 pr-3 text-right font-mono text-xs text-gov-dark/70'>
                            {row.allocated != null ? fmtKES(row.allocated) : '—'}
                          </td>
                          <td className='py-3 pr-3 text-right font-mono text-xs text-gov-dark/70'>
                            {row.spent != null ? fmtKES(row.spent) : '—'}
                          </td>
                          <td className='py-3 pr-3'>
                            {row.efficiency_score != null ? (
                              <EfficiencyBar score={row.efficiency_score} />
                            ) : (
                              <span className='text-gray-300 text-xs'>—</span>
                            )}
                          </td>
                          <td className='py-3 pr-3 text-right'>
                            {row.flagged_amount != null && row.flagged_amount > 0 ? (
                              <span className='font-mono text-xs text-red-600 font-medium'>
                                {fmtKES(row.flagged_amount)}
                              </span>
                            ) : (
                              <span className='text-gray-300 text-xs'>—</span>
                            )}
                          </td>
                          <td className='py-3 pr-3 text-right'>
                            {row.total_gap > 0 ? (
                              <span className='font-mono text-xs text-amber-600'>
                                {fmtKES(row.total_gap)}
                              </span>
                            ) : (
                              <span className='text-gray-300 text-xs'>—</span>
                            )}
                          </td>
                          <td className='py-3 pr-4 hidden lg:table-cell'>
                            {impact && (
                              <span className='text-[11px] text-gov-dark/40 italic'>
                                ≈ {impact}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ResponsiveTable>
          )}

          {!allCountyFlowsLoading && sortedRows.length === 0 && (
            <div className='text-center py-12 text-gov-dark/40'>
              {searchQuery
                ? 'No counties match your search.'
                : 'No data available for this fiscal year.'}
            </div>
          )}
        </div>
      </Section>

      {/* ═══ 6. Source reconciliation ═══ */}
      <Section delay={0.18}>
        <MoneyFlowSourceReconciliation fiscalYear={selectedYear} />
      </Section>

      {/* ═══ 7. What can you do? ═══ */}
      <Section delay={0.22}>
        <div className='rounded-2xl bg-gradient-to-br from-gov-forest/5 to-gov-sage/5 border border-gov-forest/10 p-6 sm:p-8'>
          <h2 className='font-display text-xl text-gov-dark mb-2'>What can you do?</h2>
          <p className='text-sm text-gov-dark/60 mb-5 max-w-2xl'>
            Public-money transparency isn&apos;t just data — it&apos;s accountability.
            Here&apos;s how to turn these numbers into action.
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <ActionCard
              icon={<Users size={20} />}
              title='Explore your county'
              description='See how your county spends public money — budget, audit findings, and accountability grade.'
              href='/counties'
              linkText='County Explorer'
            />
            <ActionCard
              icon={<AlertTriangle size={20} />}
              title='Read the audit reports'
              description='The Office of the Auditor General publishes a full report for every county each year.'
              href='https://www.oagkenya.go.ke'
              linkText='OAG website'
              external
            />
            <ActionCard
              icon={<GraduationCap size={20} />}
              title='Learn how it works'
              description='Understand how public finance works in Kenya — budgets, audits, and devolution.'
              href='/learn'
              linkText='Learning Hub'
            />
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

/* ═══════════ Sub-Components ═══════════ */

function InsightCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: 'blue' | 'amber' | 'red' | 'green' | 'gray';
}) {
  const styles = {
    blue: 'bg-blue-50/80 border-blue-200/50 text-blue-900',
    amber: 'bg-amber-50/80 border-amber-200/50 text-amber-900',
    red: 'bg-red-50/80 border-red-200/50 text-red-900',
    green: 'bg-emerald-50/80 border-emerald-200/50 text-emerald-900',
    gray: 'bg-gray-50/80 border-gray-200/50 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${styles[accent]}`}>
      <div className='text-[11px] font-semibold uppercase tracking-wider opacity-60 mb-1'>
        {label}
      </div>
      <div className='font-display text-2xl font-bold tracking-tight tabular-nums'>{value}</div>
      <div className='text-xs mt-1 opacity-50'>{sublabel}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  href,
  linkText,
  external,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  linkText: string;
  external?: boolean;
}) {
  const Comp = external ? 'a' : Link;
  const extraProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <div className='bg-white/60 rounded-xl border border-white/80 p-4 space-y-2 hover:shadow-sm transition-shadow'>
      <div className='w-9 h-9 rounded-lg bg-gov-forest/10 flex items-center justify-center text-gov-forest'>
        {icon}
      </div>
      <h3 className='font-semibold text-gov-dark text-sm'>{title}</h3>
      <p className='text-xs text-gov-dark/50 leading-relaxed'>{description}</p>
      <Comp
        href={href}
        className='inline-flex items-center gap-1 text-xs font-medium text-gov-sage hover:text-gov-forest transition-colors'
        {...extraProps}>
        {linkText}
        {external ? <ExternalLink size={11} /> : <ArrowRight size={11} />}
      </Comp>
    </div>
  );
}
