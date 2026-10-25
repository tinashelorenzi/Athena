package sign

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type vector struct {
	Name         string `json:"name"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	Ts           int64  `json:"ts"`
	Body         string `json:"body"`
	StringToSign string `json:"stringToSign"`
	Signature    string `json:"signature"`
}

type fixture struct {
	Seed        string   `json:"seed"`
	PublicKey   string   `json:"publicKey"`
	Fingerprint string   `json:"fingerprint"`
	Vectors     []vector `json:"vectors"`
}

// The same vectors Athena's src/lib/labs/signing.test.ts checks.
func loadFixture(t *testing.T) fixture {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "protocol", "fixtures", "request-signing.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f fixture
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return f
}

func TestVectors(t *testing.T) {
	f := loadFixture(t)
	seed, _ := base64.StdEncoding.DecodeString(f.Seed)
	key := ed25519.NewKeyFromSeed(seed)
	pub := key.Public().(ed25519.PublicKey)

	if got := PublicKeyB64(pub); got != f.PublicKey {
		t.Fatalf("public key = %s, want %s", got, f.PublicKey)
	}
	if got := Fingerprint(pub); got != f.Fingerprint {
		t.Fatalf("fingerprint = %s, want %s", got, f.Fingerprint)
	}
	for _, v := range f.Vectors {
		s := StringToSign(v.Method, v.Path, v.Ts, []byte(v.Body))
		if s != v.StringToSign {
			t.Errorf("%s: string-to-sign = %q, want %q", v.Name, s, v.StringToSign)
		}
		if sig := Sign(key, s); sig != v.Signature {
			t.Errorf("%s: signature = %s, want %s", v.Name, sig, v.Signature)
		}
	}
}
