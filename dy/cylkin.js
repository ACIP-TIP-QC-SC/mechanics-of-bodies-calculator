/* =====================================================================
 * DYNAMICS · Particle kinetics in cylindrical coordinates (physics only; browser + Node).
 * Used by Pkin (scene 'cyl'). Hibbeler, Dynamics 15e, Section 13.6.
 *   a_r = r̈ − rθ̇²,  a_θ = rθ̈ + 2ṙθ̇,  a_z = z̈                         (12–29)
 *   ΣF_r = m a_r,  ΣF_θ = m a_θ,  ΣF_z = m a_z                         (13–9)
 *   Angle from the radial line to the tangent: tan ψ = r/(dr/dθ)       (13–10)
 * The path is typed as r = f(θ) and z = h(θ) with θ̇ and θ̈ (or the speed and its rate, or the speed and the
 * force along the path) at the instant, or as r(t), θ(t) and z(t), or as r(t) alone with no transverse force,
 * so that r²θ̇ stays constant (a_θ = (1/r) d(r²θ̇)/dt = 0, Problem 13–92). The motion may be in a horizontal plane (z up, gravity along −z) or in a
 * vertical plane (θ from the horizontal, gravity straight down). An optional spring from O along r.
 * The force needed besides gravity and the spring is reported three ways:
 *   comp  components F_r, F_θ, F_z;
 *   path  a push P along the path and the normal force N of a smooth guide (rod or tube);
 *   arm   a rotating arm (slotted or forked rod) pushing along θ̂, and a smooth path or cam pushing
 *         normal to the path;
 *   cable a cable from a point a height h above O down to the particle on a level surface, pulling
 *         toward O at φ = tan⁻¹(h/r) below the horizontal: −T cos φ = R_r and N = R_z − T sin φ.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const Formula = root.Formula || require('../shared/formula.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;

  const defaults = () => ({ qgiven: 'theta', qr: '0.2 cos θ + 0.3', qz: '0', qth: 30, qrate: 'rate', qw: 4, qa: 0, qv: 8, qvd: 0, qrt: '1.5', qtt: '0.7 t', qzt: '-0.5 t', qt: 2,
    qm: 2, qplane: 'vertical', qspr: true, qk: 30, qL0: 0.1, qfind: 'arm',
    // r²θ̇ constant: start radius and rate; force along the path; height of the cable's fixed end above O
    qr0: 3, qw0: 0.1, qPt: 6, qhc: 1 });
  const KINDS = { qm: 'M', qk: 'K', qL0: 'L', qv: 'V', qvd: 'A', qr0: 'L', qPt: 'F', qhc: 'L' };
  /** Rewrite a length formula for a unit change: every value is multiplied by k. */
  const scaleF = (src, k) => (String(src).trim() === '0' || k === 1 ? src : `${Core.tidy(k, 12)}*(${src})`);
  function convert(st, from, to) {
    if (from === to) return st;
    DY.convertObj(st, KINDS, from, to);
    const k = Core.convert(1, from === 'SI' ? 'm' : 'ft', to === 'SI' ? 'm' : 'ft');
    ['qr', 'qz', 'qrt', 'qzt'].forEach((key) => { if (st[key] !== undefined) st[key] = scaleF(st[key], k); });
    return st;
  }

  /**
   * θ̇ and θ̈ on a path r = f(θ), z = h(θ) from the speed v and its rate v̇ (both along increasing θ):
   *   v = θ̇ √S with S = r′² + r² + z′²,   v̇ = θ̈ √S + θ̇² S′/(2√S)   (S′ = dS/dθ).
   */
  function speedRates(v, vd, r, r1, r2, z1, z2) {
    const S = r1 * r1 + r * r + z1 * z1, Sp = 2 * (r1 * r2 + r * r1 + z1 * z2), sq = Math.sqrt(S), w = v / sq;
    return { w, al: (vd - (w * w * Sp) / (2 * sq)) / sq, sq };
  }
  /** Weight components (along r̂, θ̂, ẑ): horizontal plane → −mg along z; vertical plane with θ from the horizontal → straight down. */
  const gravity = (m, g, vert, th) => (vert ? [-m * g * Math.sin(th), -m * g * Math.cos(th), 0] : [0, 0, -m * g]);
  /** ∫₀ᵗ C/r(s)² ds by Simpson's rule: the angle turned when r²θ̇ = C (θ = 0 at t = 0). */
  function centralAngle(R, C, t) {
    const n = 200, h = t / n; let sum = 0;
    for (let i = 0; i <= n; i++) { const r = R(i * h), f = C / (r * r); sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f; }
    return (sum * h) / 3;
  }

  /**
   * Builds the motion: returns { at(x) → kinematics, x0, xs: [lo, hi] for the drawn range } or { err }.
   * p = { m, g, vert, spr, kk, L0 } is needed when the rate comes from the force along the path.
   */
  function build(st, p) {
    const err = [];
    const C = (src, where, names) => { try { return Formula.compile(src === '' || src == null ? '0' : src, new Set(names)); } catch (e) { err.push(`${where}: ${e.message}.`); return null; } };
    if (st.qgiven === 'central') {
      // No transverse force: a_θ = (1/r) d(r²θ̇)/dt = 0, so r²θ̇ = C = r₀²θ̇₀, θ̇ = C/r² and θ̈ = −2ṙθ̇/r.
      const fr = C(st.qrt, 'r(t)', ['t']);
      if (err.length) return { err: err.join(' ') };
      const R = (t) => fr({ t }), r0 = +st.qr0, w0 = +st.qw0, t0 = +st.qt;
      if (!(r0 > 0)) return { err: 'Enter the starting radius r₀ (above zero).' };
      if (!isFinite(w0)) return { err: 'Enter the starting angular rate θ̇₀.' };
      if (!(t0 >= 0)) return { err: 'Enter the time t (zero or later).' };
      const Cc = r0 * r0 * w0, rt = R(t0);
      if (!(rt > 0)) return { err: `r(t) must be above zero at the instant (r = ${fmt(rt)} at t = ${fmt(t0)} s).` };
      for (let i = 0; i <= 50; i++) { const ri = R((t0 * i) / 50); if (!(ri > 0)) return { err: 'r(t) must stay above zero from t = 0 to the instant, so that θ̇ = C/r² stays finite.' }; }
      const at = (t) => {
        const [r, rd, rdd] = Formula.d012(R, t), w = Cc / (r * r), al = (-2 * rd * w) / r;
        return { t, r, rd, rdd, th: centralAngle(R, Cc, t), w, al, z: 0, zd: 0, zdd: 0, dr: Math.abs(w) > 1e-12 ? rd / w : NaN };
      };
      let hi = Math.max(t0 * 1.25, t0 + 1); // keep the drawn range where r stays well above zero
      for (let i = 1; i <= 100; i++) { const t = t0 + ((hi - t0) * i) / 100; if (!(R(t) > 0.25 * rt)) { hi = t0 + ((hi - t0) * (i - 1)) / 100; break; } }
      return { at, x0: t0, xs: [0, Math.max(hi, t0 + 1e-6)], by: 't', central: { C: Cc, r0, w0, rStart: R(0) } };
    }
    if (st.qgiven === 'time') {
      const fr = C(st.qrt, 'r(t)', ['t']), ft = C(st.qtt, 'θ(t)', ['t']), fz = C(st.qzt, 'z(t)', ['t']);
      if (err.length) return { err: err.join(' ') };
      const R = (t) => fr({ t }), Th = (t) => ft({ t }), Z = (t) => fz({ t });
      const at = (t) => {
        const [r, rd, rdd] = Formula.d012(R, t), [th, w, al] = Formula.d012(Th, t), [z, zd, zdd] = Formula.d012(Z, t);
        return { t, r, rd, rdd, th, w, al, z, zd, zdd, dr: Math.abs(w) > 1e-12 ? rd / w : NaN };
      };
      const t0 = +st.qt;
      if (!isFinite(t0)) return { err: 'Enter the time t.' };
      return { at, x0: t0, xs: [Math.min(0, t0), Math.max(t0 * 1.25, t0 + 1)], by: 't' };
    }
    const fr = C(st.qr, 'r = f(θ)', ['θ', 'theta', 'u']), fz = C(st.qz, 'z = h(θ)', ['θ', 'theta', 'u']);
    if (err.length) return { err: err.join(' ') };
    const R = (q) => fr({ θ: q, theta: q, u: q }), Z = (q) => fz({ θ: q, theta: q, u: q });
    const rate = st.qrate === 'speed' || st.qrate === 'force' ? st.qrate : 'rate', w0 = +st.qw, al0 = +st.qa, v0 = +st.qv, vd0 = +st.qvd, Pt = +st.qPt;
    if (rate === 'rate' && !(isFinite(w0) && isFinite(al0))) return { err: 'Enter θ̇ and θ̈.' };
    if (rate === 'speed' && !(v0 > 0 && isFinite(vd0))) return { err: 'Enter the speed (above zero) and its rate of change.' };
    if (rate === 'force' && !(v0 >= 0 && isFinite(Pt) && String(st.qPt).trim() !== '' && String(st.qv).trim() !== '')) return { err: 'Enter the force along the path P_t and the speed (zero or above, moving toward increasing θ).' };
    const at = (q) => {
      const [r, r1, r2] = Formula.d012(R, q), [z, z1, z2] = Formula.d012(Z, q);
      let w = w0, al = al0, vd, tan;
      if (rate === 'speed') ({ w, al } = speedRates(v0, vd0, r, r1, r2, z1, z2));
      if (rate === 'force') {
        // ΣF_t = m a_t along the tangent t̂ = (r′, r, z′)/√S; the smooth guide's normal force has no part along t̂.
        const sq = Math.sqrt(r1 * r1 + r * r + z1 * z1), G = gravity(p.m, p.g, p.vert, q), Fs = p.spr ? p.kk * (r - p.L0) : 0;
        tan = { P: Pt, W: (G[0] * r1 + G[1] * r + G[2] * z1) / sq, S: (-Fs * r1) / sq };
        vd = (tan.P + tan.W + tan.S) / p.m;
        ({ w, al } = speedRates(v0, vd, r, r1, r2, z1, z2));
      }
      return { th: q, r, rd: r1 * w, rdd: r2 * w * w + r1 * al, w, al, z, zd: z1 * w, zdd: z2 * w * w + z1 * al, dr: r1, vd, tan };
    };
    const q0 = +st.qth * D2R;
    if (!isFinite(q0)) return { err: 'Enter the angle θ at the instant.' };
    return { at, x0: q0, xs: [0, 2 * Math.PI], by: 'θ' };
  }

  /** Everything at one point: accelerations, the applied force, and its split for the chosen task. */
  function forcesAt(k, p) {
    const { m, g, vert, spr, kk, L0, find } = p;
    const ar = k.rdd - k.r * k.w * k.w, ath = k.r * k.al + 2 * k.rd * k.w, az = k.zdd;
    const [Gr, Gth, Gz] = gravity(m, g, vert, k.th);
    const Fs = spr ? kk * (k.r - L0) : 0; // spring tension pulls toward O
    const Rr = m * ar - Gr + Fs, Rth = m * ath - Gth, Rz = m * az - Gz;
    const vr = k.rd, vth = k.r * k.w, vin = Math.hypot(vr, vth);
    // in-plane tangent and normal (normal on the side away from O)
    let tr, tth;
    if (vin > 1e-12) { tr = vr / vin; tth = vth / vin; } else { const L = Math.hypot(k.dr, k.r) || 1; tr = k.dr / L; tth = k.r / L; }
    let nr = tth, nth = -tr;
    if (nr < 0) { nr = -nr; nth = -nth; }
    const psi = Math.atan2(k.r, k.dr);
    const o = { ar, ath, az, Gr, Gth, Gz, Fs, Rr, Rth, Rz, tr, tth, nr, nth, psi, v: Math.hypot(vr, vth, k.zd) };
    if (find === 'path') { o.P = Rr * tr + Rth * tth; o.N = Rr * nr + Rth * nth; }
    if (find === 'arm') {
      if (Math.abs(nr) < 1e-9) return Object.assign(o, { bad: 'The path runs along the arm here, so the arm and the path cannot share the load.' });
      o.N = Rr / nr; o.F = Rth - o.N * nth;
    }
    if (find === 'cable') {
      // the cable runs from a height h above O down to the particle and pulls toward O at φ below the horizontal
      o.phi = Math.atan2(p.hc, k.r); o.T = -Rr / Math.cos(o.phi); o.N = Rz - o.T * Math.sin(o.phi);
    }
    // differences of nearly equal numbers leave rounding noise: show it as zero
    const sc = 1e-9 * Math.max(m * g, Math.abs(Rr), Math.abs(Rth), Math.abs(Rz), Math.abs(Fs));
    ['Rr', 'Rth', 'Rz', 'P', 'N', 'F', 'T'].forEach((key) => { if (typeof o[key] === 'number' && Math.abs(o[key]) < sc) o[key] = 0; });
    return o;
  }

  function solve(st, u) {
    const S = Steps(), out = [], warn = [];
    const m = DY.toBase(+st.qm, 'M', u), vert = st.qplane === 'vertical', spr = !!st.qspr, kk = +st.qk, L0 = +st.qL0, find = st.qfind || 'comp', hc = +st.qhc;
    const central = st.qgiven === 'central', force = st.qgiven !== 'time' && !central && st.qrate === 'force';
    if (central && vert) return fail('With r²θ̇ constant there is no force along θ̂, but in a vertical plane the weight has a part along θ̂. Choose a horizontal plane.');
    if (find === 'cable' && vert) return fail('The cable pulls from a point above O onto a level surface, so it needs a horizontal plane. Choose a horizontal plane.');
    if (find === 'cable' && !(hc >= 0)) return fail('Enter the height of the fixed end of the cable above O (zero or above).');
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the particle.`);
    if (spr && !(kk >= 0 && L0 >= 0)) return fail('Enter the spring stiffness and its unstretched length.');
    const p = { m, g: u.g, vert, spr, kk, L0, find, hc };
    const B = build(st, p);
    if (B.err) return fail(B.err);
    const k = B.at(B.x0);
    if (![k.r, k.rd, k.rdd, k.w, k.al, k.z, k.zd, k.zdd].every(isFinite)) return fail('The formulas cannot be evaluated at this instant. Check them and the angle or time.');
    if (find === 'cable' && !(k.r > 0)) return fail('The particle must be away from O (r above zero) for the cable to have a direction.');
    if (vert && (Math.abs(k.z) > 1e-12 || Math.abs(k.zd) > 1e-12)) warn.push('In a vertical plane z is ignored (the motion stays in the plane).');
    const f = forcesAt(k, p);
    if (f.bad) return fail(f.bad);
    const L = u.L, A = u.A, F = u.F, deg = (x) => fmt(x / D2R);
    if (central) {
      const c = B.central;
      if (Math.abs(c.rStart - c.r0) > 1e-6 * c.r0) warn.push(`r(t) at t = 0 is ${fmt(c.rStart)} ${L}, not r₀ = ${fmt(c.r0)} ${L}. The constant C is taken from r₀ and θ̇₀ as entered.`);
      S.add({ t: 'Radial motion at the instant', n: `From r(t) = ${st.qrt} at t = ${fmt(B.x0)} s.`, f: 'ṙ = dr/dt,  r̈ = d²r/dt²', r: `r = ${fmt(k.r)} ${L}, ṙ = ${fmt(k.rd)} ${u.V}, r̈ = ${fmt(k.rdd)} ${A}` });
      S.add({ t: 'Angular momentum about O is conserved', n: 'No force acts along θ̂, so ΣF_θ = m a_θ = 0, and a_θ = rθ̈ + 2ṙθ̇ = (1/r) d(r²θ̇)/dt. Integrating, r²θ̇ stays constant.',
        f: 'r²θ̇ = C = r₀²θ̇₀;   θ̇ = C/r²;   θ̈ = −2ṙθ̇/r', s: `C = (${fmt(c.r0)})²(${fmt(c.w0)}) = ${fmt(c.C)} ${L}²/s;  θ̇ = ${fmt(c.C)}/(${fmt(k.r)})²;  θ̈ = −2(${fmt(k.rd)})(${fmt(k.w)})/${fmt(k.r)}`,
        r: `θ̇ = ${fmt(k.w)} rad/s, θ̈ = ${fmt(k.al)} rad/s² (θ = ${deg(k.th)}° turned since t = 0)` });
    } else if (B.by === 't') S.add({ t: 'Motion at the instant', n: `From r(t) = ${st.qrt}, θ(t) = ${st.qtt}${String(st.qzt).trim() !== '0' ? `, z(t) = ${st.qzt}` : ''} at t = ${fmt(B.x0)} s.`, f: 'Differentiate each with respect to t', r: `r = ${fmt(k.r)} ${L}, ṙ = ${fmt(k.rd)}, r̈ = ${fmt(k.rdd)}; θ = ${deg(k.th)}°, θ̇ = ${fmt(k.w)} rad/s, θ̈ = ${fmt(k.al)} rad/s²; z = ${fmt(k.z)}, ż = ${fmt(k.zd)}, z̈ = ${fmt(k.zdd)}` });
    else {
      if (force) {
        S.add({ t: 'Direction of the path', f: 'tan ψ = r/(dr/dθ)', s: `tan ψ = ${fmt(k.r)}/${fmt(k.dr)}`, r: `ψ = ${deg(f.psi)}° from the extended radial line to the tangent, which is the line of the force P_t` });
        const parts = [fmt(k.tan.P)].concat(vert ? [`(${fmt(k.tan.W)})`] : [], spr ? [`(${fmt(k.tan.S)})`] : []);
        S.add({ t: 'Rate of change of speed', n: `ΣF_t = m a_t along the tangent (+ toward increasing θ). The normal force of the smooth guide is across the path, so it does not appear.${vert || spr ? ' The weight and the spring add their parts along the tangent.' : ''}`,
          f: `ΣF_t = m a_t:  P_t${vert ? ' + W_t' : ''}${spr ? ' + (F_s)_t' : ''} = m v̇`, s: `${parts.join(' + ')} = ${fmt(m)} v̇`, r: `a_t = v̇ = ${fmt(k.vd)} ${A}` });
      }
      if (st.qrate === 'speed' || force) S.add({ t: 'θ̇ and θ̈ from the speed', f: 'v² = θ̇²[(dr/dθ)² + r² + (dz/dθ)²],  v̇ = d/dt(v)', s: `v = ${fmt(+st.qv)} ${u.V}, v̇ = ${fmt(force ? k.vd : +st.qvd)} ${A}`, r: `θ̇ = ${fmt(k.w)} rad/s, θ̈ = ${fmt(k.al)} rad/s²` });
      S.add({ t: 'Time derivatives by the chain rule', n: `r = ${st.qr}${String(st.qz).trim() !== '0' ? `, z = ${st.qz}` : ''} at θ = ${fmt(+st.qth)}°.`, f: 'ṙ = (dr/dθ)θ̇,  r̈ = (d²r/dθ²)θ̇² + (dr/dθ)θ̈  (z the same way)', r: `r = ${fmt(k.r)} ${L}, ṙ = ${fmt(k.rd)} ${u.V}, r̈ = ${fmt(k.rdd)} ${A}${String(st.qz).trim() !== '0' ? `; ż = ${fmt(k.zd)}, z̈ = ${fmt(k.zdd)}` : ''}` });
    }
    S.add({ t: 'Acceleration components', f: 'a_r = r̈ − rθ̇²,  a_θ = rθ̈ + 2ṙθ̇,  a_z = z̈', s: `a_r = ${fmt(k.rdd)} − ${fmt(k.r)}(${fmt(k.w)})²;  a_θ = ${fmt(k.r)}(${fmt(k.al)}) + 2(${fmt(k.rd)})(${fmt(k.w)})`, r: `a_r = ${fmt(f.ar)}, a_θ = ${fmt(f.ath)}, a_z = ${fmt(f.az)} ${A}` });
    const known = [`weight W = ${fmt(m * u.g)} ${F}${vert ? ' (components −W sin θ along r, −W cos θ along θ)' : ' along −z'}`];
    if (spr) known.push(`spring F_s = k(r − L₀) = ${fmt(kk)}(${fmt(k.r)} − ${fmt(L0)}) = ${fmt(f.Fs)} ${F} toward O`);
    S.add({ t: 'Known forces', n: known.join('; ') + '.' });
    S.add({ t: 'Force needed besides these', f: 'R = m a − W' + (spr ? ' + F_s r̂' : ''), r: `R_r = ${fmt(f.Rr)}, R_θ = ${fmt(f.Rth)}${vert ? '' : `, R_z = ${fmt(f.Rz)}`} ${F}` });
    out.push({ k: 'Radial acceleration a_r', v: f.ar, u: A }, { k: 'Transverse acceleration a_θ', v: f.ath, u: A });
    if (!vert) out.push({ k: 'Vertical acceleration a_z', v: f.az, u: A });
    out.push({ k: 'Speed v', v: f.v, u: u.V });
    if (central || force) out.push({ k: 'Angular velocity θ̇', v: k.w, u: 'rad/s' }, { k: 'Angular acceleration θ̈', v: k.al, u: 'rad/s²' });
    if (force) out.push({ k: 'Tangential acceleration a_t = v̇', v: k.vd, u: A, hl: true });
    if (find === 'comp') {
      out.push({ k: 'F_r', v: f.Rr, u: F, hl: !force }, { k: 'F_θ', v: f.Rth, u: F, hl: !force });
      if (!vert) out.push({ k: 'F_z', v: f.Rz, u: F, hl: !force });
      if (force) out.push({ k: 'Angle ψ from r to the tangent', v: f.psi / D2R, u: '°' });
    } else if (find === 'cable') {
      S.add({ t: 'Cable', n: `The cable runs from a point ${fmt(hc)} ${L} above O down to the particle, so it pulls toward O at φ below the horizontal. The level surface pushes up with N.`,
        f: 'φ = tan⁻¹(h/r);   ΣF_r:  −T cos φ = R_r;   ΣF_z:  N + T sin φ = R_z', s: `φ = tan⁻¹(${fmt(hc)}/${fmt(k.r)}) = ${deg(f.phi)}°;  −T cos ${deg(f.phi)}° = ${fmt(f.Rr)};  N = ${fmt(f.Rz)} − T sin ${deg(f.phi)}°`,
        r: `T = ${fmt(f.T)} ${F}, N = ${fmt(f.N)} ${F}` });
      out.push({ k: 'Cable tension T', v: f.T, u: F, hl: true }, { k: 'Cable angle φ below the horizontal', v: f.phi / D2R, u: '°' }, { k: 'Normal force of the surface N', v: f.N, u: F });
      const sc = 1e-6 * Math.max(m * u.g, Math.abs(f.Rr));
      if (!(f.T > sc)) warn.push(`The cable would have to push (T = ${fmt(f.T)} ${F}). A cable can only pull, so another radial force is needed.`);
      if (Math.abs(f.Rth) > sc) warn.push(`The cable pulls only toward O, so it cannot supply the transverse force R_θ = ${fmt(f.Rth)} ${F}; something else must.`);
      if (f.N < -sc) warn.push(`N = ${fmt(f.N)} ${F} is negative: the cable would lift the particle off the surface.`);
    } else {
      if (!force) S.add({ t: 'Direction of the path', f: 'tan ψ = r/(dr/dθ)', r: `ψ = ${deg(f.psi)}° from the radial line to the tangent` });
      out.push({ k: 'Angle ψ from r to the tangent', v: f.psi / D2R, u: '°' });
      if (find === 'path') {
        S.add({ t: 'Along and across the path', n: 'P pushes along the path (in the direction of motion); N is the normal force of the smooth guide, + away from O.', f: 'P = R·t̂,  N = R·n̂', r: `P = ${fmt(f.P)} ${F}, N = ${fmt(f.N)} ${F}` });
        out.push({ k: 'Push along the path P', v: f.P, u: F, hl: !force }, { k: 'Normal force of the guide N (+ away from O)', v: f.N, u: F, hl: !force });
      } else {
        S.add({ t: 'Arm and path', n: 'The smooth arm pushes along θ̂ (F); the smooth path or cam pushes along its normal n̂ (N, + away from O).', f: 'ΣF_r:  N n_r = R_r;   ΣF_θ:  F + N n_θ = R_θ', s: `n̂ = (${fmt(f.nr)}, ${fmt(f.nth)})`, r: `N = ${fmt(f.N)} ${F}, F = ${fmt(f.F)} ${F}` });
        out.push({ k: 'Force of the path N (+ away from O)', v: f.N, u: F, hl: !force }, { k: 'Force of the arm F (+ along θ̂)', v: f.F, u: F, hl: !force });
      }
      if (!vert) out.push({ k: 'F_z', v: f.Rz, u: F });
    }
    const head = force ? `a_t = ${fmt(k.vd)} ${A}, ψ = ${deg(f.psi)}°` : find === 'cable' ? `T = ${fmt(f.T)} ${F}, N = ${fmt(f.N)} ${F}` : find === 'comp' ? `F_r = ${fmt(f.Rr)}, F_θ = ${fmt(f.Rth)}${vert ? '' : `, F_z = ${fmt(f.Rz)}`} ${F}` : find === 'path' ? `P = ${fmt(f.P)} ${F}, N = ${fmt(f.N)} ${F}` : `N = ${fmt(f.N)} ${F}, F = ${fmt(f.F)} ${F}`;
    const series = (x) => { const kk2 = B.at(x); return [kk2, forcesAt(kk2, p)]; };
    return DY.result(head, warn.length ? 'warn' : 'ok', out, S, { scene: 'cyl', u, by: B.by, x0: B.x0, xs: B.xs, k, f, find, vert, spr, hc, series, span: B.by === 't' ? [B.xs[0], B.xs[1]] : [0, 1] }, warn);
  }

  const CylKin = { defaults, solve, convert, build, forcesAt, speedRates };
  root.CylKin = CylKin;
  if (typeof module !== 'undefined' && module.exports) module.exports = CylKin;
})(typeof window !== 'undefined' ? window : globalThis);
