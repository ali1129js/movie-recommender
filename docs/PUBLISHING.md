# Publishing

The site is a static build deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`
(and manually via *Run workflow*). The workflow installs dependencies, runs `npm run typecheck`, `npm test` and
`npm run build`, then publishes `dist/`.

* Vite `base` is `/movie-recommender/` (the repository name), which is where GitHub Pages serves a project site.
  For a root-hosted deployment build with `VITE_BASE=/ npm run build`.
* Settings -> Pages -> Source must be **GitHub Actions**, and the `github-pages` environment must allow the default branch.

## Licence checklist

- **MovieLens**: derived data (item-item similarities, aggregates) may be redistributed non-commercially under
  the same licence, with the citation and non-endorsement notice that the footer shows. Raw ratings are not shipped
  and `raw/` is git-ignored.
- **IMDb**: ratings and vote counts are shown with attribution and a link to the title page. IMDb's dataset licence is
  for personal and non-commercial use and IMDb may withdraw permission. If that becomes a concern, rebuild without IMDb
  data: the `imdbRating` and `imdbVotes` fields are optional in the UI (items with `0` simply show no rating).
- **Wikidata**: CC0, no restrictions.
