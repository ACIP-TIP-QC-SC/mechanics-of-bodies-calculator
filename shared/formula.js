/* =====================================================================
 * SHARED · Formula parser (browser + Node)
 * A small safe parser (no eval) for formulas typed by the user: + − × ÷ ^ (or **), brackets,
 * implied multiplication (2θ, 3 sin θ), sin cos tan asin acos atan sec csc cot sqrt abs exp ln log,
 * and pi (π) and deg. compile(src, Set(names)) returns f(env) with env = {name: value}.
 * Used by Virtual Work and Centroids by integration (Statics) and by Particle Kinetics (Dynamics).
 * ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI, DEG = PI / 180;
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
  };
  const CONST = { pi: PI, 'π': PI, deg: DEG };

  function tokenize(src) {
    const t = [], s = String(src);
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
        if (!m) throw new Error(`cannot read the number at “${s.slice(i, i + 6)}”`);
        t.push({ k: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[A-Za-z_Ͱ-Ͽ]/.test(c)) {
        const m = /^[A-Za-z_Ͱ-Ͽ][A-Za-z_0-9Ͱ-Ͽ]*/.exec(s.slice(i));
        t.push({ k: 'id', v: m[0] }); i += m[0].length; continue;
      }
      if (c === '*' && s[i + 1] === '*') { t.push({ k: '^' }); i += 2; continue; }
      if ('+-*/^(),'.includes(c)) { t.push({ k: c }); i++; continue; }
      if (c === '−' || c === '–') { t.push({ k: '-' }); i++; continue; }
      if (c === '×' || c === '·') { t.push({ k: '*' }); i++; continue; }
      if (c === '²' || c === '³') { t.push({ k: '^' }, { k: 'n', v: c === '²' ? 2 : 3 }); i++; continue; }
      throw new Error(`the character “${c}” is not allowed`);
    }
    return t;
  }
  /** Parse a formula. names: Set of allowed variable names. Returns f(env) with env = {name: value}. */
  function compile(src, names) {
    if (src === undefined || src === null || String(src).trim() === '') throw new Error('the formula is empty');
    const tk = tokenize(src);
    let p = 0;
    const peek = () => tk[p], next = () => tk[p++];
    const isFunc = (x) => x && x.k === 'id' && FUNCS[x.v];
    const startsAtom = (x) => x && (x.k === 'n' || x.k === 'id' || x.k === '(');
    function expr() {
      let a = term();
      while (peek() && (peek().k === '+' || peek().k === '-')) {
        const op = next().k, b = term(), l = a;
        a = op === '+' ? (e) => l(e) + b(e) : (e) => l(e) - b(e);
      }
      return a;
    }
    function term() {
      let a = unary();
      for (;;) {
        const x = peek();
        if (x && (x.k === '*' || x.k === '/')) {
          next(); const b = unary(), l = a;
          a = x.k === '*' ? (e) => l(e) * b(e) : (e) => l(e) / b(e);
        } else if (startsAtom(x)) { const b = power(), l = a; a = (e) => l(e) * b(e); } else break;
      }
      return a;
    }
    function unary() {
      const x = peek();
      if (x && x.k === '-') { next(); const a = unary(); return (e) => -a(e); }
      if (x && x.k === '+') { next(); return unary(); }
      return power();
    }
    function power() {
      const a = primary();
      if (peek() && peek().k === '^') { next(); const b = unary(); return (e) => Math.pow(a(e), b(e)); }
      return a;
    }
    function primary() {
      const x = next();
      if (!x) throw new Error('the formula ends too early');
      if (x.k === 'n') { const v = x.v; return () => v; }
      if (x.k === '(') { const a = expr(); if (!peek() || next().k !== ')') throw new Error('a closing bracket “)” is missing'); return a; }
      if (x.k === 'id') {
        if (FUNCS[x.v]) {
          const f = FUNCS[x.v];
          if (peek() && peek().k === '(') { next(); const a = expr(); if (!peek() || next().k !== ')') throw new Error('a closing bracket “)” is missing'); return (e) => f(a(e)); }
          // sin 2θ, cos θ: the argument runs to the next operator or function name
          if (!startsAtom(peek())) throw new Error(`${x.v} needs an argument`);
          let a = power();
          while (startsAtom(peek()) && !isFunc(peek())) { const b = power(), l = a; a = (e) => l(e) * b(e); }
          return (e) => f(a(e));
        }
        if (x.v in CONST) { const v = CONST[x.v]; return () => v; }
        if (names.has(x.v)) { const n = x.v; return (e) => e[n]; }
        throw new Error(`unknown name “${x.v}”`);
      }
      throw new Error(`“${x.k}” is out of place`);
    }
    const f = expr();
    if (p < tk.length) throw new Error(`“${tk[p].k === 'id' || tk[p].k === 'n' ? tk[p].v : tk[p].k}” is out of place`);
    return f;
  }

  /** f, f′ and f″ at x by five-point central differences (step scaled to x); values below the
   *  rounding noise of the differences are set to zero. */
  function d012(f, x, h) {
    h = h || 1e-3 * Math.max(1, Math.abs(x));
    const f0 = f(x), p1 = f(x + h), m1 = f(x - h), p2 = f(x + 2 * h), m2 = f(x - 2 * h);
    const d1 = (-p2 + 8 * p1 - 8 * m1 + m2) / (12 * h), d2 = (-p2 + 16 * p1 - 30 * f0 + 16 * m1 - m2) / (12 * h * h);
    const sc = Math.max(Math.abs(f0), Math.abs(p2), Math.abs(m2), 1e-300);
    return [f0, Math.abs(d1) < 1e-9 * sc / h ? 0 : d1, Math.abs(d2) < 1e-7 * sc / (h * h) ? 0 : d2];
  }

  const Formula = { FUNCS, CONST, tokenize, compile, d012 };
  root.Formula = Formula;
  if (typeof module !== 'undefined' && module.exports) module.exports = Formula;
})(typeof window !== 'undefined' ? window : globalThis);
