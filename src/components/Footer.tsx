import type { Catalog } from '../lib/types';

export function Footer({ catalog }: { catalog: Catalog | null }) {
  return (
    <footer className="footer">
      <h2>Data and attribution</h2>
      <p>
        <strong>MovieLens.</strong> Viewer-rating similarities are derived from the MovieLens 32M dataset
        {catalog ? ` (${catalog.meta.movielensUsers.toLocaleString('en-US')} users, ${catalog.meta.movielensRatings.toLocaleString('en-US')} ratings, collected through ${catalog.meta.movielensThrough})` : ''}.
        F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context. ACM Transactions on
        Interactive Intelligent Systems 5(4), Article 19.{' '}
        <a href="https://doi.org/10.1145/2827872" target="_blank" rel="noopener noreferrer">
          doi:10.1145/2827872
        </a>
        . This project is not endorsed by GroupLens or the University of Minnesota, and no individual user ratings are
        included. Viewer-rating recommendations reflect MovieLens members up to that date, so they do not cover more
        recent films; those appear only in the content-based list.
      </p>
      <p>
        <strong>IMDb.</strong> Ratings and vote counts: Information courtesy of{' '}
        <a href="https://www.imdb.com" target="_blank" rel="noopener noreferrer">
          IMDb (https://www.imdb.com)
        </a>
        . Used with permission.
        {catalog ? ` Snapshot ${catalog.meta.imdbSnapshot}.` : ''} Film links go to IMDb.
      </p>
      <p>
        <strong>Wikidata.</strong> Titles, genres, directors and cast for the wider catalogue come from{' '}
        <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">
          Wikidata
        </a>{' '}
        (CC0 1.0 public domain dedication).
      </p>
      <p className="small">Recommendations run entirely in your browser; nothing you pick is sent anywhere.</p>
    </footer>
  );
}
