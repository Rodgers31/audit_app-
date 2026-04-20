/**
 * ArticleViewer — renders one constitutional article as a "page" in the book.
 *
 * The parent passes a direction (1 for forward, -1 for back) and a unique key
 * so framer-motion's AnimatePresence can cross-fade with a page-turn feel.
 *
 * Search highlights are applied client-side via a simple non-regex token
 * substitution to keep the markup predictable for screen readers.
 */
'use client';

import type { ConstitutionArticle, ConstitutionChapter } from '@/data/constitution/types';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Hash,
  Lightbulb,
  ScrollText,
} from 'lucide-react';
import { useMemo } from 'react';

/** Page-turn variants. `direction` is passed via AnimatePresence's custom prop. */
const PAGE_VARIANTS: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 64, rotateY: d * -6 }),
  center: { opacity: 1, x: 0, rotateY: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -64, rotateY: d * 6 }),
};

interface ArticleViewerProps {
  chapter: ConstitutionChapter;
  article: ConstitutionArticle;
  /** Highlighted query, if any. */
  query?: string;
  /** +1 forward, -1 back — drives the slide direction. */
  direction: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevLabel?: string;
  nextLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  /** Next chapter in reading order, when we're on the last article. */
  nextChapterNumber?: number;
  nextChapterTitle?: string;
  onGoNextChapter?: () => void;
}

/** Cheap, allocation-light highlight: splits on case-insensitive query. */
function highlight(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < text.length) {
    const j = lower.indexOf(needle, i);
    if (j === -1) {
      out.push(text.slice(i));
      break;
    }
    if (j > i) out.push(text.slice(i, j));
    out.push(
      <mark
        key={`h-${n++}`}
        className='rounded bg-gov-gold/30 px-0.5 text-gov-dark'>
        {text.slice(j, j + q.length)}
      </mark>
    );
    i = j + q.length;
  }
  return <>{out}</>;
}

export default function ArticleViewer({
  chapter,
  article,
  query = '',
  direction,
  hasPrev,
  hasNext,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  nextChapterNumber,
  nextChapterTitle,
  onGoNextChapter,
}: ArticleViewerProps) {
  const pageKey = useMemo(
    () => `${chapter.number}-${article.number}`,
    [chapter.number, article.number]
  );
  const atEndOfChapter = !hasNext;
  const showNextChapter = atEndOfChapter && !!nextChapterNumber && !!onGoNextChapter;

  return (
    <div className='relative h-full' style={{ perspective: '1800px' }}>
      <AnimatePresence mode='wait' initial={false} custom={direction}>
        <motion.article
          key={pageKey}
          custom={direction}
          variants={PAGE_VARIANTS}
          initial='enter'
          animate='center'
          exit='exit'
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className='flex h-full flex-col'
          style={{ transformStyle: 'preserve-3d', transformOrigin: 'center' }}>
          {/* ── Header ── */}
          <header className='border-b border-neutral-border/70 px-5 pb-4 pt-5 sm:px-7 sm:pt-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-gov-forest/70'>
              <span className='inline-flex items-center gap-1 rounded-full bg-gov-forest/10 px-2 py-0.5 font-semibold'>
                <ScrollText size={11} />
                Chapter {chapter.number}
              </span>
              <span className='text-neutral-muted'>·</span>
              <span className='font-semibold text-neutral-muted'>{chapter.title}</span>
            </div>
            <div className='flex items-start gap-3'>
              <span className='shrink-0 rounded-xl bg-gov-gold/20 px-3 py-1.5 font-display text-xl font-bold text-gov-dark'>
                <Hash size={14} className='-mt-1 mr-0.5 inline text-gov-gold' />
                {article.number}
              </span>
              <h3 className='font-display text-2xl leading-tight text-gov-dark sm:text-[1.7rem]'>
                {highlight(article.title, query)}
              </h3>
            </div>
            {article.summary && (
              <p className='mt-3 rounded-xl border border-gov-sage/30 bg-gov-sage/10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-gov-forest'>
                <Bookmark size={13} className='-mt-0.5 mr-1 inline text-gov-sage' />
                {highlight(article.summary, query)}
              </p>
            )}
          </header>

          {/* ── Paragraphs ── */}
          <div className='flex-1 space-y-3 overflow-y-auto px-5 py-5 text-[14.5px] leading-relaxed text-neutral-text sm:px-7 sm:py-6'>
            {article.paragraphs.map((p, i) => (
              <p key={i} className='font-serif first-letter:text-[1.15em] first-letter:font-semibold'>
                {highlight(p, query)}
              </p>
            ))}

            {article.explanation && (
              <div className='mt-4 rounded-xl bg-gradient-to-br from-gov-gold/15 via-gov-sand to-gov-cream/80 p-4 ring-1 ring-gov-gold/30'>
                <div className='mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gov-forest'>
                  <Lightbulb size={13} className='text-gov-gold' />
                  Why it matters
                </div>
                <p className='text-[13.5px] leading-relaxed text-gov-dark'>
                  {highlight(article.explanation, query)}
                </p>
              </div>
            )}

            {article.tags && article.tags.length > 0 && (
              <div className='mt-3 flex flex-wrap gap-1.5 pt-2'>
                {article.tags.map((t) => (
                  <span
                    key={t}
                    className='rounded-full bg-gov-forest/5 px-2 py-0.5 text-[10.5px] font-medium text-gov-forest/70'>
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {showNextChapter && (
              <div className='mt-6 rounded-2xl border border-gov-forest/20 bg-gradient-to-br from-gov-forest/5 via-white to-gov-sage/15 p-4 sm:p-5'>
                <div className='flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gov-forest'>
                  <CheckCircle2 size={13} className='text-gov-sage' />
                  End of Chapter {chapter.number}
                </div>
                <div className='mt-2 flex flex-wrap items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='text-[11px] font-semibold uppercase tracking-wider text-gov-forest/60'>
                      Up next · Chapter {nextChapterNumber}
                    </div>
                    <div className='font-display text-base text-gov-dark sm:text-lg'>
                      {nextChapterTitle}
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={onGoNextChapter}
                    className='inline-flex shrink-0 items-center gap-2 rounded-xl bg-gov-forest px-4 py-2.5 text-sm font-semibold text-white shadow-surface transition-colors hover:bg-gov-dark'>
                    Read Chapter {nextChapterNumber}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer nav ── */}
          <footer className='flex items-center justify-between gap-3 border-t border-neutral-border/70 bg-gov-cream/60 px-5 py-3 sm:px-7'>
            <button
              type='button'
              onClick={onPrev}
              disabled={!hasPrev}
              className='inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gov-forest transition-colors hover:bg-gov-forest/10 disabled:cursor-not-allowed disabled:opacity-30'>
              <ArrowLeft size={16} />
              <span className='hidden sm:inline'>
                {prevLabel ? `Art. ${prevLabel}` : 'Previous'}
              </span>
              <span className='sm:hidden'>Prev</span>
            </button>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-neutral-muted'>
              Article {article.number}
            </div>
            {showNextChapter ? (
              <button
                type='button'
                onClick={onGoNextChapter}
                className='inline-flex items-center gap-2 rounded-lg bg-gov-forest/10 px-3 py-2 text-sm font-semibold text-gov-forest transition-colors hover:bg-gov-forest/20'>
                <span className='hidden sm:inline'>Ch. {nextChapterNumber}</span>
                <span className='sm:hidden'>Next ch.</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type='button'
                onClick={onNext}
                disabled={!hasNext}
                className='inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gov-forest transition-colors hover:bg-gov-forest/10 disabled:cursor-not-allowed disabled:opacity-30'>
                <span className='hidden sm:inline'>
                  {nextLabel ? `Art. ${nextLabel}` : 'Next'}
                </span>
                <span className='sm:hidden'>Next</span>
                <ArrowRight size={16} />
              </button>
            )}
          </footer>
        </motion.article>
      </AnimatePresence>
    </div>
  );
}
