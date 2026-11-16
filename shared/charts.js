/* =====================================================================
 * Charts: SVG line charts and filled diagrams (shear, moment, tension,
 * motion graphs, …). Always drawn in the light palette so they print
 * the same in light and dark mode.
 * (The Mohr's circle drawing is added here with the first module that
 * needs it: Centroids and Moments of Inertia.)
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
    const t = s('text', { x, y, 'text-anchor': o.anchor || 'start', class: 'lbl', fill: o.color || '#1d2733', 'font-size': o.size || 11.5, 'font-weight': o.weight || 600, transform: o.rot ? `rotate(${o.rot} ${x} ${y})` : undefined }, parent);
    t.textContent = str;
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
    return { X, Y, g, y0, y1 };
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
    if (label) text(F.g, F.X(x) + (o.dx === undefined ? 7 : o.dx), F.Y(y) + (o.dy === undefined ? -6 : o.dy), label, { color: o.color || '#d4612a', anchor: o.anchor, size: o.size || 11.5, weight: 700 });
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

  root.Charts = { niceTicks, clear, text, frame, curve, mark, plot };
})(window);
