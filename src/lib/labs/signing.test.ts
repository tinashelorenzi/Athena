import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeRawPublicKey, keyFingerprint, stringToSign, verifySignature } from "./signing";
import { hashCode, machineHostname, normalizeCode, parseEnrollInput } from "./machines";

// Shared vectors: the Go agent's tests (agent/internal/sign) run against the same file.
const fixture = JSON.parse(readFileSync(join(process.cwd(), "protocol/fixtures/request-signing.json"), "utf8"));

test("string-to-sign matches every protocol vector", () => {
  for (const v of fixture.vectors) {
    assert.equal(stringToSign(v.method, v.path, v.ts, Buffer.from(v.body, "utf8")), v.stringToSign, v.name);
  }
});

test("signatures from the fixture key verify, tampered ones don't", () => {
  for (const v of fixture.vectors) {
    assert.ok(verifySignature(fixture.publicKey, v.stringToSign, v.signature), v.name);
    assert.ok(!verifySignature(fixture.publicKey, v.stringToSign + "x", v.signature), `${v.name} (tampered)`);
  }
});

test("signing with the fixture seed reproduces the vectors (Ed25519 is deterministic)", () => {
  const seed = Buffer.from(fixture.seed, "base64");
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  for (const v of fixture.vectors) {
    assert.equal(sign(null, Buffer.from(v.stringToSign, "utf8"), key).toString("base64"), v.signature, v.name);
  }
});

test("fingerprint and raw key decoding", () => {
  const raw = decodeRawPublicKey(fixture.publicKey);
  assert.ok(raw);
  assert.equal(keyFingerprint(raw), fixture.fingerprint);
  assert.equal(decodeRawPublicKey("AAAA"), null);
  assert.equal(decodeRawPublicKey("not base64!"), null);
});

test("enrolment codes normalise before hashing", () => {
  assert.equal(normalizeCode(" k7q2-9xmp "), "K7Q29XMP");
  assert.equal(hashCode("K7Q2-9XMP"), hashCode("k7q2 9xmp"));
});

test("hostnames are zaio-<handle>-<NN>", () => {
  assert.equal(machineHostname("T.Matanda+lab@example.com", 2), "zaio-tmatandalab-02");
  assert.equal(machineHostname("@x", 11), "zaio-student-11");
});

test("enrol input validation", () => {
  const good = {
    email: "S@Example.com", code: "K7Q2-9XMP", publicKey: fixture.publicKey,
    machineId: "71b37a67899c4fa18c536c9cafd37dd8", os: "ubuntu", osVersion: "24.04", arch: "amd64",
    agentVersion: "0.1.0", capabilities: ["file", 3],
  };
  const parsed = parseEnrollInput(good);
  assert.ok(typeof parsed !== "string");
  assert.equal(parsed.email, "s@example.com");
  assert.deepEqual(parsed.capabilities, ["file"]);
  assert.match(String(parseEnrollInput({ ...good, arch: "x86" })), /arch/);
  assert.match(String(parseEnrollInput({ ...good, machineId: "nope" })), /machineId/);
  assert.match(String(parseEnrollInput({ ...good, publicKey: "AAAA" })), /publicKey/);
});

// Bundle signing: Athena's side of protocol/fixtures/bundle-signing.json (the Go agent verifies the same vector).
test("bundle signatures match the shared vector", async () => {
  const { keyFromSeed } = await import("./bundle-signing");
  const { sign: edSign } = await import("node:crypto");
  const vec = JSON.parse(readFileSync(join(process.cwd(), "protocol/fixtures/bundle-signing.json"), "utf8"));
  const key = keyFromSeed(Buffer.from(vec.seed, "base64"), vec.keyId);
  assert.equal(key.publicKey, vec.publicKey);
  const bytes = Buffer.from(vec.bundle, "base64");
  assert.equal(edSign(null, bytes, key.privateKey).toString("base64"), vec.signature);
  assert.equal(JSON.parse(bytes.toString("utf8")).note, "non-ASCII survives byte-exact signing: ✓ ñ");
});
