import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inPoly, type Pt } from "../src/geometry/poly";
import type { Part, PuzzleModel, Vec3 } from "../src/model";
import { buildPuzzle } from "../src/spec/build";
import { parseSpec } from "../src/spec/file";
import { exportSVG } from "../src/export/svg";

const DIR = "src/puzzles";
const FILES = readdirSync(DIR).filter(f => f.endsWith(".json"));
const load = (f: string) => parseSpec(readFileSync(`${DIR}/${f}`, "utf8"));

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const solid = (p: Part, q: Pt) => inPoly(q, p.outline) && !p.holes.some(h => inPoly(q, h));

// Probes just inside every outline edge of every part, half-way through the sheet.
// A probe that sits in another part's material means two parts occupy the same space:
// a tab without a slot, a slot in the wrong place, a plate running through a wall.
function collisions(m: PuzzleModel): string[] {
  const placed = m.parts.filter(p => p.basis), t = m.t, bad: string[] = [];
  for (const a of placed) {
    const A = a.basis!, ac = cross(A.ea, A.eb);
    for (let i = 0; i < a.outline.length; i++) {
      const p = a.outline[i], q = a.outline[(i + 1) % a.outline.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1) continue;
      for (const sg of [1, -1]) {
        const probe: Pt = [(p[0] + q[0]) / 2 + (sg * 0.3 * (q[1] - p[1])) / len, (p[1] + q[1]) / 2 - (sg * 0.3 * (q[0] - p[0])) / len];
        if (!solid(a, probe)) continue;
        const w = [0, 1, 2].map(k => A.o[k] + A.ea[k] * probe[0] + A.eb[k] * probe[1] + (ac[k] * t) / 2);
        for (const b of placed) {
          if (b === a) continue;
          const B = b.basis!, d = w.map((v, k) => v - B.o[k]), c = dot(d, cross(B.ea, B.eb));
          if (c > 0.05 && c < t - 0.05 && solid(b, [dot(d, B.ea), dot(d, B.eb)])) bad.push(`${a.id} "${a.name}" runs into ${b.id} "${b.name}" near [${probe.map(v => v.toFixed(1))}]`);
        }
      }
    }
  }
  return bad;
}

describe.each(FILES)("gallery: %s", file => {
  it.each([[3, 1], [4.2, 1], [6, 0.7], [2, 1.8]])("parts do not run into each other (t=%s, scale=%s)", (t, scale) => {
    expect(collisions(buildPuzzle(load(file), { t, scale }))).toEqual([]);
  });

  it("has a name, a description and steps that cover every placed part exactly once", () => {
    const spec = load(file), m = buildPuzzle(spec, { t: 3, scale: 1 });
    expect(spec.name).toBeTruthy(); expect(spec.description).toBeTruthy();
    expect(m.steps.flatMap(s => s.ids).sort((a, b) => a - b)).toEqual(m.parts.filter(p => p.basis).map(p => p.id));
  });

  it("exports a clean sheet", () => {
    const { svg } = exportSVG(buildPuzzle(load(file), { t: 3, scale: 1 }), { kerf: 0.15, sheetW: 300 });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe("collision probe", () => {
  it("notices a tab that has no slot", () => {
    const spec = load("car.json");
    spec.parts.find(p => p.id === 6)!.holes = [];
    expect(collisions(buildPuzzle(spec, { t: 3, scale: 1 })).length).toBeGreaterThan(0);
  });
});
