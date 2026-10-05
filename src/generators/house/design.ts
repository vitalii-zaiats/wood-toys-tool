import { rng } from "../random";

// A design is the set of choices the generator makes for one house, in unit
// millimetres (scale 1). houseSpec() writes it out as a puzzle description.

export type OpeningShape = "rect" | "arch" | "round" | "diamond";

export interface Opening {
  shape: OpeningShape;
  cx: number; cy: number; w: number; h: number;
  // rect only: split into a cols x rows grid of panes
  cols: number; rows: number;
  sill: boolean; shutters: boolean; frame: boolean;
}

export type RoofPattern = "shingles" | "scales" | "planks" | "plain";

export interface HouseDesign {
  W: number; D: number; H: number; R: number;
  fingers: number;
  margin: number; eave: number; gableOverhang: number;
  front: Opening[]; back: Opening[]; sides: Opening[];
  doorX: number;
  roof: RoofPattern;
}

const plain = { cols: 1, rows: 1, sill: false, shutters: false, frame: false };

const EDGE = 10; // keep openings this far from wall corners (covers finger joints up to 6 mm ply)
const PAD = 4;   // clearance from floor and eaves
const GAP = 4;   // between neighbouring openings

export function randomDesign(seed: number): HouseDesign {
  const r = rng(seed);
  const W = r.int(32, 55) * 2, D = r.int(24, 45) * 2, H = r.int(36, 64), R = r.int(20, 46);
  const fingers = Math.max(3, 2 * Math.round((H / 9 - 1) / 2) + 1);

  // One window template for the whole house so it reads as one style.
  const style = r.pick(["panes", "panes", "arch", "round", "rect"] as const);
  const maxH = H - 2 * PAD - 4;
  let shape: OpeningShape = "rect", w = 12, h = 12, cols = 1, rows = 1;
  if (style === "panes") {
    const p = r.int(5, 8); cols = 2; rows = r.pick([2, 2, 3]);
    const hOf = () => rows * p + (rows - 1) * 2;
    while (hOf() > maxH && rows > 1) rows--;
    w = 2 * p + 2; h = hOf();
  } else if (style === "arch") {
    shape = "arch"; w = r.int(10, 14); h = Math.min(maxH, Math.round(w * (1.2 + r.next() * 0.5)));
  } else if (style === "round") {
    shape = "round"; w = h = r.int(11, 15);
  } else {
    w = r.int(9, 13); h = Math.min(maxH, r.int(11, 17));
  }
  const sill = style !== "round" && r.chance(0.8);
  const wantShutters = style !== "round" && r.chance(0.3);
  const lo = PAD + h / 2 + (sill ? 2 : 0), hi = H - PAD - h / 2;
  const winY = lo + (hi - lo) * 0.6;

  const halfW = (shutters: boolean) => w / 2 + (shutters ? 1 + 0.4 * w : sill ? 2 : 0);
  const win = (cx: number, shutters: boolean): Opening => ({ shape, cx, cy: winY, w, h, cols, rows, sill, shutters, frame: false });
  const maxCount = (span: number, shutters: boolean) => Math.floor(span / (2 * halfW(shutters) + GAP));
  // Up to `want` windows spread evenly over [x0, x1]; drops shutters before dropping windows.
  const row = (x0: number, x1: number, want: number): Opening[] => {
    const shutters = wantShutters && maxCount(x1 - x0, true) >= 1;
    const n = Math.min(want, maxCount(x1 - x0, shutters));
    const slot = (x1 - x0) / Math.max(n, 1);
    return Array.from({ length: n }, (_, i) => win(x0 + slot * (i + 0.5), shutters));
  };

  // Attic ornament, sized to stay clear of the roof slope and the windows below.
  const L = Math.hypot(W / 2, R), atticY = H + R * 0.32;
  const rMax = Math.min(7, (H + R - atticY) * (W / 2 / L) - PAD, atticY - H + 1);
  const atticShape = r.pick(["round", "round", "diamond", "arch", "none"] as const);
  const ar = rMax * (0.75 + r.next() * 0.25);
  const attic: Opening[] = atticShape === "none" || ar < 3.5 ? [] : [
    atticShape === "arch"
      ? { ...plain, shape: "arch", cx: 0, cy: atticY, w: ar, h: ar * 1.7 }
      : { ...plain, shape: atticShape, cx: 0, cy: atticY, w: ar * 2, h: ar * 2 },
  ];

  // Front: a door, centred or pushed to one side, with windows in what is left.
  const U = W / 2 - EDGE;
  const dw = r.int(13, 18), dh = r.int(22, Math.min(34, H - 10));
  const dHalf = dw / 2 + 1.6;
  const doorShape = r.pick(["rect", "rect", "arch"] as const);
  const layout = r.next(), side = r.pick([-1, 1]), frontWant = r.int(1, 2);
  const flank = U - dHalf - GAP;
  let doorX = 0, frontWins: Opening[] = [];
  if (layout < 0.45 && maxCount(flank, false) >= 1) {
    frontWins = [...row(-U, -dHalf - GAP, 1), ...row(dHalf + GAP, U, 1)];
  } else if (layout < 0.9 && maxCount(2 * U - 2 * dHalf - GAP, false) >= 1) {
    doorX = side * (U - dHalf);
    const edge = doorX - side * (dHalf + GAP);
    frontWins = side > 0 ? row(-U, edge, frontWant) : row(edge, U, frontWant);
  }
  const door: Opening = { ...plain, shape: doorShape, cx: doorX, cy: 4 + dh / 2, w: dw, h: dh, frame: true };

  const Us = D / 2 - EDGE;
  return {
    W, D, H, R, fingers,
    margin: r.int(8, 14), eave: r.int(5, 12), gableOverhang: r.int(4, 9),
    front: [door, ...frontWins, ...attic],
    back: [...row(-U, U, r.int(1, 3)), ...attic],
    sides: row(-Us, Us, r.int(1, 3)),
    doorX,
    roof: r.pick(["shingles", "shingles", "scales", "planks", "plain"] as const),
  };
}
