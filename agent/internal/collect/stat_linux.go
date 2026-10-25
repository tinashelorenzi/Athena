package collect

import (
	"os"
	"os/user"
	"strconv"
	"syscall"
)

func statFile(p string) (os.FileInfo, error) { return os.Stat(p) }

// owner returns the user and group names (or numeric ids) of a file.
func owner(fi os.FileInfo) (string, string) {
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return "", ""
	}
	u := strconv.FormatUint(uint64(st.Uid), 10)
	g := strconv.FormatUint(uint64(st.Gid), 10)
	if x, err := user.LookupId(u); err == nil {
		u = x.Username
	}
	if x, err := user.LookupGroupId(g); err == nil {
		g = x.Name
	}
	return u, g
}

func inode(fi os.FileInfo) uint64 {
	if st, ok := fi.Sys().(*syscall.Stat_t); ok {
		return st.Ino
	}
	return 0
}
