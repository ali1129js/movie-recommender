import { describe, expect, it } from "vitest";
import { recommend } from "./recommender";
import {
  HIDDEN_KEY,
  hideTitle,
  indicesForImdbIds,
  mergedHidden,
  readHiddenIds,
  unhideTitle,
  writeHiddenIds,
} from "./hideStore";
import { fixture } from "../test/fixtures";

const catalog = fixture();
const toyStory = catalog.movies[0]!;
const toy2 = catalog.movies[1]!;

describe("hideTitle", () => {
  it("hides a title for this session without writing persistence", () => {
    const result = hideTitle(toy2.imdbId, false, [], [], [toyStory.imdbId]);
    expect(result.hidden).toBe(true);
    expect(result.session).toEqual([toy2.imdbId]);
    expect(result.persistent).toEqual([]);
  });

  it("hides a title persistently and drops it from the session list", () => {
    const result = hideTitle(
      toy2.imdbId,
      true,
      [toy2.imdbId],
      [],
      [toyStory.imdbId],
    );
    expect(result.hidden).toBe(true);
    expect(result.session).toEqual([]);
    expect(result.persistent).toEqual([toy2.imdbId]);
  });

  it("refuses to hide a current seed", () => {
    const result = hideTitle(toyStory.imdbId, true, [], [], [toyStory.imdbId]);
    expect(result.hidden).toBe(false);
    expect(result.persistent).toEqual([]);
    expect(result.session).toEqual([]);
  });
});

describe("hide store persist", () => {
  it("round-trips a Zod-checked list and starts empty on bad JSON", () => {
    writeHiddenIds([toy2.imdbId, toy2.imdbId, -3]);
    expect(readHiddenIds()).toEqual([toy2.imdbId]);
    window.localStorage.setItem(HIDDEN_KEY, "{nope");
    expect(readHiddenIds()).toEqual([]);
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify({ imdbIds: ["x"] }));
    expect(readHiddenIds()).toEqual([]);
  });
});

describe("hidden titles and the recommender", () => {
  it("drops hidden titles from results", () => {
    const hidden = indicesForImdbIds([toy2.imdbId], catalog);
    const result = recommend(catalog, [toyStory.index], {
      mode: "popular",
      filters: { genreMask: 0, decade: null },
      limit: 12,
      sort: "relevance",
      exclude: new Set(hidden),
    });
    const ids = [...result.collaborative, ...result.content].map(
      (r) => r.movie.imdbId,
    );
    expect(ids).not.toContain(toy2.imdbId);
  });

  it("does not crash when a seed would hide every remaining candidate", () => {
    const seedIds = new Set([toyStory.imdbId]);
    const others = catalog.movies
      .filter((m) => !seedIds.has(m.imdbId))
      .map((m) => m.index);
    expect(() =>
      recommend(catalog, [toyStory.index], {
        mode: "popular",
        filters: { genreMask: 0, decade: null },
        limit: 12,
        sort: "relevance",
        exclude: new Set(others),
      }),
    ).not.toThrow();
    const result = recommend(catalog, [toyStory.index], {
      mode: "popular",
      filters: { genreMask: 0, decade: null },
      limit: 12,
      sort: "relevance",
      exclude: new Set(others),
    });
    expect(result.collaborative).toEqual([]);
    expect(result.content).toEqual([]);
  });

  it("unhide removes a title from both lists", () => {
    const cleared = unhideTitle(
      toy2.imdbId,
      [toy2.imdbId],
      [toy2.imdbId, toyStory.imdbId],
    );
    expect(cleared.session).toEqual([]);
    expect(cleared.persistent).toEqual([toyStory.imdbId]);
    expect(mergedHidden([1], [1, 2])).toEqual([1, 2]);
  });
});
