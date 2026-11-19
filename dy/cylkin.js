/* =====================================================================
 * DYNAMICS · Particle kinetics in cylindrical coordinates (physics only; browser + Node).
 * Used by Pkin (scene 'cyl'). Hibbeler, Dynamics 15e, Section 13.6.
 *   a_r = r̈ − rθ̇²,  a_θ = rθ̈ + 2ṙθ̇,  a_z = z̈                         (12–29)
 *   ΣF_r = m a_r,  ΣF_θ = m a_θ,  ΣF_z = m a_z                         (13–9)
 *   Angle from the radial line to the tangent: tan ψ = r/(dr/dθ)       (13–10)
 * The path is typed as r = f(θ) and z = h(θ) with θ̇ and θ̈ (or the speed and its rate) at the instant,
 * or as r(t), θ(t) and z(t). The motion may be in a horizontal plane (z up, gravity along −z) or in a
 * vertical plane (θ from the horizontal, gravity straight down). An optional spring from O along r.
 * The force needed besides gravity and the spring is reported three ways:
 *   comp  components F_r, F_θ, F_z;
 *   path  a push P along the path and the normal force N of a smooth guide (rod or tube);
 *   arm   a rotating arm (slotted or forked rod) pushing along θ̂, and a smooth path or cam pushing
 *         normal to the path.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const Formula = root.Formula || require('../shared/formula.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;

  const defaults = () => ({ qgiven: 'theta', qr: '0.2 cos θ + 0.3', qz: '0', qth: 30, qrate: 'rate', qw: 4, qa: 0, qv: 8, qvd: 0, qrt: '1.5', qtt: '0.7 t', qzt: '-0.5 t', qt: 2,
    qm: 2, qplane: 'vertical', qspr: true, qk: 30, qL0: 0.1, qfind: 'arm' });
  const KINDS = { qm: 'M', qk: 'K', qL0: 'L', qv: 'V', qvd: 'A' };
  /** Rewrite a length formula for a unit change: every value is multiplied by k. */
  const scaleF = (src, k) => (String(src).trim() === '0' || k === 1 ? src : `${Core.tidy(k, 12)}*(${src})`);
  function convert(st, from, to) {
    if (from === to) return st;
    DY.convertObj(st, KINDS, from, to);
    const k = Core.convert(1, from === 'SI' ? 'm' : 'ft', to === 'SI' ? 'm' : 'ft');
    ['qr', 'qz', 'qrt', 'qzt'].forEach((key) => { if (st[key] !== undefined) st[key] = scaleF(st[key], k); });
    return st;
  }

  /** Builds the motion: returns { at(x) → kinematics, x0, xs: [lo, hi] for the drawn range } or { err }. */
  function build(st) {
    const err = [];
    const C = (src, where, names) => { try { return Formula.compile(src === '' || src == null ? '0' : src, new Set(names)); } catch (e) { err.push(`${where}: ${e.message}.`); return null; } };
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
    const byRate = st.qrate !== 'speed', w0 = +st.qw, al0 = +st.qa, v0 = +st.qv, vd0 = +st.qvd;
    if (byRate && !(isFinite(w0) && isFinite(al0))) return { err: 'Enter θ̇ and θ̈.' };
    if (!byRate && !(v0 > 0 && isFinite(vd0))) return { err: 'Enter the speed (above zero) and its rate of change.' };
    const at = (q) => {
      const [r, r1, r2] = Formula.d012(R, q), [z, z1, z2] = Formula.d012(Z, q);
      let w = w0, al = al0;
      if (!byRate) {
        // v = θ̇√S with S = r′² + r² + z′²; v̇ = θ̈√S + θ̇² S′/(2√S)
        const S = r1 * r1 + r * r + z1 * z1, Sp = 2 * (r1 * r2 + r * r1 + z1 * z2), sq = Math.sqrt(S);
        w = v0 / sq; al = (vd0 - (w * w * Sp) / (2 * sq)) / sq;
      }
      return { th: q, r, rd: r1 * w, rdd: r2 * w * w + r1 * al, w, al, z, zd: z1 * w, zdd: z2 * w * w + z1 * al, dr: r1 };
    };
    const q0 = +st.qth * D2R;
    if (!isFinite(q0)) return { err: 'Enter the angle θ at the instant.' };
    return { at, x0: q0, xs: [0, 2 * Math.PI], by: 'θ' };
  }

  /** Everything at one point: accelerations, the applied force, and its split for the chosen task. */
  function forcesAt(k, p) {
    const { m, g, vert, spr, kk, L0, find } = p;
    const ar = k.rdd - k.r * k.w * k.w, ath = k.r * k.al + 2 * k.rd * k.w, az = k.zdd;
    // gravity: horizontal plane → along −z; vertical plane with θ from the horizontal → straight down
    const Gr = vert ? -m * g * Math.sin(k.th) : 0, Gth = vert ? -m * g * Math.cos(k.th) : 0, Gz = vert ? 0 : -m * g;
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
    // differences of nearly equal numbers leave rounding noise: show it as zero
    const sc = 1e-9 * Math.max(m * g, Math.abs(Rr), Math.abs(Rth), Math.abs(Rz), Math.abs(Fs));
    ['Rr', 'Rth', 'Rz', 'P', 'N', 'F'].forEach((key) => { if (typeof o[key] === 'number' && Math.abs(o[key]) < sc) o[key] = 0; });
    return o;
  }

  function solve(st, u) {
    const S = Steps(), out = [], warn = [];
    const B = build(st);
    if (B.err) return fail(B.err);
    const m = DY.toBase(+st.qm, 'M', u), vert = st.qplane === 'vertical', spr = !!st.qspr, kk = +st.qk, L0 = +st.qL0, find = st.qfind || 'comp';
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the particle.`);
    if (spr && !(kk >= 0 && L0 >= 0)) return fail('Enter the spring stiffness and its unstretched length.');
    const p = { m, g: u.g, vert, spr, kk, L0, find };
    const k = B.at(B.x0);
    if (![k.r, k.rd, k.rdd, k.w, k.al, k.z, k.zd, k.zdd].every(isFinite)) return fail('The formulas cannot be evaluated at this instant. Check them and the angle or time.');
    if (vert && (Math.abs(k.z) > 1e-12 || Math.abs(k.zd) > 1e-12)) warn.push('In a vertical plane z is ignored (the motion stays in the plane).');
    const f = forcesAt(k, p);
    if (f.bad) return fail(f.bad);
    const L = u.L, A = u.A, F = u.F, deg = (x) => fmt(x / D2R);
    if (B.by === 't') S.add({ t: 'Motion at the instant', n: `From r(t) = ${st.qrt}, θ(t) = ${st.qtt}${String(st.qzt).trim() !== '0' ? `, z(t) = ${st.qzt}` : ''} at t = ${fmt(B.x0)} s.`, f: 'Differentiate each with respect to t', r: `r = ${fmt(k.r)} ${L}, ṙ = ${fmt(k.rd)}, r̈ = ${fmt(k.rdd)}; θ = ${deg(k.th)}°, θ̇ = ${fmt(k.w)} rad/s, θ̈ = ${fmt(k.al)} rad/s²; z = ${fmt(k.z)}, ż = ${fmt(k.zd)}, z̈ = ${fmt(k.zdd)}` });
    else {
      if (st.qrate === 'speed') S.add({ t: 'θ̇ and θ̈ from the speed', f: 'v² = θ̇²[(dr/dθ)² + r² + (dz/dθ)²],  v̇ = d/dt(v)', s: `v = ${fmt(+st.qv)} ${u.V}, v̇ = ${fmt(+st.qvd)} ${A}`, r: `θ̇ = ${fmt(k.w)} rad/s, θ̈ = ${fmt(k.al)} rad/s²` });
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
    if (find === 'comp') {
      out.push({ k: 'F_r', v: f.Rr, u: F, hl: true }, { k: 'F_θ', v: f.Rth, u: F, hl: true });
      if (!vert) out.push({ k: 'F_z', v: f.Rz, u: F, hl: true });
    } else {
      S.add({ t: 'Direction of the path', f: 'tan ψ = r/(dr/dθ)', r: `ψ = ${deg(f.psi)}° from the radial line to the tangent` });
      out.push({ k: 'Angle ψ from r to the tangent', v: f.psi / D2R, u: '°' });
      if (find === 'path') {
        S.add({ t: 'Along and across the path', n: 'P pushes along the path (in the direction of motion); N is the normal force of the smooth guide, + away from O.', f: 'P = R·t̂,  N = R·n̂', r: `P = ${fmt(f.P)} ${F}, N = ${fmt(f.N)} ${F}` });
        out.push({ k: 'Push along the path P', v: f.P, u: F, hl: true }, { k: 'Normal force of the guide N (+ away from O)', v: f.N, u: F, hl: true });
      } else {
        S.add({ t: 'Arm and path', n: 'The smooth arm pushes along θ̂ (F); the smooth path or cam pushes along its normal n̂ (N, + away from O).', f: 'ΣF_r:  N n_r = R_r;   ΣF_θ:  F + N n_θ = R_θ', s: `n̂ = (${fmt(f.nr)}, ${fmt(f.nth)})`, r: `N = ${fmt(f.N)} ${F}, F = ${fmt(f.F)} ${F}` });
        out.push({ k: 'Force of the path N (+ away from O)', v: f.N, u: F, hl: true }, { k: 'Force of the arm F (+ along θ̂)', v: f.F, u: F, hl: true });
      }
      if (!vert) out.push({ k: 'F_z', v: f.Rz, u: F });
    }
    const head = find === 'comp' ? `F_r = ${fmt(f.Rr)}, F_θ = ${fmt(f.Rth)}${vert ? '' : `, F_z = ${fmt(f.Rz)}`} ${F}` : find === 'path' ? `P = ${fmt(f.P)} ${F}, N = ${fmt(f.N)} ${F}` : `N = ${fmt(f.N)} ${F}, F = ${fmt(f.F)} ${F}`;
    const series = (x) => { const kk2 = B.at(x); return [kk2, forcesAt(kk2, p)]; };
    return DY.result(head, warn.length ? 'warn' : 'ok', out, S, { scene: 'cyl', u, by: B.by, x0: B.x0, xs: B.xs, k, f, find, vert, spr, series, span: B.by === 't' ? [B.xs[0], B.xs[1]] : [0, 1] }, warn);
  }

  const CylKin = { defaults, solve, convert, build, forcesAt };
  root.CylKin = CylKin;
  if (typeof module !== 'undefined' && module.exports) module.exports = CylKin;
})(typeof window !== 'undefined' ? window : globalThis);
