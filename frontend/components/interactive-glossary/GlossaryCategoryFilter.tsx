/**
 * GlossaryCategoryFilter - Category selection component for filtering glossary terms
 * Displays available categories with term counts and handles selection state
 */
'use client';

import { motion } from 'framer-motion';
import { GlossaryCategory } from '../../data/glossaryTerms';

interface GlossaryCategoryFilterProps {
  categories: GlossaryCategory[];
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
}

export default function GlossaryCategoryFilter({
  categories,
  selectedCategory,
  onCategorySelect,
}: GlossaryCategoryFilterProps) {
  return (
    <div className='mb-8'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>Browse by Category</h3>
      <div className='flex flex-wrap gap-3'>
        {categories.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => onCategorySelect(category.id)}
            className={`px-4 py-2 rounded-xl border transition-all duration-200 ${
              selectedCategory === category.id
                ? 'bg-blue-100 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}>
            {category.label} ({category.count})
          </motion.button>
        ))}
      </div>
    </div>
  );
}
