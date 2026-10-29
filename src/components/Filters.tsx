import { GENRES, decadeLabel } from '../lib/genres';
import type { Mode, SortKey } from '../lib/recommender';
import type { Action, AppState } from '../lib/state';

interface Props {
  state: AppState;
  dispatch: (a: Action) => void;
  decades: readonly number[];
}

const SORTS: [SortKey, string][] = [
  ['relevance', 'Best match'],
  ['imdb', 'IMDb rating'],
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
];

export function Filters({ state, dispatch, decades }: Props) {
  const mask = state.filters.genreMask;
  const modes: [Mode, string, string][] = [
    ['popular', 'Popular', 'Well-known films first'],
    ['gems', 'Hidden gems', 'Favour less-watched films'],
  ];
  return (
    <section aria-labelledby="filters-h" className="panel">
      <h2 id="filters-h">Refine</h2>

      <fieldset className="genres">
        <legend>Genres (show films with any selected)</legend>
        <div className="chips">
          {GENRES.map((g, i) => {
            const on = (mask & (1 << i)) !== 0;
            return (
              <button
                key={g}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => dispatch({ type: 'toggleGenre', genre: g })}
              >
                {g}
              </button>
            );
          })}
          {mask !== 0 && (
            <button type="button" className="link-button" onClick={() => dispatch({ type: 'clearGenres' })}>
              Clear genres
            </button>
          )}
        </div>
      </fieldset>

      <div className="row">
        <div>
          <label className="field-label" htmlFor="decade">
            Decade
          </label>
          <select
            id="decade"
            value={state.filters.decade ?? ''}
            onChange={(e) => dispatch({ type: 'setDecade', decade: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Any decade</option>
            {decades.map((d) => (
              <option key={d} value={d}>
                {decadeLabel(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="sort">
            Sort by
          </label>
          <select id="sort" value={state.sort} onChange={(e) => dispatch({ type: 'setSort', sort: e.target.value as SortKey })}>
            {SORTS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="modes">
          <legend>Discovery</legend>
          <div className="segmented">
            {modes.map(([k, label, hint]) => (
              <label key={k} className={state.mode === k ? 'seg on' : 'seg'}>
                <input
                  type="radio"
                  name="mode"
                  value={k}
                  checked={state.mode === k}
                  onChange={() => dispatch({ type: 'setMode', mode: k })}
                />
                <span>{label}</span>
                <span className="visually-hidden"> – {hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
