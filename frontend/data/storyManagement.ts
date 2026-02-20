/**
 * Story Management Utilities
 * Helper functions for managing real-life stories data
 * Use these functions to easily add, update, or organize stories
 */

import { RealLifeStory } from './realLifeStories';

/**
 * Template for creating new stories
 * Copy this template and fill in the details to add new stories
 */
export const storyTemplate: Partial<RealLifeStory> = {
  id: 'unique-story-id',
  title: 'Story Title',
  category: 'health|education|infrastructure|employment|other',
  icon: 'Heart', // Import the icon from lucide-react
  color: 'red|blue|green|orange|purple|yellow',
  impact: 'High', // High|Medium|Low
  timeToRead: '2 min',
  summary: 'Brief summary of the story (1-2 sentences)',
  story: 'Full story describing what happened (2-3 paragraphs)',
  consequences: ['List of real consequences', 'Each consequence should be specific and measurable'],
  whatChanged: 'Description of what changed after the issue was exposed',
  yourRole: 'How citizens can monitor this type of issue',
  personalConnection: 'Why this matters to ordinary citizens',
};

/**
 * Categories used for organizing stories
 */
export const storyCategories = [
  'health',
  'education',
  'infrastructure',
  'employment',
  'environment',
  'security',
  'water',
  'agriculture',
] as const;

/**
 * Available colors for story icons
 */
export const storyColors = [
  'red',
  'blue',
  'green',
  'orange',
  'purple',
  'yellow',
  'pink',
  'indigo',
] as const;

/**
 * Validate a story object to ensure it has all required fields
 */
export function validateStory(story: Partial<RealLifeStory>): string[] {
  const errors: string[] = [];

  if (!story.id) errors.push('ID is required');
  if (!story.title) errors.push('Title is required');
  if (!story.category) errors.push('Category is required');
  if (!story.summary) errors.push('Summary is required');
  if (!story.story) errors.push('Story content is required');
  if (!story.consequences || story.consequences.length === 0) {
    errors.push('At least one consequence is required');
  }
  if (!story.whatChanged) errors.push('What changed description is required');
  if (!story.yourRole) errors.push('Your role description is required');
  if (!story.personalConnection) errors.push('Personal connection is required');

  return errors;
}

/**
 * Instructions for adding new stories
 */
export const addingStoriesInstructions = `
HOW TO ADD NEW STORIES:

1. Open the file: frontend/data/realLifeStories.ts

2. Copy the story template from storyManagement.ts

3. Fill in all the required fields:
   - id: Unique identifier (use lowercase with dashes)
   - title: Compelling headline
   - category: Choose from available categories
   - icon: Import appropriate icon from lucide-react
   - color: Choose a color that fits the story theme
   - impact: High for severe consequences, Medium for moderate, Low for minor
   - timeToRead: Estimate based on story length
   - summary: One-line description for the card
   - story: Full narrative (2-3 paragraphs)
   - consequences: List specific, measurable impacts
   - whatChanged: Resolution or current status
   - yourRole: How citizens can prevent similar issues
   - personalConnection: Why readers should care

4. Add your new story to the realLifeStories array

5. Import any new icons at the top of the file

EXAMPLE:
{
  id: 'water-crisis',
  title: 'The Borehole That Never Worked',
  category: 'water',
  icon: Droplets,
  color: 'blue',
  impact: 'High',
  timeToRead: '3 min',
  summary: 'How KES 15 million was spent on a borehole that never produced water',
  story: 'Community members...',
  consequences: ['Continued water scarcity', 'Children missing school to fetch water'],
  whatChanged: 'After protests, a new contractor was hired and water is now flowing',
  yourRole: 'Check if water projects actually provide water to the community',
  personalConnection: 'Clean water access affects every aspect of family life',
}

The stories will automatically appear in the component without any code changes!
`;

export default addingStoriesInstructions;
