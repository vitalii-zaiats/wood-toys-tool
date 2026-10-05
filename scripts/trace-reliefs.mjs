// One-off: turns black-on-white line drawings into vectors for the arch model.
// Usage: node scripts/trace-reliefs.mjs <reliefs.bmp> <entablature.bmp> > scripts/arch-reliefs.json
// (make the BMPs with `sips -s format bmp`). Three kinds of result, per region:
//   lines   - centre lines of the strokes, for line engraving
//   outline - the outer silhouette with a flat base, for cutting a free-standing piece
//   fill    - the background between the figures inside a frame, for area engraving (dark ground, light figures)
import { readFileSync } from "node:fs";

// Work at twice the resolution: thin anti-aliased strokes survive the threshold and thin more cleanly.
const K = 2, THRESHOLD = 190;

function load(path) {
  const buf = readFileSync(path);
  const off = buf.readUInt32LE(10), W = buf.readInt32LE(18), Hs = buf.readInt32LE(22), bpp = buf.readUInt16LE(28) / 8;
  const H = Math.abs(Hs), stride = Math.ceil((W * bpp) / 4) * 4, gray = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = off + (Hs > 0 ? H - 1 - y : y) * stride;
    for (let x = 0; x < W; x++) { const p = row + x * bpp; gray[y * W + x] = (buf[p] + buf[p + 1] + buf[p + 2]) / 3; }
  }
  return { W, H, gray };
}

const rdp = (pts, eps) => {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let worst = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / len; if (d > worst) { worst = d; at = i; } }
  return worst <= eps ? [a, b] : [...rdp(pts.slice(0, at + 1), eps).slice(0, -1), ...rdp(pts.slice(at), eps)];
};

// Simplifies a closed loop: split it at the point farthest from the start, then simplify both halves.
const rdpLoop = (l, eps) => {
  let far = 0, best = -1;
  l.forEach((p, i) => { const d = Math.hypot(p[0] - l[0][0], p[1] - l[0][1]); if (d > best) { best = d; far = i; } });
  return [...rdp(l.slice(0, far + 1), eps).slice(0, -1), ...rdp([...l.slice(far), l[0]], eps).slice(0, -1)];
};

// Boundary loops of a mask as pixel-edge paths, mask kept on the left.
function loopsOf(mask, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const next = new Map(), key = (x, y) => x + y * (w + 1);
  const add = (ax, ay, bx, by) => { const k = key(ax, ay); (next.get(k) ?? next.set(k, []).get(k)).push([bx, by]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    if (!at(x, y - 1)) add(x + 1, y, x, y);
    if (!at(x, y + 1)) add(x, y + 1, x + 1, y + 1);
    if (!at(x - 1, y)) add(x, y, x, y + 1);
    if (!at(x + 1, y)) add(x + 1, y + 1, x + 1, y);
  }
  const loops = [];
  for (const [k, list] of next) while (list.length) {
    const loop = []; let cur = [k % (w + 1), Math.floor(k / (w + 1))];
    for (;;) { const l = next.get(key(cur[0], cur[1])); if (!l || !l.length) break; loop.push(cur); cur = l.pop(); }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function trace(img, { x0, x1, y0, y1 }, mode, opt = {}) {
  const pad = mode === "outline" ? 4 : 0;
  const w = (x1 - x0 + 1) * K, h = (y1 - y0 + 1 + pad) * K, g = new Uint8Array(w * h), { W, H, gray } = img;
  const sample = (fx, fy) => {
    const X = Math.min(W - 2, Math.max(0, Math.floor(fx))), Y = Math.min(H - 2, Math.max(0, Math.floor(fy))), u = fx - X, v = fy - Y;
    return gray[Y * W + X] * (1 - u) * (1 - v) + gray[Y * W + X + 1] * u * (1 - v) + gray[(Y + 1) * W + X] * (1 - u) * v + gray[(Y + 1) * W + X + 1] * u * v;
  };
  for (let y = 0; y < (y1 - y0 + 1) * K; y++) for (let x = 0; x < w; x++) g[y * w + x] = sample(x0 + (x + 0.5) / K - 0.5, y0 + (y + 0.5) / K - 0.5) < THRESHOLD ? 1 : 0;
  const at = (a, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : a[y * w + x]);
  const thick = r => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) o[Y * w + X] = 1; } return o; };
  const flood = (wall, seeds, inside = () => true) => {
    const out = new Uint8Array(w * h), stack = [...seeds];
    while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= w || y >= h || out[y * w + x] || wall[y * w + x] || !inside(x, y)) continue; out[y * w + x] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    return out;
  };
  // back to source pixels, y up
  const round = l => l.map(([x, y]) => [Math.round((x / K) * 10) / 10, Math.round(((h - y) / K) * 10) / 10]);
  const eps = (opt.eps ?? 0.5) * K, minLen = (opt.minLen ?? 5) * K;

  let outline = null, keep = null, fill = null;
  if (mode === "outline") {
    // everything the background cannot reach from the border is the figure
    const seeds = [];
    for (let x = 0; x < w; x++) seeds.push([x, 0], [x, h - 1]);
    for (let y = 0; y < h; y++) seeds.push([0, y], [w - 1, y]);
    const blob = flood(thick(2), seeds).map(v => 1 - v);
    // flat plinth under the figure so the piece has a straight edge to stand on
    let bottom = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (blob[y * w + x]) bottom = y;
    let px0 = w, px1 = 0; for (let y = bottom - 6 * K; y <= bottom; y++) for (let x = 0; x < w; x++) if (blob[y * w + x]) { px0 = Math.min(px0, x); px1 = Math.max(px1, x); }
    for (let y = bottom - 5 * K; y <= bottom + 2 * K; y++) for (let x = px0; x <= px1; x++) blob[y * w + x] = 1;
    const best = loopsOf(blob, w, h).sort((a, b) => b.length - a.length)[0];
    // start at the bottom-left corner so the first edge is the base
    const maxY = Math.max(...best.map(p => p[1])), base = best.filter(p => p[1] === maxY), minX = Math.min(...base.map(p => p[0])), maxX = Math.max(...base.map(p => p[0]));
    const s = best.findIndex(p => p[1] === maxY && p[0] === minX), loop = [...best.slice(s), ...best.slice(0, s)];
    outline = round([loop[0], ...rdp(loop.slice(loop.findIndex(p => p[1] === maxY && p[0] === maxX)), 0.9 * K)]);
    // engraving must stay off the cut edge
    keep = Uint8Array.from(blob);
    for (let r = 0; r < 3 * K; r++) { const e = Uint8Array.from(keep); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep[y * w + x] && !(at(keep, x - 1, y) && at(keep, x + 1, y) && at(keep, x, y - 1) && at(keep, x, y + 1))) e[y * w + x] = 0; keep.set(e); }
  }
  if (mode === "fill") {
    // The scene sits inside a frame: the innermost long rules near each edge. Whatever white the top of
    // that frame can reach without crossing a stroke is background.
    const longRows = [], longCols = [];
    for (let y = 0; y < h; y++) { let run = 0, best = 0; for (let x = 0; x < w; x++) { run = g[y * w + x] ? run + 1 : 0; best = Math.max(best, run); } if (best > 0.55 * w) longRows.push(y); }
    for (let x = 0; x < w; x++) { let run = 0, best = 0; for (let y = 0; y < h; y++) { run = g[y * w + x] ? run + 1 : 0; best = Math.max(best, run); } if (best > 0.45 * h) longCols.push(x); }
    const top = Math.max(-1, ...longRows.filter(y => y < h * 0.4)), bottom = Math.min(h, ...longRows.filter(y => y > h * 0.6));
    // in a long band only rules right at the ends count as its sides
    const zone = opt.sideZone ?? 0.3;
    const left = Math.max(-1, ...longCols.filter(x => x < w * zone)), right = Math.min(w, ...longCols.filter(x => x > w * (1 - zone)));
    const seeds = [];
    for (let x = left + 2; x < right - 1; x++) seeds.push([x, top + 2 * K]);
    const bg = flood(thick(1), seeds, (x, y) => x > left && x < right && y > top && y < bottom);
    if (process.env.DEBUG) console.error({ w, h, top, bottom, left, right, longRows: longRows.length, longCols: longCols.length, bg: bg.reduce((a, b) => a + b, 0) });
    // one group of loops per connected patch: its outer edge plus the islands inside it
    const label = new Int32Array(w * h); fill = [];
    for (let i = 0; i < w * h; i++) {
      if (!bg[i] || label[i]) continue;
      const patch = new Uint8Array(w * h), stack = [i]; let n = 0;
      while (stack.length) { const j = stack.pop(); if (label[j] || !bg[j]) continue; label[j] = 1; patch[j] = 1; n++; const x = j % w; if (x > 0) stack.push(j - 1); if (x < w - 1) stack.push(j + 1); if (j >= w) stack.push(j - w); if (j < w * (h - 1)) stack.push(j + w); }
      if (n < 12 * K * K) continue;
      const group = loopsOf(patch, w, h).filter(l => l.length > 8 * K).map(l => round(rdpLoop(l, eps))).filter(l => l.length > 2);
      if (group.length) fill.push(group);
    }
  }

  // Zhang-Suen thinning of the strokes
  const sk = Uint8Array.from(g);
  for (let changed = true; changed;) {
    changed = false;
    for (const pass of [0, 1]) {
      const kill = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!sk[y * w + x]) continue;
        const n = [at(sk, x, y - 1), at(sk, x + 1, y - 1), at(sk, x + 1, y), at(sk, x + 1, y + 1), at(sk, x, y + 1), at(sk, x - 1, y + 1), at(sk, x - 1, y), at(sk, x - 1, y - 1)];
        const B = n.reduce((a, b) => a + b, 0); let A = 0;
        for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) A++;
        if (B < 2 || B > 6 || A !== 1) continue;
        if (pass === 0 ? n[0] * n[2] * n[4] || n[2] * n[4] * n[6] : n[0] * n[2] * n[6] || n[0] * n[4] * n[6]) continue;
        kill.push(y * w + x);
      }
      for (const i of kill) sk[i] = 0;
      changed ||= kill.length > 0;
    }
  }
  if (keep) for (let i = 0; i < sk.length; i++) if (!keep[i]) sk[i] = 0;
  // walk the skeleton into polylines, breaking at ends and junctions;
  // a diagonal neighbour does not count when a straight step already leads to it
  const nb = (x, y) => {
    const r = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(sk, x + dx, y + dy)) r.push([x + dx, y + dy]);
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (at(sk, x + dx, y + dy) && !at(sk, x + dx, y) && !at(sk, x, y + dy)) r.push([x + dx, y + dy]);
    return r;
  };
  const used = new Set(), lines = [], id = p => p[0] + p[1] * w, ek = (a, b) => (id(a) < id(b) ? id(a) * w * h + id(b) : id(b) * w * h + id(a));
  const walk = (a, b) => {
    const path = [a, b]; used.add(ek(a, b));
    for (;;) {
      const cur = path[path.length - 1], ns = nb(cur[0], cur[1]);
      if (ns.length !== 2) break;
      const nx = ns.find(p => !used.has(ek(cur, p)));
      if (!nx) break;
      used.add(ek(cur, nx)); path.push(nx);
    }
    return path;
  };
  for (const nodesOnly of [true, false]) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!sk[y * w + x]) continue;
    const ns = nb(x, y);
    if (nodesOnly && ns.length === 2) continue;
    for (const p of ns) if (!used.has(ek([x, y], p))) lines.push(walk([x, y], p));
  }
  const len = l => l.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0);
  return {
    w: w / K, h: h / K, outline, fill,
    lines: lines.filter(l => len(l) >= minLen).map(l => {
      const c = l.map(([x, y]) => [x + 0.5, y + 0.5]), closed = l.length > 3 && l[0][0] === l[l.length - 1][0] && l[0][1] === l[l.length - 1][1];
      if (!closed) return round(rdp(c, eps));
      const loop = rdpLoop(c.slice(0, -1), eps); // a ring: simplify as a loop, then close it again
      return round([...loop, loop[0]]);
    }),
  };
}

// ---- sheet 1: a row of separate relief drawings along the bottom, found by the blank gaps between them
const sheet = load(process.argv[2]);
const band = [Math.round(sheet.H * 0.79), Math.round(sheet.H * 0.955)], dark = (x, y) => sheet.gray[y * sheet.W + x] < 150;
const boxes = [];
for (let x = 0, start = -1, gap = 0; x <= sheet.W; x++) {
  let on = false;
  if (x < sheet.W) for (let y = band[0]; y < band[1]; y++) if (dark(x, y)) { on = true; break; }
  if (on) { if (start < 0) start = x; gap = 0; }
  else if (start >= 0 && (++gap > 12 || x === sheet.W)) { boxes.push([start, x - gap]); start = -1; }
}
const panels = boxes.filter(([a, b]) => b - a > 60).map(([x0, x1]) => {
  let y0 = band[1], y1 = band[0];
  for (let y = band[0]; y < band[1]; y++) for (let x = x0; x <= x1; x++) if (dark(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0: x0 - 2, x1: x1 + 2, y0: y0 - 2, y1: y1 + 2 };
});
// ---- sheet 2: the entablature, in horizontal bands (rows measured on the drawing)
const top = load(process.argv[3]);

process.stdout.write(JSON.stringify({
  upperLeft: trace(sheet, panels[0], "fill"),
  upperRight: trace(sheet, panels[1], "fill"),
  lowerLeft: trace(sheet, panels[2], "outline"),
  lowerRight: trace(sheet, panels[3], "outline"),
  crest: trace(top, { x0: 40, x1: 1960, y0: 19, y1: 90 }, "outline", { eps: 0.8, minLen: 9 }),
  crestSide: trace(top, { x0: 15, x1: 575, y0: 19, y1: 90 }, "outline", { eps: 0.8, minLen: 9 }),
  attic: trace(top, { x0: 20, x1: 1980, y0: 86, y1: 412 }, "lines", { eps: 0.9, minLen: 9 }),
  frieze: trace(top, { x0: 40, x1: 1950, y0: 404, y1: 500 }, "fill", { eps: 0.7, minLen: 7, sideZone: 0.03 }),
  // a stretch of the same frieze for the short sides, at the same scale
  friezeSide: trace(top, { x0: 640, x1: 1300, y0: 404, y1: 500 }, "fill", { eps: 0.7, minLen: 7, sideZone: 0 }),
}));
