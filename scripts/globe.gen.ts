// One-off generator for src/puzzles/globe.json (the lattice is trigonometry and the map is data, not hand-typed JSON).
// To rerun: copy to tests/_gen.test.ts, run `npx vitest run tests/_gen.test.ts`, delete the copy.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { formatSpec } from "../src/spec/file";
import type { EdgeSpec, Num, P2, P3, PartSpec, PuzzleSpec, ShapeSpec } from "../src/spec/types";

it("gen", () => {
  const rad = Math.PI / 180, r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const TILT = 23.4 * rad, YC = 84, RG = 45, RI = 33;
  const k = [Math.sin(TILT), Math.cos(TILT), 0], e1 = [Math.cos(TILT), -Math.sin(TILT), 0], e2 = [0, 0, -1];
  const E1: P3 = [r4(e1[0]), r4(e1[1]), 0], K: P3 = [r4(k[0]), r4(k[1]), 0], nZ: P3 = [0, 0, -1], Z: P3 = [0, 0, 1];
  const spin = { o: [0, YC, 0] as P3, axis: K, ratio: 0.3 };
  // the hand wheel sits 36 mm in front of the globe axis and turns twice as fast, the other way
  const CZ = 36, crank = { o: [0, YC, CZ] as P3, axis: K, ratio: -0.6 };
  const sq: ShapeSpec = { rect: ["-t/2", "-t/2", "t/2", "t/2"] };
  const term = (c: number, what: string) => `(${r4(c)})*${what}`;
  const mix = (a: number[], x: number, b: number[], y: number) => a.map((v, i) => v * x + b[i] * y);

  // ---------- the faceted sphere ----------
  // Meridians are polygons with corners on these latitudes, so that a flat land tile can lie on each straight facet.
  const P = (lat: number): [number, number] => [RG * Math.cos(lat * rad), RG * Math.sin(lat * rad)];
  const HT = P(35)[1], HP = P(60)[1];
  // latitude pieces: h along the axis, rho outer radius (kept inside the facets), uh where the half-lap with the ribs splits
  const LAT = { eq: { h: 0, rho: 43.3, uh: 38.3 }, tropic: { h: r4(HT), rho: 31.9, uh: 26.9 }, polar: { h: r4(HP), rho: 22.5, uh: 14 } };
  // longitude 15E sits on the first long meridian; azimuth around the axis grows eastwards
  const azimuth = (lon: number) => (lon + 7.5) * rad;
  const LONG = Array.from({ length: 8 }, (_, j) => 15 + 45 * j), SHORT = LONG.map(l => l + 22.5);
  const frame = (lon: number) => {
    const c = Math.cos(azimuth(lon)), s = Math.sin(azimuth(lon));
    return { eu: mix(e1, c, e2, s), tau: mix(e1, -s, e2, c), n: [s * e1[0], s * e1[1], c] };
  };

  const ringOutline = (rho: number, uh: number, count: number): P2[] => {
    const root = `sqrt(${r4(rho * rho)}-t*t/4)`, out: P2[] = [], step = 360 / count;
    for (let i = 0; i < count; i++) {
      const deg = count === 8 ? 22.5 + 45 * i : 22.5 * i;
      for (const d of count === 8 ? [-33, -22.5, -12] : [-step / 2]) out.push([r4(rho * Math.cos((deg + d) * rad)), r4(rho * Math.sin((deg + d) * rad))]);
      const c = Math.cos(deg * rad), s = Math.sin(deg * rad);
      out.push(
        [`${term(c, root)}+${term(s, "t/2")}`, `${term(s, root)}-${term(c, "t/2")}`],
        [`${r4(c * uh)}+${term(s, "t/2")}`, `${r4(s * uh)}-${term(c, "t/2")}`],
        [`${r4(c * uh)}-${term(s, "t/2")}`, `${r4(s * uh)}+${term(c, "t/2")}`],
        [`${term(c, root)}-${term(s, "t/2")}`, `${term(s, root)}+${term(c, "t/2")}`],
      );
    }
    return out;
  };
  const ring = (id: number, name: string, lat: { h: number; rho: number; uh: number }, sgn: number, count: number, holes: ShapeSpec[]): PartSpec => ({
    id, name, spin, label: false,
    at: { o: [`(${K[0]})*(${sgn * lat.h}-t/2)`, `${YC}+(${K[1]})*(${sgn * lat.h}-t/2)`, 0], ea: E1, eb: nZ },
    outline: ringOutline(lat.rho, lat.uh, count), holes,
  });
  const windows: ShapeSpec[] = [0, 90, 180, 270].map(base => {
    const R = LAT.eq.rho - 10, pts: P2[] = [], a0 = Math.asin(3 / R) / rad, b0 = Math.asin(3 / 9) / rad;
    for (let i = 0; i <= 10; i++) { const a = (base + a0 + ((90 - 2 * a0) * i) / 10) * rad; pts.push([r4(R * Math.cos(a)), r4(R * Math.sin(a))]); }
    for (let i = 6; i >= 0; i--) { const a = (base + b0 + ((90 - 2 * b0) * i) / 6) * rad; pts.push([r4(9 * Math.cos(a)), r4(9 * Math.sin(a))]); }
    return { poly: pts };
  });

  // ---------- the map ----------
  // Stylised coastlines in degrees, one polygon per lattice cell that has land on its meridian.
  // Coasts are nudged where a strict map would leave too little wood around the tab slot.
  type Band = "S" | "N" | "NN";
  const BANDS: Record<Band, [number, number]> = { S: [-35, 0], N: [0, 35], NN: [35, 60] };
  interface Tile { name: string; lon: number; band: Band; tab: number; len: number; land: [number, number][]; lakes?: [number, number][][] }
  const TILES: Tile[] = [
    { name: "Африка, захід", lon: -7.5, band: "N", tab: 18, len: 7, land: [[-17, 21], [-17, 14], [-13, 9], [-8, 4.5], [3.75, 6], [3.75, 35], [-5.5, 35], [-10, 30], [-13, 27.5]] },
    { name: "Африка, Сахара", lon: 15, band: "N", tab: 16, len: 7, land: [[3.75, 6], [8, 4.5], [9.5, 3.5], [9.5, 0], [26.25, 0], [26.25, 31.5], [20, 32], [19, 30.3], [15, 32.3], [11, 33.5], [10, 35], [3.75, 35]] },
    { name: "Африка, схід і Аравія", lon: 37.5, band: "N", tab: 8, len: 7, land: [[26.25, 0], [43.5, 0], [46, 2.5], [48.75, 6], [48.75, 11.3], [44, 10.5], [43, 12], [39.5, 15], [38.2, 18.5], [36.8, 22.5], [38.3, 22.5], [40.3, 18.5], [42.5, 15.5], [43.8, 12.8], [45.5, 13], [48.75, 14.2], [48.75, 35], [36, 35], [35, 32], [34, 31.2], [26.25, 31.5]] },
    { name: "Африка, південний захід", lon: 15, band: "S", tab: -10, len: 7, land: [[9.5, 0], [9, -2], [10.5, -6], [10.5, -17], [12.5, -21], [15, -26.5], [17.2, -30.5], [18.3, -34.2], [20, -34.8], [26.25, -34], [26.25, 0]] },
    { name: "Африка, південний схід", lon: 37.5, band: "S", tab: -8.5, len: 7, land: [[26.25, 0], [43.5, 0], [42.5, -3], [42.5, -14], [40, -16.5], [36.5, -18.8], [34.8, -20.5], [35.4, -24], [32.8, -26], [32.5, -29], [30.5, -31], [28, -33], [26.25, -34]] },
    { name: "Європа", lon: 15, band: "NN", tab: 51.5, len: 7, land: [[-7.5, 37], [-5.6, 36], [-1, 37], [1, 40], [3.5, 43], [8, 44], [10.5, 42], [13, 40], [15.5, 37.8], [18, 39.5], [15.5, 42], [13, 45.5], [15, 45.5], [19.5, 42], [20, 39.5], [22, 36.5], [24.5, 38], [23.5, 40.5], [27, 40.5], [27.5, 37], [31, 36.3], [37.5, 36.6], [37.5, 41], [33, 42], [29.5, 41.5], [28.5, 44], [31, 46.3], [37.5, 47], [37.5, 60], [5, 60], [5.5, 58.5], [8.5, 57], [8.5, 54], [4.5, 52.5], [1.8, 51], [-1.5, 49.5], [-4.5, 48.3], [-1.3, 46], [-1.5, 43.4], [-7.5, 43.7]] },
    { name: "Азія, Іран та Індія-захід", lon: 60, band: "N", tab: 28.5, len: 6, land: [[48.75, 14.2], [52, 16], [55, 17.2], [58.5, 20.5], [59.8, 22.5], [58, 20.5], [62, 20.3], [66, 21.3], [67.5, 22.5], [68.5, 23], [70, 21], [71.25, 20.8], [71.25, 35], [48.75, 35]] },
    { name: "Азія, Індія", lon: 82.5, band: "N", tab: 27, len: 7, land: [[71.25, 20.8], [72.8, 19], [74.8, 13], [76.5, 8.5], [77.5, 8], [79.5, 10], [80.2, 13.5], [82.5, 16.8], [85.5, 19.8], [87.5, 21.5], [91, 22.3], [92.5, 20.5], [93.75, 19.5], [93.75, 35], [71.25, 35]] },
    { name: "Азія, Індокитай", lon: 105, band: "N", tab: 28, len: 7, land: [[93.75, 19.5], [94.5, 16], [97.5, 16.5], [98.5, 12], [98.3, 8], [100.5, 6.5], [101.5, 3], [103.5, 1.5], [104.3, 2.5], [103, 5.5], [100.5, 12.5], [102.5, 12.5], [105, 9], [106.8, 10.5], [109.3, 12.5], [108.5, 16], [106.5, 18.5], [109, 20.3], [110.5, 20.5], [113.5, 22.3], [116.25, 23], [116.25, 35], [93.75, 35]] },
    { name: "Азія, захід", lon: 60, band: "NN", tab: 52, len: 7, land: [[37.5, 35], [82.5, 35], [82.5, 60], [37.5, 60], [37.5, 47], [39.5, 46], [38.5, 44.5], [41.5, 42], [41, 41], [37.5, 41]], lakes: [[[49, 37.5], [54, 37], [53.5, 40], [52.5, 42.5], [51, 45], [53, 46.8], [50, 47], [47.5, 44.5], [49.5, 42], [49, 40]]] },
    { name: "Азія, схід", lon: 105, band: "NN", tab: 48, len: 7, land: [[82.5, 35], [119.5, 35], [122.5, 37.2], [121.5, 39.5], [125, 40], [127.5, 40], [127.5, 60], [82.5, 60]] },
    { name: "Австралія, захід", lon: 127.5, band: "S", tab: -23.5, len: 7, land: [[116.25, -20.7], [119, -20], [122.2, -17.5], [125, -14], [129, -15], [130, -12.5], [132, -11.3], [136.8, -12.2], [135.5, -15], [138.75, -17], [138.75, -35], [137.8, -33], [135.5, -34.8], [134, -32.8], [131, -31.5], [126, -32.3], [123.5, -34], [118, -35], [116.25, -34.8]] },
    { name: "Австралія, схід", lon: 150, band: "S", tab: -27.5, len: 7, land: [[138.75, -17], [140.8, -17.6], [141.6, -12.5], [142.5, -10.8], [143.8, -14.3], [145.4, -15], [146.1, -18.9], [151, -20], [155, -23], [155.5, -28.5], [154, -32.5], [151.5, -35], [138.75, -35]] },
    { name: "Північна Америка, захід", lon: -120, band: "NN", tab: 45, len: 7, land: [[-142.5, 60], [-139.5, 59.8], [-135.5, 57.5], [-133, 55], [-130.5, 54.2], [-130, 51], [-127.5, 48.4], [-127, 40.3], [-124.5, 37.5], [-121.5, 35], [-97.5, 35], [-97.5, 60]] },
    { name: "Північна Америка, схід", lon: -75, band: "NN", tab: 49, len: 7, land: [[-97.5, 35], [-75.5, 35], [-76, 37], [-74, 39.5], [-70, 41.5], [-70.5, 43.3], [-67, 44.8], [-61, 45.5], [-64.5, 47], [-65, 48.7], [-60, 50.2], [-55.7, 52], [-59, 55], [-61.5, 57], [-64, 60], [-77.5, 60], [-78, 58.7], [-78.5, 56.5], [-80.5, 54.5], [-81.5, 51.5], [-83.5, 52.5], [-84, 55], [-88, 56.5], [-92.5, 57], [-94.5, 60], [-97.5, 60]] },
    { name: "Мексика", lon: -97.5, band: "N", tab: 27.5, len: 7, land: [[-108.75, 25.5], [-105.5, 20.5], [-102, 18], [-96, 15.7], [-94, 16.2], [-92, 14.5], [-88, 13.2], [-86.25, 12.5], [-86.25, 15.8], [-88.2, 16], [-87, 21.5], [-90.3, 21], [-91, 18.6], [-94.5, 18.2], [-94.5, 21], [-93, 24], [-93, 29.3], [-90, 29.2], [-86.25, 30.3], [-86.25, 35], [-108.75, 35]] },
    { name: "Південна Америка, північ", lon: -75, band: "N", tab: 6, len: 5, land: [[-86.25, 11], [-86.25, 15.8], [-83.3, 15], [-83.5, 11.5], [-82, 10.2], [-79.5, 10.5], [-77.5, 11.5], [-75.5, 12.3], [-71.5, 12.8], [-71.3, 11.2], [-68, 11.8], [-63.75, 10.5], [-63.75, 0], [-80.5, 0], [-80, 3], [-79.5, 6], [-80.3, 7.2], [-81.5, 6.3], [-83.3, 7.2], [-85.5, 9.2]] },
    { name: "Південна Америка, Анди", lon: -75, band: "S", tab: -7, len: 7, land: [[-80, 0], [-81, -4.5], [-81, -9], [-79, -13], [-76, -15.5], [-72, -17.5], [-70.3, -18.5], [-70.2, -24], [-71.3, -30], [-71.7, -33], [-72.5, -35], [-63.75, -35], [-63.75, 0]] },
    { name: "Південна Америка, Бразилія", lon: -52.5, band: "S", tab: -15, len: 7, land: [[-63.75, 0], [-50, 0], [-48, -1], [-44.5, -2.5], [-41.25, -3], [-41.25, -22], [-43, -23], [-45, -23.8], [-48, -25.5], [-48.6, -28], [-50.5, -30.5], [-53, -33.5], [-54.5, -35], [-63.75, -35]] },
  ];
  const isLong = (lon: number) => LONG.some(l => (((l - lon) % 360) + 360) % 360 < 1e-6);
  const facetOf = (band: Band) => {
    const [la, lb] = BANDS[band], A = P(la), B = P(lb), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    return { A, B, L, m: [(B[0] - A[0]) / L, (B[1] - A[1]) / L], la, lb };
  };
  const tabAt = (tl: Tile) => { const f = facetOf(tl.band); return r4(((tl.tab - f.la) / (f.lb - f.la)) * f.L); };
  const tilePart = (tl: Tile, id: number, ribId: number): PartSpec => {
    const f = facetOf(tl.band), half = tl.band === "NN" ? 22.5 : 11.25, fr = frame(tl.lon), d = tabAt(tl);
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const map = ([lon, lat]: [number, number]): P2 => {
      const b = clamp((lat - f.la) / (f.lb - f.la)) * f.L, u = f.A[0] + f.m[0] * b;
      return [r4((2 * clamp((lon - (tl.lon - half)) / (2 * half)) - 1) * u * Math.tan(half * rad)), r4(b)];
    };
    const out = [f.m[1], -f.m[0]]; // outward normal in the meridian plane
    return {
      id, name: `${tl.name} (на меридіан ${ribId})`, spin,
      at: {
        o: mix(fr.eu, f.A[0], k, f.A[1]).map((v, i) => r4(v + (i === 1 ? YC : 0))) as P3,
        ea: fr.tau.map(r4) as P3, eb: mix(fr.eu, f.m[0], k, f.m[1]).map(r4) as P3,
      },
      explode: mix(fr.eu, out[0] * 50, k, out[1] * 50).map(r4) as P3,
      outline: { poly: tl.land.map(map) },
      holes: [{ rect: ["-t/2", r4(d - tl.len / 2), "t/2", r4(d + tl.len / 2)] }, ...(tl.lakes ?? []).map((l): ShapeSpec => ({ poly: l.map(map) }))],
    };
  };

  // ---------- meridian ribs ----------
  const on = (r: number, v: string): Num => `sqrt(${r * r}-(${v})*(${v}))`;
  const inner = (deg: number): P2 => [r4(RI * Math.cos(deg * rad)), r4(RI * Math.sin(deg * rad))];
  const pt = (lat: number): P2 => P(lat).map(r4) as P2;
  const vs = (h: number, side: number) => `${h}${side > 0 ? "+" : "-"}t/2`;
  // a facet edge, with a tab when a land tile sits on it
  const facet = (lon: number, band: Band, toLat: number): EdgeSpec => {
    const tl = TILES.find(x => ((x.lon - lon) % 360 + 360) % 360 < 1e-6 && x.band === band);
    return tl ? { to: pt(toLat), tabs: [tabAt(tl)], tabLen: tl.len } : pt(toLat);
  };
  const T = LAT.tropic, PL = LAT.polar;
  const equatorNotch: P2[] = [[on(RI, "t/2"), "t/2"], [LAT.eq.uh, "t/2"], [LAT.eq.uh, "-t/2"], [on(RI, "t/2"), "-t/2"]];
  const tropicNotch = (sgn: number): P2[] => {
    const o: P2[] = [[T.uh, vs(sgn * T.h, 1)], [T.uh, vs(sgn * T.h, -1)]];
    const arc: P2 = [on(RI, vs(sgn * T.h, -sgn)), vs(sgn * T.h, -sgn)];
    return sgn > 0 ? [...o, arc] : [arc, ...o];
  };
  const arcDown = [36, 30, 24, 18, 12, 9];
  const insideLow: P2[] = [...tropicNotch(1), ...arcDown.map(inner), ...equatorNotch, ...arcDown.map(a => inner(-a)).reverse(), ...tropicNotch(-1)];
  // long rib: pole to pole, ends in a step that sits on each polar disc
  const longRib = (lon: number): EdgeSpec[] => [
    [`22.5-1.0912*t/2`, vs(-PL.h, -1)], pt(-60), pt(-35), facet(lon, "S", 0), facet(lon, "N", 35), facet(lon, "NN", 60),
    [`22.5-1.0912*t/2`, vs(PL.h, 1)], [PL.uh, vs(PL.h, 1)], [PL.uh, vs(PL.h, -1)], [17, vs(PL.h, -1)], [17, vs(T.h, 1)],
    ...insideLow,
    [17, vs(-T.h, -1)], [17, vs(-PL.h, 1)], [PL.uh, vs(-PL.h, 1)], [PL.uh, vs(-PL.h, -1)],
  ];
  // short rib: between the tropics only, held by the equator and both tropic rings
  const shortRib = (lon: number): EdgeSpec[] => [
    [29.3, -32.5], pt(-35), facet(lon, "S", 0), facet(lon, "N", 35), [29.3, 32.5], [24, 32.5], [24, vs(T.h, 1)],
    ...insideLow,
    [24, vs(-T.h, -1)], [24, -32.5],
  ];
  const ribPart = (id: number, lon: number, long: boolean): PartSpec => {
    const fr = frame(lon);
    return {
      id, name: long ? "Довгий меридіан" : "Короткий меридіан", spin,
      at: { o: [`-${term(fr.n[0], "t/2")}`, `${YC}-${term(fr.n[1], "t/2")}`, `-${term(fr.n[2], "t/2")}`], ea: fr.eu.map(r4) as P3, eb: K },
      explode: fr.eu.map(x => r4(x * 34)) as P3,
      outline: long ? longRib(lon) : shortRib(lon),
    };
  };
  const ribId = (lon: number) => { const n = ((lon % 360) + 360) % 360, i = LONG.findIndex(l => l === n); return i >= 0 ? 10 + i : 28 + SHORT.findIndex(l => l === n); };

  // ---------- stand and drive ----------
  const W = (p: number, v: number): P2 => [r4(p * e1[0] + v * k[0]), r4(YC + p * e1[1] + v * k[1])];
  const Wt = (p: number, v: number, sgn: number): P2 => {
    const [x, y] = W(p, v) as [number, number];
    return [`${x}${sgn > 0 ? "+" : "-"}${term(k[0], "t/2")}`, `${y}${sgn > 0 ? "+" : "-"}${term(k[1], "t/2")}`];
  };
  const onArc = (r: number, alpha: number): P2 => W(-r * Math.sin(alpha * rad), r * Math.cos(alpha * rad));
  const RA = 55, RB = 67; // the arm's inner radius clears the land tiles as they sweep past
  const arm: P2[] = [W(-14, 44), Wt(-14, 50, -1), Wt(-20, 50, -1), Wt(-20, 50, 1), Wt(-14, 50, 1), W(-14, 58), W(-24, 60)];
  for (const a of [28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108.4]) arm.push(onArc(RB, a));
  // the leg flares towards the base; its inner edge runs parallel to the axis and carries the two drive plates
  arm.push(
    [-84, 0], [-81, 0], [-81, "-t"], [-73, "-t"], [-73, 0],
    ["-66-t/2", 0], ["-66-t/2", 15], ["-66+t/2", 15], ["-66+t/2", 0],
    [-60, 0], [-60, "-t"], [-52, "-t"], [-52, 0], [-50, 0], [-50, 8],
    W(-30, -76), Wt(-30, -68, -1), Wt(-36, -68, -1), Wt(-36, -68, 1), Wt(-30, -68, 1),
    Wt(-30, -50, -1), Wt(-36, -50, -1), Wt(-36, -50, 1), Wt(-30, -50, 1), W(-30, -44),
  );
  for (let a = 142; a >= 30; a -= 8) arm.push(onArc(RA, a));
  const ornament: ShapeSpec[] = [38, 50, 62, 74, 86, 98, 110, 122, 134].map(a => {
    const [x, y] = onArc((RA + RB) / 2, a) as [number, number];
    return { circle: [x, y, a % 24 === 14 ? 3.2 : 2.2] };
  });

  const plateAt = (v: number): P3 => [`(${K[0]})*(${v}-t/2)`, `${YC}+(${K[1]})*(${v}-t/2)`, 0];
  const along = (d: number, dz = 0): P3 => [r4(k[0] * d), r4(k[1] * d), dz];
  const drivePlate = (id: number, name: string, v: number, ex: number): PartSpec => ({
    id, name,
    at: { o: plateAt(v), ea: E1, eb: nZ }, explode: along(ex),
    outline: [[-44, -8], [-12, -8], [-12, -46], [9, -46], [9, 8], [-44, 8], [-44, "t/2"], [-36, "t/2"], [-36, "-t/2"], [-44, "-t/2"]],
    holes: [{ circle: [0, 0, "rh"] }, { circle: [0, -CZ, "rh"] }, { circle: [-24, 0, 3] }],
  });
  const cog = (id: number, name: string, teeth: number, phase: number, z: number, s2: typeof spin, v: string, down: boolean, ex: number): PartSpec => ({
    id, name, label: false, spin: s2,
    at: { o: [`(${K[0]})*(${v})`, `${YC}+(${K[1]})*(${v})`, z], ea: E1, eb: down ? Z : nZ }, explode: along(ex, z ? 18 : 0),
    outline: { gear: { at: [0, 0], teeth, module: 1.6, phase } },
    holes: teeth >= 30 ? [sq, ...[0, 1, 2, 3, 4, 5].map((i): ShapeSpec => ({ circle: [r4(13 * Math.cos((i * 60 + 30) * rad)), r4(13 * Math.sin((i * 60 + 30) * rad)), 4] }))] : [sq],
  });
  const collar = (id: number, v: string, down: boolean, z: number, s2: typeof spin, ex: number): PartSpec => ({
    id, name: "Стопорна шайба", label: false, spin: s2,
    at: { o: [`(${K[0]})*(${v})`, `${YC}+(${K[1]})*(${v})`, z], ea: E1, eb: down ? Z : nZ }, explode: along(ex, z ? 18 : 0),
    outline: { circle: [0, 0, 6] }, holes: [sq],
  });
  const shaft = (id: number, name: string, from: string, to: string, z: number, s2: typeof spin, ex: P3): PartSpec => ({
    id, name, spin: s2, label: false,
    at: { o: [term(e1[0], "t/2"), `${YC}+${term(e1[1], "t/2")}`, z], ea: K, eb: nZ }, explode: ex,
    outline: [[from, "-t/2"], [to, "-t/2"], [to, "t/2"], [from, "t/2"]],
  });

  const tiles = TILES.map((tl, i) => tilePart(tl, 40 + i, ribId(tl.lon)));
  const tileIds = (...names: string[]) => TILES.map((tl, i) => (names.some(n => tl.name.startsWith(n)) ? 40 + i : 0)).filter(Boolean);
  for (const tl of TILES) if ((tl.band === "NN") !== (tl.band === "NN" && isLong(tl.lon))) throw new Error(`${tl.name}: північний пояс є лише на довгих меридіанах`);

  const spec: PuzzleSpec = {
    name: "Глобус",
    description: "Гранований глобус із материками на нахиленій осі. Крутиш коліщатко, дві шестерні обертають сферу.",
    limits: { maxT: 4.3 },
    params: { rh: "0.7071*t + 0.25/s", Top: "52 + 1.5*t", Bot: "-71 - 1.5*t" },
    parts: [
      {
        id: 1, name: "Основа",
        at: { o: [0, "-t", 0], ea: [1, 0, 0], eb: nZ },
        outline: [[-92, -42], [50, -42], [50, 42], [-92, 42]],
        holes: [
          { rect: [-81, "-t/2", -73, "t/2"] }, { rect: [-60, "-t/2", -52, "t/2"] },
          { rect: ["-66-t/2", 13, "-66+t/2", 21] }, { rect: ["-66-t/2", -21, "-66+t/2", -13] },
        ],
        engrave: [{ circle: [0, 0, 30] }, { circle: [0, 0, 33] }],
      },
      { id: 2, name: "Дуга стійки", at: { o: [0, 0, "-t/2"], ea: [1, 0, 0], eb: [0, 1, 0] }, explode: [-40, 0, 0], outline: arm, holes: ornament },
      {
        id: 3, name: "Упор стійки",
        at: { o: ["-66+t/2", 0, 0], ea: Z, eb: [0, 1, 0] }, explode: [-40, 0, 0],
        holes: [{ circle: [-14, 9, 4] }, { circle: [14, 9, 4] }],
        outline: [
          [-25, 0], { to: [25, 0], tabs: [8, 42], tabLen: 8 }, [25, 8], [8, 30],
          ["t/2", 30], ["t/2", 15], ["-t/2", 15], ["-t/2", 30], [-8, 30], [-25, 8],
        ],
      },
      shaft(4, "Вісь глобуса", "Bot", "Top", 0, spin, [0, 0, 0]),
      ring(5, "Екватор", LAT.eq, 1, 16, [sq, ...windows]),
      ring(6, "Північний тропік", T, 1, 16, [{ circle: [0, 0, T.rho - 10] }]),
      ring(7, "Південний тропік", T, -1, 16, [{ circle: [0, 0, T.rho - 10] }]),
      ring(8, "Північне полярне коло", PL, 1, 8, [sq]),
      ring(9, "Південне полярне коло", PL, -1, 8, [sq]),
      ...LONG.map((lon, j) => ribPart(10 + j, lon, true)),
      {
        id: 18, name: "Верхня опора осі", label: false,
        at: { o: plateAt(50), ea: E1, eb: nZ }, explode: along(26),
        outline: [[-28, -8], [9, -8], [9, 8], [-28, 8], [-28, "t/2"], [-20, "t/2"], [-20, "-t/2"], [-28, "-t/2"]],
        holes: [{ circle: [0, 0, "rh"] }, { circle: [-10, 0, 2.5] }],
      },
      drivePlate(19, "Верхня пластина приводу", -50, -16),
      drivePlate(20, "Нижня пластина приводу", -68, -44),
      cog(21, "Велика шестерня глобуса", 30, 0, 0, spin, "-59-t/2", false, -30),
      shaft(22, "Вал коліщатка", "Bot", "-48+1.5*t", CZ, crank, [0, 0, 18]),
      cog(23, "Мала шестерня приводу", 15, 0.75, CZ, crank, "-59-t/2", false, -30),
      cog(24, "Коліщатко", 18, 0, CZ, crank, "-68.5-t/2", true, -60),
      collar(25, "50.5+t/2", false, 0, spin, 42),
      collar(26, "-68.5-t/2", true, 0, spin, -60),
      collar(27, "-49.5+t/2", false, CZ, crank, 4),
      ...SHORT.map((lon, j) => ribPart(28 + j, lon, false)),
      ...tiles,
    ],
    steps: [
      { ids: [1], text: "Основа." },
      { ids: [2, 3], text: "Дуга стійки шипами в основу, упор навхрест: паз у паз, потім шипами в основу." },
      { ids: [4, 5, 8, 9], text: "На вісь щільно насади екватор посередині й обидва полярні кола." },
      { ids: [10, 12, 14, 16], text: "Чотири довгі меридіани через один: пази ребра на пази кіл, тисни до осі. Номер на ребрі каже, куди йде яка плитка." },
      { ids: [6, 7], text: "Кільця тропіків заводяться в пази вже поставлених меридіанів." },
      { ids: [11, 13, 15, 17], text: "Решта довгих меридіанів замикає каркас." },
      { ids: [28, 29, 30, 31, 32, 33, 34, 35], text: "Вісім коротких меридіанів між довгими: три пази на екватор і обидва тропіки." },
      { ids: [18, 19], text: "Верхня опора й верхня пластина приводу: на кінці осі, потім пазами на дугу. Вісь має крутитися вільно." },
      { ids: [21, 22, 23], text: "Велика шестерня на вісь глобуса знизу. Вал коліщатка в сусідній отвір, на нього мала шестерня. Зуби мають зачепитися." },
      { ids: [20], text: "Нижня пластина закриває шестерні: обидва вали в отвори, паз на дугу." },
      { ids: [24, 25, 26, 27], text: "Коліщатко на вал знизу, стопорні шайби на вільні кінці." },
      { ids: tileIds("Африка", "Європа"), text: "Африка і Європа: кожна плитка пазом на шип свого меридіана, номер меридіана є в назві плитки." },
      { ids: tileIds("Азія", "Австралія"), text: "Азія й Австралія." },
      { ids: tileIds("Північна", "Мексика", "Південна"), text: "Обидві Америки. Крути коліщатко." },
    ],
  };
  writeFileSync("src/puzzles/globe.json", formatSpec(spec) + "\n");
});
