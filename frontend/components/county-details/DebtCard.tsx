/**
 * DebtCard - Debt information card showing outstanding obligations
 * Displays county debt amount and debt-to-revenue ratio
 */
'use client';

import { formatPercentage } from '@/lib/utils';
import { TrendingDown } from 'lucide-react';

interface DebtCardProps {
  debt: number;
  debtRatio: number;
}

export default function DebtCard({ debt, debtRatio }: DebtCardProps) {
  return (
    <div className='bg-orange-50 border border-orange-200 rounded-2xl p-5'>
      {/* Header */}
      <div className='flex items-start gap-3 mb-3'>
        <div className='w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center'>
          <TrendingDown className='text-white' size={24} />
        </div>
        <div className='flex-1'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-orange-600 text-lg'>📊</span>
            <span className='text-orange-700 font-semibold text-sm tracking-wide'>DEBT</span>
          </div>
        </div>
      </div>

      {/* Debt Amount */}
      <div className='text-3xl font-bold text-orange-800 mb-2'>KES {(debt / 1e9).toFixed(2)}B</div>
      <div className='text-orange-600 font-medium mb-1'>Outstanding obligations</div>

      {/* Debt Ratio */}
      <div className='text-sm text-orange-700 font-medium'>
        {formatPercentage(debtRatio)} of annual revenue
      </div>
    </div>
  );
}
