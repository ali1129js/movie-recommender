import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOriginalTitleLanguages } from './lib/imdb';
import { IMDB_AKAS, OUT_DIR } from './lib/paths';
import { chunk, fetchOriginalLanguages } from './lib/wikidata';
import { validateContent, validateCore } from '../src/lib/schema';
import { readFile } from 'node:fs/promises';

const joinCodes = (codes: string[]): string => [...new Set(codes)].join(',');

/**
 * Builds public/data/languages.json from the already-shipped core and content files.
 * Primary source: Wikidata P364 (ISO 639-1 via P218). Gaps are filled from the
 * language of the IMDb original-title aka, when title.akas.tsv.gz is present.
 */
export async function buildLanguages(): Promise<void> {
  const core = validateCore(JSON.parse(await readFile(join(OUT_DIR, 'core.json'), 'utf8')));
  const content = validateContent(
    JSON.parse(await readFile(join(OUT_DIR, 'content.json'), 'utf8')),
    core.items.length,
  );

  const coreIds = core.items.map((it) => it[3]);
  const contentIds = content.items.map((it) => it[3]);
  const allIds = [...new Set([...coreIds, ...contentIds])];
  console.log(`languages: looking up ${allIds.length} titles in ${chunk(allIds, 150).length} Wikidata batches`);

  const wd = new Map<number, string[]>();
  for (const [i, part] of chunk(allIds, 150).entries()) {
    console.log(`  wikidata P364 batch ${i + 1}/${Math.ceil(allIds.length / 150)}`);
    for (const [id, codes] of await fetchOriginalLanguages(part)) wd.set(id, codes);
  }

  let akas = new Map<number, string[]>();
  const missing = allIds.filter((id) => !wd.has(id));
  if (missing.length > 0 && existsSync(IMDB_AKAS)) {
    console.log(`languages: filling ${missing.length} gaps from IMDb title.akas`);
    akas = await readOriginalTitleLanguages(IMDB_AKAS, new Set(missing));
  } else if (missing.length > 0) {
    console.warn(`languages: ${missing.length} titles have no Wikidata P364 and ${IMDB_AKAS} is missing`);
  }

  const pick = (id: number): string => joinCodes(wd.get(id) ?? akas.get(id) ?? []);
  const coreLangs = coreIds.map(pick);
  const contentLangs = contentIds.map(pick);
  const known = [...coreLangs, ...contentLangs].filter((s) => s !== '').length;
  const fromAkas = allIds.filter((id) => !wd.has(id) && (akas.get(id)?.length ?? 0) > 0).length;

  const out = {
    v: 1 as const,
    built: new Date().toISOString().slice(0, 10),
    source:
      'Wikidata P364 (ISO 639-1 via P218, CC0); gaps filled from the language of the IMDb original-title aka (title.akas, non-commercial datasets)',
    core: coreLangs,
    content: contentLangs,
  };
  await writeFile(join(OUT_DIR, 'languages.json'), JSON.stringify(out));
  console.log(
    `languages: wrote ${join(OUT_DIR, 'languages.json')} (${known}/${allIds.length} titled, ${fromAkas} from IMDb akas)`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildLanguages().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
