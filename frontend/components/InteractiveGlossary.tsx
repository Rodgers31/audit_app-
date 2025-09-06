/**
 * InteractiveGlossary - Main component for government finance glossary
 * Refactored into modular components for better maintainability
 * Glossary terms data extracted to separate file for easy editing
 */
'use client';

import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { filterTerms, generateCategories, glossaryTerms } from '../data/glossaryTerms';
import GlossaryCategoryFilter from './interactive-glossary/GlossaryCategoryFilter';
import GlossaryTermsGrid from './interactive-glossary/GlossaryTermsGrid';

interface InteractiveGlossaryProps {
  searchTerm: string;
}

export default function InteractiveGlossary({ searchTerm }: InteractiveGlossaryProps) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Generate categories with current counts
  const categories = generateCategories(glossaryTerms);

  // Filter terms based on search and category
  const filteredTerms = filterTerms(glossaryTerms, searchTerm, categoryFilter);

  return (
    <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
      {/* Page Header */}
      <div className='flex items-center gap-3 mb-8'>
        <BookOpen size={32} className='text-blue-600' />
        <h2 className='text-3xl font-bold text-gray-900'>Interactive Glossary</h2>
      </div>

      {/* Category Filter */}
      <GlossaryCategoryFilter
        categories={categories}
        selectedCategory={categoryFilter}
        onCategorySelect={setCategoryFilter}
      />

      {/* Terms Grid */}
      <GlossaryTermsGrid
        terms={filteredTerms}
        selectedTerm={selectedTerm}
        onTermSelect={setSelectedTerm}
      />
    </div>
  );
}
