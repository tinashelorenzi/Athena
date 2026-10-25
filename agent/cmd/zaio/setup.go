package main

import (
	"bufio"
	"context"
	"crypto/ed25519"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"zaio/agent/internal/client"
	"zaio/agent/internal/config"
	"zaio/agent/internal/sign"
	"zaio/agent/internal/sysinfo"
	"zaio/agent/internal/tasks"
)

// runSetup enrols this machine (spec 7.1): generate a key, call
// /api/agent/enroll with the one-time code, persist the config, set the
// hostname and enable the daemon. Nothing is written unless Athena accepts.
func runSetup(args []string) error {
	fs := flag.NewFlagSet("setup", flag.ExitOnError)
	athenaURL := fs.String("url", defaultURL, "Athena address, e.g. https://athena.example.com")
	email := fs.String("email", "", "your Athena email")
	code := fs.String("code", "", "one-time code from Athena → Machines")
	label := fs.String("label", "", "a name for this machine (default: its hostname)")
	dir := fs.String("config-dir", config.DefaultDir, "where agent.json and machine.key live")
	force := fs.Bool("force", false, "re-enrol without asking if already enrolled")
	noHostname := fs.Bool("no-hostname", false, "don't change the hostname")
	noService := fs.Bool("no-service", false, "don't install/enable the systemd service")
	anyOS := fs.Bool("any-os", false, "allow an OS other than Ubuntu 22.04/24.04")
	_ = fs.Parse(args)

	if os.Geteuid() != 0 {
		return errors.New("setup must run as root: sudo zaio setup")
	}
	in := bufio.NewReader(os.Stdin)

	if existing, err := config.Load(*dir); err == nil && !*force {
		fmt.Printf("This machine is already linked to %s as %q (%s).\n", existing.OwnerEmail, existing.Label, existing.MachineID)
		if !confirm(in, "Link it again? The old link stops working.") {
			return errors.New("setup cancelled (use --force to re-link without asking)")
		}
	}

	info := sysinfo.Collect("")
	if !info.Supported() && !*anyOS {
		return fmt.Errorf("labs need Ubuntu 22.04 or 24.04 (found %q) — use --any-os to continue anyway", strings.TrimSpace(info.OSPretty))
	}
	if len(info.MachineID) != 32 {
		return errors.New("/etc/machine-id is missing or malformed — run `systemd-machine-id-setup` and try again")
	}

	fmt.Printf("Athena Labs agent %s — linking %s (%s)\n\n", version, info.Hostname, info.OSPretty)
	// Values given as flags aren't asked again.
	if !flagSet(fs, "url") || *athenaURL == "" {
		*athenaURL = prompt(in, "Athena address", *athenaURL)
	}
	base, err := normalizeURL(*athenaURL)
	if err != nil {
		return err
	}
	if *email == "" {
		*email = prompt(in, "Athena email", "")
	}
	if *code == "" {
		*code = prompt(in, "Enrolment code", "")
	}
	if *label == "" {
		*label = prompt(in, "Name for this machine", info.Hostname)
	}
	if *email == "" || *code == "" {
		return errors.New("email and code are required")
	}

	pub, key, err := ed25519.GenerateKey(nil)
	if err != nil {
		return err
	}
	c := client.New(base, version)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	res, err := c.Enroll(ctx, client.EnrollRequest{
		Email: *email, Code: *code, Label: *label,
		PublicKey: sign.PublicKeyB64(pub), MachineID: info.MachineID, ProductUUID: info.ProductUUID,
		OS: info.OS, OSVersion: info.OSVersion, OSPretty: info.OSPretty, Arch: info.Arch,
		Hostname: info.Hostname, AgentVersion: version, Capabilities: tasks.Capabilities,
	})
	if err != nil {
		return fmt.Errorf("enrolment failed: %w", err)
	}

	cfg := &config.Config{
		AthenaURL: base, MachineID: res.MachineID, Hostname: res.Hostname, Label: res.Label,
		OwnerName: res.Owner.Name, OwnerEmail: res.Owner.Email, KeyFingerprint: res.KeyFingerprint,
		EnrolledAt: time.Now().UTC(),
	}
	if res.AthenaKeyID != nil && res.AthenaPublicKey != nil {
		// Pin Athena's bundle-signing key: from now on only bundles it signed are run.
		cfg.AthenaKeyID, cfg.AthenaPublicKey = *res.AthenaKeyID, *res.AthenaPublicKey
	}
	if err := config.SaveKey(*dir, key); err != nil {
		return fmt.Errorf("Athena linked the machine but the key could not be saved (%w) — run setup again", err)
	}
	if err := config.Save(*dir, cfg); err != nil {
		return fmt.Errorf("Athena linked the machine but the config could not be saved (%w) — run setup again", err)
	}

	hostnameNote := setHostname(res.Hostname, info, *noHostname)
	serviceNote := "skipped (--no-service)"
	if !*noService {
		serviceNote = installService()
	}

	fmt.Printf("\nLinked to Athena.\n\n")
	fmt.Printf("  Owner        %s <%s>\n", res.Owner.Name, res.Owner.Email)
	fmt.Printf("  Machine      %s  (%s)\n", res.Label, res.MachineID)
	fmt.Printf("  Hostname     %s\n", hostnameNote)
	fmt.Printf("  Key          %s\n", res.KeyFingerprint)
	fmt.Printf("  Agent        %s\n\n", serviceNote)
	fmt.Println("The same details are on Athena → Machines.")
	return nil
}

func normalizeURL(raw string) (string, error) {
	raw = strings.TrimRight(strings.TrimSpace(raw), "/")
	if raw == "" {
		return "", errors.New("the Athena address is required")
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "", fmt.Errorf("%q is not a valid Athena address", raw)
	}
	if u.Scheme == "http" && u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" {
		fmt.Fprintln(os.Stderr, "warning: using plain http — only do this on a local test setup")
	}
	return raw, nil
}

func setHostname(name string, info sysinfo.Info, skip bool) string {
	switch {
	case skip:
		return info.Hostname + " (unchanged, --no-hostname)"
	case info.WSL:
		return info.Hostname + " (unchanged: WSL manages the hostname)"
	case name == info.Hostname:
		return name
	}
	if out, err := exec.Command("hostnamectl", "set-hostname", name).CombinedOutput(); err != nil {
		return fmt.Sprintf("%s (could not set %s: %s)", info.Hostname, name, strings.TrimSpace(string(out)))
	}
	// Keep sudo from complaining "unable to resolve host": map the new name in /etc/hosts.
	if b, err := os.ReadFile("/etc/hosts"); err == nil {
		lines := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
		found := false
		for i, l := range lines {
			if strings.HasPrefix(strings.TrimSpace(l), "127.0.1.1") {
				lines[i], found = "127.0.1.1\t"+name, true
			}
		}
		if !found {
			lines = append(lines, "127.0.1.1\t"+name)
		}
		_ = os.WriteFile("/etc/hosts", []byte(strings.Join(lines, "\n")+"\n"), 0o644)
	}
	return name
}

// prompt asks for a value on a terminal; non-interactive runs use the default.
func prompt(in *bufio.Reader, label, def string) string {
	if !isTerminal() {
		return def
	}
	if def != "" {
		fmt.Printf("%s [%s]: ", label, def)
	} else {
		fmt.Printf("%s: ", label)
	}
	line, _ := in.ReadString('\n')
	if v := strings.TrimSpace(line); v != "" {
		return v
	}
	return def
}

func confirm(in *bufio.Reader, question string) bool {
	if !isTerminal() {
		return false
	}
	fmt.Printf("%s [y/N]: ", question)
	line, _ := in.ReadString('\n')
	answer := strings.ToLower(strings.TrimSpace(line))
	return answer == "y" || answer == "yes"
}

func flagSet(fs *flag.FlagSet, name string) bool {
	set := false
	fs.Visit(func(f *flag.Flag) { set = set || f.Name == name })
	return set
}
