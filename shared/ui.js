/* =====================================================================
 * UI helpers: control widgets (slider + number box), and a small SVG
 * drawing kit for engineering-style 2D diagrams (world coords, y up).
 * ===================================================================== */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const fmt = (x, s) => root.Core.fmt(x, s);

  /* ------------------------------------------------------------------ */
  /* DOM                                                                */
  /* ------------------------------------------------------------------ */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }

  /** Factory for control widgets bound to an app context { update(), rebuild() } */
  function Controls(app) {
    const C = {};
    C.section = (parent, title) => { const s = h('div', { class: 'ctl-section' }, h('div', { class: 'ctl-title' }, title)); parent.append(s); return s; };
    C.note = (parent, text) => { parent.append(h('div', { class: 'ctl-note' }, text)); };

    /** slider + number box. o = {label, min, max, step, get, set, unit:()=>str, rebuild} */
    C.slider = (parent, o) => {
      const unit = typeof o.unit === 'function' ? o.unit() : o.unit || '';
      const val = o.get();
      const rng = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value: Math.min(o.max, Math.max(o.min, val)) });
      const num = h('input', { type: 'number', step: o.step, value: round(val, o.step), class: 'num' });
      const rangeTxt = h('div', { class: 'ctl-range' }, `min ${o.min} · max ${o.max} · step ${o.step}`);
      const row = h('div', { class: 'ctl-row' + (o.disabled ? ' disabled' : '') },
        h('label', { class: 'ctl-label' }, h('span', null, o.label), h('span', { class: 'ctl-num' }, num, h('span', { class: 'unit' }, unit))),
        rng, rangeTxt);
      if (o.disabled) { rng.disabled = true; num.disabled = true; }
      rng.addEventListener('input', () => { const v = parseFloat(rng.value); num.value = round(v, o.step); o.set(v); o.rebuild ? app.rebuild() : app.update(); });
      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (!isFinite(v)) return;
        rng.value = Math.min(o.max, Math.max(o.min, v));
        o.set(v); app.update();
      });
      num.addEventListener('change', () => { if (o.rebuild) app.rebuild(); });
      parent.append(row);
      return row;
    };
    C.select = (parent, o) => {
      const sel = h('select', { onchange: () => { o.set(sel.value); o.rebuild === false ? app.update() : app.rebuild(); } },
        ...o.options.map(([v, t, grp]) => h('option', { value: v, selected: String(o.get()) === String(v) }, t)));
      // optgroups
      if (o.options.some((x) => x[2])) {
        sel.innerHTML = '';
        const groups = {};
        o.options.forEach(([v, t, g]) => {
          if (!groups[g]) { groups[g] = h('optgroup', { label: g }); sel.append(groups[g]); }
          groups[g].append(h('option', { value: v, selected: String(o.get()) === String(v) }, t));
        });
      }
      parent.append(h('div', { class: 'ctl-row' }, h('label', { class: 'ctl-label' }, o.label), sel));
      return sel;
    };
    C.seg = (parent, o) => {
      const wrap = h('div', { class: 'seg' });
      o.options.forEach(([v, t]) => {
        wrap.append(h('button', { class: String(o.get()) === String(v) ? 'on' : '', type: 'button', onclick: () => { o.set(v); o.rebuild === false ? app.update() : app.rebuild(); } }, t));
      });
      parent.append(h('div', { class: 'ctl-row' }, o.label ? h('label', { class: 'ctl-label' }, o.label) : null, wrap));
      return wrap;
    };
    C.toggle = (parent, o) => {
      const cb = h('input', { type: 'checkbox', checked: !!o.get(), onchange: () => { o.set(cb.checked); o.rebuild === false ? app.update() : app.rebuild(); } });
      parent.append(h('div', { class: 'ctl-row toggle' }, h('label', null, cb, ' ', o.label)));
      return cb;
    };
    /** Plain number box with a unit. o = {label, get, set, unit, step, rebuild} */
    C.num = (parent, o) => {
      const unit = typeof o.unit === 'function' ? o.unit() : o.unit || '';
      const num = h('input', { type: 'number', step: o.step || 'any', value: round(o.get(), o.step || 0.001), class: 'num' });
      num.addEventListener('input', () => { const v = parseFloat(num.value); if (!isFinite(v)) return; o.set(v); app.update(); });
      num.addEventListener('change', () => { if (o.rebuild) app.rebuild(); });
      parent.append(h('div', { class: 'ctl-row' }, h('label', { class: 'ctl-label' }, h('span', null, o.label), h('span', { class: 'ctl-num' }, num, h('span', { class: 'unit' }, unit)))));
      return num;
    };
    /**
     * Editable list of cards (supports, loads, joints, …).
     * o = { items, max, min, add: [[label, () => newItem]], title(item, i), color(item, i),
     *       fields(item, i) -> [{ key, label, unit, step, options }] }
     * A field with `options` is a select and rebuilds the panel; the others are number boxes.
     */
    C.list = (parent, o) => {
      const wrap = h('div', { class: 'lyr-list' });
      o.items.forEach((it, i) => {
        const canDel = o.items.length > (o.min || 0);
        const head = h('div', { class: 'lyr-head' },
          h('span', { class: 'lyr-n', style: { background: (o.color && o.color(it, i)) || 'var(--chip)' } }, String(i + 1)),
          h('span', { class: 'lyr-t' }, o.title ? o.title(it, i) : ''),
          h('button', { type: 'button', class: 'btn small lyr-x', title: 'Remove', 'aria-label': 'Remove item ' + (i + 1), disabled: !canDel, onclick: () => { o.items.splice(i, 1); app.rebuild(); } }, '×'));
        const grid = h('div', { class: 'lyr-grid' });
        o.fields(it, i).forEach((f) => {
          let input;
          if (f.options) {
            input = h('select', { class: 'lyr-sel', onchange: () => { it[f.key] = input.value; if (f.onset) f.onset(it); app.rebuild(); } },
              ...f.options.map(([v, t]) => h('option', { value: v, selected: String(it[f.key]) === String(v) }, t)));
          } else if (f.text) {
            input = h('input', { type: 'text', class: 'num', value: it[f.key] == null ? '' : String(it[f.key]), spellcheck: false });
            input.addEventListener('change', () => { it[f.key] = input.value.trim(); app.rebuild(); });
          } else {
            input = h('input', { type: 'number', class: 'num', step: f.step || 'any', value: round(it[f.key], f.step || 0.001) });
            input.addEventListener('input', () => { const v = parseFloat(input.value); if (!isFinite(v)) return; it[f.key] = v; app.update(); });
          }
          grid.append(h('label', { class: 'lyr-f' + (f.wide ? ' wide' : '') }, h('span', { class: 'lyr-fl' }, f.label),
            h('span', { class: 'lyr-fi' }, input, f.unit ? h('span', { class: 'unit' }, f.unit) : null)));
        });
        wrap.append(h('div', { class: 'lyr' }, head, grid));
      });
      parent.append(wrap);
      const full = o.max && o.items.length >= o.max;
      const bar = h('div', { class: 'presets' });
      (o.add || []).forEach(([label, make]) => bar.append(h('button', { type: 'button', disabled: full, onclick: () => { o.items.push(make()); app.rebuild(); } }, '+ ' + label)));
      if (full) bar.append(h('span', { class: 'ctl-range' }, `maximum of ${o.max}`));
      parent.append(bar);
      return wrap;
    };
    return C;
  }
  function round(v, step) {
    const dp = Math.max(0, (String(step).split('.')[1] || '').length);
    return parseFloat(Number(v).toFixed(Math.min(6, dp + 2)));
  }

  /* ------------------------------------------------------------------ */
  /* SVG 2D drawing kit                                                 */
  /* ------------------------------------------------------------------ */
  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  /* Diagram colours. Diagrams are always drawn on the light sheet, in light and dark mode. */
  const COL = {
    ink: '#1d2733', axis: '#111111', body: '#b9c2cb', bodyEdge: '#4a5661', support: '#6b7785', ground: '#7f8c8d',
    load: '#c0392b', react: '#1e7a45', couple: '#8e44ad', dim: '#34495e', accent: '#d4612a',
    shear: '#c0563a', moment: '#2f7fc1', axial: '#16a085', cable: '#2c3e50', tension: '#8e44ad', solid: '#9aa3ad',
  };

  /**
   * Create a drawing context mapping world `bounds` into the SVG.
   * bounds = {xmin, xmax, ymin, ymax}; opts.pad (px); opts.padR (extra right px)
   */
  function Draw2D(svg, bounds, opts) {
    opts = opts || {};
    const W = svg.clientWidth || 800, H = svg.clientHeight || 560;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pad = Math.min(opts.pad || 56, W * 0.08), padR = Math.min(opts.padR || 0, W * (opts.padRmax || 0.22)), padT = opts.padT || 0, padB = opts.padB || 0;
    const bw = Math.max(1e-9, bounds.xmax - bounds.xmin), bh = Math.max(1e-9, bounds.ymax - bounds.ymin);
    const sc = Math.max(1e-9, Math.min((W - 2 * pad - padR) / bw, (H - 2 * pad - padT - padB) / bh));
    const ox = pad + (W - 2 * pad - padR - bw * sc) / 2 - bounds.xmin * sc;
    const oy = pad + padT + (H - 2 * pad - padT - padB + bh * sc) / 2 + bounds.ymin * sc;
    const X = (x) => ox + x * sc, Y = (y) => oy - y * sc;
    const P = (p) => `${X(p[0]).toFixed(2)},${Y(p[1]).toFixed(2)}`;

    const defs = s('defs', {}, svg);
    const pat = s('pattern', { id: 'hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    s('rect', { width: 8, height: 8, fill: '#d5dbe1' }, pat);
    s('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#7f8c8d', 'stroke-width': 2 }, pat);
    const pat2 = s('pattern', { id: 'hatchPrism', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' }, defs);
    s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#8e44ad', 'stroke-width': 1.4, 'stroke-opacity': 0.55 }, pat2);
    const gr = s('linearGradient', { id: 'waterGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    s('stop', { offset: '0', 'stop-color': '#8fcbf0' }, gr); s('stop', { offset: '1', 'stop-color': '#3d8fcc' }, gr);

    const root = s('g', {}, svg);
    const st = (o) => {
      o = o || {};
      return {
        fill: o.fill || 'none', stroke: o.stroke || 'none', 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash,
        opacity: o.op, 'fill-opacity': o.fop, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: o.cls,
      };
    };
    svg._inv = (sx, sy) => [(sx - ox) / sc, (oy - sy) / sc];
    const D = {
      svg, X, Y, sc, W, H, root, COL,
      inv: svg._inv,
      group: (cls) => s('g', { class: cls }, root),
      poly(pts, o, parent) { if (!pts || pts.length < 2) return null; return s('polygon', Object.assign(st(o), { points: pts.map(P).join(' ') }), parent || root); },
      pline(pts, o, parent) { return s('polyline', Object.assign(st(Object.assign({ stroke: '#333' }, o)), { points: pts.map(P).join(' '), fill: 'none' }), parent || root); },
      line(a, b, o, parent) { return s('line', Object.assign(st(Object.assign({ stroke: '#333' }, o)), { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]) }), parent || root); },
      lineP(a, b, o, parent) { return s('line', Object.assign(st(Object.assign({ stroke: '#333' }, o)), { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }), parent || root); },
      circle(c, r, o, parent) { return s('circle', Object.assign(st(o), { cx: X(c[0]), cy: Y(c[1]), r: r * sc }), parent || root); },
      text(p, str, o, parent) {
        o = o || {};
        const t = s('text', {
          x: (o.px ? p[0] : X(p[0])) + (o.dx || 0), y: (o.px ? p[1] : Y(p[1])) + (o.dy || 0), 'text-anchor': o.anchor || 'start',
          class: 'lbl ' + (o.cls || ''), fill: o.color || '#1d2733', 'font-size': o.size || 12, 'font-weight': o.weight || 600,
          'dominant-baseline': o.base || 'auto', style: /^(#fff|#ffffff|white)$/i.test(o.color || '') || o.halo === false ? 'stroke: none' : undefined, transform: o.rot ? `rotate(${o.rot} ${(o.px ? p[0] : X(p[0])) + (o.dx || 0)} ${(o.px ? p[1] : Y(p[1])) + (o.dy || 0)})` : undefined,
        }, parent || root);
        t.textContent = str;
        return t;
      },
      /** arrowhead at screen point (hx,hy) pointing along (ux,uy) (screen unit) */
      head(hx, hy, ux, uy, color, size, parent) {
        size = size || 10;
        const px = -uy, py = ux;
        const pts = [[hx, hy], [hx - ux * size + px * size * 0.42, hy - uy * size + py * size * 0.42], [hx - ux * size - px * size * 0.42, hy - uy * size - py * size * 0.42]];
        return s('polygon', { points: pts.map((q) => q.join(',')).join(' '), fill: color }, parent || root);
      },
      /** world arrow tail→head */
      arrow(a, b, o, parent) {
        o = o || {};
        const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]);
        const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
        const g = s('g', {}, parent || root);
        const hs = o.head || 11;
        s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: o.color || '#333', 'stroke-width': o.w || 2.5, 'stroke-dasharray': o.dash }, g);
        D.head(x2, y2, ux, uy, o.color || '#333', hs, g);
        if (o.label) D.text([o.lp === 'head' ? x2 : x1, o.lp === 'head' ? y2 : y1], o.label, { px: true, dx: o.ldx === undefined ? 6 : o.ldx, dy: o.ldy === undefined ? -6 : o.ldy, color: o.color, anchor: o.anchor, size: o.size || 13, weight: 700 }, g);
        return g;
      },
      /** Force arrow of screen length lenPx whose head is at world point `at`, pointing along world dir (dx,dy) */
      force(at, dir, lenPx, o) {
        const l = Math.hypot(dir[0], dir[1]) || 1;
        const ux = dir[0] / l, uy = dir[1] / l;
        const tail = [at[0] - (ux * lenPx) / sc, at[1] - (uy * lenPx) / sc];
        return D.arrow(tail, at, Object.assign({ w: 3.2, head: 13 }, o));
      },
      dot(p, color, label, o) {
        o = o || {};
        const g = s('g', {}, root);
        s('circle', { cx: X(p[0]), cy: Y(p[1]), r: o.r || 5, fill: color, stroke: '#fff', 'stroke-width': 1.5 }, g);
        if (label) D.text(p, label, { dx: o.dx === undefined ? 8 : o.dx, dy: o.dy === undefined ? 4 : o.dy, color, anchor: o.anchor, size: 12, weight: 700 }, g);
        return g;
      },
      /** dimension line between world points a,b, offset `off` px perpendicular (left of a→b) */
      dim(a, b, label, off, o) {
        o = o || {};
        const g = s('g', { class: 'dim' }, root);
        const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]);
        const L = Math.hypot(x2 - x1, y2 - y1);
        if (L < 2) return g;
        const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = uy, ny = -ux;
        const ax = x1 + nx * off, ay = y1 + ny * off, bx = x2 + nx * off, by = y2 + ny * off;
        const c = o.color || COL.dim;
        s('line', { x1, y1, x2: ax + nx * 4 * Math.sign(off || 1), y2: ay + ny * 4 * Math.sign(off || 1), stroke: c, 'stroke-width': 0.8, opacity: 0.6 }, g);
        s('line', { x1: x2, y1: y2, x2: bx + nx * 4 * Math.sign(off || 1), y2: by + ny * 4 * Math.sign(off || 1), stroke: c, 'stroke-width': 0.8, opacity: 0.6 }, g);
        s('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: c, 'stroke-width': 1 }, g);
        const hs = Math.min(8, L / 3);
        D.head(ax, ay, -ux, -uy, c, hs, g); D.head(bx, by, ux, uy, c, hs, g);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const vertical = Math.abs(ux) < 0.3;
        D.text([mx, my], label, {
          px: true, color: c, size: 11.5, weight: 600,
          anchor: o.anchor || (vertical ? (off >= 0 ? 'start' : 'end') : 'middle'),
          dx: o.ldx !== undefined ? o.ldx : vertical ? (off >= 0 ? 5 : -5) : 0, dy: o.ldy !== undefined ? o.ldy : vertical ? 4 : (off >= 0 ? 14 : -5),
        }, g);
        return g;
      },
      /** free-surface symbol ▽ */
      fs(p, o) {
        o = o || {};
        const g = s('g', {}, root);
        const x = X(p[0]), y = Y(p[1]);
        s('polygon', { points: `${x - 7},${y - 12} ${x + 7},${y - 12} ${x},${y - 1}`, fill: 'none', stroke: o.color || COL.waterDark, 'stroke-width': 1.5 }, g);
        s('line', { x1: x - 8, y1: y + 4, x2: x + 8, y2: y + 4, stroke: o.color || COL.waterDark, 'stroke-width': 1.2 }, g);
        s('line', { x1: x - 4, y1: y + 8, x2: x + 4, y2: y + 8, stroke: o.color || COL.waterDark, 'stroke-width': 1.2 }, g);
        if (o.label) D.text([x + 12, y - 4], o.label, { px: true, color: o.color || COL.waterDark, size: 11 }, g);
        return g;
      },
      /** angle arc at world center between angles a0→a1 (deg, math convention), radius px */
      arc(c, rpx, a0, a1, label, o) {
        o = o || {};
        const g = s('g', {}, root);
        const cx = X(c[0]), cy = Y(c[1]);
        const pts = [];
        const n = 24;
        for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + rpx * Math.cos(a), cy - rpx * Math.sin(a)]); }
        s('polyline', { points: pts.map((q) => q.join(',')).join(' '), fill: 'none', stroke: o.color || COL.dim, 'stroke-width': 1.2 }, g);
        const am = (((a0 + a1) / 2) * Math.PI) / 180;
        if (label) D.text([cx + (rpx + 8) * Math.cos(am), cy - (rpx + 8) * Math.sin(am)], label, { px: true, color: o.color || COL.dim, size: 12, anchor: Math.cos(am) >= 0 ? 'start' : 'end', dy: 4 }, g);
        return g;
      },
      el: (tag, attrs, parent) => s(tag, attrs, parent || root),
    };
    return D;
  }

  root.UI = { h, Controls, Draw2D, svgEl: s, COL, fmt, round };
})(window);
