/**
 * Item-item adjusted cosine similarity with shrinkage and popularity damping.
 *
 * For items i and j and users u with ratings r_ui:
 *   c_ui     = r_ui - mean(r_u)                       (user-mean centred, "adjusted")
 *   cos(i,j) = sum_u c_ui c_uj / (||c_i|| ||c_j||)    (norms over all training users)
 *   shrunk   = cos * n_ij / (n_ij + lambda)           (n_ij = users who rated both)
 *   score    = shrunk / (pop_j / meanPop)^alpha       (selection only; popularity damping)
 *
 * Raw co-occurrence counts rank blockbusters first for every seed. Centring removes per-user
 * rating bias, shrinkage distrusts pairs with few co-raters, and damping surfaces less obvious
 * neighbours. Only the shrunk similarity is shipped; damping is applied again at query time.
 */

export interface PairAccumulator {
  readonly n: number;
  /** Upper triangle (i <= j) of sum_u c_ui c_uj, row-major n*n. Diagonal = squared norm. */
  readonly dot: Float64Array;
  /** Upper triangle of co-rater counts. Diagonal = item rating count (popularity). */
  readonly count: Uint32Array;
}

export function createAccumulator(n: number): PairAccumulator {
  return { n, dot: new Float64Array(n * n), count: new Uint32Array(n * n) };
}

/**
 * Add one user. `items` must be strictly ascending item indices in [0, n);
 * `centred[k]` is that user's centred rating of `items[k]`.
 */
export function addUser(acc: PairAccumulator, items: ArrayLike<number>, centred: ArrayLike<number>): void {
  const { n, dot, count } = acc;
  const m = items.length;
  for (let a = 0; a < m; a++) {
    const i = items[a] as number;
    const ci = centred[a] as number;
    const row = i * n;
    for (let b = a; b < m; b++) {
      const j = items[b] as number;
      dot[row + j] = (dot[row + j] as number) + ci * (centred[b] as number);
      count[row + j] = (count[row + j] as number) + 1;
    }
  }
}

/** Merge `other` into `into` (used to combine per-worker accumulators). */
export function mergeAccumulators(into: PairAccumulator, other: PairAccumulator): void {
  for (let k = 0; k < into.dot.length; k++) {
    into.dot[k] = (into.dot[k] as number) + (other.dot[k] as number);
    into.count[k] = (into.count[k] as number) + (other.count[k] as number);
  }
}

const upper = (n: number, i: number, j: number): number => (i <= j ? i * n + j : j * n + i);

export function cosine(acc: PairAccumulator, i: number, j: number): number {
  const { n, dot } = acc;
  const di = Math.sqrt(dot[i * n + i] as number);
  const dj = Math.sqrt(dot[j * n + j] as number);
  if (di === 0 || dj === 0) return 0;
  return (dot[upper(n, i, j)] as number) / (di * dj);
}

export function coCount(acc: PairAccumulator, i: number, j: number): number {
  return acc.count[upper(acc.n, i, j)] as number;
}

export function shrunkCosine(acc: PairAccumulator, i: number, j: number, lambda: number): number {
  const n = coCount(acc, i, j);
  if (n === 0) return 0;
  return cosine(acc, i, j) * (n / (n + lambda));
}

export interface NeighbourOptions {
  k: number;
  lambda: number;
  alpha: number;
}

export interface NeighbourList {
  idx: number[];
  /** Shrunk cosine similarity in (0, 1], same order as `idx`, best first. */
  sim: number[];
}

/** Top-k neighbours per item, chosen by damped score and reported by shrunk similarity. */
export function topNeighbours(acc: PairAccumulator, opts: NeighbourOptions): NeighbourList[] {
  const { n, count } = acc;
  let popSum = 0;
  for (let i = 0; i < n; i++) popSum += count[i * n + i] as number;
  const meanPop = popSum / n || 1;
  const damp = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const pop = Math.max(1, count[j * n + j] as number);
    damp[j] = Math.pow(pop / meanPop, opts.alpha);
  }

  const out: NeighbourList[] = [];
  for (let i = 0; i < n; i++) {
    const cands: { j: number; sim: number; score: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const sim = shrunkCosine(acc, i, j, opts.lambda);
      if (sim <= 0) continue;
      cands.push({ j, sim, score: sim / (damp[j] as number) });
    }
    cands.sort((a, b) => b.score - a.score || a.j - b.j);
    const best = cands.slice(0, opts.k);
    out.push({ idx: best.map((c) => c.j), sim: best.map((c) => c.sim) });
  }
  return out;
}

/** Interleave `[idx, sim*1000, idx, sim*1000, ...]`, the compact on-disk form. */
export function packNeighbours(list: NeighbourList): number[] {
  const flat: number[] = [];
  list.idx.forEach((j, a) => {
    flat.push(j, Math.max(1, Math.round((list.sim[a] as number) * 1000)));
  });
  return flat;
}
