'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, FileText, XCircle } from 'lucide-react';

interface AuditStatusFilterProps {
  selectedStatus: 'all' | 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';
  onStatusChange: (
    status: 'all' | 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'pending'
  ) => void;
  statusCounts: {
    clean: number;
    qualified: number;
    adverse: number;
    disclaimer: number;
    pending: number;
  };
}

export default function AuditStatusFilter({
  selectedStatus,
  onStatusChange,
  statusCounts,
}: AuditStatusFilterProps) {
  const filters = [
    {
      id: 'all' as const,
      label: 'All Counties',
      icon: FileText,
      color: 'gray',
      count: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      description: 'Show all audit reports',
    },
    {
      id: 'clean' as const,
      label: 'Clean Reports',
      icon: CheckCircle,
      color: 'green',
      count: statusCounts.clean,
      description: '🟢 No major issues found',
    },
    {
      id: 'qualified' as const,
      label: 'Some Concerns',
      icon: AlertTriangle,
      color: 'yellow',
      count: statusCounts.qualified,
      description: '🟡 Minor issues to address',
    },
    {
      id: 'adverse' as const,
      label: 'Major Issues',
      icon: XCircle,
      color: 'red',
      count: statusCounts.adverse,
      description: '🔴 Serious problems found',
    },
    {
      id: 'disclaimer' as const,
      label: 'Critical Problems',
      icon: XCircle,
      color: 'red',
      count: statusCounts.disclaimer,
      description: '⛔ Unable to audit properly',
    },
    {
      id: 'pending' as const,
      label: 'Pending',
      icon: Clock,
      color: 'gray',
      count: statusCounts.pending,
      description: '⏳ Audit in progress',
    },
  ];

  const getFilterClasses = (color: string, isSelected: boolean, count: number) => {
    const baseClasses =
      'relative p-3 rounded-xl border transition-all duration-200 cursor-pointer text-left';
    const disabledClasses = count === 0 ? 'opacity-50 cursor-not-allowed' : '';

    if (isSelected) {
      switch (color) {
        case 'green':
          return `${baseClasses} bg-green-100 border-green-300 text-green-800 shadow-lg scale-105 ${disabledClasses}`;
        case 'yellow':
          return `${baseClasses} bg-yellow-100 border-yellow-300 text-yellow-800 shadow-lg scale-105 ${disabledClasses}`;
        case 'red':
          return `${baseClasses} bg-red-100 border-red-300 text-red-800 shadow-lg scale-105 ${disabledClasses}`;
        case 'gray':
          return `${baseClasses} bg-gray-100 border-gray-300 text-gray-800 shadow-lg scale-105 ${disabledClasses}`;
        default:
          return `${baseClasses} bg-blue-100 border-blue-300 text-blue-800 shadow-lg scale-105 ${disabledClasses}`;
      }
    } else {
      switch (color) {
        case 'green':
          return `${baseClasses} bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 ${disabledClasses}`;
        case 'yellow':
          return `${baseClasses} bg-white border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-300 ${disabledClasses}`;
        case 'red':
          return `${baseClasses} bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 ${disabledClasses}`;
        case 'gray':
          return `${baseClasses} bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 ${disabledClasses}`;
        default:
          return `${baseClasses} bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 ${disabledClasses}`;
      }
    }
  };

  return (
    <div>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>Filter by Audit Status</h3>

      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'>
        {filters.map((filter, index) => {
          const Icon = filter.icon;
          const isSelected = selectedStatus === filter.id;
          const isDisabled = filter.count === 0;

          return (
            <motion.button
              key={filter.id}
              onClick={() => !isDisabled && onStatusChange(filter.id)}
              className={getFilterClasses(filter.color, isSelected, filter.count)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={!isDisabled ? { scale: 1.02 } : {}}
              whileTap={!isDisabled ? { scale: 0.98 } : {}}
              disabled={isDisabled}>
              <div className='flex items-center gap-2 mb-2'>
                <Icon size={18} />
                <span className='font-medium text-sm'>{filter.label}</span>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-2xl font-bold'>{filter.count}</span>
                <span className='text-xs opacity-75'>
                  {filter.count === 1 ? 'county' : 'counties'}
                </span>
              </div>

              <div className='text-xs mt-1 opacity-75'>{filter.description}</div>

              {/* Selection Indicator */}
              {isSelected && (
                <motion.div
                  layoutId='selectedAuditFilter'
                  className='absolute inset-0 border-2 border-blue-400 rounded-xl pointer-events-none'
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Summary */}
      <div className='mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200'>
        <div className='flex items-center justify-between text-sm'>
          <span className='text-blue-700'>
            Showing{' '}
            <span className='font-semibold'>
              {selectedStatus === 'all'
                ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                : statusCounts[selectedStatus as keyof typeof statusCounts]}
            </span>{' '}
            of{' '}
            <span className='font-semibold'>
              {Object.values(statusCounts).reduce((a, b) => a + b, 0)}
            </span>{' '}
            counties
          </span>
          {selectedStatus !== 'all' && (
            <button
              onClick={() => onStatusChange('all')}
              className='text-blue-600 hover:text-blue-800 font-medium'>
              Clear filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
