import { describe, expect, it } from 'vitest';
import { buildCatalog } from './catalog';
import { DataValidationError, validateContent, validateCore } from './schema';
import { contentRaw, coreRaw, fixture } from '../test/fixtures';

describe('buildCatalog', () => {
  it('unpacks items, genres, ratings and per-mille neighbours', () => {
    const cat = fixture();
    expect(cat.coreCount).toBe(6);
    expect(cat.movies).toHaveLength(9);
    const heat = cat.movies[2]!;
    expect(heat).toMatchObject({ title: 'Heat', year: 1995, imdbRating: 8.3, mlMean: 3.9, source: 'movielens' });
    expect(heat.genres).toEqual(['Action', 'Crime', 'Thriller']);
    expect(cat.neighbours[2]).toEqual([{ index: 3, sim: 0.4 }, { index: 5, sim: 0.35 }, { index: 4, sim: 0.2 }]);
    expect(cat.movies[6]?.source).toBe('wikidata');
    expect(cat.people[cat.movies[2]!.directors[0]!]).toBe('Michael Mann');
  });

  it('works with the MovieLens layer alone', () => {
    const cat = fixture(false);
    expect(cat.hasContent).toBe(false);
    expect(cat.movies).toHaveLength(6);
  });

  it('maps missing IMDb ratings to null, never 0', () => {
    const raw = structuredClone(coreRaw);
    raw.items[0]![4] = 0;
    expect(buildCatalog(raw, null).movies[0]?.imdbRating).toBeNull();
  });
});

describe('schema validation', () => {
  it('rejects year 0 and out-of-range years', () => {
    const raw = structuredClone(coreRaw);
    raw.items[0]![1] = 0;
    expect(() => validateCore(raw)).toThrow(DataValidationError);
  });
  it('rejects malformed rows', () => {
    expect(() => validateCore({})).toThrow(DataValidationError);
    expect(() => validateCore(null)).toThrow(DataValidationError);
    expect(() => validateCore('<html>404</html>')).toThrow(DataValidationError);
  });
  it('rejects neighbour references that are out of range, self-referencing or odd-length', () => {
    const oob = structuredClone(coreRaw); oob.nn[0] = [99, 500];
    const self = structuredClone(coreRaw); self.nn[0] = [0, 500];
    const odd = structuredClone(coreRaw); odd.nn[0] = [1, 500, 2];
    for (const bad of [oob, self, odd]) expect(() => validateCore(bad)).toThrow(DataValidationError);
  });
  it('rejects a genre mask with unknown bits', () => {
    const raw = structuredClone(coreRaw);
    raw.items[0]![2] = 1 << 30;
    expect(() => validateCore(raw)).toThrow();
  });
  it('rejects a content file that does not match the core file', () => {
    expect(() => validateContent(contentRaw, 7)).toThrow(DataValidationError);
    const raw = structuredClone(contentRaw);
    raw.items[0]![6] = [99];
    expect(() => validateContent(raw, 6)).toThrow(DataValidationError);
  });
  it('accepts the fixtures', () => {
    expect(() => validateCore(coreRaw)).not.toThrow();
    expect(() => validateContent(contentRaw, 6)).not.toThrow();
  });
});
