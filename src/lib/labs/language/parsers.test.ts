import { test } from "node:test";
import assert from "node:assert/strict";
import { PARSERS, parserRevision } from "./parsers";

const run = (name: string, text: string, opts: Record<string, unknown> = {}) => PARSERS[name].parse(text, opts) as never;

test("nginx: dump with includes, servers, locations, headers", () => {
  const dump = [
    "# configuration file /etc/nginx/nginx.conf:",
    "user www-data;",
    "events { worker_connections 768; }",
    "http {",
    "  server_tokens on; # overridden below",
    "  include /etc/nginx/conf.d/*.conf;",
    "  include sites-enabled/*;",
    "}",
    "",
    "# configuration file /etc/nginx/conf.d/hardening.conf:",
    "server_tokens off;",
    'add_header X-Frame-Options "DENY" always;',
    "",
    "# configuration file /etc/nginx/sites-enabled/default:",
    "server {",
    "  listen 80 default_server;",
    "  listen [::]:80;",
    "  server_name portal.vukani.test www.vukani.test;",
    "  location /admin/ { allow 10.50.37.0/24; deny all; }",
    "  location ~* \\.php$ { return 403; }",
    "}",
  ].join("\n");
  const n = run("nginx", dump) as {
    files: string[]; main: { values: Record<string, string> }; http: { values: Record<string, string>; headers: Record<string, string> };
    servers: { listen: string[]; server_name: string[]; locations: { path: string; modifier: string; directives: { name: string; args: string[] }[] }[] }[];
  };
  assert.deepEqual(n.files, ["/etc/nginx/nginx.conf", "/etc/nginx/conf.d/hardening.conf", "/etc/nginx/sites-enabled/default"]);
  assert.equal(n.main.values.user, "www-data");
  assert.equal(n.http.values.server_tokens, "off", "the included file comes after, so its value wins");
  assert.equal(n.http.headers["x-frame-options"], "DENY");
  assert.equal(n.servers.length, 1);
  assert.deepEqual(n.servers[0].listen, ["80 default_server", "[::]:80"]);
  assert.deepEqual(n.servers[0].server_name, ["portal.vukani.test", "www.vukani.test"]);
  const [admin, php] = n.servers[0].locations;
  assert.equal(admin.path, "/admin/");
  assert.deepEqual(admin.directives.map((d) => [d.name, ...d.args]), [["allow", "10.50.37.0/24"], ["deny", "all"]]);
  assert.equal(php.modifier, "~*");
  assert.equal(php.path, "\\.php$");
});

test("nginx: a single file and syntax errors", () => {
  const n = run("nginx", "http { server { listen 8080; } }") as { files: string[]; servers: { listen: string[] }[] };
  assert.deepEqual(n.files, ["nginx.conf"]);
  assert.deepEqual(n.servers[0].listen, ["8080"]);
  assert.throws(() => run("nginx", "http { server_tokens off;"), /missing "}"/);
  assert.throws(() => run("nginx", 'http { add_header X "y; }'), /unterminated/);
});

test("snort_rules: options, quoting, continuation, comments", () => {
  const rules = run("snort_rules", [
    "# local rules",
    "var HOME_NET any",
    '# alert tcp any any -> any 80 (msg:"disabled"; sid:1;)',
    'alert tcp $EXTERNAL_NET any -> $HOME_NET 80 (msg:"ZAIO-K7Q2XM SQLi \\"quoted\\"; ok"; flow:to_server,established; \\',
    '  content:"UNION"; nocase; content:!"benign"; pcre:"/select.+from/i"; classtype:web-application-attack; sid:1230001; rev:2;)',
    'drop udp any any -> any 53 (msg:"dns"; sid:1230002;)',
  ].join("\n")) as {
    action: string; msg: string; sid: number; rev: number | null; contents: string[]; negated: boolean[]; pcres: string[]; opts: Record<string, string>; dst_port: string; line: number;
  }[];
  assert.equal(rules.length, 2);
  const [a, b] = rules;
  assert.equal(a.action, "alert");
  assert.equal(a.msg, 'ZAIO-K7Q2XM SQLi "quoted"; ok');
  assert.equal(a.sid, 1230001);
  assert.equal(a.rev, 2);
  assert.equal(a.dst_port, "80");
  assert.deepEqual(a.contents, ["UNION", "benign"]);
  assert.deepEqual(a.negated, [false, true]);
  assert.deepEqual(a.pcres, ["/select.+from/i"]);
  assert.equal(a.opts.flow, "to_server,established");
  assert.equal(a.line, 4);
  assert.equal(b.action, "drop");
  assert.equal(b.rev, null);
});

test("sshd and kv", () => {
  const s = run("sshd", "port 2222\nport 2223\nPermitRootLogin no\npasswordauthentication no\n") as Record<string, unknown> & { _all: Record<string, string[]> };
  assert.equal(s.port, "2223");
  assert.deepEqual(s._all.port, ["2222", "2223"]);
  assert.equal(s.permitrootlogin, "no");
  const k = run("kv", "a = 1\n# c = 3\nb=two words\n", { sep: "=" }) as Record<string, unknown>;
  assert.equal(k.a, "1");
  assert.equal(k.b, "two words");
  assert.equal(k.c, undefined);
});

test("ini, csv, table, lines, json, jsonl, yaml", () => {
  const ini = run("ini", "top = 1\n[nginx-limit-req]\nenabled = true\nmaxretry: 4\nlogpath = /a\n    /b\n; comment\n") as Record<string, Record<string, string>>;
  assert.equal(ini._global.top, "1");
  assert.equal(ini["nginx-limit-req"].maxretry, "4");
  assert.equal(ini["nginx-limit-req"].logpath, "/a\n/b");

  assert.deepEqual(run("csv", 'name,note\nalice,"a, ""quoted"" note"\nbob,\n'), [{ name: "alice", note: 'a, "quoted" note' }, { name: "bob", note: "" }]);

  const t = run("table", "Netid State  Local-Address Process\ntcp   LISTEN 0.0.0.0:80 users:((\"nginx\",pid=1)) extra words\n") as Record<string, string>[];
  assert.deepEqual(Object.keys(t[0]), ["netid", "state", "local_address", "process"]);
  assert.equal(t[0].state, "LISTEN");
  assert.equal(t[0].process, 'users:(("nginx",pid=1)) extra words', "the last column keeps the rest of the line");

  assert.deepEqual(run("lines", " a \n\n# x\nb", { comment: "#" }), ["a", "b"]);
  assert.deepEqual(run("json", '{"a":[1]}'), { a: [1] });
  assert.throws(() => run("json", "{"), /not valid JSON/);
  assert.deepEqual(run("jsonl", '{"e":1}\nnot json\n{"e":2}\n'), [{ e: 1 }, { e: 2 }]);
  assert.deepEqual(run("yaml", "a: [1, 2]\n"), { a: [1, 2] });
});

test("regex: named groups, validation", () => {
  const out = run("regex", "[**] [1:1230001:1] ZAIO sqli [**]\n[**] [1:528:5] loopback [**]", {
    pattern: "\\[\\*\\*\\] \\[(?<gid>\\d+):(?<sid>\\d+):(?<rev>\\d+)\\] (?<msg>.*?) \\[\\*\\*\\]",
  });
  assert.deepEqual(out, [{ gid: "1", sid: "1230001", rev: "1", msg: "ZAIO sqli" }, { gid: "1", sid: "528", rev: "5", msg: "loopback" }]);
  assert.match(String(PARSERS.regex.validate!({ pattern: "(\\d+)" })), /named group/);
  assert.match(String(PARSERS.regex.validate!({ pattern: "(?<a>" })), /invalid pattern/);
  assert.equal(PARSERS.regex.validate!({ pattern: "(?<a>x)", flags: "i" }), null);
});

test("parser revision string", () => {
  assert.equal(parserRevision(["nginx", "regex", "nope"]), "nginx@1,regex@1");
});
