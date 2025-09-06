'use client';

import CountySlider from '@/components/county/CountySlider';
import CountyDetails from '@/components/CountyDetails';
import InteractiveKenyaMap from '@/components/InteractiveKenyaMap';
import NationalDebtPanel from '@/components/NationalDebtPanel';
import { useCounties } from '@/lib/react-query';
import { County } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function HomeDashboard() {
  const { data: counties, isLoading: countiesLoading, error: countiesError } = useCounties();
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [currentCountyIndex, setCurrentCountyIndex] = useState(0);
  const [isInteractingWithDetails, setIsInteractingWithDetails] = useState(false);

  const handleCountySelect = (county: County) => {
    setSelectedCounty(county);
  };

  const handleCountyIndexChange = (index: number) => {
    if (counties && index < counties.length) {
      setCurrentCountyIndex(index);
      // Clear selected county when auto-rotating to allow continuous rotation
      if (selectedCounty) {
        setSelectedCounty(null);
      }
    }
  };

  const handleDetailsHoverStart = () => {
    setIsInteractingWithDetails(true);
  };

  const handleDetailsHoverEnd = () => {
    setIsInteractingWithDetails(false);
  };

  // Show loading state
  if (countiesLoading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-lg text-slate-600'>Loading counties data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (countiesError || !counties) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-lg text-red-600 mb-4'>Error loading counties data</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get current county from API data
  const currentCounty =
    selectedCounty || (counties && counties.length > 0 ? counties[currentCountyIndex] : null);

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'>
      {/* Decorative background pattern */}
      <div className='absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none'></div>

      {/* Main Content */}
      <main className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='text-center mb-12'>
          <h1 className='text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4'>
            Kenya Government Transparency Dashboard
          </h1>
          <p className='text-lg text-slate-600 max-w-2xl mx-auto'>
            Explore county-level audit reports, national debt insights, and government financial
            transparency data
          </p>
        </motion.div>
        {/* Main Content Row: National Debt (left) + Map with County Slider stacked (right) */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
          <div className='flex flex-col h-full'>
            <h2 className='text-2xl font-bold text-center bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mb-4'>
              National Debt
            </h2>
            <div className='bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-1 h-full'>
              <NationalDebtPanel className='bg-transparent h-full' />
            </div>
          </div>
          <div className='flex flex-col'>
            <h2 className='text-2xl font-bold text-center bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mb-4'>
              Kenya Counties Financial Map
            </h2>
            <div className='flex flex-col gap-4'>
              <div className='bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-1'>
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
              {/* County Slider below the map */}
              <div className='bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20'>
                <CountySlider
                  counties={counties}
                  currentCountyIndex={currentCountyIndex}
                  onCountyIndexChange={handleCountyIndexChange}
                  onCountySelect={handleCountySelect}
                  className='flex-shrink-0 bg-transparent'
                />
              </div>
            </div>
          </div>
        </div>
        {/* County Details Section - Full Width */}
        {currentCounty && (
          <div className='mb-8'>
            <CountyDetails
              county={currentCounty}
              onHoverStart={handleDetailsHoverStart}
              onHoverEnd={handleDetailsHoverEnd}
              className=''
            />
          </div>
        )}{' '}
        {/* Footer Information */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className='mt-12 text-center'>
          <div className='bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8'>
            <h3 className='text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mb-4'>
              About This Dashboard
            </h3>
            <p className='text-slate-700 max-w-3xl mx-auto text-lg leading-relaxed'>
              This platform provides transparent access to Kenya's government financial data,
              including budget allocations, spending patterns, debt levels, and audit findings. All
              data is sourced from official government reports and updated regularly to ensure
              accuracy.
            </p>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8 mt-8'>
              <div className='text-center p-6 rounded-xl bg-white/30 backdrop-blur-sm border border-white/30'>
                <div className='text-4xl mb-3'>📊</div>
                <div className='font-bold text-blue-600 text-lg'>Real-Time Data</div>
                <div className='text-slate-600 mt-2'>Updated from official sources</div>
              </div>
              <div className='text-center p-6 rounded-xl bg-white/30 backdrop-blur-sm border border-white/30'>
                <div className='text-4xl mb-3'>🔍</div>
                <div className='font-bold text-blue-600 text-lg'>Full Transparency</div>
                <div className='text-slate-600 mt-2'>Complete audit trail & provenance</div>
              </div>
              <div className='text-center p-6 rounded-xl bg-white/30 backdrop-blur-sm border border-white/30'>
                <div className='text-4xl mb-3'>⚡</div>
                <div className='font-bold text-blue-600 text-lg'>Easy to Use</div>
                <div className='text-slate-600 mt-2'>Complex data made simple</div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
