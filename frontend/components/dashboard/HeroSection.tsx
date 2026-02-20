'use client';

import { motion } from 'framer-motion';
import { BarChart3, Search, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/* ── Chart data ── */
const debtTimeline = [
  { year: '2019', debt: 5800, gdpRatio: 58 },
  { year: '2020', debt: 7200, gdpRatio: 64 },
  { year: '2021', debt: 8200, gdpRatio: 67 },
  { year: '2022', debt: 9100, gdpRatio: 69 },
  { year: '2023', debt: 10200, gdpRatio: 71 },
  { year: '2024', debt: 11500, gdpRatio: 74 },
];

/**
 * Dashboard Hero — full hero zone with title + 3-container card layout.
 *
 *  ┌─────────────────────────────────────────────────────────┬──────────────┐
 *  │  Title: "Kenya Public Money Tracker"                    │              │
 *  │  Subtitle: "Where your taxes go, in real time"          │              │
 *  ├─ Container A (glass outer) ─────────────────────────────┤ Container C  │
 *  │  ┌ Summary strip: 🇰🇪 11.5T  74%  ● High Risk ──────┐ │  (county     │
 *  │  │                                                      │ │   overview)  │
 *  │  ├─ Container B (white inner): Kenya's National Debt ──┤ │              │
 *  │  │  [chart] + [bottom facts row]                        │ │              │
 *  │  └──────────────────────────────────────────────────────┘ │              │
 *  └─────────────────────────────────────────────────────────┴──────────────┘
 */
export default function HeroSection() {
  return (
    <div className='max-w-[1340px] mx-auto px-5 lg:px-8 pt-24 pb-6'>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className='max-w-2xl'>
        <h1 className='font-display text-4xl sm:text-5xl lg:text-[3.5rem] text-white leading-[1.08] mb-2 drop-shadow-lg whitespace-nowrap'>
          Kenya Public Money Tracker
        </h1>
        <p className='text-base sm:text-lg text-white/70 font-light tracking-wide drop-shadow-md'>
          Where your taxes go, in real time
        </p>
      </motion.div>
    </div>
  );
}

/** Summary strip with 11.5T, 74%, High Risk — exported for page.tsx */
export function SummaryStrip() {
  return (
    <div className='flex flex-wrap items-end gap-x-6 gap-y-3 mb-4 px-1'>
      {/* Flag + Total Debt */}
      <div className='flex items-center gap-2.5'>
        <span className='text-2xl'>🇰🇪</span>
        <div>
          <span className='text-4xl sm:text-5xl font-extrabold text-gov-dark tracking-tight leading-none'>
            11.5<span className='text-3xl sm:text-4xl ml-0.5'>T</span>
          </span>
        </div>
      </div>

      {/* Risk Level */}
      <div className='flex items-end gap-3'>
        <div>
          <span className='text-3xl sm:text-4xl font-bold text-gov-dark tracking-tight leading-none'>
            74<span className='text-xl'>%</span>
          </span>
        </div>
        <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/60 border border-gov-copper/20 text-gov-copper mb-0.5'>
          <span className='w-1.5 h-1.5 rounded-full bg-gov-copper inline-block' />
          High Risk
        </span>
      </div>

      {/* Labels row */}
      <div className='w-full flex gap-8 mt-0.5'>
        <span className='text-xs text-gov-dark/60 font-medium'>Total Debt as of 2024</span>
        <span className='text-xs text-gov-dark/60 font-medium'>
          Risk Level{' '}
          <span className='inline-flex gap-0.5 ml-1'>
            <span>👍</span>
            <span>❓</span>
            <span className='text-gov-copper'>🔴</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTAINER B — inner white card: "Kenya's National Debt"
   Chart + search + bottom facts
   ═══════════════════════════════════════════════════════════ */
export function NationalDebtPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm p-5 sm:p-6'>
      {/* Header row */}
      <div className='flex items-start justify-between mb-5'>
        <div>
          <h2 className='font-display text-xl sm:text-2xl text-gov-dark mb-1'>
            Kenya&apos;s National Debt
          </h2>
          <p className='text-sm text-neutral-muted leading-snug'>
            See budget allocations and audit statuses for every county in Kenya.
          </p>
        </div>
        {/* Search */}
        <div className='relative hidden sm:block flex-shrink-0'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted' />
          <input
            type='text'
            placeholder='Search county'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-9 pr-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-gov-sage/30 focus:border-gov-sage/50
                       placeholder:text-gray-400 w-44'
          />
        </div>
      </div>

      {/* Chart */}
      <div className='h-48 sm:h-56 mb-4'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart data={debtTimeline} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id='heroDebtBar' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='#1B3A2A' stopOpacity={0.85} />
                <stop offset='100%' stopColor='#4A7C5C' stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id='heroGdpArea' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='#1B3A2A' stopOpacity={0.2} />
                <stop offset='100%' stopColor='#1B3A2A' stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='#E5E7EB' vertical={false} />
            <XAxis
              dataKey='year'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
            />
            <YAxis
              yAxisId='debt'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickFormatter={(v: number) => `${v}`}
            />
            <YAxis yAxisId='ratio' orientation='right' hide domain={[40, 100]} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                fontSize: '12px',
              }}
            />
            <Bar
              yAxisId='debt'
              dataKey='debt'
              fill='url(#heroDebtBar)'
              radius={[4, 4, 0, 0]}
              barSize={30}
              name='Debt (B KES)'
            />
            <Area
              yAxisId='ratio'
              type='monotone'
              dataKey='gdpRatio'
              stroke='#1B3A2A'
              strokeWidth={2}
              fill='url(#heroGdpArea)'
              dot={{ r: 3.5, fill: '#1B3A2A', stroke: '#fff', strokeWidth: 2 }}
              name='Debt-to-GDP %'
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Debt-to-GDP callout */}
      <div className='flex items-center justify-end gap-2 mb-4'>
        <span className='text-xs text-gray-500'>Debt-to-GCD to 2024</span>
        <span className='text-2xl font-bold text-gov-forest'>74%</span>
      </div>

      {/* Bottom facts row */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100'>
        <FactItem
          icon={<span className='text-base'>🇰🇪</span>}
          value='KES 32.0 cents'
          label='of every tax shilling goes to debt service annually.'
        />
        <FactItem
          icon={
            <div className='w-5 h-5 rounded-full bg-gov-forest/10 flex items-center justify-center'>
              <BarChart3 className='w-3 h-3 text-gov-forest' />
            </div>
          }
          value='0.0s / GC9 DD'
          label='Domestic vs § External Debt split: 00% / 100%'
          badge='GB'
        />
        <FactItem
          icon={
            <div className='w-5 h-5 rounded-full bg-gov-sage/10 flex items-center justify-center'>
              <TrendingUp className='w-3 h-3 text-gov-sage' />
            </div>
          }
          value='0.0%'
          secondaryValue='100%'
          label='FT adite Ratjuls up 15% in 5 years.'
        />
      </div>
    </div>
  );
}

function FactItem({
  icon,
  value,
  secondaryValue,
  label,
  badge,
}: {
  icon: React.ReactNode;
  value: string;
  secondaryValue?: string;
  label: string;
  badge?: string;
}) {
  return (
    <div className='flex items-start gap-2'>
      <div className='mt-0.5 flex-shrink-0'>{icon}</div>
      <div>
        <div className='flex items-center gap-1.5'>
          <span className='text-sm font-semibold text-gov-dark'>{value}</span>
          {badge && (
            <span className='text-[9px] font-bold bg-gray-200 text-gray-600 px-1 py-0.5 rounded'>
              {badge}
            </span>
          )}
          {secondaryValue && (
            <>
              <span className='text-gray-400 text-xs'>
                <TrendingUp className='w-3 h-3 inline' />
              </span>
              <span className='text-sm font-semibold text-gov-dark'>{secondaryValue}</span>
            </>
          )}
        </div>
        <span className='text-xs text-gray-500 leading-tight block'>{label}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTAINER C — Kenyan Government fiscal snapshot card
   Enticing overview of last year's national financials,
   links to the National Debt page for the full picture.
   ═══════════════════════════════════════════════════════════ */
export function KenyanGovCard() {
  const items = [
    { label: 'Appropriated', value: 'KES 3.69T', sub: 'FY 2024/25' },
    { label: 'Borrowed', value: 'KES 846B', sub: '23% of budget', alert: true },
    { label: 'Revenue', value: 'KES 2.57T', sub: 'Tax + non-tax' },
    { label: 'Debt Service', value: 'KES 1.19T', sub: '32¢ per shilling' },
  ];

  return (
    <div className='rounded-xl bg-white/30 backdrop-blur-md border border-white/20 overflow-hidden flex flex-col h-full'>
      {/* Header banner */}
      <div className='relative flex-shrink-0 bg-gradient-to-br from-gov-forest to-gov-dark px-4 py-4'>
        <div className='flex items-center gap-2.5'>
          <span className='text-2xl'>🇰🇪</span>
          <div>
            <h3 className='text-base font-bold text-white leading-tight'>Kenyan Government</h3>
            <p className='text-[11px] text-white/60 font-medium'>FY 2024/25 Fiscal Snapshot</p>
          </div>
        </div>
        {/* Accent line */}
        <div className='absolute bottom-0 left-4 right-4 h-[2px] bg-gradient-to-r from-gov-gold/80 via-gov-gold/40 to-transparent' />
      </div>

      {/* Fiscal items */}
      <div className='p-4 flex-1 flex flex-col gap-3 bg-white/50 backdrop-blur-md'>
        {items.map((item) => (
          <div key={item.label} className='flex items-center justify-between'>
            <span className='text-xs text-gray-500 font-medium'>{item.label}</span>
            <div className='text-right'>
              <span
                className={`text-sm font-bold tabular-nums ${item.alert ? 'text-gov-copper' : 'text-gov-dark'}`}>
                {item.value}
              </span>
              <span className='block text-[10px] text-gray-400 leading-tight'>{item.sub}</span>
            </div>
          </div>
        ))}

        {/* Debt ceiling bar */}
        <div className='mt-1'>
          <div className='flex items-center justify-between mb-1'>
            <span className='text-[10px] text-gray-500 font-medium'>Debt Ceiling Usage</span>
            <span className='text-[10px] font-bold text-gov-copper'>89%</span>
          </div>
          <div className='h-1.5 rounded-full bg-gray-200 overflow-hidden'>
            <div
              className='h-full rounded-full bg-gradient-to-r from-gov-gold to-gov-copper transition-all'
              style={{ width: '89%' }}
            />
          </div>
        </div>

        {/* CTA */}
        <a
          href='/national-debt'
          className='mt-auto w-full py-2.5 rounded-full bg-gov-forest text-white text-sm font-medium hover:bg-gov-forest/90 transition-colors shadow-sm text-center block'>
          Explore National Debt →
        </a>
      </div>
    </div>
  );
}
