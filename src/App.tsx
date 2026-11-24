import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Filters } from "./components/Filters";
import { Footer } from "./components/Footer";
import { ResultList } from "./components/ResultList";
import { SearchBox } from "./components/SearchBox";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { decadeOf } from "./lib/genres";
import { recommend } from "./lib/recommender";
import { buildSearchIndex, searchMovies } from "./lib/search";
import { initialState, MAX_PICKS, reducer } from "./lib/state";
import { applyTheme, initialTheme, type Theme } from "./lib/theme";
import {
  imdbIdsForPicks,
  readStoredPicks,
  writeStoredPicks,
} from "./lib/pickStore";
import { encodeSelection, parseSelection, resolvePicks } from "./lib/urlState";
import { defaultLoaders, useCatalog, type Loaders } from "./lib/useCatalog";

const EXAMPLES = ["Heat", "Spirited Away", "Alien", "Casablanca"];

export function App({ loaders = defaultLoaders }: { loaders?: Loaders }) {
  const [attempt, setAttempt] = useState(0);
  const { catalog, status } = useCatalog(loaders, attempt);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());

  useEffect(() => applyTheme(theme), [theme]);

  // Restore picks from the URL if it has any, otherwise from the Zod-checked localStorage copy.
  // A shared link always wins when both are present. After that, keep the URL and the store in step.
  const linked = useRef(parseSelection(window.location.search));
  const [hydrated, setHydrated] = useState(false);

  const index = useMemo(
    () => (catalog ? buildSearchIndex(catalog.movies) : { entries: [] }),
    [catalog],
  );
  const picked = useMemo(() => new Set(state.picks), [state.picks]);

  const decades = useMemo(() => {
    const set = new Set<number>();
    for (const m of catalog?.movies ?? []) set.add(decadeOf(m.year));
    return [...set].sort((a, b) => a - b);
  }, [catalog]);

  const contentSettled =
    status.phase === "ready" && status.content !== "loading";

  useEffect(() => {
    if (hydrated || !catalog) return;
    const sel = linked.current;
    const sourceIds = sel.imdbIds.length > 0 ? sel.imdbIds : readStoredPicks();
    const { picks, missing } = resolvePicks(sourceIds, catalog);
    const decadeKnown = sel.decade === null || decades.includes(sel.decade);
    // Films and decades that only exist in the lazy content layer resolve once it has loaded (or failed).
    if ((missing.length > 0 || !decadeKnown) && !contentSettled) return;
    dispatch({
      type: "hydrate",
      picks,
      filters: {
        genreMask: sel.genreMask,
        decade: decadeKnown ? sel.decade : null,
      },
      mode: sel.mode,
      sort: sel.sort,
    });
    setHydrated(true);
  }, [hydrated, catalog, decades, contentSettled]);

  useEffect(() => {
    if (!hydrated || !catalog) return;
    const { pathname, search, hash } = window.location;
    const next = encodeSelection(state, catalog, search);
    if (next !== search)
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${next}${hash}`,
      );
    writeStoredPicks(imdbIdsForPicks(state.picks, catalog));
  }, [hydrated, catalog, state]);

  const result = useMemo(() => {
    if (!catalog || state.picks.length === 0) return null;
    return recommend(catalog, state.picks, {
      mode: state.mode,
      filters: state.filters,
      limit: state.limit,
      sort: state.sort,
    });
  }, [
    catalog,
    state.picks,
    state.mode,
    state.filters,
    state.limit,
    state.sort,
  ]);

  const pickByTitle = useCallback(
    (title: string) => {
      const hit = searchMovies(index, title, { limit: 1 })[0];
      if (hit) dispatch({ type: "pick", index: hit.index });
    },
    [index],
  );

  const ready = status.phase === "ready" && catalog !== null;
  const total = result
    ? result.collaborative.length + result.content.length
    : 0;

  return (
    <div className="page">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div>
          <h1>Film Finder</h1>
          <p className="tagline">
            Pick films you love. Get recommendations from real viewer ratings,
            plus the whole history of cinema.
          </p>
        </div>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </header>

      <main id="main">
        {status.phase === "error" && (
          <div role="alert" className="alert">
            <p>Could not load the film data. {status.message}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        )}
        {status.phase === "loading-core" && (
          <p role="status" className="hint">
            Loading the film catalogue…
          </p>
        )}

        <section aria-labelledby="pick-h" className="panel">
          <h2 id="pick-h">1. Pick films you like</h2>
          <SearchBox
            index={index}
            picked={picked}
            disabled={!ready}
            onPick={(m) => dispatch({ type: "pick", index: m.index })}
          />
          {ready && state.picks.length === 0 && (
            <p className="examples">
              Not sure? Try:{" "}
              {EXAMPLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="link-button"
                  onClick={() => pickByTitle(t)}
                >
                  {t}
                </button>
              ))}
            </p>
          )}
          {catalog && state.picks.length > 0 && (
            <div className="picks">
              <h3 id="picks-h">
                Your picks ({state.picks.length}/{MAX_PICKS})
              </h3>
              <ul aria-labelledby="picks-h" className="chips">
                {state.picks.map((i) => {
                  const m = catalog.movies[i];
                  if (!m) return null;
                  return (
                    <li key={i} className="pick">
                      <span>
                        {m.title} ({m.year})
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${m.title}`}
                        onClick={() => dispatch({ type: "unpick", index: i })}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="link-button"
                onClick={() => dispatch({ type: "clear" })}
              >
                Clear all
              </button>
              {state.picks.length >= MAX_PICKS && (
                <p className="hint">
                  That is the maximum of {MAX_PICKS} picks. Remove one to add
                  another.
                </p>
              )}
            </div>
          )}
          {status.phase === "ready" && status.content === "loading" && (
            <p role="status" className="hint">
              Loading the wider all-eras catalogue…
            </p>
          )}
          {status.phase === "ready" && status.content === "failed" && (
            <p role="status" className="hint">
              The wider catalogue could not be loaded, so only the MovieLens
              films are available.
            </p>
          )}
        </section>

        {ready && (
          <Filters state={state} dispatch={dispatch} decades={decades} />
        )}

        <section
          aria-labelledby="results-h"
          className="panel"
          aria-live="polite"
        >
          <h2 id="results-h">2. Recommendations</h2>
          {!ready && <p className="hint">Recommendations will appear here.</p>}
          {ready && state.picks.length === 0 && (
            <p className="hint" data-testid="empty-picks">
              Pick at least one film above to see recommendations.
            </p>
          )}
          {catalog && result && (
            <>
              {total === 0 && (
                <p className="hint" data-testid="no-results">
                  No recommendations match these filters. Try removing a genre
                  or choosing “Any decade”.
                </p>
              )}
              {result.collaborative.length > 0 && (
                <section aria-labelledby="cf-h">
                  <h3 id="cf-h">From viewer ratings (MovieLens)</h3>
                  <ResultList
                    catalog={catalog}
                    recs={result.collaborative}
                    picked={picked}
                    onTogglePick={(i) =>
                      dispatch({
                        type: picked.has(i) ? "unpick" : "pick",
                        index: i,
                      })
                    }
                  />
                </section>
              )}
              {result.content.length > 0 && (
                <section aria-labelledby="content-h">
                  <h3 id="content-h">
                    From the wider catalogue (content-based)
                  </h3>
                  <p className="hint">
                    Matched on genre, director, cast and era, not on what
                    viewers rated. Useful for older and newer films MovieLens
                    cannot speak for.
                  </p>
                  <ResultList
                    catalog={catalog}
                    recs={result.content}
                    picked={picked}
                    onTogglePick={(i) =>
                      dispatch({
                        type: picked.has(i) ? "unpick" : "pick",
                        index: i,
                      })
                    }
                  />
                </section>
              )}
              {total > 0 &&
                (result.collaborative.length >= state.limit ||
                  result.content.length >= state.limit) && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "more" })}
                  >
                    Show more
                  </button>
                )}
            </>
          )}
        </section>
      </main>

      <Footer catalog={catalog} />
    </div>
  );
}
