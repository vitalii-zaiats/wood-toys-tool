import { buildPuzzle } from "./build";
import type { PuzzleSpec } from "./types";

// Reads a puzzle description and proves it builds, so a broken file is reported
// at the open dialog and never reaches the viewer.
export function parseSpec(text: string): PuzzleSpec {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("Це не JSON-файл."); }
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { parts?: unknown }).parts)) {
    throw new Error("Це не опис пазла: немає списку parts.");
  }
  const spec = raw as PuzzleSpec;
  try { buildPuzzle(spec, { t: 3, scale: 1 }); }
  catch (e) { throw new Error(e instanceof TypeError ? "Файл пошкоджений: " + e.message : (e as Error).message); }
  return spec;
}

// JSON with one point or one short object per line, so descriptions stay readable and diffable.
export function formatSpec(v: unknown, indent = ""): string {
  const flat = JSON.stringify(v);
  if (v === null || typeof v !== "object" || flat.length <= 110 - indent.length) return flat;
  const inner = indent + "  ";
  if (Array.isArray(v)) return "[\n" + v.map(x => inner + formatSpec(x, inner)).join(",\n") + "\n" + indent + "]";
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return "{\n" + entries.map(([k, x]) => inner + JSON.stringify(k) + ": " + formatSpec(x, inner)).join(",\n") + "\n" + indent + "}";
}
