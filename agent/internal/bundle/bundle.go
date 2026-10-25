// Package bundle verifies and parses the signed task bundles Athena sends
// (docs/labs/spec.md 7.3). The signature covers the exact bytes; nothing is
// parsed until it checks out.
package bundle

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Item mirrors GatherItem in src/lib/labs/language/types.ts.
type Item struct {
	Kind     string   `json:"kind"`
	Path     string   `json:"path,omitempty"`
	MaxBytes int      `json:"maxBytes,omitempty"`
	Pattern  string   `json:"pattern,omitempty"`
	Content  bool     `json:"content,omitempty"`
	MaxFiles int      `json:"maxFiles,omitempty"`
	Argv     []string `json:"argv,omitempty"`
	Timeout  int      `json:"timeout,omitempty"`
	Stdin    *string  `json:"stdin,omitempty"`
	Cwd      string   `json:"cwd,omitempty"`
	Unit     string   `json:"unit,omitempty"`
	Names    []string `json:"names,omitempty"`
}

type Entry struct {
	Name string `json:"name"`
	Item Item   `json:"item"`
}

type Step struct {
	Gather []Entry `json:"gather"`
}

type Asset struct {
	Name   string `json:"name"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
	Path   string `json:"path"`
	URL    string `json:"url"`
}

type Bundle struct {
	Format    int       `json:"format"`
	TaskID    string    `json:"taskId"`
	Kind      string    `json:"kind"` // BASELINE | COLLECT | UNDO
	MachineID string    `json:"machineId"`
	SessionID string    `json:"sessionId"`
	Role      string    `json:"role"`
	IssuedAt  time.Time `json:"issuedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
	Lab       struct {
		Slug    string `json:"slug"`
		Version int    `json:"version"`
	} `json:"lab"`

	// BASELINE
	Baseline *struct {
		Hash []string `json:"hash"`
		Logs []string `json:"logs"`
	} `json:"baseline,omitempty"`
	Lockdown *struct {
		SSH string `json:"ssh"`
	} `json:"lockdown,omitempty"`
	DeadlineAt *time.Time `json:"deadlineAt,omitempty"`
	// UndoAt: undo the lockdown by then even if Athena never says so.
	UndoAt *time.Time `json:"undoAt,omitempty"`

	// COLLECT
	Run    string  `json:"run,omitempty"`
	Steps  []Step  `json:"steps,omitempty"`
	Assets []Asset `json:"assets,omitempty"`
}

// Trust is the Athena key pinned at enrolment.
type Trust struct {
	KeyID     string
	PublicKey string // base64 raw 32 bytes
}

var ErrUntrusted = errors.New("bundle signature does not verify against the pinned Athena key")

// Verify checks the signature over the decoded bytes, then parses them and
// checks the bundle is for this machine and not expired.
func Verify(bundleB64, sigB64, keyID string, trust Trust, machineID string, now time.Time) (*Bundle, error) {
	if trust.PublicKey == "" {
		return nil, errors.New("no Athena key pinned — run `sudo zaio setup` again")
	}
	if keyID != trust.KeyID {
		return nil, fmt.Errorf("bundle signed with key %q, but this machine trusts %q", keyID, trust.KeyID)
	}
	pub, err := base64.StdEncoding.DecodeString(trust.PublicKey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return nil, errors.New("the pinned Athena key is corrupt — run `sudo zaio setup` again")
	}
	raw, err := base64.StdEncoding.DecodeString(bundleB64)
	if err != nil {
		return nil, fmt.Errorf("bundle is not base64: %w", err)
	}
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil || !ed25519.Verify(pub, raw, sig) {
		return nil, ErrUntrusted
	}
	var b Bundle
	if err := json.Unmarshal(raw, &b); err != nil {
		return nil, fmt.Errorf("bundle is not valid JSON: %w", err)
	}
	if b.Format != 1 {
		return nil, fmt.Errorf("bundle format %d is newer than this agent understands — update the agent", b.Format)
	}
	if machineID != "" && b.MachineID != machineID {
		return nil, fmt.Errorf("bundle is for machine %s, not this one (%s)", b.MachineID, machineID)
	}
	if !b.ExpiresAt.IsZero() && now.After(b.ExpiresAt.Add(5*time.Minute)) {
		return nil, fmt.Errorf("bundle expired at %s", b.ExpiresAt.Format(time.RFC3339))
	}
	return &b, nil
}
