/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M4 Beam Stresses
 * (inputs, diagrams, presets). Physics: md/beamstress.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, BeamStress, MD, MDUI, Section } = root;
  const { fmt } = Core;
  const { COL } = UI;
  const T = Charts.text, svgEl = UI.svgEl;
  const LCOL = COL.load, RCOL = COL.react, DCOL = '#0f8a7e', EDGE = '#4a5661', BODY = '#b9c2cb';
  const TEN = '#c0392b', CMP = '#2f6fb3', SC = COL.shear, HELD = '#e9a23b', ACC = COL.accent;
  const LET = 'ABCDEFGH';

  const M = { id: 'beamstress', title: 'Beam Stresses', defaults: BeamStress.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;
  const kD = () => (S()._k === undefined ? 1 : S()._k);
  const bends = () => S().defl !== false && mode() !== 'flow' && !(mode() === 'shear' && S().ld.src !== 'beam');
  const usesBeam = () => mode() !== 'unsym' && !(mode() === 'flow' && S().fw.task === 'V') && S().ld.src === 'beam';

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const HOLE = [['false', 'Solid'], ['true', 'Hole (subtract)']];
  const fixHole = (it) => { it.hole = it.hole === true || it.hole === 'true'; };
  const KINDS = Section.KINDS.filter((k) => k[0] !== 'sector');
  const SHAPES = [['rect', 'Rectangle'], ['circle', 'Solid circle'], ['I', 'I or wide-flange'], ['T', 'T section'], ['C', 'Channel'], ['box', 'Box (hollow rectangle)'], ['pipe', 'Pipe']];
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], sys = M.units, fu = BeamStress.FU[sys].includes(st.fu) ? st.fu : BeamStress.FU[sys][0], u = MD.units(U, fu);
    const num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Find', get: () => st.mode, set: (v) => { st.mode = v; delete st._k; }, options: [['flexure', 'Bending stress (flexure formula)'], ['shear', 'Shear stress (shear formula)'], ['flow', 'Shear flow and fastener spacing'], ['unsym', 'Bending about an inclined axis'], ['design', 'Design: size or check a beam']] });
    C.seg(sec, { label: 'Force unit', get: () => fu, set: (v) => (st.fu = v), options: BeamStress.FU[sys].map((f) => [f, f]) });
    const q = st.sec, needSec = !(st.mode === 'design' && st.dz.kind !== 'check');
    if (st.mode === 'design') {
      sec = C.section(c, 'Design');
      C.select(sec, { label: 'Task', get: () => st.dz.kind, set: (v) => (st.dz.kind = v), options: [['W', 'Pick the lightest W shape'], ['rect', 'Size a rectangle (h = r b)'], ['circle', 'Size a solid round bar'], ['check', 'Check the section below']] });
      num(sec, st.dz, 'sA', 'Allowable bending stress σ_allow', u.ST);
      num(sec, st.dz, 'tA', 'Allowable shear stress τ_allow', u.ST);
      if (st.dz.kind === 'rect') num(sec, st.dz, 'ratio', 'Depth to width ratio r = h/b', '');
      if (st.dz.kind === 'W') C.note(sec, 'The table holds the wide-flange shapes of Appendix C (U.S. sizes; values are converted for SI).');
    }
    if (needSec) {
      sec = C.section(c, 'Cross-section');
      C.seg(sec, { label: 'Section from', get: () => q.src, set: (v) => (q.src = v), options: [['shape', 'A shape'], ['W', 'W table'], ['parts', 'Parts']] });
      if (q.src === 'shape') {
        C.select(sec, { label: 'Shape', get: () => q.shape, set: (v) => (q.shape = v), options: SHAPES });
        const sh = q.shape;
        if (sh === 'rect') { num(sec, q, 'b', 'Width b', u.S); num(sec, q, 'h', 'Depth h', u.S); }
        else if (sh === 'circle') num(sec, q, 'D', 'Diameter', u.S);
        else if (sh === 'pipe') { num(sec, q, 'd', 'Outside diameter D', u.S); num(sec, q, 't', 'Wall thickness t', u.S); }
        else if (sh === 'box') { num(sec, q, 'bf', 'Width b', u.S); num(sec, q, 'd', 'Depth d', u.S); num(sec, q, 't', 'Wall thickness t', u.S); }
        else {
          num(sec, q, 'bf', sh === 'T' ? 'Flange width b_f' : 'Flange width b_f', u.S); num(sec, q, 'd', 'Depth d', u.S);
          num(sec, q, 'tf', 'Flange thickness t_f', u.S); num(sec, q, 'tw', sh === 'T' ? 'Stem thickness t_w' : 'Web thickness t_w', u.S);
          if (sh === 'T') C.toggle(sec, { label: 'Upside down (flange at the bottom)', get: () => !!q.flip, set: (v) => (q.flip = v) });
        }
      } else if (q.src === 'W') {
        C.select(sec, { label: 'Shape', get: () => q.W, set: (v) => (q.W = v), options: BeamStress.WT.map((w) => [w.name, w.name]) });
        C.note(sec, 'Properties come from the table; the drawing uses the flange and web sizes without the fillets.');
      } else {
        C.note(sec, '(x, y) is each part\'s anchor: the lower-left corner of a rectangle or triangle, the centre of a circle. y is up.');
        C.list(sec, {
          items: q.parts, max: 8, min: 1, color: (it) => (it.hole === true ? '#f6c9c2' : '#dfe6ea'), title: (it, i) => `Part ${i + 1}: ${Section.NAME[it.kind]}${it.hole === true ? ' (hole)' : ''}`,
          fields: (it) => {
            const f = [{ key: 'kind', label: 'Shape', options: KINDS, onset: (p) => { if (!(p.r > 0)) p.r = u.S === 'mm' ? 50 : 1; if (!(p.b > 0)) p.b = u.S === 'mm' ? 50 : 1; if (!(p.h > 0)) p.h = u.S === 'mm' ? 50 : 1; } }, { key: 'hole', label: 'Solid or hole', options: HOLE, onset: fixHole }, { key: 'x', label: 'Anchor x', unit: u.S }, { key: 'y', label: 'Anchor y', unit: u.S }];
            if (it.kind === 'rect' || it.kind === 'tri') f.push({ key: 'b', label: 'Width b', unit: u.S }, { key: 'h', label: 'Height h', unit: u.S });
            else f.push({ key: 'r', label: 'Radius r', unit: u.S, wide: true });
            return f;
          },
          add: [['Rectangle', () => ({ kind: 'rect', x: 0, y: 0, b: u.S === 'mm' ? 50 : 1, h: u.S === 'mm' ? 50 : 1, r: 0, rot: 0, hole: false })], ['Circle', () => ({ kind: 'circle', x: 0, y: 0, r: u.S === 'mm' ? 25 : 1, b: 0, h: 0, rot: 0, hole: false })]],
        });
      }
    }
    if (st.mode === 'unsym') {
      const o = st.un;
      sec = C.section(c, 'Moment');
      C.note(sec, 'z points right and y up on the section (x into the page). θ is measured from the +z axis toward the +y axis.');
      C.seg(sec, { label: 'Moment given as', get: () => o.by, set: (v) => (o.by = v), options: [['angle', 'Size and angle'], ['comp', 'Components']] });
      if (o.by === 'angle') { num(sec, o, 'M', 'Moment M', u.FL); num(sec, o, 'th', 'Angle θ', '°'); }
      else { num(sec, o, 'Mz', 'M_z (about z)', u.FL); num(sec, o, 'My', 'M_y (about y)', u.FL); }
      return;
    }
    if (!(st.mode === 'flow' && st.fw.task === 'V')) loadControls(c, C, st, u);
    if (st.mode === 'flexure') {
      sec = C.section(c, 'Point on the section');
      C.toggle(sec, { label: 'Find the stress at a point', get: () => !!st.fl.pt, set: (v) => (st.fl.pt = v) });
      if (st.fl.pt) num(sec, st.fl, 'y', 'Height above the neutral axis y', u.S);
    } else if (st.mode === 'shear') {
      sec = C.section(c, 'Level on the section');
      num(sec, st.sh, 'y', 'Height above the neutral axis y', u.S);
    } else if (st.mode === 'flow') {
      const o = st.fw;
      sec = C.section(c, 'Fasteners');
      C.seg(sec, { label: 'Held piece', get: () => o.held, set: (v) => (o.held = v), options: [['part', 'One part'], ['above', 'Area above a seam']] });
      if (o.held === 'part') C.select(sec, { label: 'The fasteners hold', get: () => String(o.part), set: (v) => (o.part = +v), options: (q.src === 'parts' ? q.parts : partsOf()).map((p, i) => [String(i + 1), `Part ${i + 1}`]) });
      else num(sec, o, 'y', 'Seam height above the neutral axis', u.S);
      num(sec, o, 'n', 'Rows of fasteners (or glued seams)', '');
      C.seg(sec, { label: 'Find', get: () => o.task, set: (v) => (o.task = v), options: [['s', 'Spacing s'], ['V', 'Largest shear V']] });
      num(sec, o, 'F', o.task === 's' ? 'Strength of one fastener F (0 = glue)' : 'Strength of one fastener F', u.F);
      if (o.task === 'V') num(sec, o, 's', 'Spacing s', u.S);
      else num(sec, o, 'step', 'Round the spacing down to (0 = no rounding)', u.S);
    }
  };
  /** Parts of the current shape (for the part picker of the shear-flow mode). */
  function partsOf() { try { const s = BeamStress.section(S().sec, MD.units(Core.UNITS[M.units], S().fu)); return s.ok ? s.parts : [{}]; } catch (e) { return [{}]; } }
  function loadControls(c, C, st, u) {
    const l = st.ld, b = l.bm, num = (s2, o, k, label, unit) => C.num(s2, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    let sec = C.section(c, 'Loading');
    C.seg(sec, { label: 'Loading from', get: () => l.src, set: (v) => { l.src = v; delete st._k; }, options: [['given', 'Typed in'], ['beam', 'A beam']] });
    const needM = st.mode === 'flexure' || st.mode === 'design', needV = st.mode !== 'flexure';
    if (l.src === 'given') {
      if (needM) num(sec, l, 'M', 'Internal moment M', u.FL);
      if (needV) num(sec, l, 'V', 'Internal shear V', u.F);
      return;
    }
    C.seg(sec, { label: 'Section at', get: () => l.at, set: (v) => (l.at = v), options: [['max', st.mode === 'design' ? 'The largest V and M' : `The largest ${needM ? 'M' : 'V'}`], ['x', 'A chosen x']] });
    if (l.at === 'x') num(sec, l, 'x', 'Distance from the left end x', u.L);
    sec = C.section(c, 'Beam');
    num(sec, b, 'L', 'Length L', u.L);
    C.seg(sec, { label: 'Supports', get: () => b.sup, set: (v) => (b.sup = v), options: [['simple', 'Pin and roller'], ['cant', 'Fixed at the left end']] });
    if (b.sup === 'simple') { num(sec, b, 'xa', 'Pin A at x', u.L); num(sec, b, 'xb', 'Roller B at x', u.L); }
    sec = C.section(c, 'Loads on the beam');
    C.list(sec, {
      items: b.loads, max: 6, min: 0, color: () => '#f6dcd6', title: (it, i) => `Load ${i + 1}: ${{ point: 'Force (down)', dist: 'Distributed load (down)', couple: 'Couple' }[it.kind]}`,
      fields: (it) => it.kind === 'point' ? [{ key: 'x', label: 'At x', unit: u.L }, { key: 'P', label: 'Force P', unit: u.F }]
        : it.kind === 'couple' ? [{ key: 'x', label: 'At x', unit: u.L }, { key: 'M', label: 'Couple M', unit: u.FL }, { key: 'dir', label: 'Turns', options: [['ccw', 'Counterclockwise'], ['cw', 'Clockwise']], wide: true }]
          : [{ key: 'x1', label: 'From x₁', unit: u.L }, { key: 'x2', label: 'To x₂', unit: u.L }, { key: 'w1', label: 'w at x₁', unit: u.W }, { key: 'w2', label: 'w at x₂', unit: u.W }],
      add: [['Force', () => ({ kind: 'point', x: b.L / 2, P: 10, x1: 0, x2: 0, w1: 0, w2: 0, M: 0, dir: 'ccw' })], ['Distributed', () => ({ kind: 'dist', x1: 0, x2: b.L, w1: 5, w2: 5, x: 0, P: 0, M: 0, dir: 'ccw' })], ['Couple', () => ({ kind: 'couple', x: b.L / 2, M: 10, dir: 'ccw', x1: 0, x2: 0, w1: 0, w2: 0, P: 0 })]],
    });
  }
  M.diagram = function (c, C) {
    const st = S();
    if (mode() !== 'flow') C.toggle(c, { label: 'Show the bending (exaggerated)', get: () => st.defl !== false, set: (v) => { st.defl = v; delete st._k; } });
    if (usesBeam()) C.toggle(c, { label: 'Show the beam and its moment or shear diagram', get: () => st.beamView !== false, set: (v) => (st.beamView = v) });
    if (mode() === 'design' && st.dz.kind === 'check') C.toggle(c, { label: 'Show the shear stress beside the bending stress', get: () => st.both !== false, set: (v) => (st.both = v) });
  };

  M.compute = (U) => BeamStress.solve(S(), U);
  M.onUnits = (from, to) => BeamStress.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ flexure: 'Section, neutral axis and bending stress', shear: 'Section and shear stress', flow: 'Built-up section and the piece the fasteners hold', unsym: 'Section, moment and neutral axis', design: 'Beam and section' }[mode()]);
  M.cap3D = () => '3D beam segment';
  M.hint = () => ({
    flexure: 'The stress grows in a straight line from zero at the neutral axis to σ_max at the farthest fibre. A positive moment squeezes the top. Press Play to watch the segment bend (exaggerated).',
    shear: 'τ = VQ/(It): zero at the top and bottom, largest where Q/t is largest. It jumps where the width changes.',
    flow: 'The highlighted piece is held on by the fasteners. The shear flow q is the force per length they must carry.',
    unsym: 'The moment vector is drawn as a double arrow. The neutral axis tilts toward the weak axis, so it is not perpendicular to the moment unless I_y = I_z.',
    design: 'The section is sized for bending first, then checked for shear.',
  }[mode()]);
  M.legend = () => {
    const m = mode(), beam = usesBeam() && S().beamView !== false;
    const base = { flexure: [[TEN, 'Tension', 'sq'], [CMP, 'Compression', 'sq']], shear: [[SC, 'Shear stress τ', 'sq'], [ACC, 'Level', 'ln']], flow: [[HELD, 'Held piece', 'sq'], [SC, 'Shear flow q']], unsym: [[COL.couple, 'Moment vector'], [DCOL, 'Neutral axis', 'ln'], [TEN, 'Tension', 'sq'], [CMP, 'Compression', 'sq']], design: [[TEN, 'Tension', 'sq'], [CMP, 'Compression', 'sq']] }[m];
    return (beam ? [[LCOL, 'Loads'], [DCOL, 'Deflected shape', 'ln']] : []).concat(base);
  };
  const deflect = root.Anim.deflection(S);
  M.anim = () => (bends() ? deflect : null);

  /* ------------------------------------------------------------------ */
  /* 2D: section with the stress distributions                          */
  /* ------------------------------------------------------------------ */
  const val = (opt, a, b) => (opt.showP ? a : b);
  const fb = (v, unit) => fmt(MD.fromBase(v, unit));
  /** Draw the section (outlines relative to the centroid, z right, y up) on D; returns its extent. */
  function drawSection(D, g, o) {
    o = o || {};
    const s = g.s, zb = s.zb, yb = s.yb, shift = (p) => [p[0] - zb, p[1] - yb];
    s.outlines.forEach((ol, i) => { if (ol.sign > 0) D.poly(ol.pts.map(shift), { fill: o.fill ? o.fill(i) : BODY, fop: 0.95, stroke: EDGE, sw: 1.3 }); });
    s.outlines.forEach((ol) => { if (ol.sign < 0) D.poly(ol.pts.map(shift), { fill: '#ffffff', stroke: EDGE, sw: 1.3 }); });
    return { zmin: s.box.xmin - zb, zmax: s.box.xmax - zb, ymin: s.box.ymin - yb, ymax: s.box.ymax - yb };
  }
  function naLine(D, ex, label) {
    const w = ex.zmax - ex.zmin;
    D.line([ex.zmin, 0], [ex.zmax + w * 0.12, 0], { stroke: DCOL, sw: 1.5, dash: '8 5' });
    D.text([ex.zmax + w * 0.12, 0], label || 'N.A.', { anchor: 'end', dy: -5, size: 11.5, color: DCOL, weight: 700 });
    D.circle([0, 0], (ex.ymax - ex.ymin) * 0.012, { fill: EDGE });
  }
  function secDims(D, g, ex, u) {
    D.dim([ex.zmin, ex.ymin], [ex.zmax, ex.ymin], `${fmt(MD.fromBase(ex.zmax - ex.zmin, u.S))} ${u.S}`, 22);
  }
  /** Linear bending-stress block beside the section, from x0 to the right; σ(y) given in display units. */
  function sigmaBlock(D, x0, ex, sig, smax, wid, opt, u, labels) {
    const sc = wid / (smax || 1), ys = [ex.ymin, 0, ex.ymax];
    D.line([x0, ex.ymin - (ex.ymax - ex.ymin) * 0.06], [x0, ex.ymax + (ex.ymax - ex.ymin) * 0.06], { stroke: COL.axis, sw: 1.2 });
    [[ex.ymin, 0], [0, ex.ymax]].forEach(([a, b]) => {
      const sa = sig(a), sb = sig(b), col = (sa + sb) / 2 >= 0 ? TEN : CMP;
      D.poly([[x0, a], [x0 + sa * sc, a], [x0 + sb * sc, b], [x0, b]], { fill: col, fop: 0.22, stroke: col, sw: 1.6 });
      for (let i = 0; i <= 5; i++) { const y = a + ((b - a) * i) / 5, sv = sig(y); if (Math.abs(sv * sc) > wid * 0.08) D.arrow([x0, y], [x0 + sv * sc, y], { color: sv >= 0 ? TEN : CMP, w: 1.3, head: 7 }); }
    });
    void ys;
    (labels || []).forEach(([y, v, extra]) => { if (Math.abs(v) < 1e-12) return; D.text([x0 + v * sc, y], val(opt, `${fmt(v)} ${u.ST}${extra || ''}`, extra ? extra.trim() : ''), { anchor: 'middle', dy: y > 0 ? -8 : 17, size: 11.5, color: v >= 0 ? TEN : CMP, weight: 700 }); });
    D.text([x0, ex.ymax + (ex.ymax - ex.ymin) * 0.06], `σ (${u.ST})`, { anchor: 'middle', dy: -22, size: 11.5, color: COL.ink });
  }
  /** Shear-stress profile beside the section. prof = [{y, tau}] with y absolute; display units. */
  function tauBlock(D, x0, ex, prof, yb, tmax, wid, opt, u) {
    const sc = wid / (tmax || 1), pts = prof.map((p) => [x0 + Math.abs(MD.fromBase(p.tau, u.ST)) * sc, p.y - yb]);
    D.line([x0, ex.ymin - (ex.ymax - ex.ymin) * 0.06], [x0, ex.ymax + (ex.ymax - ex.ymin) * 0.06], { stroke: COL.axis, sw: 1.2 });
    D.poly([[x0, ex.ymin]].concat(pts, [[x0, ex.ymax]]), { fill: SC, fop: 0.2, stroke: 'none' });
    D.pline(pts, { stroke: SC, sw: 2 });
    for (let i = 1; i < 10; i++) { const y = ex.ymin + ((ex.ymax - ex.ymin) * i) / 10, p = interp(pts, y); if (p - x0 > wid * 0.08) D.arrow([x0, y], [p, y], { color: SC, w: 1.2, head: 7 }); }
    D.text([x0, ex.ymax + (ex.ymax - ex.ymin) * 0.06], `τ (${u.ST})`, { anchor: 'middle', dy: -6, size: 11.5, color: COL.ink });
  }
  const interp = (pts, y) => { for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if ((a[1] - y) * (b[1] - y) <= 0 && b[1] !== a[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]); } return pts[0][0]; };

  M.draw2D = function (svg, res, U, opt) {
    const g = res.geo, u = g.u, beamOn = !!g.beam && S().beamView !== false;
    const H = svg.clientHeight || 560, padB = beamOn ? Math.max(210, H * 0.46) : 0;
    const ex0 = { zmin: g.s.box.xmin - g.s.zb, zmax: g.s.box.xmax - g.s.zb, ymin: g.s.box.ymin - g.s.yb, ymax: g.s.box.ymax - g.s.yb };
    const h = ex0.ymax - ex0.ymin, w = ex0.zmax - ex0.zmin, side = g.kind === 'unsym' || g.kind === 'design' || g.kind === 'flow' ? 0 : 1, two = g.kind === 'check' && S().both !== false;
    const wid = Math.max(h * 0.75, w * 0.6), sg = g.kind === 'flexure' || g.kind === 'check' ? [g.M * (ex0.ymax), -g.M * ex0.ymin] : [0, 0], sm = Math.max(Math.abs(sg[0]), Math.abs(sg[1])) || 1;
    const negF = Math.max(0, sg[0] / sm, -sg[1] / sm), posF = Math.max(0, -sg[0] / sm, sg[1] / sm); // the compressive and tensile parts of the block, as fractions of its width
    const x0 = ex0.zmax + Math.max(w * 0.35, h * 0.3) + wid * negF, x1 = x0 + wid * (g.kind === 'shear' ? 1 : posF) + h * 0.55;
    const xr = side ? (two ? x1 + wid * 0.8 + h * 0.3 : x0 + wid * (g.kind === 'shear' ? 1 : posF) + h * 0.3) : ex0.zmax + w * 0.3 + (g.kind === 'unsym' ? h * 0.5 : g.kind === 'flow' ? h * 0.9 : 0);
    const D = UI.Draw2D(svg, { xmin: ex0.zmin - w * 0.3 - h * 0.45, xmax: xr, ymin: ex0.ymin - h * 0.2, ymax: ex0.ymax + h * 0.18 }, { padB, pad: 30 });
    const ex = drawSection(D, g, { fill: g.kind === 'flow' && g.held && g.held.part !== undefined ? (i) => (i === g.held.part ? HELD : BODY) : null });
    if (g.kind !== 'unsym') naLine(D, ex);
    secDims(D, g, ex, u);
    const yOn = g.kind !== 'unsym' && g.kind !== 'design';
    D.dim([ex.zmin, ex.ymin], [ex.zmin, ex.ymax], `${fmt(MD.fromBase(h, u.S))} ${u.S}`, yOn ? 58 : 18);
    if (yOn) D.dim([ex.zmin, ex.ymin], [ex.zmin, 0], `ȳ = ${fmt(MD.fromBase(-ex.ymin, u.S))}`, 18);
    if (g.kind !== 'unsym') D.text([(ex.zmin + ex.zmax) / 2, ex.ymax], g.s.W || g.s.name, { anchor: 'middle', dy: -10, size: 12, color: COL.dim });
    const ST = u.ST, sD = (v) => MD.fromBase(v, ST);
    if (g.kind === 'flexure' || g.kind === 'check') {
      const k = bends() ? kD() : 1, sig = (y) => sD((-g.M * y) / g.I) * k, smx = sD(g.smax);
      sigmaBlock(D, x0, ex, sig, smx, wid, opt, u, [[ex.ymax, sig(ex.ymax), sD(g.sTop || (-g.M * ex.ymax) / g.I) < 0 ? ' (C)' : ' (T)'], [ex.ymin, sig(ex.ymin), sig(ex.ymin) < 0 ? ' (C)' : ' (T)']]);
      if (g.kind === 'flexure' && g.yP !== null && g.yP !== undefined) {
        D.line([ex.zmin, g.yP], [x0 + sig(g.yP) * (wid / (smx || 1)), g.yP], { stroke: ACC, sw: 1.2, dash: '4 3' });
        D.circle([0, g.yP], h * 0.018, { fill: ACC, stroke: '#fff', sw: 1 });
        D.text([ex.zmax, g.yP], val(opt, `P: σ = ${fmt(sD(g.sP))} ${ST}`, 'P'), { anchor: 'start', dx: 6, dy: g.yP >= 0 ? 15 : -6, size: 11.5, color: ACC, weight: 700 });
      }
      if (two) tauBlock(D, x1, ex, g.prof, g.s.yb, Math.abs(sD(g.best.tau)), wid * 0.8, opt, u), D.text([x1 + Math.abs(sD(g.best.tau)) * 0.8 * wid / Math.abs(sD(g.best.tau) || 1), g.best.y - g.s.yb], val(opt, `${fmt(Math.abs(sD(g.best.tau)))}`, 'τ_max'), { dx: 6, dy: 4, size: 11.5, color: SC, weight: 700 });
    } else if (g.kind === 'shear') {
      const tm = Math.abs(sD(g.best.tau)), y0 = g.y0 - g.s.yb;
      tauBlock(D, x0, ex, g.prof, g.s.yb, tm, wid, opt, u);
      D.line([ex.zmin - w * 0.1, y0], [x0 + wid, y0], { stroke: ACC, sw: 1.4, dash: '5 4' });
      D.text([x0 + Math.abs(sD(g.tau)) * (wid / (tm || 1)), y0], val(opt, `τ = ${fmt(Math.abs(sD(g.tau)))} ${ST}`, 'τ'), { anchor: 'start', dx: 6, dy: y0 >= g.best.y - g.s.yb ? -6 : 14, size: 11.5, color: ACC, weight: 700 });
      const by = g.best.y - g.s.yb;
      if (Math.abs(by - y0) > h * 0.06) D.text([x0 + wid, by], val(opt, `τ_max = ${fmt(tm)}`, 'τ_max'), { anchor: 'start', dx: 6, dy: 4, size: 11.5, color: SC, weight: 700 });
      // the area above the level, lightly shaded
      D.poly([[ex.zmin, y0], [ex.zmax, y0], [ex.zmax, ex.ymax], [ex.zmin, ex.ymax]], { fill: ACC, fop: 0.1, stroke: 'none' });
      D.text([ex.zmin, (y0 + ex.ymax) / 2], 'A′', { anchor: 'end', dx: -6, dy: 4, size: 12, color: ACC, weight: 700 });
    } else if (g.kind === 'flow') {
      if (g.held.y0 !== undefined) { const y0 = g.held.y0 - g.s.yb; D.poly([[ex.zmin, y0], [ex.zmax, y0], [ex.zmax, ex.ymax], [ex.zmin, ex.ymax]], { fill: HELD, fop: 0.35, stroke: HELD, sw: 1.4 }); D.line([ex.zmin - w * 0.1, y0], [ex.zmax + w * 0.1, y0], { stroke: ACC, sw: 1.4, dash: '5 4' }); }
      const qv = MD.fromBase(g.qv, u.q);
      D.text([ex.zmax + w * 0.12, ex.ymax - h * 0.08], val(opt, `q = ${fmt(qv)} ${u.q}`, 'q'), { anchor: 'start', size: 12.5, color: SC, weight: 700 });
      if (g.n > 1 && opt.showP) D.text([ex.zmax + w * 0.12, ex.ymax - h * 0.08], `${g.n} rows: ${fmt(qv / g.n)} ${u.q} each`, { anchor: 'start', dy: 18, size: 11.5, color: SC });
      if (g.sp && opt.showP) D.text([ex.zmax + w * 0.12, ex.ymax - h * 0.08], `s = ${fmt(MD.fromBase(g.sp, u.S))} ${u.S}`, { anchor: 'start', dy: 36, size: 12, color: COL.ink, weight: 700 });
      if (g.held.part !== undefined) { const p = g.s.outlines[g.held.part].pts, c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); D.text([c[0] - g.s.zb, c[1] - g.s.yb], 'held', { anchor: 'middle', dy: 4, size: 11, color: '#7a4d0b', weight: 700 }); }
    } else if (g.kind === 'unsym') drawUnsym(D, g, ex, opt, u);
    else if (g.kind === 'design') {
      const d = g.dim || {};
      D.text([(ex.zmin + ex.zmax) / 2, ex.ymin], val(opt, g.pick ? `S = ${fmt(MD.fromBase(g.Sreq, u.Q))} ${u.Q} needed` : d.d ? `d = ${fmt(MD.fromBase(d.d, u.S))} ${u.S}` : `b = ${fmt(MD.fromBase(d.b, u.S))}, h = ${fmt(MD.fromBase(d.h, u.S))} ${u.S}`, ''), { anchor: 'middle', dy: 44, size: 12, color: COL.ink, weight: 700 });
    }
    if (beamOn) beamBand(svg, g, D, H - padB + 6, padB - 10);
  };

  function drawUnsym(D, g, ex, opt, u) {
    const h = ex.ymax - ex.ymin, w = ex.zmax - ex.zmin, R = Math.max(h, w) * 0.62;
    // shade the section by stress: tension red, compression blue, in strips across the neutral axis
    const smx = Math.max(Math.abs(g.tmax.s), Math.abs(g.cmax.s)) || 1, n = 28;
    const al = g.alpha * Math.PI / 180, nx = -Math.sin(al), ny = Math.cos(al); // unit normal to the neutral axis
    const dist = (p) => p[0] * nx + p[1] * ny, all = []; g.s.outlines.forEach((o) => o.pts.forEach((p) => all.push([p[0] - g.s.zb, p[1] - g.s.yb])));
    const dmin = Math.min(...all.map(dist)), dmax = Math.max(...all.map(dist));
    g.s.outlines.forEach((o) => {
      if (o.sign < 0) return;
      const pts = o.pts.map((p) => [p[0] - g.s.zb, p[1] - g.s.yb]);
      for (let i = 0; i < n; i++) {
        const a = dmin + ((dmax - dmin) * i) / n, b = dmin + ((dmax - dmin) * (i + 1)) / n, cl = clipBand(pts, nx, ny, a, b);
        if (cl.length < 3) continue;
        const mid = cl.reduce((s, p) => [s[0] + p[0] / cl.length, s[1] + p[1] / cl.length], [0, 0]), sv = g.sig(mid[1], mid[0]) / smx;
        D.poly(cl, { fill: sv >= 0 ? TEN : CMP, fop: Math.min(0.75, 0.08 + 0.6 * Math.abs(sv)), stroke: 'none' });
      }
    });
    g.s.outlines.forEach((o) => D.poly(o.pts.map((p) => [p[0] - g.s.zb, p[1] - g.s.yb]), { fill: o.sign < 0 ? '#ffffff' : 'none', stroke: EDGE, sw: 1.4 }));
    // axes
    D.arrow([0, 0], [R * 0.95, 0], { color: COL.axis, w: 1.4, head: 9 }); D.text([R * 0.95, 0], 'z', { dx: 4, dy: 14, size: 13, weight: 700 });
    D.arrow([0, 0], [0, R * 0.95], { color: COL.axis, w: 1.4, head: 9 }); D.text([0, R * 0.95], 'y', { dx: 6, dy: 4, size: 13, weight: 700 });
    // neutral axis
    D.line([-R * Math.cos(al), -R * Math.sin(al)], [R * Math.cos(al), R * Math.sin(al)], { stroke: DCOL, sw: 2, dash: '9 5' });
    D.text([R * Math.cos(al), R * Math.sin(al)], val(opt, `N.A., α = ${fmt(g.alpha)}°`, 'N.A.'), { anchor: Math.cos(al) >= 0 ? 'start' : 'end', dx: 6, dy: 4, size: 12, color: DCOL, weight: 700 });
    // moment vector (double-headed arrow)
    const Mv = Math.hypot(g.Mz, g.My), th = Math.atan2(g.My, g.Mz), mx = R * 0.7 * Math.cos(th), my = R * 0.7 * Math.sin(th);
    D.arrow([0, 0], [mx, my], { color: COL.couple, w: 2.6, head: 12 }); D.arrow([0, 0], [mx * 0.84, my * 0.84], { color: COL.couple, w: 2.6, head: 12 });
    D.text([mx, my], val(opt, `M = ${fmt(MD.fromBase(Mv, u.FL))} ${u.FL}`, 'M'), { anchor: mx >= 0 ? 'start' : 'end', dx: mx >= 0 ? 6 : -6, dy: my >= 0 ? -6 : 14, size: 12, color: COL.couple, weight: 700 });
    if (g.crn.length) g.crn.forEach((c) => D.text([c.z, c.y], val(opt, `${fmt(MD.fromBase(c.s, u.ST))}`, ''), { anchor: c.z >= 0 ? 'start' : 'end', dx: c.z >= 0 ? 6 : -6, dy: c.y >= 0 ? -6 : 14, size: 11.5, color: c.s >= 0 ? TEN : CMP, weight: 700 }));
    else [g.tmax, g.cmax].forEach((c) => { D.circle([c.z, c.y], h * 0.015, { fill: c.s >= 0 ? TEN : CMP }); D.text([c.z, c.y], val(opt, `${fmt(MD.fromBase(c.s, u.ST))} ${u.ST}`, c.s >= 0 ? 'σ_t' : 'σ_c'), { anchor: c.z >= 0 ? 'start' : 'end', dx: c.z >= 0 ? 7 : -7, dy: c.y >= 0 ? -6 : 14, size: 11.5, color: c.s >= 0 ? TEN : CMP, weight: 700 }); });
  }
  /** Part of a polygon between two lines a ≤ (p·n) ≤ b. */
  function clipBand(pts, nx, ny, a, b) {
    const clip = (P, f) => { const out = []; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], fp = f(p), fq = f(q); if (fp >= 0) out.push(p); if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } } return out; };
    return clip(clip(pts, (p) => p[0] * nx + p[1] * ny - a), (p) => b - (p[0] * nx + p[1] * ny));
  }

  /** The beam with its loads, deflected shape, and the M (or V) diagram, drawn below the section. */
  function beamBand(svg, g, D, top, hgt) {
    const b = g.beam, u = g.u, L = b.L, W = D.W, ml = 64, mr = 34, pw = W - ml - mr, X = (x) => ml + (x / L) * pw;
    const grp = svgEl('g', {}, svg), bh = hgt * 0.42, yb = top + bh * 0.55, bt = 5;
    const showV = mode() === 'shear' || mode() === 'flow';
    // loads
    const wmax = Math.max(1e-12, ...b.dists.map((d) => Math.max(Math.abs(d.w1), Math.abs(d.w2))));
    b.dists.forEach((d) => {
      const hh = (w) => 6 + 20 * (Math.abs(w) / wmax), xa = X(d.x1), xb = X(d.x2), n = Math.max(2, Math.round((xb - xa) / 18));
      svgEl('polygon', { points: `${xa},${yb - bt - hh(d.w1)} ${xb},${yb - bt - hh(d.w2)} ${xb},${yb - bt} ${xa},${yb - bt}`, fill: LCOL, 'fill-opacity': 0.12, stroke: LCOL, 'stroke-width': 1.2 }, grp);
      for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n, w = d.w1 + ((d.w2 - d.w1) * i) / n, hx = hh(w); if (hx > 8) arrowP(grp, x, yb - bt - hx, x, yb - bt, LCOL, 1.2, 5); }
      T(grp, (xa + xb) / 2, yb - bt - hh(Math.max(d.w1, d.w2)) - 5, d.w1 === d.w2 ? `${fmt(d.w1)} ${u.W}` : `${fmt(d.w1)} to ${fmt(d.w2)} ${u.W}`, { anchor: 'middle', color: LCOL, size: 11 });
    });
    b.acts.forEach((a) => {
      if (a.P !== undefined && a.Fy) { const x = X(a.x); arrowP(grp, x, yb - bt - 34, x, yb - bt, LCOL, 2.2, 9); T(grp, x, yb - bt - 38, `${fmt(Math.abs(a.P))} ${u.F}`, { anchor: 'middle', color: LCOL, size: 11, weight: 700 }); }
      else if (a.Mz) { const x = X(a.x); svgEl('path', { d: `M${x - 11},${yb + 9} A13,13 0 1,1 ${x + 11},${yb + 9}`, fill: 'none', stroke: COL.couple, 'stroke-width': 2 }, grp); T(grp, x, yb - 18, `${fmt(Math.abs(a.Mz))} ${u.FL}`, { anchor: 'middle', color: COL.couple, size: 11, weight: 700 }); }
    });
    // beam, then the deflected shape
    svgEl('rect', { x: X(0), y: yb - bt, width: pw, height: 2 * bt, fill: BODY, stroke: EDGE, 'stroke-width': 1.2 }, grp);
    if (bends() && b.defl && !b.defl.flat) {
      const vm = Math.abs(b.defl.max.y) || 1, k = kD(), pts = [];
      for (let i = 0; i <= 120; i++) { const x = (L * i) / 120; pts.push(`${X(x).toFixed(1)},${(yb - (b.defl.y(x) / vm) * 16 * k).toFixed(1)}`); }
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: DCOL, 'stroke-width': 2.4, 'stroke-dasharray': '7 4' }, grp);
    }
    // supports
    b.sups.forEach((sp) => {
      const x = X(sp.x), sy = yb + bt;
      if (sp.type === 'fixed') svgEl('rect', { x: x - 11, y: yb - 24, width: 11, height: 48, fill: 'url(#hatch)', stroke: COL.support, 'stroke-width': 1.2 }, grp);
      else {
        if (sp.type === 'pin') svgEl('polygon', { points: `${x},${sy} ${x - 9},${sy + 15} ${x + 9},${sy + 15}`, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }, grp);
        else svgEl('circle', { cx: x, cy: sy + 7, r: 7, fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }, grp);
        svgEl('line', { x1: x - 13, y1: sy + 15, x2: x + 13, y2: sy + 15, stroke: COL.support, 'stroke-width': 1.4 }, grp);
      }
      T(grp, x + (sp.x > L / 2 ? 14 : -14), sy + 14, sp.label, { anchor: sp.x > L / 2 ? 'start' : 'end', size: 12, weight: 700, color: COL.ink });
    });
    // the section where the stresses are found
    const xs = showV ? g.xV : g.xM;
    if (xs !== undefined) { const x = X(xs); svgEl('line', { x1: x, y1: yb - 30, x2: x, y2: yb + 26, stroke: ACC, 'stroke-width': 1.6, 'stroke-dasharray': '5 3' }, grp); T(grp, x, yb + 38, `section, x = ${fmt(xs)} ${u.L}`, { anchor: xs > L * 0.75 ? 'end' : xs < L * 0.25 ? 'start' : 'middle', size: 11, color: ACC, weight: 700 }); }
    // diagram
    const fh = hgt - bh - 46, xsP = [];
    for (let i = 0; i <= 200; i++) xsP.push((L * i) / 200);
    b.events && b.events.forEach && b.events.forEach((e) => { const x = typeof e === 'number' ? e : e.x; if (isFinite(x)) xsP.push(x - 1e-9 * L, x + 1e-9 * L); });
    const pts = xsP.filter((x) => x >= 0 && x <= L).sort((a, c) => a - c).map((x) => { const r = b.at(x); return [x, showV ? r.V : r.M]; });
    const lo = Math.min(0, ...pts.map((p) => p[1])), hi = Math.max(0, ...pts.map((p) => p[1]));
    const col = showV ? COL.shear : COL.moment;
    const F = Charts.frame(svg, { x: X(0), y: top + bh + 12, w: pw, h: fh, xmin: 0, xmax: L, ymin: lo, ymax: hi, ylabel: showV ? `V (${u.F})` : `M (${u.FL})`, ycolor: col, yside: 44, padY: 0.2, xlabel: `x (${u.L})` });
    Charts.curve(F, [[0, 0]].concat(pts, [[L, 0]]), { color: col, fill: col, fop: 0.2, width: 2 });
    if (xs !== undefined) { const r = b.at(xs, xs >= L - 1e-9 ? 'L' : 'R'), v = showV ? r.V : r.M; Charts.mark(F, xs, v, `${fmt(v)}`, { color: ACC, anchor: xs > L * 0.7 ? 'end' : 'start', dx: xs > L * 0.7 ? -8 : 8, dy: v >= 0 ? -6 : 14 }); }
  }
  function arrowP(parent, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    svgEl('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w }, parent);
    svgEl('polygon', { points: `${x2},${y2} ${x2 - ux * hs - uy * hs * 0.42},${y2 - uy * hs + ux * hs * 0.42} ${x2 - ux * hs + uy * hs * 0.42},${y2 - uy * hs - ux * hs * 0.42}`, fill: color }, parent);
  }

  /* ------------------------------------------------------------------ */
  /* 3D: a beam segment, bent by the moment, with the stress block      */
  /* ------------------------------------------------------------------ */
  function inside(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  M.draw3D = function (v, res, U, opt) {
    const g = res.geo, u = g.u, s = g.s, h = s.box.ymax - s.box.ymin, w = s.box.xmax - s.box.xmin, sc = 2.4 / Math.max(h, w);
    const Lx = 3 * Math.max(h, w) * sc, x0 = -Lx / 2, n = 16;
    const Mb = g.kind === 'unsym' ? null : g.M, k = bends() ? kD() : 0;
    // curvature: the drawing exaggerates it to a fixed size; positive M is concave up
    let ky = 0, kz = 0;
    if (g.kind === 'unsym') { const Iz = g.s.Iz, Iy = g.s.Iy, m = Math.hypot(g.Mz / Iz, g.My / Iy) || 1; ky = (0.22 * (g.Mz / Iz)) / m; kz = (0.22 * (g.My / Iy)) / m; }
    else if (Mb) ky = 0.22 * Math.sign(Mb);
    ky *= k / (Lx / 2); kz *= k / (Lx / 2);
    // a point (x along the beam, y up, z across) of the straight segment moved by the bending
    const P = (x, y, z) => { const th = ky * x, ph = kz * x; return [x - y * th + z * ph, y + (ky * x * x) / 2, z - (kz * x * x) / 2]; };
    const outl = s.outlines.map((o) => ({ sign: o.sign, pts: o.pts.map((p) => [(p[0] - s.zb) * sc, (p[1] - s.yb) * sc]) }));
    const solids = outl.filter((o) => o.sign > 0);
    outl.forEach((o, oi) => {
      const pts = o.pts, held = g.kind === 'flow' && g.held && g.held.part === oi, fill = held ? HELD : BODY;
      const area = pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ez = b[0] - a[0], ey = b[1] - a[1], ll = Math.hypot(ez, ey) || 1;
        let nz = (ey / ll) * area, ny = (-ez / ll) * area; if (o.sign < 0) { nz = -nz; ny = -ny; }
        const m = pts.length > 8 ? 1 : 24; // straight sides are cut into pieces so a piece hidden where two parts touch can be left out
        for (let t = 0; t < m; t++) {
          const pa = [a[0] + (ez * t) / m, a[1] + (ey * t) / m], pb = [a[0] + (ez * (t + 1)) / m, a[1] + (ey * (t + 1)) / m];
          const mid = [(pa[0] + pb[0]) / 2 + nz * 1e-4, (pa[1] + pb[1]) / 2 + ny * 1e-4];
          if (o.sign > 0 && solids.some((q) => q !== o && inside(mid, q.pts))) continue;
          for (let j = 0; j < n; j++) {
            const xa = x0 + (Lx * j) / n, xb = x0 + (Lx * (j + 1)) / n;
            v.face([P(xa, pa[1], pa[0]), P(xb, pa[1], pa[0]), P(xb, pb[1], pb[0]), P(xa, pb[1], pb[0])], o.sign < 0 ? '#9aa5ad' : fill, 1, 'fill', 1, 0, [0, ny, nz]);
          }
        }
      }
    });
    [[x0, -1], [x0 + Lx, 1]].forEach(([x, sg]) => {
      const nrm = [sg, 0, 0];
      outl.forEach((o, oi) => { const held = g.kind === 'flow' && g.held && g.held.part === oi; v.face(o.pts.map((p) => P(x, p[1], p[0])), o.sign < 0 ? '#5d6973' : held ? HELD : '#cfd8de', 1, o.sign < 0 ? EDGE : 'fill', 1, o.sign < 0 ? 1 : 0, nrm); });
    });
    const xe = x0 + Lx, ext = { ymin: (s.box.ymin - s.yb) * sc, ymax: (s.box.ymax - s.yb) * sc, zmin: (s.box.xmin - s.zb) * sc, zmax: (s.box.xmax - s.zb) * sc };
    v._hs = 0.16;
    if (g.kind === 'flexure' || g.kind === 'check' || g.kind === 'design' || g.kind === 'unsym') {
      // stress block on the right-hand end: arrows normal to the face, in proportion to σ
      const sig = g.kind === 'unsym' ? (y, z) => g.sig(y / sc, z / sc) : g.kind === 'design' ? (y) => -Math.sign(g.M || 1) * y : (y) => (-g.M * (y / sc)) / g.I;
      let smx = 0; [ext.ymin, ext.ymax].forEach((y) => [ext.zmin, ext.zmax].forEach((z) => (smx = Math.max(smx, Math.abs(sig(y, z))))));
      const L1 = 1.1 / (smx || 1), th = ky * xe;
      const out = (y, z, sv) => { const p = P(xe, y, z), d = sv * L1, tip = [p[0] + d * Math.cos(th), p[1] + d * Math.sin(th), p[2]]; return { p, tip }; };
      const nzS = 5, nyS = 9;
      for (let a = 0; a <= nzS; a++) for (let b = 0; b <= nyS; b++) {
        const z = ext.zmin + ((ext.zmax - ext.zmin) * a) / nzS, y = ext.ymin + ((ext.ymax - ext.ymin) * b) / nyS;
        if (!solids.some((q) => inside([z, y], q.pts) || Math.abs(y - ext.ymin) < 1e-9 || Math.abs(y - ext.ymax) < 1e-9) || !solids.some((q) => inside([z + (z > 0 ? -1e-3 : 1e-3), y + (y > 0 ? -1e-3 : 1e-3)], q.pts))) continue;
        const sv = sig(y, z); if (Math.abs(sv) < smx * 0.06) continue;
        const r = out(y, z, sv);
        MDUI.arrow3(v, sv > 0 ? r.p : r.tip, sv > 0 ? r.tip : r.p, sv > 0 ? TEN : CMP, 1.4, 0.12);
      }
      if (g.kind === 'unsym') {
        // the neutral axis across the end face
        const al = (g.alpha * Math.PI) / 180, c = Math.cos(al), sn = Math.sin(al), lim = (lo, hi, d) => (Math.abs(d) < 1e-9 ? Infinity : Math.min(Math.abs(lo / d), Math.abs(hi / d)));
        const t = Math.min(lim(ext.zmin, ext.zmax, c), lim(ext.ymin, ext.ymax, sn));
        v.line([P(xe + 0.01, -t * sn, -t * c), P(xe + 0.01, t * sn, t * c)], DCOL, 3);
        v.label(P(xe, t * sn, t * c), 'N.A.', DCOL);
      } else {
        // outline of the linear block at the middle of the width
        const tA = out(ext.ymax, 0, sig(ext.ymax, 0)), tB = out(ext.ymin, 0, sig(ext.ymin, 0));
        v.line([P(xe, ext.ymax, 0), tA.tip, tB.tip, P(xe, ext.ymin, 0)], '#222', 1.2);
        if (opt.showP && g.smax !== undefined) v.label(tA.tip, `${fmt(MD.fromBase(Math.abs(sig(ext.ymax, 0)), u.ST))} ${u.ST}`, sig(ext.ymax, 0) >= 0 ? TEN : CMP);
      }
    } else if (g.kind === 'shear') {
      // shear stresses on the end face, acting along −y for a positive V, in proportion to τ(y), drawn along the middle of the width
      const tm = Math.abs(g.best.tau) || 1, L1 = 0.9 / tm;
      g.prof.forEach((p, i) => {
        if (i % 12 !== 6) return;
        const y = (p.y - s.yb) * sc, t = Math.abs(p.tau) * L1; if (t < 0.05) return;
        const a = P(xe + 0.02, y + t / 2, 0), b = P(xe + 0.02, y - t / 2, 0);
        MDUI.arrow3(v, a, b, SC, 1.6, 0.1);
      });
      const y0 = (g.y0 - s.yb) * sc;
      v.line([P(xe + 0.02, y0, ext.zmin), P(xe + 0.02, y0, ext.zmax)], ACC, 2);
      if (opt.showP) v.label(P(xe, y0, ext.zmax), `τ = ${fmt(Math.abs(MD.fromBase(g.tau, u.ST)))} ${u.ST}`, ACC);
    } else if (g.kind === 'flow' && g.held && g.held.part !== undefined) {
      // fasteners through the held part, spaced along the segment
      const p = outl[g.held.part].pts, c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
      const ys = p.map((q) => q[1]), top = Math.max(...ys), bot = Math.min(...ys), m = 5;
      for (let i = 0; i < m; i++) { const x = x0 + (Lx * (i + 0.5)) / m; v.line([P(x, top + 0.12, c[0]), P(x, bot - 0.1, c[0])], '#2b2b2b', 3); }
    }
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const R = (x, y, b, h) => ({ kind: 'rect', x, y, b, h, r: 0, rot: 0, hole: false });
  const sec = (o) => Object.assign({ src: 'shape', shape: 'rect', flip: false, b: 100, h: 200, bf: 250, d: 340, tf: 20, tw: 20, D: 100, t: 10, W: 'W18×40', parts: [R(0, 0, 100, 200)] }, o);
  const dist = (x1, x2, w1, w2) => ({ kind: 'dist', x1, x2, w1, w2, x: 0, P: 0, M: 0, dir: 'ccw' });
  const pt = (x, P) => ({ kind: 'point', x, P, x1: 0, x2: 0, w1: 0, w2: 0, M: 0, dir: 'ccw' });
  const beam = (L, sup, xa, xb, loads, at, x) => ({ src: 'beam', M: 0, V: 0, at: at || 'max', x: x || 0, bm: { L, sup, xa, xb, loads } });
  const given = (M, V) => ({ src: 'given', M, V, at: 'max', x: 0, bm: { L: 6, sup: 'simple', xa: 0, xb: 6, loads: [] } });
  M.presets = [
    { name: 'Test: Book Example 11.11, I-beam under 5 kN/m (σ_max = 12.7 MPa, σ_B = 11.2 MPa)', units: 'SI', state: { mode: 'flexure', fu: 'kN', sec: sec({ shape: 'I', bf: 250, d: 340, tf: 20, tw: 20 }), ld: beam(6, 'simple', 0, 6, [dist(0, 6, 5, 5)]), fl: { pt: true, y: 150 } },
      expect: [{ k: 'Moment M', v: 22.5 }, { k: 'Absolute maximum bending stress σ_max', v: 12.7 }, { k: 'Stress at the point σ_P', v: -11.2 }] },
    { name: 'Test: Book Example 11.13, bar with two ribs under 40 N·m (σ_max = 4.65 MPa)', units: 'SI', state: { mode: 'flexure', fu: 'N', sec: sec({ src: 'parts', parts: [R(0, 5, 60, 30), R(0, 0, 10, 5), R(50, 0, 10, 5)] }), ld: given(40, 0), fl: { pt: false, y: 0 } },
      expect: [{ k: 'Neutral axis from the bottom ȳ', v: 19.08 }, { k: 'Absolute maximum bending stress σ_max', v: 4.65 }] },
    { name: 'Test: Book Example 12.1, glued T-beam (τ in the glue = 4.88 MPa)', units: 'SI', state: { mode: 'shear', fu: 'kN', sec: sec({ shape: 'T', bf: 150, d: 180, tf: 30, tw: 30 }), ld: beam(8, 'simple', 0, 8, [dist(4, 8, 6.5, 6.5)]), sh: { y: 30 } },
      expect: [{ k: 'Moment of inertia I', v: 27.0e6 }, { k: 'Q at the level', v: 0.2025e6 }, { k: 'Shear stress at the level τ', v: 4.88 }] },
    { name: 'Test: Book Example 12.3, wide-flange beam with V = 80 kN (22.6, 1.13 and 25.2 MPa)', units: 'SI', state: { mode: 'shear', fu: 'kN', sec: sec({ shape: 'I', bf: 300, d: 240, tf: 20, tw: 15 }), ld: given(0, 80), sh: { y: 100 } },
      expect: [{ k: 'Shear stress just below the level', v: 22.6 }, { k: 'Shear stress just above the level', v: 1.13 }, { k: 'Maximum shear stress τ_max', v: 25.2 }] },
    { name: 'Test: Book Example 12.4, three glued boards (q = 2.66 MN/m, 1.33 MN/m per seam)', units: 'SI', state: { mode: 'flow', fu: 'kN', sec: sec({ src: 'parts', parts: [R(0, 0, 10, 300), R(135, 0, 10, 300), R(-52.5, 300, 250, 10)] }), ld: given(0, 850), fw: { held: 'part', part: 3, y: 0, n: 2, F: 0, task: 's', s: 100, step: 0 } },
      expect: [{ k: 'Shear flow q', v: 2660 }, { k: 'Shear flow per row', v: 1330 }] },
    { name: 'Test: Book Example 12.5, nailed box beam (s = 5.10 in., use 5 in.)', units: 'US', state: { mode: 'flow', fu: 'lb', sec: sec({ src: 'parts', parts: [R(0, 0, 7.5, 1.5), R(0, 6, 7.5, 1.5), R(0, 1.5, 1.5, 4.5), R(6, 1.5, 1.5, 4.5)] }), ld: given(0, 80), fw: { held: 'part', part: 2, y: 0, n: 2, F: 30, task: 's', s: 5, step: 0.5 } },
      expect: [{ k: 'Shear flow q', v: 11.76 }, { k: 'Largest spacing s', v: 5.10 }, { k: 'Spacing to use (rounded down)', v: 5 }] },
    { name: 'Test: Book Example 12.6, nails at 9 in. hold the flanges (V = 27.1 lb)', units: 'US', state: { mode: 'flow', fu: 'lb', sec: sec({ src: 'parts', parts: [R(0, 0, 3, 0.5), R(0, 4.5, 3, 0.5), R(1, 0.5, 1, 4)] }), ld: given(0, 0), fw: { held: 'part', part: 2, y: 0, n: 1, F: 40, task: 'V', s: 9, step: 0 } },
      expect: [{ k: 'Moment of inertia I', v: 20.58 }, { k: 'Largest shear force V', v: 27.1 }] },
    { name: 'Test: Book Example 11.14, rectangle bent about an inclined axis (corners ±2.25, ±4.95 MPa, α = −79.4°)', units: 'SI', state: { mode: 'unsym', fu: 'kN', sec: sec({ shape: 'rect', b: 200, h: 400 }), un: { by: 'comp', M: 12, th: -53.13, Mz: 7.2, My: -9.6 } },
      expect: [{ k: 'Stress at the top-left corner', v: 2.25 }, { k: 'Stress at the top-right corner', v: -4.95 }, { k: 'Stress at the bottom-left corner', v: 4.95 }, { k: 'Angle of the neutral axis α', v: -79.4 }] },
    { name: 'Test: Book Example 15.1, pick a W shape (S_req = 60 in³, W18×40, τ_avg = 5.32 ksi)', units: 'US', state: { mode: 'design', fu: 'kip', dz: { kind: 'W', sA: 24, tA: 14.5, ratio: 1.5 }, ld: beam(18, 'simple', 0, 12, [pt(6, 40), pt(18, 20)]) },
      expect: [{ k: 'Required section modulus S_req', v: 60 }, { k: 'Average shear stress in the web τ_avg', v: 5.32 }] },
    { name: 'Test: Book Example 15.2, laminated beam sized for shear (a = 183 mm)', units: 'SI', state: { mode: 'design', fu: 'kN', dz: { kind: 'rect', sA: 9, tA: 0.6, ratio: 1.5 }, ld: beam(4, 'simple', 1, 4, [dist(0, 4, 12, 12)]) },
      expect: [{ k: 'Largest moment M_max', v: 10.67 }, { k: 'Width from bending b', v: 147 }, { k: 'Required width b', v: 183 }] },
    { name: 'Test: Book Example 15.3, wooden T-beam check (σ = 5.24 MPa, τ = 309 kPa)', units: 'SI', state: { mode: 'design', fu: 'kN', sec: sec({ shape: 'T', bf: 200, d: 230, tf: 30, tw: 30 }), dz: { kind: 'check', sA: 12, tA: 0.8, ratio: 1.5 }, ld: beam(4, 'simple', 0, 4, [dist(0, 2, 0.5, 0.5), pt(2, 1.5)]) },
      expect: [{ k: 'Largest bending stress σ_max', v: 5.24 }, { k: 'Largest shear stress τ_max', v: 0.309 }] },
    { name: 'Cantilever W14×26 with an end load, stress at the wall', units: 'US', state: { mode: 'flexure', fu: 'kip', sec: sec({ src: 'W', W: 'W14×26' }), ld: beam(10, 'cant', 0, 10, [pt(10, 6)]), fl: { pt: true, y: 5 } } },
    { name: 'Edge: a T section whose flange is thicker than its depth (fails on purpose)', units: 'SI', fails: true, state: { mode: 'flexure', fu: 'kN', sec: sec({ shape: 'T', bf: 150, d: 20, tf: 30, tw: 30 }), ld: given(10, 0) } },
  ];

  root.MBeamStress = M;
})(window);
