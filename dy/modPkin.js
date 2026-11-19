/* =====================================================================
 * DYNAMICS · D3 Particle Kinetics (inputs, diagrams, presets). Physics: dy/pkin.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Pkin, DY, DYUI, Stack } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', SPR = '#2c3e50', D2R = Math.PI / 180;

  const M = { id: 'pkin', title: 'Particle Kinetics', defaults: Pkin.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, k, label, unit, o) => C.num(sec, Object.assign({ label, get: () => st[k], set: (v) => (st[k] = v), unit }, o || {}));
    const ml = u.us ? 'Weight W' : 'Mass m';
    let sec = C.section(c, 'Scene');
    C.select(sec, { label: 'Scene', get: () => st.scene, set: (v) => (st.scene = v), options: [
      ['block', 'Block on a floor or incline'], ['pulley', 'Two blocks joined by a cord'], ['spring', 'Block and spring'], ['curve', 'Car on a flat or banked curve'], ['circle', 'Particle on a vertical circle'], ['stack', 'Stacked blocks and plates']] });
    if (st.scene === 'block') {
      C.seg(sec, { label: 'Method', get: () => st.method, set: (v) => (st.method = v), options: [['force', 'ΣF = ma'], ['impulse', 'Impulse'], ['work', 'Work and energy'], ['stop', 'Stopping distance']] });
      sec = C.section(c, 'Block and surface');
      num(sec, 'm', ml, u.M); num(sec, 'th', 'Incline angle θ (0 for a floor)', '°'); num(sec, 'mus', 'Static friction μ_s', ''); num(sec, 'muk', 'Kinetic friction μ_k', '');
      num(sec, 'v0', st.th > 0 ? 'Starting velocity v₁ (+ up the slope)' : 'Starting velocity v₁ (+ to the right)', u.V);
      sec = C.section(c, 'Applied force');
      num(sec, 'P', 'Force P (0 for none)', u.F); num(sec, 'al', 'Angle of P from the surface α (+ away from it)', '°');
      if (+st.P > 0) num(sec, 'eff', 'Efficiency of what supplies P, ε', '');
      if (st.method === 'work') {
        C.toggle(sec, { label: 'A spring behind the block', get: () => st.spring, set: (v) => (st.spring = v) });
        if (st.spring) { num(sec, 'k', 'Spring stiffness k', u.K); num(sec, 's1', 'Stretch at the start s₁ (− if compressed)', u.L); }
      }
      sec = C.section(c, 'Find');
      if (st.method === 'work') num(sec, 'd', 'Distance travelled d', u.L);
      else if (st.method !== 'stop') num(sec, 't', 'Time t', 's');
      else C.note(sec, 'Where and when the block stops, from its starting velocity.');
    } else if (st.scene === 'pulley') {
      C.select(sec, { label: 'Block A is', get: () => st.onA, set: (v) => (st.onA = v), options: [['hang', 'Hanging'], ['table', 'On a level table'], ['incline', 'On an incline']] });
      sec = C.section(c, 'Blocks and cord');
      num(sec, 'mA', `A: ${ml.toLowerCase()}`, u.M); num(sec, 'mB', `B (hanging): ${ml.toLowerCase()}`, u.M);
      C.num(sec, { label: 'Cord segments holding A, n_A', get: () => st.nA, set: (v) => (st.nA = v), step: 1 });
      C.num(sec, { label: 'Cord segments holding B, n_B', get: () => st.nB, set: (v) => (st.nB = v), step: 1 });
      if (st.onA === 'incline') num(sec, 'thA', 'Incline angle θ', '°');
      if (st.onA !== 'hang') { num(sec, 'mus', 'Static friction under A, μ_s', ''); num(sec, 'muk', 'Kinetic friction under A, μ_k', ''); }
      sec = C.section(c, 'Released from rest. Find');
      C.seg(sec, { get: () => st.find, set: (v) => (st.find = v), options: [['time', 'After a time'], ['distB', 'When B has moved'], ['speedB', 'When B reaches a speed']] });
      if (st.find === 'time') num(sec, 't', 'Time t', 's'); else if (st.find === 'distB') num(sec, 'dB', 'Distance B moves', u.L); else num(sec, 'vB', 'Speed of B', u.V);
    } else if (st.scene === 'spring') {
      C.seg(sec, { label: 'Situation', get: () => st.smode, set: (v) => (st.smode = v), options: [['launch', 'Spring launches the block'], ['hit', 'Block lands on the spring']] });
      sec = C.section(c, 'Block and spring');
      num(sec, 'sm', ml, u.M); num(sec, 'sk', 'Spring stiffness k', u.K); num(sec, 'sth', 'Angle of the spring axis θ (0 level, 90 vertical)', '°');
      if (Math.abs(+st.sth - 90) > 1e-9) { if (st.smode === 'launch') num(sec, 'mus', 'Static friction μ_s', ''); num(sec, 'muk', 'Kinetic friction μ_k', ''); }
      if (st.smode === 'launch') {
        num(sec, 'd1', 'Compression at release s₁', u.L); num(sec, 'd2', 'Compression when the block leaves s₂ (0 = free length)', u.L);
        num(sec, 'y0', 'Height of the block at release (for the highest point)', u.L);
      } else if (Math.abs(+st.sth - 90) < 1e-9) num(sec, 'hdrop', 'Falls from rest a height h onto the spring', u.L);
      else num(sec, 'sv0', 'Speed when it reaches the spring', u.V);
    } else if (st.scene === 'curve') {
      sec = C.section(c, 'Car and road');
      num(sec, 'm', ml, u.M); num(sec, 'r', 'Radius of the curve r', u.L); num(sec, 'bank', 'Banking angle θ (0 for flat)', '°'); num(sec, 'cmus', 'Static friction μ_s', ''); num(sec, 'cv', 'Speed to check v', u.V);
    } else if (st.scene === 'stack') {
      C.seg(sec, { label: 'Find', get: () => st.ktask, set: (v) => (st.ktask = v), options: [['motion', 'Motion for a given P'], ['Pmax', 'P at which the blocks slip on each other']] });
      sec = C.section(c, 'Blocks, from the bottom up');
      C.note(sec, 'Each block lists the friction of the contact under it (with the floor or incline for the bottom block).');
      const NM = Stack.NAMES, bn = (it, i) => String((it && it.name) || '').trim() || NM[i];
      C.list(sec, { items: st.blocks, max: 5, min: 1, color: (it, i) => (i % 2 ? '#f6d5c4' : '#cfe0f0'), title: (it, i) => `Block ${bn(it, i)}${i ? ` on ${bn(st.blocks[i - 1], i - 1)}` : ' on the surface'}`,
        fields: () => [{ key: 'name', label: 'Name', text: true }, { key: 'm', label: ml, unit: u.M }, { key: 'mus', label: 'μ_s under it' }, { key: 'muk', label: 'μ_k under it' }],
        add: [['Block', () => ({ name: '', m: 10, mus: 0.3, muk: 0.25 })]] });
      sec = C.section(c, 'Surface and force');
      num(sec, 'kth', 'Incline angle θ (0 for a floor)', '°');
      if (st.ktask === 'motion') num(sec, 'kP', 'Force P (0 for none)', u.F);
      num(sec, 'kal', 'Angle of P from the surface α (+ away from it)', '°');
      C.select(sec, { label: 'P acts on', get: () => String(Math.min(+st.kon, st.blocks.length - 1)), set: (v) => (st.kon = +v), options: st.blocks.map((b, i) => [String(i), `Block ${bn(b, i)}`]) });
      if (st.blocks.length >= 2) C.toggle(sec, { label: `A cord over a pulley at the ${+st.kth > 0 ? 'top' : 'right end'} ties the top block to the bottom one`, get: () => !!st.ktie, set: (v) => (st.ktie = v) });
      if (st.ktask === 'motion') { sec = C.section(c, 'Also find'); num(sec, 'kd', 'Time for the top block to slide this far on the one below (0 to skip)', u.L); }
    } else {
      C.seg(sec, { label: 'Moving', get: () => st.kind, set: (v) => (st.kind = v), options: [['inside', 'Inside a track'], ['cord', 'On a cord'], ['outside', 'Over a dome']] });
      sec = C.section(c, 'Particle and circle');
      num(sec, 'cm', ml, u.M); num(sec, 'R', st.kind === 'cord' ? 'Cord length r' : 'Radius r', u.L);
      const nm = st.kind === 'outside' ? 'ψ (from the top)' : 'φ (from the bottom)';
      num(sec, 'phi0', `Starting angle ${nm}`, '°'); num(sec, 'cv0', 'Speed there', u.V); num(sec, 'phi', `Angle to find ${nm}`, '°');
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: st.scene === 'pulley' ? 'Free-body diagrams of A and B' : st.scene === 'stack' ? 'Free-body diagrams of the blocks' : 'Free-body and kinetic diagrams', get: () => dopt('fbd', true), set: (v) => (st.fbd = v), rebuild: false });
    if (st.scene !== 'curve') C.toggle(c, { label: 'Velocity and acceleration arrows', get: () => dopt('showV', true), set: (v) => (st.showV = v), rebuild: false });
    if (st.scene === 'stack' && st.blocks.length > 3) C.select(c, { label: 'Free-body diagrams of', get: () => dopt('fbdOf', 'ends'), set: (v) => (st.fbdOf = v), rebuild: false, options: [['ends', 'The bottom and top blocks']].concat(st.blocks.map((b, i) => [String(i), `Block ${String(b.name || '').trim() || Stack.NAMES[i]}`])) });
    if (st.scene === 'curve') C.toggle(c, { label: 'Top view of the curve', get: () => dopt('top', true), set: (v) => (st.top = v), rebuild: false });
  };

  M.compute = (U) => Pkin.solve(S(), U);
  M.onUnits = (from, to) => Pkin.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ block: 'Block, free-body and kinetic diagrams', pulley: 'Blocks, cord and pulleys', spring: 'Block and spring', curve: 'Section through the road', circle: 'Particle on a vertical circle', stack: 'Stacked blocks and their free-body diagrams' }[S().scene]);
  M.cap3D = () => '3D view';
  M.plotCaption = () => ({ curve: 'Friction needed against speed', circle: 'Speed and normal force around the circle', stack: 'Velocity of each block against time' }[S().scene] || 'Work and kinetic energy');
  M.hint = () => 'Press Play to watch the motion. Forces are in red on the free-body diagram; the kinetic diagram shows ma.';
  M.legend = () => [[K.force, 'Force'], [K.vel, 'Velocity'], [K.acc, 'Acceleration or ma'], [K.ink, 'Cord, track or support', 'ln']];
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]), { idle: 'starting position' });
  M.anim = () => motion;
  const uNow = () => S()._u;
  const lbl = (opt, a, b) => (opt.showP ? a : b);

  /* ------------------------------------------------------------------ */
  /* Free-body / kinetic diagram boxes (in screen pixels)                */
  /* ------------------------------------------------------------------ */
  /** A boxed diagram: block of side 34 px turned by th (rad) at the centre, with arrows {d: [dx, dy] (y up), L px, color, label}. */
  function panel(D, x0, y0, w, h, title, th, arrows, o) {
    o = o || {};
    D.el('rect', { x: x0, y: y0, width: w, height: h, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
    D.text([x0 + 8, y0 + 16], title, { px: true, color: K.ink, size: 11.5, weight: 700 });
    const cx = x0 + w / 2, cy = y0 + h / 2 + 8, s = o.dot ? 0 : 17;
    const P = (x, y) => D.inv(x, y);
    if (o.dot) D.circle(P(cx, cy), 6 / D.sc, { fill: CA, stroke: '#fff', sw: 1.5 });
    else { const cr = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => [cx + a * Math.cos(th) - b * Math.sin(th), cy - (a * Math.sin(th) + b * Math.cos(th))]); D.poly(cr.map((q) => P(q[0], q[1])), { fill: K.body, stroke: K.edge, sw: 1.4 }); if (o.name) D.text(P(cx, cy), o.name, { anchor: 'middle', base: 'middle', color: K.ink, size: 11.5, weight: 700 }); }
    arrows.forEach((a) => {
      const l = Math.hypot(a.d[0], a.d[1]); if (!(l > 1e-12)) return;
      const ux = a.d[0] / l, uy = -a.d[1] / l, r0 = (o.dot ? 8 : s * 1.15);
      const lim = Math.min(Math.abs(ux) > 1e-3 ? (w / 2 - r0 - 78) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? (h / 2 - r0 - 30) / Math.abs(uy) : 1e9);
      const L = Math.max(12, Math.min(lim, a.L || lim));
      const t = [cx + ux * r0, cy + uy * r0], hd = [t[0] + ux * L, t[1] + uy * L];
      D.arrow(P(t[0], t[1]), P(hd[0], hd[1]), { color: a.color, w: 2.2, head: 9 });
      D.text(P(hd[0], hd[1]), a.label, { px: false, color: a.color, size: 11, weight: 700, anchor: ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle', dx: ux > 0.3 ? 4 : ux < -0.3 ? -4 : 0, dy: uy > 0.3 ? 13 : uy < -0.3 ? -5 : 4 });
    });
  }
  /** Two boxes stacked on the right: [title, th, arrows, o] each; returns the width they take. */
  const PW = (svg) => Math.min(230, (svg.clientWidth || 800) * 0.34);
  const opts2 = (svg, fb) => ({ pad: 22, padR: fb ? PW(svg) + 26 : 0, padRmax: 0.42 });
  function panels(D, list) {
    const bw = Math.min(230, D.W * 0.34), n = list.length, gap = 26, bh = Math.min(210, (D.H - 30 - gap * (n - 1)) / n), x0 = D.W - bw - 10;
    list.forEach((p, i) => {
      const y0 = 26 + i * (bh + gap);
      panel(D, x0, y0, bw, bh, p[0], p[1], p[2], p[3]);
      if (i < n - 1 && p[3] && p[3].eq) D.text(D.inv(x0 + bw / 2, y0 + bh + gap * 0.72), '=', { anchor: 'middle', color: K.ink, size: 18, weight: 700 });
    });
    return bw + 20;
  }
  const fArrow = (d, mag, maxF, color, label) => ({ d, L: 22 + 56 * Math.abs(mag) / (maxF || 1), color, label });

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    return ({ block: block2D, pulley: pulley2D, spring: spring2D, curve: curve2D, circle: circle2D, stack: stack2D })[g.scene](svg, g, opt);
  };
  const tNow = (g) => (uNow() === undefined ? (g.scene === 'block' || g.scene === 'pulley' || g.scene === 'stack' ? g.span[1] : 0) : g.span[0] + (g.span[1] - g.span[0]) * uNow());

  function block2D(svg, g, opt) {
    const u = g.u, th = g.th * D2R, e = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)], Ls = 10, wB = 1.6, hB = 1.1;
    const fb = dopt('fbd', true);
    const D = UI.Draw2D(svg, { xmin: -1.2, xmax: Ls * Math.cos(th) + 2.4, ymin: -1.2, ymax: Math.max(Ls * Math.sin(th), 3) + 2.4 }, opts2(svg, fb));
    if (th > 0) { D.poly([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 }); DYUI.ground(D, [-0.8, 0], [Ls * e[0] + 0.8, 0]); }
    else DYUI.ground(D, [-0.8, 0], [Ls + 0.8, 0]);
    // scale the motion into the drawing
    const T = g.span[1], xs = []; for (let i = 0; i <= 60; i++) xs.push(g.x((T * i) / 60));
    const xr = Math.max(1e-9, ...xs.map(Math.abs)), Kx = g.rest ? 0 : 5.5 / xr, s0 = g.dir < 0 || (xs[60] < 0) ? 7.8 : 2.2;
    const t = tNow(g), sNow = Math.max(wB / 2, Math.min(Ls - wB / 2, s0 + g.x(t) * Kx));
    const at = (s, hgt) => [s * e[0] + hgt * n[0], s * e[1] + hgt * n[1]];
    if (uNow() !== undefined || g.rest) { /* ghost of the start */ } else DYUI.block(D, at(s0, 0), wB, hB, th, { fill: 'none', stroke: K.ghost, dash: '5 4' });
    if (g.spr) {
      const wall = [at(0.15, 0), at(0.15, 1.6)]; D.line(wall[0], wall[1], { stroke: K.ink, sw: 3 });
      DYUI.spring(D, at(0.15, hB / 2), at(sNow - wB / 2, hB / 2), { n: 10, w: 0.18 });
    }
    DYUI.block(D, at(sNow, 0), wB, hB, th, { label: 'm' });
    const cen = at(sNow, hB / 2);
    if (g.P > 0) {
      const dp = [Math.cos(th + g.al * D2R), Math.sin(th + g.al * D2R)];
      if (g.al < 0) DYUI.vec(D, at(sNow - wB / 2 * 0.2, hB * 0.75), dp, 80, { color: K.force, head: true, label: lbl(opt, `P = ${fmt(g.P)} ${u.F}`, 'P'), size: 11.5, anchor: 'end', ldx: -4, ldy: -4 });
      else DYUI.vec(D, cen, dp, 80, { color: K.force, label: lbl(opt, `P = ${fmt(g.P)} ${u.F}`, 'P'), size: 11.5 });
    }
    const v = g.v(t);
    if (dopt('showV', true) && !g.rest) {
      if (Math.abs(v) > 1e-9) DYUI.vec(D, at(sNow - wB / 2, hB + 1.5), [e[0] * Math.sign(v), e[1] * Math.sign(v)], 70, { color: K.vel, label: lbl(opt, `v = ${fmt(Math.abs(v))} ${u.V}`, 'v'), size: 11.5, anchor: e[0] * v < 0 ? 'end' : 'start', ldx: e[0] * v < 0 ? -6 : 6 });
      if (g.a !== undefined && Math.abs(g.a) > 1e-9) DYUI.vec(D, at(sNow - wB / 2, hB + 2.1), [e[0] * Math.sign(g.a), e[1] * Math.sign(g.a)], 55, { color: K.acc, label: lbl(opt, `a = ${fmt(Math.abs(g.a))} ${u.A}`, 'a'), size: 11.5, anchor: e[0] * g.a < 0 ? 'end' : 'start', ldx: e[0] * g.a < 0 ? -6 : 6 });
    }
    if (th > 0) D.arc([Ls * e[0], 0], 40, 180, 180 - g.th, `θ = ${fmt(g.th)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, g.rest ? 'Static friction holds: at rest' : uNow() === undefined ? `At t = ${fmt(T)} s` : `t = ${fmt(t)} s`);
    if (fb) {
      const W = g.W, N = g.N, maxF = Math.max(W, N, g.P, 1e-9), arr = [fArrow([0, -1], W, maxF, K.force, lbl(opt, `W = ${fmt(W)}`, 'W')), fArrow(n, N, maxF, K.force, lbl(opt, `N = ${fmt(N)}`, 'N'))];
      if (g.P > 0) arr.push(fArrow([Math.cos(th + g.al * D2R), Math.sin(th + g.al * D2R)], g.P, maxF, K.force, lbl(opt, `P = ${fmt(g.P)}`, 'P')));
      const moving = Math.abs(v) > 1e-9 ? Math.sign(v) : g.dir;
      if (g.rest && Math.abs(g.F) > 1e-9) arr.push(fArrow([e[0] * Math.sign(g.F), e[1] * Math.sign(g.F)], g.F, maxF, K.force, lbl(opt, `F = ${fmt(Math.abs(g.F))}`, 'F')));
      else if (moving && g.muk > 0) arr.push(fArrow([-e[0] * moving, -e[1] * moving], g.muk * N, maxF, K.force, lbl(opt, `F = ${fmt(g.muk * N)}`, 'F')));
      if (g.spr) { const fs = g.k * (g.s1 + g.x(t)); if (Math.abs(fs) > 1e-9) arr.push(fArrow([-e[0] * Math.sign(fs), -e[1] * Math.sign(fs)], fs, maxF, K.force, lbl(opt, `F_s = ${fmt(Math.abs(fs))}`, 'F_s'))); }
      const ma = g.a !== undefined ? g.m * g.a : 0;
      if (g.a === undefined) panels(D, [['Free-body diagram (at the end)', th, arr, {}]]);
      else panels(D, [['Free-body diagram', th, arr, { eq: true }], ['Kinetic diagram', th, Math.abs(ma) > 1e-9 ? [{ d: [e[0] * Math.sign(ma), e[1] * Math.sign(ma)], L: 60, color: K.acc, label: lbl(opt, `ma = ${fmt(Math.abs(ma))}`, 'ma') }] : [], {}]]);
    }
    return true;
  }

  function pulley2D(svg, g, opt) {
    const u = g.u, fb = dopt('fbd', true), T = g.span[1], t = tNow(g);
    const sMax = Math.max(Math.abs(g.sA(T)), Math.abs(g.sB(T)), 1e-9), Ks = g.rest ? 0 : 2.2 / sMax, dA = g.sA(t) * Ks, dB = g.sB(t) * Ks;
    const D = UI.Draw2D(svg, { xmin: -6.4, xmax: 4.6, ymin: -6, ymax: 3.6 }, opts2(svg, fb));
    const cord = (a, b) => D.line(a, b, { stroke: K.ink, sw: 1.6 }), wA = 1.3, hA = 0.95, wB = 1.1, hB = 1.0;
    const strands = (x, yTop, yBot, nn) => { for (let i = 0; i < nn; i++) { const xx = x + (i - (nn - 1) / 2) * 0.22; cord([xx, yTop], [xx, yBot]); } if (nn > 1) DYUI.wheel(D, [x, yBot + 0.14], 0.14 + 0.11 * (nn - 1), 0, { spokes: 0 }); };
    // B always hangs on the right
    const yBtop = -2.2 - dB;
    let posA;
    if (g.onA === 'hang') {
      D.poly([[-4.4, 3], [3.2, 3], [3.2, 3.35], [-4.4, 3.35]], { fill: 'url(#hatch)', stroke: K.ink, sw: 1.2 });
      const Rp = 1, yP = 1.9, gap = 0.22, xA = -Rp - (g.nA - 1) * gap / 2, xBh = Rp + (g.nB - 1) * gap / 2, yAtop = -2.2 - dA;
      DYUI.wheel(D, [0, yP], Rp, 0, { spokes: 0 }); cord([0, 3], [0, yP]);
      const group = (x, yBot, nn, inner) => { for (let i = 0; i < nn; i++) { const xx = x + (i - (nn - 1) / 2) * gap, isIn = Math.abs(xx - inner) < 1e-6; cord([xx, isIn ? yP : 3], [xx, yBot]); } if (nn > 1) DYUI.wheel(D, [x, yBot + 0.12], (nn - 1) * gap / 2 + 0.06, 0, { spokes: 0 }); };
      group(xA, yAtop, g.nA, -Rp); group(xBh, yBtop, g.nB, Rp);
      DYUI.block(D, [xA, yAtop - hA], wA, hA, 0, { label: 'A' }); posA = [xA, yAtop - hA / 2];
      DYUI.block(D, [xBh, yBtop - hB], wB, hB, 0, { label: 'B' });
      if (dopt('showV', true) && Math.abs(g.aA) > 1e-9) DYUI.vec(D, [xA - wA / 2 - 0.3, posA[1]], [0, -Math.sign(g.aA)], 50, { color: K.acc, label: lbl(opt, `a_A = ${fmt(Math.abs(g.aA))} ${u.A}`, 'a_A'), size: 11.5, anchor: 'end', ldx: -4 });
      if (dopt('showV', true) && Math.abs(g.aB) > 1e-9) DYUI.vec(D, [xBh + wB / 2 + 0.3, yBtop - hB / 2], [0, -Math.sign(g.aB)], 50, { color: K.acc, label: lbl(opt, `a_B = ${fmt(Math.abs(g.aB))} ${u.A}`, 'a_B'), size: 11.5 });
      fbdPulley(D, g, opt, 0);
      DYUI.title(D, 12, 20, g.rest ? 'Static friction holds: at rest' : uNow() === undefined ? `At t = ${fmt(T)} s` : `t = ${fmt(t)} s`);
      return true;
    } else {
      const th = g.onA === 'incline' ? g.th * D2R : 0, e = [Math.cos(th), Math.sin(th)], nrm = [-Math.sin(th), Math.cos(th)], top = [0.2, 0.2];
      const Ls = 6.2, start = [top[0] - Ls * e[0], top[1] - Ls * e[1]];
      if (th > 0) { D.poly([start, top, [top[0], start[1]]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 }); D.poly([[top[0], start[1]], top, [top[0] + 0.5, top[1]], [top[0] + 0.5, start[1]]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.2 }); }
      else D.poly([[start[0], top[1] - 0.5], [top[0] + 0.5, top[1] - 0.5], [top[0] + 0.5, top[1]], [start[0], top[1]]], { fill: 'url(#hatch)', stroke: K.ink, sw: 1.2 });
      const pc = [top[0] + 0.45, top[1] + 0.45]; DYUI.wheel(D, pc, 0.42, 0, { spokes: 0 });
      const sA = 3.2 + dA, base = [top[0] - sA * e[0], top[1] - sA * e[1]];
      DYUI.block(D, base, wA, hA, th, { label: 'A' }); posA = [base[0] + nrm[0] * hA / 2, base[1] + nrm[1] * hA / 2];
      const att = [base[0] + e[0] * wA / 2 + nrm[0] * hA / 2, base[1] + e[1] * wA / 2 + nrm[1] * hA / 2];
      for (let i = 0; i < g.nA; i++) { const off = (i - (g.nA - 1) / 2) * 0.16; cord([att[0] + nrm[0] * off, att[1] + nrm[1] * off], [pc[0] - 0.42 * Math.sin(th) + nrm[0] * off * 0, pc[1] + 0.42 * Math.cos(th) * 0 + nrm[1] * off]); }
      const xBb = pc[0] + 0.42; strands(xBb, pc[1], yBtop, g.nB);
      DYUI.block(D, [xBb, yBtop - hB], wB, hB, 0, { label: 'B' });
      if (dopt('showV', true) && Math.abs(g.aA) > 1e-9) DYUI.vec(D, [posA[0] + nrm[0] * 1.0, posA[1] + nrm[1] * 1.0], [-e[0] * Math.sign(g.aA), -e[1] * Math.sign(g.aA)], 50, { color: K.acc, label: lbl(opt, `a_A = ${fmt(Math.abs(g.aA))}`, 'a_A'), size: 11.5 });
      if (dopt('showV', true) && Math.abs(g.aB) > 1e-9) DYUI.vec(D, [xBb + wB / 2 + 0.25, yBtop - hB / 2], [0, -Math.sign(g.aB)], 50, { color: K.acc, label: lbl(opt, `a_B = ${fmt(Math.abs(g.aB))}`, 'a_B'), size: 11.5 });
      if (th > 0) D.arc(start, 40, 0, g.th, `θ = ${fmt(g.th)}°`, { color: K.ink });
      fbdPulley(D, g, opt, th);
      DYUI.title(D, 12, 20, g.rest ? 'Static friction holds: at rest' : uNow() === undefined ? `At t = ${fmt(T)} s` : `t = ${fmt(t)} s`);
      return true;
    }
  }
  function fbdPulley(D, g, opt, th) {
    if (!dopt('fbd', true)) return;
    const gg = g.u.g, WA = g.mA * gg, WB = g.mB * gg, T = g.T, maxF = Math.max(WA, WB, g.nA * T, g.nB * T, 1e-9);
    const e = [Math.cos(th), Math.sin(th)], up = g.onA === 'hang' ? [0, 1] : e;
    const a = [fArrow([0, -1], WA, maxF, K.force, lbl(opt, `W_A = ${fmt(WA)}`, 'W_A')), fArrow(up, g.nA * T, maxF, K.force, lbl(opt, `${g.nA > 1 ? g.nA : ''}T = ${fmt(g.nA * T)}`, `${g.nA > 1 ? g.nA : ''}T`))];
    if (g.onA !== 'hang') { a.push(fArrow([-Math.sin(th), Math.cos(th)], g.NA, maxF, K.force, lbl(opt, `N_A = ${fmt(g.NA)}`, 'N_A'))); if (!g.rest && g.muk > 0 && Math.abs(g.aA) > 1e-12) { const mv = Math.sign(g.aA); a.push(fArrow([e[0] * mv, e[1] * mv], g.muk * g.NA, maxF, K.force, lbl(opt, `F = ${fmt(g.muk * g.NA)}`, 'F'))); } }
    const b = [fArrow([0, -1], WB, maxF, K.force, lbl(opt, `W_B = ${fmt(WB)}`, 'W_B')), fArrow([0, 1], g.nB * T, maxF, K.force, lbl(opt, `${g.nB > 1 ? g.nB : ''}T = ${fmt(g.nB * T)}`, `${g.nB > 1 ? g.nB : ''}T`))];
    panels(D, [['Free-body diagram of A', th, a, { name: 'A' }], ['Free-body diagram of B', 0, b, { name: 'B' }]]);
  }

  /* ---------------- Stacked blocks ---------------- */
  const SW = (j) => Math.max(1.3, 3.2 - 0.5 * j), SH = 0.62;
  /** Layout of the stack at time t: slope frame, each block's bottom-centre along the slope and its height above the surface. */
  function stackLayout(g, t) {
    const n = g.a.length, th = g.th * D2R, e = [Math.cos(th), Math.sin(th)], nr = [-Math.sin(th), Math.cos(th)], Ls = 10;
    const T = g.span[1], xs = g.a.map((a) => 0.5 * a * T * T), xr = Math.max(1e-9, ...xs.map(Math.abs)), Ks = xr > 1e-9 ? Math.min(2 / xr, 1e6) : 0;
    const s0 = g.tie ? 6 : 3.6;
    let hs = 0;
    const blocks = g.a.map((a, j) => {
      const w = SW(j), s = Math.max(w / 2, Math.min(Ls - w / 2 - (g.tie ? 0.9 : 0), s0 + 0.5 * a * t * t * Ks)), b = { s, h: hs, w };
      hs += SH; return b;
    });
    const P = (s, h) => [s * e[0] + h * nr[0], s * e[1] + h * nr[1]];
    return { n, th, e, nr, Ls, blocks, P, H: hs };
  }
  function stack2D(svg, g, opt) {
    const u = g.u, fb = dopt('fbd', true), t = tNow(g), L = stackLayout(g, t), { th, e, Ls, P } = L, NM = g.names;
    const D = UI.Draw2D(svg, { xmin: -1.6, xmax: Ls * e[0] + 1.4, ymin: -1.4, ymax: Ls * e[1] + L.H + 2.6 }, opts2(svg, fb));
    if (th > 0) D.poly([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 });
    else DYUI.ground(D, [-0.4, 0], [Ls, 0]);
    if (th > 0) D.arc([0.9, 0], 36, 0, g.th, `θ = ${fmt(g.th)}°`, { color: K.ink });
    L.blocks.forEach((b, j) => DYUI.block(D, P(b.s, b.h), b.w, SH, th, { label: NM[j], fill: j % 2 ? '#f6d5c4' : '#cfe0f0', size: 12 }));
    const mid = (j, side) => { const b = L.blocks[j]; return P(b.s + side * b.w / 2, b.h + SH / 2); };
    if (g.tie) {
      const n = L.n, bt = L.blocks[n - 1], b0 = L.blocks[0], hTop = bt.h + SH / 2, hBot = SH / 2, r = (hTop - hBot) / 2, sp = Ls - 0.45;
      const c = P(sp, (hTop + hBot) / 2);
      D.line(P(sp, 0), c, { stroke: K.ink, sw: 2.4 });
      D.line(mid(n - 1, 1), P(sp, hTop), { stroke: K.ink, sw: 1.6 }); D.line(mid(0, 1), P(sp, hBot), { stroke: K.ink, sw: 1.6 });
      DYUI.wheel(D, c, r, 0, { spokes: 0 });
      D.text([c[0], c[1] + r], 'C', { dx: 6, dy: -4, color: K.ink, size: 11.5, weight: 700 });
      void b0;
    }
    if (g.P > 0) {
      const dir = [Math.cos(th + g.al * D2R), Math.sin(th + g.al * D2R)], side = dir[0] * e[0] + dir[1] * e[1] >= 0 ? 1 : -1;
      const p0 = mid(g.on, side);
      const q = side > 0 ? [p0[0] + dir[0] * 1.5, p0[1] + dir[1] * 1.5] : p0, p = side > 0 ? p0 : [p0[0] - dir[0] * 1.5, p0[1] - dir[1] * 1.5];
      if (side > 0) DYUI.vec(D, p, dir, 58, { color: K.force, label: lbl(opt, `P = ${fmt(g.P)} ${u.F}`, 'P'), size: 11.5 });
      else D.arrow(p, q, { color: K.force, w: 2.6, head: 11, label: lbl(opt, `P = ${fmt(g.P)} ${u.F}`, 'P'), lp: 'tail' });
    }
    if (dopt('showV', true)) L.blocks.forEach((b, j) => {
      const a = g.a[j]; if (Math.abs(a) < 1e-9) return;
      const p = P(b.s - b.w / 2 - 0.25, b.h + SH / 2), d = [Math.sign(a) * e[0], Math.sign(a) * e[1]];
      DYUI.vec(D, a > 0 ? [p[0] - e[0] * 1.2, p[1] - e[1] * 1.2] : p, d, 34, { color: K.acc, label: lbl(opt, `a_${NM[j]} = ${fmt(Math.abs(a))}`, `a_${NM[j]}`), size: 11, anchor: 'end', ldx: -4 });
    });
    if (fb) fbdStack(D, g, opt);
    const moving = g.a.some((a) => Math.abs(a) > 1e-9);
    DYUI.title(D, 12, 20, !moving ? 'Friction holds: at rest' : uNow() === undefined ? `At t = ${fmt(g.span[1])} s` : `t = ${fmt(t)} s`);
    return true;
  }
  /** Contact names: under A on the ground "A", between A and B "AB". */
  const cName = (g, i) => (i === 0 ? g.names[0] : g.names[i - 1] + g.names[i]);
  /** Free-body diagram of each block (or of the chosen ones), with every force drawn where it acts. */
  function fbdStack(D, g, opt) {
    const n = g.a.length, NM = g.names, gg = g.u.g, m = g.sys.m, th = g.th * D2R;
    const pick = dopt('fbdOf', 'ends');
    const list = n <= 3 ? [...Array(n).keys()].reverse() : pick === 'ends' ? [n - 1, 0] : [+pick];
    const maxF = Math.max(1e-9, ...m.map((x) => x * gg), ...g.N, ...g.F.map(Math.abs), g.P, g.T || 0);
    const bw = Math.min(230, D.W * 0.34), k = list.length, gap = 14, bh = Math.min(200, (D.H - 30 - gap * (k - 1)) / k), x0 = D.W - bw - 10;
    const ca = Math.cos(th), sa = Math.sin(th);
    list.forEach((j, idx) => {
      const y0 = 26 + idx * (bh + gap), cx = x0 + bw / 2, cy = y0 + bh / 2 + 4, w2 = 34, h2 = 14;
      D.el('rect', { x: x0, y: y0, width: bw, height: bh, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
      D.text([x0 + 8, y0 + 16], `Block ${NM[j]}`, { px: true, color: K.ink, size: 11.5, weight: 700 });
      // slope frame in screen pixels (y down)
      const S = (s, h) => D.inv(cx + s * ca - h * sa, cy - (s * sa + h * ca)), dir = (s, h) => [s * ca - h * sa, s * sa + h * ca];
      D.poly([S(-w2, -h2), S(w2, -h2), S(w2, h2), S(-w2, h2)], { fill: j % 2 ? '#f6d5c4' : '#cfe0f0', stroke: K.edge, sw: 1.4 });
      D.text(S(0, 0), NM[j], { anchor: 'middle', base: 'middle', color: K.ink, size: 11.5, weight: 700 });
      const len = (f) => 12 + 24 * Math.abs(f) / maxF;
      const arr = (a, b, label, o) => { D.arrow(a, b, { color: K.force, w: 2, head: 8 }); if (label) D.text(o && o.at === 'tail' ? a : b, label, Object.assign({ color: K.force, size: 10.5, weight: 700 }, o || {})); };
      const ann = (d) => { const a = Math.atan2(d[1], d[0]), c = Math.cos(a), s = Math.sin(a); return { anchor: c > 0.4 ? 'start' : c < -0.4 ? 'end' : 'middle', dx: c > 0.4 ? 3 : c < -0.4 ? -3 : 0, dy: s > 0.4 ? -4 : s < -0.4 ? 12 : 4 }; };
      // weight from the centre, straight down
      const W = m[j] * gg, lw = 26 + 14 * W / maxF;
      D.arrow(S(0, 0), D.inv(cx, cy + 6 + lw), { color: K.force, w: 2, head: 8 });
      D.text(D.inv(cx, cy + 6 + lw), lbl(opt, `W = ${fmt(W)}`, `W_${NM[j]}`), { color: K.force, size: 10.5, weight: 700, anchor: 'start', dx: 4, dy: 10 });
      // contact below: N up into the bottom face, friction along it
      const Nb = g.N[j], lN = len(Nb);
      arr(S(-w2 * 0.72, -h2 - lN), S(-w2 * 0.72, -h2), lbl(opt, `N_${cName(g, j)} = ${fmt(Nb)}`, `N_${cName(g, j)}`), Object.assign({ at: 'tail' }, ann(dir(-0.3, -1)), { anchor: 'end', dx: -2 }));
      const Fb = g.F[j];
      if (Math.abs(Fb) > 1e-9 * maxF) { const l = len(Fb), sg = Math.sign(Fb), s1 = w2 * 0.12, s2 = s1 + l; arr(S(sg > 0 ? s1 : s2, -h2 - 3), S(sg > 0 ? s2 : s1, -h2 - 3), lbl(opt, `F_${cName(g, j)} = ${fmt(Math.abs(Fb))}`, `F_${cName(g, j)}`), Object.assign(sg > 0 ? {} : { at: 'tail' }, { anchor: 'start', dx: 3, dy: 4 })); }
      // contact above: reactions of the block on top
      if (j + 1 < n) {
        const Na = g.N[j + 1], lA = len(Na);
        arr(S(w2 * 0.72, h2 + lA), S(w2 * 0.72, h2), lbl(opt, `N_${cName(g, j + 1)}`, `N_${cName(g, j + 1)}`), Object.assign({ at: 'tail' }, ann(dir(0.3, 1)), { anchor: 'start', dx: 2, dy: -3 }));
        const Fa = -g.F[j + 1];
        if (Math.abs(Fa) > 1e-9 * maxF) { const l = len(Fa), sg = Math.sign(Fa), s1 = -w2 * 0.12, s2 = s1 - l; arr(S(sg > 0 ? s2 : s1, h2 + 3), S(sg > 0 ? s1 : s2, h2 + 3), lbl(opt, `F_${cName(g, j + 1)}`, `F_${cName(g, j + 1)}`), Object.assign(sg > 0 ? { at: 'tail' } : {}, { anchor: 'end', dx: -3, dy: 4 })); }
      }
      // applied force and cord
      if (g.P > 0 && j === g.on) {
        const al = g.al * D2R, d = [Math.cos(al), Math.sin(al)], side = d[0] >= 0 ? 1 : -1, l = len(g.P), b = [side * w2, 0];
        const a1 = side > 0 ? b : [b[0] - d[0] * l, b[1] - d[1] * l], a2 = side > 0 ? [b[0] + d[0] * l, b[1] + d[1] * l] : b;
        arr(S(a1[0], a1[1] - (g.tie && (j === 0 || j === n - 1) ? 4 : 0)), S(a2[0], a2[1] - (g.tie && (j === 0 || j === n - 1) ? 4 : 0)), lbl(opt, `P = ${fmt(g.P)}`, 'P'), Object.assign(side < 0 ? { at: 'tail' } : {}, ann(dir(side * d[0], d[1]))));
      }
      if (g.tie && (j === 0 || j === n - 1) && g.T > 0) { const l = len(g.T); arr(S(w2, 5), S(w2 + l, 5), lbl(opt, `T = ${fmt(g.T)}`, 'T'), ann(dir(1, 0.5))); }
      // kinetic side: the result
      D.text([x0 + bw - 8, y0 + 16], `m a = ${fmt(m[j] * g.a[j])}`, { px: true, color: K.acc, size: 10.5, weight: 700, anchor: 'end' });
    });
  }

  function spring2D(svg, g, opt) {
    const u = g.u, th = g.th * D2R, e = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)], fb = dopt('fbd', true), wB = 1.2, hB = 0.9;
    const Ls = 10, L0 = 4;
    const D = UI.Draw2D(svg, { xmin: -2, xmax: Math.max(Ls * e[0], 2) + 1.6, ymin: -1, ymax: Math.max(Ls * e[1], 2.5) + 1.6 }, opts2(svg, fb));
    const at = (s, h) => [s * e[0] + h * n[0], s * e[1] + h * n[1]];
    if (th > 1e-9 && g.th < 89.999) { D.poly([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 }); DYUI.ground(D, [-0.6, 0], [Ls * e[0] + 0.6, 0]); }
    else if (g.th >= 89.999) DYUI.ground(D, [-1.2, 0], [1.2, 0]);
    else DYUI.ground(D, [-0.6, 0], [Ls + 0.6, 0]);
    D.line(at(0, 0), at(0, 1.6), { stroke: K.ink, sw: 3 });
    let sNow, title, vNow = 0;
    const u0 = uNow() === undefined ? 0 : uNow();
    if (g.hit) {
      const sC = L0, sMin = L0 - 2.4, sStart = Math.min(Ls - wB, L0 + 2.6);
      sNow = u0 < 0.5 ? sStart - (sStart - sC) * (u0 / 0.5) : sC - (sC - sMin) * Math.sin(((u0 - 0.5) / 0.5) * Math.PI / 2);
      if (uNow() === undefined) { DYUI.block(D, at(sMin + wB / 2, 0), wB, hB, th, { fill: 'none', stroke: K.ghost, dash: '5 4' }); sNow = sStart; }
      DYUI.spring(D, at(0, hB / 2), at(Math.min(L0, sNow), hB / 2), { n: 10, w: 0.2 });
      D.text(at(sMin + wB / 2, hB + 0.35), lbl(opt, `x = ${fmt(g.x)} ${u.L}`, 'x'), { anchor: 'middle', color: K.ink, size: 11.5, weight: 700 });
      title = uNow() === undefined ? 'Starts moving toward the spring' : u0 < 0.5 ? 'Moving toward the spring' : 'Compressing the spring';
    } else {
      const sR = L0 - 2.4, sL = L0 - (2.4 * g.d2) / g.d1, sT = isFinite(g.L2) ? Math.min(Ls - wB, sL + Math.max(1.2, 5.5 * Math.min(1, g.L2 / Math.max(g.L1 * 3, 1e-9)))) : Ls - wB;
      sNow = u0 < 0.3 ? sR + (sL - sR) * Math.sin((u0 / 0.3) * Math.PI / 2) : sL + (sT - sL) * Math.sin(((u0 - 0.3) / 0.7) * Math.PI / 2);
      if (uNow() === undefined) { sNow = sR; DYUI.block(D, at(sT + wB / 2, 0), wB, hB, th, { fill: 'none', stroke: K.ghost, dash: '5 4' }); D.text(at(sT + wB / 2, hB + 0.35), isFinite(g.L2) ? 'highest point' : 'keeps going', { anchor: 'middle', color: K.ghost, size: 11, weight: 700 }); }
      const springEnd = Math.min(sNow, sL);
      DYUI.spring(D, at(0, hB / 2), at(springEnd, hB / 2), { n: 10, w: 0.2 });
      if (g.d2 > 0) D.line(at(sL, -0.05), at(sL, hB + 0.15), { stroke: K.ink, sw: 1, dash: '3 3' });
      vNow = u0 < 0.3 ? g.vs * Math.sin((u0 / 0.3) * Math.PI / 2) : g.vs * Math.cos(((u0 - 0.3) / 0.7) * Math.PI / 2);
      title = uNow() === undefined ? `Released with the spring compressed ${fmt(g.d1)} ${u.L}` : u0 < 0.3 ? 'The spring pushes' : 'Free of the spring';
    }
    DYUI.block(D, at(sNow + wB / 2, 0), wB, hB, th, { label: 'm' });
    if (dopt('showV', true) && Math.abs(vNow) > 1e-9) DYUI.vec(D, at(sNow + wB / 2, hB + 0.4), e, 60, { color: K.vel, label: lbl(opt, `v ≈ ${fmt(vNow)} ${u.V}`, 'v'), size: 11.5 });
    if (!g.hit && uNow() === undefined && dopt('showV', true)) D.text(at(L0, -0.55), lbl(opt, `leaves at ${fmt(g.vs)} ${u.V}`, ''), { anchor: 'middle', color: K.vel, size: 11.5, weight: 700 });
    DYUI.title(D, 12, 20, title);
    D.text(D.inv(12, 38), 'Drawing not to scale', { color: '#5a6b75', size: 10.5, weight: 400 });
    if (fb) {
      const W = g.m * g.u.g, Fs = g.hit ? g.k * g.x : g.k * g.d1, maxF = Math.max(W, Fs, 1e-9), arr = [fArrow([0, -1], W, maxF, K.force, lbl(opt, `W = ${fmt(W)}`, 'W')), fArrow(e, Fs, maxF, K.force, lbl(opt, `F_s = ${fmt(Fs)}`, 'F_s'))];
      if (g.th < 89.999) arr.push(fArrow(n, W * Math.cos(th), maxF, K.force, lbl(opt, `N = ${fmt(W * Math.cos(th))}`, 'N')));
      const net = Fs - W * Math.sin(th) - (g.th < 89.999 ? (S().muk || 0) * W * Math.cos(th) : 0);
      if (g.th < 89.999 && (+S().muk) > 0) arr.push(fArrow([-e[0], -e[1]], (+S().muk) * W * Math.cos(th), maxF, K.force, lbl(opt, `F = ${fmt((+S().muk) * W * Math.cos(th))}`, 'F')));
      panels(D, [[g.hit ? 'Free-body diagram at the largest compression' : 'Free-body diagram at release', th, arr, { eq: true }], ['Kinetic diagram', th, Math.abs(net) > 1e-9 ? [{ d: [e[0] * Math.sign(net), e[1] * Math.sign(net)], L: 60, color: K.acc, label: lbl(opt, `ma = ${fmt(Math.abs(net))}`, 'ma') }] : [], {}]]);
    }
    return true;
  }

  function curve2D(svg, g, opt) {
    const u = g.u, th = g.th * D2R, e = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)], fb = dopt('fbd', true);
    const D = UI.Draw2D(svg, { xmin: -6.5, xmax: 4.5, ymin: -2.6, ymax: 4.8 }, opts2(svg, fb));
    const road = [[-3.2 * e[0], -3.2 * e[1]], [3.2 * e[0], 3.2 * e[1]]];
    D.poly([road[0], road[1], [road[1][0], -2.4], [road[0][0], -2.4]], { fill: '#e3e8ec', stroke: K.edge, sw: 1.4 });
    D.line(road[0], road[1], { stroke: K.ink, sw: 2.4 });
    DYUI.block(D, [0, 0], 2.2, 1.1, th, { label: 'car' });
    [-0.7, 0.7].forEach((s) => D.circle([s * e[0] + 0.18 * n[0], s * e[1] + 0.18 * n[1]], 0.18, { fill: '#2c3e50' }));
    const c = [0.55 * n[0], 0.55 * n[1]], maxF = Math.max(g.W, g.N, Math.abs(g.F), 1e-9);
    DYUI.vec(D, c, [0, -1], 30 + 60 * g.W / maxF, { color: K.force, label: lbl(opt, `W = ${fmt(g.W)} ${u.F}`, 'W'), size: 11.5, anchor: 'start', ldx: 6, ldy: 12 });
    DYUI.vec(D, [c[0] + n[0] * 0.6, c[1] + n[1] * 0.6], n, 30 + 60 * g.N / maxF, { color: K.force, label: lbl(opt, `N = ${fmt(g.N)} ${u.F}`, 'N'), size: 11.5 });
    if (Math.abs(g.F) > 1e-3 * maxF) { const fd = g.F > 0 ? [-e[0], -e[1]] : e; DYUI.vec(D, [-1.1 * e[0], -1.1 * e[1]], fd, 30 + 60 * Math.abs(g.F) / maxF, { color: K.force, label: lbl(opt, `F = ${fmt(Math.abs(g.F))} ${u.F}`, 'F'), size: 11.5, anchor: 'end', ldx: -4, ldy: 14 }); }
    D.arrow([-2.6, 3.9], [-6.2, 3.9], { color: K.ink, w: 1.4, head: 9 }); D.text([-4.4, 3.9], lbl(opt, `to the centre, r = ${fmt(g.r)} ${u.L}`, 'to the centre'), { anchor: 'middle', dy: -8, color: K.ink, size: 11.5, weight: 700 });
    if (th > 0) D.arc(road[0], 46, 0, g.th, `θ = ${fmt(g.th)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, `v = ${fmt(g.v)} ${u.V}: ${g.ok ? 'friction holds' : 'the car slides'}`);
    if (fb) {
      const ma = g.m * g.v * g.v / g.r;
      const arr = [fArrow([0, -1], g.W, maxF, K.force, lbl(opt, `W = ${fmt(g.W)}`, 'W')), fArrow(n, g.N, maxF, K.force, lbl(opt, `N = ${fmt(g.N)}`, 'N'))];
      if (Math.abs(g.F) > 1e-3 * maxF) arr.push(fArrow(g.F > 0 ? [-e[0], -e[1]] : e, g.F, maxF, K.force, lbl(opt, `F = ${fmt(Math.abs(g.F))}`, 'F')));
      panels(D, [['Free-body diagram', th, arr, { eq: true }], ['Kinetic diagram', th, ma > 0 ? [{ d: [-1, 0], L: 60, color: K.acc, label: lbl(opt, `mv²/r = ${fmt(ma)}`, 'mv²/r') }] : [], {}]]);
    }
    if (dopt('top', true)) {
      // small top view: the car going round the curve
      const bw = 110, x0 = 14, y0 = D.H - bw - 14, cx = x0 + bw / 2, cy = y0 + bw / 2, R = bw / 2 - 12;
      D.el('rect', { x: x0, y: y0, width: bw, height: bw, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
      D.el('circle', { cx, cy, r: R, fill: 'none', stroke: K.ink, 'stroke-width': 6, 'stroke-opacity': 0.25 });
      const a = (uNow() === undefined ? 0 : uNow()) * 2 * Math.PI - Math.PI / 2;
      D.el('circle', { cx: cx + R * Math.cos(a), cy: cy + R * Math.sin(a), r: 5, fill: CB, stroke: '#fff', 'stroke-width': 1.5 });
      D.text([x0 + 6, y0 + 13], 'top view', { px: true, color: '#5a6b75', size: 10, weight: 600 });
    }
    return true;
  }

  function circle2D(svg, g, opt) {
    const u = g.u, out_ = g.kind === 'outside', R = 3, fb = dopt('fbd', true);
    const D = UI.Draw2D(svg, { xmin: -4.4, xmax: 4.6, ymin: -4.2, ymax: 4.2 }, opts2(svg, fb));
    const pos = (f) => (out_ ? [R * Math.sin(f), R * Math.cos(f)] : [R * Math.sin(f), -R * Math.cos(f)]);
    const tang = (f) => (out_ ? [Math.cos(f), -Math.sin(f)] : [Math.cos(f), Math.sin(f)]); // direction of increasing angle
    if (out_) { const pts = []; for (let i = 0; i <= 60; i++) { const a = Math.PI * (i / 60); pts.push([R * Math.cos(a) * 0.985, R * Math.sin(a) * 0.985]); } D.poly(pts, { fill: '#e3e8ec', stroke: K.ink, sw: 2.2 }); DYUI.ground(D, [-R - 0.8, 0], [R + 0.8, 0]); }
    else if (g.kind === 'inside') { D.circle([0, 0], R + 0.12, { fill: 'none', stroke: K.ink, sw: 3 }); }
    else { DYUI.pin(D, [0, 0], 0.3); D.circle([0, 0], R, { fill: 'none', stroke: K.ink, sw: 1, dash: '3 5' }); }
    // path from the start to the angle asked for
    const fu = uNow() === undefined ? g.f1 : g.f0 + (g.f1 - g.f0) * uNow(), path = [];
    for (let i = 0; i <= 50; i++) path.push(pos(g.f0 + ((g.f1 - g.f0) * i) / 50));
    D.pline(path, { stroke: CA, sw: 1.6, dash: '6 4' });
    D.circle(pos(g.f0), 0.12, { fill: '#ffffff', stroke: CA, sw: 1.6 });
    const p = pos(fu);
    if (g.kind === 'cord') D.line([0, 0], p, { stroke: K.ink, sw: 1.8 });
    D.circle(p, 0.2, { fill: CA, stroke: '#fff', sw: 2 });
    const v = Math.sqrt(Math.max(0, g.v2(fu))), N = g.Nf(fu), W = g.W, maxF = Math.max(W, Math.abs(N), 1e-9), dir = Math.sign(g.f1 - g.f0) || 1, td = tang(fu), cin = [-p[0] / R, -p[1] / R];
    DYUI.vec(D, p, [0, -1], 30 + 55 * W / maxF, { color: K.force, label: lbl(opt, `W = ${fmt(W)}`, 'W'), size: 11.5, anchor: 'start', ldx: 6, ldy: 12 });
    if (Math.abs(N) > 1e-9) DYUI.vec(D, p, out_ ? [-cin[0], -cin[1]] : cin, 30 + 55 * Math.abs(N) / maxF, { color: K.force, label: lbl(opt, `${g.kind === 'cord' ? 'T' : 'N'} = ${fmt(N)}`, g.kind === 'cord' ? 'T' : 'N'), size: 11.5 });
    if (dopt('showV', true) && v > 1e-9) DYUI.vec(D, p, [td[0] * dir, td[1] * dir], 60, { color: K.vel, label: lbl(opt, `v = ${fmt(v)} ${u.V}`, 'v'), size: 11.5 });
    D.line([0, 0], [0, out_ ? R + 0.4 : -R - 0.4], { stroke: K.ink, sw: 1, dash: '4 4' });
    const a1 = out_ ? 90 : -90, nm = out_ ? 'ψ' : 'φ';
    if (fu > 1e-6) D.arc([0, 0], 34, a1, a1 + (out_ ? -1 : 1) * fu / D2R, `${nm} = ${fmt(fu / D2R)}°`, { color: K.ink });
    DYUI.title(D, 12, 20, uNow() === undefined ? `At ${nm} = ${fmt(g.f1 / D2R)}°` : `${nm} = ${fmt(fu / D2R)}°`);
    D.text(D.inv(12, 38), 'Hollow dot: start', { color: '#5a6b75', size: 10.5, weight: 400 });
    if (fb) {
      const an = (g.m * v * v) / g.r, at = g.m * g.u.g * Math.sin(fu), arr = [fArrow([0, -1], W, maxF, K.force, lbl(opt, `W = ${fmt(W)}`, 'W'))];
      if (Math.abs(N) > 1e-9) arr.push(fArrow(out_ ? [-cin[0], -cin[1]] : cin, N, maxF, K.force, lbl(opt, `${g.kind === 'cord' ? 'T' : 'N'} = ${fmt(N)}`, g.kind === 'cord' ? 'T' : 'N')));
      const kd = [];
      if (an > 1e-9) kd.push({ d: cin, L: 55, color: K.acc, label: lbl(opt, `ma_n = ${fmt(an)}`, 'ma_n') });
      if (Math.abs(at) > 1e-9) { const tdir = out_ ? td : [-td[0], -td[1]]; kd.push({ d: tdir, L: 45, color: K.acc, label: lbl(opt, `ma_t = ${fmt(at)}`, 'ma_t') }); }
      panels(D, [['Free-body diagram', 0, arr, { eq: true, dot: true }], ['Kinetic diagram', 0, kd, { dot: true }]]);
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u;
    if (g.scene === 'curve') {
      const vmax = Math.max(g.v * 1.6, isFinite(g.vMax) ? g.vMax * 1.3 : 0, g.vNo * 1.6, 1), pts = [], up = [], dn = [];
      for (let i = 0; i <= 200; i++) { const v = (vmax * i) / 200, th = g.th * D2R, N = g.m * (u.g * Math.cos(th) + (v * v / g.r) * Math.sin(th)), F = g.m * ((v * v / g.r) * Math.cos(th) - u.g * Math.sin(th)); pts.push([v, F / N]); up.push([v, g.mu]); dn.push([v, -g.mu]); }
      const fn = (v) => { const th = g.th * D2R; return ((v * v / g.r) * Math.cos(th) - u.g * Math.sin(th)) / (u.g * Math.cos(th) + (v * v / g.r) * Math.sin(th)); };
      return DYUI.stack(svg, [{ label: 'F/N needed', color: K.force, pts, fill: false, more: [{ pts: up, color: K.ink, dash: '6 4' }, { pts: dn, color: K.ink, dash: '6 4' }], marks: [{ x: g.v, y: fn(g.v), label: `v = ${fmt(g.v)} ${u.V}`, color: g.ok ? K.vel : '#c0392b' }] }], { xlabel: `v (${u.V})   dashed: ±μ_s`, xmin: 0, xmax: vmax });
    }
    if (g.scene === 'circle') {
      const lo = Math.min(g.f0, g.f1), hi = Math.max(g.f0, g.f1), vp = [], np = [];
      for (let i = 0; i <= 200; i++) { const f = lo + ((hi - lo) * i) / 200; vp.push([f / D2R, Math.sqrt(Math.max(0, g.v2(f)))]); np.push([f / D2R, g.Nf(f)]); }
      const cur = uNow() === undefined ? g.f1 / D2R : (g.f0 + (g.f1 - g.f0) * uNow()) / D2R;
      return DYUI.stack(svg, [{ label: `v (${u.V})`, color: K.vel, pts: vp, at: (x) => Math.sqrt(Math.max(0, g.v2(x * D2R))) }, { label: `${g.kind === 'cord' ? 'T' : 'N'} (${u.F})`, color: K.force, pts: np, at: (x) => g.Nf(x * D2R) }], { xlabel: `${g.kind === 'outside' ? 'ψ' : 'φ'} (°)`, cursor: cur, xmin: lo / D2R, xmax: hi / D2R });
    }
    if (g.scene === 'stack') {
      const T = g.span[1], NM = g.names, cols = [CA, CB, '#27ae60', '#8e44ad', '#7f8c8d'];
      const line = (j) => { const p = []; for (let i = 0; i <= 50; i++) { const t = (T * i) / 50; p.push([t, g.a[j] * t]); } return p; };
      const more = g.a.slice(1).map((a, j) => ({ pts: line(j + 1), color: cols[(j + 1) % 5] }));
      const cur = uNow() === undefined ? T : T * uNow();
      return DYUI.stack(svg, [{ label: `v (${u.V})  ${g.a.map((a, j) => NM[j]).join(', ')}`, color: cols[0], pts: line(0), fill: false, more, marks: g.a.map((a, j) => ({ x: cur, y: a * cur, label: NM[j], color: cols[j % 5] })) }], { xlabel: 't (s)', xmin: 0, xmax: T, cursor: cur });
    }
    const col = { 'T₁': '#7f8c8d', 'T₂': K.vel, 'ΣT₂': K.vel, U_P: K.force, U_W: '#8e44ad', U_f: '#c0392b', U_s: SPR };
    return DYUI.bars(svg, (g.bars || []).map(([name, v]) => ({ name, v, color: col[name] || CA })), { unit: u.E, title: 'Work and energy' });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  function cylZ(v, c, R, depth, fill) {
    const n = 28, f = [], b = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; f.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a), c[2] + depth / 2]); b.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a), c[2] - depth / 2]); }
    v.face(f, fill, 1, K.edge, 1, 0, [0, 0, 1]); v.face(b.slice().reverse(), fill, 1, K.edge, 1, 0, [0, 0, -1]);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, am = ((i + 0.5) / n) * 2 * Math.PI; v.face([f[i], f[j], b[j], b[i]], fill, 1, null, 1, 0, [Math.cos(am), Math.sin(am), 0]); }
  }
  function helix(v, a, b, r, turns) {
    const d = DYUI.sub(b, a), L = Math.hypot(...d), e = DYUI.mul(d, 1 / L), p1 = DYUI.nrm(DYUI.cross(e, Math.abs(e[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), p2 = DYUI.cross(e, p1), pts = [];
    for (let i = 0; i <= turns * 16; i++) { const t = i / (turns * 16), an = t * turns * 2 * Math.PI; pts.push(DYUI.add(DYUI.add(a, DYUI.mul(e, t * L)), DYUI.add(DYUI.mul(p1, r * Math.cos(an)), DYUI.mul(p2, r * Math.sin(an))))); }
    v.line(pts, SPR, 1.8);
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u0 = uNow() === undefined ? null : uNow();
    if (g.scene === 'block' || g.scene === 'spring') {
      const th = g.th * D2R, e = [Math.cos(th), Math.sin(th), 0], Ls = 10, wB = g.scene === 'block' ? 1.6 : 1.2, hB = g.scene === 'block' ? 1.1 : 0.9;
      if (th > 1e-9 && g.th < 89.999) v.extrude([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], -1.2, 1.2, '#d5dbe1', 1, K.edge);
      else if (g.th < 89.999) DYUI.floor3(v, -0.5, Ls + 0.5, 0, 1.2);
      else DYUI.floor3(v, -1.5, 1.5, 0, 1.2);
      let s;
      if (g.scene === 'block') {
        const T = g.span[1], xs = []; for (let i = 0; i <= 60; i++) xs.push(g.x((T * i) / 60));
        const xr = Math.max(1e-9, ...xs.map(Math.abs)), Kx = g.rest ? 0 : 5.5 / xr, s0 = g.dir < 0 || xs[60] < 0 ? 7.8 : 2.2;
        s = Math.max(wB / 2, Math.min(Ls - wB / 2, s0 + g.x(u0 === null ? T : T * u0) * Kx));
        if (g.spr) { v.box(-0.25, 0, -1.2, 0, 1.8, 1.2, '#c3cbd3', 1, K.edge); helix(v, [0.15 * e[0] + 0, 0.55, 0], [(s - wB / 2) * e[0] - 0.55 * e[1] * 0, (s - wB / 2) * e[1] + 0.55, 0], 0.18, 9); }
      } else {
        const L0 = 4, u = u0 === null ? 0 : u0;
        if (g.hit) { const sC = L0, sMin = L0 - 2.4, sStart = Math.min(Ls - wB, L0 + 2.6); s = (u < 0.5 ? sStart - (sStart - sC) * (u / 0.5) : sC - (sC - sMin) * Math.sin(((u - 0.5) / 0.5) * Math.PI / 2)) + wB / 2; }
        else { const sR = L0 - 2.4, sL = L0 - (2.4 * g.d2) / g.d1, sT = isFinite(g.L2) ? Math.min(Ls - wB, sL + Math.max(1.2, 5.5 * Math.min(1, g.L2 / Math.max(g.L1 * 3, 1e-9)))) : Ls - wB; s = (u < 0.3 ? sR + (sL - sR) * Math.sin((u / 0.3) * Math.PI / 2) : sL + (sT - sL) * Math.sin(((u - 0.3) / 0.7) * Math.PI / 2)) + wB / 2; }
        const nrm = [-Math.sin(th), Math.cos(th)];
        if (g.th < 89.999) DYUI.block3(v, [-0.3 * e[0], -0.3 * e[1]], 0.3, 1.8, 2.4, th, '#c3cbd3');
        helix(v, [nrm[0] * hB / 2, nrm[1] * hB / 2, 0], [(s - wB / 2) * e[0] + nrm[0] * hB / 2, (s - wB / 2) * e[1] + nrm[1] * hB / 2, 0], 0.2, 8);
      }
      DYUI.block3(v, [s * e[0], s * e[1]], wB, hB, 1.2, th, K.body);
      if (g.scene === 'block' && g.P > 0) { const n = [-Math.sin(th), Math.cos(th)], c = [s * e[0] + n[0] * hB / 2, s * e[1] + n[1] * hB / 2, 0], dp = [Math.cos(th + g.al * D2R), Math.sin(th + g.al * D2R), 0]; DYUI.arrow3(v, c, DYUI.add(c, DYUI.mul(dp, 2)), K.force, 2.6); v.label(DYUI.add(c, DYUI.mul(dp, 2.1)), lbl(opt, `P = ${fmt(g.P)} ${g.u.F}`, 'P'), K.force); }
      const top = Math.max(Ls * Math.sin(th), 3) + 1;
      v.setBounds([-1, -0.3, -1.4], [Math.max(Ls * e[0], 1.5) + 1, top, 1.4]);
      return;
    }
    if (g.scene === 'pulley') {
      const T = g.span[1], t = u0 === null ? T : T * u0, sMax = Math.max(Math.abs(g.sA(T)), Math.abs(g.sB(T)), 1e-9), Ks = g.rest ? 0 : 2.2 / sMax, dA = g.sA(t) * Ks, dB = g.sB(t) * Ks;
      const line = (a, b) => v.line([a, b], K.ink, 1.6);
      if (g.onA === 'hang') {
        v.box(-3, 3, -0.8, 3, 3.3, 0.8, '#c3cbd3', 1, K.edge);
        const Rp = 1, yP = 1.9, gap = 0.22, xA = -Rp - (g.nA - 1) * gap / 2, xB = Rp + (g.nB - 1) * gap / 2, yA = -2.2 - dA, yB = -2.2 - dB;
        cylZ(v, [0, yP, 0], Rp, 0.3, '#d5dbe1'); line([0, 3, 0], [0, yP, 0]);
        const group = (x, yBot, nn, inner) => { for (let i = 0; i < nn; i++) { const xx = x + (i - (nn - 1) / 2) * gap; line([xx, Math.abs(xx - inner) < 1e-6 ? yP : 3, 0], [xx, yBot, 0]); } };
        group(xA, yA, g.nA, -Rp); group(xB, yB, g.nB, Rp);
        v.box(xA - 0.65, yA - 0.95, -0.5, xA + 0.65, yA, 0.5, CA, 1, K.edge); v.box(xB - 0.55, yB - 1, -0.45, xB + 0.55, yB, 0.45, CB, 1, K.edge);
        v.setBounds([-3, -6.2, -0.8], [3, 3.4, 0.8]);
      } else {
        const th = g.onA === 'incline' ? g.th * D2R : 0, e = [Math.cos(th), Math.sin(th)], top = [0.2, 0.2], Ls = 6.2, st0 = [top[0] - Ls * e[0], top[1] - Ls * e[1]];
        if (th > 0) v.extrude([st0, top, [top[0], st0[1]]], -1, 1, '#d5dbe1', 1, K.edge); else v.box(st0[0], -0.6, -1, top[0], top[1], 1, '#d5dbe1', 1, K.edge);
        const pc = [top[0] + 0.45, top[1] + 0.45]; cylZ(v, [pc[0], pc[1], 0], 0.42, 0.3, '#d5dbe1');
        const sA = 3.2 + dA, base = [top[0] - sA * e[0], top[1] - sA * e[1]], yB = -2.2 - dB;
        DYUI.block3(v, base, 1.3, 0.95, 1, th, CA);
        line([base[0] + e[0] * 0.65 - Math.sin(th) * 0.47, base[1] + e[1] * 0.65 + Math.cos(th) * 0.47, 0], [pc[0], pc[1] + 0.42, 0]);
        line([pc[0] + 0.42, pc[1], 0], [pc[0] + 0.42, yB, 0]);
        v.box(pc[0] + 0.42 - 0.55, yB - 1, -0.45, pc[0] + 0.42 + 0.55, yB, 0.45, CB, 1, K.edge);
        v.setBounds([st0[0] - 0.3, -6.2, -1], [pc[0] + 1.2, Math.max(1.2, pc[1] + 0.6), 1]);
      }
      return;
    }
    if (g.scene === 'stack') {
      const t = u0 === null ? g.span[1] : g.span[1] * u0, L = stackLayout(g, t), { th, e, Ls, P } = L;
      if (th > 1e-9) v.extrude([[0, 0], [Ls * e[0], Ls * e[1]], [Ls * e[0], 0]], -1.6, 1.6, '#d5dbe1', 1, K.edge); else DYUI.floor3(v, -0.5, Ls + 0.5, 0, 1.6);
      L.blocks.forEach((b, j) => DYUI.block3(v, P(b.s, b.h + 0.015 * (j + 1)), b.w, SH, Math.max(0.8, 2.4 - 0.3 * j), th, j % 2 ? CB : CA));
      if (g.tie) {
        const n = L.n, hTop = L.blocks[n - 1].h + SH / 2, hBot = SH / 2, r = (hTop - hBot) / 2, sp = Ls - 0.45, c = P(sp, (hTop + hBot) / 2);
        cylZ(v, [c[0], c[1], 0], r, 0.3, '#d5dbe1');
        const m1 = P(L.blocks[n - 1].s + L.blocks[n - 1].w / 2, hTop), m0 = P(L.blocks[0].s + L.blocks[0].w / 2, hBot), t1 = P(sp, hTop), t0 = P(sp, hBot);
        v.line([[m1[0], m1[1], 0], [t1[0], t1[1], 0]], K.ink, 1.6); v.line([[m0[0], m0[1], 0], [t0[0], t0[1], 0]], K.ink, 1.6);
      }
      if (g.P > 0) { const b = L.blocks[g.on], dp = [Math.cos(th + g.al * D2R), Math.sin(th + g.al * D2R), 0], side = Math.cos(g.al * D2R) >= 0 ? 1 : -1, m = P(b.s + side * b.w / 2, b.h + SH / 2), c = [m[0], m[1], 0];
        if (side > 0) DYUI.arrow3(v, c, DYUI.add(c, DYUI.mul(dp, 2)), K.force, 2.6); else DYUI.arrow3(v, DYUI.sub(c, DYUI.mul(dp, 2)), c, K.force, 2.6);
        v.label(side > 0 ? DYUI.add(c, DYUI.mul(dp, 2.1)) : DYUI.sub(c, DYUI.mul(dp, 2.1)), lbl(opt, `P = ${fmt(g.P)} ${g.u.F}`, 'P'), K.force); }
      v.setBounds([-1, -0.3, -1.8], [Ls * e[0] + 1, Ls * e[1] + L.H + 1, 1.8]);
      return;
    }
    if (g.scene === 'curve') {
      const th = g.th * D2R, R = 5, w = 1.6, n = 48;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, ri = R - w / 2, ro = R + w / 2, yo = w * Math.tan(th);
        v.face([[ri * Math.cos(a0), 0, ri * Math.sin(a0)], [ro * Math.cos(a0), yo, ro * Math.sin(a0)], [ro * Math.cos(a1), yo, ro * Math.sin(a1)], [ri * Math.cos(a1), 0, ri * Math.sin(a1)]], '#c3cbd3', 1, null, 1, -1, [0, 1, 0]);
      }
      const a = (u0 === null ? 0.125 : u0) * 2 * Math.PI, c = [R * Math.cos(a), 0.5 * w * Math.tan(th) + 0.35, R * Math.sin(a)];
      DYUI.sphere(v, c, 0.35, CB);
      v.label([0, 0.2, 0], lbl(opt, `r = ${fmt(g.r)} ${g.u.L}`, 'centre'), K.ink);
      v.setBounds([-R - 1, -0.5, -R - 1], [R + 1, 2, R + 1]);
      return;
    }
    // vertical circle in the x–y plane
    const out_ = g.kind === 'outside', R = 3, pos = (f) => (out_ ? [R * Math.sin(f), R * Math.cos(f), 0] : [R * Math.sin(f), -R * Math.cos(f), 0]);
    const pts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * 2 * Math.PI; pts.push([R * Math.cos(a), R * Math.sin(a), 0]); }
    if (out_) { const prof = []; for (let i = 0; i <= 12; i++) { const a = (Math.PI / 2) * (i / 12); prof.push([R * Math.cos(a), R * Math.sin(a)]); } v.lathe(prof, '#d5dbe1', 1, null, 32, 0, 0, { open: true }); DYUI.floor3(v, -R - 1, R + 1, 0, R + 1); }
    else v.line(pts, K.ink, g.kind === 'inside' ? 4 : 1.2, g.kind === 'inside' ? null : [3, 4]);
    const fu = u0 === null ? g.f1 : g.f0 + (g.f1 - g.f0) * u0, p = pos(fu);
    if (g.kind === 'cord') v.line([[0, 0, 0], p], K.ink, 2);
    DYUI.sphere(v, p, 0.25, CA);
    v.setBounds([-R - 0.6, out_ ? -0.2 : -R - 0.6, -1], [R + 0.6, R + 0.6, 1]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(Pkin.defaults(), o);
  M.presets = [
    { name: 'Test: Book Example 13.1, 50 kg crate towed by 400 N at 30°, μ_k = 0.3 (a = 5.19 m/s², v = 15.6 m/s at 3 s)', units: 'SI', state: P0({ scene: 'block', method: 'force', m: 50, th: 0, P: 400, al: 30, mus: 0.35, muk: 0.3, v0: 0, t: 3 }),
      expect: [{ k: 'Normal force N', v: 290.5 }, { k: 'Acceleration', v: 5.185 }, { k: 'Velocity at t = 3 s', v: 15.56 }] },
    { name: 'Test: Book Example 14.7, 50 kg crate pushed by 150 N on a 3-4-5 slope down, power at 4 s (37.4 W)', units: 'SI', state: P0({ scene: 'block', method: 'force', m: 50, th: 0, P: 150, al: -36.8699, mus: 0.2, muk: 0.2, v0: 0, t: 4 }),
      expect: [{ k: 'Power of P at the end, P·v', v: 37.44 }, { k: 'Average power of P, U_P/Δt', v: 18.72 }] },
    { name: 'Test: Book Example 14.2, 3500 lb car skids down a 10° road from 20 ft/s, μ_k = 0.5 (s = 19.5 ft)', units: 'US', state: P0({ scene: 'block', method: 'stop', m: 3500, th: 10, P: 0, mus: 0.6, muk: 0.5, v0: -20 }),
      expect: [{ k: 'Distance to stop', v: 19.49 }] },
    { name: 'Test: Book Example 14.1, 10 kg block pushed 2 m up a smooth 30° incline by 400 N, spring 30 N/m (ΣU = 505 J)', units: 'SI', state: P0({ scene: 'block', method: 'work', m: 10, th: 30, P: 400, al: -30, mus: 0, muk: 0, v0: 0, spring: true, k: 30, s1: 0.5, d: 2 }),
      expect: [{ k: 'Total work ΣU₁₋₂', v: 504.7 }, { k: 'Work of P, U_P', v: 692.8 }, { k: 'Work of the spring U_s', v: -90 }] },
    { name: 'Test: Book Example 13.5, 100 kg block A on a movable pulley, 20 kg block B (T = 327 N, a_A = 3.27 m/s²)', units: 'SI', state: P0({ scene: 'pulley', onA: 'hang', mA: 100, mB: 20, nA: 2, nB: 1, find: 'time', t: 1 }),
      expect: [{ k: 'Cord tension T', v: 327 }, { k: 'Acceleration of A, a_A', v: 3.27 }, { k: 'Acceleration of B, a_B', v: -6.54 }] },
    { name: 'Test: Book Example 14.6, 10 kg A and 100 kg B on four strands, B reaches 2 m/s (s_B = 0.883 m)', units: 'SI', state: P0({ scene: 'pulley', onA: 'hang', mA: 10, mB: 100, nA: 1, nB: 4, find: 'speedB', vB: 2 }),
      expect: [{ k: 'Distance B moves', v: 0.8835 }] },
    { name: 'Test: Book Example 14.4, 2 kg block launched by a 200 N/m spring from 0.7 m to 0.6 m (h = 0.963 m)', units: 'SI', state: P0({ scene: 'spring', smode: 'launch', sm: 2, sk: 200, sth: 90, d1: 0.7, d2: 0.6, y0: 0.3 }),
      expect: [{ k: 'Highest point above the ground h', v: 0.9626 }] },
    { name: 'Test: Book Example 13.6, banking for no friction, r = 100 m, θ = 20° (v = 18.9 m/s)', units: 'SI', state: P0({ scene: 'curve', m: 1200, r: 100, bank: 20, cmus: 0.2, cv: 18.9 }),
      expect: [{ k: 'Speed with no friction needed', v: 18.9 }] },
    { name: 'Test: Book Example 13.9, 60 kg skateboarder on a 4 m circular track, at 60° (N = 1.53 kN)', units: 'SI', state: P0({ scene: 'circle', kind: 'inside', cm: 60, R: 4, phi0: 90, cv0: 0, phi: 30 }),
      expect: [{ k: 'Normal force N', v: 1529 }] },
    { name: 'Test: Book Example 14.9, 8 Mg plane on a 20 m cable released at 60°, at 15° (v = 13.5 m/s, T = 149 kN)', units: 'SI', state: P0({ scene: 'circle', kind: 'cord', cm: 8000, R: 20, phi0: 60, cv0: 0, phi: 15 }),
      expect: [{ k: 'Speed v', v: 13.52 }, { k: 'Cord tension T', v: 148900 }] },
    { name: 'Test: Problem 13–17, 60 kg A on 30 kg B, μ_s = 0.3 between them, μ_k = 0.35 on the floor (P = 574 N)', units: 'SI', state: P0({ scene: 'stack', ktask: 'Pmax', blocks: [{ name: 'B', m: 30, mus: 0.35, muk: 0.35 }, { name: 'A', m: 60, mus: 0.3, muk: 0.3 }], kth: 0, kal: 0, kon: 0, ktie: false }),
      expect: [{ k: 'Largest P with no slip between blocks', v: 573.9 }, { k: 'Acceleration of the stack', v: 2.943 }] },
    { name: 'Test: Problem 13–30, four 2 kg plates, μ_s = 0.3, smooth floor, F on the bottom plate (F = 23.5 N)', units: 'SI', state: P0({ scene: 'stack', ktask: 'Pmax', blocks: [{ name: 'D', m: 2, mus: 0, muk: 0 }, { name: 'C', m: 2, mus: 0.3, muk: 0.3 }, { name: 'B', m: 2, mus: 0.3, muk: 0.3 }, { name: 'A', m: 2, mus: 0.3, muk: 0.3 }], kth: 0, kal: 0, kon: 0, ktie: false }),
      expect: [{ k: 'Largest P with no slip between blocks', v: 23.54 }] },
    { name: 'Test: Problem 13–27, 20 kg A on a 60 kg plate B on a 30° incline, tied over pulley C (T = 147.1 N, t = 0.815 s for 0.5 m)', units: 'SI', state: P0({ scene: 'stack', ktask: 'motion', blocks: [{ name: 'B', m: 60, mus: 0.1, muk: 0.1 }, { name: 'A', m: 20, mus: 0.2, muk: 0.2 }], kth: 30, kP: 0, kal: 0, kon: 0, ktie: true, kd: 0.5 }),
      expect: [{ k: 'Acceleration of A', v: 0.7534 }, { k: 'Acceleration of B', v: -0.7534 }, { k: 'Cord tension T', v: 147.1 }, { k: 'Time for A to slide 0.5 m on block B', v: 0.8147 }] },
    { name: 'Two blocks: P = 700 N on the bottom one, the top block slides back on it', units: 'SI', state: P0({ scene: 'stack', ktask: 'motion', blocks: [{ m: 30, mus: 0.35, muk: 0.35 }, { m: 60, mus: 0.3, muk: 0.3 }], kth: 0, kP: 700, kal: 0, kon: 0, ktie: false, kd: 1 }) },
    { name: 'Block on a table pulled by a hanging block, μ_k = 0.2', units: 'SI', state: P0({ scene: 'pulley', onA: 'table', mA: 10, mB: 5, nA: 1, nB: 1, mus: 0.3, muk: 0.2, find: 'time', t: 2 }) },
    { name: 'Edge: P lifts the block off the floor (fails on purpose)', units: 'SI', fails: true, state: P0({ scene: 'block', method: 'force', m: 5, th: 0, P: 100, al: 80, t: 2 }) },
  ];

  root.DPkin = M;
})(window);
