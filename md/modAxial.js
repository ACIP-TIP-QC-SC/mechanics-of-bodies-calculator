/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M2 Axial Load
 * (inputs, diagrams, presets). Physics: md/axial.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Axial, MD, MDUI } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const LCOL = COL.load, RCOL = COL.react, NCOL = COL.axial, DCOL = '#0f8a7e', EDGE = '#4a5661', CAP = '#5d6d7e', GHOST = '#7f8c8d';
  const LET = 'ABCDEFGH';
  const MCOL = ['#b9c4cc', '#d8b26e', '#9fc1d8', '#c7a6d9'];

  const M = { id: 'axial', title: 'Axial Load', defaults: Axial.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const deformOn = () => mode() !== 'conc' && S().defl !== false;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const matOpts = () => [['custom', 'Your own values']].concat(MD.MATERIALS.filter((m) => m.SI.E && m.SI.al).map((m) => [m.id, m.name]));
  const fillMat = (it) => { const m = MD.material(it.mat, M.units); if (!m) return; it.E = m.E; it.al = m.al; };
  const shapeFields = (it, u, shapes) => {
    const f = [{ key: 'shape', label: 'Cross-section', options: shapes || [['circle', 'Round'], ['tube', 'Tube'], ['rect', 'Rectangle'], ['area', 'Area']], wide: true }];
    if (it.shape === 'circle' || it.shape === 'tube') f.push({ key: 'd', label: it.shape === 'tube' ? 'Outer d_o' : 'Diameter d', unit: u.S });
    if (it.shape === 'tube') f.push({ key: 'di', label: 'Inner d_i', unit: u.S });
    if (it.shape === 'rect') f.push({ key: 'b', label: 'Width b', unit: u.S }, { key: 'h', label: 'Depth h', unit: u.S });
    if (it.shape === 'area') f.push({ key: 'A', label: 'Area A', unit: u.A });
    return f;
  };
  const matFields = (u, thermal) => [{ key: 'mat', label: 'Material', options: matOpts(), onset: fillMat, wide: true }, { key: 'E', label: 'E', unit: u.MOD }].concat(thermal ? [{ key: 'al', label: 'α (10⁻⁶)', unit: `/${u.T}` }] : []);

  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], u = MD.units(U, st.fu);
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; delete st._p; }, options: [['bar', 'Stepped bar with loads along it'], ['parallel', 'Members side by side under a rigid cap'], ['rigid', 'Rigid bar on rods or posts'], ['conc', 'Stress concentration at a hole or fillet']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    if (st.mode === 'bar') {
      const q = st.ax, n = q.segs.length;
      sec = C.section(c, 'Supports');
      C.note(sec, 'The bar is held by a wall at A, on the left. Segments run from A to the right.');
      C.seg(sec, { label: `The far end ${LET[n]} is`, get: () => q.right, set: (v) => (q.right = v), options: [['free', 'Free'], ['fixed', 'Fixed to a wall'], ['gap', 'Short of a wall']] });
      if (q.right === 'gap') num(sec, q, 'gap', 'Gap to the wall', u.S);
      num(sec, q, 'dT', 'Temperature change ΔT (0 = none)', u.T);
      sec = C.section(c, 'Segments, from A');
      C.note(sec, 'Each load acts at the right end of its segment: positive away from A (to the right), negative toward A.');
      C.list(sec, {
        items: q.segs, max: 5, min: 1,
        title: (it, i) => `Segment ${LET[i]}${LET[i + 1]}`,
        fields: (it, i) => [{ key: 'L', label: 'Length L', unit: u.L }].concat(shapeFields(it, u), matFields(u, +q.dT !== 0),
          i === n - 1 && q.right !== 'free' ? [] : [{ key: 'P', label: `Load at ${LET[i + 1]}`, unit: u.F }]),
        add: [['Segment', () => Object.assign({}, q.segs[q.segs.length - 1], { P: 0 })]],
      });
    } else if (st.mode === 'parallel') {
      const q = st.par;
      sec = C.section(c, 'Cap and load');
      num(sec, q, 'P', 'Load on the cap P (+ pushes down)', u.F);
      num(sec, q, 'L', 'Length of the members L', u.L);
      num(sec, q, 'dT', 'Temperature change ΔT (0 = none)', u.T);
      C.seg(sec, { label: 'Arrangement', get: () => q.layout, set: (v) => (q.layout = v), options: [['nested', 'One inside another'], ['side', 'Side by side']] });
      sec = C.section(c, 'Members');
      if (q.layout === 'nested') C.note(sec, 'Member 1 is the outer one (usually a tube); member 2 sits inside it.');
      C.list(sec, {
        items: q.mem, max: q.layout === 'nested' ? 2 : 4, min: 2,
        title: (it, i) => `Member ${i + 1}`, color: (it, i) => MCOL[i],
        fields: (it) => (q.layout === 'side' ? [{ key: 'n', label: 'How many', unit: '', step: 1 }] : []).concat(shapeFields(it, u), matFields(u, +q.dT !== 0)),
        add: [['Member', () => Object.assign({}, q.mem[q.mem.length - 1], { n: 1 })]],
      });
    } else if (st.mode === 'rigid') {
      const q = st.rig, noun = q.side === 'post' ? 'Post' : 'Rod';
      sec = C.section(c, 'Rigid bar');
      C.seg(sec, { label: 'The bar is', get: () => q.side, set: (v) => (q.side = v), options: [['hang', 'Hung from rods'], ['post', 'Resting on posts']] });
      num(sec, q, 'len', 'Length of the bar', u.L);
      C.toggle(sec, { label: 'Pinned at one point', get: () => !!q.pin, set: (v) => (q.pin = v) });
      if (q.pin) num(sec, q, 'xp', 'Pin position x', u.L);
      num(sec, q, 'dT', 'Temperature change ΔT (0 = none)', u.T);
      sec = C.section(c, `${noun}s`);
      C.note(sec, 'Positions x are measured from the left end of the bar.');
      C.list(sec, {
        items: q.rods, max: 3, min: 1, title: (it, i) => `${noun} ${i + 1}`,
        fields: (it) => [{ key: 'x', label: 'Position x', unit: u.L }, { key: 'L', label: 'Length L', unit: u.L }].concat(shapeFields(it, u, [['circle', 'Round'], ['area', 'Area']]), matFields(u, +q.dT !== 0)),
        add: [[noun, () => Object.assign({}, q.rods[q.rods.length - 1], { x: Core.tidy(Math.min(+q.len, +q.rods[q.rods.length - 1].x + +q.len / 4), 4) })]],
      });
      sec = C.section(c, 'Loads on the bar (downward)');
      num(sec, q, 'w', 'Uniform load over the whole bar w (0 = none)', u.W);
      C.list(sec, { items: q.loads, max: 4, min: 0, title: (it, i) => `Load ${i + 1}`, color: () => LCOL, fields: () => [{ key: 'x', label: 'Position x', unit: u.L }, { key: 'P', label: 'Force P', unit: u.F }], add: [['Load', () => ({ x: Core.tidy(+q.len / 2, 4), P: 10 })]] });
    } else {
      const q = st.cn;
      sec = C.section(c, 'Bar');
      C.seg(sec, { label: 'Change in section', get: () => q.geo, set: (v) => (q.geo = v), options: [['fillet', 'Shoulder fillets'], ['hole', 'Hole']] });
      num(sec, q, 'w', 'Width w', u.S);
      if (q.geo === 'fillet') { num(sec, q, 'h', 'Narrow width h', u.S); num(sec, q, 'r', 'Fillet radius r', u.S); }
      else num(sec, q, 'd', 'Hole diameter 2r', u.S);
      num(sec, q, 't', 'Thickness t', u.S);
      sec = C.section(c, 'Stress concentration factor');
      C.note(sec, q.geo === 'fillet' ? 'Read K from the chart for flat bars with shoulder fillets (Fig. 9–23), using r/h and w/h; the ratios are shown in the solution.' : 'Read K from the chart for flat bars with a hole (Fig. 9–24), using 2r/w; the ratio is shown in the solution.');
      num(sec, q, 'K', 'K', '');
      sec = C.section(c, 'Find');
      C.seg(sec, { get: () => q.task, set: (v) => (q.task = v), options: [['max', 'Peak stress for a load'], ['allow', 'Largest load']] });
      if (q.task === 'max') num(sec, q, 'N', 'Axial force N', u.F); else num(sec, q, 'sA', 'Stress not to be passed (allowable or yield)', u.ST);
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (st.mode !== 'conc') C.toggle(c, { label: 'Show the deformed shape (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    if (st.mode === 'bar') C.toggle(c, { label: 'Show the normal-force and displacement diagrams', get: () => st.diag !== false, set: (v) => (st.diag = v) });
    if (st.mode === 'conc') C.toggle(c, { label: 'Show the stress on the smallest section', get: () => st.dist !== false, set: (v) => (st.dist = v) });
  };

  M.compute = (U) => Axial.solve(S(), U);
  M.onUnits = (from, to) => Axial.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ bar: 'Bar, normal force and displacement', parallel: 'Members under the cap', rigid: 'Rigid bar and its supports', conc: 'Bar and the stress on its smallest section' }[mode()]);
  M.cap3D = () => '3D view';
  M.hint = () => ({
    bar: 'Loads are positive away from A. The deformed shape is exaggerated: press Play to watch the bar stretch and shorten. Below are the normal-force diagram and the displacement of each point.',
    parallel: 'The cap is rigid, so every member moves the same amount. The movement is exaggerated: press Play to watch the members shorten.',
    rigid: 'The bar is rigid: it stays straight while the rods or posts stretch or shorten. Movements are exaggerated; press Play to watch it settle.',
    conc: 'The peak stress sits at the edge of the smallest section. The curve is a sketch of the distribution with that peak; press Play to load the bar.',
  }[mode()]);
  M.legend = () => ({
    bar: [[LCOL, 'Loads'], [RCOL, 'Reactions'], [NCOL, 'Normal force N', 'sq'], [DCOL, 'Displacement', 'ln']],
    parallel: [[LCOL, 'Load P'], [DCOL, 'Deformed shape', 'ln']],
    rigid: [[LCOL, 'Loads'], [RCOL, 'Member forces'], [DCOL, 'Deformed shape', 'ln']],
    conc: [[LCOL, 'Axial force N'], [COL.shear, 'Stress on the section', 'sq']],
  }[mode()]);
  const deflect = root.Anim.deflection(S);
  const loadUp = { duration: 10, loop: true, frame(t) { const st = S(); if (t <= 0) delete st._p; else st._p = Math.min(1, t / 0.85); }, label() { const p = S()._p; return p === undefined ? 'full load' : `loading ${Math.round(p * 100)} %`; } };
  M.anim = () => (deformOn() ? deflect : mode() === 'conc' ? loadUp : null);

  /* ------------------------------------------------------------------ */
  /* 2D diagrams                                                        */
  /* ------------------------------------------------------------------ */
  const val = (opt, a, b) => (opt.showP ? a : b);
  const hatchBox = (D, x0, y0, x1, y1) => D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: 'url(#hatch)', stroke: COL.support, sw: 1 });
  const contour = (t) => root.Anim.contour(t);
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'bar') return drawBar(svg, g, opt);
    if (g.kind === 'parallel') return drawPar(svg, g, opt);
    if (g.kind === 'rigid') return drawRigid(svg, g, opt);
    return drawConc(svg, g, opt);
  };

  /* stepped bar: geometry in a frame where the bar is 10 long */
  function barGeo(g) {
    const Ls = 10, sc = Ls / g.Lsum, Amax = Math.max(...g.sg.map((t) => t.A));
    const xs = [0]; g.sg.forEach((t) => xs.push(xs[xs.length - 1] + t.L * sc));
    const hh = g.sg.map((t) => 0.32 + 0.6 * Math.sqrt(t.A / Amax));
    const uw = g.disp.map((d) => d * sc), um = Math.max(...uw.map(Math.abs));
    let amp = MDUI.exag(Ls, um, 0.06), gw = 0;
    if (g.right === 'gap') { gw = g.gap * sc * amp; if (!(gw >= 0.35)) { amp = amp > 0 ? (amp * 0.35) / (gw || 1) : 0.35 / (g.gap * sc); gw = 0.35; } }
    const smax = Math.max(...g.sg.map((t) => Math.abs(t.sig))) || 1;
    return { Ls, sc, xs, hh, uw, amp, gw, smax };
  }
  function drawBar(svg, g, opt) {
    const u = g.u, n = g.sg.length, diag = S().diag !== false;
    const H = svg.clientHeight || 560, padB = diag ? Math.max(200, H * 0.5) : 0;
    const G = barGeo(g), { Ls, xs, hh, uw, gw } = G, hm = Math.max(...hh);
    const k = deformOn() ? kD() : 0, amp = G.amp * k;
    const xr = Ls + gw + 2.6;
    const D = UI.Draw2D(svg, { xmin: -2.6, xmax: xr, ymin: -hm - 1.5, ymax: hm + 1.7 }, { padB, pad: 40 });
    const X = (i) => xs[i] + uw[i] * amp;
    // walls
    hatchBox(D, -0.45, -hm - 0.6, 0, hm + 0.6);
    D.text([-0.22, hm + 0.6], 'A', { anchor: 'middle', dy: -6, size: 13, weight: 700 });
    if (g.right !== 'free') {
      const xw = Ls + (g.right === 'gap' ? gw : 0);
      hatchBox(D, xw, -hm - 0.6, xw + 0.45, hm + 0.6);
      if (g.right === 'gap') { D.dim([Ls, hm + 0.9], [xw, hm + 0.9], '', 0); D.line([Ls, hh[n - 1]], [Ls, hm + 1], { stroke: COL.dim, sw: 0.8 }); D.text([(Ls + xw) / 2, hm + 0.9], val(opt, `gap ${fmt(+g.q.gap)} ${u.S}`, 'gap'), { anchor: 'middle', dy: -8, size: 11.5, color: COL.dim }); }
    }
    // ghost and segments
    g.sg.forEach((t, i) => {
      if (k > 0) D.poly([[xs[i], -hh[i]], [xs[i + 1], -hh[i]], [xs[i + 1], hh[i]], [xs[i], hh[i]]], { stroke: GHOST, sw: 1.1, dash: '6 4' });
      const col = k > 0 ? contour(0.2 + 0.6 * k * Math.abs(t.sig) / G.smax) : COL.body;
      D.poly([[X(i), -hh[i]], [X(i + 1), -hh[i]], [X(i + 1), hh[i]], [X(i), hh[i]]], { fill: col, fop: 0.88, stroke: EDGE, sw: 1.5 });
      if (opt.showP && xs[i + 1] - xs[i] > 1.3) D.text([(X(i) + X(i + 1)) / 2, 0], `σ = ${fmt(MD.fromBase(t.sig, u.ST))}`, { anchor: 'middle', dy: 4, size: 11, color: COL.ink });
    });
    // point letters and segment lengths
    for (let i = 1; i <= n; i++) { const lo = Math.max(hh[i - 1], hh[i] || 0) + 0.12 + (g.sg[i - 1].P ? 0.25 : 0); D.text([X(i), -lo], LET[i], { anchor: 'middle', dy: g.sg[i - 1].P ? 22 : 16, size: 12.5, weight: 700 }); }
    g.sg.forEach((t, i) => D.dim([xs[i], -hm - 1.05], [xs[i + 1], -hm - 1.05], `${fmt(+t.q.L)} ${u.L}`, 0));
    // loads: a pair of arrows on a collar at the end of each segment
    const Pm = Math.max(1e-12, ...g.sg.map((t) => Math.abs(t.P)));
    g.sg.forEach((t, i) => {
      if (!t.P) return;
      const x = X(i + 1), h = Math.max(hh[i], hh[i + 1] || 0) + 0.12, len = 0.8 + 0.6 * Math.abs(t.P) / Pm, dir = Math.sign(t.P);
      D.poly([[x - 0.06, -h], [x + 0.06, -h], [x + 0.06, h], [x - 0.06, h]], { fill: CAP, stroke: EDGE, sw: 1 });
      [h + 0.25, -h - 0.25].forEach((y) => { const a = dir > 0 ? [x, y] : [x + len, y], b = dir > 0 ? [x + len, y] : [x, y]; D.arrow(a, b, { color: LCOL, w: 2.6, head: 11 }); });
      D.text([x + len / 2, h + 0.25], val(opt, `${fmt(Math.abs(MD.fromBase(t.P, u.F)))} ${u.F}`, `P${LET[i + 1]}`), { anchor: 'middle', dy: -9, size: 12, color: LCOL, weight: 700 });
    });
    // reactions
    const FA = g.FA, ra = (x0, F, lab, right) => {
      if (Math.abs(F) < 1e-12) return;
      const y = 0, len = 0.9, tail = right ? x0 + 0.45 + len : x0 - 0.45 - len, head = right ? x0 + 0.45 : x0 - 0.45;
      const toWall = (F > 0) !== right; // positive reaction points left
      D.arrow(toWall ? [head, y] : [tail, y], toWall ? [tail, y] : [head, y], { color: RCOL, w: 2.6, head: 11 });
      D.text([right ? head : head, y], val(opt, `${lab} = ${fmt(Math.abs(MD.fromBase(F, u.F)))} ${u.F}`, lab), { anchor: right ? 'start' : 'end', dx: right ? 2 : -2, dy: -10, size: 11.5, color: RCOL, weight: 700 });
    };
    ra(-0.45 + 0.45 - 0.45, FA, 'F_A', false);
    if (g.right !== 'free' && g.contact) ra(Ls + (g.right === 'gap' ? gw : 0), g.FB, `F_${LET[n]}`, true);
    if (!diag) return;
    // normal-force and displacement diagrams, lined up with the bar
    const W = D.W, x0 = D.X(0), w = D.X(Ls) - x0, top = H - padB + 18, ph = (padB - 18 - 34 - 14) / 2;
    const L = g.Lsum, Lu = (x) => MD.fromBase(x, u.L), xt = xs.map((x) => (x / Ls) * Lu(L));
    const Nv = g.sg.map((t) => MD.fromBase(t.N, u.F)), lo = Math.min(0, ...Nv), hi = Math.max(0, ...Nv);
    const F1 = Charts.frame(svg, { x: x0, y: top, w, h: ph, xmin: 0, xmax: Lu(L), ymin: lo, ymax: hi, ylabel: `N (${u.F})`, ycolor: NCOL, yside: 46, xticks: false, padY: 0.25 });
    g.sg.forEach((t, i) => {
      const v = Nv[i];
      Charts.curve(F1, [[xt[i], 0], [xt[i], v], [xt[i + 1], v], [xt[i + 1], 0]], { color: NCOL, fill: NCOL, fop: 0.22, width: 2 });
      if (opt.showP) T(F1.g, F1.X((xt[i] + xt[i + 1]) / 2), F1.Y(v) + (v >= 0 ? -5 : 14), fmt(v), { anchor: 'middle', color: NCOL, size: 11 });
    });
    const dv = g.disp.map((d) => MD.fromBase(d, u.S)), dlo = Math.min(0, ...dv), dhi = Math.max(0, ...dv);
    const F2 = Charts.frame(svg, { x: x0, y: top + ph + 14, w, h: ph, xmin: 0, xmax: Lu(L), ymin: dlo, ymax: dhi, ylabel: `δ (${u.S})`, ycolor: DCOL, yside: 46, xticks: xt, padY: 0.25, xlabel: `x (${u.L})` });
    Charts.curve(F2, xt.map((x, i) => [x, dv[i] * (k || 1)]), { color: DCOL, width: 3 });
    if (opt.showP) xt.forEach((x, i) => { if (i && Math.abs(dv[i]) > 1e-12) { Charts.mark(F2, x, dv[i] * (k || 1), fmt(dv[i]), { color: DCOL, anchor: i === n ? 'end' : 'middle', dx: i === n ? -6 : 0, dy: dv[i] >= 0 ? -8 : 16 }); } });
    void W;
  }

  /* members under a rigid cap */
  function parLayout(g) {
    const items = [];
    if (g.q.layout === 'nested') g.M.forEach((m, i) => items.push({ i, m }));
    else g.M.forEach((m, i) => { for (let j = 0; j < Math.min(m.n, 4); j++) items.push({ i, m }); });
    return items;
  }
  const dia = (mm) => (mm.shape === 'circle' || mm.shape === 'tube' ? +mm.d : mm.shape === 'rect' ? +mm.b : Math.sqrt(+mm.A));
  function drawPar(svg, g, opt) {
    const u = g.u, Hh = 6, items = parLayout(g), k = deformOn() ? kD() : 0;
    const dw = MD.fromBase(g.del, u.L) * (10 / MD.fromBase(g.L, u.L) * (Hh / 10)), amp = MDUI.exag(Hh, Math.abs(dw), 0.07) * k, down = dw * amp;
    const smax = Math.max(...g.M.map((m) => Math.abs(m.sig))) || 1;
    let xmin, xmax;
    if (g.q.layout === 'nested') { xmin = -3.2; xmax = 3.2; } else { xmin = -1.4; xmax = items.length * 2.2 - 0.8; }
    const D = UI.Draw2D(svg, { xmin: xmin - 2.6, xmax: xmax + 2.6, ymin: -1.3, ymax: Hh + 3.2 });
    hatchBox(D, xmin - 0.4, -0.6, xmax + 0.4, 0);
    const top = Hh - down, colOf = (m) => (k > 0 ? contour(0.2 + 0.6 * k * Math.abs(m.sig) / smax) : MCOL[g.M.indexOf(m)]);
    const rect = (x0, x1, y1, fill, ghost) => D.poly([[x0, 0], [x1, 0], [x1, y1], [x0, y1]], ghost ? { stroke: GHOST, sw: 1.1, dash: '6 4' } : { fill, fop: 0.9, stroke: EDGE, sw: 1.4 });
    const labs = [];
    if (g.q.layout === 'nested') {
      const [o, c] = g.M, Do = dia(o.m), R = 2.6, ri = o.m.shape === 'tube' ? Math.max(0.5, (o.m.di / o.m.d) * R) : 1.9, rc = Math.min(ri - 0.15, Math.max(0.4, (dia(c.m) / Do) * R));
      if (k > 0) { rect(-R, R, Hh, null, true); }
      rect(-R, -ri, top, colOf(o)); rect(ri, R, top, colOf(o)); rect(-rc, rc, top, colOf(c));
      if (c.m.shape === 'tube') rect(-rc * (c.m.di / c.m.d), rc * (c.m.di / c.m.d), top, '#ffffff');
      labs.push([o, [R, Hh * 0.5], 'start'], [c, [0, Hh * 0.28], 'middle']);
      D.poly([[-R - 0.3, top], [R + 0.3, top], [R + 0.3, top + 0.55], [-R - 0.3, top + 0.55]], { fill: CAP, stroke: EDGE, sw: 1.4 });
      xmin = -R - 0.3; xmax = R + 0.3;
    } else {
      const Dm = Math.max(...items.map((it) => dia(it.m.m)));
      items.forEach((it, j) => { const cx = j * 2.2 + 0.3, hw = 0.25 + 0.5 * (dia(it.m.m) / Dm); if (k > 0) rect(cx - hw, cx + hw, Hh, null, true); rect(cx - hw, cx + hw, top, colOf(it.m)); if (!items.slice(0, j).some((o) => o.i === it.i)) labs.push([it.m, [cx + hw, Hh * 0.5], 'start']); });
      D.poly([[xmin, top], [xmax, top], [xmax, top + 0.55], [xmin, top + 0.55]], { fill: CAP, stroke: EDGE, sw: 1.4 });
    }
    labs.forEach(([m, p, an], j) => {
      const i = g.M.indexOf(m), F = MD.fromBase(m.F, u.F), sg = MD.fromBase(m.sig, u.ST);
      const pos = an === 'middle' ? [p[0], p[1]] : [p[0] + 0.15, p[1] - j * 0.2];
      D.text(pos, `${i + 1}`, { anchor: an === 'middle' ? 'middle' : 'start', dy: -18, size: 13, weight: 700, color: COL.ink });
      if (opt.showP) {
        D.text(pos, `F = ${fmt(Math.abs(F))} ${u.F} (${F >= 0 ? 'C' : 'T'})`, { anchor: an === 'middle' ? 'middle' : 'start', dy: -2, size: 11.5, color: RCOL });
        D.text(pos, `σ = ${fmt(Math.abs(sg))} ${u.ST}`, { anchor: an === 'middle' ? 'middle' : 'start', dy: 13, size: 11.5, color: COL.ink });
      }
    });
    const cx = (xmin + xmax) / 2, P = MD.fromBase(MD.toBase(+g.q.P, u.F), u.F);
    if (Math.abs(P) > 0) {
      const a = [cx, top + 0.55], b = [cx, top + 2.2];
      D.arrow(P > 0 ? b : a, P > 0 ? a : b, { color: LCOL, w: 3, head: 13 });
      D.text(b, val(opt, `P = ${fmt(Math.abs(P))} ${u.F}`, 'P'), { anchor: 'middle', dy: -8, color: LCOL, size: 12.5, weight: 700 });
    }
    D.dim([xmin - 1.1, 0], [xmin - 1.1, Hh], `L = ${fmt(+g.q.L)} ${u.L}`, 0);
    if (+g.q.dT) D.text([xmax + 0.6, 0.3], `ΔT = ${fmt(+g.q.dT)} ${u.T}`, { anchor: 'start', size: 12, color: '#b9770e' });
    if (k > 0 && opt.showP) D.text([xmax, top + 0.3], `cap moves ${fmt(Math.abs(MD.fromBase(g.del, u.S)))} ${u.S} ${g.del >= 0 ? 'down' : 'up'}`, { anchor: 'start', dx: 8, dy: 4, size: 11.5, color: DCOL });
  }

  /* rigid bar on rods or posts */
  function rigGeo(g) {
    const len = MD.fromBase(g.Lb, g.u.L), sx = 10 / len, Lmax = Math.max(...g.Rd.map((r) => r.L));
    const rl = (r) => 2.2 + 3.2 * (r.L / Lmax);
    const dm = Math.max(...g.Rd.map((r) => Math.abs(r.d)), Math.abs(g.v0), Math.abs(g.v0 + g.th * g.Lb));
    return { sx, rl, X: (xb) => MD.fromBase(xb, g.u.L) * sx, amp: dm > 0 ? (0.7 / MD.fromBase(dm, g.u.L)) / sx : 0, dm };
  }
  function drawRigid(svg, g, opt) {
    const u = g.u, G = rigGeo(g), k = deformOn() ? kD() : 0, hang = g.hang, sgn = hang ? 1 : -1;
    const dy = (xb) => -MD.fromBase(g.v0 + g.th * xb, u.L) * G.sx * G.amp * k; // world shift (down negative)
    const bt = 0.32, top = Math.max(...g.Rd.map(G.rl));
    const D = UI.Draw2D(svg, hang ? { xmin: -2, xmax: 12, ymin: -3.6, ymax: top + 1 } : { xmin: -2, xmax: 12, ymin: -top - 1, ymax: 4 });
    const smax = Math.max(...g.Rd.map((r) => Math.abs(r.sig))) || 1;
    // rods or posts
    g.Rd.forEach((r, i) => {
      const x = G.X(r.x), end = sgn * G.rl(r), yb = sgn * bt + dy(r.x), wpx = Math.max(0.1, Math.min(0.32, 0.12 + 0.05 * Math.sqrt(MD.fromBase(r.A, u.A) / (u.us ? 0.05 : 30))));
      hatchBox(D, x - 0.6, end, x + 0.6, end + sgn * 0.35);
      if (k > 0) D.line([x, sgn * bt], [x, end], { stroke: GHOST, sw: 1.1, dash: '6 4' });
      D.poly([[x - wpx, yb], [x + wpx, yb], [x + wpx, end], [x - wpx, end]], { fill: k > 0 ? contour(0.2 + 0.6 * k * Math.abs(r.sig) / smax) : '#8fa3b3', stroke: EDGE, sw: 1.2 });
      const f = 0.3 + 0.22 * i, mid = [x, yb + (end - yb) * f], right = i === g.Rd.length - 1 && x > 8;
      D.text(mid, `${i + 1}`, { anchor: right ? 'end' : 'start', dx: right ? -10 : 10, dy: -14, size: 12.5, weight: 700 });
      if (opt.showP) {
        D.text(mid, `F${i + 1} = ${fmt(MD.fromBase(r.F, u.F))} ${u.F}`, { anchor: right ? 'end' : 'start', dx: right ? -10 : 10, dy: 2, size: 11.5, color: RCOL });
        D.text(mid, `σ = ${fmt(MD.fromBase(r.sig, u.ST))} ${u.ST}`, { anchor: right ? 'end' : 'start', dx: right ? -10 : 10, dy: 17, size: 11.5, color: COL.ink });
      }
    });
    // the bar
    const xe = 10, b0 = dy(0), b1 = dy(g.Lb);
    if (k > 0) D.poly([[0, -bt], [xe, -bt], [xe, bt], [0, bt]], { stroke: GHOST, sw: 1.1, dash: '6 4' });
    D.poly([[0, -bt + b0], [xe, -bt + b1], [xe, bt + b1], [0, bt + b0]], { fill: '#6f7f8c', stroke: EDGE, sw: 1.5 });
    // pin
    if (g.q.pin) {
      const x = G.X(g.xp), y = -bt;
      D.poly([[x, y], [x - 0.45, y - 0.8], [x + 0.45, y - 0.8]], { fill: '#e8eef1', stroke: COL.support, sw: 1.4 });
      hatchBox(D, x - 0.7, y - 0.8, x + 0.7, y - 1.05);
      D.circle([x, y], 0.12, { fill: '#fff', stroke: EDGE, sw: 1.4 });
      if (opt.showP) D.text([x, y - 1.05], `R = ${fmt(MD.fromBase(g.Rpin, u.F))} ${u.F}`, { anchor: 'middle', dy: 16, size: 11.5, color: RCOL });
    }
    // loads (downward, on top of the bar)
    const Pm = Math.max(1e-12, ...g.P.filter((p) => !p.dist).map((p) => Math.abs(p.P)));
    if (g.w) {
      const yb = bt + Math.max(b0, b1);
      D.poly([[0, yb + 0.1], [xe, yb + 0.1], [xe, yb + 0.7], [0, yb + 0.7]], { fill: LCOL, fop: 0.12, stroke: LCOL, sw: 1.2 });
      for (let i = 0; i <= 10; i++) D.arrow([i, yb + 0.7], [i, yb + 0.1 + (dy((i / 10) * g.Lb) - Math.max(b0, b1))], { color: LCOL, w: 1.3, head: 7 });
      D.text([xe / 2, yb + 0.7], val(opt, `w = ${fmt(+g.q.w)} ${u.W}`, 'w'), { anchor: 'middle', dy: -6, size: 12, color: LCOL, weight: 700 });
    }
    g.P.filter((p) => !p.dist).forEach((p) => {
      const x = G.X(p.x), yb = bt + dy(p.x) + (g.w ? 0.75 : 0), len = 1 + 0.8 * Math.abs(p.P) / Pm;
      D.arrow([x, yb + len], [x, yb], { color: LCOL, w: 3, head: 12 });
      D.text([x, yb + len], val(opt, `${fmt(MD.fromBase(p.P, u.F))} ${u.F}`, 'P'), { anchor: 'middle', dy: -7, size: 12, color: LCOL, weight: 700 });
    });
    // positions along the bar
    const yd = hang ? -bt - 2.3 : bt + 3.1, ticks = [...new Set([0, 10].concat(g.Rd.map((r) => G.X(r.x)), g.P.filter((p) => !p.dist).map((p) => G.X(p.x)), g.q.pin ? [G.X(g.xp)] : []).map((x) => +x.toFixed(6)))].sort((a, b) => a - b);
    D.line([0, yd], [10, yd], { stroke: COL.dim, sw: 1 });
    let last = -9; ticks.forEach((x, i) => { D.line([x, yd - 0.12], [x, yd + 0.12], { stroke: COL.dim, sw: 1 }); if (x - last > 0.7 || i === ticks.length - 1) { D.text([x, yd], fmt(x / G.sx) + (i === ticks.length - 1 ? ` ${u.L}` : ''), { anchor: 'middle', dy: hang ? 16 : -6, size: 10.5, color: COL.dim }); last = x; } });
    D.text([0, yd], 'x =', { anchor: 'end', dx: -8, dy: 4, size: 10.5, color: COL.dim });
    if (k > 0 && opt.showP) D.text([xe, bt + b1], `${fmt(Math.abs(MD.fromBase(g.v0 + g.th * g.Lb, u.S)))} ${u.S}`, { anchor: 'start', dx: 8, dy: 4, size: 11.5, color: DCOL });
    if (k > 0 && opt.showP) D.text([0, bt + b0], `${fmt(Math.abs(MD.fromBase(g.v0, u.S)))} ${u.S}`, { anchor: 'end', dx: -8, dy: 4, size: 11.5, color: DCOL });
  }

  /* stress concentration: plate with the change of section and the stress on section a–a */
  function concShape(g) {
    const q = g.q, hole = q.geo === 'hole', w = +q.w, L = w * 2.6;
    return { hole, w, L, h: hole ? w - q.d : +q.h, r: hole ? q.d / 2 : +q.r };
  }
  /** Sketch of the stress across the smallest section: peak σ_max at the edge, mean σ_avg (unit-free shape). */
  function distFn(g) {
    const c = concShape(g), smax = g.smax, savg = g.savg, n = 60;
    const half = c.hole ? (c.w / 2 - c.r) : c.h / 2;
    const gp = c.hole ? (e) => { const y = c.r + e; return 0.5 * (c.r / y) ** 2 + 1.5 * (c.r / y) ** 4; } : (e) => (c.r / (c.r + 1.6 * e)) ** 2;
    let m = 0; for (let i = 0; i < n; i++) m += gp(((i + 0.5) / n) * half) / n;
    const g0 = gp(0), b = (smax - savg) / (g0 - m || 1), a = savg - b * m;
    return { f: (e) => a + b * gp(e), half };
  }
  function drawConc(svg, g, opt) {
    const u = g.u, c = concShape(g), p = S()._p === undefined ? 1 : S()._p, dist = S().dist !== false;
    const sc = 10 / c.L, W2 = (c.w / 2) * sc, H2 = (c.h / 2) * sc, R = c.r * sc, L2 = 5;
    const xr = dist ? L2 + 5.4 : L2 + 2.6;
    const D = UI.Draw2D(svg, { xmin: -L2 - 2.6, xmax: xr, ymin: -W2 - 1.6, ymax: W2 + 1.4 });
    const fill = { fill: COL.body, fop: 0.9, stroke: EDGE, sw: 1.5 };
    const half = dist; // cut at section a–a: show the left part and the stress on the cut
    const xc = 0, xR = half ? xc : L2;
    if (c.hole) {
      D.poly([[-L2, -W2], [xR, -W2], [xR, W2], [-L2, W2]], fill);
      const arcPts = (a0, a1) => Array.from({ length: 25 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 24; return [xc + R * Math.cos(a), R * Math.sin(a)]; });
      D.poly(half ? [[xc, -R], ...arcPts(-Math.PI / 2, -Math.PI * 1.5).slice(1)] : arcPts(0, 2 * Math.PI), { fill: '#ffffff', stroke: EDGE, sw: 1.5 });
    } else {
      // wide part on the left, narrow part on the right, fillets of radius r between them
      // the fillet is tangent to the narrow edge at x = 0 and to the shoulder at x = −r
      const fil = (sg) => Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * (Math.PI / 2); return [-R * Math.sin(a), sg * Math.min(W2, H2 + R - R * Math.cos(a))]; });
      D.poly([[-L2, -W2], [-R, -W2]].concat(fil(-1).reverse(), [[xR, -H2], [xR, H2]], fil(1), [[-R, W2], [-L2, W2]]), fill);
    }
    // axial force arrows
    const N = g.N * p, len = 1.6;
    D.arrow([-L2, 0], [-L2 - len, 0], { color: LCOL, w: 3, head: 13 });
    D.text([-L2 - len / 2, 0], val(opt, `N = ${fmt(N)} ${u.F}`, 'N'), { anchor: 'middle', dy: -12, color: LCOL, size: 12.5, weight: 700 });
    if (!half) { D.arrow([L2, 0], [L2 + len, 0], { color: LCOL, w: 3, head: 13 }); }
    // section a–a
    const ya = W2 + 0.6, xa = c.hole ? xc : xc;
    D.line([xa, -ya], [xa, ya], { stroke: COL.dim, sw: 1.2, dash: '7 4' });
    D.text([xa, ya], 'a', { anchor: 'middle', dy: -4, size: 12.5, weight: 700, color: COL.dim }); D.text([xa, -ya], 'a', { anchor: 'middle', dy: 14, size: 12.5, weight: 700, color: COL.dim });
    // dimensions
    D.dim([-L2 + 0.8, -W2], [-L2 + 0.8, W2], `w = ${fmt(c.w)}`, 0);
    if (!c.hole && !half) D.dim([L2 - 0.8, -H2], [L2 - 0.8, H2], `h = ${fmt(c.h)}`, 0);
    D.text(c.hole ? [xc - R, 0] : [-R / 2, W2], c.hole ? `2r = ${fmt(+g.q.d)}` : `r = ${fmt(+g.q.r)}`, { anchor: c.hole ? 'end' : 'middle', dx: c.hole ? -5 : 0, dy: c.hole ? 4 : -8, size: 11.5, color: COL.dim });
    D.text([-L2 / 2 - 1, -W2], `t = ${fmt(+g.q.t)} ${u.S}`, { anchor: 'middle', dy: 18, size: 11.5, color: COL.dim });
    if (!dist) return;
    // stress on the cut, drawn to the right of it
    const F = distFn(g), smax = g.smax, scs = 3.6 / (smax || 1), ys = [];
    const yEdge = c.hole ? [[R, W2], [-W2, -R]] : [[-H2, H2]];
    const SC = COL.shear;
    yEdge.forEach(([y0, y1]) => {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const y = y0 + ((y1 - y0) * i) / 40;
        const e = c.hole ? (Math.abs(y) - R) / sc : (c.h / 2 - Math.abs(y / sc));
        pts.push([xa + Math.max(0, F.f(Math.max(0, e))) * scs * p, y]); ys.push(y);
      }
      D.poly([[xa, y0]].concat(pts).concat([[xa, y1]]), { fill: SC, fop: 0.18, stroke: SC, sw: 2 });
      for (let i = 0; i <= 8; i++) { const pt = pts[Math.round((i / 8) * 40)]; if (pt[0] - xa > 0.25) D.arrow([xa, pt[1]], [pt[0], pt[1]], { color: SC, w: 1.3, head: 7 }); }
    });
    const yPk = c.hole ? R : H2, xPk = xa + smax * scs * p;
    D.text([xPk, yPk], val(opt, `σ_max = ${fmt(smax * p)} ${u.ST}`, 'σ_max'), { anchor: 'start', dx: 6, dy: c.hole ? -4 : 10, size: 12, color: SC, weight: 700 });
    D.line([xa + g.savg * scs * p, -W2 - 0.2], [xa + g.savg * scs * p, W2 + 0.2], { stroke: COL.dim, sw: 1.1, dash: '4 3' });
    D.text([xa + g.savg * scs * p, -W2 - 0.2], val(opt, `σ_avg = ${fmt(g.savg * p)} ${u.ST}`, 'σ_avg'), { anchor: 'start', dx: 4, dy: 14, size: 11.5, color: COL.dim });
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u, k = deformOn() ? kD() : 0;
    if (g.kind === 'bar') {
      const G = barGeo(g), { Ls, xs, hh, uw, gw } = G, amp = G.amp * k, hm = Math.max(...hh), X = (i) => xs[i] + uw[i] * amp;
      v._hs = 0.4;
      // a wall is painted over the bar when its outer face is toward the viewer, under it otherwise
      const wallL = (n) => (facing) => (facing(n) > 0 ? 1 : -1);
      v.box(-0.5, -hm - 0.7, -hm - 0.7, 0, hm + 0.7, hm + 0.7, '#cfd8de', 1, EDGE, { layer: wallL([-1, 0, 0]) });
      if (g.right !== 'free') { const xw = Ls + (g.right === 'gap' ? gw : 0); v.box(xw, -hm - 0.7, -hm - 0.7, xw + 0.5, hm + 0.7, hm + 0.7, '#cfd8de', 1, EDGE, { layer: wallL([1, 0, 0]) }); }
      g.sg.forEach((t, i) => {
        const col = k > 0 ? contour(0.2 + 0.6 * k * Math.abs(t.sig) / G.smax) : '#b9c2cb', sh = t.q.shape, r = hh[i];
        if (sh === 'rect' || sh === 'area') { const bz = sh === 'rect' ? r * Math.min(1.8, Math.max(0.4, t.q.b / t.q.h)) : r; v.box(X(i), -r, -bz, X(i + 1), r, bz, col, 1, EDGE); }
        else MDUI.cyl(v, [X(i), 0, 0], [X(i + 1), 0, 0], r, col, { ri: sh === 'tube' ? r * (t.q.di / t.q.d) : 0, stroke: i === g.sg.length - 1 && g.right !== 'free' ? null : EDGE, n: 30 });
      });
      const Pm = Math.max(1e-12, ...g.sg.map((t) => Math.abs(t.P)));
      g.sg.forEach((t, i) => {
        if (!t.P) return;
        const x = X(i + 1), h = Math.max(hh[i], hh[i + 1] || 0) + 0.35, len = 0.9 + 0.6 * Math.abs(t.P) / Pm, d = Math.sign(t.P);
        [h, -h].forEach((y) => { const a = [d > 0 ? x : x + len, y, 0], b = [d > 0 ? x + len : x, y, 0]; MDUI.arrow3(v, a, b, LCOL, 2.6); });
        v.label([x + len / 2, h + 0.4, 0], opt.showP ? `${fmt(Math.abs(MD.fromBase(t.P, u.F)))} ${u.F}` : `P${LET[i + 1]}`, LCOL);
      });
      for (let i = 0; i <= g.sg.length; i++) v.label([X(i), -(hh[Math.min(i, hh.length - 1)]) - 0.5, 0], LET[i], COL.ink);
      v.autoBounds(); return;
    }
    if (g.kind === 'parallel') {
      const items = parLayout(g), Hh = 6, dw = MD.fromBase(g.del, u.L) * (Hh / MD.fromBase(g.L, u.L)), amp = MDUI.exag(Hh, Math.abs(dw), 0.07) * k, top = Hh - dw * amp;
      const smax = Math.max(...g.M.map((m) => Math.abs(m.sig))) || 1, colOf = (m) => (k > 0 ? contour(0.2 + 0.6 * k * Math.abs(m.sig) / smax) : MCOL[g.M.indexOf(m)]);
      v._hs = 0.5;
      let xmin, xmax;
      if (g.q.layout === 'nested') {
        const [o, c] = g.M, R = 2.4, ri = o.m.shape === 'tube' ? Math.max(0.5, (o.m.di / o.m.d) * R) : 1.8, rc = Math.min(ri - 0.12, Math.max(0.4, (dia(c.m) / dia(o.m)) * R));
        xmin = -R - 0.4; xmax = R + 0.4;
        v.box(xmin - 0.6, -0.5, xmin - 0.6, xmax + 0.6, 0, xmax + 0.6, '#cfd8de', 1, EDGE, { layer: MDUI.upLayer(0) });
        MDUI.cyl(v, [0, 0, 0], [0, top, 0], rc, colOf(c), { n: 32, ri: c.m.shape === 'tube' ? rc * (c.m.di / c.m.d) : 0, stroke: EDGE, layer: MDUI.upLayer(1) });
        const TL = MDUI.upLayer(1);
        // the tube is cut open at the front so the core shows
        const ro = R;
        for (let j = 0; j < 24; j++) {
          const a0 = Math.PI * (j / 24) + Math.PI, a1 = Math.PI * ((j + 1) / 24) + Math.PI;
          const P = (a, r, y) => [r * Math.cos(a), y, r * Math.sin(a)];
          v.face([P(a0, ro, 0), P(a1, ro, 0), P(a1, ro, top), P(a0, ro, top)], colOf(o), 1, null, 1, TL, [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
          v.face([P(a0, ri, 0), P(a1, ri, 0), P(a1, ri, top), P(a0, ri, top)], '#9aa5ad', 1, null, 1, TL, [-Math.cos((a0 + a1) / 2), 0, -Math.sin((a0 + a1) / 2)]);
          v.face([P(a0, ri, top), P(a1, ri, top), P(a1, ro, top), P(a0, ro, top)], colOf(o), 1, EDGE, 1, TL, [0, 1, 0]);
        }
        [0, Math.PI].forEach((a) => v.face([[ri * Math.cos(a), 0, 0], [ro * Math.cos(a), 0, 0], [ro * Math.cos(a), top, 0], [ri * Math.cos(a), top, 0]], colOf(o), 1, EDGE, 1, TL, [0, 0, 1]));
        v.box(xmin, top, -R - 0.4, xmax, top + 0.5, R + 0.4, CAP, 0.35, EDGE, { layer: MDUI.upLayer(3) });
      } else {
        const Dm = Math.max(...items.map((it) => dia(it.m.m)));
        xmin = -1.2; xmax = items.length * 2.2 - 0.6;
        v.box(xmin - 0.4, -0.5, -1.6, xmax + 0.4, 0, 1.6, '#cfd8de', 1, EDGE, { layer: MDUI.upLayer(0) });
        items.forEach((it, j) => { const cx = j * 2.2 + 0.3, r = 0.25 + 0.5 * (dia(it.m.m) / Dm); MDUI.cyl(v, [cx, 0, 0], [cx, top, 0], r, colOf(it.m), { n: 28, stroke: EDGE, layer: MDUI.upLayer(1) }); });
        v.box(xmin, top, -1.3, xmax, top + 0.5, 1.3, CAP, 1, EDGE, { layer: MDUI.upLayer(3) });
      }
      const cx = (xmin + xmax) / 2, P = +g.q.P;
      if (P) { const a = [cx, top + 0.5, 0], b = [cx, top + 2.4, 0]; MDUI.arrow3(v, P > 0 ? b : a, P > 0 ? a : b, LCOL, 3); v.label([cx, top + 2.7, 0], opt.showP ? `P = ${fmt(Math.abs(P))} ${u.F}` : 'P', LCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'rigid') {
      const G = rigGeo(g), hang = g.hang, sgn = hang ? 1 : -1, bt = 0.32, z = 0.6;
      const dy = (xb) => -MD.fromBase(g.v0 + g.th * xb, u.L) * G.sx * G.amp * k;
      const smax = Math.max(...g.Rd.map((r) => Math.abs(r.sig))) || 1, top = Math.max(...g.Rd.map(G.rl));
      v._hs = 0.45;
      v.box(-0.8, hang ? top : -top - 0.4, -1.4, 10.8, hang ? top + 0.4 : -top, 1.4, '#cfd8de', 1, EDGE, { layer: MDUI.upLayer(hang ? 5 : -5) });
      g.Rd.forEach((r) => {
        const x = G.X(r.x), end = sgn * G.rl(r), yb = sgn * bt + dy(r.x), rad = Math.max(0.1, Math.min(0.3, 0.12 + 0.05 * Math.sqrt(MD.fromBase(r.A, u.A) / (u.us ? 0.05 : 30))));
        if (Math.abs(end) < top) v.box(x - 0.5, hang ? end : end - 0.01, -0.5, x + 0.5, hang ? top : -top, 0.5, '#cfd8de', 1, EDGE);
        MDUI.cyl(v, [x, yb, 0], [x, end, 0], rad, k > 0 ? contour(0.2 + 0.6 * k * Math.abs(r.sig) / smax) : '#8fa3b3', { n: 18, stroke: EDGE });
      });
      const b0 = dy(0), b1 = dy(g.Lb);
      v.extrude([[0, -bt + b0], [10, -bt + b1], [10, bt + b1], [0, bt + b0]], -z, z, '#6f7f8c', 1, EDGE);
      if (g.q.pin) { const x = G.X(g.xp); MDUI.cyl(v, [x, 0, -z - 0.3], [x, 0, z + 0.3], 0.12, '#dfe5e9', { n: 14, stroke: EDGE }); [[-z - 0.3, -z - 0.05], [z + 0.05, z + 0.3]].forEach(([z0, z1]) => v.box(x - 0.3, -bt - 0.9, z0, x + 0.3, 0.15, z1, '#cfd8de', 1, EDGE)); }
      const Pm = Math.max(1e-12, ...g.P.filter((p) => !p.dist).map((p) => Math.abs(p.P)));
      g.P.filter((p) => !p.dist).forEach((p) => { const x = G.X(p.x), yb = bt + dy(p.x), len = 1.2 + 0.8 * Math.abs(p.P) / Pm; MDUI.arrow3(v, [x, yb + len, 0], [x, yb, 0], LCOL, 3); v.label([x, yb + len + 0.3, 0], opt.showP ? `${fmt(MD.fromBase(p.P, u.F))} ${u.F}` : 'P', LCOL); });
      if (g.w) for (let i = 0; i <= 10; i += 1) MDUI.arrow3(v, [i, bt + dy((i / 10) * g.Lb) + 0.9, 0], [i, bt + dy((i / 10) * g.Lb), 0], LCOL, 1.4, 0.2);
      v.autoBounds(); return;
    }
    // stress concentration: plate built from convex pieces
    const c = concShape(g), sc = 10 / c.L, W2 = (c.w / 2) * sc, H2 = (c.h / 2) * sc, R = c.r * sc, L2 = 5, tz = Math.max(0.15, Math.min(0.8, (+g.q.t * sc) / 2));
    const col = '#b9c2cb', pc = { sideStroke: EDGE };
    v._hs = 0.45;
    if (c.hole) {
      const ring = (a) => [R * Math.cos(a), R * Math.sin(a)];
      const rayHit = (a) => { const cx = Math.cos(a), sy = Math.sin(a), t = Math.min(Math.abs(cx) > 1e-9 ? L2 / Math.abs(cx) : 1e9, Math.abs(sy) > 1e-9 ? W2 / Math.abs(sy) : 1e9); return [cx * t, sy * t]; };
      const corners = [[L2, W2], [-L2, W2], [-L2, -W2], [L2, -W2]].map((p) => [p, Math.atan2(p[1], p[0])]);
      const n = 32;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
        const poly = [ring(a0), rayHit(a0)];
        corners.forEach(([p, ac]) => { const aa = (ac + 2 * Math.PI) % (2 * Math.PI); if (aa > a0 && aa < a1) poly.push(p); });
        poly.push(rayHit(a1), ring(a1));
        [tz, -tz].forEach((zz) => v.face(poly.map((p) => [p[0], p[1], zz]), col, 1, 'fill', 1, 0, [0, 0, Math.sign(zz)]));
        v.face([[...ring(a0), -tz], [...ring(a1), -tz], [...ring(a1), tz], [...ring(a0), tz]], '#9aa5ad', 1, 'fill', 1, 0, [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0]);
      }
      const rect = [[-L2, -W2], [L2, -W2], [L2, W2], [-L2, W2]];
      for (let i = 0; i < 4; i++) { const a = rect[i], b = rect[(i + 1) % 4], dx = b[0] - a[0], dyy = b[1] - a[1], l = Math.hypot(dx, dyy); v.face([[a[0], a[1], -tz], [b[0], b[1], -tz], [b[0], b[1], tz], [a[0], a[1], tz]], col, 1, EDGE, 1, 0, [dyy / l, -dx / l, 0]); }
      rect.forEach((p, i) => { const q = rect[(i + 1) % 4]; v.line([[p[0], p[1], tz], [q[0], q[1], tz]], EDGE, 1.2); });
      const circ = Array.from({ length: n + 1 }, (_, i) => [...ring((i / n) * 2 * Math.PI), tz]); v.line(circ, EDGE, 1.2);
    } else {
      // wide block, narrow block, the block between the shoulders and thin strips under each fillet
      const ns = { sideStroke: 'fill' };
      v.extrude([[-L2, -W2], [-R, -W2], [-R, W2], [-L2, W2]], -tz, tz, col, 1, 'fill', ns);
      v.extrude([[-R, -H2], [L2, -H2], [L2, H2], [-R, H2]], -tz, tz, col, 1, 'fill', ns);
      const m = 10, arc = (a, sg) => [-R * Math.sin(a), sg * Math.min(W2, H2 + R - R * Math.cos(a))];
      [1, -1].forEach((sg) => {
        for (let i = 0; i < m; i++) {
          const P0 = arc((i / m) * (Math.PI / 2), sg), P1 = arc(((i + 1) / m) * (Math.PI / 2), sg);
          v.extrude([[P0[0], sg * H2], [P1[0], sg * H2], P1, P0], -tz, tz, col, 1, 'fill', ns);
        }
      });
      const fil = (sg) => Array.from({ length: 13 }, (_, i) => arc((i / 12) * (Math.PI / 2), sg));
      const outline = [[-L2, -W2], [-R, -W2]].concat(fil(-1).reverse(), [[L2, -H2], [L2, H2]], fil(1), [[-R, W2], [-L2, W2], [-L2, -W2]]);
      v.line(outline.map(([x, y]) => [x, y, tz]), EDGE, 1.2);
      [[-L2, -W2], [-L2, W2], [L2, -H2], [L2, H2]].forEach(([x, y]) => v.line([[x, y, -tz], [x, y, tz]], EDGE, 1.2));
    }
    const p = S()._p === undefined ? 1 : S()._p;
    MDUI.arrow3(v, [-L2, 0, 0], [-L2 - 2.2, 0, 0], LCOL, 3); MDUI.arrow3(v, [L2, 0, 0], [L2 + 2.2, 0, 0], LCOL, 3);
    v.label([L2 + 2.5, 0.4, 0], opt.showP ? `N = ${fmt(g.N * p)} ${u.F}` : 'N', LCOL);
    v.label([0, (c.hole ? W2 : H2) + 0.6, tz], opt.showP ? `σ_max = ${fmt(g.smax * p)} ${u.ST}` : 'σ_max', COL.shear);
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const sg = (L, d, P, o) => Object.assign({ L, shape: 'circle', d, di: 0, b: 50, h: 50, A: 500, mat: 'a36', E: 200, al: 12, P }, o || {});
  const ax = (o, fu) => ({ mode: 'bar', fu: fu || 'kN', ax: o });
  const rod = (x, L, A, o) => Object.assign({ x, L, shape: 'area', d: 8, A, mat: 'a992', E: 200, al: 12 }, o || {});
  M.presets = [
    { name: 'Test: Book Example 9.1, steel bar with three loads (δ_D = −0.891 mm, δ_B/C = −0.764 mm)', units: 'SI', state: ax({ right: 'free', gap: 0.2, dT: 0, segs: [sg(2, 50, 800), sg(1, 50, 400), sg(1.5, 50, -700)] }),
      expect: [{ k: 'Displacement of the end D, δ_D', v: -0.891 }, { k: 'Change in length of BC', v: -0.764 }, { k: 'Internal force N_AB', v: 500 }, { k: 'Internal force N_CD', v: -700 }] },
    { name: 'Test: Book Example 9.5, rod that closes a 0.2 mm gap (F_A = 16.0 kN, F_B = 4.05 kN)', units: 'SI', state: ax({ right: 'gap', gap: 0.2, dT: 0, segs: [sg(0.4, 10, 20, { mat: 'custom' }), sg(0.8, 10, 0, { mat: 'custom' })] }),
      expect: [{ k: 'Reaction at A, F_A', v: 15.95 }, { k: 'Reaction at C, F_C', v: 4.049 }] },
    { name: 'Test: Book Section 9.4, bar fixed at both ends with 500 N at C (F_A = 300 N, F_B = 200 N)', units: 'SI', state: ax({ right: 'fixed', gap: 0.2, dT: 0, segs: [sg(2, 20, 500, { mat: 'custom' }), sg(3, 20, 0, { mat: 'custom' })] }, 'N'),
      expect: [{ k: 'Reaction at A, F_A', v: 300 }, { k: 'Reaction at C, F_C', v: 200 }] },
    { name: 'Test: Book Example 9.10, square steel bar heated between walls (F = 2.87 kip, σ = 11.5 ksi C)', units: 'US', state: ax({ right: 'fixed', gap: 0.01, dT: 60, segs: [sg(2, 0.5, 0, { shape: 'rect', b: 0.5, h: 0.5, E: 29000, al: 6.6 })] }, 'kip'),
      expect: [{ k: 'Reaction at B, F_B', v: 2.871 }, { k: 'Stress σ_AB', v: -11.48 }] },
    { name: 'Test: Book Example 9.6, aluminium post with a brass core (σ_al = 637 psi, σ_br = 955 psi)', units: 'US', state: { mode: 'parallel', fu: 'kip', par: { P: 9, L: 1.5, dT: 0, layout: 'nested', mem: [{ n: 1, shape: 'tube', d: 4, di: 2, b: 2, h: 2, A: 1, mat: 'custom', E: 10000, al: 13.1 }, { n: 1, shape: 'circle', d: 2, di: 0, b: 2, h: 2, A: 1, mat: 'custom', E: 15000, al: 9.8 }] } },
      expect: [{ k: 'Force in member 1, F1', v: 6 }, { k: 'Force in member 2, F2', v: 3 }, { k: 'Stress in member 1, σ1', v: -0.6366 }, { k: 'Stress in member 2, σ2', v: -0.9549 }] },
    { name: 'Test: Book Example 9.12, steel bolt in an aluminium sleeve heated by 65 °C (F = 20.3 kN)', units: 'SI', state: { mode: 'parallel', fu: 'kN', par: { P: 0, L: 0.15, dT: 65, layout: 'nested', mem: [{ n: 1, shape: 'area', d: 40, di: 30, b: 50, h: 50, A: 600, mat: 'al2014', E: 73.1, al: 23 }, { n: 1, shape: 'area', d: 22, di: 0, b: 50, h: 50, A: 400, mat: 'a36', E: 200, al: 12 }] } },
      expect: [{ k: 'Force in member 1, F1', v: 20.26 }, { k: 'Force in member 2, F2', v: -20.26 }] },
    { name: 'Test: Book Example 9.7, rigid bar on three steel rods (F_A = 9.52, F_C = 3.46, F_E = 2.02 kN)', units: 'SI', state: { mode: 'rigid', fu: 'kN', rig: { side: 'hang', pin: false, xp: 0, len: 0.8, dT: 0, w: 0, rods: [rod(0, 0.5, 50), rod(0.4, 0.5, 30), rod(0.8, 0.5, 50)], loads: [{ x: 0.2, P: 15 }] } },
      expect: [{ k: 'Force in rod 1, F1', v: 9.519 }, { k: 'Force in rod 2, F2', v: 3.462 }, { k: 'Force in rod 3, F3', v: 2.019 }] },
    { name: 'Test: Book Example 9.3, rigid beam on two posts (point F moves 0.225 mm down)', units: 'SI', state: { mode: 'rigid', fu: 'kN', rig: { side: 'post', pin: false, xp: 0, len: 0.6, dT: 0, w: 0, rods: [rod(0, 0.3, 0, { shape: 'circle', d: 20, mat: 'a36' }), rod(0.6, 0.3, 0, { shape: 'circle', d: 40, mat: 'custom', E: 70, al: 23 })], loads: [{ x: 0.2, P: 90 }] } },
      expect: [{ k: 'Force in post 1, F1', v: 60 }, { k: 'Force in post 2, F2', v: 30 }, { k: 'Load 1 point moves down', v: 0.225 }] },
    { name: 'Test: Book Example 9.11, beam on steel and aluminium posts, heated by 60 °C (F_st = −16.4 kN, F_al = 123 kN)', units: 'SI', state: { mode: 'rigid', fu: 'kN', rig: { side: 'post', pin: false, xp: 0, len: 0.6, dT: 60, w: 150, rods: [rod(0, 0.25, 0, { shape: 'circle', d: 40 }), rod(0.3, 0.25, 0, { shape: 'circle', d: 60, mat: 'al2014', E: 73.1, al: 23 }), rod(0.6, 0.25, 0, { shape: 'circle', d: 40 })], loads: [] } },
      expect: [{ k: 'Force in post 1, F1', v: -16.44 }, { k: 'Force in post 2, F2', v: 122.9 }] },
    { name: 'Rigid bar pinned at one end and held by two rods', units: 'US', state: { mode: 'rigid', fu: 'kip', rig: { side: 'hang', pin: true, xp: 0, len: 9, dT: 0, w: 0, rods: [rod(3, 4, 0, { shape: 'circle', d: 0.5, mat: 'a36', E: 29000, al: 6.6 }), rod(9, 6, 0, { shape: 'circle', d: 0.5, mat: 'a36', E: 29000, al: 6.6 })], loads: [{ x: 6, P: 8 }] } } },
    { name: 'Test: Book Example 9.13, bar with shoulder fillets that must not yield (N = 9.14 kN)', units: 'SI', state: { mode: 'conc', fu: 'kN', cn: { geo: 'fillet', w: 40, h: 32, d: 10, r: 4, t: 2, K: 1.75, task: 'allow', N: 8, sA: 250 } },
      expect: [{ k: 'Largest axial force N', v: 9.143 }, { k: 'Smallest area A', v: 64 }] },
    { name: 'Plate with a hole under 10 kip', units: 'US', state: { mode: 'conc', fu: 'kip', cn: { geo: 'hole', w: 3, h: 2, d: 1, r: 0.25, t: 0.25, K: 2.3, task: 'max', N: 10, sA: 36 } } },
    { name: 'Edge: one post cannot hold the bar level (fails on purpose)', units: 'SI', fails: true, state: { mode: 'rigid', fu: 'kN', rig: { side: 'post', pin: false, xp: 0, len: 1, dT: 0, w: 0, rods: [rod(0.5, 0.3, 100)], loads: [{ x: 0.2, P: 10 }] } } },
  ];

  root.MAxial = M;
})(window);
