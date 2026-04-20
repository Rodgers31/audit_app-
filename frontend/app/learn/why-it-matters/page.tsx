/**
 * /learn/why-it-matters — Real-world impact stories.
 */
'use client';

import PageShell from '@/components/layout/PageShell';
import WhyThisMatters from '@/components/WhyThisMatters';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WhyItMattersPage() {
  return (
    <PageShell
      title='Why This Matters'
      subtitle='Real stories showing how government finances affect healthcare, education, roads, and everyday life for Kenyans'>
      <Link
        href='/learn'
        className='inline-flex items-center gap-1.5 text-sm font-semibold text-gov-forest hover:underline'>
        <ArrowLeft size={14} />
        Back to Learning Hub
      </Link>
      <WhyThisMatters searchTerm='' />
    </PageShell>
  );
}
