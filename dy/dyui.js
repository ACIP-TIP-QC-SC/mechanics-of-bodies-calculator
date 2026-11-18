/* =====================================================================
 * DYNAMICS · drawing helpers shared by the dy modules (browser only):
 * stacked motion graphs with a time cursor, energy bar charts, 2D parts
 * (ground, blocks, springs, dampers, pulleys, wheels) and 3D parts
 * (arrows, spheres, blocks), and the motion animation.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  /* Colours used across the Dynamics tab: velocity green, acceleration magenta, force red, path blue. Arrows and axes black. */
  const K = { pos: '#2f7fc1', vel: '#1e8449', acc: '#b03a8c', force: COL.load, react: COL.react, path: '#2f7fc1', ink: '#111111', body: '#b9c2cb', edge: '#4a5661', ghost: '#9aa5ad', ic: '#d4612a', energy: ['#2f7fc1', '#e67e22', '#8e44ad', '#16a085', '#c0392b'] };

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */
  /**
   * Graphs stacked one above the other with a common horizontal axis.
   * panels: [{ label, color, pts: [[x, y]], marks: [{x, y, label}], fill }]; o: { xlabel, cursor (x), cursorLabel, xmin, xmax }
   */
  function stack(svg, panels, o) {
    o = o || {};
    const { W, H } = Charts.clear(svg);
    const n = panels.length, top = 10, gap = 14, bot = 34, left = 66, right = 18;
    const ph = (H - top - bot - gap * (n - 1)) / n;
    let xmin = o.xmin, xmax = o.xmax;
    if (!(isFinite(xmin) && isFinite(xmax))) { xmin = Infinity; xmax = -Infinity; panels.forEach((p) => p.pts.forEach(([x]) => { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); })); }
    if (!(xmax > xmin)) return false;
    panels.forEach((p, i) => {
      let ymin = 0, ymax = 0;
      [p].concat(p.more || []).forEach((q) => q.pts.forEach(([, y]) => { if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } }));
      const F = Charts.frame(svg, { x: left, y: top + i * (ph + gap), w: W - left - right, h: ph, xmin, xmax, ymin, ymax, xlabel: i === n - 1 ? o.xlabel : null, ylabel: p.label, ycolor: p.color, xticks: i === n - 1 ? undefined : false });
      Charts.curve(F, p.pts, { color: p.color, width: 2.4, fill: p.fill === false || p.more ? null : p.color, fop: 0.1 });
      (p.more || []).forEach((q) => Charts.curve(F, q.pts, { color: q.color, width: 2.4, dash: q.dash }));
      (p.marks || []).forEach((m) => Charts.mark(F, m.x, m.y, m.label, Object.assign({ color: p.color }, m)));
      if (isFinite(o.cursor)) {
        const x = F.X(Math.min(xmax, Math.max(xmin, o.cursor)));
        s('line', { x1: x, y1: top + i * (ph + gap), x2: x, y2: top + i * (ph + gap) + ph, stroke: K.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, F.g);
        [[p.at, p.color]].concat((p.more || []).map((q) => [q.at, q.color])).forEach(([at, col]) => { if (!at) return; const yv = at(o.cursor); if (isFinite(yv)) { s('circle', { cx: x, cy: F.Y(yv), r: 4.5, fill: col, stroke: '#fff', 'stroke-width': 1.5 }, F.g); Charts.text(F.g, x + (x > W * 0.75 ? -8 : 8), F.Y(yv) - 7, fmt(yv), { anchor: x > W * 0.75 ? 'end' : 'start', color: col, size: 11.5, weight: 700 }); } });
      }
    });
    return true;
  }
  /** Bar chart of energies or impulses. bars: [{ name, v, color }]; o: { unit, title } */
  function bars(svg, list, o) {
    o = o || {};
    const { W, H } = Charts.clear(svg);
    if (!list.length) return false;
    let ymin = 0, ymax = 0; list.forEach((b) => { ymin = Math.min(ymin, b.v); ymax = Math.max(ymax, b.v); });
    if (!(ymax > ymin)) ymax = 1;
    const F = Charts.frame(svg, { x: 66, y: 22, w: W - 66 - 18, h: H - 22 - 46, xmin: 0, xmax: list.length, ymin, ymax, xticks: false, ylabel: o.title ? `${o.title} (${o.unit})` : o.unit });
    const bw = Math.min(70, ((W - 84) / list.length) * 0.6);
    list.forEach((b, i) => {
      const x = F.X(i + 0.5), y0 = F.Y(0), y1 = F.Y(b.v);
      s('rect', { x: x - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)), fill: b.color, 'fill-opacity': 0.85, stroke: b.color }, F.g);
      Charts.text(F.g, x, b.v >= 0 ? y1 - 5 : y1 + 14, fmt(b.v), { anchor: 'middle', color: K.ink, size: 11.5, weight: 700 });
      Charts.text(F.g, x, H - 26, b.name, { anchor: 'middle', color: '#1d2733', size: 11.5, weight: 600 });
      if (b.sub) Charts.text(F.g, x, H - 12, b.sub, { anchor: 'middle', color: '#5a6b75', size: 10.5, weight: 400 });
    });
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* 2D parts (D = UI.Draw2D context, world units)                      */
  /* ------------------------------------------------------------------ */
  const rot = (p, c, a) => { const ca = Math.cos(a), sa = Math.sin(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca]; };
  /** Hatched ground strip along the segment a → b, hatch on the right of a → b (below for a left-to-right floor). */
  function ground(D, a, b, th) {
    th = th || 0.25;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
    D.poly([a, b, [b[0] + nx * th, b[1] + ny * th], [a[0] + nx * th, a[1] + ny * th]], { fill: 'url(#hatch)', stroke: 'none' });
    D.line(a, b, { stroke: K.ink, sw: 1.8 });
  }
  /** Rectangle of width w and height h whose bottom centre is at p, turned by angle a (rad). Returns its corners. */
  function block(D, p, w, h, a, o) {
    o = o || {};
    const c = [p[0], p[1]];
    const pts = [[p[0] - w / 2, p[1]], [p[0] + w / 2, p[1]], [p[0] + w / 2, p[1] + h], [p[0] - w / 2, p[1] + h]].map((q) => rot(q, c, a || 0));
    D.poly(pts, { fill: o.fill || K.body, stroke: o.stroke || K.edge, sw: o.sw || 1.6, op: o.op, dash: o.dash });
    if (o.label) { const m = rot([p[0], p[1] + h / 2], c, a || 0); D.text(m, o.label, { anchor: 'middle', base: 'middle', color: o.lcolor || K.ink, size: o.size || 13, weight: 700 }); }
    return pts;
  }
  /** Zig-zag spring from a to b. */
  function spring(D, a, b, o) {
    o = o || {};
    const n = o.n || 8, w = o.w || 0.12, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const lead = Math.min(L * 0.15, o.lead || L * 0.15), pts = [a, [a[0] + ux * lead, a[1] + uy * lead]];
    for (let i = 0; i < n; i++) { const t = lead + ((L - 2 * lead) * (i + 0.5)) / n, sg = i % 2 ? -1 : 1; pts.push([a[0] + ux * t + px * w * sg, a[1] + uy * t + py * w * sg]); }
    pts.push([b[0] - ux * lead, b[1] - uy * lead], b);
    D.pline(pts, { stroke: o.color || '#2c3e50', sw: o.sw || 2 });
  }
  /** Dashpot from a to b. */
  function damper(D, a, b, o) {
    o = o || {};
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux, w = o.w || 0.14;
    const m1 = [a[0] + ux * L * 0.35, a[1] + uy * L * 0.35], m2 = [a[0] + ux * L * 0.55, a[1] + uy * L * 0.55], c1 = [a[0] + ux * L * 0.75, a[1] + uy * L * 0.75];
    D.line(a, m1, { stroke: o.color || '#2c3e50', sw: 2 });
    D.pline([[m1[0] + px * w, m1[1] + py * w], [c1[0] + px * w, c1[1] + py * w]], { stroke: o.color || '#2c3e50', sw: 2 });
    D.pline([[m1[0] - px * w, m1[1] - py * w], [c1[0] - px * w, c1[1] - py * w]], { stroke: o.color || '#2c3e50', sw: 2 });
    D.line([m1[0] + px * w, m1[1] + py * w], [m1[0] - px * w, m1[1] - py * w], { stroke: o.color || '#2c3e50', sw: 2 });
    D.line([m2[0] + px * w * 0.8, m2[1] + py * w * 0.8], [m2[0] - px * w * 0.8, m2[1] - py * w * 0.8], { stroke: o.color || '#2c3e50', sw: 3 });
    D.line(m2, b, { stroke: o.color || '#2c3e50', sw: 2 });
  }
  /** Wheel or disk of radius r at c with a spoke line turned by angle th (rad). */
  function wheel(D, c, r, th, o) {
    o = o || {};
    D.circle(c, r, { fill: o.fill || '#d5dbe1', stroke: o.stroke || K.edge, sw: o.sw || 1.8, op: o.op });
    if (o.ri) D.circle(c, o.ri, { fill: o.fill2 || '#c3cbd3', stroke: K.edge, sw: 1.2 });
    const n = o.spokes === undefined ? 1 : o.spokes;
    for (let i = 0; i < n; i++) { const a = (th || 0) + (i * Math.PI * 2) / Math.max(1, n); D.line(c, [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], { stroke: o.spoke || K.ink, sw: 1.6 }); }
    D.circle(c, Math.max(r * 0.06, 0.02), { fill: K.ink });
  }
  /** Pin support drawn under the point p. */
  function pin(D, p, size) {
    const z = size || 0.3;
    D.poly([p, [p[0] - z * 0.6, p[1] - z], [p[0] + z * 0.6, p[1] - z]], { fill: '#fff', stroke: K.edge, sw: 1.5 });
    D.line([p[0] - z, p[1] - z], [p[0] + z, p[1] - z], { stroke: COL.support, sw: 2 });
    D.circle(p, z * 0.14, { fill: '#fff', stroke: K.edge, sw: 1.4 });
  }
  /** Arrow of screen length px from world point p along world direction d (or ending at p when o.head). */
  function vec(D, p, d, px, o) {
    o = o || {};
    const l = Math.hypot(d[0], d[1]);
    if (!(l > 1e-12) || !(px > 2)) return null;
    const ux = d[0] / l, uy = d[1] / l, q = [p[0] + (ux * px) / D.sc, p[1] + (uy * px) / D.sc];
    return o.head === true ? D.arrow([p[0] - (ux * px) / D.sc, p[1] - (uy * px) / D.sc], p, Object.assign({ w: 2.6 }, o, { head: o.hs || 11 })) : D.arrow(p, q, Object.assign({ w: 2.6, head: 11, lp: 'head' }, o));
  }
  /** Small x–y axes at a corner of the diagram, in black. */
  function axes(D, p, len, names) {
    names = names || ['x', 'y'];
    D.arrow(p, [p[0] + len, p[1]], { color: K.ink, w: 1.4, head: 8 }); D.arrow(p, [p[0], p[1] + len], { color: K.ink, w: 1.4, head: 8 });
    D.text([p[0] + len, p[1]], names[0], { dx: 4, dy: 4, color: K.ink, size: 12 }); D.text([p[0], p[1] + len], names[1], { dx: 4, dy: -2, color: K.ink, size: 12 });
  }
  /** Panel title in screen pixels. */
  const title = (D, x, y, t, o) => D.text([x, y], t, Object.assign({ px: true, color: K.ink, size: 12.5, weight: 700 }, o || {}));

  /* ------------------------------------------------------------------ */
  /* 3D parts (v = View3D)                                              */
  /* ------------------------------------------------------------------ */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  /** 3D arrow from tail a to head b. */
  function arrow3(v, a, b, color, lw, hs) {
    const d = sub(b, a), L = Math.hypot(...d); if (!(L > 1e-9)) return;
    v.line([a, b], color, lw || 2.4);
    const u = mul(d, 1 / L), h = Math.min(L * 0.35, hs || L * 0.2), t = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = nrm(cross(u, t)), c2 = nrm(cross(u, c)), base = sub(b, mul(u, h));
    [c, c2].forEach((cc) => [1, -1].forEach((sg) => v.line([b, add(base, mul(cc, sg * h * 0.42))], color, lw || 2.4)));
  }
  /** Sphere of radius r at c. */
  function sphere(v, c, r, fill, o) {
    o = o || {};
    const prof = []; const n = o.n || 10;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; prof.push([r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    v.lathe(prof, fill, o.alpha || 1, null, o.seg || 20, c[0], c[2], { open: true });
  }
  /** Block of size w (along the slope), h (normal to it) and d (depth, z) resting on a slope of angle a (rad) with its
   *  bottom centre at p (x, y); returns its eight corners. */
  function block3(v, p, w, h, d, a, fill, o) {
    o = o || {};
    const ca = Math.cos(a), sa = Math.sin(a), P = (s1, n1, z) => [p[0] + s1 * ca - n1 * sa, p[1] + s1 * sa + n1 * ca, z];
    const c = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
    const front = c.map(([s1, n1]) => P(s1, n1, d / 2)), back = c.map(([s1, n1]) => P(s1, n1, -d / 2));
    const N = [[sa, -ca, 0], [ca, sa, 0], [-sa, ca, 0], [-ca, -sa, 0]];
    v.face(front, fill, 1, o.stroke || K.edge, 1, o.layer || 0, [0, 0, 1]);
    v.face(back.slice().reverse(), fill, 1, o.stroke || K.edge, 1, o.layer || 0, [0, 0, -1]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; v.face([front[i], front[j], back[j], back[i]], fill, 1, o.stroke || K.edge, 1, o.layer || 0, N[i]); }
    return { front, back };
  }
  /** Flat slab under everything (a floor) from x0 to x1 at height y, depth d. */
  function floor3(v, x0, x1, y, d, a) {
    a = a || 0;
    const ca = Math.cos(a), sa = Math.sin(a), P = (s1, n1, z) => [x0 + s1 * ca - n1 * sa, y + s1 * sa + n1 * ca, z], L = (x1 - x0) / (ca || 1);
    const t = 0.12 * Math.max(1, L / 10);
    const top = [P(0, 0, d), P(L, 0, d), P(L, 0, -d), P(0, 0, -d)], bot = [P(0, -t, d), P(L, -t, d), P(L, -t, -d), P(0, -t, -d)];
    const lay = root.View3D.restLayer([-sa, ca, 0]);
    v.face(top, '#d5dbe1', 1, '#7f8c8d', 1, lay, [-sa, ca, 0]);
    v.face(bot, '#c3cbd3', 1, '#7f8c8d', 1, lay, [sa, -ca, 0]);
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([i, j]) => v.face([top[i], top[j], bot[j], bot[i]], '#c3cbd3', 1, '#7f8c8d', 1, lay, null));
  }

  /* ------------------------------------------------------------------ */
  /* Motion animation                                                   */
  /* ------------------------------------------------------------------ */
  /**
   * Play runs the motion from start to end in a 10 s loop at 1× (speed 0.25× to 4×). It keeps the fraction of the
   * motion in state._u; Reset clears it, which shows the instant asked for in the inputs.
   * span() → [t0, t1] of the motion in seconds, for the clock.
   */
  const motion = (state, span, o) => ({
    duration: (o && o.duration) || 10, loop: true,
    frame(u) { const st = state(); if (u <= 0) delete st._u; else st._u = u; },
    label() { const st = state(), sp = span(); if (st._u === undefined) return (o && o.idle) || 'the instant asked for'; const t = sp[0] + (sp[1] - sp[0]) * st._u; return `t = ${fmt(t)} s of ${fmt(sp[1])} s`; },
  });

  root.DYUI = { K, stack, bars, rot, ground, block, spring, damper, wheel, pin, vec, axes, title, arrow3, sphere, block3, floor3, motion, sub, add, mul, cross, nrm };
})(window);
