/* =====================================================================
 * STATICS · Equilibrium (inputs, free-body diagrams, presets)
 * Physics: st/equil.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Equil } = root;
  const { fmt, tidy } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const RCOL = COL.react, LCOL = COL.load, KCOL = { pin: '#cfe8d8', roller: '#cfe8d8', fixed: '#d5dbe1', cable: '#e2cdef', link: '#f9dcc0' };

  const M = { id: 'equil', title: 'Equilibrium', defaults: Equil.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const BY2 = [['polar', 'Magnitude and angle'], ['comp', 'Components'], ['slope', 'Magnitude and slope']];
  function force2(it, F, Lu, withPoint) {
    const f = [];
    if (it.by === 'comp') f.push({ key: 'Fx', label: 'F_x (→ +)', unit: F }, { key: 'Fy', label: 'F_y (↑ +)', unit: F });
    else if (it.by === 'slope') f.push({ key: 'F', label: 'Magnitude F', unit: F, wide: true }, { key: 'dx', label: 'Run (→ +)', unit: '' }, { key: 'dy', label: 'Rise (↑ +)', unit: '' });
    else f.push({ key: 'F', label: 'Magnitude F', unit: F }, { key: 'ang', label: 'Angle ↺ from +x', unit: '°' });
    if (withPoint) f.push({ key: 'x', label: 'Acts at x', unit: Lu }, { key: 'y', label: 'Acts at y', unit: Lu });
    return f;
  }
  const massU = () => (M.units === 'US' ? 'slug' : 'kg');
  const newLoad = (o) => Object.assign({ kind: 'force', m: 10, by: 'polar', F: 10, ang: 270, Fx: 0, Fy: -10, Fz: 0, dx: 4, dy: 3, x: 0, y: 0 }, o);

  function unknownCard(sec, C, u, label, how, F, Lu) {
    C.note(sec, label);
    C.select(sec, { label: 'Name', get: () => u.name, set: (v) => (u.name = v), options: ['AB', 'AC', 'AD', 'BA', 'BC', 'BD', 'CA', 'CB', 'CD'].map((n) => [n, n]) });
    C.seg(sec, { label: 'Kind', get: () => u.type, set: (v) => (u.type = v), options: [['cable', 'Cable or cord'], ['spring', 'Spring']] });
    if (how === 'angle') C.num(sec, { label: 'Known magnitude', get: () => u.P, set: (v) => (u.P = v), unit: F });
    C.num(sec, { label: how === 'angle' ? 'Angle, first guess (↺ from +x)' : 'Direction (↺ from +x)', get: () => u.ang, set: (v) => (u.ang = v), unit: '°' });
    if (u.type === 'spring') C.num(sec, { label: 'Stiffness k', get: () => u.k, set: (v) => (u.k = v), unit: `${F}/${Lu}` });
  }

  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, F = st.fu, FL = `${F}·${Lu}`;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [['particle', 'Particle in a plane'], ['particle3d', 'Particle held by three cables in space'], ['rigid', 'Rigid body in a plane (supports and reactions)']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (st.mode === 'particle') {
      const q = st.pa;
      sec = C.section(c, 'Known loads on the particle');
      C.list(sec, { items: q.known, max: 4, min: 1, color: () => '#f6c9c2', title: (it, i) => (it.kind === 'mass' ? `Load ${i + 1}: weight` : `Load ${i + 1}: force`),
        fields: (it) => [{ key: 'kind', label: 'Kind', options: [['mass', `Weight of a mass (${massU()})`], ['force', 'Force']], wide: it.kind === 'mass' }].concat(it.kind === 'mass' ? [{ key: 'm', label: 'Mass m', unit: massU(), wide: true }] : [{ key: 'by', label: 'Given as', options: BY2 }].concat(force2(it, F, Lu, false))),
        add: [['Weight', () => newLoad({ kind: 'mass' })], ['Force', () => newLoad({ kind: 'force' })]] });
      sec = C.section(c, 'Unknowns');
      C.select(sec, { label: 'What is unknown', get: () => q.how, set: (v) => (q.how = v), options: [['two', 'Two force magnitudes (directions known)'], ['angle', 'One magnitude and one angle']] });
      unknownCard(sec, C, q.u1, 'First unknown force: its direction is known.', 'two', F, Lu);
      unknownCard(sec, C, q.u2, q.how === 'angle' ? 'Second force: its magnitude is known and its angle is found.' : 'Second unknown force: its direction is known.', q.how, F, Lu);
    } else if (st.mode === 'particle3d') {
      const q = st.p3;
      sec = C.section(c, 'Particle A');
      ['x', 'y', 'z'].forEach((k) => C.num(sec, { label: `A ${k}`, get: () => q.A[k], set: (v) => (q.A[k] = v), unit: Lu }));
      sec = C.section(c, 'Loads on the particle');
      C.note(sec, 'z points up, so a weight acts along −z.');
      C.list(sec, { items: q.known, max: 3, min: 1, color: () => '#f6c9c2', title: (it, i) => (it.kind === 'mass' ? `Load ${i + 1}: weight` : `Load ${i + 1}: force`),
        fields: (it) => [{ key: 'kind', label: 'Kind', options: [['mass', `Weight of a mass (${massU()})`], ['force', 'Force (components)']], wide: true }].concat(it.kind === 'mass' ? [{ key: 'm', label: 'Mass m', unit: massU(), wide: true }] : [{ key: 'Fx', label: 'F_x', unit: F }, { key: 'Fy', label: 'F_y', unit: F }, { key: 'Fz', label: 'F_z', unit: F, wide: true }]),
        add: [['Force', () => newLoad({ kind: 'force', by: 'comp', Fx: 0, Fy: 0, Fz: -10 })]] });
      sec = C.section(c, 'Cables');
      C.note(sec, 'Each cable pulls the particle toward its anchor point, or along the direction angles you give.');
      C.list(sec, { items: q.cables, max: 3, min: 3, color: () => '#e2cdef', title: (it) => `Cable ${it.name}`,
        fields: (it) => [{ key: 'by', label: 'Direction from', options: [['point', 'Anchor point'], ['angles', 'Direction angles']], wide: true }].concat(it.by === 'angles' ? [{ key: 'al', label: 'α', unit: '°' }, { key: 'be', label: 'β', unit: '°' }, { key: 'ga', label: 'γ', unit: '°', wide: true }] : [{ key: 'x', label: 'Anchor x', unit: Lu }, { key: 'y', label: 'Anchor y', unit: Lu }, { key: 'z', label: 'Anchor z', unit: Lu, wide: true }]) });
    } else {
      const q = st.rb;
      sec = C.section(c, 'Body outline');
      C.note(sec, 'The points are joined in order to draw the body. They only affect the picture; forces act where you place them.');
      C.list(sec, { items: q.outline, max: 8, min: 2, title: (it, i) => `Point ${i + 1}`, fields: () => [{ key: 'x', label: 'x', unit: Lu }, { key: 'y', label: 'y', unit: Lu }], add: [['Point', () => { const l = q.outline[q.outline.length - 1]; return { x: tidy(l.x + 1), y: l.y }; }]] });
      sec = C.section(c, 'Supports');
      C.note(sec, 'The angle of a roller is the direction of the force it pushes with (90° = up). The angle of a cable or link is the direction it pulls the body.');
      C.list(sec, { items: q.supports, max: 4, color: (it) => KCOL[it.type], title: (it, i) => `Support ${'ABCD'[i]}`,
        fields: (it) => [{ key: 'type', label: 'Type', options: [['pin', 'Pin'], ['roller', 'Roller (smooth surface)'], ['fixed', 'Fixed'], ['cable', 'Cable'], ['link', 'Short link']], onset: (sp) => { if (sp.type === 'roller' || sp.type === 'cable' || sp.type === 'link') sp.ang = sp.ang || 90; } }, { key: 'x', label: 'x', unit: Lu }, { key: 'y', label: 'y', unit: Lu }].concat(it.type === 'pin' || it.type === 'fixed' ? [] : [{ key: 'ang', label: it.type === 'roller' ? 'Push direction' : 'Pull direction', unit: '°' }]),
        add: [['Pin', () => ({ type: 'pin', x: 0, y: 0, ang: 90 })], ['Roller', () => ({ type: 'roller', x: 0, y: 0, ang: 90 })], ['Fixed', () => ({ type: 'fixed', x: 0, y: 0, ang: 0 })], ['Cable', () => ({ type: 'cable', x: 0, y: 0, ang: 90 })]] });
      sec = C.section(c, 'Loads');
      C.list(sec, { items: q.loads, max: 6, color: () => '#f6c9c2', title: (it, i) => `Force ${i + 1}`, fields: (it) => [{ key: 'by', label: 'Given as', options: BY2, wide: true }].concat(force2(it, F, Lu, true)), add: [['Force', () => newLoad({ by: 'polar', F: 10, ang: 270 })]] });
      C.list(sec, { items: q.couples, max: 3, color: () => '#e2cdef', title: (it, i) => `Couple ${i + 1}`, fields: () => [{ key: 'M', label: 'Moment M', unit: FL }, { key: 'dir', label: 'Direction', options: [['cw', 'Clockwise ↻'], ['ccw', 'Counterclockwise ↺']] }, { key: 'x', label: 'Drawn at x', unit: Lu }, { key: 'y', label: 'Drawn at y', unit: Lu }], add: [['Couple', () => ({ M: 10, dir: 'cw', x: 0, y: 0 })]] });
      C.list(sec, { items: q.dists, max: 3, color: () => '#f9dcc0', title: (it, i) => `Distributed load ${i + 1} (downward)`, fields: () => [{ key: 'x1', label: 'From x₁', unit: Lu }, { key: 'x2', label: 'To x₂', unit: Lu }, { key: 'w1', label: 'w₁', unit: `${F}/${Lu}` }, { key: 'w2', label: 'w₂', unit: `${F}/${Lu}` }, { key: 'y', label: 'Along the line y', unit: Lu, wide: true }], add: [['Distributed', () => ({ x1: 0, x2: 2, y: 0, w1: 5, w2: 5 })]] });
    }
  };

  M.compute = (U) => Equil.solve(S(), U);
  M.onUnits = (from, to) => Equil.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ particle: 'Free-body diagram and force polygon', particle3d: 'Top and front views', rigid: 'Free-body diagram' }[mode()]);
  M.cap3D = '3D view';
  M.hint = () => ({
    particle: 'Left: the free-body diagram of the particle. Right: the forces drawn tip to tail; in equilibrium the polygon closes.',
    particle3d: 'Cables are drawn from the particle to their anchors. Use the 3D view to see the arrangement in space.',
    rigid: 'Reactions are drawn green in the direction they actually act (a negative answer flips the arrow). Loads are red.',
  }[mode()]);
  M.legend = () => (mode() === 'rigid' ? [[LCOL, 'Loads'], [RCOL, 'Reactions'], [COL.couple, 'Couples']] : [[LCOL, 'Known loads'], [RCOL, 'Forces found'], ['#5a6b75', 'Cables', 'ln']]);
  M.anim = null;

  /* ------------------------------------------------------------------ */
  /* 2D drawing helpers                                                 */
  /* ------------------------------------------------------------------ */
  function arrowPx(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.42},${y2 - uy * hs + py * hs * 0.42} ${x2 - ux * hs - px * hs * 0.42},${y2 - uy * hs - py * hs * 0.42}`, fill: color }, g);
  }
  function arcArrow(g, cx, cy, r, a0, a1, color, w) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    s('polyline', { points: pts.slice(0, n).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': w || 2.2 }, g);
    const e = pts[n], q = pts[n - 3], L = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1, ux = (e[0] - q[0]) / L, uy = (e[1] - q[1]) / L, hs = 9, px = -uy, py = ux;
    s('polygon', { points: `${e[0]},${e[1]} ${e[0] - ux * hs + px * hs * 0.45},${e[1] - uy * hs + py * hs * 0.45} ${e[0] - ux * hs - px * hs * 0.45},${e[1] - uy * hs - py * hs * 0.45}`, fill: color }, g);
  }
  const hatch = (svg) => { const d = s('defs', {}, svg), p = s('pattern', { id: 'hatchE', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, p); };

  /* -------- particle in a plane -------- */
  function zig(g, x1, y1, x2, y2, color) {
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux, n = 10, pts = [[x1, y1]];
    for (let i = 1; i < n; i++) { const t = 0.15 + (0.7 * i) / n, sg = i % 2 ? 1 : -1; pts.push([x1 + ux * L * t + px * 7 * sg, y1 + uy * L * t + py * 7 * sg]); }
    pts.push([x2, y2]);
    s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.8 }, g);
  }
  function drawParticle(svg, g, opt) {
    const { W, H } = Charts.clear(svg); hatch(svg);
    const F = g.c.F, all = g.K.concat(g.U), Fmax = Math.max(...all.map((f) => f.F), 1e-300);
    const stack = W < 600, pw = stack ? W : W * 0.56, ph = stack ? H * 0.56 : H;
    const cx = pw / 2, cy = ph * (stack ? 0.54 : 0.5), R = Math.min(pw, ph) * (stack ? 0.3 : 0.36);
    const g0 = s('g', {}, svg);
    T(g0, 12, 20, 'Free-body diagram', { color: '#5a6b75', size: 12, weight: 700 });
    // cables or springs to the supports (beyond the arrows)
    g.U.forEach((u) => {
      const m = Math.hypot(...u.v) || 1, ux = u.v[0] / m, uy = -u.v[1] / m, ex = cx + ux * R * 1.25, ey = cy + uy * R * 1.25;
      if (u.type === 'spring') zig(g0, cx + ux * R * 0.95, cy + uy * R * 0.95, ex, ey, '#5a6b75'); else s('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke: '#9aa5ad', 'stroke-width': 1.3, 'stroke-dasharray': '5 4' }, g0);
      s('rect', { x: ex - 9, y: ey - 9, width: 18, height: 18, fill: 'url(#hatchE)', stroke: '#6b7785' }, g0);
    });
    const draw = (f, color) => {
      if (!(f.F > 0)) return;
      const len = R * (0.35 + 0.55 * (f.F / Fmax)), ux = f.v[0] / f.F, uy = -f.v[1] / f.F;
      arrowPx(g0, cx, cy, cx + ux * len, cy + uy * len, color, 2.8, 12);
      // label beside the shaft (clear of the support boxes), kept inside the panel
      const txt = opt.showP ? `${f.name} = ${fmt(f.F)} ${F}` : f.name, tw = txt.length * 6.8;
      // the side of the shaft away from the other forces
      const oth = all.filter((o) => o !== f && o.F > 0).reduce((a, o) => [a[0] + o.v[0] / o.F, a[1] - o.v[1] / o.F], [0, 0]);
      let nx = -uy, ny = ux; if (nx * oth[0] + ny * oth[1] > 0 || (Math.abs(nx * oth[0] + ny * oth[1]) < 1e-6 && ny > 0)) { nx = -nx; ny = -ny; }
      const anchor = nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle';
      let lx = cx + ux * len * 0.62 + nx * 10, ly = cy + uy * len * 0.62 + ny * 10 + (ny > 0.3 ? 10 : 0);
      const left = anchor === 'start' ? lx : anchor === 'end' ? lx - tw : lx - tw / 2;
      lx += Math.max(0, 6 - left) - Math.max(0, left + tw - (pw - 6));
      T(g0, lx, ly, txt, { anchor, color, size: 12, weight: 700 });
    };
    g.K.forEach((k) => draw(k, LCOL)); g.U.forEach((u) => draw(u, RCOL));
    s('circle', { cx, cy, r: 6, fill: '#1d2733' }, g0);
    // force polygon
    const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? W : W - pw, qh = stack ? H - ph : H;
    const g1 = s('g', {}, svg);
    s('line', { x1: ox + (stack ? 10 : 0), y1: oy + (stack ? 0 : 10), x2: stack ? W - 10 : ox, y2: stack ? oy : H - 10, stroke: '#e1e7ea' }, g1);
    T(g1, ox + 12, oy + 20, 'Force polygon (closes in equilibrium)', { color: '#5a6b75', size: 12, weight: 700 });
    const pts = [[0, 0]]; all.forEach((f) => { const l = pts[pts.length - 1]; pts.push([l[0] + f.v[0], l[1] + f.v[1]]); });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), bw = Math.max(...xs) - Math.min(...xs) || 1, bh = Math.max(...ys) - Math.min(...ys) || 1;
    const sc = Math.min((qw - 70) / bw, (qh - 70) / bh), X = (x) => ox + qw / 2 + (x - (Math.max(...xs) + Math.min(...xs)) / 2) * sc, Y = (y) => oy + 20 + (qh - 20) / 2 - (y - (Math.max(...ys) + Math.min(...ys)) / 2) * sc;
    // labels go on the outside of the polygon, beside the middle of each side
    const gx = pts.slice(1).reduce((a, p) => a + X(p[0]), 0) / (pts.length - 1), gy = pts.slice(1).reduce((a, p) => a + Y(p[1]), 0) / (pts.length - 1);
    all.forEach((f, i) => {
      const a = pts[i], b = pts[i + 1]; if (!(f.F > 0)) return;
      const col = i < g.K.length ? LCOL : RCOL, x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]), Ls = Math.hypot(x2 - x1, y2 - y1) || 1;
      arrowPx(g1, x1, y1, x2, y2, col, 2.2, 9);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; let nx = -(y2 - y1) / Ls, ny = (x2 - x1) / Ls;
      if (nx * (mx - gx) + ny * (my - gy) < 0) { nx = -nx; ny = -ny; }
      T(g1, mx + nx * 9, my + ny * 9 + 4, f.name, { anchor: nx > 0.35 ? 'start' : nx < -0.35 ? 'end' : 'middle', color: col, size: 11.5, weight: 700 });
    });
  }

  /* -------- rigid body -------- */
  function drawRigid(svg, g, opt) {
    const SW = svg.getBoundingClientRect().width || 600;
    const Tc = (gg, x, y, txt, anchor, color) => { const tw = txt.length * 6.8, l = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2; x += Math.max(0, 6 - l) - Math.max(0, l + tw - (SW - 6)); T(gg, x, y, txt, { anchor, color, size: 12, weight: 700 }); };
    const { F, Lu, FL } = g.c;
    const geom = g.outline.concat(g.sups.map((sp) => sp.p), g.loads.map((l) => l.p), g.couples.map((m) => m.p));
    const xs = geom.map((p) => p[0]), ys = geom.map((p) => p[1]), e = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
    const b = { xmin: Math.min(...xs) - e * 0.3, xmax: Math.max(...xs) + e * 0.3, ymin: Math.min(...ys) - e * 0.32, ymax: Math.max(...ys) + e * 0.32 };
    const D = UI.Draw2D(svg, b, { pad: 46 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])];
    // distributed loads first, behind the body
    const wmax = Math.max(...g.dists.map((d) => Math.max(Math.abs(d.w1), Math.abs(d.w2))), 1e-300);
    g.dists.forEach((d) => {
      const y0 = D.Y(d.y) - 7, h = (w) => 10 + 34 * (Math.abs(w) / wmax), xa = D.X(d.x1), xb = D.X(d.x2);
      s('polygon', { points: `${xa},${y0} ${xa},${y0 - h(d.w1)} ${xb},${y0 - h(d.w2)} ${xb},${y0}`, fill: LCOL, 'fill-opacity': 0.13, stroke: LCOL, 'stroke-width': 1.2 }, g0);
      const n = Math.max(2, Math.round((xb - xa) / 20));
      for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n, hh = h(d.w1) + ((h(d.w2) - h(d.w1)) * i) / n; if (hh > 12) arrowPx(g0, x, y0 - hh, x, y0, LCOL, 1.2, 6); }
      if (opt.showP) T(g0, (xa + xb) / 2, y0 - Math.max(h(d.w1), h(d.w2)) - 6, d.w1 === d.w2 ? `${fmt(d.w1)} ${F}/${Lu}` : `${fmt(d.w1)} to ${fmt(d.w2)} ${F}/${Lu}`, { anchor: 'middle', color: LCOL, size: 11.5 });
    });
    // body
    const op = g.outline.map(P);
    s('polyline', { points: op.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#4a5661', 'stroke-width': 15, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g0);
    s('polyline', { points: op.map((p) => p.join(',')).join(' '), fill: 'none', stroke: COL.body, 'stroke-width': 12, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g0);
    // supports
    g.sups.forEach((sp) => {
      const [x, y] = P(sp.p), a = sp.ang * DEG, n = [Math.cos(a), -Math.sin(a)], t = [-n[1], n[0]];
      const at = (dn, dt) => [x + n[0] * dn + t[0] * dt, y + n[1] * dn + t[1] * dt];
      const poly = (pts, fill) => s('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill, stroke: COL.support, 'stroke-width': 1.4 }, g0);
      const ground = (dn) => { poly([at(-dn, -16), at(-dn, 16), at(-dn - 6, 16), at(-dn - 6, -16)], 'url(#hatchE)'); };
      if (sp.type === 'pin') { s('polygon', { points: `${x},${y + 6} ${x - 11},${y + 26} ${x + 11},${y + 26}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, g0); s('rect', { x: x - 16, y: y + 26, width: 32, height: 6, fill: 'url(#hatchE)' }, g0); s('circle', { cx: x, cy: y, r: 4, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.5 }, g0); }
      else if (sp.type === 'roller') { const c = at(-15, 0); s('circle', { cx: c[0], cy: c[1], r: 8, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, g0); ground(23); }
      else if (sp.type === 'fixed') { poly([at(-6, -26), at(-6, 26), at(-20, 26), at(-20, -26)], 'url(#hatchE)'); }
      else if (sp.type === 'cable') { const e2 = at(Math.max(e * 0.22 * D.sc, 150), 0); s('line', { x1: x, y1: y, x2: e2[0], y2: e2[1], stroke: '#9aa5ad', 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, g0); s('rect', { x: e2[0] - 8, y: e2[1] - 8, width: 16, height: 16, fill: 'url(#hatchE)', stroke: COL.support }, g0); }
      else { const e2 = at(40, 0); s('line', { x1: x, y1: y, x2: e2[0], y2: e2[1], stroke: '#6b7785', 'stroke-width': 6, 'stroke-linecap': 'round' }, g0); [[x, y], e2].forEach((p) => s('circle', { cx: p[0], cy: p[1], r: 3.5, fill: '#fff', stroke: '#1d2733' }, g0)); poly([at(46, -14), at(46, 14), at(52, 14), at(52, -14)], 'url(#hatchE)'); }
      const lp = sp.type === 'fixed' ? at(-13, 40) : at(-34, 18);
      T(g0, lp[0], lp[1] + 4, sp.L, { anchor: 'middle', color: '#1d2733', size: 13, weight: 800 });
    });
    // loads
    const Fmax = Math.max(...g.loads.map((l) => l.F), ...g.unk.filter((u) => !u.m).map((u) => Math.abs(u.v)), 1e-300), len = (f) => 30 + 40 * (f / Fmax);
    g.loads.forEach((l) => { if (!(l.F > 0) || l.dist) return; const [x, y] = P(l.p), ux = l.v[0] / l.F, uy = -l.v[1] / l.F, L = len(l.F); arrowPx(g0, x - ux * (L + 8), y - uy * (L + 8), x - ux * 7, y - uy * 7, LCOL, 2.8, 12); if (opt.showP) T(g0, x - ux * (L + 14), y - uy * (L + 14) + (uy > 0 ? -2 : 12), `${fmt(l.F)} ${F}`, { anchor: 'middle', color: LCOL, size: 12, weight: 700 }); });
    g.couples.forEach((m) => { const [x, y] = P(m.p), ccw = m.M > 0; arcArrow(g0, x, y, 20, ccw ? -40 : 220, ccw ? 220 : -40, COL.couple, 2.3); if (opt.showP) T(g0, x, y - 28, `${fmt(Math.abs(m.M))} ${FL}`, { anchor: 'middle', color: COL.couple, size: 12 }); });
    // reactions, drawn in the direction they act
    const offs = {};
    g.unk.forEach((u) => {
      const [x, y] = P(u.p), key = u.p.join(',');
      if (u.m) { if (Math.abs(u.v) > 0) { const ccw = u.v > 0; arcArrow(g0, x, y, 32, ccw ? 110 : 250, ccw ? 250 : 110, RCOL, 2.4); if (opt.showP) T(g0, x - 38, y - 30, `${u.name} = ${fmt(Math.abs(u.v))} ${FL}`, { anchor: 'end', color: RCOL, size: 12, weight: 700 }); } return; }
      if (!(Math.abs(u.v) > 0)) return;
      const sg = Math.sign(u.v), ux = u.d[0] * sg, uy = -u.d[1] * sg, L = len(Math.abs(u.v)), gap = 30 + (offs[key] || 0) * 0;
      offs[key] = (offs[key] || 0) + 1;
      // a cable pulls: draw it leaving the point along the cable; other reactions push toward the point
      const pull = u.type === 'cable';
      const tx = pull ? x + ux * 10 : x - ux * (gap + L), ty = pull ? y + uy * 10 : y - uy * (gap + L);
      const hx = tx + ux * L, hy = ty + uy * L;
      arrowPx(g0, tx, ty, hx, hy, RCOL, 2.8, 12);
      if (opt.showP) {
        const txt = `${u.name} = ${fmt(Math.abs(u.v))} ${F}`;
        if (Math.abs(ux) > 0.8) Tc(g0, (tx + hx) / 2, (ty + hy) / 2 - 8, txt, 'middle', RCOL);
        else if (pull) {
          // beside the shaft, on the side away from the body
          const bx = op.reduce((a, q) => a + q[0], 0) / op.length, by = op.reduce((a, q) => a + q[1], 0) / op.length, mx = (tx + hx) / 2, my = (ty + hy) / 2;
          let nx = -uy, ny = ux; if (nx * (mx - bx) + ny * (my - by) < 0) { nx = -nx; ny = -ny; }
          Tc(g0, mx + nx * 10, my + ny * 10 + 4, txt, nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle', RCOL);
        }
        else {
          // past the free end of the arrow, on the far side
          const sg2 = pull ? 1 : -1, ex = (pull ? hx : tx) + sg2 * ux * 8, ey = (pull ? hy : ty) + sg2 * uy * 8, dx = sg2 * ux;
          Tc(g0, ex, ey + (sg2 * uy > 0.3 ? 12 : sg2 * uy < -0.3 ? -2 : 4), txt, dx > 0.25 ? 'start' : dx < -0.25 ? 'end' : 'middle', RCOL);
        }
      }
    });
    // axes
    const SH = svg.getBoundingClientRect().height || 400, busy = geom.map(P).concat(g.unk.map((u) => P(u.p)));
    const corners = [[24, SH - 24], [SW - 70, SH - 24], [24, 64], [SW - 70, 64]];
    const far = (c) => Math.min(...busy.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));
    const [ox, oy] = corners.reduce((a, c) => (far(c) > far(a) + 1 ? c : a));
    arrowPx(g0, ox, oy, ox + 34, oy, COL.axis, 1.4, 7); arrowPx(g0, ox, oy, ox, oy - 34, COL.axis, 1.4, 7);
    T(g0, ox + 38, oy + 4, 'x', { color: COL.axis, size: 11 }); T(g0, ox - 3, oy - 38, 'y', { color: COL.axis, size: 11 });
  }

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo;
    if (g.kind === 'particle') return drawParticle(svg, g, opt);
    if (g.kind === 'rigid') return drawRigid(svg, g, opt);
    // particle in space: top and front views
    const F = g.c.F, items = [], A = g.A, ext = Math.max(...g.cables.filter((c) => c.end).map((c) => Math.hypot(c.end[0] - A[0], c.end[1] - A[1], c.end[2] - A[2])), 1);
    const Tm = Math.max(...g.cables.map((c) => c.T), 1e-300);
    g.cables.forEach((c) => {
      const end = c.end || A.map((v, i) => v + c.u[i] * ext);
      items.push({ a: A, b: end, kind: 'line', color: '#9aa5ad', w: 1.3, dash: '5 4' });
      items.push({ a: A, b: A.map((v, i) => v + c.u[i] * ext * (0.3 + 0.4 * c.T / Tm)), color: RCOL, w: 2.8, label: opt.showP ? `F_${c.name} = ${fmt(c.T)} ${F}` : `F_${c.name}` });
      if (c.end) items.push({ a: c.end, kind: 'dot', color: '#5a6b75', label: c.name[1] });
    });
    g.K.forEach((k) => { const m = Math.hypot(...k.v) || 1; items.push({ a: A, b: A.map((v, i) => v + (k.v[i] / m) * ext * 0.6), color: LCOL, w: 2.8, label: opt.showP ? `${k.name} = ${fmt(m)} ${F}` : k.name }); });
    items.push({ a: A, kind: 'dot', color: '#1d2733', label: 'A' });
    Charts.twoViews(svg, items);
  };

  /* ------------------------------------------------------------------ */
  /* 3D views (book z up is drawn as view y)                            */
  /* ------------------------------------------------------------------ */
  const V = (p) => [p[0], p[2], -p[1]];
  function arrow3(v, a, b, color, lw) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = d.map((x) => x / L), hs = Math.min(L * 0.3, v._hs || L * 0.15), n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2.4));
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, F = g.c.F, lab = (n, x, u) => (opt.showP ? `${n} = ${fmt(x)} ${u}` : n);
    if (g.kind === 'particle3d') {
      const A = g.A, ext = Math.max(...g.cables.filter((c) => c.end).map((c) => Math.hypot(c.end[0] - A[0], c.end[1] - A[1], c.end[2] - A[2])), 1); v._hs = ext * 0.07;
      g.cables.forEach((c) => {
        const end = c.end || A.map((x, i) => x + c.u[i] * ext);
        v.line([V(A), V(end)], '#2c3e50', 2.4);
        if (c.end) { const e = V(end), h = ext * 0.05; v.box(e[0] - h, e[1] - h, e[2] - h, e[0] + h, e[1] + h, e[2] + h, '#8d98a3', 1, '#4a5661'); }
        const mid = A.map((x, i) => x + c.u[i] * ext * 0.45); arrow3(v, V(A), V(mid), RCOL, 3); v.label(V(mid), lab(`F_${c.name}`, c.T, F), RCOL);
      });
      const W = g.K.find((k) => k.name === 'W'), a = V(A), h = ext * 0.14;
      if (W) { v.line([a, [a[0], a[1] - ext * 0.35, a[2]]], '#2c3e50', 2); v.box(a[0] - h, a[1] - ext * 0.35 - 2 * h, a[2] - h, a[0] + h, a[1] - ext * 0.35, a[2] + h, '#d9b58a', 1, '#8a6a3f'); v.label([a[0] + h, a[1] - ext * 0.35 - h, a[2] + h], lab('W', -W.v[2], F), LCOL); }
      g.K.filter((k) => k.name !== 'W').forEach((k) => { const m = Math.hypot(...k.v) || 1, tip = A.map((x, i) => x + (k.v[i] / m) * ext * 0.5); arrow3(v, V(A), V(tip), LCOL, 2.6); v.label(V(tip), lab(k.name, m, F), LCOL); });
      const L = ext * 0.5; [[[L, 0, 0], 'x'], [[0, L, 0], 'y'], [[0, 0, L], 'z']].forEach(([p, n]) => { arrow3(v, V(A), V(A.map((x, i) => x + p[i])), COL.axis, 1.3); v.label(V(A.map((x, i) => x + p[i] * 1.08)), n, COL.axis); });
      v.label(a, 'A', '#1d2733');
      v.autoBounds(); return;
    }
    if (g.kind === 'particle') {
      const all = g.K.concat(g.U), Fm = Math.max(...all.map((f) => f.F), 1e-300), R = 1; v._hs = 0.1;
      v.box(-0.05, -0.05, -0.05, 0.05, 0.05, 0.05, '#1d2733', 1, null);
      g.U.forEach((u) => { const m = Math.hypot(...u.v) || 1, e = [u.v[0] / m * 1.3, u.v[1] / m * 1.3, 0]; v.line([[0, 0, 0], e], u.type === 'spring' ? '#5a6b75' : '#2c3e50', 1.6, [5, 4]); v.box(e[0] - 0.06, e[1] - 0.06, -0.15, e[0] + 0.06, e[1] + 0.06, 0.15, '#8d98a3', 1, '#4a5661'); });
      const draw = (f, col) => { if (!(f.F > 0)) return; const k = (R * (0.35 + 0.55 * f.F / Fm)) / f.F, tip = [f.v[0] * k, f.v[1] * k, 0]; arrow3(v, [0, 0, 0], tip, col, 3); v.label(tip, lab(f.name, f.F, F), col); };
      g.K.forEach((k) => draw(k, LCOL)); g.U.forEach((u) => draw(u, RCOL));
      v.autoBounds(); return;
    }
    // rigid body: extrude the outline
    const geom = g.outline.concat(g.sups.map((sp) => sp.p)), xs = geom.map((p) => p[0]), ys = geom.map((p) => p[1]), e = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9), th = e * 0.02, z = e * 0.06;
    v._hs = e * 0.04;
    for (let i = 0; i + 1 < g.outline.length; i++) {
      const a = g.outline[i], b = g.outline[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(L > 0)) continue;
      const n = [-(b[1] - a[1]) / L * th, (b[0] - a[0]) / L * th];
      v.extrude([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], -z, z, '#b9c2cb', 1, '#4a5661');
    }
    const Fmax = Math.max(...g.loads.map((l) => l.F), ...g.unk.filter((u) => !u.m).map((u) => Math.abs(u.v)), 1e-300), k = (e * 0.3) / Fmax;
    g.loads.forEach((l) => { if (!(l.F > 0)) return; const tip = [l.p[0], l.p[1], z * 1.2], tail = [tip[0] - l.v[0] * k, tip[1] - l.v[1] * k, tip[2]]; arrow3(v, tail, tip, LCOL, 2.8); if (opt.showP) v.label(tail, `${fmt(l.F)} ${F}`, LCOL); });
    g.unk.forEach((u) => {
      if (u.m || !(Math.abs(u.v) > 0)) return;
      const sg = Math.sign(u.v), tip = [u.p[0] - u.d[0] * sg * e * 0.04, u.p[1] - u.d[1] * sg * e * 0.04, z * 1.2], tail = [tip[0] - u.d[0] * sg * Math.abs(u.v) * k, tip[1] - u.d[1] * sg * Math.abs(u.v) * k, tip[2]];
      arrow3(v, tail, tip, RCOL, 2.8); v.label(tail, lab(u.name, Math.abs(u.v), F), RCOL);
    });
    g.unk.filter((u) => u.m && u.v).forEach((u) => { arrow3(v, [u.p[0], u.p[1], 0], [u.p[0], u.p[1], Math.sign(u.v) * e * 0.3], RCOL, 2.6); v.label([u.p[0], u.p[1], Math.sign(u.v) * e * 0.33], lab(u.name, Math.abs(u.v), g.c.FL), RCOL); });
    g.sups.forEach((sp) => v.label([sp.p[0], sp.p[1], -z * 1.5], sp.L, '#1d2733'));
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const ld = (F, ang, x, y) => newLoad({ by: 'polar', F, ang, x, y });
  const U1 = (name, ang, o) => Object.assign({ name, type: 'cable', ang, k: 0, P: 0 }, o);
  M.presets = [
    { name: 'Test: 60 kg cylinder on cables at 30° and 45°, T_BA = 430.9 N, T_BC = 527.7 N', units: 'SI',
      state: { mode: 'particle', fu: 'N', pa: { known: [newLoad({ kind: 'mass', m: 60 })], how: 'two', u1: U1('BA', 150), u2: U1('BC', 45) } },
      expect: [{ k: 'Force F_BA', v: 430.9 }, { k: 'Force F_BC', v: 527.7 }] },
    { name: 'Test: same cylinder with F_BC = 527.7 N known, its angle = 45.0°', units: 'SI',
      state: { mode: 'particle', fu: 'N', pa: { known: [newLoad({ kind: 'mass', m: 60 })], how: 'angle', u1: U1('BA', 150), u2: U1('BC', 30, { P: 527.7 }) } },
      expect: [{ k: 'Angle of F_BC (↺ from +x)', v: 45 }, { k: 'Force F_BA', v: 430.9 }] },
    { name: 'Lamp held by a cord and a spring (k = 500 N/m): find the stretch', units: 'SI',
      state: { mode: 'particle', fu: 'N', pa: { known: [newLoad({ kind: 'mass', m: 8 })], how: 'two', u1: U1('AB', 120), u2: U1('AC', 0, { type: 'spring', k: 500 }) } } },
    { name: 'Ring pulled by a known force and two cables', units: 'US',
      state: { mode: 'particle', fu: 'lb', pa: { known: [newLoad({ kind: 'force', by: 'slope', F: 250, dx: 3, dy: -4 })], how: 'two', u1: U1('AB', 180), u2: U1('AC', 110) } } },
    { name: 'Test: 100 kg crate on three cords, F_AB = 693.7 N, F_AC = 812.7 N, F_AD = 862.0 N', units: 'SI',
      state: { mode: 'particle3d', fu: 'N', p3: { A: { x: 0, y: 0, z: 0 }, known: [newLoad({ kind: 'mass', m: 100 })], cables: [{ name: 'AB', by: 'point', x: 1, y: 0, z: 0, al: 90, be: 90, ga: 0 }, { name: 'AC', by: 'angles', x: 0, y: 0, z: 1, al: 120, be: 135, ga: 60 }, { name: 'AD', by: 'point', x: -1, y: 2, z: 2, al: 90, be: 90, ga: 0 }] } },
      expect: [{ k: 'Tension F_AB', v: 693.7 }, { k: 'Tension F_AC', v: 812.7 }, { k: 'Tension F_AD', v: 862.0 }] },
    { name: 'Load hung from three anchors on a ceiling', units: 'US',
      state: { mode: 'particle3d', fu: 'lb', p3: { A: { x: 0, y: 0, z: 0 }, known: [newLoad({ kind: 'force', by: 'comp', Fx: 0, Fy: 0, Fz: -150 })], cables: [{ name: 'AB', by: 'point', x: -3, y: -2, z: 6, al: 90, be: 90, ga: 0 }, { name: 'AC', by: 'point', x: 3, y: -2, z: 6, al: 90, be: 90, ga: 0 }, { name: 'AD', by: 'point', x: 0, y: 4, z: 6, al: 90, be: 90, ga: 0 }] } } },
    { name: 'Test: member pinned at A, smooth roller at B on a 30° surface, N_B = 536.2 lb, A_x = 268.1 lb, A_y = 285.6 lb', units: 'US',
      state: { mode: 'rigid', fu: 'lb', rb: { outline: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: -2 }], supports: [{ type: 'pin', x: 0, y: 0, ang: 90 }, { type: 'roller', x: 6, y: -2, ang: 120 }], loads: [ld(750, 270, 3, 0)], couples: [], dists: [] } },
      expect: [{ k: 'N_B', v: 536.2 }, { k: 'A_x', v: 268.1 }, { k: 'A_y', v: 285.6 }] },
    { name: 'Simply supported beam with a point load and a partial uniform load', units: 'SI',
      state: { mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 8, y: 0 }], supports: [{ type: 'pin', x: 0, y: 0, ang: 90 }, { type: 'roller', x: 8, y: 0, ang: 90 }], loads: [ld(12, 270, 2, 0)], couples: [], dists: [{ x1: 4, x2: 8, y: 0, w1: 3, w2: 3 }] } } },
    { name: 'Test: cantilever with 10 kN at the tip and a 5 kN·m couple, M_A = 25 kN·m', units: 'SI',
      state: { mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 3, y: 0 }], supports: [{ type: 'fixed', x: 0, y: 0, ang: 0 }], loads: [ld(10, 270, 3, 0)], couples: [{ M: 5, dir: 'ccw', x: 1.5, y: 0 }], dists: [] } },
      expect: [{ k: 'M_A (↺ positive)', v: 25 }, { k: 'A_y', v: 10 }] },
    { name: 'Test: beam held by a pin and a cable at 45°, T_B = 7.071 kN', units: 'SI',
      state: { mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }], supports: [{ type: 'pin', x: 0, y: 0, ang: 90 }, { type: 'cable', x: 4, y: 0, ang: 135 }], loads: [ld(10, 270, 2, 0)], couples: [], dists: [] } },
      expect: [{ k: 'T_B', v: 7.071 }, { k: 'A_x', v: 5 }] },
    { name: 'L-shaped bracket on a pin and a short link', units: 'US',
      state: { mode: 'rigid', fu: 'lb', rb: { outline: [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }], supports: [{ type: 'pin', x: 0, y: 0, ang: 90 }, { type: 'link', x: 4, y: 3, ang: 60 }], loads: [ld(200, 270, 2, 3), ld(80, 180, 0, 1.5)], couples: [], dists: [] } } },
    { name: 'Not valid: beam on three rollers with a horizontal load (improperly constrained)', units: 'SI', fails: true,
      state: { mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 8, y: 0 }], supports: [{ type: 'roller', x: 0, y: 0, ang: 90 }, { type: 'roller', x: 4, y: 0, ang: 90 }, { type: 'roller', x: 8, y: 0, ang: 90 }], loads: [ld(5, 0, 4, 0)], couples: [], dists: [] } } },
  ];

  root.SEquil = M;
})(window);
