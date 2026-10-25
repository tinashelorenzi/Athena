//go:build !linux

package main

// isTerminal: the agent only targets Linux; elsewhere (tests, dev builds) never prompt.
func isTerminal() bool { return false }
