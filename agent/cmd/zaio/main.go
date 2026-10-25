// Command zaio is the Athena Labs agent: a systemd daemon that polls Athena
// and a CLI for students (docs/labs/spec.md section 6).
package main

import (
	"fmt"
	"os"
)

// Set at build time: -ldflags "-X main.version=0.1.0 -X main.defaultURL=https://athena.example.com".
var (
	version    = "0.1.0-dev"
	defaultURL = ""
)

const usage = `zaio — Athena Labs agent %s

Usage:
  sudo zaio setup [--url URL] [--email EMAIL] [--code CODE] [--label NAME]
                                  link this machine to your Athena account
  sudo zaio status                show enrolment and whether Athena can be reached

  sudo zaio labs                  labs you can do on this machine
  sudo zaio start <lab>           start a lab session (records the starting state)
  sudo zaio check <lab>           check your work so far (practice)
  sudo zaio end <lab>             finish: final check and grade
  sudo zaio undo [--all]          restore SSH now if a session left it off

  zaio version                    print the agent version
  zaio daemon                     run the background agent (started by systemd)

Run "zaio <command> --help" for a command's options.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, usage, version)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "setup":
		err = runSetup(os.Args[2:])
	case "status":
		err = runStatus(os.Args[2:])
	case "daemon":
		err = runDaemon(os.Args[2:])
	case "labs":
		err = runLabs(os.Args[2:])
	case "start", "check", "end":
		err = runSession(os.Args[1], os.Args[2:])
	case "undo":
		err = runUndo(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Println(version)
	case "help", "--help", "-h":
		fmt.Printf(usage, version)
	default:
		fmt.Fprintf(os.Stderr, "zaio: unknown command %q\n\n", os.Args[1])
		fmt.Fprintf(os.Stderr, usage, version)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "zaio:", err)
		os.Exit(1)
	}
}
