/**
 * /learn/glossary — Plain-English index of government finance terms.
 */
'use client';

import InteractiveGlossary from '@/components/InteractiveGlossary';
import PageShell from '@/components/layout/PageShell';
import { glossaryTerms, GLOSSARY_CATEGORIES } from '@/data/glossaryTerms';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function GlossaryPage() {
  const termCount = glossaryTerms.length;
  const themeCount = GLOSSARY_CATEGORIES.length - 1;

  return (
    <PageShell
      title='Plain-English glossary'
      subtitle='Every budget, audit and finance term on this site, translated into language that actually makes sense — with real examples and links to the Constitution.'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Link
          href='/learn'
          className='inline-flex items-center gap-1.5 text-sm font-semibold text-gov-forest hover:underline'>
          <ArrowLeft size={14} />
          Back to Learning Hub
        </Link>
        <div className='flex items-center gap-4 text-[12.5px] text-neutral-muted'>
          <span>
            <strong className='text-gov-dark'>{termCount}</strong> terms
          </span>
          <span className='text-neutral-border'>·</span>
          <span>
            <strong className='text-gov-dark'>{themeCount}</strong> themes
          </span>
          <span className='text-neutral-border'>·</span>
          <span>Linked to the Constitution</span>
        </div>
      </div>

      <InteractiveGlossary />
    </PageShell>
  );
}
