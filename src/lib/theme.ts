export const THEMES = ['light', 'dark', 'contrast'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
};

const KEY = 'movie-recommender-theme';

export const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* storage blocked */
  }
  if (window.matchMedia('(prefers-contrast: more)').matches) return 'contrast';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked */
  }
}
