// Disk access without a backend. Chromium browsers get the File System Access API
// (real save dialog, and re-saving into the same file); Firefox and Safari fall back
// to a download and a classic file input.

export interface FileType { description: string; mime: string; ext: string }
export interface OpenedFile { name: string; text: string; handle?: FileSystemFileHandle }
export interface SavedFile { name: string; handle?: FileSystemFileHandle }

interface PickerOptions { suggestedName?: string; types: { description: string; accept: Record<string, string[]> }[] }
const fs = window as unknown as {
  showSaveFilePicker?: (o: PickerOptions) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (o: PickerOptions) => Promise<FileSystemFileHandle[]>;
};

export const hasFileSystemAccess = typeof fs.showSaveFilePicker === "function" && typeof fs.showOpenFilePicker === "function";

const pickerTypes = (type: FileType) => [{ description: type.description, accept: { [type.mime]: [type.ext] } }];
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

async function write(handle: FileSystemFileHandle, text: string) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

// Resolves to null when the user cancels the dialog. Pass `handle` to overwrite a file opened or saved earlier.
export async function saveText(text: string, name: string, type: FileType, handle?: FileSystemFileHandle): Promise<SavedFile | null> {
  if (handle) { await write(handle, text); return { name: handle.name, handle }; }
  if (fs.showSaveFilePicker) {
    try {
      const picked = await fs.showSaveFilePicker({ suggestedName: name, types: pickerTypes(type) });
      await write(picked, text);
      return { name: picked.name, handle: picked };
    } catch (e) { if (isAbort(e)) return null; throw e; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: type.mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name };
}

export async function openText(type: FileType): Promise<OpenedFile | null> {
  if (fs.showOpenFilePicker) {
    try {
      const [handle] = await fs.showOpenFilePicker({ types: pickerTypes(type) });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (e) { if (isAbort(e)) return null; throw e; }
  }
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = type.ext + "," + type.mime;
    input.onchange = async () => { const f = input.files?.[0]; resolve(f ? { name: f.name, text: await f.text() } : null); };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// Re-reads a file opened earlier, e.g. after it was edited in a text editor.
export async function rereadText(handle: FileSystemFileHandle): Promise<OpenedFile> {
  const file = await handle.getFile();
  return { name: file.name, text: await file.text(), handle };
}
