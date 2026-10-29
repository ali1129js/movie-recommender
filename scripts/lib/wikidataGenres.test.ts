import { describe, expect, it } from 'vitest';
import { mapGenreLabel, mapGenreLabels } from './wikidataGenres';

describe('mapGenreLabel', () => {
  it.each([
    ['drama film', ['Drama']],
    ['science fiction film', ['Sci-Fi']],
    ['romantic comedy', ['Romance', 'Comedy']],
    ['animated film', ['Animation']],
    ['film noir', ['Film-Noir', 'Crime']],
    ['heist film', ['Crime']],
    ['war film', ['War']],
    ['Western film', ['Western']],
    ['slasher film', ['Horror']],
    ['musical film', ['Musical']],
  ])('%s', (label, expected) => {
    expect(mapGenreLabel(label).sort()).toEqual([...expected].sort());
  });

  it('returns nothing for unmapped labels', () => {
    expect(mapGenreLabel('independent film')).toEqual([]);
    expect(mapGenreLabel('')).toEqual([]);
  });

  it('merges and de-duplicates across labels', () => {
    expect(mapGenreLabels(['drama film', 'comedy film', 'drama']).sort()).toEqual(['Comedy', 'Drama']);
  });
});
