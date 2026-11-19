/* =====================================================================
 * DYNAMICS · D7 Vibrations (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Sections 22.1 to 22.5.
 *   Undamped free: ẍ + ω_n²x = 0, ω_n = √(k/m), τ = 2π/ω_n, f = 1/τ        (22–1 to 22–5)
 *   Energy method: T + V = const ⇒ m_eq ẍ + k_eq x = 0                        (22.2)
 *   Undamped forced: x_p = (F₀/k)/(1 − (ω₀/ω_n)²) sin ω₀t; support δ₀ sin ω₀t  (22–22, 22–24)
 *   Viscous damped free: c_c = 2mω_n, ζ = c/c_c, ω_d = ω_n√(1 − ζ²)           (22–28 to 22–31)
 *   Damped forced: MF = X/(F₀/k) = 1/√([1 − r²]² + [2ζr]²), tan φ′ = 2ζr/(1 − r²)  (22–35, 22–36)
 *   Electrical analog (Table 22–1): Lq̈ + Rq̇ + q/C = E(t) with L ↔ m, R ↔ c, 1/C ↔ k, E ↔ F
 * Systems: a mass on springs (in parallel or in series, with dampers in parallel), a simple pendulum,
 * a body swinging on a pin (compound pendulum), a torsional pendulum, a block on a cord over a disk
 * held by a spring, a cylinder rolling against a spring, and a bar on a pin held by a spring and a
 * dashpot. Damping applies to the mass on springs and the bar; forcing to the mass on springs, which can
 * also be set moving by a projectile that embeds in it.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: Fm } = DY;
  const TAU = 2 * Math.PI, D2R = Math.PI / 180;

  function defaults() {
    return {
      sys: 'sm', m: 10, k: 1000, n: 1, arr: 'parallel', vert: false,
      L: 1, body: 'rod', len: 1, r: 0.15, a: 0.2, b: 0.3, kO: 0.3, dG: 0.3, kt: 1.5, md: 5, mb: 10, rs: 0.15, rb: 0.15,
      sa: 1, sb: 0.6,
      damp: 'none', c: 40, zeta: 0.1, nc: 1,
      exc: 'free', x0: 50, v0: 0.5, th0: 5, w0: 8, F0: 10, d0: 10, m0: 4, e: 60, mp: 0.02, vp: 300, xt: 0,
    };
  }
  const KINDS = { m: 'M', k: 'K', L: 'L', len: 'L', r: 'L', a: 'L', b: 'L', kO: 'L', dG: 'L', kt: 'KT', md: 'M', mb: 'M', rs: 'L', rb: 'L', c: 'CD', x0: 'S', v0: 'V', F0: 'F', d0: 'S', m0: 'M', e: 'S', sa: 'L', sb: 'L', mp: 'M', vp: 'V', xt: 'S' };
  function convertState(st, from, to) { return DY.convertObj(st, KINDS, from, to); }
  const BODY = {
    rod: { name: 'Slender rod pinned at one end', I: (m, s) => (m * s.len * s.len) / 3, d: (s) => s.len / 2, f: 'I_O = ⅓mL², d = L/2' },
    hoop: { name: 'Thin hoop hung on a peg', I: (m, s) => 2 * m * s.r * s.r, d: (s) => s.r, f: 'I_O = mr² + mr² = 2mr², d = r' },
    disk: { name: 'Disk pinned at its rim', I: (m, s) => 1.5 * m * s.r * s.r, d: (s) => s.r, f: 'I_O = ½mr² + mr² = 1.5mr², d = r' },
    kg: { name: 'Any body: k_G and d given', I: (m, s) => m * (s.kO * s.kO + s.dG * s.dG), d: (s) => s.dG, f: 'I_O = m(k_G² + d²)' },
  };
  const TBODY = { plate: { name: 'Rectangular plate a × b', I: (m, s) => (m * (s.a * s.a + s.b * s.b)) / 12, f: 'I = m(a² + b²)/12' }, disk: { name: 'Disk of radius r', I: (m, s) => (m * s.r * s.r) / 2, f: 'I = ½mr²' }, kg: { name: 'Radius of gyration k given', I: (m, s) => m * s.kO * s.kO, f: 'I = mk²' } };

  function solve(st, U) {
    const u = DY.units(U), S = Steps(), out = [], warn = [];
    const g = u.g, sys = st.sys;
    const num = (k) => +st[k];
    let mEq, kEq, coord = 'x', rot = false, geo = {}, vImp = null;
    if (sys === 'sm') {
      if (!(num('m') > 0) || !(num('k') > 0)) return fail('Enter the mass (or weight) and the spring stiffness.');
      const n = Math.round(num('n'));
      if (!(n >= 1 && n <= 8)) return fail('The number of springs must be a whole number from 1 to 8.');
      const m = B(num('m'), 'M', u), k = num('k');
      kEq = st.arr === 'series' ? k / n : k * n; mEq = m;
      if (st.exc === 'impact') {
        const mp = B(num('mp'), 'M', u), vp = num('vp');
        if (!(mp > 0) || !(vp > 0)) return fail('Enter the mass (or weight) and speed of the projectile.');
        mEq = m + mp; vImp = (mp * vp) / mEq;
        S.add({ t: 'Projectile embeds (conservation of momentum)', n: 'The impact is too short for the springs to act, so momentum is conserved; the block then starts from equilibrium with speed v′ towards the support (−x), compressing the springs.', f: 'm_p v_p = (m + m_p)v′', s: `${fmt(mp)}(${fmt(vp)}) = (${fmt(m)} + ${fmt(mp)})v′`, r: `v′ = ${fmt(vImp)} ${u.V}, vibrating mass ${DY.massTxt(mEq, u)}` });
      }
      S.add({ t: 'Equivalent spring', n: n === 1 ? 'One spring.' : st.arr === 'series' ? 'Springs in series carry the same force; their stretches add.' : 'Springs in parallel stretch the same amount; their forces add.',
        f: n === 1 ? 'k_eq = k' : st.arr === 'series' ? '1/k_eq = Σ 1/k' : 'k_eq = Σ k', s: n === 1 ? null : st.arr === 'series' ? `k_eq = ${fmt(k)}/${n}` : `k_eq = ${n}(${fmt(k)})`, r: `k_eq = ${fmt(kEq)} ${u.K}` });
      S.add({ t: 'Equation of motion', n: st.vert ? 'Measured from the static equilibrium position, the weight and the static spring force cancel, so the equation is the same as for horizontal motion.' : (st.damp !== 'none' || st.exc !== 'free' ? 'The spring force −kx' + (st.damp !== 'none' ? ', the damper force −cẋ' : '') + (st.exc !== 'free' ? ' and the periodic force' : '') + ' act on the block.' : 'The spring force −kx is the only horizontal force.'),
        f: (() => { const dm = st.damp !== 'none', fz = st.exc !== 'free'; const lhs = '−kx' + (dm ? ' − cẋ' : '') + (fz ? ' + F₀ sin ω₀t' : ''); return `(+→) ΣF_x = ma_x:  ${lhs} = mẍ  ⇒  mẍ${dm ? ' + cẋ' : ''} + kx = ${fz ? 'F₀ sin ω₀t' : '0'}`; })(), r: `m = ${DY.massTxt(m, u)}` });
      if (st.vert) { const dst = (m * g) / kEq; S.add({ t: 'Static deflection', f: 'δ_st = mg/k,  ω_n = √(g/δ_st)', s: `δ_st = ${fmt(m * g)}/${fmt(kEq)}`, r: `δ_st = ${DY.show(dst, 'S', u)}` }); out.push({ k: 'Static deflection δ_st', v: Fm(dst, 'S', u), u: u.S }); }
      geo = { m, k: kEq, n, arr: st.arr };
    } else if (sys === 'pend') {
      const L = num('L'); if (!(L > 0)) return fail('Enter the length of the pendulum.');
      mEq = 1; kEq = g / L; coord = 'θ'; rot = true;
      S.add({ t: 'Equation of motion', n: 'The tangential component of the weight restores the bob. For small angles sin θ ≈ θ.', f: '(+↙) ΣF_t = ma_t:  −mg sin θ = mLθ̈  ⇒  θ̈ + (g/L)θ = 0', s: `ω_n² = g/L = ${fmt(g)}/${fmt(L)}` });
      geo = { L };
    } else if (sys === 'comp') {
      const bd = BODY[st.body] || BODY.rod; if (!(num('m') > 0)) return fail('Enter the mass of the body.');
      if (st.body === 'rod' && !(num('len') > 0)) return fail('Enter the length of the rod.');
      if ((st.body === 'hoop' || st.body === 'disk') && !(num('r') > 0)) return fail('Enter the radius.');
      if (st.body === 'kg' && !(num('kO') > 0 && num('dG') > 0)) return fail('Enter k_G and the distance d from the pin to G.');
      const m = B(num('m'), 'M', u), I = bd.I(m, st), d = bd.d(st);
      mEq = I; kEq = m * g * d; coord = 'θ'; rot = true;
      S.add({ t: 'Moment of inertia about the pin', n: bd.name + ' (parallel-axis theorem I_O = I_G + md²).', f: bd.f, r: `I_O = ${fmt(I)} ${u.I}, d = ${fmt(d)} ${u.L}` });
      S.add({ t: 'Equation of motion', n: 'Moments about the pin O; the weight acts at G, a distance d below O. For small angles sin θ ≈ θ.', f: '(+↺) ΣM_O = I_Oα:  −mgd sin θ = I_Oθ̈  ⇒  θ̈ + (mgd/I_O)θ = 0', s: `ω_n² = (${fmt(m)})(${fmt(g)})(${fmt(d)})/${fmt(I)}` });
      geo = { m, I, d, body: st.body, len: num('len'), r: num('r') };
    } else if (sys === 'tors') {
      const tb = TBODY[st.body] || TBODY.plate; if (!(num('m') > 0) || !(num('kt') > 0)) return fail('Enter the mass and the torsional stiffness.');
      const m = B(num('m'), 'M', u), I = tb.I(m, st);
      if (!(I > 0)) return fail('Enter the size of the body.');
      mEq = I; kEq = num('kt'); coord = 'θ'; rot = true;
      S.add({ t: 'Moment of inertia about the rod', n: tb.name + ' turning about the rod through its centre.', f: tb.f, r: `I_O = ${fmt(I)} ${u.I}` });
      S.add({ t: 'Equation of motion', n: 'The twisted rod gives a restoring moment M = kθ.', f: '(+↺) ΣM_O = I_Oα:  −kθ = I_Oθ̈  ⇒  θ̈ + (k/I_O)θ = 0', s: `ω_n² = ${fmt(kEq)}/${fmt(I)}` });
      geo = { m, I, body: st.body, a: num('a'), b: num('b'), r: num('r') };
    } else if (sys === 'pulley') {
      if (!(num('mb') > 0) || !(num('md') > 0) || !(num('k') > 0) || !(num('rb') > 0) || !(num('rs') > 0)) return fail('Enter the block, the disk, the spring and both radii.');
      const mb = B(num('mb'), 'M', u), md = B(num('md'), 'M', u), rb = num('rb'), rs = num('rs'), Id = 0.5 * md * Math.max(rb, rs) ** 2, k = num('k');
      mEq = mb + Id / (rb * rb); kEq = k * (rs / rb) ** 2;
      S.add({ t: 'Energy of the system', n: `The block hangs from a cord on radius r_b = ${fmt(rb)} ${u.L}; the spring is tied to the disk at r_s = ${fmt(rs)} ${u.L}. With s = r_bθ the spring stretches r_sθ. The disk is a uniform disk of radius ${fmt(Math.max(rb, rs))} ${u.L}.`,
        f: 'T = ½m_b ṡ² + ½I_Oθ̇² = ½(m_b + I_O/r_b²)ṡ²;  V = ½k(r_s/r_b)²s² (from equilibrium)', s: `I_O = ½(${fmt(md)})(${fmt(Math.max(rb, rs))})² = ${fmt(Id)} ${u.I}`, r: `m_eq = ${fmt(mEq)} ${u.Mb}, k_eq = ${fmt(kEq)} ${u.K}` });
      S.add({ t: 'Time derivative of the energy', f: 'd/dt(T + V) = 0  ⇒  m_eq s̈ + k_eq s = 0', s: `ω_n² = k_eq/m_eq = ${fmt(kEq)}/${fmt(mEq)}` });
      geo = { mb, md, rb, rs, k };
    } else if (sys === 'roll') {
      if (!(num('m') > 0) || !(num('k') > 0) || !(num('r') > 0)) return fail('Enter the mass, the spring and the radius.');
      const m = B(num('m'), 'M', u), r = num('r'), I = 0.5 * m * r * r, k = num('k');
      mEq = m + I / (r * r); kEq = k;
      S.add({ t: 'Energy of the rolling cylinder', n: 'It rolls without slipping, so ω = v/r; the spring is fixed to its centre.', f: 'T = ½mv² + ½I_Gω² = ½(m + I_G/r²)ẋ² = ¾mẋ²;  V = ½kx²', r: `m_eq = ${fmt(mEq)} ${u.Mb}` });
      S.add({ t: 'Time derivative of the energy', f: '(3/2)m ẍ + kx = 0', s: `ω_n² = ${fmt(kEq)}/${fmt(mEq)}` });
      geo = { m, r, k };
    } else if (sys === 'bar') {
      if (!(num('m') > 0) || !(num('len') > 0) || !(num('k') > 0)) return fail('Enter the bar, its length and the spring stiffness.');
      const m = B(num('m'), 'M', u), L = num('len'), a = num('sa'), b = num('sb'), k = num('k');
      if (!(a > 0 && a <= L)) return fail('The spring must be on the bar: 0 < a ≤ L.');
      if (st.damp !== 'none' && !(b > 0 && b <= L)) return fail('The dashpot must be on the bar: 0 < b ≤ L.');
      mEq = (m * L * L) / 3; kEq = k * a * a; coord = 'θ'; rot = true;
      S.add({ t: 'Moment of inertia about the pin A', n: 'Slender bar pinned at its end A, horizontal at equilibrium.', f: 'I_A = ⅓mL²', s: `I_A = ⅓(${fmt(m)})(${fmt(L)})²`, r: `I_A = ${fmt(mEq)} ${u.I}` });
      S.add({ t: 'Equation of motion', n: 'Measured from equilibrium the weight and the static spring force cancel. For a small turn θ the spring at a stretches aθ and the dashpot at b moves at bθ̇.', f: '(+↺) ΣM_A = I_Aα:  −(k aθ)a − (c bθ̇)b = I_Aθ̈  ⇒  I_Aθ̈ + cb²θ̇ + ka²θ = 0', s: `k a² = ${fmt(k)}(${fmt(a)})² = ${fmt(kEq)}` });
      geo = { m, L, a, b, k };
    } else return fail('Pick a system.');
    const wn = Math.sqrt(kEq / mEq), tau = TAU / wn, f = 1 / tau;
    const wnF = { bar: 'ω_n = √(ka²/I_A)', sm: 'ω_n = √(k_eq/m)', pend: 'ω_n = √(g/L)', comp: 'ω_n = √(mgd/I_O)', tors: 'ω_n = √(k/I_O)', pulley: 'ω_n = √(k_eq/m_eq)', roll: 'ω_n = √(k_eq/m_eq)' }[sys];
    S.add({ t: 'Natural frequency and period', f: wnF + ';  τ = 2π/ω_n;  f = 1/τ', s: `ω_n = √(${fmt(kEq)}/${fmt(mEq)})`, r: `ω_n = ${fmt(wn)} rad/s, τ = ${fmt(tau)} s, f = ${fmt(f)} Hz` });
    out.push({ k: 'Natural frequency ω_n', v: wn, u: 'rad/s', hl: true }, { k: 'Period τ', v: tau, u: 's', hl: true }, { k: 'Frequency f', v: f, u: 'Hz' });
    if (sys === 'sm') out.push({ k: 'Equivalent stiffness k_eq', v: kEq, u: u.K });
    if (sys === 'pulley' || sys === 'roll') out.push({ k: 'Equivalent mass m_eq', v: mEq, u: u.Mb });
    if (sys === 'comp' || sys === 'tors') out.push({ k: 'Moment of inertia I_O', v: mEq, u: u.I });
    if (sys === 'bar') out.push({ k: 'Moment of inertia I_A', v: mEq, u: u.I }, { k: 'Equivalent stiffness ka²', v: kEq, u: u.MO + '/rad' });

    // damping (mass on springs, with dashpots in parallel, and the bar with a dashpot at b)
    let zeta = 0, c = 0, cc = 2 * mEq * wn, wd = wn;
    const canD = sys === 'sm' || sys === 'bar', canF = sys === 'sm';
    const cGeo = sys === 'bar' ? geo.b * geo.b : Math.max(1, Math.round(+st.nc || 1)); // c_eq = c × this
    if (canD && st.damp !== 'none') {
      if (sys === 'sm' && !(cGeo >= 1 && cGeo <= 4)) return fail('The number of dampers must be from 1 to 4.');
      if (st.damp === 'c') {
        const c1 = +st.c; if (!(c1 >= 0)) return fail('The damping coefficient cannot be negative.'); c = c1 * cGeo; zeta = c / cc;
        if (cGeo !== 1) S.add({ t: 'Equivalent damping', n: sys === 'bar' ? 'The dashpot at b resists with a moment (c bθ̇)b.' : 'Dampers side by side move together; their forces add.', f: sys === 'bar' ? 'c_eq = c b²' : 'c_eq = Σ c', s: sys === 'bar' ? `c_eq = ${fmt(c1)}(${fmt(geo.b)})²` : `c_eq = ${cGeo}(${fmt(c1)})`, r: `c_eq = ${fmt(c)} ${sys === 'bar' ? u.MO + '·s/rad' : u.CD}` });
      } else { zeta = +st.zeta; if (!(zeta >= 0)) return fail('The damping factor cannot be negative.'); c = zeta * cc; }
      const kind = zeta < 1 - 1e-9 ? 'underdamped' : zeta > 1 + 1e-9 ? 'overdamped' : 'critically damped';
      S.add({ t: 'Damping', f: 'c_c = 2mω_n;  ζ = c/c_c', s: `c_c = 2(${fmt(mEq)})(${fmt(wn)}) = ${fmt(cc)} ${u.CD}`, r: `ζ = ${fmt(zeta)}: the system is ${kind}` });
      out.push({ k: 'Critical damping c_c', v: cc, u: sys === 'bar' ? u.MO + '·s/rad' : u.CD }, { k: 'Damping factor ζ = c/c_c', v: zeta, u: '' }, { k: sys === 'bar' ? 'Equivalent damping c b²' : 'Damping coefficient c (all dampers)', v: c, u: sys === 'bar' ? u.MO + '·s/rad' : u.CD }, { k: 'Type of damping', v: kind, u: '' });
      if (sys === 'bar') { S.add({ t: 'Dashpot for critical damping', f: '(c b²)_c = c_c  ⇒  c = c_c/b²', s: `c = ${fmt(cc)}/${fmt(geo.b)}²`, r: `c = ${fmt(cc / (geo.b * geo.b))} ${u.CD}` }); out.push({ k: 'Dashpot c for critical damping', v: cc / (geo.b * geo.b), u: u.CD }); }
      else if (cGeo > 1) out.push({ k: 'Each damper c for critical damping', v: cc / cGeo, u: u.CD });
      if (zeta < 1 - 1e-9) {
        wd = wn * Math.sqrt(1 - zeta * zeta);
        const dlog = (TAU * zeta) / Math.sqrt(1 - zeta * zeta);
        S.add({ t: 'Damped natural frequency', f: 'ω_d = ω_n√(1 − ζ²);  τ_d = 2π/ω_d;  δ = ln(x₁/x₂) = 2πζ/√(1 − ζ²)', s: `ω_d = ${fmt(wn)}√(1 − ${fmt(zeta)}²)`, r: `ω_d = ${fmt(wd)} rad/s, τ_d = ${fmt(TAU / wd)} s, logarithmic decrement δ = ${fmt(dlog)}` });
        out.push({ k: 'Damped natural frequency ω_d', v: wd, u: 'rad/s', hl: st.exc === 'free' }, { k: 'Damped period τ_d', v: TAU / wd, u: 's' }, { k: 'Logarithmic decrement δ', v: dlog, u: '' });
      }
    }

    // excitation (a projectile that embeds only sets the starting velocity)
    let exc = canF && st.exc !== 'impact' ? st.exc : 'free', X = 0, phiP = 0, w0 = 0, r = 0, F0 = 0, MF = 1, xp = () => 0, vp = () => 0;
    if (exc !== 'free') {
      w0 = +st.w0; if (!(w0 > 0)) return fail('Enter the forcing frequency ω₀.');
      r = w0 / wn;
      if (exc === 'force') { F0 = +st.F0; if (!(F0 > 0)) return fail('Enter the force amplitude F₀.'); }
      else if (exc === 'support') { const d0 = B(+st.d0, 'S', u); if (!(d0 > 0)) return fail('Enter the support amplitude δ₀.'); F0 = kEq * d0; S.add({ t: 'Support motion', n: 'The springs are attached to the moving support, so δ = δ₀ sin ω₀t acts like a force kδ₀ sin ω₀t on the mass.', f: 'F₀ = kδ₀', s: `F₀ = (${fmt(kEq)})(${DY.show(d0, 'S', u)})`, r: `F₀ = ${fmt(F0)} ${u.F}` }); }
      else { const m0 = B(+st.m0, 'M', u), e = B(+st.e, 'S', u); if (!(m0 > 0) || !(e > 0)) return fail('Enter the unbalanced mass and its eccentricity.'); F0 = m0 * e * w0 * w0; S.add({ t: 'Force from the rotating unbalance', n: 'The unbalanced mass m₀ turns on a circle of radius e at ω₀; its vertical component of m₀eω₀² is the periodic force.', f: 'F₀ = m₀eω₀²', s: `F₀ = (${fmt(m0)})(${fmt(e)})(${fmt(w0)})²`, r: `F₀ = ${fmt(F0)} ${u.F}` }); }
      if (zeta === 0 && Math.abs(1 - r * r) < 1e-9) return fail('ω₀ equals ω_n: resonance. Without damping the amplitude grows without bound.');
      MF = 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2); X = (F0 / kEq) * MF; phiP = Math.atan2(2 * zeta * r, 1 - r * r);
      if (zeta === 0) S.add({ t: 'Steady-state amplitude', n: 'The particular solution of mẍ + kx = F₀ sin ω₀t.', f: 'X = (F₀/k)/(1 − (ω₀/ω_n)²)', s: `X = (${fmt(F0)}/${fmt(kEq)})/(1 − (${fmt(w0)}/${fmt(wn)})²)`, r: `X = ${DY.show(Math.abs((F0 / kEq) / (1 - r * r)), 'S', u)}${r > 1 ? ' (out of phase with the force since ω₀ > ω_n)' : ''}` });
      else S.add({ t: 'Magnification factor and amplitude', f: 'MF = 1/√([1 − (ω₀/ω_n)²]² + [2(c/c_c)(ω₀/ω_n)]²);  X = (F₀/k)MF;  φ′ = tan⁻¹[2(c/c_c)(ω₀/ω_n)/(1 − (ω₀/ω_n)²)]',
        s: `ω₀/ω_n = ${fmt(r)};  MF = ${fmt(MF)}`, r: `X = (${fmt(F0)}/${fmt(kEq)})(${fmt(MF)}) = ${DY.show(X, 'S', u)}, φ′ = ${fmt(phiP / D2R)}°` });
      out.push({ k: 'Force amplitude F₀', v: F0, u: u.F }, { k: 'Frequency ratio ω₀/ω_n', v: r, u: '' }, { k: 'Magnification factor MF', v: MF, u: '', hl: true }, { k: 'Steady-state amplitude X', v: Fm(X, 'S', u), u: u.S, hl: true }, { k: 'Phase angle φ′', v: phiP / D2R, u: '°' });
      out.push({ k: 'Resonance at ω₀ = ω_n', v: wn, u: 'rad/s' });
      if (Math.abs(r - 1) < 0.1) warn.push('ω₀ is close to ω_n: the system is near resonance.');
      xp = (t) => X * Math.sin(w0 * t - phiP); vp = (t) => X * w0 * Math.cos(w0 * t - phiP);
    }

    if (canD) {
      const d2 = `${coord}\u0308`, d1 = `${coord}\u0307`, rhs = exc === 'free' ? '0' : `${fmt(F0)} sin ${fmt(w0)}t`;
      S.add({ t: 'Differential equation of motion', f: `${sys === 'bar' ? 'I_A' : 'm'}${d2} + ${sys === 'bar' ? 'cb²' : 'c'}${d1} + ${sys === 'bar' ? 'ka²' : 'k'}${coord} = ${exc === 'free' ? '0' : 'F₀ sin ω₀t'}`,
        s: `${fmt(mEq)}${d2} + ${fmt(c)}${d1} + ${fmt(kEq)}${coord} = ${rhs}`, r: `${d2} + ${fmt(c / mEq)}${d1} + ${fmt(kEq / mEq)}${coord} = ${exc === 'free' ? '0' : `${fmt(F0 / mEq)} sin ${fmt(w0)}t`}` });
      S.add({ t: 'Equivalent electrical circuit', n: 'A series circuit of an inductor, a resistor and a capacitor obeys the same equation for the charge q (Table 22–1): mass ↔ inductance, damping ↔ resistance, stiffness ↔ 1/capacitance, force ↔ voltage.',
        f: 'L q̈ + R q̇ + q/C = E(t)', s: `L = ${fmt(mEq)}, R = ${fmt(c)}, 1/C = ${fmt(kEq)}${exc === 'free' ? '' : `, E = ${fmt(F0)} sin ${fmt(w0)}t`}`, r: `${fmt(mEq)} q̈ + ${fmt(c)} q̇ + ${fmt(kEq)} q = ${exc === 'free' ? '0' : `${fmt(F0)} sin ${fmt(w0)}t`}` });
      out.push({ k: 'Analog inductance L (↔ mass)', v: mEq, u: 'H' }, { k: 'Analog resistance R (↔ c)', v: c, u: 'Ω' }, { k: 'Analog capacitance C (↔ 1/k)', v: 1 / kEq, u: 'F' });
    }

    // free response from the initial conditions (the transient, for forced vibration)
    const x0 = vImp !== null ? 0 : rot ? +st.th0 * D2R : B(+st.x0, 'S', u), v0 = vImp !== null ? -vImp : rot ? 0 : +st.v0; // the projectile pushes the block towards the support (−x), compressing the springs
    if (!isFinite(x0) || !isFinite(v0)) return fail('Enter the initial displacement and velocity.');
    const X0 = x0 - xp(0), V0 = v0 - vp(0);
    let xh, env = null, amp = null;
    if (zeta === 0) {
      const A = V0 / wn, Bc = X0; amp = Math.hypot(A, Bc); const ph = Math.atan2(Bc, A);
      xh = (t) => A * Math.sin(wn * t) + Bc * Math.cos(wn * t);
      if (exc === 'free') {
        S.add({ t: 'Free vibration from the initial conditions', f: `${coord} = A sin ω_n t + B cos ω_n t;  B = ${coord}₀, A = ${rot ? 'θ̇₀' : 'v₀'}/ω_n;  C = √(A² + B²), φ = tan⁻¹(B/A)`,
          s: rot ? `B = ${fmt(x0 / D2R)}° = ${fmt(x0)} rad, A = 0 (released from rest)` : `B = ${DY.show(x0, 'S', u)}, A = ${fmt(v0)}/${fmt(wn)} = ${DY.show(A, 'S', u)}`,
          r: rot ? `θ = ${fmt(amp / D2R)}° cos(${fmt(wn)}t)` : `x = ${DY.show(amp, 'S', u)} sin(${fmt(wn)}t + ${fmt(ph / D2R)}°)` });
        if (rot) out.push({ k: 'Amplitude θ_max', v: amp / D2R, u: '°' }); else out.push({ k: 'Amplitude C', v: Fm(amp, 'S', u), u: u.S }, { k: 'Phase angle φ', v: ph / D2R, u: '°' }, { k: 'Largest speed', v: amp * wn, u: u.V }, { k: 'Largest acceleration', v: amp * wn * wn, u: u.A });
      }
    } else if (zeta < 1 - 1e-9) {
      const s1 = (V0 + zeta * wn * X0) / wd, D0 = Math.hypot(X0, s1), ph = Math.atan2(X0, s1);
      xh = (t) => Math.exp(-zeta * wn * t) * (X0 * Math.cos(wd * t) + s1 * Math.sin(wd * t)); env = (t) => D0 * Math.exp(-zeta * wn * t);
      if (exc === 'free') { S.add({ t: 'Underdamped free vibration', f: 'x = De^(−(c/2m)t) sin(ω_d t + φ)', s: `D = ${DY.show(D0, 'S', u)}, φ = ${fmt(ph / D2R)}°`, r: `x = ${DY.show(D0, 'S', u)} e^(−${fmt(zeta * wn)}t) sin(${fmt(wd)}t + ${fmt(ph / D2R)}°)` }); out.push({ k: 'Starting amplitude D', v: Fm(D0, 'S', u), u: u.S }); }
    } else if (zeta > 1 + 1e-9) {
      const q = Math.sqrt(zeta * zeta - 1), l1 = (-zeta + q) * wn, l2 = (-zeta - q) * wn, Bc = (V0 - l1 * X0) / (l2 - l1), A = X0 - Bc;
      xh = (t) => A * Math.exp(l1 * t) + Bc * Math.exp(l2 * t);
      if (exc === 'free') S.add({ t: 'Overdamped motion (no vibration)', f: 'x = Ae^(λ₁t) + Be^(λ₂t),  λ₁,₂ = −(c/2m) ± √((c/2m)² − k/m)', s: `λ₁ = ${fmt(l1)} s⁻¹, λ₂ = ${fmt(l2)} s⁻¹`, r: 'It creeps back to equilibrium without oscillating.' });
    } else {
      const Bc = V0 + wn * X0;
      xh = (t) => (X0 + Bc * t) * Math.exp(-wn * t);
      if (exc === 'free') S.add({ t: 'Critically damped motion', f: 'x = (A + Bt)e^(−ω_n t)', s: `A = ${DY.show(X0, 'S', u)}, B = ${fmt(Bc)} ${u.V}`, r: 'It returns to equilibrium in the shortest time without oscillating.' });
    }
    const x = (t) => xh(t) + xp(t);
    if (exc === 'free' && !rot) extremes(x, wn, zeta, x0, B(+st.xt || 0, 'S', u), S, out, u);
    const Tper = Math.max(tau, exc !== 'free' ? TAU / w0 : 0), Tw = exc === 'free' ? (zeta > 0 ? Math.min(6 * tau, Math.max(2 * tau, 4.6 / (zeta * wn))) : 4 * tau) : Math.max(5 * Tper, zeta > 0 ? Math.min(30 * Tper, 4 / (zeta * wn)) : 5 * Tper);
    const status = exc === 'free' ? `ω_n = ${fmt(wn)} rad/s, τ = ${fmt(tau)} s${zeta > 0 ? `, ζ = ${fmt(zeta)}` : ''}` : `X = ${DY.show(X, 'S', u)}, MF = ${fmt(MF)} (ω₀/ω_n = ${fmt(r)})`;
    return DY.result(status, warn.length ? 'warn' : 'ok', out, S, Object.assign(geo, { u, sys, rot, wn, tau, zeta, wd, exc, X, MF, r, w0, F0, x, xp, env, span: [0, Tw], body: st.body, vert: st.vert, damped: zeta > 0, impact: vImp !== null, ndamp: sys === 'sm' ? cGeo : 1, analog: canD ? { L: mEq, R: c, C: 1 / kEq, E: exc !== 'free' } : null }), warn);
  }

  /** Largest displacement (when the start is not already the largest) and the time to reach x_t. */
  function extremes(x, wn, zeta, x0, xt, S, out, u) {
    const T = (zeta > 0 ? Math.min(60, Math.max(8, 12 / zeta)) : 4) * (TAU / wn), n = 6000, h = T / n;
    let best = Math.abs(x0), tb = 0, peak = false;
    for (let i = 1; i <= n; i++) { const a = x((i - 1) * h), b = x(i * h), c2 = x((i + 1) * h); if (Math.abs(b) > Math.abs(a) && Math.abs(b) >= Math.abs(c2)) { if (Math.abs(b) > best * (1 + 1e-9)) { best = Math.abs(b); tb = i * h; peak = true; } break; } }
    if (peak) {
      let lo = Math.max(0, tb - h), hi = tb + h; for (let k = 0; k < 60; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(x(m1)) < Math.abs(x(m2))) lo = m1; else hi = m2; }
      tb = (lo + hi) / 2; best = Math.abs(x(tb));
      S.add({ t: 'Largest displacement', n: 'The first turning point, where ẋ = 0.', r: `x_max = ${DY.show(best, 'S', u)} at t = ${fmt(tb)} s` });
      out.push({ k: 'Largest displacement x_max', v: DY.fromBase(best, 'S', u), u: u.S, hl: true }, { k: 'Time to x_max', v: tb, u: 's' });
    }
    if (xt > 0 && Math.abs(x0) > xt) {
      const sg = Math.sign(x0), f = (t) => sg * x(t) - xt;
      for (let i = 1; i <= n; i++) if (f(i * h) <= 0) { let lo = (i - 1) * h, hi = i * h; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } const t = (lo + hi) / 2;
        S.add({ t: `Time to come back to x = ${DY.show(sg * xt, 'S', u)}`, n: 'Solved from x(t) = x_t by bisection.', r: `t = ${fmt(t)} s` }); out.push({ k: 'Time to reach x_t', v: t, u: 's', hl: true }); return; }
    }
  }

  const Vib = { defaults, convertState, solve, BODY, TBODY };
  root.Vib = Vib;
  if (typeof module !== 'undefined' && module.exports) module.exports = Vib;
})(typeof window !== 'undefined' ? window : globalThis);
