/**
 * Explainer Videos Data
 * Collection of educational videos about government finance and accountability
 * Edit this file to add, update, or modify videos without touching component code
 */

import { BookOpen, Building, Eye, Star, TrendingUp } from 'lucide-react';

export interface ExplainerVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  views: string;
  rating: number;
  thumbnail: string;
  topics: string[];
  keyLearnings: string[];
  transcript: string;
}

export interface VideoCategory {
  id: string;
  label: string;
  icon: any;
}

export const videoCategories: VideoCategory[] = [
  { id: 'popular', label: 'Most Popular', icon: Star },
  { id: 'basics', label: 'Basics', icon: BookOpen },
  { id: 'economics', label: 'Economics', icon: TrendingUp },
  { id: 'accountability', label: 'Accountability', icon: Eye },
  { id: 'governance', label: 'Governance', icon: Building },
];

export const explainerVideos: ExplainerVideo[] = [
  {
    id: 'budget-basics',
    title: 'Budget Basics: How Your County Plans Its Money',
    description:
      'Learn how your county decides where to spend your tax money - from schools to hospitals to roads.',
    duration: '2:15',
    category: 'basics',
    difficulty: 'beginner',
    views: '12.4K',
    rating: 4.8,
    thumbnail: 'budget',
    topics: ['Budget', 'County Government', 'Tax Money'],
    keyLearnings: [
      'How county budgets are created',
      'Where your tax money actually goes',
      'How to read a budget document',
      'Why budget planning takes months',
    ],
    transcript:
      'Imagine your county is like a large household that needs to plan how to spend money for 100,000+ people...',
  },
  {
    id: 'debt-explained',
    title: 'National Debt: Is Kenya Borrowing Too Much?',
    description:
      'A simple explanation of government debt, why countries borrow money, and what it means for you.',
    duration: '2:45',
    category: 'economics',
    difficulty: 'intermediate',
    views: '8.7K',
    rating: 4.6,
    thumbnail: 'debt',
    topics: ['National Debt', 'Government Borrowing', 'Economic Impact'],
    keyLearnings: [
      'Why governments need to borrow money',
      'Good debt vs. bad debt for countries',
      'How debt affects economic growth',
      'What happens if debt gets too high',
    ],
    transcript:
      'Just like families sometimes need loans to buy a house, governments borrow money for big projects...',
  },
  {
    id: 'audit-process',
    title: 'Government Audits: Keeping Leaders Accountable',
    description:
      'How the Auditor-General checks if government spent your money properly and what happens when they find problems.',
    duration: '1:58',
    category: 'accountability',
    difficulty: 'beginner',
    views: '15.2K',
    rating: 4.9,
    thumbnail: 'audit',
    topics: ['Government Audits', 'Accountability', 'Public Money'],
    keyLearnings: [
      'What auditors actually check for',
      'How to read audit reports',
      'What happens when money is misused',
      'Your role in demanding accountability',
    ],
    transcript:
      'Government auditors are like financial detectives who check if public money was spent correctly...',
  },
  {
    id: 'taxes-work',
    title: 'How Your Taxes Work: From Paycheck to Public Services',
    description:
      'Follow your tax money on its journey from your salary to funding schools, hospitals, and roads.',
    duration: '2:30',
    category: 'basics',
    difficulty: 'beginner',
    views: '9.8K',
    rating: 4.7,
    thumbnail: 'taxes',
    topics: ['Taxation', 'Public Services', 'Government Revenue'],
    keyLearnings: [
      'How much tax you actually pay',
      'Where different taxes go',
      'Why taxes are necessary',
      'How to calculate your tax contribution',
    ],
    transcript:
      'Every month, money is deducted from your salary for taxes. But where does it go and what does it buy?...',
  },
  {
    id: 'gdp-growth',
    title: 'GDP Growth: What Does It Really Mean?',
    description:
      'Understand GDP, why economists talk about it, and how it affects your daily life in Kenya.',
    duration: '2:20',
    category: 'economics',
    difficulty: 'intermediate',
    views: '6.3K',
    rating: 4.5,
    thumbnail: 'gdp',
    topics: ['GDP', 'Economic Growth', 'Living Standards'],
    keyLearnings: [
      'What GDP actually measures',
      'Why GDP growth matters to you',
      'Limitations of GDP as a measure',
      "Kenya's economic performance",
    ],
    transcript:
      'GDP is mentioned in every economic report, but what does it actually mean for ordinary Kenyans?...',
  },
  {
    id: 'county-functions',
    title: 'What Your County Government Actually Does',
    description: 'Discover the services your county provides and how devolution works in Kenya.',
    duration: '2:10',
    category: 'governance',
    difficulty: 'beginner',
    views: '11.1K',
    rating: 4.8,
    thumbnail: 'county',
    topics: ['County Government', 'Devolution', 'Public Services'],
    keyLearnings: [
      'Difference between national and county roles',
      'Services your county must provide',
      'How to engage with county government',
      'Why devolution was introduced',
    ],
    transcript:
      'Since 2013, Kenya has had 47 county governments. But what exactly do they do for you?...',
  },
];

/**
 * Helper function to filter videos based on search and category
 */
export const filterVideos = (
  videos: ExplainerVideo[],
  searchTerm: string,
  selectedCategory: string
): ExplainerVideo[] => {
  return videos.filter((video) => {
    const matchesSearch =
      searchTerm === '' ||
      video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.topics.some((topic) => topic.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'popular' ||
      video.category === selectedCategory ||
      (selectedCategory === 'popular' && parseFloat(video.views.replace('K', '')) > 10);

    return matchesSearch && matchesCategory;
  });
};

/**
 * Helper function to get videos by category
 */
export const getVideosByCategory = (
  videos: ExplainerVideo[],
  category: string
): ExplainerVideo[] => {
  return videos.filter((video) => video.category === category);
};

/**
 * Helper function to get videos by difficulty
 */
export const getVideosByDifficulty = (
  videos: ExplainerVideo[],
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): ExplainerVideo[] => {
  return videos.filter((video) => video.difficulty === difficulty);
};
