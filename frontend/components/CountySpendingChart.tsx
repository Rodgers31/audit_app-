'use client';

import { County } from '@/types';
import { motion } from 'framer-motion';
import { BookOpen, Hammer, Heart, Shield, Users, Zap } from 'lucide-react';

interface CountySpendingChartProps {
  county: County;
}

export default function CountySpendingChart({ county }: CountySpendingChartProps) {
  // Calculate spending categories based on county budget
  const totalBudget = county.budget ?? county.totalBudget ?? 0;

  // Estimated spending breakdown (in real scenario, this would come from data)
  const spendingCategories = [
    {
      name: 'Education',
      amount: totalBudget * 0.3, // 30% typically goes to education
      color: '#3b82f6',
      icon: BookOpen,
    },
    {
      name: 'Health',
      amount: totalBudget * 0.25, // 25% to health
      color: '#ef4444',
      icon: Heart,
    },
    {
      name: 'Infrastructure',
      amount: totalBudget * 0.2, // 20% to infrastructure
      color: '#f59e0b',
      icon: Hammer,
    },
    {
      name: 'Social Services',
      amount: totalBudget * 0.15, // 15% to social services
      color: '#10b981',
      icon: Users,
    },
    {
      name: 'Security',
      amount: totalBudget * 0.06, // 6% to security
      color: '#8b5cf6',
      icon: Shield,
    },
    {
      name: 'Utilities',
      amount: totalBudget * 0.04, // 4% to utilities
      color: '#06b6d4',
      icon: Zap,
    },
  ];

  const maxAmount = Math.max(...spendingCategories.map((cat) => cat.amount));

  const formatAmount = (amount: number) => {
    return `KES ${(amount / 1e9).toFixed(1)}B`;
  };

  const formatPercentage = (amount: number) => {
    return totalBudget > 0 ? `${((amount / totalBudget) * 100).toFixed(1)}%` : '0%';
  };

  return (
    <div className='space-y-6'>
      {/* Summary */}
      <div className='bg-gray-50 rounded-xl p-4'>
        <h4 className='text-lg font-semibold text-gray-900 mb-2'>Budget Breakdown</h4>
        <p className='text-sm text-gray-600'>
          Total Annual Budget: <span className='font-semibold'>{formatAmount(totalBudget)}</span>
        </p>
      </div>

      {/* Bar Chart */}
      <div className='space-y-4'>
        {spendingCategories.map((category, index) => {
          const Icon = category.icon;
          const percentage = (category.amount / maxAmount) * 100;

          return (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className='space-y-2'>
              {/* Category Header */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div
                    className='w-8 h-8 rounded-lg flex items-center justify-center'
                    style={{ backgroundColor: `${category.color}20` }}>
                    <Icon size={16} style={{ color: category.color }} />
                  </div>
                  <span className='font-medium text-gray-900'>{category.name}</span>
                </div>
                <div className='text-right'>
                  <div className='font-semibold text-gray-900'>{formatAmount(category.amount)}</div>
                  <div className='text-sm text-gray-500'>{formatPercentage(category.amount)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className='relative'>
                <div className='w-full bg-gray-200 rounded-full h-3'>
                  <motion.div
                    className='h-3 rounded-full'
                    style={{ backgroundColor: category.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Additional Insights */}
      <div className='bg-blue-50 rounded-xl p-4 border border-blue-200'>
        <h5 className='font-semibold text-blue-900 mb-2'>Spending Insights</h5>
        <ul className='text-sm text-blue-800 space-y-1'>
          <li>• Education and Health combined account for 55% of total spending</li>
          <li>• Infrastructure spending represents 20% of the budget</li>
          <li>• Budget utilization rate: {county.budgetUtilization}%</li>
        </ul>
      </div>
    </div>
  );
}
