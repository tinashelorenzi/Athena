// Package config persists the agent's enrolment: /etc/zaio/agent.json and
// the machine's private key /etc/zaio/machine.key (0600, base64 seed).
package config

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const DefaultDir = "/etc/zaio"

type Config struct {
	AthenaURL      string `json:"athenaUrl"`
	MachineID      string `json:"machineId"`
	Hostname       string `json:"hostname"`
	Label          string `json:"label"`
	OwnerName      string `json:"ownerName"`
	OwnerEmail     string `json:"ownerEmail"`
	KeyFingerprint string `json:"keyFingerprint"`
	AthenaKeyID    string `json:"athenaKeyId,omitempty"`
	// Athena's bundle-signing public key, pinned at enrolment (base64 raw 32 bytes).
	AthenaPublicKey string    `json:"athenaPublicKey,omitempty"`
	EnrolledAt      time.Time `json:"enrolledAt"`
}

// ErrNotEnrolled means there is no agent.json yet.
var ErrNotEnrolled = errors.New("this machine is not enrolled — run `sudo zaio setup`")

func configPath(dir string) string { return filepath.Join(dir, "agent.json") }
func keyPath(dir string) string    { return filepath.Join(dir, "machine.key") }

func Load(dir string) (*Config, error) {
	b, err := os.ReadFile(configPath(dir))
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotEnrolled
	}
	if err != nil {
		return nil, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("%s is corrupt: %w", configPath(dir), err)
	}
	if c.AthenaURL == "" || c.MachineID == "" {
		return nil, fmt.Errorf("%s is incomplete — run `sudo zaio setup` again", configPath(dir))
	}
	return &c, nil
}

func Save(dir string, c *Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(configPath(dir), append(b, '\n'), 0o644)
}

func LoadKey(dir string) (ed25519.PrivateKey, error) {
	b, err := os.ReadFile(keyPath(dir))
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotEnrolled
	}
	if err != nil {
		return nil, err
	}
	seed, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
	if err != nil || len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("%s is corrupt — run `sudo zaio setup` again", keyPath(dir))
	}
	return ed25519.NewKeyFromSeed(seed), nil
}

func SaveKey(dir string, key ed25519.PrivateKey) error {
	return writeAtomic(keyPath(dir), []byte(base64.StdEncoding.EncodeToString(key.Seed())+"\n"), 0o600)
}

// writeAtomic writes via a temp file + rename so a crash never leaves a half-written file.
func writeAtomic(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
