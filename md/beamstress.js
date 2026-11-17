/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M4 Beam Stresses
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapters 11, 12 and 15.
 *   flexure   σ = −My/I, σ_max = Mc/I (11.4)
 *   shear     τ = VQ/(It) at a level and the largest over the section (12.2)
 *   flow      q = VQ/I in a built-up beam and the fastener spacing s = nF/q (12.3)
 *   unsym     moment at an angle: σ = −M_z y/I_z + M_y z/I_y, tan α = (I_z/I_y) tan θ (11.5)
 *   design    required section modulus S = M_max/σ_allow with a shear check (15.2)
 * The section comes from the section engine (a shape, a W shape from the table,
 * or parts); the loading is typed (M and V) or taken from a beam solved by the
 * beam engine, at a chosen x or where it is largest.
 * Section axes: y up from the neutral axis, z to the right, x into the page.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const Section = root.Section || require('../shared/section.js');
  const Beam = root.Beam || require('../shared/beam.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D } = MD;
  const DEG = Math.PI / 180;
  const FU = { SI: ['kN', 'N'], US: ['kip', 'lb'] };

  /* Wide-flange shapes (Hibbeler, Appendix C, U.S. Customary):
     A (in²), d, t_w, b_f, t_f (in.), I_x (in⁴), S_x (in³), r_x (in.), I_y (in⁴), S_y (in³), r_y (in.) */
  const WT = [
    ['W24×104', 30.6, 24.06, 0.5, 12.75, 0.75, 3100, 258, 10.1, 259, 40.7, 2.91],
    ['W24×84', 24.7, 24.1, 0.47, 9.02, 0.77, 2370, 196, 9.79, 94.4, 20.9, 1.95],
    ['W24×62', 18.2, 23.74, 0.43, 7.04, 0.59, 1550, 131, 9.23, 34.5, 9.8, 1.38],
    ['W18×60', 17.6, 18.24, 0.415, 7.555, 0.695, 984, 108, 7.47, 50.1, 13.3, 1.69],
    ['W18×50', 14.7, 17.99, 0.355, 7.495, 0.57, 800, 88.9, 7.38, 40.1, 10.7, 1.65],
    ['W18×40', 11.8, 17.9, 0.315, 6.015, 0.525, 612, 68.4, 7.21, 19.1, 6.35, 1.27],
    ['W16×50', 14.7, 16.26, 0.38, 7.07, 0.63, 659, 81.0, 6.68, 37.2, 10.5, 1.59],
    ['W16×31', 9.12, 15.88, 0.275, 5.525, 0.44, 375, 47.2, 6.41, 12.4, 4.49, 1.17],
    ['W14×43', 12.6, 13.66, 0.305, 7.995, 0.53, 428, 62.7, 5.82, 45.2, 11.3, 1.89],
    ['W14×26', 7.69, 13.91, 0.255, 5.025, 0.42, 245, 35.3, 5.65, 8.91, 3.54, 1.08],
    ['W12×50', 14.7, 12.19, 0.37, 8.08, 0.64, 394, 64.7, 5.18, 56.3, 13.9, 1.96],
    ['W12×26', 7.65, 12.22, 0.23, 6.49, 0.38, 204, 33.4, 5.17, 17.3, 5.34, 1.51],
    ['W10×45', 13.3, 10.1, 0.35, 8.02, 0.62, 248, 49.1, 4.32, 53.4, 13.3, 2.01],
    ['W10×30', 8.84, 10.47, 0.3, 5.81, 0.51, 170, 32.4, 4.38, 16.7, 5.75, 1.37],
    ['W8×40', 11.7, 8.25, 0.36, 8.07, 0.56, 146, 35.5, 3.53, 49.1, 12.2, 2.04],
    ['W8×31', 9.13, 8.0, 0.285, 7.995, 0.435, 110, 27.5, 3.47, 37.1, 9.27, 2.02],
    ['W8×24', 7.08, 7.93, 0.245, 6.495, 0.4, 82.8, 20.9, 3.42, 18.3, 5.63, 1.61],
    ['W6×25', 7.34, 6.38, 0.32, 6.08, 0.455, 53.4, 16.7, 2.7, 17.1, 5.61, 1.52],
    ['W6×15', 4.43, 5.99, 0.23, 5.99, 0.26, 29.1, 9.72, 2.56, 9.32, 3.11, 1.46],
    ['W6×9', 2.68, 5.9, 0.17, 3.94, 0.215, 16.4, 5.56, 2.47, 2.19, 1.11, 0.905],
  ].map((r) => ({ name: r[0], wt: +r[0].split('×')[1], A: r[1], d: r[2], tw: r[3], bf: r[4], tf: r[5], Ix: r[6], Sx: r[7], Iy: r[9], Sy: r[10] }));
  const IN = 0.0254;

  const P = (kind, x, y, b, h, o) => Object.assign({ kind, x, y, b, h, r: 0, a: 90, rot: 0, hole: false }, o || {});
  function defaults() {
    return {
      mode: 'flexure', fu: 'kN',
      sec: { src: 'shape', shape: 'I', flip: false, b: 100, h: 200, bf: 250, d: 340, tf: 20, tw: 20, D: 100, t: 10, W: 'W18×40',
        parts: [P('rect', 0, 0, 30, 150), P('rect', -60, 150, 150, 30)] },
      ld: { src: 'beam', M: 22.5, V: 19.5, at: 'max', x: 3,
        bm: { L: 6, sup: 'simple', xa: 0, xb: 6, loads: [{ kind: 'dist', x: 0, x1: 0, x2: 6, w1: 5, w2: 5, P: 0, M: 0, dir: 'ccw' }] } },
      fl: { pt: true, y: 150 },
      sh: { y: 0 },
      fw: { held: 'part', part: 2, y: 30, n: 1, F: 1.5, task: 's', s: 150, step: 0 },
      un: { by: 'angle', M: 12, th: -53.13, Mz: 7.2, My: -9.6 },
      dz: { kind: 'W', sA: 24, tA: 14.5, ratio: 1.5 },
    };
  }

  /* kinds of the numeric inputs, for switching units */
  const KSEC = { b: 'S', h: 'S', bf: 'S', d: 'S', tf: 'S', tw: 'S', D: 'S', t: 'S' };
  const KPART = { x: 'S', y: 'S', b: 'S', h: 'S', r: 'S' };
  const KLD = { M: 'FL', V: 'F', x: 'L' };
  const KBM = { L: 'L', xa: 'L', xb: 'L' };
  const KLOAD = { x: 'L', x1: 'L', x2: 'L', w1: 'W', w2: 'W', P: 'F', M: 'FL' };
  const KFL = { y: 'S' }, KSH = { y: 'S' }, KFW = { y: 'S', F: 'F', s: 'S', step: 'S' }, KUN = { M: 'FL', Mz: 'FL', My: 'FL' }, KDZ = { sA: 'ST', tA: 'ST' };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = FU[from].includes(st.fu) ? st.fu : FU[from][0], cv = (o, k) => MD.convertObj(o, k, from, to, fu);
    cv(st.sec, KSEC); (st.sec.parts || []).forEach((p) => cv(p, KPART));
    cv(st.ld, KLD); cv(st.ld.bm, KBM); (st.ld.bm.loads || []).forEach((q) => cv(q, KLOAD));
    cv(st.fl, KFL); cv(st.sh, KSH); cv(st.fw, KFW); cv(st.un, KUN); cv(st.dz, KDZ);
    st.fu = Core.twin(fu, to);
    return st;
  }

  const R = MD.result;
  const shapeName = { rect: 'Rectangle', circle: 'Solid circle', I: 'I section', T: 'T section', C: 'Channel', box: 'Box', pipe: 'Pipe' };

  /* ------------------------------------------------------------------ */
  /* Section: parts in metres, solved by the section engine             */
  /* ------------------------------------------------------------------ */
  function section(sec, u) {
    const S = u.S, m = (v) => B(+v, S);
    let parts = [], err = [], W = null, name = '';
    if (sec.src === 'W') {
      W = WT.find((w) => w.name === sec.W) || WT[0];
      const t = Section.template('I', { bf: W.bf * IN, d: W.d * IN, tf: W.tf * IN, tw: W.tw * IN });
      parts = t.parts; name = W.name;
    } else if (sec.src === 'parts') {
      parts = (sec.parts || []).map((p) => Object.assign({}, p, { x: m(p.x), y: m(p.y), b: m(p.b), h: m(p.h), r: m(p.r) }));
      name = 'Built from parts';
    } else {
      const sh = sec.shape;
      name = shapeName[sh] || sh;
      if (sh === 'rect') { if (!(sec.b > 0 && sec.h > 0)) err.push('Enter the width b and depth h of the rectangle.'); else parts = [P('rect', 0, 0, m(sec.b), m(sec.h))]; }
      else if (sh === 'circle') { if (!(sec.D > 0)) err.push('Enter the diameter.'); else parts = [{ kind: 'circle', x: m(sec.D) / 2, y: m(sec.D) / 2, r: m(sec.D) / 2, rot: 0, hole: false }]; }
      else {
        const t = Section.template(sh, { bf: m(sec.bf), d: m(sec.d), tf: sh === 'pipe' || sh === 'box' ? m(sec.t) : m(sec.tf), tw: m(sec.tw) });
        err = err.concat(t.err.map((e) => e.replace(/ must/, ` must`)));
        parts = t.parts;
        if (sec.flip && parts.length) { const top = Math.max(...parts.map((p) => p.y + p.h)); parts = parts.map((p) => (p.kind === 'rect' ? Object.assign({}, p, { y: top - p.y - p.h }) : p)); name += ', upside down'; }
      }
    }
    if (err.length) return { ok: false, err };
    const sol = Section.solve(parts);
    if (!sol.ok) return { ok: false, err: sol.err };
    const o = { ok: true, parts, sol, W, name, A: sol.A, yb: sol.y, zb: sol.x, Iz: sol.Ic.x, Iy: sol.Ic.y, Iyz: sol.Ic.xy, ct: sol.c.top, cb: sol.c.bottom, ymin: sol.box.ymin, ymax: sol.box.ymax };
    o.Idim = o.Iz;
    if (W) { o.Iz = W.Ix * IN ** 4; o.Iy = W.Iy * IN ** 4; o.Iyz = 0; o.Stab = W.Sx * IN ** 3; o.Atab = W.A * IN * IN; }
    return o;
  }
  /** Worked steps for the centroid and moment of inertia of the section. */
  function secSteps(S, s, u, axisOnly) {
    const L = u.S, a = (v) => fmt(D(v, u.A)), y = (v) => fmt(D(v, L)), I = (v) => fmt(D(v, u.I));
    if (s.W) {
      S.add({ t: `Section properties of the ${s.W.name}`, n: 'Taken from the table of wide-flange shapes (Appendix C). The drawing is built from the flange and web dimensions, without the fillets.',
        table: { head: ['d', 'b_f', 't_f', 't_w', 'A', 'I_x', 'S_x'], rows: [[`${y(s.W.d * IN)} ${L}`, `${y(s.W.bf * IN)} ${L}`, `${y(s.W.tf * IN)} ${L}`, `${y(s.W.tw * IN)} ${L}`, `${a(s.Atab)} ${u.A}`, `${I(s.Iz)} ${u.I}`, `${fmt(D(s.Stab, u.Q))} ${u.Q}`]] } });
      return;
    }
    const rows = s.sol.rows;
    S.add({ t: 'Neutral axis', n: 'The neutral axis passes through the centroid of the section. ỹ is measured from the bottom of the section.', f: 'ȳ = ΣỹA / ΣA',
      table: { head: ['Part', `A (${u.A})`, `ỹ (${L})`, `ỹA (${u.Q})`], rows: rows.map((r, i) => [`${i + 1}. ${r.name}${r.sign < 0 ? ' (hole)' : ''}`, a(r.A), y(r.y - s.ymin), fmt(D(r.A * (r.y - s.ymin), u.Q))]) },
      s: `ȳ = ${fmt(D(rows.reduce((t, r) => t + r.A * (r.y - s.ymin), 0), u.Q))} / ${a(s.A)}`, r: `ȳ = ${y(s.yb - s.ymin)} ${L} from the bottom` });
    if (axisOnly) return;
    S.add({ t: 'Moment of inertia about the neutral axis', f: 'I = Σ(Ī + A d²), d = ỹ − ȳ',
      table: { head: ['Part', `Ī (${u.I})`, `d (${L})`, `A d² (${u.I})`, `Ī + A d² (${u.I})`], rows: rows.map((r, i) => [`${i + 1}`, I(r.Ix), y(r.dy), I(r.A * r.dy * r.dy), I(r.Ixc)]) },
      r: `I = ${I(s.Iz)} ${u.I}` });
  }

  /* ------------------------------------------------------------------ */
  /* Loading: typed, or from a beam                                     */
  /* ------------------------------------------------------------------ */
  function beamModel(bm) {
    const sups = bm.sup === 'cant' ? [{ type: 'fixed', x: 0 }] : [{ type: 'pin', x: +bm.xa }, { type: 'roller', x: +bm.xb }];
    const loads = (bm.loads || []).map((q) => (q.kind === 'point' ? { kind: 'point', x: +q.x, P: +q.P, ang: 90 } : q.kind === 'couple' ? { kind: 'couple', x: +q.x, M: +q.M, dir: q.dir } : { kind: 'dist', x1: +q.x1, x2: +q.x2, w1: +q.w1, w2: +q.w2 }));
    return { L: +bm.L, supports: sups, loads, hinges: [] };
  }
  function loading(ld, u, S, need) {
    const FL = u.FL;
    if (ld.src !== 'beam') {
      const out = { M: B(+ld.M || 0, FL), V: B(+ld.V || 0, u.F), beam: null };
      S.add({ t: 'Internal loading at the section', n: 'Given. A positive moment bends the beam concave upward (compression at the top); a positive shear acts downward on the right-hand face of the left part.', r: need === 'V' ? `V = ${fmt(+ld.V)} ${u.F}` : need === 'M' ? `M = ${fmt(+ld.M)} ${FL}` : `M = ${fmt(+ld.M)} ${FL}, V = ${fmt(+ld.V)} ${u.F}` });
      return out;
    }
    const bm = ld.bm, err = [];
    if (!(bm.L > 0)) err.push('Enter the length of the beam.');
    if (bm.sup !== 'cant' && !(bm.xa >= 0 && bm.xb > bm.xa && bm.xb <= bm.L)) err.push('The supports must lie on the beam, with A to the left of B.');
    (bm.loads || []).forEach((q, i) => {
      const who = `Load ${i + 1}`;
      if (q.kind === 'dist') { if (!(q.x1 >= 0 && q.x2 > q.x1 && q.x2 <= bm.L)) err.push(`${who}: the load must start and end on the beam.`); }
      else if (!(q.x >= 0 && q.x <= bm.L)) err.push(`${who}: the load must act on the beam.`);
    });
    if (ld.at === 'x' && !(ld.x >= 0 && ld.x <= bm.L)) err.push('The section must be on the beam.');
    if (err.length) return { err };
    const b = Beam.solve(beamModel(bm), { F: u.F, Lu: u.L });
    if (!b.ok) return { err: b.err };
    (b.stepsReact || []).forEach((s) => S.add(s));
    let M, V, xM, xV;
    if (ld.at === 'x') {
      const c = b.at(+ld.x, +ld.x >= bm.L - 1e-9 ? 'L' : 'R'); M = c.M; V = c.V; xM = xV = +ld.x;
      S.add({ t: `Internal loading at x = ${fmt(+ld.x)} ${u.L}`, n: 'Method of sections, keeping the part to the left of the cut.', r: `V = ${fmt(V)} ${u.F}, M = ${fmt(M)} ${FL}` });
    } else {
      M = b.ext.Mabs.M; xM = b.ext.Mabs.x; V = b.ext.Vabs.V; xV = b.ext.Vabs.x;
      (b.stepsMax || []).forEach((s) => S.add(s));
      S.add({ t: 'Largest internal loading', n: 'Read from the shear and moment diagrams.', r: `|V|max = ${fmt(Math.abs(V))} ${u.F} at x = ${fmt(xV)} ${u.L}; |M|max = ${fmt(Math.abs(M))} ${FL} at x = ${fmt(xM)} ${u.L}` });
    }
    return { M: B(M, FL), V: B(V, u.F), beam: b, xM, xV };
  }

  /** Shear stress τ(y) = VQ/(It) over the depth, with the widths just above and below each level. */
  function shearProfile(s, V, I) {
    const sol = s.sol, ys = [], n = 240, eps = 1e-7 * (s.ymax - s.ymin);
    for (let i = 0; i <= n; i++) ys.push(s.ymin + ((s.ymax - s.ymin) * i) / n);
    sol.outlines.forEach((o) => o.pts.forEach((p) => { ys.push(p[1] - eps, p[1] + eps); }));
    ys.push(s.yb);
    const pts = ys.filter((y) => y > s.ymin + eps / 2 && y < s.ymax - eps / 2).sort((a, b) => a - b)
      .map((y) => { const t = sol.t(y), Q = sol.Q(y); return { y, t, Q, tau: t > 1e-12 ? (V * Q) / (I * t) : 0 }; });
    const best = pts.reduce((m, p) => (Math.abs(p.tau) > Math.abs(m.tau) ? p : m), { tau: 0, y: s.yb });
    return { pts: [{ y: s.ymin, tau: 0 }].concat(pts, [{ y: s.ymax, tau: 0 }]), best };
  }

  function solve(st, U) {
    if (!FU[U.id].includes(st.fu)) st.fu = FU[U.id][0];
    const u = MD.units(U, st.fu);
    u.q = U.id === 'US' ? `${st.fu}/in.` : `${st.fu}/m`;
    if (st.mode === 'design' && st.dz.kind !== 'check') return designNew(st, u);
    const s = section(st.sec, u);
    if (!s.ok) return fail(s.err);
    if (st.mode === 'shear') return shear(st, s, u);
    if (st.mode === 'flow') return flow(st, s, u);
    if (st.mode === 'unsym') return unsym(st, s, u);
    if (st.mode === 'design') return check(st, s, u);
    return flexure(st, s, u);
  }
  const geoBase = (kind, s, u, L, extra) => Object.assign({ kind, u, s: { parts: s.parts, outlines: s.sol.outlines, box: s.sol.box, yb: s.yb, zb: s.zb, A: s.A, Iz: s.Iz, Iy: s.Iy, W: s.W && s.W.name, name: s.name }, beam: L.beam || null, xM: L.xM, xV: L.xV }, extra);

  /* ------------------------------------------------------------------ */
  /* Flexure formula                                                    */
  /* ------------------------------------------------------------------ */
  function flexure(st, s, u) {
    const S = Steps(), out = [], q = st.fl;
    const L = loading(st.ld, u, S, 'M');
    if (L.err) return fail(L.err);
    secSteps(S, s, u);
    const M = L.M, I = s.Iz, ct = s.W ? (s.W.d * IN) / 2 : s.ct, cb = s.W ? (s.W.d * IN) / 2 : s.cb;
    const sTop = (-M * ct) / I, sBot = (M * cb) / I, c = Math.max(ct, cb), smax = (Math.abs(M) * c) / I;
    const ST = u.ST, sv = (v) => fmt(D(v, ST)), TC = (v) => (Math.abs(v) < 1e-12 ? '' : v > 0 ? ' (T)' : ' (C)');
    S.add({ t: 'Stress at the top and bottom', n: 'y is measured up from the neutral axis. A positive moment puts the top in compression; tension is positive.', f: 'σ = −My/I',
      table: { head: ['Fibre', `y (${u.S})`, `σ (${ST})`], rows: [['Top', fmt(D(ct, u.S)), sv(sTop) + TC(sTop)], ['Bottom', fmt(D(-cb, u.S)), sv(sBot) + TC(sBot)]] } });
    S.add({ t: 'Absolute maximum bending stress', n: 'It acts at the fibre farthest from the neutral axis.', f: 'σ_max = Mc/I', s: `σ_max = (${fmt(D(Math.abs(M), u.FL))} ${u.FL})(${fmt(D(c, u.S))} ${u.S}) / (${fmt(D(I, u.I))} ${u.I})`, r: `σ_max = ${sv(smax)} ${ST}` });
    let sP = null;
    if (q.pt) {
      const yP = B(+q.y, u.S);
      if (yP > ct + 1e-9 * (ct + cb) || yP < -cb - 1e-9 * (ct + cb)) return fail([`The point is outside the section: y must be between ${fmt(D(-cb, u.S))} and ${fmt(D(ct, u.S))} ${u.S}.`]);
      sP = (-M * yP) / I;
      S.add({ t: 'Stress at the chosen point', f: 'σ = −My/I', s: `σ = −(${fmt(D(M, u.FL))})(${fmt(+q.y)} ${u.S}) / (${fmt(D(I, u.I))} ${u.I})`, r: `σ = ${sv(sP)} ${ST}${TC(sP)}` });
    }
    out.push({ k: 'Moment M', v: D(M, u.FL), u: u.FL });
    if (!s.W) out.push({ k: 'Neutral axis from the bottom ȳ', v: D(s.yb - s.ymin, u.S), u: u.S });
    out.push({ k: 'Moment of inertia I', v: D(I, u.I), u: u.I });
    out.push({ k: 'Stress at the top σ_top', v: D(sTop, ST), u: ST }, { k: 'Stress at the bottom σ_bottom', v: D(sBot, ST), u: ST });
    out.push({ k: 'Absolute maximum bending stress σ_max', v: D(smax, ST), u: ST, hl: true });
    if (sP !== null) out.push({ k: 'Stress at the point σ_P', v: D(sP, ST), u: ST, hl: true });
    return R(`σ_max = ${sv(smax)} ${ST}${M ? (Math.abs(sTop) >= Math.abs(sBot) ? ' at the top' : ' at the bottom') : ''}`, 'ok', out, S,
      geoBase('flexure', s, u, L, { M, I, ct, cb, sTop, sBot, smax, yP: q.pt ? B(+q.y, u.S) : null, sP }));
  }

  /* ------------------------------------------------------------------ */
  /* Shear formula                                                      */
  /* ------------------------------------------------------------------ */
  function shear(st, s, u) {
    const S = Steps(), out = [], q = st.sh;
    const L = loading(st.ld, u, S, 'V');
    if (L.err) return fail(L.err);
    secSteps(S, s, u);
    const V = Math.abs(L.V), I = s.Idim, ST = u.ST, sv = (v) => fmt(D(v, ST)), yl = B(+q.y, u.S), y0 = s.yb + yl, H = s.ymax - s.ymin, eps = 1e-6 * H;
    if (!(y0 >= s.ymin - 1e-9 * H && y0 <= s.ymax + 1e-9 * H)) return fail([`The level is outside the section: y must be between ${fmt(D(s.ymin - s.yb, u.S))} and ${fmt(D(s.ymax - s.yb, u.S))} ${u.S}.`]);
    if (s.W) S.add({ t: 'Moment of inertia from the dimensions', n: 'The shear formula needs Q and t across the depth, so the flanges and web are used without fillets.', r: `I = ${fmt(D(I, u.I))} ${u.I}` });
    const Q = s.sol.Q(y0), tA = s.sol.t(Math.min(y0 + eps, s.ymax - eps / 2)), tB = s.sol.t(Math.max(y0 - eps, s.ymin + eps / 2));
    const twoW = Math.abs(tA - tB) > 1e-6 * Math.max(tA, tB);
    const tauA = tA > 0 ? (V * Q) / (I * tA) : 0, tauB = tB > 0 ? (V * Q) / (I * tB) : 0, t = Math.min(tA, tB) || Math.max(tA, tB), tau = t > 0 ? (V * Q) / (I * t) : 0;
    if (L.V < 0) S.add({ t: 'Size of the shear', n: 'The shear force is negative, so the shear stresses act the other way; their size is found with |V|.', r: `|V| = ${fmt(D(V, u.F))} ${u.F}` });
    S.add({ t: 'First moment Q of the area above the level', n: 'A′ is the part of the section above the level; ȳ′ is the distance from the neutral axis to its centroid.', f: 'Q = ȳ′A′', r: `Q = ${fmt(D(Q, u.Q))} ${u.Q}` });
    S.add({ t: 'Shear stress at the level', f: 'τ = VQ/(It)', n: twoW ? `The width changes at this level: t = ${fmt(D(tA, u.S))} ${u.S} just above and ${fmt(D(tB, u.S))} ${u.S} just below, so τ jumps.` : undefined,
      s: twoW ? `τ just above = ${sv(tauA)} ${ST}; τ just below = ${sv(tauB)} ${ST}` : `τ = (${fmt(D(V, u.F))} ${u.F})(${fmt(D(Q, u.Q))} ${u.Q}) / [(${fmt(D(I, u.I))} ${u.I})(${fmt(D(t, u.S))} ${u.S})]`,
      r: `τ = ${sv(tau)} ${ST}` });
    const pr = shearProfile(s, V, I);
    S.add({ t: 'Largest shear stress', n: 'Q/t is checked over the whole depth; for most sections it is largest at the neutral axis.', f: 'τ_max = V Q/(I t) where Q/t is largest', r: `τ_max = ${sv(Math.abs(pr.best.tau))} ${ST} at y = ${fmt(D(pr.best.y - s.yb, u.S))} ${u.S}` });
    const isI = s.W || (st.sec.src === 'shape' && st.sec.shape === 'I');
    let tw = null;
    if (isI) {
      const d = s.W ? s.W.d * IN : B(+st.sec.d, u.S), w = s.W ? s.W.tw * IN : B(+st.sec.tw, u.S); tw = V / (d * w);
      S.add({ t: 'Average shear stress in the web (design check)', n: 'For a wide-flange beam the web carries nearly all the shear; taking it over the full depth gives a simple estimate.', f: 'τ_avg = V/(d t_w)', r: `τ_avg = ${sv(Math.abs(tw))} ${ST}` });
    }
    out.push({ k: 'Shear force V', v: D(L.V, u.F), u: u.F }, { k: 'Moment of inertia I', v: D(I, u.I), u: u.I }, { k: 'Q at the level', v: D(Q, u.Q), u: u.Q });
    if (twoW) out.push({ k: 'Width just above the level', v: D(tA, u.S), u: u.S }, { k: 'Width just below the level', v: D(tB, u.S), u: u.S }, { k: 'Shear stress just above the level', v: D(tauA, ST), u: ST }, { k: 'Shear stress just below the level', v: D(tauB, ST), u: ST });
    else out.push({ k: 'Width t at the level', v: D(t, u.S), u: u.S });
    out.push({ k: 'Shear stress at the level τ', v: D(tau, ST), u: ST, hl: true });
    out.push({ k: 'Maximum shear stress τ_max', v: D(Math.abs(pr.best.tau), ST), u: ST, hl: true }, { k: 'Level of τ_max above the neutral axis', v: D(pr.best.y - s.yb, u.S), u: u.S });
    if (tw !== null) out.push({ k: 'Average shear stress in the web V/(d t_w)', v: D(Math.abs(tw), ST), u: ST });
    return R(`τ = ${sv(tau)} ${ST} at the level; τ_max = ${sv(Math.abs(pr.best.tau))} ${ST}`, 'ok', out, S,
      geoBase('shear', s, u, L, { V, I, y0, tau, prof: pr.pts, best: pr.best }));
  }

  /* ------------------------------------------------------------------ */
  /* Shear flow and fasteners                                           */
  /* ------------------------------------------------------------------ */
  function flow(st, s, u) {
    const S = Steps(), out = [], q = st.fw, err = [];
    if (!(q.n >= 1)) err.push('Enter the number of rows of fasteners (1 or more).');
    if (q.task === 'V' && !(q.s > 0)) err.push('Enter the spacing of the fasteners.');
    if (q.task === 'V' && !(q.F > 0)) err.push('Enter the shear strength of one fastener.');
    if (q.held === 'part' && !(q.part >= 1 && q.part <= s.parts.length)) err.push(`Pick a part from 1 to ${s.parts.length}.`);
    if (err.length) return fail(err);
    let L = { M: 0, V: 0 };
    if (q.task === 's') { L = loading(st.ld, u, S, 'V'); if (L.err) return fail(L.err); }
    secSteps(S, s, u);
    const I = s.Idim, sv = (v) => fmt(D(v, u.q));
    let Q, yc, Ah, held;
    if (q.held === 'part') {
      const r = s.sol.rows[q.part - 1]; Ah = Math.abs(r.A); yc = r.y - s.yb; Q = Math.abs(r.A) * yc * (r.sign); held = { part: q.part - 1 };
      S.add({ t: `Q of the part held by the fasteners (part ${q.part})`, n: 'The fasteners hold this part onto the rest of the beam. ȳ′ is the distance from the neutral axis to its centroid.', f: 'Q = ȳ′A′', s: `Q = (${fmt(D(yc, u.S))} ${u.S})(${fmt(D(Ah, u.A))} ${u.A})`, r: `Q = ${fmt(D(Q, u.Q))} ${u.Q}` });
    } else {
      const y0 = s.yb + B(+q.y, u.S);
      if (!(y0 > s.ymin && y0 < s.ymax)) return fail([`The seam must be inside the section: y between ${fmt(D(s.ymin - s.yb, u.S))} and ${fmt(D(s.ymax - s.yb, u.S))} ${u.S}.`]);
      Q = s.sol.Q(y0); held = { y0 };
      S.add({ t: 'Q of the area above the seam', f: 'Q = ȳ′A′', r: `Q = ${fmt(D(Q, u.Q))} ${u.Q}` });
    }
    Q = Math.abs(Q);
    const n = Math.round(+q.n), Fb = B(+q.F || 0, u.F);
    out.push({ k: 'Moment of inertia I', v: D(I, u.I), u: u.I }, { k: 'Q of the held part', v: D(Q, u.Q), u: u.Q });
    if (q.task === 'V') {
      const sp = B(+q.s, u.S), qa = (n * Fb) / sp, V = (qa * I) / Q;
      S.add({ t: 'Shear flow the fasteners can carry', n: `${n} row${n > 1 ? 's' : ''} of fasteners, each fastener carrying F, spaced s apart.`, f: 'q = nF/s', s: `q = ${n}(${fmt(+q.F)} ${u.F}) / ${fmt(+q.s)} ${u.S}`, r: `q = ${sv(qa)} ${u.q}` });
      S.add({ t: 'Largest shear force', f: 'q = VQ/I, so V = qI/Q', r: `V = ${fmt(D(V, u.F))} ${u.F}` });
      out.push({ k: 'Shear flow the fasteners carry q', v: D(qa, u.q), u: u.q }, { k: 'Largest shear force V', v: D(V, u.F), u: u.F, hl: true });
      return R(`V_max = ${fmt(D(V, u.F))} ${u.F}`, 'ok', out, S, geoBase('flow', s, u, L, { V, I, Q, qv: qa, held, n, sp }));
    }
    const V = Math.abs(L.V), qv = (V * Q) / I;
    S.add({ t: 'Shear flow', f: 'q = VQ/I', s: `q = (${fmt(D(V, u.F))} ${u.F})(${fmt(D(Q, u.Q))} ${u.Q}) / (${fmt(D(I, u.I))} ${u.I})`, r: `q = ${sv(qv)} ${u.q}` });
    out.push({ k: 'Shear force V', v: D(V, u.F), u: u.F }, { k: 'Shear flow q', v: D(qv, u.q), u: u.q, hl: true });
    if (n > 1) { S.add({ t: 'Shear flow per row', n: `${n} rows (or seams) share the shear flow equally.`, f: 'q_row = q/n', r: `q_row = ${sv(qv / n)} ${u.q}` }); out.push({ k: 'Shear flow per row', v: D(qv / n, u.q), u: u.q }); }
    let sp = null;
    if (Fb > 0 && qv > 0) {
      sp = (n * Fb) / qv;
      S.add({ t: 'Largest spacing of the fasteners', f: 's = nF/q', s: `s = ${n}(${fmt(+q.F)} ${u.F}) / ${sv(qv)} ${u.q}`, r: `s = ${fmt(D(sp, u.S))} ${u.S}` });
      out.push({ k: 'Largest spacing s', v: D(sp, u.S), u: u.S, hl: true });
      if (q.step > 0) { const use = Math.floor(D(sp, u.S) / q.step + 1e-9) * q.step; out.push({ k: 'Spacing to use (rounded down)', v: Core.tidy(use, 6), u: u.S }); S.add({ t: 'Spacing to use', n: `Rounded down to a multiple of ${fmt(+q.step)} ${u.S}.`, r: `s = ${fmt(use)} ${u.S}` }); }
    }
    return R(sp !== null ? `q = ${sv(qv)} ${u.q}; s = ${fmt(D(sp, u.S))} ${u.S}` : `q = ${sv(qv)} ${u.q}`, 'ok', out, S, geoBase('flow', s, u, L, { V, I, Q, qv, held, n, sp }));
  }

  /* ------------------------------------------------------------------ */
  /* Unsymmetric bending                                                */
  /* ------------------------------------------------------------------ */
  function unsym(st, s, u) {
    const S = Steps(), out = [], q = st.un, FL = u.FL, ST = u.ST, sv = (v) => fmt(D(v, ST));
    let Mz, My;
    if (q.by === 'comp') { Mz = B(+q.Mz || 0, FL); My = B(+q.My || 0, FL); }
    else {
      if (!isFinite(+q.th)) return fail(['Enter the angle θ of the moment.']);
      const M = B(+q.M || 0, FL), th = +q.th * DEG; Mz = M * Math.cos(th); My = M * Math.sin(th);
      if (Math.abs(Mz) < 1e-12 * Math.abs(M)) Mz = 0; if (Math.abs(My) < 1e-12 * Math.abs(M)) My = 0;
      S.add({ t: 'Moment components', n: 'θ is measured from the +z axis toward the +y axis (z to the right, y up, x into the page).', f: 'M_z = M cos θ, M_y = M sin θ', s: `M_z = ${fmt(+q.M)} cos(${fmt(+q.th)}°), M_y = ${fmt(+q.M)} sin(${fmt(+q.th)}°)`, r: `M_z = ${fmt(D(Mz, FL))} ${FL}, M_y = ${fmt(D(My, FL))} ${FL}` });
    }
    if (!Mz && !My) return fail(['Enter a moment.']);
    secSteps(S, s, u, true);
    // z to the right, y up and x into the page (a right-handed set), so I_yz = ∫yz dA is the engine's I_xy
    const Iz = s.Iz, Iy = s.Iy, Pyz = s.W ? 0 : s.sol.Ic.xy, den = Iy * Iz - Pyz * Pyz;
    S.add({ t: 'Moments of inertia about the centroidal axes', f: s.W ? 'From the table' : 'I_z = Σ(Ī_z + A d_y²), I_y = Σ(Ī_y + A d_z²), I_yz = Σ(Ī_yz + A d_y d_z)', r: `I_z = ${fmt(D(Iz, u.I))} ${u.I}, I_y = ${fmt(D(Iy, u.I))} ${u.I}${Pyz ? `, I_yz = ${fmt(D(Pyz, u.I))} ${u.I}` : ''}` });
    const sig = (y, z) => (-(Mz * Iy + My * Pyz) * y + (My * Iz + Mz * Pyz) * z) / den;
    if (Pyz) S.add({ t: 'Normal stress', n: 'The y and z axes are not principal axes (I_yz ≠ 0), so the general form of the flexure formula is used. It reduces to σ = −M_z y/I_z + M_y z/I_y when I_yz = 0.', f: 'σ = [−(M_z I_y + M_y I_yz) y + (M_y I_z + M_z I_yz) z] / (I_y I_z − I_yz²)' });
    else S.add({ t: 'Normal stress', n: 'The y and z axes are principal axes (I_yz = 0), so each component bends about its own axis and the stresses add.', f: 'σ = −M_z y/I_z + M_y z/I_y' });
    // vertices of the outline (outer parts), relative to the centroid
    const verts = [];
    s.sol.outlines.forEach((o) => { o.pts.forEach((p) => verts.push({ z: p[0] - s.zb, y: p[1] - s.yb })); });
    if (s.W) { const d = s.W.d * IN, bf = s.W.bf * IN; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => verts.push({ y: (a * d) / 2, z: (b * bf) / 2 })); }
    verts.forEach((v) => (v.s = sig(v.y, v.z)));
    const tmax = verts.reduce((m, v) => (v.s > m.s ? v : m)), cmax = verts.reduce((m, v) => (v.s < m.s ? v : m));
    const single = s.parts.length === 1 && s.parts[0].kind === 'rect' && !s.W, crn = [];
    if (single) {
      const hb = s.parts[0].b / 2, hh = s.parts[0].h / 2;
      [['top-left', hh, -hb], ['top-right', hh, hb], ['bottom-right', -hh, hb], ['bottom-left', -hh, -hb]].forEach(([nm, y, z]) => crn.push({ nm, y, z, s: sig(y, z) }));
      S.add({ t: 'Stress at each corner', table: { head: ['Corner', `y (${u.S})`, `z (${u.S})`, `σ (${ST})`], rows: crn.map((c) => [c.nm, fmt(D(c.y, u.S)), fmt(D(c.z, u.S)), sv(c.s)]) } });
    } else S.add({ t: 'Largest stresses', n: 'σ varies linearly over the section, so the extremes are at corners of the outline.', r: `σ_t = ${sv(tmax.s)} ${ST} at (y, z) = (${fmt(D(tmax.y, u.S))}, ${fmt(D(tmax.z, u.S))}) ${u.S}; σ_c = ${sv(cmax.s)} ${ST} at (${fmt(D(cmax.y, u.S))}, ${fmt(D(cmax.z, u.S))}) ${u.S}` });
    // neutral axis: σ = 0 → y = z (M_y I_z + M_z I_yz)/(M_z I_y + M_y I_yz)
    const nu = My * Iz + Mz * Pyz, de = Mz * Iy + My * Pyz, al = Math.atan2(nu, de) / DEG, alpha = al > 90 ? al - 180 : al < -90 ? al + 180 : al;
    S.add({ t: 'Orientation of the neutral axis', n: 'Set σ = 0. α is measured from the +z axis toward the +y axis.', f: Pyz ? 'tan α = (M_y I_z + M_z I_yz)/(M_z I_y + M_y I_yz)' : 'tan α = (I_z/I_y) tan θ', r: `α = ${fmt(alpha)}°` });
    out.push({ k: 'Moment about z, M_z', v: D(Mz, FL), u: FL }, { k: 'Moment about y, M_y', v: D(My, FL), u: FL }, { k: 'I_z', v: D(Iz, u.I), u: u.I }, { k: 'I_y', v: D(Iy, u.I), u: u.I });
    if (Pyz) out.push({ k: 'I_yz', v: D(Pyz, u.I), u: u.I });
    crn.forEach((c) => out.push({ k: `Stress at the ${c.nm} corner`, v: D(c.s, ST), u: ST }));
    out.push({ k: 'Largest tensile stress', v: D(Math.max(0, tmax.s), ST), u: ST, hl: true }, { k: 'Largest compressive stress', v: D(Math.min(0, cmax.s), ST), u: ST, hl: true }, { k: 'Angle of the neutral axis α', v: alpha, u: '°', hl: true });
    return R(`σ_t = ${sv(tmax.s)} ${ST}, σ_c = ${sv(cmax.s)} ${ST}; neutral axis at α = ${fmt(alpha)}°`, 'ok', out, S,
      geoBase('unsym', s, u, { beam: null }, { Mz, My, alpha, crn, tmax, cmax, sig, Pyz }));
  }

  /* ------------------------------------------------------------------ */
  /* Design: required section modulus, then a shear check               */
  /* ------------------------------------------------------------------ */
  function designNew(st, u) {
    const S = Steps(), out = [], q = st.dz, err = [], ST = u.ST;
    if (!(q.sA > 0)) err.push('Enter the allowable bending stress.');
    if (!(q.tA > 0)) err.push('Enter the allowable shear stress.');
    if (q.kind === 'rect' && !(q.ratio > 0)) err.push('Enter the ratio of depth to width h/b.');
    if (err.length) return fail(err);
    const L = loading(st.ld, u, S, 'MV');
    if (L.err) return fail(L.err);
    const M = Math.abs(L.M), V = Math.abs(L.V), sA = B(+q.sA, ST), tA = B(+q.tA, ST), Sreq = M / sA, sv = (v) => fmt(D(v, ST));
    if (!(M > 0)) return fail(['The beam carries no bending moment, so there is nothing to size.']);
    S.add({ t: 'Required section modulus', f: 'S_req = M_max/σ_allow', s: `S_req = ${fmt(D(M, u.FL))} ${u.FL} / ${fmt(+q.sA)} ${ST}`, r: `S_req = ${fmt(D(Sreq, u.Q))} ${u.Q}` });
    out.push({ k: 'Largest moment M_max', v: D(M, u.FL), u: u.FL }, { k: 'Largest shear V_max', v: D(V, u.F), u: u.F }, { k: 'Required section modulus S_req', v: D(Sreq, u.Q), u: u.Q, hl: true });
    let geo = { kind: 'design', u, beam: L.beam, xM: L.xM, xV: L.xV, M, V, Sreq, dk: q.kind };
    if (q.kind === 'W') {
      const ok = WT.filter((w) => w.Sx * IN ** 3 >= Sreq * (1 - 1e-9));
      if (!ok.length) return fail([`No W shape in the table has S ≥ ${fmt(D(Sreq, u.Q))} ${u.Q}. Use a smaller moment or a larger allowable stress.`]);
      const lite = ok.slice().sort((a, b) => a.wt - b.wt || a.Sx - b.Sx)[0];
      S.add({ t: 'Shapes that are strong enough', n: 'Every shape in the table with S ≥ S_req; the lightest (smallest weight per length) is the most economical.', table: { head: ['Shape', `S (${u.Q})`, 'lb/ft'], rows: ok.slice().sort((a, b) => a.wt - b.wt).map((w) => [w.name + (w === lite ? '  ← lightest' : ''), fmt(D(w.Sx * IN ** 3, u.Q)), String(w.wt)]) } });
      const d = lite.d * IN, tw = lite.tw * IN, tav = V / (d * tw), okS = tav <= tA * (1 + 1e-9);
      S.add({ t: 'Shear check', n: 'The shear is taken as spread evenly over the web, from the very top to the very bottom of the beam.', f: 'τ_avg = V_max/(d t_w)', s: `τ_avg = ${fmt(D(V, u.F))} ${u.F} / [(${fmt(D(d, u.S))} ${u.S})(${fmt(D(tw, u.S))} ${u.S})]`, r: `τ_avg = ${sv(tav)} ${ST} ${okS ? '≤' : '>'} τ_allow = ${fmt(+q.tA)} ${ST}: ${okS ? 'OK' : 'not OK'}` });
      out.push({ k: 'Lightest W shape', v: lite.name, u: '', hl: true }, { k: 'Section modulus of the shape S', v: D(lite.Sx * IN ** 3, u.Q), u: u.Q }, { k: 'Average shear stress in the web τ_avg', v: D(tav, ST), u: ST });
      const parts = Section.template('I', { bf: lite.bf * IN, d, tf: lite.tf * IN, tw }).parts, sol = Section.solve(parts);
      geo = Object.assign(geo, { pick: lite.name, tav, okS, s: { parts, outlines: sol.outlines, box: sol.box, yb: sol.y, zb: sol.x, W: lite.name, name: lite.name } });
      return R(`Use a ${lite.name}${okS ? '' : ' (fails the shear check)'}`, okS ? 'ok' : 'bad', out, S, geo);
    }
    let dim, dimS, dimV, A, tmx, use, parts;
    if (q.kind === 'rect') {
      const r = +q.ratio;
      dimS = Math.cbrt((6 * Sreq) / (r * r));
      S.add({ t: 'Width from bending', n: `With h = ${fmt(r)} b, S = b h²/6 = ${fmt((r * r) / 6)} b³.`, f: 'b = (6 S_req / r²)^(1/3)', r: `b = ${fmt(D(dimS, u.S))} ${u.S}` });
      A = r * dimS * dimS; tmx = (1.5 * V) / A;
      dimV = Math.sqrt((1.5 * V) / (tA * r));
      use = Math.max(dimS, dimV);
      S.add({ t: 'Shear check', f: 'τ_max = 1.5 V/A', s: `τ_max = 1.5(${fmt(D(V, u.F))} ${u.F}) / [${fmt(r)}(${fmt(D(dimS, u.S))} ${u.S})²]`, r: `τ_max = ${sv(tmx)} ${ST} ${tmx <= tA * (1 + 1e-9) ? '≤' : '>'} τ_allow: ${tmx <= tA * (1 + 1e-9) ? 'OK, bending governs' : 'not OK, so size the beam for shear'}` });
      if (tmx > tA * (1 + 1e-9)) S.add({ t: 'Width from shear', f: 'τ_allow = 1.5 V/(r b²), b = √(1.5 V/(r τ_allow))', r: `b = ${fmt(D(dimV, u.S))} ${u.S}; this section also resists the bending stress` });
      out.push({ k: 'Width from bending b', v: D(dimS, u.S), u: u.S }, { k: 'Largest shear stress with that width', v: D(tmx, ST), u: ST }, { k: 'Width from shear b', v: D(dimV, u.S), u: u.S }, { k: 'Required width b', v: D(use, u.S), u: u.S, hl: true }, { k: 'Depth h', v: D(r * use, u.S), u: u.S, hl: true });
      parts = [P('rect', 0, 0, use, r * use)];
      dim = { b: use, h: r * use };
    } else {
      dimS = Math.cbrt((32 * Sreq) / Math.PI);
      S.add({ t: 'Diameter from bending', f: 'S = πd³/32, so d = (32 S_req/π)^(1/3)', r: `d = ${fmt(D(dimS, u.S))} ${u.S}` });
      A = (Math.PI / 4) * dimS * dimS; tmx = (4 * V) / (3 * A);
      dimV = Math.sqrt((16 * V) / (3 * Math.PI * tA));
      use = Math.max(dimS, dimV);
      S.add({ t: 'Shear check', f: 'τ_max = 4V/(3A)', r: `τ_max = ${sv(tmx)} ${ST} ${tmx <= tA * (1 + 1e-9) ? '≤' : '>'} τ_allow: ${tmx <= tA * (1 + 1e-9) ? 'OK, bending governs' : 'not OK, so size the shaft for shear'}` });
      if (tmx > tA * (1 + 1e-9)) S.add({ t: 'Diameter from shear', f: 'd = √(16V/(3π τ_allow))', r: `d = ${fmt(D(dimV, u.S))} ${u.S}` });
      out.push({ k: 'Diameter from bending d', v: D(dimS, u.S), u: u.S }, { k: 'Largest shear stress with that diameter', v: D(tmx, ST), u: ST }, { k: 'Diameter from shear d', v: D(dimV, u.S), u: u.S }, { k: 'Required diameter d', v: D(use, u.S), u: u.S, hl: true });
      parts = [{ kind: 'circle', x: use / 2, y: use / 2, r: use / 2, rot: 0, hole: false }];
      dim = { d: use };
    }
    const sol = Section.solve(parts);
    geo = Object.assign(geo, { dim, gov: dimV > dimS ? 'shear' : 'bending', s: { parts, outlines: sol.outlines, box: sol.box, yb: sol.y, zb: sol.x, name: q.kind === 'rect' ? 'Rectangle' : 'Solid circle' } });
    return R(q.kind === 'rect' ? `b = ${fmt(D(use, u.S))} ${u.S}, h = ${fmt(D(use * +q.ratio, u.S))} ${u.S} (${geo.gov} governs)` : `d = ${fmt(D(use, u.S))} ${u.S} (${geo.gov} governs)`, 'ok', out, S, geo);
  }
  /** Check a given section against the allowable stresses. */
  function check(st, s, u) {
    const S = Steps(), out = [], q = st.dz, ST = u.ST, sv = (v) => fmt(D(v, ST)), err = [];
    if (!(q.sA > 0)) err.push('Enter the allowable bending stress.');
    if (!(q.tA > 0)) err.push('Enter the allowable shear stress.');
    if (err.length) return fail(err);
    const L = loading(st.ld, u, S, 'MV');
    if (L.err) return fail(L.err);
    secSteps(S, s, u);
    const M = Math.abs(L.M), V = Math.abs(L.V), c = s.W ? (s.W.d * IN) / 2 : Math.max(s.ct, s.cb), smax = (M * c) / s.Iz, sA = B(+q.sA, ST), tA = B(+q.tA, ST);
    const okB = smax <= sA * (1 + 1e-9);
    S.add({ t: 'Bending stress', n: 'c is the distance to the farthest fibre.', f: 'σ_max = M_max c/I', s: `σ_max = (${fmt(D(M, u.FL))} ${u.FL})(${fmt(D(c, u.S))} ${u.S}) / (${fmt(D(s.Iz, u.I))} ${u.I})`, r: `σ_max = ${sv(smax)} ${ST} ${okB ? '≤' : '>'} σ_allow = ${fmt(+q.sA)} ${ST}: ${okB ? 'OK' : 'not OK'}` });
    const pr = shearProfile(s, V, s.Idim), tmx = Math.abs(pr.best.tau), okT = tmx <= tA * (1 + 1e-9);
    S.add({ t: 'Shear stress', n: 'Q/t is largest at the level shown (usually the neutral axis).', f: 'τ_max = V_max Q/(I t)', s: `Q = ${fmt(D(s.sol.Q(pr.best.y), u.Q))} ${u.Q}, t = ${fmt(D(s.sol.t(pr.best.y), u.S))} ${u.S}`, r: `τ_max = ${sv(tmx)} ${ST} ${okT ? '≤' : '>'} τ_allow = ${fmt(+q.tA)} ${ST}: ${okT ? 'OK' : 'not OK'}` });
    out.push({ k: 'Largest moment M_max', v: D(M, u.FL), u: u.FL }, { k: 'Largest shear V_max', v: D(V, u.F), u: u.F }, { k: 'Moment of inertia I', v: D(s.Iz, u.I), u: u.I },
      { k: 'Largest bending stress σ_max', v: D(smax, ST), u: ST, hl: true }, { k: 'Largest shear stress τ_max', v: D(tmx, ST), u: ST, hl: true }, { k: 'Section is safe', v: okB && okT ? 'yes' : 'no', u: '' });
    return R(okB && okT ? `Safe: σ_max = ${sv(smax)} ${ST}, τ_max = ${sv(tmx)} ${ST}` : `Not safe: ${okB ? '' : 'bending'}${!okB && !okT ? ' and ' : ''}${okT ? '' : 'shear'} stress too large`, okB && okT ? 'ok' : 'bad', out, S,
      geoBase('check', s, u, L, { M: L.M, V, I: s.Iz, ct: s.ct, cb: s.cb, smax, prof: pr.pts, best: pr.best, okB, okT }));
  }

  const BeamStress = { defaults, solve, convertState, WT, FU, section, beamModel, IN };
  root.BeamStress = BeamStress;
  if (typeof module !== 'undefined' && module.exports) module.exports = BeamStress;
})(typeof window !== 'undefined' ? window : globalThis);
