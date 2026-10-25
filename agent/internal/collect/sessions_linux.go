package collect

import (
	"os"
	"path/filepath"
	"strings"
)

// SSHSessions counts live SSH login sessions: sshd's per-connection
// processes ("sshd: user@pts/0", or sshd-session on newer OpenSSH).
func SSHSessions() int {
	n := 0
	procs, _ := filepath.Glob("/proc/[0-9]*/cmdline")
	for _, p := range procs {
		b, err := os.ReadFile(p)
		if err != nil || len(b) == 0 {
			continue
		}
		arg0 := strings.SplitN(string(b), "\x00", 2)[0]
		if (strings.HasPrefix(arg0, "sshd: ") || strings.HasPrefix(arg0, "sshd-session: ")) && strings.Contains(arg0, "@") {
			n++
		}
	}
	return n
}
