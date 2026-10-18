/*
 * Sync MITRE ATT&CK (Enterprise + ICS) into compact JSON for the explorer.
 *
 *   npm run sync:attack
 *
 * Downloads the official STIX 2.1 bundles from github.com/mitre-attack/attack-stix-data
 * and writes trimmed datasets to public/attack/<domain>.json (served statically and
 * lazy-loaded by /attack). Re-run whenever MITRE publishes a new ATT&CK release.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master";
const DOMAINS = {
  enterprise: `${SRC}/enterprise-attack/enterprise-attack.json`,
  ics: `${SRC}/ics-attack/ics-attack.json`,
} as const;

// STIX objects are loosely typed JSON from MITRE; we only read known fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Stix = Record<string, any>;

const mitreRef = (o: Stix) => o.external_references?.find((r: Stix) => r.source_name?.startsWith("mitre"));
const extId = (o: Stix) => mitreRef(o)?.external_id as string | undefined;
const extUrl = (o: Stix) => mitreRef(o)?.url as string | undefined;
const live = (o: Stix) => !o.revoked && !o.x_mitre_deprecated;

/* Strip "(Citation: ...)" markers and collapse whitespace: they're unreadable
   without the reference list and make up a big share of the payload. */
function clean(text?: string) {
  if (!text) return "";
  return text.replace(/\(Citation:[^)]*\)/g, "").replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
}
const firstPara = (text?: string) => clean(text).split(/\n\s*\n/)[0];

async function build(domain: keyof typeof DOMAINS) {
  console.log(`Fetching ${domain}...`);
  const res = await fetch(DOMAINS[domain]);
  if (!res.ok) throw new Error(`${domain}: HTTP ${res.status}`);
  const bundle = (await res.json()) as { objects: Stix[] };
  const objs = bundle.objects.filter(live);
  const byRef = new Map(objs.map((o) => [o.id, o]));

  const collection = bundle.objects.find((o) => o.type === "x-mitre-collection");
  const matrix = objs.find((o) => o.type === "x-mitre-matrix");

  const tacticOrder: string[] = matrix?.tactic_refs ?? objs.filter((o) => o.type === "x-mitre-tactic").map((t) => t.id);
  const tactics = tacticOrder
    .map((ref) => byRef.get(ref))
    .filter((t): t is Stix => Boolean(t))
    .map((t) => ({ id: extId(t)!, name: t.name, shortname: t.x_mitre_shortname, description: clean(t.description) }));

  const techniques = new Map<string, Stix>();
  for (const o of objs) {
    if (o.type !== "attack-pattern") continue;
    const id = extId(o);
    if (!id) continue;
    techniques.set(o.id, {
      id,
      name: o.name,
      description: clean(o.description),
      tactics: (o.kill_chain_phases ?? []).map((k: Stix) => k.phase_name),
      platforms: o.x_mitre_platforms ?? [],
      isSub: Boolean(o.x_mitre_is_subtechnique),
      parent: o.x_mitre_is_subtechnique ? id.split(".")[0] : undefined,
      url: extUrl(o),
      mitigations: [] as { id: string; note: string }[],
      groups: [] as string[],
      software: [] as string[],
      detections: [] as Stix[],
      assets: [] as string[],
    });
  }

  const mitigations = new Map<string, Stix>();
  const groups = new Map<string, Stix>();
  const software = new Map<string, Stix>();
  const dataComponents = new Map<string, Stix>();
  const assets = new Map<string, Stix>();
  for (const o of objs) {
    const id = extId(o);
    if (o.type === "course-of-action" && id) mitigations.set(o.id, { id, name: o.name, description: firstPara(o.description) });
    if (o.type === "intrusion-set" && id)
      groups.set(o.id, { id, name: o.name, aliases: (o.aliases ?? []).filter((a: string) => a !== o.name), description: firstPara(o.description) });
    if ((o.type === "malware" || o.type === "tool") && id)
      software.set(o.id, { id, name: o.name, type: o.type, description: firstPara(o.description) });
    if (o.type === "x-mitre-data-component") dataComponents.set(o.id, { name: o.name });
    if (o.type === "x-mitre-asset" && id) assets.set(o.id, { id, name: o.name, description: firstPara(o.description) });
  }

  /* ATT&CK v18+ detection model: detection strategy -> analytics, each with a
     platform, a plain-language rule and the log sources it reads. */
  const detectionStrategy = (o: Stix) => ({
    id: extId(o),
    name: o.name,
    url: extUrl(o),
    analytics: (o.x_mitre_analytic_refs ?? [])
      .map((ref: string) => byRef.get(ref))
      .filter(Boolean)
      .map((a: Stix) => ({
        id: extId(a),
        platforms: a.x_mitre_platforms ?? [],
        description: clean(a.description),
        logSources: (a.x_mitre_log_source_references ?? []).map((l: Stix) => ({
          source: l.name,
          component: dataComponents.get(l.x_mitre_data_component_ref)?.name,
          channel: l.channel,
        })),
      })),
  });

  for (const r of objs) {
    if (r.type !== "relationship") continue;
    // technique -> asset (ICS): here the technique is the *source*.
    if (r.relationship_type === "targets" && techniques.has(r.source_ref) && assets.has(r.target_ref)) {
      techniques.get(r.source_ref)!.assets.push(assets.get(r.target_ref)!.id);
      continue;
    }
    const tech = techniques.get(r.target_ref);
    if (!tech) continue;
    const src = byRef.get(r.source_ref);
    if (!src) continue;
    if (r.relationship_type === "mitigates" && mitigations.has(src.id))
      tech.mitigations.push({ id: mitigations.get(src.id)!.id, note: firstPara(r.description) });
    else if (r.relationship_type === "uses" && groups.has(src.id)) tech.groups.push(groups.get(src.id)!.id);
    else if (r.relationship_type === "uses" && software.has(src.id)) tech.software.push(software.get(src.id)!.id);
    else if (r.relationship_type === "detects" && src.type === "x-mitre-detection-strategy") tech.detections.push(detectionStrategy(src));
  }

  // Only ship groups/software/mitigations that are actually referenced.
  const used = { m: new Set<string>(), g: new Set<string>(), s: new Set<string>() };
  for (const t of techniques.values()) {
    t.mitigations.forEach((m: Stix) => used.m.add(m.id));
    t.groups.forEach((g: string) => used.g.add(g));
    t.software.forEach((s: string) => used.s.add(s));
  }
  const pick = (m: Map<string, Stix>, keep?: Set<string>) =>
    Object.fromEntries(
      [...m.values()].filter((v) => !keep || keep.has(v.id)).sort((a, b) => a.id.localeCompare(b.id)).map((v) => [v.id, v]),
    );

  const out = {
    domain,
    name: collection?.name ?? matrix?.name ?? domain,
    version: collection?.x_mitre_version ?? null,
    syncedAt: new Date().toISOString(),
    tactics,
    techniques: [...techniques.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    mitigations: pick(mitigations, used.m),
    groups: pick(groups, used.g),
    software: pick(software, used.s),
    assets: pick(assets),
  };

  const dir = path.join(process.cwd(), "public", "attack");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${domain}.json`);
  writeFileSync(file, JSON.stringify(out));
  console.log(
    `  ${domain} v${out.version}: ${out.tactics.length} tactics, ${out.techniques.length} techniques, ` +
      `${Object.keys(out.groups).length} groups, ${Object.keys(out.software).length} software -> ${path.relative(process.cwd(), file)}`,
  );
}

async function main() {
  for (const d of Object.keys(DOMAINS) as (keyof typeof DOMAINS)[]) await build(d);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
