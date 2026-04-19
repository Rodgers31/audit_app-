'use client';

/**
 * Budget & Spending — redesigned page
 *
 * The page is composed from domain-specific components under
 * `/components/budget`, each of which owns one clear chapter of the story:
 *
 *   1. BudgetFlowHero              — "where money comes from / where it goes"
 *   2. FiscalTrendStrip            — multi-year sparklines (is the gap widening?)
 *   3. SpendDonut                  — concentric donut: macro × sectors
 *   4. RevenueMix                  — KRA revenue streams with YoY deltas
 *   5. ExecutionAuditLens          — sectors ranked by unspent (the audit lens)
 *   6. CountyUtilizationStrip      — best / worst absorbers + link to /counties
 *   7. EconomicContextStrip        — GDP ratios, inflation, per-capita
 *   8. BudgetSourceReconciliation  — sources and known caveats
 *
 * The previous version of this file was ~1,620 lines of inline chart JSX.
 * Breaking it into chapters makes each section independently auditable
 * and mirrors the narrative arc we adopted on the National Debt page.
 */

import DataFreshnessBadge from '@/components/DataFreshnessBadge';
import DataIntegrityBanner from '@/components/DataIntegrityBanner';
import PageShell from '@/components/layout/PageShell';
import PDFExportButton from '@/components/PDFExportButton';
import BudgetFlowHero, {
  type FlowHeroInput,
} from '@/components/budget/BudgetFlowHero';
import BudgetSourceReconciliation, {
  type BudgetMeta,
} from '@/components/budget/BudgetSourceReconciliation';
import CountyUtilizationStrip from '@/components/budget/CountyUtilizationStrip';
import EconomicContextStrip from '@/components/budget/EconomicContextStrip';
import ExecutionAuditLens from '@/components/budget/ExecutionAuditLens';
import FiscalTrendStrip from '@/components/budget/FiscalTrendStrip';
import RevenueMix from '@/components/budget/RevenueMix';
import SpendDonut from '@/components/budget/SpendDonut';
import { useBudgetEnhanced, useBudgetOverview } from '@/lib/react-query';
import { useFiscalSummary } from '@/lib/react-query/useFiscal';
import { motion } from 'framer-motion';
import { AlertTriangle, ExternalLink, Info, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════
   Data sources panel (explanation modal)
   ═══════════════════════════════════════════════════════ */

const DATA_SOURCES = [
  {
    section: 'Budget Execution by Sector',
    authority: 'Office of the Controller of Budget (OCOB)',
    description:
      'Sector-level expenditure vs. approved estimates from the Annual National Government Budget Implementation Review Reports (NG-BIRR).',
    methodology:
      'Approved Estimates from the Appropriation Act; Actual Expenditure from CoB exchequer-release reports to Parliament per Article 228(6) of the Constitution of Kenya.',
    url: 'https://cob.go.ke/publications/annual-national-government-budget-implementation-review-reports/',
    urlLabel: 'CoB Annual NG-BIRR Reports',
  },
  {
    section: 'Revenue by Source',
    authority: 'Kenya Revenue Authority (KRA)',
    description:
      'Tax revenue breakdown (PAYE, VAT, Corporation Tax, Excise Duty, Customs) from KRA annual performance press releases.',
    url: 'https://www.kra.go.ke/news-center/press-release',
    urlLabel: 'KRA Press Releases',
  },
  {
    section: 'County Budget Allocations',
    authority: 'Commission on Revenue Allocation (CRA)',
    description:
      'County-level budget allocations per the Division of Revenue Act and County Allocation of Revenue Act.',
    url: 'https://www.crakenya.org/county-allocations/',
    urlLabel: 'CRA County Allocations',
  },
  {
    section: 'Fiscal Summary & Borrowing',
    authority: 'National Treasury & Central Bank of Kenya',
    description:
      'High-level fiscal aggregates (revenue, expenditure, borrowing, debt service) from the Budget Policy Statement and Controller of Budget quarterly reports.',
    url: 'https://www.treasury.go.ke/budget-policy-statement/',
    urlLabel: 'National Treasury BPS',
  },
];

function DataSourcesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[200] flex items-center justify-center p-4'
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className='relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-gray-100'>
        <div className='sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm rounded-t-2xl'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>Data Sources</h3>
            <p className='text-xs text-gray-500 mt-0.5'>
              Official resources used on this page
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600'
            aria-label='Close'>
            <X size={18} />
          </button>
        </div>
        <div className='px-6 py-4 space-y-5'>
          {DATA_SOURCES.map((src) => (
            <div key={src.section} className='group'>
              <h4 className='text-sm font-semibold text-gray-800 mb-1'>{src.section}</h4>
              <p className='text-xs text-gray-500 leading-relaxed mb-1.5'>
                {src.description}
              </p>
              {src.methodology && (
                <p className='text-[11px] text-gray-400 italic mb-1.5'>
                  Methodology: {src.methodology}
                </p>
              )}
              <div className='flex items-center gap-2 text-xs'>
                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gov-forest/10 text-gov-forest font-medium'>
                  {src.authority}
                </span>
                <a
                  href={src.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-gov-forest hover:underline'>
                  {src.urlLabel}
                  <ExternalLink size={11} />
                </a>
              </div>
              <div className='mt-3 border-b border-gray-100 group-last:border-0' />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════ */

export default function BudgetSpendingPage() {
  const {
    data: overview,
    isLoading: loadingOverview,
    isError: errorOverview,
    refetch: refetchOverview,
  } = useBudgetOverview();
  const {
    data: fiscal,
    isLoading: loadingFiscal,
    isError: errorFiscal,
    refetch: refetchFiscal,
  } = useFiscalSummary();
  const { data: enhanced } = useBudgetEnhanced();

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const closeSourcesModal = useCallback(() => setSourcesOpen(false), []);

  const isLoading = loadingOverview || loadingFiscal;
  const isError = errorOverview || errorFiscal;

  /* ── Derived data ── */
  const fiscalHistoryRaw = overview?.fiscal_history ?? fiscal?.history ?? [];
  const fiscalHistory = useMemo(
    () =>
      fiscalHistoryRaw.filter((f: any) =>
        [
          f.appropriated_budget,
          f.total_revenue,
          f.total_borrowing,
          f.debt_service_cost,
          f.county_allocation,
        ].some((v) => v != null && v > 0)
      ),
    [fiscalHistoryRaw]
  );

  // Latest fiscal-year row drives the hero narrative.
  const latestFiscal: FlowHeroInput | null = useMemo(() => {
    const cur = fiscal?.current as Record<string, any> | undefined;
    if (cur && cur.fiscal_year) return cur as FlowHeroInput;
    const last = fiscalHistory[fiscalHistory.length - 1];
    return last ?? null;
  }, [fiscal, fiscalHistory]);

  const sectors = overview?.sectors ?? [];
  const countyUtil = overview?.county_utilization ?? {};
  const executionBySector = enhanced?.execution_by_sector ?? [];
  const revenueBySource = enhanced?.revenue_by_source ?? [];
  const economicContext = enhanced?.economic_context ?? null;

  const meta: BudgetMeta | undefined = (overview as any)?._meta;
  const fiscalPeriod: string | undefined = (overview as any)?.fiscal_period;

  /* ─────────────── render ─────────────── */

  if (isLoading) {
    return (
      <PageShell
        title="Kenya's Budget &amp; Spending"
        subtitle='Understanding how public funds are allocated and spent'>
        <div
          className='flex items-center justify-center py-32'
          role='status'
          aria-live='polite'>
          <Loader2 className='animate-spin text-gov-forest mr-3' size={28} />
          <span className='text-gray-500 text-lg'>Loading budget data…</span>
        </div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell title="Kenya's Budget &amp; Spending" subtitle='Something went wrong'>
        <div className='max-w-md mx-auto py-20 text-center'>
          <AlertTriangle size={40} className='mx-auto text-red-400 mb-3' />
          <p className='text-red-600 mb-4'>Failed to load budget data. Please try again.</p>
          <button
            onClick={() => {
              refetchOverview();
              refetchFiscal();
            }}
            className='px-4 py-2 bg-gov-dark text-white rounded-lg text-sm hover:bg-gov-dark/90 transition-colors'>
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Kenya's Budget & Spending"
      subtitle='How public funds are raised, allocated, and spent — with the audit lens on what actually reached citizens.'>
      {/* Freshness + toolbar */}
      <DataFreshnessBadge sources='COB/Treasury' variant='banner' />

      {!overview && !fiscal && (
        <DataIntegrityBanner
          message='Budget data returned empty from the backend. Figures below may show zeros or dashes instead of real values.'
          severity='warning'
        />
      )}

      <DataSourcesModal open={sourcesOpen} onClose={closeSourcesModal} />

      <div className='flex justify-end items-center gap-2 -mb-2'>
        <PDFExportButton compact documentTitle='Kenya Budget & Spending Report' />
        <button
          onClick={() => setSourcesOpen(true)}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gov-forest hover:bg-gov-forest/5 rounded-lg transition-colors'
          title='View data sources'>
          <Info size={14} />
          <span>Sources</span>
        </button>
      </div>

      {/* ─── 1. Hero flow ─── */}
      <BudgetFlowHero data={latestFiscal} />

      {/* ─── 2. Multi-year trend strip ─── */}
      <FiscalTrendStrip history={fiscalHistory} />

      {/* ─── 3. Where the money goes (donut) ─── */}
      <SpendDonut
        data={{
          fiscal_year: latestFiscal?.fiscal_year ?? undefined,
          appropriated_budget: latestFiscal?.appropriated_budget ?? null,
          recurrent_spending: latestFiscal?.recurrent_spending ?? null,
          debt_service_cost: latestFiscal?.debt_service_cost ?? null,
          development_spending: latestFiscal?.development_spending ?? null,
          county_allocation: latestFiscal?.county_allocation ?? null,
          sectors: sectors as any,
        }}
      />

      {/* ─── 4. Where revenue comes from ─── */}
      <RevenueMix revenueBySource={revenueBySource as any} />

      {/* ─── 5. The audit lens: execution by sector ─── */}
      <ExecutionAuditLens rows={executionBySector as any} />

      {/* ─── 6. County best/worst absorbers ─── */}
      <CountyUtilizationStrip
        top={countyUtil?.top_5 ?? []}
        bottom={countyUtil?.bottom_5 ?? []}
        average={countyUtil?.average}
      />

      {/* ─── 7. Economic context ─── */}
      <EconomicContextStrip ctx={economicContext} />

      {/* ─── 8. Sources & reconciliation ─── */}
      <BudgetSourceReconciliation
        meta={meta}
        lastUpdated={overview?.last_updated}
        fiscalPeriod={fiscalPeriod}
      />

      {/* Attribution footer */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className='text-center text-xs text-gray-400 pt-2'>
        Data: National Treasury Budget Policy Statement · Controller of Budget · CRA ·
        Kenya Revenue Authority
        {overview?.last_updated && (
          <span> · Updated {new Date(overview.last_updated).toLocaleDateString()}</span>
        )}
      </motion.div>
    </PageShell>
  );
}
