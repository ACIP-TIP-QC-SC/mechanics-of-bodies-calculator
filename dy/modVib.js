/* =====================================================================
 * DYNAMICS · D7 Vibrations (inputs, diagrams, presets). Physics: dy/vib.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Vib, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, SPR = '#2c3e50', BLK = '#b9c2cb', D2R = Math.PI / 180;

  const M = { id: 'vib', title: 'Vibrations', defaults: Vib.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const mlab = u.us ? 'Weight W' : 'Mass m';
    let sec = C.section(c, 'System');
    C.select(sec, { label: 'System', get: () => st.sys, set: (v) => { st.sys = v; if (v === 'comp' && !Vib.BODY[st.body]) st.body = 'rod'; if (v === 'tors' && !Vib.TBODY[st.body]) st.body = 'plate'; }, options: [
      ['sm', 'Mass on springs (damping and forcing allowed)'], ['pend', 'Simple pendulum'], ['comp', 'Body swinging on a pin (compound pendulum)'], ['tors', 'Torsional pendulum'],
      ['pulley', 'Block on a cord over a disk, held by a spring (energy method)'], ['roll', 'Cylinder rolling against a spring (energy method)'], ['bar', 'Bar on a pin with a spring and a dashpot (damping allowed)']] });
    if (st.sys === 'sm') {
      num(sec, 'm', mlab, u.M); num(sec, 'k', 'Stiffness of each spring k', u.K);
      C.num(sec, { label: 'Number of springs', get: () => st.n, set: (v) => (st.n = v), step: 1 });
      if (+st.n > 1) C.seg(sec, { label: 'Springs are', get: () => st.arr, set: (v) => (st.arr = v), options: [['parallel', 'In parallel'], ['series', 'In series']] });
      C.toggle(sec, { label: 'Vertical (report the static deflection)', get: () => st.vert, set: (v) => (st.vert = v) });
    } else if (st.sys === 'pend') num(sec, 'L', 'Length of the cord L', u.L);
    else if (st.sys === 'comp') {
      C.select(sec, { label: 'Body', get: () => st.body, set: (v) => (st.body = v), options: Object.keys(Vib.BODY).map((k) => [k, Vib.BODY[k].name]) });
      num(sec, 'm', mlab, u.M);
      if (st.body === 'rod') num(sec, 'len', 'Length L', u.L);
      if (st.body === 'hoop' || st.body === 'disk') num(sec, 'r', 'Radius r', u.L);
      if (st.body === 'kg') { num(sec, 'kO', 'Radius of gyration about G, k_G', u.L); num(sec, 'dG', 'Distance from the pin to G, d', u.L); }
    } else if (st.sys === 'tors') {
      C.select(sec, { label: 'Body', get: () => st.body, set: (v) => (st.body = v), options: Object.keys(Vib.TBODY).map((k) => [k, Vib.TBODY[k].name]) });
      num(sec, 'm', mlab, u.M);
      if (st.body === 'plate') { num(sec, 'a', 'Side a', u.L); num(sec, 'b', 'Side b', u.L); }
      if (st.body === 'disk') num(sec, 'r', 'Radius r', u.L);
      if (st.body === 'kg') num(sec, 'kO', 'Radius of gyration k', u.L);
      num(sec, 'kt', 'Torsional stiffness of the rod k', u.KT);
    } else if (st.sys === 'pulley') {
      num(sec, 'mb', `Block: ${mlab.toLowerCase()}`, u.M); num(sec, 'md', `Disk (uniform): ${mlab.toLowerCase()}`, u.M);
      num(sec, 'rb', 'Radius where the cord leaves r_b', u.L); num(sec, 'rs', 'Radius where the spring is tied r_s', u.L); num(sec, 'k', 'Spring stiffness k', u.K);
    } else if (st.sys === 'bar') {
      C.note(sec, 'A uniform bar pinned at its end A, horizontal at equilibrium, held by a vertical spring at a and a dashpot at b from A.');
      num(sec, 'm', `Bar: ${mlab.toLowerCase()}`, u.M); num(sec, 'len', 'Length L', u.L); num(sec, 'k', 'Spring stiffness k', u.K); num(sec, 'sa', 'Spring at a from A', u.L);
      if (st.damp !== 'none') num(sec, 'sb', 'Dashpot at b from A', u.L);
    } else { num(sec, 'm', `Cylinder: ${mlab.toLowerCase()}`, u.M); num(sec, 'r', 'Radius r', u.L); num(sec, 'k', 'Spring stiffness k', u.K); }
    const rot = ['pend', 'comp', 'tors', 'bar'].includes(st.sys);
    if (st.sys === 'sm' || st.sys === 'bar') {
      sec = C.section(c, 'Damping');
      C.seg(sec, { get: () => st.damp, set: (v) => (st.damp = v), options: [['none', 'None'], ['c', 'Coefficient c'], ['z', 'Factor c/c_c']] });
      if (st.damp === 'c') { num(sec, 'c', st.sys === 'bar' ? 'Dashpot coefficient c' : 'Coefficient of each damper c', u.CD); if (st.sys === 'sm') C.num(sec, { label: 'Number of dampers side by side', get: () => st.nc, set: (v) => (st.nc = v), step: 1 }); }
      if (st.damp === 'z') num(sec, 'zeta', 'Damping factor ζ = c/c_c', '');
    }
    if (st.sys === 'sm') {
      sec = C.section(c, 'What makes it vibrate');
      C.select(sec, { label: 'Excitation', get: () => st.exc, set: (v) => (st.exc = v), options: [['free', 'Nothing: free vibration from a start'], ['impact', 'A projectile embeds in the block'], ['force', 'A periodic force F₀ sin ω₀t'], ['support', 'The support moves δ₀ sin ω₀t'], ['unb', 'A rotating unbalance m₀ at radius e']] });
      if (st.exc === 'impact') { num(sec, 'mp', `Projectile: ${mlab.toLowerCase()}`, u.M); num(sec, 'vp', 'Projectile speed', u.V); }
      else if (st.exc !== 'free') {
        num(sec, 'w0', 'Forcing frequency ω₀', 'rad/s');
        if (st.exc === 'force') num(sec, 'F0', 'Force amplitude F₀', u.F);
        if (st.exc === 'support') num(sec, 'd0', 'Support amplitude δ₀', u.S);
        if (st.exc === 'unb') { num(sec, 'm0', `Unbalanced ${u.us ? 'weight' : 'mass'} m₀`, u.M); num(sec, 'e', 'Eccentricity e', u.S); }
      }
    }
    if (st.sys === 'sm' && st.exc === 'impact') return;
    sec = C.section(c, st.sys === 'sm' && st.exc !== 'free' ? 'Start (adds the transient)' : 'Start');
    if (rot) { num(sec, 'th0', 'Released from rest at θ₀', '°'); }
    else { num(sec, 'x0', 'Initial displacement x₀', u.S); num(sec, 'v0', 'Initial velocity v₀', u.V); if (st.exc === 'free' || st.sys !== 'sm') num(sec, 'xt', 'Find when it comes back to x_t (0 to skip)', u.S); }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (st.sys === 'sm') C.seg(c, { label: 'Layout', get: () => (st.vert ? 'v' : dopt('lay', 'h')), set: (v) => (st.lay = v), options: st.vert ? [['v', 'Standing on the springs']] : [['h', 'Horizontal'], ['v', 'Standing on the springs']] });
    C.toggle(c, { label: 'Equilibrium position and displacement arrow', get: () => dopt('eq', true), set: (v) => (st.eq = v), rebuild: false });
    C.toggle(c, { label: 'Envelope and steady-state curve on the x(t) graph', get: () => dopt('envl', true), set: (v) => (st.envl = v), rebuild: false });
    C.toggle(c, { label: 'Exaggerate small motions so they can be seen', get: () => dopt('exag', true), set: (v) => (st.exag = v), rebuild: false });
    if (st.sys === 'sm' || st.sys === 'bar') C.toggle(c, { label: 'Equivalent electrical circuit', get: () => dopt('circ', false), set: (v) => (st.circ = v), rebuild: false });
  };

  M.compute = (U) => Vib.solve(S(), U);
  M.onUnits = (from, to) => Vib.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => 'Vibrating system';
  M.cap3D = () => '3D view';
  M.plotCaption = () => (S().sys === 'sm' && S().exc !== 'free' ? 'Response x(t) and the magnification factor curve' : 'Response against time');
  M.plotTall = () => S().sys === 'sm' && S().exc !== 'free';
  M.hint = () => 'Press Play to watch it vibrate (the clock shows the real time). The graph below follows the motion; for forced vibration the magnification factor curve marks where the system runs.';
  M.legend = () => [[K.pos, 'Displacement'], [K.force, 'Force'], [SPR, 'Spring and damper', 'ln']];
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]), { idle: 'starting position' });
  M.anim = () => motion;
  const tNow = (g) => (S()._u === undefined ? 0 : g.span[0] + (g.span[1] - g.span[0]) * S()._u);
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  /** Largest |x| over the window, for scaling the drawing. */
  function xmax(g) { let m = 1e-12; for (let i = 0; i <= 400; i++) m = Math.max(m, Math.abs(g.x(g.span[0] + ((g.span[1] - g.span[0]) * i) / 400))); return m; }
  /** Scale from the real displacement to the drawing (drawing units for x, or radians for angles). */
  function scaleOf(g, full) { const m = xmax(g); if (g.rot) return dopt('exag', true) && m < 15 * D2R ? (20 * D2R) / m : 1; return dopt('exag', true) ? full / m : Math.min(full / m, 1); }

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  /** Inset: the series L–R–C circuit with the same equation (Table 22–1), drawn in pixels in the top-right corner. */
  function circuit(D, g) {
    if (!dopt('circ', false) || !g.analog) return;
    const a = g.analog, w = 200, h = 106, x0 = D.W - w - 10, y0 = 34, P = (x, y) => D.inv(x0 + x, y0 + y), ln = (pts) => D.pline(pts.map(([x, y]) => P(x, y)), { stroke: K.ink, sw: 1.6 });
    D.el('rect', { x: x0, y: y0, width: w, height: h, fill: '#fff', stroke: '#d3dce0', rx: 6 });
    D.text([x0 + 8, y0 + 15], 'Equivalent circuit', { px: true, color: K.ink, size: 11, weight: 700 });
    const top = 46, bot = 94, L0 = 20, R0 = w - 20;
    ln([[L0, bot], [L0, top], [44, top]]);
    const coil = []; for (let i = 0; i <= 32; i++) { const t = i / 32; coil.push([44 + 36 * t, top - 6 * Math.abs(Math.sin(t * 4 * Math.PI))]); } ln(coil);
    ln([[80, top], [100, top]]); const zz = [[100, top]]; for (let i = 1; i <= 6; i++) zz.push([100 + i * 5, top + (i % 2 ? -6 : 6)]); zz.push([135, top]); ln(zz);
    ln([[135, top], [R0, top], [R0, 58]]); ln([[R0 - 10, 58], [R0 + 10, 58]]); ln([[R0 - 10, 66], [R0 + 10, 66]]); ln([[R0, 66], [R0, bot], [L0, bot]]);
    if (a.E) { D.circle(P(L0, 64), 9 / D.sc, { fill: '#fff', stroke: K.ink, sw: 1.4 }); D.text([x0 + L0, y0 + 68], '~', { px: true, anchor: 'middle', color: K.ink, size: 12 }); }
    const T = (x, y, s) => D.text([x0 + x, y0 + y], s, { px: true, anchor: 'middle', color: K.force, size: 10.5, weight: 700 });
    T(62, top - 11, `L = ${fmt(a.L)}`); T(118, top - 11, `R = ${fmt(a.R)}`); D.text([x0 + R0 - 14, y0 + 66], `C = ${fmt(a.C)}`, { px: true, anchor: 'end', color: K.force, size: 10.5, weight: 700 });
  }
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, u = g.u, t = tNow(g), x = g.x(t);
    let D;
    const head = () => DYUI.title(D, 12, 20, `t = ${fmt(t)} s:  ${g.rot ? `θ = ${fmt(x / D2R)}°` : `x = ${fmt(DY.fromBase(x, 'S', u))} ${u.S}`}`);
    if (g.sys === 'sm') {
      const vert = g.vert || dopt('lay', 'h') === 'v', k = scaleOf(g, 0.5), dx = x * k;
      if (!vert) {
        D = UI.Draw2D(svg, { xmin: -0.6, xmax: 5.2, ymin: -0.9, ymax: 2.2 }, { pad: 30 });
        const sup = g.exc === 'support' ? (DY.toBase(+S().d0, 'S', u) * k) * Math.sin(g.w0 * t) : 0, xe = 2.6, w = 1.1, h = 0.9;
        DYUI.ground(D, [-0.6, 0], [5.2, 0]);
        if (g.exc === 'support') { D.poly([[-0.5 + sup, 0.02], [-0.2 + sup, 0.02], [-0.2 + sup, 1.5], [-0.5 + sup, 1.5]], { fill: '#d5dbe1', stroke: K.edge, sw: 1.4 }); D.text([-0.35 + sup, 1.5], 'δ₀ sin ω₀t', { anchor: 'middle', dy: -6, color: K.force, size: 11.5 }); }
        else D.poly([[-0.5, 0], [-0.2, 0], [-0.2, 1.7], [-0.5, 1.7]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1 });
        const left = xe - w / 2 + dx, nS = Math.min(g.n || 1, 4), damped = g.damped;
        for (let i = 0; i < (g.arr === 'series' ? 1 : nS); i++) {
          const y = damped ? 0.55 + (i * 0.3) / Math.max(1, nS - 1) : 0.25 + ((i + 0.5) * 0.5) / (g.arr === 'series' ? 1 : nS);
          if (g.arr === 'series' && nS > 1) { const L = left - (-0.2 + sup), seg = L / nS; for (let j = 0; j < nS; j++) { DYUI.spring(D, [-0.2 + sup + j * seg, y + 0.15], [-0.2 + sup + (j + 1) * seg, y + 0.15], { n: 6, w: 0.08 }); if (j) D.circle([-0.2 + sup + j * seg, y + 0.15], 0.04, { fill: K.ink }); } }
          else DYUI.spring(D, [-0.2 + sup, y + (damped ? 0.1 : 0.2)], [left, y + (damped ? 0.1 : 0.2)], { n: 8, w: 0.09 });
        }
        if (damped) DYUI.damper(D, [-0.2 + sup, 0.28], [left, 0.28]);
        D.circle([left + 0.2, -0.0 + 0.0], 0.0001, {});
        [[left + 0.22, 0.08], [left + w - 0.22, 0.08]].forEach((p) => D.circle(p, 0.08, { fill: '#7f8c8d', stroke: K.edge, sw: 1 }));
        DYUI.block(D, [left + w / 2, 0.16], w, h, 0, { label: g.m ? 'm' : '' });
        if (g.exc === 'unb') { const c = [left + w / 2, 0.16 + h + 0.25], a = g.w0 * t; D.circle(c, 0.22, { fill: '#fff', stroke: K.edge, sw: 1.4 }); D.line(c, [c[0] + 0.2 * Math.cos(a), c[1] + 0.2 * Math.sin(a)], { stroke: K.ink, sw: 1.6 }); D.circle([c[0] + 0.2 * Math.cos(a), c[1] + 0.2 * Math.sin(a)], 0.06, { fill: K.force }); D.text(c, 'm₀', { dx: 28, dy: -8, color: K.force, size: 11.5 }); }
        if (g.exc === 'force') { const F = Math.sin(g.w0 * t), p = [left + w + 0.05, 0.16 + h / 2]; if (Math.abs(F) > 0.02) DYUI.vec(D, F > 0 ? p : [p[0] + 0.9 * Math.abs(F), p[1]], [Math.sign(F), 0], 70 * Math.abs(F), { color: K.force, label: lbl(opt, `F = ${fmt(g.F0 * F)} ${u.F}`, 'F'), size: 11.5, head: F < 0, ldy: -8 }); D.text([left + w + 0.1, 0.16 + h + 0.25], 'F₀ sin ω₀t', { color: K.force, size: 11.5 }); }
        if (dopt('eq', true)) { D.line([xe, -0.05], [xe, 1.9], { stroke: K.ink, sw: 1, dash: '5 4' }); D.text([xe, 1.95], 'equilibrium', { anchor: 'middle', color: K.ink, size: 11 }); if (Math.abs(dx) > 0.02) D.arrow([xe, -0.45], [xe + dx, -0.45], { color: K.pos, w: 2.2, head: 9 }); D.text([xe + dx / 2, -0.45], lbl(opt, `x = ${fmt(DY.fromBase(x, 'S', u))} ${u.S}`, 'x'), { anchor: 'middle', dy: 18, color: K.pos, size: 12 }); }
      } else {
        D = UI.Draw2D(svg, { xmin: -2.2, xmax: 2.6, ymin: -0.6, ymax: 3.6 }, { pad: 30 });
        const sup = g.exc === 'support' ? (DY.toBase(+S().d0, 'S', u) * k) * Math.sin(g.w0 * t) : 0, ye = 1.9, w = 1.8, h = 0.8, bot = ye - h / 2 + dx;
        DYUI.ground(D, [-2.2, 0], [2.6, 0]);
        if (g.exc === 'support') { D.poly([[-1.3, 0.02 + sup], [1.3, 0.02 + sup], [1.3, 0.22 + sup], [-1.3, 0.22 + sup]], { fill: '#d5dbe1', stroke: K.edge, sw: 1.4 }); D.text([1.4, 0.15 + sup], 'δ₀ sin ω₀t', { color: K.force, size: 11.5 }); }
        const base = g.exc === 'support' ? 0.22 + sup : 0, nS = Math.min(g.arr === 'series' ? 1 : g.n || 1, 4);
        for (let i = 0; i < nS; i++) { const xx = -0.6 + (nS === 1 ? 0.6 : (1.2 * i) / (nS - 1)); DYUI.spring(D, [xx * (g.damped ? 1.2 : 1) - (g.damped ? 0.25 : 0), base], [xx * (g.damped ? 1.2 : 1) - (g.damped ? 0.25 : 0), bot], { n: 8, w: 0.1 }); }
        if (g.damped) DYUI.damper(D, [0.85, base], [0.85, bot]);
        DYUI.block(D, [0, bot], w, h, 0, { label: 'm' });
        if (g.exc === 'unb') { const c = [0, bot + h + 0.3], a = g.w0 * t; D.circle(c, 0.25, { fill: '#fff', stroke: K.edge, sw: 1.4 }); D.line(c, [c[0] + 0.22 * Math.cos(a), c[1] + 0.22 * Math.sin(a)], { stroke: K.ink, sw: 1.6 }); D.circle([c[0] + 0.22 * Math.cos(a), c[1] + 0.22 * Math.sin(a)], 0.07, { fill: K.force }); D.text(c, lbl(opt, `m₀ at e, ω₀ = ${fmt(g.w0)} rad/s`, 'm₀'), { dx: 30, dy: 4, color: K.force, size: 11.5 }); }
        if (g.exc === 'force') { const F = Math.sin(g.w0 * t), p = [0, bot + h + 0.05]; if (Math.abs(F) > 0.02) DYUI.vec(D, F > 0 ? p : [p[0], p[1] + 0.9 * Math.abs(F)], [0, Math.sign(F)], 70 * Math.abs(F), { color: K.force, label: lbl(opt, `F = ${fmt(g.F0 * F)} ${u.F}`, 'F'), size: 11.5, head: F < 0, ldx: 10 }); }
        if (dopt('eq', true)) { D.line([-1.5, ye], [1.5, ye], { stroke: K.ink, sw: 1, dash: '5 4' }); D.text([-1.55, ye], 'equilibrium', { anchor: 'end', dy: 4, color: K.ink, size: 11 }); if (Math.abs(dx) > 0.02) D.arrow([-1.25, ye], [-1.25, ye + dx], { color: K.pos, w: 2.2, head: 9 }); D.text([-1.3, ye + dx], lbl(opt, `x = ${fmt(DY.fromBase(x, 'S', u))} ${u.S}`, 'x'), { anchor: 'end', dy: dx > 0 ? -4 : 14, color: K.pos, size: 12 }); }
      }
      if (dopt('exag', true) && Math.abs(k - 1) > 0.01) D.text([D.W - 12, D.H - 12], 'motion drawn to a larger scale', { px: true, anchor: 'end', color: '#5a6b75', size: 11, weight: 500 });
      if (g.impact && !vert && t < 0.04 * g.span[1] + 1e-9) { const yb = 0.16 + 0.45; D.circle([2.6 - 0.55 + dx + 1.1 + 0.5, yb], 0.06, { fill: K.force }); DYUI.vec(D, [2.6 + 0.55 + dx + 0.56, yb], [-1, 0], 40, { color: K.force, label: 'projectile', size: 11, anchor: 'start', ldx: 4, ldy: -8 }); }
      circuit(D, g); head(); return true;
    }
    if (g.sys === 'pend' || g.sys === 'comp') {
      D = UI.Draw2D(svg, { xmin: -2.4, xmax: 2.4, ymin: -3.6, ymax: 0.8 }, { pad: 30 });
      const k = scaleOf(g), th = x * k, Ld = g.sys === 'pend' ? 3 : 2.6;
      D.poly([[-0.8, 0], [0.8, 0], [0.8, 0.25], [-0.8, 0.25]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1 });
      const P = (r, a) => [r * Math.sin(a), -r * Math.cos(a)];
      if (dopt('eq', true)) { D.line([0, 0], [0, -Ld - 0.4], { stroke: K.ink, sw: 1, dash: '5 4' }); if (Math.abs(th) > 0.01) D.arc([0, 0], 60, -90, -90 + th / D2R, null, { color: K.pos }); D.text([0, -Ld - 0.4], lbl(opt, `θ = ${fmt(x / D2R)}°`, 'θ'), { dx: 8, dy: 4, color: K.pos, size: 12, weight: 700 }); }
      if (g.sys === 'pend') { D.line([0, 0], P(Ld, th), { stroke: K.ink, sw: 1.8 }); D.circle(P(Ld, th), 0.22, { fill: K.pos, stroke: '#fff', sw: 2 }); D.text(P(Ld, th), lbl(opt, `L = ${fmt(g.L)} ${u.L}`, 'L'), { dx: 18, dy: 4, color: K.ink, size: 11.5 }); }
      else if (g.body === 'rod' || g.body === 'kg') { const a = P(0, th), b = P(Ld, th), n = [Math.cos(th) * 0.1, Math.sin(th) * 0.1]; D.poly([[a[0] - n[0], a[1] - n[1]], [a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]]], { fill: BLK, stroke: K.edge, sw: 1.4 }); D.dot(P(g.body === 'rod' ? Ld / 2 : Ld * 0.6, th), K.ink, 'G', { r: 4 }); }
      else { const R = 1.2, c = P(R, th); D.circle(c, R, { fill: g.body === 'disk' ? BLK : 'none', stroke: K.edge, sw: g.body === 'disk' ? 1.4 : 5 }); D.dot(c, K.ink, 'G', { r: 4 }); }
      D.circle([0, 0], 0.07, { fill: '#fff', stroke: K.ink, sw: 1.6 }); D.text([0, 0], 'O', { dx: 10, dy: -6, color: K.ink, size: 12 });
      if (dopt('exag', true) && Math.abs(k - 1) > 0.01) D.text([D.W - 12, D.H - 12], `angles drawn ×${fmt(k, 2)}`, { px: true, anchor: 'end', color: '#5a6b75', size: 11, weight: 500 });
      head(); return true;
    }
    if (g.sys === 'tors') {
      D = UI.Draw2D(svg, { xmin: -2.2, xmax: 2.2, ymin: -2.2, ymax: 2.2 }, { pad: 30 });
      const k = scaleOf(g), th = x * k, R = (p) => DYUI.rot(p, [0, 0], th);
      DYUI.title(D, 12, 40, 'Top view: the body turns about the rod', { size: 11.5, weight: 500 });
      if (g.body === 'plate') { const a = 1.6, b = a * (g.b / g.a || 1.5); const s2 = Math.min(1, 3.4 / Math.max(a, b)); D.poly([[-a / 2 * s2, -b / 2 * s2], [a / 2 * s2, -b / 2 * s2], [a / 2 * s2, b / 2 * s2], [-a / 2 * s2, b / 2 * s2]].map(R), { fill: BLK, stroke: K.edge, sw: 1.6 }); }
      else DYUI.wheel(D, [0, 0], 1.6, th + Math.PI / 2, { spokes: 4 });
      if (dopt('eq', true)) { D.line([0, 0], [0, 2], { stroke: K.ink, sw: 1, dash: '5 4' }); D.line([0, 0], R([0, 2]), { stroke: K.pos, sw: 2 }); if (Math.abs(th) > 0.01) { D.arc([0, 0], 70, 90, 90 + th / D2R, null, { color: K.pos }); D.text([0, 2], lbl(opt, `θ = ${fmt(x / D2R)}°`, 'θ'), { color: K.pos, anchor: th > 0 ? 'start' : 'end', dx: th > 0 ? 8 : -8, dy: 4, size: 12 }); } }
      D.circle([0, 0], 0.12, { fill: '#7f8c8d', stroke: K.ink, sw: 1.2 });
      head(); return true;
    }
    if (g.sys === 'bar') {
      D = UI.Draw2D(svg, { xmin: -0.8, xmax: 4.6, ymin: -1.8, ymax: dopt('circ', false) ? 2.8 : 1.6 }, { pad: 30 }); // room above for the circuit inset
      const k = scaleOf(g), th = x * k, Ld = 4, P = (r) => [r * Math.cos(th), r * Math.sin(th)], ya = (g.a / g.L) * Ld, yb = (g.b / g.L) * Ld;
      D.poly([[-0.7, -0.6], [-0.3, -0.6], [-0.3, 0.6], [-0.7, 0.6]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1 });
      DYUI.ground(D, [-0.2, -1.5], [4.5, -1.5]);
      if (dopt('eq', true)) D.line([0, 0], [Ld + 0.3, 0], { stroke: K.ink, sw: 1, dash: '5 4' });
      DYUI.spring(D, [ya, -1.5], P(ya), { n: 8, w: 0.1 });
      if (g.damped && g.b > 0) DYUI.damper(D, [yb, -1.5], P(yb));
      const n = [-Math.sin(th) * 0.09, Math.cos(th) * 0.09], b0 = P(0), b1 = P(Ld);
      D.poly([[b0[0] - n[0], b0[1] - n[1]], [b1[0] - n[0], b1[1] - n[1]], [b1[0] + n[0], b1[1] + n[1]], [b0[0] + n[0], b0[1] + n[1]]], { fill: BLK, stroke: K.edge, sw: 1.4 });
      D.circle([0, 0], 0.07, { fill: '#fff', stroke: K.ink, sw: 1.6 }); D.text([0, 0], 'A', { dx: -6, dy: -10, color: K.ink, size: 12, anchor: 'end' });
      D.text(P(ya), lbl(opt, `k at a = ${fmt(g.a)} ${u.L}`, 'k'), { dx: 6, dy: -12, color: K.ink, size: 11.5 });
      if (g.damped && g.b > 0) D.text(P(yb), lbl(opt, `c at b = ${fmt(g.b)} ${u.L}`, 'c'), { dx: -6, dy: -12, anchor: 'end', color: K.ink, size: 11.5 });
      if (dopt('eq', true) && Math.abs(th) > 0.01) { D.arc([0, 0], 70, 0, th / D2R, null, { color: K.pos }); D.text([Ld + 0.3, 0], lbl(opt, `θ = ${fmt(x / D2R)}°`, 'θ'), { dx: 4, dy: 4, color: K.pos, size: 12, weight: 700, anchor: 'start' }); }
      if (dopt('exag', true) && Math.abs(k - 1) > 0.01) D.text([D.W - 12, D.H - 12], `angles drawn ×${fmt(k, 2)}`, { px: true, anchor: 'end', color: '#5a6b75', size: 11, weight: 500 });
      circuit(D, g); head(); return true;
    }
    if (g.sys === 'pulley') {
      D = UI.Draw2D(svg, { xmin: -2.6, xmax: 2.6, ymin: -3.4, ymax: 1.6 }, { pad: 30 });
      const k = scaleOf(g, 0.5), s = x * k, R0 = 1.1, rb = R0 * Math.min(1, g.rb / Math.max(g.rb, g.rs)), rs = R0 * Math.min(1, g.rs / Math.max(g.rb, g.rs)), th = -s / rb;
      D.line([0, 0], [0, 1.2], { stroke: K.ink, sw: 3 }); D.poly([[-0.6, 1.2], [0.6, 1.2], [0.6, 1.45], [-0.6, 1.45]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1 });
      DYUI.wheel(D, [0, 0], R0, th, { spokes: 3, ri: rb < R0 - 1e-6 ? rb : null });
      D.line([-rb, 0], [-rb, -1.9 + -s], { stroke: K.ink, sw: 1.6 });
      DYUI.block(D, [-rb, -2.5 - s], 0.9, 0.6, 0, { label: 'm_b' });
      DYUI.spring(D, [rs, 0], [rs, -2.6], { n: 9, w: 0.12 });
      DYUI.ground(D, [rs - 0.5, -2.6], [rs + 0.5, -2.6]);
      if (dopt('eq', true)) { D.line([-rb - 0.7, -1.9], [-rb + 0.7, -1.9], { stroke: K.ink, sw: 1, dash: '5 4' }); if (Math.abs(s) > 0.02) D.arrow([-rb - 0.75, -1.9], [-rb - 0.75, -1.9 - s], { color: K.pos, w: 2, head: 8 }); D.text([-rb - 0.8, -1.9 - s / 2], lbl(opt, `s = ${fmt(DY.fromBase(x, 'S', u))} ${u.S}`, 's'), { anchor: 'end', color: K.pos, size: 11.5 }); }
      head(); return true;
    }
    // cylinder rolling against a spring
    D = UI.Draw2D(svg, { xmin: -0.6, xmax: 5, ymin: -0.6, ymax: 2.4 }, { pad: 30 });
    const k = scaleOf(g, 0.6), s = x * k, R0 = 0.8, xe = 2.8;
    DYUI.ground(D, [-0.6, 0], [5, 0]);
    D.poly([[-0.5, 0], [-0.2, 0], [-0.2, 1.8], [-0.5, 1.8]], { fill: 'url(#hatch)', stroke: K.edge, sw: 1 });
    DYUI.spring(D, [-0.2, R0], [xe + s, R0], { n: 9, w: 0.1 });
    DYUI.wheel(D, [xe + s, R0], R0, -s / R0, { spokes: 4 });
    if (dopt('eq', true)) { D.line([xe, -0.05], [xe, 2.1], { stroke: K.ink, sw: 1, dash: '5 4' }); if (Math.abs(s) > 0.02) D.arrow([xe, -0.35], [xe + s, -0.35], { color: K.pos, w: 2.2, head: 9 }); D.text([xe + s / 2, -0.35], lbl(opt, `x = ${fmt(DY.fromBase(x, 'S', u))} ${u.S}`, 'x'), { anchor: 'middle', dy: 16, color: K.pos, size: 12 }); }
    head(); return true;
  };

  /* Charts: x(t), and the magnification factor curve for forced vibration */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u, n = 600, T1 = g.span[1], cur = S()._u === undefined ? NaN : tNow(g);
    const conv = (v) => (g.rot ? v / D2R : DY.fromBase(v, 'S', u)), yl = g.rot ? 'θ (°)' : `x (${u.S})`;
    const pts = []; for (let i = 0; i <= n; i++) { const t = (T1 * i) / n; pts.push([t, conv(g.x(t))]); }
    const { W, H } = Charts.clear(svg), forced = g.exc !== 'free';
    const h1 = forced ? (H - 70) * 0.55 : H - 54;
    let ymin = 0, ymax = 0; pts.forEach(([, y]) => { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    if (dopt('envl', true) && g.env && g.exc === 'free') { const e0 = Math.abs(conv(g.env(0))); if (isFinite(e0)) { ymin = Math.min(ymin, -e0); ymax = Math.max(ymax, e0); } }
    const F = Charts.frame(svg, { x: 66, y: 12, w: W - 84, h: h1, xmin: 0, xmax: T1, ymin, ymax, xlabel: 't (s)', ylabel: yl, ycolor: K.pos });
    if (dopt('envl', true) && g.env && g.exc === 'free') { const e1 = [], e2 = []; for (let i = 0; i <= 120; i++) { const t = (T1 * i) / 120; e1.push([t, conv(g.env(t))]); e2.push([t, -conv(g.env(t))]); } Charts.curve(F, e1, { color: '#7f8c8d', width: 1.2, dash: '5 4' }); Charts.curve(F, e2, { color: '#7f8c8d', width: 1.2, dash: '5 4' }); }
    if (dopt('envl', true) && forced) { const sp = []; for (let i = 0; i <= n; i++) { const t = (T1 * i) / n; sp.push([t, conv(g.xp(t))]); } Charts.curve(F, sp, { color: '#7f8c8d', width: 1.2, dash: '5 4' }); }
    Charts.curve(F, pts, { color: K.pos, width: 2.2 });
    if (isFinite(cur)) { const X = F.X(cur); UI.svgEl('line', { x1: X, y1: 12, x2: X, y2: 12 + h1, stroke: K.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, F.g); Charts.mark(F, cur, conv(g.x(cur)), null, { color: K.pos }); }
    if (forced) {
      const rmax = Math.max(3, g.r * 1.3), z = g.zeta, mf = (r) => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2), cap = Math.max(6, g.MF * 1.6), cps = [];
      for (let i = 0; i <= 400; i++) { const r = (rmax * i) / 400; cps.push([r, Math.min(mf(r), cap)]); }
      const F2 = Charts.frame(svg, { x: 66, y: 12 + h1 + 46, w: W - 84, h: H - h1 - 46 - 46, xmin: 0, xmax: rmax, ymin: 0, ymax: cap, xlabel: 'ω₀/ω_n', ylabel: 'MF', ycolor: K.acc });
      [0.1, 0.25, 0.5].filter((zz) => Math.abs(zz - z) > 0.02).forEach((zz) => { const q = []; for (let i = 0; i <= 300; i++) { const r = (rmax * i) / 300; q.push([r, Math.min(1 / Math.sqrt((1 - r * r) ** 2 + (2 * zz * r) ** 2), cap)]); } Charts.curve(F2, q, { color: '#c3cbd3', width: 1.2 }); });
      Charts.curve(F2, cps, { color: K.acc, width: 2.4 });
      Charts.mark(F2, g.r, Math.min(g.MF, cap), `ω₀/ω_n = ${fmt(g.r)}, MF = ${fmt(g.MF)}`, { color: K.ink, anchor: g.r > rmax * 0.6 ? 'end' : 'start', dx: g.r > rmax * 0.6 ? -8 : 8, dy: -16 });
      UI.svgEl('line', { x1: F2.X(1), y1: F2.Y(0), x2: F2.X(1), y2: F2.Y(cap), stroke: '#c0392b', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, F2.g);
      Charts.text(F2.g, F2.X(1) + 4, F2.Y(cap) + 12, 'resonance', { color: '#c0392b', size: 10.5 });
    }
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  function spring3(v, a, b, r, n, col) {
    const d = DYUI.sub(b, a), L = Math.hypot(...d), e = DYUI.mul(d, 1 / L), t = Math.abs(e[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = DYUI.nrm(DYUI.cross(e, t)), e2 = DYUI.cross(e, e1), pts = [];
    for (let i = 0; i <= n * 12; i++) { const s = i / (n * 12), a2 = s * n * 2 * Math.PI; pts.push(DYUI.add(DYUI.add(a, DYUI.mul(e, s * L)), DYUI.add(DYUI.mul(e1, r * Math.cos(a2)), DYUI.mul(e2, r * Math.sin(a2))))); }
    v.line(pts, col || SPR, 1.8);
  }
  function cylZ(v, c, R, depth, th, fill) {
    // a disk with its axis along z, turned by th
    const n = 32, f = [], b = [];
    for (let i = 0; i < n; i++) { const a = th + (i / n) * 2 * Math.PI; f.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a), c[2] + depth / 2]); b.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a), c[2] - depth / 2]); }
    v.face(f, fill, 1, K.edge, 1, 0, [0, 0, 1]); v.face(b.slice().reverse(), fill, 1, K.edge, 1, 0, [0, 0, -1]);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, am = th + ((i + 0.5) / n) * 2 * Math.PI; v.face([f[i], f[j], b[j], b[i]], fill, 1, null, 1, 0, [Math.cos(am), Math.sin(am), 0]); }
    v.line([[c[0], c[1], c[2] + depth / 2 + 0.001], [c[0] + R * Math.cos(th), c[1] + R * Math.sin(th), c[2] + depth / 2 + 0.001]], K.ink, 2);
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, t = tNow(g), x = g.x(t);
    if (g.sys === 'sm') {
      const k = scaleOf(g, 0.5), dx = x * k, vert = g.vert || dopt('lay', 'h') === 'v';
      const sup = g.exc === 'support' ? (DY.toBase(+S().d0, 'S', g.u) * k) * Math.sin(g.w0 * t) : 0;
      if (!vert) {
        DYUI.floor3(v, -0.6, 5, 0, 1.2);
        v.box(-0.5 + sup, 0, -1, -0.2 + sup, 1.7, 1, '#d5dbe1', 1, K.edge);
        const left = 2.6 - 0.55 + dx;
        v.box(left, 0.02, -0.6, left + 1.1, 0.92, 0.6, BLK, 1, K.edge);
        spring3(v, [-0.2 + sup, 0.6, 0.25], [left, 0.6, 0.25], 0.1, 8);
        if (g.damped) { v.line([[-0.2 + sup, 0.35, -0.25], [left, 0.35, -0.25]], SPR, 2); v.box(0.8 + sup * 0.5, 0.25, -0.35, 1.5 + dx * 0.5, 0.45, -0.15, '#7f8c8d', 1, K.edge); }
        if (g.exc === 'force') { const F = Math.sin(g.w0 * t); if (Math.abs(F) > 0.02) DYUI.arrow3(v, [left + 1.1, 0.5, 0], [left + 1.1 + F * 0.9, 0.5, 0], K.force, 2.6); }
        v.setBounds([-0.7, -0.2, -1.2], [5, 2, 1.2]);
      } else {
        DYUI.floor3(v, -1.6, 1.6, 0, 1.4);
        if (g.exc === 'support') v.box(-1.3, sup, -1, 1.3, 0.2 + sup, 1, '#d5dbe1', 1, K.edge);
        const base = g.exc === 'support' ? 0.2 + sup : 0, bot = 1.5 + dx;
        [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]].slice(0, Math.max(1, Math.min(4, g.arr === 'series' ? 1 : g.n || 1))).forEach(([xx, zz]) => spring3(v, [xx, base, zz], [xx, bot, zz], 0.12, 7));
        v.box(-0.9, bot, -0.8, 0.9, bot + 0.8, 0.8, BLK, 1, K.edge);
        if (g.exc === 'unb') { cylZ(v, [0, bot + 1.15, 0.85], 0.3, 0.1, g.w0 * t, '#d5dbe1'); }
        if (g.exc === 'force') { const F = Math.sin(g.w0 * t); if (Math.abs(F) > 0.02) DYUI.arrow3(v, [0, bot + 0.8, 0], [0, bot + 0.8 + F * 0.9, 0], K.force, 2.6); }
        v.setBounds([-1.6, -0.2, -1.4], [1.6, 3.2, 1.4]);
      }
      return;
    }
    if (g.sys === 'pend' || g.sys === 'comp') {
      const k = scaleOf(g), th = x * k, Ld = g.sys === 'pend' ? 3 : 2.6, P = (r) => [r * Math.sin(th), -r * Math.cos(th), 0];
      v.box(-0.8, 0, -0.5, 0.8, 0.25, 0.5, '#d5dbe1', 1, K.edge);
      if (g.sys === 'pend') { v.line([[0, 0, 0], P(Ld)], K.ink, 1.8); DYUI.sphere(v, P(Ld), 0.22, K.pos); }
      else if (g.body === 'rod' || g.body === 'kg') { const n = [Math.cos(th) * 0.1, Math.sin(th) * 0.1], a = P(0), b = P(Ld); const q = [[a[0] - n[0], a[1] - n[1]], [a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]]]; v.extrude(q, -0.1, 0.1, BLK, 1, K.edge); }
      else if (g.body === 'disk') cylZ(v, P(1.2), 1.2, 0.2, th, BLK);
      else { const c = P(1.2), pts = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * 2 * Math.PI; pts.push([c[0] + 1.2 * Math.cos(a), c[1] + 1.2 * Math.sin(a), 0]); } v.line(pts, K.edge, 5); }
      v.setBounds([-2.4, -3.6, -1], [2.4, 0.4, 1]);
      return;
    }
    if (g.sys === 'tors') {
      const k = scaleOf(g), th = x * k;
      v.box(-0.8, 3, -0.8, 0.8, 3.2, 0.8, '#d5dbe1', 1, K.edge);
      v.box(-0.05, 0.3, -0.05, 0.05, 3, 0.05, '#7f8c8d', 1, null);
      const a = 1.6, b = g.body === 'plate' ? a * (g.b / g.a || 1.5) : a, c = Math.cos(th), s = Math.sin(th);
      if (g.body === 'plate') { const s2 = Math.min(1, 3 / Math.max(a, b)), q = [[-a / 2, -b / 2], [a / 2, -b / 2], [a / 2, b / 2], [-a / 2, b / 2]].map(([p, r]) => [(p * c - r * s) * s2, -(p * s + r * c) * s2]); v.extrudeY(q, 0, 0.15, BLK, 1, K.edge); }
      else { const q = []; for (let i = 0; i < 32; i++) { const aa = (i / 32) * 2 * Math.PI; q.push([1.4 * Math.cos(aa), 1.4 * Math.sin(aa)]); } v.extrudeY(q, 0, 0.15, BLK, 1, null); v.line([[0, 0.16, 0], [1.4 * Math.cos(th), 0.16, -1.4 * Math.sin(th)]], K.ink, 2); }
      v.setBounds([-2, -0.2, -2], [2, 3.3, 2]);
      return;
    }
    if (g.sys === 'bar') {
      const k = scaleOf(g), th = x * k, Ld = 4, P = (r) => [r * Math.cos(th), r * Math.sin(th)], ya = (g.a / g.L) * Ld, yb = (g.b / g.L) * Ld;
      v.box(-0.7, -0.6, -0.5, -0.3, 0.6, 0.5, '#d5dbe1', 1, K.edge); DYUI.floor3(v, -0.3, 4.5, -1.5, 0.8);
      const n = [-Math.sin(th) * 0.09, Math.cos(th) * 0.09], b0 = P(0), b1 = P(Ld);
      v.extrude([[b0[0] - n[0], b0[1] - n[1]], [b1[0] - n[0], b1[1] - n[1]], [b1[0] + n[0], b1[1] + n[1]], [b0[0] + n[0], b0[1] + n[1]]], -0.15, 0.15, BLK, 1, K.edge);
      spring3(v, [ya, -1.5, 0], [...P(ya), 0], 0.1, 8);
      if (g.damped && g.b > 0) { const q = P(yb); v.box(yb - 0.08, -1.5, -0.08, yb + 0.08, (q[1] - 1.5) / 2, 0.08, '#7f8c8d', 1, K.edge); v.line([[yb, (q[1] - 1.5) / 2, 0], [q[0], q[1], 0]], SPR, 2); }
      v.setBounds([-0.8, -1.6, -0.8], [4.5, 1, 0.8]);
      return;
    }
    if (g.sys === 'pulley') {
      const k = scaleOf(g, 0.5), s = x * k, R0 = 1.1, rb = R0 * Math.min(1, g.rb / Math.max(g.rb, g.rs)), rs = R0 * Math.min(1, g.rs / Math.max(g.rb, g.rs));
      cylZ(v, [0, 0, 0], R0, 0.3, -s / rb, '#d5dbe1');
      v.box(-0.6, 1.2, -0.3, 0.6, 1.45, 0.3, '#d5dbe1', 1, K.edge); v.line([[0, 0, 0], [0, 1.2, 0]], K.ink, 3);
      v.line([[-rb, 0, 0], [-rb, -1.9 - s, 0]], K.ink, 1.6);
      v.box(-rb - 0.45, -2.5 - s, -0.3, -rb + 0.45, -1.9 - s, 0.3, BLK, 1, K.edge);
      spring3(v, [rs, -2.6, 0], [rs, 0, 0], 0.1, 9); v.box(rs - 0.5, -2.75, -0.4, rs + 0.5, -2.6, 0.4, '#d5dbe1', 1, K.edge);
      v.setBounds([-2.2, -3.2, -1], [2.2, 1.6, 1]);
      return;
    }
    const k = scaleOf(g, 0.6), s = x * k, R0 = 0.8;
    DYUI.floor3(v, -0.6, 5, 0, 1.2);
    v.box(-0.5, 0, -1, -0.2, 1.8, 1, '#d5dbe1', 1, K.edge);
    spring3(v, [-0.2, R0, 0], [2.8 + s, R0, 0], 0.1, 9);
    cylZ(v, [2.8 + s, R0, 0], R0, 1.2, -s / R0, BLK);
    v.setBounds([-0.7, -0.2, -1.2], [5, 2.2, 1.2]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(Vib.defaults(), o);
  M.presets = [
    { name: 'Test: Book Example 22.2, 10 kg plate 0.2 m × 0.3 m on a rod of 1.5 N·m/rad (τ = 1.69 s)', units: 'SI', state: P0({ sys: 'tors', body: 'plate', m: 10, a: 0.2, b: 0.3, kt: 1.5, th0: 10 }),
      expect: [{ k: 'Moment of inertia I_O', v: 0.1083 }, { k: 'Period τ', v: 1.69 }] },
    { name: 'Test: Book Example 22.4, 10 lb block on a 15 lb disk, k = 200 lb/ft (τ = 0.328 s)', units: 'US', state: P0({ sys: 'pulley', mb: 10, md: 15, rb: 0.75, rs: 0.75, k: 200, x0: 1, v0: 0 }),
      expect: [{ k: 'Period τ', v: 0.328 }] },
    { name: 'Test: Book Example 22.6, 10 kg block on a 5 kg disk, k = 200 N/m (τ = 1.57 s)', units: 'SI', state: P0({ sys: 'pulley', mb: 10, md: 5, rb: 0.15, rs: 0.15, k: 200, x0: 40, v0: 0 }),
      expect: [{ k: 'Natural frequency ω_n', v: 4 }, { k: 'Period τ', v: 1.571 }] },
    { name: 'Test: Book Example 22.7, 20 kg on four 800 N/m springs, floor 10 sin 8t mm (X = 16.7 mm)', units: 'SI', state: P0({ sys: 'sm', m: 20, k: 800, n: 4, arr: 'parallel', vert: true, exc: 'support', w0: 8, d0: 10, x0: 0, v0: 0 }),
      expect: [{ k: 'Natural frequency ω_n', v: 12.65 }, { k: 'Steady-state amplitude X', v: 16.67 }] },
    { name: 'Test: Book Example 22.8, 30 kg motor on four 200 N/m springs, 4 kg at 60 mm, ζ = 0.15 (X = 10.7 mm)', units: 'SI', state: P0({ sys: 'sm', m: 30, k: 200, n: 4, arr: 'parallel', vert: true, damp: 'z', zeta: 0.15, exc: 'unb', m0: 4, e: 60, w0: 10, x0: 0, v0: 0 }),
      expect: [{ k: 'Force amplitude F₀', v: 24 }, { k: 'Natural frequency ω_n', v: 5.164 }, { k: 'Steady-state amplitude X', v: 10.67 }] },
    { name: 'Test: 10 kg on 1000 N/m from x₀ = 50 mm, v₀ = 0.5 m/s (τ = 0.628 s, C = 70.7 mm)', units: 'SI', state: P0({ sys: 'sm', m: 10, k: 1000, n: 1, x0: 50, v0: 0.5 }),
      expect: [{ k: 'Natural frequency ω_n', v: 10 }, { k: 'Period τ', v: 0.6283 }, { k: 'Amplitude C', v: 70.71 }] },
    { name: 'Test: the same with c = 40 N·s/m (ζ = 0.2, ω_d = 9.80 rad/s)', units: 'SI', state: P0({ sys: 'sm', m: 10, k: 1000, n: 1, x0: 50, v0: 0.5, damp: 'c', c: 40 }),
      expect: [{ k: 'Critical damping c_c', v: 200 }, { k: 'Damping factor ζ = c/c_c', v: 0.2 }, { k: 'Damped natural frequency ω_d', v: 9.798 }] },
    { name: 'Test: Problem 22–71, 10 kg, k = 60 N/m, c = 80 N·s/m, from 50 mm back to 2 mm (t = 3.99 s)', units: 'SI', state: P0({ sys: 'sm', m: 10, k: 60, n: 1, damp: 'c', c: 80, nc: 1, x0: 50, v0: 0, xt: 2 }),
      expect: [{ k: 'Time to reach x_t', v: 3.99 }] },
    { name: 'Test: Problem 22–73, 6-lb bar 5 ft, k = 8 lb/ft at 5 ft, c = 60 lb·s/ft at 3 ft (1.55θ̈ + 540θ̇ + 200θ = 0; critical c = 3.92 lb·s/ft)', units: 'US', state: P0({ sys: 'bar', m: 6, len: 5, k: 8, sa: 5, sb: 3, damp: 'c', c: 60, th0: 5 }),
      expect: [{ k: 'Moment of inertia I_A', v: 1.5528 }, { k: 'Equivalent damping c b²', v: 540 }, { k: 'Dashpot c for critical damping', v: 3.916 }] },
    { name: 'Test: Problem 22–76, 25 kg on three 100 N/m springs and two 200 N·s/m dampers (ÿ + 16ẏ + 12y = 0, overdamped)', units: 'SI', state: P0({ sys: 'sm', m: 25, k: 100, n: 3, arr: 'parallel', damp: 'c', c: 200, nc: 2, x0: 50, v0: 0 }),
      expect: [{ k: 'Damping coefficient c (all dampers)', v: 400 }, { k: 'Equivalent stiffness k_eq', v: 300 }, { k: 'Damping factor ζ = c/c_c', v: 2.309 }] },
    { name: 'Test: Problem 22–77, 20 kg on two 400 N/m springs, c = 125 N·s/m, F = 90 cos 6t N (x = 0.119 cos(6t − 83.9°) m)', units: 'SI', state: P0({ sys: 'sm', m: 20, k: 400, n: 2, arr: 'parallel', damp: 'c', c: 125, nc: 1, exc: 'force', F0: 90, w0: 6, x0: 0, v0: 0 }),
      expect: [{ k: 'Steady-state amplitude X', v: 119.3 }, { k: 'Phase angle φ′', v: 83.91 }] },
    { name: 'Problem 22–75 type: 20 g bullet at 400 m/s embeds in a 2 kg target on two 500 N/m springs with a light dashpot (largest compression)', units: 'SI', state: P0({ sys: 'sm', m: 2, k: 500, n: 2, arr: 'parallel', damp: 'c', c: 10, nc: 1, exc: 'impact', mp: 0.02, vp: 400, x0: 0, v0: 0 }),
      expect: [{ k: 'Largest displacement x_max', v: 151.17 }] },
    { name: 'Simple pendulum 2 m long released at 8°', units: 'SI', state: P0({ sys: 'pend', L: 2, th0: 8 }) },
    { name: 'Thin hoop of radius 0.5 m on a peg (Example 22.5 shape)', units: 'SI', state: P0({ sys: 'comp', body: 'hoop', m: 2, r: 0.5, th0: 6 }) },
    { name: 'Slender rod 3 ft long swinging on a pin at its end', units: 'US', state: P0({ sys: 'comp', body: 'rod', m: 8, len: 3, th0: 10 }) },
    { name: 'Cylinder rolling against a spring', units: 'SI', state: P0({ sys: 'roll', m: 20, r: 0.2, k: 600, x0: 60, v0: 0 }) },
    { name: 'Machine on two springs in series, overdamped', units: 'SI', state: P0({ sys: 'sm', m: 5, k: 2000, n: 2, arr: 'series', damp: 'z', zeta: 1.4, x0: 30, v0: 0 }) },
    { name: 'Edge: undamped forcing exactly at resonance (fails on purpose)', units: 'SI', fails: true, state: P0({ sys: 'sm', m: 10, k: 1000, n: 1, exc: 'force', F0: 20, w0: 10, x0: 0, v0: 0 }) },
  ];

  root.DVib = M;
})(window);
