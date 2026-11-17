/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M5 Beam Deflection
 * (inputs, diagrams, presets). Physics: md/deflect.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Deflect, BeamStress, MD, MDUI } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const T = Charts.text, svgEl = UI.svgEl;
  const LCOL = COL.load, RCOL = COL.react, DCOL = '#0f8a7e', EDGE = '#4a5661', BODY = '#b9c2cb', SLOPE = '#8e6c1f', ACC = COL.accent;

  const M = { id: 'deflect', title: 'Beam Deflection', defaults: Deflect.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const on = () => S().defl !== false;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], sys = M.units, fu = Deflect.FU[sys].includes(st.fu) ? st.fu : Deflect.FU[sys][0], u = MD.units(U, fu), b = st.bm;
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Method', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [['curve', 'Integration (elastic curve)'], ['super', 'Superposition of standard cases'], ['indet', 'Indeterminate beam (redundants)']] });
    C.seg(sec, { label: 'Force unit', get: () => fu, set: (v) => (st.fu = v), options: Deflect.FU[sys].map((f) => [f, f]) });
    sec = C.section(c, 'Stiffness EI');
    C.seg(sec, { label: 'EI is', get: () => st.ei, set: (v) => (st.ei = v), options: [['num', 'Given (E and I)'], ['unit', 'Left as EI']] });
    if (st.ei === 'num') {
      MDUI.material(C, sec, st, sys, { E: 'E' });
      num(sec, st, 'E', 'Modulus of elasticity E', u.MOD);
      C.seg(sec, { label: 'I from', get: () => st.Isrc, set: (v) => (st.Isrc = v), options: [['typed', 'Typed in'], ['W', 'W table']] });
      if (st.Isrc === 'W') C.select(sec, { label: 'W shape (bending about x)', get: () => st.W, set: (v) => (st.W = v), options: BeamStress.WT.map((w) => [w.name, `${w.name}, I = ${fmt(w.Ix)} in⁴`]) });
      else num(sec, st, 'I', 'Moment of inertia I', u.I);
    } else C.note(sec, 'Slopes and deflections are given as a number over EI, as in the book when EI is "constant".');
    sec = C.section(c, 'Beam');
    num(sec, b, 'L', 'Length L', u.L);
    C.list(sec, {
      items: b.sups, max: 4, min: 1, color: () => '#d9efe2', title: (it, i) => `Support ${'ABCD'[i] || i + 1}: ${{ pin: 'Pin', roller: 'Roller', fixed: 'Fixed' }[it.type]}`,
      fields: () => [{ key: 'type', label: 'Type', options: [['pin', 'Pin'], ['roller', 'Roller'], ['fixed', 'Fixed']] }, { key: 'x', label: 'At x', unit: u.L }],
      add: [['Support', () => ({ type: 'roller', x: b.L })]],
    });
    C.note(sec, 'Supports are lettered A, B, C… from the left.');
    sec = C.section(c, 'Loads');
    C.list(sec, {
      items: b.loads, max: 6, min: 1, color: () => '#f6dcd6', title: (it, i) => `Load ${i + 1}: ${{ point: 'Force (down)', dist: 'Distributed load (down)', couple: 'Couple' }[it.kind]}`,
      fields: (it) => it.kind === 'point' ? [{ key: 'x', label: 'At x', unit: u.L }, { key: 'P', label: 'Force P', unit: u.F }]
        : it.kind === 'couple' ? [{ key: 'x', label: 'At x', unit: u.L }, { key: 'M', label: 'Couple M', unit: u.FL }, { key: 'dir', label: 'Turns', options: [['ccw', 'Counterclockwise'], ['cw', 'Clockwise']], wide: true }]
          : [{ key: 'x1', label: 'From x₁', unit: u.L }, { key: 'x2', label: 'To x₂', unit: u.L }, { key: 'w1', label: 'w at x₁', unit: u.W }, { key: 'w2', label: 'w at x₂', unit: u.W }],
      add: [['Force', () => ({ kind: 'point', x: b.L / 2, P: 10, x1: 0, x2: 0, w1: 0, w2: 0, M: 0, dir: 'ccw' })], ['Distributed', () => ({ kind: 'dist', x1: 0, x2: b.L, w1: 5, w2: 5, x: 0, P: 0, M: 0, dir: 'ccw' })], ['Couple', () => ({ kind: 'couple', x: b.L / 2, M: 10, dir: 'ccw', x1: 0, x2: 0, w1: 0, w2: 0, P: 0 })]],
    });
    sec = C.section(c, 'Point of interest');
    num(sec, st, 'at', 'Find θ and v at x', u.L);
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Show the deflected shape (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    C.toggle(c, { label: 'Show the V and M diagrams', get: () => st.vm !== false, set: (v) => (st.vm = v) });
    C.toggle(c, { label: 'Show the slope diagram', get: () => st.sl !== false, set: (v) => (st.sl = v) });
  };
  M.compute = (U) => Deflect.solve(S(), U);
  M.onUnits = (from, to) => Deflect.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => 'Beam, elastic curve and diagrams';
  M.cap3D = () => '3D beam';
  M.hint = () => ({
    curve: 'The elastic curve is drawn far larger than it is. The slope is zero where the deflection is largest. Press Play to watch the beam deflect.',
    super: 'Each load is solved on its own and the slopes and deflections are added. Press Play to watch the beam deflect.',
    indet: 'The redundant supports are removed, then put back with the forces that stop them moving. Press Play to watch the beam deflect.',
  }[mode()]);
  M.legend = () => [[LCOL, 'Loads'], [RCOL, 'Reactions'], [DCOL, 'Elastic curve', 'ln']].concat(S().vm !== false ? [[COL.shear, 'Shear V', 'sq'], [COL.moment, 'Moment M', 'sq']] : [], S().sl !== false ? [[SLOPE, 'Slope θ', 'ln']] : [], [[ACC, 'Point of interest', 'ln']]);
  const deflect = root.Anim.deflection(S);
  M.anim = () => (on() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  function arrowP(parent, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    svgEl('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w }, parent);
    svgEl('polygon', { points: `${x2},${y2} ${x2 - ux * hs - uy * hs * 0.42},${y2 - uy * hs + ux * hs * 0.42} ${x2 - ux * hs + uy * hs * 0.42},${y2 - uy * hs - ux * hs * 0.42}`, fill: color }, parent);
  }
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, u = g.u, L = g.L;
    const { W, H } = Charts.clear(svg);
    const defs = svgEl('defs', {}, svg), pat = svgEl('pattern', { id: 'hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svgEl('rect', { width: 8, height: 8, fill: '#d5dbe1' }, pat); svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#7f8c8d', 'stroke-width': 2 }, pat);
    const fixR = g.sups.some((s) => s.type === 'fixed' && s.x > L - 1e-9), fixL = g.sups.some((s) => s.type === 'fixed' && s.x < 1e-9);
    const ml = fixL ? 100 : 70, mr = fixR ? 100 : 36, pw = W - ml - mr, X = (x) => ml + (x / L) * pw;
    svg._inv = (sx, sy) => [((sx - ml) / pw) * L, sy];
    const vm = S().vm !== false, sl = S().sl !== false, nP = 1 + (vm ? 2 : 0) + (sl ? 1 : 0);
    const topH = Math.max(150, Math.min(H * 0.3, 210)), gap = 14, bot = 40, ph = (H - topH - bot - gap * nP) / nP;
    const grp = svgEl('g', {}, svg), yb = 10 + topH * 0.55, bt = 6;
    const k = on() ? kD() : 0, vmx = Math.abs(g.vmax.v) || 1, dp = (x) => (-g.res.v(x) / vmx) * 26 * k;
    // distributed loads
    const wmax = Math.max(1e-12, ...g.loads.filter((q) => q.kind === 'dist').map((d) => Math.max(Math.abs(d.w1), Math.abs(d.w2))));
    g.loads.forEach((d) => {
      if (d.kind !== 'dist') return;
      const hh = (w) => 6 + 24 * (Math.abs(w) / wmax), xa = X(d.x1), xb = X(d.x2), n = Math.max(2, Math.round((xb - xa) / 18)), y0 = (x) => yb - bt + dp(x);
      const top = [], bo = [];
      for (let i = 0; i <= n; i++) { const t = i / n, x = d.x1 + (d.x2 - d.x1) * t, w = d.w1 + (d.w2 - d.w1) * t; top.push(`${X(x)},${y0(x) - hh(w)}`); bo.unshift(`${X(x)},${y0(x)}`); }
      svgEl('polygon', { points: top.concat(bo).join(' '), fill: LCOL, 'fill-opacity': 0.12, stroke: LCOL, 'stroke-width': 1.2 }, grp);
      for (let i = 0; i <= n; i++) { const t = i / n, x = d.x1 + (d.x2 - d.x1) * t, w = d.w1 + (d.w2 - d.w1) * t; if (hh(w) > 8) arrowP(grp, X(x), y0(x) - hh(w), X(x), y0(x), LCOL, 1.2, 5); }
      if (opt.showP) T(grp, (xa + xb) / 2, y0((d.x1 + d.x2) / 2) - hh(Math.max(d.w1, d.w2)) - 6, d.w1 === d.w2 ? `${fmt(d.w1)} ${u.W}` : `${fmt(d.w1)} to ${fmt(d.w2)} ${u.W}`, { anchor: 'middle', color: LCOL, size: 11 });
    });
    // beam: straight outline, and the bent beam coloured by the size of the deflection
    svgEl('rect', { x: X(0), y: yb - bt, width: pw, height: 2 * bt, fill: k ? 'none' : BODY, stroke: EDGE, 'stroke-width': 1, 'stroke-dasharray': k ? '4 3' : null, opacity: k ? 0.5 : 1 }, grp);
    if (k) {
      const nb = 80;
      for (let i = 0; i < nb; i++) { const x0 = (L * i) / nb, x1 = (L * (i + 1)) / nb, c = root.Anim.contour((k * Math.abs(g.res.v((x0 + x1) / 2))) / vmx); svgEl('polygon', { points: `${X(x0)},${yb - bt + dp(x0)} ${X(x1) + 0.4},${yb - bt + dp(x1)} ${X(x1) + 0.4},${yb + bt + dp(x1)} ${X(x0)},${yb + bt + dp(x0)}`, fill: c }, grp); }
      const pts = []; for (let i = 0; i <= 160; i++) { const x = (L * i) / 160; pts.push(`${X(x).toFixed(1)},${(yb + dp(x)).toFixed(1)}`); }
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: DCOL, 'stroke-width': 1.6 }, grp);
    }
    // point forces and couples
    g.loads.forEach((q) => {
      const x = X(q.x), y = yb - bt + (q.kind === 'dist' ? 0 : dp(q.x));
      if (q.kind === 'point' && q.P) { const up = q.P < 0; arrowP(grp, x, up ? y + 2 * bt + 40 : y - 40, x, up ? y + 2 * bt : y, LCOL, 2.4, 10); if (opt.showP) T(grp, x, up ? y + 2 * bt + 52 : y - 44, `${fmt(Math.abs(q.P))} ${u.F}`, { anchor: 'middle', color: LCOL, size: 11.5, weight: 700 }); }
      if (q.kind === 'couple' && q.M) { const ccw = (q.dir === 'cw') === (q.M < 0); const cy = yb + dp(q.x); svgEl('path', { d: `M${x + 14},${cy + 8} A16,16 0 1,${ccw ? 0 : 1} ${x - 14},${cy + 8}`, fill: 'none', stroke: COL.couple, 'stroke-width': 2.2 }, grp); arrowP(grp, ccw ? x - 10 : x + 10, cy + 13, ccw ? x - 14 : x + 14, cy + 8, COL.couple, 2.2, 8); if (opt.showP) T(grp, x, cy - 22, `${fmt(Math.abs(q.M))} ${u.FL}`, { anchor: 'middle', color: COL.couple, size: 11.5, weight: 700 }); }
    });
    // supports and reactions
    g.sups.forEach((s, i) => {
      const x = X(s.x), sy = yb + bt;
      if (s.type === 'fixed') {
        const right = s.x > L / 2; svgEl('rect', { x: right ? x : x - 12, y: yb - 30, width: 12, height: 60, fill: 'url(#hatch)', stroke: COL.support, 'stroke-width': 1.2 }, grp);
        T(grp, right ? x + 6 : x - 6, yb - 36, s.label, { anchor: 'middle', size: 12.5, weight: 700 });
      } else {
        if (s.type === 'pin') svgEl('polygon', { points: `${x},${sy} ${x - 10},${sy + 16} ${x + 10},${sy + 16}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }, grp);
        else svgEl('circle', { cx: x, cy: sy + 8, r: 8, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }, grp);
        svgEl('line', { x1: x - 14, y1: sy + 16, x2: x + 14, y2: sy + 16, stroke: COL.support, 'stroke-width': 1.4 }, grp);
        T(grp, x + (s.x > L / 2 ? 14 : -14), sy + 13, s.label, { anchor: s.x > L / 2 ? 'start' : 'end', size: 12.5, weight: 700 });
      }
      const R = g.rx[i];
      if (Math.abs(R) > 1e-12) { const ya = sy + 22 + (s.type === 'fixed' ? 6 : 0); arrowP(grp, x + (s.type === 'fixed' ? (s.x > L / 2 ? 22 : -22) : 0), R > 0 ? ya + 30 : ya, x + (s.type === 'fixed' ? (s.x > L / 2 ? 22 : -22) : 0), R > 0 ? ya : ya + 30, RCOL, 2, 8); if (opt.showP) T(grp, x + (s.type === 'fixed' ? (s.x > L / 2 ? 28 : -28) : 6), ya + 26, `${fmt(Math.abs(R))} ${u.F}`, { anchor: s.type === 'fixed' && s.x < L / 2 ? 'end' : 'start', color: RCOL, size: 11, weight: 700 }); }
      if (s.type === 'fixed' && Math.abs(g.rm[i]) > 1e-12 && opt.showP) T(grp, x + (s.x > L / 2 ? 16 : -16), yb - 50, `M = ${fmt(Math.abs(g.rm[i]))} ${u.FL} ${g.rm[i] > 0 ? '↺' : '↻'}`, { anchor: s.x > L / 2 ? 'start' : 'end', color: RCOL, size: 11, weight: 700 });
    });
    // point of interest
    const xp = X(g.xP);
    svgEl('line', { x1: xp, y1: 14, x2: xp, y2: H - bot + 4, stroke: ACC, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.8 }, grp);
    if (opt.showP) T(grp, xp, topH + 4, `θ = ${fmt(g.toT(g.xP))} ${g.tU}, v = ${fmt(g.toV(g.xP))} ${g.vU}`, { anchor: g.xP > L * 0.7 ? 'end' : g.xP < L * 0.3 ? 'start' : 'middle', color: ACC, size: 11.5, weight: 700 });
    // stacked diagrams
    const xs = []; for (let i = 0; i <= 300; i++) xs.push((L * i) / 300);
    g.cuts.forEach((c) => { if (c > 0 && c < L) xs.push(c - 1e-7 * L, c + 1e-7 * L); });
    xs.sort((a, b) => a - b);
    let y = topH + 14;
    const panel = (fn, color, label, fill, mark) => {
      const pts = xs.map((x) => [x, fn(x)]), lo = Math.min(0, ...pts.map((p) => p[1])), hi = Math.max(0, ...pts.map((p) => p[1]));
      const last = y + ph + gap >= H - bot - 1;
      const F = Charts.frame(svg, { x: X(0), y, w: pw, h: ph, xmin: 0, xmax: L, ymin: lo, ymax: hi, ylabel: label, ycolor: color, yside: 50, padY: 0.22, xticks: last ? undefined : false, xlabel: last ? `x (${u.L})` : undefined });
      Charts.curve(F, [[0, 0]].concat(pts, [[L, 0]]), { color, fill: fill ? color : null, fop: 0.2, width: 2 });
      if (mark && opt.showP) mark(F);
      y += ph + gap;
      return F;
    };
    if (vm) {
      panel((x) => g.res.V(x), COL.shear, `V (${u.F})`, true);
      panel((x) => g.res.M(x), COL.moment, `M (${u.FL})`, true);
    }
    if (sl) panel((x) => g.toT(x) * (k || 1), SLOPE, g.ei ? 'θ (rad)' : `EIθ (${u.F}·${u.L}²)`, false, (F) => Charts.mark(F, g.xP, g.toT(g.xP) * (k || 1), fmt(g.toT(g.xP)), { color: ACC, anchor: g.xP > L * 0.7 ? 'end' : 'start', dx: g.xP > L * 0.7 ? -8 : 8 }));
    panel((x) => g.toV(x) * (k || 1), DCOL, g.ei ? `v (${u.S})` : `EIv (${u.F}·${u.L}³)`, false, (F) => { Charts.mark(F, g.vmax.x, g.toV(g.vmax.x) * (k || 1), `${fmt(g.toV(g.vmax.x))} max`, { color: DCOL, anchor: g.vmax.x > L * 0.7 ? 'end' : 'start', dx: g.vmax.x > L * 0.7 ? -8 : 8, dy: 16 }); });
  };

  /* ------------------------------------------------------------------ */
  /* 3D: the beam bent along its elastic curve                          */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, L = g.L, sc = 10 / L, k = on() ? kD() : 0, vmx = Math.abs(g.vmax.v) || 1, hb = 0.32, wb = 0.5, n = 60;
    const dy = (x) => (g.res.v(x) / vmx) * 1.1 * k;
    for (let i = 0; i < n; i++) {
      const x0 = (L * i) / n, x1 = (L * (i + 1)) / n, c = k ? root.Anim.contour((k * Math.abs(g.res.v((x0 + x1) / 2))) / vmx) : BODY;
      const p = (x, y, z) => [x * sc, y + dy(x), z];
      [[[x0, hb, -wb], [x1, hb, -wb], [x1, hb, wb], [x0, hb, wb], [0, 1, 0]], [[x0, -hb, wb], [x1, -hb, wb], [x1, -hb, -wb], [x0, -hb, -wb], [0, -1, 0]], [[x0, -hb, wb], [x1, -hb, wb], [x1, hb, wb], [x0, hb, wb], [0, 0, 1]], [[x0, hb, -wb], [x1, hb, -wb], [x1, -hb, -wb], [x0, -hb, -wb], [0, 0, -1]]]
        .forEach((f) => v.face(f.slice(0, 4).map((q) => p(...q)), c, 1, 'fill', 1, 0, f[4]));
    }
    [[0, -1], [L, 1]].forEach(([x, s]) => v.face([[x * sc, -hb + dy(x), -wb], [x * sc, hb + dy(x), -wb], [x * sc, hb + dy(x), wb], [x * sc, -hb + dy(x), wb]], '#cfd8de', 1, EDGE, 1, 0, [s, 0, 0]));
    g.sups.forEach((s) => {
      const x = s.x * sc;
      if (s.type === 'fixed') { const r = s.x > L / 2; v.box(r ? x : x - 0.4, -1.2, -1, r ? x + 0.4 : x, 1.2, 1, '#cfd8de', 1, EDGE, { layer: (facing) => (facing([r ? 1 : -1, 0, 0]) > 0 ? 1 : -1) }); }
      else { v.face([[x, -hb, 0], [x - 0.35, -hb - 0.55, -0.45], [x + 0.35, -hb - 0.55, -0.45]], '#9aa5ad', 1, EDGE, 1, 0, null); v.face([[x, -hb, 0], [x - 0.35, -hb - 0.55, 0.45], [x + 0.35, -hb - 0.55, 0.45]], '#9aa5ad', 1, EDGE, 1, 0, null); v.box(x - 0.5, -hb - 0.65, -0.6, x + 0.5, -hb - 0.55, 0.6, '#cfd8de', 1, EDGE); }
      v.label([x, -hb - 1, 0.7], s.label, COL.ink);
    });
    v._hs = 0.22;
    g.loads.forEach((q) => {
      if (q.kind === 'point' && q.P) { const x = q.x * sc, y0 = hb + dy(q.x); MDUI.arrow3(v, [x, y0 + 1.4, 0], [x, y0, 0], LCOL, 2.4); if (opt.showP) v.label([x, y0 + 1.6, 0], `${fmt(Math.abs(q.P))} ${g.u.F}`, LCOL); }
      if (q.kind === 'dist') { const m = Math.max(2, Math.round((q.x2 - q.x1) * sc / 0.7)); for (let i = 0; i <= m; i++) { const x = q.x1 + ((q.x2 - q.x1) * i) / m, w = q.w1 + ((q.w2 - q.w1) * i) / m, wm = Math.max(Math.abs(q.w1), Math.abs(q.w2)) || 1, h = 0.25 + 0.8 * (Math.abs(w) / wm); if (h > 0.3) MDUI.arrow3(v, [x * sc, hb + dy(x) + h, 0], [x * sc, hb + dy(x), 0], LCOL, 1.5); } if (opt.showP) v.label([((q.x1 + q.x2) / 2) * sc, hb + dy((q.x1 + q.x2) / 2) + 1.3, 0], `${fmt(Math.max(q.w1, q.w2))} ${g.u.W}`, LCOL); }
      if (q.kind === 'couple' && q.M) v.label([q.x * sc, hb + dy(q.x) + 0.8, 0], `${fmt(Math.abs(q.M))} ${g.u.FL} ${(q.dir === 'cw') === (q.M < 0) ? '↺' : '↻'}`, COL.couple);
    });
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const sp = (type, x) => ({ type, x });
  const L = (kind, o) => Object.assign({ kind, x: 0, P: 0, M: 0, dir: 'ccw', x1: 0, x2: 0, w1: 0, w2: 0 }, o);
  const st = (mode, fu, ei, bL, sups, loads, at, o) => Object.assign({ mode, fu, ei, Isrc: 'typed', I: 100e6, W: 'W12×26', E: 200, mat: 'a36', at, bm: { L: bL, sups, loads } }, o || {});
  const SS = (l) => [sp('pin', 0), sp('roller', l)];
  M.presets = [
    { name: 'Test: Book Example 16.3, 6 kN on a 3 m span (v_max = −2.90 kN·m³/EI at 1.633 m)', units: 'SI', state: st('curve', 'kN', 'unit', 3, SS(3), [L('point', { x: 2, P: 6 })], 1.633),
      expect: [{ k: 'Largest deflection v_max', v: -2.90 }, { k: 'Where the deflection is largest, x', v: 1.633 }] },
    { name: 'Test: Book Example 16.2, W12×26 cantilever with 6 kip at the end (θ = 0.0164 rad, v = −1.97 in.)', units: 'US', state: st('curve', 'kip', 'num', 15, [sp('fixed', 15)], [L('point', { x: 0, P: 6 })], 0, { Isrc: 'W', W: 'W12×26', E: 29000 }),
      expect: [{ k: 'Slope at the point θ', v: 0.0164 }, { k: 'Deflection at the point v', v: -1.97 }] },
    { name: 'Test: Book Example 16.4, overhang with 4 kN at the end (v_C = −4 kN·m³/EI)', units: 'SI', state: st('curve', 'kN', 'unit', 3, [sp('pin', 0), sp('roller', 2)], [L('point', { x: 3, P: 4 })], 3),
      expect: [{ k: 'Deflection at the point v', v: -4 }, { k: 'Reaction at A, A_y', v: -2 }] },
    { name: 'Test: Book Example 16.7, two loads on an 8 m span added (v_C = −139, θ_A = −56 over EI)', units: 'SI', state: st('super', 'kN', 'unit', 8, SS(8), [L('dist', { x1: 0, x2: 4, w1: 2, w2: 2 }), L('point', { x: 4, P: 8 })], 4),
      expect: [{ k: 'Deflection at the point v', v: -138.7 }] },
    { name: 'Test: Book Example 16.8, cantilever with a triangular load (v_C = −244.8 kN·m³/EI)', units: 'SI', state: st('super', 'kN', 'unit', 8, [sp('fixed', 0)], [L('dist', { x1: 0, x2: 6, w1: 4, w2: 0 })], 8),
      expect: [{ k: 'Deflection at the point v', v: -244.8 }] },
    { name: 'Test: Book Example 16.12, fixed at both ends, 3 kip/ft on half (M_A = 24.75, M_B = 11.25 kip·ft)', units: 'US', state: st('indet', 'kip', 'unit', 12, [sp('fixed', 0), sp('fixed', 12)], [L('dist', { x1: 0, x2: 6, w1: 3, w2: 3 })], 6),
      expect: [{ k: 'Moment at A, M_A', v: 24.75 }, { k: 'Moment at B, M_B', v: -11.25 }] },
    { name: 'Test: propped cantilever under uniform load (R_B = 3wL/8, M_A = wL²/8)', units: 'SI', state: st('indet', 'kN', 'unit', 6, [sp('fixed', 0), sp('roller', 6)], [L('dist', { x1: 0, x2: 6, w1: 1, w2: 1 })], 3),
      expect: [{ k: 'Reaction at B, B_y', v: 2.25 }, { k: 'Moment at A, M_A', v: 4.5 }] },
    { name: 'Test: fixed-fixed beam under uniform load (wL²/12 at the ends, wL⁴/384EI at midspan)', units: 'SI', state: st('indet', 'kN', 'unit', 6, [sp('fixed', 0), sp('fixed', 6)], [L('dist', { x1: 0, x2: 6, w1: 1, w2: 1 })], 3),
      expect: [{ k: 'Moment at A, M_A', v: 3 }, { k: 'Deflection at the point v', v: -3.375 }] },
    { name: 'Continuous beam over two equal spans, uniform load', units: 'SI', state: st('indet', 'kN', 'num', 8, [sp('pin', 0), sp('roller', 4), sp('roller', 8)], [L('dist', { x1: 0, x2: 8, w1: 10, w2: 10 })], 2, { I: 80e6 }) },
    { name: 'Steel beam, 20 kN/m on a 6 m span with an overhang', units: 'SI', state: st('curve', 'kN', 'num', 7.5, [sp('pin', 0), sp('roller', 6)], [L('dist', { x1: 0, x2: 7.5, w1: 20, w2: 20 })], 3, { I: 120e6 }) },
    { name: 'Edge: a beam on one pin only, free to swing (fails on purpose)', units: 'SI', fails: true, state: st('curve', 'kN', 'unit', 4, [sp('pin', 0)], [L('point', { x: 2, P: 5 })], 2) },
  ];

  root.MDeflect = M;
})(window);
