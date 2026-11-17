/* =====================================================================
 * STATICS · Centroids and Moments of Inertia (inputs, diagrams, presets)
 * Physics: st/section.js with shared/section.js and shared/mohr.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Section, SecMod } = root;
  const { fmt, tidy } = Core;
  const { COL } = UI;
  const DEG = Math.PI / 180;
  const PCOL = '#8e44ad', UCOL = COL.accent, CCOL = '#c0392b', FILL = '#c9d3dc', EDGE = '#4a5661';

  const M = { id: 'section', title: 'Centroids and Moments of Inertia', defaults: SecMod.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const KCOL = { rect: '#d5dbe1', tri: '#f9dcc0', circle: '#cfe8d8', semi: '#cfe8d8', quarter: '#cfe8d8', sector: '#cfe8d8', line: '#d5dbe1', arc: '#cfe8d8', cyl: '#d5dbe1', cone: '#f9dcc0', hemi: '#cfe8d8', block: '#e2cdef' };
  const HOLE = [['false', 'Solid'], ['true', 'Hole (subtract)']];
  const fixHole = (it) => { it.hole = it.hole === true || it.hole === 'true'; };
  const ROT = [[0, '0°'], [90, '90° ↺'], [180, '180°'], [270, '270° ↺']];
  const fixRot = (it) => { it.rot = +it.rot || 0; };
  function retypeArea(p) {
    const big = S().lu === 'mm' ? 100 : S().lu === 'in.' ? 4 : S().lu === 'ft' ? 1 : 0.1;
    if (!(p.b > 0)) p.b = big; if (!(p.h > 0)) p.h = big; if (!(p.r > 0)) p.r = big / 2; if (!(p.a > 0)) p.a = 45;
  }

  M.controls = function (c, C) {
    const st = S(), Lu = st.lu;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [
      ['area', 'Composite area: centroid and moments of inertia'], ['inclined', "Inclined axes and Mohr's circle (I_x, I_y, I_xy known)"],
      ['line', 'Composite wire: centroid'], ['volume', 'Composite body: centre of mass'], ['pappus', 'Pappus and Guldinus: surface and volume of revolution']] });
    C.seg(sec, { label: 'Length unit', get: () => st.lu, set: (v) => (st.lu = v), options: SecMod.LUS[M.units].map((u) => [u, u]) });

    if (st.mode === 'area') {
      const a = st.area;
      sec = C.section(c, 'Shape');
      C.select(sec, { label: 'Build the area from', get: () => a.shape, set: (v) => (a.shape = v), options: [['custom', 'Parts that I place', 'Any shape']].concat(Section.TEMPLATES.map(([k, n]) => [k, n, 'Standard sections'])) });
      if (a.shape === 'custom') {
        C.note(sec, 'Each part is placed by its anchor point (x, y): the lower-left corner of a rectangle, the right-angle corner of a triangle, the centre of a circle, the middle of the diameter of a semicircle, the centre of a quarter circle or the apex of a sector.');
        C.list(sec, {
          items: a.parts, max: 8, min: 1, color: (it) => (it.hole === true ? '#f6c9c2' : KCOL[it.kind]), title: (it, i) => `Part ${i + 1}: ${Section.NAME[it.kind]}${it.hole === true ? ' (hole)' : ''}`,
          fields: (it) => {
            const f = [{ key: 'kind', label: 'Shape', options: Section.KINDS, onset: retypeArea }, { key: 'hole', label: 'Solid or hole', options: HOLE, onset: fixHole }, { key: 'x', label: 'Anchor x', unit: Lu }, { key: 'y', label: 'Anchor y', unit: Lu }];
            if (it.kind === 'rect' || it.kind === 'tri') f.push({ key: 'b', label: 'Width b', unit: Lu }, { key: 'h', label: 'Height h', unit: Lu });
            else f.push({ key: 'r', label: 'Radius r', unit: Lu });
            if (it.kind === 'sector') f.push({ key: 'a', label: 'Half-angle α', unit: '°' });
            if (it.kind !== 'circle') f.push({ key: 'rot', label: 'Turned by', options: ROT, onset: fixRot, wide: it.kind !== 'sector' });
            return f;
          },
          add: [['Rectangle', () => ({ kind: 'rect', x: 0, y: 0, b: 1, h: 1, rot: 0, hole: false })], ['Triangle', () => ({ kind: 'tri', x: 0, y: 0, b: 1, h: 1, rot: 0, hole: false })], ['Circle', () => ({ kind: 'circle', x: 0, y: 0, r: 1, rot: 0, hole: false })]].map(([n, mk]) => [n, () => { const p = mk(); p.b = p.h = p.r = 0; retypeArea(p); return p; }]),
        });
      } else {
        Section.TDIMS[a.shape].forEach(([k, label]) => C.num(sec, { label, get: () => a.dims[k], set: (v) => (a.dims[k] = v), unit: Lu }));
        C.note(sec, 'The origin is at the lower-left corner of the box around the section.');
      }
      sec = C.section(c, 'Inclined axes');
      C.slider(sec, { label: 'Angle θ of the u axis (↺ from x)', min: -90, max: 90, step: 0.5, get: () => a.theta, set: (v) => (a.theta = v), unit: '°' });
    } else if (st.mode === 'inclined') {
      const q = st.inc, u4 = Lu + '⁴';
      sec = C.section(c, 'Known about the x and y axes');
      C.num(sec, { label: 'I_x', get: () => q.Ix, set: (v) => (q.Ix = v), unit: u4 });
      C.num(sec, { label: 'I_y', get: () => q.Iy, set: (v) => (q.Iy = v), unit: u4 });
      C.num(sec, { label: 'I_xy', get: () => q.Ixy, set: (v) => (q.Ixy = v), unit: u4 });
      sec = C.section(c, 'Inclined axes');
      C.slider(sec, { label: 'Angle θ of the u axis (↺ from x)', min: -90, max: 90, step: 0.5, get: () => q.theta, set: (v) => (q.theta = v), unit: '°' });
    } else if (st.mode === 'line') {
      sec = C.section(c, 'Segments');
      C.note(sec, 'A straight segment runs between two points in space. An arc lies in the x–y plane; its angles are measured counterclockwise from the +x direction at the arc centre.');
      C.list(sec, {
        items: st.line.segs, max: 8, min: 1, color: (it) => KCOL[it.kind], title: (it, i) => `Segment ${i + 1}: ${it.kind === 'arc' ? 'Circular arc' : 'Straight'}`,
        fields: (it) => {
          const f = [{ key: 'kind', label: 'Kind', options: [['line', 'Straight'], ['arc', 'Circular arc']], wide: true, onset: (g) => { if (g.kind === 'arc') Object.assign(g, { cx: g.cx || 0, cy: g.cy || 0, r: g.r > 0 ? g.r : 1, a1: g.a1 || 0, a2: g.a2 === undefined ? 90 : g.a2 }); else Object.assign(g, { x1: g.x1 || 0, y1: g.y1 || 0, z1: g.z1 || 0, x2: g.x2 === undefined ? 1 : g.x2, y2: g.y2 || 0, z2: g.z2 || 0 }); } }];
          if (it.kind === 'arc') f.push({ key: 'cx', label: 'Centre x', unit: Lu }, { key: 'cy', label: 'Centre y', unit: Lu }, { key: 'r', label: 'Radius r', unit: Lu, wide: true }, { key: 'a1', label: 'From angle', unit: '°' }, { key: 'a2', label: 'To angle', unit: '°' });
          else f.push({ key: 'x1', label: 'Start x', unit: Lu }, { key: 'x2', label: 'End x', unit: Lu }, { key: 'y1', label: 'Start y', unit: Lu }, { key: 'y2', label: 'End y', unit: Lu }, { key: 'z1', label: 'Start z', unit: Lu }, { key: 'z2', label: 'End z', unit: Lu });
          return f;
        },
        add: [['Straight', () => ({ kind: 'line', x1: 0, y1: 0, z1: 0, x2: 1, y2: 0, z2: 0 })], ['Arc', () => ({ kind: 'arc', cx: 0, cy: 0, r: 1, a1: 0, a2: 90 })]],
      });
    } else if (st.mode === 'volume') {
      const q = st.vol, us = M.units === 'US';
      sec = C.section(c, 'Parts');
      C.toggle(sec, { label: us ? 'Parts have different specific weights' : 'Parts have different densities', get: () => q.useRho, set: (v) => (q.useRho = v) });
      C.note(sec, 'Every part stands on the z axis direction: (x, y, z) is the centre of its base (the flat face of a hemisphere), and it extends up (+z) or down (−z) from there.');
      C.list(sec, {
        items: q.parts, max: 6, min: 1, color: (it) => (it.hole === true ? '#f6c9c2' : KCOL[it.kind]), title: (it, i) => `Part ${i + 1}: ${SecMod.VKIND.find((k) => k[0] === it.kind)[1]}${it.hole === true ? ' (hole)' : ''}`,
        fields: (it) => {
          const f = [{ key: 'kind', label: 'Shape', options: SecMod.VKIND, onset: (p) => { ['r', 'h', 'a', 'b'].forEach((k) => { if (!(p[k] > 0)) p[k] = Lu === 'mm' ? 50 : 1; }); } }, { key: 'hole', label: 'Solid or hole', options: HOLE, onset: fixHole },
            { key: 'x', label: 'Base x', unit: Lu }, { key: 'y', label: 'Base y', unit: Lu }, { key: 'z', label: 'Base z', unit: Lu }, { key: 'dir', label: 'Extends', options: [['up', 'Up (+z)'], ['down', 'Down (−z)']] }];
          if (it.kind === 'block') f.push({ key: 'a', label: 'Width a (along x)', unit: Lu }, { key: 'b', label: 'Depth b (along y)', unit: Lu }, { key: 'h', label: 'Height h', unit: Lu, wide: !q.useRho });
          else if (it.kind === 'hemi') f.push({ key: 'r', label: 'Radius r', unit: Lu, wide: !q.useRho });
          else f.push({ key: 'r', label: it.kind === 'cone' ? 'Base radius r' : 'Radius r', unit: Lu }, { key: 'h', label: 'Height h', unit: Lu, wide: q.useRho });
          if (q.useRho) f.push({ key: 'rho', label: us ? 'Specific weight γ' : 'Density ρ', unit: us ? 'lb/ft³' : 'Mg/m³', wide: it.kind === 'block' });
          return f;
        },
        add: [['Cylinder', 'cyl'], ['Cone', 'cone'], ['Hemisphere', 'hemi'], ['Block', 'block']].map(([n, k]) => [n, () => { const d = Lu === 'mm' ? 50 : 1; return { kind: k, x: 0, y: 0, z: 0, r: d, h: 2 * d, a: 2 * d, b: 2 * d, dir: 'up', rho: us ? 490 : 7.85, hole: false }; }]),
      });
    } else {
      const q = st.pap;
      sec = C.section(c, 'Generating shape');
      C.select(sec, { label: 'Shape that is revolved', get: () => q.kind, set: (v) => (q.kind = v), options: [['polygon', 'Polygon from its corner points'], ['circle', 'Circle away from the axis (torus)'], ['semicircle', 'Semicircle on the axis (sphere)']] });
      if (q.kind === 'polygon') {
        C.note(sec, 'Enter the corners in order around the shape. r is the distance from the axis of revolution (the z axis).');
        C.list(sec, { items: q.pts, max: 8, min: 3, title: (it, i) => `Point ${i + 1}`, fields: () => [{ key: 'r', label: 'r', unit: Lu }, { key: 'z', label: 'z', unit: Lu }], add: [['Point', () => { const l = q.pts[q.pts.length - 1]; return { r: l.r, z: tidy(l.z + (Lu === 'mm' ? 10 : 1)) }; }]] });
      } else {
        if (q.kind === 'circle') C.num(sec, { label: 'Centre distance R from the axis', get: () => q.R, set: (v) => (q.R = v), unit: Lu });
        C.num(sec, { label: 'Radius a', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
      }
      sec = C.section(c, 'Revolution');
      C.slider(sec, { label: 'Angle of revolution θ', min: 5, max: 360, step: 5, get: () => q.angle, set: (v) => { q.angle = v; delete st._k; }, unit: '°' });
    }
  };

  M.compute = (U) => SecMod.solve(S(), U);
  M.onUnits = (from, to) => SecMod.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ area: 'Area and axes', inclined: "Mohr's circle", line: 'Wire, x–y view', volume: 'Body, side view', pappus: 'Generating shape' }[mode()]);
  M.cap3D = '3D view';
  M.plotCaption = "Mohr's circle for the moments of inertia";
  M.hint = () => ({
    area: 'Drag anywhere on the diagram to turn the orange u axis about the centroid, or press Play to sweep it through 180°. The purple axes are the principal axes.',
    inclined: 'Drag on the circle to turn the u axis, or press Play. A rotation θ of the axes is a rotation 2θ on the circle, in the same direction.',
    line: 'The 2D diagram looks down the z axis. Use the 3D view to see segments that leave the x–y plane.',
    volume: 'The 2D diagram is the side view in the x–z plane. Holes are drawn dashed.',
    pappus: 'Press Play in the 3D view to watch the shape revolve about the z axis.',
  }[mode()]);
  M.legend = () => ({
    area: [[FILL, 'Area', 'sq'], [CCOL, 'Centroid C'], [PCOL, 'Principal axes', 'ln'], [UCOL, 'u and v axes', 'ln']],
    inclined: [['#2f7fc1', "Mohr's circle", 'ln'], [CCOL, 'Reference point A (x axis)'], [UCOL, 'u axis'], [PCOL, 'Principal values']],
    line: [[COL.cable, 'Wire', 'ln'], ['#2f7fc1', 'Centroid of each segment'], [CCOL, 'Centroid C']],
    volume: [[FILL, 'Solid', 'sq'], ['#2f7fc1', 'Centroid of each part'], [CCOL, 'Centre G']],
    pappus: [[FILL, 'Generating area', 'sq'], [COL.cable, 'Axis of revolution', 'ln'], [CCOL, 'Centroid C']],
  }[mode()]);

  /* Play turns the u axis through half a turn, or revolves the generating shape. */
  const thetaOf = () => (mode() === 'area' ? S().area : S().inc);
  const spin = {
    duration: 12, loop: false,
    frame(u) { thetaOf().theta = Math.round(-90 + u * 180); },
    label() { return `θ = ${fmt(thetaOf().theta)}°`; },
  };
  const revK = () => (S()._k === undefined ? 1 : S()._k);
  const revolve = {
    duration: 5, loop: false,
    frame(u) { S()._k = u <= 0 ? 1 : u; },
    label() { return `revolved ${fmt(tidy(S().pap.angle * revK(), 3))}°`; },
  };
  M.anim = () => (mode() === 'area' || mode() === 'inclined' ? spin : mode() === 'pappus' ? revolve : null);

  M.onDrag = function (p, phase, res) {
    const g = res.geo;
    let th;
    if (g.kind === 'area') th = Math.atan2(p[1] - g.sec.y, p[0] - g.sec.x) / DEG;
    else if (g.kind === 'inclined') { if (g.round) return false; th = (Math.atan2(p[1], p[0] - g.mohr.avg) - Math.atan2(g.Ixy, g.mohr.d)) / DEG / 2; }
    else return false;
    while (th > 90) th -= 180; while (th < -90) th += 180;
    th = Math.round(th);
    if (th === thetaOf().theta && phase !== 'down') return false;
    thetaOf().theta = th;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* Mohr's circle (plot panel for the area, main diagram for known I)  */
  /* ------------------------------------------------------------------ */
  function drawMohr(svg, g, opt) {
    const m = g.mohr, Ix = g.kind === 'area' ? g.sec.Ic.x : g.Ix, Ixy = g.kind === 'area' ? g.sec.Ic.xy : g.Ixy, u4 = g.Lu + '⁴';
    const lab = (name, v) => (opt.showP ? `${name} = ${fmt(v)}` : name);
    const pts = [];
    if (!g.round) {
      pts.push({ x: m.max, y: 0, label: lab('I_max', m.max), color: PCOL, anchor: 'start', dy: -8 }, { x: m.min, y: 0, label: lab('I_min', m.min), color: PCOL, anchor: 'end', dy: -8 });
      pts.push({ x: Ix, y: Ixy, label: opt.showP ? `A (${fmt(Ix)}, ${fmt(Ixy)})` : 'A (I_x, I_xy)', color: CCOL, spoke: true });
      pts.push({ x: g.at.Iu, y: g.at.Iuv, label: opt.showP ? `u (${fmt(g.at.Iu)}, ${fmt(g.at.Iuv)})` : 'u (I_u, I_uv)', color: UCOL, spoke: true });
      pts.push({ x: g.at.Iv, y: -g.at.Iuv, label: 'v', color: UCOL, spoke: true, dash: '4 3', r: 3.5 });
    } else pts.push({ x: m.avg, y: 0, label: lab('I', m.avg), color: PCOL });
    Charts.mohr(svg, { avg: m.avg, R: g.round ? 0 : m.R, xl: `I (${u4})`, yl: `I_xy (${u4})`, pts, arc: g.round ? null : { from: [Ix, Ixy], to: [g.at.Iu, g.at.Iuv], ccw: g.theta >= 0, label: `2θ = ${fmt(2 * g.theta)}°`, color: UCOL } });
    return true;
  }
  M.plot = (svg, res) => (res.geo.kind === 'area' ? drawMohr(svg, res.geo, { showP: root.App ? root.App.showP : true }) : false);

  /* ------------------------------------------------------------------ */
  /* 2D diagrams                                                        */
  /* ------------------------------------------------------------------ */
  function axisLine(D, c, ang, len, color, label, o) {
    o = o || {};
    const ux = Math.cos(ang * DEG), uy = Math.sin(ang * DEG);
    D.line([c[0] - ux * len * (o.back === undefined ? 1 : o.back), c[1] - uy * len * (o.back === undefined ? 1 : o.back)], [c[0] + ux * len, c[1] + uy * len], { stroke: color, sw: o.sw || 1.6, dash: o.dash });
    const hx = D.X(c[0] + ux * len), hy = D.Y(c[1] + uy * len);
    D.head(hx, hy, ux, -uy, color, 9);
    if (label) D.text([hx + ux * 10 - uy * 2, hy - uy * 10 + 4], label, { px: true, color, size: 12.5, weight: 700, anchor: ux < -0.3 ? 'end' : ux > 0.3 ? 'start' : 'middle' });
  }
  function drawArea2D(svg, res, U, opt) {
    const g = res.geo, sec = g.sec, b = sec.box, Lu = g.Lu;
    const w = b.xmax - b.xmin, h = b.ymax - b.ymin, ext = Math.max(w, h), mg = ext * 0.2;
    const bounds = { xmin: Math.min(b.xmin, 0) - mg, xmax: Math.max(b.xmax, 0) + mg, ymin: Math.min(b.ymin, 0) - mg, ymax: Math.max(b.ymax, 0) + mg };
    const D = UI.Draw2D(svg, bounds, { pad: 44 });
    sec.outlines.forEach((o) => { if (o.sign > 0) D.poly(o.pts, { fill: FILL, stroke: EDGE, sw: 1.5 }); });
    sec.outlines.forEach((o) => { if (o.sign < 0) D.poly(o.pts, { fill: '#fbfcfd', stroke: EDGE, sw: 1.3, dash: '5 3' }); });
    // given axes through the origin
    const ax = ext * 0.14;
    D.line([bounds.xmin + mg * 0.3, 0], [bounds.xmax - mg * 0.3, 0], { stroke: COL.dim, sw: 1.1 });
    D.line([0, bounds.ymin + mg * 0.3], [0, bounds.ymax - mg * 0.3], { stroke: COL.dim, sw: 1.1 });
    D.head(D.X(bounds.xmax - mg * 0.3), D.Y(0), 1, 0, COL.dim, 8); D.head(D.X(0), D.Y(bounds.ymax - mg * 0.3), 0, -1, COL.dim, 8);
    D.text([bounds.xmax - mg * 0.3, 0], 'x', { dx: 4, dy: 14, color: COL.dim, weight: 700 }); D.text([0, bounds.ymax - mg * 0.3], 'y', { dx: 7, dy: 4, color: COL.dim, weight: 700 });
    D.text([0, 0], 'O', { dx: -12, dy: 14, color: COL.dim, size: 11 });
    // part numbers
    sec.rows.forEach((r, i) => D.text([r.x, r.y], String(i + 1), { anchor: 'middle', dy: 4, size: 11, color: '#5a6b75', weight: 700 }));
    const C0 = [sec.x, sec.y], len = ext * 0.62;
    // centroidal axes
    D.line([sec.x - len, sec.y], [sec.x + len, sec.y], { stroke: CCOL, sw: 1, dash: '7 3 2 3' });
    D.line([sec.x, sec.y - len], [sec.x, sec.y + len], { stroke: CCOL, sw: 1, dash: '7 3 2 3' });
    D.text([sec.x + len, sec.y], 'x′', { dx: 4, dy: -4, color: CCOL, size: 11.5 }); D.text([sec.x, sec.y + len], 'y′', { dx: 5, dy: 2, color: CCOL, size: 11.5 });
    if (!g.round) {
      axisLine(D, C0, g.mohr.thp, len * 0.92, PCOL, 'I_max axis', { dash: '6 3' });
      axisLine(D, C0, g.mohr.thp + 90, len * 0.6, PCOL, 'I_min axis', { dash: '6 3' });
    }
    axisLine(D, C0, g.theta, len * 0.8, UCOL, 'u', { sw: 2.2 });
    axisLine(D, C0, g.theta + 90, len * 0.55, UCOL, 'v', { sw: 2.2, back: 0.4 });
    D.dot(C0, CCOL, opt.showP ? `C (${fmt(sec.x)}, ${fmt(sec.y)}) ${Lu}` : 'C', { dx: 9, dy: 16 });
    if (opt.showP) {
      if (Math.abs(sec.x) > ext * 0.04) D.dim([0, b.ymin], [sec.x, b.ymin], `x̄ = ${fmt(sec.x)}`, sec.x > 0 ? -18 : 18, { color: CCOL });
      if (Math.abs(sec.y) > ext * 0.04) D.dim([b.xmax, 0], [b.xmax, sec.y], `ȳ = ${fmt(sec.y)}`, sec.y > 0 ? -18 : 18, { color: CCOL });
      D.text([D.W - 10, 18], `θ = ${fmt(g.theta)}°   I_u = ${fmt(g.at.Iu)} ${Lu}⁴`, { px: true, anchor: 'end', color: UCOL, size: 12, weight: 700 });
    }
  }
  function drawLine2D(svg, res, U, opt) {
    const g = res.geo, Lu = g.Lu, paths = g.rows.map(segPts);
    const all = paths.flat().concat([[g.c[0], g.c[1], 0], [0, 0, 0]]);
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]), ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9), mg = ext * 0.16;
    const bounds = { xmin: Math.min(...xs) - mg, xmax: Math.max(...xs) + mg, ymin: Math.min(...ys) - mg, ymax: Math.max(...ys) + mg };
    const D = UI.Draw2D(svg, bounds, { pad: 46 });
    D.line([bounds.xmin, 0], [bounds.xmax, 0], { stroke: COL.dim, sw: 1 }); D.line([0, bounds.ymin], [0, bounds.ymax], { stroke: COL.dim, sw: 1 });
    D.head(D.X(bounds.xmax), D.Y(0), 1, 0, COL.dim, 8); D.head(D.X(0), D.Y(bounds.ymax), 0, -1, COL.dim, 8);
    D.text([bounds.xmax, 0], 'x', { dx: -4, dy: 15, color: COL.dim, weight: 700, anchor: 'end' }); D.text([0, bounds.ymax], 'y', { dx: 8, dy: 10, color: COL.dim, weight: 700 });
    paths.forEach((pts) => D.pline(pts, { stroke: COL.cable, sw: 4 }));
    g.rows.forEach((r, i) => {
      const flat = r.kind === 'line' && Math.hypot(r.g.x2 - r.g.x1, r.g.y2 - r.g.y1) < 1e-9;
      D.dot([r.x, r.y], '#2f7fc1', opt.showP ? `${i + 1}${flat ? ' (along z)' : ''}: L = ${fmt(r.L)}` : String(i + 1), { r: 4 });
    });
    D.dot([g.c[0], g.c[1]], CCOL, opt.showP ? `C (${fmt(g.c[0])}, ${fmt(g.c[1])}, ${fmt(g.c[2])}) ${Lu}` : 'C', { r: 6, dx: 10, dy: -8 });
  }
  function segPts(r) {
    if (r.kind === 'line') return [[+r.g.x1, +r.g.y1, +r.g.z1], [+r.g.x2, +r.g.y2, +r.g.z2]];
    const pts = [], n = 48;
    for (let i = 0; i <= n; i++) { const a = (+r.g.a1 + ((r.g.a2 - r.g.a1) * i) / n) * DEG; pts.push([+r.g.cx + r.g.r * Math.cos(a), +r.g.cy + r.g.r * Math.sin(a), 0]); }
    return pts;
  }
  /** Side-view outline (x, z) of one body part. */
  function sidePts(r) {
    const p = r.p, x = +p.x, z = +p.z, up = r.up, rr = +p.r, h = +p.h;
    if (p.kind === 'cyl') return [[x - rr, z], [x + rr, z], [x + rr, z + up * h], [x - rr, z + up * h]];
    if (p.kind === 'cone') return [[x - rr, z], [x + rr, z], [x, z + up * h]];
    if (p.kind === 'block') return [[x - p.a / 2, z], [x + p.a / 2, z], [x + p.a / 2, z + up * h], [x - p.a / 2, z + up * h]];
    const pts = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; pts.push([x + rr * Math.cos(a), z + up * rr * Math.sin(a)]); }
    return pts;
  }
  function drawVolume2D(svg, res, U, opt) {
    const g = res.geo, Lu = g.Lu, polys = g.rows.map(sidePts);
    const all = polys.flat().concat([[0, 0]]), xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
    const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)), mg = ext * 0.16;
    const bounds = { xmin: Math.min(...xs) - mg, xmax: Math.max(...xs) + mg * 1.6, ymin: Math.min(...zs) - mg, ymax: Math.max(...zs) + mg };
    const D = UI.Draw2D(svg, bounds, { pad: 46 });
    g.rows.forEach((r, i) => { if (r.sign > 0) D.poly(polys[i], { fill: FILL, stroke: EDGE, sw: 1.5 }); });
    g.rows.forEach((r, i) => { if (r.sign < 0) D.poly(polys[i], { fill: '#fbfcfd', fop: 0.75, stroke: EDGE, sw: 1.3, dash: '5 3' }); });
    D.line([bounds.xmin, 0], [bounds.xmax, 0], { stroke: COL.dim, sw: 1 }); D.line([0, bounds.ymin], [0, bounds.ymax], { stroke: COL.dim, sw: 1, dash: '9 3 2 3' });
    D.head(D.X(bounds.xmax), D.Y(0), 1, 0, COL.dim, 8); D.head(D.X(0), D.Y(bounds.ymax), 0, -1, COL.dim, 8);
    D.text([bounds.xmax, 0], 'x', { dx: -4, dy: 15, color: COL.dim, weight: 700, anchor: 'end' }); D.text([0, bounds.ymax], 'z', { dx: 8, dy: 10, color: COL.dim, weight: 700 });
    g.rows.forEach((r, i) => D.dot([r.x, r.z], '#2f7fc1', opt.showP ? `${i + 1}: z̃ = ${fmt(r.z)}` : String(i + 1), { r: 4, dx: 8, dy: 4 }));
    D.dot([g.c[0], g.c[2]], CCOL, opt.showP ? `G (${fmt(g.c[0])}, ${fmt(g.c[1])}, ${fmt(g.c[2])}) ${Lu}` : 'G', { r: 6.5, dx: -10, dy: -8, anchor: 'end' });
  }
  function drawPappus2D(svg, res, U, opt) {
    const g = res.geo, Lu = g.Lu, pf = g.profile;
    const rs = pf.map((p) => p[0]), zs = pf.map((p) => p[1]), rmax = Math.max(...rs), zmin = Math.min(...zs), zmax = Math.max(...zs);
    const ext = Math.max(2 * rmax, zmax - zmin), mg = ext * 0.14;
    const D = UI.Draw2D(svg, { xmin: -rmax - mg, xmax: rmax + mg, ymin: zmin - mg * 1.6, ymax: zmax + mg }, { pad: 46 });
    D.poly(pf.map(([r, z]) => [-r, z]), { fill: FILL, fop: 0.35, stroke: EDGE, sw: 1, dash: '5 3' });
    D.poly(pf, { fill: FILL, stroke: EDGE, sw: 1.6 });
    D.line([0, zmin - mg * 1.4], [0, zmax + mg * 0.8], { stroke: COL.cable, sw: 1.4, dash: '12 4 2 4' });
    D.head(D.X(0), D.Y(zmax + mg * 0.8), 0, -1, COL.cable, 8); D.text([0, zmax + mg * 0.8], 'z (axis of revolution)', { dx: 8, dy: 6, color: COL.cable, size: 11.5 });
    D.line([0, zmin - mg * 0.6], [rmax + mg * 0.8, zmin - mg * 0.6], { stroke: COL.dim, sw: 1 }); D.head(D.X(rmax + mg * 0.8), D.Y(zmin - mg * 0.6), 1, 0, COL.dim, 8);
    D.text([rmax + mg * 0.8, zmin - mg * 0.6], 'r', { dx: -2, dy: 15, color: COL.dim, weight: 700, anchor: 'end' });
    if (g.sub === 'polygon') pf.forEach((p, i) => D.dot(p, EDGE, String(i + 1), { r: 3, dx: 6, dy: -5 }));
    const zc = g.sub === 'polygon' ? Section.polyProps(pf).Sx / Section.polyProps(pf).A : 0, C0 = [g.rbarA, zc];
    D.dot(C0, CCOL, 'C', { r: 5.5, dx: 8, dy: -7 });
    if (opt.showP) D.dim([0, zc], C0, `r̄ = ${fmt(g.rbarA)} ${Lu}`, 0.001, { color: CCOL, ldy: 15 });
    if (opt.showP) D.text([D.W - 10, 18], `θ = ${fmt(g.ang)}°   A = ${fmt(g.A)} ${Lu}²`, { px: true, anchor: 'end', color: COL.ink, size: 12, weight: 700 });
  }
  M.draw2D = function (svg, res, U, opt) {
    const k = res.geo.kind;
    if (k === 'area') drawArea2D(svg, res, U, opt);
    else if (k === 'inclined') { Charts.clear(svg); drawMohr(svg, res.geo, opt); }
    else if (k === 'line') drawLine2D(svg, res, U, opt);
    else if (k === 'volume') drawVolume2D(svg, res, U, opt);
    else drawPappus2D(svg, res, U, opt);
  };

  /* ------------------------------------------------------------------ */
  /* 3D views (view axes: x right, y up, z toward the viewer)           */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    v.line([a, b], color, lw || 2);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map((x) => x / L), hs = L * 0.08;
    const n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
    const base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2));
  }
  function drawArea3D(v, res, U, opt) {
    const g = res.geo, sec = g.sec, b = sec.box, ext = Math.max(b.xmax - b.xmin, b.ymax - b.ymin), t = ext * 0.9;
    // the area as the end face of a prismatic member
    sec.outlines.forEach((o) => { if (o.sign > 0) v.extrude(o.pts, -t, 0, '#b9c2cb', 1, '#4a5661', { sideStroke: o.pts.length > 12 ? null : '#4a5661' }); });
    sec.outlines.forEach((o) => { if (o.sign < 0) v.face(o.pts.map((p) => [p[0], p[1], t * 0.002]), '#3d4852', 0.9, '#1d2733'); });
    const C0 = [sec.x, sec.y, t * 0.004], len = ext * 0.75;
    const ax = (ang, L, color, label, lw) => { const u = [Math.cos(ang * DEG), Math.sin(ang * DEG)]; arrow3(v, [C0[0] - u[0] * L * 0.6, C0[1] - u[1] * L * 0.6, C0[2]], [C0[0] + u[0] * L, C0[1] + u[1] * L, C0[2]], color, lw); v.label([C0[0] + u[0] * L * 1.08, C0[1] + u[1] * L * 1.08, C0[2]], label, color); };
    if (!g.round) { ax(g.mohr.thp, len, PCOL, opt.showP ? `I_max = ${fmt(g.mohr.max)}` : 'I_max', 2); ax(g.mohr.thp + 90, len * 0.7, PCOL, opt.showP ? `I_min = ${fmt(g.mohr.min)}` : 'I_min', 2); }
    ax(g.theta, len * 0.85, UCOL, 'u', 2.6); ax(g.theta + 90, len * 0.6, UCOL, 'v', 2.6);
    arrow3(v, [C0[0], C0[1], 0], [C0[0], C0[1], t * 0.45], CCOL, 2); v.label([C0[0], C0[1], t * 0.5], opt.showP ? `C (${fmt(sec.x)}, ${fmt(sec.y)})` : 'C', CCOL);
    v.autoBounds();
  }
  function drawInclined3D(v, res, U, opt) {
    const g = res.geo, R = 1, pts = [];
    for (let i = 0; i < 48; i++) pts.push([R * Math.cos((i / 48) * 2 * Math.PI), R * Math.sin((i / 48) * 2 * Math.PI)]);
    v.extrude(pts, -0.08, 0, '#c9d3dc', 1, '#4a5661', { sideStroke: null });
    const ax = (ang, L, color, label, lw) => { const u = [Math.cos(ang * DEG), Math.sin(ang * DEG)]; arrow3(v, [-u[0] * L * 0.7, -u[1] * L * 0.7, 0.01], [u[0] * L, u[1] * L, 0.01], color, lw); v.label([u[0] * L * 1.1, u[1] * L * 1.1, 0.01], label, color); };
    ax(0, 1.5, COL.dim, opt.showP ? `x: I_x = ${fmt(g.Ix)}` : 'x', 1.6); ax(90, 1.5, COL.dim, opt.showP ? `y: I_y = ${fmt(g.Iy)}` : 'y', 1.6);
    if (!g.round) { ax(g.mohr.thp, 1.35, PCOL, opt.showP ? `I_max = ${fmt(g.mohr.max)}` : 'I_max', 2); ax(g.mohr.thp + 90, 1.1, PCOL, opt.showP ? `I_min = ${fmt(g.mohr.min)}` : 'I_min', 2); }
    ax(g.theta, 1.25, UCOL, opt.showP ? `u: I_u = ${fmt(g.at.Iu)}` : 'u', 2.6); ax(g.theta + 90, 1, UCOL, opt.showP ? `v: I_v = ${fmt(g.at.Iv)}` : 'v', 2.6);
    v.autoBounds();
  }
  function axes3(v, L, names) {
    // book axes (x, y, z) are drawn as view (x, z, y) when z is the vertical axis
    arrow3(v, [0, 0, 0], [L, 0, 0], COL.dim, 1.4); v.label([L * 1.06, 0, 0], names[0], COL.dim);
    arrow3(v, [0, 0, 0], [0, L, 0], COL.dim, 1.4); v.label([0, L * 1.06, 0], names[1], COL.dim);
    arrow3(v, [0, 0, 0], [0, 0, L], COL.dim, 1.4); v.label([0, 0, L * 1.06], names[2], COL.dim);
  }
  function drawLine3D(v, res, U, opt) {
    const g = res.geo, paths = g.rows.map(segPts), all = paths.flat();
    const ext = Math.max(...[0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]), 0) - Math.min(...all.map((p) => p[k]), 0)), 1e-9);
    axes3(v, ext * 0.55, ['x', 'y', 'z']);
    paths.forEach((pts) => v.line(pts, '#2c3e50', 4.5));
    g.rows.forEach((r, i) => { v.circle(r.x, r.y, r.z, ext * 0.012, '#2f7fc1', 3, 12); v.label([r.x, r.y, r.z], opt.showP ? `${i + 1}: L = ${fmt(r.L)}` : String(i + 1), '#2f7fc1'); });
    v.circle(g.c[0], g.c[1], g.c[2], ext * 0.02, CCOL, 4, 16);
    v.line([[g.c[0], 0, g.c[2]], g.c], CCOL, 1.2, [4, 3]); v.line([[g.c[0], 0, 0], [g.c[0], 0, g.c[2]]], CCOL, 1.2, [4, 3]);
    v.label(g.c, opt.showP ? `C (${fmt(g.c[0])}, ${fmt(g.c[1])}, ${fmt(g.c[2])})` : 'C', CCOL);
    v.autoBounds();
  }
  function drawVolume3D(v, res, U, opt) {
    const g = res.geo; let ext = 0;
    const paint = (r, hole) => {
      const p = r.p, col = hole ? '#5d6975' : { cyl: '#b9c2cb', cone: '#e3c9a4', hemi: '#a9cdb8', block: '#cdbbe0' }[p.kind], al = hole ? 0.55 : opt._solid, z = +p.z, up = r.up, rr = +p.r, h = +p.h, x = +p.x, y = -p.y;
      ext = Math.max(ext, Math.abs(z) + (p.kind === 'hemi' ? rr : h), Math.abs(x) + (p.kind === 'block' ? p.a / 2 : rr));
      if (p.kind === 'block') { v.box(x - p.a / 2, Math.min(z, z + up * h), y - p.b / 2, x + p.a / 2, Math.max(z, z + up * h), y + p.b / 2, col, al, '#4a5661'); return; }
      let prof;
      if (p.kind === 'cyl') prof = [[0, z], [rr, z], [rr, z + up * h], [0, z + up * h]];
      else if (p.kind === 'cone') prof = [[0, z], [rr, z], [0, z + up * h]];
      else { prof = [[0, z]]; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; prof.push([rr * Math.cos(a), z + up * rr * Math.sin(a)]); } }
      v.lathe(prof, col, al, null, 32, x, y, { open: true });
      v.circle(x, z, y, rr, '#4a5661', 1.2);
      if (p.kind === 'cyl') v.circle(x, z + up * h, y, rr, '#4a5661', 1.2);
    };
    const anyHole = g.rows.some((r) => r.sign < 0); opt = Object.assign({ _solid: anyHole ? 0.55 : 1 }, opt);
    g.rows.forEach((r) => { if (r.sign < 0) paint(r, true); });
    g.rows.forEach((r) => { if (r.sign > 0) paint(r, false); });
    arrow3(v, [0, 0, 0], [ext * 0.9, 0, 0], COL.dim, 1.3); v.label([ext * 0.95, 0, 0], 'x', COL.dim);
    arrow3(v, [0, -ext * 0.2, 0], [0, ext * 1.25, 0], COL.dim, 1.3); v.label([0, ext * 1.3, 0], 'z', COL.dim);
    arrow3(v, [0, 0, 0], [0, 0, -ext * 0.9], COL.dim, 1.3); v.label([0, 0, -ext * 0.95], 'y', COL.dim);
    const G = [g.c[0], g.c[2], -g.c[1]];
    v.circle(G[0], G[1], G[2], ext * 0.03, CCOL, 4, 16);
    v.label(G, opt.showP ? `G: z̄ = ${fmt(g.c[2])} ${g.Lu}` : 'G', CCOL);
    v.autoBounds();
  }
  function drawPappus3D(v, res, U, opt) {
    const g = res.geo, pf = g.profile, k = revK(), ang = g.ang * k * DEG, n = pf.length;
    const seg = Math.max(2, Math.round((ang / (2 * Math.PI)) * 40)), full = g.ang * k >= 360 - 1e-9;
    const P = (r, z, t) => [r * Math.cos(t), z, -r * Math.sin(t)];
    for (let j = 0; j < seg; j++) {
      const t0 = (ang * j) / seg, t1 = (ang * (j + 1)) / seg;
      for (let i = 0; i < n; i++) {
        const a = pf[i], b = pf[(i + 1) % n];
        if (a[0] < 1e-9 && b[0] < 1e-9) continue;
        v.face([P(a[0], a[1], t0), P(b[0], b[1], t0), P(b[0], b[1], t1), P(a[0], a[1], t1)], '#b9c2cb', 1, null);
      }
    }
    if (!full) { v.face(pf.map(([r, z]) => P(r, z, 0)), '#d98b80', 1, '#a3281f'); v.face(pf.map(([r, z]) => P(r, z, ang)), '#d98b80', 1, '#a3281f'); }
    const rmax = Math.max(...pf.map((p) => p[0])), zs = pf.map((p) => p[1]), z0 = Math.min(...zs), z1 = Math.max(...zs), hh = Math.max(z1 - z0, rmax);
    v.line([[0, z0 - hh * 0.25, 0], [0, z1 + hh * 0.35, 0]], '#2c3e50', 1.4, [10, 4, 2, 4]); v.label([0, z1 + hh * 0.4, 0], 'z', '#2c3e50');
    // path of the centroid
    const zc = g.sub === 'polygon' ? Section.polyProps(pf).Sx / Section.polyProps(pf).A : 0, path = [];
    for (let i = 0; i <= 48; i++) path.push(P(g.rbarA, zc, (ang * i) / 48));
    v.line(path, CCOL, 2, [5, 3]);
    if (opt.showP) v.label(P(g.rbarA, zc, ang), `C travels θ r̄ = ${fmt(ang * g.rbarA)} ${g.Lu}`, CCOL);
    v.setBounds([-rmax, z0 - hh * 0.25, -rmax], [rmax, z1 + hh * 0.4, rmax]);
  }
  M.draw3D = function (v, res, U, opt) {
    const k = res.geo.kind;
    (k === 'area' ? drawArea3D : k === 'inclined' ? drawInclined3D : k === 'line' ? drawLine3D : k === 'volume' ? drawVolume3D : drawPappus3D)(v, res, U, opt);
  };

  /* ------------------------------------------------------------------ */
  /* Presets (each one is a complete snapshot)                          */
  /* ------------------------------------------------------------------ */
  const R = (x, y, b, h, hole) => ({ kind: 'rect', x, y, b, h, rot: 0, hole: !!hole });
  const ZSEC = [R(-300, 50, 100, 300), R(-300, -50, 600, 100), R(200, -350, 100, 300)];
  const kIx = 'Ī_x about the centroidal x′ axis', kIy = 'Ī_y about the centroidal y′ axis', kMax = 'Maximum principal moment of inertia I_max', kMin = 'Minimum principal moment of inertia I_min';
  M.presets = [
    { name: 'Test: Z section, Ī_x = 2.90(10⁹) mm⁴, I_max = 7.54(10⁹) mm⁴ at 57.1°', units: 'SI',
      state: { mode: 'area', lu: 'mm', area: { shape: 'custom', theta: 30, parts: ZSEC } },
      expect: [{ k: kIx, v: 2.90e9 }, { k: kIy, v: 5.60e9 }, { k: 'Product of inertia Ī_xy (centroidal)', v: -3.00e9 }, { k: kMax, v: 7.54e9 }, { k: kMin, v: 0.960e9 }, { k: 'Angle to the I_max axis θ_p1 (↺ from x)', v: 57.1 }] },
    { name: 'Test: 100 × 150 mm rectangle with a 25 mm radius hole, I_x = 101(10⁶) mm⁴ about the base', units: 'SI',
      state: { mode: 'area', lu: 'mm', area: { shape: 'custom', theta: 0, parts: [R(0, 0, 100, 150), { kind: 'circle', x: 50, y: 75, r: 25, rot: 0, hole: true }] } },
      expect: [{ k: 'I_x about the given x axis', v: 101e6 }] },
    { name: 'Test: plate with a triangle and a cut-out, x̄ = −0.348 ft, ȳ = 1.22 ft', units: 'US',
      state: { mode: 'area', lu: 'ft', area: { shape: 'custom', theta: 0, parts: [{ kind: 'tri', x: 0, y: 0, b: 3, h: 3, rot: 0, hole: false }, R(-3, 0, 3, 3), R(-3, 1, 1, 2, true)] } },
      expect: [{ k: 'Centroid x̄', v: -0.348 }, { k: 'Centroid ȳ', v: 1.22 }] },
    { name: 'T section 150 × 200 mm: centroid and section moduli', units: 'SI',
      state: { mode: 'area', lu: 'mm', area: { shape: 'T', theta: 0, dims: { bf: 150, d: 200, tf: 20, tw: 20 } } } },
    { name: 'Wide-flange section 8 × 12 in.', units: 'US',
      state: { mode: 'area', lu: 'in.', area: { shape: 'I', theta: 0, dims: { bf: 8, d: 12, tf: 0.75, tw: 0.5 } } } },
    { name: 'Angle 150 × 100 × 12 mm: principal axes are inclined', units: 'SI',
      state: { mode: 'area', lu: 'mm', area: { shape: 'L', theta: 20, dims: { bf: 100, d: 150, tf: 12, tw: 12 } } } },
    { name: 'Rectangle with a semicircular top and a round hole', units: 'SI',
      state: { mode: 'area', lu: 'mm', area: { shape: 'custom', theta: 45, parts: [R(0, 0, 120, 100), { kind: 'semi', x: 60, y: 100, r: 60, rot: 0, hole: false }, { kind: 'circle', x: 60, y: 100, r: 30, rot: 0, hole: true }] } } },
    { name: "Test: Mohr's circle from I_x = 2.90, I_y = 5.60, I_xy = −3.00 (10⁹) mm⁴, I_max = 7.54(10⁹) mm⁴", units: 'SI',
      state: { mode: 'inclined', lu: 'mm', inc: { Ix: 2.9e9, Iy: 5.6e9, Ixy: -3e9, theta: 40 } },
      expect: [{ k: kMax, v: 7.54e9 }, { k: kMin, v: 0.960e9 }, { k: 'Angle to the I_max axis θ_p1 (↺ from x)', v: 57.1 }] },
    { name: 'Test: bent wire with a semicircle, x̄ = 45.5 mm, ȳ = −22.5 mm, z̄ = −0.805 mm', units: 'SI',
      state: { mode: 'line', lu: 'mm', line: { segs: [{ kind: 'arc', cx: 60, cy: 0, r: 60, a1: 180, a2: 360 }, { kind: 'line', x1: 0, y1: 0, z1: 0, x2: 0, y2: 40, z2: 0 }, { kind: 'line', x1: 0, y1: 40, z1: 0, x2: 0, y2: 40, z2: -20 }] } },
      expect: [{ k: 'Centroid x̄', v: 45.5 }, { k: 'Centroid ȳ', v: -22.5 }, { k: 'Centroid z̄', v: -0.805 }] },
    { name: 'Test: cone frustum (8 Mg/m³) with a hole on a hemisphere (4 Mg/m³), z̄ = 14.6 mm', units: 'SI',
      state: { mode: 'volume', lu: 'mm', vol: { useRho: true, parts: [
        { kind: 'cone', x: 0, y: 0, z: 0, r: 50, h: 200, a: 50, b: 50, dir: 'up', rho: 8, hole: false }, { kind: 'hemi', x: 0, y: 0, z: 0, r: 50, h: 50, a: 50, b: 50, dir: 'down', rho: 4, hole: false },
        { kind: 'cone', x: 0, y: 0, z: 100, r: 25, h: 100, a: 50, b: 50, dir: 'up', rho: 8, hole: true }, { kind: 'cyl', x: 0, y: 0, z: 0, r: 25, h: 100, a: 50, b: 50, dir: 'up', rho: 8, hole: true }] } },
      expect: [{ k: 'Centre of mass z̄', v: 14.6 }, { k: 'Total mass m', v: 3.142 }] },
    { name: 'Block with a cylinder on top (same material)', units: 'SI',
      state: { mode: 'volume', lu: 'mm', vol: { useRho: false, parts: [{ kind: 'block', x: 0, y: 0, z: 0, r: 30, h: 40, a: 160, b: 100, dir: 'up', rho: 7.85, hole: false }, { kind: 'cyl', x: 40, y: 0, z: 40, r: 30, h: 80, a: 50, b: 50, dir: 'up', rho: 7.85, hole: false }] } } },
    { name: 'Test: solid of revolution, surface = 143 in², volume = 47.6 in³', units: 'US',
      state: { mode: 'pappus', lu: 'in.', pap: { kind: 'polygon', angle: 360, pts: [{ r: 2.5, z: 0 }, { r: 3.5, z: 0 }, { r: 3.5, z: 3 }, { r: 2.5, z: 2 }], R: 3, a: 1 } },
      expect: [{ k: 'Surface area of revolution', v: 143 }, { k: 'Volume of revolution', v: 47.6 }] },
    { name: 'Test: sphere of radius 2 m from a semicircle, A = 4πR² = 50.27 m², V = 33.51 m³', units: 'SI',
      state: { mode: 'pappus', lu: 'm', pap: { kind: 'semicircle', angle: 360, a: 2, R: 0, pts: [{ r: 0, z: 0 }, { r: 1, z: 0 }, { r: 0, z: 1 }] } },
      expect: [{ k: 'Surface area of revolution', v: 50.27 }, { k: 'Volume of revolution', v: 33.51 }] },
    { name: 'Three-quarter ring (torus) revolved through 270°', units: 'SI',
      state: { mode: 'pappus', lu: 'mm', pap: { kind: 'circle', angle: 270, a: 20, R: 60, pts: [{ r: 0, z: 0 }, { r: 1, z: 0 }, { r: 0, z: 1 }] } } },
    { name: 'Not valid: the hole is larger than the plate (no area left)', units: 'SI', fails: true,
      state: { mode: 'area', lu: 'mm', area: { shape: 'custom', theta: 0, parts: [R(0, 0, 100, 100), { kind: 'circle', x: 50, y: 50, r: 60, rot: 0, hole: true }] } } },
  ];

  root.SSection = M;
})(window);
