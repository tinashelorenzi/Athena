//go:build !linux

package collect

import "os"

// The agent targets Linux; these keep the package building (and its portable
// tests running) elsewhere.

func statFile(p string) (os.FileInfo, error) { return os.Stat(p) }

func owner(os.FileInfo) (string, string) { return "", "" }

func inode(os.FileInfo) uint64 { return 0 }
