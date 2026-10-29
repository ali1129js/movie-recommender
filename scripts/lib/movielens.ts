import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

/** Minimal quote-aware CSV line splitter (MovieLens quotes titles that contain commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface MovieRow {
  movieId: number;
  title: string;
  genres: string[];
}

export async function readMovies(path: string): Promise<Map<number, MovieRow>> {
  const text = await readFile(path, 'utf8');
  const map = new Map<number, MovieRow>();
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = (lines[i] as string).replace(/\r$/, '');
    if (!line) continue;
    const [id, title, genres] = splitCsvLine(line);
    if (id === undefined || title === undefined) continue;
    const g = genres && genres !== '(no genres listed)' ? genres.split('|') : [];
    map.set(Number(id), { movieId: Number(id), title, genres: g });
  }
  return map;
}

/** movieId -> numeric IMDb id (the "tt" prefix and zero padding removed). */
export async function readLinks(path: string): Promise<Map<number, number>> {
  const text = await readFile(path, 'utf8');
  const map = new Map<number, number>();
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const [id, imdb] = (lines[i] as string).replace(/\r$/, '').split(',');
    if (id && imdb) map.set(Number(id), Number(imdb));
  }
  return map;
}

/**
 * Streams ratings.csv ("userId,movieId,rating,timestamp") without building lines as strings.
 * `rating2` is the rating times two (0.5 star steps become integers).
 */
export async function forEachRating(
  path: string,
  cb: (userId: number, movieId: number, rating2: number) => void,
): Promise<number> {
  let rows = 0;
  let field = 0;
  let user = 0;
  let movie = 0;
  let whole = 0;
  let half = 0;
  let seenDot = false;
  let headerDone = false;

  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 22 }) as AsyncIterable<Buffer>) {
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i] as number;
      if (!headerDone) {
        if (b === 10) headerDone = true;
        continue;
      }
      if (b === 44) {
        field++;
      } else if (b === 10) {
        cb(user, movie, whole * 2 + half);
        rows++;
        field = 0; user = 0; movie = 0; whole = 0; half = 0; seenDot = false;
      } else if (b >= 48 && b <= 57) {
        const d = b - 48;
        if (field === 0) user = user * 10 + d;
        else if (field === 1) movie = movie * 10 + d;
        else if (field === 2) {
          if (seenDot) half = d >= 5 ? 1 : 0;
          else whole = whole * 10 + d;
        }
      } else if (b === 46 && field === 2) seenDot = true;
    }
  }
  return rows;
}
