import { describe, expect, it } from "vitest";
import { MAX_PICKS } from "./state";
import { PICKS_KEY, readStoredPicks, writeStoredPicks } from "./pickStore";

describe("pickStore", () => {
  it("round-trips a list of IMDb ids", () => {
    expect(readStoredPicks()).toEqual([]);
    writeStoredPicks([113277, 114369]);
    expect(readStoredPicks()).toEqual([113277, 114369]);
    expect(JSON.parse(window.localStorage.getItem(PICKS_KEY) ?? "{}")).toEqual({
      imdbIds: [113277, 114369],
    });
  });

  it("caps a long list at MAX_PICKS", () => {
    const ids = Array.from({ length: MAX_PICKS + 3 }, (_, i) => 1000000 + i);
    writeStoredPicks(ids);
    expect(readStoredPicks()).toHaveLength(MAX_PICKS);
    expect(readStoredPicks()).toEqual(ids.slice(0, MAX_PICKS));

    window.localStorage.setItem(PICKS_KEY, JSON.stringify({ imdbIds: ids }));
    expect(readStoredPicks()).toEqual(ids.slice(0, MAX_PICKS));
  });

  it("starts from an empty list when the JSON is corrupt, without throwing", () => {
    window.localStorage.setItem(PICKS_KEY, "{nope");
    expect(readStoredPicks()).toEqual([]);
    window.localStorage.setItem(
      PICKS_KEY,
      JSON.stringify({ imdbIds: ["tt0113277"] }),
    );
    expect(readStoredPicks()).toEqual([]);
    window.localStorage.setItem(
      PICKS_KEY,
      JSON.stringify({ imdbIds: [0, -1] }),
    );
    expect(readStoredPicks()).toEqual([]);
  });
});
