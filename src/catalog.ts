import { randomDesign } from "./generators/house/design";
import { houseSpec } from "./generators/house/spec";
import type { PuzzleSpec } from "./spec/types";

export interface GalleryItem { slug: string; spec: PuzzleSpec }

// Every description file in src/puzzles is a gallery entry; the file name is its address.
const files = import.meta.glob<PuzzleSpec>("./puzzles/*.json", { eager: true, import: "default" });

export const GALLERY: GalleryItem[] = Object.entries(files)
  .map(([path, spec]) => ({ slug: path.replace(/^.*\/|\.json$/g, ""), spec }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

// Generators a puzzle can name in its `generator` field to offer seeded variations.
export const GENERATORS: Record<string, (seed: number) => PuzzleSpec> = {
  house: seed => houseSpec(randomDesign(seed), seed),
};
