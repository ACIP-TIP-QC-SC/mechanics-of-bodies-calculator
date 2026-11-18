/* =====================================================================
 * DYNAMICS · D1 Rectilinear Kinematics (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Sections 12.2 and 12.3.
 *   v = ds/dt, a = dv/dt, a ds = v dv                          (12–1 to 12–3)
 *   constant a_c: v = v₀ + a_c t, s = s₀ + v₀t + ½a_c t², v² = v₀² + 2a_c(s − s₀)   (12–4 to 12–6)
 * Modes
 *   const  constant acceleration (or free fall), find the instant a time, position or velocity is reached
 *   two    two particles with constant accelerations on the same line: when and where they meet
 *   func   s(t), v(t) or a(t) given as a polynomial in t
 *   av     a = f(v): a = −kv, −kv², −kv³ or a₀ − kv
 *   as     a = f(s) as a polynomial in s, from a starting point to a target position
 *   graph  erratic motion from a v–t graph (straight pieces) or an a–t graph (constant pieces)
 *   dep    dependent motion of blocks joined by cords over pulleys (12.9): each cord gives Σ cᵢ sᵢ = l,
 *          so Σ cᵢ Δsᵢ = 0, Σ cᵢ vᵢ = 0 and Σ cᵢ aᵢ = 0
 * Every mode reports s, v and a at the instant, the displacement, the distance travelled and the
 * average velocity and speed over the motion, and gives the app a sampler for the s–t, v–t, a–t graphs.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps, polyStr, linSolve } = Core;
  const { peval, pder, pint, quad, rootsOf, rk4 } = DY;

  function defaults() {
    return {
      mode: 'const',
      s0: 0, v0: 10, ac: 2, grav: false, find: 't', at: 5,
      A: { s0: 0, v0: 0, a: 2 }, B: { s0: 100, v0: -5, a: 0 },
      given: 'v', c: [0, 2, 3, 0, 0], t: 3,
      form: 'kv3', k: 0.4, a0: 9.81,
      cs: [0, 4, 0], sT: 0.2,
      dep: { bodies: [{ name: 'A', given: 'yes', v: 2, a: 0, ds: 0 }, { name: 'B', given: 'no', v: 0, a: 0, ds: 0 }, { name: 'C', given: 'no', v: 0, a: 0, ds: 0 }],
        cords: [{ cA: 1, cB: 2, cC: -2, cD: 0, cE: 0 }, { cA: 0, cB: 1, cC: 1, cD: 0, cE: 0 }], tgt: false, tB: 'B', tv: 10 },
      gtype: 'vt', pts: [{ t: 0, v: 0 }, { t: 10, v: 20 }, { t: 30, v: 20 }], segs: [{ t: 10, a: 10 }, { t: 60, a: -2 }],
    };
  }
  /* Units of the polynomial coefficients: every power of t carries the length unit once; for a(s) the
   * coefficient of sⁱ carries length to the power 1 − i; for a = −kvⁿ, k carries length to the power 1 − n. */
  function convertState(st, from, to) {
    if (from === to) return st;
    const fL = DY.factor('L', from, to), t = (v, f) => Core.tidy(v * f, 6);
    DY.convertObj(st, { s0: 'L', v0: 'V', ac: 'A', a0: 'A' }, from, to);
    if (st.find === 's') st.at = t(st.at, fL); if (st.find === 'v') st.at = t(st.at, fL);
    ['A', 'B'].forEach((k) => DY.convertObj(st[k], { s0: 'L', v0: 'V', a: 'A' }, from, to));
    st.c = st.c.map((v) => t(v, fL));
    st.cs = st.cs.map((v, i) => t(v, Math.pow(fL, 1 - i)));
    st.sT = t(st.sT, fL);
    const n = { kv: 1, kv2: 2, kv3: 3, lin: 1 }[st.form] || 1;
    st.k = t(st.k, Math.pow(fL, 1 - n));
    st.pts.forEach((p) => (p.v = t(p.v, fL)));
    st.segs.forEach((p) => (p.a = t(p.a, fL)));
    if (st.dep) { st.dep.bodies.forEach((b) => DY.convertObj(b, { v: 'V', a: 'A', ds: 'L' }, from, to)); st.dep.tv = t(st.dep.tv, fL); }
    return st;
  }

  /* ------------------------------------------------------------------ */
  /* Motion summary from a sampler                                      */
  /* ------------------------------------------------------------------ */
  /** Distance travelled on [t0, t1]: add up |Δs| between the instants where v = 0. */
  function travel(M, t0, t1) {
    const stops = t1 > t0 ? rootsOf((t) => M.v(t), t0, t1, 600).filter((x) => x > t0 + 1e-9 * (t1 - t0) && x < t1 - 1e-9 * (t1 - t0)) : [];
    const pts = [t0].concat(stops, [t1]);
    let d = 0; for (let i = 1; i < pts.length; i++) d += Math.abs(M.s(pts[i]) - M.s(pts[i - 1]));
    return { d, stops };
  }
  function summary(S, out, M, t0, t1, u) {
    const ds = M.s(t1) - M.s(t0), tr = travel(M, t0, t1), T = t1 - t0;
    if (tr.stops.length) S.add({ t: 'Where the particle stops and turns', n: 'The distance travelled is found piece by piece between the instants where v = 0, since the particle reverses there.', table: { head: ['t (s)', `s (${u.L})`], rows: tr.stops.map((x) => [fmt(x), fmt(M.s(x))]) } });
    S.add({ t: 'Displacement and distance travelled', f: 'Δs = s₂ − s₁;  s_T = Σ|Δs| between reversals',
      s: `Δs = ${fmt(M.s(t1))} − (${fmt(M.s(t0))}) = ${fmt(ds)} ${u.L}`, r: `Δs = ${fmt(ds)} ${u.L}, distance s_T = ${fmt(tr.d)} ${u.L}` });
    if (T > 0) S.add({ t: 'Average velocity and average speed', f: 'v_avg = Δs/Δt;  (v_sp)_avg = s_T/Δt',
      s: `v_avg = ${fmt(ds)}/${fmt(T)};  (v_sp)_avg = ${fmt(tr.d)}/${fmt(T)}`, r: `v_avg = ${fmt(ds / T)} ${u.V}, (v_sp)_avg = ${fmt(tr.d / T)} ${u.V}` });
    out.push({ k: 'Displacement Δs', v: ds, u: u.L }, { k: 'Distance travelled s_T', v: tr.d, u: u.L });
    if (T > 0) out.push({ k: 'Average velocity v_avg', v: ds / T, u: u.V }, { k: 'Average speed (v_sp)_avg', v: tr.d / T, u: u.V });
    return tr;
  }
  const atOut = (out, M, t, u, hl) => out.push({ k: 'Position s', v: M.s(t), u: u.L, hl }, { k: 'Velocity v', v: M.v(t), u: u.V, hl }, { k: 'Acceleration a', v: M.a(t), u: u.A, hl });

  /* ------------------------------------------------------------------ */
  function solve(st, U) {
    const u = DY.units(U), m = st.mode;
    if (m === 'two') return two(st, u);
    if (m === 'func') return func(st, u);
    if (m === 'av') return av(st, u);
    if (m === 'as') return as(st, u);
    if (m === 'graph') return graph(st, u);
    if (m === 'dep') return dep(st.dep, u);
    return cst(st, u);
  }
  const R = DY.result;

  /* Constant acceleration --------------------------------------------- */
  function cst(st, u) {
    const s0 = +st.s0, v0 = +st.v0, a = st.grav ? -u.g : +st.ac, x = +st.at;
    if (![s0, v0, a, x].every(isFinite)) return fail('Enter s₀, v₀, a_c and the value to find.');
    const S = Steps(), out = [], M = { s: (t) => s0 + v0 * t + 0.5 * a * t * t, v: (t) => v0 + a * t, a: () => a };
    S.add({ t: 'Coordinate system', n: st.grav ? 'Free fall: s is measured upward from the origin, so a_c = −g (air resistance neglected).' : 'The position coordinate s is measured from the fixed origin O, positive to the right (or up). The acceleration is constant.',
      r: `s₀ = ${fmt(s0)} ${u.L}, v₀ = ${fmt(v0)} ${u.V}, a_c = ${fmt(a)} ${u.A}` });
    let t;
    if (st.find === 't') {
      if (!(x >= 0)) return fail('The time must be zero or more.');
      t = x;
      S.add({ t: 'Velocity at the instant', f: 'v = v₀ + a_c t', s: `v = ${fmt(v0)} + (${fmt(a)})(${fmt(t)})`, r: `v = ${fmt(M.v(t))} ${u.V}` });
      S.add({ t: 'Position at the instant', f: 's = s₀ + v₀t + ½a_c t²', s: `s = ${fmt(s0)} + (${fmt(v0)})(${fmt(t)}) + ½(${fmt(a)})(${fmt(t)})²`, r: `s = ${fmt(M.s(t))} ${u.L}` });
    } else if (st.find === 's') {
      const ts = quad(0.5 * a, v0, s0 - x).filter((r) => r > 1e-12);
      if (!ts.length) return fail(`The particle never reaches s = ${fmt(x)} ${u.L} (going forward in time).`);
      t = ts[0];
      const v2 = v0 * v0 + 2 * a * (x - s0);
      S.add({ t: 'Velocity at the position', f: 'v² = v₀² + 2a_c(s − s₀)', s: `v² = (${fmt(v0)})² + 2(${fmt(a)})(${fmt(x)} − ${fmt(s0)}) = ${fmt(v2)}`, r: `|v| = ${fmt(Math.sqrt(Math.max(0, v2)))} ${u.V}; it moves ${M.v(t) >= 0 ? 'in the +s direction' : 'in the −s direction'}, v = ${fmt(M.v(t))} ${u.V}` });
      S.add({ t: 'Time to reach the position', f: 's = s₀ + v₀t + ½a_c t²', s: `${fmt(x)} = ${fmt(s0)} + ${fmt(v0)}t + ½(${fmt(a)})t²`, r: `t = ${ts.map(fmt).join(' s or ')} s; the first is ${fmt(t)} s` });
    } else {
      if (Math.abs(a) < 1e-14) return fail('With a_c = 0 the velocity never changes.');
      t = (x - v0) / a;
      if (!(t >= 0)) return fail(`The velocity ${fmt(x)} ${u.V} was reached before t = 0, not after.`);
      S.add({ t: 'Time to reach the velocity', f: 'v = v₀ + a_c t', s: `${fmt(x)} = ${fmt(v0)} + (${fmt(a)})t`, r: `t = ${fmt(t)} s` });
      S.add({ t: 'Position at that instant', f: 'v² = v₀² + 2a_c(s − s₀)', s: `(${fmt(x)})² = (${fmt(v0)})² + 2(${fmt(a)})(s − ${fmt(s0)})`, r: `s = ${fmt(M.s(t))} ${u.L}` });
    }
    out.push({ k: 'Time t', v: t, u: 's', hl: true });
    atOut(out, M, t, u, true);
    // turning point
    const tTurn = Math.abs(a) > 1e-14 ? -v0 / a : NaN;
    if (tTurn > 0) {
      S.add({ t: 'Turning point (v = 0)', n: 'Where the velocity is zero the particle is at its farthest point before it comes back.', f: 'v = v₀ + a_c t = 0;  s = s₀ + v₀t + ½a_c t²', s: `t = −(${fmt(v0)})/(${fmt(a)}) = ${fmt(tTurn)} s`, r: `s_turn = ${fmt(M.s(tTurn))} ${u.L}` });
      out.push({ k: 'Turning point (v = 0) at t', v: tTurn, u: 's' }, { k: 'Turning point position', v: M.s(tTurn), u: u.L });
    }
    const T = Math.max(t, 1e-9);
    summary(S, out, M, 0, T, u);
    return R(`t = ${fmt(t)} s: s = ${fmt(M.s(t))} ${u.L}, v = ${fmt(M.v(t))} ${u.V}`, 'ok', out, S, { mode: 'const', u, M, span: [0, T], t, marks: tTurn > 0 && tTurn < T ? [tTurn] : [] });
  }

  /* Two particles ----------------------------------------------------- */
  function two(st, u) {
    const A = st.A, B = st.B;
    if (![A.s0, A.v0, A.a, B.s0, B.v0, B.a].every((x) => isFinite(+x))) return fail('Enter s₀, v₀ and a for both particles.');
    const S = Steps(), out = [];
    const MA = { s: (t) => A.s0 + A.v0 * t + 0.5 * A.a * t * t, v: (t) => A.v0 + A.a * t, a: () => A.a };
    const MB = { s: (t) => B.s0 + B.v0 * t + 0.5 * B.a * t * t, v: (t) => B.v0 + B.a * t, a: () => B.a };
    S.add({ t: 'Coordinate system', n: 'Both particles move on the same line; s is measured from the same origin O, positive to the right.', table: { head: ['', `s₀ (${u.L})`, `v₀ (${u.V})`, `a (${u.A})`], rows: [['A', fmt(A.s0), fmt(A.v0), fmt(A.a)], ['B', fmt(B.s0), fmt(B.v0), fmt(B.a)]] } });
    S.add({ t: 'Position of each particle', f: 's = s₀ + v₀t + ½at²', s: `s_A = ${polyStr([A.s0, A.v0, A.a / 2], 't')};  s_B = ${polyStr([B.s0, B.v0, B.a / 2], 't')}` });
    const ts = quad(0.5 * (A.a - B.a), A.v0 - B.v0, A.s0 - B.s0).filter((x) => x > 1e-12);
    S.add({ t: 'They are at the same place when s_A = s_B', f: '(s₀A − s₀B) + (v₀A − v₀B)t + ½(a_A − a_B)t² = 0', s: `${fmt(A.s0 - B.s0)} + (${fmt(A.v0 - B.v0)})t + ${fmt(0.5 * (A.a - B.a))}t² = 0`,
      r: ts.length ? `t = ${ts.map(fmt).join(' s and ')} s` : 'No positive root: they never meet after t = 0.' });
    if (!ts.length) {
      const tc = Math.abs(A.a - B.a) > 1e-14 ? -(A.v0 - B.v0) / (A.a - B.a) : NaN, gapAt = (t) => Math.abs(MA.s(t) - MB.s(t));
      const tmin = tc > 0 ? tc : 0;
      S.add({ t: 'Closest approach', f: 'd/dt(s_A − s_B) = v_A − v_B = 0', r: `at t = ${fmt(tmin)} s the gap is ${fmt(gapAt(tmin))} ${u.L}` });
      out.push({ k: 'They meet', v: 'No', u: '' }, { k: 'Closest approach at t', v: tmin, u: 's', hl: true }, { k: 'Smallest gap', v: gapAt(tmin), u: u.L, hl: true });
      const T = Math.max(tmin * 2, 5);
      return R(`They never meet; the smallest gap is ${fmt(gapAt(tmin))} ${u.L} at t = ${fmt(tmin)} s`, 'warn', out, S, { mode: 'two', u, MA, MB, M: MA, span: [0, T], t: tmin, meets: [] });
    }
    const t = ts[0];
    S.add({ t: 'Where they meet', f: 's = s₀ + v₀t + ½at²', s: `s_A(${fmt(t)}) = ${fmt(MA.s(t))} ${u.L}`, r: `v_A = ${fmt(MA.v(t))} ${u.V}, v_B = ${fmt(MB.v(t))} ${u.V}, relative speed ${fmt(Math.abs(MA.v(t) - MB.v(t)))} ${u.V}` });
    out.push({ k: 'They meet', v: 'Yes', u: '' }, { k: 'Time they meet t', v: t, u: 's', hl: true }, { k: 'Position where they meet', v: MA.s(t), u: u.L, hl: true },
      { k: 'Velocity of A then', v: MA.v(t), u: u.V }, { k: 'Velocity of B then', v: MB.v(t), u: u.V });
    if (ts.length > 1) out.push({ k: 'They pass again at t', v: ts[1], u: 's' });
    const T = (ts.length > 1 ? ts[1] : t) * 1.15;
    S.add({ t: 'Distance each one travels until they meet', r: `A: ${fmt(travel(MA, 0, t).d)} ${u.L}, B: ${fmt(travel(MB, 0, t).d)} ${u.L}` });
    out.push({ k: 'Distance travelled by A', v: travel(MA, 0, t).d, u: u.L }, { k: 'Distance travelled by B', v: travel(MB, 0, t).d, u: u.L });
    return R(`They meet at t = ${fmt(t)} s, s = ${fmt(MA.s(t))} ${u.L}`, 'ok', out, S, { mode: 'two', u, MA, MB, M: MA, span: [0, T], t, meets: ts });
  }

  /* Polynomial in time ----------------------------------------------- */
  function func(st, u) {
    const c = st.c.map(Number), t = +st.t, s0 = +st.s0, v0 = +st.v0;
    if (!c.every(isFinite) || !isFinite(t)) return fail('Enter the coefficients and the time.');
    if (!(t > 0)) return fail('The time must be more than zero.');
    let cs, cv, ca;
    const S = Steps(), out = [];
    const T = (x) => polyStr(x, 't');
    if (st.given === 's') { cs = c; cv = pder(cs); ca = pder(cv); S.add({ t: 'Position given', f: 's = f(t)', r: `s = ${T(cs)} ${u.L}` }); S.add({ t: 'Velocity', f: 'v = ds/dt', r: `v = ${T(cv)} ${u.V}` }); S.add({ t: 'Acceleration', f: 'a = dv/dt', r: `a = ${T(ca)} ${u.A}` }); }
    else if (st.given === 'v') { cv = c; ca = pder(cv); cs = pint(cv, s0); S.add({ t: 'Velocity given', f: 'v = f(t)', r: `v = ${T(cv)} ${u.V}` }); S.add({ t: 'Position', n: `ds = v dt, integrated from s = s₀ = ${fmt(s0)} ${u.L} at t = 0.`, f: '∫ds = ∫v dt', r: `s = ${T(cs)} ${u.L}` }); S.add({ t: 'Acceleration', f: 'a = dv/dt', r: `a = ${T(ca)} ${u.A}` }); }
    else { ca = c; cv = pint(ca, v0); cs = pint(cv, s0); S.add({ t: 'Acceleration given', f: 'a = f(t)', r: `a = ${T(ca)} ${u.A}` }); S.add({ t: 'Velocity', n: `dv = a dt, from v = v₀ = ${fmt(v0)} ${u.V} at t = 0.`, f: '∫dv = ∫a dt', r: `v = ${T(cv)} ${u.V}` }); S.add({ t: 'Position', n: `ds = v dt, from s = s₀ = ${fmt(s0)} ${u.L} at t = 0.`, f: '∫ds = ∫v dt', r: `s = ${T(cs)} ${u.L}` }); }
    const M = { s: (x) => peval(cs, x), v: (x) => peval(cv, x), a: (x) => (ca.length ? peval(ca, x) : 0) };
    S.add({ t: `At t = ${fmt(t)} s`, s: `s = ${fmt(M.s(t))} ${u.L}, v = ${fmt(M.v(t))} ${u.V}, a = ${fmt(M.a(t))} ${u.A}` });
    atOut(out, M, t, u, true);
    const tr = summary(S, out, M, 0, t, u);
    return R(`At t = ${fmt(t)} s: s = ${fmt(M.s(t))} ${u.L}, v = ${fmt(M.v(t))} ${u.V}, a = ${fmt(M.a(t))} ${u.A}`, 'ok', out, S, { mode: 'func', u, M, span: [0, t], t, marks: tr.stops });
  }

  /* a = f(v) ------------------------------------------------------------ */
  function av(st, u) {
    const k = +st.k, v0 = +st.v0, s0 = +st.s0, t = +st.t, a0 = +st.a0, f = st.form;
    if (![k, v0, s0, t].every(isFinite) || (f === 'lin' && !isFinite(a0))) return fail('Enter k, v₀, s₀ and the time.');
    if (!(t > 0)) return fail('The time must be more than zero.');
    if (!(k > 0)) return fail('k must be more than zero.');
    if (f !== 'lin' && f !== 'kv2' && !(v0 !== 0)) return fail('Give the particle a starting velocity v₀.');
    if (f === 'kv2' && !(v0 > 0)) return fail('For a = −kv² the starting velocity must be positive (the drag acts against it).');
    if (f === 'kv3' && !(v0 > 0)) return fail('For a = −kv³ the starting velocity must be positive.');
    const S = Steps(), out = [];
    let vF, sF, aF, txtA;
    S.add({ t: 'Coordinate system', n: 'The acceleration depends on the velocity, so v(t) is found from dt = dv/a and then s(t) from ds = v dt. The positive direction is the direction of v₀.' });
    if (f === 'kv') {
      txtA = `a = −${fmt(k)}v`; vF = (x) => v0 * Math.exp(-k * x); sF = (x) => s0 + (v0 / k) * (1 - Math.exp(-k * x)); aF = (x) => -k * vF(x);
      S.add({ t: 'Velocity', f: '∫dv/(−kv) = ∫dt  ⇒  v = v₀e^(−kt)', s: `v = ${fmt(v0)}e^(−${fmt(k)}t)` });
      S.add({ t: 'Position', f: 's = s₀ + (v₀/k)(1 − e^(−kt))', s: `s = ${fmt(s0)} + (${fmt(v0)}/${fmt(k)})(1 − e^(−${fmt(k)}t))` });
    } else if (f === 'kv2') {
      txtA = `a = −${fmt(k)}v²`; vF = (x) => v0 / (1 + k * v0 * x); sF = (x) => s0 + Math.log(1 + k * v0 * x) / k; aF = (x) => -k * vF(x) ** 2;
      S.add({ t: 'Velocity', f: '∫dv/(−kv²) = ∫dt  ⇒  1/v − 1/v₀ = kt', s: `v = ${fmt(v0)}/(1 + ${fmt(k * v0)}t)` });
      S.add({ t: 'Position', f: 's = s₀ + (1/k) ln(1 + kv₀t)', s: `s = ${fmt(s0)} + (1/${fmt(k)}) ln(1 + ${fmt(k * v0)}t)` });
    } else if (f === 'kv3') {
      txtA = `a = −${fmt(k)}v³`; const q = (x) => 1 / (v0 * v0) + 2 * k * x; vF = (x) => 1 / Math.sqrt(q(x)); sF = (x) => s0 + (Math.sqrt(q(x)) - 1 / v0) / k; aF = (x) => -k * vF(x) ** 3;
      S.add({ t: 'Velocity', f: '∫dv/(−kv³) = ∫dt  ⇒  1/v² − 1/v₀² = 2kt', s: `v = [1/(${fmt(v0)})² + 2(${fmt(k)})t]^(−1/2)` });
      S.add({ t: 'Position', f: 'ds = v dt  ⇒  s = s₀ + (1/k)[(1/v₀² + 2kt)^(1/2) − 1/v₀]', s: `s = ${fmt(s0)} + (1/${fmt(k)})[(1/(${fmt(v0)})² + 2(${fmt(k)})t)^(1/2) − 1/${fmt(v0)}]` });
    } else {
      txtA = `a = ${fmt(a0)} − ${fmt(k)}v`; const vt = a0 / k; vF = (x) => vt + (v0 - vt) * Math.exp(-k * x); sF = (x) => s0 + vt * x + ((v0 - vt) / k) * (1 - Math.exp(-k * x)); aF = (x) => a0 - k * vF(x);
      S.add({ t: 'Velocity', n: `The velocity tends to the terminal value a₀/k = ${fmt(vt)} ${u.V}, where a = 0.`, f: '∫dv/(a₀ − kv) = ∫dt  ⇒  v = a₀/k + (v₀ − a₀/k)e^(−kt)', s: `v = ${fmt(vt)} + (${fmt(v0 - vt)})e^(−${fmt(k)}t)` });
      S.add({ t: 'Position', f: 's = s₀ + (a₀/k)t + ((v₀ − a₀/k)/k)(1 − e^(−kt))' });
      out.push({ k: 'Terminal velocity a₀/k', v: vt, u: u.V });
    }
    S.list.splice(1, 0, { t: 'Acceleration given', r: txtA + ` (${u.A})` });
    const M = { s: sF, v: vF, a: aF };
    S.add({ t: `At t = ${fmt(t)} s`, s: `v = ${fmt(vF(t))} ${u.V}, s = ${fmt(sF(t))} ${u.L}, a = ${fmt(aF(t))} ${u.A}` });
    atOut(out, M, t, u, true);
    summary(S, out, M, 0, t, u);
    return R(`At t = ${fmt(t)} s: v = ${fmt(vF(t))} ${u.V}, s = ${fmt(sF(t))} ${u.L}`, 'ok', out, S, { mode: 'av', u, M, span: [0, t], t, marks: [] });
  }

  /* a = f(s) ------------------------------------------------------------ */
  function as(st, u) {
    const c = st.cs.map(Number), s0 = +st.s0, v0 = +st.v0, sT = +st.sT;
    if (!c.every(isFinite) || ![s0, v0, sT].every(isFinite)) return fail('Enter the coefficients of a(s), s₀, v₀ and the target position.');
    if (Math.abs(sT - s0) < 1e-12) return fail('The target position must differ from the starting position.');
    const S = Steps(), out = [], P = pint(c, 0), aS = (x) => peval(c, x);
    const v2 = (x) => v0 * v0 + 2 * (peval(P, x) - peval(P, s0));
    S.add({ t: 'Acceleration given as a function of position', r: `a = ${polyStr(c, 's')} (${u.A})` });
    S.add({ t: 'Velocity as a function of position', n: `Since a = f(s), use v dv = a ds from v = v₀ = ${fmt(v0)} ${u.V} at s = s₀ = ${fmt(s0)} ${u.L}.`, f: '∫v dv = ∫a ds  ⇒  v² = v₀² + 2∫a ds',
      s: `v² = (${fmt(v0)})² + 2[${polyStr(P, 's')}] from ${fmt(s0)} to s` });
    const dir = Math.sign(sT - s0);
    // the particle must be able to get there: v² > 0 all the way and it must start toward the target (or be pushed that way)
    const startOk = v0 * dir > 0 || (Math.abs(v0) < 1e-12 && aS(s0) * dir > 0);
    if (!startOk) return fail(`The particle starts moving away from s = ${fmt(sT)} ${u.L}; give v₀ (or a at s₀) the direction toward the target.`);
    const n = 400; let stopAt = null;
    for (let i = 1; i <= n; i++) { const x = s0 + ((sT - s0) * i) / n; if (v2(x) < -1e-12 * Math.max(1, v0 * v0)) { stopAt = Core.bisect((y) => v2(y), s0 + ((sT - s0) * (i - 1)) / n, x, 80); break; } }
    if (stopAt !== null) return fail(`The particle stops at s = ${fmt(stopAt)} ${u.L} and turns back before it reaches s = ${fmt(sT)} ${u.L}.`);
    const vT = dir * Math.sqrt(Math.max(0, v2(sT)));
    S.add({ t: `Velocity at s = ${fmt(sT)} ${u.L}`, s: `v² = ${fmt(v2(sT))}`, r: `v = ${fmt(vT)} ${u.V}` });
    // time: integrate s'' = a(s) in time until s reaches the target
    const scale = Math.abs(sT - s0), vs = Math.max(Math.abs(v0), Math.sqrt(Math.abs(aS(s0)) * scale), Math.abs(vT), 1e-9);
    let Tg = (scale / vs) * 4, smp = null, tHit = NaN;
    for (let tries = 0; tries < 6 && !isFinite(tHit); tries++, Tg *= 4) {
      smp = rk4((t, x) => aS(x), 0, s0, v0, Tg, 8000, (q) => (q.x - sT) * dir >= 0);
      const L = smp[smp.length - 1];
      if ((L.x - sT) * dir >= 0) { const p = smp[smp.length - 2], f = (sT - p.x) / (L.x - p.x || 1); tHit = p.t + f * (L.t - p.t); }
    }
    if (!isFinite(tHit)) return fail('The time to reach the target could not be found.');
    smp = rk4((t, x) => aS(x), 0, s0, v0, tHit, 4000);
    S.add({ t: 'Time to reach the target', n: 'v = ds/dt, so t = ∫ds/v from s₀ to the target; the integral is evaluated numerically.', f: 't = ∫ ds / v(s)', r: `t = ${fmt(tHit)} s` });
    const M = sampler(smp, aS);
    out.push({ k: 'Velocity at the target v', v: vT, u: u.V, hl: true }, { k: 'Time to reach the target t', v: tHit, u: 's', hl: true }, { k: 'Acceleration at the target a', v: aS(sT), u: u.A });
    summary(S, out, M, 0, tHit, u);
    return R(`At s = ${fmt(sT)} ${u.L}: v = ${fmt(vT)} ${u.V}, reached at t = ${fmt(tHit)} s`, 'ok', out, S, { mode: 'as', u, M, span: [0, tHit], t: tHit, marks: [] });
  }
  /** Linear interpolation in Runge-Kutta samples. */
  function sampler(smp, aS) {
    const T0 = smp[0].t, T1 = smp[smp.length - 1].t, n = smp.length - 1;
    const pick = (t, k) => { const f = Math.min(n, Math.max(0, ((t - T0) / (T1 - T0 || 1)) * n)), i = Math.min(n - 1, Math.floor(f)), r = f - i; return smp[i][k] + (smp[i + 1][k] - smp[i][k]) * r; };
    return { s: (t) => pick(t, 'x'), v: (t) => pick(t, 'v'), a: (t) => aS(pick(t, 'x')) };
  }

  /* Erratic motion ------------------------------------------------------ */
  function graph(st, u) {
    const S = Steps(), out = [], s0 = +st.s0, t = +st.t;
    if (!isFinite(s0)) return fail('Enter s₀.');
    let pieces; // [{t0, t1, s0, v0, a}] with v = v0 + a (τ), s = s0 + v0 τ + ½ a τ²
    if (st.gtype === 'vt') {
      const p = st.pts.map((q) => ({ t: +q.t, v: +q.v }));
      if (p.length < 2) return fail('The v–t graph needs at least two points.');
      if (!p.every((q) => isFinite(q.t) && isFinite(q.v))) return fail('Enter t and v for every point.');
      if (Math.abs(p[0].t) > 1e-12) return fail('The first point of the graph must be at t = 0.');
      for (let i = 1; i < p.length; i++) if (!(p[i].t > p[i - 1].t)) return fail('The times of the points must increase.');
      pieces = []; let s = s0;
      for (let i = 1; i < p.length; i++) { const a = (p[i].v - p[i - 1].v) / (p[i].t - p[i - 1].t); pieces.push({ t0: p[i - 1].t, t1: p[i].t, s0: s, v0: p[i - 1].v, a }); const d = p[i].t - p[i - 1].t; s += p[i - 1].v * d + 0.5 * a * d * d; }
      S.add({ t: 'v–t graph', n: 'The graph is made of straight lines. Their slopes give the a–t graph (a = dv/dt), and the areas under them give the change in position (Δs = ∫v dt).',
        table: { head: ['Piece', 't (s)', `v (${u.V})`, `a = slope (${u.A})`, `Δs = area (${u.L})`, `s at end (${u.L})`], rows: pieces.map((q, i) => { const d = q.t1 - q.t0, ds = q.v0 * d + 0.5 * q.a * d * d; return [String(i + 1), `${fmt(q.t0)} to ${fmt(q.t1)}`, `${fmt(q.v0)} to ${fmt(q.v0 + q.a * d)}`, fmt(q.a), fmt(ds), fmt(q.s0 + ds)]; }) } });
    } else {
      const g = st.segs.map((q) => ({ t: +q.t, a: +q.a })), v0 = +st.v0;
      if (!g.length) return fail('The a–t graph needs at least one piece.');
      if (!g.every((q) => isFinite(q.t) && isFinite(q.a)) || !isFinite(v0)) return fail('Enter the end time and a for every piece, and v₀.');
      for (let i = 0; i < g.length; i++) if (!(g[i].t > (i ? g[i - 1].t : 0))) return fail('The end times of the pieces must increase from t = 0.');
      pieces = []; let s = s0, v = v0, ta = 0;
      g.forEach((q) => { const d = q.t - ta; pieces.push({ t0: ta, t1: q.t, s0: s, v0: v, a: q.a }); s += v * d + 0.5 * q.a * d * d; v += q.a * d; ta = q.t; });
      S.add({ t: 'a–t graph', n: 'The graph is made of constant pieces. The area under each piece is the change in velocity (Δv = ∫a dt); the v–t graph is then a set of straight lines and the s–t graph a set of parabolas.',
        table: { head: ['Piece', 't (s)', `a (${u.A})`, `Δv = area (${u.V})`, `v at end (${u.V})`, `s at end (${u.L})`], rows: pieces.map((q, i) => { const d = q.t1 - q.t0; return [String(i + 1), `${fmt(q.t0)} to ${fmt(q.t1)}`, fmt(q.a), fmt(q.a * d), fmt(q.v0 + q.a * d), fmt(q.s0 + q.v0 * d + 0.5 * q.a * d * d)]; }) } });
    }
    const Tend = pieces[pieces.length - 1].t1;
    if (!(t >= 0 && t <= Tend + 1e-9)) return fail(`Pick an instant between 0 and ${fmt(Tend)} s, the end of the graph.`);
    const find = (x) => pieces.find((q) => x <= q.t1 + 1e-12) || pieces[pieces.length - 1];
    const M = { s: (x) => { const q = find(x), d = x - q.t0; return q.s0 + q.v0 * d + 0.5 * q.a * d * d; }, v: (x) => { const q = find(x); return q.v0 + q.a * (x - q.t0); }, a: (x) => find(x).a };
    const zeros = [];
    pieces.forEach((q) => { if (Math.abs(q.a) > 1e-14) { const tz = q.t0 - q.v0 / q.a; if (tz > q.t0 + 1e-9 && tz <= q.t1 + 1e-9) zeros.push(tz); } });
    if (zeros.length) { S.add({ t: 'Instants where v = 0', f: 'v = v₀ + aτ = 0 in the piece', r: zeros.map((z) => `t = ${fmt(z)} s (s = ${fmt(M.s(z))} ${u.L})`).join('; ') }); out.push({ k: 'First instant with v = 0 (after start)', v: zeros[0], u: 's' }); }
    S.add({ t: `At t = ${fmt(t)} s`, s: `s = ${fmt(M.s(t))} ${u.L}, v = ${fmt(M.v(t))} ${u.V}, a = ${fmt(M.a(t))} ${u.A}` });
    atOut(out, M, t, u, true);
    summary(S, out, M, 0, Tend, u);
    S.list[S.list.length - 2].t += ` (whole graph, 0 to ${fmt(Tend)} s)`;
    return R(`At t = ${fmt(t)} s: s = ${fmt(M.s(t))} ${u.L}, v = ${fmt(M.v(t))} ${u.V}`, 'ok', out, S, { mode: 'graph', u, M, span: [0, Tend], t, marks: zeros, breaks: pieces.map((q) => q.t1) });
  }


  /* Dependent motion (12.9) ------------------------------------------- */
  const KEYS = ['cA', 'cB', 'cC', 'cD', 'cE'];
  function dep(q, u) {
    const B = (q.bodies || []).slice(0, 5), nb = B.length, cords = q.cords || [];
    if (nb < 2) return fail('Add at least two blocks or points.');
    if (!cords.length) return fail('Add the cords.');
    const names = B.map((b, i) => String(b.name || '').trim() || 'ABCDE'[i]);
    const giv = B.map((b) => b.given === 'yes'), unk = B.map((b, i) => i).filter((i) => !giv[i]), kn = B.map((b, i) => i).filter((i) => giv[i]);
    if (!kn.length) return fail('Give the motion of at least one block or point.');
    if (!unk.length) return fail('Mark at least one block or point as unknown ("find").');
    const C = cords.map((c) => KEYS.slice(0, nb).map((k) => +c[k] || 0));
    C.forEach((r, j) => { if (r.every((v) => v === 0)) C[j] = null; });
    const Cs = C.filter(Boolean);
    if (!Cs.length) return fail('Enter the coefficients of each cord (how many times each position coordinate appears in its length).');
    const S = Steps(), out = [], term = (c, x) => (c === 1 ? x : c === -1 ? `−${x}` : `${fmt(c)}${x}`);
    const eqs = (sym, row) => row.map((c, i) => (c ? term(c, `${sym}_${names[i]}`) : null)).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
    S.add({ t: 'Position-coordinate equations', f: 'l = Σ cᵢ sᵢ for each cord', n: 'Each position coordinate s is measured from a fixed datum, positive in the same sense for every block (the book usually takes downward or toward the motor positive). A coordinate appears once for each segment of the cord whose length changes with it.',
      s: Cs.map((r, j) => `cord ${j + 1}: ${eqs('s', r)} = l${Cs.length > 1 ? j + 1 : ''}`).join(';   ') });
    S.add({ t: 'Time derivatives', f: 'Σ cᵢ vᵢ = 0;  Σ cᵢ aᵢ = 0;  Σ cᵢ Δsᵢ = 0', n: 'The cord lengths are constant, so their changes, rates and accelerations are zero.',
      s: Cs.map((r) => `${eqs('v', r)} = 0`).join(';   ') });
    const solveFor = (k) => {
      const A = Cs.map((r) => unk.map((i) => r[i])), b = Cs.map((r) => -kn.reduce((s2, i) => s2 + r[i] * (+B[i][k] || 0), 0));
      return linSolve(A, b);
    };
    const sv = solveFor('v'), sa = solveFor('a'), sd = solveFor('ds');
    if (sv.rank < unk.length) return fail(`The cords give ${sv.rank} independent equation${sv.rank === 1 ? '' : 's'} for ${unk.length} unknown motion${unk.length > 1 ? 's' : ''}: add a cord or give the motion of another block.`);
    if (!sv.consistent || !sa.consistent || !sd.consistent) return fail('The given motions do not fit the cord equations (too many given values that disagree). Mark one of them as unknown.');
    const v = B.map((b) => +b.v || 0), a = B.map((b) => +b.a || 0), d = B.map((b) => +b.ds || 0);
    unk.forEach((i, k) => { v[i] = sv.x[k]; a[i] = sa.x[k]; d[i] = sd.x[k]; });
    const dirw = (x) => (Math.abs(x) < 1e-12 ? '' : x > 0 ? ' (in the +s sense)' : ' (against the +s sense)');
    S.add({ t: 'Given', r: kn.map((i) => `v_${names[i]} = ${fmt(v[i])} ${u.V}, a_${names[i]} = ${fmt(a[i])} ${u.A}${d[i] ? `, Δs_${names[i]} = ${fmt(d[i])} ${u.L}` : ''}`).join(';  ') });
    S.add({ t: 'Velocities', s: `Solving ${Cs.length} equation${Cs.length > 1 ? 's' : ''} for ${unk.map((i) => 'v_' + names[i]).join(', ')}`, r: unk.map((i) => `v_${names[i]} = ${fmt(v[i])} ${u.V}${dirw(v[i])}`).join(';  ') });
    if (a.some((x) => x)) S.add({ t: 'Accelerations', f: 'Σ cᵢ aᵢ = 0', r: unk.map((i) => `a_${names[i]} = ${fmt(a[i])} ${u.A}${dirw(a[i])}`).join(';  ') });
    if (d.some((x) => x)) S.add({ t: 'Displacements', f: 'Σ cᵢ Δsᵢ = 0', r: unk.map((i) => `Δs_${names[i]} = ${fmt(d[i])} ${u.L}${dirw(d[i])}`).join(';  ') });
    unk.forEach((i) => { out.push({ k: `v_${names[i]}`, v: v[i], u: u.V, hl: true }); if (a.some((x) => x)) out.push({ k: `a_${names[i]}`, v: a[i], u: u.A, hl: true }); if (d.some((x) => x)) out.push({ k: `Δs_${names[i]}`, v: d[i], u: u.L, hl: true }); });
    const rel = [];
    for (let i = 0; i < nb && rel.length < 6; i++) for (let j = i + 1; j < nb && rel.length < 6; j++) rel.push([i, j]);
    S.add({ t: 'Relative velocities', f: 'v_X/Y = v_X − v_Y', r: rel.map(([i, j]) => `v_${names[i]}/${names[j]} = ${fmt(v[i] - v[j])} ${u.V}`).join(';  ') });
    rel.forEach(([i, j]) => out.push({ k: `v_${names[i]}/${names[j]}`, v: v[i] - v[j], u: u.V }));
    let T = 1, warn = [];
    if (q.tgt) {
      const i = names.indexOf(q.tB), vt = Math.abs(+q.tv);
      if (i < 0) return fail(`There is no block named ${q.tB}.`);
      if (!(Math.abs(a[i]) > 0)) warn.push(`${names[i]} does not accelerate, so its speed stays ${fmt(Math.abs(v[i]))} ${u.V}.`);
      else {
        const sg = v[i] !== 0 ? Math.sign(v[i]) : Math.sign(a[i]), t = (sg * vt - v[i]) / a[i];
        if (!(t >= 0)) warn.push(`${names[i]} is slowing down and never reaches a speed of ${fmt(vt)} ${u.V}.`);
        else {
          T = t || 1;
          S.add({ t: `Time for ${names[i]} to reach ${fmt(vt)} ${u.V}`, f: 'v = v₀ + a_c t', s: `${fmt(sg * vt)} = ${fmt(v[i])} + (${fmt(a[i])}) t`, r: `t = ${fmt(t)} s` });
          out.unshift({ k: `Time for ${names[i]} to reach ${fmt(vt)} ${u.V}`, v: t, u: 's', hl: true });
          out.push({ k: `Distance ${names[i]} moves in that time`, v: Math.abs(v[i] * t + 0.5 * a[i] * t * t), u: u.L });
        }
      }
    }
    const Ms = B.map((b, i) => ({ s: (t) => v[i] * t + 0.5 * a[i] * t * t, v: (t) => v[i] + a[i] * t, a: () => a[i] }));
    return R(`${unk.map((i) => `v_${names[i]} = ${fmt(v[i])} ${u.V}`).join(', ')}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'dep', u, Ms, M: Ms[0], names, giv, span: [0, T], t: T, marks: [], cords: Cs, v, a }, warn);
  }

  const Rect = { defaults, convertState, solve };
  root.Rect = Rect;
  if (typeof module !== 'undefined' && module.exports) module.exports = Rect;
})(typeof window !== 'undefined' ? window : globalThis);
