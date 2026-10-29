import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../lib/contrast';

const css = readFileSync(join(process.cwd(), 'src/styles/themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function parseThemes(): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  for (const block of css.split('}')) {
    const name = /data-theme='(\w+)'/.exec(block)?.[1];
    if (!name) continue;
    const vars: Record<string, string> = {};
    for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1] as string] = m[2] as string;
    themes[name] = vars;
  }
  return themes;
}

const themes = parseThemes();

/** [foreground token, background token] pairs that carry text. */
const TEXT_PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['link', 'bg'],
  ['link', 'surface'],
  ['on-accent', 'accent'],
  ['on-chip-on', 'chip-on'],
  ['on-badge', 'badge-bg'],
  ['on-badge-cf', 'badge-cf-bg'],
  ['danger', 'bg'],
];

/** Non-text UI: control borders, focus rings, selected states (WCAG 1.4.11). */
const UI_PAIRS: [string, string][] = [
  ['border', 'bg'],
  ['border', 'surface'],
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['chip-on', 'bg'],
  ['chip-on', 'surface'],
];

describe('themes.css', () => {
  it('defines exactly the three themes with the same tokens', () => {
    expect(Object.keys(themes).sort()).toEqual(['contrast', 'dark', 'light']);
    const tokens = Object.keys(themes.light ?? {}).sort();
    expect(tokens.length).toBeGreaterThan(10);
    for (const t of Object.values(themes)) expect(Object.keys(t).sort()).toEqual(tokens);
  });

  for (const [name, vars] of Object.entries(themes)) {
    const textMin = name === 'contrast' ? 7 : 4.5;
    describe(`${name} theme`, () => {
      it.each(TEXT_PAIRS)(`text %s on %s meets ${textMin}:1`, (fg, bg) => {
        expect(contrastRatio(vars[fg] as string, vars[bg] as string)).toBeGreaterThanOrEqual(textMin);
      });
      it.each(UI_PAIRS)('UI %s against %s meets 3:1', (fg, bg) => {
        expect(contrastRatio(vars[fg] as string, vars[bg] as string)).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });
});
