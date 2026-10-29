import { decadeOf } from '../../src/lib/genres';

export interface Candidate {
  id: number;
  year: number;
  votes: number;
}

/**
 * Target number of catalogue titles per decade for the content layer (silent era to today).
 * Roughly proportional to how much was released and how well-known the films are, with floors so
 * that early cinema is represented, not drowned out by sheer volume.
 */
export const DECADE_QUOTAS: Readonly<Record<number, number>> = {
  1890: 12, 1900: 40, 1910: 110, 1920: 300, 1930: 450, 1940: 520, 1950: 620,
  1960: 680, 1970: 700, 1980: 720, 1990: 740, 2000: 760, 2010: 780, 2020: 600,
};

export function selectByDecade(
  candidates: readonly Candidate[],
  quotas: Readonly<Record<number, number>>,
  opts: { exclude?: ReadonlySet<number>; overshoot?: number; minVotes?: number } = {},
): Candidate[] {
  const { exclude, overshoot = 1, minVotes = 0 } = opts;
  const byDecade = new Map<number, Candidate[]>();
  for (const c of candidates) {
    if (exclude?.has(c.id) || c.votes < minVotes) continue;
    const d = decadeOf(c.year);
    if (quotas[d] === undefined) continue;
    const list = byDecade.get(d) ?? [];
    list.push(c);
    byDecade.set(d, list);
  }
  const out: Candidate[] = [];
  for (const [decade, list] of byDecade) {
    list.sort((a, b) => b.votes - a.votes || a.id - b.id);
    out.push(...list.slice(0, Math.ceil((quotas[decade] as number) * overshoot)));
  }
  return out.sort((a, b) => a.year - b.year || b.votes - a.votes || a.id - b.id);
}
