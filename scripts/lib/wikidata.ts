import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WD_CACHE } from './paths';

/**
 * Wikidata Query Service client for the build script. Wikidata structured data is CC0.
 * Polite by design: descriptive User-Agent, serial requests with a minimum gap, backoff on
 * 429/5xx, and an on-disk cache keyed by the query text so reruns cost nothing.
 * The endpoint is configurable because the service is migrating to a new backend in 2026-27.
 */
const ENDPOINT = process.env.WDQS_ENDPOINT ?? 'https://query.wikidata.org/sparql';
const USER_AGENT =
  'movie-recommender-build/2.0 (https://github.com/ali1129js/movie-recommender; personal portfolio project; build-time only)';
const MIN_GAP_MS = 1500;

export type Binding = Record<string, string>;

let lastRequest = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sparql(query: string): Promise<Binding[]> {
  await mkdir(WD_CACHE, { recursive: true });
  const key = createHash('sha1').update(ENDPOINT + query).digest('hex');
  const file = join(WD_CACHE, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Binding[];
  } catch {
    /* cache miss */
  }

  for (let attempt = 1; attempt <= 8; attempt++) {
    const wait = MIN_GAP_MS - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query }).toString(),
        signal: AbortSignal.timeout(75_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const retry = Number(res.headers.get('retry-after')) || 5 * attempt;
        console.warn(`  wikidata ${res.status}, retrying in ${retry}s (attempt ${attempt})`);
        await sleep(retry * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as {
        results: { bindings: Record<string, { value: string }>[] };
      };
      const rows = json.results.bindings.map((b) =>
        Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])),
      );
      await writeFile(file, JSON.stringify(rows));
      return rows;
    } catch (err) {
      console.warn(`  wikidata request failed (${(err as Error).message}); attempt ${attempt}`);
      await sleep(4000 * attempt);
    }
  }
  throw new Error('Wikidata request failed after 8 attempts');
}

export const tt = (id: number): string => `tt${String(id).padStart(7, '0')}`;
export const parseTt = (s: string): number => Number(s.slice(2));
const values = (ids: readonly number[]): string => ids.map((i) => `"${tt(i)}"`).join(' ');

export interface WdMeta {
  title: string;
  year: number | null;
}

export async function fetchMeta(ids: readonly number[]): Promise<Map<number, WdMeta>> {
  const rows = await sparql(`
SELECT ?imdb (SAMPLE(?t) AS ?title) (MIN(?y) AS ?year) WHERE {
  VALUES ?imdb { ${values(ids)} }
  ?f wdt:P345 ?imdb .
  ?f rdfs:label ?t . FILTER(LANG(?t) = "en")
  OPTIONAL { ?f wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
} GROUP BY ?imdb`);
  const out = new Map<number, WdMeta>();
  for (const r of rows) {
    if (!r.imdb || !r.title) continue;
    out.set(parseTt(r.imdb), { title: r.title, year: r.year ? Number(r.year) : null });
  }
  return out;
}

export async function fetchGenres(ids: readonly number[]): Promise<Map<number, string[]>> {
  const rows = await sparql(`
SELECT DISTINCT ?imdb ?gl WHERE {
  VALUES ?imdb { ${values(ids)} }
  ?f wdt:P345 ?imdb ; wdt:P136 ?g .
  ?g rdfs:label ?gl . FILTER(LANG(?gl) = "en")
}`);
  const out = new Map<number, string[]>();
  for (const r of rows) {
    if (!r.imdb || !r.gl) continue;
    const id = parseTt(r.imdb);
    const list = out.get(id) ?? [];
    list.push(r.gl);
    out.set(id, list);
  }
  return out;
}

export interface PersonLinks {
  /** Wikidata item numbers (Q-ids without the "Q") of the film's directors and cast. */
  directors: number[];
  cast: number[];
}

const qNum = (uri: string): number => Number(uri.slice(uri.lastIndexOf('/') + 2));

/**
 * Directors (P57) and cast members (P161) as bare Wikidata ids. Labels and fame are deliberately
 * *not* joined here: those joins time out on the public query service. Labels are fetched
 * afterwards, only for the few people that survive pruning (see `fetchLabels`).
 */
export async function fetchPersonLinks(ids: readonly number[]): Promise<Map<number, PersonLinks>> {
  const rows = await sparql(`
SELECT DISTINCT ?imdb ?role ?p WHERE {
  VALUES ?imdb { ${values(ids)} }
  ?f wdt:P345 ?imdb .
  { ?f wdt:P57 ?p . BIND("d" AS ?role) } UNION { ?f wdt:P161 ?p . BIND("c" AS ?role) }
}`);
  const out = new Map<number, PersonLinks>();
  for (const r of rows) {
    if (!r.imdb || !r.p) continue;
    const id = parseTt(r.imdb);
    const entry = out.get(id) ?? { directors: [], cast: [] };
    (r.role === 'd' ? entry.directors : entry.cast).push(qNum(r.p));
    out.set(id, entry);
  }
  return out;
}

/** English labels for people, by Wikidata item number. */
export async function fetchLabels(qids: readonly number[]): Promise<Map<number, string>> {
  const rows = await sparql(`
SELECT ?p ?name WHERE {
  VALUES ?p { ${qids.map((q) => `wd:Q${q}`).join(' ')} }
  ?p rdfs:label ?name . FILTER(LANG(?name) = "en")
}`);
  const out = new Map<number, string>();
  for (const r of rows) if (r.p && r.name) out.set(qNum(r.p), r.name);
  return out;
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
