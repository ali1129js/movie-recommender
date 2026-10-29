import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { explain } from './explain';
import { NO_FILTERS, recommend } from './recommender';

const cat = fixture();
const base = { mode: 'popular', filters: NO_FILTERS, limit: 10, sort: 'relevance' } as const;

describe('explain', () => {
  it('collaborative: names the picks that led to the recommendation', () => {
    const { collaborative } = recommend(cat, [2, 3], base);
    const gem = collaborative.find((r) => r.movie.title === 'Obscure Gem')!;
    const e = explain(cat, gem);
    expect(e.headline).toMatch(/^Because you liked (Heat and Se7en|Se7en and Heat)$/);
    expect(e.detail).toContain('MovieLens viewers');
  });

  it('content: states it is not viewer ratings and lists shared attributes', () => {
    const { content } = recommend(cat, [2], base);
    const ronin = content.find((r) => r.movie.title === 'Ronin')!;
    const e = explain(cat, ronin);
    expect(e.headline).toBe('Because you liked Heat');
    expect(e.detail).toMatch(/^Content-based match, not viewer ratings: shares /);
    expect(e.detail).toContain('Robert De Niro');
  });

  it('truncates long lists of picks', () => {
    const fake = { ...recommend(cat, [2], base).collaborative[0]!, reasons: [0, 1, 2, 3, 4].map((seed) => ({ seed, strength: 0.5 })) };
    expect(explain(cat, fake).headline).toBe('Because you liked Toy Story, Toy Story 2 and Heat and 2 more');
  });
});
