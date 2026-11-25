export const THEMES = ["khaki", "graphite", "midnight"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  khaki: "Khaki",
  graphite: "Graphite",
  midnight: "Midnight",
};

export const THEME_KEY = "movie-recommender-theme";
export const MOTION_KEY = "movie-recommender-motion";

export const MOTIONS = ["static", "animated"] as const;
export type Motion = (typeof MOTIONS)[number];

/** Older light / dark / contrast values; a saved contrast choice maps to Graphite. */
const LEGACY_THEMES: Record<string, Theme> = {
  light: "khaki",
  dark: "graphite",
  contrast: "graphite",
};

export const isTheme = (value: unknown): value is Theme =>
  THEMES.includes(value as Theme);

export function migrateTheme(value: unknown): Theme | null {
  if (isTheme(value)) return value;
  if (typeof value === "string" && value in LEGACY_THEMES)
    return LEGACY_THEMES[value]!;
  return null;
}

export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    const migrated = migrateTheme(stored);
    if (migrated) return migrated;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "graphite"
    : "khaki";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "khaki" ? "light" : "dark";
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage blocked */
  }
}

export function initialMotion(): Motion {
  try {
    return window.localStorage.getItem(MOTION_KEY) === "animated"
      ? "animated"
      : "static";
  } catch {
    return "static";
  }
}

export function effectiveMotion(stored: Motion, reduced: boolean): Motion {
  return reduced ? "static" : stored;
}

export function applyMotion(motion: Motion): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.dataset.motion = effectiveMotion(motion, reduced);
  try {
    window.localStorage.setItem(MOTION_KEY, motion);
  } catch {
    /* storage blocked */
  }
}
