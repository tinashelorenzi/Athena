/* A pragmatic KQL (Kibana Query Language) subset for filtering log documents —
   so students search the log stream the way they would in Kibana Discover,
   rather than reading a plain table.

   Supported:
     field:value            term match (case-insensitive contains)
     field:"a phrase"       quoted value
     field:val*             wildcards
     field:*                field exists
     field >= 6000          numeric comparison (>, <, >=, <=)
     and / or / not         boolean (case-insensitive), plus implicit AND
     ( ... )                grouping
     bareword               free-text across all fields

   Field names accept ECS style (host.name, event.action, user.name, @timestamp)
   or the raw log fields (host, action, user, ts, message, and fields.<name>). */

const ALIASES = {
  'host.name': 'host', host: 'host',
  'event.action': 'action', action: 'action',
  'event.dataset': 'source', 'log.source': 'source', source: 'source',
  'event.provider': 'source',
  'user.name': 'user', user: 'user',
  message: 'message', msg: 'message',
  '@timestamp': 'ts', timestamp: 'ts', ts: 'ts',
};

function resolveField(doc, name) {
  const lower = String(name).toLowerCase();
  const key = ALIASES[lower];
  if (key) return doc[key];
  if (lower.startsWith('fields.')) return doc.fields?.[name.slice(7)];
  if (doc.fields && Object.prototype.hasOwnProperty.call(doc.fields, name)) return doc.fields[name];
  return String(name).split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);
}

function tokenize(q) {
  const out = [];
  const re = /"(?:[^"\\]|\\.)*"|>=|<=|[():<>]|[^\s():<>"]+/g;
  let m;
  while ((m = re.exec(q)) !== null) out.push(m[0]);
  return out;
}

function unquote(t) {
  if (t && t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    return t.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return t;
}

function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const isKw = (t, kw) => typeof t === 'string' && t.toLowerCase() === kw;

  function parseOr() {
    let node = parseAnd();
    while (isKw(peek(), 'or')) { next(); node = { op: 'or', l: node, r: parseAnd() }; }
    return node;
  }
  function parseAnd() {
    let node = parseNot();
    while (peek() !== undefined && peek() !== ')' && !isKw(peek(), 'or')) {
      if (isKw(peek(), 'and')) next();
      if (peek() === undefined || peek() === ')') break;
      node = { op: 'and', l: node, r: parseNot() };
    }
    return node;
  }
  function parseNot() {
    if (isKw(peek(), 'not')) { next(); return { op: 'not', c: parseNot() }; }
    return parsePrimary();
  }
  function parsePrimary() {
    const t = peek();
    if (t === '(') { next(); const n = parseOr(); if (peek() === ')') next(); return n; }
    const t2 = tokens[i + 1];
    if (t2 === ':' || t2 === '>' || t2 === '<' || t2 === '>=' || t2 === '<=') {
      const field = next(); const opr = next(); const val = unquote(next() ?? '');
      return { op: 'term', field, opr, val };
    }
    next();
    return { op: 'free', val: unquote(t ?? '') };
  }

  if (!tokens.length) return null;
  return parseOr();
}

function matchValue(v, val) {
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  const needle = String(val).toLowerCase();
  if (needle.includes('*')) {
    const rx = new RegExp('^' + needle.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return rx.test(s);
  }
  return s.includes(needle);
}

function matchTerm(doc, field, opr, val) {
  const v = resolveField(doc, field);
  if (opr === ':') {
    if (val === '*') return v !== undefined && v !== null && String(v) !== '';
    return matchValue(v, val);
  }
  const nv = Number(v);
  const nval = Number(val);
  if (Number.isNaN(nv) || Number.isNaN(nval)) return false;
  if (opr === '>') return nv > nval;
  if (opr === '<') return nv < nval;
  if (opr === '>=') return nv >= nval;
  if (opr === '<=') return nv <= nval;
  return false;
}

function matchFree(doc, val) {
  const needle = String(val).toLowerCase();
  const parts = [doc.ts, doc.host, doc.source, doc.action, doc.user, doc.message];
  if (doc.fields) for (const k of Object.keys(doc.fields)) parts.push(doc.fields[k]);
  return parts.some((p) => p != null && String(p).toLowerCase().includes(needle));
}

function evalNode(node, doc) {
  if (!node) return true;
  switch (node.op) {
    case 'or': return evalNode(node.l, doc) || evalNode(node.r, doc);
    case 'and': return evalNode(node.l, doc) && evalNode(node.r, doc);
    case 'not': return !evalNode(node.c, doc);
    case 'term': return matchTerm(doc, node.field, node.opr, node.val);
    case 'free': return matchFree(doc, node.val);
    default: return true;
  }
}

/** Filter log entries by a KQL query. Returns { docs, error }. Empty query = all. */
export function filterLogs(query, entries) {
  const q = String(query || '').trim();
  if (!q) return { docs: entries, error: null };
  let ast;
  try {
    ast = parse(tokenize(q));
  } catch {
    return { docs: entries, error: 'Could not parse query.' };
  }
  try {
    return { docs: entries.filter((e) => evalNode(ast, e)), error: null };
  } catch {
    return { docs: entries, error: 'Could not evaluate query.' };
  }
}

/** ECS-style field names available in the current log set (for the field list). */
export function availableFields(entries) {
  const std = ['@timestamp', 'host.name', 'event.action', 'event.dataset', 'user.name', 'message'];
  const extra = new Set();
  for (const e of entries) if (e?.fields) for (const k of Object.keys(e.fields)) extra.add(k);
  return [...std, ...[...extra].sort()];
}
