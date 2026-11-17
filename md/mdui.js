/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · drawing helpers shared by the md modules
 * (browser only): 3D cylinders and arrows, material picker, and the
 * exaggeration used for deformed shapes.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, MD } = root;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /** Two unit vectors perpendicular to the axis direction d. */
  function frame(d) {
    const u = nrm(d), t = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = nrm(cross(u, t)), e2 = cross(u, e1);
    return { u, e1, e2 };
  }
  /**
   * Solid (or hollow, with o.ri) circular cylinder from a to b of radius r.
   * o: { n (sides), nz (pieces along the axis), color(i, j) → fill for a strip, twist(t) → extra angle along the axis,
   *      rOf(t) → radius along the axis, stroke (outline of the end caps), caps (default true) }
   * Lines are drawn after every face, so markings on the surface are made with color(i, j), never with lines.
   */
  function cyl(v, a, b, r, fill, o) {
    o = o || {};
    const n = o.n || 28, nz = o.nz || 1, f = frame(sub(b, a)), L = Math.hypot(...sub(b, a));
    const tw = o.twist || (() => 0), rOf = o.rOf || (() => r);
    const P = (t, th, rr) => { const c = add(a, mul(f.u, t * L)), ang = th + tw(t); return add(c, add(mul(f.e1, rr * Math.cos(ang)), mul(f.e2, rr * Math.sin(ang)))); };
    for (let j = 0; j < nz; j++) {
      const t0 = j / nz, t1 = (j + 1) / nz;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, am = (a0 + a1) / 2 + tw((t0 + t1) / 2);
        const out = add(mul(f.e1, Math.cos(am)), mul(f.e2, Math.sin(am)));
        v.face([P(t0, a0, rOf(t0)), P(t0, a1, rOf(t0)), P(t1, a1, rOf(t1)), P(t1, a0, rOf(t1))], o.color ? o.color(j, i) : fill, o.alpha || 1, null, 1, o.layer || 0, (o.alpha || 1) >= 0.99 ? out : null);
        if (o.ri) v.face([P(t0, a0, o.ri), P(t0, a1, o.ri), P(t1, a1, o.ri), P(t1, a0, o.ri)], o.inner || '#9aa5ad', 1, null, 1, o.layer || 0, mul(out, -1));
      }
    }
    if (o.caps !== false) {
      [[0, mul(f.u, -1)], [1, f.u]].forEach(([t, nn]) => {
        const rr = rOf(t);
        if (o.ri) {
          for (let i = 0; i < n; i++) { const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI; v.face([P(t, a0, rr), P(t, a1, rr), P(t, a1, o.ri), P(t, a0, o.ri)], o.capFill || fill, 1, null, 1, o.layer || 0, nn); }
        } else {
          const ring = []; for (let i = 0; i < n; i++) ring.push(P(t, (i / n) * 2 * Math.PI, rr));
          v.face(ring, o.capFill || fill, o.alpha || 1, o.stroke || null, 1, o.layer || 0, (o.alpha || 1) >= 0.99 ? nn : null);
        }
      });
    }
  }
  /** 3D arrow from tail a to head b. */
  function arrow3(v, a, b, color, lw, hs) {
    const d = sub(b, a), L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = mul(d, 1 / L), h = Math.min(L * 0.35, hs || v._hs || L * 0.15), t = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = nrm(cross(u, t)), base = sub(b, mul(u, h));
    [1, -1].forEach((sg) => v.line([b, add(base, mul(c, sg * h * 0.42))], color, lw || 2.4));
    const c2 = nrm(cross(u, c));
    [1, -1].forEach((sg) => v.line([b, add(base, mul(c2, sg * h * 0.42))], color, lw || 2.4));
  }
  /** Material picker: a list of the endpaper materials plus "your own values"; picking one fills E, ν, σY, G, α. */
  function material(C, sec, o, sys, fields) {
    fields = fields || { E: 'E', nu: 'nu', sY: 'sY' };
    C.select(sec, {
      label: 'Material', get: () => o.mat || 'custom',
      set: (id) => {
        o.mat = id; const m = MD.material(id, sys); if (!m) return;
        Object.keys(fields).forEach((k) => { if (m[k] !== null && m[k] !== undefined) o[fields[k]] = m[k]; });
      },
      options: [['custom', 'Your own values']].concat(MD.MATERIALS.map((m) => [m.id, m.name])),
    });
  }
  /** Mark the material as edited when a value no longer matches the table. */
  const edited = (o) => () => (o.mat = 'custom');
  /** Scale that makes a small deformation visible: the largest movement drawn as `frac` of the size. */
  const exag = (size, maxMove, frac) => (maxMove > 0 ? ((frac || 0.08) * size) / maxMove : 0);

  /** Layer for parts stacked one on another along y: seen from above, a higher h is painted later; from below, earlier. */
  const upLayer = (h) => (facing) => (facing([0, 1, 0]) > 0 ? h : -h);
  root.MDUI = { upLayer, cyl, arrow3, material, edited, exag, frame, sub, add, mul, nrm, cross };
})(window);
