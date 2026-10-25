package collect

import (
	"path/filepath"
	"regexp"
	"strings"
)

/*
Paths the agent never reads, whatever a bundle asks for (docs/labs/spec.md
9.4): its own key, password hashes, SSH host and user private keys. Checked
after resolving symlinks, so a link can't smuggle them out. Defence in depth —
it protects a student's secrets from a mistaken lab.
*/

var deniedExact = map[string]bool{
	"/etc/zaio/machine.key": true,
	"/etc/shadow":           true,
	"/etc/shadow-":          true,
	"/etc/gshadow":          true,
	"/etc/gshadow-":         true,
}

var deniedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`^/etc/ssh/ssh_host_[^/]*_key$`),
	regexp.MustCompile(`/\.ssh/id_[^/]*$`),
	regexp.MustCompile(`^/root/\.ssh/`),
}

// Resolve follows symlinks (when the path exists) for the policy check.
func Resolve(p string) string {
	if r, err := filepath.EvalSymlinks(p); err == nil {
		return filepath.ToSlash(r)
	}
	return filepath.ToSlash(filepath.Clean(p))
}

// Denied reports whether the agent must refuse to read this (resolved) path.
func Denied(resolved string) bool {
	if deniedExact[resolved] {
		return true
	}
	for _, re := range deniedPatterns {
		if re.MatchString(resolved) && !strings.HasSuffix(resolved, ".pub") {
			return true
		}
	}
	return false
}
