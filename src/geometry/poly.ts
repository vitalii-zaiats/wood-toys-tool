export type Pt = [number, number];
export type Poly = Pt[];
export interface BBox { x0: number; y0: number; x1: number; y1: number }

const EPS = 1e-7;

export function rect(x0: number, y0: number, x1: number, y1: number): Poly {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

export function circle(cx: number, cy: number, r: number, n = 48): Poly {
  const p: Poly = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return p;
}

// Rectangle with a semicircular top. Vertex 0 and 1 are the bottom corners.
export function arch(x0: number, y0: number, x1: number, y1: number, n = 16): Poly {
  const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, ys = y1 - r;
  const p: Poly = [[x0, y0], [x1, y0]];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; p.push([cx + r * Math.cos(a), ys + r * Math.sin(a)]); }
  return clean(p);
}

export function area(p: Poly): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

// Drop duplicate and collinear vertices.
export function clean(p: Poly): Poly {
  const out: Poly = [];
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > EPS) out.push(q); }
  if (out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) < EPS) out.pop(); }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cr) < 1e-9) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}

// Grow polygon by d (negative shrinks), independent of winding.
export function offset(poly: Poly, d: number): Poly {
  const p = clean(poly);
  if (!d) return p.map(q => [q[0], q[1]]);
  const sg = area(p) > 0 ? 1 : -1, n = p.length, out: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
    const n1 = [sg * e1[1] / l1, -sg * e1[0] / l1], n2 = [sg * e2[1] / l2, -sg * e2[0] / l2];
    const p1 = [a[0] + n1[0] * d, a[1] + n1[1] * d], p2 = [b[0] + n2[0] * d, b[1] + n2[1] * d];
    const den = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.abs(den) < 1e-12) { out.push([b[0] + n1[0] * d, b[1] + n1[1] * d]); continue; }
    const s = ((p2[0] - p1[0]) * e2[1] - (p2[1] - p1[1]) * e2[0]) / den;
    out.push([p1[0] + s * e1[0], p1[1] + s * e1[1]]);
  }
  return out;
}

export function bbox(polys: Poly[]): BBox {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of polys) for (const q of p) {
    b.x0 = Math.min(b.x0, q[0]); b.y0 = Math.min(b.y0, q[1]); b.x1 = Math.max(b.x1, q[0]); b.y1 = Math.max(b.y1, q[1]);
  }
  return b;
}

export function overlaps(a: BBox, b: BBox, gap = 0): boolean {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
}

// Incremental outline builder that skips repeated points.
export function path() {
  const pts: Poly = [];
  const add = (x: number, y: number) => {
    const l = pts[pts.length - 1];
    if (!l || Math.abs(l[0] - x) > 1e-9 || Math.abs(l[1] - y) > 1e-9) pts.push([x, y]);
  };
  return { pts, add };
}

export function inPoly(pt: Pt, poly: Poly): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// Involute spur gear centred on (cx, cy). Tooth 0 points along +x, shifted by `phase` tooth pitches.
// `backlash` thins every tooth by that much at the pitch circle so mating gears do not bind.
export function gear(cx: number, cy: number, teeth: number, module: number, phase = 0, backlash = 0): Poly {
  const pa = (20 * Math.PI) / 180, r = (module * teeth) / 2, rb = r * Math.cos(pa), ra = r + module, rf = r - 1.25 * module;
  const inv = (a: number) => Math.tan(a) - a;
  const half = (Math.PI * module / 2 - backlash) / (2 * r);
  // half-angle of the tooth at radius rho
  const halfAt = (rho: number) => half + inv(pa) - inv(Math.acos(Math.min(1, rb / rho)));
  const r0 = Math.max(rb, rf), N = 6, pts: Poly = [];
  const put = (rho: number, a: number) => pts.push([cx + rho * Math.cos(a), cy + rho * Math.sin(a)]);
  for (let k = 0; k < teeth; k++) {
    const c = ((k + phase) * 2 * Math.PI) / teeth;
    if (rf < rb) put(rf, c - halfAt(rb)); // below the base circle the flank is radial
    for (let i = 0; i <= N; i++) { const rho = r0 + ((ra - r0) * i) / N; put(rho, c - halfAt(rho)); }
    for (let i = N; i >= 0; i--) { const rho = r0 + ((ra - r0) * i) / N; put(rho, c + halfAt(rho)); }
    if (rf < rb) put(rf, c + halfAt(rb));
  }
  return pts;
}
