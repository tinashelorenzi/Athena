package main

import (
	"context"
	"flag"
	"fmt"
	"time"

	"zaio/agent/internal/client"
	"zaio/agent/internal/config"
)

func runStatus(args []string) error {
	fs := flag.NewFlagSet("status", flag.ExitOnError)
	dir := fs.String("config-dir", config.DefaultDir, "where agent.json and machine.key live")
	_ = fs.Parse(args)

	cfg, c, err := loadClient(*dir)
	if err != nil {
		return err
	}
	fmt.Printf("Agent        %s (service: %s)\n", version, serviceState())
	fmt.Printf("Athena       %s\n", cfg.AthenaURL)
	fmt.Printf("Machine      %s  (%s)\n", cfg.Label, cfg.MachineID)
	fmt.Printf("Owner        %s <%s>\n", cfg.OwnerName, cfg.OwnerEmail)
	fmt.Printf("Key          %s\n", cfg.KeyFingerprint)
	if cfg.AthenaPublicKey != "" {
		fmt.Printf("Trusts       Athena key %s\n", cfg.AthenaKeyID)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	start := time.Now()
	me, err := c.Me(ctx)
	switch {
	case client.IsCode(err, "machine_revoked", "unknown_machine"):
		fmt.Println("Link         this machine is no longer linked — run `sudo zaio setup`")
		return nil
	case err != nil:
		fmt.Printf("Link         Athena unreachable: %v\n", err)
		return nil
	}
	rtt := time.Since(start)
	fmt.Printf("Link         OK (%s round trip), machine %s\n", rtt.Round(time.Millisecond), me.Machine.Status)
	if skew := time.Since(me.ServerTime) - rtt/2; skew > time.Minute || skew < -time.Minute {
		fmt.Printf("Clock        off by %s — fix with: sudo timedatectl set-ntp true\n", skew.Round(time.Second))
	}
	return nil
}
