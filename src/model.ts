import type { Poly } from "./geometry/poly";

export type Vec3 = [number, number, number];

// Where a flat part sits in the assembled model: local (a, b) -> o + ea*a + eb*b,
// thickness extrudes along ea x eb. The engraved face is the far (+thickness) one.
export interface Basis { o: Vec3; ea: Vec3; eb: Vec3 }

export interface Part {
  id: number;
  name: string;
  outline: Poly;
  holes: Poly[];
  engrave: Poly[];
  // Parts without a basis only exist on the cut sheet (e.g. the test comb).
  basis?: Basis;
  explode?: Vec3;
}

export interface AssemblyStep { ids: number[]; text: string }

export interface PuzzleModel {
  name: string;
  t: number;
  parts: Part[];
  steps: AssemblyStep[];
  // Overall extent, the height the camera looks at, and the lowest point (where the table is).
  bounds: { size: number; focusY: number; minY: number };
}
