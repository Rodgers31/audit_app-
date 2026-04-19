/**
 * Constitution search — backed by MiniSearch (BM25 + stemming + fuzzy).
 *
 * Three recognised modes:
 *   • "Article 229"       → direct lookup via the meta index.
 *   • "term limits"       → BM25 keyword search with prefix + fuzzy matching,
 *                           scored across title / summary / explanation /
 *                           paragraphs / tags with sensible field boosts.
 *   • short fragment      → "too-short" hint shown by callers.
 *
 * No hand-curated synonym map: MiniSearch handles prefix expansion
 * (presid* → president/presidential) and typo tolerance out of the box.
 * A later revision layers semantic search on top of this to catch queries
 * whose vocabulary doesn't overlap the Constitution's formal wording.
 */
import MiniSearch, { type SearchResult } from 'minisearch';
import { stemmer } from 'stemmer';

import type {
  ChapterMeta,
  ConstitutionArticle,
  ConstitutionChapter,
} from './types';
import { CONSTITUTION_META, findChapterForArticle, loadAllChapters } from './index';

/**
 * Token processor — applied identically at index and query time so the two
 * sides always use the same vocabulary.
 *
 *   1. Lowercase + strip punctuation
 *   2. Drop stop-words *and* fragments shorter than 3 characters (these
 *      hurt BM25 more than they help)
 *   3. Porter-stem: "terms" → "term", "elections" → "elect", etc.
 *
 * We do not maintain a synonym map. "Smart enough" for vocabulary mismatches
 * like "presidential" ↔ "president" is delivered by the semantic layer
 * that wraps this index (see semantic-search.ts).
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'for', 'to',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'what', 'who', 'which', 'how', 'why', 'when', 'where', 'that',
  'this', 'these', 'those', 'it', 'its', 'as', 'at', 'can', 'do',
  'does', 'did', 'has', 'have', 'had', 'about', 'into', 'any',
  'all', 'not', 'no',
]);

/**
 * Pre-strip common adjective-forming suffixes so "presidential" collapses
 * to "president" before Porter runs. Porter alone keeps them on separate
 * stems ("presidenti" vs "presid") which breaks matching.
 *
 * Longest suffixes first so "ical" is tried before "al".
 */
const ADJ_SUFFIXES = ['ical', 'ary', 'ory', 'ial', 'ual', 'ic', 'al'];

function preStem(s: string): string {
  if (s.length < 6) return s;
  for (const suf of ADJ_SUFFIXES) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) {
      return s.slice(0, -suf.length);
    }
  }
  return s;
}

function processTerm(term: string): string | null {
  const lower = term.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.length < 3) return null;
  if (STOP_WORDS.has(lower)) return null;
  return stemmer(preStem(lower));
}

/* ───────────────────────── Types ───────────────────────── */

export interface SearchHit {
  chapter: ConstitutionChapter | ChapterMeta;
  article: ConstitutionArticle | { number: number; title: string };
  /** Short excerpt around the best-matching term. */
  excerpt?: string;
  /** Relevance score (higher is better). Scale differs per mode. */
  score: number;
  /** True when this hit came from article-number mode (e.g. "Art. 142"). */
  isArticleLookup?: boolean;
}

export interface RunSearchResult {
  mode: 'article' | 'keyword' | 'too-short' | 'empty';
  hits: SearchHit[];
}

/* ───────────────────────── Parsing ───────────────────────── */

/** Parse "article 142", "art 142", "Article 43" → the integer. */
export function parseArticleNumber(q: string): number | null {
  const m = q.trim().match(/^(?:article|art\.?)\s+(\d+)$/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^\d{1,3}$/.test(q.trim())) return parseInt(q.trim(), 10);
  return null;
}

/* ───────────────────────── Index build ───────────────────────── */

/**
 * Row fed into MiniSearch. The id is synthetic so results can round-trip
 * back to the right article/chapter objects via `byId`.
 */
interface ArticleRow {
  id: string;
  chapterNumber: number;
  articleNumber: number;
  title: string;
  chapterTitle: string;
  summary: string;
  explanation: string;
  paragraphs: string;
  tags: string;
}

const ROW_ID = (ch: number, art: number) => `${ch}:${art}`;

function buildRow(
  chapter: ConstitutionChapter,
  article: ConstitutionArticle
): ArticleRow {
  return {
    id: ROW_ID(chapter.number, article.number),
    chapterNumber: chapter.number,
    articleNumber: article.number,
    title: article.title,
    chapterTitle: chapter.title,
    summary: article.summary ?? '',
    explanation: article.explanation ?? '',
    paragraphs: article.paragraphs.join(' '),
    tags: (article.tags ?? []).join(' '),
  };
}

type Index = {
  mini: MiniSearch<ArticleRow>;
  byId: Map<string, { chapter: ConstitutionChapter; article: ConstitutionArticle }>;
};

let INDEX_PROMISE: Promise<Index> | null = null;

async function getIndex(): Promise<Index> {
  if (INDEX_PROMISE) return INDEX_PROMISE;
  INDEX_PROMISE = (async () => {
    const chapters = await loadAllChapters();
    const mini = new MiniSearch<ArticleRow>({
      fields: ['title', 'chapterTitle', 'summary', 'explanation', 'paragraphs', 'tags'],
      storeFields: ['chapterNumber', 'articleNumber', 'title'],
      processTerm: (term) => processTerm(term) ?? undefined,
      searchOptions: {
        processTerm: (term) => processTerm(term) ?? undefined,
        boost: {
          title: 5,
          tags: 4,
          summary: 3,
          explanation: 2.5,
          chapterTitle: 2,
          paragraphs: 1,
        },
        fuzzy: (term) => (term.length >= 6 ? 0.25 : 0),
        prefix: (term) => term.length >= 4,
        // OR-combine: documents matching more query tokens naturally rank
        // higher via BM25. AND was too strict — "presidential term limits"
        // failed because Article 142 says "two terms", not "limit".
        combineWith: 'OR',
      },
    });
    const byId = new Map<
      string,
      { chapter: ConstitutionChapter; article: ConstitutionArticle }
    >();
    const rows: ArticleRow[] = [];
    for (const ch of chapters) {
      for (const a of ch.articles) {
        rows.push(buildRow(ch, a));
        byId.set(ROW_ID(ch.number, a.number), { chapter: ch, article: a });
      }
    }
    mini.addAll(rows);
    return { mini, byId };
  })();
  return INDEX_PROMISE;
}

/* ───────────────────────── Excerpting ───────────────────────── */

/** Pull a ≤160-char snippet around the first matched term. */
function makeExcerpt(text: string, needles: string[]): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  let idx = -1;
  let nlen = 0;
  for (const n of needles) {
    if (!n) continue;
    const j = lower.indexOf(n);
    if (j !== -1 && (idx === -1 || j < idx)) {
      idx = j;
      nlen = n.length;
    }
  }
  if (idx === -1) {
    return text.slice(0, 140) + (text.length > 140 ? '…' : '');
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + nlen + 100);
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end) +
    (end < text.length ? '…' : '')
  );
}

function pickExcerpt(
  article: ConstitutionArticle,
  matchedTerms: string[]
): string {
  const pool = [
    article.summary ?? '',
    article.explanation ?? '',
    ...article.paragraphs,
  ].filter(Boolean);
  for (const source of pool) {
    const lower = source.toLowerCase();
    for (const t of matchedTerms) {
      if (t && lower.includes(t)) {
        return makeExcerpt(source, matchedTerms);
      }
    }
  }
  return makeExcerpt(pool[0] ?? article.title, matchedTerms);
}

/* ───────────────────────── Orchestrator ───────────────────────── */

/**
 * One-shot search used by autocomplete boxes.
 *
 *   mode === 'article'     → a valid article number parsed from the query.
 *   mode === 'keyword'     → BM25 keyword match via MiniSearch.
 *   mode === 'too-short'   → query exists but is under 3 chars.
 *   mode === 'empty'       → query is blank.
 */
export async function runSearch(
  rawQuery: string,
  limit = 20
): Promise<RunSearchResult> {
  const q = rawQuery.trim();
  if (q.length === 0) return { mode: 'empty', hits: [] };

  // Article-number mode.
  const articleNum = parseArticleNumber(q);
  if (articleNum !== null) {
    const meta = findChapterForArticle(articleNum);
    if (!meta) return { mode: 'article', hits: [] };
    const metaArticle = meta.articleTitles.find((a) => a.number === articleNum);
    if (!metaArticle) return { mode: 'article', hits: [] };
    return {
      mode: 'article',
      hits: [
        {
          chapter: meta,
          article: metaArticle,
          excerpt: `Open Article ${articleNum} in Chapter ${meta.number}`,
          score: 100,
          isArticleLookup: true,
        },
      ],
    };
  }

  if (q.length < 3) return { mode: 'too-short', hits: [] };

  const { mini, byId } = await getIndex();
  const results: SearchResult[] = mini.search(q);
  const hits: SearchHit[] = [];
  for (const r of results.slice(0, limit)) {
    const entry = byId.get(String(r.id));
    if (!entry) continue;
    const matchedTerms = Object.keys(r.match ?? {}).map((s) => s.toLowerCase());
    hits.push({
      chapter: entry.chapter,
      article: entry.article,
      excerpt: pickExcerpt(entry.article, matchedTerms),
      score: r.score,
    });
  }

  // Safety net: if MiniSearch's AND-combine matched nothing but a chapter
  // title obviously contains the query (e.g. "judiciary"), surface the
  // chapter's first article so the user has a sensible click target.
  if (hits.length === 0) {
    const lower = q.toLowerCase();
    for (const meta of CONSTITUTION_META) {
      if (meta.title.toLowerCase().includes(lower)) {
        const first = meta.articleTitles[0];
        if (first) {
          hits.push({
            chapter: meta,
            article: first,
            excerpt: `${meta.title} — Chapter ${meta.number}`,
            score: 1,
          });
        }
      }
    }
  }

  return { mode: 'keyword', hits };
}

/* ───────────────────────── Test-only helpers ───────────────────────── */

/** Reset the memoised index — used by unit tests between cases. */
export function __resetIndex() {
  INDEX_PROMISE = null;
}
