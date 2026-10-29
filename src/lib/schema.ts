import { z } from 'zod';
import { GENRES } from './genres';

/**
 * On-disk formats for the two data files, validated with Zod at load time.
 *
 * Items are compact tuples (the JSON is shipped to browsers; keys would double its size).
 * Neither file contains user-level ratings.
 */

const int = z.number().int().nonnegative();
const GENRE_MASK_MAX = (1 << GENRES.length) - 1;

/** [title, year, genreMask, imdbNumericId, imdbRating*10 (0 = none), imdbVotes, mlMean*10, mlCount, altTitles] */
export const coreItemSchema = z.tuple([
  z.string().min(1),
  z.number().int().min(1888).max(2100),
  int.max(GENRE_MASK_MAX),
  int,
  int.max(100),
  int,
  int.max(50),
  int,
  z.string(),
]);

export const coreFileSchema = z.object({
  v: z.literal(1),
  built: z.string(),
  genres: z.array(z.string()).length(GENRES.length),
  movielens: z.object({
    dataset: z.string(),
    users: int,
    ratings: int,
    through: z.string(),
  }),
  imdbSnapshot: z.string(),
  items: z.array(coreItemSchema).min(1),
  /** Per item: interleaved [neighbourIndex, similarity*1000, ...], best first. */
  nn: z.array(z.array(int)),
});

/** [title, year, genreMask, imdbNumericId, imdbRating*10, imdbVotes, directorIdx[], castIdx[]] */
export const contentItemSchema = z.tuple([
  z.string().min(1),
  z.number().int().min(1888).max(2100),
  int.max(GENRE_MASK_MAX),
  int,
  int.max(100),
  int,
  z.array(int),
  z.array(int),
]);

export const contentFileSchema = z.object({
  v: z.literal(1),
  built: z.string(),
  coreCount: int,
  /** Names of people used as matching features (directors and top-billed cast). */
  people: z.array(z.string().min(1)),
  /** Catalogue items that are not in the core file. */
  items: z.array(contentItemSchema),
  /** For each core item (same order as core.items): [directorIdx[], castIdx[]]. */
  coreFeatures: z.array(z.tuple([z.array(int), z.array(int)])),
});

export type CoreFile = z.infer<typeof coreFileSchema>;
export type ContentFile = z.infer<typeof contentFileSchema>;

export class DataValidationError extends Error {
  constructor(file: string, detail: string) {
    super(`Invalid ${file} data: ${detail}`);
    this.name = 'DataValidationError';
  }
}

/** Structural checks Zod's tuple types cannot express (cross references and bounds). */
export function validateCore(raw: unknown): CoreFile {
  const parsed = coreFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataValidationError('core', parsed.error.issues[0]?.message ?? 'schema mismatch');
  }
  const core = parsed.data;
  const n = core.items.length;
  if (core.nn.length !== n) throw new DataValidationError('core', `nn has ${core.nn.length} rows, expected ${n}`);
  core.nn.forEach((row, i) => {
    if (row.length % 2 !== 0) throw new DataValidationError('core', `nn row ${i} has odd length`);
    for (let a = 0; a < row.length; a += 2) {
      const j = row[a] as number;
      if (j >= n || j === i) throw new DataValidationError('core', `nn row ${i} references item ${j}`);
    }
  });
  return core;
}

export function validateContent(raw: unknown, coreCount: number): ContentFile {
  const parsed = contentFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataValidationError('content', parsed.error.issues[0]?.message ?? 'schema mismatch');
  }
  const content = parsed.data;
  if (content.coreCount !== coreCount || content.coreFeatures.length !== coreCount) {
    throw new DataValidationError('content', 'does not match the loaded core file');
  }
  const people = content.people.length;
  const bad = (ids: number[]) => ids.some((id) => id >= people);
  for (const it of content.items) {
    if (bad(it[6]) || bad(it[7])) throw new DataValidationError('content', 'person index out of range');
  }
  for (const [d, c] of content.coreFeatures) {
    if (bad(d) || bad(c)) throw new DataValidationError('content', 'person index out of range');
  }
  return content;
}
