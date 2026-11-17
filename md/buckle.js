/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M8 Buckling of Columns
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Sections 17.1 to 17.3.
 *   P_cr = π²EI/(KL)²,  σ_cr = π²E/(KL/r)²  (Euler, 17–11 and 17–12)
 *   K = 1 pinned ends, 2 fixed and free, 0.5 fixed ends, 0.7 pinned and fixed.
 * Each axis of the section has its own end supports and bracing, so the
 * column can buckle about either one; the smaller load governs. If σ_cr
 * would pass the yield stress, the column yields before it buckles and the
 * load is σ_Y A.
 *   task load    critical and allowable load of a given column
 *   task length  longest column for a load and factor of safety
 *   task size    smallest round bar, square bar or W shape for a load
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const BS = root.BeamStress || require('./beamstress.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const FU = { SI: ['kN', 'N'], US: ['kip', 'lb'] };
  const SUP = { pp: { K: 1, name: 'Pinned at both ends' }, ff: { K: 0.5, name: 'Fixed at both ends' }, fp: { K: 0.7, name: 'Fixed at one end, pinned at the other' }, fr: { K: 2, name: 'Fixed at the base, free at the top' }, k: { K: null, name: 'Your own K' } };
  const IN = 0.0254;

  function defaults() {
    return {
      fu: 'kN', task: 'load', L: 5,
      sec: { src: 'given', shape: 'circle', d: 50, di: 30, b: 50, h: 100, W: 'W8×31', A: 7500, Ix: 61.3e6, Iy: 23.2e6 },
      ax: { sup: 'fr', K: 2, n: 1 }, ay: { sup: 'fp', K: 0.7, n: 1 },
      mat: 'custom', E: 70, sY: 215, FS: 3, P: 100, step: 0,
    };
  }
  const KINDS = { top: { L: 'L', E: 'MOD', sY: 'ST' }, sec: { d: 'S', di: 'S', b: 'S', h: 'S', A: 'A', Ix: 'I', Iy: 'I' } };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = FU[from].includes(st.fu) ? st.fu : FU[from][0], f1 = Core.twin(fu, to);
    MD.convertObj(st, KINDS.top, from, to, fu); MD.convertObj(st.sec, KINDS.sec, from, to, fu);
    MD.convertObj(st, { step: 'S' }, from, to, fu);
    if (isFinite(+st.P)) st.P = Core.tidy(Core.convert(+st.P, fu, f1), 6);
    st.fu = f1;
    return st;
  }
  const Kof = (a) => (a.sup === 'k' ? +a.K : SUP[a.sup] ? SUP[a.sup].K : 1);

  /** Section properties in base units: A, Ix (strong), Iy (weak), and a description. */
  function sectionOf(sc, u) {
    if (sc.src === 'W') {
      const w = BS.WT.find((x) => x.name === sc.W) || BS.WT[0];
      return { A: w.A * IN ** 2, Ix: w.Ix * IN ** 4, Iy: w.Iy * IN ** 4, desc: `${w.name}: A = ${fmt(w.A)} in.², I_x = ${fmt(w.Ix)} in.⁴, I_y = ${fmt(w.Iy)} in.⁴ (table)`, w, kind: 'W' };
    }
    if (sc.src === 'given') return { A: B(+sc.A, u.A), Ix: B(+sc.Ix, u.I), Iy: B(+sc.Iy, u.I), desc: 'A, I_x and I_y as given', kind: 'given' };
    if (sc.shape === 'rect') { const b = B(+sc.b, u.S), h = B(+sc.h, u.S); return { A: b * h, Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12, desc: `A = bh, I_x = bh³/12, I_y = hb³/12 (b = ${fmt(+sc.b)} ${u.S}, h = ${fmt(+sc.h)} ${u.S})`, kind: 'rect', b, h }; }
    const ro = B(+sc.d, u.S) / 2, ri = sc.shape === 'tube' ? B(+sc.di, u.S) / 2 : 0, I = (Math.PI / 4) * (ro ** 4 - ri ** 4);
    return { A: Math.PI * (ro * ro - ri * ri), Ix: I, Iy: I, desc: sc.shape === 'tube' ? `A = π(c_o² − c_i²), I = π(c_o⁴ − c_i⁴)/4 (d_o = ${fmt(+sc.d)} ${u.S}, d_i = ${fmt(+sc.di)} ${u.S})` : `A = πc², I = πc⁴/4 (d = ${fmt(+sc.d)} ${u.S})`, kind: sc.shape, ro, ri };
  }

  function solve(st, U) {
    if (!FU[U.id].includes(st.fu)) st.fu = FU[U.id][0];
    const u = units(U, st.fu), sc = st.sec, err = [];
    if (!(st.L > 0)) err.push('Enter the length of the column.');
    if (!(st.E > 0)) err.push('Enter the modulus of elasticity E.');
    if (!(st.sY > 0)) err.push('Enter the yield stress σ_Y.');
    if (!(st.FS >= 1)) err.push('The factor of safety must be at least 1.');
    [['x–x', st.ax], ['y–y', st.ay]].forEach(([n, a]) => {
      if (!(Kof(a) > 0)) err.push(`Enter a K above 0 for the ${n} axis.`);
      if (!(Number.isInteger(+a.n) && a.n >= 1 && a.n <= 6)) err.push(`The number of braced lengths about ${n} must be a whole number from 1 to 6.`);
    });
    if (st.task !== 'load' && !(st.P > 0)) err.push('Enter the load the column must carry.');
    if (st.task !== 'size' || sc.src !== 'shape') {
      if (sc.src === 'shape' && sc.shape !== 'rect' && !(sc.d > 0)) err.push('Enter the diameter.');
      if (sc.src === 'shape' && sc.shape === 'tube' && !(sc.di >= 0 && sc.di < sc.d)) err.push('The inner diameter must be smaller than the outer diameter.');
      if (sc.src === 'shape' && sc.shape === 'rect' && !(sc.b > 0 && sc.h > 0)) err.push('Enter both sides of the rectangle.');
      if (sc.src === 'given' && !(sc.A > 0 && sc.Ix > 0 && sc.Iy > 0)) err.push('Enter A, I_x and I_y.');
    }
    if (st.task === 'size' && sc.src === 'shape' && sc.shape === 'tube') err.push('To size a column pick a round bar, a square bar or a W shape.');
    if (st.task === 'size' && sc.src === 'given') err.push('To size a column pick a round bar, a square bar or a W shape.');
    if (err.length) return fail(err);
    const L = B(+st.L, u.L), E = B(+st.E, u.MOD), sY = B(+st.sY, u.ST), FS = +st.FS;
    const axes = [['x', 'x–x', st.ax], ['y', 'y–y', st.ay]].map(([k, n, a]) => ({ k, n, K: Kof(a), sup: a.sup, nb: +a.n, Lb: L / +a.n }));
    axes.forEach((a) => (a.KL = a.K * a.Lb));
    if (st.task === 'size') return size(st, u, L, E, sY, FS, axes);
    if (st.task === 'length') return length(st, u, E, sY, FS, axes);
    return load(st, u, L, E, sY, FS, axes);
  }
  const R = MD.result;
  const supTxt = (a) => `${SUP[a.sup] ? SUP[a.sup].name : 'K given'}${a.nb > 1 ? `, braced into ${a.nb} equal lengths` : ''}`;

  /** The shared steps: effective lengths, Euler loads about each axis, governing axis, yield check. */
  function euler(S, out, u, sec, E, sY, axes) {
    S.add({ t: 'Section', r: sec.desc + (sec.kind === 'W' && u.us === false ? ` = A ${MD.show(sec.A, u.A)}, I_x ${MD.show(sec.Ix, u.I)}, I_y ${MD.show(sec.Iy, u.I)}` : '') });
    S.add({ t: 'Effective length about each axis', n: 'K turns each support case into a pinned-end column of length KL, the distance between points of zero moment. Bracing shortens the length that can buckle.',
      f: 'L_e = K L_b', table: { head: ['Axis', 'Supports', `L_b (${u.L})`, 'K', `KL (${u.L})`], rows: axes.map((a) => [a.n, supTxt(a), fmt(D(a.Lb, u.L)), fmt(a.K), fmt(D(a.KL, u.L))]) } });
    axes.forEach((a) => { a.I = a.k === 'x' ? sec.Ix : sec.Iy; a.r = Math.sqrt(a.I / sec.A); a.sl = a.KL / a.r; a.P = (Math.PI ** 2 * E * a.I) / a.KL ** 2; a.s = a.P / sec.A; });
    S.add({ t: 'Euler load about each axis', f: 'P_cr = π²EI/(KL)²', table: { head: ['Axis', `I (${u.I})`, `P_cr (${u.F})`], rows: axes.map((a) => [a.n, fmt(D(a.I, u.I)), `π²(${fmt(D(E, u.MOD))} ${u.MOD})(${fmt(D(a.I, u.I))})/(${fmt(D(a.KL, u.L))} ${u.L})² = ${fmt(D(a.P, u.F))}`]) } });
    const g = axes[0].P <= axes[1].P ? axes[0] : axes[1];
    S.add({ t: 'Buckling axis', n: 'The column buckles about the axis with the smaller critical load.', r: `It buckles about the ${g.n} axis: P_cr = ${MD.show(g.P, u.F)}` });
    S.add({ t: 'Critical stress and slenderness', f: 'σ_cr = P_cr/A = π²E/(KL/r)²,  r = √(I/A)', table: { head: ['Axis', `r (${u.S})`, 'KL/r', `σ_cr (${u.ST})`], rows: axes.map((a) => [a.n, fmt(D(a.r, u.S)), fmt(a.sl), fmt(D(a.s, u.ST))]) } });
    axes.forEach((a) => {
      out.push({ k: `Effective length about ${a.k}, (KL)_${a.k}`, v: D(a.KL, u.L), u: u.L }, { k: `Slenderness ratio (KL/r)_${a.k}`, v: a.sl, u: '' }, { k: `Critical load about ${a.k}, (P_cr)_${a.k}`, v: D(a.P, u.F), u: u.F });
    });
    const yields = g.s > sY;
    S.add({ t: 'Yield check', f: 'σ_cr ≤ σ_Y for Euler to hold', s: `σ_cr = ${MD.show(g.s, u.ST)} ${yields ? '>' : '≤'} σ_Y = ${MD.show(sY, u.ST)}`,
      n: yields ? 'The stress reaches yield first: the column yields before it buckles, so the load is found from simple compression, P = σ_Y A.' : 'The material is still elastic when the column buckles, so Euler\'s formula holds.' });
    return { g, yields };
  }

  function load(st, u, L, E, sY, FS, axes) {
    const S = Steps(), out = [], sec = sectionOf(st.sec, u), { g, yields } = euler(S, out, u, sec, E, sY, axes);
    const Pmax = yields ? sY * sec.A : g.P, Pa = Pmax / FS;
    if (yields) S.add({ t: 'Load at yield', f: 'P = σ_Y A', s: `P = (${MD.show(sY, u.ST)})(${fmt(D(sec.A, u.A))} ${u.A})`, r: `P = ${MD.show(Pmax, u.F)}` });
    S.add({ t: 'Allowable load', f: 'P_allow = P/F.S.', s: `P_allow = ${MD.show(Pmax, u.F)}/${fmt(FS)}`, r: `P_allow = ${MD.show(Pa, u.F)}` });
    out.push({ k: 'Buckling axis', v: g.n, u: '' }, { k: 'Critical load P_cr', v: D(g.P, u.F), u: u.F, hl: true }, { k: 'Critical stress σ_cr', v: D(g.s, u.ST), u: u.ST });
    out.push({ k: 'Yields before it buckles', v: yields ? 'Yes' : 'No', u: '' }, { k: 'Largest load P', v: D(Pmax, u.F), u: u.F, hl: true }, { k: 'Allowable load P_allow', v: D(Pa, u.F), u: u.F, hl: true });
    return R(yields ? `Yields before it buckles: P = σ_Y A = ${MD.show(Pmax, u.F)}; P_allow = ${MD.show(Pa, u.F)}` : `Buckles about ${g.n} at P_cr = ${MD.show(g.P, u.F)}; P_allow = ${MD.show(Pa, u.F)}`, yields ? 'warn' : 'ok', out, S,
      { kind: 'column', u, L, E, sY, FS, axes, g, yields, sec, Pmax, Pa }, yields ? ['The column yields before it buckles, so Euler\'s formula does not apply.'] : []);
  }

  function length(st, u, E, sY, FS, axes) {
    const S = Steps(), out = [], sec = sectionOf(st.sec, u), P = B(+st.P, u.F), Pd = P * FS;
    S.add({ t: 'Section', r: sec.desc });
    S.add({ t: 'Load the column must reach', f: 'P_cr = (F.S.)P', s: `P_cr = ${fmt(FS)}(${MD.show(P, u.F)})`, r: `P_cr = ${MD.show(Pd, u.F)}` });
    if (Pd / sec.A > sY) return fail([`At ${MD.show(Pd, u.F)} the stress P/A = ${MD.show(Pd / sec.A, u.ST)} is already past yield, so no length works: use a larger section.`]);
    let Lmax = Infinity, gov = null;
    const rows = axes.map((a) => {
      a.I = a.k === 'x' ? sec.Ix : sec.Iy; a.r = Math.sqrt(a.I / sec.A);
      const KLm = Math.PI * Math.sqrt((E * a.I) / Pd), Lm = (KLm / a.K) * a.nb;
      if (Lm < Lmax) { Lmax = Lm; gov = a; }
      return [a.n, fmt(D(a.I, u.I)), fmt(D(KLm, u.L)), fmt(a.K), fmt(D(Lm, u.L))];
    });
    S.add({ t: 'Longest length about each axis', n: 'Solve Euler\'s formula for KL, then divide by K and multiply by the number of braced lengths.', f: 'KL = π√(EI/P_cr),  L = n(KL)/K', table: { head: ['Axis', `I (${u.I})`, `KL (${u.L})`, 'K', `L (${u.L})`], rows } });
    S.add({ t: 'Longest column', n: 'The shorter of the two lengths governs.', r: `L = ${MD.show(Lmax, u.L)} (buckling about ${gov.n})` });
    const L = Lmax;
    axes.forEach((a) => { a.Lb = L / a.nb; a.KL = a.K * a.Lb; a.sl = a.KL / a.r; a.P = (Math.PI ** 2 * E * a.I) / a.KL ** 2; a.s = a.P / sec.A; });
    out.push({ k: 'Load with the factor of safety, (F.S.)P', v: D(Pd, u.F), u: u.F }, { k: 'Largest length L', v: D(L, u.L), u: u.L, hl: true }, { k: 'Buckling axis', v: gov.n, u: '' }, { k: 'Critical stress σ_cr', v: D(Pd / sec.A, u.ST), u: u.ST });
    return R(`Longest column L = ${MD.show(L, u.L)} (buckles about ${gov.n})`, 'ok', out, S, { kind: 'column', u, L, E, sY, FS, axes, g: gov, yields: false, sec, Pmax: Pd, Pa: P });
  }

  function size(st, u, L, E, sY, FS, axes) {
    const S = Steps(), out = [], sc = st.sec, P = B(+st.P, u.F), Pd = P * FS;
    S.add({ t: 'Load the column must reach', f: 'P_cr = (F.S.)P', s: `P_cr = ${fmt(FS)}(${MD.show(P, u.F)})`, r: `P_cr = ${MD.show(Pd, u.F)}` });
    S.add({ t: 'Effective length about each axis', f: 'L_e = K L_b', table: { head: ['Axis', 'Supports', 'K', `KL (${u.L})`], rows: axes.map((a) => [a.n, supTxt(a), fmt(a.K), fmt(D(a.KL, u.L))]) } });
    let sec;
    if (sc.src === 'W') {
      const list = BS.WT.slice().sort((a, b) => a.wt - b.wt), rows = [];
      let pick = null;
      for (const w of list) {
        const A = w.A * IN ** 2, Ix = w.Ix * IN ** 4, Iy = w.Iy * IN ** 4, Px = (Math.PI ** 2 * E * Ix) / axes[0].KL ** 2, Py = (Math.PI ** 2 * E * Iy) / axes[1].KL ** 2, Pc = Math.min(Px, Py, sY * A), ok = Pc >= Pd * (1 - 1e-9);
        rows.push([w.name, fmt(w.wt), fmt(D(Px, u.F)), fmt(D(Py, u.F)), fmt(D(sY * A, u.F)), ok ? 'yes' : 'no']);
        if (ok) { pick = w; break; }
      }
      S.add({ t: 'Try W shapes from the lightest', n: 'The shape must reach the load about both axes and without yielding (σ_Y A).', table: { head: ['Shape', 'lb/ft', `(P_cr)_x (${u.F})`, `(P_cr)_y (${u.F})`, `σ_Y A (${u.F})`, 'Enough'], rows } });
      if (!pick) return fail(['None of the W shapes in the table is strong enough. Shorten or brace the column.']);
      sec = sectionOf({ src: 'W', W: pick.name }, u);
      out.push({ k: 'Lightest W shape', v: pick.name, u: '' });
    } else {
      const shape = sc.shape === 'rect' ? 'square' : 'circle', need = axes.map((a) => (Pd * a.KL ** 2) / (Math.PI ** 2 * E)), Ineed = Math.max(...need);
      S.add({ t: 'Moment of inertia needed', n: 'A round or square bar has the same I about both axes, so the axis with the longer effective length governs.', f: 'I = P_cr(KL)²/(π²E)', r: `I = ${MD.show(Ineed, u.I)}` });
      let dd = shape === 'circle' ? Math.pow((64 * Ineed) / Math.PI, 0.25) : Math.pow(12 * Ineed, 0.25);
      S.add({ t: shape === 'circle' ? 'Diameter from buckling' : 'Side from buckling', f: shape === 'circle' ? 'I = πd⁴/64' : 'I = a⁴/12', r: `${shape === 'circle' ? 'd' : 'a'} = ${MD.show(dd, u.S)}` });
      const Ay = Pd / sY, dy = shape === 'circle' ? Math.sqrt((4 * Ay) / Math.PI) : Math.sqrt(Ay);
      if (dy > dd) { S.add({ t: 'Yield governs', n: 'At the buckling size the stress would pass yield, so the area must be larger.', f: 'A = P_cr/σ_Y', r: `${shape === 'circle' ? 'd' : 'a'} = ${MD.show(dy, u.S)}` }); dd = dy; }
      out.push({ k: shape === 'circle' ? 'Required diameter d' : 'Required side a', v: D(dd, u.S), u: u.S, hl: true });
      let use = dd;
      if (st.step > 0) { const stp = B(+st.step, u.S); use = Math.ceil(dd / stp - 1e-9) * stp; out.push({ k: 'Size to use (rounded up)', v: D(use, u.S), u: u.S, hl: true }); S.add({ t: 'Round up', r: `Use ${MD.show(use, u.S)}` }); }
      sec = shape === 'circle' ? { A: (Math.PI * use * use) / 4, Ix: (Math.PI * use ** 4) / 64, Iy: (Math.PI * use ** 4) / 64, kind: 'circle', ro: use / 2, ri: 0 } : { A: use * use, Ix: use ** 4 / 12, Iy: use ** 4 / 12, kind: 'rect', b: use, h: use };
    }
    axes.forEach((a) => { a.I = a.k === 'x' ? sec.Ix : sec.Iy; a.r = Math.sqrt(a.I / sec.A); a.sl = a.KL / a.r; a.P = (Math.PI ** 2 * E * a.I) / a.KL ** 2; a.s = a.P / sec.A; });
    const g = axes[0].P <= axes[1].P ? axes[0] : axes[1], yields = g.s > sY, Pmax = yields ? sY * sec.A : g.P;
    S.add({ t: 'Check the section chosen', r: `P_cr = ${MD.show(g.P, u.F)} about ${g.n}${yields ? `, but it yields first at σ_Y A = ${MD.show(Pmax, u.F)}` : ''}; needed ${MD.show(Pd, u.F)}` });
    out.push({ k: 'Critical load P_cr', v: D(g.P, u.F), u: u.F }, { k: 'Buckling axis', v: g.n, u: '' }, { k: 'Largest load P', v: D(Pmax, u.F), u: u.F }, { k: 'Allowable load P_allow', v: D(Pmax / FS, u.F), u: u.F });
    return R(`Use ${out[0].v}${out[0].u ? ' ' + out[0].u : ''}${out.find((o) => o.k === 'Size to use (rounded up)') ? ` (${fmt(out.find((o) => o.k === 'Size to use (rounded up)').v)} ${u.S})` : ''}`, 'ok', out, S, { kind: 'column', u, L, E, sY, FS, axes, g, yields, sec, Pmax, Pa: Pmax / FS });
  }

  const Buckle = { defaults, solve, convertState, FU, SUP, Kof, sectionOf };
  root.Buckle = Buckle;
  if (typeof module !== 'undefined' && module.exports) module.exports = Buckle;
})(typeof window !== 'undefined' ? window : globalThis);
