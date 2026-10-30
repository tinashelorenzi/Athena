import { test } from "node:test";
import assert from "node:assert/strict";
import { compileLab } from "./language/compile";
import { osLabel, roleMismatch, versionMatches } from "./os";

const lab = (machines: string) => `zcl: 1
machines:
${machines}
collect:
  - on: ${machines.trim().split(":")[0]}
    gather:
      f: { file: /etc/hostname }
checks:
  - id: a
    title: A
    points: 1
    assert: f.ok
`;

test("os: roles can ask for ubuntu, kali or any", () => {
  for (const os of ["ubuntu", "kali", "any"]) {
    const r = compileLab(lab(`  box: { os: ${os} }`));
    assert.ok(r.ok, JSON.stringify(!r.ok && r.errors));
    assert.equal(r.lab.machines.box.os, os);
  }
  const plain = compileLab(lab("  box: {}"));
  assert.ok(plain.ok && plain.lab.machines.box.os === "ubuntu");
  const bad = compileLab(lab("  box: { os: windows }"));
  assert.ok(!bad.ok && bad.errors.some((e) => /os must be ubuntu, kali, any/.test(e.message)));
});

test("os: machines must match the role's OS and versions", () => {
  const ubuntu = { label: "web-1", os: "ubuntu", osVersion: "24.04" };
  const kali = { label: "kali", os: "kali", osVersion: "2025.3" };
  assert.equal(roleMismatch("web", { os: "ubuntu", versions: [] }, ubuntu), null);
  assert.match(roleMismatch("web", { os: "ubuntu", versions: [] }, kali) ?? "", /"web" needs an Ubuntu machine; kali runs Kali Linux 2025.3/);
  assert.equal(roleMismatch("attacker", { os: "kali", versions: [] }, kali), null);
  assert.match(roleMismatch("attacker", { os: "kali", versions: [] }, ubuntu) ?? "", /needs a Kali Linux machine/);
  assert.equal(roleMismatch("box", { os: "any", versions: [] }, kali), null);
  assert.equal(roleMismatch("box", { os: "any", versions: [] }, ubuntu), null);
  assert.ok(roleMismatch("box", { os: "any", versions: [] }, { label: "d", os: "debian", osVersion: "12" }));
  assert.equal(roleMismatch("attacker", { os: "kali", versions: ["2025"] }, kali), null);
  assert.match(roleMismatch("attacker", { os: "kali", versions: ["2026"] }, kali) ?? "", /needs Kali Linux 2026; kali runs/);
  assert.match(roleMismatch("web", { os: "ubuntu", versions: ["22.04"] }, ubuntu) ?? "", /needs Ubuntu 22.04/);
});

test("os: version prefixes and labels", () => {
  assert.ok(versionMatches([], "anything"));
  assert.ok(versionMatches(["24.04"], "24.04"));
  assert.ok(versionMatches(["24"], "24.04"));
  assert.ok(!versionMatches(["24.0"], "24.04"));
  assert.ok(!versionMatches(["2025"], "20251.1"));
  assert.equal(osLabel("kali", "2025.3"), "Kali Linux 2025.3");
  assert.equal(osLabel("debian", "12"), "debian 12");
});
