/**
 * GlossaryTermsGrid - Grid layout for displaying glossary terms
 * Manages term display and handles empty states
 */
'use client';

import { Search } from 'lucide-react';
import { GlossaryTerm } from '../../data/glossaryTerms';
import GlossaryTermCard from './GlossaryTermCard';

interface GlossaryTermsGridProps {
  terms: GlossaryTerm[];
  selectedTerm: string | null;
  onTermSelect: (termId: string | null) => void;
}

export default function GlossaryTermsGrid({
  terms,
  selectedTerm,
  onTermSelect,
}: GlossaryTermsGridProps) {
  return (
    <>
      {/* Terms Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {terms.map((term, index) => (
          <GlossaryTermCard
            key={term.id}
            term={term}
            index={index}
            isSelected={selectedTerm === term.id}
            onToggle={() => onTermSelect(selectedTerm === term.id ? null : term.id)}
          />
        ))}
      </div>

      {/* No Results */}
      {terms.length === 0 && (
        <div className='text-center py-12'>
          <Search size={48} className='text-gray-300 mx-auto mb-4' />
          <h3 className='text-xl font-semibold text-gray-600 mb-2'>No terms found</h3>
          <p className='text-gray-500'>Try adjusting your search or category filter</p>
        </div>
      )}
    </>
  );
}
