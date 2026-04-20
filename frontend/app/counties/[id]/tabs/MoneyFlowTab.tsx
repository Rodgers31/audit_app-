'use client';

/**
 * MoneyFlowTab — wraps the FollowTheMoney visualization for a specific
 * county + fiscal year. The FollowTheMoney component itself is already
 * a standalone chunk (it pulls in d3/sankey), and by putting it inside
 * a dynamic-imported tab we avoid shipping either until the user clicks
 * "Follow the money".
 */
import FollowTheMoney, { YearSelector } from '@/components/FollowTheMoney';
import { useLang } from '@/lib/i18n/LangProvider';
import { useAvailableFiscalYears } from '@/lib/react-query';
import { useCountyMoneyFlow } from '@/lib/react-query/useMoneyFlow';
import { generateFiscalYears } from '@/lib/utils';
import { CountyComprehensive } from '@/types';
import { useState } from 'react';

const DEFAULT_FISCAL_YEARS = generateFiscalYears();

export default function MoneyFlowTab({ data: countyData }: { data: CountyComprehensive }) {
  const { t } = useLang();
  const [selectedYear, setSelectedYear] = useState(DEFAULT_FISCAL_YEARS[0]);
  const { data: fiscalYears } = useAvailableFiscalYears();
  const { data, isLoading } = useCountyMoneyFlow(countyData.id, selectedYear);

  const years = fiscalYears && fiscalYears.length > 0 ? fiscalYears : DEFAULT_FISCAL_YEARS;

  return (
    <div className='space-y-5'>
      {/* Section header — no nested card, just typography */}
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1'>
        <div>
          <div className='flex items-center gap-2 mb-1'>
            <div className='h-6 w-1 rounded-full bg-gov-forest' />
            <h3 className='text-base font-semibold text-gray-900'>
              {t('county.money.header_prefix')} · {countyData.name}
            </h3>
          </div>
          <p className='text-xs text-gray-500 ml-3'>
            {t('county.money.subtitle')} · {selectedYear}
          </p>
        </div>
        <YearSelector value={selectedYear} onChange={setSelectedYear} years={years} />
      </div>

      {/* The visualization itself renders its own cards — no wrapper */}
      <FollowTheMoney data={data} isLoading={isLoading} />
    </div>
  );
}
