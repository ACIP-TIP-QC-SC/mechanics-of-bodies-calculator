/* =====================================================================
 * MECHANICS OF DEFORMABLE BODIES · M7 Stress and Strain Transformation
 * (physics only; runs in the browser and in Node)
 * Hibbeler, Statics and Mechanics of Materials, Chapter 14.
 *   stress   plane stress on an element turned by θ, principal stresses,
 *            largest in-plane shear, Mohr's circle, absolute largest shear
 *            (14.1 to 14.5)
 *   strain   the same for plane strain, with γ/2 in place of τ (14.6, 14.7)
 *   rosette  strain rosette (45°, 60° or any three angles): εx, εy, γxy,
 *            principal strains and, with E and ν, principal stresses (14.8, 14.9)
 *   hooke    generalized Hooke's law: strains, changes in size, dilatation
 *            and bulk modulus (14.9)
 * Angles are in degrees, counterclockwise positive from the x axis.
 * Strains in the strain and rosette modes are entered and shown in 10⁻⁶.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const MD = root.MD || require('./mdcore.js');
  const Mohr = root.Mohr || require('../shared/mohr.js');
  const { fmt, fail, Steps } = Core;
  const { toBase: B, fromBase: D, units } = MD;
  const DEG = Math.PI / 180;
  const MU = '10⁻⁶';

  function defaults() {
    return {
      mode: 'stress',
      ps: { sx: -20, sy: 90, txy: 60, th: 30 },
      pe: { ex: 500, ey: -300, gxy: 200, th: -30, ez: 'zero', nu: 0.3 },
      ro: { kind: '60', ea: 60, eb: 135, ec: 264, ta: 0, tb: 60, tc: 120, mat: 'custom', E: 200, nu: 0.3 },
      hk: { sx: 800, sy: -500, sz: 0, txy: 0, tyz: 0, txz: 0, mat: 'custom', E: 120, nu: 0.34, a: 300, b: 50, c: 20 },
    };
  }
  const KINDS = { ps: { sx: 'ST', sy: 'ST', txy: 'ST' }, ro: { E: 'MOD' }, hk: { sx: 'ST', sy: 'ST', sz: 'ST', txy: 'ST', tyz: 'ST', txz: 'ST', E: 'MOD', a: 'S', b: 'S', c: 'S' } };
  function convertState(st, from, to) {
    if (from === to) return st;
    const fu = from === 'SI' ? 'kN' : 'kip';
    Object.keys(KINDS).forEach((g) => MD.convertObj(st[g], KINDS[g], from, to, fu));
    return st;
  }

  function solve(st, U) {
    const u = units(U, U.id === 'US' ? 'kip' : 'kN');
    if (st.mode === 'strain') return strain(st.pe, u);
    if (st.mode === 'rosette') return rosette(st.ro, u);
    if (st.mode === 'hooke') return hooke(st.hk, u);
    return stress(st.ps, u);
  }
  const R = MD.result;
  const num = (v) => typeof v === 'number' && isFinite(v);
  const ang = (a) => { a = ((a % 180) + 180) % 180; return a > 90 + 1e-9 ? a - 180 : a; };
  const sgn = (v) => (v < 0 ? `− ${fmt(-v)}` : `+ ${fmt(v)}`);
  const par = (v) => (v < 0 ? `(${fmt(v)})` : fmt(v));

  /**
   * The shared steps of a plane-stress or plane-strain transformation.
   * n: names {s: 'σ', t: 'τ', u, shear(v) → shown shear (τ or γ), half: true for strain (c = γ/2)}
   */
  function transform(S, out, ax, ay, c, th, n) {
    const m = Mohr.stress(ax, ay, c), at = m.at(th), shw = (v) => (n.half ? 2 * v : v);
    const T = n.T, sx = `${n.s}_x`, sy = `${n.s}_y`, txy = n.half ? 'γ_xy/2' : 'τ_xy';
    // 1. element turned by θ
    const c2 = Math.cos(2 * th * DEG), s2 = Math.sin(2 * th * DEG);
    S.add({ t: `${n.word} on an element turned by θ = ${fmt(th)}°`, n: `θ is measured counterclockwise from the x axis to the x' axis.${n.half ? ' For strain, γ/2 takes the place of τ.' : ''}`,
      f: `${n.s}_x' = (${sx} + ${sy})/2 + (${sx} − ${sy})/2 cos 2θ + ${txy} sin 2θ`,
      s: `${n.s}_x' = ${fmt(m.avg)} ${sgn(m.d)} cos(${fmt(2 * th)}°) ${sgn(c)} sin(${fmt(2 * th)}°)`, r: `${n.s}_x' = ${fmt(at.sx)} ${n.u}` });
    S.add({ t: `${T} on the x' face`, f: `${n.half ? "γ_x'y'/2" : "τ_x'y'"} = −(${sx} − ${sy})/2 sin 2θ + ${txy} cos 2θ`,
      s: `${n.half ? "γ_x'y'/2" : "τ_x'y'"} = ${fmt(-m.d)} sin(${fmt(2 * th)}°) ${sgn(c)} cos(${fmt(2 * th)}°) = ${fmt(at.txy)}`, r: `${n.t}_x'y' = ${fmt(shw(at.txy))} ${n.u}` });
    S.add({ t: `${n.s}_y' on the face at θ + 90°`, f: `${n.s}_y' = ${sx} + ${sy} − ${n.s}_x'`, s: `${n.s}_y' = ${fmt(ax)} ${sgn(ay)} ${sgn(-at.sx)}`, r: `${n.s}_y' = ${fmt(at.sy)} ${n.u}` });
    void c2; void s2;
    // 2. principal values
    const tp = m.thp, tp2 = m.thp2;
    S.add({ t: `Principal ${n.word2}`, f: `${n.s}_1,2 = (${sx} + ${sy})/2 ± √[((${sx} − ${sy})/2)² + (${txy})²]`,
      s: `${n.s}_1,2 = ${fmt(m.avg)} ± √[${par(m.d)}² + ${par(c)}²] = ${fmt(m.avg)} ± ${fmt(m.R)}`, r: `${n.s}_1 = ${fmt(m.max)} ${n.u}, ${n.s}_2 = ${fmt(m.min)} ${n.u}` });
    S.add({ t: 'Orientation of the principal planes', f: `tan 2θ_p = ${n.half ? 'γ_xy' : '2τ_xy'}/(${sx} − ${sy})`,
      s: m.R > 0 ? `tan 2θ_p = ${fmt(n.half ? 2 * c : 2 * c)}/${par(ax - ay)}${Math.abs(ax - ay) > 1e-12 ? ` = ${fmt((2 * c) / (ax - ay))}` : ''}` : 'Every plane is a principal plane: the circle is a point.',
      n: m.R > 0 ? `The two roots are 90° apart. Putting θ = ${fmt(tp)}° into the ${n.s}_x' equation gives ${fmt(m.max)}, so this plane carries ${n.s}_1; the plane at ${fmt(tp2)}° carries ${n.s}_2. No ${T.toLowerCase()} acts on these planes.` : undefined,
      r: `θ_p1 = ${fmt(tp)}° (${n.s}_1), θ_p2 = ${fmt(tp2)}° (${n.s}_2)` });
    // 3. largest in-plane shear
    const ts = ang(m.ths), ts2 = ang(ts + 90);
    S.add({ t: `Largest in-plane ${T.toLowerCase()}`, f: `${n.half ? 'γ_max/2' : 'τ_max'} = √[((${sx} − ${sy})/2)² + (${txy})²],  tan 2θ_s = −(${sx} − ${sy})/${n.half ? 'γ_xy' : '(2τ_xy)'}`,
      s: `${n.half ? 'γ_max/2' : 'τ_max'} = ${fmt(m.R)}`, r: `${n.t}_max in-plane = ${fmt(shw(m.R))} ${n.u} at θ_s = ${fmt(ts)}° (and ${fmt(ts2)}°)`,
      n: `The planes of largest shear are 45° from the principal planes. Each also carries the average normal ${n.word3} ${n.s}_avg = (${sx} + ${sy})/2 = ${fmt(m.avg)} ${n.u}.` });
    // 4. Mohr's circle
    S.add({ t: "Mohr's circle", n: `Plot ${n.s} to the right and ${n.half ? 'γ/2' : 'τ'} positive downward. Point x is (${n.s}_x, ${txy}); a turn of the element by θ counterclockwise moves the point by 2θ counterclockwise round the circle.`,
      f: `centre C = (${n.s}_avg, 0), radius R = √[((${sx} − ${sy})/2)² + (${txy})²]`, r: `C = (${fmt(m.avg)}, 0), R = ${fmt(m.R)}, x = (${fmt(ax)}, ${fmt(c)})` });
    out.push({ k: `Normal ${n.word3} ${n.s}_x'`, v: at.sx, u: n.u, hl: !!th }, { k: `Normal ${n.word3} ${n.s}_y'`, v: at.sy, u: n.u }, { k: `${T} ${n.t}_x'y'`, v: shw(at.txy), u: n.u, hl: !!th });
    out.push({ k: `Principal ${n.word3} ${n.s}_1`, v: m.max, u: n.u, hl: true }, { k: `Principal ${n.word3} ${n.s}_2`, v: m.min, u: n.u, hl: true });
    out.push({ k: `Angle to ${n.s}_1, θ_p1`, v: tp, u: '°' }, { k: `Angle to ${n.s}_2, θ_p2`, v: tp2, u: '°' });
    out.push({ k: `Maximum in-plane ${T.toLowerCase()} ${n.t}_max`, v: shw(m.R), u: n.u, hl: true }, { k: `Average normal ${n.word3} ${n.s}_avg`, v: m.avg, u: n.u }, { k: `Angle to the plane of ${n.t}_max, θ_s`, v: ts, u: '°' });
    return { m: { avg: m.avg, d: m.d, R: m.R, max: m.max, min: m.min, thp: tp, thp2: tp2, ths: ts }, at, ax, ay, c, th };
  }

  /** Absolute largest shear from the three principal values. */
  function absMax(S, out, s1, s2, s3, n, note) {
    const vals = [s1, s2, s3], hi = Math.max(...vals), lo = Math.min(...vals), h = (hi - lo) / 2;
    S.add({ t: `Absolute maximum ${n.T.toLowerCase()}`, n: note, f: `${n.half ? 'γ_abs' : 'τ_abs'} = (${n.s}_max − ${n.s}_min)${n.half ? '' : '/2'}`, s: `${n.s}_max = ${fmt(hi)}, ${n.s}_min = ${fmt(lo)}`, r: `${n.t}_abs max = ${fmt(n.half ? 2 * h : h)} ${n.u}` });
    out.push({ k: `Absolute maximum ${n.T.toLowerCase()} ${n.t}_abs`, v: n.half ? 2 * h : h, u: n.u, hl: true });
    return { hi, lo, h };
  }

  /* ------------------------------------------------------------------ */
  /* Plane stress                                                       */
  /* ------------------------------------------------------------------ */
  function stress(q, u) {
    const err = [];
    ['sx', 'sy', 'txy', 'th'].forEach((k) => { if (!num(q[k])) err.push(`Enter ${{ sx: 'σx', sy: 'σy', txy: 'τxy', th: 'the angle θ' }[k]} as a number.`); });
    if (err.length) return fail(err);
    const S = Steps(), out = [], ST = u.ST;
    S.add({ t: 'State of stress', n: 'Plane stress: σz = τxz = τyz = 0. A normal stress is positive in tension; τxy is positive when it acts in +y on the face whose outward normal is +x.', r: `σx = ${fmt(+q.sx)} ${ST}, σy = ${fmt(+q.sy)} ${ST}, τxy = ${fmt(+q.txy)} ${ST}` });
    const n = { s: 'σ', t: 'τ', u: ST, T: 'Shear stress', word: 'Stresses', word2: 'stresses', word3: 'stress' };
    const g = transform(S, out, +q.sx, +q.sy, +q.txy, +q.th, n);
    const a = absMax(S, out, g.m.max, g.m.min, 0, n, 'Out of the plane the third principal stress is σz = 0. The largest shear acts on the planes 45° between the largest and smallest of σ1, σ2 and 0.');
    const inPlane = Math.abs(a.h - g.m.R) < 1e-9 * Math.max(1, Math.abs(a.h));
    return R(`σ1 = ${fmt(g.m.max)} ${ST}, σ2 = ${fmt(g.m.min)} ${ST}, τ_max in-plane = ${fmt(g.m.R)} ${ST}`, 'ok', out, S,
      Object.assign({ kind: 'stress', u, unit: ST, abs: a, inPlane }, g));
  }

  /* ------------------------------------------------------------------ */
  /* Plane strain                                                       */
  /* ------------------------------------------------------------------ */
  const STRAIN = { s: 'ε', t: 'γ', u: MU, T: 'Shear strain', word: 'Strains', word2: 'strains', word3: 'strain', half: true };
  function strainAbs(S, out, g, ez, nu) {
    let e3 = 0, note = 'Plane strain: εz = 0, so the third principal strain is zero.';
    if (ez === 'nu') {
      e3 = (-nu / (1 - nu)) * (g.m.max + g.m.min);
      note = `Plane stress (σz = 0): the material thins out of the plane, εz = −ν/(1 − ν)(ε1 + ε2) = −${fmt(nu)}/(1 − ${fmt(nu)})(${fmt(g.m.max)} ${sgn(g.m.min)}) = ${fmt(e3)}(10⁻⁶).`;
      out.push({ k: 'Out-of-plane strain ε_z', v: e3, u: MU });
    }
    return absMax(S, out, g.m.max, g.m.min, e3, STRAIN, note + ' The absolute largest shear strain is the difference between the largest and smallest principal strains.');
  }
  function strain(q, u) {
    const err = [];
    ['ex', 'ey', 'gxy', 'th'].forEach((k) => { if (!num(q[k])) err.push(`Enter ${{ ex: 'εx', ey: 'εy', gxy: 'γxy', th: 'the angle θ' }[k]} as a number.`); });
    if (q.ez === 'nu' && !(q.nu >= 0 && q.nu < 0.5)) err.push("Poisson's ratio must be from 0 up to (not including) 0.5.");
    if (err.length) return fail(err);
    const S = Steps(), out = [];
    S.add({ t: 'State of strain', n: 'Elongation is positive. γxy is positive when the angle between the +x and +y sides of the element gets smaller. Values are in 10⁻⁶ (microstrain).', r: `εx = ${fmt(+q.ex)}, εy = ${fmt(+q.ey)}, γxy = ${fmt(+q.gxy)} (10⁻⁶)` });
    const g = transform(S, out, +q.ex, +q.ey, q.gxy / 2, +q.th, STRAIN);
    const a = strainAbs(S, out, g, q.ez, +q.nu);
    return R(`ε1 = ${fmt(g.m.max)}, ε2 = ${fmt(g.m.min)} (10⁻⁶); γ_max in-plane = ${fmt(2 * g.m.R)}(10⁻⁶)`, 'ok', out, S, Object.assign({ kind: 'strain', u, unit: MU, abs: a }, g));
  }

  /* ------------------------------------------------------------------ */
  /* Strain rosette                                                     */
  /* ------------------------------------------------------------------ */
  function gaugeAngles(q) { return q.kind === '45' ? [0, 45, 90] : q.kind === '60' ? [0, 60, 120] : [+q.ta, +q.tb, +q.tc]; }
  function rosette(q, u) {
    const err = [], ths = gaugeAngles(q), es = [+q.ea, +q.eb, +q.ec], L = 'abc';
    es.forEach((e, i) => { if (!num(e)) err.push(`Enter the reading of gauge ${L[i]}.`); });
    ths.forEach((t, i) => { if (!num(t)) err.push(`Enter the angle of gauge ${L[i]}.`); });
    if (!(q.E >= 0)) err.push('Enter E (0 leaves out the stresses).');
    if (q.E > 0 && !(q.nu >= 0 && q.nu < 0.5)) err.push("Poisson's ratio must be from 0 up to (not including) 0.5.");
    if (err.length) return fail(err);
    const A = ths.map((t) => { const c = Math.cos(t * DEG), s = Math.sin(t * DEG); return [c * c, s * s, s * c]; });
    const sol = Core.linSolve(A, es);
    if (!sol || sol.rank < 3 || !sol.x || sol.x.some((x) => !isFinite(x))) return fail(['Two of the gauges point the same way (or 180° apart), so εx, εy and γxy cannot be found. Use three different directions.']);
    const [ex, ey, gxy] = sol.x;
    const S = Steps(), out = [];
    S.add({ t: 'Strain along each gauge', n: 'A gauge at angle θ (counterclockwise from x) reads the normal strain in its own direction.', f: 'ε = εx cos²θ + εy sin²θ + γxy sinθ cosθ',
      table: { head: ['Gauge', 'θ (°)', `Reading (10⁻⁶)`], rows: ths.map((t, i) => [L[i], fmt(t), fmt(es[i])]) } });
    if (q.kind === '45') S.add({ t: '45° rosette', f: 'εx = ε_a,  εy = ε_c,  γxy = 2ε_b − (ε_a + ε_c)', s: `γxy = 2(${fmt(es[1])}) − (${fmt(es[0])} ${sgn(es[2])})`, r: `εx = ${fmt(ex)}, εy = ${fmt(ey)}, γxy = ${fmt(gxy)} (10⁻⁶)` });
    else if (q.kind === '60') S.add({ t: '60° rosette', f: 'εx = ε_a,  εy = (2ε_b + 2ε_c − ε_a)/3,  γxy = 2(ε_b − ε_c)/√3', s: `εy = (2(${fmt(es[1])}) + 2(${fmt(es[2])}) − ${par(es[0])})/3, γxy = 2(${fmt(es[1])} ${sgn(-es[2])})/√3`, r: `εx = ${fmt(ex)}, εy = ${fmt(ey)}, γxy = ${fmt(gxy)} (10⁻⁶)` });
    else S.add({ t: 'Solve the three equations', n: 'One equation for each gauge, solved together for the three unknowns.', s: ths.map((t, i) => { const a = A[i]; return `${fmt(es[i])} = ${fmt(a[0])}εx ${sgn(a[1])}εy ${sgn(a[2])}γxy`; }).join(';  '), r: `εx = ${fmt(ex)}, εy = ${fmt(ey)}, γxy = ${fmt(gxy)} (10⁻⁶)` });
    out.push({ k: 'Normal strain ε_x', v: ex, u: MU }, { k: 'Normal strain ε_y', v: ey, u: MU }, { k: 'Shear strain γ_xy', v: gxy, u: MU });
    const m = Mohr.stress(ex, ey, gxy / 2), tp = m.thp, tp2 = m.thp2;
    S.add({ t: 'Principal strains', f: 'ε_1,2 = (εx + εy)/2 ± √[((εx − εy)/2)² + (γxy/2)²]', s: `ε_1,2 = ${fmt(m.avg)} ± √[${par(m.d)}² + ${par(gxy / 2)}²]`, r: `ε1 = ${fmt(m.max)}, ε2 = ${fmt(m.min)} (10⁻⁶)` });
    S.add({ t: 'Directions of the principal strains', f: 'tan 2θ_p = γxy/(εx − εy)', r: `θ_p1 = ${fmt(tp)}° (ε1), θ_p2 = ${fmt(tp2)}° (ε2)` });
    out.push({ k: 'Principal strain ε_1', v: m.max, u: MU, hl: true }, { k: 'Principal strain ε_2', v: m.min, u: MU, hl: true }, { k: 'Angle to ε_1, θ_p1', v: tp, u: '°' }, { k: 'Angle to ε_2, θ_p2', v: tp2, u: '°' });
    out.push({ k: 'Maximum in-plane shear strain γ_max', v: 2 * m.R, u: MU });
    let s1 = null, s2 = null;
    if (q.E > 0) {
      const E = B(+q.E, u.MOD), nu = +q.nu, k = E / (1 - nu * nu);
      s1 = k * (m.max + nu * m.min) * 1e-6; s2 = k * (m.min + nu * m.max) * 1e-6;
      S.add({ t: "Principal stresses from Hooke's law", n: 'The gauges sit on a free surface, so the material is in plane stress and the principal directions of stress and strain are the same.', f: 'σ1 = E/(1 − ν²)(ε1 + νε2),  σ2 = E/(1 − ν²)(ε2 + νε1)',
        s: `σ1 = ${fmt(+q.E)} ${u.MOD}/(1 − ${fmt(nu)}²)(${fmt(m.max)} ${sgn(nu * m.min)})(10⁻⁶)`, r: `σ1 = ${MD.show(s1, u.ST)}, σ2 = ${MD.show(s2, u.ST)}` });
      out.push({ k: 'Principal stress σ_1', v: D(s1, u.ST), u: u.ST, hl: true }, { k: 'Principal stress σ_2', v: D(s2, u.ST), u: u.ST, hl: true });
    }
    return R(`ε1 = ${fmt(m.max)}, ε2 = ${fmt(m.min)} (10⁻⁶)${s1 !== null ? `; σ1 = ${MD.show(s1, u.ST)}, σ2 = ${MD.show(s2, u.ST)}` : ''}`, 'ok', out, S,
      { kind: 'rosette', u, unit: MU, ths, es, ex, ey, c: gxy / 2, ax: ex, ay: ey, th: 0, at: m.at(0), m: { avg: m.avg, d: m.d, R: m.R, max: m.max, min: m.min, thp: tp, thp2: tp2, ths: ang(m.ths) }, q });
  }

  /* ------------------------------------------------------------------ */
  /* Generalized Hooke's law                                            */
  /* ------------------------------------------------------------------ */
  function hooke(q, u) {
    const err = [];
    ['sx', 'sy', 'sz', 'txy', 'tyz', 'txz'].forEach((k) => { if (!num(q[k])) err.push(`Enter ${k.replace('s', 'σ').replace('t', 'τ')} as a number (0 if it is absent).`); });
    if (!(q.E > 0)) err.push('Enter the modulus of elasticity E.');
    if (!(q.nu >= 0 && q.nu < 0.5)) err.push("Poisson's ratio must be from 0 up to (not including) 0.5.");
    ['a', 'b', 'c'].forEach((k) => { if (!(q[k] >= 0)) err.push('The sizes of the block cannot be negative (0 leaves the change out).'); });
    if (err.length) return fail(err);
    const S = Steps(), out = [], ST = u.ST, E = B(+q.E, u.MOD), nu = +q.nu, s = [B(+q.sx, ST), B(+q.sy, ST), B(+q.sz, ST)], X = 'xyz';
    const e = [0, 1, 2].map((i) => (s[i] - nu * (s[(i + 1) % 3] + s[(i + 2) % 3])) / E);
    S.add({ t: 'Stresses on the element', n: 'Tension is positive. Within the elastic range the effects of each stress add (superposition).', r: `σx = ${fmt(+q.sx)}, σy = ${fmt(+q.sy)}, σz = ${fmt(+q.sz)} ${ST}` });
    S.add({ t: 'Normal strains', f: 'εx = [σx − ν(σy + σz)]/E,  εy = [σy − ν(σx + σz)]/E,  εz = [σz − ν(σx + σy)]/E',
      table: { head: ['Direction', 'Equation', 'ε'], rows: [0, 1, 2].map((i) => { const a = [+q.sx, +q.sy, +q.sz]; return [X[i], `[${fmt(a[i])} − ${fmt(nu)}(${fmt(a[(i + 1) % 3])} ${sgn(a[(i + 2) % 3])})]/(${fmt(D(E, ST))} ${ST})`, fmt(e[i])]; }) } });
    [0, 1, 2].forEach((i) => out.push({ k: `Normal strain ε_${X[i]}`, v: e[i], u: '', hl: true }));
    const G = E / (2 * (1 + nu)), tau = [['xy', +q.txy], ['yz', +q.tyz], ['xz', +q.txz]].filter((t) => t[1]);
    out.push({ k: 'Shear modulus G', v: D(G, u.MOD), u: u.MOD });
    if (tau.length) {
      S.add({ t: 'Shear strains', f: 'G = E/[2(1 + ν)],  γ = τ/G', s: `G = ${fmt(+q.E)}/[2(1 + ${fmt(nu)})] = ${MD.show(G, u.MOD)}`, table: { head: ['Plane', `τ (${ST})`, 'γ (rad)'], rows: tau.map(([p, t]) => [p, fmt(t), fmt(B(t, ST) / G)]) } });
      tau.forEach(([p, t]) => out.push({ k: `Shear strain γ_${p}`, v: B(t, ST) / G, u: 'rad' }));
    }
    const dims = [+q.a, +q.b, +q.c], dl = dims.map((d, i) => d * e[i]);
    if (dims.some((d) => d > 0)) {
      S.add({ t: 'Change in each side of the block', f: 'δ = εL', table: { head: ['Side', `L (${u.S})`, `δ (${u.S})`, `New length (${u.S})`], rows: dims.map((d, i) => [`along ${X[i]}`, fmt(d), d > 0 ? fmt(dl[i]) : '–', d > 0 ? fmt(d + dl[i]) : '–']) } });
      dims.forEach((d, i) => { if (d > 0) out.push({ k: `Change in the side along ${X[i]}, δ_${X[i]}`, v: dl[i], u: u.S }); });
    }
    const ev = ((1 - 2 * nu) / E) * (s[0] + s[1] + s[2]), k = E / (3 * (1 - 2 * nu));
    S.add({ t: 'Dilatation (change in volume per unit volume)', f: 'e = εx + εy + εz = (1 − 2ν)/E (σx + σy + σz)', s: `e = (1 − 2(${fmt(nu)}))/(${fmt(D(E, ST))} ${ST}) (${fmt(D(s[0] + s[1] + s[2], ST))} ${ST})`, r: `e = ${fmt(ev)}` });
    out.push({ k: 'Dilatation e', v: ev, u: '', hl: true });
    S.add({ t: 'Bulk modulus', n: 'Under an equal pressure p on every side, e = −p/k.', f: 'k = E/[3(1 − 2ν)]', s: `k = ${fmt(+q.E)}/[3(1 − 2(${fmt(nu)}))]`, r: `k = ${MD.show(k, u.MOD)}` });
    out.push({ k: 'Bulk modulus k', v: D(k, u.MOD), u: u.MOD });
    if (dims.every((d) => d > 0)) {
      const V = dims[0] * dims[1] * dims[2], dV = V * ev;
      S.add({ t: 'Change in volume', f: 'δV = eV', s: `δV = ${fmt(ev)}(${fmt(dims[0])})(${fmt(dims[1])})(${fmt(dims[2])})`, r: `δV = ${fmt(dV)} ${u.S}³` });
      out.push({ k: 'Change in volume δV', v: dV, u: `${u.S}³` });
    }
    return R(`εx = ${fmt(e[0])}, εy = ${fmt(e[1])}, εz = ${fmt(e[2])}; e = ${fmt(ev)}`, 'ok', out, S, { kind: 'hooke', u, q, e, s, dims, dl, ev, nu });
  }

  const Transform = { defaults, solve, convertState, gaugeAngles, MU };
  root.Transform = Transform;
  if (typeof module !== 'undefined' && module.exports) module.exports = Transform;
})(typeof window !== 'undefined' ? window : globalThis);
