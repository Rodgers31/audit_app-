/**
 * ConstitutionSearch — debounced, multi-mode search over the Constitution.
 *
 * Three recognised modes (see data/constitution/search.ts for the engine):
 *   • "Article 229"       → direct lookup via meta index.
 *   • "term limits"       → tokenised keyword search with weighted scoring
 *                           and synonym expansion so colloquial phrasing
 *                           finds formal constitutional text.
 *   • short fragment      → shows a "type at least 3 characters" hint.
 *
 * If nothing matches, the dropdown renders a helpful empty state with
 * suggested queries — picking one re-populates the input.
 */
'use client';

import { runSearch, type SearchHit } from '@/data/constitution/search';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Compass, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  onSelect: (chapterNumber: number, articleNumber: number) => void;
  /** Notifies parent of the active query so article text can highlight it. */
  onQueryChange?: (query: string) => void;
  /** Optional default value. */
  defaultValue?: string;
}

/** Suggestions shown when no results match — nudge the user to something useful. */
const SUGGESTIONS: Array<{ label: string; query: string }> = [
  { label: 'Auditor-General', query: 'Auditor General' },
  { label: 'Public debt', query: 'public debt' },
  { label: 'Term limits', query: 'governor term' },
  { label: 'Procurement', query: 'procurement' },
  { label: 'Devolution', query: 'devolution' },
  { label: 'Chapter 6 · integrity', query: 'integrity' },
];

export default function ConstitutionSearch({
  onSelect,
  onQueryChange,
  defaultValue = '',
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [debounced, setDebounced] = useState(defaultValue);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [mode, setMode] = useState<'article' | 'keyword' | 'too-short' | 'empty'>('empty');
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
      setMode('empty');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    runSearch(q, 20).then((res) => {
      if (cancelled) return;
      setHits(res.hits);
      setMode(res.mode);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  /* ── Render ── */
  const query = debounced.trim();
  const showDropdown = open && query.length > 0;
  const showEmpty =
    showDropdown &&
    !isLoading &&
    hits.length === 0 &&
    (mode === 'article' || mode === 'keyword');

  const hintText = useMemo(() => {
    if (!query) return '';
    if (isLoading) return 'Searching…';
    if (mode === 'article') return hits.length ? '1 article' : 'No article with that number yet';
    if (mode === 'too-short') return 'Type at least 3 characters';
    return `${hits.length} result${hits.length === 1 ? '' : 's'}`;
  }, [query, isLoading, hits.length, mode]);

  const applySuggestion = (suggestion: string) => {
    setValue(suggestion);
    setOpen(true);
    inputRef.current?.focus();
  };

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
          placeholder='Search the Constitution — e.g. "term limits", "Article 229"'
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
      {query && (
        <div className='px-1 pt-1 text-[11px] text-neutral-muted'>{hintText}</div>
      )}

      <AnimatePresence>
        {showDropdown && hits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className='absolute left-0 right-0 top-full z-20 mt-2 max-h-[380px] overflow-y-auto rounded-xl border border-neutral-border bg-white/95 shadow-elevated backdrop-blur'>
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

        {showEmpty && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className='absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-neutral-border bg-white/95 p-4 shadow-elevated backdrop-blur'>
            <div className='flex items-start gap-3'>
              <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gov-forest/10 text-gov-forest'>
                <Compass size={16} />
              </span>
              <div className='min-w-0 flex-1'>
                <div className='text-sm font-semibold text-gov-dark'>
                  No matches for &ldquo;{query}&rdquo;
                </div>
                <p className='mt-0.5 text-[12.5px] text-neutral-muted'>
                  The Constitution uses formal wording — try a simpler keyword or pick a topic below.
                </p>
                <div className='mt-2.5 flex flex-wrap gap-1.5'>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type='button'
                      onClick={() => applySuggestion(s.query)}
                      className='rounded-full bg-gov-forest/10 px-2.5 py-1 text-[11.5px] font-medium text-gov-forest hover:bg-gov-forest/15'>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
