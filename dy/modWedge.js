/* =====================================================================
 * DYNAMICS · Block on a wedge pushed along a floor (inputs, diagrams, presets). Physics: dy/wedge.js.
 * The Particle Kinetics module (dy/modPkin.js) hands the scene 'wedge' to this file.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, DY, DYUI, WedgePair } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#cfe0f0', CB = '#f6d5c4', D2R = Math.PI / 180;
  const SCENES = WedgePair.SCENES;
  const lbl = (opt, a, b) => (opt.showP ? a : b);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const LW = 3; // drawn base length of the wedge (the physics needs no lengths)

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  function controls(c, C, st, u) {
    const num = (sec, k, label, unit) => C.num(sec, { label, get: () => st[k], set: (v) => (st[k] = v), unit });
    const ml = u.us ? 'weight' : 'mass';
    let sec = C.section(c, 'Find');
    C.seg(sec, { label: 'Find', get: () => st.wtask, set: (v) => (st.wtask = v), options: [['range', 'Range of P that keeps A on B'], ['given', 'Motion for a given P']] });
    sec = C.section(c, 'Block A and wedge B');
    C.note(sec, 'A rests on the sloped face of B. P pushes B horizontally toward the low end of the face, pressing the face into A.');
    num(sec, 'wmA', `Block A: ${ml}`, u.M); num(sec, 'wmB', `Wedge B: ${ml}`, u.M); num(sec, 'wth', 'Angle of the face θ from the horizontal', '°');
    if (st.wtask === 'given') num(sec, 'wP', 'Push on the wedge P', u.F);
    sec = C.section(c, 'Friction (0 for smooth)');
    num(sec, 'wmus', 'Between A and B: μ_s', '');
    if (st.wtask === 'given') num(sec, 'wmuk', 'Between A and B: μ_k', '');
    num(sec, 'wmuf', 'Floor under B: μ (sticking and sliding)', '');
    if (st.wtask === 'given') C.note(sec, 'Both bodies start from rest.');
  }
  function diagram(c, C, st) {
    C.toggle(c, { label: 'Free-body diagrams of A and B', get: () => st.fbd !== false, set: (v) => (st.fbd = v), rebuild: false });
    C.toggle(c, { label: 'Acceleration arrows', get: () => st.showV !== false, set: (v) => (st.showV = v), rebuild: false });
  }
  const cap2D = () => 'Block on a wedge, with free-body diagrams';
  const plotCaption = (st) => (st.wtask === 'given' ? 'Speeds of B and of A relative to B against time' : 'Range of P against μ_s between A and B');
  const hint = () => 'Press Play to push the wedge. Forces are in red on the free-body diagrams; accelerations are magenta.';
  const legend = () => [[K.force, 'Force'], [K.acc, 'Acceleration'], [K.ink, 'Floor', 'ln']];

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  /** Positions at time t: B's shift along the floor (world x, + right) and A's place along the face. */
  function layout(g, t) {
    const th = g.th * D2R, Lf = LW / Math.cos(th), wA = 0.3 * Lf, hA = 0.18 * Lf, T = g.span[1];
    const big = Math.max(Math.abs(g.aB), Math.abs(g.arel)) * 0.5 * T * T, Ks = big > 1e-12 ? LW / big : 0;
    const xb = -0.5 * g.aB * t * t * Ks, s = Math.max(wA / 2, Math.min(Lf - wA / 2, 0.5 * Lf + 0.5 * g.arel * t * t * Ks));
    const e = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)], H = LW * Math.tan(th);
    return { th, Lf, wA, hA, xb, s, e, n, H, foot: [xb + s * e[0], s * e[1]] };
  }
  /** World acceleration of A (x right): physics x runs along P, which points left. */
  const accA = (g, th) => [-(g.aB - g.arel * Math.cos(th)), g.arel * Math.sin(th)];

  function draw2D(svg, g, opt, uN, st) {
    const u = g.u, fb = st.fbd !== false, t = uN === undefined ? 0 : g.span[1] * uN, L = layout(g, t), { th, e, n, H } = L;
    const PW = Math.min(230, (svg.clientWidth || 800) * 0.34), top = H + L.hA * 1.6 + 0.6;
    const D = UI.Draw2D(svg, { xmin: -1.25 * LW, xmax: 1.85 * LW, ymin: -1.0, ymax: Math.max(top, 1.2) }, { pad: 22, padR: fb ? PW + 26 : 0, padRmax: 0.42 });
    DYUI.ground(D, [-1.25 * LW, 0], [1.8 * LW, 0], 0.22);
    const x0 = L.xb, B = [[x0, 0], [x0 + LW, 0], [x0 + LW, H]];
    D.poly(B, { fill: CB, stroke: K.edge, sw: 1.6 });
    D.text([x0 + 0.68 * LW, 0.3 * H], 'B', { anchor: 'middle', base: 'middle', color: K.ink, size: 13, weight: 700, avoid: false });
    D.arc([x0, 0], 34, 0, g.th, null, { color: K.ink });
    D.text([x0, 0], `θ = ${fmt(g.th)}°`, { dx: -6, dy: -8, anchor: 'end', color: K.ink, size: 12 });
    DYUI.block(D, L.foot, L.wA, L.hA, th, { label: 'A', fill: CA, size: 13 });
    const P = g.P || 0;
    if (P > 0) D.force([x0 + LW, H * 0.42], [-1, 0], 64, { color: K.force, label: lbl(opt, `P = ${fmt(P)} ${u.F}`, 'P'), lp: 'tail', anchor: 'end', ldx: 0, ldy: -10 });
    if (st.showV !== false) {
      const aw = accA(g, th), am = Math.max(Math.hypot(aw[0], aw[1]), Math.abs(g.aB), 1e-12);
      if (Math.abs(g.aB) > 1e-9) DYUI.vec(D, [x0 + 0.5 * LW, -0.62], [-Math.sign(g.aB), 0], 26 + 40 * Math.abs(g.aB) / am, { color: K.acc, w: 2.2, label: lbl(opt, `a_B = ${fmt(Math.abs(g.aB))} ${u.A}`, 'a_B'), size: 11, anchor: g.aB > 0 ? 'end' : 'start', ldx: g.aB > 0 ? -4 : 4, ldy: 4 });
      if (Math.hypot(aw[0], aw[1]) > 1e-9) DYUI.vec(D, add(L.foot, mul(n, L.hA + 0.2)), aw, 26 + 40 * Math.hypot(aw[0], aw[1]) / am, { color: K.acc, w: 2.2, label: lbl(opt, `a_A = ${fmt(Math.hypot(aw[0], aw[1]))} ${u.A}`, 'a_A'), size: 11, anchor: aw[0] < 0 ? 'end' : 'start', ldx: aw[0] < 0 ? -4 : 4, ldy: -4 });
    }
    if (fb) fbdPanels(D, g, opt, PW);
    const rel = g.arel === 0 ? 'A rides on B' : `A slips ${g.arel > 0 ? 'up' : 'down'} the face`;
    DYUI.title(D, 12, 20, g.task === 'range' ? `At P = ${fmt(P)} ${u.F}: ${rel}, a = ${fmt(g.aB)} ${u.A}` : uN === undefined ? `At the start: a_B = ${fmt(g.aB)} ${u.A}, ${rel}` : `t = ${fmt(t)} s: ${rel}`);
    return true;
  }

  /** Free-body diagrams of A and B, boxed on the right, drawn in screen pixels (y down). */
  function fbdPanels(D, g, opt, bw) {
    const u = g.u, gg = u.g, th = g.th * D2R, c = Math.cos(th), s = Math.sin(th), WA = g.mA * gg, WB = g.mB * gg;
    const maxF = Math.max(1e-9, WA, WB, g.N, Math.abs(g.F), g.Nf, Math.abs(g.Ff), g.P || 0), len = (f) => 20 + 30 * Math.abs(f) / maxF;
    const gap = 14, bh = Math.min(220, (D.H - 30 - gap) / 2), x0 = D.W - bw - 10;
    const box = (y0, title, kin) => {
      D.el('rect', { x: x0, y: y0, width: bw, height: bh, fill: '#ffffff', stroke: '#d3dce0', rx: 6 });
      D.text([x0 + 8, y0 + 16], title, { px: true, color: K.ink, size: 11.5, weight: 700 });
      if (kin) { const narrow = bw < 190; D.text(narrow ? [x0 + 8, y0 + 31] : [x0 + bw - 8, y0 + 16], kin, { px: true, anchor: narrow ? 'start' : 'end', color: K.acc, size: 10.5, weight: 700 }); }
    };
    const W = (q) => D.inv(q[0], q[1]);
    /** Arrow ending at screen point head along world direction d; the label goes at the tail (or the head) unless o places it. */
    const arrow = (head, d, f, label, o) => {
      o = o || {};
      if (!(Math.abs(f) > 1e-9 * maxF)) return;
      const l = Math.hypot(d[0], d[1]), ux = d[0] / l, uy = -d[1] / l, L = len(f), tail = [head[0] - ux * L, head[1] - uy * L];
      D.arrow(W(tail), W(head), { color: K.force, w: 2, head: 8 });
      const at = o.atHead ? head : tail, cx = o.atHead ? ux : -ux, cy = o.atHead ? uy : -uy;
      D.text(W(at), label, { color: K.force, size: 10.5, weight: 700, anchor: o.anchor || (cx > 0.35 ? 'start' : cx < -0.35 ? 'end' : 'middle'), dx: o.dx !== undefined ? o.dx : cx > 0.35 ? 3 : cx < -0.35 ? -3 : 0, dy: o.dy !== undefined ? o.dy : cy > 0.35 ? 12 : cy < -0.35 ? -4 : 4 });
    };
    const ep = [c, s], np = [-s, c]; // world: up the face, and the normal out of the face
    // Block A on the face, turned by θ: weight from its centre, N and F on its bottom face
    let y0 = 26; box(y0, 'Block A', `m_A a_A = ${fmt(g.mA * Math.hypot(...accA(g, th)))}`);
    const cx = x0 + bw / 2, cy = y0 + bh * 0.45, a = 34, b = 15;
    const S = (p, q) => [cx + p * c - q * s, cy - (p * s + q * c)];
    D.poly([S(-a, -b), S(a, -b), S(a, b), S(-a, b)].map(W), { fill: CA, stroke: K.edge, sw: 1.4 });
    D.text(W([cx, cy]), 'A', { anchor: 'middle', base: 'middle', color: K.ink, size: 11.5, weight: 700, avoid: false });
    arrow([cx, cy + len(WA)], [0, -1], WA, lbl(opt, `W_A = ${fmt(WA)}`, 'W_A'), { atHead: true, anchor: 'end', dx: -3, dy: 10 });
    arrow(S(a * 0.5, -b), np, g.N, lbl(opt, `N = ${fmt(g.N)}`, 'N'), { anchor: 'start', dx: 3, dy: 12 });
    if (g.F) { const sg = Math.sign(g.F); arrow(S(sg * (a + 2), -b + 3), mul(ep, sg), g.F, lbl(opt, `F = ${fmt(Math.abs(g.F))}`, 'F'), { atHead: true }); }
    // Wedge B: a right triangle with its low end on the left
    y0 = 26 + bh + gap; box(y0, 'Wedge B', `m_B a_B = ${fmt(g.mB * g.aB)}`);
    const tw = Math.min(bw * 0.5, 110), thh = Math.min(tw * Math.tan(th), bh * 0.4), tl = x0 + bw * 0.42 - tw / 2, tb = y0 + bh * 0.62;
    D.poly([[tl, tb], [tl + tw, tb], [tl + tw, tb - thh]].map(W), { fill: CB, stroke: K.edge, sw: 1.4 });
    const mid = [tl + tw * 0.55, tb - thh * 0.55], gB = [tl + tw * 0.67, tb - thh * 0.33];
    D.text(W([gB[0] + 6, gB[1] + 2]), 'B', { anchor: 'middle', base: 'middle', color: K.ink, size: 11, weight: 700, avoid: false });
    arrow([gB[0] - 4, tb + len(WB) + 2], [0, -1], WB, lbl(opt, `W_B = ${fmt(WB)}`, 'W_B'), { atHead: true, anchor: 'end', dx: -3, dy: 10 });
    arrow([tl + tw * 0.9, tb + 1], [0, 1], g.Nf, lbl(opt, `N_f = ${fmt(g.Nf)}`, 'N_f'), { anchor: 'start', dx: 3, dy: 10 });
    arrow([mid[0] - s * 2, mid[1] - c * 2], mul(np, -1), g.N, lbl(opt, `N = ${fmt(g.N)}`, 'N'), { anchor: 'end', dx: -3, dy: -2 });
    if (g.F) { const sg = -Math.sign(g.F), p = [mid[0] - sg * c * 4 - s * 10, mid[1] + sg * s * 4 - c * 10]; arrow([p[0] + sg * c * len(g.F), p[1] - sg * s * len(g.F)], mul(ep, sg), g.F, lbl(opt, `F = ${fmt(Math.abs(g.F))}`, 'F'), { atHead: true }); }
    if (g.P > 0) arrow([tl + tw, tb - thh * 0.4], [-1, 0], g.P, lbl(opt, `P = ${fmt(g.P)}`, 'P'), { anchor: 'end', dx: 0, dy: -6, atHead: false });
    if (g.Ff) { const sg = -Math.sign(g.Ff), h0 = sg < 0 ? [tl + tw * 0.05, tb + 5] : [tl + tw * 0.4, tb + 5]; arrow(h0, [sg, 0], g.Ff, lbl(opt, `F_f = ${fmt(Math.abs(g.Ff))}`, 'F_f'), { atHead: true, anchor: 'end', dx: sg < 0 ? -3 : 0, dy: 13 }); }
  }

  /* ------------------------------------------------------------------ */
  /* Chart                                                              */
  /* ------------------------------------------------------------------ */
  function plot(svg, g, uN) {
    const u = g.u;
    if (g.task === 'given') {
      const T = g.span[1], vB = [], vR = []; for (let i = 0; i <= 60; i++) { const t = (T * i) / 60; vB.push([t, g.aB * t]); vR.push([t, g.arel * t]); }
      return DYUI.stack(svg, [{ label: `v_B (${u.V})`, color: K.acc, pts: vB, at: (t) => g.aB * t }, { label: `v_A/B (${u.V})`, color: '#2f7fc1', pts: vR, at: (t) => g.arel * t }], { xlabel: 't (s)', cursor: uN === undefined ? 0 : T * uN, xmin: 0, xmax: T });
    }
    const th = g.th * D2R, gg = u.g, lo = [], hi = [], mmax = Math.max(1, g.mus * 1.5);
    const Pof = (mu) => { const L = WedgePair.slipLimits(g.mA, gg, th, mu); return [L.down.held ? 0 : WedgePair.pushFor(g.mA, g.mB, gg, g.muf, L.down.a), L.up ? WedgePair.pushFor(g.mA, g.mB, gg, g.muf, L.up.a) : NaN]; };
    let top = 0;
    for (let i = 0; i <= 120; i++) { const mu = (mmax * i) / 120, [a, b] = Pof(mu); lo.push([mu, a]); if (isFinite(b)) { hi.push([mu, b]); top = Math.max(top, b); } }
    const cap = Math.max(Pof(g.mus)[1] || 0, Pof(0)[1]) * 3, hiC = hi.filter(([, y]) => y <= cap);
    return DYUI.stack(svg, [{ label: `P (${u.F})`, color: K.force, pts: hiC, fill: false, more: [{ pts: lo, color: '#2f7fc1' }], marks: [{ x: g.mus, y: Pof(g.mus)[1], label: `P_max at μ_s = ${fmt(g.mus)}` }].filter((m) => isFinite(m.y)) }],
      { xlabel: 'μ_s between A and B   red: largest P, blue: smallest P', xmin: 0, xmax: mmax });
  }

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  function draw3D(v, g, uN) {
    const t = uN === undefined ? 0 : g.span[1] * uN, L = layout(g, t), { th, H } = L, d = 0.9;
    DYUI.floor3(v, -1.3 * LW, 1.5 * LW, 0, 1.4);
    v.extrude([[L.xb, 0], [L.xb + LW, 0], [L.xb + LW, H]], -d, d, CB, 1, K.edge);
    DYUI.block3(v, L.foot, L.wA, L.hA, d * 1.2, th, CA);
    if (g.P > 0) { const c = [L.xb + LW + 1.4, H * 0.42, 0]; DYUI.arrow3(v, c, [L.xb + LW + 0.02, H * 0.42, 0], K.force, 2.6); v.label([c[0] + 0.1, c[1] + 0.2, 0], `P = ${fmt(g.P)} ${g.u.F}`, K.force); }
    v.setBounds([-1.3 * LW, -0.2, -1.4], [1.5 * LW, Math.max(H + L.hA * 1.6, 1.5), 1.4]);
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const presets = (P0) => [
    { name: 'Test: Problem 13–46, smooth block and wedge of 10 kg each, face at 30° (P = 2mg tan θ = 113.3 N)', units: 'SI',
      state: P0({ scene: 'wedge', wtask: 'range', wmA: 10, wmB: 10, wth: 30, wmus: 0, wmuk: 0, wmuf: 0 }),
      expect: [{ k: 'Largest P with A at rest on B', v: 113.3 }, { k: 'Acceleration at the largest P', v: 5.664 }, { k: 'Normal force between A and B at the largest P', v: 113.3 }] },
    { name: 'Test: rough wedge, 10 kg on 10 kg at 30°, μ_s = 0.3 on the face, μ = 0.2 on the floor (85.6 N ≤ P ≤ 247 N)', units: 'SI',
      state: P0({ scene: 'wedge', wtask: 'range', wmA: 10, wmB: 10, wth: 30, wmus: 0.3, wmuk: 0.25, wmuf: 0.2 }),
      expect: [{ k: 'Largest P with A at rest on B', v: 247.4 }, { k: 'Smallest P with A at rest on B', v: 85.63 }] },
    { name: 'Test: smooth 10 kg block and wedge at 30° pushed by 50 N: A slides down the face (a_B = 0.602 m/s², N = 88.0 N)', units: 'SI',
      state: P0({ scene: 'wedge', wtask: 'given', wmA: 10, wmB: 10, wth: 30, wmus: 0, wmuk: 0, wmuf: 0, wP: 50 }),
      expect: [{ k: 'Acceleration of B, a_B (+ along P)', v: 0.6017 }, { k: 'Normal force between A and B, N', v: 87.96 }] },
    { name: 'Crate on a 20 lb ramp cart, pushed hard enough that the crate slides up', units: 'US',
      state: P0({ scene: 'wedge', wtask: 'given', wmA: 30, wmB: 20, wth: 25, wmus: 0.35, wmuk: 0.3, wmuf: 0.1, wP: 60 }) },
    { name: 'Edge: face angle of 90° (fails on purpose)', units: 'SI', fails: true,
      state: P0({ scene: 'wedge', wtask: 'range', wth: 90 }) },
  ];

  root.DWedgeUI = { SCENES, controls, diagram, cap2D, plotCaption, hint, legend, draw2D, plot, draw3D, presets };
})(window);
