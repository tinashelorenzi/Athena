package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"zaio/agent/internal/client"
	"zaio/agent/internal/config"
	"zaio/agent/internal/tasks"
)

// runDaemon is the background agent: it long-polls Athena for tasks (which is
// also its heartbeat) and runs them one at a time.
func runDaemon(args []string) error {
	fs := flag.NewFlagSet("daemon", flag.ExitOnError)
	dir := fs.String("config-dir", config.DefaultDir, "where agent.json and machine.key live")
	stateDir := fs.String("state-dir", tasks.DefaultStateDir, "where session state and lab files are kept")
	_ = fs.Parse(args)

	logger := log.New(os.Stderr, "", 0) // journald adds timestamps
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, c, err := loadClient(*dir)
	if err != nil {
		return err
	}
	locks := tasks.NewLockdown(*stateDir, logger.Printf)
	runner := &tasks.Runner{Client: c, Config: cfg, StateDir: *stateDir, Lockdown: locks, Logf: logger.Printf}
	if open := locks.List(); len(open) > 0 {
		logger.Printf("%d session lockdown(s) open; each is undone when its session ends, or at its deadline at the latest", len(open))
	}
	logger.Printf("zaio %s: polling %s as %s (%s)", version, cfg.AthenaURL, cfg.MachineID, cfg.Label)

	backoff := 5 * time.Second
	down := false
	for {
		// Safety net: a lockdown whose deadline passed is undone even if Athena is unreachable.
		for _, err := range locks.UndoDue(time.Now()) {
			logger.Printf("undoing an overdue lockdown failed: %v (retrying next loop; run `sudo zaio undo --all` by hand if it persists)", err)
		}
		if cfg.AthenaPublicKey == "" {
			if err := tasks.EnsureTrust(ctx, c, cfg, *dir); err != nil {
				logger.Printf("could not pin Athena's bundle key yet: %v", err)
			} else {
				logger.Printf("pinned Athena bundle key %s", cfg.AthenaKeyID)
			}
		}
		var wait time.Duration
		res, err := c.Tasks(ctx, 25)
		switch {
		case ctx.Err() != nil:
			logger.Printf("stopping")
			return nil
		case client.IsCode(err, "machine_revoked", "unknown_machine"):
			logger.Printf("Athena no longer recognises this machine (%v). Run `sudo zaio setup`; checking again in 10 minutes.", err)
			wait = 10 * time.Minute
		case client.IsCode(err, "clock_skew"):
			logger.Printf("%v", err)
			wait = time.Minute
		case err != nil:
			if !down {
				logger.Printf("poll failed: %v (retrying with backoff)", err)
			}
			down, wait = true, backoff
			backoff = min(backoff*2, 5*time.Minute)
		default:
			if down {
				logger.Printf("Athena reachable again")
			}
			down, backoff = false, 5*time.Second
			for _, t := range res.Tasks {
				if err := runner.Execute(ctx, t); err != nil {
					logger.Printf("%v", err)
				}
			}
			if skew := time.Since(res.ServerTime); skew > 2*time.Minute || skew < -2*time.Minute {
				logger.Printf("clock is off by %s; signed requests fail beyond 5 minutes (sudo timedatectl set-ntp true)", skew.Round(time.Second))
			}
			wait = time.Duration(min(max(res.PollAfter, 1), 300)) * time.Second
		}
		select {
		case <-ctx.Done():
			logger.Printf("stopping")
			return nil
		case <-time.After(wait):
		}
	}
}
