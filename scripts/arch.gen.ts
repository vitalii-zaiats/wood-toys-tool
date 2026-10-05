// One-off generator for src/puzzles/arch.json (the vault is trigonometry, not hand-typed JSON).
// To rerun: copy to tests/_gen.test.ts, run `npx vitest run tests/_gen.test.ts`, delete the copy.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { formatSpec } from "../src/spec/file";
import type { EdgeSpec, MarkSpec, P2, P3, PartSpec, PuzzleSpec, ShapeSpec } from "../src/spec/types";

it("gen", () => {
  const rad = Math.PI / 180, r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const X: P3 = [1, 0, 0], Y: P3 = [0, 1, 0], Z: P3 = [0, 0, 1], nX: P3 = [-1, 0, 0], nZ: P3 = [0, 0, -1];
  // W x D footprint, H1 to the cornice, OW x (SH + OW/2) opening, VR vault apothem, AH attic height
  const W = 120, D = 50, H1 = 90, OW = 44, SH = 48, VR = 25, AH = 22, N = 9;
  const FINS = [30, 46]; // clear of the passage walls on one side and the corner joints on the other

  // ---- vault: six flat coffered slats tangent to a half-circle, tabbed into both facades
  const SLATS = [15, 45, 75, 105, 135, 165], SW = 2 * VR * Math.tan(15 * rad);
  const vaultSlots: ShapeSpec[] = SLATS.map(deg => {
    const c = Math.cos(deg * rad), s = Math.sin(deg * rad);
    const at = (rho: number, along: number, thick: boolean): P2 => {
      const x = r4(rho * c - along * s), y = r4(SH + rho * s + along * c);
      return thick ? [`${x}+(${r4(c)})*t`, `${y}+(${r4(s)})*t`] : [x, y];
    };
    return { poly: [at(VR, -3, false), at(VR, 3, false), at(VR, 3, true), at(VR, -3, true)] };
  });
  const slat = (id: number, deg: number): PartSpec => {
    const c = Math.cos(deg * rad), s = Math.sin(deg * rad);
    return {
      id, name: "Планка склепіння", label: false,
      at: { o: [r4(VR * c + (SW / 2) * s), r4(SH + VR * s - (SW / 2) * c), 0], ea: nZ, eb: [r4(-s), r4(c), 0] },
      outline: [
        ["-D/2+t", 0], ["D/2-t", 0],
        { to: ["D/2-t", r4(SW)], tabs: [r4(SW / 2)], tabLen: 6 },
        ["-D/2+t", r4(SW)],
        { to: ["-D/2+t", 0], tabs: [r4(SW / 2)], tabLen: 6 },
      ],
      holes: [{ rect: [-13, 3.5, -4, r4(SW - 3.5)] }, { rect: [4, 3.5, 13, r4(SW - 3.5)] }],
    };
  };

  // ---- facade: one plate across both piers with the arch cut out of it
  const facadeOutline: EdgeSpec[] = [
    ["-W/2", 0],
    { to: ["-OW/2", 0], tabs: [19], tabLen: 10 },
    ["-OW/2", "SH"],
    { to: ["OW/2", "SH"], arc: "-OW/2" },
    ["OW/2", 0],
    { to: ["W/2", 0], tabs: [19], tabLen: 10 },
    { to: ["W/2", "H1"], fingers: "n", teeth: "in" },
    { to: ["-W/2", "H1"], tabs: [20, 60, 100], tabLen: 10 },
    { to: ["-W/2", 0], fingers: "n", teeth: "in" },
  ];
  const both = <T,>(f: (sgn: 1 | -1) => T[]): T[] => [...f(1), ...f(-1)];
  const facadeHoles: ShapeSpec[] = [
    ...vaultSlots,
    ...both((g): ShapeSpec[] => [
      // passage wall tabs, column tabs
      { rect: g > 0 ? [VR, 8, `${VR}+t`, 16] : [`-${VR}-t`, 8, -VR, 16] },
      { rect: g > 0 ? [VR, 36, `${VR}+t`, 44] : [`-${VR}-t`, 36, -VR, 44] },
      ...FINS.flatMap((x): ShapeSpec[] => [
        { rect: [`${g * x}-t/2`, 22, `${g * x}+t/2`, 30] },
        { rect: [`${g * x}-t/2`, 64, `${g * x}+t/2`, 72] },
      ]),
      // decoration: niche, diamond, medallion
      { arch: [g * 38 - 3, 58, g * 38 + 3, 80] },
      { poly: [[g * 38 - 3, 26], [g * 38, 20], [g * 38 + 3, 26], [g * 38, 32]] },
      { circle: [g * 26, 80, 3.2] },
    ]),
  ];
  const archivolt: P2[] = Array.from({ length: 15 }, (_, i): P2 => [r4(34.5 * Math.cos((20 + i * 10) * rad)), r4(SH + 34.5 * Math.sin((20 + i * 10) * rad))]);
  const facadeMarks: MarkSpec[] = [
    { line: archivolt },
    { line: [[-52, 85], [52, 85]] },
    ...both((g): MarkSpec[] => [
      { rect: [g * 38 - 5, 8, g * 38 + 5, 46] },
      { rect: [g * 38 - 5, 56, g * 38 + 5, 82] },
      { line: [[g * 33, 51], [g * 43, 51]] },
    ]),
  ];
  // a column standing proud of the facade: base, shaft, capital
  const fin = (id: number, x: number, front: boolean): PartSpec => ({
    id, name: "Колона", label: false,
    at: front ? { o: [`${x}+t/2`, 0, "D/2"], ea: Z, eb: Y } : { o: [`${x}-t/2`, 0, "-D/2"], ea: nZ, eb: Y },
    explode: [0, 0, front ? 75 : -75],
    outline: [[0, 0], [8, 0], [8, 6], [6.5, 8], [5, 10], [5, 78], [6.5, 80], [8, 82], [8, "H1"], [0, "H1"], { to: [0, 0], tabs: [22, 64], tabLen: 8 }],
  });

  const sideOutline: EdgeSpec[] = [
    ["-D/2+t", 0],
    { to: ["D/2-t", 0], tabs: ["D/2-t"], tabLen: 10 },
    { to: ["D/2-t", "H1"], fingers: "n", teeth: "out" },
    { to: ["-D/2+t", "H1"], tabs: ["D/2-t"], tabLen: 10 },
    { to: ["-D/2+t", 0], fingers: "n", teeth: "out" },
  ];
  const sideDecor = {
    holes: [{ arch: [-7, 14, 7, 48] }, { circle: [0, 68, 5] }] as ShapeSpec[],
    engrave: [{ rect: [-10, 10, 10, 52] }, { circle: [0, 68, 8] }, { line: [[-14, 85], [14, 85]] }] as MarkSpec[],
  };
  const passageWall = (id: number, name: string, g: 1 | -1): PartSpec => ({
    id, name,
    at: g > 0 ? { o: [`${VR}+t`, 0, 0], ea: Z, eb: Y } : { o: [`-${VR}-t`, 0, 0], ea: nZ, eb: Y },
    outline: [
      ["-D/2+t", 0],
      { to: ["D/2-t", 0], tabs: ["D/2-t"], tabLen: 10 },
      { to: ["D/2-t", "SH"], tabs: [12, 40], tabLen: 8 },
      ["-D/2+t", "SH"],
      { to: ["-D/2+t", 0], tabs: [8, 36], tabLen: 8 },
    ],
    engrave: [{ rect: [-14, 8, 14, 40] }, { line: [[-17, 44], [17, 44]] }],
  });

  // ---- attic: a smaller box on the cornice, AX x AZ half-sizes
  const AX = 50, AZ = 15;
  const atticLong: EdgeSpec[] = [
    [-AX, 0],
    { to: [AX, 0], tabs: [25, 75], tabLen: 10 },
    { to: [AX, "AH"], fingers: 3, teeth: "in" },
    { to: [-AX, "AH"], tabs: [25, 75], tabLen: 10 },
    { to: [-AX, 0], fingers: 3, teeth: "in" },
  ];
  const atticShort: EdgeSpec[] = [
    [`-${AZ}+t`, 0],
    { to: [`${AZ}-t`, 0], tabs: [`${AZ}-t`], tabLen: 8 },
    { to: [`${AZ}-t`, "AH"], fingers: 3, teeth: "out" },
    { to: [`-${AZ}+t`, "AH"], tabs: [`${AZ}-t`], tabLen: 8 },
    { to: [`-${AZ}+t`, 0], fingers: 3, teeth: "out" },
  ];
  const dentils: ShapeSpec[] = [-40, -30, -20, -10, 0, 10, 20, 30, 40].map(x => ({ rect: [x - 2, 8, x + 2, 14] }));
  // slots the attic needs in the plate below it and in the roof above it (plate coords: a = x, b = -z)
  const atticSlots: ShapeSpec[] = [
    ...[-25, 25].flatMap((x): ShapeSpec[] => [
      { rect: [x - 5, -AZ, x + 5, `-${AZ}+t`] }, { rect: [x - 5, `${AZ}-t`, x + 5, AZ] },
    ]),
    { rect: [`${AX}-t`, -4, AX, 4] }, { rect: [-AX, -4, `-${AX}+t`, 4] },
  ];

  const parts: PartSpec[] = [
    {
      id: 1, name: "Основа",
      at: { o: [0, "-t", 0], ea: X, eb: nZ },
      outline: [["-W/2-12", "-D/2-14"], ["W/2+12", "-D/2-14"], ["W/2+12", "D/2+14"], ["-W/2-12", "D/2+14"]],
      holes: [
        ...[-41, 41].flatMap((x): ShapeSpec[] => [
          { rect: [x - 5, "-D/2", x + 5, "-D/2+t"] }, { rect: [x - 5, "D/2-t", x + 5, "D/2"] },
        ]),
        { rect: ["W/2-t", -5, "W/2", 5] }, { rect: ["-W/2", -5, "-W/2+t", 5] },
        { rect: [VR, -5, `${VR}+t`, 5] }, { rect: [`-${VR}-t`, -5, -VR, 5] },
      ],
      engrave: [-15, -5, 5, 15].map((x): MarkSpec => ({ line: [[x, -37], [x, 37]] })),
    },
    { id: 2, name: "Передній фасад", at: { o: [0, 0, "D/2-t"], ea: X, eb: Y }, explode: [0, 0, 50], outline: facadeOutline, holes: facadeHoles, engrave: facadeMarks },
    { id: 3, name: "Задній фасад", at: { o: [0, 0, "-D/2+t"], ea: nX, eb: Y }, explode: [0, 0, -50], outline: facadeOutline, holes: facadeHoles, engrave: facadeMarks },
    { id: 4, name: "Правий бік", at: { o: ["W/2-t", 0, 0], ea: nZ, eb: Y }, explode: [45, 0, 0], outline: sideOutline, ...sideDecor },
    { id: 5, name: "Лівий бік", at: { o: ["-W/2+t", 0, 0], ea: Z, eb: Y }, explode: [-45, 0, 0], outline: sideOutline, ...sideDecor },
    passageWall(6, "Права стінка проходу", 1),
    passageWall(7, "Ліва стінка проходу", -1),
    ...SLATS.map((deg, i) => slat(8 + i, deg)),
    {
      id: 14, name: "Карниз",
      at: { o: [0, "H1", 0], ea: X, eb: nZ }, explode: [0, 30, 0],
      outline: [["-W/2-9", "-D/2-9"], ["W/2+9", "-D/2-9"], ["W/2+9", "D/2+9"], ["-W/2-9", "D/2+9"]],
      holes: [
        ...[-40, 0, 40].flatMap((x): ShapeSpec[] => [
          { rect: [x - 5, "-D/2", x + 5, "-D/2+t"] }, { rect: [x - 5, "D/2-t", x + 5, "D/2"] },
        ]),
        { rect: ["W/2-t", -5, "W/2", 5] }, { rect: ["-W/2", -5, "-W/2+t", 5] },
        ...atticSlots,
      ],
    },
    { id: 15, name: "Аттик, перед", at: { o: [0, "H1+t", `${AZ}-t`], ea: X, eb: Y }, explode: [0, 45, 20], outline: atticLong, holes: dentils, engrave: [{ line: [[-44, 4], [44, 4]] }, { line: [[-44, 18], [44, 18]] }] },
    { id: 16, name: "Аттик, зад", at: { o: [0, "H1+t", `-${AZ}+t`], ea: nX, eb: Y }, explode: [0, 45, -20], outline: atticLong, holes: dentils, engrave: [{ line: [[-44, 4], [44, 4]] }, { line: [[-44, 18], [44, 18]] }] },
    { id: 17, name: "Аттик, правий бік", at: { o: [`${AX}-t`, "H1+t", 0], ea: nZ, eb: Y }, explode: [20, 45, 0], outline: atticShort, holes: [{ circle: [0, 11, 3.5] }] },
    { id: 18, name: "Аттик, лівий бік", at: { o: [`-${AX}+t`, "H1+t", 0], ea: Z, eb: Y }, explode: [-20, 45, 0], outline: atticShort, holes: [{ circle: [0, 11, 3.5] }] },
    {
      id: 19, name: "Дах",
      at: { o: [0, "H1+t+AH", 0], ea: X, eb: nZ }, explode: [0, 70, 0],
      outline: [[-AX - 4, -AZ - 4], [AX + 4, -AZ - 4], [AX + 4, AZ + 4], [-AX - 4, AZ + 4]],
      holes: atticSlots,
      engrave: [{ rect: [-40, -9, 40, 9] }, { rect: [-36, -6, 36, 6] }],
    },
    ...[1, -1].flatMap((g, i) => FINS.flatMap((x, j) => [fin(20 + i * 4 + j * 2, g * x, true), fin(21 + i * 4 + j * 2, g * x, false)])),
  ];

  const spec: PuzzleSpec = {
    name: "Арка",
    description: "Тріумфальна арка: два пілони, кесонне склепіння з планок, карниз, аттик і вісім колон.",
    params: { W, D, H1, OW, SH, AH, n: N },
    parts,
    steps: [
      { ids: [1], text: "Основа." },
      { ids: [6, 7], text: "Дві стінки проходу шипами в основу, гравіюванням одна до одної." },
      { ids: [3], text: "Задній фасад: шипи знизу в основу, шипи стінок проходу в його пази." },
      { ids: [8, 9, 10, 11, 12, 13], text: "Шість планок склепіння по дузі: шип кожної в косий паз фасаду." },
      { ids: [2], text: "Передній фасад закриває стінки й планки з другого боку." },
      { ids: [4, 5], text: "Бічні стінки: пальці між пальцями фасадів, шип у основу." },
      { ids: [14], text: "Карниз насаджується на шипи фасадів і боків." },
      { ids: [15, 16, 17, 18], text: "Аттик: чотири стінки шипами в карниз." },
      { ids: [19], text: "Дах на шипи аттика." },
      { ids: [20, 21, 22, 23, 24, 25, 26, 27], text: "Вісім колон: два шипи кожної в пази фасаду. Готово." },
    ],
  };
  writeFileSync("src/puzzles/arch.json", formatSpec(spec) + "\n");
});
