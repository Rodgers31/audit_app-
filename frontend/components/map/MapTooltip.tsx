/**
 * MapTooltip – glass-card styled hover tooltip matching dashboard aesthetic.
 * Shows county audit status, budget utilisation and financial alerts.
 */
'use client';

import { County } from '@/types';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Receipt, Scale } from 'lucide-react';

interface MapTooltipProps {
  county: County;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCountyClick: (county: County) => void;
}

/* ── helpers ── */

const fmtKES = (n: number | undefined): string => {
  if (!n || n === 0) return 'KES 0';
  if (n >= 1e9) return `KES ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`;
  return `KES ${n}`;
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  clean: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  qualified: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
  },
  adverse: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-500' },
  disclaimer: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
    dot: 'bg-violet-500',
  },
  pending: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-200', dot: 'bg-gray-400' },
};

const utilizationClass = (u: number) =>
  u > 85 ? 'bg-emerald-500' : u > 70 ? 'bg-amber-500' : 'bg-red-500';

/* ── component ── */

export default function MapTooltip({
  county,
  onMouseEnter,
  onMouseLeave,
  onCountyClick,
}: MapTooltipProps) {
  const status = county.auditStatus || 'pending';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const utilization = county.budgetUtilization || 0;
  const debtRatio =
    county.budget && county.budget > 0 ? ((county.debt || 0) / county.budget) * 100 : 0;
  const fundingGap = (county.budget || 0) - (county.moneyReceived || 0);
  const auditIssuesCount = county.auditIssues?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 14 }}
      transition={{ type: 'spring', damping: 22, stiffness: 340 }}
      className='absolute z-50 top-[18%] left-1/2 -translate-x-1/2'>
      {/* Invisible hit-area so mouse doesn't lose hover in the gap */}
      <div
        className='absolute -inset-5 z-0'
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={() => onCountyClick(county)}
        className='relative w-72 rounded-xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 cursor-pointer transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.18)]'>
        {/* ── Header ── */}
        <div className='flex items-start justify-between gap-2 mb-3'>
          <div className='min-w-0'>
            <h3 className='text-[15px] font-bold text-gov-dark truncate'>{county.name}</h3>
            <p className='text-[11px] text-gray-400 mt-0.5'>
              {county.lastAuditDate
                ? `Audited ${new Date(county.lastAuditDate).getFullYear()}`
                : 'County overview'}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {status}
          </span>
        </div>

        {/* ── Metrics row ── */}
        <div className='grid grid-cols-2 gap-2 mb-3'>
          {/* Budget utilisation */}
          <div className='bg-gray-50/80 rounded-lg p-2'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-[10px] font-medium text-gray-500'>Utilisation</span>
              <span className='text-xs font-bold text-gov-dark'>{utilization.toFixed(0)}%</span>
            </div>
            <div className='w-full h-1.5 rounded-full bg-gray-200'>
              <div
                className={`h-1.5 rounded-full ${utilizationClass(utilization)} transition-all`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
          </div>

          {/* Debt ratio */}
          <div className='bg-gray-50/80 rounded-lg p-2'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-[10px] font-medium text-gray-500'>Debt Ratio</span>
              <span className='text-xs font-bold text-gov-dark'>{debtRatio.toFixed(1)}%</span>
            </div>
            <div className='text-[10px] text-gray-400 truncate'>{fmtKES(county.debt)}</div>
          </div>
        </div>

        {/* ── Alerts (compact) ── */}
        <div className='space-y-1'>
          {fundingGap > 0 && (
            <AlertRow
              icon={<Scale className='w-3 h-3 text-amber-600' />}
              label='Funding gap'
              value={fmtKES(fundingGap)}
            />
          )}
          {auditIssuesCount > 0 && (
            <AlertRow
              icon={<AlertTriangle className='w-3 h-3 text-red-500' />}
              label='Audit issues'
              value={`${auditIssuesCount} found`}
            />
          )}
          {(county.pendingBills ?? 0) > 0 && (
            <AlertRow
              icon={<Receipt className='w-3 h-3 text-violet-500' />}
              label='Pending bills'
              value={fmtKES(county.pendingBills)}
            />
          )}
        </div>

        {/* ── CTA ── */}
        <div className='mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-center gap-1 text-[11px] font-medium text-gov-forest'>
          View detailed analysis
          <ArrowRight className='w-3 h-3' />
        </div>
      </div>
    </motion.div>
  );
}

/* tiny helper row */
function AlertRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className='flex items-center justify-between bg-white/60 rounded-md px-2 py-1.5 border border-gray-100'>
      <div className='flex items-center gap-1.5'>
        {icon}
        <span className='text-[10px] font-medium text-gray-600'>{label}</span>
      </div>
      <span className='text-[10px] font-bold text-gray-700'>{value}</span>
    </div>
  );
}
