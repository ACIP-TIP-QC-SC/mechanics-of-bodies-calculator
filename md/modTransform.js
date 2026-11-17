/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M7 Stress and Strain Transformation
 * (inputs, diagrams, presets). Physics: md/transform.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Transform, MD, MDUI, Mohr } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const DEG = Math.PI / 180;
  const EL = '#cfd8de', EDGE = '#4a5661', AX = '#111111', XCOL = '#d4612a', PCOL = '#1e7a45', MCOL = '#2f7fc1', SCOL = COL.shear, NCOL = COL.load, GCOL = '#8e44ad';
  const H = 1.0; // half the side of the drawn element

  const M = { id: 'transform', title: 'Stress and Strain Transformation', defaults: Transform.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const mohrOn = () => S().mohr !== false && mode() !== 'hooke';
  const deformOn = () => S().defl !== false && mode() !== 'stress';

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], u = MD.units(U), sys = M.units, MU = '10⁻⁶';
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => { o[k] = v; delete st._k; }, unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [['stress', 'Plane stress: turned element and principal stresses'], ['strain', 'Plane strain: turned element and principal strains'], ['rosette', 'Strain rosette readings'], ['hooke', "Generalized Hooke's law"]] });
    if (st.mode === 'stress') {
      const q = st.ps;
      sec = C.section(c, 'State of stress');
      C.note(sec, 'Tension is positive. τxy is positive when it points in +y on the face whose outward normal is +x.');
      num(sec, q, 'sx', 'Normal stress σx', u.ST); num(sec, q, 'sy', 'Normal stress σy', u.ST); num(sec, q, 'txy', 'Shear stress τxy', u.ST);
      sec = C.section(c, 'Turned element');
      num(sec, q, 'th', "Angle θ to the x' axis (counterclockwise +)", '°');
      C.note(sec, "Drag the element or the point x' on Mohr's circle to turn it.");
    } else if (st.mode === 'strain') {
      const q = st.pe;
      sec = C.section(c, 'State of strain (10⁻⁶)');
      C.note(sec, 'Elongation is positive. γxy is positive when the right angle between +x and +y gets smaller.');
      num(sec, q, 'ex', 'Normal strain εx', MU); num(sec, q, 'ey', 'Normal strain εy', MU); num(sec, q, 'gxy', 'Shear strain γxy', MU);
      sec = C.section(c, 'Turned element');
      num(sec, q, 'th', "Angle θ to the x' axis (counterclockwise +)", '°');
      sec = C.section(c, 'Out of the plane');
      C.seg(sec, { label: 'Third principal strain', get: () => q.ez, set: (v) => (q.ez = v), options: [['zero', 'Plane strain, εz = 0'], ['nu', 'Plane stress, σz = 0']] });
      if (q.ez === 'nu') C.num(sec, { label: "Poisson's ratio ν", get: () => q.nu, set: (v) => (q.nu = v) });
    } else if (st.mode === 'rosette') {
      const q = st.ro;
      sec = C.section(c, 'Rosette');
      C.seg(sec, { label: 'Gauge layout', get: () => q.kind, set: (v) => (q.kind = v), options: [['45', '45°'], ['60', '60°'], ['gen', 'Any angles']] });
      C.note(sec, q.kind === '45' ? 'Gauges a, b and c at 0°, 45° and 90° from the x axis.' : q.kind === '60' ? 'Gauges a, b and c at 0°, 60° and 120° from the x axis.' : 'Give the angle of each gauge, counterclockwise from the x axis.');
      sec = C.section(c, 'Readings (10⁻⁶)');
      ['a', 'b', 'c'].forEach((L) => {
        num(sec, q, `e${L}`, `Gauge ${L}, ε_${L}`, MU);
        if (q.kind === 'gen') num(sec, q, `t${L}`, `Angle of gauge ${L}`, '°');
      });
      sec = C.section(c, 'Material (for the stresses)');
      MDUI.material(C, sec, q, sys, { E: 'E', nu: 'nu' });
      C.num(sec, { label: 'Modulus E (0 = strains only)', get: () => q.E, set: (v) => { q.E = v; q.mat = 'custom'; }, unit: u.MOD });
      C.num(sec, { label: "Poisson's ratio ν", get: () => q.nu, set: (v) => { q.nu = v; q.mat = 'custom'; } });
    } else {
      const q = st.hk;
      sec = C.section(c, 'Stresses on the block');
      C.note(sec, 'Tension is positive. Leave a stress at 0 if it does not act. For an equal pressure p on every side, enter σx = σy = σz = −p.');
      num(sec, q, 'sx', 'σx', u.ST); num(sec, q, 'sy', 'σy', u.ST); num(sec, q, 'sz', 'σz', u.ST);
      num(sec, q, 'txy', 'τxy', u.ST); num(sec, q, 'tyz', 'τyz', u.ST); num(sec, q, 'txz', 'τxz', u.ST);
      sec = C.section(c, 'Material');
      MDUI.material(C, sec, q, sys, { E: 'E', nu: 'nu' });
      C.num(sec, { label: 'Modulus E', get: () => q.E, set: (v) => { q.E = v; q.mat = 'custom'; }, unit: u.MOD });
      C.num(sec, { label: "Poisson's ratio ν", get: () => q.nu, set: (v) => { q.nu = v; q.mat = 'custom'; } });
      sec = C.section(c, 'Size of the block (0 = leave out)');
      num(sec, q, 'a', 'Side a along x', u.S); num(sec, q, 'b', 'Side b along y', u.S); num(sec, q, 'c', 'Side c along z', u.S);
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (st.mode !== 'hooke') C.toggle(c, { label: "Show Mohr's circle", get: () => st.mohr !== false, set: (v) => (st.mohr = v) });
    if (st.mode !== 'hooke') C.toggle(c, { label: 'Show the principal directions', get: () => st.pr !== false, set: (v) => (st.pr = v) });
    if (st.mode !== 'stress') C.toggle(c, { label: 'Show the deformed shape (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
  };

  M.compute = (U) => Transform.solve(S(), U);
  M.onUnits = (from, to) => Transform.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ stress: "Turned element and Mohr's circle", strain: "Deformed element and Mohr's circle for strain", rosette: "Rosette and Mohr's circle for strain", hooke: 'Block before and after loading (front and side)' }[mode()]);
  M.cap3D = () => '3D view';
  M.hint = () => ({
    stress: "Drag the element, or the point x' on the circle, to turn the element. A turn of θ counterclockwise moves the point 2θ counterclockwise round the circle (τ is plotted positive downward). Press Play to watch the element turn from the x axis to θ.",
    strain: "Mohr's circle for strain plots γ/2 downward. The dashed square is the element before loading; press Play to watch it stretch and distort (exaggerated).",
    rosette: 'Each gauge reads the normal strain along its own line. The principal directions are the dashed green lines; press Play to watch the plate deform (exaggerated).',
    hooke: 'The dashed outline is the block before loading. A stress on one face also changes the other two sides through Poisson\'s ratio. Press Play to watch it deform (exaggerated).',
  }[mode()]);
  M.legend = () => ({
    stress: [[NCOL, 'Normal stress'], [SCOL, 'Shear stress'], [XCOL, "x' axis and point x'", 'ln'], [PCOL, 'Principal directions', 'ln'], [MCOL, "Mohr's circle", 'ln']],
    strain: [[XCOL, "x' axis and point x'", 'ln'], [PCOL, 'Principal directions', 'ln'], [MCOL, "Mohr's circle", 'ln']],
    rosette: [[GCOL, 'Gauges'], [PCOL, 'Principal directions', 'ln'], [MCOL, "Mohr's circle", 'ln']],
    hooke: [[NCOL, 'Normal stress'], [EDGE, 'Block before loading', 'ln']],
  }[mode()]);
  const deflect = root.Anim.deflection(S);
  const turn = {
    duration: 10, loop: true,
    frame(u) { const st = S(); if (u <= 0) delete st._k; else st._k = root.Anim.deflK(u); },
    label() { const k = S()._k; return k === undefined ? 'element turned to θ' : `element turned ${Math.round(k * 100)} % of θ`; },
  };
  M.anim = () => (mode() === 'stress' ? (S().ps.th ? turn : null) : deformOn() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* Geometry shared by the 2D and 3D views                             */
  /* ------------------------------------------------------------------ */
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]], mul2 = (a, k) => [a[0] * k, a[1] * k];
  const CORN = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  /** Angle drawn now (deg): the stress element turns from 0 to θ while Play runs. */
  const drawnTh = (g) => (g.kind === 'stress' ? g.th * kD() : g.th);
  /** Values on the element at the drawn angle. */
  const atNow = (g) => Mohr.stress(g.ax, g.ay, g.c).at(drawnTh(g));
  /** Corners of the element turned by th (deg), deformed by the strains at that angle (strain and rosette). */
  function corners(g, th, f) {
    const a = th * DEG, at = Mohr.stress(g.ax, g.ay, g.c).at(th);
    return CORN.map(([x, y]) => {
      let p = [x * H, y * H];
      if (f) p = [p[0] * (1 + at.sx * f) + p[1] * at.txy * f, p[1] * (1 + at.sy * f) + p[0] * at.txy * f];
      return rot(p, a);
    });
  }
  /** Scale that draws the largest strain as 15 % of the element. */
  const strainF = (g) => { const m = Math.max(Math.abs(g.m.max), Math.abs(g.m.min), g.m.R); return m > 0 ? (0.15 / m) * (deformOn() ? kD() : 0) : 0; };
  const nm = (g) => (g.kind === 'stress' ? { s: 'σ', t: 'τ', ty: "τ" } : { s: 'ε', t: 'γ', ty: 'γ/2' });

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  let lay = null; // where the element and the circle were drawn, for dragging

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'hooke') return drawHooke(svg, g, opt);
    const wide = (svg.clientWidth || 800) >= (svg.clientHeight || 560) * 1.15, on = mohrOn();
    const mo = on ? (wide ? [3.3, 0] : [-2.4, -5.0]) : null; // left end of the σ axis
    const b = { xmin: -2.7, xmax: 2.7, ymin: -2.75, ymax: 2.5 };
    if (on) { if (wide) b.xmax = 10.7; else b.ymin = -7.9; }
    const D = UI.Draw2D(svg, b, { pad: 18 });
    lay = { mo, mohr: null };
    if (g.kind === 'rosette') drawRosette(D, g, opt); else drawElement(D, g, opt);
    if (on) lay.mohr = drawMohr(D, g, opt, mo);
    return true;
  };

  function axes(D, len) {
    D.arrow([-len, 0], [len, 0], { color: AX, w: 1.2, head: 8 }); D.text([len, 0], 'x', { dx: 2, dy: 14, color: AX, size: 12, weight: 700 });
    D.arrow([0, -len], [0, len], { color: AX, w: 1.2, head: 8 }); D.text([0, len], 'y', { dx: 6, dy: 4, color: AX, size: 12, weight: 700 });
  }
  function principalLines(D, g, len) {
    if (S().pr === false || !(g.m.R > 0)) return;
    [[g.m.thp, '1'], [g.m.thp2, '2']].forEach(([t, i]) => {
      const d = [Math.cos(t * DEG), Math.sin(t * DEG)];
      D.line(mul2(d, -len), mul2(d, len), { stroke: PCOL, sw: 1.4, dash: '7 4' });
      D.text(mul2(d, len), `${nm(g).s}${i === '1' ? '₁' : '₂'}`, { dx: 4, dy: -4, color: PCOL, size: 12, weight: 700 });
    });
  }
  function angleArc(D, th, r, color, label) {
    if (Math.abs(th) < 0.05) return;
    const pts = []; for (let i = 0; i <= 30; i++) { const a = (th * DEG * i) / 30; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    D.pline(pts, { stroke: color, sw: 1.6 });
    const am = (th * DEG) / 2; D.text([r * 1.25 * Math.cos(am), r * 1.25 * Math.sin(am)], label, { anchor: 'middle', dy: 4, color, size: 11.5, weight: 700 });
  }

  function drawElement(D, g, opt) {
    const th = drawnTh(g), a = th * DEG, at = atNow(g), n = nm(g), strainK = g.kind === 'strain', f = strainK ? strainF(g) : 0, u = g.unit;
    principalLines(D, g, 2.1);
    axes(D, 2.45);
    // element before turning (and before deforming)
    if (Math.abs(th) > 0.05 || f) D.poly(CORN.map(([x, y]) => [x * H, y * H]), { stroke: EDGE, sw: 1.2, dash: '5 4', fill: 'none' });
    if (strainK && f) D.poly(corners(g, th, 0), { stroke: XCOL, sw: 1.1, dash: '3 3', fill: 'none' });
    D.poly(corners(g, th, f), { fill: EL, stroke: EDGE, sw: 1.8, fop: 0.9 });
    // x' and y' axes
    const ex = [Math.cos(a), Math.sin(a)], ey = [-Math.sin(a), Math.cos(a)];
    if (Math.abs(th) > 0.05) {
      D.arrow(mul2(ex, 0), mul2(ex, 2.25), { color: XCOL, w: 1.6, head: 9 }); D.text(mul2(ex, 2.25), "x'", { dx: 5, dy: -3, color: XCOL, size: 12.5, weight: 700 });
      D.arrow(mul2(ey, 0), mul2(ey, 1.6), { color: XCOL, w: 1.6, head: 9 }); D.text(mul2(ey, 1.6), "y'", { dx: 5, dy: -3, color: XCOL, size: 12.5, weight: 700 });
      angleArc(D, th, 0.55, XCOL, `θ = ${fmt(th)}°`);
    }
    if (strainK) {
      const L = (k, v) => (opt.showP ? `${k} = ${fmt(v)}` : k);
      D.text([0, -2.65], [L("ε_x'", at.sx), L("ε_y'", at.sy), L("γ_x'y'", 2 * at.txy)].join('   ') + (opt.showP ? ' (10⁻⁶)' : ''), { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
      return;
    }
    if (opt.showP) D.text([0, -2.65], `σ_x' = ${fmt(at.sx)}   σ_y' = ${fmt(at.sy)}   τ_x'y' = ${fmt(at.txy)} (${u})`, { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
    // stress arrows on the four faces
    const mx = Math.max(Math.abs(g.m.max), Math.abs(g.m.min), g.m.R, 1e-12);
    for (let i = 0; i < 4; i++) {
      const na = a + (i * Math.PI) / 2, nv = [Math.cos(na), Math.sin(na)], fc = mul2(nv, H), sg = i % 2 === 0 ? at.sx : at.sy;
      if (Math.abs(sg) > 1e-9 * mx) {
        const Ln = 0.25 + 0.7 * (Math.abs(sg) / mx), p0 = add2(fc, mul2(nv, 0.08)), p1 = add2(fc, mul2(nv, 0.08 + Ln));
        D.arrow(sg > 0 ? p0 : p1, sg > 0 ? p1 : p0, { color: NCOL, w: 2.2, head: 9 });
        if (i < 2) D.text(p1, i ? "σ_y'" : "σ_x'", { anchor: nv[0] < -0.3 ? 'end' : nv[0] > 0.3 ? 'start' : 'middle', dx: nv[0] * 6, dy: nv[1] > 0.3 ? -6 : nv[1] < -0.3 ? 14 : 4, color: NCOL, size: 11.5, weight: 700 });
      }
      if (Math.abs(at.txy) > 1e-9 * mx) {
        const dir = i % 2 === 0 ? [-nv[1], nv[0]] : [nv[1], -nv[0]], Lt = Math.min(1.5, 0.35 + 1.0 * (Math.abs(at.txy) / mx)), sd = mul2(dir, Math.sign(at.txy) * Lt / 2), base = add2(fc, mul2(nv, 0.13));
        D.arrow(add2(base, mul2(sd, -1)), add2(base, sd), { color: SCOL, w: 2, head: 8 });
        if (i === 0) D.text(add2(base, sd), "τ_x'y'", { anchor: nv[0] >= 0 ? 'start' : 'end', dx: nv[0] >= 0 ? 6 : -6, dy: 4, color: SCOL, size: 11.5, weight: 700 });
      }
    }
  }

  function drawRosette(D, g, opt) {
    const f = strainF(g), n = nm(g);
    principalLines(D, g, 2.3);
    axes(D, 2.45);
    if (f) D.poly(CORN.map(([x, y]) => [x * H * 1.25, y * H * 1.25]), { stroke: EDGE, sw: 1.2, dash: '5 4', fill: 'none' });
    D.poly(CORN.map(([x, y]) => { const p = [x * H * 1.25, y * H * 1.25], m = Mohr.stress(g.ax, g.ay, g.c).at(0); return [p[0] * (1 + m.sx * f) + p[1] * m.txy * f, p[1] * (1 + m.sy * f) + p[0] * m.txy * f]; }), { fill: EL, stroke: EDGE, sw: 1.8, fop: 0.9 });
    g.ths.forEach((t, i) => {
      const d = [Math.cos(t * DEG), Math.sin(t * DEG)], pn = [-d[1], d[0]], r0 = 0.25, r1 = 1.45, w = 0.09;
      D.line(mul2(d, 0.05), mul2(d, r1 + 0.15), { stroke: GCOL, sw: 1.2 });
      // the grid of the gauge as a zigzag
      const pts = []; const m = 9; for (let j = 0; j <= m; j++) { const r = r0 + ((r1 - r0) * j) / m; pts.push(add2(mul2(d, r), mul2(pn, (j % 2 ? 1 : -1) * w))); }
      D.pline(pts, { stroke: GCOL, sw: 1.8 });
      D.text(mul2(d, r1 + 0.32), opt.showP ? `${'abc'[i]}: ${fmt(g.es[i])}` : 'abc'[i], { anchor: d[0] < -0.3 ? 'end' : d[0] > 0.3 ? 'start' : 'middle', dy: 4, color: GCOL, size: 12, weight: 700 });
    });
    void n;
    D.text([0, -2.65], opt.showP ? `ε_x = ${fmt(g.ax)}   ε_y = ${fmt(g.ay)}   γ_xy = ${fmt(2 * g.c)} (10⁻⁶)` : 'ε_x, ε_y, γ_xy from the three readings', { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
  }

  /** Mohr's circle drawn with its σ axis starting at world point mo; τ (or γ/2) is plotted positive downward. */
  function drawMohr(D, g, opt, mo) {
    const m = g.m, n = nm(g), u = g.unit, lo = Math.min(0, m.min), hi = Math.max(0, m.max), span = hi - lo, s = span > 0 ? Math.min(5.0 / span, m.R > 0 ? 1.85 / m.R : Infinity) : 1;
    const X = (v) => mo[0] + 0.25 + (v - lo) * s, Y = (t) => mo[1] - t * s; // t positive plots downward
    const cx = X(m.avg), Rs = m.R * s, top = Math.max(Rs, 0.5) + 0.75;
    // axes
    D.arrow([mo[0], mo[1]], [X(hi) + 0.6, mo[1]], { color: AX, w: 1.3, head: 8 });
    D.text([X(hi) + 0.6, mo[1]], `${n.s} (${u})`, { anchor: 'start', dx: 4, dy: 4, color: AX, size: 12, weight: 700 });
    D.arrow([X(0), mo[1] + top], [X(0), mo[1] - top], { color: AX, w: 1.3, head: 8 });
    D.text([X(0), mo[1] - top], `${n.ty} (${u})`, { anchor: 'end', dx: -7, dy: 0, color: AX, size: 12, weight: 700 });
    if (Math.abs(X(0) - cx) > 0.45) D.text([X(0), mo[1]], '0', { anchor: 'end', dx: -4, dy: 14, color: '#5a6b75', size: 10.5, weight: 400 });
    // circle
    D.circle([cx, mo[1]], Math.max(Rs, 0.02), { stroke: MCOL, sw: 2, fill: MCOL, fop: 0.08 });
    const at = atNow(g), th = drawnTh(g);
    const Px = [X(g.ax), Y(g.c)], Py = [X(g.ay), Y(-g.c)], Pq = [X(at.sx), Y(at.txy)];
    D.line(Px, Py, { stroke: EDGE, sw: 1.2, dash: '5 4' });
    // arc of 2θ from x to x'
    if (Math.abs(th) > 0.05 && Rs > 0) {
      const a0 = Math.atan2(Px[1] - mo[1], Px[0] - cx), r = Math.max(0.3, Rs * 0.32), pts = [];
      for (let i = 0; i <= 36; i++) { const aa = a0 + (2 * th * DEG * i) / 36; pts.push([cx + r * Math.cos(aa), mo[1] + r * Math.sin(aa)]); }
      D.pline(pts, { stroke: XCOL, sw: 1.6 });
      const am = a0 + th * DEG; D.text([cx + r * 1.45 * Math.cos(am), mo[1] + r * 1.45 * Math.sin(am)], `2θ = ${fmt(2 * th)}°`, { anchor: 'middle', dy: 4, color: XCOL, size: 11, weight: 700 });
      D.line([cx, mo[1]], Pq, { stroke: XCOL, sw: 2 });
    }
    D.line([cx, mo[1]], Px, { stroke: EDGE, sw: 1.6 });
    const dot = (p, color, r) => D.circle(p, (r || 5) / D.sc, { fill: color, stroke: '#fff', sw: 1.5 });
    const lab = (p, text, color, below) => D.text(p, text, { anchor: p[0] >= cx ? 'start' : 'end', dx: p[0] >= cx ? 8 : -8, dy: below ? 16 : -8, color, size: 11.5, weight: 700 });
    // principal and largest-shear points
    if (S().pr !== false && Rs > 0) {
      dot([X(m.max), mo[1]], PCOL, 4.5); dot([X(m.min), mo[1]], PCOL, 4.5);
      D.text([X(m.max), mo[1]], opt.showP ? `${n.s}₁ = ${fmt(m.max)}` : `${n.s}₁`, { anchor: 'start', dx: 6, dy: -7, color: PCOL, size: 11.5, weight: 700 });
      D.text([X(m.min), mo[1]], opt.showP ? `${n.s}₂ = ${fmt(m.min)}` : `${n.s}₂`, { anchor: 'end', dx: -6, dy: -7, color: PCOL, size: 11.5, weight: 700 });
      const tl = g.kind === 'stress' ? 'τ_max' : 'γ_max/2';
      dot([cx, mo[1] - Rs], PCOL, 3.5); D.text([cx, mo[1] - Rs], opt.showP ? `${tl} = ${fmt(m.R)}` : tl, { anchor: Pq[0] >= cx ? 'end' : 'start', dx: Pq[0] >= cx ? -8 : 8, dy: 15, color: PCOL, size: 11, weight: 700 });
    }
    dot([cx, mo[1]], COL.ink, 3.5); D.text([cx, mo[1]], 'C', { anchor: 'middle', dy: 16, color: COL.ink, size: 11.5, weight: 700 });
    dot(Py, EDGE, 4.5); lab(Py, opt.showP ? `y (${fmt(g.ay)}, ${fmt(-g.c)})` : 'y', EDGE, Py[1] < mo[1]);
    dot(Px, EDGE, 5); lab(Px, opt.showP ? `x (${fmt(g.ax)}, ${fmt(g.c)})` : 'x', EDGE, Px[1] < mo[1]);
    if (Math.abs(th) > 0.05) { dot(Pq, XCOL, 6); lab(Pq, opt.showP ? `x' (${fmt(at.sx)}, ${fmt(at.txy)})` : "x'", XCOL, Pq[1] < mo[1]); }
    return { cx, cy: mo[1], s, Rs, Px };
  }

  /* Hooke's law: front (x–y) and side (z–y) views of the block */
  function blockSizes(g) {
    const d = g.dims.every((v) => v > 0) ? g.dims.slice() : [1, 1, 1], mx = Math.max(...d);
    return d.map((v) => 2.4 * Math.max(0.28, v / mx));
  }
  const hookeF = (g) => { const m = Math.max(...g.e.map(Math.abs)); return m > 0 ? (0.12 / m) * (deformOn() ? kD() : 0) : 0; };
  function drawHooke(svg, g, opt) {
    const [wa, wb, wc] = blockSizes(g), f = hookeF(g), gap = 2.6, x2 = wa / 2 + gap + wc / 2;
    const D = UI.Draw2D(svg, { xmin: -wa / 2 - 1.6, xmax: x2 + wc / 2 + 1.6, ymin: -wb / 2 - 1.55, ymax: wb / 2 + 1.5 }, { pad: 20 });
    lay = null;
    const ST = g.u.ST, sv = g.s.map((v) => MD.fromBase(v, ST)), mx = Math.max(...sv.map(Math.abs), 1e-12);
    const rect = (cx, w, h, o) => D.poly([[cx - w / 2, -h / 2], [cx + w / 2, -h / 2], [cx + w / 2, h / 2], [cx - w / 2, h / 2]], o);
    const view = (cx, w, ih, iv, title) => {
      const wd = w * (1 + g.e[ih] * f), hd = wb * (1 + g.e[1] * f);
      rect(cx, wd, hd, { fill: EL, stroke: EDGE, sw: 1.8 });
      if (f) rect(cx, w, wb, { stroke: EDGE, sw: 1.2, dash: '5 4' });
      D.text([cx, wb / 2 + 1.25], title, { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
      const arrows = (i, horiz, half) => {
        const v = sv[i]; if (Math.abs(v) < 1e-12 * mx) return;
        const L = 0.3 + 0.55 * (Math.abs(v) / mx);
        [1, -1].forEach((sd) => {
          const p0 = horiz ? [cx + sd * (half + 0.08), 0] : [cx, sd * (half + 0.08)], p1 = horiz ? [p0[0] + sd * L, 0] : [cx, p0[1] + sd * L];
          D.arrow(v > 0 ? p0 : p1, v > 0 ? p1 : p0, { color: NCOL, w: 2.2, head: 9 });
          if (sd > 0) D.text(p1, opt.showP ? `σ${'xyz'[i]} = ${fmt(v)} ${ST}` : `σ${'xyz'[i]}`, { anchor: horiz ? 'start' : 'middle', dx: horiz ? 4 : 0, dy: horiz ? -8 : -6, color: NCOL, size: 11.5, weight: 700 });
        });
      };
      arrows(ih, true, wd / 2); arrows(iv, false, hd / 2);
      // dimensions
      const dl = (i) => (g.dims[i] > 0 ? (opt.showP ? `${'abc'[i]} = ${fmt(g.dims[i])} → ${fmt(g.dims[i] + g.dl[i])} ${g.u.S}` : 'abc'[i]) : '');
      D.text([cx, -wb / 2 - 1.3], [dl(ih), ih === 0 ? dl(1) : ''].filter((x) => x).join(',   '), { anchor: 'middle', color: COL.dim, size: 11.5, weight: 600 });
    };
    view(0, wa, 0, 1, 'Front (x right, y up)');
    view(x2, wc, 2, 1, 'Side (z right, y up)');
    return true;
  }

  /* Drag the element or the point x' to turn the element. */
  M.onDrag = function (p, phase, res) {
    const g = res.geo, st = S();
    if (!lay || (g.kind !== 'stress' && g.kind !== 'strain')) return false;
    const q = g.kind === 'stress' ? st.ps : st.pe;
    let th = null;
    const mo = lay.mohr;
    if (mo && mo.Rs > 0 && Math.hypot(p[0] - mo.cx, p[1] - mo.cy) < mo.Rs * 1.5 + 0.4) {
      const a = Math.atan2(p[1] - mo.cy, p[0] - mo.cx), a0 = Math.atan2(mo.Px[1] - mo.cy, mo.Px[0] - mo.cx);
      th = (a - a0) / DEG / 2;
    } else if (Math.hypot(p[0], p[1]) < 2.6 && Math.hypot(p[0], p[1]) > 0.15) th = Math.atan2(p[1], p[0]) / DEG;
    if (th === null) return false;
    th = ((th % 180) + 180) % 180; if (th > 90) th -= 180;
    q.th = Math.round(th * 10) / 10; delete st._k;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, t = 0.22;
    v._hs = 0.18;
    if (g.kind === 'hooke') return hooke3D(v, g, opt);
    const ln = (a, b, c, w, dash) => v.line([a, b], c, w || 1.4, dash);
    ln([-2.2, 0, 0], [2.2, 0, 0], AX, 1.2); ln([0, -2.2, 0], [0, 2.2, 0], AX, 1.2); ln([0, 0, -1.6], [0, 0, 1.6], AX, 1.2);
    v.label([2.35, 0, 0], 'x', AX); v.label([0, 2.35, 0], 'y', AX); v.label([0, 0, 1.75], 'z', AX);
    if (g.kind === 'rosette') {
      const f = strainF(g), m = Mohr.stress(g.ax, g.ay, g.c).at(0), Hs = H * 1.25;
      const poly = CORN.map(([x, y]) => { const p = [x * Hs, y * Hs]; return [p[0] * (1 + m.sx * f) + p[1] * m.txy * f, p[1] * (1 + m.sy * f) + p[0] * m.txy * f]; });
      v.extrude(poly, -t, t, EL, 1, EDGE);
      g.ths.forEach((th, i) => {
        const d = [Math.cos(th * DEG), Math.sin(th * DEG)], pn = [-d[1], d[0]], r0 = 0.3, r1 = 1.05, w = 0.1, z = t + 0.01;
        v.face([[d[0] * r0 + pn[0] * w, d[1] * r0 + pn[1] * w, z], [d[0] * r1 + pn[0] * w, d[1] * r1 + pn[1] * w, z], [d[0] * r1 - pn[0] * w, d[1] * r1 - pn[1] * w, z], [d[0] * r0 - pn[0] * w, d[1] * r0 - pn[1] * w, z]], GCOL, 1, GCOL, 1, 1, [0, 0, 1]);
        v.label([d[0] * 1.3, d[1] * 1.3, z], opt.showP ? `${'abc'[i]}: ${fmt(g.es[i])}` : 'abc'[i], GCOL);
      });
      principal3D(v, g, t);
      v.autoBounds(); return;
    }
    const th = drawnTh(g), f = g.kind === 'strain' ? strainF(g) : 0, a = th * DEG;
    if (Math.abs(th) > 0.05 || f) { const c0 = CORN.map(([x, y]) => [x * H, y * H]); [t, -t].forEach((z) => v.line(c0.concat([c0[0]]).map((p) => [p[0], p[1], z]), EDGE, 1, [5, 4])); }
    v.extrude(corners(g, th, f), -t, t, EL, 1, EDGE);
    principal3D(v, g, t);
    const ex = [Math.cos(a), Math.sin(a), 0], ey = [-Math.sin(a), Math.cos(a), 0];
    if (Math.abs(th) > 0.05) { MDUI.arrow3(v, [0, 0, t], [ex[0] * 2, ex[1] * 2, t], XCOL, 1.8); v.label([ex[0] * 2.15, ex[1] * 2.15, t], "x'", XCOL); MDUI.arrow3(v, [0, 0, t], [ey[0] * 1.5, ey[1] * 1.5, t], XCOL, 1.8); v.label([ey[0] * 1.65, ey[1] * 1.65, t], "y'", XCOL); }
    if (g.kind !== 'stress') { v.autoBounds(); return; }
    const at = atNow(g), mx = Math.max(Math.abs(g.m.max), Math.abs(g.m.min), g.m.R, 1e-12);
    for (let i = 0; i < 4; i++) {
      const na = a + (i * Math.PI) / 2, nv = [Math.cos(na), Math.sin(na)], sg = i % 2 === 0 ? at.sx : at.sy, fc = [nv[0] * H, nv[1] * H];
      if (Math.abs(sg) > 1e-9 * mx) {
        const L = 0.25 + 0.7 * (Math.abs(sg) / mx), p0 = [fc[0] + nv[0] * 0.06, fc[1] + nv[1] * 0.06, 0], p1 = [fc[0] + nv[0] * (0.06 + L), fc[1] + nv[1] * (0.06 + L), 0];
        MDUI.arrow3(v, sg > 0 ? p0 : p1, sg > 0 ? p1 : p0, NCOL, 2.2);
        if (i < 2) v.label([p1[0] + nv[0] * 0.2, p1[1] + nv[1] * 0.2, 0], opt.showP ? `${i ? "σy'" : "σx'"} = ${fmt(sg)}` : i ? "σy'" : "σx'", NCOL);
      }
      if (Math.abs(at.txy) > 1e-9 * mx) {
        const dir = i % 2 === 0 ? [-nv[1], nv[0]] : [nv[1], -nv[0]], Lt = Math.min(1.5, 0.35 + (Math.abs(at.txy) / mx)), sd = Math.sign(at.txy) * Lt / 2, b = [fc[0] + nv[0] * 0.04, fc[1] + nv[1] * 0.04];
        MDUI.arrow3(v, [b[0] - dir[0] * sd, b[1] - dir[1] * sd, t + 0.02], [b[0] + dir[0] * sd, b[1] + dir[1] * sd, t + 0.02], SCOL, 2);
        if (i === 0) v.label([b[0] + dir[0] * sd * 1.3, b[1] + dir[1] * sd * 1.3, t], opt.showP ? `τx'y' = ${fmt(at.txy)}` : "τx'y'", SCOL);
      }
    }
    v.autoBounds();
  };
  function principal3D(v, g, t) {
    if (S().pr === false || !(g.m.R > 0)) return;
    [[g.m.thp, '1'], [g.m.thp2, '2']].forEach(([th, i]) => {
      const d = [Math.cos(th * DEG), Math.sin(th * DEG)];
      v.line([[-d[0] * 1.9, -d[1] * 1.9, t + 0.02], [d[0] * 1.9, d[1] * 1.9, t + 0.02]], PCOL, 1.4, [7, 4]);
      v.label([d[0] * 2.05, d[1] * 2.05, t], `${nm(g).s}${i === '1' ? '₁' : '₂'}`, PCOL);
    });
  }
  function hooke3D(v, g, opt) {
    const [wa, wb, wc] = blockSizes(g), f = hookeF(g), d = [wa, wb, wc].map((w, i) => (w * (1 + g.e[i] * f)) / 2), h0 = [wa / 2, wb / 2, wc / 2];
    if (f) {
      const P = (sx, sy, sz) => [sx * h0[0], sy * h0[1], sz * h0[2]];
      [[-1, -1, -1, 1, -1, -1], [-1, 1, -1, 1, 1, -1], [-1, -1, 1, 1, -1, 1], [-1, 1, 1, 1, 1, 1], [-1, -1, -1, -1, 1, -1], [1, -1, -1, 1, 1, -1], [-1, -1, 1, -1, 1, 1], [1, -1, 1, 1, 1, 1], [-1, -1, -1, -1, -1, 1], [1, -1, -1, 1, -1, 1], [-1, 1, -1, -1, 1, 1], [1, 1, -1, 1, 1, 1]]
        .forEach((e) => v.line([P(e[0], e[1], e[2]), P(e[3], e[4], e[5])], EDGE, 1, [5, 4]));
    }
    v.box(-d[0], -d[1], -d[2], d[0], d[1], d[2], EL, 1, EDGE);
    const ST = g.u.ST, sv = g.s.map((x) => MD.fromBase(x, ST)), mx = Math.max(...sv.map(Math.abs), 1e-12);
    [0, 1, 2].forEach((i) => {
      const s = sv[i]; if (Math.abs(s) < 1e-12 * mx) return;
      const L = 0.4 + 0.7 * (Math.abs(s) / mx);
      [1, -1].forEach((sd) => {
        const e = [0, 0, 0]; e[i] = sd;
        const p0 = e.map((x, k) => x * (d[k] + 0.08)), p1 = e.map((x, k) => x * (d[k] + 0.08 + L));
        MDUI.arrow3(v, s > 0 ? p0 : p1, s > 0 ? p1 : p0, NCOL, 2.2);
        if (sd > 0) v.label(e.map((x, k) => x * (d[k] + 0.3 + L)), opt.showP ? `σ${'xyz'[i]} = ${fmt(s)} ${ST}` : `σ${'xyz'[i]}`, NCOL);
      });
    });
    v.label([-d[0] - 0.4, -d[1] - 0.3, d[2]], 'x →', AX);
    v.autoBounds();
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const PS = (sx, sy, txy, th) => ({ mode: 'stress', ps: { sx, sy, txy, th } });
  const PE = (ex, ey, gxy, th, o) => ({ mode: 'strain', pe: Object.assign({ ex, ey, gxy, th, ez: 'zero', nu: 0.3 }, o) });
  M.presets = [
    { name: "Test: Book Example 14.2, element turned 30° clockwise (σx' = −25.8 MPa, τx'y' = −68.8 MPa)", units: 'SI', state: PS(-80, 50, -25, -30),
      expect: [{ k: "Normal stress σ_x'", v: -25.8 }, { k: "Shear stress τ_x'y'", v: -68.8 }, { k: "Normal stress σ_y'", v: -4.15 }] },
    { name: 'Test: Book Examples 14.3 and 14.4, principal stresses 116 and −46.4 MPa, τ_max = 81.4 MPa', units: 'SI', state: PS(-20, 90, 60, 0),
      expect: [{ k: 'Principal stress σ_1', v: 116 }, { k: 'Principal stress σ_2', v: -46.4 }, { k: 'Angle to σ_2, θ_p2', v: -23.7 }, { k: 'Maximum in-plane shear stress τ_max', v: 81.4 }, { k: 'Average normal stress σ_avg', v: 35 }] },
    { name: "Test: Book Example 14.9, Mohr's circle turned 30° (σx' = −8.20 ksi, τx'y' = 5.66 ksi)", units: 'US', state: PS(-8, 12, -6, 30),
      expect: [{ k: "Normal stress σ_x'", v: -8.20 }, { k: "Shear stress τ_x'y'", v: 5.66 }, { k: "Normal stress σ_y'", v: 12.2 }] },
    { name: 'Test: Book Example 14.11, absolute maximum shear of 41.2 psi', units: 'US', state: PS(-0.02, 0, -0.04, 0),
      expect: [{ k: 'Principal stress σ_1', v: 0.0312 }, { k: 'Principal stress σ_2', v: -0.0512 }, { k: 'Absolute maximum shear stress τ_abs', v: 0.0412 }] },
    { name: 'Pure shear of 50 MPa: the principal planes are at 45°', units: 'SI', state: PS(0, 0, 50, 45) },
    { name: "Test: Book Example 14.12, strain on an element turned 30° clockwise (εx' = 213(10⁻⁶))", units: 'SI', state: PE(500, -300, 200, -30),
      expect: [{ k: "Normal strain ε_x'", v: 213 }, { k: "Shear strain γ_x'y'", v: 793 }, { k: "Normal strain ε_y'", v: -13.4 }] },
    { name: 'Test: Book Examples 14.15 and 14.16, principal strains 259 and −159 (10⁻⁶)', units: 'SI', state: PE(250, -150, 120, 0),
      expect: [{ k: 'Principal strain ε_1', v: 259 }, { k: 'Principal strain ε_2', v: -159 }, { k: 'Angle to ε_1, θ_p1', v: 8.35 }, { k: 'Maximum in-plane shear strain γ_max', v: 418 }] },
    { name: 'Thin plate in plane stress: εz from ν and the absolute largest shear strain', units: 'SI', state: PE(300, 100, 150, 20, { ez: 'nu', nu: 0.3 }) },
    { name: 'Test: Book Examples 14.19 and 14.20, 60° rosette on steel (σ1 = 62.0 MPa, σ2 = 25.4 MPa)', units: 'SI', state: { mode: 'rosette', ro: { kind: '60', ea: 60, eb: 135, ec: 264, ta: 0, tb: 60, tc: 120, mat: 'custom', E: 200, nu: 0.3 } },
      expect: [{ k: 'Normal strain ε_y', v: 246 }, { k: 'Shear strain γ_xy', v: -149 }, { k: 'Principal strain ε_1', v: 272 }, { k: 'Principal stress σ_1', v: 62.0 }, { k: 'Principal stress σ_2', v: 25.4 }] },
    { name: '45° rosette on an aluminium bracket', units: 'US', state: { mode: 'rosette', ro: { kind: '45', ea: 450, eb: -120, ec: 260, ta: 0, tb: 45, tc: 90, mat: 'al6061', E: 10000, nu: 0.35 } } },
    { name: 'Test: Book Example 14.21, copper bar stretched and squeezed (εx = 0.00808, εz = −0.000850)', units: 'SI', state: { mode: 'hooke', hk: { sx: 800, sy: -500, sz: 0, txy: 0, tyz: 0, txz: 0, mat: 'custom', E: 120, nu: 0.34, a: 300, b: 50, c: 20 } },
      expect: [{ k: 'Normal strain ε_x', v: 0.00808 }, { k: 'Normal strain ε_y', v: -0.00643 }, { k: 'Normal strain ε_z', v: -0.00085 }, { k: 'Change in the side along x, δ_x', v: 2.425 }] },
    { name: 'Test: Book Example 14.22, rubber block under 20 psi on every side (e = −0.01)', units: 'US', state: { mode: 'hooke', hk: { sx: -0.02, sy: -0.02, sz: -0.02, txy: 0, tyz: 0, txz: 0, mat: 'custom', E: 0.6, nu: 0.45, a: 4, b: 2, c: 3 } },
      expect: [{ k: 'Dilatation e', v: -0.01 }, { k: 'Normal strain ε_x', v: -0.00333 }, { k: 'Change in the side along x, δ_x', v: -0.0133 }] },
    { name: 'Edge: a rosette with two gauges along the same line (fails on purpose)', units: 'SI', fails: true, state: { mode: 'rosette', ro: { kind: 'gen', ea: 100, eb: 200, ec: 50, ta: 0, tb: 180, tc: 90, mat: 'custom', E: 0, nu: 0.3 } } },
  ];

  root.MTransform = M;
})(window);
