/**
 * prose.tsx — turn a Constitution paragraph into clickable JSX.
 *
 * Two transforms compose in a single pass so they don't fight each
 * other and produce double-wrapped markup:
 *   1. Cross-references — "Article 152", "Articles 154", "Chapter 12" —
 *      become buttons that invoke the caller's navigate handler.
 *   2. Search highlight — a case-insensitive literal match for `query`
 *      gets wrapped in <mark>.
 *
 * Unknown article/chapter numbers (e.g. a typo in the JSON) are left
 * as plain text, so we never ship a dead link.
 */
import type React from 'react';

import { CONSTITUTION_META, findChapterForArticle } from '@/data/constitution';

/**
 * Matches:
 *   - "Article 152"      → { kind: 'article', n: 152 }
 *   - "Articles 156"     → { kind: 'article', n: 156 }
 *   - "Article 152(2)"   → navigate to Art. 152; the "(2)" marker is
 *                          cosmetic — we don't jump to subparagraphs.
 *   - "Chapter 12"       → { kind: 'chapter', n: 12 }
 *
 * Skipped by design:
 *   - clause markers like "(1)", "(a)", "sub-paragraph (i)" — these
 *     are intra-article and have no useful navigation target.
 *   - phrases like "this Constitution" — self-referential.
 */
const REF_RE = /\b(Article|Articles|Chapter)\s+(\d+)(\([A-Za-z0-9]+\))?/g;

export type ReferenceTarget =
  | { kind: 'article'; articleNumber: number; chapterNumber: number }
  | { kind: 'chapter'; chapterNumber: number };

interface RenderProseOptions {
  query?: string;
  onRefClick?: (target: ReferenceTarget) => void;
}

/** Single entry point — returns JSX ready to splat into a <p>. */
export function renderProse(
  text: string,
  { query, onRefClick }: RenderProseOptions = {},
): React.ReactNode {
  const refs = findReferences(text);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const ref of refs) {
    // Plain text before this reference — still needs search-highlight.
    if (ref.start > cursor) {
      out.push(
        <span key={`t-${key++}`}>
          {highlightSearch(text.slice(cursor, ref.start), query)}
        </span>,
      );
    }
    const label = text.slice(ref.start, ref.end);
    if (ref.target && onRefClick) {
      out.push(
        <button
          key={`r-${key++}`}
          type='button'
          onClick={() => onRefClick(ref.target!)}
          className='inline rounded px-0.5 font-semibold text-gov-forest decoration-gov-forest/40 decoration-dotted underline-offset-2 hover:bg-gov-forest/5 hover:underline focus:outline-none focus:ring-2 focus:ring-gov-forest/30'>
          {highlightSearch(label, query)}
        </button>,
      );
    } else {
      // Unknown article/chapter number — render as plain text so we
      // never ship a button that goes nowhere.
      out.push(
        <span key={`u-${key++}`}>{highlightSearch(label, query)}</span>,
      );
    }
    cursor = ref.end;
  }
  if (cursor < text.length) {
    out.push(
      <span key={`tail-${key++}`}>
        {highlightSearch(text.slice(cursor), query)}
      </span>,
    );
  }
  return <>{out}</>;
}

/* ── internals ── */

interface FoundRef {
  start: number;
  end: number;
  target: ReferenceTarget | null;
}

function findReferences(text: string): FoundRef[] {
  const out: FoundRef[] = [];
  for (const match of text.matchAll(REF_RE)) {
    const [whole, kindWord, numStr] = match;
    const n = Number.parseInt(numStr!, 10);
    const start = match.index!;
    const end = start + whole.length;
    const isChapter = kindWord!.toLowerCase() === 'chapter';
    let target: ReferenceTarget | null = null;
    if (isChapter) {
      if (CONSTITUTION_META.some((m) => m.number === n)) {
        target = { kind: 'chapter', chapterNumber: n };
      }
    } else {
      const meta = findChapterForArticle(n);
      if (meta) {
        target = { kind: 'article', articleNumber: n, chapterNumber: meta.number };
      }
    }
    out.push({ start, end, target });
  }
  return out;
}

/** Cheap case-insensitive token highlight — mirror of the old helper
 * inside ArticleViewer. Kept here so prose rendering is a single pass. */
function highlightSearch(text: string, query?: string): React.ReactNode {
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
      </mark>,
    );
    i = j + q.length;
  }
  return <>{out}</>;
}
