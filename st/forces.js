/* =====================================================================
 * STATICS · Force Systems (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapters 2 and 4.
 *   coplanar   resultant of coplanar forces (2.4, 2.5)
 *   vector3d   Cartesian vectors, magnitude and direction angles, force along a line (2.5 to 2.8)
 *   dot        component of a force along a line, angle between them (2.9)
 *   moment     moment of forces about a point (r × F) and about an axis (u · (r × F)) (4.1 to 4.5)
 *   reduce     coplanar system reduced to a force and couple at O, and to a single resultant (4.7, 4.8)
 *   reduce3d   3D system reduced to a force and couple at O, and to a wrench (4.7, 4.8)
 *   dist       resultant and location of distributed loads (4.9)
 * Forces are in the chosen force unit `fu`, lengths in m or ft.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps, sumStr } = Core;
  const DEG = Math.PI / 180;
  const MODES = ['coplanar', 'vector3d', 'dot', 'moment', 'reduce', 'reduce3d', 'dist'];

  const f3 = (o) => Object.assign({ by: 'comp', Fx: 0, Fy: 0, Fz: 0, F: 100, al: 60, be: 60, ga: 45, ax: 0, ay: 0, az: 0, bx: 1, by_: 1, bz: 1, x: 0, y: 0, z: 0 }, o);
  function defaults() {
    return {
      mode: 'coplanar', fu: 'N',
      co: { forces: [{ by: 'polar', F: 100, ang: 15, Fx: 0, Fy: 0, dx: 4, dy: 3 }, { by: 'polar', F: 150, ang: 80, Fx: 0, Fy: 0, dx: 4, dy: 3 }] },
      v3: { forces: [f3({ by: 'comp', Fx: 35.36, Fy: -35.36, Fz: 86.6 })] },
      dot: { force: f3({ by: 'line', F: 300, ax: 0, ay: 0, az: 0, bx: 2, by_: 3, bz: 6 }), P: { x: 0, y: 0, z: 0 }, Q: { x: 0, y: 4, z: 0 } },
      mom: { forces: [f3({ by: 'comp', Fx: 0, Fy: 0, Fz: 10, x: 2, y: 3, z: 0 })], O: { x: 0, y: 0, z: 0 }, axis: true, P: { x: 0, y: 0, z: 0 }, Q: { x: 1, y: 0, z: 0 } },
      red: {
        forces: [{ by: 'polar', F: 4, ang: 270, Fx: 0, Fy: 0, dx: 4, dy: 3, x: 1.5, y: 0 }, { by: 'comp', F: 8, ang: 0, Fx: 4.8, Fy: 6.4, dx: 4, dy: 3, x: 4.5, y: 0.5 }],
        couples: [{ M: 15, dir: 'cw', x: 3, y: 0 }], O: { x: 0, y: 0 },
      },
      r3: { forces: [f3({ by: 'comp', Fx: 0, Fy: 0, Fz: -800, x: 0, y: 0, z: 0 }), f3({ by: 'comp', Fx: 0, Fy: 0, Fz: -300, x: 4, y: 0, z: 0 }), f3({ by: 'comp', Fx: 0, Fy: 0, Fz: -500, x: 0, y: 2, z: 0 })], couples: [], O: { x: 0, y: 0, z: 0 } },
      dist: { segs: [{ x1: 0, x2: 9, w1: 100, w2: 50 }] },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Vector helpers                                                     */
  /* ------------------------------------------------------------------ */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mag = (a) => Math.hypot(a[0], a[1], a[2]);
  const clean = (a, s) => a.map((v) => (Math.abs(v) < 1e-12 * (s || 1) ? 0 : v));
  const vstr = (a, u) => `{${a.map((v, i) => (i === 0 ? fmt(v) : (v < 0 ? ' − ' : ' + ') + fmt(Math.abs(v))) + ['i', 'j', 'k'][i]).join('')}}${u ? ' ' + u : ''}`;
  const P3 = (p) => [+p.x || 0, +p.y || 0, +p.z || 0];
  const LETTER = (i) => 'ABCDEFGH'[i] || 'F' + (i + 1);

  /** Components of a coplanar force entered by magnitude and angle, by components, or by a slope triangle. */
  function comp2(f, name) {
    if (f.by === 'comp') {
      const Fx = +f.Fx, Fy = +f.Fy;
      if (!isFinite(Fx) || !isFinite(Fy)) return { err: `${name}: enter both components.` };
      return { Fx, Fy, F: Math.hypot(Fx, Fy), how: 'given as components' };
    }
    const F = +f.F;
    if (!(F >= 0) || !isFinite(F)) return { err: `${name}: the magnitude must be zero or more.` };
    if (f.by === 'slope') {
      const dx = +f.dx, dy = +f.dy, h = Math.hypot(dx, dy);
      if (!(h > 0)) return { err: `${name}: the slope triangle needs a run or a rise that is not zero.` };
      return { Fx: (F * dx) / h, Fy: (F * dy) / h, F, how: `F_x = ${fmt(F)}(${fmt(dx)}/${fmt(h)}), F_y = ${fmt(F)}(${fmt(dy)}/${fmt(h)})` };
    }
    const a = +f.ang;
    if (!isFinite(a)) return { err: `${name}: enter the angle.` };
    return { Fx: F * Math.cos(a * DEG), Fy: F * Math.sin(a * DEG), F, how: `F_x = ${fmt(F)} cos ${fmt(a)}°, F_y = ${fmt(F)} sin ${fmt(a)}°` };
  }
  /** Cartesian components of a 3D force entered by components, by direction angles, or along a line from A to B. */
  function comp3(f, name, Lu) {
    if (f.by === 'angles') {
      const F = +f.F, c = [+f.al, +f.be, +f.ga].map((a) => Math.cos(a * DEG)), s = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
      if (!(F >= 0)) return { err: `${name}: the magnitude must be zero or more.` };
      if (Math.abs(s - 1) > 0.002) return { err: `${name}: these direction angles are not possible, because cos²α + cos²β + cos²γ = ${fmt(s)} and it must equal 1.` };
      return { v: mul(c, F / Math.sqrt(s)), how: `F = ${fmt(F)}(cos ${fmt(+f.al)}° i + cos ${fmt(+f.be)}° j + cos ${fmt(+f.ga)}° k)` };
    }
    if (f.by === 'line') {
      const F = +f.F, r = [f.bx - f.ax, f.by_ - f.ay, f.bz - f.az].map(Number), L = mag(r);
      if (!(F >= 0)) return { err: `${name}: the magnitude must be zero or more.` };
      if (!(L > 0)) return { err: `${name}: the two points of the line are the same point.` };
      return { v: mul(r, F / L), how: `r = ${vstr(r, Lu)}, |r| = ${fmt(L)} ${Lu}, F = F(r/|r|) = ${fmt(F)}${vstr(mul(r, 1 / L))}`, r, L };
    }
    const v = [+f.Fx, +f.Fy, +f.Fz];
    if (v.some((x) => !isFinite(x))) return { err: `${name}: enter all three components.` };
    return { v, how: 'given as components' };
  }

  function solve(st, U) {
    const F = st.fu, Lu = U.len;
    const ctx = { F, Lu, FL: `${F}·${Lu}`, WL: `${F}/${Lu}` };
    switch (st.mode) {
      case 'vector3d': return vector3d(st, ctx);
      case 'dot': return dotMode(st, ctx);
      case 'moment': return moment(st, ctx);
      case 'reduce': return reduce(st, ctx);
      case 'reduce3d': return reduce3d(st, ctx);
      case 'dist': return dist(st, ctx);
      default: return coplanar(st, ctx);
    }
  }
  const ok = (text, out, S, geo, warn) => ({ ok: true, err: [], warn: warn || [], status: { cls: 'ok', text }, out, steps: S.list, geo });
  /** Direction of a coplanar vector, as the book states it. */
  function dir2(x, y) {
    const th = Math.atan2(y, x) / DEG, t = th < 0 ? th + 360 : th;
    const ref = Math.atan2(Math.abs(y), Math.abs(x)) / DEG;
    const side = (y >= 0 ? 'above' : 'below') + (x >= 0 ? ' +x' : ' −x');
    return { th: t, ref, txt: `${fmt(ref)}° ${side}` };
  }

  /* ------------------------------------------------------------------ */
  /* Coplanar resultant                                                 */
  /* ------------------------------------------------------------------ */
  function coplanar(st, c) {
    const fs = st.co.forces || [];
    if (!fs.length) return fail('Add at least one force.');
    const err = [], rows = fs.map((f, i) => { const r = comp2(f, `F${i + 1}`); if (r.err) err.push(r.err); return r; });
    if (err.length) return fail(err);
    const S = Steps(), out = [], { F } = c;
    S.add({ t: 'Rectangular components of each force', n: 'Each force is resolved along the x and y axes. A component pointing in −x or −y is negative.', table: { head: ['Force', `F (${F})`, 'How', `F_x (${F})`, `F_y (${F})`], rows: rows.map((r, i) => [`F${i + 1}`, fmt(r.F), r.how, fmt(r.Fx), fmt(r.Fy)]) } });
    const Rx = rows.reduce((s, r) => s + r.Fx, 0), Ry = rows.reduce((s, r) => s + r.Fy, 0), sc = Math.max(...rows.map((r) => r.F), 1e-300);
    const FRx = Math.abs(Rx) < 1e-12 * sc ? 0 : Rx, FRy = Math.abs(Ry) < 1e-12 * sc ? 0 : Ry, FR = Math.hypot(FRx, FRy);
    S.add({ t: 'Sum of the x components', f: '→+ (F_R)_x = ΣF_x', s: `(F_R)_x = ${sumStr(rows.map((r) => ({ v: r.Fx, txt: fmt(Math.abs(r.Fx)) })))}`, r: `(F_R)_x = ${fmt(FRx)} ${F}` });
    S.add({ t: 'Sum of the y components', f: '+↑ (F_R)_y = ΣF_y', s: `(F_R)_y = ${sumStr(rows.map((r) => ({ v: r.Fy, txt: fmt(Math.abs(r.Fy)) })))}`, r: `(F_R)_y = ${fmt(FRy)} ${F}` });
    const d = dir2(FRx, FRy);
    if (FR > 0) {
      S.add({ t: 'Magnitude of the resultant', f: 'F_R = √((F_R)_x² + (F_R)_y²)', s: `F_R = √(${fmt(FRx)}² + ${fmt(FRy)}²)`, r: `F_R = ${fmt(FR)} ${F}` });
      S.add({ t: 'Direction of the resultant', f: 'θ = tan⁻¹ |(F_R)_y / (F_R)_x|', s: `θ = tan⁻¹ (${fmt(Math.abs(FRy))} / ${fmt(Math.abs(FRx))})`, r: `θ = ${d.txt}, which is ${fmt(d.th)}° counterclockwise from +x` });
    } else S.add({ t: 'Resultant', n: 'The components cancel, so the forces are in balance.', r: 'F_R = 0' });
    out.push({ k: 'Resultant (F_R)_x', v: FRx, u: F }, { k: 'Resultant (F_R)_y', v: FRy, u: F }, { k: 'Resultant magnitude F_R', v: FR, u: F, hl: true });
    if (FR > 0) out.push({ k: 'Direction θ (↺ from +x)', v: d.th, u: '°', hl: true }, { k: 'Angle with the x axis', v: d.txt, u: '' });
    return ok(FR > 0 ? 'Resultant found' : 'Forces in balance', out, S, { kind: 'coplanar', c, vecs: rows.map((r) => [r.Fx, r.Fy]), R: [FRx, FRy], FR, th: d.th });
  }

  /* ------------------------------------------------------------------ */
  /* Cartesian vectors                                                  */
  /* ------------------------------------------------------------------ */
  function vector3d(st, c) {
    const fs = st.v3.forces || [];
    if (!fs.length) return fail('Add at least one force.');
    const err = [], rows = fs.map((f, i) => { const r = comp3(f, `F${i + 1}`, c.Lu); if (r.err) err.push(r.err); return r; });
    if (err.length) return fail(err);
    const S = Steps(), out = [], { F } = c;
    S.add({ t: 'Each force as a Cartesian vector', table: { head: ['Force', 'How', `F_x (${F})`, `F_y (${F})`, `F_z (${F})`], rows: rows.map((r, i) => [`F${i + 1}`, r.how, fmt(r.v[0]), fmt(r.v[1]), fmt(r.v[2])]) } });
    let R = rows.reduce((s, r) => add(s, r.v), [0, 0, 0]);
    R = clean(R, Math.max(...rows.map((r) => mag(r.v)), 1e-300));
    const FR = mag(R), one = rows.length === 1;
    if (!one) S.add({ t: 'Resultant', f: 'F_R = ΣF = ΣF_x i + ΣF_y j + ΣF_z k', r: `F_R = ${vstr(R, F)}` });
    S.add({ t: one ? 'Magnitude' : 'Magnitude of the resultant', f: 'F = √(F_x² + F_y² + F_z²)', s: `F = √(${R.map((v) => fmt(v) + '²').join(' + ')})`, r: `F = ${fmt(FR)} ${F}` });
    const ang = R.map((v) => (FR > 0 ? Math.acos(Math.max(-1, Math.min(1, v / FR))) / DEG : NaN));
    if (FR > 0) {
      S.add({ t: 'Unit vector and coordinate direction angles', f: 'u = F/F = cos α i + cos β j + cos γ k', s: `u = ${vstr(mul(R, 1 / FR))}`, r: `α = ${fmt(ang[0])}°, β = ${fmt(ang[1])}°, γ = ${fmt(ang[2])}°`, n: `Check: cos²α + cos²β + cos²γ = ${fmt(R.reduce((s, v) => s + (v / FR) ** 2, 0))}.` });
    }
    const p = one ? 'F' : 'F_R';
    out.push({ k: `${p}_x`, v: R[0], u: F }, { k: `${p}_y`, v: R[1], u: F }, { k: `${p}_z`, v: R[2], u: F }, { k: `Magnitude ${p}`, v: FR, u: F, hl: true });
    if (FR > 0) out.push({ k: 'Direction angle α (from +x)', v: ang[0], u: '°', hl: true }, { k: 'Direction angle β (from +y)', v: ang[1], u: '°', hl: true }, { k: 'Direction angle γ (from +z)', v: ang[2], u: '°', hl: true });
    return ok(one ? 'Cartesian vector' : 'Resultant found', out, S, { kind: 'vector3d', c, vecs: rows.map((r) => r.v), R, FR, lines: fs.map((f, i) => (f.by === 'line' ? { A: [+f.ax, +f.ay, +f.az], B: [+f.bx, +f.by_, +f.bz] } : null)) });
  }

  /* ------------------------------------------------------------------ */
  /* Component of a force along a line                                  */
  /* ------------------------------------------------------------------ */
  function dotMode(st, c) {
    const q = st.dot, r = comp3(q.force, 'The force', c.Lu);
    if (r.err) return fail(r.err);
    const P = P3(q.P), Q = P3(q.Q), d = sub(Q, P), L = mag(d), Fv = r.v, Fm = mag(Fv), { F, Lu } = c;
    if (!(L > 0)) return fail('The two points of the line are the same point.');
    if (!(Fm > 0)) return fail('The force is zero, so it has no direction.');
    const u = mul(d, 1 / L), Fpar = dot(Fv, u), th = Math.acos(Math.max(-1, Math.min(1, Fpar / Fm))) / DEG, Fperp = Math.sqrt(Math.max(0, Fm * Fm - Fpar * Fpar));
    const S = Steps();
    S.add({ t: 'The force as a Cartesian vector', n: r.how, r: `F = ${vstr(Fv, F)}, |F| = ${fmt(Fm)} ${F}` });
    S.add({ t: 'Unit vector along the line', f: 'u = r_PQ / |r_PQ|', s: `r_PQ = ${vstr(d, Lu)}, |r_PQ| = ${fmt(L)} ${Lu}`, r: `u = ${vstr(u)}` });
    S.add({ t: 'Component of the force parallel to the line', f: 'F_∥ = F · u = F_x u_x + F_y u_y + F_z u_z', s: `F_∥ = ${Fv.map((v, i) => `(${fmt(v)})(${fmt(u[i])})`).join(' + ')}`, r: `F_∥ = ${fmt(Fpar)} ${F}`, n: Fpar < 0 ? 'The negative sign means the component points from Q toward P.' : undefined });
    S.add({ t: 'Angle between the force and the line', f: 'θ = cos⁻¹ (F · u / F)', s: `θ = cos⁻¹ (${fmt(Fpar)} / ${fmt(Fm)})`, r: `θ = ${fmt(th)}°` });
    S.add({ t: 'Component perpendicular to the line', f: 'F_⊥ = √(F² − F_∥²)', s: `F_⊥ = √(${fmt(Fm)}² − ${fmt(Fpar)}²)`, r: `F_⊥ = ${fmt(Fperp)} ${F}` });
    const out = [{ k: 'Magnitude of the force F', v: Fm, u: F }, { k: 'Component along the line F_∥', v: Fpar, u: F, hl: true }, { k: 'Component perpendicular to the line F_⊥', v: Fperp, u: F, hl: true }, { k: 'Angle θ between the force and the line', v: th, u: '°', hl: true }, { k: 'F_∥ as a vector', v: vstr(clean(mul(u, Fpar), Fm)), u: F }];
    const A = q.force.by === 'line' ? [+q.force.ax, +q.force.ay, +q.force.az] : P;
    return ok('Projection along a line', out, S, { kind: 'dot', c, Fv, A, P, Q, u, Fpar, Fperp, th });
  }

  /* ------------------------------------------------------------------ */
  /* Moments about a point and about an axis                            */
  /* ------------------------------------------------------------------ */
  function moment(st, c) {
    const q = st.mom, fs = q.forces || [], { F, Lu, FL } = c;
    if (!fs.length) return fail('Add at least one force.');
    const err = [], rows = fs.map((f, i) => { const r = comp3(f, `F${i + 1}`, Lu); if (r.err) err.push(r.err); return Object.assign(r, { p: P3(f) }); });
    if (err.length) return fail(err);
    const O = P3(q.O), S = Steps(), out = [];
    const planar = rows.every((r) => Math.abs(r.v[2]) < 1e-12 && Math.abs(r.p[2] - O[2]) < 1e-12);
    const sc = Math.max(...rows.map((r) => mag(r.v) * (mag(sub(r.p, O)) || 1)), 1e-300);
    rows.forEach((r, i) => { r.r = sub(r.p, O); r.M = clean(cross(r.r, r.v), sc); r.name = `F${i + 1}`; });
    if (planar) {
      S.add({
        t: 'Moment of each force about O (scalar form)', n: 'All forces lie in the x–y plane, so each moment is about the z axis. M_O = x F_y − y F_x, counterclockwise positive, with x and y measured from O. The moment arm d = |M_O| / F.',
        table: { head: ['Force', `x (${Lu})`, `y (${Lu})`, `F_x (${F})`, `F_y (${F})`, `M_O (${FL})`, `d (${Lu})`], rows: rows.map((r) => [r.name, fmt(r.r[0]), fmt(r.r[1]), fmt(r.v[0]), fmt(r.v[1]), fmt(r.M[2]), mag(r.v) > 0 ? fmt(Math.abs(r.M[2]) / mag(r.v)) : '—']) },
      });
    } else {
      rows.forEach((r) => S.add({ t: `Moment of ${r.name} about O`, f: `M_O = r × F = | i  j  k ; r_x  r_y  r_z ; F_x  F_y  F_z |`, s: `r = ${vstr(r.r, Lu)},  F = ${vstr(r.v, F)}`, r: `M_O = ${vstr(r.M, FL)}`, n: r.how !== 'given as components' ? r.how : undefined }));
    }
    const MO = clean(rows.reduce((s, r) => add(s, r.M), [0, 0, 0]), sc), MOm = mag(MO);
    if (planar) S.add({ t: 'Check with the moment arm', f: 'M_O = F d, where d is the perpendicular distance from O to the line of action', s: rows.map((r) => `${r.name}: ${fmt(mag(r.v))} × ${mag(r.v) > 0 ? fmt(Math.abs(r.M[2]) / mag(r.v)) : '0'} = ${fmt(Math.abs(r.M[2]))}`).join(';  '), n: 'The sign comes from the sense of rotation the force tends to give about O: counterclockwise is positive.' });
    S.add({ t: 'Resultant moment about O', f: 'M_O = Σ(r × F)', r: planar ? `M_O = ${fmt(MO[2])} ${FL} (${MO[2] >= 0 ? 'counterclockwise' : 'clockwise'})` : `M_O = ${vstr(MO, FL)}, |M_O| = ${fmt(MOm)} ${FL}` });
    if (planar) out.push({ k: 'Moment about O, M_O (↺ positive)', v: MO[2], u: FL, hl: true });
    else out.push({ k: 'M_O x component', v: MO[0], u: FL }, { k: 'M_O y component', v: MO[1], u: FL }, { k: 'M_O z component', v: MO[2], u: FL }, { k: 'Magnitude |M_O|', v: MOm, u: FL, hl: true });
    let axis = null;
    if (q.axis) {
      const P = P3(q.P), Q = P3(q.Q), d = sub(Q, P), L = mag(d);
      if (!(L > 0)) return fail('The two points that define the axis are the same point.');
      const u = mul(d, 1 / L);
      const Ma = rows.reduce((s, r) => s + dot(u, cross(sub(r.p, P), r.v)), 0), Mav = clean(mul(u, Ma), sc);
      S.add({ t: 'Unit vector along the axis', f: 'u_a = r_PQ / |r_PQ|', s: `r_PQ = ${vstr(d, Lu)}`, r: `u_a = ${vstr(u)}` });
      S.add({ t: 'Moment about the axis', f: 'M_a = u_a · (r × F), with r from any point on the axis (P) to the force', s: rows.map((r) => `u_a · (${vstr(sub(r.p, P))} × ${vstr(r.v)})`).join(' + '), r: `M_a = ${fmt(Math.abs(Ma) < 1e-12 * sc ? 0 : Ma)} ${FL}`, n: 'A positive M_a acts along +u_a by the right-hand rule. A force parallel to the axis, or one whose line of action passes through it, gives no moment about it.' });
      out.push({ k: 'Moment about the axis M_a (along +u_a)', v: Math.abs(Ma) < 1e-12 * sc ? 0 : Ma, u: FL, hl: true }, { k: 'M_a as a vector', v: vstr(Mav), u: FL });
      axis = { P, Q, u, Ma };
    }
    return ok(planar ? 'Moment about a point' : 'Moments in 3D', out, S, { kind: 'moment', c, rows: rows.map((r) => ({ v: r.v, p: r.p, M: r.M })), O, MO, planar, axis });
  }

  /* ------------------------------------------------------------------ */
  /* Coplanar force and couple system                                   */
  /* ------------------------------------------------------------------ */
  function reduce(st, c) {
    const q = st.red, fs = q.forces || [], cs = q.couples || [], { F, Lu, FL } = c;
    if (!fs.length && !cs.length) return fail('Add at least one force or couple.');
    const err = [], rows = fs.map((f, i) => { const r = comp2(f, `F${i + 1}`); if (r.err) err.push(r.err); if (!isFinite(+f.x) || !isFinite(+f.y)) err.push(`F${i + 1}: enter the point where it acts.`); return Object.assign(r, { x: +f.x, y: +f.y }); });
    cs.forEach((m, i) => { if (!(+m.M >= 0)) err.push(`Couple ${i + 1}: the magnitude must be zero or more (choose the direction separately).`); });
    if (err.length) return fail(err);
    const O = [+q.O.x || 0, +q.O.y || 0], S = Steps(), out = [];
    rows.forEach((r) => { r.dx = r.x - O[0]; r.dy = r.y - O[1]; r.M = r.dx * r.Fy - r.dy * r.Fx; });
    const cm = cs.map((m) => (m.dir === 'ccw' ? 1 : -1) * +m.M);
    const sc = Math.max(...rows.map((r) => r.F * (Math.hypot(r.dx, r.dy) || 1)), ...cm.map(Math.abs), 1e-300), scF = Math.max(...rows.map((r) => r.F), 1e-300);
    if (rows.length) S.add({ t: 'Components of each force and its moment about O', n: 'M = x F_y − y F_x with x and y measured from O, counterclockwise positive.', table: { head: ['Force', 'How', `F_x (${F})`, `F_y (${F})`, `x (${Lu})`, `y (${Lu})`, `M_O (${FL})`], rows: rows.map((r, i) => [`F${i + 1}`, r.how, fmt(r.Fx), fmt(r.Fy), fmt(r.dx), fmt(r.dy), fmt(r.M)]) } });
    let Rx = rows.reduce((s, r) => s + r.Fx, 0), Ry = rows.reduce((s, r) => s + r.Fy, 0);
    if (Math.abs(Rx) < 1e-12 * scF) Rx = 0; if (Math.abs(Ry) < 1e-12 * scF) Ry = 0;
    let MR = rows.reduce((s, r) => s + r.M, 0) + cm.reduce((s, v) => s + v, 0);
    if (Math.abs(MR) < 1e-12 * sc) MR = 0;
    const FR = Math.hypot(Rx, Ry), d = dir2(Rx, Ry);
    S.add({ t: 'Force summation', f: '→+ (F_R)_x = ΣF_x,  +↑ (F_R)_y = ΣF_y', s: `(F_R)_x = ${sumStr(rows.map((r) => ({ v: r.Fx, txt: fmt(Math.abs(r.Fx)) })))},  (F_R)_y = ${sumStr(rows.map((r) => ({ v: r.Fy, txt: fmt(Math.abs(r.Fy)) })))}`, r: `(F_R)_x = ${fmt(Rx)} ${F}, (F_R)_y = ${fmt(Ry)} ${F}` });
    if (FR > 0) S.add({ t: 'Resultant force', f: 'F_R = √((F_R)_x² + (F_R)_y²),  θ = tan⁻¹ |(F_R)_y / (F_R)_x|', s: `F_R = √(${fmt(Rx)}² + ${fmt(Ry)}²)`, r: `F_R = ${fmt(FR)} ${F}, θ = ${d.txt}` });
    const mterms = rows.map((r) => ({ v: r.M, txt: fmt(Math.abs(r.M)) })).concat(cm.map((v) => ({ v, txt: fmt(Math.abs(v)) })));
    S.add({ t: 'Moment summation about O', f: '↺+ (M_R)_O = ΣM_O + ΣM', s: `(M_R)_O = ${sumStr(mterms)}`, r: `(M_R)_O = ${fmt(MR)} ${FL} (${MR >= 0 ? 'counterclockwise' : 'clockwise'})`, n: cs.length ? 'A couple moment is a free vector, so it adds directly wherever it acts.' : undefined });
    out.push({ k: 'Resultant (F_R)_x', v: Rx, u: F }, { k: 'Resultant (F_R)_y', v: Ry, u: F }, { k: 'Resultant force F_R', v: FR, u: F, hl: true });
    if (FR > 0) out.push({ k: 'Direction θ (↺ from +x)', v: d.th, u: '°' });
    out.push({ k: 'Couple moment at O, (M_R)_O (↺ positive)', v: MR, u: FL, hl: true });
    let line = null;
    if (FR > 0) {
      // single resultant: its line of action has moment MR about O
      const hit = {};
      if (Ry) { hit.x = O[0] + MR / Ry; }
      if (Rx) { hit.y = O[1] - MR / Rx; }
      const dperp = Math.abs(MR) / FR;
      S.add({ t: 'Single resultant force', n: 'Move F_R so that its moment about O equals (M_R)_O. Its perpendicular distance from O is d = |(M_R)_O| / F_R.', f: Ry ? '(M_R)_O = (F_R)_y · d_x  (where the line crosses y = y_O)' : '(M_R)_O = −(F_R)_x · d_y  (where the line crosses x = x_O)', s: Ry ? `${fmt(MR)} = ${fmt(Ry)} d_x` : `${fmt(MR)} = ${fmt(-Rx)} d_y`, r: (Ry ? `d_x = ${fmt(hit.x - O[0])} ${Lu}` : `d_y = ${fmt(hit.y - O[1])} ${Lu}`) + `, perpendicular distance d = ${fmt(dperp)} ${Lu}` });
      if (Ry) out.push({ k: 'Line of action crosses the horizontal through O at x', v: hit.x, u: Lu, hl: true });
      if (Rx) out.push({ k: 'Line of action crosses the vertical through O at y', v: hit.y, u: Lu });
      out.push({ k: 'Perpendicular distance from O to the line of action', v: dperp, u: Lu });
      line = { hit, dperp };
    } else if (MR) {
      S.add({ t: 'Single resultant', n: 'The forces add to zero, so the system reduces to a single couple moment. It has the same effect wherever it is placed.', r: `M_R = ${fmt(MR)} ${FL}` });
    } else S.add({ t: 'Single resultant', n: 'Both the resultant force and the resultant moment are zero, so the system is in equilibrium.', r: 'F_R = 0, M_R = 0' });
    return ok(FR > 0 ? 'Force and couple at O' : MR ? 'Reduces to a couple' : 'System in equilibrium', out, S, { kind: 'reduce', c, rows: rows.map((r) => ({ Fx: r.Fx, Fy: r.Fy, x: r.x, y: r.y, F: r.F })), couples: cs.map((m, i) => ({ M: cm[i], x: +m.x || 0, y: +m.y || 0 })), O, R: [Rx, Ry], FR, MR, line, th: d.th });
  }

  /* ------------------------------------------------------------------ */
  /* 3D force and couple system, wrench                                 */
  /* ------------------------------------------------------------------ */
  function reduce3d(st, c) {
    const q = st.r3, fs = q.forces || [], cs = q.couples || [], { F, Lu, FL } = c;
    if (!fs.length && !cs.length) return fail('Add at least one force or couple.');
    const err = [], rows = fs.map((f, i) => { const r = comp3(f, `F${i + 1}`, Lu); if (r.err) err.push(r.err); return Object.assign(r, { p: P3(f) }); });
    const cv = cs.map((m, i) => { const v = [+m.Mx, +m.My, +m.Mz]; if (v.some((x) => !isFinite(x))) err.push(`Couple ${i + 1}: enter all three components.`); return v; });
    if (err.length) return fail(err);
    const O = P3(q.O), S = Steps(), out = [];
    const sc = Math.max(...rows.map((r) => mag(r.v) * (mag(sub(r.p, O)) || 1)), ...cv.map(mag), 1e-300), scF = Math.max(...rows.map((r) => mag(r.v)), 1e-300);
    rows.forEach((r, i) => { r.r = sub(r.p, O); r.M = clean(cross(r.r, r.v), sc); });
    if (rows.length) S.add({ t: 'Each force and its moment about O', n: 'M = r × F, with r from O to any point on the line of action of the force.', table: { head: ['Force', `F (${F})`, `r from O (${Lu})`, `r × F (${FL})`], rows: rows.map((r, i) => [`F${i + 1}`, vstr(r.v), vstr(r.r), vstr(r.M)]) } });
    const FRv = clean(rows.reduce((s, r) => add(s, r.v), [0, 0, 0]), scF), FR = mag(FRv);
    const MRv = clean(add(rows.reduce((s, r) => add(s, r.M), [0, 0, 0]), cv.reduce((s, v) => add(s, v), [0, 0, 0])), sc), MR = mag(MRv);
    S.add({ t: 'Resultant force', f: 'F_R = ΣF', r: `F_R = ${vstr(FRv, F)}, |F_R| = ${fmt(FR)} ${F}` });
    S.add({ t: 'Resultant couple moment at O', f: '(M_R)_O = ΣM_C + Σ(r × F)', r: `(M_R)_O = ${vstr(MRv, FL)}, |(M_R)_O| = ${fmt(MR)} ${FL}`, n: cs.length ? 'Couple moments are free vectors and add directly.' : undefined });
    out.push({ k: '(F_R)_x', v: FRv[0], u: F }, { k: '(F_R)_y', v: FRv[1], u: F }, { k: '(F_R)_z', v: FRv[2], u: F }, { k: 'Resultant force |F_R|', v: FR, u: F, hl: true },
      { k: '(M_R)_O x component', v: MRv[0], u: FL }, { k: '(M_R)_O y component', v: MRv[1], u: FL }, { k: '(M_R)_O z component', v: MRv[2], u: FL }, { k: 'Couple moment |(M_R)_O|', v: MR, u: FL, hl: true });
    let wrench = null;
    if (FR > 0) {
      const u = mul(FRv, 1 / FR), Mpar = dot(MRv, u), pt = clean(add(O, mul(cross(FRv, MRv), 1 / (FR * FR))), Math.max(mag(O), 1) * 1e-3);
      const perp = Math.abs(Mpar) < 1e-9 * Math.max(MR, 1e-300) ? 0 : Mpar;
      S.add({ t: 'Split the couple moment along and across F_R', f: 'M_∥ = (M_R)_O · u,  u = F_R / |F_R|', s: `u = ${vstr(u)}`, r: `M_∥ = ${fmt(perp)} ${FL}, M_⊥ = ${fmt(Math.sqrt(Math.max(0, MR * MR - perp * perp)))} ${FL}` });
      S.add({ t: perp ? 'Wrench' : 'Single resultant force', n: perp ? 'M_⊥ is removed by moving F_R to a parallel axis; M_∥ stays as a couple along that axis. Together they form a wrench.' : 'The couple moment is perpendicular to F_R, so moving F_R removes it completely and the system reduces to a single force.', f: 'point on the axis: r_P = r_O + (F_R × (M_R)_O) / F_R²', r: `point (${pt.map(fmt).join(', ')}) ${Lu}` + (perp ? `, wrench couple ${fmt(perp)} ${FL}, pitch p = M_∥ / F_R = ${fmt(perp / FR)} ${Lu}` : '') });
      if (Math.abs(FRv[2]) > 1e-12 * FR && Math.abs(FRv[0]) < 1e-12 * FR && Math.abs(FRv[1]) < 1e-12 * FR && !perp) {
        const x = O[0] - MRv[1] / FRv[2], y = O[1] + MRv[0] / FRv[2];
        S.add({ t: 'Where the single resultant meets the x–y plane', n: 'For parallel forces along z: (M_R)_x = y F_R, (M_R)_y = −x F_R, about O.', r: `x = ${fmt(x)} ${Lu}, y = ${fmt(y)} ${Lu}` });
        out.push({ k: 'Single resultant acts at x', v: x, u: Lu, hl: true }, { k: 'Single resultant acts at y', v: y, u: Lu, hl: true });
      } else out.push({ k: 'Point on the line of action of F_R', v: `(${pt.map(fmt).join(', ')})`, u: Lu });
      out.push({ k: perp ? 'Wrench couple along F_R, M_∥' : 'Couple left after moving F_R', v: perp, u: FL });
      if (perp) out.push({ k: 'Pitch of the wrench p = M_∥ / F_R', v: perp / FR, u: Lu });
      wrench = { u, Mpar: perp, pt };
    } else S.add({ t: 'Single resultant', n: MR ? 'The forces cancel, so the system reduces to the couple moment alone.' : 'The forces and moments cancel: the system is in equilibrium.', r: MR ? `M_R = ${vstr(MRv, FL)}` : 'F_R = 0, M_R = 0' });
    return ok(!FR ? (MR ? 'Reduces to a couple' : 'System in equilibrium') : wrench.Mpar ? 'Reduces to a wrench' : 'Reduces to a single force', out, S, { kind: 'reduce3d', c, rows: rows.map((r) => ({ v: r.v, p: r.p })), couples: cv, O, FRv, MRv, wrench });
  }

  /* ------------------------------------------------------------------ */
  /* Distributed loads                                                  */
  /* ------------------------------------------------------------------ */
  function dist(st, c) {
    const segs = st.dist.segs || [], err = [], { F, Lu, WL } = c;
    if (!segs.length) return fail('Add at least one distributed load.');
    segs.forEach((s, i) => {
      if (!(+s.x2 > +s.x1)) err.push(`Load ${i + 1}: x₂ must be greater than x₁.`);
      if (!isFinite(+s.w1) || !isFinite(+s.w2)) err.push(`Load ${i + 1}: enter both intensities.`);
    });
    if (err.length) return fail(err);
    const parts = [];
    segs.forEach((s, i) => {
      const a = +s.x1, b = +s.x2, L = b - a, w1 = +s.w1, w2 = +s.w2;
      if (w1) parts.push({ seg: i + 1, name: 'rectangle', A: w1 * L, x: a + L / 2, how: `${fmt(w1)}(${fmt(L)})` });
      if (w2 - w1) parts.push({ seg: i + 1, name: 'triangle', A: 0.5 * (w2 - w1) * L, x: a + (2 * L) / 3, how: `½(${fmt(w2 - w1)})(${fmt(L)})` });
    });
    const S = Steps();
    S.add({ t: 'Split each load into a rectangle and a triangle', n: 'The resultant of each part equals the area under its load diagram and acts through the centroid of that area: the middle of a rectangle, and two thirds of the way toward the tall end of a triangle. Loads are positive downward; a part with a negative area subtracts.', table: { head: ['Load', 'Part', `Area = force (${F})`, `x̃ (${Lu})`, `x̃ × area (${F}·${Lu})`], rows: parts.map((p) => [String(p.seg), p.name, `${p.how} = ${fmt(p.A)}`, fmt(p.x), fmt(p.A * p.x)]) } });
    const FR = parts.reduce((s, p) => s + p.A, 0), Mx = parts.reduce((s, p) => s + p.A * p.x, 0);
    S.add({ t: 'Resultant force', f: '+↓ F_R = ΣA', s: `F_R = ${sumStr(parts.map((p) => ({ v: p.A, txt: fmt(Math.abs(p.A)) })))}`, r: `F_R = ${fmt(FR)} ${F}` + (FR < 0 ? ' (upward)' : ' (downward)') });
    const out = [{ k: 'Resultant force F_R (↓ positive)', v: FR, u: F, hl: true }];
    let xbar = null;
    if (Math.abs(FR) > 1e-12 * Math.max(...parts.map((p) => Math.abs(p.A)), 1e-300)) {
      xbar = Mx / FR;
      S.add({ t: 'Location of the resultant', f: 'x̄ = Σx̃A / ΣA  (moments about x = 0)', s: `x̄ = ${fmt(Mx)} / ${fmt(FR)}`, r: `x̄ = ${fmt(xbar)} ${Lu}` });
      out.push({ k: 'Location of the resultant x̄', v: xbar, u: Lu, hl: true });
    } else {
      S.add({ t: 'Location of the resultant', n: 'The loads add to zero force, so the system is a couple moment.', r: `M = ${fmt(-Mx)} ${F}·${Lu} (↺ positive)` });
      out.push({ k: 'The loads reduce to a couple M (↺ positive)', v: -Mx, u: `${F}·${Lu}` });
    }
    out.push({ k: 'Moment of the loads about x = 0 (↻ positive)', v: Mx, u: `${F}·${Lu}` });
    return ok('Distributed load resultant', out, S, { kind: 'dist', c, segs: segs.map((s) => ({ x1: +s.x1, x2: +s.x2, w1: +s.w1, w2: +s.w2 })), parts, FR, xbar });
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['x', 'y', 'z', 'ax', 'ay', 'az', 'bx', 'by_', 'bz', 'x1', 'x2']);
  const FOR = new Set(['F', 'Fx', 'Fy', 'Fz']);
  const MOM = new Set(['M', 'Mx', 'My', 'Mz']);
  const DIS = new Set(['w1', 'w2']);
  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, tidy, UNITS } = Core;
    const l0 = UNITS[from].len, l1 = UNITS[to].len, f0 = st.fu, f1 = twin(st.fu, to);
    const kL = convert(1, l0, l1), kF = convert(1, f0, f1);
    const walk = (o) => {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach((k) => {
        const v = o[k];
        if (typeof v === 'number') {
          if (LEN.has(k)) o[k] = tidy(v * kL, 8); else if (FOR.has(k)) o[k] = tidy(v * kF, 8);
          else if (MOM.has(k)) o[k] = tidy(v * kF * kL, 8); else if (DIS.has(k)) o[k] = tidy((v * kF) / kL, 8);
        } else walk(v);
      });
    };
    ['co', 'v3', 'dot', 'mom', 'red', 'r3', 'dist'].forEach((k) => walk(st[k]));
    st.fu = f1;
    return st;
  }

  const Forces = { defaults, solve, convertState, comp2, comp3, MODES, vec: { add, sub, mul, dot, cross, mag } };
  root.Forces = Forces;
  if (typeof module !== 'undefined' && module.exports) module.exports = Forces;
})(typeof window !== 'undefined' ? window : globalThis);
