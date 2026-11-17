/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M1 Simple Stress and Strain
 * (inputs, diagrams, presets). Physics: md/stress.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Stress, MD, MDUI } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const LCOL = COL.load, RCOL = COL.react, SHC = '#c0392b', BRC = '#e67e22', NTC = '#2f6fb5', TRC = '#8e44ad', DCOL = '#0f8a7e';
  const STEEL = '#b9c4cc', PLATE = '#cfd8de', EDGE = '#4a5661', BOLT = '#7d8a96';

  const M = { id: 'stress', title: 'Simple Stress and Strain', defaults: Stress.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const deformOn = () => ['bar', 'hanger', 'pad'].includes(mode()) && S().defl !== false;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], u = MD.units(U, st.fu), sys = M.units;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; delete st._p; }, options: [['bar', 'Bar under an axial load'], ['hanger', 'Weight hung from two rods'], ['joint', 'Bolted or pinned joint'], ['size', 'Size a part from an allowable stress'], ['curve', 'Stress-strain diagram from test data'], ['pad', 'Block in shear (shear strain)']] });
    if (st.mode !== 'curve') C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    const num = (s2, o, k, label, unit, mat) => C.num(s2, { label, get: () => o[k], set: (v) => { o[k] = v; if (mat) o.mat = 'custom'; }, unit });
    if (st.mode === 'bar') {
      const q = st.bar;
      sec = C.section(c, 'Bar');
      num(sec, q, 'P', 'Axial load P (+ tension, − compression)', u.F);
      num(sec, q, 'L', 'Length L', u.L);
      section(sec, C, q, u);
      sec = C.section(c, 'Material');
      MDUI.material(C, sec, q, sys);
      num(sec, q, 'E', 'Modulus of elasticity E', u.MOD, true);
      num(sec, q, 'nu', "Poisson's ratio ν", '', true);
      num(sec, q, 'sY', 'Yield stress σY (0 = not checked)', u.ST, true);
    } else if (st.mode === 'hanger') {
      const q = st.hg;
      sec = C.section(c, 'Weight');
      C.seg(sec, { label: 'Given as', get: () => q.wBy, set: (v) => (q.wBy = v), options: [['mass', 'Mass'], ['force', 'Weight']] });
      if (q.wBy === 'mass') num(sec, q, 'm', 'Mass m', u.mass); else num(sec, q, 'W', 'Weight W', u.F);
      sec = C.section(c, 'Rod 1 (to the left)');
      num(sec, q, 'a1', 'Angle above the horizontal', '°');
      num(sec, q, 'd1', 'Diameter d₁', u.S);
      num(sec, q, 'L1', 'Length L₁', u.L);
      sec = C.section(c, 'Rod 2 (to the right)');
      num(sec, q, 'a2', 'Angle above the horizontal', '°');
      num(sec, q, 'd2', 'Diameter d₂', u.S);
      num(sec, q, 'L2', 'Length L₂', u.L);
      sec = C.section(c, 'Material of both rods');
      MDUI.material(C, sec, q, sys, { E: 'E', sY: 'sY' });
      num(sec, q, 'E', 'Modulus of elasticity E', u.MOD, true);
      num(sec, q, 'sY', 'Yield stress σY (0 = not checked)', u.ST, true);
    } else if (st.mode === 'joint') {
      const q = st.jt;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['allow', 'Largest allowable load'], ['check', 'Stresses under a load']] });
      if (q.task === 'check') num(sec, q, 'P', 'Load P', u.F);
      sec = C.section(c, 'Bolts or pins');
      num(sec, q, 'd', 'Diameter d', u.S);
      C.num(sec, { label: 'Number of bolts across the plate n', get: () => q.n, set: (v) => (q.n = Math.max(1, Math.min(6, Math.round(v)))), unit: '' });
      C.seg(sec, { label: 'Each bolt is in', get: () => String(q.planes), set: (v) => (q.planes = +v), options: [['1', 'Single shear'], ['2', 'Double shear']] });
      sec = C.section(c, 'Plate');
      num(sec, q, 't', 'Thickness t (the plate that bears on the bolt)', u.S);
      num(sec, q, 'w', 'Width w (0 = no net-section check)', u.S);
      num(sec, q, 'e', 'Bolt to plate end e (0 = no tear-out check)', u.S);
      sec = C.section(c, 'Allowable stresses (0 = not checked)');
      num(sec, q, 'tb', 'Bolt shear τ_allow', u.ST);
      num(sec, q, 'sb', 'Plate bearing σ_b,allow', u.ST);
      num(sec, q, 'st', 'Plate tension σ_t,allow', u.ST);
      num(sec, q, 'tp', 'Plate shear (tear-out) τ_allow', u.ST);
    } else if (st.mode === 'size') {
      const q = st.sz;
      C.select(sec, { label: 'Part to size', get: () => q.part, set: (v) => (q.part = v), options: [['pin', 'Pin or bolt in shear: diameter'], ['rod', 'Rod in tension: diameter'], ['punch', 'Plate or disk in punching shear: thickness'], ['collar', 'Collar in bearing: outer diameter']] });
      sec = C.section(c, 'Load and stress');
      num(sec, q, 'P', q.part === 'pin' ? 'Force on the pin P' : 'Axial load P', u.F);
      if (q.part === 'pin') C.seg(sec, { label: 'The pin is in', get: () => String(q.planes), set: (v) => (q.planes = +v), options: [['1', 'Single shear'], ['2', 'Double shear']] });
      C.seg(sec, { label: 'Allowable stress from', get: () => (q.byFS ? 'fs' : 'given'), set: (v) => (q.byFS = v === 'fs'), options: [['given', 'Typed in'], ['fs', 'Failure stress ÷ F.S.']] });
      if (q.byFS) { num(sec, q, 'fail', 'Failure stress', u.ST); num(sec, q, 'FS', 'Factor of safety F.S.', ''); }
      else num(sec, q, 'allow', q.part === 'pin' || q.part === 'punch' ? 'Allowable shear stress τ_allow' : q.part === 'collar' ? 'Allowable bearing stress' : 'Allowable normal stress σ_allow', u.ST);
      if (q.part === 'punch') num(sec, q, 'dh', 'Diameter of the punched area d', u.S);
      if (q.part === 'collar') num(sec, q, 'di', 'Shaft (inner) diameter d_i', u.S);
      num(sec, q, 'step', 'Round up to steps of (0 = no rounding)', u.S);
    } else if (st.mode === 'curve') {
      const q = st.cv, uE = u.ST;
      sec = C.section(c, 'Test data (strain, stress)');
      C.note(sec, 'Start at the origin and enter the points in order of increasing strain. The straight part runs from the origin to the point chosen below.');
      C.list(sec, { items: q.pts, max: 20, min: 3, title: (it, i) => `Point ${i + 1}`, fields: () => [{ key: 'e', label: 'Strain ε', unit: '' }, { key: 's', label: 'Stress σ', unit: uE }], add: [['Point', () => { const l = q.pts[q.pts.length - 1]; return { e: Core.tidy(l.e * 1.2 + 0.01, 4), s: l.s }; }]] });
      sec = C.section(c, 'Reading the curve');
      C.num(sec, { label: 'Straight line ends at point number', get: () => Math.round(q.nLin) + 1, set: (v) => (q.nLin = Math.max(1, Math.round(v) - 1)), unit: '' });
      C.toggle(sec, { label: 'Unload from a stress on the curve', get: () => !!q.unload, set: (v) => (q.unload = v) });
      if (q.unload) num(sec, q, 'sU', 'Unload from the stress', uE);
    } else {
      const q = st.pad;
      sec = C.section(c, 'Block');
      num(sec, q, 'a', 'Length a (along the force)', u.S);
      num(sec, q, 'b', 'Width b', u.S);
      num(sec, q, 'h', 'Thickness h', u.S);
      sec = C.section(c, 'Shear modulus');
      C.toggle(sec, { label: "From E and Poisson's ratio", get: () => !!q.useEnu, set: (v) => (q.useEnu = v) });
      if (q.useEnu) { num(sec, q, 'E', 'Modulus of elasticity E', u.MOD); num(sec, q, 'nu', "Poisson's ratio ν", ''); }
      else num(sec, q, 'G', 'Shear modulus G', u.MOD);
      sec = C.section(c, 'Loading');
      C.seg(sec, { label: 'Given', get: () => q.given, set: (v) => (q.given = v), options: [['force', 'Shear force V'], ['move', 'Sideways movement']] });
      if (q.given === 'force') num(sec, q, 'V', 'Shear force on the top V', u.F); else num(sec, q, 'dx', 'Sideways movement of the top d', u.S);
    }
  };
  function section(sec, C, q, u) {
    C.seg(sec, { label: 'Cross-section', get: () => q.shape, set: (v) => (q.shape = v), options: [['circle', 'Round'], ['tube', 'Tube'], ['rect', 'Rectangle'], ['area', 'Area']] });
    if (q.shape === 'circle' || q.shape === 'tube') C.num(sec, { label: q.shape === 'tube' ? 'Outer diameter d_o' : 'Diameter d', get: () => q.d, set: (v) => (q.d = v), unit: u.S });
    if (q.shape === 'tube') C.num(sec, { label: 'Inner diameter d_i', get: () => q.di, set: (v) => (q.di = v), unit: u.S });
    if (q.shape === 'rect') { C.num(sec, { label: 'Width b', get: () => q.b, set: (v) => (q.b = v), unit: u.S }); C.num(sec, { label: 'Depth h', get: () => q.h, set: (v) => (q.h = v), unit: u.S }); }
    if (q.shape === 'area') C.num(sec, { label: 'Area A', get: () => q.A, set: (v) => (q.A = v), unit: u.A });
  }
  M.diagram = function (c, C) {
    const st = S();
    if (['bar', 'hanger', 'pad'].includes(st.mode)) C.toggle(c, { label: 'Show the deformed shape (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    if (st.mode === 'curve') C.toggle(c, { label: 'Show the start of the curve magnified', get: () => st.zoom !== false, set: (v) => (st.zoom = v) });
  };

  M.compute = (U) => Stress.solve(S(), U);
  M.onUnits = (from, to) => Stress.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ bar: 'Bar and its deformed shape', hanger: 'Rods, joint and forces', joint: 'Side and top views of the joint', size: 'Part and its loading', curve: 'Stress-strain diagram', pad: 'Block in shear' }[mode()]);
  M.cap3D = () => (mode() === 'curve' ? 'Test specimen' : '3D view');
  M.hint = () => ({
    bar: 'Positive P pulls on the bar (tension). The dashed outline is the bar before loading; the deformed shape is exaggerated. Press Play to watch the bar stretch and narrow.',
    hanger: 'Rod 1 runs up to the left and rod 2 up to the right. The dashed lines are the rods before loading; the movement of the joint is exaggerated. Press Play to watch it settle.',
    joint: 'Red is the shear plane of the bolt, orange the bearing area, blue the net section of the plate and purple the tear-out planes.',
    size: 'The required size comes from setting the stress on the resisting area equal to the allowable stress.',
    curve: 'The dashed line is the 0.2 % offset line. Press Play to load the specimen to fracture.',
    pad: 'The base is fixed and V acts on the top face. The shear strain is the change in the right angle at a corner. Press Play to watch the block distort.',
  }[mode()]);
  M.legend = () => ({
    bar: [[LCOL, 'Load P'], [DCOL, 'Deformed shape', 'ln']],
    hanger: [[LCOL, 'Weight'], [RCOL, 'Rod forces'], [DCOL, 'Deformed shape', 'ln']],
    joint: [[LCOL, 'Load'], [SHC, 'Shear plane', 'ln'], [BRC, 'Bearing area', 'sq'], [NTC, 'Net section', 'ln'], [TRC, 'Tear-out planes', 'ln']],
    size: [[LCOL, 'Load'], [SHC, 'Resisting area', 'ln']],
    curve: [['#1d2733', 'σ-ε curve', 'ln'], [NTC, 'Straight part (E)', 'ln'], [BRC, '0.2 % offset', 'ln'], [SHC, 'Unloading', 'ln']],
    pad: [[LCOL, 'Shear force V'], [DCOL, 'Deformed shape', 'ln']],
  }[mode()]);
  const deflect = root.Anim.deflection(S);
  const loadUp = { duration: 10, loop: true, frame(t) { const st = S(); if (t <= 0) delete st._p; else st._p = Math.min(1, t / 0.85); }, label() { const p = S()._p; return p === undefined ? 'whole test' : `loading ${Math.round(p * 100)} %`; } };
  M.anim = () => (deformOn() ? deflect : mode() === 'curve' ? loadUp : null);

  /* ------------------------------------------------------------------ */
  /* 2D diagrams                                                        */
  /* ------------------------------------------------------------------ */
  const hatchBox = (D, x0, y0, x1, y1) => D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: 'url(#hatch)', stroke: COL.support, sw: 1 });
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'curve') return drawCurve(svg, g, opt);
    if (g.kind === 'bar') return drawBar(svg, g, opt);
    if (g.kind === 'hanger') return drawHanger(svg, g, opt);
    if (g.kind === 'joint') return drawJoint(svg, g, opt, res);
    if (g.kind === 'size') return drawSize(svg, g, opt);
    return drawPad(svg, g, opt);
  };
  const val = (opt, a, b) => (opt.showP ? a : b);

  function barDims(q) {
    const depth = q.shape === 'rect' ? q.h : q.shape === 'area' ? Math.sqrt(q.A) : q.d;
    return { depth, Ls: 10, hh: Math.max(0.35, Math.min(1.3, ((depth / Core.convert(q.L, 'm', 'mm')) * 10) / 2 || 0.6)) };
  }
  function drawBar(svg, g, opt) {
    const q = g.q, u = g.u, { Ls, hh } = barDims(q);
    const D = UI.Draw2D(svg, { xmin: -3.2, xmax: Ls + 6.2, ymin: -3, ymax: 3 });
    const k = deformOn() ? kD() : 0, f = Math.abs(g.eps) > 0 ? 0.06 / Math.abs(g.eps) : 0;
    const L2 = (Ls / 2) * (1 + g.eps * f * k), h2 = hh * (1 + g.elat * f * k), cx = Ls / 2;
    const rect = (l, h) => [[cx - l, -h], [cx + l, -h], [cx + l, h], [cx - l, h]];
    const col = k > 0 ? root.Anim.contour(0.25 + 0.55 * k) : COL.body;
    D.poly(rect(L2, h2), { fill: col, fop: 0.85, stroke: EDGE, sw: 1.6 });
    if (k > 0) D.poly(rect(Ls / 2, hh), { stroke: '#7f8c8d', sw: 1.2, dash: '6 4' });
    // load arrows: tension pulls outward
    const ten = g.ten, xl = cx - L2, xr = cx + L2, aL = 2.2;
    if (ten) { D.arrow([xl, 0], [xl - aL, 0], { color: LCOL, w: 3, head: 13 }); D.arrow([xr, 0], [xr + aL, 0], { color: LCOL, w: 3, head: 13 }); }
    else { D.arrow([xl - aL, 0], [xl, 0], { color: LCOL, w: 3, head: 13 }); D.arrow([xr + aL, 0], [xr, 0], { color: LCOL, w: 3, head: 13 }); }
    const Pt = `P = ${fmt(Math.abs(q.P))} ${u.F}`;
    D.text([xl - aL / 2, 0], Pt, { anchor: 'middle', dy: -12, color: LCOL, size: 12.5 });
    D.text([xr + aL / 2, 0], Pt, { anchor: 'middle', dy: -12, color: LCOL, size: 12.5 });
    D.dim([0, -hh - 1.1], [Ls, -hh - 1.1], `L = ${fmt(+q.L)} ${u.L}`, 18);
    D.text([cx, h2], val(opt, `σ = ${MD.show(g.sig, u.ST)} (${ten ? 'T' : 'C'})`, ten ? 'tension' : 'compression'), { anchor: 'middle', dy: -10, size: 13, color: '#1d2733' });
    if (k > 0 && opt.showP) D.text([cx, -h2], `δ = ${MD.show(g.del, u.S)}, ε_lat = ${fmt(g.elat * 1e6)}(10⁻⁶)`, { anchor: 'middle', dy: 20, size: 11.5, color: DCOL });
    // the cross-section, beside the bar
    const sx = Ls + 4.4;
    D.text([sx, 2.4], 'Section', { anchor: 'middle', size: 12, color: COL.dim });
    if (q.shape === 'rect') {
      const r = q.b / q.h, hs = 1.1, bs = Math.min(1.7, hs * r);
      D.poly([[sx - bs / 2, -hs], [sx + bs / 2, -hs], [sx + bs / 2, hs], [sx - bs / 2, hs]], { fill: col, fop: 0.85, stroke: EDGE, sw: 1.4 });
      D.text([sx, -hs], `${fmt(+q.b)} × ${fmt(+q.h)} ${u.S}`, { anchor: 'middle', dy: 18, size: 11.5, color: COL.dim });
    } else if (q.shape === 'circle' || q.shape === 'tube') {
      D.circle([sx, 0], 1.0, { fill: col, fop: 0.85, stroke: EDGE, sw: 1.4 });
      if (q.shape === 'tube') D.circle([sx, 0], Math.max(0.15, (q.di / q.d) * 1.0), { fill: '#ffffff', stroke: EDGE, sw: 1.2 });
      D.text([sx, -1], q.shape === 'tube' ? `d_o = ${fmt(+q.d)}, d_i = ${fmt(+q.di)} ${u.S}` : `d = ${fmt(+q.d)} ${u.S}`, { anchor: 'middle', dy: 18, size: 11.5, color: COL.dim });
    } else {
      D.poly([[sx - 0.9, -0.9], [sx + 0.9, -0.9], [sx + 0.9, 0.9], [sx - 0.9, 0.9]], { fill: col, fop: 0.85, stroke: EDGE, sw: 1.4 });
      D.text([sx, -0.9], `A = ${fmt(+q.A)} ${u.A}`, { anchor: 'middle', dy: 18, size: 11.5, color: COL.dim });
    }
  }

  function hangerPts(g) {
    const q = g.q, c1 = Math.cos(q.a1 * DEG), s1 = Math.sin(q.a1 * DEG), c2 = Math.cos(q.a2 * DEG), s2 = Math.sin(q.a2 * DEG);
    return { A1: [-q.L1 * c1, q.L1 * s1], A2: [q.L2 * c2, q.L2 * s2], Lm: Math.max(q.L1, q.L2), c1, s1, c2, s2 };
  }
  function drawHanger(svg, g, opt) {
    const q = g.q, u = g.u, { A1, A2, Lm } = hangerPts(g), w = Lm * 0.16;
    const D = UI.Draw2D(svg, { xmin: Math.min(A1[0], -w) - Lm * 0.25, xmax: Math.max(A2[0], w) + Lm * 0.25, ymin: -Lm * 0.75, ymax: Math.max(A1[1], A2[1]) + Lm * 0.15 });
    const k = deformOn() ? kD() : 0, umv = [MD.fromBase(g.ux, u.L), MD.fromBase(g.uy, u.L)], amp = MDUI.exag(Lm, Math.hypot(...umv), 0.06) * k;
    const B = [umv[0] * amp, umv[1] * amp];
    [A1, A2].forEach((A, i) => {
      const dir = i === 0 ? [A[0], A[1]] : [A[0], A[1]], l = Math.hypot(...dir), n = [dir[0] / l, dir[1] / l], p = [-n[1], n[0]], s0 = Lm * 0.07;
      const c = [A[0] + n[0] * s0 * 0.5, A[1] + n[1] * s0 * 0.5];
      D.poly([[c[0] - p[0] * s0 * 1.4 - n[0] * s0 * 0.5, c[1] - p[1] * s0 * 1.4 - n[1] * s0 * 0.5], [c[0] + p[0] * s0 * 1.4 - n[0] * s0 * 0.5, c[1] + p[1] * s0 * 1.4 - n[1] * s0 * 0.5], [c[0] + p[0] * s0 * 1.4 + n[0] * s0 * 0.5, c[1] + p[1] * s0 * 1.4 + n[1] * s0 * 0.5], [c[0] - p[0] * s0 * 1.4 + n[0] * s0 * 0.5, c[1] - p[1] * s0 * 1.4 + n[1] * s0 * 0.5]], { fill: 'url(#hatch)', stroke: COL.support });
    });
    if (k > 0) { D.line([0, 0], A1, { stroke: '#7f8c8d', sw: 1.2, dash: '6 4' }); D.line([0, 0], A2, { stroke: '#7f8c8d', sw: 1.2, dash: '6 4' }); }
    const wd = (d) => Math.max(3, Math.min(9, 3 + d / (u.us ? 0.1 : 3)));
    const c1 = k > 0 ? root.Anim.contour(0.2 + 0.6 * k * Math.min(1, g.s1 / Math.max(g.s1, g.s2))) : '#5d6d7e', c2 = k > 0 ? root.Anim.contour(0.2 + 0.6 * k * Math.min(1, g.s2 / Math.max(g.s1, g.s2))) : '#5d6d7e';
    D.line(B, A1, { stroke: c1, sw: wd(q.d1) }); D.line(B, A2, { stroke: c2, sw: wd(q.d2) });
    D.circle(B, Lm * 0.025, { fill: '#fff', stroke: EDGE, sw: 2 });
    // weight
    const wy = -Lm * 0.32;
    D.line([B[0], B[1] - Lm * 0.025], [B[0], wy + B[1]], { stroke: EDGE, sw: 2 });
    D.poly([[B[0] - w / 2, wy + B[1]], [B[0] + w / 2, wy + B[1]], [B[0] + w / 2, wy - w * 0.7 + B[1]], [B[0] - w / 2, wy - w * 0.7 + B[1]]], { fill: '#d9b58a', stroke: '#8a6a3f', sw: 1.4 });
    D.arrow([B[0], wy - w * 0.75 + B[1]], [B[0], wy - w * 0.75 - Lm * 0.2 + B[1]], { color: LCOL, w: 3, head: 13 });
    D.text([B[0], wy - w * 0.75 - Lm * 0.2 + B[1]], val(opt, `W = ${fmt(g.W)} ${u.F}`, 'W'), { anchor: 'middle', dy: 16, color: LCOL, size: 12.5 });
    const lab = (A, i, F, sg, d) => {
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      D.text(m, val(opt, `F${i} = ${fmt(F)} ${u.F}`, `rod ${i === '₁' ? 1 : 2}`), { anchor: i === '₁' ? 'end' : 'start', dx: i === '₁' ? -10 : 10, dy: -4, color: RCOL, size: 12.5 });
      D.text(m, val(opt, `σ${i} = ${fmt(sg)} ${u.ST}`, `d = ${fmt(d)} ${u.S}`), { anchor: i === '₁' ? 'end' : 'start', dx: i === '₁' ? -10 : 10, dy: 12, color: '#1d2733', size: 11.5 });
    };
    lab(A1, '₁', g.F1, g.s1, q.d1); lab(A2, '₂', g.F2, g.s2, q.d2);
    D.arc([0, 0], 34, 180 - q.a1, 180, `${fmt(+q.a1)}°`); D.arc([0, 0], 46, 0, +q.a2, `${fmt(+q.a2)}°`);
    D.text(B, 'B', { dx: 10, dy: 16, size: 12.5 });
  }

  /* joint: side view (with the shear planes and bearing) and top view of the plate */
  function drawJoint(svg, g, opt, res) {
    const q = g.q, u = g.u, n = Math.round(q.n), pl = Math.round(q.planes) === 2 ? 2 : 1;
    const dd = Math.max(0.45, Math.min(2.2, q.d / q.t)), ws = q.w > 0 ? Math.max(n * dd * 1.6, Math.min(9, q.w / q.t)) : Math.max(3, n * dd * 2.2), es = q.e > 0 ? Math.max(dd * 0.7, Math.min(5, q.e / q.t)) : dd * 1.8;
    const D = UI.Draw2D(svg, { xmin: -9, xmax: 10, ymin: -ws - 4.6, ymax: 3.6 }, { pad: 30 });
    const by = (key) => g.modes.find((m) => m.key === key), isGov = (key) => g.gov === key;
    const mtxt = (m) => (!m ? '' : q.task === 'allow' ? (m.P !== undefined ? `P = ${fmt(m.P)} ${u.F}` : '') : `${fmt(m.s)} ${u.ST}`);
    // side view
    const plates = pl === 1 ? [{ y0: 0, y1: 1, x0: -7, x1: es, dir: -1, main: true }, { y0: -1, y1: 0, x0: -es, x1: 7, dir: 1 }] : [{ y0: 0.5, y1: 1.5, x0: -7, x1: es, dir: -1 }, { y0: -0.5, y1: 0.5, x0: -es, x1: 7, dir: 1, main: true }, { y0: -1.5, y1: -0.5, x0: -7, x1: es, dir: -1 }];
    if (pl === 2) { plates[1].x0 = -es; plates[0].x1 = plates[2].x1 = es; plates[1].main = true; plates[0].x0 = plates[2].x0 = -7; plates[0].dir = plates[2].dir = -1; }
    if (pl === 2) { // the middle plate is pulled one way, the outer plates the other
      plates[1].x0 = -7; plates[1].x1 = es; plates[1].dir = -1; plates[0].x0 = plates[2].x0 = -es; plates[0].x1 = plates[2].x1 = 7; plates[0].dir = plates[2].dir = 1;
    }
    plates.forEach((p) => D.poly([[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]], { fill: PLATE, stroke: EDGE, sw: 1.3 }));
    const ytop = Math.max(...plates.map((p) => p.y1)), ybot = Math.min(...plates.map((p) => p.y0));
    // bolt with head and nut
    D.poly([[-dd / 2, ybot - 0.35], [dd / 2, ybot - 0.35], [dd / 2, ytop + 0.35], [-dd / 2, ytop + 0.35]], { fill: BOLT, stroke: EDGE, sw: 1.2 });
    D.poly([[-dd, ytop + 0.35], [dd, ytop + 0.35], [dd, ytop + 0.8], [-dd, ytop + 0.8]], { fill: BOLT, stroke: EDGE, sw: 1.2 });
    D.poly([[-dd, ybot - 0.35], [dd, ybot - 0.35], [dd, ybot - 0.8], [-dd, ybot - 0.8]], { fill: BOLT, stroke: EDGE, sw: 1.2 });
    // bearing area of the main plate: the side of the hole the plate pushes on
    const mp = plates.find((p) => p.main);
    const bx = mp.dir < 0 ? 0 : -dd / 2;
    D.poly([[bx, mp.y0], [bx + dd / 2, mp.y0], [bx + dd / 2, mp.y1], [bx, mp.y1]], { fill: BRC, fop: isGov('bear') ? 0.85 : 0.55, stroke: BRC, sw: isGov('bear') ? 2 : 1 });
    // shear planes
    const planesY = pl === 1 ? [0] : [-0.5, 0.5];
    planesY.forEach((yy) => D.line([-dd * 0.9, yy], [dd * 0.9, yy], { stroke: SHC, sw: isGov('bolt') ? 4 : 3 }));
    plates.forEach((p) => {
      const xe = p.dir < 0 ? p.x0 : p.x1, ym = (p.y0 + p.y1) / 2;
      D.arrow([xe, ym], [xe + p.dir * 1.7, ym], { color: LCOL, w: 2.6, head: 11 });
      D.text([xe + p.dir * 1.8, ym], plates.length === 3 && !p.main ? 'P/2' : 'P', { anchor: p.dir < 0 ? 'end' : 'start', dx: p.dir * 4, dy: 4, color: LCOL, size: 12 });
    });
    const sb = by('bolt'), sbr = by('bear');
    D.text([dd * 0.9, ytop + 0.8], `Bolt shear${opt.showP ? ': ' + mtxt(sb) : ''}`, { dx: 6, dy: -2, color: SHC, size: 12 });
    D.text([-dd * 0.9, ybot - 0.8], `Bearing${opt.showP ? ': ' + mtxt(sbr) : ''}`, { anchor: 'end', dx: -6, dy: 12, color: BRC, size: 12 });
    D.text([0, ytop + 0.8], `Side view, ${pl === 1 ? 'single' : 'double'} shear`, { anchor: 'middle', dy: -10, size: 12, color: COL.dim });
    // top view of the main plate
    const yc = -ws / 2 - 3.2, half = ws / 2, x0 = mp.dir < 0 ? -7 : -es, x1 = mp.dir < 0 ? es : 7;
    D.poly([[x0, yc - half], [x1, yc - half], [x1, yc + half], [x0, yc + half]], { fill: PLATE, stroke: EDGE, sw: 1.3 });
    const ys = []; for (let i = 0; i < n; i++) ys.push(yc - half + (ws * (i + 0.5)) / n);
    if (q.w > 0) D.line([0, yc - half], [0, yc + half], { stroke: NTC, sw: isGov('net') ? 3.6 : 2.4, dash: '7 4' });
    ys.forEach((yy) => {
      if (q.e > 0) [-1, 1].forEach((sg) => D.line([0, yy + (sg * dd) / 2], [mp.dir < 0 ? x1 : x0, yy + (sg * dd) / 2], { stroke: TRC, sw: isGov('tear') ? 3.4 : 2.2 }));
      D.circle([0, yy], dd / 2, { fill: BOLT, stroke: EDGE, sw: 1.2 });
    });
    D.arrow([mp.dir < 0 ? x0 : x1, yc], [(mp.dir < 0 ? x0 : x1) + mp.dir * 1.7, yc], { color: LCOL, w: 2.6, head: 11 });
    if (q.w > 0) { D.text([0, yc + half], `Net section${opt.showP ? ': ' + mtxt(by('net')) : ''}`, { anchor: 'middle', dy: -8, color: NTC, size: 12 }); D.dim([x1 + 0.5, yc - half], [x1 + 0.5, yc + half], `w = ${fmt(+q.w)} ${u.S}`, -8); }
    if (q.e > 0) D.text([mp.dir < 0 ? x1 : x0, yc - half], `Tear-out${opt.showP ? ': ' + mtxt(by('tear')) : ''}`, { anchor: mp.dir < 0 ? 'end' : 'start', dy: 18, color: TRC, size: 12 });
    D.text([0, yc - half], `Top view of the plate, d = ${fmt(+q.d)} ${u.S}, t = ${fmt(+q.t)} ${u.S}`, { anchor: 'middle', dy: 36, size: 12, color: COL.dim });
  }

  function drawSize(svg, g, opt) {
    const q = g.q, u = g.u, v = g.val, use = g.use;
    const D = UI.Draw2D(svg, { xmin: -7, xmax: 6, ymin: -4.6, ymax: 4.2 });
    const lab = `${q.part === 'punch' ? 't' : q.part === 'collar' ? 'd_o' : 'd'} = ${fmt(v)} ${u.S}${use ? `  →  use ${fmt(use)} ${u.S}` : ''}`;
    if (q.part === 'pin') {
      const pl = Math.round(q.planes) === 2 ? 2 : 1, dd = 1.2;
      const pls = pl === 1 ? [[0, 1, -5, 1.4, -1], [-1, 0, -1.4, 5, 1]] : [[0.5, 1.5, -1.4, 5, 1], [-0.5, 0.5, -5, 1.4, -1], [-1.5, -0.5, -1.4, 5, 1]];
      pls.forEach(([y0, y1, x0, x1]) => D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: PLATE, stroke: EDGE, sw: 1.3 }));
      const yt = pl === 1 ? 1 : 1.5;
      D.poly([[-dd / 2, -yt - 0.4], [dd / 2, -yt - 0.4], [dd / 2, yt + 0.4], [-dd / 2, yt + 0.4]], { fill: BOLT, stroke: EDGE, sw: 1.2 });
      (pl === 1 ? [0] : [-0.5, 0.5]).forEach((yy) => D.line([-dd, yy], [dd, yy], { stroke: SHC, sw: 3.2 }));
      pls.forEach(([y0, y1, x0, x1, dir]) => { const xe = dir < 0 ? x0 : x1; D.arrow([xe, (y0 + y1) / 2], [xe + dir * 1.2, (y0 + y1) / 2], { color: LCOL, w: 2.4, head: 10 }); });
      D.text([0, -yt - 0.4], `${pl === 1 ? 'Single' : 'Double'} shear, P = ${fmt(+q.P)} ${u.F}`, { anchor: 'middle', dy: 22, size: 12.5, color: LCOL });
      D.text([0, yt + 0.4], lab, { anchor: 'middle', dy: -12, size: 13, color: SHC });
    } else if (q.part === 'rod') {
      hatchBox(D, -2.5, 3.2, 2.5, 3.8);
      D.poly([[-0.45, -2.6], [0.45, -2.6], [0.45, 3.2], [-0.45, 3.2]], { fill: STEEL, stroke: EDGE, sw: 1.3 });
      D.line([-0.45, 0.3], [0.45, 0.3], { stroke: SHC, sw: 3 });
      D.arrow([0, -2.6], [0, -4.2], { color: LCOL, w: 3, head: 12 });
      D.text([0, -4.2], `P = ${fmt(+q.P)} ${u.F}`, { anchor: 'middle', dx: 0, dy: 16, color: LCOL, size: 12.5 });
      D.text([0.6, 0.3], lab, { dy: 4, size: 13, color: SHC });
    } else if (q.part === 'punch') {
      // plate with a hole, the rod through it and its head resting on the plate
      D.poly([[-4.5, 0], [-1.1, 0], [-1.1, 0.8], [-4.5, 0.8]], { fill: PLATE, stroke: EDGE, sw: 1.3 });
      D.poly([[1.1, 0], [4.5, 0], [4.5, 0.8], [1.1, 0.8]], { fill: PLATE, stroke: EDGE, sw: 1.3 });
      hatchBox(D, -5.2, -1.5, -4.5, 2.2); hatchBox(D, 4.5, -1.5, 5.2, 2.2);
      D.poly([[-1.6, 0.8], [1.6, 0.8], [1.6, 1.5], [-1.6, 1.5]], { fill: STEEL, stroke: EDGE, sw: 1.3 });
      D.poly([[-0.5, -3], [0.5, -3], [0.5, 0.8], [-0.5, 0.8]], { fill: STEEL, stroke: EDGE, sw: 1.3 });
      [-1.1, 1.1].forEach((x) => D.line([x, 0], [x, 0.8], { stroke: SHC, sw: 3.4 }));
      D.arrow([0, -3], [0, -4.3], { color: LCOL, w: 3, head: 12 });
      D.text([0, -4.3], `P = ${fmt(+q.P)} ${u.F}`, { anchor: 'middle', dy: 14, color: LCOL, size: 12.5 });
      D.text([0, 1.5], `shear on π d t, d = ${fmt(+q.dh)} ${u.S}`, { anchor: 'middle', dy: -10, size: 12, color: SHC });
      D.text([0, 2.4], lab, { anchor: 'middle', size: 13, color: SHC });
    } else {
      D.poly([[-5, -0.5], [5, -0.5], [5, 0.5], [-5, 0.5]], { fill: STEEL, stroke: EDGE, sw: 1.3 });
      D.poly([[0.6, -1.4], [1.2, -1.4], [1.2, 1.4], [0.6, 1.4]], { fill: '#9fb0bd', stroke: EDGE, sw: 1.3 });
      hatchBox(D, 1.2, 0.7, 2.4, 2.6); hatchBox(D, 1.2, -2.6, 2.4, -0.7);
      [[-1.4, -0.5], [0.5, 1.4]].forEach(([a, b]) => D.line([1.2, a], [1.2, b], { stroke: SHC, sw: 3.4 }));
      D.arrow([-6.6, 0], [-5.05, 0], { color: LCOL, w: 3, head: 12 });
      D.text([-6.6, 0], `P = ${fmt(+q.P)} ${u.F}`, { dy: -12, color: LCOL, size: 12.5 });
      D.text([0.9, 1.4], 'collar bears here', { anchor: 'middle', dy: -8, size: 12, color: SHC });
      D.text([0, -2.9], lab, { anchor: 'middle', dy: 4, size: 13, color: SHC });
    }
  }

  function drawPad(svg, g, opt) {
    const q = g.q, u = g.u, ar = q.h / q.a, Lx = 8, Hy = Math.max(1.2, Math.min(5, Lx * ar));
    const D = UI.Draw2D(svg, { xmin: -2.5, xmax: Lx + 3.5, ymin: -1.6, ymax: Hy + 2.2 });
    const k = deformOn() ? kD() : 0, shift = Math.tan(Math.max(1e-9, g.gam)) > 0 ? Math.min(Hy * 0.35, Hy * Math.tan(g.gam) * MDUI.exag(1, Math.tan(g.gam), 0.3)) * k : 0;
    hatchBox(D, -1.2, -0.6, Lx + 1.2, 0);
    const P = [[0, 0], [Lx, 0], [Lx + shift, Hy], [shift, Hy]];
    if (k > 0) D.poly([[0, 0], [Lx, 0], [Lx, Hy], [0, Hy]], { stroke: '#7f8c8d', sw: 1.2, dash: '6 4' });
    D.poly(P, { fill: k > 0 ? root.Anim.contour(0.25 + 0.55 * k) : '#d6dde3', fop: 0.85, stroke: EDGE, sw: 1.6 });
    D.poly([[shift - 0.2, Hy], [Lx + shift + 0.2, Hy], [Lx + shift + 0.2, Hy + 0.35], [shift - 0.2, Hy + 0.35]], { fill: STEEL, stroke: EDGE, sw: 1.2 });
    D.arrow([shift - 2.2, Hy + 0.17], [shift - 0.2, Hy + 0.17], { color: LCOL, w: 3, head: 12 });
    D.text([shift - 2.2, Hy + 0.17], val(opt, `V = ${fmt(g.V)} ${u.F}`, 'V'), { dy: -10, color: LCOL, size: 12.5 });
    if (shift > 0) D.arc([0, 0], 44, 90 - Math.atan2(shift, Hy) / DEG, 90, 'γ');
    D.dim([0, -0.6], [Lx, -0.6], `a = ${fmt(+q.a)} ${u.S}`, 16);
    D.dim([Lx + 0.6 + shift, 0], [Lx + 0.6 + shift, Hy], `h = ${fmt(+q.h)} ${u.S}`, -14);
    D.text([Lx / 2 + shift / 2, Hy / 2], val(opt, `τ = ${MD.show(g.tau, u.ST)}`, 'τ'), { anchor: 'middle', size: 13 });
    D.text([Lx / 2 + shift / 2, Hy / 2], val(opt, `γ = ${fmt(g.gam)} rad`, ''), { anchor: 'middle', dy: 18, size: 12, color: DCOL });
  }

  function drawCurve(svg, g, opt) {
    const { W, H } = Charts.clear(svg), pts = g.pts, last = pts[pts.length - 1], zoom = S().zoom !== false;
    const prog = S()._p, eNow = prog === undefined ? null : prog * last.e;
    const panels = zoom ? [{ x: 64, w: W * 0.56 - 80, e1: last.e * 1.05, title: 'Whole curve' }, { x: W * 0.56 + 44, w: W * 0.44 - 64, e1: Math.max((g.ys ? g.ys.e : g.pl.e) * 1.6, g.pl.e * 3), title: 'Start of the curve, magnified' }] : [{ x: 64, w: W - 90, e1: last.e * 1.05, title: '' }];
    const smax = Math.max(...pts.map((p) => p.s)) * 1.12;
    const sAt = (e) => { for (let i = 0; i < pts.length - 1; i++) if (e <= pts[i + 1].e) { const t = (e - pts[i].e) / (pts[i + 1].e - pts[i].e); return pts[i].s + t * (pts[i + 1].s - pts[i].s); } return last.s; };
    panels.forEach((pn, ip) => {
      const F = Charts.frame(svg, { x: pn.x, y: 30, w: pn.w, h: H - 30 - 46, xmin: 0, xmax: pn.e1, ymin: 0, ymax: smax, padY: 0, xlabel: 'ε', ylabel: ip === 0 ? `σ (${g.uE})` : '', yside: ip === 0 ? 46 : 0 });
      if (pn.title) T(svg, pn.x + pn.w / 2, 20, pn.title, { anchor: 'middle', color: '#5a6b75', size: 12 });
      const clip = (arr) => arr.filter((p) => p[0] <= pn.e1 * 1.0001);
      const curvePts = []; pts.forEach((p, i) => { if (p.e <= pn.e1) curvePts.push([p.e, p.s]); else if (i && pts[i - 1].e < pn.e1) curvePts.push([pn.e1, sAt(pn.e1)]); });
      Charts.curve(F, curvePts, { color: '#1d2733', width: 2.2 });
      const eL = Math.min(pn.e1, (smax / g.E));
      Charts.curve(F, [[0, 0], [eL, eL * g.E]], { color: NTC, width: 1.4, dash: '2 4' });
      const off = [[0.002, 0], [Math.min(pn.e1, 0.002 + smax / g.E), Math.min(smax, (pn.e1 - 0.002) * g.E)]];
      if (0.002 < pn.e1) Charts.curve(F, off, { color: BRC, width: 1.6, dash: '7 4' });
      Charts.mark(F, g.pl.e, g.pl.s, ip === 1 || !zoom ? `σ_pl = ${fmt(g.pl.s)}` : '', { color: NTC, anchor: 'start', dx: 8, dy: 14 });
      if (g.ys && g.ys.e <= pn.e1) Charts.mark(F, g.ys.e, g.ys.s, ip === 1 || !zoom ? `σ_YS = ${fmt(g.ys.s)}` : '', { color: BRC, dx: 8, dy: -8 });
      const pu = pts[g.iu];
      if (pu.e <= pn.e1) Charts.mark(F, pu.e, pu.s, ip === 0 ? `σ_u = ${fmt(pu.s)}` : '', { color: SHC, anchor: 'middle', dx: 0, dy: -10 });
      if (ip === 0) Charts.mark(F, last.e, last.s, `σ_f = ${fmt(last.s)}`, { color: '#1d2733', anchor: 'end', dx: -4, dy: 18 });
      if (g.un && g.un.e <= pn.e1) Charts.curve(F, clip([[g.un.e, g.un.s], [g.un.set, 0]]), { color: SHC, width: 2, dash: '5 3' });
      if (g.un && ip === 0) Charts.mark(F, g.un.set, 0, `set = ${fmt(g.un.set)}`, { color: SHC, dx: 6, dy: -8 });
      if (eNow !== null && eNow <= pn.e1) Charts.mark(F, eNow, sAt(eNow), ip === 0 ? `ε = ${fmt(eNow)}` : '', { color: DCOL, r: 6, dx: 8, dy: 16 });
      if (ip === 0 || !zoom) T(svg, pn.x + 8, 48, `E = ${fmt(g.u.us ? g.E : g.E / 1000)} ${g.u.MOD}`, { color: NTC, size: 12 });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u;
    if (g.kind === 'bar') {
      const q = g.q, { Ls, hh } = barDims(q), k = deformOn() ? kD() : 0, f = Math.abs(g.eps) > 0 ? 0.06 / Math.abs(g.eps) : 0;
      const L2 = (Ls / 2) * (1 + g.eps * f * k), h2 = hh * (1 + g.elat * f * k), col = k > 0 ? root.Anim.contour(0.25 + 0.55 * k) : '#b9c2cb';
      v._hs = 0.45;
      if (q.shape === 'rect' || q.shape === 'area') {
        const b2 = q.shape === 'rect' ? h2 * Math.min(2, q.b / q.h) : h2;
        v.box(-L2, -h2, -b2, L2, h2, b2, col, 1, EDGE);
        if (k > 0) v.box(-Ls / 2, -hh, -(q.shape === 'rect' ? hh * Math.min(2, q.b / q.h) : hh), Ls / 2, hh, q.shape === 'rect' ? hh * Math.min(2, q.b / q.h) : hh, '#9aa5ad', 0.1, '#7f8c8d');
      } else MDUI.cyl(v, [-L2, 0, 0], [L2, 0, 0], h2, col, { ri: q.shape === 'tube' ? h2 * (q.di / q.d) : 0, stroke: EDGE, n: 32 });
      const sg = g.ten ? 1 : -1;
      [[-L2, -1], [L2, 1]].forEach(([x, d]) => { const a = [x, 0, 0], b = [x + d * 2.4, 0, 0]; if (sg > 0) MDUI.arrow3(v, a, b, LCOL, 3); else MDUI.arrow3(v, b, a, LCOL, 3); });
      v.label([L2 + 2.6, 0.3, 0], `P = ${fmt(Math.abs(q.P))} ${u.F}`, LCOL);
      v.label([0, h2 + 0.5, 0], opt.showP ? `σ = ${MD.show(g.sig, u.ST)}` : 'σ', '#1d2733');
      v.autoBounds(); return;
    }
    if (g.kind === 'hanger') {
      const q = g.q, { A1, A2, Lm } = hangerPts(g), k = deformOn() ? kD() : 0, umv = [MD.fromBase(g.ux, u.L), MD.fromBase(g.uy, u.L)], amp = MDUI.exag(Lm, Math.hypot(...umv), 0.06) * k;
      const B = [umv[0] * amp, umv[1] * amp, 0], r = (d) => Lm * Math.max(0.008, Math.min(0.03, (d / (u.us ? 1 : 25)) * 0.02));
      v._hs = Lm * 0.05;
      [A1, A2].forEach((A, i) => {
        MDUI.cyl(v, B, [A[0], A[1], 0], r(i ? q.d2 : q.d1), i ? '#8fa3b3' : '#8fa3b3', { n: 16 });
        const n = [A[0] / Math.hypot(...A), A[1] / Math.hypot(...A)], c = [A[0] + n[0] * Lm * 0.03, A[1] + n[1] * Lm * 0.03];
        v.box(c[0] - Lm * 0.05, c[1] - Lm * 0.05, -Lm * 0.08, c[0] + Lm * 0.05, c[1] + Lm * 0.05, Lm * 0.08, '#cfd8de', 1, EDGE);
        if (k > 0) v.line([[0, 0, 0], [A[0], A[1], 0]], '#7f8c8d', 1.2, [6, 4]);
      });
      v.box(B[0] - Lm * 0.03, B[1] - Lm * 0.03, -Lm * 0.03, B[0] + Lm * 0.03, B[1] + Lm * 0.03, Lm * 0.03, '#5d6d7e', 1, EDGE);
      const wy = B[1] - Lm * 0.32, w = Lm * 0.16;
      v.line([[B[0], B[1], 0], [B[0], wy, 0]], EDGE, 2);
      v.box(B[0] - w / 2, wy - w * 0.7, -w / 2, B[0] + w / 2, wy, w / 2, '#d9b58a', 1, '#8a6a3f');
      MDUI.arrow3(v, [B[0], wy - w * 0.75, 0], [B[0], wy - w * 0.75 - Lm * 0.2, 0], LCOL, 2.6);
      v.label([B[0], wy - w * 0.75 - Lm * 0.24, 0], opt.showP ? `W = ${fmt(g.W)} ${u.F}` : 'W', LCOL);
      v.label([A1[0] / 2, A1[1] / 2 + Lm * 0.06, 0], opt.showP ? `σ₁ = ${fmt(g.s1)} ${u.ST}` : 'rod 1', RCOL);
      v.label([A2[0] / 2, A2[1] / 2 + Lm * 0.06, 0], opt.showP ? `σ₂ = ${fmt(g.s2)} ${u.ST}` : 'rod 2', RCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'joint' || (g.kind === 'size' && g.q.part === 'pin')) {
      const q = g.q, pl = Math.round(q.planes) === 2 ? 2 : 1, dd = g.kind === 'joint' ? Math.max(0.45, Math.min(2.2, q.d / q.t)) : 1.2;
      const n = g.kind === 'joint' ? Math.round(q.n) : 1, ws = g.kind === 'joint' && q.w > 0 ? Math.max(n * dd * 1.6, Math.min(9, q.w / q.t)) : Math.max(3, n * dd * 2.2), es = g.kind === 'joint' && q.e > 0 ? Math.max(dd * 0.7, Math.min(5, q.e / q.t)) : dd * 1.8;
      const layers = pl === 1 ? [[0, 1, -7, es, -1], [-1, 0, -es, 7, 1]] : [[0.5, 1.5, -es, 7, 1], [-0.5, 0.5, -7, es, -1], [-1.5, -0.5, -es, 7, 1]];
      v._hs = 0.5;
      // plates stacked from the bottom up; the bolt head sits on the top plate and the nut under the bottom one
      const stack = layers.slice().sort((p1, p2) => p1[0] - p2[0]);
      stack.forEach(([y0, y1, x0, x1], i) => v.box(x0, y0, -ws / 2, x1, y1, ws / 2, PLATE, 1, EDGE, { layer: MDUI.upLayer(i + 1) }));
      const yt = pl === 1 ? 1 : 1.5;
      for (let i = 0; i < n; i++) {
        const z = -ws / 2 + (ws * (i + 0.5)) / n;
        MDUI.cyl(v, [0, yt, z], [0, yt + 0.45, z], dd * 0.95, BOLT, { n: 6, stroke: EDGE, layer: MDUI.upLayer(10) });
        MDUI.cyl(v, [0, -yt - 0.45, z], [0, -yt, z], dd * 0.95, BOLT, { n: 6, stroke: EDGE, layer: MDUI.upLayer(-10) });
      }
      layers.forEach(([y0, y1, x0, x1, dir]) => { const xe = dir < 0 ? x0 : x1; MDUI.arrow3(v, [xe, (y0 + y1) / 2, 0], [xe + dir * 2, (y0 + y1) / 2, 0], LCOL, 2.6); });
      v.label([0, yt + 1.2, 0], g.kind === 'joint' ? `d = ${fmt(+q.d)} ${u.S}` : `d = ${fmt(g.val)} ${u.S}`, SHC);
      v.autoBounds(); return;
    }
    if (g.kind === 'size') {
      const q = g.q;
      v._hs = 0.4;
      if (q.part === 'rod') {
        v.box(-2.5, 3.2, -2.5, 2.5, 3.7, 2.5, '#cfd8de', 1, EDGE, { layer: -1 });
        MDUI.cyl(v, [0, -2.6, 0], [0, 3.2, 0], 0.45, STEEL, { stroke: EDGE });
        MDUI.arrow3(v, [0, -2.7, 0], [0, -4.4, 0], LCOL, 3);
        v.label([0.6, 0.3, 0], `d = ${fmt(g.val)} ${u.S}`, SHC);
      } else if (q.part === 'punch') {
        MDUI.cyl(v, [0, 0, 0], [0, 0.8, 0], 4.2, PLATE, { ri: 1.1, n: 40, layer: MDUI.upLayer(1) });
        MDUI.cyl(v, [0, 0.8, 0], [0, 1.5, 0], 1.6, STEEL, { stroke: EDGE, layer: MDUI.upLayer(2) });
        MDUI.cyl(v, [0, -3, 0], [0, 0.0, 0], 0.5, STEEL, { stroke: EDGE, layer: MDUI.upLayer(-2) });
        MDUI.arrow3(v, [0, -3.1, 0], [0, -4.4, 0], LCOL, 3);
        v.label([0, 2.2, 0], `t = ${fmt(g.val)} ${u.S}`, SHC);
      } else {
        MDUI.cyl(v, [-5, 0, 0], [5, 0, 0], 0.5, STEEL, { stroke: EDGE });
        MDUI.cyl(v, [0.6, 0, 0], [1.2, 0, 0], 1.4, '#9fb0bd', { ri: 0.5, stroke: EDGE });
        v.box(1.2, 0.7, -1.4, 2.4, 2.6, 1.4, '#cfd8de', 1, EDGE); v.box(1.2, -2.6, -1.4, 2.4, -0.7, 1.4, '#cfd8de', 1, EDGE);
        MDUI.arrow3(v, [-7, 0, 0], [-5.1, 0, 0], LCOL, 3);
        v.label([0.9, 1.9, 0], `d_o = ${fmt(g.val)} ${u.S}`, SHC);
      }
      v.autoBounds(); return;
    }
    if (g.kind === 'curve') {
      // round test specimen: grips, shoulders and the gauge length, stretched to the strain reached
      const last = g.pts[g.pts.length - 1], p = S()._p, e = p === undefined ? last.e : p * last.e;
      const pu = g.pts[g.iu], neck = e > pu.e ? Math.min(1, (e - pu.e) / Math.max(1e-9, last.e - pu.e)) : 0;
      const Lg = 4 * (1 + e), r0 = 0.55, y0 = 1.6, top = -y0 + 0.5 + Lg, SP = '#b9c4cc';
      MDUI.cyl(v, [0, -y0 - 1.4, 0], [0, -y0, 0], 1.0, SP, { n: 32 });
      MDUI.cyl(v, [0, -y0, 0], [0, -y0 + 0.5, 0], 1, SP, { n: 32, caps: false, rOf: (t) => 1 - (1 - r0) * t });
      MDUI.cyl(v, [0, -y0 + 0.5, 0], [0, top, 0], r0, SP, { n: 32, nz: 24, caps: false, rOf: (t) => r0 * (1 - 0.45 * neck * Math.exp(-(((t - 0.5) / 0.12) ** 2))) });
      MDUI.cyl(v, [0, top, 0], [0, top + 0.5, 0], 1, SP, { n: 32, caps: false, rOf: (t) => r0 + (1 - r0) * t });
      MDUI.cyl(v, [0, top + 0.5, 0], [0, top + 1.9, 0], 1.0, SP, { n: 32 });
      v.box(-1.5, -y0 - 2.2, -1.5, 1.5, -y0 - 1.4, 1.5, '#7d8a96', 1, EDGE);
      v.box(-1.5, top + 1.9, -1.5, 1.5, top + 2.7, 1.5, '#7d8a96', 1, EDGE);
      MDUI.arrow3(v, [0, top + 2.8, 0], [0, top + 4.2, 0], LCOL, 3);
      v.label([1.2, top / 2, 0], `ε = ${fmt(e)}`, DCOL);
      v.autoBounds(); return;
    }
    // block in shear
    const q = g.q, ar = q.h / q.a, Lx = 8, Hy = Math.max(1.2, Math.min(5, Lx * ar)), bz = Math.max(1, Math.min(8, (Lx * q.b) / q.a)) / 2;
    const k = deformOn() ? kD() : 0, shift = Math.min(Hy * 0.35, Hy * Math.tan(g.gam) * MDUI.exag(1, Math.tan(Math.max(1e-9, g.gam)), 0.3)) * k;
    v._hs = 0.5;
    v.box(-1.2, -0.5, -bz - 0.8, Lx + 1.2, 0, bz + 0.8, '#cfd8de', 1, EDGE, { layer: MDUI.upLayer(1) });
    v.extrude([[0, 0], [Lx, 0], [Lx + shift, Hy], [shift, Hy]], -bz, bz, k > 0 ? root.Anim.contour(0.25 + 0.55 * k) : '#d6dde3', 1, EDGE, { layer: MDUI.upLayer(2) });
    v.extrude([[shift - 0.2, Hy], [Lx + shift + 0.2, Hy], [Lx + shift + 0.2, Hy + 0.35], [shift - 0.2, Hy + 0.35]], -bz - 0.2, bz + 0.2, STEEL, 1, EDGE, { layer: MDUI.upLayer(3) });
    MDUI.arrow3(v, [shift - 2.8, Hy + 0.17, 0], [shift - 0.25, Hy + 0.17, 0], LCOL, 3);
    v.label([shift - 3, Hy + 0.5, 0], 'V', LCOL);
    v.label([Lx / 2, Hy + 0.9, bz], opt.showP ? `γ = ${fmt(g.gam)} rad` : 'γ', DCOL);
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const bar = (o, fu) => ({ mode: 'bar', fu: fu || 'kN', bar: o });
  M.presets = [
    { name: 'Test: Book Example 8.3, steel bar 100 × 50 mm pulled by 80 kN (σ = 16 MPa, δ = 0.120 mm)', units: 'SI', state: bar({ shape: 'rect', b: 100, h: 50, L: 1.5, P: 80, mat: 'a36', E: 200, nu: 0.32, sY: 250 }),
      expect: [{ k: 'Normal stress σ', v: 16 }, { k: 'Change in length δ', v: 0.12 }, { k: 'Lateral strain ε_lat', v: -25.6e-6 }, { k: 'Change in width b', v: -0.00256 }, { k: 'Change in depth h', v: -0.00128 }] },
    { name: 'Aluminium tube in compression', units: 'US', state: bar({ shape: 'tube', d: 2, di: 1.5, L: 4, P: -8, mat: 'al6061', E: 10000, nu: 0.35, sY: 37 }, 'kip') },
    { name: 'Test: Book Example 7.6, 80 kg lamp on two rods (σ_BA = 8.05 MPa, σ_BC = 7.86 MPa)', units: 'SI', state: { mode: 'hanger', fu: 'N', hg: { wBy: 'mass', m: 80, a1: 60, a2: 36.8699, d1: 10, d2: 8, L1: 1.2, L2: 1.5, mat: 'a36', E: 200, sY: 250 } },
      expect: [{ k: 'Force in rod 1, F₁', v: 632.4 }, { k: 'Force in rod 2, F₂', v: 395.2 }, { k: 'Stress in rod 1, σ₁', v: 8.05 }, { k: 'Stress in rod 2, σ₂', v: 7.86 }] },
    { name: 'Test: Book Example 7.11, lap joint with one bolt (P_allow = 6.28 kN, bolt shear governs)', units: 'SI', state: { mode: 'joint', fu: 'kN', jt: { task: 'allow', P: 10, d: 10, n: 1, planes: 1, t: 15, w: 50, e: 20, tb: 80, st: 50, sb: 80, tp: 30 } },
      expect: [{ k: 'Allowable load P', v: 6.283 }, { k: 'Load for bearing on the plate', v: 12 }, { k: 'Load for tension on the net section of the plate', v: 30 }, { k: 'Load for shear tear-out of the plate', v: 18 }] },
    { name: 'Test: Book Example 7.8, 20 mm pin in double shear carrying 21.36 kN (τ = 34.0 MPa)', units: 'SI', state: { mode: 'joint', fu: 'kN', jt: { task: 'check', P: 21.36, d: 20, n: 1, planes: 2, t: 20, w: 0, e: 0, tb: 0, st: 0, sb: 0, tp: 0 } },
      expect: [{ k: 'Average shear stress in the bolts τ', v: 34.0 }] },
    { name: 'Splice plate with two bolts in double shear', units: 'US', state: { mode: 'joint', fu: 'kip', jt: { task: 'check', P: 18, d: 0.75, n: 2, planes: 2, t: 0.5, w: 5, e: 1.5, tb: 15, st: 22, sb: 48, tp: 12 } } },
    { name: 'Test: Book Example 7.10, pin A in single shear (d = 0.691 in., use 3/4 in.)', units: 'US', state: { mode: 'size', fu: 'kip', sz: { part: 'pin', P: 3, planes: 1, byFS: true, fail: 12, FS: 1.5, allow: 8, dh: 1.5, di: 2, step: 0.25 } },
      expect: [{ k: 'Required pin diameter d', v: 0.691 }, { k: 'Size to use (rounded up)', v: 0.75 }] },
    { name: 'Test: Book Example 7.10, pin C in double shear (d = 0.696 in.)', units: 'US', state: { mode: 'size', fu: 'kip', sz: { part: 'pin', P: 6.083, planes: 2, byFS: true, fail: 12, FS: 1.5, allow: 8, dh: 1.5, di: 2, step: 0.25 } },
      expect: [{ k: 'Required pin diameter d', v: 0.696 }] },
    { name: 'Test: Book Example 7.12, suspender rod (d = 20.6 mm)', units: 'SI', state: { mode: 'size', fu: 'kN', sz: { part: 'rod', P: 20, byFS: false, allow: 60, step: 0 } },
      expect: [{ k: 'Required rod diameter d', v: 20.6 }] },
    { name: 'Test: Book Example 7.12, disk that the rod must not tear through (t = 4.55 mm)', units: 'SI', state: { mode: 'size', fu: 'kN', sz: { part: 'punch', P: 20, byFS: false, allow: 35, dh: 40, step: 0 } },
      expect: [{ k: 'Required plate thickness t', v: 4.547 }] },
    { name: 'Test: Book Example 8.2, aluminium alloy unloaded from 600 MPa (set = 0.0150)', units: 'SI', state: { mode: 'curve', cv: { pts: [{ e: 0, s: 0 }, { e: 0.006, s: 450 }, { e: 0.012, s: 540 }, { e: 0.023, s: 600 }, { e: 0.03, s: 620 }, { e: 0.04, s: 600 }], nLin: 1, unload: true, sU: 600 } },
      expect: [{ k: 'Modulus of elasticity E', v: 75 }, { k: 'Modulus of resilience u_r', v: 1.35 }, { k: 'Permanent set', v: 0.015 }, { k: 'Modulus of resilience after reloading', v: 2.4 }] },
    { name: 'Test: Book Example 8.1, steel alloy read from its curve (E = 31.25(10³) ksi)', units: 'US', state: { mode: 'curve', cv: { pts: [{ e: 0, s: 0 }, { e: 0.0016, s: 50 }, { e: 0.003, s: 62 }, { e: 0.004, s: 68 }, { e: 0.006, s: 71 }, { e: 0.02, s: 80 }, { e: 0.06, s: 100 }, { e: 0.12, s: 108 }, { e: 0.18, s: 103 }, { e: 0.23, s: 90 }], nLin: 1, unload: false, sU: 100 } },
      expect: [{ k: 'Modulus of elasticity E', v: 31250 }, { k: 'Ultimate stress σ_u', v: 108 }, { k: 'Fracture stress σ_f', v: 90 }] },
    { name: 'Rubber bearing pad sheared by 2 kN', units: 'SI', state: { mode: 'pad', fu: 'kN', pad: { given: 'force', a: 150, b: 100, h: 20, V: 2, dx: 1, G: 0.2, useEnu: false, E: 0.6, nu: 0.5 } } },
    { name: 'Edge: a plate narrower than its bolt holes (fails on purpose)', units: 'SI', fails: true, state: { mode: 'joint', fu: 'kN', jt: { task: 'allow', d: 20, n: 3, planes: 1, t: 10, w: 50, e: 20, tb: 80, st: 50, sb: 80, tp: 30 } } },
  ];

  root.MStress = M;
})(window);
