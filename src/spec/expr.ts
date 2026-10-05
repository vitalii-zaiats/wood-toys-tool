export type Env = Record<string, number>;

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, hypot: Math.hypot, sqrt: Math.sqrt, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};

// Arithmetic over named values: + - * / ( ) and the functions above.
// Hand-rolled so that opening someone's puzzle file never runs their code.
export function evaluate(src: string, env: Env): number {
  let i = 0;
  const fail = (msg: string): never => { throw new Error(`Вираз "${src}": ${msg}`); };
  const ws = () => { while (src[i] === " ") i++; };
  const eat = (ch: string) => { ws(); if (src[i] === ch) { i++; return true; } return false; };

  function primary(): number {
    ws();
    if (eat("(")) { const v = sum(); if (!eat(")")) fail("бракує дужки )"); return v; }
    const num = /^\d*\.?\d+(e[-+]?\d+)?/i.exec(src.slice(i));
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const id = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (!id) return fail(i < src.length ? `неочікуваний символ "${src[i]}"` : "обривається");
    i += id[0].length;
    const name = id[0];
    if (eat("(")) {
      if (!Object.hasOwn(FUNCS, name)) fail(`невідома функція ${name}`);
      const args: number[] = [];
      if (!eat(")")) { do args.push(sum()); while (eat(",")); if (!eat(")")) fail("бракує дужки )"); }
      return FUNCS[name](...args);
    }
    if (name === "pi") return Math.PI;
    if (!Object.hasOwn(env, name)) fail(`невідомий параметр ${name}`);
    return env[name];
  }
  function unary(): number { return eat("-") ? -unary() : primary(); }
  function product(): number {
    let v = unary();
    for (;;) { if (eat("*")) v *= unary(); else if (eat("/")) v /= unary(); else return v; }
  }
  function sum(): number {
    let v = product();
    for (;;) { if (eat("+")) v += product(); else if (eat("-")) v -= product(); else return v; }
  }

  const v = sum();
  ws();
  if (i < src.length) fail(`неочікуваний символ "${src[i]}"`);
  return v;
}
