/* Shared client helpers for folder drag-drop / picker uploads. Returns a flat
   list of { path, file } where `path` is relative to (and includes) the dropped
   folder — the server strips the leading segment. */

export async function readDroppedFolder(dataTransfer) {
  const entries = Array.from(dataTransfer.items || [])
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  const out = [];
  const walk = (entry, prefix) =>
    new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(
          (file) => { out.push({ path: prefix + entry.name, file }); resolve(); },
          () => resolve(),
        );
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () =>
          reader.readEntries(
            async (batch) => {
              if (!batch.length) { resolve(); return; }
              await Promise.all(batch.map((e) => walk(e, prefix + entry.name + '/')));
              readBatch();
            },
            () => resolve(),
          );
        readBatch();
      } else resolve();
    });
  await Promise.all(entries.map((e) => walk(e, '')));
  return out;
}

export function filesFromInput(fileList) {
  return Array.from(fileList || []).map((f) => ({ path: f.webkitRelativePath || f.name, file: f }));
}

export function buildFolderFormData(entries) {
  const fd = new FormData();
  const paths = [];
  entries.forEach(({ path, file }) => { fd.append('files', file); paths.push(path); });
  fd.append('paths', JSON.stringify(paths));
  return fd;
}
