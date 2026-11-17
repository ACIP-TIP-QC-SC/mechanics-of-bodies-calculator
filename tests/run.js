/* Physics checks against textbook answers (Hibbeler). Run: node tests/run.js [filter]
 * Textbook answers are rounded to 3 significant figures, so the tolerance is 0.5 %. */
'use strict';
const path = require('path');
const R = (p) => require(path.join(__dirname, '..', p));
const Core = R('shared/core.js'), Beam = R('shared/beam.js'), Internal = R('st/internal.js');
const Section = R('shared/section.js'), Mohr = R('shared/mohr.js'), SecMod = R('st/section.js');
const U = Core.UNITS;
let pass = 0, failN = 0;
const filter = (process.argv[2] || '').toLowerCase();
const groups = [];
const group = (name, fn) => groups.push([name, fn]);
function close(label, got, want, tol) {
  tol = tol === undefined ? 0.005 : tol;
  const ok = typeof got === 'number' && isFinite(got) && Math.abs(got - want) <= tol * Math.max(Math.abs(want), 1e-9) + (want === 0 ? 1e-9 : 0);
  if (ok) pass++; else { failN++; console.log(`  FAIL ${label}: got ${got}, expected ${want}`); }
}
function truthy(label, v) { if (v) pass++; else { failN++; console.log(`  FAIL ${label}`); } }
const out = (res, k) => { const o = (res.out || []).find((x) => x.k === k); return o ? o.v : NaN; };
const SS = (L) => [{ type: 'pin', x: 0 }, { type: 'roller', x: L }];

const ZSEC = [{ kind: 'rect', x: -300, y: 50, b: 100, h: 300 }, { kind: 'rect', x: -300, y: -50, b: 600, h: 100 }, { kind: 'rect', x: 200, y: -350, b: 100, h: 300 }];
const EX911 = [{ kind: 'cone', x: 0, y: 0, z: 0, r: 50, h: 200, dir: 'up', rho: 8 }, { kind: 'hemi', x: 0, y: 0, z: 0, r: 50, dir: 'down', rho: 4 }, { kind: 'cone', x: 0, y: 0, z: 100, r: 25, h: 100, dir: 'up', rho: 8, hole: true }, { kind: 'cyl', x: 0, y: 0, z: 0, r: 25, h: 100, dir: 'up', rho: 8, hole: true }];
group('core', () => {
  close('kN·m to lb·ft', Core.convert(1, 'kN·m', 'lb·ft'), 737.562, 1e-5);
  close('kN/m to lb/ft', Core.convert(1, 'kN/m', 'lb/ft'), 68.5218, 1e-5);
  truthy('twin kN/m', Core.twin('kN/m', 'US') === 'kip/ft');
  truthy('fmt 4 s.f.', Core.fmt(31.1769) === '31.18' && Core.fmt(-0.000012345) === '−1.234e-5');
  const d = Core.deepMerge({ a: [1, 2, 3], b: { c: 1, d: 2 } }, { a: [9], b: { c: 5 } });
  truthy('deepMerge replaces arrays and keeps defaults', d.a.length === 1 && d.b.c === 5 && d.b.d === 2);
  const s = Core.linSolve([[1, 1], [1, -1]], [3, 1]);
  truthy('linSolve', s.rank === 2 && Math.abs(s.x[0] - 2) < 1e-12 && Math.abs(s.x[1] - 1) < 1e-12);
});

group('beam engine', () => {
  // Statics Example 7.1: 6 kN at 3 m, counterclockwise couple 9 kN·m at D
  let b = Beam.solve({ L: 9, supports: SS(9), loads: [{ kind: 'point', x: 3, P: 6 }, { kind: 'couple', x: 9, M: 9, dir: 'ccw' }] });
  close('7.1 A_y', b.reactions[0].Ry, 5);
  close('7.1 V left of load', b.at(3, 'L').V, 5); close('7.1 V right of load', b.at(3, 'R').V, -1);
  close('7.1 M at load', b.at(3, 'L').M, 15); close('7.1 M right', b.at(3, 'R').M, 15);
  // Example 7.2: cantilever, triangular 1200 N/m at the wall to 0 at the tip
  b = Beam.solve({ L: 3, supports: [{ type: 'fixed', x: 0 }], loads: [{ kind: 'dist', x1: 0, x2: 3, w1: 1200, w2: 0 }] });
  close('7.2 V_C', b.at(1.5).V, 450); close('7.2 M_C', b.at(1.5).M, -225); close('7.2 N_C', b.at(1.5).N, 0);
  close('7.2 M_A', b.reactions[0].M, 1800); close('7.2 cut steps agree', b.cutSteps(1.5).M, -225);
  // Example 7.6
  b = Beam.solve({ L: 4, supports: SS(4), loads: [{ kind: 'point', x: 2, P: 5 }] });
  close('7.6 V AB', b.at(1).V, 2.5); close('7.6 V BC', b.at(3).V, -2.5); close('7.6 M max', b.ext.Mmax.M, 5); close('7.6 x', b.ext.Mmax.x, 2);
  // Example 7.7
  b = Beam.solve({ L: 9, supports: SS(9), loads: [{ kind: 'dist', x1: 0, x2: 9, w1: 0, w2: 6 }] });
  close('7.7 A_y', b.reactions[0].Ry, 9); close('7.7 B_y', b.reactions[1].Ry, 18);
  close('7.7 M max', b.ext.Mmax.M, 31.2); close('7.7 x of V = 0', b.ext.Mmax.x, 5.20);
  close('7.7 V(x) coefficient', b.segs[0].cV[2], -1 / 3, 1e-9); close('7.7 M(x) coefficient', b.segs[0].cM[3], -1 / 9, 1e-9);
  // Example 7.8
  b = Beam.solve({ L: 4, supports: [{ type: 'fixed', x: 4 }], loads: [{ kind: 'point', x: 0, P: 2 }, { kind: 'dist', x1: 2, x2: 4, w1: 1.5, w2: 1.5 }] });
  close('7.8 B_y', b.reactions[0].Ry, 5); close('7.8 V at wall', b.at(4, 'L').V, -5); close('7.8 M at 2 m', b.at(2).M, -4); close('7.8 M at wall', b.at(4, 'L').M, -11);
  close('7.8 M_B reaction (clockwise 11)', b.reactions[0].M, -11);
  // Example 7.9
  b = Beam.solve({ L: 6, supports: [{ type: 'pin', x: 0 }, { type: 'roller', x: 4 }], loads: [{ kind: 'dist', x1: 4, x2: 6, w1: 4, w2: 4 }] });
  close('7.9 A_y', b.reactions[0].Ry, -2); close('7.9 B_y', b.reactions[1].Ry, 10); close('7.9 V right of B', b.at(4, 'R').V, 8); close('7.9 M at B', b.ext.Mmin.M, -8);
  // Example 7.10 (lb, ft)
  b = Beam.solve({ L: 12, supports: SS(12), loads: [{ kind: 'dist', x1: 0, x2: 12, w1: 0, w2: 120 }] });
  close('7.10 V(0)', b.at(0, 'R').V, 240); close('7.10 V(12)', b.at(12, 'L').V, -480); close('7.10 x', b.ext.Mmax.x, 6.93); close('7.10 M max', b.ext.Mmax.M, 1109);
  // Mechanics of Materials Appendix D checks: wL²/8 and PL/4, cantilever wL²/2
  b = Beam.solve({ L: 8, supports: SS(8), loads: [{ kind: 'dist', x1: 0, x2: 8, w1: 3, w2: 3 }] });
  close('wL²/8', b.ext.Mmax.M, 24, 1e-9);
  b = Beam.solve({ L: 5, supports: [{ type: 'fixed', x: 0 }], loads: [{ kind: 'dist', x1: 0, x2: 5, w1: 2, w2: 2 }] });
  close('cantilever wL²/2', b.ext.Mmin.M, -25, 1e-9);
  // deflected shape (EI·v): 5wL⁴/384 at midspan, PL³/3 at the tip of a cantilever, PL³/48
  b = Beam.solve({ L: 8, supports: SS(8), loads: [{ kind: 'dist', x1: 0, x2: 8, w1: 3, w2: 3 }] });
  close('EI·v = 5wL⁴/384', b.defl.max.y, -5 * 3 * 8 ** 4 / 384, 1e-6); close('at midspan', b.defl.max.x, 4, 1e-6);
  b = Beam.solve({ L: 5, supports: [{ type: 'fixed', x: 5 }], loads: [{ kind: 'point', x: 0, P: 2 }] });
  close('EI·v = PL³/3', b.defl.y(0), -2 * 125 / 3, 1e-9); close('fixed end stays', b.defl.y(5), 0, 1e-9);
  b = Beam.solve({ L: 6, supports: SS(6), loads: [{ kind: 'point', x: 3, P: 4 }] });
  close('EI·v = PL³/48', b.defl.y(3), -4 * 216 / 48, 1e-9);
  // inclined load: 10 kN at 60° at midspan of 6 m → A_x = −5, N = +5 left of the load
  b = Beam.solve({ L: 6, supports: SS(6), loads: [{ kind: 'point', x: 3, P: 10, ang: 60 }] });
  close('inclined A_x', b.reactions[0].Rx, -5, 1e-9); close('inclined N', b.at(1).N, 5, 1e-9); close('inclined N right', b.at(4).N, 0, 1e-9);
  close('inclined M', b.ext.Mmax.M, 10 * Math.sin(Math.PI / 3) * 6 / 4, 1e-9);
  // compound beam: fixed at 0, hinge at 4, roller at 8, 12 kN at 6 → B_y = 6, A_y = 6, M_A = −24 (clockwise reaction = hogging at wall)
  b = Beam.solve({ L: 8, supports: [{ type: 'fixed', x: 0 }, { type: 'roller', x: 8 }], loads: [{ kind: 'point', x: 6, P: 12 }], hinges: [4] });
  close('hinge B_y', b.reactions[1].Ry, 6, 1e-9); close('hinge A_y', b.reactions[0].Ry, 6, 1e-9); close('hinge M at wall', b.at(0, 'R').M, -24, 1e-9); close('hinge M = 0', b.at(4).M, 0, 1e-9);
  close('hinge: roller stays', b.defl.y(8), 0, 1e-6); close('hinge: wall stays', b.defl.y(0), 0, 1e-9); close('hinge: deflection there = cantilever with 6 at its tip', b.defl.y(4), -6 * 64 / 3, 1e-9);
  truthy('hinge steps solve one unknown at a time', b.stepsReact.every((s) => s.t !== 'Remaining equations, solved together'));
  // closure of the diagrams
  truthy('closure', Math.abs(b.closure.V) < 1e-9 && Math.abs(b.closure.M) < 1e-9);
  // classification
  truthy('indeterminate', Beam.solve({ L: 6, supports: [{ type: 'fixed', x: 0 }, { type: 'roller', x: 6 }], loads: [{ kind: 'point', x: 3, P: 1 }] }).det.cls === 'indeterminate');
  truthy('unstable', Beam.solve({ L: 6, supports: [{ type: 'roller', x: 2 }], loads: [{ kind: 'point', x: 3, P: 1 }] }).det.cls === 'unstable');
  truthy('improper', Beam.solve({ L: 6, supports: [{ type: 'roller', x: 0 }, { type: 'roller', x: 3 }, { type: 'roller', x: 6 }], loads: [{ kind: 'point', x: 3, P: 1 }] }).ok === false);
  truthy('partial but balanced', Beam.solve({ L: 6, supports: [{ type: 'roller', x: 0 }, { type: 'roller', x: 6 }], loads: [{ kind: 'point', x: 3, P: 1 }] }).det.cls === 'partial');
  truthy('no support', Beam.solve({ L: 6, supports: [], loads: [] }).ok === false);
});

group('internal forces module', () => {
  const D = Internal.defaults;
  const st = (o) => Core.deepMerge(D(), o);
  let r = Internal.solve(st({ L: 9, supports: SS(9), loads: [{ kind: 'dist', x1: 0, x2: 9, w1: 0, w2: 6 }] }), U.SI);
  close('module M max', out(r, 'Maximum moment (most positive)'), 31.2);
  truthy('module steps', r.ok && r.steps.length >= 6 && r.steps.every((s) => s.t));
  // Example 7.11: cable
  r = Internal.solve(st({ mode: 'cableP' }), U.SI);
  close('7.11 A_y', out(r, 'Reaction A_y'), 12); close('7.11 E_y', out(r, 'Reaction E_y'), 10); close('7.11 F_H', out(r, 'Horizontal force F_H'), 6.33);
  close('7.11 T_BC', out(r, 'Tension T_BC'), 10.2); close('7.11 angle BC', out(r, 'Angle of BC from horizontal'), 51.6);
  close('7.11 T_AB', out(r, 'Tension T_AB'), 13.6); close('7.11 T_CD', out(r, 'Tension T_CD'), 9.44); close('7.11 T_DE', out(r, 'Tension T_DE'), 11.8);
  // same cable defined by its horizontal force must give the same sag
  r = Internal.solve(st({ mode: 'cableP', cab: { known: 'FH', FH: 19 / 3 } }), U.SI);
  close('cable from F_H: sag at C', out(r, 'Sag at C (below A)'), 12, 1e-9);
  // supports at different levels: equilibrium of the right support
  r = Internal.solve(st({ mode: 'cableP', cab: { span: 10, hB: 2, loads: [{ x: 4, P: 10 }], at: 1, sag: 3 } }), U.SI);
  const g = r.geo; close('unequal supports: chord closes', g.pts[2].sag, -2, 1e-9);
  close('unequal supports: ΣM_A', g.By * 10 - g.FH * 2 - 10 * 4, 0, 1e-9);
  // Example 7.12: T_max = (w0 L/2)·sqrt(1 + (L/4h)²), F_H = w0 L²/8h
  r = Internal.solve(st({ mode: 'cableU' }), U.SI);
  close('7.12 F_H', out(r, 'Horizontal force F_H (tension at the lowest point)'), 625, 1e-9);
  close('7.12 T_max', out(r, 'Maximum tension T_max'), 250 * Math.sqrt(1 + 2.5 * 2.5), 1e-9);
  close('7.12 length', out(r, 'Cable length'), 50 * (Math.sqrt(1 + 0.16) + 2.5 * Math.asinh(0.4)), 1e-9);
  const r2 = Internal.solve(st({ mode: 'cableU', par: { given: 'Tmax', Tmax: out(r, 'Maximum tension T_max') } }), U.SI);
  close('parabola: sag from T_max', out(r2, 'Sag below A'), 10, 1e-9);
  const r3 = Internal.solve(st({ mode: 'cableU', par: { given: 'len', len: out(r, 'Cable length') } }), U.SI);
  close('parabola: sag from length', out(r3, 'Sag below A'), 10, 1e-6);
  const r4 = Internal.solve(st({ mode: 'cableU', par: { L: 30, level: false, hA: 4, hB: 9, w0: 2 } }), U.SI);
  close('parabola unequal: x_A', out(r4, 'Lowest point, distance from A'), 12, 1e-9); close('parabola unequal: F_H', out(r4, 'Horizontal force F_H (tension at the lowest point)'), 36, 1e-9);
  // Example 7.13: catenary
  r = Internal.solve(st({ mode: 'catenary', fu: 'N' }), U.SI);
  close('7.13 F_H', out(r, 'Horizontal force F_H (tension at the lowest point)'), 45.9); close('7.13 length', out(r, 'Cable length'), 24.2); close('7.13 T_max', out(r, 'Maximum tension T_max'), 75.9);
  const r5 = Internal.solve(st({ mode: 'catenary', fu: 'N', cat: { given: 'len', len: out(r, 'Cable length') } }), U.SI);
  close('catenary: sag from length', out(r5, 'Sag h'), 6, 1e-6);
  // switching units keeps the same problem: 31.18 kN·m = 22.99 kip·ft
  const sv = st({ L: 9, supports: SS(9), loads: [{ kind: 'dist', x1: 0, x2: 9, w1: 0, w2: 6 }] });
  Internal.convertState(sv, 'SI', 'US');
  truthy('units: force unit becomes kip', sv.fu === 'kip');
  close('units: same maximum moment', out(Internal.solve(sv, U.US), 'Maximum moment (most positive)'), Core.convert(31.1769, 'kN·m', 'kip·ft'), 1e-4);
  Internal.convertState(sv, 'US', 'SI');
  close('units: round trip', sv.loads[0].w2, 6, 1e-5);
  // failing inputs give messages, never NaN
  truthy('bad cable', Internal.solve(st({ mode: 'cableP', cab: { loads: [{ x: 30, P: 4 }] } }), U.SI).ok === false);
  truthy('short cable', Internal.solve(st({ mode: 'catenary', cat: { given: 'len', len: 10 } }), U.SI).ok === false);
});

group('section engine', () => {
  // every kind and rotation against Green's theorem on its outline
  let worst = 0;
  for (const kind of ['rect', 'tri', 'circle', 'semi', 'quarter', 'sector']) for (const rot of [0, 90, 180, 270]) {
    const p = { kind, x: 3, y: -2, rot, b: 4, h: 7, r: 5, a: 35 }, r = Section.partProps(p), g = Section.polyProps(Section.outline(p, 4000));
    const gx = g.Sy / g.A, gy = g.Sx / g.A, G = { A: g.A, x: gx, y: gy, Ix: g.Ix - g.A * gy * gy, Iy: g.Iy - g.A * gx * gx, Ixy: g.Ixy - g.A * gx * gy };
    for (const k of ['A', 'x', 'y', 'Ix', 'Iy', 'Ixy']) worst = Math.max(worst, Math.abs(r[k] - G[k]) / Math.max(1, Math.abs(G[k])));
  }
  truthy('closed forms agree with Green\'s theorem', worst < 1e-4);
  // Example 10.4: 100 x 150 rectangle with a 25 mm radius hole, about the base
  let s = Section.solve([{ kind: 'rect', x: 0, y: 0, b: 100, h: 150 }, { kind: 'circle', x: 50, y: 75, r: 25, hole: true }]);
  close('10.4 I_x', s.I0.x, 101e6);
  // Examples 10.5, 10.7, 10.8: Z section
  s = Section.solve(ZSEC);
  close('10.5 I_x', s.Ic.x, 2.90e9); close('10.5 I_y', s.Ic.y, 5.60e9); close('10.7 I_xy', s.Ic.xy, -3.00e9);
  close('10.8 I_max', s.mohr.max, 7.54e9); close('10.8 I_min', s.mohr.min, 0.960e9); close('10.8 θ_p1', s.mohr.thp, 57.1);
  // Example 9.10: plate with a triangle, a square and a rectangular hole
  s = Section.solve([{ kind: 'tri', x: 0, y: 0, b: 3, h: 3 }, { kind: 'rect', x: -3, y: 0, b: 3, h: 3 }, { kind: 'rect', x: -3, y: 1, b: 1, h: 2, hole: true }]);
  close('9.10 x̄', s.x, -0.348); close('9.10 ȳ', s.y, 1.22);
  // shear-formula helpers on a rectangle
  s = Section.solve([{ kind: 'rect', x: 0, y: 0, b: 10, h: 20 }]);
  close('Q at the neutral axis = bh²/8', s.Q(10), 500); close('Q at quarter depth', s.Q(15), 10 * 5 * 7.5); close('t', s.t(3), 10);
  close('S = bh²/6', s.S.top, 10 * 400 / 6);
  // templates: wide-flange symmetric, pipe
  let t = Section.template('I', { bf: 200, d: 300, tf: 20, tw: 10 }); s = Section.solve(t.parts);
  close('I-shape Ī_x', s.Ic.x, (200 * 300 ** 3 - 190 * 260 ** 3) / 12); close('I-shape ȳ', s.y, 150);
  t = Section.template('pipe', { d: 100, tf: 10 }); s = Section.solve(t.parts);
  close('pipe Ī_x', s.Ic.x, Math.PI / 4 * (50 ** 4 - 40 ** 4));
  truthy('bad template is refused', Section.template('I', { bf: 100, d: 30, tf: 20, tw: 10 }).err.length > 0);
  // Mohr, stress form: σx = −20, σy = 90, τxy = 60 gives σ1 = 116, σ2 = −46.4
  const m = Mohr.stress(-20, 90, 60); close('Mohr σ1', m.max, 116.4); close('Mohr σ2', m.min, -46.4); close('Mohr θp for σ1', m.thp, 66.3);
});

group('centroids module', () => {
  const D = SecMod.defaults, mk = (o) => Core.deepMerge(D(), o);
  // Example 9.9 wire
  let r = SecMod.solve(mk({ mode: 'line' }), U.SI);
  close('9.9 x̄', out(r, 'Centroid x̄'), 45.5); close('9.9 ȳ', out(r, 'Centroid ȳ'), -22.5); close('9.9 z̄', out(r, 'Centroid z̄'), -0.805);
  // Example 9.11 frustum, hemisphere and hole
  r = SecMod.solve(mk({ mode: 'volume', vol: { useRho: true, parts: EX911 } }), U.SI);
  close('9.11 z̄', out(r, 'Centre of mass z̄'), 14.6); close('9.11 mass', out(r, 'Total mass m'), 3.142);
  // Example 9.13 solid of revolution
  r = SecMod.solve(mk({ mode: 'pappus', lu: 'in.', pap: { kind: 'polygon', angle: 360, pts: [{ r: 2.5, z: 0 }, { r: 3.5, z: 0 }, { r: 3.5, z: 3 }, { r: 2.5, z: 2 }] } }), U.US);
  close('9.13 surface area', out(r, 'Surface area of revolution'), 143); close('9.13 volume', out(r, 'Volume of revolution'), 47.6);
  // Example 9.12 sphere
  r = SecMod.solve(mk({ mode: 'pappus', pap: { kind: 'semicircle', a: 2, angle: 360 } }), U.SI);
  close('9.12 sphere area', out(r, 'Surface area of revolution'), 16 * Math.PI); close('9.12 sphere volume', out(r, 'Volume of revolution'), 32 * Math.PI / 3);
  // torus
  r = SecMod.solve(mk({ mode: 'pappus', pap: { kind: 'circle', R: 5, a: 1, angle: 360 } }), U.SI);
  close('torus volume 2π²Ra²', out(r, 'Volume of revolution'), 2 * Math.PI ** 2 * 5);
  // Example 10.8 by direct entry
  r = SecMod.solve(mk({ mode: 'inclined', inc: { Ix: 2.9e9, Iy: 5.6e9, Ixy: -3e9, theta: 57.1 } }), U.SI);
  close('10.8 I_max', out(r, 'Maximum principal moment of inertia I_max'), 7.54e9); close('10.8 I_u at θ_p1', out(r, 'I_u at θ = 57.1°'), 7.54e9);
  // composite area mode with the Z section
  r = SecMod.solve(mk({ mode: 'area', area: { shape: 'custom', parts: ZSEC, theta: 0 } }), U.SI);
  close('area mode Ī_xy', out(r, 'Product of inertia Ī_xy (centroidal)'), -3e9); truthy('step tables present', r.steps[0].table.rows.length === 4);
  // unit toggle keeps the physics
  const st = mk({ mode: 'area', area: { shape: 'custom', parts: ZSEC, theta: 0 } }); SecMod.convertState(st, 'SI', 'US');
  r = SecMod.solve(st, U.US); close('converted Ī_x in in.⁴', out(r, 'Ī_x about the centroidal x′ axis'), 2.9e9 / 25.4 ** 4, 2e-3); truthy('unit became in.', st.lu === 'in.');
  truthy('all-hole area fails', !SecMod.solve(mk({ area: { shape: 'custom', parts: [{ kind: 'rect', x: 0, y: 0, b: 1, h: 1, hole: true }] } }), U.SI).ok);
  truthy('impossible inertia fails', !SecMod.solve(mk({ mode: 'inclined', inc: { Ix: 1, Iy: 1, Ixy: 5, theta: 0 } }), U.SI).ok);
});

groups.forEach(([name, fn]) => { if (filter && !name.toLowerCase().includes(filter)) return; console.log(name); fn(); });
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
