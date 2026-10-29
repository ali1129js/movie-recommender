import { THEMES, THEME_LABELS, type Theme } from '../lib/theme';

export function ThemeSwitcher({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <fieldset className="themes">
      <legend>Theme</legend>
      <div className="segmented">
        {THEMES.map((t) => (
          <label key={t} className={theme === t ? 'seg on' : 'seg'}>
            <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => onChange(t)} />
            <span>{THEME_LABELS[t]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
