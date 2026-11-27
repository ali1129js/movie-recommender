import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { languageLabel, languageOptions } from './languages';

describe('language helpers', () => {
  it('labels known ISO codes and falls back to the code', () => {
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('de')).toBe('German');
    expect(languageLabel('zz')).toBe('zz');
  });

  it('lists distinct catalogue languages, most common first, and skips empties', () => {
    const opts = languageOptions(fixture().movies);
    expect(opts.map((o) => o.code)).toEqual(['en', 'de']);
    expect(opts[0]?.count).toBe(8);
    expect(opts[1]?.count).toBe(1);
    expect(languageOptions([{ languages: [] }, { languages: [] }])).toEqual([]);
  });
});
