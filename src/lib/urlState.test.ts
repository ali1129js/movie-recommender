import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { genresToMask } from './genres';
import { initialState, MAX_PICKS } from './state';
import { encodeSelection, hasSelection, parseSelection, resolvePicks } from './urlState';

describe('urlState', () => {
  const cat = fixture();

  it('round-trips picks, genres, decade, language, mode and sort through the query string', () => {
    const state = {
      ...initialState,
      picks: [2, 3, 7],
      filters: { genreMask: genresToMask(['Crime', 'Sci-Fi']), decade: 1990, language: 'en' },
      mode: 'gems' as const,
      sort: 'newest' as const,
    };
    const search = encodeSelection(state, cat);
    expect(search).toBe('?picks=tt0113277,tt0114369,tt0122690&genres=Crime,Sci-Fi&decade=1990&lang=en&mode=gems&sort=newest');
    const sel = parseSelection(search);
    expect(resolvePicks(sel.imdbIds, cat)).toEqual({ picks: [2, 3, 7], missing: [] });
    expect(sel).toMatchObject({ genreMask: state.filters.genreMask, decade: 1990, language: 'en', mode: 'gems', sort: 'newest' });
  });

  it('leaves defaults out and keeps unrelated parameters', () => {
    expect(encodeSelection(initialState, cat)).toBe('');
    expect(encodeSelection(initialState, cat, '?picks=tt0113277&ref=x')).toBe('?ref=x');
    expect(hasSelection(parseSelection(''))).toBe(false);
    expect(hasSelection(parseSelection('?ref=x'))).toBe(false);
  });

  it('drops malformed tokens, duplicates and bad filter values without throwing', () => {
    const sel = parseSelection('?picks=tt0113277,,abc,tt0113277,123,tt12&genres=Drama,Bogus&decade=1995&mode=x&sort=imdb');
    expect(sel.imdbIds).toEqual([113277]);
    expect(sel.genreMask).toBe(genresToMask(['Drama']));
    expect(sel.decade).toBeNull();
    expect(sel.mode).toBeNull();
    expect(sel.sort).toBe('imdb');
    expect(parseSelection('?decade=abc').decade).toBeNull();
    expect(parseSelection('?lang=en').language).toBe('en');
    expect(parseSelection('?lang=english').language).toBeNull();
    expect(parseSelection('?lang=EN').language).toBeNull();
  });

  it('caps the number of linked picks', () => {
    const ids = Array.from({ length: MAX_PICKS + 5 }, (_, i) => `tt${String(1000000 + i)}`).join(',');
    expect(parseSelection(`?picks=${ids}`).imdbIds).toHaveLength(MAX_PICKS);
  });

  it('reports stale ids as missing and resolves the rest by IMDb id, not by position', () => {
    expect(resolvePicks([9999999, 114709], cat)).toEqual({ picks: [0], missing: [9999999] });
    // A film that only lives in the content layer is missing until that layer is loaded.
    expect(resolvePicks([122690], fixture(false))).toEqual({ picks: [], missing: [122690] });
  });
});
