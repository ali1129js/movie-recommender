import { useEffect, useRef, useState } from 'react';
import { buildCatalog, fetchJson } from './catalog';
import type { Catalog } from './types';

export type CatalogStatus =
  | { phase: 'loading-core' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; content: 'loading' | 'ready' | 'failed' };

export interface Loaders {
  core: () => Promise<unknown>;
  content: () => Promise<unknown>;
}

const base = import.meta.env.BASE_URL;
export const defaultLoaders: Loaders = {
  core: () => fetchJson(`${base}data/core.json`),
  content: () => fetchJson(`${base}data/content.json`),
};

/**
 * Loads the MovieLens layer first so search works immediately, then lazy-loads the larger
 * Wikidata content layer. Both are validated with Zod before use.
 */
export function useCatalog(loaders: Loaders, attempt: number): { catalog: Catalog | null; status: CatalogStatus } {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [status, setStatus] = useState<CatalogStatus>({ phase: 'loading-core' });
  const loadersRef = useRef(loaders);
  loadersRef.current = loaders;

  useEffect(() => {
    let cancelled = false;
    setStatus({ phase: 'loading-core' });
    (async () => {
      let coreRaw: unknown;
      try {
        coreRaw = await loadersRef.current.core();
        const core = buildCatalog(coreRaw, null);
        if (cancelled) return;
        setCatalog(core);
        setStatus({ phase: 'ready', content: 'loading' });
      } catch (err) {
        if (!cancelled) setStatus({ phase: 'error', message: err instanceof Error ? err.message : 'Could not load data' });
        return;
      }
      try {
        const contentRaw = await loadersRef.current.content();
        const full = buildCatalog(coreRaw, contentRaw);
        if (cancelled) return;
        setCatalog(full);
        setStatus({ phase: 'ready', content: 'ready' });
      } catch {
        if (!cancelled) setStatus({ phase: 'ready', content: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { catalog, status };
}
