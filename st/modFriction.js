/* =====================================================================
 * STATICS · Friction (inputs, free-body diagrams, presets)
 * Physics: st/friction.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Friction } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const RCOL = COL.react, LCOL = COL.load, FCOL = '#8e44ad', CONE = '#e67e22';

  const M = { id: 'friction', title: 'Friction', defaults: Friction.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const massU = () => (M.units === 'US' ? 'slug' : 'kg');
  function weightIn(sec, C, o, F, label, by, mk, wk) {
    by = by || 'wBy'; mk = mk || 'm'; wk = wk || 'W';
    C.seg(sec, { label: `${label} given as`, get: () => o[by], set: (v) => (o[by] = v), options: [['mass', 'Mass'], ['force', 'Weight']] });
    if (o[by] === 'mass') C.num(sec, { label: `${label}: mass`, get: () => o[mk], set: (v) => (o[mk] = v), unit: massU() });
    else C.num(sec, { label: `${label}: weight`, get: () => o[wk], set: (v) => (o[wk] = v), unit: F });
  }
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, Ls = U.lenS, F = st.fu;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [['block', 'Block on a floor or slope: slip or tip'], ['incline', 'Block sliding on an incline'], ['ladder', 'Ladder against a wall'], ['wedge', 'Wedge'], ['screw', 'Square-threaded screw'], ['belt', 'Flat belt or rope over drums'], ['vehicle', 'Vehicle on wheels (car, truck, cart)'], ['bearing', 'Bearings and rolling resistance']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (st.mode === 'block') {
      const q = st.bk;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['check', 'Does it move under P?'], ['findP', 'P that starts motion']] });
      sec = C.section(c, 'Block');
      weightIn(sec, C, q, F, 'Block');
      C.num(sec, { label: 'Width of the base b', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Height (G at half height)', get: () => q.H, set: (v) => (q.H = v), unit: Lu });
      C.num(sec, { label: 'Slope angle (0 = level floor)', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      sec = C.section(c, 'Force P on the left face');
      if (q.task === 'check') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
      C.num(sec, { label: 'Angle from the surface (+ away from it)', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
      C.num(sec, { label: 'Height above the base', get: () => q.hP, set: (v) => (q.hP = v), unit: Lu });
    } else if (st.mode === 'incline') {
      const q = st.ic;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['release', 'Does it slide?'], ['hold', 'Force to hold'], ['up', 'Force to push up'], ['mu', 'μs for impending motion']] });
      sec = C.section(c, 'Block and slope');
      weightIn(sec, C, q, F, 'Block');
      C.num(sec, { label: 'Slope angle φ', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      if (q.task !== 'mu') {
        C.num(sec, { label: 'Static friction μs', get: () => q.mus, set: (v) => (q.mus = v), unit: '' });
        C.num(sec, { label: 'Kinetic friction μk (while sliding)', get: () => q.muk, set: (v) => (q.muk = v), unit: '' });
      }
      if (q.task === 'release') C.num(sec, { label: 'Distance it slides d', get: () => q.d, set: (v) => (q.d = v), unit: Lu });
      else {
        sec = C.section(c, 'Force P');
        if (q.task === 'mu') C.num(sec, { label: 'P (0 = no force)', get: () => q.P, set: (v) => (q.P = v), unit: F });
        C.num(sec, { label: 'Angle from the slope (+ away from it)', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
        if (q.task === 'up') C.num(sec, { label: 'Acceleration up the slope (0 = steady speed)', get: () => q.acc, set: (v) => (q.acc = v), unit: U.acc });
      }
    } else if (st.mode === 'ladder') {
      const q = st.ld;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['minAngle', 'Smallest angle'], ['check', 'Friction needed at an angle']] });
      sec = C.section(c, 'Ladder');
      weightIn(sec, C, q, F, 'Ladder');
      C.num(sec, { label: 'Length L', get: () => q.L, set: (v) => (q.L = v), unit: Lu });
      if (q.task === 'check') C.num(sec, { label: 'Angle with the floor θ', get: () => q.th, set: (v) => (q.th = v), unit: '°' });
      C.num(sec, { label: 'μs at the floor (A)', get: () => q.muA, set: (v) => (q.muA = v), unit: '' });
      C.num(sec, { label: 'μs at the wall (B), 0 = smooth', get: () => q.muB, set: (v) => (q.muB = v), unit: '' });
      sec = C.section(c, 'Person on the ladder');
      C.toggle(sec, { label: 'Someone stands on the ladder', get: () => !!q.person, set: (v) => (q.person = v) });
      if (q.person) { weightIn(sec, C, q, F, 'Person', 'wpBy', 'mp', 'Wp'); C.num(sec, { label: 'Distance up the ladder from A', get: () => q.s, set: (v) => (q.s = v), unit: Lu }); }
    } else if (st.mode === 'wedge') {
      const q = st.wd;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Push to raise'], ['lower', 'Pull to remove']] });
      sec = C.section(c, 'Load on the wedge');
      C.seg(sec, { label: 'The wedge lifts', get: () => q.load, set: (v) => (q.load = v), options: [['lever', 'A lever pinned at A'], ['guide', 'A block in a guide']] });
      weightIn(sec, C, q, F, 'Load');
      if (q.load === 'lever') {
        C.num(sec, { label: 'Wedge contact B from the pin A', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
        C.num(sec, { label: 'Weight from the pin A', get: () => q.xW, set: (v) => (q.xW = v), unit: Lu });
      } else C.num(sec, { label: 'μs at the guide', get: () => q.muG, set: (v) => (q.muG = v), unit: '' });
      sec = C.section(c, 'Wedge');
      C.num(sec, { label: 'Wedge angle α', get: () => q.al, set: (v) => (q.al = v), unit: '°' });
      C.num(sec, { label: 'μs between wedge and load (B)', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.num(sec, { label: 'μs between wedge and floor (C)', get: () => q.muC, set: (v) => (q.muC = v), unit: '' });
    } else if (st.mode === 'screw') {
      const q = st.sc;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Moment to raise'], ['lower', 'Moment to lower or hold']] });
      sec = C.section(c, 'Screw');
      C.num(sec, { label: 'Axial load W', get: () => q.W, set: (v) => (q.W = v), unit: F });
      C.num(sec, { label: 'Mean radius r', get: () => q.r, set: (v) => (q.r = v), unit: Ls });
      C.num(sec, { label: 'Lead l (advance per turn)', get: () => q.l, set: (v) => (q.l = v), unit: Ls });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.seg(sec, { label: 'Screws turned together', get: () => String(q.n), set: (v) => (q.n = +v), options: [['1', 'One'], ['2', 'Two (turnbuckle)']] });
    } else if (st.mode === 'bearing') {
      const q = st.be, FL = `${F}·${Lu}`;
      C.select(sec, { label: 'Bearing', get: () => q.kind, set: (v) => (q.kind = v), options: [['collar', 'Collar bearing (ring of radii R₁, R₂)'], ['disk', 'Disk or pivot bearing (solid circle)'], ['journal', 'Journal bearing (shaft in a loose hole)'], ['rolling', 'Rolling resistance of a wheel']] });
      if (q.kind !== 'rolling') C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['M', 'Moment to turn'], ['mu', 'μ from a measured moment']] });
      sec = C.section(c, q.kind === 'rolling' ? 'Wheel' : 'Bearing');
      if (q.kind === 'collar' || q.kind === 'disk') {
        C.num(sec, { label: 'Axial force P', get: () => q.P, set: (v) => (q.P = v), unit: F });
        if (q.kind === 'collar') C.num(sec, { label: 'Inner radius R₁', get: () => q.R1, set: (v) => (q.R1 = v), unit: Lu });
        C.num(sec, { label: q.kind === 'collar' ? 'Outer radius R₂' : 'Radius R', get: () => q.R2, set: (v) => (q.R2 = v), unit: Lu });
      } else if (q.kind === 'journal') {
        C.num(sec, { label: 'Load on the bearing R', get: () => q.W, set: (v) => (q.W = v), unit: F });
        C.num(sec, { label: 'Shaft radius r', get: () => q.rs, set: (v) => (q.rs = v), unit: Lu });
      } else {
        C.num(sec, { label: 'Load on the wheel W', get: () => q.W, set: (v) => (q.W = v), unit: F });
        C.num(sec, { label: 'Wheel radius r', get: () => q.rw, set: (v) => (q.rw = v), unit: Lu });
        C.num(sec, { label: 'Coefficient of rolling resistance a (ground)', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
        C.num(sec, { label: 'a_B at a load on top (0 = a wheel on an axle)', get: () => q.aB, set: (v) => (q.aB = v), unit: Lu });
      }
      if (q.kind !== 'rolling') {
        if (q.task === 'mu') C.num(sec, { label: 'Moment that turns it M', get: () => q.M, set: (v) => (q.M = v), unit: FL });
        else C.num(sec, { label: q.kind === 'journal' ? 'Kinetic friction μk' : 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      }
    } else if (st.mode === 'vehicle') {
      const q = st.vh, AX = [['free', 'Roll freely'], ['locked', 'Braked (locked)'], ['driven', 'Driven']];
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['park', 'Reactions when parked'], ['force', 'Force P to move it'], ['slope', 'Steepest slope']] });
      sec = C.section(c, 'Vehicle');
      weightIn(sec, C, q, F, 'Vehicle');
      C.num(sec, { label: 'G from axle A (along the road)', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
      C.num(sec, { label: 'G from axle B (along the road)', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Height of G above the road h', get: () => q.h, set: (v) => (q.h = v), unit: Lu });
      C.seg(sec, { label: 'Front of the vehicle at', get: () => q.front, set: (v) => (q.front = v), options: [['B', 'B (right)'], ['A', 'A (left)']] });
      sec = C.section(c, 'Wheels and road');
      C.seg(sec, { label: 'Wheels at A', get: () => q.axA, set: (v) => (q.axA = v), options: AX });
      C.seg(sec, { label: 'Wheels at B', get: () => q.axB, set: (v) => (q.axB = v), options: AX });
      C.num(sec, { label: 'Static friction μs (tires on the road)', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      if (q.task !== 'slope') C.num(sec, { label: 'Slope angle φ (0 = level road)', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      C.seg(sec, { label: 'The road rises toward', get: () => q.rise, set: (v) => (q.rise = v), options: [['A', 'A (left)'], ['B', 'B (right)']] });
      if (q.task === 'park') { sec = C.section(c, 'Other force on the vehicle'); C.toggle(sec, { label: 'A force P acts (a tow rope, a push, a load)', get: () => !!q.hasP, set: (v) => (q.hasP = v) }); }
      else if (q.task === 'force') sec = C.section(c, 'Force P');
      if (q.task === 'force' || (q.task === 'park' && q.hasP)) {
        if (q.task === 'park') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
        C.num(sec, { label: 'Point of P: distance from A along the road (− = beyond A)', get: () => q.xP, set: (v) => (q.xP = v), unit: Lu });
        C.num(sec, { label: 'Point of P: height above the road', get: () => q.yP, set: (v) => (q.yP = v), unit: Lu });
        C.num(sec, { label: 'Direction of P, counterclockwise from A → B', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
        if (q.task === 'force') C.seg(sec, { label: 'The vehicle is about to move toward', get: () => q.move, set: (v) => (q.move = v), options: [['A', 'A'], ['B', 'B']] });
      }
    } else {
      const q = st.bt;
      sec = C.section(c, 'Tension');
      C.seg(sec, { label: 'The known tension is', get: () => q.known, set: (v) => (q.known = v), options: [['high', 'The larger one T₂'], ['low', 'The smaller one T₁']] });
      C.num(sec, { label: 'Known tension', get: () => q.T, set: (v) => (q.T = v), unit: F });
      sec = C.section(c, 'Drums (in order from the known end)');
      C.list(sec, { items: q.drums, max: 4, min: 1, color: () => '#e2cdef', title: (it, i) => `Drum ${i + 1}`, fields: () => [{ key: 'beta', label: 'Contact angle β', unit: '°' }, { key: 'turns', label: 'Extra full turns', unit: '' }, { key: 'mu', label: 'μs', unit: '', wide: true }], add: [['Drum', () => ({ beta: 180, turns: 0, mu: 0.3 })]] });
    }
  };

  M.compute = (U) => Friction.solve(S(), U);
  M.onUnits = (from, to) => Friction.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ block: 'Free-body diagram and friction cone', incline: 'Block on the incline', ladder: 'Free-body diagram of the ladder', wedge: 'Free-body diagram of the wedge and load', screw: 'Screw and the unwrapped thread', belt: 'Belt on the drums', vehicle: 'Free-body diagram of the vehicle', bearing: 'Bearing' }[mode()]);
  M.cap3D = '3D view';
  M.hint = () => ({
    block: 'Green: the normal force N at its position x and the friction force F. Orange dashed: the friction cone at ±φs = tan⁻¹ μs; while the resultant of N and F stays inside it, the block does not slip, and while N stays within the base, it does not tip.',
    incline: 'Purple: friction, which acts up the slope when the block slides or is about to slide down, and down the slope when it is pushed up. Orange dashed: the angle of repose φs = tan⁻¹ μs; a slope steeper than it lets the block slide by itself. Press Play to watch it move.',
    ladder: 'The foot slips away from the wall and the top slides down, so friction acts toward the wall at A and upward at B.',
    wedge: 'Friction opposes the motion that is about to happen on each surface. Purple arrows are friction forces.',
    screw: 'The thread is unwrapped into a slope of rise l over a run of 2πr. The resultant R of the normal and friction forces leans at φs from the normal.',
    belt: 'The tension grows by e^(μβ) over each drum, toward the side the belt is about to slip to.',
    bearing: 'Collar and disk bearings: the axial force is spread uniformly over the ring, and friction on each ring dA acts at its radius. Journal bearings: the resultant R is tangent to the friction circle r_f = r sin φk. Rolling: the ground reaction acts a distance a ahead of the lowest point.',
    vehicle: 'Green: the normal forces at the two axles. Purple: friction, which acts only at braked or driven wheels; freely rolling wheels carry none. A wheel marked with a cross is locked by its brake. For tipping sideways on a road tilted across it, enter half the track width as the distances from G to A and B.',
  }[mode()]);
  M.legend = () => [[LCOL, 'Loads'], [RCOL, 'Normal forces'], [FCOL, 'Friction']].concat(mode() === 'block' ? [[CONE, 'Friction cone', 'ln']] : mode() === 'incline' ? [[CONE, 'Angle of repose', 'ln']] : []);
  /* Play slides the block down the slope (released) or up it (pushed); the clock shows the real time. */
  let animGeo = null;
  const slide = { duration: 6, loop: true,
    frame(u) { S()._s = u; },
    label(u) {
      const g = animGeo; if (!g) return '';
      const U = Core.UNITS[M.units];
      if (g.task === 'release') { const t = u * g.t; return `t = ${fmt(t, 3)} s · v = ${fmt(g.a * t, 3)} ${U.vel}`; }
      return g.a > 0 ? `a = ${fmt(g.a, 3)} ${U.acc} up the slope` : 'Steady speed up the slope';
    } };
  M.anim = () => {
    if (mode() !== 'incline') return null;
    const r = Friction.solve(S(), Core.UNITS[M.units]);
    animGeo = r.ok && r.geo.moving ? r.geo : null;
    return animGeo ? slide : null;
  };

  /* ------------------------------------------------------------------ */
  /* 2D helpers                                                         */
  /* ------------------------------------------------------------------ */
  function arrowPx(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.42},${y2 - uy * hs + py * hs * 0.42} ${x2 - ux * hs - px * hs * 0.42},${y2 - uy * hs - py * hs * 0.42}`, fill: color }, g);
  }
  const hatch = (svg) => { const d = s('defs', {}, svg), p = s('pattern', { id: 'hatchF', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, p); };
  let LW = 0;
  const lbl = (g, x, y, txt, o) => {
    o = Object.assign({ size: 11.5, weight: 700 }, o);
    if (LW) { const tw = txt.length * o.size * 0.56, a = o.anchor || 'start', l = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2; x += Math.max(0, 6 - l) - Math.max(0, l + tw - (LW - 6)); }
    return T(g, x, y, txt, o);
  };
  /** Arrow of fixed pixel length ending at (or, with out, starting from) a screen point, labelled at its free end. */
  function force(g, x, y, ux, uy, L, color, txt, out, gap) {
    gap = gap || 0;
    const tx = out ? x + ux * gap : x - ux * (L + gap), ty = out ? y + uy * gap : y - uy * (L + gap), hx = tx + ux * L, hy = ty + uy * L;
    arrowPx(g, tx, ty, hx, hy, color, 2.4, 10);
    if (!txt) return;
    const sg = out ? 1 : -1, ex = (out ? hx : tx) + sg * ux * 6, ey = (out ? hy : ty) + sg * uy * 6, dx = sg * ux, dy = sg * uy;
    lbl(g, ex, ey + (dy > 0.5 ? 12 : dy < -0.5 ? -3 : 4), txt, { anchor: dx > 0.4 ? 'start' : dx < -0.4 ? 'end' : 'middle', color });
  }
  function arcPx(g, cx, cy, r, a0, a1, color, w) {
    const n = 30, pts = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`); }
    s('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': w || 1.4 }, g);
  }
  const poly = (g, pts, o) => s('polygon', Object.assign({ points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }, o), g);

  M.draw2D = function (svg, res, U, opt) {
    LW = svg.clientWidth || 800;
    const g = res.geo;
    if (g.kind === 'block') return drawBlock(svg, g, opt);
    if (g.kind === 'incline') return drawIncline(svg, g, opt);
    if (g.kind === 'ladder') return drawLadder(svg, g, opt);
    if (g.kind === 'wedge') return drawWedge(svg, g, opt);
    if (g.kind === 'screw') return drawScrew(svg, g, opt);
    if (g.kind === 'vehicle') return drawVehicle(svg, g, opt);
    if (g.kind === 'bearing') return drawBearing(svg, g, opt);
    return drawBelt(svg, g, opt);
  };

  /* -------- block -------- */
  function drawBlock(svg, g, opt) {
    const { F, Lu } = g.c, ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, v) => [u * cp - v * sp, u * sp + v * cp];
    const e = Math.max(g.b, g.H), ext = g.b * 0.9 + e * 0.6;
    const pts = [R(-ext, 0), R(ext, 0), R(-g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]).concat([R(-ext, 0)[1] - e * 0.25]);
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) + e * 0.35 }, { pad: 60 }); hatch(svg);
    const g0 = D.root, P = (u, v) => { const w = R(u, v); return [D.X(w[0]), D.Y(w[1])]; };
    // ground or slope
    const a = P(-ext, 0), b = P(ext, 0), n = [sp, cp]; // screen direction into the ground
    poly(g0, [a, b, [b[0] + n[0] * 10, b[1] + n[1] * 10], [a[0] + n[0] * 10, a[1] + n[1] * 10]], { fill: 'url(#hatchF)' });
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    if (g.phi > 0) { arcPx(g0, a[0], a[1], 46, 0, g.phi, '#5a6b75'); lbl(g0, a[0] + 52, a[1] - 6, `${fmt(g.phi)}°`, { color: '#5a6b75', size: 11 }); s('line', { x1: a[0], y1: a[1], x2: a[0] + 70, y2: a[1], stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g0); }
    // block
    poly(g0, [P(-g.b / 2, 0), P(g.b / 2, 0), P(g.b / 2, g.H), P(-g.b / 2, g.H)], { fill: '#d9b58a', 'fill-opacity': 0.55, stroke: '#8a6a3f', 'stroke-width': 1.6 });
    const G = P(0, g.H / 2); s('circle', { cx: G[0], cy: G[1], r: 4, fill: '#1d2733' }, g0); lbl(g0, G[0] + 7, G[1] - 6, 'G', { color: '#1d2733' });
    // weight
    const wl = Math.min(46, Math.max(24, D.sc * g.H * 0.5 - 16));
    force(g0, G[0], G[1], 0, 1, wl, LCOL, null, true, 6); lbl(g0, G[0] + 7, G[1] + 6 + wl * 0.6, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // P on the left face, pushing (ψ < 0 or 0) or pulling (ψ > 0)
    if (Math.abs(g.P) > 0) {
      const at = P(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)), ux = d[0], uy = -d[1];
      force(g0, at[0], at[1], ux * Math.sign(g.P), uy * Math.sign(g.P), 52, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', g.psi > 0, 2);
    }
    // N at x, F along the base, friction cone at x
    const xN = Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), o = P(xN, 0), up = [-sp, -cp]; // screen unit normal, out of the surface
    force(g0, o[0], o[1], up[0], up[1], 46, RCOL, opt.showP ? `N = ${fmt(g.N)} ${F}` : 'N', false, 2);
    if (Math.abs(g.Ff) > 1e-12) { const t = R(-Math.sign(g.Ff), 0); force(g0, o[0], o[1], t[0], -t[1], 44, FCOL, opt.showP ? `F = ${fmt(Math.abs(g.Ff))} ${F}` : 'F', true, 4); }
    const phs = Math.atan(g.mu), Lc = Math.min(110, Math.max(70, D.sc * g.H * 0.9));
    [-1, 1].forEach((sg) => { const ang = ph + Math.PI / 2 + sg * phs, dx = Math.cos(ang), dy = -Math.sin(ang); s('line', { x1: o[0], y1: o[1], x2: o[0] + dx * Lc, y2: o[1] + dy * Lc, stroke: CONE, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g0); });
    lbl(g0, o[0] + Math.cos(ph + Math.PI / 2 + phs) * (Lc + 4), o[1] - Math.sin(ph + Math.PI / 2 + phs) * (Lc + 4), `φs = ${fmt(phs / DEG)}°`, { anchor: 'end', color: CONE, size: 11 });
    // resultant direction of N and F inside or outside the cone
    const Rang = ph + Math.PI / 2 + Math.atan2(-g.Ff, g.N), Lr = Lc * 0.75;
    s('line', { x1: o[0], y1: o[1], x2: o[0] + Math.cos(Rang) * Lr, y2: o[1] - Math.sin(Rang) * Lr, stroke: RCOL, 'stroke-width': 1.6, 'stroke-dasharray': '2 3' }, g0);
    // x dimension from the centre line
    const c0 = P(0, 0), c1 = P(0, -g.H * 0.18), x1 = P(xN, -g.H * 0.18);
    s('line', { x1: c0[0], y1: c0[1], x2: c1[0], y2: c1[1], stroke: '#9aa5ad', 'stroke-dasharray': '3 3' }, g0);
    if (Math.abs(g.x) > 1e-9) { s('line', { x1: c1[0], y1: c1[1], x2: x1[0], y2: x1[1], stroke: '#5a6b75', 'stroke-width': 1.2 }, g0); lbl(g0, (c1[0] + x1[0]) / 2, (c1[1] + x1[1]) / 2 + 14, `x = ${fmt(g.x)} ${Lu}`, { anchor: 'middle', color: '#5a6b75', size: 11 }); }
    const vt = g.find ? `${g.verdict === 'tip' ? 'Tips' : 'Slips'} first, at P = ${fmt(g.P)} ${F}` : { none: 'No slipping or tipping', slip: 'Slips', tip: 'Tips', both: 'Slips and tips' }[g.verdict];
    lbl(g0, 14, 22, vt, { color: g.verdict === 'none' ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
  }


  /* -------- block on an incline -------- */
  /** Where the block's centre sits along the slope (0 = foot, 1 = top), following the animation. */
  function inclinePos(g) {
    const k = S()._s, s0 = 0.24, s1 = 0.8;
    if (k === undefined || !g.moving) return 0.55;
    const e = g.task === 'release' || g.a > 0 ? k * k : k;
    return g.task === 'release' ? s1 - (s1 - s0) * e : s0 + (s1 - s0) * e;
  }
  function drawIncline(svg, g, opt) {
    const { F } = g.c, U = g.c.U, ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp];
    const bs = 0.17, top = R(1, 0), xr = top[0] + 0.12;
    const D = UI.Draw2D(svg, { xmin: -0.3, xmax: xr, ymin: -0.1, ymax: top[1] + 0.32 }, { pad: 52 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])];
    // ground and the slope
    const gl = P([-0.3, 0]), gr = P([xr, 0]);
    poly(g0, [gl, gr, [gr[0], gr[1] + 12], [gl[0], gl[1] + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: gl[0], y1: gl[1], x2: gr[0], y2: gr[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    poly(g0, [P([0, 0]), P([top[0], 0]), P(top)], { fill: '#e3e9ed', stroke: '#4a5661', 'stroke-width': 1.8 });
    const o = P([0, 0]);
    arcPx(g0, o[0], o[1], 54, 0, g.phi, '#1d2733'); lbl(g0, o[0] + 60, o[1] - 6, `φ = ${fmt(g.phi)}°`, { color: '#1d2733', size: 11.5 });
    // angle of repose
    const rr = g.rep * DEG, Lr = 0.36;
    s('line', { x1: o[0], y1: o[1], x2: D.X(Lr * Math.cos(rr)), y2: D.Y(Lr * Math.sin(rr)), stroke: CONE, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g0);
    lbl(g0, D.X(Lr * Math.cos(rr)) + 4, D.Y(Lr * Math.sin(rr)) + (rr < ph ? 14 : -6), `φs = ${fmt(g.rep)}°`, { color: CONE, size: 11 });
    // block
    const sc = inclinePos(g), cn = [R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)].map(P);
    poly(g0, cn, { fill: '#d9b58a', 'fill-opacity': 0.75, stroke: '#8a6a3f', 'stroke-width': 1.6 });
    const G = P(R(sc, bs / 2)); s('circle', { cx: G[0], cy: G[1], r: 3.5, fill: '#1d2733' }, g0);
    const up = [cp, -sp], nrm = [-sp, -cp]; // screen: up the slope, out of the surface
    force(g0, G[0], G[1], 0, 1, 50, LCOL, null, true, 4); lbl(g0, G[0] + 7, G[1] + 50, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    const b0 = P(R(sc, 0));
    force(g0, b0[0], b0[1], nrm[0], nrm[1], 44, RCOL, opt.showP ? `N = ${fmt(g.N)} ${F}` : 'N', false, 2);
    if (g.Ff > 1e-12) { const fd = g.fUp ? up : [-up[0], -up[1]], fb = P(R(sc + (g.fUp ? 1 : -1) * bs * 0.5, -0.012)); force(g0, fb[0], fb[1], fd[0], fd[1], 46, FCOL, opt.showP ? `F = ${fmt(g.Ff)} ${F}` : 'F', true, 2); }
    if (g.task !== 'release' && g.P > 0) {
      const dw = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)), d = [dw[0], -dw[1]];
      if (g.psi > 0) { const at = P(R(sc + bs / 2, bs / 2)); force(g0, at[0], at[1], d[0], d[1], 52, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', true, 2); }
      else { const at = P(R(sc - bs / 2, bs / 2)); force(g0, at[0], at[1], d[0], d[1], 52, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', false, 2); }
    }
    // direction of motion
    if (g.moving) {
      const dn = g.task === 'release', a0 = P(R(sc + (dn ? 0.13 : -0.13), bs * 1.9)), a1 = P(R(sc + (dn ? -0.13 : 0.13), bs * 1.9));
      s('line', { x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1], stroke: '#1d2733', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, g0);
      arrowPx(g0, a1[0] - (a1[0] - a0[0]) * 0.15, a1[1] - (a1[1] - a0[1]) * 0.15, a1[0], a1[1], '#1d2733', 1.6, 9);
      lbl(g0, (a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 10, g.a > 0 ? `a = ${fmt(g.a)} ${U.acc}` : 'steady speed', { anchor: 'middle', color: '#1d2733', size: 11.5 });
    }
    const vt = g.task === 'release' ? (g.moving ? 'Slides down the slope' : 'Stays at rest') : g.task === 'hold' ? (g.P > 0 ? `Held by P = ${fmt(g.P)} ${F}` : 'Friction alone holds it') : `Pushed up by P = ${fmt(g.P)} ${F}`;
    lbl(g0, 14, 22, vt, { color: g.task === 'release' && g.moving ? '#a3281f' : '#1e7a45', size: 13, weight: 800 });
  }

  /* -------- ladder -------- */
  function drawLadder(svg, g, opt) {
    const { F } = g.c, th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)];
    const D = UI.Draw2D(svg, { xmin: -L * 0.32, xmax: A[0] + L * 0.42, ymin: -L * 0.22, ymax: B[1] + L * 0.2 }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])], a = P(A), b = P(B), o = P([0, 0]);
    poly(g0, [[o[0] - 14, D.Y(B[1] + L * 0.15)], [o[0], D.Y(B[1] + L * 0.15)], [o[0], o[1]], [o[0] - 14, o[1]]], { fill: 'url(#hatchF)' });
    poly(g0, [[o[0] - 14, o[1]], [D.X(A[0] + L * 0.35), o[1]], [D.X(A[0] + L * 0.35), o[1] + 12], [o[0] - 14, o[1] + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: o[0], y1: o[1], x2: o[0], y2: D.Y(B[1] + L * 0.15), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: o[0], y1: o[1], x2: D.X(A[0] + L * 0.35), y2: o[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8a6a3f', 'stroke-width': 9, 'stroke-linecap': 'round' }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#d9b58a', 'stroke-width': 6, 'stroke-linecap': 'round' }, g0);
    arcPx(g0, a[0], a[1], 40, 180 - g.th, 180, '#5a6b75'); lbl(g0, a[0] - 46, a[1] - 8, `θ = ${fmt(g.th)}°`, { anchor: 'end', color: '#5a6b75', size: 11.5 });
    lbl(g0, a[0] + 8, a[1] - 10, 'A', { color: '#1d2733', size: 13, weight: 800 }); lbl(g0, b[0] + 12, b[1] - 6, 'B', { color: '#1d2733', size: 13, weight: 800 });
    const m = P([A[0] / 2, B[1] / 2]);
    force(g0, m[0], m[1], 0, 1, 46, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', true, 6);
    if (g.Wp > 0) { const k = g.s / L, pp = P([A[0] * (1 - k), B[1] * k]); s('circle', { cx: pp[0], cy: pp[1], r: 5, fill: LCOL }, g0); force(g0, pp[0], pp[1], 0, 1, 40, LCOL, opt.showP ? `${fmt(g.Wp)} ${F}` : 'W_p', true, 6); }
    force(g0, a[0], a[1], 0, -1, 44, RCOL, opt.showP ? `N_A = ${fmt(g.NA)} ${F}` : 'N_A', false, 14);
    if (g.FA > 0) force(g0, a[0], a[1] + 6, -1, 0, 44, FCOL, opt.showP ? `F_A = ${fmt(g.FA)} ${F}` : 'F_A', false, 6);
    force(g0, b[0], b[1], 1, 0, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 8);
    if (g.FB > 0) force(g0, b[0] + 4, b[1], 0, -1, 40, FCOL, opt.showP ? `F_B = ${fmt(g.FB)} ${F}` : 'F_B', true, 8);
  }

  /* -------- wedge -------- */
  function drawWedge(svg, g, opt) {
    const { F } = g.c, ta = Math.tan(g.al * DEG), lever = g.load === 'lever';
    const Lw = lever ? Math.max(g.a * 0.55, 1e-6) : 1, t = Lw * Math.max(ta, 0.2); // thin wedges are drawn steeper so the forces can be read
    const xB = Lw * 0.5, yB = t * 0.5, sc0 = lever ? g.a : Lw;
    // the lever's end corner rests on the wedge face at B and the pin A is beyond it (mirror of the book figure; same equations)
    const xA = xB + (lever ? g.a : 0), yL = yB, hL = sc0 * 0.08;
    const xmin = -Lw * 0.5, xmax = lever ? xA + sc0 * 0.15 : Lw * 1.5;
    const D = UI.Draw2D(svg, { xmin, xmax, ymin: -sc0 * 0.25, ymax: yB + sc0 * (lever ? 0.45 : 0.9) }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)];
    poly(g0, [P(xmin, 0), P(xmax, 0), [D.X(xmax), D.Y(0) + 12], [D.X(xmin), D.Y(0) + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: D.X(xmin), y1: D.Y(0), x2: D.X(xmax), y2: D.Y(0), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    // wedge: thick end at the left, top face falls to the right
    poly(g0, [P(0, 0), P(Lw, 0), P(0, t)], { fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.6 });
    lbl(g0, D.X(Lw * 0.12), D.Y(0) + 18, 'C', { color: '#1d2733', size: 12, weight: 800 });
    const B = P(xB, yB);
    if (lever) {
      poly(g0, [P(xB, yL), P(xA + sc0 * 0.06, yL), P(xA + sc0 * 0.06, yL + hL), P(xB, yL + hL)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      const A = P(xA, yL); poly(g0, [A, [A[0] - 11, D.Y(0)], [A[0] + 11, D.Y(0)]], { fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }); s('circle', { cx: A[0], cy: A[1], r: 4, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.5 }, g0);
      lbl(g0, A[0] + 10, A[1] - 8, 'A', { color: '#1d2733', size: 12, weight: 800 });
      const Wp = P(xA - g.xW, yL + hL); force(g0, Wp[0], Wp[1], 0, 1, 44, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    } else {
      const bw = Lw * 0.36, bh = Lw * 0.4, x0 = xB - bw / 2, yb = t * (1 - x0 / Lw);
      poly(g0, [P(x0, yb), P(x0 + bw, t * (1 - (x0 + bw) / Lw)), P(x0 + bw, yb + bh), P(x0, yb + bh)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      [x0 - Lw * 0.03, x0 + bw + Lw * 0.03].forEach((xg, i) => poly(g0, [P(xg, yB + bh * 0.1), P(xg, yB + bh * 1.6), [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 1.6)], [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 0.1)]], { fill: 'url(#hatchF)' }));
      const Wp = P(xB, yb + bh); force(g0, Wp[0], Wp[1], 0, 1, 40, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    }
    lbl(g0, B[0] + 6, B[1] + 18, 'B', { color: '#1d2733', size: 12, weight: 800 });
    // forces on the wedge: N_B (pressing down into the wedge) and friction at B; N_C and friction at C; P
    const sa = Math.sin(g.al * DEG), ca = Math.cos(g.al * DEG), raise = g.task === 'raise';
    force(g0, B[0], B[1], -sa, ca, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 4);
    const tf = raise ? [-ca, -sa] : [ca, sa]; // friction on the wedge at B, along the face, opposing its slide (screen coordinates)
    force(g0, B[0], B[1], tf[0], tf[1], 40, FCOL, opt.showP ? `${fmt(g.mu * g.NB)} ${F}` : 'μN_B', true, 8);
    const Cp = P(Lw * 0.22, 0);
    force(g0, Cp[0], Cp[1], 0, -1, 40, RCOL, opt.showP ? `N_C = ${fmt(g.NC)} ${F}` : 'N_C', false, 16);
    force(g0, Cp[0] + 10, Cp[1] + 6, raise ? -1 : 1, 0, 40, FCOL, opt.showP ? `${fmt(g.muC * g.NC)} ${F}` : 'μN_C', true, 0);
    const Pp = P(0, t * 0.45), pull = g.P >= 0 ? !raise : raise;
    force(g0, Pp[0], Pp[1], pull ? -1 : 1, 0, 50, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', pull, 4);
    lbl(g0, D.X(Lw), D.Y(0) + 28, `α = ${fmt(g.al)}°`, { anchor: 'middle', color: '#1d2733', size: 11 });
  }

  /* -------- screw -------- */
  function drawScrew(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F, Ls } = g.c, stack = W < 600, pw = stack ? W : W * 0.42, ph = stack ? H * 0.45 : H;
    const g0 = s('g', {}, svg);
    T(g0, 12, 20, 'Screw', { color: '#5a6b75', size: 12, weight: 700 });
    const cx = pw / 2, top = ph * 0.3, bot = ph * 0.86, rw = Math.min(pw * 0.14, 46);
    s('rect', { x: cx - rw, y: top, width: 2 * rw, height: bot - top, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
    const pitch = Math.max(12, (bot - top) / 9), dz = Math.max(4, 2 * rw * Math.tan(g.th * DEG));
    for (let y = top + 6; y < bot - 4; y += pitch) s('line', { x1: cx - rw, y1: y + dz, x2: cx + rw, y2: y, stroke: '#4a5661', 'stroke-width': 1.3 }, g0);
    s('rect', { x: cx - rw * 1.9, y: bot, width: rw * 3.8, height: 10, fill: 'url(#hatchF)' }, g0);
    hatch(svg);
    s('rect', { x: cx - rw * 1.5, y: top - 18, width: rw * 3, height: 18, fill: '#d9b58a', stroke: '#8a6a3f' }, g0);
    arrowPx(g0, cx, top - 70, cx, top - 20, LCOL, 2.6, 11); lbl(g0, cx + 8, top - 56, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // moment arrow around the axis
    const ey = (top + bot) / 2, ex = rw * 1.9;
    s('path', { d: `M ${cx - ex} ${ey} A ${ex} ${ex * 0.32} 0 0 0 ${cx + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
    arrowPx(g0, cx + ex - 2, ey - 8, cx + ex, ey + 1, FCOL, 2.2, 10);
    lbl(g0, cx + ex + 6, ey + 18, opt.showP ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', { color: FCOL });
    lbl(g0, cx, bot + 28, `r = ${fmt(g.r)} ${Ls},  l = ${fmt(g.l)} ${Ls}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
    // unwrapped thread with the force triangle
    const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? W : W - pw, qh = stack ? H - ph : H, g1 = s('g', {}, svg);
    s('line', { x1: ox + (stack ? 10 : 0), y1: oy + (stack ? 0 : 10), x2: stack ? W - 10 : ox, y2: stack ? oy : H - 10, stroke: '#e1e7ea' }, g1);
    T(g1, ox + 12, oy + 20, 'One turn of the thread, unwrapped', { color: '#5a6b75', size: 12, weight: 700 });
    const base = qw * 0.62, thv = Math.max(g.th, 3) * DEG, rise = base * Math.tan(thv), x0 = ox + qw * 0.16, y0 = oy + qh * 0.78;
    poly(g1, [[x0, y0], [x0 + base, y0], [x0 + base, y0 - rise]], { fill: '#eef2f4', stroke: '#4a5661', 'stroke-width': 1.5 });
    lbl(g1, x0 + base / 2, y0 + 18, '2πr', { anchor: 'middle', color: '#5a6b75', size: 11 }); lbl(g1, x0 + base + 6, y0 - rise / 2, 'l', { color: '#5a6b75', size: 11 });
    arcPx(g1, x0, y0, 54, 0, thv / DEG, '#5a6b75'); lbl(g1, x0 + 60, y0 - 6, `θ = ${fmt(g.th)}°`, { color: '#5a6b75', size: 11 });
    // block on the slope with W, the push M/r and the resultant R at φs from the normal
    const bx = x0 + base * 0.62, by = y0 - base * 0.62 * Math.tan(thv), up = g.task === 'raise' ? 1 : -1;
    const nA = Math.PI / 2 + thv, rA = nA + (g.task === 'raise' ? 1 : -1) * g.ph * DEG * (g.lock || g.task === 'raise' ? 1 : -1);
    s('rect', { x: bx - 13, y: by - 26, width: 26, height: 20, fill: '#d9b58a', stroke: '#8a6a3f', transform: `rotate(${-thv / DEG} ${bx} ${by})` }, g1);
    arrowPx(g1, bx, by - 70, bx, by - 30, LCOL, 2.4, 10); lbl(g1, bx + 6, by - 62, 'W', { color: LCOL });
    const Lr = Math.min(80, qh * 0.3); arrowPx(g1, bx - Math.cos(rA) * Lr * 0.1, by + Math.sin(rA) * Lr * 0.1 + 6, bx + Math.cos(rA) * Lr, by - Math.sin(rA) * Lr, RCOL, 2.4, 10);
    lbl(g1, bx + Math.cos(rA) * Lr + 6, by - Math.sin(rA) * Lr, 'R', { color: RCOL });
    s('line', { x1: bx, y1: by, x2: bx + Math.cos(nA) * Lr * 0.9, y2: by - Math.sin(nA) * Lr * 0.9, stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g1);
    lbl(g1, bx + Math.cos(nA) * Lr * 0.95 - 4, by - Math.sin(nA) * Lr * 0.95 - 4, `φs = ${fmt(g.ph)}°`, { anchor: 'end', color: CONE, size: 11 });
    const hx = up > 0 ? bx - 80 : bx + 80; arrowPx(g1, hx, by - 12, up > 0 ? bx - 16 : bx + 16, by - 12, FCOL, 2.4, 10); lbl(g1, hx, by - 20, 'M/r', { anchor: 'middle', color: FCOL });
    lbl(g1, ox + 12, oy + qh - 14, g.lock ? `Self-locking: φs ≥ θ` : 'Not self-locking: φs < θ', { color: g.lock ? '#1e7a45' : '#a3281f', size: 12, weight: 800 });
  }



  /* -------- bearings -------- */
  function drawBearing(svg, g, opt) {
    const { F, Lu, FL } = g.c, val = (k, t) => (opt.showP ? `${k} = ${t}` : k);
    if (g.type === 'collar' || g.type === 'disk') {
      const R2 = g.R2, R1 = g.R1, rs = R1 > 0 ? R1 * 0.8 : R2 * 0.3;
      const D = UI.Draw2D(svg, { xmin: -R2 * 1.6, xmax: R2 * 2.8, ymin: -R2 * 1.1, ymax: R2 * 2.4 }, { pad: 50 }); hatch(svg);
      const g0 = D.root, X = D.X, Y = D.Y;
      // side section: shaft on the bearing, support block below
      poly(g0, [[X(-R2 * 1.4), Y(0)], [X(R2 * 1.4), Y(0)], [X(R2 * 1.4), Y(-R2 * 0.7)], [X(-R2 * 1.4), Y(-R2 * 0.7)]], { fill: 'url(#hatchF)', stroke: '#4a5661' });
      if (R1 > 0) poly(g0, [[X(-R1), Y(0)], [X(R1), Y(0)], [X(R1), Y(-R2 * 0.7)], [X(-R1), Y(-R2 * 0.7)]], { fill: '#fff', stroke: '#4a5661' });
      poly(g0, [[X(-R2), Y(0)], [X(R2), Y(0)], [X(R2), Y(R2 * 0.25)], [X(-R2), Y(R2 * 0.25)]], { fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 });
      poly(g0, [[X(-rs), Y(R2 * 0.25)], [X(rs), Y(R2 * 0.25)], [X(rs), Y(R2 * 1.7)], [X(-rs), Y(R2 * 1.7)]], { fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 1.5 });
      arrowPx(g0, X(0), Y(R2 * 2.35), X(0), Y(R2 * 1.72), LCOL, 2.6, 11); lbl(g0, X(0) + 8, Y(R2 * 2.2), val('P', `${fmt(g.P)} ${F}`), { color: LCOL });
      const ey = Y(R2 * 1.2), ex = rs * D.sc + 26;
      s('path', { d: `M ${X(0) - ex} ${ey} A ${ex} ${ex * 0.3} 0 0 0 ${X(0) + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
      arrowPx(g0, X(0) + ex - 2, ey - 8, X(0) + ex, ey + 1, FCOL, 2.2, 10); lbl(g0, X(0) + ex + 6, ey + 16, val('M', `${fmt(g.M)} ${FL}`), { color: FCOL });
      // pressure on the contact surface
      for (let k = -6; k <= 6; k++) { const x = (k / 6) * R2; if (Math.abs(x) < R1 * 0.999) continue; arrowPx(g0, X(x), Y(-R2 * 0.3), X(x), Y(-0.02 * R2), RCOL, 1.4, 6); }
      lbl(g0, X(0), Y(-R2 * 0.95), 'uniform pressure p on the contact surface', { anchor: 'middle', color: RCOL, size: 11 });
      // plan view of the contact ring
      const cx = X(R2 * 2.1), cy = Y(R2 * 0.6), r2 = R2 * D.sc * 0.62, r1 = R1 * D.sc * 0.62;
      s('circle', { cx, cy, r: r2, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.4 }, g0); if (R1 > 0) s('circle', { cx, cy, r: r1, fill: '#fff', stroke: '#4a5661', 'stroke-width': 1.4 }, g0);
      arrowPx(g0, cx, cy, cx + r2, cy, '#1d2733', 1.3, 7); lbl(g0, cx + r2 / 2, cy - 5, R1 > 0 ? 'R₂' : 'R', { anchor: 'middle', color: '#1d2733', size: 11 });
      if (R1 > 0) { arrowPx(g0, cx, cy, cx - r1 * 0.7, cy + r1 * 0.7, '#1d2733', 1.3, 7); lbl(g0, cx - r1 * 0.5, cy + r1 * 0.5 + 14, 'R₁', { anchor: 'middle', color: '#1d2733', size: 11 }); }
      lbl(g0, cx, cy + r2 + 18, `contact area, μ = ${fmt(g.mu)}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
      return;
    }
    if (g.type === 'journal') {
      const r = 1, rf = Math.sin(g.ph * DEG), D = UI.Draw2D(svg, { xmin: -2.4, xmax: 2.4, ymin: -2.2, ymax: 2.2 }, { pad: 50 }), g0 = D.root, X = D.X, Y = D.Y, sc = D.sc;
      s('circle', { cx: X(0), cy: Y(0), r: 1.45 * sc, fill: '#e3e9ed', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
      const t = -g.ph * DEG, ox = Math.sin(t) * 0.12, oy = 0; // shaft rides up the side of the hole
      s('circle', { cx: X(ox), cy: Y(oy + 0.12), r: r * sc, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
      s('circle', { cx: X(ox), cy: Y(oy + 0.12), r: Math.max(rf * sc, 3), fill: 'none', stroke: CONE, 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, g0);
      lbl(g0, X(ox) + rf * sc + 6, Y(oy + 0.12) - 4, `r_f = ${fmt(Math.sin(g.ph * DEG) * g.r)} ${Lu}`, { color: CONE, size: 11 });
      arrowPx(g0, X(ox - rf), Y(1.9), X(ox - rf), Y(0.12 + 0.05), LCOL, 2.4, 10); lbl(g0, X(ox - rf) - 6, Y(1.8), val('R (load)', `${fmt(g.R)} ${F}`), { anchor: 'end', color: LCOL });
      arrowPx(g0, X(ox - rf), Y(-2.0), X(ox - rf), Y(-0.9), RCOL, 2.4, 10); lbl(g0, X(ox - rf) + 6, Y(-1.9), 'R (bearing)', { color: RCOL });
      const ey = Y(0.12), ex = 0.6 * sc; s('path', { d: `M ${X(ox) - ex} ${ey} A ${ex} ${ex} 0 0 1 ${X(ox) + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
      arrowPx(g0, X(ox) + ex - 1, ey - 8, X(ox) + ex, ey + 2, FCOL, 2.2, 10); lbl(g0, X(ox) - ex - 6, ey - ex * 0.6, val('M', `${fmt(g.M)} ${FL}`), { anchor: 'end', color: FCOL });
      lbl(g0, 14, 22, `φk = ${fmt(g.ph)}°: the shaft climbs the bearing until R is tangent to the friction circle`, { color: '#5a6b75', size: 11.5, weight: 700 });
      return;
    }
    const D = UI.Draw2D(svg, { xmin: -2.2, xmax: 2.6, ymin: -0.6, ymax: 2.6 }, { pad: 50 }); hatch(svg);
    const g0 = D.root, X = D.X, Y = D.Y, sc = D.sc, A = Math.max(0.12, Math.min(0.45, g.a / g.r));
    poly(g0, [[X(-2.2), Y(0)], [X(2.6), Y(0)], [X(2.6), Y(-0.25)], [X(-2.2), Y(-0.25)]], { fill: 'url(#hatchF)' });
    s('line', { x1: X(-2.2), y1: Y(0), x2: X(2.6), y2: Y(0), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('circle', { cx: X(0), cy: Y(1), r: sc, fill: '#3b444b', stroke: '#1d2733' }, g0); s('circle', { cx: X(0), cy: Y(1), r: sc * 0.4, fill: '#c9d3da' }, g0);
    arrowPx(g0, X(0), Y(2.5), X(0), Y(1.05), LCOL, 2.4, 10); lbl(g0, X(0) + 7, Y(2.35), val('W', `${fmt(g.W)} ${F}`), { color: LCOL });
    arrowPx(g0, X(-1.9), Y(1), X(-0.05), Y(1), LCOL, 2.4, 10); lbl(g0, X(-1.9), Y(1) - 8, val('P', `${fmt(g.P)} ${F}`), { color: LCOL });
    arrowPx(g0, X(A * 1.55), Y(-0.55), X(A), Y(0.02), RCOL, 2.4, 10); lbl(g0, X(A) + 6, Y(-0.4), 'R', { color: RCOL });
    s('line', { x1: X(0), y1: Y(-0.05), x2: X(A), y2: Y(-0.05), stroke: '#1d2733', 'stroke-width': 1.2 }, g0); lbl(g0, X(A / 2), Y(-0.05) + 14, `a = ${fmt(g.a)} ${Lu}`, { anchor: 'middle', color: '#1d2733', size: 11 });
    lbl(g0, X(0.95), Y(1.25), `r = ${fmt(g.r)} ${Lu}`, { color: '#5a6b75', size: 11 });
    lbl(g0, 14, 22, 'The ground reaction R acts a distance a ahead of the lowest point (a is drawn enlarged).', { color: '#5a6b75', size: 11.5, weight: 700 });
  }

  /* -------- vehicle -------- */
  /** Body outline in road axes (x from axle A to B, y up from the road); the hood is at the front end. */
  function carShape(g) {
    const L = g.L, rw = Math.min(L * 0.1, Math.max(g.h * 0.5, L * 0.07)), sh = Math.max(g.h * 1.25, rw * 2.3), top = sh + L * 0.2;
    const pts = [[-0.24 * L, rw * 0.75], [1.24 * L, rw * 0.75], [1.24 * L, sh * 0.95], [0.95 * L, sh], [0.72 * L, top], [0.18 * L, top], [-0.02 * L, sh * 1.02], [-0.24 * L, sh]];
    const fl = g.front === 'A';
    return { rw, sh, top, pts: fl ? pts.map(([x, y]) => [L - x, y]) : pts };
  }
  function drawVehicle(svg, g, opt) {
    const { F, Lu } = g.c, L = g.L, ang = (g.rise === 'B' ? 1 : -1) * g.phi * DEG, ca = Math.cos(ang), sa = Math.sin(ang), R = (u, v) => [u * ca - v * sa, u * sa + v * ca];
    const cs = carShape(g), ext = 0.55 * L, bb = [R(-ext, 0), R(L + ext, 0), R(-ext, cs.top), R(L + ext, cs.top), R(-0.3 * L, -0.3 * L), R(1.3 * L, -0.3 * L)];
    const D = UI.Draw2D(svg, { xmin: Math.min(...bb.map((p) => p[0])), xmax: Math.max(...bb.map((p) => p[0])), ymin: Math.min(...bb.map((p) => p[1])), ymax: Math.max(...bb.map((p) => p[1])) + L * 0.3 }, { pad: 56 }); hatch(svg);
    const g0 = D.root, P = (u, v) => { const w = R(u, v); return [D.X(w[0]), D.Y(w[1])]; }, sc = D.sc;
    const into = [sa, ca]; // screen direction into the road
    const r0 = P(-ext, 0), r1 = P(L + ext, 0);
    poly(g0, [r0, r1, [r1[0] + into[0] * 12, r1[1] + into[1] * 12], [r0[0] + into[0] * 12, r0[1] + into[1] * 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: r0[0], y1: r0[1], x2: r1[0], y2: r1[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    if (g.phi > 0) { const lo = ang > 0 ? r0 : r1, dir = ang > 0 ? 1 : -1; s('line', { x1: lo[0], y1: lo[1], x2: lo[0] + dir * 80, y2: lo[1], stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g0); if (dir > 0) arcPx(g0, lo[0], lo[1], 56, 0, g.phi, '#1d2733'); else arcPx(g0, lo[0], lo[1], 56, 180 - g.phi, 180, '#1d2733'); lbl(g0, lo[0] + dir * 64, lo[1] - 6, `φ = ${fmt(g.phi)}°`, { anchor: dir > 0 ? 'start' : 'end', color: '#1d2733', size: 11.5 }); }
    poly(g0, cs.pts.map(([u, v]) => P(u, v)), { fill: '#7fb3d5', 'fill-opacity': 0.55, stroke: '#2e5f80', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
    [['A', 0], ['B', L]].forEach(([k, x]) => {
      const c = P(x, cs.rw); s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc, fill: '#3b444b', stroke: '#1d2733', 'stroke-width': 1.4 }, g0); s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc * 0.45, fill: '#c9d3da' }, g0);
      if (g['ax' + k] === 'locked') { const d = cs.rw * sc * 0.32; s('path', { d: `M ${c[0] - d} ${c[1] - d} L ${c[0] + d} ${c[1] + d} M ${c[0] + d} ${c[1] - d} L ${c[0] - d} ${c[1] + d}`, stroke: '#a3281f', 'stroke-width': 2.4 }, g0); }
      if (g['ax' + k] === 'driven') s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc * 0.2, fill: '#1e7a45' }, g0);
      const t = P(x, 0); lbl(g0, t[0] + 6 * (k === 'A' ? -1 : 1), t[1] + 20, k, { anchor: k === 'A' ? 'end' : 'start', color: '#1d2733', size: 13, weight: 800 });
    });
    const G = P(g.a, g.h); s('circle', { cx: G[0], cy: G[1], r: 4.5, fill: '#1d2733' }, g0); lbl(g0, G[0] + 7, G[1] - 7, 'G', { color: '#1d2733' });
    force(g0, G[0], G[1], 0, 1, 52, LCOL, null, true, 6); lbl(g0, G[0] + 7, G[1] + 50, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    const nrm = [-sa, -ca], tg = [ca, -sa]; // screen: out of the road, along +x
    [['A', 0, g.NA, g.FA], ['B', L, g.NB, g.FB]].forEach(([k, x, N, Ff]) => {
      const o = P(x, 0);
      force(g0, o[0], o[1], nrm[0] * Math.sign(N || 1), nrm[1] * Math.sign(N || 1), 44, RCOL, opt.showP ? `N_${k} = ${fmt(N)} ${F}` : `N_${k}`, false, 3);
      if (Math.abs(Ff) > 1e-9 * g.W) { const sg = Math.sign(Ff), q = P(x, -0.02 * L); force(g0, q[0], q[1], tg[0] * sg, tg[1] * sg, 44, FCOL, opt.showP ? `F_${k} = ${fmt(Math.abs(Ff))} ${F}` : `F_${k}`, true, 4); }
    });
    if (g.useP && g.P > 0) { const at = P(g.xP, g.yP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); s('circle', { cx: at[0], cy: at[1], r: 3, fill: LCOL }, g0); force(g0, at[0], at[1], d[0], -d[1], 56, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', true, 2); }
    // dimensions a, b along the road below it, and h
    const dy = cs.top + 0.14 * L, a0 = P(0, dy), a1 = P(g.a, dy), b1 = P(L, dy);
    [[0, a0], [g.a, a1], [L, b1]].forEach(([x, e]) => { const f = P(x, x === g.a ? g.h : cs.rw * 2); s('line', { x1: f[0], y1: f[1], x2: e[0], y2: e[1], stroke: '#c3ccd2', 'stroke-dasharray': '2 3' }, g0); });
    [[a0, a1, `${fmt(g.a)} ${Lu}`], [a1, b1, `${fmt(g.b)} ${Lu}`]].forEach(([p, q, t]) => { s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: '#5a6b75', 'stroke-width': 1.2 }, g0); [p, q].forEach((e) => s('circle', { cx: e[0], cy: e[1], r: 2.2, fill: '#5a6b75' }, g0)); lbl(g0, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 6, t, { anchor: 'middle', color: '#5a6b75', size: 11 }); });
    const hb = P(g.a, 0); s('line', { x1: hb[0], y1: hb[1], x2: G[0], y2: G[1], stroke: '#9aa5ad', 'stroke-dasharray': '3 3' }, g0); if (g.h > 0) lbl(g0, (hb[0] + G[0]) / 2 - 8, (hb[1] + G[1]) / 2 + 4, `h = ${fmt(g.h)} ${Lu}`, { anchor: 'end', color: '#5a6b75', size: 11 });
    const vt = g.task === 'slope' ? `${g.verdict === 'tip' ? 'Tips' : 'Slips'} first at φ = ${fmt(g.phi)}°` : g.task === 'force' ? (g.verdict === 'tip' ? 'An axle lifts off before the wheels slip' : `Starts to move toward ${g.move} at P = ${fmt(g.P)} ${F}`) : { none: 'Parked: no slipping or tipping', slip: 'The wheels slip', tip: 'The vehicle tips', roll: 'It rolls: no axle is braked' }[g.verdict];
    lbl(g0, 14, 22, vt, { color: g.verdict === 'none' || (g.task !== 'park' && g.verdict !== 'tip') ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
  }

  /* -------- belt -------- */
  function drawBelt(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F } = g.c, n = g.drums.length, gg = s('g', {}, svg);
    const cell = W / n, R = Math.min(cell * 0.22, H * 0.18), cy = H * 0.48;
    g.drums.forEach((d, i) => {
      const cx = cell * (i + 0.5), vis = Math.min(d.deg, 359.5), a0 = 90 + vis / 2, a1 = 90 - vis / 2;
      s('circle', { cx, cy, r: R, fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 1.6 }, gg);
      s('circle', { cx, cy, r: 5, fill: '#4a5661' }, gg);
      arcPx(gg, cx, cy, R + 3, a1, a0, '#2c3e50', 4);
      if (d.deg >= 360) lbl(gg, cx, cy + 4, `${fmt(d.deg / 360, 3)} turns`, { anchor: 'middle', color: '#2c3e50', size: 11 });
      // the belt leaves tangentially at both ends of the contact
      const ends = [[a0, 1], [a1, -1]];
      ends.forEach(([a, sg], k) => {
        const ar = a * DEG, px = cx + (R + 3) * Math.cos(ar), py = cy - (R + 3) * Math.sin(ar), tx = -Math.sin(ar) * sg, ty = -Math.cos(ar) * sg, L = Math.min(cell * 0.3, 70);
        s('line', { x1: px, y1: py, x2: px + tx * L, y2: py + ty * L, stroke: '#2c3e50', 'stroke-width': 4 }, gg);
        const Tv = g.hi ? (k === 0 ? g.Ts[i] : g.Ts[i + 1]) : (k === 0 ? g.Ts[i + 1] : g.Ts[i]), big = g.hi ? k === 0 : k === 0;
        arrowPx(gg, px + tx * L * 0.4, py + ty * L * 0.4, px + tx * (L + 16), py + ty * (L + 16), big ? LCOL : RCOL, 2.4, 10);
        lbl(gg, px + tx * (L + 20), py + ty * (L + 20) + 14, opt.showP ? `${fmt(Tv)} ${F}` : (big ? 'T₂' : 'T₁'), { anchor: 'middle', color: big ? LCOL : RCOL, size: 11.5 });
      });
      lbl(gg, cx, cy - R - 18, `β = ${fmt(d.deg)}°, μs = ${fmt(d.mu)}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
      lbl(gg, cx, cy + R + 22, `Drum ${i + 1}`, { anchor: 'middle', color: '#1d2733', size: 12, weight: 800 });
    });
    lbl(gg, 12, 20, `Slip is about to happen toward the larger tension (red); e^(μβ) multiplies the tension over each drum.`, { color: '#5a6b75', size: 11.5, weight: 600 });
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = d.map((x) => x / L), hs = Math.min(L * 0.3, v._hs || L * 0.15), n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2.4));
  }
  M.draw3D = function (v, res, U, opt) {
    const rest = root.View3D.restLayer;
    const g = res.geo, F = g.c.F, val = (k, txt) => (opt.showP ? `${k} = ${txt}` : k);
    const GROUND = '#dfe4e8', GEDGE = '#4a5661', WOOD = '#d9b58a', WEDGE = '#8a6a3f', STEEL = '#c9d3da';
    if (g.kind === 'block') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], e = Math.max(g.b, g.H), z = g.b * 0.6, ext = g.b * 0.9 + e * 0.6;
      v._hs = e * 0.08;
      const a = R(-ext, 0), b = R(ext, 0), yb = Math.min(a[1], b[1]) - e * 0.1;
      v.extrude([a, b, [b[0], yb], [a[0], yb]], -z * 1.4, z * 1.4, GROUND, 1, GEDGE, { layer: rest([-sp, cp, 0]) });
      v.extrude([R(-g.b / 2, 0), R(g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)], -z / 2, z / 2, WOOD, 1, WEDGE);
      const G = R(0, g.H / 2); arrow3(v, [G[0], G[1], 0], [G[0], G[1] - e * 0.45, 0], LCOL, 2.4); v.label([G[0], G[1] - e * 0.5, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const zf = z / 2 + 0.002, o = R(Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), 0), nrm = R(0, 1), tg = R(1, 0);
      arrow3(v, [o[0] - nrm[0] * e * 0.4, o[1] - nrm[1] * e * 0.4, zf], [o[0], o[1], zf], RCOL, 2.4); v.label([o[0] - nrm[0] * e * 0.45, o[1] - nrm[1] * e * 0.45, zf], val('N', `${fmt(g.N)} ${F}`), RCOL);
      if (Math.abs(g.Ff) > 1e-12) { const sg = -Math.sign(g.Ff); arrow3(v, [o[0], o[1], zf], [o[0] + sg * tg[0] * e * 0.4, o[1] + sg * tg[1] * e * 0.4, zf], FCOL, 2.4); v.label([o[0] + sg * tg[0] * e * 0.45, o[1] + sg * tg[1] * e * 0.45, zf], val('F', `${fmt(Math.abs(g.Ff))} ${F}`), FCOL); }
      if (Math.abs(g.P) > 0) { const at = R(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); arrow3(v, [at[0] - d[0] * e * 0.5, at[1] - d[1] * e * 0.5, 0], [at[0], at[1], 0], LCOL, 2.6); v.label([at[0] - d[0] * e * 0.55, at[1] - d[1] * e * 0.55, 0], val('P', `${fmt(Math.abs(g.P))} ${F}`), LCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'incline') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], bs = 0.17, z = 0.3, zb = 0.1, top = R(1, 0);
      v._hs = 0.045;
      v.box(-0.3, -0.04, -z * 1.3, top[0] + 0.12, 0, z * 1.3, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude([[0, 0], [top[0], 0], top], -z, z, '#e3e9ed', 1, GEDGE, { layer: rest([-sp, cp, 0]) }); // the block rests on the slope
      const sc = inclinePos(g);
      v.extrude([R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)], -zb, zb, WOOD, 1, WEDGE);
      const G = R(sc, bs / 2), b0 = R(sc, 0), n = R(0, 1), t = R(1, 0), zf = zb + 0.002;
      arrow3(v, [G[0], G[1], 0], [G[0], G[1] - 0.25, 0], LCOL); v.label([G[0], G[1] - 0.28, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [b0[0] - n[0] * 0.22, b0[1] - n[1] * 0.22, zf], [b0[0], b0[1], zf], RCOL); v.label([b0[0] - n[0] * 0.25, b0[1] - n[1] * 0.25, zf], val('N', `${fmt(g.N)} ${F}`), RCOL);
      if (g.Ff > 1e-12) { const sg = g.fUp ? 1 : -1, f0 = R(sc + sg * bs * 0.5, 0); arrow3(v, [f0[0], f0[1], zf], [f0[0] + sg * t[0] * 0.24, f0[1] + sg * t[1] * 0.24, zf], FCOL); v.label([f0[0] + sg * t[0] * 0.27, f0[1] + sg * t[1] * 0.27, zf], val('F', `${fmt(g.Ff)} ${F}`), FCOL); }
      if (g.task !== 'release' && g.P > 0) {
        const d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG));
        if (g.psi > 0) { const at = R(sc + bs / 2, bs / 2); arrow3(v, [at[0], at[1], 0], [at[0] + d[0] * 0.28, at[1] + d[1] * 0.28, 0], LCOL, 2.6); v.label([at[0] + d[0] * 0.3, at[1] + d[1] * 0.3, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
        else { const at = R(sc - bs / 2, bs / 2); arrow3(v, [at[0] - d[0] * 0.28, at[1] - d[1] * 0.28, 0], [at[0], at[1], 0], LCOL, 2.6); v.label([at[0] - d[0] * 0.32, at[1] - d[1] * 0.32, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
      }
      v.autoBounds(); return;
    }
    if (g.kind === 'ladder') {
      const th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)], w = L * 0.12; v._hs = L * 0.05;
      v.box(-L * 0.04, 0, -L * 0.35, 0, B[1] * 1.2, L * 0.35, GROUND, 1, GEDGE);
      v.box(-L * 0.04, -L * 0.03, -L * 0.35, A[0] * 1.3, 0, L * 0.35, '#cfd8de', 1, GEDGE, { layer: -1 });
      [-w, w].forEach((zz) => v.line([[A[0], A[1], zz], [B[0], B[1], zz]], WEDGE, 4));
      for (let k = 1; k < 10; k++) { const t = k / 10; v.line([[A[0] * (1 - t), B[1] * t, -w], [A[0] * (1 - t), B[1] * t, w]], WEDGE, 2); }
      const m = [A[0] / 2, B[1] / 2, 0]; arrow3(v, m, [m[0], m[1] - L * 0.25, 0], LCOL, 2.4); v.label([m[0], m[1] - L * 0.28, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [A[0], -L * 0.25, 0], [A[0], 0, 0], RCOL, 2.4); v.label([A[0], -L * 0.28, 0], val('N_A', `${fmt(g.NA)} ${F}`), RCOL);
      if (g.FA > 0) { arrow3(v, [A[0] + L * 0.02, 0.01, w], [A[0] - L * 0.22, 0.01, w], FCOL, 2.4); v.label([A[0] - L * 0.3, 0.01, w], val('F_A', `${fmt(g.FA)} ${F}`), FCOL); }
      arrow3(v, [B[0] + L * 0.01, B[1], 0], [B[0] + L * 0.25, B[1], 0], RCOL, 2.4); v.label([B[0] + L * 0.28, B[1], 0], val('N_B', `${fmt(g.NB)} ${F}`), RCOL);
      if (g.FB > 0) { arrow3(v, [B[0] + 0.01, B[1] - L * 0.02, w], [B[0] + 0.01, B[1] + L * 0.2, w], FCOL, 2.4); v.label([B[0], B[1] + L * 0.23, w], val('F_B', `${fmt(g.FB)} ${F}`), FCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'wedge') {
      // the same layout as the 2D diagram: thick end at the left, face falling to the right, load resting on the face at B
      const lever = g.load === 'lever', ta = Math.tan(g.al * DEG), Lw = 1, t = Lw * Math.max(ta, 0.2), sa = Math.sin(g.al * DEG), ca = Math.cos(g.al * DEG);
      const k = lever ? 1 / (0.55 * g.a) : 1, a = lever ? g.a * k : 0, xB = Lw * 0.5, yB = t * 0.5, xA = xB + a, hL = (lever ? a : Lw) * 0.08;
      const zw = 0.3, xmin = -Lw * 0.6, xmax = lever ? xA + a * 0.15 : Lw * 1.5, face = (x) => t * (1 - x / Lw);
      v._hs = 0.06;
      v.box(xmin, -0.05, -0.5, xmax, 0, 0.5, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude([[0, 0], [Lw, 0], [0, t]], -zw, zw, STEEL, 1, GEDGE, { layer: rest([t, Lw, 0]) }); // the load rests on the sloped face
      let topW;
      if (lever) {
        const zl = 0.12;
        v.box(xB, yB, -zl, xA + a * 0.06, yB + hL, zl, WOOD, 1, WEDGE);
        v.extrude([[xA - 0.1, 0], [xA + 0.1, 0], [xA + 0.025, yB - 0.01], [xA - 0.025, yB - 0.01]], -0.09, 0.09, '#b9c4cc', 1, GEDGE);
        v.line([[xA, yB, -zl - 0.06], [xA, yB, zl + 0.06]], '#1d2733', 4);
        v.label([xA + 0.03, yB + hL + 0.02, zl], 'A', '#1d2733');
        const xw = xA - g.xW * k; topW = [xw, yB + hL, 0];
      } else {
        const bw = Lw * 0.36, bh = Lw * 0.4, x0 = xB - bw / 2, yt = face(x0) + bh, zb = 0.2;
        v.extrude([[x0, face(x0)], [x0 + bw, face(x0 + bw)], [x0 + bw, yt], [x0, yt]], -zb, zb, WOOD, 1, WEDGE);
        [[x0 - 0.06, x0 - 0.012], [x0 + bw + 0.012, x0 + bw + 0.06]].forEach(([u0, u1]) => v.box(u0, Math.max(yB + bh * 0.1, face(u0) + 0.03), -zw, u1, yB + bh * 1.6, zw, '#b9c4cc', 0.45, GEDGE));
        topW = [xB, yt, 0];
      }
      arrow3(v, [topW[0], topW[1] + 0.4, topW[2]], topW, LCOL, 2.6); v.label([topW[0], topW[1] + 0.44, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      // forces on the wedge at the front edge: N_B and friction at B, N_C, and the push or pull P at the thick end
      const zf = zw + 0.002, raise = g.task === 'raise', tf = raise ? [-ca, sa] : [ca, -sa];
      arrow3(v, [xB + sa * 0.3, yB + ca * 0.3, zf], [xB, yB, zf], RCOL); v.label([xB + sa * 0.33, yB + ca * 0.33, zf], val('N_B', `${fmt(g.NB)} ${F}`), RCOL);
      arrow3(v, [xB, yB, zf], [xB + tf[0] * 0.26, yB + tf[1] * 0.26, zf], FCOL); v.label([xB + tf[0] * 0.3, yB + tf[1] * 0.3 + 0.03, zf], 'μN_B', FCOL);
      v.label([xB - 0.02, yB - 0.06, zf], 'B', '#1d2733');
      arrow3(v, [Lw * 0.22, -0.3, zf], [Lw * 0.22, 0, zf], RCOL); v.label([Lw * 0.22, -0.34, zf], val('N_C', `${fmt(g.NC)} ${F}`), RCOL); v.label([Lw * 0.08, -0.02, zf], 'C', '#1d2733');
      const pull = g.P >= 0 ? !raise : raise, yP = t * 0.45;
      if (pull) arrow3(v, [0, yP, 0], [-0.45, yP, 0], LCOL, 2.8); else arrow3(v, [-0.45, yP, 0], [-0.005, yP, 0], LCOL, 2.8);
      v.label([-0.55, yP + 0.03, 0], val('P', `${fmt(Math.abs(g.P))} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'screw') {
      // jack: base, a square-threaded screw (pitch drawn from the lead angle), the load plate and the turning moment
      const r = 1, ri = 0.78, ro = 1.18, h = 3.6, pitch = Math.max(0.32, Math.min(1, 2 * Math.PI * r * Math.tan(g.th * DEG))), tw = pitch * 0.5, n = 40;
      v._hs = 0.22;
      v.lathe([[0, -1.1], [2.2, -1.1], [1.55, 0.15], [0, 0.15]], '#b9c4cc', 1, null, 40);
      v.lathe([[0, 0], [ri, 0], [ri, h], [0, h]], STEEL, 1, null, 36);
      const turns = Math.floor((h - 0.3) / pitch);
      for (let i = 0; i < turns * n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, y0 = 0.15 + (i / n) * pitch, y1 = 0.15 + ((i + 1) / n) * pitch;
        const P = (rr, a, y) => [rr * Math.cos(a), y, rr * Math.sin(a)];
        v.face([P(ro, a0, y0), P(ro, a1, y1), P(ro, a1, y1 + tw), P(ro, a0, y0 + tw)], '#aebbc4', 1, null);
        v.face([P(ri, a0, y0 + tw), P(ro, a0, y0 + tw), P(ro, a1, y1 + tw), P(ri, a1, y1 + tw)], '#d5dee4', 1, null);
        v.face([P(ri, a0, y0), P(ro, a0, y0), P(ro, a1, y1), P(ri, a1, y1)], '#9fadb7', 1, null);
      }
      v.box(-1.5, h, -1.5, 1.5, h + 0.35, 1.5, WOOD, 1, WEDGE);
      arrow3(v, [0, h + 2.2, 0], [0, h + 0.4, 0], LCOL, 2.6); v.label([0.2, h + 2.3, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const yM = h * 0.55, rm = 2.1, arc = [], sgn = g.task === 'raise' ? 1 : -1;
      for (let i = 0; i <= 40; i++) { const a = sgn * (i / 40) * 1.6 * Math.PI; arc.push([rm * Math.cos(a), yM, rm * Math.sin(a)]); }
      v.line(arc, FCOL, 2.4); arrow3(v, arc[arc.length - 3], arc[arc.length - 1], FCOL, 2.4);
      v.label([rm + 0.1, yM, 0], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'bearing') {
      v._hs = 0.12;
      if (g.type === 'collar' || g.type === 'disk') {
        const R2 = 1, R1 = g.R1 / g.R2, rs = R1 > 0 ? R1 * 0.8 : 0.3;
        v.lathe([[R1, -0.6], [1.5, -0.6], [1.5, 0], [R1, 0]], GROUND, 1, GEDGE, 40);
        v.lathe([[R1 * 0.999, 0], [R2, 0], [R2, 0.25], [0, 0.25], [0, 0.2], [R1 * 0.999, 0.2]].filter((p, i) => R1 > 0 || i < 4), STEEL, 1, null, 40);
        v.lathe([[0, 0.25], [rs, 0.25], [rs, 1.8], [0, 1.8]], '#dfe5ea', 1, null, 30);
        arrow3(v, [0, 2.8, 0], [0, 1.85, 0], LCOL, 2.6); v.label([0.12, 2.85, 0], val('P', `${fmt(g.P)} ${F}`), LCOL);
        const arc = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * 1.6 * Math.PI; arc.push([(rs + 0.45) * Math.cos(a), 1.2, (rs + 0.45) * Math.sin(a)]); }
        v.line(arc, FCOL, 2.4); arrow3(v, arc[37], arc[40], FCOL, 2.4); v.label([rs + 0.55, 1.25, 0], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
        v.autoBounds(); return;
      }
      if (g.type === 'journal') {
        const ring = (r, n) => { const p = []; for (let k = 0; k < n; k++) { const t = (k / n) * 2 * Math.PI; p.push([r * Math.cos(t), r * Math.sin(t)]); } return p; };
        v.box(-1.8, -1.9, -0.7, 1.8, -1.45, 0.7, GROUND, 1, GEDGE);
        v.extrude(ring(1, 36).map(([x, y]) => [x, y + 0.12]), -1.2, 1.2, STEEL, 1, null);
        arrow3(v, [0, 2.3, 0], [0, 1.2, 0], LCOL, 2.6); v.label([0.12, 2.35, 0], val('R', `${fmt(g.R)} ${F}`), LCOL);
        const arc = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * 1.6 * Math.PI; arc.push([1.35 * Math.cos(a), 1.35 * Math.sin(a), 1.25]); }
        v.line(arc, FCOL, 2.4); arrow3(v, arc[37], arc[40], FCOL, 2.4); v.label([1.4, 0.2, 1.25], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
        v.autoBounds(); return;
      }
      const ring = []; for (let k = 0; k < 36; k++) { const t = (k / 36) * 2 * Math.PI; ring.push([Math.cos(t), 1 + Math.sin(t)]); }
      v.box(-2.2, -0.15, -0.8, 2.6, 0, 0.8, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude(ring, -0.3, 0.3, '#3b444b', 1, '#1d2733');
      arrow3(v, [0, 2.6, 0], [0, 2.02, 0], LCOL, 2.6); v.label([0.12, 2.65, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [-2, 1, 0.32], [-0.02, 1, 0.32], LCOL, 2.6); v.label([-2.1, 1.1, 0.32], val('P', `${fmt(g.P)} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'vehicle') {
      const L = g.L, ang = (g.rise === 'B' ? 1 : -1) * g.phi * DEG, ca = Math.cos(ang), sa = Math.sin(ang), R = (u, w) => [u * ca - w * sa, u * sa + w * ca];
      const cs = carShape(g), zw = L * 0.32, ext = 0.55 * L; v._hs = L * 0.05;
      v.extrude([R(-ext, 0), R(L + ext, 0), R(L + ext, -0.06 * L), R(-ext, -0.06 * L)], -zw * 1.7, zw * 1.7, GROUND, 1, GEDGE, { layer: rest([-sa, ca, 0]) });
      v.extrude(cs.pts.map(([u, w]) => R(u, w)), -zw * 0.68, zw * 0.68, '#7fb3d5', 1, '#2e5f80');
      [0, L].forEach((x, i) => {
        const ring = []; for (let k = 0; k < 24; k++) { const t = (k / 24) * 2 * Math.PI; ring.push(R(x + cs.rw * Math.cos(t), cs.rw + cs.rw * Math.sin(t))); }
        [[zw * 0.7, zw * 1.02], [-zw * 1.02, -zw * 0.7]].forEach(([z0, z1]) => v.extrude(ring, z0, z1, '#3b444b', 1, '#1d2733'));
        if (g[i ? 'axB' : 'axA'] === 'locked') v.label([...R(x, cs.rw * 2.3), zw * 1.05], 'locked', '#a3281f');
      });
      const G = R(g.a, g.h), zf = zw * 1.04;
      arrow3(v, [G[0], G[1], 0], [G[0], G[1] - L * 0.35, 0], LCOL, 2.6); v.label([G[0], G[1] - L * 0.38, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const n = R(0, 1), t = R(1, 0);
      [['A', 0, g.NA, g.FA], ['B', L, g.NB, g.FB]].forEach(([k, x, N, Ff]) => {
        const o = R(x, 0), sN = Math.sign(N || 1);
        arrow3(v, [o[0] - n[0] * L * 0.3 * sN, o[1] - n[1] * L * 0.3 * sN, zf], [o[0], o[1], zf], RCOL, 2.4); v.label([o[0] - n[0] * L * 0.34, o[1] - n[1] * L * 0.34, zf], val(`N_${k}`, `${fmt(N)} ${F}`), RCOL);
        if (Math.abs(Ff) > 1e-9 * g.W) { const sg = Math.sign(Ff); arrow3(v, [o[0], o[1], zf], [o[0] + sg * t[0] * L * 0.28, o[1] + sg * t[1] * L * 0.28, zf], FCOL, 2.4); v.label([o[0] + sg * t[0] * L * 0.32, o[1] + sg * t[1] * L * 0.32, zf], val(`F_${k}`, `${fmt(Math.abs(Ff))} ${F}`), FCOL); }
      });
      if (g.useP && g.P > 0) { const at = R(g.xP, g.yP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); arrow3(v, [at[0], at[1], 0], [at[0] + d[0] * L * 0.4, at[1] + d[1] * L * 0.4, 0], LCOL, 2.6); v.label([at[0] + d[0] * L * 0.44, at[1] + d[1] * L * 0.44, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
      v.autoBounds(); return;
    }
    // belt: each drum with the belt wrapped over its contact angle and the tensions on the two free ends
    const R = 1, rb = 1.04, zb = 0.28;
    v._hs = 0.16;
    g.drums.forEach((d, i) => {
      const cx = i * 3.6, ring = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * 2 * Math.PI; ring.push([cx + R * Math.cos(a), R * Math.sin(a)]); }
      v.extrude(ring, -0.45, 0.45, '#dfe5ea', 1, null);
      v.line([[cx, 0, -0.7], [cx, 0, 0.7]], '#1d2733', 4);
      const vis = Math.min(d.deg, 359.5), a0 = 90 + vis / 2, a1 = 90 - vis / 2, nseg = Math.max(6, Math.round(vis / 6));
      for (let k = 0; k < nseg; k++) {
        const p = (a1 + (vis * k) / nseg) * DEG, q = (a1 + (vis * (k + 1)) / nseg) * DEG;
        v.face([[cx + rb * Math.cos(p), rb * Math.sin(p), -zb], [cx + rb * Math.cos(q), rb * Math.sin(q), -zb], [cx + rb * Math.cos(q), rb * Math.sin(q), zb], [cx + rb * Math.cos(p), rb * Math.sin(p), zb]], '#2c3e50', 1, null);
      }
      [[a0, 1], [a1, -1]].forEach(([a, sg], kk) => {
        const ar = a * DEG, px = cx + rb * Math.cos(ar), py = rb * Math.sin(ar), tx = -Math.sin(ar) * sg, ty = Math.cos(ar) * sg, Lt = 1.1;
        v.face([[px, py, -zb], [px + tx * Lt, py + ty * Lt, -zb], [px + tx * Lt, py + ty * Lt, zb], [px, py, zb]], '#2c3e50', 1, null);
        const big = kk === 0, Tv = g.hi ? (kk === 0 ? g.Ts[i] : g.Ts[i + 1]) : (kk === 0 ? g.Ts[i + 1] : g.Ts[i]);
        arrow3(v, [px + tx * Lt * 0.6, py + ty * Lt * 0.6, zb + 0.01], [px + tx * (Lt + 0.5), py + ty * (Lt + 0.5), zb + 0.01], big ? LCOL : RCOL, 2.6);
        v.label([px + tx * (Lt + 0.6), py + ty * (Lt + 0.6), zb], opt.showP ? `${fmt(Tv)} ${F}` : (big ? 'T₂' : 'T₁'), big ? LCOL : RCOL);
      });
      v.label([cx - 0.3, -R - 0.35, 0.45], `Drum ${i + 1}`, '#1d2733');
    });
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const B = (o) => ({ mode: 'block', fu: 'N', bk: o });
  M.presets = [
    { name: 'Test: Book Example 8.1, crate pushed at 30° (does it move?)', units: 'SI', state: B({ wBy: 'mass', m: 20, b: 0.8, H: 0.6, phi: 0, mu: 0.3, task: 'check', P: 80, psi: -30, hP: 0.2 }),
      expect: [{ k: 'Friction needed F', v: 69.28 }, { k: 'Normal force N', v: 236.2 }, { k: 'Position of N, x', v: -0.00908 }, { k: 'Largest friction μs N', v: 70.86 }] },
    { name: 'Test: Book Example 8.2, angle of repose on a 25° truck bed', units: 'US', state: { mode: 'block', fu: 'lb', bk: { wBy: 'force', W: 500, b: 3, H: 5, phi: 25, mu: 0.4663077, task: 'check', P: 0, psi: 0, hP: 0 } },
      expect: [{ k: 'Position of N, x', v: -1.166 }, { k: 'Normal force N', v: 453.15 }, { k: 'Friction needed F', v: -211.31 }] },
    { name: 'Test: closed form, block pushed at 0.8 m tips before it slips', units: 'SI', state: B({ wBy: 'force', W: 500, b: 0.6, H: 1, phi: 0, mu: 0.4, task: 'findP', psi: 0, hP: 0.8 }),
      expect: [{ k: 'P to tip', v: 187.5 }, { k: 'P to slip', v: 200 }] },
    { name: 'Block pushed up a 20° slope', units: 'SI', state: { mode: 'block', fu: 'kN', bk: { wBy: 'force', W: 2, b: 0.5, H: 0.8, phi: 20, mu: 0.35, task: 'findP', psi: 10, hP: 0.3 } } },
    { name: 'Test: closed form, 20 kg block released on a 30° slope slides 3 m', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.25, task: 'release', d: 3 } },
      expect: [{ k: 'Acceleration down the slope a', v: 2.7811 }, { k: 'Time to slide 3 m', v: 1.4688 }, { k: 'Speed after that distance', v: 4.0849 }, { k: 'Normal force N', v: 169.91 }] },
    { name: 'Test: Dynamics F13-1, 20 kg crate pulled up a 30° slope at 1.333 m/s²', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.3, task: 'up', psi: 0, acc: 1.333333 } },
      expect: [{ k: 'P to keep it moving up', v: 175.74 }, { k: 'Normal force N', v: 169.91 }] },
    { name: 'Test: Dynamics F14-10, 20 kg crate pushed up a 30° slope at steady speed', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.25, muk: 0.2, task: 'up', psi: 0, acc: 0 } },
      expect: [{ k: 'P to keep it moving up', v: 132.08 }, { k: 'Kinetic friction F', v: 33.98 }] },
    { name: 'Test: closed form, force to hold a 20 kg block on a 30° slope', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.25, task: 'hold', psi: 0 } },
      expect: [{ k: 'P to hold the block', v: 47.126 }, { k: 'Largest P before it slides up', v: 149.07 }] },
    { name: 'Crate held on a 40° ramp by a rope at 20°', units: 'US', state: { mode: 'incline', fu: 'lb', ic: { wBy: 'force', W: 150, phi: 40, mus: 0.35, muk: 0.3, task: 'hold', psi: 20 } } },
    { name: 'Test: Book Example 8.3, smallest angle of a ladder on a smooth wall', units: 'SI', state: { mode: 'ladder', fu: 'N', ld: { wBy: 'mass', m: 10, L: 4, muA: 0.3, muB: 0, task: 'minAngle', person: false } },
      expect: [{ k: 'Smallest angle θ (from the floor)', v: 59.04 }, { k: 'N_A', v: 98.1 }, { k: 'F_A', v: 29.43 }, { k: 'N_B', v: 29.43 }] },
    { name: 'Ladder at 70° with a person three-quarters up, rough wall', units: 'US', state: { mode: 'ladder', fu: 'lb', ld: { wBy: 'force', W: 40, L: 16, muA: 0.25, muB: 0.2, task: 'check', th: 70, person: true, wpBy: 'force', Wp: 180, s: 12 } } },
    { name: 'Test: Book Example 8.6, pulling the wedge out from under a 500 kg stone', units: 'SI', state: { mode: 'wedge', fu: 'N', wd: { load: 'lever', wBy: 'mass', m: 500, al: 7, mu: 0.3, muC: 0.3, muG: 0, a: 1, xW: 0.5, task: 'lower' } },
      expect: [{ k: 'Pull to remove, P', v: 1154.9 }, { k: 'N_B', v: 2383.1 }, { k: 'N_C', v: 2452.5 }] },
    { name: 'Wedge raising a block in a guide', units: 'SI', state: { mode: 'wedge', fu: 'kN', wd: { load: 'guide', wBy: 'force', W: 8, al: 12, mu: 0.25, muC: 0.25, muG: 0.15, task: 'raise' } } },
    { name: 'Test: Book Example 8.7, turnbuckle with two screws', units: 'SI', state: { mode: 'screw', fu: 'N', sc: { W: 2000, r: 5, l: 2, mu: 0.25, n: 2, task: 'raise' } },
      expect: [{ k: 'Moment to raise M', v: 6.375 }, { k: 'Lead angle θ', v: 3.643 }, { k: 'Friction angle φs', v: 14.04 }] },
    { name: 'Screw with a steep thread that is not self-locking', units: 'US', state: { mode: 'screw', fu: 'lb', sc: { W: 1500, r: 0.4, l: 0.9, mu: 0.15, n: 1, task: 'lower' } } },
    { name: 'Test: Book Example 8.8, cord over two drums holding a hanging mass', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'high', T: 500, drums: [{ beta: 135, turns: 0, mu: 0.25 }, { beta: 135, turns: 0, mu: 0.25 }] } },
      expect: [{ k: 'Tension after drum 1', v: 277.4 }, { k: 'Tension after drum 2', v: 153.9 }, { k: 'Mass that can be held', v: 15.69 }] },
    { name: 'Rope with two turns around a capstan', units: 'US', state: { mode: 'belt', fu: 'lb', bt: { known: 'low', T: 20, drums: [{ beta: 0, turns: 2, mu: 0.3 }] } } },
    { name: 'Test: car parked on a 12° incline with the rear wheels locked (Ellis\'s Problem 14)', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 1500, a: 1.5, b: 3, h: 1.1, phi: 12, rise: 'A', mu: 0.6, axA: 'locked', axB: 'free', task: 'park', front: 'B', hasP: false } },
      expect: [{ k: 'Normal force at A, N_A', v: 8847.8 }, { k: 'Normal force at B, N_B', v: 5545.7 }, { k: 'Friction at A, F_A', v: -3059.4 }] },
    { name: 'Test: Prob. 8-3, mine car with both brakes locked and a 10 kN push (does it move?)', units: 'SI', state: { mode: 'vehicle', fu: 'kN', vh: { wBy: 'mass', m: 6000, a: 0.9, b: 0.6, h: 0.15, phi: 0, rise: 'B', mu: 0.4, axA: 'locked', axB: 'locked', task: 'park', front: 'B', hasP: true, P: 10, xP: 0, yP: 1.05, psi: 0 } },
      expect: [{ k: 'Normal force at A, N_A', v: 16.544 }, { k: 'Normal force at B, N_B', v: 42.316 }] },
    { name: 'Test: Prob. 8-5, towing force with the back brakes locked', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 2000, a: 1, b: 1.5, h: 0.6, phi: 0, rise: 'B', mu: 0.3, axA: 'free', axB: 'locked', task: 'force', front: 'A', xP: -0.75, yP: 0.3, psi: 150, move: 'A' } },
      expect: [{ k: 'Force P', v: 2762.7 }, { k: 'Normal force at B, N_B', v: 7975.3 }, { k: 'Normal force at A, N_A', v: 10263.3 }] },
    { name: 'Test: Prob. 8-6, towing force with all brakes locked', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 2000, a: 1, b: 1.5, h: 0.6, phi: 0, rise: 'B', mu: 0.3, axA: 'locked', axB: 'locked', task: 'force', front: 'A', xP: -0.75, yP: 0.3, psi: 150, move: 'A' } },
      expect: [{ k: 'Force P', v: 5793.2 }] },
    { name: 'Test: Prob. 8-14, steepest road shoulder before the car slips or tips', units: 'US', state: { mode: 'vehicle', fu: 'lb', vh: { wBy: 'force', W: 3527, a: 2.5, b: 2.5, h: 2.5, rise: 'A', mu: 0.4, axA: 'locked', axB: 'locked', task: 'slope', front: 'B' } },
      expect: [{ k: 'Steepest slope φ_max', v: 21.801 }, { k: 'Slope at which it tips', v: 45 }] },
    { name: 'Test: Prob. 8-107, collar bearing carrying 5 kN', units: 'SI', state: { mode: 'bearing', fu: 'N', be: { kind: 'collar', P: 5000, R1: 0.075, R2: 0.1, mu: 0.3, task: 'M' } },
      expect: [{ k: 'Moment to turn M', v: 132.14 }] },
    { name: 'Test: Prob. 8-109, floor polisher (disk bearing, R = 1 ft)', units: 'US', state: { mode: 'bearing', fu: 'lb', be: { kind: 'disk', P: 80, R2: 1, mu: 0.3, task: 'M' } },
      expect: [{ k: 'Moment to turn M', v: 16 }] },
    { name: 'Test: Prob. 8-119, 50 kg disk on a 30 mm shaft (journal bearing)', units: 'SI', state: { mode: 'bearing', fu: 'N', be: { kind: 'journal', W: 490.5, rs: 0.015, mu: 0.15, task: 'M' } },
      expect: [{ k: 'Friction circle radius r_f', v: 0.0022251 }] },
    { name: 'Test: closed form, rolling resistance of a 16 000 lb tractor, a = 2 in., r = 2.5 ft', units: 'US', state: { mode: 'bearing', fu: 'lb', be: { kind: 'rolling', W: 16000, rw: 2.5, a: 0.1666667, aB: 0 } },
      expect: [{ k: 'Force to roll P', v: 1066.67 }] },
    { name: 'Test: μs for impending motion of a 200 lb crate on a 30° slope held by 76 lb', units: 'US', state: { mode: 'incline', fu: 'lb', ic: { wBy: 'force', W: 200, phi: 30, task: 'mu', P: 76, psi: 0 } },
      expect: [{ k: 'μs for impending motion', v: 0.13856 }] },
    { name: 'Edge: a pull that lifts the block off the floor (fails on purpose)', units: 'SI', fails: true, state: B({ wBy: 'force', W: 100, b: 0.5, H: 0.5, phi: 0, mu: 0.3, task: 'check', P: 300, psi: 60, hP: 0.4 }) },
  ];

  root.SFriction = M;
})(window);
