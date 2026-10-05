import { offset, type Poly } from "../geometry/poly";
import type { PuzzleModel } from "../model";

export interface SheetOptions { kerf: number; sheetW: number }
export interface Sheet { svg: string; w: number; h: number }

// Lays all parts out on a sheet and writes laser-ready SVG in millimetres.
// Outlines grow and holes shrink by half the kerf so slots come out to size.
export function exportSVG(model: PuzzleModel, opt: SheetOptions): Sheet {
  const k = opt.kerf, sheetW = opt.sheetW, gap = 4, margin = 5;
  // flip Y: view from the outer (engraved) face
  const flip = (pts: Poly): Poly => pts.map(q => [q[0], -q[1]]);
  const items = model.parts.map(p => {
    const o = flip(offset(p.outline, k / 2));
    const hs = p.holes.map(hh => flip(offset(hh, -k / 2))), en = p.engrave.map(flip);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of o) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return { o, hs, en, x0, y0, w: x1 - x0, h: y1 - y0, dx: 0, dy: 0 };
  });
  // shelf packing
  const order = items.slice().sort((a, b) => b.h - a.h);
  let x = margin, y = margin, rowH = 0, maxX = 0;
  for (const it of order) {
    if (x + it.w > sheetW - margin && x > margin) { x = margin; y += rowH + gap; rowH = 0; }
    it.dx = x - it.x0; it.dy = y - it.y0;
    x += it.w + gap; rowH = Math.max(rowH, it.h); maxX = Math.max(maxX, x - gap);
  }
  const sheetH = y + rowH + margin;
  const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString();
  const d = (pts: Poly, dx: number, dy: number, close: boolean) =>
    "M" + pts.map(q => fmt(q[0] + dx) + " " + fmt(q[1] + dy)).join(" L") + (close ? " Z" : "");
  const eng: string[] = [], inner: string[] = [], outer: string[] = [];
  for (const it of items) {
    for (const l of it.en) eng.push(d(l, it.dx, it.dy, false));
    for (const hh of it.hs) inner.push(d(hh, it.dx, it.dy, true));
    outer.push(d(it.o, it.dx, it.dy, true));
  }
  const W = Math.max(sheetW, maxX + margin);
  const group = (id: string, stroke: string, paths: string[]) =>
    `<g id="${id}" fill="none" stroke="${stroke}" stroke-width="0.1">\n${paths.map(p => `<path d="${p}"/>`).join("\n")}\n</g>\n`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(W)}mm" height="${fmt(sheetH)}mm" viewBox="0 0 ${fmt(W)} ${fmt(sheetH)}">\n` +
    `<!-- ${model.name}. t=${model.t}mm, kerf=${k}mm. Blue #0000FF = engrave (line), red #FF0000 = cut. Order: engrave, inner cuts, outer cuts. -->\n` +
    group("engrave", "#0000FF", eng) + group("cut-inner", "#FF0000", inner) + group("cut-outer", "#FF0000", outer) + `</svg>\n`;
  return { svg, w: W, h: sheetH };
}
