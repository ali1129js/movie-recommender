import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { buildSearchIndex, normalize, searchMovies } from './search';

const index = buildSearchIndex(fixture().movies);
const find = (q: string, o = {}) => searchMovies(index, q, o).map((m) => m.title);

describe('normalize', () => {
  it('lower-cases, strips diacritics and punctuation', () => {
    expect(normalize('  Amélie: Le  Fabuleux Destin!  ')).toBe('amelie le fabuleux destin');
    expect(normalize('Se7en')).toBe('se7en');
    expect(normalize('Tom & Jerry')).toBe('tom and jerry');
  });
});

describe('searchMovies', () => {
  it('ranks exact, then prefix, then word-prefix matches', () => {
    expect(find('toy story')).toEqual(['Toy Story', 'Toy Story 2']);
    expect(find('matrix')[0]).toBe('The Matrix');
  });
  it('is accent- and case-insensitive', () => {
    expect(find('HEAT')).toEqual(['Heat']);
    expect(find('métropolis')).toEqual(['Metropolis']);
  });
  it('matches on a year token', () => {
    expect(find('heat 1995')).toEqual(['Heat']);
    expect(find('ronin 1998')).toEqual(['Ronin']);
  });
  it('returns nothing for empty or whitespace queries', () => {
    expect(find('')).toEqual([]);
    expect(find('   ')).toEqual([]);
  });
  it('excludes already-picked films and honours the limit', () => {
    expect(find('toy story', { exclude: new Set([0]) })).toEqual(['Toy Story 2']);
    expect(find('toy', { limit: 1 })).toHaveLength(1);
  });
  it.each(['(', ')', '[', '.*', '\\', '(?:', '+++', '^$', '*', '?', '{1,2}', '<script>alert(1)</script>', '%', '\u0000'])(
    'treats %j as plain text and never throws',
    (q) => {
      expect(() => searchMovies(index, q)).not.toThrow();
      expect(find(q)).toEqual([]);
    },
  );
  it('does not let ".*" match everything (the old app compiled input as a regex)', () => {
    expect(find('.*')).toEqual([]);
  });
  it('caps very long queries', () => {
    expect(() => searchMovies(index, 'a'.repeat(100_000))).not.toThrow();
  });
});
