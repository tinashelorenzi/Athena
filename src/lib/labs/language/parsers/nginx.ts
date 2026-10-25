import { ParseError, type Parser } from "./types";

/**
 * nginx — parses `nginx -T` output (every config file, each preceded by
 * "# configuration file <path>:") into a tree with includes resolved, then
 * exposes the parts graders need:
 *
 *   files       paths in the dump
 *   main        top-level block
 *   http        the http block (or null)
 *   servers     http server blocks, each with listen[], server_name[], locations[]
 *
 * Every block has: name, args, file, line, directives (non-block children as
 * {name, args}), values (name → first arg of the last occurrence), headers
 * (add_header name, lowercased → value) and blocks (child blocks).
 * A plain nginx.conf (no "# configuration file" markers) also works.
 */

type Token = { v: string; t: "word" | "{" | "}" | ";"; line: number };

/** nginx unescapes only \" \' \\ \t \r \n; any other backslash is kept (regexes like \.php$). */
const ESCAPES: Record<string, string> = { '"': '"', "'": "'", "\\": "\\", t: "\t", r: "\r", n: "\n" };
const unescape = (next: string) => ESCAPES[next] ?? `\\${next}`;

type Node = { name: string; args: string[]; file: string; line: number; children?: Node[] };

export type NginxBlock = {
  name: string;
  args: string[];
  file: string;
  line: number;
  directives: { name: string; args: string[]; file: string; line: number }[];
  values: Record<string, string>;
  headers: Record<string, string>;
  blocks: NginxBlock[];
};
export type NginxLocation = NginxBlock & { path: string; modifier: string; locations: NginxLocation[] };
export type NginxServer = NginxBlock & { listen: string[]; server_name: string[]; locations: NginxLocation[] };

function tokenize(text: string, file: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < n && text[i] !== "\n") i++; continue; }
    if (c === "{" || c === "}" || c === ";") { out.push({ v: c, t: c, line }); i++; continue; }
    if (c === '"' || c === "'") {
      const start = line;
      let v = "";
      i++;
      while (i < n && text[i] !== c) {
        if (text[i] === "\\" && i + 1 < n) { v += unescape(text[i + 1]); i += 2; continue; }
        if (text[i] === "\n") line++;
        v += text[i++];
      }
      if (i >= n) throw new ParseError(`${file}:${start}: unterminated quoted string`);
      i++;
      out.push({ v, t: "word", line: start });
      continue;
    }
    let v = "";
    while (i < n && !/[\s;{}]/.test(text[i])) {
      if (text[i] === "$" && text[i + 1] === "{") {
        const end = text.indexOf("}", i);
        if (end === -1) break;
        v += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      if (text[i] === "\\" && i + 1 < n) { v += unescape(text[i + 1]); i += 2; continue; }
      v += text[i++];
    }
    out.push({ v, t: "word", line });
  }
  return out;
}

function parseTokens(tokens: Token[], file: string): Node[] {
  let pos = 0;
  const block = (depth: number): Node[] => {
    const nodes: Node[] = [];
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok.t === "}") {
        if (depth === 0) throw new ParseError(`${file}:${tok.line}: unexpected "}"`);
        pos++;
        return nodes;
      }
      if (tok.t !== "word") throw new ParseError(`${file}:${tok.line}: unexpected "${tok.v}"`);
      const node: Node = { name: tok.v, args: [], file, line: tok.line };
      pos++;
      while (pos < tokens.length && tokens[pos].t === "word") node.args.push(tokens[pos++].v);
      const end = tokens[pos];
      if (!end) throw new ParseError(`${file}:${tok.line}: "${node.name}" is missing ";"`);
      pos++;
      if (end.t === "{") node.children = block(depth + 1);
      else if (end.t !== ";") throw new ParseError(`${file}:${end.line}: unexpected "${end.v}"`);
      nodes.push(node);
    }
    if (depth > 0) throw new ParseError(`${file}: unbalanced braces (missing "}")`);
    return nodes;
  };
  return block(0);
}

/** Split `nginx -T` output into files. Text without markers is one file. */
function splitDump(text: string): { path: string; body: string }[] {
  const re = /^# configuration file (.+?):\s*$/gm;
  const marks = [...text.matchAll(re)];
  if (!marks.length) return [{ path: "nginx.conf", body: text }];
  return marks.map((m, i) => ({
    path: m[1],
    body: text.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length),
  }));
}

const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");

function globToRegex(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp(`^${esc}$`);
}

function resolveIncludes(nodes: Node[], files: Map<string, Node[]>, prefix: string, depth: number): Node[] {
  if (depth > 10) throw new ParseError("include nesting is deeper than 10 levels");
  const out: Node[] = [];
  for (const node of nodes) {
    if (node.name === "include" && !node.children && node.args.length === 1) {
      const target = node.args[0].startsWith("/") ? node.args[0] : `${prefix}/${node.args[0]}`;
      const re = globToRegex(target);
      const matches = [...files.keys()].filter((p) => re.test(p)).sort();
      for (const p of matches) out.push(...resolveIncludes(files.get(p)!, files, prefix, depth + 1));
      continue;
    }
    out.push(node.children ? { ...node, children: resolveIncludes(node.children, files, prefix, depth) } : node);
  }
  return out;
}

function toBlock(node: Node): NginxBlock {
  const children = node.children ?? [];
  const directives = children.filter((c) => !c.children).map(({ name, args, file, line }) => ({ name, args, file, line }));
  const values: Record<string, string> = {};
  const headers: Record<string, string> = {};
  for (const d of directives) {
    values[d.name] = d.args[0] ?? "";
    if (d.name === "add_header" && d.args.length >= 2) headers[d.args[0].toLowerCase()] = d.args[1];
  }
  return { name: node.name, args: node.args, file: node.file, line: node.line, directives, values, headers, blocks: children.filter((c) => c.children).map(toBlock) };
}

const MODIFIERS = new Set(["=", "~", "~*", "^~"]);

function toLocation(b: NginxBlock): NginxLocation {
  const modifier = b.args.length > 1 && MODIFIERS.has(b.args[0]) ? b.args[0] : "";
  const path = modifier ? b.args.slice(1).join(" ") : b.args.join(" ");
  return { ...b, path, modifier, locations: b.blocks.filter((c) => c.name === "location").map(toLocation) };
}

function toServer(b: NginxBlock): NginxServer {
  return {
    ...b,
    listen: b.directives.filter((d) => d.name === "listen").map((d) => d.args.join(" ")),
    server_name: b.directives.filter((d) => d.name === "server_name").flatMap((d) => d.args),
    locations: b.blocks.filter((c) => c.name === "location").map(toLocation),
  };
}

export const nginx: Parser = {
  name: "nginx",
  version: 1,
  description: "`nginx -T` output (or one nginx.conf) into http/servers/locations with includes resolved.",
  options: [],
  parse(text) {
    const dump = splitDump(text);
    const files = new Map(dump.map((f) => [f.path, parseTokens(tokenize(f.body, f.path), f.path)]));
    const mainPath = dump[0].path;
    const tree = resolveIncludes(files.get(mainPath)!, files, dirname(mainPath), 0);
    const main = toBlock({ name: "main", args: [], file: mainPath, line: 0, children: tree });
    const http = main.blocks.find((b) => b.name === "http") ?? null;
    return {
      files: dump.map((f) => f.path),
      main,
      http,
      events: main.blocks.find((b) => b.name === "events") ?? null,
      servers: http ? http.blocks.filter((b) => b.name === "server").map(toServer) : [],
    };
  },
};
