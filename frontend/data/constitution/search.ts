/**
 * Shared Constitution search engine.
 *
 * Used by both the Learn hero (live autocomplete) and the
 * ConstitutionBook's inline search. Exposes:
 *
 *   • parseArticleNumber — recognise "Article 229" / "art 229" / "229"
 *   • tokenize + expandWithAliases — split user input, drop stopwords,
 *     fold in a civic synonym map so "term limits" matches "two terms",
 *     "corruption" matches "integrity/ethics/probity", etc.
 *   • scoreArticle — per-article relevance score with weighted fields
 *   • runSearch — the one-shot async searcher the UI components call
 *
 * Results are ranked and capped; the caller decides how many to render.
 */
import type {
  ChapterMeta,
  ConstitutionArticle,
  ConstitutionChapter,
} from './types';
import { CONSTITUTION_META, findChapterForArticle, loadAllChapters } from './index';

/* ───────────────────────── Types ───────────────────────── */

export interface SearchHit {
  chapter: ConstitutionChapter | ChapterMeta;
  article: ConstitutionArticle | { number: number; title: string };
  /** Short excerpt around the best-matching needle. */
  excerpt?: string;
  /** Relevance score, higher is better. */
  score: number;
  /** When true, this hit came from article-number mode (e.g. "Art. 229"). */
  isArticleLookup?: boolean;
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
  election: ['elections', 'vote', 'voters', 'elected'],
  elections: ['election', 'vote', 'voters', 'elected'],
  vote: ['voter', 'voters', 'election'],

  // Audit family
  audit: ['auditor', 'auditor-general'],
  audits: ['audit', 'auditor'],
};

/** Split a query into searchable tokens, discarding noise. */
export function tokenize(query: string): string[] {
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
export function expandWithAliases(tokens: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tokens) {
    seen.add(t);
    const alias = ALIASES[t];
    if (alias) for (const a of alias) seen.add(a.toLowerCase());
  }
  return Array.from(seen);
}

/* ───────────────────────── Parsing ───────────────────────── */

/** Parse "article 229", "art 229", "Article 43" → the integer. */
export function parseArticleNumber(q: string): number | null {
  const m = q.trim().match(/^(?:article|art\.?)\s+(\d+)$/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^\d{1,3}$/.test(q.trim())) return parseInt(q.trim(), 10);
  return null;
}

/* ───────────────────────── Excerpting ───────────────────────── */

/** Pull a ≤160-char snippet around the first token hit. */
export function makeExcerpt(text: string, primary: string | null, all: string[]): string {
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

/* ───────────────────────── Scoring ───────────────────────── */

export function scoreArticle(
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

  if (matched.size > 1) score += (matched.size - 1) * 2;

  const source = excerptSource ?? article.summary ?? article.explanation ?? article.title;
  const excerpt = makeExcerpt(source, excerptNeedle, Array.from(matched));
  return { score, excerpt };
}

/* ───────────────────────── Orchestrator ───────────────────────── */

export interface RunSearchResult {
  mode: 'article' | 'keyword' | 'too-short' | 'empty';
  hits: SearchHit[];
}

/**
 * One-shot search used by autocomplete boxes.
 *
 *   mode === 'article'     → a valid article number parsed from the query
 *   mode === 'keyword'     → token-scored keyword match
 *   mode === 'too-short'   → query exists but is under 3 chars (caller
 *                            may show a hint instead of results)
 *   mode === 'empty'       → query is blank
 *
 * Keyword mode fetches + memoises chapter bodies via loadAllChapters().
 */
export async function runSearch(rawQuery: string, limit = 20): Promise<RunSearchResult> {
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

  const baseTokens = tokenize(q);
  if (baseTokens.length === 0) return { mode: 'keyword', hits: [] };
  const tokens = expandWithAliases(baseTokens);

  const chapters = await loadAllChapters();
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

  // Meta-only fallback for chapters whose body isn't loaded.
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
  return { mode: 'keyword', hits: scored.slice(0, limit) };
}
