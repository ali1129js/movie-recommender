import type { Genre } from './genres';

export type Source = 'movielens' | 'wikidata';

export interface Movie {
  /** Position in `Catalog.movies`. Core (MovieLens) films come first. */
  readonly index: number;
  readonly source: Source;
  readonly title: string;
  readonly year: number;
  readonly genreMask: number;
  readonly genres: readonly Genre[];
  readonly imdbId: number;
  /** IMDb average rating (0-10), or null when IMDb has none. */
  readonly imdbRating: number | null;
  readonly imdbVotes: number;
  /** MovieLens mean rating in stars (0.5-5), core films only. */
  readonly mlMean: number | null;
  readonly mlCount: number;
  readonly altTitles: readonly string[];
  readonly directors: readonly number[];
  readonly cast: readonly number[];
}

export interface Neighbour {
  index: number;
  /** Shrunk adjusted-cosine similarity, 0-1. */
  sim: number;
}

export interface Catalog {
  readonly movies: readonly Movie[];
  /** Number of leading entries that come from MovieLens (they have neighbour lists). */
  readonly coreCount: number;
  /** Neighbour lists for core films, best first. */
  readonly neighbours: readonly (readonly Neighbour[])[];
  /** Person names referenced by `Movie.directors` / `Movie.cast`; empty until content loads. */
  readonly people: readonly string[];
  readonly hasContent: boolean;
  readonly meta: {
    movielensDataset: string;
    movielensUsers: number;
    movielensRatings: number;
    movielensThrough: string;
    imdbSnapshot: string;
  };
}

export const imdbUrl = (imdbId: number): string => `https://www.imdb.com/title/tt${String(imdbId).padStart(7, '0')}/`;
