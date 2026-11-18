/* =====================================================================
 * DYNAMICS · D8 Three-Dimensional Motion of a Rigid Body (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Chapters 20 and 21.
 *   Kinematics: a chain of rotations, each about an axis carried by the one before
 *     ω = Σωᵢ,  α = Σ(ω̇ᵢ + Ωᵢ₋₁ × ωᵢ)                                              (20–5, 20–6)
 *     v = v_O + Ω × r + (v_rel),  a = a_O + α × r + Ω × (Ω × r) + 2Ω × v_rel + a_rel     (20–11, 20–12)
 *     rolling without slipping: ω lies along the line of contact
 *   Moments and products of inertia of a composite body, principal moments            (21–1 to 21–4)
 *   Angular momentum H_O = r_G × m v_G + H_G, H_G = I_G ω; kinetic energy T            (21–6 to 21–15)
 *   Equations of motion ΣF = m a_G, ΣM_G = I_G α + ω × (I_G ω), bearing reactions       (21–19, 21–24)
 *   Steady precession of a symmetric body (gyroscope, top)                              (21–30)
 *   Torque-free motion                                                                  (21–36)
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;

  /* ---------------- vectors and 3 × 3 matrices ---------------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a); return l > 0 ? mul(a, 1 / l) : null; };
  const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
  const madd = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
  const zero3 = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  /** Parallel-axis term m(|d|²E − d dᵀ). */
  const shift = (m, d) => { const d2 = dot(d, d); return [0, 1, 2].map((i) => [0, 1, 2].map((j) => m * ((i === j ? d2 : 0) - d[i] * d[j]))); };
  /** Eigenvalues of a symmetric 3 × 3 matrix (Jacobi), with the unit eigenvectors. */
  function eig3(A) {
    const a = A.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 50; sweep++) {
      let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
      if (off < 1e-14 * (Math.abs(a[0][0]) + Math.abs(a[1][1]) + Math.abs(a[2][2]) + 1e-300)) break;
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return [0, 1, 2].map((i) => ({ I: a[i][i], v: [V[0][i], V[1][i], V[2][i]] })).sort((x, y) => y.I - x.I);
  }
  /** "{−5.2i − 12j + 20.8k}" */
  function vs(v, u) {
    const parts = []; ['i', 'j', 'k'].forEach((e, i) => { if (Math.abs(v[i]) > 1e-10 * Math.max(1, len(v))) parts.push({ v: v[i], txt: fmt(Math.abs(v[i])) + e }); });
    return `{${Core.sumStr(parts)}}${u ? ' ' + u : ''}`;
  }
  const V3 = (o, p) => [+o[p + 'x'] || 0, +o[p + 'y'] || 0, +o[p + 'z'] || 0];
  const RATE = { 'rad/s': 1, rpm: (2 * Math.PI) / 60, 'rev/h': (2 * Math.PI) / 3600 };

  /* ---------------- defaults: the fire-truck ladder (Prob. 20-3) ---------------- */
  function defaults() {
    return {
      mode: 'kin',
      rots: [
        { name: 'ω₁', ux: 0, uy: 0, uz: 1, px: 0, py: 0, pz: 0, w: 0.15, wd: 0.8, roll: 'no', dx: 0, dy: 1, dz: 0 },
        { name: 'ω₂', ux: 1, uy: 0, uz: 0, px: 0, py: 0, pz: 0, w: 0.6, wd: 0, roll: 'no', dx: 0, dy: 1, dz: 0 },
      ],
      base: { vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 },
      P: { x: 0, y: 34.641, z: 20 }, rel: { vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 }, relOn: false,
      parts: [{ t: 'disk', m: 10, x: 0, y: 0.6, z: 0, ax: 'z', r: 0.15, h: 0.1, a: 0.2, b: 0.2, x2: 0, y2: 0, z2: 0, Ixx: 0, Iyy: 0, Izz: 0, Ixy: 0, Iyz: 0, Ixz: 0 }],
      grav: true, sup: 'none', A: { x: 0, y: -0.5, z: 0 }, B: { x: 0, y: 0.5, z: 0 }, thrust: 'A',
      ru: 'rad/s',
      gy: { unk: 'spin', m: 0.09, kz: 0.018, kt: 0.035, mom: 'weight', rG: 0.06, M: 0, th: 45, prec: 0.5, spin: 100 },
      fr: { m: 1800, kz: 0.8, kt: 1.2, th: 5, given: 'spin', spin: 6, prec: 1, H: 10000 },
      showV: true, showA: true,
    };
  }
  const PART = { m: 'M', x: 'L', y: 'L', z: 'L', r: 'L', h: 'L', a: 'L', b: 'L', x2: 'L', y2: 'L', z2: 'L', Ixx: 'I', Iyy: 'I', Izz: 'I', Ixy: 'I', Iyz: 'I', Ixz: 'I' };
  function convertState(st, from, to) {
    DY.convertList(st.rots, { px: 'L', py: 'L', pz: 'L' }, from, to);
    DY.convertObj(st.base, { vx: 'V', vy: 'V', vz: 'V', ax: 'A', ay: 'A', az: 'A' }, from, to);
    DY.convertObj(st.rel, { vx: 'V', vy: 'V', vz: 'V', ax: 'A', ay: 'A', az: 'A' }, from, to);
    DY.convertObj(st.P, { x: 'L', y: 'L', z: 'L' }, from, to);
    DY.convertList(st.parts, PART, from, to);
    DY.convertObj(st.A, { x: 'L', y: 'L', z: 'L' }, from, to); DY.convertObj(st.B, { x: 'L', y: 'L', z: 'L' }, from, to);
    DY.convertObj(st.gy, { m: 'M', kz: 'L', kt: 'L', rG: 'L', M: 'MO' }, from, to);
    DY.convertObj(st.fr, { m: 'M', kz: 'L', kt: 'L', H: 'I' }, from, to);
    return st;
  }

  function solve(st, U) {
    const u = DY.units(U);
    switch (st.mode) {
      case 'inertia': return inertia(st, u);
      case 'mom': return momentum(st, u);
      case 'euler': return euler(st, u);
      case 'gyro': return gyro(st, u);
      case 'free': return torqueFree(st, u);
      default: return kin(st, u);
    }
  }

  /* ------------------------------------------------------------------ */
  /* The chain of rotations                                             */
  /* ------------------------------------------------------------------ */
  /**
   * rots: rotation i turns about an axis through point pᵢ along uᵢ; the axis is carried by rotation i − 1.
   * Returns frames with Ω, A (angular velocity and acceleration of the frame), the origin and its v, a.
   */
  function chain(st, S, err) {
    const R = (st.rots || []).map((r, i) => ({ i, name: r.name || `ω${i + 1}`, u: unit(V3(r, 'u')), p: V3(r, 'p'), w: +r.w, wd: +r.wd, roll: r.roll === 'yes', d: unit(V3(r, 'd')) }));
    if (!R.length) { err.push('Add at least one rotation.'); return null; }
    R.forEach((r) => {
      if (!r.u) err.push(`${r.name}: the axis direction cannot be zero.`);
      if (r.roll && !r.d) err.push(`${r.name}: the direction of the line of contact cannot be zero.`);
      if (!r.roll && (!isFinite(r.w) || !isFinite(r.wd))) err.push(`${r.name}: enter its rate and its rate of change.`);
    });
    const rolls = R.filter((r) => r.roll);
    if (rolls.length > 1) err.push('Only one rotation can be found from rolling without slipping.');
    if (rolls.length && R[0].roll) err.push('The first rotation drives the motion; make a later one roll.');
    if (err.length) return null;
    if (rolls.length) {
      const r = rolls[0], Sx = R.filter((q) => q !== r).reduce((s, q) => add(s, mul(q.u, q.w)), [0, 0, 0]);
      const ud = cross(r.u, r.d), sd = cross(Sx, r.d), den = dot(ud, ud);
      if (den < 1e-12) { err.push(`${r.name}: its axis lies along the line of contact, so rolling does not fix its rate.`); return null; }
      r.w = -dot(sd, ud) / den;
      const resid = len(cross(add(Sx, mul(r.u, r.w)), r.d));
      if (resid > 1e-6 * Math.max(1, len(Sx))) { err.push(`${r.name}: no rate puts ω along the line of contact; check that the axes and the contact line lie in one plane.`); return null; }
      const d1 = R[0];
      r.wd = Math.abs(d1.w) > 1e-12 ? r.w * (d1.wd / d1.w) : 0;
      const tot = add(Sx, mul(r.u, r.w));
      S.add({ t: `Rolling without slipping fixes ${r.name}`, n: 'The points of contact have no velocity, so the angular velocity of the body lies along the line of contact (the instantaneous axis of zero velocity). Its rate stays in proportion to the driving rotation, so its rate of change follows the same ratio.', f: `ω = ${R.filter((q) => q !== r).map((q) => q.name).join(' + ')} + ${r.name} u = λ d`, s: `${vs(Sx)} + ${r.name}${vs(r.u)} = λ${vs(r.d)}`, r: `${r.name} = ${fmt(r.w)} rad/s, ${r.name}̇ = ${fmt(r.wd)} rad/s², ω = ${vs(tot, 'rad/s')}` });
    }
    const vO = V3(st.base || {}, 'v'), aO = V3(st.base || {}, 'a');
    let O = [0, 0, 0], vo = vO, ao = aO, W = [0, 0, 0], A = [0, 0, 0];
    const F = [];
    R.forEach((r) => {
      const d = sub(r.p, O), vp = add(vo, cross(W, d)), ap = add(add(ao, cross(A, d)), cross(W, cross(W, d)));
      const wv = mul(r.u, r.w), carry = cross(W, wv);
      const Wn = add(W, wv), An = add(add(A, mul(r.u, r.wd)), carry);
      F.push({ r, O: r.p, vo: vp, ao: ap, Wprev: W, W: Wn, A: An, wv, wdv: mul(r.u, r.wd), carry });
      O = r.p; vo = vp; ao = ap; W = Wn; A = An;
    });
    return { R, F, W, A, vO, aO };
  }
  /** Velocity and acceleration of a point at r of the last frame (plus motion relative to it). */
  function pointOf(ch, r, vrel, arel) {
    const f = ch.F[ch.F.length - 1], d = sub(r, f.O), W = f.W, A = f.A;
    vrel = vrel || [0, 0, 0]; arel = arel || [0, 0, 0];
    const v = add(add(f.vo, cross(W, d)), vrel);
    const a = add(add(add(add(f.ao, cross(A, d)), cross(W, cross(W, d))), mul(cross(W, vrel), 2)), arel);
    return { v, a, d, f };
  }
  function chainSteps(S, ch) {
    S.add({ t: 'Angular velocity', n: 'Each rotation is a vector along its axis. The body’s angular velocity is their sum.', f: 'ω = ' + ch.R.map((r) => r.name).join(' + '), s: ch.R.map((r) => `${r.name} = ${fmt(r.w)}${vs(r.u)}`).join(',  '), r: `ω = ${vs(ch.W, 'rad/s')}` });
    const rows = ch.F.map((f, i) => [f.r.name, vs(f.wdv), i ? `${vs(f.Wprev)} × ${vs(f.wv)} = ${vs(f.carry)}` : '0 (fixed axis)', vs(add(f.wdv, f.carry))]);
    S.add({ t: 'Angular acceleration', n: 'Each rotation changes in size (ω̇ along its axis) and in direction, because its axis is carried round by the rotations before it: ω̇ᵢ = (ω̇ᵢ)xyz + Ω × ωᵢ, with Ω the sum of the rotations before it.', f: 'α = Σ[(ω̇ᵢ)xyz + Ω × ωᵢ]', table: { head: ['Rotation', '(ω̇)xyz (rad/s²)', 'Ω × ω (rad/s²)', 'Sum'], rows }, r: `α = ${vs(ch.A, 'rad/s²')}` });
  }

  /* ---------------- kinematics ---------------- */
  function kin(st, u) {
    const err = [], S = Steps();
    const ch = chain(st, S, err);
    if (!ch) return fail(err);
    chainSteps(S, ch);
    const P = V3(st.P, ''), rel = st.relOn, vrel = rel ? V3(st.rel, 'v') : [0, 0, 0], arel = rel ? V3(st.rel, 'a') : [0, 0, 0];
    const pt = pointOf(ch, P, vrel, arel), f = pt.f, moving = len(ch.vO) + len(ch.aO) > 0 || ch.F.some((x) => len(x.O) > 0 && len(x.Wprev) > 0);
    if (moving) S.add({ t: `Motion of the axis point ${fmt(f.O[0])}, ${fmt(f.O[1])}, ${fmt(f.O[2])}`, n: 'The last axis does not pass through a fixed point, so first find the motion of a point on it from the rotations before it.', f: 'v_B = v_O + Ω × r_B/O,  a_B = a_O + Ω̇ × r_B/O + Ω × (Ω × r_B/O)', r: `v_B = ${vs(f.vo, u.V)}, a_B = ${vs(f.ao, u.A)}` });
    S.add({ t: 'Velocity of the point', f: rel ? 'v_P = v_B + ω × r_P/B + (v_P/B)xyz' : 'v_P = v_B + ω × r_P/B', s: `r_P/B = ${vs(pt.d, u.L)}${moving ? `; v_B = ${vs(f.vo)}` : ''}${rel ? `; (v_P/B)xyz = ${vs(vrel)}` : ''}`, r: `v_P = ${vs(pt.v, u.V)}` });
    S.add({ t: 'Acceleration of the point', f: rel ? 'a_P = a_B + α × r + ω × (ω × r) + 2ω × (v_P/B)xyz + (a_P/B)xyz' : 'a_P = a_B + α × r + ω × (ω × r)', s: `α × r = ${vs(cross(f.A, pt.d))}, ω × (ω × r) = ${vs(cross(f.W, cross(f.W, pt.d)))}${rel ? `, 2ω × v_rel = ${vs(mul(cross(f.W, vrel), 2))}` : ''}`, r: `a_P = ${vs(pt.a, u.A)}` });
    const out = [];
    const vo = (k, v, unitS, hl) => { ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `${k}_${c}`, v: v[i], u: unitS, hl })); out.push({ k: `|${k}|`, v: len(v), u: unitS }); };
    vo('ω', ch.W, 'rad/s'); vo('α', ch.A, 'rad/s²'); vo('v_P', pt.v, u.V, true); vo('a_P', pt.a, u.A, true);
    ch.R.filter((r) => r.roll).forEach((r) => out.unshift({ k: `Rolling rate ${r.name}`, v: r.w, u: 'rad/s', hl: true }));
    return DY.result(`|v_P| = ${fmt(len(pt.v))} ${u.V}`, 'ok', out, S, { mode: 'kin', ch, P, pt, vrel });
  }

  /* ------------------------------------------------------------------ */
  /* Composite body                                                     */
  /* ------------------------------------------------------------------ */
  const SHAPES = { disk: 'Thin disk', cyl: 'Solid cylinder', ring: 'Thin ring', sphere: 'Solid sphere', rod: 'Slender rod (two end points)', plate: 'Thin rectangular plate', point: 'Particle', custom: 'Inertia typed in (about its own G)' };
  /** Inertia matrix of one part about its own centre, in x, y, z. */
  function partJ(p, m) {
    const ax = { x: 0, y: 1, z: 2 }[p.ax || 'z'], r = +p.r, h = +p.h, J = zero3();
    const set = (Is, It) => { for (let i = 0; i < 3; i++) J[i][i] = i === ax ? Is : It; };
    switch (p.t) {
      case 'disk': set(0.5 * m * r * r, 0.25 * m * r * r); break;
      case 'cyl': set(0.5 * m * r * r, (m * (3 * r * r + h * h)) / 12); break;
      case 'ring': set(m * r * r, 0.5 * m * r * r); break;
      case 'sphere': set(0.4 * m * r * r, 0.4 * m * r * r); break;
      case 'plate': { const a = +p.a, b = +p.b, i1 = (ax + 1) % 3, i2 = (ax + 2) % 3; J[ax][ax] = (m * (a * a + b * b)) / 12; J[i1][i1] = (m * b * b) / 12; J[i2][i2] = (m * a * a) / 12; break; }
      case 'rod': { const e = sub([+p.x2, +p.y2, +p.z2], [+p.x, +p.y, +p.z]), L = len(e), n = L > 0 ? mul(e, 1 / L) : [1, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) J[i][j] = ((m * L * L) / 12) * ((i === j ? 1 : 0) - n[i] * n[j]); break; }
      case 'custom': return [[+p.Ixx, -p.Ixy, -p.Ixz], [-p.Ixy, +p.Iyy, -p.Iyz], [-p.Ixz, -p.Iyz, +p.Izz]];
      default: break;
    }
    return J;
  }
  const centreOf = (p) => (p.t === 'rod' ? mul(add([+p.x, +p.y, +p.z], [+p.x2, +p.y2, +p.z2]), 0.5) : [+p.x, +p.y, +p.z]);
  function body(st, u, S, err) {
    const parts = (st.parts || []).map((p, i) => ({ p, i, m: DY.toBase(+p.m, 'M', u), c: centreOf(p) }));
    if (!parts.length) { err.push('Add at least one part to the body.'); return null; }
    parts.forEach((q) => {
      if (!(q.m > 0)) err.push(`Part ${q.i + 1}: the ${u.us ? 'weight' : 'mass'} must be positive.`);
      if (['disk', 'cyl', 'ring', 'sphere'].includes(q.p.t) && !(+q.p.r > 0)) err.push(`Part ${q.i + 1}: the radius must be positive.`);
      if (q.p.t === 'cyl' && !(+q.p.h >= 0)) err.push(`Part ${q.i + 1}: the length must not be negative.`);
      if (q.p.t === 'plate' && !(+q.p.a > 0 && +q.p.b > 0)) err.push(`Part ${q.i + 1}: both sides of the plate must be positive.`);
    });
    if (err.length) return null;
    const m = parts.reduce((s, q) => s + q.m, 0), G = mul(parts.reduce((s, q) => add(s, mul(q.c, q.m)), [0, 0, 0]), 1 / m);
    let JG = zero3();
    const rows = parts.map((q) => {
      q.J = partJ(q.p, q.m);
      const d = sub(q.c, G); JG = madd(JG, madd(q.J, shift(q.m, d)));
      return [`${q.i + 1} ${SHAPES[q.p.t].split(' (')[0]}`, DY.massTxt(q.m, u), `(${fmt(q.c[0])}, ${fmt(q.c[1])}, ${fmt(q.c[2])})`, fmt(q.J[0][0]), fmt(q.J[1][1]), fmt(q.J[2][2]), fmt(-q.J[0][1]), fmt(-q.J[1][2]), fmt(-q.J[0][2])];
    });
    const JO = madd(JG, shift(m, G));
    S.add({ t: 'Mass and centre of mass', n: 'Each part’s moments and products of inertia are about its own centre, along x, y, z. Products of inertia are I_xy = ∫xy dm (zero when a plane of symmetry contains the axes).', table: { head: ['Part', 'mass', `centre (${u.L})`, 'I_xx', 'I_yy', 'I_zz', 'I_xy', 'I_yz', 'I_xz'], rows }, f: 'm = Σmᵢ,  r_G = Σmᵢrᵢ / m', r: `m = ${DY.massTxt(m, u)}, G = (${fmt(G[0])}, ${fmt(G[1])}, ${fmt(G[2])}) ${u.L}` });
    S.add({ t: 'Inertia about G (parallel-axis and parallel-plane theorems)', f: 'I_xx = Σ[I_x′x′ + m(y² + z²)],  I_xy = Σ[I_x′y′ + m x y]   (x, y, z of each centre from G)', r: `I_xx = ${fmt(JG[0][0])}, I_yy = ${fmt(JG[1][1])}, I_zz = ${fmt(JG[2][2])}, I_xy = ${fmt(-JG[0][1])}, I_yz = ${fmt(-JG[1][2])}, I_xz = ${fmt(-JG[0][2])} ${u.I}` });
    return { parts, m, G, JG, JO };
  }

  /* ---------------- inertia only ---------------- */
  function inertia(st, u) {
    const err = [], S = Steps(), b = body(st, u, S, err);
    if (!b) return fail(err);
    const { JG, JO, G, m } = b;
    S.add({ t: 'Inertia about the origin O', f: 'I_O = I_G + m(|r_G|²E − r_G r_Gᵀ)', r: `I_xx = ${fmt(JO[0][0])}, I_yy = ${fmt(JO[1][1])}, I_zz = ${fmt(JO[2][2])}, I_xy = ${fmt(-JO[0][1])}, I_yz = ${fmt(-JO[1][2])}, I_xz = ${fmt(-JO[0][2])} ${u.I}` });
    const pr = eig3(JG);
    S.add({ t: 'Principal moments of inertia about G', n: 'The roots of the determinant |I − I_p E| = 0. The axes are the eigenvectors.', table: { head: ['I (' + u.I + ')', 'axis direction'], rows: pr.map((p) => [fmt(p.I), vs(p.v)]) } });
    const out = [{ k: u.us ? 'Total weight W' : 'Total mass m', v: DY.fromBase(m, 'M', u), u: u.M }, { k: 'x_G', v: G[0], u: u.L }, { k: 'y_G', v: G[1], u: u.L }, { k: 'z_G', v: G[2], u: u.L }];
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `I_${c}${c} about G`, v: JG[i][i], u: u.I }));
    [['xy', 0, 1], ['yz', 1, 2], ['xz', 0, 2]].forEach(([c, i, j]) => out.push({ k: `I_${c} about G`, v: -JG[i][j], u: u.I }));
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `I_${c}${c} about O`, v: JO[i][i], u: u.I, hl: true }));
    [['xy', 0, 1], ['yz', 1, 2], ['xz', 0, 2]].forEach(([c, i, j]) => out.push({ k: `I_${c} about O`, v: -JO[i][j], u: u.I, hl: true }));
    pr.forEach((p, i) => out.push({ k: `Principal moment ${['I_max', 'I_int', 'I_min'][i]} about G`, v: p.I, u: u.I }));
    return DY.result(`I_zz,O = ${fmt(JO[2][2])} ${u.I}`, 'ok', out, S, { mode: 'inertia', b, pr });
  }

  /* ---------------- angular momentum and kinetic energy ---------------- */
  function momentum(st, u) {
    const err = [], S = Steps(), b = body(st, u, S, err), ch = b ? chain(st, S, err) : null;
    if (!b || !ch) return fail(err);
    chainSteps(S, ch);
    const { m, G, JG } = b, pg = pointOf(ch, G), vG = pg.v, w = ch.W;
    const HG = mv(JG, w), HO = add(cross(G, mul(vG, m)), HG), T = 0.5 * m * dot(vG, vG) + 0.5 * dot(w, HG);
    S.add({ t: 'Velocity of the centre of mass', f: 'v_G = v_B + ω × r_G/B', r: `v_G = ${vs(vG, u.V)}` });
    S.add({ t: 'Angular momentum about G', f: 'H_x = I_xx ω_x − I_xy ω_y − I_xz ω_z,  H_y = −I_yx ω_x + I_yy ω_y − I_yz ω_z,  H_z = −I_zx ω_x − I_zy ω_y + I_zz ω_z', r: `H_G = ${vs(HG, u.I + '/s')}` });
    S.add({ t: 'Angular momentum about O', f: 'H_O = r_G/O × m v_G + H_G', s: `(${vs(G)}) × ${fmt(m)}(${vs(vG)}) + ${vs(HG)}`, r: `H_O = ${vs(HO, u.I + '/s')}` });
    S.add({ t: 'Kinetic energy', f: 'T = ½ m v_G² + ½ ω · H_G', s: `T = ½(${fmt(m)})(${fmt(len(vG))})² + ½(${fmt(dot(w, HG))})`, r: `T = ${fmt(T)} ${u.E}` });
    const out = [];
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `ω_${c}`, v: w[i], u: 'rad/s' }));
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `H_G,${c}`, v: HG[i], u: u.I + '/s' }));
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `H_O,${c}`, v: HO[i], u: u.I + '/s', hl: true }));
    out.push({ k: '|H_O|', v: len(HO), u: u.I + '/s' }, { k: 'Kinetic energy T', v: T, u: u.E, hl: true });
    return DY.result(`T = ${fmt(T)} ${u.E}`, 'ok', out, S, { mode: 'mom', b, ch, HG, HO, vG });
  }

  /* ---------------- equations of motion ---------------- */
  function euler(st, u) {
    const err = [], S = Steps(), b = body(st, u, S, err), ch = b ? chain(st, S, err) : null;
    if (!b || !ch) return fail(err);
    chainSteps(S, ch);
    const { m, G, JG } = b, pg = pointOf(ch, G), aG = pg.a, w = ch.W, al = ch.A;
    const Fr = mul(aG, m), Iw = mv(JG, w), Mr = add(mv(JG, al), cross(w, Iw));
    S.add({ t: 'Acceleration of the centre of mass', f: 'a_G = a_B + α × r + ω × (ω × r)', r: `a_G = ${vs(aG, u.A)}` });
    S.add({ t: 'Moment equation about G', n: 'With x, y, z fixed in the body at this instant (Ω = ω) the equations of motion are ΣM_G = I_G α + ω × (I_G ω). For principal axes these are Euler’s equations: ΣM_x = I_x α_x − (I_y − I_z) ω_y ω_z, and so on.', f: 'ΣM_G = I_G α + ω × (I_G ω)', s: `I_G α = ${vs(mv(JG, al))},  ω × (I_G ω) = ${vs(cross(w, Iw))}`, r: `ΣM_G = ${vs(Mr, u.MO)}` });
    S.add({ t: 'Force equation', f: 'ΣF = m a_G', r: `ΣF = ${vs(Fr, u.F)}` });
    const W = st.grav ? [0, 0, -m * u.g] : [0, 0, 0];
    const out = [];
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `Required ΣM_G,${c}`, v: Mr[i], u: u.MO, hl: st.sup !== 'brg' }));
    ['x', 'y', 'z'].forEach((c, i) => out.push({ k: `Required ΣF_${c}`, v: Fr[i], u: u.F }));
    let reac = null;
    if (st.sup === 'brg') {
      const A = V3(st.A, ''), B = V3(st.B, ''), e = unit(sub(B, A));
      if (!e) return fail('The bearings A and B must be at different points.');
      const t = Math.abs(e[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = unit(cross(cross(e, t), e)), e2 = cross(e, e1);
      // unknowns: A·e1, A·e2, B·e1, B·e2, thrust along e, torque T about e
      const cols = [], rA = sub(A, G), rB = sub(B, G);
      const col = (f, r) => cols.push(f.concat(cross(r, f)));
      col(e1, rA); col(e2, rA); col(e1, rB); col(e2, rB);
      const thr = st.thrust === 'B' ? rB : rA; if (st.thrust !== 'none') col(e, thr);
      cols.push([0, 0, 0].concat(e));
      const rhs = Fr.concat(Mr).map((v, i) => v - (i < 3 ? W[i] : 0));
      const Amat = [0, 1, 2, 3, 4, 5].map((i) => cols.map((c) => c[i]));
      const sol = Core.linSolve(Amat, rhs);
      if (!sol.consistent || sol.rank < cols.length) return fail(st.thrust === 'none' ? 'Without a thrust bearing nothing resists a force along the shaft; choose a thrust bearing at A or B.' : 'The bearings cannot hold the body in this arrangement.');
      const x = sol.x, RA = add(add(mul(e1, x[0]), mul(e2, x[1])), st.thrust === 'A' ? mul(e, x[4]) : [0, 0, 0]), RB = add(add(mul(e1, x[2]), mul(e2, x[3])), st.thrust === 'B' ? mul(e, x[4]) : [0, 0, 0]), Tq = x[cols.length - 1];
      S.add({ t: 'Bearing reactions', n: `Journal bearings at A and B push across the shaft; the thrust bearing${st.thrust === 'none' ? '' : ' at ' + st.thrust} also takes the force along it. A torque T about the shaft keeps the motion as given.${st.grav ? ' The weight acts at G.' : ''}`, f: 'A + B + W = m a_G,  r_A/G × A + r_B/G × B + T e = ΣM_G', r: `A = ${vs(RA, u.F)}, B = ${vs(RB, u.F)}, T = ${fmt(Tq)} ${u.MO}` });
      ['x', 'y', 'z'].forEach((c, i) => out.unshift({ k: `B_${c}`, v: RB[i], u: u.F, hl: true }));
      ['x', 'y', 'z'].forEach((c, i) => out.unshift({ k: `A_${c}`, v: RA[i], u: u.F, hl: true }));
      out.splice(6, 0, { k: '|A|', v: len(RA), u: u.F }, { k: '|B|', v: len(RB), u: u.F }, { k: 'Torque on the shaft T', v: Tq, u: u.MO });
      reac = { A, B, RA, RB, Tq, e };
    }
    return DY.result(reac ? `|A| = ${fmt(len(reac.RA))}, |B| = ${fmt(len(reac.RB))} ${u.F}` : `|ΣM_G| = ${fmt(len(Mr))} ${u.MO}`, 'ok', out, S, { mode: 'euler', b, ch, Mr, Fr, aG, reac, W });
  }

  /* ---------------- steady precession ---------------- */
  function gyro(st, u) {
    const q = st.gy, S = Steps(), err = [], rf = RATE[st.ru] || 1, ru = st.ru || 'rad/s';
    const m = DY.toBase(+q.m, 'M', u), I = m * q.kt * q.kt, Iz = m * q.kz * q.kz;
    if (!(m > 0)) err.push(`Enter the ${u.us ? 'weight' : 'mass'}.`);
    if (!(+q.kz > 0 && +q.kt > 0)) err.push('Both radii of gyration must be positive.');
    if (err.length) return fail(err);
    const W = m * u.g, wt = q.mom === 'weight';
    let th = +q.th * D2R, ph = +q.prec * rf, ps = +q.spin * rf, M0 = +q.M;
    const Mof = (t) => (wt ? W * q.rG * Math.sin(t) : M0);
    const rhs = (t, p, s) => -I * p * p * Math.sin(t) * Math.cos(t) + Iz * p * Math.sin(t) * (p * Math.cos(t) + s);
    S.add({ t: 'Moments of inertia', n: 'I is about a transverse axis through the fixed point O (or through G when there is none); I_z is about the axis of symmetry.', f: 'I = m k_t²,  I_z = m k_z²', r: `I = ${fmt(I)} ${u.I}, I_z = ${fmt(Iz)} ${u.I}` });
    S.add({ t: 'Steady precession', n: 'θ, φ̇ (precession) and ψ̇ (spin) are constant. The moment about the x axis (the line of nodes, perpendicular to the plane of Z and z) is the only one needed.', f: 'ΣM_x = −I φ̇² sin θ cos θ + I_z φ̇ sin θ (φ̇ cos θ + ψ̇)' + (wt ? ',   ΣM_x = W r_G sin θ' : '') });
    const out = [];
    let roots = null;
    if (q.unk === 'spin') {
      if (Math.abs(ph * Math.sin(th)) < 1e-12) return fail('With no precession (or θ = 0°) the spin is not fixed by the moment equation.');
      ps = (Mof(th) + I * ph * ph * Math.sin(th) * Math.cos(th)) / (Iz * ph * Math.sin(th)) - ph * Math.cos(th);
      S.add({ t: 'Spin', f: 'ψ̇ = (M_x + I φ̇² sin θ cos θ)/(I_z φ̇ sin θ) − φ̇ cos θ', r: `ψ̇ = ${fmt(ps / rf)} ${ru}` });
    } else if (q.unk === 'prec') {
      const sn = Math.sin(th), c = Math.cos(th);
      roots = DY.quad((Iz - I) * sn * c, Iz * sn * ps, -Mof(th));
      if (!roots.length) return fail('No steady precession is possible: the spin is too slow for this moment.');
      ph = roots[0];
      S.add({ t: 'Precession', n: roots.length > 1 ? 'A quadratic in φ̇: the slower root is the one usually seen; the faster one is also a steady motion.' : 'The equation is linear in φ̇ here.', f: '(I_z − I) sin θ cos θ φ̇² + I_z ψ̇ sin θ φ̇ − M_x = 0', r: roots.map((r) => `φ̇ = ${fmt(r / rf)} ${ru}`).join(' or ') });
      if (roots.length > 1) { const sl = Math.abs(roots[0]) <= Math.abs(roots[1]) ? 0 : 1; ph = roots[sl]; roots = [roots[sl], roots[1 - sl]]; }
    } else if (q.unk === 'theta') {
      let sol = [];
      if (wt) {
        const den = (Iz - I) * ph * ph;
        if (Math.abs(den) < 1e-15) return fail('θ cannot be found: (I_z − I)φ̇² is zero.');
        const c = (W * q.rG - Iz * ph * ps) / den;
        if (Math.abs(c) > 1) return fail(`No steady angle: cos θ would be ${fmt(c)}.`);
        sol = [Math.acos(c)];
        S.add({ t: 'Angle', n: 'sin θ cancels from both sides (θ ≠ 0).', f: 'W r_G = −I φ̇² cos θ + I_z φ̇(φ̇ cos θ + ψ̇)  ⇒  cos θ = (W r_G − I_z φ̇ ψ̇)/((I_z − I) φ̇²)', r: `θ = ${fmt(sol[0] / D2R)}°` });
      } else {
        sol = DY.rootsOf((t) => rhs(t, ph, ps) - M0, 1e-6, Math.PI - 1e-6, 720);
        if (!sol.length) return fail('No angle between 0° and 180° gives this moment.');
        S.add({ t: 'Angle', f: 'M_x = −I φ̇² sin θ cos θ + I_z φ̇ sin θ (φ̇ cos θ + ψ̇)', r: sol.map((t) => `θ = ${fmt(t / D2R)}°`).join(' or ') });
      }
      th = sol[0];
      out.push(...sol.map((t, i) => ({ k: `Angle θ${sol.length > 1 ? ' ' + (i + 1) : ''}`, v: t / D2R, u: '°', hl: true })));
    } else {
      M0 = rhs(th, ph, ps);
      S.add({ t: 'Moment needed', f: 'M_x = −I φ̇² sin θ cos θ + I_z φ̇ sin θ (φ̇ cos θ + ψ̇)', r: `M_x = ${fmt(M0)} ${u.MO}` });
    }
    if (q.unk === 'spin') out.push({ k: 'Spin ψ̇', v: ps / rf, u: ru, hl: true });
    if (q.unk === 'prec') roots.forEach((r, i) => out.push({ k: i ? 'Precession φ̇ (fast)' : 'Precession φ̇', v: r / rf, u: ru, hl: !i }));
    if (q.unk === 'M') out.push({ k: 'Moment M_x', v: M0, u: u.MO, hl: true });
    const Mx = q.unk === 'M' ? M0 : Mof(th), w = [0, ph * Math.sin(th), ph * Math.cos(th) + ps];
    out.push({ k: 'Check: moment of the forces M_x', v: Mx, u: u.MO }, { k: 'ω_y (transverse)', v: w[1], u: 'rad/s' }, { k: 'ω_z (along the axis)', v: w[2], u: 'rad/s' });
    if (q.unk !== 'theta') out.push({ k: 'Angle θ', v: th / D2R, u: '°' });
    return DY.result('Steady precession', 'ok', out, S, { mode: 'gyro', th, ph, ps, I, Iz, Mx, W, rG: +q.rG, wt });
  }

  /* ---------------- torque-free motion ---------------- */
  function torqueFree(st, u) {
    const q = st.fr, S = Steps(), rf = RATE[st.ru] || 1, ru = st.ru || 'rad/s';
    const m = DY.toBase(+q.m, 'M', u), I = m * q.kt * q.kt, Iz = m * q.kz * q.kz, th = +q.th * D2R;
    if (!(m > 0 && +q.kt > 0 && +q.kz > 0)) return fail('Enter a positive mass and radii of gyration.');
    if (!(th >= 0 && th < Math.PI / 2)) return fail('θ must be between 0° and 90°.');
    let H;
    S.add({ t: 'Moments of inertia about G', f: 'I = m k_t²,  I_z = m k_z²', r: `I = ${fmt(I)}, I_z = ${fmt(Iz)} ${u.I}` });
    const lines = 'φ̇ = H_G / I,   ψ̇ = (I − I_z)/(I I_z) · H_G cos θ';
    if (q.given === 'H') H = +q.H;
    else if (q.given === 'prec') H = I * q.prec * rf;
    else { if (Math.abs(I - Iz) < 1e-12 * I || Math.cos(th) < 1e-12) return fail('With I = I_z (or θ = 90°) the spin does not fix the angular momentum.'); H = (q.spin * rf * I * Iz) / ((I - Iz) * Math.cos(th)); }
    const ph = H / I, ps = ((I - Iz) / (I * Iz)) * H * Math.cos(th), beta = Math.atan((Iz / I) * Math.tan(th)), wz = (H * Math.cos(th)) / Iz, wy = (H * Math.sin(th)) / I;
    S.add({ t: 'Torque-free motion', n: 'With no moment about G the angular momentum H_G is constant: the axis of symmetry precesses about H_G (the Z axis) at a constant angle θ.', f: lines, s: q.given === 'spin' ? `H_G = ψ̇ I I_z / ((I − I_z) cos θ) = ${fmt(H)}` : q.given === 'prec' ? `H_G = I φ̇ = ${fmt(H)}` : '', r: `H_G = ${fmt(H)} ${u.I}/s, φ̇ = ${fmt(ph / rf)} ${ru}, ψ̇ = ${fmt(ps / rf)} ${ru}` });
    S.add({ t: 'Angular velocity', n: `${I > Iz ? 'I > I_z: direct precession (spin and precession in the same sense; the body cone rolls outside the space cone).' : I < Iz ? 'I < I_z: retrograde precession (the body cone rolls inside the space cone).' : 'I = I_z: no precession of the axis relative to ω.'}`, f: 'ω_z = H_G cos θ / I_z,  ω_y = H_G sin θ / I,  tan θ = (I/I_z) tan β', r: `ω = ${fmt(Math.hypot(wz, wy))} rad/s at β = ${fmt(beta / D2R)}° from the axis` });
    const out = [{ k: 'Angular momentum H_G', v: H, u: u.I + '/s', hl: q.given !== 'H' }, { k: 'Precession φ̇', v: ph / rf, u: ru, hl: q.given !== 'prec' }, { k: 'Spin ψ̇', v: ps / rf, u: ru, hl: q.given !== 'spin' },
      { k: 'Angle β between ω and the axis', v: beta / D2R, u: '°' }, { k: '|ω|', v: Math.hypot(wz, wy), u: 'rad/s' }, { k: 'Precession is', v: I > Iz ? 'direct' : I < Iz ? 'retrograde' : 'none' }];
    return DY.result(`H_G = ${fmt(H)} ${u.I}/s`, 'ok', out, S, { mode: 'free', th, ph, ps, beta, I, Iz });
  }

  /** Position of a reference point x0 after the rotations turn by angles q (for Play). */
  function turn(rots, qs, x0) {
    let x = x0.slice();
    for (let i = rots.length - 1; i >= 0; i--) {
      const r = rots[i], k = unit(V3(r, 'u')); if (!k) continue;
      const p = V3(r, 'p'), v = sub(x, p), c = Math.cos(qs[i]), s = Math.sin(qs[i]);
      x = add(p, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))));
    }
    return x;
  }

  const Rb3d = { defaults, convertState, solve, SHAPES, RATE, turn, centreOf, partJ, eig3, vs, add, sub, mul, cross, len, unit, dot };
  root.Rb3d = Rb3d;
  if (typeof module !== 'undefined' && module.exports) module.exports = Rb3d;
})(typeof window !== 'undefined' ? window : globalThis);
