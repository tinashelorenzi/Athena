package main

import (
	"os"
	"syscall"
	"unsafe"
)

// isTerminal reports whether stdin is a real terminal (TCGETS succeeds).
// /dev/null and pipes are not, so scripted setups never block on a prompt.
func isTerminal() bool {
	var t syscall.Termios
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, os.Stdin.Fd(), syscall.TCGETS, uintptr(unsafe.Pointer(&t)))
	return errno == 0
}
