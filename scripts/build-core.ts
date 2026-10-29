import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GENRES, genresToMask } from '../src/lib/genres';
import { validateCore, type CoreFile } from '../src/lib/schema';
import { readImdbRatings } from './lib/imdb';
import { forEachRating, readLinks, readMovies } from './lib/movielens';
import { IMDB_RATINGS, ML_DIR, OUT_DIR, WORK_DIR } from './lib/paths';
import { addUser, createAccumulator, packNeighbours, topNeighbours } from './lib/similarity';
import { parseMovieLensTitle } from './lib/titles';

export const CORE_PARAMS = { items: 3000, neighbours: 30, shrinkage: 50, damping: 0.1 } as const;

const MAX_USER = 400_000;
const MAX_MOVIE = 400_000;

export interface CoreBuildOptions {
  /** Stop after this many users (fast iteration only; never used for the shipped file). */
  maxUsers?: number;
}

export interface CoreItemMeta {
  /** Index in core.items. */
  idx: number;
  imdb: number;
  title: string;
  year: number;
}

export async function buildCore(opts: CoreBuildOptions = {}): Promise<CoreItemMeta[]> {
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[core ${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`);
  const maxUsers = opts.maxUsers ?? Infinity;

  const [movies, links, imdb] = await Promise.all([
    readMovies(join(ML_DIR, 'movies.csv')),
    readLinks(join(ML_DIR, 'links.csv')),
    readImdbRatings(IMDB_RATINGS),
  ]);
  log(`movies=${movies.size} links=${links.size} imdbRatings=${imdb.size}`);

  // Pass 1: per-user mean and per-movie count/sum.
  const userSum = new Float64Array(MAX_USER);
  const userCnt = new Uint32Array(MAX_USER);
  const movieCnt = new Uint32Array(MAX_MOVIE);
  const movieSum = new Float64Array(MAX_MOVIE);
  let users = 0;
  let ratings = 0;
  let lastUser = -1;
  await forEachRating(join(ML_DIR, 'ratings.csv'), (u, m, r2) => {
    if (u !== lastUser) {
      users++;
      lastUser = u;
    }
    if (users > maxUsers) return;
    ratings++;
    userSum[u] = (userSum[u] as number) + r2;
    userCnt[u] = (userCnt[u] as number) + 1;
    movieCnt[m] = (movieCnt[m] as number) + 1;
    movieSum[m] = (movieSum[m] as number) + r2;
  });
  users = Math.min(users, maxUsers);
  log(`pass 1: users=${users} ratings=${ratings}`);

  // Choose the most-rated eligible movies: parsed year, IMDb link, at least one genre.
  type Pick = { movieId: number; title: string; year: number; alt: string[]; mask: number; imdb: number };
  const eligible: Pick[] = [];
  for (const [movieId, row] of movies) {
    if ((movieCnt[movieId] ?? 0) === 0) continue;
    const parsed = parseMovieLensTitle(row.title);
    const imdbId = links.get(movieId);
    const mask = genresToMask(row.genres);
    if (parsed.year === null || imdbId === undefined || mask === 0) continue;
    eligible.push({ movieId, title: parsed.title, year: parsed.year, alt: parsed.alt, mask, imdb: imdbId });
  }
  eligible.sort((a, b) => (movieCnt[b.movieId] as number) - (movieCnt[a.movieId] as number) || a.movieId - b.movieId);
  const picks = eligible.slice(0, CORE_PARAMS.items);
  const indexOf = new Map<number, number>(picks.map((p, i) => [p.movieId, i]));
  log(`selected ${picks.length}; least popular has ${movieCnt[picks[picks.length - 1]!.movieId]} ratings`);

  // Pass 2: adjusted-cosine accumulation over the selected movies only.
  const acc = createAccumulator(picks.length);
  const items: number[] = [];
  const centred: number[] = [];
  const flush = () => {
    if (items.length < 2) return;
    const order = items.map((_, k) => k).sort((a, b) => (items[a] as number) - (items[b] as number));
    addUser(acc, order.map((k) => items[k] as number), order.map((k) => centred[k] as number));
  };
  let current = -1;
  let seen = 0;
  await forEachRating(join(ML_DIR, 'ratings.csv'), (u, m, r2) => {
    if (u !== current) {
      if (current !== -1) flush();
      items.length = 0;
      centred.length = 0;
      current = u;
      seen++;
      if (seen % 20000 === 0) log(`pass 2: ${seen} users`);
    }
    if (seen > maxUsers) return;
    const idx = indexOf.get(m);
    if (idx === undefined) return;
    const mean = (userSum[u] as number) / (userCnt[u] as number);
    items.push(idx);
    centred.push((r2 - mean) / 2);
  });
  if (seen <= maxUsers) flush();
  log('pass 2 done; selecting neighbours');

  const nn = topNeighbours(acc, {
    k: CORE_PARAMS.neighbours,
    lambda: CORE_PARAMS.shrinkage,
    alpha: CORE_PARAMS.damping,
  });

  const core: CoreFile = {
    v: 1,
    built: new Date().toISOString().slice(0, 10),
    genres: [...GENRES],
    movielens: { dataset: 'ml-32m', users, ratings, through: '2023-10-12' },
    imdbSnapshot: new Date().toISOString().slice(0, 10),
    items: picks.map((p) => {
      const r = imdb.get(p.imdb);
      const count = movieCnt[p.movieId] as number;
      const mean10 = Math.round(((movieSum[p.movieId] as number) / count) * 5); // sum of 2*stars -> tenths of a star
      return [
        p.title,
        p.year,
        p.mask,
        p.imdb,
        r?.rating10 ?? 0,
        r?.votes ?? 0,
        Math.min(50, mean10),
        count,
        p.alt.join(' | '),
      ];
    }),
    nn: nn.map(packNeighbours),
  };
  validateCore(core);

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(WORK_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'core.json'), JSON.stringify(core));
  const meta: CoreItemMeta[] = picks.map((p, idx) => ({ idx, imdb: p.imdb, title: p.title, year: p.year }));
  await writeFile(join(WORK_DIR, 'core-items.json'), JSON.stringify(meta));
  log(`wrote core.json (${picks.length} items)`);
  return meta;
}
