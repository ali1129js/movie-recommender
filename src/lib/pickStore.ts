import { z } from "zod";
import { MAX_PICKS } from "./state";
import type { Catalog } from "./types";

/** Versioned, Zod-checked copy of the current picks, stored as IMDb ids. */
export const PICKS_KEY = "movie-recommender.v1.picks";

const picksStoreSchema = z.object({
  imdbIds: z.array(z.number().int().positive()),
});

function uniqueCapped(ids: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ids) {
    if (id > 0 && Number.isInteger(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_PICKS) break;
  }
  return out;
}

/** Returns a clean list, or empty if the key is missing or the JSON is corrupt. Never throws. */
export function readStoredPicks(): number[] {
  try {
    const raw = window.localStorage.getItem(PICKS_KEY);
    if (raw === null) return [];
    const parsed = picksStoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? uniqueCapped(parsed.data.imdbIds) : [];
  } catch {
    return [];
  }
}

export function writeStoredPicks(imdbIds: readonly number[]): void {
  try {
    window.localStorage.setItem(
      PICKS_KEY,
      JSON.stringify({ imdbIds: uniqueCapped(imdbIds) }),
    );
  } catch {
    /* storage blocked */
  }
}

export function imdbIdsForPicks(
  picks: readonly number[],
  catalog: Catalog,
): number[] {
  return uniqueCapped(
    picks.flatMap((index) => {
      const movie = catalog.movies[index];
      return movie ? [movie.imdbId] : [];
    }),
  );
}
