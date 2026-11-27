/** English labels for ISO 639-1 codes that appear in film data. Unknown codes fall back to the code. */
const LABELS: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bo: 'Tibetan',
  bs: 'Bosnian',
  ca: 'Catalan',
  co: 'Corsican',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  gd: 'Scottish Gaelic',
  gl: 'Galician',
  gu: 'Gujarati',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  iu: 'Inuktitut',
  ja: 'Japanese',
  ka: 'Georgian',
  km: 'Khmer',
  kn: 'Kannada',
  ko: 'Korean',
  ks: 'Kashmiri',
  ku: 'Kurdish',
  la: 'Latin',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mi: 'Maori',
  ml: 'Malayalam',
  mn: 'Mongolian',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pa: 'Punjabi',
  pl: 'Polish',
  ps: 'Pashto',
  pt: 'Portuguese',
  qu: 'Quechua',
  ro: 'Romanian',
  ru: 'Russian',
  rw: 'Kinyarwanda',
  sh: 'Serbo-Croatian',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  sq: 'Albanian',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  tt: 'Tatar',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  wo: 'Wolof',
  yi: 'Yiddish',
  zh: 'Chinese',
  zu: 'Zulu',
};

export function languageLabel(code: string): string {
  return LABELS[code] ?? code;
}

export interface LanguageOption {
  code: string;
  label: string;
  count: number;
}

/** Distinct original languages in the catalogue, most common first, then by label. */
export function languageOptions(movies: readonly { languages: readonly string[] }[]): LanguageOption[] {
  const counts = new Map<string, number>();
  for (const m of movies) {
    for (const code of new Set(m.languages)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: languageLabel(code), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
