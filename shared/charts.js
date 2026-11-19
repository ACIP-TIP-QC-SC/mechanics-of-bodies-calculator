/* =====================================================================
 * Charts: SVG line charts and filled diagrams (shear, moment, tension,
 * motion graphs, …). Always drawn in the light palette so they print
 * the same in light and dark mode.
 * Mohr's circle (inertia, stress, strain) is drawn by Charts.mohr.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { svgEl: s, fmt } = root.UI;

  /** "Nice" tick values covering [min, max] with about n steps. */
  function niceTicks(min, max, n) {
    n = n || 5;
    if (!(max > min)) { const d = Math.abs(min) || 1; min -= d / 2; max += d / 2; }
    const raw = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    const t = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { ticks: t, step };
  }

  function clear(svg) {
    const W = svg.clientWidth || 800, H = svg.clientHeight || 320;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    return { W, H };
  }
  function text(parent, x, y, str, o) {
    o = o || {};
    const svg = parent && (parent.ownerSVGElement || (parent.tagName === 'svg' ? parent : null)), vb = svg && svg.viewBox && svg.viewBox.baseVal;
    let box = null, hide = false;
    if (!o.rot && vb && vb.width && root.UI && root.UI.fitText) {
      // value labels move clear of labels already drawn; axis ticks (weight 400) stay put
      [x, y] = root.UI.fitText(x, y, str, o.size || 11.5, o.anchor, vb.width, vb.height);
      if (o.avoid !== false) [x, y, box, hide] = root.UI.placeText(svg, x, y, str, o.size || 11.5, o.anchor, null, vb.width, vb.height, o.weight === 400, o.lim);
    }
    const t = s('text', { x, y, 'text-anchor': o.anchor || 'start', class: 'lbl', fill: o.color || '#1d2733', 'font-size': o.size || 11.5, 'font-weight': o.weight || 600, transform: o.rot ? `rotate(${o.rot} ${x} ${y})` : undefined }, parent);
    t.textContent = str;
    t._box = box;
    if (hide) t.setAttribute('opacity', '0');
    return t;
  }

  /**
   * One framed plotting area inside an SVG.
   * o = { x, y, w, h (px box), xmin, xmax, ymin, ymax, xlabel, ylabel, xticks: false to hide, grid }
   * Returns { X, Y, g } to draw into.
   */
  function frame(svg, o) {
    const g = s('g', {}, svg);
    let { ymin, ymax } = o;
    if (!(ymax > ymin)) { const d = Math.abs(ymin) || 1; ymin -= d; ymax += d; }
    const padY = (ymax - ymin) * (o.padY === undefined ? 0.14 : o.padY);
    const y0 = ymin - (ymin < 0 || o.padBottom ? padY : 0), y1 = ymax + (ymax > 0 || o.padTop ? padY : 0);
    const X = (x) => o.x + ((x - o.xmin) / (o.xmax - o.xmin || 1)) * o.w;
    const Y = (y) => o.y + o.h - ((y - y0) / (y1 - y0 || 1)) * o.h;
    s('rect', { x: o.x, y: o.y, width: o.w, height: o.h, fill: '#ffffff', stroke: '#d3dce0', 'stroke-width': 1 }, g);
    const yt = niceTicks(y0, y1, Math.max(2, Math.round(o.h / 42)));
    yt.ticks.forEach((v) => {
      if (v < y0 - 1e-12 || v > y1 + 1e-12) return;
      s('line', { x1: o.x, y1: Y(v), x2: o.x + o.w, y2: Y(v), stroke: v === 0 ? '#5a6b75' : '#e6ecef', 'stroke-width': v === 0 ? 1.2 : 1 }, g);
      text(g, o.x - 6, Y(v) + 4, fmt(v), { anchor: 'end', color: '#5a6b75', size: 10.5, weight: 400 });
    });
    if (o.xticks !== false) {
      const xt = o.xticks || niceTicks(o.xmin, o.xmax, Math.max(3, Math.round(o.w / 90))).ticks;
      xt.forEach((v) => {
        if (v < o.xmin - 1e-9 || v > o.xmax + 1e-9) return;
        s('line', { x1: X(v), y1: o.y + o.h, x2: X(v), y2: o.y + o.h + 4, stroke: '#5a6b75', 'stroke-width': 1 }, g);
        text(g, X(v), o.y + o.h + 16, fmt(v), { anchor: 'middle', color: '#5a6b75', size: 10.5, weight: 400 });
      });
    }
    if (o.xlabel) text(g, o.x + o.w, o.y + o.h + 30, o.xlabel, { anchor: 'end', color: '#5a6b75', size: 11 });
    if (o.ylabel && o.yside) text(g, o.x - o.yside, o.y + o.h / 2, o.ylabel, { color: o.ycolor || '#1d2733', size: 12, weight: 700, anchor: 'middle', rot: -90 });
    else if (o.ylabel) text(g, o.x + 6, o.y + 14, o.ylabel, { color: o.ycolor || '#1d2733', size: 12, weight: 700 });
    return { X, Y, g, y0, y1, lim: [o.y, o.y + o.h] };
  }

  /** Curve through points, optionally filled down to y = 0. */
  function curve(F, pts, o) {
    o = o || {};
    if (!pts.length) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${F.X(p[0]).toFixed(2)},${F.Y(p[1]).toFixed(2)}`).join(' ');
    if (o.fill) {
      const a = pts[0], b = pts[pts.length - 1];
      s('path', { d: `${d} L${F.X(b[0]).toFixed(2)},${F.Y(0).toFixed(2)} L${F.X(a[0]).toFixed(2)},${F.Y(0).toFixed(2)} Z`, fill: o.fill, 'fill-opacity': o.fop === undefined ? 0.28 : o.fop, stroke: 'none' }, F.g);
    }
    s('path', { d, fill: 'none', stroke: o.color || '#333', 'stroke-width': o.width || 2, 'stroke-dasharray': o.dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, F.g);
  }
  function mark(F, x, y, label, o) {
    o = o || {};
    s('circle', { cx: F.X(x), cy: F.Y(y), r: o.r || 4, fill: o.color || '#d4612a', stroke: '#fff', 'stroke-width': 1.5 }, F.g);
    if (label) text(F.g, F.X(x) + (o.dx === undefined ? 7 : o.dx), F.Y(y) + (o.dy === undefined ? -6 : o.dy), label, { color: o.color || '#d4612a', anchor: o.anchor, size: o.size || 11.5, weight: 700, lim: F.lim });
  }

  /**
   * A complete single chart filling the SVG.
   * o = { xlabel, ylabel, series: [{ name, color, pts, fill, dash, width }], marks: [{ x, y, label, color }] }
   */
  function plot(svg, o) {
    const { W, H } = clear(svg);
    let xmin = Infinity, xmax = -Infinity, ymin = 0, ymax = 0, any = false;
    o.series.forEach((sr) => sr.pts.forEach(([x, y]) => { if (!isFinite(x) || !isFinite(y)) return; any = true; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }));
    if (!any) return false;
    const F = frame(svg, { x: 62, y: 14, w: W - 62 - 22, h: H - 14 - 40, xmin, xmax, ymin, ymax, xlabel: o.xlabel, ylabel: o.ylabel });
    o.series.forEach((sr) => curve(F, sr.pts, sr));
    (o.marks || []).forEach((m) => mark(F, m.x, m.y, m.label, m));
    let lx = 62 + 150;
    o.series.forEach((sr) => {
      if (!sr.name) return;
      s('line', { x1: lx, y1: 24, x2: lx + 18, y2: 24, stroke: sr.color, 'stroke-width': 3, 'stroke-dasharray': sr.dash }, svg);
      const t = text(svg, lx + 23, 28, sr.name, { size: 11, color: '#5a6b75' });
      lx += 40 + (t.getComputedTextLength ? t.getComputedTextLength() : sr.name.length * 6);
    });
    return true;
  }


  /**
   * Mohr's circle, drawn to the same scale on both axes.
   * o = { avg, R, xl, yl (axis names), yDown (true when the vertical axis is positive downward, as for stress),
   *       pts: [{ x, y, label, color, spoke, anchor, dy }], arc: { from: [x,y], to: [x,y], label, color }, zero: include the origin }
   * Sets svg._inv so a pointer position can be read back in circle coordinates.
   */
  function mohr(svg, o) {
    const { W, H } = clear(svg);
    const pl = 20, pr = 46, pt = 26, pb = 34;
    const R = o.R > 0 ? o.R : Math.abs(o.avg) * 0.1 || 1;
    let x0 = o.avg - R, x1 = o.avg + R;
    if (o.zero !== false) { x0 = Math.min(x0, 0); x1 = Math.max(x1, 0); }
    const mx = (x1 - x0) * 0.1 + R * 0.25; x0 -= mx; x1 += mx;
    const yr = R * 1.32, sc = Math.min((W - pl - pr) / (x1 - x0), (H - pt - pb) / (2 * yr));
    const xm = (x0 + x1) / 2, cx = pl + (W - pl - pr) / 2, cy = pt + (H - pt - pb) / 2, ys = o.yDown ? 1 : -1;
    const X = (x) => cx + (x - xm) * sc, Y = (y) => cy + ys * y * sc;
    svg._inv = (sx, sy) => [xm + (sx - cx) / sc, (ys * (sy - cy)) / sc];
    const g = s('g', {}, svg);
    const xa = X(x0), xb = X(x1), yv0 = Y(-yr * ys), yv1 = Y(yr * ys);
    // axes
    s('line', { x1: xa, y1: Y(0), x2: xb + 14, y2: Y(0), stroke: '#111111', 'stroke-width': 1.3 }, g);
    s('polygon', { points: `${xb + 22},${Y(0)} ${xb + 12},${Y(0) - 4} ${xb + 12},${Y(0) + 4}`, fill: '#111111' }, g);
    const xv = x0 <= 0 && x1 >= 0 ? X(0) : xa;
    s('line', { x1: xv, y1: Math.min(yv0, yv1) - 6, x2: xv, y2: Math.max(yv0, yv1), stroke: '#111111', 'stroke-width': 1.3 }, g);
    const tipY = o.yDown ? Math.max(yv0, yv1) + 4 : Math.min(yv0, yv1) - 10;
    s('polygon', { points: o.yDown ? `${xv},${tipY + 8} ${xv - 4},${tipY - 2} ${xv + 4},${tipY - 2}` : `${xv},${tipY - 4} ${xv - 4},${tipY + 6} ${xv + 4},${tipY + 6}`, fill: '#111111' }, g);
    text(g, xv + 8, o.yDown ? tipY + 6 : tipY + 6, o.yl || '', { color: '#1d2733', size: 12.5, weight: 700 });
    niceTicks(x0, x1, Math.max(3, Math.round((xb - xa) / 90))).ticks.forEach((v) => {
      s('line', { x1: X(v), y1: Y(0) - 3, x2: X(v), y2: Y(0) + 3, stroke: '#5a6b75', 'stroke-width': 1 }, g);
      text(g, X(v), Y(0) + 15, fmt(v), { anchor: 'middle', color: '#5a6b75', size: 10, weight: 400 });
    });
    // axis name above the arrow tip, clear of the tick values below the axis
    text(g, xb + 24, Y(0) - 8, o.xl || '', { anchor: 'end', color: '#1d2733', size: 12.5, weight: 700 });
    // circle and centre
    s('circle', { cx: X(o.avg), cy: Y(0), r: Math.max(1.5, R * sc * (o.R > 0 ? 1 : 0)), fill: '#2f7fc1', 'fill-opacity': 0.08, stroke: '#2f7fc1', 'stroke-width': 2 }, g);
    (o.pts || []).forEach((p) => { if (p.spoke) s('line', { x1: X(o.avg), y1: Y(0), x2: X(p.x), y2: Y(p.y), stroke: p.color || '#333', 'stroke-width': 1.6, 'stroke-dasharray': p.dash }, g); });
    if (o.arc && o.R > 0) {
      const a0 = Math.atan2(o.arc.from[1], o.arc.from[0] - o.avg); let a1 = Math.atan2(o.arc.to[1], o.arc.to[0] - o.avg);
      if (o.arc.ccw && a1 < a0 - 1e-9) a1 += 2 * Math.PI; if (o.arc.ccw === false && a1 > a0 + 1e-9) a1 -= 2 * Math.PI;
      const rr = Math.min(R * 0.3, 30 / sc), pts = [], n = 30;
      for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(`${X(o.avg + rr * Math.cos(a)).toFixed(1)},${Y(rr * Math.sin(a)).toFixed(1)}`); }
      if (Math.abs(a1 - a0) > 0.02) {
        s('polyline', { points: pts.join(' '), fill: 'none', stroke: o.arc.color || '#d4612a', 'stroke-width': 1.6 }, g);
        const am = (a0 + a1) / 2; text(g, X(o.avg + rr * 1.5 * Math.cos(am)), Y(rr * 1.5 * Math.sin(am)) + 4, o.arc.label || '', { anchor: 'middle', color: o.arc.color || '#d4612a', size: 11.5 });
      }
    }
    s('circle', { cx: X(o.avg), cy: Y(0), r: 3.2, fill: '#1d2733' }, g);
    (o.pts || []).forEach((p) => {
      s('circle', { cx: X(p.x), cy: Y(p.y), r: p.r || 4.5, fill: p.color || '#333', stroke: '#fff', 'stroke-width': 1.5 }, g);
      if (p.label) {
        const right = p.anchor ? p.anchor === 'start' : p.x >= o.avg;
        const tx = X(p.x) + (right ? 8 : -8), te = text(g, tx, Y(p.y) + (p.dy !== undefined ? p.dy : (ys * p.y < 0 ? -8 : ys * p.y > 0 ? 16 : -8)), p.label, { anchor: right ? 'start' : 'end', color: p.color || '#333', size: 11.5, weight: 700 });
        // keep the label inside the picture on narrow screens
        const tw = te.getComputedTextLength ? te.getComputedTextLength() : 0;
        if (tw) { const x0 = right ? tx : tx - tw; const sh = x0 < 4 ? 4 - x0 : x0 + tw > W - 4 ? W - 4 - (x0 + tw) : 0; if (sh) te.setAttribute('x', tx + sh); }
      }
    });
    return true;
  }

  const box2 = (pts, f) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), b = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
    const m = Math.max(b.xmax - b.xmin, b.ymax - b.ymin, 1e-9) * f;
    return { xmin: b.xmin - m, xmax: b.xmax + m, ymin: b.ymin - m, ymax: b.ymax + m };
  };
  /** Top (x–y) and front (x–z) views of 3D arrows. items: { a, b, color, w, dash, label, kind: 'arrow'|'line'|'moment'|'dot' } */
  function twoViews(svg, items) {
    const T = text;
    const { W, H } = clear(svg);
    const stack = W < 560, pw = stack ? W - 20 : (W - 30) / 2, ph = stack ? (H - 30) / 2 : H - 20;
    const views = [{ name: 'Top view (x–y)', i: 0, j: 1, n: ['x', 'y'] }, { name: 'Front view (x–z)', i: 0, j: 2, n: ['x', 'z'] }];
    const all = []; items.forEach((it) => { all.push(it.a); if (it.b) all.push(it.b); }); all.push([0, 0, 0]);
    let sc = Infinity; const B = views.map((v) => { const b = box2(all.map((p) => [p[v.i], p[v.j]]), 0.18); sc = Math.min(sc, (pw - 40) / (b.xmax - b.xmin), (ph - 50) / (b.ymax - b.ymin)); return b; });
    views.forEach((v, k) => {
      const ox = stack ? 10 : 10 + k * (pw + 10), oy = stack ? 10 + k * (ph + 10) : 10, b = B[k];
      const cx = ox + pw / 2 - ((b.xmin + b.xmax) / 2) * sc, cy = oy + 24 + (ph - 24) / 2 + ((b.ymin + b.ymax) / 2) * sc;
      const X = (p) => cx + p[v.i] * sc, Y = (p) => cy - p[v.j] * sc;
      const g = s('g', {}, svg);
      s('rect', { x: ox, y: oy, width: pw, height: ph, fill: '#fff', stroke: '#d3dce0' }, g);
      T(g, ox + 8, oy + 17, v.name, { color: '#5a6b75', size: 11.5, weight: 700 });
      const x0 = ox + 12, x1 = ox + pw - 12, y0 = oy + 26, y1 = oy + ph - 10;
      s('line', { x1: x0, y1: cy, x2: x1, y2: cy, stroke: '#111111', 'stroke-width': 0.9 }, g); s('line', { x1: cx, y1: y0, x2: cx, y2: y1, stroke: '#111111', 'stroke-width': 0.9 }, g);
      T(g, x1, cy + 14, v.n[0], { anchor: 'end', color: '#111111', size: 11 }); T(g, cx + 6, y0 + 10, v.n[1], { color: '#111111', size: 11 });
      // labels: kept inside the panel and nudged down so they do not sit on each other
      const placed = [], lab = (x, y, txt, color, left) => {
        const tw = txt.length * 6.4, h = 13; let l = left ? x - tw : x;
        l = Math.max(ox + 4, Math.min(l, ox + pw - 4 - tw));
        let t = y - 10;
        for (let n = 0; n < 8 && placed.some((r) => l < r[0] + r[2] && r[0] < l + tw && t < r[1] + h && r[1] < t + h); n++) t += h + 1;
        placed.push([l, t, tw]); T(g, l, t + 10, txt, { color, size: 11.5, weight: 700 });
      };
      items.forEach((it) => {
        const ax = X(it.a), ay = Y(it.a);
        if (it.kind === 'dot') { s('circle', { cx: ax, cy: ay, r: 4, fill: it.color, stroke: '#fff', 'stroke-width': 1.3 }, g); if (it.label) lab(ax + 6, ay - 6, it.label, it.color); return; }
        const bx = X(it.b), by = Y(it.b), L = Math.hypot(bx - ax, by - ay);
        if (L < 1.5) { if (it.kind !== 'line') s('circle', { cx: ax, cy: ay, r: 3.5, fill: 'none', stroke: it.color, 'stroke-width': 1.6 }, g); return; }
        s('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: it.color, 'stroke-width': it.w || 2.4, 'stroke-dasharray': it.dash }, g);
        if (it.kind !== 'line') {
          const ux = (bx - ax) / L, uy = (by - ay) / L, hs = Math.min(10, L * 0.4), px = -uy, py = ux;
          const head = (ex, ey) => s('polygon', { points: `${ex},${ey} ${ex - ux * hs + px * hs * 0.42},${ey - uy * hs + py * hs * 0.42} ${ex - ux * hs - px * hs * 0.42},${ey - uy * hs - py * hs * 0.42}`, fill: it.color }, g);
          head(bx, by); if (it.kind === 'moment') head(bx - ux * hs * 0.8, by - uy * hs * 0.8);
        }
        if (it.label) { const lft = bx < ax - 2; lab(bx + (lft ? -6 : 6), by + (by > ay + 2 ? 14 : -6), it.label, it.color, lft); }
      });
    });
  }

  root.Charts = { niceTicks, clear, text, frame, curve, mark, plot, mohr, twoViews };
})(window);
