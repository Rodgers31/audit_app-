/**
 * Glossary Management Utilities
 * Helper functions for managing glossary terms data
 * Use these functions to easily add, update, or organize terms
 */

import { GlossaryTerm } from './glossaryTerms';

/**
 * Template for creating new glossary terms
 * Copy this template and fill in the details to add new terms
 */
export const termTemplate: Partial<GlossaryTerm> = {
  id: 'unique-term-id',
  term: 'Term Name',
  category: 'finance|planning|spending|accountability|economy',
  icon: 'Calculator', // Import the icon from lucide-react
  color: 'blue|red|orange|green|purple|indigo|emerald|cyan',
  shortDef: 'Brief definition for the card (1 sentence)',
  longDef: 'Detailed explanation that helps people understand the concept (2-3 sentences)',
  examples: ['Real-world example 1', 'Real-world example 2', 'Real-world example 3'],
  animation: 'budget|debt|deficit|audit|revenue|expenditure|gdp|taxation',
};

/**
 * Available categories for terms
 */
export const termCategories = [
  'finance',
  'planning',
  'spending',
  'accountability',
  'economy',
] as const;

/**
 * Available colors for term icons
 */
export const termColors = [
  'blue',
  'red',
  'orange',
  'green',
  'purple',
  'indigo',
  'emerald',
  'cyan',
] as const;

/**
 * Available animation types
 */
export const animationTypes = [
  'budget',
  'debt',
  'deficit',
  'audit',
  'revenue',
  'expenditure',
  'gdp',
  'taxation',
] as const;

/**
 * Validate a term object to ensure it has all required fields
 */
export function validateTerm(term: Partial<GlossaryTerm>): string[] {
  const errors: string[] = [];

  if (!term.id) errors.push('ID is required');
  if (!term.term) errors.push('Term name is required');
  if (!term.category) errors.push('Category is required');
  if (!term.color) errors.push('Color is required');
  if (!term.shortDef) errors.push('Short definition is required');
  if (!term.longDef) errors.push('Long definition is required');
  if (!term.examples || term.examples.length === 0) {
    errors.push('At least one example is required');
  }
  if (!term.animation) errors.push('Animation type is required');

  return errors;
}

/**
 * Instructions for adding new terms
 */
export const addingTermsInstructions = `
HOW TO ADD NEW GLOSSARY TERMS:

1. Open the file: frontend/data/glossaryTerms.ts

2. Copy the term template from glossaryManagement.ts

3. Fill in all the required fields:
   - id: Unique identifier (use lowercase with dashes)
   - term: The exact term or phrase to define
   - category: Choose from available categories
   - icon: Import appropriate icon from lucide-react
   - color: Choose a color that fits the term
   - shortDef: One sentence explanation for the card
   - longDef: 2-3 sentence detailed explanation
   - examples: 3 real-world examples that illustrate the concept
   - animation: Choose animation type (or create new one in TermAnimation.tsx)

4. Add your new term to the glossaryTerms array

5. Import any new icons at the top of the file

EXAMPLE:
{
  id: 'inflation',
  term: 'Inflation',
  category: 'economy',
  icon: TrendingUp,
  color: 'orange',
  shortDef: 'When prices of goods and services increase over time',
  longDef: 'Inflation means things cost more money than they used to. When there is inflation, the same amount of money buys less than before.',
  examples: [
    'Bread that cost KES 50 last year now costs KES 55',
    'Inflation of 5% means prices increase by 5% per year',
    'Your salary buys less if it doesn\\'t increase with inflation',
  ],
  animation: 'gdp',
}

The terms will automatically appear in the component without any code changes!

ADDING NEW ANIMATIONS:
If you want a new animation type, edit TermAnimation.tsx and add a new case to the switch statement.
`;

export default addingTermsInstructions;
