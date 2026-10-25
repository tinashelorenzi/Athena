import { csv, ini, json, jsonl, kv, lines, regex, table, yaml } from "./generic";
import { nginx } from "./nginx";
import { snortRules, sshd } from "./snort";
import { ParseError, type Parser } from "./types";

export { ParseError, type Parser };

/** The parser registry (docs/labs/spec.md 9.6). Add a parser here to make it usable in lab.yaml. */
export const PARSERS: Record<string, Parser> = Object.fromEntries(
  [lines, kv, ini, json, jsonl, yaml, csv, table, regex, nginx, snortRules, sshd].map((p) => [p.name, p]),
);

/** e.g. "kv@1,nginx@1,…" — recorded with every grading run so re-grades are traceable. */
export function parserRevision(names?: string[]): string {
  const list = (names ?? Object.keys(PARSERS)).filter((n) => PARSERS[n]).sort();
  return list.map((n) => `${n}@${PARSERS[n].version}`).join(",");
}
