import { useEffect, useRef } from "react";
import type { PuzzleModel } from "../model";
import { PuzzleScene, type ViewMode } from "./scene";

interface Props { model: PuzzleModel; mode: ViewMode; step: number; onUnsupported: () => void }

export function Viewer({ model, mode, step, onUnsupported }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<PuzzleScene | null>(null);

  useEffect(() => {
    try { scene.current = new PuzzleScene(canvas.current!); } catch { onUnsupported(); }
    return () => { scene.current?.dispose(); scene.current = null; };
  }, [onUnsupported]);

  // Declared after the mount effect so a fresh scene gets its model and view straight away.
  useEffect(() => { scene.current?.setModel(model); }, [model]);
  useEffect(() => { scene.current?.setView(mode, step); }, [mode, step]);

  return <canvas ref={canvas} id="view" aria-label="3D-модель, обертається пальцем або мишею" />;
}
