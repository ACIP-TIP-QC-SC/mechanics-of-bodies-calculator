/* =====================================================================
 * DYNAMICS · Impulse and momentum beyond collisions (physics only; browser + Node). Used by Impact.
 * Hibbeler, Dynamics 15e, Chapter 15.
 *   ft      Impulse from a force–time graph: m v₁ + Σ∫F dt = m v₂ (15–4), the area under F–t, on a
 *           floor, incline or lift, with friction that is checked before the body moves.
 *   cons    Conservation of linear momentum of two bodies (15–6): a spring pushes them apart
 *           (with energy), one throws the other with a relative velocity, or a block slides onto a cart
 *           and friction brings them to a common speed.
 *   angmom  Angular impulse and momentum (15–12, 15–13): a moment M(t) turns particles on a light
 *           frame, or a cable pulls a particle in toward O (H_O conserved, then the work done).
 *   stream  Steady fluid streams (15–25, 15–26): ΣF = Σ ṁ v_out − Σ ṁ v_in with the pressure forces
 *           at the openings, ΣM_O likewise; optionally split into a pin and a roller.
 *   vary    Variable mass (15–28 … 15–30): m dv/dt = ΣF + ṁ_out u_rel − ṁ_in (v − v_in), for a body
 *           gaining mass (sand on a car), losing it (a rocket), or both (a jet engine).
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const Formula = root.Formula || require('../shared/formula.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B } = DY;
  const D2R = Math.PI / 180;

  const defaults = () => ({
    // force–time graph
    fm: 400, fth: 0, fmus: 0, fmuk: 0, fv1: 0, fn: 1, ft: 8, fpts: [{ t: 0, F: 0 }, { t: 5, F: 600 }, { t: 8, F: 750 }],
    // conservation of momentum
    ctask: 'release', cmA: 0.4, cmB: 0.6, ck: 30, cs: 0.2, cv0: 0, cvr: 2, cphi: 30, cdt: 1.5, cmuk: 0.6, cramp: true, ch: 0.2, cL: 2.5,
    // angular momentum
    atask: 'torque', an: 4, am: 5, ar: 4, aM: '5 t + 2', av1: 0, at: 4, ar1: 8, ardot: 0.5,
    // steady streams
    rho: 1000, ports: [{ io: 'in', x: 0, y: 0, v: 12, ang: 0, A: 0.05, p: 0 }, { io: 'out', x: 2, y: 0, v: 12, ang: 120, A: 0.05, p: 0 }], sup: 'none', px: 0, py: 0, qx: 2, qy: -1, qang: 90,
    // variable mass
    vm0: 2000, vv0: 4, vmi: 50, vvi: 0, vme: 0, vu: 0, vF: 0, vc: 0, vth: 0, vt: 10,
  });
  const KINDS = { fm: 'M', fv1: 'V', cmA: 'M', cmB: 'M', ck: 'K', cs: 'L', cv0: 'V', cvr: 'V', ch: 'L', cL: 'L', am: 'M', ar: 'L', av1: 'V', ar1: 'L', ardot: 'V', vm0: 'M', vv0: 'V', vmi: 'M', vvi: 'V', vme: 'M', vu: 'V', vF: 'F' };
  const PKINDS = { x: 'L', y: 'L', v: 'V' };
  function convert(st, from, to) {
    if (from === to) return st;
    DY.convertObj(st, KINDS, from, to);
    const L = DY.factor('L', from, to), F = DY.factor('F', from, to), slug = 14.593902937;
    (st.fpts || []).forEach((p) => { p.F = Core.tidy(+p.F * F, 6); });
    (st.ports || []).forEach((p) => { DY.convertObj(p, PKINDS, from, to); p.A = Core.tidy(+p.A * L * L, 6); p.p = Core.tidy(+p.p * F / (L * L), 6); });
    ['px', 'py', 'qx', 'qy'].forEach((k) => (st[k] = Core.tidy(+st[k] * L, 6)));
    st.rho = Core.tidy((+st.rho * (to === 'US' ? 1 / slug : slug)) / (L * L * L), 6);
    st.vc = Core.tidy((+st.vc * F) / (L * L), 6);
    if (typeof st.aM === 'string' && String(st.aM).trim() !== '0') st.aM = `${Core.tidy(F * L, 10)}*(${st.aM})`;
    return st;
  }

  function solve(st, u) {
    switch (st.mode) {
      case 'ft': return ftGraph(st, u);
      case 'cons': return conserve(st, u);
      case 'angmom': return angMom(st, u);
      case 'stream': return stream(st, u);
      default: return vary(st, u);
    }
  }

  /* ---------------- Impulse from a force–time graph ---------------- */
  function ftGraph(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = B(+st.fm, 'M', u), th = +st.fth * D2R, mus = +st.fmus || 0, muk = +st.fmuk || 0, v1 = +st.fv1 || 0, n = Math.max(1, Math.round(+st.fn || 1)), T = +st.ft;
    const pts = (st.fpts || []).map((p) => [+p.t, +p.F]).filter((p) => p.every(isFinite)).sort((a, b) => a[0] - b[0]);
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'}.`);
    if (pts.length < 2) return fail('Enter at least two points of the force–time graph.');
    if (!(T > 0)) return fail('Enter the time t₂.');
    if (!(th >= -Math.PI / 2 && th <= Math.PI / 2)) return fail('The angle must be from −90° to 90°.');
    if (mus < muk) warn.push('μ_s is normally at least μ_k.');
    const F = (t) => { if (t < pts[0][0] || t > pts[pts.length - 1][0]) return 0; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, f0] = pts[i - 1], [t1, f1] = pts[i]; return t1 > t0 ? f0 + ((f1 - f0) * (t - t0)) / (t1 - t0) : f1; } return 0; };
    // area under the graph from 0 to T (exact for straight segments)
    const area = (a, b) => { let s = 0; const N = 4000; for (let i = 0; i < N; i++) { const x0 = a + ((b - a) * i) / N, x1 = a + ((b - a) * (i + 1)) / N; s += 0.5 * (F(x0) + F(x1)) * (x1 - x0); } return s; };
    const W = m * g, Wx = W * Math.sin(th), N = W * Math.cos(th);
    // march in time: static friction holds until the drive exceeds μ_s N
    const steps = 20000, dt = T / steps, hist = [[0, v1, 0]];
    let v = v1, s = 0, start = Math.abs(v1) > 1e-12 ? 0 : null;
    for (let i = 0; i < steps; i++) {
      const t = i * dt, tm = t + dt / 2, D = n * F(tm) - Wx;
      if (Math.abs(v) < 1e-12) {
        if (Math.abs(D) <= mus * N + 1e-12) { v = 0; hist.push([t + dt, 0, s]); continue; }
        if (start === null) start = t;
        const a = (D - Math.sign(D) * muk * N) / m;
        v = a * dt; s += 0.5 * a * dt * dt;
      } else {
        const a = (D - Math.sign(v) * muk * N) / m, vn = v + a * dt;
        if (muk > 0 && Math.sign(vn) !== Math.sign(v) && Math.abs(D) <= muk * N + 1e-12) { const tc = -v / a; s += v * tc / 2; v = 0; }
        else { s += (v + vn) * dt / 2; v = vn; }
      }
      hist.push([t + dt, v, s]);
    }
    const I = area(0, T);
    S.add({ t: 'Free-body diagram', n: `${n > 1 ? `${n} cable segments carry F, so the pull on the body is ${n}F. ` : ''}Weight W = ${fmt(W)} ${u.F}${th ? ` on a ${fmt(+st.fth)}° ${Math.abs(+st.fth) >= 89.999 ? 'lift (vertical)' : 'incline'}` : ''}${N > 1e-9 && (mus || muk) ? `; N = W cos θ = ${fmt(N)} ${u.F}` : ''}. F is zero outside the graph.` });
    S.add({ t: 'Impulse of F', f: '∫F dt = area under the F–t graph', s: pts.map(([t, f]) => `(${fmt(t)} s, ${fmt(f)})`).join(' → '), r: `∫₀^${fmt(T)} F dt = ${fmt(I)} ${u.IMP}` });
    if (mus || muk) S.add({ t: 'When it starts to move', f: `${n > 1 ? n : ''}F − W sin θ > μ_s N`, r: start === null ? 'It never moves.' : `at t = ${fmt(start)} s` });
    if (!(mus || muk)) {
      S.add({ t: 'Impulse and momentum', f: `m v₁ + ${n > 1 ? n : ''}∫F dt${th ? ' − W sin θ (t₂ − t_s)' : ''}${muk ? ' − μ_k N (t₂ − t_s)' : ''} = m v₂`, s: `${fmt(m)}(${fmt(v1)}) + ${n > 1 ? n + '(' : ''}${fmt(I)}${n > 1 ? ')' : ''}${th ? ` − ${fmt(Wx)}(${fmt(T)})` : ''}`, r: `v₂ = ${fmt(v)} ${u.V}` });
    } else if (start === null) S.add({ t: 'Impulse and momentum', n: 'Static friction holds it the whole time.', r: 'v₂ = 0' });
    else S.add({ t: 'Impulse and momentum while it slides', n: 'Friction acts only while it slides, so the time is split where the motion starts (and stops); the velocity is found step by step.', f: 'm v₁ + Σ∫F dt = m v₂', r: `v₂ = ${fmt(v)} ${u.V}` });
    S.add({ t: 'Distance', f: 's = ∫v dt', r: `s = ${fmt(s)} ${u.L}` });
    out.push({ k: 'Velocity at t₂, v₂', v, u: u.V, hl: true }, { k: 'Distance travelled', v: s, u: u.L, hl: true }, { k: 'Impulse of F, ∫F dt', v: I, u: u.IMP });
    if (start !== null && start > 0) out.push({ k: 'Starts to move at', v: start, u: 's' });
    return DY.result(`v₂ = ${fmt(v)} ${u.V}, s = ${fmt(s)} ${u.L}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'ft', u, pts, F, hist, T, m, th: +st.fth, n, v, s, start, span: [0, T] }, warn);
  }

  /* ---------------- Conservation of linear momentum ---------------- */
  function conserve(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const mA = B(+st.cmA, 'M', u), mB = B(+st.cmB, 'M', u), v0 = +st.cv0 || 0;
    if (!(mA > 0 && mB > 0)) return fail(`Enter both ${u.us ? 'weights' : 'masses'}.`);
    if (st.ctask === 'release') {
      const k = +st.ck, s = +st.cs;
      if (!(k > 0 && s > 0)) return fail('Enter the spring stiffness and how far it is compressed.');
      S.add({ t: 'The system A + B', n: 'No horizontal force acts on A and B together (the spring is inside the system), so their linear momentum is conserved; the spring is the only source of energy.' });
      const E = 0.5 * k * s * s, vA = v0 - Math.sqrt((2 * E * mB) / (mA * (mA + mB))), vB = v0 + Math.sqrt((2 * E * mA) / (mB * (mA + mB)));
      S.add({ t: 'Conservation of energy', f: '½ks² = ½m_A(v_A − v₀)² + ½m_B(v_B − v₀)²  (relative to the common start)', s: `½(${fmt(k)})(${fmt(s)})² = ${fmt(E)} ${u.E}` });
      S.add({ t: 'Conservation of momentum', f: '(m_A + m_B)v₀ = m_A v_A + m_B v_B', r: `v_A = ${fmt(vA)}, v_B = ${fmt(vB)} ${u.V}` });
      out.push({ k: 'Velocity of A after release', v: vA, u: u.V, hl: true }, { k: 'Velocity of B after release', v: vB, u: u.V, hl: true }, { k: 'Spring energy', v: E, u: u.E });
      return DY.result(`v_A = ${fmt(vA)}, v_B = ${fmt(vB)} ${u.V}`, 'ok', out, S, { mode: 'cons', task: 'release', u, mA, mB, vA, vB, v0, span: [0, 1] }, warn);
    }
    if (st.ctask === 'throw') {
      const vr = +st.cvr, phi = +st.cphi * D2R, dt = +st.cdt;
      if (!(vr > 0)) return fail('Enter the speed of B relative to A.');
      const vA = v0 - (mB * vr * Math.cos(phi)) / (mA + mB), vBx = vA + vr * Math.cos(phi), vBy = vr * Math.sin(phi);
      S.add({ t: 'Relative velocity', f: 'v_B = v_A + v_B/A', s: `(v_B)_x = v_A + ${fmt(vr)} cos ${fmt(+st.cphi)}°, (v_B)_y = ${fmt(vr)} sin ${fmt(+st.cphi)}°` });
      S.add({ t: 'Horizontal momentum (no horizontal force)', f: '(m_A + m_B)v₀ = m_A v_A + m_B (v_B)_x', s: `${fmt(mA + mB)}(${fmt(v0)}) = ${fmt(mA)} v_A + ${fmt(mB)}(v_A + ${fmt(vr * Math.cos(phi))})`, r: `v_A = ${fmt(vA)} ${u.V}` });
      out.push({ k: 'Velocity of A (horizontal)', v: vA, u: u.V, hl: true }, { k: 'Velocity of B, horizontal', v: vBx, u: u.V }, { k: 'Velocity of B, vertical', v: vBy, u: u.V });
      if (dt > 0) {
        const Nv = (mA + mB) * g + (mB * vBy) / dt;
        S.add({ t: 'Average vertical reaction during the throw', f: 'N Δt − (m_A + m_B) g Δt = m_B (v_B)_y', s: `N = ${fmt((mA + mB) * g)} + ${fmt(mB)}(${fmt(vBy)})/${fmt(dt)}`, r: `N = ${fmt(Nv)} ${u.F}` });
        out.push({ k: 'Average vertical reaction under A', v: Nv, u: u.F });
      }
      return DY.result(`v_A = ${fmt(vA)} ${u.V}`, 'ok', out, S, { mode: 'cons', task: 'throw', u, mA, mB, vA, vBx, vBy, v0, phi: +st.cphi, span: [0, 1] }, warn);
    }
    // a block slides onto a cart
    const muk = +st.cmuk;
    if (!(muk > 0)) return fail('Enter the kinetic friction between the block and the cart.');
    let vb = v0;
    if (st.cramp) {
      const h = +st.ch; if (!(h > 0)) return fail('Enter the height of the ramp.');
      vb = Math.sqrt(2 * g * h);
      S.add({ t: 'Down the smooth ramp', f: 'T₁ + V₁ = T₂ + V₂:  v = √(2gh)', r: `v = ${fmt(vb)} ${u.V}` });
    }
    if (!(vb > 0)) return fail('Enter the speed of the block as it reaches the cart.');
    const v = (mA * vb) / (mA + mB), t = (vb - v) / (muk * g), d = (vb * vb) / (2 * muk * g * (1 + mA / mB));
    S.add({ t: 'Conservation of momentum (block and cart)', f: 'm_A v = (m_A + m_B) v₂', r: `v₂ = ${fmt(v)} ${u.V}` });
    S.add({ t: 'Impulse on the block', f: 'm_A v − μ_k m_A g t = m_A v₂', r: `t = ${fmt(t)} s` });
    S.add({ t: 'Slide on the cart', n: 'Relative to the cart the block slows at μ_k g(1 + m_A/m_B).', f: 'd = v²/(2μ_k g(1 + m_A/m_B))', r: `d = ${fmt(d)} ${u.L}` });
    out.push({ k: 'Common final velocity', v, u: u.V, hl: true }, { k: 'Time to stop sliding', v: t, u: 's' }, { k: 'Distance slid on the cart', v: d, u: u.L, hl: true });
    const L = +st.cL;
    if (L > 0) { out.push({ k: 'Position from the far end, L − d', v: L - d, u: u.L }); if (d > L) warn.push('The block slides off the end of the cart.'); }
    out.push({ k: 'Speed of the block onto the cart', v: vb, u: u.V });
    return DY.result(`v₂ = ${fmt(v)} ${u.V}, slides ${fmt(d)} ${u.L}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'cons', task: 'slide', u, mA, mB, vb, v, t, d, L, span: [0, t] }, warn);
  }

  /* ---------------- Angular impulse and momentum ---------------- */
  function angMom(st, u) {
    const S = Steps(), out = [], warn = [];
    const m = B(+st.am, 'M', u);
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of each particle.`);
    if (st.atask === 'pull') {
      const r1 = +st.ar1, v1 = +st.av1, rd = +st.ardot, t = +st.at, r2 = r1 - rd * t;
      if (!(r1 > 0 && v1 >= 0 && rd >= 0 && t >= 0)) return fail('Enter the starting radius and speed, the pull-in rate and the time.');
      if (!(r2 > 0)) return fail('The cable would be pulled all the way in before that time.');
      const vt = (r1 * v1) / r2, v2 = Math.hypot(vt, rd), U = 0.5 * m * (v2 * v2 - v1 * v1);
      S.add({ t: 'Radius at t', f: 'r₂ = r₁ − ṙ t', r: `r₂ = ${fmt(r2)} ${u.L}` });
      S.add({ t: 'Angular momentum about O is conserved', n: 'The cable force passes through O, so it has no moment about O.', f: 'r₁ m v₁ = r₂ m (v₂)_t', r: `(v₂)_t = ${fmt(vt)} ${u.V}` });
      S.add({ t: 'Speed', f: 'v₂ = √((v₂)_t² + ṙ²)', r: `v₂ = ${fmt(v2)} ${u.V}` });
      S.add({ t: 'Work done pulling the cable', f: 'T₁ + ΣU = T₂', r: `ΣU = ${fmt(U)} ${u.E}` });
      out.push({ k: 'Speed at t, v₂', v: v2, u: u.V, hl: true }, { k: 'Transverse speed (v₂)_t', v: vt, u: u.V }, { k: 'Work done on the cable', v: U, u: u.E, hl: true });
      return DY.result(`v₂ = ${fmt(v2)} ${u.V}, ΣU = ${fmt(U)} ${u.E}`, 'ok', out, S, { mode: 'angmom', task: 'pull', u, r1, r2, v1, vt, span: [0, t] }, warn);
    }
    const n = Math.max(1, Math.round(+st.an || 1)), r = +st.ar, v1 = +st.av1 || 0, t = +st.at;
    if (!(r > 0 && t > 0)) return fail('Enter the radius and the time.');
    let Mf;
    try { const f = Formula.compile(st.aM, new Set(['t'])); Mf = (x) => f({ t: x }); } catch (e) { return fail(`Moment M(t): ${e.message}.`); }
    // Gauss–Legendre, 5 points on 40 panels
    const GX = [-0.9061798459, -0.5384693101, 0, 0.5384693101, 0.9061798459], GW = [0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851];
    let I = 0; const P = 40;
    for (let k = 0; k < P; k++) { const a = (t * k) / P, b = (t * (k + 1)) / P; for (let j = 0; j < 5; j++) I += ((b - a) / 2) * GW[j] * Mf((a + b) / 2 + ((b - a) / 2) * GX[j]); }
    if (!isFinite(I)) return fail('The moment M(t) cannot be evaluated over that time.');
    const v2 = v1 + I / (n * m * r);
    S.add({ t: 'Free-body diagram', n: `The frame is light. The moment M and the reaction of the axle act on it; the reaction passes through the axis, so only M has a moment. Each of the ${n} particles is ${fmt(r)} ${u.L} from the axis.` });
    S.add({ t: 'Angular impulse of M', f: '∫M dt', s: `M = ${st.aM}, from 0 to ${fmt(t)} s`, r: `∫M dt = ${fmt(I)} ${u.MO}·s` });
    S.add({ t: 'Angular impulse and momentum about the axis', f: '(H_O)₁ + ∫M dt = (H_O)₂:  n(r m v₁) + ∫M dt = n(r m v₂)', s: `${n}(${fmt(r)})(${fmt(m)})(${fmt(v1)}) + ${fmt(I)} = ${n}(${fmt(r)})(${fmt(m)}) v₂`, r: `v₂ = ${fmt(v2)} ${u.V}` });
    out.push({ k: 'Speed of each particle at t, v₂', v: v2, u: u.V, hl: true }, { k: 'Angular impulse ∫M dt', v: I, u: `${u.MO}·s` }, { k: 'Angular velocity ω₂', v: v2 / r, u: 'rad/s' });
    return DY.result(`v₂ = ${fmt(v2)} ${u.V}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'angmom', task: 'torque', u, n, r, v1, v2, t, span: [0, t] }, warn);
  }

  /* ---------------- Steady fluid streams ---------------- */
  function stream(st, u) {
    const S = Steps(), out = [], warn = [];
    const rho = +st.rho, ports = (st.ports || []).filter((p) => p && isFinite(+p.v));
    if (!(rho > 0)) return fail('Enter the density of the fluid.');
    if (ports.length < 2) return fail('A stream needs at least one opening in and one out.');
    const PU = u.us ? 'lb/ft²' : 'Pa', QU = u.us ? 'ft³/s' : 'm³/s';
    let Fx = 0, Fy = 0, M = 0, Qin = 0, Qout = 0;
    const rows = [];
    for (const [i, p] of ports.entries()) {
      const v = +p.v, A = +p.A, pr = +p.p || 0, a = +p.ang * D2R, x = +p.x || 0, y = +p.y || 0, sg = p.io === 'in' ? -1 : 1;
      if (!(v > 0 && A > 0)) return fail(`Opening ${i + 1}: enter a speed and an area above zero.`);
      const Q = v * A, md = rho * Q, ex = Math.cos(a), ey = Math.sin(a);
      // force on the fluid needed: Σ ṁ v_out − Σ ṁ v_in; the pressure at an opening pushes on the fluid inward
      const fx = sg * md * v * ex + sg * pr * A * ex, fy = sg * md * v * ey + sg * pr * A * ey;
      Fx += fx; Fy += fy; M += x * fy - y * fx;
      if (sg < 0) Qin += Q; else Qout += Q;
      rows.push([`${i + 1} (${p.io})`, fmt(Q), fmt(md), `${fmt(v)} at ${fmt(+p.ang)}°`, fmt(pr)]);
    }
    if (Math.abs(Qin - Qout) > 1e-6 * Math.max(Qin, Qout)) warn.push(`The flow in (${fmt(Qin)} ${QU}) and out (${fmt(Qout)} ${QU}) differ: check the speeds and areas.`);
    S.add({ t: 'Flow at each opening', f: 'Q = vA,  ṁ = ρQ', table: { head: ['Opening', `Q (${QU})`, `ṁ (${u.us ? 'slug' : 'kg'}/s)`, 'v', `p (${PU})`], rows } });
    S.add({ t: 'Force on the device (from its supports)', n: 'Weights of the device and the fluid are neglected; gage pressures push inward on the control volume at each opening.', f: 'ΣF = Σ ṁ v_out − Σ ṁ v_in, with the pressure forces p A', r: `F_x = ${fmt(Fx)}, F_y = ${fmt(Fy)} ${u.F}` });
    S.add({ t: 'Moment about O', f: 'ΣM_O = Σ r × ṁ v_out − Σ r × ṁ v_in (+ the pressure forces)', r: `M_O = ${fmt(M)} ${u.MO} (+ counterclockwise)` });
    out.push({ k: 'Support force F_x', v: Fx, u: u.F, hl: true }, { k: 'Support force F_y', v: Fy, u: u.F, hl: true }, { k: 'Resultant support force', v: Math.hypot(Fx, Fy), u: u.F }, { k: 'Support moment about O, M_O', v: M, u: u.MO });
    let sup = null;
    if (st.sup === 'pinroller') {
      const px = +st.px, py = +st.py, qx = +st.qx, qy = +st.qy, qa = +st.qang * D2R, d = [Math.cos(qa), Math.sin(qa)];
      const Mp = M - (px * Fy - py * Fx), arm = (qx - px) * d[1] - (qy - py) * d[0];
      if (Math.abs(arm) < 1e-12) return fail('The roller reaction passes through the pin, so the two cannot hold the moment.');
      const Nr = Mp / arm, Dx = Fx - Nr * d[0], Dy = Fy - Nr * d[1];
      S.add({ t: 'Pin and roller', f: 'ΣM_pin: N (arm) = M_pin;  then D = F − N', s: `M_pin = ${fmt(Mp)}, arm = ${fmt(arm)}`, r: `N = ${fmt(Nr)} ${u.F}; D_x = ${fmt(Dx)}, D_y = ${fmt(Dy)} ${u.F}` });
      out.push({ k: 'Roller reaction N', v: Nr, u: u.F, hl: true }, { k: 'Pin reaction D_x', v: Dx, u: u.F, hl: true }, { k: 'Pin reaction D_y', v: Dy, u: u.F, hl: true });
      sup = { px, py, qx, qy, d, Nr, Dx, Dy };
    }
    return DY.result(`F_x = ${fmt(Fx)}, F_y = ${fmt(Fy)} ${u.F}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'stream', u, ports: ports.map((p) => ({ io: p.io, x: +p.x || 0, y: +p.y || 0, v: +p.v, ang: +p.ang })), Fx, Fy, M, sup, span: [0, 1] }, warn);
  }

  /* ---------------- Variable mass ---------------- */
  function vary(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m0 = B(+st.vm0, 'M', u), v0 = +st.vv0 || 0, mi = B(+st.vmi || 0, 'M', u), vi = +st.vvi || 0, me = B(+st.vme || 0, 'M', u), ue = +st.vu || 0, F = +st.vF || 0, c = +st.vc || 0, th = +st.vth * D2R, T = +st.vt;
    if (!(m0 > 0)) return fail(`Enter the starting ${u.us ? 'weight' : 'mass'}.`);
    if (!(mi >= 0 && me >= 0)) return fail('Mass rates cannot be negative.');
    if (!(T >= 0)) return fail('Enter the time.');
    const mOf = (t) => m0 + (mi - me) * t;
    if (mOf(T) <= 0) return fail('All the mass would be used up before that time.');
    const acc = (t, v) => (F - mOf(t) * g * Math.sin(th) - c * v * Math.abs(v) + me * ue - mi * (v - vi)) / mOf(t);
    const a0 = acc(0, v0);
    let v = v0, s = 0; const N = 4000, h = T / N, hist = [[0, v0]];
    for (let i = 0; i < N; i++) { const t = i * h, k1 = acc(t, v), k2 = acc(t + h / 2, v + (h * k1) / 2), k3 = acc(t + h / 2, v + (h * k2) / 2), k4 = acc(t + h, v + h * k3); const vn = v + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4); s += (h * (v + vn)) / 2; v = vn; hist.push([t + h, v]); }
    S.add({ t: 'Equation of motion with mass flowing', f: 'ΣF = m dv/dt − ṁ_out u_rel + ṁ_in (v − v_in)', n: `m = m₀ + (ṁ_in − ṁ_out)t; ΣF = ${F ? 'F ' : ''}${th ? '− mg sin θ ' : ''}${c ? '− c v²' : ''}${!F && !th && !c ? '0' : ''}.` });
    S.add({ t: 'At the start', s: `a = [${fmt(F - m0 * g * Math.sin(th) - c * v0 * Math.abs(v0))} + ${fmt(me)}(${fmt(ue)}) − ${fmt(mi)}(${fmt(v0)} − ${fmt(vi)})]/${fmt(m0)}`, r: `a = ${fmt(a0)} ${u.A}` });
    if (!me && !F && !th && !c && mi > 0) S.add({ t: 'Closed form (gaining mass, no force)', f: `v = m₀(v₀ − v_in)/(m₀ + ṁ_in t) + v_in`, r: `v = ${fmt((m0 * (v0 - vi)) / (m0 + mi * T) + vi)} ${u.V}` });
    if (!mi && me > 0 && !c && !F) S.add({ t: 'Closed form (rocket)', f: 'v = v₀ + u_rel ln(m₀/m) − g sin θ t', r: `v = ${fmt(v0 + ue * Math.log(m0 / mOf(T)) - g * Math.sin(th) * T)} ${u.V}` });
    S.add({ t: `At t = ${fmt(T)} s`, f: 'dv/dt from the equation above, integrated step by step', r: `m = ${fmt(mOf(T))}, v = ${fmt(v)} ${u.V}, s = ${fmt(s)} ${u.L}` });
    out.push({ k: 'Acceleration at the start', v: a0, u: u.A, hl: true }, { k: `Velocity at t = ${fmt(T)} s`, v, u: u.V, hl: true }, { k: 'Distance travelled', v: s, u: u.L }, { k: 'Mass at that time', v: DY.fromBase(mOf(T), 'M', u), u: u.M });
    if (me > 0) out.push({ k: 'Thrust ṁ_out u_rel', v: me * ue, u: u.F });
    return DY.result(`a = ${fmt(a0)} ${u.A}; v = ${fmt(v)} ${u.V} at ${fmt(T)} s`, warn.length ? 'warn' : 'ok', out, S, { mode: 'vary', u, hist, m0, mOf, T, mi, me, span: [0, T] }, warn);
  }

  const Momentum = { defaults, solve, convert, KINDS };
  root.Momentum = Momentum;
  if (typeof module !== 'undefined' && module.exports) module.exports = Momentum;
})(typeof window !== 'undefined' ? window : globalThis);
