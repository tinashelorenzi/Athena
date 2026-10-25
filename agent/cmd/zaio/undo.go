package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"zaio/agent/internal/tasks"
)

// runUndo restores what session lockdowns changed (SSH). Without flags it
// undoes journals whose deadline has passed; --all undoes every one (also run
// by the package's prerm, so removing the agent never leaves SSH off).
func runUndo(args []string) error {
	fs := flag.NewFlagSet("undo", flag.ExitOnError)
	stateDir := fs.String("state-dir", tasks.DefaultStateDir, "where session state is kept")
	all := fs.Bool("all", false, "undo every open lockdown, even for sessions still running")
	session := fs.String("session", "", "undo one session's lockdown (used by the safety timer)")
	_ = fs.Parse(args)
	if os.Geteuid() != 0 {
		return errors.New("run it as root: sudo zaio undo")
	}
	m := tasks.NewLockdown(*stateDir, func(f string, a ...any) { fmt.Printf(f+"\n", a...) })
	open := m.List()
	switch {
	case *session != "":
		return m.Undo(*session)
	case len(open) == 0:
		fmt.Println("No session lockdown is open: SSH is as you left it.")
		return nil
	case *all:
		if errs := m.UndoAll(); len(errs) > 0 {
			return errors.Join(errs...)
		}
		return nil
	}
	if errs := m.UndoDue(time.Now()); len(errs) > 0 {
		return errors.Join(errs...)
	}
	if left := m.List(); len(left) > 0 {
		fmt.Printf("%d lockdown(s) belong to sessions that are still running; they end with the session.\n", len(left))
		fmt.Println("To restore SSH anyway (the session's instructor will see it): sudo zaio undo --all")
	}
	return nil
}
