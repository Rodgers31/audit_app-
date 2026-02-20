'use client';

import { County } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Landmark, MapPin, Shield, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

/* ─────────────────────────────────────────────────────────
   CountyDetailsPanel
   ─────────────────────────────────────────────────────────
   Sits beside the Kenya map. Reacts to whichever county
   the user is hovering / has selected on the map.
   Shows key financial health indicators and entices the
   user to explore the full county page.
   ───────────────────────────────────────────────────────── */

interface CountyDetailsPanelProps {
  county: County | null;
  className?: string;
}

/* Format KES in billions / millions */
function fmtKES(n: number | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(0)}M`;
  return `KES ${n.toLocaleString()}`;
}

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

/* Audit badge color mapping */
function auditColor(status?: string) {
  switch (status) {
    case 'clean':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'qualified':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'adverse':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'disclaimer':
      return 'bg-red-200 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-500 border-gray-200';
  }
}

function auditLabel(status?: string) {
  switch (status) {
    case 'clean':
      return 'Clean Audit';
    case 'qualified':
      return 'Qualified';
    case 'adverse':
      return 'Adverse';
    case 'disclaimer':
      return 'Disclaimer';
    default:
      return 'Pending';
  }
}

/* Health score color */
function healthColor(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-red-600';
}
function healthBarColor(score: number) {
  if (score >= 70) return 'from-emerald-400 to-emerald-600';
  if (score >= 55) return 'from-amber-400 to-amber-500';
  return 'from-red-400 to-red-600';
}

export default function CountyDetailsPanel({ county, className = '' }: CountyDetailsPanelProps) {
  return (
    <div
      className={`rounded-xl bg-white border border-gray-200/60 shadow-sm overflow-hidden flex flex-col ${className}`}
      style={{ height: 500 }}>
      <AnimatePresence mode='wait'>
        {county ? (
          <motion.div
            key={county.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className='flex flex-col flex-1 min-h-0'>
            {/* Header */}
            <div className='px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gov-forest/5 to-transparent'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-gov-forest/10 flex items-center justify-center'>
                    <MapPin className='w-4 h-4 text-gov-forest' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-gov-dark leading-tight'>{county.name}</h3>
                    <p className='text-[11px] text-gray-400 font-medium'>County Government</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-full border ${auditColor(county.auditStatus)}`}>
                  <Shield className='w-3 h-3 mr-1' />
                  {auditLabel(county.auditStatus)}
                </span>
              </div>
            </div>

            {/* Metrics grid */}
            <div className='px-5 py-4 flex-1 space-y-4'>
              {/* Financial Health Score */}
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <span className='text-xs text-gray-500 font-medium'>Financial Health</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${healthColor(county.financial_health_score)}`}>
                    {county.financial_health_score}/100
                  </span>
                </div>
                <div className='h-2 rounded-full bg-gray-100 overflow-hidden'>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${county.financial_health_score}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                    className={`h-full rounded-full bg-gradient-to-r ${healthBarColor(county.financial_health_score)}`}
                  />
                </div>
              </div>

              {/* Key stats */}
              <div className='grid grid-cols-2 gap-3'>
                <StatItem
                  icon={<Wallet className='w-3.5 h-3.5' />}
                  label='Budget 2025'
                  value={fmtKES(county.budget_2025)}
                  iconBg='bg-gov-sage/10 text-gov-sage'
                />
                <StatItem
                  icon={<TrendingDown className='w-3.5 h-3.5' />}
                  label='Total Debt'
                  value={fmtKES(county.debt)}
                  iconBg='bg-gov-copper/10 text-gov-copper'
                  alert={county.debt && county.budget ? county.debt / county.budget > 0.3 : false}
                />
                <StatItem
                  icon={<Users className='w-3.5 h-3.5' />}
                  label='Population'
                  value={fmtPop(county.population)}
                  iconBg='bg-blue-50 text-blue-500'
                />
                <StatItem
                  icon={<Landmark className='w-3.5 h-3.5' />}
                  label='Audit Rating'
                  value={county.audit_rating}
                  iconBg='bg-gov-forest/10 text-gov-forest'
                />
              </div>

              {/* Debt-to-budget ratio */}
              {county.debt && county.budget && (
                <div className='rounded-lg bg-gray-50 border border-gray-100 p-3'>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-[11px] text-gray-500 font-medium'>
                      Debt-to-Budget Ratio
                    </span>
                    <span className='text-xs font-bold text-gov-dark tabular-nums'>
                      {((county.debt / county.budget) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className='h-1.5 rounded-full bg-gray-200 overflow-hidden'>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((county.debt / county.budget) * 100, 100)}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className='h-full rounded-full bg-gradient-to-r from-gov-gold to-gov-copper'
                    />
                  </div>
                </div>
              )}

              {/* Per-capita budget */}
              <div className='flex items-center justify-between text-xs'>
                <span className='text-gray-500'>Budget per capita</span>
                <span className='font-semibold text-gov-dark tabular-nums'>
                  {county.budget_2025 && county.population
                    ? `KES ${Math.round(county.budget_2025 / county.population).toLocaleString()}`
                    : '—'}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className='px-5 pb-4 mt-auto'>
              <Link href={`/counties/${county.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <button className='w-full py-2.5 rounded-full bg-gov-forest text-white text-sm font-medium hover:bg-gov-forest/90 transition-colors shadow-sm flex items-center justify-center gap-2'>
                  Explore {county.name}
                  <TrendingUp className='w-3.5 h-3.5' />
                </button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* Tiny stat item used in the 2×2 grid */
function StatItem({
  icon,
  label,
  value,
  iconBg,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBg: string;
  alert?: boolean;
}) {
  return (
    <div className='flex items-start gap-2'>
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
        {icon}
      </div>
      <div className='min-w-0'>
        <span className='text-[10px] text-gray-400 font-medium block leading-tight'>{label}</span>
        <span
          className={`text-sm font-bold tabular-nums leading-tight ${alert ? 'text-gov-copper' : 'text-gov-dark'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
