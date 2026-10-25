// Package collect implements the agent's collector primitives and the session
// baseline (docs/labs/spec.md 9.3–9.4). Every primitive returns a result map:
// {"ok": true, …fields} or {"ok": false, "error": code, "message": text}.
// Collectors only read; the only commands they run are those in the signed
// bundle (argv, never a shell) plus systemctl/dpkg-query for service/package.
package collect

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

type Result = map[string]any

const (
	DefaultMaxBytes = 256 * 1024
	MaxOutput       = 256 * 1024
	DefaultMaxFiles = 200
	DefaultTimeout  = 10 * time.Second
	MaxTimeout      = 120 * time.Second
)

// Env is the scrubbed environment commands run with.
var Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C.UTF-8", "LC_ALL=C.UTF-8"}

func fail(code, format string, args ...any) Result {
	return Result{"ok": false, "error": code, "message": fmt.Sprintf(format, args...)}
}

// textFields puts bytes into "content" when they're UTF-8, else "content_b64".
func textFields(r Result, key string, b []byte) {
	if utf8.Valid(b) {
		r[key] = string(b)
	} else {
		r[key+"_b64"] = base64.StdEncoding.EncodeToString(b)
	}
}

func hashFile(p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// File reads one file (exists:false when it isn't there — that is a result, not an error).
func File(path string, maxBytes int, withContent bool) Result {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxBytes
	}
	resolved := Resolve(path)
	if Denied(resolved) {
		return fail("denied", "%s is never collected (private keys and password hashes stay on the machine)", path)
	}
	fi, err := os.Stat(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Result{"ok": true, "exists": false, "path": path}
	}
	if errors.Is(err, fs.ErrPermission) {
		return fail("denied", "permission denied reading %s", path)
	}
	if err != nil {
		return fail("not_found", "%s: %v", path, err)
	}
	if fi.IsDir() {
		return fail("not_found", "%s is a directory", path)
	}
	user, group := owner(fi)
	r := Result{
		"ok": true, "exists": true, "path": path, "size": fi.Size(),
		"mode":  fmt.Sprintf("%04o", fi.Mode().Perm()|fi.Mode()&fs.ModeSetuid|fi.Mode()&fs.ModeSetgid|fi.Mode()&fs.ModeSticky),
		"owner": user, "group": group, "mtime": fi.ModTime().UTC().Format(time.RFC3339),
	}
	sum, err := hashFile(path)
	if err != nil {
		return fail("denied", "%s: %v", path, err)
	}
	r["sha256"] = sum
	if withContent {
		f, err := os.Open(path)
		if err != nil {
			return fail("denied", "%s: %v", path, err)
		}
		defer f.Close()
		buf, _ := io.ReadAll(io.LimitReader(f, int64(maxBytes)+1))
		r["truncated"] = len(buf) > maxBytes
		if len(buf) > maxBytes {
			buf = buf[:maxBytes]
		}
		textFields(r, "content", buf)
	}
	return r
}

// Glob returns file results for every match (contents only when asked).
func Glob(pattern string, withContent bool, maxFiles int) Result {
	if maxFiles <= 0 {
		maxFiles = DefaultMaxFiles
	}
	paths, truncated := Expand(pattern, maxFiles)
	files := make([]Result, 0, len(paths))
	for _, p := range paths {
		if Denied(Resolve(p)) {
			continue
		}
		files = append(files, File(p, DefaultMaxBytes, withContent))
	}
	return Result{"ok": true, "pattern": pattern, "files": files, "truncated": truncated}
}

// capWriter keeps the first n bytes and remembers whether more arrived.
type capWriter struct {
	buf bytes.Buffer
	n   int
	cut bool
}

func (w *capWriter) Write(p []byte) (int, error) {
	if room := w.n - w.buf.Len(); room > 0 {
		if len(p) > room {
			w.buf.Write(p[:room])
			w.cut = true
		} else {
			w.buf.Write(p)
		}
	} else if len(p) > 0 {
		w.cut = true
	}
	return len(p), nil
}

// Run executes argv directly (no shell) with a scrubbed environment.
func Run(ctx context.Context, argv []string, timeout time.Duration, stdin *string, cwd string) Result {
	if len(argv) == 0 {
		return fail("unsupported", "empty command")
	}
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	if timeout > MaxTimeout {
		timeout = MaxTimeout
	}
	bin, err := exec.LookPath(argv[0])
	if err != nil {
		// LookPath uses our PATH; try the scrubbed one too.
		for _, dir := range []string{"/usr/sbin", "/usr/bin", "/sbin", "/bin", "/usr/local/sbin", "/usr/local/bin"} {
			if fi, e := os.Stat(dir + "/" + argv[0]); e == nil && !fi.IsDir() {
				bin, err = dir+"/"+argv[0], nil
				break
			}
		}
		if err != nil {
			return fail("not_found", "command not found: %s", argv[0])
		}
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, argv[1:]...)
	cmd.Env = Env
	cmd.Dir = "/"
	if cwd != "" {
		cmd.Dir = cwd
	}
	if stdin != nil {
		cmd.Stdin = strings.NewReader(*stdin)
	}
	stdout, stderr := &capWriter{n: MaxOutput}, &capWriter{n: MaxOutput}
	cmd.Stdout, cmd.Stderr = stdout, stderr
	cmd.WaitDelay = 2 * time.Second
	start := time.Now()
	err = cmd.Run()
	r := Result{
		"ok": true, "exit_code": cmd.ProcessState.ExitCode(), "duration_ms": time.Since(start).Milliseconds(),
		"timed_out": false, "truncated": stdout.cut || stderr.cut,
	}
	if ctx.Err() == context.DeadlineExceeded {
		r = fail("timeout", "%s took longer than %s", argv[0], timeout)
		r["timed_out"] = true
	} else if err != nil {
		var exitErr *exec.ExitError
		if !errors.As(err, &exitErr) {
			return fail("not_found", "%s: %v", argv[0], err)
		}
	}
	textFields(r, "stdout", stdout.buf.Bytes())
	textFields(r, "stderr", stderr.buf.Bytes())
	return r
}

// Service reports a systemd unit's state.
func Service(ctx context.Context, unit string) Result {
	r := Run(ctx, []string{"systemctl", "show", unit, "--property=LoadState,ActiveState,SubState,UnitFileState"}, 10*time.Second, nil, "")
	if r["ok"] != true {
		return r
	}
	kv := map[string]string{}
	for _, line := range strings.Split(fmt.Sprint(r["stdout"]), "\n") {
		if k, v, ok := strings.Cut(strings.TrimSpace(line), "="); ok {
			kv[k] = v
		}
	}
	return Result{
		"ok": true, "unit": unit, "load_state": kv["LoadState"], "active_state": kv["ActiveState"],
		"sub_state": kv["SubState"], "unit_file_state": kv["UnitFileState"],
	}
}

// Package reports which of the named Debian packages are installed, and their versions.
func Package(ctx context.Context, names []string) Result {
	argv := append([]string{"dpkg-query", "-W", "-f=${Package}\t${Version}\t${db:Status-Status}\n"}, names...)
	r := Run(ctx, argv, 20*time.Second, nil, "")
	if r["ok"] != true {
		return r
	}
	installed := map[string]string{}
	for _, line := range strings.Split(fmt.Sprint(r["stdout"]), "\n") {
		f := strings.Split(line, "\t")
		if len(f) == 3 && f[2] == "installed" {
			installed[f[0]] = f[1]
		}
	}
	missing := []string{}
	for _, n := range names {
		if _, ok := installed[n]; !ok {
			missing = append(missing, n)
		}
	}
	sort.Strings(missing)
	return Result{"ok": true, "installed": installed, "missing": missing}
}

// LogOffset is where a log file stood at the session baseline.
type LogOffset struct {
	Size  int64  `json:"size"`
	Inode uint64 `json:"inode"`
}

// Log returns what was appended to a log since the baseline offset. A file
// that was rotated (new inode, or shorter than before) is read from the start.
func Log(path string, since *LogOffset) Result {
	resolved := Resolve(path)
	if Denied(resolved) {
		return fail("denied", "%s is never collected", path)
	}
	f, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Result{"ok": true, "exists": false, "path": path, "content": "", "rotated": false, "truncated": false}
	}
	if err != nil {
		return fail("denied", "%s: %v", path, err)
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil {
		return fail("denied", "%s: %v", path, err)
	}
	var offset int64
	rotated := false
	if since != nil {
		if (since.Inode != 0 && inode(fi) != since.Inode) || fi.Size() < since.Size {
			rotated = true
		} else {
			offset = since.Size
		}
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return fail("denied", "%s: %v", path, err)
	}
	buf, _ := io.ReadAll(io.LimitReader(f, DefaultMaxBytes+1))
	r := Result{"ok": true, "exists": true, "path": path, "rotated": rotated, "truncated": len(buf) > DefaultMaxBytes, "baseline_missing": since == nil}
	if len(buf) > DefaultMaxBytes {
		buf = buf[:DefaultMaxBytes]
	}
	textFields(r, "content", buf)
	return r
}

// Baseline is what the agent records at session start.
type Baseline struct {
	Files     map[string]string    `json:"files"` // path → sha256
	Logs      map[string]LogOffset `json:"logs"`
	BootID    string               `json:"bootId"`
	Clock     string               `json:"clock"`
	Truncated bool                 `json:"truncated"`
}

const maxBaselineFiles = 5000

// TakeBaseline hashes every file matching the hash globs and records log offsets.
func TakeBaseline(hash, logs []string) Baseline {
	b := Baseline{Files: map[string]string{}, Logs: map[string]LogOffset{}, Clock: time.Now().UTC().Format(time.RFC3339)}
	if id, err := os.ReadFile("/proc/sys/kernel/random/boot_id"); err == nil {
		b.BootID = strings.TrimSpace(string(id))
	}
	for _, pattern := range hash {
		paths, truncated := Expand(pattern, maxBaselineFiles)
		b.Truncated = b.Truncated || truncated
		for _, p := range paths {
			if len(b.Files) >= maxBaselineFiles {
				b.Truncated = true
				break
			}
			if Denied(Resolve(p)) {
				continue
			}
			if sum, err := hashFile(p); err == nil {
				b.Files[p] = sum
			}
		}
	}
	for _, p := range logs {
		if fi, err := os.Stat(p); err == nil && fi.Mode().IsRegular() {
			b.Logs[p] = LogOffset{Size: fi.Size(), Inode: inode(fi)}
		}
	}
	return b
}
