import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { assetName, compileLab } from "./compile";
import { gradeLab } from "./grade";
import { drawParams, validateParamValues } from "./params";
import { cidrContains, semverGte, referencedNames } from "./cel";
import { renderTemplate, templateRefs } from "./template";
import { briefScriptNames, normalizeScript, validateScript } from "./scripts";
import { checkLabFolder, type FolderFile } from "../folder";
import type { Evidence } from "./evidence";

const LAB = `zcl: 1
machines:
  web: { os: ubuntu }
params:
  token: { type: token, length: 6, unique: cohort }
  base:  { type: int, min: 1000, max: 2000, step: 100 }
collect:
  - on: web
    gather:
      t:     { run: [nginx, -t] }
      rules: { file: /etc/snort/rules/local.rules }
      svc:   { service: nginx.service }
  - on: web
    when: final
    gather:
      replay: { run: [snort, -r, "{{asset.cap_pcap}}"] }
parse:
  r: { from: rules.content, with: snort_rules }
checks:
  - id: ok
    title: nginx ok
    points: 10
    assert: [t.exit_code == 0, svc.active_state == "active"]
    hint: run nginx -t
  - id: rule
    title: rule
    assert:
      - { expr: 'r.exists(x, x.msg != null && x.msg.contains(param.token))', points: 5, label: token }
      - { expr: 'r.exists(x, x.sid != null && x.sid >= param.base && x.sid < param.base + 100)', points: 5, label: sid }
  - id: replayed
    title: replay ran
    points: 5
    assert: replay.exit_code == 0
  - id: only_if_running
    title: conditional
    when: svc.active_state == "active"
    points: 5
    assert: "true"
  - id: in_session
    title: written in session
    flag: CHANGED_BEFORE_START
    visibility: instructor
    assert: rules.changed
`;

const compiled = () => {
  const c = compileLab(LAB, { assets: ["cap_pcap"] });
  if (!c.ok) throw new Error(JSON.stringify(c.errors));
  return c.lab;
};

const evidence = (items: Record<string, unknown>, baseline?: Record<string, string>): Evidence => ({
  format: 1,
  roles: { web: { items: items as Evidence["roles"][string]["items"], baseline: baseline ? { files: baseline } : undefined } },
});

const RULE = 'alert tcp any any -> any 80 (msg:"ZAIO-ABC234 sqli"; content:"union"; sid:1201; rev:1;)';
const good = {
  t: { ok: true, exit_code: 0 },
  svc: { ok: true, active_state: "active" },
  rules: { ok: true, exists: true, path: "/etc/snort/rules/local.rules", sha256: "new", content: RULE },
  replay: { ok: true, exit_code: 0, stdout: "" },
};

test("compile: structure, capabilities, max score", () => {
  const lab = compiled();
  assert.equal(lab.maxScore, 30);
  assert.deepEqual(lab.capabilities, ["baseline", "file", "run", "service"]);
  assert.deepEqual(lab.assets, ["cap_pcap"]);
  assert.equal(lab.checks.find((c) => c.id === "rule")!.mode, "partial");
  assert.equal(lab.collect[1].when, "final");
  // Order is execution order and must survive storage (jsonb re-sorts object keys).
  assert.deepEqual(lab.collect[0].gather.map((g) => g.name), ["t", "rules", "svc"]);
  assert.deepEqual(JSON.parse(JSON.stringify(lab)).collect[0].gather[0], { name: "t", item: { kind: "run", argv: ["nginx", "-t"] } });
  assert.deepEqual(lab.parse.r, { item: "rules", field: "content", parser: "snort_rules", options: {} });
});

test("compile: errors carry paths and YAML lines", () => {
  const bad = compileLab(`zcl: 1
machines:
  web: {}
collect:
  - on: db
    gather:
      t: { run: "nginx -t" }
      f: { file: etc/passwd }
      p: { file: /x, run: [a] }
parse:
  x: { from: t.content, with: nginx }
  y: { from: f.content, with: nope }
checks:
  - id: a
    title: A
    points: 5
    assert: unknown_name == 1
    hint: "your token is {{param.token}}"
  - id: a
    title: dup
    flag: lowercase
    assert: "true"
`);
  assert.ok(!bad.ok);
  const msgs = bad.errors.map((e) => `${e.path}@${e.line}: ${e.message}`);
  const has = (re: RegExp) => assert.ok(msgs.some((m) => re.test(m)), `expected ${re} in\n${msgs.join("\n")}`);
  has(/^collect\[0\]\.on@5: on must be one of the roles: web/);
  has(/gather\.t\.run@7: run must be a list/);
  has(/gather\.f\.file@8: file must be an absolute path/);
  has(/gather\.p@9: an item needs exactly one of/);
  has(/^checks\[0\]\.assert@17: Unknown variable: unknown_name/);
  has(/checks\[0\]\.hint.*can't contain \{\{/);
  has(/checks\[1\]\.id.*duplicate check id/);
  has(/checks\[1\]\.flag.*UPPER_SNAKE_CASE/);
  // parse errors for items that didn't compile are reported against `from`
  has(/^parse\.x\.from/);
});

test("compile: YAML syntax errors, unknown keys, asset and param checks", () => {
  const syntax = compileLab("zcl: 1\nmachines: [\n");
  assert.ok(!syntax.ok && syntax.errors[0].line);
  const r = compileLab(LAB.replace("zcl: 1", "zcl: 1\nextra: true").replace("{{asset.cap_pcap}}", "{{asset.missing}} {{param.nope}}"), { assets: ["cap_pcap"], maxCohortSize: 400 });
  assert.ok(!r.ok);
  const text = r.errors.map((e) => e.message).join("\n");
  assert.match(text, /unknown key "extra"/);
  assert.match(text, /no file in lab\/assets\/ named like that/);
  assert.match(text, /no parameter "nope"/);
  // base has 11 values, token is huge: only `token` is unique, so no space error for base
  assert.doesNotMatch(text, /unique: cohort needs/);
  const small = compileLab(LAB.replace("base:  { type: int, min: 1000, max: 2000, step: 100 }", "base:  { type: int, min: 1000, max: 2000, step: 100, unique: cohort }"), { assets: ["cap_pcap"], maxCohortSize: 30 });
  assert.ok(!small.ok && small.errors.some((e) => /needs at least 120 possible values.*has 11/.test(e.message)));
});

test("grade: full marks, partial credit, broken items, flags, when", () => {
  const lab = compiled();
  const params = { token: "ABC234", base: 1200 };

  const full = gradeLab(lab, evidence(good, { "/etc/snort/rules/local.rules": "old" }), { params });
  assert.equal(full.score, 30);
  assert.equal(full.maxScore, 30);
  assert.deepEqual(full.flags, []);

  // Rule with the wrong SID range: partial credit on `rule`.
  const wrongSid = gradeLab(lab, evidence({ ...good, rules: { ...good.rules, content: RULE.replace("1201", "999") } }), { params });
  const rule = wrongSid.checks.find((c) => c.id === "rule")!;
  assert.equal(rule.points, 5);
  assert.equal(rule.passed, false);
  assert.deepEqual(rule.assertions.map((a) => a.passed), [true, false]);

  // A command that couldn't run fails with a student-safe reason and the hint.
  const broken = gradeLab(lab, evidence({ ...good, t: { ok: false, error: "not_found", message: "command not found: nginx" } }), { params });
  const ok = broken.checks.find((c) => c.id === "ok")!;
  assert.equal(ok.points, 0);
  assert.equal(ok.reason, "t: command not found: nginx");
  assert.equal(ok.hint, "run nginx -t");

  // Unchanged since the baseline → flag; service stopped → conditional check skipped.
  const stale = gradeLab(lab, evidence({ ...good, svc: { ok: true, active_state: "inactive" } }, { "/etc/snort/rules/local.rules": "new" }), { params });
  assert.deepEqual(stale.flags, ["CHANGED_BEFORE_START"]);
  const cond = stale.checks.find((c) => c.id === "only_if_running")!;
  assert.ok(cond.skipped);
  assert.equal(stale.maxScore, 25);

  // Practice runs don't collect `when: final` steps.
  const practice = gradeLab(lab, evidence(good), { params, run: "practice" });
  assert.equal(practice.checks.find((c) => c.id === "replayed")!.reason, "replay: not collected");
  assert.match(full.graderRev, /^zcl1;snort_rules@1$/);
});

test("params: draw within bounds, avoid taken values, validate", () => {
  const lab = compiled();
  let i = 0;
  const seq = [0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 3]; // first token AAAAAA is taken → redraw
  const v = drawParams(lab.params, { token: new Set(["AAAAAA"]) }, (n) => seq[i++ % seq.length] % n);
  assert.equal(v.token, "FFFFFF");
  assert.equal(v.base, 1300);
  assert.equal(validateParamValues(lab.params, v), null);
  assert.match(String(validateParamValues(lab.params, { token: "abc", base: 1300 })), /token/);
  assert.match(String(validateParamValues(lab.params, { token: "ABCDEF", base: 1250 })), /step 100/);
  for (let k = 0; k < 50; k++) assert.equal(validateParamValues(lab.params, drawParams(lab.params)), null);
});

test("cel helpers, templates, names", () => {
  assert.ok(cidrContains("10.50.0.0/16", "10.50.37.4"));
  assert.ok(!cidrContains("10.50.0.0/16", "10.51.0.1"));
  assert.ok(!cidrContains("nonsense", "10.0.0.1"));
  assert.ok(semverGte("1.24.0-2ubuntu7", "1.24"));
  assert.ok(!semverGte("v2.9.20", "3.0"));
  assert.deepEqual(referencedNames('r.exists(x, x.msg == "t.exit_code") && t.ok && other.r', new Set(["r", "t", "x"])).sort(), ["r", "t", "x"]);
  assert.equal(renderTemplate("-r {{ asset.cap }} {{param.token}} {{machine.web.hostname}} {{nope.x}}", { asset: { cap: "/a" }, param: { token: "K" }, machine: { web: { hostname: "h" } } }), "-r /a K h {{nope.x}}");
  assert.equal(templateRefs("{{session.nonce}} {{bad}}").map((r) => r.kind).join(","), "session,invalid");
  assert.equal(assetName("lab/assets/SQLi Capture.pcap"), "sqli_capture_pcap");
});

async function folderFiles(root: string): Promise<FolderFile[]> {
  const out: FolderFile[] = [];
  const walk = async (dir: string) => {
    for (const name of await readdir(dir)) {
      const abs = path.join(dir, name);
      const st = await stat(abs);
      if (st.isDirectory()) await walk(abs);
      else out.push({ rel: path.relative(root, abs).replace(/\\/g, "/"), size: st.size, text: () => readFile(abs, "utf8"), bytes: async () => new Uint8Array(await readFile(abs)) });
    }
  };
  await walk(root);
  return out;
}

test("gate: the example lab passes with real reference evidence", async () => {
  const files = await folderFiles(path.join(process.cwd(), "docs/examples/lab-p21-web"));
  const report = await checkLabFolder(files);
  assert.deepEqual(report.errors, []);
  assert.ok(report.ok);
  assert.equal(report.gate.good!.score, 100);
  assert.equal(report.gate.broken!.score, 30);
  assert.ok(report.gate.broken!.expectations.every((e) => e.ok));
  assert.deepEqual(report.assets.map((a) => a.name), ["sqli_pcap"]);
});

test("gate: rejects a lab whose good reference doesn't score full marks", async () => {
  const files = await folderFiles(path.join(process.cwd(), "docs/examples/lab-p21-web"));
  const tampered = files.map((f) => f.rel === "reference/good.evidence.json"
    ? { ...f, text: async () => (await f.text()).replace(/X-Vukani-Node: K7Q2XM/g, "X-Vukani-Node: WRONG1") }
    : f);
  const report = await checkLabFolder(tampered);
  assert.ok(!report.ok);
  assert.match(report.errors.map((e) => e.message).join("\n"), /scores 90\/100, not full marks\. Failing: security_headers/);
});

test("gate: a lab without a good reference is accepted as a draft", async () => {
  const files = await folderFiles(path.join(process.cwd(), "docs/examples/lab-p21-web"));
  const report = await checkLabFolder(files.filter((f) => f.rel !== "reference/good.evidence.json"));
  assert.deepEqual(report.errors, []);
  assert.ok(report.ok);
  assert.equal(report.draft, true);
  assert.equal(report.gate.good, undefined);
  assert.equal(report.gate.broken!.score, 30);
  assert.ok(report.warnings.some((w) => w.file === "reference/good.evidence.json" && /draft/.test(w.message)));
});

test("lockdown: needs a time limit; agent reports become flags", async () => {
  const { lockdownFlags } = await import("./evidence");
  const withLockdown = (extra: string) => compileLab(`zcl: 1
${extra}
machines:
  web: {}
lifecycle:
  lockdown: { ssh: off }
collect:
  - on: web
    gather:
      t: { run: [nginx, -t] }
checks:
  - { id: ok, title: ok, points: 1, assert: "t.exit_code == 0" }
`);
  const noLimit = withLockdown("");
  assert.ok(!noLimit.ok && noLimit.errors.some((e) => /lockdown needs session.timeLimitMinutes/.test(e.message)));
  const ok = withLockdown("session: { timeLimitMinutes: 60 }");
  assert.ok(ok.ok && ok.lab.capabilities.includes("ssh_lockdown"));

  const held = { units: [{ unit: "ssh.socket", loadState: "masked", activeState: "inactive", unitFileState: "masked" }], journal: true, sshSessions: 0, logins: [] };
  const ev = (l: object): Evidence => ({ format: 1, roles: { web: { items: {}, lockdown: l } } });
  assert.deepEqual(lockdownFlags(ev(held)), []);
  assert.deepEqual(lockdownFlags(ev({ ...held, logins: ["sshd[1]: Accepted publickey for nash"] })), ["SSH_DURING_LOCKDOWN"]);
  assert.deepEqual(lockdownFlags(ev({ ...held, sshSessions: 1 })), ["SSH_DURING_LOCKDOWN"]);
  assert.deepEqual(lockdownFlags(ev({ ...held, units: [{ ...held.units[0], loadState: "loaded", activeState: "active" }] })), ["LOCKDOWN_TAMPERED"]);
  assert.deepEqual(lockdownFlags(ev({ ...held, journal: false })), ["LOCKDOWN_TAMPERED"]);
  assert.deepEqual(lockdownFlags({ format: 1, roles: { web: { items: {} } } }), [], "no report (e.g. not a lockdown lab) → no flags");
});

test("scripts: brief shortcodes, validation, folder check", async () => {
  const refs = templateRefs("{{script.setup}} {{ script.setup.url }} {{script.x.y}}");
  assert.deepEqual(refs.map((r) => (r.kind === "script" ? `${r.name}:${r.form}` : r.kind)), ["setup:command", "setup:url", "invalid"]);
  assert.equal(
    renderTemplate("run `{{script.setup}}` or fetch {{script.setup.url}}; {{script.gone}}", { script: { setup: "https://a.test/r/Abc" } }),
    "run `curl -fsSL https://a.test/r/Abc | sudo bash` or fetch https://a.test/r/Abc; {{script.gone}}",
  );
  assert.deepEqual(briefScriptNames("{{script.a}} {{script.b.url}} {{script.a}} {{param.token}}"), ["a", "b"]);
  assert.equal(normalizeScript("a\r\nb\rc"), "a\nb\nc");

  const compiled = compileLab(LAB);
  const params = compiled.ok ? compiled.lab.params : null;
  assert.deepEqual(validateScript("setup", "echo {{param.token}}", params), []);
  assert.ok(validateScript("Set Up", "echo", params).some((p) => /lowercase/.test(p)));
  assert.ok(validateScript("setup", "  ", params).some((p) => /empty/.test(p)));
  assert.ok(validateScript("setup", "echo {{param.nope}}", params).some((p) => /no parameter "nope"/.test(p)));
  assert.ok(validateScript("setup", "echo {{session.nonce}}", params).some((p) => /only use \{\{param/.test(p)));

  // lab.yaml can't use scripts.
  const inYaml = compileLab(LAB.replace("[nginx, -t]", '[nginx, "{{script.setup}}"]'));
  assert.ok(!inYaml.ok && inYaml.errors.some((e) => /scripts are for the brief/.test(e.message)));

  // The example lab ships scripts/setup.sh and uses it in its brief.
  const files = await folderFiles(path.join(process.cwd(), "docs/examples/lab-p21-web"));
  const ok = await checkLabFolder(files);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.scripts.map((x) => x.name), ["setup"]);

  // A brief naming a script the folder lacks is an error, unless the lab already has it on Athena.
  const noScript = files.filter((f) => f.rel !== "scripts/setup.sh");
  const missing = await checkLabFolder(noScript);
  assert.ok(missing.errors.some((e) => e.file === "brief.md" && /no scripts\/setup\.sh/.test(e.message)));
  const onAthena = await checkLabFolder(noScript, { existingScripts: async () => ["setup"] });
  assert.deepEqual(onAthena.errors, []);

  // An unused script is a warning; non-.sh files in scripts/ are ignored with a warning.
  const extra = (rel: string, text: string): FolderFile => ({ rel, size: text.length, text: async () => text, bytes: async () => Buffer.from(text) });
  const more = await checkLabFolder([...files, extra("scripts/extra.sh", "echo hi\r\n"), extra("scripts/README.md", "notes")]);
  assert.deepEqual(more.errors, []);
  assert.equal(more.scripts.find((x) => x.name === "extra")?.content, "echo hi\n");
  assert.ok(more.warnings.some((w) => w.file === "scripts/extra.sh" && /not used in the brief/.test(w.message)));
  assert.ok(more.warnings.some((w) => w.file === "scripts/README.md" && /ignored/.test(w.message)));
});
