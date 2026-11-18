/* =====================================================================
 * DYNAMICS · D4 Impact (inputs, diagrams, presets). Physics: dy/impact.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Impact, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a', BEF = '#111111', AFT = '#1e8449', D2R = Math.PI / 180;

  const M = { id: 'impact', title: 'Impact', defaults: Impact.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const ml = u.us ? 'weight W' : 'mass m';
    let sec = C.section(c, 'Kind of impact');
    C.select(sec, { label: 'Situation', get: () => st.mode, set: (v) => { st.mode = v; if (v === 'oblique' && st.find !== 'v') st.find = 'v'; if ((v === 'wall' || v === 'bounce') && st.find === 'plastic') st.find = 'v'; }, options: [
      ['central', 'Central impact of two bodies'], ['oblique', 'Oblique impact of two smooth disks'], ['wall', 'Ball striking a fixed wall or floor'], ['bounce', 'Ball dropped and bouncing on a floor']] });
    if (st.mode === 'central') C.seg(sec, { label: 'Find', get: () => st.find, set: (v) => (st.find = v), options: [['v', 'Velocities after'], ['plastic', 'They couple (e = 0)'], ['e', 'e from a measurement']] });
    if (st.mode === 'wall' || st.mode === 'bounce') C.seg(sec, { label: 'Find', get: () => (st.find === 'e' ? 'e' : 'v'), set: (v) => (st.find = v), options: [['v', st.mode === 'wall' ? 'Rebound' : 'Bounces'], ['e', st.mode === 'wall' ? 'e from the rebound angle' : 'e from the rebound height']] });

    if (st.mode === 'central') {
      sec = C.section(c, 'Body A (on the left)');
      num(sec, 'mA', 'A: ' + ml, u.M);
      C.seg(sec, { label: 'Velocity of A before impact', get: () => st.src, set: (v) => (st.src = v), options: [['given', 'Given'], ['drop', 'Falls or swings down a height h']] });
      if (st.src === 'drop') num(sec, 'hA', 'Height h', u.L); else num(sec, 'vA1', '(v_A)₁, + to the right', u.V);
      sec = C.section(c, 'Body B (on the right)');
      num(sec, 'mB', 'B: ' + ml, u.M); num(sec, 'vB1', '(v_B)₁, + to the right', u.V);
      sec = C.section(c, 'Collision');
      if (st.find === 'v') num(sec, 'e', 'Coefficient of restitution e', '');
      if (st.find === 'e') num(sec, 'vB2m', 'Measured (v_B)₂, + to the right', u.V);
      num(sec, 'dt', 'Contact time Δt (0 to skip the average force)', 's');
    } else if (st.mode === 'oblique') {
      C.note(c, 'x is the line of impact, from the centre of A to the centre of B. Directions are measured counterclockwise from +x.');
      sec = C.section(c, 'Disk A');
      num(sec, 'mA', 'A: ' + ml, u.M); num(sec, 'sA', 'Speed (v_A)₁', u.V); num(sec, 'thA', 'Direction θ_A', '°');
      sec = C.section(c, 'Disk B');
      num(sec, 'mB', 'B: ' + ml, u.M); num(sec, 'sB', 'Speed (v_B)₁', u.V); num(sec, 'thB', 'Direction θ_B', '°');
      sec = C.section(c, 'Collision');
      num(sec, 'e', 'Coefficient of restitution e', '');
    } else if (st.mode === 'wall') {
      sec = C.section(c, 'Ball and surface');
      C.seg(sec, { label: 'Surface', get: () => st.surf, set: (v) => (st.surf = v), options: [['wall', 'Wall'], ['floor', 'Floor']] });
      num(sec, 'v1', 'Speed before impact v₁', u.V); num(sec, 'th1', 'Angle of approach from the surface θ₁', '°');
      if (st.find === 'e') num(sec, 'th2', 'Measured rebound angle from the surface θ₂', '°'); else num(sec, 'e', 'Coefficient of restitution e', '');
    } else {
      sec = C.section(c, 'Ball');
      num(sec, 'h0', 'Dropped from rest at height h₀', u.L);
      if (st.find === 'e') num(sec, 'h1', 'Measured first rebound height h₁', u.L); else num(sec, 'e', 'Coefficient of restitution e', '');
      C.num(sec, { label: 'Bounces to show', get: () => st.nb, set: (v) => (st.nb = v), step: 1 });
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Velocity before impact', get: () => dopt('showB', true), set: (v) => (st.showB = v), rebuild: false });
    C.toggle(c, { label: 'Velocity after impact', get: () => dopt('showA2', true), set: (v) => (st.showA2 = v), rebuild: false });
    if (st.mode === 'oblique' || st.mode === 'wall') C.toggle(c, { label: 'Paths of the centres', get: () => dopt('paths', true), set: (v) => (st.paths = v), rebuild: false });
    if (st.mode === 'oblique' || st.mode === 'wall') C.toggle(c, { label: 'Components along the line of impact and the surface', get: () => dopt('comp', false), set: (v) => (st.comp = v), rebuild: false });
    if (st.mode === 'bounce') C.toggle(c, { label: 'Rebound heights', get: () => dopt('dims', true), set: (v) => (st.dims = v), rebuild: false });
  };

  M.compute = (U) => Impact.solve(S(), U);
  M.onUnits = (from, to) => Impact.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ central: 'Collision along a line', oblique: 'Oblique collision seen from above', wall: 'Ball and surface', bounce: 'Bouncing ball' }[S().mode]);
  M.cap3D = () => '3D view';
  M.plotCaption = () => (S().mode === 'bounce' ? 'Height of the ball against time' : S().mode === 'wall' ? 'Velocity components before and after' : 'Kinetic energy before and after');
  M.hint = () => (S().mode === 'bounce' ? 'Press Play to watch the ball bounce (the clock shows the real time).' : 'Press Play to watch the collision: the bodies close at their speeds before impact and separate at their speeds after it. The impact itself is treated as instantaneous.');
  M.legend = () => (S().mode === 'bounce' ? [[K.pos, 'Ball and its path'], [AFT, 'Velocity']] : S().mode === 'wall' ? [[BEF, 'Velocity before impact'], [AFT, 'Velocity after impact'], [CA, 'Ball and its path']] : [[BEF, 'Velocity before impact'], [AFT, 'Velocity after impact'], [CA, 'A'], [CB, 'B']]);

  /* Animation: u from 0 to 1. For collisions the impact is at u = ½ (τ = 2u − 1 from −1 to 1). */
  const anim = {
    duration: 10, loop: true,
    frame(uu) { const st = S(); if (uu <= 0) delete st._u; else st._u = uu; },
    label() {
      const st = S(), g = root.App && root.App.res && root.App.res.geo;
      if (st._u === undefined) return st.mode === 'bounce' ? 'released from rest' : 'just before and just after';
      if (g && g.mode === 'bounce') return `t = ${fmt(g.span[1] * st._u)} s of ${fmt(g.span[1])} s`;
      const tau = 2 * st._u - 1; return Math.abs(tau) < 0.02 ? 'impact' : tau < 0 ? 'before impact' : 'after impact';
    },
  };
  M.anim = () => anim;
  const uNow = () => S()._u;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const sp = (v) => Math.hypot(v[0], v[1]);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.mode === 'central') return central2D(svg, g, opt);
    if (g.mode === 'oblique') return oblique2D(svg, g, opt);
    if (g.mode === 'wall') return wall2D(svg, g, opt);
    return bounce2D(svg, g, opt);
  };
  const radii = (g) => { const mx = Math.max(g.mA, g.mB); return [0.45 + 0.35 * Math.cbrt(g.mA / mx), 0.45 + 0.35 * Math.cbrt(g.mB / mx)]; };
  const ball = (D, c, r, col, name) => { D.circle(c, r, { fill: col, stroke: '#fff', sw: 2 }); if (name) D.text(c, name, { anchor: 'middle', base: 'middle', color: '#fff', size: 13, weight: 700 }); };
  /** Velocity arrow along x on the outer side of a body (side −1: left of A, +1: right of B), at its centre height. */
  function hvec(D, c, r, v, vmax, col, lab, side) {
    const e = c[0] + side * (r + 6 / D.sc), y = c[1];
    if (!(Math.abs(v) > 1e-9 * vmax)) { D.text([e, y], lab ? lab.replace(/=.*/, '= 0') : '', { anchor: side < 0 ? 'end' : 'start', dy: 4, color: col, size: 11.5, weight: 700 }); return; }
    const L = (26 + 80 * Math.abs(v) / vmax) / D.sc, far = e + side * L, out = Math.sign(v) === side;
    D.arrow(out ? [e, y] : [far, y], out ? [far, y] : [e, y], { color: col, w: 2.6, head: 11 });
    if (lab) D.text([e, y], lab, { anchor: side < 0 ? 'end' : 'start', dy: -10, color: col, size: 11.5, weight: 700 });
  }
  /** Arrow arriving at a disk (head just outside its rim) or leaving it (tail at the rim). */
  const rim = (D, c, r, v, sgn) => { const l = sp(v) || 1; return [c[0] + (sgn * v[0] / l) * (r + 4 / D.sc), c[1] + (sgn * v[1] / l) * (r + 4 / D.sc)]; };
  const arrive = (D, c, r, v, L, o) => DYUI.vec(D, rim(D, c, r, v, -1), v, L, Object.assign({ head: true }, o));
  const leave = (D, c, r, v, L, o) => DYUI.vec(D, rim(D, c, r, v, 1), v, L, o);
  function central2D(svg, g, opt) {
    const u = g.u, [rA, rB] = radii(g), vmax = Math.max(Math.abs(g.A1[0]), Math.abs(g.B1[0]), Math.abs(g.A2[0]), Math.abs(g.B2[0]), 1e-9);
    const D = UI.Draw2D(svg, { xmin: -7.2, xmax: 7.2, ymin: -3.4, ymax: 3.4 }, { pad: 24 });
    const track = (y) => { D.line([-7, y], [7, y], { stroke: K.ink, sw: 1.4 }); for (let x = -7; x < 7; x += 0.5) D.line([x, y], [x - 0.25, y - 0.25], { stroke: '#7f8c8d', sw: 1 }); };
    const vt = (n, k, v) => lbl(opt, `(v_${n})${k} = ${fmt(v)} ${u.V}`, `(v_${n})${k}`);
    if (uNow() === undefined) {
      [[1.4, 'Just before impact', g.A1[0], g.B1[0], '₁', BEF, 'showB'], [-2.4, 'Just after impact', g.A2[0], g.B2[0], '₂', AFT, 'showA2']].forEach(([y, ttl, va, vb, k, col, key]) => {
        const ry = y; track(ry - Math.max(rA, rB));
        const cA = [-rA, ry - Math.max(rA, rB) + rA], cB = [rB, ry - Math.max(rA, rB) + rB];
        ball(D, cA, rA, CA, 'A'); ball(D, cB, rB, CB, 'B');
        D.text([-6.9, ry + 1.25], ttl, { color: K.ink, size: 12.5, weight: 700 });
        if (dopt(key, true)) {
          if (g.plastic && k === '₂') hvec(D, cB, rB, va, vmax, col, lbl(opt, `v₂ = ${fmt(va)} ${u.V}`, 'v₂'), 1);
          else { hvec(D, cA, rA, va, vmax, col, vt('A', k, va), -1); hvec(D, cB, rB, vb, vmax, col, vt('B', k, vb), 1); }
        }
      });
      D.text([6.9, 3.2], (opt.showP ? (g.plastic ? 'e = 0 (coupled)' : `e = ${fmt(g.e)}`) + ',  ' : '') + 'positive (+ →)', { anchor: 'end', color: K.ink, size: 12, weight: 700 });
      return true;
    }
    const tau = 2 * uNow() - 1, k = 3.6 / vmax, y0 = -0.6;
    const va = tau < 0 ? g.A1[0] : g.A2[0], vb = tau < 0 ? g.B1[0] : g.B2[0];
    const cA = [-rA + va * tau * k, y0 + rA], cB = [rB + vb * tau * k, y0 + rB];
    track(y0); ball(D, cA, rA, CA, 'A'); ball(D, cB, rB, CB, 'B');
    const col = tau < 0 ? BEF : AFT, key = tau < 0 ? 'showB' : 'showA2', kk = tau < 0 ? '₁' : '₂';
    if (dopt(key, true)) { hvec(D, cA, rA, va, vmax, col, vt('A', kk, va), -1); hvec(D, cB, rB, vb, vmax, col, vt('B', kk, vb), 1); }
    D.text([-6.9, 2.75], Math.abs(tau) < 0.02 ? 'Impact' : tau < 0 ? 'Before impact' : 'After impact', { color: K.ink, size: 12.5, weight: 700 });
    D.text([6.9, 2.75], 'positive (+ →)', { anchor: 'end', color: K.ink, size: 12, weight: 700 });
    return true;
  }
  function oblique2D(svg, g, opt) {
    const u = g.u, [rA, rB] = radii(g), vmax = Math.max(sp(g.A1), sp(g.B1), sp(g.A2), sp(g.B2), 1e-9), k = 3 / vmax;
    const cA0 = [-rA, 0], cB0 = [rB, 0];
    const D = UI.Draw2D(svg, { xmin: -5.2, xmax: 5.2, ymin: -4.2, ymax: 4.2 }, { pad: 24 });
    D.line([-5, 0], [5, 0], { stroke: K.ink, sw: 1, dash: '7 4' }); D.text([5, 0.18], 'x, line of impact', { anchor: 'end', color: K.ink, size: 11.5 });
    D.line([0, -4], [0, 4], { stroke: K.ink, sw: 1, dash: '3 4' }); D.text([0.12, 3.8], 'y, plane of contact', { color: K.ink, size: 11.5 });
    const pos = (c0, v1, v2, tau) => (tau < 0 ? [c0[0] + v1[0] * tau * k, c0[1] + v1[1] * tau * k] : [c0[0] + v2[0] * tau * k, c0[1] + v2[1] * tau * k]);
    if (dopt('paths', true)) [[cA0, g.A1, g.A2, CA], [cB0, g.B1, g.B2, CB]].forEach(([c0, v1, v2, col]) => {
      D.line(pos(c0, v1, v2, -1), c0, { stroke: col, sw: 1.4, dash: '6 4' }); D.line(c0, pos(c0, v1, v2, 1), { stroke: col, sw: 1.4, dash: '2 4' });
    });
    const L = (v) => 28 + 80 * sp(v) / vmax;
    const comp = (p, v, col) => { if (!dopt('comp', false)) return; [[v[0], 0], [0, v[1]]].forEach((w) => { if (sp(w) > 1e-9 * vmax) DYUI.vec(D, p, w, L(w) * 0.9, { color: col, w: 1.6, head: 8, dash: '4 3' }); }); };
    if (uNow() === undefined) {
      [[cA0, g.A1, g.A2, CA, 'A'], [cB0, g.B1, g.B2, CB, 'B']].forEach(([c0, v1, v2, col, n]) => {
        const r = n === 'A' ? rA : rB;
        ball(D, c0, r, col, n);
        if (dopt('showB', true) && sp(v1) > 1e-9 * vmax) arrive(D, c0, r, v1, L(v1), { color: BEF, label: lbl(opt, `(v_${n})₁ = ${fmt(sp(v1))} ${u.V} at ${fmt(Math.atan2(v1[1], v1[0]) / D2R)}°`, `(v_${n})₁`), size: 11.5, anchor: v1[0] > 0 ? 'end' : 'start', ldx: v1[0] > 0 ? -6 : 6, ldy: v1[1] > 0 ? 14 : -6 });
        if (dopt('showA2', true) && sp(v2) > 1e-9 * vmax) { leave(D, c0, r, v2, L(v2), { color: AFT, label: lbl(opt, `(v_${n})₂ = ${fmt(sp(v2))} ${u.V} at ${fmt(Math.atan2(v2[1], v2[0]) / D2R)}°`, `(v_${n})₂`), size: 11.5, anchor: v2[0] >= 0 ? 'start' : 'end', ldx: v2[0] >= 0 ? 6 : -6 }); comp(rim(D, c0, r, v2, 1), v2, AFT); }
      });
      DYUI.title(D, 12, 20, 'Disks at the instant of contact');
      return true;
    }
    const tau = 2 * uNow() - 1;
    [[cA0, g.A1, g.A2, CA, 'A', rA], [cB0, g.B1, g.B2, CB, 'B', rB]].forEach(([c0, v1, v2, col, n, r]) => {
      const p = pos(c0, v1, v2, tau), v = tau < 0 ? v1 : v2, show = tau < 0 ? dopt('showB', true) : dopt('showA2', true);
      ball(D, p, r, col, n);
      if (show) { DYUI.vec(D, p, v, L(v), { color: tau < 0 ? BEF : AFT, label: lbl(opt, `${fmt(sp(v))} ${u.V}`, ''), size: 11.5 }); comp(p, v, tau < 0 ? BEF : AFT); }
    });
    DYUI.title(D, 12, 20, Math.abs(tau) < 0.02 ? 'Impact' : tau < 0 ? 'Before impact' : 'After impact');
    return true;
  }
  function wall2D(svg, g, opt) {
    const u = g.u, wallMode = g.surf !== 'floor', r = 0.35, vmax = Math.max(g.v1, g.v2, 1e-9), k = 3.4 / vmax;
    const vt = g.vt, n1 = g.vn1, n2 = g.vn2;
    // t, n frame → world: floor (t → +x, n → +y); wall (t → +y, n → −x, wall face at x = 0)
    const W = (t, n) => (wallMode ? [-n, t] : [t, n]);
    const D = UI.Draw2D(svg, wallMode ? { xmin: -4.6, xmax: 1, ymin: -3.9, ymax: 3.9 } : { xmin: -4.2, xmax: 4.2, ymin: -0.8, ymax: 3.9 }, { pad: 26 });
    if (wallMode) { D.poly([[0, -3.8], [0.5, -3.8], [0.5, 3.8], [0, 3.8]], { fill: '#d5dbe1', stroke: K.ink, sw: 1.4 }); for (let y = -3.8; y < 3.4; y += 0.4) D.line([0, y], [0.4, y + 0.4], { stroke: '#7f8c8d', sw: 1 }); }
    else DYUI.ground(D, [-4.1, 0], [4.1, 0], 0);
    const path = (tau) => (tau < 0 ? W(vt * tau * k, -n1 * tau * k + r) : W(vt * tau * k, n2 * tau * k + r));
    if (dopt('paths', true)) { D.line(path(-1), path(0), { stroke: CA, sw: 1.4, dash: '6 4' }); D.line(path(0), path(1), { stroke: CA, sw: 1.4, dash: '2 4' }); }
    const d1 = W(vt, -n1), d2 = W(vt, n2), L = (v) => 30 + 80 * v / vmax;
    const comp = (p, tn, col) => { if (!dopt('comp', false)) return; [[tn[0], 0], [0, tn[1]]].forEach(([a, b]) => { const w = W(a, b); if (sp(w) > 1e-9 * vmax) DYUI.vec(D, p, w, L(sp(w)) * 0.9, { color: col, w: 1.6, head: 8, dash: '4 3' }); }); };
    if (uNow() === undefined) {
      const c = path(0);
      ball(D, c, r, CA, '');
      if (dopt('showB', true)) arrive(D, c, r, d1, L(g.v1), { color: BEF, label: lbl(opt, `v₁ = ${fmt(g.v1)} ${u.V}`, 'v₁'), size: 11.5, anchor: 'end', ldx: -6, ldy: wallMode ? 16 : -6 });
      if (dopt('showA2', true)) { leave(D, c, r, d2, L(g.v2), { color: AFT, label: lbl(opt, `v₂ = ${fmt(g.v2)} ${u.V}`, 'v₂'), size: 11.5, anchor: wallMode ? 'end' : 'start', ldx: wallMode ? -6 : 6 }); comp(rim(D, c, r, d2, 1), [vt, n2], AFT); }
      const o = W(0, 0); // angles are measured from the surface at the contact point
      if (wallMode) { D.arc(o, 54, 270, 270 - g.th1, 'θ₁', { color: BEF }); D.arc(o, 70, 90, 90 + g.th2, 'θ₂', { color: AFT }); }
      else { D.arc(o, 54, 180, 180 - g.th1, 'θ₁', { color: BEF }); D.arc(o, 70, 0, g.th2, 'θ₂', { color: AFT }); }
      DYUI.title(D, 12, 20, `${wallMode ? 'Smooth wall' : 'Smooth floor'}: e = ${fmt(g.e)}${opt.showP ? `,  θ₁ = ${fmt(g.th1)}°,  θ₂ = ${fmt(g.th2)}° (from the surface)` : ''}`);
      return true;
    }
    const tau = 2 * uNow() - 1, c = path(tau);
    ball(D, c, r, CA, '');
    if (tau < 0 ? dopt('showB', true) : dopt('showA2', true)) DYUI.vec(D, c, tau < 0 ? d1 : d2, L(tau < 0 ? g.v1 : g.v2), { color: tau < 0 ? BEF : AFT, label: lbl(opt, `${fmt(tau < 0 ? g.v1 : g.v2)} ${u.V}`, ''), size: 11.5 });
    DYUI.title(D, 12, 20, Math.abs(tau) < 0.02 ? 'Impact' : tau < 0 ? 'Before impact' : 'After impact');
    return true;
  }
  function bounce2D(svg, g, opt) {
    const u = g.u, T = g.span[1], wd = 2.6 * g.h0, X = (t) => (t / T) * wd, r = 0.05 * g.h0;
    const D = UI.Draw2D(svg, { xmin: -0.25 * g.h0, xmax: wd + 0.35 * g.h0, ymin: -0.15 * g.h0, ymax: 1.12 * g.h0 }, { pad: 30 });
    DYUI.ground(D, [-0.2 * g.h0, 0], [wd + 0.3 * g.h0, 0], 0);
    const pts = []; for (let i = 0; i <= 400; i++) { const t = (T * i) / 400; pts.push([X(t), g.y(t) + r]); }
    D.pline(pts, { stroke: CA, sw: 1.4, dash: '5 4' });
    if (dopt('dims', true)) {
      D.dim([X(0) - 0.12 * g.h0, 0], [X(0) - 0.12 * g.h0, g.h0], lbl(opt, `h₀ = ${fmt(g.h0)} ${u.L}`, 'h₀'), 0);
      g.hits.slice(0, Math.min(3, g.nb)).forEach((t0, i) => {
        const T1 = i + 1 < g.hits.length ? g.hits[i + 1] : T, tm = (t0 + T1) / 2, h = Math.pow(g.e, 2 * (i + 1)) * g.h0;
        if (h > 0.03 * g.h0) { D.line([X(tm), 0], [X(tm), h + r], { stroke: K.ink, sw: 1, dash: '2 3' }); D.text([X(tm), h + r + 0.04 * g.h0], lbl(opt, `h${'₁₂₃'[i]} = ${fmt(h)} ${u.L}`, `h${'₁₂₃'[i]}`), { anchor: 'middle', color: K.ink, size: 11.5, weight: 700 }); }
      });
    }
    const t = uNow() === undefined ? 0 : T * uNow(), c = [X(t), g.y(t) + r], vy = g.vy(t);
    ball(D, c, r, CA, '');
    if (dopt(uNow() === undefined ? 'showB' : 'showA2', true) && Math.abs(vy) > 1e-6 * g.v0) DYUI.vec(D, [c[0] + r * 1.6, c[1]], [0, vy], 20 + 70 * Math.abs(vy) / g.v0, { color: AFT, label: lbl(opt, `v = ${fmt(Math.abs(vy))} ${u.V}`, 'v'), size: 11.5 });
    DYUI.title(D, 12, 20, uNow() === undefined ? `Released from rest, e = ${fmt(g.e)}` : `t = ${fmt(t)} s`);
    D.text([wd + 0.3 * g.h0, 1.06 * g.h0], 'time runs to the right in the drawing', { anchor: 'end', color: '#5a6b75', size: 10.5, weight: 400 });
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u;
    if (g.mode === 'bounce') {
      const T = g.span[1], pts = []; for (let i = 0; i <= 600; i++) { const t = (T * i) / 600; pts.push([t, g.y(t)]); }
      const cur = uNow() === undefined ? NaN : T * uNow();
      return DYUI.stack(svg, [{ label: `y (${u.L})`, color: K.pos, pts, at: g.y, marks: g.hits.map((x) => ({ x, y: 0, label: '', color: K.ink })) }], { xlabel: 't (s)', cursor: cur, xmin: 0, xmax: T });
    }
    if (g.mode === 'wall') return DYUI.bars(svg, [{ name: '(v_n)₁', v: g.vn1, color: BEF, sub: 'normal, before' }, { name: '(v_n)₂', v: g.vn2, color: AFT, sub: 'normal, after' }, { name: '(v_t)₁', v: g.vt, color: BEF, sub: 'along, before' }, { name: '(v_t)₂', v: g.vt, color: AFT, sub: 'along, after' }], { unit: u.V, title: 'Speed' });
    const TA1 = 0.5 * g.mA * sp(g.A1) ** 2, TB1 = 0.5 * g.mB * sp(g.B1) ** 2, TA2 = 0.5 * g.mA * sp(g.A2) ** 2, TB2 = 0.5 * g.mB * sp(g.B2) ** 2;
    return DYUI.bars(svg, [{ name: 'A before', v: TA1, color: CA }, { name: 'B before', v: TB1, color: CB }, { name: 'T₁', v: g.T1, color: BEF, sub: 'total before' },
      { name: 'A after', v: TA2, color: CA }, { name: 'B after', v: TB2, color: CB }, { name: 'T₂', v: g.T2, color: AFT, sub: 'total after' }, { name: 'Lost', v: g.T1 - g.T2, color: '#c0392b', sub: 'T₁ − T₂' }], { unit: u.E, title: 'Kinetic energy' });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u;
    const arr = (p, d, L, col, lab) => { const l = Math.hypot(d[0], d[1], d[2]); if (!(l > 1e-12)) return; const q = DYUI.add(p, DYUI.mul(d, L / l)); DYUI.arrow3(v, p, q, col, 2.6); if (lab) v.label(q, lab, col); };
    if (g.mode === 'central' || g.mode === 'oblique') {
      const [rA, rB] = radii(g), vmax = Math.max(sp(g.A1), sp(g.B1), sp(g.A2), sp(g.B2), 1e-9), k = (g.mode === 'central' ? 3.6 : 3) / vmax;
      const tau = uNow() === undefined ? 0 : 2 * uNow() - 1;
      const at = (c0, v1, v2) => (tau < 0 ? [c0[0] + v1[0] * tau * k, c0[1] + v1[1] * tau * k] : [c0[0] + v2[0] * tau * k, c0[1] + v2[1] * tau * k]);
      if (g.mode === 'central') DYUI.floor3(v, -7, 7, 0, 1.2); else DYUI.floor3(v, -5, 5, 0, 4.2);
      [[[-rA, 0], g.A1, g.A2, CA, rA, 'A'], [[rB, 0], g.B1, g.B2, CB, rB, 'B']].forEach(([c0, v1, v2, col, r, n]) => {
        const p = at(c0, v1, v2), c = [p[0], r, -p[1]];
        DYUI.sphere(v, c, r, col);
        v.label([c[0], 2 * r + 0.3, c[2]], n, col);
        const vv = tau < 0 || uNow() === undefined ? v1 : v2, show = uNow() === undefined ? dopt('showB', true) : tau < 0 ? dopt('showB', true) : dopt('showA2', true);
        const Lw = (w) => 0.8 + 2.2 * sp(w) / vmax, top = [c[0], 2 * r + 0.1, c[2]];
        if (uNow() === undefined) {
          // before: arriving at the top of the ball; after: leaving it
          if (dopt('showB', true) && sp(v1) > 1e-9 * vmax) { const d = [v1[0] / sp(v1), 0, -v1[1] / sp(v1)], tail = DYUI.sub(top, DYUI.mul(d, Lw(v1))); DYUI.arrow3(v, tail, top, BEF, 2.6); v.label(tail, lbl(opt, `${fmt(sp(v1))} ${u.V}`, ''), BEF); }
          if (dopt('showA2', true) && sp(v2) > 1e-9 * vmax) arr(top, [v2[0], 0, -v2[1]], Lw(v2), AFT, lbl(opt, `${fmt(sp(v2))} ${u.V}`, ''));
        } else if (show && sp(vv) > 1e-9 * vmax) arr(top, [vv[0], 0, -vv[1]], Lw(vv), tau < 0 ? BEF : AFT, lbl(opt, `${fmt(sp(vv))} ${u.V}`, ''));
      });
      if (g.mode === 'central') v.setBounds([-7, -0.2, -1.2], [7, 2.6, 1.2]); else v.setBounds([-5, -0.2, -4.2], [5, 2.4, 4.2]);
      return;
    }
    if (g.mode === 'wall') {
      const wallMode = g.surf !== 'floor', r = 0.35, vmax = Math.max(g.v1, g.v2, 1e-9), k = 3.4 / vmax, tau = uNow() === undefined ? 0 : 2 * uNow() - 1;
      const tn = tau < 0 ? [g.vt * tau * k, -g.vn1 * tau * k + r] : [g.vt * tau * k, g.vn2 * tau * k + r];
      let c;
      if (wallMode) { DYUI.floor3(v, -0.6, 4.6, -3.9, 1.5); v.box(-0.5, -3.9, -1.5, 0, 3.9, 1.5, '#d5dbe1', 1, K.edge); c = [tn[1], tn[0], 0]; }
      else { DYUI.floor3(v, -4.2, 4.2, 0, 1.5); c = [tn[0], tn[1], 0]; }
      DYUI.sphere(v, c, r, CA);
      const d = tau < 0 || uNow() === undefined ? (wallMode ? [-g.vn1, g.vt, 0] : [g.vt, -g.vn1, 0]) : wallMode ? [g.vn2, g.vt, 0] : [g.vt, g.vn2, 0];
      if (uNow() === undefined ? dopt('showB', true) : tau < 0 ? dopt('showB', true) : dopt('showA2', true)) arr([c[0], c[1], c[2] + r * 1.3], d, 0.6 + 1.6 * Math.hypot(d[0], d[1]) / vmax, tau < 0 || uNow() === undefined ? BEF : AFT, lbl(opt, `${fmt(Math.hypot(d[0], d[1]))} ${u.V}`, ''));
      if (wallMode) v.setBounds([-0.6, -3.9, -1.5], [4.6, 3.9, 1.5]); else v.setBounds([-4.2, -0.2, -1.5], [4.2, 3.9, 1.5]);
      return;
    }
    const T = g.span[1], t = uNow() === undefined ? 0 : T * uNow(), r = 0.05 * g.h0, wd = 2.6 * g.h0, x = (t / T) * wd - wd / 2;
    DYUI.floor3(v, -wd / 2 - 0.2 * g.h0, wd / 2 + 0.2 * g.h0, 0, 0.3 * g.h0);
    const pts = []; for (let i = 0; i <= 200; i++) { const tt = (T * i) / 200; pts.push([(tt / T) * wd - wd / 2, g.y(tt) + r, 0]); }
    v.line(pts, CA, 1.2);
    DYUI.sphere(v, [x, g.y(t) + r, 0], r, CA);
    v.label([-wd / 2, g.h0 + 2 * r, 0], lbl(opt, `h₀ = ${fmt(g.h0)} ${u.L}`, 'h₀'), K.ink);
    v.setBounds([-wd / 2 - 0.2 * g.h0, -0.05 * g.h0, -0.3 * g.h0], [wd / 2 + 0.2 * g.h0, 1.15 * g.h0, 0.3 * g.h0]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => Object.assign(Impact.defaults(), o);
  M.presets = [
    { name: 'Test: Book Example 15.4, 15 Mg boxcar couples with a 12 Mg tank car (v₂ = 0.5 m/s, F_avg = 18.8 kN)', units: 'SI', state: P0({ mode: 'central', find: 'plastic', mA: 15000, mB: 12000, vA1: 1.5, vB1: -0.75, dt: 0.8 }),
      expect: [{ k: 'Common velocity after coupling v₂', v: 0.5 }, { k: 'Average force between them F_avg', v: 18750 }] },
    { name: 'Test: Book Example 15.9, 6 lb bag swings 3 ft down onto an 18 lb box, e = 0.5 (loss 10.1 ft·lb)', units: 'US', state: P0({ mode: 'central', find: 'v', mA: 6, mB: 18, src: 'drop', hA: 3, vB1: 0, e: 0.5 }),
      expect: [{ k: 'Velocity of A before impact (v_A)₁', v: 13.9 }, { k: 'Velocity of A after impact (v_A)₂', v: -1.737 }, { k: 'Velocity of B after impact (v_B)₂', v: 5.212 }, { k: 'Energy lost', v: 10.13 }] },
    { name: 'Test: Book Example 15.11, smooth disks 1 kg and 2 kg, e = 0.75 (v_Ax = −1.26, v_Bx = 1.22 m/s)', units: 'SI', state: P0({ mode: 'oblique', mA: 1, mB: 2, sA: 3, thA: 30, sB: 1, thB: 225, e: 0.75 }),
      expect: [{ k: '(v_Ax)₂', v: -1.258 }, { k: '(v_Bx)₂', v: 1.221 }, { k: '(v_Ay)₂', v: 1.5 }, { k: '(v_By)₂', v: -0.7071 }] },
    { name: 'Test: 2 kg at 4 m/s meets 3 kg at 2 m/s head on, e = 0.6 (−1.76 and 1.84 m/s, 13.8 J lost)', units: 'SI', state: P0({ mode: 'central', find: 'v', mA: 2, mB: 3, vA1: 4, vB1: -2, e: 0.6 }),
      expect: [{ k: 'Velocity of A after impact (v_A)₂', v: -1.76 }, { k: 'Velocity of B after impact (v_B)₂', v: 1.84 }, { k: 'Energy lost', v: 13.82 }] },
    { name: 'Test: ball dropped 2 m, e = 0.8 (h₁ = 1.28 m, h₂ = 0.819 m)', units: 'SI', state: P0({ mode: 'bounce', find: 'v', h0: 2, e: 0.8, nb: 5 }),
      expect: [{ k: 'First rebound height h₁', v: 1.28 }, { k: 'Second rebound height h₂', v: 0.8192 }, { k: 'Total distance travelled', v: 9.111 }] },
    { name: 'Test: e back-solved from Example 15.9, (v_B)₂ = 5.2125 ft/s measured (e = 0.5)', units: 'US', state: P0({ mode: 'central', find: 'e', mA: 6, mB: 18, src: 'drop', hA: 3, vB1: 0, vB2m: 5.2125 }),
      expect: [{ k: 'Coefficient of restitution e', v: 0.5 }] },
    { name: 'Test: ball at 20 m/s strikes a smooth wall at 30°, e = 0.75 (v₂ = 18.9 m/s at 23.4°)', units: 'SI', state: P0({ mode: 'wall', find: 'v', surf: 'wall', v1: 20, th1: 30, e: 0.75 }),
      expect: [{ k: 'Speed after impact v₂', v: 18.87 }, { k: 'Angle from the surface θ₂', v: 23.41 }] },
    { name: 'Two equal billiard balls, nearly elastic (e = 0.95)', units: 'SI', state: P0({ mode: 'central', find: 'v', mA: 0.17, mB: 0.17, vA1: 3, vB1: 0, e: 0.95 }) },
    { name: 'Ball rebounding from a floor at 45°, U.S. units', units: 'US', state: P0({ mode: 'wall', find: 'v', surf: 'floor', v1: 30, th1: 45, e: 0.7 }) },
    { name: 'e from a rebound height: dropped 6 ft, comes back to 3.4 ft', units: 'US', state: P0({ mode: 'bounce', find: 'e', h0: 6, h1: 3.4, nb: 6 }) },
    { name: 'Puck glancing off a heavier puck at rest', units: 'SI', state: P0({ mode: 'oblique', mA: 0.16, mB: 0.4, sA: 6, thA: -20, sB: 0, thB: 0, e: 0.8 }) },
    { name: 'Edge: B runs away faster than A, so they never meet (fails on purpose)', units: 'SI', fails: true, state: P0({ mode: 'central', find: 'v', mA: 2, mB: 3, vA1: 2, vB1: 5, e: 0.6 }) },
  ];

  root.DImpact = M;
})(window);
