package collect

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestMatchSegs(t *testing.T) {
	cases := []struct {
		pat, p string
		want   bool
	}{
		{"**", "a/b/c.conf", true},
		{"**/*.conf", "c.conf", true},
		{"**/*.conf", "a/b/c.conf", true},
		{"**/*.conf", "a/b/c.txt", false},
		{"sites-*/*", "sites-enabled/default", true},
		{"sites-*/*", "sites-enabled/x/default", false},
		{"a/**/z", "a/z", true},
		{"a/**/z", "a/b/c/z", true},
	}
	for _, c := range cases {
		if got := matchSegs(splitSlash(c.pat), splitSlash(c.p)); got != c.want {
			t.Errorf("match(%q, %q) = %v, want %v", c.pat, c.p, got, c.want)
		}
	}
}

func splitSlash(s string) []string {
	out := []string{}
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == '/' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	return out
}

func TestDenied(t *testing.T) {
	for _, p := range []string{"/etc/shadow", "/etc/zaio/machine.key", "/etc/ssh/ssh_host_ed25519_key", "/home/nash/.ssh/id_ed25519", "/root/.ssh/authorized_keys"} {
		if !Denied(p) {
			t.Errorf("%s should be denied", p)
		}
	}
	for _, p := range []string{"/etc/passwd", "/etc/ssh/ssh_host_ed25519_key.pub", "/home/nash/.ssh/id_ed25519.pub", "/etc/nginx/nginx.conf"} {
		if Denied(p) {
			t.Errorf("%s should be allowed", p)
		}
	}
}

// The rest needs a real Linux filesystem and coreutils: run in WSL with
//
//	GOOS=linux go test -c ./internal/collect && wsl ./collect.test
func linuxOnly(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("needs Linux")
	}
}

func TestFileGlobBaselineLog(t *testing.T) {
	linuxOnly(t)
	dir := t.TempDir()
	write := func(rel, s string) string {
		p := filepath.Join(dir, rel)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(s), 0o640); err != nil {
			t.Fatal(err)
		}
		return p
	}
	conf := write("etc/app/app.conf", "listen 80;\n")
	write("etc/app/conf.d/a.conf", "a\n")
	write("etc/app/conf.d/b.txt", "b\n")
	log := write("var/log/app.log", "old line\n")

	f := File(conf, 0, true)
	if f["ok"] != true || f["exists"] != true || f["content"] != "listen 80;\n" || f["mode"] != "0640" {
		t.Fatalf("file: %#v", f)
	}
	if missing := File(filepath.Join(dir, "nope"), 0, true); missing["ok"] != true || missing["exists"] != false {
		t.Fatalf("missing file: %#v", missing)
	}
	g := Glob(dir+"/etc/app/**/*.conf", false, 0)
	if files := g["files"].([]Result); len(files) != 2 || files[0]["content"] != nil {
		t.Fatalf("glob: %#v", g)
	}

	b := TakeBaseline([]string{dir + "/etc/**"}, []string{log})
	if len(b.Files) != 3 || b.Logs[log].Size != 9 || b.Logs[log].Inode == 0 {
		t.Fatalf("baseline: %#v", b)
	}
	off := b.Logs[log]
	f2, _ := os.OpenFile(log, os.O_APPEND|os.O_WRONLY, 0)
	_, _ = f2.WriteString("new line\n")
	f2.Close()
	if l := Log(log, &off); l["content"] != "new line\n" || l["rotated"] != false {
		t.Fatalf("log since baseline: %#v", l)
	}
	// Rotation: replaced by a new, shorter file → read from the start.
	_ = os.Remove(log)
	write("var/log/app.log", "fresh\n")
	if l := Log(log, &off); l["content"] != "fresh\n" || l["rotated"] != true {
		t.Fatalf("rotated log: %#v", l)
	}
}

func TestRun(t *testing.T) {
	linuxOnly(t)
	ctx := context.Background()
	in := "hello"
	r := Run(ctx, []string{"cat"}, 0, &in, "")
	if r["ok"] != true || r["stdout"] != "hello" || r["exit_code"] != 0 {
		t.Fatalf("cat: %#v", r)
	}
	if r := Run(ctx, []string{"sh", "-c", "echo $PATH; exit 3"}, 0, nil, ""); r["exit_code"] != 3 || r["stdout"] != "/usr/sbin:/usr/bin:/sbin:/bin\n" {
		t.Fatalf("exit code / scrubbed env: %#v", r)
	}
	if r := Run(ctx, []string{"definitely-not-a-command"}, 0, nil, ""); r["ok"] != false || r["error"] != "not_found" {
		t.Fatalf("missing command: %#v", r)
	}
	if r := Run(ctx, []string{"sleep", "5"}, 300*time.Millisecond, nil, ""); r["error"] != "timeout" {
		t.Fatalf("timeout: %#v", r)
	}
	big := Run(ctx, []string{"head", "-c", "400000", "/dev/zero"}, 0, nil, "")
	if big["truncated"] != true {
		t.Fatalf("output should be capped: truncated=%v", big["truncated"])
	}
	if p := Package(ctx, []string{"coreutils", "no-such-package-xyz"}); p["ok"] != true || p["installed"].(map[string]string)["coreutils"] == "" {
		t.Fatalf("package: %#v", p)
	}
}
