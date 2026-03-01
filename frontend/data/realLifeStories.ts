/**
 * Real Life Stories Data
 * Composite narratives inspired by real Auditor-General findings across multiple counties.
 * Names and locations are illustrative — not specific allegations against any individual or county.
 * Edit this file to add, update, or modify stories without touching component code
 */

import { Building2, GraduationCap, Heart, Users } from 'lucide-react';

export interface RealLifeStory {
  id: string;
  title: string;
  category: string;
  icon: any;
  color: string;
  impact: 'High' | 'Medium' | 'Low';
  timeToRead: string;
  summary: string;
  story: string;
  consequences: string[];
  whatChanged: string;
  yourRole: string;
  personalConnection: string;
}

export const realLifeStories: RealLifeStory[] = [
  {
    id: 'healthcare',
    title: 'When Hospital Equipment Goes Missing',
    category: 'health',
    icon: Heart,
    color: 'red',
    impact: 'High',
    timeToRead: '2 min',
    summary: 'How missing audit trails led to a county hospital having no working ambulances',
    story:
      "In 2022, Mama Grace needed emergency surgery but the county hospital's only ambulance was broken. An audit later revealed that KES 50 million allocated for medical equipment had been misused. The money meant to buy three new ambulances and medical equipment was diverted to other projects. Mama Grace had to be transported in a private car, delaying her treatment by 3 hours.",
    consequences: [
      'Delayed medical treatment for patients',
      'Higher maternal and child mortality rates',
      'Families forced to pay for private transport during emergencies',
      'Reduced trust in public healthcare system',
    ],
    whatChanged:
      'After public pressure and media coverage, the county government was forced to account for the missing funds. New ambulances were purchased and a tracking system was implemented for medical equipment.',
    yourRole:
      'When you understand budget allocation for healthcare, you can demand accountability. Ask your county representative: How much is budgeted for health? How many ambulances should we have? Where are the audit reports?',
    personalConnection:
      'Every family will need emergency healthcare at some point. The money in health budgets directly affects whether help will be available when you need it most.',
  },
  {
    id: 'education',
    title: 'The School That Never Got Built',
    category: 'education',
    icon: GraduationCap,
    color: 'blue',
    impact: 'High',
    timeToRead: '2 min',
    summary: 'How budget misallocation left 800 children without a school for 3 years',
    story:
      'In a rural county in Eastern Kenya, KES 80 million was budgeted to build a secondary school for 800 students. For three years, children walked 10 kilometers daily to attend the nearest school. An audit revealed the money was diverted to office construction and vehicle purchases instead. The school was never built.',
    consequences: [
      '800+ students walking 20km daily to school',
      'High dropout rates, especially among girls',
      "Parents paying transport costs they couldn't afford",
      'Entire generation missing quality education opportunities',
    ],
    whatChanged:
      'After the audit report went public, parents organized protests. The county leadership was eventually forced to reallocate funds and construction began.',
    yourRole:
      'Education budgets affect every child in your community. Monitor if promised schools are actually built, if teachers are hired as planned, and if learning materials reach classrooms.',
    personalConnection:
      "Your children's future depends on education investments made today. Poor budget accountability means your child might not have a school to attend.",
  },
  {
    id: 'roads',
    title: 'The Road That Washed Away',
    category: 'infrastructure',
    icon: Building2,
    color: 'orange',
    impact: 'Medium',
    timeToRead: '2 min',
    summary: 'Substandard construction due to inflated contracts isolated a farming community',
    story:
      'Farmers in a central highlands county invested heavily in coffee farming after the county promised an all-weather road to connect them to markets. KES 200 million was allocated for 15 kilometers of tarmac road. The road was "completed" but washed away after the first rainy season. Investigations revealed the contractor inflated costs and used substandard materials, pocketing the difference.',
    consequences: [
      'Farmers unable to transport crops to market',
      'Coffee crops rotting during rainy season',
      'Increased poverty in farming communities',
      'Loss of investor confidence in local agriculture',
    ],
    whatChanged:
      'After farmers took the county to court, a proper investigation revealed the fraud. The contractor was blacklisted and a new road was built with proper oversight.',
    yourRole:
      'Infrastructure spending directly affects your daily life. Monitor if road projects meet quality standards, if contractors have proper qualifications, and if project costs are reasonable.',
    personalConnection:
      'The roads you use to get to work, take children to school, or access markets are funded by your taxes. Poor oversight means poor infrastructure that affects your daily life.',
  },
  {
    id: 'youth',
    title: 'Youth Fund Money That Vanished',
    category: 'employment',
    icon: Users,
    color: 'green',
    impact: 'High',
    timeToRead: '3 min',
    summary: 'How KES 300 million meant for youth employment disappeared',
    story:
      'John graduated from university in 2021 with a computer science degree. His county had allocated KES 300 million for youth empowerment programs, including technology hubs and startup funding. John applied for funding to start a digital services business. After a year of waiting, he discovered the money had been diverted to fund political campaigns. No youth programs were implemented.',
    consequences: [
      'High youth unemployment rates persist',
      'University graduates leaving for other counties',
      'Loss of entrepreneurship opportunities',
      'Increased social problems and crime among idle youth',
    ],
    whatChanged:
      'Youth organized peaceful protests and demanded accountability. A new youth fund was established with transparent application processes and public reporting of beneficiaries.',
    yourRole:
      'Youth empowerment budgets should create real opportunities. Track if promised programs actually exist, if application processes are fair, and if funds reach intended beneficiaries.',
    personalConnection:
      "Whether you're young or have children, youth unemployment affects community safety, economic growth, and your family's future opportunities.",
  },
];

/**
 * Helper function to filter stories based on search terms
 */
export const filterStories = (stories: RealLifeStory[], searchTerm: string): RealLifeStory[] => {
  if (!searchTerm) return stories;

  const term = searchTerm.toLowerCase();
  return stories.filter(
    (story) =>
      story.title.toLowerCase().includes(term) ||
      story.summary.toLowerCase().includes(term) ||
      story.category.toLowerCase().includes(term)
  );
};

/**
 * Helper function to get stories by category
 */
export const getStoriesByCategory = (
  stories: RealLifeStory[],
  category: string
): RealLifeStory[] => {
  return stories.filter((story) => story.category === category);
};

/**
 * Helper function to get stories by impact level
 */
export const getStoriesByImpact = (
  stories: RealLifeStory[],
  impact: 'High' | 'Medium' | 'Low'
): RealLifeStory[] => {
  return stories.filter((story) => story.impact === impact);
};
