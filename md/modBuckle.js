/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M8 Buckling of Columns
 * (inputs, diagrams, presets). Physics: md/buckle.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Buckle, BeamStress, MD, MDUI } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const COLC = '#b9c2cb', EDGE = '#4a5661', AX = '#111111', BCOL = '#d4612a', PCOL = COL.load, DCOL = COL.dim, GOV = '#c0392b';

  const M = { id: 'buckle', title: 'Buckling of Columns', defaults: Buckle.defaults, units: 'SI' };
  const S = () => M.state;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const showB = () => S().defl !== false;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], sys = M.units, fu = Buckle.FU[sys].includes(st.fu) ? st.fu : Buckle.FU[sys][0], u = MD.units(U, fu), sc = st.sec;
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => { o[k] = v; delete st._k; }, unit });
    let sec = C.section(c, 'Problem');
    C.seg(sec, { label: 'Find', get: () => st.task, set: (v) => { st.task = v; if (v === 'size' && sc.src === 'given') sc.src = 'shape'; if (v === 'size' && sc.shape === 'tube') sc.shape = 'circle'; }, options: [['load', 'Critical load'], ['length', 'Longest column'], ['size', 'Section size']] });
    C.seg(sec, { label: 'Force unit', get: () => fu, set: (v) => (st.fu = v), options: Buckle.FU[sys].map((x) => [x, x]) });
    if (st.task !== 'length') num(sec, st, 'L', 'Length of the column L', u.L);
    if (st.task !== 'load') num(sec, st, 'P', 'Load to carry P', fu);
    num(sec, st, 'FS', 'Factor of safety F.S.', '');
    sec = C.section(c, 'Section');
    C.select(sec, { label: 'Section from', get: () => sc.src, set: (v) => (sc.src = v), options: (st.task === 'size' ? [] : [['given', 'A, I_x and I_y typed in']]).concat([['shape', st.task === 'size' ? 'Round or square bar' : 'Round bar, tube or rectangle'], ['W', 'W shape from the table']]) });
    if (sc.src === 'shape') {
      C.seg(sec, { label: 'Shape', get: () => sc.shape, set: (v) => (sc.shape = v), options: st.task === 'size' ? [['circle', 'Round'], ['rect', 'Square']] : [['circle', 'Round'], ['tube', 'Tube'], ['rect', 'Rectangle']] });
      if (st.task === 'size') num(sec, st, 'step', 'Round up to steps of (0 = no rounding)', u.S);
      else if (sc.shape === 'rect') { num(sec, sc, 'b', 'Width b (bends about y–y)', u.S); num(sec, sc, 'h', 'Depth h (bends about x–x)', u.S); }
      else { num(sec, sc, 'd', sc.shape === 'tube' ? 'Outer diameter' : 'Diameter d', u.S); if (sc.shape === 'tube') num(sec, sc, 'di', 'Inner diameter', u.S); }
    } else if (sc.src === 'W') {
      if (st.task !== 'size') C.select(sec, { label: 'W shape', get: () => sc.W, set: (v) => (sc.W = v), options: BeamStress.WT.map((w) => [w.name, `${w.name} (A = ${fmt(w.A)} in.², I_x = ${fmt(w.Ix)}, I_y = ${fmt(w.Iy)} in.⁴)`]) });
      else C.note(sec, 'The lightest shape in the table that carries the load is picked.');
    } else {
      num(sec, sc, 'A', 'Area A', u.A); num(sec, sc, 'Ix', 'I_x (strong axis)', u.I); num(sec, sc, 'Iy', 'I_y (weak axis)', u.I);
    }
    const axis = (a, name) => {
      sec = C.section(c, `Buckling about the ${name} axis`);
      C.select(sec, { label: 'End supports', get: () => a.sup, set: (v) => (a.sup = v), options: Object.keys(Buckle.SUP).map((k) => [k, `${Buckle.SUP[k].name}${Buckle.SUP[k].K ? ` (K = ${Buckle.SUP[k].K})` : ''}`]) });
      if (a.sup === 'k') C.num(sec, { label: 'Effective-length factor K', get: () => a.K, set: (v) => (a.K = v) });
      C.select(sec, { label: 'Bracing', get: () => String(a.n), set: (v) => (a.n = +v), options: [['1', 'None'], ['2', 'At mid-height (2 lengths)'], ['3', 'At the third points (3 lengths)'], ['4', 'At the quarter points (4 lengths)']] });
    };
    axis(st.ax, 'x–x (strong)'); axis(st.ay, 'y–y (weak)');
    sec = C.section(c, 'Material');
    MDUI.material(C, sec, st, sys, { E: 'E', sY: 'sY' });
    C.num(sec, { label: 'Modulus E', get: () => st.E, set: (v) => { st.E = v; st.mat = 'custom'; }, unit: u.MOD });
    C.num(sec, { label: 'Yield stress σ_Y', get: () => st.sY, set: (v) => { st.sY = v; st.mat = 'custom'; }, unit: u.ST });
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Show the buckled shape (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    C.toggle(c, { label: 'Show the effective lengths', get: () => st.le !== false, set: (v) => (st.le = v) });
  };

  M.compute = (U) => Buckle.solve(S(), U);
  M.onUnits = (from, to) => Buckle.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => 'Buckled shape about each axis';
  M.cap3D = () => '3D view';
  M.plotCaption = 'Critical stress against slenderness';
  M.hint = () => 'Each column is drawn buckling about one axis, with its supports, bracing and effective length KL (the distance between points of zero moment). The red one buckles first. Press Play to watch it buckle (exaggerated). The chart below shows the Euler curve, cut off at the yield stress.';
  M.legend = () => [[GOV, 'Governing (buckles first)', 'ln'], [BCOL, 'Other axis', 'ln'], [PCOL, 'Load P'], [DCOL, 'Effective length KL', 'ln']];
  const deflect = root.Anim.deflection(S);
  M.anim = () => (showB() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* Mode shapes                                                        */
  /* ------------------------------------------------------------------ */
  const BETA = 4.4934094579; // tan β = β, pinned-fixed column
  const fpRaw = (t) => Math.sin(BETA * t) - Math.tan(BETA) * Math.cos(BETA * t) - BETA * t + Math.tan(BETA);
  let fpMax = 0; for (let i = 0; i <= 200; i++) fpMax = Math.max(fpMax, Math.abs(fpRaw(i / 200)));
  /** Lateral shape of one braced length, t from 0 (bottom) to 1 (top), largest size 1. */
  function shape1(sup, t, i) {
    if (sup === 'ff') return (1 - Math.cos(2 * Math.PI * t)) / 2;
    if (sup === 'fr') return 1 - Math.cos((Math.PI * t) / 2);
    if (sup === 'fp') return fpRaw(i % 2 ? 1 - t : t) / fpMax;
    return Math.sin(Math.PI * t);
  }
  /** Lateral shape along the whole column (s from 0 at the base to 1 at the top). */
  function shapeAt(a, s) {
    const n = a.nb, i = Math.min(n - 1, Math.floor(s * n)), t = s * n - i;
    return (i % 2 ? -1 : 1) * shape1(a.sup, t, i);
  }
  const ends = (a) => {
    const bot = a.sup === 'pp' || a.sup === 'k' ? 'pin' : 'fixed';
    let top = a.sup === 'pp' || a.sup === 'k' ? 'pin' : a.sup === 'ff' ? 'fixed' : a.sup === 'fr' ? 'free' : 'pin';
    if (a.sup === 'fp' && a.nb % 2 === 0) top = 'fixed';
    return { bot, top };
  };

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, Hc = 6, gap = 5.2, k = showB() ? kD() : 0, u = g.u;
    const D = UI.Draw2D(svg, { xmin: -2.4, xmax: gap + 2.6, ymin: -1.1, ymax: Hc + 1.6 }, { pad: 16 });
    g.axes.forEach((a, j) => {
      const x0 = j * gap, gov = a === g.g, col = gov ? GOV : BCOL, amp = 0.75 * k;
      const e = ends(a);
      // supports
      const hatch = (x, y, up) => { D.poly([[x - 0.55, y], [x + 0.55, y], [x + 0.55, y + (up ? 0.28 : -0.28)], [x - 0.55, y + (up ? 0.28 : -0.28)]], { fill: 'url(#hatch)', stroke: COL.support, sw: 1 }); };
      const pin = (x, y, down) => { const s = down ? -1 : 1; D.poly([[x, y], [x - 0.28, y - s * 0.42], [x + 0.28, y - s * 0.42]], { fill: '#fff', stroke: EDGE, sw: 1.6 }); D.circle([x, y], 0.06, { fill: '#fff', stroke: EDGE, sw: 1.4 }); D.line([x - 0.45, y - s * 0.42], [x + 0.45, y - s * 0.42], { stroke: COL.support, sw: 2 }); };
      if (e.bot === 'fixed') hatch(x0, 0, false); else pin(x0, 0, false);
      if (e.top === 'fixed') hatch(x0, Hc, true); else if (e.top === 'pin') pin(x0, Hc, true);
      // the straight column, then the buckled one
      D.line([x0, 0], [x0, Hc], { stroke: EDGE, sw: k ? 1.2 : 5, dash: k ? '6 4' : null, op: k ? 1 : 0.8 });
      if (k) { const pts = []; for (let i = 0; i <= 120; i++) { const s = i / 120; pts.push([x0 + amp * shapeAt(a, s), s * Hc]); } D.pline(pts, { stroke: col, sw: 5, op: 0.9 }); }
      // braces
      for (let b = 1; b < a.nb; b++) { const y = (b / a.nb) * Hc; D.line([x0, y], [x0 - 1.3, y], { stroke: COL.support, sw: 2 }); D.circle([x0, y], 0.07, { fill: '#fff', stroke: EDGE, sw: 1.4 }); D.poly([[x0 - 1.3, y - 0.25], [x0 - 1.3, y + 0.25], [x0 - 1.5, y + 0.25], [x0 - 1.5, y - 0.25]], { fill: 'url(#hatch)', stroke: COL.support, sw: 1 }); }
      // load
      const top = Hc + (e.top === 'free' ? 0 : e.top === 'fixed' ? 0.28 : 0), xt = x0 + (e.top === 'free' ? amp * shapeAt(a, 1) : 0);
      D.arrow([xt, top + 1.1], [xt, top + 0.05], { color: PCOL, w: 2.6, head: 10 });
      D.text([xt, top + 1.1], 'P', { anchor: 'middle', dy: -4, color: PCOL, size: 12.5, weight: 700 });
      // effective length of the lowest braced length
      if (S().le !== false) {
        const hb = Hc / a.nb, KLd = a.K * hb, xd = x0 + 1.25, y0 = a.sup === 'ff' ? hb * 0.25 : a.sup === 'fp' ? hb * 0.3 : 0;
        const y1 = Math.min(y0 + KLd, Hc + 0.8);
        D.line([xd, y0], [xd, y1], { stroke: DCOL, sw: 1.3 });
        [y0, y1].forEach((y) => D.line([xd - 0.12, y], [xd + 0.12, y], { stroke: DCOL, sw: 1.3 }));
        D.text([xd, (y0 + y1) / 2], val(opt, `KL = ${fmt(MD.fromBase(a.KL, u.L))} ${u.L}`, 'KL'), { dx: 6, dy: 4, color: DCOL, size: 11.5, weight: 700 });
        if (a.sup === 'fr' && y1 >= Hc + 0.79) D.text([xd, y1], '(2L continues)', { dx: 6, dy: 4, color: DCOL, size: 10, weight: 500 });
      }
      D.text([x0, -0.65], `About ${a.n}${gov ? ' (buckles first)' : ''}`, { anchor: 'middle', color: col, size: 12.5, weight: 700 });
      D.text([x0, -1.0], val(opt, `K = ${fmt(a.K)}, P_cr = ${fmt(MD.fromBase(a.P, u.F))} ${u.F}`, `K = ${fmt(a.K)}`), { anchor: 'middle', color: COL.ink, size: 11.5, weight: 600 });
    });
    return true;
  };
  const val = (opt, a, b) => (opt.showP ? a : b);

  /* Chart: σ_cr against KL/r with the yield cut-off */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u, E = MD.fromBase(g.E, u.ST), sY = MD.fromBase(g.sY, u.ST);
    const sl = g.axes.map((a) => a.sl).filter((x) => isFinite(x) && x > 0);
    if (!sl.length) return false;
    const xmax = Math.max(200, ...sl.map((x) => x * 1.25)), xmin = Math.max(5, Math.PI * Math.sqrt(E / (2 * sY)));
    const eul = [], des = [];
    for (let i = 0; i <= 120; i++) { const x = xmin + ((xmax - xmin) * i) / 120, s = (Math.PI ** 2 * E) / (x * x); eul.push([x, Math.min(s, 2 * sY)]); }
    const xY = Math.PI * Math.sqrt(E / sY);
    des.push([0, sY], [xY, sY]); for (let i = 0; i <= 80; i++) { const x = xY + ((xmax - xY) * i) / 80; des.push([x, (Math.PI ** 2 * E) / (x * x)]); }
    const marks = g.axes.map((a) => { const s = Math.min(MD.fromBase(a.s, u.ST), 2 * sY); return { x: a.sl, y: s, label: `${a.k}: KL/r = ${fmt(a.sl)}`, color: a === g.g ? GOV : BCOL, anchor: a.sl > xmax * 0.6 ? 'end' : 'start', dx: a.sl > xmax * 0.6 ? -8 : 8, dy: a === g.g ? -8 : 14 }; });
    return Charts.plot(svg, {
      xlabel: 'Slenderness KL/r', ylabel: `σ_cr (${u.ST})`,
      series: [{ pts: eul, color: '#7f8c8d', dash: '6 4', width: 1.6, name: 'Euler π²E/(KL/r)²' }, { pts: des, color: COL.moment, width: 2.6, name: 'Largest stress (yield cut-off)' }],
      marks,
    });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, Hc = 6, k = showB() ? kD() : 0, amp = 0.7 * k, ga = g.g, u = g.u;
    v._hs = 0.25;
    // the section shape drawn small, with x–x and y–y: world X is the strong-axis bending direction? The column buckles
    // about its governing axis, so it bows sideways along the other axis of the section.
    const sec = g.sec, kind = sec.kind;
    const off = (s) => amp * shapeAt(ga, s);
    const dir = ga.k === 'y' ? [1, 0, 0] : [0, 0, 1]; // about y–y it bows along x (the flange direction); about x–x along z
    const n = 40;
    const prof = (() => {
      if (kind === 'W' && sec.w) { const w = sec.w, sc = 0.9 / Math.max(w.d, w.bf), hd = (w.d / 2) * sc, hb = (w.bf / 2) * sc, tf = Math.max(0.05, w.tf * sc), tw = Math.max(0.04, (w.tw / 2) * sc); return [[-hb, -hd], [hb, -hd], [hb, -hd + tf], [tw, -hd + tf], [tw, hd - tf], [hb, hd - tf], [hb, hd], [-hb, hd], [-hb, hd - tf], [-tw, hd - tf], [-tw, -hd + tf], [-hb, -hd + tf]]; }
      if (kind === 'rect' || kind === 'given') { const b = sec.b || 1, h = sec.h || 1.4, sc = 0.9 / Math.max(b, h); return [[-(b / 2) * sc, -(h / 2) * sc], [(b / 2) * sc, -(h / 2) * sc], [(b / 2) * sc, (h / 2) * sc], [-(b / 2) * sc, (h / 2) * sc]]; }
      const pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * 2 * Math.PI; pts.push([0.4 * Math.cos(t), 0.4 * Math.sin(t)]); } return pts;
    })();
    // profile (x across = section y-direction, second = section x-direction depth); world: profile[0] → X, profile[1] → Z
    for (let j = 0; j < n; j++) {
      const s0 = j / n, s1 = (j + 1) / n, o0 = off(s0), o1 = off(s1);
      const P = (p, s, o) => [p[0] + dir[0] * o, s * Hc, p[1] + dir[2] * o];
      const c = k ? root.Anim.contour(Math.abs(shapeAt(ga, (s0 + s1) / 2)) * k) : COLC;
      prof.forEach((p, i) => {
        const q = prof[(i + 1) % prof.length], nx = q[1] - p[1], nz = -(q[0] - p[0]), l = Math.hypot(nx, nz) || 1;
        v.face([P(p, s0, o0), P(q, s0, o0), P(q, s1, o1), P(p, s1, o1)], c, 1, 'fill', 1, 0, [nx / l, 0, nz / l]);
      });
    }
    v.face(prof.map((p) => [p[0] + dir[0] * off(1), Hc, p[1] + dir[2] * off(1)]), COLC, 1, EDGE, 1, 0, [0, 1, 0]);
    v.face(prof.map((p) => [p[0], 0, p[1]]), COLC, 1, EDGE, 1, 0, [0, -1, 0]);
    const e = ends(ga);
    v.box(-1.1, -0.3, -1.1, 1.1, 0, 1.1, '#d5dbe1', 1, EDGE, { layer: -1 });
    if (e.top === 'fixed') v.box(-1.1 + dir[0] * off(1), Hc, -1.1 + dir[2] * off(1), 1.1 + dir[0] * off(1), Hc + 0.3, 1.1 + dir[2] * off(1), '#d5dbe1', 1, EDGE);
    for (let b = 1; b < ga.nb; b++) { const y = (b / ga.nb) * Hc, o = off(b / ga.nb), p0 = [dir[0] * o, y, dir[2] * o]; v.line([p0, [p0[0] - dir[0] * 1.8, y, p0[2] - dir[2] * 1.8]], COL.support, 2.5); v.label([p0[0] - dir[0] * 2, y + 0.2, p0[2] - dir[2] * 2], 'brace', COL.support); }
    const tp = [dir[0] * off(1), Hc + (e.top === 'fixed' ? 0.3 : 0), dir[2] * off(1)];
    MDUI.arrow3(v, [tp[0], tp[1] + 1.4, tp[2]], [tp[0], tp[1] + 0.05, tp[2]], PCOL, 2.6);
    v.label([tp[0], tp[1] + 1.65, tp[2]], val(opt, `P_cr = ${fmt(MD.fromBase(ga.P, u.F))} ${u.F}`, 'P'), PCOL);
    v.label([1.4, 0.3, 1.4], `buckles about ${ga.n}`, GOV);
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const ax = (sup, n, K) => ({ sup, n: n || 1, K: K || 1 });
  const C0 = (o) => Object.assign({ fu: 'kN', task: 'load', L: 5, sec: { src: 'given', shape: 'circle', d: 50, di: 30, b: 50, h: 100, W: 'W8×31', A: 7500, Ix: 61.3e6, Iy: 23.2e6 }, ax: ax('pp'), ay: ax('pp'), mat: 'custom', E: 200, sY: 250, FS: 1, P: 100, step: 0 }, o);
  const SECU = (o) => Object.assign({ src: 'shape', shape: 'circle', d: 1, di: 0.5, b: 2, h: 4, W: 'W8×31', A: 10, Ix: 100, Iy: 30 }, o);
  M.presets = [
    { name: 'Test: Book Example 17.1, W8×31 pinned column 12 ft long (yields first: P = 456 kip)', units: 'US', state: C0({ fu: 'kip', L: 12, sec: SECU({ src: 'W', W: 'W8×31' }), E: 29000, sY: 50 }),
      expect: [{ k: 'Critical load about y, (P_cr)_y', v: 512 }, { k: 'Critical stress σ_cr', v: 56.1 }, { k: 'Largest load P', v: 456.5 }] },
    { name: 'Test: Book Example 17.2, aluminium column braced at the top by cables (P_allow = 141 kN)', units: 'SI', state: C0({ L: 5, ax: ax('fr'), ay: ax('fp'), E: 70, sY: 215, FS: 3 }),
      expect: [{ k: 'Critical load about x, (P_cr)_x', v: 424 }, { k: 'Critical load about y, (P_cr)_y', v: 1310 }, { k: 'Allowable load P_allow', v: 141 }] },
    { name: 'Test: Book Example 17.3, W6×15 fixed at its ends and braced at mid-height (P_cr = 263 kip)', units: 'US', state: C0({ fu: 'kip', L: 24, sec: SECU({ src: 'W', W: 'W6×15' }), ax: ax('ff'), ay: ax('fp', 2), E: 29000, sY: 60 }),
      expect: [{ k: 'Critical load about x, (P_cr)_x', v: 401.7 }, { k: 'Critical load about y, (P_cr)_y', v: 262.5 }, { k: 'Effective length about y, (KL)_y', v: 8.4 }] },
    { name: 'Test: steel rod 50 in. long fixed at its ends (P_cr = 22.5 kip)', units: 'US', state: C0({ fu: 'kip', L: 50 / 12, sec: SECU({ d: 1 }), ax: ax('ff'), ay: ax('ff'), E: 29000, sY: 36 }),
      expect: [{ k: 'Critical load P_cr', v: 22.5 }] },
    { name: 'Test: steel pipe 5 m long fixed at its ends (P_cr = 84.3 kN)', units: 'SI', state: C0({ sec: { src: 'shape', shape: 'tube', d: 50, di: 30, b: 50, h: 100, W: 'W8×31', A: 7500, Ix: 1, Iy: 1 }, ax: ax('ff'), ay: ax('ff'), E: 200, sY: 250 }),
      expect: [{ k: 'Critical load P_cr', v: 84.3 }] },
    { name: 'Timber post 2 in. × 4 in., 12 ft, pinned (buckles about the weak axis)', units: 'US', state: C0({ fu: 'kip', L: 12, sec: SECU({ shape: 'rect', b: 2, h: 4 }), E: 1600, sY: 5, FS: 2 }) },
    { name: 'Flagpole fixed at the base and free at the top', units: 'SI', state: C0({ L: 6, sec: { src: 'shape', shape: 'tube', d: 100, di: 90, b: 50, h: 100, W: 'W8×31', A: 7500, Ix: 1, Iy: 1 }, ax: ax('fr'), ay: ax('fr'), mat: 'al6061', E: 68.9, sY: 255, FS: 2 }) },
    { name: 'Size a round steel strut for 40 kN with F.S. = 2.5', units: 'SI', state: C0({ task: 'size', L: 2.5, P: 40, FS: 2.5, step: 5, sec: { src: 'shape', shape: 'circle', d: 50, di: 30, b: 50, h: 100, W: 'W8×31', A: 7500, Ix: 1, Iy: 1 }, mat: 'a36', E: 200, sY: 250 }) },
    { name: 'Lightest W shape for 250 kip on the Example 17.3 column', units: 'US', state: C0({ task: 'size', fu: 'kip', L: 24, P: 250, sec: SECU({ src: 'W' }), ax: ax('ff'), ay: ax('fp', 2), E: 29000, sY: 60 }) },
    { name: 'Longest pinned 1 in. rod for 5 kip with F.S. = 2', units: 'US', state: C0({ task: 'length', fu: 'kip', P: 5, FS: 2, sec: SECU({ d: 1 }), E: 29000, sY: 36 }) },
    { name: 'Edge: an effective-length factor of zero (fails on purpose)', units: 'SI', fails: true, state: C0({ ax: { sup: 'k', n: 1, K: 0 } }) },
  ];

  root.MBuckle = M;
})(window);
