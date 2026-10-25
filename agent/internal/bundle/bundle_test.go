package bundle

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fixture struct {
	KeyID     string `json:"keyId"`
	PublicKey string `json:"publicKey"`
	Bundle    string `json:"bundle"`
	Signature string `json:"signature"`
}

// protocol/fixtures/bundle-signing.json — the same vector Athena's tests sign.
func load(t *testing.T) fixture {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "protocol", "fixtures", "bundle-signing.json"))
	if err != nil {
		t.Fatal(err)
	}
	var f fixture
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

func TestVerifyFixture(t *testing.T) {
	f := load(t)
	trust := Trust{KeyID: f.KeyID, PublicKey: f.PublicKey}
	at := time.Date(2026, 10, 25, 10, 5, 0, 0, time.UTC)

	b, err := Verify(f.Bundle, f.Signature, f.KeyID, trust, "m_test", at)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if b.Kind != "COLLECT" || b.Lab.Slug != "p21-web" || len(b.Steps) != 1 || b.Steps[0].Gather[0].Item.Argv[1] != "-t" {
		t.Fatalf("unexpected bundle: %+v", b)
	}

	// One flipped byte anywhere breaks the signature (including in the non-ASCII part).
	raw, _ := base64.StdEncoding.DecodeString(f.Bundle)
	tampered := []byte(strings.Replace(string(raw), "nginx", "nginz", 1))
	if _, err := Verify(base64.StdEncoding.EncodeToString(tampered), f.Signature, f.KeyID, trust, "m_test", at); err != ErrUntrusted {
		t.Fatalf("tampered bundle: want ErrUntrusted, got %v", err)
	}
	if _, err := Verify(f.Bundle, f.Signature, "other-key", trust, "m_test", at); err == nil {
		t.Fatal("wrong key id must be refused")
	}
	if _, err := Verify(f.Bundle, f.Signature, f.KeyID, trust, "m_other", at); err == nil {
		t.Fatal("bundle for another machine must be refused")
	}
	if _, err := Verify(f.Bundle, f.Signature, f.KeyID, trust, "m_test", at.Add(time.Hour)); err == nil {
		t.Fatal("expired bundle must be refused")
	}
	if _, err := Verify(f.Bundle, f.Signature, f.KeyID, Trust{KeyID: f.KeyID}, "m_test", at); err == nil {
		t.Fatal("missing pinned key must be refused")
	}
}
