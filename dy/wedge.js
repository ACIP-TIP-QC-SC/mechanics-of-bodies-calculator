/* =====================================================================
 * DYNAMICS · Block on a wedge pushed along a floor (physics only; browser + Node). Used by Pkin (scene 'wedge').
 * Hibbeler, Dynamics 15e, Section 13.4: ΣF = ma for each body (13–7), with Coulomb friction at each contact
 * (sticking needs |F| ≤ μ_s N, sliding gives F = μ_k N against the slip). Problem 13–46 is the smooth case.
 * Wedge B rests on a floor (friction μ_f). Block A sits on B's sloped face, at θ from the horizontal. A horizontal
 * force P pushes B toward the low end of the face, so the face presses into A.
 * Axes: x horizontal, + in the direction of P; y up. The face rises against x, so along the face up-slope is
 * û = (−cos θ, sin θ) and the normal from B onto A is n̂ = (sin θ, cos θ).
 * Tasks:
 *   range  the smallest and largest P for which A does not move on B;
 *   given  the motion for a given P (from rest): every combination of sticking and sliding is tried, from the
 *          most sticking to the least, and the first one that satisfies its own friction and slip conditions is used.
 * State keys start with w.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps, linSolve } = Core;
  const D2R = Math.PI / 180;
  const SCENES = ['wedge'];

  const defaults = () => ({ wmA: 10, wmB: 10, wth: 30, wmus: 0, wmuk: 0, wmuf: 0, wP: 100, wtask: 'range' });
  const KINDS = { wmA: 'M', wmB: 'M', wP: 'F' };
  function convert(st, from, to) { DY.convertObj(st, KINDS, from, to); return st; }

  /**
   * Accelerations of B at which A is about to slip on the face (A and B move together with a; friction μ on A).
   *   Slip up impends (F = μN down the face):   N = m_A g/(cos θ − μ sin θ),  a_max = g (sin θ + μ cos θ)/(cos θ − μ sin θ)
   *     — only while cos θ > μ sin θ; otherwise friction alone keeps A from slipping up, however large a is.
   *   Slip down impends (F = μN up the face):   N = m_A g/(cos θ + μ sin θ),  a_min = g (sin θ − μ cos θ)/(cos θ + μ sin θ)
   *     — when a_min ≤ 0, friction holds A even with B at rest.
   * Returns { up: {a, N} | null, down: {a, N, held} }.
   */
  function slipLimits(mA, g, th, mu) {
    const c = Math.cos(th), s = Math.sin(th), dUp = c - mu * s, dDn = c + mu * s;
    const up = dUp > 1e-12 ? { a: (g * (s + mu * c)) / dUp, N: (mA * g) / dUp } : null;
    const aDn = (g * (s - mu * c)) / dDn;
    const down = aDn > 0 ? { a: aDn, N: (mA * g) / dDn, held: false } : { a: 0, N: mA * g * c, held: true, raw: aDn };
    return { up, down };
  }
  /** Force P that gives the pair the common acceleration a with B sliding on the floor: P − μ_f N_f = (m_A + m_B) a, N_f = (m_A + m_B) g. */
  const pushFor = (mA, mB, g, muf, a) => (mA + mB) * (a + muf * g);

  /**
   * Motion for a given P from rest. Unknowns x = [a_B, a_rel, N, F, N_f, F_f]: a_rel is A's acceleration up the face
   * relative to B, F the friction on A along û, F_f the floor friction on B along +x.
   *   A:  m_A (a_B − a_rel cos θ) = N sin θ − F cos θ;   m_A a_rel sin θ = N cos θ + F sin θ − m_A g
   *   B:  m_B a_B = P − N sin θ + F cos θ + F_f;          0 = N_f − m_B g − N cos θ − F sin θ
   * plus one condition per contact (stick: no relative acceleration; slide: F = ∓μ_k N against the slip).
   * Returns { aB, arel, N, F, Nf, Ff, ab, fl } or { err }.
   */
  function motion(p) {
    const { mA, mB, g, th, mus, muk, muf, P } = p, c = Math.cos(th), s = Math.sin(th);
    const tol = 1e-9 * Math.max(1, (mA + mB) * g, P), aTol = 1e-9 * Math.max(1, g);
    const cases = [];
    ['stick', 'up', 'down'].forEach((ab, i) => ['stick', 'fwd', 'back'].forEach((fl, j) => cases.push({ ab, fl, slips: (i ? 1 : 0) + (j ? 1 : 0) })));
    cases.sort((x, y) => x.slips - y.slips);
    for (const cs of cases) {
      const A = [[mA, -mA * c, -s, c, 0, 0], [0, mA * s, -c, -s, 0, 0], [mB, 0, s, -c, 0, -1], [0, 0, -c, -s, 1, 0]], b = [0, -mA * g, P, mB * g];
      A.push(cs.ab === 'stick' ? [0, 1, 0, 0, 0, 0] : [0, 0, cs.ab === 'up' ? muk : -muk, 1, 0, 0]); b.push(0);
      A.push(cs.fl === 'stick' ? [1, 0, 0, 0, 0, 0] : [0, 0, 0, 0, cs.fl === 'fwd' ? muf : -muf, 1]); b.push(0);
      const sol = linSolve(A, b);
      if (!sol.x) continue;
      const [aB, arel, N, F, Nf, Ff] = sol.x;
      if (N < -tol || Nf < -tol) continue;
      if (cs.ab === 'stick' ? Math.abs(F) > mus * N + tol : cs.ab === 'up' ? !(arel > aTol) : !(arel < -aTol)) continue;
      if (cs.fl === 'stick' ? Math.abs(Ff) > muf * Nf + tol : cs.fl === 'fwd' ? !(aB > aTol) : !(aB < -aTol)) continue;
      const z = (v, t) => (Math.abs(v) < t ? 0 : v);
      return { aB: z(aB, aTol), arel: z(arel, aTol), N, F: z(F, tol), Nf, Ff: z(Ff, tol), ab: cs.ab, fl: cs.fl };
    }
    return { err: 'No consistent motion was found. Check the friction coefficients.' };
  }

  function read(st, u) {
    const mA = DY.toBase(+st.wmA, 'M', u), mB = DY.toBase(+st.wmB, 'M', u), thD = +st.wth, mus = +st.wmus, muk = +st.wmuk, muf = +st.wmuf;
    if (!(mA > 0 && mB > 0)) return { err: `Enter the ${u.us ? 'weight' : 'mass'} of block A and of wedge B (both above zero).` };
    if (!(thD > 0 && thD < 90)) return { err: 'The face angle θ must be between 0° and 90°.' };
    if (!(mus >= 0 && muk >= 0 && muf >= 0)) return { err: 'Friction coefficients cannot be negative (enter 0 for a smooth surface).' };
    return { p: { mA, mB, g: u.g, th: thD * D2R, thD, mus, muk, muf } };
  }

  function solve(st, u) {
    const S = Steps(), out = [], warn = [];
    const R = read(st, u);
    if (R.err) return fail(R.err);
    const p = R.p, { mA, mB, g, th, thD, mus, muk, muf } = p, F = u.F, A = u.A, WA = mA * g, WB = mB * g;
    const mTxt = (m) => DY.massTxt(m, u), deg = `${fmt(thD)}°`;
    if (mus < muk) warn.push('μ_s between A and B is normally at least μ_k.');
    S.add({ t: 'Free-body diagrams', n: `x is horizontal, + in the direction of P (toward the low end of the face); y is up. Block A (${mTxt(mA)}): its weight W_A = ${fmt(WA)} ${F}, the normal force N of the face at θ = ${deg} from the vertical, and friction F along the face. Wedge B (${mTxt(mB)}): P, its weight W_B = ${fmt(WB)} ${F}, the equal and opposite N and F from A, and the floor's normal force N_f and friction F_f.` });
    if (st.wtask !== 'given') {
      const L = slipLimits(mA, g, th, mus), Nf = (mA + mB) * g, mu = fmt(mus);
      if (L.up) S.add({ t: 'Block A: slipping up the face impends', n: 'At the largest push, A is about to slide up the face, so friction on A acts down the face: F = μ_s N.', f: 'ΣF_y = 0:  N cos θ − μ_s N sin θ − W_A = 0;   ΣF_x = m_A a:  N sin θ + μ_s N cos θ = m_A a',
        s: `N (cos ${deg} − ${mu} sin ${deg}) = ${fmt(WA)};   a = g (sin θ + μ_s cos θ)/(cos θ − μ_s sin θ)`, r: `N = ${fmt(L.up.N)} ${F},  a_max = ${fmt(L.up.a)} ${A}` });
      else S.add({ t: 'Block A: slipping up the face', n: `μ_s ≥ cot θ (${mu} ≥ ${fmt(1 / Math.tan(th))}), so friction alone stops A sliding up the face however hard B is pushed: there is no upper limit.` });
      S.add({ t: 'Block A: slipping down the face impends', n: L.down.held ? `μ_s ≥ tan θ (${mu} ≥ ${fmt(Math.tan(th))}): friction holds A on the face even with B at rest, so A stays put from P = 0.` : 'At the smallest push, A is about to slide down the face, so friction on A acts up the face: F = μ_s N.',
        f: 'ΣF_y = 0:  N cos θ + μ_s N sin θ − W_A = 0;   ΣF_x = m_A a:  N sin θ − μ_s N cos θ = m_A a', s: `a = g (sin θ − μ_s cos θ)/(cos θ + μ_s sin θ)${L.down.held ? ` = ${fmt(L.down.raw)} ≤ 0` : ''}`,
        r: L.down.held ? 'a_min = 0 (no push needed)' : `N = ${fmt(L.down.N)} ${F},  a_min = ${fmt(L.down.a)} ${A}` });
      const Pmax = L.up ? pushFor(mA, mB, g, muf, L.up.a) : Infinity, Pmin = L.down.held ? 0 : pushFor(mA, mB, g, muf, L.down.a);
      S.add({ t: 'Wedge B with A riding on it', n: `A and B move together with the same acceleration a. B slides on the floor${muf > 0 ? `, so the floor friction is μ_f N_f` : ' (smooth floor)'}.`,
        f: 'ΣF_y = 0:  N_f = (m_A + m_B) g;   ΣF_x = (m_A + m_B) a:  P − μ_f N_f = (m_A + m_B) a', s: `N_f = ${fmt(Nf)} ${F};  P = ${fmt(mA + mB)}(a + ${fmt(muf)}·${fmt(g)})`,
        r: Math.abs(Pmax - Pmin) < 1e-9 * Math.max(1, Pmax) ? `Smooth faces: both limits are a = g tan θ, so only P = (m_A + m_B) g (tan θ + μ_f) = ${fmt(Pmax)} ${F} keeps A in place` : `${fmt(Pmin)} ${F} ≤ P ≤ ${isFinite(Pmax) ? `${fmt(Pmax)} ${F}` : '∞ (no upper limit)'}` });
      out.push({ k: 'Largest P with A at rest on B', v: isFinite(Pmax) ? Pmax : 'no upper limit', u: isFinite(Pmax) ? F : '', hl: true }, { k: 'Smallest P with A at rest on B', v: Pmin, u: F });
      if (L.up) out.push({ k: 'Acceleration at the largest P', v: L.up.a, u: A }, { k: 'Normal force between A and B at the largest P', v: L.up.N, u: F });
      out.push({ k: 'Acceleration at the smallest P', v: L.down.a, u: A }, { k: 'Normal force between A and B at the smallest P', v: L.down.N, u: F }, { k: 'Floor normal force N_f', v: Nf, u: F });
      const show = L.up ? { P: Pmax, aB: L.up.a, arel: 0, N: L.up.N, F: -mus * L.up.N, Nf, Ff: -muf * Nf } : { P: Pmin, aB: L.down.a, arel: 0, N: L.down.N, F: L.down.held ? WA * Math.sin(th) : mus * L.down.N, Nf, Ff: L.down.a > 0 ? -muf * Nf : 0 };
      const head = isFinite(Pmax) ? (Math.abs(Pmax - Pmin) < 1e-9 * Math.max(1, Pmax) ? `P = ${fmt(Pmax)} ${F} keeps A in place` : `A stays on B for ${fmt(Pmin)} ≤ P ≤ ${fmt(Pmax)} ${F}`) : `A stays on B for P ≥ ${fmt(Pmin)} ${F}`;
      return DY.result(head, warn.length ? 'warn' : 'ok', out, S, geo(u, p, show, 'range'), warn);
    }
    const P = +st.wP;
    if (String(st.wP).trim() === '' || !(P >= 0)) return fail('Enter the push P on the wedge (zero or above).');
    const r = motion(Object.assign({ P }, p));
    if (r.err) return fail(r.err);
    const c = Math.cos(th), s = Math.sin(th), abTxt = { stick: 'sticks', up: 'slips up the face', down: 'slips down the face' }[r.ab], flTxt = { stick: 'sticks', fwd: 'slides along P', back: 'slides back against P' }[r.fl];
    S.add({ t: 'How the contacts behave', n: 'Each contact is tried as sticking, then sliding up or down (or either way on the floor); the case below satisfies |F| ≤ μ_s N where it sticks and F = μ_k N against the slip where it slides.',
      table: { head: ['Contact', 'State', 'Friction', 'Limit μN'], rows: [['A on B', abTxt, fmt(r.F), fmt((r.ab === 'stick' ? mus : muk) * r.N)], ['B on the floor', flTxt, fmt(r.Ff), fmt(muf * r.Nf)]] } });
    S.add({ t: 'Block A', f: 'ΣF_x = m_A a_Ax:  N sin θ − F cos θ = m_A (a_B − a_A/B cos θ);   ΣF_y = m_A a_Ay:  N cos θ + F sin θ − W_A = m_A a_A/B sin θ',
      s: `${fmt(r.N)} sin ${deg} − (${fmt(r.F)}) cos ${deg} = ${fmt(mA)}(${fmt(r.aB)} − (${fmt(r.arel)}) cos ${deg});   ${fmt(r.N)} cos ${deg} + (${fmt(r.F)}) sin ${deg} − ${fmt(WA)} = ${fmt(mA)}(${fmt(r.arel)}) sin ${deg}`,
      r: `N = ${fmt(r.N)} ${F},  F = ${fmt(r.F)} ${F} (+ up the face),  a_A/B = ${fmt(r.arel)} ${A}` });
    S.add({ t: 'Wedge B', f: 'ΣF_x = m_B a_B:  P − N sin θ + F cos θ + F_f = m_B a_B;   ΣF_y = 0:  N_f − W_B − N cos θ − F sin θ = 0',
      s: `${fmt(P)} − ${fmt(r.N)} sin ${deg} + (${fmt(r.F)}) cos ${deg} + (${fmt(r.Ff)}) = ${fmt(mB)} a_B;   N_f = ${fmt(WB)} + ${fmt(r.N)} cos ${deg} + (${fmt(r.F)}) sin ${deg}`, r: `a_B = ${fmt(r.aB)} ${A},  N_f = ${fmt(r.Nf)} ${F}` });
    const aA = [r.aB - r.arel * c, r.arel * s];
    S.add({ t: 'Acceleration of A', f: 'a_A = a_B + a_A/B  (a_A/B along the face)', s: `a_A = (${fmt(r.aB)} − ${fmt(r.arel)} cos ${deg}) i + (${fmt(r.arel)} sin ${deg}) j`, r: `|a_A| = ${fmt(Math.hypot(aA[0], aA[1]))} ${A}` });
    out.push({ k: 'Acceleration of B, a_B (+ along P)', v: r.aB, u: A, hl: true }, { k: 'Acceleration of A relative to B, a_A/B (+ up the face)', v: r.arel, u: A }, { k: 'Acceleration of A, |a_A|', v: Math.hypot(aA[0], aA[1]), u: A },
      { k: 'Normal force between A and B, N', v: r.N, u: F }, { k: 'Friction on A from B, F (+ up the face)', v: r.F, u: F }, { k: 'Floor normal force N_f', v: r.Nf, u: F }, { k: 'Floor friction on B, F_f (+ along P)', v: r.Ff, u: F });
    const head = r.aB === 0 && r.arel === 0 ? 'Friction holds: nothing moves' : `a_B = ${fmt(r.aB)} ${A}; A ${abTxt}${r.ab !== 'stick' ? ` (a_A/B = ${fmt(Math.abs(r.arel))} ${A})` : ''}`;
    return DY.result(head, warn.length ? 'warn' : 'ok', out, S, geo(u, p, Object.assign({ P }, r), 'given'), warn);
  }

  /** Geometry for the drawing; the run lasts long enough to show the motion without A leaving the face. */
  function geo(u, p, m, task) {
    const big = Math.max(Math.abs(m.aB), Math.abs(m.arel)), T = big > 1e-9 ? Math.min(3, Math.max(0.6, Math.sqrt(2 / big))) : 1;
    return Object.assign({ scene: 'wedge', u, task, mA: p.mA, mB: p.mB, th: p.thD, mus: p.mus, muk: p.muk, muf: p.muf, span: [0, T] }, m);
  }

  const Wedge = { SCENES, defaults, convert, solve, motion, slipLimits, pushFor };
  root.WedgePair = Wedge;
  if (typeof module !== 'undefined' && module.exports) module.exports = Wedge;
})(typeof window !== 'undefined' ? window : globalThis);
