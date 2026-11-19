/* =====================================================================
 * DYNAMICS · Stacked blocks (physics only; browser + Node). Used by Pkin (scene 'stack').
 * Hibbeler, Dynamics 15e, Section 13.4: ΣF = ma for each block, with Coulomb friction (Section 8.2
 * of Statics) at every contact: sticking needs |F| ≤ μ_s N, sliding gives F = μ_k N against the slip.
 * Blocks are listed from the bottom (on the floor or incline) up. A force P acts on one block at an
 * angle α from the surface, and a cord over a pulley at the uphill (right) end can tie the bottom
 * block to the top block, so that a_top = −a_bottom (Problem 13–27).
 * Each contact can stick, slip forward or slip back. Every combination is tried, from the most
 * sticking to the least, and the first one whose answer satisfies its own friction and slip
 * conditions is the motion.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps, linSolve } = Core;
  const D2R = Math.PI / 180;
  const NAMES = 'ABCDEFGH';

  /** Normal force under each block: the weights above it, less the lift of P where P acts on or above it. */
  function normals(m, g, th, P, al, on) {
    const n = m.length, N = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) N[i] = (i < n - 1 ? N[i + 1] : 0) + m[i] * g * Math.cos(th) - (i === on ? P * Math.sin(al) : 0);
    return N;
  }

  /**
   * Motion for one load. Unknowns: a_0..a_{n−1}, F_0..F_{n−1} (friction on block i from the body under it, +x)
   * and T when the cord is taut. Contact i joins block i to block i − 1 (i = 0 is the ground).
   * Returns { a, F, T, states, N } or { err }.
   */
  function motion(sys, P) {
    const { m, mus, muk, g, th, al, on, tie } = sys, n = m.length;
    const N = normals(m, g, th, P, al, on);
    for (let i = 0; i < n; i++) if (N[i] < -1e-9) return { err: `P lifts block ${(sys.names || NAMES)[i]} off the surface below it (N = ${fmt(N[i])}).` };
    const nT = tie ? 1 : 0, nu = 2 * n + nT, tol = 1e-9 * Math.max(1, ...m.map((x) => x * g), Math.abs(P));
    const cases = [];
    const tieStates = tie ? ['taut', 'slack'] : ['none'];
    const total = Math.pow(3, n);
    for (let c = 0; c < total; c++) {
      const s = []; let k = c;
      for (let i = 0; i < n; i++) { s.push(['stick', 'fwd', 'back'][k % 3]); k = Math.floor(k / 3); }
      tieStates.forEach((ts) => cases.push({ s, ts, slips: s.filter((x) => x !== 'stick').length + (ts === 'slack' ? 0.5 : 0) }));
    }
    cases.sort((p, q) => p.slips - q.slips);
    const rel = (a, i) => a[i] - (i > 0 ? a[i - 1] : 0);
    let indet = null;
    for (const cs of cases) {
      const A = [], b = [];
      const row = () => new Array(nu).fill(0);
      // motion of each block along x
      for (let j = 0; j < n; j++) {
        const r = row();
        r[j] = m[j]; r[n + j] = -1; if (j + 1 < n) r[n + j + 1] = 1;
        if (cs.ts === 'taut' && (j === 0 || j === n - 1)) r[2 * n] = -1;
        A.push(r); b.push(-m[j] * g * Math.sin(th) + (j === on ? P * Math.cos(al) : 0));
      }
      // contact conditions
      for (let i = 0; i < n; i++) {
        const r = row();
        if (cs.s[i] === 'stick') { r[i] = 1; if (i > 0) r[i - 1] = -1; A.push(r); b.push(0); }
        else { r[n + i] = 1; A.push(r); b.push((cs.s[i] === 'fwd' ? -1 : 1) * muk[i] * N[i]); }
      }
      if (cs.ts === 'taut') { const r = row(); r[0] = 1; r[n - 1] = 1; A.push(r); b.push(0); }
      let sol = linSolve(A, b), Tfree = null;
      if (!sol.consistent) continue;
      if (!sol.x && cs.ts === 'taut') {
        // friction and tension are statically indeterminate: find a range of T that keeps every contact inside its cone
        const at = (T) => { const r = row(); r[2 * n] = 1; const s2 = linSolve(A.concat([r]), b.concat([T])); return s2.x; };
        const x0 = at(0), x1 = at(1);
        if (!x0 || !x1) continue;
        let lo = 0, hi = Infinity;
        const keep = (c0, c1) => { // need c0 + c1·T ≥ 0
          if (Math.abs(c1) < 1e-12) { if (c0 < -tol) lo = Infinity; return; }
          const t = -c0 / c1; if (c1 > 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
        };
        for (let i = 0; i < n; i++) if (cs.s[i] === 'stick') {
          const f0 = x0[n + i], f1 = x1[n + i] - f0, cap = mus[i] * N[i];
          keep(cap - f0, -f1); keep(cap + f0, f1);
        }
        if (!(lo <= hi + tol)) continue;
        Tfree = [lo, hi];
        const Tm = isFinite(hi) ? (lo + hi) / 2 : lo;
        sol = { x: at(Tm) };
      }
      if (!sol.x) continue;
      const x = sol.x, a = x.slice(0, n), F = x.slice(n, 2 * n), T = cs.ts === 'taut' ? x[2 * n] : 0;
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        const ar = rel(a, i), aTol = 1e-9 * Math.max(1, g);
        if (cs.s[i] === 'stick') ok = Math.abs(F[i]) <= mus[i] * N[i] + tol;
        else ok = cs.s[i] === 'fwd' ? ar > aTol : ar < -aTol;
      }
      if (ok && cs.ts === 'taut') ok = T >= -tol;
      if (ok && cs.ts === 'slack') ok = a[0] + a[n - 1] > 1e-9; // moving away from the pulley lets the cord go slack
      if (!ok) continue;
      if (Tfree) { indet = indet || { a, F, T, states: cs.s, N, Tfree }; break; }
      return { a, F, T, states: cs.s, N, tie: cs.ts };
    }
    if (indet) return Object.assign(indet, { tie: 'taut' });
    return { err: 'No consistent motion was found. Check the friction coefficients.' };
  }

  function read(st, u) {
    const list = (st.blocks || []).filter((b) => b && isFinite(+b.m));
    const n = list.length;
    if (n < 1) return { err: 'Add at least one block.' };
    if (n > 5) return { err: 'At most 5 blocks.' };
    const m = list.map((b) => DY.toBase(+b.m, 'M', u)), mus = list.map((b) => +b.mus), muk = list.map((b) => +b.muk);
    if (!m.every((x) => x > 0)) return { err: `Every block needs a ${u.us ? 'weight' : 'mass'} above zero.` };
    if (![...mus, ...muk].every((x) => x >= 0)) return { err: 'Friction coefficients cannot be negative.' };
    const th = +st.kth * D2R, al = +st.kal * D2R, on = Math.round(+st.kon);
    if (!(th >= 0 && th < Math.PI / 2)) return { err: 'The incline angle must be from 0° up to (not including) 90°.' };
    if (!(on >= 0 && on < n)) return { err: 'P must act on one of the blocks.' };
    if (!isFinite(al)) return { err: 'Enter the angle of P.' };
    const tie = !!st.ktie && n >= 2;
    const names = list.map((b, i) => String(b.name || '').trim().slice(0, 4) || NAMES[i]);
    return { sys: { m, mus, muk, g: u.g, th, al, on, tie, names }, list, n };
  }

  function solve(st, u) {
    const S = Steps(), out = [], warn = [];
    const R = read(st, u);
    if (R.err) return fail(R.err);
    const { sys, n } = R, { m, mus, muk, g, th, al, on, tie } = sys;
    const nm = (i) => sys.names[i], below = (i) => (i === 0 ? (th > 0 ? 'the incline' : 'the floor') : `block ${nm(i - 1)}`);
    for (let i = 0; i < n; i++) if (mus[i] < muk[i]) warn.push(`Contact under ${nm(i)}: μ_s is normally at least μ_k.`);
    const dirs = th > 0 ? 'x runs up the slope' : 'x runs to the right';
    S.add({ t: 'Free-body diagrams', n: `Blocks from the bottom: ${m.map((x, i) => `${nm(i)} (m = ${fmt(x)} ${u.us ? 'slug' : 'kg'}, W = ${fmt(x * g)} ${u.F})`).join(', ')}. ${dirs}${tie ? `; a cord over a pulley at the ${th > 0 ? 'top' : 'right'} ties ${nm(0)} to ${nm(n - 1)}` : ''}. F_i is the friction on block i from the body under it, +x.` });
    let P = +st.kP;
    if (st.ktask === 'Pmax') {
      // largest P with no slip between blocks
      const slipsBetween = (p) => { const r = motion(sys, p); if (r.err) return null; return r.states.some((s, i) => i > 0 && s !== 'stick'); };
      if (n < 2) return fail('Slipping between blocks needs at least two blocks.');
      if (slipsBetween(0)) return fail('The blocks already slip on each other with no force applied.');
      let hi = Math.max(1, m.reduce((a, b) => a + b, 0) * g), guard = 0, sHi;
      while (!(sHi = slipsBetween(hi)) && guard++ < 60) { if (sHi === null) break; hi *= 2; }
      if (!sHi) return fail(sHi === null ? 'P lifts a block off before any slip starts.' : 'The blocks never slip on each other, however large P is.');
      let lo = 0;
      for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (slipsBetween(mid)) hi = mid; else lo = mid; }
      P = lo;
      const r = motion(sys, P), N = r.N;
      const iSlip = motion(sys, hi).states.findIndex((s, i) => i > 0 && s !== 'stick');
      const above = m.slice(iSlip).reduce((a, b) => a + b, 0);
      S.add({ t: 'Normal forces', f: 'ΣF_y = 0 for the blocks above each contact', r: N.map((x, i) => `N under ${nm(i)} = ${fmt(x)} ${u.F}`).join(', ') });
      S.add({ t: `Slipping impends under ${nm(iSlip)}`, n: `The blocks from ${nm(iSlip)} up move together, held only by friction from ${below(iSlip)}: F = μ_s N.`, f: `ΣF_x = ma_x (blocks ${nm(iSlip)} to ${nm(n - 1)}):  μ_s N − ΣW sin θ${tie ? ' (+ T)' : ''} = (Σm) a`, s: `${fmt(mus[iSlip])}(${fmt(N[iSlip])}) ${th > 0 ? `− ${fmt(above * g)} sin ${fmt(+st.kth)}° ` : ''}= ${fmt(above)} a`, r: `a = ${fmt(r.a[iSlip])} ${u.A}` });
      S.add({ t: 'The whole stack', n: r.states[0] === 'stick' ? `${nm(0)} does not slide on ${below(0)}.` : `${nm(0)} slides on ${below(0)}: F = μ_k N = ${fmt(muk[0] * N[0])} ${u.F}.`, f: 'ΣF_x = (Σm) a, solved for P', r: `P = ${fmt(P)} ${u.F}` });
      out.push({ k: 'Largest P with no slip between blocks', v: P, u: u.F, hl: true }, { k: 'Acceleration of the stack', v: r.a[iSlip], u: u.A, hl: true });
      if (r.states[0] !== 'stick') out.push({ k: `Friction under ${nm(0)} (sliding)`, v: Math.abs(r.F[0]), u: u.F });
      return DY.result(`P = ${fmt(P)} ${u.F}; slipping starts under ${nm(iSlip)}`, warn.length ? 'warn' : 'ok', out, S, geo(st, u, sys, r, P, 2), warn);
    }
    if (!(P >= 0)) return fail('Enter the force P (0 for none).');
    const r = motion(sys, P);
    if (r.err) return fail(r.err);
    const { a, F, T, N, states } = r;
    S.add({ t: 'Normal forces', f: 'ΣF_y = ma_y = 0 for the blocks above each contact', s: `N_i = Σ(W cos θ) above${P && Math.sin(al) ? ` − P sin α (for contacts at or below ${nm(on)})` : ''}`, r: N.map((x, i) => `N under ${nm(i)} = ${fmt(x)} ${u.F}`).join(', ') });
    S.add({ t: 'How each contact behaves', n: 'Each contact is tried as sticking, then sliding; the answer below satisfies |F| ≤ μ_s N where it sticks and F = μ_k N against the slip where it slides.', table: { head: ['Contact', 'State', 'F', 'μ_s N'], rows: states.map((s, i) => [`${nm(i)} on ${below(i)}`, s === 'stick' ? 'sticks' : s === 'fwd' ? `slides +x on ${i ? nm(i - 1) : 'ground'}` : `slides −x on ${i ? nm(i - 1) : 'ground'}`, fmt(F[i]), fmt(mus[i] * N[i])]) } });
    for (let j = 0; j < n; j++) {
      const terms = [`F_${nm(j)}`];
      if (j + 1 < n) terms.push(`− F_${nm(j + 1)}`);
      if (th > 0) terms.push('− W sin θ');
      if (j === on && P) terms.push('+ P cos α');
      if (tie && r.tie === 'taut' && (j === 0 || j === n - 1)) terms.push('+ T');
      S.add({ t: `Block ${nm(j)}`, f: `ΣF_x = ma_x:  ${terms.join(' ')} = m a_${nm(j)}`, s: `${fmt(F[j])}${j + 1 < n ? ` − ${fmt(F[j + 1])}` : ''}${th > 0 ? ` − ${fmt(m[j] * g * Math.sin(th))}` : ''}${j === on && P ? ` + ${fmt(P * Math.cos(al))}` : ''}${tie && r.tie === 'taut' && (j === 0 || j === n - 1) ? ` + ${fmt(T)}` : ''} = ${fmt(m[j])} a_${nm(j)}`, r: `a_${nm(j)} = ${fmt(a[j])} ${u.A}` });
    }
    if (tie) S.add({ t: 'Cord', f: 'Taut cord over a fixed pulley: a_bottom = −a_top', r: r.tie === 'taut' ? (r.Tfree ? `At rest; friction and T share the load (T from ${fmt(r.Tfree[0])} to ${isFinite(r.Tfree[1]) ? fmt(r.Tfree[1]) : '∞'} ${u.F} all balance)` : `T = ${fmt(T)} ${u.F}`) : 'The cord goes slack (T = 0).' });
    for (let j = 0; j < n; j++) out.push({ k: `Acceleration of ${nm(j)}`, v: a[j], u: u.A, hl: true });
    if (tie && r.tie === 'taut' && !r.Tfree) out.push({ k: 'Cord tension T', v: T, u: u.F, hl: true });
    for (let i = 0; i < n; i++) out.push({ k: `Friction under ${nm(i)} (${states[i] === 'stick' ? 'sticks' : 'slides'})`, v: F[i], u: u.F });
    // time to slide a distance d relative to the body below
    const d = +st.kd, top = n - 1, aRel = a[top] - (top > 0 ? a[top - 1] : 0);
    let tEnd = 2;
    if (d > 0 && Math.abs(aRel) > 1e-9) {
      const t = Math.sqrt((2 * d) / Math.abs(aRel));
      tEnd = t;
      S.add({ t: `Time for ${nm(top)} to slide ${fmt(d)} ${u.L} on ${below(top)}`, f: 's_rel = ½ a_rel t²  (from rest)', s: `a_rel = ${fmt(a[top])} − (${fmt(top > 0 ? a[top - 1] : 0)}) = ${fmt(aRel)};  t = √(2(${fmt(d)})/${fmt(Math.abs(aRel))})`, r: `t = ${fmt(t)} s` });
      out.push({ k: `Time for ${nm(top)} to slide ${fmt(d)} ${u.L} on ${below(top)}`, v: t, u: 's', hl: true });
    } else if (d > 0) warn.push(`${nm(top)} does not slide on ${below(top)}, so it never covers ${fmt(d)} ${u.L}.`);
    const moving = a.some((x) => Math.abs(x) > 1e-9);
    const head = moving ? a.map((x, j) => `a_${nm(j)} = ${fmt(x)}`).join(', ') + ` ${u.A}` : 'Everything stays at rest';
    return DY.result(head, warn.length ? 'warn' : 'ok', out, S, geo(st, u, sys, r, P, tEnd), warn);
  }

  function geo(st, u, sys, r, P, tEnd) {
    return { scene: 'stack', u, sys, names: sys.names, a: r.a, F: r.F, T: r.T, N: r.N, states: r.states, P, th: +st.kth, al: +st.kal, on: sys.on, tie: sys.tie && r.tie === 'taut', span: [0, tEnd] };
  }

  const KINDS = { kP: 'F', kd: 'L' };
  const BKINDS = { m: 'M' };
  function convert(st, from, to) {
    DY.convertObj(st, KINDS, from, to);
    if (Array.isArray(st.blocks)) DY.convertList(st.blocks, BKINDS, from, to);
    return st;
  }
  const defaults = () => ({ blocks: [{ name: 'B', m: 30, mus: 0.35, muk: 0.35 }, { name: 'A', m: 60, mus: 0.3, muk: 0.25 }], kth: 0, kP: 400, kal: 0, kon: 0, ktie: false, ktask: 'motion', kd: 0 });

  const Stack = { defaults, solve, convert, motion, normals, NAMES };
  root.Stack = Stack;
  if (typeof module !== 'undefined' && module.exports) module.exports = Stack;
})(typeof window !== 'undefined' ? window : globalThis);
