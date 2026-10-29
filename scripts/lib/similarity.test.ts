import { describe, expect, it } from 'vitest';
import {
  addUser,
  coCount,
  cosine,
  createAccumulator,
  mergeAccumulators,
  packNeighbours,
  shrunkCosine,
  topNeighbours,
} from './similarity';

/** Reference implementation on a dense matrix (NaN = unrated), used to check the accumulator. */
function denseAdjustedCosine(r: number[][], i: number, j: number, userMeans: number[]) {
  let dot = 0, ni = 0, nj = 0;
  r.forEach((row, u) => {
    const a = row[i] as number, b = row[j] as number;
    const mean = userMeans[u] as number;
    if (!Number.isNaN(a)) ni += (a - mean) ** 2;
    if (!Number.isNaN(b)) nj += (b - mean) ** 2;
    if (!Number.isNaN(a) && !Number.isNaN(b)) dot += (a - mean) * (b - mean);
  });
  return dot / Math.sqrt(ni * nj);
}

const NA = Number.NaN;
// 4 users x 3 items.
const R = [
  [5, 4, 1],
  [4, 5, 2],
  [1, 2, 5],
  [NA, 4, 2],
];

function build() {
  const acc = createAccumulator(3);
  const means = R.map((row) => {
    const rated = row.filter((v) => !Number.isNaN(v));
    return rated.reduce((s, v) => s + v, 0) / rated.length;
  });
  R.forEach((row, u) => {
    const items: number[] = [], centred: number[] = [];
    for (let i = 0; i < 3; i++) {
      const v = row[i] as number;
      if (!Number.isNaN(v)) {
        items.push(i);
        centred.push(v - (means[u] as number));
      }
    }
    addUser(acc, items, centred);
  });
  return { acc, means };
}

describe('adjusted cosine accumulator', () => {
  it('matches a dense reference for every pair', () => {
    const { acc, means } = build();
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(cosine(acc, i, j)).toBeCloseTo(denseAdjustedCosine(R, i, j, means), 10);
        expect(cosine(acc, j, i)).toBeCloseTo(cosine(acc, i, j), 12);
      }
    }
  });

  it('gives items rated alike a positive and opposite items a negative similarity', () => {
    const { acc } = build();
    expect(cosine(acc, 0, 1)).toBeGreaterThan(0.5);
    expect(cosine(acc, 0, 2)).toBeLessThan(-0.5);
  });

  it('counts co-raters and item popularity on the diagonal', () => {
    const { acc } = build();
    expect(coCount(acc, 0, 0)).toBe(3);
    expect(coCount(acc, 1, 1)).toBe(4);
    expect(coCount(acc, 0, 1)).toBe(3);
    expect(coCount(acc, 1, 0)).toBe(3);
    expect(coCount(acc, 0, 2)).toBe(3);
  });

  it('merging two accumulators equals accumulating all users in one', () => {
    const a = createAccumulator(3), b = createAccumulator(3), whole = createAccumulator(3);
    addUser(a, [0, 1], [1, -1]); addUser(whole, [0, 1], [1, -1]);
    addUser(b, [0, 1, 2], [0.5, 0.5, -1]); addUser(whole, [0, 1, 2], [0.5, 0.5, -1]);
    mergeAccumulators(a, b);
    expect(Array.from(a.dot)).toEqual(Array.from(whole.dot));
    expect(Array.from(a.count)).toEqual(Array.from(whole.count));
  });

  it('is 0 for items nobody rated', () => {
    const acc = createAccumulator(2);
    expect(cosine(acc, 0, 1)).toBe(0);
    expect(shrunkCosine(acc, 0, 1, 50)).toBe(0);
  });
});

describe('shrinkage', () => {
  it('scales cosine by n/(n+lambda)', () => {
    const acc = createAccumulator(2);
    for (let u = 0; u < 10; u++) addUser(acc, [0, 1], [1, 1]);
    expect(cosine(acc, 0, 1)).toBeCloseTo(1, 12);
    expect(shrunkCosine(acc, 0, 1, 10)).toBeCloseTo(0.5, 12);
    expect(shrunkCosine(acc, 0, 1, 0)).toBeCloseTo(1, 12);
  });

  it('prefers a well-supported pair over a thinly supported perfect pair', () => {
    const acc = createAccumulator(4);
    // Items 0~1: perfectly aligned but only 2 co-raters. Items 2~3: slightly noisy, 200 co-raters.
    for (let u = 0; u < 2; u++) addUser(acc, [0, 1], [1, 1]);
    for (let u = 0; u < 200; u++) addUser(acc, [2, 3], [1, u % 10 === 0 ? 0.8 : 1]);
    expect(cosine(acc, 0, 1)).toBeGreaterThan(cosine(acc, 2, 3));
    expect(shrunkCosine(acc, 0, 1, 50)).toBeLessThan(shrunkCosine(acc, 2, 3, 50));
  });
});

describe('topNeighbours', () => {
  function popularityFixture() {
    // Item 3 is a blockbuster rated by everyone; items 1 and 2 are niche but align with item 0.
    const acc = createAccumulator(4);
    for (let u = 0; u < 60; u++) addUser(acc, [0, 3], [1, 0.4]);
    for (let u = 0; u < 20; u++) addUser(acc, [0, 1, 3], [1, 1, 0.4]);
    for (let u = 0; u < 20; u++) addUser(acc, [0, 2, 3], [1, 1, 0.4]);
    for (let u = 0; u < 200; u++) addUser(acc, [3], [0.5]);
    return acc;
  }

  it('excludes the item itself and orders by score', () => {
    const acc = popularityFixture();
    const flat = topNeighbours(acc, { k: 3, lambda: 10, alpha: 0 });
    expect(flat[0]?.idx).not.toContain(0);
    const sims = flat[0]?.sim ?? [];
    expect(sims.length).toBeGreaterThan(0);
    expect([...sims].sort((x, y) => y - x)).toEqual(sims);
  });

  it('popularity damping promotes niche neighbours over the blockbuster', () => {
    const acc = popularityFixture();
    const plain = topNeighbours(acc, { k: 1, lambda: 10, alpha: 0 })[0];
    const damped = topNeighbours(acc, { k: 1, lambda: 10, alpha: 1.5 })[0];
    expect(plain?.idx[0]).toBe(3);
    expect([1, 2]).toContain(damped?.idx[0]);
  });

  it('respects k and drops non-positive similarities', () => {
    const acc = createAccumulator(3);
    addUser(acc, [0, 1], [1, 1]);
    addUser(acc, [0, 2], [1, -1]);
    const nn = topNeighbours(acc, { k: 5, lambda: 0, alpha: 0 })[0];
    expect(nn?.idx).toEqual([1]);
  });
});

describe('packNeighbours', () => {
  it('interleaves index and per-mille similarity, never emitting 0', () => {
    expect(packNeighbours({ idx: [7, 3], sim: [0.4234, 0.0001] })).toEqual([7, 423, 3, 1]);
  });
});
