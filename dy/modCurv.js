/* =====================================================================
 * DYNAMICS · D2 Curvilinear Motion and Projectiles (inputs, diagrams,
 * presets). Physics: dy/curv.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Curv, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', REL = '#111111', D2R = Math.PI / 180;

  const M = { id: 'curv', title: 'Curvilinear Motion and Projectiles', defaults: Curv.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, o, k, label, unit) => C.num(sec, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Motion', get: () => st.mode, set: (v) => (st.mode = v), options: [['proj', 'Projectile'], ['path', 'Path y = f(x) or a circle: normal and tangential components'], ['cyl', 'Cylindrical (polar) components r(t), θ(t)'], ['rel', 'Relative motion of two particles']] });
    if (st.mode === 'proj') {
      C.seg(sec, { label: 'Find', get: () => st.find, set: (v) => (st.find = v), options: [['fwd', 'The path'], ['v0', 'Launch speed'], ['theta', 'Launch angle']] });
      sec = C.section(c, 'Launch');
      num(sec, st, 'h0', 'Launch height above the ground', u.L);
      if (st.find !== 'v0') num(sec, st, 'v0', 'Launch speed v₀', u.V);
      if (st.find !== 'theta') num(sec, st, 'th', 'Launch angle θ above the horizontal', '°');
      sec = C.section(c, st.find === 'fwd' ? 'Where it lands' : 'Target');
      if (st.find === 'v0') C.seg(sec, { label: 'Known', get: () => st.by, set: (v) => (st.by = v), options: [['point', 'Landing point'], ['time', 'Flight time']] });
      if (st.find === 'fwd') {
        C.select(sec, { label: 'Lands on', get: () => st.land, set: (v) => (st.land = v), options: [['level', 'Level ground or a level surface'], ['slope', 'A slope rising from the origin'], ['x', 'A pile or wall at a horizontal distance (find the height)']] });
        if (st.land === 'level') num(sec, st, 'yT', 'Height of the landing surface', u.L);
        if (st.land === 'slope') num(sec, st, 'beta', 'Slope angle β', '°');
        if (st.land === 'x') num(sec, st, 'd', 'Horizontal distance', u.L);
      } else if (st.find === 'v0' && st.by === 'time') {
        num(sec, st, 'T', 'Flight time', 's'); num(sec, st, 'yT', 'Height of the landing surface', u.L);
      } else {
        num(sec, st, 'd', 'Horizontal distance to the point', u.L); num(sec, st, 'yT', 'Height of the point above the ground', u.L);
        if (st.find === 'theta') C.seg(sec, { label: 'Draw', get: () => st.pick || 'low', set: (v) => (st.pick = v), options: [['low', 'Low angle'], ['high', 'High angle']] });
      }
      sec = C.section(c, 'Wall to clear');
      C.toggle(sec, { label: 'Check a wall on the way', get: () => st.wall, set: (v) => (st.wall = v) });
      if (st.wall) { num(sec, st, 'dw', 'Distance to the wall', u.L); num(sec, st, 'hw', 'Height of the wall', u.L); }
    } else if (st.mode === 'path') {
      C.seg(sec, { label: 'Path', get: () => st.ptype, set: (v) => (st.ptype = v), options: [['poly', 'y = f(x)'], ['circle', 'Circle']] });
      if (st.ptype === 'poly') {
        C.note(sec, `y = c₀ + c₁x + c₂x² + c₃x³ (${u.L})`);
        ['c₀', 'c₁', 'c₂', 'c₃'].forEach((n, i) => C.num(sec, { label: n, get: () => st.c[i], set: (v) => (st.c[i] = v) }));
        num(sec, st, 'x', 'At the point x', u.L);
      } else num(sec, st, 'rho', 'Radius of the path ρ', u.L);
      sec = C.section(c, 'Motion at that point');
      num(sec, st, 'v', 'Speed v', u.V); num(sec, st, 'at', 'Rate of change of speed a_t = v̇', u.A);
    } else if (st.mode === 'cyl') {
      sec = C.section(c, 'Position as functions of time');
      C.note(sec, `r = c₀ + c₁t + c₂t² + c₃t³ (${u.L})`);
      ['c₀', 'c₁', 'c₂', 'c₃'].forEach((n, i) => C.num(sec, { label: 'r: ' + n, get: () => st.cr[i], set: (v) => (st.cr[i] = v) }));
      C.note(sec, 'θ = c₀ + c₁t + c₂t² + c₃t³ (rad)');
      ['c₀', 'c₁', 'c₂', 'c₃'].forEach((n, i) => C.num(sec, { label: 'θ: ' + n, get: () => st.cth[i], set: (v) => (st.cth[i] = v) }));
      num(sec, st, 't', 'Instant t', 's');
    } else {
      [['A', st.A], ['B', st.B]].forEach(([n, o]) => {
        sec = C.section(c, `Particle ${n}`);
        num(sec, o, 'x', 'Position x', u.L); num(sec, o, 'y', 'Position y', u.L);
        num(sec, o, 'v', 'Speed v', u.V); num(sec, o, 'dir', 'Direction of motion (from +x, counterclockwise)', '°');
        num(sec, o, 'at', 'Rate of change of speed a_t', u.A);
        num(sec, o, 'rho', 'Radius of its path (0 = straight)', u.L);
        if (+o.rho > 0) C.seg(sec, { label: 'Turning', get: () => o.turn, set: (v) => (o.turn = v), options: [['left', 'Left'], ['right', 'Right']] });
      });
    }
  };
  M.diagram = function (c, C) {
    const st = S(), m = st.mode;
    C.toggle(c, { label: 'Velocity arrows', get: () => dopt('showV', true), set: (v) => (st.showV = v), rebuild: false });
    C.toggle(c, { label: 'Acceleration arrows', get: () => dopt('showA', true), set: (v) => (st.showA = v), rebuild: false });
    if (m === 'proj' || m === 'cyl') C.toggle(c, { label: 'Components of the arrows', get: () => dopt('comp', false), set: (v) => (st.comp = v), rebuild: false });
    if (m === 'proj') { C.toggle(c, { label: 'Positions at equal time steps', get: () => dopt('strobe', true), set: (v) => (st.strobe = v), rebuild: false }); C.toggle(c, { label: 'Dimensions (range, heights)', get: () => dopt('dims', true), set: (v) => (st.dims = v), rebuild: false }); }
    if (m === 'path') C.toggle(c, { label: 'Circle of curvature', get: () => dopt('osc', true), set: (v) => (st.osc = v), rebuild: false });
    if (m === 'rel') C.toggle(c, { label: 'Vector triangle at B', get: () => dopt('tri', true), set: (v) => (st.tri = v), rebuild: false });
  };

  M.compute = (U) => Curv.solve(S(), U);
  M.onUnits = (from, to) => Curv.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ proj: 'Trajectory', path: 'Path with n and t axes', cyl: 'Path in polar coordinates', rel: 'Two particles and the relative vectors' }[S().mode]);
  M.cap3D = () => '3D view';
  M.plotCaption = () => ({ proj: 'Height, velocity components and speed against time', path: 'Radius of curvature and normal acceleration along the path', cyl: 'r, θ and speed against time' }[S().mode] || '');
  M.plotTall = () => S().mode !== 'path';
  M.hint = () => ({
    proj: 'The launch velocity, the highest point and the landing velocity are drawn; press Play to fly the projectile with its velocity (green, with components) and acceleration g (magenta).',
    path: 'The particle is drawn with its tangent t and normal n axes, a_t, a_n and the total a, and the circle of curvature. Press Play to move it along the path at the same speed: a_n = v²/ρ changes with ρ.',
    cyl: 'Radial and transverse directions are drawn at the particle (u_r along the radial line, u_θ at 90° to it). Press Play to follow r(t), θ(t).',
    rel: 'v_B/A and a_B/A are what an observer moving with A (without rotating) sees. Press Play to move both particles along their paths.',
  }[S().mode]);
  M.legend = () => (S().mode === 'rel' ? [[CA, 'A'], [CB, 'B'], [K.vel, 'Velocity'], [K.acc, 'Acceleration'], [REL, 'Relative (B/A)']] : [[K.path, 'Path'], [K.vel, 'Velocity'], [K.acc, 'Acceleration']]);
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]), { idle: 'whole path' });
  M.anim = () => motion;
  const uNow = () => S()._u;
  const lbl = (opt, a, b) => (opt.showP ? a : b);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.mode === 'proj') return proj2D(svg, g, opt);
    if (g.mode === 'path') return path2D(svg, g, opt);
    if (g.mode === 'cyl') return cyl2D(svg, g, opt);
    return rel2D(svg, g, opt);
  };
  function projBounds(g) {
    let x0 = 0, x1 = Math.max(g.xL, 1e-6), y0 = 0, y1 = Math.max(g.h0, g.yTop, g.yL, 0);
    if (g.wall) { x1 = Math.max(x1, g.wall.dw); y1 = Math.max(y1, g.wall.hw); }
    y0 = Math.min(y0, g.yL, g.h0); const span = Math.max(x1 - x0, y1 - y0, 1e-6);
    return { x0: x0 - span * 0.06, x1: x1 + span * 0.08, y0: y0 - span * 0.04, y1: y1 + span * 0.08, span };
  }
  function proj2D(svg, g, opt) {
    const u = g.u, b = projBounds(g), box = (e) => ({ xmin: b.x0 - e * 0.4, xmax: b.x1 + e, ymin: b.y0 - e * 0.5, ymax: b.y1 + e * 0.3 });
    const D = UI.Draw2D(svg, box(110 / UI.Draw2D(svg, box(0), { pad: 40 }).sc), { pad: 40 }), px = (w) => w / D.sc;
    // ground or slope
    if (g.surf.kind === 'slope') { const xe = b.x1; DYUI.ground(D, [Math.min(0, b.x0), Math.min(0, b.x0) * g.surf.tb], [xe, xe * g.surf.tb]); D.arc([0, 0], 40, 0, g.beta, `β = ${fmt(g.beta)}°`); D.line([0, 0], [px(60), 0], { stroke: K.ink, sw: 1, dash: '4 3' }); }
    else DYUI.ground(D, [b.x0, Math.min(0, g.surf.kind === 'level' ? g.surf.y : 0)], [b.x1, Math.min(0, g.surf.kind === 'level' ? g.surf.y : 0)]);
    if (g.surf.kind === 'level' && Math.abs(g.surf.y) > 1e-9) { const y = g.surf.y; if (y > 0) D.poly([[g.xL - b.span * 0.08, 0], [b.x1, 0], [b.x1, y], [g.xL - b.span * 0.08, y]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1.2 }); D.line([g.xL - b.span * 0.08, y], [b.x1, y], { stroke: K.ink, sw: 1.8 }); }
    if (g.surf.kind === 'x') { const w = b.span * 0.05; D.poly([[g.xL - w * 0.2, 0], [g.xL + w * 1.5, 0], [g.xL + w * 1.5, g.yL], [g.xL - w * 0.2, g.yL]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1.2 }); D.line([g.xL - w * 0.2, g.yL], [g.xL + w * 1.5, g.yL], { stroke: K.ink, sw: 1.8 }); }
    if (g.h0 > 0) { const w = b.span * 0.035; D.poly([[-w, 0], [0, 0], [0, g.h0], [-w, g.h0]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1.2 }); }
    if (g.wall) D.poly([[g.wall.dw - b.span * 0.008, 0], [g.wall.dw + b.span * 0.008, 0], [g.wall.dw + b.span * 0.008, g.wall.hw], [g.wall.dw - b.span * 0.008, g.wall.hw]], { fill: '#7f8c8d', stroke: K.ink, sw: 1 });
    // trajectory
    const pts = []; for (let i = 0; i <= 160; i++) { const t = (g.T * i) / 160; pts.push([g.X(t), g.Y(t)]); }
    D.pline(pts, { stroke: K.path, sw: 2.2, dash: '7 4' });
    if (dopt('strobe', true)) for (let i = 1; i < 10; i++) { const t = (g.T * i) / 10; D.circle([g.X(t), g.Y(t)], px(4), { fill: '#fff', stroke: K.path, sw: 1.3 }); }
    DYUI.axes(D, D.inv(D.W - 60, 64), px(32));
    const vmax = Math.max(Math.hypot(g.vx, g.vy), Math.hypot(g.vx, g.vy - g.u.g * g.T), 1e-9), Lv = (v) => 30 + 80 * Math.abs(v) / vmax;
    const ball = (t, full) => {
      const p = [g.X(t), g.Y(t)], vy = g.vy - g.u.g * t, sp = Math.hypot(g.vx, vy);
      if (dopt('showV', true) && sp > 1e-9) {
        DYUI.vec(D, p, [g.vx, vy], Lv(sp), { color: K.vel, label: lbl(opt, `v = ${fmt(sp)} ${u.V}`, 'v'), size: 12, anchor: 'start', ldx: 6, ldy: vy > 0 ? -6 : 14 });
        if (dopt('comp', false)) { DYUI.vec(D, p, [Math.sign(g.vx) || 1, 0], Lv(g.vx), { color: K.vel, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `vₓ = ${fmt(g.vx)}`, 'vₓ'), size: 11, anchor: 'start', ldx: 4, ldy: 14 }); if (Math.abs(vy) > 1e-9) DYUI.vec(D, p, [0, Math.sign(vy)], Lv(vy), { color: K.vel, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `vᵧ = ${fmt(vy)}`, 'vᵧ'), size: 11, anchor: 'end', ldx: -6 }); }
      }
      if (full && dopt('showA', true)) DYUI.vec(D, [p[0] + px(14), p[1]], [0, -1], 46, { color: K.acc, label: lbl(opt, `g = ${fmt(g.u.g)} ${u.A}`, 'g'), size: 11.5, anchor: 'start', ldx: 6, ldy: 4 });
      D.circle(p, px(7.5), { fill: K.path, stroke: '#fff', sw: 2 });
    };
    if (uNow() !== undefined) ball(g.T * uNow(), true);
    else {
      // launch: v₀ with its angle; landing: the velocity there; the highest point
      ball(0, true); ball(g.T, false);
      if (Math.abs(g.th) > 0.5) D.arc([0, g.h0], 34, 0, g.th, `θ = ${fmt(g.th)}°`);
      if (g.vy > 0) D.dot([g.X(g.tTop), g.yTop], K.ink, lbl(opt, `highest, ${fmt(g.yTop)} ${u.L}`, 'highest'), { r: 3.5, dx: 6, dy: -8 });
    }
    if (dopt('dims', true)) {
      const yd = Math.min(0, g.yL, g.surf.kind === 'level' ? g.surf.y : 0) - px(26);
      D.dim([0, yd], [g.xL, yd], lbl(opt, `R = ${fmt(g.xL)} ${u.L}`, 'R'), 0);
      if (g.h0 > 0) D.dim([-px(30), 0], [-px(30), g.h0], lbl(opt, `${fmt(g.h0)} ${u.L}`, 'h₀'), 0, { anchor: 'end', ldx: -6 });
      if (Math.abs(g.yL) > 1e-9 && g.surf.kind !== 'slope') D.dim([g.xL + px(34), 0], [g.xL + px(34), g.yL], lbl(opt, `${fmt(g.yL)} ${u.L}`, 'h'), 0, { anchor: 'start', ldx: 6 });
      if (g.wall) D.text([g.wall.dw, g.wall.hw], lbl(opt, `wall ${fmt(g.wall.hw)} ${u.L}; ${g.wall.clr >= 0 ? 'clears by' : 'short by'} ${fmt(Math.abs(g.wall.clr))}`, 'wall'), { anchor: 'middle', dy: -8, color: g.wall.clr >= 0 ? K.ink : '#c0392b', size: 11.5 });
    }
    DYUI.title(D, 12, 20, uNow() === undefined ? `Flight time ${fmt(g.T)} s` : `t = ${fmt(g.T * uNow())} s`);
    return true;
  }

  /** Point, tangent and curvature on the path at parameter p (x for y = f(x), angle for a circle). */
  function pathAt(g, p) {
    if (g.kind === 'circle') { const th = p; return { pos: [g.rho * Math.cos(th), g.rho * Math.sin(th)], t: [-Math.sin(th), Math.cos(th)], n: [-Math.cos(th), -Math.sin(th)], rho: g.rho }; }
    const d1 = DY.pder(g.c), d2 = DY.pder(d1), y1 = DY.peval(d1, p), y2 = d2.length ? DY.peval(d2, p) : 0, l = Math.hypot(1, y1);
    const t = [1 / l, y1 / l], sg = y2 >= 0 ? 1 : -1, n = [-t[1] * sg, t[0] * sg];
    return { pos: [p, DY.peval(g.c, p)], t, n, rho: Math.abs(y2) > 1e-12 ? Math.pow(1 + y1 * y1, 1.5) / Math.abs(y2) : Infinity };
  }
  function pathRange(g) {
    if (g.kind === 'circle') return null;
    const w = Math.max(Math.abs(g.x) * 1.2, isFinite(g.rho) ? Math.min(g.rho, Math.abs(g.x) * 3 + 1) : 1, 1);
    return [g.x - w, g.x + w];
  }
  function path2D(svg, g, opt) {
    const u = g.u, rng = pathRange(g), pts = [];
    if (g.kind === 'circle') for (let i = 0; i <= 120; i++) { const a = (i / 120) * 2 * Math.PI; pts.push([g.rho * Math.cos(a), g.rho * Math.sin(a)]); }
    else for (let i = 0; i <= 160; i++) { const x = rng[0] + ((rng[1] - rng[0]) * i) / 160; pts.push([x, DY.peval(g.c, x)]); }
    const p0 = g.kind === 'circle' ? Math.PI / 2 : g.x, par = uNow() === undefined ? p0 : g.kind === 'circle' ? p0 - uNow() * 2 * Math.PI : rng[0] + (rng[1] - rng[0]) * (0.1 + 0.8 * uNow());
    const P = pathAt(g, par), an = isFinite(P.rho) ? (g.v * g.v) / P.rho : 0;
    let xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const showOsc = dopt('osc', true) && isFinite(P.rho) && P.rho < 4 * (Math.max(...xs) - Math.min(...xs) + 1e-9);
    const C = isFinite(P.rho) ? [P.pos[0] + P.n[0] * P.rho, P.pos[1] + P.n[1] * P.rho] : null;
    // the frame is fixed by the instant asked for and the ends of the animated stretch, so it does not move during Play
    const P0 = pathAt(g, p0), C0 = isFinite(P0.rho) ? [P0.pos[0] + P0.n[0] * P0.rho, P0.pos[1] + P0.n[1] * P0.rho] : null;
    if (dopt('osc', true) && C0 && P0.rho < 4 * (Math.max(...xs) - Math.min(...xs) + 1e-9)) { xs = xs.concat([C0[0] - P0.rho, C0[0] + P0.rho]); ys = ys.concat([C0[1] - P0.rho, C0[1] + P0.rho]); }
    // clip the view to the neighbourhood of the point for a y = f(x) path
    let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    if (g.kind !== 'circle') {
      const span = rng[1] - rng[0], Q = [P0.pos, pathAt(g, rng[0] + 0.1 * span).pos, pathAt(g, rng[0] + 0.9 * span).pos];
      ymin = Math.max(ymin, Math.min(...Q.map((q) => q[1])) - span); ymax = Math.min(ymax, Math.max(...Q.map((q) => q[1])) + span); xmin = Math.max(xmin, Math.min(...Q.map((q) => q[0])) - span); xmax = Math.min(xmax, Math.max(...Q.map((q) => q[0])) + span);
    }
    const D = UI.Draw2D(svg, { xmin, xmax, ymin, ymax }, { pad: 56 }), px = (w) => w / D.sc;
    D.line([xmin, 0], [xmax, 0], { stroke: K.ink, sw: 0.8, op: 0.5 }); D.line([0, ymin], [0, ymax], { stroke: K.ink, sw: 0.8, op: 0.5 });
    D.pline(pts.filter((q) => q[1] >= ymin - 1e9), { stroke: K.path, sw: 2.6 });
    if (showOsc) { D.circle(C, P.rho, { stroke: K.ink, sw: 1, dash: '5 4' }); D.dot(C, K.ink, lbl(opt, `centre of curvature, ρ = ${fmt(P.rho)} ${u.L}`, 'ρ'), { r: 3 }); D.line(P.pos, C, { stroke: K.ink, sw: 1, dash: '3 3' }); }
    // t and n axes
    D.arrow(P.pos, [P.pos[0] + P.t[0] * px(56), P.pos[1] + P.t[1] * px(56)], { color: K.ink, w: 1.3, head: 8, label: 't', size: 12, lp: 'head' });
    D.arrow(P.pos, [P.pos[0] + P.n[0] * px(56), P.pos[1] + P.n[1] * px(56)], { color: K.ink, w: 1.3, head: 8, label: 'n', size: 12, lp: 'head' });
    const amax = Math.max(Math.hypot(g.at, g.an), Math.abs(g.at), an, 1e-9), La = (a) => 26 + 70 * Math.abs(a) / amax;
    if (dopt('showV', true) && g.v > 0) DYUI.vec(D, P.pos, P.t, 95, { color: K.vel, label: lbl(opt, `v = ${fmt(g.v)} ${u.V}`, 'v'), size: 12 });
    if (dopt('showA', true)) {
      if (Math.abs(g.at) > 1e-12) DYUI.vec(D, P.pos, [P.t[0] * Math.sign(g.at), P.t[1] * Math.sign(g.at)], La(g.at), { color: K.acc, w: 1.8, dash: '4 3', label: lbl(opt, `a_t = ${fmt(g.at)}`, 'a_t'), size: 11.5, ldy: 16 });
      if (an > 1e-12) DYUI.vec(D, P.pos, P.n, La(an), { color: K.acc, w: 1.8, dash: '4 3', label: lbl(opt, `a_n = ${fmt(an)}`, 'a_n'), size: 11.5 });
      const a = [g.at * P.t[0] + an * P.n[0], g.at * P.t[1] + an * P.n[1]];
      if (Math.hypot(a[0], a[1]) > 1e-12) DYUI.vec(D, P.pos, a, La(Math.hypot(a[0], a[1])), { color: K.acc, label: lbl(opt, `a = ${fmt(Math.hypot(a[0], a[1]))} ${u.A}`, 'a'), size: 12 });
    }
    D.circle(P.pos, px(7), { fill: K.path, stroke: '#fff', sw: 2 });
    DYUI.title(D, 12, 20, g.kind === 'circle' ? `Circle of radius ${fmt(g.rho)} ${u.L}` : `At x = ${fmt(P.pos[0])} ${u.L}, y = ${fmt(P.pos[1])} ${u.L}`);
    return true;
  }
  function cyl2D(svg, g, opt) {
    const u = g.u, n = 240, pts = [];
    for (let i = 0; i <= n; i++) pts.push(g.pos(g.span[0] + ((g.span[1] - g.span[0]) * i) / n));
    const t = uNow() === undefined ? g.t : g.span[0] + (g.span[1] - g.span[0]) * uNow(), k = g.at(t), p = g.pos(t);
    let R0 = 1e-9; pts.forEach((q) => (R0 = Math.max(R0, Math.hypot(q[0], q[1]))));
    const D = UI.Draw2D(svg, { xmin: -R0 * 1.15, xmax: R0 * 1.15, ymin: -R0 * 1.15, ymax: R0 * 1.15 }, { pad: 40 }), px = (w) => w / D.sc;
    // polar grid
    Charts.niceTicks(0, R0, 4).ticks.filter((r) => r > 0).forEach((r) => D.circle([0, 0], r, { stroke: '#d3dce0', sw: 1 }));
    for (let a = 0; a < 360; a += 30) D.line([0, 0], [R0 * 1.1 * Math.cos(a * D2R), R0 * 1.1 * Math.sin(a * D2R)], { stroke: '#e6ecef', sw: 1 });
    DYUI.axes(D, [0, 0], R0 * 1.12);
    D.pline(pts, { stroke: K.path, sw: 2.4 });
    const er = [Math.cos(k.th), Math.sin(k.th)], et = [-er[1], er[0]];
    D.line([0, 0], p, { stroke: K.ink, sw: 1.2, dash: '4 3' });
    if (Math.hypot(p[0], p[1]) > px(30)) D.arc([0, 0], 26, 0, ((k.th / D2R) % 360 + 360) % 360, 'θ');
    D.arrow(p, [p[0] + er[0] * px(40), p[1] + er[1] * px(40)], { color: K.ink, w: 1.2, head: 7, label: 'u_r', size: 10.5, lp: 'head' });
    D.arrow(p, [p[0] + et[0] * px(40), p[1] + et[1] * px(40)], { color: K.ink, w: 1.2, head: 7, label: 'u_θ', size: 10.5, lp: 'head' });
    const sp = Math.hypot(k.vr, k.vt), ac = Math.hypot(k.ar, k.at);
    const comp = dopt('comp', false);
    if (dopt('showV', true) && sp > 1e-12) {
      DYUI.vec(D, p, [k.vr * er[0] + k.vt * et[0], k.vr * er[1] + k.vt * et[1]], 90, { color: K.vel, label: lbl(opt, `v = ${fmt(sp)} ${u.V}`, 'v'), size: 12 });
      if (comp) { if (Math.abs(k.vr) > 1e-12) DYUI.vec(D, p, [er[0] * Math.sign(k.vr), er[1] * Math.sign(k.vr)], 90 * Math.abs(k.vr) / sp, { color: K.vel, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `v_r = ${fmt(k.vr)}`, 'v_r'), size: 11 }); if (Math.abs(k.vt) > 1e-12) DYUI.vec(D, p, [et[0] * Math.sign(k.vt), et[1] * Math.sign(k.vt)], 90 * Math.abs(k.vt) / sp, { color: K.vel, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `v_θ = ${fmt(k.vt)}`, 'v_θ'), size: 11 }); }
    }
    if (dopt('showA', true) && ac > 1e-12) {
      DYUI.vec(D, p, [k.ar * er[0] + k.at * et[0], k.ar * er[1] + k.at * et[1]], 90, { color: K.acc, label: lbl(opt, `a = ${fmt(ac)} ${u.A}`, 'a'), size: 12 });
      if (comp) { if (Math.abs(k.ar) > 1e-12) DYUI.vec(D, p, [er[0] * Math.sign(k.ar), er[1] * Math.sign(k.ar)], 90 * Math.abs(k.ar) / ac, { color: K.acc, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `a_r = ${fmt(k.ar)}`, 'a_r'), size: 11 }); if (Math.abs(k.at) > 1e-12) DYUI.vec(D, p, [et[0] * Math.sign(k.at), et[1] * Math.sign(k.at)], 90 * Math.abs(k.at) / ac, { color: K.acc, w: 1.6, head: 8, dash: '4 3', label: lbl(opt, `a_θ = ${fmt(k.at)}`, 'a_θ'), size: 11 }); }
    }
    D.circle(p, px(7), { fill: K.path, stroke: '#fff', sw: 2 });
    D.text([0, 0], 'O', { dx: -14, dy: 16, color: K.ink, size: 12 });
    DYUI.title(D, 12, 20, `t = ${fmt(t)} s: r = ${fmt(k.r)} ${u.L}, θ = ${fmt(k.th / D2R)}°`);
    return true;
  }
  /** Position of a particle of the relative-motion scene after time t, along its straight or circular path. */
  function relPos(P, t) {
    const v = Math.hypot(P.v[0], P.v[1]);
    if (!(P.rho > 0)) return { p: [P.pos[0] + P.v[0] * t, P.pos[1] + P.v[1] * t], e: P.e };
    const C = [P.pos[0] + P.n[0] * P.rho, P.pos[1] + P.n[1] * P.rho], a0 = Math.atan2(P.pos[1] - C[1], P.pos[0] - C[0]), sg = P.turn === 'right' ? -1 : 1, a = a0 + (sg * v * t) / P.rho;
    const r = [Math.cos(a), Math.sin(a)];
    return { p: [C[0] + P.rho * r[0], C[1] + P.rho * r[1]], e: [-sg * r[1], sg * r[0]], C };
  }
  function rel2D(svg, g, opt) {
    const u = g.u, t = uNow() === undefined ? 0 : g.span[1] * uNow(), A = relPos(g.A, t), B = relPos(g.B, t);
    const ps = [g.A.pos, g.B.pos, relPos(g.A, g.span[1]).p, relPos(g.B, g.span[1]).p];
    let xmin = Math.min(...ps.map((q) => q[0])), xmax = Math.max(...ps.map((q) => q[0])), ymin = Math.min(...ps.map((q) => q[1])), ymax = Math.max(...ps.map((q) => q[1]));
    const span = Math.max(xmax - xmin, ymax - ymin, 1e-6);
    const D = UI.Draw2D(svg, { xmin: xmin - span * 0.45, xmax: xmax + span * (dopt('tri', true) ? 1.3 : 0.45), ymin: ymin - span * 0.45, ymax: ymax + span * 0.45 }, { pad: 30 });
    const px = (w) => w / D.sc;
    // paths
    [[g.A, CA], [g.B, CB]].forEach(([P, col]) => {
      if (P.rho > 0) { const pp = []; for (let i = -40; i <= 40; i++) pp.push(relPos(P, (i / 40) * g.span[1] * 1.5).p); D.pline(pp, { stroke: col, sw: 1.4, dash: '6 4' }); }
      else { const a = [P.pos[0] - P.e[0] * span, P.pos[1] - P.e[1] * span], b = [P.pos[0] + P.e[0] * span * 1.5, P.pos[1] + P.e[1] * span * 1.5]; D.line(a, b, { stroke: col, sw: 1.4, dash: '6 4' }); }
    });
    const vmax = Math.max(Math.hypot(...g.A.v), Math.hypot(...g.B.v), Math.hypot(...g.vBA), 1e-9), amax = Math.max(Math.hypot(...g.A.a), Math.hypot(...g.B.a), Math.hypot(...g.aBA), 1e-9);
    const Lv = (v) => 20 + 90 * Math.hypot(v[0], v[1]) / vmax, La = (a) => 16 + 70 * Math.hypot(a[0], a[1]) / amax;
    const vAt = (P, Q) => { const sp = Math.hypot(P.v[0], P.v[1]); return [Q.e[0] * sp, Q.e[1] * sp]; };
    [[A, g.A, CA, 'A'], [B, g.B, CB, 'B']].forEach(([Q, P, col, n]) => {
      const vv = vAt(P, Q);
      if (dopt('showV', true)) DYUI.vec(D, Q.p, vv, Lv(vv), { color: K.vel, label: lbl(opt, `v_${n} = ${fmt(Math.hypot(...vv))} ${u.V}`, 'v_' + n), size: 11.5 });
      if (dopt('showA', true) && uNow() === undefined && Math.hypot(...P.a) > 1e-12) DYUI.vec(D, Q.p, P.a, La(P.a), { color: K.acc, label: lbl(opt, `a_${n} = ${fmt(Math.hypot(...P.a))} ${u.A}`, 'a_' + n), size: 11.5, anchor: 'end', ldx: -8, ldy: 14 });
      D.circle(Q.p, px(10), { fill: col, stroke: '#fff', sw: 2 }); D.text(Q.p, n, { anchor: 'middle', base: 'middle', color: '#fff', size: 11 });
    });
    D.line(A.p, B.p, { stroke: K.ink, sw: 1, dash: '2 4' });
    if (dopt('tri', true)) {
      // vector triangles v_B = v_A + v_B/A and a_B = a_A + a_B/A, drawn in two boxes on the right
      const vA = vAt(g.A, A), vB = vAt(g.B, B), list = [];
      if (dopt('showV', true)) list.push(['Velocities: v_B = v_A + v_B/A', vA, vB, 'v', u.V]);
      if (dopt('showA', true) && uNow() === undefined) list.push(['Accelerations: a_B = a_A + a_B/A', g.A.a, g.B.a, 'a', u.A]);
      const bw = Math.min(250, D.W * 0.36), bh = Math.min(200, (D.H - 40) / 2 - 10);
      list.forEach(([ttl, a1, b1, sym, un], i) => {
        const x0 = D.W - bw - 10, y0 = 34 + i * (bh + 12), rel = [b1[0] - a1[0], b1[1] - a1[1]];
        D.el('rect', { x: x0, y: y0, width: bw, height: bh, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
        D.text([x0 + 8, y0 + 16], ttl, { px: true, color: K.ink, size: 11.5, weight: 700 });
        const pts = [[0, 0], a1, b1], mnx = Math.min(...pts.map((q) => q[0])), mxx = Math.max(...pts.map((q) => q[0])), mny = Math.min(...pts.map((q) => q[1])), mxy = Math.max(...pts.map((q) => q[1]));
        const sc = Math.min((bw - 70) / Math.max(mxx - mnx, 1e-9), (bh - 64) / Math.max(mxy - mny, 1e-9));
        const ox = x0 + 35 + (bw - 70 - (mxx - mnx) * sc) / 2 - mnx * sc, oy = y0 + 30 + (bh - 64 + (mxy - mny) * sc) / 2 + mny * sc;
        const Q = (q) => [ox + q[0] * sc, oy - q[1] * sc], arr = (p, q, col, lab, dash) => { const P1 = Q(p), P2 = Q(q); if (Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) < 3) return; D.arrow(D.inv(P1[0], P1[1]), D.inv(P2[0], P2[1]), { color: col, w: 2.2, head: 9, dash, label: lab, size: 11, lp: 'head' }); };
        arr([0, 0], a1, CA, `${sym}_A`, '5 3'); arr(a1, b1, REL, `${sym}_B/A`); arr([0, 0], b1, CB, `${sym}_B`);
        D.text([x0 + 8, y0 + bh - 8], lbl(opt, `${sym}_B/A = ${fmt(Math.hypot(...rel))} ${un} at ${fmt(DY.vang(rel))}°`, ''), { px: true, color: REL, size: 11, weight: 700 });
      });
    }
    DYUI.axes(D, [xmin - span * 0.4, ymin - span * 0.4], px(40));
    DYUI.title(D, 12, 20, uNow() === undefined ? 'At the instant given' : `t = ${fmt(t)} s later`);
    return true;
  }

  /* Charts */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u, cur = uNow() === undefined ? NaN : g.span[0] + (g.span[1] - g.span[0]) * uNow();
    if (g.mode === 'proj') {
      const tt = []; for (let i = 0; i <= 160; i++) tt.push((g.T * i) / 160);
      const vy = (t) => g.vy - g.u.g * t;
      return DYUI.stack(svg, [
        { label: `y (${u.L})`, color: K.path, pts: tt.map((t) => [t, g.Y(t)]), at: g.Y, marks: g.vy > 0 ? [{ x: g.tTop, y: g.yTop, label: `highest at ${fmt(g.tTop)} s` }] : [] },
        { label: `vₓ, vᵧ (${u.V})`, color: K.vel, pts: tt.map((t) => [t, vy(t)]), at: vy, more: [{ pts: tt.map((t) => [t, g.vx]), color: '#7f8c8d', dash: '5 4', at: () => g.vx }] },
        { label: `speed (${u.V})`, color: '#16a085', pts: tt.map((t) => [t, Math.hypot(g.vx, vy(t))]), at: (t) => Math.hypot(g.vx, vy(t)) },
      ], { xlabel: 't (s)', cursor: cur, xmin: 0, xmax: g.T });
    }
    if (g.mode === 'cyl') {
      const tt = []; for (let i = 0; i <= 160; i++) tt.push(g.span[0] + ((g.span[1] - g.span[0]) * i) / 160);
      const tc = isFinite(cur) ? cur : g.t;
      return DYUI.stack(svg, [
        { label: `r (${u.L})`, color: K.path, pts: tt.map((t) => [t, g.at(t).r]), at: (t) => g.at(t).r },
        { label: 'θ (rad)', color: '#8e44ad', pts: tt.map((t) => [t, g.at(t).th]), at: (t) => g.at(t).th },
        { label: `speed v (${u.V})`, color: K.vel, pts: tt.map((t) => { const k = g.at(t); return [t, Math.hypot(k.vr, k.vt)]; }), at: (t) => { const k = g.at(t); return Math.hypot(k.vr, k.vt); } },
      ], { xlabel: 't (s)', cursor: tc, xmin: g.span[0], xmax: g.span[1] });
    }
    if (g.mode === 'path' && g.kind === 'poly') {
      const rng = pathRange(g), xs = []; for (let i = 0; i <= 160; i++) xs.push(rng[0] + ((rng[1] - rng[0]) * i) / 160);
      const rho = (x) => { const r = pathAt(g, x).rho; return isFinite(r) ? r : NaN; }, an = (x) => { const r = pathAt(g, x).rho; return isFinite(r) ? (g.v * g.v) / r : 0; };
      const cap = isFinite(g.rho) ? g.rho * 6 : Math.max(...xs.map(rho).filter(isFinite), 1);
      return DYUI.stack(svg, [
        { label: `ρ (${u.L})`, color: K.ink, pts: xs.map((x) => [x, Math.min(rho(x), cap)]).filter((q) => isFinite(q[1])), at: rho, fill: false },
        { label: `a_n at v = ${fmt(g.v)} (${u.A})`, color: K.acc, pts: xs.map((x) => [x, an(x)]), at: an },
      ], { xlabel: `x (${u.L})`, cursor: isFinite(cur) ? rng[0] + (rng[1] - rng[0]) * (0.1 + 0.8 * uNow()) : g.x, xmin: rng[0], xmax: rng[1] });
    }
    return false;
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u;
    if (g.mode === 'proj') {
      const b = projBounds(g), dz = b.span * 0.15;
      if (g.surf.kind === 'slope') DYUI.floor3(v, Math.min(0, b.x0), b.x1, Math.min(0, b.x0) * g.surf.tb, dz, Math.atan(g.surf.tb));
      else DYUI.floor3(v, b.x0, b.x1, 0, dz);
      if (g.h0 > 0) v.box(-b.span * 0.04, 0, -dz * 0.4, 0, g.h0, dz * 0.4, '#c3cbd3', 1, '#7f8c8d');
      if (g.surf.kind === 'x' && g.yL > 0) v.box(g.xL, 0, -dz * 0.6, g.xL + b.span * 0.06, g.yL, dz * 0.6, '#c3cbd3', 1, '#7f8c8d');
      if (g.surf.kind === 'level' && g.surf.y > 0) v.box(g.xL - b.span * 0.08, 0, -dz, b.x1, g.surf.y, dz, '#c3cbd3', 1, '#7f8c8d');
      if (g.wall) v.box(g.wall.dw - b.span * 0.01, 0, -dz * 0.9, g.wall.dw + b.span * 0.01, g.wall.hw, dz * 0.9, '#8e9aa5', 1, '#4a5661');
      const pts = []; for (let i = 0; i <= 80; i++) { const t = (g.T * i) / 80; pts.push([g.X(t), g.Y(t), 0]); }
      v.line(pts, K.path, 2, [6, 4]);
      const t = uNow() === undefined ? 0 : g.T * uNow(), p = [g.X(t), g.Y(t), 0], vy = g.vy - g.u.g * t, sp = Math.hypot(g.vx, vy), r = b.span * 0.018;
      DYUI.sphere(v, p, r, K.path);
      if (dopt('showV', true) && sp > 1e-9) { const L = b.span * 0.16; DYUI.arrow3(v, p, [p[0] + (g.vx / sp) * L, p[1] + (vy / sp) * L, 0], K.vel, 2.6); v.label([p[0] + (g.vx / sp) * L, p[1] + (vy / sp) * L, 0], lbl(opt, `v = ${fmt(sp)} ${u.V}`, 'v'), K.vel); }
      if (dopt('showA', true)) { const q = [p[0] + r * 2, p[1], 0]; DYUI.arrow3(v, q, [q[0], q[1] - b.span * 0.08, 0], K.acc, 2.2); v.label([q[0], q[1] - b.span * 0.08, 0], 'g', K.acc); }
      v.setBounds([b.x0, b.y0, -dz], [b.x1, b.y1, dz]);
      return;
    }
    if (g.mode === 'cyl') {
      const n = 200, pts = []; let R0 = 1e-9;
      for (let i = 0; i <= n; i++) { const q = g.pos(g.span[0] + ((g.span[1] - g.span[0]) * i) / n); pts.push([q[0], 0, -q[1]]); R0 = Math.max(R0, Math.hypot(q[0], q[1])); }
      const s = R0 * 1.15;
      v.face([[-s, -R0 * 0.02, -s], [s, -R0 * 0.02, -s], [s, -R0 * 0.02, s], [-s, -R0 * 0.02, s]], '#eef2f5', 1, '#c3cbd3', 1, -1, [0, 1, 0]);
      v.line(pts, K.path, 2.4);
      const t = uNow() === undefined ? g.t : g.span[0] + (g.span[1] - g.span[0]) * uNow(), k = g.at(t), p2 = g.pos(t), p = [p2[0], 0, -p2[1]];
      v.line([[0, 0, 0], p], K.ink, 1.2, [4, 3]);
      DYUI.arrow3(v, [0, 0, 0], [s, 0, 0], K.ink, 1.4); DYUI.arrow3(v, [0, 0, 0], [0, 0, -s], K.ink, 1.4); v.label([s, 0, 0], 'x', K.ink); v.label([0, 0, -s], 'y', K.ink);
      DYUI.sphere(v, [p[0], R0 * 0.03, p[2]], R0 * 0.03, K.path);
      const er = [Math.cos(k.th), 0, -Math.sin(k.th)], et = [-Math.sin(k.th), 0, -Math.cos(k.th)], sp = Math.hypot(k.vr, k.vt), ac = Math.hypot(k.ar, k.at), L = R0 * 0.35;
      if (dopt('showV', true) && sp > 1e-12) { const d = DYUI.add(DYUI.mul(er, k.vr / sp), DYUI.mul(et, k.vt / sp)); DYUI.arrow3(v, p, DYUI.add(p, DYUI.mul(d, L)), K.vel, 2.6); v.label(DYUI.add(p, DYUI.mul(d, L)), lbl(opt, `v = ${fmt(sp)} ${u.V}`, 'v'), K.vel); }
      if (dopt('showA', true) && ac > 1e-12) { const d = DYUI.add(DYUI.mul(er, k.ar / ac), DYUI.mul(et, k.at / ac)); DYUI.arrow3(v, p, DYUI.add(p, DYUI.mul(d, L)), K.acc, 2.4); v.label(DYUI.add(p, DYUI.mul(d, L)), lbl(opt, `a = ${fmt(ac)} ${u.A}`, 'a'), K.acc); }
      v.setBounds([-s, -R0 * 0.1, -s], [s, R0 * 0.3, s]);
      return;
    }
    if (g.mode === 'path') {
      const rng = pathRange(g), pts = [];
      if (g.kind === 'circle') for (let i = 0; i <= 96; i++) { const a = (i / 96) * 2 * Math.PI; pts.push([g.rho * Math.cos(a), 0, -g.rho * Math.sin(a)]); }
      else for (let i = 0; i <= 120; i++) { const x = rng[0] + ((rng[1] - rng[0]) * i) / 120; pts.push([x, DY.peval(g.c, x), 0]); }
      const par = g.kind === 'circle' ? (uNow() === undefined ? Math.PI / 2 : Math.PI / 2 - uNow() * 2 * Math.PI) : uNow() === undefined ? g.x : rng[0] + (rng[1] - rng[0]) * (0.1 + 0.8 * uNow());
      const P = pathAt(g, par), map = g.kind === 'circle' ? (q) => [q[0], 0, -q[1]] : (q) => [q[0], q[1], 0];
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; pts.forEach((q) => q.forEach((c, i) => { mn[i] = Math.min(mn[i], c); mx[i] = Math.max(mx[i], c); }));
      const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1e-6);
      if (g.kind !== 'circle') { const sp = rng[1] - rng[0], Qy = [pathAt(g, g.x).pos[1], pathAt(g, rng[0] + 0.1 * sp).pos[1], pathAt(g, rng[0] + 0.9 * sp).pos[1]]; mn[1] = Math.max(mn[1], Math.min(...Qy) - sp); mx[1] = Math.min(mx[1], Math.max(...Qy) + sp); }
      v.line(pts.filter((q) => q[1] >= mn[1] - 1e-9 && q[1] <= mx[1] + 1e-9), K.path, 3);
      const p = map(P.pos), an = isFinite(P.rho) ? (g.v * g.v) / P.rho : 0, L = span * 0.2, amax = Math.max(Math.hypot(g.at, an), 1e-12);
      DYUI.sphere(v, p, span * 0.02, K.path);
      if (dopt('showV', true) && g.v > 0) { const q = DYUI.add(p, DYUI.mul(map(P.t), L)); DYUI.arrow3(v, p, q, K.vel, 2.6); v.label(q, lbl(opt, `v = ${fmt(g.v)} ${u.V}`, 'v'), K.vel); }
      if (dopt('showA', true) && amax > 1e-12) { const d = DYUI.add(DYUI.mul(map(P.t), g.at / amax), DYUI.mul(map(P.n), an / amax)), q = DYUI.add(p, DYUI.mul(d, L)); DYUI.arrow3(v, p, q, K.acc, 2.4); v.label(q, lbl(opt, `a = ${fmt(amax)} ${u.A}`, 'a'), K.acc); }
      if (dopt('osc', true) && isFinite(P.rho) && P.rho < span * 3) { const C = [P.pos[0] + P.n[0] * P.rho, P.pos[1] + P.n[1] * P.rho], cc = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * 2 * Math.PI; cc.push(map([C[0] + P.rho * Math.cos(a), C[1] + P.rho * Math.sin(a)])); } v.line(cc, K.ink, 1, [5, 4]); }
      v.setBounds(mn, mx);
      return;
    }
    // relative motion: two bodies on a floor (x to the right, y into the screen as −z)
    const t = uNow() === undefined ? 0 : g.span[1] * uNow(), A = relPos(g.A, t), B = relPos(g.B, t);
    const ps = [g.A.pos, g.B.pos, relPos(g.A, g.span[1]).p, relPos(g.B, g.span[1]).p];
    let x0 = Math.min(...ps.map((q) => q[0])), x1 = Math.max(...ps.map((q) => q[0])), y0 = Math.min(...ps.map((q) => q[1])), y1 = Math.max(...ps.map((q) => q[1]));
    const span = Math.max(x1 - x0, y1 - y0, 1e-6); x0 -= span * 0.4; x1 += span * 0.4; y0 -= span * 0.4; y1 += span * 0.4;
    v.face([[x0, 0, -y0], [x1, 0, -y0], [x1, 0, -y1], [x0, 0, -y1]], '#eef2f5', 1, '#c3cbd3', 1, -1, [0, 1, 0]);
    const M3 = (q) => [q[0], span * 0.03, -q[1]], vmax = Math.max(Math.hypot(...g.A.v), Math.hypot(...g.B.v), 1e-9);
    [[A, g.A, CA, 'A'], [B, g.B, CB, 'B']].forEach(([Q, P, col, n]) => {
      const p = M3(Q.p), sp = Math.hypot(...P.v);
      DYUI.sphere(v, p, span * 0.03, col);
      if (dopt('showV', true) && sp > 1e-9) { const q = DYUI.add(p, [Q.e[0] * span * 0.3 * sp / vmax, 0, -Q.e[1] * span * 0.3 * sp / vmax]); DYUI.arrow3(v, p, q, K.vel, 2.4); v.label(q, `v_${n}`, K.vel); }
      v.label([p[0], p[1] + span * 0.06, p[2]], n, col);
    });
    const pB = M3(B.p), vA = [A.e[0] * Math.hypot(...g.A.v), A.e[1] * Math.hypot(...g.A.v)], vB = [B.e[0] * Math.hypot(...g.B.v), B.e[1] * Math.hypot(...g.B.v)], vr = [vB[0] - vA[0], vB[1] - vA[1]];
    if (Math.hypot(...vr) > 1e-9) { const q = DYUI.add(pB, [vr[0] * span * 0.3 / vmax, span * 0.002, -vr[1] * span * 0.3 / vmax]); DYUI.arrow3(v, pB, q, REL, 2.6); v.label(q, lbl(opt, `v_B/A = ${fmt(Math.hypot(...vr))} ${u.V}`, 'v_B/A'), REL); }
    v.setBounds([x0, 0, -y1], [x1, span * 0.2, -y0]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(Curv.defaults(), o);
  M.presets = [
    { name: 'Test: Book Example 12.11, sack off a ramp at 12 m/s from 6 m up (t = 1.11 s, R = 13.3 m)', units: 'SI', state: P0({ v0: 12, th: 0, h0: 6, land: 'level', yT: 0 }),
      expect: [{ k: 'Time of flight t', v: 1.106 }, { k: 'Range R (horizontal distance)', v: 13.27 }] },
    { name: 'Test: Book Example 12.12, chips at 25 ft/s, 30°, 4 ft up, land 20 ft away (h = 1.81 ft)', units: 'US', state: P0({ v0: 25, th: 30, h0: 4, land: 'x', d: 20 }),
      expect: [{ k: 'Landing height h', v: 1.81 }, { k: 'Time of flight t', v: 0.9238 }] },
    { name: 'Test: Book Example 12.13, rider off a 30° ramp 1 m up, 1.5 s in the air (v_A = 13.4 m/s, R = 17.4 m, h = 3.28 m)', units: 'SI', state: P0({ find: 'v0', by: 'time', T: 1.5, th: 30, h0: 1, yT: 0 }),
      expect: [{ k: 'Launch speed v₀', v: 13.38 }, { k: 'Range R (horizontal distance)', v: 17.38 }, { k: 'Maximum height above the landing point', v: 3.28 }] },
    { name: 'Test: Book Example 12.14, path y = x²/20 at x = 10 m, v = 6 m/s, v̇ = 2 m/s² (ρ = 28.3 m, a = 2.37 m/s²)', units: 'SI', state: P0({ mode: 'path', ptype: 'poly', c: [0, 0, 0.05, 0], x: 10, v: 6, at: 2 }),
      expect: [{ k: 'Radius of curvature ρ', v: 28.28 }, { k: 'Normal acceleration a_n', v: 1.273 }, { k: 'Acceleration a', v: 2.37 }] },
    { name: 'Test: Book Example 12.16, box on a 2 m curve, v = 3.24 m/s, a_t = 1.14 m/s² (a = 5.36 m/s²)', units: 'SI', state: P0({ mode: 'path', ptype: 'circle', rho: 2, v: 3.238, at: 1.138 }),
      expect: [{ k: 'Normal acceleration a_n', v: 5.242 }, { k: 'Acceleration a', v: 5.36 }] },
    { name: 'Test: Book Example 12.18, r = 0.1t² m, θ = t³ rad at t = 1 s (v = 0.361 m/s, a = 1.93 m/s²)', units: 'SI', state: P0({ mode: 'cyl', cr: [0, 0, 0.1, 0], cth: [0, 0, 0, 1], t: 1 }),
      expect: [{ k: 'Speed v', v: 0.3606 }, { k: 'Radial acceleration a_r', v: -0.7 }, { k: 'Transverse acceleration a_θ', v: 1.8 }, { k: 'Acceleration a', v: 1.931 }] },
    { name: 'Test: Book Example 12.27, car B on a 100 m curve seen from car A (v_B/A = 9.69 m/s, a_B/A = 5.32 m/s²)', units: 'SI', state: P0({ mode: 'rel', A: { x: 0, y: 0, v: 18, dir: 240, at: -2, rho: 0, turn: 'left' }, B: { x: 20, y: -5, v: 12, dir: 270, at: 3, rho: 100, turn: 'right' } }),
      expect: [{ k: 'Relative speed v_B/A', v: 9.69 }, { k: 'Direction of v_B/A', v: 21.74 }, { k: 'Relative acceleration a_B/A', v: 5.32 }] },
    { name: 'Launch angles to hit a point 30 m away and 2 m up at 20 m/s (two answers)', units: 'SI', state: P0({ find: 'theta', v0: 20, d: 30, yT: 2, h0: 0 }) },
    { name: 'Ball kicked at 20 m/s, 40°, over a 6 m wall 15 m away', units: 'SI', state: P0({ v0: 20, th: 40, h0: 0, wall: true, dw: 15, hw: 6 }) },
    { name: 'Ball thrown down a 15° slope at 15 m/s, 20° above the horizontal', units: 'SI', state: P0({ v0: 15, th: 20, h0: 1.5, land: 'slope', beta: -15 }) },
    { name: 'Car on a 300 ft curve at 60 ft/s, speeding up at 7 ft/s²', units: 'US', state: P0({ mode: 'path', ptype: 'circle', rho: 300, v: 60, at: 7 }) },
    { name: 'Edge: launch angle for a point out of reach (fails on purpose)', units: 'SI', fails: true, state: P0({ find: 'theta', v0: 5, d: 30, yT: 0, h0: 0 }) },
  ];

  root.DCurv = M;
})(window);
