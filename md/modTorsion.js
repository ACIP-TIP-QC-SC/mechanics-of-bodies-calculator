/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M3 Torsion
 * (inputs, diagrams, presets). Physics: md/torsion.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Torsion, MD, MDUI } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const T = Charts.text;
  const LCOL = COL.load, RCOL = COL.react, TCOL = COL.couple, DCOL = '#0f8a7e', EDGE = '#4a5661', LINE = '#2c3e50', SC = COL.shear;
  const LET = 'ABCDEFGH';
  const SHAFT = '#b9c2cb', CORE = '#d8b26e';
  const TWMAX = 0.9; // the largest twist drawn, rad (exaggerated)

  const M = { id: 'torsion', title: 'Torsion', defaults: Torsion.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const twistOn = () => S().defl !== false && !(mode() === 'power' && !(S().pw.L > 0 && S().pw.G > 0));

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const matOpts = () => [['custom', 'Your own values']].concat(MD.MATERIALS.filter((m) => m.SI.G).map((m) => [m.id, m.name]));
  const fillG = (it, key, mk) => { const m = MD.material(it[mk || 'mat'], M.units); if (m && m.G) it[key || 'G'] = m.G; };
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], u = MD.units(U), sys = M.units, TQ = Torsion.TU[sys].includes(st.tu) ? st.tu : Torsion.TU[sys][0];
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [['shaft', 'Stepped shaft with torques along it'], ['power', 'Shaft transmitting power'], ['composite', 'Tube bonded to a core'], ['noncirc', 'Square, triangular or elliptical shaft']] });
    if (st.mode !== 'power') C.seg(sec, { label: 'Torque unit', get: () => TQ, set: (v) => (st.tu = v), options: Torsion.TU[sys].map((t) => [t, t]) });
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    const matSel = (s2, o, mk, gk, label) => C.select(s2, { label: label || 'Material', get: () => o[mk] || 'custom', set: (id) => { o[mk] = id; fillG(o, gk, mk); }, options: matOpts() });
    if (st.mode === 'shaft') {
      const q = st.sh, n = q.segs.length;
      sec = C.section(c, 'Supports');
      C.note(sec, 'The shaft is held at A, on the left. Torques are vectors along the shaft (right-hand rule): positive points away from A.');
      C.seg(sec, { label: `The far end ${LET[n]} is`, get: () => q.right, set: (v) => (q.right = v), options: [['free', 'Free to turn'], ['fixed', 'Fixed']] });
      sec = C.section(c, 'Segments, from A');
      C.list(sec, {
        items: q.segs, max: 5, min: 1, title: (it, i) => `Segment ${LET[i]}${LET[i + 1]}`,
        fields: (it, i) => [{ key: 'L', label: 'Length L', unit: u.L }, { key: 'shape', label: 'Section', options: [['circle', 'Solid'], ['tube', 'Tube']] }, { key: 'd', label: it.shape === 'tube' ? 'Outer d_o' : 'Diameter d', unit: u.S }]
          .concat(it.shape === 'tube' ? [{ key: 'di', label: 'Inner d_i', unit: u.S }] : [], [{ key: 'mat', label: 'Material', options: matOpts(), onset: (o) => fillG(o), wide: true }, { key: 'G', label: 'G', unit: u.MOD }],
            i === n - 1 && q.right === 'fixed' ? [] : [{ key: 'T', label: `Torque at ${LET[i + 1]}`, unit: TQ }]),
        add: [['Segment', () => Object.assign({}, q.segs[q.segs.length - 1], { T: 0 })]],
      });
    } else if (st.mode === 'power') {
      const q = st.pw;
      sec = C.section(c, 'Power and speed');
      num(sec, q, 'P', 'Power P', sys === 'US' ? 'hp' : 'kW');
      num(sec, q, 'spd', 'Speed', q.spdU === 'Hz' ? 'Hz' : 'rev/min');
      C.seg(sec, { label: 'Speed given as', get: () => q.spdU, set: (v) => (q.spdU = v), options: [['rpm', 'rev/min'], ['Hz', 'Frequency f (Hz)']] });
      sec = C.section(c, 'Shaft');
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['size', 'Required size'], ['check', 'Shear stress']] });
      C.seg(sec, { label: 'Section', get: () => q.shape, set: (v) => (q.shape = v), options: [['circle', 'Solid'], ['tube', 'Tube']] });
      if (q.task === 'check') num(sec, q, 'd', q.shape === 'tube' ? 'Outer diameter d_o' : 'Diameter d', u.S);
      if (q.shape === 'tube') num(sec, q, 'di', 'Inner diameter d_i', u.S);
      if (q.task === 'size') { num(sec, q, 'tA', 'Allowable shear stress τ_allow', u.ST); num(sec, q, 'step', 'Round up to steps of (0 = no rounding)', u.S); }
      sec = C.section(c, 'Angle of twist (optional)');
      num(sec, q, 'L', 'Length L (0 = not found)', u.L);
      matSel(sec, q, 'mat', 'G');
      num(sec, q, 'G', 'Shear modulus G', u.MOD);
    } else if (st.mode === 'composite') {
      const q = st.cp;
      sec = C.section(c, 'Shaft');
      C.note(sec, 'The shaft is fixed at one end and twisted by T at the other. The tube and core are bonded together.');
      num(sec, q, 'T', 'Torque at the free end T', TQ);
      num(sec, q, 'L', 'Length L', u.L);
      num(sec, q, 'd', 'Outer diameter of the tube', u.S);
      num(sec, q, 'di', 'Diameter of the core', u.S);
      sec = C.section(c, 'Materials');
      matSel(sec, q, 'mat', 'G', 'Tube');
      num(sec, q, 'G', 'G of the tube', u.MOD);
      matSel(sec, q, 'matC', 'Gc', 'Core');
      num(sec, q, 'Gc', 'G of the core', u.MOD);
    } else {
      const q = st.nc;
      sec = C.section(c, 'Section');
      C.select(sec, { label: 'Shape', get: () => q.shape, set: (v) => (q.shape = v), options: [['square', 'Square, side a'], ['triangle', 'Equilateral triangle, side a'], ['ellipse', 'Ellipse, half-axes a and b'], ['circle', 'Circle, diameter a']] });
      num(sec, q, 'a', q.shape === 'ellipse' ? 'Larger half-axis a' : q.shape === 'circle' ? 'Diameter a' : 'Side a', u.S);
      if (q.shape === 'ellipse') num(sec, q, 'b', 'Smaller half-axis b', u.S);
      num(sec, q, 'L', 'Length L', u.L);
      matSel(sec, q, 'mat', 'G');
      num(sec, q, 'G', 'Shear modulus G', u.MOD);
      sec = C.section(c, 'Find');
      C.seg(sec, { get: () => q.task, set: (v) => (q.task = v), options: [['allow', 'Largest torque'], ['check', 'Stress and twist for a torque']] });
      if (q.task === 'check') num(sec, q, 'T', 'Torque T', TQ);
      else { num(sec, q, 'tA', 'Allowable shear stress (0 = no limit)', u.ST); num(sec, q, 'phiA', 'Allowable angle of twist (0 = no limit)', 'rad'); }
      if (q.shape !== 'circle') C.toggle(sec, { label: 'Compare with a round shaft of the same area', get: () => !!q.cmp, set: (v) => (q.cmp = v) });
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Show the twist (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    if (st.mode === 'shaft') C.toggle(c, { label: 'Show the torque and angle-of-twist diagrams', get: () => st.diag !== false, set: (v) => (st.diag = v) });
  };

  M.compute = (U) => Torsion.solve(S(), U);
  M.onUnits = (from, to) => Torsion.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ shaft: 'Shaft, internal torque and angle of twist', power: 'Shaft and the shear stress on its section', composite: 'Shaft and the shear stress along a radius', noncirc: 'Cross-section' }[mode()]);
  M.cap3D = () => '3D view';
  M.hint = () => ({
    shaft: 'Each torque is drawn as a curved arrow; by the right-hand rule a positive torque points away from A. The lines on the surface start straight and twist into helixes: press Play to watch (exaggerated).',
    power: 'The shear stress grows in a straight line from zero at the centre to τ_max at the surface. Give a length and G to see the twist.',
    composite: 'Strain is continuous across the bond but G is not, so the shear stress jumps at the bond. Press Play to watch the shaft twist.',
    noncirc: 'The largest shear stress is on the edge at the point closest to the axis; the corners carry none. The dashed outline is the far end turned by the angle of twist (exaggerated).',
  }[mode()]);
  M.legend = () => ({
    shaft: [[TCOL, 'Applied torques'], [RCOL, 'Reactions'], [COL.axial, 'Internal torque T', 'sq'], [DCOL, 'Angle of twist', 'ln']],
    power: [[TCOL, 'Torque'], [SC, 'Shear stress', 'sq']],
    composite: [[TCOL, 'Torque'], [SC, 'Shear stress', 'sq']],
    noncirc: [[SC, 'Largest shear stress'], [DCOL, 'Far end, turned', 'ln']],
  }[mode()]);
  const deflect = root.Anim.deflection(S);
  M.anim = () => (twistOn() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* 2D helpers                                                         */
  /* ------------------------------------------------------------------ */
  const val = (opt, a, b) => (opt.showP ? a : b);
  const hatchBox = (D, x0, y0, x1, y1) => D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: 'url(#hatch)', stroke: COL.support, sw: 1 });
  /** Curved torque arrow round the shaft at x, seen from the front: a positive torque (vector to the right) runs down the front face. */
  function curl(D, x, R, sense, color, label, anchor) {
    const rx = Math.max(0.16, R * 0.3), pts = [];
    for (let i = 0; i <= 24; i++) { const t = (Math.PI / 2) * (1 - (2 * i) / 24); pts.push([x + rx * Math.cos(t), R * Math.sin(t)]); }
    if (sense < 0) pts.reverse();
    D.pline(pts.slice(0, 22), { stroke: color, sw: 2.6 });
    D.arrow(pts[20], pts[24], { color, w: 2.6, head: 11 });
    if (label) D.text([x, R], label, { anchor: anchor || 'middle', dy: -8, size: 12, color, weight: 700 });
  }
  /** Lines along the surface of a shaft that twist with φ(x) (rad, exaggerated already); only the front half shows. */
  function surfLines(D, x0, x1, r, ph, n) {
    for (let j = 0; j < n; j++) {
      const th = (j / n) * 2 * Math.PI + 0.3;
      let cur = [];
      for (let i = 0; i <= 40; i++) {
        const x = x0 + ((x1 - x0) * i) / 40, a = th + ph(x);
        if (Math.sin(a) > 0.02) cur.push([x, r * Math.cos(a)]);
        else if (cur.length) { if (cur.length > 1) D.pline(cur, { stroke: LINE, sw: 1.3 }); cur = []; }
      }
      if (cur.length > 1) D.pline(cur, { stroke: LINE, sw: 1.3 });
    }
  }

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'shaft') return drawShaft(svg, g, opt);
    if (g.kind === 'power') return drawPower(svg, g, opt);
    if (g.kind === 'composite') return drawComposite(svg, g, opt);
    return drawNoncirc(svg, g, opt);
  };

  function shaftGeo(g) {
    const Ls = 10, sc = Ls / g.Lsum, dmax = Math.max(...g.sg.map((t) => t.c));
    const xs = [0]; g.sg.forEach((t) => xs.push(xs[xs.length - 1] + t.L * sc));
    const rr = g.sg.map((t) => 0.35 + 0.6 * (t.c / dmax)), ri = g.sg.map((t, i) => (t.ci ? rr[i] * (t.ci / t.c) : 0));
    const pm = Math.max(...g.phi.map(Math.abs)), amp = pm > 0 ? TWMAX / pm : 0;
    const phAt = (x) => { for (let i = 0; i < g.sg.length; i++) if (x <= xs[i + 1] + 1e-9) { const t = (x - xs[i]) / (xs[i + 1] - xs[i] || 1); return g.phi[i] + (g.phi[i + 1] - g.phi[i]) * t; } return g.phi[g.phi.length - 1]; };
    return { Ls, xs, rr, ri, amp, phAt };
  }
  function drawShaft(svg, g, opt) {
    const u = g.u, TQ = u.TQ, n = g.sg.length, diag = S().diag !== false;
    const H = svg.clientHeight || 560, padB = diag ? Math.max(200, H * 0.5) : 0;
    const G = shaftGeo(g), { Ls, xs, rr, ri } = G, rm = Math.max(...rr), k = twistOn() ? kD() : 0;
    const D = UI.Draw2D(svg, { xmin: -3.4, xmax: Ls + (g.fixed ? 3.4 : 2.6), ymin: -rm - 1.5, ymax: rm + 1.6 }, { padB, pad: 40 });
    hatchBox(D, -0.45, -rm - 0.6, 0, rm + 0.6);
    D.text([0, -rm], 'A', { anchor: 'middle', dy: 30, size: 12.5, weight: 700 });
    if (g.fixed) hatchBox(D, Ls, -rm - 0.6, Ls + 0.45, rm + 0.6);
    g.sg.forEach((t, i) => {
      D.poly([[xs[i], -rr[i]], [xs[i + 1], -rr[i]], [xs[i + 1], rr[i]], [xs[i], rr[i]]], { fill: SHAFT, fop: 0.9, stroke: EDGE, sw: 1.5 });
      if (ri[i]) [ri[i], -ri[i]].forEach((y) => D.line([xs[i], y], [xs[i + 1], y], { stroke: EDGE, sw: 1, dash: '5 4' }));
      surfLines(D, xs[i], xs[i + 1], rr[i], (x) => G.phAt(x) * G.amp * k, 8);
      if (opt.showP && !diag && xs[i + 1] - xs[i] > 2.6) D.text([(xs[i] + xs[i + 1]) / 2, -rr[i]], `τ_max = ${fmt(MD.fromBase(t.tau, u.ST))} ${u.ST}`, { anchor: 'middle', dy: 15, size: 11, color: SC });
    });
    for (let i = 1; i <= n; i++) D.text([xs[i], -Math.max(rr[i - 1], rr[i] || 0)], LET[i], { anchor: 'middle', dy: 30, size: 12.5, weight: 700 });
    g.sg.forEach((t, i) => D.dim([xs[i], -rm - 1.15], [xs[i + 1], -rm - 1.15], `${fmt(+t.q.L)} ${u.L}`, 0));
    g.sg.forEach((t, i) => { if (!t.T) return; const R = Math.max(rr[i], rr[i + 1] || 0) + 0.18; curl(D, xs[i + 1], R, Math.sign(t.T), TCOL, val(opt, `${fmt(Math.abs(MD.fromBase(t.T, TQ)))} ${TQ}`, `T${LET[i + 1]}`)); });
    // reactions: drawn as vectors toward A (−x); a negative value turns the other way
    const rxn = (x, Tr, lab, right) => { if (Math.abs(Tr) < 1e-12) return; const R = rm + 0.25; curl(D, right ? x + 0.6 : x - 0.85, R, -Math.sign(Tr), RCOL, val(opt, `${lab} = ${fmt(Math.abs(MD.fromBase(Tr, TQ)))} ${TQ}`, lab), right ? 'start' : 'end'); };
    rxn(-0.45, g.TA, 'T_A', false);
    if (g.fixed) rxn(Ls + 0.45, g.TB, `T_${LET[n]}`, true);
    if (!diag) return;
    const x0 = D.X(0), w = D.X(Ls) - x0, top = H - padB + 18, ph = (padB - 18 - 34 - 14) / 2;
    const Lu = MD.fromBase(g.Lsum, u.L), xt = xs.map((x) => (x / Ls) * Lu);
    const Tv = g.sg.map((t) => MD.fromBase(t.Ti, TQ)), lo = Math.min(0, ...Tv), hi = Math.max(0, ...Tv);
    const F1 = Charts.frame(svg, { x: x0, y: top, w, h: ph, xmin: 0, xmax: Lu, ymin: lo, ymax: hi, ylabel: `T (${TQ})`, ycolor: COL.axial, yside: 46, xticks: false, padY: 0.25 });
    g.sg.forEach((t, i) => {
      Charts.curve(F1, [[xt[i], 0], [xt[i], Tv[i]], [xt[i + 1], Tv[i]], [xt[i + 1], 0]], { color: COL.axial, fill: COL.axial, fop: 0.22, width: 2 });
      if (opt.showP) T(F1.g, F1.X((xt[i] + xt[i + 1]) / 2), F1.Y(Tv[i]) + (Tv[i] >= 0 ? -5 : 14), fmt(Tv[i]) + (F1.X(xt[i + 1]) - F1.X(xt[i]) > 120 ? `  (τ_max = ${fmt(MD.fromBase(t.tau, u.ST))} ${u.ST})` : ''), { anchor: 'middle', color: COL.axial, size: 11 });
    });
    const pmx = Math.max(...g.phi.map(Math.abs)), ps = pmx > 0 && pmx < 0.01 ? 1e3 : 1, pv = g.phi.map((p) => p * ps), plo = Math.min(0, ...pv), phi2 = Math.max(0, ...pv), kk = k || 1;
    const F2 = Charts.frame(svg, { x: x0, y: top + ph + 14, w, h: ph, xmin: 0, xmax: Lu, ymin: plo, ymax: phi2, ylabel: ps > 1 ? 'φ (10⁻³ rad)' : 'φ (rad)', ycolor: DCOL, yside: 46, xticks: xt, padY: 0.25, xlabel: `x (${u.L})` });
    Charts.curve(F2, xt.map((x, i) => [x, pv[i] * kk]), { color: DCOL, width: 3 });
    if (opt.showP) xt.forEach((x, i) => { if (i && Math.abs(pv[i]) > 1e-15) Charts.mark(F2, x, pv[i] * kk, fmt(pv[i]), { color: DCOL, anchor: i === n ? 'end' : 'middle', dx: i === n ? -6 : 0, dy: pv[i] >= 0 ? -8 : 16 }); });
  }

  /** Cross-section at (cx, 0) with the shear stress drawn along the vertical radius; parts = [{r0, r1, t0, t1, col}] in world units. */
  function sectionStress(D, cx, R, parts, tmax, opt, labels) {
    parts.slice().reverse().forEach((p) => D.circle([cx, 0], p.r1, { fill: p.col, fop: 0.9, stroke: EDGE, sw: 1.4 }));
    parts.forEach((p) => { if (p.r0 > 0 && p.hole) D.circle([cx, 0], p.r0, { fill: '#ffffff', stroke: EDGE, sw: 1.2 }); });
    const sc = (R * 1.6) / (tmax || 1);
    parts.forEach((p) => {
      if (p.hole) return;
      const a = [cx, p.r0], b = [cx + p.t0 * sc, p.r0], c = [cx + p.t1 * sc, p.r1], d = [cx, p.r1];
      D.poly([a, b, c, d], { fill: SC, fop: 0.2, stroke: SC, sw: 1.8 });
      for (let i = 1; i <= 4; i++) { const f = i / 4, y = p.r0 + (p.r1 - p.r0) * f, tx = p.t0 + (p.t1 - p.t0) * f; if (tx * sc > 0.18) D.arrow([cx, y], [cx + tx * sc, y], { color: SC, w: 1.3, head: 7 }); }
    });
    D.line([cx, 0], [cx, R], { stroke: COL.dim, sw: 1 });
    (labels || []).forEach(([y, t, an]) => D.text(an === 'end' ? [cx, y] : [cx + t * sc, y], val(opt, `${fmt(t)}`, ''), { anchor: an || 'start', dx: an === 'end' ? -6 : 6, dy: 4, size: 11.5, color: SC, weight: 700 }));
  }
  function drawPower(svg, g, opt) {
    const u = g.u, TQ = u.TQ, k = twistOn() ? kD() : 0, ri = g.di ? (g.di / g.d) * 1 : 0;
    const D = UI.Draw2D(svg, { xmin: -3.6, xmax: 13.6, ymin: -2.8, ymax: 2.8 });
    D.poly([[-3.2, -1.5], [-0.8, -1.5], [-0.8, 1.5], [-3.2, 1.5]], { fill: '#cbd5dc', stroke: EDGE, sw: 1.5 });
    D.text([-2, 0], 'motor', { anchor: 'middle', dy: 4, size: 12, color: COL.ink, weight: 700 });
    const r = 0.7, x1 = 7;
    D.poly([[-0.8, -r], [x1, -r], [x1, r], [-0.8, r]], { fill: SHAFT, fop: 0.9, stroke: EDGE, sw: 1.5 });
    if (ri) [r * ri, -r * ri].forEach((y) => D.line([-0.8, y], [x1, y], { stroke: EDGE, sw: 1, dash: '5 4' }));
    surfLines(D, -0.8, x1, r, (x) => (g.ph ? TWMAX * k * ((x + 0.8) / (x1 + 0.8)) * Math.sign(g.ph) : 0), 8);
    curl(D, x1 - 0.5, r + 0.2, 1, TCOL, val(opt, `T = ${fmt(MD.fromBase(g.T, TQ))} ${TQ}`, 'T'));
    D.text([3, -r], val(opt, `ω = ${fmt(g.w)} rad/s, P = ${fmt(+g.q.P)} ${u.PW}`, 'ω'), { anchor: 'middle', dy: 18, size: 12, color: COL.ink });
    if (g.ph && opt.showP) D.text([3, -r], `φ = ${fmt(g.ph)} rad over ${fmt(+g.q.L)} ${u.L}`, { anchor: 'middle', dy: 34, size: 11.5, color: DCOL });
    const cx = 10.2, R = 1.8, tm = MD.fromBase(g.tau, u.ST), tin = ri ? tm * ri : 0;
    D.text([cx, R], 'Section', { anchor: 'middle', dy: -10, size: 12, color: COL.dim });
    sectionStress(D, cx, R, ri ? [{ r0: 0, r1: R * ri, hole: true, col: '#fff' }, { r0: R * ri, r1: R, t0: tin, t1: tm, col: SHAFT }] : [{ r0: 0, r1: R, t0: 0, t1: tm, col: SHAFT }], tm, opt, [[R, tm]].concat(ri ? [[R * ri, tin]] : []));
    D.text([cx, -R], `${g.di ? 'd_o' : 'd'} = ${fmt(MD.fromBase(g.d, u.S))} ${u.S}${g.di ? `, d_i = ${fmt(MD.fromBase(g.di, u.S))}` : ''}`, { anchor: 'middle', dy: 18, size: 11.5, color: COL.dim });
    D.text([cx + 1.2, 0], `τ (${u.ST})`, { anchor: 'start', dx: 20, dy: -2, size: 11, color: SC });
  }
  function drawComposite(svg, g, opt) {
    const u = g.u, TQ = u.TQ, k = twistOn() ? kD() : 0, f = g.ci / g.co;
    const D = UI.Draw2D(svg, { xmin: -1.4, xmax: 14.2, ymin: -2.8, ymax: 2.8 });
    const r = 0.9, x1 = 7.4;
    hatchBox(D, -0.45, -1.5, 0, 1.5);
    D.poly([[0, -r], [x1, -r], [x1, r], [0, r]], { fill: SHAFT, fop: 0.9, stroke: EDGE, sw: 1.5 });
    [r * f, -r * f].forEach((y) => D.line([0, y], [x1, y], { stroke: EDGE, sw: 1, dash: '5 4' }));
    D.poly([[x1, -r * f], [x1 + 0.08, -r * f], [x1 + 0.08, r * f], [x1, r * f]], { fill: CORE, stroke: EDGE, sw: 1 });
    surfLines(D, 0, x1, r, (x) => TWMAX * k * (x / x1) * Math.sign(g.ph), 8);
    curl(D, x1 + 0.3, r + 0.2, Math.sign(g.T), TCOL, val(opt, `T = ${fmt(Math.abs(MD.fromBase(g.T, TQ)))} ${TQ}`, 'T'));
    D.dim([0, -r - 0.9], [x1, -r - 0.9], `L = ${fmt(+g.q.L)} ${u.L}`, 0);
    if (opt.showP) D.text([x1 / 2, r], `T_tube = ${fmt(MD.fromBase(g.Tt, TQ))}, T_core = ${fmt(MD.fromBase(g.Tc, TQ))} ${TQ}`, { anchor: 'middle', dy: -10, size: 11.5, color: RCOL });
    const cx = 10.6, R = 2, ts = (v) => MD.fromBase(v, u.ST);
    D.text([cx, R], 'Section', { anchor: 'middle', dy: -10, size: 12, color: COL.dim });
    sectionStress(D, cx, R, [{ r0: 0, r1: R * f, t0: 0, t1: ts(g.tc), col: CORE }, { r0: R * f, r1: R, t0: ts(g.tmin), t1: ts(g.tmax), col: SHAFT }], ts(g.tmax), opt, [[R, ts(g.tmax)], [R * f, ts(g.tmin)], [R * f - 0.001, ts(g.tc), 'end']]);
    D.text([cx, -R], 'core', { anchor: 'middle', dy: 18, size: 11, color: '#8a6a2f' });
  }
  function ncPoly(sh, a, b, n) {
    if (sh === 'square') return [[-a / 2, -a / 2], [a / 2, -a / 2], [a / 2, a / 2], [-a / 2, a / 2]];
    if (sh === 'triangle') { const h = (Math.sqrt(3) / 2) * a; return [[-a / 2, -h / 3], [a / 2, -h / 3], [0, (2 * h) / 3]]; }
    const m = n || 48, A = sh === 'circle' ? a / 2 : a, Bb = sh === 'circle' ? a / 2 : b;
    return Array.from({ length: m }, (_, i) => { const t = (i / m) * 2 * Math.PI; return [A * Math.cos(t), Bb * Math.sin(t)]; });
  }
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  function drawNoncirc(svg, g, opt) {
    const u = g.u, TQ = u.TQ, k = twistOn() ? kD() : 0, q = g.q, sh = g.sh;
    const a = +q.a, b = +q.b || a, size = sh === 'ellipse' ? 2 * a : a, sc = 4 / size;
    const P = ncPoly(sh, a * sc, b * sc).map((p) => [p[0], p[1]]);
    const cmp = g.cmp && sh !== 'circle';
    const D = UI.Draw2D(svg, { xmin: -3.6, xmax: cmp ? 9.4 : 3.6, ymin: -3.4, ymax: 3.4 });
    D.poly(P, { fill: SHAFT, fop: 0.9, stroke: EDGE, sw: 1.6 });
    if (k > 0) D.poly(P.map((p) => rot(p, TWMAX * 0.5 * k * Math.sign(g.ph || 1))), { stroke: DCOL, sw: 1.6, dash: '6 4' });
    D.circle([0, 0], 0.06, { fill: EDGE });
    // the point of largest stress: on the edge, closest to the axis
    const pk = sh === 'square' ? [a * sc / 2, 0] : sh === 'triangle' ? [0, -(Math.sqrt(3) / 2) * a * sc / 3] : sh === 'ellipse' ? [0, b * sc] : [a * sc / 2, 0];
    D.circle(pk, 0.11, { fill: SC, stroke: '#fff', sw: 1.2 });
    D.text(pk, val(opt, `τ_max = ${fmt(MD.fromBase(g.tau, u.ST))} ${u.ST}`, 'τ_max'), { anchor: sh === 'square' || sh === 'circle' ? 'start' : 'middle', dx: sh === 'square' || sh === 'circle' ? 10 : 0, dy: sh === 'triangle' ? 18 : sh === 'ellipse' ? -10 : 4, size: 12, color: SC, weight: 700 });
    if (sh === 'square' || sh === 'triangle') { const p0 = P[0], p1 = P[1]; D.dim(p0, p1, `a = ${fmt(a)} ${u.S}`, sh === 'triangle' ? -44 : -26); }
    else if (sh === 'ellipse') { D.dim([0, 0], [a * sc, 0], `a = ${fmt(a)}`, -14); D.dim([0, 0], [0, -b * sc], `b = ${fmt(b)}`, 14); }
    else D.dim([-a * sc / 2, 0], [a * sc / 2, 0], `a = ${fmt(a)} ${u.S}`, -14);
    D.text([0, -3.2], val(opt, `T = ${fmt(MD.fromBase(g.T, TQ))} ${TQ}, φ = ${fmt(g.ph)} rad`, ''), { anchor: 'middle', size: 12, color: COL.ink });
    if (cmp) {
      const c = MD.fromBase(g.cmp.c, u.S) * sc;
      D.circle([6.4, 0], c, { fill: '#dfe5e9', stroke: EDGE, sw: 1.4, dash: '6 4' });
      D.text([6.4, c], 'round shaft, same area', { anchor: 'middle', dy: -10, size: 12, color: COL.dim });
      D.text([6.4, -c], val(opt, g.cmp.T !== undefined ? `T = ${fmt(MD.fromBase(g.cmp.T, TQ))} ${TQ}` : `τ_max = ${fmt(MD.fromBase(g.cmp.tau, u.ST))} ${u.ST}`, ''), { anchor: 'middle', dy: 18, size: 12, color: COL.ink });
      D.text([6.4, -c], val(opt, `d = ${fmt(2 * MD.fromBase(g.cmp.c, u.S))} ${u.S}`, ''), { anchor: 'middle', dy: 34, size: 11.5, color: COL.dim });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  const stripe = (base) => (j, i) => (i % 4 === 0 ? '#41505c' : base);
  /** Curved torque arrow round the x axis at x, as thin faces so the shaft hides the part behind it. */
  function curl3(v, x, R, sense, color) {
    const n = 22, a0 = -0.6, a1 = Math.PI * 1.45, P = (a, r) => [x, r * Math.cos(a), r * Math.sin(a)], w = 0.045 * R + 0.03;
    const ang = (i) => a0 + ((a1 - a0) * i) / n;
    for (let i = 0; i < n - 2; i++) {
      const p = ang(i), q = ang(i + 1);
      v.face([[x - w, ...P(p, R).slice(1)], [x + w, ...P(p, R).slice(1)], [x + w, ...P(q, R).slice(1)], [x - w, ...P(q, R).slice(1)]], color, 1, null, 1, 0, null);
    }
    const tip = sense > 0 ? n : 0, from = sense > 0 ? n - 3 : 3;
    if (sense < 0) { /* the ribbon starts at the head end */ }
    const at = P(ang(tip), R), bk = P(ang(from), R), nrm = [0, Math.cos(ang(from)), Math.sin(ang(from))];
    const hw = 0.18 * R + 0.08;
    v.face([at, [bk[0], bk[1] + nrm[1] * hw * 0.6, bk[2] + nrm[2] * hw * 0.6], [bk[0], bk[1] - nrm[1] * hw * 0.6, bk[2] - nrm[2] * hw * 0.6]], color, 1, null, 1, 0, null);
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u, TQ = u.TQ, k = twistOn() ? kD() : 0;
    v._hs = 0.4;
    if (g.kind === 'shaft') {
      const G = shaftGeo(g), { Ls, xs, rr, ri } = G, rm = Math.max(...rr);
      const wallL = (n) => (facing) => (facing(n) > 0 ? 1 : -1);
      v.box(-0.5, -rm - 0.7, -rm - 0.7, 0, rm + 0.7, rm + 0.7, '#cfd8de', 1, EDGE, { layer: wallL([-1, 0, 0]) });
      if (g.fixed) v.box(Ls, -rm - 0.7, -rm - 0.7, Ls + 0.5, rm + 0.7, rm + 0.7, '#cfd8de', 1, EDGE, { layer: wallL([1, 0, 0]) });
      g.sg.forEach((t, i) => {
        const p0 = g.phi[i] * G.amp * k, p1 = g.phi[i + 1] * G.amp * k;
        MDUI.cyl(v, [xs[i], 0, 0], [xs[i + 1], 0, 0], rr[i], SHAFT, { n: 32, nz: 10, color: stripe(SHAFT), twist: (tt) => p0 + (p1 - p0) * tt, ri: ri[i], stroke: i === g.sg.length - 1 && g.fixed ? null : EDGE });
      });
      g.sg.forEach((t, i) => { if (!t.T) return; const R = Math.max(rr[i], rr[i + 1] || 0) + 0.3; curl3(v, xs[i + 1] + (i === g.sg.length - 1 ? 0.25 : 0), R, Math.sign(t.T), TCOL); v.label([xs[i + 1], R + 0.35, 0], opt.showP ? `${fmt(Math.abs(MD.fromBase(t.T, TQ)))} ${TQ}` : `T${LET[i + 1]}`, TCOL); });
      for (let i = 0; i <= g.sg.length; i++) v.label([xs[i], -(rr[Math.min(i, rr.length - 1)]) - 0.6, 0], LET[i], COL.ink);
      v.autoBounds(); return;
    }
    if (g.kind === 'power') {
      const r = 0.7, x1 = 7, f = g.di ? g.di / g.d : 0, tw = g.ph ? TWMAX * k * Math.sign(g.ph) : 0;
      v.box(-3.2, -1.5, -1.5, -0.8, 1.5, 1.5, '#8597a6', 1, EDGE);
      MDUI.cyl(v, [-0.8, 0, 0], [x1, 0, 0], r, SHAFT, { n: 32, nz: 12, color: stripe(SHAFT), twist: (t) => tw * t, ri: f ? r * f : 0, stroke: EDGE });
      curl3(v, x1 - 0.5, r + 0.3, 1, TCOL);
      v.label([x1 - 0.5, r + 0.7, 0], opt.showP ? `T = ${fmt(MD.fromBase(g.T, TQ))} ${TQ}` : 'T', TCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'composite') {
      const r = 0.9, x1 = 7.4, f = g.ci / g.co, tw = TWMAX * k * Math.sign(g.ph);
      v.box(-0.5, -1.6, -1.6, 0, 1.6, 1.6, '#cfd8de', 1, EDGE, { layer: (facing) => (facing([-1, 0, 0]) > 0 ? 1 : -1) });
      MDUI.cyl(v, [0, 0, 0], [x1, 0, 0], r, SHAFT, { n: 32, nz: 12, color: stripe(SHAFT), twist: (t) => tw * t, ri: r * f, inner: CORE, stroke: EDGE });
      MDUI.cyl(v, [0, 0, 0], [x1 + 0.02, 0, 0], r * f - 0.005, CORE, { n: 24, nz: 1, twist: (t) => tw * t, stroke: EDGE });
      curl3(v, x1 + 0.4, r + 0.3, Math.sign(g.T), TCOL);
      v.label([x1 + 0.4, r + 0.7, 0], opt.showP ? `T = ${fmt(Math.abs(MD.fromBase(g.T, TQ)))} ${TQ}` : 'T', TCOL);
      v.autoBounds(); return;
    }
    // noncircular: a twisted prism
    const q = g.q, sh = g.sh, a = +q.a, b = +q.b || a, size = sh === 'ellipse' ? 2 * a : a, sc = 2.2 / size, Lw = 8, nz = 14;
    const P = ncPoly(sh, a * sc, b * sc, 36), tw = TWMAX * k * Math.sign(g.ph || 1);
    // subdivide the straight sides so the faces can carry a stripe down the middle of each side
    const pts = [], col = [];
    P.forEach((p, i) => { const qn = P[(i + 1) % P.length], m = sh === 'square' || sh === 'triangle' ? 6 : 1; for (let j = 0; j < m; j++) { pts.push([p[0] + ((qn[0] - p[0]) * j) / m, p[1] + ((qn[1] - p[1]) * j) / m]); col.push(m > 1 ? (j === 2 || j === 3 ? '#41505c' : SHAFT) : (i % 6 === 0 ? '#41505c' : SHAFT)); } });
    const at = (t, p) => { const r2 = rot(p, tw * t); return [t * Lw, r2[1], r2[0]]; };
    for (let j = 0; j < nz; j++) {
      const t0 = j / nz, t1 = (j + 1) / nz;
      pts.forEach((p, i) => {
        const p2 = pts[(i + 1) % pts.length], mid = rot([(p[0] + p2[0]) / 2, (p[1] + p2[1]) / 2], tw * (t0 + t1) / 2), en = [p2[1] - p[1], -(p2[0] - p[0])], er = rot(en, tw * (t0 + t1) / 2), l = Math.hypot(...er) || 1;
        void mid;
        v.face([at(t0, p), at(t0, p2), at(t1, p2), at(t1, p)], col[i], 1, 'fill', 1, 0, [0, er[1] / l, er[0] / l]);
      });
    }
    [[0, -1], [1, 1]].forEach(([t, s]) => v.face(pts.map((p) => at(t, p)), SHAFT, 1, EDGE, 1, 0, [s, 0, 0]));
    v.box(-0.5, -1.8, -1.8, 0, 1.8, 1.8, '#cfd8de', 1, EDGE, { layer: (facing) => (facing([-1, 0, 0]) > 0 ? 1 : -1) });
    curl3(v, Lw + 0.4, 1.5, Math.sign(g.T || 1), TCOL);
    v.label([Lw + 0.4, 1.9, 0], opt.showP ? `T = ${fmt(MD.fromBase(g.T, TQ))} ${TQ}` : 'T', TCOL);
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const sg = (L, d, T, o) => Object.assign({ L, shape: 'circle', d, di: 0, mat: 'a36', G: 75, T }, o || {});
  const sh = (tu, o) => ({ mode: 'shaft', tu, sh: o });
  M.presets = [
    { name: 'Test: Book Example 10.5, steel shaft with four torques (φ_A/D = 7.22(10⁻³) rad, φ_A/C = 8.49(10⁻³) rad)', units: 'SI', state: sh('kN·m', { right: 'free', segs: [sg(3, 200, 150), sg(2, 200, -60), sg(1.5, 200, -10)] }),
      expect: [{ k: 'Angle of twist of D relative to A', v: 7.22e-3 }, { k: 'Angle of twist of C relative to A', v: 8.49e-3 }, { k: 'Internal torque T_AB', v: 80 }, { k: 'Internal torque T_BC', v: -70 }] },
    { name: 'Test: Book Example 10.6, gear A on a 14 mm shaft turns 0.212 rad', units: 'SI', state: sh('N·m', { right: 'free', segs: [sg(0.5, 14, -40, { mat: 'custom', G: 80 }), sg(0.3, 14, -280, { mat: 'custom', G: 80 }), sg(0.4, 14, 150, { mat: 'custom', G: 80 })] }),
      expect: [{ k: 'Angle of twist of D relative to A', v: -0.2121 }] },
    { name: 'Test: Book Example 10.2, 1.5 in. shaft carrying 12.5 kip·in. (τ_max = 18.9 ksi)', units: 'US', state: sh('kip·in.', { right: 'free', segs: [sg(3, 1.5, 12.5, { G: 11000 })] }),
      expect: [{ k: 'Maximum shear stress in AB', v: 18.86 }] },
    { name: 'Test: Book Example 10.3, pipe tightened with 40 N·m (τ_o = 345 kPa)', units: 'SI', state: sh('N·m', { right: 'free', segs: [sg(0.5, 100, 40, { shape: 'tube', di: 80 })] }),
      expect: [{ k: 'Maximum shear stress in AB', v: 0.345 }] },
    { name: 'Test: Book Example 10.8, shaft fixed at both ends (reactions 645 N·m and 345 N·m)', units: 'SI', state: sh('N·m', { right: 'fixed', segs: [sg(0.2, 20, -800), sg(1.5, 20, 500), sg(0.3, 20, 0)] }),
      expect: [{ k: 'Reaction torque at A, T_A', v: -645 }, { k: 'Reaction torque at D, T_D', v: 345 }] },
    { name: 'Test: Book Section 10.5, 500 N·m between two fixed ends (200 N·m and 300 N·m)', units: 'SI', state: sh('N·m', { right: 'fixed', segs: [sg(3, 40, 500), sg(2, 40, 0)] }),
      expect: [{ k: 'Reaction torque at A, T_A', v: 200 }, { k: 'Reaction torque at C, T_C', v: 300 }] },
    { name: 'Test: Book Example 10.4, 5 hp at 175 rev/min (d = 0.858 in., use 7/8 in.)', units: 'US', state: { mode: 'power', tu: 'lb·ft', pw: { P: 5, spd: 175, spdU: 'rpm', task: 'size', shape: 'circle', d: 1, di: 0.5, tA: 14.5, step: 0.125, L: 0, mat: 'a36', G: 11000 } },
      expect: [{ k: 'Required diameter d', v: 0.8584 }, { k: 'Size to use (rounded up)', v: 0.875 }, { k: 'Torque T', v: 150.1 }] },
    { name: 'Tube driven by a 90 kW motor at 1750 rev/min', units: 'SI', state: { mode: 'power', tu: 'kN·m', pw: { P: 90, spd: 1750, spdU: 'rpm', task: 'check', shape: 'tube', d: 50, di: 40, tA: 50, step: 5, L: 1.5, mat: 'a36', G: 75 } } },
    { name: 'Test: Book Example 10.9, steel tube on a brass core under 250 lb·ft (τ = 451, 989, 1977 psi)', units: 'US', state: { mode: 'composite', tu: 'lb·in.', cp: { T: 3000, L: 4, d: 2, di: 1, mat: 'custom', G: 11400, matC: 'custom', Gc: 5200 } },
      expect: [{ k: 'Torque in the tube', v: 2911.5 }, { k: 'Torque in the core', v: 88.54 }, { k: 'Largest shear stress in the core', v: 0.451 }, { k: 'Largest shear stress in the tube', v: 1.977 }] },
    { name: 'Test: Book Example 10.10, triangular aluminium shaft (T = 170 lb·in.; round shaft 233 lb·in.)', units: 'US', state: { mode: 'noncirc', tu: 'lb·in.', nc: { shape: 'triangle', a: 1.5, b: 1, L: 4, mat: 'custom', G: 3700, task: 'allow', T: 100, tA: 8, phiA: 0.02, cmp: true } },
      expect: [{ k: 'Torque allowed by the shear stress', v: 1350 }, { k: 'Largest torque T', v: 169.7 }, { k: 'Largest torque on a round shaft of the same area', v: 232.9 }] },
    { name: 'Square steel bar twisted by 0.5 kN·m', units: 'SI', state: { mode: 'noncirc', tu: 'kN·m', nc: { shape: 'square', a: 40, b: 20, L: 1.2, mat: 'a36', G: 75, task: 'check', T: 0.5, tA: 55, phiA: 0.02, cmp: true } } },
    { name: 'Edge: a tube whose bore is wider than the tube (fails on purpose)', units: 'SI', fails: true, state: sh('kN·m', { right: 'free', segs: [sg(1, 50, 2, { shape: 'tube', di: 60 })] }) },
  ];

  root.MTorsion = M;
})(window);
