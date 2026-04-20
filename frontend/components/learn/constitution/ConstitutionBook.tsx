/**
 * ConstitutionBook — interactive "book" reader for the Constitution of Kenya.
 *
 * Responsibilities
 *   - Owns the active chapter + article state.
 *   - Lazily fetches chapter bodies through loadChapter() (cached).
 *   - Drives page-turn direction for ArticleViewer's AnimatePresence.
 *   - Wires up keyboard arrows and mobile swipe gestures.
 *
 * Design choices
 *   - Chapters ship via a pre-computed CONSTITUTION_META array so the
 *     sidebar paints instantly; article bodies stream in per chapter.
 *   - Desktop: sidebar + viewer side-by-side. Mobile: sidebar collapses
 *     behind a drawer toggle.
 */
'use client';

import { CONSTITUTION_META, loadChapter } from '@/data/constitution';
import type { ConstitutionChapter } from '@/data/constitution/types';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { BookOpen, Menu, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ArticleViewer from './ArticleViewer';
import ChapterSidebar from './ChapterSidebar';

interface ConstitutionBookProps {
  /** Initial chapter to open. Defaults to Chapter 12 (Public Finance). */
  initialChapter?: number;
  /** Initial article within that chapter. Defaults to first. */
  initialArticle?: number;
  /**
   * Query string from the hero search — used to highlight matching
   * text inside the currently open article.
   */
  seedQuery?: string;
}

export default function ConstitutionBook({
  initialChapter = 12,
  initialArticle,
  seedQuery = '',
}: ConstitutionBookProps) {
  /* ── State ── */
  const [activeChapter, setActiveChapter] = useState<number>(initialChapter);
  const [activeArticle, setActiveArticle] = useState<number | null>(initialArticle ?? null);
  const [loadedChapter, setLoadedChapter] = useState<ConstitutionChapter | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [direction, setDirection] = useState<number>(1);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  /* Use a ref for direction too so keyboard/swipe handlers always read the
     latest value regardless of render timing. */
  const directionRef = useRef(1);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  /* ── Fetch chapter body whenever the active chapter changes ── */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadChapter(activeChapter).then((data) => {
      if (cancelled) return;
      setLoadedChapter(data);
      setIsLoading(false);
      if (data && data.articles.length > 0) {
        setActiveArticle((prev) => {
          // If caller preselected an article that lives in this chapter, honour it.
          if (prev !== null && data.articles.some((a) => a.number === prev)) {
            return prev;
          }
          return data.articles[0]!.number;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeChapter]);

  /* ── Derive current article + neighbours ── */
  const articleList = loadedChapter?.articles ?? [];
  const currentIdx = useMemo(() => {
    if (activeArticle === null) return -1;
    return articleList.findIndex((a) => a.number === activeArticle);
  }, [articleList, activeArticle]);
  const currentArticle = currentIdx >= 0 ? articleList[currentIdx] : null;
  const prevArticle = currentIdx > 0 ? articleList[currentIdx - 1] : null;
  const nextArticle =
    currentIdx >= 0 && currentIdx < articleList.length - 1 ? articleList[currentIdx + 1] : null;

  /* ── Navigation helpers ── */
  const goPrev = useCallback(() => {
    if (prevArticle) {
      setDirection(-1);
      setActiveArticle(prevArticle.number);
    }
  }, [prevArticle]);

  const goNext = useCallback(() => {
    if (nextArticle) {
      setDirection(1);
      setActiveArticle(nextArticle.number);
    }
  }, [nextArticle]);

  const selectChapter = useCallback(
    (n: number) => {
      if (n === activeChapter) return;
      setDirection(n > activeChapter ? 1 : -1);
      setActiveChapter(n);
      // Drop the preselected article so the new chapter opens at #1.
      setActiveArticle(null);
    },
    [activeChapter]
  );

  /** Next chapter in reading order (or null when we're on the last one). */
  const nextChapterMeta = useMemo(() => {
    const idx = CONSTITUTION_META.findIndex((m) => m.number === activeChapter);
    if (idx < 0 || idx >= CONSTITUTION_META.length - 1) return null;
    return CONSTITUTION_META[idx + 1]!;
  }, [activeChapter]);

  const goNextChapter = useCallback(() => {
    if (!nextChapterMeta) return;
    setDirection(1);
    setActiveChapter(nextChapterMeta.number);
    setActiveArticle(null);
  }, [nextChapterMeta]);

  const selectArticle = useCallback(
    (chapterNumber: number, articleNumber: number) => {
      if (chapterNumber !== activeChapter) {
        setDirection(chapterNumber > activeChapter ? 1 : -1);
        setActiveChapter(chapterNumber);
        setActiveArticle(articleNumber);
      } else {
        setDirection(articleNumber > (activeArticle ?? 0) ? 1 : -1);
        setActiveArticle(articleNumber);
      }
    },
    [activeChapter, activeArticle]
  );

  /* ── Keyboard navigation (arrow keys) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  /* ── Mobile swipe ── */
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      const swipe = Math.abs(offset.x) * velocity.x;
      if (offset.x < -80 || swipe < -500) goNext();
      else if (offset.x > 80 || swipe > 500) goPrev();
    },
    [goNext, goPrev]
  );

  /* ── Progress meter ── */
  const progress = useMemo(() => {
    if (articleList.length === 0) return 0;
    return ((currentIdx + 1) / articleList.length) * 100;
  }, [currentIdx, articleList.length]);

  const activeMeta = CONSTITUTION_META.find((m) => m.number === activeChapter);

  return (
    <section
      id='constitution-book'
      className='relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white/85 via-gov-cream/80 to-gov-sand shadow-elevated'
      aria-label='Constitution of Kenya reader'>
      {/* ── Header ── */}
      <div className='flex items-start gap-3 border-b border-neutral-border/60 bg-gradient-to-r from-gov-forest via-gov-dark to-gov-forest px-5 py-4 sm:px-7'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gov-gold/90 text-gov-dark shadow-surface'>
          <BookOpen size={20} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-[11px] font-semibold uppercase tracking-widest text-gov-gold/90'>
            Constitution of Kenya · 2010
          </div>
          <h3 className='font-display text-xl leading-tight text-white sm:text-2xl'>
            Read the law that shapes every shilling
          </h3>
        </div>
        <button
          type='button'
          className='ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 lg:hidden'
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls='constitution-drawer'>
          {drawerOpen ? <X size={16} /> : <Menu size={16} />}
          <span className='hidden sm:inline'>Chapters</span>
        </button>
      </div>

      {/* ── Body ── */}
      <div className='grid grid-cols-1 lg:grid-cols-[280px_1fr]'>
        {/* Sidebar — desktop */}
        <aside className='hidden max-h-[640px] overflow-y-auto border-r border-neutral-border/60 bg-white/50 p-3 lg:block'>
          <ChapterSidebar
            chapters={CONSTITUTION_META}
            activeChapterNumber={activeChapter}
            activeArticleNumber={activeArticle}
            loadedChapter={loadedChapter}
            onSelectChapter={selectChapter}
            onSelectArticle={selectArticle}
          />
        </aside>

        {/* Sidebar — mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              id='constitution-drawer'
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className='overflow-hidden border-b border-neutral-border/60 bg-white/70 p-3 lg:hidden'>
              <ChapterSidebar
                chapters={CONSTITUTION_META}
                activeChapterNumber={activeChapter}
                activeArticleNumber={activeArticle}
                loadedChapter={loadedChapter}
                onSelectChapter={selectChapter}
                onSelectArticle={selectArticle}
                onNavigate={() => setDrawerOpen(false)}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Viewer */}
        <motion.div
          className='relative min-h-[540px] bg-white/70'
          drag='x'
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={handleDragEnd}>
          {isLoading && !loadedChapter ? (
            <div className='flex h-[540px] items-center justify-center text-sm text-neutral-muted'>
              <div className='animate-pulse'>Loading chapter…</div>
            </div>
          ) : !loadedChapter ? (
            <div className='flex h-[540px] items-center justify-center p-8 text-center text-sm text-neutral-muted'>
              Could not load Chapter {activeChapter}. Please try another chapter.
            </div>
          ) : currentArticle ? (
            <ArticleViewer
              chapter={loadedChapter}
              article={currentArticle}
              query={seedQuery}
              direction={direction}
              hasPrev={!!prevArticle}
              hasNext={!!nextArticle}
              prevLabel={prevArticle ? String(prevArticle.number) : undefined}
              nextLabel={nextArticle ? String(nextArticle.number) : undefined}
              onPrev={goPrev}
              onNext={goNext}
              nextChapterNumber={nextChapterMeta?.number}
              nextChapterTitle={nextChapterMeta?.title}
              onGoNextChapter={goNextChapter}
            />
          ) : null}
        </motion.div>
      </div>

      {/* ── Progress bar ── */}
      <div className='border-t border-neutral-border/60 bg-white/60 px-4 py-3 sm:px-6'>
        <div className='flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-muted'>
          <span>
            Chapter {activeChapter}{activeMeta ? ` — ${activeMeta.title}` : ''}
          </span>
          <span>
            {articleList.length > 0
              ? `${currentIdx + 1} of ${articleList.length}`
              : '—'}
          </span>
        </div>
        <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-border/60'>
          <motion.div
            className='h-full rounded-full bg-gradient-to-r from-gov-sage to-gov-gold'
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className='mt-2 hidden text-[11px] text-neutral-muted sm:block'>
          Tip · use ← and → keys to turn pages, or swipe on mobile.
        </div>
      </div>
    </section>
  );
}
