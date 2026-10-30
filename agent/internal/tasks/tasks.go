// Package tasks runs the signed task bundles Athena queues for this machine
// (docs/labs/spec.md section 8): BASELINE at session start, COLLECT for every
// check. Used by both the daemon and the CLI.
package tasks

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"zaio/agent/internal/bundle"
	"zaio/agent/internal/client"
	"zaio/agent/internal/collect"
	"zaio/agent/internal/config"
	"zaio/agent/internal/lockdown"
	"zaio/agent/internal/sysinfo"
)

// Capabilities this build implements (reported to Athena; labs needing more are refused).
var Capabilities = []string{"baseline", "file", "glob", "run", "service", "package", "log", "ssh_lockdown"}

const (
	DefaultStateDir = "/var/lib/zaio"
	taskTimeout     = 5 * time.Minute
)

type Runner struct {
	Client   *client.Client
	Config   *config.Config
	StateDir string
	Lockdown *lockdown.Manager
	Logf     func(format string, args ...any)
}

// NewLockdown is the lockdown manager for a state dir (journals in <state>/journal).
func NewLockdown(stateDir string, logf func(string, ...any)) *lockdown.Manager {
	exe, _ := os.Executable()
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return &lockdown.Manager{Dir: filepath.Join(stateDir, "journal"), Systemd: lockdown.Systemctl{}, Exe: exe, Logf: logf}
}

func (r *Runner) logf(format string, args ...any) {
	if r.Logf != nil {
		r.Logf(format, args...)
	}
}

// Execute verifies one task, runs it and reports the result to Athena. A task
// that fails verification is reported as failed (never run).
func (r *Runner) Execute(ctx context.Context, t client.Task) error {
	ctx, cancel := context.WithTimeout(ctx, taskTimeout)
	defer cancel()
	b, err := bundle.Verify(t.Bundle, t.Sig, t.KeyID, bundle.Trust{KeyID: r.Config.AthenaKeyID, PublicKey: r.Config.AthenaPublicKey}, r.Config.MachineID, time.Now())
	if err != nil {
		r.logf("task %s refused: %v", t.TaskID, err)
		return r.report(ctx, t.TaskID, failure("untrusted", err))
	}
	if b.TaskID != t.TaskID {
		return r.report(ctx, t.TaskID, failure("untrusted", fmt.Errorf("bundle is for task %s", b.TaskID)))
	}
	r.logf("task %s: %s for %s v%d (role %s)", b.TaskID, strings.ToLower(b.Kind), b.Lab.Slug, b.Lab.Version, b.Role)

	var result map[string]any
	switch b.Kind {
	case "BASELINE":
		result, err = r.baseline(b)
	case "COLLECT":
		result, err = r.collect(ctx, b)
	case "UNDO":
		err = r.Lockdown.Undo(b.SessionID)
		result = map[string]any{"ok": true, "undone": true}
	default:
		err = fmt.Errorf("this agent version can't run %s tasks — update it", b.Kind)
	}
	if err != nil {
		r.logf("task %s failed: %v", b.TaskID, err)
		result = failure("failed", err)
	}
	return r.report(ctx, b.TaskID, result)
}

func failure(code string, err error) map[string]any {
	return map[string]any{"ok": false, "error": code, "message": err.Error()}
}

func (r *Runner) report(ctx context.Context, taskID string, body map[string]any) error {
	if err := r.Client.Result(ctx, taskID, body); err != nil {
		return fmt.Errorf("reporting task %s: %w", taskID, err)
	}
	return nil
}

// ── BASELINE ────────────────────────────────────────────────────────────────

type sessionState struct {
	SessionID string                       `json:"sessionId"`
	Logs      map[string]collect.LogOffset `json:"logs"`
	TakenAt   time.Time                    `json:"takenAt"`
}

func (r *Runner) statePath(sessionID string) string {
	return filepath.Join(r.StateDir, "sessions", filepath.Base(sessionID)+".json")
}

func (r *Runner) baseline(b *bundle.Bundle) (map[string]any, error) {
	if b.Lockdown != nil && b.Lockdown.SSH != "off" {
		return nil, fmt.Errorf("unknown lockdown %q — update the agent", b.Lockdown.SSH)
	}
	var hash, logs []string
	if b.Baseline != nil {
		hash, logs = b.Baseline.Hash, b.Baseline.Logs
	}
	base := collect.TakeBaseline(hash, logs)
	// Keep log offsets locally: `log` collectors read from them later in the session.
	st := sessionState{SessionID: b.SessionID, Logs: base.Logs, TakenAt: time.Now().UTC()}
	if err := writeJSON(r.statePath(b.SessionID), st, 0o600); err != nil {
		return nil, fmt.Errorf("saving session state: %w", err)
	}
	result := map[string]any{"ok": true, "files": base.Files, "logs": base.Logs, "bootId": base.BootID, "clock": base.Clock, "truncated": base.Truncated}
	if b.Lockdown != nil {
		// Last: the baseline is recorded before anything is changed.
		undoAt := time.Now().Add(12 * time.Hour)
		if b.UndoAt != nil {
			undoAt = *b.UndoAt
		}
		j, err := r.Lockdown.Apply(b.SessionID, undoAt)
		if err != nil {
			return nil, err
		}
		result["lockdown"] = map[string]any{"ssh": "off", "units": j.SSH, "undoAt": j.UndoAt}
	}
	return result, nil
}

// ── COLLECT ─────────────────────────────────────────────────────────────────

func (r *Runner) collect(ctx context.Context, b *bundle.Bundle) (map[string]any, error) {
	for _, a := range b.Assets {
		if err := r.fetchAsset(ctx, a); err != nil {
			return nil, fmt.Errorf("lab file %s: %w", a.Name, err)
		}
	}
	var st sessionState
	_ = readJSON(r.statePath(b.SessionID), &st) // missing state: logs are read from the start

	items := map[string]any{}
	for _, step := range b.Steps {
		for _, e := range step.Gather {
			items[e.Name] = r.gather(ctx, e.Item, st)
		}
	}
	info := sysinfo.Collect("")
	out := map[string]any{"ok": true, "machine": map[string]string{"hostname": info.Hostname, "os": info.OS, "osVersion": info.OSVersion}, "items": items}
	if b.Lockdown != nil {
		out["lockdown"] = r.lockdownStatus(b.SessionID, st)
	}
	return out, nil
}

func (r *Runner) gather(ctx context.Context, it bundle.Item, st sessionState) map[string]any {
	switch it.Kind {
	case "file":
		return collect.File(it.Path, it.MaxBytes, true)
	case "glob":
		return collect.Glob(it.Pattern, it.Content, it.MaxFiles)
	case "run":
		return collect.Run(ctx, it.Argv, time.Duration(it.Timeout)*time.Second, it.Stdin, it.Cwd)
	case "service":
		return collect.Service(ctx, it.Unit)
	case "package":
		return collect.Package(ctx, it.Names)
	case "log":
		var since *collect.LogOffset
		if off, ok := st.Logs[it.Path]; ok {
			since = &off
		}
		return collect.Log(it.Path, since)
	}
	return map[string]any{"ok": false, "error": "unsupported", "message": "this agent version doesn't know " + it.Kind + " — update it"}
}

// lockdownStatus reports whether the session's lockdown still holds: SSH unit
// states, live SSH sessions, and SSH logins in auth.log since the baseline.
// Athena turns these into instructor flags (SSH_DURING_LOCKDOWN, LOCKDOWN_TAMPERED).
func (r *Runner) lockdownStatus(sessionID string, st sessionState) map[string]any {
	units := []lockdown.UnitState{}
	for _, u := range lockdown.SSHUnits {
		if s, err := (lockdown.Systemctl{}).Show(u); err == nil && s.LoadState != "not-found" {
			units = append(units, s)
		}
	}
	_, journalErr := r.Lockdown.Load(sessionID)
	logins := []string{}
	var since *collect.LogOffset
	if off, ok := st.Logs[authLog]; ok {
		since = &off
	}
	var text string
	if l := collect.Log(authLog, since); l["ok"] == true && l["exists"] == true {
		text = fmt.Sprint(l["content"])
	} else if !st.TakenAt.IsZero() {
		// No rsyslog (minimal installs): sshd logs only to the journal.
		r := collect.Run(context.Background(), []string{"journalctl", "--no-pager", "-o", "short-iso", "--since", "@" + fmt.Sprint(st.TakenAt.Unix()), "-u", "ssh.service", "-u", "ssh.socket", "_COMM=sshd"}, 20*time.Second, nil, "")
		text = fmt.Sprint(r["stdout"])
	}
	for _, line := range strings.Split(text, "\n") {
		if strings.Contains(line, "sshd") && strings.Contains(line, "Accepted ") {
			logins = append(logins, line)
		}
	}
	if len(logins) > 20 {
		logins = logins[len(logins)-20:]
	}
	return map[string]any{"units": units, "journal": journalErr == nil, "sshSessions": collect.SSHSessions(), "logins": logins}
}

const authLog = "/var/log/auth.log"

// fetchAsset downloads a lab file once, verifying its hash against the signed bundle.
func (r *Runner) fetchAsset(ctx context.Context, a bundle.Asset) error {
	assetRoot := filepath.Join(r.StateDir, "assets") + string(filepath.Separator)
	dest := filepath.Clean(a.Path)
	if !strings.HasPrefix(dest, assetRoot) {
		return fmt.Errorf("refusing to write outside %s", assetRoot)
	}
	if sum, err := fileSHA(dest); err == nil && sum == a.SHA256 {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dest), ".download-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	h := sha256.New()
	if err := r.Client.Download(ctx, a.URL, io.MultiWriter(tmp, h)); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != a.SHA256 {
		return fmt.Errorf("downloaded file doesn't match its signed hash (got %s…)", got[:12])
	}
	if err := os.Chmod(tmp.Name(), 0o644); err != nil {
		return err
	}
	r.logf("downloaded %s (%d bytes)", a.Name, a.Size)
	return os.Rename(tmp.Name(), dest)
}

func fileSHA(p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func writeJSON(p string, v any, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, mode); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func readJSON(p string, v any) error {
	b, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// EnsureTrust pins Athena's bundle key if this machine was enrolled before
// bundle signing existed (trust on first use, over TLS — like the enrolment).
func EnsureTrust(ctx context.Context, c *client.Client, cfg *config.Config, dir string) error {
	if cfg.AthenaPublicKey != "" {
		return nil
	}
	me, err := c.Me(ctx)
	if err != nil {
		return err
	}
	if me.Athena.PublicKey == "" {
		return errors.New("Athena didn't send its bundle key — is it up to date?")
	}
	cfg.AthenaKeyID, cfg.AthenaPublicKey = me.Athena.KeyID, me.Athena.PublicKey
	return config.Save(dir, cfg)
}
