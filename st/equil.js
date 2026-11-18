/* =====================================================================
 * STATICS · Equilibrium (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapters 3 and 5.
 *   particle   coplanar particle: two unknown magnitudes, or one magnitude and one angle (3.3)
 *   particle3d particle held by three cables in space (3.4)
 *   rigid      2D rigid body on pins, rollers, fixed supports, cables and links (5.1 to 5.4)
 *   rigid3d    rigid body in space on ball-and-socket joints, journal and thrust bearings, hinges,
 *              cables, smooth surfaces, links and fixed supports (5.5 to 5.7, Table 5-2)
 *   frame      frames, machines and compound beams (6.6): members joined by pins, each member a rigid
 *              body with three equations; the pin forces and support reactions are solved together
 * Particles and plane rigid bodies can also give the largest load: when every load is scaled by the
 * same factor, the factor that brings the most heavily loaded cable or support to its capacity.
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
      r3: {
        members: [{ x1: -2, y1: 0, z1: 0, x2: 2, y2: -4, z2: 0 }, { x1: 2, y1: -4, z1: 0, x2: 2, y2: 4, z2: 0 }, { x1: 2, y1: 4, z1: 0, x2: -2, y2: 0, z2: 0 }],
        supports: [{ type: 'ball', name: 'A', x: -2, y: 0, z: 0, ax: 'z', bx: 0, by: 0, bz: 0 }, { type: 'cable', name: 'BD', x: 2, y: -4, z: 0, ax: 'z', bx: 0, by: 0, bz: 6 }, { type: 'cable', name: 'CD', x: 2, y: 4, z: 0, ax: 'z', bx: 0, by: 0, bz: 6 }],
        loads: [{ kind: 'force', m: 10, Fx: 0, Fy: 0, Fz: -150, x: 1, y: 0, z: 0 }],
        couples: [],
      },
      fm: {
        points: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: 1.5, y: 0 }, { name: 'C', x: 3, y: 0 }, { name: 'E', x: 3.3, y: 0 }, { name: 'G', x: 3, y: 0.3 }, { name: 'D', x: 0, y: 2 }],
        members: [{ name: 'AC', pts: 'A B C E G' }, { name: 'BD', pts: 'B D' }],
        supports: [{ at: 'A', type: 'pin', ang: 90, mem: '' }, { at: 'D', type: 'pin', ang: 90, mem: '' }],
        loads: [{ mem: '', at: 'G', by: 'comp', Fx: -6, Fy: 0, F: 6, ang: 180, dx: 4, dy: 3 }, { mem: '', at: 'C', by: 'comp', Fx: 0, Fy: -6, F: 6, ang: 270, dx: 4, dy: 3 }, { mem: '', at: 'E', by: 'comp', Fx: 0, Fy: -6, F: 6, ang: 270, dx: 4, dy: 3 }],
        couples: [], dists: [], sel: '',
      },
      cap: { on: false, T: 500, sup: [] },
    };
  }
  const gOf = (U) => (U.id === 'US' ? 32.2 : 9.81);
  /** Weight m·g in the chosen force unit. */
  function weight(m, U, fu) { const Wbase = m * gOf(U); return U.id === 'US' ? Core.convert(Wbase, 'lb', fu) : Core.convert(Wbase, 'N', fu); }
  const ok = (text, out, S, geo, warn, cls) => ({ ok: true, err: [], warn: warn || [], status: { cls: cls || 'ok', text }, out, steps: S.list, geo });

  function solve(st, U) {
    const c = { F: st.fu, Lu: U.len, FL: `${st.fu}·${U.len}`, U };
    if (st.mode === 'rigid') return capWrap(rigid(st, c), st, c);
    if (st.mode === 'rigid3d') return capWrap(rigid3d(st, c), st, c);
    if (st.mode === 'particle3d') return capWrap(particle3d(st, c), st, c);
    if (st.mode === 'particle') return capWrap(particle(st, c), st, c);
    if (st.mode === 'frame') return frame(st, c);
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
      const L = sp.name || LET[i], p = [+sp.x, +sp.y];
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
      S.add({ t: pick.kind === 'x' ? 'Sum of forces along x' : pick.kind === 'y' ? 'Sum of forces along y' : `Moments about ${where >= 0 ? 'point ' + (sups[where].name || LET[where]) : `(${fmt(pick.c[0])}, ${fmt(pick.c[1])}) ${Lu}, where the lines of two unknowns meet`}`,
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
    sups.forEach((sp, j) => { if (sp.type === 'pin' || sp.type === 'fixed') { const Lj = sp.name || LET[j], ix = unk.findIndex((u) => u.name === `${Lj}_x`), iy = ix + 1; out.push({ k: `Resultant at ${Lj}, F_${Lj}`, v: Math.hypot(x[ix], x[iy]), u: F }); } });
    // two-force and three-force member notes
    const nForcesPts = new Set(loads.map((l) => l.p.join(',')).concat(sups.map((sp) => `${sp.x},${sp.y}`)));
    if (!cps.length && nForcesPts.size === 2 && sups.length + loads.length >= 2) S.add({ t: 'Two-force member', n: 'Forces act at only two points and there is no couple, so the two resultant forces must be equal, opposite and collinear, along the line joining those points.' });
    else if (!cps.length && nForcesPts.size === 3 && sups.every((sp) => sp.type !== 'fixed')) S.add({ t: 'Three-force member', n: 'Forces act at only three points and there is no couple, so their lines of action meet at one point (or are parallel).' });
    return ok(det.text, out, S, { kind: 'rigid', c, outline: (q.outline || []).map((p) => [+p.x, +p.y]), sups: sups.map((sp, i) => ({ type: sp.type, p: [+sp.x, +sp.y], ang: +sp.ang || 0, L: sp.name || LET[i] })), unk: unk.map((u, i) => ({ name: u.name, p: u.p, d: u.d, m: !!u.m, v: x[i], type: u.sup != null && sups[u.sup] ? sups[u.sup].type : '' })), loads: loads.map((l) => ({ p: l.p, v: [l.Fx, l.Fy], F: l.F, dist: !!l.dist, name: l.name })), dists: (q.dists || []).map((d) => ({ x1: +d.x1, x2: +d.x2, y: +d.y || 0, w1: +d.w1, w2: +d.w2 })), couples: (q.couples || []).map((m, i) => ({ M: cps[i], p: [+m.x || 0, +m.y || 0] })) }, warn, det.cls === 'warn' ? 'warn' : 'ok');
  }


  /* ------------------------------------------------------------------ */
  /* Rigid body in three dimensions                                     */
  /* ------------------------------------------------------------------ */
  const AXI = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const perp = (ax) => ['x', 'y', 'z'].filter((k) => k !== ax);
  const S3 = {
    ball: 'ball-and-socket joint', cable: 'cable', smooth: 'smooth surface or roller', link: 'short link or strut', journal: 'journal bearing (forces only)', journalM: 'journal bearing with couple moments',
    thrust: 'thrust bearing, hinge or pin (forces only)', thrustM: 'thrust bearing, hinge or pin with couple moments', collar: 'collar on a square rod', fixed: 'fixed support',
  };

  /* ------------------------------------------------------------------ */
  /* Frames, machines and compound beams (6.6)                          */
  /* ------------------------------------------------------------------ */
  function frame(st, c) {
    const q = st.fm, { F, Lu, FL } = c, err = [], idx = {};
    const P = (q.points || []).map((p, i) => {
      const name = String(p.name || '').trim() || LET[i];
      if (idx[name] !== undefined) err.push(`Two points are named ${name}.`);
      idx[name] = i;
      if (!isFinite(+p.x) || !isFinite(+p.y)) err.push(`Point ${name}: enter its coordinates.`);
      return { name, x: +p.x, y: +p.y };
    });
    const Mb = (q.members || []).map((m, i) => {
      const nm = String(m.name || '').trim() || `M${i + 1}`, pts = String(m.pts || '').trim().split(/[\s,]+/).filter(Boolean);
      const ix = pts.map((t) => { if (idx[t] === undefined) err.push(`Member ${nm}: there is no point ${t}.`); return idx[t]; });
      if (pts.length < 2) err.push(`Member ${nm}: list at least two of its points.`);
      return { name: nm, pts: ix, loads: [], cps: [] };
    });
    if (Mb.length < 1) err.push('Add the members.');
    if (err.length) return fail([...new Set(err)]);
    const memOf = (ptName, memName, what) => {
      const pi = idx[ptName]; if (pi === undefined) { err.push(`${what}: there is no point ${ptName}.`); return null; }
      if (memName) { const k = Mb.findIndex((m) => m.name === memName); if (k < 0) { err.push(`${what}: there is no member ${memName}.`); return null; } if (!Mb[k].pts.includes(pi)) { err.push(`${what}: point ${ptName} is not on member ${memName}.`); return null; } return k; }
      const k = Mb.findIndex((m) => m.pts.includes(pi)); if (k < 0) { err.push(`${what}: point ${ptName} is not on any member.`); return null; } return k;
    };
    // unknowns: support reactions, then the pin forces at points shared by two or more members
    const sups = (q.supports || []).map((sp, i) => ({ name: sp.at, type: sp.type, x: P[idx[sp.at]] ? P[idx[sp.at]].x : NaN, y: P[idx[sp.at]] ? P[idx[sp.at]].y : NaN, ang: sp.ang, mem: memOf(sp.at, sp.mem, `Support ${i + 1}`) }));
    if (!sups.length) err.push('Add the supports.');
    const unk = unknowns(sups, err);
    unk.forEach((u) => { u.on = [[sups[u.sup].mem, 1]]; u.kind = 'support'; });
    const pins = [];
    P.forEach((p, i) => {
      const ms = Mb.map((m, k) => k).filter((k) => Mb[k].pts.includes(i));
      if (ms.length < 2) return;
      pins.push({ pt: i, ms });
      ms.slice(1).forEach((k) => {
        const tag = ms.length > 2 ? ` (on ${Mb[k].name})` : '';
        [['x', [1, 0]], ['y', [0, 1]]].forEach(([a, d]) => unk.push({ name: `${p.name}_${a}${tag}`, p: [p.x, p.y], d, on: [[k, 1], [ms[0], -1]], kind: 'pin', pin: i, mk: k, m0: ms[0] }));
      });
    });
    (q.loads || []).forEach((f, i) => {
      const k = memOf(f.at, f.mem, `Load ${i + 1}`); if (k === null) return;
      const r = comp2(f, `Load ${i + 1}`); if (r.err) { err.push(r.err); return; }
      const p = P[idx[f.at]]; Mb[k].loads.push({ Fx: r.Fx, Fy: r.Fy, F: r.F, p: [p.x, p.y], at: f.at, name: `P${i + 1}` });
    });
    (q.couples || []).forEach((m, i) => {
      const k = Mb.findIndex((b) => b.name === m.mem); if (k < 0) { err.push(`Couple ${i + 1}: pick its member.`); return; }
      Mb[k].cps.push((m.dir === 'ccw' ? 1 : -1) * Math.abs(+m.M || 0));
    });
    const dists = [];
    (q.dists || []).forEach((d, i) => {
      const k = Mb.findIndex((b) => b.name === d.mem); if (k < 0) { err.push(`Distributed load ${i + 1}: pick its member.`); return; }
      const a = P[idx[d.from]], b = P[idx[d.to]]; if (!a || !b) { err.push(`Distributed load ${i + 1}: pick the points where it starts and ends.`); return; }
      const L = Math.abs(b.x - a.x); if (!(L > 0)) { err.push(`Distributed load ${i + 1}: its two points must be at different x (the load is vertical, per horizontal length).`); return; }
      const w1 = +d.w1, w2 = +d.w2, R = ((w1 + w2) / 2) * L, x1 = Math.min(a.x, b.x), wl = a.x < b.x ? w1 : w2, wr = a.x < b.x ? w2 : w1;
      const xb = x1 + (wl + wr === 0 ? L / 2 : (L * (wl + 2 * wr)) / (3 * (wl + wr))), t = (xb - a.x) / (b.x - a.x), yb = a.y + t * (b.y - a.y);
      if (R) Mb[k].loads.push({ Fx: 0, Fy: -R, F: Math.abs(R), p: [xb, yb], name: `R${i + 1}`, dist: true, how: `½(${fmt(w1)} + ${fmt(w2)})(${fmt(L)}) = ${fmt(R)} ${F} at x = ${fmt(xb)} ${Lu}` });
      dists.push({ k, a: [a.x, a.y], b: [b.x, b.y], w1, w2 });
    });
    if (err.length) return fail([...new Set(err)]);
    const nm = Mb.length, n = unk.length, S = Steps(), out = [], warn = [];
    // two-force members: two points, no loads or couples on them, and no support at an end
    Mb.forEach((m) => { m.two = m.pts.length === 2 && !m.loads.length && !m.cps.length && !sups.some((sp) => sp.mem === Mb.indexOf(m) && sp.type === 'fixed'); });
    S.add({ t: 'Members and connections', n: 'The frame is taken apart into its members. Where two members share a point they are joined by a pin, which pushes on one member with components (P_x, P_y) and on the other with the equal and opposite components (Newton\'s third law). A member with only two pins and no load on it is a two-force member: its two forces act along the line joining the pins.',
      table: { head: ['Member', 'Points', 'Note'], rows: Mb.map((m) => [m.name, m.pts.map((i) => P[i].name).join(', '), m.two ? 'two-force member' : `${m.loads.length} load${m.loads.length === 1 ? '' : 's'}${m.cps.length ? `, ${m.cps.length} couple${m.cps.length > 1 ? 's' : ''}` : ''}`]) } });
    if (Mb.some((m) => m.loads.some((l) => l.dist))) S.add({ t: 'Distributed loads', n: 'Each is replaced by its resultant on the member it acts on.', table: { head: ['Member', 'Load', 'Resultant'], rows: [].concat(...Mb.map((m) => m.loads.filter((l) => l.dist).map((l) => [m.name, l.name, l.how]))) } });
    S.add({ t: 'Unknowns and equations', f: 'unknowns = 3 × (number of members)', s: `${n} unknowns (${unk.filter((u) => u.kind === 'support').length} support reactions and ${unk.filter((u) => u.kind === 'pin').length} pin components);  3 × ${nm} = ${3 * nm} equations` });
    if (n > 3 * nm) return fail(`Statically indeterminate: ${n} unknowns but only ${3 * nm} equations (three for each member). Remove a support or change a pin support to a roller.`);
    if (n < 3 * nm) return fail(`The frame can move: only ${n} unknowns for ${3 * nm} equations. It needs more supports, or the members are joined so that they form a mechanism.`);
    const A = [], b = [];
    Mb.forEach((m, k) => {
      const O = [P[m.pts[0]].x, P[m.pts[0]].y];
      [{ kind: 'x' }, { kind: 'y' }, { kind: 'm', c: O }].forEach((eq) => {
        A.push(unk.map((u) => u.on.reduce((s2, [mk, sg]) => s2 + (mk === k ? sg * coef(u, eq) : 0), 0)));
        const kv = eq.kind === 'x' ? m.loads.reduce((s2, l) => s2 + l.Fx, 0) : eq.kind === 'y' ? m.loads.reduce((s2, l) => s2 + l.Fy, 0) : m.loads.reduce((s2, l) => s2 + crossz([l.p[0] - O[0], l.p[1] - O[1]], [l.Fx, l.Fy]), 0) + m.cps.reduce((s2, v) => s2 + v, 0);
        b.push(-kv);
      });
    });
    const sol = linSolve(A, b);
    if (sol.rank < n || !sol.x) return fail('The supports and pins are arranged so that the frame (or one of its members) can still move: for example, three pins in a line, or supports whose reactions are all parallel. Change a support or a connection.');
    const scale = Math.max(1, ...[].concat(...Mb.map((m) => m.loads.map((l) => l.F))));
    const x = sol.x.map((v) => (Math.abs(v) < 1e-9 * scale ? 0 : v));
    unk.forEach((u, i) => (u.v = x[i]));
    // book-style steps: each member's free-body diagram with its three equations
    const order = Mb.map((m, k) => k).sort((a, b2) => (Mb[b2].two ? 1 : 0) - (Mb[a].two ? 1 : 0));
    order.forEach((k) => {
      const m = Mb[k], O = P[m.pts[0]], on = unk.map((u, i) => ({ u, i, sg: u.on.reduce((s2, [mk, sg]) => s2 + (mk === k ? sg : 0), 0) })).filter((t) => t.sg);
      const eqTxt = (eq, lbl) => {
        const terms = on.map((t) => ({ t, a: t.sg * coef(t.u, eq) })).filter((z) => Math.abs(z.a) > 1e-12).map((z) => `(${fmt(z.a)}) ${z.t.u.name}`);
        const kv = eq.kind === 'x' ? m.loads.reduce((s2, l) => s2 + l.Fx, 0) : eq.kind === 'y' ? m.loads.reduce((s2, l) => s2 + l.Fy, 0) : m.loads.reduce((s2, l) => s2 + crossz([l.p[0] - eq.c[0], l.p[1] - eq.c[1]], [l.Fx, l.Fy]), 0) + m.cps.reduce((s2, v) => s2 + v, 0);
        let s2 = terms.join(' + ') || '0'; if (Math.abs(kv) > 1e-12 * scale) s2 += kv < 0 ? ` − ${fmt(-kv)}` : ` + ${fmt(kv)}`;
        return `${lbl}: ${s2} = 0`;
      };
      S.add({ t: `Member ${m.name}${m.two ? ' (two-force member)' : ''}`, f: `→+ ΣF_x = 0;  +↑ ΣF_y = 0;  ↺+ ΣM_${O.name} = 0`,
        n: `Free-body diagram of ${m.name}: ${on.map((t) => (t.sg < 0 ? `−${t.u.name}` : t.u.name)).join(', ')}${m.loads.length ? ` and ${m.loads.length} load${m.loads.length > 1 ? 's' : ''}` : ''}. A pin force drawn on the other member acts here with the opposite sign.`,
        s: [eqTxt({ kind: 'x' }, 'ΣF_x'), eqTxt({ kind: 'y' }, 'ΣF_y'), eqTxt({ kind: 'm', c: [O.x, O.y] }, `ΣM_${O.name}`)].join(';   '),
        r: on.map((t) => `${t.u.name} = ${fmt(t.u.v)} ${t.u.m ? FL : F}`).join(';  '), mem: k });
    });
    S.add({ t: 'Solving', n: `The ${3 * nm} equations are solved together for the ${n} unknowns (a negative value means the component acts opposite to the direction assumed: +x or +y on the member named, or along the support's direction).` });
    unk.filter((u) => u.kind === 'support').forEach((u) => out.push({ k: u.name, v: u.v, u: u.m ? FL : F, hl: true }));
    pins.forEach((pn) => pn.ms.slice(1).forEach((k) => {
      const ux = unk.find((u) => u.kind === 'pin' && u.pin === pn.pt && u.mk === k && u.d[0] === 1), uy = unk.find((u) => u.kind === 'pin' && u.pin === pn.pt && u.mk === k && u.d[1] === 1);
      out.push({ k: `${ux.name} on ${Mb[k].name}`, v: ux.v, u: F, hl: true }, { k: `${uy.name} on ${Mb[k].name}`, v: uy.v, u: F, hl: true }, { k: `Pin ${P[pn.pt].name}: resultant${pn.ms.length > 2 ? ` on ${Mb[k].name}` : ''}`, v: Math.hypot(ux.v, uy.v), u: F });
    }));
    unk.forEach((u) => { if (u.kind === 'support' && sups[u.sup].type === 'roller' && u.v < -1e-9 * scale) warn.push(`${u.name} comes out negative: a roller or rocker can only push, so the frame would lift off at ${sups[u.sup].name} unless it is held down.`); });
    return ok(`Frame solved: ${nm} member${nm > 1 ? 's' : ''}, ${n} unknowns`, out, S, { kind: 'frame', c, P, Mb, unk, sups, pins, dists }, warn, warn.length ? 'warn' : 'ok');
  }
  function unknowns3(sups, err) {
    const U = [];
    sups.forEach((sp, i) => {
      const L = sp.name || LET[i], p = [+sp.x, +sp.y, +sp.z], ax = sp.ax || 'z';
      if (p.some((v) => !isFinite(v))) { err.push(`Support ${L}: enter its position.`); return; }
      const F = (k) => U.push({ name: `${L}_${k}`, sup: i, p, d: AXI[k] }), Mo = (k) => U.push({ name: `(M_${L})_${k}`, sup: i, p, d: AXI[k], m: true });
      const t = sp.type;
      if (t === 'cable' || t === 'link' || t === 'smooth') {
        const r = t === 'smooth' ? [+sp.bx, +sp.by, +sp.bz] : sub([+sp.bx, +sp.by, +sp.bz], p), Lr = mag(r);
        if (!(Lr > 0)) { err.push(`Support ${L}: ${t === 'smooth' ? 'enter the direction of the push (its components)' : 'the other end must be a different point'}.`); return; }
        U.push({ name: `${t === 'cable' ? 'T' : t === 'smooth' ? 'N' : 'F'}_${L}`, sup: i, p, d: mul(r, 1 / Lr), pull: t === 'cable', push: t === 'smooth', end: t === 'smooth' ? null : [+sp.bx, +sp.by, +sp.bz] });
      } else if (t === 'ball' || t === 'thrust') ['x', 'y', 'z'].forEach(F);
      else if (t === 'journal') perp(ax).forEach(F);
      else if (t === 'journalM') { perp(ax).forEach(F); perp(ax).forEach(Mo); }
      else if (t === 'thrustM') { ['x', 'y', 'z'].forEach(F); perp(ax).forEach(Mo); }
      else if (t === 'collar') { perp(ax).forEach(F); ['x', 'y', 'z'].forEach(Mo); }
      else { ['x', 'y', 'z'].forEach(F); ['x', 'y', 'z'].forEach(Mo); }
    });
    return U;
  }
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function rigid3d(st, c) {
    const q = st.r3, { F, Lu, FL } = c, err = [];
    const sups = q.supports || [];
    if (!sups.length) err.push('Add at least one support.');
    const unk = unknowns3(sups, err);
    const loads = (q.loads || []).map((l, i) => {
      const p = [+l.x, +l.y, +l.z]; if (p.some((v) => !isFinite(v))) err.push(`Load ${i + 1}: enter where it acts.`);
      if (l.kind === 'mass') { if (!(+l.m > 0)) { err.push(`Load ${i + 1}: the mass must be greater than zero.`); return null; } const W = weight(+l.m, c.U, F); return { name: `W${i + 1}`, v: [0, 0, -W], p, how: `W = mg = ${fmt(+l.m)}(${fmt(gOf(c.U))}) = ${fmt(W)} ${F}, along −z` }; }
      const v = [+l.Fx, +l.Fy, +l.Fz]; if (v.some((x) => !isFinite(x))) { err.push(`Load ${i + 1}: enter its three components.`); return null; }
      return { name: `F${i + 1}`, v, p, how: `F = ${vs(v)} ${F}` };
    });
    const cps = (q.couples || []).map((m, i) => { const v = [+m.Mx, +m.My, +m.Mz]; if (v.some((x) => !isFinite(x))) err.push(`Couple ${i + 1}: enter its three components.`); return v; });
    if (err.length) return fail(err);
    const n = unk.length, S = Steps(), out = [];
    const P0 = unk.length ? unk[0].p : [0, 0, 0];
    S.add({ t: 'Free-body diagram and unknowns', n: 'Each support is replaced by the reactions it can give (Hibbeler Table 5-2): a ball-and-socket joint or a thrust bearing, hinge or pin gives three force components; a journal bearing gives the two force components across its shaft (and two couple moments if it is not aligned with other bearings); a cable pulls along the cable, a smooth surface pushes along its normal, and a fixed support gives three forces and three couple moments. Each unknown is assumed positive along +x, +y, +z or along its cable; a negative answer means the opposite sense.',
      table: { head: ['Unknown', 'Support', 'Acts at', 'Along'], rows: unk.map((u) => [u.name, S3[sups[u.sup].type], `(${u.p.map(fmt).join(', ')}) ${Lu}`, `${u.m ? 'couple about ' : ''}${vs(u.d.map((v) => +v.toFixed(4)))}`]) } });
    const Ks = loads.reduce((sm, l) => add(sm, l.v), [0, 0, 0]);
    const Mk = (cpt) => add(loads.reduce((sm, l) => add(sm, cross3(sub(l.p, cpt), l.v)), [0, 0, 0]), cps.reduce((sm, v) => add(sm, v), [0, 0, 0]));
    if (loads.length || cps.length) S.add({ t: 'Loads as Cartesian vectors', n: `Moments of the loads are taken about the point (${P0.map(fmt).join(', ')}) ${Lu}, where the first support is, so that its reactions drop out of the moment equations: M = r × F.`,
      table: { head: ['Load', 'Vector', 'Acts at', `r × F (${FL})`], rows: loads.map((l) => [l.name, l.how, `(${l.p.map(fmt).join(', ')})`, vs(cross3(sub(l.p, P0), l.v))]).concat(cps.map((v, i) => [`M${i + 1}`, `couple ${vs(v)} ${FL}`, '—', vs(v)])) } });
    const col = (u, P) => (u.m ? [0, 0, 0].concat(u.d) : u.d.concat(cross3(sub(u.p, P), u.d)));
    const A = [0, 1, 2, 3, 4, 5].map((k) => unk.map((u) => col(u, P0)[k])), Mo = Mk(P0), b = [-Ks[0], -Ks[1], -Ks[2], -Mo[0], -Mo[1], -Mo[2]];
    const scale = Math.max(1, ...loads.map((l) => mag(l.v)), ...cps.map(mag));
    const eqn = (k) => { const terms = unk.map((u, j) => ({ a: A[k][j], n: u.name })).filter((t) => Math.abs(t.a) > 1e-9); const kv = -b[k]; return `${terms.length ? terms.map((t, j) => `${j ? (t.a < 0 ? ' − ' : ' + ') : t.a < 0 ? '−' : ''}${Math.abs(Math.abs(t.a) - 1) < 1e-12 ? '' : fmt(Math.abs(t.a))} ${t.n}`).join('') : '0'}${Math.abs(kv) > 1e-12 * scale ? (kv < 0 ? ' − ' : ' + ') + fmt(Math.abs(kv)) : ''} = 0`; };
    ['x', 'y', 'z'].forEach((ax, k) => S.add({ t: `Sum of forces along ${ax}`, f: `ΣF_${ax} = 0`, s: eqn(k) }));
    ['x', 'y', 'z'].forEach((ax, k) => S.add({ t: `Sum of moments about the ${ax} axis through (${P0.map(fmt).join(', ')})`, f: `ΣM_${ax} = 0`, s: eqn(k + 3) }));
    if (n > 6) return Object.assign(fail(`Statically indeterminate: there are ${n} unknown reactions and only 6 equilibrium equations. Use bearings that give forces only, or remove a support.`), { det: { cls: 'err', text: 'Statically indeterminate' } });
    const sol = linSolve(A, b);
    if (sol.rank < n) return Object.assign(fail('Improperly constrained: the supports cannot fix the body, because some of their reactions are parallel or all pass through one axis (the equations cannot be solved for every unknown). Change a support or its direction.'), { det: { cls: 'err', text: 'Improperly constrained' } });
    if (!sol.consistent) return Object.assign(fail(`Partially constrained: with only ${n} reactions the body cannot resist these loads (one of the six equations cannot be satisfied), so it would move. Add a support or a couple-moment reaction.`), { det: { cls: 'err', text: 'Partially constrained' } });
    const x = sol.x.map((v) => (Math.abs(v) < 1e-9 * scale ? 0 : v));
    S.add({ t: `Solve the ${n < 6 ? `${n} independent` : 'six'} equations together`, n: n < 6 ? `Only ${n} of the six equations are independent here; the other is satisfied by the loads as given.` : undefined, r: unk.map((u, i) => `${u.name} = ${fmt(x[i])} ${u.m ? FL : F}`).join(', ') });
    const chk = [P0[0] + 1.37, P0[1] - 0.61, P0[2] + 0.89], rc = add(unk.reduce((sm, u, i) => add(sm, u.m ? mul(u.d, x[i]) : cross3(sub(u.p, chk), mul(u.d, x[i]))), [0, 0, 0]), Mk(chk));
    S.add({ t: 'Check', n: 'Moments about any other point must also add to zero.', r: `ΣM = ${vs(rc.map((v) => (Math.abs(v) < 1e-8 * scale * 10 ? 0 : v)))} ≈ 0` });
    const warn = [];
    unk.forEach((u, i) => {
      if (u.pull && x[i] < -1e-9 * scale) warn.push(`${u.name} comes out negative: the cable would have to push, so it would go slack.`);
      if (u.push && x[i] < -1e-9 * scale) warn.push(`${u.name} comes out negative: a smooth surface can only push, so the body would lift off there.`);
    });
    if (n < 6) warn.push(`Only ${n} reactions: the body is held for these loads, but a load along the free direction would move it.`);
    unk.forEach((u, i) => out.push({ k: u.name, v: x[i], u: u.m ? FL : F, hl: true }));
    sups.forEach((sp, j) => { const L = sp.name || LET[j], fs = unk.map((u, i) => [u, x[i]]).filter(([u]) => u.sup === j && !u.m && !u.pull && !u.push && !/^F_/.test(u.name)); if (fs.length > 1) out.push({ k: `Resultant force at ${L}`, v: Math.hypot(...fs.map((t) => t[1])), u: F }); });
    return ok(n === 6 ? 'Statically determinate' : 'Solved (partially constrained)', out, S, { kind: 'rigid3d', c, members: (q.members || []).map((m) => [[+m.x1, +m.y1, +m.z1], [+m.x2, +m.y2, +m.z2]]), sups: sups.map((sp, i) => ({ type: sp.type, p: [+sp.x, +sp.y, +sp.z], L: sp.name || LET[i], ax: sp.ax })), unk: unk.map((u, i) => ({ name: u.name, p: u.p, d: u.d, m: !!u.m, v: x[i], end: u.end })), loads: loads.map((l) => ({ name: l.name, p: l.p, v: l.v })), couples: cps }, warn, n === 6 ? 'ok' : 'warn');
  }

  /* ------------------------------------------------------------------ */
  /* Largest load from cable or support capacities                      */
  /* ------------------------------------------------------------------ */
  /** All loads scale with one factor λ; each unknown force scales with it, so λ = min(capacity / |force|). */
  function capWrap(r, st, c) {
    const cp = st.cap; if (!r.ok || !cp || !cp.on) return r;
    const { F } = c, g = r.geo, items = [];
    if (g.kind === 'particle') g.U.forEach((u, i) => items.push({ name: u.name, f: Math.abs(u.F), cap: +cp.T }));
    else if (g.kind === 'particle3d') g.cables.forEach((cb) => items.push({ name: `F_${cb.name}`, f: Math.abs(cb.T), cap: +cp.T }));
    else {
      const list = g.kind === 'rigid' ? g.sups : g.sups;
      list.forEach((sp, j) => {
        const capj = cp.sup && +cp.sup[j] > 0 ? +cp.sup[j] : +cp.T; if (!(capj > 0)) return;
        const fs = g.unk.filter((u) => !u.m && (g.kind === 'rigid' ? u.p[0] === sp.p[0] && u.p[1] === sp.p[1] : u.p.every((v, k) => v === sp.p[k])) && u.name.indexOf(sp.L) >= 0);
        if (!fs.length) return;
        items.push({ name: fs.length > 1 ? `resultant at ${sp.L}` : fs[0].name, f: Math.hypot(...fs.map((u) => u.v)), cap: capj });
      });
    }
    const S = { list: r.steps };
    const used = items.filter((it) => it.cap > 0 && it.f > 1e-12);
    if (!(+cp.T > 0) && !used.length) return Object.assign(fail('Enter the largest force a cable or support can carry.'));
    if (!used.length) return r;
    const lam = Math.min(...used.map((it) => it.cap / it.f)), gov = used.find((it) => it.cap / it.f === lam);
    r.steps.push({ t: 'Largest load', f: 'λ = smallest of (capacity / force) over the members', n: 'Equilibrium is linear: if every load is multiplied by λ, every reaction is multiplied by λ too. The member that reaches its capacity first sets λ.',
      table: { head: ['Member', `Force for the loads entered (${F})`, `Capacity (${F})`, 'Capacity / force'], rows: used.map((it) => [it.name, fmt(it.f), fmt(it.cap), fmt(it.cap / it.f)]) }, r: `λ = ${fmt(lam)}, set by ${gov.name}` });
    r.out.unshift({ k: 'Load factor λ (largest load = λ × loads entered)', v: lam, u: '', hl: true }, { k: `${gov.name} at the largest load (its capacity)`, v: gov.cap, u: F });
    const W = g.kind === 'particle' || g.kind === 'particle3d' ? g.K.reduce((s, k) => s + Math.hypot(...k.v), 0) : (g.loads || []).reduce((s, l) => s + (l.F != null ? l.F : Math.hypot(...l.v)), 0);
    if (W > 0) r.out.splice(1, 0, { k: 'Largest total load (λ × sum of load magnitudes)', v: lam * W, u: F, hl: true });
    r.warn = (r.warn || []).concat([`Every load entered is scaled by λ = ${fmt(lam)}; the results below the load factor are for the loads as entered.`]);
    r.status = { cls: 'ok', text: `Largest load: λ = ${fmt(lam)} (${gov.name} at capacity)` };
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['x', 'y', 'z', 'x1', 'x2', 'y1', 'y2', 'z1', 'z2', 'bx', 'by', 'bz']), FOR = new Set(['F', 'Fx', 'Fy', 'Fz', 'P', 'T']), MOM = new Set(['M', 'Mx', 'My', 'Mz']), DIS = new Set(['w1', 'w2', 'k']);
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
    ['pa', 'p3', 'rb', 'r3', 'fm'].forEach((k) => walk(st[k]));
    if (st.cap) { if (typeof st.cap.T === 'number') st.cap.T = tidy(st.cap.T * kF, 8); st.cap.sup = (st.cap.sup || []).map((v) => (v === '' || v == null ? v : tidy(+v * kF, 8))); }
    st.fu = f1;
    return st;
  }

  const Equil = { defaults, solve, convertState, unknowns };
  root.Equil = Equil;
  if (typeof module !== 'undefined' && module.exports) module.exports = Equil;
})(typeof window !== 'undefined' ? window : globalThis);
