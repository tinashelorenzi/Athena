// Package sysinfo reads the facts a machine reports at enrolment: machine-id,
// DMI product UUID, OS release, architecture, hostname and boot ID.
package sysinfo

import (
	"bufio"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type Info struct {
	MachineID   string
	ProductUUID string
	OS          string // os-release ID, e.g. "ubuntu"
	OSVersion   string // VERSION_ID, e.g. "24.04"
	OSPretty    string // PRETTY_NAME
	Arch        string // amd64 | arm64
	Hostname    string
	BootID      string
	WSL         bool
}

// Collect reads system facts below root ("" or "/" for the live system;
// a directory in tests).
func Collect(root string) Info {
	read := func(p string) string {
		b, err := os.ReadFile(filepath.Join(root, p))
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(b))
	}
	rel := ParseOSRelease(read("/etc/os-release"))
	host, _ := os.Hostname()
	kernel := strings.ToLower(read("/proc/sys/kernel/osrelease"))
	return Info{
		MachineID:   strings.ToLower(read("/etc/machine-id")),
		ProductUUID: strings.ToLower(read("/sys/class/dmi/id/product_uuid")),
		OS:          rel["ID"],
		OSVersion:   rel["VERSION_ID"],
		OSPretty:    rel["PRETTY_NAME"],
		Arch:        runtime.GOARCH,
		Hostname:    host,
		BootID:      read("/proc/sys/kernel/random/boot_id"),
		WSL:         strings.Contains(kernel, "microsoft") || os.Getenv("WSL_DISTRO_NAME") != "",
	}
}

// ParseOSRelease parses /etc/os-release (KEY=value, optionally quoted).
func ParseOSRelease(content string) map[string]string {
	out := map[string]string{}
	sc := bufio.NewScanner(strings.NewReader(content))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		if len(v) >= 2 && (v[0] == '"' || v[0] == '\'') && v[len(v)-1] == v[0] {
			v = v[1 : len(v)-1]
		}
		out[strings.TrimSpace(k)] = v
	}
	return out
}

// SupportedOS describes the systems labs are built for, for messages.
const SupportedOS = "Ubuntu 22.04/24.04 or Kali Linux"

// Supported reports whether this OS is one the labs are built for: Ubuntu
// 22.04 or 24.04, or Kali Linux (rolling, so any release).
func (i Info) Supported() bool {
	switch i.OS {
	case "ubuntu":
		return i.OSVersion == "22.04" || i.OSVersion == "24.04"
	case "kali":
		return true
	}
	return false
}
