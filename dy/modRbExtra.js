/* =====================================================================
 * DYNAMICS · Planar kinematics: absolute motion, rotating frames, slotted links and planetary gears
 * (inputs, diagrams, presets). Physics: dy/rbextra.js. The Planar Kinematics module
 * (dy/modRbMotion.js) hands these modes to this file.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, DY, DYUI, RbExtra } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', LINK = '#5d6d7e', D2R = Math.PI / 180, TAU = 2 * Math.PI;
  const MODES = RbExtra.MODES;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const L2 = (a) => Math.hypot(a[0], a[1]);
  const rot = (r, a) => [r[0] * Math.cos(a) - r[1] * Math.sin(a), r[0] * Math.sin(a) + r[1] * Math.cos(a)];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const bbox = (pts, padf) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = Math.max(x1 - x0, y1 - y0, 1e-6) * (padf || 0.3); return { xmin: x0 - s, xmax: x1 + s, ymin: y0 - s, ymax: y1 + s }; };

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  function controls(c, C, st, u) {
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const pair = (sec, kx, ky, label, unit) => { num(sec, kx, `${label}, x`, unit); num(sec, ky, `${label}, y`, unit); };
    let sec;
    if (st.mode === 'abs') {
      sec = C.section(c, 'Position coordinate');
      C.seg(sec, { label: 'The driven part', get: () => st.jdir, set: (v) => (st.jdir = v), options: [['x', 'Slides along x'], ['y', 'Slides along y'], ['ang', 'Turns (angle φ)']] });
      C.text(sec, { label: `${st.jdir === 'ang' ? 'φ' : st.jdir} = f(θ) in ${st.jdir === 'ang' ? 'rad' : u.L} (θ in radians)`, get: () => st.jf, set: (v) => (st.jf = v) });
      C.note(sec, 'Write the geometry relation, for example 0.12 sin θ + 0.15 or 2 cot θ. Its numbers are not rescaled when the units change.');
      num(sec, 'jth', 'At the angle θ', '°');
      sec = C.section(c, 'Motion');
      C.seg(sec, { label: 'Given', get: () => st.jgiven, set: (v) => (st.jgiven = v), options: [['w', 'ω and α of θ'], ['v', 'v and a of the part']] });
      const vu = st.jdir === 'ang' ? 'rad/s' : u.V, au = st.jdir === 'ang' ? 'rad/s²' : u.A;
      if (st.jgiven === 'v') { num(sec, 'jv', 'Velocity of the part v', vu); num(sec, 'ja', 'Acceleration of the part a', au); }
      else { num(sec, 'jw', 'Angular velocity ω = dθ/dt', 'rad/s'); num(sec, 'jal', 'Angular acceleration α', 'rad/s²'); }
    } else if (st.mode === 'rotframe' && st.jframe === 'arm') {
      sec = C.section(c, 'Moving frame');
      C.seg(sec, { label: 'Frame', get: () => st.jframe, set: (v) => (st.jframe = v), options: [['given', 'Given directly'], ['arm', 'Carried on an arm']] });
      sec = C.section(c, 'Arm AB (turns about the fixed point A)');
      num(sec, 'jLa', 'Length of the arm AB', u.L); num(sec, 'jang', 'Angle of the arm from +x', '°');
      num(sec, 'jwab', 'Angular velocity ω_AB (+ counterclockwise)', 'rad/s'); num(sec, 'jaab', 'Angular acceleration α_AB', 'rad/s²');
      sec = C.section(c, 'Car spinning on the end B');
      C.note(sec, 'Measured relative to the arm. The car is the moving frame xyz, with its origin at B.');
      num(sec, 'jwr', 'Angular velocity ω′ relative to the arm', 'rad/s'); num(sec, 'jar', 'Angular acceleration α′ relative to the arm', 'rad/s²');
      sec = C.section(c, 'Point C in the car');
      C.note(sec, 'Components along the fixed x and y axes at this instant. Leave the motion at 0 when C is fixed in the car.');
      pair(sec, 'jkx', 'jky', 'Position r_C/B', u.L); pair(sec, 'jkvx', 'jkvy', 'Velocity in the car (v_C/B)xyz', u.V); pair(sec, 'jkax', 'jkay', 'Acceleration in the car (a_C/B)xyz', u.A);
    } else if (st.mode === 'rotframe') {
      sec = C.section(c, 'Moving frame');
      C.seg(sec, { label: 'Frame', get: () => st.jframe, set: (v) => (st.jframe = v), options: [['given', 'Given directly'], ['arm', 'Carried on an arm']] });
      sec = C.section(c, 'Moving frame xyz (origin O)');
      C.note(sec, 'The frame turns with the body. Its axes line up with the fixed X and Y axes at this instant, so all vectors are in i, j components.');
      pair(sec, 'jvox', 'jvoy', 'Velocity of O', u.V); pair(sec, 'jaox', 'jaoy', 'Acceleration of O', u.A);
      num(sec, 'jW', 'Angular velocity Ω (+ counterclockwise)', 'rad/s'); num(sec, 'jWd', 'Angular acceleration Ω̇', 'rad/s²');
      sec = C.section(c, 'Point B measured in the frame');
      pair(sec, 'jrx', 'jry', 'Position r_B/O', u.L); pair(sec, 'jvrx', 'jvry', 'Velocity (v_B/O)xyz', u.V); pair(sec, 'jarx', 'jary', 'Acceleration (a_B/O)xyz', u.A);
    } else if (st.mode === 'slot') {
      sec = C.section(c, 'Slotted link');
      C.note(sec, 'The link turns about the fixed pin A at the origin. Its slot is straight and passes through A; the peg B slides in it.');
      pair(sec, 'jbx', 'jby', 'Peg B from A', u.L);
      sec = C.section(c, 'Motion of the peg');
      C.seg(sec, { label: 'Peg B is', get: () => st.jsrc, set: (v) => (st.jsrc = v), options: [['crank', 'On a disk or crank'], ['given', 'Given directly']] });
      if (st.jsrc === 'crank') { pair(sec, 'jcx', 'jcy', 'Fixed centre C of the disk', u.L); num(sec, 'jcw', 'Its angular velocity ω', 'rad/s'); num(sec, 'jca', 'Its angular acceleration α', 'rad/s²'); }
      else { pair(sec, 'jvbx', 'jvby', 'Velocity of B', u.V); pair(sec, 'jabx', 'jaby', 'Acceleration of B', u.A); }
    } else if (st.mode === 'collar') {
      sec = C.section(c, 'Rod and circle');
      C.note(sec, 'The rod turns about the fixed pin A at the origin. The collar C slides on the rod and on a fixed circle (a double collar: two pinned slider blocks).');
      pair(sec, 'jox', 'joy', 'Centre O of the circle from A', u.L); num(sec, 'jR', 'Radius of the circle R', u.L);
      if (Math.hypot(+st.jox, +st.joy) > +st.jR * (1 + 1e-9)) C.seg(sec, { label: 'The rod crosses the circle twice; the collar is at', get: () => (st.jfar ? 'far' : 'near'), set: (v) => (st.jfar = v === 'far'), options: [['near', 'The nearer crossing'], ['far', 'The farther crossing']] });
      sec = C.section(c, 'Motion of the rod');
      num(sec, 'jrth', 'Angle of the rod θ from +x', '°'); num(sec, 'jrw', 'Angular velocity ω (+ counterclockwise)', 'rad/s'); num(sec, 'jral', 'Angular acceleration α', 'rad/s²');
    } else {
      sec = C.section(c, 'Gears');
      C.seg(sec, { label: 'Gear B runs', get: () => st.jring, set: (v) => (st.jring = v), options: [['sun', 'Outside a sun gear A'], ['ring', 'Inside a ring gear A']] });
      num(sec, 'jrA', 'Radius of A, r_A', u.L); num(sec, 'jrB', 'Radius of B, r_B', u.L);
      num(sec, 'jwA', 'ω_A (0 if A is held fixed)', 'rad/s'); num(sec, 'jaA', 'α_A', 'rad/s²');
      sec = C.section(c, 'Arm carrying B');
      num(sec, 'jwarm', 'ω_arm (− clockwise)', 'rad/s'); num(sec, 'jaarm', 'α_arm', 'rad/s²'); num(sec, 'jpth', 'Arm angle from +x', '°');
    }
  }
  function diagram(c, C, st) {
    if (st.mode === 'rotframe') C.toggle(c, { label: 'Each acceleration term', get: () => !!st.jterms, set: (v) => (st.jterms = v), rebuild: false });
    if (st.mode === 'collar') C.toggle(c, { label: 'Radius from O to C', get: () => st.jshowR !== false, set: (v) => (st.jshowR = v), rebuild: false });
    if (st.mode === 'slot' || st.mode === 'planet' || st.mode === 'rotframe') C.toggle(c, { label: 'Path of the point', get: () => st.jtrace !== false, set: (v) => (st.jtrace = v), rebuild: false });
  }
  const cap2D = (st) => ({ abs: 'Driving angle θ and the coordinate it sets', rotframe: st.jframe === 'arm' ? 'Arm, car and point C' : 'Rotating frame xyz and point B', slot: 'Slotted link and peg', planet: 'Planetary gear train', collar: 'Rod, circle and double collar' }[st.mode]);
  const plotCaption = (st) => ({ abs: 'Position and velocity of the part against θ (at the given ω)', rotframe: 'Acceleration terms (x and y components)', slot: 'Angular velocity of the link as the peg goes round', planet: 'Angular velocities against time', collar: 'Speed of C and its speed along the rod against θ (at the given ω)' }[st.mode]);
  const legend = (st) => (st.mode === 'rotframe' ? [[K.vel, 'Velocity'], [K.acc, 'Acceleration'], [CA, 'Moving frame'], [CB, st.jframe === 'arm' ? 'Point C' : 'Point B']] : [[K.vel, 'Velocity'], [K.acc, 'Acceleration'], [LINK, 'Links', 'ln'], [CB, 'Moving point']]);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  const link = (D, a, b, w) => { D.line(a, b, { stroke: LINK, sw: w || 7 }); D.line(a, b, { stroke: '#aab7c4', sw: (w || 7) - 3 }); };
  const joint = (D, p) => D.circle(p, 4.5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.5 });
  const name = (D, p, s, dx, dy, col) => D.text(p, s, { dx: dx === undefined ? 8 : dx, dy: dy === undefined ? -8 : dy, color: col || K.ink, size: 12.5, weight: 700 });
  /** Curved arrow for a rotation at c (screen radius px), turning the way w turns, with an optional label. */
  function spin(D, c, px, w, label, col) {
    if (Math.abs(w) < 1e-12) return;
    const sg = Math.sign(w), a0 = 110, a1 = a0 + sg * 250, col2 = col || K.ink;
    D.arc(c, px, a0, a1, null, { color: col2 });
    const e = a1 * D2R, t = [-Math.sin(e) * sg, Math.cos(e) * sg], p = [c[0] + (px * Math.cos(e)) / D.sc, c[1] + (px * Math.sin(e)) / D.sc];
    D.arrow([p[0] - (t[0] * 8) / D.sc, p[1] - (t[1] * 8) / D.sc], p, { color: col2, w: 1.4, head: 8 });
    if (label) D.text(c, label, { dx: -px - 6, dy: -px * 0.75, anchor: 'end', color: col2, size: 11.5, weight: 700 });
  }
  let showArrows = true;
  const vn = (nm, q) => (nm ? `${q}_${nm}` : q);
  function arrowsAt(D, p, v, a, vmax, amax, opt, nm, u, side) {
    if (!showArrows) return;
    const s = side || 1;
    if (L2(v) > 1e-9 * vmax) DYUI.vec(D, p, v, 24 + 66 * L2(v) / vmax, { color: K.vel, label: lbl(opt, `${vn(nm, 'v')} = ${fmt(L2(v))} ${u.V}`, vn(nm, 'v')), size: 11.5, anchor: v[0] < 0 ? 'end' : 'start', ldx: v[0] < 0 ? -6 : 6, ldy: -4 * s });
    if (a && L2(a) > 1e-9 * amax) DYUI.vec(D, p, a, 24 + 66 * L2(a) / amax, { color: K.acc, label: lbl(opt, `${vn(nm, 'a')} = ${fmt(L2(a))} ${u.A}`, vn(nm, 'a')), size: 11.5, anchor: a[0] < 0 ? 'end' : 'start', ldx: a[0] < 0 ? -6 : 6, ldy: 14 * s });
  }

  function draw2D(svg, g, opt, uNow, st) {
    showArrows = !st || st.showV !== false;
    return ({ abs: abs2D, rotframe: g.arm ? arm2D : frame2D, slot: slot2D, planet: planet2D, collar: collar2D })[g.mode](svg, g, opt, uNow, st || {});
  }

  /* absolute motion: a driving link at angle θ and the part whose coordinate s = f(θ) */
  const absTheta = (g, uN) => (uN === undefined ? g.th : g.th + 25 * D2R * Math.sin(TAU * uN));
  function abs2D(svg, g, opt, uN, st) {
    const u = g.u, th = absTheta(g, uN), ang = g.dir === 'ang';
    const samp = []; for (let i = 0; i <= 40; i++) { const t = g.th + (i / 40 - 0.5) * 50 * D2R, s = g.f(t); if (isFinite(s)) samp.push(s); }
    const s = g.f(th), ref0 = Math.abs(g.s0) > 1e-9 ? Math.abs(g.s0) : Math.max(...samp.map(Math.abs), 1e-6);
    const near = samp.filter((x) => Math.abs(x) <= 2.5 * ref0), smax = ref0, R = ang ? 1 : 0.4 * ref0;
    const [, d1, d2] = root.Formula.d012(g.f, th), v = d1 * g.w, a = d2 * g.w * g.w + d1 * g.al;
    if (ang) {
      const D = UI.Draw2D(svg, { xmin: -1.6, xmax: 3.2, ymin: -1.5, ymax: 1.6 }, { pad: 26 });
      DYUI.pin(D, [0, 0], 0.16); link(D, [0, 0], [R * Math.cos(th), R * Math.sin(th)]); joint(D, [0, 0]);
      D.arc([0, 0], 30, 0, th / D2R, `θ = ${fmt(th / D2R)}°`, { color: K.ink }); name(D, [0, 0], 'O', -16, 16);
      const P = [1.6, 0]; DYUI.pin(D, P, 0.16); link(D, P, [P[0] + 1.2 * Math.cos(s), P[1] + 1.2 * Math.sin(s)]); joint(D, P);
      D.arc(P, 30, 0, s / D2R, `φ = ${fmt(s / D2R)}°`, { color: CB }); spin(D, P, 46, v, `φ̇ = ${fmt(v)} rad/s`, K.vel);
      D.line([P[0], 0], [P[0] + 1.4, 0], { stroke: K.ink, sw: 1, dash: '5 4' });
      DYUI.title(D, 12, 20, `θ = ${fmt(th / D2R)}°:  φ = ${fmt(s)} rad,  φ̇ = ${fmt(v)} rad/s`);
      return true;
    }
    const along = g.dir === 'y' ? [0, 1] : [1, 0], side = g.dir === 'y' ? [1, 0] : [0, 1];
    const lo = Math.min(0, ...near), hi = Math.max(0, ...near), ext = [[-R, -R], [R, R], mul(along, lo - 0.3 * ref0), mul(along, hi + 0.3 * ref0), mul(side, 0.9 * ref0), mul(side, -0.9 * ref0)];
    const D = UI.Draw2D(svg, bbox(ext, 0.12), { pad: 40 });
    D.line(mul(along, Math.min(lo, -R) - 0.1 * smax), mul(along, Math.max(hi, R) + 0.25 * smax), { stroke: K.ink, sw: 1, dash: '6 4' });
    DYUI.pin(D, [0, 0], 0.12 * R); link(D, [0, 0], [R * Math.cos(th), R * Math.sin(th)]); joint(D, [0, 0]); name(D, [0, 0], 'O', -16, 16);
    D.arc([0, 0], 28, g.dir === 'y' ? 90 : 0, th / D2R, `θ = ${fmt(((th / D2R) % 360 + 360) % 360)}°`, { color: K.ink });
    if (Math.abs(g.w) > 1e-12) spin(D, [0, 0], 44, g.w, `ω = ${fmt(g.w)} rad/s`, K.ink);
    const P = mul(along, s), bw = 0.2 * smax, bh = 0.14 * smax;
    const corner = (p, q) => add(P, add(mul(along, p), mul(side, q)));
    D.poly([corner(-bw / 2, -bh / 2), corner(bw / 2, -bh / 2), corner(bw / 2, bh / 2), corner(-bw / 2, bh / 2)], { fill: K.body, stroke: K.edge, sw: 1.6 });
    D.circle(P, 4.5 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 });
    const dl = mul(side, -0.6 * smax); if (Math.abs(s) > 1e-9) D.arrow(dl, add(P, dl), { color: K.ink, w: 1.1, head: 7 }); D.text(add(mul(P, 0.5), dl), `${g.name} = ${fmt(s)} ${u.L}`, { dx: g.dir === 'y' ? -8 : 0, dy: g.dir === 'y' ? 4 : 16, anchor: g.dir === 'y' ? 'end' : 'middle', color: K.ink, size: 11.5, weight: 700 });
    const vmax = Math.max(Math.abs(v), 1e-9), amax = Math.max(Math.abs(a), 1e-9);
    const lift = Math.max(bh / 2, 0.3 * smax); // clear of the driving link
    if (showArrows) [[lift, v, K.vel, 'v', u.V], [-lift, uN === undefined ? a : 0, K.acc, 'a', u.A]].forEach(([o, q, col, nm, un]) => {
      if (Math.abs(q) < 1e-12) return;
      const p0 = add(P, mul(side, o)); D.line(add(P, mul(side, Math.sign(o) * bh / 2)), p0, { stroke: col, sw: 1, dash: '2 2' });
      DYUI.vec(D, p0, mul(along, q), 70, { color: col, label: lbl(opt, `${nm} = ${fmt(q)} ${un}`, nm), size: 11.5, anchor: q * along[0] < 0 ? 'end' : 'start', ldx: q * along[0] < 0 ? -6 : 6, ldy: o > 0 ? -4 : 14 });
    });
    DYUI.title(D, 12, 20, `θ = ${fmt(th / D2R)}°:  ${g.name} = ${fmt(s)} ${u.L},  v = ${fmt(v)} ${u.V}${uN === undefined ? `,  a = ${fmt(a)} ${u.A}` : ''}`);
    return true;
  }

  /* rotating frame: the frame turns through Ω t and B moves along its path in the frame */
  function frameAt(g, t) {
    const psi = g.W * t + 0.5 * g.Wd * t * t, W = g.W + g.Wd * t, O = add(add(mul(g.vO, t), mul(g.aO, 0.5 * t * t)), [0, 0]);
    const rl = add(add(g.r, mul(g.vr, t)), mul(g.ar, 0.5 * t * t)), vl = add(g.vr, mul(g.ar, t));
    const r = rot(rl, psi), vr = rot(vl, psi), ar = rot(g.ar, psi), vO = add(g.vO, mul(g.aO, t));
    return { psi, O, r, B: add(O, r), k: RbExtra.frameTerms(vO, g.aO, W, g.Wd, r, vr, ar) };
  }
  function frame2D(svg, g, opt, uN, st) {
    const u = g.u, t = uN === undefined ? 0 : g.span[1] * uN, f = frameAt(g, t);
    const pts = []; for (let i = 0; i <= 40; i++) { const q = frameAt(g, (g.span[1] * i) / 40); pts.push(q.B, q.O); }
    const Lr = Math.max(L2(g.r), ...pts.map(L2), 1e-6);
    const D = UI.Draw2D(svg, bbox(pts.concat([[-Lr * 0.5, -Lr * 0.5], [Lr * 0.9, Lr * 0.9]]), 0.35), { pad: 26 });
    D.line([-Lr * 0.6, 0], [Lr * 1.3, 0], { stroke: '#9aa5ad', sw: 1, dash: '4 4' }); D.line([0, -Lr * 0.6], [0, Lr * 1.3], { stroke: '#9aa5ad', sw: 1, dash: '4 4' });
    D.text([Lr * 1.3, 0], 'X', { dx: 4, dy: 4, color: '#6b7782', size: 11.5 }); D.text([0, Lr * 1.3], 'Y', { dx: 4, dy: -2, color: '#6b7782', size: 11.5 });
    const ex = rot([Lr * 0.75, 0], f.psi), ey = rot([0, Lr * 0.75], f.psi);
    D.arrow(f.O, add(f.O, ex), { color: CA, w: 1.6, head: 9 }); D.arrow(f.O, add(f.O, ey), { color: CA, w: 1.6, head: 9 });
    D.text(add(f.O, ex), 'x', { dx: 5, dy: 4, color: CA, size: 12, weight: 700 }); D.text(add(f.O, ey), 'y', { dx: 5, dy: -2, color: CA, size: 12, weight: 700 });
    if (L2(g.vr) > 1e-12 || L2(g.ar) > 1e-12) { const d = L2(g.vr) > 1e-12 ? g.vr : g.ar, e = rot(mul(d, Lr * 0.6 / L2(d)), f.psi); D.line(add(f.B, mul(e, -1)), add(f.B, e), { stroke: LINK, sw: 9, op: 0.3 }); }
    if (st.jtrace !== false) D.pline(pts.filter((_, i) => i % 2 === 0), { stroke: CB, sw: 1.2, dash: '3 3' });
    D.line(f.O, f.B, { stroke: K.ink, sw: 1, dash: '5 3' });
    D.circle(f.O, 4 / D.sc, { fill: K.ink }); name(D, f.O, 'O', -16, 16);
    D.circle(f.B, 5.5 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 }); name(D, f.B, 'B', 8, 16, CB);
    spin(D, f.O, 24, g.W, `Ω = ${fmt(g.W)}`, CA);
    const k = f.k, vmax = Math.max(L2(k.v), 1e-9);
    if (st.jterms && uN === undefined && showArrows) {
      const terms = [[k.Wdr, 'Ω̇×r'], [k.WWr, 'Ω×(Ω×r)'], [k.cor, '2Ω×v_rel'], [rot(g.ar, f.psi), 'a_rel'], [g.aO, 'a_O']].filter(([a]) => L2(a) > 1e-9 * L2(k.a) + 1e-12);
      const amax = Math.max(...terms.map(([a]) => L2(a)), 1e-9);
      terms.forEach(([a, nm], i) => DYUI.vec(D, f.B, a, 20 + 60 * L2(a) / amax, { color: K.acc, w: 1.8, label: lbl(opt, `${nm} = ${fmt(L2(a))}`, nm), size: 11, anchor: a[0] < 0 ? 'end' : 'start', ldx: a[0] < 0 ? -6 : 6, ldy: 4 + (i % 2) * 10 }));
      arrowsAt(D, f.B, k.v, null, vmax, 1, opt, 'B', u);
    } else arrowsAt(D, f.B, k.v, k.a, vmax, Math.max(L2(k.a), 1e-9), opt, 'B', u);
    DYUI.title(D, 12, 20, uN === undefined ? `At the instant: v_B = ${fmt(L2(k.v))} ${u.V}, a_B = ${fmt(L2(k.a))} ${u.A}` : `t = ${fmt(t)} s: the frame has turned ${fmt(f.psi / D2R)}°`);
    return true;
  }

  /* frame carried on an arm: the arm turns about A, the car spins on B, and C rides in the car */
  function armAt(g, t) {
    const phi = g.ang + g.wab * t + 0.5 * g.aab * t * t, psi = (g.wab + g.wr) * t + 0.5 * (g.aab + g.ar) * t * t;
    const rl = add(add(g.rC, mul(g.vrel, t)), mul(g.arel, 0.5 * t * t)), vl = add(g.vrel, mul(g.arel, t));
    const q = RbExtra.armFrameTerms(g.La, phi, g.wab + g.aab * t, g.aab, g.wr + g.ar * t, g.ar, rot(rl, psi), rot(vl, psi), rot(g.arel, psi));
    return { phi, psi, q, B: q.rBA, C: add(q.rBA, rot(rl, psi)) };
  }
  function arm2D(svg, g, opt, uN, st) {
    const u = g.u, t = uN === undefined ? 0 : g.span[1] * uN, f = armAt(g, t), k = f.q.k;
    const Rc = Math.max(L2(g.rC) * 1.3, 0.15 * g.La);
    const pts = [[0, 0]], path = []; for (let i = 0; i <= 40; i++) { const q = armAt(g, (g.span[1] * i) / 40); pts.push(add(q.B, [Rc, Rc]), add(q.B, [-Rc, -Rc]), q.C); path.push(q.C); }
    const D = UI.Draw2D(svg, bbox(pts, 0.12), { pad: 30 });
    D.line([0, 0], [g.La * 0.45, 0], { stroke: K.ink, sw: 1, dash: '5 4' });
    D.arc([0, 0], 34, 0, f.phi / D2R, `${fmt(f.phi / D2R)}°`, { color: K.ink });
    if (st.jtrace !== false) D.pline(path, { stroke: CB, sw: 1.2, dash: '3 3' });
    DYUI.wheel(D, f.B, Rc, g.ang + f.psi + Math.PI / 2, { spokes: 4, fill: '#e3e8ec' });
    link(D, [0, 0], f.B); DYUI.pin(D, [0, 0], 0.07 * g.La); joint(D, [0, 0]); joint(D, f.B);
    name(D, [0, 0], 'A', -18, 16); name(D, f.B, 'B', 10, -10);
    D.line(f.B, f.C, { stroke: K.ink, sw: 1, dash: '4 3' });
    D.circle(f.C, 5.5 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 }); name(D, f.C, 'C', 10, 16, CB);
    spin(D, [0, 0], 48, g.wab + g.aab * t, `ω_AB = ${fmt(g.wab + g.aab * t)} rad/s`, K.ink);
    spin(D, f.B, Rc * D.sc + 12, g.wr + g.ar * t, `ω′ = ${fmt(g.wr + g.ar * t)} rad/s`, CA);
    const vmax = Math.max(L2(k.v), 1e-9);
    if (st.jterms && uN === undefined && showArrows) {
      const terms = [[f.q.B.a, 'a_B'], [k.Wdr, 'Ω̇×r'], [k.WWr, 'Ω×(Ω×r)'], [k.cor, '2Ω×v_rel'], [rot(g.arel, f.psi), 'a_rel']].filter(([a]) => L2(a) > 1e-9 * L2(k.a) + 1e-12);
      const amax = Math.max(...terms.map(([a]) => L2(a)), 1e-9);
      terms.forEach(([a, nm], i) => DYUI.vec(D, f.C, a, 20 + 60 * L2(a) / amax, { color: K.acc, w: 1.8, label: lbl(opt, `${nm} = ${fmt(L2(a))}`, nm), size: 11, anchor: a[0] < 0 ? 'end' : 'start', ldx: a[0] < 0 ? -6 : 6, ldy: 4 + (i % 2) * 10 }));
      arrowsAt(D, f.C, k.v, null, vmax, 1, opt, 'C', u);
    } else arrowsAt(D, f.C, k.v, uN === undefined ? k.a : null, vmax, Math.max(L2(k.a), 1e-9), opt, 'C', u);
    DYUI.title(D, 12, 20, uN === undefined ? `At the instant: v_C = ${fmt(L2(k.v))} ${u.V}, a_C = ${fmt(L2(k.a))} ${u.A}` : `t = ${fmt(t)} s: arm at ${fmt(f.phi / D2R)}°, v_C = ${fmt(L2(k.v))} ${u.V}`);
    return true;
  }

  /* double collar: the rod turns over the range of θ where it meets the circle, and the collar follows */
  function collarTheta(g, uN) {
    if (uN === undefined) return g.th;
    const sg = Math.sign(g.w) || 1;
    if (g.full) return g.th + sg * TAU * uN;
    const mid = (g.lo + g.hi) / 2, amp = ((g.hi - g.lo) / 2) * 0.96, ph = Math.asin(Math.max(-1, Math.min(1, (g.th - mid) / (amp || 1))));
    return mid + amp * Math.sin(ph + sg * TAU * uN);
  }
  /** Two small blocks pinned at C: one slides on the rod (along e), one on the ring (along t). */
  function collarBlocks(D, C, e, t, s) {
    const box = (dir, a, b, fill) => { const n = [-dir[1], dir[0]]; D.poly([[-a, -b], [a, -b], [a, b], [-a, b]].map(([x, y]) => add(C, add(mul(dir, x), mul(n, y)))), { fill, stroke: K.edge, sw: 1.4 }); };
    box(t, s * 0.9, s * 0.62, '#c9b28a'); box(e, s * 1.05, s * 0.45, '#e6d3ad');
    D.circle(C, 2.6 / D.sc, { fill: K.ink });
  }
  function collar2D(svg, g, opt, uN, st) {
    const u = g.u, th = collarTheta(g, uN), m = g.at(th);
    const q = m.err ? g.m : m, R = g.R, O = g.d;
    const ext = [[0, 0], [O[0] - R, O[1] - R], [O[0] + R, O[1] + R]];
    const D = UI.Draw2D(svg, bbox(ext, 0.22), { pad: 30 });
    D.circle(O, R, { stroke: '#8fb3a4', sw: Math.max(6, 0.06 * R * D.sc) }); D.circle(O, R, { stroke: '#5f8a78', sw: 1 });
    D.circle(O, 3.5 / D.sc, { fill: K.ink }); name(D, O, 'O', 8, 16);
    if (st.jshowR !== false) { D.line(O, q.rC, { stroke: K.ink, sw: 1, dash: '5 4' }); D.text(mul(add(O, q.rC), 0.5), `R = ${fmt(R)} ${u.L}`, { dx: 6, dy: -4, color: K.ink, size: 11 }); }
    const Lr = Math.max(q.r * 1.15, q.r + 0.25 * R), e = [Math.cos(th), Math.sin(th)];
    link(D, [0, 0], mul(e, Lr), 8); DYUI.pin(D, [0, 0], 0.12 * R); joint(D, [0, 0]); name(D, [0, 0], 'A', -18, 16);
    D.line([0, 0], [0.45 * R, 0], { stroke: K.ink, sw: 1, dash: '5 4' });
    const sp = Math.min(44, 0.09 * D.W); // arcs shrink on a narrow screen
    D.arc([0, 0], 0.68 * sp, 0, th / D2R, `θ = ${fmt(th / D2R)}°`, { color: K.ink });
    spin(D, [0, 0], sp, g.w, null, K.ink); // its label goes on the side of A away from the rod
    D.text([0, 0], `ω = ${fmt(g.w)} rad/s`, { dx: -e[0] * (sp + 12), dy: e[1] * (sp + 12) + 4, anchor: e[0] > 0.2 ? 'end' : e[0] < -0.2 ? 'start' : 'middle', color: K.ink, size: 11.5, weight: 700 });
    collarBlocks(D, q.rC, q.e, q.t, Math.max(0.07 * R, 7 / D.sc)); name(D, q.rC, 'C', 12, -12, CB);
    const vmax = Math.max(L2(q.k.v), 1e-9), amax = Math.max(L2(q.k.a), 1e-9);
    arrowsAt(D, q.rC, q.k.v, uN === undefined ? q.k.a : null, vmax, amax, opt, 'C', u);
    DYUI.title(D, 12, 20, `θ = ${fmt(th / D2R)}°:  r = ${fmt(q.r)} ${u.L},  v_C = ${fmt(L2(q.k.v))} ${u.V}${uN === undefined ? `,  a_C = ${fmt(L2(q.k.a))} ${u.A}` : ''}`);
    return true;
  }

  /* slotted link: the peg goes round the disk (when it is on one) and the link follows */
  function slotAt(g, psi) {
    if (!g.crank) return { B: g.r, vB: g.vB, aB: g.aB, k: g.k };
    const c = g.crank, rc = rot(c.rc, psi), B = add(c.c, rc), vB = mul([-rc[1], rc[0]], c.w), aB = add(mul([-rc[1], rc[0]], c.al), mul(rc, -c.w * c.w));
    return L2(B) > 1e-9 ? { B, vB, aB, k: RbExtra.slotSolve(B, vB, aB) } : null;
  }
  function slot2D(svg, g, opt, uN, st) {
    const u = g.u, psi = uN === undefined || !g.crank ? 0 : (Math.sign(g.crank.w) || 1) * TAU * uN, q = slotAt(g, psi) || slotAt(g, 0);
    const path = []; if (g.crank) for (let i = 0; i <= 72; i++) path.push(add(g.crank.c, rot(g.crank.rc, (i / 72) * TAU)));
    const Lmax = Math.max(L2(g.r), ...path.map(L2));
    const ext = [[0, 0], g.r].concat(path, g.crank ? [g.crank.c] : []);
    const D = UI.Draw2D(svg, bbox(ext, 0.3), { pad: 26 });
    if (g.crank) { const rc = L2(g.crank.rc); D.circle(g.crank.c, rc * 1.12, { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 }); DYUI.pin(D, g.crank.c, 0.06 * Lmax); link(D, g.crank.c, q.B, 6); joint(D, g.crank.c); name(D, g.crank.c, 'C', 10, 18); spin(D, g.crank.c, 22, g.crank.w, null, K.ink); }
    if (g.crank && st.jtrace !== false) D.pline(path, { stroke: CB, sw: 1.2, dash: '3 3' });
    const e = mul(q.B, 1 / L2(q.B)), n = [-e[1], e[0]], end = mul(e, Lmax * 1.25), hw = 0.035 * Lmax;
    D.poly([add([0, 0], mul(n, hw * 2)), add(end, mul(n, hw * 2)), add(end, mul(n, -hw * 2)), add([0, 0], mul(n, -hw * 2))], { fill: '#aab7c4', stroke: LINK, sw: 1.6 });
    D.poly([add(mul(e, Lmax * 0.18), mul(n, hw)), add(mul(e, Lmax * 1.18), mul(n, hw)), add(mul(e, Lmax * 1.18), mul(n, -hw)), add(mul(e, Lmax * 0.18), mul(n, -hw))], { fill: '#fff', stroke: LINK, sw: 1.2 });
    DYUI.pin(D, [0, 0], 0.08 * Lmax); joint(D, [0, 0]); name(D, [0, 0], 'A', -16, 16);
    D.circle(q.B, 6 / D.sc, { fill: CB, stroke: '#fff', sw: 1.5 }); name(D, q.B, 'B', 10, -10, CB);
    spin(D, [0, 0], 30, q.k.w, null, K.vel);
    const vmax = Math.max(L2(q.vB), 1e-9), amax = Math.max(L2(q.aB), 1e-9);
    arrowsAt(D, q.B, q.vB, uN === undefined ? q.aB : null, vmax, amax, opt, 'B', u);
    DYUI.title(D, 12, 20, `ω_AC = ${fmt(q.k.w)} rad/s${uN === undefined ? `,  α_AC = ${fmt(q.k.al)} rad/s²` : ''},  sliding ${fmt(q.k.vrel)} ${u.V}`);
    return true;
  }

  /* planetary gears: the arm turns, B rolls on A */
  function planetAt(g, t) {
    const parm = g.warm * t + 0.5 * g.aarm * t * t, pA = g.wA * t + 0.5 * g.aA * t * t, pB = g.wB * t + 0.5 * g.aB * t * t, th = g.th + parm;
    return { th, pA, pB, E: [g.L * Math.cos(th), g.L * Math.sin(th)], warm: g.warm + g.aarm * t };
  }
  function teeth(D, c, r, ph, ring, col) {
    const n = Math.max(10, Math.round(r / 0.012)), m = Math.min(r * 0.08, 0.025 * Math.max(r, 0.2)), pts = [];
    for (let i = 0; i < n * 2; i++) { const a = ph + (i / (n * 2)) * TAU, rr = r + (i % 2 ? -m : m) * (ring ? -1 : 1) * 0.5; pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); }
    D.poly(pts, { fill: 'none', stroke: col || K.edge, sw: 1.2 });
  }
  function planet2D(svg, g, opt, uN, st) {
    const u = g.u, t = uN === undefined ? 0 : g.span[1] * uN, p = planetAt(g, t);
    const R = g.ring ? g.rA * 1.22 : g.L + g.rB * 1.15;
    const D = UI.Draw2D(svg, { xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 28 });
    if (g.ring) { D.circle([0, 0], g.rA * 1.12, { fill: '#d5dbe1', stroke: K.edge, sw: 1.6 }); D.circle([0, 0], g.rA, { fill: '#fff', stroke: K.edge, sw: 1.2 }); teeth(D, [0, 0], g.rA, p.pA, true); const a = p.pA + Math.PI * 0.75; D.line([g.rA * Math.cos(a), g.rA * Math.sin(a)], [g.rA * 1.12 * Math.cos(a), g.rA * 1.12 * Math.sin(a)], { stroke: K.ink, sw: 2 }); }
    else { DYUI.wheel(D, [0, 0], g.rA, p.pA + Math.PI / 4, { spokes: 3, fill: '#d5dbe1' }); teeth(D, [0, 0], g.rA, p.pA); }
    D.text([0, 0], 'A', { dx: g.ring ? -g.rA * D.sc * 0.8 : -18, dy: g.ring ? -g.rA * D.sc * 0.8 : 18, color: K.ink, size: 13, weight: 700 });
    if (st.jtrace !== false) { const c = []; for (let i = 0; i <= 90; i++) { const a = (i / 90) * TAU; c.push([g.L * Math.cos(a), g.L * Math.sin(a)]); } D.pline(c, { stroke: CB, sw: 1.1, dash: '3 3' }); }
    DYUI.wheel(D, p.E, g.rB, p.pB + p.th, { spokes: 3, fill: '#eef1f4' }); teeth(D, p.E, g.rB, p.pB);
    link(D, [0, 0], p.E, 6); joint(D, [0, 0]); joint(D, p.E);
    const er = [Math.cos(p.th), Math.sin(p.th)], away = mul([-er[1], er[0]], -(Math.sign(p.warm) || 1)), toS = (w) => [w[0] * D.sc, -w[1] * D.sc];
    const lab = (q, txt, col, off) => { const d = toS(away), l = Math.hypot(d[0], d[1]) || 1; D.text(q, txt, { dx: (d[0] / l) * (off || 14), dy: (d[1] / l) * (off || 14) + 4, anchor: d[0] < -0.3 * l ? 'end' : d[0] > 0.3 * l ? 'start' : 'middle', color: col, size: 12.5, weight: 700 }); };
    lab(p.E, 'E', K.ink); lab(add(p.E, mul(away, g.rB * 0.6)), 'B', K.ink, 0);
    const fixedA = g.wA === 0 && g.aA === 0, F = mul(er, g.ring ? g.rA : g.rA); D.circle(F, 4 / D.sc, { fill: fixedA ? K.ic : K.ink }); lab(F, fixedA ? 'F (IC)' : 'F', fixedA ? K.ic : K.ink);
    spin(D, [0, 0], 22, p.warm, null, K.ink); spin(D, p.E, 18, g.wB + g.aB * t, null, K.vel);
    const vE = mul([-Math.sin(p.th), Math.cos(p.th)], p.warm * g.L), aE = rot(g.aE, p.th - g.th), vmax = Math.max(L2(vE), 1e-9), amax = Math.max(L2(aE), 1e-9);
    arrowsAt(D, p.E, vE, uN === undefined ? aE : null, vmax, amax, opt, 'E', u);
    DYUI.title(D, 12, 20, `ω_B = ${fmt(g.wB + g.aB * t)} rad/s${uN === undefined ? `,  α_B = ${fmt(g.aB)} rad/s²` : `  (t = ${fmt(t)} s)`}`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  function plot(svg, g, uN) {
    const u = g.u;
    if (g.mode === 'abs') {
      const p1 = [], p2 = [], th0 = g.th / D2R, F = root.Formula, vu = g.dir === 'ang' ? 'rad/s' : u.V, su = g.dir === 'ang' ? 'rad' : u.L;
      const sAt = (x) => g.f(x * D2R), vAt = (x) => F.d012(g.f, x * D2R)[1] * g.w;
      for (let i = 0; i <= 120; i++) { const x = th0 - 45 + (90 * i) / 120, s = sAt(x), v = vAt(x); if (isFinite(s) && isFinite(v) && Math.abs(v) < 1e6) { p1.push([x, s]); p2.push([x, v]); } }
      return DYUI.stack(svg, [{ label: `${g.name} (${su})`, color: CB, pts: p1, at: sAt }, { label: `v (${vu})`, color: K.vel, pts: p2, at: vAt }], { xlabel: 'θ (°)', cursor: absTheta(g, uN) / D2R, xmin: th0 - 45, xmax: th0 + 45 });
    }
    if (g.mode === 'rotframe' && g.arm) {
      const k = g.q.k, terms = [['a_B', g.q.B.a], ['Ω̇×r', k.Wdr], ['Ω×(Ω×r)', k.WWr], ['2Ω×v_rel', k.cor], ['a_rel', g.arel], ['a_C', k.a]];
      return DYUI.bars(svg, terms.flatMap(([n, a]) => [{ name: `${n} x`, v: a[0], color: n === 'a_C' ? K.acc : CA }, { name: 'y', v: a[1], color: n === 'a_C' ? K.acc : CB }]), { title: 'Acceleration', unit: u.A });
    }
    if (g.mode === 'rotframe') {
      const k = g.k, terms = [['a_O', g.aO], ['Ω̇×r', k.Wdr], ['Ω×(Ω×r)', k.WWr], ['2Ω×v_rel', k.cor], ['a_rel', g.ar], ['a_B', k.a]];
      return DYUI.bars(svg, terms.flatMap(([n, a]) => [{ name: `${n} x`, v: a[0], color: n === 'a_B' ? K.acc : CA }, { name: 'y', v: a[1], color: n === 'a_B' ? K.acc : CB }]), { title: 'Acceleration', unit: u.A });
    }
    if (g.mode === 'collar') {
      const lo = g.full ? g.th - Math.PI : g.lo, hi = g.full ? g.th + Math.PI : g.hi, p1 = [], p2 = [];
      const vAt = (x) => { const m = g.at(x * D2R); return m.err ? NaN : L2(m.k.v); }, rAt = (x) => { const m = g.at(x * D2R); return m.err ? NaN : m.rd; };
      for (let i = 0; i <= 160; i++) { const x = (lo + ((hi - lo) * i) / 160) / D2R, a = vAt(x), b = rAt(x); if (isFinite(a) && isFinite(b)) { p1.push([x, a]); p2.push([x, b]); } }
      return DYUI.stack(svg, [{ label: `v_C (${u.V})`, color: K.vel, pts: p1, at: vAt }, { label: `ṙ along the rod (${u.V})`, color: CB, pts: p2, at: rAt }], { xlabel: 'θ (°)', cursor: collarTheta(g, uN) / D2R, xmin: lo / D2R, xmax: hi / D2R });
    }
    if (g.mode === 'slot') {
      if (!g.crank) return DYUI.bars(svg, [{ name: 'ω_AC (rad/s)', v: g.k.w, color: K.vel }, { name: 'α_AC (rad/s²)', v: g.k.al, color: K.acc }, { name: `v_rel (${u.V})`, v: g.k.vrel, color: CA }, { name: `a_rel (${u.A})`, v: g.k.arel, color: CB }], { unit: '' });
      const sg = Math.sign(g.crank.w) || 1, p1 = [], p2 = [];
      const at = (x, w) => { const q = slotAt(g, sg * x * D2R); return q ? (w ? q.k.w : q.k.al) : NaN; };
      for (let i = 0; i <= 360; i += 2) { p1.push([i, at(i, true)]); p2.push([i, at(i, false)]); }
      return DYUI.stack(svg, [{ label: 'ω_AC (rad/s)', color: K.vel, pts: p1, at: (x) => at(x, true) }, { label: 'α_AC (rad/s²)', color: K.acc, pts: p2, at: (x) => at(x, false) }], { xlabel: 'angle the disk has turned (°)', cursor: uN === undefined ? 0 : 360 * uN, xmin: 0, xmax: 360 });
    }
    const T = g.span[1], a = [], b = []; for (let i = 0; i <= 100; i++) { const t = (T * i) / 100; a.push([t, g.warm + g.aarm * t]); b.push([t, g.wB + g.aB * t]); }
    return DYUI.stack(svg, [{ label: 'ω (rad/s)', color: CA, pts: a, at: (t) => g.warm + g.aarm * t, more: [{ pts: b, color: CB, at: (t) => g.wB + g.aB * t }] }], { xlabel: 't (s)   blue: arm, orange: gear B', cursor: uN === undefined ? 0 : T * uN, xmin: 0, xmax: T });
  }

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
  function draw3D(v, g, uN) {
    if (g.mode === 'collar') {
      const th = collarTheta(g, uN), m = g.at(th), q = m.err ? g.m : m, R = g.R, O = g.d, w = 0.06 * R;
      for (let i = 0; i < 48; i++) { const a0 = (i / 48) * TAU, a1 = ((i + 1) / 48) * TAU; slab(v, add(O, [R * Math.cos(a0), R * Math.sin(a0)]), add(O, [R * Math.cos(a1), R * Math.sin(a1)]), w, -w, w, '#a9c7ba'); }
      const e = [Math.cos(th), Math.sin(th)]; slab(v, [0, 0], mul(e, Math.max(q.r * 1.15, q.r + 0.25 * R)), w * 0.8, w * 1.2, w * 2.2, '#aab7c4');
      v.extrude([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(q.rC, add(mul(e, a * w * 1.5), mul([-e[1], e[0]], b * w)))), w * 1, w * 2.6, '#e6d3ad', 1, K.edge);
      v.setBounds([Math.min(0, O[0] - R) - w, Math.min(0, O[1] - R) - w, -R * 0.3], [Math.max(0, O[0] + R) + w, Math.max(0, O[1] + R) + w, R * 0.3]); return;
    }
    if (g.mode === 'planet') {
      const t = uN === undefined ? 0 : g.span[1] * uN, p = planetAt(g, t), h = g.rB * 0.4, R = g.ring ? g.rA * 1.15 : g.L + g.rB;
      if (g.ring) for (let i = 0; i < 36; i++) { const a0 = (i / 36) * TAU, a1 = ((i + 1) / 36) * TAU, rr = g.rA * 1.06; slab(v, [rr * Math.cos(a0), rr * Math.sin(a0)], [rr * Math.cos(a1), rr * Math.sin(a1)], g.rA * 0.12, -h / 2, h / 2, '#c3cbd3'); }
      else disk(v, [0, 0], g.rA, -h / 2, h / 2, '#c3cbd3', p.pA);
      disk(v, p.E, g.rB, -h / 2, h / 2, '#d5dbe1', p.pB + p.th); slab(v, [0, 0], p.E, g.rB * 0.25, h / 2, h * 0.9, '#aab7c4');
      v.setBounds([-R, -R, -h], [R, R, h]); return;
    }
    if (g.mode === 'slot') {
      const psi = uN === undefined || !g.crank ? 0 : (Math.sign(g.crank.w) || 1) * TAU * uN, q = slotAt(g, psi) || slotAt(g, 0), Lm = L2(g.r) * 1.25, e = mul(q.B, 1 / L2(q.B)), w = 0.08 * Lm;
      if (g.crank) disk(v, g.crank.c, L2(g.crank.rc) * 1.12, -w, 0, '#d5dbe1', psi + Math.atan2(g.crank.rc[1], g.crank.rc[0]));
      slab(v, [0, 0], mul(e, Lm), w, 0, w * 0.6, '#aab7c4');
      v.extrude([0, 1, 2, 3, 4, 5].map((i) => add(q.B, [w * 0.35 * Math.cos((i / 6) * TAU), w * 0.35 * Math.sin((i / 6) * TAU)])), -w, w, CB, 1, K.edge);
      const pts = [[0, 0], mul(e, Lm), g.r].concat(g.crank ? [add(g.crank.c, [L2(g.crank.rc) * 1.2, L2(g.crank.rc) * 1.2]), add(g.crank.c, [-L2(g.crank.rc) * 1.2, -L2(g.crank.rc) * 1.2])] : []);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); v.setBounds([Math.min(...xs), Math.min(...ys), -Lm * 0.3], [Math.max(...xs), Math.max(...ys), Lm * 0.3]); return;
    }
    if (g.mode === 'rotframe' && g.arm) {
      const t = uN === undefined ? 0 : g.span[1] * uN, f = armAt(g, t), Rc = Math.max(L2(g.rC) * 1.3, 0.15 * g.La), w = 0.05 * g.La;
      slab(v, [0, 0], f.B, w, 0, w, '#aab7c4');
      disk(v, f.B, Rc, w, w * 1.6, '#d5dbe1', g.ang + f.psi + Math.PI / 2);
      v.extrude([0, 1, 2, 3, 4, 5, 6, 7].map((i) => add(f.C, [Rc * 0.18 * Math.cos((i / 8) * TAU), Rc * 0.18 * Math.sin((i / 8) * TAU)])), w * 1.6, w * 3.2, CB, 1, K.edge);
      const R = g.La + Rc * 1.2; v.setBounds([-R, -R, -g.La * 0.2], [R, R, g.La * 0.2]); return;
    }
    if (g.mode === 'rotframe') {
      const t = uN === undefined ? 0 : g.span[1] * uN, f = frameAt(g, t), Lr = Math.max(L2(g.r), 1e-3), w = 0.08 * Lr;
      slab(v, f.O, add(f.O, rot([Lr * 1.3, 0], f.psi)), w, -w, 0, '#c3cbd3'); slab(v, f.O, add(f.O, rot([0, Lr * 1.3], f.psi)), w, -w, 0, '#c3cbd3');
      v.extrude([0, 1, 2, 3, 4, 5, 6, 7].map((i) => add(f.B, [w * Math.cos((i / 8) * TAU), w * Math.sin((i / 8) * TAU)])), 0, w * 1.5, CB, 1, K.edge);
      v.setBounds([-Lr * 1.5, -Lr * 1.5, -Lr * 0.3], [Lr * 1.5, Lr * 1.5, Lr * 0.3]); return;
    }
    const th = absTheta(g, uN), smax = Math.max(Math.abs(g.s0), 1e-3), R = g.dir === 'ang' ? 1 : smax * 0.45, w = R * 0.15;
    slab(v, [0, 0], [R * Math.cos(th), R * Math.sin(th)], w, 0, w * 0.6, '#aab7c4');
    if (g.dir === 'ang') { const s = g.f(th); slab(v, [1.6, 0], [1.6 + 1.2 * Math.cos(s), 1.2 * Math.sin(s)], w, 0, w * 0.6, '#c3cbd3'); v.setBounds([-1.2, -1.3, -0.5], [3, 1.3, 0.5]); return; }
    const along = g.dir === 'y' ? [0, 1] : [1, 0], s = g.f(th), P = mul(along, s), b = smax * 0.08;
    v.box(P[0] - b, P[1] - b, -b, P[0] + b, P[1] + b, b, K.body, 1, K.edge);
    v.setBounds([-R * 1.2 + Math.min(0, P[0]), -R * 1.2 + Math.min(0, P[1]), -R * 0.4], [R * 1.2 + Math.max(0, P[0]), R * 1.2 + Math.max(0, P[1]), R * 0.4]);
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const presets = (P0) => [
    { name: 'Test: Problem 16–42, circular cam x = 0.12 sin θ + 0.15 at θ = 30°, ω = 4 rad/s, α = 2 rad/s² (v = 0.416 m/s, a = −0.752 m/s²)', units: 'SI', state: P0({ mode: 'abs', jf: '0.12 sin θ + 0.15', jdir: 'x', jth: 30, jgiven: 'w', jw: 4, jal: 2 }),
      expect: [{ k: 'Velocity v', v: 0.4157 }, { k: 'Acceleration a', v: -0.7522 }] },
    { name: 'Test: Problem 16–41, rod CD pushes AB, x = 2 cot θ, ω = 5 rad/s at θ = 30° (v = −10 csc²θ = −40 ft/s)', units: 'US', state: P0({ mode: 'abs', jf: '2 cot θ', jdir: 'x', jth: 30, jgiven: 'w', jw: 5, jal: 0 }),
      expect: [{ k: 'Velocity v', v: -40 }] },
    { name: 'Test: Problem 16–130, ball in a tube at 2 ft, 5 ft/s and 3 ft/s² in the tube, Ω = 3 rad/s, Ω̇ = 5 rad/s² (a_B = −15i + 40j ft/s²)', units: 'US', state: P0({ mode: 'rotframe', jW: 3, jWd: 5, jrx: 2, jry: 0, jvrx: 5, jvry: 0, jarx: 3, jary: 0 }),
      expect: [{ k: 'Velocity v_B, x', v: 5 }, { k: 'Velocity v_B, y', v: 6 }, { k: 'Acceleration a_B, x', v: -15 }, { k: 'Acceleration a_B, y', v: 40 }] },
    { name: 'Test: Problem 16–133, water leaving a pump impeller at 25 m/s and 30 m/s² along the blade, Ω = −15 rad/s (v = −17.2i + 12.5j, a = 349i + 597j)', units: 'SI', state: P0({ mode: 'rotframe', jW: -15, jWd: 0, jrx: 0, jry: 0.3, jvrx: -21.65, jvry: 12.5, jarx: -25.98, jary: 15 }),
      expect: [{ k: 'Velocity v_B, x', v: -17.15 }, { k: 'Velocity v_B, y', v: 12.5 }, { k: 'Acceleration a_B, x', v: 349.0 }, { k: 'Acceleration a_B, y', v: 597.0 }] },
    { name: 'Test: Problem 16–134, block in a forked rod at 100 mm, cord pulled in at 2 m/s and 4 m/s², Ω = 4 rad/s (a = −5.60i − 16j m/s²)', units: 'SI', state: P0({ mode: 'rotframe', jW: 4, jWd: 0, jrx: 0.1, jry: 0, jvrx: -2, jvry: 0, jarx: -4, jary: 0 }),
      expect: [{ k: 'Acceleration a_B, x', v: -5.6 }, { k: 'Acceleration a_B, y', v: -16 }] },
    { name: 'Test: Problem 16–141, peg on a disk turning at 6 rad/s and 10 rad/s² drives slotted link AC (ω_AC = 0, α_AC = 14.4 rad/s² cw)', units: 'SI', state: P0({ mode: 'slot', jbx: 0.75, jby: 0, jsrc: 'crank', jcx: 0.75, jcy: -0.3, jcw: 6, jca: 10 }),
      expect: [{ k: 'Angular velocity of the link ω_AC', v: 0 }, { k: 'Angular acceleration of the link α_AC', v: -14.4 }] },
    { name: 'Test: Problem 16–139, quick return, crank AB 50 mm at 3 rad/s drives slotted member CD (ω_CD = 0.375 rad/s cw, α_CD = 2.44 rad/s² ccw)', units: 'SI', state: P0({ mode: 'slot', jbx: 0.2, jby: 0, jsrc: 'crank', jcx: 0.225, jcy: 0.0433013, jcw: 3, jca: 0 }),
      expect: [{ k: 'Angular velocity of the link ω_AC', v: -0.375 }, { k: 'Angular acceleration of the link α_AC', v: 2.436 }] },
    { name: 'Test: Problem 16–122, gear A fixed, arm DE at 6 rad/s and 3 rad/s² cw carries gear B (ω_B = 15 rad/s, α_B = 7.5 rad/s² cw)', units: 'SI', state: P0({ mode: 'planet', jring: 'sun', jrA: 0.3, jrB: 0.2, jwA: 0, jaA: 0, jwarm: -6, jaarm: -3, jpth: 30 }),
      expect: [{ k: 'Angular velocity of gear B, ω_B', v: -15 }, { k: 'Angular acceleration of gear B, α_B', v: -7.5 }] },
    { name: 'Test: Problem 16–123, gear A at 10 rad/s ccw, arm DE at 6 rad/s and 3 rad/s² cw (ω_B = 30 rad/s, α_B = 7.5 rad/s² cw)', units: 'SI', state: P0({ mode: 'planet', jring: 'sun', jrA: 0.3, jrB: 0.2, jwA: 10, jaA: 0, jwarm: -6, jaarm: -3, jpth: 30 }),
      expect: [{ k: 'Angular velocity of gear B, ω_B', v: -30 }, { k: 'Angular acceleration of gear B, α_B', v: -7.5 }] },
    { name: 'Planet gear inside a fixed ring gear, arm at 2 rad/s', units: 'SI', state: P0({ mode: 'planet', jring: 'ring', jrA: 0.5, jrB: 0.2, jwA: 0, jaA: 0, jwarm: 2, jaarm: 0.5, jpth: 45 }) },
    { name: 'Edge: planet larger than its ring gear (fails on purpose)', units: 'SI', fails: true, state: P0({ mode: 'planet', jring: 'ring', jrA: 0.2, jrB: 0.3 }) },
    { name: 'Test: Problem 16–146, ride car on a 10 ft arm at 30°, arm 2 rad/s and 1 rad/s², car −0.5 rad/s and −0.6 rad/s² on the arm, rider 2 ft below B (v_C = −7.00i + 17.3j ft/s, a_C = −38.8i − 6.84j ft/s²)', units: 'US',
      state: P0({ mode: 'rotframe', jframe: 'arm', jLa: 10, jang: 30, jwab: 2, jaab: 1, jwr: -0.5, jar: -0.6, jkx: 0, jky: -2, jkvx: 0, jkvy: 0, jkax: 0, jkay: 0 }),
      expect: [{ k: 'Speed of C, |v_C|', v: 18.68 }, { k: 'Velocity v_C, x', v: -7.0 }, { k: 'Velocity v_C, y', v: 17.32 }, { k: 'Acceleration a_C, x', v: -38.84 }, { k: 'Acceleration a_C, y', v: -6.840 }] },
    { name: 'Test: Problem 16–145, the same ride with both rates steady (v_C = −7.00i + 17.3j ft/s, a_C = −34.6i − 15.5j ft/s²)', units: 'US',
      state: P0({ mode: 'rotframe', jframe: 'arm', jLa: 10, jang: 30, jwab: 2, jaab: 0, jwr: -0.5, jar: 0, jkx: 0, jky: -2, jkvx: 0, jkvy: 0, jkax: 0, jkay: 0 }),
      expect: [{ k: 'Speed of C, |v_C|', v: 18.68 }, { k: 'Acceleration a_C, x', v: -34.64 }, { k: 'Acceleration a_C, y', v: -15.5 }] },
    { name: 'Ride car on a 4 m arm, a passenger walking across the car at 1 m/s', units: 'SI',
      state: P0({ mode: 'rotframe', jframe: 'arm', jLa: 4, jang: 20, jwab: 0.8, jaab: 0.2, jwr: 1.5, jar: 0, jkx: 0.8, jky: 0, jkvx: 0, jkvy: 1, jkax: 0, jkay: 0 }) },
    { name: 'Test: Problem 16–135, rod at 3 rad/s through a point A on a 0.4 m circle, double collar at θ = 30° (v_C = 2.40 m/s)', units: 'SI',
      state: P0({ mode: 'collar', jrth: 30, jrw: 3, jral: 0, jox: 0.4, joy: 0, jR: 0.4 }),
      expect: [{ k: 'Speed of C, v_C', v: 2.40 }, { k: 'Distance AC along the rod, r', v: 0.6928 }, { k: 'Speed along the rod, (v_C/A)xyz = ṙ', v: -1.20 }] },
    { name: 'Test: Problem 16–136, the same double collar at θ = 45° (v_C = 2.40 m/s, a_C = 14.4 m/s² toward O)', units: 'SI',
      state: P0({ mode: 'collar', jrth: 45, jrw: 3, jral: 0, jox: 0.4, joy: 0, jR: 0.4 }),
      expect: [{ k: 'Speed of C, v_C', v: 2.40 }, { k: 'Magnitude |a_C|', v: 14.4 }, { k: 'Its rate, (a_C/A)xyz = r̈', v: -5.091 }] },
    { name: 'Double collar with the pivot inside a 2 ft ring, rod speeding up', units: 'US',
      state: P0({ mode: 'collar', jrth: 120, jrw: 2, jral: 1.5, jox: 0.8, joy: -0.4, jR: 2 }) },
    { name: 'Edge: rod pointing away from the circle (fails on purpose)', units: 'SI', fails: true,
      state: P0({ mode: 'collar', jrth: 150, jrw: 3, jral: 0, jox: 0.4, joy: 0, jR: 0.4 }) },
  ];

  root.DRbExtraUI = { MODES, controls, diagram, cap2D, plotCaption, legend, draw2D, plot, draw3D, presets };
})(window);
