/* =====================================================================
 * DYNAMICS · Power of a motor or engine (physics only; browser + Node). Used by Pkin (scene 'power').
 * Hibbeler, Dynamics 15e, Section 14.4: P = F·v (14–10), efficiency ε = P_out/P_in (14–11).
 * A vehicle or hoist of mass m moves up an incline θ (90° for a lift) at speed v with acceleration a,
 * against a constant resistance R and a drag c·v². A counterweight m_c on a cable over a pulley at the
 * top can help it. The driving force along the motion is
 *     F = m(a + g sin θ) + R + c v² − m_c(g − a)
 * and the motor supplies P_out = F v, so P_in = F v/ε. Given P_in, the steepest incline, the top speed
 * or the acceleration follows from the same equation.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;

  const defaults = () => ({ pfind: 'power', pm: 2000, pth: 7, pv: 27.78, pa: 0, pR: 0, pc: 0, pmc: 0, peff: 0.65, pP: 100000 });
  const KINDS = { pm: 'M', pv: 'V', pa: 'A', pR: 'F', pmc: 'M', pP: 'PW' };
  /** c in F_D = c v² carries force/(speed²). */
  function convert(st, from, to) {
    if (from === to) return st;
    DY.convertObj(st, KINDS, from, to);
    const f = DY.factor('F', from, to) / Math.pow(DY.factor('V', from, to), 2);
    st.pc = Core.tidy(+st.pc * f, 8);
    return st;
  }

  function solve(st, u) {
    const r = solve0(st, u);
    if (r.ok && r.geo) { const { m, mc } = r.geo, g = u.g, R = +st.pR || 0, c = +st.pc || 0, eff = +st.peff; r.geo.Pin = (v) => ((m * (r.geo.a + g * Math.sin(r.geo.th * D2R)) + R + c * v * v - mc * (g - r.geo.a)) * v) / eff; r.geo.eff = eff; }
    return r;
  }
  function solve0(st, u) {
    const S = Steps(), out = [], warn = [], g = u.g;
    const m = DY.toBase(+st.pm, 'M', u), mc = DY.toBase(+st.pmc || 0, 'M', u), th = +st.pth * D2R, R = +st.pR || 0, c = +st.pc || 0, eff = +st.peff;
    const pu = u.us ? 'ft·lb/s' : 'W', find = st.pfind || 'power';
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} being driven.`);
    if (!(mc >= 0)) return fail('The counterweight cannot be negative.');
    if (!(th >= -Math.PI / 2 && th <= Math.PI / 2) && find !== 'angle') return fail('The incline angle must be from −90° to 90°.');
    if (!(R >= 0 && c >= 0)) return fail('Resistance and drag cannot be negative.');
    if (!(eff > 0 && eff <= 1)) return fail('The efficiency must be more than 0 and at most 1.');
    const Fof = (v, a, t) => m * (a + g * Math.sin(t)) + R + c * v * v - mc * (g - a);
    const hp = (p) => (u.us ? ` = ${fmt(p / 550)} hp` : '');
    const terms = `F = m(a + g sin θ)${R ? ' + R' : ''}${c ? ' + c v²' : ''}${mc ? ' − m_c(g − a)' : ''}`;
    S.add({ t: 'Driving force', n: `Along the motion: the weight component, ${R ? 'the resistance R, ' : ''}${c ? 'the drag c v², ' : ''}${mc ? `the counterweight (${fmt(mc * g)} ${u.F}), ` : ''}and m a.`, f: terms });
    if (find === 'power') {
      const v = +st.pv, a = +st.pa || 0;
      if (!(v >= 0)) return fail('Enter the speed.');
      const F = Fof(v, a, th), Po = F * v, Pi = Po / eff;
      S.add({ t: 'Force', s: `F = ${fmt(m)}(${fmt(a)} + ${fmt(g)} sin ${fmt(+st.pth)}°)${R ? ` + ${fmt(R)}` : ''}${c ? ` + ${fmt(c)}(${fmt(v)})²` : ''}${mc ? ` − ${fmt(mc)}(${fmt(g)} − ${fmt(a)})` : ''}`, r: `F = ${fmt(F)} ${u.F}` });
      S.add({ t: 'Power', f: 'P_out = F v,  P_in = P_out/ε', s: `P_out = ${fmt(F)}(${fmt(v)});  P_in = ${fmt(Po)}/${fmt(eff)}`, r: `P_out = ${fmt(Po)} ${pu}, P_in = ${fmt(Pi)} ${pu}${hp(Pi)}` });
      if (F < 0) warn.push('The force needed is negative: the motor would have to brake.');
      out.push({ k: 'Driving force F', v: F, u: u.F }, { k: 'Power output P_out', v: DY.fromBase(Po, 'PW', u), u: u.PW }, { k: 'Power input P_in', v: DY.fromBase(Pi, 'PW', u), u: u.PW, hl: true });
      return DY.result(`P_in = ${fmt(DY.fromBase(Pi, 'PW', u))} ${u.PW}`, warn.length ? 'warn' : 'ok', out, S, geo(u, m, mc, th, v, a, F), warn);
    }
    const Pi = DY.toBase(+st.pP, 'PW', u), Po = Pi * eff;
    if (!(Pi > 0)) return fail('Enter the power supplied.');
    S.add({ t: 'Power output', f: 'P_out = ε P_in', s: `P_out = ${fmt(eff)}(${fmt(Pi)})`, r: `P_out = ${fmt(Po)} ${pu}` });
    if (find === 'angle') {
      const v = +st.pv, a = +st.pa || 0;
      if (!(v > 0)) return fail('Enter a speed above zero.');
      const s = (Po / v - m * a - R - c * v * v + mc * (g - a)) / (m * g);
      S.add({ t: 'Steepest incline', f: 'P_out = F v  ⇒  sin θ = [P_out/v − m a − R − c v² + m_c(g − a)]/(m g)', r: `sin θ = ${fmt(s)}` });
      if (s >= 1) { out.push({ k: 'Largest incline θ', v: 90, u: '°', hl: true }); warn.push('There is power to spare even going straight up.'); return DY.result('It can climb any incline (even vertical)', 'warn', out, S, geo(u, m, mc, Math.PI / 2, v, a, Fof(v, a, Math.PI / 2)), warn); }
      if (s < -1) return fail('Not enough power to move at this speed even going straight down.');
      const t = Math.asin(s);
      out.push({ k: 'Largest incline θ', v: t / D2R, u: '°', hl: true }, { k: 'Driving force F', v: Po / v, u: u.F });
      return DY.result(`θ = ${fmt(t / D2R)}°`, 'ok', out, S, geo(u, m, mc, t, v, a, Po / v), warn);
    }
    if (find === 'speed') {
      const a = +st.pa || 0, F0 = Fof(0, a, th);
      if (!(F0 > 0) && c === 0) return fail('With nothing resisting the motion the speed has no limit. Add an incline, resistance or drag.');
      const h = (v) => Fof(v, a, th) * v - Po;
      let hi = 1; while (h(hi) < 0 && hi < 1e7) hi *= 2;
      if (h(hi) < 0) return fail('No top speed found.');
      let lo = 0;
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (h(mid) < 0) lo = mid; else hi = mid; }
      const v = (lo + hi) / 2, F = Fof(v, a, th);
      S.add({ t: 'Top speed', f: 'P_out = F v with F at that speed (solved for v)', r: `v = ${fmt(v)} ${u.V}, F = ${fmt(F)} ${u.F}` });
      out.push({ k: 'Speed v', v, u: u.V, hl: true }, { k: 'Driving force F', v: F, u: u.F });
      return DY.result(`v = ${fmt(v)} ${u.V}`, 'ok', out, S, geo(u, m, mc, th, v, a, F), warn);
    }
    const v = +st.pv;
    if (!(v > 0)) return fail('Enter a speed above zero.');
    const a = (Po / v - m * g * Math.sin(th) - R - c * v * v + mc * g) / (m + mc);
    S.add({ t: 'Acceleration', f: 'P_out/v = m(a + g sin θ) + R + c v² − m_c(g − a)  ⇒  a = [P_out/v − m g sin θ − R − c v² + m_c g]/(m + m_c)', r: `a = ${fmt(a)} ${u.A}` });
    out.push({ k: 'Acceleration a', v: a, u: u.A, hl: true }, { k: 'Driving force F', v: Po / v, u: u.F });
    return DY.result(`a = ${fmt(a)} ${u.A}`, 'ok', out, S, geo(u, m, mc, th, v, a, Po / v), warn);
  }
  const geo = (u, m, mc, th, v, a, F) => ({ scene: 'power', u, m, mc, th: th / D2R, v, a, F, span: [0, 4] });

  const Motor = { defaults, solve, convert };
  root.Motor = Motor;
  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
