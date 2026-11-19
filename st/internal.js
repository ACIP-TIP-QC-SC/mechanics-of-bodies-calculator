/* =====================================================================
 * STATICS · Internal Forces (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapter 7.
 *   - internal loadings at a cut and shear / moment diagrams (beam engine)
 *   - cable with concentrated loads
 *   - cable with a load uniform along the horizontal (parabola)
 *   - cable under its own weight (catenary)
 *   - pipe assembly in space: the six internal loadings at a section through a point (Probs. 7-42 to 7-44)
 * State values are in the units shown beside each input: forces in the
 * chosen force unit `fu`, lengths in m or ft. Statics is linear, so the
 * numbers are used directly as one consistent set of units.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const Beam = root.Beam || require('../shared/beam.js');
  const { fmt, sumStr, fail, Steps, bisect } = Core;
  const RAD = 180 / Math.PI;
  const LETTERS = 'ABCDEFGHJK';

  function defaults() {
    return {
      mode: 'diagrams', fu: 'kN',
      L: 9, supports: [{ type: 'pin', x: 0 }, { type: 'roller', x: 9 }],
      loads: [{ kind: 'point', x: 3, P: 6, ang: 90 }, { kind: 'dist', x1: 3, x2: 9, w1: 2, w2: 2 }],
      hinges: [], cut: 4.5, side: 'R', defl: true, play: 'deflect',
      cab: { span: 18, hB: 0, loads: [{ x: 3, P: 4 }, { x: 8, P: 15 }, { x: 16, P: 3 }], known: 'sag', at: 2, sag: 12, FH: 6 },
      par: { L: 100, level: true, hA: 10, hB: 10, w0: 5, given: 'sag', Tmax: 700, len: 103 },
      pp: { pipe: [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1.5, z: 0 }], B: { x: 0, y: 0, z: 0 }, axis: 'x',
        loads: [{ x: 1, y: 1.5, z: 0, Fx: 100, Fy: -200, Fz: -300 }, { x: 1, y: 0, z: 0, Fx: 100, Fy: 500, Fz: 0 }], couples: [] },
      cat: { L: 20, h: 6, w0: 5, given: 'sag', len: 24, level: true, hA: 4, hB: 9 },
    };
  }
  const beamModel = (st) => ({ L: st.L, supports: st.supports, loads: st.loads, hinges: st.hinges });

  function solve(st, U) {
    if (st.mode === 'cableP') return cablePoint(st, U);
    if (st.mode === 'cableU') return cableUniform(st, U);
    if (st.mode === 'catenary') return catenary(st, U);
    if (st.mode === 'pipe3d') return pipe3d(st, U);
    return beam(st, U);
  }

  /* ------------------------------------------------------------------ */
  /* Beams                                                              */
  /* ------------------------------------------------------------------ */
  function beam(st, U) {
    const F = st.fu, Lu = U.len, FL = `${F}·${Lu}`;
    const b = Beam.solve(beamModel(st), { F, Lu });
    if (!b.ok) { const r = fail(b.err, b.warn); r.det = b.det; return r; }
    const cutMode = st.mode === 'cut';
    const cx = Math.min(b.L, Math.max(0, st.cut));
    const side = b.jumpAt(cx) ? st.side : undefined;
    const cut = b.cutSteps(cx, side);
    const out = [], e = b.ext;
    const cutRows = [
      { k: `Normal force N at x = ${fmt(cx)} ${Lu}`, v: cut.N, u: F, hl: cutMode },
      { k: `Shear force V at x = ${fmt(cx)} ${Lu}`, v: cut.V, u: F, hl: cutMode },
      { k: `Bending moment M at x = ${fmt(cx)} ${Lu}`, v: cut.M, u: FL, hl: cutMode },
    ];
    if (cutMode) out.push(...cutRows);
    b.reactions.forEach((R) => {
      if (R.type !== 'roller') out.push({ k: `Reaction ${R.label}_x (→ positive)`, v: R.Rx, u: F });
      out.push({ k: `Reaction ${R.label}_y (↑ positive)`, v: R.Ry, u: F });
      if (R.type === 'fixed') out.push({ k: `Reaction M_${R.label} (↺ positive)`, v: R.M, u: FL });
    });
    out.push({ k: 'Largest shear |V|', v: Math.abs(e.Vabs.V), u: F, hl: !cutMode });
    out.push({ k: 'Maximum moment (most positive)', v: e.Mmax.M, u: FL, hl: !cutMode && e.Mmax.M > 0 });
    out.push({ k: '  located at x', v: e.Mmax.x, u: Lu });
    out.push({ k: 'Minimum moment (most negative)', v: e.Mmin.M, u: FL, hl: !cutMode && e.Mmin.M < 0 });
    out.push({ k: '  located at x ', v: e.Mmin.x, u: Lu });
    const roots = e.zeros.filter((z) => z.kind === 'root');
    if (roots.length) out.push({ k: 'Shear is zero at x', v: roots.map((z) => fmt(z.x)).join(', '), u: Lu });
    if (b.hasAxial) out.push({ k: 'Largest normal force (tension positive)', v: Math.abs(e.Nmax.N) >= Math.abs(e.Nmin.N) ? e.Nmax.N : e.Nmin.N, u: F });
    if (!cutMode) out.push(...cutRows);
    if (b.defl && !b.defl.flat) {
      out.push({ k: 'Largest deflection is at x', v: b.defl.max.x, u: Lu });
      out.push({ k: 'EI × largest deflection (↑ positive)', v: b.defl.max.y, u: `${F}·${Lu}³` });
    }
    const steps = cutMode
      ? b.stepsReact.concat(cut.steps)
      : b.stepsReact.concat(b.stepsSeg, b.stepsCheck, b.stepsMax);
    return {
      ok: true, err: [], warn: b.warn.slice(),
      status: b.det.cls === 'partial' ? { cls: 'warn', text: 'Partially constrained' } : { cls: 'ok', text: 'Statically determinate' },
      out, steps, geo: { kind: 'beam', beam: b, cut, cutMode, F, Lu, FL },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Cable with concentrated loads                                      */
  /* ------------------------------------------------------------------ */
  function cablePoint(st, U) {
    const c = st.cab, F = st.fu, Lu = U.len, S = Steps();
    const err = [];
    const L = c.span, hB = c.hB || 0;
    if (!(L > 0)) return fail('The span must be greater than zero.');
    const loads = (c.loads || []).slice();
    if (!loads.length) return fail('Add at least one load on the cable.');
    loads.forEach((q, i) => {
      if (!(q.P > 0)) err.push(`Load ${i + 1} must be a downward force greater than zero.`);
      if (!(q.x > 0 && q.x < L)) err.push(`Load ${i + 1} must lie between the supports (0 < x < ${fmt(L)}).`);
      if (i > 0 && !(q.x > loads[i - 1].x)) err.push(`Load ${i + 1} must be to the right of load ${i}. List the loads from left to right.`);
    });
    if (err.length) return fail(err);
    const n = loads.length, name = (i) => LETTERS[i] || 'P' + i, last = name(n + 1);
    const sumP = loads.reduce((s, q) => s + q.P, 0);
    const momB = loads.reduce((s, q) => s + q.P * (L - q.x), 0);
    const momTerms = loads.map((q) => ({ v: 1, txt: `${fmt(q.P)}(${fmt(L - q.x)})` }));
    let FH, Ay;
    const k = Math.min(n, Math.max(1, Math.round(c.at || 1)));
    const xk = loads[k - 1].x, sk = c.sag;
    const leftMom = loads.slice(0, k - 1).reduce((s, q) => s + q.P * (xk - q.x), 0);
    const leftTerms = loads.slice(0, k - 1).map((q) => ({ v: 1, txt: `${fmt(q.P)}(${fmt(xk - q.x)})` }));
    S.add({ t: 'Free-body diagram of the whole cable', n: `The supports give A_x, A_y, ${last}_x and ${last}_y. A flexible cable carries tension only, so each straight segment has a constant tensile force.`, f: '→+ ΣF_x = 0', s: `−A_x + ${last}_x = 0`, r: `A_x = ${last}_x = F_H (the horizontal component is the same everywhere)` });
    if (c.known === 'FH') {
      FH = c.FH;
      if (!(FH > 0)) return fail('The horizontal force F_H must be greater than zero.');
      Ay = (momB - FH * hB) / L;
      S.add({ t: `Moments about ${last} for the whole cable`, f: `↺+ ΣM_${last} = 0`, s: `−A_y(${fmt(L)})${hB ? ` − ${fmt(FH)}(${fmt(hB)})` : ''} + ${sumStr(momTerms)} = 0`, r: `A_y = ${fmt(Ay)} ${F}` });
    } else {
      if (!(sk > 0)) return fail(`The sag at point ${name(k)} must be greater than zero.`);
      // −A_y·L − F_H·hB + ΣP(L − x) = 0 ;  −A_y·x_k + F_H·s_k + Σ_left P(x_k − x) = 0
      const det = L * sk + hB * xk;
      if (Math.abs(det) < 1e-12) return fail('This sag puts the known point on the line through the supports, so the cable would be straight. Enter a larger sag.');
      FH = (momB * xk - leftMom * L) / det;
      Ay = (momB - FH * hB) / L;
      if (!hB) {
        S.add({ t: `Moments about ${last} for the whole cable`, f: `↺+ ΣM_${last} = 0`, s: `−A_y(${fmt(L)}) + ${sumStr(momTerms)} = 0`, r: `A_y = ${fmt(Ay)} ${F}` });
        S.add({ t: `Section the cable just to the right of ${name(k)} and take moments about ${name(k)}`, n: `The sag at ${name(k)} is known (${fmt(sk)} ${Lu}), so this equation gives the horizontal force.`, f: `↺+ ΣM_${name(k)} = 0 (left part)`, s: `F_H(${fmt(sk)}) − ${fmt(Ay)}(${fmt(xk)})${leftTerms.length ? ' + ' + sumStr(leftTerms) : ''} = 0`, r: `F_H = ${fmt(FH)} ${F}` });
      } else {
        S.add({ t: 'Two moment equations, solved together', n: `The supports are at different levels, so both equations contain A_y and F_H. The sag at ${name(k)} is ${fmt(sk)} ${Lu} below A.`, f: `↺+ ΣM_${last} = 0 (whole cable);   ↺+ ΣM_${name(k)} = 0 (left part)`, s: `−A_y(${fmt(L)}) − F_H(${fmt(hB)}) + ${sumStr(momTerms)} = 0;   F_H(${fmt(sk)}) − A_y(${fmt(xk)})${leftTerms.length ? ' + ' + sumStr(leftTerms) : ''} = 0`, r: `A_y = ${fmt(Ay)} ${F},  F_H = ${fmt(FH)} ${F}` });
      }
    }
    if (!(FH > 0)) return fail('These values give a horizontal force that is not a pull. Check the sag and the loads.');
    const By = sumP - Ay;
    S.add({ t: 'Sum of vertical forces', f: '+↑ ΣF_y = 0', s: `${fmt(Ay)} − ${loads.map((q) => fmt(q.P)).join(' − ')} + ${last}_y = 0`, r: `${last}_y = ${fmt(By)} ${F}` });
    // points: sag below A (down positive)
    const pts = [{ name: 'A', x: 0, sag: 0 }];
    loads.forEach((q, j) => {
      const m = loads.slice(0, j).reduce((s, p) => s + p.P * (q.x - p.x), 0);
      pts.push({ name: name(j + 1), x: q.x, sag: (Ay * q.x - m) / FH, P: q.P });
    });
    pts.push({ name: last, x: L, sag: -hB });
    S.add({
      t: 'Sag at each load', n: 'Moments about each load point for the part of the cable to its left.',
      f: 'y = [A_y·x − Σ P(x − x_P)] / F_H   (below support A)',
      table: { head: ['Point', `x (${Lu})`, `Load (${F})`, `Sag below A (${Lu})`], rows: pts.map((p) => [p.name, fmt(p.x), p.P ? fmt(p.P) : '—', fmt(p.sag)]) },
    });
    const segs = [];
    let Vy = Ay, len = 0, bad = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.sag - a.sag; // dy > 0: going down
      const T = Math.hypot(FH, Vy), ang = Math.atan2(Vy, FH) * RAD, s = Math.hypot(dx, dy);
      segs.push({ name: a.name + b.name, a, b, T, Vy, ang, len: s });
      len += s;
      if (Math.abs(dy / dx - Vy / FH) > 1e-6 * (1 + Math.abs(Vy / FH))) bad = true;
      if (b.P) Vy -= b.P;
    }
    if (bad) return fail('The cable geometry is not consistent. Check the inputs.');
    S.add({
      t: 'Tension in each segment', n: 'At each point the vertical component changes by the load; the horizontal component stays F_H.',
      f: 'tan θ = T_y / F_H;   T = F_H / cos θ = √(F_H² + T_y²)',
      table: { head: ['Segment', `T_y (${F})`, 'θ from horizontal (°)', `T (${F})`, `Length (${Lu})`], rows: segs.map((g) => [g.name, fmt(Math.abs(g.Vy)), fmt(Math.abs(g.ang)), fmt(g.T), fmt(g.len)]) },
    });
    const mx = segs.reduce((m, g) => (g.T > m.T ? g : m), segs[0]);
    S.add({ t: 'Maximum tension and cable length', n: 'The largest tension is in the steepest segment.', r: `T_max = ${fmt(mx.T)} ${F} in segment ${mx.name};  total length = ${fmt(len)} ${Lu}` });
    const warn = [];
    if (pts.some((p, i) => i > 0 && i < pts.length - 1 && p.sag <= Math.min(0, -hB) + 1e-12)) warn.push('A load point is at or above a support. Check that the sag is what you intended.');
    const out = [
      { k: 'Horizontal force F_H', v: FH, u: F, hl: true },
      { k: 'Reaction A_y', v: Ay, u: F }, { k: `Reaction ${last}_y`, v: By, u: F },
    ];
    segs.forEach((g) => out.push({ k: `Tension T_${g.name}`, v: g.T, u: F }));
    segs.forEach((g) => out.push({ k: `Angle of ${g.name} from horizontal`, v: Math.abs(g.ang), u: '°' }));
    pts.slice(1, -1).forEach((p) => out.push({ k: `Sag at ${p.name} (below A)`, v: p.sag, u: Lu }));
    out.push({ k: 'Maximum tension', v: mx.T, u: F, hl: true }, { k: 'Cable length', v: len, u: Lu });
    return { ok: true, err: [], warn, status: { cls: warn.length ? 'warn' : 'ok', text: warn.length ? 'Check geometry' : 'OK' }, out, steps: S.list, geo: { kind: 'cableP', pts, segs, FH, Ay, By, L, hB, F, Lu, last, Tmax: mx.T } };
  }

  /* ------------------------------------------------------------------ */
  /* Cable with a load uniform along the horizontal (parabola)          */
  /* ------------------------------------------------------------------ */
  const parLen = (a, k) => (k * a < 1e-9 ? a : (a / 2) * Math.sqrt(1 + k * k * a * a) + Math.asinh(k * a) / (2 * k));
  function cableUniform(st, U) {
    const p = st.par, F = st.fu, Lu = U.len, WL = `${F}/${Lu}`, S = Steps();
    const L = p.L, w = p.w0;
    if (!(L > 0)) return fail('The span must be greater than zero.');
    if (!(w > 0)) return fail('The distributed load w₀ must be greater than zero.');
    let hA = p.hA, hB = p.level ? p.hA : p.hB;
    const given = p.level ? p.given : 'sag';
    if (given === 'Tmax') {
      const ratio = (2 * p.Tmax) / (w * L);
      if (!(p.Tmax > 0) || ratio <= 1) return fail(`The cable must carry at least half of the load vertically, so T_max must exceed w₀L/2 = ${fmt((w * L) / 2)} ${F}.`);
      hA = hB = L / (4 * Math.sqrt(ratio * ratio - 1));
      S.add({ t: 'Sag from the allowable tension', n: 'Level supports: the lowest point is at midspan and the maximum tension is at the supports.', f: 'T_max = (w₀L/2)·√(1 + (L/4h)²)   →   h = L / (4·√((2T_max / w₀L)² − 1))', s: `h = ${fmt(L)} / (4·√((2·${fmt(p.Tmax)} / (${fmt(w)}·${fmt(L)}))² − 1))`, r: `h = ${fmt(hA)} ${Lu}` });
    } else if (given === 'len') {
      if (!(p.len > L)) return fail(`The cable must be longer than the span (${fmt(L)} ${Lu}).`);
      if (p.len > 20 * L) return fail('The cable is more than 20 times the span. Enter a shorter cable.');
      const lenOf = (h) => 2 * parLen(L / 2, (8 * h) / (L * L));
      hA = hB = bisect((h) => lenOf(h) - p.len, L * 1e-7, L * 50);
      S.add({ t: 'Sag from the cable length', n: 'Level supports. The length equation is solved for h by trial and error.', f: 'ℒ = (L/2)·[√(1 + (4h/L)²) + (L/4h)·sinh⁻¹(4h/L)]', s: `${fmt(p.len)} = (${fmt(L)}/2)·[√(1 + (4h/${fmt(L)})²) + (${fmt(L)}/4h)·sinh⁻¹(4h/${fmt(L)})]`, r: `h = ${fmt(hA)} ${Lu}` });
    }
    if (!(hA > 0) || !(hB > 0)) return fail('The sag below each support must be greater than zero.');
    const xA = L / (1 + Math.sqrt(hB / hA)), xB = L - xA;
    const FH = (w * xA * xA) / (2 * hA), k = w / FH;
    const level = Math.abs(hA - hB) < 1e-12 * hA;
    S.add({ t: 'Shape of the cable', n: 'Origin at the lowest point, where the cable is horizontal. A load that is uniform along the horizontal gives a parabola.', f: 'd²y/dx² = w₀ / F_H   →   y = w₀x² / (2F_H)' });
    if (level) {
      S.add({ t: 'Horizontal force from the sag', n: 'Boundary condition: y = h at x = L/2.', f: 'F_H = w₀L² / (8h)', s: `F_H = ${fmt(w)}(${fmt(L)})² / (8·${fmt(hA)})`, r: `F_H = ${fmt(FH)} ${F}` });
    } else {
      S.add({ t: 'Lowest point of the cable', n: 'Both supports lie on the same parabola: h_A = w₀x_A²/(2F_H) and h_B = w₀x_B²/(2F_H), with x_A + x_B = L.', f: 'x_A = L / (1 + √(h_B / h_A))', s: `x_A = ${fmt(L)} / (1 + √(${fmt(hB)} / ${fmt(hA)}))`, r: `x_A = ${fmt(xA)} ${Lu} from A,  x_B = ${fmt(xB)} ${Lu} from B` });
      S.add({ t: 'Horizontal force', f: 'F_H = w₀x_A² / (2h_A)', s: `F_H = ${fmt(w)}(${fmt(xA)})² / (2·${fmt(hA)})`, r: `F_H = ${fmt(FH)} ${F}` });
    }
    const TA = Math.hypot(FH, w * xA), TB = Math.hypot(FH, w * xB), thA = Math.atan2(w * xA, FH) * RAD, thB = Math.atan2(w * xB, FH) * RAD;
    const Tmax = Math.max(TA, TB), xm = TA >= TB ? xA : xB, at = level ? 'both supports' : TA >= TB ? 'support A' : 'support B';
    S.add({ t: 'Maximum tension', n: 'T = F_H / cos θ is largest where the cable is steepest, at the higher support. Its vertical component is the load carried between the lowest point and that support.', f: 'tan θ_max = w₀x / F_H;   T_max = √(F_H² + (w₀x)²)', s: `tan θ_max = ${fmt(w)}(${fmt(xm)}) / ${fmt(FH)};   T_max = √(${fmt(FH)}² + (${fmt(w)}·${fmt(xm)})²)`, r: `θ_max = ${fmt(Math.max(thA, thB))}°,  T_max = ${fmt(Tmax)} ${F} at ${at}` });
    const len = parLen(xA, k) + parLen(xB, k);
    S.add({ t: 'Length of the cable', n: 'Integrate ds = √(1 + (dy/dx)²) dx from the lowest point to each support and add the two parts.', f: 's(a) = (a/2)·√(1 + (w₀a/F_H)²) + (F_H / 2w₀)·sinh⁻¹(w₀a / F_H)', s: `s(${fmt(xA)}) = ${fmt(parLen(xA, k))} ${Lu};   s(${fmt(xB)}) = ${fmt(parLen(xB, k))} ${Lu}`, r: `ℒ = ${fmt(len)} ${Lu}` });
    const out = [
      { k: 'Horizontal force F_H (tension at the lowest point)', v: FH, u: F, hl: true },
      { k: 'Maximum tension T_max', v: Tmax, u: F, hl: true },
      { k: 'Tension at A', v: TA, u: F }, { k: 'Tension at B', v: TB, u: F },
      { k: 'Cable angle at A', v: thA, u: '°' }, { k: 'Cable angle at B', v: thB, u: '°' },
      { k: 'Sag below A', v: hA, u: Lu }, { k: 'Sag below B', v: hB, u: Lu },
      { k: 'Lowest point, distance from A', v: xA, u: Lu },
      { k: 'Cable length', v: len, u: Lu },
      { k: 'Total load carried w₀L', v: w * L, u: F },
    ];
    const warn = [];
    if (Math.max(hA, hB) / L > 0.5) warn.push('The sag is more than half the span, which is unusual for a cable loaded uniformly along the horizontal.');
    const y = (x) => (k * (x - xA) * (x - xA)) / 2 - hA; // elevation relative to A
    const T = (x) => Math.hypot(FH, w * (x - xA));
    return { ok: true, err: [], warn, status: { cls: warn.length ? 'warn' : 'ok', text: warn.length ? 'Check geometry' : 'OK' }, out, steps: S.list, geo: { kind: 'cableU', L, hA, hB, xA, FH, w, y, T, Tmax, TA, TB, F, Lu, WL, len } };
  }

  /* ------------------------------------------------------------------ */
  /* Cable under its own weight (catenary), level or uneven supports    */
  /* ------------------------------------------------------------------ */
  function catenary(st, U) {
    const p = st.cat, F = st.fu, Lu = U.len, WL = `${F}/${Lu}`, S = Steps();
    const L = p.L, w = p.w0;
    if (!(L > 0)) return fail('The span must be greater than zero.');
    if (!(w > 0)) return fail('The weight per unit length w₀ must be greater than zero.');
    let c, h;
    S.add({ t: 'Shape of the cable', n: 'Origin at the lowest point. The weight is uniform along the cable itself, which gives a catenary.', f: 'y = (F_H / w₀)·[cosh(w₀x / F_H) − 1];   s = (F_H / w₀)·sinh(w₀x / F_H)' });
    if (p.level === false) return catenaryUneven(p, F, Lu, WL, S, L, w);
    if (p.given === 'len') {
      if (!(p.len > L)) return fail(`The cable must be longer than the span (${fmt(L)} ${Lu}).`);
      if (p.len > 20 * L) return fail('The cable is more than 20 times the span. Enter a shorter cable.');
      c = Math.exp(bisect((lc) => 2 * Math.exp(lc) * Math.sinh(L / (2 * Math.exp(lc))) - p.len, Math.log(L / 1200), Math.log(L * 1e6)));
      h = c * (Math.cosh(L / (2 * c)) - 1);
      S.add({ t: 'Horizontal force from the cable length', n: 'Boundary condition: s = ℒ/2 at x = L/2. Solved for F_H by trial and error.', f: 'ℒ/2 = (F_H / w₀)·sinh(w₀L / 2F_H)', s: `${fmt(p.len / 2)} = (F_H / ${fmt(w)})·sinh(${fmt(w)}·${fmt(L)} / 2F_H)`, r: `F_H = ${fmt(c * w)} ${F}` });
      S.add({ t: 'Sag', f: 'h = (F_H / w₀)·[cosh(w₀L / 2F_H) − 1]', s: `h = (${fmt(c * w)} / ${fmt(w)})·[cosh(${fmt(w)}·${fmt(L)} / (2·${fmt(c * w)})) − 1]`, r: `h = ${fmt(h)} ${Lu}` });
    } else {
      h = p.h;
      if (!(h > 0)) return fail('The sag must be greater than zero.');
      if (h > 20 * L) return fail('The sag is more than 20 times the span. Enter a smaller sag.');
      c = Math.exp(bisect((lc) => -(Math.exp(lc) * (Math.cosh(L / (2 * Math.exp(lc))) - 1) - h), Math.log(L / 1200), Math.log(L * 1e6)));
      S.add({ t: 'Horizontal force from the sag', n: 'Boundary condition: y = h at x = L/2. Solved for F_H by trial and error.', f: 'h = (F_H / w₀)·[cosh(w₀L / 2F_H) − 1]', s: `${fmt(h)} = (F_H / ${fmt(w)})·[cosh(${fmt(w)}·${fmt(L)} / 2F_H) − 1]`, r: `F_H = ${fmt(c * w)} ${F}` });
    }
    const FH = c * w, half = c * Math.sinh(L / (2 * c)), len = 2 * half;
    const slope = Math.sinh(L / (2 * c)), th = Math.atan(slope) * RAD, Tmax = FH * Math.cosh(L / (2 * c));
    S.add({ t: 'Equation of the curve', f: 'y = (F_H / w₀)·[cosh(w₀x / F_H) − 1]', r: `y = ${fmt(c)}·[cosh(${fmt(1 / c)}x) − 1] ${Lu}` });
    S.add({ t: 'Length of the cable', f: 'ℒ = 2·(F_H / w₀)·sinh(w₀L / 2F_H)', s: `ℒ = 2·(${fmt(FH)} / ${fmt(w)})·sinh(${fmt(w)}·${fmt(L / 2)} / ${fmt(FH)})`, r: `ℒ = ${fmt(len)} ${Lu}` });
    S.add({ t: 'Maximum tension', n: 'The tension is largest at the supports, where the cable is steepest.', f: 'tan θ_max = w₀(ℒ/2) / F_H;   T_max = F_H / cos θ_max', s: `tan θ_max = ${fmt(w)}(${fmt(half)}) / ${fmt(FH)} = ${fmt(slope)};   T_max = ${fmt(FH)} / cos ${fmt(th)}°`, r: `θ_max = ${fmt(th)}°,  T_max = ${fmt(Tmax)} ${F}` });
    const out = [
      { k: 'Horizontal force F_H (tension at the lowest point)', v: FH, u: F, hl: true },
      { k: 'Maximum tension T_max', v: Tmax, u: F, hl: true },
      { k: 'Cable angle at the supports', v: th, u: '°' },
      { k: 'Sag h', v: h, u: Lu }, { k: 'Cable length', v: len, u: Lu },
      { k: 'Total weight of the cable', v: w * len, u: F },
      { k: 'Catenary constant F_H / w₀', v: c, u: Lu },
    ];
    const y = (x) => c * (Math.cosh((x - L / 2) / c) - 1) - h;
    const T = (x) => FH * Math.cosh((x - L / 2) / c);
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: 'OK' }, out, steps: S.list, geo: { kind: 'catenary', L, hA: h, hB: h, xA: L / 2, FH, w, y, T, Tmax, F, Lu, WL, len, c } };
  }

  /** Catenary between supports at different levels: the lowest point is hA below A and hB below B. */
  function catenaryUneven(p, F, Lu, WL, S, L, w) {
    const hA = +p.hA, hB = +p.hB;
    if (!(hA > 0) || !(hB > 0)) return fail('Enter how far the lowest point is below each support (both greater than zero).');
    if (Math.max(hA, hB) > 20 * L) return fail('The sag is more than 20 times the span. Enter a smaller sag.');
    const xOf = (cc, hh) => cc * Math.acosh(1 + hh / cc);
    const c = Math.exp(bisect((lc) => xOf(Math.exp(lc), hA) + xOf(Math.exp(lc), hB) - L, Math.log(L / 1e5), Math.log(L * 1e7)));
    const xA = xOf(c, hA), xB = L - xA, FH = c * w;
    S.add({ t: 'Lowest point and horizontal force', n: `The supports are at different levels, so the lowest point is not at midspan. Both supports lie on the same catenary: h_A = c[cosh(x_A/c) − 1] and h_B = c[cosh(x_B/c) − 1] with x_A + x_B = L and c = F_H / w₀. Solved for c by trial and error.`,
      f: 'x = c·cosh⁻¹(1 + h/c);   x_A + x_B = L', s: `c·cosh⁻¹(1 + ${fmt(hA)}/c) + c·cosh⁻¹(1 + ${fmt(hB)}/c) = ${fmt(L)}`, r: `c = ${fmt(c)} ${Lu},  x_A = ${fmt(xA)} ${Lu},  x_B = ${fmt(xB)} ${Lu},  F_H = c·w₀ = ${fmt(FH)} ${F}` });
    S.add({ t: 'Equation of the curve', f: 'y = c·[cosh(x/c) − 1], x from the lowest point', r: `y = ${fmt(c)}·[cosh(${fmt(1 / c)}x) − 1] ${Lu}` });
    const sA = c * Math.sinh(xA / c), sB = c * Math.sinh(xB / c), len = sA + sB, TA = w * (c + hA), TB = w * (c + hB);
    S.add({ t: 'Length of the cable', f: 'ℒ = c·sinh(x_A/c) + c·sinh(x_B/c)', s: `ℒ = ${fmt(c)}·sinh(${fmt(xA)}/${fmt(c)}) + ${fmt(c)}·sinh(${fmt(xB)}/${fmt(c)}) = ${fmt(sA)} + ${fmt(sB)}`, r: `ℒ = ${fmt(len)} ${Lu}` });
    const thA = Math.atan(sA / c) * RAD, thB = Math.atan(sB / c) * RAD, Tmax = Math.max(TA, TB), at = TA >= TB ? 'support A' : 'support B';
    S.add({ t: 'Tension at the supports', n: 'T = F_H cosh(x/c) = w₀(c + y), so the tension is largest at the higher support, where the cable is steepest.', f: 'T = w₀(c + h);   tan θ = sinh(x/c)', s: `T_A = ${fmt(w)}(${fmt(c)} + ${fmt(hA)});   T_B = ${fmt(w)}(${fmt(c)} + ${fmt(hB)})`, r: `T_A = ${fmt(TA)} ${F} at ${fmt(thA)}°,  T_B = ${fmt(TB)} ${F} at ${fmt(thB)}°;  T_max = ${fmt(Tmax)} ${F} at ${at}` });
    const out = [
      { k: 'Horizontal force F_H (tension at the lowest point)', v: FH, u: F, hl: true },
      { k: 'Maximum tension T_max', v: Tmax, u: F, hl: true },
      { k: 'Tension at A', v: TA, u: F }, { k: 'Tension at B', v: TB, u: F },
      { k: 'Lowest point, distance from A', v: xA, u: Lu },
      { k: 'Cable length', v: len, u: Lu },
      { k: 'Total weight of the cable', v: w * len, u: F },
      { k: 'Catenary constant F_H / w₀', v: c, u: Lu },
    ];
    const y = (x) => c * (Math.cosh((x - xA) / c) - 1) - hA, T = (x) => FH * Math.cosh((x - xA) / c);
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: 'OK' }, out, steps: S.list, geo: { kind: 'catenary', L, hA, hB, xA, FH, w, y, T, Tmax, TA, TB, F, Lu, WL, len, c } };
  }

  /* ------------------------------------------------------------------ */
  /* Pipe assembly in space: internal loadings at a section             */
  /* ------------------------------------------------------------------ */
  /**
   * The section through B separates the assembly; the loads entered are those on the free segment beyond B.
   * Its equilibrium gives the force and moment on the cut face: F_B = −ΣF, M_B = −Σ (r − r_B) × F − ΣM.
   * Along the pipe axis at B the force is the normal force N and the moment the torque T; across it they are
   * the shear components V and the bending moments M.
   */
  function pipe3d(st, U) {
    const q = st.pp, F = st.fu, Lu = U.len, FL = `${F}·${Lu}`, err = [];
    const B = [+q.B.x || 0, +q.B.y || 0, +q.B.z || 0], ax = ['x', 'y', 'z'], k = Math.max(0, ax.indexOf(q.axis));
    const loads = (q.loads || []).map((l) => ({ r: [+l.x || 0, +l.y || 0, +l.z || 0], F: [+l.Fx || 0, +l.Fy || 0, +l.Fz || 0] }));
    const cps = (q.couples || []).map((c) => [+c.Mx || 0, +c.My || 0, +c.Mz || 0]);
    if (!loads.length && !cps.length) err.push('Enter the forces or couples on the segment beyond the section.');
    if (err.length) return fail(err);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const v3 = (v) => `{${v.map((x, i) => `${i && x >= 0 ? '+ ' : x < 0 ? '− ' : ''}${fmt(Math.abs(x))}${'ijk'[i]}`).join(' ')}}`;
    const S = Steps();
    S.add({ t: 'Free-body diagram of the segment beyond the section', n: `Section through B ${v3(B)} ${Lu}. On the cut face act the unknown force F_B and moment M_B; the pipe runs along ${ax[k]} at B, so the ${ax[k]} components are the normal force and the torque, and the other two are shear forces and bending moments.` });
    const rows = loads.map((l, i) => { const r = l.r.map((v, j) => v - B[j]); return { i, r, F: l.F, M: cross(r, l.F) }; });
    const SF = [0, 1, 2].map((j) => rows.reduce((a, w) => a + w.F[j], 0)), SM = [0, 1, 2].map((j) => rows.reduce((a, w) => a + w.M[j], 0) + cps.reduce((a, c) => a + c[j], 0));
    S.add({ t: 'Moments of the forces about B', f: 'M = r_BP × F', table: { head: ['Force', `r from B (${Lu})`, `F (${F})`, `r × F (${FL})`], rows: rows.map((w) => [`F${w.i + 1}`, v3(w.r), v3(w.F), v3(w.M)]).concat(cps.map((c, i) => [`M${i + 1} (couple)`, '—', '—', v3(c)])) } });
    const Fb = SF.map((v) => -v), Mb = SM.map((v) => -v);
    S.add({ t: 'Equations of equilibrium', f: 'ΣF = 0: F_B + ΣF = 0;   ΣM_B = 0: M_B + Σ r × F + ΣM = 0', s: `ΣF = ${v3(SF)} ${F};  Σ(r × F) + ΣM = ${v3(SM)} ${FL}`, r: `F_B = ${v3(Fb)} ${F},  M_B = ${v3(Mb)} ${FL}` });
    const nmF = ax.map((a, j) => (j === k ? `N_${a}` : `V_${a}`)), nmM = ax.map((a, j) => (j === k ? `T_${a} (torque)` : `M_${a}`));
    S.add({ t: 'Internal loadings', n: 'A negative value means the component acts opposite to the positive axis on the face of the segment beyond B.', r: ax.map((a, j) => `${nmF[j].split(' ')[0]} = ${fmt(Fb[j])} ${F}`).join(', ') + ';  ' + ax.map((a, j) => `${nmM[j].split(' ')[0]} = ${fmt(Mb[j])} ${FL}`).join(', ') });
    const out = ax.map((a, j) => ({ k: nmF[j], v: Fb[j], u: F, hl: true })).concat(ax.map((a, j) => ({ k: nmM[j], v: Mb[j], u: FL, hl: true })));
    const sh = Math.hypot(...Fb.filter((v, j) => j !== k)), bm = Math.hypot(...Mb.filter((v, j) => j !== k));
    out.push({ k: 'Resultant shear V', v: sh, u: F }, { k: 'Resultant bending moment M', v: bm, u: FL });
    const pipe = (q.pipe || []).map((p) => [+p.x || 0, +p.y || 0, +p.z || 0]);
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: `At B: N = ${fmt(Fb[k])} ${F}, T = ${fmt(Mb[k])} ${FL}` }, out, steps: S.list, geo: { kind: 'pipe3d', F, Lu, FL, B, k, pipe, loads, cps, Fb, Mb } };
  }

  /** Convert every input when the viewer switches between SI and U.S. Customary, so the problem stays the same. */
  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, tidy, UNITS } = Core;
    const l0 = UNITS[from].len, l1 = UNITS[to].len, f0 = st.fu, f1 = twin(st.fu, to);
    const Lc = (v) => tidy(convert(v, l0, l1)), Fc = (v) => tidy(convert(v, f0, f1));
    const Mc = (v) => tidy(convert(v, `${f0}·${l0}`, `${f1}·${l1}`)), Wc = (v) => tidy(convert(v, `${f0}/${l0}`, `${f1}/${l1}`));
    st.fu = f1;
    st.L = Lc(st.L); st.cut = Lc(st.cut);
    st.supports.forEach((s) => (s.x = Lc(s.x)));
    st.hinges = st.hinges.map(Lc);
    st.loads.forEach((q) => {
      if (q.kind === 'point') { q.x = Lc(q.x); q.P = Fc(q.P); }
      else if (q.kind === 'couple') { q.x = Lc(q.x); q.M = Mc(q.M); }
      else { q.x1 = Lc(q.x1); q.x2 = Lc(q.x2); q.w1 = Wc(q.w1); q.w2 = Wc(q.w2); }
    });
    const c = st.cab; c.span = Lc(c.span); c.hB = Lc(c.hB); c.sag = Lc(c.sag); c.FH = Fc(c.FH); c.loads.forEach((q) => { q.x = Lc(q.x); q.P = Fc(q.P); });
    const p = st.par; p.L = Lc(p.L); p.hA = Lc(p.hA); p.hB = Lc(p.hB); p.w0 = Wc(p.w0); p.Tmax = Fc(p.Tmax); p.len = Lc(p.len);
    if (st.pp) { const pp = st.pp; (pp.pipe || []).concat([pp.B], pp.loads || []).forEach((o) => ['x', 'y', 'z'].forEach((a) => (o[a] = Lc(+o[a] || 0)))); (pp.loads || []).forEach((o) => ['Fx', 'Fy', 'Fz'].forEach((a) => (o[a] = Fc(+o[a] || 0)))); (pp.couples || []).forEach((o) => ['Mx', 'My', 'Mz'].forEach((a) => (o[a] = Mc(+o[a] || 0)))); }
    const k = st.cat; k.L = Lc(k.L); k.h = Lc(k.h); k.w0 = Wc(k.w0); k.len = Lc(k.len); if (k.hA !== undefined) { k.hA = Lc(k.hA); k.hB = Lc(k.hB); }
    return st;
  }

  const Internal = { defaults, solve, beamModel, convertState };
  root.Internal = Internal;
  if (typeof module !== 'undefined' && module.exports) module.exports = Internal;
})(typeof window !== 'undefined' ? window : globalThis);
