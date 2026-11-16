/* =====================================================================
 * Mechanics of Bodies Calculator — CORE (shared by every discipline)
 * ---------------------------------------------------------------------
 * Units and conversion, number formatting (4 significant figures), the
 * step recorder, the result builder and the preset merge. No DOM use:
 * this file also runs in Node for tests/run.js.
 *
 * Every solver returns
 *   { ok, err:[], warn:[], status:{cls,text}, out:[{k,v,u,hl}], steps:[...], geo:{...} }
 * A step is { t: title, n: note, f: formula, s: substitution, r: result,
 *             table: { head:[...], rows:[[...]] } }.
 * ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI, DEG = PI / 180;

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const UNITS = {
    SI: { id: 'SI', label: 'SI', name: 'SI units', g: 9.81, len: 'm', lenS: 'mm', force: 'kN', forces: ['kN', 'N'], mass: 'kg', stress: 'MPa', modulus: 'GPa', press: 'kPa', acc: 'm/s²', vel: 'm/s' },
    US: { id: 'US', label: 'U.S.', name: 'U.S. Customary units', g: 32.2, len: 'ft', lenS: 'in.', force: 'lb', forces: ['lb', 'kip'], mass: 'slug', stress: 'ksi', modulus: 'ksi', press: 'psf', acc: 'ft/s²', vel: 'ft/s' },
  };
  /* Factor that turns one of each unit into SI base units (N, m, kg, s, Pa). */
  const TO_SI = {
    m: 1, mm: 1e-3, cm: 1e-2, km: 1e3, ft: 0.3048, 'in.': 0.0254, in: 0.0254,
    N: 1, kN: 1e3, MN: 1e6, lb: 4.4482216152605, kip: 4448.2216152605,
    Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9, psi: 6894.757293168, ksi: 6894757.293168, psf: 47.88025898,
    kg: 1, Mg: 1e3, slug: 14.593902937, s: 1, rad: 1,
  };
  /* The unit each one becomes when the viewer switches system. */
  const TWIN = {
    US: { m: 'ft', mm: 'in.', cm: 'in.', kN: 'kip', N: 'lb', MN: 'kip', kPa: 'psf', MPa: 'ksi', GPa: 'ksi', Pa: 'psf', kg: 'slug', Mg: 'slug' },
    SI: { ft: 'm', 'in.': 'mm', in: 'mm', kip: 'kN', lb: 'N', psf: 'kPa', psi: 'MPa', ksi: 'MPa', slug: 'kg' },
  };
  const SUP = { '²': 2, '³': 3, '⁴': 4 };
  /** Factor to SI for a compound unit such as "kN·m", "lb/ft", "mm⁴" or "kN/m". */
  function unitFactor(u) {
    const [num, ...den] = String(u).split('/');
    const part = (p) => p.split('·').reduce((f, x) => {
      x = x.trim(); if (!x) return f;
      let pw = 1; const last = x[x.length - 1];
      if (SUP[last]) { pw = SUP[last]; x = x.slice(0, -1); }
      if (!(x in TO_SI)) throw new Error('Unknown unit: ' + x);
      return f * Math.pow(TO_SI[x], pw);
    }, 1);
    return den.reduce((f, d) => f / part(d), part(num));
  }
  /** Convert a value between two units of the same kind. */
  function convert(v, from, to) { return from === to ? v : (v * unitFactor(from)) / unitFactor(to); }
  /** The same compound unit written in the other system, e.g. twin("kN/m","US") = "kip/ft". */
  function twin(u, sys) {
    const map = TWIN[sys] || {};
    return String(u).replace(/[A-Za-z.]+/g, (x) => map[x] || x);
  }
  /** Round away conversion noise so a converted input reads cleanly. */
  const tidy = (v, sig) => (typeof v === 'number' && isFinite(v) ? parseFloat(v.toPrecision(sig || 6)) : v);

  /* ------------------------------------------------------------------ */
  /* Numbers                                                            */
  /* ------------------------------------------------------------------ */
  /** Round to `sig` significant figures (default 4) and return a string. */
  function fmt(x, sig) {
    sig = sig || 4;
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '—';
    if (Math.abs(x) < 1e-12) return '0';
    const a = Math.abs(x);
    const s = (a >= 1e-4 && a < 1e10) ? String(parseFloat(x.toPrecision(sig))) : x.toExponential(sig - 1);
    return s.replace('-', '−');
  }
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
  const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(a), Math.abs(b));

  /** "a + b − c" from signed terms [{v: sign carrier, txt: magnitude text}] (zero terms are dropped). */
  function sumStr(terms) {
    let s = '';
    terms.forEach((t) => {
      if (!t || !t.txt) return;
      const neg = t.v < 0;
      s += s ? (neg ? ' − ' : ' + ') : (neg ? '−' : '');
      s += t.txt;
    });
    return s || '0';
  }
  /** Polynomial c0 + c1·x + c2·x² + … as text, lowest power first, zero terms dropped. */
  function polyStr(c, x) {
    x = x || 'x';
    const scale = Math.max(1e-12, ...c.map((v, i) => Math.abs(v)));
    const pw = ['', x, x + '²', x + '³', x + '⁴'];
    const terms = [];
    c.forEach((v, i) => {
      if (Math.abs(v) < 1e-9 * scale) return;
      const a = fmt(Math.abs(v));
      terms.push({ v, txt: i === 0 ? a : (a === '1' ? '' : a) + pw[i] });
    });
    return sumStr(terms);
  }

  /* ------------------------------------------------------------------ */
  /* Steps, results, presets                                            */
  /* ------------------------------------------------------------------ */
  function Steps() {
    const list = [];
    return {
      list,
      /** add({t,n,f,s,r,table}) or add(t, f, s, r, n) */
      add(t, f, s, r, n) { const o = (t && typeof t === 'object') ? t : { t, f, s, r, n }; list.push(o); return o; },
    };
  }
  function fail(err, warn) {
    return { ok: false, err: Array.isArray(err) ? err : [err || 'Invalid input'], warn: warn || [], steps: [], out: [], geo: null };
  }
  const clone = (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o)));
  /** Deep merge of `patch` over `base`. Arrays are replaced whole, so a preset's list never mixes with the default list. */
  function deepMerge(base, patch) {
    if (patch === undefined) return clone(base);
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
    const out = (base && typeof base === 'object' && !Array.isArray(base)) ? clone(base) : {};
    Object.keys(patch).forEach((k) => { out[k] = deepMerge(out[k], patch[k]); });
    return out;
  }
  /** A preset is a complete snapshot merged over fresh defaults (never over the current state). */
  function presetState(defaults, preset) { return deepMerge(defaults(), (preset && preset.state) || {}); }

  /** Solve A·x = b for any shape by reduction to echelon form. Returns { rank, x (when unique), consistent }. */
  function linSolve(A, b) {
    const m = A.length, n = m ? A[0].length : 0;
    const M = A.map((r, i) => r.concat([b[i]]));
    let scale = 0; M.forEach((r) => r.forEach((v, j) => { if (j < n) scale = Math.max(scale, Math.abs(v)); }));
    const tol = 1e-10 * (scale || 1);
    const piv = []; let row = 0;
    for (let col = 0; col < n && row < m; col++) {
      let p = row; for (let i = row + 1; i < m; i++) if (Math.abs(M[i][col]) > Math.abs(M[p][col])) p = i;
      if (Math.abs(M[p][col]) <= tol) continue;
      [M[row], M[p]] = [M[p], M[row]];
      const d = M[row][col]; for (let j = col; j <= n; j++) M[row][j] /= d;
      for (let i = 0; i < m; i++) if (i !== row) { const f = M[i][col]; if (f) for (let j = col; j <= n; j++) M[i][j] -= f * M[row][j]; }
      piv.push(col); row++;
    }
    const rank = piv.length;
    let bs = 0; b.forEach((v) => (bs = Math.max(bs, Math.abs(v))));
    let consistent = true;
    for (let i = rank; i < m; i++) if (Math.abs(M[i][n]) > 1e-8 * (bs || 1)) consistent = false;
    let x = null;
    if (rank === n && consistent) { x = new Array(n).fill(0); piv.forEach((c, i) => (x[c] = M[i][n])); }
    return { rank, x, consistent };
  }

  /** Root of fn on [lo, hi] by bisection (fn(lo) and fn(hi) must differ in sign). */
  function bisect(fn, lo, hi, iters) {
    let flo = fn(lo);
    for (let i = 0; i < (iters || 200); i++) {
      const mid = 0.5 * (lo + hi), fm = fn(mid);
      if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  const Core = {
    APP_TITLE: 'Mechanics of Bodies Calculator',
    PI, DEG, UNITS, TO_SI, unitFactor, convert, twin, tidy, fmt, clamp, near, sumStr, polyStr,
    Steps, fail, clone, deepMerge, presetState, linSolve, bisect,
  };
  root.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
