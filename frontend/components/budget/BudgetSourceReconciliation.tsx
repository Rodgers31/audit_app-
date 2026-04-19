'use client';

/**
 * BudgetSourceReconciliation
 *
 * Mirrors the Debt page's DebtSourceReconciliation: surfaces the data
 * provenance and known caveats about where the numbers come from so a
 * citizen can trust what they're reading or follow the chain back to the
 * primary documents.
 *
 *   Primary source: Controller of Budget (CoB) — Annual NG-BIRR
 *   Reference:      National Treasury — Appropriation Act / BPS
 *   Caveats:        Personnel Emoluments not always broken out; actuals
 *                   lag 6–9 months; CRA-formula modeling for county lines
 *                   when fresh BIRR data isn't yet available.
 */

import { motion } from 'framer-motion';
import { BookOpen, Database, FileText, GitCompareArrows, Info } from 'lucide-react';

export interface BudgetMeta {
  data_quality?: string;
  scope_detail?: string;
  quality_notes?: string[];
  source_updated_at?: string;
  covers_through?: string;
}

interface Props {
  meta?: BudgetMeta | null;
  lastUpdated?: string | null;
  fiscalPeriod?: string | null;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function BudgetSourceReconciliation({
  meta,
  lastUpdated,
  fiscalPeriod,
}: Props) {
  const qualityLabel = meta?.data_quality ?? 'estimated';
  const notes = meta?.quality_notes ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className='rounded-2xl border border-neutral-border/40 bg-white/70 backdrop-blur-sm overflow-hidden'>
      <div className='border-b border-neutral-border/40 bg-gradient-to-r from-gov-sand/40 via-white to-transparent px-5 sm:px-7 py-4'>
        <div className='flex items-start gap-3'>
          <div className='rounded-lg bg-gov-forest/10 text-gov-forest p-2 mt-0.5'>
            <GitCompareArrows size={18} />
          </div>
          <div className='flex-1 min-w-0'>
            <h3 className='font-display text-lg sm:text-xl text-gov-dark leading-tight'>
              Sources &amp; Reconciliation
            </h3>
            <p className='text-xs sm:text-sm text-neutral-muted mt-0.5'>
              Who published these numbers, what they measure, and what they leave out.
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-border/40'>
        {/* Execution / actuals */}
        <div className='p-5 sm:p-6 relative'>
          <div className='absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gov-forest bg-gov-forest/10 px-2 py-0.5 rounded-full'>
            <span className='relative flex h-1.5 w-1.5'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-gov-forest opacity-60' />
              <span className='relative inline-flex rounded-full h-1.5 w-1.5 bg-gov-forest' />
            </span>
            Actuals
          </div>
          <div className='flex items-center gap-2 mb-2'>
            <Database size={14} className='text-gov-forest' />
            <span className='text-xs font-semibold uppercase tracking-wider text-gov-forest'>
              Controller of Budget
            </span>
          </div>
          <div className='font-display text-lg text-gov-dark'>
            Budget Implementation Review
          </div>
          <p className='text-xs text-neutral-muted mt-2 leading-relaxed'>
            Execution rates, sector spend, and county utilisation come from the CoB&apos;s
            quarterly and annual BIRR reports to Parliament, per Article 228(6) of the
            Constitution. Published with a 3–6 month lag after quarter close.
          </p>
          <dl className='mt-4 space-y-1.5 text-[11px]'>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Source</dt>
              <dd className='text-gov-dark font-medium text-right'>CoB Annual NG-BIRR</dd>
            </div>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Fetch</dt>
              <dd className='text-gov-dark font-medium text-right'>Quarterly · PDF parsed</dd>
            </div>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Last updated</dt>
              <dd className='text-gov-dark font-medium text-right'>{fmtDate(lastUpdated)}</dd>
            </div>
          </dl>
        </div>

        {/* Plan / appropriations */}
        <div className='p-5 sm:p-6 relative'>
          <div className='absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gov-gold bg-gov-gold/15 px-2 py-0.5 rounded-full'>
            <BookOpen size={10} />
            Plan
          </div>
          <div className='flex items-center gap-2 mb-2'>
            <FileText size={14} className='text-gov-gold' />
            <span className='text-xs font-semibold uppercase tracking-wider text-gov-gold'>
              National Treasury
            </span>
          </div>
          <div className='font-display text-lg text-gov-dark'>
            Appropriation Act &amp; BPS
          </div>
          <p className='text-xs text-neutral-muted mt-2 leading-relaxed'>
            Headline budget ceilings, fiscal aggregates, revenue targets, and borrowing
            plans come from the Budget Policy Statement and the Appropriation Act passed
            by the National Assembly before each FY begins.
          </p>
          <dl className='mt-4 space-y-1.5 text-[11px]'>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Source</dt>
              <dd className='text-gov-dark font-medium text-right'>
                National Treasury BPS
              </dd>
            </div>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Fetch</dt>
              <dd className='text-gov-dark font-medium text-right'>Annual publication</dd>
            </div>
            <div className='flex justify-between gap-3'>
              <dt className='text-neutral-muted'>Covers</dt>
              <dd className='text-gov-dark font-medium text-right'>
                {fiscalPeriod ?? meta?.covers_through ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Quality / caveats strip */}
      {(notes.length > 0 || meta?.scope_detail) && (
        <div className='border-t border-neutral-border/40 bg-gov-sand/30 px-5 sm:px-7 py-4'>
          <div className='flex items-start gap-3'>
            <div className='rounded-full bg-white border border-gov-gold/40 text-gov-gold p-1.5 mt-0.5 flex-shrink-0'>
              <Info size={14} />
            </div>
            <div className='flex-1'>
              <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
                <span className='text-sm font-semibold text-gov-dark'>
                  Data quality: <span className='capitalize'>{qualityLabel}</span>
                </span>
                <span className='text-xs text-neutral-muted'>
                  What these numbers don&apos;t tell you
                </span>
              </div>
              {meta?.scope_detail && (
                <p className='text-[12px] text-neutral-muted leading-relaxed mt-1'>
                  {meta.scope_detail}
                </p>
              )}
              {notes.length > 0 && (
                <ul className='mt-2 space-y-1.5 text-[11.5px] text-neutral-muted/90 leading-relaxed list-disc pl-4'>
                  {notes.slice(0, 4).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
