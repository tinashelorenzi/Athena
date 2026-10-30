// Package lockdown applies a lab's session lockdown (SSH off) and reliably
// undoes it (docs/labs/spec.md 9.3). Every change is written to an undo
// journal first, so it can be reverted by Athena's UNDO task, by the daemon's
// safety check once the deadline has passed, by a systemd timer if the daemon
// is gone, by `zaio undo`, or when the package is removed.
package lockdown

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// SSHUnits are the units that can accept SSH logins. Ubuntu 24.04 starts sshd
// through ssh.socket; 22.04 and Kali run ssh.service directly (Kali ships it
// disabled). Both are handled, and a unit that doesn't exist is skipped.
var SSHUnits = []string{"ssh.socket", "ssh.service"}

// Systemd is the slice of systemctl the lockdown needs (faked in tests).
type Systemd interface {
	Show(unit string) (UnitState, error)
	Run(args ...string) error
}

type UnitState struct {
	Unit          string `json:"unit"`
	LoadState     string `json:"loadState"`     // loaded | not-found | masked
	ActiveState   string `json:"activeState"`   // active | inactive | …
	UnitFileState string `json:"unitFileState"` // enabled | disabled | static | masked | …
}

// Journal records what a session changed and when it must be undone at the latest.
type Journal struct {
	SessionID string      `json:"sessionId"`
	CreatedAt time.Time   `json:"createdAt"`
	UndoAt    time.Time   `json:"undoAt"`
	SSH       []UnitState `json:"ssh"` // state before lockdown
}

type Manager struct {
	Dir     string // e.g. /var/lib/zaio/journal
	Systemd Systemd
	// Exe is this binary, for the systemd safety timer (empty = no timer).
	Exe  string
	Logf func(string, ...any)
}

func (m *Manager) logf(f string, a ...any) {
	if m.Logf != nil {
		m.Logf(f, a...)
	}
}

var safeID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

func (m *Manager) path(sessionID string) string {
	return filepath.Join(m.Dir, sessionID+".json")
}

// Apply records the current SSH state, then stops and masks every SSH unit
// that exists. The journal is written before anything changes.
func (m *Manager) Apply(sessionID string, undoAt time.Time) (*Journal, error) {
	if !safeID.MatchString(sessionID) {
		return nil, fmt.Errorf("bad session id %q", sessionID)
	}
	if existing, err := m.Load(sessionID); err == nil {
		return existing, nil // already locked for this session (task retried)
	}
	j := &Journal{SessionID: sessionID, CreatedAt: time.Now().UTC(), UndoAt: undoAt.UTC()}
	for _, u := range SSHUnits {
		st, err := m.Systemd.Show(u)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", u, err)
		}
		if st.LoadState == "not-found" {
			continue
		}
		j.SSH = append(j.SSH, st)
	}
	if err := m.save(j); err != nil {
		return nil, fmt.Errorf("writing the undo journal: %w", err)
	}
	if len(j.SSH) > 0 {
		args := []string{"mask", "--now"}
		for _, u := range j.SSH {
			args = append(args, u.Unit)
		}
		if err := m.Systemd.Run(args...); err != nil {
			// Leave nothing half-done.
			_ = m.Undo(sessionID)
			return nil, fmt.Errorf("turning SSH off: %w", err)
		}
	}
	m.armTimer(j)
	m.logf("lockdown for session %s: SSH off (%s) until it ends, at the latest %s", sessionID, unitNames(j.SSH), j.UndoAt.Format(time.RFC3339))
	return j, nil
}

// Undo restores what Apply changed and removes the journal. Missing journal = nothing to do.
func (m *Manager) Undo(sessionID string) error {
	j, err := m.Load(sessionID)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var problems []string
	if len(j.SSH) > 0 {
		args := []string{"unmask"}
		for _, u := range j.SSH {
			if u.LoadState != "masked" && u.UnitFileState != "masked" {
				args = append(args, u.Unit)
			}
		}
		if len(args) > 1 {
			if err := m.Systemd.Run(args...); err != nil {
				problems = append(problems, err.Error())
			}
		}
		// Socket before service, so the socket is listening when the service is wanted.
		for _, u := range j.SSH {
			if u.UnitFileState == "enabled" {
				if err := m.Systemd.Run("enable", u.Unit); err != nil {
					problems = append(problems, err.Error())
				}
			}
		}
		for _, u := range j.SSH {
			if u.ActiveState == "active" {
				if err := m.Systemd.Run("start", u.Unit); err != nil {
					problems = append(problems, err.Error())
				}
			}
		}
	}
	if len(problems) > 0 {
		return fmt.Errorf("restoring SSH: %s", strings.Join(problems, "; "))
	}
	m.disarmTimer(sessionID)
	if err := os.Remove(m.path(sessionID)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	m.logf("lockdown for session %s undone: SSH restored (%s)", sessionID, unitNames(j.SSH))
	return nil
}

// UndoDue undoes every journal past its UndoAt (the daemon's safety net).
func (m *Manager) UndoDue(now time.Time) []error {
	var errs []error
	for _, j := range m.List() {
		if now.After(j.UndoAt) {
			m.logf("session %s passed its deadline without being closed: undoing its lockdown", j.SessionID)
			if err := m.Undo(j.SessionID); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errs
}

// UndoAll reverts every journal (package removal, `zaio undo --all`).
func (m *Manager) UndoAll() []error {
	var errs []error
	for _, j := range m.List() {
		if err := m.Undo(j.SessionID); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}

func (m *Manager) Load(sessionID string) (*Journal, error) {
	b, err := os.ReadFile(m.path(sessionID))
	if err != nil {
		return nil, err
	}
	var j Journal
	if err := json.Unmarshal(b, &j); err != nil {
		return nil, fmt.Errorf("journal for %s is corrupt: %w", sessionID, err)
	}
	return &j, nil
}

// List returns every open journal, oldest first.
func (m *Manager) List() []Journal {
	entries, _ := os.ReadDir(m.Dir)
	var out []Journal
	for _, e := range entries {
		id, ok := strings.CutSuffix(e.Name(), ".json")
		if !ok || !safeID.MatchString(id) {
			continue
		}
		if j, err := m.Load(id); err == nil {
			out = append(out, *j)
		}
	}
	sort.Slice(out, func(a, b int) bool { return out[a].CreatedAt.Before(out[b].CreatedAt) })
	return out
}

func (m *Manager) save(j *Journal) error {
	if err := os.MkdirAll(m.Dir, 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	tmp := m.path(j.SessionID) + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, m.path(j.SessionID))
}

// timerUnit names the transient systemd timer that undoes a session if the daemon can't.
func timerUnit(sessionID string) string {
	return "zaio-undo-" + strings.ToLower(sessionID)
}

// armTimer schedules `zaio undo --session <id>` at UndoAt via systemd, as a
// backstop for a dead daemon. Best effort: the daemon's own check covers the rest.
func (m *Manager) armTimer(j *Journal) {
	if m.Exe == "" {
		return
	}
	at := j.UndoAt.UTC().Format("2006-01-02 15:04:05") + " UTC"
	cmd := exec.Command("systemd-run", "--unit="+timerUnit(j.SessionID), "--on-calendar="+at, "--timer-property=AccuracySec=1min",
		"--description=Athena Labs: undo session lockdown if still active", m.Exe, "undo", "--session", j.SessionID)
	if out, err := cmd.CombinedOutput(); err != nil {
		m.logf("safety timer not set (%v: %s); the daemon will still undo at %s", err, strings.TrimSpace(string(out)), at)
	}
}

func (m *Manager) disarmTimer(sessionID string) {
	if m.Exe == "" {
		return
	}
	_ = m.Systemd.Run("stop", timerUnit(sessionID)+".timer")
}

func unitNames(us []UnitState) string {
	if len(us) == 0 {
		return "no SSH server installed"
	}
	names := make([]string, len(us))
	for i, u := range us {
		names[i] = u.Unit
	}
	return strings.Join(names, ", ")
}

// ── Real systemctl ──────────────────────────────────────────────────────────

type Systemctl struct{}

func (Systemctl) Show(unit string) (UnitState, error) {
	out, err := exec.Command("systemctl", "show", unit, "--property=LoadState,ActiveState,UnitFileState").Output()
	if err != nil {
		return UnitState{}, err
	}
	st := UnitState{Unit: unit}
	for _, line := range strings.Split(string(out), "\n") {
		k, v, _ := strings.Cut(strings.TrimSpace(line), "=")
		switch k {
		case "LoadState":
			st.LoadState = v
		case "ActiveState":
			st.ActiveState = v
		case "UnitFileState":
			st.UnitFileState = v
		}
	}
	return st, nil
}

func (Systemctl) Run(args ...string) error {
	out, err := exec.Command("systemctl", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("systemctl %s: %s", strings.Join(args, " "), strings.TrimSpace(string(out)))
	}
	return nil
}
