'use client';

import DebtBreakdownChart from '@/components/charts/DebtBreakdownChart';
import DebtFAQSection from '@/components/DebtFAQSection';
import DebtTimelineChart from '@/components/DebtTimelineChart';
import TopLoansSection from '@/components/TopLoansSection';
import { useNationalDebtOverview } from '@/lib/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, Calculator, TrendingUp, Users } from 'lucide-react';

export default function NationalDebtPage() {
  const { data: debtData, isLoading: debtLoading, error: debtError } = useNationalDebtOverview();

  // Show loading state
  if (debtLoading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-lg text-slate-600'>Loading national debt data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (debtError || !debtData) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-lg text-red-600 mb-4'>Error loading national debt data</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract data from API response with better fallback handling
  const apiData = debtData?.data || debtData; // Handle both nested and direct response structures
  const rawCurrentDebt = apiData?.total_debt || apiData?.totalDebt || 11500; // Use API data or fallback

  // Normalize debt to billions for consistent calculations
  const currentDebt = rawCurrentDebt >= 1e12 ? rawCurrentDebt / 1e9 : rawCurrentDebt; // Convert to billions if in trillions
  const population = apiData?.population || 54000000;

  // Handle per capita calculation - ensure proper units
  const debtInKES = currentDebt * 1e9; // Convert billions to actual KES
  const perCapitaDebt =
    apiData?.per_capita_debt || apiData?.perCapitaDebt || debtInKES / population;

  const gdpRatio =
    apiData?.debt_to_gdp_ratio || apiData?.debtToGdpRatio || apiData?.gdp_ratio || 70.2;

  const rawDomesticDebt =
    apiData?.domestic_debt ||
    apiData?.breakdown?.domestic_debt ||
    apiData?.breakdown?.domestic ||
    4600;
  const rawExternalDebt =
    apiData?.external_debt ||
    apiData?.breakdown?.external_debt ||
    apiData?.breakdown?.external ||
    6900;

  // Normalize debt breakdown to billions
  const domesticDebt = rawDomesticDebt >= 1e12 ? rawDomesticDebt / 1e9 : rawDomesticDebt;
  const externalDebt = rawExternalDebt >= 1e12 ? rawExternalDebt / 1e9 : rawExternalDebt;

  console.log('Debt API Data:', {
    apiData,
    currentDebt,
    perCapitaDebt,
    gdpRatio,
    domesticDebt,
    externalDebt,
  });

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'>
      {/* Decorative background pattern */}
      <div className='absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none'></div>

      {/* Main Content */}
      <main className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        {/* Hero Section with Key Stats */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='mb-16'>
          <div className='text-center mb-12'>
            <h1 className='text-5xl font-bold text-gray-900 mb-6'>
              Kenya's National Debt Explained
            </h1>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Breaking down our country's financial obligations in simple, visual terms
            </p>
          </div>

          {/* Key Statistics Cards */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-8 mb-12'>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center'>
                  <TrendingUp className='text-white' size={24} />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-gray-600 uppercase tracking-wide'>
                    Total Debt
                  </h3>
                </div>
              </div>
              <div className='text-3xl font-bold text-red-600 mb-2'>
                KES {(currentDebt / 1000).toFixed(1)}T
              </div>
              <div className='text-sm text-gray-500'>As of December 2024</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center'>
                  <Users className='text-white' size={24} />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-gray-600 uppercase tracking-wide'>
                    Per Citizen
                  </h3>
                </div>
              </div>
              <div className='text-3xl font-bold text-orange-600 mb-2'>
                KES {Math.round(perCapitaDebt / 1000)}K
              </div>
              <div className='text-sm text-gray-500'>
                If divided equally among {(population / 1e6).toFixed(0)}M citizens
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center'>
                  <Calculator className='text-white' size={24} />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-gray-600 uppercase tracking-wide'>
                    Debt-to-GDP
                  </h3>
                </div>
              </div>
              <div className='text-3xl font-bold text-blue-600 mb-2'>{gdpRatio.toFixed(1)}%</div>
              <div className='text-sm text-gray-500'>Of our economic output</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center'>
                  <AlertCircle className='text-white' size={24} />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-gray-600 uppercase tracking-wide'>
                    Risk Level
                  </h3>
                </div>
              </div>
              <div className='text-2xl font-bold text-yellow-600 mb-2'>
                {gdpRatio > 60 ? 'High Risk' : gdpRatio > 40 ? 'Moderate' : 'Low Risk'}
              </div>
              <div className='text-sm text-gray-500'>
                Based on {gdpRatio.toFixed(1)}% debt-to-GDP ratio
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Comparison Block */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className='mb-20'>
          <div className='bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-12 text-white'>
            <div className='text-center'>
              <h3 className='text-3xl font-bold mb-8'>Put Into Perspective</h3>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                <div className='text-center'>
                  <div className='text-4xl mb-3'>🏠</div>
                  <div className='text-lg font-semibold mb-2'>Each Kenyan Household</div>
                  <div className='text-white/80'>
                    owes approximately KES{' '}
                    {Math.round((perCapitaDebt * 4.2) / 1000).toLocaleString()}K
                  </div>
                  <div className='text-xs text-white/60 mt-1'>
                    (Average 4.2 people per household)
                  </div>
                </div>
                <div className='text-center'>
                  <div className='text-4xl mb-3'>�</div>
                  <div className='text-lg font-semibold mb-2'>Per Citizen</div>
                  <div className='text-white/80'>
                    KES {Math.round(perCapitaDebt / 1000).toLocaleString()}K each
                  </div>
                  <div className='text-xs text-white/60 mt-1'>
                    If debt divided equally among {(population / 1e6).toFixed(1)}M citizens
                  </div>
                </div>
                <div className='text-center'>
                  <div className='text-4xl mb-3'>⚖️</div>
                  <div className='text-lg font-semibold mb-2'>Debt Composition</div>
                  <div className='text-white/80'>
                    {currentDebt > 0 ? ((externalDebt / currentDebt) * 100).toFixed(0) : 0}%
                    External,{' '}
                    {currentDebt > 0 ? ((domesticDebt / currentDebt) * 100).toFixed(0) : 0}%
                    Domestic
                  </div>
                  <div className='text-xs text-white/60 mt-1'>
                    KES {externalDebt.toLocaleString()}B vs KES {domesticDebt.toLocaleString()}B
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Charts Section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20'>
          {/* Debt Timeline */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <h3 className='text-2xl font-bold text-gray-900 mb-8'>Debt Growth Over Time</h3>
            <DebtTimelineChart data={debtData} />
          </motion.div>

          {/* Debt Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <h3 className='text-2xl font-bold text-gray-900 mb-8'>Domestic vs External Debt</h3>
            <DebtBreakdownChart
              domesticDebt={domesticDebt}
              externalDebt={externalDebt}
              data={debtData}
            />
          </motion.div>
        </div>

        {/* Top Loans Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className='mb-20'>
          <TopLoansSection />
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className='mb-12'>
          <DebtFAQSection />
        </motion.section>
      </main>
    </div>
  );
}
