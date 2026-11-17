/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M2 Axial Load
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapter 9.
 *   bar       stepped bar fixed at A, loads at the ends of the segments,
 *             far end free, fixed, or with a gap to a wall; temperature change
 *             δ = Σ NL/(AE) + αΔTL                                 (9.2 to 9.6)
 *   parallel  members side by side or one inside another under a rigid cap:
 *             equilibrium, equal displacement, load-displacement  (9.4, 9.6)
 *   rigid     rigid bar on two or three rods (hung) or posts (resting), with
 *             an optional pin; determinate or not                  (9.2, 9.4, 9.6)
 *   conc      stress concentration at a hole or a shoulder fillet with K from
 *             the chart: σ_max = K N/A                              (9.7)
 * Inputs are stored in the units shown beside them; the solver works in base units.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const LET = 'ABCDEFGH';

  const seg = (L, d, P, o) => Object.assign({ L, shape: 'circle', d, di: 0, b: 50, h: 50, A: 500, mat: 'a36', E: 200, al: 12, P }, o || {});
  function defaults() {
    return {
      mode: 'bar', fu: 'kN',
      ax: { right: 'free', gap: 0.2, dT: 0, segs: [seg(2, 50, 800), seg(1, 50, 400), seg(1.5, 50, -700)] },
      par: { P: 90, L: 0.4, dT: 0, layout: 'nested', mem: [
        { n: 1, shape: 'tube', d: 100, di: 80, b: 50, h: 50, A: 500, mat: 'al6061', E: 68.9, al: 24 },
        { n: 1, shape: 'circle', d: 60, di: 0, b: 50, h: 50, A: 500, mat: 'brass', E: 101, al: 18 }] },
      rig: { side: 'hang', pin: false, xp: 0, len: 0.8, dT: 0, w: 0, rods: [
        { x: 0, L: 0.5, shape: 'area', d: 8, A: 50, mat: 'a992', E: 200, al: 12 },
        { x: 0.4, L: 0.5, shape: 'area', d: 6, A: 30, mat: 'a992', E: 200, al: 12 },
        { x: 0.8, L: 0.5, shape: 'area', d: 8, A: 50, mat: 'a992', E: 200, al: 12 }], loads: [{ x: 0.2, P: 15 }] },
      cn: { geo: 'fillet', w: 40, h: 32, d: 10, r: 4, t: 2, K: 1.75, task: 'allow', N: 8, sA: 250 },
    };
  }
  /* kind of every numeric input, for switching units */
  const SEG = { L: 'L', d: 'S', di: 'S', b: 'S', h: 'S', A: 'A', E: 'MOD', al: 'AL', P: 'F' };
  const KINDS = {
    ax: { gap: 'S', dT: 'T' },
    par: { P: 'F', L: 'L', dT: 'T' },
    rig: { xp: 'L', len: 'L', dT: 'T', w: 'W' },
    cn: { w: 'S', h: 'S', d: 'S', r: 'S', t: 'S', N: 'F', sA: 'ST' },
  };
  function convertState(st, from, to) {
    if (from === to) return st;
    Object.keys(KINDS).forEach((g) => MD.convertObj(st[g], KINDS[g], from, to, st.fu));
    const each = (arr, kinds) => (arr || []).forEach((o) => MD.convertObj(o, kinds, from, to, st.fu));
    if (st.ax) each(st.ax.segs, SEG);
    if (st.par) each(st.par.mem, SEG);
    if (st.rig) { each(st.rig.rods, Object.assign({ x: 'L' }, SEG)); each(st.rig.loads, { x: 'L', P: 'F' }); }
    st.fu = Core.twin(st.fu, to);
    return st;
  }

  function solve(st, U) {
    const u = units(U, st.fu);
    if (st.mode === 'parallel') return parallel(st.par, u);
    if (st.mode === 'rigid') return rigid(st.rig, u);
    if (st.mode === 'conc') return conc(st.cn, u);
    return bar(st.ax, u);
  }
  const R = MD.result;
  const areaOf = (m, u) => B(MD.barArea(m).A, u.A);
  const areaErr = (m, u, who) => { const e = MD.barAreaErr(m, u.S); return e ? `${who}: ${e}` : null; };
  const alpha = (m, u) => (+m.al || 0) * 1e-6 / B(1, u.T); // per kelvin
  const sgnTxt = (v) => (v >= 0 ? `+${fmt(v)}` : fmt(v));

  /* ------------------------------------------------------------------ */
  /* Stepped bar                                                        */
  /* ------------------------------------------------------------------ */
  function bar(q, u) {
    const segs = q.segs || [], n = segs.length, err = [];
    if (n < 1) err.push('Add at least one segment.');
    if (n > 5) err.push('A bar can have at most five segments.');
    segs.forEach((s, i) => {
      const who = `Segment ${LET[i]}${LET[i + 1]}`;
      if (!(s.L > 0)) err.push(`${who}: enter its length.`);
      const e = areaErr(s, u, who); if (e) err.push(e);
      if (!(s.E > 0)) err.push(`${who}: enter the modulus of elasticity E.`);
      if (!isFinite(+s.P)) err.push(`${who}: the load must be a number.`);
    });
    if (q.right === 'gap' && !(q.gap > 0)) err.push('Enter the gap between the end of the bar and the wall.');
    if (!isFinite(+q.dT)) err.push('The temperature change must be a number.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], dT = B(+q.dT || 0, u.T), fixedEnd = q.right !== 'free';
    const nm = (i) => `${LET[i]}${LET[i + 1]}`, end = LET[n];
    const sg = segs.map((s, i) => {
      const L = B(+s.L, u.L), A = areaOf(s, u), E = B(+s.E, u.MOD), al = alpha(s, u);
      return { i, name: nm(i), L, A, E, al, f: L / (A * E), dT: al * dT * L, P: i === n - 1 && fixedEnd ? 0 : B(+s.P, u.F), q: s };
    });
    if (fixedEnd && +segs[n - 1].P) warn.push(`The load at ${end} acts on the wall, so it is left out.`);
    S.add({ t: 'Segments', n: 'Areas from the cross-sections; each segment has one area, one E and one internal force.',
      table: { head: ['Segment', `L (${u.L})`, `A (${u.A})`, `E (${u.MOD})`].concat(dT ? [`α (10⁻⁶/${u.T})`] : []), rows: sg.map((s) => [s.name, fmt(+s.q.L), fmt(D(s.A, u.A)), fmt(+s.q.E)].concat(dT ? [fmt(+s.q.al || 0)] : [])) } });
    // S_i = sum of the loads at the points left of the cut through segment i (points B … up to the start of the segment)
    const Sl = sg.map((s, i) => sg.slice(0, i).reduce((a, t) => a + t.P, 0)), Ptot = sg.reduce((a, t) => a + t.P, 0);
    const sumF = sg.reduce((a, s) => a + s.f, 0), sumT = sg.reduce((a, s) => a + s.dT, 0);
    const deltaOf = (FA) => sg.reduce((a, s, i) => a + (FA - Sl[i]) * s.f + s.dT, 0);
    let FA, FB = 0, contact = q.right === 'fixed', gap = q.right === 'gap' ? B(+q.gap, u.S) : 0;
    const loadsTxt = sg.filter((s) => s.P).map((s, i) => `${sgnTxt(D(s.P, u.F))}`).join(' ') || '0';
    if (!fixedEnd) {
      FA = Ptot;
      S.add({ t: 'Equilibrium of the whole bar', n: `Loads are positive when they point away from A (to the right). The wall at A takes the sum of the loads.`, f: '−F_A + ΣP = 0', s: `F_A = ${loadsTxt}`, r: `F_A = ${MD.show(FA, u.F)} (${FA >= 0 ? 'to the left' : 'to the right'})` });
    } else {
      const free = deltaOf(Ptot);
      S.add({ t: 'Equilibrium', n: `There are two unknown reactions, F_A at the wall at A and F_${end} at the wall at ${end}, both drawn pointing to the left, and only one equation, so the bar is statically indeterminate.`, f: `−F_A − F_${end} + ΣP = 0`, s: `F_A + F_${end} = ${MD.show(Ptot, u.F)}` });
      if (q.right === 'gap') {
        S.add({ t: 'Does the gap close?', n: `With the wall at ${end} taken away, the end moves by the loads${dT ? ' and the temperature change' : ''} alone.`, f: `δ_${end} = Σ NL/(AE)${dT ? ' + Σ αΔTL' : ''}`, s: `δ_${end} = ${MD.show(free, u.S)}; gap = ${fmt(+q.gap)} ${u.S}`, r: free > gap ? `${MD.show(free, u.S)} > ${fmt(+q.gap)} ${u.S}, so the bar touches the wall` : `${MD.show(free, u.S)} ≤ ${fmt(+q.gap)} ${u.S}, so the gap stays open and F_${end} = 0` });
        contact = free > gap;
      }
      if (contact) {
        const fu = (f) => fmt(D(B(1, u.F) * f, u.S)); // L/(AE) in small length per force unit
        const terms = sg.map((s, i) => `(F_A${Sl[i] ? ` ${Sl[i] > 0 ? '−' : '+'} ${fmt(Math.abs(D(Sl[i], u.F)))}` : ''})(${fu(s.f)})`).join(' + ');
        S.add({ t: 'Compatibility', n: q.right === 'gap' ? `The end ${end} moves until it meets the wall, so its movement equals the gap.` : `Both ends are held, so ${end} does not move relative to A.`, f: `δ_${end}/A = ${q.right === 'gap' ? 'gap' : '0'}` , r: `δ_${end}/A = ${q.right === 'gap' ? `${fmt(+q.gap)} ${u.S}` : '0'}` });
        S.add({ t: 'Load–displacement', n: `Cut through each segment: the internal force is F_A less the loads between A and the cut. Each L/(AE) is in ${u.S}/${u.F}.` + (dT ? ' Each segment also grows by αΔTL.' : ''), f: `Σ N L/(AE)${dT ? ' + Σ αΔTL' : ''} = δ_${end}/A`, s: terms + (dT ? ` + ${MD.show(sumT, u.S)}` : '') + ` = ${MD.show(gap, u.S)}` });
        FA = (gap - sumT + sg.reduce((a, s, i) => a + Sl[i] * s.f, 0)) / sumF; FB = Ptot - FA;
        S.add({ t: 'Solve', f: `F_A from the line above, then F_${end} = ΣP − F_A`, r: `F_A = ${MD.show(FA, u.F)}, F_${end} = ${MD.show(FB, u.F)}`, n: (FA < 0 || FB < 0) ? 'A negative reaction acts the other way from the one drawn (to the right).' : 'Both reactions act as drawn (to the left).' });
      } else FA = Ptot;
    }
    // internal forces, stresses, changes in length and point displacements
    let ux = 0; const disp = [0];
    sg.forEach((s, i) => {
      s.N = FA - Sl[i]; s.sig = s.N / s.A; s.dl = s.N * s.f + s.dT; ux += s.dl; disp.push(ux);
    });
    S.add({ t: 'Internal force in each segment', n: 'Method of sections: tension is positive, compression negative.', table: { head: ['Segment', `N (${u.F})`, `σ = N/A (${u.ST})`], rows: sg.map((s) => [s.name, fmt(D(s.N, u.F)), fmt(D(s.sig, u.ST))]) } });
    S.add({ t: 'Change in length of each segment', n: 'Positive is elongation, negative is contraction.', f: dT ? 'δ = NL/(AE) + αΔTL' : 'δ = NL/(AE)', table: { head: ['Segment', 'NL/(AE)'].concat(dT ? ['αΔTL'] : []).concat([`δ (${u.S})`]), rows: sg.map((s) => [s.name, fmt(D(s.N * s.f, u.S))].concat(dT ? [fmt(D(s.dT, u.S))] : []).concat([fmt(D(s.dl, u.S))])) } });
    S.add({ t: 'Displacement of each point', n: 'Add the changes in length from A. Positive is away from A.', f: 'δ_point = Σ δ of the segments from A', table: { head: ['Point', `δ (${u.S})`], rows: disp.map((d, i) => [LET[i], fmt(D(d, u.S))]) } });
    if (fixedEnd) out.push({ k: 'Reaction at A, F_A', v: D(FA, u.F), u: u.F, hl: true }, { k: `Reaction at ${end}, F_${end}`, v: D(FB, u.F), u: u.F, hl: true });
    else out.push({ k: 'Reaction at A, F_A', v: D(FA, u.F), u: u.F });
    if (!fixedEnd || q.right === 'gap') out.push({ k: `Displacement of the end ${end}, δ_${end}`, v: D(disp[n], u.S), u: u.S, hl: !fixedEnd });
    sg.forEach((s) => out.push({ k: `Internal force N_${s.name}`, v: D(s.N, u.F), u: u.F }));
    sg.forEach((s) => out.push({ k: `Stress σ_${s.name}`, v: D(s.sig, u.ST), u: u.ST }));
    sg.forEach((s) => out.push({ k: `Change in length of ${s.name}`, v: D(s.dl, u.S), u: u.S }));
    const smax = sg.reduce((a, s) => (Math.abs(s.sig) > Math.abs(a.sig) ? s : a));
    out.push({ k: 'Largest normal stress', v: D(smax.sig, u.ST), u: u.ST, hl: true });
    const txt = fixedEnd && contact ? `F_A = ${MD.show(FA, u.F)}, F_${end} = ${MD.show(FB, u.F)}` : `δ_${end} = ${MD.show(disp[n], u.S)}`;
    return R(`${txt}; largest σ = ${MD.show(smax.sig, u.ST)} in ${smax.name}`, 'ok', out, S,
      { kind: 'bar', q, u, sg: sg.map((s) => ({ name: s.name, L: s.L, A: s.A, N: s.N, sig: s.sig, dl: s.dl, P: s.P, q: s.q })), disp, FA, FB, contact, gap, right: q.right, Lsum: sg.reduce((a, s) => a + s.L, 0) }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Members side by side under a rigid cap                             */
  /* ------------------------------------------------------------------ */
  function parallel(q, u) {
    const mem = q.mem || [], err = [];
    if (mem.length < 2) err.push('Add at least two members.');
    if (mem.length > 4) err.push('At most four kinds of member.');
    if (!(q.L > 0)) err.push('Enter the length of the members.');
    if (!isFinite(+q.P)) err.push('The load on the cap must be a number.');
    mem.forEach((m, i) => {
      const who = `Member ${i + 1}`, e = areaErr(m, u, who); if (e) err.push(e);
      if (!(m.E > 0)) err.push(`${who}: enter the modulus of elasticity E.`);
      if (!(Math.round(m.n) >= 1)) err.push(`${who}: the number of members must be at least 1.`);
    });
    if (q.layout === 'nested' && mem.length !== 2) err.push('One inside another takes exactly two members.');
    if (q.layout === 'nested' && mem.length === 2 && mem[0].shape === 'tube' && (mem[1].shape === 'circle' || mem[1].shape === 'tube') && mem[1].d > mem[0].di + 1e-9) err.push('The core is wider than the hole in the tube.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], L = B(+q.L, u.L), dT = B(+q.dT || 0, u.T), P = B(+q.P, u.F);
    const M = mem.map((m, i) => { const A = areaOf(m, u), E = B(+m.E, u.MOD); return { i, n: Math.round(m.n), A, E, k: (A * E) / L, al: alpha(m, u), m }; });
    S.add({ t: 'Members', n: 'Every member has the same length and the cap is rigid.', table: { head: ['Member', 'How many', `A (${u.A})`, `E (${u.MOD})`].concat(dT ? [`α (10⁻⁶/${u.T})`] : []), rows: M.map((m) => [String(m.i + 1), String(m.n), fmt(D(m.A, u.A)), fmt(+m.m.E)].concat(dT ? [fmt(+m.m.al || 0)] : [])) } });
    const Fn = M.map((m) => `${m.n > 1 ? m.n : ''}F${m.i + 1}`).join(' + ');
    S.add({ t: 'Equilibrium', n: `Each F is the compressive force carried by one member (tension is negative). There are ${M.length} unknown forces and one equation, so the problem is statically indeterminate.`, f: `${Fn} − P = 0`, s: `${Fn} = ${MD.show(P, u.F)}` });
    S.add({ t: 'Compatibility', n: 'The rigid cap moves every member by the same amount.', f: M.map((m) => `δ${m.i + 1}`).join(' = '), r: 'δ is the shortening of each member' });
    S.add({ t: 'Load–displacement', n: dT ? 'The force shortens a member; the temperature rise lengthens it.' : 'Each member shortens by FL/(AE).', f: dT ? 'δ = FL/(AE) − αΔTL, so F = (AE/L)(δ + αΔTL)' : 'δ = FL/(AE), so F = (AE/L)δ',
      table: { head: ['Member', `AE/L (${u.F}/${u.S})`].concat(dT ? [`αΔTL (${u.S})`] : []), rows: M.map((m) => [String(m.i + 1), fmt(D(m.k * B(1, u.S), u.F))].concat(dT ? [fmt(D(m.al * dT * L, u.S))] : [])) } });
    const sk = M.reduce((a, m) => a + m.n * m.k, 0), skT = M.reduce((a, m) => a + m.n * m.k * m.al * dT * L, 0);
    const del = (P - skT) / sk;
    M.forEach((m) => { m.F = m.k * (del + m.al * dT * L); m.sig = -m.F / m.A; });
    S.add({ t: 'Solve', n: 'Put each F into the equilibrium equation and solve for δ, then each force.', f: dT ? 'δ = (P − Σ n(AE/L)αΔTL) / Σ n(AE/L)' : 'δ = P / Σ n(AE/L)', s: `δ = ${MD.show(del, u.S)}`, r: M.map((m) => `F${m.i + 1} = ${MD.show(m.F, u.F)}`).join(', ') });
    S.add({ t: 'Average normal stress', f: 'σ = F/A', table: { head: ['Member', `F (${u.F})`, `σ (${u.ST})`, ''], rows: M.map((m) => [String(m.i + 1), fmt(D(m.F, u.F)), fmt(D(Math.abs(m.sig), u.ST)), Math.abs(m.F) < 1e-9 ? '' : m.F > 0 ? 'compression' : 'tension']) } });
    M.forEach((m) => out.push({ k: `Force in member ${m.i + 1}, F${m.i + 1}`, v: D(m.F, u.F), u: u.F, hl: true }));
    M.forEach((m) => out.push({ k: `Stress in member ${m.i + 1}, σ${m.i + 1}`, v: D(m.sig, u.ST), u: u.ST, hl: true }));
    out.push({ k: 'Movement of the cap δ (down)', v: D(del, u.S), u: u.S });
    return R(M.map((m) => `F${m.i + 1} = ${MD.show(m.F, u.F)}`).join(', '), 'ok', out, S, { kind: 'parallel', q, u, M: M.map((m) => ({ n: m.n, F: m.F, sig: m.sig, A: m.A, m: m.m })), del, L });
  }

  /* ------------------------------------------------------------------ */
  /* Rigid bar on rods or posts                                         */
  /* ------------------------------------------------------------------ */
  function rigid(q, u) {
    const rods = q.rods || [], loads = q.loads || [], err = [], hang = q.side !== 'post', noun = hang ? 'rod' : 'post';
    const len = +q.len;
    if (!(len > 0)) err.push('Enter the length of the rigid bar.');
    if (rods.length < 1 || rods.length > 3) err.push(`Use one to three ${noun}s.`);
    rods.forEach((r, i) => {
      const who = `${hang ? 'Rod' : 'Post'} ${i + 1}`, e = areaErr(r, u, who); if (e) err.push(e);
      if (!(r.L > 0)) err.push(`${who}: enter its length.`);
      if (!(r.E > 0)) err.push(`${who}: enter the modulus of elasticity E.`);
      if (!(r.x >= 0 && r.x <= len)) err.push(`${who}: its position must lie on the bar (0 to ${fmt(len)} ${u.L}).`);
    });
    loads.forEach((l, i) => { if (!(l.x >= 0 && l.x <= len)) err.push(`Load ${i + 1}: its position must lie on the bar.`); });
    if (q.pin && !(q.xp >= 0 && q.xp <= len)) err.push('The pin must lie on the bar.');
    const nUnk = rods.length + (q.pin ? 1 : 0);
    if (!err.length && nUnk < 2) err.push(`A single ${noun} cannot hold the bar level: add another ${noun} or a pin.`);
    const xs = rods.map((r) => +r.x).concat(q.pin ? [+q.xp] : []);
    if (!err.length && new Set(xs.map((x) => x.toFixed(9))).size < xs.length) err.push(`Two supports are at the same point; move one of the ${noun}s or the pin.`);
    if (!err.length && !(Math.max(...xs) - Math.min(...xs) > 0)) err.push('The supports must be at different points.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], dT = B(+q.dT || 0, u.T), sg = hang ? 1 : -1, w = B(+q.w || 0, u.W), Lb = B(len, u.L);
    const Rd = rods.map((r, i) => {
      const L = B(+r.L, u.L), A = areaOf(r, u), E = B(+r.E, u.MOD);
      return { i, x: B(+r.x, u.L), L, A, E, k: (A * E) / L, th: alpha(r, u) * dT * L, r };
    });
    const P = loads.map((l) => ({ x: B(+l.x, u.L), P: B(+l.P, u.F) })).concat(w ? [{ x: Lb / 2, P: w * Lb, dist: true }] : []);
    const W = P.reduce((a, p) => a + p.P, 0), Mw = P.reduce((a, p) => a + p.P * p.x, 0);
    const name = (i) => `F${i + 1}`;
    S.add({ t: `${hang ? 'Rods' : 'Posts'}`, n: `Positions are measured along the rigid bar from its left end.${w ? ' The uniform load is replaced by its resultant at the middle of the bar.' : ''}`, table: { head: [hang ? 'Rod' : 'Post', `x (${u.L})`, `L (${u.L})`, `A (${u.A})`, `E (${u.MOD})`].concat(dT ? [`α (10⁻⁶/${u.T})`] : []), rows: Rd.map((r) => [String(r.i + 1), fmt(+r.r.x), fmt(+r.r.L), fmt(D(r.A, u.A)), fmt(+r.r.E)].concat(dT ? [fmt(+r.r.al || 0)] : [])) } });
    // displacement of the bar: d(x) = v0 + θ x (down positive); force carried F_i = k_i (d_i − sg α ΔT L_i)
    const xp = B(+q.xp || 0, u.L), ref = q.pin ? xp : Rd[0].x, refN = q.pin ? 'the pin' : `${noun} 1`;
    const eqF = Rd.map((r) => name(r.i)).join(' + ') + (q.pin ? ' + R_pin' : '') + ` − ${fmt(D(W, u.F))} = 0`;
    const momTerm = (F, x) => { const a = D(x - ref, u.L); return Math.abs(a) < 1e-12 ? null : `${F}(${fmt(a)})`; };
    const eqM = Rd.map((r) => momTerm(name(r.i), r.x)).filter(Boolean).join(' + ') + ` − ${P.map((p) => `${fmt(D(p.P, u.F))}(${fmt(D(p.x - ref, u.L))})`).join(' − ') || '0'} = 0`;
    const determinate = nUnk === 2;
    S.add({ t: 'Equilibrium of the rigid bar', n: `Each F is the force in a ${noun}, positive in ${hang ? 'tension' : 'compression'}. ${nUnk} unknowns and two equations: the bar is ${determinate ? 'statically determinate' : 'statically indeterminate'}. Moments are taken about ${refN}.`, f: '+↑ΣFy = 0;  ΣM = 0', s: `${eqF};  ${eqM}` });
    let v0, th;
    if (q.pin) {
      // v0 = −θ xp; moment about pin: Σ k_i((x_i − xp)θ − sg th_i)(x_i − xp) = Σ P (x − xp)
      const a = Rd.reduce((s, r) => s + r.k * (r.x - xp) ** 2, 0), b = Mw - W * xp + Rd.reduce((s, r) => s + r.k * sg * r.th * (r.x - xp), 0);
      th = b / a; v0 = -th * xp;
    } else {
      const k = Rd.reduce((s, r) => s + r.k, 0), kx = Rd.reduce((s, r) => s + r.k * r.x, 0), kxx = Rd.reduce((s, r) => s + r.k * r.x * r.x, 0);
      const t0 = Rd.reduce((s, r) => s + r.k * sg * r.th, 0), t1 = Rd.reduce((s, r) => s + r.k * sg * r.th * r.x, 0);
      const sol = (Core.linSolve([[k, kx], [kx, kxx]], [W + t0, Mw + t1]) || {}).x;
      if (!sol || !sol.every(isFinite)) return fail([`The ${noun}s cannot hold the bar: check their positions.`]);
      [v0, th] = sol;
    }
    const dAt = (x) => v0 + th * x;
    Rd.forEach((r) => { r.d = dAt(r.x); r.F = r.k * (r.d - sg * r.th); r.sig = (sg * r.F) / r.A; r.dl = sg * (r.F / r.k + sg * r.th); });
    const Rpin = q.pin ? W - Rd.reduce((s, r) => s + r.F, 0) : 0;
    const dl = (r) => `δ${r.i + 1} = ${name(r.i)}L${r.i + 1}/(A${r.i + 1}E${r.i + 1})${dT ? ` ${hang ? '+' : '−'} αΔTL${r.i + 1}` : ''}`;
    if (determinate) {
      S.add({ t: 'Solve the equilibrium equations', r: Rd.map((r) => `${name(r.i)} = ${MD.show(r.F, u.F)}`).join(', ') + (q.pin ? `, R_pin = ${MD.show(Rpin, u.F)}` : '') });
      S.add({ t: `Change in length of each ${noun}`, f: Rd.map(dl).join(';  '), table: { head: [hang ? 'Rod' : 'Post', `F (${u.F})`, `δ (${u.S})`, ''], rows: Rd.map((r) => [String(r.i + 1), fmt(D(r.F, u.F)), fmt(D(Math.abs(r.dl), u.S)), r.dl >= 0 ? 'longer' : 'shorter']) } });
    } else {
      const c = q.pin
        ? `The bar turns about the pin, so the movements are in proportion to the distances from it: ${Rd.map((r) => `δ${r.i + 1}/${fmt(D(r.x - xp, u.L))}`).join(' = ')}`
        : `The bar stays straight, so the movements lie on a line (similar triangles): δ2 = δ1 + (δ3 − δ1)(${fmt(D(Rd[1].x - Rd[0].x, u.L))}/${fmt(D(Rd[2].x - Rd[0].x, u.L))})`;
      S.add({ t: 'Compatibility', n: c, f: q.pin ? 'δ_i = θ(x_i − x_pin)' : 'δ(x) = δ1 + θ(x − x1)' });
      S.add({ t: 'Load–displacement', n: `The bar moves down by the amount each ${noun} ${hang ? 'stretches' : 'shortens'}.`, f: Rd.map(dl).join(';  ') });
      S.add({ t: 'Solve', n: 'Equilibrium, compatibility and load–displacement together.', r: Rd.map((r) => `${name(r.i)} = ${MD.show(r.F, u.F)}`).join(', ') + (q.pin ? `, R_pin = ${MD.show(Rpin, u.F)}` : '') });
    }
    S.add({ t: `Stress in each ${noun}`, f: 'σ = F/A', table: { head: [hang ? 'Rod' : 'Post', `F (${u.F})`, `σ (${u.ST})`, `bar moves down (${u.S})`], rows: Rd.map((r) => [String(r.i + 1), fmt(D(r.F, u.F)), fmt(D(r.sig, u.ST)), fmt(D(r.d, u.S))]) } });
    const pts = loads.map((l, i) => ({ x: B(+l.x, u.L), i }));
    if (pts.length) S.add({ t: 'Movement of the loaded points', n: 'The bar is rigid, so the movement varies in a straight line between the supports (by proportion).', table: { head: ['Load', `x (${u.L})`, `moves down (${u.S})`], rows: pts.map((p) => [String(p.i + 1), fmt(D(p.x, u.L)), fmt(D(dAt(p.x), u.S))]) } });
    const N = hang ? 'rod' : 'post';
    Rd.forEach((r) => out.push({ k: `Force in ${N} ${r.i + 1}, F${r.i + 1}`, v: D(r.F, u.F), u: u.F, hl: true }));
    Rd.forEach((r) => out.push({ k: `Stress in ${N} ${r.i + 1}, σ${r.i + 1}`, v: D(r.sig, u.ST), u: u.ST }));
    if (q.pin) out.push({ k: 'Pin reaction R (up)', v: D(Rpin, u.F), u: u.F, hl: true });
    pts.forEach((p) => out.push({ k: `Load ${p.i + 1} point moves down`, v: D(dAt(p.x), u.S), u: u.S }));
    Rd.forEach((r) => out.push({ k: `${hang ? 'Rod' : 'Post'} ${r.i + 1} point moves down`, v: D(r.d, u.S), u: u.S }));
    return R(Rd.map((r) => `F${r.i + 1} = ${MD.show(r.F, u.F)}`).join(', '), 'ok', out, S,
      { kind: 'rigid', q, u, hang, Rd: Rd.map((r) => ({ x: r.x, L: r.L, A: r.A, F: r.F, sig: r.sig, d: r.d, dl: r.dl, r: r.r })), v0, th, Rpin, xp, Lb, P, w, W });
  }

  /* ------------------------------------------------------------------ */
  /* Stress concentration                                               */
  /* ------------------------------------------------------------------ */
  function conc(q, u) {
    const err = [], hole = q.geo === 'hole';
    if (!(q.w > 0)) err.push('Enter the width of the bar w.');
    if (!(q.t > 0)) err.push('Enter the thickness t.');
    if (hole && !(q.d > 0 && q.d < q.w)) err.push('The hole must be narrower than the bar.');
    if (!hole && !(q.h > 0 && q.h < q.w)) err.push('The narrow width h must be less than the wide width w.');
    if (!hole && !(q.r > 0)) err.push('Enter the fillet radius r.');
    if (!(q.K >= 1)) err.push('The stress concentration factor K is at least 1.');
    if (q.task === 'max' && !(q.N > 0)) err.push('Enter the axial force N.');
    if (q.task === 'allow' && !(q.sA > 0)) err.push('Enter the stress that must not be passed.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], K = +q.K;
    const An = hole ? (q.w - q.d) * q.t : q.h * q.t, A = B(An, u.A);
    if (hole) S.add({ t: 'Ratio for the chart', n: 'For a bar with a hole, the chart (Fig. 9–24) is read with 2r/w.', f: '2r/w', s: `${fmt(+q.d)}/${fmt(+q.w)}`, r: `2r/w = ${fmt(q.d / q.w)}` });
    else S.add({ t: 'Ratios for the chart', n: 'For shoulder fillets, the chart (Fig. 9–23) is read with r/h on the curve for w/h.', f: 'r/h, w/h', s: `${fmt(+q.r)}/${fmt(+q.h)}, ${fmt(+q.w)}/${fmt(+q.h)}`, r: `r/h = ${fmt(q.r / q.h)}, w/h = ${fmt(q.w / q.h)}` });
    S.add({ t: 'Stress concentration factor', n: 'Read from the chart for these ratios and typed in.', r: `K = ${fmt(K)}` });
    S.add({ t: 'Smallest cross-section', f: hole ? 'A = (w − 2r)t' : 'A = h t', s: hole ? `(${fmt(+q.w)} − ${fmt(+q.d)})(${fmt(+q.t)})` : `(${fmt(+q.h)})(${fmt(+q.t)})`, r: `A = ${fmt(An)} ${u.A}` });
    let N, savg, smax;
    if (q.task === 'max') {
      N = B(+q.N, u.F); savg = N / A; smax = K * savg;
      S.add({ t: 'Average normal stress', f: 'σ_avg = N/A', s: `${fmt(+q.N)} ${u.F} / ${fmt(An)} ${u.A}`, r: `σ_avg = ${MD.show(savg, u.ST)}` });
      S.add({ t: 'Maximum normal stress', f: 'σ_max = K σ_avg', s: `(${fmt(K)})(${MD.show(savg, u.ST)})`, r: `σ_max = ${MD.show(smax, u.ST)}` });
    } else {
      smax = B(+q.sA, u.ST); savg = smax / K; N = savg * A;
      S.add({ t: 'Largest load', n: 'The peak stress at the edge of the smallest section reaches the given stress.', f: 'σ_max = K(N/A), so N = σ_max A / K', s: `N = (${fmt(+q.sA)} ${u.ST})(${fmt(An)} ${u.A}) / ${fmt(K)}`, r: `N = ${MD.show(N, u.F)}` });
    }
    out.push({ k: 'Smallest area A', v: An, u: u.A });
    out.push({ k: 'Average normal stress σ_avg', v: D(savg, u.ST), u: u.ST, hl: q.task === 'max' });
    out.push({ k: 'Maximum normal stress σ_max', v: D(smax, u.ST), u: u.ST, hl: q.task === 'max' });
    if (q.task === 'allow') out.push({ k: 'Largest axial force N', v: D(N, u.F), u: u.F, hl: true });
    return R(q.task === 'max' ? `σ_max = ${MD.show(smax, u.ST)}` : `N = ${MD.show(N, u.F)}`, 'ok', out, S, { kind: 'conc', q, u, N: D(N, u.F), savg: D(savg, u.ST), smax: D(smax, u.ST), An });
  }

  const Axial = { defaults, solve, convertState, KINDS };
  root.Axial = Axial;
  if (typeof module !== 'undefined' && module.exports) module.exports = Axial;
})(typeof window !== 'undefined' ? window : globalThis);
