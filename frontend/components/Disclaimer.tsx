'use client';

import { AlertTriangle } from 'lucide-react';

export default function Disclaimer() {
  return (
    <div className='bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6'>
      <div className='flex'>
        <div className='flex-shrink-0'>
          <AlertTriangle className='h-5 w-5 text-yellow-400' aria-hidden='true' />
        </div>
        <div className='ml-3'>
          <h3 className='text-sm font-medium text-yellow-800'>Important Disclaimer</h3>
          <div className='mt-2 text-sm text-yellow-700'>
            <p className='mb-2'>
              <strong>Unofficial Platform</strong>: This is an independent, unofficial platform
              aggregating publicly available government financial data.
            </p>
            <p className='mb-2'>
              <strong>Verify All Data</strong>: While we strive for accuracy, data may contain
              errors. Always verify critical information with official sources:
            </p>
            <ul className='list-disc list-inside ml-4 space-y-1'>
              <li>
                <a
                  href='https://treasury.go.ke'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline hover:text-yellow-900'>
                  National Treasury
                </a>
              </li>
              <li>
                <a
                  href='https://oagkenya.go.ke'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline hover:text-yellow-900'>
                  Office of the Auditor General
                </a>
              </li>
              <li>
                <a
                  href='https://cob.go.ke'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline hover:text-yellow-900'>
                  Controller of Budget
                </a>
              </li>
            </ul>
            <p className='mt-2'>
              Data displayed is for informational purposes only and does not constitute official
              government records or audit opinions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
