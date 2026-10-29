import { maskToGenres } from './genres';
import {
  validateContent,
  validateCore,
  type ContentFile,
  type CoreFile,
} from './schema';
import type { Catalog, Movie, Neighbour } from './types';

const ratingOrNull = (r10: number): number | null => (r10 > 0 ? r10 / 10 : null);

function coreMovies(core: CoreFile, content: ContentFile | null): Movie[] {
  return core.items.map(([title, year, mask, imdb, rating10, votes, mlMean10, mlCount, alt], index) => {
    const features = content?.coreFeatures[index];
    return {
      index,
      source: 'movielens',
      title,
      year,
      genreMask: mask,
      genres: maskToGenres(mask),
      imdbId: imdb,
      imdbRating: ratingOrNull(rating10),
      imdbVotes: votes,
      mlMean: mlMean10 > 0 ? mlMean10 / 10 : null,
      mlCount,
      altTitles: alt ? alt.split(' | ') : [],
      directors: features?.[0] ?? [],
      cast: features?.[1] ?? [],
    };
  });
}

function unpackNeighbours(core: CoreFile): Neighbour[][] {
  return core.nn.map((row) => {
    const list: Neighbour[] = [];
    for (let a = 0; a < row.length; a += 2) list.push({ index: row[a] as number, sim: (row[a + 1] as number) / 1000 });
    return list;
  });
}

/** Builds a catalogue from validated JSON. Pass `content = null` for the MovieLens layer alone. */
export function buildCatalog(coreRaw: unknown, contentRaw: unknown | null): Catalog {
  const core = validateCore(coreRaw);
  const content = contentRaw === null ? null : validateContent(contentRaw, core.items.length);
  const movies = coreMovies(core, content);
  if (content) {
    content.items.forEach(([title, year, mask, imdb, rating10, votes, directors, cast], k) => {
      movies.push({
        index: core.items.length + k,
        source: 'wikidata',
        title,
        year,
        genreMask: mask,
        genres: maskToGenres(mask),
        imdbId: imdb,
        imdbRating: ratingOrNull(rating10),
        imdbVotes: votes,
        mlMean: null,
        mlCount: 0,
        altTitles: [],
        directors,
        cast,
      });
    });
  }
  return {
    movies,
    coreCount: core.items.length,
    neighbours: unpackNeighbours(core),
    people: content?.people ?? [],
    hasContent: content !== null,
    meta: {
      movielensDataset: core.movielens.dataset,
      movielensUsers: core.movielens.users,
      movielensRatings: core.movielens.ratings,
      movielensThrough: core.movielens.through,
      imdbSnapshot: core.imdbSnapshot,
    },
  };
}

export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.json() as Promise<unknown>;
}
