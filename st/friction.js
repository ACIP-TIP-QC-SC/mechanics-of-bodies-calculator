/* =====================================================================
 * STATICS · Friction (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapter 8, sections 8.1 to 8.5.
 *   block   block on a floor or incline pushed at a height: no motion, slip or tip (8.2)
 *   incline block on an incline treated as a particle: does it slide down by itself, the force to hold it,
 *           the force to push it up (μs to start, μk to keep it moving); sliding uses μk and ΣF = ma
 *   ladder  ladder against a wall: smallest angle, or the floor friction needed (8.2)
 *   wedge   wedge lifting a block in a guide or a lever pinned at one end (8.3)
 *   screw   square-threaded screw: M = W r tan(θ ± φs) (8.4)
 *   belt    flat belt, rope or V-belt over one or more drums: T2 = T1 e^(μβ) (8.5); a band on a wheel carrying
 *           a torque, with the lever that tightens it (band brakes)
 *   bearing collar, disk and pivot bearings M = ⅔ μs P (R₂³ − R₁³)/(R₂² − R₁²) (8.6), journal bearings
 *           M = R r sin φk (8.7), rolling resistance P ≈ W a / r (8.8)
 *   vehicle car, truck or cart on two axles on a level road or a slope; each axle rolls freely,
 *           is braked (locked) or driven: axle reactions, friction needed and μs needed when parked,
 *           the force P that starts it moving (towing) or that it can pull, and the steepest slope
 *           before it slips or tips (8.2)
 *   round   round body (spool, hoop, disk) on a floor and against a wall, each rough or smooth: the force P that
 *           turns it in place, whether a given P turns it, or the μs at which it just turns (8.2)
 *   brake   block brake or pawl: a shoe on a lever pressed against a wheel that carries a torque M; the lever
 *           force for M, the torque a force resists, and self-locking (8.2); a double-block brake with two
 *           levers, a link, a bell-crank and a handle (Probs. 8-37, 8-38)
 *   two     two bodies (8.2): blocks on an incline joined by a spring or cord (the angle at which one or both
 *           slip), a block on a block pulled apart or together, and a person pushing or pulling a crate
 * Forces are in the chosen force unit `fu`, lengths in m or ft, screw sizes in mm or in.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps, tidy, bisect, linSolve } = Core;
  const DEG = Math.PI / 180;

  function defaults() {
    return {
      mode: 'block', fu: 'N',
      bk: { wBy: 'mass', m: 20, W: 196.2, b: 0.8, H: 0.6, phi: 0, mu: 0.3, task: 'check', P: 80, psi: -30, hP: 0.2 },
      ic: { wBy: 'mass', m: 20, W: 196.2, phi: 30, mus: 0.3, muk: 0.25, task: 'release', psi: 0, acc: 0, d: 3, P: 0 },
      be: { kind: 'collar', P: 5000, R1: 0.075, R2: 0.1, mu: 0.3, rs: 0.05, a: 0.003, rw: 0.075, task: 'M', M: 100, W: 2000, aB: 0 },
      ld: { wBy: 'mass', m: 10, W: 98.1, L: 4, muA: 0.3, muB: 0, task: 'minAngle', th: 65, person: false, mp: 75, Wp: 735.8, wpBy: 'mass', s: 3 },
      wd: { load: 'lever', wBy: 'mass', m: 500, W: 4905, al: 7, mu: 0.3, muC: 0.3, muG: 0, a: 1, xW: 0.5, task: 'lower' },
      sc: { W: 2000, r: 5, l: 2, mu: 0.25, n: 2, task: 'raise' },
      vh: { wBy: 'mass', m: 1500, W: 14715, a: 1.5, b: 3, h: 1.1, phi: 12, rise: 'A', mu: 0.6, axA: 'locked', axB: 'free', task: 'park', front: 'B',
        hasP: false, P: 0, xP: -0.75, yP: 0.3, psi: 150, move: 'A' },
      tw: { arr: 'inc', wBy: 'force', mA: 10, WA: 98.1, mB: 6, WB: 58.86, muA: 0.15, muB: 0.25, phi: 0, lower: 'A', conn: 'spring', k: 30, task: 'both',
        Pon: 'B', al: 0, tie: true, beta: 30, muG: 0.3, how: 'push', thC: 0, thM: 0, tip: false, b: 1, h: 1.2 },
      rd: { wBy: 'force', m: 30, W: 300, R: 3, wall: 'right', muF: 0.25, muW: 0.25, task: 'P', rP: 1, thP: -90, psi: 0, P: 300 },
      br: { rW: 0.25, mu: 0.4, task: 'P', M: 800, P: 100, a: 0.2, b: 0.4, e: 0.05, rev: false,
        // double-block brake (kind 'double'): wheel, levers AD and BK, link KC, bell-crank EDC, link EJ and handle
        kind: 'single', task2: 'P', r2: 0.2, M2: 5, P2: 1, rev2: false, mu2: 0.8, hH: 0.4, hD: 0.7, hI: 0.4, hK: 0.8, dDC: 0.1, dDE: 0.2, aP: 0.65, aJ: 0.15, t2: 0 },
      bt: { known: 'high', T: 500, drums: [{ beta: 135, turns: 0, mu: 0.25, alpha: 0 }, { beta: 135, turns: 0, mu: 0.25, alpha: 0 }], wheel: false, task: 'T', rW: 0.15, M: 50, P: 30, lever: false, aL: 0.4, dT: 0, dS: 0.2 },
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
    if (st.mode === 'vehicle') return vehicle(st.vh, c);
    if (st.mode === 'bearing') return bearing(st.be, c);
    if (st.mode === 'two') return two(st.tw, c);
    if (st.mode === 'round') return round(st.rd, c);
    if (st.mode === 'brake') return brake(st.br, c);
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
    out.push({ k: 'Friction needed F', v: Ff, u: F, hl: true }, { k: 'Normal force N', v: N, u: F, hl: true }, { k: 'Position of N, x', v: x, u: Lu, hl: true }, { k: 'Largest friction μs N', v: Fmax, u: F }, { k: 'μs needed to prevent slipping', v: N > 0 ? Math.abs(Ff) / N : 0, u: '' });
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
    if (q.task !== 'mu' && (!(ms >= 0) || !(mk >= 0))) err.push('The coefficients of friction must be zero or more.');
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
    if (q.task === 'mu') {
      const P = +q.P || 0, N = W * cp - P * sv, Fn = W * sp - P * cv;
      if (!(N > 0)) return fail('P lifts the block off the slope. Use a smaller P or angle.');
      S.add({ t: 'Sum of forces normal to the slope', f: '+↖ ΣF_y = 0', s: `N − ${fmt(W)} cos ${fmt(phi)}° + ${fmt(P)} sin ${fmt(psi)}° = 0`, r: `N = ${fmt(N)} ${F}` });
      S.add({ t: 'Friction needed for equilibrium', f: '+↗ ΣF_x = 0', s: `${fmt(P)} cos ${fmt(psi)}° − ${fmt(W)} sin ${fmt(phi)}° + F = 0`, r: `F = ${fmt(Math.abs(Fn))} ${F}, ${Fn >= 0 ? 'up' : 'down'} the slope` });
      const mu = Math.abs(Fn) / N;
      S.add({ t: 'Motion about to happen', f: 'F = μs N', n: `When motion is about to happen the friction is at its largest value, so the block is about to slide ${Fn > 0 ? 'down' : Fn < 0 ? 'up' : 'neither way'} the slope with`, s: `μs = ${fmt(Math.abs(Fn))} / ${fmt(N)}`, r: `μs = ${fmt(mu)} (friction angle ${fmt(Math.atan(mu) / DEG)}°)` });
      out.push({ k: 'μs for impending motion', v: mu, u: '', hl: true }, { k: 'Friction force F', v: Math.abs(Fn), u: F }, { k: 'Normal force N', v: N, u: F }, { k: 'Friction angle φs', v: Math.atan(mu) / DEG, u: '°' });
      return res(`Motion impends at μs = ${fmt(mu)}`, 'ok', out, S, Object.assign(geo, { rep: Math.atan(mu) / DEG, P, N, Ff: Math.abs(Fn), fUp: Fn >= 0, moving: false }), warn);
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
    const { F, U, FL } = c, err = [], drums = q.drums || [];
    const wheel = !!q.wheel, task = wheel ? q.task || 'T' : 'chain';
    const T0 = +q.T;
    if (!drums.length) err.push('Add at least one drum.');
    if (!wheel && !(T0 > 0)) err.push('The known tension must be greater than zero.');
    drums.forEach((d, i) => {
      if (!(+d.beta > 0) && !(+d.turns > 0)) err.push(`Drum ${i + 1}: enter the contact angle.`);
      if (!(+d.mu >= 0)) err.push(`Drum ${i + 1}: μ must be zero or more.`);
      const al = +d.alpha || 0; if (al < 0 || al >= 180) err.push(`Drum ${i + 1}: the groove angle α must be from 0° (flat belt) to less than 180°.`);
    });
    if (err.length) return fail(err);
    // V-belt: the wedging raises the friction, μ' = μ / sin(α/2) (Prob. 8-98); α = 0 is a flat belt
    const D = drums.map((d) => { const deg = (+d.beta || 0) + 360 * (+d.turns || 0), al = +d.alpha || 0, mue = al > 0 ? +d.mu / Math.sin((al / 2) * DEG) : +d.mu; return { deg, b: deg * DEG, al, mu: +d.mu, mue, k: Math.exp(mue * deg * DEG) }; });
    const S = Steps(), out = [], vb = D.some((d) => d.al > 0);
    S.add({ t: 'Belt friction', f: vb ? "T₂ = T₁ e^(μβ / sin(α/2))  (V-belt in a groove of angle α; α = 0 is a flat belt)" : 'T₂ = T₁ e^(μβ)', n: 'T₂ is the tension on the side toward which the belt is about to slip (the larger one), β the contact angle in radians.' });
    if (wheel) return beltWheel(q, c, D[0], S, out, drums.length > 1);
    const hi = q.known === 'high', Ts = [T0];
    S.add({ t: 'Known tension', n: `The ${hi ? 'larger' : 'smaller'} tension ${fmt(T0)} ${F} is known, and the drums are taken in order from that end.` });
    D.forEach((d, i) => {
      const T = Ts[i], Tn = hi ? T / d.k : T * d.k;
      S.add({ t: `Drum ${i + 1}`, f: hi ? 'T₁ = T₂ / e^(μ′β)' : 'T₂ = T₁ e^(μ′β)', s: `β = ${fmt(d.deg)}° = ${fmt(d.b)} rad;${d.al > 0 ? ` μ′ = ${fmt(d.mu)}/sin ${fmt(d.al / 2)}° = ${fmt(d.mue)};` : ''}   e^(${fmt(d.mue)} · ${fmt(d.b)}) = ${fmt(d.k)};   ${hi ? `T₁ = ${fmt(T)} / ${fmt(d.k)}` : `T₂ = ${fmt(T)} · ${fmt(d.k)}`}`, r: `T = ${fmt(Tn)} ${F}` });
      Ts.push(Tn);
    });
    const Tend = Ts[Ts.length - 1], sumMB = D.reduce((a, d) => a + d.mue * d.b, 0);
    S.add({ t: 'Check: the whole belt at once', f: 'T₂ / T₁ = e^(Σμ′β)', s: `e^(${fmt(sumMB)}) = ${fmt(Math.exp(sumMB))}`, r: `T₂ / T₁ = ${fmt(Math.max(T0, Tend))} / ${fmt(Math.min(T0, Tend))} = ${fmt(Math.max(T0, Tend) / Math.min(T0, Tend))}` });
    Ts.forEach((T, i) => out.push({ k: i === 0 ? 'Known tension' : `Tension after drum ${i}`, v: T, u: F, hl: i === Ts.length - 1 }));
    out.push({ k: 'Ratio of the tensions', v: Math.max(T0, Tend) / Math.min(T0, Tend), u: '' });
    if (hi) {
      const Tb = U.id === 'US' ? Core.convert(Tend, F, 'lb') : Core.convert(Tend, F, 'N'), m = Tb / gOf(U);
      S.add({ t: 'Load that can be held', n: 'A weight hanging from the low-tension end can be as large as the last tension.', s: `m = W / g = ${fmt(Tb)} / ${fmt(gOf(U))}`, r: `W = ${fmt(Tend)} ${F},  m = ${fmt(m)} ${U.id === 'US' ? 'slug' : 'kg'}` });
      out.push({ k: 'Mass that can be held', v: m, u: U.id === 'US' ? 'slug' : 'kg' });
    }
    return res(`Belt about to slip · tension ratio ${fmt(Math.max(T0, Tend) / Math.min(T0, Tend))}`, 'ok', out, S, { kind: 'belt', c, Ts, drums: D, hi });
  }
  /**
   * Band or belt on a wheel that carries a torque M (band brakes, belt drives, Probs. 8-93, 8-99, 8-106):
   *   (T₂ − T₁) r = M with T₂ = T₁ e^(μ′β); optionally the two band ends pull on a lever pivoted at O,
   *   P a = d_T T₂ + d_S T₁ (signed moment arms about O; + where the band resists P).
   * task 'M': torque the band can carry from a known tension; 'T': tensions (and P on the lever) for a given M;
   * 'lever': torque that a given lever force P can resist.
   */
  function beltWheel(q, c, d, S, out, extra) {
    const { F, FL } = c, err = [], r = +q.rW, task = q.task || 'T', lever = !!q.lever, a = +q.aL, dT = +q.dT || 0, dS = +q.dS || 0;
    if (!(r > 0)) err.push('Enter the radius of the wheel.');
    if (lever && !(a > 0)) err.push('Enter the arm of P about the lever pivot.');
    if (task === 'M' && !(+q.T > 0)) err.push('The known tension must be greater than zero.');
    if (task === 'T' && !(+q.M > 0)) err.push('Enter the torque M on the wheel.');
    if (task === 'lever' && !(+q.P > 0)) err.push('Enter the force P on the lever.');
    if (err.length) return fail(err);
    const k = d.k, warn = extra ? ['Only the first drum is used: the wheel carries the band over one contact angle.'] : [];
    S.add({ t: 'Ratio of the tensions on the wheel', s: `β = ${fmt(d.deg)}° = ${fmt(d.b)} rad${d.al > 0 ? `, μ′ = ${fmt(d.mu)}/sin ${fmt(d.al / 2)}° = ${fmt(d.mue)}` : ''}`, r: `T₂ / T₁ = e^(${fmt(d.mue)} · ${fmt(d.b)}) = ${fmt(k)}` });
    let T1, T2, M, P = null;
    const leverArm = (dT * k + dS) / (r * (k - 1)); // P a = leverArm · M
    if (task === 'M') {
      const hi = q.known === 'high';
      T2 = hi ? +q.T : +q.T * k; T1 = T2 / k; M = (T2 - T1) * r;
      S.add({ t: 'Torque the band can carry', f: 'M = (T₂ − T₁) r', s: `T₁ = ${fmt(T1)}, T₂ = ${fmt(T2)};  M = (${fmt(T2)} − ${fmt(T1)})(${fmt(r)})`, r: `M = ${fmt(M)} ${FL}` });
    } else if (task === 'lever') {
      if (!lever) return fail('Turn on the lever to find the torque from the force P.');
      if (!(leverArm > 0)) return fail('With these arms the band does not resist P: check the signs of d_T and d_S.');
      P = +q.P; M = (P * a) / leverArm; T1 = M / (r * (k - 1)); T2 = k * T1;
      S.add({ t: 'Wheel', f: '(T₂ − T₁) r = M,  T₂ = T₁ e^(μ′β)  ⇒  T₁ = M / (r(e^(μ′β) − 1)),  T₂ = e^(μ′β) T₁', s: `T₁ = ${fmt(1 / (r * (k - 1)))} M, T₂ = ${fmt(k / (r * (k - 1)))} M` });
      S.add({ t: 'Lever', n: 'Moments about the lever pivot. d_T and d_S are the moment arms of the tight and slack ends, positive when that tension opposes P.', f: 'P a = d_T T₂ + d_S T₁', s: `${fmt(P)}(${fmt(a)}) = ${fmt(dT)}(${fmt(k / (r * (k - 1)))} M) + ${fmt(dS)}(${fmt(1 / (r * (k - 1)))} M)`, r: `M = ${fmt(M)} ${FL}, T₁ = ${fmt(T1)} ${F}, T₂ = ${fmt(T2)} ${F}` });
    } else {
      M = +q.M; T1 = M / (r * (k - 1)); T2 = k * T1;
      S.add({ t: 'Wheel', f: '(T₂ − T₁) r = M,  T₂ = T₁ e^(μ′β)', s: `T₁ = ${fmt(M)} / (${fmt(r)}(${fmt(k)} − 1))`, r: `T₁ = ${fmt(T1)} ${F}, T₂ = ${fmt(T2)} ${F}` });
      if (lever) {
        P = (dT * T2 + dS * T1) / a;
        if (!(P > 0)) return fail('With these arms the band ends alone hold the lever: P would be negative. Check the signs of d_T and d_S.');
        S.add({ t: 'Lever', n: 'Moments about the lever pivot. d_T and d_S are the moment arms of the tight and slack ends, positive when that tension opposes P.', f: 'P = (d_T T₂ + d_S T₁) / a', s: `P = (${fmt(dT)}(${fmt(T2)}) + ${fmt(dS)}(${fmt(T1)})) / ${fmt(a)}`, r: `P = ${fmt(P)} ${F}` });
      }
    }
    out.push({ k: 'Slack-side tension T₁', v: T1, u: F, hl: task === 'T' && !lever }, { k: 'Tight-side tension T₂', v: T2, u: F, hl: task === 'T' && !lever }, { k: 'Torque on the wheel M', v: M, u: FL, hl: task !== 'T' });
    if (P !== null) out.push({ k: 'Force on the lever P', v: P, u: F, hl: task === 'T' });
    out.push({ k: 'Ratio of the tensions', v: k, u: '' });
    return res(task === 'T' ? (P !== null ? `P = ${fmt(P)} ${F}` : `T₂ = ${fmt(T2)} ${F}`) : `M = ${fmt(M)} ${FL}`, 'ok', out, S, { kind: 'belt', c, Ts: [T1, T2], drums: [d], hi: false, wheel: { r, M, T1, T2, lever, a, dT, dS, P } }, warn);
  }


  /* ------------------------------------------------------------------ */
  /* Round body on a floor and against a wall (spool, hoop, disk)       */
  /* ------------------------------------------------------------------ */
  /**
   * Centre O at the origin, radius R. The floor touches at (0, −R) and pushes up; the wall touches at (sR, 0)
   * (s = +1 right, −1 left) and pushes toward O. P acts at (rP cos θP, rP sin θP) in the direction ψ.
   * Turning in place with sense ω (+1 counterclockwise) makes the rim slide over both surfaces, so the
   * friction at each rough contact is μN against that sliding:
   *   ΣFx:  P cos ψ − ω μF N_F − s N_W = 0
   *   ΣFy:  P sin ψ + N_F − ω s μW N_W = W
   *   ΣMO:  P m − ω R (μF N_F + μW N_W) = 0,   m = xP sin ψ − yP cos ψ (moment arm of P about O, + ccw)
   */
  function roundCrit(W, R, s, muF, muW, m, cps, sps) {
    const om = Math.sign(m);
    const { x } = Core.linSolve([[cps, -om * muF, -s], [sps, 1, -om * s * muW], [m, -om * R * muF, -om * R * muW]], [0, W, 0]);
    return x ? { P: x[0], NF: x[1], NW: x[2], om } : null;
  }
  function round(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, R = +q.R, rP = +q.rP, th = (+q.thP || 0) * DEG, psi = (+q.psi || 0) * DEG, s = q.wall === 'left' ? -1 : 1;
    const task = q.task || 'P';
    let muF = +q.muF, muW = +q.muW;
    if (!(W > 0)) err.push('The weight must be greater than zero.');
    if (!(R > 0)) err.push('Enter the radius of the body.');
    if (!(rP >= 0) || rP > R * 1.0000001) err.push('The point where P acts must lie on or inside the rim (0 ≤ r_P ≤ R).');
    if (task !== 'mu' && (!(muF >= 0) || !(muW >= 0))) err.push('The friction coefficients must be zero or more.');
    if (task !== 'P' && !(+q.P > 0)) err.push('Enter the force P.');
    if (err.length) return fail(err);
    const xP = rP * Math.cos(th), yP = rP * Math.sin(th), cps = Math.cos(psi), sps = Math.sin(psi), m = xP * sps - yP * cps;
    if (Math.abs(m) < 1e-9 * R) return fail('P passes through the centre O, so it cannot turn the body in place. Move its point or change its direction.');
    const om = Math.sign(m), sense = om > 0 ? 'counterclockwise' : 'clockwise', wallTxt = s > 0 ? 'right' : 'left';
    const S = Steps(), out = [];
    S.add({ t: 'Free-body diagram', n: `The body touches the floor at B (0, −R) and the wall on the ${wallTxt} at A. P acts at (${fmt(xP)}, ${fmt(yP)}) ${Lu} from the centre O, at ${fmt(+q.psi || 0)}° from the +x axis. Its moment about O turns the body ${sense}, so the rim slides over both surfaces and friction at each rough contact opposes that sliding.`, s: w.how });
    S.add({ t: 'Moment arm of P about O', f: 'm = x_P sin ψ − y_P cos ψ', s: `m = ${fmt(xP)} sin ${fmt(+q.psi || 0)}° − (${fmt(yP)}) cos ${fmt(+q.psi || 0)}°`, r: `m = ${fmt(m)} ${Lu} (${sense})` });
    const eqTxt = (mf, mw) => `+→ ΣFx: P cos ψ ${om > 0 ? '−' : '+'} ${fmt(mf)} N_B ${s > 0 ? '−' : '+'} N_A = 0;  +↑ ΣFy: P sin ψ + N_B ${om * s > 0 ? '−' : '+'} ${fmt(mw)} N_A − ${fmt(W)} = 0;  ↺+ ΣM_O: ${fmt(m)} P ${om > 0 ? '−' : '+'} ${fmt(R)}(${fmt(mf)} N_B + ${fmt(mw)} N_A) = 0`;
    const verdictOf = (x) => (x.NF < -1e-9 * W ? 'floor' : x.NW < -1e-9 * W ? 'wall' : x.P <= 0 ? 'P' : '');
    const lostMsg = { floor: 'the body would have to be held down onto the floor (N_B < 0): it lifts off before it can turn in place', wall: 'the body would have to be pulled onto the wall (N_A < 0): it moves away from the wall before it can turn in place', P: 'no positive P turns it: friction at the contacts locks it for any P in this direction (self-locking)' };
    const geo = (x, P, verdict) => ({ kind: 'round', c, W, R, s, xP, yP, psi: +q.psi || 0, P, NF: x.NF, NW: x.NW, FF: x.FF, FW: x.FW, om, verdict, muF, muW });
    // friction forces on the body from the normal forces (at their limit while turning)
    const lim = (x) => Object.assign(x, { FF: -om * muF * x.NF, FW: -om * s * muW * x.NW });
    if (task === 'mu') {
      const P = +q.P, crit = (mu) => roundCrit(W, R, s, mu, mu, m, cps, sps);
      const f = (mu) => { const x = crit(mu); return x ? x.P - P : NaN; };
      S.add({ t: 'Same μs at A and B', n: 'Find the μs at which the given P just turns the body in place: the force that turns it, P(μs), grows with μs.', f: eqTxt(0, 0).replace(/0 N_/g, 'μs N_') });
      if (!(f(0) < 0)) return fail('Even on smooth surfaces this P does not turn the body: with μs = 0 the body is held only by normal forces, and P would have to be larger. Check its point and direction.');
      let hi = 0.05; while (hi < 50 && (Number.isNaN(f(hi)) || f(hi) < 0 || verdictOf(crit(hi)))) hi *= 1.6;
      if (!(hi < 50) || !(f(hi) >= 0)) return fail('No μs makes this P just turn the body in place (it would lift off a surface first).');
      const mu = bisect(f, 0, hi, 200); muF = muW = mu;
      const x = lim(crit(mu));
      S.add({ t: 'Solve', s: eqTxt(mu, mu), r: `μs = ${fmt(mu)};  N_B = ${fmt(x.NF)} ${F}, N_A = ${fmt(x.NW)} ${F}` });
      out.push({ k: 'μs at which it just turns', v: mu, u: '', hl: true }, { k: 'N_B (floor)', v: x.NF, u: F }, { k: 'F_B (floor)', v: Math.abs(x.FF), u: F }, { k: 'N_A (wall)', v: x.NW, u: F }, { k: 'F_A (wall)', v: Math.abs(x.FW), u: F });
      return res(`μs = ${fmt(mu)}`, 'ok', out, S, geo(x, P, ''));
    }
    if (!(muF > 0) && !(muW > 0)) return fail('Both surfaces are smooth: any force with a moment about O turns the body, since nothing resists it. Enter μs for at least one contact.');
    const x = roundCrit(W, R, s, muF, muW, m, cps, sps);
    if (!x) return fail('The equations have no unique solution for this layout.');
    lim(x);
    const lost = verdictOf(x);
    S.add({ t: 'Turning in place is about to happen', n: 'Slipping impends at both contacts at once: F_B = μs N_B on the floor and F_A = μs N_A on the wall (zero where a surface is smooth).', f: `F_B = ${fmt(muF)} N_B,  F_A = ${fmt(muW)} N_A`, s: eqTxt(muF, muW), r: lost ? `No: ${lostMsg[lost]}.` : `P = ${fmt(x.P)} ${F};  N_B = ${fmt(x.NF)} ${F}, F_B = ${fmt(Math.abs(x.FF))} ${F};  N_A = ${fmt(x.NW)} ${F}, F_A = ${fmt(Math.abs(x.FW))} ${F}` });
    if (task === 'P') {
      if (lost) return fail(`P cannot turn the body in place: ${lostMsg[lost]}.`);
      out.push({ k: 'Force P to turn it', v: x.P, u: F, hl: true }, { k: 'N_B (floor)', v: x.NF, u: F }, { k: 'F_B (floor)', v: Math.abs(x.FF), u: F }, { k: 'N_A (wall)', v: x.NW, u: F }, { k: 'F_A (wall)', v: Math.abs(x.FW), u: F });
      return res(`P = ${fmt(x.P)} ${F} turns it ${sense}`, 'ok', out, S, geo(x, x.P, 'turns'));
    }
    // a given P: compare with the force that turns it; with at most one rough contact the reactions follow from statics
    const P = +q.P, turns = !lost && P >= x.P * (1 - 1e-9);
    const nRough = (muF > 0 ? 1 : 0) + (muW > 0 ? 1 : 0);
    let y = null;
    if (nRough === 1) {
      // unknowns N_B, N_A and the friction at the rough contact (along x on the floor, along y on the wall)
      const fl = muF > 0, z = Core.linSolve([[0, -s, fl ? 1 : 0], [1, 0, fl ? 0 : 1], [0, 0, fl ? R : s * R]], [-P * cps, W - P * sps, -P * m]).x;
      if (z) y = { NF: z[0], NW: z[1], FF: fl ? z[2] : 0, FW: fl ? 0 : z[2] };
    }
    if (y && !turns) {
      const rough = muF > 0 ? ['B', y.FF, y.NF, muF] : ['A', y.FW, y.NW, muW];
      S.add({ t: 'Equilibrium with the given P (one rough contact)', n: 'With one surface smooth there are three unknowns, N_A, N_B and the friction at the rough contact, so the three equations of equilibrium give them.', r: `N_B = ${fmt(y.NF)} ${F}, N_A = ${fmt(y.NW)} ${F}, F_${rough[0]} = ${fmt(Math.abs(rough[1]))} ${F}` });
      S.add({ t: 'Check the friction', f: `F_${rough[0]} ≤ μs N_${rough[0]}`, s: `${fmt(Math.abs(rough[1]))} ≤ ${fmt(rough[3])}(${fmt(rough[2])}) = ${fmt(rough[3] * rough[2])}`, r: 'The body stays at rest.' });
      out.push({ k: 'N_B (floor)', v: y.NF, u: F, hl: true }, { k: 'F_B (floor)', v: Math.abs(y.FF), u: F }, { k: 'N_A (wall)', v: y.NW, u: F, hl: true }, { k: 'F_A (wall)', v: Math.abs(y.FW), u: F });
      if (!lost) out.push({ k: 'Force P to turn it', v: x.P, u: F });
      return res(`Stays at rest (P to turn it: ${lost ? 'none' : `${fmt(x.P)} ${F}`})`, 'ok', out, S, geo(y, P, 'rest'));
    }
    S.add({ t: 'Compare', f: 'P < P_turn: at rest;  P ≥ P_turn: it turns', s: lost ? `It cannot turn in place: ${lostMsg[lost]}.` : `P = ${fmt(P)} ${F} ${turns ? '≥' : '<'} P_turn = ${fmt(x.P)} ${F}`, r: turns ? `It turns ${sense}.` : 'It stays at rest.' });
    if (!turns && nRough === 2) S.add({ t: 'Reactions', n: 'With both surfaces rough and slipping not about to happen, the four contact forces are statically indeterminate: three equations of equilibrium cannot split the friction between A and B.' });
    if (!lost) out.push({ k: 'Force P to turn it', v: x.P, u: F, hl: true });
    out.push({ k: 'Given P', v: P, u: F });
    if (turns) out.push({ k: 'N_B (floor)', v: x.NF, u: F }, { k: 'N_A (wall)', v: x.NW, u: F });
    return res(turns ? `P = ${fmt(P)} ${F} turns it ${sense}` : `Stays at rest (P to turn it: ${lost ? 'none' : `${fmt(x.P)} ${F}`})`, turns ? 'bad' : 'ok', out, S, geo(turns ? x : { NF: NaN, NW: NaN, FF: NaN, FW: NaN }, P, turns ? 'turns' : 'rest'));
  }

  /* ------------------------------------------------------------------ */
  /* Block brake and pawl                                               */
  /* ------------------------------------------------------------------ */
  /**
   * A shoe on a lever pivoted at O presses on a wheel of radius r that carries a torque M (Probs. 8-22, 8-29).
   * At slipping F = μN and M = F r. Moments about the lever pivot: P a = N b + F e, with a, b and e the
   * moment arms of P, N and F, each positive where that force turns the lever against P. Turning the wheel the
   * other way reverses F, so e changes sign. P ≤ 0 means the lever locks by itself (self-locking, a pawl).
   */
  function brake(q, c) {
    if (q.kind === 'double') return brake2(q, c);
    const { F, FL, Lu } = c, err = [], r = +q.rW, mu = +q.mu, a = +q.a, b = +q.b, e = (+q.e || 0) * (q.rev ? -1 : 1), task = q.task || 'P';
    if (!(r > 0)) err.push('Enter the radius of the wheel.');
    if (!(mu > 0)) err.push('μs must be greater than zero.');
    if (!(a > 0) && task !== 'lock') err.push('Enter the moment arm a of P about the pivot.');
    if (!(Math.abs(b) > 0)) err.push('Enter the moment arm b of the normal force about the pivot.');
    if (task === 'P' && !(+q.M > 0)) err.push('Enter the torque M on the wheel.');
    if (task === 'M' && !(+q.P > 0)) err.push('Enter the force P on the lever.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], k = b + mu * e, lock = k <= 1e-12 * Math.abs(b);
    S.add({ t: 'Free-body diagrams', n: `Wheel: the shoe presses with N and, as the wheel is about to slip, rubs with F = μs N. Lever: moments about the pivot with arms a = ${fmt(a)}, b = ${fmt(b)} and e = ${fmt(e)} ${Lu}${q.rev ? ' (e reversed: the wheel turns the other way)' : ''}.` });
    const geo = (N, M, P) => ({ kind: 'brake', c, task, r, mu, a, b, e, N, Ff: mu * N, M, P, lock, rev: !!q.rev });
    let N, M, P;
    if (task === 'lock') {
      const muL = e < 0 ? b / -e : Infinity;
      S.add({ t: 'Self-locking', n: 'With P = 0 the lever stays pressed on the wheel for any M when the moment of F about the pivot outweighs that of N.', f: 'b + μs e ≤ 0', s: `${fmt(b)} + ${fmt(mu)}(${fmt(e)}) = ${fmt(k)}`, r: lock ? 'Self-locking: it holds the wheel for any torque in this sense.' : 'Not self-locking: a force P is needed.' });
      if (Number.isFinite(muL)) S.add({ t: 'Smallest μs for self-locking', f: 'μs ≥ b / (−e)', r: `μs ≥ ${fmt(muL)}` });
      const ang = Math.atan(mu) / DEG;
      S.add({ t: 'Pawl (two-force member)', n: 'A pawl with no weight is a two-force member, so the contact force acts along the pawl. It binds when that line leans from the normal by no more than the friction angle.', f: 'angle between the pawl and the normal ≤ φs = tan⁻¹ μs', r: `φs = ${fmt(ang)}°` });
      out.push({ k: 'Self-locking', v: lock ? 'yes' : 'no', u: '', hl: true }, { k: 'Smallest μs for self-locking', v: Number.isFinite(muL) ? muL : 'none (e ≥ 0)', u: '' }, { k: 'Friction angle φs (largest pawl angle)', v: ang, u: '°' });
      return res(lock ? 'Self-locking' : 'Not self-locking', lock ? 'ok' : 'warn', out, S, geo(1, NaN, 0));
    }
    if (task === 'P') {
      M = +q.M; N = M / (mu * r);
      S.add({ t: 'Wheel', f: 'ΣM = 0:  M = F r = μs N r', s: `N = ${fmt(M)} / (${fmt(mu)} · ${fmt(r)})`, r: `N = ${fmt(N)} ${F}, F = ${fmt(mu * N)} ${F}` });
      P = (N * k) / a;
      S.add({ t: 'Lever', f: 'P a = N b + F e', s: `P(${fmt(a)}) = ${fmt(N)}(${fmt(b)}) + ${fmt(mu * N)}(${fmt(e)})`, r: lock ? `P = ${fmt(P)} ${F} ≤ 0: the brake locks by itself.` : `P = ${fmt(P)} ${F}` });
      out.push({ k: 'Force on the lever P', v: Math.max(P, 0), u: F, hl: true }, { k: 'Normal force N', v: N, u: F }, { k: 'Friction force F', v: mu * N, u: F });
      if (lock) return res('Self-locking: no force is needed', 'ok', out, S, geo(N, M, 0), ['With these arms the brake is self-locking for this sense of turning; turning the wheel the other way would need a force.']);
      return res(`P = ${fmt(P)} ${F}`, 'ok', out, S, geo(N, M, P));
    }
    P = +q.P;
    if (lock) {
      S.add({ t: 'Self-locking', f: 'b + μs e ≤ 0', s: `${fmt(b)} + ${fmt(mu)}(${fmt(e)}) = ${fmt(k)}`, r: 'Once it touches, the brake holds any torque in this sense.' });
      out.push({ k: 'Torque it resists M', v: 'any', u: '', hl: true });
      return res('Self-locking: it holds any torque', 'ok', out, S, geo(1, NaN, P));
    }
    N = (P * a) / k; M = mu * N * r;
    S.add({ t: 'Lever', f: 'P a = N b + μs N e', s: `N = ${fmt(P)}(${fmt(a)}) / (${fmt(b)} + ${fmt(mu)}(${fmt(e)}))`, r: `N = ${fmt(N)} ${F}` });
    S.add({ t: 'Wheel', f: 'M = μs N r', s: `M = ${fmt(mu)}(${fmt(N)})(${fmt(r)})`, r: `M = ${fmt(M)} ${FL}` });
    out.push({ k: 'Torque it resists M', v: M, u: FL, hl: true }, { k: 'Normal force N', v: N, u: F }, { k: 'Friction force F', v: mu * N, u: F });
    return res(`M = ${fmt(M)} ${FL}`, 'ok', out, S, geo(N, M, P));
  }

  /**
   * Double-block brake (Probs. 8-37, 8-38). Shoe H on lever AD (pinned at A) and shoe I on lever BK (pinned at B) press
   * on opposite sides of a wheel of radius r carrying a torque M. The link KC (horizontal, in tension) joins the top K
   * of BK to arm DC of the bell-crank EDC pinned at the top D of AD; the vertical link EJ joins arm DE to the handle,
   * which turns about a pivot with P at a_P and J at a_J from it. At slipping F = μs N at each shoe. The friction on
   * each shoe acts at its face, a distance t from the lever's line; s = +1 when M is counterclockwise, −1 clockwise.
   *   Wheel      ΣM_O = 0:  μs (N_H + N_I) r = M
   *   Lever BK   ΣM_B = 0:  F_KC h_K = N_I (h_I + s μs t)
   *   Lever AD   ΣM_A = 0:  D_x h_D = N_H (h_H − s μs t)
   *   Crank EDC  ΣF_x = 0:  F_KC = D_x;    ΣM_D = 0:  F_EJ d_DE = F_KC d_DC
   *   Handle     ΣM = 0 about its pivot:  P a_P = F_EJ a_J
   * With t = 0 (the book) friction passes through A and B, so the sense of M does not matter. A lever whose arm
   * h ∓ μs t is not positive presses its shoe on by itself: the brake is self-locking for that sense of turning.
   */
  function brake2(q, c) {
    const { F, FL, Lu } = c, err = [], task = q.task2 === 'M' ? 'M' : 'P';
    const r = +q.r2, mu = +q.mu2, hH = +q.hH, hD = +q.hD, hI = +q.hI, hK = +q.hK, dDC = +q.dDC, dDE = +q.dDE, aP = +q.aP, aJ = +q.aJ, t = +q.t2 || 0, sg = q.rev2 ? -1 : 1;
    if (!(r > 0)) err.push('Enter the radius of the wheel r (above zero).');
    if (!(mu > 0)) err.push('μs must be greater than zero.');
    [['hH', hH, 'height h_H of shoe H above A'], ['hD', hD, 'height h_D of the pin D above A'], ['hI', hI, 'height h_I of shoe I above B'], ['hK', hK, 'height h_K of K above B'],
      ['dDC', dDC, 'arm D–C of the bell-crank'], ['dDE', dDE, 'arm D–E of the bell-crank'], ['aP', aP, 'arm of P from the handle pivot'], ['aJ', aJ, 'arm of J from the handle pivot']]
      .forEach(([, v, what]) => { if (!(v > 0)) err.push(`Enter the ${what} (every length must be above zero).`); });
    if (!(t >= 0)) err.push('The shoe offset t cannot be negative (0 puts the shoe face on the lever line).');
    if (task === 'P' && !(+q.M2 > 0)) err.push('Enter the torque M on the wheel.');
    if (task === 'M' && !(+q.P2 > 0)) err.push('Enter the force P on the handle.');
    if (err.length) return fail(err);
    const yK = hK - hI, yC = hD + dDC - hH; // heights above the wheel centre O
    if (Math.abs(yK - yC) > 1e-6 * Math.max(hK, hD + dDC)) return fail(`The link KC must be horizontal: K is ${fmt(yK)} ${Lu} above the centre of the wheel but C is ${fmt(yC)} ${Lu} (h_D + d_DC − h_H). Make h_K − h_I equal h_D + d_DC − h_H.`);
    const S = Steps(), out = [], kH = hH - sg * mu * t, kI = hI + sg * mu * t, sense = sg > 0 ? 'counterclockwise' : 'clockwise';
    const lock = !(kH > 1e-12 * hH && kI > 1e-12 * hI);
    S.add({ t: 'Free-body diagrams', n: `Wheel: the torque M (${sense}), the normal forces N_H and N_I of the shoes and, as it is about to slip, friction F = μs N at each shoe against the turning. Lever AD: N_H at h_H, the pin force D_x at h_D. Lever BK: N_I at h_I, the link force F_KC at h_K. Bell-crank EDC: F_KC at C, F_EJ at E and the pin D. Handle: P and F_EJ.${t > 0 ? ` Each shoe face is ${fmt(t)} ${Lu} from its lever's line, so friction has a moment about A and B.` : ' The shoe faces are on the lever lines, so friction passes through A and B.'}` });
    const geo = (x) => Object.assign({ kind: 'brake2', c, task, r, mu, hH, hD, hI, hK, dDC, dDE, aP, aJ, t, rev: !!q.rev2, lock }, x);
    if (lock) {
      const which = kH <= 1e-12 * hH ? 'AD (shoe H)' : 'BK (shoe I)';
      S.add({ t: 'Self-locking', n: `On lever ${which} the moment of friction about the pin outweighs that of the normal force, so the shoe stays pressed on the wheel with no force from the link.`, f: 'h_H − s μs t ≤ 0  or  h_I + s μs t ≤ 0', s: `h_H − s μs t = ${fmt(kH)},  h_I + s μs t = ${fmt(kI)}`, r: 'Self-locking for this sense of turning.' });
      if (task === 'P') { out.push({ k: 'Force on the handle P', v: 0, u: F, hl: true }); return res('Self-locking: no force is needed', 'ok', out, S, geo({ M: +q.M2, P: 0 }), ['With these arms the brake is self-locking for this sense of turning; turning the wheel the other way would need a force.']); }
      out.push({ k: 'Torque it resists M', v: 'any', u: '', hl: true });
      return res('Self-locking: it holds any torque', 'ok', out, S, geo({ M: NaN, P: +q.P2 }));
    }
    // unknowns [N_H, N_I, F_KC, D_x, F_EJ, P or M]
    const A = [[mu * r, mu * r, 0, 0, 0, task === 'P' ? 0 : -1], [0, -kI, hK, 0, 0, 0], [-kH, 0, 0, hD, 0, 0], [0, 0, 1, -1, 0, 0], [0, 0, -dDC, 0, dDE, 0], [0, 0, 0, 0, -aJ, task === 'P' ? aP : 0]];
    const b = task === 'P' ? [+q.M2, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, -aP * +q.P2];
    const x = linSolve(A, b).x;
    if (!x) return fail('The equations of the brake have no unique solution for these lengths.');
    const [NH, NI, FKC, , FEJ] = x, P = task === 'P' ? x[5] : +q.P2, M = task === 'P' ? +q.M2 : x[5];
    if (!(P > 0)) { out.push({ k: 'Force on the handle P', v: 0, u: F, hl: true }); return res('Self-locking: no force is needed', 'ok', out, S, geo({ M, P: 0 }), ['With these arms the brake is self-locking for this sense of turning; turning the wheel the other way would need a force.']); }
    const tt = (k) => (t > 0 ? ` ${sg * (k === 'H' ? -1 : 1) > 0 ? '+' : '−'} μs t` : '');
    S.add({ t: 'Wheel', f: 'ΣM_O = 0:  M − μs (N_H + N_I) r = 0', s: `${fmt(M)} − ${fmt(mu)}(N_H + N_I)(${fmt(r)}) = 0`, r: `N_H + N_I = ${fmt(NH + NI)} ${F}` });
    S.add({ t: 'Lever BK', f: `ΣM_B = 0:  F_KC h_K − N_I (h_I${tt('I')}) = 0`, s: `F_KC(${fmt(hK)}) − N_I(${fmt(kI)}) = 0`, r: `F_KC = ${fmt(kI / hK)} N_I` });
    S.add({ t: 'Lever AD', f: `ΣM_A = 0:  N_H (h_H${tt('H')}) − D_x h_D = 0`, s: `N_H(${fmt(kH)}) − D_x(${fmt(hD)}) = 0`, r: `D_x = ${fmt(kH / hD)} N_H` });
    S.add({ t: 'Bell-crank EDC', f: 'ΣF_x = 0:  F_KC − D_x = 0;   ΣM_D = 0:  F_EJ d_DE − F_KC d_DC = 0', s: `${fmt(kI / hK)} N_I = ${fmt(kH / hD)} N_H;   F_EJ(${fmt(dDE)}) = F_KC(${fmt(dDC)})`,
      r: `N_H = ${fmt(NH)} ${F}, N_I = ${fmt(NI)} ${F}, F_KC = D_x = ${fmt(FKC)} ${F}, F_EJ = ${fmt(FEJ)} ${F}` });
    S.add({ t: 'Handle', f: 'ΣM = 0 about its pivot:  P a_P − F_EJ a_J = 0', s: task === 'P' ? `P(${fmt(aP)}) − ${fmt(FEJ)}(${fmt(aJ)}) = 0` : `${fmt(P)}(${fmt(aP)}) − F_EJ(${fmt(aJ)}) = 0`, r: task === 'P' ? `P = ${fmt(P)} ${F}` : `F_EJ = ${fmt(FEJ)} ${F}, so M = μs (N_H + N_I) r = ${fmt(M)} ${FL}` });
    if (task === 'P') out.push({ k: 'Force on the handle P', v: P, u: F, hl: true }); else out.push({ k: 'Torque it resists M', v: M, u: FL, hl: true });
    out.push({ k: 'Normal force at shoe H, N_H', v: NH, u: F }, { k: 'Normal force at shoe I, N_I', v: NI, u: F }, { k: 'Friction at shoe H, μs N_H', v: mu * NH, u: F }, { k: 'Friction at shoe I, μs N_I', v: mu * NI, u: F },
      { k: 'Force in link KC, F_KC', v: FKC, u: F }, { k: 'Force in link EJ, F_EJ', v: FEJ, u: F });
    return res(task === 'P' ? `P = ${fmt(P)} ${F}` : `M = ${fmt(M)} ${FL}`, 'ok', out, S, geo({ M, P, NH, NI, FKC, FEJ }));
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['rW', 'aL', 'dT', 'dS', 'R', 'rP', 'e', 'b', 'H', 'hP', 'L', 's', 'a', 'xW', 'd', 'acc', 'h', 'xP', 'yP', 'R1', 'R2', 'rw', 'aB', 'rs',
    'r2', 'hH', 'hD', 'hI', 'hK', 'dDC', 'dDE', 'aP', 'aJ', 't2']), SML = new Set(['r', 'l']), FOR = new Set(['W', 'P', 'Wp', 'T', 'WA', 'WB', 'P2']), MAS = new Set(['m', 'mp', 'mA', 'mB']), MOM = new Set(['M', 'M2']);


  /* ------------------------------------------------------------------ */
  /* Bearings and rolling resistance (8.6 to 8.8)                       */
  /* ------------------------------------------------------------------ */
  function bearing(q, c) {
    const { F, Lu, FL } = c, err = [], S = Steps(), out = [], kind = q.kind, findMu = q.task === 'mu';
    const mu = +q.mu, M = +q.M;
    if (!findMu && kind !== 'rolling' && !(mu >= 0)) err.push('The coefficient of friction must be zero or more.');
    if (findMu && !(M > 0)) err.push('Enter the moment that turns the shaft.');
    const geo = { kind: 'bearing', c, type: kind };
    if (kind === 'collar' || kind === 'disk') {
      const P = +q.P, R2 = +q.R2, R1 = kind === 'disk' ? 0 : +q.R1;
      if (!(P > 0)) err.push('Enter the axial force P.');
      if (!(R2 > 0) || !(R1 >= 0 && R1 < R2)) err.push(kind === 'disk' ? 'Enter the radius of the bearing surface.' : 'The outer radius must be larger than the inner radius.');
      if (err.length) return fail(err);
      const k = (2 / 3) * (R2 ** 3 - R1 ** 3) / (R2 ** 2 - R1 ** 2), p = P / (Math.PI * (R2 ** 2 - R1 ** 2));
      S.add({ t: 'Pressure on the bearing surface', n: 'The axial force is taken as spread uniformly over the contact area.', f: 'p = P / [π(R₂² − R₁²)]', s: `p = ${fmt(P)} / [π(${fmt(R2)}² − ${fmt(R1)}²)]`, r: `p = ${fmt(p)} ${F}/${Lu}²` });
      S.add({ t: 'Friction moment', n: 'Each ring of area dA = 2πr dr carries a friction force μs p dA at radius r; summing r dF over the surface gives', f: 'M = ⅔ μs P (R₂³ − R₁³)/(R₂² − R₁²)' + (kind === 'disk' ? '  →  M = ⅔ μs P R for a solid disk' : '') });
      if (findMu) {
        const m = M / (P * k);
        S.add({ t: 'Coefficient of friction from the moment', s: `μs = ${fmt(M)} / [${fmt(P)} × ⅔(${fmt(R2)}³ − ${fmt(R1)}³)/(${fmt(R2)}² − ${fmt(R1)}²)]`, r: `μs = ${fmt(m)}` });
        out.push({ k: 'Coefficient of friction μs', v: m, u: '', hl: true }, { k: 'Effective radius ⅔(R₂³ − R₁³)/(R₂² − R₁²)', v: k, u: Lu }, { k: 'Pressure p', v: p, u: `${F}/${Lu}²` });
        return res(`μs = ${fmt(m)}`, 'ok', out, S, Object.assign(geo, { P, R1, R2, M, mu: m }));
      }
      const Mv = mu * P * k;
      S.add({ t: 'Moment to overcome friction', s: `M = ${fmt(mu)}(${fmt(P)}) × ⅔(${fmt(R2)}³ − ${fmt(R1)}³)/(${fmt(R2)}² − ${fmt(R1)}²)`, r: `M = ${fmt(Mv)} ${FL}` });
      out.push({ k: 'Moment to turn M', v: Mv, u: FL, hl: true }, { k: 'Effective radius ⅔(R₂³ − R₁³)/(R₂² − R₁²)', v: k, u: Lu }, { k: 'Pressure p', v: p, u: `${F}/${Lu}²` });
      return res(`M = ${fmt(Mv)} ${FL}`, 'ok', out, S, Object.assign(geo, { P, R1, R2, M: Mv, mu }));
    }
    if (kind === 'journal') {
      const Rl = +q.W, r = +q.rs;
      if (!(Rl > 0)) err.push('Enter the load on the bearing.');
      if (!(r > 0)) err.push('Enter the radius of the shaft.');
      if (err.length) return fail(err);
      S.add({ t: 'Free-body diagram', n: 'As the shaft turns it climbs the bearing until the resultant R of the normal and friction forces at the contact leans at the angle of kinetic friction φk from the normal; R is tangent to the friction circle of radius r_f = r sin φk.' });
      if (findMu) {
        const sf = M / (Rl * r);
        if (!(sf < 1)) return fail('The moment is too large for this load and radius: M must be less than R r.');
        const ph = Math.asin(sf) / DEG, m = Math.tan(ph * DEG);
        S.add({ t: 'Moment about the shaft centre', f: 'M = R r_f', n: 'The bearing reaction R balances the load and is offset by the friction-circle radius r_f, so it supplies the moment M.' });
        S.add({ t: 'Angle of friction from the moment', f: 'M = R r sin φk', s: `sin φk = ${fmt(M)} / (${fmt(Rl)} × ${fmt(r)})`, r: `φk = ${fmt(ph)}°, μk = tan φk = ${fmt(m)}` });
        out.push({ k: 'Coefficient of kinetic friction μk', v: m, u: '', hl: true }, { k: 'Angle of kinetic friction φk', v: ph, u: '°' }, { k: 'Friction circle radius r_f', v: r * sf, u: Lu });
        return res(`μk = ${fmt(m)}`, 'ok', out, S, Object.assign(geo, { R: Rl, r, ph, M }));
      }
      const ph = Math.atan(mu) / DEG, Mv = Rl * r * Math.sin(ph * DEG);
      S.add({ t: 'Angle of kinetic friction and the friction circle', f: 'φk = tan⁻¹ μk;  r_f = r sin φk', s: `φk = tan⁻¹ ${fmt(mu)};  r_f = ${fmt(r)} sin φk`, r: `φk = ${fmt(ph)}°, r_f = ${fmt(r * Math.sin(ph * DEG))} ${Lu}` });
      S.add({ t: 'Moment to keep the shaft turning', f: 'M = R r_f = R r sin φk ≈ μk R r', s: `M = ${fmt(Rl)}(${fmt(r)}) sin ${fmt(ph)}°`, r: `M = ${fmt(Mv)} ${FL}` });
      out.push({ k: 'Moment to turn M', v: Mv, u: FL, hl: true }, { k: 'Approximation μk R r', v: mu * Rl * r, u: FL }, { k: 'Angle of kinetic friction φk', v: ph, u: '°' }, { k: 'Friction circle radius r_f', v: r * Math.sin(ph * DEG), u: Lu });
      return res(`M = ${fmt(Mv)} ${FL}`, 'ok', out, S, Object.assign(geo, { R: Rl, r, ph, M: Mv }));
    }
    // rolling resistance: a wheel or roller of radius r carrying W, coefficient a (and aB at a second surface on top)
    const W = +q.W, r = +q.rw, a = +q.a, aB = +q.aB || 0;
    if (!(W > 0)) err.push('Enter the load W.');
    if (!(r > 0)) err.push('Enter the radius of the wheel.');
    if (!(a >= 0) || !(aB >= 0)) err.push('The coefficients of rolling resistance must be zero or more.');
    if (err.length) return fail(err);
    S.add({ t: 'Free-body diagram', n: `The ground deforms under the wheel, so its resultant reaction acts a distance a ahead of the lowest point${aB ? ' and the load on top acts a distance a_B behind the highest point' : ''}. For small a the moments about the contact give`, f: aB ? 'P ≈ W (a + a_B) / (2r)  (roller between the load and the ground, P on the load)' : 'P ≈ W a / r' });
    S.add({ t: 'Moments about the point where R acts', f: aB ? 'P(2r) ≈ W(a + a_B)' : 'P r ≈ W a', n: 'R passes through the centre of the wheel; for small a the moment arm of P about the point where R meets the ground is about r.' });
    const P = aB ? (W * (a + aB)) / (2 * r) : (W * a) / r;
    S.add({ t: 'Force to overcome rolling resistance', s: aB ? `P = ${fmt(W)}(${fmt(a)} + ${fmt(aB)}) / (2 × ${fmt(r)})` : `P = ${fmt(W)}(${fmt(a)}) / ${fmt(r)}`, r: `P = ${fmt(P)} ${F}` });
    out.push({ k: 'Force to roll P', v: P, u: F, hl: true }, { k: 'Rolling resistance ratio P/W', v: P / W, u: '' });
    return res(`P = ${fmt(P)} ${F}`, 'ok', out, S, Object.assign(geo, { W, r, a, aB, P }));
  }

  /* ------------------------------------------------------------------ */
  /* Vehicle on two axles                                               */
  /* ------------------------------------------------------------------ */
  /* Axes along the road: x from axle A (x = 0) toward axle B (x = L), y normal to the road.
   * Forces on the vehicle: W at G (a, h), N_A, N_B normal, F_A, F_B along the road (+x), and P at
   * (xP, yP) at the angle ψ measured counterclockwise from +x. Moments are taken about the contact at A. */
  const AXN = { free: 'free to roll', locked: 'braked (locked)', driven: 'driven' };
  function vehicle(q, c) {
    const { F, Lu, U } = c, err = [];
    const w = weight(q, U, F), W = w.W, a = +q.a, b = +q.b, h = +q.h, mu = +q.mu, L = a + b;
    const task = q.task, useP = task === 'force' || (task === 'park' && q.hasP);
    if (!(W > 0)) err.push('The weight must be greater than zero.');
    if (!(a > 0) || !(b > 0)) err.push('G must lie between the axles: enter both distances from G to the axles.');
    if (!(h >= 0)) err.push('The height of G must be zero or more.');
    if (!(mu >= 0)) err.push('The coefficient of static friction must be zero or more.');
    if (task !== 'slope' && !(+q.phi >= 0 && +q.phi < 90)) err.push('The slope angle must be from 0° to less than 90°.');
    if (task === 'park' && q.hasP && !isFinite(+q.P)) err.push('Enter the force P.');
    if (task === 'force' && q.axA === 'free' && q.axB === 'free') err.push('With both axles rolling freely nothing resists the motion: brake or drive at least one axle.');
    if (task === 'slope' && q.axA === 'free' && q.axB === 'free') err.push('With both axles rolling freely the vehicle rolls on any slope: brake at least one axle.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [];
    const sg = q.rise === 'B' ? -1 : 1; // the x component of W is −W sin φ when the road rises toward B
    const pd = useP ? [Math.cos(+q.psi * DEG), Math.sin(+q.psi * DEG)] : [0, 0], xP = +q.xP || 0, yP = +q.yP || 0;
    const mP = useP ? xP * pd[1] - yP * pd[0] : 0; // moment about A per unit P
    const braked = ['A', 'B'].filter((k) => q['ax' + k] !== 'free');
    const both = braked.length === 2;
    const ax = (phi) => { const sp = Math.sin(phi * DEG), cp = Math.cos(phi * DEG); return { gx: sg * W * sp, gy: -W * cp, sp, cp }; };
    /** N_A and N_B for a slope φ and a force P. */
    const normals = (phi, P) => { const g = ax(phi), NB = -(a * g.gy - h * g.gx + P * mP) / L, NA = -g.gy - P * pd[1] - NB; return { NA, NB, g }; };
    const rd = q.rise === 'A' ? 'A' : 'B';
    const fbd = `Axes: x along the road from A toward B, y normal to it. The wheels at A are ${AXN[q.axA]} and at B ${AXN[q.axB]}; a freely rolling axle has no friction force. G is ${fmt(a)} ${Lu} from A, ${fmt(b)} ${Lu} from B (L = ${fmt(L)} ${Lu}) and ${fmt(h)} ${Lu} above the road${task === 'slope' ? `; the road rises toward ${rd}` : +q.phi > 0 ? `; the road rises toward ${rd} at ${fmt(+q.phi)}°` : ' on a level road'}.${useP ? ` P acts at ${fmt(xP)} ${Lu} along the road from A, ${fmt(yP)} ${Lu} above it, at ${fmt(+q.psi)}° counterclockwise from the direction A → B.` : ''}`;
    S.add({ t: 'Free-body diagram', n: fbd, r: w.how });
    const Wx = (phi) => (phi > 0 ? `${sg > 0 ? '+' : '−'} ${fmt(W)} sin ${fmt(phi)}°` : '');
    const geoBase = { kind: 'vehicle', c, W, a, b, h, L, mu, axA: q.axA, axB: q.axB, front: q.front, rise: q.rise, xP, yP, psi: +q.psi, useP, task };

    if (task === 'slope') {
      // largest φ: slip (needed friction > μ ΣN of the braked axles) or tip (an axle unloads)
      const need = (phi) => { const r = normals(phi, 0), Nb = braked.reduce((s, k) => s + r['N' + k], 0); return { r, slip: Math.abs(r.g.gx) - mu * Nb, NA: r.NA, NB: r.NB }; };
      const lim = (fn) => { if (fn(0.0001) >= 0) return 0; if (fn(89.99) < 0) return Infinity; return bisect(fn, 0.0001, 89.99, 200); };
      const phS = lim((p) => need(p).slip), phTA = lim((p) => -need(p).NA), phTB = lim((p) => -need(p).NB), phT = Math.min(phTA, phTB);
      const k = braked.length === 1 ? braked[0] : null, up = sg > 0 ? 'B' : 'A';
      S.add({ t: 'At the slope where slipping is about to happen', f: both ? 'F_A + F_B = μs (N_A + N_B)' : `F_${k} = μs N_${k}`,
        n: `The friction at the ${both ? 'braked axles' : `braked axle ${k}`} holds the whole down-slope component of the weight.`,
        s: `${fmt(W)} sin φ = ${fmt(mu)}(${both ? `${fmt(W)} cos φ` : `N_${k}(φ)`})${both ? '' : `, with N_${k} from ↺+ ΣM about the other axle`}`, r: isFinite(phS) ? `φ = ${fmt(phS)}°` : 'It never slips before 90°' });
      S.add({ t: 'At the slope where tipping is about to happen', f: 'N = 0 at the uphill axle', n: 'The vehicle is about to tip about the downhill axle, so the resultant of the weight passes through it.',
        s: `tan φ = (distance from G to the downhill axle) / h = ${fmt(sg > 0 ? a : b)} / ${fmt(h)}`, r: isFinite(phT) ? `φ = ${fmt(phT)}°` : 'It cannot tip' });
      const gov = Math.min(phS, phT); if (!isFinite(gov)) return fail('The vehicle neither slips nor tips at any slope below 90°.');
      const tips = phT < phS, r = normals(gov, 0), Ft = -r.g.gx;
      S.add({ t: 'Governing case', n: 'The smaller angle is reached first.', r: `${tips ? 'Tipping' : 'Slipping'} governs: φ_max = ${fmt(gov)}°` });
      out.push({ k: 'Steepest slope φ_max', v: gov, u: '°', hl: true }, { k: 'Slope at which it slips', v: isFinite(phS) ? phS : 90, u: isFinite(phS) ? '°' : '° (never)' }, { k: 'Slope at which it tips', v: isFinite(phT) ? phT : 90, u: isFinite(phT) ? '°' : '° (never)' },
        { k: 'Normal force at A, N_A', v: r.NA, u: F }, { k: 'Normal force at B, N_B', v: r.NB, u: F });
      const split = both ? [Ft * r.NA / (r.NA + r.NB), Ft * r.NB / (r.NA + r.NB)] : k === 'A' ? [Ft, 0] : [0, Ft];
      return res(`${tips ? 'Tips' : 'Slips'} first at φ = ${fmt(gov)}°`, 'ok', out, S, Object.assign(geoBase, { phi: gov, NA: r.NA, NB: r.NB, FA: split[0], FB: split[1], P: 0, verdict: tips ? 'tip' : 'slip' }), warn);
    }

    const phi = +q.phi;
    if (task === 'park') {
      const P = useP ? +q.P : 0, r = normals(phi, P), g = r.g, Ft = -(g.gx + P * pd[0]);
      S.add({ t: 'Moments about A', f: '↺+ ΣM_A = 0', n: 'The friction forces act along the road through A and B, so they have no moment about A.',
        s: `N_B(${fmt(L)}) − ${fmt(W)} cos ${fmt(phi)}°(${fmt(a)})${phi > 0 ? ` ${sg > 0 ? '−' : '+'} ${fmt(W)} sin ${fmt(phi)}°(${fmt(h)})` : ''}${useP ? ` + P(${fmt(xP)} sin ${fmt(+q.psi)}° − ${fmt(yP)} cos ${fmt(+q.psi)}°)` : ''} = 0`, r: `N_B = ${fmt(r.NB)} ${F}` });
      S.add({ t: 'Sum of forces normal to the road', f: '+↑ ΣF_y = 0', s: `N_A + ${fmt(r.NB)} − ${fmt(W)} cos ${fmt(phi)}°${useP ? ` + ${fmt(P)} sin ${fmt(+q.psi)}°` : ''} = 0`, r: `N_A = ${fmt(r.NA)} ${F}` });
      S.add({ t: 'Sum of forces along the road', f: '→+ ΣF_x = 0', s: `F_A + F_B ${Wx(phi)}${useP ? ` + ${fmt(P)} cos ${fmt(+q.psi)}°` : ''} = 0`, r: `F_A + F_B = ${fmt(Ft)} ${F} (toward ${Ft >= 0 ? 'B' : 'A'})` });
      if (r.NA < -1e-9 * W || r.NB < -1e-9 * W) {
        const k = r.NA < 0 ? 'A' : 'B';
        out.push({ k: 'Normal force at A, N_A', v: r.NA, u: F, hl: true }, { k: 'Normal force at B, N_B', v: r.NB, u: F, hl: true });
        S.add({ t: 'Check tipping', f: 'N ≥ 0 at both axles', r: `N_${k} would have to pull on the road: the vehicle tips about axle ${k === 'A' ? 'B' : 'A'}` });
        return res('Not in equilibrium: the vehicle tips', 'warn', out, S, Object.assign(geoBase, { phi, NA: r.NA, NB: r.NB, FA: 0, FB: 0, P, verdict: 'tip' }), warn);
      }
      if (Math.abs(Ft) > 1e-9 * W && !braked.length) {
        out.push({ k: 'Normal force at A, N_A', v: r.NA, u: F, hl: true }, { k: 'Normal force at B, N_B', v: r.NB, u: F, hl: true }, { k: 'Friction needed F_A + F_B', v: Ft, u: F });
        S.add({ t: 'Check slipping', r: 'Both axles roll freely, so no friction can act: the vehicle rolls.' });
        return res('Not in equilibrium: it rolls (no axle is braked)', 'warn', out, S, Object.assign(geoBase, { phi, NA: r.NA, NB: r.NB, FA: 0, FB: 0, P, verdict: 'roll' }), warn);
      }
      let FA, FB, Nb;
      if (both) { Nb = r.NA + r.NB; FA = Ft * r.NA / Nb; FB = Ft * r.NB / Nb; S.add({ t: 'Friction at the two braked axles', n: 'With both axles braked the split of the friction between them is statically indeterminate; only the total is fixed by equilibrium. It is shown here split in proportion to the normal forces (the same friction ratio at both axles).', s: `F_A = ${fmt(Ft)} × ${fmt(r.NA)} / ${fmt(Nb)};  F_B = ${fmt(Ft)} × ${fmt(r.NB)} / ${fmt(Nb)}`, r: `F_A = ${fmt(FA)} ${F}, F_B = ${fmt(FB)} ${F}` }); }
      else { const k = braked[0] || 'A'; Nb = r['N' + k]; FA = k === 'A' ? Ft : 0; FB = k === 'B' ? Ft : 0; S.add({ t: `Friction at the ${q['ax' + k] === 'driven' ? 'driven' : 'braked'} axle ${k}`, n: `The other axle rolls freely, so all of the friction acts at ${k}.`, r: `F_${k} = ${fmt(Ft)} ${F}` }); }
      const need = Nb > 0 ? Math.abs(Ft) / Nb : Infinity, slips = need > mu * (1 + 1e-9);
      S.add({ t: 'Check slipping', f: both ? '|F_A + F_B| ≤ μs (N_A + N_B)' : `|F| ≤ μs N`, s: `μs needed = ${fmt(Math.abs(Ft))} / ${fmt(Nb)} = ${fmt(need)}`, r: `${fmt(need)} ${slips ? '>' : '≤'} μs = ${fmt(mu)}: ${slips ? 'the wheels slip' : 'no slipping'}` });
      out.push({ k: 'Normal force at A, N_A', v: r.NA, u: F, hl: true }, { k: 'Normal force at B, N_B', v: r.NB, u: F, hl: true }, { k: 'Friction at A, F_A', v: FA, u: F, hl: !!FA }, { k: 'Friction at B, F_B', v: FB, u: F, hl: !!FB },
        { k: 'Friction needed F_A + F_B', v: Ft, u: F }, { k: 'μs needed to hold it', v: need, u: '' }, { k: 'Largest friction μs N', v: mu * Nb, u: F });
      if (both) warn.push('Both axles are braked, so only the total friction is fixed by equilibrium; F_A and F_B are shown split in proportion to N_A and N_B.');
      return res(slips ? 'Not in equilibrium: the wheels slip' : 'In equilibrium: no slipping or tipping', slips ? 'warn' : 'ok', out, S, Object.assign(geoBase, { phi, NA: r.NA, NB: r.NB, FA, FB, P, verdict: slips ? 'slip' : 'none' }), warn);
    }

    // task 'force': P that starts the motion toward A or B. Braked axles resist with μs N, driven axles push with μs N.
    const m = q.move === 'B' ? 1 : -1, g0 = ax(phi);
    const fr = (k) => (q['ax' + k] === 'locked' ? -m : q['ax' + k] === 'driven' ? m : 0); // friction direction × μ N
    // ΣFx: μ Σ fr_k N_k(P) + gx + P cos ψ = 0 with N linear in P
    const N0 = normals(phi, 0), N1 = normals(phi, 1), dNA = N1.NA - N0.NA, dNB = N1.NB - N0.NB;
    const c0 = g0.gx + mu * (fr('A') * N0.NA + fr('B') * N0.NB), c1 = pd[0] + mu * (fr('A') * dNA + fr('B') * dNB);
    if (Math.abs(c1) < 1e-12) return fail('P at this angle cannot start the motion: change its direction.');
    const P = -c0 / c1, r = normals(phi, P);
    if (!(P > 0)) return fail(`No pull P > 0 at ${fmt(+q.psi)}° moves the vehicle toward ${q.move} with these wheels: ${P <= 0 && Math.abs(P) < 1e-9 * W ? 'it is on the point of moving by itself' : 'it would move that way by itself, or P points the wrong way'}. Check the direction of P and of the motion.`);
    const FA = mu * fr('A') * r.NA, FB = mu * fr('B') * r.NB;
    const fe = (k) => (fr(k) ? `${fr(k) > 0 ? '+' : '−'} ${fmt(mu)} N_${k}` : '');
    S.add({ t: 'Friction when the motion is about to start', f: 'F = μs N at each braked or driven axle', n: `The vehicle is about to move toward ${q.move}. ${['A', 'B'].map((k) => q['ax' + k] === 'locked' ? `The locked wheels at ${k} slide, so friction μs N_${k} opposes the motion.` : q['ax' + k] === 'driven' ? `The driven wheels at ${k} are about to spin, so friction μs N_${k} acts in the direction of travel.` : `The wheels at ${k} roll freely: F_${k} = 0.`).join(' ')}` });
    S.add({ t: 'Equations of equilibrium', f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0;  ↺+ ΣM_A = 0',
      s: `P cos ${fmt(+q.psi)}° ${fe('A')} ${fe('B')} ${Wx(phi)} = 0;   N_A + N_B + P sin ${fmt(+q.psi)}° − ${fmt(W)} cos ${fmt(phi)}° = 0;   N_B(${fmt(L)}) + P(${fmt(xP)} sin ${fmt(+q.psi)}° − ${fmt(yP)} cos ${fmt(+q.psi)}°) − ${fmt(W)} cos ${fmt(phi)}°(${fmt(a)})${phi > 0 ? ` ${sg > 0 ? '−' : '+'} ${fmt(W)} sin ${fmt(phi)}°(${fmt(h)})` : ''} = 0`,
      r: `P = ${fmt(P)} ${F}, N_A = ${fmt(r.NA)} ${F}, N_B = ${fmt(r.NB)} ${F}` });
    out.push({ k: 'Force P', v: P, u: F, hl: true }, { k: 'Normal force at A, N_A', v: r.NA, u: F, hl: true }, { k: 'Normal force at B, N_B', v: r.NB, u: F, hl: true }, { k: 'Friction at A, F_A', v: FA, u: F }, { k: 'Friction at B, F_B', v: FB, u: F });
    let text = `Moves at P = ${fmt(P)} ${F}`, cls = 'ok', verdict = 'slip';
    if (r.NA < -1e-9 * W || r.NB < -1e-9 * W) {
      // an axle lifts first: find the P at which it unloads
      const k = r.NA < 0 ? 'A' : 'B', d = k === 'A' ? dNA : dNB, n0 = k === 'A' ? N0.NA : N0.NB, Pt = d < 0 ? -n0 / d : NaN;
      S.add({ t: 'Check tipping', f: 'N ≥ 0 at both axles', s: `N_${k} = 0 when P = ${fmt(Pt)} ${F}`, r: `The wheels at ${k} lift off at P = ${fmt(Pt)} ${F}, before the wheels slip` });
      out.push({ k: `P at which axle ${k} lifts off`, v: Pt, u: F, hl: true });
      warn.push(`Axle ${k} lifts off the road before the wheels slip, so the slipping solution is not reached; the vehicle tips at P = ${fmt(Pt)} ${F}.`);
      text = `Axle ${k} lifts off first, at P = ${fmt(Pt)} ${F}`; cls = 'warn'; verdict = 'tip';
    } else S.add({ t: 'Check tipping', f: 'N ≥ 0 at both axles', r: 'Both normal forces are positive: the wheels slip before the vehicle tips' });
    return res(text, cls, out, S, Object.assign(geoBase, { phi, NA: r.NA, NB: r.NB, FA, FB, P, move: q.move, verdict }), warn);
  }


  /* ------------------------------------------------------------------ */
  /* Two bodies: joined blocks on an incline, stacked blocks, person and crate */
  /* ------------------------------------------------------------------ */
  function two(q, c) {
    const { F, Lu, U } = c, err = [];
    const wa = weight(q, U, F, 'mA', 'WA'), wb = weight(q, U, F, 'mB', 'WB'), WA = wa.W, WB = wb.W, muA = +q.muA, muB = +q.muB;
    const nA = q.arr === 'push' ? 'crate' : 'A', nB = q.arr === 'push' ? 'person' : 'B';
    if (!(WA > 0) || !(WB > 0)) err.push('Both weights must be greater than zero.');
    if (!(muA >= 0) || !(muB >= 0)) err.push('The coefficients of static friction must be zero or more.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], geo = { kind: 'two', arr: q.arr, c, WA, WB, muA, muB };
    S.add({ t: 'Weights', r: `${q.arr === 'push' ? 'Crate' : 'Block A'}: ${wa.how.replace('W =', 'W_' + nA + ' =')};   ${q.arr === 'push' ? 'Person' : 'Block B'}: ${wb.how.replace('W =', 'W_' + nB + ' =')}` });

    if (q.arr === 'inc') {
      const low = q.lower === 'B' ? 'B' : 'A', up = low === 'A' ? 'B' : 'A', W = { A: WA, B: WB }, mu = { A: muA, B: muB }, k = +q.k, spring = q.conn === 'spring';
      if (spring && !(k > 0)) return fail('Enter the spring stiffness k greater than zero.');
      S.add({ t: 'Free-body diagrams', f: 'ΣF_x′ = 0 (along the slope);  ΣF_y′ = 0 (normal)', n: `Block ${low} sits lower on the slope and block ${up} higher, joined by a ${spring ? 'spring' : 'cord'}. For each block N = W cos θ, and along the slope W sin θ is held by friction and the ${spring ? 'spring' : 'cord'} force F_s (taken as tension, pulling the blocks toward each other).`,
        s: `Block ${low}: F_s + F_${low} − W_${low} sin θ = 0;   Block ${up}: F_${up} − F_s − W_${up} sin θ = 0` });
      // first slip with the connector carrying no force
      const first = mu.A <= mu.B ? 'A' : 'B', th1 = Math.atan(mu[first]) / DEG;
      const sumW = WA + WB, thB = Math.atan((muA * WA + muB * WB) / sumW) / DEG;
      const at = (th) => { const sn = Math.sin(th * DEG), cs = Math.cos(th * DEG); return { sn, cs, NA: WA * cs, NB: WB * cs }; };
      let th, Fs, FA, FB, text, task = q.task;
      if (task === 'first' && !spring && mu[low] < mu[up]) {
        S.add({ t: 'Which block slips first', n: `The lower block ${low} has the smaller μs, so it starts to slide first; the cord then tightens and block ${up} holds it back. The two can only move together, so the first motion is the motion of both blocks.` });
        task = 'both';
      }
      if (task === 'first') {
        const t = at(th1); th = th1; Fs = 0; FA = WA * t.sn; FB = WB * t.sn;
        S.add({ t: 'First block to slip', f: 'tan θ = μs', n: `${spring ? 'The spring is unstretched, so it carries no force until a block moves.' : `The upper block ${up} has the smaller μs; when it slides the cord goes slack, so it moves on its own.`} Each block then holds itself by friction alone, F = W sin θ ≤ μs W cos θ, which first fails for the block with the smaller μs, block ${first}.`,
          s: `θ = tan⁻¹(${fmt(mu[first])}) = ${fmt(th1)}°`, r: `θ = ${fmt(th1)}°: block ${first} slips` });
        S.add({ t: 'Friction under each block', f: 'F = W sin θ;  N = W cos θ', s: `F_A = ${fmt(WA)} sin ${fmt(th)}° = ${fmt(FA)} ${F};   F_B = ${fmt(WB)} sin ${fmt(th)}° = ${fmt(FB)} ${F}`,
          r: `Check: block ${first === 'A' ? 'B' : 'A'} needs F = ${fmt(first === 'A' ? FB : FA)} ${F} ≤ μs N = ${fmt((first === 'A' ? muB * WB : muA * WA) * Math.cos(th * DEG))} ${F}, so it does not slip` });
        text = `Block ${first} slips first at θ = ${fmt(th)}°`;
      } else {
        const t = at(thB); th = thB; FA = muA * t.NA; FB = muB * t.NB;
        Fs = W[low] * t.sn - mu[low] * W[low] * t.cs;
        S.add({ t: 'Both blocks slip together', f: 'ΣW sin θ = Σ μs W cos θ  →  tan θ = (μ_A W_A + μ_B W_B)/(W_A + W_B)', n: 'Adding the equations along the slope removes the connector force; both friction forces are at their limits F = μs N.',
          s: `tan θ = (${fmt(muA)}(${fmt(WA)}) + ${fmt(muB)}(${fmt(WB)}))/${fmt(sumW)} = ${fmt(Math.tan(thB * DEG))}`, r: `θ = ${fmt(thB)}°` });
        S.add({ t: `Connector force (block ${low})`, f: `F_s = W_${low}(sin θ − μ_${low} cos θ)`, s: `F_s = ${fmt(W[low])}(sin ${fmt(th)}° − ${fmt(mu[low])} cos ${fmt(th)}°) = ${fmt(Fs)} ${F}`,
          r: Fs >= 0 ? `F_s = ${fmt(Fs)} ${F} (tension)` : `F_s = ${fmt(-Fs)} ${F} (compression)` });
        if (spring) {
          const x = Fs / k;
          S.add({ t: 'Spring stretch', f: 'F_s = k x', s: `x = ${fmt(Math.abs(Fs))}/${fmt(k)} = ${fmt(Math.abs(x))} ${Lu}`, r: `${Fs >= 0 ? 'Stretch' : 'Compression'} ${fmt(Math.abs(x))} ${Lu}` });
          out.push({ k: Fs >= 0 ? 'Spring stretch needed' : 'Spring compression needed', v: Math.abs(x), u: Lu, hl: true });
        } else if (Fs < 0) warn.push(`The cord would have to push (F_s = ${fmt(Fs)} ${F}); a cord goes slack, so the blocks would not slide together. Block ${up} slips first, on its own, at θ = ${fmt(Math.atan(mu[up]) / DEG)}°.`);
        text = `Both slip at θ = ${fmt(th)}°`;
      }
      const t = at(th);
      out.unshift({ k: 'Angle θ', v: th, u: '°', hl: true });
      out.push({ k: 'N_A', v: t.NA, u: F }, { k: 'N_B', v: t.NB, u: F }, { k: 'Friction under A, F_A', v: FA, u: F, hl: true }, { k: 'Friction under B, F_B', v: FB, u: F, hl: true }, { k: spring ? 'Spring force F_s (+ tension)' : 'Cord tension', v: Fs, u: F });
      return res(text, warn.length ? 'warn' : 'ok', out, S, Object.assign(geo, { phi: th, low, Fs, FA, FB, NA: t.NA, NB: t.NB, conn: q.conn, task }), warn);
    }

    if (q.arr === 'stack') {
      const muG = +q.muG, al = +q.al, ca = Math.cos(al * DEG), sa = Math.sin(al * DEG), tie = !!q.tie, be = +q.beta, cb = Math.cos(be * DEG), sb = Math.sin(be * DEG);
      if (!(muG >= 0)) return fail('The coefficient of friction at the floor must be zero or more.');
      if (tie && q.Pon === 'A') return fail('Block A is tied to the wall, so P must pull block B.');
      S.add({ t: 'Free-body diagrams', n: `Block A rests on block B, which rests on the floor. μs between A and B is ${fmt(muA)}; between B and the floor ${fmt(muG)}. P pulls block ${q.Pon} at ${fmt(al)}° above the horizontal.${tie ? ` Block A is held by a cord to the wall at ${fmt(be)}° above the horizontal.` : ''}` });
      let P, N1, N2, F1, F2, T = 0, mech;
      if (tie) {
        T = (muA * WA) / (cb + muA * sb); N1 = WA - T * sb; F1 = muA * N1;
        S.add({ t: 'Block A (held by the cord)', f: '→ ΣF_x: −T cos β + μ_A N₁ = 0;  ↑ ΣF_y: N₁ + T sin β − W_A = 0', n: 'B slides out from under A, so friction on A acts toward the motion of B and is at its limit.',
          s: `T = μ_A W_A/(cos β + μ_A sin β) = ${fmt(muA)}(${fmt(WA)})/(${fmt(cb)} + ${fmt(muA)}(${fmt(sb)}))`, r: `T = ${fmt(T)} ${F};  N₁ = ${fmt(N1)} ${F};  F₁ = ${fmt(F1)} ${F}` });
        P = (F1 + muG * (N1 + WB)) / (ca + muG * sa); N2 = N1 + WB - P * sa; F2 = muG * N2; mech = 'B slides out from under A';
        S.add({ t: 'Block B', f: '→ ΣF_x: P cos α − F₁ − μ_G N₂ = 0;  ↑ ΣF_y: N₂ − N₁ − W_B + P sin α = 0', s: `P = (F₁ + μ_G(N₁ + W_B))/(cos α + μ_G sin α) = (${fmt(F1)} + ${fmt(muG)}(${fmt(N1 + WB)}))/(${fmt(ca)} + ${fmt(muG)}(${fmt(sa)}))`, r: `P = ${fmt(P)} ${F};  N₂ = ${fmt(N2)} ${F}` });
      } else if (q.Pon === 'A') {
        const P1 = (muA * WA) / (ca + muA * sa), P2 = (muG * (WA + WB)) / (ca + muG * sa);
        S.add({ t: 'Case 1: A slides on B, B stays', f: 'P(cos α + μ_A sin α) = μ_A W_A', s: `P = ${fmt(muA)}(${fmt(WA)})/(${fmt(ca)} + ${fmt(muA)}(${fmt(sa)}))`, r: `P = ${fmt(P1)} ${F}` });
        S.add({ t: 'Case 2: A and B slide together on the floor', f: 'P(cos α + μ_G sin α) = μ_G (W_A + W_B)', s: `P = ${fmt(muG)}(${fmt(WA + WB)})/(${fmt(ca)} + ${fmt(muG)}(${fmt(sa)}))`, r: `P = ${fmt(P2)} ${F}` });
        if (P1 <= P2) { P = P1; mech = 'A slides on B'; N1 = WA - P * sa; F1 = muA * N1; N2 = WA + WB - P * sa; F2 = F1; }
        else { P = P2; mech = 'A and B slide together'; N1 = WA - P * sa; F1 = P * ca; N2 = WA + WB - P * sa; F2 = muG * N2; }
        S.add({ t: 'Smallest P', n: 'Motion starts in whichever way needs the smaller force.', r: `P = ${fmt(P)} ${F}: ${mech}` });
      } else {
        P = (muG * (WA + WB)) / (ca + muG * sa); N1 = WA; F1 = 0; N2 = WA + WB - P * sa; F2 = muG * N2; mech = 'A and B slide together';
        S.add({ t: 'A and B together', f: 'P(cos α + μ_G sin α) = μ_G (W_A + W_B)', n: 'With nothing holding A, it moves with B: no force acts along the surface between them while they start to move together.', s: `P = ${fmt(muG)}(${fmt(WA + WB)})/(${fmt(ca)} + ${fmt(muG)}(${fmt(sa)}))`, r: `P = ${fmt(P)} ${F}` });
      }
      if (N1 < 0 || N2 < 0) warn.push('A normal force comes out negative: P lifts a block off its support at this angle.');
      out.push({ k: 'Force P to start motion', v: P, u: F, hl: true }, { k: 'Normal force between A and B, N₁', v: N1, u: F }, { k: 'Normal force at the floor, N₂', v: N2, u: F }, { k: 'Friction between A and B', v: F1, u: F }, { k: 'Friction at the floor', v: F2, u: F });
      if (tie) out.push({ k: 'Cord tension T', v: T, u: F, hl: true });
      return res(`P = ${fmt(P)} ${F}: ${mech}`, warn.length ? 'warn' : 'ok', out, S, Object.assign(geo, { P, N1, N2, F1, F2, T, tie, Pon: q.Pon, al, beta: be, mech, muG }), warn);
    }

    /* person and crate */
    const rope = q.how === 'rope', thC = rope ? +q.thC : 0, thM = rope ? +q.thM : 0, cc = Math.cos(thC * DEG), scn = Math.sin(thC * DEG), cm = Math.cos(thM * DEG), sm = Math.sin(thM * DEG);
    let Tslide = (muA * WA) / (cc + muA * scn), Tneed = Tslide, how = 'slide';
    S.add({ t: 'Crate: force to start it sliding', f: `→ ΣF_x: T cos θ_c − μ_c N_c = 0;  ↑ ΣF_y: N_c + T sin θ_c − W_c = 0`, n: rope ? `The rope pulls the crate at θ_c = ${fmt(thC)}° above the horizontal.` : 'The person pushes horizontally on the crate.',
      s: `T = μ_c W_c/(cos θ_c + μ_c sin θ_c) = ${fmt(muA)}(${fmt(WA)})/(${fmt(cc)} + ${fmt(muA)}(${fmt(scn)}))`, r: `${rope ? 'T' : 'P'} = ${fmt(Tslide)} ${F};  N_c = ${fmt(WA - Tslide * scn)} ${F}` });
    if (!rope && q.tip) {
      const b = +q.b, h = +q.h;
      if (!(b > 0) || !(h > 0)) return fail('Enter the crate width and the height of the push.');
      const Ptip = (WA * b / 2) / h;
      S.add({ t: 'Crate: force to tip it', f: 'P h = W_c (b/2)', s: `P = ${fmt(WA)}(${fmt(b / 2)})/${fmt(h)}`, r: `P = ${fmt(Ptip)} ${F} ${Ptip < Tslide ? '< the force to slide: the crate tips first' : '≥ the force to slide: it slides first'}` });
      if (Ptip < Tslide) { Tneed = Ptip; how = 'tip'; }
      out.push({ k: 'Push to tip the crate', v: Ptip, u: F });
    }
    const Tmax = (muB * WB) / (cm + muB * sm), Nm = WB - Tmax * sm;
    S.add({ t: 'Person: largest force before the shoes slip', f: rope ? '→ ΣF_x: T cos θ_m − μ′ N_m = 0;  ↑ ΣF_y: N_m + T sin θ_m − W_m = 0' : 'F_m = P ≤ μ′ N_m,  N_m = W_m', n: rope ? `The rope pulls on the person at θ_m = ${fmt(thM)}° above the horizontal (through a pulley this can differ from the angle at the crate), which also lifts them and lowers their normal force.` : 'The crate pushes back on the person with the same force P, held by the friction at the shoes.',
      s: `${rope ? 'T' : 'P'}_max = μ′ W_m/(cos θ_m + μ′ sin θ_m) = ${fmt(muB)}(${fmt(WB)})/(${fmt(cm)} + ${fmt(muB)}(${fmt(sm)}))`, r: `${rope ? 'T' : 'P'}_max = ${fmt(Tmax)} ${F};  N_m = ${fmt(Nm)} ${F}` });
    const can = Tmax >= Tneed;
    S.add({ t: 'Can the person move the crate?', r: can ? `Yes: the person can give ${fmt(Tmax)} ${F} and the crate needs ${fmt(Tneed)} ${F} (it ${how === 'tip' ? 'tips' : 'slides'})` : `No: the person's shoes slip at ${fmt(Tmax)} ${F}, less than the ${fmt(Tneed)} ${F} the crate needs` });
    out.unshift({ k: `${rope ? 'Rope tension' : 'Push'} needed to move the crate`, v: Tneed, u: F, hl: true }, { k: `Largest ${rope ? 'pull' : 'push'} before the person slips`, v: Tmax, u: F, hl: true });
    out.push({ k: 'Normal force under the crate', v: WA - Tneed * scn, u: F }, { k: 'Normal force under the person', v: Nm, u: F });
    return res(can ? 'Yes, the person can move the crate' : 'No, the person slips first', can ? 'ok' : 'warn', out, S, Object.assign(geo, { rope, thC, thM, Tneed, Tmax, can, how, tip: !rope && q.tip, b: +q.b, h: +q.h }), []);
  }

  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, UNITS } = Core;
    const kL = convert(1, UNITS[from].len, UNITS[to].len), kS = convert(1, UNITS[from].lenS, UNITS[to].lenS), f1 = twin(st.fu, to), kF = convert(1, st.fu, f1), kM = convert(1, from === 'SI' ? 'kg' : 'slug', to === 'SI' ? 'kg' : 'slug');
    const kML = kF * kL;
    ['bk', 'ic', 'ld', 'wd', 'sc', 'bt', 'vh', 'be', 'tw', 'rd', 'br'].forEach((g) => {
      const o = st[g]; if (!o) return;
      Object.keys(o).forEach((k) => {
        const v = o[k]; if (typeof v !== 'number') return;
        if (LEN.has(k)) o[k] = tidy(v * kL, 9); else if (SML.has(k)) o[k] = tidy(v * kS, 9); else if (FOR.has(k)) o[k] = tidy(v * kF, 9); else if (MAS.has(k)) o[k] = tidy(v * kM, 9); else if ((g === 'be' || g === 'br') && MOM.has(k)) o[k] = tidy(v * kML, 9);
      });
    });
    if (st.tw) st.tw.k = tidy(+st.tw.k * kF / kL, 9);
    if (st.bt && typeof st.bt.M === 'number') st.bt.M = tidy(st.bt.M * kML, 9);
    st.fu = f1;
    return st;
  }

  const Friction = { defaults, solve, convertState };
  root.Friction = Friction;
  if (typeof module !== 'undefined' && module.exports) module.exports = Friction;
})(typeof window !== 'undefined' ? window : globalThis);
