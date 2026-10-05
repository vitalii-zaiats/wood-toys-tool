// One-off generator for src/puzzles/arch.json (the vault is trigonometry, not hand-typed JSON).
// The reliefs come from scripts/arch-reliefs.json, traced from a line drawing by scripts/trace-reliefs.mjs.
// To rerun: copy to tests/_gen.test.ts, run `npx vitest run tests/_gen.test.ts`, delete the copy.
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { formatSpec } from "../src/spec/file";
import type { EdgeSpec, MarkSpec, P2, P3, PartSpec, PuzzleSpec, ShapeSpec } from "../src/spec/types";

it("gen", () => {
  const rad = Math.PI / 180, r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const X: P3 = [1, 0, 0], Y: P3 = [0, 1, 0], Z: P3 = [0, 0, 1], nX: P3 = [-1, 0, 0], nZ: P3 = [0, 0, -1];
  // W x D footprint, H1 to the cornice, OW x (SH + OW/2) opening, VR vault apothem, AH attic height
  const W = 120, D = 50, H1 = 90, OW = 44, SH = 48, VR = 25, AH = 22, N = 9;
  const BRACKETS = [0, 10, -10, 20, -20, 38, -38];
  // sculpture groups stand on a shelf in front of each pier, PX from the centre, shelf top at PY
  const PX = 41, PY = 11, RELIEF_H = 26;
  // string courses: strips standing LEDGE proud of the walls at these heights, tabbed in at LX on the facades and LA on the sides
  const LEDGE = 3.5, LEVELS = [4, 47], LX = [38, 47], LA = 14;
  type Px = [number, number];
  interface Traced { w: number; h: number; outline: Px[] | null; lines: Px[][]; fill: Px[][][] | null }
  const ART = JSON.parse(readFileSync("scripts/arch-reliefs.json", "utf8")) as Record<"upperLeft" | "upperRight" | "lowerLeft" | "lowerRight" | "crest" | "crestSide" | "attic" | "frieze" | "friezeSide", Traced>;
  const r2 = (v: number) => Math.round(v * 100) / 100; // clear of the passage walls on one side and the corner joints on the other

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

  // battlement-style key pattern between x0 and x1
  const meander = (x0: number, x1: number, y0: number, y1: number): MarkSpec => {
    const pts: P2[] = [];
    for (let x = x0; x < x1 - 1e-6; x += 4) pts.push([x, y0], [x, y1], [x + 2, y1], [x + 2, y0]);
    pts.push([x1, y0]);
    return { line: pts };
  };

  // traced artwork engraved into the box [x0, y0, x1, y1]: strokes as lines, the ground between figures as area
  const place = (art: Traced, x0: number, y0: number, x1: number, y1: number): MarkSpec[] => {
    const map = ([x, y]: Px): P2 => [r2(x0 + (x / art.w) * (x1 - x0)), r2(y0 + (y / art.h) * (y1 - y0))];
    return [...(art.fill ?? []).map((g): MarkSpec => ({ fill: g.map(l => l.map(map)) })), ...art.lines.map((l): MarkSpec => ({ line: l.map(map) }))];
  };
  // a traced sculpture group cut out along its silhouette; stands on its plinth with one tab into the shelf
  // A traced silhouette as a free-standing piece `width` x `height` mm, centred on its base, which gets the tabs.
  const standing = (art: Traced, width: number, height: number, tabs: number[], tabLen: number) => {
    const o = art.outline!, mid = (o[0][0] + o[1][0]) / 2, base = o[0][1], kx = width / (o[1][0] - o[0][0]), ky = height / (art.h - base);
    const map = ([px, py]: Px): P2 => [r2((px - mid) * kx), r2(Math.max(0, (py - base) * ky))];
    const [bl, br, ...rest] = o.map(map);
    return {
      outline: [bl, { to: br, tabs: tabs.map(x => r2(x + width / 2)), tabLen }, ...rest] as EdgeSpec[],
      engrave: art.lines.map((l): MarkSpec => ({ line: l.map(map) })),
    };
  };
  const relief = (id: number, name: string, art: Traced, x: number, front: boolean): PartSpec => {
    const o = art.outline!;
    return {
      id, name, label: false,
      at: front ? { o: [x, `${PY}+t`, "D/2+2.5"], ea: X, eb: Y } : { o: [x, `${PY}+t`, "-D/2-2.5"], ea: nX, eb: Y },
      explode: [0, 0, front ? 90 : -90],
      ...standing(art, ((o[1][0] - o[0][0]) * RELIEF_H) / art.h, RELIEF_H * (1 - o[0][1] / art.h), [0], 6),
    };
  };
  const shelf = (id: number, x: number, front: boolean): PartSpec => ({
    id, name: "Поличка під скульптуру", label: false,
    at: { o: [x, PY, 0], ea: front ? X : nX, eb: front ? nZ : Z }, explode: [0, 0, front ? 70 : -70],
    outline: [[-9, "-D/2-t-5"], [9, "-D/2-t-5"], [9, "-D/2"], { to: [-9, "-D/2"], tabs: [9], tabLen: 8 }],
    holes: [{ rect: [-3, "-D/2-2.5-t", 3, "-D/2-2.5"] }],
  });

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
      // shelf carrying the sculpture group
      { rect: [g * PX - 4, PY, g * PX + 4, `${PY}+t`] },
      // string course tabs
      ...LEVELS.flatMap(y => LX.map((x): ShapeSpec => ({ rect: [g * x - 3, y, g * x + 3, `${y}+t`] }))),
    ]),
    // consoles under the cornice
    ...BRACKETS.map((x): ShapeSpec => ({ rect: [`${x}-t/2`, 84, `${x}+t/2`, 88.5] })),
  ];
  const facadeMarks: MarkSpec[] = [
    ...both((g): MarkSpec[] => [
      meander(g > 0 ? 28 : -56, g > 0 ? 56 : -28, 52.5, 55),
    ]),
    // relief panels on the piers and the figure frieze under the cornice, all in the plane of the wall
    ...place(ART.upperLeft, -PX - 13, 57, -PX + 13, 57 + (26 * ART.upperLeft.h) / ART.upperLeft.w),
    ...place(ART.upperRight, PX - 13, 57, PX + 13, 57 + (26 * ART.upperRight.h) / ART.upperRight.w),
    ...place(ART.frieze, -55, 77, 55, 82.5),
  ];
  // one strip of a string course along a pier face (front/back) or a side wall
  const ledgeFace = (id: number, y: number, g: 1 | -1, front: boolean): PartSpec => {
    const up = (g > 0) === front; // which way the sheet's thickness runs for this handedness
    return {
      id, name: "Пояс, на фасад", label: false,
      at: { o: [0, up ? y : `${y}+t`, 0], ea: g > 0 ? X : nX, eb: front ? nZ : Z }, explode: [0, 0, front ? 60 : -60],
      outline: [[24, `-D/2-${LEDGE}`], [`W/2+${LEDGE}`, `-D/2-${LEDGE}`], [`W/2+${LEDGE}`, "-D/2"], { to: [24, "-D/2"], tabs: LX.map(x => `W/2+${LEDGE}-${x}`), tabLen: 6 }],
    };
  };
  // `half` 0 is a strip across the whole side; +1 / -1 are the two stubs either side of the doorway
  const ledgeSide = (id: number, y: number, g: 1 | -1, half: 0 | 1 | -1 = 0): PartSpec => ({
    id, name: "Пояс, на бік", label: false,
    at: { o: [g > 0 ? "W/2" : "-W/2", y, 0], ea: g > 0 ? Z : nZ, eb: g > 0 ? X : nX }, explode: [g * 60, 0, 0],
    outline: half === 0
      ? [["-D/2", 0], { to: ["D/2", 0], tabs: [`D/2-${LA}`, `D/2+${LA}`], tabLen: 6 }, ["D/2", LEDGE], ["-D/2", LEDGE]]
      : half > 0
        ? [[SP / 2 + 3, 0], { to: ["D/2", 0], tabs: [LA - SP / 2 - 3], tabLen: 6 }, ["D/2", LEDGE], [SP / 2 + 3, LEDGE]]
        : [["-D/2", 0], { to: [-SP / 2 - 3, 0], tabs: [`D/2-${LA}`], tabLen: 6 }, [-SP / 2 - 3, LEDGE], ["-D/2", LEDGE]],
  });

  // a console tucked under the cornice
  const bracket = (id: number, x: number, front: boolean): PartSpec => ({
    id, name: "Кронштейн карниза", label: false,
    at: front ? { o: [`${x}+t/2`, 0, "D/2"], ea: Z, eb: Y } : { o: [`${x}-t/2`, 0, "-D/2"], ea: nZ, eb: Y },
    explode: [0, 0, front ? 95 : -95],
    outline: [[0, 82.5], [2.5, 83.5], [4, 85.5], [7, 87], [7, "H1"], [0, "H1"], { to: [0, 82.5], tabs: [3.75], tabLen: 4.5 }],
  });
  // the side passage: an arched doorway SP wide and SPH high, cut from the floor up through all four cross walls
  const SP = 14, SPH = 40, TABA = 14;
  const doorway: EdgeSpec[] = [
    { to: [-SP / 2, 0], tabs: [`D/2-t-${TABA}`], tabLen: 6 },
    [-SP / 2, SPH - SP / 2],
    { to: [SP / 2, SPH - SP / 2], arc: -SP / 2 },
    [SP / 2, 0],
    { to: ["D/2-t", 0], tabs: [TABA - SP / 2], tabLen: 6 },
  ];
  const doorFrame: MarkSpec = { line: [[-SP / 2 - 3, 0], [-SP / 2 - 3, SPH + 4], [SP / 2 + 3, SPH + 4], [SP / 2 + 3, 0]] };
  // where those walls tab into the base (plate coords: a = x, b = -z)
  const doorSlots = (x0: string | number, x1: string | number): ShapeSpec[] => [{ rect: [x0, TABA - 3, x1, TABA + 3] }, { rect: [x0, -TABA - 3, x1, -TABA + 3] }];
  const sideOutline: EdgeSpec[] = [
    ["-D/2+t", 0],
    ...doorway,
    { to: ["D/2-t", "H1"], fingers: "n", teeth: "out" },
    { to: ["-D/2+t", "H1"], tabs: ["D/2-t"], tabLen: 10 },
    { to: ["-D/2+t", 0], fingers: "n", teeth: "out" },
  ];
  // the short sides carry the same decoration as the facades: relief panel, key pattern, figure frieze
  const sideDecor = (art: Traced) => ({
    holes: [
      // string courses
      ...LEVELS.flatMap((y): ShapeSpec[] => [{ rect: [-LA - 3, y, -LA + 3, `${y}+t`] }, { rect: [LA - 3, y, LA + 3, `${y}+t`] }]),
    ] as ShapeSpec[],
    engrave: [
      doorFrame, meander(-18, 18, 52.5, 55),
      ...place(art, -13, 57, 13, 57 + (26 * art.h) / art.w),
      ...place(ART.friezeSide, -19, 77, 19, 82.5),
    ] as MarkSpec[],
  });
  const passageWall = (id: number, name: string, g: 1 | -1): PartSpec => ({
    id, name,
    at: g > 0 ? { o: [`${VR}+t`, 0, 0], ea: Z, eb: Y } : { o: [`-${VR}-t`, 0, 0], ea: nZ, eb: Y },
    outline: [
      ["-D/2+t", 0],
      ...doorway,
      { to: ["D/2-t", "SH"], tabs: [12, 40], tabLen: 8 },
      ["-D/2+t", "SH"],
      { to: ["-D/2+t", 0], tabs: [8, 36], tabLen: 8 },
    ],
    engrave: [doorFrame],
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
  const atticArt = place(ART.attic, -AX + 5, 2, AX - 5, 20);
  // slots the attic needs in the plate below it and in the roof above it (plate coords: a = x, b = -z)
  const atticSlots: ShapeSpec[] = [
    ...[-25, 25].flatMap((x): ShapeSpec[] => [
      { rect: [x - 5, -AZ, x + 5, `-${AZ}+t`] }, { rect: [x - 5, `${AZ}-t`, x + 5, AZ] },
    ]),
    { rect: [`${AX}-t`, -4, AX, 4] }, { rect: [-AX, -4, `-${AX}+t`, 4] },
  ];

  // ---- balustrade around the roof
  const RX = 60, RZ = 24, roofY = "H1+2*t+AH";
  // the crest of palmettes that crowns the attic
  const SIDE = 2 * (RZ - 4.3); // short sides are cut for the thickest sheet the model allows
  const railLong = (id: number, name: string, front: boolean): PartSpec => ({
    id, name, label: false,
    at: front ? { o: [0, roofY, `${RZ}-t`], ea: X, eb: Y } : { o: [0, roofY, `-${RZ}+t`], ea: nX, eb: Y },
    explode: [0, 90, front ? 15 : -15],
    ...standing(ART.crest, 2 * RX, 9, [-27, 27], 8),
  });
  const railShort = (id: number, name: string, g: 1 | -1): PartSpec => ({
    id, name, label: false,
    at: g > 0 ? { o: [`${RX}-t`, roofY, 0], ea: nZ, eb: Y } : { o: [`-${RX}+t`, roofY, 0], ea: Z, eb: Y },
    explode: [g * 15, 90, 0],
    ...standing(ART.crestSide, SIDE, 9, [0], 8),
  });
  const railSlots: ShapeSpec[] = [
    ...[-27, 27].flatMap((x): ShapeSpec[] => [
      { rect: [x - 4, -RZ, x + 4, `-${RZ}+t`] }, { rect: [x - 4, `${RZ}-t`, x + 4, RZ] },
    ]),
    { rect: [`${RX}-t`, -4, RX, 4] }, { rect: [-RX, -4, `-${RX}+t`, 4] },
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
        ...doorSlots("W/2-t", "W/2"), ...doorSlots("-W/2", "-W/2+t"),
        ...doorSlots(VR, `${VR}+t`), ...doorSlots(`-${VR}-t`, -VR),
      ],
      engrave: [-15, -5, 5, 15].map((x): MarkSpec => ({ line: [[x, -37], [x, 37]] })),
    },
    { id: 2, name: "Передній фасад", at: { o: [0, 0, "D/2-t"], ea: X, eb: Y }, explode: [0, 0, 50], outline: facadeOutline, holes: facadeHoles, engrave: facadeMarks },
    { id: 3, name: "Задній фасад", at: { o: [0, 0, "-D/2+t"], ea: nX, eb: Y }, explode: [0, 0, -50], outline: facadeOutline, holes: facadeHoles, engrave: facadeMarks },
    { id: 4, name: "Правий бік", at: { o: ["W/2-t", 0, 0], ea: nZ, eb: Y }, explode: [45, 0, 0], outline: sideOutline, ...sideDecor(ART.upperRight) },
    { id: 5, name: "Лівий бік", at: { o: ["-W/2+t", 0, 0], ea: Z, eb: Y }, explode: [-45, 0, 0], outline: sideOutline, ...sideDecor(ART.upperLeft) },
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
    { id: 15, name: "Аттик, перед", label: false, at: { o: [0, "H1+t", `${AZ}-t`], ea: X, eb: Y }, explode: [0, 45, 20], outline: atticLong, engrave: atticArt },
    { id: 16, name: "Аттик, зад", label: false, at: { o: [0, "H1+t", `-${AZ}+t`], ea: nX, eb: Y }, explode: [0, 45, -20], outline: atticLong, engrave: atticArt },
    { id: 17, name: "Аттик, правий бік", at: { o: [`${AX}-t`, "H1+t", 0], ea: nZ, eb: Y }, explode: [20, 45, 0], outline: atticShort, holes: [{ circle: [0, 11, 3.5] }] },
    { id: 18, name: "Аттик, лівий бік", at: { o: [`-${AX}+t`, "H1+t", 0], ea: Z, eb: Y }, explode: [-20, 45, 0], outline: atticShort, holes: [{ circle: [0, 11, 3.5] }] },
    {
      id: 19, name: "Дах",
      at: { o: [0, "H1+t+AH", 0], ea: X, eb: nZ }, explode: [0, 70, 0],
      outline: [[-RX - 4, -RZ - 4], [RX + 4, -RZ - 4], [RX + 4, RZ + 4], [-RX - 4, RZ + 4]],
      holes: [...atticSlots, ...railSlots],
      engrave: [{ rect: [-40, -9, 40, 9] }, { rect: [-36, -6, 36, 6] }],
    },
    shelf(20, -PX, true), shelf(21, PX, true), shelf(22, PX, false), shelf(23, -PX, false),
    relief(24, "Скульптура, ліва", ART.lowerLeft, -PX, true),
    relief(25, "Скульптура, права", ART.lowerRight, PX, true),
    relief(26, "Скульптура, ліва (зад)", ART.lowerLeft, PX, false),
    relief(27, "Скульптура, права (зад)", ART.lowerRight, -PX, false),
    ...LEVELS.flatMap((y, i) => [
      ledgeFace(50 + i * 6, y, 1, true), ledgeFace(51 + i * 6, y, -1, true), ledgeFace(52 + i * 6, y, 1, false), ledgeFace(53 + i * 6, y, -1, false),
      ...(i === 0
        ? [ledgeSide(54, y, 1, 1), ledgeSide(55, y, -1, 1), ledgeSide(62, y, 1, -1), ledgeSide(63, y, -1, -1)]
        : [ledgeSide(54 + i * 6, y, 1), ledgeSide(55 + i * 6, y, -1)]),
    ]),
    ...BRACKETS.flatMap((x, i) => [bracket(28 + i * 2, x, true), bracket(29 + i * 2, x, false)]),
    railLong(42, "Гребінь, перед", true),
    railLong(43, "Гребінь, зад", false),
    railShort(44, "Гребінь, правий бік", 1),
    railShort(45, "Гребінь, лівий бік", -1),
  ];

  const spec: PuzzleSpec = {
    name: "Арка",
    description: "Тріумфальна арка: скульптурні групи, рельєфи й фриз із фігурами, пояси довкола пілонів, кесонне склепіння, карниз на кронштейнах, аттик із гребенем пальмет.",
    limits: { maxT: 4.3 },
    params: { W, D, H1, OW, SH, AH, n: N },
    parts,
    steps: [
      { ids: [1], text: "Основа." },
      { ids: [6, 7], text: "Дві стінки проходу шипами в основу, гравіюванням одна до одної. Арки в них продовжують бічний прохід." },
      { ids: [3], text: "Задній фасад: шипи знизу в основу, шипи стінок проходу в його пази." },
      { ids: [8, 9, 10, 11, 12, 13], text: "Шість планок склепіння по дузі: шип кожної в косий паз фасаду." },
      { ids: [2], text: "Передній фасад закриває стінки й планки з другого боку." },
      { ids: [4, 5], text: "Бічні стінки: пальці між пальцями фасадів, шип у основу." },
      { ids: [14], text: "Карниз насаджується на шипи фасадів і боків." },
      { ids: [15, 16, 17, 18], text: "Аттик: чотири стінки шипами в карниз." },
      { ids: [19], text: "Дах на шипи аттика." },
      { ids: [42, 43, 44, 45], text: "Гребінь із пальмет: довгі сторони шипами в дах, короткі між ними." },
      { ids: Array.from({ length: 14 }, (_, i) => 50 + i), text: "Пояси на двох рівнях: довгі на фасади, короткі на боки між ними; нижній пояс на боках розірваний проходом." },
      { ids: [20, 21, 22, 23], text: "Чотири полички шипом у фасад, по одній на пілон з кожного боку." },
      { ids: [24, 25, 26, 27], text: "Скульптурні групи: шип плінта в паз полички. Обережно з сурмою та крилами, вони тонкі." },
      { ids: Array.from({ length: 14 }, (_, i) => 28 + i), text: "Чотирнадцять кронштейнів під карниз, по сім на фасад. Готово." },
    ],
  };
  writeFileSync("src/puzzles/arch.json", formatSpec(spec) + "\n");
});
