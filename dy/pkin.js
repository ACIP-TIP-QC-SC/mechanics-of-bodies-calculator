/* =====================================================================
 * DYNAMICS · D3 Particle Kinetics (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Sections 13.4 to 13.6, 14.1 to 14.6 and 15.1 to 15.3.
 *   Force and acceleration: ΣF = ma (13–7), n–t components ΣF_n = mv²/ρ (13–8)
 *   Work and energy: T₁ + ΣU₁₋₂ = T₂ (14–7); conservative forces T₁ + V₁ = T₂ + V₂ (14–21)
 *   Spring work U_s = −(½ks₂² − ½ks₁²) (14–4); power P = F·v (14–10), efficiency ε = P_out/P_in
 *   Impulse and momentum: mv₁ + Σ∫F dt = mv₂ (15–3)
 * Scenes: a block on a floor or incline pushed or pulled by a force, two blocks joined by a cord
 * over pulleys, a block launched by (or landing on) a spring, a car on a flat or banked curve,
 * and a particle moving on a vertical circle (inside a track, on a cord, or over a dome).
 * Static friction is always checked before motion is assumed.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B } = DY;
  const D2R = Math.PI / 180;

  function defaults() {
    return {
      scene: 'block',
      // block on a floor or incline
      m: 50, th: 0, P: 400, al: 30, mus: 0.4, muk: 0.3, v0: 0, spring: false, k: 30, s1: 0.5, method: 'force', t: 3, d: 2, eff: 1,
      // two blocks and a cord
      onA: 'table', thA: 30, mA: 10, mB: 5, nA: 1, nB: 1, find: 'time', dB: 1, vB: 2,
      // spring launch
      sth: 90, d1: 0.7, d2: 0.6, y0: 0.3, sk: 200, sm: 2, smode: 'launch', sv0: 3, hdrop: 0.75,
      // curve
      r: 100, bank: 20, cmus: 0.3, cv: 20,
      // vertical circle
      kind: 'inside', R: 4, cm: 60, phi0: 90, cv0: 0, phi: 30,
    };
  }
  const KINDS = { m: 'M', P: 'F', k: 'K', s1: 'L', v0: 'V', d: 'L', mA: 'M', mB: 'M', dB: 'L', vB: 'V', d1: 'L', d2: 'L', y0: 'L', sk: 'K', sm: 'M', sv0: 'V', hdrop: 'L', r: 'L', cv: 'V', R: 'L', cm: 'M', cv0: 'V' };
  function convertState(st, from, to) { return DY.convertObj(st, KINDS, from, to); }
  const sgnTxt = (x, pos, neg) => (Math.abs(x) < 1e-12 ? 'at rest' : x > 0 ? pos : neg);

  function solve(st, U) {
    const u = DY.units(U);
    switch (st.scene) {
      case 'pulley': return pulley(st, u);
      case 'spring': return spring(st, u);
      case 'curve': return curve(st, u);
      case 'circle': return circle(st, u);
      default: return block(st, u);
    }
  }

  /* ---------------- Block on a floor or incline ---------------- */
  function block(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = B(+st.m, 'M', u), th = +st.th * D2R, P = +st.P, al = +st.al * D2R, mus = +st.mus, muk = +st.muk, v0 = +st.v0, eff = +st.eff;
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the block.`);
    if (!(th >= 0 && th < Math.PI / 2)) return fail('The incline angle must be from 0° up to (not including) 90°.');
    if (!(P >= 0) || !isFinite(al)) return fail('Enter the applied force P (0 for none) and its angle.');
    if (!(mus >= 0) || !(muk >= 0)) return fail('Friction coefficients cannot be negative.');
    if (mus < muk) warn.push('μ_s is normally at least μ_k.');
    if (!isFinite(v0)) return fail('Enter the starting velocity (0 if it starts at rest).');
    if (!(eff > 0 && eff <= 1)) return fail('The efficiency must be more than 0 and at most 1.');
    const spr = !!st.spring, k = spr ? +st.k : 0, s1 = spr ? +st.s1 : 0;
    if (spr && !(k > 0)) return fail('Enter the spring stiffness.');
    const W = m * g, Px = P * Math.cos(al), Py = P * Math.sin(al), Wx = W * Math.sin(th), Wy = W * Math.cos(th);
    const N = Wy - Py;
    const dirName = th > 0 ? ['up the slope', 'down the slope'] : ['to the right', 'to the left'];
    const plus = th > 0 ? '(+↗ up the slope)' : '(+→)';
    S.add({ t: 'Free-body diagram', n: `Weight W = mg = ${fmt(W)} ${u.F}${th > 0 ? ` on a ${fmt(+st.th)}° incline` : ''}; P = ${fmt(P)} ${u.F} at ${fmt(+st.al)}° from the ${th > 0 ? 'slope' : 'floor'}${spr ? `; a spring k = ${fmt(k)} ${u.K} behind the block, stretched ${fmt(s1)} ${u.L} at the start` : ''}. x runs ${dirName[0]}, y is normal to the surface.` });
    S.add({ t: 'Normal force', f: '(+↑ normal) ΣF_y = ma_y = 0:  N − W cos θ + P sin α = 0', s: `N = ${fmt(Wy)} − ${fmt(Py)}`, r: `N = ${fmt(N)} ${u.F}` });
    if (N < -1e-9) return fail(`P lifts the block off the surface (N would be ${fmt(N)} ${u.F}). Reduce P or its angle.`);
    const drive = (x) => Px - Wx - (spr ? k * (s1 + x) : 0); // along x, without friction
    const geoBase = { scene: 'block', u, m, th: +st.th, al: +st.al, P, N, W, k, s1, spr, mus, muk };
    const powerOut = (vEnd, UP, dt) => {
      out.push({ k: 'Power of P at the end, P·v', v: Px * vEnd, u: u.PW === 'hp' ? 'ft·lb/s' : 'W' });
      if (dt > 0) out.push({ k: 'Average power of P, U_P/Δt', v: UP / dt, u: u.PW === 'hp' ? 'ft·lb/s' : 'W' });
      S.add({ t: 'Power', n: 'The power of P is the dot product of P and the velocity of its point of application.', f: `P = F·v = (P cos α)v${dt > 0 ? ';  P_avg = U_P/Δt' : ''}${eff < 1 ? ';  P_in = P_out/ε' : ''}`, s: `P = ${fmt(Px)}(${fmt(vEnd)})${dt > 0 ? `;  P_avg = ${fmt(UP)}/${fmt(dt)}` : ''}`, r: `P = ${fmt(Px * vEnd)} ${u.us ? 'ft·lb/s' : 'W'}${dt > 0 ? `, P_avg = ${fmt(UP / dt)} ${u.us ? 'ft·lb/s' : 'W'}` : ''}${eff < 1 ? `; input ${fmt(Math.abs(Px * vEnd) / eff)} ${u.us ? 'ft·lb/s' : 'W'}` : ''}` });
      if (eff < 1) out.push({ k: `Power input at ε = ${fmt(eff)}`, v: Math.abs(Px * vEnd) / eff, u: u.us ? 'ft·lb/s' : 'W' });
    };

    if (st.method === 'work') {
      const d = +st.d; if (!(d > 0)) return fail('Enter the distance the block travels.');
      let dir;
      if (Math.abs(v0) > 1e-12) dir = Math.sign(v0);
      else {
        const F0 = drive(0);
        S.add({ t: 'Does it move? Check static friction', f: '|ΣF_x without friction| ≤ μ_s N ?', s: `|${fmt(F0)}| vs ${fmt(mus)}(${fmt(N)}) = ${fmt(mus * N)}`, r: Math.abs(F0) <= mus * N ? 'Static friction holds: the block stays at rest.' : `It slides ${F0 > 0 ? dirName[0] : dirName[1]}.` });
        if (Math.abs(F0) <= mus * N) return DY.result('The block stays at rest', 'warn', [{ k: 'Friction needed', v: Math.abs(F0), u: u.F, hl: true }, { k: 'Friction available μ_s N', v: mus * N, u: u.F }], S, Object.assign(geoBase, { rest: true, F: -F0, x: () => 0, v: () => 0, span: [0, 1], bars: [] }), ['Static friction holds, so nothing moves.']);
        dir = Math.sign(F0);
      }
      const xe = dir * d, UP = Px * xe, UW = -Wx * xe, Uf = -muk * N * d, Us = spr ? -(0.5 * k * (s1 + xe) ** 2 - 0.5 * k * s1 * s1) : 0, SU = UP + UW + Uf + Us;
      S.add({ t: 'Work of each force', n: `The block moves ${fmt(d)} ${u.L} ${dir > 0 ? dirName[0] : dirName[1]}. N does no work; friction μ_k N always opposes the motion.`,
        f: 'U_P = (P cos α)Δx;  U_W = −(W sin θ)Δx;  U_f = −μ_k N d' + (spr ? ';  U_s = −(½ks₂² − ½ks₁²)' : ''),
        s: `U_P = ${fmt(Px)}(${fmt(xe)}) = ${fmt(UP)};  U_W = −${fmt(Wx)}(${fmt(xe)}) = ${fmt(UW)};  U_f = −${fmt(muk)}(${fmt(N)})(${fmt(d)}) = ${fmt(Uf)}` + (spr ? `;  U_s = −(½(${fmt(k)})(${fmt(s1 + xe)})² − ½(${fmt(k)})(${fmt(s1)})²) = ${fmt(Us)}` : ''),
        r: `ΣU₁₋₂ = ${fmt(SU)} ${u.E}` });
      // v² along the way must stay positive: v²(ξ) = v0² + (2/m)[(dir·(Px − Wx − k s1) − μk N)ξ − ½kξ²]
      const lin = dir * (Px - Wx - k * s1) - muk * N, v2 = (xi) => v0 * v0 + (2 / m) * (lin * xi - 0.5 * k * xi * xi);
      let stopAt = null;
      if (v2(d) < -1e-9) { const q = DY.quad(-k / m, (2 / m) * lin, v0 * v0).filter((z) => z > 1e-12); stopAt = q.length ? q[0] : 0; }
      else if (k > 0 && lin / k > 0 && lin / k < d && v2(lin / k) < -1e-9) { const q = DY.quad(-k / m, (2 / m) * lin, v0 * v0).filter((z) => z > 1e-12); stopAt = q.length ? q[0] : 0; }
      if (stopAt !== null) {
        S.add({ t: 'It stops first', n: 'T₂ would be negative, so the block stops before it covers the distance.', f: 'T₁ + ΣU = 0 at the stopping point', r: `It stops after ${fmt(stopAt)} ${u.L}` });
        warn.push(`The block stops after ${fmt(stopAt)} ${u.L}, before it travels ${fmt(d)} ${u.L}.`);
        out.push({ k: 'Distance to stop', v: stopAt, u: u.L, hl: true }, { k: 'Total work ΣU₁₋₂ over the full distance', v: SU, u: u.E });
        return DY.result(`Stops after ${fmt(stopAt)} ${u.L}`, 'warn', out, S, Object.assign(geoBase, { dir, x: (tt) => dir * Math.min(stopAt, stopAt * tt), v: () => 0, span: [0, 1], d: stopAt, bars: [['U_P', UP], ['U_W', UW], ['U_f', Uf]].concat(spr ? [['U_s', Us]] : []) }), warn);
      }
      const T1 = 0.5 * m * v0 * v0, T2 = T1 + SU, vE = dir * Math.sqrt(Math.max(0, 2 * T2 / m));
      S.add({ t: 'Principle of work and energy', f: 'T₁ + ΣU₁₋₂ = T₂:  ½mv₁² + ΣU₁₋₂ = ½mv₂²', s: `${fmt(T1)} + ${fmt(SU)} = ½(${fmt(m)})v₂²`, r: `v₂ = ${fmt(Math.abs(vE))} ${u.V} ${dir > 0 ? dirName[0] : dirName[1]}` });
      out.push({ k: 'Speed after the distance v₂', v: Math.abs(vE), u: u.V, hl: true }, { k: 'Total work ΣU₁₋₂', v: SU, u: u.E, hl: true }, { k: 'Work of P, U_P', v: UP, u: u.E }, { k: 'Work of the weight U_W', v: UW, u: u.E }, { k: 'Work of friction U_f', v: Uf, u: u.E });
      if (spr) out.push({ k: 'Work of the spring U_s', v: Us, u: u.E });
      out.push({ k: 'Normal force N', v: N, u: u.F }, { k: 'Kinetic energy T₂', v: T2, u: u.E });
      let dt = 0;
      if (!spr) { const a = (lin) / m; dt = Math.abs(a) > 1e-12 ? (Math.abs(vE) - Math.abs(v0)) / a : d / Math.abs(v0 || 1e-12); if (!(dt > 0)) dt = 0; }
      if (P > 0) powerOut(Math.abs(vE) * dir, UP, dt);
      // motion for the animation: integrate along the path
      const span = dt > 0 ? dt : 1, xs = (tt) => { const xi = d * tt; return dir * xi; };
      const xOfT = spr || !(dt > 0) ? (tt) => xs(tt / span) : (tt) => dir * (Math.abs(v0) * tt + 0.5 * (lin / m) * tt * tt);
      return DY.result(`v₂ = ${fmt(Math.abs(vE))} ${u.V}, ΣU = ${fmt(SU)} ${u.E}`, warn.length ? 'warn' : 'ok', out, S, Object.assign(geoBase, { dir, d, x: xOfT, v: () => vE, span: [0, span], bars: [['T₁', T1], ['U_P', UP], ['U_W', UW], ['U_f', Uf]].concat(spr ? [['U_s', Us]] : []).concat([['T₂', T2]]) }), warn);
    }

    if (spr) return fail('With a spring the force changes as the block moves, so the acceleration is not constant. Use the work and energy method.');
    // Force and acceleration (with kinematics) or impulse and momentum: piecewise constant acceleration
    const mode = st.method === 'stop' ? 'stop' : st.method === 'impulse' ? 'impulse' : 'force';
    let tEnd = +st.t;
    if (mode === 'stop') { if (Math.abs(v0) < 1e-12) return fail('Give the block a starting velocity to find where it stops.'); tEnd = Infinity; }
    else if (!(tEnd > 0)) return fail('Enter the time t.');
    const phases = []; let tt = 0, x = 0, v = v0, guard = 0, aNow = 0, rest = false;
    while (tt < tEnd - 1e-12 && guard++ < 4) {
      const F0 = drive(x);
      if (Math.abs(v) < 1e-12) {
        if (Math.abs(F0) <= mus * N + 1e-12) { phases.push({ t0: tt, t1: tEnd, x0: x, v0: 0, a: 0, rest: true, F0 }); rest = true; aNow = 0; break; }
        const dir = Math.sign(F0), a = (F0 - dir * muk * N) / m;
        const t1 = tEnd; phases.push({ t0: tt, t1, x0: x, v0: 0, a, dir, F0 }); x += 0.5 * a * (t1 - tt) ** 2; v = a * (t1 - tt); aNow = a; tt = t1; break;
      }
      const dir = Math.sign(v), a = (F0 - dir * muk * N) / m;
      if (a * dir < 0 && -v / a < tEnd - tt - 1e-12) { const ts = -v / a; phases.push({ t0: tt, t1: tt + ts, x0: x, v0: v, a, dir, F0, stops: true }); x += v * ts + 0.5 * a * ts * ts; v = 0; tt += ts; aNow = a; if (mode === 'stop') break; continue; }
      if (mode === 'stop') return fail(`The block does not slow down (a = ${fmt(a)} ${u.A} along its motion), so it never stops.`);
      phases.push({ t0: tt, t1: tEnd, x0: x, v0: v, a, dir, F0 }); x += v * (tEnd - tt) + 0.5 * a * (tEnd - tt) ** 2; v += a * (tEnd - tt); aNow = a; tt = tEnd;
    }
    if (mode === 'stop') tEnd = tt;
    const p0 = phases[0];
    if (Math.abs(v0) < 1e-12) S.add({ t: 'Does it move? Check static friction', f: '|ΣF_x without friction| ≤ μ_s N ?', s: `|${fmt(p0.F0)}| vs ${fmt(mus)}(${fmt(N)}) = ${fmt(mus * N)}`, r: p0.rest ? 'Static friction holds: the block stays at rest.' : `It slides ${p0.F0 > 0 ? dirName[0] : dirName[1]}, so kinetic friction μ_k N acts against the motion.` });
    phases.forEach((ph, i) => {
      if (ph.rest) { if (i > 0) S.add({ t: 'At rest', n: `At t = ${fmt(ph.t0)} s the block has stopped; static friction ${fmt(Math.abs(ph.F0))} ${u.F} ≤ μ_s N = ${fmt(mus * N)} ${u.F}, so it stays.` }); return; }
      const fr = ph.dir * muk * N, sgn = ph.dir > 0 ? '−' : '+';
      if (mode === 'impulse') S.add({ t: `Impulse and momentum${phases.length > 1 ? ` (phase ${i + 1})` : ''}`, n: `Moving ${ph.dir > 0 ? dirName[0] : dirName[1]}; the forces along x are constant.`, f: `${plus} m(v_x)₁ + Σ∫F_x dt = m(v_x)₂:  mv₁ + (P cos α − W sin θ ${sgn} μ_k N)Δt = mv₂`, s: `${fmt(m)}(${fmt(ph.v0)}) + (${fmt(Px)} − ${fmt(Wx)} ${sgn} ${fmt(Math.abs(fr))})(${fmt(ph.t1 - ph.t0)}) = ${fmt(m)}v₂`, r: `v₂ = ${fmt(ph.v0 + ph.a * (ph.t1 - ph.t0))} ${u.V}${ph.stops ? ' (it stops here)' : ''}` });
      else S.add({ t: `Equation of motion${phases.length > 1 ? ` (phase ${i + 1})` : ''}`, n: `Moving ${ph.dir > 0 ? dirName[0] : dirName[1]}, so friction acts ${ph.dir > 0 ? dirName[1] : dirName[0]}.`, f: `${plus} ΣF_x = ma_x:  P cos α − W sin θ ${sgn} μ_k N = ma`, s: `${fmt(Px)} − ${fmt(Wx)} ${sgn} ${fmt(muk)}(${fmt(N)}) = ${fmt(m)}a`, r: `a = ${fmt(ph.a)} ${u.A}` });
      if (mode !== 'impulse') {
        const dtp = ph.t1 - ph.t0;
        if (ph.stops) S.add({ t: 'Kinematics: when does it stop?', f: 'v = v₀ + a_c t = 0;  s = v₀t + ½a_c t²', s: `t = −${fmt(ph.v0)}/${fmt(ph.a)}`, r: `stops after ${fmt(dtp)} s, having moved ${fmt(Math.abs(ph.v0 * dtp + 0.5 * ph.a * dtp * dtp))} ${u.L}` });
        else S.add({ t: 'Kinematics (constant acceleration)', f: 'v = v₀ + a_c t;  s = s₀ + v₀t + ½a_c t²', s: `v = ${fmt(ph.v0)} + ${fmt(ph.a)}(${fmt(dtp)})`, r: `v = ${fmt(ph.v0 + ph.a * dtp)} ${u.V}, s = ${fmt(ph.x0 + ph.v0 * dtp + 0.5 * ph.a * dtp * dtp)} ${u.L} at t = ${fmt(ph.t1)} s` });
      }
    });
    const dist = phases.reduce((sum, ph) => sum + Math.abs(ph.rest ? 0 : (() => { const dtp = ph.t1 - ph.t0; return ph.v0 * dtp + 0.5 * ph.a * dtp * dtp; })()), 0);
    const xAt = (time) => { let xx = 0; for (const ph of phases) { if (time <= ph.t1 || ph === phases[phases.length - 1]) { const q = Math.min(time, ph.t1) - ph.t0; return ph.rest ? ph.x0 : ph.x0 + ph.v0 * q + 0.5 * ph.a * q * q; } xx = ph.x0; } return xx; };
    const vAt = (time) => { for (const ph of phases) if (time <= ph.t1 + 1e-12) return ph.rest ? 0 : ph.v0 + ph.a * (Math.min(time, ph.t1) - ph.t0); return v; };
    const fr0 = phases.find((ph) => !ph.rest);
    if (mode === 'stop') {
      out.push({ k: 'Distance to stop', v: dist, u: u.L, hl: true }, { k: 'Time to stop', v: tEnd, u: 's', hl: true }, { k: 'Deceleration', v: Math.abs(phases[0].a), u: u.A }, { k: 'Normal force N', v: N, u: u.F });
      const F0 = drive(x);
      if (Math.abs(F0) > mus * N) warn.push(`After it stops, static friction (${fmt(mus * N)} ${u.F}) cannot hold it: it starts to slide ${F0 > 0 ? dirName[0] : dirName[1]}.`);
    } else {
      out.push({ k: `Velocity at t = ${fmt(tEnd)} s`, v, u: u.V, hl: true }, { k: 'Acceleration', v: aNow, u: u.A, hl: true }, { k: 'Position x', v: x, u: u.L }, { k: 'Distance travelled', v: dist, u: u.L }, { k: 'Normal force N', v: N, u: u.F });
      if (fr0) out.push({ k: 'Friction force μ_k N', v: muk * N, u: u.F });
      if (rest && Math.abs(v0) < 1e-12) out.splice(0, out.length, { k: 'Friction needed', v: Math.abs(drive(0)), u: u.F, hl: true }, { k: 'Friction available μ_s N', v: mus * N, u: u.F }, { k: 'Normal force N', v: N, u: u.F });
      if (P > 0 && !(rest && Math.abs(v0) < 1e-12)) powerOut(v, Px * x, tEnd);
    }
    const T1 = 0.5 * m * v0 * v0, T2 = 0.5 * m * v * v, UP = Px * x, UW = -Wx * x, Uf = -muk * N * dist;
    const status = rest && Math.abs(v0) < 1e-12 ? 'The block stays at rest' : mode === 'stop' ? `Stops after ${fmt(dist)} ${u.L} in ${fmt(tEnd)} s` : `v = ${fmt(v)} ${u.V}, a = ${fmt(aNow)} ${u.A} at t = ${fmt(tEnd)} s`;
    return DY.result(status, warn.length || rest ? 'warn' : 'ok', out, S, Object.assign(geoBase, { rest: rest && Math.abs(v0) < 1e-12, F: -drive(0), x: xAt, v: vAt, a: aNow, dir: fr0 ? fr0.dir : 0, span: [0, tEnd], bars: [['T₁', T1], ['U_P', UP], ['U_W', UW], ['U_f', Uf], ['T₂', T2]] }), warn);
  }

  /* ---------------- Two blocks joined by a cord ---------------- */
  function pulley(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const mA = B(+st.mA, 'M', u), mB = B(+st.mB, 'M', u), nA = Math.round(+st.nA), nB = Math.round(+st.nB), th = st.onA === 'incline' ? +st.thA * D2R : 0;
    if (!(mA > 0) || !(mB > 0)) return fail(`Enter both ${u.us ? 'weights' : 'masses'}.`);
    if (!(nA >= 1 && nA <= 4 && nB >= 1 && nB <= 4)) return fail('Each block hangs on 1 to 4 cord segments.');
    if (st.onA === 'incline' && !(th > 0 && th < Math.PI / 2)) return fail('The incline angle must be between 0° and 90°.');
    const surf = st.onA !== 'hang', mus = surf ? +st.mus : 0, muk = surf ? +st.muk : 0;
    if (!(mus >= 0) || !(muk >= 0)) return fail('Friction coefficients cannot be negative.');
    const WA = mA * g, WB = mB * g, GA = st.onA === 'hang' ? WA : st.onA === 'incline' ? WA * Math.sin(th) : 0, NA = surf ? WA * Math.cos(th) : 0, q = nA / nB;
    const sAdesc = st.onA === 'hang' ? 'down' : st.onA === 'incline' ? 'down the slope' : 'away from the pulley';
    S.add({ t: 'Position coordinates and the cord', n: `s_A is measured ${sAdesc} and s_B down, both from fixed datums. A is held by ${nA} cord segment${nA > 1 ? 's' : ''} and B by ${nB}.`, f: `${nA > 1 ? nA : ''}s_A + ${nB > 1 ? nB : ''}s_B = l  ⇒  ${nA > 1 ? nA : ''}a_A = −${nB > 1 ? nB : ''}a_B`, r: `a_B = −${fmt(q)}a_A` });
    S.add({ t: 'Free-body diagrams', n: `On A: ${st.onA === 'hang' ? `weight ${fmt(WA)} ${u.F} and ${nA}T up` : `weight ${fmt(WA)} ${u.F}, normal force N_A = ${fmt(NA)} ${u.F}, friction, and ${nA}T toward the pulley`}. On B: weight ${fmt(WB)} ${u.F} and ${nB}T up.`, f: `A: ΣF = m_A a_A:  ${st.onA === 'hang' ? 'W_A' : st.onA === 'incline' ? 'W_A sin θ' : '0'} − ${nA > 1 ? nA : ''}T ∓ F_f = m_A a_A;   B: W_B − ${nB > 1 ? nB : ''}T = m_B a_B` });
    const D0 = GA - q * WB, Me = mA + q * q * mB;
    let aA, rest = false;
    if (surf) {
      S.add({ t: 'Does it move? Check static friction on A', n: 'With the system held still, the friction that would be needed on A is the net pull of the weights along A\'s path.', f: '|W_A sin θ − (n_A/n_B)W_B| ≤ μ_s N_A ?', s: `|${fmt(GA)} − ${fmt(q)}(${fmt(WB)})| = ${fmt(Math.abs(D0))} vs ${fmt(mus)}(${fmt(NA)}) = ${fmt(mus * NA)}`, r: Math.abs(D0) <= mus * NA ? 'Static friction holds: nothing moves.' : 'The blocks move; kinetic friction acts on A against its motion.' });
      if (Math.abs(D0) <= mus * NA) rest = true;
    }
    if (rest) aA = 0;
    else { const dir = Math.sign(D0) || 1; aA = (D0 - dir * muk * NA) / Me; }
    const aB = -q * aA, T = (WB - mB * aB) / nB;
    if (!rest) S.add({ t: 'Solve the equations', n: 'Eliminate T and a_B using the cord equation.', f: `a_A = [${st.onA === 'hang' ? 'W_A' : st.onA === 'incline' ? 'W_A sin θ' : '0'} − (n_A/n_B)W_B ∓ μ_k N_A]/(m_A + (n_A/n_B)²m_B);  T = (W_B − m_B a_B)/n_B`, s: `a_A = (${fmt(GA)} − ${fmt(q * WB)}${surf ? ` ${D0 > 0 ? '−' : '+'} ${fmt(muk * NA)}` : ''})/(${fmt(mA)} + ${fmt(q * q)}(${fmt(mB)}))`,
      r: `a_A = ${fmt(aA)} ${u.A}, a_B = ${fmt(aB)} ${u.A}, T = ${fmt(T)} ${u.F}` });
    if (T < -1e-9) return fail('The cord would have to push (T < 0): it goes slack and the blocks move separately.');
    const dirA = aA > 0 ? sAdesc : aA < 0 ? (st.onA === 'hang' ? 'up' : st.onA === 'incline' ? 'up the slope' : 'toward the pulley') : 'at rest', dirB = aB > 0 ? 'down' : aB < 0 ? 'up' : 'at rest';
    let t, sA, sB, vA, vBv;
    if (rest) { t = 0; sA = sB = vA = vBv = 0; }
    else if (st.find === 'distB' || st.find === 'speedB') {
      if (st.find === 'distB') { const d = +st.dB; if (!(d > 0)) return fail('Enter the distance B moves.'); t = Math.sqrt((2 * d) / Math.abs(aB)); }
      else { const vv = +st.vB; if (!(vv > 0)) return fail('Enter the speed of B.'); t = vv / Math.abs(aB); }
      sA = 0.5 * aA * t * t; sB = 0.5 * aB * t * t; vA = aA * t; vBv = aB * t;
      S.add({ t: 'Kinematics of B (from rest)', f: st.find === 'distB' ? 's_B = ½a_B t²' : 'v_B = a_B t;  s_B = v_B²/(2a_B)', r: `t = ${fmt(t)} s, s_B = ${fmt(Math.abs(sB))} ${u.L} ${dirB}, v_B = ${fmt(Math.abs(vBv))} ${u.V}` });
    } else {
      t = +st.t; if (!(t > 0)) return fail('Enter the time t.');
      sA = 0.5 * aA * t * t; sB = 0.5 * aB * t * t; vA = aA * t; vBv = aB * t;
      S.add({ t: 'Kinematics (from rest, constant acceleration)', f: 'v = a_c t;  s = ½a_c t²', s: `v_A = ${fmt(aA)}(${fmt(t)}), v_B = ${fmt(aB)}(${fmt(t)})`, r: `v_A = ${fmt(vA)} ${u.V}, v_B = ${fmt(vBv)} ${u.V}; s_A = ${fmt(sA)} ${u.L}, s_B = ${fmt(sB)} ${u.L}` });
    }
    const UW = GA * sA + WB * sB, Uf = -muk * NA * Math.abs(sA), T2 = 0.5 * mA * vA * vA + 0.5 * mB * vBv * vBv;
    if (!rest) S.add({ t: 'Check by work and energy (both blocks together)', n: 'The cord tension does no net work on the system.', f: 'ΣT₁ + ΣU₁₋₂ = ΣT₂', s: `0 + ${fmt(UW)}${surf ? ` + (${fmt(Uf)})` : ''} = ½(${fmt(mA)})(${fmt(vA)})² + ½(${fmt(mB)})(${fmt(vBv)})²`, r: `${fmt(UW + Uf)} = ${fmt(T2)} ${u.E}` });
    if (rest) out.push({ k: 'Friction needed on A', v: Math.abs(D0), u: u.F, hl: true }, { k: 'Friction available μ_s N_A', v: mus * NA, u: u.F }, { k: 'Cord tension T', v: T, u: u.F });
    else {
      out.push({ k: 'Acceleration of A, a_A', v: aA, u: u.A, hl: true }, { k: 'Acceleration of B, a_B', v: aB, u: u.A, hl: true }, { k: 'Cord tension T', v: T, u: u.F, hl: true });
      out.push({ k: 'Time t', v: t, u: 's' }, { k: 'Velocity of A, v_A', v: vA, u: u.V }, { k: 'Velocity of B, v_B', v: vBv, u: u.V }, { k: 'Distance A moves', v: Math.abs(sA), u: u.L }, { k: 'Distance B moves', v: Math.abs(sB), u: u.L });
      if (surf) out.push({ k: 'Normal force on A', v: NA, u: u.F });
    }
    const status = rest ? 'Static friction holds: nothing moves' : `a_A = ${fmt(aA)}, a_B = ${fmt(aB)} ${u.A}, T = ${fmt(T)} ${u.F}`;
    return DY.result(status, rest ? 'warn' : 'ok', out, S, { scene: 'pulley', u, onA: st.onA, th: th / D2R, mA, mB, nA, nB, aA, aB, T, rest, NA, muk, dirA, dirB, span: [0, rest ? 1 : t], sA: (tt) => 0.5 * aA * tt * tt, sB: (tt) => 0.5 * aB * tt * tt, bars: [['U_W', UW], ['U_f', Uf], ['ΣT₂', T2]] }, warn);
  }

  /* ---------------- Block and spring ---------------- */
  function spring(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = B(+st.sm, 'M', u), k = +st.sk, th = +st.sth * D2R, muk = Math.abs(+st.sth - 90) < 1e-9 ? 0 : +st.muk, W = m * g;
    if (!(m > 0) || !(k > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} and the spring stiffness.`);
    if (!(th >= 0 && th <= Math.PI / 2 + 1e-12)) return fail('The angle must be from 0° (horizontal) to 90° (vertical).');
    if (!(muk >= 0)) return fail('The friction coefficient cannot be negative.');
    const sn = Math.sin(th), cs = Math.cos(th), resist = W * (sn + muk * cs); // weight and friction against motion up / away
    if (st.smode === 'hit') {
      let v0 = +st.sv0, h = 0;
      if (Math.abs(+st.sth - 90) < 1e-9) { h = +st.hdrop; if (!(h >= 0)) return fail('Enter the height it falls before it touches the spring.'); v0 = Math.sqrt(2 * g * h); S.add({ t: 'Speed when it touches the spring', f: 'T₀ + V₀ = T₁ + V₁:  mgh = ½mv₁²', s: `v₁ = √(2(${fmt(g)})(${fmt(h)}))`, r: `v₁ = ${fmt(v0)} ${u.V}` }); }
      else if (!(v0 > 0)) return fail('Enter the speed at which it reaches the spring.');
      const b = W * (sn - muk * cs);
      S.add({ t: 'Work and energy from first contact to the largest compression', n: `The block moves ${Math.abs(+st.sth - 90) < 1e-9 ? 'down' : 'down the slope'} into the spring and stops at the largest compression x; gravity does positive work, friction and the spring do negative work.`, f: '½mv₁² + W(sin θ − μ_k cos θ)x − ½kx² = 0', s: `½(${fmt(k)})x² − ${fmt(b)}x − ${fmt(0.5 * m * v0 * v0)} = 0`, r: '' });
      const x = (b + Math.sqrt(b * b + k * m * v0 * v0)) / k;
      S.list[S.list.length - 1].r = `x = ${fmt(x)} ${u.L}`;
      out.push({ k: 'Largest compression x', v: x, u: u.L, hl: true }, { k: 'Largest spring force kx', v: k * x, u: u.F, hl: true }, { k: 'Speed at contact', v: v0, u: u.V }, { k: 'Largest deceleration', v: (k * x - b) / m, u: u.A });
      return DY.result(`Largest compression ${fmt(x)} ${u.L}`, 'ok', out, S, { scene: 'spring', u, m, k, th: +st.sth, hit: true, x, v0, h, span: [0, 1], bars: [['T₁', 0.5 * m * v0 * v0], ['U_W', W * sn * x], ['U_f', -muk * W * cs * x], ['U_s', -0.5 * k * x * x]] }, warn);
    }
    const d1 = +st.d1, d2 = +st.d2;
    if (!(d1 > 0)) return fail('Enter how far the spring is compressed at release.');
    if (!(d2 >= 0 && d2 < d1)) return fail('The compression when the block leaves must be at least 0 and less than the starting compression.');
    const mus = Math.abs(+st.sth - 90) < 1e-9 ? 0 : +st.mus;
    S.add({ t: 'Does it move at release?', f: 'k s₁ > W sin θ + μ_s W cos θ ?', s: `${fmt(k)}(${fmt(d1)}) = ${fmt(k * d1)} vs ${fmt(W * sn + mus * W * cs)}`, r: k * d1 > W * sn + mus * W * cs ? 'Yes, the spring pushes it away.' : 'No: the spring cannot overcome the weight and friction.' });
    if (!(k * d1 > W * sn + mus * W * cs)) return fail('The spring force at release is too small to move the block.');
    const L1 = d1 - d2, Us = 0.5 * k * (d1 * d1 - d2 * d2), UW = -W * sn * L1, Uf = -muk * W * cs * L1, T2 = Us + UW + Uf;
    S.add({ t: 'Work and energy while the spring pushes', n: `From compression s₁ = ${fmt(d1)} ${u.L} to s₂ = ${fmt(d2)} ${u.L}${d2 > 0 ? ' (the spring is held there, so the block leaves it)' : ' (free length: the block leaves the spring)'}.`, f: 'T₁ + ΣU₁₋₂ = T₂:  0 + [−(½ks₂² − ½ks₁²)] − W sin θ Δs − μ_k N Δs = ½mv₂²',
      s: `U_s = ${fmt(Us)}, U_W = ${fmt(UW)}, U_f = ${fmt(Uf)} ${u.E}`, r: T2 > 0 ? `v₂ = ${fmt(Math.sqrt((2 * T2) / m))} ${u.V}` : 'The block stops before it leaves the spring.' });
    if (!(T2 > 0)) return fail('The block stops before it leaves the spring.');
    const vs = Math.sqrt((2 * T2) / m), dec = g * (sn + muk * cs);
    out.push({ k: 'Speed when it leaves the spring', v: vs, u: u.V, hl: true });
    let L2 = Infinity;
    if (dec > 1e-12) {
      L2 = (vs * vs) / (2 * dec);
      S.add({ t: 'After it leaves the spring', f: 'T₂ + ΣU₂₋₃ = 0:  ½mv₂² − W(sin θ + μ_k cos θ)d = 0', s: `d = ${fmt(T2)}/${fmt(W * (sn + muk * cs))}`, r: `d = ${fmt(L2)} ${u.L} more along the ${th > 0 ? (sn > 0.9999 ? 'vertical' : 'slope') : 'floor'}` });
      const tot = L1 + L2;
      out.push({ k: 'Further travel after leaving', v: L2, u: u.L }, { k: 'Total travel from release', v: tot, u: u.L, hl: true });
      if (sn > 1e-9) { out.push({ k: 'Height gained', v: tot * sn, u: u.L }); if (+st.y0 > 0 || Math.abs(+st.sth - 90) < 1e-9) out.push({ k: 'Highest point above the ground h', v: +st.y0 + tot * sn, u: u.L, hl: true }); }
    } else { warn.push('With no friction on a level floor the block keeps moving at this speed.'); }
    return DY.result(`Leaves at ${fmt(vs)} ${u.V}${isFinite(L2) ? `, travels ${fmt(L1 + L2)} ${u.L}` : ''}`, warn.length ? 'warn' : 'ok', out, S, { scene: 'spring', u, m, k, th: +st.sth, d1, d2, L1, L2, vs, y0: +st.y0, span: [0, 1], bars: [['U_s', Us], ['U_W', UW], ['U_f', Uf], ['T₂', T2]] }, warn);
  }

  /* ---------------- Car on a flat or banked curve ---------------- */
  function curve(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = B(+st.m, 'M', u), r = +st.r, th = +st.bank * D2R, mu = +st.cmus, v = +st.cv;
    if (!(m > 0) || !(r > 0)) return fail('Enter the mass (or weight) and the radius of the curve.');
    if (!(th >= 0 && th < Math.PI / 2)) return fail('The banking angle must be from 0° up to (not including) 90°.');
    if (!(mu >= 0) || !(v >= 0)) return fail('Enter μ_s and the speed (0 or more).');
    const sn = Math.sin(th), cs = Math.cos(th), W = m * g;
    S.add({ t: 'Free-body diagram and axes', n: 'The car moves on a horizontal circle, so n points horizontally toward the centre and b is vertical. N is normal to the road; friction F acts along the road, positive down the slope (toward the centre).', f: '(+← n) ΣF_n = mv²/ρ:  N sin θ + F cos θ = mv²/r;   (+↑ b) ΣF_b = 0:  N cos θ − F sin θ − W = 0' });
    const N = m * (g * cs + (v * v / r) * sn), F = m * ((v * v / r) * cs - g * sn);
    S.add({ t: `Forces at v = ${fmt(v)} ${u.V}`, f: 'N = m(g cos θ + (v²/r) sin θ);  F = m((v²/r) cos θ − g sin θ)', s: `v²/r = ${fmt(v * v / r)} ${u.A}`, r: `N = ${fmt(N)} ${u.F}, F = ${fmt(F)} ${u.F} (${Math.abs(F) < 1e-9 ? 'no friction needed' : F > 0 ? 'down the slope, keeping the car from sliding out' : 'up the slope, keeping the car from sliding in'})` });
    const ok = Math.abs(F) <= mu * N + 5e-4 * N;
    S.add({ t: 'Check friction', f: '|F| ≤ μ_s N ?', s: `${fmt(Math.abs(F))} vs ${fmt(mu)}(${fmt(N)}) = ${fmt(mu * N)}`, r: ok ? 'Yes: the car holds the road.' : `No: the car slides ${F > 0 ? 'up and out' : 'down and in'}.` });
    let vNo = 0, vMax = Infinity, vMin = 0;
    if (th > 0) { vNo = Math.sqrt(g * r * Math.tan(th)); S.add({ t: 'Speed that needs no friction', f: 'F = 0:  tan θ = v²/(gr)  ⇒  v = √(gr tan θ)', s: `v = √(${fmt(g)}(${fmt(r)}) tan ${fmt(+st.bank)}°)`, r: `v = ${fmt(vNo)} ${u.V}` }); }
    const den = cs - mu * sn;
    if (den > 1e-12) vMax = Math.sqrt((g * r * (sn + mu * cs)) / den);
    const nm = sn - mu * cs;
    if (nm > 0) vMin = Math.sqrt((g * r * nm) / (cs + mu * sn));
    S.add({ t: 'Speed range with friction at its limit', n: 'At the top speed friction F = μ_s N acts down the slope; at the lowest speed it acts up the slope.', f: 'v_max = √(gr(sin θ + μ_s cos θ)/(cos θ − μ_s sin θ));  v_min = √(gr(sin θ − μ_s cos θ)/(cos θ + μ_s sin θ))', r: `v_max = ${isFinite(vMax) ? `${fmt(vMax)} ${u.V}` : 'no limit (μ_s ≥ cot θ)'}, v_min = ${vMin > 0 ? `${fmt(vMin)} ${u.V}` : `0 (it can stop on the bank)`}` });
    if (th > 0) out.push({ k: 'Speed with no friction needed', v: vNo, u: u.V, hl: true });
    out.push({ k: 'Highest speed v_max', v: isFinite(vMax) ? vMax : 'no limit', u: isFinite(vMax) ? u.V : '', hl: true }, { k: 'Lowest speed v_min', v: vMin, u: u.V });
    out.push({ k: `Normal force at ${fmt(v)} ${u.V}`, v: N, u: u.F }, { k: `Friction needed at ${fmt(v)} ${u.V}`, v: F, u: u.F }, { k: 'Friction available μ_s N', v: mu * N, u: u.F });
    if (!ok) warn.push(`At ${fmt(v)} ${u.V} the car slides ${F > 0 ? 'up and out of the curve' : 'down into the curve'}.`);
    return DY.result(th > 0 ? `No-friction speed ${fmt(vNo)} ${u.V}; holds from ${fmt(vMin)} to ${isFinite(vMax) ? fmt(vMax) : '∞'} ${u.V}` : `Holds up to ${isFinite(vMax) ? fmt(vMax) : '∞'} ${u.V}`, ok ? 'ok' : 'warn', out, S, { scene: 'curve', u, m, r, th: +st.bank, mu, v, N, F, W, vNo, vMax, vMin, ok, span: [0, (2 * Math.PI * r) / Math.max(v, 1e-9)] }, warn);
  }

  /* ---------------- Particle on a vertical circle ---------------- */
  function circle(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = B(+st.cm, 'M', u), r = +st.R, f0 = +st.phi0 * D2R, f1 = +st.phi * D2R, v0 = +st.cv0, kind = st.kind;
    if (!(m > 0) || !(r > 0)) return fail('Enter the mass (or weight) and the radius.');
    if (!(v0 >= 0)) return fail('Enter the starting speed (0 or more).');
    if (![f0, f1].every((x) => x >= 0 && x <= Math.PI + 1e-12)) return fail('Angles must be from 0° to 180°.');
    const W = m * g, out_ = kind === 'outside';
    // inside / cord: φ from the bottom, height above the bottom y = r(1 − cos φ); outside: ψ from the top, y = r cos ψ (from the centre)
    const v2 = (f) => (out_ ? v0 * v0 + 2 * g * r * (Math.cos(f0) - Math.cos(f)) : v0 * v0 + 2 * g * r * (Math.cos(f) - Math.cos(f0)));
    const Nf = (f) => (out_ ? W * Math.cos(f) - (m * v2(f)) / r : (m * v2(f)) / r + W * Math.cos(f));
    const Nname = kind === 'cord' ? 'T' : 'N', ang = out_ ? 'ψ' : 'φ', from = out_ ? 'from the top' : 'from the bottom';
    S.add({ t: 'Conservation of energy', n: `${ang} is measured ${from} of the circle. Only the weight does work (${kind === 'cord' ? 'the cord tension' : 'the normal force'} is perpendicular to the path).`, f: out_ ? 'T₁ + V₁ = T₂ + V₂:  v² = v₁² + 2gr(cos ψ₁ − cos ψ)' : 'T₁ + V₁ = T₂ + V₂:  v² = v₁² + 2gr(cos φ − cos φ₁)', s: `v² = ${fmt(v0)}² + 2(${fmt(g)})(${fmt(r)})(${out_ ? `cos ${fmt(+st.phi0)}° − cos ${fmt(+st.phi)}°` : `cos ${fmt(+st.phi)}° − cos ${fmt(+st.phi0)}°`})`, r: v2(f1) >= 0 ? `v = ${fmt(Math.sqrt(v2(f1)))} ${u.V}` : 'v² < 0: it never gets there.' });
    if (v2(f1) < -1e-9) return fail(`It does not have the energy to reach ${ang} = ${fmt(+st.phi)}°; it turns back first.`);
    // does it leave the track (N = 0) on the way?
    const lo = Math.min(f0, f1), hi = Math.max(f0, f1);
    let leave = null;
    for (let i = 0; i <= 400; i++) { const f = lo + ((hi - lo) * i) / 400; if (Nf(f) < -1e-9 && v2(f) >= 0) { leave = f; break; } }
    if (leave !== null) {
      const c = out_ ? (v0 * v0 + 2 * g * r * Math.cos(f0)) / (3 * g * r) : -(v0 * v0 - 2 * g * r * Math.cos(f0)) / (3 * g * r), fl = Math.acos(Math.max(-1, Math.min(1, c)));
      S.add({ t: kind === 'cord' ? 'The cord goes slack' : 'It leaves the surface', f: `${Nname} = 0`, r: `at ${ang} = ${fmt(fl / D2R)}°, before reaching ${fmt(+st.phi)}°` });
      return fail(`${kind === 'cord' ? 'The cord goes slack' : 'It leaves the surface'} at ${ang} = ${fmt(fl / D2R)}°, before it reaches ${fmt(+st.phi)}°. ${out_ ? 'Start it slower.' : 'Give it more speed at the start.'}`);
    }
    const v = Math.sqrt(Math.max(0, v2(f1))), N = Nf(f1), an = (v * v) / r, at = g * Math.sin(f1);
    S.add({ t: 'Equation of motion along n', n: `n points toward the centre${out_ ? ' (down into the dome)' : ''}.`, f: out_ ? '(+↙ n) ΣF_n = man:  W cos ψ − N = mv²/r' : `(+↗ n) ΣF_n = man:  ${Nname} − W cos φ = mv²/r`, s: out_ ? `N = ${fmt(W)} cos ${fmt(+st.phi)}° − ${fmt(m)}(${fmt(v * v)})/${fmt(r)}` : `${Nname} = ${fmt(W)} cos ${fmt(+st.phi)}° + ${fmt(m)}(${fmt(v * v)})/${fmt(r)}`, r: `${Nname} = ${fmt(N)} ${u.F}` });
    S.add({ t: 'Equation of motion along t', f: 'ΣF_t = ma_t:  a_t = g sin ' + ang, r: `a_t = ${fmt(at)} ${u.A}, a_n = v²/r = ${fmt(an)} ${u.A}` });
    out.push({ k: 'Speed v', v, u: u.V, hl: true }, { k: kind === 'cord' ? 'Cord tension T' : 'Normal force N', v: N, u: u.F, hl: true }, { k: 'Normal acceleration a_n', v: an, u: u.A }, { k: 'Tangential acceleration a_t', v: at, u: u.A });
    if (!out_) {
      const vTop = Math.sqrt(g * r);
      S.add({ t: 'Speed needed to go over the top', f: `${Nname} = 0 at the top:  mg = mv²/r  ⇒  v_top = √(gr);  at the bottom v = √(5gr)`, r: `v_top ≥ ${fmt(vTop)} ${u.V}, v_bottom ≥ ${fmt(Math.sqrt(5 * g * r))} ${u.V}` });
      out.push({ k: 'Least speed at the top for a full loop', v: vTop, u: u.V });
    } else {
      const c = (v0 * v0 + 2 * g * r * Math.cos(f0)) / (3 * g * r);
      if (c < 1) { const fl = Math.acos(Math.max(-1, c)); out.push({ k: 'It leaves the dome at ψ', v: fl / D2R, u: '°' }); }
    }
    return DY.result(`v = ${fmt(v)} ${u.V}, ${Nname} = ${fmt(N)} ${u.F}`, 'ok', out, S, { scene: 'circle', u, kind, m, r, f0, f1, v0, v, N, W, v2, Nf, span: [0, 1] }, warn);
  }

  const Pkin = { defaults, convertState, solve };
  root.Pkin = Pkin;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pkin;
})(typeof window !== 'undefined' ? window : globalThis);
