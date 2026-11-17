/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · common pieces (physics only; browser + Node)
 * Units for each system, conversion of a module's inputs when the units
 * are switched, the table of average material properties (Hibbeler,
 * back endpaper) and the areas of simple bar sections.
 *
 * Inputs are stored in the units shown next to them (for example mm for a
 * diameter, MPa for a stress, GPa for E). Each module lists the kind of
 * every numeric input; the solver turns them into base units (N, m, Pa
 * or lb, ft... through Core.unitFactor) and back for display.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { convert, twin, tidy, fmt } = Core;

  /** Display units of each kind of quantity, for a system and a force unit. */
  function units(U, fu) {
    const us = U.id === 'US', F = fu || (us ? 'kip' : 'kN'), S = U.lenS, L = U.len;
    return {
      F, L, S, us,
      ST: us ? 'ksi' : 'MPa', // stress
      MOD: us ? 'ksi' : 'GPa', // E and G
      A: `${S}²`, I: `${S}⁴`, Q: `${S}³`,
      FL: `${F}·${L}`, // moments and torques
      W: `${F}/${L}`, // distributed load
      P: us ? 'psi' : 'kPa', // pressure
      T: us ? '°F' : '°C', // temperature
      g: U.g, mass: us ? 'slug' : 'kg',
    };
  }
  /** Factor from a unit to base units; °C, °F and per-degree units are handled here too. */
  const TEMP = { '°C': 1, '°F': 5 / 9 };
  function toBase(v, u) { if (u in TEMP) return v * TEMP[u]; return v * Core.unitFactor(u); }
  function fromBase(v, u) { if (u in TEMP) return v / TEMP[u]; return v / Core.unitFactor(u); }

  /**
   * Convert every numeric field of `obj` listed in `kinds` ({key: kind}) from one system to the other.
   * Kinds: F, L, S, ST, MOD, A, I, Q, FL, W, P, T (temperature change), AL (expansion coefficient
   * stored as ×10⁻⁶ per degree), FS (force per small length, e.g. kN/mm), MASS, none.
   * fu is the force unit before the switch; the new force unit is its twin.
   */
  function convertObj(obj, kinds, from, to, fu) {
    if (!obj || from === to) return obj;
    const Uf = units(Core.UNITS[from], fu), Ut = units(Core.UNITS[to], twin(fu, to));
    Object.keys(kinds).forEach((k) => {
      const kind = kinds[k], v = obj[k];
      if (typeof v !== 'number' || !isFinite(v)) return;
      if (kind === 'AL') { obj[k] = tidy((v * TEMP[Ut.T]) / TEMP[Uf.T], 6); return; }
      if (kind === 'T') { obj[k] = tidy((v * TEMP[Uf.T]) / TEMP[Ut.T], 6); return; }
      if (kind === 'MASS') { obj[k] = tidy(convert(v, Uf.mass, Ut.mass), 6); return; }
      if (!(kind in Uf)) return;
      obj[k] = tidy(convert(v, Uf[kind], Ut[kind]), 6);
    });
    return obj;
  }

  /* Average mechanical properties of typical engineering materials (Hibbeler, back endpaper).
   * SI: E, G in GPa, σY, σu in MPa, α in 10⁻⁶/°C, ρ in Mg/m³.  U.S.: E, G in 10³ ksi, σY, σu in ksi, α in 10⁻⁶/°F. */
  const MATERIALS = [
    { id: 'a36', name: 'Structural steel A-36', SI: { E: 200, G: 75, sY: 250, su: 400, nu: 0.32, al: 12 }, US: { E: 29.0, G: 11.0, sY: 36, su: 58, nu: 0.32, al: 6.60 } },
    { id: 'a992', name: 'Structural steel A992', SI: { E: 200, G: 75, sY: 345, su: 450, nu: 0.32, al: 12 }, US: { E: 29.0, G: 11.0, sY: 50, su: 65, nu: 0.32, al: 6.60 } },
    { id: 'ss304', name: 'Stainless steel 304', SI: { E: 193, G: 75, sY: 207, su: 517, nu: 0.27, al: 17 }, US: { E: 28.0, G: 11.0, sY: 30, su: 75, nu: 0.27, al: 9.60 } },
    { id: 'l2', name: 'Tool steel L2', SI: { E: 200, G: 75, sY: 703, su: 800, nu: 0.32, al: 12 }, US: { E: 29.0, G: 11.0, sY: 102, su: 116, nu: 0.32, al: 6.50 } },
    { id: 'al2014', name: 'Aluminium 2014-T6', SI: { E: 73.1, G: 27, sY: 414, su: 469, nu: 0.35, al: 23 }, US: { E: 10.6, G: 3.9, sY: 60, su: 68, nu: 0.35, al: 12.8 } },
    { id: 'al6061', name: 'Aluminium 6061-T6', SI: { E: 68.9, G: 26, sY: 255, su: 290, nu: 0.35, al: 24 }, US: { E: 10.0, G: 3.7, sY: 37, su: 42, nu: 0.35, al: 13.1 } },
    { id: 'brass', name: 'Red brass C83400', SI: { E: 101, G: 37, sY: 70, su: 241, nu: 0.35, al: 18 }, US: { E: 14.6, G: 5.4, sY: 11.4, su: 35, nu: 0.35, al: 9.80 } },
    { id: 'bronze', name: 'Bronze C86100', SI: { E: 103, G: 38, sY: 345, su: 655, nu: 0.34, al: 17 }, US: { E: 15.0, G: 5.6, sY: 50, su: 35, nu: 0.34, al: 9.60 } },
    { id: 'mg', name: 'Magnesium Am 1004-T61', SI: { E: 44.7, G: 18, sY: 152, su: 276, nu: 0.30, al: 26 }, US: { E: 6.48, G: 2.5, sY: 22, su: 40, nu: 0.30, al: 14.3 } },
    { id: 'ti', name: 'Titanium Ti-6Al-4V', SI: { E: 120, G: 44, sY: 924, su: 1000, nu: 0.36, al: 9.4 }, US: { E: 17.4, G: 6.4, sY: 134, su: 145, nu: 0.36, al: 5.20 } },
    { id: 'castiron', name: 'Gray cast iron ASTM 20', SI: { E: 67.0, G: 27, sY: null, su: 179, nu: 0.28, al: 12 }, US: { E: 10.0, G: 3.9, sY: null, su: 26, nu: 0.28, al: 6.70 } },
    { id: 'concH', name: 'Concrete, high strength (σY in compression)', SI: { E: 29.0, G: null, sY: 38, su: null, nu: 0.15, al: 11 }, US: { E: 4.20, G: null, sY: 5.5, su: null, nu: 0.15, al: 6.0 } },
    { id: 'fir', name: 'Douglas fir (σu in compression along the grain)', SI: { E: 13.1, G: null, sY: null, su: 26, nu: 0.29, al: null }, US: { E: 1.90, G: null, sY: null, su: 3.78, nu: 0.29, al: null } },
  ];
  /** Material values in the display units (E and G in GPa or ksi, stresses in MPa or ksi). */
  function material(id, sys) {
    const m = MATERIALS.find((x) => x.id === id); if (!m) return null;
    const v = Object.assign({}, m[sys]);
    if (sys === 'US') { if (v.E) v.E = tidy(v.E * 1000); if (v.G) v.G = tidy(v.G * 1000); }
    return Object.assign({ name: m.name }, v);
  }

  /** Area of a bar section from its shape, in the small length unit squared. sec = {shape, d, di, b, h, A} */
  function barArea(sec) {
    const sh = sec.shape || 'circle';
    if (sh === 'circle') return { A: (Math.PI / 4) * sec.d * sec.d, f: 'A = πd²/4', s: `π(${fmt(sec.d)})²/4` };
    if (sh === 'tube') return { A: (Math.PI / 4) * (sec.d * sec.d - sec.di * sec.di), f: 'A = π(d_o² − d_i²)/4', s: `π(${fmt(sec.d)}² − ${fmt(sec.di)}²)/4` };
    if (sh === 'rect') return { A: sec.b * sec.h, f: 'A = b h', s: `(${fmt(sec.b)})(${fmt(sec.h)})` };
    return { A: +sec.A, f: 'A (given)', s: fmt(+sec.A) };
  }
  function barAreaErr(sec, S) {
    const sh = sec.shape || 'circle';
    if (sh === 'circle' && !(sec.d > 0)) return 'Enter the diameter of the bar.';
    if (sh === 'tube' && !(sec.d > 0 && sec.di >= 0 && sec.di < sec.d)) return 'The inner diameter must be smaller than the outer diameter.';
    if (sh === 'rect' && !(sec.b > 0 && sec.h > 0)) return 'Enter both sides of the rectangle.';
    if (sh === 'area' && !(sec.A > 0)) return `Enter the cross-sectional area in ${S}².`;
    return null;
  }

  /** Result object in the shared contract. */
  const result = (text, cls, out, S, geo, warn) => ({ ok: true, err: [], warn: warn || [], status: { cls: cls || 'ok', text }, out, steps: S.list, geo });
  /** "16 MPa" style text for a value in base units shown in unit u. */
  const show = (vBase, u) => `${fmt(fromBase(vBase, u))} ${u}`;

  const MD = { units, toBase, fromBase, convertObj, MATERIALS, material, barArea, barAreaErr, result, show };
  root.MD = MD;
  if (typeof module !== 'undefined' && module.exports) module.exports = MD;
})(typeof window !== 'undefined' ? window : globalThis);
