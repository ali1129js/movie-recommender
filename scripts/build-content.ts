import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decadeLabel, decadeOf, genresToMask } from '../src/lib/genres';
import { validateContent, type ContentFile } from '../src/lib/schema';
import { readImdbCandidates, readImdbRatings } from './lib/imdb';
import { IMDB_BASICS, IMDB_RATINGS, OUT_DIR, WORK_DIR } from './lib/paths';
import { DECADE_QUOTAS, selectByDecade, type Candidate } from './lib/select';
import { chunk, fetchGenres, fetchLabels, fetchMeta, fetchPersonLinks, type PersonLinks } from './lib/wikidata';
import { mapGenreLabels } from './lib/wikidataGenres';
import type { CoreItemMeta } from './build-core';

const OVERSHOOT = 1.7;
const MIN_VOTES = 200;
const CAST_PER_FILM = 6;
const DIRECTORS_PER_FILM = 3;

export async function buildContent(): Promise<void> {
  const t0 = Date.now();
  const log = (m: string) => console.log(`[content ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

  const coreMeta = JSON.parse(await readFile(join(WORK_DIR, 'core-items.json'), 'utf8')) as CoreItemMeta[];
  const coreIds = new Set(coreMeta.map((m) => m.imdb));
  const [basics, ratings] = await Promise.all([readImdbCandidates(IMDB_BASICS), readImdbRatings(IMDB_RATINGS)]);
  log(`imdb candidates=${basics.size} ratings=${ratings.size}`);

  const candidates: Candidate[] = [];
  for (const b of basics.values()) {
    if (b.type === 'movie' && b.runtime > 0 && b.runtime < 40) continue;
    const r = ratings.get(b.id);
    if (!r) continue;
    candidates.push({ id: b.id, year: b.year, votes: r.votes });
  }
  const picked = selectByDecade(candidates, DECADE_QUOTAS, { exclude: coreIds, overshoot: OVERSHOOT, minVotes: MIN_VOTES });
  log(`candidates after quota overshoot: ${picked.length}`);
  const ids = picked.map((c) => c.id);

  const meta = new Map<number, { title: string }>();
  for (const [i, part] of chunk(ids, 250).entries()) {
    for (const [id, m] of await fetchMeta(part)) meta.set(id, m);
    if (i % 5 === 0) log(`meta ${i + 1}/${Math.ceil(ids.length / 250)} -> ${meta.size}`);
  }
  const genreLabels = new Map<number, string[]>();
  for (const [i, part] of chunk(ids, 250).entries()) {
    for (const [id, g] of await fetchGenres(part)) genreLabels.set(id, g);
    if (i % 5 === 0) log(`genres ${i + 1}/${Math.ceil(ids.length / 250)} -> ${genreLabels.size}`);
  }

  const maskOf = new Map<number, number>();
  for (const id of ids) {
    const mask = genresToMask(mapGenreLabels(genreLabels.get(id) ?? []));
    if (mask !== 0 && meta.has(id)) maskOf.set(id, mask);
  }
  const usable = picked.filter((c) => maskOf.has(c.id));
  const final = selectByDecade(usable, DECADE_QUOTAS, {});
  log(`usable=${usable.length} final=${final.length}`);

  const finalIds = final.map((c) => c.id);
  const coreImdb = coreMeta.map((m) => m.imdb);
  const links = new Map<number, PersonLinks>();
  const allFilms = [...finalIds, ...coreImdb];
  for (const [i, part] of chunk(allFilms, 100).entries()) {
    for (const [id, p] of await fetchPersonLinks(part)) links.set(id, p);
    if (i % 10 === 0) log(`people links ${i + 1}/${Math.ceil(allFilms.length / 100)}`);
  }

  // Person feature vocabulary. Only people who appear in at least two catalogue films carry matching
  // signal; among those, a film keeps its best-connected people (most films in the catalogue, then the
  // lower, older Wikidata id as a tie-break for fame).
  const df = new Map<number, number>();
  for (const l of links.values()) {
    for (const q of new Set([...l.directors, ...l.cast])) df.set(q, (df.get(q) ?? 0) + 1);
  }
  const best = (qs: number[], n: number): number[] =>
    [...new Set(qs)]
      .filter((q) => (df.get(q) ?? 0) >= 2)
      .sort((a, b) => (df.get(b) as number) - (df.get(a) as number) || a - b)
      .slice(0, n);
  const pick = (id: number): [number[], number[]] => {
    const l = links.get(id);
    return l ? [best(l.directors, DIRECTORS_PER_FILM), best(l.cast, CAST_PER_FILM)] : [[], []];
  };
  const extraFeats = finalIds.map(pick);
  const coreFeats = coreImdb.map(pick);
  const survivors = [...new Set([...extraFeats, ...coreFeats].flatMap(([d, c]) => [...d, ...c]))].sort((a, b) => a - b);
  log(`people surviving pruning: ${survivors.length}`);

  const labels = new Map<number, string>();
  for (const [i, part] of chunk(survivors, 300).entries()) {
    for (const [q, name] of await fetchLabels(part)) labels.set(q, name);
    if (i % 10 === 0) log(`labels ${i + 1}/${Math.ceil(survivors.length / 300)}`);
  }
  const vocabQ = survivors.filter((q) => labels.has(q)).sort((a, b) => (labels.get(a) as string).localeCompare(labels.get(b) as string) || a - b);
  const vocab = vocabQ.map((q) => labels.get(q) as string);
  const index = new Map(vocabQ.map((q, i) => [q, i]));
  const toIdx = (qs: number[]) => qs.flatMap((q) => (index.has(q) ? [index.get(q) as number] : []));

  const content: ContentFile = {
    v: 1,
    built: new Date().toISOString().slice(0, 10),
    coreCount: coreMeta.length,
    people: vocab,
    items: final.map((c, k) => {
      const r = ratings.get(c.id);
      const [d, ca] = extraFeats[k] as [number[], number[]];
      return [
        (meta.get(c.id) as { title: string }).title,
        c.year,
        maskOf.get(c.id) as number,
        c.id,
        r?.rating10 ?? 0,
        r?.votes ?? 0,
        toIdx(d),
        toIdx(ca),
      ];
    }),
    coreFeatures: coreFeats.map(([d, ca]) => [toIdx(d), toIdx(ca)]),
  };
  validateContent(content, coreMeta.length);
  await writeFile(join(OUT_DIR, 'content.json'), JSON.stringify(content));

  const perDecade = new Map<number, number>();
  for (const it of content.items) perDecade.set(decadeOf(it[1]), (perDecade.get(decadeOf(it[1])) ?? 0) + 1);
  for (const [d, n] of [...perDecade].sort((a, b) => a[0] - b[0])) {
    log(`${decadeLabel(d)}: ${n} (quota ${DECADE_QUOTAS[d] ?? '-'})`);
  }
  log(`wrote content.json: ${content.items.length} extra titles, ${vocab.length} people`);
}
