'use client';

import CountyQuickSelect from '@/components/county/CountyQuickSelect';
import CountyDebtChart from '@/components/CountyDebtChart';
import CountySpendingChart from '@/components/CountySpendingChart';
import InteractiveKenyaMap from '@/components/InteractiveKenyaMap';
import TransparencyModal from '@/components/TransparencyModal';
import { useCounties } from '@/lib/react-query';
import { County } from '@/types';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, DollarSign, Eye, TrendingUp, Users, XCircle } from 'lucide-react';
import React, { useState } from 'react';

export default function CountyExplorerPage() {
  const { data: counties, isLoading: countiesLoading, error: countiesError } = useCounties();
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [currentCountyIndex, setCurrentCountyIndex] = useState(0);
  const [isInteractingWithDetails, setIsInteractingWithDetails] = useState(false);

  const handleCountySelect = (county: County) => {
    console.log('County selected:', county);
    setSelectedCounty(county);
  };

  const handleCountyIndexChange = (index: number) => {
    if (counties && index < counties.length) {
      setCurrentCountyIndex(index);
      // Clear selection to allow auto-rotation like on Home
      if (selectedCounty) setSelectedCounty(null);
    }
  };

  // Debug: Log counties data when it changes
  React.useEffect(() => {
    if (counties) {
      console.log('Counties loaded:', counties.length, 'counties');
      console.log('First county:', counties[0]);
      console.log(
        'Sample audit statuses:',
        counties.slice(0, 5).map((c) => ({
          name: c.name,
          auditStatus: c.auditStatus,
          budget: c.totalBudget || c.budget,
        }))
      );
    }
  }, [counties]);

  // Show loading state
  if (countiesLoading) {
    return (
      <div className='page-wrapper flex items-center justify-center'>
        <main className='w-full max-w-md mx-auto px-6 py-12 text-center bg-white rounded-2xl shadow-soft border border-border'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-brand-700 mx-auto mb-6'></div>
          <p className='text-lg text-gray-500'>Loading counties data...</p>
        </main>
      </div>
    );
  }

  // Show error state
  if (countiesError || !counties) {
    return (
      <div className='page-wrapper flex items-center justify-center'>
        <main className='w-full max-w-md mx-auto px-6 py-12 text-center bg-white rounded-2xl shadow-soft border border-border'>
          <p className='text-lg text-risk mb-6'>Error loading counties data</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-brand-700 text-white rounded-xl hover:bg-brand-900'>
            Retry
          </button>
        </main>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `KES ${(amount / 1e9).toFixed(1)}B`;
  };

  const formatPopulation = (pop: number) => {
    return `${(pop / 1e6).toFixed(1)}M`;
  };

  return (
    <div className='page-wrapper'>
      {/* Main Content */}
      <main className='page-content'>
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='page-header text-center mb-12'>
          <h1 className='text-4xl font-bold text-brand-900 mb-4'>County Explorer</h1>
          <p className='text-lg text-gray-500 max-w-3xl mx-auto'>
            Explore detailed financial information and audit status for each county
          </p>
        </motion.div>

        {/* Map Selector */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className='mb-12'>
          <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6 text-center'>
              Select a County to Explore
            </h2>
            <div className='bg-white/60 backdrop-blur-lg rounded-2xl border border-white/20 p-1'>
              <InteractiveKenyaMap
                counties={counties}
                onCountySelect={handleCountySelect}
                selectedCounty={selectedCounty}
                currentCountyIndex={currentCountyIndex}
                onCountyIndexChange={handleCountyIndexChange}
                isInteractingWithDetails={isInteractingWithDetails}
                className='bg-transparent'
              />
            </div>
            {/* Quick Selector below map, same UX as before */}
            <CountyQuickSelect
              counties={counties}
              selectedCounty={selectedCounty}
              onCountySelect={handleCountySelect}
            />
          </div>
        </motion.section>

        {/* County Details */}
        {selectedCounty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='space-y-8'>
            {/* County Header */}
            <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
                {/* County Name & Basic Info */}
                <div className='md:col-span-2'>
                  <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                    {selectedCounty.name} County
                  </h2>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-3'>
                      <Users className='text-brand-700' size={20} />
                      <span className='text-gray-700'>
                        Population:{' '}
                        <span className='font-semibold'>
                          {formatPopulation(selectedCounty.population)}
                        </span>
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <DollarSign className='text-green-600' size={20} />
                      <span className='text-gray-700'>
                        Annual Budget:{' '}
                        <span className='font-semibold'>
                          {formatCurrency(selectedCounty.totalBudget ?? selectedCounty.budget ?? 0)}
                        </span>
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <Calendar className='text-purple-600' size={20} />
                      <span className='text-gray-700'>
                        Governor:{' '}
                        <span className='font-semibold'>
                          {selectedCounty.governor || 'Not Available'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Status */}
                <div className='md:col-span-2'>
                  <div className='bg-brand-50 rounded-2xl p-6'>
                    <div className='flex items-center justify-between mb-4'>
                      <h3 className='text-lg font-semibold text-gray-900'>Audit Status</h3>
                      <button
                        onClick={() => setIsAuditModalOpen(true)}
                        className='flex items-center gap-2 px-3 py-2 bg-brand-700 text-white text-sm font-medium rounded-xl hover:bg-brand-900 transition-colors'>
                        <Eye size={16} />
                        Transparency Report
                      </button>
                    </div>
                    <div className='flex items-center gap-3 mb-3'>
                      {(selectedCounty.auditStatus || 'pending') === 'clean' ? (
                        <CheckCircle className='text-green-600' size={24} />
                      ) : (
                        <XCircle className='text-red-600' size={24} />
                      )}
                      <span className='font-semibold'>
                        Auditor-General's Report:{' '}
                        {(selectedCounty.auditStatus || 'pending') === 'clean'
                          ? '✅ Available'
                          : '❌ Issues Found'}
                      </span>
                    </div>
                    <p className='text-sm text-gray-600'>
                      {(selectedCounty.auditStatus || 'pending') === 'clean'
                        ? 'Latest audit report shows clean opinion with full compliance.'
                        : `Audit status: ${
                            selectedCounty.auditStatus || 'pending'
                          }. Review required for compliance.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizations Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
              {/* Spending Categories */}
              <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
                <h3 className='text-2xl font-bold text-gray-900 mb-6'>Spending by Category</h3>
                <CountySpendingChart county={selectedCounty} />
              </div>

              {/* Debt Composition */}
              <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
                <h3 className='text-2xl font-bold text-gray-900 mb-6'>Debt Composition</h3>
                <CountyDebtChart county={selectedCounty} />
              </div>
            </div>

            {/* Insights Box */}
            <div className='bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-200'>
              <div className='flex items-start gap-4'>
                <div className='bg-green-100 rounded-full p-3'>
                  <TrendingUp className='text-green-700' size={24} />
                </div>
                <div>
                  <h3 className='text-xl font-bold text-green-900 mb-3'>Key Insights</h3>
                  <div className='space-y-2'>
                    <p className='text-green-800'>
                      • Health spending increased by <span className='font-semibold'>12%</span>{' '}
                      compared to last year
                    </p>
                    <p className='text-green-800'>
                      • Education receives the largest budget allocation at{' '}
                      <span className='font-semibold'>
                        {selectedCounty.education
                          ? (
                              (selectedCounty.education /
                                (selectedCounty.totalBudget ?? selectedCounty.budget ?? 1)) *
                              100
                            ).toFixed(1) + '%'
                          : '30%'}
                      </span>
                    </p>
                    <p className='text-green-800'>
                      • Infrastructure development accounts for{' '}
                      <span className='font-semibold'>
                        {selectedCounty.infrastructure
                          ? (
                              (selectedCounty.infrastructure /
                                (selectedCounty.totalBudget ?? selectedCounty.budget ?? 1)) *
                              100
                            ).toFixed(1) + '%'
                          : '20%'}
                      </span>{' '}
                      of total budget
                    </p>
                    <p className='text-green-800'>
                      • Debt-to-revenue ratio is{' '}
                      <span className='font-semibold'>
                        {(
                          ((selectedCounty.totalDebt ?? selectedCounty.debt ?? 0) /
                            (selectedCounty.totalBudget ?? selectedCounty.budget ?? 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!selectedCounty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className='text-center py-16'>
            <div className='text-6xl mb-4'>🗺️</div>
            <h3 className='text-2xl font-bold text-gray-700 mb-2'>
              Click on a county to explore its details
            </h3>
            <p className='text-gray-600'>
              Select any county on the map above to view detailed financial information and audit
              status
            </p>
          </motion.div>
        )}
      </main>

      {/* Transparency Modal */}
      {selectedCounty && (
        <TransparencyModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          county={selectedCounty}
        />
      )}
    </div>
  );
}
