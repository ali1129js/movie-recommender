/**
 * The shared genre vocabulary (MovieLens genres minus "IMAX", which is a format, not a genre).
 * Items store genres as a bitmask: bit i is set when GENRES[i] applies.
 */
export const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Children',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Fantasy',
  'Film-Noir',
  'Horror',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'War',
  'Western',
] as const;

export type Genre = (typeof GENRES)[number];

const INDEX = new Map<string, number>(GENRES.map((g, i) => [g, i]));

export function genreBit(genre: string): number {
  const i = INDEX.get(genre);
  return i === undefined ? 0 : 1 << i;
}

export function genresToMask(genres: readonly string[]): number {
  let mask = 0;
  for (const g of genres) mask |= genreBit(g);
  return mask;
}

export function maskToGenres(mask: number): Genre[] {
  const out: Genre[] = [];
  GENRES.forEach((g, i) => {
    if (mask & (1 << i)) out.push(g);
  });
  return out;
}

export function popcount(mask: number): number {
  let n = 0;
  let m = mask >>> 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export const decadeOf = (year: number): number => Math.floor(year / 10) * 10;

export const decadeLabel = (decade: number): string => `${decade}s`;
