'use client';

import { motion } from 'framer-motion';

const DEBT_TIMELINE_DATA = [
  { year: 2015, debt: 3200 },
  { year: 2016, debt: 3800 },
  { year: 2017, debt: 4500 },
  { year: 2018, debt: 5200 },
  { year: 2019, debt: 6100 },
  { year: 2020, debt: 7400 },
  { year: 2021, debt: 8500 },
  { year: 2022, debt: 9300 },
  { year: 2023, debt: 10100 },
  { year: 2024, debt: 10800 },
];

export default function DebtTimelineChart() {
  const maxDebt = Math.max(...DEBT_TIMELINE_DATA.map((item) => item.debt));

  return (
    <div className='h-80 w-full'>
      <div className='mb-4'>
        <p className='text-gray-600 text-sm'>
          Kenya's debt has grown dramatically over the past decade, increasing by over
          <span className='font-semibold text-red-600'> 237%</span> since 2015.
        </p>
      </div>

      {/* Custom Line Chart */}
      <div className='relative h-64 bg-gradient-to-t from-red-50 to-transparent rounded-lg p-4'>
        <svg className='w-full h-full' viewBox='0 0 400 200' preserveAspectRatio='none'>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1='0'
              y1={i * 50}
              x2='400'
              y2={i * 50}
              stroke='#e5e7eb'
              strokeWidth='1'
              strokeDasharray='5,5'
            />
          ))}

          {/* Data line */}
          <motion.polyline
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
            fill='none'
            stroke='#ef4444'
            strokeWidth='3'
            strokeLinecap='round'
            strokeLinejoin='round'
            points={DEBT_TIMELINE_DATA.map((item, index) => {
              const x = (index / (DEBT_TIMELINE_DATA.length - 1)) * 400;
              const y = 200 - (item.debt / maxDebt) * 180;
              return `${x},${y}`;
            }).join(' ')}
          />

          {/* Data points */}
          {DEBT_TIMELINE_DATA.map((item, index) => {
            const x = (index / (DEBT_TIMELINE_DATA.length - 1)) * 400;
            const y = 200 - (item.debt / maxDebt) * 180;
            return (
              <motion.circle
                key={index}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                cx={x}
                cy={y}
                r='4'
                fill='#ef4444'
                stroke='white'
                strokeWidth='2'
                className='hover:r-6 transition-all cursor-pointer'
              />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className='flex justify-between mt-2 px-2'>
          {DEBT_TIMELINE_DATA.map((item, index) => (
            <div key={index} className='text-xs text-gray-500 font-medium'>
              {item.year}
            </div>
          ))}
        </div>

        {/* Y-axis labels */}
        <div className='absolute left-0 top-0 h-full flex flex-col justify-between py-4'>
          {[maxDebt, maxDebt * 0.75, maxDebt * 0.5, maxDebt * 0.25, 0].map((value, index) => (
            <div key={index} className='text-xs text-gray-500 font-medium -ml-12'>
              {value.toLocaleString()}B
            </div>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className='mt-4 grid grid-cols-3 gap-4 text-center'>
        <div className='bg-red-50 rounded-lg p-3'>
          <div className='text-lg font-bold text-red-600'>
            +
            {(
              (DEBT_TIMELINE_DATA[DEBT_TIMELINE_DATA.length - 1].debt / DEBT_TIMELINE_DATA[0].debt -
                1) *
              100
            ).toFixed(0)}
            %
          </div>
          <div className='text-xs text-gray-600'>Growth since 2015</div>
        </div>
        <div className='bg-orange-50 rounded-lg p-3'>
          <div className='text-lg font-bold text-orange-600'>
            KES{' '}
            {(
              DEBT_TIMELINE_DATA[DEBT_TIMELINE_DATA.length - 1].debt -
              DEBT_TIMELINE_DATA[DEBT_TIMELINE_DATA.length - 2].debt
            ).toLocaleString()}
            B
          </div>
          <div className='text-xs text-gray-600'>Added in 2024</div>
        </div>
        <div className='bg-blue-50 rounded-lg p-3'>
          <div className='text-lg font-bold text-blue-600'>
            KES{' '}
            {(
              DEBT_TIMELINE_DATA.reduce(
                (sum, item, index) =>
                  index > 0 ? sum + (item.debt - DEBT_TIMELINE_DATA[index - 1].debt) : sum,
                0
              ) /
              (DEBT_TIMELINE_DATA.length - 1)
            ).toFixed(0)}
            B
          </div>
          <div className='text-xs text-gray-600'>Avg annual growth</div>
        </div>
      </div>
    </div>
  );
}
