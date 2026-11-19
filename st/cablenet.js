/* =====================================================================
 * STATICS · Cords, springs, rings and pulleys with several joints (physics only; browser and Node)
 * Hibbeler, Engineering Mechanics: Statics, Sections 3.3 and 3.4 (Probs. 3-9 to 3-19, 3-33, 3-67).
 *   Points are fixed (an anchor, a hook, the centre of a small pulley) or free (a ring or knot).
 *   Members join two points:
 *     cord    a cable whose tension is unknown (it cannot push)
 *     spring  F = k (L − L₀); with k given the stretch and unstretched length are found, with L₀ given k is found
 *     known   a cord with a known tension, such as a cord over a small pulley carrying a hanging weight W (T = W)
 *     free    a cord from a ring to an anchor in an unknown direction: its magnitude and angle are both unknown
 *   task 'forces': the geometry is known; each free joint gives ΣF = 0 (two or three equations) and the
 *                  unknown member forces come from one linear system. Optionally the largest load: every load
 *                  scaled so that the most heavily loaded cord reaches the capacity entered.
 *   task 'place':  the member forces are known (known tensions, springs with k and L₀) and the positions of
 *                  the free joints are unknown, such as the sag of a ring: ΣF(position) = 0 by Newton's method.
 * Forces are in the chosen force unit, lengths in m or ft. In 3D z is up.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps } = Core;
  const DEG = Math.PI / 180;

  function defaults() {
    return {
      dim: '2d', task: 'forces', capOn: false, capT: 100,
      points: [{ name: 'C', x: -0.6, y: 0, z: 0, kind: 'fixed' }, { name: 'B', x: 0.4, y: 0, z: 0, kind: 'fixed' }, { name: 'A', x: 0, y: -0.5, z: 0, kind: 'ring' }],
      members: [{ a: 'A', b: 'B', type: 'spring', k: 1200, L0: 0, T: 0 }, { a: 'A', b: 'C', type: 'spring', k: 1500, L0: 0, T: 0 }],
      loads: [{ at: 'A', by: 'mass', m: 30, W: 294.3, Fx: 0, Fy: 0, Fz: 0 }],
    };
  }
  const gOf = (U) => (U.id === 'US' ? 32.2 : 9.81);
  const sub = (a, b) => a.map((v, i) => v - b[i]), nrm = (a) => Math.hypot(...a);
  const vstr = (v) => `(${v.map((x) => fmt(x)).join(', ')})`;

  /** Reads and checks the input; returns the model used by both tasks. */
  function model(q, c, err) {
    const d3 = q.dim === '3d', D = d3 ? 3 : 2, F = c.F;
    const pts = (q.points || []).map((p, i) => ({ name: String(p.name || '').trim() || `P${i + 1}`, p: d3 ? [+p.x || 0, +p.y || 0, +p.z || 0] : [+p.x || 0, +p.y || 0], fix: p.kind ? p.kind !== 'ring' : !!p.fix }));
    const idx = {}; pts.forEach((p, i) => { if (idx[p.name] != null) err.push(`Two points are named ${p.name}.`); idx[p.name] = i; });
    const free = pts.map((p, i) => i).filter((i) => !pts[i].fix);
    if (!free.length) err.push('Mark at least one point as a free ring or knot.');
    const mem = (q.members || []).map((m, i) => {
      const a = idx[String(m.a || '').trim()], b = idx[String(m.b || '').trim()], type = m.type || 'cord';
      const name = `${m.a}${type === 'free' ? '' : m.b}`;
      if (a == null) err.push(`Member ${i + 1}: there is no point named "${m.a}".`);
      if (type !== 'free' && b == null) err.push(`Member ${i + 1}: there is no point named "${m.b}".`);
      if (type !== 'free' && a != null && a === b) err.push(`Member ${i + 1}: its two ends are the same point.`);
      if (type === 'free' && a != null && pts[a].fix) err.push(`Member ${i + 1}: a cord in an unknown direction must start at a free ring.`);
      if (type === 'known' && !(+m.T >= 0)) err.push(`Member ${name}: enter its known tension.`);
      if (type === 'spring' && !(+m.k > 0) && !(+m.L0 > 0)) err.push(`Spring ${name}: enter k (to find the stretch) or the unstretched length L₀ (to find k).`);
      return { i, a, b, type, name, k: +m.k || 0, L0: +m.L0 || 0, T: +m.T || 0 };
    });
    const loads = (q.loads || []).map((l, i) => {
      const at = idx[String(l.at || '').trim()];
      if (at == null) err.push(`Load ${i + 1}: there is no point named "${l.at}".`);
      else if (pts[at].fix) err.push(`Load ${i + 1}: put loads on free rings; a load on a fixed point goes straight into the support.`);
      let v, how;
      if (l.by === 'mass' || l.by === 'weight') {
        const W = l.by === 'mass' ? (c.U.id === 'US' ? Core.convert(+l.m * gOf(c.U), 'lb', F) : Core.convert(+l.m * gOf(c.U), 'N', F)) : +l.W;
        if (!(W > 0)) err.push(`Load ${i + 1}: enter the ${l.by === 'mass' ? 'mass' : 'weight'}.`);
        v = d3 ? [0, 0, -W] : [0, -W]; how = l.by === 'mass' ? `W = mg = ${fmt(+l.m)}(${fmt(gOf(c.U))}) = ${fmt(W)} ${F}` : `W = ${fmt(W)} ${F}`;
      } else { v = d3 ? [+l.Fx || 0, +l.Fy || 0, +l.Fz || 0] : [+l.Fx || 0, +l.Fy || 0]; how = `F = ${vstr(v)} ${F}`; }
      return { at, v, how, name: l.by === 'force' ? `P${i + 1}` : `W${i + 1}` };
    });
    return { d3, D, pts, idx, free, mem, loads };
  }

  /** Unit vector from point j along member m toward its other end (the pull of a cord in tension on j). */
  function pull(md, m, j, X) {
    const o = m.a === j ? m.b : m.a, d = sub(X[o], X[j]), L = nrm(d);
    return { u: d.map((v) => v / L), L };
  }
  const posOf = (md) => md.pts.map((p) => p.p.slice());

  function solve(q, c) {
    const err = [], md = model(q, c, err);
    if (err.length) return fail(err);
    return (q.task === 'place' ? place : forces)(q, c, md);
  }

  /* ---------------------------- known geometry: member forces ---------------------------- */
  function forces(q, c, md) {
    const { F, Lu } = c, { D, pts, free, mem, loads } = md, X = posOf(md), ax = ['x', 'y', 'z'].slice(0, D);
    const S = Steps(), out = [], warn = [];
    // unknowns: one per cord or spring, D per free-direction cord; known tensions go to the right-hand side
    const cols = [];
    mem.forEach((m) => {
      if (m.type === 'cord' || m.type === 'spring') cols.push({ m, comp: -1 });
      else if (m.type === 'free') for (let k = 0; k < D; k++) cols.push({ m, comp: k });
    });
    const rows = [], rhs = [], rowName = [];
    free.forEach((j) => {
      for (let k = 0; k < D; k++) {
        const row = new Array(cols.length).fill(0); let b = 0;
        cols.forEach((cl, n) => { const m = cl.m; if (m.a !== j && m.b !== j) return; if (cl.comp >= 0) { if (k === cl.comp) row[n] = 1; } else row[n] = pull(md, m, j, X).u[k]; });
        mem.forEach((m) => { if (m.type === 'known' && (m.a === j || m.b === j)) b -= m.T * pull(md, m, j, X).u[k]; });
        loads.forEach((l) => { if (l.at === j) b -= l.v[k]; });
        rows.push(row); rhs.push(b); rowName.push(`Σ F_${ax[k]} at ${pts[j].name}`);
      }
    });
    // a member between two fixed points carries nothing the free joints can feel
    mem.filter((m) => m.type !== 'free' && pts[m.a].fix && pts[m.b].fix).forEach((m) => warn.push(`Member ${m.name} joins two fixed points, so the equilibrium of the rings cannot find its force.`));
    const nEq = rows.length, nUn = cols.length;
    S.add({ t: 'Unit vectors along the members', n: 'Each cord or spring pulls a ring toward the member\'s other end, along the unit vector u = (r_other − r_ring) / L.',
      table: { head: ['Member', `Length (${Lu})`, 'Unit vector from its first end', 'Force'], rows: mem.map((m) => m.type === 'free' ? [m.name, '—', 'unknown direction', `unknown ${D === 3 ? 'components' : 'F_x and F_y'}`] : [m.name, fmt(pull(md, m, m.a, X).L), vstr(pull(md, m, m.a, X).u), m.type === 'known' ? `T = ${fmt(m.T)} ${F} (known)` : `${m.type === 'spring' ? 'spring' : 'cord'} F_${m.name} unknown`]) } });
    if (nUn > nEq) return fail(`The rings give ${nEq} equations (${D} for each of ${free.length} free point${free.length > 1 ? 's' : ''}) but there are ${nUn} unknown forces. The system is statically indeterminate: give a known tension or remove a member.`);
    const sol = Core.linSolve(rows, rhs);
    if (!sol.x && sol.rank === nUn) return fail('The rings cannot be held this way: some load has a component that no member can resist. Check the geometry or let a cord\'s direction be unknown.');
    if (!sol.x) return fail('The equations have no unique solution: two members of a ring lie along one line, or the system is not stable as drawn. Check the geometry.');
    const val = sol.x;
    S.add({ t: 'Equations of equilibrium at each ring', f: 'ΣF = Σ F_i u_i + Σ loads = 0',
      table: { head: ['Equation'].concat(cols.map((cl) => (cl.comp >= 0 ? `F_${cl.m.name},${ax[cl.comp]}` : `F_${cl.m.name}`))).concat(['= right side']), rows: rows.map((r, i) => [rowName[i]].concat(r.map((v) => (Math.abs(v) < 1e-12 ? '0' : fmt(v)))).concat([fmt(rhs[i])])) } });
    const res = mem.map((m) => ({ m, F: m.type === 'known' ? m.T : null, v: null }));
    cols.forEach((cl, n) => { const r = res[cl.m.i]; if (cl.comp < 0) r.F = val[n]; else { r.v = r.v || new Array(D).fill(0); r.v[cl.comp] = val[n]; } });
    res.forEach((r) => { if (r.v) r.F = nrm(r.v); });
    const lines = [];
    res.forEach((r) => {
      const m = r.m;
      if (m.type === 'free') {
        const ang = D === 2 ? Math.atan2(r.v[1], r.v[0]) / DEG : null;
        lines.push(`F_${m.name} = ${fmt(r.F)} ${F}${D === 2 ? ` at ${fmt(ang)}° from +x` : ` along ${vstr(r.v.map((v) => v / r.F))}`}`);
        out.push({ k: `F_${m.name}`, v: r.F, u: F, hl: true });
        if (D === 2) out.push({ k: `Angle of ${m.name} (↺ from +x)`, v: ang, u: '°', hl: true });
        else out.push({ k: `Direction angles of ${m.name} (α, β, γ)`, v: r.v.map((v) => fmt(Math.acos(v / r.F) / DEG)).join(', '), u: '°' });
      } else if (m.type !== 'known') { lines.push(`F_${m.name} = ${fmt(r.F)} ${F}`); out.push({ k: `F_${m.name}`, v: r.F, u: F, hl: true }); }
    });
    S.add({ t: 'Solve', r: lines.join(';  ') || 'All member forces are known.' });
    const neg = res.filter((r) => (r.m.type === 'cord') && r.F < -1e-9 * Math.max(1, ...res.map((x) => Math.abs(x.F))));
    if (neg.length) return fail(neg.map((r) => `F_${r.m.name} comes out as ${fmt(r.F)} ${F}: a cord cannot push, so the rings cannot hang this way. Check the geometry or make it a strut-like spring.`));
    // springs: stretch and unstretched length, or the stiffness needed
    res.filter((r) => r.m.type === 'spring').forEach((r) => {
      const m = r.m, L = pull(md, m, m.a, X).L;
      if (m.k > 0) {
        const s = r.F / m.k;
        S.add({ t: `Spring ${m.name}`, f: 'F = k s;  L₀ = L − s', s: `s = ${fmt(r.F)} / ${fmt(m.k)} = ${fmt(s)} ${Lu};  L₀ = ${fmt(L)} − ${fmt(s)}`, r: `s = ${fmt(s)} ${Lu}${s < 0 ? ' (compressed)' : ''},  L₀ = ${fmt(L - s)} ${Lu}` });
        out.push({ k: `Stretch of ${m.name}`, v: s, u: Lu }, { k: `Unstretched length of ${m.name}`, v: L - s, u: Lu });
      } else {
        const s = L - m.L0;
        if (Math.abs(s) < 1e-12) { warn.push(`Spring ${m.name} is at its unstretched length, so no k can give it a force.`); return; }
        S.add({ t: `Spring ${m.name}`, f: 'k = F / (L − L₀)', s: `k = ${fmt(r.F)} / (${fmt(L)} − ${fmt(m.L0)})`, r: `k = ${fmt(r.F / s)} ${F}/${Lu}` });
        out.push({ k: `Stiffness of ${m.name}`, v: r.F / s, u: `${F}/${Lu}`, hl: true });
      }
    });
    const geo = { kind: 'cablenet', c, d3: md.d3, pts: md.pts.map((p, i) => ({ name: p.name, p: X[i], fix: p.fix })), mem: res.map((r) => ({ a: r.m.a, b: r.m.b, type: r.m.type, name: r.m.name, F: r.F, v: r.v })), loads: loads.map((l) => ({ at: l.at, v: l.v, name: l.name })) };
    let text = `Rings in equilibrium · ${res.filter((r) => r.m.type !== 'known').length} member force${res.filter((r) => r.m.type !== 'known').length === 1 ? '' : 's'} found`;
    if (q.capOn) {
      const T = +q.capT, cand = res.filter((r) => r.m.type !== 'spring' && r.F > 1e-12);
      if (!(T > 0)) return fail('Enter the largest tension a cord can carry.');
      if (cand.length) {
        const top = cand.reduce((a, b) => (b.F > a.F ? b : a)), lam = T / top.F, W = loads.reduce((s, l) => s + nrm(l.v), 0);
        S.add({ t: 'Largest load', f: 'λ = T_max / largest cord force', n: 'Equilibrium is linear: multiplying every load by λ multiplies every member force by λ. The cord with the largest force reaches the capacity first. Known tensions are scaled with the loads.', s: `λ = ${fmt(T)} / ${fmt(top.F)}`, r: `λ = ${fmt(lam)} (F_${top.m.name} reaches ${fmt(T)} ${F}); largest total load = ${fmt(lam * W)} ${F}` });
        out.unshift({ k: 'Load factor λ (largest load = λ × loads entered)', v: lam, u: '', hl: true }, { k: 'Largest total load', v: lam * W, u: F, hl: true }, { k: 'Cord that reaches the capacity', v: top.m.name, u: '' });
        text = `Largest load: λ = ${fmt(lam)} (${top.m.name} at ${fmt(T)} ${F})`;
      }
    }
    return { ok: true, err: [], warn: warn.filter(Boolean), status: { cls: 'ok', text }, out, steps: S.list, geo };
  }

  /* ---------------------------- known forces: positions of the rings ---------------------------- */
  function place(q, c, md) {
    const { F, Lu } = c, { D, pts, free, mem, loads } = md;
    const bad = mem.filter((m) => m.type === 'cord' || m.type === 'free' || (m.type === 'spring' && !(m.k > 0 && m.L0 > 0)));
    if (bad.length) return fail(`To find where the rings settle, every member force must follow from the geometry: use known tensions (cords over pulleys) and springs with both k and L₀. Change ${bad.map((m) => m.name).join(', ')}.`);
    const X0 = posOf(md), n = free.length * D;
    const unpack = (z) => { const X = X0.map((p) => p.slice()); free.forEach((j, a) => { for (let k = 0; k < D; k++) X[j][k] = z[a * D + k]; }); return X; };
    const memF = (m, X) => (m.type === 'known' ? m.T : m.k * (pull(md, m, m.a, X).L - m.L0));
    const resid = (z) => {
      const X = unpack(z), r = new Array(n).fill(0);
      free.forEach((j, a) => {
        mem.forEach((m) => { if (m.a !== j && m.b !== j) return; const { u } = pull(md, m, j, X), f = memF(m, X); for (let k = 0; k < D; k++) r[a * D + k] += f * u[k]; });
        loads.forEach((l) => { if (l.at === j) for (let k = 0; k < D; k++) r[a * D + k] += l.v[k]; });
      });
      return r;
    };
    let z = []; free.forEach((j) => z.push(...X0[j]));
    const scale = Math.max(1e-6, ...md.pts.map((p) => nrm(p.p))), fs = Math.max(1e-9, ...loads.map((l) => nrm(l.v)), ...mem.map((m) => (m.type === 'known' ? m.T : 0)));
    let r = resid(z), it = 0, okConv = false;
    for (; it < 200; it++) {
      const r0 = nrm(r); if (r0 < 1e-11 * fs) { okConv = true; break; }
      const h = 1e-7 * scale, J = [];
      for (let k = 0; k < n; k++) { const zp = z.slice(); zp[k] += h; const rp = resid(zp); for (let e = 0; e < n; e++) { (J[e] = J[e] || [])[k] = (rp[e] - r[e]) / h; } }
      const dz = Core.linSolve(J, r.map((v) => -v)).x;
      if (!dz) break;
      // damped step: never move more than a fifth of the layout size at once, and accept only a smaller residual
      let t = Math.min(1, (0.2 * scale) / Math.max(1e-30, nrm(dz))), done = false;
      for (let tries = 0; tries < 30; tries++) { const zn = z.map((v, k) => v + t * dz[k]), rn = resid(zn); if (rn.every(Number.isFinite) && nrm(rn) < r0) { z = zn; r = rn; done = true; break; } t *= 0.5; }
      if (!done) break;
    }
    if (!okConv) return fail('No equilibrium position was found from the positions entered. Start the rings nearer where they hang (below their supports), or check that the known tensions can hold the loads.');
    const X = unpack(z), S = Steps(), out = [], ax = ['x', 'y', 'z'].slice(0, D);
    S.add({ t: 'Unknown positions', n: `The forces in the members are known, but where the ${free.length > 1 ? 'rings settle' : 'ring settles'} is not: ${free.map((j) => `${pts[j].name} (${ax.join(', ')})`).join(', ')}. Each ring gives ΣF = 0 with each member force along u = (r_other − r_ring)/L, which depends on the unknown position.`,
      table: { head: ['Member', 'Force'], rows: mem.map((m) => [m.name, m.type === 'known' ? `T = ${fmt(m.T)} ${F} (known)` : `F = ${fmt(m.k)}(L − ${fmt(m.L0)}) (spring)`]) } });
    S.add({ t: 'Solve ΣF = 0 for the positions', n: `The equations are not linear in the coordinates. They were solved by Newton's method from the positions entered (${it} steps).`,
      table: { head: ['Ring'].concat(ax.map((a) => `${a} (${Lu})`)).concat([`moved by (${Lu})`]), rows: free.map((j) => [pts[j].name].concat(X[j].map((v) => fmt(v))).concat([fmt(nrm(sub(X[j], X0[j])))])) } });
    const D2 = D === 2;
    free.forEach((j) => {
      const yk = D2 ? 1 : 2, fixedNbr = mem.filter((m) => m.type !== 'free' && (m.a === j || m.b === j)).map((m) => (m.a === j ? m.b : m.a)).filter((o) => pts[o].fix);
      const ref = fixedNbr.length ? Math.max(...fixedNbr.map((o) => X[o][yk])) : null;
      ax.forEach((a, k) => out.push({ k: `Ring ${pts[j].name}: ${a}`, v: X[j][k], u: Lu, hl: k === yk }));
      if (ref != null) { out.push({ k: `Ring ${pts[j].name}: sag below its highest support`, v: ref - X[j][yk], u: Lu, hl: true }); S.add({ t: `Sag of ${pts[j].name}`, n: 'Measured down from the highest fixed point the ring hangs from.', r: `s = ${fmt(ref)} − (${fmt(X[j][yk])}) = ${fmt(ref - X[j][yk])} ${Lu}` }); }
    });
    const rows = [];
    mem.forEach((m) => { const { u, L } = pull(md, m, m.a, X), f = memF(m, X); rows.push([m.name, fmt(L), D2 ? `${fmt(Math.atan2(u[1], u[0]) / DEG)}°` : vstr(u), fmt(f)]); if (m.type === 'spring') out.push({ k: `Force in spring ${m.name}`, v: f, u: F }, { k: `Stretch of ${m.name}`, v: L - m.L0, u: Lu }); });
    S.add({ t: 'Members in the equilibrium position', table: { head: ['Member', `Length (${Lu})`, D2 ? 'Direction from the first end' : 'Unit vector from the first end', `Force (${F})`], rows } });
    const chk = resid(z);
    S.add({ t: 'Check', n: 'Substitute the positions back into ΣF at each ring.', r: `largest unbalanced component = ${fmt(Math.max(...chk.map(Math.abs)))} ${F} ≈ 0` });
    const geo = { kind: 'cablenet', c, d3: md.d3, X0, pts: md.pts.map((p, i) => ({ name: p.name, p: X[i], fix: p.fix })), mem: mem.map((m) => ({ a: m.a, b: m.b, type: m.type, name: m.name, F: memF(m, X) })), loads: loads.map((l) => ({ at: l.at, v: l.v, name: l.name })) };
    const j0 = free[0], yk0 = D2 ? 1 : 2, sag = out.find((o) => /sag/.test(o.k) && o.k.indexOf(pts[j0].name) >= 0);
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: sag ? `${pts[j0].name} hangs ${fmt(sag.v)} ${Lu} below its support${free.length > 1 ? ' (and the others: see results)' : ''}` : `${pts[j0].name} settles at ${ax[yk0]} = ${fmt(X[j0][yk0])} ${Lu}` }, out, steps: S.list, geo };
  }

  /* ---------------------------- units ---------------------------- */
  function convertState(q, kL, kF, kM) {
    const t = (v, k) => Core.tidy(v * k, 9);
    (q.points || []).forEach((p) => ['x', 'y', 'z'].forEach((k) => { if (typeof p[k] === 'number') p[k] = t(p[k], kL); }));
    (q.members || []).forEach((m) => { m.k = t(+m.k || 0, kF / kL); m.L0 = t(+m.L0 || 0, kL); m.T = t(+m.T || 0, kF); });
    (q.loads || []).forEach((l) => { l.m = t(+l.m || 0, kM); l.W = t(+l.W || 0, kF); ['Fx', 'Fy', 'Fz'].forEach((k) => (l[k] = t(+l[k] || 0, kF))); });
    q.capT = t(+q.capT || 0, kF);
    return q;
  }

  const CableNet = { defaults, solve, convertState };
  root.CableNet = CableNet;
  if (typeof module !== 'undefined' && module.exports) module.exports = CableNet;
})(typeof window !== 'undefined' ? window : globalThis);
