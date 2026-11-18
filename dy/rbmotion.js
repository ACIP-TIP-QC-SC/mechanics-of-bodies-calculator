/* =====================================================================
 * DYNAMICS · D5 Planar Kinematics of a Rigid Body (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Sections 16.3 and 16.5 to 16.7.
 *   Fixed axis: ω = ω₀ + α_c t, ω² = ω₀² + 2α_c θ; v = ωr, a_t = αr, a_n = ω²r       (16–4 to 16–14)
 *   Relative velocity: v_B = v_A + ω × r_B/A                                           (16–16)
 *   Instantaneous centre of zero velocity: v = ω r_P/IC                                (16.6)
 *   Relative acceleration: a_B = a_A + α × r_B/A − ω²r_B/A                              (16–18)
 *   Rolling without slipping: v_G = ωr, a_G = αr                                       (16–20)
 * Modes: rotation about a fixed axis with a gear or belt drive, a slider-crank, a four-bar linkage,
 * a wheel or spool rolling without slipping, and a bar whose ends slide on a wall and a floor.
 * Signs: angular quantities are + counterclockwise (k points out of the page).
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180, TAU = 2 * Math.PI;

  function defaults() {
    return {
      mode: 'slider',
      // fixed axis and drive
      w0: 0, al: 2, by: 'rev', tt: 2, rev: 2, rA: 0.15, rB: 0.4, link: 'belt', rP: 0.4,
      // slider-crank
      r: 0.25, l: 0.75, th: 45, beta: 90, wAB: -10, aAB: -20, e: 0,
      // four-bar
      a4: 0.1, b4: 0.25, c4: 0.2, d4: 0.25, th4: 60, w4: 10, al4: 0,
      // rolling
      surf: 'floor', R: 0.5, Ro: 0.75, w: -6, alr: -4, rho: 0.5, phi: 270,
      // bar on a wall and floor
      L: 0.2, thb: 45, vA: 2, aA: 0,
    };
  }
  const KINDS = { rA: 'L', rB: 'L', rP: 'L', r: 'L', l: 'L', e: 'L', a4: 'L', b4: 'L', c4: 'L', d4: 'L', R: 'L', Ro: 'L', rho: 'L', L: 'L', vA: 'V', aA: 'A' };
  function convertState(st, from, to) { return DY.convertObj(st, KINDS, from, to); }

  /* small vector helpers (2D; k × r = (−r_y, r_x)) */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const kx = (r) => [-r[1], r[0]], len = (a) => Math.hypot(a[0], a[1]), ang = (a) => Math.atan2(a[1], a[0]) / D2R;
  const vtxt = (v, unit) => `(${fmt(v[0])}i + ${fmt(v[1])}j) ${unit}`.replace(/\+ −/g, '− ');
  const sense = (w) => (Math.abs(w) < 1e-12 ? '' : w > 0 ? ' ↺' : ' ↻');
  /** Solve [c1 c2][x y]ᵀ = rhs for 2D column vectors c1, c2. */
  function solve2(c1, c2, rhs) {
    const det = c1[0] * c2[1] - c2[0] * c1[1];
    if (Math.abs(det) < 1e-12) return null;
    return [(rhs[0] * c2[1] - c2[0] * rhs[1]) / det, (c1[0] * rhs[1] - rhs[0] * c1[1]) / det];
  }
  /** IC of a body from one point P with velocity vP and its angular velocity w: I = P + (k × vP)/ω. */
  const icOf = (P, vP, w) => (Math.abs(w) < 1e-12 ? null : add(P, mul(kx(vP), 1 / w)));

  function solve(st, U) {
    const u = DY.units(U);
    switch (st.mode) {
      case 'fixed': return fixed(st, u);
      case 'fourbar': return fourbar(st, u);
      case 'roll': return roll(st, u);
      case 'bar': return bar(st, u);
      default: return slider(st, u);
    }
  }

  /* ---------------- Rotation about a fixed axis, with a drive ---------------- */
  function fixed(st, u) {
    const S = Steps(), out = [];
    const w0 = +st.w0, al = +st.al, rA = +st.rA, rB = +st.rB, rP = +st.rP;
    if (!isFinite(w0) || !isFinite(al)) return fail('Enter the starting angular velocity and the angular acceleration.');
    if (!(rA > 0)) return fail('Enter the radius of the driving wheel A.');
    let t, th;
    if (st.by === 'time') {
      t = +st.tt; if (!(t >= 0)) return fail('Enter the time.');
      th = w0 * t + 0.5 * al * t * t;
      S.add({ t: 'Angular motion of A (constant α)', f: 'ω = ω₀ + α_c t;  θ = θ₀ + ω₀t + ½α_c t²', s: `ω = ${fmt(w0)} + ${fmt(al)}(${fmt(t)})`, r: `ω_A = ${fmt(w0 + al * t)} rad/s, θ_A = ${fmt(th)} rad = ${fmt(th / TAU)} rev` });
    } else {
      const rev = +st.rev; if (!(rev > 0)) return fail('Enter the number of revolutions.');
      th = rev * TAU * Math.sign(al || w0 || 1);
      const w2 = w0 * w0 + 2 * al * th; if (w2 < 0) return fail('With this deceleration A stops before turning that far.');
      const wE = Math.sign(al || w0 || 1) * Math.sqrt(w2); t = Math.abs(al) > 1e-12 ? (wE - w0) / al : th / w0;
      S.add({ t: 'Angular motion of A (constant α)', n: `${fmt(rev)} rev = ${fmt(rev)}(2π) = ${fmt(Math.abs(th))} rad.`, f: 'ω² = ω₀² + 2α_c(θ − θ₀);  ω = ω₀ + α_c t', s: `ω² = ${fmt(w0)}² + 2(${fmt(al)})(${fmt(th)})`, r: `ω_A = ${fmt(wE)} rad/s after t = ${fmt(t)} s` });
    }
    const wA = w0 + al * t;
    let wB = wA, aB = al, ratio = 1, sgn = 1;
    if (st.link !== 'none') {
      if (!(rB > 0)) return fail('Enter the radius of wheel B.');
      ratio = rA / rB; sgn = st.link === 'gear' ? -1 : 1; wB = sgn * wA * ratio; aB = sgn * al * ratio;
      S.add({ t: st.link === 'gear' ? 'Gears in mesh' : 'Belt drive', n: st.link === 'gear' ? 'The teeth in contact have the same speed and the same tangential acceleration; the gears turn in opposite senses.' : 'The belt does not slip, so it has the same speed and tangential acceleration on both wheels; they turn in the same sense.', f: 'ω_A r_A = ω_B r_B;  α_A r_A = α_B r_B', s: `ω_B = ${fmt(Math.abs(wA))}(${fmt(rA)})/${fmt(rB)},  α_B = ${fmt(Math.abs(al))}(${fmt(rA)})/${fmt(rB)}`, r: `ω_B = ${fmt(wB)} rad/s${sense(wB)}, α_B = ${fmt(aB)} rad/s²` });
    }
    const body = st.link === 'none' ? 'A' : 'B', r = st.link === 'none' ? (rP > 0 ? rP : rA) : rP > 0 ? rP : rB;
    const v = Math.abs((st.link === 'none' ? wA : wB) * r), at = (st.link === 'none' ? al : aB) * r, an = (st.link === 'none' ? wA : wB) ** 2 * r, a = Math.hypot(at, an);
    S.add({ t: `Motion of point P on ${body} (r = ${fmt(r)} ${u.L})`, f: 'v = ωr;  a_t = αr;  a_n = ω²r;  a = √(a_t² + a_n²)', s: `v = ${fmt(Math.abs(body === 'A' ? wA : wB))}(${fmt(r)}),  a_t = ${fmt(Math.abs(body === 'A' ? al : aB))}(${fmt(r)}),  a_n = (${fmt(body === 'A' ? wA : wB)})²(${fmt(r)})`, r: `v_P = ${fmt(v)} ${u.V}, a_t = ${fmt(Math.abs(at))}, a_n = ${fmt(an)}, a_P = ${fmt(a)} ${u.A}` });
    out.push({ k: 'Speed of P, v_P', v, u: u.V, hl: true }, { k: 'Acceleration of P, a_P', v: a, u: u.A, hl: true }, { k: 'Tangential (a_P)_t', v: Math.abs(at), u: u.A }, { k: 'Normal (a_P)_n', v: an, u: u.A }, { k: 'Angular velocity of A, ω_A', v: wA, u: 'rad/s' });
    if (st.link !== 'none') out.push({ k: 'Angular velocity of B, ω_B', v: wB, u: 'rad/s' }, { k: 'Angular acceleration of B, α_B', v: aB, u: 'rad/s²' });
    out.push({ k: 'Time t', v: t, u: 's' }, { k: 'Angle turned by A', v: Math.abs(th) / TAU, u: 'rev' });
    const thA = (tt) => w0 * tt + 0.5 * al * tt * tt;
    return DY.result(`v_P = ${fmt(v)} ${u.V}, a_P = ${fmt(a)} ${u.A}`, 'ok', out, S, { mode: 'fixed', u, rA, rB, rP: r, link: st.link, body, ratio, sgn, w0, al, wA, wB, aB, t, thA, at, an, span: [0, Math.max(t, 1e-6)] }, []);
  }

  /* ---------------- Slider-crank ---------------- */
  /** Position, velocity and acceleration of a slider-crank at crank angle th (rad from the slider axis toward w). */
  function crank(r, l, e, beta, th, wAB, aAB) {
    const uu = [Math.cos(beta), Math.sin(beta)], ww = [-Math.sin(beta), Math.cos(beta)];
    const Bq = add(mul(uu, r * Math.cos(th)), mul(ww, r * Math.sin(th)));
    const off = e - r * Math.sin(th); if (Math.abs(off) > l) return null;
    const s = r * Math.cos(th) + Math.sqrt(l * l - off * off), C = add(mul(uu, s), mul(ww, e)), rCB = sub(C, Bq);
    const vB = mul(kx(Bq), wAB), aB = sub(mul(kx(Bq), aAB), mul(Bq, wAB * wAB));
    const sv = solve2(uu, mul(kx(rCB), -1), vB); if (!sv) return null; // vC uu − ω k×r = vB
    const [vC, wBC] = sv;
    const sa = solve2(uu, mul(kx(rCB), -1), sub(aB, mul(rCB, wBC * wBC))); if (!sa) return null;
    const [aC, aBC] = sa;
    return { A: [0, 0], B: Bq, C, rCB, uu, ww, vB, aB, vC, wBC, aC, aBC, s, icBC: icOf(Bq, vB, wBC) };
  }
  function slider(st, u) {
    const S = Steps(), out = [];
    const r = +st.r, l = +st.l, e = +st.e || 0, th = +st.th * D2R, beta = +st.beta * D2R, wAB = +st.wAB, aAB = +st.aAB;
    if (!(r > 0) || !(l > 0)) return fail('Enter the crank length and the connecting-rod length.');
    if (!isFinite(wAB) || !isFinite(aAB)) return fail('Enter ω and α of the crank.');
    const k = crank(r, l, e, beta, th, wAB, aAB);
    if (!k) return fail('The rod is too short to reach the slider line at this crank angle.');
    S.add({ t: 'Position vectors', n: `A is the fixed crank pin; C slides along a line through A at ${fmt(+st.beta)}° from +x${e ? ` offset ${fmt(e)} ${u.L}` : ''}. Angles are + counterclockwise.`, f: 'r_B = r(cos θ u + sin θ w);  r_C/B from the rod length', r: `r_B = ${vtxt(k.B, u.L)},  r_C/B = ${vtxt(k.rCB, u.L)}` });
    S.add({ t: 'Crank AB (rotation about a fixed axis)', f: 'v_B = ω_AB × r_B;  a_B = α_AB × r_B − ω_AB²r_B', s: `ω_AB = ${fmt(wAB)}k rad/s, α_AB = ${fmt(aAB)}k rad/s²`, r: `v_B = ${vtxt(k.vB, u.V)} (${fmt(len(k.vB))}),  a_B = ${vtxt(k.aB, u.A)}` });
    S.add({ t: 'Rod BC: velocity equation', n: 'C moves along the slider line, so v_C points along it.', f: 'v_C = v_B + ω_BC × r_C/B', s: 'Equate the i and j components and solve the two equations.', r: `ω_BC = ${fmt(k.wBC)} rad/s${sense(k.wBC)},  v_C = ${fmt(k.vC)} ${u.V} along the slider line` });
    if (k.icBC) S.add({ t: 'Check with the instantaneous centre of BC', n: 'The IC lies where the lines perpendicular to v_B and v_C meet.', f: 'v_C = ω_BC r_C/IC', s: `r_C/IC = ${fmt(len(sub(k.C, k.icBC)))} ${u.L}`, r: `v_C = ${fmt(Math.abs(k.wBC))}(${fmt(len(sub(k.C, k.icBC)))}) = ${fmt(Math.abs(k.wBC) * len(sub(k.C, k.icBC)))} ${u.V}` });
    S.add({ t: 'Rod BC: acceleration equation', f: 'a_C = a_B + α_BC × r_C/B − ω_BC²r_C/B', s: 'Equate the i and j components and solve.', r: `α_BC = ${fmt(k.aBC)} rad/s²${sense(k.aBC)},  a_C = ${fmt(k.aC)} ${u.A} along the slider line` });
    out.push({ k: 'Velocity of the slider v_C', v: k.vC, u: u.V, hl: true }, { k: 'Acceleration of the slider a_C', v: k.aC, u: u.A, hl: true }, { k: 'Angular velocity of BC, ω_BC', v: k.wBC, u: 'rad/s', hl: true }, { k: 'Angular acceleration of BC, α_BC', v: k.aBC, u: 'rad/s²' },
      { k: 'Speed of B', v: len(k.vB), u: u.V }, { k: 'Acceleration of B', v: len(k.aB), u: u.A }, { k: 'Rod angle from the slider line', v: Math.abs(Math.asin((e - r * Math.sin(th)) / l)) / D2R, u: '°' });
    const at = (t) => crank(r, l, e, beta, t, wAB, aAB);
    return DY.result(`v_C = ${fmt(k.vC)} ${u.V}, ω_BC = ${fmt(k.wBC)} rad/s, a_C = ${fmt(k.aC)} ${u.A}`, 'ok', out, S, { mode: 'slider', u, r, l, e, beta, th, wAB, aAB, k, at, full: r + Math.abs(e) < l, span: [0, TAU / Math.max(Math.abs(wAB), 1e-9)] }, []);
  }

  /* ---------------- Four-bar linkage ---------------- */
  function fb(a, b, c, d, th, w, al) {
    const B = [a * Math.cos(th), a * Math.sin(th)], Dp = [d, 0], BD = sub(Dp, B), L = len(BD);
    if (L > b + c || L < Math.abs(b - c) || L < 1e-12) return null;
    const x = (b * b - c * c + L * L) / (2 * L), h = Math.sqrt(Math.max(0, b * b - x * x)), ux = mul(BD, 1 / L), C = add(add(B, mul(ux, x)), mul([-ux[1], ux[0]], h)); // open branch (C above BD)
    const rCB = sub(C, B), rCD = sub(C, Dp), vB = mul(kx(B), w), aB = sub(mul(kx(B), al), mul(B, w * w));
    // ω_CD k×r_CD = v_B + ω_BC k×r_CB → ω_BC (k×r_CB) − ω_CD (k×r_CD) = −v_B
    const sv = solve2(kx(rCB), mul(kx(rCD), -1), mul(vB, -1)); if (!sv) return null;
    const [wBC, wCD] = sv, vC = mul(kx(rCD), wCD);
    const rhs = sub(sub(mul(rCB, wBC * wBC), aB), mul(rCD, wCD * wCD)); // α_BC k×r_CB − α_CD k×r_CD = −a_B + ω_BC² r_CB − ω_CD² r_CD
    const sa = solve2(kx(rCB), mul(kx(rCD), -1), rhs); if (!sa) return null;
    const [aBC, aCD] = sa, aC = sub(mul(kx(rCD), aCD), mul(rCD, wCD * wCD));
    return { A: [0, 0], B, C, D: Dp, rCB, rCD, vB, aB, vC, aC, wBC, wCD, aBC, aCD, icBC: (() => { const p = solve2(B, mul(rCD, -1), sub([d, 0], [0, 0])); return p ? mul(B, p[0]) : null; })() };
  }
  function fourbar(st, u) {
    const S = Steps(), out = [];
    const a = +st.a4, b = +st.b4, c = +st.c4, d = +st.d4, th = +st.th4 * D2R, w = +st.w4, al = +st.al4;
    if (!(a > 0 && b > 0 && c > 0 && d > 0)) return fail('Enter all four link lengths.');
    const k = fb(a, b, c, d, th, w, al);
    if (!k) return fail('The links cannot be assembled at this crank angle (the coupler and rocker cannot reach).');
    S.add({ t: 'Positions', n: `Ground link AD = ${fmt(d)} ${u.L} along x, crank AB = ${fmt(a)} at θ = ${fmt(+st.th4)}°, coupler BC = ${fmt(b)}, rocker DC = ${fmt(c)} ${u.L} (the branch with C above BD).`, r: `r_B = ${vtxt(k.B, u.L)},  r_C/B = ${vtxt(k.rCB, u.L)},  r_C/D = ${vtxt(k.rCD, u.L)}` });
    S.add({ t: 'Crank AB', f: 'v_B = ω_AB × r_B;  a_B = α_AB × r_B − ω_AB²r_B', r: `v_B = ${vtxt(k.vB, u.V)},  a_B = ${vtxt(k.aB, u.A)}` });
    S.add({ t: 'Velocity of C two ways', f: 'v_C = ω_CD × r_C/D = v_B + ω_BC × r_C/B', s: 'Equate i and j components: two equations in ω_BC and ω_CD.', r: `ω_BC = ${fmt(k.wBC)} rad/s${sense(k.wBC)},  ω_CD = ${fmt(k.wCD)} rad/s${sense(k.wCD)},  v_C = ${fmt(len(k.vC))} ${u.V}` });
    if (k.icBC) S.add({ t: 'Instantaneous centre of BC', n: 'Where lines AB and DC (extended) meet, since v_B ⟂ AB and v_C ⟂ DC.', r: `IC at (${fmt(k.icBC[0])}, ${fmt(k.icBC[1])}) ${u.L}` });
    S.add({ t: 'Acceleration of C two ways', f: 'α_CD × r_C/D − ω_CD²r_C/D = a_B + α_BC × r_C/B − ω_BC²r_C/B', s: 'Equate i and j components and solve.', r: `α_BC = ${fmt(k.aBC)} rad/s²,  α_CD = ${fmt(k.aCD)} rad/s²` });
    out.push({ k: 'Angular velocity of BC, ω_BC', v: k.wBC, u: 'rad/s', hl: true }, { k: 'Angular velocity of CD, ω_CD', v: k.wCD, u: 'rad/s', hl: true }, { k: 'Angular acceleration of BC, α_BC', v: k.aBC, u: 'rad/s²' }, { k: 'Angular acceleration of CD, α_CD', v: k.aCD, u: 'rad/s²' },
      { k: 'Speed of B', v: len(k.vB), u: u.V }, { k: 'Speed of C', v: len(k.vC), u: u.V }, { k: 'Acceleration of C', v: len(k.aC), u: u.A });
    const lens = [a, b, c, d].sort((x, y) => x - y), grashof = lens[0] + lens[3] <= lens[1] + lens[2] + 1e-12, crankRot = grashof && Math.min(a, b, c, d) === a;
    out.push({ k: 'Crank can turn all the way round', v: crankRot ? 'yes (Grashof crank)' : 'no, it rocks', u: '' });
    return DY.result(`ω_BC = ${fmt(k.wBC)}, ω_CD = ${fmt(k.wCD)} rad/s`, 'ok', out, S, { mode: 'fourbar', u, a, b, c, d, th, w, al, k, at: (t) => fb(a, b, c, d, t, w, al), full: crankRot, span: [0, TAU / Math.max(Math.abs(w), 1e-9)] }, []);
  }

  /* ---------------- Rolling without slipping ---------------- */
  function roll(st, u) {
    const S = Steps(), out = [];
    const R = +st.R, Ro = Math.max(+st.Ro || 0, R), w = +st.w, al = +st.alr, rho = +st.rho, phi = +st.phi * D2R;
    if (!(R > 0)) return fail('Enter the radius it rolls on.');
    if (!isFinite(w) || !isFinite(al)) return fail('Enter ω and α.');
    if (!(rho >= 0)) return fail('Enter the distance from G to the point P.');
    const n = st.surf === 'cord' ? [1, 0] : [0, 1], rG = mul(n, R); // G relative to the contact point
    const vG = mul(kx(rG), w), aG = mul(kx(rG), al), rP = [rho * Math.cos(phi), rho * Math.sin(phi)];
    S.add({ t: 'Motion of the centre G', n: st.surf === 'cord' ? 'It unwinds from a fixed vertical cord on its left, so it rolls without slipping down the cord.' : 'It rolls without slipping on a fixed floor, so the contact point has zero velocity.', f: 'v_G = ωr;  a_G = αr (along the surface)', s: `ω = ${fmt(w)} rad/s, α = ${fmt(al)} rad/s², r = ${fmt(R)} ${u.L}`, r: `v_G = ${vtxt(vG, u.V)},  a_G = ${vtxt(aG, u.A)}` });
    const vP = add(vG, mul(kx(rP), w)), aP = sub(add(aG, mul(kx(rP), al)), mul(rP, w * w));
    S.add({ t: 'Velocity of P', f: 'v_P = v_G + ω × r_P/G  (or v_P = ω × r_P/IC, IC at the contact point)', s: `r_P/G = ${vtxt(rP, u.L)}`, r: `v_P = ${vtxt(vP, u.V)} = ${fmt(len(vP))} ${u.V}` });
    S.add({ t: 'Acceleration of P', f: 'a_P = a_G + α × r_P/G − ω²r_P/G', r: `a_P = ${vtxt(aP, u.A)} = ${fmt(len(aP))} ${u.A} at ${fmt(ang(aP))}°` });
    const cA = mul(rG, -1), aC = sub(add(aG, mul(kx(cA), al)), mul(cA, w * w));
    out.push({ k: 'Speed of P, v_P', v: len(vP), u: u.V, hl: true }, { k: 'Acceleration of P, a_P', v: len(aP), u: u.A, hl: true }, { k: 'Direction of a_P from +x', v: ang(aP), u: '°' }, { k: 'Speed of G, v_G', v: len(vG), u: u.V }, { k: 'Acceleration of G, a_G', v: len(aG), u: u.A }, { k: 'Acceleration of the contact point', v: len(aC), u: u.A });
    return DY.result(`v_P = ${fmt(len(vP))} ${u.V}, a_P = ${fmt(len(aP))} ${u.A}`, 'ok', out, S, { mode: 'roll', u, R, Ro, w, al, rho, phi, n, vG, aG, rP, vP, aP, surf: st.surf, span: [0, TAU / Math.max(Math.abs(w), 1e-9)] }, []);
  }

  /* ---------------- Bar with ends on a wall and a floor ---------------- */
  function barAt(L, th, vA, aA) {
    // A on the wall (x = 0) above, B on the floor (y = 0); θ between the bar and the floor; v_A, a_A are + downward
    const A = [0, L * Math.sin(th)], Bp = [L * Math.cos(th), 0], rBA = sub(Bp, A), vAv = [0, -vA], aAv = [0, -aA];
    const sv = solve2([1, 0], mul(kx(rBA), -1), vAv); if (!sv) return null; // v_B i − ω k×r = v_A
    const [vB, w] = sv;
    const sa = solve2([1, 0], mul(kx(rBA), -1), sub(aAv, mul(rBA, w * w))); if (!sa) return null;
    const [aB, al] = sa, G = mul(add(A, Bp), 0.5);
    return { A, B: Bp, G, rBA, vA: vAv, aA: aAv, vB, aB, w, al, vG: add(vAv, mul(kx(sub(G, A)), w)), ic: [Bp[0], A[1]] };
  }
  function bar(st, u) {
    const S = Steps(), out = [];
    const L = +st.L, th = +st.thb * D2R, vA = +st.vA, aA = +st.aA;
    if (!(L > 0)) return fail('Enter the length of the bar.');
    if (!(th > 0 && th < Math.PI / 2)) return fail('The angle between the bar and the floor must be between 0° and 90°.');
    if (!isFinite(vA) || !isFinite(aA)) return fail('Enter the velocity and acceleration of A.');
    const k = barAt(L, th, vA, aA);
    S.add({ t: 'Kinematic diagram', n: 'End A slides on the wall and end B on the floor, so v_A is vertical and v_B horizontal.', f: 'r_B/A = L cos θ i − L sin θ j', r: `r_B/A = ${vtxt(k.rBA, u.L)}` });
    S.add({ t: 'Velocity equation', f: 'v_B = v_A + ω × r_B/A', s: `v_B i = ${fmt(-vA)}j + ωk × (${fmt(k.rBA[0])}i ${k.rBA[1] < 0 ? '−' : '+'} ${fmt(Math.abs(k.rBA[1]))}j)`, r: `ω = ${fmt(k.w)} rad/s${sense(k.w)},  v_B = ${fmt(k.vB)} ${u.V}` });
    S.add({ t: 'Check with the instantaneous centre', n: 'The IC is where the perpendiculars to v_A (horizontal through A) and v_B (vertical through B) meet.', f: 'ω = v_A/r_A/IC;  v_B = ω r_B/IC', s: `r_A/IC = L cos θ = ${fmt(L * Math.cos(th))},  r_B/IC = L sin θ = ${fmt(L * Math.sin(th))}`, r: `ω = ${fmt(Math.abs(vA) / (L * Math.cos(th)))} rad/s, v_B = ${fmt(Math.abs(vA) * Math.tan(th))} ${u.V}` });
    S.add({ t: 'Acceleration equation', f: 'a_B = a_A + α × r_B/A − ω²r_B/A', r: `α = ${fmt(k.al)} rad/s²${sense(k.al)},  a_B = ${fmt(k.aB)} ${u.A}` });
    out.push({ k: 'Angular velocity ω', v: k.w, u: 'rad/s', hl: true }, { k: 'Velocity of B, v_B', v: k.vB, u: u.V, hl: true }, { k: 'Angular acceleration α', v: k.al, u: 'rad/s²' }, { k: 'Acceleration of B, a_B', v: k.aB, u: u.A }, { k: 'Speed of the midpoint G', v: len(k.vG), u: u.V });
    return DY.result(`ω = ${fmt(k.w)} rad/s, v_B = ${fmt(k.vB)} ${u.V}`, 'ok', out, S, { mode: 'bar', u, L, th, vA, aA, k, at: (t) => barAt(L, t, vA, aA), span: [0, 1] }, []);
  }

  const RbMotion = { defaults, convertState, solve, crank, fb, barAt };
  root.RbMotion = RbMotion;
  if (typeof module !== 'undefined' && module.exports) module.exports = RbMotion;
})(typeof window !== 'undefined' ? window : globalThis);
