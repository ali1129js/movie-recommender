import { join, resolve } from 'node:path';

/** Raw downloads and caches live outside git. Override with RECSYS_RAW_DIR. */
export const RAW_DIR = resolve(process.env.RECSYS_RAW_DIR ?? 'raw');
export const ML_DIR = join(RAW_DIR, 'ml-32m');
export const IMDB_RATINGS = join(RAW_DIR, 'title.ratings.tsv.gz');
export const IMDB_BASICS = join(RAW_DIR, 'title.basics.tsv.gz');
export const WD_CACHE = join(RAW_DIR, 'wikidata-cache');
export const OUT_DIR = resolve('public/data');
export const WORK_DIR = join(RAW_DIR, 'work');
