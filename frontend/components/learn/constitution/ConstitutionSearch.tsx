/**
 * ConstitutionSearch — debounced, multi-mode search over the Constitution.
 *
 * Three recognised modes:
 *   • "Article 229"       → direct lookup via meta index (sync, no fetch).
 *   • "term limits"       → tokenised keyword search with weighted scoring
 *                           across every loaded chapter. Also consults a
 *                           small civic-synonym map so e.g. "term limits"
 *                           expands to match "term", "tenure", "re-election"
 *                           which is how the actual constitutional text reads.
 *   • short fragment      → shows a "type at least 3 characters" hint.
 *
 * Scoring weights (per matched unique token):
 *     title      ×5     summary  ×3    explanation ×3
 *     tags       ×2     chapter title ×2    paragraph ×1
 *   + bonus of +2 per extra unique token matched across fields.
 *
 * If nothing matches, the dropdown renders a helpful empty state with
 * suggested queries — picking one re-populates the input.
 */
'use client';

import {
  CONSTITUTION_META,
  findChapterForArticle,
  loadAllChapters,
} from '@/data/constitution';
import type {
  ChapterMeta,
  ConstitutionArticle,
  ConstitutionChapter,
} from '@/data/constitution/types';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Compass, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface SearchHit {
  chapter: ConstitutionChapter | ChapterMeta;
  article: ConstitutionArticle | { number: number; title: string };
  /** Short excerpt around the best-matching needle. */
  excerpt?: string;
  /** Relevance score, higher is better. */
  score: number;
}

interface Props {
  onSelect: (chapterNumber: number, articleNumber: number) => void;
  /** Notifies parent of the active query so article text can highlight it. */
  onQueryChange?: (query: string) => void;
  /** Optional default value. */
  defaultValue?: string;
}

/* ───────────────────────── Tokenisation ───────────────────────── */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'for', 'to',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'what', 'who', 'which', 'how', 'why', 'when', 'where', 'that',
  'this', 'these', 'those', 'it', 'its', 'as', 'at', 'can', 'do',
  'does', 'did', 'has', 'have', 'had', 'about', 'into',
]);

/**
 * Map a single user token to extra OR-match tokens. Curated to bridge
 * the gap between colloquial civic language and the Constitution's
 * formal wording. Keyed by lowercased user token.
 */
const ALIASES: Record<string, string[]> = {
  // Term-limit family
  term: ['tenure', 'years', 're-election', 'reelection', 're-appointment'],
  terms: ['term', 'tenure', 're-election', 'reelection'],
  limit: ['limits', 'limited', 'maximum', 'cap', 'not eligible'],
  limits: ['limit', 'maximum', 'cap', 'not eligible'],
  reelection: ['re-election', 'term', 'eligible'],

  // Offices
  president: ['executive', 'head of state'],
  governor: ['county government', 'county executive', 'governors'],
  governors: ['governor', 'county executive'],
  mp: ['parliament', 'national assembly'],
  mca: ['county assembly', 'member'],
  auditor: ['auditor-general', 'audit'],
  'auditor-general': ['auditor', 'audit'],

  // Themes
  corruption: ['integrity', 'ethics', 'probity', 'anti-corruption'],
  impeach: ['removal', 'dismissal'],
  impeachment: ['removal', 'dismissal'],
  debt: ['borrowing', 'loan', 'loans', 'liabilities'],
  budget: ['appropriation', 'estimates', 'expenditure'],
  procurement: ['public goods', 'tendering'],
  devolution: ['devolved', 'county government', 'counties'],
  county: ['counties', 'devolved', 'county government'],
  elections: ['election', 'vote', 'voters'],
  vote: ['voter', 'voters', 'election'],

  // Audit family
  audit: ['auditor', 'auditor-general'],
  audits: ['audit', 'auditor'],
};

/** Split a query into searchable tokens, discarding noise. */
function tokenize(query: string): string[] {
  const lower = query.toLowerCase();
  const raw = lower.split(/[^a-z0-9\-]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 3) continue;
    if (STOP_WORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

/** Fold in aliases — returns a de-duplicated list of tokens to OR-match. */
function expandWithAliases(tokens: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tokens) {
    seen.add(t);
    const alias = ALIASES[t];
    if (alias) for (const a of alias) seen.add(a.toLowerCase());
  }
  return Array.from(seen);
}

/* ───────────────────────── Scoring ───────────────────────── */

function scoreArticle(
  chapter: ConstitutionChapter,
  article: ConstitutionArticle,
  tokens: string[]
): { score: number; excerpt: string } | null {
  const title = article.title.toLowerCase();
  const summary = article.summary?.toLowerCase() ?? '';
  const explanation = article.explanation?.toLowerCase() ?? '';
  const tags = (article.tags ?? []).join(' ').toLowerCase();
  const chapterTitle = chapter.title.toLowerCase();

  let score = 0;
  let excerptSource: string | null = null;
  let excerptNeedle: string | null = null;
  const matched = new Set<string>();

  const hit = (field: string, token: string, weight: number, source?: string) => {
    if (!field.includes(token)) return;
    score += weight;
    matched.add(token);
    if (source && !excerptSource) {
      excerptSource = source;
      excerptNeedle = token;
    }
  };

  for (const t of tokens) {
    hit(title, t, 5, article.title);
    hit(chapterTitle, t, 2);
    hit(summary, t, 3, article.summary);
    hit(explanation, t, 3, article.explanation);
    hit(tags, t, 2);
    for (const p of article.paragraphs) {
      const pLower = p.toLowerCase();
      if (pLower.includes(t)) {
        score += 1;
        matched.add(t);
        if (!excerptSource) {
          excerptSource = p;
          excerptNeedle = t;
        }
      }
    }
  }

  if (score === 0) return null;

  // Reward articles matching multiple distinct tokens.
  if (matched.size > 1) score += (matched.size - 1) * 2;

  const source = excerptSource ?? article.summary ?? article.explanation ?? article.title;
  const excerpt = makeExcerpt(source, excerptNeedle, Array.from(matched));
  return { score, excerpt };
}

/** Pull a ≤160-char snippet around the first token hit. */
function makeExcerpt(text: string, primary: string | null, all: string[]): string {
  const lower = text.toLowerCase();
  let idx = primary ? lower.indexOf(primary) : -1;
  let needleLen = primary?.length ?? 0;
  if (idx === -1) {
    for (const n of all) {
      const j = lower.indexOf(n);
      if (j !== -1 && (idx === -1 || j < idx)) {
        idx = j;
        needleLen = n.length;
      }
    }
  }
  if (idx === -1) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + needleLen + 100);
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end) +
    (end < text.length ? '…' : '')
  );
}

/* ───────────────────────── Parsing ───────────────────────── */

/** Parse "article 229", "art 229", "Article 43" → the integer. */
function parseArticleNumber(q: string): number | null {
  const m = q.trim().match(/^(?:article|art\.?)\s+(\d+)$/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^\d{1,3}$/.test(q.trim())) return parseInt(q.trim(), 10);
  return null;
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

/* ───────────────────────── Component ───────────────────────── */

export default function ConstitutionSearch({
  onSelect,
  onQueryChange,
  defaultValue = '',
}: Props) {
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

    // 1. Article-number mode: synchronous lookup.
    const articleNum = parseArticleNumber(q);
    if (articleNum !== null) {
      const meta = findChapterForArticle(articleNum);
      if (meta) {
        const metaArticle = meta.articleTitles.find((a) => a.number === articleNum);
        setHits(
          metaArticle
            ? [
                {
                  chapter: meta,
                  article: metaArticle,
                  excerpt: `Open Article ${articleNum} in Chapter ${meta.number}`,
                  score: 100,
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

    // 2. Keyword mode: tokenise, expand with aliases, score each article.
    const baseTokens = tokenize(q);
    if (baseTokens.length === 0) {
      setHits([]);
      setIsLoading(false);
      return;
    }
    const tokens = expandWithAliases(baseTokens);

    let cancelled = false;
    setIsLoading(true);
    loadAllChapters().then((chapters) => {
      if (cancelled) return;
      const scored: SearchHit[] = [];
      for (const ch of chapters) {
        for (const a of ch.articles) {
          const r = scoreArticle(ch, a, tokens);
          if (r) {
            scored.push({
              chapter: ch,
              article: a,
              excerpt: r.excerpt,
              score: r.score,
            });
          }
        }
      }

      // Also consider meta-only matches for chapters where the article
      // body is not yet loaded — rare but keeps the pattern robust.
      for (const meta of CONSTITUTION_META) {
        const bodyKnown = chapters.some((c) => c.number === meta.number);
        if (bodyKnown) continue;
        for (const a of meta.articleTitles) {
          const titleLower = a.title.toLowerCase();
          let s = 0;
          const matched = new Set<string>();
          for (const t of tokens) {
            if (titleLower.includes(t)) {
              s += 4;
              matched.add(t);
            }
          }
          if (s > 0) {
            scored.push({
              chapter: meta,
              article: a,
              excerpt: `Chapter ${meta.number} · ${meta.title}`,
              score: s + (matched.size - 1) * 2,
            });
          }
        }
      }

      scored.sort((a, b) => b.score - a.score);
      setHits(scored.slice(0, 20));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  /* ── Render ── */
  const query = debounced.trim();
  const isArticleQuery = query.length > 0 && parseArticleNumber(query) !== null;
  const showDropdown = open && query.length > 0;
  const showEmpty =
    showDropdown && !isLoading && hits.length === 0 && (isArticleQuery || query.length >= 3);

  const hintText = useMemo(() => {
    if (!query) return '';
    if (isLoading) return 'Searching…';
    if (isArticleQuery) return hits.length ? '1 article' : 'No article with that number yet';
    if (query.length < 3) return 'Type at least 3 characters';
    return `${hits.length} result${hits.length === 1 ? '' : 's'}`;
  }, [query, isLoading, hits.length, isArticleQuery]);

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
