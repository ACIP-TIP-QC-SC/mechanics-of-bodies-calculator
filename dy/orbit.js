/* =====================================================================
 * DYNAMICS · Central-force motion and space mechanics (physics only; browser + Node).
 * Used by Pkin (scene 'orbit'). Hibbeler, Dynamics 15e, Section 13.7.
 *   Path:  1/r = C cos θ + GM/h²,  h = r₀v₀,  C = (1/r₀)(1 − GM/(r₀v₀²))     (13–19, 13–21)
 *   Eccentricity e = Ch²/GM                                                  (13–22)
 *   Circular orbit v_c = √(GM/r₀); escape (parabola) v_e = √(2GM/r₀)          (13–25, 13–26)
 *   Ellipse: r_a = r_p/(2GM/(r_p v_p²) − 1)                                  (13–27)
 *            a = (r_p + r_a)/2,  b = √(r_p r_a),  T = π(r_p + r_a)√(r_p r_a)/h  (13–28 … 13–31)
 *   Speed anywhere from h = r v_θ and the energy: v² = GM(2/r − 1/a)
 * Launch is parallel to the surface (θ = 0 at the launch point). The planet is given as a multiple of
 * the earth's mass, with G and M_e as the book uses them.
 * Radii are typed in km (SI) or mi (U.S.), from the planet's centre or as heights above its surface.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;

  // Book constants: G = 66.73(10⁻¹²) m³/(kg·s²), M_e = 5.976(10²⁴) kg, R_e = 6378 km;
  // U.S.: G = 34.4(10⁻⁹) lb·ft²/slug², M_e = 409(10²¹) slug.
  const GM_SI = 66.73e-12 * 5.976e24, GM_US = 34.4e-9 * 409e21, KM_PER_MI = 1.609344;
  const defaults = () => ({ otask: 'ellipse', oMf: 0.6, oRp: 7600, oRa: 18300, oR0: 7600, oV0: 6670, oRe: 6378, oAlt: false, oR2: 25378 });
  const LKEYS = ['oRp', 'oRa', 'oR0', 'oRe', 'oR2'];
  function convert(st, from, to) {
    if (from === to) return st;
    const k = to === 'US' ? 1 / KM_PER_MI : KM_PER_MI;
    LKEYS.forEach((key) => { if (isFinite(+st[key])) st[key] = Core.tidy(+st[key] * k, 6); });
    st.oV0 = Core.tidy(+st.oV0 * DY.factor('V', from, to), 6);
    return st;
  }

  /** Orbit from the launch radius r₀ and the speed v₀ there (parallel to the surface). */
  function fromLaunch(GM, r0, v0) {
    const h = r0 * v0, C = (1 / r0) * (1 - GM / (r0 * v0 * v0)), e = (C * h * h) / GM;
    const o = { r0, v0, h, C, e, GM, vc: Math.sqrt(GM / r0), ve: Math.sqrt((2 * GM) / r0) };
    if (Math.abs(e) < 1e-9) o.type = 'circle';
    else if (e < 1) o.type = 'ellipse';
    else if (Math.abs(e - 1) < 1e-9) o.type = 'parabola';
    else o.type = 'hyperbola';
    if (e < 1 - 1e-12) {
      const rFar = r0 / ((2 * GM) / (r0 * v0 * v0) - 1); // the other apse
      o.rp = Math.min(r0, rFar); o.ra = Math.max(r0, rFar);
      o.a = (o.rp + o.ra) / 2; o.b = Math.sqrt(o.rp * o.ra);
      o.T = (Math.PI * (o.rp + o.ra) * Math.sqrt(o.rp * o.ra)) / h;
      o.vp = h / o.rp; o.va = h / o.ra;
    } else { o.rp = r0; o.vp = v0; }
    o.r = (th) => 1 / (C * Math.cos(th) + GM / (h * h)); // θ from the launch point
    return o;
  }

  function solve(st, u) {
    const S = Steps(), out = [], warn = [];
    const us = u.us, Lu = us ? 'mi' : 'km', toBase = us ? 5280 : 1000, V = u.V; // radii typed in km or mi, worked in m or ft
    const Mf = +st.oMf, GM = (us ? GM_US : GM_SI) * Mf, Re = +st.oRe * toBase, alt = !!st.oAlt;
    if (!(Mf > 0)) return fail("Enter the planet's mass as a multiple of the earth's.");
    if (alt && !(Re > 0)) return fail("Enter the planet's radius.");
    const R = (key, what) => { const v = +st[key]; if (!(v >= 0) || (!alt && !(v > 0))) throw new Error(`Enter ${what}.`); return v * toBase + (alt ? Re : 0); };
    const rTxt = (r) => `${fmt(r / toBase)} ${Lu}`;
    S.add({ t: 'Gravity of the planet', n: `${us ? 'G = 34.4(10⁻⁹) lb·ft²/slug², M_e = 409(10²¹) slug' : 'G = 66.73(10⁻¹²) m³/(kg·s²), M_e = 5.976(10²⁴) kg'}; M = ${fmt(Mf)} M_e.`, r: `GM = ${fmt(GM)} ${us ? 'ft³/s²' : 'm³/s²'}` });
    let o, r2, tr = null;
    try {
      if (st.otask === 'launch') {
        const r0 = R('oR0', 'the launch radius'), v0 = +st.oV0;
        if (!(v0 > 0)) return fail('Enter the launch speed.');
        o = fromLaunch(GM, r0, v0);
        S.add({ t: 'Launched parallel to the surface', f: 'h = r₀v₀,  C = (1/r₀)(1 − GM/(r₀v₀²)),  e = Ch²/GM', s: `r₀ = ${rTxt(r0)}, v₀ = ${fmt(v0)} ${V}`, r: `h = ${fmt(o.h)}, C = ${fmt(o.C)}, e = ${fmt(o.e)}: ${o.type === 'ellipse' ? 'an' : 'a'} ${o.type}` });
      } else if (st.otask === 'transfer') {
        // from a circular orbit at r₁ onto the ellipse that touches r₂; o is that transfer ellipse
        const r1 = R('oRp', 'the radius of the circular orbit'); r2 = R('oR2', 'the radius to reach');
        if (Math.abs(r2 - r1) < 1e-9 * r1) return fail('The radius to reach must differ from the starting one.');
        const rp = Math.min(r1, r2), ra = Math.max(r1, r2), vpE = Math.sqrt((2 * GM * ra) / (rp * (rp + ra))), vaE = (vpE * rp) / ra;
        const v1 = r1 === rp ? vpE : vaE, v2 = r2 === ra ? vaE : vpE, vc1 = Math.sqrt(GM / r1), vc2 = Math.sqrt(GM / r2);
        tr = { r1, r2, rp, ra, vc1, vc2, v1, v2, dv1: v1 - vc1, dv2: vc2 - v2 };
        o = fromLaunch(GM, r1, v1);
        S.add({ t: 'Circular orbit at r₁', f: 'v_c = √(GM/r₁)', s: `r₁ = ${rTxt(r1)}`, r: `v_c = ${fmt(vc1)} ${V}` });
        S.add({ t: 'Transfer ellipse', n: `It leaves the circle at r₁ on an ellipse whose other apse is r₂ = ${rTxt(r2)}.`, f: 'v_p = √(2GM r_a/(r_p(r_p + r_a))),  v_a = v_p r_p/r_a', r: `on the ellipse: ${fmt(v1)} ${V} at r₁, ${fmt(v2)} ${V} at r₂` });
        S.add({ t: 'Speed changes', f: 'Δv₁ = v_ellipse(r₁) − v_c(r₁),  Δv₂ = v_c(r₂) − v_ellipse(r₂)', r: `Δv₁ = ${fmt(tr.dv1)} ${V}, Δv₂ = ${fmt(tr.dv2)} ${V}` });
      } else {
        const rp = R('oRp', 'the periapsis distance'), ra = st.otask === 'circle' ? rp : R('oRa', 'the apoapsis distance');
        if (ra < rp) return fail('The apoapsis (farthest point) must be at least as far as the periapsis.');
        const vp = Math.sqrt((2 * GM * ra) / (rp * (rp + ra)));
        S.add({ t: st.otask === 'circle' ? 'Circular orbit' : 'Speed at the periapsis', f: st.otask === 'circle' ? 'v_c = √(GM/r₀)' : 'r_a = r_p/(2GM/(r_p v_p²) − 1)  ⇒  v_p = √(2GM r_a/(r_p(r_p + r_a)))', s: st.otask === 'circle' ? `r₀ = ${rTxt(rp)}` : `r_p = ${rTxt(rp)}, r_a = ${rTxt(ra)}`, r: `v_p = ${fmt(vp)} ${V}` });
        o = fromLaunch(GM, rp, vp);
      }
    } catch (e) { return fail(e.message); }
    if (o.type === 'ellipse' || o.type === 'circle') {
      S.add({ t: 'Size and period', f: 'a = (r_p + r_a)/2,  b = √(r_p r_a),  T = π(r_p + r_a)√(r_p r_a)/h', s: `r_p = ${rTxt(o.rp)}, r_a = ${rTxt(o.ra)}`, r: `a = ${rTxt(o.a)}, b = ${rTxt(o.b)}, T = ${fmt(o.T)} s = ${fmt(o.T / 3600)} h` });
      if (!tr) S.add({ t: 'Speeds at the apses', f: 'h = r_p v_p = r_a v_a', r: `v_p = ${fmt(o.vp)} ${V}, v_a = ${fmt(o.va)} ${V}` });
      out.push({ k: 'Speed at the periapsis v_p', v: o.vp, u: V, hl: !tr }, { k: 'Speed at the apoapsis v_a', v: o.va, u: V, hl: !tr }, { k: 'Eccentricity e', v: o.e, u: '' }, { k: 'Periapsis r_p', v: o.rp / toBase, u: Lu }, { k: 'Apoapsis r_a', v: o.ra / toBase, u: Lu }, { k: 'Period T', v: o.T / 3600, u: 'h' });
    } else {
      out.push({ k: 'Eccentricity e', v: o.e, u: '', hl: true });
      warn.push(`The speed is at or above the escape speed ${fmt(o.ve)} ${V}: the path is a ${o.type} and it never comes back.`);
    }
    S.add({ t: 'Equation of the path', f: '1/r = C cos θ + GM/h²  (θ from the launch point)', r: `1/r = ${fmt(o.C)} cos θ + ${fmt(GM / (o.h * o.h))}` });
    S.add({ t: 'Circular and escape speeds at r₀', f: 'v_c = √(GM/r₀),  v_e = √(2GM/r₀)', r: `v_c = ${fmt(o.vc)} ${V}, v_e = ${fmt(o.ve)} ${V}` });
    out.push({ k: 'Constant C', v: o.C, u: `1/${us ? 'ft' : 'm'}` }, { k: 'Angular momentum per unit mass h', v: o.h, u: us ? 'ft²/s' : 'm²/s' }, { k: 'Circular-orbit speed at r₀', v: o.vc, u: V }, { k: 'Escape speed at r₀', v: o.ve, u: V });
    if (o.vp < o.ve) out.push({ k: 'Speed increase at r₀ to escape', v: o.ve - o.v0, u: V });
    if (tr) out.unshift({ k: 'Speed in the circular orbit at r₁', v: tr.vc1, u: V, hl: true }, { k: 'Speed change at r₁ to reach r₂, Δv₁', v: tr.dv1, u: V, hl: true }, { k: 'Speed change at r₂ to circle there, Δv₂', v: tr.dv2, u: V });
    const head = tr ? `Δv₁ = ${fmt(tr.dv1)} ${V} (from ${fmt(tr.vc1)} to ${fmt(tr.v1)} ${V})` : o.type === 'ellipse' || o.type === 'circle' ? `v_p = ${fmt(o.vp)}, v_a = ${fmt(o.va)} ${V}, e = ${fmt(o.e)}` : `${o.type === 'ellipse' ? 'An' : 'A'} ${o.type}, e = ${fmt(o.e)}`;
    return DY.result(head, warn.length ? 'warn' : 'ok', out, S, { scene: 'orbit', u, o, tr, Re: Re > 0 ? Re : 0, toBase, Lu, span: [0, o.T ? o.T : 1] }, warn);
  }

  const Orbit = { defaults, solve, convert, fromLaunch, GM_SI, GM_US };
  root.Orbit = Orbit;
  if (typeof module !== 'undefined' && module.exports) module.exports = Orbit;
})(typeof window !== 'undefined' ? window : globalThis);
