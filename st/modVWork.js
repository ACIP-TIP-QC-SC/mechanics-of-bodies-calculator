/* =====================================================================
 * STATICS · Virtual Work (inputs, mechanism drawing, presets)
 * Physics: st/vwork.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, VWork } = root;
  const { fmt, tidy } = Core;
  const { svgEl: s, COL } = UI;
  const DEG = Math.PI / 180;
  const LINK = '#5d7a99', LINKE = '#33485e', SCOL = '#5a6b75', DCOL = '#0f8a7e', STAB = '#1e7a45', UNST = '#c0392b', LCOL = COL.load, MCOL = COL.couple;

  const M = { id: 'vwork', title: 'Virtual Work', defaults: VWork.defaults, units: 'US' };
  const S = () => M.state;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const SUP = [['none', 'Free'], ['pin', 'Fixed pin'], ['roller', 'Roller on the ground'], ['slider', 'Collar or slider']];
  const nextName = (list, from) => { const used = new Set(list.map((p) => String(p.name))); for (const ch of from) if (!used.has(ch)) return ch; return from[0] + list.length; };
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], ang = st.q.kind !== 'length', qs = ang ? 'θ' : 'x', qu = ang ? '°' : st.lu, F = st.F, Lu = st.lu;
    const pnames = () => st.points.map((p) => [p.name, p.name]);
    const pnamesOpt = () => [['', 'None']].concat(pnames());
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Find', get: () => st.task, set: (v) => (st.task = v), options: [['eq', 'The equilibrium positions and their stability'], ['param', 'The load or value that holds a given position']] });
    C.seg(sec, { label: 'Independent coordinate', get: () => st.q.kind, set: (v) => { st.q.kind = v; if (v === 'length') Object.assign(st.q, { min: 0, max: 1, at: 0.5 }); else Object.assign(st.q, { min: 0, max: 90, at: 30 }); }, options: [['angle', 'An angle θ'], ['length', 'A length x']] });
    C.seg(sec, { label: 'Force unit', get: () => st.F, set: (v) => (st.F = v), options: U.forces.map((f) => [f, f]) });
    C.seg(sec, { label: 'Length unit', get: () => st.lu, set: (v) => (st.lu = v), options: (M.units === 'US' ? ['ft', 'in.'] : ['m', 'mm']).map((u) => [u, u]) });
    if (st.task === 'param') {
      C.num(sec, { label: `Position to hold ${qs}`, get: () => st.q.at, set: (v) => (st.q.at = v), unit: qu });
      C.select(sec, { label: 'Unknown (one of the parameters)', get: () => st.unk, set: (v) => (st.unk = v), options: st.params.length ? st.params.map((p) => [p.name, p.name]) : [['', 'Add a parameter first']] });
      C.note(sec, `The value entered for ${st.unk || 'the unknown'} is only a first guess.`);
    }
    C.num(sec, { label: `Range: ${qs} from`, get: () => st.q.min, set: (v) => (st.q.min = v), unit: qu });
    C.num(sec, { label: `Range: ${qs} to`, get: () => st.q.max, set: (v) => (st.q.max = v), unit: qu });
    C.note(sec, st.task === 'param' ? 'The range sets the plot and the Play sweep.' : `Every equilibrium position in this range is found. Play sweeps ${qs} across it.`);

    sec = C.section(c, 'Parameters');
    C.note(sec, 'Name each given value once (P, k, L, W …) and use the name in the formulas below.');
    C.list(sec, { items: st.params, max: 10, color: () => '#e2cdef', title: (it) => `${it.name}${it.u ? ' (' + it.u + ')' : ''}`,
      fields: () => [{ key: 'name', label: 'Name', text: true }, { key: 'v', label: 'Value' }, { key: 'u', label: 'Unit (label only)', text: true, wide: true }],
      add: [['Parameter', () => ({ name: nextName(st.params, 'PQRFWkLabcd'), v: 1, u: '' })]] });

    sec = C.section(c, 'Points');
    C.note(sec, `Write each coordinate as a formula in ${qs}${ang ? ' (radians inside the formula, so 4 sin θ works as written)' : ''}. Allowed: + − × / ^, brackets, sin cos tan asin acos atan sqrt abs exp ln, pi, deg, and the parameter names. Write 4 sin θ, 2L cos θ, sin(2θ) or (0.5)^2. y is up.`);
    C.list(sec, { items: st.points, max: 12, color: (it) => (it.sup !== 'none' ? '#cfe8d8' : '#d6e4f3'), title: (it) => `Point ${it.name}${it.sup !== 'none' ? ' · ' + SUP.find((x) => x[0] === it.sup)[1] : ''}`,
      fields: () => [{ key: 'name', label: 'Name', text: true }, { key: 'sup', label: 'Support (drawing)', options: SUP }, { key: 'x', label: 'x =', text: true, wide: true }, { key: 'y', label: 'y =', text: true, wide: true }],
      add: [['Point', () => ({ name: nextName(st.points, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), x: '0', y: '0', sup: 'none' })]] });
    sec = C.section(c, 'Members (drawing only)');
    C.list(sec, { items: st.links, max: 12, color: () => '#c9d3dc', title: (it) => `Member ${it.pts}`, fields: () => [{ key: 'pts', label: 'Through the points (in order)', text: true, wide: true }],
      add: [['Member', () => ({ pts: st.points.slice(0, 2).map((p) => p.name).join(' ') })]] });

    sec = C.section(c, 'Active forces');
    C.list(sec, { items: st.forces, max: 8, color: () => '#f6c9c2', title: (it, i) => `Force ${i + 1} at ${it.at}`,
      fields: () => [{ key: 'at', label: 'At point', options: pnames(), wide: true }, { key: 'Fx', label: `F_x (${F}) =`, text: true }, { key: 'Fy', label: `F_y (${F}) =`, text: true }],
      add: [['Force', () => ({ at: (st.points[st.points.length - 1] || {}).name || '', Fx: '0', Fy: '-P' })]] });
    C.list(sec, { items: st.weights, max: 8, color: () => '#d5dbe1', title: (it, i) => `Weight ${i + 1} at ${it.at}`,
      fields: () => [{ key: 'at', label: 'At its centre of gravity', options: pnames() }, { key: 'W', label: `Weight W (${F}) =`, text: true }],
      add: [['Weight', () => ({ at: (st.points[1] || st.points[0] || {}).name || '', W: '10' })]] });
    C.list(sec, { items: st.couples, max: 4, color: () => '#e2cdef', title: (it, i) => `Couple ${i + 1}`,
      fields: () => [{ key: 'M', label: `M (${F}·${Lu}, ↺ +) =`, text: true }, { key: 'phi', label: 'Member angle φ =', text: true }, { key: 'at', label: 'Drawn at', options: pnamesOpt(), wide: true }],
      add: [['Couple', () => ({ M: '10', phi: ang ? 'θ' : '0', at: (st.points[0] || {}).name || '' })]] });
    C.note(sec, `A force may depend on ${qs} (a force that stays perpendicular to a member, say). φ is the angle of the member the couple turns, as a formula in ${qs}; φ = θ when it acts on the member that θ measures.`);

    sec = C.section(c, 'Springs');
    C.list(sec, { items: st.springs, max: 6, color: () => '#fdebd0', title: (it, i) => `Spring ${i + 1}${it.kind === 'pts' ? ` ${it.a}${it.b}` : ''}`,
      fields: (it) => {
        const f = [{ key: 'kind', label: 'Stretch from', options: [['pts', 'Distance between two points'], ['expr', 'A formula s']], wide: true }, { key: 'k', label: `k (${F}/${Lu}) =`, text: true }];
        if (it.kind === 'pts') f.push({ key: 'L0', label: `Unstretched length (${Lu}) =`, text: true }, { key: 'a', label: 'End 1', options: pnames() }, { key: 'b', label: 'End 2', options: pnames() });
        else f.push({ key: 's', label: `Stretch s (${Lu}) =`, text: true }, { key: 'a', label: 'Drawn at', options: pnamesOpt(), wide: true });
        return f;
      },
      add: [['Spring', () => ({ kind: 'pts', a: (st.points[0] || {}).name || '', b: (st.points[1] || {}).name || '', k: '100', L0: '0', s: '0' })]] });
    C.note(sec, 'A spring that always stays vertical (a roller guide) or wraps on a drum is easiest as a formula: s = 2 sin θ, or s = r θ.');

    sec = C.section(c, 'Potential energy (optional)');
    C.text(sec, { label: `Extra V(${qs}) in ${F}·${Lu}`, get: () => st.V, set: (v) => (st.V = v), placeholder: ang ? 'e.g. 12 sin 2θ + 15 cos θ' : 'e.g. 20x^3 − 10x^2 − 25x − 10' });
    C.note(sec, 'Added to the potential energy of the weights and springs. With a given V alone (no points) the module finds the equilibrium positions of V directly.');
    C.note(sec, 'Formulas cannot be converted, so switching between SI and U.S. units changes only the unit names. Re-enter the numbers in the new units.');
  };
  M.diagram = function (c, C) {
    const st = S();
    C.toggle(c, { label: 'Show the virtual displacements δr of the loaded points', get: () => st.vshow !== false, set: (v) => (st.vshow = v) });
    C.toggle(c, { label: 'Show the other equilibrium positions (faint)', get: () => st.ghost !== false, set: (v) => (st.ghost = v) });
    C.select(c, { label: 'Plot', get: () => st.plotQ || 'V', set: (v) => (st.plotQ = v), options: [['V', 'Potential energy V'], ['Q', 'Virtual work per unit δθ, Q']] });
  };

  M.compute = (U) => { const r = VWork.solve(S(), U); M._noPts = !S().points.length; return r; };
  M.onUnits = (from, to) => VWork.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = 'Mechanism at the equilibrium position';
  M.cap3D = '3D view';
  M.plotCaption = () => (plotKind() === 'V' ? 'Potential energy V against the coordinate (equilibrium where the slope is zero)' : 'Virtual work Q against the coordinate (equilibrium where Q = 0)');
  M.hint = () => (S().task === 'param' ? 'The mechanism is drawn at the position held. Press Play to sweep it through the range.' : 'The mechanism is drawn at the first stable equilibrium position. Green positions are stable, red unstable. Press Play to sweep it through the range.') + (S().vshow !== false ? ' Dashed teal arrows are the virtual displacements of the loaded points.' : '');
  M.legend = () => (M._noPts ? [[LINKE, 'Coordinate', 'ln'], [STAB, 'Stable position', 'ln'], [UNST, 'Unstable position', 'ln']] : [[LINK, 'Members', 'ln'], [LCOL, 'Forces and weights'], [MCOL, 'Couples'], [SCOL, 'Springs', 'ln'], [DCOL, 'Virtual displacement δr', 'ln']]);

  const curQ = (g) => (S()._play !== undefined ? S()._play : g.show);
  M.anim = () => ({
    duration: 10, loop: true,
    frame(u) { const r = M._range; if (u <= 0 || !r) { delete S()._play; return; } S()._play = r[0] + ((r[1] - r[0]) * (1 - Math.cos(2 * Math.PI * u))) / 2; },
    label() { const r = M._range, q = S()._play; if (q === undefined || !r) return 'equilibrium position'; return r[2] ? `θ = ${fmt(tidy(q / DEG, 3))}°` : `x = ${fmt(tidy(q, 3))} ${S().lu}`; },
  });

  /* ------------------------------------------------------------------ */
  /* Geometry helpers                                                    */
  /* ------------------------------------------------------------------ */
  function boundsOver(g) {
    const md = g.md, b = { xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity };
    for (let i = 0; i <= 40; i++) {
      const P = VWork.pointsAt(md, g.lo + ((g.hi - g.lo) * i) / 40, g.over);
      Object.values(P).forEach(([x, y]) => { if (!isFinite(x) || !isFinite(y)) return; b.xmin = Math.min(b.xmin, x); b.xmax = Math.max(b.xmax, x); b.ymin = Math.min(b.ymin, y); b.ymax = Math.max(b.ymax, y); });
    }
    return b;
  }
  const velOf = (g, q) => {
    const h = g.kind === 'angle' ? 1e-4 : 1e-4 * Math.max(1, g.hi - g.lo), a = VWork.pointsAt(g.md, q - h, g.over), b = VWork.pointsAt(g.md, q + h, g.over), o = {};
    Object.keys(a).forEach((k) => (o[k] = [(b[k][0] - a[k][0]) / (2 * h), (b[k][1] - a[k][1]) / (2 * h)]));
    return o;
  };
  function zig(g, x1, y1, x2, y2, color) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux, n = 12, pts = [[x1, y1]];
    for (let i = 1; i < n; i++) { const t = 0.12 + (0.76 * i) / n, sg = i % 2 ? 1 : -1; pts.push([x1 + ux * L * t + px * 7 * sg, y1 + uy * L * t + py * 7 * sg]); }
    pts.push([x2, y2]);
    s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 2 }, g);
  }

  /* ------------------------------------------------------------------ */
  /* 2D drawing                                                          */
  /* ------------------------------------------------------------------ */
  function drawDial(svg, res, opt) {
    const g = res.geo, { W, H } = Charts.clear(svg), cx = W / 2, cy = H * 0.58, R = Math.min(W, H) * 0.32, q = curQ(g);
    const T = (x, y, t, o) => Charts.text(svg, x, y, t, o);
    if (g.kind === 'angle') {
      s('circle', { cx, cy, r: R, fill: '#f4f6f8', stroke: '#9aa5ad', 'stroke-width': 1.2 }, svg);
      for (let a = 0; a < 360; a += 15) { const r1 = a % 90 ? R * 0.93 : R * 0.86; s('line', { x1: cx + R * Math.cos(a * DEG), y1: cy - R * Math.sin(a * DEG), x2: cx + r1 * Math.cos(a * DEG), y2: cy - r1 * Math.sin(a * DEG), stroke: '#9aa5ad' }, svg); }
      // range arc
      const arc = (a0, a1, r, col, w) => { const pts = []; for (let i = 0; i <= 60; i++) { const a = a0 + ((a1 - a0) * i) / 60; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); } s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: col, 'stroke-width': w }, svg); };
      arc(g.lo, g.hi, R * 1.06, '#c9d3dc', 6);
      if (S().ghost !== false) g.roots.forEach((r) => { s('line', { x1: cx, y1: cy, x2: cx + R * Math.cos(r.q), y2: cy - R * Math.sin(r.q), stroke: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#7f8c8d', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, svg); T(cx + R * 1.16 * Math.cos(r.q), cy - R * 1.16 * Math.sin(r.q) + 4, `${fmt(r.q / DEG)}° ${opt.showP ? r.stab : ''}`, { anchor: Math.cos(r.q) < -0.2 ? 'end' : Math.cos(r.q) > 0.2 ? 'start' : 'middle', color: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#5a6b75', size: 12, weight: 700 }); });
      s('line', { x1: cx, y1: cy, x2: cx + R * 0.95 * Math.cos(q), y2: cy - R * 0.95 * Math.sin(q), stroke: LINKE, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
      s('line', { x1: cx, y1: cy, x2: cx + R * 0.5, y2: cy, stroke: '#111', 'stroke-width': 1.2 }, svg);
      arc(0, q, R * 0.3, LCOL, 1.6);
      s('circle', { cx, cy, r: 5, fill: '#fff', stroke: LINKE, 'stroke-width': 2 }, svg);
      T(cx + R * 0.36 * Math.cos(q / 2), cy - R * 0.36 * Math.sin(q / 2) + 4, `θ = ${fmt(q / DEG)}°`, { color: LCOL, size: 12.5, weight: 700 });
    } else {
      const x0 = W * 0.1, x1 = W * 0.9, X = (x) => x0 + ((x - g.lo) / (g.hi - g.lo || 1)) * (x1 - x0);
      s('line', { x1: x0, y1: cy, x2: x1, y2: cy, stroke: '#9aa5ad', 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
      Charts.niceTicks(g.lo, g.hi, 6).ticks.forEach((t) => { if (t < g.lo || t > g.hi) return; s('line', { x1: X(t), y1: cy + 6, x2: X(t), y2: cy + 12, stroke: '#5a6b75' }, svg); T(X(t), cy + 26, fmt(t), { anchor: 'middle', color: '#5a6b75', size: 11, weight: 400 }); });
      if (S().ghost !== false) g.roots.forEach((r) => { s('line', { x1: X(r.q), y1: cy - 40, x2: X(r.q), y2: cy + 2, stroke: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#7f8c8d', 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg); T(X(r.q), cy - 46, `x = ${fmt(r.q)}${opt.showP ? ' ' + r.stab : ''}`, { anchor: 'middle', color: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#5a6b75', size: 12, weight: 700 }); });
      s('rect', { x: X(q) - 14, y: cy - 12, width: 28, height: 24, rx: 3, fill: LINK, stroke: LINKE, 'stroke-width': 1.5 }, svg);
      T(X(q), cy + 46, `x = ${fmt(q)} ${g.Lu}`, { anchor: 'middle', color: LCOL, size: 12.5, weight: 700 });
    }
    T(14, 22, 'No points are given: the coordinate is shown on a dial.', { color: '#5a6b75', size: 11.5, weight: 400 });
  }

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, md = g.md;
    M._range = [g.lo, g.hi, g.kind === 'angle'];
    if (!Object.keys(md.pts).length) return drawDial(svg, res, opt);
    const st = S(), q = curQ(g), P = VWork.pointsAt(md, q, g.over);
    const b = boundsOver(g), ext = Math.max(b.xmax - b.xmin, b.ymax - b.ymin, 1e-9), mg = ext * 0.22;
    const D = UI.Draw2D(svg, { xmin: b.xmin - mg, xmax: b.xmax + mg, ymin: b.ymin - mg, ymax: b.ymax + mg }, { pad: 40, padT: 18 });
    const sp = (n) => [D.X(P[n][0]), D.Y(P[n][1])];
    const gg = s('g', {}, D.root);
    const drawLinks = (PP, o) => md.links.forEach((l) => { const pts = l.map((p) => PP[p.name]); if (pts.every((p) => isFinite(p[0]) && isFinite(p[1]))) D.pline(pts, o); });
    // other equilibrium positions, faint
    if (st.ghost !== false && st.task !== 'param') g.roots.forEach((r) => { if (Math.abs(r.q - q) < 1e-9) return; drawLinks(VWork.pointsAt(md, r.q, g.over), { stroke: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#9aa5ad', sw: 3, dash: '7 5', op: 0.55 }); });
    // ground under the lowest support
    // springs
    md.springs.forEach((spr, i) => {
      if (spr.kind === 'pts' && P[spr.a.name] && P[spr.b.name]) { const a = sp(spr.a.name), c = sp(spr.b.name); zig(gg, a[0], a[1], c[0], c[1], SCOL); if (opt.showP) { const e = VWork.envOf(md, q, g.over), F = spr.fk(e) * VWork.stretch(spr, e); D.text([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], `F_s = ${fmt(F)} ${g.F}`, { px: true, dx: 8, dy: -10, color: SCOL, size: 11.5, weight: 700 }); } }
      else if (spr.kind === 'expr' && spr.a && P[spr.a.name]) {
        const a = sp(spr.a.name), yb = D.Y(b.ymin - mg * 0.6);
        zig(gg, a[0], a[1], a[0], yb, SCOL);
        s('rect', { x: a[0] - 14, y: yb, width: 28, height: 7, fill: 'url(#hatch)', stroke: COL.support }, gg);
        if (opt.showP) { const e = VWork.envOf(md, q, g.over), F = spr.fk(e) * VWork.stretch(spr, e); D.text([a[0], (a[1] + yb) / 2], `F_s = ${fmt(F)} ${g.F}`, { px: true, dx: 12, color: SCOL, size: 11.5, weight: 700 }); }
      }
    });
    drawLinks(P, { stroke: LINK, sw: 9 });
    drawLinks(P, { stroke: '#8fa6bd', sw: 4 });
    // supports
    Object.values(md.pts).forEach((p) => {
      const [x, y] = sp(p.name);
      if (!isFinite(x) || !isFinite(y)) return;
      if (p.sup === 'pin') {
        s('polygon', { points: `${x},${y} ${x - 11},${y + 18} ${x + 11},${y + 18}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, gg);
        s('rect', { x: x - 16, y: y + 18, width: 32, height: 7, fill: 'url(#hatch)', stroke: COL.support }, gg);
      } else if (p.sup === 'roller') {
        s('circle', { cx: x, cy: y + 8, r: 7, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, gg);
        s('rect', { x: x - 16, y: y + 15, width: 32, height: 7, fill: 'url(#hatch)', stroke: COL.support }, gg);
      } else if (p.sup === 'slider') s('rect', { x: x - 13, y: y - 9, width: 26, height: 18, rx: 2, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.6 }, gg);
    });
    Object.values(md.pts).forEach((p) => { const [x, y] = sp(p.name); if (!isFinite(x) || !isFinite(y)) return; s('circle', { cx: x, cy: y, r: 4, fill: '#fff', stroke: LINKE, 'stroke-width': 2 }, gg); D.text([x, y], p.name, { px: true, dx: -8, dy: -8, anchor: 'end', color: COL.ink, size: 13, weight: 700 }); });
    // loads
    const e = VWork.envOf(md, q, g.over);
    md.forces.forEach((f, i) => {
      const Fx = f.fx(e), Fy = f.fy(e), m = Math.hypot(Fx, Fy); if (!(m > 0) || !P[f.p.name]) return;
      D.force(P[f.p.name], [Fx, Fy], 54, { color: LCOL, label: opt.showP ? `F${i + 1} = ${fmt(m)} ${g.F}` : `F${i + 1}`, lp: 'tail', ldx: Fx > 0 ? -6 : 6, anchor: Fx > 0 ? 'end' : 'start' });
    });
    md.weights.forEach((w, i) => {
      const W = w.fw(e); if (!P[w.p.name]) return;
      const a = P[w.p.name], [x, y] = sp(w.p.name);
      D.arrow([a[0], a[1]], [a[0], a[1] - 50 / D.sc], { color: '#111', w: 3, head: 12 });
      D.text([x, y + 50], opt.showP ? `W${md.weights.length > 1 ? i + 1 : ''} = ${fmt(W)} ${g.F}` : `W${md.weights.length > 1 ? i + 1 : ''}`, { px: true, dx: 6, dy: -2, color: '#111', size: 12.5, weight: 700 });
    });
    md.couples.forEach((cp, i) => {
      const Mv = cp.fm(e), at = cp.p && P[cp.p.name] ? sp(cp.p.name) : [D.X((b.xmin + b.xmax) / 2), D.Y((b.ymin + b.ymax) / 2)], r = 24, ccw = Mv >= 0;
      const a0 = ccw ? -0.7 : 3.84, a1 = ccw ? 3.84 : -0.7, pts = [];
      for (let k = 0; k <= 30; k++) { const a = a0 + ((a1 - a0) * k) / 30; pts.push([at[0] + r * Math.cos(a), at[1] - r * Math.sin(a)]); }
      s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: MCOL, 'stroke-width': 2.4 }, gg);
      const pe = pts[30], pb = pts[28], L = Math.hypot(pe[0] - pb[0], pe[1] - pb[1]) || 1;
      D.head(pe[0], pe[1], (pe[0] - pb[0]) / L, (pe[1] - pb[1]) / L, MCOL, 11, gg);
      D.text([at[0] + r + 6, at[1] - r], opt.showP ? `M${md.couples.length > 1 ? i + 1 : ''} = ${fmt(Math.abs(Mv))} ${g.F}·${g.Lu}` : `M${md.couples.length > 1 ? i + 1 : ''}`, { px: true, color: MCOL, size: 12.5, weight: 700 });
    });
    // virtual displacements
    if (st.vshow !== false) {
      const V = velOf(g, q), done = new Set();
      md.forces.map((f) => f.p).concat(md.weights.map((w) => w.p)).concat(md.springs.filter((x) => x.kind === 'pts').flatMap((x) => [x.a, x.b])).forEach((p) => {
        if (!p || done.has(p.name) || !P[p.name]) return; done.add(p.name);
        const v = V[p.name], m = Math.hypot(v[0], v[1]); if (!(m > 1e-9)) return;
        const a = sp(p.name), L = 38, ux = v[0] / m, uy = -v[1] / m;
        s('line', { x1: a[0], y1: a[1], x2: a[0] + ux * L, y2: a[1] + uy * L, stroke: DCOL, 'stroke-width': 1.8, 'stroke-dasharray': '4 3' }, gg);
        D.head(a[0] + ux * (L + 6), a[1] + uy * (L + 6), ux, uy, DCOL, 9, gg);
        D.text([a[0] + ux * (L + 10), a[1] + uy * (L + 10)], `δr_${p.name}`, { px: true, dx: ux >= 0 ? 3 : -3, dy: 4, anchor: ux >= 0 ? 'start' : 'end', color: DCOL, size: 11, weight: 700 });
      });
    }
    // position read-out
    const r = g.roots.find((x) => Math.abs(x.q - q) < 1e-9);
    const qt = g.kind === 'angle' ? `θ = ${fmt(q / DEG)}°` : `x = ${fmt(q)} ${g.Lu}`;
    D.text([D.W - 12, 20], st._play !== undefined ? qt : st.task === 'param' ? `${qt}   ${g.unk} = ${fmt(g.unkV)}` : `${qt}${r && g.cons ? '   ' + r.stab : ''}`, { px: true, anchor: 'end', color: r ? (r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : COL.ink) : COL.ink, size: 13, weight: 700 });
  };

  /* ------------------------------------------------------------------ */
  /* Plot                                                                */
  /* ------------------------------------------------------------------ */
  const plotKind = () => (S().plotQ === 'Q' || !(M._lastCons) ? 'Q' : 'V');
  M.plot = function (svg, res) {
    const g = res.geo, ang = g.kind === 'angle', X = (q) => (ang ? q / DEG : q);
    M._lastCons = g.cons;
    const useV = plotKind() === 'V' && g.Vs;
    const data = useV ? g.Vs : g.Qs, val = (q) => (useV ? g.md && VWork.Vtot(g.md, q) : VWork.Qterms(g.md, q, g.over).Q);
    const pts = data.filter(([, y]) => isFinite(y)).map(([q, y]) => [X(q), y]);
    if (!pts.length) return false;
    // keep huge spikes (tan, 1/cos) from flattening the curve
    const ys = pts.map((p) => Math.abs(p[1])).sort((a, b) => a - b), cap = ys[Math.floor(ys.length * 0.95)] * 4 || Infinity;
    const clip = pts.map(([x, y]) => [x, Math.max(-cap, Math.min(cap, y))]);
    const marks = [];
    if (S().task === 'param') { const q0 = g.show; marks.push({ x: X(q0), y: VWork.Qterms(g.md, q0, g.over).Q, label: `held at ${fmt(X(q0))}${ang ? '°' : ''}`, color: LCOL }); }
    else g.roots.forEach((r) => marks.push({ x: X(r.q), y: val(r.q), label: `${fmt(X(r.q))}${ang ? '°' : ''}${g.cons ? ' ' + r.stab : ''}`, color: r.stab === 'stable' ? STAB : r.stab === 'unstable' ? UNST : '#5a6b75' }));
    if (S()._play !== undefined) marks.push({ x: X(S()._play), y: Math.max(-cap, Math.min(cap, val(S()._play))), color: '#2f7fc1', r: 5 });
    const xl = ang ? 'θ (°)' : `x (${g.Lu})`;
    return Charts.plot(svg, { xlabel: xl, ylabel: useV ? `V (${g.E})` : `Q (${ang ? g.E + '/rad' : g.F})`, series: [{ name: useV ? 'V' : 'Q', color: useV ? '#2f7fc1' : '#c0563a', pts: clip, width: 2.2 }], marks });
  };

  /* ------------------------------------------------------------------ */
  /* 3D view (view axes: x right, y up, z toward the viewer)            */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    v.line([a, b], color, lw || 2);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map((x) => x / L), hs = L * 0.18;
    const n = Math.abs(u[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
    const base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.45)], color, lw || 2));
  }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, md = g.md, q = curQ(g);
    M._range = [g.lo, g.hi, g.kind === 'angle'];
    const pts = Object.keys(md.pts);
    if (!pts.length) {
      // a dial: a disc and a pointer at the coordinate
      const ring = []; for (let i = 0; i < 48; i++) ring.push([Math.cos((i / 48) * 2 * Math.PI), Math.sin((i / 48) * 2 * Math.PI)]);
      v.extrude(ring, -0.08, 0, '#c9d3dc', 1, '#4a5661', { sideStroke: null });
      const a = g.kind === 'angle' ? q : -Math.PI / 2 + ((q - g.lo) / (g.hi - g.lo || 1)) * Math.PI;
      v.extrude([[0, -0.04], [0.9, -0.04], [0.9, 0.04], [0, 0.04]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]), 0.01, 0.08, LINK, 1, LINKE);
      v.label([1.15 * Math.cos(a), 1.15 * Math.sin(a), 0.1], g.kind === 'angle' ? `θ = ${fmt(q / DEG)}°` : `x = ${fmt(q)}`, LCOL);
      v.setBounds([-1.3, -1.3, -0.3], [1.3, 1.3, 0.3]);
      return;
    }
    const P = VWork.pointsAt(md, q, g.over), b = boundsOver(g), ext = Math.max(b.xmax - b.xmin, b.ymax - b.ymin, 1e-9), w = ext * 0.035, t = ext * 0.03;
    md.links.forEach((l, li) => {
      for (let i = 0; i + 1 < l.length; i++) {
        const a = P[l[i].name], c = P[l[i + 1].name]; if (!a || !c) continue;
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1e-9, n = [-(c[1] - a[1]) / L * w, (c[0] - a[0]) / L * w], z0 = (li % 2) * t * 1.3;
        v.extrude([[a[0] + n[0], a[1] + n[1]], [c[0] + n[0], c[1] + n[1]], [c[0] - n[0], c[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], z0, z0 + t, '#9fb3c8', 1, LINKE);
      }
    });
    Object.values(md.pts).forEach((p) => {
      const a = P[p.name]; if (!a) return;
      v.circle(a[0], a[1], t * 2.5, w * 0.6, LINKE, 2, 16);
      v.label([a[0], a[1], t * 3], p.name, COL.ink);
      if (p.sup === 'pin' || p.sup === 'roller') v.box(a[0] - w * 1.3, a[1] - w * 3, -t * 1.2, a[0] + w * 1.3, a[1] - w * 1.2, t * 2.6, '#c9d3dc', 1, '#4a5661');
      if (p.sup === 'slider') v.box(a[0] - w * 1.3, a[1] - w, -t * 0.4, a[0] + w * 1.3, a[1] + w, t * 2.8, '#e8eef1', 0.8, '#4a5661');
    });
    const e = VWork.envOf(md, q, g.over), Ls = ext * 0.22;
    md.forces.forEach((f, i) => { const Fx = f.fx(e), Fy = f.fy(e), m = Math.hypot(Fx, Fy), a = P[f.p.name]; if (!(m > 0) || !a) return; const tail = [a[0] - (Fx / m) * Ls, a[1] - (Fy / m) * Ls, t * 3]; arrow3(v, tail, [a[0], a[1], t * 3], LCOL, 2.4); v.label(tail, opt.showP ? `F${i + 1} = ${fmt(m)} ${g.F}` : `F${i + 1}`, LCOL); });
    md.weights.forEach((wt, i) => { const a = P[wt.p.name]; if (!a) return; arrow3(v, [a[0], a[1], t * 3], [a[0], a[1] - Ls, t * 3], '#111', 2.4); v.label([a[0], a[1] - Ls * 1.1, t * 3], opt.showP ? `W = ${fmt(wt.fw(e))} ${g.F}` : 'W', '#111'); });
    md.springs.forEach((spr) => {
      if (spr.kind !== 'pts' || !P[spr.a.name] || !P[spr.b.name]) return;
      const a = P[spr.a.name], c = P[spr.b.name], zz = [];
      for (let k = 0; k <= 24; k++) { const f = k / 24, r = k === 0 || k === 24 ? 0 : w * 0.9; zz.push([a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f + r * Math.cos(k * Math.PI / 2), t * 1.5 + r * Math.sin(k * Math.PI / 2)]); }
      v.line(zz, SCOL, 1.8);
    });
    v.setBounds([b.xmin - ext * 0.3, b.ymin - ext * 0.3, -ext * 0.2], [b.xmax + ext * 0.3, b.ymax + ext * 0.3, ext * 0.2]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets (each one is a complete snapshot)                          */
  /* ------------------------------------------------------------------ */
  const pt = (name, x, y, sup) => ({ name, x, y, sup: sup || 'none' });
  const base = { forces: [], weights: [], springs: [], couples: [], V: '', links: [], points: [], params: [] };
  const P = (o) => Object.assign({}, base, o);
  M.presets = [
    { name: 'Test: link with a vertical spring at mid-length, P = 8 lb, k = 50 lb/ft (Prob. 11-15): θ = 9.21°', units: 'US',
      state: P({ task: 'eq', F: 'lb', lu: 'ft', q: { kind: 'angle', min: 0, max: 90, at: 30 }, params: [{ name: 'P', v: 8, u: 'lb' }, { name: 'k', v: 50, u: 'lb/ft' }],
        points: [pt('O', '0', '0', 'pin'), pt('B', '2 cos θ', '2 sin θ'), pt('A', '4 cos θ', '4 sin θ')], links: [{ pts: 'O B A' }],
        forces: [{ at: 'A', Fx: '0', Fy: 'P' }], springs: [{ kind: 'expr', a: 'B', b: '', k: 'k', L0: '0', s: '2 sin θ' }] }),
      expect: [{ k: 'Equilibrium position 1 θ', v: 9.21 }, { k: 'Equilibrium position 2 θ', v: 90 }] },
    { name: 'Test: two links opened by a spring of unstretched length 0.3 m, P = 50 N (Prob. 11-21): θ = 33.4° and 90°', units: 'SI',
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 90, at: 30 }, params: [{ name: 'P', v: 50, u: 'N' }, { name: 'k', v: 200, u: 'N/m' }],
        points: [pt('A', '0', '0', 'pin'), pt('B', '0.5 sin θ', '0.5 cos θ'), pt('C', 'sin θ', 'cos θ'), pt('D', '-0.5 sin θ', '0.5 cos θ'), pt('E', '-sin θ', 'cos θ')], links: [{ pts: 'A B C' }, { pts: 'A D E' }],
        forces: [{ at: 'C', Fx: 'P', Fy: '0' }], springs: [{ kind: 'pts', a: 'D', b: 'B', k: 'k', L0: '0.3', s: '0' }] }),
      expect: [{ k: 'Equilibrium position 1 θ', v: 33.4 }, { k: 'Equilibrium position 2 θ', v: 90 }] },
    { name: 'Test: uniform 20 lb rod with a spring on a 1 in. drum, k = 2 lb/in. (Prob. 11-38): θ = 64.8° stable, 0° unstable', units: 'US',
      state: P({ task: 'eq', F: 'lb', lu: 'in.', q: { kind: 'angle', min: 0, max: 90, at: 30 }, params: [{ name: 'W', v: 20, u: 'lb' }, { name: 'k', v: 2, u: 'lb/in.' }],
        points: [pt('O', '0', '0', 'pin'), pt('G', '18 sin θ', '18 cos θ'), pt('A', '36 sin θ', '36 cos θ')], links: [{ pts: 'O G A' }],
        weights: [{ at: 'G', W: 'W' }], springs: [{ kind: 'expr', a: '', b: '', k: 'k', L0: '0', s: '12 θ' }] }),
      expect: [{ k: 'Equilibrium position 1 θ', v: 0 }, { k: 'Equilibrium position 2 θ', v: 64.8 }, { k: 'd²V/dθ² at position 2', v: 135 }] },
    { name: 'Test: scissors jack, P = 100 lb at θ = 30°: screw force F = 2P cot θ = 346 lb (Prob. 11-2)', units: 'US',
      state: P({ task: 'param', unk: 'F', F: 'lb', lu: 'ft', q: { kind: 'angle', min: 10, max: 80, at: 30 }, params: [{ name: 'P', v: 100, u: 'lb' }, { name: 'L', v: 1, u: 'ft' }, { name: 'F', v: 100, u: 'lb' }],
        points: [pt('A', '0', '0', 'pin'), pt('B', 'L cos θ', '0', 'roller'), pt('C', '0', 'L sin θ', 'slider'), pt('D', 'L cos θ', 'L sin θ', 'slider'), pt('E', '0', '2L sin θ'), pt('G', 'L cos θ', '2L sin θ')],
        links: [{ pts: 'A D' }, { pts: 'B C' }, { pts: 'C G' }, { pts: 'D E' }, { pts: 'E G' }], forces: [{ at: 'B', Fx: '-F', Fy: '0' }, { at: 'E', Fx: '0', Fy: '-P' }] }),
      expect: [{ k: 'Unknown F for equilibrium', v: 346.4 }] },
    { name: 'Test: 0.5 m crank, couple M = 6 N·m balanced by a horizontal force at its end at θ = 60°: F = 13.9 N', units: 'SI',
      state: P({ task: 'param', unk: 'F', F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 90, at: 60 }, params: [{ name: 'M', v: 6, u: 'N·m' }, { name: 'F', v: 10, u: 'N' }],
        points: [pt('A', '0', '0', 'pin'), pt('B', '0.5 cos θ', '0.5 sin θ')], links: [{ pts: 'A B' }],
        forces: [{ at: 'B', Fx: 'F', Fy: '0' }], couples: [{ M: 'M', phi: 'θ', at: 'A' }] }),
      expect: [{ k: 'Unknown F for equilibrium', v: 13.86 }] },
    { name: 'Test: given V = 12 sin 2θ + 15 cos θ J (Prob. 11-27): 34.6° unstable, 145° stable', units: 'SI',
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 180, at: 30 }, V: '12 sin 2θ + 15 cos θ' }),
      expect: [{ k: 'Equilibrium position 1 θ', v: 34.6 }, { k: 'd²V/dθ² at position 1', v: -57.2 }, { k: 'Equilibrium position 2 θ', v: 145.4 }, { k: 'd²V/dθ² at position 2', v: 57.2 }] },
    { name: 'Test: given V = 20x³ − 10x² − 25x − 10 J (Prob. 11-26): x = 0.833 m stable, −0.5 m unstable', units: 'SI',
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'length', min: -2, max: 2, at: 0 }, V: '20x^3 - 10x^2 - 25x - 10' }),
      expect: [{ k: 'Equilibrium position 1 x', v: -0.5 }, { k: 'Equilibrium position 2 x', v: 0.8333 }] },
    { name: 'Inverted pendulum held by a horizontal spring: three equilibrium positions', units: 'SI',
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'angle', min: -80, max: 80, at: 0 }, params: [{ name: 'W', v: 150, u: 'N' }, { name: 'k', v: 400, u: 'N/m' }, { name: 'L', v: 1, u: 'm' }],
        points: [pt('O', '0', '0', 'pin'), pt('A', 'L sin θ', 'L cos θ'), pt('S', '-1.6L', 'L cos θ', 'slider')], links: [{ pts: 'O A' }],
        weights: [{ at: 'A', W: 'W' }], springs: [{ kind: 'pts', a: 'S', b: 'A', k: 'k', L0: '1.6L', s: '0' }] }) },
    { name: 'Collar on a smooth bar pulled by a spring, with a weight (length coordinate)', units: 'SI',
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'length', min: 0.05, max: 1.5, at: 0.5 }, params: [{ name: 'W', v: 20, u: 'N' }, { name: 'k', v: 120, u: 'N/m' }],
        points: [pt('O', '0', '0', 'pin'), pt('C', '0', '-x', 'slider'), pt('B', '0.6', '0', 'pin')], links: [{ pts: 'O C' }],
        weights: [{ at: 'C', W: 'W' }], springs: [{ kind: 'pts', a: 'B', b: 'C', k: 'k', L0: '0.4', s: '0' }] }) },
    { name: 'Not valid: a formula names a parameter that does not exist', units: 'SI', fails: true,
      state: P({ task: 'eq', F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 90, at: 30 }, params: [{ name: 'P', v: 10, u: 'N' }], points: [pt('O', '0', '0', 'pin'), pt('A', 'cos θ', 'sin θ')], links: [{ pts: 'O A' }], forces: [{ at: 'A', Fx: '0', Fy: '-Q' }] }) },
  ];

  root.SVWork = M;
})(window);
