'use client';

import { motion } from 'framer-motion';

interface DebtTimelineChartProps {
  data?: any;
}

export default function DebtTimelineChart({ data }: DebtTimelineChartProps) {
  // Basic sparkline-style timeline using div bars for simplicity
  const years: number[] = data?.years || [2019, 2020, 2021, 2022, 2023, 2024];
  const values: number[] = data?.values || [8000, 8600, 9300, 10000, 10800, 11500];
  const max = Math.max(...values);

  return (
    <div>
      <div className='text-sm text-gray-600 mb-3'>Total debt over time (KES Billions)</div>
      <div className='flex items-end gap-2 h-40'>
        {values.map((v, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            className='bg-blue-500 rounded-t'
            style={{ width: 24, height: `${(v / max) * 100}%` }}
            title={`${years[i]}: ${v}B`}
          />
        ))}
      </div>
      <div className='flex justify-between text-xs text-gray-500 mt-2'>
        {years.map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
    </div>
  );
}
