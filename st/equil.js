/* =====================================================================
 * STATICS · Equilibrium (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapters 3 and 5.
 *   particle   coplanar particle: two unknown magnitudes, or one magnitude and one angle (3.3)
 *   particle3d particle held by three cables in space (3.4)
 *   rigid      2D rigid body on pins, rollers, fixed supports, cables and links (5.1 to 5.4)
 * Forces are in the chosen force unit `fu`, lengths in m or ft.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const Forces = root.Forces || require('./forces.js');
  const { fmt, fail, Steps, sumStr, linSolve } = Core;
  const DEG = Math.PI / 180;
  const { comp2, comp3 } = Forces;
  const { add, sub, mul, mag } = Forces.vec;

  function defaults() {
    return {
      mode: 'particle', fu: 'N',
      pa: {
        known: [{ kind: 'mass', m: 60, by: 'polar', F: 100, ang: 270, Fx: 0, Fy: 0, dx: 4, dy: 3 }],
        how: 'two', u1: { name: 'BA', type: 'cable', ang: 150, k: 0 }, u2: { name: 'BC', type: 'cable', ang: 45, k: 0, P: 500 },
      },
      p3: {
        A: { x: 0, y: 0, z: 0 },
        known: [{ kind: 'mass', m: 100, by: 'comp', Fx: 0, Fy: 0, Fz: 0 }],
        cables: [{ name: 'AB', by: 'point', x: 1, y: 0, z: 0, al: 90, be: 90, ga: 0 }, { name: 'AC', by: 'angles', x: 0, y: 0, z: 1, al: 120, be: 135, ga: 60 }, { name: 'AD', by: 'point', x: -1, y: 2, z: 2, al: 90, be: 90, ga: 0 }],
      },
      rb: {
        outline: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: -2 }],
        supports: [{ type: 'pin', x: 0, y: 0, ang: 90 }, { type: 'roller', x: 6, y: -2, ang: 120 }],
        loads: [{ by: 'polar', F: 750, ang: 270, Fx: 0, Fy: 0, dx: 4, dy: 3, x: 3, y: 0 }],
        couples: [], dists: [],
      },
    };
  }
  const gOf = (U) => (U.id === 'US' ? 32.2 : 9.81);
  /** Weight m·g in the chosen force unit. */
  function weight(m, U, fu) { const Wbase = m * gOf(U); return U.id === 'US' ? Core.convert(Wbase, 'lb', fu) : Core.convert(Wbase, 'N', fu); }
  const ok = (text, out, S, geo, warn, cls) => ({ ok: true, err: [], warn: warn || [], status: { cls: cls || 'ok', text }, out, steps: S.list, geo });

  function solve(st, U) {
    const c = { F: st.fu, Lu: U.len, FL: `${st.fu}·${U.len}`, U };
    if (st.mode === 'particle3d') return particle3d(st, c);
    if (st.mode === 'rigid') return rigid(st, c);
    return particle(st, c);
  }

  /* ------------------------------------------------------------------ */
  /* Coplanar particle                                                  */
  /* ------------------------------------------------------------------ */
  function knowns2(list, c, err) {
    return list.map((k, i) => {
      if (k.kind === 'mass') {
        if (!(+k.m > 0)) { err.push(`Load ${i + 1}: the mass must be greater than zero.`); return null; }
        const W = weight(+k.m, c.U, c.F);
        return { name: `W${list.length > 1 ? i + 1 : ''}`, Fx: 0, Fy: -W, F: W, how: `W = mg = ${fmt(+k.m)}(${fmt(gOf(c.U))}) = ${fmt(W)} ${c.F}, downward` };
      }
      const r = comp2(k, `Load ${i + 1}`); if (r.err) { err.push(r.err); return null; }
      return Object.assign(r, { name: `P${i + 1}` });
    });
  }
  function particle(st, c) {
    const q = st.pa, { F, Lu } = c, err = [];
    const K = knowns2(q.known || [], c, err);
    const u1 = q.u1, u2 = q.u2;
    if (!isFinite(+u1.ang) || !isFinite(+u2.ang)) err.push('Enter the direction of each unknown force.');
    if (q.how === 'angle' && !(+u2.P > 0)) err.push(`F_${u2.name}: the known magnitude must be greater than zero.`);
    ['u1', 'u2'].forEach((k) => { const u = q[k]; if (u.type === 'spring' && !(+u.k > 0)) err.push(`F_${u.name}: the spring stiffness k must be greater than zero.`); });
    if (err.length) return fail(err);
    const S = Steps(), out = [];
    const Kx = K.reduce((s, k) => s + k.Fx, 0), Ky = K.reduce((s, k) => s + k.Fy, 0);
    const e1 = [Math.cos(u1.ang * DEG), Math.sin(u1.ang * DEG)], e2 = [Math.cos(u2.ang * DEG), Math.sin(u2.ang * DEG)];
    const nm1 = `F_${u1.name}`, nm2 = `F_${u2.name}`;
    S.add({ t: 'Free-body diagram of the particle', n: `The known loads are resolved into components. Each unknown ${q.how === 'angle' ? 'is' : 'force is'} drawn pulling away from the particle along its cable or spring, at its angle counterclockwise from +x.`,
      table: { head: ['Force', 'How', `F_x (${F})`, `F_y (${F})`], rows: K.map((k) => [k.name, k.how, fmt(k.Fx), fmt(k.Fy)]).concat([[nm1, `unknown, at ${fmt(+u1.ang)}°`, `${fmt(e1[0])} ${nm1}`, `${fmt(e1[1])} ${nm1}`], q.how === 'angle' ? [nm2, `${fmt(+u2.P)} ${F}, angle θ unknown`, `${fmt(+u2.P)} cos θ`, `${fmt(+u2.P)} sin θ`] : [nm2, `unknown, at ${fmt(+u2.ang)}°`, `${fmt(e2[0])} ${nm2}`, `${fmt(e2[1])} ${nm2}`]]) } });
    let T1, T2, th2 = +u2.ang, alt = null;
    const sx = sumStr(K.map((k) => ({ v: k.Fx, txt: fmt(Math.abs(k.Fx)) })).filter((t) => t.txt !== '0')), sy = sumStr(K.map((k) => ({ v: k.Fy, txt: fmt(Math.abs(k.Fy)) })).filter((t) => t.txt !== '0'));
    if (q.how === 'angle') {
      const P2 = +u2.P, Ku = Kx * e1[0] + Ky * e1[1], disc = Ku * Ku - (Kx * Kx + Ky * Ky) + P2 * P2;
      S.add({ t: 'Equations of equilibrium', f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0', s: `${sx === '0' ? '' : sx + ' + '}${fmt(e1[0])} ${nm1} + ${fmt(P2)} cos θ = 0\n${sy === '0' ? '' : sy + ' + '}${fmt(e1[1])} ${nm1} + ${fmt(P2)} sin θ = 0`, n: 'Squaring and adding the two equations removes θ: (ΣK_x + T u_x)² + (ΣK_y + T u_y)² = P², a quadratic in the unknown magnitude.' });
      if (disc < -1e-12 * P2 * P2) return fail(`No angle works: a force of ${fmt(P2)} ${F} is too small to balance the other forces. It must be at least ${fmt(Math.sqrt(Math.max(0, Kx * Kx + Ky * Ky - Ku * Ku)))} ${F}.`);
      const r = Math.sqrt(Math.max(0, disc)), roots = [-Ku + r, -Ku - r].filter((t) => t >= -1e-9 * P2).map((t) => Math.max(0, t));
      if (!roots.length) return fail(`No solution keeps ${nm1} in tension. Check the directions.`);
      const sols = roots.map((T) => { const rr = [-(Kx + T * e1[0]), -(Ky + T * e1[1])]; return { T, th: ((Math.atan2(rr[1], rr[0]) / DEG) + 360) % 360, rr }; });
      if (sols.length > 1 && Math.abs(sols[0].T - sols[1].T) < 1e-9 * P2) sols.pop();
      const gap = (a) => Math.abs(((a - +u2.ang + 540) % 360) - 180);
      sols.sort((p1, p2) => gap(p1.th) - gap(p2.th));
      T1 = sols[0].T; T2 = P2; th2 = sols[0].th;
      S.add({ t: `Solve for ${nm1}`, f: `${nm1}² + 2(${fmt(Ku)}) ${nm1} + (${fmt(Kx * Kx + Ky * Ky)} − ${fmt(P2 * P2)}) = 0`, r: sols.length > 1 ? `${nm1} = ${fmt(sols[0].T)} ${F} or ${fmt(sols[1].T)} ${F}. Both balance the particle; the one whose angle is nearer the angle entered for ${nm2} (${fmt(+u2.ang)}°) is used, and the other is listed in the results.` : `${nm1} = ${fmt(T1)} ${F}` });
      S.add({ t: `Angle of ${nm2}`, f: 'θ = tan⁻¹ (F_y / F_x) of the force needed to close the force polygon', s: `F_x = ${fmt(sols[0].rr[0])}, F_y = ${fmt(sols[0].rr[1])}`, r: `θ = ${fmt(th2)}° counterclockwise from +x` });
      if (sols.length > 1) alt = { T1: sols[1].T, th: sols[1].th };
    } else {
      const det = e1[0] * e2[1] - e1[1] * e2[0];
      if (Math.abs(det) < 1e-9) return fail('The two unknown forces act along the same line, so they cannot balance a load across that line. Change one of the directions.');
      T1 = (-Kx * e2[1] + Ky * e2[0]) / det; T2 = (-e1[0] * Ky + e1[1] * Kx) / det;
      S.add({ t: 'Sum of forces along x', f: '→+ ΣF_x = 0', s: `${sx === '0' ? '' : sx + ' + '}(${fmt(e1[0])}) ${nm1} + (${fmt(e2[0])}) ${nm2} = 0` });
      S.add({ t: 'Sum of forces along y', f: '+↑ ΣF_y = 0', s: `${sy === '0' ? '' : sy + ' + '}(${fmt(e1[1])}) ${nm1} + (${fmt(e2[1])}) ${nm2} = 0` });
      S.add({ t: 'Solve the two equations', n: 'Solve one equation for one force and substitute into the other.', r: `${nm1} = ${fmt(T1)} ${F}, ${nm2} = ${fmt(T2)} ${F}` });
    }
    const bad = [[u1, T1, nm1], [u2, T2, nm2]].filter(([u, T]) => u.type === 'cable' && T < -1e-9 * Math.max(1, Math.abs(T1), Math.abs(T2)));
    if (bad.length) return fail(bad.map(([u, T, n]) => `${n} comes out as ${fmt(T)} ${F}: a cable cannot push, so the particle cannot be held in equilibrium this way. Change the cable directions.`));
    const rows = [[u1, T1, nm1], [u2, T2, nm2]];
    out.push({ k: `Force ${nm1}`, v: T1, u: F, hl: true }, { k: `Force ${nm2}`, v: T2, u: F, hl: true });
    if (q.how === 'angle') out.push({ k: `Angle of ${nm2} (↺ from +x)`, v: th2, u: '°', hl: true });
    if (alt) out.push({ k: `Second solution: ${nm1}`, v: alt.T1, u: F }, { k: `Second solution: angle of ${nm2}`, v: alt.th, u: '°' });
    rows.forEach(([u, T, n]) => { if (u.type === 'spring') { const s = T / +u.k; S.add({ t: `Stretch of spring ${u.name}`, f: 'F = k s', s: `${fmt(T)} = ${fmt(+u.k)} s`, r: `s = ${fmt(s)} ${Lu}${s < 0 ? ' (compressed)' : ''}` }); out.push({ k: `Stretch of spring ${u.name}`, v: s, u: Lu }); } });
    if (S.list.length < 4) S.add({ t: 'Check', n: 'Substitute the answers back into ΣF_y = 0.', r: `${fmt(Ky + T1 * e1[1] + T2 * Math.sin(th2 * DEG))} ≈ 0` });
    return ok('Particle in equilibrium', out, S, { kind: 'particle', c, K: K.map((k) => ({ name: k.name, v: [k.Fx, k.Fy], F: k.F })), U: [{ name: nm1, v: mul(e1.concat(0), T1).slice(0, 2), F: T1, type: u1.type }, { name: nm2, v: [T2 * Math.cos(th2 * DEG), T2 * Math.sin(th2 * DEG)], F: T2, type: u2.type }] });
  }

  /* ------------------------------------------------------------------ */
  /* Particle in space                                                  */
  /* ------------------------------------------------------------------ */
  function particle3d(st, c) {
    const q = st.p3, { F, Lu } = c, err = [], A = [+q.A.x || 0, +q.A.y || 0, +q.A.z || 0];
    const K = (q.known || []).map((k, i) => {
      if (k.kind === 'mass') { if (!(+k.m > 0)) { err.push(`Load ${i + 1}: the mass must be greater than zero.`); return null; } const W = weight(+k.m, c.U, F); return { name: 'W', v: [0, 0, -W], how: `W = mg = ${fmt(+k.m)}(${fmt(gOf(c.U))}) = ${fmt(W)} ${F}, along −z` }; }
      const r = comp3(k, `Load ${i + 1}`, Lu); if (r.err) { err.push(r.err); return null; } return { name: `P${i + 1}`, v: r.v, how: r.how };
    });
    const cab = (q.cables || []);
    if (cab.length !== 3) err.push('Exactly three cables are needed: three unknown forces for three equations.');
    const dirs = cab.map((cb) => {
      if (cb.by === 'angles') {
        const u = [+cb.al, +cb.be, +cb.ga].map((a) => Math.cos(a * DEG)), s2 = u[0] ** 2 + u[1] ** 2 + u[2] ** 2;
        if (Math.abs(s2 - 1) > 0.002) { err.push(`Cable ${cb.name}: cos²α + cos²β + cos²γ = ${fmt(s2)}, but it must equal 1.`); return null; }
        return { u: mul(u, 1 / Math.sqrt(s2)), how: `u = cos ${fmt(+cb.al)}° i + cos ${fmt(+cb.be)}° j + cos ${fmt(+cb.ga)}° k`, end: null };
      }
      const B = [+cb.x, +cb.y, +cb.z], r = sub(B, A), L = mag(r);
      if (!(L > 0)) { err.push(`Cable ${cb.name}: the anchor is at the particle.`); return null; }
      return { u: mul(r, 1 / L), how: `r = ${vs(r)} ${Lu}, |r| = ${fmt(L)} ${Lu}`, end: B };
    });
    if (err.length) return fail(err);
    const S = Steps(), out = [];
    S.add({ t: 'Each force as a Cartesian vector', n: 'Each cable pulls the particle toward its anchor, along the unit vector u. The tensions are the unknowns.', table: { head: ['Force', 'Direction', 'u_x', 'u_y', 'u_z'], rows: cab.map((cb, i) => [`F_${cb.name}`, dirs[i].how, fmt(dirs[i].u[0]), fmt(dirs[i].u[1]), fmt(dirs[i].u[2])]).concat(K.map((k) => [k.name, k.how, fmt(k.v[0]), fmt(k.v[1]), fmt(k.v[2])])) } });
    const Ks = K.reduce((s, k) => add(s, k.v), [0, 0, 0]);
    const Amat = [0, 1, 2].map((i) => dirs.map((d) => d.u[i])), b = Ks.map((v) => -v);
    ['x', 'y', 'z'].forEach((ax, i) => S.add({ t: `Sum of forces along ${ax}`, f: `ΣF_${ax} = 0`, s: `${cab.map((cb, j) => `(${fmt(Amat[i][j])}) F_${cb.name}`).join(' + ')} ${Ks[i] < 0 ? '−' : '+'} ${fmt(Math.abs(Ks[i]))} = 0` }));
    const sol = linSolve(Amat, b);
    if (!sol.x) return fail('The three cables lie in one plane (or two are parallel), so they cannot hold a load out of that plane. Move one anchor.');
    const T = sol.x;
    S.add({ t: 'Solve the three equations together', r: cab.map((cb, i) => `F_${cb.name} = ${fmt(T[i])} ${F}`).join(', ') });
    const neg = cab.filter((cb, i) => T[i] < -1e-9 * Math.max(...T.map(Math.abs)));
    if (neg.length) return fail(neg.map((cb) => `Cable ${cb.name} would need to push (${fmt(T[cab.indexOf(cb)])} ${F}). A cable can only pull, so these cables cannot hold the load in this position.`));
    cab.forEach((cb, i) => out.push({ k: `Tension F_${cb.name}`, v: T[i], u: F, hl: true }));
    out.push({ k: 'Load at the particle (magnitude)', v: mag(Ks), u: F });
    return ok('Particle in equilibrium', out, S, { kind: 'particle3d', c, A, K: K.map((k) => ({ name: k.name, v: k.v })), cables: cab.map((cb, i) => ({ name: cb.name, u: dirs[i].u, end: dirs[i].end, T: T[i] })) });
  }
  const vs = (a) => `{${a.map((v, i) => (i === 0 ? fmt(v) : (v < 0 ? ' − ' : ' + ') + fmt(Math.abs(v))) + 'ijk'[i]).join('')}}`;

  /* ------------------------------------------------------------------ */
  /* Rigid body in two dimensions                                       */
  /* ------------------------------------------------------------------ */
  const LET = 'ABCDEFGH';
  /** Unknown reactions of each support, Hibbeler Table 5-1. ang is the direction of a roller's normal force, or of a cable or link. */
  function unknowns(sups, err) {
    const U = [];
    sups.forEach((sp, i) => {
      const L = LET[i], p = [+sp.x, +sp.y];
      if (!isFinite(p[0]) || !isFinite(p[1])) { err.push(`Support ${L}: enter its position.`); return; }
      const a = (+sp.ang || 0) * DEG, d = [Math.cos(a), Math.sin(a)];
      if (sp.type === 'pin') U.push({ name: `${L}_x`, sup: i, p, d: [1, 0] }, { name: `${L}_y`, sup: i, p, d: [0, 1] });
      else if (sp.type === 'fixed') U.push({ name: `${L}_x`, sup: i, p, d: [1, 0] }, { name: `${L}_y`, sup: i, p, d: [0, 1] }, { name: `M_${L}`, sup: i, p, m: true });
      else if (sp.type === 'roller') U.push({ name: `N_${L}`, sup: i, p, d, push: true });
      else if (sp.type === 'cable') U.push({ name: `T_${L}`, sup: i, p, d, pull: true });
      else U.push({ name: `F_${L}`, sup: i, p, d });
    });
    return U;
  }
  const crossz = (r, d) => r[0] * d[1] - r[1] * d[0];
  /** Coefficients of one unknown in ΣFx, ΣFy and ΣM about point c. */
  const coef = (u, eq) => (eq.kind === 'x' ? (u.m ? 0 : u.d[0]) : eq.kind === 'y' ? (u.m ? 0 : u.d[1]) : u.m ? 1 : crossz([u.p[0] - eq.c[0], u.p[1] - eq.c[1]], u.d));

  function rigid(st, c) {
    const q = st.rb, { F, Lu, FL } = c, err = [];
    const sups = q.supports || [];
    if (!sups.length) err.push('Add at least one support.');
    const unk = unknowns(sups, err);
    const loads = (q.loads || []).map((f, i) => { const r = comp2(f, `Force ${i + 1}`); if (r.err) { err.push(r.err); return null; } if (!isFinite(+f.x) || !isFinite(+f.y)) err.push(`Force ${i + 1}: enter where it acts.`); return Object.assign(r, { p: [+f.x, +f.y], name: `P${i + 1}` }); });
    const cps = (q.couples || []).map((m) => (m.dir === 'ccw' ? 1 : -1) * Math.abs(+m.M || 0));
    (q.dists || []).forEach((d, i) => { if (!(+d.x2 > +d.x1)) err.push(`Distributed load ${i + 1}: x₂ must be greater than x₁.`); });
    if (err.length) return fail(err);
    // distributed loads (vertical, along a horizontal line) become their resultants
    (q.dists || []).forEach((d, i) => {
      const L = d.x2 - d.x1, w1 = +d.w1, w2 = +d.w2, R = ((w1 + w2) / 2) * L;
      if (!R) return;
      const xb = d.x1 + (w1 + 2 * w2 === 0 ? L / 2 : (L * (w1 + 2 * w2)) / (3 * (w1 + w2)));
      loads.push({ Fx: 0, Fy: -R, F: Math.abs(R), p: [xb, +d.y || 0], name: `R${i + 1}`, how: `resultant of the distributed load: ½(${fmt(w1)} + ${fmt(w2)})(${fmt(L)}) = ${fmt(R)} ${F} at x = ${fmt(xb)} ${Lu}`, dist: true });
    });
    const S = Steps(), out = [], n = unk.length;
    S.add({ t: 'Free-body diagram and unknowns', n: 'Each support is replaced by the reactions it can give (Hibbeler Table 5-1): a roller gives one force normal to its surface, a pin two components, a fixed support two components and a couple, a cable a pull along the cable, and a link a force along the link. Reactions are assumed positive in the directions shown; a negative answer means the opposite direction.',
      table: { head: ['Unknown', 'Acts at', 'Direction'], rows: unk.map((u) => [u.name, `(${fmt(u.p[0])}, ${fmt(u.p[1])}) ${Lu}`, u.m ? '↺ couple' : `${fmt(((Math.atan2(u.d[1], u.d[0]) / DEG) + 360) % 360)}° from +x`]) } });
    if (loads.some((l) => l.dist)) S.add({ t: 'Distributed loads', n: 'Each distributed load is replaced by its resultant, acting through the centroid of its load diagram.', table: { head: ['Load', 'Resultant'], rows: loads.filter((l) => l.dist).map((l) => [l.name, l.how]) } });
    // equilibrium equations: A x = b for the unknown vector
    const Kx = loads.reduce((s, l) => s + l.Fx, 0), Ky = loads.reduce((s, l) => s + l.Fy, 0);
    const Mk = (cpt) => loads.reduce((s, l) => s + crossz([l.p[0] - cpt[0], l.p[1] - cpt[1]], [l.Fx, l.Fy]), 0) + cps.reduce((s, v) => s + v, 0);
    const O = [0, 0];
    const Arows = [unk.map((u) => coef(u, { kind: 'x' })), unk.map((u) => coef(u, { kind: 'y' })), unk.map((u) => coef(u, { kind: 'm', c: O }))], brows = [-Kx, -Ky, -Mk(O)];
    const scale = Math.max(1, ...loads.map((l) => l.F), ...cps.map(Math.abs));
    const sol = linSolve(Arows, brows);
    // determinacy
    let det;
    if (sol.rank < n) det = { cls: 'err', text: n > 3 ? 'Statically indeterminate' : 'Improperly constrained' };
    else if (!sol.consistent) det = { cls: 'err', text: 'Partially constrained' };
    else det = n < 3 ? { cls: 'warn', text: 'Partially constrained' } : { cls: 'ok', text: 'Statically determinate' };
    if (n > 3) {
      S.add({ t: 'Determinacy', r: `${n} unknown reactions but only 3 equations of equilibrium` });
      return Object.assign(fail(`Statically indeterminate: there are ${n} unknown reactions and only 3 equilibrium equations. Remove a support (or change a pin to a roller) to make the body determinate.`), { det });
    }
    if (sol.rank < n) {
      const par = unk.filter((u) => !u.m).every((u, i, a) => Math.abs(crossz(u.d, a[0].d)) < 1e-9);
      return Object.assign(fail(`Improperly constrained: the ${n} reactions ${par ? 'are all parallel' : 'all pass through one point'}, so they cannot resist ${par ? 'a force across their direction' : 'a moment about that point'}. The equations of equilibrium cannot be satisfied for every load. Change the direction or position of a support.`), { det });
    }
    if (!sol.consistent) return Object.assign(fail(`Partially constrained: with only ${n} reaction${n === 1 ? '' : 's'} the body cannot resist these loads, so it would move. Add a support.`), { det });
    const x = sol.x.map((v) => (Math.abs(v) < 1e-9 * scale ? 0 : v));
    // book-style order: equations that each bring in one new unknown, moments first
    const cands = [];
    sups.forEach((sp) => cands.push([+sp.x, +sp.y]));
    for (let i = 0; i < unk.length; i++) for (let j = i + 1; j < unk.length; j++) {
      const a = unk[i], b = unk[j]; if (a.m || b.m) continue;
      const den = crossz(a.d, b.d); if (Math.abs(den) < 1e-9) continue;
      const t = crossz([b.p[0] - a.p[0], b.p[1] - a.p[1]], b.d) / den; cands.push([a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t]);
    }
    const eqs = cands.map((cp) => ({ kind: 'm', c: cp })).concat([{ kind: 'x' }, { kind: 'y' }]);
    const solved = new Set(), used = [];
    let guard = 0;
    while (solved.size < n && guard++ < 10) {
      const pick = eqs.find((e) => !used.includes(e) && unk.filter((u, i) => !solved.has(i) && Math.abs(coef(u, e)) > 1e-9).length === 1);
      if (!pick) break;
      used.push(pick);
      const i = unk.findIndex((u, k) => !solved.has(k) && Math.abs(coef(u, pick)) > 1e-9);
      const terms = unk.map((u, k) => ({ u, k, a: coef(u, pick) })).filter((t) => Math.abs(t.a) > 1e-9);
      const kv = pick.kind === 'x' ? Kx : pick.kind === 'y' ? Ky : Mk(pick.c);
      const lhs = terms.map((t) => (t.k === i ? `(${fmt(t.a)}) ${t.u.name}` : `(${fmt(t.a)})(${fmt(x[t.k])})`)).join(' + ');
      const where = pick.kind === 'm' ? (sups.findIndex((sp) => Math.abs(sp.x - pick.c[0]) < 1e-9 && Math.abs(sp.y - pick.c[1]) < 1e-9)) : -1;
      S.add({ t: pick.kind === 'x' ? 'Sum of forces along x' : pick.kind === 'y' ? 'Sum of forces along y' : `Moments about ${where >= 0 ? 'point ' + LET[where] : `(${fmt(pick.c[0])}, ${fmt(pick.c[1])}) ${Lu}, where the lines of two unknowns meet`}`,
        f: pick.kind === 'x' ? '→+ ΣF_x = 0' : pick.kind === 'y' ? '+↑ ΣF_y = 0' : '↺+ ΣM = 0',
        n: pick.kind === 'm' ? 'This point removes every unknown except one from the equation.' : undefined,
        s: `${lhs}${Math.abs(kv) > 1e-12 * scale ? (kv < 0 ? ' − ' : ' + ') + fmt(Math.abs(kv)) : ''} = 0`, r: `${unk[i].name} = ${fmt(x[i])} ${unk[i].m ? FL : F}` });
      solved.add(i);
    }
    if (solved.size < n) S.add({ t: 'Solve the equations together', f: '→+ ΣF_x = 0;  +↑ ΣF_y = 0;  ↺+ ΣM_O = 0', n: 'No single equation isolates one unknown here, so the three equations are solved simultaneously.', r: unk.map((u, i) => `${u.name} = ${fmt(x[i])} ${u.m ? FL : F}`).join(', ') });
    // check with a moment about another point
    const chk = [cands[0][0] + 1.234, cands[0][1] - 0.567], res = unk.reduce((s, u, i) => s + coef(u, { kind: 'm', c: chk }) * x[i], 0) + Mk(chk);
    S.add({ t: 'Check', n: 'Moments about any other point must also add to zero.', r: `ΣM = ${fmt(Math.abs(res) < 1e-9 * scale * 10 ? 0 : res)} ≈ 0` });
    const warn = [];
    unk.forEach((u, i) => {
      if (u.pull && x[i] < -1e-9 * scale) warn.push(`${u.name} comes out negative: the cable would have to push, so it would go slack. A cable cannot hold this body in this position.`);
      if (u.push && x[i] < -1e-9 * scale) warn.push(`${u.name} comes out negative: a roller can only push, so the body would lift off at ${u.name.slice(2)}.`);
    });
    if (n < 3) warn.push('Partially constrained: these supports hold the body only because the loads happen to have no component they cannot resist.');
    const tf = unk.filter((u) => !u.m).length;
    if (n === 2 && tf === 2 && !loads.length && cps.length === 0) warn.push('No loads: every reaction is zero.');
    unk.forEach((u, i) => out.push({ k: `${u.name}${u.m ? ' (↺ positive)' : ''}`, v: x[i], u: u.m ? FL : F, hl: true }));
    // resultant reaction at pins
    sups.forEach((sp, j) => { if (sp.type === 'pin' || sp.type === 'fixed') { const ix = unk.findIndex((u) => u.name === `${LET[j]}_x`), iy = ix + 1; out.push({ k: `Resultant at ${LET[j]}, F_${LET[j]}`, v: Math.hypot(x[ix], x[iy]), u: F }); } });
    // two-force and three-force member notes
    const nForcesPts = new Set(loads.map((l) => l.p.join(',')).concat(sups.map((sp) => `${sp.x},${sp.y}`)));
    if (!cps.length && nForcesPts.size === 2 && sups.length + loads.length >= 2) S.add({ t: 'Two-force member', n: 'Forces act at only two points and there is no couple, so the two resultant forces must be equal, opposite and collinear, along the line joining those points.' });
    else if (!cps.length && nForcesPts.size === 3 && sups.every((sp) => sp.type !== 'fixed')) S.add({ t: 'Three-force member', n: 'Forces act at only three points and there is no couple, so their lines of action meet at one point (or are parallel).' });
    return ok(det.text, out, S, { kind: 'rigid', c, outline: (q.outline || []).map((p) => [+p.x, +p.y]), sups: sups.map((sp, i) => ({ type: sp.type, p: [+sp.x, +sp.y], ang: +sp.ang || 0, L: LET[i] })), unk: unk.map((u, i) => ({ name: u.name, p: u.p, d: u.d, m: !!u.m, v: x[i], type: u.sup != null && sups[u.sup] ? sups[u.sup].type : '' })), loads: loads.map((l) => ({ p: l.p, v: [l.Fx, l.Fy], F: l.F, dist: !!l.dist, name: l.name })), dists: (q.dists || []).map((d) => ({ x1: +d.x1, x2: +d.x2, y: +d.y || 0, w1: +d.w1, w2: +d.w2 })), couples: (q.couples || []).map((m, i) => ({ M: cps[i], p: [+m.x || 0, +m.y || 0] })) }, warn, det.cls === 'warn' ? 'warn' : 'ok');
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['x', 'y', 'z', 'x1', 'x2']), FOR = new Set(['F', 'Fx', 'Fy', 'Fz', 'P']), MOM = new Set(['M']), DIS = new Set(['w1', 'w2', 'k']);
  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, tidy, UNITS } = Core;
    const l0 = UNITS[from].len, l1 = UNITS[to].len, f0 = st.fu, f1 = twin(st.fu, to);
    const kL = convert(1, l0, l1), kF = convert(1, f0, f1), kM = convert(1, from === 'SI' ? 'kg' : 'slug', to === 'SI' ? 'kg' : 'slug');
    const walk = (o) => {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach((k) => {
        const v = o[k];
        if (typeof v === 'number') {
          if (LEN.has(k)) o[k] = tidy(v * kL, 8); else if (FOR.has(k)) o[k] = tidy(v * kF, 8);
          else if (MOM.has(k)) o[k] = tidy(v * kF * kL, 8); else if (DIS.has(k)) o[k] = tidy((v * kF) / kL, 8); else if (k === 'm') o[k] = tidy(v * kM, 8);
        } else walk(v);
      });
    };
    ['pa', 'p3', 'rb'].forEach((k) => walk(st[k]));
    st.fu = f1;
    return st;
  }

  const Equil = { defaults, solve, convertState, unknowns };
  root.Equil = Equil;
  if (typeof module !== 'undefined' && module.exports) module.exports = Equil;
})(typeof window !== 'undefined' ? window : globalThis);
