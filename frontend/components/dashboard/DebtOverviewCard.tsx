'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const debtOverviewData = [
  { year: '2019', debt: 5800, projected: null },
  { year: '2020', debt: 7200, projected: null },
  { year: '2021', debt: 8200, projected: null },
  { year: '2022', debt: 9100, projected: null },
  { year: '2023', debt: 10200, projected: null },
  { year: '2024', debt: 11500, projected: 11500 },
];

/**
 * Zone 6 LEFT: National Debt Overview — chart + risk emphasis.
 * Asymmetric panel, taller than audit card.
 */
export default function DebtOverviewCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className='glass-card p-6 sm:p-8'>
      <h3 className='font-display text-xl text-gov-dark mb-1'>National Debt Overview</h3>

      {/* Chart */}
      <div className='h-48 mt-4 mb-5'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart
            data={debtOverviewData}
            margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#E2DDD5' vertical={false} />
            <XAxis
              dataKey='year'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#6B7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}T`}
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
              dataKey='debt'
              fill='#4A7C5C'
              radius={[4, 4, 0, 0]}
              barSize={28}
              opacity={0.7}
              name='Debt (B KES)'
            />
            <Line
              type='monotone'
              dataKey='debt'
              stroke='#1B3A2A'
              strokeWidth={2}
              dot={{ r: 3, fill: '#1B3A2A' }}
              name='Trend'
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Headline risk metric */}
      <div className='flex items-center gap-5 pt-4 border-t border-neutral-border/40'>
        <div>
          <div className='flex items-center gap-2 mb-0.5'>
            <span className='text-xl'>🇰🇪</span>
            <span className='metric-medium text-gov-dark'>KES 11.57 Trillion</span>
          </div>
          <p className='text-xs text-neutral-muted'>Total Debt as of 2024</p>
        </div>
        <div className='ml-auto text-right'>
          <div className='flex items-center gap-2 justify-end'>
            <AlertTriangle className='w-4 h-4 text-gov-copper' />
            <span className='text-2xl font-bold text-gov-copper'>74%</span>
          </div>
          <p className='text-xs text-neutral-muted'>High Risk</p>
          <p className='text-[10px] text-neutral-muted/60'>Debt Level</p>
        </div>
      </div>

      <button className='btn-secondary w-full mt-5 text-sm'>View Detailed Report</button>
    </motion.div>
  );
}
