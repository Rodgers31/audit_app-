/**
 * /learn/quiz — Dedicated quiz games page.
 */
'use client';

import PageShell from '@/components/layout/PageShell';
import QuizGame from '@/components/learn/QuizGame';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function QuizPage() {
  return (
    <PageShell
      title='Quiz Games'
      subtitle='Test your knowledge of the Kenyan Constitution, government structure, public finance, devolution, rights, and accountability'>
      <Link
        href='/learn'
        className='inline-flex items-center gap-1.5 text-sm font-semibold text-gov-forest hover:underline'>
        <ArrowLeft size={14} />
        Back to Learning Hub
      </Link>
      <QuizGame />
    </PageShell>
  );
}
