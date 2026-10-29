# Movie Recommender

A client-side movie recommender. Pick films you like and get recommendations with "because you liked X" explanations.
No server, no API keys, nothing you pick leaves your browser.

* **Viewer-rating layer**: the 3,000 most-rated films of MovieLens 32M with 30 precomputed neighbours each
  (item-item adjusted cosine, shrinkage, mild popularity damping).
* **Wider catalogue layer**: 7,032 more titles from the silent era to 2026 (Wikidata, CC0), matched by genre, director,
  cast and era, always labelled **Content-based** in the UI. It is lazy-loaded after the first render.
* Multi-film selection, genre and decade filters, popular vs hidden-gems, sort options, three themes
  (light, dark, high contrast), keyboard-accessible combobox search, IMDb ratings with link-out.

## Commands

```
npm install
npm run dev          # local dev server
npm test             # 202 tests (Vitest)
npm run typecheck    # strict TS, noUncheckedIndexedAccess
npm run build        # typecheck + production build into dist/
VITE_BASE=/ npm run build && npm run shots   # headless Chrome e2e: screenshots, axe (incl. contrast) for 3 themes x 2 widths
npm run data:build   # rebuild public/data/*.json (see docs/DATA.md, needs raw downloads)
```

## How recommendations work

* **Viewer-rating layer** (`src/lib/recommender.ts`, `scripts/lib/similarity.ts`): adjusted cosine over MovieLens ratings with
  shrinkage and mild popularity damping, so blockbusters do not win by raw co-occurrence.
* **Content layer**: genre overlap (rarity-weighted; Action/Adventure count for less because every tentpole carries them),
  shared director (strongest signal), shared cast (down-weighted for prolific actors) and era. Links with no shared director,
  at most one shared actor and a loose genre match are discounted, so a franchise ensemble does not drag in unrelated
  blockbusters (for example, *Dune* (2021) no longer surfaces Marvel films because Josh Brolin is in both).
* Pure, immutable state (`src/lib/state.ts`); search is plain-text normalisation, never a RegExp built from input.

## Size (gzipped)

| File | Size |
|---|---|
| JS (React 19 app) | 101.4 kB |
| CSS | 2.0 kB |
| `core.json` (eager) | 360.5 kB |
| `content.json` (lazy) | 355.0 kB |
| **Total** | **about 820 kB** |

## Catalogue by decade

| Decade | MovieLens | Wikidata | Total |
|---|---|---|---|
| 1890s | 0 | 12 | 12 |
| 1900s | 0 | 40 | 40 |
| 1910s | 0 | 110 | 110 |
| 1920s | 6 | 300 | 306 |
| 1930s | 27 | 450 | 477 |
| 1940s | 30 | 520 | 550 |
| 1950s | 65 | 620 | 685 |
| 1960s | 91 | 680 | 771 |
| 1970s | 131 | 700 | 831 |
| 1980s | 374 | 720 | 1094 |
| 1990s | 898 | 740 | 1638 |
| 2000s | 873 | 760 | 1633 |
| 2010s | 490 | 780 | 1270 |
| 2020s | 15 | 600 | 615 |
| **Total** | **3000** | **7032** | **10032** |

## Live site

https://ali1129js.github.io/movie-recommender/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`).

## Docs

* [docs/DATA.md](docs/DATA.md): how the data is built and its limits
* [docs/PUBLISHING.md](docs/PUBLISHING.md): how the GitHub Pages deployment works
* [NOTICE.md](NOTICE.md): MovieLens citation and non-endorsement, IMDb and Wikidata attribution

## Known limits

* MovieLens ratings stop in October 2023, so viewer-rating recommendations cannot cover newer films.
* IMDb data is used under its non-commercial terms; IMDb may withdraw permission.
* Wikidata cast/genre coverage is uneven for early and non-English cinema.
