import { GENRES, genresToMask } from '../lib/genres';
import { buildCatalog } from '../lib/catalog';
import type { Catalog } from '../lib/types';

const m = (...g: string[]) => genresToMask(g);

/**
 * Tiny hand-made catalogue. Core films 0-5 have MovieLens neighbours; 6-8 come from the content layer.
 *   0 Toy Story (1995)        Animation/Children/Comedy
 *   1 Toy Story 2 (1999)      Animation/Children/Comedy
 *   2 Heat (1995)             Action/Crime/Thriller
 *   3 Se7en (1995)            Crime/Thriller/Mystery
 *   4 The Matrix (1999)       Action/Sci-Fi
 *   5 Obscure Gem (2001)      Action/Crime
 *   6 Metropolis (1927)       Sci-Fi/Drama           (content layer)
 *   7 Ronin (1998)            Action/Crime/Thriller  (content layer, shares cast with Heat)
 *   8 Dune (2021)             Sci-Fi/Adventure       (content layer)
 */
export const coreRaw = {
  v: 1,
  built: '2026-10-29',
  genres: [...GENRES],
  movielens: { dataset: 'ml-32m', users: 200948, ratings: 32000204, through: '2023-10-12' },
  imdbSnapshot: '2026-10-29',
  items: [
    ['Toy Story', 1995, m('Animation', 'Children', 'Comedy'), 114709, 83, 1100000, 39, 80000, ''],
    ['Toy Story 2', 1999, m('Animation', 'Children', 'Comedy'), 120363, 79, 600000, 38, 60000, ''],
    ['Heat', 1995, m('Action', 'Crime', 'Thriller'), 113277, 83, 700000, 39, 50000, ''],
    ['Se7en', 1995, m('Crime', 'Thriller', 'Mystery'), 114369, 86, 1900000, 41, 90000, ''],
    ['The Matrix', 1999, m('Action', 'Sci-Fi'), 133093, 87, 2000000, 41, 120000, ''],
    ['Obscure Gem', 2001, m('Action', 'Crime'), 999999, 72, 3000, 36, 900, ''],
  ],
  nn: [
    [1, 600],
    [0, 600],
    [3, 400, 5, 350, 4, 200],
    [2, 400, 5, 150],
    [2, 100],
    [2, 350, 3, 150],
  ],
};

export const contentRaw = {
  v: 1,
  built: '2026-10-29',
  coreCount: 6,
  people: ['Michael Mann', 'Robert De Niro', 'Val Kilmer', 'Fritz Lang'],
  items: [
    ['Metropolis', 1927, m('Sci-Fi', 'Drama'), 17136, 83, 180000, [3], []],
    ['Ronin', 1998, m('Action', 'Crime', 'Thriller'), 122690, 72, 150000, [], [1]],
    ['Dune', 2021, m('Sci-Fi', 'Adventure'), 1160419, 80, 700000, [], []],
  ],
  coreFeatures: [
    [[], []],
    [[], []],
    [[0], [1, 2]],
    [[], []],
    [[], []],
    [[], []],
  ],
};

export const fixture = (withContent = true): Catalog => buildCatalog(coreRaw, withContent ? contentRaw : null);
