/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M5 Beam Deflection
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapter 16 and Appendix D.
 *   curve   slope and deflection by integrating EI d²v/dx² = M(x) region by
 *           region, with the boundary and continuity conditions (16.2)
 *   super   the same beam split into one load at a time and added, using the
 *           standard cases of Appendix D where they apply (16.4)
 *   indet   statically indeterminate beams by superposition: remove the
 *           redundants, then make the supports fit (compatibility) (16.6)
 * A straight prismatic beam (EI constant), x from the left end, loads
 * downward, v up positive (so a downward deflection is negative), slopes
 * counterclockwise positive.
 *
 * Numerical core: the deflection is written with one term per load and per
 * reaction (each term is a power of (x − a) that starts at a), plus C1 x + C2.
 * The reactions, C1 and C2 come out of one linear system: ΣF_y = 0, ΣM = 0,
 * v = 0 at every support and θ = 0 at every fixed support. That works for
 * determinate and indeterminate beams alike. The steps are then written in
 * the book's way from that solution.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const BS = root.BeamStress || require('./beamstress.js');
  const { fmt, fail, Steps, linSolve, sumStr } = Core;
  const { toBase: B, fromBase: D } = MD;
  const FU = { SI: ['kN', 'N'], US: ['kip', 'lb'] };
  const LET = 'ABCDEFGH';
  const FACT = [1, 1, 2, 6, 24, 120, 720];

  const sup = (type, x) => ({ type, x });
  const ld = (kind, o) => Object.assign({ kind, x: 0, P: 0, M: 0, dir: 'ccw', x1: 0, x2: 0, w1: 0, w2: 0 }, o);
  function defaults() {
    return {
      mode: 'curve', fu: 'kN', ei: 'num', Isrc: 'typed', I: 50e6, W: 'W12×26', E: 200, mat: 'a36', at: 1.5,
      bm: { L: 3, sups: [sup('pin', 0), sup('roller', 3)], loads: [ld('point', { x: 2, P: 6 })] },
    };
  }
  const KLOAD = { x: 'L', x1: 'L', x2: 'L', w1: 'W', w2: 'W', P: 'F', M: 'FL' };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = FU[from].includes(st.fu) ? st.fu : FU[from][0], cv = (o, k) => MD.convertObj(o, k, from, to, fu);
    cv(st, { I: 'I', E: 'MOD', at: 'L' }); cv(st.bm, { L: 'L' });
    (st.bm.sups || []).forEach((s) => cv(s, { x: 'L' })); (st.bm.loads || []).forEach((q) => cv(q, KLOAD));
    st.fu = Core.twin(fu, to);
    return st;
  }

  /* ------------------------------------------------------------------ */
  /* Polynomials (coefficients from x⁰ up)                              */
  /* ------------------------------------------------------------------ */
  const padd = (a, b) => { const r = a.slice(); b.forEach((v, i) => (r[i] = (r[i] || 0) + v)); return r; };
  const pscale = (a, k) => a.map((v) => v * k);
  const binom = (n, k) => FACT[n] / (FACT[k] * FACT[n - k]);
  /** Coefficients of c (x − a)^n / n!. */
  const pshift = (a, n, c) => { const r = []; for (let k = 0; k <= n; k++) r[k] = (c / FACT[n]) * binom(n, k) * Math.pow(-a, n - k); return r; };
  const pint = (a) => [0].concat(a.map((v, i) => v / (i + 1)));
  const pval = (a, x) => a.reduce((s, v, i) => s + v * Math.pow(x, i), 0);
  const PW = ['', 'x', 'x²', 'x³', 'x⁴', 'x⁵', 'x⁶', 'x⁷'];
  function pstr(c, tail) {
    const sc = Math.max(1e-12, ...c.map((v) => Math.abs(v || 0))), t = [];
    c.forEach((v, i) => { if (!v || Math.abs(v) < 1e-9 * sc) return; const a = fmt(Math.abs(v)); t.push({ v, txt: i === 0 ? a : (a === '1' ? '' : a) + PW[i] }); });
    (tail || []).forEach((x) => t.push({ v: 1, txt: x }));
    return t.length ? sumStr(t) : '0';
  }

  /* ------------------------------------------------------------------ */
  /* Core solve: terms c⟨x − a⟩ⁿ/n! of EI·v                               */
  /* ------------------------------------------------------------------ */
  /** Load terms (EI·v) of the applied loads; loads act downward, couples by dir. */
  function loadTerms(loads) {
    const t = [];
    loads.forEach((q, i) => {
      if (q.kind === 'point') { if (+q.P) t.push({ a: +q.x, n: 3, c: -q.P, i }); }
      else if (q.kind === 'couple') { if (+q.M) t.push({ a: +q.x, n: 2, c: -(q.dir === 'cw' ? -q.M : +q.M), i }); }
      else if (q.kind === 'dist') {
        const k = (q.w2 - q.w1) / (q.x2 - q.x1);
        t.push({ a: +q.x1, n: 4, c: -q.w1, i }, { a: +q.x1, n: 5, c: -k, i }, { a: +q.x2, n: 4, c: +q.w2, i }, { a: +q.x2, n: 5, c: +k, i });
      }
    });
    return t;
  }
  /** d-th derivative of c⟨x − a⟩ⁿ/n! at x. */
  function tval(t, x, d) {
    const m = t.n - (d || 0);
    if (m < 0 || x < t.a - 1e-12) return 0;
    if (m === 0) return x > t.a - 1e-12 ? t.c : 0;
    return (t.c * Math.pow(x - t.a, m)) / FACT[m];
  }
  /** Resultant (upward +) and its moment about x = 0 (counterclockwise +) of each load. */
  function loadStatics(loads) {
    let F = 0, Mo = 0;
    loads.forEach((q) => {
      if (q.kind === 'point') { F -= +q.P; Mo -= +q.P * q.x; }
      else if (q.kind === 'couple') Mo += q.dir === 'cw' ? -q.M : +q.M;
      else if (q.kind === 'dist') { const r = distRes(q); F -= r.F; Mo -= r.F * r.xbar; }
    });
    return { F, Mo };
  }
  function distRes(q) { const L = q.x2 - q.x1, F = 0.5 * (q.w1 + q.w2) * L, xbar = Math.abs(q.w1 + q.w2) > 1e-12 ? q.x1 + (L * (q.w1 + 2 * q.w2)) / (3 * (q.w1 + q.w2)) : (q.x1 + q.x2) / 2; return { F, xbar }; }

  /**
   * Solve a beam (display units, EI = 1): reactions, C1, C2 and the functions EI·v, EI·θ, M, V.
   * sups: [{type, x, label}], loads as in the state.
   */
  function core(L, sups, loads) {
    const unk = [];
    sups.forEach((s) => { unk.push({ kind: 'R', s, a: s.x, n: 3, c: 1, sym: `${s.label}_y` }); if (s.type === 'fixed') unk.push({ kind: 'M', s, a: s.x, n: 2, c: -1, sym: `M_${s.label}` }); });
    const N = unk.length + 2, A = [], b = [], lt = loadTerms(loads), st = loadStatics(loads);
    const row = (fn) => { const r = []; unk.forEach((u) => r.push(fn(u))); return r; };
    A.push(row((u) => (u.kind === 'R' ? 1 : 0)).concat([0, 0])); b.push(-st.F);
    A.push(row((u) => (u.kind === 'R' ? u.a : 1)).concat([0, 0])); b.push(-st.Mo);
    sups.forEach((s) => {
      A.push(row((u) => tval(u, s.x, 0)).concat([s.x, 1])); b.push(-lt.reduce((a, t) => a + tval(t, s.x, 0), 0));
      if (s.type === 'fixed') { A.push(row((u) => tval(u, s.x, 1)).concat([1, 0])); b.push(-lt.reduce((a, t) => a + tval(t, s.x, 1), 0)); }
    });
    const sol = linSolve(A, b);
    if (!sol.x || sol.rank < N) return { ok: false, err: ['The supports cannot hold the beam in place (it is unstable). Add a support or make one of them fixed.'] };
    const x = sol.x, C1 = x[N - 2], C2 = x[N - 1];
    const all = lt.concat(unk.map((u, j) => ({ a: u.a, n: u.n, c: u.c * x[j], u })));
    const f = (d) => (z) => all.reduce((a, t) => a + tval(t, z, d), 0) + (d === 0 ? C1 * z + C2 : d === 1 ? C1 : 0);
    unk.forEach((u, j) => (u.value = Math.abs(x[j]) < 1e-11 ? 0 : x[j]));
    return { ok: true, unk, C1, C2, all, v: f(0), th: f(1), M: f(2), V: f(3), degree: unk.length - 2 };
  }

  /** Polynomials of M, EI·θ (without constant) and EI·v (without constants) in each region. */
  function regions(L, res, cuts) {
    const xs = [0, L].concat(cuts).filter((x) => x >= 0 && x <= L).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-9 * L);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
      let Mp = [0];
      res.all.forEach((t) => { if (t.a <= m && t.n >= 2) Mp = padd(Mp, pshift(t.a, t.n - 2, t.c)); });
      Mp = Mp.map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      const Tp = pint(Mp), Vp = pint(Tp);
      const c1 = res.th(m) - pval(Tp, m), c2 = res.v(m) - pval(Vp, m) - c1 * m;
      out.push({ a, b, Mp, Tp, Vp, c1, c2 });
    }
    return out;
  }

  /** Largest |value| of f over [0, L], refined around the best sample. */
  function extreme(f, L, n) {
    n = n || 800; let bi = 0, bv = 0;
    for (let i = 0; i <= n; i++) { const v = f((L * i) / n); if (Math.abs(v) > Math.abs(bv)) { bv = v; bi = i; } }
    let lo = Math.max(0, (L * (bi - 1)) / n), hi = Math.min(L, (L * (bi + 1)) / n);
    for (let k = 0; k < 80; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(f(m1)) < Math.abs(f(m2))) lo = m1; else hi = m2; }
    const x = (lo + hi) / 2, v = f(x);
    return Math.abs(v) >= Math.abs(bv) ? { x, v } : { x: (L * bi) / n, v: bv };
  }

  /* ------------------------------------------------------------------ */
  /* Appendix D: formulas for a single load on a standard beam          */
  /* ------------------------------------------------------------------ */
  /** The Appendix D row that matches one load on a simply supported beam (pin and roller at the ends) or a cantilever fixed at x = 0, or null. */
  function appendixD(kindB, L, q) {
    const near = (a, b) => Math.abs(a - b) < 1e-9 * L;
    if (kindB === 'ss') {
      if (q.kind === 'point' && near(q.x, L / 2)) return { name: 'P at midspan', th1: 'θ₁ = −PL²/(16EI)', v: 'v_max = −PL³/(48EI) at midspan' };
      if (q.kind === 'point') return { name: 'P at a from the left', th1: 'θ₁ = −Pab(L + b)/(6EIL)', v: 'v = −Pbx(L² − b² − x²)/(6EIL), 0 ≤ x ≤ a' };
      if (q.kind === 'couple' && (near(q.x, L) || near(q.x, 0))) return { name: 'Couple M₀ at an end', th1: 'θ₁ = −M₀L/(6EI), θ₂ = M₀L/(3EI)', v: 'v_max = −M₀L²/(9√3 EI)' };
      if (q.kind === 'dist' && near(q.w1, q.w2) && near(q.x1, 0) && near(q.x2, L)) return { name: 'Uniform w', th1: 'θ_max = −wL³/(24EI)', v: 'v_max = −5wL⁴/(384EI)' };
      if (q.kind === 'dist' && near(q.w1, q.w2) && ((near(q.x1, 0) && near(q.x2, L / 2)) || (near(q.x1, L / 2) && near(q.x2, L)))) return { name: 'Uniform w on half the span', th1: 'θ₁ = −3wL³/(128EI), θ₂ = 7wL³/(384EI)', v: 'v(L/2) = −5wL⁴/(768EI)' };
      if (q.kind === 'dist' && near(q.x1, 0) && near(q.x2, L) && (Math.abs(q.w1) < 1e-12 || Math.abs(q.w2) < 1e-12)) return { name: 'Triangular load', th1: 'θ₁ = −7w₀L³/(360EI), θ₂ = w₀L³/(45EI)', v: 'v_max = −0.00652w₀L⁴/EI' };
      return null;
    }
    if (q.kind === 'point' && near(q.x, L)) return { name: 'P at the free end', th1: 'θ_max = −PL²/(2EI)', v: 'v_max = −PL³/(3EI)' };
    if (q.kind === 'point' && near(q.x, L / 2)) return { name: 'P at midspan', th1: 'θ_max = −PL²/(8EI)', v: 'v_max = −5PL³/(48EI)' };
    if (q.kind === 'couple' && near(q.x, L)) return { name: 'Couple M₀ at the free end', th1: 'θ_max = M₀L/EI', v: 'v_max = M₀L²/(2EI)' };
    if (q.kind === 'dist' && near(q.w1, q.w2) && near(q.x1, 0) && near(q.x2, L)) return { name: 'Uniform w', th1: 'θ_max = −wL³/(6EI)', v: 'v_max = −wL⁴/(8EI)' };
    if (q.kind === 'dist' && near(q.w1, q.w2) && near(q.x1, 0) && near(q.x2, L / 2)) return { name: 'Uniform w on the half next to the wall', th1: 'θ_max = −wL³/(48EI)', v: 'v_max = −7wL⁴/(384EI)' };
    if (q.kind === 'dist' && near(q.x1, 0) && Math.abs(q.w2) < 1e-12) return { name: 'Triangular, w₀ at the wall', th1: 'θ = −w₀a³/(24EI) at the end of the load', v: 'v = −w₀a⁴/(30EI) at the end of the load' };
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Solve                                                              */
  /* ------------------------------------------------------------------ */
  function solve(st, U) {
    if (!FU[U.id].includes(st.fu)) st.fu = FU[U.id][0];
    const u = MD.units(U, st.fu), q = st.bm, err = [];
    u.EIv = `${u.F}·${u.L}³`; u.EIt = `${u.F}·${u.L}²`;
    const L = +q.L;
    if (!(L > 0)) err.push('Enter the length of the beam.');
    const sups = (q.sups || []).map((s) => ({ type: s.type, x: +s.x })).sort((a, b) => a.x - b.x);
    if (!sups.length) err.push('Add at least one support.');
    sups.forEach((s, i) => { s.label = LET[i]; if (!(s.x >= 0 && s.x <= L)) err.push(`Support ${s.label} must be on the beam (0 to ${fmt(L)} ${u.L}).`); if (i && Math.abs(s.x - sups[i - 1].x) < 1e-9) err.push('Two supports are at the same place.'); });
    const loads = (q.loads || []).map((l) => Object.assign({}, l, { x: +l.x, P: +l.P, M: +l.M, x1: +l.x1, x2: +l.x2, w1: +l.w1, w2: +l.w2 }));
    loads.forEach((l, i) => {
      const who = `Load ${i + 1}`;
      if (l.kind === 'dist') { if (!(l.x1 >= 0 && l.x2 > l.x1 && l.x2 <= L)) err.push(`${who}: the load must start and end on the beam.`); if (l.w1 * l.w2 < 0) err.push(`${who}: the intensity changes sign; enter it as two loads.`); }
      else if (!(l.x >= 0 && l.x <= L)) err.push(`${who}: it must act on the beam.`);
    });
    if (!loads.some((l) => (l.kind === 'point' && l.P) || (l.kind === 'couple' && l.M) || (l.kind === 'dist' && (l.w1 || l.w2)))) err.push('Add a load.');
    if (!(+st.at >= 0 && +st.at <= L)) err.push(`The point must be on the beam (0 to ${fmt(L)} ${u.L}).`);
    let EI = null, Iv = null, Wrow = null;
    if (st.ei === 'num') {
      if (!(st.E > 0)) err.push('Enter the modulus of elasticity E.');
      if (st.Isrc === 'W') { Wrow = BS.WT.find((w) => w.name === st.W) || BS.WT[0]; Iv = Wrow.Ix * BS.IN ** 4; }
      else { if (!(st.I > 0)) err.push('Enter the moment of inertia I.'); Iv = B(+st.I, u.I); }
    }
    if (err.length) return fail(err);
    const res = core(L, sups, loads);
    if (!res.ok) return fail(res.err);
    if (st.ei === 'num') EI = B(+st.E, u.MOD) * Iv; // N·m²
    const S = Steps(), out = [], warn = [];
    // conversion of EI·v (F·L³) and EI·θ (F·L²) to real values
    const toV = (eiv) => (EI ? (B(eiv, u.EIv) / EI) : eiv), toT = (eit) => (EI ? B(eit, u.EIt) / EI : eit);
    const vU = EI ? u.S : `${u.EIv}/EI`, tU = EI ? 'rad' : `${u.EIt}/EI`, vD = (eiv) => (EI ? D(toV(eiv), u.S) : eiv), tD = (eit) => toT(eit);
    if (EI) S.add({ t: 'Flexural rigidity', f: 'EI', s: Wrow ? `E = ${fmt(+st.E)} ${u.MOD}, I = ${fmt(D(Iv, u.I))} ${u.I} (${Wrow.name}, from the table)` : `E = ${fmt(+st.E)} ${u.MOD}, I = ${fmt(+st.I)} ${u.I}`, r: `EI = ${fmt(D(EI, u.EIt))} ${u.EIt}` });
    const det = res.degree;
    const cuts = sups.map((s) => s.x).concat(...loads.map((l) => (l.kind === 'dist' ? [l.x1, l.x2] : [l.x])));
    const rg = regions(L, res, cuts);
    const xP = +st.at, thP = res.th(xP), vP = res.v(xP);
    const vmax = extreme(res.v, L), tmax = extreme(res.th, L);
    const rx = (s) => res.unk.find((k) => k.s === s && k.kind === 'R').value, rm = (s) => { const k = res.unk.find((kk) => kk.s === s && kk.kind === 'M'); return k ? k.value : 0; };

    if (st.mode === 'indet') indetSteps(S, L, sups, loads, res, u, warn);
    else {
      const rows = sups.map((s) => [s.label, s.type, fmt(s.x), fmt(rx(s)), s.type === 'fixed' ? fmt(rm(s)) : '–']);
      S.add({ t: 'Support reactions', n: det > 0 ? `${res.unk.length} unknown reactions and 2 equations of equilibrium (vertical loads only): indeterminate to degree ${det}. The extra conditions v = 0 (and θ = 0 at a fixed support) give the rest, so the reactions come out together with the constants of integration below.` : 'From ΣF_y = 0 and ΣM = 0 (upward forces and counterclockwise moments positive).',
        table: { head: ['Support', 'Type', `x (${u.L})`, `R_y (${u.F})`, `M (${u.FL})`], rows } });
    }
    if (st.mode === 'super') superSteps(S, L, sups, loads, xP, u);
    else if (st.mode === 'curve') {
      S.add({ t: 'Moment function in each region', n: 'Section the beam in each region and sum moments of the part to the left of the cut (counterclockwise positive on the right-hand face).', f: 'M(x)',
        table: { head: ['Region', `x (${u.L})`, `M (${u.FL})`], rows: rg.map((r, i) => [String(i + 1), `${fmt(r.a)} to ${fmt(r.b)}`, pstr(r.Mp)]) } });
      S.add({ t: 'Integrate twice', f: 'EI d²v/dx² = M(x);  EI dv/dx = ∫M dx + C₁;  EI v = ∫∫M dx dx + C₁x + C₂ (new constants in each region)',
        table: { head: ['Region', `EI θ (${u.EIt})`, `EI v (${u.EIv})`], rows: rg.map((r, i) => [String(i + 1), pstr(r.Tp, [`C${2 * i + 1}`]), pstr(r.Vp, [`C${2 * i + 1}x`, `C${2 * i + 2}`])]) } });
      const bc = [];
      sups.forEach((s) => { bc.push(`v = 0 at x = ${fmt(s.x)} (${s.label})`); if (s.type === 'fixed') bc.push(`θ = 0 at x = ${fmt(s.x)} (${s.label})`); });
      for (let i = 0; i + 1 < rg.length; i++) bc.push(`θ and v continuous at x = ${fmt(rg[i].b)}`);
      S.add({ t: 'Boundary and continuity conditions', n: `${2 * rg.length} constants${det > 0 ? ` and ${det} extra reaction${det > 1 ? 's' : ''}` : ''} are fixed by these conditions${det > 0 ? ' together with equilibrium' : ''}.`, s: bc.join(';  ') });
      S.add({ t: 'Constants of integration', table: { head: ['Region', 'C (slope)', 'C (deflection)'], rows: rg.map((r, i) => [String(i + 1), `C${2 * i + 1} = ${fmt(Math.abs(r.c1) < 1e-12 ? 0 : r.c1)}`, `C${2 * i + 2} = ${fmt(Math.abs(r.c2) < 1e-12 ? 0 : r.c2)}`]) } });
    }
    const ri = rg.findIndex((r) => xP <= r.b + 1e-12);
    S.add({ t: `Slope and deflection at x = ${fmt(xP)} ${u.L}`, n: EI ? 'Divide by EI. v is positive upward; θ is positive counterclockwise.' : 'Left in terms of EI, as the book does when EI is not given. v is positive upward.',
      f: st.mode === 'curve' ? `Region ${ri + 1}: EI θ and EI v at x` : 'Sum of the parts', s: `EI θ = ${fmt(thP)} ${u.EIt};  EI v = ${fmt(vP)} ${u.EIv}`,
      r: EI ? `θ = ${fmt(toT(thP))} rad;  v = ${fmt(vD(vP))} ${u.S}` : `θ = ${fmt(thP)} ${u.EIt}/EI;  v = ${fmt(vP)} ${u.EIv}/EI` });
    S.add({ t: 'Largest deflection', n: 'It occurs where the slope is zero, or at a free end.', r: `v_max = ${fmt(vD(vmax.v))} ${vU} at x = ${fmt(vmax.x)} ${u.L}` });
    sups.forEach((s) => { out.push({ k: `Reaction at ${s.label}, ${s.label}_y`, v: rx(s), u: u.F }); if (s.type === 'fixed') out.push({ k: `Moment at ${s.label}, M_${s.label}`, v: rm(s), u: u.FL }); });
    out.push({ k: 'Slope at the point θ', v: tD(thP), u: tU, hl: true }, { k: 'Deflection at the point v', v: vD(vP), u: vU, hl: true });
    out.push({ k: 'Largest deflection v_max', v: vD(vmax.v), u: vU, hl: true }, { k: 'Where the deflection is largest, x', v: vmax.x, u: u.L }, { k: 'Largest slope (size) |θ|max', v: Math.abs(tD(tmax.v)), u: tU });
    const geo = { L, sups, loads, u, ei: !!EI, xP, vmax, res: { v: res.v, th: res.th, M: res.M, V: res.V }, toV: (x) => vD(res.v(x)), toT: (x) => tD(res.th(x)), vU, tU, rx: sups.map(rx), rm: sups.map(rm), det, cuts };
    return MD.result(`v_max = ${fmt(vD(vmax.v))} ${vU} at x = ${fmt(vmax.x)} ${u.L}`, 'ok', out, S, geo, warn);
  }

  /** Superposition: the deflection and slope from each load alone, then the sum. */
  function superSteps(S, L, sups, loads, xP, u) {
    const ss = sups.length === 2 && sups.every((s) => s.type !== 'fixed') && Math.abs(sups[0].x) < 1e-9 && Math.abs(sups[1].x - L) < 1e-9;
    const ct = sups.length === 1 && sups[0].type === 'fixed' && Math.abs(sups[0].x) < 1e-9;
    const rows = [];
    let sv = 0, sth = 0;
    loads.forEach((q, i) => {
      const r = core(L, sups, [q]); if (!r.ok) return;
      const v = r.v(xP), th = r.th(xP); sv += v; sth += th;
      const ap = ss ? appendixD('ss', L, q) : ct ? appendixD('cant', L, q) : null;
      const desc = q.kind === 'point' ? `${fmt(q.P)} ${u.F} at x = ${fmt(q.x)}` : q.kind === 'couple' ? `${fmt(q.M)} ${u.FL} ${q.dir === 'cw' ? 'clockwise' : 'counterclockwise'} at x = ${fmt(q.x)}` : `${fmt(q.w1)} to ${fmt(q.w2)} ${u.W} from ${fmt(q.x1)} to ${fmt(q.x2)}`;
      rows.push([`${i + 1}. ${desc}`, ap ? `${ap.name}: ${ap.v}` : 'its own elastic curve', fmt(th), fmt(v)]);
    });
    S.add({ t: 'Each load on its own', n: ss || ct ? 'Each load is a standard case of Appendix D where one applies; the slope and deflection at the point come from that case\'s elastic curve.' : 'This beam is not one of the standard cases, so each load\'s elastic curve is found on its own.',
      table: { head: ['Load', 'Case', `EI θ (${u.EIt})`, `EI v (${u.EIv})`], rows } });
    S.add({ t: 'Add the parts (superposition)', f: 'θ = Σθ_i, v = Σv_i', r: `EI θ = ${fmt(sth)} ${u.EIt};  EI v = ${fmt(sv)} ${u.EIv}` });
  }

  /** Indeterminate beams: redundants removed, compatibility, then the remaining reactions. */
  function indetSteps(S, L, sups, loads, res, u, warn) {
    if (res.degree <= 0) { warn.push('This beam is statically determinate, so there are no redundants; the reactions follow from equilibrium alone.'); S.add({ t: 'Support reactions', n: 'Statically determinate.', table: { head: ['Support', `R_y (${u.F})`], rows: res.unk.filter((k) => k.kind === 'R').map((k) => [k.s.label, fmt(k.value)]) } }); return; }
    // primary structure: keep the first fixed support (a cantilever), or the two outer supports
    const fx = sups.find((s) => s.type === 'fixed'), keep = fx ? [fx] : [sups[0], sups[sups.length - 1]];
    const red = res.unk.filter((k) => !(keep.includes(k.s) && (fx ? true : k.kind === 'R')));
    const prim = keep.map((s) => ({ type: fx ? 'fixed' : (s === sups[0] ? 'pin' : 'roller'), x: s.x, label: s.label }));
    const name = (k) => (k.kind === 'R' ? `${k.s.label}_y` : `M_${k.s.label}`);
    const what = (k) => (k.kind === 'R' ? `v_${k.s.label}` : `θ_${k.s.label}`);
    S.add({ t: 'Degree of indeterminacy', n: `${res.unk.length} unknown reactions, 2 equations of equilibrium for vertical loads, so ${res.degree} redundant${res.degree > 1 ? 's' : ''}.`, r: `Redundant${res.degree > 1 ? 's' : ''}: ${red.map(name).join(', ')}` });
    S.add({ t: 'Primary structure', n: fx ? `Remove the redundants, leaving a cantilever fixed at ${fx.label}.` : `Remove the redundants, leaving a simply supported beam on ${keep.map((s) => s.label).join(' and ')}.` });
    const at = (r, k) => (k.kind === 'R' ? r.v(k.s.x) : r.th(k.s.x));
    const r0 = core(L, prim, loads);
    const d0 = red.map((k) => at(r0, k));
    const f = red.map((k) => red.map((j) => { const unit = j.kind === 'R' ? [{ kind: 'point', x: j.s.x, P: -1 }] : [{ kind: 'couple', x: j.s.x, M: -1, dir: 'cw' }]; const r = core(L, prim, unit); return at(r, k); }));
    S.add({ t: 'Displacements of the primary structure', n: 'From the loads, and from a unit value of each redundant (upward force, counterclockwise couple), using the elastic curves of the standard cases. Values are EI times the displacement.',
      table: { head: ['At', 'From the loads'].concat(red.map((k) => `From ${name(k)} = 1`)), rows: red.map((k, i) => [what(k), fmt(d0[i])].concat(f[i].map((v) => fmt(v)))) } });
    S.add({ t: 'Compatibility', n: 'The redundant supports do not move: the displacements from the loads and from the redundants add to zero.', s: red.map((k, i) => `${fmt(d0[i])} ${f[i].map((v, j) => `${v >= 0 ? '+' : '−'} ${fmt(Math.abs(v))} ${name(red[j])}`).join(' ')} = 0`).join(';   ') });
    const sol = linSolve(f, d0.map((v) => -v));
    S.add({ t: 'Solve for the redundants', r: red.map((k, i) => `${name(k)} = ${fmt(sol.x ? sol.x[i] : NaN)} ${k.kind === 'R' ? u.F : u.FL}`).join(',  ') });
    const rest = res.unk.filter((k) => !red.includes(k));
    S.add({ t: 'Remaining reactions from equilibrium', f: '+↑ ΣF_y = 0, ↺+ ΣM = 0', r: rest.map((k) => `${name(k)} = ${fmt(k.value)} ${k.kind === 'R' ? u.F : u.FL}`).join(',  ') });
  }

  const Deflect = { defaults, solve, convertState, core, regions, appendixD, FU };
  root.Deflect = Deflect;
  if (typeof module !== 'undefined' && module.exports) module.exports = Deflect;
})(typeof window !== 'undefined' ? window : globalThis);
