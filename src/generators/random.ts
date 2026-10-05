export interface Rng {
  next(): number;
  int(a: number, b: number): number;
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
}

// mulberry32: tiny seeded PRNG, same seed -> same design on every machine.
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: xs => xs[Math.floor(next() * xs.length)],
    chance: p => next() < p,
  };
}

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 999999);
}
