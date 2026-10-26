// The files of a drop, with any dropped folder flattened to its files at any depth (spec 0007
// AC-12). Browser only. Falls back to the plain file list where entries are not supported.

type Entry = FileSystemEntry;

const isFile = (entry: Entry): entry is FileSystemFileEntry => entry.isFile;
const isDirectory = (entry: Entry): entry is FileSystemDirectoryEntry => entry.isDirectory;

const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File | null>((resolve) => entry.file(resolve, () => resolve(null)));

/** A folder's entries; `readEntries` hands them over in chunks until it returns none. */
async function entriesOf(directory: FileSystemDirectoryEntry): Promise<readonly Entry[]> {
  const reader = directory.createReader();
  const all: Entry[] = [];
  for (;;) {
    const chunk = await new Promise<Entry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([])),
    );
    if (!chunk.length) return all;
    all.push(...chunk);
  }
}

async function flatten(entry: Entry): Promise<readonly File[]> {
  if (isFile(entry)) {
    const file = await fileOf(entry);
    return file ? [file] : [];
  }
  if (!isDirectory(entry)) return [];
  const children = await entriesOf(entry);
  return (await Promise.all(children.map(flatten))).flat();
}

export async function filesFromDrop(transfer: DataTransfer): Promise<readonly File[]> {
  // Entries must be taken synchronously, before the drop event ends.
  const entries = [...transfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.() ?? null);
  if (!entries.length || entries.some((entry) => entry === null)) return [...transfer.files];
  return (await Promise.all(entries.map((entry) => flatten(entry!)))).flat();
}
