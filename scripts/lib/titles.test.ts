import { describe, expect, it } from 'vitest';
import { fixArticle, parseMovieLensTitle } from './titles';

describe('fixArticle', () => {
  it.each([
    ['Usual Suspects, The', 'The Usual Suspects'],
    ['Postino, Il', 'Il Postino'],
    ["Atalante, L'", "L'Atalante"],
    ['Good, the Bad and the Ugly, The', 'The Good, the Bad and the Ugly'],
    ['Cité des enfants perdus, La', 'La Cité des enfants perdus'],
    ['Heat', 'Heat'],
    ['Me, Myself & I', 'Me, Myself & I'],
  ])('%s -> %s', (input, expected) => {
    expect(fixArticle(input)).toBe(expected);
  });
});

describe('parseMovieLensTitle', () => {
  it('parses a plain title and year', () => {
    expect(parseMovieLensTitle('Toy Story (1995)')).toEqual({ title: 'Toy Story', year: 1995, alt: [] });
  });

  it('moves the article and keeps the year', () => {
    expect(parseMovieLensTitle('Usual Suspects, The (1995)')).toMatchObject({
      title: 'The Usual Suspects',
      year: 1995,
    });
  });

  it('extracts a.k.a. names as alternatives', () => {
    expect(parseMovieLensTitle('Seven (a.k.a. Se7en) (1995)')).toEqual({
      title: 'Seven',
      year: 1995,
      alt: ['Se7en'],
    });
  });

  it('extracts original-language alternatives and fixes their articles', () => {
    const p = parseMovieLensTitle('City of Lost Children, The (Cité des enfants perdus, La) (1995)');
    expect(p.title).toBe('The City of Lost Children');
    expect(p.alt).toEqual(['La Cité des enfants perdus']);
    expect(p.year).toBe(1995);
  });

  it('handles several alternative groups', () => {
    const p = parseMovieLensTitle('Spirited Away (Sen to Chihiro no kamikakushi) (2001)');
    expect(p).toEqual({ title: 'Spirited Away', year: 2001, alt: ['Sen to Chihiro no kamikakushi'] });
    const q = parseMovieLensTitle('Life Is Beautiful (La Vita è bella) (a.k.a. Life Is Beautiful) (1997)');
    expect(q.alt).toEqual(['La Vita è bella', 'Life Is Beautiful']);
  });

  it('does not swallow a leading parenthetical', () => {
    expect(parseMovieLensTitle('(500) Days of Summer (2009)')).toEqual({
      title: '(500) Days of Summer',
      year: 2009,
      alt: [],
    });
  });

  it('tolerates stray whitespace around the year', () => {
    expect(parseMovieLensTitle('Moonlight (2016) ').year).toBe(2016);
    expect(parseMovieLensTitle('  Moonlight   ( 2016 )').year).toBe(2016);
  });

  it('accepts year ranges by taking the first year', () => {
    expect(parseMovieLensTitle('Some Series (2005-2008)').year).toBe(2005);
  });

  it('returns a null year (never 0) when there is none', () => {
    expect(parseMovieLensTitle('Babylon 5').year).toBeNull();
  });

  it('keeps titles that merely contain digits or colons', () => {
    expect(parseMovieLensTitle('2001: A Space Odyssey (1968)')).toMatchObject({
      title: '2001: A Space Odyssey',
      year: 1968,
    });
  });
});
