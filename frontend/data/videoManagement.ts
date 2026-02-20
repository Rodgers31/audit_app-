/**
 * Video Management Utilities
 * Helper functions for managing explainer videos data
 * Use these functions to easily add, update, or organize videos
 */

import { ExplainerVideo } from './explainerVideos';

/**
 * Template for creating new videos
 * Copy this template and fill in the details to add new videos
 */
export const videoTemplate: Partial<ExplainerVideo> = {
  id: 'unique-video-id',
  title: 'Video Title',
  description: 'Brief description of what the video covers (1-2 sentences)',
  duration: '2:30',
  category: 'basics|economics|accountability|governance',
  difficulty: 'beginner', // beginner|intermediate|advanced
  views: '0',
  rating: 4.5,
  thumbnail: 'budget', // budget|debt|audit|taxes|gdp|county
  topics: ['Topic 1', 'Topic 2', 'Topic 3'],
  keyLearnings: [
    'What viewers will learn (point 1)',
    'What viewers will learn (point 2)',
    'What viewers will learn (point 3)',
    'What viewers will learn (point 4)',
  ],
  transcript: 'Video transcript or summary of content...',
};

/**
 * Available video categories
 */
export const videoCategories = ['basics', 'economics', 'accountability', 'governance'] as const;

/**
 * Available difficulty levels
 */
export const difficultyLevels = ['beginner', 'intermediate', 'advanced'] as const;

/**
 * Available thumbnail types
 */
export const thumbnailTypes = ['budget', 'debt', 'audit', 'taxes', 'gdp', 'county'] as const;

/**
 * Validate a video object to ensure it has all required fields
 */
export function validateVideo(video: Partial<ExplainerVideo>): string[] {
  const errors: string[] = [];

  if (!video.id) errors.push('ID is required');
  if (!video.title) errors.push('Title is required');
  if (!video.description) errors.push('Description is required');
  if (!video.duration) errors.push('Duration is required');
  if (!video.category) errors.push('Category is required');
  if (!video.difficulty) errors.push('Difficulty level is required');
  if (!video.thumbnail) errors.push('Thumbnail type is required');
  if (!video.topics || video.topics.length === 0) {
    errors.push('At least one topic is required');
  }
  if (!video.keyLearnings || video.keyLearnings.length === 0) {
    errors.push('At least one key learning is required');
  }

  return errors;
}

/**
 * Instructions for adding new videos
 */
export const addingVideosInstructions = `
HOW TO ADD NEW VIDEOS:

1. Open the file: frontend/data/explainerVideos.ts

2. Copy the video template from videoManagement.ts

3. Fill in all the required fields:
   - id: Unique identifier (use lowercase with dashes)
   - title: Descriptive title that explains what the video covers
   - description: 1-2 sentence summary for the video card
   - duration: Video length in MM:SS format
   - category: Choose from: basics, economics, accountability, governance
   - difficulty: beginner, intermediate, or advanced
   - views: Current view count (can start with '0')
   - rating: Average rating out of 5
   - thumbnail: Choose from available thumbnail types
   - topics: Array of 2-4 main topics covered
   - keyLearnings: 3-5 bullet points of what viewers will learn
   - transcript: Full transcript or detailed summary

4. Add your new video to the explainerVideos array

5. The video will automatically appear in the component!

EXAMPLE:
{
  id: 'procurement-basics',
  title: 'Government Procurement: How Contracts Are Awarded',
  description: 'Understanding how government decides who gets contracts for projects and supplies.',
  duration: '3:15',
  category: 'accountability',
  difficulty: 'intermediate',
  views: '2.1K',
  rating: 4.3,
  thumbnail: 'audit',
  topics: ['Procurement', 'Contracts', 'Transparency', 'Competition'],
  keyLearnings: [
    'How government procurement process works',
    'Why competitive bidding is important',
    'Red flags in contract awards',
    'How citizens can monitor procurement',
  ],
  transcript: 'When government needs to buy something or hire someone for a project...',
}

The videos will automatically appear in the component without any code changes!
`;

export default addingVideosInstructions;
