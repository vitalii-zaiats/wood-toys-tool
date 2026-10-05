import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inPoly, type Pt } from "../src/geometry/poly";
import type { Basis, Part, PuzzleModel, Vec3 } from "../src/model";
import { buildPuzzle } from "../src/spec/build";
import { parseSpec } from "../src/spec/file";
import type { PuzzleSpec } from "../src/spec/types";
import { exportSVG } from "../src/export/svg";

// Drive angles covering four turns of the input, deliberately not on a regular grid.
const TURN = Array.from({ length: 96 }, (_, i) => ((i + 1) * 8 * Math.PI) / 96 + 0.013 * i);
const DIR = "src/puzzles";
const FILES = readdirSync(DIR).filter(f => f.endsWith(".json"));
const load = (f: string) => parseSpec(readFileSync(`${DIR}/${f}`, "utf8"));

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const solid = (p: Part, q: Pt) => inPoly(q, p.outline) && !p.holes.some(h => inPoly(q, h));

// Turns a moving part to where it is when the mechanism's input is at `theta`.
function posed(p: Part, theta: number): Basis {
  const b = p.basis!;
  if (!p.spin) return b;
  const len = Math.hypot(...p.spin.axis), k = p.spin.axis.map(v => v / len) as Vec3, a = theta * p.spin.ratio;
  const rot = (v: Vec3): Vec3 => {
    const kxv = cross(k, v), kv = dot(k, v);
    return v.map((x, i) => x * Math.cos(a) + kxv[i] * Math.sin(a) + k[i] * kv * (1 - Math.cos(a))) as Vec3;
  };
  const o = rot(b.o.map((v, i) => v - p.spin!.o[i]) as Vec3).map((v, i) => v + p.spin!.o[i]) as Vec3;
  return { o, ea: rot(b.ea), eb: rot(b.eb) };
}

// Probes just inside every outline edge of every part, half-way through the sheet.
// A probe that sits in another part's material means two parts occupy the same space:
// a tab without a slot, a slot in the wrong place, a plate running through a wall.
function collisions(m: PuzzleModel, theta = 0): string[] {
  const placed = m.parts.filter(p => p.basis), t = m.t, bad: string[] = [];
  const pose = new Map(placed.map(p => [p, posed(p, theta)]));
  for (const a of placed) {
    const A = pose.get(a)!, ac = cross(A.ea, A.eb);
    for (let i = 0; i < a.outline.length; i++) {
      const p = a.outline[i], q = a.outline[(i + 1) % a.outline.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1) continue;
      for (const sg of [1, -1]) {
        const probe: Pt = [(p[0] + q[0]) / 2 + (sg * 0.3 * (q[1] - p[1])) / len, (p[1] + q[1]) / 2 - (sg * 0.3 * (q[0] - p[0])) / len];
        if (!solid(a, probe)) continue;
        const w = [0, 1, 2].map(k => A.o[k] + A.ea[k] * probe[0] + A.eb[k] * probe[1] + (ac[k] * t) / 2);
        for (const b of placed) {
          if (b === a) continue;
          const B = pose.get(b)!, d = w.map((v, k) => v - B.o[k]), c = dot(d, cross(B.ea, B.eb));
          if (c > 0.05 && c < t - 0.05 && solid(b, [dot(d, B.ea), dot(d, B.eb)])) bad.push(`${a.id} "${a.name}" runs into ${b.id} "${b.name}" near [${probe.map(v => v.toFixed(1))}]`);
        }
      }
    }
  }
  return bad;
}

// A model may declare the thickest plywood it is designed for; beyond that it is not expected to fit.
const tooThick = (file: string, t: number, scale: number) => t / scale > (load(file).limits?.maxT ?? Infinity);

describe.each(FILES)("gallery: %s", file => {
  it.each([[3, 1], [4.2, 1], [6, 0.7], [2, 1.8]])("parts do not run into each other (t=%s, scale=%s)", (t, scale) => {
    if (tooThick(file, t, scale)) return;
    expect(collisions(buildPuzzle(load(file), { t, scale }))).toEqual([]);
  });

  it.each([[3, 1], [4.2, 1], [6, 0.7], [2, 1.8]])("moving parts stay clear of everything through a full turn of the slowest shaft (t=%s, scale=%s)", (t, scale) => {
    const m = buildPuzzle(load(file), { t, scale });
    if (!m.parts.some(p => p.spin) || tooThick(file, t, scale)) return;
    for (const theta of TURN) expect(collisions(m, theta), `drive at ${theta.toFixed(2)} rad`).toEqual([]);
  });

  it("every hole sits inside its part with wood left around it", () => {
    const edgeGap = (q: Pt, poly: Pt[]) => Math.min(...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const f = l2 ? Math.min(1, Math.max(0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
      return Math.hypot(q[0] - a[0] - f * dx, q[1] - a[1] - f * dy);
    }));
    const thin: string[] = [];
    for (const p of buildPuzzle(load(file), { t: 3, scale: 1 }).parts) {
      p.holes.forEach((h, i) => {
        const gap = Math.min(...h.map(q => (inPoly(q, p.outline) ? edgeGap(q, p.outline) : -1)));
        if (gap < 1) thin.push(`${p.id} "${p.name}" hole ${i}: ${gap.toFixed(2)} mm to the edge`);
      });
    }
    expect(thin).toEqual([]);
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
  const hits = (edit: (spec: PuzzleSpec) => void) => {
    const spec = load("mill.json");
    edit(spec);
    const m = buildPuzzle(spec, { t: 3, scale: 1 });
    return TURN.reduce((n, theta) => n + collisions(m, theta).length, 0);
  };

  it("notices gears that are half a tooth out of mesh", () => {
    expect(hits(spec => { (spec.parts.find(p => p.id === 12)!.outline as { gear: { phase: number } }).gear.phase = 0.5; })).toBeGreaterThan(0);
  });

  it("notices a gear turning at the wrong ratio", () => {
    expect(hits(spec => { for (const p of spec.parts) if (p.spin?.ratio === 0.25) p.spin.ratio = 0.3; })).toBeGreaterThan(0);
  });

  it("notices the globe's hand wheel geared to turn the wrong way", () => {
    const spec = load("globe.json");
    for (const p of spec.parts) if (p.spin?.ratio === -0.6) p.spin.ratio = 0.6;
    const m = buildPuzzle(spec, { t: 3, scale: 1 });
    expect(TURN.reduce((n, theta) => n + collisions(m, theta).length, 0)).toBeGreaterThan(0);
  });

  it("notices blades long enough to hit the ground", () => {
    expect(hits(spec => { spec.params!.Yc = 60; spec.params!.Yb = 24; spec.params!.Ya = -12; })).toBeGreaterThan(0);
  });

  it("notices a tab that has no slot", () => {
    const spec = load("car.json");
    spec.parts.find(p => p.id === 6)!.holes = [];
    expect(collisions(buildPuzzle(spec, { t: 3, scale: 1 })).length).toBeGreaterThan(0);
  });
});
