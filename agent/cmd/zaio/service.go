package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	packagedUnit = "/lib/systemd/system/zaio.service" // shipped by the .deb (M4)
	localUnit    = "/etc/systemd/system/zaio.service" // written by setup otherwise
)

const unitTemplate = `[Unit]
Description=Athena Labs agent (zaio)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=%s daemon
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
`

// installService makes sure zaio.service exists, is enabled, and is running
// with the new enrolment. Returns a one-line status for the setup summary.
func installService() string {
	if _, err := os.Stat("/run/systemd/system"); err != nil {
		return "not started (systemd isn't running here) — start it with: zaio daemon"
	}
	if _, err := os.Stat(packagedUnit); err != nil {
		exe, err := os.Executable()
		if err != nil {
			return "not installed: " + err.Error()
		}
		if resolved, err := filepath.EvalSymlinks(exe); err == nil {
			exe = resolved
		}
		if err := os.WriteFile(localUnit, []byte(fmt.Sprintf(unitTemplate, exe)), 0o644); err != nil {
			return "not installed: " + err.Error()
		}
	}
	for _, args := range [][]string{{"daemon-reload"}, {"enable", "zaio.service"}, {"restart", "zaio.service"}} {
		if out, err := exec.Command("systemctl", args...).CombinedOutput(); err != nil {
			return fmt.Sprintf("systemctl %s failed: %s", strings.Join(args, " "), strings.TrimSpace(string(out)))
		}
	}
	return "running (systemctl status zaio)"
}

func serviceState() string {
	out, _ := exec.Command("systemctl", "is-active", "zaio.service").Output()
	if state := strings.TrimSpace(string(out)); state != "" {
		return state
	}
	return "unknown"
}
