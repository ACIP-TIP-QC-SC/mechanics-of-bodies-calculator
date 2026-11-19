/* =====================================================================
 * STATICS · Centroids and moments of inertia by integration (physics only; browser and Node)
 * Hibbeler, Engineering Mechanics: Statics, Sections 9.1, 9.5 and 10.1 to 10.2.
 * The region is bounded by two curves typed as formulas, between two limits:
 *   var 'x': vertical strips, top y = f(x) and bottom y = g(x) for a ≤ x ≤ b
 *   var 'y': horizontal strips, right x = f(y) and left x = g(y) for a ≤ y ≤ b
 * kind
 *   area    A, x̄, ȳ, and the moments and product of inertia about the x, y axes and the centroidal axes
 *   line    a rod along the curve f (the first formula): length, x̄, ȳ, and its weight from w per unit length
 *   volume  the region revolved about the x or y axis: volume, mass with a density ρ(x, y) that may vary,
 *           and the centroid on the axis (each element dA sweeps a ring of volume 2π r dA, Pappus)
 *   fluid   a plate under a liquid: the plate's own x, y coordinates, its line y = 0 at depth d₀ and its plane
 *           at θ to the free surface; p = p₀ + γ h with h = d₀ − y sin θ; the resultant F = ∫ p dA and the
 *           centre of pressure (x_P, y_P) (Section 9.5)
 * Every integral is evaluated numerically by Gauss–Legendre quadrature over the strip and across it.
 * Lengths are in the chosen length unit `lu`.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps } = Core;
  const PI = Math.PI, DEG = PI / 180;
  const VW = () => root.VWork || require('./vwork.js');

  function defaults() {
    return { kind: 'area', var: 'x', f: 'sqrt(x)', g: '0', a: 0, b: 1, axis: 'x', rho: '1', w: 0, d0: 2, theta: 90, gam: 9810, p0: 0 };
  }
  // 5-point Gauss–Legendre on [−1, 1]
  const GX = [0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664];
  const GW = [0.5688888888888889, 0.4786286704993665, 0.4786286704993665, 0.2369268850561891, 0.2369268850561891];
  /** ∫ₐᵇ h(t) dt on n panels. */
  function gauss(h, a, b, n) {
    let s = 0; const d = (b - a) / n;
    for (let i = 0; i < n; i++) { const m = a + (i + 0.5) * d; for (let k = 0; k < 5; k++) s += GW[k] * h(m + (GX[k] * d) / 2); }
    return (s * d) / 2;
  }
  /**
   * Integrals over the region of φ(x, y) for a list of weights φ: the outer variable t runs a..b, the inner one
   * from g(t) to f(t). Returns the integrals in the same order.
   */
  function region(f, g, a, b, byX, phis, nOut, nIn) {
    const sums = phis.map(() => 0), d = (b - a) / nOut;
    for (let i = 0; i < nOut; i++) {
      const m = a + (i + 0.5) * d;
      for (let k = 0; k < 5; k++) {
        const t = m + (GX[k] * d) / 2, wt = (GW[k] * d) / 2, hi = f(t), lo = g(t), dd = (hi - lo) / nIn;
        for (let j = 0; j < nIn; j++) {
          const mm = lo + (j + 0.5) * dd;
          for (let q = 0; q < 5; q++) {
            const s = mm + (GX[q] * dd) / 2, w = (wt * GW[q] * dd) / 2, x = byX ? t : s, y = byX ? s : t;
            phis.forEach((ph, n) => (sums[n] += w * ph(x, y)));
          }
        }
      }
    }
    return sums;
  }
  /** Rewrites a formula for a change of length unit: lengths x, y become x/k, y/k and the result is scaled by s. */
  function rescale(src, k, s) {
    const body = String(src).replace(/(^|[^A-Za-z_0-9])(x|y)(?![A-Za-z_0-9])/g, (m, p, v) => `${p}(${v}/${Core.tidy(k, 12)})`);
    return s === 1 ? body : `${Core.tidy(s, 12)}*(${body})`;
  }

  function solve(q, c) {
    const err = [], byX = q.var !== 'y', v = byX ? 'x' : 'y', u = byX ? 'y' : 'x', Lu = c.Lu;
    const C = (src, where, names) => { try { const fn = VW().compile(src, new Set(names)); return fn; } catch (e) { err.push(`${where}: ${e.message}.`); return null; } };
    const f0 = C(q.f, byX ? 'Top curve y = f(x)' : 'Right curve x = f(y)', [v]);
    const g0 = q.kind === 'line' ? null : C(q.g === '' || q.g == null ? '0' : q.g, byX ? 'Bottom curve y = g(x)' : 'Left curve x = g(y)', [v]);
    const rho0 = q.kind === 'volume' ? C(q.rho === '' || q.rho == null ? '1' : q.rho, 'Density ρ(x, y)', ['x', 'y']) : null;
    const a = +q.a, b = +q.b;
    if (!(b > a)) err.push(`Enter limits with ${v} = a below ${v} = b.`);
    if (err.length) return fail(err);
    // a curve that reaches zero under a root exactly at a limit (a quarter circle) may round to a tiny negative there:
    // such a point is evaluated a hair inside the limits
    const nudge = (fn) => (t) => { let y = fn({ [v]: t }); if (!Number.isFinite(y)) y = fn({ [v]: t + (t <= (a + b) / 2 ? 1 : -1) * 1e-9 * (b - a) }); return y; };
    const f = nudge(f0), g = g0 ? nudge(g0) : () => 0, rho = rho0 ? (x, y) => rho0({ x, y }) : null;
    const samp = []; for (let i = 0; i <= 200; i++) { const t = a + ((b - a) * i) / 200; samp.push([t, f(t), g(t)]); }
    if (samp.some((p) => !Number.isFinite(p[1]) || !Number.isFinite(p[2]))) return fail(`A curve is not defined everywhere between ${v} = ${fmt(a)} and ${fmt(b)} (for example a square root of a negative number). Check the formulas and limits.`);
    if (q.kind !== 'line' && samp.some((p) => p[1] < p[2] - 1e-9 * Math.max(1, Math.abs(p[1]), Math.abs(p[2])))) return fail(`The curves cross between the limits: f must stay ${byX ? 'above' : 'to the right of'} g. Split the region at the crossing, or swap the formulas.`);
    const xy = (t, s) => (byX ? [t, s] : [s, t]);
    const geo = { kind: 'integ', c, byX, v, a, b, samp, sub: q.kind };
    const S = Steps(), out = [];
    const strip = byX ? `vertical strip of width dx and height f(x) − g(x)` : `horizontal strip of height dy and length f(y) − g(y)`;

    if (q.kind === 'line') {
      // the rod follows the first curve; arc length ds = √(1 + (du/dv)²) dv
      const h = (b - a) * 1e-6, dfd = (t) => (f(Math.min(b, t + h)) - f(Math.max(a, t - h))) / (Math.min(b, t + h) - Math.max(a, t - h));
      const ds = (t) => Math.sqrt(1 + dfd(t) ** 2), n = 400;
      const L = gauss(ds, a, b, n), Mv = gauss((t) => t * ds(t), a, b, n), Mu = gauss((t) => f(t) * ds(t), a, b, n);
      const cv = Mv / L, cu = Mu / L, [xc, yc] = byX ? [cv, cu] : [cu, cv];
      S.add({ t: 'Differential element', n: `A short length ds of the rod at (${byX ? 'x, f(x)' : 'f(y), y'}): ds = √(1 + (d${u}/d${v})²) d${v}. Its centroid is at the element itself.`, f: `L = ∫ ds,  x̄ = ∫ x̃ ds / L,  ȳ = ∫ ỹ ds / L` });
      S.add({ t: 'Integrals', n: 'Evaluated numerically (Gauss–Legendre quadrature).', table: { head: ['Integral', 'Value'], rows: [['L = ∫ ds', `${fmt(L)} ${Lu}`], [`∫ ${v} ds`, `${fmt(Mv)} ${Lu}²`], [`∫ ${u} ds`, `${fmt(Mu)} ${Lu}²`]] } });
      S.add({ t: 'Centroid of the rod', s: `x̄ = ${fmt(byX ? Mv : Mu)} / ${fmt(L)},  ȳ = ${fmt(byX ? Mu : Mv)} / ${fmt(L)}`, r: `x̄ = ${fmt(xc)} ${Lu},  ȳ = ${fmt(yc)} ${Lu}` });
      out.push({ k: 'Length L', v: L, u: Lu }, { k: 'x̄', v: xc, u: Lu, hl: true }, { k: 'ȳ', v: yc, u: Lu, hl: true });
      if (+q.w > 0) { S.add({ t: 'Weight of the rod', f: 'W = w L', s: `W = ${fmt(+q.w)}(${fmt(L)})`, r: `W = ${fmt(+q.w * L)} (force unit of w × ${Lu})` }); out.push({ k: 'Weight W = w L', v: +q.w * L, u: '' }); }
      return res(`Rod: x̄ = ${fmt(xc)}, ȳ = ${fmt(yc)} ${Lu}`, out, S, Object.assign(geo, { xc, yc, L }));
    }

    const NO = 120, NI = 4;
    if (q.kind === 'area') {
      const [A, Qy, Qx, Ix, Iy, Ixy] = region(f, g, a, b, byX, [() => 1, (x) => x, (x, y) => y, (x, y) => y * y, (x) => x * x, (x, y) => x * y], NO, NI);
      if (!(A > 0)) return fail('The region has no area: check the curves and limits.');
      const xc = Qy / A, yc = Qx / A, Icx = Ix - A * yc * yc, Icy = Iy - A * xc * xc, Icxy = Ixy - A * xc * yc;
      S.add({ t: 'Differential element', n: `A ${strip}. Its area is dA = (f − g) d${v} and its centroid is at ${byX ? 'x̃ = x, ỹ = (f + g)/2' : 'x̃ = (f + g)/2, ỹ = y'}.`, f: 'A = ∫ dA,  x̄ = ∫ x̃ dA / A,  ȳ = ∫ ỹ dA / A' });
      S.add({ t: 'Integrals', n: 'Evaluated numerically (Gauss–Legendre quadrature along the strip and across it).', table: { head: ['Integral', 'Value'], rows: [['A = ∫ dA', `${fmt(A)} ${Lu}²`], ['∫ x̃ dA', `${fmt(Qy)} ${Lu}³`], ['∫ ỹ dA', `${fmt(Qx)} ${Lu}³`]] } });
      S.add({ t: 'Centroid', s: `x̄ = ${fmt(Qy)} / ${fmt(A)},  ȳ = ${fmt(Qx)} / ${fmt(A)}`, r: `x̄ = ${fmt(xc)} ${Lu},  ȳ = ${fmt(yc)} ${Lu}` });
      S.add({ t: 'Moments of inertia about the x and y axes', f: 'I_x = ∫ y² dA,  I_y = ∫ x² dA,  I_xy = ∫ x y dA,  J_O = I_x + I_y', r: `I_x = ${fmt(Ix)}, I_y = ${fmt(Iy)}, I_xy = ${fmt(Ixy)}, J_O = ${fmt(Ix + Iy)} ${Lu}⁴` });
      S.add({ t: 'About the centroidal axes (parallel-axis theorem)', f: 'Ī_x = I_x − A ȳ²,  Ī_y = I_y − A x̄²,  Ī_xy = I_xy − A x̄ ȳ', r: `Ī_x = ${fmt(Icx)}, Ī_y = ${fmt(Icy)}, Ī_xy = ${fmt(Icxy)} ${Lu}⁴` });
      out.push({ k: 'Area A', v: A, u: `${Lu}²` }, { k: 'x̄', v: xc, u: Lu, hl: true }, { k: 'ȳ', v: yc, u: Lu, hl: true },
        { k: 'I_x', v: Ix, u: `${Lu}⁴`, hl: true }, { k: 'I_y', v: Iy, u: `${Lu}⁴`, hl: true }, { k: 'I_xy', v: Ixy, u: `${Lu}⁴` }, { k: 'J_O', v: Ix + Iy, u: `${Lu}⁴` },
        { k: 'Ī_x (centroidal)', v: Icx, u: `${Lu}⁴` }, { k: 'Ī_y (centroidal)', v: Icy, u: `${Lu}⁴` }, { k: 'k_x = √(I_x/A)', v: Math.sqrt(Math.max(0, Ix / A)), u: Lu }, { k: 'k_y = √(I_y/A)', v: Math.sqrt(Math.max(0, Iy / A)), u: Lu });
      return res(`A = ${fmt(A)} ${Lu}², x̄ = ${fmt(xc)}, ȳ = ${fmt(yc)} ${Lu}`, out, S, Object.assign(geo, { xc, yc, A }));
    }

    if (q.kind === 'volume') {
      const ax = q.axis === 'y' ? 'y' : 'x', bar = ax === 'x' ? 'x̄' : 'ȳ', rOf = (x, y) => Math.abs(ax === 'x' ? y : x), alOf = (x, y) => (ax === 'x' ? x : y);
      // the region must stay on one side of the axis, or part of the solid would be counted twice
      const crosses = ax === v ? samp.some((p) => p[2] < -1e-12 && p[1] > 1e-12) : a < -1e-12 && b > 1e-12;
      if (crosses) return fail(`The region crosses the ${ax} axis, so revolving it would count part of the solid twice. Keep the region on one side of the axis.`);
      const [Vv, Mal, m, Mm] = region(f, g, a, b, byX, [(x, y) => 2 * PI * rOf(x, y), (x, y) => 2 * PI * rOf(x, y) * alOf(x, y), (x, y) => 2 * PI * rOf(x, y) * rho(x, y), (x, y) => 2 * PI * rOf(x, y) * rho(x, y) * alOf(x, y)], NO, NI);
      if (!(Vv > 0)) return fail('The solid has no volume: check the curves, limits and axis.');
      const varying = !/^\s*[0-9.]+\s*$/.test(String(q.rho || '1'));
      const cV = Mal / Vv, cM = Mm / m;
      S.add({ t: 'Differential element', n: `Each element dA of the region, at distance r from the ${ax} axis, sweeps a thin ring of volume dV = 2π r dA as the region turns about the axis (this gives the disk, washer and shell methods at once). The centroid of the ring lies on the axis at the element's ${ax} coordinate.`, f: `V = ∫ 2π r dA,  ${bar} = ∫ ${ax} dV / V${varying ? ',  m = ∫ ρ dV,  centre of mass ∫ ρ ' + ax + ' dV / m' : ''}` });
      S.add({ t: 'Integrals', n: 'Evaluated numerically (Gauss–Legendre quadrature).', table: { head: ['Integral', 'Value'], rows: [['V = ∫ dV', `${fmt(Vv)} ${Lu}³`], [`∫ ${ax} dV`, `${fmt(Mal)} ${Lu}⁴`]].concat(varying ? [['m = ∫ ρ dV', fmt(m)], [`∫ ρ ${ax} dV`, fmt(Mm)]] : []) } });
      S.add({ t: varying ? 'Centroid of the volume and centre of mass' : 'Centroid of the volume', s: `${bar} = ${fmt(Mal)} / ${fmt(Vv)}${varying ? `;  ${ax}_G = ${fmt(Mm)} / ${fmt(m)}` : ''}`, r: `${bar} = ${fmt(cV)} ${Lu}${varying ? `,  centre of mass at ${ax} = ${fmt(cM)} ${Lu}` : ''}` });
      out.push({ k: 'Volume V', v: Vv, u: `${Lu}³` }, { k: `Centroid of the volume ${bar}`, v: cV, u: Lu, hl: !varying });
      if (varying) out.push({ k: 'Mass m = ∫ ρ dV', v: m, u: '' }, { k: `Centre of mass ${ax}_G`, v: cM, u: Lu, hl: true });
      return res(varying ? `Centre of mass at ${ax} = ${fmt(cM)} ${Lu}` : `V = ${fmt(Vv)} ${Lu}³, ${bar} = ${fmt(cV)} ${Lu}`, out, S, Object.assign(geo, { axis: ax, cV, cM: varying ? cM : null, V: Vv }));
    }

    // fluid pressure on a plate
    const d0 = +q.d0, th = (+q.theta || 0) * DEG, gam = +q.gam, p0 = +q.p0 || 0;
    if (!(gam > 0)) return fail('Enter the specific weight γ of the liquid.');
    if (!(th > 0) || th > PI / 2 + 1e-12) return fail('The angle of the plate to the free surface must be between 0° and 90°.');
    const k = Core.convert(1, Lu, c.U.id === 'US' ? 'ft' : 'm'), hOf = (x, y) => d0 - y * Math.sin(th), p = (x, y) => p0 + gam * Math.max(0, hOf(x, y)) * k;
    const [A, Fp, Mx, My, Fx0] = region(f, g, a, b, byX, [() => 1, (x, y) => p(x, y), (x, y) => p(x, y) * x, (x, y) => p(x, y) * y, (x, y) => (hOf(x, y) < -1e-12 ? 1 : 0)], NO, NI);
    if (!(A > 0) || !(Fp > 0)) return fail('The plate has no area under the liquid: check the depth d₀ and the curves.');
    const k2 = k * k, F = Fp * k2, xP = Mx / Fp, yP = My / Fp, Fu = c.U.id === 'US' ? 'lb' : 'N';
    const warn = Fx0 > 1e-9 * A ? ['Part of the plate is above the free surface; the pressure there is taken as zero.'] : [];
    S.add({ t: 'Pressure on the plate', n: `The plate's y axis runs up the plate at ${fmt(+q.theta)}° to the free surface; the line y = 0 is ${fmt(d0)} ${Lu} deep. A point at y is at depth h = d₀ − y sin θ, where the pressure is p = ${p0 ? 'p₀ + ' : ''}γ h.`, f: `h = ${fmt(d0)} − y sin ${fmt(+q.theta)}°,  p = ${p0 ? `${fmt(p0)} + ` : ''}${fmt(gam)} h` });
    S.add({ t: 'Resultant force', n: `On a ${strip} the force is dF = p dA.`, f: 'F_R = ∫ p dA', s: `A = ${fmt(A)} ${Lu}²`, r: `F_R = ${fmt(F)} ${Fu}` });
    S.add({ t: 'Centre of pressure', n: 'The resultant acts where its moment equals the moment of the pressure.', f: 'x_P = ∫ x p dA / F_R,  y_P = ∫ y p dA / F_R', r: `x_P = ${fmt(xP)} ${Lu},  y_P = ${fmt(yP)} ${Lu} (depth ${fmt(hOf(xP, yP))} ${Lu})` });
    const [Qx] = region(f, g, a, b, byX, [(x, y) => y], NO, NI), yc = Qx / A;
    S.add({ t: 'Check with the centroid', n: 'With p₀ = 0 and the whole plate submerged, F_R = γ h̄ A, where h̄ is the depth of the centroid of the plate.', s: `ȳ = ${fmt(yc)} ${Lu}, h̄ = ${fmt(hOf(0, yc))} ${Lu};  γ h̄ A = ${fmt(gam * hOf(0, yc) * A * k * k2)} ${Fu}` });
    out.push({ k: 'Resultant force F_R', v: F, u: Fu, hl: true }, { k: 'x_P (centre of pressure)', v: xP, u: Lu, hl: true }, { k: 'y_P (centre of pressure)', v: yP, u: Lu, hl: true }, { k: 'Depth of the centre of pressure', v: hOf(xP, yP), u: Lu }, { k: 'Area of the plate', v: A, u: `${Lu}²` });
    return Object.assign(res(`F_R = ${fmt(F)} ${Fu} at y_P = ${fmt(yP)} ${Lu}`, out, S, Object.assign(geo, { xP, yP, F, Fu, d0, th: +q.theta, surfY: Math.sin(th) > 0 ? d0 / Math.sin(th) : null })), { warn });
  }
  const res = (text, out, S, geo) => ({ ok: true, err: [], warn: [], status: { cls: 'ok', text }, out, steps: S.list, geo });

  /** Units: lengths in the formulas and limits scale by k; ρ by the density factor; γ and p₀ to the other system. */
  function convertState(q, k, from, to) {
    const t = (v) => Core.tidy(v * k, 12);
    q.f = rescale(q.f, k, k); if (q.g !== undefined && String(q.g).trim() !== '') q.g = rescale(q.g, k, k);
    q.rho = rescale(q.rho || '1', k, 1);
    q.a = t(+q.a); q.b = t(+q.b); q.d0 = t(+q.d0);
    if (from !== to) {
      const gf = Core.convert(1, from === 'SI' ? 'N' : 'lb', to === 'SI' ? 'N' : 'lb') / Core.convert(1, from === 'SI' ? 'm' : 'ft', to === 'SI' ? 'm' : 'ft') ** 3;
      q.gam = Core.tidy(+q.gam * gf, 10);
      q.p0 = Core.tidy((+q.p0 || 0) * Core.convert(1, from === 'SI' ? 'N' : 'lb', to === 'SI' ? 'N' : 'lb') / Core.convert(1, from === 'SI' ? 'm' : 'ft', to === 'SI' ? 'm' : 'ft') ** 2, 10);
    }
    return q;
  }

  const Integ = { defaults, solve, convertState, rescale };
  root.Integ = Integ;
  if (typeof module !== 'undefined' && module.exports) module.exports = Integ;
})(typeof window !== 'undefined' ? window : globalThis);
