/* =====================================================================
 * BEAM ENGINE (physics only; runs in the browser and in Node)
 * ---------------------------------------------------------------------
 * A straight horizontal beam of length L, x measured from the left end.
 *
 * model = {
 *   L,
 *   supports: [{ type: 'pin' | 'roller' | 'fixed', x }],
 *   loads: [
 *     { kind: 'point',  x, P, ang }    P acts at `ang` degrees below the +x axis
 *                                      (90 = straight down, 60 = down and to the right)
 *     { kind: 'couple', x, M, dir }    dir 'cw' or 'ccw'
 *     { kind: 'dist',   x1, x2, w1, w2 }  intensities at x1 and x2, positive downward
 *   ],
 *   hinges: [x, …]                     internal hinges (moment = 0)
 * }
 *
 * Sign convention (Hibbeler, Fig. 7-10): on the right-hand face of a left
 * segment, positive N is tension, positive V acts downward and positive M
 * is counterclockwise (it bends the beam concave upward). With w positive
 * upward, dV/dx = w and dM/dx = V.
 *
 * The engine works in any consistent pair of units (force F, length Lu);
 * opt = { F: 'kN', Lu: 'm' } is only used to label the worked steps.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('./core.js');
  const { fmt, sumStr, polyStr, linSolve } = Core;
  const DEG = Math.PI / 180;
  const LETTERS = 'ABCDEFGH';

  /** ∫w dx and ∫w·x dx of a linearly varying load between a and b (wa at a, wb at b). */
  function distInt(a, b, wa, wb) {
    const F = 0.5 * (wa + wb) * (b - a);
    const Fx = ((b - a) * (wa * (2 * a + b) + wb * (a + 2 * b))) / 6;
    return { F, Fx, xbar: Math.abs(F) > 1e-12 ? Fx / F : 0.5 * (a + b) };
  }
  /** The part of a distributed load that lies between lo and hi (or null). */
  function clip(d, lo, hi) {
    const a = Math.max(d.x1, lo), b = Math.min(d.x2, hi);
    if (!(b > a + 1e-12)) return null;
    const w = (x) => d.w1 + ((d.w2 - d.w1) * (x - d.x1)) / (d.x2 - d.x1);
    return Object.assign({ a, b, wa: w(a), wb: w(b) }, distInt(a, b, w(a), w(b)));
  }

  function check(m) {
    const err = [];
    const num = (v) => typeof v === 'number' && isFinite(v);
    if (!num(m.L) || m.L <= 0) return ['The beam length must be greater than zero.'];
    const L = m.L, inside = (x) => num(x) && x >= -1e-9 && x <= L + 1e-9;
    if (!m.supports || !m.supports.length) err.push('The beam has no support. Add a pin, a roller or a fixed support.');
    (m.supports || []).forEach((s, i) => {
      if (!inside(s.x)) err.push(`Support ${i + 1} is outside the beam (x must be between 0 and ${fmt(L)}).`);
      (m.supports || []).forEach((t, j) => { if (j > i && Math.abs(t.x - s.x) < 1e-9) err.push(`Supports ${i + 1} and ${j + 1} are at the same position.`); });
    });
    (m.loads || []).forEach((q, i) => {
      const n = `Load ${i + 1}`;
      if (q.kind === 'dist') {
        if (!inside(q.x1) || !inside(q.x2)) err.push(`${n}: the distributed load must start and end on the beam.`);
        else if (!(q.x2 > q.x1 + 1e-9)) err.push(`${n}: the end of the distributed load must be to the right of its start.`);
        if (!num(q.w1) || !num(q.w2)) err.push(`${n}: enter both intensities.`);
        else if (q.w1 * q.w2 < 0) err.push(`${n}: the intensity changes sign. Enter it as two separate loads.`);
      } else {
        if (!inside(q.x)) err.push(`${n} is outside the beam (x must be between 0 and ${fmt(L)}).`);
        if (q.kind === 'point' && !num(q.P)) err.push(`${n}: enter the force.`);
        if (q.kind === 'couple' && !num(q.M)) err.push(`${n}: enter the couple moment.`);
      }
    });
    (m.hinges || []).forEach((x, i) => {
      if (!num(x) || x <= 1e-9 || x >= L - 1e-9) err.push(`Hinge ${i + 1} must lie between the ends of the beam.`);
      (m.supports || []).forEach((s) => { if (s.type === 'fixed' && Math.abs(s.x - x) < 1e-9) err.push(`Hinge ${i + 1} is at a fixed support.`); });
      (m.loads || []).forEach((q) => { if (q.kind === 'couple' && Math.abs(q.x - x) < 1e-9) err.push(`A couple acts exactly at hinge ${i + 1}. Move it slightly to one side.`); });
      (m.hinges || []).forEach((y, j) => { if (j > i && Math.abs(y - x) < 1e-9) err.push('Two hinges are at the same position.'); });
    });
    return err;
  }

  function solve(model, opt) {
    opt = opt || {};
    const F = opt.F || '', Lu = opt.Lu || '', FL = F && Lu ? `${F}·${Lu}` : '', WL = F && Lu ? `${F}/${Lu}` : '';
    const u = (v, unit) => `${fmt(v)}${unit ? ' ' + unit : ''}`;
    const err = check(model);
    if (err.length) return { ok: false, err, warn: [] };
    const L = model.L, warn = [];
    const sups = model.supports.map((s) => ({ type: s.type, x: Math.min(L, Math.max(0, s.x)) })).sort((a, b) => a.x - b.x);
    sups.forEach((s, i) => (s.label = LETTERS[i] || 'S' + (i + 1)));
    const hinges = (model.hinges || []).slice().sort((a, b) => a - b);
    const hname = (i) => (hinges.length > 1 ? 'H' + (i + 1) : 'H');

    /* ---- applied loads as concentrated actions (Fx right +, Fy up +, Mz counterclockwise +) ---- */
    const acts = [], dists = [];
    (model.loads || []).forEach((q, i) => {
      if (q.kind === 'point') {
        if (!q.P) return;
        const a = (q.ang === undefined ? 90 : q.ang) * DEG;
        let fx = q.P * Math.cos(a), fy = -q.P * Math.sin(a);
        if (Math.abs(fx) < 1e-12 * Math.abs(q.P)) fx = 0;
        if (Math.abs(fy) < 1e-12 * Math.abs(q.P)) fy = 0;
        acts.push({ x: q.x, Fx: fx, Fy: fy, Mz: 0, src: 'load', i, P: q.P, ang: q.ang === undefined ? 90 : q.ang });
      } else if (q.kind === 'couple') {
        if (!q.M) return;
        acts.push({ x: q.x, Fx: 0, Fy: 0, Mz: q.dir === 'cw' ? -q.M : q.M, src: 'load', i });
      } else if (q.kind === 'dist') {
        if (!q.w1 && !q.w2) return;
        dists.push(Object.assign({ i, x1: q.x1, x2: q.x2, w1: q.w1, w2: q.w2 }, distInt(q.x1, q.x2, q.w1, q.w2)));
      }
    });
    const hasAxial = acts.some((a) => a.Fx !== 0);

    /* ---- unknown reactions ---- */
    const unk = [];
    sups.forEach((s) => {
      if (s.type === 'pin' || s.type === 'fixed') unk.push({ sym: `${s.label}_x`, kind: 'Fx', x: s.x, sup: s });
      unk.push({ sym: `${s.label}_y`, kind: 'Fy', x: s.x, sup: s });
      if (s.type === 'fixed') unk.push({ sym: `M_${s.label}`, kind: 'M', x: s.x, sup: s });
    });

    /* ---- equilibrium equations: each is { title, short, u: [{coef, arm}], known: [terms], rhs } ---- */
    const sideOK = (x, c, side) => (side === 'all' ? true : side === 'left' ? x < c - 1e-9 : x > c + 1e-9);
    function forceEq(kind) {
      const e = { u: unk.map((k) => ({ coef: k.kind === kind ? 1 : 0, arm: null })), known: [], sum: 0 };
      acts.forEach((a) => { const v = kind === 'Fx' ? a.Fx : a.Fy; if (v) { e.known.push({ v, txt: fmt(Math.abs(v)) }); e.sum += v; } });
      if (kind === 'Fy') dists.forEach((d) => { if (d.F) { e.known.push({ v: -d.F, txt: fmt(Math.abs(d.F)) }); e.sum -= d.F; } });
      return e;
    }
    function momentEq(c, side) {
      const e = { u: [], known: [], sum: 0 };
      unk.forEach((k) => {
        const inPart = side === 'all' || sideOK(k.x, c, side);
        if (k.kind === 'Fy' && inPart) e.u.push({ coef: k.x - c, arm: Math.abs(k.x - c) });
        else if (k.kind === 'M' && inPart) e.u.push({ coef: 1, arm: null });
        else e.u.push({ coef: 0, arm: null });
      });
      acts.forEach((a) => {
        if (!sideOK(a.x, c, side)) return;
        if (a.Fy && Math.abs(a.x - c) > 1e-9) { const v = a.Fy * (a.x - c); e.known.push({ v, txt: `${fmt(Math.abs(a.Fy))}(${fmt(Math.abs(a.x - c))})` }); e.sum += v; }
        if (a.Mz) { e.known.push({ v: a.Mz, txt: fmt(Math.abs(a.Mz)) }); e.sum += a.Mz; }
      });
      dists.forEach((d) => {
        const p = side === 'all' ? clip(d, 0, L) : side === 'left' ? clip(d, 0, c) : clip(d, c, L);
        if (!p || !p.F) return;
        const v = -(p.Fx - c * p.F);
        if (Math.abs(v) > 1e-12) e.known.push({ v, txt: `${fmt(Math.abs(p.F))}(${fmt(Math.abs(p.xbar - c))})` });
        e.sum += v;
      });
      return e;
    }
    const eqs = [];
    const add = (e, title, short, group) => { e.title = title; e.short = short; e.group = group; eqs.push(e); return e; };
    add(forceEq('Fx'), 'Sum of horizontal forces', '→+ ΣF_x = 0', 'Fx');
    hinges.forEach((xh, i) => {
      add(momentEq(xh, 'left'), `Moments about hinge ${hname(i)}, part of the beam to its left`, `↺+ ΣM_${hname(i)} = 0 (left part)`, 'h' + i);
      add(momentEq(xh, 'right'), `Moments about hinge ${hname(i)}, part of the beam to its right`, `↺+ ΣM_${hname(i)} = 0 (right part)`, 'h' + i);
    });
    add(forceEq('Fy'), 'Sum of vertical forces', '+↑ ΣF_y = 0', 'Fy');
    const order = sups.slice().sort((a, b) => (a.type === 'roller') - (b.type === 'roller'));
    order.forEach((s) => add(momentEq(s.x, 'all'), `Sum of moments about ${s.label}`, `↺+ ΣM_${s.label} = 0`, 'M'));

    /* ---- determinacy and the numerical solution ---- */
    const base = [eqs.find((e) => e.group === 'Fx'), eqs.find((e) => e.group === 'Fy'), momentEq(0, 'all')]
      .concat(hinges.map((xh, i) => eqs.find((e) => e.group === 'h' + i)));
    const r = unk.length, neq = base.length;
    const sys = linSolve(base.map((e) => e.u.map((t) => t.coef)), base.map((e) => -e.sum));
    const det = { r, neq, rank: sys.rank, hinges: hinges.length };
    const count = `${r} unknown reaction${r === 1 ? '' : 's'} and ${neq} equation${neq === 1 ? '' : 's'} of equilibrium` + (hinges.length ? ` (3 for the beam plus ${hinges.length} for the hinge${hinges.length > 1 ? 's' : ''})` : '');
    if (r > sys.rank) {
      if (r > neq) { det.cls = 'indeterminate'; det.degree = r - neq; det.text = `Statically indeterminate to the ${ordinal(r - neq)} degree: ${count}. The equations of equilibrium alone cannot give the reactions.`; }
      else { det.cls = 'improper'; det.text = `Improperly constrained: ${count}, but the reactions are parallel or concurrent, so they cannot hold the beam in place.`; }
      return { ok: false, err: [det.text], warn, det, L, sups, hinges };
    }
    if (!sys.consistent) {
      det.cls = 'unstable';
      det.text = `Unstable (partially constrained): ${count}. The supports cannot keep this loading in equilibrium, so the beam would move.`;
      return { ok: false, err: [det.text], warn, det, L, sups, hinges };
    }
    if (sys.rank < neq) { det.cls = 'partial'; det.text = `Partially constrained: ${count}. The beam is held only for this loading (for example, nothing resists a horizontal force).`; warn.push(det.text); }
    else { det.cls = 'determinate'; det.text = `Statically determinate: ${count}.`; }
    unk.forEach((k, j) => { k.value = Math.abs(sys.x[j]) < 1e-11 ? 0 : sys.x[j]; });

    /* ---- worked steps for the reactions ---- */
    const stepsReact = [];
    if (dists.length) {
      stepsReact.push({
        t: 'Replace each distributed load by its resultant',
        n: 'The resultant equals the area of the loading diagram and acts through its centroid.',
        f: 'F_R = ½(w₁ + w₂)(x₂ − x₁);  x̄ = x₁ + (x₂ − x₁)(w₁ + 2w₂) / [3(w₁ + w₂)]',
        table: {
          head: ['Load', `w₁ → w₂ (${WL})`, `from → to (${Lu})`, `F_R (${F})`, `x̄ (${Lu})`],
          rows: dists.map((d) => [`${d.i + 1}`, `${fmt(d.w1)} → ${fmt(d.w2)}`, `${fmt(d.x1)} → ${fmt(d.x2)}`, fmt(d.F), fmt(d.xbar)]),
        },
      });
    }
    const incl = acts.filter((a) => a.src === 'load' && a.P !== undefined && a.Fx !== 0);
    if (incl.length) {
      stepsReact.push({
        t: 'Resolve the inclined forces into components',
        f: 'F_x = P cos θ (along the beam);  F_y = P sin θ (perpendicular to the beam)',
        table: { head: ['Load', `P (${F})`, 'θ (°)', `F_x → (${F})`, `F_y ↓ (${F})`], rows: incl.map((a) => [`${a.i + 1}`, fmt(a.P), fmt(a.ang), fmt(a.Fx), fmt(-a.Fy)]) },
      });
    }
    stepsReact.push({
      t: 'Free-body diagram and determinacy',
      n: 'Reactions are assumed to act upward, to the right and counterclockwise.',
      s: `Unknowns: ${unk.map((k) => k.sym).join(', ')}`,
      r: det.text,
    });
    const solved = new Set();
    const eqText = (e) => {
      const terms = [];
      unk.forEach((k, j) => {
        const t = e.u[j]; if (Math.abs(t.coef) < 1e-12) return;
        if (solved.has(j)) {
          if (k.value === 0) return;
          terms.push({ v: t.coef * k.value, txt: t.arm === null ? fmt(Math.abs(k.value)) : `${fmt(Math.abs(k.value))}(${fmt(t.arm)})` });
        } else terms.push({ v: t.coef, txt: t.arm === null ? k.sym : `${k.sym}(${fmt(t.arm)})` });
      });
      return `${sumStr(terms.concat(e.known))} = 0`;
    };
    const dirNote = (k) => {
      if (k.value >= 0) return '';
      return `The negative sign means ${k.sym} acts opposite to the assumed direction: ${k.kind === 'Fx' ? 'to the left' : k.kind === 'Fy' ? 'downward' : 'clockwise'}.`;
    };
    const used = new Set();
    let guard = 0;
    while (solved.size < r && guard++ < 40) {
      let pick = -1, target = -1;
      for (let i = 0; i < eqs.length && pick < 0; i++) {
        if (used.has(i)) continue;
        const open = []; eqs[i].u.forEach((t, j) => { if (Math.abs(t.coef) > 1e-12 && !solved.has(j)) open.push(j); });
        if (open.length === 1) { pick = i; target = open[0]; }
      }
      if (pick < 0) break;
      const e = eqs[pick], k = unk[target];
      stepsReact.push({ t: e.title, f: e.short, s: eqText(e), r: `${k.sym} = ${u(k.value, k.kind === 'M' ? FL : F)}`, n: dirNote(k) || undefined });
      used.add(pick); solved.add(target);
      // the two hinge equations are alternatives; a force equation is used once
    }
    if (solved.size < r) {
      const rest = eqs.filter((e, i) => !used.has(i) && e.u.some((t, j) => Math.abs(t.coef) > 1e-12 && !solved.has(j))).slice(0, r - solved.size + 1);
      stepsReact.push({
        t: 'Remaining equations, solved together',
        f: rest.map((e) => `${e.short}:  ${eqText(e)}`).join('   |   '),
        r: unk.filter((k, j) => !solved.has(j)).map((k) => `${k.sym} = ${u(k.value, k.kind === 'M' ? FL : F)}`).join(';  '),
      });
    }

    /* ---- reactions as actions ---- */
    const reactions = sups.map((s) => ({ label: s.label, type: s.type, x: s.x, Rx: 0, Ry: 0, M: 0 }));
    unk.forEach((k) => {
      const R = reactions[sups.indexOf(k.sup)];
      if (k.kind === 'Fx') R.Rx = k.value; else if (k.kind === 'Fy') R.Ry = k.value; else R.M = k.value;
    });
    const all = acts.slice();
    reactions.forEach((R) => { if (R.Rx || R.Ry || R.M) all.push({ x: R.x, Fx: R.Rx, Fy: R.Ry, Mz: R.M, src: 'react', label: R.label }); });

    /* ---- piecewise N, V, M ---- */
    const xs = [0, L];
    all.forEach((a) => xs.push(a.x)); sups.forEach((s) => xs.push(s.x)); dists.forEach((d) => xs.push(d.x1, d.x2)); hinges.forEach((x) => xs.push(x));
    xs.sort((a, b) => a - b);
    const events = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 1e-9);
    const jump = (x) => { const j = { Fx: 0, Fy: 0, Mz: 0 }; all.forEach((a) => { if (Math.abs(a.x - x) < 1e-9) { j.Fx += a.Fx; j.Fy += a.Fy; j.Mz += a.Mz; } }); return j; };
    const segs = [];
    let N = 0, V = 0, M = 0, scaleV = 0, scaleM = 0;
    for (let i = 0; i < events.length; i++) {
      const a = events[i], j = jump(a);
      N -= j.Fx; V += j.Fy; M -= j.Mz;
      if (i === events.length - 1) break;
      const b = events[i + 1], hh = b - a;
      let qa = 0, qb = 0;
      dists.forEach((d) => { const p = clip(d, a, b); if (p) { qa -= p.wa; qb -= p.wb; } });
      const q0 = qa, q1 = (qb - qa) / hh;
      const sg = { a, b, q0, q1, N, Va: V, Ma: M };
      sg.Vb = V + q0 * hh + (q1 * hh * hh) / 2;
      sg.Mb = M + V * hh + (q0 * hh * hh) / 2 + (q1 * hh * hh * hh) / 6;
      sg.cV = [V - q0 * a + (q1 * a * a) / 2, q0 - q1 * a, q1 / 2];
      sg.cM = [M - V * a + (q0 * a * a) / 2 - (q1 * a * a * a) / 6, V - q0 * a + (q1 * a * a) / 2, q0 / 2 - (q1 * a) / 2, q1 / 6];
      sg.V = (x) => { const s = x - a; return sg.Va + q0 * s + (q1 * s * s) / 2; };
      sg.M = (x) => { const s = x - a; return sg.Ma + sg.Va * s + (q0 * s * s) / 2 + (q1 * s * s * s) / 6; };
      sg.w = (x) => q0 + q1 * (x - a);
      segs.push(sg);
      scaleV = Math.max(scaleV, Math.abs(sg.Va), Math.abs(sg.Vb)); scaleM = Math.max(scaleM, Math.abs(sg.Ma), Math.abs(sg.Mb));
      V = sg.Vb; M = sg.Mb;
    }
    const closure = { N, V, M };
    const zV = 1e-9 * (scaleV || 1), zM = 1e-9 * (scaleM || scaleV * L || 1);
    const cl = (v, z) => (Math.abs(v) < z ? 0 : v);
    segs.forEach((sg) => {
      sg.Va = cl(sg.Va, zV); sg.Vb = cl(sg.Vb, zV); sg.Ma = cl(sg.Ma, zM); sg.Mb = cl(sg.Mb, zM); sg.N = cl(sg.N, zV);
      sg.cV = sg.cV.map((c, i) => cl(c, zV / Math.pow(L, i))); sg.cM = sg.cM.map((c, i) => cl(c, zM / Math.pow(L, i)));
    });

    function at(x, side) {
      x = Math.min(L, Math.max(0, x));
      if (!side) side = x >= L - 1e-9 ? 'L' : 'R';
      if (side === 'L' && x <= 1e-9) return { N: 0, V: 0, M: 0 };
      if (side === 'R' && x >= L - 1e-9) return { N: 0, V: 0, M: 0 };
      let sg = null;
      for (const g of segs) {
        if (side === 'R' ? (x >= g.a - 1e-9 && x < g.b - 1e-9) : (x > g.a + 1e-9 && x <= g.b + 1e-9)) { sg = g; break; }
      }
      if (!sg) sg = segs[segs.length - 1];
      return { N: sg.N, V: cl(sg.V(x), zV), M: cl(sg.M(x), zM), seg: sg };
    }

    /* ---- extreme values ---- */
    const cand = [], zeros = [];
    segs.forEach((sg, i) => {
      cand.push({ x: sg.a, V: sg.Va, M: sg.Ma, N: sg.N }, { x: sg.b, V: sg.Vb, M: sg.Mb, N: sg.N });
      const hh = sg.b - sg.a, roots = [];
      if (Math.abs(sg.q1) > 1e-12) {
        const A = sg.q1 / 2, B = sg.q0, Cc = sg.Va, disc = B * B - 4 * A * Cc;
        if (disc >= 0) { const sq = Math.sqrt(disc); roots.push((-B + sq) / (2 * A), (-B - sq) / (2 * A)); }
        const sw = -sg.q0 / sg.q1; // w = 0: V is stationary
        if (sw > 1e-9 * hh && sw < hh * (1 - 1e-9)) cand.push({ x: sg.a + sw, V: sg.V(sg.a + sw), M: sg.M(sg.a + sw), N: sg.N });
      } else if (Math.abs(sg.q0) > 1e-12) roots.push(-sg.Va / sg.q0);
      roots.forEach((s) => {
        if (s > 1e-7 * hh && s < hh * (1 - 1e-7)) { const x = sg.a + s; zeros.push({ x, M: sg.M(x), kind: 'root' }); cand.push({ x, V: 0, M: sg.M(x), N: sg.N }); }
      });
      const prevV = i === 0 ? 0 : segs[i - 1].Vb;
      if (i > 0 && prevV * sg.Va < 0) zeros.push({ x: sg.a, M: sg.Ma, kind: 'jump' });
      else if (i > 0 && sg.Va === 0 && prevV !== 0 && Math.abs(sg.Vb) > 0) zeros.push({ x: sg.a, M: sg.Ma, kind: 'root' });
    });
    const best = (key, sign) => cand.reduce((m, c) => (m === null || sign * c[key] > sign * m[key] + 1e-12 * (Math.abs(m[key]) + 1) ? c : m), null);
    const ext = { Mmax: best('M', 1), Mmin: best('M', -1), Vmax: best('V', 1), Vmin: best('V', -1), Nmax: best('N', 1), Nmin: best('N', -1), zeros };
    ext.Vabs = Math.abs(ext.Vmax.V) >= Math.abs(ext.Vmin.V) ? ext.Vmax : ext.Vmin;
    ext.Mabs = Math.abs(ext.Mmax.M) >= Math.abs(ext.Mmin.M) ? ext.Mmax : ext.Mmin;

    /* ---- worked steps: functions of x, graphical checks, maximum moment ---- */
    const stepsSeg = segs.map((sg, i) => ({
      t: `Region ${i + 1}: ${fmt(sg.a)} ${i === 0 ? '≤' : '<'} x ${i === segs.length - 1 ? '≤' : '<'} ${fmt(sg.b)} ${Lu}`,
      n: 'Section the beam at x and keep the left segment, with V and M drawn in their positive sense.',
      f: '+↑ ΣF_y = 0 gives V(x);   ↺+ ΣM about the cut = 0 gives M(x)',
      s: `V = ${polyStr(sg.cV)} ${F};   M = ${polyStr(sg.cM)} ${FL}` + (hasAxial ? `;   N = ${u(sg.N, F)}` : ''),
      r: `V goes from ${fmt(sg.Va)} to ${u(sg.Vb, F)}, M from ${fmt(sg.Ma)} to ${u(sg.Mb, FL)}`,
    }));
    const stepsCheck = [{
      t: 'Check with the relations among load, shear and moment',
      n: 'Slope of the shear diagram = w (positive upward); slope of the moment diagram = V. A concentrated force makes V jump; a couple makes M jump.',
      f: 'ΔV = ∫ w dx (area under the loading);   ΔM = ∫ V dx (area under the shear diagram)',
      table: {
        head: ['Region', `x (${Lu})`, `w (${WL})`, `ΔV = area of w`, `V (${F})`, `ΔM = area of V`, `M (${FL})`],
        rows: segs.map((sg, i) => [String(i + 1), `${fmt(sg.a)} → ${fmt(sg.b)}`, sg.q1 ? `${fmt(sg.q0)} → ${fmt(sg.q0 + sg.q1 * (sg.b - sg.a))}` : fmt(sg.q0),
          fmt(cl(sg.Vb - sg.Va, zV)), `${fmt(sg.Va)} → ${fmt(sg.Vb)}`, fmt(cl(sg.Mb - sg.Ma, zM)), `${fmt(sg.Ma)} → ${fmt(sg.Mb)}`]),
      },
      r: `The diagrams close at the right end: V = ${fmt(cl(closure.V, 1e-6 * (scaleV || 1)))}, M = ${fmt(cl(closure.M, 1e-6 * (scaleM || 1)))}`,
    }];
    const stepsMax = [];
    const roots = zeros.filter((z) => z.kind === 'root');
    if (roots.length) {
      stepsMax.push({
        t: 'Where the shear is zero',
        n: 'Since dM/dx = V, the moment has a maximum or minimum where V = 0.',
        f: 'Set V(x) = 0 in the region and solve for x, then substitute into M(x)',
        s: roots.map((z) => `V = 0 at x = ${u(z.x, Lu)}:  M = ${u(z.M, FL)}`).join(';   '),
        r: `Largest moment: M = ${u(ext.Mabs.M, FL)} at x = ${u(ext.Mabs.x, Lu)}`,
      });
    } else {
      stepsMax.push({
        t: 'Largest moment',
        n: 'The shear does not pass through zero inside a region, so the extreme moments are at the ends of the regions.',
        r: `M = ${u(ext.Mabs.M, FL)} at x = ${u(ext.Mabs.x, Lu)}`,
      });
    }

    /* ---- method of sections at a chosen cut ---- */
    function cutSteps(c, side) {
      c = Math.min(L, Math.max(0, c));
      if (!side) side = c >= L - 1e-9 ? 'L' : 'R';
      const v = at(c, side);
      const left = all.filter((a) => (side === 'R' ? a.x <= c + 1e-9 : a.x < c - 1e-9));
      const parts = dists.map((d) => clip(d, 0, c)).filter((p) => p && p.F);
      const tx = [], ty = [], tm = [];
      left.forEach((a) => {
        if (a.Fx) tx.push({ v: a.Fx, txt: fmt(Math.abs(a.Fx)) });
        if (a.Fy) ty.push({ v: a.Fy, txt: fmt(Math.abs(a.Fy)) });
        if (a.Fy && Math.abs(c - a.x) > 1e-9) tm.push({ v: -a.Fy, txt: `${fmt(Math.abs(a.Fy))}(${fmt(c - a.x)})` });
        if (a.Mz) tm.push({ v: a.Mz, txt: fmt(Math.abs(a.Mz)) });
      });
      parts.forEach((p) => { ty.push({ v: -p.F, txt: fmt(Math.abs(p.F)) }); tm.push({ v: p.F, txt: `${fmt(Math.abs(p.F))}(${fmt(c - p.xbar)})` }); });
      const where = `x = ${u(c, Lu)}` + (jumpAt(c) ? (side === 'L' ? ' (just to the left)' : ' (just to the right)') : '');
      const steps = [{
        t: `Free-body diagram of the segment to the left of the cut at ${where}`,
        n: 'N, V and M are drawn in their positive sense on the cut face: N pulling away from the segment, V downward, M counterclockwise.',
        s: parts.length ? parts.map((p) => `Distributed load left of the cut: resultant ${u(p.F, F)} acting ${u(c - p.xbar, Lu)} from the cut`).join(';  ') : undefined,
      }];
      steps.push({ t: 'Normal force at the cut', f: '→+ ΣF_x = 0', s: `${sumStr(tx.concat([{ v: 1, txt: 'N' }]))} = 0`, r: `N = ${u(v.N, F)}` });
      steps.push({ t: 'Shear force at the cut', f: '+↑ ΣF_y = 0', s: `${sumStr(ty.concat([{ v: -1, txt: 'V' }]))} = 0`, r: `V = ${u(v.V, F)}` });
      steps.push({ t: 'Bending moment at the cut', f: '↺+ ΣM about the cut = 0', s: `${sumStr([{ v: 1, txt: 'M' }].concat(tm))} = 0`, r: `M = ${u(v.M, FL)}` });
      return { N: v.N, V: v.V, M: v.M, x: c, side, steps, left, parts };
    }
    function jumpAt(x) { return all.some((a) => Math.abs(a.x - x) < 1e-9 && (a.Fy || a.Mz || a.Fx)); }

    return {
      ok: true, err: [], warn, L, sups, hinges, hname, det, unknowns: unk, reactions, acts, dists, all, events, segs, at, jumpAt, ext, closure,
      hasAxial, cutSteps, stepsReact, stepsSeg, stepsCheck, stepsMax, units: { F, Lu, FL, WL },
    };
  }
  function ordinal(n) { return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : n + 'th'; }

  const Beam = { solve, check, distInt, clip };
  root.Beam = Beam;
  if (typeof module !== 'undefined' && module.exports) module.exports = Beam;
})(typeof window !== 'undefined' ? window : globalThis);
