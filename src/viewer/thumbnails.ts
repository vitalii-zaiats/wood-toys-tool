import type { PuzzleModel } from "../model";
import { PuzzleScene } from "./scene";

// Renders one still of each model with a throwaway offscreen scene.
// Returns an empty list when WebGL is unavailable.
export function renderThumbnails(models: PuzzleModel[], w = 640, h = 440): string[] {
  let scene: PuzzleScene;
  try { scene = new PuzzleScene(document.createElement("canvas"), false); } catch { return []; }
  try { return models.map(m => scene.snapshot(m, w, h)); }
  finally { scene.dispose(true); }
}
