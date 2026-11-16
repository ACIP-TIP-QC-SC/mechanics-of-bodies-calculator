/* Physics checks against textbook answers (Hibbeler). Run: node tests/run.js [filter]
 * Textbook answers are rounded to 3 significant figures, so the tolerance is 0.5 %. */
'use strict';
const path = require('path');
const R = (p) => require(path.join(__dirname, '..', p));
const Core = R('shared/core.js'), Beam = R('shared/beam.js'), Internal = R('st/internal.js');
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
  // inclined load: 10 kN at 60° at midspan of 6 m → A_x = −5, N = +5 left of the load
  b = Beam.solve({ L: 6, supports: SS(6), loads: [{ kind: 'point', x: 3, P: 10, ang: 60 }] });
  close('inclined A_x', b.reactions[0].Rx, -5, 1e-9); close('inclined N', b.at(1).N, 5, 1e-9); close('inclined N right', b.at(4).N, 0, 1e-9);
  close('inclined M', b.ext.Mmax.M, 10 * Math.sin(Math.PI / 3) * 6 / 4, 1e-9);
  // compound beam: fixed at 0, hinge at 4, roller at 8, 12 kN at 6 → B_y = 6, A_y = 6, M_A = −24 (clockwise reaction = hogging at wall)
  b = Beam.solve({ L: 8, supports: [{ type: 'fixed', x: 0 }, { type: 'roller', x: 8 }], loads: [{ kind: 'point', x: 6, P: 12 }], hinges: [4] });
  close('hinge B_y', b.reactions[1].Ry, 6, 1e-9); close('hinge A_y', b.reactions[0].Ry, 6, 1e-9); close('hinge M at wall', b.at(0, 'R').M, -24, 1e-9); close('hinge M = 0', b.at(4).M, 0, 1e-9);
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

groups.forEach(([name, fn]) => { if (filter && !name.toLowerCase().includes(filter)) return; console.log(name); fn(); });
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
