import type { Recommendation } from './recommender';
import type { Catalog } from './types';

const list = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export interface Explanation {
  /** One-sentence summary, e.g. "Because you liked Heat and Se7en". */
  headline: string;
  /** Supporting detail. */
  detail: string;
}

const MAX_NAMED = 3;

export function explain(catalog: Catalog, rec: Recommendation): Explanation {
  const names = rec.reasons
    .map((r) => catalog.movies[r.seed]?.title)
    .filter((t): t is string => t !== undefined);
  const named = names.slice(0, MAX_NAMED);
  const more = names.length - named.length;
  const who = list(named) + (more > 0 ? ` and ${more} more` : '');

  if (rec.kind === 'collaborative') {
    const top = rec.reasons[0];
    const pct = top ? Math.round(top.strength * 100) : 0;
    return {
      headline: `Because you liked ${who}`,
      detail: `MovieLens viewers who rated ${named.length > 1 ? 'those' : 'that film'} highly tended to rate this highly too (strongest link ${pct}% similarity).`,
    };
  }

  const bits = new Set<string>();
  for (const r of rec.reasons) for (const s of r.shared ?? []) bits.add(s);
  const shared = [...bits].slice(0, 4);
  return {
    headline: `Because you liked ${who}`,
    detail: `Content-based match, not viewer ratings: shares ${list(shared)}.`,
  };
}
