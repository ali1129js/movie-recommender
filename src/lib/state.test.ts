import { describe, expect, it } from 'vitest';
import { genreBit } from './genres';
import { initialState, MAX_PICKS, PAGE_SIZE, reducer } from './state';

describe('reducer', () => {
  it('adds picks without mutating the previous state', () => {
    const next = reducer(initialState, { type: 'pick', index: 3 });
    expect(next.picks).toEqual([3]);
    expect(initialState.picks).toEqual([]);
    expect(next.picks).not.toBe(initialState.picks);
  });

  it('removing never mutates the old array (the old app used splice)', () => {
    const s1 = reducer(reducer(initialState, { type: 'pick', index: 1 }), { type: 'pick', index: 2 });
    const frozen = Object.freeze([...s1.picks]);
    const s2 = reducer({ ...s1, picks: frozen }, { type: 'unpick', index: 1 });
    expect(s2.picks).toEqual([2]);
    expect(frozen).toEqual([1, 2]);
  });

  it('ignores duplicate picks and caps the number of picks', () => {
    let s = reducer(initialState, { type: 'pick', index: 1 });
    expect(reducer(s, { type: 'pick', index: 1 })).toBe(s);
    for (let i = 10; i < 10 + MAX_PICKS + 5; i++) s = reducer(s, { type: 'pick', index: i });
    expect(s.picks).toHaveLength(MAX_PICKS);
  });

  it('unpicking something that is not picked is harmless', () => {
    expect(reducer(initialState, { type: 'unpick', index: 99 }).picks).toEqual([]);
  });

  it('toggles genres on and off and ignores unknown genres', () => {
    const on = reducer(initialState, { type: 'toggleGenre', genre: 'Drama' });
    expect(on.filters.genreMask).toBe(genreBit('Drama'));
    expect(reducer(on, { type: 'toggleGenre', genre: 'Drama' }).filters.genreMask).toBe(0);
    expect(reducer(initialState, { type: 'toggleGenre', genre: 'Nonsense' })).toBe(initialState);
  });

  it('resets paging when the question changes and pages on "more"', () => {
    const more = reducer(initialState, { type: 'more' });
    expect(more.limit).toBe(PAGE_SIZE * 2);
    expect(reducer(more, { type: 'setDecade', decade: 1990 }).limit).toBe(PAGE_SIZE);
    expect(reducer(more, { type: 'pick', index: 1 }).limit).toBe(PAGE_SIZE);
  });

  it('clears and replaces picks', () => {
    const s = reducer(initialState, { type: 'replacePicks', picks: [1, 1, 2] });
    expect(s.picks).toEqual([1, 2]);
    expect(reducer(s, { type: 'clear' }).picks).toEqual([]);
  });
});
