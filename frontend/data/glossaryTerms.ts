/**
 * Glossary Terms Data
 * Collection of government finance terms with definitions and examples
 * Edit this file to add, update, or modify terms without touching component code
 */

import {
  AlertTriangle,
  BookOpen,
  Building,
  Calculator,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  icon: any;
  color: string;
  shortDef: string;
  longDef: string;
  examples: string[];
  animation: string;
}

export interface GlossaryCategory {
  id: string;
  label: string;
  count: number;
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: 'budget',
    term: 'Budget',
    category: 'planning',
    icon: Calculator,
    color: 'blue',
    shortDef: 'A plan for how government will spend money over a year',
    longDef:
      "A budget is like a family's spending plan, but for the entire country or county. It shows how much money the government expects to collect (from taxes) and how they plan to spend it (on schools, hospitals, roads, etc.).",
    examples: [
      "Kenya's 2024 national budget is KES 3.7 trillion",
      'Your county budget funds local hospitals and schools',
      'If a family earns KES 100,000, their budget shows how much goes to rent, food, etc.',
    ],
    animation: 'budget',
  },
  {
    id: 'debt',
    term: 'National Debt',
    category: 'finance',
    icon: TrendingUp,
    color: 'red',
    shortDef: 'Money the government has borrowed and must pay back',
    longDef:
      'Just like when you borrow money to buy a house or car, governments borrow money to build big projects like highways or hospitals. This borrowed money must be paid back with interest.',
    examples: [
      'Kenya owes about KES 10.8 trillion to various lenders',
      'Money borrowed to build the SGR (Standard Gauge Railway)',
      'Like a mortgage - you get the house now but pay monthly for years',
    ],
    animation: 'debt',
  },
  {
    id: 'deficit',
    term: 'Budget Deficit',
    category: 'finance',
    icon: AlertTriangle,
    color: 'orange',
    shortDef: 'When government spends more money than it collects',
    longDef:
      'A deficit happens when your expenses are more than your income. For governments, this means they spent more on services and projects than they collected in taxes, so they need to borrow money to cover the difference.',
    examples: [
      'If government collects KES 2T in taxes but spends KES 2.5T = KES 500B deficit',
      'Like spending KES 150,000 when you only earn KES 100,000',
      'Must borrow money or use savings to cover the shortfall',
    ],
    animation: 'deficit',
  },
  {
    id: 'audit',
    term: 'Government Audit',
    category: 'accountability',
    icon: BookOpen,
    color: 'green',
    shortDef: 'An independent check of how government spent public money',
    longDef:
      'An audit is like having an independent accountant check if government officials spent taxpayer money properly, followed the rules, and achieved what they promised.',
    examples: [
      'Auditor-General checks if county spent education money on actual schools',
      'Like having someone verify your business expenses for tax purposes',
      'Ensures KES 100M for roads actually built roads, not personal projects',
    ],
    animation: 'audit',
  },
  {
    id: 'revenue',
    term: 'Government Revenue',
    category: 'finance',
    icon: DollarSign,
    color: 'purple',
    shortDef: 'Money government collects from taxes and other sources',
    longDef:
      'Revenue is all the money government receives to fund its operations. Most comes from taxes you pay (income tax, VAT, fuel tax), but also includes fees, fines, and profits from government businesses.',
    examples: [
      'Income tax from your salary',
      'VAT when you buy goods in shops',
      'License fees for businesses and vehicles',
    ],
    animation: 'revenue',
  },
  {
    id: 'expenditure',
    term: 'Government Expenditure',
    category: 'spending',
    icon: Building,
    color: 'indigo',
    shortDef: 'Money government spends on services and projects',
    longDef:
      'Expenditure is how government uses the money it collects. This includes paying teacher salaries, building hospitals, maintaining roads, and running government offices.',
    examples: [
      'Salaries for teachers, doctors, and police officers',
      'Building new schools and hospitals',
      'Maintaining roads and providing clean water',
    ],
    animation: 'expenditure',
  },
  {
    id: 'gdp',
    term: 'Gross Domestic Product (GDP)',
    category: 'economy',
    icon: TrendingUp,
    color: 'emerald',
    shortDef: 'Total value of everything produced in the country',
    longDef:
      "GDP measures how much economic activity happens in Kenya - all the goods and services produced. It's like adding up the value of every product made and service provided in the entire country.",
    examples: [
      "Kenya's GDP is about KES 12.5 trillion per year",
      'Includes agriculture, manufacturing, services, technology',
      'Higher GDP usually means people have better living standards',
    ],
    animation: 'gdp',
  },
  {
    id: 'taxation',
    term: 'Taxation',
    category: 'finance',
    icon: Users,
    color: 'cyan',
    shortDef: 'Money citizens and businesses pay to fund government',
    longDef:
      'Taxes are the main way government raises money to provide services. Everyone contributes a portion of their income or spending to fund schools, hospitals, security, and infrastructure.',
    examples: [
      'PAYE tax deducted from your salary',
      'VAT added to prices when shopping',
      'Corporate tax paid by businesses on profits',
    ],
    animation: 'taxation',
  },
];

/**
 * Generate categories with counts based on current terms
 */
export const generateCategories = (terms: GlossaryTerm[]): GlossaryCategory[] => [
  { id: 'all', label: 'All Categories', count: terms.length },
  {
    id: 'finance',
    label: 'Finance',
    count: terms.filter((t) => t.category === 'finance').length,
  },
  {
    id: 'planning',
    label: 'Planning',
    count: terms.filter((t) => t.category === 'planning').length,
  },
  {
    id: 'spending',
    label: 'Spending',
    count: terms.filter((t) => t.category === 'spending').length,
  },
  {
    id: 'accountability',
    label: 'Accountability',
    count: terms.filter((t) => t.category === 'accountability').length,
  },
  {
    id: 'economy',
    label: 'Economy',
    count: terms.filter((t) => t.category === 'economy').length,
  },
];

/**
 * Filter terms based on search and category
 */
export const filterTerms = (
  terms: GlossaryTerm[],
  searchTerm: string,
  categoryFilter: string
): GlossaryTerm[] => {
  return terms.filter((term) => {
    const matchesSearch =
      searchTerm === '' ||
      term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.shortDef.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || term.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
};

/**
 * Get terms by category
 */
export const getTermsByCategory = (terms: GlossaryTerm[], category: string): GlossaryTerm[] => {
  return terms.filter((term) => term.category === category);
};

/**
 * Get terms by color
 */
export const getTermsByColor = (terms: GlossaryTerm[], color: string): GlossaryTerm[] => {
  return terms.filter((term) => term.color === color);
};
