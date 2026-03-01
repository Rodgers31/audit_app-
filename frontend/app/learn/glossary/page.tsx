/**
 * /learn/glossary — Key government finance terms explained.
 */
'use client';

import InteractiveGlossary from '@/components/InteractiveGlossary';
import PageShell from '@/components/layout/PageShell';
import { useState } from 'react';

export default function GlossaryPage() {
  const [search, setSearch] = useState('');

  return (
    <PageShell
      title='Key Terms Explained'
      subtitle='Master essential government finance vocabulary with clear, jargon-free definitions and real-world examples'>
      <div className='mb-4 max-w-md'>
        <input
          type='text'
          placeholder='Search terms…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='w-full rounded-xl border border-neutral-border bg-white/60 backdrop-blur px-4 py-2.5 text-sm placeholder:text-neutral-muted focus:outline-none focus:ring-2 focus:ring-gov-sage/40 transition-shadow'
        />
      </div>
      <InteractiveGlossary searchTerm={search} />
    </PageShell>
  );
}
