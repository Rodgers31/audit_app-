/**
 * ConstitutionSearch — debounced, multi-mode search over the Constitution.
 *
 * Matches two input styles:
 *   • "Article 229"   → direct article lookup via meta index (sync, no fetch).
 *   • "auditor"       → keyword search over every chapter; batch-loads once
 *                      through loadAllChapters() (memoised by the data layer).
 *
 * Results show as a dropdown under the input. Picking one delegates to the
 * caller via onSelect(chapter, article).
 */
'use client';

import {
  findChapterForArticle,
  loadAllChapters,
} from '@/data/constitution';
import type { ChapterMeta, ConstitutionArticle, ConstitutionChapter } from '@/data/constitution/types';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface SearchHit {
  chapter: ConstitutionChapter | ChapterMeta;
  article: ConstitutionArticle | { number: number; title: string };
  /** Short excerpt around the match. */
  excerpt?: string;
}

interface Props {
  onSelect: (chapterNumber: number, articleNumber: number) => void;
  /** Notifies parent of the active query so article text can highlight it. */
  onQueryChange?: (query: string) => void;
  /** Optional default value. */
  defaultValue?: string;
}

/** Pull a <= 140-char snippet around the first match. */
function makeExcerpt(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 120) + (text.length > 120 ? '…' : '');
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + query.length + 70);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

/** Parse "article 229", "art 229", "Article 43" → 229/43. */
function parseArticleNumber(q: string): number | null {
  const m = q.trim().match(/^(?:article|art\.?)\s+(\d+)$/i);
  if (m) return parseInt(m[1]!, 10);
  // Also accept plain integer
  if (/^\d{1,3}$/.test(q.trim())) return parseInt(q.trim(), 10);
  return null;
}

export default function ConstitutionSearch({ onSelect, onQueryChange, defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [debounced, setDebounced] = useState(defaultValue);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* ── Debounce ── */
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 220);
    return () => clearTimeout(id);
  }, [value]);

  /* ── Notify parent so viewer can highlight ── */
  useEffect(() => {
    onQueryChange?.(debounced);
  }, [debounced, onQueryChange]);

  /* ── Close on outside click ── */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  /* ── Run search ── */
  useEffect(() => {
    const q = debounced.trim();
    if (q.length === 0) {
      setHits([]);
      setIsLoading(false);
      return;
    }

    // Article-number mode: synchronous lookup.
    const articleNum = parseArticleNumber(q);
    if (articleNum !== null) {
      const meta = findChapterForArticle(articleNum);
      if (meta) {
        const meta_article = meta.articleTitles.find((a) => a.number === articleNum);
        setHits(
          meta_article
            ? [
                {
                  chapter: meta,
                  article: meta_article,
                  excerpt: `Open Article ${articleNum} in Chapter ${meta.number}`,
                },
              ]
            : []
        );
      } else {
        setHits([]);
      }
      setIsLoading(false);
      return;
    }

    if (q.length < 3) {
      setHits([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    loadAllChapters().then((chapters) => {
      if (cancelled) return;
      const needle = q.toLowerCase();
      const out: SearchHit[] = [];
      for (const ch of chapters) {
        for (const a of ch.articles) {
          const inTitle = a.title.toLowerCase().includes(needle);
          const inSummary = a.summary?.toLowerCase().includes(needle);
          const paraMatch = a.paragraphs.find((p) => p.toLowerCase().includes(needle));
          const explMatch = a.explanation?.toLowerCase().includes(needle);
          if (inTitle || inSummary || paraMatch || explMatch) {
            out.push({
              chapter: ch,
              article: a,
              excerpt: makeExcerpt(
                paraMatch || a.summary || a.explanation || a.title,
                q
              ),
            });
          }
          if (out.length >= 18) break;
        }
        if (out.length >= 18) break;
      }
      setHits(out);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  /* ── Render ── */
  const showDropdown = open && debounced.trim().length > 0;
  const hintText = useMemo(() => {
    const q = debounced.trim();
    if (!q) return '';
    if (isLoading) return 'Searching…';
    if (parseArticleNumber(q) !== null) return hits.length ? '1 article' : 'No article with that number';
    if (q.length < 3) return 'Type at least 3 characters';
    return `${hits.length} result${hits.length === 1 ? '' : 's'}`;
  }, [debounced, isLoading, hits.length]);

  return (
    <div ref={wrapperRef} className='relative w-full'>
      <div className='group relative'>
        <Search
          size={16}
          className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gov-forest/60'
        />
        <input
          ref={inputRef}
          type='text'
          inputMode='search'
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder='Search the Constitution — e.g. "Article 229" or "Auditor General"'
          className='w-full rounded-xl border border-neutral-border bg-white/90 py-2.5 pl-10 pr-16 text-sm text-neutral-text shadow-surface outline-none placeholder:text-neutral-muted focus:border-gov-sage focus:ring-2 focus:ring-gov-sage/30'
        />
        <div className='pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2'>
          {isLoading && <Loader2 size={14} className='animate-spin text-gov-forest/60' />}
          {value && (
            <button
              type='button'
              className='pointer-events-auto rounded-full p-0.5 text-neutral-muted hover:bg-neutral-border/50 hover:text-gov-dark'
              onClick={() => {
                setValue('');
                setDebounced('');
                setHits([]);
                inputRef.current?.focus();
              }}
              aria-label='Clear search'>
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {debounced && (
        <div className='px-1 pt-1 text-[11px] text-neutral-muted'>{hintText}</div>
      )}

      <AnimatePresence>
        {showDropdown && hits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className='absolute left-0 right-0 top-full z-20 mt-2 max-h-[360px] overflow-y-auto rounded-xl border border-neutral-border bg-white/95 shadow-elevated backdrop-blur'>
            <ul className='py-1'>
              {hits.map((h, i) => (
                <li key={`${h.chapter.number}-${h.article.number}-${i}`}>
                  <button
                    type='button'
                    onClick={() => {
                      onSelect(h.chapter.number, h.article.number);
                      setOpen(false);
                    }}
                    className='group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gov-forest/5'>
                    <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gov-gold/20 font-display text-sm font-bold text-gov-dark'>
                      {h.article.number}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gov-forest/70'>
                        <span>Ch {h.chapter.number}</span>
                        <span>·</span>
                        <span className='truncate text-neutral-muted normal-case tracking-normal'>
                          {h.chapter.title}
                        </span>
                      </div>
                      <div className='truncate text-sm font-semibold text-neutral-text'>
                        {h.article.title}
                      </div>
                      {h.excerpt && (
                        <div className='mt-0.5 line-clamp-2 text-[12px] text-neutral-muted'>
                          {h.excerpt}
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={14}
                      className='mt-2 shrink-0 text-neutral-muted group-hover:text-gov-forest'
                    />
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
