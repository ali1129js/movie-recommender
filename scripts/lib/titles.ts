/**
 * MovieLens title parser.
 *
 * MovieLens stores titles as `Name, The (Alternative Title, La) (1995)`. The year is always last,
 * alternative titles (original-language titles and "a.k.a." names) come in parentheses before it,
 * and a leading article is moved to the end of each name. This turns that into display form and
 * guarantees a real year, so no title can end up with year 0.
 */

const ARTICLES = [
  'The', 'A', 'An', 'Il', 'Le', 'La', 'Les', 'Lo', 'Gli', "L'", 'Der', 'Die', 'Das', 'El', 'Los',
  'Las', 'Un', 'Une', 'Het', 'Ein', 'Eine',
];

const ARTICLE_RE = new RegExp(`^(.+), (${ARTICLES.map((a) => a.replace("'", "\\'")).join('|')})$`);
const YEAR_RE = /\(\s*(\d{4})(?:\s*[-–]\s*\d{0,4})?\s*\)\s*$/;
const TRAILING_GROUP_RE = /\s*\(([^()]+)\)\s*$/;

export interface ParsedTitle {
  /** Display title in natural word order, e.g. "The Usual Suspects". */
  title: string;
  /** Release year, or null when the source title has none (such titles are dropped upstream). */
  year: number | null;
  /** Alternative titles in natural order (original-language names, a.k.a. names). */
  alt: string[];
}

/** "Usual Suspects, The" -> "The Usual Suspects"; "Atalante, L'" -> "L'Atalante". */
export function fixArticle(name: string): string {
  const m = ARTICLE_RE.exec(name.trim());
  if (!m) return name.trim();
  const [, rest, article] = m;
  if (rest === undefined || article === undefined) return name.trim();
  return article.endsWith("'") ? `${article}${rest}` : `${article} ${rest}`;
}

export function parseMovieLensTitle(raw: string): ParsedTitle {
  let text = raw.normalize('NFC').trim();
  let year: number | null = null;

  const y = YEAR_RE.exec(text);
  if (y?.[1]) {
    year = Number(y[1]);
    text = text.slice(0, y.index).trim();
  }

  const groups: string[] = [];
  for (;;) {
    const g = TRAILING_GROUP_RE.exec(text);
    // Never swallow the entire title: "(500) Days of Summer" keeps its parentheses.
    if (!g || g.index === 0 || !g[1]) break;
    groups.unshift(g[1]);
    text = text.slice(0, g.index).trim();
  }

  const alt = groups
    .flatMap((group) => group.split(/\s*;\s*/))
    .map((a) => a.replace(/^a\.k\.a\.\s*/i, '').trim())
    .filter((a) => a.length > 0)
    .map(fixArticle);

  return { title: fixArticle(text), year, alt };
}
