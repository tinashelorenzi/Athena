//go:build !linux

package collect

// SSHSessions is Linux-only; elsewhere there are none to count.
func SSHSessions() int { return 0 }
