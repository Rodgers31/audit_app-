/**
 * MapTooltip - Displays detailed county information on hover
 * Handles mouse events for persistent tooltip visibility
 */
'use client';

import { County } from '@/types';
import { motion } from 'framer-motion';

interface MapTooltipProps {
  county: County;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCountyClick: (county: County) => void;
}

export default function MapTooltip({
  county,
  onMouseEnter,
  onMouseLeave,
  onCountyClick,
}: MapTooltipProps) {
  // Format currency values for display
  const formatKES = (amount: number | undefined): string => {
    if (!amount || amount === 0) return 'KES 0';
    if (amount >= 1e9) return `KES ${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `KES ${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `KES ${(amount / 1e3).toFixed(0)}K`;
    return `KES ${amount}`;
  };

  // Get background gradient based on audit status
  const getStatusGradient = (auditStatus: string) => {
    switch (auditStatus) {
      case 'clean':
        return 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300';
      case 'qualified':
        return 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-300';
      case 'adverse':
        return 'bg-gradient-to-br from-red-50 to-rose-100 border-red-300';
      default:
        return 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300';
    }
  };

  // Get status badge colors
  const getStatusBadge = (auditStatus: string) => {
    switch (auditStatus) {
      case 'clean':
        return 'bg-green-200 text-green-900';
      case 'qualified':
        return 'bg-yellow-200 text-yellow-900';
      case 'adverse':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-orange-200 text-orange-900';
    }
  };

  // Get utilization rate color coding
  const getUtilizationColor = (utilization: number) => {
    if (utilization > 85) return 'text-green-700 bg-green-500';
    if (utilization > 70) return 'text-yellow-700 bg-yellow-500';
    return 'text-red-700 bg-red-500';
  };

  const utilizationRate = county.budgetUtilization || 0;
  const debtRatio =
    county.budget && county.budget > 0 ? ((county.debt || 0) / county.budget) * 100 : 0;
  const missingFunds = (county.budget || 0) - (county.moneyReceived || 0);
  const auditIssuesCount = county.auditIssues?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className='absolute z-50 top-1/4 left-1/2 transform -translate-x-1/2'>
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`relative rounded-xl shadow-2xl border-2 p-4 w-72 max-w-sm backdrop-blur-sm cursor-pointer ${getStatusGradient(
          county.auditStatus
        )}`}
        onClick={() => onCountyClick(county)}>
        {/* Invisible hover area for easier mouse movement */}
        <div
          className='absolute -inset-4 z-0'
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />

        {/* Header */}
        <div className='flex items-center justify-between mb-3 pb-2 border-b border-white/50'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>{county.name}</h3>
            <p className='text-xs text-gray-600'>County Overview</p>
          </div>
          <div className='flex flex-col items-end'>
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusBadge(
                county.auditStatus || 'pending'
              )}`}>
              {county.auditStatus || 'pending'}
            </span>
            <div className='text-xs text-gray-500 mt-1'>
              {county.lastAuditDate ? new Date(county.lastAuditDate).getFullYear() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className='grid grid-cols-2 gap-3 mb-3'>
          {/* Budget Utilization */}
          <div className='bg-white/70 rounded-lg p-2 border border-white/50'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-xs font-medium text-blue-700'>Budget Use</span>
              <span
                className={`text-sm font-bold ${
                  getUtilizationColor(utilizationRate).split(' ')[0]
                }`}>
                {utilizationRate.toFixed(0)}%
              </span>
            </div>
            <div className='w-full bg-white/80 rounded-full h-1.5'>
              <div
                className={`h-1.5 rounded-full ${
                  getUtilizationColor(utilizationRate).split(' ')[1]
                }`}
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Debt Ratio */}
          <div className='bg-white/70 rounded-lg p-2 border border-white/50'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-xs font-medium text-red-700'>Debt Ratio</span>
              <span className='text-sm font-bold text-red-800'>{debtRatio.toFixed(1)}%</span>
            </div>
            <div className='text-xs text-red-700'>{formatKES(county.debt)}</div>
          </div>
        </div>

        {/* Financial Alerts */}
        <div className='space-y-1.5'>
          {/* Missing Funds Alert */}
          {missingFunds > 0 && (
            <div className='flex items-center justify-between bg-white/60 rounded-md p-2 border border-white/40'>
              <div className='flex items-center'>
                <div className='w-1.5 h-1.5 bg-orange-600 rounded-full mr-2' />
                <span className='text-xs font-medium text-orange-800'>Funding Gap</span>
              </div>
              <span className='text-xs font-bold text-orange-700'>{formatKES(missingFunds)}</span>
            </div>
          )}

          {/* Audit Issues Alert */}
          {auditIssuesCount > 0 && (
            <div className='flex items-center justify-between bg-white/60 rounded-md p-2 border border-white/40'>
              <div className='flex items-center'>
                <div className='w-1.5 h-1.5 bg-amber-600 rounded-full mr-2' />
                <span className='text-xs font-medium text-amber-800'>Audit Issues</span>
              </div>
              <span className='text-xs font-bold text-amber-700'>{auditIssuesCount} found</span>
            </div>
          )}

          {/* Pending Bills Alert */}
          {county.pendingBills && county.pendingBills > 0 && (
            <div className='flex items-center justify-between bg-white/60 rounded-md p-2 border border-white/40'>
              <div className='flex items-center'>
                <div className='w-1.5 h-1.5 bg-purple-600 rounded-full mr-2' />
                <span className='text-xs font-medium text-purple-800'>Pending Bills</span>
              </div>
              <span className='text-xs font-bold text-purple-700'>
                {formatKES(county.pendingBills)}
              </span>
            </div>
          )}
        </div>

        {/* Action Hint */}
        <div className='mt-3 pt-2 border-t border-white/50 text-center'>
          <p className='text-xs text-gray-600'>Click to view detailed analysis</p>
        </div>
      </div>
    </motion.div>
  );
}
