import { arch, bbox, circle, clean, inPoly, overlaps, path, rect, type Poly, type Pt } from "../geometry/poly";
import { text7, text7Width } from "../geometry/text7";
import type { Part, PuzzleModel, Vec3 } from "../model";
import { evaluate, type Env } from "./expr";
import type { EdgeSpec, MarkSpec, Num, P2, P3, PuzzleSpec, ShapeSpec } from "./types";

const LAB = 4; // part number height, mm

// Engraves the part number in the first free spot, scanning up from the bottom-left.
// Prefers a spot clear of other engraving and joints, but will settle for one clear of holes.
function autoLabel(id: number, outline: Poly, holes: Poly[], engrave: Poly[], t: number): Poly[] {
  const label = String(id), lw = text7Width(label, LAB), pad = 1.5;
  const b = bbox([outline]), holeBoxes = holes.map(h => bbox([h])), markBoxes = engrave.map(l => bbox([l]));
  // Last resort for narrow parts: sit close to the edge.
  for (const [taken, grow] of [[[...holeBoxes, ...markBoxes], t + 1], [holeBoxes, t + 1], [holeBoxes, 0.5]] as const) {
    for (let y = b.y0; y + LAB <= b.y1; y += 2) {
      for (let x = b.x0 + lw / 2; x + lw / 2 <= b.x1; x += 2) {
        const box = { x0: x - lw / 2 - pad, y0: y - pad, x1: x + lw / 2 + pad, y1: y + LAB + pad };
        const corners: Pt[] = [[box.x0 - grow, box.y0 - grow], [box.x1 + grow, box.y0 - grow], [box.x1 + grow, box.y1 + grow], [box.x0 - grow, box.y1 + grow]];
        if (corners.every(c => inPoly(c, outline)) && !taken.some(o => overlaps(o, box))) return text7(label, x, y, LAB, true);
      }
    }
  }
  return [];
}

// Slots of t-0.2 .. t+0.2 to find the snug fit before cutting the real thing.
function testComb(id: number, t: number): Part {
  const deltas = [-0.2, -0.1, 0, 0.1, 0.2], pitch = 12, Wc = deltas.length * pitch + 6, Hc = 18, dep = 8;
  const P = path(), engrave: Poly[] = [];
  P.add(0, 0); P.add(Wc, 0); P.add(Wc, Hc);
  for (let i = deltas.length - 1; i >= 0; i--) {
    const cx = 3 + pitch / 2 + i * pitch, w = t + deltas[i];
    P.add(cx + w / 2, Hc); P.add(cx + w / 2, Hc - dep); P.add(cx - w / 2, Hc - dep); P.add(cx - w / 2, Hc);
  }
  P.add(0, Hc);
  deltas.forEach((d, i) => {
    const label = d === 0 ? "0" : (d > 0 ? "+" : "-") + "." + Math.round(Math.abs(d) * 10);
    engrave.push(...text7(label, 3 + pitch / 2 + i * pitch, 3, 4, true));
  });
  return { id, name: "Тестова гребінка", outline: clean(P.pts), holes: [], engrave };
}

// Turns a description into concrete parts for one plywood thickness and scale.
// Throws an Error with a readable message when the description is broken.
export function buildPuzzle(spec: PuzzleSpec, par: { t: number; scale: number }): PuzzleModel {
  const s = par.scale;
  // Everything is evaluated at scale 1 with the thickness shrunk to match, then scaled up,
  // so "W/2 - t" stays exactly one real thickness away from the edge at any scale.
  const env: Env = { t: par.t / s, s };
  const t = env.t;
  let where = "params";
  const num = (v: Num): number => {
    const x = typeof v === "number" ? v : typeof v === "string" ? evaluate(v, env) : NaN;
    if (!Number.isFinite(x)) throw new Error(`${where}: "${String(v)}" не є числом`);
    return x;
  };
  const list = <T>(v: T[] | undefined, what: string): T[] => {
    if (v !== undefined && !Array.isArray(v)) throw new Error(`${where}: ${what} має бути списком`);
    return v ?? [];
  };
  const pt = (p: P2): Pt => [num(list(p, "точка")[0]), num(p[1])];
  const vec = (p: P3): Vec3 => [num(list(p, "вектор")[0]), num(p[1]), num(p[2])];
  const up = (p: Poly): Poly => p.map(q => [q[0] * s, q[1] * s]);

  for (const [k, v] of Object.entries(spec.params ?? {})) env[k] = num(v);

  function outlineOf(edges: EdgeSpec[]): Poly {
    const P = path();
    let prev: Pt | null = null;
    for (const e of edges) {
      const to = pt(Array.isArray(e) ? e : e.to);
      if (prev && !Array.isArray(e)) {
        const len = Math.hypot(to[0] - prev[0], to[1] - prev[1]), p0 = prev;
        const u = [(to[0] - p0[0]) / len, (to[1] - p0[1]) / len], nr = [u[1], -u[0]];
        const at = (d: number, k: number): Pt => [p0[0] + u[0] * d + nr[0] * k, p0[1] + u[1] * d + nr[1] * k];
        if ("tabs" in e) {
          const half = num(e.tabLen) / 2;
          for (const d of list(e.tabs, "tabs").map(num).sort((a, b) => a - b)) {
            P.add(...at(d - half, 0)); P.add(...at(d - half, t)); P.add(...at(d + half, t)); P.add(...at(d + half, 0));
          }
        } else if ("fingers" in e) {
          const n = Math.round(num(e.fingers)), shift = e.teeth === "out" ? t : -t;
          for (let i = 0; i < n; i++) { const k = i % 2 ? shift : 0; P.add(...at((i * len) / n, k)); P.add(...at(((i + 1) * len) / n, k)); }
        } else if ("arc" in e) {
          const b = num(e.arc), h = Math.abs(b), sg = Math.sign(b);
          if (h > 1e-9) {
            // Circle through both ends and the apex; walk it from one end to the other.
            const r = (len * len / 4 + h * h) / (2 * h), th = Math.atan2(len / 2, r - h);
            for (let i = 1; i < 12; i++) {
              const f = -th + (2 * th * i) / 12;
              P.add(...at(len / 2 + r * Math.sin(f), sg * (r * Math.cos(f) - (r - h))));
            }
          }
        }
      }
      P.add(...to);
      prev = to;
    }
    const out = clean(P.pts);
    if (out.length < 3) throw new Error(`${where}: контур має містити щонайменше три точки`);
    return out;
  }
  const isShape = (v: object): v is ShapeSpec => "rect" in v || "arch" in v || "circle" in v || "poly" in v;
  function shapeOf(h: ShapeSpec): Poly {
    if (typeof h !== "object" || h === null) throw new Error(`${where}: отвір має бути об'єктом`);
    if ("rect" in h) { const [a, b, c, d] = list(h.rect, "rect").map(num); return rect(a, b, c, d); }
    if ("arch" in h) { const [a, b, c, d] = list(h.arch, "arch").map(num); return arch(a, b, c, d); }
    if ("circle" in h) { const [cx, cy, r] = list(h.circle, "circle").map(num); return circle(cx, cy, r); }
    if ("poly" in h) return list(h.poly, "poly").map(pt);
    throw new Error(`${where}: невідомий тип отвору`);
  }
  function marksOf(m: MarkSpec): Poly[] {
    if (typeof m !== "object" || m === null) throw new Error(`${where}: гравіювання має бути об'єктом`);
    if ("line" in m) return [list(m.line, "line").map(pt)];
    if (isShape(m)) { const p = shapeOf(m); return [[...p, p[0]]]; }
    if ("text" in m) { const [x, y] = pt(m.at); return text7(String(m.text), x, y, num(m.h), m.center ?? false); }
    throw new Error(`${where}: невідомий тип гравіювання`);
  }

  const parts: Part[] = [];
  let lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of list(spec.parts, "parts")) {
    where = `Деталь ${p.id}`;
    const flip = (q: Poly): Poly => (p.mirror ? q.map(([x, y]) => [-x, y]) : q);
    const drawn = Array.isArray(p.outline) || typeof p.outline !== "object" ? outlineOf(list(p.outline, "outline")) : shapeOf(p.outline);
    const outline = up(flip(drawn));
    const holes = list(p.holes, "holes").map(h => up(flip(shapeOf(h))));
    const engrave = list(p.engrave, "engrave").flatMap(marksOf).map(q => up(flip(q)));
    if (p.label !== false) engrave.push(...autoLabel(p.id, outline, holes, engrave, par.t));
    const part: Part = { id: p.id, name: String(p.name ?? `Деталь ${p.id}`), outline, holes, engrave };
    if (p.at) {
      const o = vec(p.at.o).map(v => v * s) as Vec3, ea = vec(p.at.ea), eb = vec(p.at.eb);
      part.basis = { o, ea, eb };
      part.explode = p.explode ? (vec(p.explode).map(v => v * s) as Vec3) : [0, 0, 0];
      const ec = [ea[1] * eb[2] - ea[2] * eb[1], ea[2] * eb[0] - ea[0] * eb[2], ea[0] * eb[1] - ea[1] * eb[0]];
      for (const q of outline) for (const c of [0, par.t]) for (let i = 0; i < 3; i++) {
        const v = o[i] + ea[i] * q[0] + eb[i] * q[1] + ec[i] * c;
        lo[i] = Math.min(lo[i], v); hi[i] = Math.max(hi[i], v);
      }
    }
    parts.push(part);
  }
  if (!parts.length) throw new Error("У файлі немає жодної деталі.");
  parts.sort((a, b) => a.id - b.id);
  if (new Set(parts.map(p => p.id)).size !== parts.length) throw new Error("Номери деталей повторюються.");
  const placed = parts.filter(p => p.basis);
  if (!placed.length) { lo = [0, 0, 0]; hi = [100, 100, 100]; }
  parts.push(testComb(parts[parts.length - 1].id + 1, par.t));

  return {
    name: String(spec.name ?? "Пазл"),
    t: par.t,
    parts,
    steps: spec.steps?.length ? spec.steps : placed.map(p => ({ ids: [p.id], text: p.name })),
    bounds: { size: Math.max(hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]), focusY: lo[1] + (hi[1] - lo[1]) * 0.35, minY: lo[1] },
  };
}
