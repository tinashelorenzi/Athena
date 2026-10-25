package lockdown

import (
	"strings"
	"testing"
	"time"
)

// fakeSystemd models unit states and records commands.
type fakeSystemd struct {
	units map[string]*UnitState
	calls []string
	fail  string // a command prefix that fails
}

func (f *fakeSystemd) Show(unit string) (UnitState, error) {
	if u, ok := f.units[unit]; ok {
		return *u, nil
	}
	return UnitState{Unit: unit, LoadState: "not-found", ActiveState: "inactive"}, nil
}

func (f *fakeSystemd) Run(args ...string) error {
	cmd := strings.Join(args, " ")
	f.calls = append(f.calls, cmd)
	if f.fail != "" && strings.HasPrefix(cmd, f.fail) {
		return errFake
	}
	verb, names := args[0], args[1:]
	if verb == "mask" {
		names = args[2:] // mask --now …
	}
	for _, n := range names {
		u, ok := f.units[n]
		if !ok {
			continue
		}
		switch verb {
		case "mask":
			u.LoadState, u.UnitFileState, u.ActiveState = "masked", "masked", "inactive"
		case "unmask":
			u.LoadState, u.UnitFileState = "loaded", "disabled"
		case "enable":
			u.UnitFileState = "enabled"
		case "start":
			u.ActiveState = "active"
		}
	}
	return nil
}

type fakeErr struct{}

func (fakeErr) Error() string { return "boom" }

var errFake = fakeErr{}

func ubuntu2404() *fakeSystemd {
	return &fakeSystemd{units: map[string]*UnitState{
		"ssh.socket":  {Unit: "ssh.socket", LoadState: "loaded", ActiveState: "active", UnitFileState: "enabled"},
		"ssh.service": {Unit: "ssh.service", LoadState: "loaded", ActiveState: "inactive", UnitFileState: "disabled"},
	}}
}

func TestApplyUndoRestoresExactState(t *testing.T) {
	sd := ubuntu2404()
	m := &Manager{Dir: t.TempDir(), Systemd: sd}
	if _, err := m.Apply("s_1", time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if sd.units["ssh.socket"].ActiveState != "inactive" || sd.units["ssh.socket"].LoadState != "masked" {
		t.Fatalf("socket not locked: %+v", sd.units["ssh.socket"])
	}
	if len(m.List()) != 1 {
		t.Fatal("journal not written")
	}
	// Applying again (task retried) is a no-op.
	if _, err := m.Apply("s_1", time.Now().Add(time.Hour)); err != nil || strings.Count(strings.Join(sd.calls, "|"), "mask --now") != 1 {
		t.Fatalf("second apply should not re-mask: %v %v", err, sd.calls)
	}

	if err := m.Undo("s_1"); err != nil {
		t.Fatal(err)
	}
	sock, svc := sd.units["ssh.socket"], sd.units["ssh.service"]
	if sock.ActiveState != "active" || sock.UnitFileState != "enabled" {
		t.Fatalf("socket not restored: %+v", sock)
	}
	if svc.ActiveState != "inactive" || svc.UnitFileState != "disabled" {
		t.Fatalf("service should stay as it was (disabled, inactive): %+v", svc)
	}
	if len(m.List()) != 0 {
		t.Fatal("journal not removed")
	}
	if err := m.Undo("s_1"); err != nil {
		t.Fatalf("undo without journal must be a no-op: %v", err)
	}
}

func TestNoSSHServerInstalled(t *testing.T) {
	sd := &fakeSystemd{units: map[string]*UnitState{}}
	m := &Manager{Dir: t.TempDir(), Systemd: sd}
	j, err := m.Apply("s_2", time.Now().Add(time.Hour))
	if err != nil || len(j.SSH) != 0 || len(sd.calls) != 0 {
		t.Fatalf("nothing to lock: %v %+v %v", err, j, sd.calls)
	}
	if err := m.Undo("s_2"); err != nil {
		t.Fatal(err)
	}
}

func TestAlreadyMaskedStaysMasked(t *testing.T) {
	sd := ubuntu2404()
	sd.units["ssh.service"] = &UnitState{Unit: "ssh.service", LoadState: "masked", ActiveState: "inactive", UnitFileState: "masked"}
	m := &Manager{Dir: t.TempDir(), Systemd: sd}
	if _, err := m.Apply("s_3", time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := m.Undo("s_3"); err != nil {
		t.Fatal(err)
	}
	if sd.units["ssh.service"].LoadState != "masked" {
		t.Fatal("a unit the student had masked must stay masked")
	}
}

func TestFailedMaskRollsBack(t *testing.T) {
	sd := ubuntu2404()
	sd.fail = "mask"
	m := &Manager{Dir: t.TempDir(), Systemd: sd}
	if _, err := m.Apply("s_4", time.Now().Add(time.Hour)); err == nil {
		t.Fatal("want error")
	}
	if len(m.List()) != 0 {
		t.Fatal("journal should be rolled back")
	}
}

func TestUndoDue(t *testing.T) {
	sd := ubuntu2404()
	m := &Manager{Dir: t.TempDir(), Systemd: sd}
	now := time.Now()
	_, _ = m.Apply("past", now.Add(-time.Minute))
	_, _ = m.Apply("future", now.Add(time.Hour))
	if errs := m.UndoDue(now); len(errs) != 0 {
		t.Fatal(errs)
	}
	left := m.List()
	if len(left) != 1 || left[0].SessionID != "future" {
		t.Fatalf("only the overdue journal should be undone: %+v", left)
	}
	if _, err := m.Apply("../escape", now); err == nil {
		t.Fatal("unsafe session ids must be refused")
	}
}
