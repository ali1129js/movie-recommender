import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_KEY,
  THEME_KEY,
  applyMotion,
  effectiveMotion,
  initialMotion,
  initialTheme,
  migrateTheme,
  type Theme,
} from "./theme";

describe("migrateTheme", () => {
  it.each([
    ["khaki", "khaki"],
    ["graphite", "graphite"],
    ["midnight", "midnight"],
    ["light", "khaki"],
    ["dark", "graphite"],
    ["contrast", "graphite"],
  ] as const)("maps %s to %s", (from, want) => {
    expect(migrateTheme(from)).toBe(want);
  });

  it("returns null for unknown or empty values", () => {
    expect(migrateTheme(null)).toBeNull();
    expect(migrateTheme("high-contrast")).toBeNull();
    expect(migrateTheme("")).toBeNull();
  });
});

describe("initialTheme", () => {
  it("uses a stored gloss theme", () => {
    window.localStorage.setItem(THEME_KEY, "midnight");
    expect(initialTheme()).toBe("midnight");
  });

  it("maps a saved contrast choice to Graphite", () => {
    window.localStorage.setItem(THEME_KEY, "contrast");
    expect(initialTheme()).toBe("graphite");
  });

  it("maps stored light to Khaki and dark to Graphite", () => {
    window.localStorage.setItem(THEME_KEY, "light");
    expect(initialTheme()).toBe("khaki");
    window.localStorage.setItem(THEME_KEY, "dark");
    expect(initialTheme()).toBe("graphite");
  });
});

describe("motion preference", () => {
  it("defaults to static", () => {
    expect(initialMotion()).toBe("static");
    expect(effectiveMotion("animated", true)).toBe("static");
    expect(effectiveMotion("animated", false)).toBe("animated");
  });

  it("writes data-motion and only stores animated when chosen", () => {
    applyMotion("animated");
    expect(document.documentElement.dataset.motion).toBe("animated");
    expect(window.localStorage.getItem(MOTION_KEY)).toBe("animated");
    applyMotion("static");
    expect(document.documentElement.dataset.motion).toBe("static");
  });
});

describe("no-flash inline script in index.html", () => {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";

  const run = (
    stored: string | null,
    dark: boolean,
    motionStored: string | null = null,
    reduced = false,
  ) => {
    const doc = {
      documentElement: {
        dataset: {} as Record<string, string>,
        style: {} as Record<string, string>,
      },
    };
    const ls = {
      getItem: (k: string) =>
        k === THEME_KEY ? stored : k === MOTION_KEY ? motionStored : null,
    };
    const mm = (q: string) => ({
      matches: q.includes("prefers-color-scheme: dark")
        ? dark
        : q.includes("prefers-reduced-motion")
          ? reduced
          : false,
    });
    new Function("document", "localStorage", "matchMedia", script)(
      doc,
      ls,
      mm,
    );
    return {
      theme: doc.documentElement.dataset.theme,
      scheme: doc.documentElement.style.colorScheme,
      motion: doc.documentElement.dataset.motion,
    };
  };

  it("comes before the app bundle", () => {
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('type="module"'));
  });

  it.each([
    [null, false, "khaki"],
    [null, true, "graphite"],
    ["midnight", false, "midnight"],
    ["khaki", true, "khaki"],
    ["light", true, "khaki"],
    ["dark", false, "graphite"],
    ["contrast", false, "graphite"],
    ["purple", false, "khaki"],
  ] as const)(
    "stored %s, system dark %s -> %s",
    (stored, dark, want: Theme) => {
      const r = run(stored, dark);
      expect(r.theme).toBe(want);
      expect(r.scheme).toBe(want === "khaki" ? "light" : "dark");
      expect(r.motion).toBe("static");
    },
  );

  it("applies a stored animated preference, but reduced motion wins", () => {
    expect(run(null, false, "animated", false).motion).toBe("animated");
    expect(run(null, false, "animated", true).motion).toBe("static");
  });
});
