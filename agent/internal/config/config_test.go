package config

import (
	"crypto/ed25519"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if _, err := Load(dir); !errors.Is(err, ErrNotEnrolled) {
		t.Fatalf("empty dir: want ErrNotEnrolled, got %v", err)
	}
	c := &Config{AthenaURL: "http://localhost:3000", MachineID: "m_1", Hostname: "zaio-x-01", EnrolledAt: time.Unix(1793000000, 0).UTC()}
	if err := Save(dir, c); err != nil {
		t.Fatal(err)
	}
	got, err := Load(dir)
	if err != nil || *got != *c {
		t.Fatalf("load = %#v, %v", got, err)
	}

	_, key, _ := ed25519.GenerateKey(nil)
	if err := SaveKey(dir, key); err != nil {
		t.Fatal(err)
	}
	back, err := LoadKey(dir)
	if err != nil || !back.Equal(key) {
		t.Fatalf("key round trip failed: %v", err)
	}
	if runtime.GOOS != "windows" {
		st, _ := os.Stat(filepath.Join(dir, "machine.key"))
		if st.Mode().Perm() != 0o600 {
			t.Fatalf("machine.key mode = %v, want 0600", st.Mode().Perm())
		}
	}
}
