/* =====================================================================
 * DYNAMICS · D4 Impact (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Section 15.4.
 *   Momentum of the system: m_A(v_A)₁ + m_B(v_B)₁ = m_A(v_A)₂ + m_B(v_B)₂            (15–14)
 *   Coefficient of restitution: e = [(v_B)₂ − (v_A)₂]/[(v_A)₁ − (v_B)₁]            (15–15)
 *   Oblique impact: both equations along the line of impact x; each body keeps its
 *   velocity component in the plane of contact y (smooth surfaces).
 *   Ball on a fixed surface: the surface stays at rest, so (v)₂n = −e(v)₁n and the
 *   tangential component is kept; dropped ball: h_n = e²ⁿh₀.
 * Modes: central impact of two bodies, oblique impact of two smooth disks, a ball striking
 * a fixed wall or floor, and a ball bouncing on a floor. Each can back-solve e.
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
      mode: 'central', find: 'v',
      mA: 2, mB: 3, vA1: 4, vB1: -2, e: 0.6, vB2m: 1.84, src: 'given', hA: 1, dt: 0,
      sA: 3, thA: 30, sB: 1, thB: 225,
      v1: 20, th1: 30, th2: 23.41, surf: 'wall',
      h0: 2, h1: 1.28, nb: 5,
    };
  }
  const KINDS = { mA: 'M', mB: 'M', vA1: 'V', vB1: 'V', vB2m: 'V', hA: 'L', sA: 'V', sB: 'V', v1: 'V', h0: 'L', h1: 'L' };
  function convertState(st, from, to) { return DY.convertObj(st, KINDS, from, to); }
  const dirTxt = (v) => (Math.abs(v) < 1e-12 ? 'at rest' : v > 0 ? '→' : '←');

  function solve(st, U) {
    const u = DY.units(U), g = u.g;
    if (st.mode === 'oblique') return oblique(st, u);
    if (st.mode === 'wall') return wall(st, u);
    if (st.mode === 'bounce') return bounce(st, u, g);
    return central(st, u, g);
  }

  /* ---------------- Central impact of two bodies ---------------- */
  function central(st, u, g) {
    const S = Steps(), out = [], warn = [];
    const mA = B(+st.mA, 'M', u), mB = B(+st.mB, 'M', u);
    if (!(mA > 0) || !(mB > 0)) return fail(`Enter both ${u.us ? 'weights' : 'masses'}.`);
    let vA1 = +st.vA1; const vB1 = +st.vB1;
    if (st.src === 'drop') {
      const h = +st.hA; if (!(h > 0)) return fail('Enter the height A falls (or swings down) before it strikes B.');
      vA1 = Math.sqrt(2 * g * h);
      S.add({ t: 'Velocity of A just before impact', n: 'Conservation of energy from rest, datum at the point of impact; A then moves in the + direction.', f: 'T₀ + V₀ = T₁ + V₁:  0 + m_A g h = ½m_A(v_A)₁²  ⇒  (v_A)₁ = √(2gh)', s: `(v_A)₁ = √(2(${fmt(g)})(${fmt(h)}))`, r: `(v_A)₁ = ${fmt(vA1)} ${u.V} →` });
    }
    if (!isFinite(vA1) || !isFinite(vB1)) return fail('Enter both velocities before impact.');
    if (!(vA1 > vB1 + 1e-12)) return fail('A must be closing on B, (v_A)₁ > (v_B)₁, for them to collide. With + to the right, A is on the left.');
    const p1 = mA * vA1 + mB * vB1, M = mA + mB, rel = vA1 - vB1;
    let e, vA2, vB2;
    S.add({ t: 'Conservation of momentum', n: 'The impulsive force between the bodies is internal to the system, so the momentum of the system is conserved along the line of impact.', f: '(+→) m_A(v_A)₁ + m_B(v_B)₁ = m_A(v_A)₂ + m_B(v_B)₂', s: `(${fmt(mA)})(${fmt(vA1)}) + (${fmt(mB)})(${fmt(vB1)}) = ${fmt(p1)} ${u.IMP}`, r: `(${fmt(mA)})(v_A)₂ + (${fmt(mB)})(v_B)₂ = ${fmt(p1)}` });
    if (st.find === 'e') {
      vB2 = +st.vB2m; if (!isFinite(vB2)) return fail('Enter the measured velocity of B after impact.');
      vA2 = (p1 - mB * vB2) / mA; e = (vB2 - vA2) / rel;
      S.add({ t: 'Velocity of A after impact', f: '(v_A)₂ = [m_A(v_A)₁ + m_B(v_B)₁ − m_B(v_B)₂]/m_A', s: `(v_A)₂ = (${fmt(p1)} − ${fmt(mB)}(${fmt(vB2)}))/${fmt(mA)}`, r: `(v_A)₂ = ${fmt(vA2)} ${u.V}` });
      S.add({ t: 'Coefficient of restitution', f: 'e = [(v_B)₂ − (v_A)₂]/[(v_A)₁ − (v_B)₁]', s: `e = (${fmt(vB2)} − (${fmt(vA2)}))/(${fmt(vA1)} − (${fmt(vB1)}))`, r: `e = ${fmt(e)}` });
      if (e < -1e-9) return fail(`These numbers give e = ${fmt(e)}: B would be behind A after impact, which cannot happen.`);
      if (e > 1 + 1e-9) return fail(`These numbers give e = ${fmt(e)}, more than 1: the collision would create energy. Check the measured velocity.`);
    } else {
      e = st.find === 'plastic' ? 0 : +st.e;
      if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution must be from 0 to 1.');
      vA2 = (p1 - mB * e * rel) / M; vB2 = vA2 + e * rel;
      S.add({ t: 'Coefficient of restitution', n: st.find === 'plastic' ? 'The bodies couple (plastic impact), so e = 0 and they move together.' : 'Assume both move in the + direction after impact; a negative answer means the opposite way.', f: '(+→) e = [(v_B)₂ − (v_A)₂]/[(v_A)₁ − (v_B)₁]', s: `(v_B)₂ − (v_A)₂ = ${fmt(e)}(${fmt(vA1)} − (${fmt(vB1)})) = ${fmt(e * rel)}` });
      S.add({ t: 'Solve the two equations', f: '(v_A)₂ = [m_A(v_A)₁ + m_B(v_B)₁ − m_B e((v_A)₁ − (v_B)₁)]/(m_A + m_B);  (v_B)₂ = (v_A)₂ + e((v_A)₁ − (v_B)₁)', s: `(v_A)₂ = (${fmt(p1)} − ${fmt(mB)}(${fmt(e * rel)}))/${fmt(M)}`,
        r: st.find === 'plastic' ? `v₂ = ${fmt(vA2)} ${u.V} ${dirTxt(vA2)}` : `(v_A)₂ = ${fmt(vA2)} ${u.V} ${dirTxt(vA2)},  (v_B)₂ = ${fmt(vB2)} ${u.V} ${dirTxt(vB2)}` });
    }
    const T1 = 0.5 * mA * vA1 * vA1 + 0.5 * mB * vB1 * vB1, T2 = 0.5 * mA * vA2 * vA2 + 0.5 * mB * vB2 * vB2, loss = T1 - T2;
    S.add({ t: 'Loss of energy', n: 'Work and energy for both bodies just before and just after the collision; the energy goes into deformation, heat and sound.', f: 'ΣU₁₋₂ = T₂ − T₁', s: `T₁ = ${fmt(T1)} ${u.E}, T₂ = ${fmt(T2)} ${u.E}`, r: `ΣU₁₋₂ = ${fmt(-loss)} ${u.E} (${fmt(T1 > 0 ? (100 * loss) / T1 : 0)} % lost)` });
    const JB = mB * (vB2 - vB1);
    if (st.find === 'plastic') out.push({ k: 'Common velocity after coupling v₂', v: vA2, u: u.V, hl: true });
    else out.push({ k: 'Velocity of A after impact (v_A)₂', v: vA2, u: u.V, hl: true }, { k: 'Velocity of B after impact (v_B)₂', v: vB2, u: u.V, hl: st.find !== 'e' });
    if (st.find === 'e') out.push({ k: 'Coefficient of restitution e', v: e, u: '', hl: true });
    if (st.src === 'drop') out.unshift({ k: 'Velocity of A before impact (v_A)₁', v: vA1, u: u.V });
    out.push({ k: 'Kinetic energy before T₁', v: T1, u: u.E }, { k: 'Kinetic energy after T₂', v: T2, u: u.E }, { k: 'Energy lost', v: loss, u: u.E }, { k: 'Impulse on B ∫F dt', v: JB, u: u.IMP });
    const dt = +st.dt;
    if (dt > 0) {
      const F = JB / dt;
      S.add({ t: 'Average impulsive force', n: 'Impulse and momentum for B alone; the force from A is now external.', f: '(+→) m_B(v_B)₁ + F_avg Δt = m_B(v_B)₂', s: `F_avg = ${fmt(mB)}(${fmt(vB2)} − (${fmt(vB1)}))/${fmt(dt)}`, r: `F_avg = ${fmt(Math.abs(F))} ${u.F}` });
      out.push({ k: 'Average force between them F_avg', v: Math.abs(F), u: u.F, hl: true });
    } else S.add({ t: 'Impulse on B', f: '∫F dt = m_B[(v_B)₂ − (v_B)₁]', s: `∫F dt = ${fmt(mB)}(${fmt(vB2)} − (${fmt(vB1)}))`, r: `∫F dt = ${fmt(JB)} ${u.IMP}` });
    if (e === 1) warn.push('e = 1 is a perfectly elastic impact: no energy is lost.');
    const status = st.find === 'e' ? `e = ${fmt(e)}, energy lost ${fmt(loss)} ${u.E}` : st.find === 'plastic' ? `v₂ = ${fmt(vA2)} ${u.V}, energy lost ${fmt(loss)} ${u.E}` : `(v_A)₂ = ${fmt(vA2)}, (v_B)₂ = ${fmt(vB2)} ${u.V}`;
    return DY.result(status, warn.length ? 'warn' : 'ok', out, S, { mode: 'central', u, mA, mB, e, A1: [vA1, 0], B1: [vB1, 0], A2: [vA2, 0], B2: [vB2, 0], T1, T2, plastic: st.find === 'plastic' }, warn);
  }

  /* ---------------- Oblique impact of two smooth disks ---------------- */
  function oblique(st, u) {
    const S = Steps(), out = [];
    const mA = B(+st.mA, 'M', u), mB = B(+st.mB, 'M', u), e = +st.e;
    if (!(mA > 0) || !(mB > 0)) return fail(`Enter both ${u.us ? 'weights' : 'masses'}.`);
    if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution must be from 0 to 1.');
    const sA = +st.sA, sB = +st.sB, tA = +st.thA * D2R, tB = +st.thB * D2R;
    if (!(sA >= 0) || !(sB >= 0) || !isFinite(tA) || !isFinite(tB)) return fail('Enter the speed and direction of each disk.');
    const ax = sA * Math.cos(tA), ay = sA * Math.sin(tA), bx = sB * Math.cos(tB), by = sB * Math.sin(tB);
    S.add({ t: 'Components along the line of impact x and the plane of contact y', n: 'x runs from the centre of A to the centre of B; angles are measured counterclockwise from +x.',
      f: '(v)ₓ = v cos θ,  (v)ᵧ = v sin θ', s: `(v_Ax)₁ = ${fmt(sA)} cos ${fmt(+st.thA)}°, (v_Ay)₁ = ${fmt(sA)} sin ${fmt(+st.thA)}°;  (v_Bx)₁ = ${fmt(sB)} cos ${fmt(+st.thB)}°, (v_By)₁ = ${fmt(sB)} sin ${fmt(+st.thB)}°`,
      r: `(v_Ax)₁ = ${fmt(ax)}, (v_Ay)₁ = ${fmt(ay)}, (v_Bx)₁ = ${fmt(bx)}, (v_By)₁ = ${fmt(by)} ${u.V}` });
    if (!(ax > bx + 1e-12)) return fail('Along the line of impact A must be closing on B, (v_Ax)₁ > (v_Bx)₁; otherwise they do not collide.');
    const p1 = mA * ax + mB * bx, rel = ax - bx, ax2 = (p1 - mB * e * rel) / (mA + mB), bx2 = ax2 + e * rel;
    S.add({ t: 'Conservation of "x" momentum', f: '(+→) m_A(v_Ax)₁ + m_B(v_Bx)₁ = m_A(v_Ax)₂ + m_B(v_Bx)₂', s: `${fmt(mA)}(${fmt(ax)}) + ${fmt(mB)}(${fmt(bx)}) = ${fmt(mA)}(v_Ax)₂ + ${fmt(mB)}(v_Bx)₂`, r: `${fmt(mA)}(v_Ax)₂ + ${fmt(mB)}(v_Bx)₂ = ${fmt(p1)}` });
    S.add({ t: 'Coefficient of restitution (x)', f: 'e = [(v_Bx)₂ − (v_Ax)₂]/[(v_Ax)₁ − (v_Bx)₁]', s: `(v_Bx)₂ − (v_Ax)₂ = ${fmt(e)}(${fmt(ax)} − (${fmt(bx)})) = ${fmt(e * rel)}`, r: `(v_Ax)₂ = ${fmt(ax2)} ${u.V},  (v_Bx)₂ = ${fmt(bx2)} ${u.V}` });
    S.add({ t: 'Conservation of "y" momentum of each disk', n: 'The disks are smooth, so no impulse acts in the plane of contact and each keeps its y component.', f: '(+↑) m_A(v_Ay)₁ = m_A(v_Ay)₂;  m_B(v_By)₁ = m_B(v_By)₂', r: `(v_Ay)₂ = ${fmt(ay)} ${u.V},  (v_By)₂ = ${fmt(by)} ${u.V}` });
    const vA2 = Math.hypot(ax2, ay), vB2 = Math.hypot(bx2, by), aA2 = Math.atan2(ay, ax2) / D2R, aB2 = Math.atan2(by, bx2) / D2R;
    S.add({ t: 'Final velocities', f: 'v = √(vₓ² + vᵧ²),  θ = tan⁻¹(vᵧ/vₓ)', r: `(v_A)₂ = ${fmt(vA2)} ${u.V} at ${fmt(aA2)}°,  (v_B)₂ = ${fmt(vB2)} ${u.V} at ${fmt(aB2)}°` });
    const T1 = 0.5 * mA * sA * sA + 0.5 * mB * sB * sB, T2 = 0.5 * mA * vA2 * vA2 + 0.5 * mB * vB2 * vB2;
    S.add({ t: 'Loss of energy', f: 'ΣU₁₋₂ = T₂ − T₁', s: `T₁ = ${fmt(T1)}, T₂ = ${fmt(T2)} ${u.E}`, r: `${fmt(T1 - T2)} ${u.E} lost` });
    out.push({ k: '(v_Ax)₂', v: ax2, u: u.V, hl: true }, { k: '(v_Ay)₂', v: ay, u: u.V }, { k: '(v_Bx)₂', v: bx2, u: u.V, hl: true }, { k: '(v_By)₂', v: by, u: u.V },
      { k: 'Speed of A after (v_A)₂', v: vA2, u: u.V }, { k: 'Direction of A after θ_A2', v: aA2, u: '°' }, { k: 'Speed of B after (v_B)₂', v: vB2, u: u.V }, { k: 'Direction of B after θ_B2', v: aB2, u: '°' }, { k: 'Energy lost', v: T1 - T2, u: u.E });
    return DY.result(`(v_A)₂ = ${fmt(vA2)} at ${fmt(aA2)}°, (v_B)₂ = ${fmt(vB2)} ${u.V} at ${fmt(aB2)}°`, 'ok', out, S, { mode: 'oblique', u, mA, mB, e, A1: [ax, ay], B1: [bx, by], A2: [ax2, ay], B2: [bx2, by], T1, T2 }, []);
  }

  /* ---------------- Ball striking a fixed wall or floor ---------------- */
  function wall(st, u) {
    const S = Steps(), out = [];
    const v1 = +st.v1, t1 = +st.th1 * D2R;
    if (!(v1 > 0)) return fail('Enter the speed of the ball before impact.');
    if (!(t1 > 0 && t1 <= Math.PI / 2 + 1e-9)) return fail('The angle between the path and the surface must be more than 0° and at most 90°.');
    const vn1 = v1 * Math.sin(t1), vt = v1 * Math.cos(t1);
    S.add({ t: 'Components before impact', n: 'n is normal to the surface (the line of impact), t lies along it; θ is measured from the surface.', f: '(v_n)₁ = v₁ sin θ₁,  (v_t)₁ = v₁ cos θ₁', s: `(v_n)₁ = ${fmt(v1)} sin ${fmt(+st.th1)}°, (v_t)₁ = ${fmt(v1)} cos ${fmt(+st.th1)}°`, r: `(v_n)₁ = ${fmt(vn1)}, (v_t)₁ = ${fmt(vt)} ${u.V}` });
    let e;
    if (st.find === 'e') {
      const t2 = +st.th2 * D2R;
      if (!(t2 > 0 && t2 <= Math.PI / 2 + 1e-9)) return fail('Enter the rebound angle from the surface, more than 0° and at most 90°.');
      e = Math.tan(t2) / Math.tan(t1);
      if (Math.abs(t1 - Math.PI / 2) < 1e-9) return fail('For a head-on impact (θ₁ = 90°) the rebound angle cannot give e; use the rebound speed instead.');
      S.add({ t: 'Coefficient of restitution from the rebound angle', n: 'The tangential component is kept, so tan θ₂ = e tan θ₁.', f: 'e = tan θ₂/tan θ₁', s: `e = tan ${fmt(+st.th2)}°/tan ${fmt(+st.th1)}°`, r: `e = ${fmt(e)}` });
      if (e > 1 + 1e-9) return fail(`These angles give e = ${fmt(e)}, more than 1. The ball cannot leave steeper than it arrived.`);
    } else {
      e = +st.e; if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution must be from 0 to 1.');
    }
    const vn2 = e * vn1, v2 = Math.hypot(vn2, vt), t2 = Math.atan2(vn2, vt) / D2R;
    S.add({ t: 'Coefficient of restitution (n)', n: 'The surface does not move, so (v_s)₁ = (v_s)₂ = 0.', f: 'e = (v_n)₂/(v_n)₁  ⇒  (v_n)₂ = e(v_n)₁', s: `(v_n)₂ = ${fmt(e)}(${fmt(vn1)})`, r: `(v_n)₂ = ${fmt(vn2)} ${u.V} (away from the surface)` });
    S.add({ t: 'Momentum along the surface', n: 'The surface is smooth, so no impulse acts along t.', f: '(v_t)₂ = (v_t)₁', r: `(v_t)₂ = ${fmt(vt)} ${u.V}` });
    S.add({ t: 'Velocity after impact', f: 'v₂ = √((v_n)₂² + (v_t)₂²),  θ₂ = tan⁻¹((v_n)₂/(v_t)₂)', r: `v₂ = ${fmt(v2)} ${u.V} at θ₂ = ${fmt(t2)}° from the surface` });
    out.push({ k: 'Speed after impact v₂', v: v2, u: u.V, hl: true }, { k: 'Angle from the surface θ₂', v: t2, u: '°', hl: true });
    if (st.find === 'e') out.push({ k: 'Coefficient of restitution e', v: e, u: '', hl: true });
    out.push({ k: 'Normal component after (v_n)₂', v: vn2, u: u.V }, { k: 'Tangential component (v_t)₂', v: vt, u: u.V }, { k: 'Kinetic energy kept T₂/T₁', v: (100 * v2 * v2) / (v1 * v1), u: '%' });
    return DY.result(`v₂ = ${fmt(v2)} ${u.V} at ${fmt(t2)}°`, 'ok', out, S, { mode: 'wall', u, e, v1, th1: +st.th1, v2, th2: t2, vn1, vn2, vt, surf: st.surf }, []);
  }

  /* ---------------- Ball bouncing on a floor ---------------- */
  function bounce(st, u, g) {
    const S = Steps(), out = [], warn = [];
    const h0 = +st.h0; if (!(h0 > 0)) return fail('Enter the drop height h₀.');
    const nb = Math.round(+st.nb); if (!(nb >= 1 && nb <= 12)) return fail('Show from 1 to 12 bounces.');
    let e;
    const v0 = Math.sqrt(2 * g * h0);
    S.add({ t: 'Speed just before the first impact', n: 'Conservation of energy from rest at h₀, datum at the floor.', f: 'm g h₀ = ½mv₁²  ⇒  v₁ = √(2gh₀)', s: `v₁ = √(2(${fmt(g)})(${fmt(h0)}))`, r: `v₁ = ${fmt(v0)} ${u.V} ↓` });
    if (st.find === 'e') {
      const h1 = +st.h1; if (!(h1 >= 0)) return fail('Enter the measured rebound height h₁.');
      if (h1 > h0) return fail('The ball cannot rebound higher than it was dropped (that would need e > 1).');
      e = Math.sqrt(h1 / h0);
      S.add({ t: 'Coefficient of restitution from the rebound height', n: 'Rebound speed √(2gh₁) over the impact speed √(2gh₀).', f: 'e = (v)₂/(v)₁ = √(h₁/h₀)', s: `e = √(${fmt(h1)}/${fmt(h0)})`, r: `e = ${fmt(e)}` });
    } else { e = +st.e; if (!(e >= 0 && e <= 1)) return fail('The coefficient of restitution must be from 0 to 1.'); }
    S.add({ t: 'Each impact with the floor', n: 'The floor does not move, so each rebound speed is e times the impact speed; the rebound height goes with the square of the speed.', f: '(v)₂ = e(v)₁;  h₁ = (e v₁)²/2g = e²h₀;  h_n = e²ⁿh₀', s: `h₁ = (${fmt(e)})²(${fmt(h0)})`, r: `rebound speed ${fmt(e * v0)} ${u.V} ↑, h₁ = ${fmt(e * e * h0)} ${u.L}` });
    const rows = []; for (let n = 1; n <= nb; n++) rows.push([String(n), fmt(Math.pow(e, n) * v0), fmt(Math.pow(e, 2 * n) * h0), fmt(2 * Math.pow(e, n) * v0 / g)]);
    S.add({ t: 'Bounce table', n: 'Speed leaving the floor, the height reached and the time in the air for each bounce.', table: { head: ['Bounce n', `Speed up (${u.V})`, `Height h_n (${u.L})`, 'Time in air (s)'], rows } });
    const t0 = Math.sqrt((2 * h0) / g);
    out.push({ k: 'Speed at the first impact v₁', v: v0, u: u.V }, { k: 'First rebound height h₁', v: e * e * h0, u: u.L, hl: true });
    if (nb >= 2) out.push({ k: 'Second rebound height h₂', v: Math.pow(e, 4) * h0, u: u.L, hl: true });
    out.push({ k: `Height after ${nb} bounces h_${nb}`, v: Math.pow(e, 2 * nb) * h0, u: u.L });
    if (st.find === 'e') out.splice(1, 0, { k: 'Coefficient of restitution e', v: e, u: '', hl: true });
    if (e < 1 - 1e-9) {
      const dist = (h0 * (1 + e * e)) / (1 - e * e), T = (t0 * (1 + e)) / (1 - e);
      S.add({ t: 'Total distance and time until it comes to rest', n: 'The heights and flight times form geometric series.', f: 's = h₀ + 2Σe²ⁿh₀ = h₀(1 + e²)/(1 − e²);  t = t₀ + 2Σeⁿt₀ = t₀(1 + e)/(1 − e),  t₀ = √(2h₀/g)', s: `t₀ = ${fmt(t0)} s`, r: `s = ${fmt(dist)} ${u.L}, t = ${fmt(T)} s` });
      out.push({ k: 'Total distance travelled', v: dist, u: u.L }, { k: 'Time until it comes to rest', v: T, u: 's' });
    } else warn.push('With e = 1 the ball bounces back to h₀ forever.');
    if (e === 0) warn.push('With e = 0 the ball does not rebound.');
    // Height against time: fall, then nb arcs.
    const seg = [{ t0: 0, v: 0, y0: h0, T: t0 }]; let tt = t0;
    for (let n = 1; n <= nb; n++) { const vu = Math.pow(e, n) * v0, Tn = (2 * vu) / g; seg.push({ t0: tt, v: vu, y0: 0, T: Tn }); tt += Tn; }
    const y = (t) => { for (const s of seg) if (t <= s.t0 + s.T + 1e-12) { const q = t - s.t0; return Math.max(0, s.y0 + s.v * q - 0.5 * g * q * q); } return 0; };
    const vy = (t) => { for (const s of seg) if (t <= s.t0 + s.T + 1e-12) return s.v - g * (t - s.t0); return 0; };
    const hits = seg.slice(1).map((s) => s.t0);
    return DY.result(`h₁ = ${fmt(e * e * h0)} ${u.L}${nb >= 2 ? `, h₂ = ${fmt(Math.pow(e, 4) * h0)} ${u.L}` : ''}`, warn.length ? 'warn' : 'ok', out, S, { mode: 'bounce', u, e, h0, v0, nb, y, vy, hits, span: [0, Math.max(tt, t0 * 1.05)] }, warn);
  }

  const Impact = { defaults, convertState, solve };
  root.Impact = Impact;
  if (typeof module !== 'undefined' && module.exports) module.exports = Impact;
})(typeof window !== 'undefined' ? window : globalThis);
