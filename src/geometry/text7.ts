import type { Poly, Pt } from "./poly";

// Stroke font (7-segment style) so labels engrave as plain vector lines.
const SEG: Record<string, string> = {
  0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg", "-": "g", "+": "gp",
};

export function text7Width(str: string, h: number): number {
  const w = h * 0.6, gap = h * 0.3;
  let total = 0;
  for (const ch of str) total += (ch === "." ? h * 0.25 : w) + gap;
  return total - gap;
}

export function text7(str: string, x: number, y: number, h: number, center: boolean): Poly[] {
  const w = h * 0.6, gap = h * 0.3, lines: Poly[] = [];
  const adv = (ch: string) => (ch === "." ? h * 0.25 : w) + gap;
  let cx = center ? x - text7Width(str, h) / 2 : x;
  const S: Record<string, Pt[]> = {
    a: [[0, h], [w, h]], b: [[w, h], [w, h / 2]], c: [[w, h / 2], [w, 0]], d: [[0, 0], [w, 0]],
    e: [[0, 0], [0, h / 2]], f: [[0, h / 2], [0, h]], g: [[0, h / 2], [w, h / 2]], p: [[w / 2, h / 4], [w / 2, h * 3 / 4]],
  };
  for (const ch of str) {
    if (ch === ".") { const r = h * 0.06; lines.push([[cx, y], [cx + r, y], [cx + r, y + r], [cx, y + r], [cx, y]]); cx += adv(ch); continue; }
    for (const s of SEG[ch] ?? "") lines.push(S[s].map(q => [cx + q[0], y + q[1]]));
    cx += adv(ch);
  }
  return lines;
}
