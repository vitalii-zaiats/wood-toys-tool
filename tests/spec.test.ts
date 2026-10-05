import { describe, expect, it } from "vitest";
import { area } from "../src/geometry/poly";
import { buildPuzzle } from "../src/spec/build";
import { evaluate } from "../src/spec/expr";
import { parseSpec } from "../src/spec/file";
import type { PuzzleSpec } from "../src/spec/types";

describe("expressions", () => {
  const env = { W: 80, t: 3 };
  it.each([
    ["W/2 - t", 37], ["-W", -80], ["2+3*4", 14], ["(2+3)*4", 20], ["hypot(3, 4)", 5], ["1.5e1", 15], ["-(-t)", 3], ["8/4/2", 1], ["max(1, W, 5)", 80],
  ])("%s", (src, want) => expect(evaluate(src, env)).toBeCloseTo(want));

  it.each(["W +", "foo", "2 $ 3", "(1", "alert(1)", "constructor", "W.x", ""])("rejects %j", src => {
    expect(() => evaluate(src, env)).toThrow();
  });
});

describe("buildPuzzle", () => {
  const box = (outline: PuzzleSpec["parts"][0]["outline"]): PuzzleSpec => ({ name: "x", params: { A: 40 }, parts: [{ id: 1, name: "p", outline, label: false }] });
  const outlineOf = (spec: PuzzleSpec, t: number, scale: number) => buildPuzzle(spec, { t, scale }).parts[0].outline;

  it("scales lengths but not the thickness", () => {
    const o = outlineOf(box([[0, 0], ["A", 0], ["A", "t"], [0, "t"]]), 3, 2);
    expect(o).toEqual([[0, 0], [80, 0], [80, 3], [0, 3]]);
  });

  it("tabs add material outside a counter-clockwise outline", () => {
    const plain = box([[0, 0], ["A", 0], ["A", 20], [0, 20]]);
    const tabbed = box([[0, 0], { to: ["A", 0], tabs: [10, 30], tabLen: 8 }, ["A", 20], [0, 20]]);
    expect(area(outlineOf(tabbed, 3, 1)) - area(outlineOf(plain, 3, 1))).toBeCloseTo(2 * 8 * 3);
    expect(Math.min(...outlineOf(tabbed, 3, 1).map(q => q[1]))).toBeCloseTo(-3);
  });

  it("fingers remove or add every second cell", () => {
    const edge = (teeth: "in" | "out") => box([[0, 0], ["A", 0], { to: ["A", 20], fingers: 5, teeth }, [0, 20]]);
    expect(area(outlineOf(edge("in"), 3, 1))).toBeCloseTo(800 - 2 * 4 * 3);
    expect(area(outlineOf(edge("out"), 3, 1))).toBeCloseTo(800 + 2 * 4 * 3);
  });

  it("appends the test comb and derives steps", () => {
    const m = buildPuzzle({ name: "x", parts: [{ id: 4, name: "p", outline: [[0, 0], [30, 0], [30, 30]], at: { o: [0, 0, 0], ea: [1, 0, 0], eb: [0, 1, 0] } }] }, { t: 3, scale: 1 });
    expect(m.parts.map(p => p.id)).toEqual([4, 5]);
    expect(m.steps).toEqual([{ ids: [4], text: "p" }]);
  });

  it("reports broken files with the part they are in", () => {
    expect(() => parseSpec("nope")).toThrow("JSON");
    expect(() => parseSpec('{"seed":1}')).toThrow("parts");
    expect(() => parseSpec('{"parts":[{"id":7,"outline":[[0,0],["Q",0],[1,1]]}]}')).toThrow(/Деталь 7.*Q|Q/);
    expect(() => parseSpec('{"parts":[{"id":7,"outline":"x"}]}')).toThrow("Деталь 7");
    expect(() => parseSpec('{"parts":[{"id":7,"outline":[[0,0],[1,0],[1,1]],"holes":[{"star":[1]}]}]}')).toThrow("Деталь 7");
  });
});
