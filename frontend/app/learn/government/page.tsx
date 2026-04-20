/**
 * /learn/government — Interactive government structure explorer.
 */
'use client';

import PageShell from '@/components/layout/PageShell';
import GovernmentExplorer from '@/components/learn/GovernmentExplorer';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GovernmentPage() {
  return (
    <PageShell
      title='How Kenya Is Governed'
      subtitle='Explore the three arms of government and how power is shared between national and county level under the 2010 Constitution'>
      <Link
        href='/learn'
        className='inline-flex items-center gap-1.5 text-sm font-semibold text-gov-forest hover:underline'>
        <ArrowLeft size={14} />
        Back to Learning Hub
      </Link>
      <GovernmentExplorer />
    </PageShell>
  );
}
