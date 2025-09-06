/**
 * CountyHeader - Header section with county name, population, and audit status
 * Displays key county identification and latest audit information
 */
'use client';

import { County } from '@/types';
import { AlertTriangle, Users } from 'lucide-react';
import { formatPopulation, getAuditStatusTextColor } from './countyUtils';

interface CountyHeaderProps {
  county: County;
}

export default function CountyHeader({ county }: CountyHeaderProps) {
  return (
    <div className='flex items-center justify-between mb-6'>
      {/* County Info */}
      <div>
        <h1 className='text-2xl font-semibold text-gray-900 mb-1'>{county.name} County</h1>
        <div className='flex items-center gap-2 text-gray-600'>
          <Users size={16} />
          <span className='text-base'>Population: {formatPopulation(county.population)}</span>
        </div>
      </div>

      {/* Audit Status Badge */}
      <div
        className={`px-4 py-2 rounded-lg border ${
          county.auditStatus === 'clean'
            ? 'bg-green-50 border-green-200'
            : county.auditStatus === 'qualified'
            ? 'bg-yellow-50 border-yellow-200'
            : county.auditStatus === 'adverse'
            ? 'bg-red-50 border-red-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
        <div className='flex items-center gap-2'>
          <AlertTriangle size={16} className={getAuditStatusTextColor(county.auditStatus)} />
          <span
            className={`font-medium text-sm ${
              county.auditStatus === 'clean'
                ? 'text-green-700'
                : county.auditStatus === 'qualified'
                ? 'text-yellow-700'
                : county.auditStatus === 'adverse'
                ? 'text-red-700'
                : 'text-orange-700'
            }`}>
            {county.auditStatus} Audit (2024)
          </span>
        </div>
      </div>
    </div>
  );
}
