/* =====================================================================
 * STATICS · Trusses (inputs, drawings, presets)
 * Physics: st/truss.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Truss } = root;
  const { fmt, tidy } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const TCOL = '#2f6fb5', CCOL = '#c8442f', NCOL = '#46525c', ZCOL = '#9aa5ad', DCOL = '#0f8a7e', RCOL = COL.react, LCOL = COL.load, CUTC = '#e67e22';

  const M = { id: 'truss', title: 'Trusses', defaults: Truss.defaults, units: 'SI' };
  const S = () => M.state;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const BY2 = [['comp', 'Components'], ['polar', 'Magnitude and angle']];
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, F = st.fu;
    let sec = C.section(c, 'Truss');
    C.seg(sec, { label: 'Set up from', get: () => st.mode, set: (v) => (st.mode = v), options: [['template', 'A template'], ['custom', 'Joints and members']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (st.mode === 'template') {
      C.select(sec, { label: 'Type', get: () => st.tpl, set: (v) => { st.tpl = v; if (v === 'roof' && st.n % 2) st.n = +st.n + 1; }, options: Truss.TEMPLATES });
      C.num(sec, { label: 'Number of panels', get: () => st.n, set: (v) => (st.n = Math.max(2, Math.min(16, Math.round(v)))), unit: '' });
      C.num(sec, { label: 'Panel length a', get: () => st.a, set: (v) => (st.a = v), unit: Lu });
      C.num(sec, { label: st.tpl === 'roof' ? 'Rise at the middle h' : 'Height h', get: () => st.h, set: (v) => (st.h = v), unit: Lu });
      sec = C.section(c, 'Loads');
      C.num(sec, { label: 'Load P at each loaded joint (downward)', get: () => st.P, set: (v) => (st.P = v), unit: F });
      if (st.tpl !== 'roof') C.seg(sec, { label: 'Loaded joints', get: () => st.chord, set: (v) => (st.chord = v), options: [['bottom', st.tpl === 'cantilever' ? 'Bottom chord' : 'Bottom chord (inside joints)'], ['top', 'Top chord']] });
      else C.note(sec, 'The roof loads act at the top chord joints.');
      C.note(sec, st.tpl === 'cantilever' ? 'The truss is held by a pin at the top of the wall and a roller (pushing horizontally) at the bottom.' : 'A pin at the left end and a roller at the right end. Joints are lettered along the bottom chord first, then the top chord.');
    } else {
      const q = st.custom, names = () => q.joints.map((j) => [j.name, j.name]);
      sec = C.section(c, 'Joints');
      C.list(sec, { items: q.joints, max: 26, min: 3, title: (it) => `Joint ${it.name}`, fields: () => [{ key: 'x', label: 'x', unit: Lu }, { key: 'y', label: 'y', unit: Lu }],
        add: [['Joint', () => { const used = new Set(q.joints.map((j) => j.name)); let i = 0; while (used.has('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i])) i++; const l = q.joints[q.joints.length - 1]; return { name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || 'Z' + i, x: tidy(l.x + 1), y: l.y }; }]] });
      sec = C.section(c, 'Members');
      C.list(sec, { items: q.members, max: 60, min: 1, color: () => '#d6e4f3', title: (it) => `Member ${it.a}${it.b}`, fields: () => [{ key: 'a', label: 'From joint', options: names() }, { key: 'b', label: 'To joint', options: names() }],
        add: [['Member', () => ({ a: q.joints[0].name, b: q.joints[1].name })]] });
      sec = C.section(c, 'Supports');
      C.note(sec, 'A pin gives two reaction components. A roller pushes in one direction: enter the angle of that push (90° = up, 0° = toward +x).');
      C.list(sec, { items: q.supports, max: 4, color: () => '#cfe8d8', title: (it) => `${it.type === 'pin' ? 'Pin' : 'Roller'} at ${it.j}`,
        fields: (it) => [{ key: 'j', label: 'Joint', options: names() }, { key: 'type', label: 'Type', options: [['pin', 'Pin'], ['roller', 'Roller']] }].concat(it.type === 'roller' ? [{ key: 'ang', label: 'Push direction', unit: '°', wide: true }] : []),
        add: [['Pin', () => ({ j: q.joints[0].name, type: 'pin', ang: 90 })], ['Roller', () => ({ j: q.joints[q.joints.length - 1].name, type: 'roller', ang: 90 })]] });
      sec = C.section(c, 'Loads at joints');
      C.list(sec, { items: q.loads, max: 12, color: () => '#f6c9c2', title: (it, i) => `Load ${i + 1} at ${it.j}`,
        fields: (it) => [{ key: 'j', label: 'Joint', options: names() }, { key: 'by', label: 'Given as', options: BY2 }].concat(it.by === 'polar' ? [{ key: 'F', label: 'Magnitude', unit: F }, { key: 'ang', label: 'Angle ↺ from +x', unit: '°' }] : [{ key: 'Fx', label: 'F_x (→ +)', unit: F }, { key: 'Fy', label: 'F_y (↑ +)', unit: F }]),
        add: [['Load', () => ({ j: q.joints[0].name, by: 'comp', Fx: 0, Fy: -10, F: 10, ang: 270, dx: 4, dy: 3 })]] });
    }
    sec = C.section(c, 'Method of sections');
    C.toggle(sec, { label: 'Cut the truss with a section', get: () => st.cutOn !== false, set: (v) => (st.cutOn = v) });
    if (st.cutOn !== false) C.slider(sec, { label: 'Section position (fraction of the span from the left)', min: 0.01, max: 0.99, step: 0.01, get: () => st.cutF, set: (v) => (st.cutF = v), unit: '', rebuild: true });
    sec = C.section(c, 'Joint displacements');
    C.toggle(sec, { label: 'Use E and A (same for every member)', get: () => !!st.ae.use, set: (v) => (st.ae.use = v) });
    if (st.ae.use) {
      C.num(sec, { label: 'Modulus E', get: () => st.ae.E, set: (v) => (st.ae.E = v), unit: U.modulus });
      C.num(sec, { label: 'Cross-section area A', get: () => st.ae.A, set: (v) => (st.ae.A = v), unit: M.units === 'US' ? 'in²' : 'mm²' });
    } else C.note(sec, 'Without E and A the joint displacements are given as AE × δ, with AE the same for every member.');
  };
  /* switches that only change the picture, in the Diagram options bar under the diagram */
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Colour members by tension or compression', get: () => st.tcColor !== false, set: (v) => (st.tcColor = v) });
    C.toggle(c, { label: 'Show the deflected shape', get: () => st.defl !== false, set: (v) => (st.defl = v) });
    const names = M._lastNames || [];
    C.select(c, { label: 'Joint free-body diagram', get: () => st.sel || '', set: (v) => (st.sel = v || null), options: [['', 'None (or click a joint)']].concat(names.map((n) => [n, `Joint ${n}`])) });
  };

  M.compute = (U) => { const r = Truss.solve(S(), U); M._lastNames = r.ok ? r.geo.J.map((j) => j.name) : M._lastNames; return r; };
  M.onUnits = (from, to) => Truss.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  const showDefl = () => S().defl !== false;
  M.cap2D = () => (showDefl() ? 'Member forces and deflected shape' : 'Member forces');
  M.cap3D = '3D view';
  const tc = () => S().tcColor !== false;
  M.hint = () => (tc() ? 'Blue members are in tension, red in compression; the thicker' : 'The thicker') + ' the line, the larger the force. Click a joint to see its free-body diagram. Drag the orange section line to cut other members.' + (showDefl() ? ' The dashed teal truss is the deflected shape, exaggerated; press Play to watch it deflect.' : '');
  M.legend = () => (tc() ? [[TCOL, 'Tension', 'ln'], [CCOL, 'Compression', 'ln']] : [[NCOL, 'Member', 'ln']]).concat([[ZCOL, 'Zero-force', 'ln'], [LCOL, 'Loads'], [RCOL, 'Reactions']].concat(showDefl() ? [[DCOL, 'Deflected shape', 'ln']] : [], S().cutOn !== false ? [[CUTC, 'Section', 'ln']] : []));

  const deflect = root.Anim.deflection(S);
  const defK = () => (S()._k === undefined ? 1 : S()._k);
  M.anim = () => (showDefl() ? deflect : null);

  /* pointer: drag the section line, click a joint */
  let dragged = false;
  M.onDrag = function (p, phase, res) {
    const g = res.geo, st = S();
    if (!g.cut || st.cutOn === false || !M._sc) return false;
    const xs = g.J.map((j) => j.x), x0 = Math.min(...xs);
    if (phase === 'down') { if (Math.abs(p[0] - g.cut.x) * M._sc > 14) return false; dragged = true; return true; }
    const f = tidy(Math.min(0.99, Math.max(0.01, (p[0] - x0) / g.span)), 3);
    if (f === st.cutF) return false;
    st.cutF = f; return true;
  };
  M.onClick = function (p, res) {
    if (dragged) { dragged = false; return false; }
    const g = res.geo, st = S(); if (!M._sc) return false;
    let best = null, bd = 16 / M._sc;
    g.J.forEach((j) => { const d = Math.hypot(j.x - p[0], j.y - p[1]); if (d < bd) { bd = d; best = j; } });
    if (best) { st.sel = st.sel === best.name ? null : best.name; return true; }
    if (st.sel) { st.sel = null; return true; }
    return false;
  };

  /* ------------------------------------------------------------------ */
  /* 2D drawing                                                         */
  /* ------------------------------------------------------------------ */
  function arrowPx(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.42},${y2 - uy * hs + py * hs * 0.42} ${x2 - ux * hs - px * hs * 0.42},${y2 - uy * hs - py * hs * 0.42}`, fill: color }, g);
  }
  const hatch = (svg) => { const d = s('defs', {}, svg), p = s('pattern', { id: 'hatchT', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, p); };
  /** Text with a white halo so it stays readable over members. */
  let LW = 0;
  const lbl = (g, x, y, txt, o) => {
    o = Object.assign({ size: 11.5, weight: 700 }, o);
    if (LW) { const tw = txt.length * o.size * 0.56, a = o.anchor || 'start', l = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2; x += Math.max(0, 6 - l) - Math.max(0, l + tw - (LW - 6)); }
    return T(g, x, y, txt, o);
  };
  const mcol = (m) => (m.zero ? ZCOL : !tc() ? NCOL : m.F > 0 ? TCOL : CCOL);

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, st = S(), { F } = g.c;
    const sel = st.sel ? g.J.findIndex((j) => j.name === st.sel) : -1;
    const W = svg.clientWidth || 800, H = svg.clientHeight || 560;
    const xs = g.J.map((j) => j.x), ys = g.J.map((j) => j.y), e = Math.max(g.span, Math.max(...ys) - Math.min(...ys), 1e-9);
    const hasSide = g.R.some((q) => Math.abs(q.d[0]) > 0.5 && Math.abs(q.v) > 0), mx = hasSide ? 0.2 : 0.1;
    const b = { xmin: Math.min(...xs) - e * mx, xmax: Math.max(...xs) + e * mx, ymin: Math.min(...ys) - e * 0.12, ymax: Math.max(...ys) + e * 0.12 };
    const D = UI.Draw2D(svg, b, { pad: 52, padB: sel >= 0 ? H * 0.44 : 0, padT: 8 }); hatch(svg);
    M._sc = D.sc; LW = W;
    // while Play runs, the truss itself moves to its (exaggerated) deflected position; the undeformed truss stays as a ghost
    const moving = showDefl() && g.disp && st._k !== undefined, dmv = moving ? Math.max(...g.disp.map((d) => Math.hypot(d[0], d[1])), 1e-300) : 1, ampM = moving ? ((0.06 * e) / dmv) * st._k : 0;
    const g0 = D.root, P0 = (j) => [D.X(g.J[j].x), D.Y(g.J[j].y)], P = moving ? (j) => [D.X(g.J[j].x + g.disp[j][0] * ampM), D.Y(g.J[j].y + g.disp[j][1] * ampM)] : P0;
    const cx = xs.reduce((a, v) => a + v, 0) / xs.length, cy = ys.reduce((a, v) => a + v, 0) / ys.length;
    // deflected shape behind
    if (moving) g.Mm.forEach((m) => { const a = P0(m.a), bb = P0(m.b); s('line', { x1: a[0], y1: a[1], x2: bb[0], y2: bb[1], stroke: '#9aa5ad', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0.8 }, g0); });
    else if (showDefl() && g.disp) {
      const dm = Math.max(...g.disp.map((d) => Math.hypot(d[0], d[1])), 1e-300), amp = (0.06 * e) / dm * defK();
      const Q = (j) => [D.X(g.J[j].x + g.disp[j][0] * amp), D.Y(g.J[j].y + g.disp[j][1] * amp)];
      g.Mm.forEach((m) => { const a = Q(m.a), bb = Q(m.b); s('line', { x1: a[0], y1: a[1], x2: bb[0], y2: bb[1], stroke: DCOL, 'stroke-width': 1.8, 'stroke-dasharray': '6 4', opacity: 0.9 }, g0); });
      g.J.forEach((j, i) => { const q = Q(i); s('circle', { cx: q[0], cy: q[1], r: 2.6, fill: DCOL }, g0); });
    }
    // members
    g.Mm.forEach((m) => {
      const a = P(m.a), bb = P(m.b), w = m.zero ? 1.6 : 2 + 5 * (Math.abs(m.F) / (g.fmax || 1));
      s('line', { x1: a[0], y1: a[1], x2: bb[0], y2: bb[1], stroke: mcol(m), 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-dasharray': m.zero ? '5 4' : null }, g0);
    });
    // section
    if (g.cut && st.cutOn !== false) {
      const X = D.X(g.cut.x);
      s('line', { x1: X, y1: D.Y(b.ymax), x2: X, y2: D.Y(b.ymin), stroke: CUTC, 'stroke-width': 2.2, 'stroke-dasharray': '9 5' }, g0);
      s('rect', { x: X - 8, y: D.Y(b.ymax) - 2, width: 16, height: D.Y(b.ymin) - D.Y(b.ymax) + 4, fill: 'transparent', style: 'cursor: ew-resize' }, g0);
      lbl(g0, X + 6, D.Y(b.ymax) + 12, g.cut.members.length > 3 ? 'section: cuts too many members' : 'section', { color: CUTC, size: 11 });
      (g.cut.eq || []).forEach((q) => { if (!q.P) return; const px = D.X(q.P[0]), py = D.Y(q.P[1]); if (px > -50 && px < W + 50 && py > -50 && py < H + 50) s('circle', { cx: px, cy: py, r: 5, fill: 'none', stroke: CUTC, 'stroke-width': 1.6 }, g0); });
    }
    // member labels
    if (opt.showP) g.Mm.forEach((m) => {
      const a = P(m.a), bb = P(m.b), mx = (a[0] + bb[0]) / 2, my = (a[1] + bb[1]) / 2, vert = Math.abs(a[0] - bb[0]) < 2;
      lbl(g0, mx + (vert ? 5 : 0), my + (vert ? 4 : -5), m.zero ? '0' : `${fmt(Math.abs(m.F))} ${m.F > 0 ? 'T' : 'C'}`, { anchor: vert ? 'start' : 'middle', color: mcol(m), size: 11 });
    });
    // supports
    g.sup.forEach((sp) => {
      const [x, y] = P(sp.j);
      if (sp.type === 'pin') {
        // a pin sits on the side of the truss it is fixed to: below, or on a wall at the left or right end
        const jx = g.J[sp.j].x, jy = g.J[sp.j].y, pa = jy <= Math.min(...ys) + 1e-9 ? 90 : jx <= Math.min(...xs) + 1e-9 ? 0 : jx >= Math.max(...xs) - 1e-9 ? 180 : 90;
        const a = pa * DEG, n = [Math.cos(a), -Math.sin(a)], t = [-n[1], n[0]], at = (dn, dt) => [x + n[0] * dn + t[0] * dt, y + n[1] * dn + t[1] * dt];
        s('polygon', { points: [at(-5, 0), at(-24, -11), at(-24, 11)].map((p) => p.join(',')).join(' '), fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, g0);
        s('polygon', { points: [at(-24, -16), at(-24, 16), at(-30, 16), at(-30, -16)].map((p) => p.join(',')).join(' '), fill: 'url(#hatchT)' }, g0);
      }
      else {
        const a = sp.ang * DEG, n = [Math.cos(a), -Math.sin(a)], t = [-n[1], n[0]], at = (dn, dt) => [x + n[0] * dn + t[0] * dt, y + n[1] * dn + t[1] * dt];
        const c0 = at(-13, 0); s('circle', { cx: c0[0], cy: c0[1], r: 7, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, g0);
        const pts = [at(-20, -15), at(-20, 15), at(-26, 15), at(-26, -15)]; s('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: 'url(#hatchT)', stroke: COL.support }, g0);
      }
    });
    // joints and their names
    g.J.forEach((j, i) => {
      const [x, y] = P(i), isS = g.sup.some((sp) => sp.j === i);
      let dx = j.x - cx, dy = j.y - cy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      s('circle', { cx: x, cy: y, r: i === sel ? 7 : 4.5, fill: i === sel ? '#fde3c8' : '#fff', stroke: i === sel ? CUTC : '#1d2733', 'stroke-width': i === sel ? 2.4 : 1.5, style: 'cursor: pointer' }, g0);
      const lx = isS ? x + (dx < 0 ? 8 : -8) : x + dx * 14, ly = isS ? y - 9 : y - dy * 14 + 4;
      lbl(g0, lx, ly, j.name, { anchor: isS ? (dx < 0 ? 'start' : 'end') : Math.abs(dx) < 0.3 ? 'middle' : dx < 0 ? 'end' : 'start', color: '#1d2733', size: 12.5, weight: 800 });
    });
    // loads and reactions: an arrow that would come in through the truss is drawn leaving the joint instead (same force)
    const ccx = D.X(cx), ccy = D.Y(cy);
    const force = (j, ux, uy, L, gap, color, txt, size) => {
      const [x, y] = P(j), pull = -ux * (ccx - x) - uy * (ccy - y) > 0;
      const po = color === RCOL ? 34 : 9, tx = pull ? x + ux * po : x - ux * (gap + L), ty = pull ? y + uy * po : y - uy * (gap + L), hx = tx + ux * L, hy = ty + uy * L;
      arrowPx(g0, tx, ty, hx, hy, color, 2.4, 10);
      if (!txt) return;
      const sgn = pull ? 1 : -1, ex = (pull ? hx : tx) + sgn * ux * 6, ey = (pull ? hy : ty) + sgn * uy * 6, dx = sgn * ux, dy = sgn * uy;
      if (Math.abs(ux) > 0.8) lbl(g0, (tx + hx) / 2, (ty + hy) / 2 - 8, txt, { anchor: 'middle', color, size });
      else lbl(g0, ex, ey + (dy > 0.5 ? 12 : dy < -0.5 ? -3 : 4), txt, { anchor: dx > 0.5 ? 'start' : dx < -0.5 ? 'end' : 'middle', color, size });
    };
    g.loads.forEach((l) => { if (l.F > 0) force(l.j, l.Fx / l.F, -l.Fy / l.F, 40, 7, LCOL, opt.showP ? `${fmt(l.F)} ${F}` : null, 11.5); });
    g.R.forEach((q) => {
      if (!(Math.abs(q.v) > 0)) return;
      const sg = Math.sign(q.v);
      force(q.j, q.d[0] * sg, -q.d[1] * sg, 34, 36, RCOL, opt.showP ? `${q.name} = ${fmt(Math.abs(q.v))} ${F}` : null, 11);
    });
    if (sel >= 0) drawJointFBD(svg, g, sel, W, H, opt);
  };

  /** Free-body diagram of one joint, drawn in the band below the truss. */
  function drawJointFBD(svg, g, j, W, H, opt) {
    const { F } = g.c, top = H * 0.58, gg = s('g', {}, svg);
    s('rect', { x: 8, y: top, width: W - 16, height: H - top - 8, rx: 8, fill: '#ffffff', stroke: '#d3dce0' }, gg);
    T(gg, 18, top + 18, `Free-body diagram of joint ${g.J[j].name}`, { color: '#5a6b75', size: 12, weight: 700 });
    T(gg, W - 18, top + 18, 'click it again to close', { anchor: 'end', color: '#8a97a0', size: 11 });
    const bh = H - top - 30, cx = W / 2, cy = top + 22 + bh / 2, R = Math.min(W * 0.18, bh * 0.27);
    const items = [];
    g.Mm.forEach((m) => { if (m.a !== j && m.b !== j) return; const u = m.a === j ? m.u : [-m.u[0], -m.u[1]]; items.push({ u: [u[0], -u[1]], col: mcol(m), txt: m.zero ? `F_${m.name} = 0` : `F_${m.name} = ${fmt(Math.abs(m.F))} ${F} (${m.F > 0 ? 'T' : 'C'})`, away: !(m.F < 0), zero: m.zero }); });
    g.loads.forEach((l) => { if (l.j !== j || !(l.F > 0)) return; items.push({ u: [-l.Fx / l.F, l.Fy / l.F], col: LCOL, txt: `${fmt(l.F)} ${F}`, away: false }); });
    g.R.forEach((q) => { if (q.j !== j || !(Math.abs(q.v) > 0)) return; const sg = Math.sign(q.v); items.push({ u: [-q.d[0] * sg, q.d[1] * sg], col: RCOL, txt: `${q.name} = ${fmt(Math.abs(q.v))} ${F}`, away: false }); });
    items.forEach((it) => {
      const r0 = 12, r1 = R, ax = cx + it.u[0] * r0, ay = cy + it.u[1] * r0, bx = cx + it.u[0] * r1, by = cy + it.u[1] * r1;
      if (it.zero) s('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: ZCOL, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, gg);
      else if (it.away) arrowPx(gg, ax, ay, bx, by, it.col, 2.4, 10); else arrowPx(gg, bx, by, ax, ay, it.col, 2.4, 10);
      const tx = cx + it.u[0] * (r1 + 8), ty = cy + it.u[1] * (r1 + 8) + (it.u[1] > 0.5 ? 12 : it.u[1] < -0.5 ? -3 : 4);
      const tw = it.txt.length * 6.6, anchor = it.u[0] > 0.3 ? 'start' : it.u[0] < -0.3 ? 'end' : 'middle';
      let lx = tx; const left = anchor === 'start' ? lx : anchor === 'end' ? lx - tw : lx - tw / 2; lx += Math.max(0, 14 - left) - Math.max(0, left + tw - (W - 14));
      lbl(gg, lx, ty, it.txt, { anchor, color: it.col, size: 11.5 });
    });
    s('circle', { cx, cy, r: 6, fill: '#1d2733' }, gg);
    T(gg, cx + 8, cy - 8, g.J[j].name, { color: '#1d2733', size: 12, weight: 800 });
  }

  /* ------------------------------------------------------------------ */
  /* 3D view: the truss in the x–y plane                                */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = d.map((x) => x / L), hs = Math.min(L * 0.3, v._hs || L * 0.15), n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2.4));
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, F = g.c.F, ys = g.J.map((j) => j.y), e = Math.max(g.span, Math.max(...ys) - Math.min(...ys), 1e-9), t = e * 0.012;
    const moving = showDefl() && g.disp && S()._k !== undefined, dmv = moving ? Math.max(...g.disp.map((d) => Math.hypot(d[0], d[1])), 1e-300) : 1, ampM = moving ? ((0.06 * e) / dmv) * S()._k : 0;
    const xm = (Math.min(...g.J.map((j) => j.x)) + Math.max(...g.J.map((j) => j.x))) / 2, P0 = (i, dz) => [g.J[i].x - xm, g.J[i].y, dz || 0];
    const P = moving ? (i, dz) => [g.J[i].x - xm + g.disp[i][0] * ampM, g.J[i].y + g.disp[i][1] * ampM, dz || 0] : P0;
    v._hs = e * 0.03;
    g.Mm.forEach((m) => v.line([P(m.a), P(m.b)], mcol(m), m.zero ? 1.4 : 2 + 4 * (Math.abs(m.F) / (g.fmax || 1)), m.zero ? [5, 4] : null));
    g.J.forEach((j, i) => { const p = P(i); v.box(p[0] - t, p[1] - t, -t * 2, p[0] + t, p[1] + t, t * 2, '#dfe5ea', 1, '#1d2733'); v.label([p[0], p[1] + t * 4, 0], j.name, '#1d2733'); });
    g.sup.forEach((sp) => { const p = P(sp.j), w = e * 0.035; v.box(p[0] - w, p[1] - w * 2.2, -w, p[0] + w, p[1] - t * 1.5, w, sp.type === 'pin' ? '#b9c4cc' : '#d5dde2', 1, '#5a6b75'); });
    if (moving) g.Mm.forEach((m) => v.line([P0(m.a), P0(m.b)], '#9aa5ad', 1.4, [5, 4]));
    else if (showDefl() && g.disp) {
      const dm = Math.max(...g.disp.map((d) => Math.hypot(d[0], d[1])), 1e-300), amp = (0.06 * e) / dm * defK();
      const Q = (i) => [g.J[i].x - xm + g.disp[i][0] * amp, g.J[i].y + g.disp[i][1] * amp, 0];
      g.Mm.forEach((m) => v.line([Q(m.a), Q(m.b)], DCOL, 1.6, [6, 4]));
    }
    g.loads.forEach((l) => { if (!(l.F > 0)) return; const p = P(l.j), L = e * 0.12, a = [p[0] - (l.Fx / l.F) * L, p[1] - (l.Fy / l.F) * L, 0]; arrow3(v, a, p, LCOL, 2.4); if (opt.showP) v.label(a, `${fmt(l.F)} ${F}`, LCOL); });
    g.R.forEach((q) => { if (!(Math.abs(q.v) > 0)) return; const p = P(q.j), sg = Math.sign(q.v), L = e * 0.1, gap = e * 0.05, h = [p[0] - q.d[0] * sg * gap, p[1] - q.d[1] * sg * gap, 0], a = [h[0] - q.d[0] * sg * L, h[1] - q.d[1] * sg * L, 0]; arrow3(v, a, h, RCOL, 2.4); if (opt.showP) v.label(a, `${q.name} = ${fmt(Math.abs(q.v))} ${F}`, RCOL); });
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const J = (s) => s.split(' ').map((t) => { const [name, x, y] = t.split(','); return { name, x: +x, y: +y }; });
  const Mb = (s) => s.split(' ').map((m) => ({ a: m[0], b: m[1] }));
  const ld = (j, Fx, Fy) => ({ j, by: 'comp', Fx, Fy, F: Math.hypot(Fx, Fy), ang: 270, dx: 4, dy: 3 });
  const cust = (o) => Object.assign({ mode: 'custom', cutOn: false }, o);
  M.presets = [
    { name: 'Test: Book Example 6.1, three-member truss (method of joints)', units: 'SI', state: cust({ fu: 'N', custom: { joints: J('A,0,0 B,0,2 C,2,0'), members: Mb('BA BC CA'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'C', type: 'roller', ang: 90 }], loads: [ld('B', 500, 0)] } }),
      expect: [{ k: 'F_BC', v: 707.1 }, { k: 'F_BA', v: 500 }, { k: 'F_CA', v: 500 }, { k: 'N_C', v: 500 }, { k: 'A_x', v: -500 }, { k: 'A_y', v: -500 }] },
    { name: 'Test: Book Example 6.2, roof truss with a horizontal load', units: 'SI', state: cust({ fu: 'kN', custom: { joints: J('A,0,0 B,2,2 C,4,0 D,2,1.154700538'), members: Mb('AB BC CD DA DB'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'C', type: 'roller', ang: 90 }], loads: [ld('B', 3, 0)] } }),
      expect: [{ k: 'F_BC', v: 5.019 }, { k: 'F_CD', v: 4.10 }, { k: 'F_DA', v: 4.10 }, { k: 'F_DB', v: 4.10 }, { k: 'F_AB', v: 0.776 }, { k: 'N_C', v: 1.5 }] },
    { name: 'Test: Book Example 6.3, truss pinned at C', units: 'SI', state: cust({ fu: 'N', custom: { joints: J('A,0,0 B,3,4 C,6,4 D,6,0'), members: Mb('AB BC CD AD BD'), supports: [{ j: 'A', type: 'roller', ang: 90 }, { j: 'C', type: 'pin', ang: 90 }], loads: [ld('B', 0, -400), ld('D', 600, 0)] } }),
      expect: [{ k: 'F_AB', v: 750 }, { k: 'F_AD', v: 450 }, { k: 'N_A', v: 600 }, { k: 'C_x', v: -600 }, { k: 'C_y', v: -200 }] },
    { name: 'Test: Book Example 6.4, zero-force members of a Fink roof truss', units: 'SI', state: cust({ fu: 'kN', custom: { joints: J('A,0,0 B,3,1.5 C,6,3 D,9,1.5 E,12,0 H,3.75,0 G,6,0 F,8.25,0'), members: Mb('AB BC CD DE AH HG GF FE BH HC CG CF FD'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'E', type: 'roller', ang: 90 }], loads: [ld('B', 0.894427191, -1.788854382), ld('C', 0, -5)] } }),
      expect: [{ k: 'F_CG', v: 0 }, { k: 'F_FD', v: 0 }, { k: 'F_CF', v: 0 }, { k: 'F_BH', v: 2 }, { k: 'Zero-force members', v: 3 }] },
    { name: 'Test: Book Example 6.5, method of sections through BC, GC and GE', units: 'SI', state: { mode: 'custom', fu: 'N', cutOn: true, cutF: 0.42, custom: { joints: J('A,0,0 B,4,0 C,8,0 D,12,0 G,4,3 E,8,3'), members: Mb('AB BC CD AG GB GC GE EC ED'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'D', type: 'roller', ang: 90 }], loads: [ld('C', 0, -1200), ld('E', 400, 0)] } },
      expect: [{ k: 'A_x', v: -400 }, { k: 'A_y', v: 300 }, { k: 'N_D', v: 900 }, { k: 'F_BC', v: 800 }, { k: 'F_GE', v: 800 }, { k: 'F_GC', v: 500 }, { k: 'F_AB', v: 800 }, { k: 'F_CD', v: 1200 }, { k: 'F_AG', v: 500 }, { k: 'F_GB', v: 0 }, { k: 'F_EC', v: 900 }, { k: 'F_ED', v: 1500 }] },
    { name: 'Test: Book Example 6.6, force in CF by sections', units: 'SI', state: { mode: 'custom', fu: 'kN', cutOn: true, cutF: 0.625, custom: { joints: J('A,0,0 B,4,0 C,8,0 D,12,0 E,16,0 H,4,4 G,8,6 F,12,4'), members: Mb('AB BC CD DE AH HG GF FE HB GC FD HC CF'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'E', type: 'roller', ang: 90 }], loads: [ld('C', 0, -5), ld('D', 0, -3)] } },
      expect: [{ k: 'F_CF', v: 0.589 }, { k: 'A_y', v: 3.25 }, { k: 'N_E', v: 4.75 }] },
    { name: 'Test: Pratt truss, 4 panels, closed form (top chord = M/h)', units: 'SI', state: { mode: 'template', tpl: 'pratt', fu: 'kN', n: 4, a: 3, h: 4, P: 10, chord: 'bottom', cutOn: true, cutF: 0.375 },
      expect: [{ k: 'A_y', v: 15 }, { k: 'N_E', v: 15 }, { k: 'F_FG', v: 15 }, { k: 'F_BC', v: 11.25 }] },
    { name: 'Pratt bridge truss, 6 panels, with E and A (steel)', units: 'SI', state: { mode: 'template', tpl: 'pratt', fu: 'kN', n: 6, a: 3, h: 4, P: 40, chord: 'bottom', cutF: 0.42, ae: { use: true, E: 200, A: 2500 } } },
    { name: 'Howe bridge truss, 8 panels, deck loads on top', units: 'US', state: { mode: 'template', tpl: 'howe', fu: 'kip', n: 8, a: 10, h: 12, P: 8, chord: 'top', cutF: 0.32 } },
    { name: 'Warren truss, 5 panels', units: 'SI', state: { mode: 'template', tpl: 'warren', fu: 'kN', n: 5, a: 4, h: 3.5, P: 20, chord: 'bottom', cutF: 0.5 } },
    { name: 'Pitched roof truss, 6 panels', units: 'US', state: { mode: 'template', tpl: 'roof', fu: 'lb', n: 6, a: 6, h: 9, P: 600, cutF: 0.4 } },
    { name: 'Cantilever truss from a wall, 4 panels', units: 'SI', state: { mode: 'template', tpl: 'cantilever', fu: 'kN', n: 4, a: 2, h: 2.5, P: 6, chord: 'bottom', cutF: 0.4 } },
    { name: 'Edge: unstable truss, square panel without a diagonal (fails on purpose)', units: 'SI', fails: true, state: cust({ fu: 'kN', custom: { joints: J('A,0,0 B,4,0 C,4,3 D,0,3'), members: Mb('AB BC CD DA'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'B', type: 'roller', ang: 90 }], loads: [ld('C', 5, 0)] } }) },
  ];

  root.STruss = M;
})(window);
