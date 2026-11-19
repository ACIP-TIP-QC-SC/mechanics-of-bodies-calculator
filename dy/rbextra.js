/* =====================================================================
 * DYNAMICS · Planar kinematics: absolute motion, rotating frames, slotted links and planetary gears
 * (physics only; browser + Node). The Planar Kinematics module (dy/rbmotion.js) hands these modes here.
 * Hibbeler, Dynamics 15e:
 *   16.4 Absolute motion: s = f(θ), v = f′(θ) ω, a = f″(θ) ω² + f′(θ) α
 *   16.8 Rotating axes:   v_B = v_A + Ω × r_B/A + (v_B/A)xyz                               (16–24)
 *                         a_B = a_A + Ω̇ × r_B/A + Ω × (Ω × r_B/A) + 2Ω × (v_B/A)xyz + (a_B/A)xyz  (16–27)
 *   Slotted link: a peg moves along a straight slot that passes through the link's pivot A.
 *   Planetary gears: an arm carries gear B round a sun gear (or inside a ring gear) A.
 * Signs: angular quantities are + counterclockwise (k points out of the page).
 * State keys start with j so they never meet the other mechanisms' keys.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const Formula = root.Formula || require('../shared/formula.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;
  const MODES = ['abs', 'rotframe', 'slot', 'planet'];

  const defaults = () => ({
    // absolute motion s = f(θ)
    jf: '0.12 sin θ + 0.15', jdir: 'x', jth: 30, jgiven: 'w', jw: 4, jal: 2, jv: 0.416, ja: 0,
    // rotating frame
    jvox: 0, jvoy: 0, jaox: 0, jaoy: 0, jW: -15, jWd: 0, jrx: 0, jry: 0.3, jvrx: -21.65, jvry: 12.5, jarx: -25.98, jary: 15,
    // slotted link pivoted at A (origin); peg B
    jbx: 0.75, jby: 0, jsrc: 'crank', jcx: 0.75, jcy: -0.3, jcw: 6, jca: 10, jvbx: 0, jvby: 0, jabx: 0, jaby: 0,
    // planetary gears
    jring: 'sun', jrA: 0.3, jrB: 0.2, jwA: 0, jaA: 0, jwarm: -6, jaarm: -3, jpth: 30,
  });
  const KINDS = { jvox: 'V', jvoy: 'V', jaox: 'A', jaoy: 'A', jrx: 'L', jry: 'L', jvrx: 'V', jvry: 'V', jarx: 'A', jary: 'A',
    jbx: 'L', jby: 'L', jcx: 'L', jcy: 'L', jvbx: 'V', jvby: 'V', jabx: 'A', jaby: 'A', jrA: 'L', jrB: 'L' };
  /** s = f(θ) carries a length or an angle; its formula's numbers are in the units typed and are not rescaled. */
  function convert(st, from, to) {
    if (from === to) return st;
    DY.convertObj(st, KINDS, from, to);
    if (st.jdir !== 'ang') { const f = DY.factor('L', from, to); st.jv = Core.tidy(+st.jv * f, 8); st.ja = Core.tidy(+st.ja * f, 8); }
    return st;
  }

  /* 2D vectors; k × r = (−r_y, r_x), and Ω k × r = Ω (k × r) */
  const add = (...v) => v.reduce((s, a) => [s[0] + a[0], s[1] + a[1]], [0, 0]);
  const mul = (a, k) => [a[0] * k, a[1] * k], kx = (r) => [-r[1], r[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const len = (a) => Math.hypot(a[0], a[1]), dirn = (a) => Math.atan2(a[1], a[0]) / D2R;
  const vtxt = (v) => `${fmt(v[0])}i + ${fmt(v[1])}j`.replace(/\+ −/g, '− ');
  const sense = (w) => (Math.abs(w) < 1e-12 ? '' : w > 0 ? ' ↺' : ' ↻');
  const num = (x, d) => (x === '' || x === undefined || x === null ? d : +x);

  function solve(st, u) {
    switch (st.mode) {
      case 'abs': return absolute(st, u);
      case 'rotframe': return rotframe(st, u);
      case 'slot': return slot(st, u);
      default: return planet(st, u);
    }
  }

  /* ---------------- absolute motion: s = f(θ) ---------------- */
  function absolute(st, u) {
    const S = Steps(), out = [], warn = [], ang = st.jdir === 'ang', su = ang ? 'rad' : u.L, vu = ang ? 'rad/s' : u.V, au = ang ? 'rad/s²' : u.A;
    let f;
    try { const c = Formula.compile(st.jf, new Set(['θ', 'theta', 'u'])); f = (t) => c({ 'θ': t, theta: t, u: t }); } catch (e) { return fail(`s(θ): ${e.message}.`); }
    const th = +st.jth * D2R;
    if (!isFinite(th)) return fail('Enter the angle θ.');
    const [s0, d1, d2] = Formula.d012(f, th);
    if (![s0, d1, d2].every(isFinite)) return fail('s(θ) cannot be worked out at this angle.');
    const name = ang ? 'φ' : st.jdir === 'y' ? 'y' : 'x';
    S.add({ t: 'Position coordinate', n: 'From the geometry, the coordinate of the moving part as a function of the driving angle θ (θ in radians).', f: `${name} = ${st.jf}`, r: `${name} = ${fmt(s0)} ${su} at θ = ${fmt(+st.jth)}°` });
    S.add({ t: 'Derivatives with respect to θ', f: `d${name}/dθ = f′(θ),  d²${name}/dθ² = f″(θ)`, r: `f′ = ${fmt(d1)},  f″ = ${fmt(d2)}` });
    let w, al, v, a;
    if (st.jgiven === 'v') {
      v = +st.jv; a = num(st.ja, 0);
      if (!isFinite(v)) return fail(`Enter the velocity of ${name}.`);
      if (Math.abs(d1) < 1e-12) return fail('f′(θ) = 0 here: the part is at the end of its travel, so its velocity cannot give ω.');
      w = v / d1; al = (a - d2 * w * w) / d1;
      S.add({ t: 'Angular velocity', f: `v = f′ ω  ⇒  ω = v/f′`, s: `ω = ${fmt(v)}/${fmt(d1)}`, r: `ω = ${fmt(w)} rad/s${sense(w)}` });
      S.add({ t: 'Angular acceleration', f: 'a = f″ ω² + f′ α  ⇒  α = (a − f″ ω²)/f′', s: `α = [${fmt(a)} − ${fmt(d2)}(${fmt(w)})²]/${fmt(d1)}`, r: `α = ${fmt(al)} rad/s²${sense(al)}` });
    } else {
      w = +st.jw; al = num(st.jal, 0);
      if (!isFinite(w)) return fail('Enter the angular velocity ω.');
      v = d1 * w; a = d2 * w * w + d1 * al;
      S.add({ t: 'Velocity', f: `v = d${name}/dt = f′(θ) ω`, s: `v = ${fmt(d1)}(${fmt(w)})`, r: `v = ${fmt(v)} ${vu}` });
      S.add({ t: 'Acceleration', f: `a = d²${name}/dt² = f″(θ) ω² + f′(θ) α`, s: `a = ${fmt(d2)}(${fmt(w)})² + ${fmt(d1)}(${fmt(al)})`, r: `a = ${fmt(a)} ${au}` });
    }
    out.push({ k: `Position ${name}`, v: s0, u: su }, { k: `Velocity v`, v, u: vu, hl: st.jgiven !== 'v' }, { k: 'Acceleration a', v: a, u: au, hl: st.jgiven !== 'v' },
      { k: 'Angular velocity ω', v: w, u: 'rad/s', hl: st.jgiven === 'v' }, { k: 'Angular acceleration α', v: al, u: 'rad/s²', hl: st.jgiven === 'v' });
    const head = st.jgiven === 'v' ? `ω = ${fmt(w)} rad/s, α = ${fmt(al)} rad/s²` : `v = ${fmt(v)} ${vu}, a = ${fmt(a)} ${au}`;
    return DY.result(head, 'ok', out, S, { mode: 'abs', u, f, dir: st.jdir, name, th, s0, d1, d2, w, al, v, a, span: [0, 1] }, warn);
  }

  /* ---------------- rotating frame (16–24, 16–27) ---------------- */
  /** Velocity and acceleration of a point from the motion of a rotating frame and the point's motion in it. */
  function frameTerms(vO, aO, W, Wd, r, vr, ar) {
    const Wr = mul(kx(r), W), Wdr = mul(kx(r), Wd), WWr = mul(r, -W * W), cor = mul(kx(vr), 2 * W);
    return { Wr, Wdr, WWr, cor, v: add(vO, Wr, vr), a: add(aO, Wdr, WWr, cor, ar) };
  }
  function rotframe(st, u) {
    const S = Steps(), out = [];
    const vO = [num(st.jvox, 0), num(st.jvoy, 0)], aO = [num(st.jaox, 0), num(st.jaoy, 0)], W = num(st.jW, 0), Wd = num(st.jWd, 0);
    const r = [num(st.jrx, 0), num(st.jry, 0)], vr = [num(st.jvrx, 0), num(st.jvry, 0)], ar = [num(st.jarx, 0), num(st.jary, 0)];
    if (![...vO, ...aO, W, Wd, ...r, ...vr, ...ar].every(isFinite)) return fail('Every entry must be a number.');
    const k = frameTerms(vO, aO, W, Wd, r, vr, ar);
    S.add({ t: 'Motion of the moving frame', n: 'The xyz frame has its origin at O and turns with the body; at this instant it lines up with the fixed XYZ axes.', s: `v_O = ${vtxt(vO)},  a_O = ${vtxt(aO)},  Ω = ${fmt(W)}k rad/s,  Ω̇ = ${fmt(Wd)}k rad/s²` });
    S.add({ t: 'Motion of the point in the frame', s: `r_B/O = ${vtxt(r)} ${u.L},  (v_B/O)xyz = ${vtxt(vr)} ${u.V},  (a_B/O)xyz = ${vtxt(ar)} ${u.A}` });
    S.add({ t: 'Velocity', f: 'v_B = v_O + Ω × r_B/O + (v_B/O)xyz', s: `v_B = ${vtxt(vO)} + (${vtxt(k.Wr)}) + (${vtxt(vr)})`, r: `v_B = {${vtxt(k.v)}} ${u.V},  |v_B| = ${fmt(len(k.v))} ${u.V}` });
    S.add({ t: 'Acceleration', f: 'a_B = a_O + Ω̇ × r + Ω × (Ω × r) + 2Ω × (v_B/O)xyz + (a_B/O)xyz',
      s: `a_B = ${vtxt(aO)} + (${vtxt(k.Wdr)}) + (${vtxt(k.WWr)}) + (${vtxt(k.cor)}) + (${vtxt(ar)})`, r: `a_B = {${vtxt(k.a)}} ${u.A},  |a_B| = ${fmt(len(k.a))} ${u.A}` });
    S.add({ t: 'Coriolis acceleration', n: 'The 2Ω × (v_B/O)xyz term comes from the point moving within a frame that turns; it vanishes when either is zero.', r: `2Ω × v_rel = {${vtxt(k.cor)}} ${u.A}` });
    out.push({ k: 'Velocity v_B, x', v: k.v[0], u: u.V }, { k: 'Velocity v_B, y', v: k.v[1], u: u.V }, { k: 'Speed |v_B|', v: len(k.v), u: u.V, hl: true },
      { k: 'Acceleration a_B, x', v: k.a[0], u: u.A }, { k: 'Acceleration a_B, y', v: k.a[1], u: u.A }, { k: 'Magnitude |a_B|', v: len(k.a), u: u.A, hl: true },
      { k: 'Direction of a_B from +x', v: dirn(k.a), u: '°' }, { k: 'Coriolis 2Ω × v_rel', v: len(k.cor), u: u.A });
    const T = Math.abs(W) > 1e-9 ? Math.min(0.6 / Math.abs(W), 2) : 1;
    return DY.result(`v_B = {${vtxt(k.v)}} ${u.V}, a_B = {${vtxt(k.a)}} ${u.A}`, 'ok', out, S, { mode: 'rotframe', u, vO, aO, W, Wd, r, vr, ar, k, span: [0, T] }, []);
  }

  /* ---------------- slotted link ---------------- */
  /** Link pivoted at A = origin, slot through A along r_B; peg B has velocity vB and acceleration aB. */
  function slotSolve(r, vB, aB) {
    const L = len(r), e = mul(r, 1 / L), n = kx(e);
    const w = dot(vB, n) / L, vrel = dot(vB, e);
    const rhs = add(aB, mul(r, w * w), mul(n, -2 * w * vrel));
    return { L, e, n, w, vrel, al: dot(rhs, n) / L, arel: dot(rhs, e) };
  }
  function slot(st, u) {
    const S = Steps(), out = [], warn = [];
    const r = [num(st.jbx, 0), num(st.jby, 0)];
    if (!(len(r) > 1e-12)) return fail('The peg cannot sit at the pivot A: enter where B is from A.');
    let vB, aB, crank = null;
    if (st.jsrc === 'crank') {
      const c = [num(st.jcx, 0), num(st.jcy, 0)], w = num(st.jcw, 0), al = num(st.jca, 0), rc = [r[0] - c[0], r[1] - c[1]];
      if (!(len(rc) > 1e-12)) return fail('The peg is at the centre of the disk or crank, so it does not move.');
      vB = mul(kx(rc), w); aB = add(mul(kx(rc), al), mul(rc, -w * w)); crank = { c, w, al, rc };
      S.add({ t: 'Motion of the peg B', n: 'B is fixed to a disk or crank turning about the fixed point C.', f: 'v_B = ω × r_B/C,  a_B = α × r_B/C − ω² r_B/C', s: `r_B/C = ${vtxt(rc)} ${u.L}`, r: `v_B = {${vtxt(vB)}} ${u.V},  a_B = {${vtxt(aB)}} ${u.A}` });
    } else {
      vB = [num(st.jvbx, 0), num(st.jvby, 0)]; aB = [num(st.jabx, 0), num(st.jaby, 0)];
      S.add({ t: 'Motion of the peg B', n: 'Given directly (for example from the IC of a rolling gear).', r: `v_B = {${vtxt(vB)}} ${u.V},  a_B = {${vtxt(aB)}} ${u.A}` });
    }
    if (![...vB, ...aB].every(isFinite)) return fail('Every entry must be a number.');
    const k = slotSolve(r, vB, aB);
    S.add({ t: 'Moving frame on the link', n: 'The xyz frame turns with the slotted link about A, with x along the slot towards B. B slides along x.', s: `r_B/A = ${fmt(k.L)} ${u.L} at ${fmt(dirn(r))}°,  Ω = ω_AC k,  (v_B/A)xyz = v_rel î,  (a_B/A)xyz = a_rel î` });
    S.add({ t: 'Velocity', f: 'v_B = Ω × r_B/A + v_rel î  (along î and across it, ĵ)', s: `across: ${fmt(dot(vB, k.n))} = ω_AC (${fmt(k.L)});  along: ${fmt(dot(vB, k.e))} = v_rel`, r: `ω_AC = ${fmt(k.w)} rad/s${sense(k.w)},  v_rel = ${fmt(k.vrel)} ${u.V}` });
    S.add({ t: 'Acceleration', f: 'a_B = Ω̇ × r − ω² r + 2Ω × v_rel î + a_rel î', s: `across: ${fmt(dot(aB, k.n))} = α_AC (${fmt(k.L)}) + 2(${fmt(k.w)})(${fmt(k.vrel)});  along: ${fmt(dot(aB, k.e))} = −(${fmt(k.w)})²(${fmt(k.L)}) + a_rel`, r: `α_AC = ${fmt(k.al)} rad/s²${sense(k.al)},  a_rel = ${fmt(k.arel)} ${u.A}` });
    out.push({ k: 'Angular velocity of the link ω_AC', v: k.w, u: 'rad/s', hl: true }, { k: 'Angular acceleration of the link α_AC', v: k.al, u: 'rad/s²', hl: true },
      { k: 'Sliding speed of B in the slot', v: k.vrel, u: u.V }, { k: 'Sliding acceleration of B in the slot', v: k.arel, u: u.A }, { k: 'Coriolis 2ω v_rel', v: 2 * k.w * k.vrel, u: u.A });
    return DY.result(`ω_AC = ${fmt(k.w)} rad/s, α_AC = ${fmt(k.al)} rad/s²`, 'ok', out, S, { mode: 'slot', u, r, vB, aB, crank, k, span: [0, 1] }, warn);
  }

  /* ---------------- planetary gears ---------------- */
  /** ω_B of a planet from the arm and the sun (or ring) gear; the same rule holds for α. */
  function planetRate(ring, rA, rB, wA, warm) {
    const L = ring ? rA - rB : rA + rB;
    return ring ? (wA * rA - warm * L) / rB : (warm * L - wA * rA) / rB;
  }
  function planet(st, u) {
    const S = Steps(), out = [], ring = st.jring === 'ring';
    const rA = +st.jrA, rB = +st.jrB, wA = num(st.jwA, 0), aA = num(st.jaA, 0), warm = num(st.jwarm, 0), aarm = num(st.jaarm, 0), th = num(st.jpth, 0) * D2R;
    if (!(rA > 0 && rB > 0)) return fail('Enter both gear radii.');
    if (ring && !(rB < rA)) return fail('A planet inside a ring gear must be smaller than the ring.');
    const L = ring ? rA - rB : rA + rB, wB = planetRate(ring, rA, rB, wA, warm), aB = planetRate(ring, rA, rB, aA, aarm);
    const e = [Math.cos(th), Math.sin(th)], rE = mul(e, L), vE = mul(kx(rE), warm), aE = add(mul(kx(rE), aarm), mul(rE, -warm * warm));
    const nA = ring ? 'ring gear A' : 'sun gear A';
    S.add({ t: 'Arm', n: `The arm turns about the centre of ${nA} and carries the centre E of gear B at ${ring ? 'r_A − r_B' : 'r_A + r_B'}.`, s: `r_E = ${fmt(L)} ${u.L}`, r: `v_E = ω_arm r_E = ${fmt(warm * L)} ${u.V}` });
    S.add({ t: `Contact with ${nA}`, n: wA === 0 && aA === 0 ? `${nA[0].toUpperCase()}${nA.slice(1)} is fixed, so the contact point F of B is the IC of B.` : `The contact point F moves with ${nA}: v_F = ω_A r_A = ${fmt(wA * rA)} ${u.V}.`,
      f: ring ? 'v_E = v_F − ω_B r_B  ⇒  ω_B = (ω_A r_A − ω_arm r_E)/r_B' : 'v_E = v_F + ω_B r_B  ⇒  ω_B = (ω_arm r_E − ω_A r_A)/r_B', s: ring ? `ω_B = [${fmt(wA)}(${fmt(rA)}) − ${fmt(warm)}(${fmt(L)})]/${fmt(rB)}` : `ω_B = [${fmt(warm)}(${fmt(L)}) − ${fmt(wA)}(${fmt(rA)})]/${fmt(rB)}`, r: `ω_B = ${fmt(wB)} rad/s${sense(wB)}` });
    S.add({ t: 'Angular acceleration', n: 'The tangential accelerations follow the same rule (the normal parts pass through the centres and do not turn B).', f: ring ? 'α_B = (α_A r_A − α_arm r_E)/r_B' : 'α_B = (α_arm r_E − α_A r_A)/r_B', r: `α_B = ${fmt(aB)} rad/s²${sense(aB)}` });
    S.add({ t: 'Centre of B', f: 'a_E = α_arm × r_E − ω_arm² r_E', s: `arm at ${fmt(th / D2R)}°`, r: `a_E = {${vtxt(aE)}} ${u.A},  |a_E| = ${fmt(len(aE))} ${u.A}` });
    out.push({ k: 'Angular velocity of gear B, ω_B', v: wB, u: 'rad/s', hl: true }, { k: 'Angular acceleration of gear B, α_B', v: aB, u: 'rad/s²', hl: true },
      { k: 'Speed of the centre of B, v_E', v: len(vE), u: u.V }, { k: 'Acceleration of the centre of B, a_E', v: len(aE), u: u.A });
    const T = Math.abs(warm) > 1e-9 ? Math.min(2 * Math.PI / Math.abs(warm), 6) : 2;
    return DY.result(`ω_B = ${fmt(wB)} rad/s, α_B = ${fmt(aB)} rad/s²`, 'ok', out, S, { mode: 'planet', u, ring, rA, rB, L, wA, aA, warm, aarm, wB, aB, th, vE, aE, span: [0, T] }, []);
  }

  const RbExtra = { MODES, defaults, convert, solve, frameTerms, slotSolve, planetRate };
  root.RbExtra = RbExtra;
  if (typeof module !== 'undefined' && module.exports) module.exports = RbExtra;
})(typeof window !== 'undefined' ? window : globalThis);
