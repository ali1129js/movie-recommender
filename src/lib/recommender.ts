import { GENRES, popcount } from './genres';
import type { Catalog, Movie } from './types';

/**
 * Pure recommender functions. Nothing here mutates its inputs or the catalogue.
 *
 * Collaborative layer: every picked film contributes its precomputed MovieLens neighbours
 * (shrunk adjusted cosine). A candidate's score is the sum of its similarities to the picks,
 * so films similar to several picks rise. The "hidden gems" mode divides by a popularity factor
 * (the data build already applied a mild one).
 *
 * Content layer: for films outside what MovieLens can say (anything not in the top 3,000, or
 * anything you pick from the wider catalogue) we match on genres, directors, cast and era.
 * Those results are always labelled content-based; they are not collaborative evidence.
 */

export type Mode = 'popular' | 'gems';
export type SortKey = 'relevance' | 'imdb' | 'newest' | 'oldest';

export interface Filters {
  /** Show films with any of these genre bits (OR). 0 = no genre filter. */
  genreMask: number;
  /** Decade start year (e.g. 1990) or null. */
  decade: number | null;
}

export const NO_FILTERS: Filters = { genreMask: 0, decade: null };

export interface Reason {
  /** Index of the picked film this reason is about. */
  seed: number;
  /** Strength of this single link (collaborative: similarity 0-1; content: 0-1 composite). */
  strength: number;
  /** Content only: human-readable shared attributes, e.g. "director Christopher Nolan". */
  shared?: string[];
}

export interface Recommendation {
  movie: Movie;
  score: number;
  reasons: Reason[];
  kind: 'collaborative' | 'content';
}

export interface RecommendOptions {
  mode: Mode;
  filters: Filters;
  limit: number;
  sort: SortKey;
  /** Extra film indices to leave out (e.g. already shown in the other list). */
  exclude?: ReadonlySet<number>;
}

const GEM_BETA = 0.6;

export function passesFilters(movie: Movie, f: Filters): boolean {
  if (f.genreMask !== 0 && (movie.genreMask & f.genreMask) === 0) return false;
  if (f.decade !== null && Math.floor(movie.year / 10) * 10 !== f.decade) return false;
  return true;
}

function popularityFactor(catalog: Catalog, index: number, mode: Mode, meanVotes: number): number {
  if (mode !== 'gems') return 1;
  const votes = Math.max(1, catalog.movies[index]?.imdbVotes ?? 1);
  return Math.pow(Math.max(votes, 1) / meanVotes, GEM_BETA);
}

function meanVotesOf(catalog: Catalog): number {
  let sum = 0;
  for (const m of catalog.movies) sum += Math.max(1, m.imdbVotes);
  return sum / Math.max(1, catalog.movies.length);
}

export function sortRecommendations(list: readonly Recommendation[], sort: SortKey): Recommendation[] {
  const copy = [...list];
  const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score || a.movie.index - b.movie.index;
  switch (sort) {
    case 'imdb':
      return copy.sort((a, b) => (b.movie.imdbRating ?? -1) - (a.movie.imdbRating ?? -1) || byScore(a, b));
    case 'newest':
      return copy.sort((a, b) => b.movie.year - a.movie.year || byScore(a, b));
    case 'oldest':
      return copy.sort((a, b) => a.movie.year - b.movie.year || byScore(a, b));
    default:
      return copy.sort(byScore);
  }
}

/**
 * Collaborative recommendations from MovieLens neighbour lists.
 * Seeds outside the MovieLens layer have no neighbour list and contribute nothing here.
 */
export function recommendCollaborative(
  catalog: Catalog,
  seeds: readonly number[],
  opts: RecommendOptions,
): Recommendation[] {
  if (seeds.length === 0) return [];
  const seedSet = new Set(seeds);
  const meanVotes = meanVotesOf(catalog);
  const scores = new Map<number, { score: number; reasons: Reason[] }>();

  const add = (target: number, seed: number, sim: number) => {
    if (seedSet.has(target) || opts.exclude?.has(target)) return;
    const entry = scores.get(target) ?? { score: 0, reasons: [] };
    entry.score += sim;
    const existing = entry.reasons.find((r) => r.seed === seed);
    if (existing) existing.strength = Math.max(existing.strength, sim);
    else entry.reasons.push({ seed, strength: sim });
    scores.set(target, entry);
  };

  for (const seed of seeds) {
    const row = catalog.neighbours[seed];
    if (!row) continue;
    for (const n of row) add(n.index, seed, n.sim);
  }

  const assemble = (): Recommendation[] => {
    const out: Recommendation[] = [];
    for (const [index, { score, reasons }] of scores) {
      const movie = catalog.movies[index];
      if (!movie || !passesFilters(movie, opts.filters)) continue;
      out.push({
        movie,
        score: score / popularityFactor(catalog, index, opts.mode, meanVotes),
        reasons: [...reasons].sort((a, b) => b.strength - a.strength),
        kind: 'collaborative',
      });
    }
    return out;
  };

  let results = assemble();

  // Second-order fallback: when filters leave few matches, follow neighbours of neighbours at half
  // weight. It only adds candidates that have no direct link, so it never changes a direct score.
  if (results.length < opts.limit) {
    const direct = new Set(scores.keys());
    for (const seed of seeds) {
      for (const n1 of catalog.neighbours[seed] ?? []) {
        for (const n2 of catalog.neighbours[n1.index] ?? []) {
          if (!direct.has(n2.index)) add(n2.index, seed, n1.sim * n2.sim * 0.5);
        }
      }
    }
    results = assemble();
  }

  const best = [...results].sort((a, b) => b.score - a.score || a.movie.index - b.movie.index).slice(0, opts.limit);
  return sortRecommendations(best, opts.sort);
}

// ---------------------------------------------------------------------------------------------
// Content-based layer

export interface ContentWeights {
  genre: number;
  director: number;
  cast: number;
  era: number;
}

// Director and genre carry the match. A shared actor is weak evidence on its own (franchise and
// studio ensembles reuse the same faces across very different films), and era only breaks ties.
export const CONTENT_WEIGHTS: ContentWeights = { genre: 0.45, director: 0.4, cast: 0.08, era: 0.07 };

/**
 * Catalogue-wide rarity statistics, computed once per catalogue and cached.
 * Genre and person weights are inverse-document-frequency style: a genre every blockbuster carries
 * (Action, Adventure) says little, a rarer one (Sci-Fi next to Drama) says more. A person who
 * appears in dozens of films (a franchise regular) counts for less than someone in a handful.
 */
interface Rarity {
  genreWeight: number[];
  personFilms: Uint16Array;
}

const TENTPOLE_GENRE_WEIGHT = 0.4;

const rarityCache = new WeakMap<Catalog, Rarity>();

function rarityOf(catalog: Catalog): Rarity {
  const cached = rarityCache.get(catalog);
  if (cached) return cached;
  const n = Math.max(1, catalog.movies.length);
  const genreCount = new Array<number>(32).fill(0);
  const personFilms = new Uint16Array(catalog.people.length);
  for (const m of catalog.movies) {
    for (let b = 0; b < 32; b++) if (m.genreMask & (1 << b)) genreCount[b] = (genreCount[b] ?? 0) + 1;
    for (const p of m.cast) if (personFilms[p] !== undefined && personFilms[p] < 65535) personFilms[p] += 1;
  }
  // Smoothed IDF with a floor of 1 so Drama (the commonest genre) still counts. Action and Adventure
  // are the labels tentpole franchises carry, so they are deliberately down-weighted: sharing them
  // alone does not make two films alike.
  const genreWeight = genreCount.map((c, b) => {
    const g = GENRES[b];
    if (g === 'Action' || g === 'Adventure') return TENTPOLE_GENRE_WEIGHT;
    return Math.max(1, Math.log((n + 1) / (c + 1)));
  });
  const r = { genreWeight, personFilms };
  rarityCache.set(catalog, r);
  return r;
}

/** Weighted Sørensen-Dice over genre sets, using the catalogue's genre rarity weights. */
export function weightedDiceMask(a: number, b: number, weight: readonly number[]): number {
  let shared = 0;
  let total = 0;
  for (let i = 0; i < weight.length; i++) {
    const bit = 1 << i;
    const w = weight[i] ?? 0;
    if (a & bit) total += w;
    if (b & bit) total += w;
    if (a & b & bit) shared += 2 * w;
  }
  return total === 0 ? 0 : shared / total;
}

/**
 * Cast evidence 0-1. Each shared person contributes 1 / (1 + log2(films / 4)) for prolific people
 * (full weight up to 4 films in the catalogue), and a single shared person is capped at 0.5.
 */
export function castEvidence(shared: readonly number[], personFilms: ArrayLike<number>): number {
  let sum = 0;
  for (const p of shared) {
    const films = personFilms[p] ?? 1;
    sum += films <= 4 ? 1 : 1 / (1 + Math.log2(films / 4));
  }
  return Math.min(1, sum / 2);
}

export function jaccardMask(a: number, b: number): number {
  const union = popcount(a | b);
  return union === 0 ? 0 : popcount(a & b) / union;
}

/** Sørensen-Dice overlap of two genre sets: 2|A∩B| / (|A|+|B|). Kinder than Jaccard to 2-genre films. */
export function diceMask(a: number, b: number): number {
  const total = popcount(a) + popcount(b);
  return total === 0 ? 0 : (2 * popcount(a & b)) / total;
}

function intersect(a: readonly number[], b: readonly number[]): number[] {
  if (a.length === 0 || b.length === 0) return [];
  const set = new Set(a);
  return b.filter((x) => set.has(x));
}

/** 0-1 closeness of release years: 1 within 5 years, fading to 0 at 40 years apart. */
export function eraCloseness(a: number, b: number): number {
  const gap = Math.abs(a - b);
  if (gap <= 5) return 1;
  return Math.max(0, 1 - (gap - 5) / 35);
}

/** Multiplier for links with no shared director, at most one shared actor and a loose genre match. */
export const FRANCHISE_ONLY_DISCOUNT = 0.75;

export interface ContentLink {
  strength: number;
  shared: string[];
}

export function contentLink(catalog: Catalog, seed: Movie, cand: Movie, w: ContentWeights = CONTENT_WEIGHTS): ContentLink | null {
  const sharedGenreMask = seed.genreMask & cand.genreMask;
  const dirs = intersect(seed.directors, cand.directors);
  const cast = intersect(seed.cast, cand.cast);
  // Genre overlap is the floor: a shared actor alone is not enough to call two films alike.
  if (sharedGenreMask === 0) return null;
  const rarity = rarityOf(catalog);
  const genre = weightedDiceMask(seed.genreMask, cand.genreMask, rarity.genreWeight);
  // Beyond a shared genre, require either strongly overlapping genres or a shared person.
  // The gate uses plain (unweighted) overlap so it does not depend on catalogue statistics.
  if (diceMask(seed.genreMask, cand.genreMask) < 0.5 && dirs.length === 0 && cast.length === 0) return null;
  const era = eraCloseness(seed.year, cand.year);
  const dirScore = dirs.length > 0 ? 1 : 0;
  const castScore = castEvidence(cast, rarity.personFilms);
  let strength = w.genre * genre + w.director * dirScore + w.cast * castScore + w.era * era;
  // Franchise/studio-only overlap: no shared director, at most one shared actor, and the genres
  // are not a close match. Such films look alike on paper (same ensemble, same blockbuster genres)
  // but are rarely what the viewer meant, so they are discounted.
  if (dirs.length === 0 && cast.length <= 1 && genre < 0.9) strength *= FRANCHISE_ONLY_DISCOUNT;
  const shared: string[] = [];
  if (dirs.length) shared.push(`director ${dirs.map((i) => catalog.people[i]).filter(Boolean).slice(0, 2).join(' & ')}`);
  if (cast.length) shared.push(`cast ${cast.map((i) => catalog.people[i]).filter(Boolean).slice(0, 2).join(' & ')}`);
  const genres = cand.genres.filter((g) => seed.genres.includes(g));
  if (genres.length) shared.push(genres.slice(0, 3).join('/'));
  if (era === 1) shared.push('same era');
  return { strength, shared };
}

export function recommendContent(
  catalog: Catalog,
  seeds: readonly number[],
  opts: RecommendOptions,
): Recommendation[] {
  if (seeds.length === 0 || !catalog.hasContent) return [];
  const seedSet = new Set(seeds);
  const seedMovies = seeds.map((i) => catalog.movies[i]).filter((m): m is Movie => m !== undefined);
  const meanVotes = meanVotesOf(catalog);
  const out: Recommendation[] = [];

  for (const cand of catalog.movies) {
    if (seedSet.has(cand.index) || opts.exclude?.has(cand.index) || !passesFilters(cand, opts.filters)) continue;
    let total = 0;
    const reasons: Reason[] = [];
    for (const seed of seedMovies) {
      const link = contentLink(catalog, seed, cand);
      if (!link) continue;
      total += link.strength;
      reasons.push({ seed: seed.index, strength: link.strength, shared: link.shared });
    }
    if (reasons.length === 0) continue;
    // A small, bounded prior for well-known films so ties do not resolve arbitrarily.
    const prior = 1 + 0.03 * Math.log10(Math.max(10, cand.imdbVotes));
    out.push({
      movie: cand,
      score: (total * prior) / popularityFactor(catalog, cand.index, opts.mode, meanVotes),
      reasons: reasons.sort((a, b) => b.strength - a.strength),
      kind: 'content',
    });
  }
  const best = out.sort((a, b) => b.score - a.score || a.movie.index - b.movie.index).slice(0, opts.limit);
  return sortRecommendations(best, opts.sort);
}

export function recommend(catalog: Catalog, seeds: readonly number[], opts: RecommendOptions) {
  const collaborative = recommendCollaborative(catalog, seeds, opts);
  const shown = new Set<number>([...(opts.exclude ?? []), ...collaborative.map((r) => r.movie.index)]);
  const content = recommendContent(catalog, seeds, { ...opts, exclude: shown });
  return { collaborative, content };
}
