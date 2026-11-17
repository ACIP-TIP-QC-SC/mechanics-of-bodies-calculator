/* Physics checks against textbook answers (Hibbeler). Run: node tests/run.js [filter]
 * Textbook answers are rounded to 3 significant figures, so the tolerance is 0.5 %. */
'use strict';
const path = require('path');
const R = (p) => require(path.join(__dirname, '..', p));
const Core = R('shared/core.js'), Beam = R('shared/beam.js'), Internal = R('st/internal.js');
const Forces = R('st/forces.js'), Equil = R('st/equil.js'), Truss = R('st/truss.js'), Friction = R('st/friction.js');
const Section = R('shared/section.js'), Mohr = R('shared/mohr.js'), SecMod = R('st/section.js');
const MD = R('md/mdcore.js'), Stress = R('md/stress.js'), Axial = R('md/axial.js');
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
  // catenary between uneven supports: c = 10, x_A = 6, x_B = 10 gives h_A = 10(cosh 0.6 − 1), h_B = 10(cosh 1 − 1)
  const cu = { L: 16, w0: 5, level: false, hA: 10 * (Math.cosh(0.6) - 1), hB: 10 * (Math.cosh(1) - 1) };
  r = Internal.solve(st({ mode: 'catenary', fu: 'N', cat: cu }), U.SI);
  close('uneven catenary: c', out(r, 'Catenary constant F_H / w₀'), 10, 1e-7); close('uneven catenary: x_A', out(r, 'Lowest point, distance from A'), 6, 1e-7);
  close('uneven catenary: T_B = w(c + h_B)', out(r, 'Tension at B'), 5 * (10 + cu.hB), 1e-7); close('uneven catenary: length', out(r, 'Cable length'), 10 * (Math.sinh(0.6) + Math.sinh(1)), 1e-7);
  close('uneven catenary: B sits h_B − h_A above A', r.geo.y(16), cu.hB - cu.hA, 1e-7);
  { const sU = Internal.convertState(st({ mode: 'catenary', fu: 'N', cat: Object.assign({}, cu) }), 'SI', 'US'); close('uneven catenary: units', Core.convert(out(Internal.solve(sU, U.US), 'Tension at B'), sU.fu, 'N'), 5 * (10 + cu.hB), 1e-4); }
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

group('force systems module', () => {
  const D = Forces.defaults, mk = (o) => Core.deepMerge(D(), o), SI = U.SI, US = U.US;
  const P = (F, ang) => ({ by: 'polar', F, ang }), C2 = (Fx, Fy) => ({ by: 'comp', Fx, Fy });
  // Example 2.1
  let r = Forces.solve(mk({ mode: 'coplanar', fu: 'N', co: { forces: [P(100, 15), P(150, 80)] } }), SI);
  close('2.1 F_R', out(r, 'Resultant magnitude F_R'), 212.6); close('2.1 θ', out(r, 'Direction θ (↺ from +x)'), 54.76);
  // Example 2.7 (one force by a 3-4-5 slope)
  r = Forces.solve(mk({ mode: 'coplanar', co: { forces: [P(400, 180), P(250, 45), { by: 'slope', F: 200, dx: -4, dy: 3 }] } }), SI);
  close('2.7 F_R', out(r, 'Resultant magnitude F_R'), 484.7); close('2.7 (F_R)_x', out(r, 'Resultant (F_R)_x'), -383.2); close('2.7 (F_R)_y', out(r, 'Resultant (F_R)_y'), 296.8); close('2.7 θ', out(r, 'Direction θ (↺ from +x)'), 142.2);
  // Example 2.8
  r = Forces.solve(mk({ mode: 'vector3d', fu: 'lb', v3: { forces: [{ by: 'comp', Fx: 35.36, Fy: -35.36, Fz: 86.6 }] } }), US);
  close('2.8 |F|', out(r, 'Magnitude F'), 100); close('2.8 α', out(r, 'Direction angle α (from +x)'), 69.30); close('2.8 β', out(r, 'Direction angle β (from +y)'), 110.7); close('2.8 γ', out(r, 'Direction angle γ (from +z)'), 30.00);
  r = Forces.solve(mk({ mode: 'vector3d', v3: { forces: [{ by: 'angles', F: 100, al: 69.3, be: 110.7, ga: 30 }] } }), SI);
  close('direction angles back to components', out(r, 'F_z'), 86.6);
  truthy('impossible direction angles fail', !Forces.solve(mk({ mode: 'vector3d', v3: { forces: [{ by: 'angles', F: 100, al: 30, be: 30, ga: 30 }] } }), SI).ok);
  r = Forces.solve(mk({ mode: 'vector3d', v3: { forces: [{ by: 'line', F: 700, ax: 0, ay: 0, az: 0, bx: 2, by_: 3, bz: 6 }] } }), SI);
  close('force along a line F_y', out(r, 'F_y'), 300);
  // component along a line
  r = Forces.solve(mk({ mode: 'dot', dot: { force: { by: 'line', F: 300, ax: 0, ay: 0, az: 0, bx: 2, by_: 3, bz: 6 }, P: { x: 0, y: 0, z: 0 }, Q: { x: 0, y: 4, z: 0 } } }), SI);
  close('F along y axis', out(r, 'Component along the line F_∥'), 300 * 3 / 7); close('angle with y', out(r, 'Angle θ between the force and the line'), Math.acos(3 / 7) * 180 / Math.PI);
  // moment about a point and an axis (closed form)
  r = Forces.solve(mk({ mode: 'moment' }), SI);
  close('M_O x', out(r, 'M_O x component'), 30); close('M_O y', out(r, 'M_O y component'), -20); close('M_x', out(r, 'Moment about the axis M_a (along +u_a)'), 30);
  r = Forces.solve(mk({ mode: 'moment', mom: { axis: false, forces: [{ by: 'polar', F: 0, Fx: 0, Fy: -50, Fz: 0, x: 2, y: 0, z: 0, by: 'comp' }] } }), SI);
  close('planar M_O = −Fd', out(r, 'Moment about O, M_O (↺ positive)'), -100);
  // Example 4.17
  r = Forces.solve(mk({ mode: 'reduce', fu: 'kN' }), SI);
  close('4.17 F_R', out(r, 'Resultant force F_R'), 5.367); close('4.17 θ', out(r, 'Direction θ (↺ from +x)'), 26.57); close('4.17 d', out(r, 'Line of action crosses the horizontal through O at x'), 2.25);
  // 3D parallel forces and wrench
  r = Forces.solve(mk({ mode: 'reduce3d' }), SI);
  close('parallel forces x', out(r, 'Single resultant acts at x'), 0.75); close('parallel forces y', out(r, 'Single resultant acts at y'), 0.625);
  r = Forces.solve(mk({ mode: 'reduce3d', r3: { forces: [{ by: 'comp', Fx: 0, Fy: 0, Fz: 10, x: 0, y: 0, z: 0 }], couples: [{ Mx: 0, My: 0, Mz: 5 }] } }), SI);
  close('wrench pitch', out(r, 'Pitch of the wrench p = M_∥ / F_R'), 0.5);
  // Example 4.23
  r = Forces.solve(mk({ mode: 'dist', fu: 'lb' }), US);
  close('4.23 F_R', out(r, 'Resultant force F_R (↓ positive)'), 675); close('4.23 x̄', out(r, 'Location of the resultant x̄'), 4.00);
  // unit round trip
  const st = mk({ mode: 'reduce', fu: 'kN' }); Forces.convertState(st, 'SI', 'US'); Forces.convertState(st, 'US', 'SI');
  close('unit round trip', out(Forces.solve(st, SI), 'Line of action crosses the horizontal through O at x'), 2.25, 1e-6);
});

group('equilibrium module', () => {
  const D = Equil.defaults, mk = (o) => Core.deepMerge(D(), o), SI = U.SI, US = U.US;
  // closed form: 60 kg cylinder on two cables at 30° and 45° above the horizontal
  let r = Equil.solve(mk({}), SI);
  close('T_BA', out(r, 'Force F_BA'), 430.9); close('T_BC', out(r, 'Force F_BC'), 527.7);
  // one magnitude and one angle unknown: same problem, F_BC = 527.7 N known, its angle unknown
  r = Equil.solve(mk({ pa: { how: 'angle', u2: { P: 527.7 } } }), SI);
  close('angle found', out(r, 'Angle of F_BC (↺ from +x)'), 45, 2e-3);
  truthy('cable that would push fails', !Equil.solve(mk({ pa: { u1: { ang: 330 } } }), SI).ok);
  // spring
  r = Equil.solve(mk({ pa: { u2: { type: 'spring', k: 500 } } }), SI);
  close('spring stretch', out(r, 'Stretch of spring BC'), 527.7 / 500);
  // Example 3.8
  r = Equil.solve(mk({ mode: 'particle3d' }), SI);
  close('3.8 F_B', out(r, 'Tension F_AB'), 693.7); close('3.8 F_C', out(r, 'Tension F_AC'), 812.7); close('3.8 F_D', out(r, 'Tension F_AD'), 862.0);
  // Example 5.9
  r = Equil.solve(mk({ mode: 'rigid', fu: 'lb' }), US);
  close('5.9 N_B', out(r, 'N_B'), 536.2); close('5.9 A_x', out(r, 'A_x'), 268.1); close('5.9 A_y', out(r, 'A_y'), 285.6);
  truthy('5.9 begins with a moment equation', /Moments about point A/.test(r.steps[1].t));
  // simply supported beam with a uniform load: 2 kN/m over 6 m, plus a couple at a cantilever
  r = Equil.solve(mk({ mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 6, y: 0 }], supports: [{ type: 'pin', x: 0, y: 0 }, { type: 'roller', x: 6, y: 0, ang: 90 }], loads: [], dists: [{ x1: 0, x2: 6, y: 0, w1: 2, w2: 2 }] } }), SI);
  close('UDL A_y', out(r, 'A_y'), 6); close('UDL N_B', out(r, 'N_B'), 6);
  r = Equil.solve(mk({ mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 3, y: 0 }], supports: [{ type: 'fixed', x: 0, y: 0 }], loads: [{ by: 'polar', F: 10, ang: 270, x: 3, y: 0 }], couples: [{ M: 5, dir: 'ccw', x: 1, y: 0 }], dists: [] } }), SI);
  close('cantilever M_A', out(r, 'M_A (↺ positive)'), 25); close('cantilever A_y', out(r, 'A_y'), 10);
  // cable support: beam pinned at A, cable at B pulling at 135°
  r = Equil.solve(mk({ mode: 'rigid', fu: 'kN', rb: { outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }], supports: [{ type: 'pin', x: 0, y: 0 }, { type: 'cable', x: 4, y: 0, ang: 135 }], loads: [{ by: 'polar', F: 10, ang: 270, x: 2, y: 0 }], dists: [] } }), SI);
  close('cable T_B', out(r, 'T_B'), 5 * Math.SQRT2);
  // failing: three rollers and a horizontal load
  r = Equil.solve(mk({ mode: 'rigid', rb: { outline: [{ x: 0, y: 0 }, { x: 8, y: 0 }], supports: [{ type: 'roller', x: 0, y: 0, ang: 90 }, { type: 'roller', x: 4, y: 0, ang: 90 }, { type: 'roller', x: 8, y: 0, ang: 90 }], loads: [{ by: 'polar', F: 5, ang: 0, x: 4, y: 0 }], dists: [] } }), SI);
  truthy('three rollers: improper constraint', !r.ok && /Improperly constrained/.test(r.err[0]));
  r = Equil.solve(mk({ mode: 'rigid', rb: { supports: [{ type: 'fixed', x: 0, y: 0 }, { type: 'roller', x: 6, y: -2, ang: 90 }] } }), SI);
  truthy('fixed + roller: indeterminate', !r.ok && /indeterminate/.test(r.err[0]));
  const st = mk({ mode: 'rigid', fu: 'lb' }); Equil.convertState(st, 'US', 'SI'); Equil.convertState(st, 'SI', 'US');
  close('unit round trip', out(Equil.solve(st, US), 'N_B'), 536.2);
});

group('trusses module', () => {
  const D = Truss.defaults, mk = (o) => Object.assign(D(), o), SI = U.SI;
  const J = (s) => s.split(' ').map((t) => { const [name, x, y] = t.split(','); return { name, x: +x, y: +y }; });
  const Mb = (s) => s.split(' ').map((m) => ({ a: m[0], b: m[1] }));
  const ld = (j, Fx, Fy) => ({ j, by: 'comp', Fx, Fy });
  // Example 6.5 (default custom truss, in kN)
  let r = Truss.solve(mk({ mode: 'custom' }), SI);
  truthy('6.5 solves', r.ok);
  [['A_x', -0.4], ['A_y', 0.3], ['N_D', 0.9], ['F_AB', 0.8], ['F_BC', 0.8], ['F_CD', 1.2], ['F_AG', 0.5], ['F_GC', 0.5], ['F_GE', 0.8], ['F_EC', 0.9], ['F_ED', 1.5]].forEach(([k, v]) => close('6.5 ' + k, out(r, k), v));
  close('6.5 GB zero', out(r, 'F_GB'), 0);
  truthy('6.5 compression marked', /\(C\)/.test(r.out.find((o) => o.k === 'F_GE').u));
  truthy('6.5 section takes moments about G', r.steps.some((s) => /Section: Moments about joint G/.test(s.t) && /F_BC = 0.8 kN \(T\)/.test(s.r)));
  truthy('6.5 section sums forces in y for GC', r.steps.some((s) => /perpendicular to BC and GE/.test(s.t)));
  truthy('6.5 reactions come first', /Support reactions/.test(r.steps[1].t));
  // Example 6.1 triangle, closed form, and joint B first with one equation per unknown
  const tri = { mode: 'custom', fu: 'N', cutOn: false, custom: { joints: J('A,0,0 B,0,2 C,2,0'), members: Mb('BA BC CA'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'C', type: 'roller', ang: 90 }], loads: [ld('B', 500, 0)] } };
  r = Truss.solve(mk(tri), SI);
  close('6.1 F_BC', out(r, 'F_BC'), 707.1); close('6.1 F_BA', out(r, 'F_BA'), 500); close('6.1 F_CA', out(r, 'F_CA'), 500);
  // joint displacement against virtual work: δ_Bx = Σ F² L / (500 AE), AE = 200 GPa × 1000 mm²
  r = Truss.solve(mk(Object.assign({}, tri, { ae: { use: true, E: 200, A: 1000 } })), SI);
  const vw = ((500 * Math.SQRT2) ** 2 * 2 * Math.SQRT2 + 500 ** 2 * 2 + 500 ** 2 * 2) / 500 / 2e8 * 1000;
  close('6.1 δ_Bx by virtual work (mm)', r.geo.disp[1][0], vw);
  close('6.1 support A does not move', Math.abs(r.geo.disp[0][0]) + 1, 1);
  // Fink truss of Example 6.4: GC, DF and then FC are zero by inspection; BH = 2 kN (C)
  const fink = { mode: 'custom', fu: 'kN', cutOn: false, custom: { joints: J('A,0,0 B,3,1.5 C,6,3 D,9,1.5 E,12,0 H,3.75,0 G,6,0 F,8.25,0'), members: Mb('AB BC CD DE AH HG GF FE BH HC CG CF FD'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'E', type: 'roller', ang: 90 }], loads: [ld('B', 2 / Math.sqrt(5), -4 / Math.sqrt(5)), ld('C', 0, -5)] } };
  r = Truss.solve(mk(fink), SI);
  const zs = r.steps.find((s) => /Zero-force/.test(s.t));
  truthy('6.4 zero-force rule table', zs && zs.table.rows.map((x) => x[1]).sort().join(' ') === 'F_CF = 0 F_CG = 0 F_FD = 0');
  close('6.4 BH', out(r, 'F_BH'), 2); close('6.4 count', out(r, 'Zero-force members'), 3);
  // determinacy and stability
  truthy('unstable fails (m + r < 2j)', !Truss.solve(mk({ mode: 'custom', custom: { joints: J('A,0,0 B,4,0 C,4,3 D,0,3'), members: Mb('AB BC CD DA'), supports: [{ j: 'A', type: 'pin' }, { j: 'B', type: 'roller', ang: 90 }], loads: [ld('C', 5, 0)] } }), SI).ok);
  const ind = Truss.solve(mk({ mode: 'custom', custom: { joints: J('A,0,0 B,4,0 C,4,3 D,0,3'), members: Mb('AB BC CD DA AC BD'), supports: [{ j: 'A', type: 'pin' }, { j: 'B', type: 'roller', ang: 90 }], loads: [ld('C', 5, 0)] } }), SI);
  truthy('indeterminate fails (m + r > 2j)', !ind.ok && /indeterminate/.test(ind.err[0]));
  const geo = Truss.solve(mk({ mode: 'custom', custom: { joints: J('A,0,0 B,4,0 C,8,0 D,4,3'), members: Mb('AB BC AD DC BD'), supports: [{ j: 'A', type: 'roller', ang: 90 }, { j: 'C', type: 'roller', ang: 90 }, { j: 'B', type: 'roller', ang: 90 }], loads: [ld('D', 0, -5)] } }), SI);
  truthy('parallel reactions fail although m + r = 2j', !geo.ok && /Unstable/.test(geo.err[0]));
  // every template is simple (m + r = 2j) and stable
  Truss.TEMPLATES.forEach(([t]) => [2, 3, 4, 6, 9].forEach((n) => { if (t === 'roof' && n % 2) return; const q = Truss.solve(mk({ tpl: t, n }), SI); truthy(`template ${t} n=${n}`, q.ok); }));
  // Pratt 4 panels: top chord FG = M_center / h, bottom chord BC by moments about F
  r = Truss.solve(mk({ tpl: 'pratt', n: 4, a: 3, h: 4, P: 10, cutF: 0.375 }), SI);
  close('Pratt FG', out(r, 'F_FG'), 15); close('Pratt BC', out(r, 'F_BC'), 11.25); close('Pratt A_y', out(r, 'A_y'), 15);
  // units: SI to US and back keeps the state
  const st = mk({ mode: 'custom', ae: { use: true, E: 200, A: 1500 } }), st0 = JSON.stringify(st);
  Truss.convertState(st, 'SI', 'US'); Truss.convertState(st, 'US', 'SI');
  const a = JSON.parse(st0), b2 = st;
  close('unit round trip E', b2.ae.E, a.ae.E, 1e-6); close('unit round trip x', b2.custom.joints[3].x, a.custom.joints[3].x, 1e-6); close('unit round trip load', b2.custom.loads[0].Fy, a.custom.loads[0].Fy, 1e-6);
});
group('friction module', () => {
  const mk = (o) => Core.deepMerge(Friction.defaults(), o), SI = U.SI, US = U.US;
  // Example 8.1: crate 20 kg, P = 80 N at 30° downward, 0.2 m above the floor
  let r = Friction.solve(mk({}), SI);
  close('8.1 F', out(r, 'Friction needed F'), 69.28); close('8.1 N', out(r, 'Normal force N'), 236.2); close('8.1 x', out(r, 'Position of N, x'), -0.00908, 3e-3);
  truthy('8.1 does not slip', /no slipping or tipping/.test(r.status.text));
  // Example 8.2: angle of repose; x = 2.5 tan 25° = 1.17 ft on the downhill side, no tipping
  r = Friction.solve(mk({ bk: { wBy: 'force', W: 500, b: 3, H: 5, phi: 25, mu: Math.tan(25 * Math.PI / 180) + 1e-9, P: 0, psi: 0, hP: 0 } }), US);
  close('8.2 x', out(r, 'Position of N, x'), -1.166); truthy('8.2 slip just impends', /no slipping/.test(r.status.text));
  truthy('8.2 slips with smaller μ', /slips/.test(Friction.solve(mk({ bk: { wBy: 'force', W: 500, b: 3, H: 5, phi: 25, mu: 0.45, P: 0, psi: 0, hP: 0 } }), US).status.text));
  // closed form: 500 N block, 0.6 m base, horizontal push at 0.8 m, μ 0.4: tips at 187.5 N (slip needs 200 N)
  r = Friction.solve(mk({ bk: { wBy: 'force', W: 500, b: 0.6, H: 1, mu: 0.4, task: 'findP', psi: 0, hP: 0.8 } }), SI);
  close('tip P', out(r, 'P to tip'), 187.5); close('slip P', out(r, 'P to slip'), 200); truthy('tipping governs', /Tips first/.test(r.status.text));
  // an inclined push: the tipping force put back into the check gives N at the corner
  const q = { wBy: 'force', W: 500, b: 0.6, H: 1, mu: 0.9, psi: 20, hP: 0.8, phi: 10 };
  const Pt = out(Friction.solve(mk({ bk: Object.assign({ task: 'findP' }, q) }), SI), 'P to tip');
  close('tip force consistent', out(Friction.solve(mk({ bk: Object.assign({ task: 'check', P: Pt }, q) }), SI), 'Position of N, x'), 0.3);
  truthy('lift-off fails', !Friction.solve(mk({ bk: { task: 'check', P: 600, psi: 60 } }), SI).ok);
  // block on an incline: released (μk while sliding), held, pushed up (Dynamics F13-1 and F14-10)
  r = Friction.solve(mk({ mode: 'incline' }), SI);
  close('incline a', out(r, 'Acceleration down the slope a'), 9.81 * (0.5 - 0.25 * Math.cos(Math.PI / 6))); truthy('incline slides', /Slides down/.test(r.status.text));
  truthy('incline stays below repose', /Stays at rest/.test(Friction.solve(mk({ mode: 'incline', ic: { phi: 15 } }), SI).status.text));
  close('F13-1 T', out(Friction.solve(mk({ mode: 'incline', ic: { task: 'up', muk: 0.3, acc: 4 / 3 } }), SI), 'P to keep it moving up'), 175.74);
  close('F14-10 F', out(Friction.solve(mk({ mode: 'incline', ic: { task: 'up', muk: 0.2, acc: 0 } }), SI), 'P to keep it moving up'), 132.08);
  r = Friction.solve(mk({ mode: 'incline', ic: { task: 'hold', psi: 20 } }), SI);
  { const P = out(r, 'P to hold the block'), N = out(r, 'Normal force N'); close('hold: ΣF along the slope', P * Math.cos(20 * Math.PI / 180) - 196.2 * 0.5 + 0.3 * N, 0, 1e-6); }
  close('hold not needed', out(Friction.solve(mk({ mode: 'incline', ic: { task: 'hold', phi: 10 } }), SI), 'P to hold the block'), 0);
  { const a = Friction.solve(mk({ mode: 'incline', ic: { task: 'up', acc: 2 } }), SI), st = Friction.convertState(mk({ mode: 'incline', ic: { task: 'up', acc: 2 } }), 'SI', 'US');
    close('incline units round trip', out(Friction.solve(Friction.convertState(st, 'US', 'SI'), SI), 'P to keep it moving up'), out(a, 'P to keep it moving up'), 1e-6); }
  // Example 8.3 ladder
  r = Friction.solve(mk({ mode: 'ladder' }), SI);
  close('8.3 θ', out(r, 'Smallest angle θ (from the floor)'), 59.04); close('8.3 N_A', out(r, 'N_A'), 98.1); close('8.3 N_B', out(r, 'N_B'), 29.43);
  // at the smallest angle the friction needed equals μ_A
  close('ladder check at θ_min', out(Friction.solve(mk({ mode: 'ladder', ld: { task: 'check', th: 59.036243 } }), SI), 'Friction coefficient needed at A'), 0.3, 1e-4);
  // Example 8.6 wedge
  r = Friction.solve(mk({ mode: 'wedge' }), SI);
  close('8.6 P', out(r, 'Pull to remove, P'), 1154.9); close('8.6 N_B', out(r, 'N_B'), 2383.1); close('8.6 N_C', out(r, 'N_C'), 2452.5);
  truthy('8.6 self-locking', /Self-locking/.test(r.status.text));
  truthy('frictionless wedge not self-locking', /Not self-locking/.test(Friction.solve(mk({ mode: 'wedge', wd: { mu: 0, muC: 0 } }), SI).status.text));
  // Example 8.7 turnbuckle
  r = Friction.solve(mk({ mode: 'screw' }), SI);
  close('8.7 M', out(r, 'Moment to raise M'), 6.375); close('8.7 θ', out(r, 'Lead angle θ'), 3.643); close('8.7 φs', out(r, 'Friction angle φs'), 14.04);
  // Example 8.8 belt
  r = Friction.solve(mk({ mode: 'belt' }), SI);
  close('8.8 T1', out(r, 'Tension after drum 1'), 277.4); close('8.8 W', out(r, 'Tension after drum 2'), 153.9); close('8.8 m', out(r, 'Mass that can be held'), 15.69);
  close('one full turn e^(2πμ)', out(Friction.solve(mk({ mode: 'belt', bt: { known: 'low', T: 1, drums: [{ beta: 0, turns: 1, mu: 0.3 }] } }), SI), 'Tension after drum 1'), Math.exp(0.6 * Math.PI));
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

group('simple stress and strain module', () => {
  const mk = (o) => Core.deepMerge(Stress.defaults(), o);
  // Example 8.3 steel bar
  let r = Stress.solve(mk({ mode: 'bar', fu: 'kN', bar: { shape: 'rect', b: 100, h: 50, L: 1.5, P: 80, E: 200, nu: 0.32, sY: 250 } }), U.SI);
  close('8.3 σ', out(r, 'Normal stress σ'), 16); close('8.3 δ', out(r, 'Change in length δ'), 0.12);
  close('8.3 ε_lat', out(r, 'Lateral strain ε_lat'), -25.6e-6); close('8.3 Δb', out(r, 'Change in width b'), -0.00256); close('8.3 Δh', out(r, 'Change in depth h'), -0.00128);
  // circular bar by hand: σ = P/A, δ = PL/AE
  r = Stress.solve(mk({ mode: 'bar', fu: 'kN', bar: { shape: 'circle', d: 20, L: 2, P: 31.416, E: 200, nu: 0.3, sY: 250 } }), U.SI);
  close('round bar σ = 100 MPa', out(r, 'Normal stress σ'), 100, 1e-3); close('round bar δ = 1 mm', out(r, 'Change in length δ'), 1, 1e-3);
  // Example 7.6 lamp on two rods
  r = Stress.solve(mk({ mode: 'hanger', fu: 'N', hg: { wBy: 'mass', m: 80, a1: 60, a2: 36.8699, d1: 10, d2: 8, L1: 1.2, L2: 1.5, E: 200, sY: 250 } }), U.SI);
  close('7.6 F_BA', out(r, 'Force in rod 1, F₁'), 632.4); close('7.6 F_BC', out(r, 'Force in rod 2, F₂'), 395.2);
  close('7.6 σ_BA', out(r, 'Stress in rod 1, σ₁'), 8.05); close('7.6 σ_BC', out(r, 'Stress in rod 2, σ₂'), 7.86);
  // Example 7.11 lap joint
  r = Stress.solve(mk({ mode: 'joint', fu: 'kN', jt: { task: 'allow', P: 10, d: 10, n: 1, planes: 1, t: 15, w: 50, e: 20, tb: 80, st: 50, sb: 80, tp: 30 } }), U.SI);
  close('7.11 P_allow', out(r, 'Allowable load P'), 6.283); close('7.11 bearing', out(r, 'Load for bearing on the plate'), 12);
  close('7.11 net section', out(r, 'Load for tension on the net section of the plate'), 30); close('7.11 tear-out', out(r, 'Load for shear tear-out of the plate'), 18);
  // Example 7.8 pin in double shear
  r = Stress.solve(mk({ mode: 'joint', fu: 'kN', jt: { task: 'check', P: 21.36, d: 20, n: 1, planes: 2, t: 20, w: 0, e: 0, tb: 0, st: 0, sb: 0, tp: 0 } }), U.SI);
  close('7.8 τ', out(r, 'Average shear stress in the bolts τ'), 34.0);
  // Example 7.10 pins A and C
  r = Stress.solve(mk({ mode: 'size', fu: 'kip', sz: { part: 'pin', P: 3, planes: 1, byFS: true, fail: 12, FS: 1.5, step: 0.25 } }), U.US);
  close('7.10 d_A', out(r, 'Required pin diameter d'), 0.691); close('7.10 use 3/4 in.', out(r, 'Size to use (rounded up)'), 0.75);
  r = Stress.solve(mk({ mode: 'size', fu: 'kip', sz: { part: 'pin', P: 6.083, planes: 2, byFS: true, fail: 12, FS: 1.5, step: 0.25 } }), U.US);
  close('7.10 d_C', out(r, 'Required pin diameter d'), 0.696);
  // Example 7.12 rod and disk
  r = Stress.solve(mk({ mode: 'size', fu: 'kN', sz: { part: 'rod', P: 20, byFS: false, allow: 60, step: 0 } }), U.SI);
  close('7.12 rod d', out(r, 'Required rod diameter d'), 20.6);
  r = Stress.solve(mk({ mode: 'size', fu: 'kN', sz: { part: 'punch', P: 20, byFS: false, allow: 35, dh: 40, step: 0 } }), U.SI);
  close('7.12 disk t', out(r, 'Required plate thickness t'), 4.547);
  // Example 8.2 unloading
  r = Stress.solve(mk({ mode: 'curve', cv: { pts: [{ e: 0, s: 0 }, { e: 0.006, s: 450 }, { e: 0.012, s: 540 }, { e: 0.023, s: 600 }, { e: 0.03, s: 620 }, { e: 0.04, s: 600 }], nLin: 1, unload: true, sU: 600 } }), U.SI);
  close('8.2 E', out(r, 'Modulus of elasticity E'), 75); close('8.2 u_r', out(r, 'Modulus of resilience u_r'), 1.35);
  close('8.2 set', out(r, 'Permanent set'), 0.015); close('8.2 u_r after', out(r, 'Modulus of resilience after reloading'), 2.4);
  // shear pad by hand: τ = 2 kN / (150 × 100 mm²) = 0.1333 MPa, γ = τ/G
  r = Stress.solve(mk({ mode: 'pad', fu: 'kN', pad: { given: 'force', a: 150, b: 100, h: 20, V: 2, G: 0.2, useEnu: false } }), U.SI);
  truthy('pad solves', r.ok && r.steps.length >= 3);
  // unit toggle keeps the physics
  const st = mk({ mode: 'bar', fu: 'kN', bar: { shape: 'rect', b: 100, h: 50, L: 1.5, P: 80, E: 200, nu: 0.32, sY: 250 } });
  Stress.convertState(st, 'SI', 'US', 'kN'); r = Stress.solve(st, U.US);
  close('converted σ in ksi', out(r, 'Normal stress σ'), 16 / 6.894757, 2e-3);
  truthy('material table A-36 E = 29000 ksi', MD.material('a36', 'US').E === 29000);
  truthy('plate narrower than holes fails', !Stress.solve(mk({ mode: 'joint', fu: 'kN', jt: { task: 'allow', d: 20, n: 3, planes: 1, t: 10, w: 50, e: 20, tb: 80, st: 50, sb: 80, tp: 30 } }), U.SI).ok);
});

group('axial load module', () => {
  const sg = (L, d, P, o) => Object.assign({ L, shape: 'circle', d, di: 0, E: 200, al: 12, P }, o || {});
  const rod = (x, L, A, o) => Object.assign({ x, L, shape: 'area', A, E: 200, al: 12 }, o || {});
  // Example 9.1 stepped bar
  let r = Axial.solve({ mode: 'bar', fu: 'kN', ax: { right: 'free', dT: 0, segs: [sg(2, 50, 800), sg(1, 50, 400), sg(1.5, 50, -700)] } }, U.SI);
  close('9.1 δ_D', out(r, 'Displacement of the end D, δ_D'), -0.891); close('9.1 δ_B/C', out(r, 'Change in length of BC'), -0.764);
  close('9.1 N_AB', out(r, 'Internal force N_AB'), 500); close('9.1 N_CD', out(r, 'Internal force N_CD'), -700);
  // Example 9.5 gap that closes
  r = Axial.solve({ mode: 'bar', fu: 'kN', ax: { right: 'gap', gap: 0.2, dT: 0, segs: [sg(0.4, 10, 20), sg(0.8, 10, 0)] } }, U.SI);
  close('9.5 F_A', out(r, 'Reaction at A, F_A'), 15.95); close('9.5 F_B', out(r, 'Reaction at C, F_C'), 4.049);
  // a gap that stays open: determinate, F at the far wall is zero
  r = Axial.solve({ mode: 'bar', fu: 'kN', ax: { right: 'gap', gap: 2, dT: 0, segs: [sg(0.4, 10, 20), sg(0.8, 10, 0)] } }, U.SI);
  close('open gap F_A = P', out(r, 'Reaction at A, F_A'), 20); close('open gap F_C = 0', out(r, 'Reaction at C, F_C'), 0);
  // Section 9.4 bar fixed at both ends
  r = Axial.solve({ mode: 'bar', fu: 'N', ax: { right: 'fixed', dT: 0, segs: [sg(2, 20, 500), sg(3, 20, 0)] } }, U.SI);
  close('9.4 F_A', out(r, 'Reaction at A, F_A'), 300); close('9.4 F_B', out(r, 'Reaction at C, F_C'), 200);
  // Example 9.10 thermal stress
  r = Axial.solve({ mode: 'bar', fu: 'kip', ax: { right: 'fixed', dT: 60, segs: [sg(2, 0, 0, { shape: 'rect', b: 0.5, h: 0.5, E: 29000, al: 6.6 })] } }, U.US);
  close('9.10 F', out(r, 'Reaction at B, F_B'), 2.871); close('9.10 σ', out(r, 'Stress σ_AB'), -11.48);
  // Example 9.7 rigid bar on three rods
  r = Axial.solve({ mode: 'rigid', fu: 'kN', rig: { side: 'hang', pin: false, len: 0.8, dT: 0, w: 0, rods: [rod(0, 0.5, 50), rod(0.4, 0.5, 30), rod(0.8, 0.5, 50)], loads: [{ x: 0.2, P: 15 }] } }, U.SI);
  close('9.7 F_A', out(r, 'Force in rod 1, F1'), 9.519); close('9.7 F_C', out(r, 'Force in rod 2, F2'), 3.462); close('9.7 F_E', out(r, 'Force in rod 3, F3'), 2.019);
  // Example 9.3 rigid beam on two posts
  r = Axial.solve({ mode: 'rigid', fu: 'kN', rig: { side: 'post', pin: false, len: 0.6, dT: 0, w: 0, rods: [rod(0, 0.3, 0, { shape: 'circle', d: 20 }), rod(0.6, 0.3, 0, { shape: 'circle', d: 40, E: 70 })], loads: [{ x: 0.2, P: 90 }] } }, U.SI);
  close('9.3 F_AC', out(r, 'Force in post 1, F1'), 60); close('9.3 δ_F', out(r, 'Load 1 point moves down'), 0.225);
  // Example 9.11 posts heated under a uniform load
  r = Axial.solve({ mode: 'rigid', fu: 'kN', rig: { side: 'post', pin: false, len: 0.6, dT: 60, w: 150, rods: [rod(0, 0.25, 0, { shape: 'circle', d: 40 }), rod(0.3, 0.25, 0, { shape: 'circle', d: 60, E: 73.1, al: 23 }), rod(0.6, 0.25, 0, { shape: 'circle', d: 40 })], loads: [] } }, U.SI);
  close('9.11 F_st', out(r, 'Force in post 1, F1'), -16.4); close('9.11 F_al', out(r, 'Force in post 2, F2'), 123);
  // pinned bar by hand: rods at 3 and 9 ft, 8 kip at 6 ft; equal rods give F1 = 48/90 × 8 × ... check equilibrium only
  r = Axial.solve({ mode: 'rigid', fu: 'kip', rig: { side: 'hang', pin: true, xp: 0, len: 9, dT: 0, w: 0, rods: [rod(3, 4, 0.2, { E: 29000 }), rod(9, 6, 0.2, { E: 29000 })], loads: [{ x: 6, P: 8 }] } }, U.US);
  close('pinned bar moment balance', 3 * out(r, 'Force in rod 1, F1') + 9 * out(r, 'Force in rod 2, F2'), 48);
  // Examples 9.6 and 9.12 members under a rigid cap
  r = Axial.solve({ mode: 'parallel', fu: 'kip', par: { P: 9, L: 1.5, dT: 0, layout: 'nested', mem: [{ n: 1, shape: 'tube', d: 4, di: 2, E: 10000 }, { n: 1, shape: 'circle', d: 2, E: 15000 }] } }, U.US);
  close('9.6 σ_al', out(r, 'Stress in member 1, σ1'), -0.637); close('9.6 σ_br', out(r, 'Stress in member 2, σ2'), -0.955);
  r = Axial.solve({ mode: 'parallel', fu: 'kN', par: { P: 0, L: 0.15, dT: 65, layout: 'nested', mem: [{ n: 1, shape: 'area', A: 600, E: 73.1, al: 23 }, { n: 1, shape: 'area', A: 400, E: 200, al: 12 }] } }, U.SI);
  close('9.12 F_sleeve', out(r, 'Force in member 1, F1'), 20.3); close('9.12 F_bolt', out(r, 'Force in member 2, F2'), -20.3);
  // Example 9.13 stress concentration
  r = Axial.solve({ mode: 'conc', fu: 'kN', cn: { geo: 'fillet', w: 40, h: 32, r: 4, t: 2, K: 1.75, task: 'allow', sA: 250 } }, U.SI);
  close('9.13 N', out(r, 'Largest axial force N'), 9.14);
  r = Axial.solve({ mode: 'conc', fu: 'kN', cn: { geo: 'hole', w: 40, d: 10, t: 5, K: 2.2, task: 'max', N: 30 } }, U.SI);
  close('hole σ_max = K N/A', out(r, 'Maximum normal stress σ_max'), 2.2 * 30000 / 150);
  // unit toggle keeps the physics
  const st = { mode: 'bar', fu: 'kN', ax: { right: 'free', dT: 0, gap: 0.2, segs: [sg(2, 50, 800), sg(1, 50, 400), sg(1.5, 50, -700)] } };
  Axial.convertState(st, 'SI', 'US'); r = Axial.solve(st, U.US);
  close('converted δ_D in in.', out(r, 'Displacement of the end D, δ_D'), -0.8913 / 25.4, 2e-3);
  truthy('single post fails', !Axial.solve({ mode: 'rigid', fu: 'kN', rig: { side: 'post', len: 1, rods: [rod(0.5, 0.3, 100)], loads: [{ x: 0.2, P: 10 }] } }, U.SI).ok);
});

groups.forEach(([name, fn]) => { if (filter && !name.toLowerCase().includes(filter)) return; console.log(name); fn(); });
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
