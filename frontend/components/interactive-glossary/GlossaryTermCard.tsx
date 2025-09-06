/**
 * GlossaryTermCard - Individual term card component with expandable details
 * Displays term information and handles expansion state
 */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GlossaryTerm } from '../../data/glossaryTerms';
import TermAnimation from './TermAnimation';

interface GlossaryTermCardProps {
  term: GlossaryTerm;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}

export default function GlossaryTermCard({
  term,
  index,
  isSelected,
  onToggle,
}: GlossaryTermCardProps) {
  const Icon = term.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      layout>
      {/* Term Card */}
      <motion.button
        onClick={onToggle}
        className={`w-full p-6 rounded-2xl border text-left transition-all duration-300 ${
          isSelected
            ? `bg-${term.color}-50 border-${term.color}-300 shadow-lg`
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}>
        {/* Header */}
        <div className='flex items-start gap-4 mb-4'>
          <div
            className={`w-12 h-12 rounded-xl bg-${term.color}-100 flex items-center justify-center flex-shrink-0`}>
            <Icon size={24} className={`text-${term.color}-600`} />
          </div>
          <div className='flex-1 min-w-0'>
            <h3 className='text-lg font-bold text-gray-900 mb-1'>{term.term}</h3>
            <p className='text-sm text-gray-600'>{term.shortDef}</p>
          </div>
        </div>

        {/* Animation Preview */}
        <div className='mb-4'>
          <TermAnimation animation={term.animation} color={term.color} />
        </div>

        {/* Category Badge */}
        <div
          className={`text-xs font-medium px-3 py-1 rounded-full inline-block ${
            isSelected ? `bg-${term.color}-200 text-${term.color}-800` : 'bg-gray-100 text-gray-600'
          }`}>
          {term.category.charAt(0).toUpperCase() + term.category.slice(1)}
        </div>
      </motion.button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className='overflow-hidden'>
            <div className={`p-6 rounded-2xl border bg-${term.color}-50 border-${term.color}-200`}>
              {/* Detailed Explanation */}
              <h4 className='text-lg font-semibold text-gray-900 mb-4'>Detailed Explanation</h4>
              <p className='text-gray-700 leading-relaxed mb-6'>{term.longDef}</p>

              {/* Examples */}
              <h5 className='font-semibold text-gray-900 mb-3'>Real Examples:</h5>
              <ul className='space-y-2'>
                {term.examples.map((example, i) => (
                  <li key={i} className='flex items-start gap-2 text-gray-700'>
                    <span className={`text-${term.color}-500 mt-1`}>•</span>
                    <span className='text-sm'>{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
