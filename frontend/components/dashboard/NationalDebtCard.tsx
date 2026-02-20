'use client';

import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
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

const debtTimeline = [
  { year: '2019', debt: 5800, gdpRatio: 58 },
  { year: '2020', debt: 7200, gdpRatio: 64 },
  { year: '2021', debt: 8200, gdpRatio: 67 },
  { year: '2022', debt: 9100, gdpRatio: 69 },
  { year: '2023', debt: 10200, gdpRatio: 71 },
  { year: '2024', debt: 11500, gdpRatio: 74 },
];

/**
 * Zone 4: National Debt Analytics Panel
 * Wide analytical region — hybrid bar+line chart with inline metrics.
 * Blends with background using soft glass effect, NOT a boxed card.
 */
export default function NationalDebtCard() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className='glass-card p-6 sm:p-8 h-full'>
      {/* Header row */}
      <div className='flex items-start justify-between mb-6'>
        <div>
          <h2 className='font-display text-2xl text-gov-dark mb-1'>Kenya&apos;s National Debt</h2>
          <p className='text-sm text-neutral-muted'>
            See budget allocations and audit statuses for every county in Kenya.
          </p>
        </div>
        {/* Search */}
        <div className='relative hidden sm:block'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted' />
          <input
            type='text'
            placeholder='Search county'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-9 pr-4 py-2 rounded-full bg-white/60 border border-neutral-border text-sm
                       focus:outline-none focus:ring-2 focus:ring-gov-sage/30 focus:border-gov-sage/50
                       placeholder:text-neutral-muted/60 w-48'
          />
        </div>
      </div>

      {/* Hybrid chart: bars (debt) + area line (GDP ratio trend) */}
      <div className='h-56 sm:h-64 mb-6'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart data={debtTimeline} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id='debtBarGrad' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='#1B3A2A' stopOpacity={0.9} />
                <stop offset='100%' stopColor='#4A7C5C' stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id='gdpLineGrad' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='#1B3A2A' stopOpacity={0.25} />
                <stop offset='100%' stopColor='#1B3A2A' stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='#E2DDD5' vertical={false} />
            <XAxis
              dataKey='year'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <YAxis
              yAxisId='debt'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}T`}
            />
            <YAxis
              yAxisId='ratio'
              orientation='right'
              domain={[40, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #E2DDD5',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Bar
              yAxisId='debt'
              dataKey='debt'
              fill='url(#debtBarGrad)'
              radius={[6, 6, 0, 0]}
              barSize={36}
              name='Debt (B KES)'
            />
            <Area
              yAxisId='ratio'
              type='monotone'
              dataKey='gdpRatio'
              stroke='#1B3A2A'
              strokeWidth={2}
              fill='url(#gdpLineGrad)'
              dot={{ r: 4, fill: '#1B3A2A', stroke: '#fff', strokeWidth: 2 }}
              name='Debt-to-GDP %'
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom inline metrics row */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-border/40'>
        <MetricInline
          flag='🇰🇪'
          value='KES 32.0 cents'
          label='of every tax shilling goes to debt service annually'
        />
        <MetricInline
          icon={
            <div className='w-5 h-5 rounded-full bg-gov-forest/10 flex items-center justify-center'>
              <span className='text-[10px] font-bold text-gov-forest'>D/E</span>
            </div>
          }
          value='0.0% / GCD DD'
          label='Domestic vs External debt split'
        />
        <MetricInline
          icon={
            <div className='w-5 h-5 rounded-full bg-gov-sage/10 flex items-center justify-center'>
              <span className='text-[10px]'>📈</span>
            </div>
          }
          value='0.0% → 100%'
          label='Debt ratio projection up 15% in 5 years'
        />
      </div>
    </motion.div>
  );
}

function MetricInline({
  flag,
  icon,
  value,
  label,
}: {
  flag?: string;
  icon?: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className='flex items-start gap-2'>
      {flag && <span className='text-base mt-0.5'>{flag}</span>}
      {icon && <div className='mt-0.5'>{icon}</div>}
      <div>
        <span className='text-sm font-semibold text-gov-dark block'>{value}</span>
        <span className='text-xs text-neutral-muted leading-tight'>{label}</span>
      </div>
    </div>
  );
}
