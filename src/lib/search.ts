import type { Movie } from './types';

/**
 * Safe title search. User input is never compiled into a regular expression, so characters like
 * `(`, `[` or `.*` are just text. Matching is on normalised text: lower-case, diacritics removed,
 * punctuation turned into spaces.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

interface Entry {
  movie: Movie;
  title: string;
  words: string[];
  alt: string;
  year: string;
}

export interface SearchIndex {
  entries: readonly Entry[];
}

export function buildSearchIndex(movies: readonly Movie[]): SearchIndex {
  return {
    entries: movies.map((movie) => {
      const title = normalize(movie.title);
      return {
        movie,
        title,
        words: title.split(' '),
        alt: normalize(movie.altTitles.join(' ')),
        year: String(movie.year),
      };
    }),
  };
}

export interface SearchOptions {
  limit?: number;
  exclude?: ReadonlySet<number>;
}

const MAX_QUERY = 100;

const YEAR_TOKEN = /^\d{4}$/;

/** Lower is better; null = no match. */
function rank(entry: Entry, query: string, tokens: string[]): number | null {
  if (entry.title === query) return 0;
  if (entry.title.startsWith(query)) return 1;
  const wordPrefix = (t: string) => entry.words.some((w) => w.startsWith(t)) || (YEAR_TOKEN.test(t) && entry.year === t);
  if (tokens.every(wordPrefix)) return 2;
  const anywhere = (t: string) =>
    entry.title.includes(t) || entry.alt.includes(t) || (YEAR_TOKEN.test(t) && entry.year === t);
  if (tokens.every(anywhere)) return 3;
  return null;
}

export function searchMovies(index: SearchIndex, rawQuery: string, opts: SearchOptions = {}): Movie[] {
  const limit = opts.limit ?? 8;
  const query = normalize(rawQuery.slice(0, MAX_QUERY));
  if (query.length === 0) return [];
  const tokens = query.split(' ');
  const hits: { movie: Movie; r: number }[] = [];
  for (const entry of index.entries) {
    if (opts.exclude?.has(entry.movie.index)) continue;
    const r = rank(entry, query, tokens);
    if (r !== null) hits.push({ movie: entry.movie, r });
  }
  hits.sort((a, b) => a.r - b.r || b.movie.imdbVotes - a.movie.imdbVotes || a.movie.index - b.movie.index);
  return hits.slice(0, limit).map((h) => h.movie);
}
