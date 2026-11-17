/* =====================================================================
 * STATICS · Internal Forces — UI: inputs, 2D and 3D diagrams, presets.
 * Every number drawn comes from the result's `geo`, never from the raw inputs.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Internal } = root;
  const { fmt, tidy } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;

  const M = { id: 'internal', title: 'Internal Forces', defaults: Internal.defaults, units: 'SI' };
  const S = () => M.state;
  const isBeam = () => S().mode === 'diagrams' || S().mode === 'cut';

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const KIND = [['point', 'Point force'], ['couple', 'Couple moment'], ['dist', 'Distributed load']];
  const KCOL = { point: '#f6c9c2', couple: '#e2cdef', dist: '#f9dcc0', pin: '#cfe8d8', roller: '#cfe8d8', fixed: '#d5dbe1' };
  function retype(q) {
    const st = S(), x = q.x !== undefined ? q.x : q.x1 !== undefined ? q.x1 : st.L / 2;
    const kind = q.kind; Object.keys(q).forEach((k) => delete q[k]); q.kind = kind;
    if (kind === 'point') Object.assign(q, { x, P: 10, ang: 90 });
    else if (kind === 'couple') Object.assign(q, { x, M: 10, dir: 'cw' });
    else Object.assign(q, { x1: Math.min(x, st.L * 0.9), x2: st.L, w1: 2, w2: 2 });
  }
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, F = st.fu;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [
      ['diagrams', 'Shear and moment diagrams', 'Beams'], ['cut', 'Internal loadings at a cut', 'Beams'],
      ['cableP', 'Cable with concentrated loads', 'Cables'], ['cableU', 'Cable with a uniform load (parabola)', 'Cables'], ['catenary', 'Cable under its own weight (catenary)', 'Cables']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (isBeam()) {
      const big = M.units === 'US';
      sec = C.section(c, 'Beam');
      C.slider(sec, { label: 'Length L', min: big ? 2 : 1, max: big ? 100 : 30, step: big ? 0.5 : 0.1, get: () => st.L, set: (v) => (st.L = v), unit: Lu, rebuild: true });
      sec = C.section(c, 'Supports');
      C.list(sec, {
        items: st.supports, max: 4, color: (it) => KCOL[it.type], title: (it, i) => 'Support ' + 'ABCD'[i],
        fields: (it) => [{ key: 'type', label: 'Type', options: [['pin', 'Pin'], ['roller', 'Roller'], ['fixed', 'Fixed']] }, { key: 'x', label: 'Position x', unit: Lu, step: 0.1 }],
        add: [['Pin', () => ({ type: 'pin', x: 0 })], ['Roller', () => ({ type: 'roller', x: st.L })], ['Fixed', () => ({ type: 'fixed', x: 0 })]],
      });
      sec = C.section(c, 'Loads');
      C.note(sec, 'Forces and distributed loads are positive downward. x is measured from the left end.');
      C.list(sec, {
        items: st.loads, max: 8, color: (it) => KCOL[it.kind], title: (it) => KIND.find((k) => k[0] === it.kind)[1],
        fields: (it) => {
          const f = [{ key: 'kind', label: 'Kind', options: KIND, onset: retype, wide: it.kind !== 'couple' && it.kind !== 'point' ? true : false }];
          if (it.kind === 'point') f.push({ key: 'x', label: 'Position x', unit: Lu }, { key: 'P', label: 'Force P', unit: F }, { key: 'ang', label: 'Angle from beam', unit: '°' });
          else if (it.kind === 'couple') f.push({ key: 'x', label: 'Position x', unit: Lu }, { key: 'M', label: 'Moment M', unit: `${F}·${Lu}` }, { key: 'dir', label: 'Direction', options: [['cw', 'Clockwise ↻'], ['ccw', 'Counterclockwise ↺']] });
          else f.push({ key: 'x1', label: 'From x₁', unit: Lu }, { key: 'x2', label: 'To x₂', unit: Lu }, { key: 'w1', label: 'w₁ at x₁', unit: `${F}/${Lu}` }, { key: 'w2', label: 'w₂ at x₂', unit: `${F}/${Lu}` });
          return f;
        },
        add: [['Force', () => ({ kind: 'point', x: tidy(st.L / 2), P: 10, ang: 90 })], ['Couple', () => ({ kind: 'couple', x: tidy(st.L / 2), M: 10, dir: 'cw' })], ['Distributed', () => ({ kind: 'dist', x1: 0, x2: st.L, w1: 2, w2: 2 })]],
      });
      sec = C.section(c, 'Internal hinges');
      const hs = st.hinges.map((x) => ({ x }));
      const sync = () => (st.hinges = hs.map((o) => o.x));
      const listApp = { update: () => { sync(); root.App.update(); }, rebuild: () => { sync(); root.App.rebuild(true); } };
      UI.Controls(listApp).list(sec, { items: hs, max: 2, title: () => 'Hinge (M = 0)', fields: () => [{ key: 'x', label: 'Position x', unit: Lu, wide: true }], add: [['Hinge', () => ({ x: tidy(st.L / 2) })]] });
      sec = C.section(c, 'Deflected shape');
      C.toggle(sec, { label: 'Show the deflected shape', get: () => st.defl !== false, set: (v) => { st.defl = v; if (!v) st.play = 'cut'; } });
      if (st.defl !== false) {
        C.seg(sec, { label: 'Play animates', get: () => st.play || 'deflect', set: (v) => { st.play = v; delete st._k; }, options: [['deflect', 'The beam deflecting'], ['cut', 'The moving cut']] });
        C.note(sec, 'The shape is exaggerated and assumes the same EI along the whole beam. Results list EI × deflection, so divide by EI for the actual deflection.');
      }
      sec = C.section(c, 'Cut');
      C.slider(sec, { label: 'Cut at x', min: 0, max: st.L, step: tidy(st.L / 200, 2), get: () => st.cut, set: (v) => (st.cut = v), unit: Lu, rebuild: true });
      const res = root.App && root.App.res;
      if (res && res.ok && res.geo.kind === 'beam' && res.geo.beam.jumpAt(Math.min(st.L, Math.max(0, st.cut)))) {
        C.seg(sec, { label: 'A force or couple acts here', get: () => st.side, set: (v) => (st.side = v), options: [['L', 'Just to the left'], ['R', 'Just to the right']] });
      }
    } else if (st.mode === 'cableP') {
      const cb = st.cab;
      sec = C.section(c, 'Supports');
      C.slider(sec, { label: 'Span (A to the far support)', min: 1, max: M.units === 'US' ? 300 : 100, step: 0.5, get: () => cb.span, set: (v) => (cb.span = v), unit: Lu });
      C.toggle(sec, { label: 'Supports at the same level', get: () => cb.level !== false && !cb.hB, set: (v) => { cb.level = v; if (v) cb.hB = 0; else if (!cb.hB) cb.hB = tidy(cb.span * 0.15); } });
      if (cb.level === false || cb.hB) C.num(sec, { label: 'Far support above A (negative = below)', get: () => cb.hB, set: (v) => (cb.hB = v), unit: Lu });
      sec = C.section(c, 'Loads, from left to right');
      C.list(sec, { items: cb.loads, max: 5, min: 1, color: () => KCOL.point, title: (it, i) => 'Load at point ' + 'BCDEFG'[i],
        fields: () => [{ key: 'x', label: 'Distance from A', unit: Lu }, { key: 'P', label: 'Force (down)', unit: F }], add: [['Load', () => ({ x: tidy(cb.span * 0.9), P: 5 })]] });
      sec = C.section(c, 'Known geometry');
      C.seg(sec, { label: 'What is known', get: () => cb.known, set: (v) => (cb.known = v), options: [['sag', 'Sag at one point'], ['FH', 'Horizontal force']] });
      if (cb.known === 'sag') {
        C.select(sec, { label: 'Point with the known sag', get: () => Math.min(cb.at, cb.loads.length), set: (v) => (cb.at = +v), options: cb.loads.map((q, i) => [i + 1, 'Point ' + 'BCDEFG'[i]]) });
        C.num(sec, { label: 'Sag below support A', get: () => cb.sag, set: (v) => (cb.sag = v), unit: Lu });
      } else C.num(sec, { label: 'Horizontal force F_H', get: () => cb.FH, set: (v) => (cb.FH = v), unit: F });
    } else if (st.mode === 'cableU') {
      const p = st.par;
      sec = C.section(c, 'Cable');
      C.slider(sec, { label: 'Span L', min: 1, max: M.units === 'US' ? 3000 : 1000, step: 1, get: () => p.L, set: (v) => (p.L = v), unit: Lu });
      C.num(sec, { label: 'Load w₀ along the horizontal', get: () => p.w0, set: (v) => (p.w0 = v), unit: `${F}/${Lu}` });
      C.toggle(sec, { label: 'Supports at the same level', get: () => p.level, set: (v) => (p.level = v) });
      if (p.level) {
        C.select(sec, { label: 'Known quantity', get: () => p.given, set: (v) => (p.given = v), options: [['sag', 'Sag h'], ['Tmax', 'Maximum tension (find the sag)'], ['len', 'Cable length (find the sag)']] });
        if (p.given === 'sag') C.num(sec, { label: 'Sag h', get: () => p.hA, set: (v) => (p.hA = v), unit: Lu });
        else if (p.given === 'Tmax') C.num(sec, { label: 'Maximum tension T_max', get: () => p.Tmax, set: (v) => (p.Tmax = v), unit: F });
        else C.num(sec, { label: 'Cable length', get: () => p.len, set: (v) => (p.len = v), unit: Lu });
      } else {
        C.num(sec, { label: 'Lowest point below A', get: () => p.hA, set: (v) => (p.hA = v), unit: Lu });
        C.num(sec, { label: 'Lowest point below B', get: () => p.hB, set: (v) => (p.hB = v), unit: Lu });
      }
    } else {
      const k = st.cat;
      sec = C.section(c, 'Cable');
      C.note(sec, 'The weight acts along the length of the cable.');
      C.slider(sec, { label: 'Span L', min: 1, max: M.units === 'US' ? 3000 : 1000, step: 1, get: () => k.L, set: (v) => (k.L = v), unit: Lu });
      C.num(sec, { label: 'Weight per unit length w₀', get: () => k.w0, set: (v) => (k.w0 = v), unit: `${F}/${Lu}` });
      C.toggle(sec, { label: 'Supports at the same level', get: () => k.level !== false, set: (v) => (k.level = v) });
      if (k.level === false) {
        C.num(sec, { label: 'Lowest point below A', get: () => k.hA, set: (v) => (k.hA = v), unit: Lu });
        C.num(sec, { label: 'Lowest point below B', get: () => k.hB, set: (v) => (k.hB = v), unit: Lu });
      } else {
        C.seg(sec, { label: 'Known quantity', get: () => k.given, set: (v) => (k.given = v), options: [['sag', 'Sag h'], ['len', 'Cable length']] });
        if (k.given === 'sag') C.num(sec, { label: 'Sag h', get: () => k.h, set: (v) => (k.h = v), unit: Lu });
        else C.num(sec, { label: 'Cable length', get: () => k.len, set: (v) => (k.len = v), unit: Lu });
      }
    }
  };

  M.compute = (U) => Internal.solve(S(), U);
  M.onUnits = (from, to) => Internal.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  const showDefl = () => isBeam() && S().defl !== false;
  M.cap2D = () => (isBeam() ? (showDefl() ? 'Beam diagrams and deflected shape' : 'Beam, shear and moment diagrams') : 'Cable diagram');
  M.cap3D = '3D view';
  M.plotCaption = 'Tension along the span';
  M.hint = () => (isBeam() ? 'Drag the orange cut line along the beam. Press Play to sweep the cut or, if chosen in the inputs, to watch the beam deflect. Positive shear acts downward on the right face of the left segment; positive moment bends the beam concave upward.' : 'Tension is tangent to the cable, and its horizontal component F_H is the same at every point.');
  M.legend = () => (isBeam()
    ? [[COL.load, 'Loads'], [COL.react, 'Reactions'], [COL.shear, 'Shear V', 'sq'], [COL.moment, 'Moment M', 'sq']].concat(showDefl() ? [[DCOL, 'Deflected shape', 'ln']] : [], [[COL.accent, 'Cut', 'ln']])
    : [[COL.cable, 'Cable', 'ln'], [COL.load, 'Loads'], [COL.react, 'Support reactions'], [COL.tension, 'Tension']]);

  /* Play sweeps the cut along the beam. One stable object, so Pause and Play resume. */
  const sweep = {
    duration: 12, loop: false,
    frame(u) { const st = S(); st.cut = tidy((Math.round(u * 400) / 400) * st.L); st.side = 'R'; },
    label() { const st = S(); return `cut at x = ${fmt(st.cut)} ${Core.UNITS[M.units].len}`; },
  };
  /* Play bends the beam from straight to its deflected shape and back, like a 10 s gif (shared with every deflection module). */
  const DCOL = '#0f8a7e';
  const deflect = root.Anim.deflection(S);
  const defK = () => (S()._k === undefined ? 1 : S()._k);
  M.anim = () => (isBeam() ? (showDefl() && S().play !== 'cut' ? deflect : sweep) : null);

  M.onDrag = function (p, phase, res) {
    if (!isBeam() || res.geo.kind !== 'beam') return false;
    const b = res.geo.beam, st = S();
    let x = Math.min(b.L, Math.max(0, p[0]));
    const near = b.events.reduce((m, e) => (Math.abs(e - x) < Math.abs(m - x) ? e : m), b.events[0]);
    x = Math.abs(near - x) < b.L * 0.012 ? near : tidy(Math.round(x / (b.L / 200)) * (b.L / 200), 6);
    if (x === st.cut && phase !== 'down') return false;
    st.cut = x;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* 2D: beam, shear and moment diagrams                                */
  /* ------------------------------------------------------------------ */
  function arrow(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.4},${y2 - uy * hs + py * hs * 0.4} ${x2 - ux * hs - px * hs * 0.4},${y2 - uy * hs - py * hs * 0.4}`, fill: color }, g);
  }
  /** Circular arrow about (cx, cy): from angle a0 to a1 in degrees (screen angles, counterclockwise positive), head at a1. */
  function arcArrow(g, cx, cy, r, a0, a1, color, w) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    s('polyline', { points: pts.slice(0, n).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': w || 2.2, 'stroke-linecap': 'round' }, g);
    const e = pts[n], q = pts[n - 3], L = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1, ux = (e[0] - q[0]) / L, uy = (e[1] - q[1]) / L, hs = 9, px = -uy, py = ux;
    s('polygon', { points: `${e[0]},${e[1]} ${e[0] - ux * hs + px * hs * 0.45},${e[1] - uy * hs + py * hs * 0.45} ${e[0] - ux * hs - px * hs * 0.45},${e[1] - uy * hs - py * hs * 0.45}`, fill: color }, g);
  }
  function hatchDefs(svg) {
    const defs = s('defs', {}, svg);
    const pat = s('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, pat);
    s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, pat);
  }

  function drawBeam2D(svg, res, U, opt) {
    const g = res.geo, b = g.beam, { F, Lu, FL } = g, L = b.L;
    const { W, H } = Charts.clear(svg);
    hatchDefs(svg);
    const wallR = b.sups.some((sp) => sp.type === 'fixed' && sp.x > L - 1e-9);
    const ml = 66, mr = wallR ? 70 : 30, pw = W - ml - mr;
    const X = (x) => ml + (x / L) * pw;
    svg._inv = (sx, sy) => [((sx - ml) / pw) * L, sy];
    const dOn = showDefl() && b.defl && !b.defl.flat, kD = S().play !== 'cut' ? defK() : 1;
    // while Play runs the beam drawing itself bends (exaggerated, at most 16 px), coloured by the size of the deflection
    const bend = dOn && S().play !== 'cut' && S()._k !== undefined, vmax = dOn ? Math.abs(b.defl.max.y) || 1 : 1;
    const dp = (x) => (bend ? (-b.defl.y(x) / vmax) * 16 * kD : 0);
    const nP = (b.hasAxial ? 3 : 2) + (dOn ? 1 : 0);
    const topH = Math.max(168, Math.min(H * (dOn ? 0.32 : 0.38), 250));
    const gap = 12, bot = 24;
    const ph = (H - topH - bot - gap * (nP - 1)) / nP;
    const root0 = s('g', {}, svg);
    const yb = 8 + topH * 0.52, bt = 7; // beam centre line and half thickness

    /* --- loads --- */
    const Pmax = Math.max(1e-12, ...b.acts.filter((a) => a.P !== undefined).map((a) => Math.abs(a.P)));
    const wmax = Math.max(1e-12, ...b.dists.map((d) => Math.max(Math.abs(d.w1), Math.abs(d.w2))));
    b.dists.forEach((d) => {
      const up = d.w1 < 0 || d.w2 < 0, sg = up ? 1 : -1, y0 = yb + sg * bt;
      const hh = (w) => (w ? 12 + 26 * (Math.abs(w) / wmax) : 0);
      const xa = X(d.x1), xb = X(d.x2), ha = hh(d.w1), hb2 = hh(d.w2), wx = (px) => ((px - ml) / pw) * L;
      const ns = 24, topP = [], botP = [];
      for (let i = 0; i <= ns; i++) { const xx = xa + ((xb - xa) * i) / ns, hx = ha + ((hb2 - ha) * i) / ns, o = dp(wx(xx)); topP.push(`${xx},${y0 + sg * hx + o}`); botP.unshift(`${xx},${y0 + o}`); }
      s('polygon', { points: topP.concat(botP).join(' '), fill: COL.load, 'fill-opacity': 0.13, stroke: COL.load, 'stroke-width': 1.3 }, root0);
      const n = Math.max(2, Math.round((xb - xa) / 20));
      for (let i = 0; i <= n; i++) {
        const xx = xa + ((xb - xa) * i) / n, hx = ha + ((hb2 - ha) * i) / n, o = dp(wx(xx));
        if (hx > 9) arrow(root0, xx, y0 + sg * hx + o, xx, y0 + o, COL.load, 1.3, 6);
      }
      if (opt.showP) {
        const ty = (hx) => y0 + sg * (hx + 5) + (up ? 10 : 0);
        if (d.w1 === d.w2) T(root0, (xa + xb) / 2, ty(ha), `${fmt(Math.abs(d.w1))} ${F}/${Lu}`, { anchor: 'middle', color: COL.load });
        else {
          if (d.w1) T(root0, xa, ty(ha), `${fmt(Math.abs(d.w1))} ${F}/${Lu}`, { anchor: xa < ml + 40 ? 'start' : 'middle', color: COL.load });
          if (d.w2) T(root0, xb, ty(hb2), `${fmt(Math.abs(d.w2))} ${F}/${Lu}`, { anchor: xb > W - mr - 40 ? 'end' : 'middle', color: COL.load });
        }
      }
    });
    /* --- beam --- */
    if (!bend) s('rect', { x: X(0), y: yb - bt, width: pw, height: 2 * bt, fill: COL.body, stroke: COL.bodyEdge, 'stroke-width': 1.4, rx: 1.5 }, root0);
    else {
      s('rect', { x: X(0), y: yb - bt, width: pw, height: 2 * bt, fill: 'none', stroke: COL.bodyEdge, 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.5 }, root0);
      const nb = 60, top = [], bo = [];
      for (let i = 0; i < nb; i++) {
        const x0 = (L * i) / nb, x1 = (L * (i + 1)) / nb, c = root.Anim.contour((kD * Math.abs(b.defl.y((x0 + x1) / 2))) / vmax);
        s('polygon', { points: `${X(x0)},${yb - bt + dp(x0)} ${X(x1) + 0.4},${yb - bt + dp(x1)} ${X(x1) + 0.4},${yb + bt + dp(x1)} ${X(x0)},${yb + bt + dp(x0)}`, fill: c, stroke: 'none' }, root0);
      }
      for (let i = 0; i <= nb; i++) { const x = (L * i) / nb; top.push(`${X(x)},${yb - bt + dp(x)}`); bo.unshift(`${X(x)},${yb + bt + dp(x)}`); }
      s('polygon', { points: top.concat(bo).join(' '), fill: 'none', stroke: COL.bodyEdge, 'stroke-width': 1.4 }, root0);
    }
    /* --- supports --- */
    const sy = yb + bt, supH = 22;
    b.sups.forEach((sp) => {
      const x = X(sp.x);
      if (sp.type === 'fixed') {
        if (sp.x < 1e-9) s('rect', { x: x - 13, y: yb - 32, width: 13, height: 64, fill: 'url(#hatch)', stroke: COL.support, 'stroke-width': 1.2 }, root0);
        else if (sp.x > L - 1e-9) s('rect', { x, y: yb - 32, width: 13, height: 64, fill: 'url(#hatch)', stroke: COL.support, 'stroke-width': 1.2 }, root0);
        else s('rect', { x: x - 11, y: sy, width: 22, height: supH, fill: 'url(#hatch)', stroke: COL.support, 'stroke-width': 1.2 }, root0);
      } else {
        if (sp.type === 'pin') s('polygon', { points: `${x},${sy} ${x - 11},${sy + supH - 4} ${x + 11},${sy + supH - 4}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, root0);
        else s('circle', { cx: x, cy: sy + 8.5, r: 8.5, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.5 }, root0);
        const gy = sp.type === 'pin' ? sy + supH - 4 : sy + 17;
        s('rect', { x: x - 15, y: gy, width: 30, height: 5, fill: 'url(#hatch)', stroke: 'none' }, root0);
        s('line', { x1: x - 15, y1: gy, x2: x + 15, y2: gy, stroke: COL.support, 'stroke-width': 1.5 }, root0);
      }
      const rEnd = sp.x > L - 1e-9, wall = sp.type === 'fixed' && (sp.x < 1e-9 || rEnd);
      if (wall) T(root0, x + (rEnd ? 7 : -7), yb - 38, sp.label, { anchor: 'middle', size: 13, weight: 700, color: COL.ink });
      else T(root0, x + (rEnd ? 18 : -18), sy + 15, sp.label, { anchor: rEnd ? 'start' : 'end', size: 13, weight: 700, color: COL.ink });
    });
    b.hinges.forEach((xh) => s('circle', { cx: X(xh), cy: yb + dp(xh), r: 5, fill: '#fff', stroke: COL.ink, 'stroke-width': 1.6 }, root0));
    /* --- point forces and couples --- */
    b.acts.forEach((a) => {
      const x = X(a.x);
      if (a.Mz) {
        const ccw = a.Mz > 0;
        arcArrow(root0, x, yb + dp(a.x), 19, ccw ? -50 : 230, ccw ? 230 : -50, COL.couple);
        if (opt.showP) T(root0, x, yb - 27, `${fmt(Math.abs(a.Mz))} ${FL}`, { anchor: x > W - mr - 50 ? 'end' : x < ml + 50 ? 'start' : 'middle', color: COL.couple });
        return;
      }
      const len = 34 + 22 * (Math.abs(a.P) / Pmax), m = Math.hypot(a.Fx, a.Fy) || 1, ux = a.Fx / m, uy = -a.Fy / m;
      const tipY = (a.Fy > 0 ? yb + bt : yb - bt) + dp(a.x);
      const tx = x - ux * len, ty = tipY - uy * len;
      arrow(root0, tx, ty, x, tipY, COL.load, 2.8, 11);
      if (opt.showP) T(root0, tx, ty + (uy >= 0 ? -6 : 14), `${fmt(Math.abs(a.P))} ${F}` + (a.Fx ? ` at ${fmt(a.ang)}°` : ''), { anchor: tx > W - mr - 50 ? 'end' : tx < ml + 40 ? 'start' : 'middle', color: COL.load, size: 12, weight: 700 });
    });
    /* --- reactions --- */
    b.reactions.forEach((R) => {
      const x = X(R.x), rightEnd = R.x > L - 1e-9;
      const y0 = sy + (R.type === 'fixed' && (R.x < 1e-9 || rightEnd) ? 30 : supH + 5), y1 = y0 + 30;
      if (R.Ry >= 0) arrow(root0, x, y1, x, y0, COL.react, 2.6); else arrow(root0, x, y0, x, y1, COL.react, 2.6);
      if (opt.showP) T(root0, x + (rightEnd ? -8 : 8), y1 - 8, `${R.label}_y = ${fmt(Math.abs(R.Ry))} ${F}`, { anchor: rightEnd ? 'end' : 'start', color: COL.react });
      if (R.Rx) {
        const sgn = rightEnd ? 1 : -1, xa = x + sgn * 52, xb = x + sgn * 18, yy = yb + (R.type === 'fixed' ? 0 : 0);
        const from = (R.Rx > 0) === (sgn < 0) ? xa : xb, to = from === xa ? xb : xa;
        arrow(root0, from, yy, to, yy, COL.react, 2.6);
        if (opt.showP) T(root0, sgn < 0 ? Math.max(4, xa) : xa, yy - 9, `${R.label}_x = ${fmt(Math.abs(R.Rx))} ${F}`, { anchor: sgn < 0 ? 'start' : 'end', color: COL.react });
      }
      if (R.M) {
        const ccw = R.M > 0, cx = rightEnd ? x + 6 : x - 6;
        if (rightEnd) arcArrow(root0, cx, yb, 40, ccw ? -62 : 62, ccw ? 62 : -62, COL.react);
        else arcArrow(root0, cx, yb, 40, ccw ? 118 : 242, ccw ? 242 : 118, COL.react);
        if (opt.showP) T(root0, rightEnd ? W - 4 : 4, Math.min(sy + 80, 8 + topH - 22), `M_${R.label} = ${fmt(Math.abs(R.M))} ${FL}`, { anchor: rightEnd ? 'end' : 'start', color: COL.react });
      }
    });
    /* --- positions along the beam --- */
    const dimY = 8 + topH - 4;
    s('line', { x1: X(0), y1: dimY - 12, x2: X(L), y2: dimY - 12, stroke: COL.dim, 'stroke-width': 1 }, root0);
    let lastX = -99;
    b.events.forEach((e, i) => {
      const x = X(e);
      s('line', { x1: x, y1: dimY - 16, x2: x, y2: dimY - 8, stroke: COL.dim, 'stroke-width': 1 }, root0);
      if (x - lastX > 30 || i === b.events.length - 1) { T(root0, x, dimY + 2, fmt(e) + (i === b.events.length - 1 ? ' ' + Lu : ''), { anchor: i === b.events.length - 1 ? 'end' : 'middle', color: COL.dim, size: 10.5, weight: 400 }); lastX = x; }
    });
    T(root0, ml - 8, dimY + 2, 'x =', { anchor: 'end', color: COL.dim, size: 10.5, weight: 400 });

    /* --- diagrams --- */
    const panels = [];
    if (b.hasAxial) panels.push({ key: 'N', name: `N (${F})`, color: COL.axial, unit: F });
    panels.push({ key: 'V', name: `V (${F})`, color: COL.shear, unit: F }, { key: 'M', name: `M (${FL})`, color: COL.moment, unit: FL });
    const DU = `${F}·${Lu}³`;
    if (dOn) panels.push({ key: 'D', name: `EI·v (${DU})`, color: DCOL, unit: DU });
    const val = (sg, key, x) => (key === 'N' ? sg.N : key === 'V' ? sg.V(x) : sg.M(x));
    const frames = [];
    const xtk = b.events.filter((e, i, arr) => i === 0 || i === arr.length - 1 || (X(e) - X(arr[i - 1]) > 26));
    /* Deflected shape: the elastic curve EI·v, drawn to an exaggerated scale on the straight beam axis. */
    function deflPanel(p, pi) {
      const n = 160, full = [];
      let lo = 0, hi = 0;
      for (let i = 0; i <= n; i++) { const x = (L * i) / n, v = b.defl.y(x); full.push([x, v]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const Fm = Charts.frame(svg, { x: ml, y: 8 + topH + pi * (ph + gap), w: pw, h: ph, xmin: 0, xmax: L, ymin: lo, ymax: hi, ylabel: p.name, ycolor: p.color, yside: 52, xticks: xtk, padY: 0.3, padTop: true, padBottom: true });
      s('line', { x1: Fm.X(0), y1: Fm.Y(0), x2: Fm.X(L), y2: Fm.Y(0), stroke: '#8c99a3', 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, Fm.g);
      b.sups.forEach((sp) => {
        const x = Fm.X(sp.x), y = Fm.Y(0);
        if (sp.type === 'fixed') s('rect', { x: x - (sp.x < 1e-9 ? 5 : sp.x > L - 1e-9 ? 0 : 2.5), y: y - 9, width: 5, height: 18, fill: COL.support }, Fm.g);
        else s('polygon', { points: `${x},${y + 1} ${x - 6},${y + 10} ${x + 6},${y + 10}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.3 }, Fm.g);
      });
      Charts.curve(Fm, full.map(([x, v]) => [x, v * kD]), { color: p.color, width: 3.2 });
      b.hinges.forEach((xh) => s('circle', { cx: Fm.X(xh), cy: Fm.Y(b.defl.y(xh) * kD), r: 4, fill: '#fff', stroke: COL.ink, 'stroke-width': 1.4 }, Fm.g));
      const m = b.defl.max, right = Fm.X(m.x) > ml + pw * 0.6;
      Charts.mark(Fm, m.x, m.y * kD, opt.showP && Math.abs(X(m.x) - X(g.cut.x)) >= 190 ? `largest: ${fmt(m.y)} at x = ${fmt(m.x)}` : null, { color: p.color, anchor: right ? 'end' : 'start', dx: right ? -8 : 8, dy: m.y > 0 ? -8 : 16 });
      if (pw > 420) T(Fm.g, ml + pw - 6, 8 + topH + pi * (ph + gap) + 14, 'exaggerated, constant EI', { anchor: 'end', color: COL.dim, size: 10.5, weight: 400 });
      frames.push({ F: Fm, p, y: (x) => b.defl.y(x) * kD, full: (x) => b.defl.y(x) });
    }
    panels.forEach((p, pi) => {
      if (p.key === 'D') { deflPanel(p, pi); return; }
      let lo = 0, hi = 0;
      const curves = b.segs.map((sg) => {
        const n = (p.key === 'N' || (!sg.q0 && !sg.q1 && p.key === 'V')) ? 1 : 28, pts = [];
        for (let i = 0; i <= n; i++) { const x = sg.a + ((sg.b - sg.a) * i) / n, v = val(sg, p.key, x); pts.push([x, v]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
        return pts;
      });
      const Fm = Charts.frame(svg, { x: ml, y: 8 + topH + pi * (ph + gap), w: pw, h: ph, xmin: 0, xmax: L, ymin: lo, ymax: hi, ylabel: p.name, ycolor: p.color, yside: 52, xticks: pi === panels.length - 1 ? xtk : false, padY: 0.24 });
      frames.push({ F: Fm, p });
      curves.forEach((pts) => Charts.curve(Fm, pts, { color: p.color, fill: p.color, fop: 0.22, width: 2 }));
      // vertical lines at jumps
      b.segs.forEach((sg, i) => {
        const prev = i ? val(b.segs[i - 1], p.key, sg.a) : 0, cur = val(sg, p.key, sg.a);
        if (Math.abs(prev - cur) > 1e-9) s('line', { x1: Fm.X(sg.a), y1: Fm.Y(prev), x2: Fm.X(sg.a), y2: Fm.Y(cur), stroke: p.color, 'stroke-width': 2 }, Fm.g);
        if (i === b.segs.length - 1) { const e = val(sg, p.key, sg.b); if (Math.abs(e) > 1e-9) s('line', { x1: Fm.X(sg.b), y1: Fm.Y(e), x2: Fm.X(sg.b), y2: Fm.Y(0), stroke: p.color, 'stroke-width': 2 }, Fm.g); }
      });
      if (!opt.showP) return;
      const put = (x, v, anchor) => { if (Math.abs(v) < 1e-9) return; T(Fm.g, Fm.X(x) + (anchor === 'start' ? 3 : anchor === 'end' ? -3 : 0), Fm.Y(v) + (v > 0 ? -5 : 13), fmt(v), { anchor, color: p.color, size: 11 }); };
      const scale = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
      b.segs.forEach((sg, i) => {
        const va = val(sg, p.key, sg.a), vb = val(sg, p.key, sg.b), wide = Fm.X(sg.b) - Fm.X(sg.a) > 64;
        if (Math.abs(va - vb) < 1e-9 * scale) { put((sg.a + sg.b) / 2, va, 'middle'); return; }
        const prevB = i ? val(b.segs[i - 1], p.key, sg.a) : NaN, nextA = i < b.segs.length - 1 ? val(b.segs[i + 1], p.key, sg.b) : NaN;
        const contA = Math.abs(prevB - va) < 1e-9 * scale, contB = Math.abs(nextA - vb) < 1e-9 * scale;
        if (!contA) put(sg.a, va, wide ? 'start' : 'end');   // a jump: label the right-hand value here
        if (contB) put(sg.b, vb, 'middle'); else put(sg.b, vb, 'end');
      });
      if (p.key === 'M') {
        b.ext.zeros.filter((z) => z.kind === 'root' && Math.abs(z.M) > 1e-9).forEach((z) => {
          if (Math.abs(X(z.x) - X(g.cut.x)) < 90) { Charts.mark(Fm, z.x, z.M, null, { color: p.color }); return; }
          const right = Fm.X(z.x) > ml + pw * 0.7;
          Charts.mark(Fm, z.x, z.M, `${fmt(z.M)} at x = ${fmt(z.x)}`, { color: p.color, anchor: right ? 'end' : 'start', dx: right ? -7 : 7, dy: z.M > 0 ? -16 : 24 });
        });
      }
      if (p.key === 'V') b.ext.zeros.filter((z) => z.kind === 'root').forEach((z) => Charts.mark(Fm, z.x, 0, null, { color: p.color, r: 3.5 }));
    });

    /* --- the cut --- */
    const c = g.cut, xc = X(c.x), yEnd = 8 + topH + nP * ph + (nP - 1) * gap;
    const gc = s('g', {}, svg);
    if (g.cutMode) {
      // free-body diagram of the left segment: fade the right part and draw N, V, M on the cut face
      s('rect', { x: xc + 1, y: 0, width: Math.max(0, W - xc - 1), height: 8 + topH - 22, fill: '#fbfcfd', 'fill-opacity': 0.8 }, gc);
      const farR = xc > W - 200, lx = farR ? xc - 12 : xc + 62, an = farR ? 'end' : 'start', ly = farR ? 22 : yb - 34;
      if (c.N >= 0) arrow(gc, xc + 3, yb, xc + 40, yb, COL.axial, 2.6); else arrow(gc, xc + 40, yb, xc + 3, yb, COL.axial, 2.6);
      if (c.V >= 0) arrow(gc, xc + 12, yb - 4, xc + 12, yb + 38, COL.shear, 2.6); else arrow(gc, xc + 12, yb + 4, xc + 12, yb - 38, COL.shear, 2.6);
      arcArrow(gc, xc + 4, yb, 48, c.M >= 0 ? -55 : 55, c.M >= 0 ? 55 : -55, COL.moment, 2.4);
      T(gc, lx, ly, `N = ${fmt(c.N)} ${F}`, { anchor: an, color: COL.axial, size: 12.5, weight: 700 });
      T(gc, lx, ly + 16, `V = ${fmt(c.V)} ${F}`, { anchor: an, color: COL.shear, size: 12.5, weight: 700 });
      T(gc, lx, ly + 32, `M = ${fmt(c.M)} ${FL}`, { anchor: an, color: COL.moment, size: 12.5, weight: 700 });
    }
    s('line', { x1: xc, y1: 10, x2: xc, y2: yEnd, stroke: COL.accent, 'stroke-width': 1.8, 'stroke-dasharray': '6 4' }, gc);
    s('circle', { cx: xc, cy: 10, r: 6.5, fill: COL.accent, stroke: '#fff', 'stroke-width': 1.5 }, gc);
    const side = c.x > L * 0.75 ? 'end' : 'start', dx = side === 'end' ? -10 : 10;
    T(gc, xc + dx, 15, `cut at x = ${fmt(c.x)} ${Lu}` + (b.jumpAt(c.x) ? (c.side === 'L' ? ' (left side)' : ' (right side)') : ''), { anchor: side, color: COL.accent, size: 12, weight: 700 });
    frames.forEach(({ F: Fm, p, y, full }) => {
      if (p.key === 'D') { const v = full(c.x); Charts.mark(Fm, c.x, y(c.x), `EI·v = ${fmt(Math.abs(v) < 1e-9 * Math.abs(b.defl.max.y) ? 0 : v)} ${p.unit}`, { color: COL.accent, anchor: side, dx, dy: v > 0 ? -7 : 16, size: 12 }); return; }
      const v = c[p.key];
      Charts.mark(Fm, c.x, v, `${p.key} = ${fmt(v)} ${p.unit}`, { color: COL.accent, anchor: side, dx, dy: Fm.Y(v) - Fm.Y(Fm.y1) < 22 ? 16 : -7, size: 12 });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2D: cables                                                         */
  /* ------------------------------------------------------------------ */
  function cablePts(g) {
    if (g.kind === 'cableP') return g.pts.map((p) => [p.x, -p.sag]);
    const pts = []; for (let i = 0; i <= 80; i++) { const x = (g.L * i) / 80; pts.push([x, g.y(x)]); }
    return pts;
  }
  function drawCable2D(svg, res, U, opt) {
    const g = res.geo, { F, Lu } = g, L = g.L, pts = cablePts(g);
    const ys = pts.map((p) => p[1]), ymin = Math.min(...ys), ymax = Math.max(...ys), sagH = Math.max(ymax - ymin, L * 0.05);
    const D = UI.Draw2D(svg, { xmin: 0, xmax: L, ymin: ymin - sagH * 0.1, ymax }, { pad: 70, padT: 34, padB: 50 });
    svg._inv = null;
    const A = pts[0], B = pts[pts.length - 1], px = 1 / D.sc;
    // anchors
    [[A, -1], [B, 1]].forEach(([p, sg]) => {
      D.el('rect', { x: D.X(p[0]) + (sg < 0 ? -14 : 0), y: D.Y(p[1]) - 22, width: 14, height: 44, fill: '#dfe4e8', stroke: COL.support, 'stroke-width': 1.2 });
      D.dot(p, COL.support, null, { r: 4.5 });
    });
    D.text(A, 'A', { dx: -7, dy: 38, anchor: 'middle', size: 13, weight: 700 });
    D.text(B, g.kind === 'cableP' ? g.last : 'B', { dx: 7, dy: 38, anchor: 'middle', size: 13, weight: 700 });
    D.line([0, Math.max(A[1], B[1])], [L, Math.max(A[1], B[1])], { stroke: COL.dim, sw: 0.8, dash: '5 4', op: 0.6 });
    if (g.kind === 'cableU') {
      // deck hung from the cable, with the uniform load on it
      const yd = ymin - sagH * 0.22;
      for (let i = 1; i < 16; i++) { const x = (L * i) / 16; D.line([x, g.y(x)], [x, yd], { stroke: COL.support, sw: 1 }); }
      D.el('rect', { x: D.X(0), y: D.Y(yd), width: D.X(L) - D.X(0), height: 7, fill: COL.body, stroke: COL.bodyEdge, 'stroke-width': 1.2 });
      for (let i = 0; i <= 20; i++) { const x = (L * i) / 20; D.force([x, yd], [0, -1], 15, { color: COL.load, w: 1.2, head: 6 }); }
      D.lineP([D.X(0), D.Y(yd) - 15], [D.X(L), D.Y(yd) - 15], { stroke: COL.load, sw: 1.2 });
      if (opt.showP) D.text([L / 2, yd], `w₀ = ${fmt(g.w)} ${g.WL} along the horizontal`, { dy: 24, anchor: 'middle', color: COL.load });
    }
    D.pline(pts, { stroke: COL.cable, sw: 3 });
    if (g.kind === 'cableP') {
      g.pts.slice(1, -1).forEach((p) => {
        const q = [p.x, -p.sag];
        D.force([q[0], q[1] - 44 * px], [0, -1], 36, { color: COL.load, label: opt.showP ? `${fmt(p.P)} ${F}` : '', lp: 'head', ldx: 6, ldy: 4 });
        D.dot(q, COL.cable, p.name, { dx: -16, dy: -8 });
        if (opt.showP) D.dim([q[0], Math.max(A[1], q[1])], q, `${fmt(p.sag)} ${Lu}`, 0, { color: COL.dim, ldx: 5 });
      });
      if (opt.showP) g.segs.forEach((sg) => {
        const mx = (sg.a.x + sg.b.x) / 2, my = -(sg.a.sag + sg.b.sag) / 2;
        D.text([mx, my], `T = ${fmt(sg.T)} ${F}`, { dy: -9, anchor: sg.Vy > 0 ? 'start' : 'end', dx: sg.Vy > 0 ? 6 : -6, color: COL.tension, size: 12, weight: 700 });
      });
      D.force([A[0], A[1] + 46 * px], [0, 1], 34, { color: COL.react, label: opt.showP ? `A_y = ${fmt(g.Ay)} ${F}` : '', lp: 'head', ldx: 6, ldy: 2 });
      D.force([B[0], B[1] + 46 * px], [0, 1], 34, { color: COL.react, label: opt.showP ? `${g.last}_y = ${fmt(g.By)} ${F}` : '', lp: 'head', ldx: -6, ldy: 2, anchor: 'end' });
      D.force([A[0] - 52 * px, A[1]], [-1, 0], 34, { color: COL.react });
      D.force([B[0] + 52 * px, B[1]], [1, 0], 34, { color: COL.react });
      if (opt.showP) D.text([L / 2, Math.max(A[1], B[1])], `F_H = ${fmt(g.FH)} ${F} at both supports`, { dy: -8, anchor: 'middle', color: COL.react });
      let prev = 0;
      g.pts.slice(1).forEach((p) => { D.dim([prev, ymin - sagH * 0.1], [p.x, ymin - sagH * 0.1], `${fmt(p.x - prev)} ${Lu}`, -30, { color: COL.dim }); prev = p.x; });
    } else {
      const low = [g.xA, g.y(g.xA)];
      D.dot(low, COL.tension, null, { r: 4 });
      if (opt.showP) {
        D.text(low, `F_H = ${fmt(g.FH)} ${F}`, { dy: -9, dx: -10, anchor: 'end', color: COL.tension, size: 12.5, weight: 700 });
        D.dim([g.xA, A[1]], low, `${fmt(g.hA)} ${Lu}`, 0, { color: COL.dim, ldx: 5 });
        if (Math.abs(g.hA - g.hB) > 1e-9) D.dim([L * 0.92, B[1]], [L * 0.92, low[1]], `${fmt(g.hB)} ${Lu}`, 0, { color: COL.dim, ldx: 5 });
        D.dim([0, ymin - sagH * (g.kind === 'cableU' ? 0.22 : 0.1)], [L, ymin - sagH * (g.kind === 'cableU' ? 0.22 : 0.1)], `L = ${fmt(L)} ${Lu}`, g.kind === 'cableU' ? -44 : -40, { color: COL.dim });
        if (g.kind === 'catenary') D.text([L / 2, ymin], `w₀ = ${fmt(g.w)} ${g.WL} along the cable, length ${fmt(g.len)} ${Lu}`, { dy: 20, anchor: 'middle', color: COL.load });
      }
      // maximum tension, tangent to the cable at the higher support
      const atA = g.T(0) >= g.T(L), p = atA ? A : B, x0 = atA ? 0 : L, e = L * 1e-4;
      const sl = (g.y(x0 + (atA ? e : 0)) - g.y(x0 - (atA ? 0 : e))) / e, dir = atA ? [-1, -sl] : [1, sl], m = Math.hypot(dir[0], dir[1]);
      const tip = [p[0] + (dir[0] / m) * 44 * px, p[1] + (dir[1] / m) * 44 * px];
      D.arrow(p, tip, { color: COL.tension, w: 3, head: 12 });
      if (opt.showP) D.text(p, `T_max = ${fmt(g.Tmax)} ${F}`, { dy: -34, dx: atA ? -12 : 12, anchor: atA ? 'start' : 'end', color: COL.tension, size: 12.5, weight: 700 });
    }
  }
  M.draw2D = (svg, res, U, opt) => (res.geo.kind === 'beam' ? drawBeam2D : drawCable2D)(svg, res, U, opt);

  M.plot = function (svg, res) {
    const g = res.geo;
    if (g.kind === 'beam') return false;
    let pts = [], mark;
    if (g.kind === 'cableP') { g.segs.forEach((sg) => pts.push([sg.a.x, sg.T], [sg.b.x, sg.T])); const m = g.segs.reduce((a, b) => (b.T > a.T ? b : a)); mark = { x: (m.a.x + m.b.x) / 2, y: m.T }; }
    else { for (let i = 0; i <= 80; i++) { const x = (g.L * i) / 80; pts.push([x, g.T(x)]); } mark = g.T(0) >= g.T(g.L) ? { x: 0, y: g.T(0) } : { x: g.L, y: g.T(g.L) }; }
    return Charts.plot(svg, {
      xlabel: `x (${g.Lu})`, ylabel: `Tension T (${g.F})`,
      series: [{ pts, color: COL.tension, fill: COL.tension, fop: 0.12 }, { pts: [[0, g.FH], [g.L, g.FH]], color: COL.react, dash: '6 4', width: 1.6, name: 'F_H' }],
      marks: [Object.assign(mark, { label: `T_max = ${fmt(g.Tmax)} ${g.F}`, color: COL.tension, anchor: mark.x > g.L / 2 ? 'end' : 'start', dx: mark.x > g.L / 2 ? -8 : 8, dy: 14 })],
    });
  };

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  function arrow3(v, tail, tip, color, lw) {
    v.line([tail, tip], color, lw || 2.5);
    const d = [tip[0] - tail[0], tip[1] - tail[1], tip[2] - tail[2]], m = Math.hypot(d[0], d[1], d[2]) || 1, u = d.map((x) => x / m), hs = Math.min(m * 0.35, v._hs || 0.3);
    const n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
    const base = tip.map((x, i) => x - u[i] * hs);
    [[c, 1], [c, -1], [[0, 0, 1], 1], [[0, 0, 1], -1]].forEach(([w, sg]) => v.line([tip, base.map((x, i) => x + w[i] * sg * hs * 0.35)], color, lw || 2.5));
  }
  function drawBeam3D(v, res, U, opt) {
    const g = res.geo, b = g.beam, { F, FL } = g, L = b.L;
    const d = L / 22, w = L / 14, z0 = -w / 2, z1 = w / 2; v._hs = L / 28;
    const dOn = showDefl() && b.defl && !b.defl.flat, kD = S().play !== 'cut' ? defK() : 1;
    const dsc = dOn ? ((L * 0.07) / Math.abs(b.defl.max.y)) * kD : 0, dy = (x) => (dOn ? b.defl.y(x) * dsc : 0);
    // the beam is drawn as an I-beam; with the deflected shape on it is bent (exaggerated) and coloured
    // by the size of the deflection, from blue (none) to red (largest), like a contour plot
    const n = dOn ? 48 : 1, vmax = dOn ? Math.abs(b.defl.max.y) || 1 : 1, h2 = d / 2, b2 = w / 2, tf = d * 0.2, tw = w * 0.09;
    const prof = [[-h2, -b2], [-h2, b2], [-h2 + tf, b2], [-h2 + tf, tw], [h2 - tf, tw], [h2 - tf, b2], [h2, b2], [h2, -b2], [h2 - tf, -b2], [h2 - tf, -tw], [-h2 + tf, -tw], [-h2 + tf, -b2]];
    for (let i = 0; i < n; i++) {
      const xa = (L * i) / n, xb = (L * (i + 1)) / n, ya = dy(xa), yb2 = dy(xb), c = dOn ? root.Anim.contour((kD * Math.abs(b.defl.y((xa + xb) / 2))) / vmax) : '#b9c2cb';
      prof.forEach((p, k) => { const q = prof[(k + 1) % prof.length]; v.face([[xa, ya + p[0], p[1]], [xb, yb2 + p[0], p[1]], [xb, yb2 + q[0], q[1]], [xa, ya + q[0], q[1]]], c, 1, dOn ? null : '#4a5661', 0.6); });
    }
    [0, L].forEach((x) => v.face(prof.map((p) => [x, dy(x) + p[0], p[1]]), dOn ? root.Anim.contour((kD * Math.abs(b.defl.y(x))) / vmax) : '#b9c2cb', 1, '#4a5661'));
    if (dOn) {
      const cl = []; for (let i = 0; i <= 40; i++) { const x = (L * i) / 40; cl.push([x, dy(x) + h2, z1]); }
      v.line(cl, '#1d2733', 1.2);
      v.line([[0, 0, z1], [L, 0, z1]], '#6b7785', 1.2, [5, 4]);
      if (opt.showP) v.label([b.defl.max.x, dy(b.defl.max.x) + (b.defl.max.y > 0 ? d : -d), z1], `EI·v = ${fmt(b.defl.max.y)} ${F}·${g.Lu}³`, DCOL);
    }
    b.sups.forEach((sp) => {
      if (sp.type === 'fixed') { const x0 = sp.x > L - 1e-9 ? L : sp.x < 1e-9 ? -d * 1.2 : sp.x - d * 0.6; v.box(x0, -d * 2.4, z0 * 1.8, x0 + d * 1.2, d * 2.4, z1 * 1.8, '#8d98a3', 1, '#4a5661'); }
      else if (sp.type === 'pin') v.extrude([[sp.x, -d / 2], [sp.x - d * 1.1, -d * 2.3], [sp.x + d * 1.1, -d * 2.3]], z0, z1, '#7fb394', 1, '#3c6b50');
      else { const poly = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * 2 * Math.PI; poly.push([sp.x + d * 0.85 * Math.cos(a), -d / 2 - d * 0.9 + d * 0.85 * Math.sin(a)]); } v.extrude(poly, z0, z1, '#7fb394', 1, '#3c6b50'); }
      v.label([sp.x, -d * 2.6, z1], sp.label, '#1d2733');
    });
    const Pmax = Math.max(1e-12, ...b.acts.filter((a) => a.P !== undefined).map((a) => Math.abs(a.P)));
    const wmax = Math.max(1e-12, ...b.dists.map((q) => Math.max(Math.abs(q.w1), Math.abs(q.w2))));
    const hl = L / 7;
    b.dists.forEach((q) => {
      const sg = q.w1 < 0 || q.w2 < 0 ? -1 : 1, y0 = sg * d / 2, ha = sg * hl * 0.75 * Math.abs(q.w1) / wmax, hb2 = sg * hl * 0.75 * Math.abs(q.w2) / wmax;
      v.extrude([[q.x1, y0 + dy(q.x1)], [q.x1, y0 + ha + dy(q.x1)], [q.x2, y0 + hb2 + dy(q.x2)], [q.x2, y0 + dy(q.x2)]], z0, z1, '#c0392b', 0.22, '#c0392b');
      if (opt.showP) v.label([(q.x1 + q.x2) / 2, y0 + (ha + hb2) / 2 + sg * d * 0.4, 0], q.w1 === q.w2 ? `${fmt(Math.abs(q.w1))} ${g.F}/${g.Lu}` : `${fmt(Math.abs(q.w1))} → ${fmt(Math.abs(q.w2))} ${g.F}/${g.Lu}`, '#c0392b');
    });
    b.acts.forEach((a) => {
      if (a.Mz) { const pts = []; for (let i = 0; i <= 20; i++) { const t = (-50 + 280 * (i / 20)) * DEG; pts.push([a.x + d * 2 * Math.cos(t), d * 2 * Math.sin(t), z1 * 1.05]); } if (a.Mz < 0) pts.reverse(); v.line(pts, '#8e44ad', 2.5); arrow3(v, pts[18], pts[20], '#8e44ad'); if (opt.showP) v.label([a.x, d * 2.4, z1], `${fmt(Math.abs(a.Mz))} ${FL}`, '#8e44ad'); return; }
      const m = Math.hypot(a.Fx, a.Fy) || 1, len = hl * (0.6 + 0.4 * Math.abs(a.P) / Pmax), tip = [a.x, (a.Fy > 0 ? -d / 2 : d / 2) + dy(a.x), 0], tail = [a.x - (a.Fx / m) * len, tip[1] - (a.Fy / m) * len, 0];
      arrow3(v, tail, tip, '#c0392b', 3);
      if (opt.showP) v.label(tail, `${fmt(Math.abs(a.P))} ${F}`, '#c0392b');
    });
    b.reactions.forEach((R) => {
      if (R.Ry) { const y0 = -d * 2.6, y1 = y0 - hl * 0.7; if (R.Ry > 0) arrow3(v, [R.x, y1, 0], [R.x, y0, 0], '#1e7a45', 3); else arrow3(v, [R.x, y0, 0], [R.x, y1, 0], '#1e7a45', 3); if (opt.showP) v.label([R.x, y1, 0], `${R.label}_y = ${fmt(Math.abs(R.Ry))} ${F}`, '#1e7a45'); }
    });
    b.hinges.forEach((x) => v.circle(x, 0, 0, d * 0.5, '#1d2733', 2));
    // shear and moment diagrams as slabs below the beam
    const slab = (key, base, color, name) => {
      let mx = 1e-12; const val = (sg, x) => (key === 'V' ? sg.V(x) : sg.M(x));
      b.segs.forEach((sg) => { for (let i = 0; i <= 12; i++) mx = Math.max(mx, Math.abs(val(sg, sg.a + ((sg.b - sg.a) * i) / 12))); });
      const sc = (L * 0.13) / mx, zz = w * 0.18;
      b.segs.forEach((sg) => {
        const n = 14; let prev = null;
        for (let i = 0; i <= n; i++) {
          const x = sg.a + ((sg.b - sg.a) * i) / n, y = val(sg, x) * sc;
          if (prev) v.extrude([[prev[0], base], [prev[0], base + prev[1]], [x, base + y], [x, base]], -zz, zz, color, 0.55, null, { sideStroke: null });
          prev = [x, y];
        }
        const top = []; for (let i = 0; i <= n; i++) { const x = sg.a + ((sg.b - sg.a) * i) / n; top.push([x, base + val(sg, x) * sc, zz]); }
        v.line(top, color, 2);
      });
      v.line([[0, base, zz], [L, base, zz]], '#34495e', 1.2);
      v.label([-L * 0.1, base, zz], name, color);
      return sc;
    };
    slab('V', -L * 0.34, '#c0563a', `V (${F})`);
    const scM = slab('M', -L * 0.68, '#2f7fc1', `M (${FL})`);
    const e = b.ext.Mabs;
    if (opt.showP && Math.abs(e.M) > 1e-9) v.label([e.x, -L * 0.68 + e.M * scM, w * 0.18], `${fmt(e.M)} ${FL}`, '#2f7fc1');
    const c = g.cut;
    v.line([[c.x, hl + d, 0], [c.x, -L * 0.84, 0]], '#d4612a', 1.8, [6, 4]);
    if (opt.showP) v.label([c.x, hl + d, 0], `cut x = ${fmt(c.x)} ${g.Lu}`, '#d4612a');
    v.autoBounds();
  }
  function drawCable3D(v, res, U, opt) {
    const g = res.geo, { F } = g, L = g.L, pts = cablePts(g);
    const ys = pts.map((p) => p[1]), ymin = Math.min(...ys), ymax = Math.max(...ys), Hh = Math.max(ymax - ymin, L * 0.08);
    const t = L / 60, zc = g.kind === 'cableU' ? L / 12 : 0, yb = ymin - Hh * 0.45; v._hs = L / 30;
    const A = pts[0], B = pts[pts.length - 1];
    [[A, 0], [B, L]].forEach(([p, x]) => (zc ? [-zc, zc] : [0]).forEach((z) => v.box(x - t, yb, z - t, x + t, p[1] + t, z + t, '#8d98a3', 1, '#4a5661')));
    v.face([[-L * 0.06, yb, -zc - L * 0.08], [L * 1.06, yb, -zc - L * 0.08], [L * 1.06, yb, zc + L * 0.08], [-L * 0.06, yb, zc + L * 0.08]], '#dfe6ea', 0.8, '#b8c2c9', 1, -1);
    (zc ? [-zc, zc] : [0]).forEach((z) => v.line(pts.map((p) => [p[0], p[1], z]), '#2c3e50', 3.5));
    if (g.kind === 'cableU') {
      const yd = ymin - Hh * 0.2;
      v.box(0, yd - t * 0.8, -zc, L, yd, zc, '#b9c2cb', 1, '#4a5661');
      for (let i = 1; i < 16; i++) { const x = (L * i) / 16; [-zc, zc].forEach((z) => v.line([[x, g.y(x), z], [x, yd, z]], '#6b7785', 1)); }
      if (opt.showP) v.label([L / 2, yd, zc], `w₀ = ${fmt(g.w)} ${g.WL}`, '#c0392b');
    }
    if (g.kind === 'cableP') {
      g.pts.slice(1, -1).forEach((p) => {
        const y = -p.sag, len = Hh * 0.28;
        arrow3(v, [p.x, y, 0], [p.x, y - len, 0], '#c0392b', 3);
        v.box(p.x - t * 1.3, y - len - t * 2.6, -t * 1.3, p.x + t * 1.3, y - len, t * 1.3, '#d98b80', 1, '#a3281f');
        if (opt.showP) v.label([p.x, y - len - t * 2.6, t * 1.3], `${p.name}: ${fmt(p.P)} ${F}`, '#c0392b');
      });
      if (opt.showP) g.segs.forEach((sg) => v.label([(sg.a.x + sg.b.x) / 2, -(sg.a.sag + sg.b.sag) / 2, 0], `T = ${fmt(sg.T)} ${F}`, '#8e44ad'));
    } else if (opt.showP) {
      v.label([g.xA, g.y(g.xA), zc], `F_H = ${fmt(g.FH)} ${F}`, '#8e44ad');
      const atA = g.T(0) >= g.T(L); v.label([atA ? 0 : L, (atA ? A : B)[1] + t * 2, zc], `T_max = ${fmt(g.Tmax)} ${F}`, '#8e44ad');
    }
    v.autoBounds();
  }
  M.draw3D = (v, res, U, opt) => (res.geo.kind === 'beam' ? drawBeam3D : drawCable3D)(v, res, U, opt);

  /* ------------------------------------------------------------------ */
  /* Presets: complete snapshots merged over the defaults.              */
  /* "Test" presets carry the expected answer; `fails` marks a preset   */
  /* whose error message is the expected result.                        */
  /* ------------------------------------------------------------------ */
  const SS = (L) => [{ type: 'pin', x: 0 }, { type: 'roller', x: L }];
  const kMax = 'Maximum moment (most positive)', kMin = 'Minimum moment (most negative)';
  M.presets = [
    { name: 'Test: 5 kN at midspan of a 4 m shaft, M_max = 5 kN·m', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 4, supports: SS(4), loads: [{ kind: 'point', x: 2, P: 5, ang: 90 }], hinges: [], cut: 1, side: 'R' },
      expect: [{ k: kMax, v: 5 }, { k: 'Largest shear |V|', v: 2.5 }] },
    { name: 'Test: triangular load 0 to 6 kN/m on 9 m, M_max = 31.2 kN·m at x = 5.20 m', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 9, supports: SS(9), loads: [{ kind: 'dist', x1: 0, x2: 9, w1: 0, w2: 6 }], hinges: [], cut: 3, side: 'R' },
      expect: [{ k: kMax, v: 31.2 }, { k: '  located at x', v: 5.20 }, { k: 'Reaction A_y (↑ positive)', v: 9 }, { k: 'Reaction B_y (↑ positive)', v: 18 }] },
    { name: 'Test: cantilever with 2 kN at the tip and 1.5 kN/m, M at the wall = −11 kN·m', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 4, supports: [{ type: 'fixed', x: 4 }], loads: [{ kind: 'point', x: 0, P: 2, ang: 90 }, { kind: 'dist', x1: 2, x2: 4, w1: 1.5, w2: 1.5 }], hinges: [], cut: 2, side: 'R' },
      expect: [{ k: kMin, v: -11 }, { k: 'Largest shear |V|', v: 5 }, { k: 'Bending moment M at x = 2 m', v: -4 }] },
    { name: 'Test: overhanging beam with 4 kN/m on the overhang, M at B = −8 kN·m', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 6, supports: [{ type: 'pin', x: 0 }, { type: 'roller', x: 4 }], loads: [{ kind: 'dist', x1: 4, x2: 6, w1: 4, w2: 4 }], hinges: [], cut: 4, side: 'R' },
      expect: [{ k: kMin, v: -8 }, { k: 'Reaction A_y (↑ positive)', v: -2 }, { k: 'Reaction B_y (↑ positive)', v: 10 }, { k: 'Shear force V at x = 4 m', v: 8 }] },
    { name: 'Test (U.S.): 12 ft shaft, load rising to 120 lb/ft, M_max = 1109 lb·ft at x = 6.93 ft', units: 'US',
      state: { mode: 'diagrams', fu: 'lb', L: 12, supports: SS(12), loads: [{ kind: 'dist', x1: 0, x2: 12, w1: 0, w2: 120 }], hinges: [], cut: 6, side: 'R' },
      expect: [{ k: kMax, v: 1109 }, { k: '  located at x', v: 6.93 }, { k: 'Largest shear |V|', v: 480 }] },
    { name: 'Test: cut just right of a 6 kN force, V = −1 kN and M = 15 kN·m', units: 'SI',
      state: { mode: 'cut', fu: 'kN', L: 9, supports: SS(9), loads: [{ kind: 'point', x: 3, P: 6, ang: 90 }, { kind: 'couple', x: 9, M: 9, dir: 'ccw' }], hinges: [], cut: 3, side: 'R' },
      expect: [{ k: 'Shear force V at x = 3 m', v: -1 }, { k: 'Bending moment M at x = 3 m', v: 15 }, { k: 'Normal force N at x = 3 m', v: 0 }, { k: 'Reaction A_y (↑ positive)', v: 5 }] },
    { name: 'Test: cantilever under 1200 N/m falling to zero, at midlength V = 450 N and M = −225 N·m', units: 'SI',
      state: { mode: 'cut', fu: 'N', L: 3, supports: [{ type: 'fixed', x: 0 }], loads: [{ kind: 'dist', x1: 0, x2: 3, w1: 1200, w2: 0 }], hinges: [], cut: 1.5, side: 'R' },
      expect: [{ k: 'Shear force V at x = 1.5 m', v: 450 }, { k: 'Bending moment M at x = 1.5 m', v: -225 }] },
    { name: 'Inclined force: 10 kN at 60° gives a normal force diagram too', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 6, supports: SS(6), loads: [{ kind: 'point', x: 3, P: 10, ang: 60 }, { kind: 'dist', x1: 0, x2: 3, w1: 3, w2: 3 }], hinges: [], cut: 2, side: 'R' } },
    { name: 'Simply supported beam with a force, a couple and a uniform load', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 10, supports: SS(10), loads: [{ kind: 'point', x: 2, P: 20, ang: 90 }, { kind: 'couple', x: 5, M: 30, dir: 'cw' }, { kind: 'dist', x1: 5, x2: 10, w1: 6, w2: 6 }], hinges: [], cut: 7, side: 'R' } },
    { name: 'Compound beam: fixed end, internal hinge and a roller', units: 'SI',
      state: { mode: 'diagrams', fu: 'kN', L: 8, supports: [{ type: 'fixed', x: 0 }, { type: 'roller', x: 8 }], loads: [{ kind: 'point', x: 6, P: 12, ang: 90 }, { kind: 'dist', x1: 0, x2: 4, w1: 3, w2: 3 }], hinges: [4], cut: 4, side: 'R' },
      expect: [{ k: 'Reaction B_y (↑ positive)', v: 6 }, { k: 'Bending moment M at x = 4 m', v: 0 }] },
    { name: 'Fails on purpose: fixed end plus a roller is statically indeterminate', units: 'SI', fails: true,
      state: { mode: 'diagrams', fu: 'kN', L: 6, supports: [{ type: 'fixed', x: 0 }, { type: 'roller', x: 6 }], loads: [{ kind: 'dist', x1: 0, x2: 6, w1: 5, w2: 5 }], hinges: [], cut: 3, side: 'R' } },
    { name: 'Fails on purpose: a beam on one roller is unstable', units: 'SI', fails: true,
      state: { mode: 'diagrams', fu: 'kN', L: 6, supports: [{ type: 'roller', x: 2 }], loads: [{ kind: 'point', x: 5, P: 10, ang: 90 }], hinges: [], cut: 3, side: 'R' } },
    { name: 'Test: cable with loads of 4, 15 and 3 kN and a 12 m sag at C, T_BC = 10.2 kN', units: 'SI',
      state: { mode: 'cableP', fu: 'kN', cab: { span: 18, hB: 0, loads: [{ x: 3, P: 4 }, { x: 8, P: 15 }, { x: 16, P: 3 }], known: 'sag', at: 2, sag: 12, FH: 6 } },
      expect: [{ k: 'Tension T_BC', v: 10.2 }, { k: 'Horizontal force F_H', v: 6.33 }, { k: 'Reaction A_y', v: 12 }, { k: 'Reaction E_y', v: 10 }, { k: 'Angle of BC from horizontal', v: 51.6 }] },
    { name: 'Test: bridge cable, 100 m span, 10 m sag, 5 kN/m, T_max = 673.1 kN', units: 'SI',
      state: { mode: 'cableU', fu: 'kN', par: { L: 100, level: true, hA: 10, hB: 10, w0: 5, given: 'sag', Tmax: 700, len: 103 } },
      expect: [{ k: 'Maximum tension T_max', v: 673.1 }, { k: 'Horizontal force F_H (tension at the lowest point)', v: 625 }] },
    { name: 'Cable with supports at different levels: lowest point 4 m below A and 9 m below B', units: 'SI',
      state: { mode: 'cableU', fu: 'kN', par: { L: 30, level: false, hA: 4, hB: 9, w0: 2, given: 'sag', Tmax: 700, len: 103 } },
      expect: [{ k: 'Lowest point, distance from A', v: 12 }, { k: 'Horizontal force F_H (tension at the lowest point)', v: 36 }] },
    { name: 'Test: catenary, 5 N/m cable over 20 m with a 6 m sag, T_max = 75.9 N', units: 'SI',
      state: { mode: 'catenary', fu: 'N', cat: { L: 20, h: 6, w0: 5, given: 'sag', len: 24 } },
      expect: [{ k: 'Maximum tension T_max', v: 75.9 }, { k: 'Horizontal force F_H (tension at the lowest point)', v: 45.9 }, { k: 'Cable length', v: 24.2 }] },
    { name: 'Test: catenary between supports at different levels, lowest point 1.855 m below A and 5.431 m below B', units: 'SI',
      state: { mode: 'catenary', fu: 'N', cat: { L: 16, w0: 5, level: false, hA: 1.854652182, hB: 5.430806348, h: 6, given: 'sag', len: 24 } },
      expect: [{ k: 'Catenary constant F_H / w₀', v: 10 }, { k: 'Lowest point, distance from A', v: 6 }, { k: 'Horizontal force F_H (tension at the lowest point)', v: 50 }, { k: 'Maximum tension T_max', v: 77.154 }, { k: 'Cable length', v: 18.1186 }] },
    { name: 'Cable with point loads hung from supports at different levels', units: 'SI',
      state: { mode: 'cableP', fu: 'kN', cab: { span: 20, hB: 4, level: false, loads: [{ x: 5, P: 6 }, { x: 12, P: 8 }], known: 'sag', at: 1, sag: 5, FH: 6 } } },
  ];

  root.SInternal = M;
})(window);
