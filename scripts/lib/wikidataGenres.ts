import { type Genre } from '../../src/lib/genres';

/**
 * Maps Wikidata genre labels (P136, English) to the app's genre vocabulary.
 * Wikidata genres are fine-grained ("heist film", "romantic comedy"); several can map to one
 * app genre, and a compound label can map to several.
 */
const RULES: [RegExp, Genre[]][] = [
  [/romantic comedy|romcom/i, ['Romance', 'Comedy']],
  [/comedy.?drama|dramedy/i, ['Comedy', 'Drama']],
  [/action.?adventure/i, ['Action', 'Adventure']],
  [/science.?fiction|sci-?fi/i, ['Sci-Fi']],
  [/film noir|\bnoir\b/i, ['Film-Noir', 'Crime']],
  [/\banimat|cartoon|anime/i, ['Animation']],
  [/children|family film|kids/i, ['Children']],
  [/documentary/i, ['Documentary']],
  [/horror|slasher|zombie|monster/i, ['Horror']],
  [/thriller|suspense|spy film|psychological/i, ['Thriller']],
  [/crime|gangster|heist|detective|mafia|police/i, ['Crime']],
  [/mystery|whodunit/i, ['Mystery']],
  [/western|spaghetti/i, ['Western']],
  [/\bwar\b|military|combat/i, ['War']],
  [/musical|music film|opera/i, ['Musical']],
  [/romance|romantic|love/i, ['Romance']],
  [/fantasy|fairy tale|supernatural|superhero/i, ['Fantasy']],
  [/adventure|swashbuckler/i, ['Adventure']],
  [/action|martial arts|disaster|superhero/i, ['Action']],
  [/comedy|slapstick|parody|satire|farce|screwball/i, ['Comedy']],
  [/drama|biographical|historical|melodrama|tragedy|coming-of-age|legal|sports film|road film/i, ['Drama']],
];

export function mapGenreLabel(label: string): Genre[] {
  const out = new Set<Genre>();
  for (const [re, genres] of RULES) {
    if (re.test(label)) for (const g of genres) out.add(g);
  }
  return [...out];
}

export function mapGenreLabels(labels: readonly string[]): Genre[] {
  const out = new Set<Genre>();
  for (const l of labels) for (const g of mapGenreLabel(l)) out.add(g);
  return [...out];
}
