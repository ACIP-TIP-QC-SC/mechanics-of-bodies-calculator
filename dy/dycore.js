/* =====================================================================
 * DYNAMICS · common pieces (physics only; browser + Node)
 * Units of each kind of quantity, conversion of a module's inputs when the
 * units are switched, polynomials, a Runge-Kutta integrator, roots and
 * small vector helpers.
 *
 * Every solver works in the base units of the chosen system, as the book
 * does: SI m, kg, N, s (g = 9.81 m/s²); U.S. Customary ft, slug, lb, s
 * (g = 32.2 ft/s²). In U.S. units a body is given by its weight in lb and
 * its mass is m = W/g in slug. Inputs are stored in the units shown next
 * to them; only small lengths (mm, in.), weights and horsepower differ
 * from the base units.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, tidy } = Core;
  const N_PER_LB = 4.4482216152605, M_PER_FT = 0.3048;

  /** Display units of each kind of quantity in a system. */
  function units(U) {
    const us = U.id === 'US';
    return {
      us, g: U.g,
      L: us ? 'ft' : 'm', S: us ? 'in.' : 'mm', T: 's',
      V: us ? 'ft/s' : 'm/s', A: us ? 'ft/s²' : 'm/s²',
      F: us ? 'lb' : 'N', M: us ? 'lb' : 'kg', Mb: us ? 'slug' : 'kg', // M: what is typed (weight in lb in U.S. units)
      E: us ? 'ft·lb' : 'J', PW: us ? 'hp' : 'W', MO: us ? 'lb·ft' : 'N·m',
      K: us ? 'lb/ft' : 'N/m', KT: us ? 'lb·ft/rad' : 'N·m/rad', CD: us ? 'lb·s/ft' : 'N·s/m',
      I: us ? 'slug·ft²' : 'kg·m²', IMP: us ? 'lb·s' : 'N·s',
      W: 'rad/s', AL: 'rad/s²',
    };
  }
  /* Factor from one display unit to the same kind in the other system. */
  const LEN = { SI: 1, US: 1 / M_PER_FT };
  function factor(kind, from, to) {
    const L = LEN[to] / LEN[from], F = from === to ? 1 : to === 'US' ? 1 / N_PER_LB : N_PER_LB;
    switch (kind) {
      case 'L': case 'S': case 'V': case 'A': return from === to ? 1 : kind === 'S' ? (to === 'US' ? 1 / 25.4 : 25.4) : L;
      case 'F': return F;
      case 'M': return from === to ? 1 : to === 'US' ? 9.81 / N_PER_LB : N_PER_LB / 9.81; // kg ↔ weight in lb (W = m g)
      case 'E': case 'MO': case 'KT': return F * L;
      case 'K': case 'CD': return F / L;
      case 'IMP': return F;
      case 'I': return from === to ? 1 : to === 'US' ? 1 / (14.593902937 * M_PER_FT * M_PER_FT) : 14.593902937 * M_PER_FT * M_PER_FT;
      case 'PW': return from === to ? 1 : to === 'US' ? 1 / 745.69987158227 : 745.69987158227;
      default: return 1;
    }
  }
  /** Convert every numeric field of obj listed in kinds ({key: kind}) from one system to the other. */
  function convertObj(obj, kinds, from, to) {
    if (!obj || from === to) return obj;
    Object.keys(kinds).forEach((k) => {
      const v = obj[k];
      if (typeof v === 'number' && isFinite(v)) obj[k] = tidy(v * factor(kinds[k], from, to), 6);
    });
    return obj;
  }
  /** Convert a list of objects. */
  const convertList = (arr, kinds, from, to) => (arr || []).forEach((o) => convertObj(o, kinds, from, to));

  /** Typed value → base units of the system (m, kg, N, s or ft, slug, lb, s). */
  function toBase(v, kind, u) {
    if (kind === 'S') return u.us ? v / 12 : v / 1000;
    if (kind === 'M') return u.us ? v / u.g : v;
    if (kind === 'PW') return u.us ? v * 550 : v;
    return v;
  }
  function fromBase(v, kind, u) {
    if (kind === 'S') return u.us ? v * 12 : v * 1000;
    if (kind === 'M') return u.us ? v * u.g : v;
    if (kind === 'PW') return u.us ? v / 550 : v;
    return v;
  }
  /** Text "12.5 m/s" of a base value shown as `kind`. */
  const show = (v, kind, u) => `${fmt(fromBase(v, kind, u))} ${u[kind]}`;
  /** Text of a body's mass as the book writes it: "50 kg" or "W = 20 lb (m = 0.6211 slug)". */
  const massTxt = (m, u) => (u.us ? `${fmt(m * u.g)} lb (m = ${fmt(m)} slug)` : `${fmt(m)} kg`);

  /* ------------------------------------------------------------------ */
  /* Polynomials, lowest power first                                    */
  /* ------------------------------------------------------------------ */
  const peval = (c, x) => c.reduce((s, a, i) => s + a * Math.pow(x, i), 0);
  const pder = (c) => c.slice(1).map((a, i) => a * (i + 1));
  const pint = (c, c0) => [c0 || 0].concat(c.map((a, i) => a / (i + 1)));
  const ptrim = (c) => { const o = c.slice(); while (o.length > 1 && Math.abs(o[o.length - 1]) < 1e-14) o.pop(); return o; };

  /** Real roots of a x² + b x + c = 0 (a may be 0), sorted. */
  function quad(a, b, c) {
    if (Math.abs(a) < 1e-14) return Math.abs(b) < 1e-14 ? [] : [-c / b];
    const d = b * b - 4 * a * c;
    if (d < -1e-12 * Math.max(1, b * b)) return [];
    const q = Math.sqrt(Math.max(0, d));
    return [(-b - q) / (2 * a), (-b + q) / (2 * a)].sort((x, y) => x - y);
  }
  /** Sign changes of fn on [a, b], found on n samples and refined by bisection. */
  function rootsOf(fn, a, b, n) {
    n = n || 400;
    const out = [];
    let x0 = a, f0 = fn(a);
    if (Math.abs(f0) < 1e-12) out.push(a);
    for (let i = 1; i <= n; i++) {
      const x1 = a + ((b - a) * i) / n, f1 = fn(x1);
      if (Math.abs(f1) < 1e-12) { if (!out.length || Math.abs(out[out.length - 1] - x1) > (b - a) / n / 2) out.push(x1); }
      else if (f0 * f1 < 0 && Math.abs(f0) > 1e-12) out.push(Core.bisect(fn, x0, x1, 80));
      x0 = x1; f0 = f1;
    }
    return out;
  }
  /** Classical Runge-Kutta for x'' = f(t, x, v) from (t0, x0, v0); returns samples [{t, x, v, a}]. stop(sample) ends it early. */
  function rk4(f, t0, x0, v0, T, n, stop) {
    const h = (T - t0) / n, out = [{ t: t0, x: x0, v: v0, a: f(t0, x0, v0) }];
    let t = t0, x = x0, v = v0;
    for (let i = 0; i < n; i++) {
      const k1x = v, k1v = f(t, x, v);
      const k2x = v + (h / 2) * k1v, k2v = f(t + h / 2, x + (h / 2) * k1x, v + (h / 2) * k1v);
      const k3x = v + (h / 2) * k2v, k3v = f(t + h / 2, x + (h / 2) * k2x, v + (h / 2) * k2v);
      const k4x = v + h * k3v, k4v = f(t + h, x + h * k3x, v + h * k3v);
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x); v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v); t += h;
      if (!isFinite(x) || !isFinite(v)) break;
      const s = { t, x, v, a: f(t, x, v) };
      out.push(s);
      if (stop && stop(s, out[out.length - 2])) break;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Vectors and angles                                                 */
  /* ------------------------------------------------------------------ */
  const D2R = Math.PI / 180;
  const vlen = (v) => Math.hypot(v[0], v[1]);
  /** Direction of a vector in degrees counterclockwise from +x, in (−180, 180]. */
  const vang = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const polar = (m, deg) => [m * Math.cos(deg * D2R), m * Math.sin(deg * D2R)];
  /** "12.5 m/s at 30.0° (from +x, counterclockwise)" or "12.5 m/s →" style text. */
  function vecTxt(v, u, kind) {
    const m = vlen(v);
    if (m < 1e-12) return `0 ${u[kind]}`;
    return `${fmt(m)} ${u[kind]} at ${fmt(vang(v))}°`;
  }
  /** Signed component text "+3.5" with an arrow for its direction along x or y. */
  const arrowX = (v) => (v >= 0 ? '→' : '←'), arrowY = (v) => (v >= 0 ? '↑' : '↓');
  /** ω and α are entered in rad/s or rev/min. */
  const RPM = (2 * Math.PI) / 60;

  /** Result object in the shared contract. */
  const result = (text, cls, out, S, geo, warn) => ({ ok: true, err: [], warn: warn || [], status: { cls: cls || 'ok', text }, out, steps: S.list, geo });

  const DY = { units, factor, convertObj, convertList, toBase, fromBase, show, massTxt, peval, pder, pint, ptrim, quad, rootsOf, rk4, D2R, vlen, vang, polar, vecTxt, arrowX, arrowY, RPM, result };
  root.DY = DY;
  if (typeof module !== 'undefined' && module.exports) module.exports = DY;
})(typeof window !== 'undefined' ? window : globalThis);
