'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

/* Data + local state for the ATT&CK explorer. Datasets are produced by
   `npm run sync:attack` (scripts/sync-attack.ts) into public/attack/. */

export const DOMAINS = {
  enterprise: { label: 'Enterprise', file: '/attack/enterprise.json' },
  ics: { label: 'ICS', file: '/attack/ics.json' },
};

const cache = new Map();

export function useAttackDataset(domain) {
  const [state, setState] = useState({ domain: null, data: null, error: null });

  useEffect(() => {
    let alive = true;
    if (!cache.has(domain)) {
      cache.set(domain, fetch(DOMAINS[domain].file).then((r) => {
        if (!r.ok) throw new Error(`Could not load ATT&CK ${domain} data (HTTP ${r.status})`);
        return r.json();
      }).then(index));
    }
    cache.get(domain).then(
      (data) => alive && setState({ domain, data, error: null }),
      (error) => { cache.delete(domain); if (alive) setState({ domain, data: null, error }); },
    );
    return () => { alive = false; };
  }, [domain]);

  // Hide stale data while switching domains.
  return state.domain === domain ? state : { domain, data: null, error: null };
}

/* Adds lookup indexes the UI needs on top of the raw dataset. */
function index(raw) {
  const byId = new Map(raw.techniques.map((t) => [t.id, t]));
  const subs = new Map();
  for (const t of raw.techniques) {
    if (!t.isSub) continue;
    if (!subs.has(t.parent)) subs.set(t.parent, []);
    subs.get(t.parent).push(t);
  }
  for (const list of subs.values()) list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const platforms = [...new Set(raw.techniques.flatMap((t) => t.platforms))].filter((p) => p !== 'None').sort();
  return { ...raw, byId, subs, platforms };
}

/* ---- "Studied" progress, kept per browser (localStorage) ---- */
const KEY = 'athena.attack.studied.v1';
const listeners = new Set();
let studiedCache = null;

function readStudied() {
  if (studiedCache) return studiedCache;
  try { studiedCache = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { studiedCache = new Set(); }
  return studiedCache;
}
const EMPTY = new Set();

export function useStudied() {
  const studied = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    readStudied,
    () => EMPTY,
  );
  const toggle = (id) => {
    const next = new Set(readStudied());
    if (next.has(id)) next.delete(id); else next.add(id);
    studiedCache = next;
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l());
  };
  return [studied, toggle];
}

/* Filter predicate + matrix layout derived from the current filters. */
export function useMatrix(data, { query, platforms, assets, studiedOnly, studied }) {
  return useMemo(() => {
    if (!data) return { columns: [], matches: new Set(), total: 0 };
    const q = query.trim().toLowerCase();
    const test = (t) =>
      (!q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) &&
      (!platforms.length || t.platforms.some((p) => platforms.includes(p))) &&
      (!assets.length || t.assets.some((a) => assets.includes(a))) &&
      (!studiedOnly || studied.has(t.id));

    const matches = new Set(data.techniques.filter(test).map((t) => t.id));
    const columns = data.tactics.map((tactic) => {
      const all = data.techniques
        .filter((t) => !t.isSub && t.tactics.includes(tactic.shortname))
        .sort((a, b) => a.name.localeCompare(b.name));
      const visible = all
        .map((t) => {
          const subs = data.subs.get(t.id) || [];
          const subMatches = subs.filter((s) => matches.has(s.id));
          return { technique: t, subs, subMatches, self: matches.has(t.id) };
        })
        .filter((row) => row.self || row.subMatches.length);
      return { tactic, all, visible };
    });
    return { columns, matches, total: data.techniques.length };
  }, [data, query, platforms, assets, studiedOnly, studied]);
}

/* ATT&CK prose uses a little inline HTML (<code>) — normalise to markdown. */
export function prose(text = '') {
  return text.replace(/<code>(.*?)<\/code>/g, '`$1`').replace(/<\/?[a-z][^>]*>/gi, '');
}

/* Matches attack.mitre.org/techniques/T1566/001 → "T1566.001". */
export function techniqueFromHref(href = '') {
  const m = href.match(/attack\.mitre\.org\/techniques\/(T\d{4})(?:\/(\d{3}))?/);
  return m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : null;
}
