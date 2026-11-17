/* =====================================================================
 * STATICS · Friction (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapter 8, sections 8.1 to 8.5.
 *   block   block on a floor or incline pushed at a height: no motion, slip or tip (8.2)
 *   incline block on an incline treated as a particle: does it slide down by itself, the force to hold it,
 *           the force to push it up (μs to start, μk to keep it moving); sliding uses μk and ΣF = ma
 *   ladder  ladder against a wall: smallest angle, or the floor friction needed (8.2)
 *   wedge   wedge lifting a block in a guide or a lever pinned at one end (8.3)
 *   screw   square-threaded screw: M = W r tan(θ ± φs) (8.4)
 *   belt    flat belt or rope over one or more drums: T2 = T1 e^(μβ) (8.5)
 * Forces are in the chosen force unit `fu`, lengths in m or ft, screw sizes in mm or in.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps, tidy } = Core;
  const DEG = Math.PI / 180;

  function defaults() {
    return {
      mode: 'block', fu: 'N',
      bk: { wBy: 'mass', m: 20, W: 196.2, b: 0.8, H: 0.6, phi: 0, mu: 0.3, task: 'check', P: 80, psi: -30, hP: 0.2 },
      ic: { wBy: 'mass', m: 20, W: 196.2, phi: 30, mus: 0.3, muk: 0.25, task: 'release', psi: 0, acc: 0, d: 3 },
      ld: { wBy: 'mass', m: 10, W: 98.1, L: 4, muA: 0.3, muB: 0, task: 'minAngle', th: 65, person: false, mp: 75, Wp: 735.8, wpBy: 'mass', s: 3 },
      wd: { load: 'lever', wBy: 'mass', m: 500, W: 4905, al: 7, mu: 0.3, muC: 0.3, muG: 0, a: 1, xW: 0.5, task: 'lower' },
      sc: { W: 2000, r: 5, l: 2, mu: 0.25, n: 2, task: 'raise' },
      bt: { known: 'high', T: 500, drums: [{ beta: 135, turns: 0, mu: 0.25 }, { beta: 135, turns: 0, mu: 0.25 }] },
    };
  }
  const gOf = (U) => (U.id === 'US' ? 32.2 : 9.81);
  /** Weight in the force unit: from a mass (kg or slug) or typed in directly. */
  function weight(o, U, fu, mKey, wKey, byKey) {
    if ((o[byKey || 'wBy'] || 'force') === 'mass') {
      const m = +o[mKey || 'm'], W0 = m * gOf(U);
      return { W: U.id === 'US' ? Core.convert(W0, 'lb', fu) : Core.convert(W0, 'N', fu), how: `W = mg = ${fmt(m)}(${fmt(gOf(U))}) = ${fmt(m * gOf(U))} ${U.id === 'US' ? 'lb' : 'N'}${(U.id === 'US' ? 'lb' : 'N') === fu ? '' : ` = ${fmt(U.id === 'US' ? Core.convert(W0, 'lb', fu) : Core.convert(W0, 'N', fu))} ${fu}`}`, m };
    }
    return { W: +o[wKey || 'W'], how: `W = ${fmt(+o[wKey || 'W'])} ${fu}` };
  }
  const res = (text, cls, out, S, geo, warn) => ({ ok: true, err: [], warn: warn || [], status: { cls: cls || 'ok', text }, out, steps: S.list, geo });

  function solve(st, U) {
    const c = { F: st.fu, Lu: U.len, Ls: U.lenS, FL: `${st.fu}·${U.len}`, U };
    if (st.mode === 'incline') return incline(st.ic, c);
    if (st.mode === 'ladder') return ladder(st.ld, c);
    if (st.mode === 'wedge') return wedge(st.wd, c);
    if (st.mode === 'screw') return screw(st.sc, c);
    if (st.mode === 'belt') return belt(st.bt, c);
    return block(st.bk, c);
  }

  /* ------------------------------------------------------------------ */
  /* Block: slip or tip                                                 */
  /* ------------------------------------------------------------------ */
  function block(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, b = +q.b, H = +q.H, phi = +q.phi, mu = +q.mu, psi = +q.psi, hP = +q.hP;
    if (!(W > 0)) err.push('The weight must be greater than zero.');
    if (!(b > 0) || !(H > 0)) err.push('Enter the width and height of the block.');
    if (!(phi >= 0 && phi < 90)) err.push('The slope angle must be from 0° to less than 90°.');
    if (!(mu >= 0)) err.push('The coefficient of static friction must be zero or more.');
    if (!(hP >= 0 && hP <= H)) err.push('P must act at a height between 0 and the block height.');
    if (q.task === 'check' && !isFinite(+q.P)) err.push('Enter the force P.');
    if (err.length) return fail(err);
    const sp = Math.sin(phi * DEG), cp = Math.cos(phi * DEG), sv = Math.sin(psi * DEG), cv = Math.cos(psi * DEG);
    const S = Steps(), out = [], ax = phi ? 'along the slope (up the slope positive)' : 'horizontally';
    S.add({ t: 'Free-body diagram', n: `Axes ${phi ? 'along and normal to the slope' : 'horizontal and vertical'}. The weight acts at the centre G (height ${fmt(H / 2)} ${Lu}); P acts on the left face at height ${fmt(hP)} ${Lu}, at ${fmt(psi)}° from the surface (${psi < 0 ? 'pushing toward the surface' : psi > 0 ? 'pulling away from the surface' : 'parallel to the surface'}). The resultant normal force N acts at a distance x from the centre line, and F is the friction force, positive when it opposes motion ${phi ? 'up the slope' : 'in the direction of P'}.`, r: w.how });
    // moment about O (base centre) of W and P, positive counterclockwise
    const MW = W * sp * (H / 2), MP = (P) => -(b / 2) * P * sv - hP * P * cv;
    if (q.task === 'findP') {
      const dS = cv + mu * sv, Pslip = dS > 1e-12 ? (W * (sp + mu * cp)) / dS : Infinity;
      const dT = 2 * (b * sv + hP * cv), Ptip = dT > 1e-12 ? (W * (b * cp + H * sp)) / dT : Infinity;
      S.add({ t: 'If the block slips', f: 'F = μs N', n: `Slip up${phi ? ' the slope' : ''} is about to happen, so F = μs N acting against the motion.`,
        s: `ΣF ${ax}: P cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° − ${fmt(mu)} N = 0;   ΣF normal: N − ${fmt(W)} cos ${fmt(phi)}° + P sin ${fmt(psi)}° = 0`, r: isFinite(Pslip) ? `P = ${fmt(Pslip)} ${F}` : 'P cannot make the block slip at this angle' });
      S.add({ t: 'If the block tips', n: 'Tipping is about to happen, so N acts at the front corner of the base (x = b/2) and the block is about to rotate about it.',
        f: '↺+ ΣM_corner = 0', s: `${fmt(W)}(${fmt(b / 2)} cos ${fmt(phi)}° + ${fmt(H / 2)} sin ${fmt(phi)}°) − P(${fmt(b)} sin ${fmt(psi)}° + ${fmt(hP)} cos ${fmt(psi)}°) = 0`, r: isFinite(Ptip) ? `P = ${fmt(Ptip)} ${F}` : 'P cannot tip the block' });
      const gov = Math.min(Pslip, Ptip);
      if (!isFinite(gov)) return fail('With P at this angle the block can neither slip nor tip. Change the direction of P.');
      const tips = Ptip < Pslip;
      S.add({ t: 'Governing case', n: 'The smaller of the two forces is reached first.', r: `${tips ? 'Tipping' : 'Slipping'} governs: P = ${fmt(gov)} ${F}` });
      if (tips && Pslip - Ptip < 1e-9 * W) S.list[S.list.length - 1].r = `Slipping and tipping happen together: P = ${fmt(gov)} ${F}`;
      const N = W * cp - gov * sv, Ff = gov * cv - W * sp, x = -(MW + MP(gov)) / N;
      out.push({ k: 'P to slip', v: isFinite(Pslip) ? Pslip : 0, u: isFinite(Pslip) ? F : `${F} (never)`, hl: !tips }, { k: 'P to tip', v: isFinite(Ptip) ? Ptip : 0, u: isFinite(Ptip) ? F : `${F} (never)`, hl: tips });
      out.push({ k: 'Normal force N', v: N, u: F }, { k: 'Friction force F', v: Ff, u: F }, { k: 'Position of N, x', v: x, u: Lu });
      const warn = []; if (sp > mu * cp) warn.push(`tan ${fmt(phi)}° = ${fmt(sp / cp)} is greater than μs, so without P the block would slide down the slope by itself.`);
      return res(`${tips ? 'Tips' : 'Slips'} first at P = ${fmt(gov)} ${F}`, 'ok', out, S, { kind: 'block', c, W, b, H, phi, mu, psi, hP, P: gov, N, Ff, x, verdict: tips ? 'tip' : 'slip', find: true }, warn);
    }
    const P = +q.P;
    const Ff = P * cv - W * sp, N = W * cp - P * sv;
    S.add({ t: `Sum of forces ${ax}`, f: phi ? '+↗ ΣF_x = 0' : '→+ ΣF_x = 0', s: `${fmt(P)} cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° − F = 0`, r: `F = ${fmt(Ff)} ${F}` });
    S.add({ t: 'Sum of forces normal to the surface', f: phi ? '+↖ ΣF_y = 0' : '+↑ ΣF_y = 0', s: `N − ${fmt(W)} cos ${fmt(phi)}° + ${fmt(P)} sin ${fmt(psi)}° = 0`, r: `N = ${fmt(N)} ${F}` });
    if (!(N > 0)) return fail(`N = ${fmt(N)} ${F}: P lifts the block off the surface, so it cannot be in equilibrium on it. Reduce P or change its angle.`);
    const x = -(MW + MP(P)) / N;
    S.add({ t: 'Moments about the centre of the base O', f: '↺+ ΣM_O = 0', n: 'This places the resultant normal force N.',
      s: `${fmt(W)} sin ${fmt(phi)}° (${fmt(H / 2)}) − ${fmt(P)} sin ${fmt(psi)}° (${fmt(b / 2)}) − ${fmt(P)} cos ${fmt(psi)}° (${fmt(hP)}) + N x = 0`, r: `x = ${fmt(x)} ${Lu}` });
    const Fmax = mu * N, slips = Math.abs(Ff) > Fmax * (1 + 1e-9), tips = Math.abs(x) > (b / 2) * (1 + 1e-9);
    S.add({ t: 'Check slipping', f: 'F_max = μs N', s: `F_max = ${fmt(mu)}(${fmt(N)}) = ${fmt(Fmax)} ${F}`, r: `|F| = ${fmt(Math.abs(Ff))} ${F} ${slips ? '>' : '≤'} ${fmt(Fmax)} ${F}: ${slips ? 'the block slips' : 'no slipping'}` });
    S.add({ t: 'Check tipping', f: '|x| ≤ b/2', s: `|x| = ${fmt(Math.abs(x))} ${Lu}, b/2 = ${fmt(b / 2)} ${Lu}`, r: tips ? `N would have to act outside the base: the block tips about its ${x > 0 ? 'front' : 'back'} corner` : 'N acts within the base: no tipping' });
    out.push({ k: 'Friction needed F', v: Ff, u: F, hl: true }, { k: 'Normal force N', v: N, u: F, hl: true }, { k: 'Position of N, x', v: x, u: Lu, hl: true }, { k: 'Largest friction μs N', v: Fmax, u: F });
    const text = slips && tips ? 'Not in equilibrium: slips and tips' : slips ? 'Not in equilibrium: slips' : tips ? 'Not in equilibrium: tips' : 'In equilibrium: no slipping or tipping';
    const warn = []; if (!slips && Math.abs(Ff) > 0.95 * Fmax && Fmax > 0) warn.push(`F is ${fmt((100 * Math.abs(Ff)) / Fmax, 3)} % of the largest friction force, so slipping is close.`);
    return res(text, slips || tips ? 'warn' : 'ok', out, S, { kind: 'block', c, W, b, H, phi, mu, psi, hP, P, N, Ff, x, verdict: slips && tips ? 'both' : slips ? 'slip' : tips ? 'tip' : 'none' }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Block on an incline (particle): slide, hold or push up             */
  /* ------------------------------------------------------------------ */
  function incline(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, phi = +q.phi, ms = +q.mus, mk = +q.muk, psi = +q.psi || 0, acc = +q.acc || 0, d = +q.d;
    if (!(W > 0)) err.push('The weight must be greater than zero.');
    if (!(phi > 0 && phi < 90)) err.push('The slope angle must be between 0° and 90°.');
    if (!(ms >= 0) || !(mk >= 0)) err.push('The coefficients of friction must be zero or more.');
    if (q.task === 'release' && !(d > 0)) err.push('Enter the distance the block slides.');
    if (q.task !== 'release' && !(psi > -90 && psi < 90)) err.push('The angle of P from the slope must be between −90° and 90°.');
    if (q.task === 'up' && !(acc >= 0)) err.push('The acceleration up the slope must be zero or more.');
    if (err.length) return fail(err);
    const g = gOf(U), base = U.id === 'US' ? 'lb' : 'N', mass = Core.convert(W, F, base) / g, mU = U.id === 'US' ? 'slug' : 'kg';
    const sp = Math.sin(phi * DEG), cp = Math.cos(phi * DEG), sv = Math.sin(psi * DEG), cv = Math.cos(psi * DEG);
    const S = Steps(), out = [], warn = [], rep = Math.atan(ms) / DEG;
    if (mk > ms) warn.push('μk is larger than μs; for dry surfaces μk is normally a little smaller than μs.');
    S.add({ t: 'Free-body diagram', n: `The block is treated as a particle on a ${fmt(phi)}° slope (no tipping check). Axes: x along the slope (up the slope positive), y normal to it. The forces are the weight W, the normal force N, the friction force F along the slope${q.task === 'release' ? '' : ` and the force P at ${fmt(psi)}° from the slope (${psi > 0 ? 'pulling away from the surface' : psi < 0 ? 'pressing toward the surface' : 'parallel to the slope'})`}.`, r: w.how });
    const geo = { kind: 'incline', c, W, phi, ms, mk, psi, task: q.task, d, rep };
    if (q.task === 'release') {
      const N = W * cp, need = W * sp, Fmax = ms * N, slides = need > Fmax * (1 + 1e-9);
      S.add({ t: 'Sum of forces normal to the slope', f: '+↖ ΣF_y = 0', s: `N − ${fmt(W)} cos ${fmt(phi)}° = 0`, r: `N = ${fmt(N)} ${F}` });
      S.add({ t: 'Friction needed to hold it', f: '+↗ ΣF_x = 0', s: `F − ${fmt(W)} sin ${fmt(phi)}° = 0`, r: `F = ${fmt(need)} ${F}` });
      S.add({ t: 'Does it slide?', f: 'F_max = μs N;  slides if tan φ > μs', s: `F_max = ${fmt(ms)}(${fmt(N)}) = ${fmt(Fmax)} ${F};   tan ${fmt(phi)}° = ${fmt(sp / cp)}`, r: slides ? `${fmt(need)} > ${fmt(Fmax)}: the block slides down (the slope is steeper than the angle of repose ${fmt(rep)}°)` : `${fmt(need)} ≤ ${fmt(Fmax)}: the block stays at rest (angle of repose ${fmt(rep)}°)` });
      if (!slides) {
        out.push({ k: 'Friction needed F', v: need, u: F, hl: true }, { k: 'Largest friction μs N', v: Fmax, u: F }, { k: 'Normal force N', v: N, u: F }, { k: 'Angle of repose φs', v: rep, u: '°' });
        return res('Stays at rest: friction holds the block', 'ok', out, S, Object.assign(geo, { N, Ff: need, fUp: true, a: 0, moving: false }), warn);
      }
      const Fk = mk * N, aa = g * (sp - mk * cp);
      S.add({ t: 'Sliding: kinetic friction', f: 'F = μk N', s: `F = ${fmt(mk)}(${fmt(N)})`, r: `F = ${fmt(Fk)} ${F}, up the slope` });
      if (!(aa > 0)) {
        warn.push('Once moving, kinetic friction is enough to stop the block, so it does not keep sliding.');
        out.push({ k: 'Acceleration down the slope a', v: 0, u: U.acc, hl: true }, { k: 'Normal force N', v: N, u: F }, { k: 'Angle of repose φs', v: rep, u: '°' });
        return res('Starts to slip but kinetic friction stops it', 'warn', out, S, Object.assign(geo, { N, Ff: Fk, fUp: true, a: 0, moving: false }), warn);
      }
      S.add({ t: 'Equation of motion down the slope', f: '+↙ ΣF_x = m a  →  a = g(sin φ − μk cos φ)', s: `a = ${fmt(g)}(sin ${fmt(phi)}° − ${fmt(mk)} cos ${fmt(phi)}°)`, r: `a = ${fmt(aa)} ${U.acc}` });
      const t = Math.sqrt((2 * d) / aa), v = aa * t;
      S.add({ t: `Sliding ${fmt(d)} ${Lu} from rest`, f: 'd = ½ a t²;  v = a t', s: `t = √(2 · ${fmt(d)} / ${fmt(aa)});   v = ${fmt(aa)} · t`, r: `t = ${fmt(t)} s, v = ${fmt(v)} ${U.vel}` });
      out.push({ k: 'Acceleration down the slope a', v: aa, u: U.acc, hl: true }, { k: `Time to slide ${fmt(d)} ${Lu}`, v: t, u: 's' }, { k: 'Speed after that distance', v, u: U.vel }, { k: 'Kinetic friction F', v: Fk, u: F }, { k: 'Normal force N', v: N, u: F }, { k: 'Angle of repose φs', v: rep, u: '°' });
      return res(`Slides down: a = ${fmt(aa)} ${U.acc}`, 'warn', out, S, Object.assign(geo, { N, Ff: Fk, fUp: true, a: aa, t, v, moving: true }), warn);
    }
    const upMax = cv + ms * sv > 1e-12 ? (W * (sp + ms * cp)) / (cv + ms * sv) : Infinity;
    if (q.task === 'hold') {
      const stays = W * sp <= ms * W * cp * (1 + 1e-12);
      if (stays) {
        S.add({ t: 'Sum of forces normal to the slope (without P)', f: '+↖ ΣF_y = 0', s: `N − ${fmt(W)} cos ${fmt(phi)}° = 0`, r: `N = ${fmt(W * cp)} ${F}` });
        S.add({ t: 'Is a force needed?', f: 'slides only if tan φ > μs', s: `tan ${fmt(phi)}° = ${fmt(sp / cp)} ≤ μs = ${fmt(ms)}`, r: 'Friction alone holds the block, so P = 0' });
        out.push({ k: 'P to hold the block', v: 0, u: F, hl: true }, { k: 'Largest P before it slides up', v: isFinite(upMax) ? upMax : 0, u: isFinite(upMax) ? F : `${F} (never)` }, { k: 'Normal force N', v: W * cp, u: F }, { k: 'Angle of repose φs', v: rep, u: '°' });
        return res('No force needed: friction holds the block', 'ok', out, S, Object.assign(geo, { P: 0, N: W * cp, Ff: W * sp, fUp: true, moving: false }), warn);
      }
      const den = cv - ms * sv;
      if (!(den > 1e-12)) return fail(`P at ${fmt(psi)}° from the slope lifts the block off the surface faster than it holds it. Use a smaller angle.`);
      const P = (W * (sp - ms * cp)) / den, N = W * cp - P * sv;
      S.add({ t: 'About to slide down', n: 'The smallest P holds the block with friction at its largest value acting up the slope.', f: 'F = μs N', s: `+↖ ΣF_y: N − ${fmt(W)} cos ${fmt(phi)}° + P sin ${fmt(psi)}° = 0;   +↗ ΣF_x: P cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° + ${fmt(ms)} N = 0`, r: `P = ${fmt(P)} ${F}, N = ${fmt(N)} ${F}` });
      if (!(N > 0)) return fail('P lifts the block off the slope. Use a smaller angle for P.');
      if (isFinite(upMax)) S.add({ t: 'About to slide up', n: 'The largest P before the block moves up the slope, with friction μs N acting down the slope.', f: 'P = W(sin φ + μs cos φ) / (cos ψ + μs sin ψ)', s: `P = ${fmt(W)}(sin ${fmt(phi)}° + ${fmt(ms)} cos ${fmt(phi)}°) / (cos ${fmt(psi)}° + ${fmt(ms)} sin ${fmt(psi)}°)`, r: `P = ${fmt(upMax)} ${F}` });
      out.push({ k: 'P to hold the block', v: P, u: F, hl: true }, { k: 'Largest P before it slides up', v: isFinite(upMax) ? upMax : 0, u: isFinite(upMax) ? F : `${F} (never)` }, { k: 'Normal force N', v: N, u: F }, { k: 'Friction force F', v: ms * N, u: F });
      return res(`Hold with P = ${fmt(P)} ${F}`, 'ok', out, S, Object.assign(geo, { P, N, Ff: ms * N, fUp: true, moving: false }), warn);
    }
    // push or pull it up the slope
    if (!isFinite(upMax)) return fail(`P at ${fmt(psi)}° from the slope cannot move the block up. Use a smaller angle.`);
    const Nst = W * cp - upMax * sv;
    S.add({ t: 'Force to start it moving up', n: 'Motion up the slope is about to happen, so F = μs N acts down the slope.', f: '+↗ ΣF_x = 0;  +↖ ΣF_y = 0', s: `P cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° − ${fmt(ms)} N = 0;   N − ${fmt(W)} cos ${fmt(phi)}° + P sin ${fmt(psi)}° = 0`, r: `P = ${fmt(upMax)} ${F}` });
    if (!(Nst > 0)) return fail('P lifts the block off the slope before it moves. Use a smaller angle for P.');
    const ma = Core.convert(mass * acc, base, F), den = cv + mk * sv, Pk = (W * (sp + mk * cp) + ma) / den, N = W * cp - Pk * sv;
    S.add({ t: acc > 0 ? `Force to keep it accelerating up at ${fmt(acc)} ${U.acc}` : 'Force to keep it moving up at constant speed', n: 'Once it moves, kinetic friction F = μk N acts down the slope.', f: acc > 0 ? '+↗ ΣF_x = m a' : '+↗ ΣF_x = 0 (constant speed)', s: `P cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° − ${fmt(mk)} N = ${acc > 0 ? `${fmt(mass)} ${mU} × ${fmt(acc)} = ${fmt(ma)} ${F}` : '0'};   N = ${fmt(W)} cos ${fmt(phi)}° − P sin ${fmt(psi)}°`, r: `P = ${fmt(Pk)} ${F}, N = ${fmt(N)} ${F}` });
    if (!(N > 0)) return fail('P lifts the block off the slope. Use a smaller angle for P.');
    out.push({ k: 'P to keep it moving up', v: Pk, u: F, hl: true }, { k: 'P to start it moving up', v: upMax, u: F }, { k: 'Normal force N', v: N, u: F }, { k: 'Kinetic friction F', v: mk * N, u: F });
    return res(`Push up with P = ${fmt(Pk)} ${F}`, 'ok', out, S, Object.assign(geo, { P: Pk, N, Ff: mk * N, fUp: false, a: acc, moving: true }), warn);
  }

  /* ------------------------------------------------------------------ */
  /* Ladder against a wall                                              */
  /* ------------------------------------------------------------------ */
  function ladder(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, L = +q.L, mA = +q.muA, mB = +q.muB;
    const wp = q.person ? weight({ wBy: q.wpBy, m: q.mp, W: q.Wp }, U, F) : { W: 0 }, Wp = wp.W, s = q.person ? +q.s : 0;
    if (!(W > 0) || !(L > 0)) err.push('Enter the weight and length of the ladder.');
    if (!(mA >= 0) || !(mB >= 0)) err.push('The coefficients of friction must be zero or more.');
    if (q.person && !(s >= 0 && s <= L)) err.push('The person must stand on the ladder (0 to L from the floor end).');
    if (q.person && !(Wp >= 0)) err.push('The person\'s weight must be zero or more.');
    if (err.length) return fail(err);
    const Wt = W + Wp, Mw = W * (L / 2) + Wp * s, S = Steps(), out = [];
    S.add({ t: 'Free-body diagram', n: `The ladder rests on the floor at A and against the wall at B. At A: N_A and friction F_A (toward the wall when the foot slips out). At B: N_B and friction F_B (upward when the top slides down)${mB ? '' : '; the wall is smooth, so F_B = 0'}.`, r: [w.how.replace('W =', 'W_ladder ='), q.person ? wp.how.replace('W =', 'W_person =') : ''].filter(Boolean).join(';  ') });
    if (q.task === 'check') {
      const th = +q.th;
      if (!(th > 0 && th < 90)) return fail('The ladder angle must be between 0° and 90°.');
      const sn = Math.sin(th * DEG), cs = Math.cos(th * DEG);
      const NB = (Mw * cs) / (L * sn + mB * L * cs), FB = mB * NB, NA = Wt - FB, FA = NB, need = FA / NA, slips = need > mA * (1 + 1e-9);
      S.add({ t: 'Moments about A', f: '↺+ ΣM_A = 0', n: mB ? 'The friction at the wall is taken at its largest value μ_B N_B (the top is about to slide), which gives the smallest friction needed at the floor.' : undefined,
        s: `N_B(${fmt(L)} sin ${fmt(th)}°)${mB ? ` + ${fmt(mB)} N_B(${fmt(L)} cos ${fmt(th)}°)` : ''} − ${fmt(W)}(${fmt(L / 2)} cos ${fmt(th)}°)${Wp ? ` − ${fmt(Wp)}(${fmt(s)} cos ${fmt(th)}°)` : ''} = 0`, r: `N_B = ${fmt(NB)} ${F}` });
      S.add({ t: 'Sum of forces', f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0', s: `F_A − N_B = 0;   N_A${mB ? ' + F_B' : ''} − ${fmt(Wt)} = 0`, r: `F_A = ${fmt(FA)} ${F}, N_A = ${fmt(NA)} ${F}` });
      S.add({ t: 'Friction needed at the floor', f: 'μ_needed = F_A / N_A', s: `μ_needed = ${fmt(FA)} / ${fmt(NA)}`, r: `μ_needed = ${fmt(need)} ${slips ? '>' : '≤'} μ_A = ${fmt(mA)}: ${slips ? 'the ladder slips' : 'the ladder stays'}` });
      out.push({ k: 'Friction coefficient needed at A', v: need, u: '', hl: true }, { k: 'N_A', v: NA, u: F }, { k: 'F_A', v: FA, u: F }, { k: 'N_B', v: NB, u: F }, { k: 'F_B', v: FB, u: F });
      return res(slips ? 'Not in equilibrium: the ladder slips' : 'In equilibrium: the ladder stays', slips ? 'warn' : 'ok', out, S, { kind: 'ladder', c, L, th, NA, FA, NB, FB, W, Wp, s, mA, mB });
    }
    const NA = Wt / (1 + mA * mB), FA = mA * NA, NB = FA, FB = mB * NB;
    S.add({ t: 'Slipping is about to happen at A and B', f: 'F_A = μ_A N_A;  F_B = μ_B N_B', n: 'At the smallest angle the ladder is about to slip at both ends at once.' });
    S.add({ t: 'Sum of forces', f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0', s: `${fmt(mA)} N_A − N_B = 0;   N_A + ${fmt(mB)} N_B − ${fmt(Wt)} = 0`, r: `N_A = ${fmt(NA)} ${F}, F_A = N_B = ${fmt(NB)} ${F}${mB ? `, F_B = ${fmt(FB)} ${F}` : ''}` });
    const tn = (Mw - FB * L) / (NB * L);
    if (!(tn > 0)) return fail('With this much friction the ladder stands at any angle: the wall friction alone can hold it. Check the coefficients.');
    const th = Math.atan(tn) / DEG;
    S.add({ t: 'Moments about A', f: '↺+ ΣM_A = 0', s: `${fmt(NB)}(${fmt(L)} sin θ)${mB ? ` + ${fmt(FB)}(${fmt(L)} cos θ)` : ''} − ${fmt(W)}(${fmt(L / 2)} cos θ)${Wp ? ` − ${fmt(Wp)}(${fmt(s)} cos θ)` : ''} = 0`, r: `tan θ = ${fmt(tn)},  θ = ${fmt(th)}°` });
    out.push({ k: 'Smallest angle θ (from the floor)', v: th, u: '°', hl: true }, { k: 'N_A', v: NA, u: F }, { k: 'F_A', v: FA, u: F }, { k: 'N_B', v: NB, u: F }, { k: 'F_B', v: FB, u: F });
    return res(`Slips below θ = ${fmt(th)}°`, 'ok', out, S, { kind: 'ladder', c, L, th, NA, FA, NB, FB, W, Wp, s, mA, mB });
  }

  /* ------------------------------------------------------------------ */
  /* Wedge                                                              */
  /* ------------------------------------------------------------------ */
  function wedge(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, al = +q.al, mu = +q.mu, muC = +q.muC, muG = +q.muG, a = +q.a, xW = +q.xW;
    if (!(W > 0)) err.push('The weight must be greater than zero.');
    if (!(al > 0 && al < 60)) err.push('Use a wedge angle between 0° and 60°.');
    if (!(mu >= 0) || !(muC >= 0) || !(muG >= 0)) err.push('The coefficients of friction must be zero or more.');
    if (q.load === 'lever' && (!(a > 0) || !(xW >= 0))) err.push('Enter where the wedge touches the lever and where the weight acts, measured from the pin A.');
    if (err.length) return fail(err);
    const sa = Math.sin(al * DEG), ca = Math.cos(al * DEG), S = Steps(), out = [];
    // force of the wedge on the load per unit N_B: raising (wedge pushed in) or lowering (wedge pulled out)
    const dirs = { raise: [sa + mu * ca, ca - mu * sa], lower: [sa - mu * ca, ca + mu * sa] };
    const load = q.load === 'lever' ? `a lever pinned at A, with the weight ${fmt(W)} ${F} at ${fmt(xW)} ${Lu} and the wedge at ${fmt(a)} ${Lu} from A` : `a block held in a vertical guide${muG ? ` (μ = ${fmt(muG)} at the guide)` : ' (smooth guide)'}`;
    S.add({ t: 'Free-body diagrams', n: `The wedge (angle ${fmt(al)}°) sits on the floor at C and lifts ${load}. On each contact surface the friction force opposes the motion that is about to happen, and friction is at its largest (F = μs N) at both wedge surfaces. The wedge's own weight is neglected.`, r: w.how });
    const solveCase = (task) => {
      const [hx, hy] = dirs[task], sg = task === 'raise' ? -1 : 1;
      let NB, NW = 0;
      if (q.load === 'lever') {
        if (!(hy > 0)) return null;
        NB = (W * xW) / (hy * a);
      } else {
        const den = hy + sg * muG * Math.abs(hx);
        if (!(den > 0)) return null;
        NB = W / den; NW = NB * hx;
      }
      const fx = NB * hx, fy = NB * hy, NC = fy, Px = task === 'raise' ? fx + muC * NC : fx - muC * NC;
      return { NB, NW, NC, fx, fy, Px };
    };
    const up = solveCase('raise'), dn = solveCase('lower');
    if (!up && q.task === 'raise') return fail('The wedge jams: with this much friction for this wedge angle no push can raise the load. Use a steeper wedge or less friction.');
    const cur = q.task === 'raise' ? up : dn;
    if (!cur) return fail('The load cannot be held at this wedge angle.');
    const lab = q.task === 'raise' ? 'raising the load (wedge pushed in)' : 'lowering the load (wedge pulled out)';
    const fr = q.task === 'raise' ? ['+', '−'] : ['−', '+'];
    if (q.load === 'lever') S.add({ t: `Lever: moments about A (${lab})`, f: '↺+ ΣM_A = 0', n: 'Only the vertical components of N_B and of the friction force at B have a moment about A (A and B are at the same level).', s: `−${fmt(W)}(${fmt(xW)}) + (N_B cos ${fmt(al)}° ${fr[1]} ${fmt(mu)} N_B sin ${fmt(al)}°)(${fmt(a)}) = 0`, r: `N_B = ${fmt(cur.NB)} ${F}` });
    else S.add({ t: `Block: sum of forces (${lab})`, f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0', s: `N_B sin ${fmt(al)}° ${fr[0]} ${fmt(mu)} N_B cos ${fmt(al)}° − N_W = 0;   N_B cos ${fmt(al)}° ${fr[1]} ${fmt(mu)} N_B sin ${fmt(al)}°${muG ? ` ${q.task === 'raise' ? '−' : '+'} ${fmt(muG)}|N_W|` : ''} − ${fmt(W)} = 0`, r: `N_B = ${fmt(cur.NB)} ${F}, N_W = ${fmt(Math.abs(cur.NW))} ${F}` });
    S.add({ t: 'Wedge: sum of vertical forces', f: '+↑ ΣF_y = 0', s: `N_C − N_B cos ${fmt(al)}° ${fr[1]} ${fmt(mu)} N_B sin ${fmt(al)}° = 0`, r: `N_C = ${fmt(cur.NC)} ${F}` });
    const Pneed = q.task === 'raise' ? cur.Px : -cur.Px;
    S.add({ t: 'Wedge: sum of horizontal forces', f: '→+ ΣF_x = 0', s: q.task === 'raise' ? `P − N_B sin ${fmt(al)}° − ${fmt(mu)} N_B cos ${fmt(al)}° − ${fmt(muC)} N_C = 0` : `−P − N_B sin ${fmt(al)}° + ${fmt(mu)} N_B cos ${fmt(al)}° + ${fmt(muC)} N_C = 0`, r: Pneed >= 0 ? `P = ${fmt(Pneed)} ${F} (${q.task === 'raise' ? 'push the wedge in' : 'pull the wedge out'})` : `P = ${fmt(Pneed)} ${F}: the wedge would slide out by itself; a push of ${fmt(-Pneed)} ${F} is needed to hold it` });
    const locking = dn ? dn.Px <= 0 : true;
    S.add({ t: 'Self-locking check', n: 'With P removed, the wedge stays in place if friction alone can hold it, that is if a pull is needed to remove it.', r: locking ? `Pulling it out needs ${fmt(dn ? -dn.Px : 0)} ${F}: the wedge is self-locking` : `It would be pushed out with no force: the wedge is not self-locking (a force of ${fmt(dn.Px)} ${F} is needed to hold it)` });
    out.push({ k: q.task === 'raise' ? 'Push to raise, P' : 'Pull to remove, P', v: Pneed, u: F, hl: true }, { k: 'N_B', v: cur.NB, u: F }, { k: 'N_C', v: cur.NC, u: F });
    if (q.load === 'guide') out.push({ k: 'Guide force N_W', v: Math.abs(cur.NW), u: F });
    if (q.task === 'lower' && up) out.push({ k: 'Push to raise (for comparison)', v: up.Px, u: F });
    if (q.task === 'raise' && dn) out.push({ k: 'Pull to remove (for comparison)', v: -dn.Px, u: F });
    return res(locking ? 'Self-locking wedge' : 'Not self-locking', locking ? 'ok' : 'warn', out, S, { kind: 'wedge', c, W, al, mu, muC, load: q.load, a, xW, task: q.task, P: Pneed, NB: cur.NB, NC: cur.NC, NW: cur.NW }, locking ? [] : ['The wedge is not self-locking: without P it would slide out.']);
  }

  /* ------------------------------------------------------------------ */
  /* Square-threaded screw                                              */
  /* ------------------------------------------------------------------ */
  function screw(q, c) {
    const { F, Lu, Ls } = c, err = [], W = +q.W, r = +q.r, l = +q.l, mu = +q.mu, n = Math.round(+q.n || 1);
    if (!(W > 0)) err.push('The axial load W must be greater than zero.');
    if (!(r > 0) || !(l > 0)) err.push('Enter the mean radius and the lead.');
    if (!(mu >= 0)) err.push('The coefficient of static friction must be zero or more.');
    if (err.length) return fail(err);
    const th = Math.atan(l / (2 * Math.PI * r)), ph = Math.atan(mu), rL = Core.convert(r, Ls, Lu), S = Steps(), out = [];
    const nn = n > 1 ? `${n} ` : '', nW = n > 1 ? `${n}(` : '', nE = n > 1 ? ')' : '';
    S.add({ t: 'Lead angle', f: 'θ = tan⁻¹(l / 2πr)', s: `θ = tan⁻¹(${fmt(l)} / (2π · ${fmt(r)}))`, r: `θ = ${fmt(th / DEG)}°` });
    S.add({ t: 'Angle of static friction', f: 'φs = tan⁻¹ μs', s: `φs = tan⁻¹ ${fmt(mu)}`, r: `φs = ${fmt(ph / DEG)}°` });
    const Mup = n * W * rL * Math.tan(th + ph), lock = ph >= th, Mdn = n * W * rL * Math.tan(Math.abs(ph - th));
    if (n > 1) S.add({ t: 'Number of screws', n: `${n} screws turn together (for example a turnbuckle), so the moment is ${n} times that of one screw.` });
    if (q.task === 'raise') {
      S.add({ t: 'Moment to raise the load (upward impending motion)', f: 'M = W r tan(θ + φs)', s: `M = ${nW}${fmt(W)} · ${fmt(rL)} · tan(${fmt(th / DEG)}° + ${fmt(ph / DEG)}°)${nE}`, r: `M = ${fmt(Mup)} ${c.FL}` });
    } else {
      S.add({ t: lock ? 'Moment to lower the load (downward impending motion)' : 'Moment to hold the load', f: lock ? "M'' = W r tan(φs − θ)" : "M' = W r tan(θ − φs)", s: `M = ${nW}${fmt(W)} · ${fmt(rL)} · tan(${lock ? `${fmt(ph / DEG)}° − ${fmt(th / DEG)}°` : `${fmt(th / DEG)}° − ${fmt(ph / DEG)}°`})${nE}`, r: `M = ${fmt(Mdn)} ${c.FL}` });
    }
    S.add({ t: 'Self-locking check', f: 'self-locking if φs ≥ θ', s: `φs = ${fmt(ph / DEG)}°, θ = ${fmt(th / DEG)}°`, r: lock ? 'φs ≥ θ: the screw holds the load when the moment is removed' : 'φs < θ: the screw unwinds under the load when the moment is removed' });
    out.push({ k: q.task === 'raise' ? 'Moment to raise M' : lock ? 'Moment to lower M' : 'Moment to hold M', v: q.task === 'raise' ? Mup : Mdn, u: c.FL, hl: true }, { k: 'Lead angle θ', v: th / DEG, u: '°' }, { k: 'Friction angle φs', v: ph / DEG, u: '°' });
    out.push({ k: q.task === 'raise' ? (lock ? 'Moment to lower (for comparison)' : 'Moment to hold (for comparison)') : 'Moment to raise (for comparison)', v: q.task === 'raise' ? Mdn : Mup, u: c.FL });
    return res(lock ? 'Self-locking screw' : 'Not self-locking', lock ? 'ok' : 'warn', out, S, { kind: 'screw', c, W, r, l, mu, n, th: th / DEG, ph: ph / DEG, M: q.task === 'raise' ? Mup : Mdn, task: q.task, lock }, lock ? [] : ['The screw is not self-locking: φs < θ.']);
  }

  /* ------------------------------------------------------------------ */
  /* Flat belt over one or more drums                                   */
  /* ------------------------------------------------------------------ */
  function belt(q, c) {
    const { F, U } = c, err = [], T0 = +q.T, drums = q.drums || [];
    if (!(T0 > 0)) err.push('The known tension must be greater than zero.');
    if (!drums.length) err.push('Add at least one drum.');
    drums.forEach((d, i) => { if (!(+d.beta > 0) && !(+d.turns > 0)) err.push(`Drum ${i + 1}: enter the contact angle.`); if (!(+d.mu >= 0)) err.push(`Drum ${i + 1}: μ must be zero or more.`); });
    if (err.length) return fail(err);
    const hi = q.known === 'high', S = Steps(), out = [], Ts = [T0];
    S.add({ t: 'Belt friction', f: 'T₂ = T₁ e^(μβ)', n: `T₂ is the tension on the side toward which the belt is about to slip (the larger one), β the contact angle in radians. The ${hi ? 'larger' : 'smaller'} tension ${fmt(T0)} ${F} is known, and the drums are taken in order ${hi ? 'from that end' : 'from that end toward the larger tension'}.` });
    drums.forEach((d, i) => {
      const deg = (+d.beta || 0) + 360 * (+d.turns || 0), b = deg * DEG, k = Math.exp(+d.mu * b), T = Ts[i], Tn = hi ? T / k : T * k;
      S.add({ t: `Drum ${i + 1}`, f: hi ? 'T₁ = T₂ / e^(μβ)' : 'T₂ = T₁ e^(μβ)', s: `β = ${fmt(deg)}° = ${fmt(b)} rad;   e^(${fmt(+d.mu)} · ${fmt(b)}) = ${fmt(k)};   ${hi ? `T₁ = ${fmt(T)} / ${fmt(k)}` : `T₂ = ${fmt(T)} · ${fmt(k)}`}`, r: `T = ${fmt(Tn)} ${F}` });
      Ts.push(Tn);
    });
    const Tend = Ts[Ts.length - 1], sumMB = drums.reduce((a, d) => a + (+d.mu) * ((+d.beta || 0) + 360 * (+d.turns || 0)) * DEG, 0);
    S.add({ t: 'Check: the whole belt at once', f: 'T₂ / T₁ = e^(Σμβ)', s: `e^(${fmt(sumMB)}) = ${fmt(Math.exp(sumMB))}`, r: `T₂ / T₁ = ${fmt(Math.max(T0, Tend))} / ${fmt(Math.min(T0, Tend))} = ${fmt(Math.max(T0, Tend) / Math.min(T0, Tend))}` });
    Ts.forEach((T, i) => out.push({ k: i === 0 ? 'Known tension' : `Tension after drum ${i}`, v: T, u: F, hl: i === Ts.length - 1 }));
    out.push({ k: 'Ratio of the tensions', v: Math.max(T0, Tend) / Math.min(T0, Tend), u: '' });
    if (hi) {
      const Tb = U.id === 'US' ? Core.convert(Tend, F, 'lb') : Core.convert(Tend, F, 'N'), m = Tb / (U.id === 'US' ? 32.2 : 9.81);
      S.add({ t: 'Load that can be held', n: 'A weight hanging from the low-tension end can be as large as the last tension.', s: `m = W / g = ${fmt(Tb)} / ${fmt(U.id === 'US' ? 32.2 : 9.81)}`, r: `W = ${fmt(Tend)} ${F},  m = ${fmt(m)} ${U.id === 'US' ? 'slug' : 'kg'}` });
      out.push({ k: 'Mass that can be held', v: m, u: U.id === 'US' ? 'slug' : 'kg' });
    }
    return res(`Belt about to slip · tension ratio ${fmt(Math.max(T0, Tend) / Math.min(T0, Tend))}`, 'ok', out, S, { kind: 'belt', c, Ts, drums: drums.map((d) => ({ deg: (+d.beta || 0) + 360 * (+d.turns || 0), mu: +d.mu })), hi });
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['b', 'H', 'hP', 'L', 's', 'a', 'xW', 'd', 'acc']), SML = new Set(['r', 'l']), FOR = new Set(['W', 'P', 'Wp', 'T']), MAS = new Set(['m', 'mp']);
  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, UNITS } = Core;
    const kL = convert(1, UNITS[from].len, UNITS[to].len), kS = convert(1, UNITS[from].lenS, UNITS[to].lenS), f1 = twin(st.fu, to), kF = convert(1, st.fu, f1), kM = convert(1, from === 'SI' ? 'kg' : 'slug', to === 'SI' ? 'kg' : 'slug');
    ['bk', 'ic', 'ld', 'wd', 'sc', 'bt'].forEach((g) => {
      const o = st[g]; if (!o) return;
      Object.keys(o).forEach((k) => {
        const v = o[k]; if (typeof v !== 'number') return;
        if (LEN.has(k)) o[k] = tidy(v * kL, 9); else if (SML.has(k)) o[k] = tidy(v * kS, 9); else if (FOR.has(k)) o[k] = tidy(v * kF, 9); else if (MAS.has(k)) o[k] = tidy(v * kM, 9);
      });
    });
    st.fu = f1;
    return st;
  }

  const Friction = { defaults, solve, convertState };
  root.Friction = Friction;
  if (typeof module !== 'undefined' && module.exports) module.exports = Friction;
})(typeof window !== 'undefined' ? window : globalThis);
