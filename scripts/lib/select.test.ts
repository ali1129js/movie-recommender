import { describe, expect, it } from 'vitest';
import { DECADE_QUOTAS, selectByDecade, type Candidate } from './select';

const make = (n: number, year: number, startId: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({ id: startId + i, year, votes: 1000 - i }));

describe('selectByDecade', () => {
  it('keeps the most-voted titles up to each decade quota', () => {
    const cands = [...make(5, 1925, 1), ...make(5, 1995, 100)];
    const out = selectByDecade(cands, { 1920: 2, 1990: 3 });
    expect(out.filter((c) => c.year === 1925).map((c) => c.id)).toEqual([1, 2]);
    expect(out.filter((c) => c.year === 1995).map((c) => c.id)).toEqual([100, 101, 102]);
  });

  it('excludes ids and low-vote titles and ignores decades without a quota', () => {
    const cands = [...make(4, 1955, 1), { id: 99, year: 1850, votes: 9999 }];
    const out = selectByDecade(cands, { 1950: 10 }, { exclude: new Set([1]), minVotes: 999 });
    expect(out.map((c) => c.id)).toEqual([2]);
  });

  it('overshoot widens the pool for later filtering', () => {
    const out = selectByDecade(make(10, 1975, 1), { 1970: 4 }, { overshoot: 1.5 });
    expect(out).toHaveLength(6);
  });

  it('covers every decade from the 1890s to the 2020s', () => {
    const decades = Object.keys(DECADE_QUOTAS).map(Number);
    expect(Math.min(...decades)).toBe(1890);
    expect(Math.max(...decades)).toBe(2020);
    expect(decades).toHaveLength(14);
    const total = Object.values(DECADE_QUOTAS).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(5000);
    expect(total).toBeLessThanOrEqual(8000);
  });
});
