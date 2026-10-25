package sysinfo

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseOSRelease(t *testing.T) {
	got := ParseOSRelease("# comment\nPRETTY_NAME=\"Ubuntu 24.04.5 LTS\"\nID=ubuntu\nVERSION_ID='24.04'\nbroken line\n")
	if got["PRETTY_NAME"] != "Ubuntu 24.04.5 LTS" || got["ID"] != "ubuntu" || got["VERSION_ID"] != "24.04" {
		t.Fatalf("unexpected parse: %#v", got)
	}
}

func TestCollectFromRoot(t *testing.T) {
	root := t.TempDir()
	write := func(p, s string) {
		full := filepath.Join(root, p)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(s), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("/etc/machine-id", "71B37A67899C4FA18C536C9CAFD37DD8\n")
	write("/etc/os-release", "ID=ubuntu\nVERSION_ID=\"22.04\"\n")
	write("/sys/class/dmi/id/product_uuid", "A3B1C2D4-0000-0000-0000-000000000000\n")

	info := Collect(root)
	if info.MachineID != "71b37a67899c4fa18c536c9cafd37dd8" {
		t.Errorf("machine id = %q", info.MachineID)
	}
	if info.ProductUUID != "a3b1c2d4-0000-0000-0000-000000000000" {
		t.Errorf("product uuid = %q", info.ProductUUID)
	}
	if !info.Supported() {
		t.Errorf("ubuntu 22.04 should be supported")
	}
	if (Info{OS: "debian", OSVersion: "12"}).Supported() {
		t.Errorf("debian should not be supported")
	}
}
