/* =====================================================================
 * DYNAMICS · D6 Planar Kinetics of Rigid Bodies (inputs, diagrams, presets). Physics: dy/rbforce.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, RbForce, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', LINK = '#5d6d7e', D2R = Math.PI / 180, TAU = 2 * Math.PI;

  const M = { id: 'rbforce', title: 'Planar Kinetics of Rigid Bodies', defaults: RbForce.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const SHAPE_OPTS = [['rod', 'Slender rod'], ['disk', 'Disk or cylinder'], ['ring', 'Thin ring'], ['sphere', 'Sphere'], ['plate', 'Rectangular plate'], ['point', 'Small particle']];
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const ml = u.us ? 'Weight W' : 'Mass m';
    let sec = C.section(c, 'Scene');
    C.select(sec, { label: 'Scene', get: () => st.scene, set: (v) => (st.scene = v), options: [
      ['inertia', 'Moment of inertia of a composite body'], ['car', 'Vehicle accelerating or braking (translation)'], ['pend', 'Pendulum on a fixed pin (rotation)'],
      ['drum', 'Drum lowering a block (rotation)'], ['roll', 'Wheel or spool rolling (general plane motion)']] });
    const methods = { pend: [['force', 'ΣF = ma_G'], ['energy', 'Work and energy']], drum: [['force', 'ΣF = ma_G'], ['energy', 'Work and energy'], ['impulse', 'Impulse and momentum']], roll: [['force', 'ΣF = ma_G'], ['energy', 'Work and energy'], ['impulse', 'Impulse and momentum']] }[st.scene];
    if (methods) { if (!methods.some(([v]) => v === st.method)) st.method = 'force'; C.seg(sec, { label: 'Method', get: () => st.method, set: (v) => (st.method = v), options: methods }); }

    if (st.scene === 'inertia') {
      sec = C.section(c, 'Parts');
      C.note(sec, 'Place each part by the position of its own mass centre, measured from the axis O. A hole is a part with negative mass.');
      C.list(sec, { items: st.parts, max: 6, min: 1, title: (it) => (SHAPE_OPTS.find((o) => o[0] === it.t) || ['', 'Part'])[1] + (it.rm === 'remove' ? ' (hole)' : ''),
        fields: (it) => {
          const f = [{ key: 't', label: 'Shape', options: SHAPE_OPTS }, { key: 'rm', label: 'Adds or removes', options: [['add', 'Solid, adds'], ['remove', 'Hole, removes']] }, { key: 'm', label: ml, unit: u.M }];
          if (it.t === 'rod') f.push({ key: 'a', label: 'Length l', unit: u.L }); else if (it.t === 'plate') f.push({ key: 'a', label: 'Width a', unit: u.L }, { key: 'b', label: 'Height b', unit: u.L }); else if (it.t !== 'point') f.push({ key: 'a', label: 'Radius r', unit: u.L });
          f.push({ key: 'x', label: 'Centre x', unit: u.L }, { key: 'y', label: 'Centre y', unit: u.L });
          if (it.t === 'rod' || it.t === 'plate') f.push({ key: 'ang', label: 'Angle from +x', unit: '°' });
          return f;
        },
        add: [['Part', () => ({ t: 'disk', m: 5, a: 0.3, b: 0, x: 0, y: 0, ang: 0, rm: 'add' })]] });
    } else if (st.scene === 'car') {
      sec = C.section(c, 'Vehicle');
      num(sec, 'cm', ml, u.M); num(sec, 'h', 'Height of G above the road h', u.L);
      num(sec, 'br', 'G ahead of the rear axle B, b_B', u.L); num(sec, 'bf', 'G behind the front axle A, b_A', u.L);
      sec = C.section(c, 'Situation');
      C.select(sec, { label: 'Drive', get: () => st.drive, set: (v) => (st.drive = v), options: [['rear', 'Rear wheels spinning (slipping)'], ['front', 'Front wheels spinning (slipping)'], ['brake', 'All wheels locked, skidding'], ['given', 'Given acceleration, rear drive'], ['wheelie', 'Front wheel just lifting (wheelie)']] });
      if (st.drive === 'given') num(sec, 'ca', 'Acceleration a_G (+ forward)', u.A);
      else if (st.drive !== 'wheelie') num(sec, 'cmuk', 'Kinetic friction μ_k', '');
      C.note(sec, 'Wheel masses are neglected, as in the book. The road is level.');
    } else if (st.scene === 'pend') {
      sec = C.section(c, 'Body');
      C.seg(sec, { label: 'Body', get: () => st.shape, set: (v) => (st.shape = v), options: [['rod', 'Slender rod pinned at one end'], ['body', 'Any body (k_G, r_G)']] });
      num(sec, 'pm', ml, u.M);
      if (st.shape === 'rod') num(sec, 'pL', 'Length l', u.L);
      else { num(sec, 'kG', 'Radius of gyration about G, k_G', u.L); num(sec, 'rG', 'Distance from the pin O to G, r_G', u.L); }
      num(sec, 'M', 'Couple moment M (+ clockwise)', u.MO);
      sec = C.section(c, st.method === 'energy' ? 'From position 1 to position 2' : 'At the instant');
      C.note(sec, 'θ is the angle of the line OG below the horizontal, with G to the right of O (0° level, 90° hanging straight down, − above the level).');
      num(sec, 'th', st.method === 'energy' ? 'Starting angle θ₁' : 'Angle θ', '°'); num(sec, 'w', st.method === 'energy' ? 'Starting ω₁ (+ clockwise)' : 'Angular velocity ω (+ clockwise)', 'rad/s');
      if (st.method === 'energy') num(sec, 'th2', 'Angle to find θ₂', '°');
    } else if (st.scene === 'drum') {
      sec = C.section(c, 'Drum');
      C.seg(sec, { label: 'Inertia given as', get: () => st.Iby, set: (v) => (st.Iby = v), options: [['k', 'Mass and k_O'], ['I', 'I_O']] });
      num(sec, 'dm', `${ml} of the drum`, u.M);
      if (st.Iby === 'k') num(sec, 'kO', 'Radius of gyration k_O', u.L); else num(sec, 'IO', 'Moment of inertia I_O', u.I);
      num(sec, 'dr', 'Radius where the cord leaves, r', u.L); num(sec, 'Mf', 'Bearing friction moment M_f (0 for none)', u.MO);
      sec = C.section(c, 'Block');
      num(sec, 'bm', ml, u.M);
      if (st.method !== 'force') num(sec, 'dv1', 'Starting speed v₁ (down)', u.V);
      if (st.method === 'energy') num(sec, 'ds', 'Distance the block falls s', u.L);
      if (st.method === 'impulse') num(sec, 'dt', 'Time t', 's');
    } else {
      sec = C.section(c, 'Wheel or spool');
      num(sec, 'rm', ml, u.M); num(sec, 'rk', 'Radius of gyration k_G', u.L); num(sec, 'R', 'Radius it rolls on r', u.L); num(sec, 'Ro', 'Outer radius (for the drawing)', u.L);
      sec = C.section(c, 'Surface');
      C.seg(sec, { label: 'Rolls on', get: () => st.surf, set: (v) => (st.surf = v), options: [['ground', 'A floor or slope'], ['cord', 'A fixed cord']] });
      num(sec, 'phi', st.surf === 'cord' ? 'Angle of the cord from the horizontal φ (90 vertical)' : 'Slope φ (0 level, + falling to the right)', '°');
      if (st.surf !== 'cord') { num(sec, 'mus', 'Static friction μ_s', ''); num(sec, 'muk', 'Kinetic friction μ_k', ''); }
      sec = C.section(c, 'Loads');
      num(sec, 'RM', 'Couple moment M (+ clockwise)', u.MO); num(sec, 'P', 'Force P along x (+ down the slope)', u.F); num(sec, 'yP', 'Line of P from G, y_P (+ away from the surface)', u.L);
      if (st.method !== 'force') { sec = C.section(c, 'Motion'); num(sec, 'rv1', 'Starting speed of G, v₁', u.V); if (st.method === 'energy') num(sec, 'rs', 'Distance G moves s', u.L); else num(sec, 'rt', 'Time t', 's'); }
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (st.scene !== 'inertia') {
      C.toggle(c, { label: 'Free-body diagram (forces on the body)', get: () => dopt('fbd', true), set: (v) => (st.fbd = v), rebuild: false });
      C.toggle(c, { label: 'Kinetic diagram (ma_G and I_Gα)', get: () => dopt('kd', true), set: (v) => (st.kd = v), rebuild: false });
    } else {
      C.toggle(c, { label: 'Part numbers', get: () => dopt('nums', true), set: (v) => (st.nums = v), rebuild: false });
      C.toggle(c, { label: 'Mass centre G and distance d', get: () => dopt('showG', true), set: (v) => (st.showG = v), rebuild: false });
    }
  };

  M.compute = (U) => RbForce.solve(S(), U);
  M.onUnits = (from, to) => RbForce.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ inertia: 'Body and its parts', car: 'Vehicle, free-body and kinetic diagrams', pend: 'Pendulum, free-body and kinetic diagrams', drum: 'Drum and block, free-body and kinetic diagrams', roll: 'Rolling body, free-body and kinetic diagrams' }[S().scene]);
  M.cap3D = () => '3D view';
  M.plotCaption = () => ({ inertia: 'Share of I_O from each part', car: 'Normal forces against acceleration', pend: 'ω and pin forces over the swing', drum: 'Speed of the block and ω of the drum', roll: 'Speed of G and ω against time' }[S().scene]);
  M.plotTall = true;
  M.hint = () => (S().scene === 'inertia' ? 'Press Play to swing the body about O. Holes are drawn dashed; the dot G is the mass centre of the whole body.' : 'Press Play to run the motion. Forces on the body are red; the kinetic diagram on the right shows ma_G and I_Gα.');
  M.legend = () => (S().scene === 'inertia' ? [[K.body, 'Solid part'], [K.ic, 'Mass centre G'], [K.ink, 'Axis O', 'ln']] : [[K.force, 'Force'], [K.acc, 'ma_G and I_Gα'], [K.vel, 'Velocity'], [K.ink, 'Cord or support', 'ln']]);
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]), { idle: 'the instant asked for' });
  M.anim = () => motion;
  const uNow = () => S()._u;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const L2 = (a) => Math.hypot(a[0], a[1]);
  const tNow = (g) => (uNow() === undefined ? 0 : g.span[0] + (g.span[1] - g.span[0]) * uNow());

  /* ------------------------------------------------------------------ */
  /* Drawing helpers                                                    */
  /* ------------------------------------------------------------------ */
  /** Arc arrow in screen pixels around (cx, cy); clockwise when cw. */
  function curlPx(D, cx, cy, r, cw, color, label, o) {
    o = o || {};
    const a0 = cw ? 150 : 30, a1 = cw ? -110 : 290, n = 28, pts = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * D2R; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    D.el('polyline', { points: pts.slice(0, n).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': o.w || 2.2, 'stroke-linecap': 'round' });
    const e = pts[n], q = pts[n - 3], L = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1;
    D.head(e[0], e[1], (e[0] - q[0]) / L, (e[1] - q[1]) / L, color, 9);
    if (label) D.text([cx + (o.ldx || 0), cy - r - 8 + (o.ldy || 0)], label, { px: true, anchor: 'middle', color, size: 11.5, weight: 700 });
  }
  const curl = (D, p, val, color, label, o) => { if (Math.abs(val) < 1e-12) return; curlPx(D, D.X(p[0]), D.Y(p[1]), (o && o.r) || 20, val > 0, color, label, o); };
  /** Force arrow on the free-body diagram: pushes into p when o.head, else pulls away from p. Direction d, sign of mag flips it. */
  function farrow(D, p, d, mag, fmax, label, o) {
    o = o || {};
    if (!(Math.abs(mag) > 1e-9 * (fmax || 1))) return;
    const s = mag < 0 ? -1 : 1, dd = [d[0] * s, d[1] * s], px = Math.min(o.maxPx || 1e9, 26 + 52 * Math.min(1, Math.abs(mag) / (fmax || 1)));
    DYUI.vec(D, p, dd, px, { color: o.color || K.force, label, size: 11.5, head: o.head, hs: 11, anchor: o.anchor || (dd[0] < -0.3 ? 'end' : dd[0] > 0.3 ? 'start' : 'middle'), ldx: o.ldx !== undefined ? o.ldx : dd[0] < -0.3 ? -6 : dd[0] > 0.3 ? 6 : 0, ldy: o.ldy !== undefined ? o.ldy : dd[1] < -0.3 ? (o.head ? -8 : 16) : dd[1] > 0.3 ? (o.head ? 16 : -8) : 4 });
  }
  /** Box for the kinetic diagram on the right; draw(cx, cy, s) draws inside it in pixels. */
  const PW = (svg) => Math.min(220, (svg.clientWidth || 800) * 0.32);
  const NARROW = 560, KDH = 190; // on a phone the kinetic diagram sits under the scene
  const opts2 = (svg, on) => ((svg.clientWidth || 800) < NARROW ? { pad: 20, padB: on ? KDH + 6 : 0 } : { pad: 24, padR: on ? PW(svg) + 26 : 0, padRmax: 0.42 });
  function kdBox(D, title, draw) {
    const nar = D.W < NARROW, bw = nar ? Math.min(280, D.W - 20) : Math.min(220, D.W * 0.32), bh = nar ? KDH - 6 : Math.min(230, D.H - 52), x0 = nar ? (D.W - bw) / 2 : D.W - bw - 10, y0 = nar ? D.H - bh - 6 : 26;
    D.el('rect', { x: x0, y: y0, width: bw, height: bh, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
    D.text([x0 + 8, y0 + 16], title, { px: true, color: K.ink, size: 11.5, weight: 700 });
    draw(x0 + bw / 2, y0 + bh / 2 + 10, bw, bh);
  }
  /** Arrow in pixels from (x, y) along the world direction d (y up), length L, with a label at the head. */
  function parrow(D, x, y, d, L, color, label, lp) {
    const l = L2(d); if (!(l > 1e-12)) return;
    const ux = d[0] / l, uy = -d[1] / l, hx = x + ux * L, hy = y + uy * L;
    D.arrow(D.inv(x, y), D.inv(hx, hy), { color, w: 2.4, head: 10 });
    if (lp) D.text(lp, label, { px: true, color, size: 11, weight: 700, anchor: 'middle' });
    else if (Math.abs(ux) > 0.85) D.text([x + (ux * L) / 2, y + (uy * L) / 2], label, { px: true, color, size: 11, weight: 700, anchor: 'middle', dy: uy > 0 ? -8 : 17 });
    else D.text([hx, hy], label, { px: true, color, size: 11, weight: 700, anchor: ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle', dx: ux > 0.3 ? 4 : ux < -0.3 ? -4 : 0, dy: uy > 0.3 ? 14 : uy < -0.3 ? -5 : 4 });
  }
  const gMark = (D, p, name, o) => {
    o = o || {};
    D.circle(p, 5.5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.4 });
    D.el('path', { d: `M ${D.X(p[0])} ${D.Y(p[1]) - 5.5} A 5.5 5.5 0 0 1 ${D.X(p[0]) + 5.5} ${D.Y(p[1])} L ${D.X(p[0])} ${D.Y(p[1])} Z M ${D.X(p[0])} ${D.Y(p[1]) + 5.5} A 5.5 5.5 0 0 1 ${D.X(p[0]) - 5.5} ${D.Y(p[1])} L ${D.X(p[0])} ${D.Y(p[1])} Z`, fill: K.ink });
    if (name) D.text(p, name, { dx: o.dx === undefined ? 8 : o.dx, dy: o.dy === undefined ? -8 : o.dy, color: K.ink, size: 12.5, weight: 700 });
  };
  const link = (D, a, b, w) => { D.line(a, b, { stroke: LINK, sw: w || 9 }); D.line(a, b, { stroke: '#aab7c4', sw: (w || 9) - 3 }); };
  const ceiling = (D, x0, x1, y, t) => { D.poly([[x0, y], [x1, y], [x1, y + t], [x0, y + t]], { fill: 'url(#hatch)', stroke: 'none' }); D.line([x0, y], [x1, y], { stroke: K.ink, sw: 1.8 }); };

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    return ({ inertia: inertia2D, car: car2D, pend: pend2D, drum: drum2D, roll: roll2D })[g.scene](svg, g, opt);
  };

  /* ---- composite body ---- */
  const rotP = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const swing = () => (uNow() === undefined ? 0 : 25 * D2R * Math.sin(TAU * uNow()));
  function partOutline(q, psi) {
    const c = rotP([q.x, q.y], psi), a = q.ang + psi;
    if (q.t === 'rod' || q.t === 'plate') {
      const w = q.t === 'rod' ? q.a : q.a, h = q.t === 'rod' ? Math.max(q.a * 0.05, 1e-6) : q.b;
      return { kind: 'poly', c, pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map((p) => { const r = rotP(p, a); return [c[0] + r[0], c[1] + r[1]]; }) };
    }
    return { kind: 'circ', c, r: q.t === 'point' ? 0 : q.a };
  }
  function inertiaBounds(g) {
    const xs = [0], ys = [0];
    [-25 * D2R, 0, 25 * D2R].forEach((psi) => g.list.forEach((q) => { const o = partOutline(q, psi); if (o.kind === 'poly') o.pts.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }); else { xs.push(o.c[0] - o.r, o.c[0] + o.r); ys.push(o.c[1] - o.r, o.c[1] + o.r); } }));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = Math.max(x1 - x0, y1 - y0, 1e-6) * 0.18;
    return { xmin: x0 - s, xmax: x1 + s, ymin: y0 - s, ymax: y1 + s };
  }
  function inertia2D(svg, g, opt) {
    const u = g.u, D = UI.Draw2D(svg, inertiaBounds(g), { pad: 30 }), psi = swing();
    const draw = (q) => {
      const o = partOutline(q, psi), hole = q.sg < 0, st = hole ? { fill: '#ffffff', stroke: K.edge, sw: 1.4, dash: '5 4' } : { fill: q.t === 'sphere' ? '#c3cbd3' : K.body, stroke: K.edge, sw: 1.6 };
      if (o.kind === 'poly') { if (q.t === 'rod' && !hole) link(D, o.pts[0].map((v, i) => (v + o.pts[3][i]) / 2), o.pts[1].map((v, i) => (v + o.pts[2][i]) / 2), 9); else D.poly(o.pts, st); }
      else if (q.t === 'point') D.circle(o.c, 6 / D.sc, { fill: hole ? '#fff' : K.ink, stroke: K.ink, sw: 1.2 });
      else if (q.t === 'ring') D.circle(o.c, o.r, { fill: 'none', stroke: hole ? K.edge : LINK, sw: hole ? 1.4 : 6, dash: hole ? '5 4' : undefined });
      else { D.circle(o.c, o.r, st); if (q.t === 'sphere' && !hole) D.circle([o.c[0] - o.r * 0.3, o.c[1] + o.r * 0.3], o.r * 0.25, { fill: '#e6eaee', stroke: 'none' }); }
      if (dopt('nums', true)) D.text(o.c, String(q.i + 1), { dx: 6, dy: 14, color: hole ? K.edge : K.ink, size: 11.5, weight: 700 });
    };
    g.list.filter((q) => q.sg > 0).forEach(draw); g.list.filter((q) => q.sg < 0).forEach(draw);
    DYUI.axes(D, [0, 0], 34 / D.sc);
    D.circle([0, 0], 6 / D.sc, { fill: '#fff', stroke: K.ink, sw: 2 }); D.circle([0, 0], 1.8 / D.sc, { fill: K.ink });
    D.text([0, 0], 'O', { dx: -10, dy: -8, anchor: 'end', color: K.ink, size: 12.5, weight: 700 });
    if (dopt('showG', true)) {
      const G = rotP([g.xg, g.yg], psi);
      if (L2(G) > 1e-9) D.line([0, 0], G, { stroke: K.ic, sw: 1.3, dash: '5 4' });
      gMark(D, G, lbl(opt, `G (d = ${fmt(L2([g.xg, g.yg]))} ${u.L})`, 'G'), { dx: 10, dy: 4 });
    }
    DYUI.title(D, 12, 20, `I_O = ${fmt(g.IO)} ${u.I},  I_G = ${fmt(g.IG)} ${u.I}`);
    return true;
  }

  /* ---- vehicle ---- */
  function car2D(svg, g, opt) {
    const u = g.u, L = g.br + g.bf, rw = Math.min(0.22 * L, 0.85 * g.h), fb = dopt('fbd', true), kd = dopt('kd', true);
    const sD = 0.6 * L, T = g.span[1], t = tNow(g), f = t / T, xs = uNow() === undefined ? 0 : g.a >= 0 ? sD * f * f : sD * (1 - (1 - f) * (1 - f));
    const top = Math.max(2 * g.h, rw * 2.6), D = UI.Draw2D(svg, { xmin: -g.br - 0.45 * L, xmax: g.bf + 0.45 * L + sD, ymin: -0.35 * L, ymax: top + 0.35 * L + 0.3 * L }, opts2(svg, kd));
    DYUI.ground(D, [-g.br - 0.45 * L, 0], [g.bf + 0.45 * L + sD, 0], 0.05 * L);
    const x0 = xs, yb = rw * 0.9, xr = x0 - g.br - 0.28 * L, xf = x0 + g.bf + 0.3 * L, cab = top + 0.28 * L;
    D.poly([[xr, yb], [xf, yb], [xf, top * 0.85], [x0 + g.bf * 0.45, top], [x0 + g.bf * 0.2, cab], [x0 - g.br * 0.55, cab], [x0 - g.br * 0.8, top], [xr, top]], { fill: '#d5dbe1', stroke: K.edge, sw: 1.6 });
    D.poly([[x0 + g.bf * 0.12, top * 1.02], [x0 + g.bf * 0.38, top * 1.02], [x0 + g.bf * 0.17, cab - 0.04 * L], [x0 - g.br * 0.1, cab - 0.04 * L], [x0 - g.br * 0.1, top * 1.02]], { fill: '#eef3f7', stroke: K.edge, sw: 1 });
    const turn = -xs / rw;
    DYUI.wheel(D, [x0 - g.br, rw], rw, turn, { spokes: 3, fill: '#4d5b69', spoke: '#d5dbe1' }); DYUI.wheel(D, [x0 + g.bf, rw], rw, turn, { spokes: 3, fill: '#4d5b69', spoke: '#d5dbe1' });
    D.text([x0 - g.br, 0], 'B', { dx: -14, dy: 16, color: K.ink, size: 12.5, weight: 700 }); D.text([x0 + g.bf, 0], 'A', { dx: 8, dy: 16, color: K.ink, size: 12.5, weight: 700 });
    const G = [x0, g.h]; gMark(D, G, 'G', { dx: -16, dy: -8 });
    if (fb) {
      const fmax = Math.max(g.W, Math.abs(g.F), 1e-9);
      farrow(D, G, [0, -1], g.W, fmax, lbl(opt, `W = ${fmt(g.W)} ${u.F}`, 'W'), { maxPx: g.h * D.sc * 0.75, anchor: 'start', ldx: 6, ldy: 4 });
      farrow(D, [x0 - g.br, 0], [0, 1], g.Nr, fmax, lbl(opt, `N_B = ${fmt(g.Nr)}`, 'N_B'), { head: true });
      farrow(D, [x0 + g.bf, 0], [0, 1], g.Nf, fmax, lbl(opt, `N_A = ${fmt(g.Nf)}`, 'N_A'), { head: true });
      farrow(D, [x0 - g.br, 0], [1, 0], g.Fr, fmax, lbl(opt, `F_B = ${fmt(Math.abs(g.Fr))}`, 'F_B'), { ldy: 18 });
      farrow(D, [x0 + g.bf, 0], [1, 0], g.Ff, fmax, lbl(opt, `F_A = ${fmt(Math.abs(g.Ff))}`, 'F_A'), { ldy: 18 });
    }
    if (kd) kdBox(D, 'Kinetic diagram', (cx, cy, bw) => {
      const w = bw * 0.5, hh = 34;
      D.el('rect', { x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, fill: '#d5dbe1', stroke: K.edge, rx: 6 });
      D.circle(D.inv(cx, cy), 4 / D.sc, { fill: K.ink });
      parrow(D, cx, cy, [Math.sign(g.a) || 1, 0], Math.abs(g.a) > 1e-12 ? 50 : 0, K.acc, lbl(opt, `ma_G = ${fmt(g.m * Math.abs(g.a))} ${u.F}`, 'ma_G'), [cx, cy - hh / 2 - 12]);
      D.text([cx, cy + hh / 2 + 22], 'I_Gα = 0 (translation)', { px: true, anchor: 'middle', color: K.ink, size: 11, weight: 600 });
    });
    DYUI.title(D, 12, 20, `a_G = ${fmt(g.a)} ${u.A}${g.Nf < -1e-9 ? '  (front wheels lift)' : ''}`);
    return true;
  }

  /* ---- pendulum ---- */
  function pendState(g) {
    if (uNow() === undefined) return { th: g.method === 'energy' ? g.th1 : g.th, w: g.method === 'energy' ? g.w1 : g.w };
    const t = tNow(g), s = g.sim; let i = 1; while (i < s.length - 1 && s[i].t < t) i++;
    const a = s[i - 1], b = s[i], f = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
    return { th: a.x + (b.x - a.x) * f, w: a.v + (b.v - a.v) * f };
  }
  function pend2D(svg, g, opt) {
    const u = g.u, b = g.b, rod = g.shape === 'rod', fb = dopt('fbd', true), kd = dopt('kd', true);
    if (g.Fmax === undefined) { // one scale for the whole swing, so the arrows do not pulse while playing
      let F = g.W, Kx = 1e-12; [{ x: g.th, v: g.w }].concat(g.sim).forEach((q) => { const P = g.pinAt(q.x, q.v), a = g.aOf(q.x); F = Math.max(F, Math.abs(P.On), Math.abs(P.Ot)); Kx = Math.max(Kx, b.m * q.v * q.v * b.rG, Math.abs(b.m * a * b.rG)); });
      g.Fmax = F; g.KDmax = Kx;
    }
    const ps = pendState(g), th = uNow() === undefined && g.method === 'energy' ? g.th : ps.th, w = uNow() === undefined && g.method === 'energy' ? g.w : ps.w, al = g.aOf(th), P = g.pinAt(th, w);
    const rD = rod ? b.L : Math.max(1.5 * b.rG, 1.25 * b.k), R = (rod ? b.L : rD) * 1.18, yC = rod ? 0.72 * R : 1.1 * rD;
    const D = UI.Draw2D(svg, { xmin: -R, xmax: R, ymin: -R, ymax: yC + 0.22 * R }, opts2(svg, kd));
    ceiling(D, -0.3 * R, 0.3 * R, yC, 0.08 * R);
    D.line([0, yC], [0, 0], { stroke: K.ink, sw: 2.5 });
    const eG = [Math.cos(th), -Math.sin(th)], G = [b.rG * eG[0], b.rG * eG[1]];
    if (g.method === 'energy' && uNow() === undefined) { const e1 = [Math.cos(g.th1), -Math.sin(g.th1)]; D.line([0, 0], [e1[0] * (rod ? b.L : b.rG), e1[1] * (rod ? b.L : b.rG)], { stroke: K.ghost, sw: 3, dash: '6 5' }); D.text([e1[0] * (rod ? b.L : b.rG), e1[1] * (rod ? b.L : b.rG)], '1', { dx: 6, dy: -6, color: K.ghost, size: 12, weight: 700 }); }
    if (rod) link(D, [0, 0], [b.L * eG[0], b.L * eG[1]], 11);
    else { DYUI.wheel(D, [0, 0], rD, -th, { spokes: 0 }); D.circle(G, 0.22 * rD, { fill: '#7f8c99', stroke: K.edge, sw: 1.2 }); }
    D.circle([0, 0], 5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.8 }); D.text([0, 0], 'O', { dx: -10, dy: -8, anchor: 'end', color: K.ink, size: 12.5, weight: 700 });
    gMark(D, G, 'G', { dx: 6, dy: 18 });
    if (Math.abs(th) > 1e-3) D.arc([0, 0], 30, 0, -th / D2R, lbl(opt, `θ = ${fmt(th / D2R)}°`, 'θ'), { color: K.ink });
    if (fb) {
      const fmax = g.Fmax, n = [-eG[0], -eG[1]], t = [-Math.sin(th), -Math.cos(th)];
      farrow(D, G, [0, -1], g.W, fmax, lbl(opt, `W = ${fmt(g.W)} ${u.F}`, 'W'));
      farrow(D, [0, 0], n, P.On, fmax, lbl(opt, `O_n = ${fmt(Math.abs(P.On))}`, 'O_n'));
      farrow(D, [0, 0], t, P.Ot, fmax, lbl(opt, `O_t = ${fmt(Math.abs(P.Ot))}`, 'O_t'));
      if (g.M) curl(D, [0, 0], g.M, K.force, lbl(opt, `M = ${fmt(Math.abs(g.M))} ${u.MO}`, 'M'), { r: 30, ldy: -4 });
    }
    if (kd) kdBox(D, 'Kinetic diagram', (cx, cy, bw, bh) => {
      const Lp = 46, ex = eG[0], ey = -eG[1];
      D.el('line', { x1: cx - ex * Lp, y1: cy - ey * Lp, x2: cx + ex * Lp, y2: cy + ey * Lp, stroke: LINK, 'stroke-width': 9, 'stroke-linecap': 'round' });
      D.circle(D.inv(cx, cy), 4.5 / D.sc, { fill: K.ink });
      const mn = b.m * w * w * b.rG, mt = b.m * al * b.rG, mx = g.KDmax;
      if (Math.abs(mn) > 1e-9 * mx) parrow(D, cx, cy, [-eG[0], -eG[1]], 24 + 34 * Math.abs(mn) / mx, K.acc, lbl(opt, `mω²r_G = ${fmt(mn)}`, 'mω²r_G'));
      if (Math.abs(mt) > 1e-9 * mx) parrow(D, cx, cy, [-Math.sin(th) * Math.sign(mt), -Math.cos(th) * Math.sign(mt)], 24 + 34 * Math.abs(mt) / mx, K.acc, lbl(opt, `mαr_G = ${fmt(Math.abs(mt))}`, 'mαr_G'));
      if (Math.abs(al) > 1e-12) curlPx(D, cx - bw * 0.3, cy - bh * 0.2, 15, al > 0, K.acc, lbl(opt, `I_Gα = ${fmt(Math.abs(b.IG * al))}`, 'I_Gα'), { ldy: 50, ldx: 8 });
    });
    DYUI.title(D, 12, 20, `θ = ${fmt(th / D2R)}°:  ω = ${fmt(w)} rad/s,  α = ${fmt(al)} rad/s²`);
    return true;
  }

  /* ---- drum and block ---- */
  function drumPos(g) {
    const t = tNow(g), v1 = g.method === 'force' ? 0 : g.v1, s = v1 * t + 0.5 * g.a * t * t, T = g.span[1], sEnd = v1 * T + 0.5 * g.a * T * T;
    return { t, s, v: v1 + g.a * t, kD: Math.min(1, (2.4 * g.r * 1.3) / Math.max(1e-9, sEnd)) };
  }
  function drum2D(svg, g, opt) {
    const u = g.u, r = g.r, Ro = 1.3 * r, fb = dopt('fbd', true), kd = dopt('kd', true), q = drumPos(g), sd = q.s * q.kD;
    const bw = 0.9 * r, bh = 0.7 * r, yTop0 = -1.5 * Ro, yTop = yTop0 - sd;
    const D = UI.Draw2D(svg, { xmin: -2.4 * Ro, xmax: 1.9 * Ro, ymin: yTop0 - 2.4 * Ro * 1.3 - bh - 0.6 * Ro, ymax: 2.2 * Ro }, opts2(svg, kd));
    ceiling(D, -0.8 * Ro, 0.8 * Ro, 1.7 * Ro, 0.12 * Ro);
    D.line([-0.35 * Ro, 1.7 * Ro], [0, 0], { stroke: K.edge, sw: 3 }); D.line([0.35 * Ro, 1.7 * Ro], [0, 0], { stroke: K.edge, sw: 3 });
    DYUI.wheel(D, [0, 0], Ro, sd / r, { spokes: 3, ri: r < Ro ? r : 0 });
    D.circle([0, 0], 5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.8 }); D.text([0, 0], 'O', { dx: 8, dy: -8, color: K.ink, size: 12.5, weight: 700 });
    D.line([-r, 0], [-r, yTop], { stroke: K.ink, sw: 2 });
    DYUI.block(D, [-r, yTop - bh], bw, bh, 0, { label: 'B' });
    if (fb) {
      const fmax = Math.max(g.mD * g.u.g + g.T, g.mb * g.u.g, 1e-9);
      if (g.mD > 0) farrow(D, [0, 0], [0, -1], g.mD * g.u.g, fmax, lbl(opt, `W_D = ${fmt(g.mD * g.u.g)}`, 'W_D'), { ldx: 8, anchor: 'start' });
      farrow(D, [0, 0], [0, 1], g.mD * g.u.g + g.T, fmax, lbl(opt, `O_y = ${fmt(g.mD * g.u.g + g.T)}`, 'O_y'), { ldx: 8, anchor: 'start', ldy: -4 });
      farrow(D, [-r, 0], [0, -1], g.T, fmax, lbl(opt, `T = ${fmt(g.T)}`, 'T'), { ldx: -8, anchor: 'end', maxPx: 0.5 * Ro * D.sc, ldy: 4 });
      farrow(D, [-r, yTop], [0, 1], g.T, fmax, lbl(opt, `T = ${fmt(g.T)}`, 'T'), { ldx: -8, anchor: 'end', maxPx: 0.5 * Ro * D.sc, ldy: 4 });
      farrow(D, [-r, yTop - bh / 2], [0, -1], g.mb * g.u.g, fmax, lbl(opt, `W_B = ${fmt(g.mb * g.u.g)}`, 'W_B'), { ldx: 8, anchor: 'start' });
    }
    if (Math.abs(q.v) > 1e-9) DYUI.vec(D, [-r + bw / 2 + 0.15 * r, yTop - bh / 2], [0, -1], 30 + 20 * Math.min(1, Math.abs(q.v) / Math.max(1e-9, Math.abs(g.v1 + g.a * g.span[1]))), { color: K.vel, label: lbl(opt, `v = ${fmt(q.v)} ${u.V}`, 'v'), size: 11.5, anchor: 'start', ldx: 6, ldy: 8 });
    if (kd) kdBox(D, 'Kinetic diagrams', (cx, cy, w, h) => {
      const dx = -w * 0.2;
      D.el('circle', { cx: cx + dx, cy: cy - h * 0.12, r: 26, fill: '#d5dbe1', stroke: K.edge });
      curlPx(D, cx + dx, cy - h * 0.12, 36, false, K.acc, lbl(opt, `I_Oα = ${fmt(g.IO * g.al)}`, 'I_Oα'), { ldy: -2 });
      D.el('rect', { x: cx + w * 0.22 - 16, y: cy + h * 0.02, width: 32, height: 24, fill: '#d5dbe1', stroke: K.edge });
      parrow(D, cx + w * 0.22, cy + h * 0.02 + 24, [0, -1], 40, K.acc, lbl(opt, `m_Ba = ${fmt(g.mb * g.a)}`, 'm_Ba'));
    });
    DYUI.title(D, 12, 20, `t = ${fmt(q.t)} s:  v = ${fmt(q.v)} ${u.V},  ω = ${fmt(q.v / r)} rad/s`);
    return true;
  }

  /* ---- rolling ---- */
  function rollPos(g) {
    const t = tNow(g), s = g.v1 * t + 0.5 * g.aG * t * t, th = g.w1 * t + 0.5 * g.al * t * t, T = g.span[1];
    let lo = 0, hi = 0; for (let i = 0; i <= 40; i++) { const tt = (T * i) / 40, ss = g.v1 * tt + 0.5 * g.aG * tt * tt; lo = Math.min(lo, ss); hi = Math.max(hi, ss); }
    const k = Math.min(1, (3.5 * g.Ro) / Math.max(1e-9, hi - lo));
    return { t, s: s * k, th: th * k, lo: lo * k, hi: hi * k, v: g.v1 + g.aG * t, w: g.w1 + g.al * t };
  }
  function roll2D(svg, g, opt) {
    const u = g.u, fb = dopt('fbd', true), kd = dopt('kd', true), q = rollPos(g), R = g.R, Ro = g.Ro;
    const e = [Math.cos(g.phi), -Math.sin(g.phi)], n = [Math.sin(g.phi), Math.cos(g.phi)], at = (s, h) => [s * e[0] + h * n[0], s * e[1] + h * n[1]];
    const pts = [at(q.lo - 1.5 * Ro, 0), at(q.hi + 1.5 * Ro, 0), at(q.lo - 1.5 * Ro, R + Ro * 1.7), at(q.hi + 1.5 * Ro, R + Ro * 1.7), at(q.lo, -0.8 * Ro), at(q.hi, -0.8 * Ro)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) }, opts2(svg, kd));
    const C = at(q.s, 0), G = at(q.s, R);
    if (g.cord) {
      const Sp = at(q.lo - 1.8 * Ro, 0);
      D.line(C, Sp, { stroke: K.ink, sw: 2.5 });
      const hx = [-n[0] * 0.25 * Ro, -n[1] * 0.25 * Ro], tx = [e[0] * 0.4 * Ro, e[1] * 0.4 * Ro];
      D.poly([[Sp[0] - tx[0], Sp[1] - tx[1]], [Sp[0] + tx[0], Sp[1] + tx[1]], [Sp[0] + tx[0] + hx[0], Sp[1] + tx[1] + hx[1]], [Sp[0] - tx[0] + hx[0], Sp[1] - tx[1] + hx[1]]], { fill: 'url(#hatch)', stroke: K.ink });
    } else {
      DYUI.ground(D, at(q.lo - 1.5 * Ro, 0), at(q.hi + 1.5 * Ro, 0), 0.18 * Ro);
      if (g.phi > 1e-6) { const a0 = at(q.hi + 1.5 * Ro, 0); D.line(a0, [a0[0] - 1.6 * Ro, a0[1]], { stroke: K.ink, sw: 1, dash: '5 4' }); D.arc(a0, 34, 180, 180 - g.phi / D2R, lbl(opt, `φ = ${fmt(g.phi / D2R)}°`, 'φ'), { color: K.ink }); }
    }
    DYUI.wheel(D, G, Ro, -q.th, { spokes: 3, ri: R < Ro - 1e-9 ? R : 0 });
    gMark(D, G, 'G', { dx: 10, dy: 18 });
    D.text(C, 'A', { dx: 8, dy: 14, color: K.ink, size: 12.5, weight: 700 });
    const Pp = at(q.s, R + g.yP);
    if (g.P) D.circle(Pp, 3.5 / D.sc, { fill: K.force });
    if (fb) {
      const fmax = Math.max(g.W, Math.abs(g.N), Math.abs(g.F), Math.abs(g.P), 1e-9);
      farrow(D, G, [0, -1], g.W, fmax, lbl(opt, `W = ${fmt(g.W)} ${u.F}`, 'W'), { ldx: 6, anchor: 'start', ldy: 4, maxPx: g.phi < 0.35 ? R * D.sc * 0.8 : 1e9 });
      if (!g.cord) farrow(D, C, n, g.N, fmax, lbl(opt, `N = ${fmt(g.N)}`, 'N'), { head: true });
      farrow(D, C, e, g.F, fmax, lbl(opt, `${g.cord ? 'T' : 'F'} = ${fmt(Math.abs(g.F))}`, g.cord ? 'T' : 'F'), { ldy: 18 });
      if (g.P) farrow(D, Pp, e, g.P, fmax, lbl(opt, `P = ${fmt(Math.abs(g.P))}`, 'P'));
      if (g.M) curl(D, G, g.M, K.force, lbl(opt, `M = ${fmt(Math.abs(g.M))} ${u.MO}`, 'M'), { r: 24 });
    }
    if (Math.abs(q.v) > 1e-9) DYUI.vec(D, G, [e[0] * Math.sign(q.v), e[1] * Math.sign(q.v)], 30 + 26 * Math.min(1, Math.abs(q.v) / Math.max(1e-9, Math.abs(g.v1) + Math.abs(g.aG * g.span[1]))), { color: K.vel, label: lbl(opt, `v_G = ${fmt(q.v)} ${u.V}`, 'v_G'), size: 11.5, ldy: -10 });
    if (kd) kdBox(D, 'Kinetic diagram', (cx, cy, w, h) => {
      D.el('circle', { cx, cy, r: 30, fill: '#d5dbe1', stroke: K.edge }); D.circle(D.inv(cx, cy), 4 / D.sc, { fill: K.ink });
      if (Math.abs(g.aG) > 1e-12) parrow(D, cx, cy, [e[0] * Math.sign(g.aG), e[1] * Math.sign(g.aG)], 54, K.acc, lbl(opt, `ma_G = ${fmt(Math.abs(g.m * g.aG))}`, 'ma_G'), [cx, cy - 62]);
      if (Math.abs(g.al) > 1e-12) curlPx(D, cx, cy, 42, g.al > 0, K.acc, lbl(opt, `I_Gα = ${fmt(Math.abs(g.IG * g.al))}`, 'I_Gα'), { ldy: 2 * 42 + 26 });
    });
    DYUI.title(D, 12, 20, `${g.slip ? 'Slipping' : g.cord ? 'Rolling on the cord' : 'Rolling without slipping'}:  a_G = ${fmt(g.aG)} ${u.A},  α = ${fmt(g.al)} rad/s²`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Plots                                                              */
  /* ------------------------------------------------------------------ */
  M.plot = function (svg, res) {
    const g = res.geo; if (!g) return false;
    if (g.scene === 'inertia') return DYUI.bars(svg, g.list.map((q) => ({ name: `Part ${q.i + 1}`, sub: RbForce.SHAPES[q.t].name.split(' ')[0] + (q.sg < 0 ? ' (hole)' : ''), v: q.sg * q.Ii, color: q.sg < 0 ? CB : CA })).concat([{ name: 'Total I_O', v: g.IO, color: K.ink }]), { title: 'I_O', unit: g.u.I });
    if (g.scene === 'car') {
      const a0 = Math.min(0, g.a) - 0.5, a1 = Math.max(g.aLift, g.a) * 1.05, A = [], B = [], L = g.br + g.bf;
      for (let i = 0; i <= 60; i++) { const a = a0 + ((a1 - a0) * i) / 60, Nf = (g.br * g.W - g.h * g.m * a) / L; A.push([a, Nf]); B.push([a, g.W - Nf]); }
      return DYUI.stack(svg, [{ label: `N (${g.u.F})`, color: CA, pts: A, at: (a) => (g.br * g.W - g.h * g.m * a) / L, more: [{ pts: B, color: CB, at: (a) => g.W - (g.br * g.W - g.h * g.m * a) / L }] }], { xlabel: `a_G (${g.u.A})   blue: front N_A, orange: rear N_B`, cursor: g.a, xmin: a0, xmax: a1 });
    }
    if (g.scene === 'pend') {
      const xs = g.sim.map((s) => s.x); let lo = Math.min(...xs, g.th), hi = Math.max(...xs, g.th); if (hi - lo < 1e-3) { lo -= 0.5; hi += 0.5; }
      const W = [], On = [], Ot = [];
      for (let i = 0; i <= 120; i++) { const x = lo + ((hi - lo) * i) / 120, w = g.wAt(x); if (!isFinite(w)) continue; const P = g.pinAt(x, w); W.push([x / D2R, w]); On.push([x / D2R, P.On]); Ot.push([x / D2R, P.Ot]); }
      const cur = pendState(g).th;
      const thc = uNow() === undefined ? g.th : cur;
      return DYUI.stack(svg, [{ label: '|ω| (rad/s)', color: CA, pts: W, at: (d) => g.wAt(d * D2R) }, { label: `O (${g.u.F})`, color: CB, pts: On, at: (d) => g.pinAt(d * D2R, g.wAt(d * D2R)).On, more: [{ pts: Ot, color: K.acc, at: (d) => g.pinAt(d * D2R, g.wAt(d * D2R)).Ot }] }], { xlabel: 'θ (°)   orange: O_n, purple: O_t', cursor: thc / D2R, xmin: lo / D2R, xmax: hi / D2R });
    }
    const T = g.span[1], v0 = g.scene === 'drum' ? (g.method === 'force' ? 0 : g.v1) : g.v1, a = g.scene === 'drum' ? g.a : g.aG, al = g.scene === 'drum' ? g.al : g.al, w0 = g.scene === 'drum' ? v0 / g.r : g.w1, V = [], Wl = [];
    for (let i = 0; i <= 60; i++) { const t = (T * i) / 60; V.push([t, v0 + a * t]); Wl.push([t, w0 + al * t]); }
    return DYUI.stack(svg, [{ label: g.scene === 'drum' ? `v_B (${g.u.V})` : `v_G (${g.u.V})`, color: CA, pts: V, at: (t) => v0 + a * t }, { label: 'ω (rad/s)', color: CB, pts: Wl, at: (t) => w0 + al * t }], { xlabel: 't (s)', cursor: tNow(g), xmin: 0, xmax: T });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  const circ = (c, R, n) => { const p = []; for (let i = 0; i < (n || 32); i++) { const a = (i / (n || 32)) * TAU; p.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]); } return p; };
  function slab(v, a, b, w, z0, z1, col) {
    const d = [b[0] - a[0], b[1] - a[1]], l = L2(d) || 1, n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2];
    v.extrude([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], z0, z1, col, 1, K.edge);
  }
  function disk(v, c, R, z0, z1, col, th) {
    v.extrude(circ(c, R), z0, z1, col, 1, null);
    if (th !== null) v.line([[c[0], c[1], z1 + 1e-3], [c[0] + R * Math.cos(th || 0), c[1] + R * Math.sin(th || 0), z1 + 1e-3]], K.ink, 2);
  }
  M.draw3D = function (v, res) {
    const g = res.geo;
    if (g.scene === 'inertia') {
      const psi = swing(), B = inertiaBounds(g), sz = Math.max(B.xmax - B.xmin, B.ymax - B.ymin), t = 0.05 * sz;
      g.list.forEach((q) => {
        const o = partOutline(q, psi), hole = q.sg < 0;
        if (hole) { if (o.kind === 'poly') v.face(o.pts.map((p) => [p[0], p[1], t / 2 + 2e-3 * sz]), '#33404c', 1, null); else if (o.r > 0) v.face(circ(o.c, o.r).map((p) => [p[0], p[1], t / 2 + 2e-3 * sz]), '#33404c', 1, null); return; }
        if (q.t === 'sphere') DYUI.sphere(v, [o.c[0], o.c[1], 0], o.r, '#c3cbd3');
        else if (q.t === 'point') DYUI.sphere(v, [o.c[0], o.c[1], 0], 0.02 * sz, '#4d5b69');
        else if (q.t === 'ring') { const P = circ(o.c, o.r, 24); P.forEach((p, i) => slab(v, p, P[(i + 1) % 24], Math.max(0.03 * sz, 0.12 * o.r), -t / 2, t / 2, '#aab7c4')); }
        else if (o.kind === 'poly') { if (q.t === 'rod') slab(v, o.pts[0].map((x, i) => (x + o.pts[3][i]) / 2), o.pts[1].map((x, i) => (x + o.pts[2][i]) / 2), Math.max(0.03 * sz, 0.05 * q.a), -t / 2, t / 2, '#aab7c4'); else v.extrude(o.pts, -t / 2, t / 2, '#c3cbd3', 1, K.edge); }
        else v.extrude(circ(o.c, o.r), -t / 2, t / 2, '#c3cbd3', 1, null);
      });
      v.line([[0, 0, -0.35 * sz], [0, 0, 0.35 * sz]], K.ink, 2.5);
      v.setBounds([B.xmin, B.ymin, -0.35 * sz], [B.xmax, B.ymax, 0.35 * sz]); return;
    }
    if (g.scene === 'car') {
      const L = g.br + g.bf, rw = Math.min(0.22 * L, 0.85 * g.h), T = g.span[1], f = tNow(g) / T, sD = 0.6 * L, xs = uNow() === undefined ? 0 : g.a >= 0 ? sD * f * f : sD * (1 - (1 - f) * (1 - f)), top = Math.max(2 * g.h, rw * 2.6), tw = 0.32 * L;
      DYUI.floor3(v, -g.br - 0.45 * L, g.bf + 0.45 * L + sD, 0, 0.5 * L);
      v.box(xs - g.br - 0.28 * L, rw * 0.9, -tw, xs + g.bf + 0.3 * L, top, tw, '#d5dbe1', 1, K.edge);
      v.box(xs - g.br * 0.55, top, -tw * 0.85, xs + g.bf * 0.2, top + 0.28 * L, tw * 0.85, '#eef3f7', 1, K.edge);
      [xs - g.br, xs + g.bf].forEach((x) => [tw + 0.02 * L, -tw - 0.02 * L - 0.12 * L].forEach((z) => disk(v, [x, rw], rw, z, z + 0.12 * L, '#4d5b69', z > 0 ? -xs / rw : null)));
      v.setBounds([-g.br - 0.45 * L, 0, -0.5 * L], [g.bf + 0.45 * L + sD, top + 0.4 * L, 0.5 * L]); return;
    }
    if (g.scene === 'pend') {
      const b = g.b, ps = pendState(g), th = uNow() === undefined && g.method === 'energy' ? g.th : ps.th, eG = [Math.cos(th), -Math.sin(th)], rod = g.shape === 'rod', R = rod ? b.L : Math.max(1.5 * b.rG, 1.25 * b.k);
      if (rod) slab(v, [0, 0], [b.L * eG[0], b.L * eG[1]], 0.06 * b.L, -0.03 * b.L, 0.03 * b.L, '#aab7c4');
      else { disk(v, [0, 0], R, -0.08 * R, 0.08 * R, '#c3cbd3', null); DYUI.sphere(v, [b.rG * eG[0], b.rG * eG[1], 0.08 * R], 0.15 * R, '#7f8c99'); }
      const yC = rod ? 0.4 * R : 1.12 * R, zb = rod ? -0.3 * R : -0.2 * R;
      v.line([[0, 0, zb], [0, 0, 0.3 * R]], K.ink, 2.5); v.box(-0.3 * R, yC, zb - 0.1 * R, 0.3 * R, yC + 0.08 * R, 0.3 * R, '#d5dbe1', 1, K.edge); slab(v, [0, 0], [0, yC], 0.05 * R, zb - 0.05 * R, zb, '#7f8c99');
      v.setBounds([-R * 1.1, -R * 1.1, -0.4 * R], [R * 1.1, yC + 0.1 * R, 0.4 * R]); return;
    }
    if (g.scene === 'drum') {
      const r = g.r, Ro = 1.3 * r, q = drumPos(g), sd = q.s * q.kD, yTop = -1.5 * Ro - sd, bw = 0.9 * r, bh = 0.7 * r;
      disk(v, [0, 0], Ro, 0.12 * r, 0.3 * r, '#c3cbd3', sd / r); v.extrude(circ([0, 0], r), -0.12 * r, 0.12 * r, '#aab7c4', 1, null); disk(v, [0, 0], Ro, -0.3 * r, -0.12 * r, '#c3cbd3', null);
      slab(v, [-r - 0.012 * r, 0], [-r - 0.012 * r, yTop], 0.025 * r, -0.02 * r, 0.02 * r, '#1d2733');
      v.box(-r - bw / 2, yTop - bh, -bw / 2, -r + bw / 2, yTop, bw / 2, '#c3cbd3', 1, K.edge);
      v.line([[0, 0, -0.5 * r], [0, 0, 0.5 * r]], K.ink, 2.5); v.box(-0.8 * Ro, 1.7 * Ro, -0.6 * r, 0.8 * Ro, 1.82 * Ro, 0.6 * r, '#d5dbe1', 1, K.edge);
      slab(v, [0, 0], [0, 1.7 * Ro], 0.08 * r, 0.36 * r, 0.44 * r, '#7f8c99'); slab(v, [0, 0], [0, 1.7 * Ro], 0.08 * r, -0.44 * r, -0.36 * r, '#7f8c99');
      v.setBounds([-2 * Ro, -1.5 * Ro - 2.4 * Ro * 1.3 - bh, -Ro], [1.5 * Ro, 1.9 * Ro, Ro]); return;
    }
    const q = rollPos(g), R = g.R, Ro = g.Ro, e = [Math.cos(g.phi), -Math.sin(g.phi)], n = [Math.sin(g.phi), Math.cos(g.phi)], at = (s, h) => [s * e[0] + h * n[0], s * e[1] + h * n[1]];
    const s0 = q.lo - 2 * Ro, s1 = q.hi + 2 * Ro, G = at(q.s, R), dz = 0.6 * Ro;
    if (g.cord) { const A = at(q.s, 0), B = at(s0, 0); slab(v, [A[0] - n[0] * 0.012 * Ro, A[1] - n[1] * 0.012 * Ro], [B[0] - n[0] * 0.012 * Ro, B[1] - n[1] * 0.012 * Ro], 0.025 * Ro, -0.03 * Ro, 0.03 * Ro, '#1d2733'); }
    else if (g.phi > 1e-6) { const A = at(s0, 0), B = at(s1, 0); v.extrude([A, B, [A[0], B[1]]], -dz, dz, '#d5dbe1', 1, K.edge); }
    else DYUI.floor3(v, at(s0, 0)[0], at(s1, 0)[0], 0, dz);
    disk(v, G, Ro, -0.35 * Ro, -0.12 * Ro, '#c3cbd3', null); v.extrude(circ(G, R), -0.12 * Ro, 0.12 * Ro, '#aab7c4', 1, null); disk(v, G, Ro, 0.12 * Ro, 0.35 * Ro, '#c3cbd3', -q.th);
    const P = [at(s0, 0), at(s1, 0), at(s0, R + 2 * Ro), at(s1, R + 2 * Ro)];
    v.setBounds([Math.min(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), -dz], [Math.max(...P.map((p) => p[0])), Math.max(...P.map((p) => p[1])), dz]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(RbForce.defaults(), o);
  M.presets = [
    { name: 'Test: Book Example 17.3, 250 mm disk with a 125 mm hole, about the rim point O (I_O = 1.20 kg·m²)', units: 'SI', state: P0({ scene: 'inertia', parts: [{ t: 'disk', m: 15.71, a: 0.25, b: 0, x: 0, y: 0.25, ang: 0, rm: 'add' }, { t: 'disk', m: 3.927, a: 0.125, b: 0, x: 0, y: 0.25, ang: 0, rm: 'remove' }] }),
      expect: [{ k: 'Moment of inertia about O, I_O', v: 1.197 }] },
    { name: 'Test: Book Example 17.4, T-shaped pendulum of two rods, 10 lb and 8 lb (I_O = 1.45, I_G = 0.288 slug·ft²)', units: 'US', state: P0({ scene: 'inertia', parts: [{ t: 'rod', m: 10, a: 2, b: 0, x: 0, y: -1, ang: 90, rm: 'add' }, { t: 'rod', m: 8, a: 1.5, b: 0, x: 0, y: -2, ang: 0, rm: 'add' }] }),
      expect: [{ k: 'Moment of inertia about O, I_O', v: 1.454 }, { k: 'Moment of inertia about G, I_G', v: 0.2881 }, { k: 'Distance from O to G', v: 1.444 }] },
    { name: 'Test: Book Example 17.5, 2 Mg car with spinning rear wheels, μ_k = 0.25 (a_G = 1.59 m/s², N_A = 6.88 kN)', units: 'SI', state: P0({ scene: 'car', cm: 2000, h: 0.3, br: 0.75, bf: 1.25, drive: 'rear', cmuk: 0.25 }),
      expect: [{ k: 'Acceleration a_G', v: 1.593 }, { k: 'Front normal force N_A', v: 6880 }, { k: 'Rear normal force N_B', v: 12740 }] },
    { name: 'Test: Book Example 17.6, motorcycle and rider doing a wheelie (a_G = 8.95 m/s², μ_s min = 0.912)', units: 'SI', state: P0({ scene: 'car', cm: 200, h: 0.7125, br: 0.65, bf: 0.85, drive: 'wheelie' }),
      expect: [{ k: 'Acceleration a_G', v: 8.949 }, { k: 'Friction needed at the rear, μ_s min', v: 0.9123 }] },
    { name: 'Test: Book Example 17.8, unbalanced 50 lb flywheel released from rest (α = 26.4 rad/s², O_t = 29.5 lb)', units: 'US', state: P0({ scene: 'pend', method: 'force', shape: 'body', pm: 50, kG: 0.6, rG: 0.5, th: 0, w: 0, M: 0 }),
      expect: [{ k: 'Angular acceleration α (+ clockwise)', v: 26.39 }, { k: 'Pin force across OG, O_t', v: -29.51 }, { k: 'Pin force along OG, O_n', v: 0 }] },
    { name: 'Test: Book Example 17.11, slender rod released level, at the vertical (O_n = 2.5mg = 245 N for 10 kg)', units: 'SI', state: P0({ scene: 'pend', method: 'energy', shape: 'rod', pm: 10, pL: 2, th: 0, w: 0, M: 0, th2: 90 }),
      expect: [{ k: 'Pin force along OG, O_n', v: 245.25 }, { k: 'Angular velocity at θ₂, ω₂', v: 3.836 }] },
    { name: 'Test: Book Example 17.10, 60 kg drum (k_O = 0.25 m) lowering a 20 kg block (α = 11.3 rad/s²)', units: 'SI', state: P0({ scene: 'drum', method: 'force', Iby: 'k', dm: 60, kO: 0.25, dr: 0.4, bm: 20, Mf: 0 }),
      expect: [{ k: 'Angular acceleration of the drum α', v: 11.29 }, { k: 'Cord tension T', v: 105.9 }] },
    { name: 'Test: Book Example 19.4, 6 kg cylinder on a disk (I = 0.40 kg·m²), 2 m/s, after 3 s (v = 13.0 m/s)', units: 'SI', state: P0({ scene: 'drum', method: 'impulse', Iby: 'I', IO: 0.4, dm: 20, dr: 0.2, bm: 6, Mf: 0, dv1: 2, dt: 3 }),
      expect: [{ k: 'Speed of the block v₂', v: 13.04 }] },
    { name: 'Test: Book Example 17.13, 50 lb wheel driven by a 35 lb·ft couple, slips (a_G = 8.05 ft/s²)', units: 'US', state: P0({ scene: 'roll', method: 'force', surf: 'ground', rm: 50, rk: 0.7, R: 1.25, Ro: 1.25, phi: 0, RM: 35, P: 0, yP: 0, mus: 0.3, muk: 0.25 }),
      expect: [{ k: 'Acceleration of G, a_G', v: 8.05 }, { k: 'Angular acceleration α (+ clockwise)', v: 25.46 }] },
    { name: 'Test: Book Example 17.12, 8 kg spool pulled up its cord by 100 N (α = 10.3 rad/s², T = 19.8 N)', units: 'SI', state: P0({ scene: 'roll', method: 'force', surf: 'cord', rm: 8, rk: 0.35, R: 0.5, Ro: 0.5, phi: 90, RM: 0, P: -100, yP: 0.2 }),
      expect: [{ k: 'Angular acceleration α (+ clockwise)', v: -10.32 }, { k: 'Acceleration of G, a_G', v: -5.161 }] },
    { name: 'Solid cylinder rolling 3 m down a 30° slope from rest (work and energy)', units: 'SI', state: P0({ scene: 'roll', method: 'energy', surf: 'ground', rm: 10, rk: 0.1414, R: 0.2, Ro: 0.2, phi: 30, RM: 0, P: 0, yP: 0, mus: 0.5, muk: 0.4, rv1: 0, rs: 3 }) },
    { name: 'Edge: rod released 60° above the level cannot climb to 70° (fails on purpose)', units: 'SI', fails: true, state: P0({ scene: 'pend', method: 'energy', shape: 'rod', pm: 1, pL: 1, th: -60, w: 0, M: 0, th2: -70 }) },
  ];

  root.DRbForce = M;
})(window);
