# Athena ↔ agent protocol

Wire contract between Athena (`src/app/api/agent/*`, `src/lib/labs/`) and the
`zaio` agent (`agent/`). The design is in [docs/labs/spec.md](../docs/labs/spec.md);
this folder is the part both sides test against.

- `schema/` — JSON Schemas (draft 2020-12) for every request and response body.
- `fixtures/` — test vectors: `request-signing.json` (machine → Athena) and
  `bundle-signing.json` (Athena → machine). **Both** the Go tests (`agent/`) and the Athena tests
  (`npm run test:labs`) must reproduce them exactly. The keys in here are test keys.

## Request signing (spec 7.2)

Every agent request after enrolment carries `X-Zaio-Machine`, `X-Zaio-Ts` (Unix
seconds) and `X-Zaio-Sig` (base64 Ed25519 signature over):

```
<METHOD>\n<path including ?query>\n<X-Zaio-Ts>\n<lowercase hex sha256 of the raw body bytes>
```

Public keys travel as base64 of the raw 32-byte Ed25519 key. Fingerprints are
`SHA256:` + unpadded base64 of sha256(raw key) — the OpenSSH style.

Changing anything here is a protocol change: update the schema, regenerate the
fixtures, and make both test suites pass in the same commit.
