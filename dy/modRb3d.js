/* =====================================================================
 * DYNAMICS · D8 Three-Dimensional Motion of a Rigid Body (inputs, views, presets)
 * Physics: dy/rb3d.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Rb3d, DY, DYUI } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const K = DYUI.K, D2R = Math.PI / 180;
  const { add, sub, mul, cross, len, unit, dot } = Rb3d;
  const WCOL = '#2f7fc1', ACOL = '#e67e22', VCOL = K.vel, PCOL = K.acc, HCOL = '#8e44ad', RCOL = COL.react, FCOL = COL.load, BODY = '#b9c2cb', ARM = '#5d7a99', GCOL = '#c0392b';

  const M = { id: 'rb3d', title: '3D Rigid-Body Motion', defaults: Rb3d.defaults, units: 'US' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const AX = [['x', 'x'], ['y', 'y'], ['z', 'z']];
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]), md = st.mode;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Find', get: () => st.mode, set: (v) => (st.mode = v), options: [
      ['kin', 'Angular velocity and acceleration, and the motion of a point'], ['inertia', 'Moments and products of inertia of a body'],
      ['mom', 'Angular momentum and kinetic energy'], ['euler', 'Equations of motion and bearing reactions'],
      ['gyro', 'Gyroscope or top in steady precession'], ['free', 'Torque-free motion (satellite, projectile)']] });
    if (md === 'gyro' || md === 'free') C.seg(sec, { label: 'Rates in', get: () => st.ru, set: (v) => (st.ru = v), options: [['rad/s', 'rad/s'], ['rpm', 'rev/min'], ['rev/h', 'rev/h']] });
    C.note(sec, md === 'gyro' || md === 'free' ? 'z is the axis of symmetry and Z the fixed vertical (or the angular momentum, in torque-free motion).' : 'Axes: x, y, z fixed in space, z up, with the origin at O. Vectors are typed by their x, y, z components at the instant considered.');

    if (md === 'kin' || md === 'mom' || md === 'euler') {
      sec = C.section(c, 'Rotations');
      C.note(sec, 'List the rotations from the base outward. Each one turns about an axis through a point, and that axis is carried by the rotations above it (a turntable, then a boom on it, then a disk on the boom). Only the direction of an axis matters, not its length.');
      C.list(sec, { items: st.rots, max: 4, min: 1, color: (it) => (it.roll === 'yes' ? '#fdebd0' : '#d6e4f3'), title: (it, i) => `${it.name || 'ω' + (i + 1)}${i ? ' (carried by the one above)' : ' (about a fixed axis)'}`,
        fields: (it, i) => {
          const f = [{ key: 'name', label: 'Name', text: true }];
          if (i) f.push({ key: 'roll', label: 'Rate', options: [['no', 'Given'], ['yes', 'From rolling']] }); else f.push({ key: 'w', label: 'Rate ω', unit: 'rad/s' });
          if (i && it.roll !== 'yes') f.push({ key: 'w', label: 'Rate ω', unit: 'rad/s' });
          if (it.roll !== 'yes') f.push({ key: 'wd', label: 'Rate of change ω̇', unit: 'rad/s²' });
          f.push({ key: 'ux', label: 'Axis direction x' }, { key: 'uy', label: 'y' }, { key: 'uz', label: 'z' });
          f.push({ key: 'px', label: 'Point on the axis x', unit: u.L }, { key: 'py', label: 'y', unit: u.L }, { key: 'pz', label: 'z', unit: u.L });
          if (it.roll === 'yes') f.push({ key: 'dx', label: 'Line of contact x' }, { key: 'dy', label: 'y' }, { key: 'dz', label: 'z' });
          return f;
        },
        add: [['Rotation', () => ({ name: `ω${st.rots.length + 1}`, ux: 0, uy: 0, uz: 1, px: 0, py: 0, pz: 0, w: 1, wd: 0, roll: 'no', dx: 0, dy: 1, dz: 0 })]] });
      if (st.rots.some((r, i) => i && r.roll === 'yes')) C.note(sec, 'Rolling without slipping: the body’s ω must lie along the line of contact, which fixes this rate. Its rate of change keeps the same ratio to the first rotation.');
    }
    if (md === 'kin') {
      sec = C.section(c, 'Point');
      ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Position of the point ${k}`, get: () => st.P[k], set: (v) => (st.P[k] = v), unit: u.L }));
      C.toggle(sec, { label: 'The point also moves along the body (a boom extending, a collar sliding)', get: () => st.relOn, set: (v) => (st.relOn = v) });
      if (st.relOn) {
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Velocity relative to the body (v_rel)_${k}`, get: () => st.rel['v' + k], set: (v) => (st.rel['v' + k] = v), unit: u.V }));
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Acceleration relative to the body (a_rel)_${k}`, get: () => st.rel['a' + k], set: (v) => (st.rel['a' + k] = v), unit: u.A }));
      }
      C.toggle(sec, { label: 'The base moves (a crane on a track)', get: () => st.baseOn, set: (v) => { st.baseOn = v; if (!v) Object.keys(st.base).forEach((k) => (st.base[k] = 0)); } });
      if (st.baseOn) {
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Velocity of O, v_${k}`, get: () => st.base['v' + k], set: (v) => (st.base['v' + k] = v), unit: u.V }));
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Acceleration of O, a_${k}`, get: () => st.base['a' + k], set: (v) => (st.base['a' + k] = v), unit: u.A }));
      }
    }
    if (md === 'inertia' || md === 'mom' || md === 'euler') {
      sec = C.section(c, 'Body');
      C.note(sec, `Build the body from parts. (x, y, z) is the centre of each part; a rod is given by its two ends. ${u.us ? 'Type weights in lb.' : 'Type masses in kg.'}`);
      C.list(sec, { items: st.parts, max: 8, min: 1, color: () => '#d5dbe1', title: (it, i) => `Part ${i + 1}: ${Rb3d.SHAPES[it.t]}`,
        fields: (it) => {
          const f = [{ key: 't', label: 'Shape', options: Object.entries(Rb3d.SHAPES), wide: true }, { key: 'm', label: u.us ? 'Weight W' : 'Mass m', unit: u.M }];
          if (it.t !== 'rod' && it.t !== 'custom' && it.t !== 'point' && it.t !== 'sphere') f.push({ key: 'ax', label: it.t === 'plate' ? 'Normal along' : 'Axis along', options: AX });
          else f.push({ key: '_', label: '', text: true });
          f.push({ key: 'x', label: it.t === 'rod' ? 'End 1 x' : 'Centre x', unit: u.L }, { key: 'y', label: 'y', unit: u.L }, { key: 'z', label: 'z', unit: u.L });
          if (it.t === 'rod') f.push({ key: 'x2', label: 'End 2 x', unit: u.L }, { key: 'y2', label: 'y', unit: u.L }, { key: 'z2', label: 'z', unit: u.L });
          if (['disk', 'cyl', 'ring', 'sphere'].includes(it.t)) f.push({ key: 'r', label: 'Radius r', unit: u.L });
          if (it.t === 'cyl') f.push({ key: 'h', label: 'Length h', unit: u.L });
          if (it.t === 'plate') f.push({ key: 'a', label: 'Side a', unit: u.L }, { key: 'b', label: 'Side b', unit: u.L });
          if (it.t === 'custom') ['Ixx', 'Iyy', 'Izz', 'Ixy', 'Iyz', 'Ixz'].forEach((k) => f.push({ key: k, label: k.replace('I', 'I_'), unit: u.I }));
          return f.filter((x) => x.key !== '_');
        },
        add: [['Part', () => ({ t: 'disk', m: u.us ? 10 : 5, x: 0, y: 0, z: 0, ax: 'z', r: 0.2, h: 0.2, a: 0.3, b: 0.3, x2: 0.5, y2: 0, z2: 0, Ixx: 0, Iyy: 0, Izz: 0, Ixy: 0, Iyz: 0, Ixz: 0 })]] });
      if (st.parts.some((p) => p.t === 'plate')) C.note(sec, 'A plate’s side a runs along the next axis after its normal (normal z: a along x, b along y; normal x: a along y; normal y: a along z).');
    }
    if (md === 'euler') {
      sec = C.section(c, 'Supports');
      C.toggle(sec, { label: 'Include the weight (acting at G, along −z)', get: () => st.grav, set: (v) => (st.grav = v) });
      C.seg(sec, { label: 'Held by', get: () => st.sup, set: (v) => (st.sup = v), options: [['none', 'Nothing given (report ΣF and ΣM_G)'], ['brg', 'A shaft on two bearings']] });
      if (st.sup === 'brg') {
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Bearing A ${k}`, get: () => st.A[k], set: (v) => (st.A[k] = v), unit: u.L }));
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `Bearing B ${k}`, get: () => st.B[k], set: (v) => (st.B[k] = v), unit: u.L }));
        C.select(sec, { label: 'Thrust bearing (takes the force along the shaft)', get: () => st.thrust, set: (v) => (st.thrust = v), options: [['A', 'At A'], ['B', 'At B'], ['none', 'None']] });
        C.note(sec, 'The shaft runs from A to B. Both are journal bearings; a torque T about the shaft (from a motor) keeps the motion as given.');
      }
    }
    if (md === 'gyro') {
      const q = st.gy, ru = st.ru;
      sec = C.section(c, 'Body');
      C.num(sec, { label: u.us ? 'Weight W' : 'Mass m', get: () => q.m, set: (v) => (q.m = v), unit: u.M });
      C.num(sec, { label: 'Radius of gyration about the spin axis k_z', get: () => q.kz, set: (v) => (q.kz = v), unit: u.L });
      C.num(sec, { label: 'Radius of gyration about a transverse axis through O, k_t', get: () => q.kt, set: (v) => (q.kt = v), unit: u.L });
      sec = C.section(c, 'Motion');
      C.select(sec, { label: 'Unknown', get: () => q.unk, set: (v) => (q.unk = v), options: [['spin', 'Spin ψ̇'], ['prec', 'Precession φ̇'], ['theta', 'Angle θ of the axis'], ['M', 'Moment M_x needed']] });
      C.seg(sec, { label: 'Moment about O', get: () => q.mom, set: (v) => (q.mom = v), options: [['weight', 'From the weight (a top)'], ['given', 'A given moment']] });
      if (q.mom === 'weight') C.num(sec, { label: 'Distance from O to G along the axis r_G', get: () => q.rG, set: (v) => (q.rG = v), unit: u.L });
      else if (q.unk !== 'M') C.num(sec, { label: 'Moment M_x', get: () => q.M, set: (v) => (q.M = v), unit: u.MO });
      if (q.unk !== 'theta') C.num(sec, { label: 'Angle θ between Z and the spin axis', get: () => q.th, set: (v) => (q.th = v), unit: '°' });
      if (q.unk !== 'prec') C.num(sec, { label: 'Precession φ̇', get: () => q.prec, set: (v) => (q.prec = v), unit: ru });
      if (q.unk !== 'spin') C.num(sec, { label: 'Spin ψ̇', get: () => q.spin, set: (v) => (q.spin = v), unit: ru });
      C.note(sec, 'For a gyroscope with its axis horizontal (θ = 90°) the moment is M_x = I_z φ̇ ψ̇. Take φ̇ and ψ̇ positive in the same sense as the book’s figure.');
    }
    if (md === 'free') {
      const q = st.fr, ru = st.ru;
      sec = C.section(c, 'Body');
      C.num(sec, { label: u.us ? 'Weight W' : 'Mass m', get: () => q.m, set: (v) => (q.m = v), unit: u.M });
      C.num(sec, { label: 'Radius of gyration about the axis of symmetry k_z', get: () => q.kz, set: (v) => (q.kz = v), unit: u.L });
      C.num(sec, { label: 'Radius of gyration about a transverse axis through G, k_t', get: () => q.kt, set: (v) => (q.kt = v), unit: u.L });
      sec = C.section(c, 'Motion');
      C.num(sec, { label: 'Angle θ between H_G (Z) and the axis z', get: () => q.th, set: (v) => (q.th = v), unit: '°' });
      C.select(sec, { label: 'Given', get: () => q.given, set: (v) => (q.given = v), options: [['spin', 'The spin ψ̇'], ['prec', 'The precession φ̇'], ['H', 'The angular momentum H_G']] });
      if (q.given === 'spin') C.num(sec, { label: 'Spin ψ̇', get: () => q.spin, set: (v) => (q.spin = v), unit: ru });
      if (q.given === 'prec') C.num(sec, { label: 'Precession φ̇', get: () => q.prec, set: (v) => (q.prec = v), unit: ru });
      if (q.given === 'H') C.num(sec, { label: 'Angular momentum H_G', get: () => q.H, set: (v) => (q.H = v), unit: u.I + '/s' });
    }
  };
  M.diagram = function (c, C) {
    const st = S(), md = st.mode;
    if (md === 'kin') { C.toggle(c, { label: 'Show ω and α', get: () => st.showW !== false, set: (v) => (st.showW = v) }); C.toggle(c, { label: 'Show v and a of the point', get: () => st.showV !== false, set: (v) => (st.showV = v) }); }
    if (md === 'mom') C.toggle(c, { label: 'Show ω, v_G and the angular momentum', get: () => st.showV !== false, set: (v) => (st.showV = v) });
    if (md === 'euler') C.toggle(c, { label: 'Show ω, α, ΣM_G and the reactions', get: () => st.showV !== false, set: (v) => (st.showV = v) });
    if (md === 'inertia') C.toggle(c, { label: 'Show the principal axes through G', get: () => st.showP !== false, set: (v) => (st.showP = v) });
    if (md !== 'gyro' && md !== 'free') C.toggle(c, { label: 'Show the rotation axes', get: () => st.showAx !== false, set: (v) => (st.showAx = v) });
    if (md === 'free') C.toggle(c, { label: 'Show the body and space cones', get: () => st.showC !== false, set: (v) => (st.showC = v) });
  };

  M.compute = (U) => Rb3d.solve(S(), U);
  M.onUnits = (from, to) => Rb3d.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => (mode() === 'gyro' || mode() === 'free' ? 'Side view' : 'Top and front views');
  M.cap3D = () => '3D view';
  M.hint = () => ({
    kin: 'Press Play to run the rotations (the fastest one turns once in 10 s at 1×). Blue is ω, orange α, green v and purple a of the point.',
    inertia: 'The red dot is the mass centre G; the purple lines are the principal axes through G.',
    mom: 'Press Play to run the rotations. Purple is the angular momentum about O, blue ω and green the velocity of G.',
    euler: 'Press Play to run the rotations. Purple is the moment ΣM_G the supports must supply, red the bearing reactions.',
    gyro: 'Press Play to watch the body spin about its axis while the axis precesses about Z.',
    free: 'Press Play to watch the free precession: the body cone rolls on the space cone, and H_G stays fixed.',
  }[mode()]);
  M.legend = () => ({
    kin: [[ARM, 'Body or arm', 'ln'], [WCOL, 'ω'], [ACOL, 'α'], [VCOL, 'v'], [PCOL, 'a']],
    inertia: [[BODY, 'Part', 'sq'], [GCOL, 'Mass centre G'], [HCOL, 'Principal axes', 'ln']],
    mom: [[BODY, 'Body', 'sq'], [WCOL, 'ω'], [VCOL, 'v_G'], [HCOL, 'H_O and H_G']],
    euler: [[BODY, 'Body', 'sq'], [WCOL, 'ω'], [ACOL, 'α'], [HCOL, 'ΣM_G'], [RCOL, 'Bearing reactions']],
    gyro: [[BODY, 'Body', 'sq'], [WCOL, 'Spin and precession'], [FCOL, 'Weight'], [HCOL, 'Moment M_x']],
    free: [[BODY, 'Body', 'sq'], [HCOL, 'H_G (fixed)'], [WCOL, 'ω'], [ACOL, 'Cones', 'ln']],
  }[mode()]);

  /* Play: every rotation turns at its own rate; the fastest makes one turn in 10 s at 1×. */
  M.anim = () => ({
    duration: 10, loop: true,
    frame(uu) { if (uu <= 0) delete S()._u; else S()._u = uu; },
    label() { return S()._u === undefined ? 'the instant asked for' : `${Math.round(S()._u * 100)} % of a turn of the fastest rotation`; },
  });
  /** Turn angles of the rotations at the current frame. */
  function angles(g) {
    const st = S(); if (st._u === undefined || !g.ch) return null;
    const ws = g.ch.R.map((r) => r.w), mx = Math.max(...ws.map(Math.abs), 1e-9);
    return ws.map((w) => (w / mx) * 2 * Math.PI * st._u);
  }

  /* ------------------------------------------------------------------ */
  /* Geometry shared by the two views (book axes, z up)                  */
  /* ------------------------------------------------------------------ */
  const ring = (c, n, r, k) => { const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = unit(cross(n, a)), e2 = cross(n, e1), pts = []; for (let i = 0; i <= (k || 32); i++) { const t = (i / (k || 32)) * 2 * Math.PI; pts.push(add(c, add(mul(e1, r * Math.cos(t)), mul(e2, r * Math.sin(t))))); } return pts; };
  const AXV = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  /** Outline of each part as polylines (for the 2D views and the wire part of 3D). */
  function partShapes(b) {
    return b.parts.map((q) => {
      const p = q.p, c = q.c, n = AXV[p.ax || 'z'], r = +p.r || 0;
      if (p.t === 'rod') return { q, lines: [[[+p.x, +p.y, +p.z], [+p.x2, +p.y2, +p.z2]]], w: 5 };
      if (p.t === 'disk' || p.t === 'ring') return { q, lines: [ring(c, n, r)], w: p.t === 'ring' ? 4 : 2, fill: p.t === 'disk' };
      if (p.t === 'cyl') { const h = (+p.h || 0) / 2; return { q, lines: [ring(add(c, mul(n, h)), n, r), ring(add(c, mul(n, -h)), n, r)], w: 2, fill: true, cyl: h }; }
      if (p.t === 'sphere') return { q, lines: [ring(c, [0, 0, 1], r), ring(c, [1, 0, 0], r), ring(c, [0, 1, 0], r)], w: 1.6 };
      if (p.t === 'plate') { const ia = ({ x: 1, y: 2, z: 0 })[p.ax || 'z'], ib = ({ x: 2, y: 0, z: 1 })[p.ax || 'z'], ea = [0, 0, 0], eb = [0, 0, 0]; ea[ia] = +p.a / 2; eb[ib] = +p.b / 2; const P = (sa, sb) => add(c, add(mul(ea, sa), mul(eb, sb))); return { q, lines: [[P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), P(-1, -1)]], w: 2, fill: true }; }
      return { q, lines: [], dot: true };
    });
  }
  /** Size of the scene (for arrow lengths), from every point drawn. */
  function extent(pts) { let e = 0; pts.forEach((p) => (e = Math.max(e, len(p)))); return e || 1; }

  function items(res, opt) {
    const g = res.geo, st = S(), it = [], q = angles(g), T = (x) => (q ? Rb3d.turn(st.rots, q, x) : x), playing = !!q;
    const lab = (t) => (opt.showP ? t : null);
    const pts = [];
    if (g.ch) g.ch.R.forEach((r) => pts.push(r.p));
    if (g.P) pts.push(g.P);
    if (g.b) g.b.parts.forEach((x) => pts.push(x.c, add(x.c, [+x.p.r || 0, +x.p.r || 0, +x.p.r || 0])));
    if (g.reac) pts.push(g.reac.A, g.reac.B);
    const E = extent(pts), L = E * 0.45;
    // rotation axes
    if (g.ch && st.showAx !== false) g.ch.R.forEach((r, i) => { const qq = q ? q.slice(0, i).concat(q.slice(i).map(() => 0)) : null, TT = (x) => (qq ? Rb3d.turn(st.rots, qq, x) : x); it.push({ kind: 'line', a: TT(add(r.p, mul(r.u, -E * 0.7))), b: TT(add(r.p, mul(r.u, E * 0.7))), color: '#7f8c8d', w: 1.2, dash: '8 4 2 4', label: r.name }); });
    // arm of the point (kinematics)
    if (g.mode === 'kin') {
      const chainPts = [[0, 0, 0]].concat(g.ch.R.map((r) => r.p)).concat([g.P]).map(T);
      for (let i = 0; i + 1 < chainPts.length; i++) if (len(sub(chainPts[i + 1], chainPts[i])) > 1e-9) it.push({ kind: 'line', a: chainPts[i], b: chainPts[i + 1], color: ARM, w: 6 });
      const P = T(g.P); it.push({ kind: 'dot', a: P, color: K.ink, label: 'P' });
      if (!playing && st.showV !== false) {
        const vm = len(g.pt.v), am = len(g.pt.a);
        if (vm > 1e-9) it.push({ a: P, b: add(P, mul(g.pt.v, L / vm)), color: VCOL, label: lab(`v = ${fmt(vm)}`) });
        if (am > 1e-9) it.push({ a: P, b: add(P, mul(g.pt.a, L / am)), color: PCOL, label: lab(`a = ${fmt(am)}`) });
      }
      if (!playing && st.showW !== false) {
        const wm = len(g.ch.W), al = len(g.ch.A);
        if (wm > 1e-9) it.push({ kind: 'moment', a: [0, 0, 0], b: mul(g.ch.W, L * 0.8 / wm), color: WCOL, label: lab(`ω = ${fmt(wm)} rad/s`) });
        if (al > 1e-9) it.push({ kind: 'moment', a: [0, 0, 0], b: mul(g.ch.A, L * 0.8 / al), color: ACOL, label: lab(`α = ${fmt(al)} rad/s²`) });
      }
    }
    if (g.b) {
      partShapes(g.b).forEach((sh) => {
        sh.lines.forEach((ln) => { for (let i = 0; i + 1 < ln.length; i++) it.push({ kind: 'line', a: T(ln[i]), b: T(ln[i + 1]), color: sh.q.p.t === 'rod' ? ARM : K.edge, w: sh.w }); });
        if (sh.dot) it.push({ kind: 'dot', a: T(sh.q.c), color: K.edge });
      });
      const G = T(g.b.G);
      it.push({ kind: 'dot', a: G, color: GCOL, label: 'G' });
      if (g.mode === 'inertia' && st.showP !== false) g.pr.forEach((p, i) => it.push({ kind: 'line', a: sub(g.b.G, mul(p.v, E * 0.5)), b: add(g.b.G, mul(p.v, E * 0.5)), color: HCOL, w: 1.4, dash: '6 3', label: lab(`I = ${fmt(p.I)}`) }));
      if (!playing && st.showV !== false && g.mode === 'mom') {
        const wm = len(g.ch.W), vm = len(g.vG), hm = len(g.HO);
        if (wm > 1e-9) it.push({ kind: 'moment', a: G, b: add(G, mul(g.ch.W, L * 0.7 / wm)), color: WCOL, label: lab(`ω = ${fmt(wm)}`) });
        if (vm > 1e-9) it.push({ a: G, b: add(G, mul(g.vG, L * 0.6 / vm)), color: VCOL, label: lab(`v_G = ${fmt(vm)}`) });
        if (hm > 1e-9) it.push({ kind: 'moment', a: [0, 0, 0], b: mul(g.HO, L / hm), color: HCOL, label: lab(`H_O = ${fmt(hm)}`) });
      }
      if (!playing && st.showV !== false && g.mode === 'euler') {
        const wm = len(g.ch.W), al = len(g.ch.A), mm = len(g.Mr);
        if (wm > 1e-9) it.push({ kind: 'moment', a: G, b: add(G, mul(g.ch.W, L * 0.6 / wm)), color: WCOL, label: lab(`ω = ${fmt(wm)}`) });
        if (al > 1e-9) it.push({ kind: 'moment', a: G, b: add(G, mul(g.ch.A, L * 0.5 / al)), color: ACOL, label: lab(`α = ${fmt(al)}`) });
        if (mm > 1e-9) it.push({ kind: 'moment', a: G, b: add(G, mul(g.Mr, L * 0.8 / mm)), color: HCOL, label: lab(`ΣM_G = ${fmt(mm)}`) });
        if (len(g.W) > 0) it.push({ a: G, b: add(G, [0, 0, -L * 0.6]), color: FCOL, label: lab(`W = ${fmt(len(g.W))}`) });
        if (g.reac) {
          const { A, B, RA, RB } = g.reac, Fm = Math.max(len(RA), len(RB), 1e-9);
          it.push({ kind: 'line', a: A, b: B, color: '#2c3e50', w: 3 });
          [[A, RA, 'A'], [B, RB, 'B']].forEach(([p, R, n]) => { it.push({ kind: 'dot', a: p, color: '#2c3e50', label: n }); if (len(R) > 1e-9 * Fm) it.push({ a: sub(p, mul(R, (L * 0.7) / Fm)), b: p, color: RCOL, label: lab(`${n} = ${fmt(len(R))}`) }); });
        }
      }
    }
    return { it, E };
  }

  /* ------------------------------------------------------------------ */
  /* 2D                                                                  */
  /* ------------------------------------------------------------------ */
  function sideView(svg, res, opt) {
    const g = res.geo, st = S(), D = UI.Draw2D(svg, { xmin: -1.25, xmax: 1.25, ymin: -0.35, ymax: 1.35 }, { pad: 30 });
    const th = g.th, ax = [Math.sin(th), Math.cos(th)], lab = (t, f) => (opt.showP ? t : f);
    D.line([0, -0.3], [0, 1.28], { stroke: '#111', sw: 1.2, dash: '9 4 2 4' }); D.head(D.X(0), D.Y(1.28), 0, -1, '#111', 9);
    D.text([0, 1.28], g.mode === 'free' ? 'Z (along H_G)' : 'Z', { dx: 8, dy: 4, color: COL.ink, weight: 700 });
    // spin axis z
    D.line([0, 0], [ax[0] * 1.2, ax[1] * 1.2], { stroke: '#111', sw: 1.2 }); D.head(D.X(ax[0] * 1.2), D.Y(ax[1] * 1.2), ax[0], -ax[1], '#111', 9);
    D.text([ax[0] * 1.2, ax[1] * 1.2], 'z', { dx: 8, dy: 0, color: COL.ink, weight: 700 });
    const arc = (a0, a1, r, col, txt) => { const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + ((a1 - a0) * i) / 24; pts.push([r * Math.sin(a), r * Math.cos(a)]); } D.pline(pts, { stroke: col, sw: 1.6 }); D.text(pts[12], txt, { dx: 6, dy: -4, color: col, size: 12, weight: 700 }); };
    arc(0, th, 0.32, ACOL, `θ = ${fmt(th / D2R)}°`);
    // body: a disk or top centred on the axis
    const G = g.mode === 'gyro' ? (g.wt ? Math.max(0.35, Math.min(0.85, 0.7)) : 0.7) : 0.6, c = [ax[0] * G, ax[1] * G], n = [ax[1], -ax[0]], R = 0.32, Hh = 0.08;
    const P = (s1, t) => [c[0] + n[0] * s1 + ax[0] * t, c[1] + n[1] * s1 + ax[1] * t];
    if (g.mode === 'gyro') { D.poly([[0, 0], P(R, -Hh), P(R, Hh), P(-R, Hh), P(-R, -Hh)], { fill: BODY, stroke: K.edge, sw: 1.5 }); D.dot([0, 0], '#111', 'O', { dx: -14, dy: 14 }); }
    else D.poly([P(R, -Hh * 1.5), P(R, Hh * 1.5), P(-R, Hh * 1.5), P(-R, -Hh * 1.5)], { fill: BODY, stroke: K.edge, sw: 1.5 });
    D.dot(c, GCOL, 'G', { dx: 9, dy: -6 });
    if (g.mode === 'gyro') {
      if (g.wt) D.force([c[0], c[1] - 0.04], [0, -1], 50, { color: FCOL, label: lab(`W = ${fmt(g.W)}`, 'W'), lp: 'head', ldy: 14 });
      D.text([D.W - 12, 20], lab(`φ̇ = ${fmt(g.ph)} rad/s   ψ̇ = ${fmt(g.ps)} rad/s   M_x = ${fmt(g.Mx)}`, ''), { px: true, anchor: 'end', color: WCOL, size: 12.5, weight: 700 });
    } else {
      const H = [0, 1.05], b = g.beta;
      if (st.showC !== false) {
        const sp = Math.abs(th - b), cone = (half, axis, col) => { const a = Math.atan2(axis[0], axis[1]); [a - half, a + half].forEach((t) => D.line([0, 0], [Math.sin(t) * 1.05, Math.cos(t) * 1.05], { stroke: col, sw: 1.2, dash: '5 4' })); };
        cone(b, ax, ACOL); cone(sp, [0, 1], '#16a085');
        D.text([Math.sin(th + b) * 1.08, Math.cos(th + b) * 1.08], 'body cone', { color: ACOL, size: 11.5 });
      }
      D.line([0, 0], H, { stroke: HCOL, sw: 3 }); D.head(D.X(H[0]), D.Y(H[1]), 0, -1, HCOL, 12);
      D.text(H, lab(`H_G`, 'H_G'), { dx: -10, dy: 2, anchor: 'end', color: HCOL, weight: 700 });
      const wa = th - b; // ω lies at β from the axis, on the side of H_G when I > I_z
      D.line([0, 0], [Math.sin(wa) * 0.95, Math.cos(wa) * 0.95], { stroke: WCOL, sw: 2.6 }); D.head(D.X(Math.sin(wa) * 0.95), D.Y(Math.cos(wa) * 0.95), Math.sin(wa), -Math.cos(wa), WCOL, 11);
      D.text([Math.sin(wa) * 0.95, Math.cos(wa) * 0.95], 'ω', { dx: 6, dy: -4, color: WCOL, weight: 700 });
      D.text([D.W - 12, 20], lab(`φ̇ = ${fmt(g.ph)} rad/s   ψ̇ = ${fmt(g.ps)} rad/s   β = ${fmt(g.beta / D2R)}°`, ''), { px: true, anchor: 'end', color: WCOL, size: 12.5, weight: 700 });
    }
  }
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.mode === 'gyro' || g.mode === 'free') return sideView(svg, res, opt);
    const { it } = items(res, opt);
    it.push({ kind: 'dot', a: [0, 0, 0], color: '#111', label: 'O' });
    Charts.twoViews(svg, it);
  };

  /* ------------------------------------------------------------------ */
  /* 3D (view axes: x right, y up, z toward the viewer; book z is up)    */
  /* ------------------------------------------------------------------ */
  const V = (p) => [p[0], p[2], -p[1]];
  function solidRev(v, c, n, prof, fill, T, seg) {
    seg = seg || 28;
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = unit(cross(n, a)), e2 = cross(n, e1);
    const P = (r, t, ang) => V(T(add(c, add(mul(n, t), add(mul(e1, r * Math.cos(ang)), mul(e2, r * Math.sin(ang)))))));
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * 2 * Math.PI, a1 = ((j + 1) / seg) * 2 * Math.PI;
      for (let i = 0; i + 1 < prof.length; i++) { const [r0, t0] = prof[i], [r1, t1] = prof[i + 1]; v.face([P(r0, t0, a0), P(r1, t1, a0), P(r1, t1, a1), P(r0, t0, a1)], fill, 1, 'fill'); }
    }
  }
  function arrows3(v, it) {
    it.forEach((x) => {
      if (x.kind === 'dot') { v.circle(...V(x.a), 0.001, x.color, 3, 8); if (x.label) v.label(V(x.a), x.label, x.color); return; }
      if (x.kind === 'line') { v.line([V(x.a), V(x.b)], x.color, Math.min(x.w || 2, 4), x.dash ? x.dash.split(' ').map(Number) : null); if (x.label && x.dash) v.label(V(x.b), x.label, x.color); return; }
      DYUI.arrow3(v, V(x.a), V(x.b), x.color, 2.4);
      if (x.kind === 'moment') { const d = sub(x.b, x.a), l = len(d); DYUI.arrow3(v, V(x.a), V(sub(x.b, mul(d, 0.12))), x.color, 2.4, l * 0.2); }
      if (x.label) v.label(V(x.b), x.label, x.color);
    });
  }
  function drawGyro3D(v, res, opt) {
    const g = res.geo, st = S(), uu = st._u, ph = uu === undefined ? 0 : 2 * Math.PI * uu, ps = uu === undefined ? 0 : 2 * Math.PI * uu * Math.min(6, Math.abs(g.ps / (g.ph || 1e-9)) || 6);
    const th = g.th, ax = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    const T = (x) => x, L = 1.3;
    DYUI.arrow3(v, V([0, 0, -0.3]), V([0, 0, L]), '#111', 1.6); v.label(V([0, 0, L * 1.06]), g.mode === 'free' ? 'Z (H_G)' : 'Z', '#111');
    v.line([V([0, 0, 0]), V(mul(ax, L))], '#111', 1.4, [6, 3]); v.label(V(mul(ax, L * 1.05)), 'z', '#111');
    const c = mul(ax, g.mode === 'gyro' ? 0.7 : 0.6);
    if (g.mode === 'gyro') solidRev(v, [0, 0, 0], ax, [[0, 0], [0.32, 0.62], [0.32, 0.78], [0, 0.78]], BODY, T, 30);
    else solidRev(v, sub(c, mul(ax, 0.12)), ax, [[0, 0], [0.34, 0], [0.34, 0.24], [0, 0.24]], BODY, T, 30);
    // a mark on the rim to show the spin
    const e1 = unit(cross(ax, [0, 0, 1])) || [1, 0, 0], e2 = cross(ax, e1), mk = add(c, add(mul(e1, 0.33 * Math.cos(ps)), mul(e2, 0.33 * Math.sin(ps))));
    v.line([V(c), V(mk)], GCOL, 2.4);
    v.circle(...V(c), 0.001, GCOL, 3, 8); v.label(V(c), 'G', GCOL);
    if (g.mode === 'gyro' && g.wt) { DYUI.arrow3(v, V(c), V(add(c, [0, 0, -0.5])), FCOL, 2.4); if (opt.showP) v.label(V(add(c, [0, 0, -0.55])), `W = ${fmt(g.W)}`, FCOL); }
    if (g.mode === 'free') { DYUI.arrow3(v, V([0, 0, 0]), V([0, 0, 1.1]), HCOL, 3); }
    v.setBounds([-1.3, -0.4, -1.3], [1.3, 1.4, 1.3]);
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo;
    if (g.mode === 'gyro' || g.mode === 'free') return drawGyro3D(v, res, opt);
    const st = S(), q = angles(g), T = (x) => (q ? Rb3d.turn(st.rots, q, x) : x);
    const { it, E } = items(res, opt);
    // solids
    if (g.b) partShapes(g.b).forEach((sh) => {
      const p = sh.q.p, n = AXV[p.ax || 'z'], r = +p.r || 0, c = sh.q.c;
      if (p.t === 'disk') solidRev(v, sub(c, mul(n, r * 0.06)), n, [[0, 0], [r, 0], [r, r * 0.12], [0, r * 0.12]], BODY, T);
      else if (p.t === 'cyl') solidRev(v, sub(c, mul(n, sh.cyl)), n, [[0, 0], [r, 0], [r, 2 * sh.cyl], [0, 2 * sh.cyl]], BODY, T);
      else if (p.t === 'sphere') { const pr = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 10; pr.push([r * Math.cos(a), r * Math.sin(a)]); } solidRev(v, c, [0, 0, 1], pr, BODY, T, 20); }
      else if (p.t === 'ring') solidRev(v, c, n, [[r * 0.94, -r * 0.04], [r * 1.04, -r * 0.04], [r * 1.04, r * 0.04], [r * 0.94, r * 0.04], [r * 0.94, -r * 0.04]], BODY, T);
      else if (p.t === 'plate') { const pts = sh.lines[0].slice(0, 4).map((x) => V(T(x))); v.face(pts, BODY, 0.9, K.edge); }
      else if (p.t === 'point') { const pr = []; const rr = E * 0.03; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 8; pr.push([rr * Math.cos(a), rr * Math.sin(a)]); } solidRev(v, c, [0, 0, 1], pr, '#8d98a3', T, 12); }
    });
    if (g.reac) [g.reac.A, g.reac.B].forEach((p) => { const w = E * 0.05; v.box(p[0] - w, p[2] - w * 1.6, -p[1] - w, p[0] + w, p[2] - w * 0.4, -p[1] + w, '#c9d3dc', 1, '#4a5661'); });
    // fixed axes, black
    const L = E * 0.8;
    [[[L, 0, 0], 'x'], [[0, L, 0], 'y'], [[0, 0, L], 'z']].forEach(([e, n]) => { DYUI.arrow3(v, V([0, 0, 0]), V(e), '#111', 1.4); v.label(V(mul(e, 1.06)), n, '#111'); });
    arrows3(v, it);
    v.setBounds([-E * 1.1, -E * 1.1, -E * 1.1], [E * 1.1, E * 1.1, E * 1.1]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                             */
  /* ------------------------------------------------------------------ */
  const rot = (name, u, w, wd, o) => Object.assign({ name, ux: u[0], uy: u[1], uz: u[2], px: 0, py: 0, pz: 0, w, wd, roll: 'no', dx: 0, dy: 1, dz: 0 }, o || {});
  const part = (o) => Object.assign({ t: 'disk', m: 1, x: 0, y: 0, z: 0, ax: 'z', r: 0.1, h: 0.1, a: 0.1, b: 0.1, x2: 0, y2: 0, z2: 0, Ixx: 0, Iyy: 0, Izz: 0, Ixy: 0, Iyz: 0, Ixz: 0 }, o);
  const zero = { vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 };
  const c45 = Math.SQRT1_2;
  M.presets = [
    { name: 'Test: fire-truck ladder, ω₁ = 0.15 rad/s (ω̇₁ = 0.8) and ω₂ = 0.6 rad/s (Prob. 20-3): v_A = {−5.20i − 12j + 20.8k} ft/s', units: 'US',
      state: { mode: 'kin', rots: [rot('ω₁', [0, 0, 1], 0.15, 0.8), rot('ω₂', [1, 0, 0], 0.6, 0)], P: { x: 0, y: 34.641, z: 20 }, relOn: false, rel: { ...zero }, baseOn: false, base: { ...zero } },
      expect: [{ k: 'v_P_x', v: -5.20 }, { k: 'v_P_y', v: -12 }, { k: 'v_P_z', v: 20.8 }, { k: 'a_P_x', v: -24.1 }, { k: 'a_P_y', v: -13.3 }, { k: 'a_P_z', v: -7.20 }] },
    { name: 'Test: fan turning at 1 rad/s while the blade spins at 60 rad/s, φ = 45° (Prob. 20-10): α = {−42.4i} rad/s²', units: 'SI',
      state: { mode: 'kin', rots: [rot('ω_z', [0, 0, 1], 1, 0), rot('ω_s', [0, c45, c45], 60, 0)], P: { x: 0, y: 0.2, z: 0.2 }, relOn: false, rel: { ...zero }, baseOn: false, base: { ...zero } },
      expect: [{ k: 'ω_y', v: 42.43 }, { k: 'ω_z', v: 43.43 }, { k: 'α_x', v: -42.43 }] },
    { name: 'Test: cone rolling without slipping, ω_z = 8 rad/s (Prob. 20-5): ω = {−8j} rad/s, a_A = {−7.24j − 7.24k} m/s²', units: 'SI',
      state: { mode: 'kin', rots: [rot('ω_z', [0, 0, 1], 8, 0), rot('ω_s', [0, -1, -1], 0, 0, { roll: 'yes', dx: 0, dy: 1, dz: 0 })], P: { x: 0, y: 0, z: 0.11314 }, relOn: false, rel: { ...zero }, baseOn: false, base: { ...zero } },
      expect: [{ k: 'ω_y', v: -8 }, { k: 'α_x', v: 64 }, { k: 'v_P_x', v: -0.905 }, { k: 'a_P_y', v: -7.24 }, { k: 'a_P_z', v: -7.24 }] },
    { name: 'Test: rod spinning about z with a disk spinning on it (Prob. 20-54): v_P = {8i + 32j − 4k} ft/s, a_P = {−270i + 72j} ft/s²', units: 'US',
      state: { mode: 'kin', rots: [rot('ω₁', [0, 0, 1], 8, 2), rot('ω₂', [0, 1, 0], 4, 0, { px: 3, py: -1, pz: 1.5 })], P: { x: 4, y: -1, z: 1.5 }, relOn: false, rel: { ...zero }, baseOn: false, base: { ...zero } },
      expect: [{ k: 'v_P_x', v: 8 }, { k: 'v_P_y', v: 32 }, { k: 'v_P_z', v: -4 }, { k: 'a_P_x', v: -270 }, { k: 'a_P_y', v: 72 }] },
    { name: 'Telescoping boom on a turntable: extending at 1.5 ft/s while it turns and lifts', units: 'US',
      state: { mode: 'kin', rots: [rot('ω₁', [0, 0, 1], 0.5, 0), rot('ω₂', [1, 0, 0], 0.25, 0, { pz: 2 })], P: { x: 0, y: 10, z: 19.32 }, relOn: true, rel: { vx: 0, vy: 0.75, vz: 1.299, ax: 0, ay: 0.25, az: 0.433 }, baseOn: false, base: { ...zero } } },
    { name: 'Test: bent rod, two 0.5 m arms of 2 kg: I_xx = 0.667, I_xy = 0.25 kg·m² about O', units: 'SI',
      state: { mode: 'inertia', parts: [part({ t: 'rod', m: 2, x: 0, y: 0, z: 0, x2: 0, y2: 0.5, z2: 0 }), part({ t: 'rod', m: 2, x: 0, y: 0.5, z: 0, x2: 0.5, y2: 0.5, z2: 0 })] },
      expect: [{ k: 'I_xx about O', v: 0.6667 }, { k: 'I_yy about O', v: 0.1667 }, { k: 'I_zz about O', v: 0.8333 }, { k: 'I_xy about O', v: 0.25 }] },
    { name: 'Test: 10 kg disk spinning at 15 rad/s on an arm turning at 6 rad/s (Prob. 21-26): H_O = {21.9i + 1.69k} kg·m²/s, T = 78.5 J', units: 'SI',
      state: { mode: 'mom', rots: [rot('ω₃', [1, 0, 0], 6, 0), rot('ω₁', [0, 0, 1], 15, 0, { py: 0.6 })], parts: [part({ t: 'disk', m: 10, y: 0.6, ax: 'z', r: 0.15 })] },
      expect: [{ k: 'H_O,x', v: 21.94 }, { k: 'H_O,z', v: 1.6875 }, { k: 'Kinetic energy T', v: 78.5 }] },
    { name: 'Test: 40 kg flywheel 20 mm off centre at 8 rad/s (Prob. 21-45): A = 277 N, B = 166 N', units: 'SI',
      state: { mode: 'euler', rots: [rot('ω', [0, -1, 0], 8, 0)], parts: [part({ t: 'disk', m: 40, z: -0.02, ax: 'y', r: 0.25 })], grav: true, sup: 'brg', A: { x: 0, y: -0.75, z: 0 }, B: { x: 0, y: 1.25, z: 0 }, thrust: 'A' },
      expect: [{ k: 'A_z', v: 277 }, { k: 'B_z', v: 166 }] },
    { name: 'Test: 20 kg disk spinning at 20 rad/s on an axle turning at 6 rad/s (Prob. 21-71): gyroscopic moment 27.0 N·m', units: 'SI',
      state: { mode: 'euler', rots: [rot('ω_y', [0, 1, 0], 6, 0), rot('ω_s', [0, 0, 1], 20, 0)], parts: [part({ t: 'disk', m: 20, ax: 'z', r: 0.15 })], grav: false, sup: 'none' },
      expect: [{ k: 'Required ΣM_G,x', v: 27.0 }] },
    { name: 'Test: 90 g top precessing at 0.5 rad/s, θ = 45° (Prob. 21-69): spin ψ̇ = 3.63(10³) rad/s', units: 'SI',
      state: { mode: 'gyro', ru: 'rad/s', gy: { unk: 'spin', m: 0.09, kz: 0.018, kt: 0.035, mom: 'weight', rG: 0.06, M: 0, th: 45, prec: 0.5, spin: 100 } },
      expect: [{ k: 'Spin ψ̇', v: 3630 }] },
    { name: 'Test: 50 lb motor spinning at 100 rad/s on a frame turning at 2 rad/s (Prob. 21-62): M_x = 12.4 lb·ft', units: 'US',
      state: { mode: 'gyro', ru: 'rad/s', gy: { unk: 'M', m: 50, kz: 0.2, kt: 0.3, mom: 'given', rG: 0, M: 0, th: 90, prec: 2, spin: 100 } },
      expect: [{ k: 'Moment M_x', v: 12.4 }] },
    { name: 'Test: 1.8 Mg satellite spinning at 6 rad/s, θ = 5° (Prob. 21-77): H_G = 12.5 Mg·m²/s', units: 'SI',
      state: { mode: 'free', ru: 'rad/s', fr: { m: 1800, kz: 0.8, kt: 1.2, th: 5, given: 'spin', spin: 6, prec: 1, H: 10000 } },
      expect: [{ k: 'Angular momentum H_G', v: 12490 }] },
    { name: 'Test: 1.6 Mg space capsule precessing at 2 rev/h, θ = 20° (Prob. 21-74): spin 2.35 rev/h', units: 'SI',
      state: { mode: 'free', ru: 'rev/h', fr: { m: 1600, kz: 1.2, kt: 1.8, th: 20, given: 'prec', spin: 1, prec: 2, H: 1000 } },
      expect: [{ k: 'Spin ψ̇', v: 2.35 }] },
    { name: 'Not valid: the second axis lies along the line of contact, so rolling fixes nothing', units: 'SI', fails: true,
      state: { mode: 'kin', rots: [rot('ω_z', [0, 0, 1], 8, 0), rot('ω_s', [0, 1, 0], 0, 0, { roll: 'yes', dx: 0, dy: 1, dz: 0 })], P: { x: 0, y: 0, z: 0.1 } } },
  ];

  root.DRb3d = M;
})(window);
