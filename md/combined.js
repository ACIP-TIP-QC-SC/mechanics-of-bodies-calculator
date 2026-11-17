/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M6 Combined Loadings
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapter 13.
 *   vessel     thin-walled cylinder or sphere under internal pressure, with
 *              an axial force on the cylinder; stresses, largest pressure or
 *              smallest wall thickness, change in radius (13.1)
 *   section    rectangular, round or tubular section carrying N, V_y, V_z,
 *              M_y, M_z and T together; each stress component and the total
 *              at a chosen point, by superposition (13.2)
 *   eccentric  post loaded off its centroid: corner stresses, neutral axis
 *              and the no-tension kern (13.2)
 * Section axes: x along the member, out of the cut face toward the viewer;
 * y to the right and z up on the face. Internal loadings are positive along
 * +x, +y, +z (moments by the right-hand rule) on the face whose outward
 * normal is +x.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const FU = { SI: ['kN', 'N'], US: ['kip', 'lb'] };
  const MU = { SI: ['kN·m', 'N·m'], US: ['kip·ft', 'lb·ft', 'kip·in.', 'lb·in.'] };
  const MTW = { 'kN·m': 'kip·ft', 'N·m': 'lb·ft', 'kip·ft': 'kN·m', 'lb·ft': 'N·m', 'kip·in.': 'kN·m', 'lb·in.': 'N·m' };
  const PU = { SI: ['kPa', 'MPa'], US: ['psi', 'ksi'] };
  const PTW = { kPa: 'psi', MPa: 'ksi', psi: 'kPa', ksi: 'MPa' };

  function defaults() {
    return {
      mode: 'section', fu: 'kN', mu: 'kN·m', pu: 'kPa',
      vs: { kind: 'cyl', task: 'stress', p: 1500, r: 600, t: 12, sA: 140, N: 0, mat: 'a36', E: 200, nu: 0.32 },
      sc: { shape: 'rect', b: 50, h: 250, d: 100, di: 60, N: -16.45, Vy: 0, Vz: 21.93, My: -32.89, Mz: 0, T: 0, pt: 't', y: 0, z: 0 },
      ec: { b: 300, h: 400, P: 900, ey: 40, ez: 60 },
    };
  }
  const KINDS = { vs: { r: 'S', t: 'S', sA: 'ST', E: 'MOD' }, sc: { b: 'S', h: 'S', d: 'S', di: 'S', y: 'S', z: 'S' }, ec: { b: 'S', h: 'S', ey: 'S', ez: 'S' } };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = FU[from].includes(st.fu) ? st.fu : FU[from][0], f1 = Core.twin(fu, to);
    Object.keys(KINDS).forEach((g) => MD.convertObj(st[g], KINDS[g], from, to, fu));
    const cf = (o, k) => { if (isFinite(+o[k])) o[k] = Core.tidy(Core.convert(+o[k], fu, f1), 6); };
    ['N', 'Vy', 'Vz'].forEach((k) => cf(st.sc, k)); cf(st.vs, 'N'); cf(st.ec, 'P');
    st.fu = f1;
    // moments: remember the unit of each system so a round trip returns to it
    st.muBy = Object.assign({}, st.muBy, { [from]: st.mu });
    const m0 = MU[from].includes(st.mu) ? st.mu : MU[from][0], back = st.muBy[to], m1 = back && (MTW[back] === m0 || MTW[m0] === back) ? back : MTW[m0];
    ['My', 'Mz', 'T'].forEach((k) => { if (isFinite(+st.sc[k])) st.sc[k] = Core.tidy(Core.convert(+st.sc[k], m0, m1), 6); });
    st.mu = m1;
    const p0 = PU[from].includes(st.pu) ? st.pu : PU[from][0], p1 = PTW[p0];
    if (isFinite(+st.vs.p)) st.vs.p = Core.tidy(Core.convert(+st.vs.p, p0, p1), 6);
    st.pu = p1;
    return st;
  }

  function solve(st, U) {
    const sys = U.id;
    if (!FU[sys].includes(st.fu)) st.fu = FU[sys][0];
    if (!MU[sys].includes(st.mu)) st.mu = MU[sys][0];
    if (!PU[sys].includes(st.pu)) st.pu = PU[sys][0];
    const u = units(U, st.fu); u.M = st.mu; u.PU = st.pu;
    if (st.mode === 'vessel') return vessel(st.vs, u);
    if (st.mode === 'eccentric') return eccentric(st.ec, u);
    return section(st.sc, u);
  }
  const R = MD.result;
  const num = (v) => typeof v === 'number' && isFinite(v);
  const sgn = (v) => (v < 0 ? `− ${fmt(-v)}` : `+ ${fmt(v)}`);

  /* ------------------------------------------------------------------ */
  /* Thin-walled pressure vessels                                       */
  /* ------------------------------------------------------------------ */
  function vessel(q, u) {
    const err = [], cyl = q.kind !== 'sphere';
    if (!(q.r > 0)) err.push('Enter the inner radius r.');
    if (q.task !== 'tmin' && !(q.t > 0)) err.push('Enter the wall thickness t.');
    if (q.task !== 'pmax' && !(q.p > 0)) err.push('Enter the internal pressure p.');
    if (q.task !== 'stress' && !(q.sA > 0)) err.push('Enter the allowable normal stress.');
    if (cyl && !num(q.N)) err.push('The axial force must be a number (0 if there is none).');
    if (!(q.E >= 0)) err.push('Enter E (0 leaves out the change in radius).');
    if (q.E > 0 && !(q.nu >= 0 && q.nu < 0.5)) err.push("Poisson's ratio must be from 0 up to (not including) 0.5.");
    if (err.length) return fail(err);
    const S = Steps(), out = [], warn = [], ST = u.ST, PUu = u.PU, r = B(+q.r, u.S), sA = B(+q.sA, ST);
    let p = q.task === 'pmax' ? 0 : B(+q.p, PUu), t = q.task === 'tmin' ? 0 : B(+q.t, u.S);
    const Nn = cyl ? B(+q.N || 0, u.F) : 0;
    if (q.task === 'pmax') {
      if (cyl) {
        const p1 = (sA * t) / r;
        S.add({ t: 'Largest pressure from the hoop stress', n: 'The circumferential (hoop) stress is the larger of the two, so it governs.', f: 'σ1 = pr/t ≤ σ_allow', s: `p = σ_allow t/r = (${fmt(+q.sA)} ${ST})(${fmt(+q.t)})/${fmt(+q.r)}`, r: `p = ${MD.show(p1, PUu)}` });
        p = p1;
        if (Nn) {
          const Aw = Math.PI * ((r + t) ** 2 - r * r), p2 = ((sA - Nn / Aw) * 2 * t) / r;
          S.add({ t: 'Largest pressure from the longitudinal stress', f: 'σ2 = N/A + pr/(2t) ≤ σ_allow', s: `p = (σ_allow − N/A)(2t/r)`, r: `p = ${MD.show(p2, PUu)}` });
          if (p2 < p) p = p2;
        }
      } else {
        p = (2 * sA * t) / r;
        S.add({ t: 'Largest pressure', n: 'In a sphere the stress is the same in every direction along the wall.', f: 'σ = pr/(2t) ≤ σ_allow', s: `p = 2σ_allow t/r = 2(${fmt(+q.sA)} ${ST})(${fmt(+q.t)})/${fmt(+q.r)}`, r: `p = ${MD.show(p, PUu)}` });
      }
      if (!(p > 0)) return fail(['The axial compression alone uses up the allowable stress, so no pressure can be carried.']);
      out.push({ k: 'Largest internal pressure p', v: D(p, PUu), u: PUu, hl: true });
    } else if (q.task === 'tmin') {
      t = cyl ? (p * r) / sA : (p * r) / (2 * sA);
      S.add({ t: 'Smallest wall thickness', n: cyl ? 'The hoop stress governs in a cylinder.' : 'In a sphere the stress is the same in every direction.', f: cyl ? 't = pr/σ_allow' : 't = pr/(2σ_allow)', s: `t = (${fmt(+q.p)} ${PUu})(${fmt(+q.r)})/${cyl ? '' : '2'}(${fmt(+q.sA)} ${ST})`, r: `t = ${MD.show(t, u.S)}` });
      if (Nn) warn.push('The axial force is left out when sizing the wall; check the longitudinal stress with "Stresses for a pressure".');
      out.push({ k: 'Smallest wall thickness t', v: D(t, u.S), u: u.S, hl: true });
    }
    const rt = r / t;
    S.add({ t: 'Thin-wall check', f: 'r/t ≥ 10', s: `r/t = ${fmt(rt)}`, n: rt >= 10 ? 'The wall is thin, so the stress can be taken as uniform through it.' : 'r/t is below 10: the stress varies through the wall and these thin-wall results are only rough.' });
    if (rt < 10) warn.push(`r/t = ${fmt(rt)} is below 10, so the thin-wall formulas are only rough here.`);
    let s1, s2;
    if (cyl) {
      s1 = (p * r) / t;
      const Aw = Math.PI * ((r + t) ** 2 - r * r), sN = Nn / Aw;
      s2 = (p * r) / (2 * t) + sN;
      S.add({ t: 'Circumferential (hoop) stress', f: 'σ1 = pr/t', s: `σ1 = (${MD.show(p, PUu)})(${fmt(D(r, u.S))} ${u.S})/(${fmt(D(t, u.S))} ${u.S})`, r: `σ1 = ${MD.show(s1, ST)}` });
      S.add({ t: 'Longitudinal stress', n: Nn ? 'The wall carries the axial force over its ring-shaped area A = π[(r + t)² − r²] as well as the pressure on the end.' : 'The pressure on the end cap is carried by the wall around the circumference.', f: Nn ? 'σ2 = N/A + pr/(2t)' : 'σ2 = pr/(2t)',
        s: Nn ? `σ2 = ${MD.show(Nn, u.F)}/(${fmt(D(Aw, u.A))} ${u.A}) + ${MD.show((p * r) / (2 * t), ST)} = ${MD.show(sN, ST)} ${sgn(D((p * r) / (2 * t), ST))} ${ST}` : `σ2 = σ1/2`, r: `σ2 = ${MD.show(s2, ST)}` });
      out.push({ k: 'Hoop stress σ_1', v: D(s1, ST), u: ST, hl: true }, { k: 'Longitudinal stress σ_2', v: D(s2, ST), u: ST, hl: true });
    } else {
      s1 = s2 = (p * r) / (2 * t);
      S.add({ t: 'Stress in the wall', f: 'σ1 = σ2 = pr/(2t)', s: `σ = (${MD.show(p, PUu)})(${fmt(D(r, u.S))})/[2(${fmt(D(t, u.S))})]`, r: `σ = ${MD.show(s1, ST)}` });
      out.push({ k: 'Wall stress σ_1 = σ_2', v: D(s1, ST), u: ST, hl: true });
    }
    S.add({ t: 'Radial stress', n: 'It goes from −p on the inner face to 0 on the outer face, and is small next to σ1, so it is neglected.', r: `σ3 = −${MD.show(p, PUu)} at the inner wall` });
    const lo = Math.min(s1, s2, 0), hi = Math.max(s1, s2, 0), tin = Math.abs(s1 - s2) / 2, tab = (hi - lo) / 2;
    S.add({ t: 'Largest shear stress at the outer wall', n: 'The outer face is free, so σ3 = 0 there. The in-plane shear is (σ1 − σ2)/2; out of the plane the largest is (σ_max − σ_min)/2 over σ1, σ2 and 0.', f: 'τ_abs = (σ_max − σ_min)/2', r: `τ in-plane = ${MD.show(tin, ST)}, τ_abs = ${MD.show(tab, ST)}` });
    out.push({ k: 'Largest in-plane shear stress', v: D(tin, ST), u: ST }, { k: 'Absolute maximum shear stress τ_abs', v: D(tab, ST), u: ST, hl: true });
    let dr = null;
    if (q.E > 0) {
      const E = B(+q.E, u.MOD), nu = +q.nu, e1 = (s1 - nu * s2) / E;
      dr = e1 * r;
      S.add({ t: 'Change in radius', n: 'The hoop strain stretches the circumference 2πr, so the radius grows by the same strain.', f: 'ε1 = (σ1 − νσ2)/E,  δr = ε1 r', s: `ε1 = (${fmt(D(s1, ST))} ${sgn(-nu * D(s2, ST))})/(${fmt(+q.E)} ${u.MOD}) = ${fmt(e1)}`, r: `δr = ${MD.show(dr, u.S)}` });
      out.push({ k: 'Hoop strain ε_1', v: e1, u: '' }, { k: 'Change in the inner radius δr', v: D(dr, u.S), u: u.S });
    }
    if (q.task !== 'pmax') out.unshift({ k: 'Internal pressure p', v: D(p, PUu), u: PUu });
    out.push({ k: 'Radius-to-thickness ratio r/t', v: rt, u: '' });
    return R(cyl ? `σ1 = ${MD.show(s1, ST)} (hoop), σ2 = ${MD.show(s2, ST)} (longitudinal)` : `σ = ${MD.show(s1, ST)} in every direction`, rt < 10 ? 'warn' : 'ok', out, S,
      { kind: 'vessel', u, cyl, p, r, t, s1, s2, dr, tab, mohr: { sx: D(s2, ST), sy: D(s1, ST), txy: 0 } }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Section properties and stresses at a point                         */
  /* ------------------------------------------------------------------ */
  /** Section in base units: area, Iy (about y, for z-distances), Iz, J (round only), and the shear terms. */
  function props(q, u) {
    if (q.shape === 'rect') {
      const b = B(+q.b, u.S), h = B(+q.h, u.S);
      return {
        shape: 'rect', b, h, A: b * h, Iy: (b * h ** 3) / 12, Iz: (h * b ** 3) / 12, J: 0, cy: b / 2, cz: h / 2,
        inside: (y, z) => Math.abs(y) <= b / 2 * (1 + 1e-9) && Math.abs(z) <= h / 2 * (1 + 1e-9),
        Qz: (z) => ({ Q: (b * (h * h / 4 - z * z)) / 2, t: b }), Qy: (y) => ({ Q: (h * (b * b / 4 - y * y)) / 2, t: h }),
      };
    }
    const ro = B(+q.d, u.S) / 2, ri = q.shape === 'tube' ? B(+q.di, u.S) / 2 : 0, I = (Math.PI / 4) * (ro ** 4 - ri ** 4);
    const Qf = (s) => {
      const a = Math.max(ro * ro - s * s, 0), c = Math.max(ri * ri - s * s, 0);
      return { Q: (2 / 3) * (a ** 1.5 - c ** 1.5), t: 2 * (Math.sqrt(a) - Math.sqrt(c)) };
    };
    return { shape: q.shape, ro, ri, A: Math.PI * (ro * ro - ri * ri), Iy: I, Iz: I, J: 2 * I, cy: ro, cz: ro, inside: (y, z) => { const r2 = Math.hypot(y, z); return r2 <= ro * (1 + 1e-9) && r2 >= ri * (1 - 1e-9); }, Qz: Qf, Qy: Qf };
  }
  /** Standard points: [id, name, y, z] in base units. */
  function points(P) {
    if (P.shape === 'rect') {
      const a = P.b / 2, c = P.h / 2;
      return [['c', 'Centroid', 0, 0], ['t', 'Top, middle', 0, c], ['b', 'Bottom, middle', 0, -c], ['r', 'Right side, middle', a, 0], ['l', 'Left side, middle', -a, 0], ['tr', 'Top right corner', a, c], ['tl', 'Top left corner', -a, c], ['br', 'Bottom right corner', a, -c], ['bl', 'Bottom left corner', -a, -c]];
    }
    const c = P.ro, list = [['t', 'Top', 0, c], ['b', 'Bottom', 0, -c], ['r', 'Right', c, 0], ['l', 'Left', -c, 0]];
    if (P.shape === 'tube') list.push(['ti', 'Top, inner wall', 0, P.ri], ['ri', 'Right, inner wall', P.ri, 0]);
    else list.unshift(['c', 'Centre', 0, 0]);
    return list;
  }
  /** Each stress component at (y, z). */
  function stressAt(P, L, y, z) {
    const sN = L.N / P.A, sMy = (L.My * z) / P.Iy, sMz = (-L.Mz * y) / P.Iz;
    const qz = P.Qz(z), qy = P.Qy(y);
    const tVz = qz.t > 1e-12 ? (L.Vz * qz.Q) / (P.Iy * qz.t) : 0, tVy = qy.t > 1e-12 ? (L.Vy * qy.Q) / (P.Iz * qy.t) : 0;
    const tTy = P.J ? (-L.T * z) / P.J : 0, tTz = P.J ? (L.T * y) / P.J : 0;
    const sx = sN + sMy + sMz, txy = tVy + tTy, txz = tVz + tTz;
    return { sN, sMy, sMz, tVy, tVz, tTy, tTz, sx, txy, txz, tau: Math.hypot(txy, txz), qz, qy };
  }

  function section(q, u) {
    const err = [], sh = q.shape;
    if (sh === 'rect' && !(q.b > 0 && q.h > 0)) err.push('Enter the width b and depth h of the section.');
    if (sh !== 'rect' && !(q.d > 0)) err.push('Enter the outer diameter.');
    if (sh === 'tube' && !(q.di > 0 && q.di < q.d)) err.push('The inner diameter must be more than 0 and less than the outer diameter.');
    ['N', 'Vy', 'Vz', 'My', 'Mz', 'T'].forEach((k) => { if (!num(q[k])) err.push(`Enter ${k} as a number (0 if it is absent).`); });
    if (err.length) return fail(err);
    const P = props(q, u), M = u.M, F = u.F, ST = u.ST;
    const L = { N: B(+q.N, F), Vy: B(+q.Vy, F), Vz: B(+q.Vz, F), My: B(+q.My, M), Mz: B(+q.Mz, M), T: sh === 'rect' ? 0 : B(+q.T, M) };
    const pts = points(P);
    let pick = pts.find((p) => p[0] === q.pt), y, z, pname;
    if (q.pt === 'custom') {
      y = B(+q.y, u.S); z = B(+q.z, u.S); pname = `(y, z) = (${fmt(+q.y)}, ${fmt(+q.z)}) ${u.S}`;
      if (!num(+q.y) || !num(+q.z) || !P.inside(y, z)) return fail(['The point must lie on the material of the section (y to the right, z up, from the centroid).']);
    } else { if (!pick) pick = pts[0]; [, pname, y, z] = pick; }
    const warn = [];
    if (sh === 'rect' && +q.T) warn.push('A torque on a rectangular section is left out: the book gives the torsion formula for round sections only.');
    const S = Steps(), out = [], s = stressAt(P, L, y, z);
    const ld = (k, v, unit) => (v ? `${k} = ${MD.show(v, unit)}` : null);
    S.add({ t: 'Internal loadings at the section', n: 'Found from equilibrium of the part of the member on one side of the cut. x is along the member, out of the cut face; y is to the right and z up.',
      r: [ld('N', L.N, F), ld('V_y', L.Vy, F), ld('V_z', L.Vz, F), ld('M_y', L.My, M), ld('M_z', L.Mz, M), ld('T', L.T, M)].filter((x) => x).join(', ') || 'No loads' });
    const Pt = sh === 'rect' ? `A = bh = ${fmt(+q.b)}(${fmt(+q.h)})` : sh === 'tube' ? `A = π(c_o² − c_i²)` : 'A = πc²';
    S.add({ t: 'Section properties', f: sh === 'rect' ? `${Pt},  I_y = bh³/12,  I_z = hb³/12` : `${Pt},  I_y = I_z = π(c_o⁴ − c_i⁴)/4,  J = 2I`,
      r: `A = ${MD.show(P.A, u.A)}, I_y = ${MD.show(P.Iy, u.I)}, I_z = ${MD.show(P.Iz, u.I)}${P.J ? `, J = ${MD.show(P.J, u.I)}` : ''}` });
    S.add({ t: `Point: ${pname}`, r: `y = ${MD.show(y, u.S)}, z = ${MD.show(z, u.S)}` });
    S.add({ t: 'Normal force', n: 'Spread evenly over the section.', f: 'σ = N/A', s: `σ = ${MD.show(L.N, F)}/(${fmt(D(P.A, u.A))} ${u.A})`, r: `σ = ${MD.show(s.sN, ST)}` });
    if (L.Vy || L.Vz) {
      const tx = [];
      if (L.Vz) tx.push(`τ_xz = V_z Q/(I_y t) = ${MD.show(L.Vz, F)}(${fmt(D(s.qz.Q, u.Q))} ${u.Q})/[(${fmt(D(P.Iy, u.I))} ${u.I})(${fmt(D(s.qz.t, u.S))} ${u.S})] = ${MD.show(s.tVz, ST)}`);
      if (L.Vy) tx.push(`τ_xy = V_y Q/(I_z t) = ${MD.show(L.Vy, F)}(${fmt(D(s.qy.Q, u.Q))} ${u.Q})/[(${fmt(D(P.Iz, u.I))} ${u.I})(${fmt(D(s.qy.t, u.S))} ${u.S})] = ${MD.show(s.tVy, ST)}`);
      S.add({ t: 'Shear force', n: 'Q is the first moment about the neutral axis of the area between the point and the edge it faces; t is the width of the section at the point. Q = 0 at the top and bottom of the section.', f: 'τ = VQ/(It)', s: tx.join(';  ') });
    }
    if (L.My || L.Mz) {
      S.add({ t: 'Bending moment', n: 'M_y stretches the side with +z; M_z shortens the side with +y.', f: 'σ = M_y z/I_y − M_z y/I_z',
        s: `σ = ${L.My ? `${MD.show(L.My, M)}(${fmt(D(z, u.S))} ${u.S})/(${fmt(D(P.Iy, u.I))} ${u.I})` : '0'} ${L.Mz ? `− ${MD.show(L.Mz, M)}(${fmt(D(y, u.S))} ${u.S})/(${fmt(D(P.Iz, u.I))} ${u.I})` : ''}`, r: `σ = ${MD.show(s.sMy + s.sMz, ST)}` });
    }
    if (L.T) S.add({ t: 'Torsional moment', n: 'Shear stress τ = Tρ/J acts across the radius, turning the same way as T.', f: 'τ_xy = −T z/J,  τ_xz = T y/J', s: `ρ = ${MD.show(Math.hypot(y, z), u.S)}, Tρ/J = ${MD.show((Math.abs(L.T) * Math.hypot(y, z)) / P.J, ST)}`, r: `τ_xy = ${MD.show(s.tTy, ST)}, τ_xz = ${MD.show(s.tTz, ST)}` });
    S.add({ t: 'Superposition', n: 'Add the stresses that act in the same direction on the element at the point.', f: 'σ_x = N/A + M_y z/I_y − M_z y/I_z;  τ_xy, τ_xz summed', r: `σ_x = ${MD.show(s.sx, ST)}, τ_xy = ${MD.show(s.txy, ST)}, τ_xz = ${MD.show(s.txz, ST)}` });
    // principal stresses of the element at the point (σ along x, the resultant shear on the x face)
    const av = s.sx / 2, Rr = Math.hypot(av, s.tau);
    S.add({ t: 'Principal stresses at the point', n: 'The element carries σ_x and a shear stress τ on the x face, in the direction of the resultant of τ_xy and τ_xz; open it in Stress and Strain Transformation to turn it.', f: 'σ_1,2 = σ_x/2 ± √[(σ_x/2)² + τ²]', r: `σ1 = ${MD.show(av + Rr, ST)}, σ2 = ${MD.show(av - Rr, ST)}, τ_max = ${MD.show(Rr, ST)}` });
    // every standard point
    const rows = pts.map((p) => { const t = stressAt(P, L, p[2], p[3]); return [p[1], fmt(D(t.sx, ST)), fmt(D(t.txy, ST)), fmt(D(t.txz, ST))]; });
    S.add({ t: 'Stresses at the marked points', table: { head: ['Point', `σ_x (${ST})`, `τ_xy (${ST})`, `τ_xz (${ST})`], rows } });
    // extremes of σx over the section
    let smax, smin;
    if (sh === 'rect') { const cs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => stressAt(P, L, (a * P.b) / 2, (b * P.h) / 2).sx); smax = Math.max(...cs); smin = Math.min(...cs); }
    else { const k = P.ro * Math.hypot(L.My / P.Iy, L.Mz / P.Iz); smax = L.N / P.A + k; smin = L.N / P.A - k; }
    out.push({ k: 'Normal stress from N', v: D(s.sN, ST), u: ST }, { k: 'Bending stress from M_y', v: D(s.sMy, ST), u: ST }, { k: 'Bending stress from M_z', v: D(s.sMz, ST), u: ST });
    out.push({ k: 'Shear stress from V_y (τ_xy)', v: D(s.tVy, ST), u: ST }, { k: 'Shear stress from V_z (τ_xz)', v: D(s.tVz, ST), u: ST });
    if (P.J) out.push({ k: 'Shear stress from T, τ_xy', v: D(s.tTy, ST), u: ST }, { k: 'Shear stress from T, τ_xz', v: D(s.tTz, ST), u: ST });
    out.push({ k: 'Normal stress σ_x', v: D(s.sx, ST), u: ST, hl: true }, { k: 'Shear stress τ_xy', v: D(s.txy, ST), u: ST, hl: true }, { k: 'Shear stress τ_xz', v: D(s.txz, ST), u: ST, hl: true }, { k: 'Resultant shear stress τ', v: D(s.tau, ST), u: ST });
    out.push({ k: 'Principal stress σ_1 at the point', v: D(av + Rr, ST), u: ST }, { k: 'Principal stress σ_2 at the point', v: D(av - Rr, ST), u: ST }, { k: 'Maximum in-plane shear stress at the point', v: D(Rr, ST), u: ST });
    out.push({ k: 'Largest normal stress on the section', v: D(smax, ST), u: ST }, { k: 'Smallest normal stress on the section', v: D(smin, ST), u: ST });
    return R(`At the point: σ_x = ${MD.show(s.sx, ST)}, τ = ${MD.show(s.tau, ST)}`, 'ok', out, S,
      { kind: 'section', u, P, L, pts, y, z, pname, s, smax, smin, mohr: { sx: D(s.sx, ST), sy: 0, txy: D(s.txy && s.txz ? Math.sign(Math.abs(s.txz) >= Math.abs(s.txy) ? s.txz : s.txy) * s.tau : s.txy || s.txz, ST) }, stressAt: (yy, zz) => stressAt(P, L, yy, zz) }, warn);
  }

  /* ------------------------------------------------------------------ */
  /* Eccentric load on a rectangular post                               */
  /* ------------------------------------------------------------------ */
  function eccentric(q, u) {
    const err = [];
    if (!(q.b > 0 && q.h > 0)) err.push('Enter both sides of the post.');
    if (!num(q.P)) err.push('Enter the load P.');
    if (!num(q.ey) || !num(q.ez)) err.push('Enter where the load acts (e_y and e_z, 0 if on the centroid).');
    if (err.length) return fail(err);
    if (Math.abs(q.ey) > q.b / 2 + 1e-12 || Math.abs(q.ez) > q.h / 2 + 1e-12) return fail(['The load must act on the post: |e_y| ≤ b/2 and |e_z| ≤ h/2.']);
    const S = Steps(), out = [], F = u.F, ST = u.ST, b = B(+q.b, u.S), h = B(+q.h, u.S), P = B(+q.P, F), ey = B(+q.ey, u.S), ez = B(+q.ez, u.S);
    const A = b * h, Iz = (h * b ** 3) / 12, Iy = (b * h ** 3) / 12;
    const sig = (y, z) => -P / A - (P * ey * y) / Iz - (P * ez * z) / Iy;
    S.add({ t: 'Loads moved to the centroid', n: 'A compressive load P (positive) at (e_y, e_z) is the same as P at the centroid plus two couples.', f: 'N = −P,  M_z = P e_y,  M_y = −P e_z', r: `N = ${MD.show(-P, F)}, M_z = ${MD.show(P * ey, u.FL)}, M_y = ${MD.show(-P * ez, u.FL)}` });
    S.add({ t: 'Section properties', f: 'A = bh,  I_z = hb³/12,  I_y = bh³/12', r: `A = ${MD.show(A, u.A)}, I_z = ${MD.show(Iz, u.I)}, I_y = ${MD.show(Iy, u.I)}` });
    const s0 = -P / A, sy = (P * Math.abs(ey) * b) / 2 / Iz, sz = (P * Math.abs(ez) * h) / 2 / Iy;
    S.add({ t: 'Stress from each part', f: 'σ = −P/A,  σ = P e_y c_y/I_z,  σ = P e_z c_z/I_y', r: `${MD.show(s0, ST)}; ±${MD.show(sy, ST)}; ±${MD.show(sz, ST)}` });
    const C4 = [['A', -1, 1], ['B', 1, 1], ['C', 1, -1], ['D', -1, -1]].map(([n, a, c]) => ({ n, y: (a * b) / 2, z: (c * h) / 2, s: sig((a * b) / 2, (c * h) / 2) }));
    S.add({ t: 'Superposition at the corners', n: 'Corners A, B, C, D go clockwise from the top left, seen from above (y to the right, z up).', f: 'σ = −P/A − P e_y y/I_z − P e_z z/I_y', table: { head: ['Corner', `y (${u.S})`, `z (${u.S})`, `σ (${ST})`], rows: C4.map((c) => [c.n, fmt(D(c.y, u.S)), fmt(D(c.z, u.S)), fmt(D(c.s, ST))]) } });
    const smax = Math.max(...C4.map((c) => c.s)), smin = Math.min(...C4.map((c) => c.s));
    const k = Math.abs(ey) / (b / 6) + Math.abs(ez) / (h / 6), inK = k <= 1 + 1e-9;
    S.add({ t: 'The kern', n: 'If the load stays inside the diamond with corners at b/6 and h/6 from the centroid, no part of the section is in tension (for a compressive P).', f: '|e_y|/(b/6) + |e_z|/(h/6) ≤ 1', s: `${fmt(Math.abs(D(ey, u.S)))}/${fmt(+q.b / 6)} + ${fmt(Math.abs(D(ez, u.S)))}/${fmt(+q.h / 6)} = ${fmt(k)}`, r: inK ? 'Inside the kern.' : 'Outside the kern.' });
    // neutral axis: 1/A + e_y y/I_z + e_z z/I_y = 0
    const y0 = ey ? -Iz / (A * ey) : null, z0 = ez ? -Iy / (A * ez) : null;
    S.add({ t: 'Neutral axis (zero stress)', f: '1/A + e_y y/I_z + e_z z/I_y = 0', r: !ey && !ez ? 'The load is on the centroid: the stress is uniform and there is no neutral axis.' : `It crosses the y axis at ${y0 === null ? 'no point (parallel to it)' : MD.show(y0, u.S)} and the z axis at ${z0 === null ? 'no point (parallel to it)' : MD.show(z0, u.S)}${inK ? '; it lies outside or on the edge of the section.' : '; it cuts the section.'}` });
    out.push({ k: 'Direct stress −P/A', v: D(s0, ST), u: ST });
    C4.forEach((c) => out.push({ k: `Stress at corner ${c.n}`, v: D(c.s, ST), u: ST }));
    out.push({ k: 'Largest normal stress', v: D(smax, ST), u: ST, hl: true }, { k: 'Smallest normal stress', v: D(smin, ST), u: ST, hl: true });
    out.push({ k: 'Load inside the kern', v: inK ? 'Yes' : 'No', u: '' });
    if (y0 !== null) out.push({ k: 'Neutral axis crosses the y axis at y', v: D(y0, u.S), u: u.S });
    if (z0 !== null) out.push({ k: 'Neutral axis crosses the z axis at z', v: D(z0, u.S), u: u.S });
    if (z0 !== null && !ey && Math.abs(z0) < h / 2) out.push({ k: 'Distance of the neutral axis from the nearer edge', v: D(h / 2 - Math.abs(z0), u.S), u: u.S });
    if (y0 !== null && !ez && Math.abs(y0) < b / 2) out.push({ k: 'Distance of the neutral axis from the nearer edge', v: D(b / 2 - Math.abs(y0), u.S), u: u.S });
    const tens = P > 0 ? smax > 1e-12 * Math.abs(smin) : smin < -1e-12 * Math.abs(smax);
    return R(`σ from ${MD.show(smin, ST)} to ${MD.show(smax, ST)}; ${inK ? 'load inside the kern' : 'load outside the kern'}`, tens && P > 0 ? 'warn' : 'ok', out, S,
      { kind: 'eccentric', u, b, h, P, ey, ez, A, Iy, Iz, C4, smax, smin, inK, y0, z0, sig }, tens && P > 0 ? ['Part of the section is in tension: the load is outside the kern.'] : []);
  }

  const Combined = { defaults, solve, convertState, FU, MU, PU, points, props };
  root.Combined = Combined;
  if (typeof module !== 'undefined' && module.exports) module.exports = Combined;
})(typeof window !== 'undefined' ? window : globalThis);
