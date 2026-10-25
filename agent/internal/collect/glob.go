package collect

import (
	"io/fs"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

// Never walked: virtual filesystems, and huge or irrelevant trees.
var skipDirs = map[string]bool{"/proc": true, "/sys": true, "/dev": true, "/run": true, "/snap": true}

const maxWalk = 100_000

func hasMeta(s string) bool { return strings.ContainsAny(s, "*?[") }

// Expand returns the regular files matching an absolute pattern, sorted.
// Supports * ? [..] within a path segment and ** for any number of
// directories. A pattern without wildcards matches itself if it's a file.
func Expand(pattern string, limit int) (files []string, truncated bool) {
	pattern = path.Clean(pattern)
	if !hasMeta(pattern) {
		if fi, err := statFile(pattern); err == nil && fi.Mode().IsRegular() {
			return []string{pattern}, false
		}
		return nil, false
	}
	segs := strings.Split(strings.TrimPrefix(pattern, "/"), "/")
	baseN := 0
	for baseN < len(segs) && !hasMeta(segs[baseN]) {
		baseN++
	}
	base := "/" + strings.Join(segs[:baseN], "/")
	rest := segs[baseN:]

	walked := 0
	_ = filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // unreadable: skip
		}
		walked++
		if walked > maxWalk {
			truncated = true
			return filepath.SkipAll
		}
		if d.IsDir() {
			if skipDirs[p] && p != base {
				return filepath.SkipDir
			}
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(filepath.ToSlash(p), base), "/")
		if matchSegs(rest, strings.Split(rel, "/")) {
			if len(files) >= limit {
				truncated = true
				return filepath.SkipAll
			}
			files = append(files, filepath.ToSlash(p))
		}
		return nil
	})
	sort.Strings(files)
	return files, truncated
}

// matchSegs matches path segments against pattern segments; "**" matches zero or more segments.
func matchSegs(pat, p []string) bool {
	if len(pat) == 0 {
		return len(p) == 0
	}
	if pat[0] == "**" {
		for i := 0; i <= len(p); i++ {
			if matchSegs(pat[1:], p[i:]) {
				return true
			}
		}
		return false
	}
	if len(p) == 0 {
		return false
	}
	if ok, _ := path.Match(pat[0], p[0]); !ok {
		return false
	}
	return matchSegs(pat[1:], p[1:])
}
