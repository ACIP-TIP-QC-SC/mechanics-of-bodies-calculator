/* =====================================================================
 * DYNAMICS · Planar kinetics of connected bodies and eccentric impact (inputs, diagrams, presets).
 * Physics: dy/rbsys.js. The Planar Kinetics module (dy/modRbForce.js) hands these scenes here.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, DY, DYUI, RbSys } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', LINK = '#5d6d7e', BEF = '#7f8c8d', D2R = Math.PI / 180, TAU = 2 * Math.PI;
  const SCENES = RbSys.SCENES;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const L2 = (a) => Math.hypot(a[0], a[1]);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const rot = (r, a) => [r[0] * Math.cos(a) - r[1] * Math.sin(a), r[0] * Math.sin(a) + r[1] * Math.cos(a)];
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  function controls(c, C, st, u) {
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const ml = u.us ? 'weight' : 'mass';
    let sec;
    if (st.scene === 'linked') {
      sec = C.section(c, 'Wheels');
      C.note(sec, 'Two wheels of the same rolling radius r are joined by a light link parallel to the slope. Wheel 1 is the upper one. Neither slips.');
      num(sec, 'xl1m', `Wheel 1: ${ml}`, u.M); num(sec, 'xl1k', 'Wheel 1: radius of gyration k_G', u.L);
      num(sec, 'xl2m', `Wheel 2: ${ml}`, u.M); num(sec, 'xl2k', 'Wheel 2: radius of gyration k_G', u.L);
      num(sec, 'xlr', 'Rolling radius r', u.L); num(sec, 'xlh', 'Height of the link above the slope h', u.L);
      sec = C.section(c, 'Slope');
      num(sec, 'xlphi', 'Angle of the slope φ', '°'); num(sec, 'xlmus', 'Static friction μ_s (0 to skip the check)', '');
    } else if (st.scene === 'geararm') {
      sec = C.section(c, 'Gears and arm');
      C.seg(sec, { label: 'The gears roll', get: () => st.xgring, set: (v) => (st.xgring = v), options: [['ring', 'Inside a fixed ring gear'], ['sun', 'Round a fixed sun gear']] });
      C.seg(sec, { label: 'Gears on the arm', get: () => String(st.xgn), set: (v) => (st.xgn = +v), options: [['1', 'One (arm pinned at one end)'], ['2', 'Two (one at each end)']] });
      num(sec, 'xgbm', `Arm (slender bar): ${ml}`, u.M); num(sec, 'xgR', 'Distance from the pin to each gear centre R', u.L);
      num(sec, 'xggm', `Each gear (thin disk): ${ml}`, u.M); num(sec, 'xgr', 'Gear radius r', u.L);
      num(sec, 'xgM', 'Couple on the arm M', u.MO);
      sec = C.section(c, 'Find');
      C.seg(sec, { label: 'Starting from rest, find', get: () => st.xgtask, set: (v) => (st.xgtask = v), options: [['turns', 'Turns to reach ω'], ['speed', 'ω after some turns']] });
      if (st.xgtask === 'speed') num(sec, 'xgrev', 'Turns of the arm', 'rev'); else num(sec, 'xgw', 'Angular velocity of the arm to reach', 'rad/s');
    } else if (st.scene === 'twobar') {
      sec = C.section(c, 'Bars');
      C.note(sec, 'Bar AB is pinned at A. Bar BC is pinned to it at B, and the light roller at C runs on the floor through A.');
      num(sec, 'xbm1', `AB: ${ml}`, u.M); num(sec, 'xbL1', 'AB: length', u.L); num(sec, 'xbm2', `BC: ${ml}`, u.M); num(sec, 'xbL2', 'BC: length (at least AB)', u.L);
      sec = C.section(c, 'Motion');
      num(sec, 'xbth1', 'Released from rest with AB at θ₁ above the floor', '°'); num(sec, 'xbth2', 'Find ω when AB is at θ₂', '°'); num(sec, 'xbM', 'Couple on AB (+ raises it; 0 if none)', u.MO);
    } else {
      sec = C.section(c, 'Impact');
      C.select(sec, { label: 'Situation', get: () => st.xetask, set: (v) => (st.xetask = v), options: [['strike', 'A pendulum or hammer swings down and strikes'], ['tip', 'A sliding block hits a stop and tips'], ['land', 'A body lands on a rough floor without slipping']] });
      if (st.xetask === 'strike') {
        sec = C.section(c, 'Swinging body (pinned at O)');
        num(sec, 'xem', `Body: ${ml}`, u.M); num(sec, 'xerG', 'Pin to its mass centre r_G', u.L);
        C.seg(sec, { label: 'Inertia given as', get: () => st.xeIby, set: (v) => (st.xeIby = v), options: [['I', 'I_O about the pin'], ['k', 'k_O about the pin']] });
        if (st.xeIby === 'k') num(sec, 'xekO', 'Radius of gyration about the pin k_O', u.L); else num(sec, 'xeIO', 'Moment of inertia about the pin I_O', u.I);
        num(sec, 'xeth0', 'Released from rest at θ₀ from the vertical', '°'); num(sec, 'xed', 'Pin to the point of impact d (at the bottom)', u.L);
        sec = C.section(c, 'What it strikes');
        num(sec, 'xemb', `Block at rest: ${ml} (0 for a fixed stop)`, u.M); num(sec, 'xee', 'Coefficient of restitution e', '');
      } else if (st.xetask === 'tip') {
        sec = C.section(c, 'Block');
        num(sec, 'xebm', `Block: ${ml}`, u.M); num(sec, 'xebb', 'Length along the motion b', u.L); num(sec, 'xebh', 'Height h', u.L);
        num(sec, 'xebv', 'Speed before it hits (0 to find only the least speed)', u.V);
      } else {
        sec = C.section(c, 'Body');
        C.seg(sec, { label: 'Body', get: () => st.xeshape, set: (v) => (st.xeshape = v), options: [['disk', 'Disk or wheel'], ['rod', 'Slender rod, lower end lands']] });
        num(sec, 'xedm', `Body: ${ml}`, u.M);
        if (st.xeshape === 'rod') { num(sec, 'xedl', 'Length l', u.L); num(sec, 'xedb', 'Angle of the rod with the floor', '°'); } else num(sec, 'xedr', 'Radius r', u.L);
        sec = C.section(c, 'Just before impact');
        num(sec, 'xedv', 'Speed of G', u.V); num(sec, 'xedang', 'Direction of v_G below the horizontal (90 straight down, < 90 moving right)', '°'); num(sec, 'xedw', 'Angular velocity ω₁ (+ counterclockwise)', 'rad/s');
        num(sec, 'xede', 'Coefficient of restitution e', '');
      }
    }
  }
  function diagram(c, C, st) {
    if (st.scene === 'linked' || st.scene === 'twobar') C.toggle(c, { label: 'Free-body forces', get: () => st.fbd !== false, set: (v) => (st.fbd = v), rebuild: false });
    if (st.scene === 'eimpact') C.toggle(c, { label: 'Velocities before (grey) and after (green)', get: () => st.xvel !== false, set: (v) => (st.xvel = v), rebuild: false });
  }
  const cap2D = (st) => ({ linked: 'Wheels joined by a link, with their free-body forces', geararm: 'Arm and gears driven by a couple', twobar: 'Two bars released from rest', eimpact: { strike: 'Pendulum striking', tip: 'Block tipping over a stop', land: 'Body landing on a rough floor' }[st.xetask] || 'Impact' }[st.scene]);
  const plotCaption = (st) => ({ linked: 'Forces on the wheels', geararm: 'Angular velocity of the arm against turns', twobar: 'ω_AB as AB falls from θ₁ to θ₂', eimpact: 'Kinetic energy before and after the impact' }[st.scene]);
  const hint = (st) => (st.scene === 'twobar' ? 'Press Play to step the bars from θ₁ to θ₂.' : st.scene === 'eimpact' ? 'Press Play to run the approach, the impact and what follows. Grey arrows are velocities just before, green just after.' : 'Press Play to run the motion from rest.');
  const legend = (st) => (st.scene === 'eimpact' ? [[BEF, 'Velocity before'], [K.vel, 'Velocity after'], [K.body, 'Body']] : [[K.force, 'Force'], [K.vel, 'Velocity'], [LINK, 'Links', 'ln']]);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  const link = (D, a, b, w) => { D.line(a, b, { stroke: LINK, sw: w || 8 }); D.line(a, b, { stroke: '#aab7c4', sw: (w || 8) - 3 }); };
  const joint = (D, p) => D.circle(p, 4.5 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.5 });
  const name = (D, p, s, dx, dy, col) => D.text(p, s, { dx: dx === undefined ? 8 : dx, dy: dy === undefined ? -8 : dy, color: col || K.ink, size: 12.5, weight: 700 });
  function spin(D, c, px, w, label, col) {
    if (Math.abs(w) < 1e-12) return;
    const sg = Math.sign(w), a0 = 110, a1 = a0 + sg * 250, col2 = col || K.ink;
    D.arc(c, px, a0, a1, null, { color: col2 });
    const e = a1 * D2R, t = [-Math.sin(e) * sg, Math.cos(e) * sg], p = [c[0] + (px * Math.cos(e)) / D.sc, c[1] + (px * Math.sin(e)) / D.sc];
    D.arrow([p[0] - (t[0] * 8) / D.sc, p[1] - (t[1] * 8) / D.sc], p, { color: col2, w: 1.4, head: 8 });
    if (label) D.text(c, label, { dx: -px - 6, dy: -px * 0.75, anchor: 'end', color: col2, size: 11.5, weight: 700 });
  }
  /** Force arrow from p along d, length scaled by |f|/fmax; label at the head. */
  function force(D, p, d, f, fmax, label, o) {
    o = o || {};
    if (!(Math.abs(f) > 1e-9 * fmax)) return;
    const dd = f < 0 ? mul(d, -1) : d, px = Math.min(o.maxPx || 1e9, 22 + 46 * Math.min(1, Math.abs(f) / fmax));
    DYUI.vec(D, p, dd, px, { color: K.force, w: 2.2, label, size: 11, head: o.head, anchor: dd[0] < -0.3 ? 'end' : dd[0] > 0.3 ? 'start' : 'middle', ldx: dd[0] < -0.3 ? -5 : dd[0] > 0.3 ? 5 : 0, ldy: o.ldy !== undefined ? o.ldy : dd[1] < -0.3 ? 14 : -6 });
  }
  function draw2D(svg, g, opt, uN, st) {
    st = st || {};
    if (g.scene === 'linked') return linked2D(svg, g, opt, uN, st);
    if (g.scene === 'geararm') return gear2D(svg, g, opt, uN);
    if (g.scene === 'twobar') return twobar2D(svg, g, opt, uN, st);
    return ({ strike: strike2D, tip: tip2D, land: land2D })[g.task](svg, g, opt, uN, st);
  }

  /* ---- wheels joined by a link ---- */
  function linked2D(svg, g, opt, uN, st) {
    const u = g.u, r = g.r, gap = 4.2 * r, e = [Math.cos(g.phi), -Math.sin(g.phi)], n = [Math.sin(g.phi), Math.cos(g.phi)];
    const t = uN === undefined ? 0 : g.span[1] * uN, s = 0.5 * g.a * t * t, turn = -s / r;
    const c1 = add(mul(e, s), mul(n, r)), c2 = add(mul(e, s + gap), mul(n, r));
    const ext = [mul(e, -1.2 * r), mul(e, gap + 3.4 * r), add(mul(e, -r), mul(n, 3.2 * r)), add(mul(e, gap + 3 * r), mul(n, 3 * r))];
    const xs = ext.map((p) => p[0]), ys = ext.map((p) => p[1]), m = 0.6 * r;
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs) - m, xmax: Math.max(...xs) + m, ymin: Math.min(...ys) - m, ymax: Math.max(...ys) + m }, { pad: 30 });
    DYUI.ground(D, mul(e, -1.6 * r), mul(e, gap + 3.6 * r), 0.25 * r);
    D.arc(mul(e, gap + 3.4 * r), 34, 180, 180 - g.phi / D2R, `φ = ${fmt(g.phi / D2R)}°`, { color: K.ink });
    DYUI.wheel(D, c1, r, turn, { spokes: 3 }); DYUI.wheel(D, c2, r, turn, { spokes: 3 });
    const hp = (c) => add(c, mul(n, g.h - r)), p1 = hp(c1), p2 = hp(c2);
    link(D, p1, p2, 7); joint(D, p1); joint(D, p2);
    name(D, c1, '1', -16, 4); name(D, c2, '2', 10, 4);
    if (st.fbd !== false) {
      const W1 = g.m1 * u.g, W2 = g.m2 * u.g, fm = Math.max(W1, W2, 1e-9), ct1 = mul(e, s), ct2 = mul(e, s + gap);
      const wpx = 0.62 * r * D.sc; force(D, c1, [0, -1], W1, fm, lbl(opt, `W₁ = ${fmt(W1)}`, 'W₁'), { maxPx: wpx, ldy: 2 }); force(D, c2, [0, -1], W2, fm, lbl(opt, `W₂ = ${fmt(W2)}`, 'W₂'), { maxPx: wpx, ldy: 2 });
      force(D, ct1, n, g.N1, fm, lbl(opt, `N₁ = ${fmt(g.N1)}`, 'N₁'), { head: true }); force(D, ct2, n, g.N2, fm, lbl(opt, `N₂ = ${fmt(g.N2)}`, 'N₂'), { head: true });
      force(D, ct1, mul(e, -1), g.f1, fm, lbl(opt, `F₁ = ${fmt(Math.abs(g.f1))}`, 'F₁'), { ldy: 16 }); force(D, ct2, mul(e, -1), g.f2, fm, lbl(opt, `F₂ = ${fmt(Math.abs(g.f2))}`, 'F₂'), { ldy: 16 });
    }
    DYUI.title(D, 12, 20, `α = ${fmt(g.al)} rad/s² for both wheels,  link force T = ${fmt(g.T)} ${u.F}${g.T < 0 ? ' (compression)' : ''}`);
    return true;
  }

  /* ---- arm and gears ---- */
  function gear2D(svg, g, opt, uN) {
    const u = g.u, t = uN === undefined ? 0 : g.span[1] * uN, th = 0.5 * g.al * t * t + 20 * D2R, w = g.al * t, R = g.R, r = g.r;
    const big = g.ring ? R + r : R - r, ext = g.ring ? big * 1.2 : R + r * 1.25;
    const D = UI.Draw2D(svg, { xmin: -ext, xmax: ext, ymin: -ext, ymax: ext }, { pad: 28 });
    if (g.ring) { D.circle([0, 0], big * 1.1, { fill: '#d5dbe1', stroke: K.edge, sw: 1.6 }); D.circle([0, 0], big, { fill: '#fff', stroke: K.edge, sw: 1.2 }); name(D, [-big * 0.72, big * 0.8], 'C (fixed)', 0, 0); }
    else if (big > 0) { DYUI.wheel(D, [0, 0], big, 0, { spokes: 0, fill: '#d5dbe1' }); name(D, [0, 0], 'C (fixed)', -30, big * D.sc + 16); }
    const ends = g.n === 2 ? [rot([R, 0], th), rot([-R, 0], th)] : [rot([R, 0], th)];
    ends.forEach((E, i) => { DYUI.wheel(D, E, r, -(g.ring ? 1 : -1) * g.ratio * (th - 20 * D2R) + i, { spokes: 3, fill: '#eef1f4' }); });
    link(D, g.n === 2 ? ends[1] : [0, 0], ends[0], 8);
    joint(D, [0, 0]); ends.forEach((E) => joint(D, E));
    ends.forEach((E, i) => name(D, E, i ? 'B' : 'A', 10, -10));
    spin(D, [0, 0], 26, g.M, lbl(opt, `M = ${fmt(g.M)} ${u.MO}`, 'M'), K.force);
    DYUI.title(D, 12, 20, uN === undefined ? `From rest: θ = ${fmt(g.th / TAU)} rev when ω = ${fmt(g.w)} rad/s` : `t = ${fmt(t)} s: ω = ${fmt(w)} rad/s after ${fmt((th - 20 * D2R) / TAU)} rev`);
    return true;
  }

  /* ---- two bars ---- */
  function twobar2D(svg, g, opt, uN, st) {
    const u = g.u, th = uN === undefined ? g.th2 : g.th1 + (g.th2 - g.th1) * ease(uN), p = g.at(th) || g.at(g.th2), w = g.wAt(th);
    const xmax = g.L1 + g.L2, H = Math.max(g.L1, 0.3 * xmax);
    const D = UI.Draw2D(svg, { xmin: -0.3 * xmax, xmax: xmax * 1.15, ymin: -0.3 * H, ymax: H * 1.25 }, { pad: 28 });
    const rr = 0.025 * xmax; DYUI.ground(D, [-0.25 * xmax, -rr], [xmax * 1.12, -rr], 0.06 * xmax);
    if (uN === undefined && g.th1 !== g.th2) { const q = g.at(g.th1); if (q) { D.line([0, 0], q.B, { stroke: '#9aa5ad', sw: 2, dash: '5 4' }); D.line(q.B, q.C, { stroke: '#9aa5ad', sw: 2, dash: '5 4' }); } }
    DYUI.pin(D, [0, 0], rr);
    link(D, [0, 0], p.B); link(D, p.B, p.C);
    D.circle(p.C, rr, { fill: '#fff', stroke: K.edge, sw: 1.5 });
    joint(D, [0, 0]); joint(D, p.B);
    name(D, [0, 0], 'A', -16, 16); name(D, p.B, 'B', 0, -12); name(D, p.C, 'C', 10, 18);
    if (st.fbd !== false) { const W1 = g.m1 * u.g, W2 = g.m2 * u.g, fm = Math.max(W1, W2); force(D, p.G1, [0, -1], W1, fm, lbl(opt, `W_AB = ${fmt(W1)}`, 'W_AB')); force(D, p.G2, [0, -1], W2, fm, lbl(opt, `W_BC = ${fmt(W2)}`, 'W_BC')); }
    if (isFinite(w) && w > 1e-9) { spin(D, [0, 0], 22, -w, null, K.vel); const vC = Math.abs(((g.at(th + 1e-5) || p).C[0] - (g.at(th - 1e-5) || p).C[0]) / 2e-5) * w; if (vC > 1e-9) DYUI.vec(D, p.C, [1, 0], 50, { color: K.vel, label: lbl(opt, `v_C = ${fmt(vC)} ${u.V}`, 'v_C'), size: 11, ldy: -10 }); }
    D.arc([0, 0], 40, 0, th / D2R, `θ = ${fmt(th / D2R)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, `θ = ${fmt(th / D2R)}°:  ω_AB = ${fmt(isFinite(w) ? w : 0)} rad/s`);
    return true;
  }

  /* ---- pendulum striking ---- */
  function strike2D(svg, g, opt, uN, st) {
    const u = g.u, d = g.d, dir = (a) => [Math.sin(a), -Math.cos(a)];
    let ang = 0, sB = 0, phase = 'impact';
    if (uN !== undefined) {
      if (uN < 0.4) { ang = -g.th0 * Math.cos((Math.PI / 2) * (uN / 0.4)); phase = 'before'; }
      else { const f = (uN - 0.4) / 0.6; ang = (g.w2 >= 0 ? 1 : -1) * g.reb * Math.sin((Math.PI / 2) * Math.min(1, f * 1.4)); sB = g.vb2 * f * 0.5 * Math.sqrt(d / u.g) * 3; phase = 'after'; }
    }
    const tip = mul(dir(ang), d), bs = 0.22 * d;
    const D = UI.Draw2D(svg, { xmin: -1.15 * d, xmax: 1.5 * d, ymin: -1.25 * d, ymax: 0.25 * d }, { pad: 28 });
    D.poly([[-0.25 * d, 0], [0.25 * d, 0], [0.25 * d, 0.08 * d], [-0.25 * d, 0.08 * d]], { fill: 'url(#hatch)', stroke: 'none' }); D.line([-0.25 * d, 0], [0.25 * d, 0], { stroke: K.ink, sw: 1.6 });
    D.line([0, 0], mul(dir(0), d * 1.1), { stroke: '#9aa5ad', sw: 1, dash: '4 4' });
    if (uN === undefined) { D.line([0, 0], mul(dir(-g.th0), d), { stroke: '#9aa5ad', sw: 2, dash: '5 4' }); D.arc([0, 0], 36, -90 - g.th0 / D2R, -90, `θ₀ = ${fmt(g.th0 / D2R)}°`, { color: K.ink }); }
    link(D, [0, 0], tip, 7); D.circle(tip, 0.07 * d, { fill: '#c3cbd3', stroke: K.edge, sw: 1.6 }); joint(D, [0, 0]); name(D, [0, 0], 'O', 10, -6);
    const fl = -d - 0.07 * d - bs / 2; // floor under the block
    if (g.mb > 0) {
      const x0 = 0.07 * d + sB; D.poly([[x0, fl], [x0 + bs * 1.2, fl], [x0 + bs * 1.2, fl + bs], [x0, fl + bs]], { fill: K.body, stroke: K.edge, sw: 1.6 });
      DYUI.ground(D, [-0.4 * d, fl], [1.45 * d, fl], 0.05 * d);
    } else { D.poly([[0.075 * d, fl], [0.2 * d, fl], [0.2 * d, -0.6 * d], [0.075 * d, -0.6 * d]], { fill: 'url(#hatch)', stroke: K.ink, sw: 1.2 }); name(D, [0.2 * d, -0.6 * d], 'stop', 4, -4); }
    if (st.xvel !== false && (phase === 'impact')) {
      const v1 = g.w1 * d, vmax = Math.max(v1, Math.abs(g.w2 * d), g.vb2, 1e-9);
      DYUI.vec(D, add(tip, [0, 0.12 * d]), [1, 0], 20 + 60 * v1 / vmax, { color: BEF, label: lbl(opt, `v₁ = ${fmt(v1)} ${u.V}`, 'v₁'), size: 11, ldy: -6 });
      if (Math.abs(g.w2 * d) > 1e-9) DYUI.vec(D, add(tip, [0, -0.12 * d]), [Math.sign(g.w2), 0], 20 + 60 * Math.abs(g.w2 * d) / vmax, { color: K.vel, label: lbl(opt, `ω₂d = ${fmt(Math.abs(g.w2 * d))} ${u.V}`, 'ω₂d'), size: 11, anchor: g.w2 < 0 ? 'end' : 'start', ldx: g.w2 < 0 ? -6 : 6, ldy: 14 });
      if (g.mb > 0 && g.vb2 > 1e-9) DYUI.vec(D, [0.07 * d + bs * 1.2, fl + bs / 2], [1, 0], 20 + 60 * g.vb2 / vmax, { color: K.vel, label: lbl(opt, `v_B = ${fmt(g.vb2)} ${u.V}`, 'v_B'), size: 11, ldy: 14 });
    }
    DYUI.title(D, 12, 20, `ω₁ = ${fmt(g.w1)} → ω₂ = ${fmt(g.w2)} rad/s${g.mb > 0 ? `,  v_B = ${fmt(g.vb2)} ${u.V}` : ''},  swings on to ${fmt(g.reb / D2R)}°`);
    return true;
  }

  /* ---- block tipping over a stop ---- */
  function tip2D(svg, g, opt, uN, st) {
    const u = g.u, b = g.b, h = g.h, tips = g.v >= g.vmin - 1e-9;
    const top = Math.atan2(b, h); // turn that puts G above D
    let x = 0, a = 0;
    if (uN !== undefined) { if (uN < 0.3) x = -b * 0.8 * (1 - uN / 0.3); else { const f = (uN - 0.3) / 0.7; a = tips ? (Math.PI / 2) * ease(f) : top * 0.9 * Math.min(1, g.v / g.vmin) ** 2 * Math.sin(Math.PI * f); } }
    const corners = [[-b, 0], [0, 0], [0, h], [-b, h]].map((p) => add(rot(p, -a), [x, 0])), G = add(rot([-b / 2, h / 2], -a), [x, 0]);
    const S = Math.max(b, h), D = UI.Draw2D(svg, { xmin: -2 * S, xmax: 1.6 * S, ymin: -0.35 * S, ymax: 1.45 * S }, { pad: 28 });
    DYUI.ground(D, [-2 * S, 0], [1.6 * S, 0], 0.08 * S);
    if (uN === undefined) { const ghost = [[-b, 0], [0, 0], [0, h], [-b, h]].map((p) => rot(p, -top)); D.poly(ghost, { fill: 'none', stroke: '#9aa5ad', sw: 1.4, dash: '5 4' }); D.text(rot([-b / 2, h / 2], -top), 'G over D', { dx: 8, dy: -8, color: '#6b7782', size: 11 }); }
    D.poly(corners, { fill: K.body, stroke: K.edge, sw: 1.6 });
    D.poly([[0.02 * S, 0], [0.09 * S, 0], [0.09 * S, 0.07 * S], [0.02 * S, 0.07 * S]], { fill: K.ink }); name(D, [0.09 * S, 0.07 * S], 'S', 4, -2);
    D.circle(G, 4 / D.sc, { fill: K.ink }); name(D, G, 'G', 8, -6); name(D, [x, 0], 'D', -4, 16);
    if (st.xvel !== false && uN === undefined) DYUI.vec(D, [-b - 0.02 * S, h / 2], [1, 0], 40, { color: BEF, head: true, label: lbl(opt, `v = ${fmt(g.v)} ${u.V}`, 'v'), size: 11, anchor: 'end', ldx: -50, ldy: -8 });
    DYUI.title(D, 12, 20, `Least speed to tip over: ${fmt(g.vmin)} ${u.V}${g.v !== g.vmin ? `;  at ${fmt(g.v)} ${u.V} it ${tips ? 'tips over' : 'falls back'}` : ''}`);
    return true;
  }

  /* ---- body landing on a rough floor ---- */
  function landShape(D, g, G, a, fill, stroke, dash) {
    if (g.disk) { DYUI.wheel(D, G, g.r, a, { spokes: 2, fill, stroke, op: dash ? 0.5 : 1 }); return; }
    const e = rot([Math.cos(g.beta), Math.sin(g.beta)], a), hl = g.l / 2;
    D.line(add(G, mul(e, -hl)), add(G, mul(e, hl)), { stroke: stroke || LINK, sw: 7, dash: dash ? '6 4' : undefined, op: dash ? 0.6 : 1 });
    D.circle(G, 3.5 / D.sc, { fill: K.ink });
  }
  function land2D(svg, g, opt, uN, st) {
    const u = g.u, S = g.disk ? 2 * g.r : g.l, G0 = mul(g.rho, -1); // G at the instant of impact (A at the origin)
    const v1n = g.v1, v2 = g.v2, sp1 = L2(v1n) || 1, sp2 = L2(v2), T = 1.1 * S / sp1;
    const D = UI.Draw2D(svg, { xmin: -1.8 * S, xmax: 1.8 * S, ymin: -0.25 * S, ymax: 1.7 * S }, { pad: 28 });
    DYUI.ground(D, [-1.8 * S, 0], [1.8 * S, 0], 0.07 * S);
    let G = G0, a = 0, ghost = uN === undefined;
    if (uN !== undefined) { if (uN < 0.45) { const t = -T * (1 - uN / 0.45); G = add(G0, mul(v1n, t)); a = g.w1 * t; } else { const t = T * (sp1 / Math.max(sp2, 1e-9)) * Math.min(1, (uN - 0.45) / 0.55) * Math.min(1, sp2 / sp1 * 2); G = add(G0, mul(v2, t)); a = g.w2 * t; } }
    if (ghost) { const Gb = add(G0, mul(v1n, -T)); landShape(D, g, Gb, -g.w1 * T * 0, '#eef1f4', '#9aa5ad', true); if (st.xvel !== false) { DYUI.vec(D, Gb, v1n, 30 + 30, { color: BEF, label: lbl(opt, `v₁ = ${fmt(sp1)} ${u.V}`, 'v₁'), size: 11, anchor: v1n[0] < 0 ? 'end' : 'start', ldx: v1n[0] < 0 ? -6 : 6 }); spin(D, Gb, 18, g.w1, null, BEF); } }
    landShape(D, g, G, a, '#d5dbe1');
    if (uN === undefined) { D.circle([0, 0], 4 / D.sc, { fill: K.ic }); name(D, [0, 0], 'A', 6, 16, K.ic); }
    if (st.xvel !== false && uN === undefined && sp2 > 1e-9) { DYUI.vec(D, G, v2, 30 + 30 * Math.min(1, sp2 / sp1), { color: K.vel, label: lbl(opt, `v_G = ${fmt(sp2)} ${u.V}`, 'v_G'), size: 11, anchor: v2[0] < 0 ? 'end' : 'start', ldx: v2[0] < 0 ? -6 : 6 }); spin(D, G, 20, g.w2, lbl(opt, `ω₂ = ${fmt(Math.abs(g.w2))}`, 'ω₂'), K.vel); }
    DYUI.title(D, 12, 20, `After: ω₂ = ${fmt(g.w2)} rad/s,  v_G = ${fmt(sp2)} ${u.V} at ${fmt(Math.atan2(v2[1], v2[0]) / D2R)}°`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  function plot(svg, g, uN) {
    const u = g.u;
    if (g.scene === 'linked') return DYUI.bars(svg, [{ name: 'Link T', v: g.T, color: LINK }, { name: 'F₁', v: g.f1, color: CA }, { name: 'F₂', v: g.f2, color: CB }, { name: 'N₁', v: g.N1, color: CA }, { name: 'N₂', v: g.N2, color: CB }], { title: 'Force', unit: u.F });
    if (g.scene === 'geararm') {
      const n = g.th / TAU, pts = []; for (let i = 0; i <= 100; i++) { const x = (n * i) / 100; pts.push([x, Math.sqrt((2 * g.M * x * TAU) / g.J)]); }
      const t = uN === undefined ? null : g.span[1] * uN, cur = t === null ? n : (0.5 * g.al * t * t) / TAU;
      return DYUI.stack(svg, [{ label: 'ω_arm (rad/s)', color: CA, pts, at: (x) => Math.sqrt(Math.max(0, (2 * g.M * x * TAU) / g.J)) }], { xlabel: 'turns of the arm (rev)', cursor: cur, xmin: 0, xmax: n || 1 });
    }
    if (g.scene === 'twobar') {
      const a = Math.min(g.th1, g.th2) / D2R, b = Math.max(g.th1, g.th2) / D2R, pts = []; for (let i = 0; i <= 90; i++) { const x = a + ((b - a) * i) / 90, w = g.wAt(x * D2R); if (isFinite(w)) pts.push([x, w]); }
      const th = uN === undefined ? g.th2 : g.th1 + (g.th2 - g.th1) * ease(uN);
      return DYUI.stack(svg, [{ label: 'ω_AB (rad/s)', color: CA, pts, at: (x) => g.wAt(x * D2R) }], { xlabel: 'angle of AB θ (°)', cursor: th / D2R, xmin: a, xmax: b > a ? b : a + 1 });
    }
    if (g.task === 'strike') { const T1 = 0.5 * g.IO * g.w1 * g.w1, T2 = 0.5 * g.IO * g.w2 * g.w2, TB = 0.5 * g.mb * g.vb2 * g.vb2; return DYUI.bars(svg, [{ name: 'Before', v: T1, color: BEF }, { name: 'Body after', v: T2, color: CA }, { name: 'Block after', v: TB, color: CB }, { name: 'Lost', v: T1 - T2 - TB, color: K.force }], { title: 'Kinetic energy', unit: u.E }); }
    if (g.task === 'tip') { const T0 = 0.5 * g.m * g.v * g.v, w2 = (g.m * g.v * g.h) / 2 / g.ID, T2 = 0.5 * g.ID * w2 * w2, need = g.m * u.g * (g.rD - g.h / 2); return DYUI.bars(svg, [{ name: 'Before', v: T0, color: BEF }, { name: 'Just after', v: T2, color: CA }, { name: 'Needed to tip', v: need, color: CB }], { title: 'Kinetic energy', unit: u.E }); }
    const T1 = 0.5 * g.m * L2(g.v1) ** 2 + 0.5 * g.IG * g.w1 * g.w1, T2 = 0.5 * g.m * L2(g.v2) ** 2 + 0.5 * g.IG * g.w2 * g.w2;
    return DYUI.bars(svg, [{ name: 'Before', v: T1, color: BEF }, { name: 'After', v: T2, color: K.vel }, { name: 'Lost', v: T1 - T2, color: K.force }], { title: 'Kinetic energy', unit: u.E });
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
  const bounds = (v, pts, zr) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); v.setBounds([Math.min(...xs), Math.min(...ys), -zr], [Math.max(...xs), Math.max(...ys), zr]); };
  function draw3D(v, g, uN) {
    if (g.scene === 'linked') {
      const r = g.r, gap = 4.2 * r, e = [Math.cos(g.phi), -Math.sin(g.phi)], n = [Math.sin(g.phi), Math.cos(g.phi)], t = uN === undefined ? 0 : g.span[1] * uN, s = 0.5 * g.a * t * t;
      const c1 = add(mul(e, s), mul(n, r)), c2 = add(mul(e, s + gap), mul(n, r)), w = 0.3 * r;
      slab(v, mul(e, -1.5 * r), mul(e, gap + 3.5 * r), 0.02 * r, -r, r, '#d5dbe1');
      v.extrude([mul(e, -1.5 * r), mul(e, gap + 3.5 * r), add(mul(e, gap + 3.5 * r), mul(n, -0.2 * r)), add(mul(e, -1.5 * r), mul(n, -0.2 * r))], -r, r, '#d5dbe1', 1, K.edge);
      disk(v, c1, r, -w, w, '#c3cbd3', -s / r); disk(v, c2, r, -w, w, '#c3cbd3', -s / r);
      slab(v, add(c1, mul(n, g.h - r)), add(c2, mul(n, g.h - r)), 0.1 * r, w, 1.4 * w, '#aab7c4');
      bounds(v, [mul(e, -1.5 * r), mul(e, gap + 3.5 * r), add(c1, mul(n, 1.5 * r)), add(c2, mul(n, 1.5 * r))], r); return;
    }
    if (g.scene === 'geararm') {
      const t = uN === undefined ? 0 : g.span[1] * uN, th = 0.5 * g.al * t * t + 20 * D2R, R = g.R, r = g.r, h = r * 0.35, big = g.ring ? R + r : R - r;
      if (g.ring) for (let i = 0; i < 36; i++) { const a0 = (i / 36) * TAU, a1 = ((i + 1) / 36) * TAU, rr = big * 1.05; slab(v, [rr * Math.cos(a0), rr * Math.sin(a0)], [rr * Math.cos(a1), rr * Math.sin(a1)], big * 0.1, -h, h, '#c3cbd3'); }
      else if (big > 0) disk(v, [0, 0], big, -h, h, '#c3cbd3', 0);
      const ends = g.n === 2 ? [rot([R, 0], th), rot([-R, 0], th)] : [rot([R, 0], th)];
      ends.forEach((E) => disk(v, E, r, -h, h, '#d5dbe1', -(g.ring ? 1 : -1) * g.ratio * th));
      slab(v, g.n === 2 ? ends[1] : [0, 0], ends[0], r * 0.3, h, 2 * h, '#aab7c4');
      const ex = (g.ring ? big * 1.15 : R + r) * 1.05; v.setBounds([-ex, -ex, -h], [ex, ex, 2 * h]); return;
    }
    if (g.scene === 'twobar') {
      const th = uN === undefined ? g.th2 : g.th1 + (g.th2 - g.th1) * ease(uN), p = g.at(th) || g.at(g.th2), L = g.L1 + g.L2, w = 0.04 * L;
      v.box(-0.2 * L, -0.03 * L, -0.2 * L, 1.1 * L, 0, 0.2 * L, '#d5dbe1', 1, K.edge);
      slab(v, [0, 0], p.B, w, -w, 0, '#aab7c4'); slab(v, p.B, p.C, w, 0, w, '#c3cbd3');
      bounds(v, [[-0.2 * L, 0], [1.1 * L, g.L1]], 0.2 * L); return;
    }
    if (g.task === 'strike') {
      const d = g.d; slab(v, [0, 0], [0, -d], 0.05 * d, -0.03 * d, 0.03 * d, '#aab7c4'); disk(v, [0, -d], 0.07 * d, -0.06 * d, 0.06 * d, '#c3cbd3', 0);
      if (g.mb > 0) v.box(0.07 * d, -1.18 * d, -0.12 * d, 0.33 * d, -0.96 * d, 0.12 * d, K.body, 1, K.edge);
      bounds(v, [[-0.5 * d, 0.1 * d], [0.8 * d, -1.25 * d]], 0.3 * d); return;
    }
    if (g.task === 'tip') { const S = Math.max(g.b, g.h); v.box(-g.b, 0, -0.3 * S, 0, g.h, 0.3 * S, K.body, 1, K.edge); v.box(0.02 * S, 0, -0.3 * S, 0.09 * S, 0.07 * S, 0.3 * S, K.ink, 1, K.edge); DYUI.floor3(v, -1.5 * S, 1 * S, 0, 0.5 * S); bounds(v, [[-1.5 * S, 0], [S, 1.2 * S]], 0.5 * S); return; }
    const S = g.disk ? 2 * g.r : g.l, G = mul(g.rho, -1);
    if (g.disk) disk(v, G, g.r, -0.25 * g.r, 0.25 * g.r, '#c3cbd3', 0); else slab(v, [0, 0], add(G, mul(g.rho, -1)), 0.06 * g.l, -0.03 * g.l, 0.03 * g.l, '#aab7c4');
    DYUI.floor3(v, -S, S, 0, 0.5 * S); bounds(v, [[-S, 0], [S, 1.2 * S]], 0.5 * S);
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const presets = (P0) => [
    { name: 'Test: Problem 17–110, wheels C (60 kg, k = 0.4 m) and D (40 kg, k = 0.35 m) joined by a link on a 30° slope (α = 6.21 rad/s², link force 6.21 N)', units: 'SI', state: P0({ scene: 'linked', xl1m: 60, xl1k: 0.4, xl2m: 40, xl2k: 0.35, xlr: 0.5, xlh: 0.9, xlphi: 30, xlmus: 0 }),
      expect: [{ k: 'Angular acceleration α', v: 6.209 }, { k: 'Force in the link T (+ tension)', v: 6.209 }] },
    { name: 'Test: Problem 18–33, 3-kg bar with two 2-kg gears in a fixed ring gear, 10 N·m couple, from rest to 20 rad/s (0.891 rev)', units: 'SI', state: P0({ scene: 'geararm', xgring: 'ring', xgn: 2, xgbm: 3, xgR: 0.2, xggm: 2, xgr: 0.15, xgM: 10, xgtask: 'turns', xgw: 20 }),
      expect: [{ k: 'Turns of the arm θ', v: 0.8913 }] },
    { name: 'Test: Problem 18–46, two bars (m, L) released from rest at θ = 90°, ω when horizontal (ω = √(3g/L) = 5.42 rad/s for L = 1 m)', units: 'SI', state: P0({ scene: 'twobar', xbm1: 5, xbL1: 1, xbm2: 5, xbL2: 1, xbth1: 90, xbth2: 0, xbM: 0 }),
      expect: [{ k: 'Angular velocity of AB, ω_AB', v: Math.sqrt(3 * 9.81) }, { k: 'Angular velocity of BC, ω_BC', v: Math.sqrt(3 * 9.81) }] },
    { name: 'Test: Problem 19–49, hammer (I_A = 3.55 kg·m²) released at 90° strikes a 30-kg block, e = 0.6 (v_D = 1.54 m/s, ω = 0.934 rad/s)', units: 'SI', state: P0({ scene: 'eimpact', xetask: 'strike', xem: 16, xerG: 0.4375, xeIby: 'I', xeIO: 3.55, xeth0: 90, xed: 0.55, xemb: 30, xee: 0.6 }),
      expect: [{ k: 'Velocity of the block after, v_B', v: 1.539 }, { k: 'Angular velocity just after, ω₂', v: -0.9336 }] },
    { name: 'Test: Problem 19–41, 300-lb ram on 10-ft cables released at 30° above the horizontal strikes a fixed dummy, e = 0.4 (rebounds to 66.9° = 23.1° from the vertical)', units: 'US', state: P0({ scene: 'eimpact', xetask: 'strike', xem: 300, xerG: 10, xeIby: 'k', xekO: 10, xeth0: 60, xed: 10, xemb: 0, xee: 0.4 }),
      expect: [{ k: 'Swing after impact θ₃ (from the vertical)', v: 23.07 }] },
    { name: 'Test: Problem 19–45, 10-lb, 1 ft × 1 ft block hits a stop and tips over (v_min = 5.96 ft/s)', units: 'US', state: P0({ scene: 'eimpact', xetask: 'tip', xebm: 10, xebb: 1, xebh: 1, xebv: 0 }),
      expect: [{ k: 'Least speed to tip over, v_min', v: 5.964 }] },
    { name: 'Test: Problem 19–57, 2-kg disk (r = 100 mm) thrown down at 2 m/s, 30° from the vertical, with 5 rad/s backspin, e = 0.5 (ω = 5 rad/s cw, v_G = 1 m/s at 60°)', units: 'SI', state: P0({ scene: 'eimpact', xetask: 'land', xeshape: 'disk', xedm: 2, xedr: 0.1, xedv: 2, xedang: 60, xedw: 5, xede: 0.5 }),
      expect: [{ k: 'Angular velocity after, ω₂ (+ ccw)', v: -5 }, { k: 'Speed of G after, v_G', v: 1 }, { k: 'Direction of v_G from +x', v: 60 }] },
    { name: 'Test: Problem 19–53, 50-g pencil (120 mm) falls at 0.2 m/s onto a table at 60°, e = 0.8 (ω = 2.25 rad/s, v_G = 0.149 m/s at 38.4°)', units: 'SI', state: P0({ scene: 'eimpact', xetask: 'land', xeshape: 'rod', xedm: 0.05, xedl: 0.12, xedb: 60, xedv: 0.2, xedang: 90, xedw: 0, xede: 0.8 }),
      expect: [{ k: 'Angular velocity after, ω₂ (+ ccw)', v: -2.25 }, { k: 'Speed of G after, v_G', v: 0.1491 }, { k: 'Direction of v_G from +x', v: 38.35 }] },
    { name: 'Block sliding at 8 ft/s onto a stop (it tips over)', units: 'US', state: P0({ scene: 'eimpact', xetask: 'tip', xebm: 10, xebb: 1, xebh: 1.5, xebv: 8 }) },
    { name: 'Edge: bar BC shorter than AB (fails on purpose)', units: 'SI', fails: true, state: P0({ scene: 'twobar', xbL1: 1, xbL2: 0.6 }) },
  ];

  root.DRbSysUI = { SCENES, controls, diagram, cap2D, plotCaption, hint, legend, draw2D, plot, draw3D, presets };
})(window);
