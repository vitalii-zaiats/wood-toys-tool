import { arch, offset, rect, type Poly } from "../../geometry/poly";
import type { EdgeSpec, MarkSpec, P2, PartSpec, PuzzleSpec, ShapeSpec } from "../../spec/types";
import type { HouseDesign, Opening, RoofPattern } from "./design";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const line = (pts: Poly): MarkSpec => ({ line: pts.map(q => [r3(q[0]), r3(q[1])] as P2) });

function decor(openings: Opening[]): { holes: ShapeSpec[]; engrave: MarkSpec[] } {
  const holes: ShapeSpec[] = [], engrave: MarkSpec[] = [];
  for (const o of openings) {
    const { cx, cy, w, h } = o, x0 = r3(cx - w / 2), x1 = r3(cx + w / 2), y0 = r3(cy - h / 2), y1 = r3(cy + h / 2);
    if (o.shape === "round") holes.push({ circle: [r3(cx), r3(cy), r3(w / 2)] });
    else if (o.shape === "diamond") holes.push({ poly: [[x0, r3(cy)], [r3(cx), y0], [x1, r3(cy)], [r3(cx), y1]] });
    else if (o.shape === "arch") holes.push({ arch: [x0, y0, x1, y1] });
    else if (o.cols * o.rows > 1) {
      const g = 2, pw = (w - (o.cols - 1) * g) / o.cols, ph = (h - (o.rows - 1) * g) / o.rows;
      for (let i = 0; i < o.cols; i++) for (let j = 0; j < o.rows; j++) {
        const px = x0 + i * (pw + g), py = y0 + j * (ph + g);
        holes.push({ rect: [r3(px), r3(py), r3(px + pw), r3(py + ph)] });
      }
    } else holes.push({ rect: [x0, y0, x1, y1] });

    if (o.sill) engrave.push(line([[x0 - 2, y0 - 2], [x1 + 2, y0 - 2]]));
    if (o.frame) {
      // Outline grown by the frame width, left open along the bottom edge.
      const f = offset(o.shape === "arch" ? arch(x0, y0, x1, y1) : rect(x0, y0, x1, y1), 1.6);
      f[0][1] = y0; f[1][1] = y0;
      engrave.push(line([...f.slice(1), f[0]]));
    }
    if (o.shutters) {
      const sw = 0.4 * w, n = Math.max(2, Math.floor(h / 3));
      for (const side of [-1, 1]) {
        const a = side < 0 ? x0 - 1 - sw : x1 + 1, b = a + sw;
        engrave.push(line([[a, y0], [b, y0], [b, y1], [a, y1], [a, y0]]));
        for (let k = 1; k < n; k++) { const y = y0 + (h * k) / n; engrave.push(line([[a + 0.8, y], [b - 0.8, y]])); }
      }
    }
  }
  return { holes, engrave };
}

function roofPattern(kind: RoofPattern, Ls: number, Dr: number): MarkSpec[] {
  const eng: MarkSpec[] = [], row = 6, step = 8;
  if (kind === "planks") {
    for (let b = -Dr / 2 + step; b < Dr / 2 - 1; b += step) eng.push(line([[0, b], [Ls, b]]));
  } else if (kind === "shingles") {
    let j = 0;
    for (let a = row; a < Ls - 0.5; a += row, j++) {
      eng.push(line([[a, -Dr / 2], [a, Dr / 2]]));
      for (let b = -Dr / 2 + (j % 2 ? step / 2 : step); b < Dr / 2 - 1; b += step) eng.push(line([[a - row, b], [a, b]]));
    }
  } else if (kind === "scales") {
    let j = 0;
    for (let a = 0; a + row < Ls - 0.5; a += row, j++) {
      for (let b = -Dr / 2 - (j % 2 ? step / 2 : 0); b < Dr / 2; b += step) {
        // One scallop, clipped to the panel so nothing is engraved on the cut edge.
        let run: Poly = [];
        for (let i = 0; i <= 12; i++) {
          const f = (i / 12) * Math.PI, y = b + (step * (1 - Math.cos(f))) / 2;
          if (y > -Dr / 2 + 1e-6 && y < Dr / 2 - 1e-6) run.push([a + row * Math.sin(f), y]);
          else { if (run.length > 1) eng.push(line(run)); run = []; }
        }
        if (run.length > 1) eng.push(line(run));
      }
    }
  }
  return eng;
}

// Writes a house design out as a puzzle description. The structure (walls, joints,
// slots) is expressed through params so the file stays editable by hand; the
// decoration is plain numbers.
export function houseSpec(d: HouseDesign, seed?: number): PuzzleSpec {
  const Ls = Math.hypot(d.W / 2, d.R) + d.eave, Dr = d.D + 2 * d.gableOverhang;

  const gable: EdgeSpec[] = [
    ["-W/2", 0],
    { to: ["W/2", 0], tabs: ["W/4", "3*W/4"], tabLen: "Tb" },
    { to: ["W/2", "H"], fingers: "n", teeth: "in" },
    { to: [0, "H+R"], tabs: ["0.28*L", "0.7*L"], tabLen: "Tl" },
    { to: ["-W/2", "H"], tabs: ["0.3*L", "0.72*L"], tabLen: "Tl" },
    { to: ["-W/2", 0], fingers: "n", teeth: "in" },
  ];
  const side: EdgeSpec[] = [
    ["-D/2+t", 0],
    { to: ["D/2-t", 0], tabs: ["D/4-t", "3*D/4-t"], tabLen: "Tb" },
    { to: ["D/2-t", "H"], fingers: "n", teeth: "out" },
    ["-D/2+t", "H"],
    { to: ["-D/2+t", 0], fingers: "n", teeth: "out" },
  ];
  const sideDecor = decor(d.sides);
  const roofHoles: ShapeSpec[] = ["0.3*L", "0.72*L"].flatMap(c => [
    { rect: [`${c}-Tl/2`, "-D/2", `${c}+Tl/2`, "-D/2+t"] },
    { rect: [`${c}-Tl/2`, "D/2-t", `${c}+Tl/2`, "D/2"] },
  ]);
  const roof = (id: number, name: string, sgn: 1 | -1): PartSpec => ({
    id, name,
    at: { o: [0, "H+R", 0], ea: [`${sgn}*W/2/L`, "-R/L", 0], eb: [0, 0, -sgn] },
    explode: [`${sgn}*40*R/L`, "40*W/2/L+22", 0],
    outline: [[0, "-Dr/2"], ["Ls", "-Dr/2"], ["Ls", "Dr/2"], [0, "Dr/2"]],
    holes: roofHoles,
    engrave: roofPattern(d.roof, Ls, Dr),
  });

  const parts: PartSpec[] = [
    {
      id: 1, name: "Основа",
      at: { o: [0, "-t", 0], ea: [1, 0, 0], eb: [0, 0, -1] },
      outline: [["-W/2-m", "-D/2-m"], ["W/2+m", "-D/2-m"], ["W/2+m", "D/2+m"], ["-W/2-m", "D/2+m"]],
      holes: [
        ...["-W/4", "W/4"].flatMap((c): ShapeSpec[] => [
          { rect: [`${c}-Tb/2`, "-D/2", `${c}+Tb/2`, "-D/2+t"] },
          { rect: [`${c}-Tb/2`, "D/2-t", `${c}+Tb/2`, "D/2"] },
        ]),
        ...["-D/4", "D/4"].flatMap((c): ShapeSpec[] => [
          { rect: ["W/2-t", `${c}-Tb/2`, "W/2", `${c}+Tb/2`] },
          { rect: ["-W/2", `${c}-Tb/2`, "-W/2+t", `${c}+Tb/2`] },
        ]),
      ],
      // doormat in front of the door
      engrave: [0, 1, 2].map((k): MarkSpec => ({ line: [[d.doorX - 6, `-D/2-${r3(1.5 + k * 2.6)}`], [d.doorX + 6, `-D/2-${r3(1.5 + k * 2.6)}`]] })),
    },
    {
      id: 2, name: "Передня стінка",
      at: { o: [0, 0, "D/2-t"], ea: [1, 0, 0], eb: [0, 1, 0] }, explode: [0, 22, 45],
      outline: gable, ...decor(d.front),
    },
    {
      id: 3, name: "Задня стінка",
      at: { o: [0, 0, "-D/2+t"], ea: [-1, 0, 0], eb: [0, 1, 0] }, explode: [0, 22, -45],
      outline: gable, ...decor(d.back),
    },
    {
      id: 4, name: "Права стінка",
      at: { o: ["W/2-t", 0, 0], ea: [0, 0, -1], eb: [0, 1, 0] }, explode: [45, 22, 0],
      outline: side, ...sideDecor,
    },
    {
      id: 5, name: "Ліва стінка",
      at: { o: ["-W/2+t", 0, 0], ea: [0, 0, 1], eb: [0, 1, 0] }, explode: [-45, 22, 0],
      outline: side, ...sideDecor,
    },
    roof(6, "Дах, права половина", 1),
    roof(7, "Дах, ліва половина", -1),
  ];

  return {
    name: "Будиночок",
    description: "Сім деталей на шип-паз: чотири стіни, дах і основа.",
    generator: seed === undefined ? undefined : { name: "house", seed },
    params: {
      W: d.W, D: d.D, H: d.H, R: d.R, n: d.fingers,
      Tb: 10, Tl: 10, m: d.margin, oe: d.eave, oh: d.gableOverhang,
      L: "hypot(W/2, R)", Ls: "L+oe", Dr: "D+2*oh",
    },
    parts,
    steps: [
      { ids: [1], text: "Основа. Пази дивляться вгору." },
      { ids: [2], text: "Передня стінка: шипи знизу в пази основи." },
      { ids: [4, 5], text: "Бічні стінки: пальці заходять між пальцями передньої." },
      { ids: [3], text: "Задня стінка закриває коробку." },
      { ids: [7], text: "Ліва половина даху лягає на шипи фронтонів." },
      { ids: [6], text: "Права половина. Готово." },
    ],
  };
}
