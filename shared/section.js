/* =====================================================================
 * Section engine: properties of a composite area (physics only; browser + Node).
 * Hibbeler Statics 9.2 and 10.2 to 10.7; reused by the bending, shear and
 * column modules.
 *
 * A part is { kind, hole, x, y, rot, b, h, r, a }:
 *   rect     b × h, anchored at a corner, extends along +x and +y
 *   tri      right triangle, legs b (along +x) and h (along +y), anchored at the right angle
 *   circle   radius r, anchored at its centre
 *   semi     half circle of radius r, anchored at the middle of its diameter, bulging toward +y
 *   quarter  quarter circle of radius r, anchored at the circle centre, in the first quadrant
 *   sector   circular sector of radius r and half-angle a (degrees), anchored at the apex, symmetric about +x
 * (x, y) is the anchor; rot = 0, 90, 180 or 270 turns the part counterclockwise about the anchor.
 * hole = true subtracts the part.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Mohr = root.Mohr || require('./mohr.js');
  const PI = Math.PI, DEG = PI / 180;
  const KINDS = [['rect', 'Rectangle'], ['tri', 'Right triangle'], ['circle', 'Circle'], ['semi', 'Semicircle'], ['quarter', 'Quarter circle'], ['sector', 'Circular sector']];
  const NAME = Object.fromEntries(KINDS);

  /** Area, centroid (from the anchor) and centroidal Ix, Iy, Ixy of the unrotated part, with the formulas as text. */
  function local(p) {
    const b = +p.b, h = +p.h, r = +p.r;
    switch (p.kind) {
      case 'rect': return { A: b * h, cx: b / 2, cy: h / 2, Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12, Ixy: 0, fA: 'bh', fIx: 'bh³/12', fIy: 'hb³/12' };
      case 'tri': return { A: (b * h) / 2, cx: b / 3, cy: h / 3, Ix: (b * h ** 3) / 36, Iy: (h * b ** 3) / 36, Ixy: -(b * b * h * h) / 72, fA: 'bh/2', fIx: 'bh³/36', fIy: 'hb³/36' };
      case 'circle': return { A: PI * r * r, cx: 0, cy: 0, Ix: (PI * r ** 4) / 4, Iy: (PI * r ** 4) / 4, Ixy: 0, fA: 'πr²', fIx: 'πr⁴/4', fIy: 'πr⁴/4' };
      case 'semi': return { A: (PI * r * r) / 2, cx: 0, cy: (4 * r) / (3 * PI), Ix: (PI / 8 - 8 / (9 * PI)) * r ** 4, Iy: (PI * r ** 4) / 8, Ixy: 0, fA: 'πr²/2', fIx: '0.1098r⁴', fIy: 'πr⁴/8' };
      case 'quarter': { const c = (4 * r) / (3 * PI), I = (PI / 16 - 4 / (9 * PI)) * r ** 4; return { A: (PI * r * r) / 4, cx: c, cy: c, Ix: I, Iy: I, Ixy: (1 / 8 - 4 / (9 * PI)) * r ** 4, fA: 'πr²/4', fIx: '0.05488r⁴', fIy: '0.05488r⁴' }; }
      case 'sector': {
        const a = +p.a * DEG, A = a * r * r, cx = (2 * r * Math.sin(a)) / (3 * a);
        return { A, cx, cy: 0, Ix: (r ** 4 / 4) * (a - Math.sin(2 * a) / 2), Iy: (r ** 4 / 4) * (a + Math.sin(2 * a) / 2) - A * cx * cx, Ixy: 0, fA: 'αr²', fIx: 'r⁴(α − ½ sin 2α)/4', fIy: 'r⁴(α + ½ sin 2α)/4 − A x̄²' };
      }
      default: return null;
    }
  }
  const rotK = (p) => (((Math.round((+p.rot || 0) / 90) % 4) + 4) % 4);
  const turn = (k, x, y) => (k === 0 ? [x, y] : k === 1 ? [-y, x] : k === 2 ? [-x, -y] : [y, -x]);

  /** Signed area properties of one placed part: A, centroid (x, y) and centroidal Ix, Iy, Ixy. */
  function partProps(p) {
    const L = local(p); if (!L) return null;
    const k = rotK(p), sg = p.hole ? -1 : 1, c = turn(k, L.cx, L.cy), odd = k % 2 === 1;
    return {
      kind: p.kind, name: NAME[p.kind], sign: sg, A: sg * L.A, x: +p.x + c[0], y: +p.y + c[1],
      Ix: sg * (odd ? L.Iy : L.Ix), Iy: sg * (odd ? L.Ix : L.Iy), Ixy: sg * (odd ? -L.Ixy : L.Ixy),
      fA: L.fA, fIx: odd ? L.fIy : L.fIx, fIy: odd ? L.fIx : L.fIy,
    };
  }
  /** Outline polygon of a placed part (counterclockwise), arcs split into n pieces. */
  function outline(p, n) {
    n = n || 48;
    const b = +p.b, h = +p.h, r = +p.r, pts = [];
    const arc = (a0, a1, m) => { for (let i = 0; i <= m; i++) { const t = a0 + ((a1 - a0) * i) / m; pts.push([r * Math.cos(t), r * Math.sin(t)]); } };
    if (p.kind === 'rect') pts.push([0, 0], [b, 0], [b, h], [0, h]);
    else if (p.kind === 'tri') pts.push([0, 0], [b, 0], [0, h]);
    else if (p.kind === 'circle') arc(0, 2 * PI * (1 - 1 / (2 * n)), 2 * n - 1);
    else if (p.kind === 'semi') arc(0, PI, n);
    else if (p.kind === 'quarter') { pts.push([0, 0]); arc(0, PI / 2, Math.ceil(n / 2)); }
    else if (p.kind === 'sector') { pts.push([0, 0]); arc(-p.a * DEG, p.a * DEG, n); }
    const k = rotK(p);
    return pts.map(([x, y]) => { const q = turn(k, x, y); return [+p.x + q[0], +p.y + q[1]]; });
  }
  /** Area, first and second moments of a polygon about the origin axes (Green's theorem). */
  function polyProps(pts) {
    let A = 0, Sx = 0, Sy = 0, Ix = 0, Iy = 0, Ixy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], c = x0 * y1 - x1 * y0;
      A += c / 2; Sy += ((x0 + x1) * c) / 6; Sx += ((y0 + y1) * c) / 6;
      Ix += ((y0 * y0 + y0 * y1 + y1 * y1) * c) / 12; Iy += ((x0 * x0 + x0 * x1 + x1 * x1) * c) / 12;
      Ixy += ((x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c) / 24;
    }
    return { A, Sx, Sy, Ix, Iy, Ixy };
  }

  function validate(parts) {
    const err = [];
    if (!parts || !parts.length) err.push('Add at least one part.');
    (parts || []).forEach((p, i) => {
      const n = `Part ${i + 1} (${NAME[p.kind] || p.kind})`;
      const pos = (v, what) => { if (!(+v > 0) || !isFinite(+v)) err.push(`${n}: ${what} must be greater than zero.`); };
      if (!NAME[p.kind]) { err.push(`${n}: unknown kind.`); return; }
      if (p.kind === 'rect' || p.kind === 'tri') { pos(p.b, 'width b'); pos(p.h, 'height h'); } else pos(p.r, 'radius r');
      if (p.kind === 'sector' && !(+p.a > 0 && +p.a <= 180)) err.push(`${n}: the half-angle must be between 0° and 180°.`);
      if (!isFinite(+p.x) || !isFinite(+p.y)) err.push(`${n}: enter its position.`);
    });
    return err;
  }

  /**
   * Properties of the composite area.
   * Returns { ok, err, rows (per part), A, x, y (centroid), I0 {x,y,xy} about the given axes,
   *           Ic {x,y,xy} about the centroidal axes, kx, ky, J, mohr, box, c, S, outlines, Q(y), t(y) }.
   */
  function solve(parts) {
    const err = validate(parts);
    if (err.length) return { ok: false, err };
    const rows = parts.map(partProps);
    const A = rows.reduce((s, r) => s + r.A, 0);
    if (!(A > 1e-12 * Math.max(...rows.map((r) => Math.abs(r.A))))) return { ok: false, err: ['The holes remove all of the area. The net area must be greater than zero.'] };
    const x = rows.reduce((s, r) => s + r.x * r.A, 0) / A, y = rows.reduce((s, r) => s + r.y * r.A, 0) / A;
    const I0 = { x: 0, y: 0, xy: 0 }, Ic = { x: 0, y: 0, xy: 0 };
    rows.forEach((r) => {
      r.xA = r.x * r.A; r.yA = r.y * r.A; r.dx = r.x - x; r.dy = r.y - y;
      r.Ix0 = r.Ix + r.A * r.y * r.y; r.Iy0 = r.Iy + r.A * r.x * r.x; r.Ixy0 = r.Ixy + r.A * r.x * r.y;
      r.Ixc = r.Ix + r.A * r.dy * r.dy; r.Iyc = r.Iy + r.A * r.dx * r.dx; r.Ixyc = r.Ixy + r.A * r.dx * r.dy;
      I0.x += r.Ix0; I0.y += r.Iy0; I0.xy += r.Ixy0; Ic.x += r.Ixc; Ic.y += r.Iyc; Ic.xy += r.Ixyc;
    });
    const sc = Math.max(Math.abs(Ic.x), Math.abs(Ic.y));
    if (Math.abs(Ic.xy) < 1e-6 * sc) Ic.xy = 0; // round-off from symmetric shapes
    if (Math.abs(I0.xy) < 1e-6 * Math.max(Math.abs(I0.x), Math.abs(I0.y))) I0.xy = 0;
    const outlines = parts.map((p, i) => ({ pts: outline(p), sign: rows[i].sign }));
    const box = { xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity };
    outlines.forEach((o) => { if (o.sign > 0) o.pts.forEach(([px, py]) => { box.xmin = Math.min(box.xmin, px); box.xmax = Math.max(box.xmax, px); box.ymin = Math.min(box.ymin, py); box.ymax = Math.max(box.ymax, py); }); });
    if (!isFinite(box.xmin)) return { ok: false, err: ['Add at least one part that is not a hole.'] };
    const c = { top: box.ymax - y, bottom: y - box.ymin, left: x - box.xmin, right: box.xmax - x };
    const S = { top: Ic.x / c.top, bottom: Ic.x / c.bottom, left: Ic.y / c.left, right: Ic.y / c.right };

    /* first moment about the centroidal x axis of the area above the level y0, and the width there */
    function clipAbove(pts, y0) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[1] >= y0, ib = b[1] >= y0;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (y0 - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), y0]); }
      }
      return out;
    }
    const Q = (y0) => outlines.reduce((s, o) => { const q = clipAbove(o.pts, y0); if (q.length < 3) return s; const pp = polyProps(q); return s + o.sign * (pp.Sx - y * pp.A) * Math.sign(polyProps(o.pts).A || 1); }, 0);
    const t = (y0) => outlines.reduce((s, o) => {
      const xs = [];
      for (let i = 0; i < o.pts.length; i++) { const a = o.pts[i], b = o.pts[(i + 1) % o.pts.length]; if ((a[1] > y0) !== (b[1] > y0)) xs.push(a[0] + ((y0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q); let w = 0; for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
      return s + o.sign * w;
    }, 0);

    return {
      ok: true, err: [], rows, A, x, y, I0, Ic, kx: Math.sqrt(Ic.x / A), ky: Math.sqrt(Ic.y / A), J: Ic.x + Ic.y,
      mohr: Mohr.inertia(Ic.x, Ic.y, Ic.xy), box, c, S, outlines, Q, t,
    };
  }

  /* Standard shapes as lists of parts. The origin is the lower-left corner of the bounding box. */
  const TEMPLATES = [['I', 'I or wide-flange'], ['T', 'T section'], ['C', 'Channel'], ['L', 'Angle'], ['box', 'Box (hollow rectangle)'], ['pipe', 'Pipe']];
  const TDIMS = {
    I: [['bf', 'Flange width b_f'], ['d', 'Depth d'], ['tf', 'Flange thickness t_f'], ['tw', 'Web thickness t_w']],
    T: [['bf', 'Flange width b_f'], ['d', 'Depth d'], ['tf', 'Flange thickness t_f'], ['tw', 'Stem thickness t_w']],
    C: [['bf', 'Flange width b_f'], ['d', 'Depth d'], ['tf', 'Flange thickness t_f'], ['tw', 'Web thickness t_w']],
    L: [['bf', 'Horizontal leg b'], ['d', 'Vertical leg d'], ['tf', 'Thickness t']],
    box: [['bf', 'Width b'], ['d', 'Depth d'], ['tf', 'Wall thickness t']],
    pipe: [['d', 'Outside diameter D'], ['tf', 'Wall thickness t']],
  };
  function template(shape, D) {
    const bf = +D.bf, d = +D.d, tf = +D.tf, tw = +D.tw, err = [];
    const R = (x, y, b, h, hole) => ({ kind: 'rect', x, y, b, h, rot: 0, hole: !!hole });
    const need = (ok, msg) => { if (!ok) err.push(msg); };
    TDIMS[shape].forEach(([k, label]) => need(+D[k] > 0 && isFinite(+D[k]), `${label.replace(/_/g, '')} must be greater than zero.`));
    let parts = [];
    if (!err.length) {
      if (shape === 'I') { need(2 * tf < d, 'The two flanges are thicker than the depth.'); need(tw <= bf, 'The web is thicker than the flange is wide.'); parts = [R(0, 0, bf, tf), R((bf - tw) / 2, tf, tw, d - 2 * tf), R(0, d - tf, bf, tf)]; }
      else if (shape === 'T') { need(tf < d, 'The flange is thicker than the depth.'); need(tw <= bf, 'The stem is thicker than the flange is wide.'); parts = [R((bf - tw) / 2, 0, tw, d - tf), R(0, d - tf, bf, tf)]; }
      else if (shape === 'C') { need(2 * tf < d, 'The two flanges are thicker than the depth.'); need(tw < bf, 'The web is thicker than the flange is wide.'); parts = [R(0, 0, tw, d), R(tw, 0, bf - tw, tf), R(tw, d - tf, bf - tw, tf)]; }
      else if (shape === 'L') { need(tf < d && tf < bf, 'The thickness must be less than both legs.'); parts = [R(0, 0, bf, tf), R(0, tf, tf, d - tf)]; }
      else if (shape === 'box') { need(2 * tf < d && 2 * tf < bf, 'The walls are too thick for this box.'); parts = [R(0, 0, bf, d), R(tf, tf, bf - 2 * tf, d - 2 * tf, true)]; }
      else if (shape === 'pipe') { need(2 * tf < d, 'The wall is thicker than the radius.'); parts = [{ kind: 'circle', x: d / 2, y: d / 2, r: d / 2, rot: 0, hole: false }, { kind: 'circle', x: d / 2, y: d / 2, r: d / 2 - tf, rot: 0, hole: true }]; }
    }
    return { parts: err.length ? [] : parts, err };
  }

  const Section = { KINDS, NAME, TEMPLATES, TDIMS, local, partProps, outline, polyProps, validate, solve, template };
  root.Section = Section;
  if (typeof module !== 'undefined' && module.exports) module.exports = Section;
})(typeof window !== 'undefined' ? window : globalThis);
