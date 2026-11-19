/* =====================================================================
 * STATICS · Virtual Work (physics only; browser + Node)
 * Hibbeler, Engineering Mechanics: Statics, Chapter 11.
 *   A system with one degree of freedom q (an angle θ or a length x).
 *   Point positions, forces, spring stretches and an extra potential are
 *   written as formulas in q and named parameters, so any linkage of the
 *   chapter can be entered. The solver finds
 *     - the generalized force Q(q) = Σ F·dr/dq + Σ M dφ/dq − dV/dq,
 *     - every equilibrium position Q = 0 in the range, with its stability
 *       from d²V/dq² (conservative systems), or
 *     - the value of one parameter that holds the system at a given q.
 * Formulas are parsed by a small safe parser (no eval).
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const { fmt, fail, Steps } = Core;
  const PI = Math.PI, DEG = PI / 180;

  // the formula parser is shared with the Dynamics tab (shared/formula.js)
  const Formula = root.Formula || require('../shared/formula.js');
  const { FUNCS, CONST, compile } = Formula;
  const QNAMES = { angle: ['θ', 'theta', 'q', 'u'], length: ['x', 'q', 's'] };

  /* ------------------------------------------------------------------ */
  /* Defaults: two links with a spring and a load (Hibbeler 11-15 type) */
  /* ------------------------------------------------------------------ */
  function defaults() {
    return {
      task: 'eq', unk: 'P', F: 'lb', lu: 'ft',
      q: { kind: 'angle', min: 0, max: 90, at: 30 },
      params: [{ name: 'P', v: 8 }, { name: 'k', v: 50 }],
      points: [
        { name: 'O', x: '0', y: '0', sup: 'pin' },
        { name: 'B', x: '2 cos θ', y: '2 sin θ', sup: 'none' },
        { name: 'A', x: '4 cos θ', y: '4 sin θ', sup: 'none' },
      ],
      links: [{ pts: 'O B A' }],
      forces: [{ at: 'A', Fx: '0', Fy: 'P' }],
      weights: [],
      springs: [{ kind: 'expr', a: 'B', b: '', k: 'k', L0: '0', s: '2 sin θ' }],
      couples: [],
      V: '',
      vshow: true, plotQ: 'V',
    };
  }

  /** Build every formula; returns the model or an error list. */
  function build(st) {
    const err = [], kind = st.q.kind === 'length' ? 'length' : 'angle';
    const pnames = new Set();
    const params = {};
    (st.params || []).forEach((p, i) => {
      const n = String(p.name || '').trim();
      if (!/^[A-Za-z_Ͱ-Ͽ][A-Za-z_0-9Ͱ-Ͽ]*$/.test(n)) { err.push(`Parameter ${i + 1}: the name “${n}” must start with a letter and hold only letters, digits or _.`); return; }
      if (QNAMES[kind].includes(n) || FUNCS[n] || n in CONST) { err.push(`Parameter ${i + 1}: “${n}” is a reserved name.`); return; }
      if (pnames.has(n)) { err.push(`Parameter “${n}” is listed twice.`); return; }
      if (!isFinite(+p.v)) err.push(`Parameter “${n}” needs a number.`);
      pnames.add(n); params[n] = +p.v;
    });
    const names = new Set([...pnames, ...QNAMES[kind]]);
    const C = (src, where) => { try { return compile(src, names); } catch (e) { err.push(`${where}: ${e.message}.`); return () => NaN; } };
    const pts = {};
    (st.points || []).forEach((p, i) => {
      const n = String(p.name || '').trim();
      if (!n) { err.push(`Point ${i + 1} needs a name.`); return; }
      if (pts[n]) { err.push(`Point “${n}” is listed twice.`); return; }
      pts[n] = { name: n, sup: p.sup || 'none', fx: C(p.x, `Point ${n}, x`), fy: C(p.y, `Point ${n}, y`), sx: String(p.x), sy: String(p.y) };
    });
    const ptRef = (n, where) => { n = String(n || '').trim(); if (!pts[n]) { err.push(`${where}: there is no point “${n}”.`); return null; } return pts[n]; };
    const links = (st.links || []).map((l, i) => String(l.pts || '').trim().split(/[\s,–-]+/).filter(Boolean).map((n) => ptRef(n, `Member ${i + 1}`)).filter(Boolean)).filter((l) => l.length >= 2);
    const forces = (st.forces || []).map((f, i) => ({ p: ptRef(f.at, `Force ${i + 1}`), fx: C(f.Fx, `Force ${i + 1}, F_x`), fy: C(f.Fy, `Force ${i + 1}, F_y`), sx: String(f.Fx), sy: String(f.Fy) }));
    const weights = (st.weights || []).map((w, i) => ({ p: ptRef(w.at, `Weight ${i + 1}`), fw: C(w.W, `Weight ${i + 1}`), sw: String(w.W) }));
    const springs = (st.springs || []).map((s, i) => {
      const o = { kind: s.kind === 'pts' ? 'pts' : 'expr', fk: C(s.k, `Spring ${i + 1}, k`), sk: String(s.k) };
      if (o.kind === 'pts') { o.a = ptRef(s.a, `Spring ${i + 1}, end 1`); o.b = ptRef(s.b, `Spring ${i + 1}, end 2`); o.fL0 = C(s.L0, `Spring ${i + 1}, unstretched length`); o.sL0 = String(s.L0); }
      else { o.fs = C(s.s, `Spring ${i + 1}, stretch s`); o.ss = String(s.s); o.a = s.a ? pts[String(s.a).trim()] || null : null; }
      return o;
    });
    const couples = (st.couples || []).map((c, i) => ({ fm: C(c.M, `Couple ${i + 1}, M`), fphi: C(c.phi, `Couple ${i + 1}, angle φ`), sm: String(c.M), sphi: String(c.phi), p: c.at ? pts[String(c.at).trim()] || null : null }));
    const fV = st.V && String(st.V).trim() ? C(st.V, 'Potential energy V') : null;
    return { err, kind, params, pts, links, forces, weights, springs, couples, fV };
  }

  /* ------------------------------------------------------------------ */
  /* Evaluation                                                         */
  /* ------------------------------------------------------------------ */
  function envOf(md, q, over) {
    const e = Object.assign({}, md.params, over || {});
    QNAMES[md.kind].forEach((n) => (e[n] = q));
    return e;
  }
  const posOf = (p, e) => [p.fx(e), p.fy(e)];
  function stretch(sp, e) {
    if (sp.kind === 'pts') { const a = posOf(sp.a, e), b = posOf(sp.b, e); return Math.hypot(b[0] - a[0], b[1] - a[1]) - sp.fL0(e); }
    return sp.fs(e);
  }
  /** Potential energy from weights, springs and the extra V (conservative parts only). */
  function Vcons(md, e) {
    let V = 0;
    md.weights.forEach((w) => (V += w.fw(e) * w.p.fy(e)));
    md.springs.forEach((s) => { const x = stretch(s, e); V += 0.5 * s.fk(e) * x * x; });
    if (md.fV) V += md.fV(e);
    return V;
  }
  /** Generalized force Q(q) and the term-by-term breakdown. */
  function Qterms(md, q, over) {
    const h = md.kind === 'angle' ? 1e-5 : 1e-5 * Math.max(1, Math.abs(q));
    const e = envOf(md, q, over), ep = envOf(md, q + h, over), em = envOf(md, q - h, over);
    const d = (f) => (f(ep) - f(em)) / (2 * h);
    const T = [];
    md.forces.forEach((f, i) => {
      const Fx = f.fx(e), Fy = f.fy(e), dx = d(f.p.fx), dy = d(f.p.fy);
      T.push({ kind: 'force', i, name: `F${i + 1} at ${f.p.name}`, Fx, Fy, dx, dy, w: Fx * dx + Fy * dy });
    });
    md.couples.forEach((c, i) => { const M = c.fm(e), dphi = d(c.fphi); T.push({ kind: 'couple', i, name: `M${i + 1}`, M, dphi, w: M * dphi }); });
    md.weights.forEach((w, i) => { const W = w.fw(e), dy = d(w.p.fy); T.push({ kind: 'weight', i, name: `W${i + 1} at ${w.p.name}`, W, dy, w: -W * dy }); });
    md.springs.forEach((s, i) => { const k = s.fk(e), x = stretch(s, e), ds = d((ee) => stretch(s, ee)); T.push({ kind: 'spring', i, name: `Spring ${i + 1}`, k, s: x, F: k * x, ds, w: -k * x * ds }); });
    if (md.fV) T.push({ kind: 'V', name: 'Potential V', dV: d(md.fV), w: -d(md.fV) });
    return { Q: T.reduce((a, t) => a + t.w, 0), T };
  }
  const Q = (md, q, over) => Qterms(md, q, over).Q;

  /** Are the applied forces and couples constant (so that they have a potential)? */
  function conservative(md, lo, hi) {
    const qs = [lo, (lo + hi) / 2, hi, lo + 0.37 * (hi - lo)];
    const same = (f) => { const v = qs.map((q) => f(envOf(md, q))); return v.every((x) => Math.abs(x - v[0]) <= 1e-9 * Math.max(1, Math.abs(v[0]))); };
    return md.forces.every((f) => same(f.fx) && same(f.fy)) && md.couples.every((c) => same(c.fm)) && md.weights.every((w) => same(w.fw)) && md.springs.every((s) => same(s.fk));
  }
  /** Total potential energy (only when conservative): forces and couples contribute −F·r and −Mφ. */
  function Vtot(md, q) {
    const e = envOf(md, q);
    let V = Vcons(md, e);
    md.forces.forEach((f) => (V -= f.fx(e) * f.p.fx(e) + f.fy(e) * f.p.fy(e)));
    md.couples.forEach((c) => (V -= c.fm(e) * c.fphi(e)));
    return V;
  }

  /* ------------------------------------------------------------------ */
  /* Solve                                                              */
  /* ------------------------------------------------------------------ */
  function solve(st) {
    const md = build(st);
    if (md.err.length) return fail(md.err);
    const ang = md.kind === 'angle', F = st.F || 'N', Lu = st.lu || 'm', E = `${F}·${Lu}`;
    const qs = ang ? 'θ' : 'x', qu = ang ? '°' : Lu;
    const toQ = (v) => (ang ? v * DEG : v), fromQ = (v) => (ang ? v / DEG : v);
    const qmin = +st.q.min, qmax = +st.q.max;
    if (!(isFinite(qmin) && isFinite(qmax) && qmax > qmin)) return fail(`Enter a range for ${qs} with the end larger than the start.`);
    const lo = toQ(qmin), hi = toQ(qmax);
    if (!md.forces.length && !md.weights.length && !md.springs.length && !md.couples.length && !md.fV) return fail('Add at least one force, weight, spring, couple or a potential energy V.');
    const cons = conservative(md, lo, hi);
    const S = Steps(), out = [], warn = [];
    const Qper = ang ? `${E}/rad` : F, d2u = ang ? `${E}/rad²` : `${F}/${Lu}`;

    // Step 1: coordinates
    const pl = Object.values(md.pts);
    if (pl.length) S.add({ t: 'Position coordinates', n: `Each point is located from fixed axes by the independent coordinate ${qs}${ang ? ' (θ in radians inside the formulas)' : ''}. A virtual displacement δ${qs} moves each point by δx = (dx/d${qs}) δ${qs} and δy = (dy/d${qs}) δ${qs}.`, table: { head: ['Point', 'x', 'y'], rows: pl.map((p) => [p.name, p.sx, p.sy]) } });
    const parts = [];
    md.forces.forEach((f, i) => parts.push([`F${i + 1} at ${f.p.name}`, `F_x δx_${f.p.name} + F_y δy_${f.p.name}`, `F_x = ${f.sx}, F_y = ${f.sy}`]));
    md.couples.forEach((c, i) => parts.push([`M${i + 1}`, 'M δφ', `M = ${c.sm}, φ = ${c.sphi}`]));
    md.weights.forEach((w, i) => parts.push([`W${i + 1} at ${w.p.name}`, `−W δy_${w.p.name}`, `W = ${w.sw}`]));
    md.springs.forEach((s, i) => parts.push([`Spring ${i + 1}`, '−F_s δs = −k s δs', `k = ${s.sk}, s = ${s.kind === 'pts' ? `${s.a.name}${s.b.name} − (${s.sL0})` : s.ss}`]));
    if (md.fV) parts.push(['Potential V', `−(dV/d${qs}) δ${qs}`, `V = ${st.V}`]);
    S.add({ t: 'Virtual-work equation', n: 'Only the active forces do work: applied forces and couples, weights and spring forces. Reactions at fixed pins and smooth guides do no work. Positive work: a force along the displacement of its point; a couple turning the way its member turns. A weight does −W δy and a spring −k s δs (s is the stretch).', f: `δU = Σ (work of each term) = Q(${qs}) δ${qs} = 0, so Q(${qs}) = 0`, table: { head: ['Term', 'Virtual work', 'With'], rows: parts } });

    const rowAt = (q, over) => {
      const qt = Qterms(md, q, over);
      return qt.T.map((t) => {
        if (t.kind === 'force') return [t.name, `F = (${fmt(t.Fx)}, ${fmt(t.Fy)})`, `(${fmt(t.dx)}, ${fmt(t.dy)})`, fmt(t.w)];
        if (t.kind === 'couple') return [t.name, `M = ${fmt(t.M)}`, `dφ/d${qs} = ${fmt(t.dphi)}`, fmt(t.w)];
        if (t.kind === 'weight') return [t.name, `W = ${fmt(t.W)}`, `dy/d${qs} = ${fmt(t.dy)}`, fmt(t.w)];
        if (t.kind === 'spring') return [t.name, `s = ${fmt(t.s)}, F_s = ${fmt(t.F)}`, `ds/d${qs} = ${fmt(t.ds)}`, fmt(t.w)];
        return [t.name, '', `dV/d${qs} = ${fmt(t.dV)}`, fmt(t.w)];
      }).concat([['Σ = Q', '', '', fmt(qt.Q)]]);
    };
    const head = ['Term', 'Value', `d(position)/d${qs}`, `work per δ${qs} (${Qper})`];

    // sample Q for the plot and the scan
    const N = 720, samp = [];
    for (let i = 0; i <= N; i++) { const q = lo + ((hi - lo) * i) / N; samp.push([q, Q(md, q)]); }
    const scaleQ = Math.max(1e-12, ...samp.map((s) => (isFinite(s[1]) ? Math.abs(s[1]) : 0)));
    const geo = { kind: md.kind, md, lo, hi, cons, F, Lu, E, qs, qu, roots: [], Qs: samp, Vs: cons ? samp.map(([q]) => [q, Vtot(md, q)]) : null };

    if (st.task === 'param') {
      const pn = String(st.unk || '').trim();
      if (!(pn in md.params)) return fail(`Choose the unknown from the parameters (there is no parameter “${pn}”).`);
      const q0 = toQ(+st.q.at);
      if (!isFinite(q0)) return fail(`Enter the position ${qs} to hold.`);
      const g = (v) => Q(md, q0, { [pn]: v });
      let a = md.params[pn] || 1, b = a === 0 ? 1 : a * 1.1 + 0.1, ga = g(a), gb = g(b), x = NaN;
      for (let it = 0; it < 60; it++) {
        if (!isFinite(ga) || !isFinite(gb)) break;
        if (Math.abs(gb) <= 1e-12 * scaleQ) { x = b; break; }
        if (gb === ga) break;
        const c = b - (gb * (b - a)) / (gb - ga);
        a = b; ga = gb; b = c; gb = g(b);
        if (Math.abs(b - a) <= 1e-12 * Math.max(1, Math.abs(b))) { x = b; break; }
      }
      if (!isFinite(x) || Math.abs(g(x)) > 1e-7 * Math.max(scaleQ, Math.abs(g(x + 1) - g(x)))) return fail(`No value of ${pn} holds the system at ${qs} = ${fmt(+st.q.at)}${qu}: the virtual work does not depend on ${pn} there, or has no root.`);
      const lin = Math.abs(g(x * 2 + 1) - 2 * g(x) + g(-1)) < 1e-6 * (Math.abs(g(x * 2 + 1)) + 1e-9) ? '' : ' (nonlinear in the unknown; solved by iteration)';
      S.add({ t: `Virtual work at ${qs} = ${fmt(+st.q.at)}${qu}`, n: `The equation is evaluated at the equilibrium position and solved for ${pn}${lin}. The table shows each term with ${pn} = ${fmt(x)}.`, table: { head, rows: rowAt(q0, { [pn]: x }) }, r: `${pn} = ${fmt(x)}` });
      out.push({ k: `Unknown ${pn} for equilibrium`, v: x, u: ((st.params || []).find((p) => String(p.name).trim() === pn) || {}).u || '', hl: true }, { k: `At position ${qs}`, v: +st.q.at, u: qu });
      geo.show = q0; geo.over = { [pn]: x }; geo.unk = pn; geo.unkV = x;
      return { ok: true, err: [], warn, status: { cls: 'ok', text: `${pn} = ${fmt(x)}` }, out, steps: S.list, geo };
    }

    // equilibrium positions: sign changes and touching zeros
    const roots = [];
    const tol = 1e-9 * scaleQ;
    const addRoot = (q) => { if (!roots.some((r) => Math.abs(r - q) < (hi - lo) * 1e-6)) roots.push(q); };
    for (let i = 0; i <= N; i++) {
      const [q, v] = samp[i];
      if (!isFinite(v)) continue;
      if (Math.abs(v) <= tol) { addRoot(q); continue; }
      if (i < N) {
        const [q2, v2] = samp[i + 1];
        if (isFinite(v2) && Math.abs(v2) > tol && Math.sign(v) !== Math.sign(v2)) {
          let a = q, b = q2, fa = v;
          for (let k = 0; k < 80; k++) { const m = (a + b) / 2, fm = Q(md, m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
          const r = (a + b) / 2;
          if (Math.abs(Q(md, r)) < 1e-6 * scaleQ) addRoot(r); // skip jumps through infinity
        }
        // a curve that touches zero between samples (double root)
        if (i > 0 && i < N) {
          const v0 = samp[i - 1][1];
          if (Math.abs(v) < Math.abs(v0) && Math.abs(v) < Math.abs(v2) && Math.sign(v0) === Math.sign(v) && Math.sign(v2) === Math.sign(v) && Math.abs(v) < 1e-3 * scaleQ) {
            let a = samp[i - 1][0], b = samp[i + 1][0];
            for (let k = 0; k < 80; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (Math.abs(Q(md, m1)) < Math.abs(Q(md, m2))) b = m2; else a = m1; }
            const r = (a + b) / 2;
            if (Math.abs(Q(md, r)) < 1e-7 * scaleQ) addRoot(r);
          }
        }
      }
    }
    roots.sort((a, b) => a - b);
    if (!roots.length) {
      geo.show = lo + (hi - lo) / 2;
      return fail(`No equilibrium position between ${qs} = ${fmt(qmin)}${qu} and ${fmt(qmax)}${qu}: the virtual work Q never becomes zero there. Widen the range or check the signs of the forces.`);
    }
    const hq = ang ? 1e-4 : 1e-4 * Math.max(1, (hi - lo));
    const info = roots.map((r) => {
      const dQ = (Q(md, r + hq) - Q(md, r - hq)) / (2 * hq), d2V = -dQ, sc = Math.max(1e-9, scaleQ / (hi - lo));
      let stab = Math.abs(d2V) < 1e-6 * sc ? 'neutral' : d2V > 0 ? 'stable' : 'unstable';
      if (stab === 'neutral') {
        // higher derivatives decide: look at V on either side
        const a = Vtot(md, r - (hi - lo) * 0.01), b = Vtot(md, r + (hi - lo) * 0.01), c0 = Vtot(md, r);
        if (cons) stab = a > c0 && b > c0 ? 'stable' : a < c0 && b < c0 ? 'unstable' : 'neutral';
      }
      return { q: r, d2V, stab };
    });
    S.add({ t: 'Equilibrium positions', n: `Q(${qs}) is evaluated across ${fmt(qmin)}${qu} ≤ ${qs} ≤ ${fmt(qmax)}${qu}; every zero is an equilibrium position. The plot below shows the curve.`, f: `Q(${qs}) = 0`, r: info.map((x, i) => `${qs}${info.length > 1 ? '_' + (i + 1) : ''} = ${fmt(fromQ(x.q))}${qu}`).join(',  ') });
    info.forEach((x, i) => S.add({ t: `Check at ${qs} = ${fmt(fromQ(x.q))}${qu}`, n: 'Each term of the virtual-work equation at this position. They add up to zero.', table: { head, rows: rowAt(x.q) } }));
    if (cons) {
      S.add({ t: 'Stability', n: `The forces are conservative, so the potential energy V = V_g + V_e − Σ F·r − Σ Mφ exists and dV/d${qs} = −Q. The second derivative decides: d²V/d${qs}² > 0 stable, < 0 unstable, = 0 neutral (then the higher derivatives decide).`, f: `d²V/d${qs}² = −dQ/d${qs}`, table: { head: [`${qs} (${qu})`, `d²V/d${qs}² (${d2u})`, 'Equilibrium'], rows: info.map((x) => [fmt(fromQ(x.q)), fmt(x.d2V), x.stab]) } });
    } else {
      warn.push('Some forces change with the position, so they have no potential energy. Stability is not judged for this system.');
    }
    info.forEach((x, i) => {
      const tag = info.length > 1 ? ` ${i + 1}` : '';
      out.push({ k: `Equilibrium position${tag} ${qs}`, v: fromQ(x.q), u: qu, hl: true });
      if (cons) { out.push({ k: `d²V/d${qs}² at position${tag}`, v: x.d2V, u: d2u }, { k: `Stability at position${tag}`, v: x.stab }); }
    });
    geo.roots = info;
    const firstStable = info.find((x) => x.stab === 'stable');
    geo.show = (firstStable || info[0]).q;
    return { ok: true, err: [], warn, status: { cls: 'ok', text: `${info.length} equilibrium position${info.length > 1 ? 's' : ''}` }, out, steps: S.list, geo };
  }

  /** Evaluate every point at q (for the drawing). */
  function pointsAt(md, q, over) {
    const e = envOf(md, q, over), o = {};
    Object.values(md.pts).forEach((p) => { o[p.name] = [p.fx(e), p.fy(e)]; });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Units: formulas cannot be converted, so only the unit labels change */
  /* ------------------------------------------------------------------ */
  function convertState(st, from, to) {
    st.F = Core.twin(st.F, to) === st.F ? (to === 'US' ? 'lb' : 'N') : Core.twin(st.F, to);
    st.lu = Core.twin(st.lu, to) === st.lu ? (to === 'US' ? 'ft' : 'm') : Core.twin(st.lu, to);
    if (st.q.kind === 'length') return;
  }

  const VWork = { defaults, solve, convertState, compile, build, envOf, pointsAt, Qterms, stretch, Vtot, QNAMES, DEG };
  root.VWork = VWork;
  if (typeof module !== 'undefined' && module.exports) module.exports = VWork;
})(typeof window !== 'undefined' ? window : globalThis);
