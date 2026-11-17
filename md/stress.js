/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M1 Simple Stress and Strain
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapters 7 and 8.
 *   bar     bar under an axial load: σ = N/A, ε = σ/E, δ = εL, Poisson's ratio
 *           ε_lat = −ν ε, G = E/(2(1 + ν))                          (7.4, 8.2, 8.5, 8.6)
 *   hanger  a weight hung from two rods: rod forces, average normal stress,
 *           elongations and the movement of the joint               (7.4)
 *   joint   bolted or pinned joint: bolt shear τ = V/A (single or double shear),
 *           bearing σ_b = P/(d t), plate tension on the net section, tear-out;
 *           stresses for a load, or the allowable load (7.5, 7.6)
 *   size    sizing by allowable stress: pin or rod diameter, plate thickness for
 *           punching shear, collar diameter for bearing; σ_allow = σ_fail/F.S. (7.6)
 *   curve   stress-strain data: E, proportional limit, 0.2 % offset yield, ultimate
 *           and fracture stress, moduli of resilience and toughness, permanent set
 *           after unloading (8.1 to 8.4)
 *   pad     block in simple shear: τ = V/A, γ = τ/G, sideways movement (7.8, 8.6)
 * Inputs are stored in the units shown beside them; the solver works in base units.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const DEG = Math.PI / 180;

  function defaults() {
    return {
      mode: 'bar', fu: 'kN',
      bar: { shape: 'rect', d: 20, di: 12, b: 100, h: 50, A: 500, L: 1.5, P: 80, mat: 'a36', E: 200, nu: 0.32, sY: 250 },
      hg: { wBy: 'mass', m: 80, W: 0.7848, a1: 60, a2: 36.87, d1: 10, d2: 8, L1: 1.2, L2: 1.5, mat: 'a36', E: 200, sY: 250 },
      jt: { task: 'allow', P: 10, d: 10, n: 1, planes: 1, t: 15, w: 50, e: 20, tb: 80, st: 50, sb: 80, tp: 30 },
      sz: { part: 'pin', P: 20, planes: 1, byFS: false, fail: 120, FS: 1.5, allow: 60, dh: 40, di: 60, step: 1 },
      cv: { pts: [{ e: 0, s: 0 }, { e: 0.0016, s: 50 }, { e: 0.004, s: 62 }, { e: 0.01, s: 72 }, { e: 0.05, s: 95 }, { e: 0.1, s: 106 }, { e: 0.15, s: 108 }, { e: 0.2, s: 100 }, { e: 0.23, s: 90 }], nLin: 1, unload: false, sU: 100 },
      pad: { given: 'force', a: 150, b: 100, h: 20, V: 2, dx: 1, G: 0.2, useEnu: false, E: 0.6, nu: 0.5 },
    };
  }
  /* kind of every numeric input, for switching units */
  const KINDS = {
    bar: { d: 'S', di: 'S', b: 'S', h: 'S', A: 'A', L: 'L', P: 'F', E: 'MOD', sY: 'ST' },
    hg: { m: 'MASS', W: 'F', d1: 'S', d2: 'S', L1: 'L', L2: 'L', E: 'MOD', sY: 'ST' },
    jt: { P: 'F', d: 'S', t: 'S', w: 'S', e: 'S', tb: 'ST', st: 'ST', sb: 'ST', tp: 'ST' },
    sz: { P: 'F', fail: 'ST', allow: 'ST', dh: 'S', di: 'S', step: 'S' },
    pad: { a: 'S', b: 'S', h: 'S', V: 'F', dx: 'S', G: 'MOD', E: 'MOD' },
  };
  function convertState(st, from, to) {
    if (from === to) return st;
    Object.keys(KINDS).forEach((g) => MD.convertObj(st[g], KINDS[g], from, to, st.fu));
    if (st.cv && st.cv.pts) {
      const k = Core.convert(1, units(Core.UNITS[from]).ST, units(Core.UNITS[to]).ST);
      st.cv.pts.forEach((p) => (p.s = Core.tidy(p.s * k, 6))); st.cv.sU = Core.tidy(st.cv.sU * k, 6);
    }
    // material values that came from the table are reloaded for the new system
    st.fu = Core.twin(st.fu, to);
    return st;
  }

  function solve(st, U) {
    const u = units(U, st.fu);
    if (st.mode === 'hanger') return hanger(st.hg, U, u);
    if (st.mode === 'joint') return joint(st.jt, u);
    if (st.mode === 'size') return size(st.sz, u);
    if (st.mode === 'curve') return curve(st.cv, u);
    if (st.mode === 'pad') return pad(st.pad, u);
    return bar(st.bar, u);
  }
  const R = MD.result;
  const mic = (x) => `${fmt(x * 1e6)}(10⁻⁶)`;

  /* ------------------------------------------------------------------ */
  /* Bar under an axial load                                            */
  /* ------------------------------------------------------------------ */
  function bar(q, u) {
    const err = [], ae = MD.barAreaErr(q, u.S);
    if (ae) err.push(ae);
    if (!(q.L > 0)) err.push('Enter the length of the bar.');
    if (!isFinite(+q.P) || +q.P === 0) err.push('Enter the axial load P (positive for tension, negative for compression).');
    if (!(q.E > 0)) err.push('Enter the modulus of elasticity E.');
    if (!(q.nu >= 0 && q.nu < 0.5)) err.push("Poisson's ratio must be from 0 to less than 0.5.");
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], ar = MD.barArea(q);
    const Ab = B(ar.A, u.A), P = B(+q.P, u.F), L = B(+q.L, u.L), E = B(+q.E, u.MOD), nu = +q.nu;
    const sig = P / Ab, eps = sig / E, del = eps * L, elat = -nu * eps, G = E / (2 * (1 + nu));
    const ten = P > 0;
    S.add({ t: 'Internal normal force', n: 'Pass a section through the bar. For equilibrium of either part the internal force equals the applied load.', r: `N = ${fmt(+q.P)} ${u.F} (${ten ? 'tension' : 'compression'})` });
    S.add({ t: 'Cross-sectional area', f: ar.f, s: `${ar.s}`, r: `A = ${fmt(ar.A)} ${u.A}` });
    S.add({ t: 'Average normal stress', n: 'The load acts through the centroid of the section, so the stress is uniform over it.', f: 'σ = N/A', s: `σ = ${fmt(+q.P)} ${u.F} / ${fmt(ar.A)} ${u.A}`, r: `σ = ${MD.show(sig, u.ST)} (${ten ? 'T' : 'C'})` });
    const sY = B(+q.sY || 0, u.ST);
    if (sY > 0 && Math.abs(sig) > sY) warn.push(`The stress is above the yield stress (${fmt(+q.sY)} ${u.ST}), so Hooke's law no longer applies and the strains below are not valid.`);
    S.add({ t: "Normal strain (Hooke's law)", n: 'The material is linear elastic, so the strain is proportional to the stress.', f: 'ε = σ/E', s: `ε = ${MD.show(sig, u.ST)} / ${fmt(+q.E)} ${u.MOD}`, r: `ε_long = ${mic(eps)} ${u.S}/${u.S}` });
    S.add({ t: 'Change in length', f: 'δ = ε L', s: `δ = ${mic(eps)}(${fmt(+q.L)} ${u.L})`, r: `δ = ${MD.show(del, u.S)} (${ten ? 'longer' : 'shorter'})` });
    S.add({ t: "Lateral strain from Poisson's ratio", f: 'ε_lat = −ν ε_long', s: `ε_lat = −${fmt(nu)}(${mic(eps)})`, r: `ε_lat = ${mic(elat)} ${u.S}/${u.S}` });
    out.push({ k: 'Cross-sectional area A', v: ar.A, u: u.A });
    out.push({ k: 'Normal stress σ', v: D(sig, u.ST), u: u.ST, hl: true });
    out.push({ k: 'Normal strain ε (along the bar)', v: eps, u: `${u.S}/${u.S}` });
    out.push({ k: 'Change in length δ', v: D(del, u.S), u: u.S, hl: true });
    out.push({ k: 'Lateral strain ε_lat', v: elat, u: `${u.S}/${u.S}` });
    const lat = [];
    if (q.shape === 'rect') { lat.push(['Change in width b', q.b], ['Change in depth h', q.h]); }
    else if (q.shape === 'circle') lat.push(['Change in diameter d', q.d]);
    else if (q.shape === 'tube') lat.push(['Change in outer diameter', q.d], ['Change in inner diameter', q.di]);
    if (lat.length) S.add({ t: 'Change in the cross-section', f: 'δ_lat = ε_lat × (dimension)', s: lat.map(([k, dim]) => `${fmt(elat * 1e6)}(10⁻⁶)(${fmt(dim)} ${u.S})`).join(';   '), r: lat.map(([k, dim]) => `${k.replace('Change in ', 'Δ')} = ${fmt(elat * dim)} ${u.S}`).join(',  ') });
    lat.forEach(([k, dim]) => out.push({ k, v: elat * dim, u: u.S }));
    S.add({ t: 'Shear modulus', f: 'G = E / (2(1 + ν))', s: `G = ${fmt(+q.E)} / (2(1 + ${fmt(nu)}))`, r: `G = ${MD.show(G, u.MOD)}` });
    out.push({ k: 'Shear modulus G', v: D(G, u.MOD), u: u.MOD });
    if (sY > 0) out.push({ k: 'Factor of safety against yield σY/σ', v: sY / Math.abs(sig), u: '' });
    const geo = { kind: 'bar', q, ten, sig, eps, elat, del, u };
    return R(`σ = ${MD.show(sig, u.ST)} (${ten ? 'T' : 'C'})`, warn.length ? 'warn' : 'ok', out, S, geo, warn);
  }

  /* ------------------------------------------------------------------ */
  /* A weight hung from two rods                                        */
  /* ------------------------------------------------------------------ */
  function hanger(q, U, u) {
    const err = [];
    const a1 = +q.a1, a2 = +q.a2;
    if (!(a1 > 0 && a1 < 180) || !(a2 > 0 && a2 < 180)) err.push('Each rod angle must be between 0° and 180° above the horizontal.');
    if (a1 + a2 >= 180) err.push('The two rods must slope up to supports on opposite sides of the joint.');
    if (!(q.d1 > 0 && q.d2 > 0)) err.push('Enter the diameter of each rod.');
    if (!(q.L1 > 0 && q.L2 > 0)) err.push('Enter the length of each rod.');
    if (!(q.E > 0)) err.push('Enter the modulus of elasticity E.');
    const byMass = q.wBy === 'mass', Wb = byMass ? +q.m * U.g * (U.id === 'US' ? Core.unitFactor('lb') : 1) : B(+q.W, u.F);
    if (!(Wb > 0)) err.push('The weight must be greater than zero.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [];
    const c1 = Math.cos(a1 * DEG), s1 = Math.sin(a1 * DEG), c2 = Math.cos(a2 * DEG), s2 = Math.sin(a2 * DEG);
    // rod 1 pulls B up and to the left, rod 2 up and to the right
    const det = s1 * c2 + c1 * s2, F1 = (Wb * c2) / det, F2 = (Wb * c1) / det;
    const Wd = D(Wb, u.F);
    S.add({ t: 'Weight', r: byMass ? `W = mg = ${fmt(+q.m)}(${fmt(U.g)}) = ${fmt(+q.m * U.g)} ${U.id === 'US' ? 'lb' : 'N'} = ${fmt(Wd)} ${u.F}` : `W = ${fmt(Wd)} ${u.F}` });
    S.add({ t: 'Equilibrium of the joint B', n: 'Free-body diagram of the ring at B: the weight down, rod 1 pulling toward its support on the left and rod 2 toward its support on the right.',
      f: '→ ΣFx = 0;  + ↑ ΣFy = 0', s: `F₂ cos ${fmt(a2)}° − F₁ cos ${fmt(a1)}° = 0;   F₂ sin ${fmt(a2)}° + F₁ sin ${fmt(a1)}° − ${fmt(Wd)} = 0`, r: `F₁ = ${MD.show(F1, u.F)},  F₂ = ${MD.show(F2, u.F)}` });
    const A1 = B((Math.PI / 4) * q.d1 * q.d1, u.A), A2 = B((Math.PI / 4) * q.d2 * q.d2, u.A), sg1 = F1 / A1, sg2 = F2 / A2;
    S.add({ t: 'Average normal stress in each rod', f: 'σ = N/A,  A = πd²/4', s: `σ₁ = ${fmt(D(F1, u.F))} ${u.F} / ${fmt((Math.PI / 4) * q.d1 * q.d1)} ${u.A};   σ₂ = ${fmt(D(F2, u.F))} ${u.F} / ${fmt((Math.PI / 4) * q.d2 * q.d2)} ${u.A}`, r: `σ₁ = ${MD.show(sg1, u.ST)},  σ₂ = ${MD.show(sg2, u.ST)}` });
    const E = B(+q.E, u.MOD), L1 = B(+q.L1, u.L), L2 = B(+q.L2, u.L), d1 = (F1 * L1) / (A1 * E), d2 = (F2 * L2) / (A2 * E);
    S.add({ t: 'Elongation of each rod', f: 'δ = NL/(AE)', s: `δ₁ = ${fmt(D(F1, u.F))}(${fmt(+q.L1)}) / [(${fmt((Math.PI / 4) * q.d1 * q.d1)})(${fmt(+q.E)})];   δ₂ likewise`, r: `δ₁ = ${MD.show(d1, u.S)},  δ₂ = ${MD.show(d2, u.S)}` });
    // movement of B: its component along each rod (from the support toward B) equals that rod's elongation
    const e1 = [c1, -s1], e2 = [-c2, -s2], dt = e1[0] * e2[1] - e1[1] * e2[0];
    const ux = (d1 * e2[1] - d2 * e1[1]) / dt, uy = (e1[0] * d2 - e2[0] * d1) / dt;
    S.add({ t: 'Movement of the joint B', n: 'For small movements, the component of the displacement of B along each rod equals that rod\'s elongation (u · e = δ, with e pointing from the support to B).', f: 'u · e₁ = δ₁;  u · e₂ = δ₂', r: `u_x = ${MD.show(ux, u.S)},  u_y = ${MD.show(uy, u.S)} (total ${MD.show(Math.hypot(ux, uy), u.S)})` });
    const sY = B(+q.sY || 0, u.ST);
    if (sY > 0 && Math.max(sg1, sg2) > sY) warn.push('A rod is stressed above the yield stress.');
    out.push({ k: 'Force in rod 1, F₁', v: D(F1, u.F), u: u.F }, { k: 'Force in rod 2, F₂', v: D(F2, u.F), u: u.F });
    out.push({ k: 'Stress in rod 1, σ₁', v: D(sg1, u.ST), u: u.ST, hl: true }, { k: 'Stress in rod 2, σ₂', v: D(sg2, u.ST), u: u.ST, hl: true });
    out.push({ k: 'Elongation of rod 1, δ₁', v: D(d1, u.S), u: u.S }, { k: 'Elongation of rod 2, δ₂', v: D(d2, u.S), u: u.S });
    out.push({ k: 'Horizontal movement of B', v: D(ux, u.S), u: u.S }, { k: 'Vertical movement of B', v: D(uy, u.S), u: u.S });
    const geo = { kind: 'hanger', q, W: Wd, F1: D(F1, u.F), F2: D(F2, u.F), s1: D(sg1, u.ST), s2: D(sg2, u.ST), ux, uy, d1, d2, Lb1: L1, Lb2: L2, u };
    return R(`σ_max = ${MD.show(Math.max(sg1, sg2), u.ST)}`, warn.length ? 'warn' : 'ok', out, S, geo, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Bolted or pinned joint                                             */
  /* ------------------------------------------------------------------ */
  function joint(q, u) {
    const err = [];
    const n = Math.round(+q.n), pl = Math.round(+q.planes);
    if (!(q.d > 0)) err.push('Enter the bolt or pin diameter.');
    if (!(n >= 1)) err.push('There must be at least one bolt.');
    if (!(pl === 1 || pl === 2)) err.push('Choose single or double shear.');
    if (!(q.t > 0)) err.push('Enter the plate thickness.');
    const useNet = q.w > 0, useTear = q.e > 0;
    if (useNet && !(q.w > n * q.d)) err.push('The plate must be wider than the holes across it.');
    if (q.task === 'check' && !(q.P > 0)) err.push('Enter the load P.');
    if (q.task === 'allow' && !(q.tb > 0 || q.st > 0 || q.sb > 0 || q.tp > 0)) err.push('Enter at least one allowable stress.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], d = +q.d, t = +q.t;
    const Ab = n * pl * (Math.PI / 4) * d * d, Abr = n * d * t, An = useNet ? (q.w - n * q.d) * t : 0, At = useTear ? 2 * n * q.e * t : 0;
    S.add({ t: 'Areas that resist the load', n: `${n} bolt${n > 1 ? 's' : ''} in ${pl === 1 ? 'single' : 'double'} shear. The bearing area is the projected area d t of each hole; the net section is the plate width less the holes; tear-out happens along two planes beside each bolt, from the bolt to the plate end.`,
      f: 'A_shear = n(planes)(πd²/4);  A_b = n d t;  A_net = (w − n d) t;  A_tear = 2 n e t',
      s: `A_shear = ${n}(${pl})π(${fmt(d)})²/4;  A_b = ${n}(${fmt(d)})(${fmt(t)})${useNet ? `;  A_net = (${fmt(+q.w)} − ${n}(${fmt(d)}))(${fmt(t)})` : ''}${useTear ? `;  A_tear = 2(${n})(${fmt(+q.e)})(${fmt(t)})` : ''}`,
      r: `A_shear = ${fmt(Ab)},  A_b = ${fmt(Abr)}${useNet ? `,  A_net = ${fmt(An)}` : ''}${useTear ? `,  A_tear = ${fmt(At)}` : ''} ${u.A}` });
    const modes = [
      { key: 'bolt', name: 'Shear of the bolts', A: Ab, al: +q.tb, sym: 'τ' },
      { key: 'bear', name: 'Bearing on the plate', A: Abr, al: +q.sb, sym: 'σ_b' },
      { key: 'net', name: 'Tension on the net section of the plate', A: An, al: +q.st, sym: 'σ_t', skip: !useNet },
      { key: 'tear', name: 'Shear tear-out of the plate', A: At, al: +q.tp, sym: 'τ_p', skip: !useTear },
    ].filter((m) => !m.skip);
    let gov = null;
    if (q.task === 'allow') {
      const rows = [];
      modes.forEach((m) => {
        if (!(m.al > 0)) { rows.push([m.name, '—', 'not checked']); return; }
        m.P = D(B(m.al, u.ST) * B(m.A, u.A), u.F);
        rows.push([m.name, `${fmt(m.al)} ${u.ST}`, `P = ${fmt(m.al)} × ${fmt(m.A)} = ${fmt(m.P)} ${u.F}`]);
        S.add({ t: `Load if ${m.name.toLowerCase()} governs`, f: `${m.sym},allow = P/A`, s: `${fmt(m.al)} ${u.ST} = P / ${fmt(m.A)} ${u.A}`, r: `P = ${fmt(m.P)} ${u.F}` });
        if (!gov || m.P < gov.P) gov = m;
      });
      S.add({ t: 'Largest load the joint can carry', n: 'The joint fails in the way that needs the smallest load.', table: { head: ['Failure', 'Allowable stress', 'Load'], rows }, r: `P_allow = ${fmt(gov.P)} ${u.F}, set by ${gov.name.toLowerCase()}` });
      out.push({ k: 'Allowable load P', v: gov.P, u: u.F, hl: true });
      modes.forEach((m) => { if (m.P !== undefined) out.push({ k: `Load for ${m.name.toLowerCase()}`, v: m.P, u: u.F }); });
      return R(`P_allow = ${fmt(gov.P)} ${u.F} (${gov.key === 'bolt' ? 'bolt shear' : gov.key === 'bear' ? 'bearing' : gov.key === 'net' ? 'plate tension' : 'tear-out'})`, 'ok', out, S, { kind: 'joint', q, modes, gov: gov.key, u });
    }
    const P = +q.P, warn = [];
    modes.forEach((m) => {
      m.s = D(B(P, u.F) / B(m.A, u.A), u.ST);
      const over = m.al > 0 && m.s > m.al * (1 + 1e-9);
      S.add({ t: m.name, f: m.key === 'bolt' ? `τ = V/A, V = P/(n·planes)` : `${m.sym} = P/A`, s: `${m.sym} = ${fmt(P)} ${u.F} / ${fmt(m.A)} ${u.A}`, r: `${m.sym} = ${fmt(m.s)} ${u.ST}${m.al > 0 ? (over ? `  > ${fmt(m.al)} allowed ✗` : `  ≤ ${fmt(m.al)} allowed ✓`) : ''}` });
      if (over) warn.push(`${m.name} is over its allowable stress.`);
      if (!gov || (m.al > 0 && m.s / m.al > (gov.s / gov.al || 0))) gov = m.al > 0 ? m : gov;
    });
    modes.forEach((m) => out.push({ k: m.key === 'bolt' ? 'Average shear stress in the bolts τ' : m.key === 'bear' ? 'Bearing stress σ_b' : m.key === 'net' ? 'Tensile stress on the net section σ_t' : 'Tear-out shear stress τ_p', v: m.s, u: u.ST, hl: m.key === 'bolt' }));
    return R(warn.length ? 'Over the allowable stress' : 'All stresses within the allowable values', warn.length ? 'bad' : 'ok', out, S, { kind: 'joint', q, modes, gov: gov ? gov.key : null, u }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Sizing by allowable stress                                         */
  /* ------------------------------------------------------------------ */
  function size(q, u) {
    const err = [];
    if (!(q.P > 0)) err.push('Enter the load P.');
    if (q.byFS) { if (!(q.fail > 0)) err.push('Enter the failure stress.'); if (!(q.FS >= 1)) err.push('The factor of safety must be at least 1.'); }
    else if (!(q.allow > 0)) err.push('Enter the allowable stress.');
    if (q.part === 'punch' && !(q.dh > 0)) err.push('Enter the diameter of the punched area (the hole or the rod head).');
    if (q.part === 'collar' && !(q.di > 0)) err.push('Enter the diameter of the shaft through the collar.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], P = +q.P;
    const shear = q.part === 'pin' || q.part === 'punch', sym = shear ? 'τ' : q.part === 'collar' ? 'σ_b' : 'σ';
    let allow = +q.allow;
    if (q.byFS) {
      allow = q.fail / q.FS;
      S.add({ t: 'Allowable stress', f: `F.S. = ${sym}_fail / ${sym}_allow`, s: `${fmt(+q.FS)} = ${fmt(+q.fail)} ${u.ST} / ${sym}_allow`, r: `${sym}_allow = ${fmt(allow)} ${u.ST}` });
    } else S.add({ t: 'Allowable stress', r: `${sym}_allow = ${fmt(allow)} ${u.ST}` });
    const Areq = D(B(P, u.F) / B(allow, u.ST), u.A);
    let val, key, name, geo = { kind: 'size', q, allow, u };
    if (q.part === 'pin') {
      const pl = Math.round(+q.planes) === 2 ? 2 : 1, V = P / pl, A = Areq / pl;
      S.add({ t: 'Shear force on each shear plane', n: pl === 1 ? 'Single shear: the whole load crosses one plane.' : 'Double shear: the load divides between two planes.', f: `V = P/${pl}`, r: `V = ${fmt(V)} ${u.F}` });
      S.add({ t: 'Required area of the pin', f: 'A = V/τ_allow', s: `A = ${fmt(V)} ${u.F} / ${fmt(allow)} ${u.ST}`, r: `A = ${fmt(A)} ${u.A}` });
      val = Math.sqrt((4 * A) / Math.PI); key = 'Required pin diameter d'; name = 'pin';
      S.add({ t: 'Required diameter', f: 'π d²/4 = A', s: `d = √(4(${fmt(A)})/π)`, r: `d = ${fmt(val)} ${u.S}` });
      out.push({ k: 'Shear force per plane V', v: V, u: u.F });
    } else if (q.part === 'rod') {
      val = Math.sqrt((4 * Areq) / Math.PI); key = 'Required rod diameter d'; name = 'rod';
      S.add({ t: 'Required area of the rod', f: 'A = N/σ_allow', s: `A = ${fmt(P)} ${u.F} / ${fmt(allow)} ${u.ST}`, r: `A = ${fmt(Areq)} ${u.A}` });
      S.add({ t: 'Required diameter', f: 'π d²/4 = A', s: `d = √(4(${fmt(Areq)})/π)`, r: `d = ${fmt(val)} ${u.S}` });
    } else if (q.part === 'punch') {
      val = Areq / (Math.PI * q.dh); key = 'Required plate thickness t'; name = 'plate';
      S.add({ t: 'Required shear area', n: 'The material around the rod head or hole must resist being pushed through; the shear acts on the cylinder of diameter d and height t.', f: 'A = V/τ_allow', s: `A = ${fmt(P)} ${u.F} / ${fmt(allow)} ${u.ST}`, r: `A = ${fmt(Areq)} ${u.A}` });
      S.add({ t: 'Required thickness', f: 'A = π d t', s: `t = ${fmt(Areq)} / (π(${fmt(+q.dh)}))`, r: `t = ${fmt(val)} ${u.S}` });
    } else {
      val = Math.sqrt(q.di * q.di + (4 * Areq) / Math.PI); key = 'Required collar outer diameter d_o'; name = 'collar';
      S.add({ t: 'Bearing area of the collar', f: 'A_b = P/σ_b,allow', s: `A_b = ${fmt(P)} ${u.F} / ${fmt(allow)} ${u.ST}`, r: `A_b = ${fmt(Areq)} ${u.A}` });
      S.add({ t: 'Outer diameter', f: 'π(d_o² − d_i²)/4 = A_b', s: `d_o = √(${fmt(+q.di)}² + 4(${fmt(Areq)})/π)`, r: `d_o = ${fmt(val)} ${u.S}` });
    }
    out.push({ k: 'Allowable stress', v: allow, u: u.ST });
    out.push({ k: key, v: val, u: u.S, hl: true });
    if (q.step > 0) {
      const use = Math.ceil(val / q.step - 1e-9) * q.step;
      S.add({ t: 'Size to use', n: `Round up to the next ${fmt(+q.step)} ${u.S}.`, r: `Use ${name === 'plate' ? 't' : 'd'} = ${fmt(use)} ${u.S}` });
      out.push({ k: 'Size to use (rounded up)', v: use, u: u.S });
      geo.use = use;
    }
    geo.val = val;
    return R(`${key.replace('Required ', '')} = ${fmt(val)} ${u.S}`, 'ok', out, S, geo);
  }

  /* ------------------------------------------------------------------ */
  /* Stress-strain data                                                 */
  /* ------------------------------------------------------------------ */
  function curve(q, u) {
    const pts = (q.pts || []).map((p) => ({ e: +p.e, s: +p.s }));
    const err = [];
    if (pts.length < 3) err.push('Enter at least three points (the origin and two more).');
    for (let i = 1; i < pts.length; i++) if (!(pts[i].e > pts[i - 1].e)) { err.push('The strains must increase from point to point.'); break; }
    if (pts.length && (pts[0].e !== 0 || pts[0].s !== 0)) err.push('The first point must be the origin (0, 0).');
    const nL = Math.round(+q.nLin);
    if (!(nL >= 1 && nL < pts.length)) err.push('The end of the straight line must be one of the points after the origin.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], uE = u.us ? 'ksi' : 'MPa';
    const pl = pts[nL], E = pl.s / pl.e; // stress unit per unit strain
    const Ed = u.us ? E : E / 1000; // ksi or GPa
    S.add({ t: 'Modulus of elasticity', n: `Slope of the straight part of the curve, from the origin to point ${nL + 1}.`, f: 'E = σ/ε', s: `E = ${fmt(pl.s)} ${uE} / ${fmt(pl.e)}`, r: `E = ${fmt(Ed)} ${u.MOD}${u.us ? ` = ${fmt(Ed / 1000)}(10³) ksi` : ''}` });
    S.add({ t: 'Proportional limit', n: 'The end of the straight line.', r: `σ_pl = ${fmt(pl.s)} ${uE} at ε_pl = ${fmt(pl.e)}` });
    // 0.2 % offset: line σ = E(ε − 0.002) meets the curve
    let ys = null;
    for (let i = nL; i < pts.length - 1 && !ys; i++) {
      const a = pts[i], b = pts[i + 1], fa = a.s - E * (a.e - 0.002), fb = b.s - E * (b.e - 0.002);
      if (fa >= 0 && fb <= 0 && fa !== fb) { const t = fa / (fa - fb); ys = { e: a.e + t * (b.e - a.e), s: a.s + t * (b.s - a.s) }; }
    }
    if (ys) S.add({ t: 'Yield strength by the 0.2 % offset', n: 'Draw a line parallel to the straight part, starting at ε = 0.002; it cuts the curve at the yield strength.', f: 'σ = E(ε − 0.002)', r: `σ_YS = ${fmt(ys.s)} ${uE} at ε = ${fmt(ys.e)}` });
    else warn.push('The 0.2 % offset line does not cut the curve: add points beyond ε = 0.002.');
    let iu = 0; pts.forEach((p, i) => { if (p.s > pts[iu].s) iu = i; });
    const last = pts[pts.length - 1];
    S.add({ t: 'Ultimate and fracture stress', n: 'The ultimate stress is the highest point of the curve; the fracture stress is the last point.', r: `σ_u = ${fmt(pts[iu].s)} ${uE},  σ_f = ${fmt(last.s)} ${uE} at ε_f = ${fmt(last.e)}` });
    const toU = u.us ? 1000 : 1; // energy per volume: MJ/m³ (= MPa) or in.·lb/in.³ (= psi)
    const uU = u.us ? 'in.·lb/in.³' : 'MJ/m³';
    const ur = 0.5 * pl.s * pl.e * toU;
    S.add({ t: 'Modulus of resilience', n: 'Strain energy per unit volume up to the proportional limit (area of the triangle under the straight line).', f: 'u_r = ½ σ_pl ε_pl = σ_pl²/(2E)', s: `u_r = ½(${fmt(pl.s)})(${fmt(pl.e)})`, r: `u_r = ${fmt(ur)} ${uU}` });
    let ut = 0; for (let i = 1; i < pts.length; i++) ut += 0.5 * (pts[i].s + pts[i - 1].s) * (pts[i].e - pts[i - 1].e);
    ut *= toU;
    S.add({ t: 'Modulus of toughness', n: 'The whole area under the curve up to fracture (trapezoidal rule through the points).', f: 'u_t = Σ ½(σᵢ + σᵢ₊₁)(εᵢ₊₁ − εᵢ)', r: `u_t = ${fmt(ut)} ${uU}` });
    out.push({ k: 'Modulus of elasticity E', v: Ed, u: u.MOD, hl: true });
    out.push({ k: 'Proportional limit σ_pl', v: pl.s, u: uE });
    if (ys) out.push({ k: 'Yield strength (0.2 % offset) σ_YS', v: ys.s, u: uE, hl: true });
    out.push({ k: 'Ultimate stress σ_u', v: pts[iu].s, u: uE }, { k: 'Fracture stress σ_f', v: last.s, u: uE });
    out.push({ k: 'Strain at fracture ε_f', v: last.e, u: '' }, { k: 'Percent elongation (≈ 100 ε_f)', v: 100 * last.e, u: '%' });
    out.push({ k: 'Modulus of resilience u_r', v: ur, u: uU }, { k: 'Modulus of toughness u_t', v: ut, u: uU });
    let un = null;
    if (q.unload) {
      const sU = +q.sU;
      let at = null;
      for (let i = 0; i < pts.length - 1 && !at; i++) { const a = pts[i], b = pts[i + 1]; if (sU >= Math.min(a.s, b.s) && sU <= Math.max(a.s, b.s) && b.s > a.s) { const t = (sU - a.s) / (b.s - a.s); at = { e: a.e + t * (b.e - a.e), s: sU }; } }
      if (!at || !(sU > pl.s)) warn.push('Unloading is only shown from a stress above the proportional limit and on the rising part of the curve.');
      else {
        const rec = sU / E, set = at.e - rec;
        un = { e: at.e, s: sU, set };
        S.add({ t: 'Unloading and the permanent set', n: 'When the load is released the material follows a line parallel to the straight part, so it recovers the elastic strain σ/E.', f: 'ε_elastic = σ/E;  ε_permanent = ε − σ/E', s: `ε_elastic = ${fmt(sU)}/${fmt(E)} = ${fmt(rec)};  ε_permanent = ${fmt(at.e)} − ${fmt(rec)}`, r: `Permanent set = ${fmt(set)}` });
        const ur2 = 0.5 * sU * rec * toU;
        S.add({ t: 'Modulus of resilience after strain hardening', n: 'On reloading the material stays elastic up to the stress it was unloaded from.', f: 'u_r = ½ σ ε_elastic', s: `u_r = ½(${fmt(sU)})(${fmt(rec)})`, r: `u_r = ${fmt(ur2)} ${uU}` });
        out.push({ k: 'Strain at the start of unloading', v: at.e, u: '' }, { k: 'Elastic recovery σ/E', v: rec, u: '' }, { k: 'Permanent set', v: set, u: '', hl: true }, { k: 'Modulus of resilience after reloading', v: ur2, u: uU });
      }
    }
    return R(`E = ${fmt(Ed)} ${u.MOD}${ys ? `, σ_YS = ${fmt(ys.s)} ${uE}` : ''}`, warn.length ? 'warn' : 'ok', out, S, { kind: 'curve', pts, E, pl, ys, iu, un, uE, u }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Block in simple shear                                              */
  /* ------------------------------------------------------------------ */
  function pad(q, u) {
    const err = [];
    if (!(q.a > 0 && q.b > 0 && q.h > 0)) err.push('Enter the length, width and thickness of the block.');
    const G0 = q.useEnu ? q.E / (2 * (1 + +q.nu)) : +q.G;
    if (q.useEnu && !(q.E > 0 && q.nu >= 0 && q.nu <= 0.5)) err.push("Enter E and Poisson's ratio (0 to 0.5).");
    if (!q.useEnu && !(q.G > 0)) err.push('Enter the shear modulus G.');
    if (q.given === 'force' && !(q.V > 0)) err.push('Enter the shear force V.');
    if (q.given === 'move' && !(q.dx > 0)) err.push('Enter the sideways movement of the top.');
    if (err.length) return fail(err);
    const S = Steps(), out = [], A = q.a * q.b, Gb = B(G0, u.MOD), Ab = B(A, u.A), h = +q.h;
    if (q.useEnu) S.add({ t: 'Shear modulus', f: 'G = E/(2(1 + ν))', s: `G = ${fmt(+q.E)}/(2(1 + ${fmt(+q.nu)}))`, r: `G = ${fmt(G0)} ${u.MOD}` });
    let tau, gam, dx, V;
    if (q.given === 'force') {
      V = B(+q.V, u.F); tau = V / Ab; gam = tau / Gb; dx = h * Math.tan(gam);
      S.add({ t: 'Average shear stress', n: 'The force acts on the top face and is resisted over the same area at the base.', f: 'τ = V/A', s: `τ = ${fmt(+q.V)} ${u.F} / (${fmt(+q.a)})(${fmt(+q.b)}) ${u.A}`, r: `τ = ${MD.show(tau, u.ST)}` });
      S.add({ t: 'Shear strain', f: 'γ = τ/G', s: `γ = ${MD.show(tau, u.ST)} / ${fmt(G0)} ${u.MOD}`, r: `γ = ${fmt(gam)} rad` });
      S.add({ t: 'Sideways movement of the top', f: 'd = h tan γ ≈ h γ', s: `d = ${fmt(h)} tan(${fmt(gam)})`, r: `d = ${fmt(dx)} ${u.S}` });
    } else {
      dx = +q.dx; gam = Math.atan(dx / h); tau = Gb * gam; V = tau * Ab;
      S.add({ t: 'Shear strain', n: 'The change in the right angle at a corner of the block.', f: 'γ = tan⁻¹(d/h)', s: `γ = tan⁻¹(${fmt(dx)}/${fmt(h)})`, r: `γ = ${fmt(gam)} rad` });
      S.add({ t: 'Shear stress', f: 'τ = Gγ', s: `τ = ${fmt(G0)} ${u.MOD} × ${fmt(gam)}`, r: `τ = ${MD.show(tau, u.ST)}` });
      S.add({ t: 'Shear force', f: 'V = τA', s: `V = ${MD.show(tau, u.ST)} × ${fmt(A)} ${u.A}`, r: `V = ${MD.show(V, u.F)}` });
    }
    out.push({ k: 'Average shear stress τ', v: D(tau, u.ST), u: u.ST, hl: true }, { k: 'Shear strain γ', v: gam, u: 'rad', hl: true });
    out.push({ k: 'Sideways movement d', v: dx, u: u.S }, { k: 'Shear force V', v: D(V, u.F), u: u.F }, { k: 'Shear modulus G', v: G0, u: u.MOD });
    return R(`τ = ${MD.show(tau, u.ST)}, γ = ${fmt(gam)} rad`, 'ok', out, S, { kind: 'pad', q, tau, gam, dx, V: D(V, u.F), u });
  }

  const Stress = { defaults, solve, convertState, KINDS };
  root.Stress = Stress;
  if (typeof module !== 'undefined' && module.exports) module.exports = Stress;
})(typeof window !== 'undefined' ? window : globalThis);
