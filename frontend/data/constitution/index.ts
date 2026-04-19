/**
 * Constitution of Kenya — chapter metadata index.
 *
 * This module ships in the initial JS bundle so the sidebar, search,
 * and "jump to article" UI work without a network round trip. Full
 * chapter bodies live in /public/data/constitution/chapter-<n>.json
 * and are fetched on demand via loadChapter().
 */

import type { ChapterMeta, ConstitutionChapter } from './types';

export const CONSTITUTION_META: ChapterMeta[] = [
  {
    number: 1,
    title: 'Sovereignty of the People',
    summary: 'Power belongs to the people of Kenya and flows through the Constitution.',
    articleRange: [1, 3],
    articleTitles: [
      { number: 1, title: 'Sovereignty of the people' },
      { number: 2, title: 'Supremacy of this Constitution' },
      { number: 3, title: 'Defence of this Constitution' },
    ],
    dataPath: '/data/constitution/chapter-1.json',
    highlight: 'All sovereign power belongs to the people — directly or through elected representatives.',
  },
  {
    number: 2,
    title: 'The Republic',
    summary: 'Kenya as a sovereign, multi-party democratic state and its national values.',
    articleRange: [4, 11],
    articleTitles: [
      { number: 4, title: 'Declaration of the Republic' },
      { number: 5, title: 'Territory of Kenya' },
      { number: 6, title: 'Devolution and access to services' },
      { number: 7, title: 'National, official and other languages' },
      { number: 8, title: 'State and religion' },
      { number: 9, title: 'National symbols and national days' },
      { number: 10, title: 'National values and principles of governance' },
      { number: 11, title: 'Culture' },
    ],
    dataPath: '/data/constitution/chapter-2.json',
    highlight: 'Article 10 binds every state officer to the rule of law, accountability and integrity.',
  },
  {
    number: 3,
    title: 'Citizenship',
    summary: 'Who is a Kenyan citizen, how citizenship is acquired, and what it entitles you to.',
    articleRange: [12, 18],
    articleTitles: [
      { number: 12, title: 'Entitlements of citizens' },
      { number: 13, title: 'Retention and acquisition of citizenship' },
      { number: 14, title: 'Citizenship by birth' },
      { number: 15, title: 'Citizenship by registration' },
      { number: 16, title: 'Dual citizenship' },
      { number: 17, title: 'Revocation of citizenship' },
      { number: 18, title: 'Legislation on citizenship' },
    ],
    dataPath: '/data/constitution/chapter-3.json',
  },
  {
    number: 6,
    title: 'Leadership and Integrity',
    summary: 'The ethical and legal standards every public officer must meet.',
    articleRange: [73, 80],
    articleTitles: [
      { number: 73, title: 'Responsibilities of leadership' },
      { number: 74, title: 'Oath of office of State officers' },
      { number: 75, title: 'Conduct of State officers' },
      { number: 76, title: 'Financial probity of State officers' },
      { number: 77, title: 'Restriction on activities of State officers' },
      { number: 78, title: 'Citizenship and leadership' },
      { number: 79, title: 'Legislation to establish the ethics and anti-corruption commission' },
      { number: 80, title: 'Legislation on leadership' },
    ],
    dataPath: '/data/constitution/chapter-6.json',
    highlight: 'Chapter 6 is the promise Kenyans demand from every elected and appointed leader.',
  },
  {
    number: 11,
    title: 'Devolved Government',
    summary: 'The creation of 47 counties, their powers, and how they share revenue.',
    articleRange: [174, 200],
    articleTitles: [
      { number: 174, title: 'Objects of the devolution of government' },
      { number: 175, title: 'Principles of devolved government' },
      { number: 176, title: 'County governments' },
      { number: 177, title: 'Membership of the county assembly' },
      { number: 179, title: 'County executive committees' },
      { number: 180, title: 'Election of county governors and deputy county governors' },
      { number: 185, title: 'Legislative authority of county assemblies' },
      { number: 186, title: 'Functions and powers of national and county governments' },
      { number: 187, title: 'Transfer of functions and powers between levels of government' },
      { number: 189, title: 'Cooperation between national and county governments' },
      { number: 193, title: 'Qualifications for election as member of county assembly' },
      { number: 200, title: 'Legislation on devolved government' },
    ],
    dataPath: '/data/constitution/chapter-11.json',
    highlight: '47 county governments exist to bring service delivery closer to every Kenyan.',
  },
  {
    number: 12,
    title: 'Public Finance',
    summary: 'The rules that govern how public money is raised, spent, and audited.',
    articleRange: [201, 231],
    articleTitles: [
      { number: 201, title: 'Principles of public finance' },
      { number: 202, title: 'Equitable sharing of national revenue' },
      { number: 203, title: 'Equitable share and criteria' },
      { number: 204, title: 'Equalisation Fund' },
      { number: 205, title: 'Consultation on financial legislation affecting counties' },
      { number: 206, title: 'Consolidated Fund and other public funds' },
      { number: 210, title: 'Imposition of tax' },
      { number: 214, title: 'Public debt' },
      { number: 216, title: 'Function of Commission on Revenue Allocation' },
      { number: 220, title: 'Form, content and timing of budgets' },
      { number: 221, title: 'Budget estimates and annual Appropriation Bill' },
      { number: 225, title: 'Financial control' },
      { number: 226, title: 'Accounts and audit of public entities' },
      { number: 227, title: 'Procurement of public goods and services' },
      { number: 228, title: 'Controller of Budget' },
      { number: 229, title: 'Auditor-General' },
      { number: 230, title: 'Salaries and Remuneration Commission' },
      { number: 231, title: 'Central Bank of Kenya' },
    ],
    dataPath: '/data/constitution/chapter-12.json',
    highlight:
      'Article 229 establishes the Auditor-General — the watchdog who confirms whether public money was spent lawfully.',
  },
];

/** Total number of articles covered across the chapters we publish. */
export const TOTAL_ARTICLES = CONSTITUTION_META.reduce(
  (sum, c) => sum + c.articleTitles.length,
  0
);

/** Quick lookup: article number → chapter metadata. */
const ARTICLE_TO_CHAPTER = new Map<number, ChapterMeta>();
for (const ch of CONSTITUTION_META) {
  for (const a of ch.articleTitles) {
    ARTICLE_TO_CHAPTER.set(a.number, ch);
  }
}

export function findChapterForArticle(articleNumber: number): ChapterMeta | undefined {
  return ARTICLE_TO_CHAPTER.get(articleNumber);
}

/** In-memory cache of loaded chapters so we never re-fetch the same one. */
const CHAPTER_CACHE = new Map<number, ConstitutionChapter>();
let ALL_LOADED_PROMISE: Promise<ConstitutionChapter[]> | null = null;

export async function loadChapter(
  chapterNumber: number
): Promise<ConstitutionChapter | null> {
  const cached = CHAPTER_CACHE.get(chapterNumber);
  if (cached) return cached;
  const meta = CONSTITUTION_META.find((c) => c.number === chapterNumber);
  if (!meta) return null;
  try {
    const res = await fetch(meta.dataPath, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = (await res.json()) as ConstitutionChapter;
    CHAPTER_CACHE.set(chapterNumber, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Load every chapter — only used when the user engages full-text
 * search and asks for keyword matches across the whole Constitution.
 * The promise is memoised so concurrent searches share one fetch batch.
 */
export function loadAllChapters(): Promise<ConstitutionChapter[]> {
  if (!ALL_LOADED_PROMISE) {
    ALL_LOADED_PROMISE = Promise.all(
      CONSTITUTION_META.map((m) => loadChapter(m.number))
    ).then((results) => results.filter((c): c is ConstitutionChapter => c !== null));
  }
  return ALL_LOADED_PROMISE;
}
