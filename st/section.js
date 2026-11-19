/* =====================================================================
 * STATICS · Centroids and Moments of Inertia (physics only; browser + Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapters 9 and 10.
 *   - composite area: centroid, moments and product of inertia, principal axes
 *   - composite line (wire)
 *   - composite body: centre of mass / centre of gravity
 *   - theorems of Pappus and Guldinus
 *   - moments of inertia about inclined axes and Mohr's circle
 *   - by integration: areas, rods, solids of revolution and fluid pressure on plates (see integ.js)
 * Lengths are in the chosen length unit `lu`.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const Section = root.Section || require('../shared/section.js');
  const Mohr = root.Mohr || require('../shared/mohr.js');
  const { fmt, fail, Steps, sumStr } = Core;
  const IG = () => root.Integ || require('./integ.js'); // loaded after this file in the browser
  const PI = Math.PI, DEG = PI / 180;
  const LUS = { SI: ['mm', 'm'], US: ['in.', 'ft'] };
  const VKIND = [['cyl', 'Cylinder'], ['cone', 'Cone'], ['hemi', 'Hemisphere'], ['block', 'Rectangular block']];
  const VNAME = Object.fromEntries(VKIND);

  function defaults() {
    return {
      mode: 'area', lu: 'mm',
      area: {
        shape: 'custom', theta: 30,
        parts: [{ kind: 'rect', x: 0, y: 0, b: 150, h: 20, rot: 0, hole: false }, { kind: 'rect', x: 65, y: 20, b: 20, h: 160, rot: 0, hole: false }, { kind: 'rect', x: 25, y: 180, b: 100, h: 20, rot: 0, hole: false }],
        dims: { bf: 150, d: 200, tf: 20, tw: 12 },
      },
      line: { segs: [{ kind: 'arc', cx: 60, cy: 0, r: 60, a1: 180, a2: 360 }, { kind: 'line', x1: 0, y1: 0, z1: 0, x2: 0, y2: 40, z2: 0 }, { kind: 'line', x1: 0, y1: 40, z1: 0, x2: 0, y2: 40, z2: -20 }] },
      vol: { useRho: true, parts: [{ kind: 'cyl', x: 0, y: 0, z: 0, r: 40, h: 100, a: 80, b: 80, dir: 'up', rho: 7.85, hole: false }, { kind: 'cone', x: 0, y: 0, z: 100, r: 40, h: 60, a: 80, b: 80, dir: 'up', rho: 7.85, hole: false }] },
      pap: { kind: 'polygon', angle: 360, pts: [{ r: 20, z: 0 }, { r: 50, z: 0 }, { r: 50, z: 30 }, { r: 20, z: 60 }], R: 60, a: 20 },
      inc: { Ix: 2.9e9, Iy: 5.6e9, Ixy: -3e9, theta: 30 },
      ig: IG().defaults(),
    };
  }
  const areaParts = (st) => (st.area.shape === 'custom' ? { parts: st.area.parts, err: [] } : Section.template(st.area.shape, st.area.dims));

  function solve(st, U) {
    if (st.mode === 'integ') return IG().solve(st.ig, { Lu: st.lu, U });
    if (st.mode === 'line') return line(st, U);
    if (st.mode === 'volume') return volume(st, U);
    if (st.mode === 'pappus') return pappus(st, U);
    if (st.mode === 'inclined') return inclined(st, U);
    return area(st, U);
  }
  const sgn = (v) => (v < 0 ? '−' : '');
  const sq = (v) => (v < 0 ? `(${fmt(v)})` : fmt(v));

  /* ------------------------------------------------------------------ */
  /* Principal axes and inclined axes (shared by two modes)             */
  /* ------------------------------------------------------------------ */
  function inertiaSteps(S, out, Ix, Iy, Ixy, theta, u4, names) {
    const m = Mohr.inertia(Ix, Iy, Ixy), [nx, ny, nxy] = names;
    const round = Math.abs(m.R) < 1e-9 * Math.max(Math.abs(Ix), Math.abs(Iy), 1e-300);
    if (round) {
      S.add({ t: 'Principal moments of inertia', n: `${nx} = ${ny} and ${nxy} = 0, so Mohr's circle is a point. Every axis through this point is a principal axis and the moment of inertia is the same about all of them.`, r: `I_max = I_min = ${fmt(m.avg)} ${u4}` });
    } else {
      S.add({ t: 'Orientation of the principal axes', f: `tan 2θ_p = −${nxy} / ((${nx} − ${ny})/2)`, s: `tan 2θ_p = −${sq(Ixy)} / ((${fmt(Ix)} − ${sq(Iy)})/2)`, r: `θ_p1 = ${fmt(m.thp)}°, θ_p2 = ${fmt(m.thp2)}°`, n: 'Angles are counterclockwise from the positive x axis. θ_p1 is the axis of the maximum moment of inertia.' });
      S.add({ t: 'Principal moments of inertia', f: `I_max,min = (${nx} + ${ny})/2 ± √(((${nx} − ${ny})/2)² + ${nxy}²)`, s: `I_max,min = ${fmt(m.avg)} ± √(${sq(m.d)}² + ${sq(Ixy)}²) = ${fmt(m.avg)} ± ${fmt(m.R)}`, r: `I_max = ${fmt(m.max)} ${u4}, I_min = ${fmt(m.min)} ${u4}` });
    }
    const at = m.at(theta);
    S.add({ t: `Moments of inertia about the u and v axes at θ = ${fmt(theta)}°`, f: `I_u = (${nx} + ${ny})/2 + (${nx} − ${ny})/2 · cos 2θ − ${nxy} sin 2θ\nI_v = (${nx} + ${ny})/2 − (${nx} − ${ny})/2 · cos 2θ + ${nxy} sin 2θ\nI_uv = (${nx} − ${ny})/2 · sin 2θ + ${nxy} cos 2θ`, s: `I_u = ${fmt(m.avg)} + ${sq(m.d)} cos ${fmt(2 * theta)}° − ${sq(Ixy)} sin ${fmt(2 * theta)}°`, r: `I_u = ${fmt(at.Iu)} ${u4}, I_v = ${fmt(at.Iv)} ${u4}, I_uv = ${fmt(at.Iuv)} ${u4}`, n: `Check: I_u + I_v = ${fmt(at.Iu + at.Iv)} = ${nx} + ${ny}.` });
    out.push({ k: 'Maximum principal moment of inertia I_max', v: m.max, u: u4, hl: true }, { k: 'Minimum principal moment of inertia I_min', v: m.min, u: u4, hl: true });
    if (!round) out.push({ k: 'Angle to the I_max axis θ_p1 (↺ from x)', v: m.thp, u: '°' });
    out.push({ k: `I_u at θ = ${fmt(theta)}°`, v: at.Iu, u: u4 }, { k: `I_v at θ = ${fmt(theta)}°`, v: at.Iv, u: u4 }, { k: `I_uv at θ = ${fmt(theta)}°`, v: at.Iuv, u: u4 });
    return { m, at, round };
  }

  /* ------------------------------------------------------------------ */
  /* Composite area                                                     */
  /* ------------------------------------------------------------------ */
  function area(st) {
    const Lu = st.lu, u2 = Lu + '²', u3 = Lu + '³', u4 = Lu + '⁴';
    const tp = areaParts(st);
    if (tp.err.length) return fail(tp.err);
    const sec = Section.solve(tp.parts);
    if (!sec.ok) return fail(sec.err);
    const theta = +st.area.theta || 0;
    if (!isFinite(theta)) return fail('Enter the angle θ of the inclined axes.');
    const S = Steps(), out = [], R = sec.rows;
    const nm = (r, i) => `${i + 1} ${r.name}${r.sign < 0 ? ' (hole)' : ''}`;
    S.add({
      t: 'Composite parts', n: 'The area is divided into simple parts. A hole is entered as a negative area. x̃ and ỹ locate the centroid of each part from the given axes.',
      table: { head: ['Part', `A (${u2})`, `x̃ (${Lu})`, `ỹ (${Lu})`, `x̃A (${u3})`, `ỹA (${u3})`], rows: R.map((r, i) => [nm(r, i), fmt(r.A), fmt(r.x), fmt(r.y), fmt(r.xA), fmt(r.yA)]).concat([['Σ', fmt(sec.A), '', '', fmt(sec.x * sec.A), fmt(sec.y * sec.A)]]) },
    });
    S.add({ t: 'Centroid', f: 'x̄ = Σx̃A / ΣA,  ȳ = ΣỹA / ΣA', s: `x̄ = ${fmt(sec.x * sec.A)} / ${fmt(sec.A)},  ȳ = ${fmt(sec.y * sec.A)} / ${fmt(sec.A)}`, r: `x̄ = ${fmt(sec.x)} ${Lu}, ȳ = ${fmt(sec.y)} ${Lu}` });
    S.add({
      t: 'Moment of inertia about the centroidal x′ axis', f: 'Ī_x = Σ(Ī_x′ + A d_y²), with d_y = ỹ − ȳ', n: 'Parallel-axis theorem. Ī_x′ is the moment of inertia of each part about its own centroidal axis.',
      table: { head: ['Part', `Ī_x′ (${u4})`, `A (${u2})`, `d_y (${Lu})`, `A d_y² (${u4})`, `Ī_x′ + A d_y² (${u4})`], rows: R.map((r, i) => [`${nm(r, i)}: ${r.sign < 0 ? '−' : ''}${r.fIx}`, fmt(r.Ix), fmt(r.A), fmt(r.dy), fmt(r.A * r.dy * r.dy), fmt(r.Ixc)]).concat([['Σ', '', '', '', '', fmt(sec.Ic.x)]]) },
      r: `Ī_x = ${fmt(sec.Ic.x)} ${u4}`,
    });
    S.add({
      t: 'Moment of inertia about the centroidal y′ axis', f: 'Ī_y = Σ(Ī_y′ + A d_x²), with d_x = x̃ − x̄',
      table: { head: ['Part', `Ī_y′ (${u4})`, `A (${u2})`, `d_x (${Lu})`, `A d_x² (${u4})`, `Ī_y′ + A d_x² (${u4})`], rows: R.map((r, i) => [`${nm(r, i)}: ${r.sign < 0 ? '−' : ''}${r.fIy}`, fmt(r.Iy), fmt(r.A), fmt(r.dx), fmt(r.A * r.dx * r.dx), fmt(r.Iyc)]).concat([['Σ', '', '', '', '', fmt(sec.Ic.y)]]) },
      r: `Ī_y = ${fmt(sec.Ic.y)} ${u4}`,
    });
    S.add({
      t: 'Product of inertia about the centroidal axes', f: 'Ī_xy = Σ(Ī_x′y′ + A d_x d_y)', n: 'Ī_x′y′ is zero for a part that has an axis of symmetry parallel to x or y.',
      table: { head: ['Part', `Ī_x′y′ (${u4})`, `d_x (${Lu})`, `d_y (${Lu})`, `A d_x d_y (${u4})`, `Sum (${u4})`], rows: R.map((r, i) => [nm(r, i), fmt(r.Ixy), fmt(r.dx), fmt(r.dy), fmt(r.A * r.dx * r.dy), fmt(r.Ixyc)]).concat([['Σ', '', '', '', '', fmt(sec.Ic.xy)]]) },
      r: `Ī_xy = ${fmt(sec.Ic.xy)} ${u4}`,
    });
    S.add({ t: 'Moments of inertia about the given x and y axes', f: 'I_x = Ī_x + A ȳ²,  I_y = Ī_y + A x̄²,  I_xy = Ī_xy + A x̄ ȳ', s: `I_x = ${fmt(sec.Ic.x)} + ${fmt(sec.A)}(${fmt(sec.y)})²,  I_y = ${fmt(sec.Ic.y)} + ${fmt(sec.A)}(${fmt(sec.x)})²`, r: `I_x = ${fmt(sec.I0.x)} ${u4}, I_y = ${fmt(sec.I0.y)} ${u4}, I_xy = ${fmt(sec.I0.xy)} ${u4}` });
    S.add({ t: 'Radii of gyration and polar moment of inertia', f: 'k_x = √(Ī_x / A),  k_y = √(Ī_y / A),  J_C = Ī_x + Ī_y', s: `k_x = √(${fmt(sec.Ic.x)} / ${fmt(sec.A)}),  k_y = √(${fmt(sec.Ic.y)} / ${fmt(sec.A)})`, r: `k_x = ${fmt(sec.kx)} ${Lu}, k_y = ${fmt(sec.ky)} ${Lu}, J_C = ${fmt(sec.J)} ${u4}` });
    out.push({ k: 'Area A', v: sec.A, u: u2 }, { k: 'Centroid x̄', v: sec.x, u: Lu, hl: true }, { k: 'Centroid ȳ', v: sec.y, u: Lu, hl: true },
      { k: 'Ī_x about the centroidal x′ axis', v: sec.Ic.x, u: u4, hl: true }, { k: 'Ī_y about the centroidal y′ axis', v: sec.Ic.y, u: u4, hl: true }, { k: 'Product of inertia Ī_xy (centroidal)', v: sec.Ic.xy, u: u4 },
      { k: 'I_x about the given x axis', v: sec.I0.x, u: u4 }, { k: 'I_y about the given y axis', v: sec.I0.y, u: u4 }, { k: 'I_xy about the given axes', v: sec.I0.xy, u: u4 },
      { k: 'Radius of gyration k_x', v: sec.kx, u: Lu }, { k: 'Radius of gyration k_y', v: sec.ky, u: Lu }, { k: 'Polar moment of inertia J_C', v: sec.J, u: u4 });
    const pr = inertiaSteps(S, out, sec.Ic.x, sec.Ic.y, sec.Ic.xy, theta, u4, ['Ī_x', 'Ī_y', 'Ī_xy']);
    S.add({ t: 'Section moduli about the centroidal x′ axis', f: 'S = Ī_x / c', s: `c_top = ${fmt(sec.c.top)} ${Lu}, c_bottom = ${fmt(sec.c.bottom)} ${Lu}`, r: `S_top = ${fmt(sec.S.top)} ${u3}, S_bottom = ${fmt(sec.S.bottom)} ${u3}`, n: 'c is the distance from the centroidal axis to the farthest fibre on each side.' });
    out.push({ k: 'Section modulus S_x, top fibre', v: sec.S.top, u: u3 }, { k: 'Section modulus S_x, bottom fibre', v: sec.S.bottom, u: u3 });
    const warn = [];
    if (R.some((r) => r.sign < 0)) warn.push('Holes are assumed to lie fully inside the solid parts.');
    return { ok: true, err: [], warn, status: { cls: 'ok', text: 'Composite area' }, out, steps: S.list, geo: { kind: 'area', Lu, sec, parts: tp.parts, theta, mohr: pr.m, at: pr.at, round: pr.round } };
  }

  /* ------------------------------------------------------------------ */
  /* Inclined axes from known Ix, Iy, Ixy                               */
  /* ------------------------------------------------------------------ */
  function inclined(st) {
    const u4 = st.lu + '⁴', q = st.inc, Ix = +q.Ix, Iy = +q.Iy, Ixy = +q.Ixy, theta = +q.theta || 0;
    const err = [];
    if (!(Ix > 0) || !isFinite(Ix)) err.push('I_x must be greater than zero.');
    if (!(Iy > 0) || !isFinite(Iy)) err.push('I_y must be greater than zero.');
    if (!isFinite(Ixy)) err.push('Enter the product of inertia I_xy (zero if x or y is an axis of symmetry).');
    if (!err.length && Ixy * Ixy > Ix * Iy * (1 + 1e-9)) err.push('These values cannot belong to a real area: I_xy² cannot be greater than I_x · I_y (the minimum principal moment of inertia would be negative).');
    if (err.length) return fail(err);
    const S = Steps(), out = [];
    S.add({ t: 'Given', n: 'Moments and product of inertia about the x and y axes through the point.', r: `I_x = ${fmt(Ix)} ${u4}, I_y = ${fmt(Iy)} ${u4}, I_xy = ${fmt(Ixy)} ${u4}` });
    const m0 = Mohr.inertia(Ix, Iy, Ixy);
    S.add({ t: "Mohr's circle", f: 'centre at I_avg = (I_x + I_y)/2,  radius R = √(((I_x − I_y)/2)² + I_xy²)', s: `I_avg = (${fmt(Ix)} + ${fmt(Iy)})/2,  R = √(${sq(m0.d)}² + ${sq(Ixy)}²)`, r: `I_avg = ${fmt(m0.avg)} ${u4}, R = ${fmt(m0.R)} ${u4}`, n: 'The reference point A is plotted at (I_x, I_xy). A rotation θ of the axes is a rotation 2θ on the circle in the same direction.' });
    const pr = inertiaSteps(S, out, Ix, Iy, Ixy, theta, u4, ['I_x', 'I_y', 'I_xy']);
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: "Mohr's circle for inertia" }, out, steps: S.list, geo: { kind: 'inclined', Lu: st.lu, Ix, Iy, Ixy, theta, mohr: pr.m, at: pr.at, round: pr.round } };
  }

  /* ------------------------------------------------------------------ */
  /* Composite line (wire)                                              */
  /* ------------------------------------------------------------------ */
  function line(st) {
    const Lu = st.lu, u2 = Lu + '²', segs = st.line.segs || [], err = [];
    if (!segs.length) err.push('Add at least one segment.');
    const rows = segs.map((g, i) => {
      const n = `Segment ${i + 1}`;
      if (g.kind === 'arc') {
        const r = +g.r, a1 = +g.a1, a2 = +g.a2, sweep = a2 - a1;
        if (!(r > 0)) err.push(`${n}: the radius must be greater than zero.`);
        if (!(Math.abs(sweep) > 0) || Math.abs(sweep) > 360) err.push(`${n}: the arc must sweep more than 0° and at most 360°.`);
        const al = (Math.abs(sweep) / 2) * DEG, mid = ((a1 + a2) / 2) * DEG, rc = al > 0 ? (r * Math.sin(al)) / al : r;
        return { kind: 'arc', name: 'Arc', L: r * 2 * al, x: +g.cx + rc * Math.cos(mid), y: +g.cy + rc * Math.sin(mid), z: 0, note: `L = rθ = ${fmt(r)}(${fmt(2 * al)} rad); centroid at r sin α / α = ${fmt(rc)} ${Lu} from the centre, α = ${fmt(al / DEG)}°`, g };
      }
      const d = [g.x2 - g.x1, g.y2 - g.y1, g.z2 - g.z1].map(Number), L = Math.hypot(...d);
      if (!(L > 0) || !isFinite(L)) err.push(`${n}: the two ends are the same point.`);
      return { kind: 'line', name: 'Straight', L, x: (+g.x1 + +g.x2) / 2, y: (+g.y1 + +g.y2) / 2, z: (+g.z1 + +g.z2) / 2, note: 'centroid at mid-length', g };
    });
    if (err.length) return fail(err);
    const L = rows.reduce((s, r) => s + r.L, 0), sx = rows.reduce((s, r) => s + r.x * r.L, 0), sy = rows.reduce((s, r) => s + r.y * r.L, 0), sz = rows.reduce((s, r) => s + r.z * r.L, 0);
    const c = [sx / L, sy / L, sz / L].map((v) => (Math.abs(v) < 1e-12 * L ? 0 : v));
    const S = Steps();
    S.add({ t: 'Composite parts', n: 'The wire is divided into straight segments and circular arcs. Arcs lie in the x–y plane.', table: { head: ['Segment', 'Length and centroid'], rows: rows.map((r, i) => [`${i + 1} ${r.name}`, r.note]) } });
    S.add({ t: 'Summations', table: { head: ['Segment', `L (${Lu})`, `x̃ (${Lu})`, `ỹ (${Lu})`, `z̃ (${Lu})`, `x̃L (${u2})`, `ỹL (${u2})`, `z̃L (${u2})`], rows: rows.map((r, i) => [String(i + 1), fmt(r.L), fmt(r.x), fmt(r.y), fmt(r.z), fmt(r.x * r.L), fmt(r.y * r.L), fmt(r.z * r.L)]).concat([['Σ', fmt(L), '', '', '', fmt(sx), fmt(sy), fmt(sz)]]) } });
    S.add({ t: 'Centroid of the wire', f: 'x̄ = Σx̃L / ΣL,  ȳ = ΣỹL / ΣL,  z̄ = Σz̃L / ΣL', s: `x̄ = ${fmt(sx)} / ${fmt(L)},  ȳ = ${fmt(sy)} / ${fmt(L)},  z̄ = ${fmt(sz)} / ${fmt(L)}`, r: `x̄ = ${fmt(c[0])} ${Lu}, ȳ = ${fmt(c[1])} ${Lu}, z̄ = ${fmt(c[2])} ${Lu}`, n: 'The centroid of a bent wire usually does not lie on the wire.' });
    const out = [{ k: 'Total length L', v: L, u: Lu }, { k: 'Centroid x̄', v: c[0], u: Lu, hl: true }, { k: 'Centroid ȳ', v: c[1], u: Lu, hl: true }, { k: 'Centroid z̄', v: c[2], u: Lu, hl: true }];
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: 'Composite wire' }, out, steps: S.list, geo: { kind: 'line', Lu, rows, c, L } };
  }

  /* ------------------------------------------------------------------ */
  /* Composite body                                                     */
  /* ------------------------------------------------------------------ */
  function volume(st, U) {
    const Lu = st.lu, u3 = Lu + '³', q = st.vol, parts = q.parts || [], err = [], us = U.id === 'US';
    if (!parts.length) err.push('Add at least one part.');
    const toVol = Math.pow(Core.convert(1, Lu, us ? 'ft' : 'm'), 3); // lu³ to m³ or ft³
    const mU = us ? 'lb' : 'kg', rU = us ? 'lb/ft³' : 'Mg/m³', mName = us ? 'W' : 'm';
    const rows = parts.map((p, i) => {
      const n = `Part ${i + 1} (${VNAME[p.kind] || p.kind})`, r = +p.r, h = +p.h, a = +p.a, b = +p.b, up = p.dir === 'down' ? -1 : 1;
      const pos = (v, what) => { if (!(+v > 0) || !isFinite(+v)) err.push(`${n}: ${what} must be greater than zero.`); };
      let V = 0, zc = 0, f = '', fc = '';
      if (p.kind === 'cyl') { pos(r, 'radius r'); pos(h, 'height h'); V = PI * r * r * h; zc = h / 2; f = 'πr²h'; fc = 'h/2'; }
      else if (p.kind === 'cone') { pos(r, 'base radius r'); pos(h, 'height h'); V = (PI * r * r * h) / 3; zc = h / 4; f = 'πr²h/3'; fc = 'h/4 from the base'; }
      else if (p.kind === 'hemi') { pos(r, 'radius r'); V = (2 * PI * r ** 3) / 3; zc = (3 * r) / 8; f = '2πr³/3'; fc = '3r/8 from the flat face'; }
      else if (p.kind === 'block') { pos(a, 'width a'); pos(b, 'depth b'); pos(h, 'height h'); V = a * b * h; zc = h / 2; f = 'abh'; fc = 'h/2'; }
      else err.push(`${n}: unknown kind.`);
      if (q.useRho) pos(p.rho, us ? 'specific weight γ' : 'density ρ');
      const sg = p.hole ? -1 : 1, m = q.useRho ? sg * +p.rho * (us ? 1 : 1000) * V * toVol : sg * V;
      return { p, name: VNAME[p.kind], sign: sg, V: sg * V, m, x: +p.x, y: +p.y, z: +p.z + up * zc, f, fc, up };
    });
    if (err.length) return fail(err);
    const W = rows.reduce((s, r) => s + r.m, 0), Vt = rows.reduce((s, r) => s + r.V, 0);
    if (!(W > 1e-12 * Math.max(...rows.map((r) => Math.abs(r.m))))) return fail('The holes remove all of the material. The net ' + (q.useRho ? (us ? 'weight' : 'mass') : 'volume') + ' must be greater than zero.');
    const sm = (k) => rows.reduce((s, r) => s + r[k] * r.m, 0);
    const c = [sm('x') / W, sm('y') / W, sm('z') / W].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
    const wn = q.useRho ? mName : 'V', wu = q.useRho ? mU : u3, pu = `${wu}·${Lu}`;
    const S = Steps();
    S.add({ t: 'Composite parts', n: `A hole is entered as a negative part. z̃ is measured along the axis of each part from its base${q.useRho ? `. ${us ? 'Weight W = γV' : 'Mass m = ρV'}, with ${us ? 'γ' : 'ρ'} in ${rU}` : ''}.`, table: { head: ['Part', `V (${u3})`, 'Centroid'], rows: rows.map((r, i) => [`${i + 1} ${r.name}${r.sign < 0 ? ' (hole)' : ''}`, `${r.sign < 0 ? '−' : ''}${r.f} = ${fmt(r.V)}`, r.fc]) } });
    S.add({ t: 'Summations', table: { head: ['Part', `${wn} (${wu})`, `x̃ (${Lu})`, `ỹ (${Lu})`, `z̃ (${Lu})`, `x̃${wn} (${pu})`, `ỹ${wn} (${pu})`, `z̃${wn} (${pu})`], rows: rows.map((r, i) => [String(i + 1), fmt(r.m), fmt(r.x), fmt(r.y), fmt(r.z), fmt(r.x * r.m), fmt(r.y * r.m), fmt(r.z * r.m)]).concat([['Σ', fmt(W), '', '', '', fmt(sm('x')), fmt(sm('y')), fmt(sm('z'))]]) } });
    const what = q.useRho ? (us ? 'Centre of gravity' : 'Centre of mass') : 'Centroid of the volume';
    S.add({ t: what, f: `x̄ = Σx̃${wn} / Σ${wn},  ȳ = Σỹ${wn} / Σ${wn},  z̄ = Σz̃${wn} / Σ${wn}`, s: `z̄ = ${fmt(sm('z'))} / ${fmt(W)}`, r: `x̄ = ${fmt(c[0])} ${Lu}, ȳ = ${fmt(c[1])} ${Lu}, z̄ = ${fmt(c[2])} ${Lu}` });
    const out = [{ k: 'Net volume V', v: Vt, u: u3 }];
    if (q.useRho) out.push({ k: us ? 'Total weight W' : 'Total mass m', v: W, u: mU });
    out.push({ k: `${what} x̄`, v: c[0], u: Lu, hl: true }, { k: `${what} ȳ`, v: c[1], u: Lu, hl: true }, { k: `${what} z̄`, v: c[2], u: Lu, hl: true });
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: 'Composite body' }, out, steps: S.list, geo: { kind: 'volume', Lu, rows, c, what } };
  }

  /* ------------------------------------------------------------------ */
  /* Pappus and Guldinus                                                */
  /* ------------------------------------------------------------------ */
  function pappus(st) {
    const Lu = st.lu, u2 = Lu + '²', u3 = Lu + '³', q = st.pap, ang = +q.angle, err = [];
    if (!(ang > 0 && ang <= 360)) err.push('The angle of revolution must be more than 0° and at most 360°.');
    const th = ang * DEG, S = Steps();
    let Lsum = 0, rL = 0, A = 0, rA = 0, profile = [], lines = [], closedArc = null;
    if (q.kind === 'polygon') {
      const pts = (q.pts || []).map((p) => [+p.r, +p.z]);
      if (pts.length < 3) err.push('The profile needs at least three points.');
      if (pts.some((p) => !(p[0] >= 0) || !isFinite(p[1]))) err.push('Every point needs r ≥ 0. The generating area cannot cross the axis of revolution.');
      if (!err.length) {
        const pp = Section.polyProps(pts);
        if (!(Math.abs(pp.A) > 1e-12)) err.push('The profile points enclose no area.');
        else {
          A = Math.abs(pp.A); rA = Math.abs(pp.Sy); profile = pts;
          pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), rm = (a[0] + b[0]) / 2; if (L > 0) lines.push({ i, L, r: rm, onAxis: a[0] === 0 && b[0] === 0 }); });
          lines.forEach((l) => { Lsum += l.L; rL += l.r * l.L; });
        }
      }
    } else {
      const a = +q.a, R = q.kind === 'semicircle' ? 0 : +q.R;
      if (!(a > 0)) err.push('The radius a of the generating circle must be greater than zero.');
      if (q.kind === 'circle' && !(R >= a)) err.push('The centre distance R must be at least the radius a, so the circle does not cross the axis.');
      if (!err.length) {
        if (q.kind === 'circle') { Lsum = 2 * PI * a; rL = R * Lsum; A = PI * a * a; rA = R * A; closedArc = { R, a, full: true }; for (let i = 0; i < 48; i++) profile.push([R + a * Math.cos((i / 48) * 2 * PI), a * Math.sin((i / 48) * 2 * PI)]); }
        else { Lsum = PI * a; rL = ((2 * a) / PI) * Lsum; A = (PI * a * a) / 2; rA = ((4 * a) / (3 * PI)) * A; closedArc = { R: 0, a, full: false }; for (let i = 0; i <= 32; i++) profile.push([a * Math.cos(-PI / 2 + (i / 32) * PI), a * Math.sin(-PI / 2 + (i / 32) * PI)]); }
      }
    }
    if (err.length) return fail(err);
    const rbarL = rL / Lsum, rbarA = rA / A, As = th * rL, V = th * rA;
    if (q.kind === 'polygon') {
      S.add({ t: 'Generating curve: the edges of the profile', n: 'r̃ is the distance from the axis of revolution (the z axis) to the middle of each edge. An edge lying on the axis generates no surface.', table: { head: ['Edge', `L (${Lu})`, `r̃ (${Lu})`, `r̃L (${u2})`], rows: lines.map((l) => [`${l.i + 1}–${((l.i + 1) % profile.length) + 1}`, fmt(l.L), fmt(l.r), fmt(l.r * l.L)]).concat([['Σ', fmt(Lsum), '', fmt(rL)]]) } });
      S.add({ t: 'Generating area', n: 'Area and centroid of the profile polygon.', f: 'r̄ = Σr̃A / ΣA', r: `A = ${fmt(A)} ${u2}, r̄ = ${fmt(rbarA)} ${Lu}` });
    } else if (q.kind === 'circle') {
      S.add({ t: 'Generating curve and area', n: 'A circle of radius a with its centre at a distance R from the axis. The centroid of both the circumference and the area is at the centre.', f: 'L = 2πa,  A = πa²,  r̄ = R', r: `L = ${fmt(Lsum)} ${Lu}, A = ${fmt(A)} ${u2}, r̄ = ${fmt(+q.R)} ${Lu}` });
    } else {
      S.add({ t: 'Generating curve and area', n: 'A semicircle of radius a with its diameter on the axis of revolution.', f: 'arc: L = πa, r̄ = 2a/π;   area: A = πa²/2, r̄ = 4a/(3π)', r: `arc: L = ${fmt(Lsum)} ${Lu}, r̄ = ${fmt(rbarL)} ${Lu};  area: A = ${fmt(A)} ${u2}, r̄ = ${fmt(rbarA)} ${Lu}` });
    }
    S.add({ t: 'Surface area of revolution (first theorem)', f: 'A = θ Σ r̃L, with θ in radians', s: `A = ${fmt(th)}(${fmt(rL)})`, r: `A = ${fmt(As)} ${u2}`, n: ang < 360 ? 'For a partial revolution this is the curved surface only; the two flat end faces are not included.' : undefined });
    S.add({ t: 'Volume of revolution (second theorem)', f: 'V = θ r̄ A', s: `V = ${fmt(th)}(${fmt(rbarA)})(${fmt(A)})`, r: `V = ${fmt(V)} ${u3}` });
    const out = [{ k: 'Length of the generating curve L', v: Lsum, u: Lu }, { k: 'Generating area', v: A, u: u2 }, { k: 'Centroid of the area from the axis r̄', v: rbarA, u: Lu },
      { k: 'Surface area of revolution', v: As, u: u2, hl: true }, { k: 'Volume of revolution', v: V, u: u3, hl: true }];
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: 'Pappus and Guldinus' }, out, steps: S.list, geo: { kind: 'pappus', Lu, profile, ang, rbarA, rbarL, A, zc: profile.reduce((s, p) => s + p[1], 0) / profile.length, sub: q.kind } };
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  function convertState(st, from, to) {
    const old = st.lu, nu = Core.twin(old, to), f = Core.convert(1, old, nu), T = (v) => Core.tidy(v * f, 8);
    st.lu = nu;
    st.area.parts.forEach((p) => ['x', 'y', 'b', 'h', 'r'].forEach((k) => { if (typeof p[k] === 'number') p[k] = T(p[k]); }));
    Object.keys(st.area.dims).forEach((k) => (st.area.dims[k] = T(st.area.dims[k])));
    st.line.segs.forEach((g) => ['cx', 'cy', 'r', 'x1', 'y1', 'z1', 'x2', 'y2', 'z2'].forEach((k) => { if (typeof g[k] === 'number') g[k] = T(g[k]); }));
    const rf = to === 'US' ? 62.428 : 1 / 62.428;
    st.vol.parts.forEach((p) => { ['x', 'y', 'z', 'r', 'h', 'a', 'b'].forEach((k) => { if (typeof p[k] === 'number') p[k] = T(p[k]); }); p.rho = Core.tidy(p.rho * rf, 8); });
    st.pap.pts.forEach((p) => { p.r = T(p.r); p.z = T(p.z); }); st.pap.R = T(st.pap.R); st.pap.a = T(st.pap.a);
    const f4 = f ** 4; ['Ix', 'Iy', 'Ixy'].forEach((k) => (st.inc[k] = Core.tidy(st.inc[k] * f4, 9)));
    if (st.ig) IG().convertState(st.ig, f, from, to);
  }

  const SecMod = { defaults, solve, convertState, LUS, VKIND, areaParts };
  root.SecMod = SecMod;
  if (typeof module !== 'undefined' && module.exports) module.exports = SecMod;
})(typeof window !== 'undefined' ? window : globalThis);
