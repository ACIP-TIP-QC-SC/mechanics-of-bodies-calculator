/* =====================================================================
 * STATICS · Friction (inputs, free-body diagrams, presets)
 * Physics: st/friction.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Friction } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const RCOL = COL.react, LCOL = COL.load, FCOL = '#8e44ad', CONE = '#e67e22';

  const M = { id: 'friction', title: 'Friction', defaults: Friction.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const massU = () => (M.units === 'US' ? 'slug' : 'kg');
  function weightIn(sec, C, o, F, label, by, mk, wk) {
    by = by || 'wBy'; mk = mk || 'm'; wk = wk || 'W';
    C.seg(sec, { label: `${label} given as`, get: () => o[by], set: (v) => (o[by] = v), options: [['mass', 'Mass'], ['force', 'Weight']] });
    if (o[by] === 'mass') C.num(sec, { label: `${label}: mass`, get: () => o[mk], set: (v) => (o[mk] = v), unit: massU() });
    else C.num(sec, { label: `${label}: weight`, get: () => o[wk], set: (v) => (o[wk] = v), unit: F });
  }
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, Ls = U.lenS, F = st.fu;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [['block', 'Block on a floor or slope: slip or tip'], ['ladder', 'Ladder against a wall'], ['wedge', 'Wedge'], ['screw', 'Square-threaded screw'], ['belt', 'Flat belt or rope over drums']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (st.mode === 'block') {
      const q = st.bk;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['check', 'Does it move under P?'], ['findP', 'P that starts motion']] });
      sec = C.section(c, 'Block');
      weightIn(sec, C, q, F, 'Block');
      C.num(sec, { label: 'Width of the base b', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Height (G at half height)', get: () => q.H, set: (v) => (q.H = v), unit: Lu });
      C.num(sec, { label: 'Slope angle (0 = level floor)', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      sec = C.section(c, 'Force P on the left face');
      if (q.task === 'check') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
      C.num(sec, { label: 'Angle from the surface (+ away from it)', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
      C.num(sec, { label: 'Height above the base', get: () => q.hP, set: (v) => (q.hP = v), unit: Lu });
    } else if (st.mode === 'ladder') {
      const q = st.ld;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['minAngle', 'Smallest angle'], ['check', 'Friction needed at an angle']] });
      sec = C.section(c, 'Ladder');
      weightIn(sec, C, q, F, 'Ladder');
      C.num(sec, { label: 'Length L', get: () => q.L, set: (v) => (q.L = v), unit: Lu });
      if (q.task === 'check') C.num(sec, { label: 'Angle with the floor θ', get: () => q.th, set: (v) => (q.th = v), unit: '°' });
      C.num(sec, { label: 'μs at the floor (A)', get: () => q.muA, set: (v) => (q.muA = v), unit: '' });
      C.num(sec, { label: 'μs at the wall (B), 0 = smooth', get: () => q.muB, set: (v) => (q.muB = v), unit: '' });
      sec = C.section(c, 'Person on the ladder');
      C.toggle(sec, { label: 'Someone stands on the ladder', get: () => !!q.person, set: (v) => (q.person = v) });
      if (q.person) { weightIn(sec, C, q, F, 'Person', 'wpBy', 'mp', 'Wp'); C.num(sec, { label: 'Distance up the ladder from A', get: () => q.s, set: (v) => (q.s = v), unit: Lu }); }
    } else if (st.mode === 'wedge') {
      const q = st.wd;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Push to raise'], ['lower', 'Pull to remove']] });
      sec = C.section(c, 'Load on the wedge');
      C.seg(sec, { label: 'The wedge lifts', get: () => q.load, set: (v) => (q.load = v), options: [['lever', 'A lever pinned at A'], ['guide', 'A block in a guide']] });
      weightIn(sec, C, q, F, 'Load');
      if (q.load === 'lever') {
        C.num(sec, { label: 'Wedge contact B from the pin A', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
        C.num(sec, { label: 'Weight from the pin A', get: () => q.xW, set: (v) => (q.xW = v), unit: Lu });
      } else C.num(sec, { label: 'μs at the guide', get: () => q.muG, set: (v) => (q.muG = v), unit: '' });
      sec = C.section(c, 'Wedge');
      C.num(sec, { label: 'Wedge angle α', get: () => q.al, set: (v) => (q.al = v), unit: '°' });
      C.num(sec, { label: 'μs between wedge and load (B)', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.num(sec, { label: 'μs between wedge and floor (C)', get: () => q.muC, set: (v) => (q.muC = v), unit: '' });
    } else if (st.mode === 'screw') {
      const q = st.sc;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Moment to raise'], ['lower', 'Moment to lower or hold']] });
      sec = C.section(c, 'Screw');
      C.num(sec, { label: 'Axial load W', get: () => q.W, set: (v) => (q.W = v), unit: F });
      C.num(sec, { label: 'Mean radius r', get: () => q.r, set: (v) => (q.r = v), unit: Ls });
      C.num(sec, { label: 'Lead l (advance per turn)', get: () => q.l, set: (v) => (q.l = v), unit: Ls });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.seg(sec, { label: 'Screws turned together', get: () => String(q.n), set: (v) => (q.n = +v), options: [['1', 'One'], ['2', 'Two (turnbuckle)']] });
    } else {
      const q = st.bt;
      sec = C.section(c, 'Tension');
      C.seg(sec, { label: 'The known tension is', get: () => q.known, set: (v) => (q.known = v), options: [['high', 'The larger one T₂'], ['low', 'The smaller one T₁']] });
      C.num(sec, { label: 'Known tension', get: () => q.T, set: (v) => (q.T = v), unit: F });
      sec = C.section(c, 'Drums (in order from the known end)');
      C.list(sec, { items: q.drums, max: 4, min: 1, color: () => '#e2cdef', title: (it, i) => `Drum ${i + 1}`, fields: () => [{ key: 'beta', label: 'Contact angle β', unit: '°' }, { key: 'turns', label: 'Extra full turns', unit: '' }, { key: 'mu', label: 'μs', unit: '', wide: true }], add: [['Drum', () => ({ beta: 180, turns: 0, mu: 0.3 })]] });
    }
  };

  M.compute = (U) => Friction.solve(S(), U);
  M.onUnits = (from, to) => Friction.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ block: 'Free-body diagram and friction cone', ladder: 'Free-body diagram of the ladder', wedge: 'Free-body diagram of the wedge and load', screw: 'Screw and the unwrapped thread', belt: 'Belt on the drums' }[mode()]);
  M.cap3D = '3D view';
  M.hint = () => ({
    block: 'Green: the normal force N at its position x and the friction force F. Orange dashed: the friction cone at ±φs = tan⁻¹ μs; while the resultant of N and F stays inside it, the block does not slip, and while N stays within the base, it does not tip.',
    ladder: 'The foot slips away from the wall and the top slides down, so friction acts toward the wall at A and upward at B.',
    wedge: 'Friction opposes the motion that is about to happen on each surface. Purple arrows are friction forces.',
    screw: 'The thread is unwrapped into a slope of rise l over a run of 2πr. The resultant R of the normal and friction forces leans at φs from the normal.',
    belt: 'The tension grows by e^(μβ) over each drum, toward the side the belt is about to slip to.',
  }[mode()]);
  M.legend = () => [[LCOL, 'Loads'], [RCOL, 'Normal forces'], [FCOL, 'Friction']].concat(mode() === 'block' ? [[CONE, 'Friction cone', 'ln']] : []);
  M.anim = null;

  /* ------------------------------------------------------------------ */
  /* 2D helpers                                                         */
  /* ------------------------------------------------------------------ */
  function arrowPx(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.42},${y2 - uy * hs + py * hs * 0.42} ${x2 - ux * hs - px * hs * 0.42},${y2 - uy * hs - py * hs * 0.42}`, fill: color }, g);
  }
  const hatch = (svg) => { const d = s('defs', {}, svg), p = s('pattern', { id: 'hatchF', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, p); };
  let LW = 0;
  const lbl = (g, x, y, txt, o) => {
    o = Object.assign({ size: 11.5, weight: 700 }, o);
    if (LW) { const tw = txt.length * o.size * 0.56, a = o.anchor || 'start', l = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2; x += Math.max(0, 6 - l) - Math.max(0, l + tw - (LW - 6)); }
    return T(g, x, y, txt, o);
  };
  /** Arrow of fixed pixel length ending at (or, with out, starting from) a screen point, labelled at its free end. */
  function force(g, x, y, ux, uy, L, color, txt, out, gap) {
    gap = gap || 0;
    const tx = out ? x + ux * gap : x - ux * (L + gap), ty = out ? y + uy * gap : y - uy * (L + gap), hx = tx + ux * L, hy = ty + uy * L;
    arrowPx(g, tx, ty, hx, hy, color, 2.4, 10);
    if (!txt) return;
    const sg = out ? 1 : -1, ex = (out ? hx : tx) + sg * ux * 6, ey = (out ? hy : ty) + sg * uy * 6, dx = sg * ux, dy = sg * uy;
    lbl(g, ex, ey + (dy > 0.5 ? 12 : dy < -0.5 ? -3 : 4), txt, { anchor: dx > 0.4 ? 'start' : dx < -0.4 ? 'end' : 'middle', color });
  }
  function arcPx(g, cx, cy, r, a0, a1, color, w) {
    const n = 30, pts = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`); }
    s('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': w || 1.4 }, g);
  }
  const poly = (g, pts, o) => s('polygon', Object.assign({ points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }, o), g);

  M.draw2D = function (svg, res, U, opt) {
    LW = svg.clientWidth || 800;
    const g = res.geo;
    if (g.kind === 'block') return drawBlock(svg, g, opt);
    if (g.kind === 'ladder') return drawLadder(svg, g, opt);
    if (g.kind === 'wedge') return drawWedge(svg, g, opt);
    if (g.kind === 'screw') return drawScrew(svg, g, opt);
    return drawBelt(svg, g, opt);
  };

  /* -------- block -------- */
  function drawBlock(svg, g, opt) {
    const { F, Lu } = g.c, ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, v) => [u * cp - v * sp, u * sp + v * cp];
    const e = Math.max(g.b, g.H), ext = g.b * 0.9 + e * 0.6;
    const pts = [R(-ext, 0), R(ext, 0), R(-g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]).concat([R(-ext, 0)[1] - e * 0.25]);
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) + e * 0.35 }, { pad: 60 }); hatch(svg);
    const g0 = D.root, P = (u, v) => { const w = R(u, v); return [D.X(w[0]), D.Y(w[1])]; };
    // ground or slope
    const a = P(-ext, 0), b = P(ext, 0), n = [sp, cp]; // screen direction into the ground
    poly(g0, [a, b, [b[0] + n[0] * 10, b[1] + n[1] * 10], [a[0] + n[0] * 10, a[1] + n[1] * 10]], { fill: 'url(#hatchF)' });
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    if (g.phi > 0) { arcPx(g0, a[0], a[1], 46, 0, g.phi, '#5a6b75'); lbl(g0, a[0] + 52, a[1] - 6, `${fmt(g.phi)}°`, { color: '#5a6b75', size: 11 }); s('line', { x1: a[0], y1: a[1], x2: a[0] + 70, y2: a[1], stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g0); }
    // block
    poly(g0, [P(-g.b / 2, 0), P(g.b / 2, 0), P(g.b / 2, g.H), P(-g.b / 2, g.H)], { fill: '#d9b58a', 'fill-opacity': 0.55, stroke: '#8a6a3f', 'stroke-width': 1.6 });
    const G = P(0, g.H / 2); s('circle', { cx: G[0], cy: G[1], r: 4, fill: '#1d2733' }, g0); lbl(g0, G[0] + 7, G[1] - 6, 'G', { color: '#1d2733' });
    // weight
    const wl = Math.min(46, Math.max(24, D.sc * g.H * 0.5 - 16));
    force(g0, G[0], G[1], 0, 1, wl, LCOL, null, true, 6); lbl(g0, G[0] + 7, G[1] + 6 + wl * 0.6, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // P on the left face, pushing (ψ < 0 or 0) or pulling (ψ > 0)
    if (Math.abs(g.P) > 0) {
      const at = P(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)), ux = d[0], uy = -d[1];
      force(g0, at[0], at[1], ux * Math.sign(g.P), uy * Math.sign(g.P), 52, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', g.psi > 0, 2);
    }
    // N at x, F along the base, friction cone at x
    const xN = Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), o = P(xN, 0), up = [-sp, -cp]; // screen unit normal, out of the surface
    force(g0, o[0], o[1], up[0], up[1], 46, RCOL, opt.showP ? `N = ${fmt(g.N)} ${F}` : 'N', false, 2);
    if (Math.abs(g.Ff) > 1e-12) { const t = R(-Math.sign(g.Ff), 0); force(g0, o[0], o[1], t[0], -t[1], 44, FCOL, opt.showP ? `F = ${fmt(Math.abs(g.Ff))} ${F}` : 'F', true, 4); }
    const phs = Math.atan(g.mu), Lc = Math.min(110, Math.max(70, D.sc * g.H * 0.9));
    [-1, 1].forEach((sg) => { const ang = ph + Math.PI / 2 + sg * phs, dx = Math.cos(ang), dy = -Math.sin(ang); s('line', { x1: o[0], y1: o[1], x2: o[0] + dx * Lc, y2: o[1] + dy * Lc, stroke: CONE, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g0); });
    lbl(g0, o[0] + Math.cos(ph + Math.PI / 2 + phs) * (Lc + 4), o[1] - Math.sin(ph + Math.PI / 2 + phs) * (Lc + 4), `φs = ${fmt(phs / DEG)}°`, { anchor: 'end', color: CONE, size: 11 });
    // resultant direction of N and F inside or outside the cone
    const Rang = ph + Math.PI / 2 + Math.atan2(-g.Ff, g.N), Lr = Lc * 0.75;
    s('line', { x1: o[0], y1: o[1], x2: o[0] + Math.cos(Rang) * Lr, y2: o[1] - Math.sin(Rang) * Lr, stroke: RCOL, 'stroke-width': 1.6, 'stroke-dasharray': '2 3' }, g0);
    // x dimension from the centre line
    const c0 = P(0, 0), c1 = P(0, -g.H * 0.18), x1 = P(xN, -g.H * 0.18);
    s('line', { x1: c0[0], y1: c0[1], x2: c1[0], y2: c1[1], stroke: '#9aa5ad', 'stroke-dasharray': '3 3' }, g0);
    if (Math.abs(g.x) > 1e-9) { s('line', { x1: c1[0], y1: c1[1], x2: x1[0], y2: x1[1], stroke: '#5a6b75', 'stroke-width': 1.2 }, g0); lbl(g0, (c1[0] + x1[0]) / 2, (c1[1] + x1[1]) / 2 + 14, `x = ${fmt(g.x)} ${Lu}`, { anchor: 'middle', color: '#5a6b75', size: 11 }); }
    const vt = g.find ? `${g.verdict === 'tip' ? 'Tips' : 'Slips'} first, at P = ${fmt(g.P)} ${F}` : { none: 'No slipping or tipping', slip: 'Slips', tip: 'Tips', both: 'Slips and tips' }[g.verdict];
    lbl(g0, 14, 22, vt, { color: g.verdict === 'none' ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
  }

  /* -------- ladder -------- */
  function drawLadder(svg, g, opt) {
    const { F } = g.c, th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)];
    const D = UI.Draw2D(svg, { xmin: -L * 0.32, xmax: A[0] + L * 0.42, ymin: -L * 0.22, ymax: B[1] + L * 0.2 }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])], a = P(A), b = P(B), o = P([0, 0]);
    poly(g0, [[o[0] - 14, D.Y(B[1] + L * 0.15)], [o[0], D.Y(B[1] + L * 0.15)], [o[0], o[1]], [o[0] - 14, o[1]]], { fill: 'url(#hatchF)' });
    poly(g0, [[o[0] - 14, o[1]], [D.X(A[0] + L * 0.35), o[1]], [D.X(A[0] + L * 0.35), o[1] + 12], [o[0] - 14, o[1] + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: o[0], y1: o[1], x2: o[0], y2: D.Y(B[1] + L * 0.15), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: o[0], y1: o[1], x2: D.X(A[0] + L * 0.35), y2: o[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8a6a3f', 'stroke-width': 9, 'stroke-linecap': 'round' }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#d9b58a', 'stroke-width': 6, 'stroke-linecap': 'round' }, g0);
    arcPx(g0, a[0], a[1], 40, 180 - g.th, 180, '#5a6b75'); lbl(g0, a[0] - 46, a[1] - 8, `θ = ${fmt(g.th)}°`, { anchor: 'end', color: '#5a6b75', size: 11.5 });
    lbl(g0, a[0] + 8, a[1] - 10, 'A', { color: '#1d2733', size: 13, weight: 800 }); lbl(g0, b[0] + 12, b[1] - 6, 'B', { color: '#1d2733', size: 13, weight: 800 });
    const m = P([A[0] / 2, B[1] / 2]);
    force(g0, m[0], m[1], 0, 1, 46, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', true, 6);
    if (g.Wp > 0) { const k = g.s / L, pp = P([A[0] * (1 - k), B[1] * k]); s('circle', { cx: pp[0], cy: pp[1], r: 5, fill: LCOL }, g0); force(g0, pp[0], pp[1], 0, 1, 40, LCOL, opt.showP ? `${fmt(g.Wp)} ${F}` : 'W_p', true, 6); }
    force(g0, a[0], a[1], 0, -1, 44, RCOL, opt.showP ? `N_A = ${fmt(g.NA)} ${F}` : 'N_A', false, 14);
    if (g.FA > 0) force(g0, a[0], a[1] + 6, -1, 0, 44, FCOL, opt.showP ? `F_A = ${fmt(g.FA)} ${F}` : 'F_A', false, 6);
    force(g0, b[0], b[1], 1, 0, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 8);
    if (g.FB > 0) force(g0, b[0] + 4, b[1], 0, -1, 40, FCOL, opt.showP ? `F_B = ${fmt(g.FB)} ${F}` : 'F_B', true, 8);
  }

  /* -------- wedge -------- */
  function drawWedge(svg, g, opt) {
    const { F } = g.c, ta = Math.tan(g.al * DEG), lever = g.load === 'lever';
    const Lw = lever ? Math.max(g.a * 0.55, 1e-6) : 1, t = Lw * Math.max(ta, 0.2); // thin wedges are drawn steeper so the forces can be read
    const xB = Lw * 0.5, yB = t * 0.5, sc0 = lever ? g.a : Lw;
    // the lever's end corner rests on the wedge face at B and the pin A is beyond it (mirror of the book figure; same equations)
    const xA = xB + (lever ? g.a : 0), yL = yB, hL = sc0 * 0.08;
    const xmin = -Lw * 0.5, xmax = lever ? xA + sc0 * 0.15 : Lw * 1.5;
    const D = UI.Draw2D(svg, { xmin, xmax, ymin: -sc0 * 0.25, ymax: yB + sc0 * (lever ? 0.45 : 0.9) }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)];
    poly(g0, [P(xmin, 0), P(xmax, 0), [D.X(xmax), D.Y(0) + 12], [D.X(xmin), D.Y(0) + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: D.X(xmin), y1: D.Y(0), x2: D.X(xmax), y2: D.Y(0), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    // wedge: thick end at the left, top face falls to the right
    poly(g0, [P(0, 0), P(Lw, 0), P(0, t)], { fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.6 });
    lbl(g0, D.X(Lw * 0.12), D.Y(0) + 18, 'C', { color: '#1d2733', size: 12, weight: 800 });
    const B = P(xB, yB);
    if (lever) {
      poly(g0, [P(xB, yL), P(xA + sc0 * 0.06, yL), P(xA + sc0 * 0.06, yL + hL), P(xB, yL + hL)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      const A = P(xA, yL); poly(g0, [A, [A[0] - 11, D.Y(0)], [A[0] + 11, D.Y(0)]], { fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }); s('circle', { cx: A[0], cy: A[1], r: 4, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.5 }, g0);
      lbl(g0, A[0] + 10, A[1] - 8, 'A', { color: '#1d2733', size: 12, weight: 800 });
      const Wp = P(xA - g.xW, yL + hL); force(g0, Wp[0], Wp[1], 0, 1, 44, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    } else {
      const bw = Lw * 0.36, bh = Lw * 0.4, x0 = xB - bw / 2, yb = t * (1 - x0 / Lw);
      poly(g0, [P(x0, yb), P(x0 + bw, yb), P(x0 + bw, yb + bh), P(x0, yb + bh)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      [x0 - Lw * 0.03, x0 + bw + Lw * 0.03].forEach((xg, i) => poly(g0, [P(xg, yB + bh * 0.1), P(xg, yB + bh * 1.6), [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 1.6)], [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 0.1)]], { fill: 'url(#hatchF)' }));
      const Wp = P(xB, yb + bh); force(g0, Wp[0], Wp[1], 0, 1, 40, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    }
    lbl(g0, B[0] + 6, B[1] + 18, 'B', { color: '#1d2733', size: 12, weight: 800 });
    // forces on the wedge: N_B (pressing down into the wedge) and friction at B; N_C and friction at C; P
    const sa = Math.sin(g.al * DEG), ca = Math.cos(g.al * DEG), raise = g.task === 'raise';
    force(g0, B[0], B[1], -sa, ca, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 4);
    const tf = raise ? [-ca, -sa] : [ca, sa]; // friction on the wedge at B, along the face, opposing its slide (screen coordinates)
    force(g0, B[0], B[1], tf[0], tf[1], 40, FCOL, opt.showP ? `${fmt(g.mu * g.NB)} ${F}` : 'μN_B', true, 8);
    const Cp = P(Lw * 0.22, 0);
    force(g0, Cp[0], Cp[1], 0, -1, 40, RCOL, opt.showP ? `N_C = ${fmt(g.NC)} ${F}` : 'N_C', false, 16);
    force(g0, Cp[0] + 10, Cp[1] + 6, raise ? -1 : 1, 0, 40, FCOL, opt.showP ? `${fmt(g.muC * g.NC)} ${F}` : 'μN_C', true, 0);
    const Pp = P(0, t * 0.45), pull = g.P >= 0 ? !raise : raise;
    force(g0, Pp[0], Pp[1], pull ? -1 : 1, 0, 50, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', pull, 4);
    lbl(g0, D.X(Lw * 0.62), D.Y(t * 0.12) - 2, `α = ${fmt(g.al)}°`, { color: '#5a6b75', size: 11 });
  }

  /* -------- screw -------- */
  function drawScrew(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F, Ls } = g.c, stack = W < 600, pw = stack ? W : W * 0.42, ph = stack ? H * 0.45 : H;
    const g0 = s('g', {}, svg);
    T(g0, 12, 20, 'Screw', { color: '#5a6b75', size: 12, weight: 700 });
    const cx = pw / 2, top = ph * 0.3, bot = ph * 0.86, rw = Math.min(pw * 0.14, 46);
    s('rect', { x: cx - rw, y: top, width: 2 * rw, height: bot - top, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
    const pitch = Math.max(12, (bot - top) / 9), dz = Math.max(4, 2 * rw * Math.tan(g.th * DEG));
    for (let y = top + 6; y < bot - 4; y += pitch) s('line', { x1: cx - rw, y1: y + dz, x2: cx + rw, y2: y, stroke: '#4a5661', 'stroke-width': 1.3 }, g0);
    s('rect', { x: cx - rw * 1.9, y: bot, width: rw * 3.8, height: 10, fill: 'url(#hatchF)' }, g0);
    hatch(svg);
    s('rect', { x: cx - rw * 1.5, y: top - 18, width: rw * 3, height: 18, fill: '#d9b58a', stroke: '#8a6a3f' }, g0);
    arrowPx(g0, cx, top - 70, cx, top - 20, LCOL, 2.6, 11); lbl(g0, cx + 8, top - 56, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // moment arrow around the axis
    const ey = (top + bot) / 2, ex = rw * 1.9;
    s('path', { d: `M ${cx - ex} ${ey} A ${ex} ${ex * 0.32} 0 0 0 ${cx + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
    arrowPx(g0, cx + ex - 2, ey - 8, cx + ex, ey + 1, FCOL, 2.2, 10);
    lbl(g0, cx + ex + 6, ey + 18, opt.showP ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', { color: FCOL });
    lbl(g0, cx, bot + 28, `r = ${fmt(g.r)} ${Ls},  l = ${fmt(g.l)} ${Ls}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
    // unwrapped thread with the force triangle
    const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? W : W - pw, qh = stack ? H - ph : H, g1 = s('g', {}, svg);
    s('line', { x1: ox + (stack ? 10 : 0), y1: oy + (stack ? 0 : 10), x2: stack ? W - 10 : ox, y2: stack ? oy : H - 10, stroke: '#e1e7ea' }, g1);
    T(g1, ox + 12, oy + 20, 'One turn of the thread, unwrapped', { color: '#5a6b75', size: 12, weight: 700 });
    const base = qw * 0.62, thv = Math.max(g.th, 3) * DEG, rise = base * Math.tan(thv), x0 = ox + qw * 0.16, y0 = oy + qh * 0.78;
    poly(g1, [[x0, y0], [x0 + base, y0], [x0 + base, y0 - rise]], { fill: '#eef2f4', stroke: '#4a5661', 'stroke-width': 1.5 });
    lbl(g1, x0 + base / 2, y0 + 18, '2πr', { anchor: 'middle', color: '#5a6b75', size: 11 }); lbl(g1, x0 + base + 6, y0 - rise / 2, 'l', { color: '#5a6b75', size: 11 });
    arcPx(g1, x0, y0, 54, 0, thv / DEG, '#5a6b75'); lbl(g1, x0 + 60, y0 - 6, `θ = ${fmt(g.th)}°`, { color: '#5a6b75', size: 11 });
    // block on the slope with W, the push M/r and the resultant R at φs from the normal
    const bx = x0 + base * 0.62, by = y0 - base * 0.62 * Math.tan(thv), up = g.task === 'raise' ? 1 : -1;
    const nA = Math.PI / 2 + thv, rA = nA + (g.task === 'raise' ? 1 : -1) * g.ph * DEG * (g.lock || g.task === 'raise' ? 1 : -1);
    s('rect', { x: bx - 13, y: by - 26, width: 26, height: 20, fill: '#d9b58a', stroke: '#8a6a3f', transform: `rotate(${-thv / DEG} ${bx} ${by})` }, g1);
    arrowPx(g1, bx, by - 70, bx, by - 30, LCOL, 2.4, 10); lbl(g1, bx + 6, by - 62, 'W', { color: LCOL });
    const Lr = Math.min(80, qh * 0.3); arrowPx(g1, bx - Math.cos(rA) * Lr * 0.1, by + Math.sin(rA) * Lr * 0.1 + 6, bx + Math.cos(rA) * Lr, by - Math.sin(rA) * Lr, RCOL, 2.4, 10);
    lbl(g1, bx + Math.cos(rA) * Lr + 6, by - Math.sin(rA) * Lr, 'R', { color: RCOL });
    s('line', { x1: bx, y1: by, x2: bx + Math.cos(nA) * Lr * 0.9, y2: by - Math.sin(nA) * Lr * 0.9, stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g1);
    lbl(g1, bx + Math.cos(nA) * Lr * 0.95 - 4, by - Math.sin(nA) * Lr * 0.95 - 4, `φs = ${fmt(g.ph)}°`, { anchor: 'end', color: CONE, size: 11 });
    const hx = up > 0 ? bx - 80 : bx + 80; arrowPx(g1, hx, by - 12, up > 0 ? bx - 16 : bx + 16, by - 12, FCOL, 2.4, 10); lbl(g1, hx, by - 20, 'M/r', { anchor: 'middle', color: FCOL });
    lbl(g1, ox + 12, oy + qh - 14, g.lock ? `Self-locking: φs ≥ θ` : 'Not self-locking: φs < θ', { color: g.lock ? '#1e7a45' : '#a3281f', size: 12, weight: 800 });
  }

  /* -------- belt -------- */
  function drawBelt(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F } = g.c, n = g.drums.length, gg = s('g', {}, svg);
    const cell = W / n, R = Math.min(cell * 0.22, H * 0.18), cy = H * 0.48;
    g.drums.forEach((d, i) => {
      const cx = cell * (i + 0.5), vis = Math.min(d.deg, 359.5), a0 = 90 + vis / 2, a1 = 90 - vis / 2;
      s('circle', { cx, cy, r: R, fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 1.6 }, gg);
      s('circle', { cx, cy, r: 5, fill: '#4a5661' }, gg);
      arcPx(gg, cx, cy, R + 3, a1, a0, '#2c3e50', 4);
      if (d.deg >= 360) lbl(gg, cx, cy + 4, `${fmt(d.deg / 360, 3)} turns`, { anchor: 'middle', color: '#2c3e50', size: 11 });
      // the belt leaves tangentially at both ends of the contact
      const ends = [[a0, 1], [a1, -1]];
      ends.forEach(([a, sg], k) => {
        const ar = a * DEG, px = cx + (R + 3) * Math.cos(ar), py = cy - (R + 3) * Math.sin(ar), tx = -Math.sin(ar) * sg, ty = -Math.cos(ar) * sg, L = Math.min(cell * 0.3, 70);
        s('line', { x1: px, y1: py, x2: px + tx * L, y2: py + ty * L, stroke: '#2c3e50', 'stroke-width': 4 }, gg);
        const Tv = g.hi ? (k === 0 ? g.Ts[i] : g.Ts[i + 1]) : (k === 0 ? g.Ts[i + 1] : g.Ts[i]), big = g.hi ? k === 0 : k === 0;
        arrowPx(gg, px + tx * L * 0.4, py + ty * L * 0.4, px + tx * (L + 16), py + ty * (L + 16), big ? LCOL : RCOL, 2.4, 10);
        lbl(gg, px + tx * (L + 20), py + ty * (L + 20) + 14, opt.showP ? `${fmt(Tv)} ${F}` : (big ? 'T₂' : 'T₁'), { anchor: 'middle', color: big ? LCOL : RCOL, size: 11.5 });
      });
      lbl(gg, cx, cy - R - 18, `β = ${fmt(d.deg)}°, μs = ${fmt(d.mu)}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
      lbl(gg, cx, cy + R + 22, `Drum ${i + 1}`, { anchor: 'middle', color: '#1d2733', size: 12, weight: 800 });
    });
    lbl(gg, 12, 20, `Slip is about to happen toward the larger tension (red); e^(μβ) multiplies the tension over each drum.`, { color: '#5a6b75', size: 11.5, weight: 600 });
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = d.map((x) => x / L), hs = Math.min(L * 0.3, v._hs || L * 0.15), n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2.4));
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, F = g.c.F;
    if (g.kind === 'block') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], e = Math.max(g.b, g.H), z = g.b * 0.6, ext = g.b * 0.9 + e * 0.6;
      v._hs = e * 0.08;
      const a = R(-ext, 0), b = R(ext, 0);
      v.extrude([a, b, [b[0], Math.min(a[1], b[1]) - e * 0.1], [a[0], Math.min(a[1], b[1]) - e * 0.1]], -z * 1.4, z * 1.4, '#cfd8de', 1, '#8c99a3');
      v.extrude([R(-g.b / 2, 0), R(g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)], -z / 2, z / 2, '#d9b58a', 1, '#8a6a3f');
      const G = R(0, g.H / 2); arrow3(v, [G[0], G[1], z / 2], [G[0], G[1] - e * 0.45, z / 2], LCOL, 2.4); v.label([G[0], G[1] - e * 0.5, z / 2], opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', LCOL);
      const o = R(Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), 0), nrm = R(0, 1);
      arrow3(v, [o[0] - nrm[0] * e * 0.4, o[1] - nrm[1] * e * 0.4, z / 2 + 0.01], [o[0], o[1], z / 2 + 0.01], RCOL, 2.4); v.label([o[0] - nrm[0] * e * 0.45, o[1] - nrm[1] * e * 0.45, z / 2], 'N', RCOL);
      if (Math.abs(g.P) > 0) { const at = R(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); arrow3(v, [at[0] - d[0] * e * 0.5, at[1] - d[1] * e * 0.5, 0], [at[0], at[1], 0], LCOL, 2.6); v.label([at[0] - d[0] * e * 0.55, at[1] - d[1] * e * 0.55, 0], 'P', LCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'ladder') {
      const th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)], w = L * 0.12; v._hs = L * 0.05;
      v.box(-L * 0.04, 0, -L * 0.35, 0, B[1] * 1.2, L * 0.35, '#dfe4e8', 1, '#8c99a3');
      v.box(-L * 0.04, -L * 0.03, -L * 0.35, A[0] * 1.3, 0, L * 0.35, '#cfd8de', 1, '#8c99a3');
      [-w, w].forEach((zz) => v.line([[A[0], A[1], zz], [B[0], B[1], zz]], '#8a6a3f', 4));
      for (let k = 1; k < 10; k++) { const t = k / 10; v.line([[A[0] * (1 - t), B[1] * t, -w], [A[0] * (1 - t), B[1] * t, w]], '#8a6a3f', 2); }
      const m = [A[0] / 2, B[1] / 2, 0]; arrow3(v, m, [m[0], m[1] - L * 0.25, 0], LCOL, 2.4); v.label([m[0], m[1] - L * 0.28, 0], 'W', LCOL);
      arrow3(v, [A[0], -L * 0.25, 0], [A[0], 0, 0], RCOL, 2.4); v.label([A[0], -L * 0.28, 0], 'N_A', RCOL);
      arrow3(v, [B[0] + L * 0.01, B[1], 0], [B[0] + L * 0.25, B[1], 0], RCOL, 2.4); v.label([B[0] + L * 0.28, B[1], 0], 'N_B', RCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'wedge') {
      const ta = Math.tan(g.al * DEG), Lw = 1, t = Lw * Math.max(ta, 0.05), z = 0.35; v._hs = 0.06;
      v.box(-0.6, -0.05, -0.6, 1.6, 0, 0.6, '#cfd8de', 1, '#8c99a3');
      v.extrude([[0, 0], [Lw, 0], [0, t]], -z, z, '#c9d3da', 1, '#4a5661');
      if (g.load === 'lever') { v.box(-0.6, t * 0.5, -z * 0.8, 0.7, t * 0.5 + 0.1, z * 0.8, '#d9b58a', 1, '#8a6a3f'); v.box(-0.58, 0, -0.08, -0.48, t * 0.5, 0.08, '#b9c4cc', 1, '#5a6b75'); }
      else v.box(0.32, t * 0.5, -z * 0.7, 0.68, t * 0.5 + 0.4, z * 0.7, '#d9b58a', 1, '#8a6a3f');
      const raise = g.task === 'raise'; arrow3(v, raise ? [-0.45, t * 0.4, 0] : [0, t * 0.4, 0], raise ? [0, t * 0.4, 0] : [-0.45, t * 0.4, 0], LCOL, 2.6); v.label([-0.5, t * 0.4, 0], 'P', LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'screw') {
      const r = 1, h = 4, turns = 6, pts = []; v._hs = 0.25;
      v.lathe([[0, 0], [r * 0.92, 0], [r * 0.92, h], [0, h]], '#c9d3da', 1, null, 36);
      for (let i = 0; i <= turns * 48; i++) { const a = (i / 48) * 2 * Math.PI, y = (i / (turns * 48)) * h * 0.95; pts.push([r * Math.cos(a), y, r * Math.sin(a)]); }
      v.line(pts, '#4a5661', 1.6);
      v.box(-1.4, h, -1.4, 1.4, h + 0.4, 1.4, '#d9b58a', 1, '#8a6a3f');
      arrow3(v, [0, h + 2.2, 0], [0, h + 0.45, 0], LCOL, 2.6); v.label([0.2, h + 2.3, 0], opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', LCOL);
      v.circle(0, h * 0.5, 0, 2, FCOL, 2.2); v.label([2.1, h * 0.5, 0], opt.showP ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', FCOL);
      v.autoBounds(); return;
    }
    // belt
    const R = 1;
    g.drums.forEach((d, i) => {
      const cx = i * 3, ring = []; for (let k = 0; k <= 36; k++) { const a = (k / 36) * 2 * Math.PI; ring.push([cx + R * Math.cos(a), R * Math.sin(a)]); }
      v.extrude(ring, -0.5, 0.5, '#dfe5ea', 1, null);
      const vis = Math.min(d.deg, 359.5), a0 = 90 - vis / 2, arc = [];
      for (let k = 0; k <= 30; k++) { const a = (a0 + (vis * k) / 30) * DEG; arc.push([cx + 1.03 * Math.cos(a), 1.03 * Math.sin(a), 0]); }
      v.line(arc, '#2c3e50', 4);
    });
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const B = (o) => ({ mode: 'block', fu: 'N', bk: o });
  M.presets = [
    { name: 'Test: Book Example 8.1, crate pushed at 30° (does it move?)', units: 'SI', state: B({ wBy: 'mass', m: 20, b: 0.8, H: 0.6, phi: 0, mu: 0.3, task: 'check', P: 80, psi: -30, hP: 0.2 }),
      expect: [{ k: 'Friction needed F', v: 69.28 }, { k: 'Normal force N', v: 236.2 }, { k: 'Position of N, x', v: -0.00908 }, { k: 'Largest friction μs N', v: 70.86 }] },
    { name: 'Test: Book Example 8.2, angle of repose on a 25° truck bed', units: 'US', state: { mode: 'block', fu: 'lb', bk: { wBy: 'force', W: 500, b: 3, H: 5, phi: 25, mu: 0.4663077, task: 'check', P: 0, psi: 0, hP: 0 } },
      expect: [{ k: 'Position of N, x', v: -1.166 }, { k: 'Normal force N', v: 453.15 }, { k: 'Friction needed F', v: -211.31 }] },
    { name: 'Test: closed form, block pushed at 0.8 m tips before it slips', units: 'SI', state: B({ wBy: 'force', W: 500, b: 0.6, H: 1, phi: 0, mu: 0.4, task: 'findP', psi: 0, hP: 0.8 }),
      expect: [{ k: 'P to tip', v: 187.5 }, { k: 'P to slip', v: 200 }] },
    { name: 'Block pushed up a 20° slope', units: 'SI', state: { mode: 'block', fu: 'kN', bk: { wBy: 'force', W: 2, b: 0.5, H: 0.8, phi: 20, mu: 0.35, task: 'findP', psi: 10, hP: 0.3 } } },
    { name: 'Test: Book Example 8.3, smallest angle of a ladder on a smooth wall', units: 'SI', state: { mode: 'ladder', fu: 'N', ld: { wBy: 'mass', m: 10, L: 4, muA: 0.3, muB: 0, task: 'minAngle', person: false } },
      expect: [{ k: 'Smallest angle θ (from the floor)', v: 59.04 }, { k: 'N_A', v: 98.1 }, { k: 'F_A', v: 29.43 }, { k: 'N_B', v: 29.43 }] },
    { name: 'Ladder at 70° with a person three-quarters up, rough wall', units: 'US', state: { mode: 'ladder', fu: 'lb', ld: { wBy: 'force', W: 40, L: 16, muA: 0.25, muB: 0.2, task: 'check', th: 70, person: true, wpBy: 'force', Wp: 180, s: 12 } } },
    { name: 'Test: Book Example 8.6, pulling the wedge out from under a 500 kg stone', units: 'SI', state: { mode: 'wedge', fu: 'N', wd: { load: 'lever', wBy: 'mass', m: 500, al: 7, mu: 0.3, muC: 0.3, muG: 0, a: 1, xW: 0.5, task: 'lower' } },
      expect: [{ k: 'Pull to remove, P', v: 1154.9 }, { k: 'N_B', v: 2383.1 }, { k: 'N_C', v: 2452.5 }] },
    { name: 'Wedge raising a block in a guide', units: 'SI', state: { mode: 'wedge', fu: 'kN', wd: { load: 'guide', wBy: 'force', W: 8, al: 12, mu: 0.25, muC: 0.25, muG: 0.15, task: 'raise' } } },
    { name: 'Test: Book Example 8.7, turnbuckle with two screws', units: 'SI', state: { mode: 'screw', fu: 'N', sc: { W: 2000, r: 5, l: 2, mu: 0.25, n: 2, task: 'raise' } },
      expect: [{ k: 'Moment to raise M', v: 6.375 }, { k: 'Lead angle θ', v: 3.643 }, { k: 'Friction angle φs', v: 14.04 }] },
    { name: 'Screw with a steep thread that is not self-locking', units: 'US', state: { mode: 'screw', fu: 'lb', sc: { W: 1500, r: 0.4, l: 0.9, mu: 0.15, n: 1, task: 'lower' } } },
    { name: 'Test: Book Example 8.8, cord over two drums holding a hanging mass', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'high', T: 500, drums: [{ beta: 135, turns: 0, mu: 0.25 }, { beta: 135, turns: 0, mu: 0.25 }] } },
      expect: [{ k: 'Tension after drum 1', v: 277.4 }, { k: 'Tension after drum 2', v: 153.9 }, { k: 'Mass that can be held', v: 15.69 }] },
    { name: 'Rope with two turns around a capstan', units: 'US', state: { mode: 'belt', fu: 'lb', bt: { known: 'low', T: 20, drums: [{ beta: 0, turns: 2, mu: 0.3 }] } } },
    { name: 'Edge: a pull that lifts the block off the floor (fails on purpose)', units: 'SI', fails: true, state: B({ wBy: 'force', W: 100, b: 0.5, H: 0.5, phi: 0, mu: 0.3, task: 'check', P: 300, psi: 60, hP: 0.4 }) },
  ];

  root.SFriction = M;
})(window);
