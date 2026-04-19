/**
 * Learning Hub — civic learning hub for AuditGava.
 *
 * Layout (top → bottom):
 *   1. LearnHero          — display headline + search + stat chips
 *   2. FeaturedTopics     — mixed-size card grid leading into each mode
 *   3. ConstitutionBook   — interactive reader for the Constitution
 *   4. Dive deeper tabs   — quiz / government / glossary / impact
 *   5. PopularQuestions   — expandable civic FAQ
 *   6. CTA                — jump back to the dashboard
 *
 * The hero search pipes into the ConstitutionBook: number queries (e.g.
 * "Article 229") directly open that article; keyword queries seed the
 * book's search so the user sees matches in context.
 */
'use client';

import InteractiveGlossary from '@/components/InteractiveGlossary';
import PageShell from '@/components/layout/PageShell';
import ConstitutionBook from '@/components/learn/constitution/ConstitutionBook';
import FeaturedTopics from '@/components/learn/FeaturedTopics';
import GovernmentExplorer from '@/components/learn/GovernmentExplorer';
import LearnHero from '@/components/learn/LearnHero';
import PopularQuestions from '@/components/learn/PopularQuestions';
import QuizGame from '@/components/learn/QuizGame';
import WhyThisMatters from '@/components/WhyThisMatters';
import { findChapterForArticle } from '@/data/constitution';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Gamepad2,
  Heart,
  Landmark,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';

type DeeperTab = 'quiz' | 'government' | 'glossary' | 'why';

const DEEPER_TABS: {
  id: DeeperTab;
  title: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'quiz',
    title: 'Quiz game',
    description: 'Test your civic knowledge',
    icon: Gamepad2,
  },
  {
    id: 'government',
    title: 'Government explorer',
    description: 'How power is arranged',
    icon: Landmark,
  },
  {
    id: 'glossary',
    title: 'Jargon decoder',
    description: 'Every term, in plain English',
    icon: BookOpen,
  },
  {
    id: 'why',
    title: 'Real impact',
    description: 'How it affects your life',
    icon: Heart,
  },
];

function parseArticleNumber(q: string): number | null {
  const trimmed = q.trim();
  const m = trimmed.match(/^(?:article|art\.?)\s+(\d+)$/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^\d{1,3}$/.test(trimmed)) return parseInt(trimmed, 10);
  return null;
}

export default function LearningHubPage() {
  /* ── Constitution book seeding ── */
  const [seedQuery, setSeedQuery] = useState<string>('');
  const [seedChapter, setSeedChapter] = useState<number>(12);
  const [seedArticle, setSeedArticle] = useState<number | undefined>(229);
  const [bookKey, setBookKey] = useState<number>(0);
  const bookRef = useRef<HTMLDivElement>(null);

  const scrollToBook = useCallback(() => {
    // Small delay so that:
    //   • React has committed the state update (bookKey bump, seeds)
    //   • The ConstitutionBook's own re-focus/re-fetch effects have run
    //   • The exit animation of the hero dropdown has finished its first frame
    // Smooth scroll otherwise gets silently cancelled by those concurrent layout
    // shifts on some browsers.
    setTimeout(() => {
      bookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  const openArticle = useCallback(
    (articleNumber: number) => {
      const meta = findChapterForArticle(articleNumber);
      if (!meta) return;
      setSeedChapter(meta.number);
      setSeedArticle(articleNumber);
      setSeedQuery('');
      setBookKey((k) => k + 1);
      scrollToBook();
    },
    [scrollToBook]
  );

  /** Jump to a specific chapter + article (used by hero autocomplete). */
  const jumpToArticle = useCallback(
    (chapterNumber: number, articleNumber: number) => {
      setSeedChapter(chapterNumber);
      setSeedArticle(articleNumber);
      setSeedQuery('');
      setBookKey((k) => k + 1);
      scrollToBook();
    },
    [scrollToBook]
  );

  const handleHeroSearch = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      const articleNum = parseArticleNumber(q);
      if (articleNum !== null) {
        openArticle(articleNum);
        return;
      }
      setSeedQuery(q);
      setBookKey((k) => k + 1);
      scrollToBook();
    },
    [openArticle, scrollToBook]
  );

  /* ── Dive-deeper tabs ── */
  const [activeDeep, setActiveDeep] = useState<DeeperTab>('quiz');
  const [glossarySearch, setGlossarySearch] = useState<string>('');

  return (
    <PageShell
      title='Learning Hub'
      subtitle='Understand the rules behind every shilling — the Constitution, budgets, audits and devolution, in plain Kenyan English.'>
      {/* 1 ── Hero ─────────────────────────────────── */}
      <LearnHero onSearchSubmit={handleHeroSearch} onArticleSelect={jumpToArticle} />

      {/* 2 ── Featured topics ─────────────────────── */}
      <FeaturedTopics />

      {/* 3 ── Constitution book ───────────────────── */}
      <div ref={bookRef} className='scroll-mt-[72px]'>
        <div className='mb-3 flex items-end justify-between gap-4'>
          <div>
            <h2 className='font-display text-2xl leading-tight text-gov-dark sm:text-[1.7rem]'>
              The Constitution, as a book you can actually read
            </h2>
            <p className='text-sm text-neutral-muted'>
              Six chapters, dozens of articles, every one with a plain-English note.
            </p>
          </div>
          <Link
            href='#constitution-book'
            className='hidden shrink-0 items-center gap-1.5 rounded-full bg-gov-forest/10 px-3 py-1.5 text-xs font-semibold text-gov-forest hover:bg-gov-forest/15 sm:inline-flex'>
            <Sparkles size={12} />
            New
          </Link>
        </div>
        <ConstitutionBook
          key={bookKey}
          initialChapter={seedChapter}
          initialArticle={seedArticle}
          seedQuery={seedQuery}
        />
      </div>

      {/* 4 ── Dive deeper ─────────────────────────── */}
      <section aria-labelledby='dive-deeper-heading' className='space-y-4'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h2
              id='dive-deeper-heading'
              className='font-display text-2xl leading-tight text-gov-dark sm:text-[1.7rem]'>
              Dive deeper
            </h2>
            <p className='text-sm text-neutral-muted'>
              Four different ways to practise what you&rsquo;ve learned.
            </p>
          </div>
        </div>

        {/* Tab chips */}
        <div className='flex flex-wrap gap-2 rounded-2xl border border-white/60 bg-white/60 p-2 shadow-surface backdrop-blur'>
          {DEEPER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDeep === tab.id;
            return (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveDeep(tab.id)}
                className={`relative flex min-w-[150px] flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors sm:min-w-[180px] ${
                  isActive
                    ? 'bg-gov-forest text-white shadow-surface'
                    : 'text-gov-dark hover:bg-gov-forest/5'
                }`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-gov-gold/90 text-gov-dark' : 'bg-gov-forest/10 text-gov-forest'
                  }`}>
                  <Icon size={15} />
                </span>
                <span className='min-w-0'>
                  <span className='block truncate text-sm font-semibold'>{tab.title}</span>
                  <span
                    className={`block truncate text-[11px] ${
                      isActive ? 'text-white/70' : 'text-neutral-muted'
                    }`}>
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode='wait'>
          <motion.div
            key={activeDeep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {activeDeep === 'quiz' && <QuizGame />}

            {activeDeep === 'government' && <GovernmentExplorer />}

            {activeDeep === 'glossary' && (
              <div className='space-y-4'>
                <div className='max-w-md'>
                  <input
                    type='text'
                    placeholder='Search terms…'
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    className='w-full rounded-xl border border-neutral-border bg-white/80 px-4 py-2.5 text-sm shadow-surface transition-shadow placeholder:text-neutral-muted focus:outline-none focus:ring-2 focus:ring-gov-sage/40'
                  />
                </div>
                <InteractiveGlossary searchTerm={glossarySearch} />
              </div>
            )}

            {activeDeep === 'why' && <WhyThisMatters searchTerm='' />}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* 5 ── Popular questions ───────────────────── */}
      <PopularQuestions onOpenArticle={openArticle} />

      {/* 6 ── CTA ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-gov-forest via-gov-dark to-gov-forest p-8 text-center text-white sm:p-10'>
        <div className='pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gov-gold/10' />
        <div className='pointer-events-none absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-white/5' />
        <Sparkles size={26} className='mx-auto mb-3 text-gov-gold' />
        <h2 className='font-display text-2xl sm:text-3xl'>
          Ready to put your knowledge to use?
        </h2>
        <p className='mx-auto mt-2 max-w-lg text-white/75'>
          Explore live government data — audits, budgets, debt and county spending — powered by the
          same constitutional rules you just read.
        </p>
        <Link
          href='/'
          className='mt-6 inline-flex items-center gap-2 rounded-xl bg-gov-gold px-6 py-3 font-semibold text-gov-dark shadow-elevated transition-colors hover:bg-gov-gold/90'>
          Go to dashboard
          <ArrowRight size={16} />
        </Link>
      </motion.div>
    </PageShell>
  );
}
