# Learning notes

Short explanations of the ideas this project actually uses, and why they matter. Each one points at a file.

## Item-item versus the content layer

There are two recommenders, and they should not be mixed up. The viewer-rating layer is item-item collaborative filtering: each pick contributes its precomputed MovieLens neighbours (shrunk adjusted cosine), and a candidate's score is the sum of those similarities. That is evidence from how people actually rated films together. The content layer is a different question. It matches genre, director, cast and era for titles MovieLens cannot speak about (the wider Wikidata catalogue, or a pick that is not in the top 3,000). Those rows are always labelled content-based, because they are not collaborative evidence.

See `src/lib/recommender.ts` (`recommend`, `recommendContent`, `contentLink`).

## Search never builds a RegExp from input

A typed title is untrusted text. If you compile it into a regular expression, characters like `(`, `[` or `.*` become syntax, and a typo can throw or match far too much. Search therefore normalises the query and the titles to plain text (lower case, no diacritics, punctuation as spaces) and then uses `startsWith` / `includes`. Special characters stay literal.

See `normalize` and `searchMovies` in `src/lib/search.ts`.

## The content layer is lazy-loaded

The first useful thing a visitor can do is search and pick a film from the MovieLens core. That data is enough to show collaborative recommendations, so `useCatalog` loads `core.json` first and paints. `content.json` is about as large again; fetching it up front would delay that first search. It is loaded afterwards, validated with Zod, and merged in. If the second fetch fails, the core catalogue still works.

See `src/lib/useCatalog.ts`.
