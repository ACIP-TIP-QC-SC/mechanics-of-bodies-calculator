/* =====================================================================
 * STATICS · Force Systems (inputs, diagrams, presets)
 * Physics: st/forces.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Forces } = root;
  const { fmt, tidy } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const { sub, mag, add, mul } = Forces.vec;
  const FC = ['#c0392b', '#2f7fc1', '#16a085', '#8e44ad', '#d35400', '#7f8c8d', '#b7950b', '#2c3e50'];
  const RCOL = '#1e7a45', MCOL = '#8e44ad', ACOL = COL.accent;

  const M = { id: 'forces', title: 'Force Systems', defaults: Forces.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const BY2 = [['polar', 'Magnitude and angle'], ['comp', 'Components'], ['slope', 'Magnitude and slope']];
  const BY3 = [['comp', 'Components'], ['angles', 'Magnitude and direction angles'], ['line', 'Magnitude along a line A → B']];
  function fields2(it, F, Lu, withPoint) {
    const f = [{ key: 'by', label: 'Given as', options: BY2, wide: true }];
    if (it.by === 'comp') f.push({ key: 'Fx', label: 'F_x (→ +)', unit: F }, { key: 'Fy', label: 'F_y (↑ +)', unit: F });
    else if (it.by === 'slope') f.push({ key: 'F', label: 'Magnitude F', unit: F, wide: true }, { key: 'dx', label: 'Run (→ +)', unit: '' }, { key: 'dy', label: 'Rise (↑ +)', unit: '' });
    else f.push({ key: 'F', label: 'Magnitude F', unit: F }, { key: 'ang', label: 'Angle θ ↺ from +x', unit: '°' });
    if (withPoint) f.push({ key: 'x', label: 'Acts at x', unit: Lu }, { key: 'y', label: 'Acts at y', unit: Lu });
    return f;
  }
  function fields3(it, F, Lu, withPoint) {
    const f = [{ key: 'by', label: 'Given as', options: BY3, wide: true }];
    if (it.by === 'angles') f.push({ key: 'F', label: 'Magnitude F', unit: F, wide: true }, { key: 'al', label: 'α', unit: '°' }, { key: 'be', label: 'β', unit: '°' }, { key: 'ga', label: 'γ', unit: '°', wide: true });
    else if (it.by === 'line') f.push({ key: 'F', label: 'Magnitude F', unit: F, wide: true }, { key: 'ax', label: 'A x', unit: Lu }, { key: 'bx', label: 'B x', unit: Lu }, { key: 'ay', label: 'A y', unit: Lu }, { key: 'by_', label: 'B y', unit: Lu }, { key: 'az', label: 'A z', unit: Lu }, { key: 'bz', label: 'B z', unit: Lu });
    else f.push({ key: 'Fx', label: 'F_x', unit: F }, { key: 'Fy', label: 'F_y', unit: F }, { key: 'Fz', label: 'F_z', unit: F, wide: true });
    if (withPoint) f.push({ key: 'x', label: 'Acts at x', unit: Lu }, { key: 'y', label: 'Acts at y', unit: Lu }, { key: 'z', label: 'Acts at z', unit: Lu, wide: true });
    return f;
  }
  const new3 = (o) => Object.assign({ by: 'comp', Fx: 10, Fy: 0, Fz: 0, F: 10, al: 90, be: 90, ga: 0, ax: 0, ay: 0, az: 0, bx: 1, by_: 1, bz: 1, x: 0, y: 0, z: 0 }, o);
  const new2 = (o) => Object.assign({ by: 'polar', F: 10, ang: 0, Fx: 10, Fy: 0, dx: 4, dy: 3, x: 0, y: 0 }, o);
  function point(sec, C, label, p, Lu, z) {
    C.note(sec, label);
    C.num(sec, { label: 'x', get: () => p.x, set: (v) => (p.x = v), unit: Lu });
    C.num(sec, { label: 'y', get: () => p.y, set: (v) => (p.y = v), unit: Lu });
    if (z) C.num(sec, { label: 'z', get: () => p.z, set: (v) => (p.z = v), unit: Lu });
  }

  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, F = st.fu, FL = `${F}·${Lu}`;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [
      ['coplanar', 'Resultant of coplanar forces', 'Forces'], ['vector3d', 'Cartesian vectors and direction angles', 'Forces'], ['dot', 'Component of a force along a line', 'Forces'],
      ['moment', 'Moment about a point and about an axis', 'Moments'], ['reduce', 'Coplanar system: force and couple, single resultant', 'Equivalent systems'], ['reduce3d', '3D system: force and couple, wrench', 'Equivalent systems'], ['dist', 'Resultant of distributed loads', 'Equivalent systems']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    const list = (items, title, fields, mk, max) => C.list(sec, { items, max: max || 6, min: 1, color: (it, i) => FC[i % FC.length] + '33', title, fields, add: [['Force', mk]] });
    if (st.mode === 'coplanar') {
      sec = C.section(c, 'Forces');
      C.note(sec, 'Angles are measured counterclockwise from the +x axis. A slope is the run and rise of the little triangle drawn on the force (for example 4 and 3 for a 3-4-5 slope), with signs giving the direction.');
      list(st.co.forces, (it, i) => `F${i + 1}`, (it) => fields2(it, F, Lu, false), () => new2(), 6);
    } else if (st.mode === 'vector3d') {
      sec = C.section(c, 'Forces');
      C.note(sec, 'With one force the module finds its magnitude and direction angles; with more it adds them.');
      list(st.v3.forces, (it, i) => `F${i + 1}`, (it) => fields3(it, F, Lu, false), () => new3(), 4);
    } else if (st.mode === 'dot') {
      sec = C.section(c, 'Force');
      const it = st.dot.force;
      C.select(sec, { label: 'Given as', get: () => it.by, set: (v) => (it.by = v), options: BY3 });
      fields3(it, F, Lu, false).slice(1).forEach((f) => C.num(sec, { label: f.label, get: () => it[f.key], set: (v) => (it[f.key] = v), unit: f.unit }));
      sec = C.section(c, 'Line');
      point(sec, C, 'The line runs from point P to point Q.', st.dot.P, Lu, true);
      C.note(sec, 'Point Q');
      ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: k, get: () => st.dot.Q[k], set: (v) => (st.dot.Q[k] = v), unit: Lu }));
    } else if (st.mode === 'moment') {
      sec = C.section(c, 'Forces and where they act');
      list(st.mom.forces, (it, i) => `F${i + 1}`, (it) => fields3(it, F, Lu, true), () => new3(), 4);
      sec = C.section(c, 'Moment centre');
      point(sec, C, 'Point O, the moment centre.', st.mom.O, Lu, true);
      sec = C.section(c, 'Axis');
      C.toggle(sec, { label: 'Also find the moment about an axis', get: () => st.mom.axis, set: (v) => (st.mom.axis = v) });
      if (st.mom.axis) {
        point(sec, C, 'The axis passes through P, toward Q.', st.mom.P, Lu, true);
        C.note(sec, 'Point Q');
        ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: k, get: () => st.mom.Q[k], set: (v) => (st.mom.Q[k] = v), unit: Lu }));
      }
    } else if (st.mode === 'reduce') {
      sec = C.section(c, 'Forces');
      list(st.red.forces, (it, i) => `F${i + 1}`, (it) => fields2(it, F, Lu, true), () => new2(), 6);
      sec = C.section(c, 'Couple moments');
      C.list(sec, { items: st.red.couples, max: 4, title: (it, i) => `Couple ${i + 1}`, fields: () => [{ key: 'M', label: 'Moment M', unit: FL }, { key: 'dir', label: 'Direction', options: [['cw', 'Clockwise ↻'], ['ccw', 'Counterclockwise ↺']] }, { key: 'x', label: 'Drawn at x', unit: Lu }, { key: 'y', label: 'Drawn at y', unit: Lu }], add: [['Couple', () => ({ M: 10, dir: 'cw', x: 0, y: 0 })]] });
      sec = C.section(c, 'Point O');
      point(sec, C, 'The system is reduced to a force and a couple at O.', st.red.O, Lu, false);
    } else if (st.mode === 'reduce3d') {
      sec = C.section(c, 'Forces');
      list(st.r3.forces, (it, i) => `F${i + 1}`, (it) => fields3(it, F, Lu, true), () => new3(), 5);
      sec = C.section(c, 'Couple moments');
      C.list(sec, { items: st.r3.couples, max: 3, title: (it, i) => `Couple ${i + 1}`, fields: () => [{ key: 'Mx', label: 'M_x', unit: FL }, { key: 'My', label: 'M_y', unit: FL }, { key: 'Mz', label: 'M_z', unit: FL, wide: true }], add: [['Couple', () => ({ Mx: 0, My: 0, Mz: 10 })]] });
      sec = C.section(c, 'Point O');
      point(sec, C, 'The system is reduced to a force and a couple at O.', st.r3.O, Lu, true);
    } else {
      sec = C.section(c, 'Distributed loads');
      C.note(sec, 'Each load varies linearly from w₁ at x₁ to w₂ at x₂. Loads are positive downward.');
      C.list(sec, { items: st.dist.segs, max: 5, min: 1, title: (it, i) => `Load ${i + 1}`, fields: () => [{ key: 'x1', label: 'From x₁', unit: Lu }, { key: 'x2', label: 'To x₂', unit: Lu }, { key: 'w1', label: 'w₁', unit: `${F}/${Lu}` }, { key: 'w2', label: 'w₂', unit: `${F}/${Lu}` }], add: [['Load', () => { const l = st.dist.segs[st.dist.segs.length - 1]; return { x1: l ? l.x2 : 0, x2: tidy((l ? l.x2 : 0) + 2), w1: 10, w2: 10 }; }]] });
    }
  };

  M.compute = (U) => Forces.solve(S(), U);
  M.onUnits = (from, to) => Forces.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ coplanar: 'Forces and the force polygon', vector3d: 'Top and front views', dot: 'Top and front views', moment: 'Forces and moment', reduce: 'Force system and its equivalent', reduce3d: 'Top and front views', dist: 'Distributed loads and their resultant' }[mode()]);
  M.cap3D = '3D view';
  M.hint = () => ({
    coplanar: 'Thin coloured arrows are the forces drawn from the origin; the dashed chain adds them tip to tail, and the thick green arrow is the resultant.',
    vector3d: 'The top view looks down the z axis and the front view looks along the y axis. Use the 3D view to see the vectors in space.',
    dot: 'The orange arrow is the component of the force along the line PQ.',
    moment: 'Dashed lines are the position vectors r from O. The purple double-headed arrow is the moment vector, by the right-hand rule.',
    reduce: 'Red: the given forces and couples. Green: the equivalent force and couple at O. Purple dashed: the line of action of the single resultant.',
    reduce3d: 'Green: the resultant force at O. Purple double-headed arrow: the couple moment at O. The dashed purple line is the axis of the single resultant or wrench.',
    dist: 'The green arrow is the resultant. It acts through the centroid of the total load area.',
  }[mode()]);
  M.legend = () => ({
    coplanar: [[FC[0], 'Forces'], [RCOL, 'Resultant F_R'], ['#5a6b75', 'Tip-to-tail chain', 'ln']],
    vector3d: [[FC[0], 'Forces'], [RCOL, 'Resultant']],
    dot: [[FC[0], 'Force F'], ['#34495e', 'Line PQ', 'ln'], [ACOL, 'Component along PQ']],
    moment: [[FC[0], 'Forces'], ['#5a6b75', 'Position vectors r', 'ln'], [MCOL, 'Moment M_O'], [ACOL, 'Axis', 'ln']],
    reduce: [[COL.load, 'Given forces and couples'], [RCOL, 'Equivalent at O'], [MCOL, 'Single resultant', 'ln']],
    reduce3d: [[FC[0], 'Forces'], [RCOL, 'Resultant F_R'], [MCOL, 'Couple moment']],
    dist: [[COL.load, 'Distributed load', 'sq'], [RCOL, 'Resultant F_R']],
  }[mode()]);
  M.anim = null;

  /* ------------------------------------------------------------------ */
  /* 2D helpers                                                         */
  /* ------------------------------------------------------------------ */
  function arcArrow(g, cx, cy, r, a0, a1, color, w) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    s('polyline', { points: pts.slice(0, n).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': w || 2.2, 'stroke-linecap': 'round' }, g);
    const e = pts[n], q = pts[n - 3], L = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1, ux = (e[0] - q[0]) / L, uy = (e[1] - q[1]) / L, hs = 9, px = -uy, py = ux;
    s('polygon', { points: `${e[0]},${e[1]} ${e[0] - ux * hs + px * hs * 0.45},${e[1] - uy * hs + py * hs * 0.45} ${e[0] - ux * hs - px * hs * 0.45},${e[1] - uy * hs - py * hs * 0.45}`, fill: color }, g);
  }
  /** A couple arc at world point p: counterclockwise when M > 0. */
  function couple(D, p, Mv, color, label) {
    const x = D.X(p[0]), y = D.Y(p[1]), ccw = Mv > 0;
    arcArrow(D.root, x, y, 22, ccw ? -40 : 220, ccw ? 220 : -40, color, 2.4);
    if (label) D.text([x, y - 30], label, { px: true, anchor: 'middle', color, size: 12, weight: 700 });
  }
  function axes2(D, b, names) {
    D.line([b.xmin, 0], [b.xmax, 0], { stroke: '#8c99a3', sw: 1 }); D.line([0, b.ymin], [0, b.ymax], { stroke: '#8c99a3', sw: 1 });
    D.head(D.X(b.xmax), D.Y(0), 1, 0, '#8c99a3', 8); D.head(D.X(0), D.Y(b.ymax), 0, -1, '#8c99a3', 8);
    D.text([b.xmax, 0], names[0], { dx: -2, dy: 15, anchor: 'end', color: '#5a6b75', weight: 700 }); D.text([0, b.ymax], names[1], { dx: 8, dy: 10, color: '#5a6b75', weight: 700 });
  }
  const bbox = (pts, padFrac) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let b = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
    const e = Math.max(b.xmax - b.xmin, b.ymax - b.ymin, 1e-9), m = e * (padFrac || 0.15);
    return { xmin: b.xmin - m, xmax: b.xmax + m, ymin: b.ymin - m, ymax: b.ymax + m, ext: e };
  };

  const twoViews = Charts.twoViews;

  /* ------------------------------------------------------------------ */
  /* 2D diagrams                                                        */
  /* ------------------------------------------------------------------ */
  function drawCoplanar(svg, g, opt) {
    const F = g.c.F, chain = [[0, 0]];
    g.vecs.forEach((v) => { const l = chain[chain.length - 1]; chain.push([l[0] + v[0], l[1] + v[1]]); });
    const b = bbox(g.vecs.concat(chain, [[0, 0], g.R]), 0.2);
    const D = UI.Draw2D(svg, b, { pad: 40 });
    axes2(D, b, ['x', 'y']);
    for (let i = 0; i < g.vecs.length; i++) D.arrow(chain[i], chain[i + 1], { color: '#5a6b75', w: 1.4, dash: '6 4', head: 8 });
    g.vecs.forEach((v, i) => D.arrow([0, 0], v, { color: FC[i % FC.length], w: 2.4, label: opt.showP ? `F${i + 1} = ${fmt(Math.hypot(...v))} ${F}` : `F${i + 1}`, lp: 'head', size: 12 }));
    if (g.FR > 0) D.arrow([0, 0], g.R, { color: RCOL, w: 4, head: 14, label: opt.showP ? `F_R = ${fmt(g.FR)} ${F} at ${fmt(g.th)}°` : 'F_R', lp: 'head', size: 13 });
    D.dot([0, 0], '#1d2733', 'O', { r: 3.5, dx: -14, dy: 14 });
  }
  function drawPlanarMoment(svg, g, opt) {
    const { F, Lu, FL } = g.c, O = g.O, rows = g.rows;
    const pts = rows.map((r) => [r.p[0], r.p[1]]).concat([[O[0], O[1]]]);
    const b0 = bbox(pts, 0.1), e = Math.max(b0.ext, 1e-9), Fmax = Math.max(...rows.map((r) => mag(r.v)), 1e-300), k = (0.4 * e) / Fmax;
    const b = bbox(pts.concat(rows.map((r) => [r.p[0] - r.v[0] * k, r.p[1] - r.v[1] * k])), 0.22);
    const D = UI.Draw2D(svg, b, { pad: 40 });
    rows.forEach((r, i) => {
      const fm = mag(r.v), col = FC[i % FC.length];
      // moment arm: from O perpendicular to the line of action
      if (fm > 0) {
        const u = [r.v[0] / fm, r.v[1] / fm], w = [O[0] - r.p[0], O[1] - r.p[1]], t = w[0] * u[0] + w[1] * u[1], foot = [r.p[0] + u[0] * t, r.p[1] + u[1] * t];
        D.line([r.p[0] - u[0] * e * 2, r.p[1] - u[1] * e * 2], [r.p[0] + u[0] * e * 2, r.p[1] + u[1] * e * 2], { stroke: col, sw: 0.9, dash: '3 4', op: 0.6 });
        const d = Math.hypot(foot[0] - O[0], foot[1] - O[1]);
        if (d > e * 1e-3) { D.line([O[0], O[1]], foot, { stroke: MCOL, sw: 1.4 }); if (opt.showP) D.text([(O[0] + foot[0]) / 2, (O[1] + foot[1]) / 2], `d = ${fmt(d)} ${Lu}`, { dx: 6, dy: -4, color: MCOL, size: 11.5 }); }
      }
      D.line([O[0], O[1]], [r.p[0], r.p[1]], { stroke: '#5a6b75', sw: 1.2, dash: '6 4' });
      D.arrow([r.p[0] - r.v[0] * k, r.p[1] - r.v[1] * k], [r.p[0], r.p[1]], { color: col, w: 2.8, head: 12, label: opt.showP ? `F${i + 1} = ${fmt(fm)} ${F}` : `F${i + 1}`, size: 12 });
    });
    D.dot([O[0], O[1]], '#1d2733', 'O', { r: 4, dx: -14, dy: 16 });
    if (Math.abs(g.MO[2]) > 0) couple(D, [O[0], O[1]], g.MO[2], MCOL, opt.showP ? `M_O = ${fmt(Math.abs(g.MO[2]))} ${FL} ${g.MO[2] > 0 ? '↺' : '↻'}` : 'M_O');
  }
  function drawReduce(svg, g, opt) {
    const { F, Lu, FL } = g.c, O = g.O, pts = g.rows.map((r) => [r.x, r.y]).concat(g.couples.map((m) => [m.x, m.y]), [O]);
    const b0 = bbox(pts, 0.1), e = Math.max(b0.ext, 1), b = { xmin: b0.xmin - e * 0.25, xmax: b0.xmax + e * 0.25, ymin: b0.ymin - e * 0.45, ymax: b0.ymax + e * 0.45 };
    const D = UI.Draw2D(svg, b, { pad: 40 });
    const Fmax = Math.max(...g.rows.map((r) => r.F), g.FR, 1e-300), len = (f) => 30 + 45 * (f / Fmax);
    // a light reference line through O, like a beam axis
    D.line([b.xmin + e * 0.1, O[1]], [b.xmax - e * 0.1, O[1]], { stroke: '#c4ced4', sw: 6, op: 0.7 });
    g.rows.forEach((r, i) => { if (r.F > 0) D.force([r.x, r.y], [r.Fx, r.Fy], len(r.F), { color: COL.load, w: 2.6, head: 11, label: opt.showP ? `${fmt(r.F)} ${F}` : `F${i + 1}`, size: 12, ldx: 4, ldy: -6 }); D.dot([r.x, r.y], COL.load, null, { r: 2.5 }); });
    g.couples.forEach((m, i) => { if (m.M) couple(D, [m.x, m.y], m.M, COL.load, opt.showP ? `${fmt(Math.abs(m.M))} ${FL}` : `M${i + 1}`); });
    D.dot(O, '#1d2733', 'O', { r: 4, dx: -14, dy: 16 });
    if (g.FR > 0) {
      const at = [O[0], O[1]];
      D.force(at, g.R, len(g.FR), { color: RCOL, w: 3.6, head: 13, label: opt.showP ? `F_R = ${fmt(g.FR)} ${F}` : 'F_R', size: 12.5, ldx: D.X(at[0]) < 140 ? 6 : -6, ldy: D.X(at[0]) < 140 ? 16 : -6, anchor: D.X(at[0]) < 140 ? 'start' : 'end' });
      if (g.line) {
        const u = [g.R[0] / g.FR, g.R[1] / g.FR], p = g.R[1] ? [g.line.hit.x, O[1]] : [O[0], g.line.hit.y];
        D.line([p[0] - u[0] * e * 3, p[1] - u[1] * e * 3], [p[0] + u[0] * e * 3, p[1] + u[1] * e * 3], { stroke: MCOL, sw: 1.6, dash: '8 5' });
        D.force(p, g.R, len(g.FR), { color: MCOL, w: 3, head: 12, label: opt.showP ? `single resultant at ${g.R[1] ? 'x' : 'y'} = ${fmt(g.R[1] ? p[0] : p[1])} ${Lu}` : 'single resultant', size: 12, ldx: 6 });
        D.dot(p, MCOL, null, { r: 4 });
      }
    }
    if (g.MR) couple(D, O, g.MR, RCOL, opt.showP ? `(M_R)_O = ${fmt(Math.abs(g.MR))} ${FL} ${g.MR > 0 ? '↺' : '↻'}` : '(M_R)_O');
  }
  function drawDist(svg, g, opt) {
    const { F, Lu } = g.c, segs = g.segs, xa = Math.min(0, ...segs.map((q) => q.x1)), xb = Math.max(...segs.map((q) => q.x2)), L = xb - xa;
    const { W, H } = Charts.clear(svg), ml = 50, mr = 40, X = (x) => ml + ((x - xa) / L) * (W - ml - mr);
    const wmax = Math.max(...segs.map((q) => Math.max(Math.abs(q.w1), Math.abs(q.w2))), 1e-300), yb = Math.min(H * 0.55, H - 160), hh = Math.min(yb - 50, 150), Yw = (w) => yb - 8 - (w / wmax) * hh;
    const g0 = s('g', {}, svg);
    s('rect', { x: X(xa), y: yb - 8, width: X(xb) - X(xa), height: 16, fill: COL.body, stroke: COL.bodyEdge, 'stroke-width': 1.4 }, g0);
    segs.forEach((q) => {
      s('polygon', { points: `${X(q.x1)},${yb - 8} ${X(q.x1)},${Yw(q.w1)} ${X(q.x2)},${Yw(q.w2)} ${X(q.x2)},${yb - 8}`, fill: COL.load, 'fill-opacity': 0.14, stroke: COL.load, 'stroke-width': 1.3 }, g0);
      const n = Math.max(2, Math.round((X(q.x2) - X(q.x1)) / 22));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = X(q.x1) + (X(q.x2) - X(q.x1)) * t, yw = Yw(q.w1 + (q.w2 - q.w1) * t), h = yb - 8 - yw;
        if (Math.abs(h) > 10) { const down = h > 0; s('line', { x1: x, y1: yw, x2: x, y2: yb - 8 - (down ? 6 : -6), stroke: COL.load, 'stroke-width': 1.2 }, g0); s('polygon', { points: down ? `${x},${yb - 8} ${x - 3.5},${yb - 15} ${x + 3.5},${yb - 15}` : `${x},${yb - 8} ${x - 3.5},${yb - 1} ${x + 3.5},${yb - 1}`, fill: COL.load }, g0); }
      }
      if (opt.showP) {
        if (q.w1) T(g0, X(q.x1) + 4, Yw(q.w1) - 6, `${fmt(q.w1)} ${F}/${Lu}`, { color: COL.load, size: 11.5 });
        if (q.w2 !== q.w1 && q.w2) T(g0, X(q.x2) - 4, Yw(q.w2) - 6, `${fmt(q.w2)} ${F}/${Lu}`, { color: COL.load, size: 11.5, anchor: 'end' });
      }
    });
    // parts (dashed) and resultant
    g.parts.forEach((p) => s('line', { x1: X(p.x), y1: yb + 14, x2: X(p.x), y2: yb + 30, stroke: '#7f8c8d', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g0));
    if (g.xbar !== null) {
      // equivalent loading: the same beam with the single resultant
      const x = X(g.xbar), down = g.FR > 0, ye = yb + 96;
      T(g0, X(xa), ye - 44, 'Equivalent resultant', { color: '#5a6b75', size: 11.5, weight: 700 });
      s('rect', { x: X(xa), y: ye - 6, width: X(xb) - X(xa), height: 12, fill: COL.body, stroke: COL.bodyEdge, 'stroke-width': 1.2, opacity: 0.8 }, g0);
      const ya = down ? ye - 52 : ye - 6, yh = down ? ye - 6 : ye - 52;
      s('line', { x1: x, y1: ya, x2: x, y2: yh + (down ? -12 : 12), stroke: RCOL, 'stroke-width': 3.4 }, g0);
      s('polygon', { points: down ? `${x},${yh} ${x - 6},${yh - 13} ${x + 6},${yh - 13}` : `${x},${yh} ${x - 6},${yh + 13} ${x + 6},${yh + 13}`, fill: RCOL }, g0);
      T(g0, x + (x > W * 0.65 ? -8 : 8), ye - 30, opt.showP ? `F_R = ${fmt(Math.abs(g.FR))} ${F}${down ? '' : ' (upward)'}` : 'F_R', { color: RCOL, size: 12.5, weight: 700, anchor: x > W * 0.65 ? 'end' : 'start' });
      s('line', { x1: X(xa), y1: ye + 22, x2: x, y2: ye + 22, stroke: COL.dim, 'stroke-width': 1 }, g0);
      [X(xa), x].forEach((xx) => s('line', { x1: xx, y1: ye + 16, x2: xx, y2: ye + 28, stroke: COL.dim, 'stroke-width': 1 }, g0));
      T(g0, (X(xa) + x) / 2, ye + 40, `x̄ = ${fmt(g.xbar - xa)} ${Lu}${xa ? ' from the left end' : ''}`, { anchor: 'middle', color: COL.dim, size: 11.5 });
    }
    const ev = [...new Set([xa, xb].concat(...segs.map((q) => [q.x1, q.x2])))].sort((p, q) => p - q);
    ev.forEach((x) => T(g0, X(x), yb + 24, fmt(x), { anchor: 'middle', color: '#5a6b75', size: 10.5, weight: 400 }));
    T(g0, ml - 8, yb + 24, 'x =', { anchor: 'end', color: '#5a6b75', size: 10.5, weight: 400 });
  }
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, F = g.c.F, FL = g.c.FL;
    if (g.kind === 'coplanar') return drawCoplanar(svg, g, opt);
    if (g.kind === 'reduce') return drawReduce(svg, g, opt);
    if (g.kind === 'dist') return drawDist(svg, g, opt);
    if (g.kind === 'moment' && g.planar) return drawPlanarMoment(svg, g, opt);
    const items = [], lab = (n, v, u) => (opt.showP ? `${n} = ${fmt(v)} ${u}` : n);
    if (g.kind === 'vector3d') {
      const ext = Math.max(...g.vecs.map(mag), g.FR, 1e-300);
      g.vecs.forEach((v, i) => items.push({ a: [0, 0, 0], b: v, color: FC[i % FC.length], label: lab(`F${i + 1}`, mag(v), F) }));
      if (g.vecs.length > 1 && g.FR > 0) items.push({ a: [0, 0, 0], b: g.R, color: RCOL, w: 3.6, label: lab('F_R', g.FR, F) });
      items.push({ a: [0, 0, 0], b: [ext * 0.001, 0, 0], kind: 'dot', color: '#1d2733', label: 'O' });
    } else if (g.kind === 'dot') {
      const e = Math.max(mag(sub(g.Q, g.P)), mag(g.A), 1), k = (0.6 * e) / mag(g.Fv);
      items.push({ a: g.P, b: add(g.Q, mul(g.u, e * 0.3)), kind: 'line', color: '#34495e', w: 1.4, dash: '8 4' });
      items.push({ a: g.P, kind: 'dot', color: '#34495e', label: 'P' }, { a: g.Q, kind: 'dot', color: '#34495e', label: 'Q' });
      items.push({ a: g.A, b: add(g.A, mul(g.Fv, k)), color: FC[0], w: 3, label: lab('F', mag(g.Fv), F) });
      items.push({ a: g.A, b: add(g.A, mul(g.u, g.Fpar * k)), color: ACOL, w: 3, label: lab('F_∥', g.Fpar, F) });
    } else if (g.kind === 'moment') {
      const e = Math.max(...g.rows.map((r) => mag(sub(r.p, g.O))), 1), Fm = Math.max(...g.rows.map((r) => mag(r.v)), 1e-300), k = (0.45 * e) / Fm;
      g.rows.forEach((r, i) => { items.push({ a: g.O, b: r.p, kind: 'line', color: '#5a6b75', w: 1.2, dash: '6 4' }); items.push({ a: r.p, b: add(r.p, mul(r.v, k)), color: FC[i % FC.length], w: 2.8, label: lab(`F${i + 1}`, mag(r.v), F) }); });
      const MOm = mag(g.MO); if (MOm > 0) items.push({ a: g.O, b: add(g.O, mul(g.MO, (0.5 * e) / MOm)), kind: 'moment', color: MCOL, w: 2.8, label: lab('M_O', MOm, FL) });
      items.push({ a: g.O, kind: 'dot', color: '#1d2733', label: 'O' });
      if (g.axis) items.push({ a: sub(g.axis.P, mul(g.axis.u, e * 0.3)), b: add(g.axis.Q, mul(g.axis.u, e * 0.3)), color: ACOL, w: 1.6, dash: '10 4 2 4', label: lab('M_a', g.axis.Ma, FL) });
    } else if (g.kind === 'reduce3d') {
      const e = Math.max(...g.rows.map((r) => mag(sub(r.p, g.O))), 1), Fm = Math.max(...g.rows.map((r) => mag(r.v)), mag(g.FRv), 1e-300), k = (0.45 * e) / Fm;
      g.rows.forEach((r, i) => items.push({ a: r.p, b: add(r.p, mul(r.v, k)), color: FC[i % FC.length], w: 2.4, label: lab(`F${i + 1}`, mag(r.v), F) }));
      if (mag(g.FRv) > 0) items.push({ a: g.O, b: add(g.O, mul(g.FRv, k)), color: RCOL, w: 3.6, label: lab('F_R', mag(g.FRv), F) });
      const MR = mag(g.MRv); if (MR > 0) items.push({ a: g.O, b: add(g.O, mul(g.MRv, (0.5 * e) / MR)), kind: 'moment', color: MCOL, w: 2.8, label: lab('(M_R)_O', MR, FL) });
      if (g.wrench) items.push({ a: sub(g.wrench.pt, mul(g.wrench.u, e * 0.6)), b: add(g.wrench.pt, mul(g.wrench.u, e * 0.6)), kind: 'line', color: MCOL, w: 1.4, dash: '8 5' });
      items.push({ a: g.O, kind: 'dot', color: '#1d2733', label: 'O' });
    }
    twoViews(svg, items);
  };

  /* ------------------------------------------------------------------ */
  /* 3D views: book axes (x, y, z) with z up are drawn as view (x, z, −y) */
  /* ------------------------------------------------------------------ */
  const V = (p) => [p[0], p[2], -p[1]];
  function arrow3(v, a, b, color, lw, dbl) {
    const d = sub(b, a), L = mag(d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = mul(d, 1 / L), hs = Math.min(L * 0.25, v._hs || L * 0.12);
    const n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
    const head = (tip) => { const base = sub(tip, mul(u, hs)); [1, -1].forEach((sg) => v.line([tip, add(base, mul(c, sg * hs * 0.4))], color, lw || 2.4)); };
    head(b); if (dbl) head(sub(b, mul(u, hs * 0.7)));
  }
  function axes3(v, e, flat) {
    const L = e * 0.75;
    arrow3(v, [0, 0, 0], [L, 0, 0], '#8c99a3', 1.2); v.label([L * 1.07, 0, 0], 'x', '#5a6b75');
    if (flat) { arrow3(v, [0, 0, 0], [0, L, 0], '#8c99a3', 1.2); v.label([0, L * 1.07, 0], 'y', '#5a6b75'); return; }
    arrow3(v, [0, 0, 0], V([0, L, 0]), '#8c99a3', 1.2); v.label(V([0, L * 1.07, 0]), 'y', '#5a6b75');
    arrow3(v, [0, 0, 0], V([0, 0, L]), '#8c99a3', 1.2); v.label(V([0, 0, L * 1.07]), 'z', '#5a6b75');
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, { F, FL } = g.c, lab = (n, val, u) => (opt.showP ? `${n} = ${fmt(val)} ${u}` : n);
    if (g.kind === 'coplanar' || g.kind === 'reduce') {
      // a planar problem drawn in its own plane
      if (g.kind === 'coplanar') {
        const e = Math.max(...g.vecs.map((p) => Math.hypot(...p)), g.FR, 1e-300); v._hs = e * 0.07; axes3(v, e, true);
        g.vecs.forEach((p, i) => { arrow3(v, [0, 0, 0], [p[0], p[1], 0], FC[i % FC.length], 2.6); v.label([p[0], p[1], 0], lab(`F${i + 1}`, Math.hypot(...p), F), FC[i % FC.length]); });
        if (g.FR > 0) { arrow3(v, [0, 0, 0], [g.R[0], g.R[1], 0], RCOL, 4); v.label([g.R[0], g.R[1], 0], lab('F_R', g.FR, F), RCOL); }
        v.face([[-e, -e, -e * 0.002], [e, -e, -e * 0.002], [e, e, -e * 0.002], [-e, e, -e * 0.002]], '#eef2f4', 0.6, '#d3dce0');
      } else {
        const pts = g.rows.map((r) => [r.x, r.y]).concat([g.O]), b = bbox(pts, 0.1), e = Math.max(b.ext, 1), Fm = Math.max(...g.rows.map((r) => r.F), g.FR, 1e-300), k = (0.35 * e) / Fm; v._hs = e * 0.05;
        v.box(b.xmin, g.O[1] - e * 0.025, -e * 0.05, b.xmax, g.O[1] + e * 0.025, e * 0.05, '#c9d3dc', 1, '#4a5661');
        g.rows.forEach((r) => { arrow3(v, [r.x - r.Fx * k, r.y - r.Fy * k, 0.06 * e], [r.x, r.y, 0.06 * e], COL.load, 2.6); if (opt.showP) v.label([r.x - r.Fx * k, r.y - r.Fy * k, 0.06 * e], `${fmt(r.F)} ${F}`, COL.load); });
        if (g.FR > 0) { arrow3(v, [g.O[0] - g.R[0] * k, g.O[1] - g.R[1] * k, 0.06 * e], [g.O[0], g.O[1], 0.06 * e], RCOL, 3.4); v.label([g.O[0] - g.R[0] * k, g.O[1] - g.R[1] * k, 0.06 * e], lab('F_R', g.FR, F), RCOL); }
        if (g.MR) { arrow3(v, [g.O[0], g.O[1], 0], [g.O[0], g.O[1], Math.sign(g.MR) * e * 0.35], MCOL, 2.6, true); v.label([g.O[0], g.O[1], Math.sign(g.MR) * e * 0.38], lab('(M_R)_O', Math.abs(g.MR), FL), MCOL); }
        if (g.line) { const p = g.R[1] ? [g.line.hit.x, g.O[1], 0.06 * e] : [g.O[0], g.line.hit.y, 0.06 * e]; arrow3(v, [p[0] - g.R[0] * k, p[1] - g.R[1] * k, p[2]], p, MCOL, 2.6); v.label([p[0] - g.R[0] * k, p[1] - g.R[1] * k, p[2]], 'single resultant', MCOL); }
        v.label([g.O[0], g.O[1], 0], 'O', '#1d2733');
      }
      v.autoBounds(); return;
    }
    if (g.kind === 'dist') {
      const segs = g.segs, xa = Math.min(0, ...segs.map((q) => q.x1)), xb = Math.max(...segs.map((q) => q.x2)), L = xb - xa, d = L / 25, w = L / 10, wm = Math.max(...segs.map((q) => Math.max(Math.abs(q.w1), Math.abs(q.w2))), 1e-300), hl = L / 5;
      v._hs = L / 30;
      v.box(xa, -d, -w / 2, xb, 0, w / 2, '#b9c2cb', 1, '#4a5661');
      segs.forEach((q) => v.extrude([[q.x1, 0], [q.x1, (q.w1 / wm) * hl], [q.x2, (q.w2 / wm) * hl], [q.x2, 0]], -w / 2, w / 2, '#c0392b', 0.22, '#c0392b'));
      if (g.xbar !== null) { const zf = w * 0.9, top = hl * 1.25, dn = g.FR > 0; arrow3(v, [g.xbar, dn ? top : 0, zf], [g.xbar, dn ? 0 : top, zf], RCOL, 3.4); v.label([g.xbar, top * 1.06, zf], lab('F_R', Math.abs(g.FR), F) + (opt.showP ? ` at x̄ = ${fmt(g.xbar)} ${g.c.Lu}` : ''), RCOL); }
      v.autoBounds(); return;
    }
    // genuinely 3D modes
    let e = 1;
    const pts = [[0, 0, 0]];
    if (g.kind === 'vector3d') g.vecs.forEach((p) => pts.push(p)); else if (g.kind === 'dot') pts.push(g.P, g.Q, g.A); else pts.push(g.O, ...g.rows.map((r) => r.p));
    e = Math.max(...pts.map(mag), ...(g.kind === 'vector3d' ? [g.FR] : []), 1e-300);
    v._hs = e * 0.06; axes3(v, e);
    if (g.kind === 'vector3d') {
      g.vecs.forEach((p, i) => {
        arrow3(v, [0, 0, 0], V(p), FC[i % FC.length], 2.8); v.label(V(p), lab(`F${i + 1}`, mag(p), F), FC[i % FC.length]);
        // component box
        const q = V(p); v.line([[q[0], 0, 0], [q[0], 0, q[2]], [0, 0, q[2]]], '#b0bcc4', 1, [3, 3]); v.line([[q[0], 0, q[2]], q], '#b0bcc4', 1, [3, 3]);
        const ln = g.lines[i]; if (ln) { v.line([V(ln.A), V(ln.B)], '#34495e', 1.2, [6, 4]); v.label(V(ln.B), 'B', '#34495e'); }
      });
      if (g.vecs.length > 1 && g.FR > 0) { arrow3(v, [0, 0, 0], V(g.R), RCOL, 4); v.label(V(g.R), lab('F_R', g.FR, F), RCOL); }
    } else if (g.kind === 'dot') {
      const k = (0.6 * e) / mag(g.Fv);
      v.line([V(g.P), V(add(g.Q, mul(g.u, e * 0.3)))], '#34495e', 1.6, [8, 4]); v.label(V(g.P), 'P', '#34495e'); v.label(V(g.Q), 'Q', '#34495e');
      arrow3(v, V(g.A), V(add(g.A, mul(g.Fv, k))), FC[0], 3); v.label(V(add(g.A, mul(g.Fv, k))), lab('F', mag(g.Fv), F), FC[0]);
      const tip = add(g.A, mul(g.u, g.Fpar * k)); arrow3(v, V(g.A), V(tip), ACOL, 3); v.label(V(tip), lab('F_∥', g.Fpar, F), ACOL);
      v.line([V(add(g.A, mul(g.Fv, k))), V(tip)], '#b0bcc4', 1, [3, 3]);
    } else {
      const rows = g.rows, Fm = Math.max(...rows.map((r) => mag(r.v)), g.FRv ? mag(g.FRv) : 0, 1e-300), k = (0.45 * e) / Fm;
      rows.forEach((r, i) => { v.line([V(g.O), V(r.p)], '#8c99a3', 1.2, [6, 4]); arrow3(v, V(r.p), V(add(r.p, mul(r.v, k))), FC[i % FC.length], 2.8); v.label(V(add(r.p, mul(r.v, k))), lab(`F${i + 1}`, mag(r.v), F), FC[i % FC.length]); });
      const Mv = g.kind === 'moment' ? g.MO : g.MRv, Mm = mag(Mv);
      if (Mm > 0) { const tip = add(g.O, mul(Mv, (0.5 * e) / Mm)); arrow3(v, V(g.O), V(tip), MCOL, 2.8, true); v.label(V(tip), lab(g.kind === 'moment' ? 'M_O' : '(M_R)_O', Mm, FL), MCOL); }
      if (g.kind === 'reduce3d' && mag(g.FRv) > 0) { const tip = add(g.O, mul(g.FRv, k)); arrow3(v, V(g.O), V(tip), RCOL, 3.6); v.label(V(tip), lab('F_R', mag(g.FRv), F), RCOL); }
      if (g.kind === 'reduce3d' && g.wrench) v.line([V(sub(g.wrench.pt, mul(g.wrench.u, e * 0.6))), V(add(g.wrench.pt, mul(g.wrench.u, e * 0.6)))], MCOL, 1.6, [8, 5]);
      if (g.kind === 'moment' && g.axis) { v.line([V(sub(g.axis.P, mul(g.axis.u, e * 0.3))), V(add(g.axis.Q, mul(g.axis.u, e * 0.3)))], ACOL, 1.8, [10, 4, 2, 4]); v.label(V(add(g.axis.Q, mul(g.axis.u, e * 0.3))), lab('M_a', g.axis.Ma, FL), ACOL); }
      v.label(V(g.O), 'O', '#1d2733');
    }
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P = (F, ang, o) => new2(Object.assign({ by: 'polar', F, ang }, o)), C2 = (Fx, Fy, o) => new2(Object.assign({ by: 'comp', Fx, Fy }, o));
  M.presets = [
    { name: 'Test: two forces 100 N at 15° and 150 N at 80°, F_R = 212.6 N at 54.76°', units: 'SI',
      state: { mode: 'coplanar', fu: 'N', co: { forces: [P(100, 15), P(150, 80)] } }, expect: [{ k: 'Resultant magnitude F_R', v: 212.6 }, { k: 'Direction θ (↺ from +x)', v: 54.76 }] },
    { name: 'Test: three forces, one on a 3-4-5 slope, F_R = 484.7 N at 142.2°', units: 'SI',
      state: { mode: 'coplanar', fu: 'N', co: { forces: [P(400, 180), P(250, 45), new2({ by: 'slope', F: 200, dx: -4, dy: 3 })] } }, expect: [{ k: 'Resultant magnitude F_R', v: 484.7 }, { k: 'Resultant (F_R)_x', v: -383.2 }, { k: 'Resultant (F_R)_y', v: 296.8 }] },
    { name: 'Three equal forces 120° apart are in balance', units: 'US',
      state: { mode: 'coplanar', fu: 'lb', co: { forces: [P(50, 90), P(50, 210), P(50, 330)] } } },
    { name: 'Test: Cartesian vector 35.36i − 35.36j + 86.60k lb, |F| = 100 lb, α = 69.30°, γ = 30.00°', units: 'US',
      state: { mode: 'vector3d', fu: 'lb', v3: { forces: [new3({ by: 'comp', Fx: 35.36, Fy: -35.36, Fz: 86.6 })] } }, expect: [{ k: 'Magnitude F', v: 100 }, { k: 'Direction angle α (from +x)', v: 69.30 }, { k: 'Direction angle β (from +y)', v: 110.7 }, { k: 'Direction angle γ (from +z)', v: 30.00 }] },
    { name: 'Resultant of a cable force along a line and a force by direction angles', units: 'SI',
      state: { mode: 'vector3d', fu: 'kN', v3: { forces: [new3({ by: 'line', F: 7, ax: 0, ay: 0, az: 0, bx: 2, by_: -3, bz: 6 }), new3({ by: 'angles', F: 5, al: 60, be: 45, ga: 120 })] } } },
    { name: 'Test: 300 N force along A → B(2, 3, 6) m, component along the y axis = 128.6 N', units: 'SI',
      state: { mode: 'dot', fu: 'N', dot: { force: new3({ by: 'line', F: 300, ax: 0, ay: 0, az: 0, bx: 2, by_: 3, bz: 6 }), P: { x: 0, y: 0, z: 0 }, Q: { x: 0, y: 4, z: 0 } } }, expect: [{ k: 'Component along the line F_∥', v: 128.6 }, { k: 'Angle θ between the force and the line', v: 64.62 }] },
    { name: 'Test: F = 10k N at (2, 3, 0) m, M_O = 30i − 20j N·m, moment about x = 30 N·m', units: 'SI',
      state: { mode: 'moment', fu: 'N', mom: { forces: [new3({ by: 'comp', Fx: 0, Fy: 0, Fz: 10, x: 2, y: 3, z: 0 })], O: { x: 0, y: 0, z: 0 }, axis: true, P: { x: 0, y: 0, z: 0 }, Q: { x: 1, y: 0, z: 0 } } },
      expect: [{ k: 'M_O x component', v: 30 }, { k: 'M_O y component', v: -20 }, { k: 'Moment about the axis M_a (along +u_a)', v: 30 }] },
    { name: 'Wrench on a bolt: 100 N at 60° on a 0.3 m handle, moment about the bolt', units: 'SI',
      state: { mode: 'moment', fu: 'N', mom: { forces: [new3({ by: 'comp', Fx: 50, Fy: 86.6, Fz: 0, x: 0.3, y: 0, z: 0 })], O: { x: 0, y: 0, z: 0 }, axis: false, P: { x: 0, y: 0, z: 0 }, Q: { x: 0, y: 0, z: 1 } } } },
    { name: 'Test: beam with three loads and a couple, F_R = 5.367 kN at 26.57°, crosses the beam at 2.25 m', units: 'SI',
      state: { mode: 'reduce', fu: 'kN', red: { forces: [P(4, 270, { x: 1.5, y: 0 }), C2(4.8, 6.4, { x: 4.5, y: 0.5 })], couples: [{ M: 15, dir: 'cw', x: 3, y: 0 }], O: { x: 0, y: 0 } } },
      expect: [{ k: 'Resultant force F_R', v: 5.367 }, { k: 'Direction θ (↺ from +x)', v: 26.57 }, { k: 'Line of action crosses the horizontal through O at x', v: 2.25 }] },
    { name: 'Test: three parallel column loads on a slab, single resultant at x = 0.75 m, y = 0.625 m', units: 'SI',
      state: { mode: 'reduce3d', fu: 'kN', r3: { forces: [new3({ Fx: 0, Fy: 0, Fz: -800 }), new3({ Fx: 0, Fy: 0, Fz: -300, x: 4 }), new3({ Fx: 0, Fy: 0, Fz: -500, y: 2 })], couples: [], O: { x: 0, y: 0, z: 0 } } },
      expect: [{ k: 'Single resultant acts at x', v: 0.75 }, { k: 'Single resultant acts at y', v: 0.625 }, { k: 'Resultant force |F_R|', v: 1600 }] },
    { name: 'Force and couple in 3D reduce to a wrench', units: 'US',
      state: { mode: 'reduce3d', fu: 'lb', r3: { forces: [new3({ Fx: 0, Fy: 0, Fz: 40, x: 2, y: 1, z: 0 }), new3({ Fx: 30, Fy: 0, Fz: 0, x: 0, y: 2, z: 3 })], couples: [{ Mx: 0, My: 0, Mz: 60 }], O: { x: 0, y: 0, z: 0 } } } },
    { name: 'Test: trapezoidal load 100 to 50 lb/ft over 9 ft, F_R = 675 lb at x̄ = 4.00 ft', units: 'US',
      state: { mode: 'dist', fu: 'lb', dist: { segs: [{ x1: 0, x2: 9, w1: 100, w2: 50 }] } }, expect: [{ k: 'Resultant force F_R (↓ positive)', v: 675 }, { k: 'Location of the resultant x̄', v: 4.00 }] },
    { name: 'Uniform and triangular loads on one beam', units: 'SI',
      state: { mode: 'dist', fu: 'kN', dist: { segs: [{ x1: 0, x2: 3, w1: 4, w2: 4 }, { x1: 3, x2: 7, w1: 0, w2: 6 }] } } },
    { name: 'Not valid: direction angles of 30°, 30° and 30° (cos² terms do not add to 1)', units: 'SI', fails: true,
      state: { mode: 'vector3d', fu: 'N', v3: { forces: [new3({ by: 'angles', F: 100, al: 30, be: 30, ga: 30 })] } } },
  ];

  root.SForces = M;
})(window);
