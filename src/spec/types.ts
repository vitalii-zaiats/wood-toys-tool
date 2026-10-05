import type { AssemblyStep } from "../model";

// The puzzle description format: what gets saved to and opened from disk.
//
// Every number may also be an expression string over the puzzle's params, e.g.
// "W/2 - t". Lengths are in millimetres at scale 1; `t` is the plywood thickness
// (it does not grow with scale) and `s` is the scale itself, for things that
// must keep a fixed real size ("4/s" is always 4 mm).

export type Num = number | string;
export type P2 = [Num, Num];
export type P3 = [Num, Num, Num];

// An outline is a closed path of vertices. A vertex can describe the edge leading
// to it from the previous vertex:
//  - tabs: tenons `tabLen` long and t deep, centred at the given distances along the edge
//  - fingers: the edge is cut into n equal cells; every second one is recessed by t
//    ("in") or sticks out by t ("out")
//  - arc: the edge bulges outward by this much (negative: inward)
// Outward is to the right of the travel direction, so draw outlines counter-clockwise.
export type EdgeSpec =
  | P2
  | { to: P2; tabs: Num[]; tabLen: Num }
  | { to: P2; fingers: Num; teeth: "in" | "out" }
  | { to: P2; arc: Num };

export type ShapeSpec =
  | { rect: [Num, Num, Num, Num] }   // x0, y0, x1, y1
  | { arch: [Num, Num, Num, Num] }   // rect with a semicircular top
  | { circle: [Num, Num, Num] }      // cx, cy, r
  | { poly: P2[] }
  // Involute spur gear. Tooth 0 points along +a; `phase` turns it by that many tooth pitches.
  // Two gears mesh when their centres are (teeth1 + teeth2) * module / 2 apart.
  | { gear: { at: P2; teeth: Num; module: Num; phase?: Num } };

// A shape used as a mark is engraved as its closed outline. `fill` is area engraving: the region
// bounded by the loops (even-odd, so a loop inside another is an island left untouched) is burnt dark.
export type MarkSpec =
  | ShapeSpec
  | { fill: P2[][] }
  | { line: P2[] }
  | { text: string; at: P2; h: Num; center?: boolean }; // digits, "+", "-", "." only

export interface PartSpec {
  id: number;
  name: string;
  // Placement in the assembled model: local (a, b) -> o + ea*a + eb*b, thickness along ea x eb.
  // The far face is the engraved one. Parts without `at` only appear on the cut sheet.
  at?: { o: P3; ea: P3; eb: P3 };
  explode?: P3;
  // A moving part: turns about the axis through `o` by `ratio` times the drive angle.
  // Meshing gears get ratios of opposite sign, inversely proportional to their tooth counts.
  spin?: { o: P3; axis: P3; ratio: Num };
  outline: EdgeSpec[] | ShapeSpec;
  // Flip the finished part left-to-right, so one drawing serves both sides of a symmetric model.
  mirror?: boolean;
  holes?: ShapeSpec[];
  engrave?: MarkSpec[];
  // The part number is engraved in the first free spot unless this is false.
  label?: boolean;
}

export interface PuzzleSpec {
  name: string;
  description?: string;
  // Set when a built-in generator can make variations of this puzzle from a seed.
  generator?: { name: string; seed: number };
  // The thickest plywood the model is designed for, in mm at scale 1 (thickness / scale must not exceed it).
  limits?: { maxT?: number };
  params?: Record<string, Num>; // evaluated top to bottom, later ones may use earlier ones
  parts: PartSpec[];
  steps?: AssemblyStep[];
}
