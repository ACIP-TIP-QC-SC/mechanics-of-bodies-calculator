/* =====================================================================
 * DYNAMICS · D1 Rectilinear Kinematics (inputs, diagrams, presets).
 * Physics: dy/rect.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Rect, DY, DYUI } = root;
  const { fmt } = Core;
  const K = DYUI.K, CA = '#2f7fc1', CB = '#d4612a';

  const M = { id: 'rect', title: 'Rectilinear Kinematics', defaults: Rect.defaults, units: 'SI' };
  const S = () => M.state;
  const dopt = (k, d) => (S()[k] === undefined ? d : S()[k]);

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  M.controls = function (c, C) {
    const st = S(), u = DY.units(Core.UNITS[M.units]);
    const num = (sec, o, k, label, unit) => C.num(sec, { label, get: () => o[k], set: (v) => (o[k] = v), unit });
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Motion', get: () => st.mode, set: (v) => (st.mode = v), options: [
      ['const', 'Constant acceleration or free fall'], ['two', 'Two particles on the same line'], ['func', 's, v or a given as a function of time'],
      ['av', 'Acceleration given as a function of velocity'], ['as', 'Acceleration given as a function of position'], ['graph', 'Erratic motion from a v–t or a–t graph'], ['dep', 'Blocks joined by cords and pulleys (dependent motion)']] });
    if (st.mode === 'const') {
      C.toggle(sec, { label: 'Free fall (a_c = −g, s measured upward)', get: () => st.grav, set: (v) => (st.grav = v) });
      sec = C.section(c, 'Starting values (t = 0)');
      num(sec, st, 's0', 'Position s₀', u.L); num(sec, st, 'v0', 'Velocity v₀', u.V);
      if (!st.grav) num(sec, st, 'ac', 'Constant acceleration a_c', u.A);
      sec = C.section(c, 'Find the instant when');
      C.seg(sec, { get: () => st.find, set: (v) => (st.find = v), options: [['t', 'the time is'], ['s', 'the position is'], ['v', 'the velocity is']] });
      num(sec, st, 'at', st.find === 't' ? 'Time t' : st.find === 's' ? 'Position s' : 'Velocity v', st.find === 't' ? 's' : st.find === 's' ? u.L : u.V);
    } else if (st.mode === 'two') {
      [['A', st.A], ['B', st.B]].forEach(([n, o]) => {
        sec = C.section(c, `Particle ${n} at t = 0`);
        num(sec, o, 's0', 'Position s₀', u.L); num(sec, o, 'v0', 'Velocity v₀', u.V); num(sec, o, 'a', 'Constant acceleration a', u.A);
      });
    } else if (st.mode === 'func') {
      sec = C.section(c, 'Function of time');
      C.seg(sec, { label: 'Given', get: () => st.given, set: (v) => (st.given = v), options: [['s', 's(t)'], ['v', 'v(t)'], ['a', 'a(t)']] });
      const un = st.given === 's' ? u.L : st.given === 'v' ? u.V : u.A;
      C.note(sec, `${st.given} = c₀ + c₁t + c₂t² + c₃t³ + c₄t⁴ (${un}, t in s)`);
      ['c₀', 'c₁', 'c₂', 'c₃', 'c₄'].forEach((n, i) => C.num(sec, { label: n, get: () => st.c[i], set: (v) => (st.c[i] = v) }));
      if (st.given !== 's') num(sec, st, 's0', 'Position at t = 0, s₀', u.L);
      if (st.given === 'a') num(sec, st, 'v0', 'Velocity at t = 0, v₀', u.V);
      num(sec, st, 't', 'Instant t', 's');
    } else if (st.mode === 'av') {
      sec = C.section(c, 'Acceleration');
      C.select(sec, { label: 'Form', get: () => st.form, set: (v) => (st.form = v), options: [['kv', 'a = −kv'], ['kv2', 'a = −kv²'], ['kv3', 'a = −kv³'], ['lin', 'a = a₀ − kv (falling with drag)']] });
      if (st.form === 'lin') num(sec, st, 'a0', 'a₀', u.A);
      num(sec, st, 'k', 'k', { kv: '1/s', lin: '1/s', kv2: `1/${u.L}`, kv3: `s/${u.L}²` }[st.form]);
      num(sec, st, 'v0', 'Velocity at t = 0, v₀', u.V); num(sec, st, 's0', 'Position at t = 0, s₀', u.L); num(sec, st, 't', 'Instant t', 's');
    } else if (st.mode === 'as') {
      sec = C.section(c, 'Acceleration');
      C.note(sec, `a = c₀ + c₁s + c₂s² (${u.A}, s in ${u.L})`);
      ['c₀', 'c₁', 'c₂'].forEach((n, i) => C.num(sec, { label: n, get: () => st.cs[i], set: (v) => (st.cs[i] = v) }));
      num(sec, st, 's0', 'Starting position s₀', u.L); num(sec, st, 'v0', 'Velocity at s₀', u.V); num(sec, st, 'sT', 'Target position s', u.L);
    } else if (st.mode === 'dep') {
      const q = st.dep, nm = q.bodies.map((b) => b.name);
      sec = C.section(c, 'Blocks and points on the cords');
      C.note(sec, 'Measure every position coordinate s from a fixed datum, positive in the same sense (for example downward, or toward the motor). Mark the ones whose motion is given.');
      C.list(sec, { items: q.bodies, min: 2, max: 5, title: (b) => `${b.name}`, add: [['Block', () => { const used = new Set(q.bodies.map((b) => b.name)); const n = 'ABCDE'.split('').find((x) => !used.has(x)) || 'E'; q.cords.forEach((cd) => (cd['c' + n] = cd['c' + n] || 0)); return { name: n, given: 'no', v: 0, a: 0, ds: 0 }; }]],
        fields: (b) => [{ key: 'given', label: 'Motion', options: [['yes', 'Given'], ['no', 'Find']], wide: true }].concat(b.given === 'yes' ? [{ key: 'v', label: 'v', unit: u.V }, { key: 'a', label: 'a', unit: u.A }, { key: 'ds', label: 'Δs (optional)', unit: u.L }] : []) });
      sec = C.section(c, 'Cords: l = Σ c s');
      C.note(sec, `For each cord, enter how many times each coordinate appears in its length, with its sign. Example: l = s_A + 2s_B − 2s_C gives c_A = 1, c_B = 2, c_C = −2.`);
      C.list(sec, { items: q.cords, min: 1, max: 4, title: (cd, i) => `Cord ${i + 1}`, add: [['Cord', () => ({ cA: 0, cB: 0, cC: 0, cD: 0, cE: 0 })]],
        fields: () => nm.map((n, i) => ({ key: ['cA', 'cB', 'cC', 'cD', 'cE'][i], label: `c_${n}` })) });
      sec = C.section(c, 'Time to reach a speed');
      C.toggle(sec, { label: 'Find when a block reaches a speed (constant accelerations)', get: () => !!q.tgt, set: (v) => (q.tgt = v) });
      if (q.tgt) { C.select(sec, { label: 'Block', get: () => q.tB, set: (v) => (q.tB = v), options: nm.map((n) => [n, n]) }); num(sec, q, 'tv', 'Speed', u.V); }
    } else {
      sec = C.section(c, 'Graph');
      C.seg(sec, { label: 'Given', get: () => st.gtype, set: (v) => (st.gtype = v), options: [['vt', 'v–t graph (straight lines)'], ['at', 'a–t graph (constant pieces)']] });
      num(sec, st, 's0', 'Position at t = 0, s₀', u.L);
      if (st.gtype === 'at') num(sec, st, 'v0', 'Velocity at t = 0, v₀', u.V);
      if (st.gtype === 'vt') {
        C.list(sec, { items: st.pts, min: 2, max: 10, title: (p, i) => `Point ${i + 1}`, add: [['Point', () => { const L = st.pts[st.pts.length - 1] || { t: 0, v: 0 }; return { t: L.t + 5, v: L.v }; }]],
          fields: () => [{ key: 't', label: 't', unit: 's' }, { key: 'v', label: 'v', unit: u.V }] });
      } else {
        C.list(sec, { items: st.segs, min: 1, max: 10, title: (p, i) => `Piece ${i + 1}`, add: [['Piece', () => { const L = st.segs[st.segs.length - 1] || { t: 0, a: 0 }; return { t: L.t + 5, a: 0 }; }]],
          fields: () => [{ key: 't', label: 'ends at t', unit: 's' }, { key: 'a', label: 'a', unit: u.A }] });
      }
      num(sec, st, 't', 'Instant t', 's');
    }
  };
  M.diagram = function (c, C) {
    const st = S();
    C.seg(c, { label: 'Track', get: () => dopt('track', 'h'), set: (v) => (st.track = v), options: [['h', 'Horizontal'], ['v', 'Vertical']] });
    C.toggle(c, { label: 'Velocity arrow', get: () => dopt('showV', true), set: (v) => (st.showV = v), rebuild: false });
    C.toggle(c, { label: 'Acceleration arrow', get: () => dopt('showA', true), set: (v) => (st.showA = v), rebuild: false });
    C.toggle(c, { label: 'Marks at the start, turning points and end', get: () => dopt('ghost', true), set: (v) => (st.ghost = v), rebuild: false });
    C.toggle(c, { label: 'Time cursor on the graphs', get: () => dopt('cursor', true), set: (v) => (st.cursor = v), rebuild: false });
  };

  M.compute = (U) => Rect.solve(S(), U);
  M.onUnits = (from, to) => Rect.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => (S().mode === 'dep' ? 'Blocks on their cords (+s downward)' : 'Particle on its straight path');
  M.cap3D = () => '3D view';
  M.plotCaption = 's–t, v–t and a–t graphs';
  M.plotTall = true;
  M.hint = () => 'The particle is drawn at the instant asked for, with its velocity (green) and acceleration (magenta). Press Play to run the motion; the dashed cursor on the graphs follows it.';
  const DCOLS = ['#2f7fc1', '#d4612a', '#2e9e5b', '#8e44ad', '#b8860b'];
  M.legend = () => (S().mode === 'dep' ? (S().dep.bodies || []).map((b, i) => [DCOLS[i], b.name]).concat([[K.vel, 'Velocity v'], [K.acc, 'Acceleration a']]) : S().mode === 'two' ? [[CA, 'Particle A'], [CB, 'Particle B'], [K.vel, 'Velocity v'], [K.acc, 'Acceleration a']] : [[K.pos, 'Particle and s–t'], [K.vel, 'Velocity v'], [K.acc, 'Acceleration a']]);
  const motion = DYUI.motion(S, () => (root.App && root.App.res && root.App.res.geo ? root.App.res.geo.span : [0, 1]));
  M.anim = () => motion;

  /** The time shown: the instant asked for, or the animation time. */
  const tNow = (g) => (S()._u === undefined ? g.t : g.span[0] + (g.span[1] - g.span[0]) * S()._u);
  function range(g) {
    let lo = 0, hi = 0;
    const fs = g.mode === 'two' ? [g.MA, g.MB] : [g.M];
    fs.forEach((m) => { for (let i = 0; i <= 200; i++) { const x = m.s(g.span[0] + ((g.span[1] - g.span[0]) * i) / 200); if (isFinite(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x); } } });
    if (!(hi > lo)) { hi = lo + 1; }
    return [lo, hi];
  }
  const peak = (m, g, k) => { let mx = 1e-12; for (let i = 0; i <= 200; i++) mx = Math.max(mx, Math.abs(m[k](g.span[0] + ((g.span[1] - g.span[0]) * i) / 200))); return mx; };

  /* ------------------------------------------------------------------ */
  /* 2D                                                                 */
  /* ------------------------------------------------------------------ */
  /** Dependent motion: one vertical column per block, hanging from the datum, +s downward. */
  function draw2DDep(svg, g, opt) {
    const u = g.u, n = g.names.length, T = g.span[1], t = tNow(g);
    let lo = 0, hi = 0; g.Ms.forEach((m) => { for (let i = 0; i <= 40; i++) { const x = m.s((T * i) / 40); lo = Math.min(lo, x); hi = Math.max(hi, x); } });
    const k = 2.4 / Math.max(hi - lo, 1e-9), span = 2.4, L0 = 1.2, H = L0 + span + L0 * 0.6;
    const D = UI.Draw2D(svg, { xmin: -0.6, xmax: n - 0.4, ymin: -H, ymax: L0 * 0.25 }, { pad: 46 });
    D.poly([[-0.6, 0], [n - 0.4, 0], [n - 0.4, L0 * 0.08], [-0.6, L0 * 0.08]], { fill: '#d5dbe1', stroke: K.ink, sw: 1.4 });
    D.text([-0.55, -L0 * 0.08], 'datum (s = 0)', { color: '#5a6b75', size: 11, base: 'hanging' });
    const vmax = Math.max(1e-12, ...g.Ms.map((m) => Math.max(Math.abs(m.v(0)), Math.abs(m.v(T))))), amax = Math.max(1e-12, ...g.Ms.map((m) => Math.abs(m.a(0))));
    g.names.forEach((nm, i) => {
      const m = g.Ms[i], y = -(L0 + (m.s(t) - lo) * k), col = DCOLS[i], bw = 0.42, bh = 0.5;
      D.line([i, 0], [i, y], { stroke: '#6b4f2a', sw: 2 });
      DYUI.block(D, [i, y - bh], bw, bh, 0, { fill: col, stroke: '#1d2733', label: nm, lcolor: '#fff' });
      const c = [i + bw / 2 + 0.04, y - bh / 2], vn = m.v(t), an = m.a(t);
      if (dopt('showV', true) && Math.abs(vn) > 1e-9 * vmax) DYUI.vec(D, c, [0, -Math.sign(vn)], 22 + 50 * Math.abs(vn) / vmax, { color: K.vel, label: opt.showP ? `v = ${fmt(vn)} ${u.V}` : 'v', size: 11.5, ldx: 6, ldy: vn > 0 ? 12 : -2, anchor: 'start' });
      if (dopt('showA', true) && Math.abs(an) > 1e-9 * amax) DYUI.vec(D, [i - bw / 2 - 0.04, y - bh / 2], [0, -Math.sign(an)], 18 + 40 * Math.abs(an) / amax, { color: K.acc, label: opt.showP ? `a = ${fmt(an)} ${u.A}` : 'a', size: 11.5, ldx: -6, ldy: an > 0 ? 12 : -2, anchor: 'end' });
      D.text([i, L0 * 0.12], g.giv[i] ? 'given' : 'found', { anchor: 'middle', color: '#5a6b75', size: 11 });
    });
    const eq = g.cords.map((r) => r.map((c, i) => (c ? `${c === 1 ? '' : c === -1 ? '−' : fmt(c)}s_${g.names[i]}` : null)).filter(Boolean).join(' + ').replace(/\+ −/g, '− ') + ' = const');
    eq.forEach((e, k) => DYUI.title(D, 12, 20 + 18 * k, e, { size: 12.5 }));
    DYUI.title(D, 12, 20 + 18 * eq.length, `t = ${fmt(t)} s`, { size: 12, color: '#5a6b75' });
    return true;
  }
  M.draw2D = function (svg, res, U, opt) {
    if (res.geo.mode === 'dep') return draw2DDep(svg, res.geo, opt);
    const g = res.geo, u = g.u, vert = dopt('track', 'h') === 'v', [lo, hi] = range(g), span = hi - lo;
    const P = (s, off) => (vert ? [off || 0, s] : [s, off || 0]);
    // the arrows need room past both ends of the path: find the scale first, then widen the bounds by 110 px
    const box = (e) => (vert ? { xmin: -span * 0.5, xmax: span * 0.5, ymin: lo - e, ymax: hi + e } : { xmin: lo - e, xmax: hi + e, ymin: -span * 0.2, ymax: span * 0.2 });
    const sc0 = UI.Draw2D(svg, box(span * 0.06), { pad: 40 }).sc;
    const D = UI.Draw2D(svg, box(span * 0.06 + 110 / sc0), { pad: 40 });
    const px = (w) => w / D.sc, pad = span * 0.06 + 70 / D.sc;
    // track and its scale
    D.line(P(lo - pad), P(hi + pad), { stroke: K.ink, sw: 2 });
    const tk = Charts.niceTicks(lo, hi, 6).ticks;
    tk.forEach((x) => { D.line(P(x, -px(5)), P(x, px(5)), { stroke: K.ink, sw: 1.2 }); D.text(P(x, vert ? px(-9) : -px(17)), fmt(x), { anchor: vert ? 'end' : 'middle', dy: vert ? 4 : 0, color: '#5a6b75', size: 10.5, weight: 400 }); });
    D.arrow(P(hi + pad - px(30)), P(hi + pad), { color: K.ink, w: 2, head: 10 });
    D.text(P(hi + pad, vert ? px(10) : px(12)), `+s (${u.L})`, { anchor: vert ? 'start' : 'end', color: K.ink, size: 12 });
    D.text(P(0, vert ? px(-9) : -px(30)), 'O', { anchor: vert ? 'end' : 'middle', dx: vert ? -22 : 0, dy: vert ? 4 : 0, color: K.ink, size: 12, weight: 700 });
    const t = tNow(g), parts = g.mode === 'two' ? [['A', g.MA, CA, -1], ['B', g.MB, CB, 1]] : [[null, g.M, K.pos, 0]];
    parts.forEach(([name, m, col, side]) => {
      const out = side < 0 ? -1 : 1, off = side * px(40);
      if (dopt('ghost', true)) {
        const marks = [g.span[0]].concat(g.marks || [], g.mode === 'two' ? g.meets : [], [g.span[1]]);
        marks.forEach((tm) => { const sp = m.s(tm); if (isFinite(sp)) D.circle(P(sp, off), px(6), { fill: '#fff', stroke: col, sw: 1.4, dash: '3 2' }); });
      }
      const sNow = m.s(t), vNow = m.v(t), aNow = m.a(t), c = P(sNow, off);
      const vmax = peak(m, g, 'v'), amax = peak(m, g, 'a'), dir = vert ? [0, 1] : [1, 0];
      // labels sit just past each arrowhead, along the path
      const lab = (val) => (vert ? { ldx: out > 0 ? 8 : -8, ldy: val > 0 ? -2 : 12, anchor: out > 0 ? 'start' : 'end' } : { ldx: val > 0 ? 6 : -6, ldy: 4, anchor: val > 0 ? 'start' : 'end' });
      if (dopt('showV', true) && Math.abs(vNow) > 1e-9 * vmax) DYUI.vec(D, c, [dir[0] * Math.sign(vNow), dir[1] * Math.sign(vNow)], 24 + 70 * Math.abs(vNow) / vmax, Object.assign({ color: K.vel, label: opt.showP ? `v = ${fmt(vNow)} ${u.V}` : 'v', size: 12 }, lab(vNow)));
      const ao = vert ? [px(out * 20), 0] : [0, px(out * 20)];
      if (dopt('showA', true) && Math.abs(aNow) > 1e-9 * amax) DYUI.vec(D, [c[0] + ao[0], c[1] + ao[1]], [dir[0] * Math.sign(aNow), dir[1] * Math.sign(aNow)], 20 + 55 * Math.abs(aNow) / amax, Object.assign({ color: K.acc, label: opt.showP ? `a = ${fmt(aNow)} ${u.A}` : 'a', size: 12 }, lab(aNow)));
      D.circle(c, px(9), { fill: col, stroke: '#fff', sw: 2 });
      if (name) D.text(c, name, { anchor: 'middle', base: 'middle', color: '#fff', size: 11, weight: 700 });
      if (opt.showP) {
        if (vert) D.text(c, `s = ${fmt(sNow)} ${u.L}`, { anchor: out > 0 ? 'start' : 'end', dx: out * 42, dy: 4, color: col, size: 12, weight: 700 });
        else D.text(c, `s = ${fmt(sNow)} ${u.L}`, { anchor: 'middle', dy: out > 0 ? -42 : 50, color: col, size: 12, weight: 700 });
      }
    });
    DYUI.title(D, 12, 20, `t = ${fmt(t)} s`, { size: 14 });
    return true;
  };

  /* Graphs */
  M.plot = function (svg, res) {
    const g = res.geo, u = g.u, n = 240, T0 = g.span[0], T1 = g.span[1], tt = [];
    for (let i = 0; i <= n; i++) tt.push(T0 + ((T1 - T0) * i) / n);
    (g.breaks || []).concat(g.marks || []).forEach((x) => { tt.push(x - 1e-9 * (T1 - T0), x + 1e-9 * (T1 - T0)); });
    tt.sort((a, b) => a - b);
    const ser = (m, k) => tt.filter((x) => x >= T0 && x <= T1).map((x) => [x, m[k](x)]);
    const cur = dopt('cursor', true) ? tNow(g) : NaN;
    if (g.mode === 'dep') {
      const more = (k) => g.Ms.slice(1).map((m, i) => ({ pts: ser(m, k), color: DCOLS[i + 1], at: m[k] }));
      return DYUI.stack(svg, [
        { label: `Δs (${u.L})`, color: DCOLS[0], pts: ser(g.Ms[0], 's'), at: g.Ms[0].s, more: more('s') },
        { label: `v (${u.V})`, color: DCOLS[0], pts: ser(g.Ms[0], 'v'), at: g.Ms[0].v, more: more('v') },
        { label: `a (${u.A})`, color: DCOLS[0], pts: ser(g.Ms[0], 'a'), at: g.Ms[0].a, more: more('a') },
      ], { xlabel: 't (s)', cursor: cur, xmin: T0, xmax: T1 });
    }
    if (g.mode === 'two') {
      return DYUI.stack(svg, [
        { label: `s (${u.L})`, color: CA, pts: ser(g.MA, 's'), at: g.MA.s, more: [{ pts: ser(g.MB, 's'), color: CB, at: g.MB.s }], marks: g.meets.filter((x) => x <= T1).map((x) => ({ x, y: g.MA.s(x), label: `meet ${fmt(x)} s`, color: K.ink })) },
        { label: `v (${u.V})`, color: CA, pts: ser(g.MA, 'v'), at: g.MA.v, more: [{ pts: ser(g.MB, 'v'), color: CB, at: g.MB.v }] },
        { label: `a (${u.A})`, color: CA, pts: ser(g.MA, 'a'), at: g.MA.a, more: [{ pts: ser(g.MB, 'a'), color: CB, at: g.MB.a }] },
      ], { xlabel: 't (s)', cursor: cur, xmin: T0, xmax: T1 });
    }
    const m = g.M;
    return DYUI.stack(svg, [
      { label: `s (${u.L})`, color: K.pos, pts: ser(m, 's'), at: m.s, marks: (g.marks || []).map((x) => ({ x, y: m.s(x), label: `v = 0 at ${fmt(x)} s`, color: K.pos })) },
      { label: `v (${u.V})`, color: K.vel, pts: ser(m, 'v'), at: m.v },
      { label: `a (${u.A})`, color: K.acc, pts: ser(m, 'a'), at: m.a },
    ], { xlabel: 't (s)', cursor: cur, xmin: T0, xmax: T1 });
  };

  /* ------------------------------------------------------------------ */
  /* 3D                                                                 */
  /* ------------------------------------------------------------------ */
  M.draw3D = function (v, res, U, opt) {
    if (res.geo.mode === 'dep') {
      const g = res.geo, n = g.names.length, T = g.span[1], t = tNow(g);
      let lo = 0, hi = 0; g.Ms.forEach((m) => { for (let i = 0; i <= 40; i++) { const x = m.s((T * i) / 40); lo = Math.min(lo, x); hi = Math.max(hi, x); } });
      const span = Math.max(hi - lo, 1e-9), sc = 1 / span, L0 = 1.2, w = 0.2;
      v.box(-0.6, 0, -0.4, n - 0.4, 0.08, 0.4, '#d5dbe1', 1, '#7f8c8d');
      g.names.forEach((nm, i) => {
        const y = -(L0 + (g.Ms[i].s(t) - lo) * sc), x = i;
        v.line([[x, 0, 0], [x, y, 0]], '#6b4f2a', 2.4);
        v.box(x - w, y - 0.35, -w, x + w, y, w, DCOLS[i], 1, '#1d2733');
        v.label([x + w * 1.4, y - 0.17, 0], nm, DCOLS[i]);
        const vn = g.Ms[i].v(t);
        if (Math.abs(vn) > 1e-12) { const o = [x - w * 1.6, y - 0.17, 0]; DYUI.arrow3(v, o, [o[0], o[1] - Math.sign(vn) * 0.35, 0], K.vel, 2.4); if (opt.showP) v.label([o[0], o[1] - Math.sign(vn) * 0.4, 0], `v = ${fmt(vn)} ${g.u.V}`, K.vel); }
      });
      v.autoBounds(); return;
    }
    const g = res.geo, u = g.u, vert = dopt('track', 'h') === 'v', [lo, hi] = range(g), span = hi - lo, w = span * 0.02;
    const P = (s, z) => (vert ? [0, s, z || 0] : [s, 0, z || 0]);
    const a0 = lo - span * 0.08, a1 = hi + span * 0.08;
    if (vert) v.box(-w, a0, -w, w, a1, w, '#c3cbd3', 1, '#7f8c8d');
    else v.box(a0, -w * 2, -span * 0.13, a1, -w, span * 0.13, '#c3cbd3', 1, '#7f8c8d', { layer: -1 });
    const t = tNow(g), parts = g.mode === 'two' ? [['A', g.MA, CA, -1], ['B', g.MB, CB, 1]] : [[null, g.M, K.pos, 0]];
    const r = span * 0.035;
    parts.forEach(([name, m, col, side]) => {
      const z = side * r * 2.6, sNow = m.s(t), c = vert ? [r * 1.4, sNow, z] : [sNow, r - w, z];
      DYUI.sphere(v, c, r, col);
      const dir = vert ? [0, 1, 0] : [1, 0, 0], vmax = peak(m, g, 'v'), amax = peak(m, g, 'a'), vn = m.v(t), an = m.a(t);
      if (dopt('showV', true) && Math.abs(vn) > 1e-9 * vmax) { const L = span * (0.06 + 0.16 * Math.abs(vn) / vmax) * Math.sign(vn), o = [c[0] + (vert ? r * 1.5 : 0), c[1] + (vert ? 0 : r * 1.6), c[2]]; DYUI.arrow3(v, o, DYUI.add(o, DYUI.mul(dir, L)), K.vel, 2.6); v.label(DYUI.add(o, DYUI.mul(dir, L)), opt.showP ? `v = ${fmt(vn)} ${u.V}` : 'v', K.vel); }
      if (dopt('showA', true) && Math.abs(an) > 1e-9 * amax) { const L = span * (0.05 + 0.12 * Math.abs(an) / amax) * Math.sign(an), o = [c[0] + (vert ? r * 3 : 0), c[1] + (vert ? 0 : r * 3.2), c[2]]; DYUI.arrow3(v, o, DYUI.add(o, DYUI.mul(dir, L)), K.acc, 2.4); v.label(DYUI.add(o, DYUI.mul(dir, L)), opt.showP ? `a = ${fmt(an)} ${u.A}` : 'a', K.acc); }
      if (name) v.label([c[0], c[1] - r * 2.2, c[2]], name, col);
    });
    v.label(P(0, r * 4), 'O', K.ink);
    v.label(P(a1, 0), `+s (${u.L})`, K.ink);
    v.label(vert ? [span * 0.3, a1, 0] : [a0, span * 0.25, 0], `t = ${fmt(t)} s`, K.ink);
    if (vert) v.setBounds([-span * 0.2, a0, -span * 0.2], [span * 0.2, a1, span * 0.2]);
    else v.setBounds([a0, -span * 0.08, -span * 0.12], [a1, span * 0.18, span * 0.12]);
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const P0 = (o) => {
    if (o.dep) { o.dep.bodies = o.dep.bodies.map((b) => Object.assign({ v: 0, a: 0, ds: 0 }, b)); o.dep.cords = o.dep.cords.map((c) => Object.assign({ cA: 0, cB: 0, cC: 0, cD: 0, cE: 0 }, c)); o.dep = Object.assign({ tgt: false, tB: 'B', tv: 10 }, o.dep); }
    return Object.assign(Rect.defaults(), o);
  };
  M.presets = [
    { name: 'Test: Book Example 12.1, v = 3t² + 2t ft/s, at t = 3 s (s = 36 ft, a = 20 ft/s²)', units: 'US', state: P0({ mode: 'func', given: 'v', c: [0, 2, 3, 0, 0], s0: 0, t: 3 }),
      expect: [{ k: 'Position s', v: 36 }, { k: 'Acceleration a', v: 20 }] },
    { name: 'Test: Book Example 12.2, projectile slowed by a = −0.4v³, at t = 4 s (v = 0.559 m/s, s = 4.43 m)', units: 'SI', state: P0({ mode: 'av', form: 'kv3', k: 0.4, v0: 60, s0: 0, t: 4, track: 'v' }),
      expect: [{ k: 'Velocity v', v: 0.559 }, { k: 'Position s', v: 4.431 }] },
    { name: 'Test: Book Example 12.3, rocket at 75 m/s from 40 m up, free fall (s_max = 327 m, v = 80.1 m/s down at the ground)', units: 'SI', state: P0({ mode: 'const', grav: true, s0: 40, v0: 75, find: 's', at: 0, track: 'v' }),
      expect: [{ k: 'Turning point position', v: 326.7 }, { k: 'Velocity v', v: -80.06 }] },
    { name: 'Test: Book Example 12.4, a = 4s from rest at 100 mm to 200 mm (v = 0.346 m/s, t = 0.658 s)', units: 'SI', state: P0({ mode: 'as', cs: [0, 4, 0], s0: 0.1, v0: 0, sT: 0.2, track: 'v' }),
      expect: [{ k: 'Velocity at the target v', v: 0.3464 }, { k: 'Time to reach the target t', v: 0.658 }] },
    { name: 'Test: Book Example 12.5, v = 3t² − 6t over 0 to 3.5 s (distance 14.1 m, average speed 4.04 m/s)', units: 'SI', state: P0({ mode: 'func', given: 'v', c: [0, -6, 3, 0, 0], s0: 0, t: 3.5 }),
      expect: [{ k: 'Position s', v: 6.125 }, { k: 'Distance travelled s_T', v: 14.125 }, { k: 'Average velocity v_avg', v: 1.75 }, { k: 'Average speed (v_sp)_avg', v: 4.036 }] },
    { name: 'Test: Book Example 12.6, bicycle v–t graph to 30 s (s = 500 ft at 30 s)', units: 'US', state: P0({ mode: 'graph', gtype: 'vt', s0: 0, pts: [{ t: 0, v: 0 }, { t: 10, v: 20 }, { t: 30, v: 20 }], t: 30 }),
      expect: [{ k: 'Position s', v: 500 }, { k: 'Velocity v', v: 20 }] },
    { name: 'Test: Book Example 12.7, car at 10 m/s² for 10 s then −2 m/s² (stops at t = 60 s)', units: 'SI', state: P0({ mode: 'graph', gtype: 'at', s0: 0, v0: 0, segs: [{ t: 10, a: 10 }, { t: 60, a: -2 }], t: 10 }),
      expect: [{ k: 'First instant with v = 0 (after start)', v: 60 }, { k: 'Velocity v', v: 100 }, { k: 'Displacement Δs', v: 3000 }] },
    { name: 'Test: Prob. 12-195, end A pulled down at 2 m/s, two cords (v_B = 0.5 m/s up)', units: 'SI', state: P0({ mode: 'dep', dep: { bodies: [{ name: 'A', given: 'yes', v: 2, a: 0, ds: 0 }, { name: 'B', given: 'no' }, { name: 'C', given: 'no' }], cords: [{ cA: 1, cB: 2, cC: -2 }, { cB: 1, cC: 1 }] } }),
      expect: [{ k: 'v_B', v: -0.5 }] },
    { name: 'Test: Prob. 12-202, end A at 3 m/s (v_B = 0.75 m/s)', units: 'SI', state: P0({ mode: 'dep', dep: { bodies: [{ name: 'A', given: 'yes', v: 3, a: 0, ds: 0 }, { name: 'B', given: 'no' }, { name: 'D', given: 'no' }], cords: [{ cB: 2, cC: 1 }, { cA: 1, cC: -2 }] } }),
      expect: [{ k: 'v_B', v: -0.75 }, { k: 'v_D', v: 1.5 }] },
    { name: 'Test: Prob. 12-203, cable drawn in at 3 m/s²: time for B to reach 10 m/s (5 s)', units: 'SI', state: P0({ mode: 'dep', dep: { bodies: [{ name: 'A', given: 'yes', v: 0, a: 3, ds: 0 }, { name: 'B', given: 'no' }, { name: 'C', given: 'no' }], cords: [{ cB: 3, cC: -2 }, { cA: 1, cC: 1 }], tgt: true, tB: 'B', tv: 10 } }),
      expect: [{ k: 'Time for B to reach 10 m/s', v: 5 }, { k: 'a_B', v: -2 }] },
    { name: 'Test: Prob. 12-209, cylinder lifted with A drawn in at 2 m/s (v_C = 0.667 m/s up)', units: 'SI', state: P0({ mode: 'dep', dep: { bodies: [{ name: 'A', given: 'yes', v: -2, a: 0, ds: 0 }, { name: 'C', given: 'no' }], cords: [{ cA: -1, cB: 3 }] } }),
      expect: [{ k: 'v_C', v: -0.6667 }] },
    { name: 'Car braking from 25 m/s at 6 m/s² (when it stops)', units: 'SI', state: P0({ mode: 'const', s0: 0, v0: 25, ac: -6, find: 'v', at: 0 }) },
    { name: 'Car starting from rest catches a truck 60 m ahead at 12 m/s', units: 'SI', state: P0({ mode: 'two', A: { s0: 0, v0: 0, a: 2.5 }, B: { s0: 60, v0: 12, a: 0 } }) },
    { name: 'Two trains approaching each other on one track (ft)', units: 'US', state: P0({ mode: 'two', A: { s0: 0, v0: 60, a: -1.5 }, B: { s0: 2000, v0: -45, a: 0.5 } }) },
    { name: 'Skydiver: a = 9.81 − 0.2v from rest (terminal speed 49.1 m/s)', units: 'SI', state: P0({ mode: 'av', form: 'lin', a0: 9.81, k: 0.2, v0: 0, s0: 0, t: 20 }) },
    { name: 'Edge: a ball thrown up at 10 m/s never reaches 20 m (fails on purpose)', units: 'SI', fails: true, state: P0({ mode: 'const', grav: true, s0: 0, v0: 10, find: 's', at: 20, track: 'v' }) },
  ];

  root.DRect = M;
})(window);
