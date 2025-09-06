/**
 * WhyThisMatters - Main component explaining the real-world impact of government finance
 * Refactored into modular components for better maintainability
 * Stories data extracted to separate file for easy editing
 */
'use client';

import { Heart } from 'lucide-react';
import { realLifeStories } from '../data/realLifeStories';
import ActionSteps from './why-this-matters/ActionSteps';
import ImpactCategories from './why-this-matters/ImpactCategories';
import StoriesGrid from './why-this-matters/StoriesGrid';

interface WhyThisMattersProps {
  searchTerm: string;
}

export default function WhyThisMatters({ searchTerm }: WhyThisMattersProps) {
  return (
    <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
      {/* Page Header */}
      <div className='flex items-center gap-3 mb-8'>
        <Heart size={32} className='text-red-600' />
        <h2 className='text-3xl font-bold text-gray-900'>Why This Matters</h2>
      </div>

      {/* Introduction Section */}
      <div className='bg-gradient-to-r from-blue-50 to-red-50 rounded-2xl p-6 mb-8'>
        <h3 className='text-xl font-bold text-gray-900 mb-4'>Your Money, Your Life</h3>
        <p className='text-gray-700 leading-relaxed'>
          Government budgets aren't just numbers on paper – they're decisions about your life. Every
          shilling spent (or misspent) affects whether you have good schools, functioning hospitals,
          clean water, and safe roads. When you understand how government finance works, you can
          demand better services and hold leaders accountable.
        </p>
      </div>

      {/* Real Life Stories Section */}
      <StoriesGrid stories={realLifeStories} searchTerm={searchTerm} />

      {/* Impact Categories Section */}
      <ImpactCategories />

      {/* Action Steps Section */}
      <ActionSteps />
    </div>
  );
}
