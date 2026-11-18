/* Physics checks against textbook answers (Hibbeler). Run: node tests/run.js [filter]
 * Textbook answers are rounded to 3 significant figures, so the tolerance is 0.5 %. */
'use strict';
const path = require('path');
const R = (p) => require(path.join(__dirname, '..', p));
const Core = R('shared/core.js'), Beam = R('shared/beam.js'), Internal = R('st/internal.js');
const Forces = R('st/forces.js'), Equil = R('st/equil.js'), Truss = R('st/truss.js'), Friction = R('st/friction.js');
const Section = R('shared/section.js'), Mohr = R('shared/mohr.js'), SecMod = R('st/section.js');
const MD = R('md/mdcore.js'), Stress = R('md/stress.js'), Axial = R('md/axial.js'), Torsion = R('md/torsion.js'), BeamStress = R('md/beamstress.js'), Deflect = R('md/deflect.js'), Transform = R('md/transform.js'), Combined = R('md/combined.js'), Buckle = R('md/buckle.js');
const VWork = R('st/vwork.js');
const Rect = R('dy/rect.js'), Curv = R('dy/curv.js'), Pkin = R('dy/pkin.js'), Impact = R('dy/impact.js'), RbMotion = R('dy/rbmotion.js'), RbForce = R('dy/rbforce.js'), Vib = R('dy/vib.js'), Rb3d = R('dy/rb3d.js');
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
  { // one unknown force from the required resultant: Problems 2-26, 2-31, 2-57, 2-58
    const U1 = (co) => Forces.solve(mk({ mode: 'coplanar', fu: 'N', co: Object.assign({ find: 'unk', FR: 0, phi: 0 }, co) }), SI);
    let q = U1({ uk: 1, unk: 'both', req: 'both', FR: 1250, forces: [P(0, 0), P(800, -30)] });
    close('2-26 F_A', out(q, 'F1 magnitude'), 686, 1e-3); close('2-26 θ from y', 90 - out(q, 'F1 angle θ (↺ from +x)'), 54.3, 1e-3);
    q = U1({ uk: 2, unk: 'both', req: 'dir', forces: [P(2, 30), P(1, 0)] });
    close('2-31 F_B min', out(q, 'F2 magnitude (smallest force)'), 1); close('2-31 F_R', out(q, 'Resultant magnitude F_R'), 1.7321, 1e-4);
    q = U1({ uk: 1, unk: 'mag', req: 'min', forces: [P(1, 60), P(200, 0), { by: 'slope', F: 260, dx: 5, dy: -12 }] });
    close('2-57 F1', out(q, 'F1 magnitude'), 57.846, 1e-4); close('2-57 F_R', out(q, 'Resultant magnitude F_R'), 380, 1e-3);
    q = U1({ uk: 1, unk: 'both', req: 'both', FR: 8, phi: 30, forces: [P(1, 0), P(4, 105), P(6, 0)] });
    close('2-58 F', out(q, 'F1 magnitude'), 1.968, 1e-3); close('2-58 θ from y', 90 - out(q, 'F1 angle θ (↺ from +x)'), 86.03, 1e-3);
    q = U1({ uk: 2, unk: 'ang', req: 'mag', FR: 3, forces: [P(2, 30), P(1.5, 0)] });
    close('unknown angle: resultant magnitude met', out(q, 'Resultant magnitude F_R'), 3);
    q = U1({ uk: 2, unk: 'mag', req: 'dir', phi: 0, forces: [P(2, 30), P(1, 270)] });
    close('unknown magnitude: resultant along +x', out(q, 'Resultant (F_R)_y'), 0); close('unknown magnitude value', out(q, 'F2 magnitude'), 1);
    truthy('unknown angle: force too small fails', !U1({ uk: 2, unk: 'ang', req: 'dir', phi: 0, forces: [P(2, 30), P(0.5, 0)] }).ok);
  }
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

group('equilibrium: 3D rigid bodies and largest load', () => {
  const mk = (o) => Core.deepMerge(Equil.defaults(), o);
  let r = Equil.solve(mk({ mode: 'rigid3d', fu: 'lb' }), U.US);
  close('5-73 T_BD', out(r, 'T_BD'), 70.16, 2e-3); close('5-73 A_x', out(r, 'A_x'), 37.5); close('5-73 A_z', out(r, 'A_z'), 37.5); close('5-73 A_y', out(r, 'A_y'), 0);
  r = Equil.solve(mk({ mode: 'rigid3d', fu: 'lb', r3: { supports: [{ type: 'thrust', name: 'A', x: 0, y: 0, z: 0 }, { type: 'journal', name: 'B', x: 0, y: 0, z: 48, ax: 'z' }], loads: [{ kind: 'force', Fx: 0, Fy: 0, Fz: -100, x: 0, y: 18, z: 24 }] } }), U.US);
  close('5-70 B_y', out(r, 'B_y'), -37.5); close('5-70 A_z', out(r, 'A_z'), 100);
  truthy('7 unknowns is indeterminate', !Equil.solve(mk({ mode: 'rigid3d', r3: { supports: [{ type: 'fixed', name: 'A', x: 0, y: 0, z: 0 }, { type: 'cable', name: 'B', x: 1, y: 0, z: 0, bx: 1, by: 0, bz: 2 }] } }), U.SI).ok);
  r = Equil.solve(mk({ mode: 'rigid', fu: 'kN', rb: { outline: [], supports: [{ type: 'roller', name: 'A', x: -6.598076, y: 1.5, ang: 60 }, { type: 'pin', name: 'B', x: 0, y: 0 }], loads: [], couples: [], dists: [{ x1: -4, x2: 0, y: 0, w1: 3, w2: 3 }] }, cap: { on: true, T: 0, sup: [4, 8] } }), U.SI);
  close('5-22 N_A', out(r, 'N_A'), 3.713); close('5-23 w_max', 3 * out(r, 'Load factor λ (largest load = λ × loads entered)'), 2.673, 2e-3);
  { const st = Equil.convertState(mk({ mode: 'rigid3d', fu: 'lb' }), 'US', 'SI'); close('rigid3d units round trip', out(Equil.solve(Equil.convertState(st, 'SI', 'US'), U.US), 'T_BD'), 70.156, 1e-3); }
});
group('equilibrium: frames and machines', () => {
  const mk = (o) => Core.deepMerge(Equil.defaults(), o), FP = (s2) => s2.split(' ').map((t) => { const [name, x, y] = t.split(','); return { name, x: +x, y: +y }; });
  const L = (at, Fx, Fy, mem) => ({ mem: mem || '', at, by: 'comp', Fx, Fy });
  let r = Equil.solve(mk({ mode: 'frame', fu: 'kN' }), U.SI);
  close('6-66 A_x', out(r, 'A_x'), 24); close('6-66 A_y', out(r, 'A_y'), -12); close('6-66 D_x', out(r, 'D_x'), -18); close('6-66 D_y', out(r, 'D_y'), 24); close('6-66 F_BD', out(r, 'Pin B: resultant'), 30);
  const beam = (o) => mk({ mode: 'frame', fu: 'kN', fm: Object.assign({ loads: [], couples: [], dists: [], sel: '' }, o) });
  r = Equil.solve(beam({ points: FP('A,0,0 B,6,0 D,9,0 C,12,0'), members: [{ name: 'ABD', pts: 'A B D' }, { name: 'DC', pts: 'D C' }], supports: [{ at: 'A', type: 'roller', ang: 90 }, { at: 'B', type: 'pin', ang: 90 }, { at: 'C', type: 'roller', ang: 90 }], dists: [{ mem: 'ABD', from: 'A', to: 'D', w1: 2, w2: 2 }, { mem: 'DC', from: 'D', to: 'C', w1: 2, w2: 2 }] }), U.SI);
  close('6-78 N_A', out(r, 'N_A'), 3); close('6-78 B_y', out(r, 'B_y'), 18); close('6-78 N_C', out(r, 'N_C'), 3);
  r = Equil.solve(mk({ mode: 'frame', fu: 'lb', fm: { points: FP('P,-5,0 A,0,0 B,10,0 C,15,0 Q,19,0 D,25,0 E,30,0'), members: [{ name: 'ABC', pts: 'P A B C' }, { name: 'CD', pts: 'C Q D' }, { name: 'DE', pts: 'D E' }], supports: [{ at: 'A', type: 'roller', ang: 90 }, { at: 'B', type: 'roller', ang: 90 }, { at: 'E', type: 'fixed', ang: 90 }], loads: [L('P', 0, -800), L('B', 0, -1200), L('Q', 0, -600, 'CD')], couples: [], dists: [], sel: '' } }), U.US);
  close('6-82 B_y', out(r, 'N_B'), 1340); close('6-82 A_y', out(r, 'N_A'), 1020); close('6-82 E_y', out(r, 'E_y'), 240); close('6-82 M_E', out(r, 'M_E'), -1200);
  truthy('two-force member found', r.ok && Equil.solve(mk({ mode: 'frame', fu: 'kN' }), U.SI).steps.some((s2) => /two-force member/.test(s2.t)));
  truthy('frame: too many supports is indeterminate', !Equil.solve(beam({ points: FP('A,0,0 B,6,0 D,9,0 C,12,0'), members: [{ name: 'ABD', pts: 'A B D' }, { name: 'DC', pts: 'D C' }], supports: [{ at: 'A', type: 'pin' }, { at: 'B', type: 'pin' }, { at: 'C', type: 'roller', ang: 90 }] }), U.SI).ok);
  truthy('frame: a mechanism fails', !Equil.solve(beam({ points: FP('A,0,0 B,6,0 D,9,0 C,12,0'), members: [{ name: 'ABD', pts: 'A B D' }, { name: 'DC', pts: 'D C' }], supports: [{ at: 'A', type: 'pin' }, { at: 'B', type: 'roller', ang: 90 }] }), U.SI).ok);
  { const st = Equil.convertState(mk({ mode: 'frame', fu: 'kN' }), 'SI', 'US'); close('frame units round trip', out(Equil.solve(Equil.convertState(st, 'US', 'SI'), U.SI), 'A_x'), 24, 1e-6); }
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
  // Problem 6-14: AB, BC carry 800 lb (C), the others 1500 lb (T): P_max = 849 lb
  r = Truss.solve(mk({ mode: 'custom', fu: 'lb', cutOn: false, cap: { on: true, T: 1500, C: 800 }, custom: { joints: J('A,0,0 B,10,10 C,20,0 D,10,2.5'), members: Mb('AB BC AD DC BD'), supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'C', type: 'roller', ang: 90 }], loads: [ld('D', 0, -1)] } }), U.US);
  close('6-14 P_max', out(r, 'Largest load (λ × the largest load entered)'), 848.53, 1e-3);
  // space trusses: Problems 6-53 and 6-54
  const sp = (f) => mk({ mode: 'space', fu: 'lb', space: { joints: [{ name: 'C', x: 0, y: 0, z: 8 }, { name: 'A', x: 6, y: 0, z: 0 }, { name: 'B', x: 0, y: 6, z: 0 }, { name: 'D', x: 0, y: -6, z: 0 }], members: Mb('CA CB CD AB AD DB'), supports: [{ j: 'A', fix: 'z' }, { j: 'D', fix: 'xz' }, { j: 'B', fix: 'xyz' }], loads: [{ j: 'C', Fx: f[0], Fy: f[1], Fz: f[2] }] } });
  r = Truss.solve(sp([-500, 600, 400]), U.US);
  [['F_CA', 833.33], ['F_CB', 666.67], ['F_CD', 333.33], ['F_AB', 353.55], ['F_AD', 353.55], ['F_DB', 50]].forEach(([k, v]) => close('6-53 ' + k, out(r, k), v, 1e-3));
  truthy('6-53 CB in compression', /\(C\)/.test(r.out.find((o) => o.k === 'F_CB').u));
  r = Truss.solve(sp([600, 450, -750]), U.US);
  [['F_CA', 1000], ['F_CB', 343.75], ['F_CD', 406.25], ['F_AB', 424.26], ['F_DB', 543.75]].forEach(([k, v]) => close('6-54 ' + k, out(r, k), v, 1e-3));
  truthy('space truss default solves', Truss.solve(mk({ mode: 'space' }), SI).ok);
  const bad = sp([0, 0, -1]); bad.space.supports = [{ j: 'B', fix: 'xyz' }, { j: 'A', fix: 'z' }];
  truthy('space truss: m + r < 3j fails', !Truss.solve(bad, U.US).ok);
  { const s2 = mk({ mode: 'space' }), F0 = out(Truss.solve(s2, SI), 'F_CA'); Truss.convertState(s2, 'SI', 'US'); Truss.convertState(s2, 'US', 'SI'); close('space units round trip', out(Truss.solve(s2, SI), 'F_CA'), F0, 1e-6); }
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
  // Vehicle on two axles (Probs. 8-3, 8-5, 8-6, 8-14 and a car parked on an incline)
  const V = (o) => mk({ mode: 'vehicle', vh: o });
  r = Friction.solve(V({}), SI);
  close('car on 12° incline N_A', out(r, 'Normal force at A, N_A'), 8847.8); close('car on 12° incline N_B', out(r, 'Normal force at B, N_B'), 5545.7); close('car on 12° incline F_A', out(r, 'Friction at A, F_A'), -3059.4);
  r = Friction.solve(mk({ mode: 'vehicle', fu: 'kN', vh: { m: 6000, a: 0.9, b: 0.6, h: 0.15, phi: 0, axA: 'locked', axB: 'locked', mu: 0.4, hasP: true, P: 10, xP: 0, yP: 1.05, psi: 0 } }), SI);
  close('8-3 N_A', out(r, 'Normal force at A, N_A'), 16.544); close('8-3 N_B', out(r, 'Normal force at B, N_B'), 42.316); truthy('8-3 does not move', /no slipping/.test(r.status.text));
  const tow = { task: 'force', m: 2000, a: 1, b: 1.5, h: 0.6, phi: 0, axA: 'free', axB: 'locked', mu: 0.3, xP: -0.75, yP: 0.3, psi: 150, move: 'A' };
  r = Friction.solve(V(tow), SI); close('8-5 F', out(r, 'Force P'), 2762.7); close('8-5 N_B', out(r, 'Normal force at B, N_B'), 7975.3);
  close('8-6 F', out(Friction.solve(V(Object.assign({}, tow, { axA: 'locked' })), SI), 'Force P'), 5793.2);
  r = Friction.solve(V({ task: 'slope', a: 2.5, b: 2.5, h: 2.5, axA: 'locked', axB: 'locked', mu: 0.4 }), SI);
  close('8-14 φ', out(r, 'Steepest slope φ_max'), 21.801); close('8-14 tip', out(r, 'Slope at which it tips'), 45);
  // one braked axle: tan φ = μ b_other / (L + μ h) style check against the parked result at that slope
  { const q = { task: 'slope', a: 1.5, b: 3, h: 1.1, axA: 'locked', axB: 'free', mu: 0.6 }, ph = out(Friction.solve(V(q), SI), 'Steepest slope φ_max');
    close('one-axle slope gives μ needed = μs', out(Friction.solve(V(Object.assign({}, q, { task: 'park', phi: ph })), SI), 'μs needed to hold it'), 0.6, 1e-4); }
  { const st = Friction.convertState(V(tow), 'SI', 'US'); close('vehicle units round trip', out(Friction.solve(Friction.convertState(st, 'US', 'SI'), SI), 'Force P'), 2762.72, 1e-4); }
  close('one full turn e^(2πμ)', out(Friction.solve(mk({ mode: 'belt', bt: { known: 'low', T: 1, drums: [{ beta: 0, turns: 1, mu: 0.3 }] } }), SI), 'Tension after drum 1'), Math.exp(0.6 * Math.PI));
  // two bodies: Problems 8-30, 8-31, 8-33, 8-45 and a stacked pair by hand
  const TW = (o) => mk({ mode: 'two', fu: o.fu || 'lb', tw: Object.assign({ wBy: 'force' }, o) });
  r = Friction.solve(TW({ arr: 'inc', WA: 10, WB: 6, muA: 0.15, muB: 0.25, k: 2, lower: 'A', conn: 'spring', task: 'both' }), US);
  close('8-30 θ', out(r, 'Angle θ'), 10.62, 1e-3); close('8-30 x', out(r, 'Spring stretch needed'), 0.184, 2e-3);
  r = Friction.solve(TW({ arr: 'inc', WA: 10, WB: 6, muA: 0.15, muB: 0.25, k: 2, lower: 'A', conn: 'spring', task: 'first' }), US);
  close('8-31 θ', out(r, 'Angle θ'), 8.531, 1e-3); close('8-31 F_A', out(r, 'Friction under A, F_A'), 1.483, 1e-3); close('8-31 F_B', out(r, 'Friction under B, F_B'), 0.890, 1e-3);
  r = Friction.solve(TW({ arr: 'inc', WA: 10, WB: 6, muA: 0.15, muB: 0.25, lower: 'A', conn: 'cord', task: 'first' }), US);
  close('cord: lower block with smaller μ drags both', out(r, 'Angle θ'), 10.62, 1e-3);
  r = Friction.solve(TW({ arr: 'push', WA: 450, WB: 200, muA: 0.3, muB: 0.6, how: 'push', tip: true, b: 2, h: 3 }), US);
  truthy('8-33 he cannot move it', /No/.test(r.status.text)); close('8-33 needed', out(r, 'Push needed to move the crate'), 135);
  r = Friction.solve(TW({ arr: 'push', fu: 'N', wBy: 'mass', mA: 100, mB: 60, muA: 0.3, muB: 0.4, how: 'rope', thC: 30, thM: 45 }), SI);
  close('8-45 T', out(r, 'Rope tension needed to move the crate'), 289.66); truthy('8-45 he cannot move it', /No/.test(r.status.text));
  r = Friction.solve(TW({ arr: 'stack', fu: 'N', WA: 100, WB: 200, muA: 0.3, muG: 0.2, tie: true, beta: 30, Pon: 'B', al: 0 }), SI);
  close('stack T', out(r, 'Cord tension T'), 30 / (Math.cos(Math.PI / 6) + 0.15)); close('stack P', out(r, 'Force P to start motion'), 82.618, 1e-4);
  r = Friction.solve(TW({ arr: 'stack', fu: 'N', WA: 100, WB: 200, muA: 0.3, muG: 0.05, tie: false, Pon: 'A', al: 0 }), SI);
  close('stack: both slide when the floor is slick', out(r, 'Force P to start motion'), 15);
  { const st = Friction.convertState(TW({ arr: 'inc', fu: 'lb', WA: 10, WB: 6, muA: 0.15, muB: 0.25, k: 2, task: 'both' }), 'US', 'SI'); close('two-body units round trip', out(Friction.solve(Friction.convertState(st, 'SI', 'US'), US), 'Spring stretch needed'), 0.1843, 1e-3); }
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

group('torsion module', () => {
  const sg = (L, d, T, o) => Object.assign({ L, shape: 'circle', d, di: 0, G: 75, T }, o || {});
  const shaft = (tu, right, segs, Us) => Torsion.solve({ mode: 'shaft', tu, sh: { right, segs } }, Us || U.SI);
  // Example 10.5 angle of twist
  let r = shaft('kN·m', 'free', [sg(3, 200, 150), sg(2, 200, -60), sg(1.5, 200, -10)]);
  close('10.5 φ_A/D', out(r, 'Angle of twist of D relative to A'), 7.22e-3); close('10.5 φ_A/C', out(r, 'Angle of twist of C relative to A'), 8.49e-3);
  close('10.5 T_BC', out(r, 'Internal torque T_BC'), -70);
  // Example 10.6 gear on a stepped set of torques
  r = shaft('N·m', 'free', [sg(0.5, 14, -40, { G: 80 }), sg(0.3, 14, -280, { G: 80 }), sg(0.4, 14, 150, { G: 80 })]);
  close('10.6 φ_A', out(r, 'Angle of twist of D relative to A'), -0.2121);
  // Examples 10.2 and 10.3 torsion formula
  r = shaft('kip·in.', 'free', [sg(3, 1.5, 12.5, { G: 11000 })], U.US); close('10.2 τ_A', out(r, 'Maximum shear stress in AB'), 18.9);
  r = shaft('N·m', 'free', [sg(0.5, 100, 40, { shape: 'tube', di: 80 })]); close('10.3 τ_o', out(r, 'Maximum shear stress in AB'), 0.345);
  // Example 10.8 and Section 10.5: both ends fixed
  r = shaft('N·m', 'fixed', [sg(0.2, 20, -800), sg(1.5, 20, 500), sg(0.3, 20, 0)]);
  close('10.8 T_B', -out(r, 'Reaction torque at A, T_A'), 645); close('10.8 T_A', -out(r, 'Reaction torque at D, T_D'), -345);
  r = shaft('N·m', 'fixed', [sg(3, 40, 500), sg(2, 40, 0)]);
  close('10.5 T_A', out(r, 'Reaction torque at A, T_A'), 200); close('10.5 T_B', out(r, 'Reaction torque at C, T_C'), 300);
  // Example 10.4 power
  r = Torsion.solve({ mode: 'power', tu: 'lb·ft', pw: { P: 5, spd: 175, spdU: 'rpm', task: 'size', shape: 'circle', tA: 14.5, step: 0.125, L: 0, G: 0 } }, U.US);
  close('10.4 T', out(r, 'Torque T'), 150.1); close('10.4 d', out(r, 'Required diameter d'), 0.858); close('10.4 use 7/8 in.', out(r, 'Size to use (rounded up)'), 0.875);
  // a tube sized for a chosen bore meets τ_allow exactly
  r = Torsion.solve({ mode: 'power', tu: 'kN·m', pw: { P: 90, spd: 1750, spdU: 'rpm', task: 'size', shape: 'tube', di: 30, tA: 50, step: 0, L: 0, G: 0 } }, U.SI);
  close('sized tube reaches τ_allow', out(r, 'Maximum shear stress τ_max'), 50);
  // Example 10.9 tube bonded to a core
  r = Torsion.solve({ mode: 'composite', tu: 'lb·in.', cp: { T: 3000, L: 4, d: 2, di: 1, G: 11400, Gc: 5200 } }, U.US);
  close('10.9 T_st', out(r, 'Torque in the tube'), 2911.5); close('10.9 T_br', out(r, 'Torque in the core'), 88.54);
  close('10.9 τ_br', out(r, 'Largest shear stress in the core'), 0.451); close('10.9 τ_st min', out(r, 'Shear stress in the tube at the bond'), 0.989); close('10.9 τ_st max', out(r, 'Largest shear stress in the tube'), 1.977);
  // Example 10.10 triangle and the round shaft of the same area
  r = Torsion.solve({ mode: 'noncirc', tu: 'lb·in.', nc: { shape: 'triangle', a: 1.5, L: 4, G: 3700, task: 'allow', tA: 8, phiA: 0.02, cmp: true } }, U.US);
  close('10.10 by stress', out(r, 'Torque allowed by the shear stress'), 1350); close('10.10 by twist', out(r, 'Largest torque T'), 170);
  close('10.10 round shaft', out(r, 'Largest torque on a round shaft of the same area'), 233);
  // circle entry of Table 10–1 agrees with the torsion formula
  r = Torsion.solve({ mode: 'noncirc', tu: 'N·m', nc: { shape: 'circle', a: 20, L: 1, G: 75, task: 'check', T: 100 } }, U.SI);
  close('circle τ = 16T/(πd³)', out(r, 'Maximum shear stress τ_max'), (16 * 100) / (Math.PI * 0.02 ** 3) / 1e6);
  // unit toggle keeps the physics and the torque unit
  const st = Torsion.defaults(); st.tu = 'kip·in.'; st.sh.segs = [sg(3, 1.5, 12.5, { G: 11000 })];
  Torsion.convertState(st, 'US', 'SI'); Torsion.convertState(st, 'SI', 'US');
  truthy('kip·in. comes back as kip·in.', st.tu === 'kip·in.'); close('torque comes back', st.sh.segs[0].T, 12.5, 1e-4);
  truthy('bore wider than the tube fails', !shaft('kN·m', 'free', [sg(1, 50, 2, { shape: 'tube', di: 60 })]).ok);
});

group('beam stresses module', () => {
  const Rr = (x, y, b, h) => ({ kind: 'rect', x, y, b, h, rot: 0, hole: false });
  const bs = (o, sys) => BeamStress.solve(Core.deepMerge(BeamStress.defaults(), o), U[sys || 'SI']);
  const simple = (L, xa, xb, loads) => ({ src: 'beam', at: 'max', bm: { L, sup: 'simple', xa, xb, loads } });
  const D = (x1, x2, w) => ({ kind: 'dist', x1, x2, w1: w, w2: w }), Pt = (x, P) => ({ kind: 'point', x, P });
  // Example 11.11: I-beam, 5 kN/m over 6 m
  let r = bs({ mode: 'flexure', sec: { src: 'shape', shape: 'I', bf: 250, d: 340, tf: 20, tw: 20 }, ld: simple(6, 0, 6, [D(0, 6, 5)]), fl: { pt: true, y: 150 } });
  close('11.11 M', out(r, 'Moment M'), 22.5); close('11.11 I', out(r, 'Moment of inertia I'), 301.3e6); close('11.11 σ_max', out(r, 'Absolute maximum bending stress σ_max'), 12.7); close('11.11 σ_B', out(r, 'Stress at the point σ_P'), -11.2);
  // Example 11.13: bar with ribs
  r = bs({ mode: 'flexure', fu: 'N', sec: { src: 'parts', parts: [Rr(0, 5, 60, 30), Rr(0, 0, 10, 5), Rr(50, 0, 10, 5)] }, ld: { src: 'given', M: 40 }, fl: { pt: false } });
  close('11.13 I', out(r, 'Moment of inertia I'), 0.1642e6); close('11.13 σ_max', out(r, 'Absolute maximum bending stress σ_max'), 4.65);
  r = bs({ mode: 'flexure', fu: 'N', sec: { src: 'shape', shape: 'rect', b: 60, h: 30 }, ld: { src: 'given', M: 40 }, fl: { pt: false } });
  close('11.13 without ribs', out(r, 'Absolute maximum bending stress σ_max'), 4.44);
  // Example 11.14: inclined moment on a rectangle
  r = bs({ mode: 'unsym', sec: { src: 'shape', shape: 'rect', b: 200, h: 400 }, un: { by: 'angle', M: 12, th: -Math.atan2(4, 3) * 180 / Math.PI } });
  close('11.14 M_z', out(r, 'Moment about z, M_z'), 7.2); close('11.14 M_y', out(r, 'Moment about y, M_y'), -9.6);
  close('11.14 B', out(r, 'Stress at the top-left corner'), 2.25); close('11.14 C', out(r, 'Stress at the top-right corner'), -4.95);
  close('11.14 D', out(r, 'Stress at the bottom-right corner'), -2.25); close('11.14 E', out(r, 'Stress at the bottom-left corner'), 4.95); close('11.14 α', out(r, 'Angle of the neutral axis α'), -79.4);
  // a moment about z alone on a symmetric section leaves the neutral axis horizontal
  r = bs({ mode: 'unsym', sec: { src: 'shape', shape: 'rect', b: 100, h: 100 }, un: { by: 'comp', Mz: 5, My: 0 } });
  close('symmetric section, M_z only: α = 0', out(r, 'Angle of the neutral axis α'), 0);
  // Example 12.1: glued T-beam
  r = bs({ mode: 'shear', sec: { src: 'shape', shape: 'T', bf: 150, d: 180, tf: 30, tw: 30 }, ld: simple(8, 0, 8, [D(4, 8, 6.5)]), sh: { y: 30 } });
  close('12.1 V', out(r, 'Shear force V'), -19.5); close('12.1 I', out(r, 'Moment of inertia I'), 27.0e6); close('12.1 Q', out(r, 'Q at the level'), 0.2025e6); close('12.1 τ', out(r, 'Shear stress at the level τ'), 4.88);
  // Example 12.3: wide flange, V = 80 kN
  r = bs({ mode: 'shear', sec: { src: 'shape', shape: 'I', bf: 300, d: 240, tf: 20, tw: 15 }, ld: { src: 'given', V: 80 }, sh: { y: 100 } });
  close('12.3 I', out(r, 'Moment of inertia I'), 155.6e6); close("12.3 τ_B'", out(r, 'Shear stress just above the level'), 1.13); close('12.3 τ_B', out(r, 'Shear stress just below the level'), 22.6); close('12.3 τ_C', out(r, 'Maximum shear stress τ_max'), 25.2);
  // rectangle: τ_max = 1.5 V/A at the neutral axis
  r = bs({ mode: 'shear', sec: { src: 'shape', shape: 'rect', b: 100, h: 200 }, ld: { src: 'given', V: 20 }, sh: { y: 0 } });
  close('rectangle τ_max = 1.5V/A', out(r, 'Maximum shear stress τ_max'), 1.5); close('rectangle level of τ_max', out(r, 'Level of τ_max above the neutral axis'), 0);
  // Example 12.4: three boards, glue
  r = bs({ mode: 'flow', sec: { src: 'parts', parts: [Rr(0, 0, 10, 300), Rr(135, 0, 10, 300), Rr(-52.5, 300, 250, 10)] }, ld: { src: 'given', V: 850 }, fw: { held: 'part', part: 3, n: 2, F: 0, task: 's' } });
  close('12.4 I', out(r, 'Moment of inertia I'), 87.42e6); close('12.4 q', out(r, 'Shear flow q'), 2660); close('12.4 q per seam', out(r, 'Shear flow per row'), 1330);
  // Example 12.5: nailed box beam
  r = bs({ mode: 'flow', fu: 'lb', sec: { src: 'parts', parts: [Rr(0, 0, 7.5, 1.5), Rr(0, 6, 7.5, 1.5), Rr(0, 1.5, 1.5, 4.5), Rr(6, 1.5, 1.5, 4.5)] }, ld: { src: 'given', V: 80 }, fw: { held: 'part', part: 2, n: 2, F: 30, task: 's', step: 0.5 } }, 'US');
  close('12.5 I', out(r, 'Moment of inertia I'), 229.5); close('12.5 q_B', out(r, 'Shear flow q'), 11.76); close('12.5 s_B', out(r, 'Largest spacing s'), 5.10);
  r = bs({ mode: 'flow', fu: 'lb', sec: { src: 'parts', parts: [Rr(0, 0, 1.5, 7.5), Rr(6, 0, 1.5, 7.5), Rr(1.5, 0, 4.5, 1.5), Rr(1.5, 6, 4.5, 1.5)] }, ld: { src: 'given', V: 80 }, fw: { held: 'part', part: 4, n: 2, F: 30, task: 's', step: 0 } }, 'US');
  close('12.5 q_C', out(r, 'Shear flow q'), 7.059); close('12.5 s_C', out(r, 'Largest spacing s'), 8.50);
  // Example 12.6: Case I
  r = bs({ mode: 'flow', fu: 'lb', sec: { src: 'parts', parts: [Rr(0, 0, 3, 0.5), Rr(0, 4.5, 3, 0.5), Rr(1, 0.5, 1, 4)] }, fw: { held: 'part', part: 2, n: 1, F: 40, task: 'V', s: 9 } }, 'US');
  close('12.6 I', out(r, 'Moment of inertia I'), 20.58); close('12.6 V', out(r, 'Largest shear force V'), 27.1);
  // Example 15.1: W shape
  r = bs({ mode: 'design', fu: 'kip', dz: { kind: 'W', sA: 24, tA: 14.5 }, ld: simple(18, 0, 12, [Pt(6, 40), Pt(18, 20)]) }, 'US');
  close('15.1 M_max', out(r, 'Largest moment M_max'), 120); close('15.1 V_max', out(r, 'Largest shear V_max'), 30); close('15.1 S_req', out(r, 'Required section modulus S_req'), 60);
  truthy('15.1 picks W18×40', out(r, 'Lightest W shape') === 'W18×40'); close('15.1 τ_avg', out(r, 'Average shear stress in the web τ_avg'), 5.32);
  // Example 15.2: rectangle sized for shear
  r = bs({ mode: 'design', dz: { kind: 'rect', sA: 9, tA: 0.6, ratio: 1.5 }, ld: simple(4, 1, 4, [D(0, 4, 12)]) });
  close('15.2 M_max', out(r, 'Largest moment M_max'), 10.67); close('15.2 V_max', out(r, 'Largest shear V_max'), 20); close('15.2 a from bending', out(r, 'Width from bending b'), 147);
  close('15.2 τ with that width', out(r, 'Largest shear stress with that width'), 0.929); close('15.2 a from shear', out(r, 'Required width b'), 183);
  // Example 15.3: wooden T-beam check and nail spacing
  const T153 = { src: 'shape', shape: 'T', bf: 200, d: 230, tf: 30, tw: 30 }, L153 = simple(4, 0, 4, [D(0, 2, 0.5), Pt(2, 1.5)]);
  r = bs({ mode: 'design', sec: T153, dz: { kind: 'check', sA: 12, tA: 0.8 }, ld: L153 });
  close('15.3 I', out(r, 'Moment of inertia I'), 60.125e6); close('15.3 σ', out(r, 'Largest bending stress σ_max'), 5.24); close('15.3 τ', out(r, 'Largest shear stress τ_max'), 0.309);
  r = bs({ mode: 'flow', sec: T153, ld: L153, fw: { held: 'part', part: 2, n: 1, F: 1.5, task: 's', step: 0 } });
  close('15.3 q_BC', out(r, 'Shear flow q'), 8.61); close('15.3 s_BC', out(r, 'Largest spacing s'), 174);
  // a solid round bar: τ_max = 4V/(3A)
  r = bs({ mode: 'shear', sec: { src: 'shape', shape: 'circle', D: 50 }, ld: { src: 'given', V: 10 }, sh: { y: 0 } });
  close('circle τ_max = 4V/3A', out(r, 'Maximum shear stress τ_max'), (4 * 10e3) / (3 * Math.PI * 0.025 ** 2) / 1e6, 0.01);
  // unit toggle round trip keeps the answer
  const st = Core.deepMerge(BeamStress.defaults(), { mode: 'flexure', sec: { src: 'shape', shape: 'I', bf: 250, d: 340, tf: 20, tw: 20 }, ld: simple(6, 0, 6, [D(0, 6, 5)]) });
  const a = out(BeamStress.solve(st, U.SI), 'Absolute maximum bending stress σ_max');
  BeamStress.convertState(st, 'SI', 'US'); const b = out(BeamStress.solve(st, U.US), 'Absolute maximum bending stress σ_max');
  BeamStress.convertState(st, 'US', 'SI'); close('σ_max in ksi', b, a / 6.894757, 1e-4); close('σ_max after the round trip', out(BeamStress.solve(st, U.SI), 'Absolute maximum bending stress σ_max'), a, 1e-5);
  truthy('flange thicker than the depth fails', !bs({ mode: 'flexure', sec: { src: 'shape', shape: 'T', bf: 150, d: 20, tf: 30, tw: 30 }, ld: { src: 'given', M: 10 } }).ok);
});

group('beam deflection module', () => {
  const Ld = (kind, o) => Object.assign({ kind, x: 0, P: 0, M: 0, dir: 'ccw', x1: 0, x2: 0, w1: 0, w2: 0 }, o), sp = (type, x) => ({ type, x });
  const df = (o, sys) => Deflect.solve(Core.deepMerge(Deflect.defaults(), o), U[sys || 'SI']);
  const ss = (l) => [sp('pin', 0), sp('roller', l)];
  // Example 16.1: triangular load peaking at midspan, v_max = w0 L⁴/(120EI)
  let r = df({ ei: 'unit', at: 3, bm: { L: 6, sups: ss(6), loads: [Ld('dist', { x1: 0, x2: 3, w1: 0, w2: 1 }), Ld('dist', { x1: 3, x2: 6, w1: 1, w2: 0 })] } });
  close('16.1 v_max = w0L⁴/120EI', out(r, 'Largest deflection v_max'), -(6 ** 4) / 120); close('16.1 at midspan', out(r, 'Where the deflection is largest, x'), 3);
  // Example 16.2: W12×26 cantilever
  r = df({ fu: 'kip', ei: 'num', Isrc: 'W', W: 'W12×26', E: 29000, at: 0, bm: { L: 15, sups: [sp('fixed', 15)], loads: [Ld('point', { x: 0, P: 6 })] } }, 'US');
  close('16.2 θ_A', out(r, 'Slope at the point θ'), 0.0164); close('16.2 v_A', out(r, 'Deflection at the point v'), -1.97);
  // Example 16.3
  r = df({ ei: 'unit', at: 1.633, bm: { L: 3, sups: ss(3), loads: [Ld('point', { x: 2, P: 6 })] } });
  close('16.3 v_max', out(r, 'Largest deflection v_max'), -2.90); close('16.3 x', out(r, 'Where the deflection is largest, x'), 1.633); close('16.3 A_y', out(r, 'Reaction at A, A_y'), 2);
  // Example 16.4: overhang
  r = df({ ei: 'unit', at: 3, bm: { L: 3, sups: [sp('pin', 0), sp('roller', 2)], loads: [Ld('point', { x: 3, P: 4 })] } });
  close('16.4 v_C', out(r, 'Deflection at the point v'), -4); close('16.4 A_y', out(r, 'Reaction at A, A_y'), -2);
  // Example 16.7 by superposition
  const b167 = { L: 8, sups: ss(8), loads: [Ld('dist', { x1: 0, x2: 4, w1: 2, w2: 2 }), Ld('point', { x: 4, P: 8 })] };
  close('16.7 v_C', out(df({ mode: 'super', ei: 'unit', at: 4, bm: b167 }), 'Deflection at the point v'), -138.67); close('16.7 θ_A', out(df({ mode: 'super', ei: 'unit', at: 0, bm: b167 }), 'Slope at the point θ'), -56);
  // Example 16.8: triangular load on a cantilever, unloaded tip
  close('16.8 v_C', out(df({ mode: 'super', ei: 'unit', at: 8, bm: { L: 8, sups: [sp('fixed', 0)], loads: [Ld('dist', { x1: 0, x2: 6, w1: 4, w2: 0 })] } }), 'Deflection at the point v'), -244.8);
  // Appendix D checks (L = 6, EI = 1)
  const ad = (sups, q, at) => out(df({ ei: 'unit', at, bm: { L: 6, sups, loads: [q] } }), 'Deflection at the point v');
  close('App. D: SS, P at midspan', ad(ss(6), Ld('point', { x: 3, P: 1 }), 3), -(6 ** 3) / 48);
  close('App. D: SS, uniform', ad(ss(6), Ld('dist', { x1: 0, x2: 6, w1: 1, w2: 1 }), 3), (-5 * 6 ** 4) / 384);
  close('App. D: SS, w on left half at L/2', ad(ss(6), Ld('dist', { x1: 0, x2: 3, w1: 1, w2: 1 }), 3), (-5 * 6 ** 4) / 768);
  close('App. D: cantilever, P at tip', ad([sp('fixed', 0)], Ld('point', { x: 6, P: 1 }), 6), -(6 ** 3) / 3);
  close('App. D: cantilever, uniform', ad([sp('fixed', 0)], Ld('dist', { x1: 0, x2: 6, w1: 1, w2: 1 }), 6), -(6 ** 4) / 8);
  close('App. D: cantilever, couple at tip', ad([sp('fixed', 0)], Ld('couple', { x: 6, M: 1, dir: 'ccw' }), 6), 36 / 2);
  close('App. D: cantilever, w on half next to wall', ad([sp('fixed', 0)], Ld('dist', { x1: 0, x2: 3, w1: 1, w2: 1 }), 6), (-7 * 6 ** 4) / 384);
  r = df({ ei: 'unit', at: 6, bm: { L: 6, sups: ss(6), loads: [Ld('couple', { x: 6, M: 1, dir: 'ccw' })] } });
  close('App. D: SS, couple at end, θ₂ = M0L/3EI', out(r, 'Slope at the point θ'), 2); close('App. D: SS, couple, v_max', out(r, 'Largest deflection v_max'), -36 / (9 * Math.sqrt(3)));
  // Example 16.12 and the standard indeterminate beams
  r = df({ mode: 'indet', fu: 'kip', ei: 'unit', at: 6, bm: { L: 12, sups: [sp('fixed', 0), sp('fixed', 12)], loads: [Ld('dist', { x1: 0, x2: 6, w1: 3, w2: 3 })] } }, 'US');
  close('16.12 M_A', out(r, 'Moment at A, M_A'), 24.75); close('16.12 M_B (clockwise)', out(r, 'Moment at B, M_B'), -11.25);
  r = df({ mode: 'indet', ei: 'unit', at: 3, bm: { L: 6, sups: [sp('fixed', 0), sp('roller', 6)], loads: [Ld('dist', { x1: 0, x2: 6, w1: 1, w2: 1 })] } });
  close('propped R_B = 3wL/8', out(r, 'Reaction at B, B_y'), 2.25); close('propped M_A = wL²/8', out(r, 'Moment at A, M_A'), 4.5);
  r = df({ mode: 'indet', ei: 'unit', at: 3, bm: { L: 6, sups: [sp('fixed', 0), sp('fixed', 6)], loads: [Ld('dist', { x1: 0, x2: 6, w1: 1, w2: 1 })] } });
  close('fixed-fixed M = wL²/12', out(r, 'Moment at A, M_A'), 3); close('fixed-fixed v = wL⁴/384EI', out(r, 'Deflection at the point v'), -(6 ** 4) / 384);
  r = df({ mode: 'indet', ei: 'unit', at: 3, bm: { L: 8, sups: [sp('pin', 0), sp('roller', 4), sp('roller', 8)], loads: [Ld('dist', { x1: 0, x2: 8, w1: 1, w2: 1 })] } });
  close('two spans: end reaction 3wl/8', out(r, 'Reaction at A, A_y'), 1.5); close('two spans: middle reaction 10wl/8', out(r, 'Reaction at B, B_y'), 5);
  // unit round trip
  const st = Core.deepMerge(Deflect.defaults(), { ei: 'num', E: 200, I: 100e6, at: 2, bm: { L: 6, sups: ss(6), loads: [Ld('dist', { x1: 0, x2: 6, w1: 20, w2: 20 })] } });
  const a = out(Deflect.solve(st, U.SI), 'Largest deflection v_max');
  close('v_max = 5wL⁴/384EI', a, (-5 * 20e3 * 6 ** 4) / (384 * 200e9 * 100e-6) * 1000);
  Deflect.convertState(st, 'SI', 'US'); close('v_max in inches', out(Deflect.solve(st, U.US), 'Largest deflection v_max'), a / 25.4, 1e-4);
  Deflect.convertState(st, 'US', 'SI'); close('v_max after the round trip', out(Deflect.solve(st, U.SI), 'Largest deflection v_max'), a, 1e-4);
  truthy('a beam on one pin fails', !df({ ei: 'unit', at: 2, bm: { L: 4, sups: [sp('pin', 0)], loads: [Ld('point', { x: 2, P: 5 })] } }).ok);
});

group('stress transformation module', () => {
  const tf = (mode, o, sys) => Transform.solve(Core.deepMerge(Transform.defaults(), Object.assign({ mode }, o)), U[sys || 'SI']);
  const ps = (sx, sy, txy, th, sys) => tf('stress', { ps: { sx, sy, txy, th } }, sys);
  const pe = (ex, ey, gxy, th, o) => tf('strain', { pe: Object.assign({ ex, ey, gxy, th, ez: 'zero' }, o) });
  // Example 14.2
  let r = ps(-80, 50, -25, -30);
  close("14.2 σx'", out(r, "Normal stress σ_x'"), -25.8); close("14.2 τx'y'", out(r, "Shear stress τ_x'y'"), -68.8); close("14.2 σy'", out(r, "Normal stress σ_y'"), -4.15);
  // Examples 14.3, 14.4 and 14.8
  r = ps(-20, 90, 60, 0);
  close('14.3 σ1', out(r, 'Principal stress σ_1'), 116); close('14.3 σ2', out(r, 'Principal stress σ_2'), -46.4); close('14.3 θp (σ2)', out(r, 'Angle to σ_2, θ_p2'), -23.7); close('14.3 θp (σ1)', out(r, 'Angle to σ_1, θ_p1'), 66.3);
  close('14.4 τmax', out(r, 'Maximum in-plane shear stress τ_max'), 81.4); close('14.4 σavg', out(r, 'Average normal stress σ_avg'), 35); close('14.4 θs', out(r, 'Angle to the plane of τ_max, θ_s'), 21.3);
  // Example 14.7
  r = ps(-12, 0, -6, 0, 'US');
  close('14.7 σ1', out(r, 'Principal stress σ_1'), 2.49); close('14.7 σ2', out(r, 'Principal stress σ_2'), -14.5);
  // Example 14.9
  r = ps(-8, 12, -6, 30, 'US');
  close("14.9 σx'", out(r, "Normal stress σ_x'"), -8.20); close("14.9 τx'y'", out(r, "Shear stress τ_x'y'"), 5.66); close("14.9 σy'", out(r, "Normal stress σ_y'"), 12.2);
  // Examples 14.10 and 14.11
  r = ps(32, 16, 0, 0); close('14.10 τabs', out(r, 'Absolute maximum shear stress τ_abs'), 16); close('14.10 τ in-plane', out(r, 'Maximum in-plane shear stress τ_max'), 8);
  r = ps(-0.02, 0, -0.04, 0, 'US');
  close('14.11 σ1', out(r, 'Principal stress σ_1'), 0.0312); close('14.11 σ2', out(r, 'Principal stress σ_2'), -0.0512); close('14.11 τabs', out(r, 'Absolute maximum shear stress τ_abs'), 0.0412);
  // Examples 14.12 to 14.18 (strain)
  r = pe(500, -300, 200, -30);
  close("14.12 εx'", out(r, "Normal strain ε_x'"), 213); close("14.12 γx'y'", out(r, "Shear strain γ_x'y'"), 793); close("14.12 εy'", out(r, "Normal strain ε_y'"), -13.4);
  r = pe(-350, 200, 80, 0);
  close('14.13 θp (ε2)', out(r, 'Angle to ε_2, θ_p2'), -4.14); close('14.13 ε1', out(r, 'Principal strain ε_1'), 203); close('14.13 ε2', out(r, 'Principal strain ε_2'), -353); close('14.14 γmax', out(r, 'Maximum in-plane shear strain γ_max'), 556);
  r = pe(250, -150, 120, 0);
  close('14.15 ε1', out(r, 'Principal strain ε_1'), 259); close('14.15 ε2', out(r, 'Principal strain ε_2'), -159); close('14.15 θp', out(r, 'Angle to ε_1, θ_p1'), 8.35);
  close('14.16 γmax', out(r, 'Maximum in-plane shear strain γ_max'), 418); close('14.16 θs', out(r, 'Angle to the plane of γ_max, θ_s'), -36.7);
  r = pe(-300, -100, 100, -20);
  close("14.17 εx'", out(r, "Normal strain ε_x'"), -309); close("14.17 γx'y'", out(r, "Shear strain γ_x'y'"), -52.0); close("14.17 εy'", out(r, "Normal strain ε_y'"), -91.3);
  r = pe(-400, 200, 150, 0); close('14.18 γabs', out(r, 'Absolute maximum shear strain γ_abs'), 618);
  r = pe(300, 100, 0, 0); close('plane strain γabs uses εz = 0', out(r, 'Absolute maximum shear strain γ_abs'), 300);
  r = pe(300, 100, 0, 0, { ez: 'nu', nu: 0.3 }); close('plane stress εz', out(r, 'Out-of-plane strain ε_z'), -171.43); close('plane stress γabs', out(r, 'Absolute maximum shear strain γ_abs'), 471.43);
  // Examples 14.19 and 14.20 (60° rosette)
  r = tf('rosette', { ro: { kind: '60', ea: 60, eb: 135, ec: 264, E: 200, nu: 0.3 } });
  close('14.19 εy', out(r, 'Normal strain ε_y'), 246); close('14.19 γxy', out(r, 'Shear strain γ_xy'), -149); close('14.19 ε1', out(r, 'Principal strain ε_1'), 272); close('14.19 ε2', out(r, 'Principal strain ε_2'), 33.9);
  close('14.19 θp', out(r, 'Angle to ε_2, θ_p2'), 19.3); close('14.20 σ1', out(r, 'Principal stress σ_1'), 62.0); close('14.20 σ2', out(r, 'Principal stress σ_2'), 25.4);
  r = tf('rosette', { ro: { kind: 'gen', ta: 0, tb: 60, tc: 120, ea: 60, eb: 135, ec: 264, E: 0 } });
  close('general angles match the 60° rosette', out(r, 'Shear strain γ_xy'), -148.96);
  r = tf('rosette', { ro: { kind: '45', ea: 400, eb: 300, ec: -200, E: 0 } });
  close('45° rosette γxy = 2εb − (εa + εc)', out(r, 'Shear strain γ_xy'), 400); close('45° rosette εy', out(r, 'Normal strain ε_y'), -200);
  truthy('two gauges in the same direction fail', !tf('rosette', { ro: { kind: 'gen', ta: 0, tb: 180, tc: 90, ea: 1, eb: 2, ec: 3, E: 0 } }).ok);
  // Examples 14.21 and 14.22 (generalized Hooke's law)
  r = tf('hooke', { hk: { sx: 800, sy: -500, sz: 0, txy: 0, tyz: 0, txz: 0, E: 120, nu: 0.34, a: 300, b: 50, c: 20 } });
  close('14.21 εx', out(r, 'Normal strain ε_x'), 0.00808); close('14.21 εy', out(r, 'Normal strain ε_y'), -0.00643); close('14.21 εz', out(r, 'Normal strain ε_z'), -0.000850);
  close("14.21 a' = 302.4", 300 + out(r, 'Change in the side along x, δ_x'), 302.4); close("14.21 b' = 49.68", 50 + out(r, 'Change in the side along y, δ_y'), 49.68);
  r = tf('hooke', { hk: { sx: -0.02, sy: -0.02, sz: -0.02, txy: 0, tyz: 0, txz: 0, E: 0.6, nu: 0.45, a: 4, b: 2, c: 3 } }, 'US');
  close('14.22 e', out(r, 'Dilatation e'), -0.01); close('14.22 ε', out(r, 'Normal strain ε_x'), -0.00333); close('14.22 δa', out(r, 'Change in the side along x, δ_x'), -0.0133); close('14.22 k = −p/e', out(r, 'Bulk modulus k'), 2);
  truthy('ν = 0.5 fails', !tf('hooke', { hk: { nu: 0.5 } }).ok);
  // unit round trip
  const st = Core.deepMerge(Transform.defaults(), { mode: 'stress', ps: { sx: -20, sy: 90, txy: 60, th: 30 } });
  const a = out(Transform.solve(st, U.SI), 'Principal stress σ_1');
  Transform.convertState(st, 'SI', 'US'); close('σ1 in ksi', out(Transform.solve(st, U.US), 'Principal stress σ_1'), a * 0.145038, 1e-4);
  Transform.convertState(st, 'US', 'SI'); close('σ1 after the round trip', out(Transform.solve(st, U.SI), 'Principal stress σ_1'), a, 1e-4);
});

group('combined loadings module', () => {
  const cb = (o, sys) => Combined.solve(Core.deepMerge(Combined.defaults(), o), U[sys || 'SI']);
  // Example 13.1: largest pressure in a cylinder and a sphere
  let r = cb({ mode: 'vessel', pu: 'psi', vs: { kind: 'cyl', task: 'pmax', r: 24, t: 0.5, sA: 20, N: 0, E: 0 } }, 'US');
  close('13.1 cylinder p', out(r, 'Largest internal pressure p'), 417); close('13.1 σ2 = 10 ksi', out(r, 'Longitudinal stress σ_2'), 10);
  r = cb({ mode: 'vessel', pu: 'psi', vs: { kind: 'sphere', task: 'pmax', r: 24, t: 0.5, sA: 20, E: 0 } }, 'US');
  close('13.1 sphere p', out(r, 'Largest internal pressure p'), 833);
  // Example 13.3: gas tank with a load on top
  r = cb({ mode: 'vessel', pu: 'psi', fu: 'kip', vs: { kind: 'cyl', task: 'stress', p: 2, r: 24, t: 0.5, N: -1.5, E: 0 } }, 'US');
  close('13.3 σ1 = 96.0 psi', out(r, 'Hoop stress σ_1'), 0.096); close('13.3 σ2 = 28.3 psi', out(r, 'Longitudinal stress σ_2'), 0.0283);
  // Example 14.10 style: absolute maximum shear at the outer wall is σ1/2
  r = cb({ mode: 'vessel', pu: 'MPa', vs: { kind: 'cyl', task: 'stress', p: 2, r: 400, t: 25, N: 0, E: 0 } });
  close('cylinder σ1 = 32 MPa', out(r, 'Hoop stress σ_1'), 32); close('τabs = σ1/2', out(r, 'Absolute maximum shear stress τ_abs'), 16); close('in-plane τ = σ1/4', out(r, 'Largest in-plane shear stress'), 8);
  r = cb({ mode: 'vessel', pu: 'MPa', vs: { kind: 'cyl', task: 'tmin', p: 2, r: 400, sA: 100, E: 0 } }); close('thickness pr/σ', out(r, 'Smallest wall thickness t'), 8);
  r = cb({ mode: 'vessel', pu: 'MPa', vs: { kind: 'sphere', task: 'stress', p: 2, r: 400, t: 10, E: 200, nu: 0.3 } });
  close('sphere σ = pr/2t', out(r, 'Wall stress σ_1 = σ_2'), 40); close('sphere δr = (1−ν)σr/E', out(r, 'Change in the inner radius δr'), (0.7 * 40 * 400) / 200000);
  truthy('r/t below 10 warns', cb({ mode: 'vessel', pu: 'MPa', vs: { kind: 'cyl', task: 'stress', p: 2, r: 40, t: 10, E: 0 } }).warn.length > 0);
  // Example 13.4: rectangular member, points C (top) and D (centre)
  const s134 = { shape: 'rect', b: 50, h: 250, N: -16.45, Vy: 0, Vz: 21.93, My: -32.89, Mz: 0, T: 0 };
  r = cb({ mode: 'section', sc: Object.assign({ pt: 't' }, s134) });
  close('13.4 σ_C = −64.5 MPa', out(r, 'Normal stress σ_x'), -64.5); close('13.4 τ_C = 0', out(r, 'Shear stress τ_xz'), 0); close('13.4 bending at C', out(r, 'Bending stress from M_y'), -63.16);
  r = cb({ mode: 'section', sc: Object.assign({ pt: 'c' }, s134) });
  close('13.4 σ_D = −1.32 MPa', out(r, 'Normal stress σ_x'), -1.316); close('13.4 τ_D = 2.63 MPa', out(r, 'Shear stress τ_xz'), 2.632);
  // Example 13.5: rod in tension and bending
  r = cb({ mode: 'section', fu: 'lb', mu: 'lb·in.', sc: { shape: 'circle', d: 1.5, N: 500, Vy: 0, Vz: 0, My: 0, Mz: -7000, T: 0, pt: 'r' } }, 'US');
  close('13.5 N/A = 0.283 ksi', out(r, 'Normal stress from N'), 0.283); close('13.5 Mc/I = 21.13 ksi', out(r, 'Bending stress from M_z'), 21.13); close('13.5 σ_A = 21.4 ksi', out(r, 'Normal stress σ_x'), 21.4);
  // Example 13.6: rod in shear, bending and torsion
  r = cb({ mode: 'section', fu: 'lb', mu: 'lb·in.', sc: { shape: 'circle', d: 1.5, N: 0, Vy: 0, Vz: 800, My: 8000, Mz: 0, T: 11200, pt: 'r' } }, 'US');
  close('13.6 VQ/It = 0.6036 ksi', out(r, 'Shear stress from V_z (τ_xz)'), 0.6036); close('13.6 Tc/J = 16.90 ksi', out(r, 'Shear stress from T, τ_xz'), 16.90); close('13.6 τ = 17.5 ksi', out(r, 'Shear stress τ_xz'), 17.5); close('13.6 σ_A = 0', out(r, 'Normal stress σ_x'), 0);
  r = cb({ mode: 'section', sc: { shape: 'tube', d: 100, di: 80, N: 0, Vy: 0, Vz: 0, My: 0, Mz: 0, T: 4, pt: 'ti' } });
  close('tube inner wall τ = Tc_i/J', out(r, 'Shear stress τ_xy'), (-4e3 * 0.04) / ((Math.PI / 2) * (0.05 ** 4 - 0.04 ** 4)) / 1e6);
  truthy('a point off the section fails', !cb({ mode: 'section', sc: Object.assign({ pt: 'custom', y: 40, z: 0 }, s134) }).ok);
  // Example 13.2: eccentric compressive load on a 4 in. × 10 in. member
  r = cb({ mode: 'eccentric', fu: 'lb', ec: { b: 4, h: 10, P: 150, ey: 0, ez: 5 } }, 'US');
  close('13.2 σ_C = −15.0 psi', out(r, 'Smallest normal stress'), -0.015); close('13.2 σ_B = 7.50 psi', out(r, 'Largest normal stress'), 0.0075); close('13.2 neutral axis 3.33 in. from B', out(r, 'Distance of the neutral axis from the nearer edge'), 3.333);
  r = cb({ mode: 'eccentric', ec: { b: 300, h: 300, P: 900, ey: 50, ez: 0 } });
  close('load on the kern edge: σ_min', out(r, 'Smallest normal stress'), -20); close('load on the kern edge: σ_max = 0', out(r, 'Largest normal stress'), 0); truthy('on the kern edge counts as inside', out(r, 'Load inside the kern') === 'Yes' || (r.out.find((o) => o.k === 'Load inside the kern') || {}).v === 'Yes');
  // unit round trip
  const st = Core.deepMerge(Combined.defaults(), { mode: 'section', sc: Object.assign({ pt: 'c' }, s134) });
  const a = out(Combined.solve(st, U.SI), 'Shear stress τ_xz');
  Combined.convertState(st, 'SI', 'US'); close('τ in ksi', out(Combined.solve(st, U.US), 'Shear stress τ_xz'), a * 0.145038, 1e-4);
  Combined.convertState(st, 'US', 'SI'); close('τ after the round trip', out(Combined.solve(st, U.SI), 'Shear stress τ_xz'), a, 1e-4);
});

group('buckling module', () => {
  const bk = (o, sys) => Buckle.solve(Core.deepMerge(Buckle.defaults(), o), U[sys || 'SI']);
  const ax = (sup, n, K) => ({ sup, n: n || 1, K: K || 1 });
  // Example 17.1: W8×31, pinned, 12 ft; it yields first
  let r = bk({ fu: 'kip', L: 12, sec: { src: 'W', W: 'W8×31' }, ax: ax('pp'), ay: ax('pp'), E: 29000, sY: 50, FS: 1 }, 'US');
  close('17.1 P_cr about y', out(r, 'Critical load about y, (P_cr)_y'), 512); close('17.1 σ_cr', out(r, 'Critical stress σ_cr'), 56.1); close('17.1 P = σY A', out(r, 'Largest load P'), 456.5);
  truthy('17.1 yields first', (r.out.find((o) => o.k === 'Yields before it buckles') || {}).v === 'Yes' && /y–y/.test((r.out.find((o) => o.k === 'Buckling axis') || {}).v));
  // Example 17.2: braced aluminium column
  r = bk({ fu: 'kN', L: 5, sec: { src: 'given', A: 7500, Ix: 61.3e6, Iy: 23.2e6 }, ax: ax('fr'), ay: ax('fp'), E: 70, sY: 215, FS: 3 });
  close('17.2 (P_cr)_x', out(r, 'Critical load about x, (P_cr)_x'), 424); close('17.2 (P_cr)_y', out(r, 'Critical load about y, (P_cr)_y'), 1310); close('17.2 P_allow', out(r, 'Allowable load P_allow'), 141); close('17.2 σ_cr', out(r, 'Critical stress σ_cr'), 56.5);
  // Example 17.3: W6×15 fixed at both ends, braced at mid-height about y
  r = bk({ fu: 'kip', L: 24, sec: { src: 'W', W: 'W6×15' }, ax: ax('ff'), ay: ax('fp', 2), E: 29000, sY: 60, FS: 1 }, 'US');
  close('17.3 (KL)_y = 8.40 ft', out(r, 'Effective length about y, (KL)_y'), 8.4); close('17.3 (P_cr)_x', out(r, 'Critical load about x, (P_cr)_x'), 401.7); close('17.3 (P_cr)_y', out(r, 'Critical load about y, (P_cr)_y'), 262.5); close('17.3 σ_cr', out(r, 'Critical stress σ_cr'), 59.3); close('17.3 P', out(r, 'Largest load P'), 262.5);
  // F17-1 and F17-4
  r = bk({ fu: 'kip', L: 50 / 12, sec: { src: 'shape', shape: 'circle', d: 1 }, ax: ax('ff'), ay: ax('ff'), E: 29000, sY: 36, FS: 1 }, 'US');
  close('F17-1 P_cr', out(r, 'Critical load P_cr'), 22.5);
  r = bk({ fu: 'kN', L: 5, sec: { src: 'shape', shape: 'tube', d: 50, di: 30 }, ax: ax('ff'), ay: ax('ff'), E: 200, sY: 250, FS: 1 });
  close('F17-4 P_cr', out(r, 'Critical load P_cr'), 84.3);
  r = bk({ fu: 'kip', L: 12, sec: { src: 'shape', shape: 'rect', b: 2, h: 4 }, ax: ax('pp'), ay: ax('pp'), E: 1600, sY: 5, FS: 1 }, 'US');
  close('F17-2 P_cr (weak axis)', out(r, 'Critical load P_cr'), 2.03);
  // sizing and length, the reverse of F17-1
  r = bk({ task: 'size', fu: 'kip', P: 22.48, L: 50 / 12, sec: { src: 'shape', shape: 'circle' }, ax: ax('ff'), ay: ax('ff'), E: 29000, sY: 36, FS: 1 }, 'US');
  close('size: d = 1 in.', out(r, 'Required diameter d'), 1, 0.002);
  r = bk({ task: 'length', fu: 'kip', P: 22.48, sec: { src: 'shape', shape: 'circle', d: 1 }, ax: ax('ff'), ay: ax('ff'), E: 29000, sY: 36, FS: 1 }, 'US');
  close('length: 50 in.', out(r, 'Largest length L'), 50 / 12, 0.002);
  r = bk({ task: 'size', fu: 'kip', P: 250, L: 24, sec: { src: 'W' }, ax: ax('ff'), ay: ax('fp', 2), E: 29000, sY: 60, FS: 1 }, 'US');
  truthy('size: W6×15 is the lightest for 17.3 at 250 kip', (r.out.find((o) => o.k === 'Lightest W shape') || {}).v === 'W6×15');
  truthy('K = 0 fails', !bk({ ax: { sup: 'k', n: 1, K: 0 } }).ok);
  // unit round trip
  const st = Core.deepMerge(Buckle.defaults(), {});
  const a = out(Buckle.solve(st, U.SI), 'Allowable load P_allow');
  Buckle.convertState(st, 'SI', 'US'); close('P_allow in kip', out(Buckle.solve(st, U.US), 'Allowable load P_allow'), a * 0.224809, 1e-4);
  Buckle.convertState(st, 'US', 'SI'); close('P_allow after the round trip', out(Buckle.solve(st, U.SI), 'Allowable load P_allow'), a, 1e-4);
});

group('dynamics: rectilinear kinematics', () => {
  const run = (o, sys) => Rect.solve(Object.assign(Rect.defaults(), o), U[sys]);
  { const r = run({ mode: 'func', given: 'v', c: [0, 2, 3, 0, 0], s0: 0, t: 3 }, 'US'); [{ k: 'Position s', v: 36 }, { k: 'Acceleration a', v: 20 }].forEach((e) => close('Book Example 12.1, v = 3t² + 2t ft/s, at t = 3 s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'av', form: 'kv3', k: 0.4, v0: 60, s0: 0, t: 4, track: 'v' }, 'SI'); [{ k: 'Velocity v', v: 0.559 }, { k: 'Position s', v: 4.431 }].forEach((e) => close('Book Example 12.2, projectile slowed by a = −0.4v³, at t = 4: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'const', grav: true, s0: 40, v0: 75, find: 's', at: 0, track: 'v' }, 'SI'); [{ k: 'Turning point position', v: 326.7 }, { k: 'Velocity v', v: -80.06 }].forEach((e) => close('Book Example 12.3, rocket at 75 m/s from 40 m up, free fall: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'as', cs: [0, 4, 0], s0: 0.1, v0: 0, sT: 0.2, track: 'v' }, 'SI'); [{ k: 'Velocity at the target v', v: 0.3464 }, { k: 'Time to reach the target t', v: 0.658 }].forEach((e) => close('Book Example 12.4, a = 4s from rest at 100 mm to 200 mm: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'func', given: 'v', c: [0, -6, 3, 0, 0], s0: 0, t: 3.5 }, 'SI'); [{ k: 'Position s', v: 6.125 }, { k: 'Distance travelled s_T', v: 14.125 }, { k: 'Average velocity v_avg', v: 1.75 }, { k: 'Average speed (v_sp)_avg', v: 4.036 }].forEach((e) => close('Book Example 12.5, v = 3t² − 6t over 0 to 3.5 s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'graph', gtype: 'vt', s0: 0, pts: [{ t: 0, v: 0 }, { t: 10, v: 20 }, { t: 30, v: 20 }], t: 30 }, 'US'); [{ k: 'Position s', v: 500 }, { k: 'Velocity v', v: 20 }].forEach((e) => close('Book Example 12.6, bicycle v–t graph to 30 s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'graph', gtype: 'at', s0: 0, v0: 0, segs: [{ t: 10, a: 10 }, { t: 60, a: -2 }], t: 10 }, 'SI'); [{ k: 'First instant with v = 0 (after start)', v: 60 }, { k: 'Velocity v', v: 100 }, { k: 'Displacement Δs', v: 3000 }].forEach((e) => close('Book Example 12.7, car at 10 m/s² for 10 s then −2 m/s²: ' + e.k, out(r, e.k), e.v)); }
  const B = (name, given, v, a) => ({ name, given, v: v || 0, a: a || 0, ds: 0 }), C = (o) => Object.assign({ cA: 0, cB: 0, cC: 0, cD: 0, cE: 0 }, o);
  { const r = run({ mode: 'dep', dep: { bodies: [B('A', 'yes', 2), B('B', 'no'), B('C', 'no')], cords: [C({ cA: 1, cB: 2, cC: -2 }), C({ cB: 1, cC: 1 })] } }, 'SI'); close('Prob. 12-195 v_B', out(r, 'v_B'), -0.5); }
  { const r = run({ mode: 'dep', dep: { bodies: [B('A', 'yes', 3), B('B', 'no'), B('D', 'no')], cords: [C({ cB: 2, cC: 1 }), C({ cA: 1, cC: -2 })] } }, 'SI'); close('Prob. 12-202 v_B', out(r, 'v_B'), -0.75); }
  { const r = run({ mode: 'dep', dep: { bodies: [B('A', 'yes', 0, 3), B('B', 'no'), B('C', 'no')], cords: [C({ cB: 3, cC: -2 }), C({ cA: 1, cC: 1 })], tgt: true, tB: 'B', tv: 10 } }, 'SI'); close('Prob. 12-203 t', out(r, 'Time for B to reach 10 m/s'), 5); }
  { const r = run({ mode: 'dep', dep: { bodies: [B('A', 'yes', -2), B('C', 'no')], cords: [C({ cA: -1, cB: 3 })] } }, 'SI'); close('Prob. 12-209 v_C', out(r, 'v_C'), -0.6667, 1e-3); }
  truthy('dependent motion: too few cords fails', !run({ mode: 'dep', dep: { bodies: [B('A', 'yes', 2), B('B', 'no'), B('C', 'no')], cords: [C({ cA: 1, cB: 2, cC: -2 })] } }, 'SI').ok);
  { const st = Object.assign(Rect.defaults(), { mode: 'dep' }); Rect.convertState(st, 'SI', 'US'); close('dependent motion units', st.dep.bodies[0].v, 2 / 0.3048, 1e-6); }
});

group('statics: virtual work', () => {
  const env = { θ: 0.5, P: 2 };
  const f = (src) => VWork.compile(src, new Set(['θ', 'P']))(env);
  close('parser: 4 sin θ', f('4 sin θ'), 4 * Math.sin(0.5), 1e-12);
  close('parser: sin 2θ cos θ', f('sin 2θ cos θ'), Math.sin(1) * Math.cos(0.5), 1e-12);
  close('parser: 2P cot θ', f('2P cot θ'), 4 / Math.tan(0.5), 1e-12);
  close('parser: powers and brackets', f('-(P+1)^2 / 3 + 30deg'), -3 + Math.PI / 6, 1e-12);
  close('parser: x² and ×', f('P² × 2'), 8, 1e-12);
  let threw = false; try { VWork.compile('2 + Q', new Set(['θ'])); } catch (e) { threw = /unknown name/.test(e.message); }
  truthy('parser rejects unknown names', threw);
  threw = false; try { VWork.compile('alert(1)', new Set(['θ'])); } catch (e) { threw = true; }
  truthy('parser rejects code', threw);
  const base = { forces: [], weights: [], springs: [], couples: [], V: '', links: [], points: [], params: [] };
  const run = (o) => VWork.solve(Object.assign(VWork.defaults(), base, o));
  // 11-15: −100 sin θ (2 cos θ) + 8(4 cos θ) = 0
  let r = VWork.solve(VWork.defaults());
  close('11-15 θ', out(r, 'Equilibrium position 1 θ'), 9.21);
  // 11-21
  r = run({ F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 90 }, params: [{ name: 'P', v: 50 }, { name: 'k', v: 200 }],
    points: [{ name: 'A', x: '0', y: '0' }, { name: 'B', x: '0.5 sin θ', y: '0.5 cos θ' }, { name: 'C', x: 'sin θ', y: 'cos θ' }, { name: 'D', x: '-0.5 sin θ', y: '0.5 cos θ' }],
    forces: [{ at: 'C', Fx: 'P', Fy: '0' }], springs: [{ kind: 'pts', a: 'D', b: 'B', k: 'k', L0: '0.3' }] });
  close('11-21 θ = 33.4°', out(r, 'Equilibrium position 1 θ'), 33.4); close('11-21 θ = 90°', out(r, 'Equilibrium position 2 θ'), 90);
  // 11-27 and 11-26: given potential functions
  r = run({ F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 180 }, V: '12 sin 2θ + 15 cos θ' });
  close('11-27 θ1', out(r, 'Equilibrium position 1 θ'), 34.6); close("11-27 V''", out(r, 'd²V/dθ² at position 1'), -57.2);
  close('11-27 θ2', out(r, 'Equilibrium position 2 θ'), 145.4); truthy('11-27 stability', out(r, 'Stability at position 1') === undefined || r.out.find((o) => o.k === 'Stability at position 2').v === 'stable');
  r = run({ F: 'N', lu: 'm', q: { kind: 'length', min: -2, max: 2 }, V: '20x^3 - 10x^2 - 25x - 10' });
  close('11-26 x1', out(r, 'Equilibrium position 1 x'), -0.5); close('11-26 x2', out(r, 'Equilibrium position 2 x'), 0.8333);
  // 11-38: rod and drum spring, in lb and in.
  r = run({ F: 'lb', lu: 'in.', q: { kind: 'angle', min: 0, max: 90 }, points: [{ name: 'O', x: '0', y: '0' }, { name: 'G', x: '18 sin θ', y: '18 cos θ' }], weights: [{ at: 'G', W: '20' }], springs: [{ kind: 'expr', k: '2', s: '12θ' }] });
  close('11-38 θ = 0', out(r, 'Equilibrium position 1 θ'), 0); close('11-38 θ = 64.8°', out(r, 'Equilibrium position 2 θ'), 64.8);
  close("11-38 V'' = 135", out(r, 'd²V/dθ² at position 2'), 135); close("11-38 V'' at 0 = −72", out(r, 'd²V/dθ² at position 1'), -72);
  // 11-2 scissors jack: F = 2P cot θ
  r = run({ task: 'param', unk: 'F', q: { kind: 'angle', min: 10, max: 80, at: 30 }, params: [{ name: 'P', v: 100 }, { name: 'L', v: 1 }, { name: 'F', v: 1 }],
    points: [{ name: 'B', x: 'L cos θ', y: '0' }, { name: 'E', x: '0', y: '2L sin θ' }], forces: [{ at: 'B', Fx: '-F', Fy: '0' }, { at: 'E', Fx: '0', Fy: '-P' }] });
  close('11-2 F = 2P cot 30°', out(r, 'Unknown F for equilibrium'), 200 / Math.tan(30 * Math.PI / 180), 1e-6);
  // couple and crank: 6 − F(0.5 sin 60°) = 0
  r = run({ task: 'param', unk: 'F', F: 'N', lu: 'm', q: { kind: 'angle', min: 0, max: 90, at: 60 }, params: [{ name: 'F', v: 1 }], points: [{ name: 'B', x: '0.5 cos θ', y: '0.5 sin θ' }], forces: [{ at: 'B', Fx: 'F', Fy: '0' }], couples: [{ M: '6', phi: 'θ' }] });
  close('crank F = 13.9 N', out(r, 'Unknown F for equilibrium'), 13.86);
  truthy('unknown name fails', !run({ points: [{ name: 'A', x: 'Q', y: '0' }] }).ok);
  truthy('nothing applied fails', !run({}).ok);
});
group('dynamics: curvilinear motion', () => {
  const run = (o, sys) => Curv.solve(Object.assign(Curv.defaults(), o), U[sys]);
  { const r = run({ v0: 12, th: 0, h0: 6, land: 'level', yT: 0 }, 'SI'); [{ k: 'Time of flight t', v: 1.106 }, { k: 'Range R (horizontal distance)', v: 13.27 }].forEach((e) => close('Book Example 12.11, sack off a ramp at 12 m/s from 6 m up: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ v0: 25, th: 30, h0: 4, land: 'x', d: 20 }, 'US'); [{ k: 'Landing height h', v: 1.81 }, { k: 'Time of flight t', v: 0.9238 }].forEach((e) => close('Book Example 12.12, chips at 25 ft/s, 30°, 4 ft up, land 20 : ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ find: 'v0', by: 'time', T: 1.5, th: 30, h0: 1, yT: 0 }, 'SI'); [{ k: 'Launch speed v₀', v: 13.38 }, { k: 'Range R (horizontal distance)', v: 17.38 }, { k: 'Maximum height above the landing point', v: 3.28 }].forEach((e) => close('Book Example 12.13, rider off a 30° ramp 1 m up, 1.5 s in th: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'path', ptype: 'poly', c: [0, 0, 0.05, 0], x: 10, v: 6, at: 2 }, 'SI'); [{ k: 'Radius of curvature ρ', v: 28.28 }, { k: 'Normal acceleration a_n', v: 1.273 }, { k: 'Acceleration a', v: 2.37 }].forEach((e) => close('Book Example 12.14, path y = x²/20 at x = 10 m, v = 6 m/s, v: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'path', ptype: 'circle', rho: 2, v: 3.238, at: 1.138 }, 'SI'); [{ k: 'Normal acceleration a_n', v: 5.242 }, { k: 'Acceleration a', v: 5.36 }].forEach((e) => close('Book Example 12.16, box on a 2 m curve, v = 3.24 m/s, a_t = : ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'cyl', cr: [0, 0, 0.1, 0], cth: [0, 0, 0, 1], t: 1 }, 'SI'); [{ k: 'Speed v', v: 0.3606 }, { k: 'Radial acceleration a_r', v: -0.7 }, { k: 'Transverse acceleration a_θ', v: 1.8 }, { k: 'Acceleration a', v: 1.931 }].forEach((e) => close('Book Example 12.18, r = 0.1t² m, θ = t³ rad at t = 1 s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'rel', A: { x: 0, y: 0, v: 18, dir: 240, at: -2, rho: 0, turn: 'left' }, B: { x: 20, y: -5, v: 12, dir: 270, at: 3, rho: 100, turn: 'right' } }, 'SI'); [{ k: 'Relative speed v_B/A', v: 9.69 }, { k: 'Direction of v_B/A', v: 21.74 }, { k: 'Relative acceleration a_B/A', v: 5.32 }].forEach((e) => close('Book Example 12.27, car B on a 100 m curve seen from car A: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: particle kinetics', () => {
  const run = (o, sys) => Pkin.solve(Object.assign(Pkin.defaults(), o), U[sys]);
  { const r = run({ scene: 'block', method: 'force', m: 50, th: 0, P: 400, al: 30, mus: 0.35, muk: 0.3, v0: 0, t: 3 }, 'SI'); [{ k: 'Normal force N', v: 290.5 }, { k: 'Acceleration', v: 5.185 }, { k: 'Velocity at t = 3 s', v: 15.56 }].forEach((e) => close('Book Example 13.1, 50 kg crate towed by 400 N at 30°, μ_k = : ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'block', method: 'force', m: 50, th: 0, P: 150, al: -36.8699, mus: 0.2, muk: 0.2, v0: 0, t: 4 }, 'SI'); [{ k: 'Power of P at the end, P·v', v: 37.44 }, { k: 'Average power of P, U_P/Δt', v: 18.72 }].forEach((e) => close('Book Example 14.7, 50 kg crate pushed by 150 N on a 3-4-5 sl: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'block', method: 'stop', m: 3500, th: 10, P: 0, mus: 0.6, muk: 0.5, v0: -20 }, 'US'); [{ k: 'Distance to stop', v: 19.49 }].forEach((e) => close('Book Example 14.2, 3500 lb car skids down a 10° road from 20: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'block', method: 'work', m: 10, th: 30, P: 400, al: -30, mus: 0, muk: 0, v0: 0, spring: true, k: 30, s1: 0.5, d: 2 }, 'SI'); [{ k: 'Total work ΣU₁₋₂', v: 504.7 }, { k: 'Work of P, U_P', v: 692.8 }, { k: 'Work of the spring U_s', v: -90 }].forEach((e) => close('Book Example 14.1, 10 kg block pushed 2 m up a smooth 30° in: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'pulley', onA: 'hang', mA: 100, mB: 20, nA: 2, nB: 1, find: 'time', t: 1 }, 'SI'); [{ k: 'Cord tension T', v: 327 }, { k: 'Acceleration of A, a_A', v: 3.27 }, { k: 'Acceleration of B, a_B', v: -6.54 }].forEach((e) => close('Book Example 13.5, 100 kg block A on a movable pulley, 20 kg: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'pulley', onA: 'hang', mA: 10, mB: 100, nA: 1, nB: 4, find: 'speedB', vB: 2 }, 'SI'); [{ k: 'Distance B moves', v: 0.8835 }].forEach((e) => close('Book Example 14.6, 10 kg A and 100 kg B on four strands, B r: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'spring', smode: 'launch', sm: 2, sk: 200, sth: 90, d1: 0.7, d2: 0.6, y0: 0.3 }, 'SI'); [{ k: 'Highest point above the ground h', v: 0.9626 }].forEach((e) => close('Book Example 14.4, 2 kg block launched by a 200 N/m spring f: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'curve', m: 1200, r: 100, bank: 20, cmus: 0.2, cv: 18.9 }, 'SI'); [{ k: 'Speed with no friction needed', v: 18.9 }].forEach((e) => close('Book Example 13.6, banking for no friction, r = 100 m, θ = 2: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'circle', kind: 'inside', cm: 60, R: 4, phi0: 90, cv0: 0, phi: 30 }, 'SI'); [{ k: 'Normal force N', v: 1529 }].forEach((e) => close('Book Example 13.9, 60 kg skateboarder on a 4 m circular trac: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'circle', kind: 'cord', cm: 8000, R: 20, phi0: 60, cv0: 0, phi: 15 }, 'SI'); [{ k: 'Speed v', v: 13.52 }, { k: 'Cord tension T', v: 148900 }].forEach((e) => close('Book Example 14.9, 8 Mg plane on a 20 m cable released at 60: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: impact', () => {
  const run = (o, sys) => Impact.solve(Object.assign(Impact.defaults(), o), U[sys]);
  { const r = run({ mode: 'central', find: 'plastic', mA: 15000, mB: 12000, vA1: 1.5, vB1: -0.75, dt: 0.8 }, 'SI'); [{ k: 'Common velocity after coupling v₂', v: 0.5 }, { k: 'Average force between them F_avg', v: 18750 }].forEach((e) => close('Book Example 15.4, 15 Mg boxcar couples with a 12 Mg tank ca: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'central', find: 'v', mA: 6, mB: 18, src: 'drop', hA: 3, vB1: 0, e: 0.5 }, 'US'); [{ k: 'Velocity of A before impact (v_A)₁', v: 13.9 }, { k: 'Velocity of A after impact (v_A)₂', v: -1.737 }, { k: 'Velocity of B after impact (v_B)₂', v: 5.212 }, { k: 'Energy lost', v: 10.13 }].forEach((e) => close('Book Example 15.9, 6 lb bag swings 3 ft down onto an 18 lb b: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'oblique', mA: 1, mB: 2, sA: 3, thA: 30, sB: 1, thB: 225, e: 0.75 }, 'SI'); [{ k: '(v_Ax)₂', v: -1.258 }, { k: '(v_Bx)₂', v: 1.221 }, { k: '(v_Ay)₂', v: 1.5 }, { k: '(v_By)₂', v: -0.7071 }].forEach((e) => close('Book Example 15.11, smooth disks 1 kg and 2 kg, e = 0.75: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'central', find: 'v', mA: 2, mB: 3, vA1: 4, vB1: -2, e: 0.6 }, 'SI'); [{ k: 'Velocity of A after impact (v_A)₂', v: -1.76 }, { k: 'Velocity of B after impact (v_B)₂', v: 1.84 }, { k: 'Energy lost', v: 13.82 }].forEach((e) => close('2 kg at 4 m/s meets 3 kg at 2 m/s head on, e = 0.6: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'bounce', find: 'v', h0: 2, e: 0.8, nb: 5 }, 'SI'); [{ k: 'First rebound height h₁', v: 1.28 }, { k: 'Second rebound height h₂', v: 0.8192 }, { k: 'Total distance travelled', v: 9.111 }].forEach((e) => close('ball dropped 2 m, e = 0.8: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'central', find: 'e', mA: 6, mB: 18, src: 'drop', hA: 3, vB1: 0, vB2m: 5.2125 }, 'US'); [{ k: 'Coefficient of restitution e', v: 0.5 }].forEach((e) => close('e back-solved from Example 15.9,: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'wall', find: 'v', surf: 'wall', v1: 20, th1: 30, e: 0.75 }, 'SI'); [{ k: 'Speed after impact v₂', v: 18.87 }, { k: 'Angle from the surface θ₂', v: 23.41 }].forEach((e) => close('ball at 20 m/s strikes a smooth wall at 30°, e = 0.75: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: planar kinematics of rigid bodies', () => {
  const run = (o, sys) => RbMotion.solve(Object.assign(RbMotion.defaults(), o), U[sys]);
  { const r = run({ mode: 'slider', r: 0.25, l: 0.75, th: 45, beta: 90, e: 0, wAB: -10, aAB: -20 }, 'US'); [{ k: 'Velocity of the slider v_C', v: 2.197 }, { k: 'Angular velocity of BC, ω_BC', v: 2.425 }, { k: 'Angular acceleration of BC, α_BC', v: 27.68 }, { k: 'Acceleration of the slider a_C', v: -13.54 }].forEach((e) => close('Book Examples 16.12 and 16.17, crank 0.25 ft at 10 rad/s cw : ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'bar', L: 0.2, thb: 45, vA: 2, aA: 0 }, 'SI'); [{ k: 'Angular velocity ω', v: 14.14 }, { k: 'Velocity of B, v_B', v: 2 }].forEach((e) => close('Book Example 16.6, 0.2 m link in two slots, v_A = 2 m/s down: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'roll', surf: 'floor', R: 0.5, Ro: 0.5, w: -6, alr: -4, rho: 0.5, phi: 270 }, 'US'); [{ k: 'Acceleration of P, a_P', v: 18 }].forEach((e) => close('Book Example 16.14, disk 0.5 ft rolling at 6 rad/s, 4 rad/s²: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'roll', surf: 'cord', R: 0.5, Ro: 0.75, w: -3, alr: -4, rho: 0.75, phi: 90 }, 'US'); [{ k: 'Acceleration of P, a_P', v: 9.25 }, { k: 'Direction of a_P from +x', v: -71.08 }].forEach((e) => close('Book Example 16.15, spool unwinding at 3 rad/s and 4 rad/s²,: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'fixed', w0: 0, al: 2, by: 'rev', rev: 2, rA: 0.15, rB: 0.4, link: 'belt', rP: 0.4 }, 'SI'); [{ k: 'Speed of P, v_P', v: 1.063 }, { k: 'Acceleration of P, a_P', v: 2.843 }].forEach((e) => close('Book Example 16.2, belt drive from rest at 2 rad/s² for 2 tu: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'fixed', w0: 120, al: 0, by: 'time', tt: 0.2, rA: 0.05, rB: 0.15, link: 'gear', rP: 0.15 }, 'SI'); [{ k: 'Angular velocity of B, ω_B', v: -40 }, { k: 'Speed of P, v_P', v: 6 }].forEach((e) => close('50 mm gear at 120 rad/s drives a 150 mm gear: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ mode: 'fourbar', a4: 0.1, b4: 0.25, c4: 0.2, d4: 0.25, th4: 60, w4: 10, al4: 5 }, 'SI'); [{ k: 'Angular velocity of BC, ω_BC', v: -1.891 }, { k: 'Angular velocity of CD, ω_CD', v: 3.294 }, { k: 'Angular acceleration of CD, α_CD', v: 49.84 }].forEach((e) => close('four-bar 100/250/200/250 mm, crank at 60° and 10 rad/s: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: planar kinetics of rigid bodies', () => {
  const run = (o, sys) => RbForce.solve(Object.assign(RbForce.defaults(), o), U[sys]);
  { const r = run({ scene: 'inertia', parts: [{ t: 'disk', m: 15.71, a: 0.25, b: 0, x: 0, y: 0.25, ang: 0, rm: 'add' }, { t: 'disk', m: 3.927, a: 0.125, b: 0, x: 0, y: 0.25, ang: 0, rm: 'remove' }] }, 'SI'); [{ k: 'Moment of inertia about O, I_O', v: 1.197 }].forEach((e) => close('Book Example 17.3, 250 mm disk with a 125 mm hole, about the: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'inertia', parts: [{ t: 'rod', m: 10, a: 2, b: 0, x: 0, y: -1, ang: 90, rm: 'add' }, { t: 'rod', m: 8, a: 1.5, b: 0, x: 0, y: -2, ang: 0, rm: 'add' }] }, 'US'); [{ k: 'Moment of inertia about O, I_O', v: 1.454 }, { k: 'Moment of inertia about G, I_G', v: 0.2881 }, { k: 'Distance from O to G', v: 1.444 }].forEach((e) => close('Book Example 17.4, T-shaped pendulum of two rods, 10 lb and : ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'car', cm: 2000, h: 0.3, br: 0.75, bf: 1.25, drive: 'rear', cmuk: 0.25 }, 'SI'); [{ k: 'Acceleration a_G', v: 1.593 }, { k: 'Front normal force N_A', v: 6880 }, { k: 'Rear normal force N_B', v: 12740 }].forEach((e) => close('Book Example 17.5, 2 Mg car with spinning rear wheels, μ_k =: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'car', cm: 200, h: 0.7125, br: 0.65, bf: 0.85, drive: 'wheelie' }, 'SI'); [{ k: 'Acceleration a_G', v: 8.949 }, { k: 'Friction needed at the rear, μ_s min', v: 0.9123 }].forEach((e) => close('Book Example 17.6, motorcycle and rider doing a wheelie: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'pend', method: 'force', shape: 'body', pm: 50, kG: 0.6, rG: 0.5, th: 0, w: 0, M: 0 }, 'US'); [{ k: 'Angular acceleration α (+ clockwise)', v: 26.39 }, { k: 'Pin force across OG, O_t', v: -29.51 }, { k: 'Pin force along OG, O_n', v: 0 }].forEach((e) => close('Book Example 17.8, unbalanced 50 lb flywheel released from r: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'pend', method: 'energy', shape: 'rod', pm: 10, pL: 2, th: 0, w: 0, M: 0, th2: 90 }, 'SI'); [{ k: 'Pin force along OG, O_n', v: 245.25 }, { k: 'Angular velocity at θ₂, ω₂', v: 3.836 }].forEach((e) => close('Book Example 17.11, slender rod released level, at the verti: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'drum', method: 'force', Iby: 'k', dm: 60, kO: 0.25, dr: 0.4, bm: 20, Mf: 0 }, 'SI'); [{ k: 'Angular acceleration of the drum α', v: 11.29 }, { k: 'Cord tension T', v: 105.9 }].forEach((e) => close('Book Example 17.10, 60 kg drum: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'drum', method: 'impulse', Iby: 'I', IO: 0.4, dm: 20, dr: 0.2, bm: 6, Mf: 0, dv1: 2, dt: 3 }, 'SI'); [{ k: 'Speed of the block v₂', v: 13.04 }].forEach((e) => close('Book Example 19.4, 6 kg cylinder on a disk: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'roll', method: 'force', surf: 'ground', rm: 50, rk: 0.7, R: 1.25, Ro: 1.25, phi: 0, RM: 35, P: 0, yP: 0, mus: 0.3, muk: 0.25 }, 'US'); [{ k: 'Acceleration of G, a_G', v: 8.05 }, { k: 'Angular acceleration α (+ clockwise)', v: 25.46 }].forEach((e) => close('Book Example 17.13, 50 lb wheel driven by a 35 lb·ft couple,: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ scene: 'roll', method: 'force', surf: 'cord', rm: 8, rk: 0.35, R: 0.5, Ro: 0.5, phi: 90, RM: 0, P: -100, yP: 0.2 }, 'SI'); [{ k: 'Angular acceleration α (+ clockwise)', v: -10.32 }, { k: 'Acceleration of G, a_G', v: -5.161 }].forEach((e) => close('Book Example 17.12, 8 kg spool pulled up its cord by 100 N: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: vibrations', () => {
  const run = (o, sys) => Vib.solve(Object.assign(Vib.defaults(), o), U[sys]);
  { const r = run({ sys: 'tors', body: 'plate', m: 10, a: 0.2, b: 0.3, kt: 1.5, th0: 10 }, 'SI'); [{ k: 'Moment of inertia I_O', v: 0.1083 }, { k: 'Period τ', v: 1.69 }].forEach((e) => close('Book Example 22.2, 10 kg plate 0.2 m × 0.3 m on a rod of 1.5: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'pulley', mb: 10, md: 15, rb: 0.75, rs: 0.75, k: 200, x0: 1, v0: 0 }, 'US'); [{ k: 'Period τ', v: 0.328 }].forEach((e) => close('Book Example 22.4, 10 lb block on a 15 lb disk, k = 200 lb/f: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'pulley', mb: 10, md: 5, rb: 0.15, rs: 0.15, k: 200, x0: 40, v0: 0 }, 'SI'); [{ k: 'Natural frequency ω_n', v: 4 }, { k: 'Period τ', v: 1.571 }].forEach((e) => close('Book Example 22.6, 10 kg block on a 5 kg disk, k = 200 N/m: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'sm', m: 20, k: 800, n: 4, arr: 'parallel', vert: true, exc: 'support', w0: 8, d0: 10, x0: 0, v0: 0 }, 'SI'); [{ k: 'Natural frequency ω_n', v: 12.65 }, { k: 'Steady-state amplitude X', v: 16.67 }].forEach((e) => close('Book Example 22.7, 20 kg on four 800 N/m springs, floor 10 s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'sm', m: 30, k: 200, n: 4, arr: 'parallel', vert: true, damp: 'z', zeta: 0.15, exc: 'unb', m0: 4, e: 60, w0: 10, x0: 0, v0: 0 }, 'SI'); [{ k: 'Force amplitude F₀', v: 24 }, { k: 'Natural frequency ω_n', v: 5.164 }, { k: 'Steady-state amplitude X', v: 10.67 }].forEach((e) => close('Book Example 22.8, 30 kg motor on four 200 N/m springs, 4 kg: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'sm', m: 10, k: 1000, n: 1, x0: 50, v0: 0.5 }, 'SI'); [{ k: 'Natural frequency ω_n', v: 10 }, { k: 'Period τ', v: 0.6283 }, { k: 'Amplitude C', v: 70.71 }].forEach((e) => close('10 kg on 1000 N/m from x₀ = 50 mm, v₀ = 0.5 m/s: ' + e.k, out(r, e.k), e.v)); }
  { const r = run({ sys: 'sm', m: 10, k: 1000, n: 1, x0: 50, v0: 0.5, damp: 'c', c: 40 }, 'SI'); [{ k: 'Critical damping c_c', v: 200 }, { k: 'Damping factor ζ = c/c_c', v: 0.2 }, { k: 'Damped natural frequency ω_d', v: 9.798 }].forEach((e) => close('the same with c = 40 N·s/m: ' + e.k, out(r, e.k), e.v)); }
});

group('dynamics: 3D rigid bodies', () => {
  const rot = (u, w, wd, o) => Object.assign({ ux: u[0], uy: u[1], uz: u[2], px: 0, py: 0, pz: 0, w, wd, roll: 'no', dx: 0, dy: 1, dz: 0 }, o || {});
  const run = (o, sys) => Rb3d.solve(Object.assign(Rb3d.defaults(), o), U[sys || 'SI']);
  let r = Rb3d.solve(Rb3d.defaults(), U.US);
  close('20-3 v_x', out(r, 'v_P_x'), -5.20); close('20-3 v_z', out(r, 'v_P_z'), 20.8); close('20-3 a_x', out(r, 'a_P_x'), -24.1); close('20-3 a_y', out(r, 'a_P_y'), -13.3); close('20-3 a_z', out(r, 'a_P_z'), -7.20);
  r = run({ rots: [rot([0, 0, 1], 1, 0), rot([0, 1, 1], 60, 0)] });
  close('20-10 ω_z', out(r, 'ω_z'), 43.4); close('20-10 α_x', out(r, 'α_x'), -42.4);
  r = run({ rots: [rot([0, 0, 1], 8, 0), rot([0, -1, -1], 0, 0, { roll: 'yes' })], P: { x: 0, y: 0, z: 0.16 * Math.SQRT1_2 } });
  close('20-5 ω_y', out(r, 'ω_y'), -8); close('20-5 α_x', out(r, 'α_x'), 64); close('20-5 v_A', out(r, 'v_P_x'), -0.905); close('20-5 a_A,z', out(r, 'a_P_z'), -7.24);
  r = run({ rots: [rot([0, 0, 1], 8, 2), rot([0, 1, 0], 4, 0, { px: 3, py: -1, pz: 1.5 })], P: { x: 4, y: -1, z: 1.5 } }, 'US');
  close('20-54 v_x', out(r, 'v_P_x'), 8); close('20-54 v_z', out(r, 'v_P_z'), -4); close('20-54 a_x', out(r, 'a_P_x'), -270); close('20-54 a_y', out(r, 'a_P_y'), 72);
  // a point sliding along a rotating rod: Coriolis term 2ω × v_rel
  r = run({ rots: [rot([0, 0, 1], 2, 0)], P: { x: 1, y: 0, z: 0 }, relOn: true, rel: { vx: 3, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 } });
  close('collar on a rod: Coriolis a_y = 2ωv', out(r, 'a_P_y'), 12); close('collar on a rod: a_x = −ω²r', out(r, 'a_P_x'), -4);
  r = run({ mode: 'mom', rots: [rot([1, 0, 0], 6, 0), rot([0, 0, 1], 15, 0, { py: 0.6 })], parts: [{ t: 'disk', m: 10, x: 0, y: 0.6, z: 0, ax: 'z', r: 0.15 }] });
  close('21-26 H_O,x', out(r, 'H_O,x'), 21.9); close('21-26 H_O,z', out(r, 'H_O,z'), 1.69); close('21-26 T', out(r, 'Kinetic energy T'), 78.5);
  r = run({ mode: 'euler', rots: [rot([0, -1, 0], 8, 0)], parts: [{ t: 'disk', m: 40, x: 0, y: 0, z: -0.02, ax: 'y', r: 0.25 }], grav: true, sup: 'brg', A: { x: 0, y: -0.75, z: 0 }, B: { x: 0, y: 1.25, z: 0 }, thrust: 'A' });
  close('21-45 A', out(r, 'A_z'), 277); close('21-45 B', out(r, 'B_z'), 166);
  r = run({ mode: 'euler', rots: [rot([0, 1, 0], 6, 0), rot([0, 0, 1], 20, 0)], parts: [{ t: 'disk', m: 20, x: 0, y: 0, z: 0, ax: 'z', r: 0.15 }], grav: false });
  close('21-71 gyroscopic moment', out(r, 'Required ΣM_G,x'), 27.0);
  r = run({ mode: 'inertia', parts: [{ t: 'rod', m: 2, x: 0, y: 0, z: 0, x2: 0, y2: 0.5, z2: 0 }, { t: 'rod', m: 2, x: 0, y: 0.5, z: 0, x2: 0.5, y2: 0.5, z2: 0 }] });
  close('bent rod I_xx', out(r, 'I_xx about O'), 2 / 3); close('bent rod I_xy', out(r, 'I_xy about O'), 0.25);
  r = run({ mode: 'inertia', parts: [{ t: 'cyl', m: 3, x: 0, y: 0, z: 0, ax: 'x', r: 0.1, h: 0.6 }] });
  close('cylinder I_yy = m(3r² + h²)/12', out(r, 'I_yy about G'), 3 * (0.03 + 0.36) / 12); close('cylinder I_xx = mr²/2', out(r, 'I_xx about G'), 0.015);
  r = run({ mode: 'gyro', gy: { unk: 'spin', m: 0.09, kz: 0.018, kt: 0.035, mom: 'weight', rG: 0.06, M: 0, th: 45, prec: 0.5, spin: 1 } });
  close('21-69 spin', out(r, 'Spin ψ̇'), 3630); const spin69 = out(r, 'Spin ψ̇');
  r = run({ mode: 'gyro', gy: { unk: 'M', m: 50, kz: 0.2, kt: 0.3, mom: 'given', rG: 0, M: 0, th: 90, prec: 2, spin: 100 } }, 'US');
  close('21-62 M_x', out(r, 'Moment M_x'), 12.4);
  r = run({ mode: 'gyro', gy: { unk: 'theta', m: 0.09, kz: 0.018, kt: 0.035, mom: 'weight', rG: 0.06, M: 0, th: 0, prec: 0.5, spin: spin69 } });
  close('21-69 reversed: θ from the spin', out(r, 'Angle θ'), 45);
  r = run({ mode: 'free', fr: { m: 1800, kz: 0.8, kt: 1.2, th: 5, given: 'spin', spin: 6, prec: 1, H: 1 } });
  close('21-77 H_G', out(r, 'Angular momentum H_G'), 12.5e3);
  r = run({ mode: 'free', ru: 'rev/h', fr: { m: 1600, kz: 1.2, kt: 1.8, th: 20, given: 'prec', spin: 1, prec: 2, H: 1 } });
  close('21-74 spin', out(r, 'Spin ψ̇'), 2.35);
  truthy('rolling along the contact line fails', !run({ rots: [rot([0, 0, 1], 8, 0), rot([0, 1, 0], 0, 0, { roll: 'yes' })] }).ok);
});
group('dynamics: unit switching', () => {
  [[RbForce, { scene: 'drum', method: 'energy' }, 'Speed of the block v₂', 3.28084], [RbForce, { scene: 'roll', method: 'force' }, 'Acceleration of G, a_G', 3.28084], [Pkin, {}, null, 1], [RbMotion, {}, null, 1]].forEach(([Mod, o, k, f]) => {
    const st = Object.assign(Mod.defaults(), o), a = Mod.solve(st, U.SI);
    Mod.convertState(st, 'SI', 'US'); const b = Mod.solve(st, U.US);
    Mod.convertState(st, 'US', 'SI'); const c = Mod.solve(st, U.SI);
    const key = k || a.out[0].k;
    if (k) close(`${key} in U.S. units`, out(b, key), out(a, key) * f, 2e-3);
    close(`${key} after the round trip`, out(c, key), out(a, key), 1e-4);
  });
});

groups.forEach(([name, fn]) => { if (filter && !name.toLowerCase().includes(filter)) return; console.log(name); fn(); });
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
