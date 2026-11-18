/* =====================================================================
 * DYNAMICS · D2 Curvilinear Motion and Projectiles (physics only)
 * Hibbeler, Dynamics 15e, Sections 12.4 to 12.8 and 12.10.
 *   Projectile: x = x₀ + (v₀)ₓt, y = y₀ + (v₀)ᵧt − ½gt², vᵧ = (v₀)ᵧ − gt        (12.6)
 *   Normal and tangential: a_t = v̇, a_n = v²/ρ, ρ = [1 + (dy/dx)²]^(3/2)/|d²y/dx²|  (12.7)
 *   Cylindrical: v_r = ṙ, v_θ = rθ̇, a_r = r̈ − rθ̇², a_θ = rθ̈ + 2ṙθ̇            (12.8)
 *   Relative motion: v_B = v_A + v_B/A, a_B = a_A + a_B/A                       (12.10)
 * Modes: proj, path, cyl, rel.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps, polyStr } = Core;
  const { peval, pder, quad, D2R, vlen, vang, polar } = DY;

  function defaults() {
    return {
      mode: 'proj',
      // projectile: launched from (0, h0) above the ground
      find: 'fwd', v0: 20, th: 40, h0: 0, land: 'level', yT: 0, d: 20, beta: 15, by: 'point', T: 2,
      wall: false, dw: 15, hw: 6,
      // path
      ptype: 'poly', c: [0, 0, 0.05, 0], x: 10, rho: 50, v: 6, at: 2,
      // cylindrical
      cr: [0, 0, 0.1, 0], cth: [0, 0, 0, 1], t: 1,
      // relative motion
      A: { x: 0, y: 0, v: 18, dir: 240, at: -2, rho: 0, turn: 'left' }, B: { x: 10, y: -10, v: 12, dir: 270, at: 3, rho: 100, turn: 'right' },
    };
  }
  function convertState(st, from, to) {
    if (from === to) return st;
    const fL = DY.factor('L', from, to), t = (v, f) => Core.tidy(v * f, 6);
    DY.convertObj(st, { v0: 'V', h0: 'L', yT: 'L', d: 'L', dw: 'L', hw: 'L', x: 'L', rho: 'L', v: 'V', at: 'A' }, from, to);
    st.c = st.c.map((v, i) => t(v, Math.pow(fL, 1 - i)));
    st.cr = st.cr.map((v) => t(v, fL));
    ['A', 'B'].forEach((k) => DY.convertObj(st[k], { x: 'L', y: 'L', v: 'V', at: 'A', rho: 'L' }, from, to));
    return st;
  }
  function solve(st, U) {
    const u = DY.units(U);
    if (st.mode === 'path') return path(st, u);
    if (st.mode === 'cyl') return cyl(st, u);
    if (st.mode === 'rel') return rel(st, u);
    return proj(st, u);
  }
  const R = DY.result;

  /* Projectile ------------------------------------------------------------ */
  function proj(st, u) {
    const g = u.g, h0 = +st.h0, S = Steps(), out = [], warn = [];
    if (!isFinite(h0)) return fail('Enter the launch height.');
    let v0 = +st.v0, th = +st.th;
    // when the speed or the angle is found from a target point, the projectile lands on that point
    const land = st.find === 'theta' || (st.find === 'v0' && st.by !== 'time') ? 'x' : st.land, yT = +st.yT, d = +st.d, beta = +st.beta;
    S.add({ t: 'Coordinate system', n: `The origin is on the ground below the launch point, x to the right and y up. Only gravity acts: a_x = 0, a_y = −g = −${fmt(g)} ${u.A}.` });
    if (st.find === 'v0') {
      if (!(Math.abs(th) < 90)) return fail('The launch angle must be between −90° and 90°.');
      const c = Math.cos(th * D2R), s = Math.sin(th * D2R);
      if (st.by === 'time') {
        const T = +st.T;
        if (!(T > 0) || !isFinite(yT)) return fail('Enter the flight time and the landing height.');
        v0 = (yT - h0 + 0.5 * g * T * T) / (s * T);
        S.add({ t: 'Launch speed from the flight time', n: 'Vertical motion from the launch to the landing level.', f: '(+↑) y = y₀ + (v₀ sin θ)t − ½gt²', s: `${fmt(yT)} = ${fmt(h0)} + v₀ sin ${fmt(th)}° (${fmt(T)}) − ½(${fmt(g)})(${fmt(T)})²`, r: `v₀ = ${fmt(v0)} ${u.V}` });
      } else {
        if (!(d > 0) || !isFinite(yT)) return fail('Enter the horizontal distance and the height of the landing point.');
        const den = 2 * c * c * (d * Math.tan(th * D2R) - (yT - h0));
        if (!(den > 0)) return fail('At this angle the projectile cannot reach that point.');
        v0 = Math.sqrt((g * d * d) / den);
        S.add({ t: 'Launch speed to reach the point', n: 'Eliminate the time between the horizontal and vertical motions.', f: '(→) d = (v₀ cos θ)t;  (+↑) y_T − y₀ = d tan θ − gd²/(2v₀² cos²θ)', s: `${fmt(yT - h0)} = ${fmt(d)} tan ${fmt(th)}° − ${fmt(g)}(${fmt(d)})²/(2v₀² cos²${fmt(th)}°)`, r: `v₀ = ${fmt(v0)} ${u.V}` });
      }
      if (!(v0 > 0) || !isFinite(v0)) return fail('No positive launch speed reaches that landing point at this angle.');
    } else if (st.find === 'theta') {
      if (!(v0 > 0) || !(d > 0) || !isFinite(yT)) return fail('Enter the launch speed and the target point.');
      const k = (g * d * d) / (2 * v0 * v0), dy = yT - h0, roots = quad(k, -d, dy + k);
      S.add({ t: 'Launch angle to hit the point', n: 'With 1/cos²θ = 1 + tan²θ the trajectory equation becomes a quadratic in tan θ.', f: 'y_T − y₀ = d tan θ − (gd²/2v₀²)(1 + tan²θ)', s: `${fmt(k)} tan²θ − ${fmt(d)} tan θ + ${fmt(dy + k)} = 0`,
        r: roots.length ? `θ = ${roots.map((r) => fmt(Math.atan(r) / D2R)).join('° or ')}°` : 'No real root: the speed is too small to reach the point.' });
      if (!roots.length) return fail(`The launch speed ${fmt(v0)} ${u.V} is too small to reach that point.`);
      const ang = roots.map((r) => Math.atan(r) / D2R);
      out.push({ k: 'Low launch angle θ₁', v: ang[0], u: '°', hl: true });
      if (ang.length > 1 && Math.abs(ang[1] - ang[0]) > 1e-9) out.push({ k: 'High launch angle θ₂', v: ang[1], u: '°', hl: true });
      th = st.pick === 'high' && ang.length > 1 ? ang[1] : ang[0];
      S.add({ t: 'Trajectory drawn', r: `The ${st.pick === 'high' && ang.length > 1 ? 'high' : 'low'} angle θ = ${fmt(th)}° is used below.` });
    } else if (!(v0 >= 0) || !isFinite(th)) return fail('Enter the launch speed and angle.');
    const c = Math.cos(th * D2R), s = Math.sin(th * D2R), vx = v0 * c, vy = v0 * s;
    S.add({ t: 'Components of the launch velocity', f: '(v₀)ₓ = v₀ cos θ, (v₀)ᵧ = v₀ sin θ', s: `(v₀)ₓ = ${fmt(v0)} cos ${fmt(th)}°, (v₀)ᵧ = ${fmt(v0)} sin ${fmt(th)}°`, r: `(v₀)ₓ = ${fmt(vx)} ${u.V}, (v₀)ᵧ = ${fmt(vy)} ${u.V}` });
    const X = (t) => vx * t, Y = (t) => h0 + vy * t - 0.5 * g * t * t;
    // where it lands
    let T, surf;
    if (land === 'slope') {
      if (!(Math.abs(beta) < 89)) return fail('The slope angle must be between −89° and 89°.');
      const tb = Math.tan(beta * D2R), r = quad(0.5 * g, -(vy - vx * tb), -h0).filter((x) => x > 1e-12);
      if (!r.length) return fail('The projectile never reaches the slope.');
      T = r[r.length - 1]; surf = { kind: 'slope', tb };
      S.add({ t: 'Landing on the slope', n: `The ground rises from the origin at β = ${fmt(beta)}°, so it lands where y = x tan β.`, f: 'y₀ + (v₀)ᵧt − ½gt² = (v₀)ₓt tan β', s: `${fmt(h0)} + ${fmt(vy)}t − ${fmt(0.5 * g)}t² = ${fmt(vx * tb)}t`, r: `t = ${fmt(T)} s` });
    } else if (land === 'x') {
      if (!(d > 0)) return fail('Enter the horizontal distance to the landing point.');
      if (!(vx > 0)) return fail('The projectile does not move toward the landing point.');
      T = d / vx; surf = { kind: 'x' };
      S.add({ t: 'Horizontal motion to the landing point', f: '(→) x = x₀ + (v₀)ₓt', s: `${fmt(d)} = 0 + ${fmt(vx)}t`, r: `t = ${fmt(T)} s` });
      if (land === 'x' && st.find === 'fwd') S.add({ t: 'Height where it lands', f: '(+↑) y = y₀ + (v₀)ᵧt − ½gt²', s: `y = ${fmt(h0)} + (${fmt(vy)})(${fmt(T)}) − ½(${fmt(g)})(${fmt(T)})²`, r: `y = ${fmt(Y(T))} ${u.L} above the ground (${fmt(Y(T) - h0)} ${u.L} from the launch height)` });
    } else {
      const lev = isFinite(yT) ? yT : 0, r = quad(0.5 * g, -vy, lev - h0).filter((x) => x > 1e-12);
      if (!r.length) return fail(`The projectile never comes down to the height ${fmt(lev)} ${u.L}.`);
      T = r[r.length - 1]; surf = { kind: 'level', y: lev };
      if (st.find !== 'v0' || st.by !== 'time') S.add({ t: 'Time of flight', n: `It lands on the level ${fmt(lev)} ${u.L} above the ground.`, f: '(+↑) y = y₀ + (v₀)ᵧt − ½gt²', s: `${fmt(lev)} = ${fmt(h0)} + ${fmt(vy)}t − ${fmt(0.5 * g)}t²`, r: `t = ${fmt(T)} s` });
    }
    const xL = X(T), yL = Y(T), vyL = vy - g * T, vL = Math.hypot(vx, vyL);
    if (land !== 'x') S.add({ t: 'Range', f: '(→) x = (v₀)ₓt', s: `x = (${fmt(vx)})(${fmt(T)})`, r: `R = ${fmt(xL)} ${u.L}` });
    S.add({ t: 'Velocity where it lands', f: 'vₓ = (v₀)ₓ;  (+↑) vᵧ = (v₀)ᵧ − gt', s: `vᵧ = ${fmt(vy)} − (${fmt(g)})(${fmt(T)}) = ${fmt(vyL)} ${u.V}`, r: `v = ${fmt(vL)} ${u.V} at ${fmt(Math.atan2(vyL, vx) / D2R)}° (${vyL < 0 ? 'below' : 'above'} the horizontal)` });
    const tTop = vy > 0 ? vy / g : 0, yTop = Y(tTop);
    if (vy > 0) S.add({ t: 'Highest point', f: '(+↑) vᵧ² = (v₀)ᵧ² − 2g(y − y₀), with vᵧ = 0', s: `0 = (${fmt(vy)})² − 2(${fmt(g)})(y − ${fmt(h0)})`, r: `y_max = ${fmt(yTop)} ${u.L} at x = ${fmt(X(tTop))} ${u.L}, t = ${fmt(tTop)} s` });
    if (st.find === 'v0') out.push({ k: 'Launch speed v₀', v: v0, u: u.V, hl: true });
    out.push({ k: 'Time of flight t', v: T, u: 's', hl: true }, { k: 'Range R (horizontal distance)', v: xL, u: u.L, hl: true }, { k: 'Landing height above the ground', v: yL, u: u.L });
    if (land === 'x') out.push({ k: 'Landing height h', v: yL, u: u.L, hl: true });
    out.push({ k: 'Maximum height above the ground', v: Math.max(h0, yTop), u: u.L }, { k: 'Maximum height above the landing point', v: Math.max(h0, yTop) - yL, u: u.L });
    out.push({ k: 'Speed at landing', v: vL, u: u.V }, { k: 'Landing angle below horizontal', v: -Math.atan2(vyL, vx) / D2R, u: '°' });
    let wall = null;
    if (st.wall) {
      const dw = +st.dw, hw = +st.hw;
      if (!(dw > 0) || !(hw > 0)) return fail('Enter the distance to the wall and its height.');
      if (dw > xL) warn.push('The wall is beyond the landing point, so it plays no part.');
      const tw = vx > 0 ? dw / vx : NaN, yw = Y(tw), clr = yw - hw;
      S.add({ t: 'Does it clear the wall?', f: 't = d_w/(v₀)ₓ;  y = y₀ + (v₀)ᵧt − ½gt²', s: `t = ${fmt(dw)}/${fmt(vx)} = ${fmt(tw)} s;  y = ${fmt(yw)} ${u.L}`, r: clr >= 0 ? `Yes, by ${fmt(clr)} ${u.L}` : `No, it strikes the wall ${fmt(-clr)} ${u.L} below the top` });
      out.push({ k: 'Height over the wall', v: yw, u: u.L }, { k: 'Clearance over the wall', v: clr, u: u.L, hl: true });
      wall = { dw, hw, yw, clr };
      if (clr < 0 && dw <= xL) warn.push('The projectile hits the wall.');
    }
    const status = `t = ${fmt(T)} s, R = ${fmt(xL)} ${u.L}${st.find === 'v0' ? `, v₀ = ${fmt(v0)} ${u.V}` : ''}${st.find === 'theta' ? `, θ = ${fmt(th)}°` : ''}`;
    return R(status, wall && wall.clr < 0 ? 'warn' : 'ok', out, S, { mode: 'proj', u, g, v0, th, h0, vx, vy, X, Y, T, xL, yL, tTop, yTop, surf, wall, span: [0, T], t: T, beta }, warn);
  }

  /* Path y = f(x) or a circle: normal and tangential components ------------ */
  function path(st, u) {
    const v = +st.v, at = +st.at, S = Steps(), out = [];
    if (!isFinite(v) || !isFinite(at)) return fail('Enter the speed and the rate of change of speed.');
    let rho, y1 = 0, y2 = 0, x = +st.x, c, geo;
    if (st.ptype === 'circle') {
      rho = +st.rho; if (!(rho > 0)) return fail('Enter the radius of the circular path.');
      S.add({ t: 'Radius of curvature', n: 'On a circle the radius of curvature is the radius.', r: `ρ = ${fmt(rho)} ${u.L}` });
      geo = { kind: 'circle', rho };
    } else {
      c = st.c.map(Number); if (!c.every(isFinite) || !isFinite(x)) return fail('Enter the coefficients of y(x) and the position x.');
      const d1 = pder(c), d2 = pder(d1); y1 = peval(d1, x); y2 = d2.length ? peval(d2, x) : 0;
      S.add({ t: 'Path', r: `y = ${polyStr(c, 'x')} (${u.L})` });
      S.add({ t: 'Slope and curvature of the path', f: 'dy/dx;  d²y/dx²', s: `dy/dx = ${polyStr(d1, 'x')} = ${fmt(y1)};  d²y/dx² = ${polyStr(d2, 'x')} = ${fmt(y2)}` });
      if (Math.abs(y2) < 1e-12) { rho = Infinity; S.add({ t: 'Radius of curvature', n: 'd²y/dx² = 0 here, so the path is straight at this point (ρ → ∞) and a_n = 0.' }); }
      else { rho = Math.pow(1 + y1 * y1, 1.5) / Math.abs(y2); S.add({ t: 'Radius of curvature', f: 'ρ = [1 + (dy/dx)²]^(3/2) / |d²y/dx²|', s: `ρ = [1 + (${fmt(y1)})²]^(3/2) / |${fmt(y2)}|`, r: `ρ = ${fmt(rho)} ${u.L}` }); }
      geo = { kind: 'poly', c, x, y: peval(c, x), y1, y2 };
      out.push({ k: 'Slope dy/dx', v: y1, u: '' }, { k: 'Tangent direction θ (from +x)', v: Math.atan(y1) / D2R, u: '°' });
    }
    const an = isFinite(rho) ? (v * v) / rho : 0, a = Math.hypot(at, an);
    S.add({ t: 'Normal component', n: 'a_n always points toward the centre of curvature.', f: 'a_n = v²/ρ', s: isFinite(rho) ? `a_n = (${fmt(v)})²/${fmt(rho)}` : 'a_n = 0', r: `a_n = ${fmt(an)} ${u.A}` });
    S.add({ t: 'Tangential component', n: 'a_t is the rate of change of the speed, along the path.', r: `a_t = v̇ = ${fmt(at)} ${u.A}` });
    S.add({ t: 'Magnitude of the acceleration', f: 'a = √(a_t² + a_n²)', s: `a = √((${fmt(at)})² + (${fmt(an)})²)`, r: `a = ${fmt(a)} ${u.A}, at ${fmt(Math.atan2(an, at) / D2R)}° from the tangent toward the centre` });
    if (isFinite(rho)) out.push({ k: 'Radius of curvature ρ', v: rho, u: u.L, hl: true }); else out.push({ k: 'Radius of curvature ρ', v: 'infinite (straight)', u: '' });
    out.push({ k: 'Normal acceleration a_n', v: an, u: u.A, hl: true }, { k: 'Tangential acceleration a_t', v: at, u: u.A }, { k: 'Acceleration a', v: a, u: u.A, hl: true }, { k: 'Angle of a from the tangent', v: Math.atan2(an, at) / D2R, u: '°' });
    return R(`ρ = ${isFinite(rho) ? fmt(rho) + ' ' + u.L : '∞'}, a_n = ${fmt(an)} ${u.A}, a = ${fmt(a)} ${u.A}`, 'ok', out, S, Object.assign(geo, { mode: 'path', u, v, at, an, a, rho, span: [0, 1], t: 0 }));
  }

  /* Cylindrical (polar) components ---------------------------------------- */
  function cyl(st, u) {
    const cr = st.cr.map(Number), ct = st.cth.map(Number), t = +st.t, S = Steps(), out = [];
    if (!cr.every(isFinite) || !ct.every(isFinite) || !isFinite(t)) return fail('Enter r(t), θ(t) and the time.');
    if (!(t >= 0)) return fail('The time must be zero or more.');
    const r1 = pder(cr), r2 = pder(r1), q1 = pder(ct), q2 = pder(q1);
    const r = peval(cr, t), rd = peval(r1, t), rdd = r2.length ? peval(r2, t) : 0, th = peval(ct, t), thd = peval(q1, t), thdd = q2.length ? peval(q2, t) : 0;
    S.add({ t: 'Position', r: `r = ${polyStr(cr, 't')} ${u.L},  θ = ${polyStr(ct, 't')} rad` });
    S.add({ t: 'Time derivatives', f: 'ṙ = dr/dt, r̈ = d²r/dt², θ̇ = dθ/dt, θ̈ = d²θ/dt²', s: `ṙ = ${polyStr(r1, 't')}, r̈ = ${polyStr(r2, 't')};  θ̇ = ${polyStr(q1, 't')}, θ̈ = ${polyStr(q2, 't')}`,
      r: `At t = ${fmt(t)} s: r = ${fmt(r)} ${u.L}, ṙ = ${fmt(rd)} ${u.V}, r̈ = ${fmt(rdd)} ${u.A}; θ = ${fmt(th)} rad, θ̇ = ${fmt(thd)} rad/s, θ̈ = ${fmt(thdd)} rad/s²` });
    const vr = rd, vt = r * thd, ar = rdd - r * thd * thd, aT = r * thdd + 2 * rd * thd, v = Math.hypot(vr, vt), a = Math.hypot(ar, aT);
    S.add({ t: 'Velocity', f: 'v_r = ṙ, v_θ = rθ̇, v = √(v_r² + v_θ²)', s: `v_r = ${fmt(vr)}, v_θ = (${fmt(r)})(${fmt(thd)}) = ${fmt(vt)}`, r: `v = ${fmt(v)} ${u.V}, at δ = ${fmt(Math.atan2(vt, vr) / D2R)}° from the radial line` });
    S.add({ t: 'Acceleration', f: 'a_r = r̈ − rθ̇², a_θ = rθ̈ + 2ṙθ̇', s: `a_r = ${fmt(rdd)} − (${fmt(r)})(${fmt(thd)})² = ${fmt(ar)};  a_θ = (${fmt(r)})(${fmt(thdd)}) + 2(${fmt(rd)})(${fmt(thd)}) = ${fmt(aT)}`, r: `a = ${fmt(a)} ${u.A}, at φ = ${fmt(Math.atan2(aT, ar) / D2R)}° from the radial line` });
    out.push({ k: 'Radial distance r', v: r, u: u.L }, { k: 'Angle θ', v: th / D2R, u: '°' },
      { k: 'Radial velocity v_r', v: vr, u: u.V }, { k: 'Transverse velocity v_θ', v: vt, u: u.V }, { k: 'Speed v', v, u: u.V, hl: true },
      { k: 'Radial acceleration a_r', v: ar, u: u.A }, { k: 'Transverse acceleration a_θ', v: aT, u: u.A }, { k: 'Acceleration a', v: a, u: u.A, hl: true });
    const T1 = Math.max(t * 1.25, t + 0.5, 1e-3);
    const pos = (x) => { const rr = peval(cr, x), qq = peval(ct, x); return [rr * Math.cos(qq), rr * Math.sin(qq)]; };
    const at = (x) => { const rr = peval(cr, x), d1 = peval(r1, x), d2 = r2.length ? peval(r2, x) : 0, q = peval(ct, x), w = peval(q1, x), al = q2.length ? peval(q2, x) : 0; return { r: rr, th: q, vr: d1, vt: rr * w, ar: d2 - rr * w * w, at: rr * al + 2 * d1 * w }; };
    return R(`v = ${fmt(v)} ${u.V}, a = ${fmt(a)} ${u.A} at t = ${fmt(t)} s`, 'ok', out, S, { mode: 'cyl', u, pos, at, span: [0, T1], t });
  }

  /* Relative motion of two particles -------------------------------------- */
  function kin(p, name, u, S) {
    const v = +p.v, dir = +p.dir, at = +p.at, rho = +p.rho;
    const e = polar(1, dir), nL = [-e[1], e[0]], n = p.turn === 'right' ? [-nL[0], -nL[1]] : nL;
    const an = rho > 0 ? (v * v) / rho : 0;
    const vv = [v * e[0], v * e[1]], aa = [at * e[0] + an * n[0], at * e[1] + an * n[1]];
    S.add({ t: `Particle ${name}`, n: rho > 0 ? `It moves on a curve of radius ${fmt(rho)} ${u.L} turning to the ${p.turn}, so it also has a_n = v²/ρ toward the centre.` : 'It moves on a straight line, so its acceleration is along the path.',
      f: rho > 0 ? 'a_n = v²/ρ' : null, s: rho > 0 ? `a_n = (${fmt(v)})²/${fmt(rho)} = ${fmt(an)} ${u.A}` : null,
      r: `v_${name} = {${fmt(vv[0])}i + ${fmt(vv[1])}j} ${u.V};  a_${name} = {${fmt(aa[0])}i + ${fmt(aa[1])}j} ${u.A}` });
    return { v: vv, a: aa, an, e, n, pos: [+p.x, +p.y], rho, turn: p.turn };
  }
  function rel(st, u) {
    const S = Steps(), out = [];
    for (const k of ['A', 'B']) { const p = st[k]; if (![p.x, p.y, p.v, p.dir, p.at, p.rho].every((x) => isFinite(+x))) return fail(`Enter every value for particle ${k}.`); if (!(+p.v >= 0)) return fail(`The speed of ${k} cannot be negative.`); if (!(+p.rho >= 0)) return fail(`The radius of curvature of ${k} cannot be negative (0 means a straight path).`); }
    S.add({ t: 'Axes', n: 'Fixed x, y axes on the ground; the translating x′, y′ axes move with A (they do not rotate). Directions are measured counterclockwise from +x.' });
    const A = kin(st.A, 'A', u, S), B = kin(st.B, 'B', u, S);
    const vBA = [B.v[0] - A.v[0], B.v[1] - A.v[1]], aBA = [B.a[0] - A.a[0], B.a[1] - A.a[1]], rBA = [B.pos[0] - A.pos[0], B.pos[1] - A.pos[1]];
    S.add({ t: 'Relative velocity', f: 'v_B = v_A + v_B/A  ⇒  v_B/A = v_B − v_A', s: `v_B/A = {${fmt(vBA[0])}i + ${fmt(vBA[1])}j} ${u.V}`, r: `v_B/A = ${fmt(vlen(vBA))} ${u.V} at ${fmt(vang(vBA))}°` });
    S.add({ t: 'Relative acceleration', f: 'a_B = a_A + a_B/A  ⇒  a_B/A = a_B − a_A', s: `a_B/A = {${fmt(aBA[0])}i + ${fmt(aBA[1])}j} ${u.A}`, r: `a_B/A = ${fmt(vlen(aBA))} ${u.A} at ${fmt(vang(aBA))}°` });
    S.add({ t: 'Relative position', f: 'r_B/A = r_B − r_A', r: `r_B/A = {${fmt(rBA[0])}i + ${fmt(rBA[1])}j} ${u.L}, distance ${fmt(vlen(rBA))} ${u.L}` });
    out.push({ k: 'Relative speed v_B/A', v: vlen(vBA), u: u.V, hl: true }, { k: 'Direction of v_B/A', v: vang(vBA), u: '°' }, { k: '(v_B/A)ₓ', v: vBA[0], u: u.V }, { k: '(v_B/A)ᵧ', v: vBA[1], u: u.V },
      { k: 'Relative acceleration a_B/A', v: vlen(aBA), u: u.A, hl: true }, { k: 'Direction of a_B/A', v: vang(aBA), u: '°' }, { k: '(a_B/A)ₓ', v: aBA[0], u: u.A }, { k: '(a_B/A)ᵧ', v: aBA[1], u: u.A },
      { k: 'Distance between them', v: vlen(rBA), u: u.L });
    if (A.rho > 0) out.push({ k: 'Normal acceleration of A', v: A.an, u: u.A }); if (B.rho > 0) out.push({ k: 'Normal acceleration of B', v: B.an, u: u.A });
    // a short stretch of motion for the animation: each one moves along its own path (straight or circular) at its speed
    const span = Math.max(vlen(rBA), 1e-6) * 0.6 / Math.max(vlen(A.v), vlen(B.v), 1e-9);
    return R(`v_B/A = ${fmt(vlen(vBA))} ${u.V} at ${fmt(vang(vBA))}°, a_B/A = ${fmt(vlen(aBA))} ${u.A} at ${fmt(vang(aBA))}°`, 'ok', out, S, { mode: 'rel', u, A, B, vBA, aBA, rBA, span: [0, Math.min(span, 60)], t: 0 });
  }

  const Curv = { defaults, convertState, solve };
  root.Curv = Curv;
  if (typeof module !== 'undefined' && module.exports) module.exports = Curv;
})(typeof window !== 'undefined' ? window : globalThis);
