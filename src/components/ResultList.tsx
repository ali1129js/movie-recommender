import { explain } from '../lib/explain';
import type { Recommendation } from '../lib/recommender';
import { imdbUrl, type Catalog } from '../lib/types';

interface Props {
  catalog: Catalog;
  recs: readonly Recommendation[];
  onPick: (index: number) => void;
}

const votesLabel = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);

export function ResultList({ catalog, recs, onPick }: Props) {
  return (
    <ol className="results">
      {recs.map((rec) => {
        const m = rec.movie;
        const why = explain(catalog, rec);
        return (
          <li key={m.index} className="card" data-kind={rec.kind}>
            <div className="card-head">
              <h3>
                {m.title} <span className="year">({m.year})</span>
              </h3>
              <span className={rec.kind === 'content' ? 'badge badge-content' : 'badge badge-cf'}>
                {rec.kind === 'content' ? 'Content-based' : 'Viewer ratings'}
              </span>
            </div>
            <p className="meta">
              {m.genres.join(' · ')}
              {m.imdbRating !== null && (
                <>
                  {' '}
                  <span className="rating">
                    <span aria-hidden="true">★</span> {m.imdbRating.toFixed(1)}
                    <span className="visually-hidden"> out of 10 on IMDb</span> ({votesLabel(m.imdbVotes)} votes){' '}
                  </span>
                </>
              )}
              <a
                href={imdbUrl(m.imdbId)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${m.title} on IMDb (opens in a new tab)`}
              >
                IMDb
              </a>
            </p>
            <p className="why">
              <strong>{why.headline}.</strong> {why.detail}
            </p>
            <button type="button" className="link-button" onClick={() => onPick(m.index)}>
              Add {m.title} to my picks
            </button>
          </li>
        );
      })}
    </ol>
  );
}
