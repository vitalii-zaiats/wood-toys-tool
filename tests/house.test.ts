import { describe, expect, it } from "vitest";
import { exportSVG } from "../src/export/svg";
import { bbox, inPoly, overlaps, type Poly, type Pt } from "../src/geometry/poly";
import { randomDesign } from "../src/generators/house/design";
import { houseSpec } from "../src/generators/house/spec";
import type { Part, PuzzleModel, Vec3 } from "../src/model";
import classicHouse from "../src/puzzles/house.json";
import { buildPuzzle } from "../src/spec/build";
import { formatSpec, parseSpec } from "../src/spec/file";
import type { PuzzleSpec } from "../src/spec/types";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const CLASSIC = classicHouse as unknown as PuzzleSpec;
const generated = (seed: number) => houseSpec(randomDesign(seed), seed);

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function toWorld(p: Part, q: Pt, c: number): Vec3 {
  const { o, ea, eb } = p.basis!, ec = cross(ea, eb);
  return [0, 1, 2].map(i => o[i] + ea[i] * q[0] + eb[i] * q[1] + ec[i] * c) as Vec3;
}
function toLocal(p: Part, w: Vec3): Vec3 {
  const { o, ea, eb } = p.basis!, d = w.map((v, i) => v - o[i]);
  return [dot(d, ea), dot(d, eb), dot(d, cross(ea, eb))];
}
function onOrIn(pt: Pt, poly: Poly) {
  if (inPoly(pt, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tt = ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / l / l;
    if (tt < -1e-9 || tt > 1 + 1e-9) continue;
    if (Math.hypot(a[0] + tt * (b[0] - a[0]) - pt[0], a[1] + tt * (b[1] - a[1]) - pt[1]) < 1e-6) return true;
  }
  return false;
}

// Counts tab vertices that do not land inside a matching slot of the mating part.
// H is the eaves height in real millimetres.
function misfits(house: PuzzleModel, H: number): number {
  const t = house.t, P = (id: number) => house.parts.find(p => p.id === id)!;
  let bad = 0;
  for (const wid of [2, 3, 4, 5]) {
    for (const q of P(wid).outline) {
      if (q[1] >= -1e-9) continue; // bottom tab -> base
      for (const c of [0, t]) {
        const l = toLocal(P(1), toWorld(P(wid), q, c));
        if (!(Math.abs(l[2] - t / 2) <= t / 2 + 1e-6 && P(1).holes.some(h => onOrIn([l[0], l[1]], h)))) bad++;
      }
    }
  }
  for (const gid of [2, 3]) {
    for (const q of P(gid).outline) {
      if (q[1] <= H + 1e-6) continue; // roof tab -> either roof half
      for (const c of [0, t]) {
        const w = toWorld(P(gid), q, c);
        const ok = [6, 7].some(rid => {
          const r = P(rid), l = toLocal(r, w);
          if (l[2] <= -1e-6 || l[2] > t + 1e-6) return false;
          if (l[2] < 1e-6) return onOrIn([l[0], l[1]], r.outline) || l[0] < 1e-6; // resting on the underside
          return r.holes.some(h => onOrIn([l[0], l[1]], h));
        });
        if (!ok) bad++;
      }
    }
  }
  return bad;
}

const CASES = [[3, 1], [4.2, 1], [6, 0.7], [2, 1.8]];

describe("house joints", () => {
  it.each(CASES)("classic house file: tabs land in slots (t=%s, scale=%s)", (t, scale) => {
    expect(misfits(buildPuzzle(CLASSIC, { t, scale }), 45 * scale)).toBe(0);
  });

  it.each(CASES)("generated houses: tabs land in slots for every seed (t=%s, scale=%s)", (t, scale) => {
    for (const seed of SEEDS) {
      const d = randomDesign(seed);
      expect(misfits(buildPuzzle(houseSpec(d, seed), { t, scale }), d.H * scale), `seed ${seed}`).toBe(0);
    }
  });
});

describe("generated house openings", () => {
  const t = 3, clear = 2;
  const wallHoles = (seed: number) => {
    const parts = buildPuzzle(generated(seed), { t, scale: 1 }).parts;
    return [2, 3, 4].map(id => parts.find(p => p.id === id)!.holes);
  };

  it("stay inside the wall body", () => {
    for (const seed of SEEDS) {
      const d = randomDesign(seed), cth = d.W / 2 / Math.hypot(d.W / 2, d.R);
      wallHoles(seed).forEach((holes, i) => {
        const where = `seed ${seed} wall ${i + 2}`, gable = i < 2;
        for (const hole of holes) for (const [x, y] of hole) {
          expect(Math.abs(x), where).toBeLessThanOrEqual((gable ? d.W : d.D) / 2 - t - clear);
          expect(y, where).toBeGreaterThanOrEqual(clear);
          if (gable) expect((d.H + d.R - y - (Math.abs(x) * d.R) / (d.W / 2)) * cth, where).toBeGreaterThanOrEqual(clear);
          else expect(y, where).toBeLessThanOrEqual(d.H - clear);
        }
      });
    }
  });

  it("do not overlap each other", () => {
    for (const seed of SEEDS) {
      wallHoles(seed).forEach((holes, w) => {
        const boxes = holes.map(h => bbox([h]));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j], 1), `seed ${seed} wall ${w + 2} ${i}/${j}`).toBe(false);
        }
      });
    }
  });

  it("every wall gets its number engraved", () => {
    for (const seed of SEEDS) {
      const spec = generated(seed), built = buildPuzzle(spec, { t, scale: 1 });
      for (const id of [2, 3, 4, 5]) {
        const marks = spec.parts.find(p => p.id === id)!.engrave?.length ?? 0;
        expect(built.parts.find(p => p.id === id)!.engrave.length, `seed ${seed} part ${id}`).toBeGreaterThan(marks);
      }
    }
  });
});

describe("generator", () => {
  const svg = (spec: PuzzleSpec) => exportSVG(buildPuzzle(spec, { t: 3, scale: 1 }), { kerf: 0.15, sheetW: 300 });

  it("is deterministic per seed and varies between seeds", () => {
    expect(svg(generated(42)).svg).toBe(svg(generated(42)).svg);
    expect(svg(generated(42)).svg).not.toBe(svg(generated(43)).svg);
  });

  it("survives a trip through a file", () => {
    for (const seed of [1, 2, 3, 42]) expect(svg(parseSpec(formatSpec(generated(seed)))).svg).toBe(svg(generated(seed)).svg);
  });

  it("writes every part once and nothing but finite numbers", () => {
    for (const seed of SEEDS) {
      const sheet = svg(generated(seed));
      expect(sheet.svg, `seed ${seed}`).not.toMatch(/NaN|Infinity/);
      expect(sheet.svg.split('<g id="cut-outer"')[1].match(/<path/g)).toHaveLength(8);
    }
  });
});
