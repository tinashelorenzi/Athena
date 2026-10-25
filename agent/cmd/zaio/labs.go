package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"

	"zaio/agent/internal/client"
	"zaio/agent/internal/config"
	"zaio/agent/internal/tasks"
)

func runLabs(args []string) error {
	fs := flag.NewFlagSet("labs", flag.ExitOnError)
	dir := fs.String("config-dir", config.DefaultDir, "where agent.json and machine.key live")
	_ = fs.Parse(args)
	if os.Geteuid() != 0 {
		return errors.New("run it as root: sudo zaio labs")
	}
	_, c, err := loadClient(*dir)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	res, err := c.Labs(ctx)
	if err != nil {
		return err
	}
	if len(res.Labs) == 0 {
		fmt.Println("No labs have been released to you yet.")
		return nil
	}
	fmt.Printf("%-20s %-11s %-44s %s\n", "LAB", "TYPE", "TITLE", "SESSION")
	for _, l := range res.Labs {
		state := "-"
		if l.ActiveStatus != nil {
			state = strings.ToLower(*l.ActiveStatus)
		}
		fmt.Printf("%-20s %-11s %-44s %s\n", l.Slug, strings.ToLower(l.Type), truncate(l.Title, 44), state)
	}
	fmt.Println("\nStart one with: sudo zaio start <lab>")
	return nil
}

// runSession handles `zaio start|check|end <lab>`.
func runSession(action string, args []string) error {
	fs := flag.NewFlagSet(action, flag.ExitOnError)
	dir := fs.String("config-dir", config.DefaultDir, "where agent.json and machine.key live")
	stateDir := fs.String("state-dir", tasks.DefaultStateDir, "where session state and lab files are kept")
	role := fs.String("role", "", "start: the lab role this machine fills (labs with several machines)")
	_ = fs.Parse(args)
	slug := fs.Arg(0)
	if slug == "" {
		return fmt.Errorf("which lab? usage: sudo zaio %s <lab>   (see: sudo zaio labs)", action)
	}
	if os.Geteuid() != 0 {
		return fmt.Errorf("run it as root: sudo zaio %s %s", action, slug)
	}
	cfg, c, err := loadClient(*dir)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	if err := tasks.EnsureTrust(ctx, c, cfg, *dir); err != nil {
		return fmt.Errorf("pinning Athena's key: %w", err)
	}
	runner := &tasks.Runner{Client: c, Config: cfg, StateDir: *stateDir, Lockdown: tasks.NewLockdown(*stateDir, nil)}

	var res *client.SessionResponse
	if action == "start" {
		fmt.Printf("Starting %s …\n", slug)
		res, err = c.StartSession(ctx, slug, *role)
		if client.IsCode(err, "session_running") {
			return fmt.Errorf("%w\n  Check your work: sudo zaio check %s   ·   finish: sudo zaio end %s", err, slug, slug)
		}
	} else {
		id, ferr := activeSession(ctx, c, slug)
		if ferr != nil {
			return ferr
		}
		if action == "check" {
			fmt.Println("Collecting your work …")
		} else {
			fmt.Println("Final check: collecting your work …")
		}
		res, err = c.SessionAction(ctx, id, action)
	}
	if err != nil {
		return err
	}

	// Run this machine's part now; other machines' daemons do theirs.
	runTasks(ctx, runner, res.Tasks)
	sessionID := res.Session.ID
	var runID string
	if action != "start" && len(res.Session.Runs) > 0 {
		runID = res.Session.Runs[0].ID
	}

	deadline := time.Now().Add(4 * time.Minute)
	for {
		view := res.Session
		if action == "start" && view.Status != "PREPARING" {
			return printStarted(view, slug)
		}
		if run := findRun(view, runID); action != "start" && run != nil && run.Status != "COLLECTING" {
			printRun(view, *run, slug)
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("still waiting on %s — is that machine on? Check progress on the lab page in Athena", strings.Join(view.WaitingOn, ", "))
		}
		select {
		case <-ctx.Done():
			return errors.New("stopped waiting (the session carries on in Athena)")
		case <-time.After(2 * time.Second):
		}
		res, err = c.Session(ctx, sessionID)
		if err != nil {
			return err
		}
		runTasks(ctx, runner, res.Tasks)
	}
}

func runTasks(ctx context.Context, r *tasks.Runner, list []client.Task) {
	for _, t := range list {
		if err := r.Execute(ctx, t); err != nil {
			fmt.Fprintln(os.Stderr, "zaio:", err)
		}
	}
}

func activeSession(ctx context.Context, c *client.Client, slug string) (string, error) {
	labs, err := c.Labs(ctx)
	if err != nil {
		return "", err
	}
	for _, l := range labs.Labs {
		if l.Slug == slug {
			if l.ActiveSessionID == nil {
				return "", fmt.Errorf("no session running for %s — start one: sudo zaio start %s", slug, slug)
			}
			return *l.ActiveSessionID, nil
		}
	}
	return "", fmt.Errorf("no lab called %q is available to you (see: sudo zaio labs)", slug)
}

func findRun(v client.SessionView, id string) *client.RunView {
	for i := range v.Runs {
		if v.Runs[i].ID == id {
			return &v.Runs[i]
		}
	}
	return nil
}

func printStarted(v client.SessionView, slug string) error {
	if v.Status != "ACTIVE" {
		note := ""
		if v.Note != nil {
			note = ": " + *v.Note
		}
		return fmt.Errorf("the session didn't start (%s%s)", strings.ToLower(v.Status), note)
	}
	fmt.Printf("\nSession started — the starting state of your machine%s is recorded.\n", plural(len(v.Machines)))
	if v.DeadlineAt != nil {
		fmt.Printf("Time limit: finish by %s.\n", v.DeadlineAt.Local().Format("15:04 Mon 2 Jan"))
	}
	fmt.Printf("\nDo the lab, then:\n  sudo zaio check %s    check your work so far\n  sudo zaio end %s      finish and get graded\n", slug, slug)
	return nil
}

func printRun(v client.SessionView, run client.RunView, slug string) {
	fmt.Println()
	if run.Status == "FAILED" {
		fmt.Println("The check couldn't complete.")
	}
	for _, p := range v.Problems {
		fmt.Println("  ! " + p)
	}
	if !run.Visible {
		fmt.Println("Your work was collected. Results appear once your instructor releases them.")
	} else {
		for _, ch := range run.Checks {
			mark := "FAIL"
			switch {
			case ch.Skipped:
				mark = "skip"
			case ch.Passed:
				mark = "PASS"
			}
			fmt.Printf("  %s  %-52s %3d/%d\n", mark, truncate(ch.Title, 52), ch.Points, ch.Max)
			if !ch.Passed && !ch.Skipped {
				for _, a := range ch.Assertions {
					if !a.Passed {
						fmt.Printf("        ✗ %s\n", a.Label)
					}
				}
				if ch.Reason != nil {
					fmt.Printf("        why: %s\n", *ch.Reason)
				}
				if ch.Hint != nil {
					fmt.Printf("        hint: %s\n", *ch.Hint)
				}
			}
		}
		if run.Score != nil && run.MaxScore != nil {
			fmt.Printf("\nScore %d/%d\n", *run.Score, *run.MaxScore)
		}
	}
	if run.Final {
		fmt.Println("Session finished. Results are also on the lab page in Athena.")
	} else if v.Practice.Allowed {
		fmt.Printf("Practice checks used: %d of %d. Finish with: sudo zaio end %s\n", v.Practice.Used, v.Practice.Max, slug)
	}
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
