/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M6 Combined Loadings
 * (inputs, diagrams, presets). Physics: md/combined.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Combined, MD, MDUI } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const EL = '#cfd8de', EDGE = '#4a5661', AX = '#111111', NCOL = COL.load, SCOL = COL.shear, PTC = '#d4612a', MCOL = COL.couple, VCOL = COL.load, KCOL = '#1e7a45';

  const M = { id: 'combined', title: 'Combined Loadings', defaults: Combined.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const swellOn = () => mode() === 'vessel' && S().defl !== false && S().vs.E > 0;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  function sendToMohr() {
    const App = root.App, T = root.MTransform, res = App && App.res;
    if (!T || !res || !res.ok || !res.geo.mohr) return;
    const m = res.geo.mohr, td = (v) => Core.tidy(v, 6);
    T.state = Core.deepMerge(T.defaults(), { mode: 'stress', ps: { sx: td(m.sx), sy: td(m.sy), txy: td(m.txy), th: 0 } });
    T.units = M.units;
    const tab = [...document.querySelectorAll('#tabs button')].find((b) => b.textContent.includes(T.title));
    if (tab) setTimeout(() => tab.click(), 0);
  }
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], sys = M.units, fu = Combined.FU[sys].includes(st.fu) ? st.fu : Combined.FU[sys][0], u = MD.units(U, fu);
    const mu = Combined.MU[sys].includes(st.mu) ? st.mu : Combined.MU[sys][0], pu = Combined.PU[sys].includes(st.pu) ? st.pu : Combined.PU[sys][0];
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => { o[k] = v; delete st._k; }, unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [['section', 'Stresses at a point of a loaded section'], ['vessel', 'Thin-walled pressure vessel'], ['eccentric', 'Post with an off-centre load']] });
    if (st.mode !== 'vessel') C.seg(sec, { label: 'Force unit', get: () => fu, set: (v) => (st.fu = v), options: Combined.FU[sys].map((x) => [x, x]) });
    if (st.mode === 'section') {
      const q = st.sc;
      C.seg(sec, { label: 'Moment unit', get: () => mu, set: (v) => (st.mu = v), options: Combined.MU[sys].map((x) => [x, x]) });
      sec = C.section(c, 'Section');
      C.seg(sec, { label: 'Shape', get: () => q.shape, set: (v) => { q.shape = v; if (!Combined.points(Combined.props(q, u)).some((p) => p[0] === q.pt) && q.pt !== 'custom') q.pt = v === 'tube' ? 't' : 'c'; }, options: [['rect', 'Rectangle'], ['circle', 'Solid circle'], ['tube', 'Tube']] });
      if (q.shape === 'rect') { num(sec, q, 'b', 'Width b (along y)', u.S); num(sec, q, 'h', 'Depth h (along z)', u.S); }
      else { num(sec, q, 'd', 'Outer diameter', u.S); if (q.shape === 'tube') num(sec, q, 'di', 'Inner diameter', u.S); }
      sec = C.section(c, 'Internal loadings at the section');
      C.note(sec, 'x runs along the member, out of the cut face; y is to the right and z up. Positive loads point along +x, +y, +z (moments by the right-hand rule).');
      num(sec, q, 'N', 'Normal force N (tension +)', fu); num(sec, q, 'Vy', 'Shear force V_y', fu); num(sec, q, 'Vz', 'Shear force V_z', fu);
      num(sec, q, 'My', 'Bending moment M_y', mu); num(sec, q, 'Mz', 'Bending moment M_z', mu);
      if (q.shape !== 'rect') num(sec, q, 'T', 'Torque T', mu);
      sec = C.section(c, 'Point');
      const P = Combined.props(q, u);
      C.select(sec, { label: 'Point on the section', get: () => q.pt, set: (v) => (q.pt = v), options: Combined.points(P).map((p) => [p[0], p[1]]).concat([['custom', 'Any point (y, z)']]) });
      if (q.pt === 'custom') { num(sec, q, 'y', 'y from the centroid', u.S); num(sec, q, 'z', 'z from the centroid', u.S); }
      C.note(sec, 'You can also click a point on the section.');
      C.seg(sec, { get: () => '', set: sendToMohr, options: [['go', "Open this point in Mohr's circle"]] });
    } else if (st.mode === 'vessel') {
      const q = st.vs;
      sec = C.section(c, 'Vessel');
      C.seg(sec, { label: 'Shape', get: () => q.kind, set: (v) => (q.kind = v), options: [['cyl', 'Cylinder'], ['sphere', 'Sphere']] });
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['stress', 'Stresses'], ['pmax', 'Largest pressure'], ['tmin', 'Wall thickness']] });
      C.seg(sec, { label: 'Pressure unit', get: () => pu, set: (v) => (st.pu = v), options: Combined.PU[sys].map((x) => [x, x]) });
      num(sec, q, 'r', 'Inner radius r', u.S);
      if (q.task !== 'tmin') num(sec, q, 't', 'Wall thickness t', u.S);
      if (q.task !== 'pmax') num(sec, q, 'p', 'Internal pressure p', pu);
      if (q.task !== 'stress') num(sec, q, 'sA', 'Allowable normal stress', u.ST);
      if (q.kind === 'cyl') { C.seg(sec, { label: 'Force unit', get: () => fu, set: (v) => (st.fu = v), options: Combined.FU[sys].map((x) => [x, x]) }); num(sec, q, 'N', 'Axial force on the cylinder (tension +)', fu); }
      sec = C.section(c, 'Material (for the change in radius)');
      MDUI.material(C, sec, q, sys, { E: 'E', nu: 'nu' });
      C.num(sec, { label: 'Modulus E (0 = leave out)', get: () => q.E, set: (v) => { q.E = v; q.mat = 'custom'; }, unit: u.MOD });
      C.num(sec, { label: "Poisson's ratio ν", get: () => q.nu, set: (v) => { q.nu = v; q.mat = 'custom'; } });
      sec = C.section(c, 'Element on the wall');
      C.seg(sec, { get: () => '', set: sendToMohr, options: [['go', "Open the wall element in Mohr's circle"]] });
    } else {
      const q = st.ec;
      sec = C.section(c, 'Post');
      num(sec, q, 'b', 'Side b (along y)', u.S); num(sec, q, 'h', 'Side h (along z)', u.S);
      sec = C.section(c, 'Load');
      num(sec, q, 'P', 'Load P (compression +)', fu);
      num(sec, q, 'ey', 'Offset e_y from the centroid', u.S); num(sec, q, 'ez', 'Offset e_z from the centroid', u.S);
      C.note(sec, 'Drag the load on the plan view to move it.');
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    if (st.mode !== 'vessel') C.toggle(c, { label: 'Colour the section by normal stress', get: () => st.cont !== false, set: (v) => (st.cont = v) });
    if (st.mode !== 'vessel') C.toggle(c, { label: 'Show the neutral axis', get: () => st.na !== false, set: (v) => (st.na = v) });
    if (st.mode === 'eccentric') C.toggle(c, { label: 'Show the kern', get: () => st.kern !== false, set: (v) => (st.kern = v) });
    if (st.mode === 'vessel') C.toggle(c, { label: 'Show the swelling under pressure (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
  };

  M.compute = (U) => Combined.solve(S(), U);
  M.onUnits = (from, to) => Combined.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ section: 'Section and the element at the point', vessel: 'Vessel, wall element and cut section', eccentric: 'Plan of the post' }[mode()]);
  M.cap3D = () => '3D view';
  M.hint = () => ({
    section: 'The section is coloured by normal stress (red tension, blue compression) and the dashed line is the neutral axis. Click a point to see the stresses there; the element on the right shows them on its faces.',
    vessel: 'The hoop stress σ1 runs round the vessel and is twice the longitudinal stress σ2 in a cylinder. Give E to see the vessel swell; press Play to watch it (exaggerated).',
    eccentric: 'Drag the load. While it stays inside the green diamond (the kern) the whole post is in compression; outside it, the neutral axis cuts the section and one side goes into tension.',
  }[mode()]);
  M.legend = () => ({
    section: [[NCOL, 'Tension', 'sq'], ['#2f6fb0', 'Compression', 'sq'], [PTC, 'Chosen point'], [MCOL, 'Moments and torque']],
    vessel: [[NCOL, 'Wall stresses'], [EDGE, 'Before pressure', 'ln']],
    eccentric: [[NCOL, 'Tension', 'sq'], ['#2f6fb0', 'Compression', 'sq'], [KCOL, 'Kern', 'ln'], [PTC, 'Load']],
  }[mode()]);
  const deflect = root.Anim.deflection(S);
  M.anim = () => (swellOn() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const mix = (a, b, t) => '#' + [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join('');
  const WHITE = [244, 246, 248], RED = [192, 57, 43], BLUE = [47, 111, 176];
  /** Diverging colour: blue for compression, red for tension, scaled by the largest size. */
  const sColor = (s, mx) => (mx > 0 ? (s >= 0 ? mix(WHITE, RED, Math.min(1, s / mx)) : mix(WHITE, BLUE, Math.min(1, -s / mx))) : '#dde3e8');
  /** Points of the section outline (section units scaled by sc). */
  function outline(P, sc) {
    if (P.shape === 'rect') { const a = (P.b / 2) * sc, c = (P.h / 2) * sc; return [[[-a, -c], [a, -c], [a, c], [-a, c]]]; }
    const ring = (r) => { const pts = []; for (let i = 0; i < 64; i++) { const t = (i / 64) * 2 * Math.PI; pts.push([r * Math.cos(t) * sc, r * Math.sin(t) * sc]); } return pts; };
    return P.ri ? [ring(P.ro), ring(P.ri)] : [ring(P.ro)];
  }
  /** Coloured cells over the section: cb(y, z, w, h, colour) in drawing units. */
  function cells(P, sc, sig, mx, n, cb) {
    const a = P.cy, c = P.cz, dy = (2 * a) / n, dz = (2 * c) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const y = -a + (i + 0.5) * dy, z = -c + (j + 0.5) * dz;
      if (!P.inside(y, z)) continue;
      cb((y - dy / 2) * sc, (z - dz / 2) * sc, dy * sc, dz * sc, sColor(sig(y, z), mx));
    }
  }
  /** Neutral axis a + b y + c z = 0 clipped to a box of half-sizes (A, C), in drawing units. */
  function naLine(a, b, c, A, C) {
    const pts = [];
    if (Math.abs(c) > 1e-15) [-A, A].forEach((y) => { const z = -(a + b * y) / c; if (Math.abs(z) <= C + 1e-9) pts.push([y, z]); });
    if (Math.abs(b) > 1e-15) [-C, C].forEach((z) => { const y = -(a + c * z) / b; if (Math.abs(y) <= A + 1e-9) pts.push([y, z]); });
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  }
  const val = (opt, a, b) => (opt.showP ? a : b);

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  let lay = null;
  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'vessel') return drawVessel(svg, g, opt);
    if (g.kind === 'eccentric') return drawPost(svg, g, opt);
    return drawSection(svg, g, opt);
  };

  function drawSection(svg, g, opt) {
    const P = g.P, L = g.L, u = g.u, ST = u.ST, sc = 2 / Math.max(P.cy, P.cz), st = S();
    const wide = (svg.clientWidth || 800) >= (svg.clientHeight || 560) * 1.1, ex = wide ? [5.6, 0] : [0, -5.3];
    const b = wide ? { xmin: -3.4, xmax: 7.6, ymin: -3.0, ymax: 3.1 } : { xmin: -3.4, xmax: 3.4, ymin: -7.4, ymax: 3.1 };
    const D = UI.Draw2D(svg, b, { pad: 16 });
    lay = { sc };
    const mx = Math.max(Math.abs(g.smax), Math.abs(g.smin), 1e-12), sig = (y, z) => g.stressAt(y, z).sx;
    const ol = outline(P, sc);
    if (st.cont !== false) cells(P, sc, sig, mx, P.shape === 'rect' ? 30 : 40, (y, z, w, h, col) => D.poly([[y, z], [y + w, z], [y + w, z + h], [y, z + h]], { fill: col, stroke: col, sw: 0.6 }));
    else D.poly(ol[0], { fill: EL });
    if (P.ri && st.cont === false) D.poly(ol[1], { fill: '#f4f6f8' });
    ol.forEach((o) => D.poly(o, { stroke: EDGE, sw: 1.8 }));
    // axes
    D.arrow([-2.7, 0], [2.85, 0], { color: AX, w: 1.1, head: 8 }); D.text([2.85, 0], 'y', { dx: 3, dy: 14, color: AX, size: 12, weight: 700 });
    D.arrow([0, -2.6], [0, 2.75], { color: AX, w: 1.1, head: 8 }); D.text([0, 2.75], 'z', { dx: 6, dy: 4, color: AX, size: 12, weight: 700 });
    // neutral axis
    if (st.na !== false) {
      const ln = naLine(L.N / P.A, -L.Mz / P.Iz / sc, L.My / P.Iy / sc, P.cy * sc, P.cz * sc);
      if (ln) { D.line(ln[0], ln[1], { stroke: AX, sw: 1.6, dash: '8 5' }); D.text(ln[1], 'N.A.', { dx: 4, dy: -4, color: AX, size: 11.5, weight: 700 }); }
    }
    // loads at the centroid
    const vmx = Math.max(Math.abs(L.Vy), Math.abs(L.Vz), 1e-12);
    if (L.Vy) { const l = 0.5 + 0.7 * (Math.abs(L.Vy) / vmx), sg = Math.sign(L.Vy); D.arrow([-sg * l / 2, -0.35], [sg * l / 2, -0.35], { color: VCOL, w: 2.4, head: 9 }); D.text([sg * l / 2, -0.35], val(opt, `V_y = ${fmt(+S().sc.Vy)} ${u.F}`, 'V_y'), { anchor: sg > 0 ? 'start' : 'end', dx: sg * 5, dy: 4, color: VCOL, size: 11.5, weight: 700 }); }
    if (L.Vz) { const l = 0.5 + 0.7 * (Math.abs(L.Vz) / vmx), sg = Math.sign(L.Vz); D.arrow([0.35, -sg * l / 2], [0.35, sg * l / 2], { color: VCOL, w: 2.4, head: 9 }); D.text([0.35, sg * l / 2], val(opt, `V_z = ${fmt(+S().sc.Vz)} ${u.F}`, 'V_z'), { dx: 5, dy: sg > 0 ? -2 : 12, color: VCOL, size: 11.5, weight: 700 }); }
    if (L.N) {
      const r = 0.16; D.circle([0, 0], r, { stroke: VCOL, sw: 2, fill: '#fff' });
      if (L.N > 0) D.circle([0, 0], 0.045, { fill: VCOL }); else { D.line([-r * 0.7, -r * 0.7], [r * 0.7, r * 0.7], { stroke: VCOL, sw: 2 }); D.line([-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], { stroke: VCOL, sw: 2 }); }
      D.text([-0.2, 0.2], val(opt, `N = ${fmt(+S().sc.N)} ${u.F}`, 'N'), { anchor: 'end', dy: -2, color: VCOL, size: 11.5, weight: 700 });
    }
    // moments as double-headed vectors along their axes, outside the section
    const dbl = (a, bb, label, anchor) => { D.arrow(a, bb, { color: MCOL, w: 2.2, head: 9 }); const back = [bb[0] - (bb[0] - a[0]) * 0.18, bb[1] - (bb[1] - a[1]) * 0.18]; D.arrow(a, back, { color: MCOL, w: 0.01, head: 9 }); D.text(bb, label, { anchor: anchor || 'start', dx: 5, dy: -5, color: MCOL, size: 11.5, weight: 700 }); };
    if (L.My) { const sg = Math.sign(L.My), y0 = -2.55; dbl([y0 + (sg > 0 ? 0 : 1.0), 2.45], [y0 + (sg > 0 ? 1.0 : 0), 2.45], val(opt, `M_y = ${fmt(+S().sc.My)} ${u.M}`, 'M_y')); }
    if (L.Mz) { const sg = Math.sign(L.Mz), x0 = -2.6; dbl([x0, sg > 0 ? -1.9 : -0.9], [x0, sg > 0 ? -0.9 : -1.9], val(opt, `M_z = ${fmt(+S().sc.Mz)} ${u.M}`, 'M_z')); }
    if (L.T) {
      const r = Math.min(2.35, P.ro * sc + 0.3), pts = [], sg = Math.sign(L.T);
      for (let i = 0; i <= 20; i++) { const t = (Math.PI / 6) + ((Math.PI / 3) * i) / 20; pts.push([r * Math.cos(t), r * Math.sin(t)]); }
      if (sg < 0) pts.reverse();
      D.pline(pts.slice(0, 18), { stroke: MCOL, sw: 2.4 }); D.arrow(pts[17], pts[20], { color: MCOL, w: 2.4, head: 10 });
      D.text(pts[10], val(opt, `T = ${fmt(+S().sc.T)} ${u.M}`, 'T'), { dx: 6, dy: -6, color: MCOL, size: 11.5, weight: 700 });
    }
    // points
    g.pts.forEach((p) => D.circle([p[2] * sc, p[3] * sc], 3.6 / D.sc, { fill: '#fff', stroke: EDGE, sw: 1.4 }));
    const pp = [g.y * sc, g.z * sc];
    D.circle(pp, 6 / D.sc, { fill: PTC, stroke: '#fff', sw: 1.6 });
    D.text(pp, 'P', { anchor: pp[0] >= 0 ? 'start' : 'end', dx: pp[0] >= 0 ? 8 : -8, dy: pp[1] >= 0 ? -6 : 16, color: PTC, size: 13, weight: 700 });
    lay.pts = g.pts.map((p) => [p[0], p[2] * sc, p[3] * sc]);
    // element at P
    elementAt(D, g, opt, ex);
    return true;
  }
  /** Element at the chosen point: x across, the direction of the shear up the page. */
  function elementAt(D, g, opt, c) {
    const s = g.s, u = g.u, ST = u.ST, h = 0.85, sx = MD.fromBase(s.sx, ST), useY = Math.abs(s.txy) > Math.abs(s.txz) && !s.txz, both = s.txy && s.txz;
    const tv = MD.fromBase(both ? g.mohr.txy * MD.toBase(1, ST) : useY ? s.txy : s.txz, ST), ax2 = both ? 'n' : useY ? 'y' : 'z';
    D.text([c[0], c[1] + 2.25], 'Element at P', { anchor: 'middle', color: COL.ink, size: 12.5, weight: 700 });
    D.arrow([c[0] - 1.9, c[1] - 1.75], [c[0] - 1.2, c[1] - 1.75], { color: AX, w: 1.2, head: 7 }); D.text([c[0] - 1.2, c[1] - 1.75], 'x', { dx: 3, dy: 4, color: AX, size: 11.5, weight: 700 });
    D.arrow([c[0] - 1.9, c[1] - 1.75], [c[0] - 1.9, c[1] - 1.05], { color: AX, w: 1.2, head: 7 }); D.text([c[0] - 1.9, c[1] - 1.05], ax2, { dx: 4, dy: 2, color: AX, size: 11.5, weight: 700 });
    D.poly([[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]], { fill: EL, stroke: EDGE, sw: 1.8 });
    const mx = Math.max(Math.abs(sx), Math.abs(tv), 1e-12);
    if (Math.abs(sx) > 1e-9 * mx) {
      const l = 0.3 + 0.55 * (Math.abs(sx) / mx);
      [1, -1].forEach((sd) => { const p0 = [c[0] + sd * (h + 0.08), c[1]], p1 = [c[0] + sd * (h + 0.08 + l), c[1]]; D.arrow(sx > 0 ? p0 : p1, sx > 0 ? p1 : p0, { color: NCOL, w: 2.2, head: 9 }); });
      D.text([c[0], c[1] - h - 0.15], val(opt, `σ_x = ${fmt(sx)} ${ST}`, 'σ_x'), { anchor: 'middle', dy: 16, color: NCOL, size: 11.5, weight: 700 });
    }
    if (Math.abs(tv) > 1e-9 * mx) {
      const l = Math.min(1.5, 0.4 + 1.0 * (Math.abs(tv) / mx)) / 2, sg = Math.sign(tv), o = h + 0.12;
      D.arrow([c[0] + o, c[1] - sg * l], [c[0] + o, c[1] + sg * l], { color: SCOL, w: 2, head: 8 });
      D.arrow([c[0] - o, c[1] + sg * l], [c[0] - o, c[1] - sg * l], { color: SCOL, w: 2, head: 8 });
      D.arrow([c[0] - sg * l, c[1] + o], [c[0] + sg * l, c[1] + o], { color: SCOL, w: 2, head: 8 });
      D.arrow([c[0] + sg * l, c[1] - o], [c[0] - sg * l, c[1] - o], { color: SCOL, w: 2, head: 8 });
      D.text([c[0], c[1] + o + 0.1], val(opt, `τ_x${ax2} = ${fmt(tv)} ${ST}`, `τ_x${ax2}`), { anchor: 'middle', dy: -8, color: SCOL, size: 11.5, weight: 700 });
    }
    if (!(Math.abs(sx) > 0) && !(Math.abs(tv) > 0)) D.text(c, 'No stress', { anchor: 'middle', dy: 4, color: COL.ink, size: 12 });
  }

  function drawPost(svg, g, opt) {
    const u = g.u, ST = u.ST, sc = 2.2 / Math.max(g.b, g.h) * 2 / 2, a = (g.b / 2) * sc, c = (g.h / 2) * sc, st = S();
    const D = UI.Draw2D(svg, { xmin: -a - 1.6, xmax: a + 1.9, ymin: -c - 1.0, ymax: c + 1.0 }, { pad: 18 });
    lay = { sc };
    const mx = Math.max(Math.abs(g.smax), Math.abs(g.smin), 1e-12), P = { cy: g.b / 2, cz: g.h / 2, inside: () => true };
    if (st.cont !== false) cells(P, sc, g.sig, mx, 30, (y, z, w, h, col) => D.poly([[y, z], [y + w, z], [y + w, z + h], [y, z + h]], { fill: col, stroke: col, sw: 0.6 }));
    else D.poly([[-a, -c], [a, -c], [a, c], [-a, c]], { fill: EL });
    D.poly([[-a, -c], [a, -c], [a, c], [-a, c]], { stroke: EDGE, sw: 1.8 });
    D.arrow([-a - 0.5, 0], [a + 0.6, 0], { color: AX, w: 1.1, head: 8 }); D.text([a + 0.6, 0], 'y', { dx: 3, dy: 14, color: AX, size: 12, weight: 700 });
    D.arrow([0, -c - 0.5], [0, c + 0.6], { color: AX, w: 1.1, head: 8 }); D.text([0, c + 0.6], 'z', { dx: 6, dy: 4, color: AX, size: 12, weight: 700 });
    if (st.kern !== false) { const ky = (g.b / 6) * sc, kz = (g.h / 6) * sc; D.poly([[ky, 0], [0, kz], [-ky, 0], [0, -kz]], { stroke: KCOL, sw: 1.8, dash: '6 4', fill: KCOL, fop: 0.06 }); D.text([ky, 0], 'kern', { dx: 3, dy: -4, color: KCOL, size: 11, weight: 700 }); }
    if (st.na !== false) {
      const ln = naLine(-g.P / g.A, (-g.P * g.ey) / g.Iz / sc, (-g.P * g.ez) / g.Iy / sc, a, c);
      if (ln) { D.line(ln[0], ln[1], { stroke: AX, sw: 1.6, dash: '8 5' }); D.text(ln[1], 'N.A.', { dx: 4, dy: -4, color: AX, size: 11.5, weight: 700 }); }
    }
    g.C4.forEach((k) => {
      const p = [k.y * sc, k.z * sc], right = p[0] > 0, up = p[1] > 0;
      D.text(p, val(opt, `${k.n}: ${fmt(MD.fromBase(k.s, ST))} ${ST}`, k.n), { anchor: right ? 'start' : 'end', dx: right ? 6 : -6, dy: up ? -6 : 16, color: COL.ink, size: 12, weight: 700 });
    });
    // the load, seen from above: a cross in a circle (pushing down into the page) for compression
    const lp = [g.ey * sc, g.ez * sc], r = 0.12, col = PTC;
    D.circle(lp, r, { fill: '#fff', stroke: col, sw: 2.2 });
    if (g.P >= 0) { D.line([lp[0] - r * 0.7, lp[1] - r * 0.7], [lp[0] + r * 0.7, lp[1] + r * 0.7], { stroke: col, sw: 2 }); D.line([lp[0] - r * 0.7, lp[1] + r * 0.7], [lp[0] + r * 0.7, lp[1] - r * 0.7], { stroke: col, sw: 2 }); }
    else D.circle(lp, 0.05, { fill: col });
    D.text(lp, val(opt, `P = ${fmt(+S().ec.P)} ${u.F}`, 'P'), { anchor: lp[0] > 0 ? 'end' : 'start', dx: lp[0] > 0 ? -12 : 12, dy: lp[1] > 0 ? 22 : -12, color: col, size: 12.5, weight: 700 });
    lay.load = lp;
    return true;
  }

  function drawVessel(svg, g, opt) {
    const u = g.u, ST = u.ST, f = swellOn() ? kD() : 0, R0 = 1.4, sw = f * 0.12 * R0, tw = Math.max(0.07, Math.min(0.3, (g.t / g.r) * R0));
    const D = UI.Draw2D(svg, { xmin: -4.4, xmax: 8.9, ymin: -2.6, ymax: 2.6 }, { pad: 18 });
    lay = null;
    const R = R0 + sw, body = (Rr, o) => {
      if (g.cyl) {
        const pts = [], L = 3.2;
        for (let i = 0; i <= 20; i++) { const t = -Math.PI / 2 + (Math.PI * i) / 20; pts.push([L + 0.55 * Rr * Math.cos(t), Rr * Math.sin(t)]); }
        for (let i = 0; i <= 20; i++) { const t = Math.PI / 2 + (Math.PI * i) / 20; pts.push([-L + 0.55 * Rr * Math.cos(t), Rr * Math.sin(t)]); }
        return D.poly(pts, o);
      }
      return D.circle([0, 0], Rr, o);
    };
    body(R, { fill: EL, stroke: EDGE, sw: 1.8 });
    if (f) body(R0, { stroke: EDGE, sw: 1.2, dash: '5 4' });
    // element on the wall, with σ1 round the vessel (up the page) and σ2 along it
    const e = 0.42, s1 = MD.fromBase(g.s1, ST), s2 = MD.fromBase(g.s2, ST), mx = Math.max(Math.abs(s1), Math.abs(s2), 1e-12);
    D.poly([[-e, -e], [e, -e], [e, e], [-e, e]], { fill: '#e9edf0', stroke: EDGE, sw: 1.6 });
    const pair = (v, horiz, label) => {
      if (Math.abs(v) < 1e-12 * mx) return;
      const l = 0.3 + 0.45 * (Math.abs(v) / mx);
      [1, -1].forEach((sd) => { const p0 = horiz ? [sd * (e + 0.06), 0] : [0, sd * (e + 0.06)], p1 = horiz ? [sd * (e + 0.06 + l), 0] : [0, sd * (e + 0.06 + l)]; D.arrow(v > 0 ? p0 : p1, v > 0 ? p1 : p0, { color: NCOL, w: 2.2, head: 9 }); });
      D.text(horiz ? [e + 0.06 + l, 0] : [0, e + 0.06 + l], label, { anchor: horiz ? 'start' : 'middle', dx: horiz ? 4 : 0, dy: horiz ? -6 : -6, color: NCOL, size: 11.5, weight: 700 });
    };
    pair(s1, false, val(opt, `σ1 = ${fmt(s1)} ${ST}`, 'σ1'));
    pair(s2, true, val(opt, `σ2 = ${fmt(s2)} ${ST}`, 'σ2'));
    D.text([0, -R - 0.35], g.cyl ? 'Cylinder (side view)' : 'Sphere', { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
    // cut section with the wall and the pressure
    const cx = 6.0, ro = 1.35 + sw, ri = ro - tw;
    D.circle([cx, 0], ro, { fill: EL, stroke: EDGE, sw: 1.8 }); D.circle([cx, 0], ri, { fill: '#eef6fc', stroke: EDGE, sw: 1.4 });
    if (f) D.circle([cx, 0], 1.35, { stroke: EDGE, sw: 1.1, dash: '5 4' });
    for (let i = 0; i < 12; i++) { const t = (i / 12) * 2 * Math.PI + 0.13, d = [Math.cos(t), Math.sin(t)]; D.arrow([cx + d[0] * ri * 0.55, d[1] * ri * 0.55], [cx + d[0] * (ri - 0.04), d[1] * (ri - 0.04)], { color: '#2f7fc1', w: 1.4, head: 6 }); }
    D.text([cx, 0], val(opt, `p = ${fmt(MD.fromBase(g.p, u.PU))} ${u.PU}`, 'p'), { anchor: 'middle', dy: 4, color: '#2f7fc1', size: 12, weight: 700 });
    D.line([cx, 0], [cx + ri * Math.cos(-0.6), ri * Math.sin(-0.6)], { stroke: COL.dim, sw: 1.1 });
    D.text([cx + ri * 0.5 * Math.cos(-0.6), ri * 0.5 * Math.sin(-0.6)], val(opt, `r = ${fmt(MD.fromBase(g.r, u.S))} ${u.S}`, 'r'), { dx: 4, dy: 14, color: COL.dim, size: 11, weight: 600 });
    D.text([cx + ro, 0.5], val(opt, `t = ${fmt(MD.fromBase(g.t, u.S))} ${u.S}`, 't'), { dx: 6, color: COL.dim, size: 11, weight: 600 });
    D.text([cx, -ro - 0.35], g.cyl ? 'Cut across the cylinder' : 'Cut through the centre', { anchor: 'middle', color: COL.ink, size: 12, weight: 700 });
    if (f && g.dr) D.text([cx, ro + 0.25], val(opt, `δr = ${fmt(MD.fromBase(g.dr, u.S))} ${u.S}`, 'δr'), { anchor: 'middle', color: EDGE, size: 11, weight: 600 });
    return true;
  }

  /* Click a point on the section; drag the load on the post. */
  M.onClick = function (p, res) {
    const g = res.geo; if (g.kind !== 'section' || !lay || !lay.pts) return false;
    const q = S().sc, near = lay.pts.find((t) => Math.hypot(p[0] - t[1], p[1] - t[2]) < 0.22);
    if (near) { q.pt = near[0]; return true; }
    const y = p[0] / lay.sc, z = p[1] / lay.sc;
    if (!g.P.inside(y, z)) return false;
    const step = Math.max(g.P.cy, g.P.cz) / 50, U = g.u;
    q.pt = 'custom'; q.y = Core.tidy(MD.fromBase(Math.round(y / step) * step, U.S), 4); q.z = Core.tidy(MD.fromBase(Math.round(z / step) * step, U.S), 4);
    return true;
  };
  M.onDrag = function (p, phase, res) {
    const g = res.geo; if (g.kind !== 'eccentric' || !lay) return false;
    if (phase === 'down' && (!lay.load || Math.hypot(p[0] - lay.load[0], p[1] - lay.load[1]) > 0.5)) return false;
    const q = S().ec, U = g.u, step = Math.max(+q.b, +q.h) / 100;
    const r = (v, lim) => Math.max(-lim, Math.min(lim, Core.tidy(Math.round(v / step) * step, 4)));
    q.ey = r(MD.fromBase(p[0] / lay.sc, U.S), +q.b / 2); q.ez = r(MD.fromBase(p[1] / lay.sc, U.S), +q.h / 2);
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo; v._hs = 0.22;
    if (g.kind === 'vessel') return vessel3D(v, g, opt);
    if (g.kind === 'eccentric') return post3D(v, g, opt);
    return section3D(v, g, opt);
  };
  // member axes (x, y, z) shown as world (X, Y, Z) = (x, z, −y): x to the right, z up
  const W = (x, y, z) => [x, z, -y];
  function section3D(v, g, opt) {
    const P = g.P, L = g.L, u = g.u, sc = 1.3 / Math.max(P.cy, P.cz), st = S(), Lm = 4.5;
    const mx = Math.max(Math.abs(g.smax), Math.abs(g.smin), 1e-12), sig = (y, z) => g.stressAt(y, z).sx;
    if (P.shape === 'rect') {
      const a = (P.b / 2) * sc, c = (P.h / 2) * sc;
      v.box(-Lm, -c, -a, 0, c, a, EL, 1, EDGE);
    } else {
      MDUI.cyl(v, [-Lm, 0, 0], [0, 0, 0], P.ro * sc, EL, { n: 36, ri: P.ri ? P.ri * sc : 0, caps: true, stroke: EDGE });
    }
    // the cut face coloured by σx
    if (st.cont !== false) cells(P, sc, sig, mx, P.shape === 'rect' ? 16 : 22, (y, z, w, h, col) => v.face([W(0.004, y, z), W(0.004, y + w, z), W(0.004, y + w, z + h), W(0.004, y, z + h)], col, 1, 'fill', 1, 1, [1, 0, 0]));
    // loads on the cut face
    const vmx = Math.max(Math.abs(L.Vy), Math.abs(L.Vz), Math.abs(L.N), 1e-12), F = u.F;
    if (L.N) { const l = 0.6 + 0.9 * (Math.abs(L.N) / vmx), s = Math.sign(L.N); MDUI.arrow3(v, s > 0 ? [0.05, 0, 0] : [0.05 + l, 0, 0], s > 0 ? [0.05 + l, 0, 0] : [0.05, 0, 0], VCOL, 2.4); v.label([0.15 + l, 0.15, 0], val(opt, `N = ${fmt(+st.sc.N)} ${F}`, 'N'), VCOL); }
    if (L.Vy) { const l = 0.6 + 0.8 * (Math.abs(L.Vy) / vmx), s = Math.sign(L.Vy); MDUI.arrow3(v, W(0.05, -s * l / 2, -0.25), W(0.05, s * l / 2, -0.25), VCOL, 2.4); v.label(W(0.05, s * (l / 2 + 0.25), -0.25), val(opt, `Vy = ${fmt(+st.sc.Vy)} ${F}`, 'Vy'), VCOL); }
    if (L.Vz) { const l = 0.6 + 0.8 * (Math.abs(L.Vz) / vmx), s = Math.sign(L.Vz); MDUI.arrow3(v, W(0.05, 0.25, -s * l / 2), W(0.05, 0.25, s * l / 2), VCOL, 2.4); v.label(W(0.05, 0.35, s * (l / 2 + 0.2)), val(opt, `Vz = ${fmt(+st.sc.Vz)} ${F}`, 'Vz'), VCOL); }
    const dbl = (a, b, label) => { MDUI.arrow3(v, a, b, MCOL, 2.2); const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], b2 = [b[0] - d[0] * 0.2, b[1] - d[1] * 0.2, b[2] - d[2] * 0.2]; MDUI.arrow3(v, a, b2, MCOL, 2.2); v.label([b[0] + d[0] * 0.15, b[1] + d[1] * 0.15 + 0.1, b[2] + d[2] * 0.15], label, MCOL); };
    const R0 = Math.max(P.cy, P.cz) * sc + 0.5;
    if (L.My) { const s = Math.sign(L.My); dbl(W(0.6, -s * 0.2, R0), W(0.6, s * 1.1, R0), val(opt, `My = ${fmt(+st.sc.My)} ${u.M}`, 'My')); }
    if (L.Mz) { const s = Math.sign(L.Mz); dbl(W(0.6, R0, -s * 0.2), W(0.6, R0, s * 1.1), val(opt, `Mz = ${fmt(+st.sc.Mz)} ${u.M}`, 'Mz')); }
    if (L.T) { const s = Math.sign(L.T); dbl([s > 0 ? 1.6 : 2.9, -R0 + 0.2, 0], [s > 0 ? 2.9 : 1.6, -R0 + 0.2, 0], val(opt, `T = ${fmt(+st.sc.T)} ${u.M}`, 'T')); }
    // the point
    const pp = W(0.01, g.y * sc, g.z * sc);
    v.line([pp, [pp[0] + 0.5, pp[1] + 0.35, pp[2]]], PTC, 1.6); v.label([pp[0] + 0.6, pp[1] + 0.45, pp[2]], 'P', PTC);
    v.line([W(0.02, g.y * sc - 0.06, g.z * sc), W(0.02, g.y * sc + 0.06, g.z * sc)], PTC, 4); v.line([W(0.02, g.y * sc, g.z * sc - 0.06), W(0.02, g.y * sc, g.z * sc + 0.06)], PTC, 4);
    v.line([[0, 0, 0], [3.2, 0, 0]], AX, 1); v.label([3.35, 0, 0], 'x', AX);
    v.line([[0, 0, 0], W(0, 2.0, 0)], AX, 1); v.label(W(0, 2.15, 0), 'y', AX);
    v.line([[0, 0, 0], W(0, 0, 2.0)], AX, 1); v.label(W(0, 0, 2.15), 'z', AX);
    v.autoBounds();
  }
  function post3D(v, g, opt) {
    const sc = 2.4 / Math.max(g.b, g.h), a = (g.b / 2) * sc, c = (g.h / 2) * sc, Hp = 4.2, st = S();
    // post upright: plan y → world X, plan z → world −Z (so +z points away from the viewer)
    v.box(-a, 0, -c, a, Hp, c, EL, 1, EDGE);
    const mx = Math.max(Math.abs(g.smax), Math.abs(g.smin), 1e-12), P = { cy: g.b / 2, cz: g.h / 2, inside: () => true };
    if (st.cont !== false) cells(P, sc, g.sig, mx, 16, (y, z, w, h, col) => v.face([[y, Hp + 0.004, -z], [y + w, Hp + 0.004, -z], [y + w, Hp + 0.004, -(z + h)], [y, Hp + 0.004, -(z + h)]], col, 1, 'fill', 1, 1, [0, 1, 0]));
    if (st.kern !== false) { const ky = (g.b / 6) * sc, kz = (g.h / 6) * sc; v.line([[ky, Hp + 0.01, 0], [0, Hp + 0.01, -kz], [-ky, Hp + 0.01, 0], [0, Hp + 0.01, kz], [ky, Hp + 0.01, 0]], KCOL, 1.8, [6, 4]); }
    const lp = [g.ey * sc, Hp, -g.ez * sc], sgP = g.P >= 0 ? 1 : -1;
    MDUI.arrow3(v, sgP > 0 ? [lp[0], Hp + 1.6, lp[2]] : [lp[0], Hp + 0.05, lp[2]], sgP > 0 ? [lp[0], Hp + 0.05, lp[2]] : [lp[0], Hp + 1.6, lp[2]], PTC, 2.6);
    v.label([lp[0], Hp + 1.85, lp[2]], val(opt, `P = ${fmt(+st.ec.P)} ${g.u.F}`, 'P'), PTC);
    g.C4.forEach((k) => v.label([k.y * sc * 1.12, Hp + 0.15, -k.z * sc * 1.12], val(opt, `${k.n}: ${fmt(MD.fromBase(k.s, g.u.ST))}`, k.n), COL.ink));
    v.box(-a - 0.6, -0.25, -c - 0.6, a + 0.6, 0, c + 0.6, '#d5dbe1', 1, EDGE, { layer: -1 });
    v.autoBounds();
  }
  function vessel3D(v, g, opt) {
    const f = swellOn() ? kD() : 0, R = 1.3 * (1 + 0.12 * f), u = g.u, ST = u.ST;
    if (g.cyl) {
      MDUI.cyl(v, [-3, 0, 0], [3, 0, 0], R, EL, { n: 40, caps: false });
      const prof = []; for (let i = 0; i <= 10; i++) { const t = (Math.PI / 2) * (i / 10); prof.push([R * Math.cos(t), 0.55 * R * Math.sin(t)]); }
      // end caps as shallow domes along x
      [1, -1].forEach((sd) => {
        for (let j = 0; j < 40; j++) {
          const a0 = (j / 40) * 2 * Math.PI, a1 = ((j + 1) / 40) * 2 * Math.PI;
          for (let i = 0; i < 10; i++) {
            const P = (k, a) => [sd * (3 + prof[k][1]), prof[k][0] * Math.cos(a), prof[k][0] * Math.sin(a)];
            const am = (a0 + a1) / 2, tm = (Math.PI / 2) * ((i + 0.5) / 10), n = [sd * Math.sin(tm), Math.cos(tm) * Math.cos(am), Math.cos(tm) * Math.sin(am)];
            v.face([P(i, a0), P(i, a1), P(i + 1, a1), P(i + 1, a0)], EL, 1, 'fill', 1, 0, n);
          }
        }
      });
    } else {
      for (let j = 0; j < 36; j++) for (let i = 0; i < 18; i++) {
        const a0 = (j / 36) * 2 * Math.PI, a1 = ((j + 1) / 36) * 2 * Math.PI, b0 = -Math.PI / 2 + (Math.PI * i) / 18, b1 = -Math.PI / 2 + (Math.PI * (i + 1)) / 18;
        const P = (a, b) => [R * Math.cos(b) * Math.cos(a), R * Math.sin(b), R * Math.cos(b) * Math.sin(a)], am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
        v.face([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], EL, 1, 'fill', 1, 0, [Math.cos(bm) * Math.cos(am), Math.sin(bm), Math.cos(bm) * Math.sin(am)]);
      }
    }
    // element on the front of the wall (facing +z) with σ2 along x and σ1 round the vessel (up)
    const z = R + 0.01, e = 0.32;
    v.face([[-e, -e, z], [e, -e, z], [e, e, z], [-e, e, z]], '#e9edf0', 1, EDGE, 1, 1, [0, 0, 1]);
    const s1 = MD.fromBase(g.s1, ST), s2 = MD.fromBase(g.s2, ST), mx = Math.max(Math.abs(s1), Math.abs(s2), 1e-12);
    const pair = (val2, dir, label) => {
      if (Math.abs(val2) < 1e-12 * mx) return;
      const l = 0.3 + 0.5 * (Math.abs(val2) / mx);
      [1, -1].forEach((sd) => { const p0 = dir.map((d) => d * sd * (e + 0.05)), p1 = dir.map((d) => d * sd * (e + 0.05 + l)); p0[2] = z; p1[2] = z; MDUI.arrow3(v, val2 > 0 ? p0 : p1, val2 > 0 ? p1 : p0, NCOL, 2.2); });
      const tip = dir.map((d) => d * (e + 0.2 + l)); tip[2] = z; v.label(tip, label, NCOL);
    };
    pair(s1, [0, 1, 0], val(opt, `σ1 = ${fmt(s1)} ${ST}`, 'σ1'));
    pair(s2, [1, 0, 0], val(opt, `σ2 = ${fmt(s2)} ${ST}`, 'σ2'));
    v.autoBounds();
  }

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const SC = (o, fu, mu) => ({ mode: 'section', fu: fu || 'kN', mu: mu || 'kN·m', sc: Object.assign({ shape: 'rect', b: 50, h: 250, d: 100, di: 60, N: 0, Vy: 0, Vz: 0, My: 0, Mz: 0, T: 0, pt: 'c', y: 0, z: 0 }, o) });
  const VS = (o, pu, fu) => ({ mode: 'vessel', pu, fu: fu || 'kip', vs: Object.assign({ kind: 'cyl', task: 'stress', p: 0, r: 24, t: 0.5, sA: 20, N: 0, mat: 'custom', E: 0, nu: 0.3 }, o) });
  M.presets = [
    { name: 'Test: Book Example 13.4, rectangular member, point C at the top (σ = −64.5 MPa)', units: 'SI', state: SC({ N: -16.45, Vz: 21.93, My: -32.89, pt: 't' }),
      expect: [{ k: 'Normal stress σ_x', v: -64.5 }, { k: 'Bending stress from M_y', v: -63.16 }, { k: 'Shear stress τ_xz', v: 0 }] },
    { name: 'Test: Book Example 13.4, point D on the neutral axis (σ = −1.32 MPa, τ = 2.63 MPa)', units: 'SI', state: SC({ N: -16.45, Vz: 21.93, My: -32.89, pt: 'c' }),
      expect: [{ k: 'Normal stress σ_x', v: -1.316 }, { k: 'Shear stress τ_xz', v: 2.632 }] },
    { name: 'Test: Book Example 13.5, rod pulled and bent (σ_A = 21.4 ksi)', units: 'US', state: SC({ shape: 'circle', d: 1.5, N: 500, Mz: -7000, pt: 'r' }, 'lb', 'lb·in.'),
      expect: [{ k: 'Normal stress from N', v: 0.283 }, { k: 'Normal stress σ_x', v: 21.4 }] },
    { name: 'Test: Book Example 13.6, rod in shear, bending and torsion (τ_A = 17.5 ksi)', units: 'US', state: SC({ shape: 'circle', d: 1.5, Vz: 800, My: 8000, T: 11200, pt: 'r' }, 'lb', 'lb·in.'),
      expect: [{ k: 'Shear stress from V_z (τ_xz)', v: 0.6036 }, { k: 'Shear stress from T, τ_xz', v: 16.90 }, { k: 'Shear stress τ_xz', v: 17.5 }] },
    { name: 'Steel tube bent about both axes and twisted', units: 'SI', state: SC({ shape: 'tube', d: 120, di: 100, N: 30, Vy: 4, Vz: -6, My: 3, Mz: 2, T: 5, pt: 't' }) },
    { name: 'Test: Book Example 13.1, cylinder with a 20 ksi limit (p = 417 psi)', units: 'US', state: VS({ task: 'pmax', r: 24, t: 0.5, sA: 20 }, 'psi'),
      expect: [{ k: 'Largest internal pressure p', v: 417 }] },
    { name: 'Test: Book Example 13.1, sphere of the same size (p = 833 psi)', units: 'US', state: VS({ kind: 'sphere', task: 'pmax', r: 24, t: 0.5, sA: 20 }, 'psi'),
      expect: [{ k: 'Largest internal pressure p', v: 833 }] },
    { name: 'Test: Book Example 13.3, gas tank carrying 1500 lb on top (σ1 = 96.0 psi, σ2 = 28.3 psi)', units: 'US', state: VS({ p: 2, r: 24, t: 0.5, N: -1.5 }, 'psi'),
      expect: [{ k: 'Hoop stress σ_1', v: 0.096 }, { k: 'Longitudinal stress σ_2', v: 0.0283 }] },
    { name: 'Steel boiler drum at 1.5 MPa, with the swelling', units: 'SI', state: { mode: 'vessel', pu: 'MPa', fu: 'kN', vs: { kind: 'cyl', task: 'stress', p: 1.5, r: 600, t: 12, sA: 140, N: 0, mat: 'a36', E: 200, nu: 0.32 } } },
    { name: 'Test: Book Example 13.2, 150 lb pushing on the edge of a 4 in. × 10 in. member (σ = 7.50 psi and −15.0 psi)', units: 'US', state: { mode: 'eccentric', fu: 'lb', ec: { b: 4, h: 10, P: 150, ey: 0, ez: 5 } },
      expect: [{ k: 'Largest normal stress', v: 0.0075 }, { k: 'Smallest normal stress', v: -0.015 }, { k: 'Distance of the neutral axis from the nearer edge', v: 3.333 }] },
    { name: 'Concrete pier with the load inside the kern (no tension)', units: 'SI', state: { mode: 'eccentric', fu: 'kN', ec: { b: 300, h: 400, P: 900, ey: 30, ez: 40 } } },
    { name: 'Edge: a tube whose bore is wider than the tube (fails on purpose)', units: 'SI', fails: true, state: SC({ shape: 'tube', d: 80, di: 90, T: 2, pt: 't' }) },
  ];

  root.MCombined = M;
})(window);
