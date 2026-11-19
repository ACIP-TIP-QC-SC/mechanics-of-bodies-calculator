/* =====================================================================
 * DYNAMICS · D5 Planar Kinematics of a Rigid Body (inputs, diagrams, presets). Physics: dy/rbmotion.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, RbMotion, DY, DYUI, DRbExtraUI: XU } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', LINK = '#5d6d7e', D2R = Math.PI / 180, TAU = 2 * Math.PI;

  const M = { id: 'rbmotion', title: 'Planar Kinematics of Rigid Bodies', defaults: RbMotion.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    let sec = C.section(c, 'Mechanism');
    C.select(sec, { label: 'Mechanism', get: () => st.mode, set: (v) => (st.mode = v), options: [
      ['fixed', 'Rotation about a fixed axis (gears, belts)'], ['slider', 'Slider-crank'], ['fourbar', 'Four-bar linkage'], ['roll', 'Wheel or spool rolling without slipping'], ['bar', 'Bar sliding on a wall and a floor'],
      ['abs', 'Absolute motion: cam or linkage, s = f(θ)'], ['slot', 'Slotted link driven by a peg'], ['rotframe', 'Rotating frame and Coriolis acceleration'], ['planet', 'Planetary gears']] });
    C.note(sec, 'Angular velocities and accelerations are + counterclockwise.');
    if (XU.MODES.includes(st.mode)) return XU.controls(c, C, st, u);
    if (st.mode === 'fixed') {
      sec = C.section(c, 'Driving wheel A');
      num(sec, 'rA', 'Radius r_A', u.L); num(sec, 'w0', 'Starting ω₀', 'rad/s'); num(sec, 'al', 'Constant angular acceleration α', 'rad/s²');
      C.seg(sec, { label: 'After', get: () => st.by, set: (v) => (st.by = v), options: [['time', 'A time t'], ['rev', 'A number of turns']] });
      if (st.by === 'time') num(sec, 'tt', 'Time t', 's'); else num(sec, 'rev', 'Turns of A', 'rev');
      sec = C.section(c, 'Driven wheel B');
      C.seg(sec, { label: 'Connection', get: () => st.link, set: (v) => (st.link = v), options: [['none', 'None'], ['belt', 'Belt'], ['gear', 'Gears in mesh']] });
      if (st.link !== 'none') num(sec, 'rB', 'Radius r_B', u.L);
      num(sec, 'rP', `Radius of point P on ${st.link === 'none' ? 'A' : 'B'}`, u.L);
    } else if (st.mode === 'slider') {
      sec = C.section(c, 'Geometry');
      num(sec, 'r', 'Crank AB, r', u.L); num(sec, 'l', 'Connecting rod BC, l', u.L); num(sec, 'beta', 'Direction of the slider line from +x', '°'); num(sec, 'e', 'Offset of the slider line', u.L);
      num(sec, 'th', 'Crank angle θ from the slider line', '°');
      sec = C.section(c, 'Crank motion');
      num(sec, 'wAB', 'ω_AB', 'rad/s'); num(sec, 'aAB', 'α_AB', 'rad/s²');
    } else if (st.mode === 'fourbar') {
      sec = C.section(c, 'Links');
      num(sec, 'd4', 'Ground AD, d', u.L); num(sec, 'a4', 'Crank AB, a', u.L); num(sec, 'b4', 'Coupler BC, b', u.L); num(sec, 'c4', 'Rocker DC, c', u.L);
      sec = C.section(c, 'Crank motion');
      num(sec, 'th4', 'Crank angle θ from AD', '°'); num(sec, 'w4', 'ω_AB', 'rad/s'); num(sec, 'al4', 'α_AB', 'rad/s²');
    } else if (st.mode === 'roll') {
      sec = C.section(c, 'Body');
      C.seg(sec, { label: 'Rolls on', get: () => st.surf, set: (v) => (st.surf = v), options: [['floor', 'A floor'], ['cord', 'A fixed vertical cord (unwinding)']] });
      num(sec, 'R', 'Radius it rolls on r', u.L); num(sec, 'Ro', 'Outer radius (for the drawing)', u.L);
      num(sec, 'w', 'ω (− clockwise)', 'rad/s'); num(sec, 'alr', 'α (− clockwise)', 'rad/s²');
      sec = C.section(c, 'Point P');
      num(sec, 'rho', 'Distance from G', u.L); num(sec, 'phi', 'Direction from G (from +x)', '°');
    } else {
      sec = C.section(c, 'Bar AB');
      num(sec, 'L', 'Length L', u.L); num(sec, 'thb', 'Angle between the bar and the floor θ', '°');
      num(sec, 'vA', 'Velocity of A down the wall', u.V); num(sec, 'aA', 'Acceleration of A down the wall', u.A);
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (XU.MODES.includes(st.mode)) {
      C.toggle(c, { label: 'Velocity and acceleration arrows', get: () => dopt('showV', true), set: (v) => (st.showV = v), rebuild: false });
      return XU.diagram(c, C, st);
    }
    C.toggle(c, { label: 'Velocity arrows', get: () => dopt('showV', true), set: (v) => (st.showV = v), rebuild: false });
    C.toggle(c, { label: 'Acceleration arrows', get: () => dopt('showA', false), set: (v) => (st.showA = v), rebuild: false });
    if (st.mode !== 'fixed') C.toggle(c, { label: 'Instantaneous centre of zero velocity', get: () => dopt('ic', true), set: (v) => (st.ic = v), rebuild: false });
    if (st.mode === 'slider' || st.mode === 'fourbar' || st.mode === 'roll') C.toggle(c, { label: st.mode === 'roll' ? 'Path of P' : 'Path of the coupler midpoint', get: () => dopt('trace', false), set: (v) => (st.trace = v), rebuild: false });
  };

  M.compute = (U) => RbMotion.solve(S(), U);
  M.onUnits = (from, to) => RbMotion.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => (XU.MODES.includes(S().mode) ? XU.cap2D(S()) : { fixed: 'Wheels and point P', slider: 'Slider-crank', fourbar: 'Four-bar linkage', roll: 'Rolling body', bar: 'Bar on a wall and a floor' }[S().mode]);
  M.cap3D = () => '3D view';
  M.plotCaption = () => (XU.MODES.includes(S().mode) ? XU.plotCaption(S()) : { fixed: 'Angular velocity against time', slider: 'Slider velocity and acceleration over one turn of the crank', fourbar: 'Angular velocities over the crank angle', roll: 'Speed of P over one turn', bar: 'ω and v_B as the bar slides' }[S().mode]);
  M.hint = () => (XU.MODES.includes(S().mode) ? 'Press Play to run the mechanism. Arrows show the velocity (green) and acceleration (purple); acceleration arrows show at the instant asked for.' : 'Press Play to run the mechanism. Arrows show the velocity (green) and acceleration (purple) at the instant on the diagram; the dot marked IC is the instantaneous centre of zero velocity.');
  M.legend = () => (XU.MODES.includes(S().mode) ? XU.legend(S()) : [[K.vel, 'Velocity'], [K.acc, 'Acceleration'], [K.ic, 'Instantaneous centre'], [LINK, 'Links', 'ln']]);
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]), { idle: 'the instant asked for' });
  M.anim = () => motion;
  const uNow = () => S()._u;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const L2 = (a) => Math.hypot(a[0], a[1]);

  /** Angle of the driver at the animation fraction (full turns or a rocking motion inside the range it can reach). */
  function driverAngle(g, th0, ok, sgn) {
    const u = uNow(); if (u === undefined) return th0;
    if (g.full) return th0 + sgn * TAU * u;
    let lo = th0, hi = th0; const stp = TAU / 720;
    for (let i = 0; i < 360 && ok(lo - stp); i++) lo -= stp;
    for (let i = 0; i < 360 && ok(hi + stp); i++) hi += stp;
    const mid = (lo + hi) / 2, amp = (hi - lo) / 2 * 0.98, ph = Math.asin(Math.max(-1, Math.min(1, (th0 - mid) / (amp || 1))));
    return mid + amp * Math.sin(ph + sgn * TAU * u);
  }

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (XU.MODES.includes(g.mode)) return XU.draw2D(svg, g, opt, uNow(), S());
    return ({ fixed: fixed2D, slider: slider2D, fourbar: fourbar2D, roll: roll2D, bar: bar2D })[g.mode](svg, g, opt);
  };
  const link = (D, a, b, w) => { D.line(a, b, { stroke: LINK, sw: w || 7 }); D.line(a, b, { stroke: '#aab7c4', sw: (w || 7) - 3 }); };
  const joint = (D, p) => D.circle(p, 4.5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.5 });
  const name = (D, p, s, dx, dy) => D.text(p, s, { dx: dx === undefined ? 8 : dx, dy: dy === undefined ? -8 : dy, color: K.ink, size: 12.5, weight: 700 });
  const icMark = (D, p, opt, pts) => {
    if (!p || !isFinite(p[0]) || !dopt('ic', true)) return;
    (pts || []).forEach((q) => D.line(p, q, { stroke: K.ic, sw: 1.2, dash: '5 4' }));
    D.circle(p, 5 / D.sc, { fill: K.ic, stroke: '#fff', sw: 1.5 }); D.text(p, 'IC', { dx: 8, dy: 14, color: K.ic, size: 12, weight: 700 });
  };
  /** Velocity and acceleration arrows at a point, scaled by the largest values on the diagram. */
  function arrows(D, p, v, a, vmax, amax, opt, nm, u) {
    const flat = (q) => q && Math.abs(q[1]) < 0.2 * L2(q); // horizontal arrows put their label underneath, clear of the links
    if (dopt('showV', true) && L2(v) > 1e-9 * vmax) DYUI.vec(D, p, v, 24 + 70 * L2(v) / vmax, { color: K.vel, label: lbl(opt, `v_${nm} = ${fmt(L2(v))} ${u.V}`, `v_${nm}`), size: 11.5, anchor: v[0] < 0 ? 'end' : 'start', ldx: v[0] < 0 ? -6 : 6, ldy: flat(v) ? 18 : undefined });
    if (dopt('showA', false) && a && L2(a) > 1e-9 * amax) DYUI.vec(D, p, a, 24 + 70 * L2(a) / amax, { color: K.acc, label: lbl(opt, `a_${nm} = ${fmt(L2(a))} ${u.A}`, `a_${nm}`), size: 11.5, anchor: a[0] < 0 ? 'end' : 'start', ldx: a[0] < 0 ? -6 : 6, ldy: flat(a) ? 32 : 14 });
  }
  const bbox = (pts, padf) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = Math.max(x1 - x0, y1 - y0, 1e-6) * (padf || 0.3); return { xmin: x0 - s, xmax: x1 + s, ymin: y0 - s, ymax: y1 + s }; };

  function fixed2D(svg, g, opt) {
    const u = g.u, two = g.link !== 'none', gap = g.link === 'gear' ? g.rA + g.rB : (g.rA + g.rB) * 1.6, cA = [0, 0], cB = [gap, 0];
    const D = UI.Draw2D(svg, bbox([[-g.rA, -g.rA], [g.rA, g.rA]].concat(two ? [[gap - g.rB, -g.rB], [gap + g.rB, g.rB]] : []), 0.35), { pad: 26 });
    const t = uNow() === undefined ? g.t : g.span[1] * uNow(), thA = g.thA(t), thB = g.sgn * g.ratio * thA, wA = g.w0 + g.al * t, wB = g.sgn * g.ratio * wA;
    if (g.link === 'belt') { const d = gap, s = (g.rA - g.rB) / d, c = Math.sqrt(Math.max(0, 1 - s * s)); [1, -1].forEach((sg) => { const nrm = [s, sg * c]; D.line([cA[0] + nrm[0] * g.rA, cA[1] + nrm[1] * g.rA], [cB[0] + nrm[0] * g.rB, cB[1] + nrm[1] * g.rB], { stroke: K.ink, sw: 2 }); }); }
    DYUI.wheel(D, cA, g.rA, thA, { spokes: 4 }); D.text(cA, 'A', { dx: -14, dy: -10, color: K.ink, size: 13, weight: 700 });
    if (two) { DYUI.wheel(D, cB, g.rB, thB, { spokes: 4 }); D.text(cB, 'B', { dx: -14, dy: -10, color: K.ink, size: 13, weight: 700 }); }
    const body = g.body === 'A' ? { c: cA, th: thA, w: wA, al: g.al } : { c: cB, th: thB, w: wB, al: g.aB };
    const ph = body.th + Math.PI / 2, rp = [g.rP * Math.cos(ph), g.rP * Math.sin(ph)], P = [body.c[0] + rp[0], body.c[1] + rp[1]];
    const v = [-rp[1] * body.w, rp[0] * body.w], at = [-rp[1] * body.al, rp[0] * body.al], an = [-rp[0] * body.w * body.w, -rp[1] * body.w * body.w];
    D.circle(P, 5 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 }); name(D, P, 'P', 8, 14);
    const vmax = Math.max(L2(v), 1e-9), amax = Math.max(L2(at), L2(an), 1e-9);
    if (dopt('showV', true) && L2(v) > 1e-12) DYUI.vec(D, P, v, 70, { color: K.vel, label: lbl(opt, `v_P = ${fmt(L2(v))} ${u.V}`, 'v_P'), size: 11.5 });
    if (dopt('showA', false)) { if (L2(at) > 1e-9 * amax) DYUI.vec(D, P, at, 20 + 50 * L2(at) / amax, { color: K.acc, label: lbl(opt, `(a_P)_t = ${fmt(L2(at))}`, '(a_P)_t'), size: 11, ldy: 14 }); if (L2(an) > 1e-9 * amax) DYUI.vec(D, P, an, 20 + 50 * L2(an) / amax, { color: K.acc, label: lbl(opt, `(a_P)_n = ${fmt(L2(an))}`, '(a_P)_n'), size: 11 }); }
    DYUI.title(D, 12, 20, `t = ${fmt(t)} s:  ω_A = ${fmt(wA)} rad/s${two ? `,  ω_B = ${fmt(wB)} rad/s` : ''}`);
    return true;
  }

  function slider2D(svg, g, opt) {
    const u = g.u, sgn = Math.sign(g.wAB) || 1, th = driverAngle(g, g.th, (t) => !!g.at(t), sgn), k = g.at(th) || g.k;
    const all = []; for (let i = 0; i < 72; i++) { const q = g.at((i / 72) * TAU); if (q) all.push(q.B, q.C); }
    const ext = all.concat([[0, 0], g.k.B, g.k.C]), bb = bbox(ext, 0.28);
    const D = UI.Draw2D(svg, bb, { pad: 26 });
    const uu = k.uu, ww = k.ww, smin = Math.min(...all.map((p) => p[0] * uu[0] + p[1] * uu[1])), smax = Math.max(...all.map((p) => p[0] * uu[0] + p[1] * uu[1])), e = g.e;
    const gl = (s) => [uu[0] * s + ww[0] * e, uu[1] * s + ww[1] * e];
    D.line(gl(smin - g.l * 0.25), gl(smax + g.l * 0.25), { stroke: K.ink, sw: 1.2, dash: '8 5' });
    if (dopt('trace', false)) { const pts = []; for (let i = 0; i <= 120; i++) { const q = g.at((i / 120) * TAU); if (q) pts.push([(q.B[0] + q.C[0]) / 2, (q.B[1] + q.C[1]) / 2]); } D.pline(pts, { stroke: CA, sw: 1.2, dash: '3 3' }); }
    DYUI.pin(D, [0, 0], 0.09 * g.l);
    link(D, [0, 0], k.B); link(D, k.B, k.C);
    const bw = 0.32 * g.l, bh = 0.2 * g.l, corners = [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]].map(([a, b]) => [k.C[0] + uu[0] * a + ww[0] * b, k.C[1] + uu[1] * a + ww[1] * b]);
    D.poly(corners, { fill: K.body, stroke: K.edge, sw: 1.6 });
    joint(D, [0, 0]); joint(D, k.B); joint(D, k.C); name(D, [0, 0], 'A', 10, 16); name(D, k.B, 'B'); name(D, k.C, 'C', 12, -10);
    const vC = [uu[0] * k.vC, uu[1] * k.vC], aC = [uu[0] * k.aC, uu[1] * k.aC], vmax = Math.max(L2(k.vB), L2(vC), 1e-9), amax = Math.max(L2(k.aB), L2(aC), 1e-9);
    icMark(D, k.icBC, opt, [k.B, k.C]);
    arrows(D, k.B, k.vB, k.aB, vmax, amax, opt, 'B', u); arrows(D, k.C, vC, aC, vmax, amax, opt, 'C', u);
    DYUI.title(D, 12, 20, `θ = ${fmt(((th / D2R) % 360 + 360) % 360)}°:  ω_BC = ${fmt(k.wBC)} rad/s${uNow() === undefined ? `, α_BC = ${fmt(k.aBC)} rad/s²` : ''}`);
    return true;
  }

  function fourbar2D(svg, g, opt) {
    const u = g.u, sgn = Math.sign(g.w) || 1, th = driverAngle(g, g.th, (t) => !!g.at(t), sgn), k = g.at(th) || g.k;
    const all = [[0, 0], [g.d, 0], g.k.B, g.k.C]; for (let i = 0; i < 72; i++) { const q = g.at((i / 72) * TAU); if (q) all.push(q.B, q.C); }
    const D = UI.Draw2D(svg, bbox(all, 0.3), { pad: 26 });
    if (dopt('trace', false)) { const pts = []; for (let i = 0; i <= 180; i++) { const q = g.at((i / 180) * TAU); if (q) pts.push([(q.B[0] + q.C[0]) / 2, (q.B[1] + q.C[1]) / 2]); } D.pline(pts, { stroke: CA, sw: 1.2, dash: '3 3' }); }
    D.line([0, 0], [g.d, 0], { stroke: K.ink, sw: 1, dash: '6 4' });
    DYUI.pin(D, [0, 0], 0.1 * g.d); DYUI.pin(D, [g.d, 0], 0.1 * g.d);
    link(D, [0, 0], k.B); link(D, k.B, k.C); link(D, [g.d, 0], k.C);
    [[0, 0], k.B, k.C, [g.d, 0]].forEach((p) => joint(D, p));
    name(D, [0, 0], 'A', -16, 18); name(D, k.B, 'B'); name(D, k.C, 'C'); name(D, [g.d, 0], 'D', 10, 18);
    const vmax = Math.max(L2(k.vB), L2(k.vC), 1e-9), amax = Math.max(L2(k.aB), L2(k.aC), 1e-9);
    icMark(D, k.icBC, opt, [k.B, k.C]);
    arrows(D, k.B, k.vB, k.aB, vmax, amax, opt, 'B', u); arrows(D, k.C, k.vC, k.aC, vmax, amax, opt, 'C', u);
    DYUI.title(D, 12, 20, `θ = ${fmt(((th / D2R) % 360 + 360) % 360)}°:  ω_BC = ${fmt(k.wBC)},  ω_CD = ${fmt(k.wCD)} rad/s`);
    return true;
  }

  function roll2D(svg, g, opt) {
    const u = g.u, cord = g.surf === 'cord', R = g.R, Ro = g.Ro;
    const psi = uNow() === undefined ? 0 : (Math.sign(g.w) || 1) * Math.PI * uNow(); // rotation turned (half a turn per loop)
    const rG = [g.n[0] * R, g.n[1] * R], kx = (r) => [-r[1], r[0]], dG = [kx(rG)[0] * psi, kx(rG)[1] * psi];
    const span = Math.PI * R;
    const bb = cord ? { xmin: -Ro * 1.2, xmax: R + Ro * 1.8, ymin: Math.min(0, -span * (g.w < 0 ? 1 : 0)) - Ro * 1.5, ymax: Math.max(0, span * (g.w > 0 ? 1 : 0)) + Ro * 1.5 } : { xmin: Math.min(0, -span * (g.w > 0 ? 1 : 0)) - Ro * 1.5, xmax: Math.max(0, span * (g.w < 0 ? 1 : 0)) + Ro * 1.5, ymin: -Ro * 0.6, ymax: R + Ro * 1.8 };
    const D = UI.Draw2D(svg, bb, { pad: 26 });
    if (cord) { D.poly([[0, bb.ymax], [-Ro * 0.4, bb.ymax], [-Ro * 0.4, bb.ymax - Ro * 0.15], [0, bb.ymax - Ro * 0.15]], { fill: 'url(#hatch)', stroke: K.ink }); }
    else DYUI.ground(D, [bb.xmin, 0], [bb.xmax, 0], Ro * 0.15);
    const G = [rG[0] + dG[0], rG[1] + dG[1]], rot = (r, a) => [r[0] * Math.cos(a) - r[1] * Math.sin(a), r[0] * Math.sin(a) + r[1] * Math.cos(a)], rP = rot(g.rP, psi), P = [G[0] + rP[0], G[1] + rP[1]];
    if (dopt('trace', false)) { const pts = []; for (let i = 0; i <= 160; i++) { const s = (Math.sign(g.w) || 1) * TAU * 1.5 * (i / 160) - (Math.sign(g.w) || 1) * TAU * 0.25; const Gs = [rG[0] + kx(rG)[0] * s, rG[1] + kx(rG)[1] * s], r2 = rot(g.rP, s); pts.push([Gs[0] + r2[0], Gs[1] + r2[1]]); } D.pline(pts, { stroke: CA, sw: 1.2, dash: '3 3' }); }
    DYUI.wheel(D, G, Ro, psi, { spokes: 3, ri: R < Ro - 1e-9 ? R : 0 });
    const contact = [G[0] - g.n[0] * R, G[1] - g.n[1] * R];
    if (cord) D.line(contact, [contact[0], bb.ymax], { stroke: K.ink, sw: 2.5 });
    D.circle(G, 4 / D.sc, { fill: K.ink }); name(D, G, 'G', -14, -8);
    D.circle(P, 5 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 }); name(D, P, 'P', 8, 14);
    const w = g.w, al = g.al, vG = [kx(rG)[0] * w, kx(rG)[1] * w], aG = [kx(rG)[0] * al, kx(rG)[1] * al], vP = [vG[0] + kx(rP)[0] * w, vG[1] + kx(rP)[1] * w], aP = [aG[0] + kx(rP)[0] * al - rP[0] * w * w, aG[1] + kx(rP)[1] * al - rP[1] * w * w];
    const vmax = Math.max(L2(vG), L2(vP), 1e-9), amax = Math.max(L2(aG), L2(aP), 1e-9);
    icMark(D, contact, opt, [P]);
    arrows(D, G, vG, aG, vmax, amax, opt, 'G', u); arrows(D, P, vP, aP, vmax, amax, opt, 'P', u);
    D.arc(G, 26, 60, 60 + 270 * (Math.sign(w) || 1), null, { color: K.ink });
    DYUI.title(D, 12, 20, `${cord ? 'Unwinding down a fixed cord' : 'Rolling on a fixed floor'}:  ω = ${fmt(w)} rad/s${uNow() === undefined ? `, α = ${fmt(al)} rad/s²` : ''}`);
    return true;
  }

  function bar2D(svg, g, opt) {
    const u = g.u, th = uNow() === undefined ? g.th : Math.max(5 * D2R, Math.min(85 * D2R, g.th + 20 * D2R * Math.sin(TAU * uNow()))), k = g.at(th) || g.k, L = g.L;
    const D = UI.Draw2D(svg, { xmin: -0.35 * L, xmax: 1.45 * L, ymin: -0.3 * L, ymax: 1.25 * L }, { pad: 26 });
    D.poly([[-0.12 * L, -0.12 * L], [0, 0], [0, 1.15 * L], [-0.12 * L, 1.15 * L]], { fill: 'url(#hatch)', stroke: 'none' }); D.line([0, 0], [0, 1.15 * L], { stroke: K.ink, sw: 1.8 });
    DYUI.ground(D, [0, 0], [1.35 * L, 0], 0.12 * L);
    link(D, k.A, k.B, 8);
    const blk = (p, vert) => { const a = 0.07 * L, b = 0.045 * L; D.poly(vert ? [[p[0], p[1] - a], [p[0] + 2 * b, p[1] - a], [p[0] + 2 * b, p[1] + a], [p[0], p[1] + a]] : [[p[0] - a, p[1]], [p[0] + a, p[1]], [p[0] + a, p[1] + 2 * b], [p[0] - a, p[1] + 2 * b]], { fill: K.body, stroke: K.edge, sw: 1.4 }); };
    blk(k.A, true); blk(k.B, false); joint(D, k.A); joint(D, k.B); name(D, k.A, 'A', 14, -8); name(D, k.B, 'B', 8, -12);
    const vB = [k.vB, 0], aB = [k.aB, 0], vmax = Math.max(Math.abs(g.vA), Math.abs(k.vB), 1e-9), amax = Math.max(Math.abs(g.aA), Math.abs(k.aB), 1e-9);
    icMark(D, k.ic, opt, [k.A, k.B]);
    arrows(D, k.A, k.vA, k.aA, vmax, amax, opt, 'A', u); arrows(D, k.B, vB, aB, vmax, amax, opt, 'B', u);
    D.arc(k.B, 34, 180 - th / D2R, 180, `θ = ${fmt(th / D2R)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, `ω = ${fmt(k.w)} rad/s${uNow() === undefined ? `, α = ${fmt(k.al)} rad/s²` : ''}`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u;
    if (XU.MODES.includes(g.mode)) return XU.plot(svg, g, uNow());
    if (g.mode === 'fixed') {
      const T = g.span[1], a = [], b = []; for (let i = 0; i <= 100; i++) { const t = (T * i) / 100, w = g.w0 + g.al * t; a.push([t, w]); b.push([t, g.sgn * g.ratio * w]); }
      const cur = uNow() === undefined ? g.t : T * uNow();
      return DYUI.stack(svg, [{ label: 'ω (rad/s)', color: CA, pts: a, at: (t) => g.w0 + g.al * t, more: g.link !== 'none' ? [{ pts: b, color: CB, at: (t) => g.sgn * g.ratio * (g.w0 + g.al * t) }] : undefined }], { xlabel: 't (s)   blue: A, orange: B', cursor: cur, xmin: 0, xmax: T });
    }
    if (g.mode === 'slider' || g.mode === 'fourbar') {
      const p1 = [], p2 = [];
      for (let i = 0; i <= 360; i++) { const t = (i / 360) * TAU, q = g.at(t); if (!q) continue; if (g.mode === 'slider') { p1.push([i, q.vC]); p2.push([i, q.aC]); } else { p1.push([i, q.wBC]); p2.push([i, q.wCD]); } }
      const th = uNow() === undefined ? g.th : driverAngle(g, g.th, (t) => !!g.at(t), Math.sign(g.mode === 'slider' ? g.wAB : g.w) || 1), cur = ((th / D2R) % 360 + 360) % 360;
      const f1 = (x) => { const q = g.at(x * D2R); return q ? (g.mode === 'slider' ? q.vC : q.wBC) : NaN; }, f2 = (x) => { const q = g.at(x * D2R); return q ? (g.mode === 'slider' ? q.aC : q.wCD) : NaN; };
      return DYUI.stack(svg, g.mode === 'slider' ? [{ label: `v_C (${u.V})`, color: K.vel, pts: p1, at: f1 }, { label: `a_C (${u.A})`, color: K.acc, pts: p2, at: f2 }] : [{ label: 'ω_BC (rad/s)', color: CA, pts: p1, at: f1 }, { label: 'ω_CD (rad/s)', color: CB, pts: p2, at: f2 }], { xlabel: 'crank angle θ (°)', cursor: cur, xmin: 0, xmax: 360 });
    }
    if (g.mode === 'roll') {
      const pts = [], kx = (r) => [-r[1], r[0]], rG = [g.n[0] * g.R, g.n[1] * g.R], vG = [kx(rG)[0] * g.w, kx(rG)[1] * g.w];
      const sp = (deg) => { const a = (Math.sign(g.w) || 1) * deg * D2R, r = [g.rP[0] * Math.cos(a) - g.rP[1] * Math.sin(a), g.rP[0] * Math.sin(a) + g.rP[1] * Math.cos(a)]; return L2([vG[0] + kx(r)[0] * g.w, vG[1] + kx(r)[1] * g.w]); };
      for (let i = 0; i <= 360; i++) pts.push([i, sp(i)]);
      return DYUI.stack(svg, [{ label: `v_P (${u.V})`, color: K.vel, pts, at: sp }], { xlabel: 'angle turned (°)', cursor: uNow() === undefined ? 0 : 360 * uNow(), xmin: 0, xmax: 360 });
    }
    const p1 = [], p2 = []; for (let i = 5; i <= 85; i++) { const q = g.at(i * D2R); p1.push([i, q.w]); p2.push([i, q.vB]); }
    const th = uNow() === undefined ? g.th : Math.max(5 * D2R, Math.min(85 * D2R, g.th + 20 * D2R * Math.sin(TAU * uNow())));
    return DYUI.stack(svg, [{ label: 'ω (rad/s)', color: CA, pts: p1, at: (x) => g.at(x * D2R).w }, { label: `v_B (${u.V})`, color: K.vel, pts: p2, at: (x) => g.at(x * D2R).vB }], { xlabel: 'θ (°), same v_A', cursor: th / D2R, xmin: 5, xmax: 85 });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  function slab(v, a, b, w, z0, z1, col) {
    const d = [b[0] - a[0], b[1] - a[1]], l = L2(d) || 1, n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2];
    v.extrude([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], z0, z1, col, 1, K.edge);
  }
  function disk(v, c, R, z0, z1, col, th) {
    const n = 32, poly = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; poly.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]); }
    v.extrude(poly, z0, z1, col, 1, null);
    v.line([[c[0], c[1], z1 + 1e-3], [c[0] + R * Math.cos(th || 0), c[1] + R * Math.sin(th || 0), z1 + 1e-3]], K.ink, 2);
  }
  M.draw3D = function (v, res) {
    const g = res.geo;
    if (XU.MODES.includes(g.mode)) return XU.draw3D(v, g, uNow());
    if (g.mode === 'fixed') {
      const two = g.link !== 'none', gap = g.link === 'gear' ? g.rA + g.rB : (g.rA + g.rB) * 1.6, t = uNow() === undefined ? g.t : g.span[1] * uNow(), thA = g.thA(t), thB = g.sgn * g.ratio * thA, h = Math.max(g.rA, g.rB) * 0.25;
      disk(v, [0, 0], g.rA, -h / 2, h / 2, '#c3cbd3', thA); if (two) disk(v, [gap, 0], g.rB, -h / 2, h / 2, '#d5dbe1', thB);
      if (g.link === 'belt') { const sn = (g.rA - g.rB) / gap, cs = Math.sqrt(Math.max(0, 1 - sn * sn)); [1, -1].forEach((sg) => { const p0 = [sn * g.rA, sg * cs * g.rA], p1 = [gap + sn * g.rB, sg * cs * g.rB], z = h * 0.4; v.face([[p0[0], p0[1], z], [p1[0], p1[1], z], [p1[0], p1[1], -z], [p0[0], p0[1], -z]], '#4d5b69', 1, K.ink); }); }
      const R = Math.max(g.rA, two ? g.rB : 0); v.setBounds([-g.rA * 1.2, -R * 1.2, -R], [(two ? gap + g.rB : g.rA) * 1.2, R * 1.2, R]); return;
    }
    if (g.mode === 'slider' || g.mode === 'fourbar') {
      const sgn = Math.sign(g.mode === 'slider' ? g.wAB : g.w) || 1, th = driverAngle(g, g.th, (t) => !!g.at(t), sgn), k = g.at(th) || g.k, sc = g.mode === 'slider' ? g.l : g.d, w = 0.06 * sc;
      slab(v, [0, 0], k.B, w, 0, w * 0.6, '#aab7c4'); slab(v, k.B, k.C, w, w * 0.6, w * 1.2, '#c3cbd3');
      if (g.mode === 'fourbar') slab(v, [g.d, 0], k.C, w, 0, w * 0.6, '#aab7c4');
      else { const bw = 0.32 * g.l, bh = 0.2 * g.l, uu = k.uu, ww = k.ww; v.extrude([[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]].map(([a, b]) => [k.C[0] + uu[0] * a + ww[0] * b, k.C[1] + uu[1] * a + ww[1] * b]), -w * 0.6, w * 1.8, K.body, 1, K.edge); }
      const all = [[0, 0], g.k.B, g.k.C]; for (let i = 0; i < 36; i++) { const q = g.at((i / 36) * TAU); if (q) all.push(q.B, q.C); }
      const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]), m = 0.15 * sc; v.setBounds([Math.min(...xs) - m, Math.min(...ys) - m, -sc * 0.3], [Math.max(...xs) + m, Math.max(...ys) + m, sc * 0.3]); return;
    }
    if (g.mode === 'roll') {
      const psi = uNow() === undefined ? 0 : (Math.sign(g.w) || 1) * Math.PI * uNow(), rG = [g.n[0] * g.R, g.n[1] * g.R], G = [rG[0] - rG[1] * psi, rG[1] + rG[0] * psi], h = g.Ro * 0.5;
      disk(v, G, g.Ro, -h / 2, h / 2, '#c3cbd3', psi);
      const span = Math.PI * g.R + g.Ro;
      if (g.surf === 'cord') { v.line([[0, G[1] + Math.sqrt(Math.max(0, g.Ro * g.Ro - g.R * g.R)), 0], [0, span + g.Ro, 0]], K.ink, 2); v.setBounds([-g.Ro, -span - g.Ro, -g.Ro], [2 * g.Ro + g.R, span + g.Ro, g.Ro]); }
      else { DYUI.floor3(v, -span - g.Ro, span + g.Ro, 0, g.Ro); v.setBounds([-span - g.Ro, 0, -g.Ro], [span + g.Ro, 2 * g.Ro + g.R, g.Ro]); }
      return;
    }
    const th = uNow() === undefined ? g.th : Math.max(5 * D2R, Math.min(85 * D2R, g.th + 20 * D2R * Math.sin(TAU * uNow()))), k = g.at(th) || g.k, L = g.L, w = 0.05 * L;
    v.box(-0.08 * L, 0, -0.3 * L, 0, 1.15 * L, 0.3 * L, '#d5dbe1', 1, K.edge); v.box(-0.08 * L, -0.04 * L, -0.3 * L, 1.35 * L, 0, 0.3 * L, '#d5dbe1', 1, K.edge);
    slab(v, k.A, k.B, w, -w / 2, w / 2, '#aab7c4');
    v.setBounds([-0.1 * L, 0, -0.3 * L], [1.35 * L, 1.15 * L, 0.3 * L]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(RbMotion.defaults(), o);
  M.presets = [
    { name: 'Test: Book Examples 16.12 and 16.17, crank 0.25 ft at 10 rad/s cw and 20 rad/s² cw, rod 0.75 ft (v_C = 2.20 ft/s, a_C = −13.5 ft/s²)', units: 'US', state: P0({ mode: 'slider', r: 0.25, l: 0.75, th: 45, beta: 90, e: 0, wAB: -10, aAB: -20 }),
      expect: [{ k: 'Velocity of the slider v_C', v: 2.197 }, { k: 'Angular velocity of BC, ω_BC', v: 2.425 }, { k: 'Angular acceleration of BC, α_BC', v: 27.68 }, { k: 'Acceleration of the slider a_C', v: -13.54 }] },
    { name: 'Test: Book Example 16.6, 0.2 m link in two slots, v_A = 2 m/s down at 45° (ω = 14.1 rad/s, v_B = 2 m/s)', units: 'SI', state: P0({ mode: 'bar', L: 0.2, thb: 45, vA: 2, aA: 0 }),
      expect: [{ k: 'Angular velocity ω', v: 14.14 }, { k: 'Velocity of B, v_B', v: 2 }] },
    { name: 'Test: Book Example 16.14, disk 0.5 ft rolling at 6 rad/s, 4 rad/s², acceleration of the contact point (18 ft/s²)', units: 'US', state: P0({ mode: 'roll', surf: 'floor', R: 0.5, Ro: 0.5, w: -6, alr: -4, rho: 0.5, phi: 270 }),
      expect: [{ k: 'Acceleration of P, a_P', v: 18 }] },
    { name: 'Test: Book Example 16.15, spool unwinding at 3 rad/s and 4 rad/s², point B at 0.75 ft (a_B = 9.25 ft/s²)', units: 'US', state: P0({ mode: 'roll', surf: 'cord', R: 0.5, Ro: 0.75, w: -3, alr: -4, rho: 0.75, phi: 90 }),
      expect: [{ k: 'Acceleration of P, a_P', v: 9.25 }, { k: 'Direction of a_P from +x', v: -71.08 }] },
    { name: 'Test: Book Example 16.2, belt drive from rest at 2 rad/s² for 2 turns (v_P = 1.06 m/s, a_P = 2.84 m/s²)', units: 'SI', state: P0({ mode: 'fixed', w0: 0, al: 2, by: 'rev', rev: 2, rA: 0.15, rB: 0.4, link: 'belt', rP: 0.4 }),
      expect: [{ k: 'Speed of P, v_P', v: 1.063 }, { k: 'Acceleration of P, a_P', v: 2.843 }] },
    { name: 'Test: 50 mm gear at 120 rad/s drives a 150 mm gear (ω_B = −40 rad/s)', units: 'SI', state: P0({ mode: 'fixed', w0: 120, al: 0, by: 'time', tt: 0.2, rA: 0.05, rB: 0.15, link: 'gear', rP: 0.15 }),
      expect: [{ k: 'Angular velocity of B, ω_B', v: -40 }, { k: 'Speed of P, v_P', v: 6 }] },
    { name: 'Test: four-bar 100/250/200/250 mm, crank at 60° and 10 rad/s (ω_BC = −1.89, ω_CD = 3.29 rad/s)', units: 'SI', state: P0({ mode: 'fourbar', a4: 0.1, b4: 0.25, c4: 0.2, d4: 0.25, th4: 60, w4: 10, al4: 5 }),
      expect: [{ k: 'Angular velocity of BC, ω_BC', v: -1.891 }, { k: 'Angular velocity of CD, ω_CD', v: 3.294 }, { k: 'Angular acceleration of CD, α_CD', v: 49.84 }] },
    { name: 'Engine: 60 mm crank, 200 mm rod, horizontal slider, 300 rad/s', units: 'SI', state: P0({ mode: 'slider', r: 0.06, l: 0.2, th: 60, beta: 0, e: 0, wAB: 300, aAB: 0 }) },
    { name: 'Offset slider-crank (quick return)', units: 'SI', state: P0({ mode: 'slider', r: 0.1, l: 0.35, th: 120, beta: 0, e: 0.05, wAB: 5, aAB: 0 }) },
    { name: 'Ladder 4 m at 60°, top sliding down at 1.5 m/s and speeding up', units: 'SI', state: P0({ mode: 'bar', L: 4, thb: 60, vA: 1.5, aA: 0.5 }) },
    { name: 'Edge: connecting rod shorter than the crank offset (fails on purpose)', units: 'SI', fails: true, state: P0({ mode: 'slider', r: 0.2, l: 0.1, th: 90, beta: 0, e: 0, wAB: 5, aAB: 0 }) },
  ].concat(XU.presets(P0));

  root.DRbMotion = M;
})(window);
