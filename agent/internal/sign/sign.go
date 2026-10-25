// Package sign implements request signing for the Athena agent protocol
// (docs/labs/spec.md 7.2, protocol/README.md). Test vectors live in
// protocol/fixtures/request-signing.json and are shared with Athena's tests.
package sign

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

// StringToSign is the exact message a machine signs for one request:
// METHOD \n path?query \n ts \n hex(sha256(body)).
func StringToSign(method, pathWithQuery string, ts int64, body []byte) string {
	sum := sha256.Sum256(body)
	return fmt.Sprintf("%s\n%s\n%d\n%s", strings.ToUpper(method), pathWithQuery, ts, hex.EncodeToString(sum[:]))
}

// Sign returns the base64 Ed25519 signature of msg.
func Sign(key ed25519.PrivateKey, msg string) string {
	return base64.StdEncoding.EncodeToString(ed25519.Sign(key, []byte(msg)))
}

// PublicKeyB64 encodes a public key the way the protocol sends it: base64 of the raw 32 bytes.
func PublicKeyB64(pub ed25519.PublicKey) string {
	return base64.StdEncoding.EncodeToString(pub)
}

// Fingerprint is "SHA256:" + unpadded base64 of sha256(raw key), as OpenSSH prints it.
func Fingerprint(pub ed25519.PublicKey) string {
	sum := sha256.Sum256(pub)
	return "SHA256:" + base64.RawStdEncoding.EncodeToString(sum[:])
}
