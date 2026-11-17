/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M3 Torsion
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapter 10.
 *   shaft      stepped solid or tubular shaft held at A, torques at the ends of
 *              the segments, far end free or fixed: τ = Tρ/J, φ = Σ TL/(JG)
 *              (10.2, 10.4, 10.5)
 *   power      shaft driven at a power and speed: T = P/ω, ω = 2πf; size the
 *              shaft from τ_allow or check it (10.3)
 *   composite  tube bonded to a core of another material (10.5)
 *   noncirc    solid square, equilateral triangle or ellipse (Table 10–1), with
 *              a circle of the same area for comparison (10.6)
 * Torques are vectors along the shaft by the right-hand rule: positive points
 * away from A (to the right).
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const LET = 'ABCDEFGH';
  const TU = { SI: ['kN·m', 'N·m'], US: ['kip·ft', 'lb·ft', 'kip·in.', 'lb·in.'] };
  const TWIN = { 'kN·m': 'kip·ft', 'N·m': 'lb·ft', 'kip·ft': 'kN·m', 'lb·ft': 'N·m', 'kip·in.': 'kN·m', 'lb·in.': 'N·m' };
  const PU = { SI: 'kW', US: 'hp' }, PW = { kW: 1000, hp: 745.69987 };

  const seg = (L, d, T, o) => Object.assign({ L, shape: 'circle', d, di: 0, mat: 'a36', G: 75, T }, o || {});
  function defaults() {
    return {
      mode: 'shaft', tu: 'kN·m',
      sh: { right: 'free', segs: [seg(3, 200, 150), seg(2, 200, -60), seg(1.5, 200, -10)] },
      pw: { P: 90, spd: 1750, spdU: 'rpm', task: 'size', shape: 'circle', d: 40, di: 30, tA: 50, step: 5, L: 1.5, mat: 'a36', G: 75 },
      cp: { T: 3, L: 1.2, d: 50, di: 25, mat: 'a36', G: 75, matC: 'brass', Gc: 37 },
      nc: { shape: 'triangle', a: 40, b: 20, L: 1.2, mat: 'al6061', G: 26, task: 'allow', T: 0.2, tA: 55, phiA: 0.02, cmp: true },
    };
  }
  const SEG = { L: 'L', d: 'S', di: 'S', G: 'MOD' };
  const KINDS = { pw: { d: 'S', di: 'S', tA: 'ST', step: 'S', L: 'L', G: 'MOD' }, cp: { L: 'L', d: 'S', di: 'S', G: 'MOD', Gc: 'MOD' }, nc: { a: 'S', b: 'S', L: 'L', G: 'MOD', tA: 'ST' } };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = from === 'SI' ? 'kN' : 'kip';
    Object.keys(KINDS).forEach((g) => MD.convertObj(st[g], KINDS[g], from, to, fu));
    (st.sh.segs || []).forEach((s) => MD.convertObj(s, SEG, from, to, fu));
    // remember the torque unit of each system, so switching back returns to the same unit (kip·in. stays kip·in.)
    st.tuBy = Object.assign({}, st.tuBy, { [from]: st.tu });
    const tu0 = st.tu, back = st.tuBy[to], tu1 = back && TWIN[back] && (TWIN[back] === tu0 || TWIN[tu0] === back) ? back : TWIN[tu0] || TU[to][0], ct = (v) => Core.tidy(Core.convert(v, tu0, tu1), 6);
    (st.sh.segs || []).forEach((s) => { if (isFinite(+s.T)) s.T = ct(+s.T); });
    if (isFinite(+st.cp.T)) st.cp.T = ct(+st.cp.T);
    if (isFinite(+st.nc.T)) st.nc.T = ct(+st.nc.T);
    st.tu = tu1;
    if (st.pw && isFinite(+st.pw.P)) st.pw.P = Core.tidy((st.pw.P * PW[PU[from]]) / PW[PU[to]], 6);
    return st;
  }

  function solve(st, U) {
    const u = units(U, U.id === 'US' ? 'kip' : 'kN');
    if (!TU[U.id].includes(st.tu)) st.tu = TU[U.id][0];
    u.TQ = st.tu; u.PW = PU[U.id];
    if (st.mode === 'power') return power(st.pw, u);
    if (st.mode === 'composite') return composite(st.cp, u);
    if (st.mode === 'noncirc') return noncirc(st.nc, u);
    return shaft(st.sh, u);
  }
  const R = MD.result;
  const Jof = (s, u) => { const c = B(s.d / 2, u.S), ci = s.shape === 'tube' ? B(s.di / 2, u.S) : 0; return { J: (Math.PI / 2) * (c ** 4 - ci ** 4), c, ci }; };
  const Jtxt = (s, u) => (s.shape === 'tube' ? `π(${fmt(s.d / 2)}⁴ − ${fmt(s.di / 2)}⁴)/2` : `π(${fmt(s.d / 2)})⁴/2`);
  const rad = (x) => `${fmt(x)} rad`;

  /* ------------------------------------------------------------------ */
  /* Stepped shaft                                                      */
  /* ------------------------------------------------------------------ */
  function shaft(q, u) {
    const segs = q.segs || [], n = segs.length, err = [];
    if (n < 1) err.push('Add at least one segment.');
    if (n > 5) err.push('A shaft can have at most five segments.');
    segs.forEach((s, i) => {
      const who = `Segment ${LET[i]}${LET[i + 1]}`;
      if (!(s.L > 0)) err.push(`${who}: enter its length.`);
      if (!(s.d > 0)) err.push(`${who}: enter the diameter.`);
      if (s.shape === 'tube' && !(s.di >= 0 && s.di < s.d)) err.push(`${who}: the inner diameter must be smaller than the outer diameter.`);
      if (!(s.G > 0)) err.push(`${who}: enter the shear modulus G.`);
      if (!isFinite(+s.T)) err.push(`${who}: the torque must be a number.`);
    });
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], fixed = q.right === 'fixed', end = LET[n], TQ = u.TQ;
    const nm = (i) => `${LET[i]}${LET[i + 1]}`;
    const sg = segs.map((s, i) => { const L = B(+s.L, u.L), G = B(+s.G, u.MOD), j = Jof(s, u); return { i, name: nm(i), L, G, J: j.J, c: j.c, ci: j.ci, f: L / (j.J * G), T: i === n - 1 && fixed ? 0 : B(+s.T, TQ), q: s }; });
    if (fixed && +segs[n - 1].T) warn.push(`The torque at ${end} acts on the support, so it is left out.`);
    S.add({ t: 'Polar moment of inertia of each segment', f: 'J = πc⁴/2 (solid), J = π(c_o⁴ − c_i⁴)/2 (tube)',
      table: { head: ['Segment', `L (${u.L})`, `J (${u.I})`, `G (${u.MOD})`], rows: sg.map((s) => [s.name, fmt(+s.q.L), `${fmt(D(s.J, u.I))} = ${Jtxt(s.q, u)}`, fmt(+s.q.G)]) } });
    const Sl = sg.map((s, i) => sg.slice(0, i).reduce((a, t) => a + t.T, 0)), Ttot = sg.reduce((a, t) => a + t.T, 0), sumF = sg.reduce((a, s) => a + s.f, 0);
    let TA, TB = 0;
    if (!fixed) {
      TA = Ttot;
      S.add({ t: 'Equilibrium of the whole shaft', n: 'Torques are vectors along the shaft by the right-hand rule, positive pointing away from A. The support at A takes the sum of the torques.', f: '−T_A + ΣT = 0', r: `T_A = ${MD.show(TA, TQ)}` });
    } else {
      S.add({ t: 'Equilibrium', n: `The supports at A and ${end} both resist twisting: two unknown torques and one equation, so the shaft is statically indeterminate. Both reactions are drawn pointing toward A.`, f: `−T_A − T_${end} + ΣT = 0`, s: `T_A + T_${end} = ${MD.show(Ttot, TQ)}` });
      S.add({ t: 'Compatibility', n: `Both ends are held, so ${end} does not turn relative to A.`, f: `φ_${end}/A = 0` });
      const per = (f) => fmt(D(B(1, TQ) * f, 'rad'));
      S.add({ t: 'Load–displacement', n: `Cut through each segment: the internal torque is T_A less the torques between A and the cut. Each L/(JG) is in rad per ${TQ}.`, f: 'Σ TL/(JG) = 0', s: sg.map((s, i) => `(T_A${Sl[i] ? ` ${Sl[i] > 0 ? '−' : '+'} ${fmt(Math.abs(D(Sl[i], TQ)))}` : ''})(${per(s.f)})`).join(' + ') + ' = 0' });
      TA = sg.reduce((a, s, i) => a + Sl[i] * s.f, 0) / sumF; TB = Ttot - TA;
      S.add({ t: 'Solve', f: `T_A from the line above, then T_${end} = ΣT − T_A`, r: `T_A = ${MD.show(TA, TQ)}, T_${end} = ${MD.show(TB, TQ)}`, n: (TA < 0 || TB < 0) ? 'A negative reaction acts the other way from the one drawn.' : 'Both reactions act as drawn.' });
    }
    let ph = 0; const phi = [0];
    sg.forEach((s, i) => { s.Ti = TA - Sl[i]; s.tau = (Math.abs(s.Ti) * s.c) / s.J; s.taui = (Math.abs(s.Ti) * s.ci) / s.J; s.ph = s.Ti * s.f; ph += s.ph; phi.push(ph); });
    S.add({ t: 'Internal torque in each segment', n: 'Method of sections: positive when the torque vector points away from the cut face.', table: { head: ['Segment', `T (${TQ})`], rows: sg.map((s) => [s.name, fmt(D(s.Ti, TQ))]) } });
    S.add({ t: 'Maximum shear stress', n: 'The shear stress grows in proportion to the distance ρ from the centre; it is largest at the outer surface.', f: 'τ_max = Tc/J' + (sg.some((s) => s.ci) ? ', τ_i = Tc_i/J' : ''),
      table: { head: ['Segment', `c (${u.S})`, `τ_max (${u.ST})`].concat(sg.some((s) => s.ci) ? [`τ at the inner wall (${u.ST})`] : []), rows: sg.map((s) => [s.name, fmt(D(s.c, u.S)), fmt(D(s.tau, u.ST))].concat(sg.some((t) => t.ci) ? [s.ci ? fmt(D(s.taui, u.ST)) : '–'] : [])) } });
    S.add({ t: 'Angle of twist of each segment', f: 'φ = TL/(JG)', table: { head: ['Segment', 'φ (rad)'], rows: sg.map((s) => [s.name, fmt(s.ph)]) } });
    S.add({ t: 'Rotation of each point relative to A', n: 'Positive turns by the right-hand rule with the thumb pointing away from A.', f: 'φ_point = Σ φ of the segments from A', table: { head: ['Point', 'φ (rad)', 'φ (°)'], rows: phi.map((p, i) => [LET[i], fmt(p), fmt((p * 180) / Math.PI)]) } });
    if (fixed) out.push({ k: 'Reaction torque at A, T_A', v: D(TA, TQ), u: TQ, hl: true }, { k: `Reaction torque at ${end}, T_${end}`, v: D(TB, TQ), u: TQ, hl: true });
    else out.push({ k: 'Reaction torque at A, T_A', v: D(TA, TQ), u: TQ });
    sg.forEach((s) => out.push({ k: `Internal torque T_${s.name}`, v: D(s.Ti, TQ), u: TQ }));
    sg.forEach((s) => out.push({ k: `Maximum shear stress in ${s.name}`, v: D(s.tau, u.ST), u: u.ST }));
    const tmax = sg.reduce((a, s) => (s.tau > a.tau ? s : a));
    out.push({ k: 'Largest shear stress τ_max', v: D(tmax.tau, u.ST), u: u.ST, hl: true });
    phi.forEach((p, i) => { if (i) out.push({ k: `Angle of twist of ${LET[i]} relative to A`, v: p, u: 'rad', hl: !fixed && i === n }); });
    return R(`τ_max = ${MD.show(tmax.tau, u.ST)} in ${tmax.name}; φ_${end}/A = ${rad(phi[n])}`, 'ok', out, S,
      { kind: 'shaft', q, u, sg: sg.map((s) => ({ name: s.name, L: s.L, c: s.c, ci: s.ci, J: s.J, Ti: s.Ti, tau: s.tau, ph: s.ph, T: s.T, q: s.q })), phi, TA, TB, fixed, Lsum: sg.reduce((a, s) => a + s.L, 0) }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Power transmission                                                 */
  /* ------------------------------------------------------------------ */
  function power(q, u) {
    const err = [], tube = q.shape === 'tube';
    if (!(q.P > 0)) err.push('Enter the power transmitted.');
    if (!(q.spd > 0)) err.push('Enter the speed of the shaft.');
    if (q.task === 'size' && !(q.tA > 0)) err.push('Enter the allowable shear stress.');
    if (q.task === 'check' && !(q.d > 0)) err.push('Enter the diameter of the shaft.');
    if (tube && !(q.di > 0)) err.push('Enter the inner diameter of the tube.');
    if (tube && q.task === 'check' && !(q.di < q.d)) err.push('The inner diameter must be smaller than the outer diameter.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], TQ = u.TQ, Pw = q.P * PW[u.PW];
    const w = q.spdU === 'Hz' ? 2 * Math.PI * q.spd : (q.spd * 2 * Math.PI) / 60;
    S.add({ t: 'Angular velocity', f: q.spdU === 'Hz' ? 'ω = 2πf' : 'ω = (rev/min)(2π rad/rev)(1 min/60 s)', s: q.spdU === 'Hz' ? `ω = 2π(${fmt(+q.spd)})` : `ω = ${fmt(+q.spd)}(2π)/60`, r: `ω = ${fmt(w)} rad/s` });
    const T = Pw / w;
    S.add({ t: 'Torque in the shaft', f: 'P = Tω', s: `T = ${fmt(+q.P)} ${u.PW} (${fmt(PW[u.PW])} W/${u.PW}) / ${fmt(w)} rad/s`, r: `T = ${MD.show(T, TQ)}` });
    let d = B(+q.d, u.S), di = tube ? B(+q.di, u.S) : 0, use = null;
    if (q.task === 'size') {
      const ta = B(+q.tA, u.ST);
      if (!tube) {
        const c = Math.cbrt((2 * T) / (Math.PI * ta)); d = 2 * c;
        S.add({ t: 'Required size', f: 'J/c = T/τ_allow;  πc³/2 = T/τ_allow', s: `c = (2T/(π τ_allow))^(1/3) = (2(${MD.show(T, TQ)})/(π(${fmt(+q.tA)} ${u.ST})))^(1/3)`, r: `c = ${MD.show(c, u.S)}, d = ${MD.show(d, u.S)}` });
      } else {
        const ci = di / 2, k = (2 * T) / (Math.PI * ta), f = (c) => c ** 4 - ci ** 4 - k * c;
        let lo = ci, hi = Math.max(ci * 2, Math.cbrt(k) * 2 + ci); while (f(hi) < 0) hi *= 2;
        const c = Core.bisect(f, lo, hi, 200) || NaN; d = 2 * c;
        S.add({ t: 'Required outer size', n: 'With the inner diameter chosen, the outer radius is found from the torsion formula.', f: 'π(c_o⁴ − c_i⁴)/(2c_o) = T/τ_allow', s: `c_i = ${MD.show(ci, u.S)}`, r: `c_o = ${MD.show(c, u.S)}, d_o = ${MD.show(d, u.S)}` });
      }
      out.push({ k: tube ? 'Required outer diameter d_o' : 'Required diameter d', v: D(d, u.S), u: u.S, hl: true });
      if (q.step > 0) {
        const st = +q.step; use = Math.ceil(D(d, u.S) / st - 1e-9) * st;
        S.add({ t: 'Size to use', n: `Round up to the next ${fmt(st)} ${u.S}.`, r: `Use d = ${fmt(use)} ${u.S}` });
        out.push({ k: 'Size to use (rounded up)', v: use, u: u.S, hl: true });
        d = B(use, u.S);
      }
    }
    const J = (Math.PI / 2) * ((d / 2) ** 4 - (di / 2) ** 4), tau = (T * d) / 2 / J;
    S.add({ t: q.task === 'size' ? 'Shear stress in the shaft used' : 'Maximum shear stress', f: 'τ_max = Tc/J', s: `J = ${fmt(D(J, u.I))} ${u.I}`, r: `τ_max = ${MD.show(tau, u.ST)}` });
    out.push({ k: 'Angular velocity ω', v: w, u: 'rad/s' }, { k: 'Torque T', v: D(T, TQ), u: TQ, hl: true }, { k: 'Maximum shear stress τ_max', v: D(tau, u.ST), u: u.ST, hl: q.task === 'check' });
    let ph = 0;
    if (q.L > 0 && q.G > 0) {
      ph = (T * B(+q.L, u.L)) / (J * B(+q.G, u.MOD));
      S.add({ t: 'Angle of twist over the length', f: 'φ = TL/(JG)', s: `φ = ${MD.show(T, TQ)} (${fmt(+q.L)} ${u.L}) / (${fmt(D(J, u.I))} ${u.I})(${fmt(+q.G)} ${u.MOD})`, r: `φ = ${rad(ph)} = ${fmt((ph * 180) / Math.PI)}°` });
      out.push({ k: 'Angle of twist φ', v: ph, u: 'rad' });
    }
    return R(q.task === 'size' ? `d = ${MD.show(d, u.S)}${use !== null ? ' (rounded up)' : ''}, T = ${MD.show(T, TQ)}` : `τ_max = ${MD.show(tau, u.ST)}, T = ${MD.show(T, TQ)}`, 'ok', out, S,
      { kind: 'power', q, u, T, d, di, tau, ph, w, J });
  }

  /* ------------------------------------------------------------------ */
  /* Tube bonded to a core                                              */
  /* ------------------------------------------------------------------ */
  function composite(q, u) {
    const err = [];
    if (!isFinite(+q.T) || +q.T === 0) err.push('Enter the torque at the free end.');
    if (!(q.L > 0)) err.push('Enter the length of the shaft.');
    if (!(q.d > 0 && q.di > 0 && q.di < q.d)) err.push('The core diameter must be smaller than the outer diameter.');
    if (!(q.G > 0 && q.Gc > 0)) err.push('Enter the shear modulus of both materials.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], TQ = u.TQ, T = B(+q.T, TQ), L = B(+q.L, u.L);
    const co = B(q.d / 2, u.S), ci = B(q.di / 2, u.S), Jt = (Math.PI / 2) * (co ** 4 - ci ** 4), Jc = (Math.PI / 2) * ci ** 4, Gt = B(+q.G, u.MOD), Gc = B(+q.Gc, u.MOD);
    S.add({ t: 'Section properties', f: 'J_tube = π(c_o⁴ − c_i⁴)/2, J_core = πc_i⁴/2', r: `J_tube = ${fmt(D(Jt, u.I))} ${u.I}, J_core = ${fmt(D(Jc, u.I))} ${u.I}` });
    S.add({ t: 'Equilibrium', n: 'The support resists with part of the torque in the tube and part in the core.', f: '−T_tube − T_core + T = 0', s: `T_tube + T_core = ${MD.show(T, TQ)}` });
    S.add({ t: 'Compatibility', n: 'The tube and core are bonded, so they twist by the same angle.', f: 'φ_tube = φ_core' });
    const kt = Jt * Gt, kc = Jc * Gc;
    S.add({ t: 'Load–displacement', f: 'T_tube L/(J_tube G_tube) = T_core L/(J_core G_core)', s: `T_tube = T_core (${fmt(D(Jt, u.I))})(${fmt(+q.G)}) / ((${fmt(D(Jc, u.I))})(${fmt(+q.Gc)}))`, r: `T_tube = ${fmt(kt / kc)} T_core` });
    const Tc = T * kc / (kt + kc), Tt = T - Tc, ph = (T * L) / (kt + kc);
    S.add({ t: 'Solve', r: `T_tube = ${MD.show(Tt, TQ)}, T_core = ${MD.show(Tc, TQ)}` });
    const tc = Math.abs(Tc) * ci / Jc, tmin = Math.abs(Tt) * ci / Jt, tmax = Math.abs(Tt) * co / Jt;
    S.add({ t: 'Shear stress', n: 'The stress rises linearly from the centre in each material and jumps at the bond, where the strain is the same but G is not.', f: 'τ = Tρ/J', table: { head: ['Where', `τ (${u.ST})`], rows: [['Core, at the bond', fmt(D(tc, u.ST))], ['Tube, at the bond', fmt(D(tmin, u.ST))], ['Tube, outer surface', fmt(D(tmax, u.ST))]] } });
    S.add({ t: 'Angle of twist', f: 'φ = T_tube L/(J_tube G_tube)', r: `φ = ${rad(ph)}` });
    out.push({ k: 'Torque in the tube', v: D(Tt, TQ), u: TQ, hl: true }, { k: 'Torque in the core', v: D(Tc, TQ), u: TQ, hl: true });
    out.push({ k: 'Largest shear stress in the core', v: D(tc, u.ST), u: u.ST }, { k: 'Shear stress in the tube at the bond', v: D(tmin, u.ST), u: u.ST }, { k: 'Largest shear stress in the tube', v: D(tmax, u.ST), u: u.ST, hl: true });
    out.push({ k: 'Angle of twist φ', v: ph, u: 'rad' });
    return R(`T_tube = ${MD.show(Tt, TQ)}, T_core = ${MD.show(Tc, TQ)}`, 'ok', out, S, { kind: 'composite', q, u, T, Tt, Tc, tc, tmin, tmax, ph, co, ci });
  }

  /* ------------------------------------------------------------------ */
  /* Solid noncircular shafts                                           */
  /* ------------------------------------------------------------------ */
  const NC = {
    square: { name: 'Square', tau: (T, a) => (4.81 * T) / a ** 3, phi: (T, L, G, a) => (7.1 * T * L) / (a ** 4 * G), A: (a) => a * a, ft: 'τ_max = 4.81T/a³', fp: 'φ = 7.10TL/(a⁴G)' },
    triangle: { name: 'Equilateral triangle', tau: (T, a) => (20 * T) / a ** 3, phi: (T, L, G, a) => (46 * T * L) / (a ** 4 * G), A: (a) => (Math.sqrt(3) / 4) * a * a, ft: 'τ_max = 20T/a³', fp: 'φ = 46TL/(a⁴G)' },
    ellipse: { name: 'Ellipse', tau: (T, a, b) => (2 * T) / (Math.PI * a * b * b), phi: (T, L, G, a, b) => ((a * a + b * b) * T * L) / (Math.PI * a ** 3 * b ** 3 * G), A: (a, b) => Math.PI * a * b, ft: 'τ_max = 2T/(πab²)', fp: 'φ = (a² + b²)TL/(πa³b³G)' },
    circle: { name: 'Circle', tau: (T, a) => (2 * T) / (Math.PI * (a / 2) ** 3), phi: (T, L, G, a) => (T * L) / ((Math.PI / 2) * (a / 2) ** 4 * G), A: (a) => (Math.PI / 4) * a * a, ft: 'τ_max = Tc/J', fp: 'φ = TL/(JG)' },
  };
  function noncirc(q, u) {
    const err = [], sh = NC[q.shape] ? q.shape : 'square', K = NC[sh];
    if (!(q.a > 0)) err.push('Enter the size a.');
    if (sh === 'ellipse' && !(q.b > 0 && q.b <= q.a)) err.push('For the ellipse, b is the smaller half-axis and must not be larger than a.');
    if (!(q.L > 0)) err.push('Enter the length of the shaft.');
    if (!(q.G > 0)) err.push('Enter the shear modulus G.');
    if (q.task === 'check' && !(+q.T > 0)) err.push('Enter the torque T.');
    if (q.task === 'allow' && !(q.tA > 0) && !(q.phiA > 0)) err.push('Enter an allowable shear stress, an allowable angle of twist, or both.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], TQ = u.TQ, a = B(+q.a, u.S), b = B(+q.b || 0, u.S), L = B(+q.L, u.L), G = B(+q.G, u.MOD);
    const tau = (T) => K.tau(T, a, b), phi = (T) => K.phi(T, L, G, a, b);
    const dims = sh === 'ellipse' ? `a = ${fmt(+q.a)}, b = ${fmt(+q.b)} ${u.S}` : `a = ${fmt(+q.a)} ${u.S}`;
    S.add({ t: 'Formulas for this section', n: `${K.name} (${dims}). From Table 10–1; the largest stress is on the edge at the point closest to the axis.`, f: `${K.ft};  ${K.fp}` });
    let T, gov = null;
    if (q.task === 'check') {
      T = B(+q.T, TQ);
      S.add({ t: 'Maximum shear stress', f: K.ft, r: `τ_max = ${MD.show(tau(T), u.ST)}` });
      S.add({ t: 'Angle of twist', f: K.fp, r: `φ = ${rad(phi(T))}` });
    } else {
      const lim = [];
      if (q.tA > 0) { const t1 = B(+q.tA, u.ST) / tau(1); lim.push({ by: 'stress', T: t1 }); S.add({ t: 'Torque that the allowable stress allows', f: `${K.ft} = τ_allow`, s: `τ_allow = ${fmt(+q.tA)} ${u.ST}`, r: `T = ${MD.show(t1, TQ)}` }); }
      if (q.phiA > 0) { const t2 = +q.phiA / phi(1); lim.push({ by: 'twist', T: t2 }); S.add({ t: 'Torque that the allowable twist allows', f: `${K.fp} = φ_allow`, s: `φ_allow = ${fmt(+q.phiA)} rad`, r: `T = ${MD.show(t2, TQ)}` }); }
      gov = lim.reduce((x, y) => (y.T < x.T ? y : x)); T = gov.T;
      S.add({ t: 'Largest torque', n: `The smaller value governs: the ${gov.by === 'stress' ? 'shear stress' : 'angle of twist'} limits the torque.`, r: `T = ${MD.show(T, TQ)}` });
      lim.forEach((l) => out.push({ k: `Torque allowed by the ${l.by === 'stress' ? 'shear stress' : 'angle of twist'}`, v: D(l.T, TQ), u: TQ }));
      out.push({ k: 'Largest torque T', v: D(T, TQ), u: TQ, hl: true });
    }
    out.push({ k: 'Maximum shear stress τ_max', v: D(tau(T), u.ST), u: u.ST, hl: q.task === 'check' }, { k: 'Angle of twist φ', v: phi(T), u: 'rad', hl: q.task === 'check' });
    const A = K.A(a, b);
    let cmp = null;
    if (q.cmp && sh !== 'circle') {
      const c = Math.sqrt(A / Math.PI), J = (Math.PI / 2) * c ** 4, tc = (T) => (T * c) / J, pc = (T) => (T * L) / (J * G);
      S.add({ t: 'Circle with the same area', n: 'The same amount of material made into a round shaft.', f: 'πc² = A', s: `A = ${fmt(D(A, u.A))} ${u.A}`, r: `c = ${MD.show(c, u.S)}` });
      if (q.task === 'check') {
        cmp = { c, tau: tc(T), phi: pc(T) };
        S.add({ t: 'The round shaft under the same torque', f: 'τ = Tc/J, φ = TL/(JG)', r: `τ_max = ${MD.show(cmp.tau, u.ST)}, φ = ${rad(cmp.phi)}` });
        out.push({ k: 'Round shaft of the same area: τ_max', v: D(cmp.tau, u.ST), u: u.ST }, { k: 'Round shaft of the same area: φ', v: cmp.phi, u: 'rad' });
      } else {
        const l2 = [];
        if (q.tA > 0) l2.push({ by: 'stress', T: B(+q.tA, u.ST) / tc(1) });
        if (q.phiA > 0) l2.push({ by: 'twist', T: +q.phiA / pc(1) });
        const g2 = l2.reduce((x, y) => (y.T < x.T ? y : x));
        cmp = { c, T: g2.T, by: g2.by, tau: tc(g2.T), phi: pc(g2.T) };
        S.add({ t: 'Largest torque on the round shaft', f: 'τ_allow = Tc/J;  φ_allow = TL/(JG)', s: l2.map((l) => `${l.by === 'stress' ? 'by stress' : 'by twist'}: ${MD.show(l.T, TQ)}`).join(';  '), r: `T = ${MD.show(g2.T, TQ)} (${fmt((100 * (g2.T - T)) / T)} % more)` });
        out.push({ k: 'Largest torque on a round shaft of the same area', v: D(g2.T, TQ), u: TQ, hl: true });
      }
    }
    return R(q.task === 'check' ? `τ_max = ${MD.show(tau(T), u.ST)}, φ = ${rad(phi(T))}` : `T = ${MD.show(T, TQ)} (${gov.by === 'stress' ? 'shear stress' : 'twist'} governs)`, 'ok', out, S,
      { kind: 'noncirc', q, u, sh, T, tau: tau(T), ph: phi(T), a, b, A, cmp });
  }

  const Torsion = { defaults, solve, convertState, TU };
  root.Torsion = Torsion;
  if (typeof module !== 'undefined' && module.exports) module.exports = Torsion;
})(typeof window !== 'undefined' ? window : globalThis);
