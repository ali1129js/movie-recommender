# Data pipeline

All data is built offline by scripts in `scripts/` and committed as two static JSON files in `public/data/`.
The app never calls an API at runtime.

```
scripts/download-raw.sh        # MovieLens 32M + IMDb ratings/basics -> raw/ (git-ignored)
npm run data:build             # core + content
npm run data:build -- core     # only the MovieLens layer (about 1 minute)
npm run data:build -- content  # only the Wikidata layer (long: rate-limited, cached on disk)
```

Set `RECSYS_RAW_DIR` to keep raw files elsewhere. Wikidata responses are cached in `$RECSYS_RAW_DIR/wikidata-cache`,
so an interrupted build resumes where it stopped. `WDQS_ENDPOINT` overrides the query service URL (Wikidata is migrating
its query backend in 2026-27).

## `core.json`: MovieLens layer

- The 3,000 most-rated MovieLens 32M films that have a release year, an IMDb link and at least one genre.
- **Titles** go through `scripts/lib/titles.ts` (natural word order, alternative titles split out, a real year or
  the film is dropped, so there is no year 0).
- **Similarity**: item-item *adjusted cosine* (ratings centred on each user's mean), computed over all 32M ratings in
  two streaming passes (`scripts/lib/similarity.ts`).
  - *Shrinkage*: `sim * n / (n + 50)` where `n` is the number of users who rated both films, so thinly supported pairs
    cannot rank first.
  - *Popularity damping* when choosing neighbours: score `= sim / (pop_j / meanPop)^0.1`.
  - The 30 best neighbours per film are stored as `[index, similarity * 1000, ...]`.
- Also stored per film: IMDb rating and vote count (snapshot date in the file), MovieLens mean and count.
- **No user-level data.** Only per-film aggregates and film-to-film similarities.

## `content.json`: Wikidata layer

- Candidates: IMDb feature films (and silent-era shorts up to 1929), non-adult, picked by vote count within a
  per-decade quota (`scripts/lib/select.ts`, silent era to the 2020s), excluding the core 3,000.
- Title, genre (P136), director (P57) and cast (P161) come from the Wikidata Query Service (CC0). Wikidata genre
  labels are mapped to the app's 18 genres (`scripts/lib/wikidataGenres.ts`). Titles without an English label or a
  mappable genre are dropped.
- People who appear in fewer than two films are pruned (they carry no matching signal). Cast is limited to the six best
  known actors per film (by Wikidata sitelink count).
- These titles have **no viewer-rating neighbours**. The app matches them by genre overlap, shared director/cast and
  release era, and always labels such results "Content-based".

## Known limits

- MovieLens ratings stop in October 2023, so viewer-rating recommendations cannot include newer films; those appear
  only through the content layer.
- Wikidata coverage of cast and genre is uneven, especially for early cinema and non-English films.
