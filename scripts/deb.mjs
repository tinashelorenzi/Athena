/**
 * Minimal, dependency-free .deb writer, so the agent package builds the same
 * on Windows, in Docker and on a plain host (no dpkg-deb or nfpm needed).
 *
 * A .deb is an `ar` archive of: "debian-binary" ("2.0\n"), control.tar.gz
 * (control + maintainer scripts) and data.tar.gz (the files to install).
 * Tars are POSIX ustar; every entry is owned by root:root.
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const enc = new TextEncoder();

function octal(n, width) {
  // ustar numeric fields: zero-padded octal, NUL-terminated.
  return n.toString(8).padStart(width - 1, "0") + "\0";
}

function header(name, { size = 0, mode = 0o644, type = "0", mtime }) {
  const h = Buffer.alloc(512, 0);
  let prefix = "";
  let base = name;
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf("/", 154);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  const put = (str, off, len) => h.write(str, off, len, "utf8");
  put(base, 0, 100);
  put(octal(mode, 8), 100, 8);
  put(octal(0, 8), 108, 8); // uid
  put(octal(0, 8), 116, 8); // gid
  put(octal(size, 12), 124, 12);
  put(octal(mtime, 12), 136, 12);
  h.fill(0x20, 148, 156); // checksum computed with this field as spaces
  put(type, 156, 1);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  put("root", 265, 32);
  put("root", 297, 32);
  put(prefix, 345, 155);
  let sum = 0;
  for (const b of h) sum += b;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}

/**
 * entries: [{ path: "./usr/bin/zaio", mode, data?: Buffer|string }] — entries
 * without data are directories. Parent directories are added automatically.
 */
export function tarGz(entries, mtime) {
  const dirs = new Set(["./"]);
  for (const e of entries) {
    const parts = e.path.replace(/^\.\//, "").split("/");
    for (let i = 1; i < parts.length; i++) dirs.add("./" + parts.slice(0, i).join("/") + "/");
  }
  const chunks = [];
  for (const d of [...dirs].sort()) chunks.push(header(d, { mode: 0o755, type: "5", mtime }));
  for (const e of entries) {
    const data = typeof e.data === "string" ? Buffer.from(enc.encode(e.data)) : e.data;
    chunks.push(header(e.path, { size: data.length, mode: e.mode ?? 0o644, mtime }));
    chunks.push(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) chunks.push(Buffer.alloc(pad, 0));
  }
  chunks.push(Buffer.alloc(1024, 0)); // end-of-archive marker
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

function arMember(name, data, mtime) {
  const h = Buffer.alloc(60, 0x20);
  h.write(name.padEnd(16), 0, 16, "ascii");
  h.write(String(mtime).padEnd(12), 16, 12, "ascii");
  h.write("0".padEnd(6), 28, 6, "ascii");
  h.write("0".padEnd(6), 34, 6, "ascii");
  h.write("100644".padEnd(8), 40, 8, "ascii");
  h.write(String(data.length).padEnd(10), 48, 10, "ascii");
  h.write("`\n", 58, 2, "ascii");
  return Buffer.concat([h, data, data.length % 2 ? Buffer.from("\n") : Buffer.alloc(0)]);
}

const lf = (s) => s.replace(/\r\n/g, "\n");

/**
 * Build a .deb. files: [{ path: "/usr/bin/zaio", mode, data }];
 * scripts: { postinst?, prerm?, postrm? } (shell text).
 */
export function buildDeb({ name, version, arch, maintainer, description, homepage, files, scripts = {}, mtime = Math.floor(Date.now() / 1000) }) {
  const installedKb = Math.ceil(files.reduce((n, f) => n + (typeof f.data === "string" ? Buffer.byteLength(f.data) : f.data.length), 0) / 1024);
  const control = [
    `Package: ${name}`,
    `Version: ${version}`,
    `Architecture: ${arch}`,
    `Maintainer: ${maintainer}`,
    `Installed-Size: ${installedKb}`,
    `Section: admin`,
    `Priority: optional`,
    homepage ? `Homepage: ${homepage}` : null,
    `Description: ${description.split("\n")[0]}`,
    ...description.split("\n").slice(1).map((l) => (l.trim() ? ` ${l}` : " .")),
  ].filter(Boolean).join("\n") + "\n";

  const md5sums = files
    .map((f) => `${createHash("md5").update(typeof f.data === "string" ? lf(f.data) : f.data).digest("hex")}  ${f.path.replace(/^\//, "")}`)
    .join("\n") + "\n";

  const controlTar = tarGz(
    [
      { path: "./control", data: control },
      { path: "./md5sums", data: md5sums },
      ...Object.entries(scripts).map(([n, text]) => ({ path: `./${n}`, mode: 0o755, data: lf(text) })),
    ],
    mtime,
  );
  const dataTar = tarGz(
    files.map((f) => ({ path: "." + f.path, mode: f.mode, data: typeof f.data === "string" ? lf(f.data) : f.data })),
    mtime,
  );
  return Buffer.concat([
    Buffer.from("!<arch>\n"),
    arMember("debian-binary", Buffer.from("2.0\n"), mtime),
    arMember("control.tar.gz", controlTar, mtime),
    arMember("data.tar.gz", dataTar, mtime),
  ]);
}
