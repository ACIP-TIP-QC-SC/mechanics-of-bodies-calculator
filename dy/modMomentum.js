/* =====================================================================
 * DYNAMICS · Impulse and momentum without a collision (inputs, diagrams, presets).
 * Physics: dy/momentum.js. The Impact module (dy/modImpact.js) hands these modes to this file.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', AFT = '#1e8449', D2R = Math.PI / 180;
  const MODES = ['ft', 'cons', 'angmom', 'stream', 'vary'];
  const lbl = (opt, a, b) => (opt.showP ? a : b);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  function controls(c, C, st, u) {
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const ml = u.us ? 'weight W' : 'mass m', mu = u.us ? 'lb/s (weight)' : 'kg/s';
    let sec;
    if (st.mode === 'ft') {
      sec = C.section(c, 'Body');
      num(sec, 'fm', 'Body: ' + ml, u.M); num(sec, 'fth', 'Angle of the motion θ (0 level, 90 straight up)', '°');
      num(sec, 'fv1', 'Velocity at t = 0, v₁ (+ along F)', u.V); num(sec, 'fmus', 'Static friction μ_s (0 if smooth)', ''); num(sec, 'fmuk', 'Kinetic friction μ_k', '');
      C.num(sec, { label: 'Cable segments pulling (F is multiplied by this)', get: () => st.fn, set: (v) => (st.fn = v), step: 1 });
      sec = C.section(c, 'Force–time graph');
      C.note(sec, 'Points of the graph in order of time; F is a straight line between them and zero outside.');
      C.list(sec, { items: st.fpts, max: 8, min: 2, color: () => '#f6c9c2', title: (it, i) => `Point ${i + 1}`, fields: () => [{ key: 't', label: 't', unit: 's' }, { key: 'F', label: 'F', unit: u.F }], add: [['Point', () => { const l = st.fpts[st.fpts.length - 1] || { t: 0, F: 0 }; return { t: +l.t + 1, F: +l.F }; }]] });
      sec = C.section(c, 'Find');
      num(sec, 'ft', 'Velocity and distance at time t₂', 's');
    } else if (st.mode === 'cons') {
      C.seg(c, { label: 'Situation', get: () => st.ctask, set: (v) => (st.ctask = v), options: [['release', 'A spring pushes them apart'], ['throw', 'A throws B'], ['slide', 'Block slides onto a cart']] });
      sec = C.section(c, 'Bodies');
      const nA = st.ctask === 'slide' ? 'Block A' : st.ctask === 'throw' ? 'A (the thrower)' : 'A (left)', nB = st.ctask === 'slide' ? 'Cart B' : st.ctask === 'throw' ? 'B (thrown)' : 'B (right)';
      num(sec, 'cmA', `${nA}: ${ml}`, u.M); num(sec, 'cmB', `${nB}: ${ml}`, u.M);
      if (st.ctask !== 'slide') num(sec, 'cv0', 'Common velocity before (0 from rest)', u.V);
      if (st.ctask === 'release') { num(sec, 'ck', 'Spring stiffness k', u.K); num(sec, 'cs', 'Compression s', u.L); }
      else if (st.ctask === 'throw') { num(sec, 'cvr', 'Speed of B relative to A', u.V); num(sec, 'cphi', 'Angle of the throw above the horizontal (+x)', '°'); num(sec, 'cdt', 'Time the throw takes (0 to skip the reaction)', 's'); }
      else {
        C.toggle(sec, { label: 'The block comes down a smooth ramp from rest', get: () => !!st.cramp, set: (v) => (st.cramp = v) });
        if (st.cramp) num(sec, 'ch', 'Height of the ramp h', u.L); else num(sec, 'cv0', 'Speed of the block onto the cart', u.V);
        num(sec, 'cmuk', 'Kinetic friction between block and cart μ_k', ''); num(sec, 'cL', 'Length of the cart (0 to skip)', u.L);
      }
    } else if (st.mode === 'angmom') {
      C.seg(c, { label: 'Situation', get: () => st.atask, set: (v) => (st.atask = v), options: [['torque', 'A moment M(t) turns particles on a frame'], ['pull', 'A cable pulls a particle in toward O']] });
      sec = C.section(c, 'Particles');
      num(sec, 'am', `Each particle: ${ml}`, u.M);
      if (st.atask === 'torque') {
        C.num(sec, { label: 'Number of particles n', get: () => st.an, set: (v) => (st.an = v), step: 1 });
        num(sec, 'ar', 'Distance of each from the axis r', u.L); num(sec, 'av1', 'Speed at t = 0', u.V);
        C.text(sec, { label: `Moment M(t) (${u.MO}, t in s)`, get: () => st.aM, set: (v) => (st.aM = v) });
        num(sec, 'at', 'Find the speed at time t', 's');
      } else { num(sec, 'ar1', 'Radius at the start r₁', u.L); num(sec, 'av1', 'Speed at the start v₁', u.V); num(sec, 'ardot', 'Rate the cable is pulled in', u.V); num(sec, 'at', 'Time t', 's'); }
    } else if (st.mode === 'stream') {
      sec = C.section(c, 'Fluid');
      num(sec, 'rho', `Density ρ (${u.us ? 'slug/ft³' : 'kg/m³'})`, '');
      sec = C.section(c, 'Openings');
      C.note(sec, 'Each opening: where it is, which way the fluid moves there (counterclockwise from +x), its speed and area, and its gage pressure.');
      C.list(sec, { items: st.ports, max: 5, min: 2, color: (it) => (it.io === 'in' ? '#cfe0f0' : '#cfe8d8'), title: (it, i) => `Opening ${i + 1}: ${it.io === 'in' ? 'in' : 'out'}`,
        fields: () => [{ key: 'io', label: 'Flow', options: [['in', 'In'], ['out', 'Out']] }, { key: 'v', label: 'Speed v', unit: u.V }, { key: 'ang', label: 'Direction', unit: '°' }, { key: 'A', label: 'Area A', unit: `${u.L}²` }, { key: 'x', label: 'x', unit: u.L }, { key: 'y', label: 'y', unit: u.L }, { key: 'p', label: 'Gage pressure p', unit: u.us ? 'lb/ft²' : 'Pa', wide: true }],
        add: [['Opening', () => ({ io: 'out', x: 1, y: 1, v: 10, ang: 90, A: 0.01, p: 0 })]] });
      sec = C.section(c, 'Supports');
      C.seg(sec, { get: () => st.sup, set: (v) => (st.sup = v), options: [['none', 'Force and moment about O'], ['pinroller', 'A pin and a roller']] });
      if (st.sup === 'pinroller') { num(sec, 'px', 'Pin x', u.L); num(sec, 'py', 'Pin y', u.L); num(sec, 'qx', 'Roller x', u.L); num(sec, 'qy', 'Roller y', u.L); num(sec, 'qang', 'Direction of the roller reaction', '°'); }
    } else {
      sec = C.section(c, 'Body');
      num(sec, 'vm0', `Starting ${ml}`, u.M); num(sec, 'vv0', 'Starting velocity v₀', u.V); num(sec, 'vth', 'Angle of the motion θ (0 level, 90 straight up)', '°');
      sec = C.section(c, 'Mass gained');
      num(sec, 'vmi', `Rate gained ṁ_in (${mu})`, ''); num(sec, 'vvi', 'Velocity of that mass along the motion v_in', u.V);
      sec = C.section(c, 'Mass ejected');
      num(sec, 'vme', `Rate ejected ṁ_out (${mu})`, ''); num(sec, 'vu', 'Speed it leaves at, relative to the body u_rel', u.V);
      sec = C.section(c, 'Other forces and time');
      num(sec, 'vF', 'Constant force F along the motion', u.F); num(sec, 'vc', `Drag F_D = c v²: c (${u.F}·s²/${u.L}²)`, ''); num(sec, 'vt', 'Find the velocity at time t', 's');
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  function draw2D(svg, g, opt, uNow) {
    return ({ ft: ft2D, cons: cons2D, angmom: ang2D, stream: stream2D, vary: vary2D })[g.mode](svg, g, opt, uNow);
  }
  const tAt = (g, uNow) => (uNow === undefined ? g.span[1] : g.span[0] + (g.span[1] - g.span[0]) * uNow);
  const hAt = (hist, t) => { const T = hist[hist.length - 1][0], i = Math.max(0, Math.min(hist.length - 1, Math.round((t / (T || 1)) * (hist.length - 1)))); return hist[i]; };

  function ft2D(svg, g, opt, uNow) {
    const u = g.u, th = g.th * D2R, lift = Math.abs(g.th) > 80, e = [Math.cos(th), Math.sin(th)], nr = [-Math.sin(th), Math.cos(th)], Ls = 8, t = tAt(g, uNow), h = hAt(g.hist, t);
    const smax = Math.max(1e-9, ...g.hist.map((x) => Math.abs(x[2]))), s = 1 + (h[2] / smax) * (Ls - 3) * (g.s >= 0 ? 1 : -1) + (g.s < 0 ? Ls - 3 : 0);
    const D = UI.Draw2D(svg, { xmin: Math.min(0, Ls * e[0]) - 1.6, xmax: Math.max(0, Ls * e[0]) + 2.2, ymin: Math.min(0, Ls * e[1]) - 1, ymax: Math.max(0, Ls * e[1]) + 2.2 }, { pad: 26 });
    if (th > 0 && !lift) D.poly([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 });
    else if (lift) { D.line([-0.9, 0], [-0.9, Ls + 0.5], { stroke: K.edge, sw: 3 }); D.line([0.9, 0], [0.9, Ls + 0.5], { stroke: K.edge, sw: 3 }); DYUI.ground(D, [-1.6, 0], [1.6, 0]); }
    else DYUI.ground(D, [-0.4, 0], [Ls + 0.4, 0]);
    const w = lift ? 1.2 : 1.4, hb = 0.9, base = lift ? [0, s] : [s * e[0], s * e[1]];
    DYUI.block(D, base, w, hb, lift ? 0 : th, { fill: '#cfe0f0' });
    const ctr = lift ? [0, s + hb / 2] : [base[0] + nr[0] * hb / 2, base[1] + nr[1] * hb / 2], dir = lift ? [0, 1] : e;
    const Fn = g.F(Math.min(t, g.T)) * g.n, Fmax = Math.max(1e-9, ...g.pts.map((p) => Math.abs(p[1]))) * g.n;
    const front = lift ? [0, s + hb] : [ctr[0] + e[0] * w / 2, ctr[1] + e[1] * w / 2];
    if (Math.abs(Fn) > 1e-9 * Fmax) DYUI.vec(D, front, [dir[0] * Math.sign(Fn), dir[1] * Math.sign(Fn)], 20 + 50 * Math.abs(Fn) / Fmax, { color: K.force, label: lbl(opt, `${g.n > 1 ? g.n : ''}F = ${fmt(Fn)} ${u.F}`, `${g.n > 1 ? g.n : ''}F`), size: 11.5 });
    const v = h[1];
    if (Math.abs(v) > 1e-9) { const p = lift ? [ctr[0] - w / 2 - 0.25, ctr[1]] : [ctr[0] + nr[0] * (hb / 2 + 0.4), ctr[1] + nr[1] * (hb / 2 + 0.4)]; DYUI.vec(D, p, [dir[0] * Math.sign(v), dir[1] * Math.sign(v)], 40, { color: AFT, label: lbl(opt, `v = ${fmt(v)} ${u.V}`, 'v'), size: 11.5, anchor: lift ? 'end' : 'start', ldx: lift ? -6 : 6 }); }
    if (!lift && g.th > 0.01) D.arc([0.9, 0], 34, 0, g.th, `θ = ${fmt(g.th)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, `t = ${fmt(t)} s, v = ${fmt(v)} ${u.V}, s = ${fmt(h[2])} ${u.L}`);
    return true;
  }

  function cons2D(svg, g, opt, uNow) {
    const u = g.u, D = UI.Draw2D(svg, { xmin: -7, xmax: 7, ymin: -2.4, ymax: 3.6 }, { pad: 24 }), w = (uNow === undefined ? 1 : uNow);
    DYUI.ground(D, [-7, 0], [7, 0]);
    // velocity arrows start above the body and carry their label above the head
    const speedArrow = (p, v, vmax, label) => { if (Math.abs(v) < 1e-9 * vmax) return; DYUI.vec(D, p, [Math.sign(v), 0], 24 + 44 * Math.abs(v) / vmax, { color: AFT, label, size: 11.5, anchor: 'middle', ldx: 0, ldy: -8 }); };
    if (g.task === 'release') {
      const vmax = Math.max(Math.abs(g.vA), Math.abs(g.vB), 1e-9), k = 2.2 / vmax, xA = -0.9 + (g.vA - g.v0) * k * w, xB = 0.9 + (g.vB - g.v0) * k * w;
      [[xA, 1.4, 'A', CA], [xB, 1.6, 'B', CB]].forEach(([x, wd, n, col]) => { DYUI.block(D, [x, 0.25], wd * 0.9, 0.7, 0, { label: n, fill: col === CA ? '#cfe0f0' : '#f6d5c4' }); DYUI.wheel(D, [x - wd * 0.25, 0.14], 0.14, 0, { spokes: 0 }); DYUI.wheel(D, [x + wd * 0.25, 0.14], 0.14, 0, { spokes: 0 }); });
      if (w < 0.05) DYUI.spring(D, [xA + 0.63, 0.6], [xB - 0.72, 0.6], { n: 6, w: 0.12 });
      speedArrow([xA, 1.5], g.vA, vmax, lbl(opt, `v_A = ${fmt(g.vA)} ${u.V}`, 'v_A')); speedArrow([xB, 1.5], g.vB, vmax, lbl(opt, `v_B = ${fmt(g.vB)} ${u.V}`, 'v_B'));
      DYUI.title(D, 12, 20, uNow === undefined ? 'After the spring lets go' : 'Released');
    } else if (g.task === 'throw') {
      const vmax = Math.max(Math.abs(g.vA), Math.hypot(g.vBx, g.vBy), 1e-9), xA = -1 + g.vA * 2 / vmax * w;
      DYUI.block(D, [xA, 0], 1, 2.2, 0, { label: 'A', fill: '#cfe0f0' });
      const p0 = [xA + 0.8, 1.6], wB = uNow === undefined ? 0 : w, pB = [p0[0] + 0.25 + g.vBx / vmax * 4 * wB, p0[1] + g.vBy / vmax * 4 * wB - 2.5 * wB * wB];
      D.circle(pB, 0.25, { fill: CB, stroke: '#fff', sw: 1.5 }); D.text(pB, 'B', { dy: -12, anchor: 'middle', color: K.ink, size: 12, weight: 700 });
      DYUI.vec(D, p0, [g.vBx, g.vBy], 30 + 50 * Math.hypot(g.vBx, g.vBy) / vmax, { color: AFT, label: lbl(opt, `v_B = ${fmt(Math.hypot(g.vBx, g.vBy))} ${u.V}`, 'v_B'), size: 11.5 });
      speedArrow([xA, 2.6], g.vA, vmax, lbl(opt, `v_A = ${fmt(g.vA)} ${u.V}`, 'v_A'));
      DYUI.title(D, 12, 20, 'Just after the throw');
    } else {
      const L = g.L > 0 ? g.L : Math.max(1.5 * g.d, 1), sc = 6 / L, x0 = -3, cart = [0, 0.3];
      D.poly([[-6.8, 2.6], [-6.8, 0.95], [-3.1, 0.95]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 });
      DYUI.block(D, [cart[0], cart[1]], 6.2, 0.65, 0, { fill: '#f6d5c4', label: 'B' });
      [-2.4, 2.4].forEach((o) => DYUI.wheel(D, [cart[0] + o, 0.17], 0.17, 0, { spokes: 0 }));
      const xb = x0 - 0.1 + Math.min(g.d, L) * sc * w;
      DYUI.block(D, [xb + 0.35, 0.95], 0.7, 0.6, 0, { fill: '#cfe0f0', label: 'A', size: 11 });
      D.text([x0 + g.d * sc / 2, 1.9], lbl(opt, `slides ${fmt(g.d)} ${u.L}`, 'd'), { anchor: 'middle', color: K.ink, size: 11.5 });
      speedArrow([cart[0] + 1.5, 1.3], g.v, Math.max(g.vb, 1e-9), lbl(opt, `v₂ = ${fmt(g.v)} ${u.V}`, 'v₂'));
      DYUI.title(D, 12, 20, `Block reaches the cart at ${fmt(g.vb)} ${u.V}`);
    }
    return true;
  }

  function ang2D(svg, g, opt, uNow) {
    const u = g.u, t = tAt(g, uNow);
    if (g.task === 'pull') {
      const R = g.r1 * 1.15, D = UI.Draw2D(svg, { xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 28 });
      // spiral from r₁ to r₂ with H conserved: dθ/dt = r₁v₁/r²
      const T = g.span[1], pts = []; let th = 0; const N = 400;
      for (let i = 0; i <= N; i++) { const tt = (T * i) / N, r = g.r1 - (g.r1 - g.r2) * (tt / T); pts.push([r * Math.cos(th), r * Math.sin(th)]); th += ((g.r1 * g.v1) / (r * r)) * (T / N); }
      D.circle([0, 0], g.r1, { fill: 'none', stroke: '#7f8c8d', sw: 1, dash: '5 4' });
      D.pline(pts, { stroke: K.ink, sw: 1.8 });
      const p = pts[Math.round((t / T) * N)];
      D.line([0, 0], p, { stroke: K.ink, sw: 1.4 }); D.circle([0, 0], 4 / D.sc, { fill: K.ink }); D.text([0, 0], 'O', { dx: -8, dy: 14, anchor: 'end', color: K.ink, size: 12, weight: 700 });
      D.circle(p, 7 / D.sc, { fill: CA, stroke: '#fff', sw: 1.5 });
      DYUI.title(D, 12, 20, `t = ${fmt(t)} s; r = ${fmt(g.r1 - (g.r1 - g.r2) * (t / T))} ${u.L}`);
      return true;
    }
    const R = g.r * 1.5, D = UI.Draw2D(svg, { xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 28 }), om = (g.v1 + g.v2) / 2 / g.r, th = om * t;
    for (let i = 0; i < g.n; i++) { const a = th + (2 * Math.PI * i) / g.n, p = [g.r * Math.cos(a), g.r * Math.sin(a)]; D.line([0, 0], p, { stroke: K.edge, sw: 3 }); D.circle(p, 0.08 * g.r, { fill: CA, stroke: '#fff', sw: 1.5 }); if (i === 0) DYUI.vec(D, [p[0] - Math.sin(a) * 0.12 * g.r, p[1] + Math.cos(a) * 0.12 * g.r], [-Math.sin(a), Math.cos(a)], 46, { color: AFT, label: lbl(opt, `v₂ = ${fmt(g.v2)} ${u.V}`, 'v'), size: 11.5 }); }
    D.circle([0, 0], 0.07 * g.r, { fill: '#d5dbe1', stroke: K.edge, sw: 1.4 });
    D.arc([0, 0], 30, 20, 300, lbl(opt, 'M(t)', 'M'), { color: K.force });
    DYUI.title(D, 12, 20, `${g.n} particles, r = ${fmt(g.r)} ${u.L}`);
    return true;
  }

  function stream2D(svg, g, opt) {
    const u = g.u, P = g.ports, xs = P.map((p) => p.x).concat([0]), ys = P.map((p) => p.y).concat([0]);
    if (g.sup) { xs.push(g.sup.px, g.sup.qx); ys.push(g.sup.py, g.sup.qy); }
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6), pad = 0.45 * span;
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs) - pad, xmax: Math.max(...xs) + pad, ymin: Math.min(...ys) - pad, ymax: Math.max(...ys) + pad }, { pad: 30 });
    // the device: a thick line through the openings in order
    D.pline(P.map((p) => [p.x, p.y]), { stroke: '#c3cbd3', sw: 14 });
    const vmax = Math.max(...P.map((p) => p.v)), L = (v) => 24 + 40 * v / vmax;
    P.forEach((p, i) => {
      const d = [Math.cos(p.ang * D2R), Math.sin(p.ang * D2R)], at = [p.x, p.y];
      if (p.io === 'in') DYUI.vec(D, at, d, L(p.v), { head: true, color: CA, size: 11 }); else DYUI.vec(D, at, d, L(p.v), { color: AFT, size: 11 });
      const tip = p.io === 'in' ? [p.x - (d[0] * L(p.v)) / D.sc, p.y - (d[1] * L(p.v)) / D.sc] : [p.x + (d[0] * L(p.v)) / D.sc, p.y + (d[1] * L(p.v)) / D.sc];
      D.text(tip, lbl(opt, `${i + 1}: ${fmt(p.v)} ${u.V}`, String(i + 1)), { anchor: d[0] * (p.io === 'in' ? -1 : 1) >= 0 ? 'start' : 'end', dx: d[0] * (p.io === 'in' ? -1 : 1) >= 0 ? 4 : -4, dy: 4, color: p.io === 'in' ? CA : AFT, size: 11, weight: 700 });
    });
    D.circle([0, 0], 3 / D.sc, { fill: K.ink }); D.text([0, 0], 'O', { dx: -6, dy: 14, anchor: 'end', color: K.ink, size: 12, weight: 700 });
    if (g.sup) {
      DYUI.pin(D, [g.sup.px, g.sup.py], 0.06 * span); D.circle([g.sup.qx, g.sup.qy], 0.03 * span, { fill: '#fff', stroke: K.edge, sw: 1.4 });
      DYUI.vec(D, [g.sup.qx, g.sup.qy], [g.sup.d[0] * Math.sign(g.sup.Nr || 1), g.sup.d[1] * Math.sign(g.sup.Nr || 1)], 46, { color: K.force, label: lbl(opt, `N = ${fmt(Math.abs(g.sup.Nr))} ${u.F}`, 'N'), size: 11 });
      if (Math.hypot(g.sup.Dx, g.sup.Dy) > 1e-9) DYUI.vec(D, [g.sup.px, g.sup.py], [g.sup.Dx, g.sup.Dy], 46, { color: K.force, label: lbl(opt, `D = ${fmt(Math.hypot(g.sup.Dx, g.sup.Dy))} ${u.F}`, 'D'), size: 11 });
    } else if (Math.hypot(g.Fx, g.Fy) > 0) DYUI.vec(D, [P.reduce((a, p) => a + p.x, 0) / P.length + 0.18 * span, P.reduce((a, p) => a + p.y, 0) / P.length], [g.Fx, g.Fy], 56, { color: K.force, label: lbl(opt, `F = ${fmt(Math.hypot(g.Fx, g.Fy))} ${u.F}`, 'F'), size: 11.5 });
    DYUI.title(D, 12, 20, `Supports hold F_x = ${fmt(g.Fx)}, F_y = ${fmt(g.Fy)} ${u.F}, M_O = ${fmt(g.M)} ${u.MO}`);
    return true;
  }

  function vary2D(svg, g, opt, uNow) {
    const u = g.u, t = tAt(g, uNow), [, v] = hAt(g.hist, t), D = UI.Draw2D(svg, { xmin: -6, xmax: 6, ymin: -2, ymax: 3.4 }, { pad: 24 });
    DYUI.ground(D, [-6, 0], [6, 0]);
    const m = g.mOf(t), w = 1.2 + 1.6 * Math.cbrt(m / Math.max(g.m0, g.mOf(g.T)));
    DYUI.block(D, [0, 0.3], w * 1.6, w * 0.7, 0, { fill: '#cfe0f0', label: `m = ${fmt(DY.fromBase(m, 'M', u))} ${u.M}`, size: 11 });
    [-0.5, 0.5].forEach((o) => DYUI.wheel(D, [o * w, 0.15], 0.15, 0, { spokes: 0 }));
    if (g.mi > 0) { const top = 0.3 + w * 0.7; for (let i = 0; i < 6; i++) D.circle([-0.4 + 0.15 * i, top + 0.15 + ((i * 0.37 + t) % 1.2)], 0.05, { fill: '#b9770e' }); }
    if (g.me > 0) DYUI.vec(D, [-w * 0.8, 0.3 + w * 0.35], [-1, 0], 50, { color: '#7f8c8d', label: 'exhaust', size: 11, anchor: 'end', ldx: -6 });
    if (Math.abs(v) > 1e-9) DYUI.vec(D, [w * 0.8 + 0.1, 0.3 + w * 0.35], [Math.sign(v), 0], 50, { color: AFT, label: lbl(opt, `v = ${fmt(v)} ${u.V}`, 'v'), size: 11.5 });
    DYUI.title(D, 12, 20, `t = ${fmt(t)} s`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  function plot(svg, g, uNow) {
    const u = g.u;
    if (g.mode === 'ft') {
      const T = g.T, Fp = [], vp = [];
      for (let i = 0; i <= 400; i++) { const t = (T * i) / 400; Fp.push([t, g.F(t) * g.n]); }
      g.hist.forEach((h, i) => { if (i % 20 === 0) vp.push([h[0], h[1]]); });
      const cur = uNow === undefined ? T : T * uNow;
      return DYUI.stack(svg, [{ label: `${g.n > 1 ? g.n : ''}F (${u.F})`, color: K.force, pts: Fp, at: (x) => g.F(x) * g.n }, { label: `v (${u.V})`, color: AFT, pts: vp, at: (x) => hAt(g.hist, x)[1] }], { xlabel: 't (s)', cursor: cur, xmin: 0, xmax: T });
    }
    if (g.mode === 'vary') {
      const vp = g.hist.filter((h, i) => i % 20 === 0), mp = vp.map((h) => [h[0], DY.fromBase(g.mOf(h[0]), 'M', u)]);
      const cur = uNow === undefined ? g.T : g.T * uNow;
      return DYUI.stack(svg, [{ label: `v (${u.V})`, color: AFT, pts: vp, at: (x) => hAt(g.hist, x)[1] }, { label: `m (${u.M})`, color: CA, pts: mp, at: (x) => DY.fromBase(g.mOf(x), 'M', u) }], { xlabel: 't (s)', cursor: cur, xmin: 0, xmax: Math.max(g.T, 1e-9) });
    }
    if (g.mode === 'stream') return DYUI.bars(svg, [{ name: 'F_x', v: g.Fx, color: K.force }, { name: 'F_y', v: g.Fy, color: K.force }], { unit: u.F, title: 'Support force' });
    if (g.mode === 'cons') {
      const list = g.task === 'release' ? [{ name: 'v_A', v: g.vA, color: CA }, { name: 'v_B', v: g.vB, color: CB }] : g.task === 'throw' ? [{ name: 'v_A', v: g.vA, color: CA }, { name: '(v_B)_x', v: g.vBx, color: CB }, { name: '(v_B)_y', v: g.vBy, color: CB }] : [{ name: 'block onto cart', v: g.vb, color: CA }, { name: 'together', v: g.v, color: AFT }];
      return DYUI.bars(svg, list, { unit: u.V, title: 'Velocity' });
    }
    return DYUI.bars(svg, g.task === 'pull' ? [{ name: 'v₁', v: g.v1, color: K.ink }, { name: '(v₂)_t', v: g.vt, color: AFT }] : [{ name: 'v₁', v: g.v1, color: K.ink }, { name: 'v₂', v: g.v2, color: AFT }], { unit: u.V, title: 'Speed' });
  }
  const plotCaption = (st) => ({ ft: 'Force and velocity against time', vary: 'Velocity and mass against time', stream: 'Force from the supports', cons: 'Velocities', angmom: 'Speeds' }[st.mode]);
  const cap2D = (st) => ({ ft: 'Body pushed by a force that varies with time', cons: 'Momentum shared between two bodies', angmom: st.atask === 'pull' ? 'Particle pulled in toward O (top view)' : 'Particles turned by a moment (top view)', stream: 'Openings of the device and its supports', vary: 'Body gaining or losing mass' }[st.mode]);

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  function draw3D(v, g, uNow) {
    const t = tAt(g, uNow);
    if (g.mode === 'angmom' && g.task === 'torque') {
      const om = (g.v1 + g.v2) / 2 / g.r, th = om * t;
      for (let i = 0; i < g.n; i++) { const a = th + (2 * Math.PI * i) / g.n, p = [g.r * Math.cos(a), 0.3 * g.r, -g.r * Math.sin(a)]; v.line([[0, 0.3 * g.r, 0], p], K.edge, 3); DYUI.sphere(v, p, 0.08 * g.r, CA); }
      v.box(-0.05 * g.r, 0, -0.05 * g.r, 0.05 * g.r, 0.3 * g.r, 0.05 * g.r, '#c3cbd3', 1, K.edge); DYUI.floor3(v, -1.2 * g.r, 1.2 * g.r, 0, 1.2 * g.r);
      v.setBounds([-1.2 * g.r, -0.1 * g.r, -1.2 * g.r], [1.2 * g.r, 0.6 * g.r, 1.2 * g.r]);
      return;
    }
    if (g.mode === 'angmom') {
      const R = g.r1; DYUI.floor3(v, -1.2 * R, 1.2 * R, 0, 1.2 * R);
      const T = g.span[1], N = 200; let th = 0; const pts = [];
      for (let i = 0; i <= N; i++) { const tt = (T * i) / N, r = g.r1 - (g.r1 - g.r2) * (tt / T); pts.push([r * Math.cos(th), 0.05 * R, -r * Math.sin(th)]); th += ((g.r1 * g.v1) / (r * r)) * (T / N); }
      v.line(pts, K.ink, 2); const p = pts[Math.round((t / T) * N)]; v.line([[0, 0.05 * R, 0], p], K.ink, 1.4); DYUI.sphere(v, p, 0.06 * R, CA);
      v.setBounds([-1.2 * R, -0.1 * R, -1.2 * R], [1.2 * R, 0.4 * R, 1.2 * R]);
      return;
    }
    if (g.mode === 'stream') {
      const P = g.ports, span = Math.max(1e-6, ...P.map((p) => Math.hypot(p.x, p.y))), r = 0.06 * span;
      for (let i = 0; i + 1 < P.length; i++) v.line([[P[i].x, P[i].y, 0], [P[i + 1].x, P[i + 1].y, 0]], '#7f8c8d', 10);
      P.forEach((p) => { DYUI.sphere(v, [p.x, p.y, 0], r, p.io === 'in' ? CA : AFT); const d = [Math.cos(p.ang * D2R), Math.sin(p.ang * D2R), 0]; if (p.io === 'in') DYUI.arrow3(v, DYUI.sub([p.x, p.y, 0], DYUI.mul(d, 0.4 * span)), [p.x, p.y, 0], CA, 2.4); else DYUI.arrow3(v, [p.x, p.y, 0], DYUI.add([p.x, p.y, 0], DYUI.mul(d, 0.4 * span)), AFT, 2.4); });
      v.setBounds([Math.min(...P.map((p) => p.x)) - 0.6 * span, Math.min(...P.map((p) => p.y)) - 0.6 * span, -0.4 * span], [Math.max(...P.map((p) => p.x)) + 0.6 * span, Math.max(...P.map((p) => p.y)) + 0.6 * span, 0.4 * span]);
      return;
    }
    // bodies on a floor or incline
    const th = g.mode === 'ft' ? Math.min(90, Math.max(0, g.th)) * D2R : 0, Ls = 8, e = [Math.cos(th), Math.sin(th)];
    if (th > 1e-9 && th < 89.9 * D2R) v.extrude([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], -1.2, 1.2, '#d5dbe1', 1, K.edge); else DYUI.floor3(v, -0.5, Ls + 0.5, 0, 1.2);
    const w = uNow === undefined ? 0.6 : uNow, s = 1 + w * (Ls - 3);
    if (g.mode === 'cons') { DYUI.block3(v, [2.5 - (g.task === 'slide' ? 0 : w), 0], 1.4, 0.8, 1.2, 0, CA); DYUI.block3(v, [5 + (g.task === 'slide' ? 0 : w), 0], 1.8, 0.9, 1.4, 0, CB); }
    else DYUI.block3(v, [s * e[0], s * e[1]], 1.4, 0.9, 1.2, th > 89.9 * D2R ? 0 : th, CA);
    v.setBounds([-1, -0.3, -1.4], [Ls * e[0] + 1, Math.max(Ls * e[1], 2) + 1, 1.4]);
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const presets = (P0) => [
    { name: 'Test: Problem 15–17, 400 kg safe towed by a force rising to 600 N at 5 s and 750 N at 8 s (v = 8.81 m/s)', units: 'SI', state: P0({ mode: 'ft', fm: 400, fth: 0, fmus: 0, fmuk: 0, fv1: 0, fn: 1, ft: 8, fpts: [{ t: 0, F: 0 }, { t: 5, F: 600 }, { t: 8, F: 750 }] }),
      expect: [{ k: 'Velocity at t₂, v₂', v: 8.8125 }, { k: 'Impulse of F, ∫F dt', v: 3525 }] },
    { name: 'Test: Problem 15–27, 70 kg bucket lifted on two strands by a winch force 360 N then rising to 600 N, v₁ = 3 m/s up (v = 21.8 m/s at 18 s)', units: 'SI', state: P0({ mode: 'ft', fm: 70, fth: 90, fmus: 0, fmuk: 0, fv1: 3, fn: 2, ft: 18, fpts: [{ t: 0, F: 360 }, { t: 12, F: 360 }, { t: 24, F: 600 }] }),
      expect: [{ k: 'Velocity at t₂, v₂', v: 21.85 }] },
    { name: 'Test: Problem 15–30, 7 Mg jet from a carrier at 40 km/h, thrust 5 kN at 2 s to 15 kN at 5 s (v = 16.1 m/s)', units: 'SI', state: P0({ mode: 'ft', fm: 7000, fth: 0, fmus: 0, fmuk: 0, fv1: 11.1111, fn: 1, ft: 5, fpts: [{ t: 0, F: 0 }, { t: 2, F: 5000 }, { t: 5, F: 15000 }] }),
      expect: [{ k: 'Velocity at t₂, v₂', v: 16.11 }] },
    { name: 'Test: Problem 15–57, cars of 0.4 lb and 0.6 lb pushed apart by a 30 lb/ft spring compressed 0.2 ft (7.61 and 5.08 ft/s)', units: 'US', state: P0({ mode: 'cons', ctask: 'release', cmA: 0.4, cmB: 0.6, ck: 30, cs: 0.2, cv0: 0 }),
      expect: [{ k: 'Velocity of A after release', v: -7.613 }, { k: 'Velocity of B after release', v: 5.075 }] },
    { name: 'Test: Problem 15–40, 70 kg skater throws an 8 kg block at 2 m/s relative, 30° up, in 1.5 s (v = 0.178 m/s, N = 771 N)', units: 'SI', state: P0({ mode: 'cons', ctask: 'throw', cmA: 70, cmB: 8, cv0: 0, cvr: 2, cphi: 30, cdt: 1.5 }),
      expect: [{ k: 'Velocity of A (horizontal)', v: -0.1776 }, { k: 'Average vertical reaction under A', v: 770.5 }] },
    { name: 'Test: Problem 15–55, 20 kg box down a 0.2 m ramp onto a 10 kg cart, μ_k = 0.6 (v = 1.32 m/s, t = 0.112 s)', units: 'SI', state: P0({ mode: 'cons', ctask: 'slide', cmA: 20, cmB: 10, cmuk: 0.6, cramp: true, ch: 0.2, cL: 2.5 }),
      expect: [{ k: 'Common final velocity', v: 1.321 }, { k: 'Time to stop sliding', v: 0.1122 }, { k: 'Position from the far end, L − d', v: 2.389 }] },
    { name: 'Test: Problem 15–105, four 5 lb spheres at 4 ft turned by M = 5t + 2 lb·ft from rest (v = 19.3 ft/s at 4 s)', units: 'US', state: P0({ mode: 'angmom', atask: 'torque', an: 4, am: 5, ar: 4, aM: '5 t + 2', av1: 0, at: 4 }),
      expect: [{ k: 'Speed of each particle at t, v₂', v: 19.32 }] },
    { name: 'Test: Problem 15–110, 200 kg car at 3 m/s on 8 m, cable pulled in at 0.5 m/s for 4 s (v = 4.03 m/s, U = 725 J)', units: 'SI', state: P0({ mode: 'angmom', atask: 'pull', am: 200, ar1: 8, av1: 3, ardot: 0.5, at: 4 }),
      expect: [{ k: 'Speed at t, v₂', v: 4.031 }, { k: 'Work done on the cable', v: 725 }] },
    { name: 'Test: Problem 15–120, water in at A (18 m/s, 150.5 kPa, 50 mm) and out at B and C (30 mm) (F_x = 795 N, F_y = 1.20 kN)', units: 'SI', state: P0({ mode: 'stream', rho: 1000, sup: 'none', ports: [{ io: 'in', x: 0, y: 0, v: 18, ang: 90, A: Math.PI * 0.025 * 0.025, p: 150500 }, { io: 'out', x: 0, y: 0.5, v: 25, ang: 180, A: Math.PI * 0.015 * 0.015, p: 0 }, { io: 'out', x: 0, y: 0.5, v: 25, ang: 216.8699, A: Math.PI * 0.015 * 0.015, p: 0 }] }),
      expect: [{ k: 'Support force F_x', v: -795.2 }, { k: 'Support force F_y', v: -1196.8 }] },
    { name: 'Test: Problem 15–140, 7 Mg jet at 720 km/h, air in 200 kg/s, exhaust 200.8 kg/s at 12 km/s, drag 55v² (a = 24.2 m/s²)', units: 'SI', state: P0({ mode: 'vary', vm0: 7000, vv0: 200, vmi: 200, vvi: 0, vme: 200.8, vu: 12000, vF: 0, vc: 55, vth: 0, vt: 1 }),
      expect: [{ k: 'Acceleration at the start', v: 24.23 }] },
    { name: 'Test: Problem 15–130, sand falls at 50 kg/s onto a 2 Mg car coasting at 4 m/s (v = 8000/(2000 + 50t): 3.2 m/s at 10 s)', units: 'SI', state: P0({ mode: 'vary', vm0: 2000, vv0: 4, vmi: 50, vvi: 0, vme: 0, vu: 0, vF: 0, vc: 0, vth: 0, vt: 10 }),
      expect: [{ k: 'Velocity at t = 10 s', v: 3.2 }] },
    { name: 'Crate on a rough floor, push growing to 600 N in 6 s (starts moving when F passes μ_s N)', units: 'SI', state: P0({ mode: 'ft', fm: 50, fth: 0, fmus: 0.4, fmuk: 0.3, fv1: 0, fn: 1, ft: 6, fpts: [{ t: 0, F: 0 }, { t: 6, F: 600 }] }) },
  ];

  root.DMomentumUI = { MODES, controls, draw2D, plot, plotCaption, cap2D, draw3D, presets };
})(window);
