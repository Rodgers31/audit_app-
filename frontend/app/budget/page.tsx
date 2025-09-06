'use client';

import BudgetAllocationChart from '@/components/BudgetAllocationChart';
import BudgetComparisonFilter from '@/components/BudgetComparisonFilter';
import BudgetGlossary from '@/components/BudgetGlossary';
import { motion } from 'framer-motion';
import { BookOpen, Building, Car, Hammer, Heart, Shield } from 'lucide-react';
import { useState } from 'react';

export default function BudgetSpendingPage() {
  const [selectedYear, setSelectedYear] = useState<'2023' | '2024' | 'comparison'>('2024');

  // Budget data for different years
  const budgetData = {
    2023: {
      total: 3280000000000, // 3.28 trillion KES
      allocations: [
        {
          sector: 'Education',
          amount: 656000000000,
          percentage: 20,
          icon: BookOpen,
          color: '#3b82f6',
        },
        { sector: 'Health', amount: 492000000000, percentage: 15, icon: Heart, color: '#ef4444' },
        {
          sector: 'Infrastructure',
          amount: 459200000000,
          percentage: 14,
          icon: Hammer,
          color: '#f59e0b',
        },
        {
          sector: 'Security & Defense',
          amount: 393600000000,
          percentage: 12,
          icon: Shield,
          color: '#8b5cf6',
        },
        { sector: 'Agriculture', amount: 295200000000, percentage: 9, icon: Car, color: '#10b981' },
        {
          sector: 'Public Administration',
          amount: 984000000000,
          percentage: 30,
          icon: Building,
          color: '#6b7280',
        },
      ],
    },
    2024: {
      total: 3700000000000, // 3.7 trillion KES
      allocations: [
        {
          sector: 'Education',
          amount: 777000000000,
          percentage: 21,
          icon: BookOpen,
          color: '#3b82f6',
        },
        { sector: 'Health', amount: 555000000000, percentage: 15, icon: Heart, color: '#ef4444' },
        {
          sector: 'Infrastructure',
          amount: 592000000000,
          percentage: 16,
          icon: Hammer,
          color: '#f59e0b',
        },
        {
          sector: 'Security & Defense',
          amount: 444000000000,
          percentage: 12,
          icon: Shield,
          color: '#8b5cf6',
        },
        { sector: 'Agriculture', amount: 333000000000, percentage: 9, icon: Car, color: '#10b981' },
        {
          sector: 'Public Administration',
          amount: 999000000000,
          percentage: 27,
          icon: Building,
          color: '#6b7280',
        },
      ],
    },
  };

  const currentData = budgetData[selectedYear === 'comparison' ? '2024' : selectedYear];
  const comparisonData = selectedYear === 'comparison' ? budgetData['2023'] : null;

  const formatCurrency = (amount: number) => {
    return `KES ${(amount / 1e12).toFixed(2)}T`;
  };

  const getTopAllocations = () => {
    return currentData.allocations.sort((a, b) => b.amount - a.amount).slice(0, 3);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'>
      {/* Decorative background pattern */}
      <div className='absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none'></div>

      {/* Main Content */}
      <main className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='text-center mb-12'>
          <h1 className='text-5xl font-bold text-gray-900 mb-6'>Kenya's Budget & Spending</h1>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Understanding how your tax money is allocated across different sectors
          </p>
        </motion.div>

        {/* Year Filter */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className='mb-12'>
          <BudgetComparisonFilter
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            budgetData={budgetData}
          />
        </motion.section>

        {/* Simple Explanation Blocks */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className='mb-16'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            {getTopAllocations().map((allocation, index) => {
              const Icon = allocation.icon;
              const explanations = [
                "Most money goes to education - investing in our children's future and building human capital.",
                'Healthcare receives significant funding to ensure quality medical services for all Kenyans.',
                'Infrastructure development connects communities and drives economic growth across the country.',
              ];

              return (
                <motion.div
                  key={allocation.sector}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.6 }}
                  className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
                  <div className='flex items-center gap-4 mb-4'>
                    <div
                      className='w-16 h-16 rounded-2xl flex items-center justify-center'
                      style={{ backgroundColor: `${allocation.color}20` }}>
                      <Icon size={32} style={{ color: allocation.color }} />
                    </div>
                    <div>
                      <h3 className='text-xl font-bold text-gray-900'>#{index + 1}</h3>
                      <p className='text-sm text-gray-600'>Priority Sector</p>
                    </div>
                  </div>

                  <h4 className='text-2xl font-bold text-gray-900 mb-2'>{allocation.sector}</h4>

                  <div className='mb-4'>
                    <div className='text-3xl font-bold mb-1' style={{ color: allocation.color }}>
                      {formatCurrency(allocation.amount)}
                    </div>
                    <div className='text-sm text-gray-600'>
                      {allocation.percentage}% of total budget
                    </div>
                  </div>

                  <p className='text-gray-700 leading-relaxed'>{explanations[index]}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Budget Allocation Chart */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className='mb-16'>
          <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <div className='flex items-center justify-between mb-8'>
              <h2 className='text-3xl font-bold text-gray-900'>Budget Allocation by Sector</h2>
              <div className='text-right'>
                <div className='text-2xl font-bold text-gray-900'>
                  {formatCurrency(currentData.total)}
                </div>
                <div className='text-sm text-gray-600'>
                  Total Budget {selectedYear === 'comparison' ? '2024' : selectedYear}
                </div>
              </div>
            </div>

            <BudgetAllocationChart
              data={currentData}
              comparisonData={comparisonData}
              showComparison={selectedYear === 'comparison'}
            />
          </div>
        </motion.section>

        {/* Budget Insights with Glossary */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className='mb-16'>
          <div className='bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8 border border-indigo-200'>
            <h3 className='text-2xl font-bold text-indigo-900 mb-6'>Understanding the Budget</h3>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='space-y-4'>
                <h4 className='text-xl font-semibold text-indigo-800 mb-4'>Key Facts</h4>
                <div className='space-y-3'>
                  <p className='text-indigo-700'>
                    •{' '}
                    <BudgetGlossary term='Recurrent Expenditure'>
                      Recurrent expenditure
                    </BudgetGlossary>{' '}
                    accounts for about 70% of the total budget
                  </p>
                  <p className='text-indigo-700'>
                    •{' '}
                    <BudgetGlossary term='Development Budget'>Development spending</BudgetGlossary>{' '}
                    focuses on long-term infrastructure projects
                  </p>
                  <p className='text-indigo-700'>
                    • Education consistently receives the largest allocation across all sectors
                  </p>
                  <p className='text-indigo-700'>
                    • <BudgetGlossary term='Conditional Grants'>County allocations</BudgetGlossary>{' '}
                    ensure devolved governance funding
                  </p>
                </div>
              </div>

              <div className='space-y-4'>
                <h4 className='text-xl font-semibold text-indigo-800 mb-4'>Budget Changes</h4>
                <div className='space-y-3'>
                  <p className='text-indigo-700'>
                    • Total budget increased by{' '}
                    {(
                      ((budgetData['2024'].total - budgetData['2023'].total) /
                        budgetData['2023'].total) *
                      100
                    ).toFixed(1)}
                    % from 2023 to 2024
                  </p>
                  <p className='text-indigo-700'>
                    • Infrastructure spending saw the largest percentage increase
                  </p>
                  <p className='text-indigo-700'>
                    • Education maintains its position as the top priority sector
                  </p>
                  <p className='text-indigo-700'>
                    • Healthcare allocation remains stable at 15% of total budget
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Budget Breakdown Summary */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className='mb-12'>
          <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <h3 className='text-2xl font-bold text-gray-900 mb-6'>Where Every Shilling Goes</h3>

            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
              {currentData.allocations.map((allocation) => {
                const Icon = allocation.icon;

                return (
                  <div key={allocation.sector} className='text-center p-4 rounded-2xl bg-gray-50'>
                    <div
                      className='w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3'
                      style={{ backgroundColor: `${allocation.color}20` }}>
                      <Icon size={24} style={{ color: allocation.color }} />
                    </div>
                    <h4 className='font-semibold text-gray-900 text-sm mb-1'>
                      {allocation.sector}
                    </h4>
                    <div className='text-2xl font-bold mb-1' style={{ color: allocation.color }}>
                      {allocation.percentage}%
                    </div>
                    <div className='text-xs text-gray-600'>{formatCurrency(allocation.amount)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
