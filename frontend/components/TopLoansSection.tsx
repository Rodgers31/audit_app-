'use client';

import { useNationalDebtOverview, useTopLoans } from '@/lib/react-query';
import { motion } from 'framer-motion';
import { Calendar, ExternalLink, MapPin } from 'lucide-react';

const TOP_LOANS = [
  {
    id: 1,
    lender: 'China Development Bank',
    country: 'China',
    amount: 1850,
    purpose: 'Standard Gauge Railway (SGR)',
    interestRate: 3.6,
    year: 2017,
    flag: '🇨🇳',
    description: 'Financing for the Nairobi-Mombasa railway line',
    status: 'Active',
    maturity: 2037,
  },
  {
    id: 2,
    lender: 'World Bank',
    country: 'International',
    amount: 1200,
    purpose: 'Infrastructure & Development',
    interestRate: 2.1,
    year: 2020,
    flag: '🌍',
    description: 'Roads, energy projects, and social programs',
    status: 'Active',
    maturity: 2045,
  },
  {
    id: 3,
    lender: 'African Development Bank',
    country: 'Regional',
    amount: 890,
    purpose: 'Energy & Water Projects',
    interestRate: 2.8,
    year: 2019,
    flag: '🌍',
    description: 'Power generation and water infrastructure',
    status: 'Active',
    maturity: 2039,
  },
  {
    id: 4,
    lender: 'Japan International Cooperation',
    country: 'Japan',
    amount: 750,
    purpose: 'Port Development',
    interestRate: 1.9,
    year: 2021,
    flag: '🇯🇵',
    description: 'Mombasa Port expansion and modernization',
    status: 'Active',
    maturity: 2051,
  },
  {
    id: 5,
    lender: 'European Investment Bank',
    country: 'Europe',
    amount: 650,
    purpose: 'Renewable Energy',
    interestRate: 2.5,
    year: 2022,
    flag: '🇪🇺',
    description: 'Solar and wind power installations',
    status: 'Active',
    maturity: 2042,
  },
];

export default function TopLoansSection() {
  const { data: topLoansData, isLoading: loansLoading, error: loansError } = useTopLoans(5);
  const {
    data: nationalDebtData,
    isLoading: debtLoading,
    error: debtError,
  } = useNationalDebtOverview();

  // Show loading state
  if (loansLoading || debtLoading) {
    return (
      <div className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded mb-4'></div>
          <div className='space-y-4'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='h-24 bg-gray-200 rounded-xl'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (loansError || debtError) {
    console.error('Error loading loans data:', loansError || debtError);
  }

  // Use API data or fallback to static data
  const loans = topLoansData || TOP_LOANS;
  const totalDebt = nationalDebtData?.total_debt || 11500;
  const totalTopLoans = loans.reduce((sum: number, loan: any) => sum + (loan.amount || 0), 0);

  return (
    <div className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
      <div className='mb-6'>
        <h3 className='text-2xl font-bold text-gray-900 mb-2'>Top 5 Largest Loans</h3>
        <p className='text-gray-600'>
          These loans represent{' '}
          <span className='font-semibold text-blue-600'>
            {((totalTopLoans / totalDebt) * 100).toFixed(1)}%
          </span>{' '}
          of Kenya's total debt (KES {totalTopLoans.toLocaleString()}B out of KES{' '}
          {totalDebt.toLocaleString()}B)
        </p>
      </div>

      <div className='space-y-4'>
        {loans.map((loan: any, index: number) => (
          <motion.div
            key={loan.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className='bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-5 border border-gray-200 hover:shadow-md transition-all duration-300'>
            <div className='flex items-start justify-between mb-3'>
              <div className='flex items-start space-x-4'>
                <div className='text-3xl' suppressHydrationWarning>
                  {loan.flag || '🌍'}
                </div>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-1'>
                    <h4 className='text-lg font-bold text-gray-900'>
                      {loan.lender || loan.creditor}
                    </h4>
                    <span className='px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full'>
                      {loan.status || 'Active'}
                    </span>
                  </div>
                  <div className='flex items-center gap-4 text-sm text-gray-600 mb-2'>
                    <div className='flex items-center gap-1'>
                      <MapPin size={14} />
                      {loan.country || loan.creditor_country || 'International'}
                    </div>
                    <div className='flex items-center gap-1'>
                      <Calendar size={14} />
                      {loan.year || loan.disbursement_year || 'N/A'}
                    </div>
                    <div className='flex items-center gap-1'>
                      <ExternalLink size={14} />
                      Matures {loan.maturity || loan.maturity_year || 'N/A'}
                    </div>
                  </div>
                  <p className='text-gray-700 text-sm mb-3'>
                    {loan.description ||
                      loan.project_description ||
                      loan.purpose ||
                      'Development financing'}
                  </p>

                  <div className='flex items-center justify-between'>
                    <div className='text-sm text-gray-600'>
                      <span className='font-medium'>Purpose:</span>{' '}
                      {loan.purpose || loan.project_type || 'Infrastructure'}
                    </div>
                    <div className='text-sm text-gray-600'>
                      <span className='font-medium'>Rate:</span>{' '}
                      {loan.interestRate || loan.interest_rate || 'N/A'}% p.a.
                    </div>
                  </div>
                </div>
              </div>

              <div className='text-right'>
                <div className='text-2xl font-bold text-blue-600 mb-1'>
                  KES {(loan.amount || 0).toLocaleString()}B
                </div>
                <div className='text-sm text-gray-500'>
                  {((loan.amount / totalTopLoans) * 100).toFixed(1)}% of top 5
                </div>
              </div>
            </div>

            {/* Progress bar showing relative size */}
            <div className='w-full bg-gray-200 rounded-full h-2 mb-2'>
              <div
                className='bg-blue-500 h-2 rounded-full transition-all duration-1000'
                style={{ width: `${(loan.amount / loans[0]?.amount) * 100}%` }}></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Statistics */}
      <div className='mt-6 grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-blue-50 rounded-lg p-4 text-center'>
          <div className='text-xl font-bold text-blue-600 mb-1'>
            {((totalTopLoans / totalDebt) * 100).toFixed(1)}%
          </div>
          <div className='text-sm text-gray-600'>Of total debt</div>
        </div>
        <div className='bg-green-50 rounded-lg p-4 text-center'>
          <div className='text-xl font-bold text-green-600 mb-1'>
            {loans.length > 0
              ? (
                  loans.reduce(
                    (sum: number, loan: any) =>
                      sum + (loan.interestRate || loan.interest_rate || 0),
                    0
                  ) / loans.length
                ).toFixed(1)
              : '0.0'}
            %
          </div>
          <div className='text-sm text-gray-600'>Avg interest rate</div>
        </div>
        <div className='bg-orange-50 rounded-lg p-4 text-center'>
          <div className='text-xl font-bold text-orange-600 mb-1'>
            {loans.length > 0
              ? Math.round(
                  loans.reduce(
                    (sum: number, loan: any) => sum + (loan.maturity || loan.maturity_year || 2030),
                    0
                  ) / loans.length
                )
              : 2030}
          </div>
          <div className='text-sm text-gray-600'>Avg maturity year</div>
        </div>
        <div className='bg-purple-50 rounded-lg p-4 text-center'>
          <div className='text-xl font-bold text-purple-600 mb-1'>{loans.length}</div>
          <div className='text-sm text-gray-600'>Major lenders</div>
        </div>
      </div>
    </div>
  );
}
