/* =====================================================================
 * STATICS · Trusses (physics only; runs in the browser and in Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapter 6, sections 6.1 to 6.4.
 *   Plane trusses from templates (Pratt, Howe, Warren, roof, cantilever) or
 *   joints and members typed in. Tension is positive.
 *   Steps: m + r = 2j and stability, support reactions, zero-force members,
 *   method of joints (each joint with at most two unknowns), method of
 *   sections at a vertical cut, and joint displacements from AE.
 * Forces are in the chosen force unit `fu`, lengths in m or ft.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const Equil = root.Equil || require('./equil.js');
  const Forces = root.Forces || require('./forces.js');
  const { fmt, fail, Steps, linSolve, tidy } = Core;
  const { comp2 } = Forces;

  const TEMPLATES = [['pratt', 'Pratt (bridge)'], ['howe', 'Howe (bridge)'], ['warren', 'Warren (no verticals)'], ['roof', 'Pitched roof truss'], ['cantilever', 'Cantilever truss from a wall']];

  function defaults() {
    return {
      mode: 'template', fu: 'kN',
      tpl: 'pratt', n: 6, a: 3, h: 4, P: 10, chord: 'bottom',
      custom: {
        joints: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: 4, y: 0 }, { name: 'C', x: 8, y: 0 }, { name: 'D', x: 12, y: 0 }, { name: 'G', x: 4, y: 3 }, { name: 'E', x: 8, y: 3 }],
        members: ['AB', 'BC', 'CD', 'AG', 'GB', 'GC', 'GE', 'EC', 'ED'].map((m) => ({ a: m[0], b: m[1] })),
        supports: [{ j: 'A', type: 'pin', ang: 90 }, { j: 'D', type: 'roller', ang: 90 }],
        loads: [{ j: 'C', by: 'comp', Fx: 0, Fy: -1.2, F: 1.2, ang: 270, dx: 4, dy: 3 }, { j: 'E', by: 'comp', Fx: 0.4, Fy: 0, F: 0.4, ang: 0, dx: 4, dy: 3 }],
      },
      cutOn: true, cutF: 0.42,
      ae: { use: false, E: 200, A: 1500 },
      defl: true,
    };
  }

  const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  /** Joint name for an index: A … Z, then A1, B1 … */
  const nm = (i) => LET[i % 26] + (i >= 26 ? Math.floor(i / 26) : '');

  /** Joints, members, supports and loads of a template. Bottom chord first (A, B, …), then the top chord. */
  function template(st) {
    const n = Math.round(+st.n), a = +st.a, h = +st.h, P = +st.P, t = st.tpl, err = [];
    if (!(a > 0) || !(h > 0)) err.push('The panel length and the height must be greater than zero.');
    if (!(n >= 2 && n <= 16)) err.push('Use 2 to 16 panels.');
    if ((t === 'roof') && n % 2) err.push('A pitched roof truss needs an even number of panels.');
    if (err.length) return { err };
    const J = [], M = [], add = (x, y) => (J.push({ name: nm(J.length), x: tidy(x, 9), y: tidy(y, 9) }), J.length - 1), mem = (i, j) => M.push([i, j]);
    const L = [], Uu = [];
    for (let i = 0; i <= n; i++) L.push(add(i * a, 0));
    let sup, loaded;
    if (t === 'warren') {
      for (let i = 0; i < n; i++) Uu.push(add((i + 0.5) * a, h));
      for (let i = 0; i < n; i++) mem(L[i], L[i + 1]);
      for (let i = 0; i < n - 1; i++) mem(Uu[i], Uu[i + 1]);
      for (let i = 0; i < n; i++) { mem(L[i], Uu[i]); mem(Uu[i], L[i + 1]); }
      sup = [[L[0], 'pin', 90], [L[n], 'roller', 90]];
      loaded = st.chord === 'top' ? Uu : L.slice(1, n);
    } else if (t === 'cantilever') {
      for (let i = 0; i < n; i++) Uu.push(add(i * a, h));
      for (let i = 0; i < n; i++) mem(L[i], L[i + 1]);
      for (let i = 0; i < n - 1; i++) mem(Uu[i], Uu[i + 1]);
      for (let i = 0; i < n; i++) mem(L[i], Uu[i]);
      for (let i = 0; i < n; i++) mem(Uu[i], L[i + 1]);
      sup = [[Uu[0], 'pin', 90], [L[0], 'roller', 0]];
      loaded = st.chord === 'top' ? Uu.slice(1) : L.slice(1);
    } else {
      // Pratt, Howe and the pitched roof: top joints over the bottom joints 1 … n−1
      for (let i = 1; i < n; i++) Uu.push(add(i * a, t === 'roof' ? h * (1 - Math.abs((2 * i) / n - 1)) : h));
      const U = (i) => Uu[i - 1];
      for (let i = 0; i < n; i++) mem(L[i], L[i + 1]);
      mem(L[0], U(1));
      for (let i = 1; i < n - 1; i++) mem(U(i), U(i + 1));
      mem(U(n - 1), L[n]);
      for (let i = 1; i < n; i++) mem(L[i], U(i));
      for (let i = 1; i < n - 1; i++) {
        const left = i < n / 2;
        // Pratt and roof: diagonals run down toward the middle; Howe: up toward the middle
        if (t === 'howe') { if (left) mem(L[i], U(i + 1)); else mem(U(i), L[i + 1]); } else if (left) mem(U(i), L[i + 1]); else mem(U(i + 1), L[i]);
      }
      sup = [[L[0], 'pin', 90], [L[n], 'roller', 90]];
      loaded = st.chord === 'top' || t === 'roof' ? Uu : L.slice(1, n);
    }
    return {
      joints: J,
      members: M.map(([i, j]) => ({ a: J[i].name, b: J[j].name })),
      supports: sup.map(([j, type, ang]) => ({ j: J[j].name, type, ang })),
      loads: P ? loaded.map((j) => ({ j: J[j].name, by: 'comp', Fx: 0, Fy: -P })) : [],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Build and check the model                                          */
  /* ------------------------------------------------------------------ */
  function model(st) {
    const src = st.mode === 'custom' ? st.custom : template(st);
    if (src.err) return { err: src.err };
    const err = [], idx = {};
    const J = (src.joints || []).map((j, i) => {
      const name = String(j.name || '').trim() || nm(i);
      if (idx[name] !== undefined) err.push(`Two joints are named ${name}.`);
      idx[name] = i;
      if (!isFinite(+j.x) || !isFinite(+j.y)) err.push(`Joint ${name}: enter its coordinates.`);
      return { name, x: +j.x, y: +j.y };
    });
    if (J.length < 3) err.push('A truss needs at least three joints.');
    J.forEach((p, i) => J.forEach((q, k) => { if (k > i && Math.hypot(p.x - q.x, p.y - q.y) < 1e-9) err.push(`Joints ${p.name} and ${q.name} are at the same point.`); }));
    const seen = {};
    const Mm = (src.members || []).map((m) => {
      const a = idx[m.a], b = idx[m.b];
      if (a === undefined || b === undefined) { err.push(`Member ${m.a}${m.b}: joint ${a === undefined ? m.a : m.b} does not exist.`); return null; }
      if (a === b) { err.push(`Member ${m.a}${m.b} joins a joint to itself.`); return null; }
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen[key]) err.push(`Member ${m.a}${m.b} is listed twice.`);
      seen[key] = true;
      const dx = J[b].x - J[a].x, dy = J[b].y - J[a].y, L = Math.hypot(dx, dy);
      return { a, b, name: J[a].name + J[b].name, L, u: [dx / L, dy / L] };
    });
    if (!Mm.length) err.push('Add the members.');
    const sup = (src.supports || []).map((s) => {
      const j = idx[s.j]; if (j === undefined) { err.push(`Support at ${s.j}: that joint does not exist.`); return null; }
      return { j, type: s.type === 'roller' ? 'roller' : 'pin', ang: +s.ang || 0 };
    });
    if (!sup.length) err.push('Add the supports (a pin and a roller for a simple truss).');
    const loads = (src.loads || []).map((l, i) => {
      const j = idx[l.j]; if (j === undefined) { err.push(`Load ${i + 1}: joint ${l.j} does not exist.`); return null; }
      const r = comp2(l, `Load ${i + 1}`); if (r.err) { err.push(r.err); return null; }
      return { j, Fx: r.Fx, Fy: r.Fy, F: Math.hypot(r.Fx, r.Fy) };
    });
    if (err.length) return { err: [...new Set(err)] };
    return { J, Mm, sup, loads };
  }

  /* ------------------------------------------------------------------ */
  /* Solve                                                              */
  /* ------------------------------------------------------------------ */
  const DEG = Math.PI / 180;
  const crossz = (r, d) => r[0] * d[1] - r[1] * d[0];
  const TC = (v, F, sc) => (Math.abs(v) <= 1e-7 * sc ? `0 (zero-force member)` : `${fmt(Math.abs(v))} ${F} (${v > 0 ? 'T' : 'C'})`);

  function solve(st, U) {
    const c = { F: st.fu, Lu: U.len, FL: `${st.fu}·${U.len}`, U };
    const md = model(st);
    if (md.err) return fail(md.err);
    const { J, Mm, sup, loads } = md, { F, Lu } = c;
    const nj = J.length, m = Mm.length;
    // reaction unknowns: a pin gives x and y, a roller one force along its push direction
    const R = [];
    sup.forEach((s) => {
      const L = J[s.j].name;
      if (s.type === 'pin') R.push({ name: `${L}_x`, j: s.j, d: [1, 0] }, { name: `${L}_y`, j: s.j, d: [0, 1] });
      else R.push({ name: `N_${L}`, j: s.j, d: [Math.cos(s.ang * DEG), Math.sin(s.ang * DEG)] });
    });
    const r = R.length, S = Steps(), out = [];
    S.add({ t: 'Determinacy and stability', f: 'm + r = 2j', n: 'Each joint gives two equations (ΣF_x = 0, ΣF_y = 0), so a simple truss needs as many unknowns (m member forces and r reactions) as joint equations.',
      s: `m + r = ${m} + ${r} = ${m + r};   2j = 2(${nj}) = ${2 * nj}` });
    if (m + r < 2 * nj) return fail(`Unstable: m + r = ${m + r} is less than 2j = ${2 * nj}, so the truss is a mechanism and would collapse. Add ${2 * nj - m - r} member${2 * nj - m - r > 1 ? 's' : ''} or support reactions.`);
    if (m + r > 2 * nj) return fail(`Statically indeterminate: m + r = ${m + r} is more than 2j = ${2 * nj}, so the joint equations cannot give every force. Remove ${m + r - 2 * nj} member${m + r - 2 * nj > 1 ? 's' : ''} or reactions.`);
    // joint equations: rows 2i (x) and 2i+1 (y); columns: members then reactions
    const A = [], b = [];
    for (let i = 0; i < 2 * nj; i++) { A.push(new Array(m + r).fill(0)); b.push(0); }
    Mm.forEach((M, k) => { A[2 * M.a][k] += M.u[0]; A[2 * M.a + 1][k] += M.u[1]; A[2 * M.b][k] -= M.u[0]; A[2 * M.b + 1][k] -= M.u[1]; });
    R.forEach((q, k) => { A[2 * q.j][m + k] += q.d[0]; A[2 * q.j + 1][m + k] += q.d[1]; });
    loads.forEach((l) => { b[2 * l.j] -= l.Fx; b[2 * l.j + 1] -= l.Fy; });
    const sol = linSolve(A, b);
    if (sol.rank < m + r || !sol.x) return fail('Unstable: although m + r = 2j, the members and supports are arranged so that the truss can still move (for example a panel without a diagonal, or reactions that are all parallel or meet at one point). Change the members or the supports.');
    const sc = Math.max(1, ...loads.map((l) => l.F));
    const x = sol.x.map((v) => (Math.abs(v) < 1e-7 * sc ? 0 : v));
    const Fm = x.slice(0, m), Rv = x.slice(m);
    Mm.forEach((M, k) => (M.F = Fm[k]));
    R.forEach((q, k) => (q.v = Rv[k]));

    /* reactions: the whole truss as one rigid body (book order) */
    if (r === 3) {
      const rb = {
        outline: [],
        supports: sup.map((s) => ({ name: J[s.j].name, type: s.type, x: J[s.j].x, y: J[s.j].y, ang: s.ang })),
        loads: loads.map((l) => ({ by: 'comp', Fx: l.Fx, Fy: l.Fy, x: J[l.j].x, y: J[l.j].y })),
        couples: [], dists: [],
      };
      const er = Equil.solve({ mode: 'rigid', fu: F, rb }, U);
      if (er.ok) er.steps.forEach((s, i) => { if (s.t !== 'Check') S.add(Object.assign({}, s, { t: i === 0 ? 'Support reactions: free-body diagram of the whole truss' : `Reactions: ${s.t[0].toLowerCase()}${s.t.slice(1)}` })); });
    } else {
      S.add({ t: 'Support reactions', n: `The truss has ${r} reaction components, more than the three equations of the whole truss can give, so they come out of the joint equations together with the member forces.`, r: R.map((q) => `${q.name} = ${fmt(q.v)} ${F}`).join(', ') });
    }

    /* zero-force members by inspection (6.3), repeated until nothing changes */
    const extF = new Array(nj).fill(false);
    loads.forEach((l) => { if (l.F > 1e-12) extF[l.j] = true; });
    sup.forEach((s) => (extF[s.j] = true));
    const zero = new Set(), rules = [];
    const coll = (u, v) => Math.abs(crossz(u, v)) < 1e-9;
    for (let pass = 0; pass < 20; pass++) {
      let changed = false;
      for (let j = 0; j < nj; j++) {
        if (extF[j]) continue;
        const ms = Mm.map((M, k) => k).filter((k) => !zero.has(k) && (Mm[k].a === j || Mm[k].b === j));
        if (ms.length === 2 && !coll(Mm[ms[0]].u, Mm[ms[1]].u)) {
          ms.forEach((k) => zero.add(k)); rules.push([J[j].name, ms.map((k) => Mm[k].name), 'two non-collinear members meet at an unloaded joint, so both are zero-force members']); changed = true;
        } else if (ms.length === 3) {
          for (let p = 0; p < 3; p++) {
            const q1 = ms[(p + 1) % 3], q2 = ms[(p + 2) % 3];
            if (coll(Mm[q1].u, Mm[q2].u) && !coll(Mm[ms[p]].u, Mm[q1].u)) { zero.add(ms[p]); rules.push([J[j].name, [Mm[ms[p]].name], `three members meet at an unloaded joint and ${Mm[q1].name} and ${Mm[q2].name} are collinear, so the third is a zero-force member`]); changed = true; break; }
          }
        }
        if (changed) break;
      }
      if (!changed) break;
    }
    if (rules.length) S.add({ t: 'Zero-force members (by inspection)', n: 'Hibbeler 6.3: checking joints with no external load or support. Once a member is found to carry no force it is left out and the joints are checked again.', table: { head: ['Joint', 'Member', 'Reason'], rows: rules.map(([jn, ms, why]) => [jn, ms.map((s) => 'F_' + s).join(', ') + ' = 0', why]) } });

    /* method of joints: each step a joint with at most two unknown member forces */
    const known = new Set(zero), jointSteps = [];
    const rx = (j, ax) => R.reduce((s, q) => s + (q.j === j ? q.v * q.d[ax] : 0), 0) + loads.reduce((s, l) => s + (l.j === j ? (ax ? l.Fy : l.Fx) : 0), 0);
    const termsAt = (j) => Mm.map((M, k) => ({ k, M, u: M.a === j ? M.u : [-M.u[0], -M.u[1]] })).filter((t) => t.M.a === j || t.M.b === j);
    const eqText = (j, ax, unknownK) => {
      const ts = termsAt(j), parts = [];
      ts.forEach((t) => {
        const a = t.u[ax]; if (Math.abs(a) < 1e-12) return;
        parts.push(unknownK.includes(t.k) ? `(${fmt(a)}) F_${t.M.name}` : `(${fmt(a)})(${fmt(t.M.F)})`);
      });
      const ext = rx(j, ax);
      let s = parts.join(' + ') || '0';
      if (Math.abs(ext) > 1e-12 * sc) s += ext < 0 ? ` − ${fmt(-ext)}` : ` + ${fmt(ext)}`;
      return `${s} = 0`;
    };
    let guard = 0;
    while (known.size < m && guard++ < 4 * nj) {
      let best = null;
      for (let j = 0; j < nj; j++) {
        const unk = termsAt(j).filter((t) => !known.has(t.k));
        if (unk.length === 0 || unk.length > 2) continue;
        if (unk.length === 2 && coll(unk[0].u, unk[1].u)) continue;
        if (!best || unk.length > best.unk.length) best = { j, unk };
        if (unk.length === 2) break;
      }
      if (!best) break;
      const { j, unk } = best, ks = unk.map((t) => t.k), jn = J[j].name;
      const ext = [rx(j, 0), rx(j, 1)], hasExt = Math.abs(ext[0]) + Math.abs(ext[1]) > 1e-12 * sc;
      let f, sline;
      if (unk.length === 2) {
        f = '→+ ΣF_x = 0;  +↑ ΣF_y = 0';
        sline = `${eqText(j, 0, ks)};   ${eqText(j, 1, ks)}`;
      } else {
        const ax = Math.abs(unk[0].u[1]) > Math.abs(unk[0].u[0]) ? 1 : 0;
        f = ax ? '+↑ ΣF_y = 0' : '→+ ΣF_x = 0';
        sline = eqText(j, ax, ks);
      }
      jointSteps.push({ t: `Joint ${jn}`, f, n: `Free-body diagram of joint ${jn}: each member force is drawn pulling away from the joint (tension positive)${hasExt ? ', with the load and reaction at the joint' : ''}.${unk.length === 2 ? ' The two equations are solved together.' : ''}`,
        s: sline, r: unk.map((t) => `F_${t.M.name} = ${TC(t.M.F, F, sc)}`).join(';  '), joint: j });
      ks.forEach((k) => known.add(k));
    }
    jointSteps.forEach((s) => S.add(s));
    if (known.size < m) {
      const rest = Mm.filter((M, k) => !known.has(k));
      S.add({ t: 'Remaining joints solved together', n: 'Every remaining joint has three or more unknown member forces, so these joint equations are solved simultaneously (this happens in complex trusses).', r: rest.map((M) => `F_${M.name} = ${TC(M.F, F, sc)}`).join(';  ') });
    }

    /* method of sections at a vertical cut */
    const xs = J.map((p) => p.x), xmin = Math.min(...xs), xmax = Math.max(...xs), span = xmax - xmin || 1;
    let cut = null;
    if (st.cutOn !== false) {
      let xc = xmin + Math.min(0.999, Math.max(0.001, +st.cutF || 0.5)) * span;
      if (J.some((p) => Math.abs(p.x - xc) < 1e-6 * span)) xc += 0.02 * span;
      const ks = Mm.map((M, k) => k).filter((k) => (J[Mm[k].a].x - xc) * (J[Mm[k].b].x - xc) < 0);
      const leftJ = J.map((p, i) => i).filter((i) => J[i].x < xc);
      cut = { x: xc, members: ks, left: leftJ };
      if (ks.length && ks.length <= 3) {
        // forces on the left part: loads and reactions at its joints; each cut member pulls along itself toward the cut
        const ext = [];
        loads.forEach((l) => { if (J[l.j].x < xc) ext.push({ p: [J[l.j].x, J[l.j].y], f: [l.Fx, l.Fy] }); });
        R.forEach((q) => { if (J[q.j].x < xc) ext.push({ p: [J[q.j].x, J[q.j].y], f: [q.v * q.d[0], q.v * q.d[1]] }); });
        const cm = ks.map((k) => { const M = Mm[k], li = J[M.a].x < xc ? M.a : M.b, ri = li === M.a ? M.b : M.a; const L = [J[li].x, J[li].y], Rr = [J[ri].x, J[ri].y], d = Math.hypot(Rr[0] - L[0], Rr[1] - L[1]); return { k, M, p: L, u: [(Rr[0] - L[0]) / d, (Rr[1] - L[1]) / d] }; });
        S.add({ t: `Method of sections: cut through ${cm.map((q) => q.M.name).join(', ')}`, n: `A vertical section at x = ${fmt(xc)} ${Lu} cuts ${cm.length} member${cm.length > 1 ? 's' : ''}. The free-body diagram is the part of the truss to the left of the cut, with its loads and reactions; each cut member force is drawn pulling away from the left part (tension positive).` });
        const ptName = (P) => { const i = J.findIndex((q) => Math.hypot(q.x - P[0], q.y - P[1]) < 1e-6 * span); return i >= 0 ? `joint ${J[i].name}` : `the point (${fmt(P[0])}, ${fmt(P[1])}) ${Lu}`; };
        cut.eq = [];
        cm.forEach((q) => {
          const oth = cm.filter((o) => o !== q);
          let P = null, dir = null;
          if (oth.length === 2) {
            const [o1, o2] = oth, den = crossz(o1.u, o2.u);
            if (Math.abs(den) > 1e-9) { const t = crossz([o2.p[0] - o1.p[0], o2.p[1] - o1.p[1]], o2.u) / den; P = [o1.p[0] + o1.u[0] * t, o1.p[1] + o1.u[1] * t]; } else dir = [-o1.u[1], o1.u[0]];
          } else if (oth.length === 1) { P = oth[0].p; if (Math.abs(crossz([q.p[0] - P[0], q.p[1] - P[1]], q.u)) < 1e-9 * span) { P = null; dir = [-oth[0].u[1], oth[0].u[0]]; } } else dir = q.u;
          if (P && Math.abs(crossz([q.p[0] - P[0], q.p[1] - P[1]], q.u)) < 1e-9 * span) { P = null; dir = oth.length ? [-oth[0].u[1], oth[0].u[0]] : q.u; }
          let coef, K, f, title, sline;
          if (P) {
            coef = crossz([q.p[0] - P[0], q.p[1] - P[1]], q.u);
            const terms = ext.map((e) => crossz([e.p[0] - P[0], e.p[1] - P[1]], e.f)).filter((v) => Math.abs(v) > 1e-12 * sc * span);
            K = terms.reduce((s, v) => s + v, 0);
            title = `Moments about ${ptName(P)}`;
            f = '↺+ ΣM = 0';
            sline = `(${fmt(coef)}) F_${q.M.name}${terms.map((v) => (v < 0 ? ` − ${fmt(-v)}` : ` + ${fmt(v)}`)).join('')} = 0`;
            q.note = oth.length === 2 ? `The lines of ${oth.map((o) => o.M.name).join(' and ')} pass through this point, so only F_${q.M.name} is left in the equation.` : undefined;
          } else {
            const dd = Math.hypot(dir[0], dir[1]); dir = [dir[0] / dd, dir[1] / dd];
            if (Math.abs(dir[0]) < 1e-9) dir = [0, Math.sign(dir[1])]; else if (Math.abs(dir[1]) < 1e-9) dir = [Math.sign(dir[0]), 0];
            coef = q.u[0] * dir[0] + q.u[1] * dir[1];
            const terms = ext.map((e) => e.f[0] * dir[0] + e.f[1] * dir[1]).filter((v) => Math.abs(v) > 1e-12 * sc);
            K = terms.reduce((s, v) => s + v, 0);
            const ax = dir[0] === 0 ? (dir[1] > 0 ? '+↑ ΣF_y = 0' : '+↓ ΣF_y = 0') : dir[1] === 0 ? (dir[0] > 0 ? '→+ ΣF_x = 0' : '←+ ΣF_x = 0') : `ΣF = 0 along the direction ${fmt(((Math.atan2(dir[1], dir[0]) / DEG) + 360) % 360)}° from +x`;
            title = oth.length ? `Forces perpendicular to ${oth.map((o) => o.M.name).join(' and ')}` : `Forces along ${q.M.name}`;
            f = ax;
            sline = `(${fmt(coef)}) F_${q.M.name}${terms.map((v) => (v < 0 ? ` − ${fmt(-v)}` : ` + ${fmt(v)}`)).join('')} = 0`;
            q.note = oth.length ? `${oth.map((o) => o.M.name).join(' and ')} ${oth.length > 1 ? 'are parallel, so they have' : 'has'} no component in this direction.` : undefined;
          }
          const val = Math.abs(coef) > 1e-12 ? -K / coef : NaN;
          cut.eq.push({ k: q.k, P });
          S.add({ t: `Section: ${title}`, f, n: q.note, s: sline, r: isFinite(val) ? `F_${q.M.name} = ${TC(Math.abs(val) < 1e-7 * sc ? 0 : val, F, sc)}` : `F_${q.M.name} = ${TC(q.M.F, F, sc)}` });
        });
        S.add({ t: 'Section check', n: 'The forces from the section are the same as those from the method of joints.', r: cm.map((q) => `F_${q.M.name} = ${TC(q.M.F, F, sc)}`).join(';  ') });
      } else if (ks.length > 3) {
        cut.many = true;
        S.add({ t: 'Method of sections', n: `The cut at x = ${fmt(xc)} ${Lu} passes through ${ks.length} members. Three equations can give at most three unknown forces, so move the cut to a panel where it crosses no more than three members.` });
      }
    }

    /* joint displacements: member stretch e = FL/(AE) and compatibility (u_b − u_a)·n = e, supports fixed */
    const useAE = !!(st.ae && st.ae.use);
    let AE = 1, dU = c.FL, kD = 1;
    if (useAE) {
      const E = +st.ae.E, Ar = +st.ae.A;
      if (!(E > 0) || !(Ar > 0)) return fail('Enter E and A greater than zero, or turn off "Use E and A".');
      AE = U.id === 'US' ? Core.convert(E * Ar, 'kip', F) : Core.convert(E * 1e9 * Ar * 1e-6, 'N', F);
      dU = U.lenS; kD = Core.convert(1, Lu, dU);
    }
    const D = [], db = [];
    Mm.forEach((M) => { const row = new Array(2 * nj).fill(0); row[2 * M.b] = M.u[0]; row[2 * M.b + 1] = M.u[1]; row[2 * M.a] = -M.u[0]; row[2 * M.a + 1] = -M.u[1]; D.push(row); db.push((M.F * M.L) / AE); });
    R.forEach((q) => { const row = new Array(2 * nj).fill(0); row[2 * q.j] = q.d[0]; row[2 * q.j + 1] = q.d[1]; D.push(row); db.push(0); });
    const ds = linSolve(D, db);
    let disp = null;
    if (ds.x) {
      disp = J.map((p, i) => [ds.x[2 * i] * kD, ds.x[2 * i + 1] * kD]);
      const mags = disp.map((d) => Math.hypot(d[0], d[1])), im = mags.indexOf(Math.max(...mags));
      Mm.forEach((M) => (M.e = (M.F * M.L) / AE * kD));
      S.add({ t: useAE ? 'Joint displacements' : 'Joint displacements (AE constant, not given)',
        f: 'δ_member = F L / (AE);   (u_end − u_start) · n = δ_member',
        n: `Each member stretches (tension) or shortens (compression) by FL/(AE). The joint displacements that fit every member length, with the supports held, follow from these ${m} compatibility equations and ${r} support conditions.${useAE ? ` AE = ${fmt(AE)} ${F}.` : ' E and A are not given, so the values are AE × displacement, in ' + c.FL + '.'}`,
        table: { head: ['Joint', useAE ? `δ_x (${dU})` : `AE·δ_x (${dU})`, useAE ? `δ_y (${dU})` : `AE·δ_y (${dU})`], rows: J.map((p, i) => [p.name, fmt(disp[i][0]), fmt(disp[i][1])]) },
        r: `largest: joint ${J[im].name}, ${useAE ? 'δ' : 'AE·δ'} = ${fmt(mags[im])} ${dU}` });
      out.push({ k: useAE ? `Largest joint displacement (${J[im].name})` : `Largest AE·δ (joint ${J[im].name})`, v: mags[im], u: dU });
    }

    /* results */
    R.forEach((q) => out.unshift({ k: q.name, v: q.v, u: F, hl: true }));
    Mm.forEach((M) => out.push({ k: `F_${M.name}`, v: Math.abs(M.F), u: Math.abs(M.F) <= 1e-7 * sc ? `${F} (zero)` : `${F} (${M.F > 0 ? 'T' : 'C'})` }));
    const warn = [];
    R.forEach((q) => { if (sup.find((s) => s.j === q.j).type === 'roller' && q.v < -1e-9 * sc) warn.push(`${q.name} comes out negative: a roller can only push, so the truss would lift off at ${J[q.j].name} unless it is held down.`); });
    if (cut && cut.many) warn.push(`The section cuts ${cut.members.length} members; move it so that it cuts three or fewer.`);
    const nz = Mm.filter((M) => Math.abs(M.F) <= 1e-7 * sc).length;
    out.push({ k: 'Zero-force members', v: nz, u: '' });
    const fmax = Math.max(...Mm.map((M) => Math.abs(M.F)));
    const Mt = Mm.reduce((a, M) => (M.F > a.F ? M : a), { F: -Infinity }), Mc = Mm.reduce((a, M) => (M.F < a.F ? M : a), { F: Infinity });
    if (Mt.F > 0) out.push({ k: `Largest tension (${Mt.name})`, v: Mt.F, u: F });
    if (Mc.F < 0) out.push({ k: `Largest compression (${Mc.name})`, v: -Mc.F, u: F });
    return {
      ok: true, err: [], warn, status: { cls: warn.length ? 'warn' : 'ok', text: `Statically determinate · m + r = 2j = ${2 * nj}` }, out, steps: S.list,
      geo: { c, J, Mm: Mm.map((M) => ({ a: M.a, b: M.b, name: M.name, F: M.F, L: M.L, u: M.u, zero: Math.abs(M.F) <= 1e-7 * sc, rule: zero.has(Mm.indexOf(M)) })), sup, R: R.map((q) => ({ name: q.name, j: q.j, d: q.d, v: q.v })), loads, cut, disp, dU, useAE, fmax, span, joints: jointSteps.map((s) => s.joint) },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const LEN = new Set(['x', 'y', 'a', 'h']), FOR = new Set(['F', 'Fx', 'Fy', 'P']);
  function convertState(st, from, to) {
    if (from === to) return st;
    const { convert, twin, UNITS } = Core;
    const kL = convert(1, UNITS[from].len, UNITS[to].len), f1 = twin(st.fu, to), kF = convert(1, st.fu, f1);
    const walk = (o) => {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach((k) => { const v = o[k]; if (typeof v === 'number') { if (LEN.has(k)) o[k] = tidy(v * kL, 9); else if (FOR.has(k)) o[k] = tidy(v * kF, 9); } else walk(v); });
    };
    st.a = tidy(+st.a * kL, 9); st.h = tidy(+st.h * kL, 9); st.P = tidy(+st.P * kF, 9);
    walk(st.custom);
    if (st.ae) {
      st.ae.E = tidy(convert(+st.ae.E, from === 'SI' ? 'GPa' : 'ksi', to === 'SI' ? 'GPa' : 'ksi'), 9);
      st.ae.A = tidy(convert(+st.ae.A, from === 'SI' ? 'mm²' : 'in²', to === 'SI' ? 'mm²' : 'in²'), 9);
    }
    st.fu = f1;
    return st;
  }

  const Truss = { defaults, solve, convertState, template, model, TEMPLATES };
  root.Truss = Truss;
  if (typeof module !== 'undefined' && module.exports) module.exports = Truss;
})(typeof window !== 'undefined' ? window : globalThis);
