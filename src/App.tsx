import { useEffect, useState } from "react";
import { Gallery } from "./Gallery";
import { GALLERY } from "./catalog";
import { openText, type OpenedFile } from "./io/files";
import { PuzzlePage } from "./PuzzlePage";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { parseSpec } from "./spec/file";
import type { PuzzleSpec } from "./spec/types";
import { PUZZLE_FILE } from "./ui/fileTypes";

interface Opened { spec: PuzzleSpec; file: OpenedFile }

const FILE_HASH = "#file";

export function App() {
  const [hash, setHash] = useState(location.hash);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [settings, setSettings] = useState(loadSettings);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onHash = () => setHash(location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onSettings = (s: Settings) => { setSettings(s); saveSettings(s); };
  const openFile = async () => {
    try {
      const file = await openText(PUZZLE_FILE);
      if (!file) return;
      setOpened({ spec: parseSpec(file.text), file });
      setNote("");
      location.hash = FILE_HASH;
    } catch (e) { setNote(e instanceof Error ? e.message : "Не вдалося відкрити файл."); }
  };

  const slug = hash.slice(1), item = GALLERY.find(g => g.slug === slug);
  if (item) return <PuzzlePage key={slug} initial={item.spec} slug={slug} settings={settings} onSettings={onSettings} />;
  if (hash === FILE_HASH && opened) {
    const name = opened.file.name.replace(/\.json$/i, "");
    return <PuzzlePage key={opened.file.name} initial={opened.spec} slug={name} file={opened.file} settings={settings} onSettings={onSettings} />;
  }
  return <Gallery onOpenFile={openFile} note={note} />;
}
