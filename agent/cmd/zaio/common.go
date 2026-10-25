package main

import (
	"zaio/agent/internal/client"
	"zaio/agent/internal/config"
	"zaio/agent/internal/tasks"
)

// loadClient reads the enrolment and returns a signing client for it.
func loadClient(dir string) (*config.Config, *client.Client, error) {
	cfg, err := config.Load(dir)
	if err != nil {
		return nil, nil, err
	}
	key, err := config.LoadKey(dir)
	if err != nil {
		return nil, nil, err
	}
	c := client.New(cfg.AthenaURL, version)
	c.MachineID, c.Key, c.Capabilities = cfg.MachineID, key, tasks.Capabilities
	return cfg, c, nil
}
