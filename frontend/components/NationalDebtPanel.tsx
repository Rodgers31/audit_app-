'use client';

import { useNationalDebtOverview } from '@/lib/react-query';
import { formatCurrency, formatPercentage, getDebtRiskColor, getDebtRiskLevel } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import CircularProgress from './CircularProgress';
import DataIntegrityBanner from './DataIntegrityBanner';
import Tooltip from './Tooltip';

interface NationalDebtPanelProps {
  className?: string;
}

export default function NationalDebtPanel({ className = '' }: NationalDebtPanelProps) {
  const { data: nationalDebtData, isLoading, error } = useNationalDebtOverview();
  const [tooltipData, setTooltipData] = useState<{
    content: string;
    position: { x: number; y: number };
    visible: boolean;
  }>({
    content: '',
    position: { x: 0, y: 0 },
    visible: false,
  });

  // Handle loading and error states
  if (error) {
    console.error('Error loading national debt data:', error);
  }

  // Use API data — no fabricated fallback values
  const debtData = nationalDebtData?.data || nationalDebtData || null;

  // If the backend returned no data (and we're not loading), show integrity banner
  if (!isLoading && !debtData) {
    return (
      <div className={`card ${className}`}>
        <DataIntegrityBanner
          message="National debt data is currently unavailable from the backend. No figures are displayed to avoid showing unverified numbers."
          severity="warning"
        />
      </div>
    );
  }

  if (!debtData) {
    // Still loading — handled by the skeleton below
    return null;
  }

  const handleTooltipShow = (event: React.MouseEvent, content: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipData({
      content,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      },
      visible: true,
    });
  };

  const handleTooltipHide = () => {
    setTooltipData((prev) => ({ ...prev, visible: false }));
  };

  const debtToGdpRatio = debtData.debt_to_gdp_ratio ?? null;
  const hasGdpRatio = debtToGdpRatio != null && !isNaN(debtToGdpRatio);
  const riskColor = hasGdpRatio ? getDebtRiskColor(debtToGdpRatio) : 'text-gray-400';
  const riskLevel = hasGdpRatio ? getDebtRiskLevel(debtToGdpRatio) : 'Unknown';

  // Derived metrics — null means "data not available", distinct from actual zero
  const domestic = debtData.debt_breakdown?.domestic_debt ?? null;
  const external = debtData.debt_breakdown?.external_debt ?? null;
  const totalDebt = debtData.total_debt ?? null;
  const domesticPct: number | null =
    debtData.debt_breakdown?.domestic_percentage ??
    (domestic != null && totalDebt ? (domestic / totalDebt) * 100 : null);
  const externalPct: number | null =
    debtData.debt_breakdown?.external_percentage ??
    (external != null && totalDebt ? (external / totalDebt) * 100 : null);
  const dsr: number | null = debtData.debt_sustainability?.debt_service_ratio ?? null;

  // Helper: format or show N/A
  const fmtOrNA = (val: number | null, formatter: (v: number) => string): string =>
    val != null ? formatter(val) : 'N/A';

  // Rotating facts for the "What this means" section
  const rotatingFacts = [
    hasGdpRatio
      ? `Debt-to-GDP is ${debtToGdpRatio!.toFixed(1)}% (${riskLevel} risk). Target is below 60%.`
      : 'Debt-to-GDP ratio is not yet available.',
    domesticPct != null && externalPct != null
      ? `Domestic vs External composition: ${domesticPct.toFixed(1)}% / ${externalPct.toFixed(1)}%.`
      : 'Debt composition breakdown unavailable.',
    dsr != null && dsr > 0
      ? `Estimated debt service ratio: ${dsr.toFixed(1)}% of revenue.`
      : 'Debt service ratio data unavailable.',
    domestic != null || external != null
      ? `Domestic debt: ${fmtOrNA(domestic, formatCurrency)}; External debt: ${fmtOrNA(external, formatCurrency)}.`
      : 'Debt breakdown by type unavailable.',
    dsr != null && dsr > 0
      ? `${dsr.toFixed(1)} cents of every KES 1 goes to servicing debt.`
      : 'Debt service cost per shilling unavailable.',
    hasGdpRatio
      ? `${Math.max(0, debtToGdpRatio! - 60).toFixed(1)} percentage points above 60% threshold.`
      : 'Cannot compute threshold gap without debt-to-GDP data.',
  ];
  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIndex((i) => (i + 1) % rotatingFacts.length), 15000);
    return () => clearInterval(id);
  }, [rotatingFacts.length]);

  if (isLoading) {
    return (
      <div className={`card ${className}`}>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded mb-4'></div>
          <div className='h-16 bg-gray-200 rounded mb-6'></div>
          <div className='h-4 bg-gray-200 rounded mb-2'></div>
          <div className='h-20 bg-gray-200 rounded'></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`card flex flex-col ${className}`}
        style={{ height: '100%' }}>
        <div className='mb-6'>
          <p className='text-sm text-gray-600'>
            Kenya's total government debt as of {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className='space-y-6 flex-1'>
          {/* Main Debt Figure */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className='text-center'>
            <div className='number-large text-primary-600 mb-2'>
              {totalDebt != null ? formatCurrency(totalDebt) : 'N/A'}
            </div>
            <p className='text-gray-600'>Total National Debt</p>
          </motion.div>

          {/* Circular Debt to GDP Gauge */}
          <div className='flex flex-col items-center space-y-4'>
            {hasGdpRatio ? (
            <CircularProgress
              percentage={debtToGdpRatio!}
              size={180}
              strokeWidth={16}
              color={debtToGdpRatio! < 40 ? '#10B981' : debtToGdpRatio! < 60 ? '#F59E0B' : '#EF4444'}
              backgroundColor='#E5E7EB'
              className='mb-2'>
              <div className='text-center'>
                <div className={`text-3xl font-bold ${riskColor}`}>
                  {formatPercentage(debtToGdpRatio!)}
                </div>
                <div className='text-sm text-gray-600'>of GDP</div>
                <div
                  className={`text-xs px-2 py-1 rounded-full mt-1 ${riskColor
                    .replace('text-', 'bg-')
                    .replace('-600', '-100')} ${riskColor}`}>
                  {riskLevel}
                </div>
              </div>
            </CircularProgress>
            ) : (
              <div className='flex items-center justify-center w-[180px] h-[180px] rounded-full border-[16px] border-gray-200 mb-2'>
                <div className='text-center'>
                  <div className='text-2xl font-bold text-gray-400'>N/A</div>
                  <div className='text-sm text-gray-400'>of GDP</div>
                </div>
              </div>
            )}

            {/* Risk threshold indicators */}
            <div className='flex justify-center gap-4 text-xs text-gray-500'>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded-full bg-green-500'></div>
                <span>&lt;40% Safe</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded-full bg-yellow-500'></div>
                <span>40-60% Caution</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded-full bg-red-500'></div>
                <span>&gt;60% Risk</span>
              </div>
            </div>
          </div>

          {/* Debt Service Impact */}
          {dsr != null && dsr > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.3 }}
              className='bg-orange-50 p-4 rounded-lg border border-orange-200'>
              <div className='text-center'>
                <div className='text-2xl font-bold text-orange-600 mb-2'>
                  KES {dsr!.toFixed(1)} cents
                </div>
                <div className='text-sm text-orange-700 mb-1'>
                  of every tax shilling goes to debt service
                </div>
                <div className='text-xs text-orange-600'>
                  Debt service ratio: {formatPercentage(dsr!)}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className='bg-gray-50 p-4 rounded-lg border border-gray-200 text-center text-sm text-gray-500'>
              Debt service data not yet available from backend.
            </div>
          )}

          {/* Compact Debt Breakdown */}
          {(domestic != null || external != null) ? (
          <div className='grid grid-cols-2 gap-3'>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.3 }}
              className='text-center p-3 bg-blue-50 rounded-lg'>
              <div className='text-lg font-bold text-blue-600 mb-1'>
                {fmtOrNA(domestic, formatCurrency)}
              </div>
              <div className='text-xs text-blue-700'>Domestic Debt</div>
              <div className='text-xs text-blue-600 mt-1'>
                {fmtOrNA(domesticPct, formatPercentage)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 0.3 }}
              className='text-center p-3 bg-purple-50 rounded-lg'>
              <div className='text-lg font-bold text-purple-600 mb-1'>
                {fmtOrNA(external, formatCurrency)}
              </div>
              <div className='text-xs text-purple-700'>External Debt</div>
              <div className='text-xs text-purple-600 mt-1'>
                {fmtOrNA(externalPct, formatPercentage)}
              </div>
            </motion.div>
          </div>
          ) : (
            <div className='text-center text-sm text-gray-400 py-3'>
              Debt composition breakdown not available.
            </div>
          )}

          {/* Key metrics aligned far left and far right */}
          <div className='flex justify-between gap-3'>
            <div className='rounded-lg border bg-white/60 p-3 text-center'>
              <div className='text-xs text-gray-600'>Debt Service Ratio</div>
              <div className='text-lg font-bold text-gray-800'>
                {dsr != null ? formatPercentage(dsr) : 'N/A'}
              </div>
            </div>
            <div className='rounded-lg border bg-white/60 p-3 text-center ml-auto'>
              <div className='text-xs text-gray-600'>Domestic vs External</div>
              <div className='text-lg font-bold text-gray-800'>
                {fmtOrNA(domesticPct, formatPercentage)}
                <span className='text-sm text-gray-500'> / </span>
                {fmtOrNA(externalPct, formatPercentage)}
              </div>
            </div>
          </div>

          {/* Explanation Note with rotating facts, expands to fill available space */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className='bg-gray-50 p-4 rounded-lg border-l-4 border-primary-500 flex-1 flex items-start'>
            <div>
              <div className='text-sm font-semibold text-gray-800 mb-2'>What this means</div>
              <ul className='list-disc list-inside space-y-1 text-sm text-gray-700'>
                <li>
                  Kenya's debt is at{' '}
                  <span className={riskColor}>{formatPercentage(debtToGdpRatio)}</span> of GDP (
                  {riskLevel.toLowerCase()} risk).
                </li>
                <li>{rotatingFacts[factIndex]}</li>
                <li>{rotatingFacts[(factIndex + 1) % rotatingFacts.length]}</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <Tooltip
        content={tooltipData.content}
        position={tooltipData.position}
        visible={tooltipData.visible}
      />
    </>
  );
}
