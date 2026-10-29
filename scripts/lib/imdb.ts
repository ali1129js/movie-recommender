import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

export interface ImdbRating {
  /** averageRating * 10 as an integer (8.3 -> 83). */
  rating10: number;
  votes: number;
}

const numericId = (tconst: string): number => Number(tconst.slice(2));

async function* lines(path: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue; // header
    }
    yield line;
  }
}

/** title.ratings.tsv.gz -> numeric IMDb id -> rating. */
export async function readImdbRatings(path: string): Promise<Map<number, ImdbRating>> {
  const map = new Map<number, ImdbRating>();
  for await (const line of lines(path)) {
    const [tconst, avg, votes] = line.split('\t');
    if (!tconst || !avg || !votes) continue;
    map.set(numericId(tconst), { rating10: Math.round(Number(avg) * 10), votes: Number(votes) });
  }
  return map;
}

export interface ImdbBasic {
  id: number;
  type: string;
  year: number;
  title: string;
  runtime: number;
}

/**
 * title.basics.tsv.gz, keeping only feature films (and, for the silent era, shorts) that are not
 * adult titles. Used only to *select candidates* by popularity; shipped titles and genres come
 * from Wikidata.
 */
export async function readImdbCandidates(path: string): Promise<Map<number, ImdbBasic>> {
  const map = new Map<number, ImdbBasic>();
  for await (const line of lines(path)) {
    const f = line.split('\t');
    const [tconst, type, primary, , isAdult, startYear, , runtime] = f;
    if (!tconst || !type || isAdult === '1') continue;
    if (type !== 'movie' && type !== 'short') continue;
    const year = Number(startYear);
    if (!Number.isInteger(year) || year < 1888) continue;
    if (type === 'short' && year > 1929) continue;
    map.set(numericId(tconst), {
      id: numericId(tconst),
      type,
      year,
      title: primary ?? '',
      runtime: runtime && runtime !== '\\N' ? Number(runtime) : 0,
    });
  }
  return map;
}
