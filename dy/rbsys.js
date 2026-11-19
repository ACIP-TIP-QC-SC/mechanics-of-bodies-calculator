/* =====================================================================
 * DYNAMICS · Planar kinetics of connected bodies and eccentric impact (physics only; browser + Node).
 * The Planar Kinetics module (dy/rbforce.js) hands these scenes here.
 * Hibbeler, Dynamics 15e:
 *   17.5  Rolling bodies joined by a link: ΣM_IC = I_IC α for each wheel, the same α for both
 *   18.4  Conservation of energy and work of a couple: T₁ + ΣU₁₋₂ = T₂, U_M = Mθ           (18–14, 18–18)
 *   19.3  Conservation of angular momentum about a point: (H_O)₁ = (H_O)₂                  (19–18)
 *   19.4  Eccentric impact: e = [(v_B)₂ − (v_A)₂]/[(v_A)₁ − (v_B)₁] along the line of impact (19–20)
 * Scenes: two wheels joined by a link on a slope; an arm carrying gears round a fixed ring or
 * sun gear, driven by a couple; two bars (pinned at A, roller at C) released from rest; and
 * eccentric impact (a pendulum striking a block or a stop, a block tipping over a stop, and a
 * body landing on a rough floor without slipping).
 * Signs: angles are + counterclockwise unless a step says otherwise. State keys start with x.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;
  const SCENES = ['linked', 'geararm', 'twobar', 'eimpact'];

  const defaults = () => ({
    // two wheels joined by a link (wheel 1 uphill)
    xl1m: 60, xl1k: 0.4, xl2m: 40, xl2k: 0.35, xlr: 0.5, xlh: 0.9, xlphi: 30, xlmus: 0,
    // arm with gears
    xgring: 'ring', xgn: 2, xgbm: 3, xgR: 0.2, xggm: 2, xgr: 0.15, xgM: 10, xgtask: 'turns', xgw: 20, xgrev: 1,
    // two bars, A pinned, C on a roller on the floor through A
    xbm1: 5, xbL1: 1, xbm2: 5, xbL2: 1, xbth1: 90, xbth2: 0, xbM: 0,
    // eccentric impact
    xetask: 'strike',
    xem: 16, xerG: 0.4375, xeIby: 'I', xekO: 0.471, xeIO: 3.55, xeth0: 90, xed: 0.55, xemb: 30, xee: 0.6,
    xebm: 10, xebb: 1, xebh: 1, xebv: 0,
    xeshape: 'disk', xedm: 2, xedr: 0.1, xedl: 0.12, xedb: 60, xedv: 2, xedang: 60, xedw: 5, xede: 0.5,
  });
  const KINDS = { xl1m: 'M', xl1k: 'L', xl2m: 'M', xl2k: 'L', xlr: 'L', xlh: 'L', xgbm: 'M', xgR: 'L', xggm: 'M', xgr: 'L', xgM: 'MO',
    xbm1: 'M', xbL1: 'L', xbm2: 'M', xbL2: 'L', xbM: 'MO', xem: 'M', xerG: 'L', xekO: 'L', xeIO: 'I', xed: 'L', xemb: 'M',
    xebm: 'M', xebb: 'L', xebh: 'L', xebv: 'V', xedm: 'M', xedr: 'L', xedl: 'L', xedv: 'V' };
  const convert = (st, from, to) => (from === to ? st : DY.convertObj(st, KINDS, from, to));

  const mtx = (m, u) => DY.massTxt(m, u);
  const sense = (w) => (Math.abs(w) < 1e-12 ? '' : w > 0 ? ' ↺' : ' ↻');
  const nz = (x, d) => (x === '' || x === undefined || x === null || !isFinite(+x) ? d : +x);

  function solve(st, u) {
    switch (st.scene) {
      case 'linked': return linked(st, u);
      case 'geararm': return gearArm(st, u);
      case 'twobar': return twoBar(st, u);
      default: return eImpact(st, u);
    }
  }

  /* ---------------- two wheels joined by a link, rolling down a slope ---------------- */
  function linked(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m1 = DY.toBase(+st.xl1m, 'M', u), m2 = DY.toBase(+st.xl2m, 'M', u), k1 = +st.xl1k, k2 = +st.xl2k, r = +st.xlr, h = +st.xlh, phi = nz(st.xlphi, 0) * D2R, mus = nz(st.xlmus, 0);
    if (!(m1 > 0 && m2 > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of both wheels.`);
    if (!(k1 >= 0 && k2 >= 0 && r > 0)) return fail('Enter the radii of gyration and the rolling radius r.');
    if (!(h > 0)) return fail('Enter the height of the link above the slope h (its moment arm about each contact point).');
    const I1 = m1 * (k1 * k1 + r * r), I2 = m2 * (k2 * k2 + r * r), s = Math.sin(phi);
    const al = (g * s * r * (m1 + m2)) / (I1 + I2), T = (I1 * al - m1 * g * s * r) / h, a = al * r;
    S.add({ t: 'Kinematics', n: 'The link keeps the centres the same distance apart, so both wheels roll with the same ω and α, and a_G = αr for each.', f: 'I_IC = m(k_G² + r²)', s: `I_IC,1 = ${fmt(m1)}(${fmt(k1)}² + ${fmt(r)}²);  I_IC,2 = ${fmt(m2)}(${fmt(k2)}² + ${fmt(r)}²)`, r: `I_IC,1 = ${fmt(I1)} ${u.I},  I_IC,2 = ${fmt(I2)} ${u.I}` });
    S.add({ t: 'Moments about each contact point (IC)', n: 'The friction and normal forces pass through the contact point. The link force T (+ tension) acts along the slope at a height h; it pulls the upper wheel 1 down the slope and the lower wheel 2 up it.', f: 'Wheel 1: m₁g sin φ r + T h = I_IC,1 α;   Wheel 2: m₂g sin φ r − T h = I_IC,2 α',
      s: `${fmt(m1 * g * s * r)} + ${fmt(h)}T = ${fmt(I1)}α;  ${fmt(m2 * g * s * r)} − ${fmt(h)}T = ${fmt(I2)}α`, r: `α = ${fmt(al)} rad/s²,  T = ${fmt(T)} ${u.F}${T < 0 ? ' (the link is in compression)' : ''}` });
    const f1 = m1 * g * s + T - m1 * a, f2 = m2 * g * s - T - m2 * a, N1 = m1 * g * Math.cos(phi), N2 = m2 * g * Math.cos(phi);
    S.add({ t: 'Friction and normal forces', f: 'ΣF along the slope = m a_G:  F_f = m g sin φ ± T − m a_G;   N = m g cos φ', r: `F₁ = ${fmt(f1)}, N₁ = ${fmt(N1)};  F₂ = ${fmt(f2)}, N₂ = ${fmt(N2)} ${u.F}` });
    if (mus > 0) { const ok1 = Math.abs(f1) <= mus * N1 + 1e-9, ok2 = Math.abs(f2) <= mus * N2 + 1e-9; S.add({ t: 'Check for slipping', f: '|F| ≤ μ_s N', r: `wheel 1: ${fmt(Math.abs(f1))} ${ok1 ? '≤' : '>'} ${fmt(mus * N1)};  wheel 2: ${fmt(Math.abs(f2))} ${ok2 ? '≤' : '>'} ${fmt(mus * N2)}` }); if (!ok1 || !ok2) warn.push('Friction cannot hold: a wheel slips, so the rolling answer does not apply.'); }
    out.push({ k: 'Angular acceleration α', v: al, u: 'rad/s²', hl: true }, { k: 'Acceleration of the centres a_G', v: a, u: u.A }, { k: 'Force in the link T (+ tension)', v: T, u: u.F, hl: true },
      { k: 'Friction on wheel 1', v: f1, u: u.F }, { k: 'Friction on wheel 2', v: f2, u: u.F });
    return DY.result(`α = ${fmt(al)} rad/s², T = ${fmt(T)} ${u.F}`, warn.length ? 'warn' : 'ok', out, S, { scene: 'linked', u, m1, m2, k1, k2, r, h, phi, al, a, T, f1, f2, N1, N2, span: [0, Math.max(1, Math.sqrt(6 * r / Math.max(a, 1e-9)))] }, warn);
  }

  /* ---------------- arm carrying gears round a fixed ring or sun gear ---------------- */
  /** Moment of inertia of the arm and gears referred to the arm's rotation: T = ½ J ω_arm². */
  function gearArmJ(o) {
    const ratio = o.R / o.r; // |ω_gear/ω_arm|: the gear's contact with the fixed gear is its IC, so ω_gear r = ω_arm R either way
    const Ibar = (o.mb * Math.pow(o.n === 1 ? o.R : 2 * o.R, 2)) / (o.n === 1 ? 3 : 12), Ig = 0.5 * o.mg * o.r * o.r;
    return { ratio, Ibar, Ig, J: Ibar + o.n * (o.mg * o.R * o.R + Ig * ratio * ratio) };
  }
  function gearArm(st, u) {
    const S = Steps(), out = [];
    const o = { ring: st.xgring !== 'sun', n: +st.xgn === 1 ? 1 : 2, mb: DY.toBase(nz(st.xgbm, 0), 'M', u), R: +st.xgR, mg: DY.toBase(+st.xggm, 'M', u), r: +st.xgr };
    const M = +st.xgM;
    if (!(o.R > 0 && o.r > 0)) return fail('Enter the arm radius R and the gear radius r.');
    if (!(o.mg > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of each gear.`);
    if (!(o.mb >= 0)) return fail('The mass of the arm cannot be negative.');
    if (!(M !== 0 && isFinite(M))) return fail('Enter the couple M that drives the arm.');
    const k = gearArmJ(o);
    S.add({ t: 'Kinematics', n: `Each gear rolls on the fixed ${o.ring ? 'ring' : 'sun'} gear, so its contact point is its IC: v_G = ω_arm R = ω_gear r.`, f: 'ω_gear = ω_arm R/r', r: `ω_gear = ${fmt(k.ratio)} ω_arm` });
    S.add({ t: 'Kinetic energy', n: o.n === 1 ? 'The arm is a slender rod of length R pinned at one end.' : 'The arm is a slender rod of length 2R pinned at its centre, with a gear (a thin disk) at each end.',
      f: `T = ½I_arm ω² + ${o.n === 2 ? '2[' : ''}½m_g(ωR)² + ½(½m_g r²)(ω R/r)²${o.n === 2 ? ']' : ''} = ½Jω²`, s: `I_arm = ${fmt(k.Ibar)}, I_gear = ${fmt(k.Ig)} ${u.I};  m_g = ${mtx(o.mg, u)}`, r: `J = ${fmt(k.J)} ${u.I}` });
    let th, w;
    if (st.xgtask === 'speed') {
      th = nz(st.xgrev, 0) * 2 * Math.PI; if (!(th > 0)) return fail('Enter the number of turns of the arm.');
      const T2 = M * th; if (T2 < 0) return fail('The couple turns the arm the other way.');
      w = Math.sqrt((2 * T2) / k.J);
      S.add({ t: 'Work and energy from rest', n: 'The couple does work Mθ. The arm and gears lie in a horizontal plane (or are balanced), so their weights do no work.', f: 'Mθ = ½Jω²', s: `${fmt(M)}(${fmt(th)}) = ½(${fmt(k.J)})ω²`, r: `ω_arm = ${fmt(w)} rad/s` });
    } else {
      w = +st.xgw; if (!(w > 0)) return fail('Enter the angular velocity of the arm to reach.');
      th = (k.J * w * w) / (2 * M); if (th < 0) return fail('The couple turns the arm the other way.');
      S.add({ t: 'Work and energy from rest', n: 'The couple does work Mθ. The arm and gears lie in a horizontal plane (or are balanced), so their weights do no work.', f: 'Mθ = ½Jω²  ⇒  θ = Jω²/(2M)', s: `θ = ${fmt(k.J)}(${fmt(w)})²/[2(${fmt(M)})]`, r: `θ = ${fmt(th)} rad = ${fmt(th / (2 * Math.PI))} rev` });
    }
    const al = M / k.J;
    out.push({ k: 'Turns of the arm θ', v: th / (2 * Math.PI), u: 'rev', hl: st.xgtask !== 'speed' }, { k: 'Angular velocity of the arm ω', v: w, u: 'rad/s', hl: st.xgtask === 'speed' }, { k: 'Angular velocity of each gear', v: w * k.ratio, u: 'rad/s' }, { k: 'Angular acceleration of the arm', v: al, u: 'rad/s²' }, { k: 'J (arm and gears)', v: k.J, u: u.I });
    return DY.result(st.xgtask === 'speed' ? `ω_arm = ${fmt(w)} rad/s` : `θ = ${fmt(th / (2 * Math.PI))} rev`, 'ok', out, S, { scene: 'geararm', u, ...o, M, J: k.J, ratio: k.ratio, th, w, al, span: [0, Math.sqrt((2 * th) / Math.max(al, 1e-12))] }, []);
  }

  /* ---------------- two bars released from rest ---------------- */
  /** Positions for AB at θ above the floor line (A at the origin), BC with its roller C on the line through A. */
  function twoBarAt(o, th) {
    const B = [o.L1 * Math.cos(th), o.L1 * Math.sin(th)], s = (o.L1 * Math.sin(th)) / o.L2;
    if (Math.abs(s) > 1) return null;
    const phi = Math.asin(s), C = [B[0] + o.L2 * Math.cos(phi), 0];
    return { B, C, phi, G1: [B[0] / 2, B[1] / 2], G2: [(B[0] + C[0]) / 2, B[1] / 2] };
  }
  /** Generalised inertia J(θ) and height energy V(θ): T = ½J θ̇², from the kinematics of the linkage. */
  function twoBarJ(o, th) {
    const h = 1e-5, p = twoBarAt(o, th + h), m = twoBarAt(o, th - h), c = twoBarAt(o, th);
    if (!p || !m || !c) return null;
    const dG2 = [(p.G2[0] - m.G2[0]) / (2 * h), (p.G2[1] - m.G2[1]) / (2 * h)], dphi = (p.phi - m.phi) / (2 * h);
    const IA = (o.m1 * o.L1 * o.L1) / 3, IG2 = (o.m2 * o.L2 * o.L2) / 12;
    return { J: IA + o.m2 * (dG2[0] * dG2[0] + dG2[1] * dG2[1]) + IG2 * dphi * dphi, dphi, vG2: Math.hypot(dG2[0], dG2[1]), V: o.g * (o.m1 * c.G1[1] + o.m2 * c.G2[1]), IA, IG2, pos: c };
  }
  function twoBar(st, u) {
    const S = Steps(), out = [];
    const o = { m1: DY.toBase(+st.xbm1, 'M', u), L1: +st.xbL1, m2: DY.toBase(+st.xbm2, 'M', u), L2: +st.xbL2, g: u.g };
    const th1 = +st.xbth1 * D2R, th2 = +st.xbth2 * D2R, M = nz(st.xbM, 0);
    if (!(o.m1 > 0 && o.m2 > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of both bars.`);
    if (!(o.L1 > 0 && o.L2 > 0)) return fail('Enter the length of both bars.');
    if (!(o.L2 >= o.L1)) return fail('Bar BC must be at least as long as AB, or C would leave the floor.');
    if (!(th1 >= 0 && th1 <= Math.PI / 2 && th2 >= 0 && th2 <= Math.PI / 2)) return fail('The angles of AB must be from 0° to 90°.');
    const k1 = twoBarJ(o, th1), k2 = twoBarJ(o, th2);
    if (!k1 || !k2) return fail('The linkage cannot reach one of these positions.');
    const UM = M * (th2 - th1), T2 = k1.V - k2.V + UM;
    S.add({ t: 'Potential energy', n: 'Datum through A and the floor. G of each bar is at half the height of B.', f: 'V = m₁g y_G1 + m₂g y_G2', s: `θ₁ = ${fmt(th1 / D2R)}°, θ₂ = ${fmt(th2 / D2R)}°`, r: `V₁ = ${fmt(k1.V)},  V₂ = ${fmt(k2.V)} ${u.E}` });
    S.add({ t: 'Kinetic energy at θ₂', n: 'AB turns about A. C moves along the floor and B moves at right angles to AB, so BC turns about its IC; from the geometry L₂ sin φ = L₁ sin θ.', f: 'T = ½I_A ω_AB² + ½I_G ω_BC² + ½m₂v_G2²,  ω_BC = (dφ/dθ) ω_AB',
      s: `I_A = ${fmt(k2.IA)}, I_G = ${fmt(k2.IG2)} ${u.I};  dφ/dθ = ${fmt(k2.dphi)},  v_G2 = ${fmt(k2.vG2)} ω_AB`, r: `T = ½(${fmt(k2.J)})ω_AB²` });
    if (T2 < -1e-12) return fail('The bars do not reach θ₂: they would need more energy than they have.');
    const wAB = Math.sqrt(Math.max(0, (2 * T2) / k2.J)), wBC = Math.abs(k2.dphi) * wAB;
    S.add({ t: 'Conservation of energy', f: `T₁ + V₁ ${M ? '+ Mθ ' : ''}= T₂ + V₂`, s: `0 + ${fmt(k1.V)}${M ? ` + ${fmt(UM)}` : ''} = ½(${fmt(k2.J)})ω_AB² + ${fmt(k2.V)}`, r: `ω_AB = ${fmt(wAB)} rad/s,  ω_BC = ${fmt(wBC)} rad/s` });
    out.push({ k: 'Angular velocity of AB, ω_AB', v: wAB, u: 'rad/s', hl: true }, { k: 'Angular velocity of BC, ω_BC', v: wBC, u: 'rad/s', hl: true }, { k: 'Speed of the roller C', v: Math.abs(derivC(o, th2) * wAB), u: u.V });
    const wAt = (th) => { const k = twoBarJ(o, th); if (!k) return NaN; const T = k1.V - k.V + M * (th - th1); return T >= 0 ? Math.sqrt((2 * T) / k.J) : NaN; };
    return DY.result(`ω_AB = ${fmt(wAB)} rad/s, ω_BC = ${fmt(wBC)} rad/s`, 'ok', out, S, { scene: 'twobar', u, ...o, th1, th2, wAB, wBC, at: (th) => twoBarAt(o, th), wAt, span: [0, 1] }, []);
  }
  const derivC = (o, th) => { const h = 1e-5, p = twoBarAt(o, th + h), m = twoBarAt(o, th - h); return p && m ? (p.C[0] - m.C[0]) / (2 * h) : 0; };

  /* ---------------- eccentric impact ---------------- */
  function eImpact(st, u) {
    if (st.xetask === 'tip') return tipOver(st, u);
    if (st.xetask === 'land') return land(st, u);
    return strike(st, u);
  }
  /** A body pinned at O swings down from rest and strikes, at the bottom of its swing, a block (or a fixed stop). */
  function strike(st, u) {
    const S = Steps(), out = [], g = u.g;
    const m = DY.toBase(+st.xem, 'M', u), rG = +st.xerG, d = +st.xed, mb = DY.toBase(nz(st.xemb, 0), 'M', u), e = +st.xee, th0 = +st.xeth0 * D2R;
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the swinging body.`);
    if (!(rG >= 0 && d > 0)) return fail('Enter r_G (pin to G) and the distance d from the pin to the point of impact.');
    if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution e must be from 0 to 1.');
    if (!(th0 > 0 && th0 <= Math.PI)) return fail('Enter the release angle from the vertical (more than 0°).');
    const IO = st.xeIby === 'k' ? m * Math.pow(+st.xekO, 2) : +st.xeIO;
    if (!(IO > 0)) return fail('Enter the moment of inertia about the pin, I_O (or k_O).');
    const W = m * g, drop = rG * (1 - Math.cos(th0)), w1 = Math.sqrt((2 * W * drop) / IO);
    S.add({ t: 'Swing down (conservation of energy)', n: 'Released from rest at θ₀ from the vertical; G falls r_G(1 − cos θ₀) by the bottom of the swing.', f: 'W r_G(1 − cos θ₀) = ½I_O ω₁²', s: `${fmt(W)}(${fmt(rG)})(1 − cos ${fmt(th0 / D2R)}°) = ½(${fmt(IO)})ω₁²`, r: `ω₁ = ${fmt(w1)} rad/s,  v₁ = ω₁d = ${fmt(w1 * d)} ${u.V} at the point of impact` });
    let w2, vb2;
    if (mb > 0) {
      vb2 = (IO * w1 * d * (1 + e)) / (IO + mb * d * d); w2 = (vb2 - e * w1 * d) / d;
      S.add({ t: 'Impact', n: 'The pin reaction and the weights are nonimpulsive about O, so the angular momentum of the body and block about O is conserved. The line of impact is horizontal, at d below O.',
        f: 'I_Oω₁ = I_Oω₂ + m_B v_B d;   e = (v_B − ω₂d)/(ω₁d − 0)', s: `${fmt(IO)}(${fmt(w1)}) = ${fmt(IO)}ω₂ + ${fmt(mb)}(${fmt(d)})v_B;  ${fmt(e)} = (v_B − ${fmt(d)}ω₂)/${fmt(w1 * d)}`, r: `v_B = ${fmt(vb2)} ${u.V},  ω₂ = ${fmt(w2)} rad/s${w2 < 0 ? ' (it swings back)' : ''}` });
    } else {
      w2 = -e * w1; vb2 = 0;
      S.add({ t: 'Impact on a fixed stop', n: 'The stop does not move, so the point of impact rebounds at e times its speed.', f: 'ω₂ d = −e ω₁ d', r: `ω₂ = ${fmt(w2)} rad/s (it swings back)` });
    }
    const T2 = 0.5 * IO * w2 * w2, c = 1 - T2 / (W * Math.max(rG, 1e-12)), reb = rG > 0 ? (c >= -1 ? Math.acos(Math.min(1, c)) : Math.PI) : 0;
    S.add({ t: 'Rebound or follow-through', f: '½I_Oω₂² = W r_G(1 − cos θ₃)', r: `θ₃ = ${fmt(reb / D2R)}° from the vertical${w2 < 0 ? ' on the side it came from' : ' past the block'}` });
    const Tl = 0.5 * IO * w1 * w1 - T2 - 0.5 * mb * vb2 * vb2;
    out.push({ k: 'Angular velocity just before, ω₁', v: w1, u: 'rad/s' }, { k: 'Angular velocity just after, ω₂', v: w2, u: 'rad/s', hl: true }, { k: 'Velocity of the block after, v_B', v: vb2, u: u.V, hl: mb > 0 },
      { k: 'Swing after impact θ₃ (from the vertical)', v: reb / D2R, u: '°' }, { k: 'Energy lost in the impact', v: Tl, u: u.E });
    return DY.result(mb > 0 ? `v_B = ${fmt(vb2)} ${u.V}, ω₂ = ${fmt(w2)} rad/s` : `ω₂ = ${fmt(w2)} rad/s, rebound to ${fmt(reb / D2R)}°`, 'ok', out, S, { scene: 'eimpact', task: 'strike', u, m, rG, d, mb, e, th0, IO, w1, w2, vb2, reb, span: [0, 1] }, []);
  }
  /** A block sliding at v strikes a small stop with its front bottom corner D and tips about it. */
  function tipOver(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = DY.toBase(+st.xebm, 'M', u), b = +st.xebb, h = +st.xebh, v = nz(st.xebv, 0);
    if (!(m > 0 && b > 0 && h > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} and both sides of the block.`);
    const rD = Math.hypot(b, h) / 2, ID = (m * (b * b + h * h)) / 3, W = m * g;
    S.add({ t: 'Moment of inertia about the corner D', f: 'I_D = (1/12)m(b² + h²) + m(r_D)² = (1/3)m(b² + h²)', s: `r_D = ½√(${fmt(b)}² + ${fmt(h)}²) = ${fmt(rD)} ${u.L}`, r: `I_D = ${fmt(ID)} ${u.I}` });
    S.add({ t: 'Impact (conservation of angular momentum about D)', n: 'The weight is nonimpulsive, and the impulse of the stop acts through D. The block then turns about D.', f: 'm v (h/2) = I_D ω₂', s: v ? `${fmt(m)}(${fmt(v)})(${fmt(h / 2)}) = ${fmt(ID)}ω₂` : '', r: v ? `ω₂ = ${fmt((m * v * h) / 2 / ID)} rad/s` : 'ω₂ = m v h/(2I_D)' });
    const wmin = Math.sqrt((2 * W * (rD - h / 2)) / ID), vmin = (2 * ID * wmin) / (m * h);
    S.add({ t: 'Least speed to tip over', n: 'G must rise to directly above D, where it is r_D above the floor (it starts h/2 above it).', f: '½I_Dω₂² = W(r_D − h/2)', s: `½(${fmt(ID)})ω₂² = ${fmt(W)}(${fmt(rD)} − ${fmt(h / 2)})`, r: `ω₂ = ${fmt(wmin)} rad/s  ⇒  v_min = ${fmt(vmin)} ${u.V}` });
    out.push({ k: 'Least speed to tip over, v_min', v: vmin, u: u.V, hl: true }, { k: 'ω just after impact at v_min', v: wmin, u: 'rad/s' });
    let tips = null;
    if (v > 0) {
      const w2 = (m * v * h) / 2 / ID; tips = v >= vmin - 1e-9;
      const T = 0.5 * ID * w2 * w2, cg = Math.min(rD, h / 2 + T / W); // highest G reaches
      out.push({ k: 'ω just after impact at the given v', v: w2, u: 'rad/s' }, { k: 'Energy lost in the impact', v: 0.5 * m * v * v - T, u: u.E });
      if (!tips) warn.push(`At ${fmt(v)} ${u.V} G rises to ${fmt(cg)} ${u.L} only and the block falls back.`);
    }
    return DY.result(`v_min = ${fmt(vmin)} ${u.V}${tips === null ? '' : tips ? ', it tips over' : ', it falls back'}`, warn.length ? 'warn' : 'ok', out, S, { scene: 'eimpact', task: 'tip', u, m, b, h, v: v > 0 ? v : vmin, vmin, ID, rD, span: [0, 1] }, warn);
  }
  /** A body lands on a rough floor and does not slip during the impact. */
  function landSolve(m, IG, rho, v1, w1, e) {
    // unknowns vx, vy, ω (ω + ccw). ρ = A − G. H_A = I_Gω − m(ρ_x v_y − ρ_y v_x); v_A = (v_x − ωρ_y, v_y + ωρ_x)
    const H1 = IG * w1 - m * (rho[0] * v1[1] - rho[1] * v1[0]), vA1y = v1[1] + w1 * rho[0];
    const A = [[m * rho[1], -m * rho[0], IG], [1, 0, -rho[1]], [0, 1, rho[0]]], bb = [H1, 0, -e * vA1y];
    const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A), col = (j) => A.map((r, i) => r.map((x, k) => (k === j ? bb[i] : x)));
    return { vx: det(col(0)) / D, vy: det(col(1)) / D, w: det(col(2)) / D, H1, vA1y };
  }
  function land(st, u) {
    const S = Steps(), out = [], warn = [];
    const m = DY.toBase(+st.xedm, 'M', u), e = +st.xede, sp = nz(st.xedv, 0), ang = nz(st.xedang, 90) * D2R, w1 = nz(st.xedw, 0), disk = st.xeshape !== 'rod';
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the body.`);
    if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution e must be from 0 to 1.');
    let IG, rho, desc;
    if (disk) { const r = +st.xedr; if (!(r > 0)) return fail('Enter the radius.'); IG = 0.5 * m * r * r; rho = [0, -r]; desc = `Disk: I_G = ½mr² = ${fmt(IG)} ${u.I}; it touches the floor at A directly below G.`; }
    else { const l = +st.xedl, b = nz(st.xedb, 0) * D2R; if (!(l > 0)) return fail('Enter the length of the rod.'); if (!(b > 0 && b < Math.PI / 2)) return fail('The rod must make an angle between 0° and 90° with the floor.'); IG = (m * l * l) / 12; rho = [(-l / 2) * Math.cos(b), (-l / 2) * Math.sin(b)]; desc = `Slender rod: I_G = (1/12)ml² = ${fmt(IG)} ${u.I}; its lower end A touches the floor, ${fmt(l / 2)} ${u.L} from G at ${fmt(b / D2R)}° to the floor.`; }
    const v1 = [sp * Math.cos(ang), -sp * Math.sin(ang)];
    if (!(v1[1] + w1 * rho[0] < 0)) return fail('The contact point is not moving down onto the floor, so there is no impact.');
    const k = landSolve(m, IG, rho, v1, w1, e);
    S.add({ t: 'Body and contact point', n: desc, s: `v₁ = ${fmt(sp)} ${u.V} at ${fmt(ang / D2R)}° below the horizontal (+x to the right), ω₁ = ${fmt(w1)} rad/s${sense(w1)}`, r: `(v_A)₁ vertical = ${fmt(k.vA1y)} ${u.V}` });
    S.add({ t: 'Conservation of angular momentum about A', n: 'The floor’s impulses act at A, and the weight is nonimpulsive.', f: '(H_A)₁ = (H_A)₂;  H_A = I_Gω + (r_G/A × m v_G)', r: `(H_A)₁ = ${fmt(k.H1)} ${u.us ? 'slug·ft²/s' : 'kg·m²/s'}` });
    S.add({ t: 'No slip and restitution at A', f: '(v_A)₂ along the floor = 0;   (v_A)₂ up = −e (v_A)₁ down', s: `(v_A)₂ = ${fmt(-e * k.vA1y)} ${u.V} up`, r: `v_G = (${fmt(k.vx)}, ${fmt(k.vy)}) ${u.V},  ω₂ = ${fmt(k.w)} rad/s${sense(k.w)}` });
    const vG = Math.hypot(k.vx, k.vy), dir = Math.atan2(k.vy, k.vx) / D2R;
    out.push({ k: 'Angular velocity after, ω₂ (+ ccw)', v: k.w, u: 'rad/s', hl: true }, { k: 'Speed of G after, v_G', v: vG, u: u.V, hl: true }, { k: 'Direction of v_G from +x', v: dir, u: '°' }, { k: 'Energy lost', v: 0.5 * m * sp * sp + 0.5 * IG * w1 * w1 - 0.5 * m * vG * vG - 0.5 * IG * k.w * k.w, u: u.E });
    return DY.result(`ω₂ = ${fmt(k.w)} rad/s, v_G = ${fmt(vG)} ${u.V} at ${fmt(dir)}°`, 'ok', out, S, { scene: 'eimpact', task: 'land', u, m, IG, rho, disk, l: +st.xedl, r: +st.xedr, beta: nz(st.xedb, 0) * D2R, v1, w1, v2: [k.vx, k.vy], w2: k.w, span: [0, 1] }, warn);
  }

  const RbSys = { SCENES, defaults, convert, solve, gearArmJ, twoBarAt, twoBarJ, landSolve };
  root.RbSys = RbSys;
  if (typeof module !== 'undefined' && module.exports) module.exports = RbSys;
})(typeof window !== 'undefined' ? window : globalThis);
