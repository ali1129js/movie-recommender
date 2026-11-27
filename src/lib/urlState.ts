import { z } from 'zod';
import { GENRES, genreBit, maskToGenres } from './genres';
import type { Filters, Mode, SortKey } from './recommender';
import { MAX_PICKS } from './state';
import type { Catalog } from './types';

/**
 * The shareable part of the app state, kept in the query string so a link reopens the same recommendations:
 *
 *   ?picks=tt0113277,tt0114369&genres=Crime,Thriller&decade=1990&lang=en&mode=gems&sort=imdb
 *
 * Films are stored by IMDb id, not by catalogue position, so a link survives a data rebuild that reorders
 * the catalogue. Anything that does not validate is dropped, never thrown.
 */
export const PARAM = { picks: 'picks', genres: 'genres', decade: 'decade', lang: 'lang', mode: 'mode', sort: 'sort' } as const;

const modeSchema = z.enum(['popular', 'gems']) satisfies z.ZodType<Mode>;
const sortSchema = z.enum(['relevance', 'imdb', 'newest', 'oldest']) satisfies z.ZodType<SortKey>;
const decadeSchema = z.coerce.number().int().min(1880).max(2100).multipleOf(10);
const langSchema = z.string().regex(/^[a-z]{2}$/);
const IMDB_ID = /^tt(\d{7,9})$/;

export interface UrlSelection {
  /** IMDb ids in the order they appear, duplicates removed, capped at `MAX_PICKS`. */
  readonly imdbIds: readonly number[];
  readonly genreMask: number;
  readonly decade: number | null;
  readonly language: string | null;
  readonly mode: Mode | null;
  readonly sort: SortKey | null;
}

const list = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

/** Parses the query string. Malformed values are dropped; this never throws. */
export function parseSelection(search: string): UrlSelection {
  const params = new URLSearchParams(search);
  const ids: number[] = [];
  for (const token of list(params.get(PARAM.picks))) {
    const match = IMDB_ID.exec(token);
    const id = match ? Number(match[1]) : NaN;
    if (id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_PICKS) break;
  }
  let genreMask = 0;
  for (const g of list(params.get(PARAM.genres))) genreMask |= genreBit(g);
  const decade = decadeSchema.safeParse(params.get(PARAM.decade) ?? undefined);
  const language = langSchema.safeParse(params.get(PARAM.lang));
  const mode = modeSchema.safeParse(params.get(PARAM.mode));
  const sort = sortSchema.safeParse(params.get(PARAM.sort));
  return {
    imdbIds: ids,
    genreMask,
    decade: decade.success ? decade.data : null,
    language: language.success ? language.data : null,
    mode: mode.success ? mode.data : null,
    sort: sort.success ? sort.data : null,
  };
}

export const hasSelection = (sel: UrlSelection): boolean =>
  sel.imdbIds.length > 0 || sel.genreMask !== 0 || sel.decade !== null || sel.language !== null || sel.mode !== null || sel.sort !== null;

/** Maps IMDb ids to catalogue indices. Ids the catalogue does not know (yet) are returned in `missing`. */
export function resolvePicks(imdbIds: readonly number[], catalog: Catalog): { picks: number[]; missing: number[] } {
  const byImdb = new Map<number, number>();
  for (const m of catalog.movies) byImdb.set(m.imdbId, m.index);
  const picks: number[] = [];
  const missing: number[] = [];
  for (const id of imdbIds) {
    const index = byImdb.get(id);
    if (index === undefined) missing.push(id);
    else picks.push(index);
  }
  return { picks, missing };
}

export interface ShareableState {
  readonly picks: readonly number[];
  readonly filters: Filters;
  readonly mode: Mode;
  readonly sort: SortKey;
}

const imdbToken = (id: number): string => `tt${String(id).padStart(7, '0')}`;

/**
 * Writes the shareable state into `search`, keeping any unrelated parameters. Defaults are left out,
 * so an untouched app has a clean URL. Returns the new query string including the leading "?" (or "").
 */
export function encodeSelection(state: ShareableState, catalog: Catalog, search = ''): string {
  const params = new URLSearchParams(search);
  for (const key of Object.values(PARAM)) params.delete(key);
  const ids = state.picks.flatMap((i) => {
    const m = catalog.movies[i];
    return m ? [imdbToken(m.imdbId)] : [];
  });
  if (ids.length > 0) params.set(PARAM.picks, ids.join(','));
  const genres = maskToGenres(state.filters.genreMask & ((1 << GENRES.length) - 1));
  if (genres.length > 0) params.set(PARAM.genres, genres.join(','));
  if (state.filters.decade !== null) params.set(PARAM.decade, String(state.filters.decade));
  if (state.filters.language !== null) params.set(PARAM.lang, state.filters.language);
  if (state.mode !== 'popular') params.set(PARAM.mode, state.mode);
  if (state.sort !== 'relevance') params.set(PARAM.sort, state.sort);
  // URLSearchParams encodes "," as %2C; keep the link readable since ids and genre names never contain commas.
  const out = params.toString().replace(/%2C/g, ',');
  return out === '' ? '' : `?${out}`;
}
