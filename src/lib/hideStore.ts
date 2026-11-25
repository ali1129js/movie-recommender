import { z } from "zod";
import type { Catalog } from "./types";

/** Versioned, Zod-checked list of titles the visitor does not want to see again. */
export const HIDDEN_KEY = "movie-recommender.v1.hidden";

const hiddenStoreSchema = z.object({
  imdbIds: z.array(z.number().int().positive()),
});

export function uniqueIds(ids: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ids) {
    if (id > 0 && Number.isInteger(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Returns a clean list, or empty if the key is missing or the JSON is corrupt. Never throws. */
export function readHiddenIds(): number[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (raw === null) return [];
    const parsed = hiddenStoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? uniqueIds(parsed.data.imdbIds) : [];
  } catch {
    return [];
  }
}

export function writeHiddenIds(imdbIds: readonly number[]): void {
  try {
    window.localStorage.setItem(
      HIDDEN_KEY,
      JSON.stringify({ imdbIds: uniqueIds(imdbIds) }),
    );
  } catch {
    /* storage blocked */
  }
}

export function imdbIdsForIndices(
  indices: readonly number[],
  catalog: Catalog,
): number[] {
  return uniqueIds(
    indices.flatMap((index) => {
      const movie = catalog.movies[index];
      return movie ? [movie.imdbId] : [];
    }),
  );
}

export function indicesForImdbIds(
  imdbIds: readonly number[],
  catalog: Catalog,
): number[] {
  const wanted = new Set(imdbIds);
  return catalog.movies.filter((m) => wanted.has(m.imdbId)).map((m) => m.index);
}

/**
 * Hide a title for this session or persistently.
 * A current seed cannot be hidden, so the engine cannot be emptied by hiding itself.
 */
export function hideTitle(
  imdbId: number,
  persist: boolean,
  session: readonly number[],
  persistent: readonly number[],
  seedImdbIds: readonly number[],
): { session: number[]; persistent: number[]; hidden: boolean } {
  if (seedImdbIds.includes(imdbId)) {
    return {
      session: uniqueIds(session),
      persistent: uniqueIds(persistent),
      hidden: false,
    };
  }
  if (persist) {
    return {
      session: uniqueIds(session).filter((id) => id !== imdbId),
      persistent: uniqueIds([...persistent, imdbId]),
      hidden: true,
    };
  }
  return {
    session: uniqueIds([...session, imdbId]),
    persistent: uniqueIds(persistent),
    hidden: true,
  };
}

export function unhideTitle(
  imdbId: number,
  session: readonly number[],
  persistent: readonly number[],
): { session: number[]; persistent: number[] } {
  return {
    session: uniqueIds(session).filter((id) => id !== imdbId),
    persistent: uniqueIds(persistent).filter((id) => id !== imdbId),
  };
}

export function mergedHidden(
  session: readonly number[],
  persistent: readonly number[],
): number[] {
  return uniqueIds([...session, ...persistent]);
}
