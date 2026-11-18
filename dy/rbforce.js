/* =====================================================================
 * DYNAMICS · D6 Planar Kinetics of a Rigid Body (physics only; browser + Node)
 * Hibbeler, Dynamics 15e, Chapters 17, 18 and 19.
 *   Moment of inertia, parallel-axis theorem: I = I_G + md²; k = √(I/m)          (17–1 to 17–3)
 *   Equations of motion: ΣF_x = m(a_G)_x, ΣF_y = m(a_G)_y, ΣM_G = I_Gα            (17–6, 17–16, 17–17)
 *   Translation (α = 0); rotation about a fixed axis (ΣM_O = I_Oα);
 *   general plane motion (rolling: a_G = αr, slip check F ≤ μ_sN, else F = μ_kN)
 *   Work and energy: T₁ + ΣU₁₋₂ = T₂, T = ½mv_G² + ½I_Gω²                       (18–1, 18–15)
 *   Impulse and momentum: I_Oω₁ + ΣM_O dt = I_Oω₂ (about a fixed axis or the IC)  (19–14)
 * Scenes: composite moment of inertia, a car or motorcycle (translation), a pendulum (fixed axis),
 * a drum lowering a block (fixed axis, connected), and a wheel or spool rolling (general plane motion).
 * Signs: a clockwise rotation is + in the pendulum, drum and rolling scenes, as the book draws them.
 * ===================================================================== */
(function (root) {
  'use strict';
  const Core = root.Core || require('../shared/core.js');
  const DY = root.DY || require('./dycore.js');
  const { fmt, fail, Steps } = Core;
  const D2R = Math.PI / 180;

  function defaults() {
    return {
      scene: 'pend', method: 'force',
      // composite body
      parts: [
        { t: 'rod', m: 10, a: 2, b: 0, x: 0, y: -1, ang: 90, rm: 'add' },
        { t: 'disk', m: 5, a: 0.5, b: 0, x: 0, y: -2.5, ang: 0, rm: 'add' },
      ],
      // car
      cm: 2000, h: 0.3, br: 0.75, bf: 1.25, drive: 'rear', cmuk: 0.25, ca: 2,
      // pendulum
      shape: 'rod', pm: 20, pL: 3, kG: 0.6, rG: 0.5, th: 0, w: 0, M: 0, th2: 90,
      // drum
      Iby: 'k', dm: 60, kO: 0.25, IO: 3.75, dr: 0.4, bm: 20, Mf: 0, dv1: 0, ds: 1, dt: 2,
      // rolling
      surf: 'ground', rm: 50, rk: 0.7, R: 1.25, Ro: 1.25, phi: 0, RM: 35, P: 0, yP: 0, mus: 0.3, muk: 0.25, rv1: 0, rs: 2, rt: 2,
    };
  }
  const KINDS = { cm: 'M', h: 'L', br: 'L', bf: 'L', ca: 'A', pm: 'M', pL: 'L', kG: 'L', rG: 'L', M: 'MO', dm: 'M', kO: 'L', IO: 'I', dr: 'L', bm: 'M', Mf: 'MO', dv1: 'V', ds: 'L', rm: 'M', rk: 'L', R: 'L', Ro: 'L', RM: 'MO', P: 'F', yP: 'L', rv1: 'V', rs: 'L' };
  const PART = { m: 'M', a: 'L', b: 'L', x: 'L', y: 'L' };
  function convertState(st, from, to) {
    DY.convertObj(st, KINDS, from, to);
    DY.convertList(st.parts, PART, from, to);
    return st;
  }

  function solve(st, U) {
    const u = DY.units(U);
    switch (st.scene) {
      case 'inertia': return inertia(st, u);
      case 'car': return car(st, u);
      case 'drum': return drum(st, u);
      case 'roll': return roll(st, u);
      default: return pend(st, u);
    }
  }
  const sense = (a) => (Math.abs(a) < 1e-12 ? '' : a > 0 ? ' ↻' : ' ↺');
  const mtx = (m, u) => DY.massTxt(m, u);

  /* ---------------- Composite moment of inertia ---------------- */
  const SHAPES = {
    rod: { name: 'Slender rod', IG: (m, a) => (m * a * a) / 12, f: 'I_G = (1/12)ml²' },
    disk: { name: 'Disk or cylinder', IG: (m, a) => (m * a * a) / 2, f: 'I_G = ½mr²' },
    ring: { name: 'Thin ring', IG: (m, a) => m * a * a, f: 'I_G = mr²' },
    sphere: { name: 'Sphere', IG: (m, a) => (2 / 5) * m * a * a, f: 'I_G = (2/5)mr²' },
    plate: { name: 'Rectangular plate', IG: (m, a, b) => (m * (a * a + b * b)) / 12, f: 'I_G = (1/12)m(a² + b²)' },
    point: { name: 'Small particle', IG: () => 0, f: 'I_G ≈ 0' },
  };
  function inertia(st, u) {
    const S = Steps(), parts = st.parts || [];
    if (!parts.length) return fail('Add at least one part.');
    const rows = [], list = [];
    let m = 0, mx = 0, my = 0, IO = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], sh = SHAPES[p.t] || SHAPES.point, sg = p.rm === 'remove' ? -1 : 1;
      const mi = DY.toBase(+p.m, 'M', u), a = +p.a, b = +p.b || 0, x = +p.x || 0, y = +p.y || 0;
      if (!(mi > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of part ${i + 1}.`);
      if (p.t !== 'point' && !(a > 0)) return fail(`Enter the size of part ${i + 1}.`);
      if (p.t === 'plate' && !(b > 0)) return fail(`Enter both sides of the plate (part ${i + 1}).`);
      const IG = sh.IG(mi, a, b), d2 = x * x + y * y, Ii = IG + mi * d2;
      m += sg * mi; mx += sg * mi * x; my += sg * mi * y; IO += sg * Ii;
      list.push({ i, t: p.t, sg, m: mi, a, b, x, y, ang: (+p.ang || 0) * D2R, IG, Ii });
      rows.push([`${i + 1}. ${sh.name}${sg < 0 ? ' (hole, −)' : ''}`, fmt(sg * mi), sh.f.replace('I_G = ', ''), fmt(sg * IG), fmt(Math.sqrt(d2)), fmt(sg * mi * d2), fmt(sg * Ii)]);
    }
    if (!(m > 1e-12)) return fail('The parts removed weigh as much as the parts added. Check the holes.');
    const xg = mx / m, yg = my / m, dG = Math.hypot(xg, yg), IG = IO - m * dG * dG;
    S.add({ t: 'Each part about O (parallel-axis theorem)', n: 'Take each part from the table on the inside back cover of the book, then move it to O. A hole counts as a negative mass.', f: 'I_O = I_G + md²', table: { head: [`Part`, `m (${u.Mb})`, 'Formula', `I_G (${u.I})`, `d (${u.L})`, `md² (${u.I})`, `I_O (${u.I})`], rows } });
    S.add({ t: 'Add the parts', f: 'I_O = Σ(I_G + md²)', s: list.map((q) => `${q.sg < 0 ? '−' : '+'} ${fmt(q.Ii)}`).join(' ').replace(/^\+ /, ''), r: `I_O = ${fmt(IO)} ${u.I}` });
    S.add({ t: 'Mass centre of the body', f: 'x̄ = Σx̃m / Σm;  ȳ = Σỹm / Σm', s: `Σm = ${fmt(m)} ${u.Mb}`, r: `x̄ = ${fmt(xg)} ${u.L}, ȳ = ${fmt(yg)} ${u.L}  (distance from O = ${fmt(dG)} ${u.L})` });
    S.add({ t: 'About the mass centre G', f: 'I_O = I_G + m d_G²  ⇒  I_G = I_O − m d_G²', s: `I_G = ${fmt(IO)} − ${fmt(m)}(${fmt(dG)})²`, r: `I_G = ${fmt(IG)} ${u.I}` });
    S.add({ t: 'Radii of gyration', f: 'k = √(I/m)', r: `k_O = ${fmt(Math.sqrt(Math.max(0, IO) / m))} ${u.L},  k_G = ${fmt(Math.sqrt(Math.max(0, IG) / m))} ${u.L}` });
    const out = [{ k: 'Moment of inertia about O, I_O', v: IO, u: u.I, hl: true }, { k: 'Moment of inertia about G, I_G', v: IG, u: u.I, hl: true },
      { k: u.us ? 'Total weight W' : 'Total mass m', v: DY.fromBase(m, 'M', u), u: u.M }, { k: 'Mass centre x̄', v: xg, u: u.L }, { k: 'Mass centre ȳ', v: yg, u: u.L },
      { k: 'Distance from O to G', v: dG, u: u.L }, { k: 'Radius of gyration about O, k_O', v: Math.sqrt(Math.max(0, IO) / m), u: u.L }, { k: 'Radius of gyration about G, k_G', v: Math.sqrt(Math.max(0, IG) / m), u: u.L }];
    return DY.result(`I_O = ${fmt(IO)} ${u.I}, I_G = ${fmt(IG)} ${u.I}`, 'ok', out, S, { scene: 'inertia', u, list, m, xg, yg, IO, IG, span: [0, 4] }, IG < -1e-9 ? ['I_G came out negative: a hole is larger than the body it is cut from.'] : []);
  }

  /* ---------------- Car or motorcycle in translation ---------------- */
  function car(st, u) {
    const S = Steps(), out = [], warn = [];
    const m = DY.toBase(+st.cm, 'M', u), W = m * u.g, h = +st.h, br = +st.br, bf = +st.bf, mu = +st.cmuk, L = br + bf, drive = st.drive;
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the vehicle.`);
    if (!(h > 0) || !(br > 0) || !(bf > 0)) return fail('Enter the height of G and its distances to both axles.');
    S.add({ t: 'Free-body and kinetic diagrams', n: `The vehicle translates, so α = 0 and ΣM_G = 0. Wheel masses are neglected. G is ${fmt(h)} ${u.L} above the road, ${fmt(br)} ${u.L} ahead of the rear axle B and ${fmt(bf)} ${u.L} behind the front axle A. + x is forward.`, f: 'ΣF_x = m(a_G)_x;  ΣF_y = 0;  ΣM_G = 0', s: `W = ${mtx(m, u)} × g = ${fmt(W)} ${u.F}` });
    let Nr, Nf, F, a, Fr = 0, Ff = 0;
    if (drive === 'rear' || drive === 'front') {
      if (!(mu > 0)) return fail('Enter the kinetic friction coefficient μ_k of the slipping wheels.');
      if (drive === 'rear') { Nr = (bf * W) / (L - h * mu); Nf = W - Nr; Fr = mu * Nr; }
      else { Nf = (br * W) / (L + h * mu); Nr = W - Nf; Ff = mu * Nf; }
      F = Fr + Ff; a = F / m;
      S.add({ t: `${drive === 'rear' ? 'Rear' : 'Front'} driving wheels slipping`, n: 'The driving wheels spin, so their friction is kinetic and pushes the vehicle forward; the free wheels carry no friction.', f: `F = μ_kN_${drive === 'rear' ? 'B' : 'A'}`, s: `ΣM_G = 0:  N_A(${fmt(bf)}) − N_B(${fmt(br)}) + F(${fmt(h)}) = 0;  N_A + N_B = ${fmt(W)}`, r: `N_B = ${fmt(Nr)} ${u.F}, N_A = ${fmt(Nf)} ${u.F}, F = ${fmt(F)} ${u.F}` });
      S.add({ t: 'Acceleration', f: 'ΣF_x = ma_G', s: `${fmt(F)} = ${fmt(m)} a_G`, r: `a_G = ${fmt(a)} ${u.A} forward` });
    } else if (drive === 'brake') {
      if (!(mu > 0)) return fail('Enter the kinetic friction coefficient μ_k of the locked wheels.');
      a = -mu * u.g; Nf = (W * (br + mu * h)) / L; Nr = W - Nf; Fr = -mu * Nr; Ff = -mu * Nf; F = Fr + Ff;
      S.add({ t: 'All wheels locked and skidding', n: 'The vehicle moves forward, so friction at every wheel acts backward.', f: 'F = μ_k(N_A + N_B) = μ_kW', s: `ΣF_x: −${fmt(mu)}(${fmt(W)}) = ${fmt(m)}a_G`, r: `a_G = ${fmt(a)} ${u.A}` });
      S.add({ t: 'Normal forces', f: 'ΣM_G = 0:  N_A b_A − N_B b_B + F h = 0', s: `N_A(${fmt(bf)}) − N_B(${fmt(br)}) − ${fmt(mu * W)}(${fmt(h)}) = 0`, r: `N_A = ${fmt(Nf)} ${u.F} (front), N_B = ${fmt(Nr)} ${u.F} (rear)` });
    } else if (drive === 'wheelie') {
      Nf = 0; Nr = W; a = (u.g * br) / h; F = m * a; Fr = F;
      S.add({ t: 'Front wheel about to lift', n: 'At the start of a wheelie N_A ≈ 0, so the rear wheel carries all the weight and all the drive.', f: 'ΣM_B = Σ(ℳ_k)_B:  W b_B = (ma_G)h', s: `${fmt(W)}(${fmt(br)}) = ${fmt(m)}a_G(${fmt(h)})`, r: `a_G = ${fmt(a)} ${u.A}` });
      S.add({ t: 'Friction needed', f: 'F_B = ma_G;  N_B = W;  (μ_s)min = F_B/N_B', s: `${fmt(F)} / ${fmt(Nr)}`, r: `(μ_s)min = ${fmt(F / Nr)}` });
    } else {
      a = +st.ca; if (!isFinite(a)) return fail('Enter the acceleration.');
      a = DY.toBase(a, 'A', u); F = m * a; Fr = F;
      Nf = (br * W - h * m * a) / L; Nr = W - Nf;
      S.add({ t: 'Given acceleration, rear-wheel drive', f: 'ΣF_x = ma_G ⇒ F_B = ma_G', s: `F_B = ${fmt(m)}(${fmt(a)})`, r: `F_B = ${fmt(F)} ${u.F}` });
      S.add({ t: 'Normal forces', f: 'ΣM_G = 0:  N_A b_A − N_B b_B + F h = 0,  N_A + N_B = W', r: `N_A = ${fmt(Nf)} ${u.F} (front), N_B = ${fmt(Nr)} ${u.F} (rear)` });
    }
    const aLift = (u.g * br) / h;
    if (Nf < -1e-9) warn.push(`N_A comes out negative: the front wheels would lift. A wheelie starts at a_G = ${fmt(aLift)} ${u.A}.`);
    if (Nr < -1e-9) warn.push('N_B comes out negative: the rear wheels would lift (the vehicle tips forward).');
    const muNeed = drive === 'given' || drive === 'wheelie' ? (Nr > 0 ? Math.abs(F) / Nr : Infinity) : null;
    out.push({ k: 'Acceleration a_G', v: a, u: u.A, hl: true }, { k: 'Front normal force N_A', v: Nf, u: u.F, hl: true }, { k: 'Rear normal force N_B', v: Nr, u: u.F, hl: true }, { k: 'Friction force F (total)', v: F, u: u.F });
    if (muNeed !== null) out.push({ k: 'Friction needed at the rear, μ_s min', v: muNeed, u: '' });
    out.push({ k: 'Front-wheel lift-off acceleration', v: aLift, u: u.A });
    return DY.result(`a_G = ${fmt(a)} ${u.A}, N_A = ${fmt(Nf)} ${u.F}, N_B = ${fmt(Nr)} ${u.F}`, warn.length ? 'warn' : 'ok', out, S, { scene: 'car', u, m, W, h, br, bf, a, Nf, Nr, Fr, Ff, F, drive, aLift, span: [0, 2] }, warn);
  }

  /* ---------------- Pendulum: rotation about a fixed axis ---------------- */
  function pendBody(st, u) {
    const m = DY.toBase(+st.pm, 'M', u);
    if (st.shape === 'rod') { const L = +st.pL; return { m, rG: L / 2, IG: (m * L * L) / 12, L }; }
    const k = +st.kG; return { m, rG: +st.rG, IG: m * k * k, k };
  }
  /** Reactions at the pin for G at θ (rad, below the horizontal, G on the right of O) with ω and α (+ clockwise). */
  function pinForces(b, W, th, w, al) {
    const On = b.m * w * w * b.rG + W * Math.sin(th), Ot = b.m * al * b.rG - W * Math.cos(th);
    const n = [-Math.cos(th), Math.sin(th)], t = [-Math.sin(th), -Math.cos(th)];
    return { On, Ot, Ox: On * n[0] + Ot * t[0], Oy: On * n[1] + Ot * t[1] };
  }
  function pend(st, u) {
    const S = Steps(), out = [], b = pendBody(st, u), W = b.m * u.g, M = +st.M || 0;
    if (!(b.m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the body.`);
    if (!(b.rG > 0)) return fail(st.shape === 'rod' ? 'Enter the length of the rod.' : 'Enter the distance r_G from the pin to G.');
    if (st.shape !== 'rod' && !(b.k > 0)) return fail('Enter the radius of gyration k_G.');
    const IO = b.IG + b.m * b.rG * b.rG;
    S.add({ t: 'Moment of inertia about the pin O', n: st.shape === 'rod' ? `Slender rod of length ${fmt(b.L)} ${u.L} pinned at one end.` : `Body with k_G = ${fmt(b.k)} ${u.L} and G at r_G = ${fmt(b.rG)} ${u.L} from O.`, f: st.shape === 'rod' ? 'I_O = (1/3)ml²  (= I_G + m(l/2)²)' : 'I_G = mk_G²;  I_O = I_G + mr_G²', s: `m = ${mtx(b.m, u)}`, r: `I_G = ${fmt(b.IG)} ${u.I},  I_O = ${fmt(IO)} ${u.I}` });
    const aOf = (th) => (W * b.rG * Math.cos(th) + M) / IO;
    let th = +st.th * D2R, w = +st.w || 0;
    if (!isFinite(th)) return fail('Enter the angle θ.');
    let th1 = th, w1 = w, ok = true;
    if (st.method === 'energy') {
      const th2 = +st.th2 * D2R; if (!isFinite(th2)) return fail('Enter the angle θ₂ to find.');
      const dV = W * b.rG * (Math.sin(th2) - Math.sin(th1)), UM = M * (th2 - th1), T1 = 0.5 * IO * w1 * w1, T2 = T1 + dV + UM;
      S.add({ t: 'Principle of work and energy, from θ₁ to θ₂', n: 'G drops r_G(sin θ₂ − sin θ₁) as θ goes from θ₁ to θ₂ (θ below the horizontal). The pin does no work.', f: 'T₁ + ΣU₁₋₂ = T₂;  T = ½I_Oω²;  U_W = W r_G(sin θ₂ − sin θ₁);  U_M = M(θ₂ − θ₁)', s: `½(${fmt(IO)})(${fmt(w1)})² + ${fmt(W)}(${fmt(b.rG)})(${fmt(Math.sin(th2))} − ${fmt(Math.sin(th1))}) + ${fmt(M)}(${fmt(th2 - th1)}) = ½(${fmt(IO)})ω₂²`, r: T2 >= 0 ? `ω₂ = ${fmt(Math.sqrt(2 * T2 / IO))} rad/s` : 'T₂ comes out negative' });
      if (T2 < -1e-12) return fail(`The body stops before it reaches θ₂ = ${fmt(+st.th2)}°: the energy needed is ${fmt(-T2)} ${u.E} more than it has.`);
      th = th2; w = Math.sign(w1 || (th2 - th1) || 1) * Math.sqrt(Math.max(0, 2 * T2 / IO)); ok = true;
      out.push({ k: 'Angular velocity at θ₂, ω₂', v: w, u: 'rad/s', hl: true });
    }
    const al = aOf(th), P = pinForces(b, W, th, w, al);
    S.add({ t: `Equations of motion at θ = ${fmt(th / D2R)}°`, n: 'G moves on a circle about O: n points from G to O, t is the direction G moves for a clockwise rotation (+).', f: 'ΣM_O = I_Oα;  ΣF_n = mω²r_G;  ΣF_t = mαr_G', s: `${fmt(W)}(${fmt(b.rG)})cos ${fmt(th / D2R)}° ${M ? `${M < 0 ? '−' : '+'} ${fmt(Math.abs(M))} ` : ''}= ${fmt(IO)}α`, r: `α = ${fmt(al)} rad/s²${sense(al)}` });
    S.add({ t: 'Pin reactions', f: 'O_n − W sin θ = mω²r_G;  O_t + W cos θ = mαr_G', s: `O_n = ${fmt(b.m)}(${fmt(w)})²(${fmt(b.rG)}) + ${fmt(W)} sin ${fmt(th / D2R)}°;  O_t = ${fmt(b.m)}(${fmt(al)})(${fmt(b.rG)}) − ${fmt(W)} cos ${fmt(th / D2R)}°`, r: `O_n = ${fmt(P.On)} ${u.F},  O_t = ${fmt(P.Ot)} ${u.F}${P.Ot < 0 ? ' (acts opposite to +t)' : ''};  O_x = ${fmt(P.Ox)}, O_y = ${fmt(P.Oy)} ${u.F}` });
    out.push({ k: 'Angular acceleration α (+ clockwise)', v: al, u: 'rad/s²', hl: true }, { k: 'Pin force along OG, O_n', v: P.On, u: u.F, hl: true }, { k: 'Pin force across OG, O_t', v: P.Ot, u: u.F, hl: true },
      { k: 'Pin force O_x', v: P.Ox, u: u.F }, { k: 'Pin force O_y', v: P.Oy, u: u.F }, { k: 'Total pin force', v: Math.hypot(P.Ox, P.Oy), u: u.F }, { k: 'I_O', v: IO, u: u.I });
    // swing for the animation: integrate from the starting state
    const f = (t, x, v) => aOf(x), T = 2 * Math.PI * Math.sqrt(IO / Math.max(1e-9, W * b.rG));
    let span = st.method === 'energy' ? null : T;
    let sim = DY.rk4(f, 0, th1, w1, st.method === 'energy' ? 4 * T : T, 400, st.method === 'energy' ? (s, p) => (s.x - th) * (p.x - th) <= 0 && Math.abs(s.x - th1) > 1e-9 : null);
    if (st.method === 'energy') span = sim[sim.length - 1].t;
    const wAt = (x) => { const T2 = 0.5 * IO * w1 * w1 + W * b.rG * (Math.sin(x) - Math.sin(th1)) + M * (x - th1); return T2 >= 0 ? Math.sqrt(2 * T2 / IO) : NaN; };
    return DY.result(st.method === 'energy' ? `ω₂ = ${fmt(w)} rad/s, α = ${fmt(al)} rad/s², O_n = ${fmt(P.On)} ${u.F}` : `α = ${fmt(al)} rad/s², O_n = ${fmt(P.On)} ${u.F}, O_t = ${fmt(P.Ot)} ${u.F}`, ok ? 'ok' : 'warn', out, S,
      { scene: 'pend', u, b, W, IO, M, th, w, al, P, th1, w1, sim, wAt, aOf, pinAt: (x, ww) => pinForces(b, W, x, ww, aOf(x)), method: st.method, shape: st.shape, span: [0, Math.max(span, 1e-6)] }, []);
  }

  /* ---------------- Drum lowering a block ---------------- */
  function drum(st, u) {
    const S = Steps(), out = [];
    const mD = DY.toBase(+st.dm || 0, 'M', u), mb = DY.toBase(+st.bm, 'M', u), r = +st.dr, Mf = +st.Mf || 0;
    let IO;
    if (st.Iby === 'k') { const k = +st.kO; if (!(mD > 0) || !(k > 0)) return fail('Enter the drum mass and its radius of gyration k_O.'); IO = mD * k * k; S.add({ t: 'Moment of inertia of the drum', f: 'I_O = mk_O²', s: `${fmt(mD)}(${fmt(k)})²`, r: `I_O = ${fmt(IO)} ${u.I}` }); }
    else { IO = +st.IO; if (!(IO > 0)) return fail('Enter the moment of inertia I_O of the drum.'); }
    if (!(mb > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the block.`);
    if (!(r > 0)) return fail('Enter the radius r at which the cord leaves the drum.');
    const Wb = mb * u.g, num = Wb * r - Mf, a = (num * r) / (IO + mb * r * r), al = a / r, T = mb * (u.g - a);
    if (num <= 0) return fail(`The bearing friction (${fmt(Mf)} ${u.MO}) is at least the moment of the block's weight (${fmt(Wb * r)} ${u.MO}), so the drum does not turn.`);
    S.add({ t: 'Free-body diagrams of the drum and the block', n: 'The block moves down (+) and turns the drum; the cord does not slip, so a = αr. Moments about O remove the pin reactions.', f: `ΣM_O = I_Oα:  T r ${Mf ? '− M_f ' : ''}= I_Oα;   ΣF_y = ma (block, + down):  W_B − T = m_Ba`, s: `T(${fmt(r)})${Mf ? ` − ${fmt(Mf)}` : ''} = ${fmt(IO)}α;  ${fmt(Wb)} − T = ${fmt(mb)}a;  a = α(${fmt(r)})`, r: `α = ${fmt(al)} rad/s²,  a = ${fmt(a)} ${u.A},  T = ${fmt(T)} ${u.F}` });
    S.add({ t: 'Kinematics', n: 'The cord leaves the drum at radius r, so the block and the point of the drum where the cord leaves have the same speed and tangential acceleration.', f: 'v = ωr;  a = αr', r: `a = ${fmt(al)}(${fmt(r)}) = ${fmt(a)} ${u.A}` });
    const Oy = mD * u.g + T;
    S.add({ t: 'Bearing reaction', n: 'The drum\'s centre does not move, so the forces on it balance.', f: 'ΣF_x = 0: O_x = 0;  ΣF_y = 0: O_y − W_D − T = 0', s: `O_y = ${fmt(mD * u.g)} + ${fmt(T)}`, r: `O_y = ${fmt(Oy)} ${u.F}` });
    out.push({ k: 'Angular acceleration of the drum α', v: al, u: 'rad/s²', hl: st.method === 'force' }, { k: 'Acceleration of the block a', v: a, u: u.A, hl: st.method === 'force' }, { k: 'Cord tension T', v: T, u: u.F, hl: st.method === 'force' });
    if (mD > 0) out.push({ k: 'Bearing reaction O_y', v: Oy, u: u.F });
    const v1 = +st.dv1 || 0;
    let span = 2, v2, s2, t2;
    if (st.method === 'energy') {
      const s = +st.ds; if (!(s > 0)) return fail('Enter how far the block moves down, s.');
      const mEq = mb + IO / (r * r), T1 = 0.5 * mEq * v1 * v1, U = (Wb - Mf / r) * s;
      v2 = Math.sqrt((2 * (T1 + U)) / mEq); s2 = s; t2 = Math.abs(a) > 1e-12 ? (v2 - v1) / a : s / v1;
      S.add({ t: 'Principle of work and energy (drum and block together)', n: 'The cord tension is internal and does no net work; the pin does no work. The block drops s while the drum turns θ = s/r.', f: 'T₁ + ΣU₁₋₂ = T₂;  T = ½m_Bv² + ½I_Oω²,  ω = v/r', s: `½(${fmt(mb)} + ${fmt(IO)}/${fmt(r)}²)(${fmt(v1)})² + ${fmt(Wb)}(${fmt(s)})${Mf ? ` − ${fmt(Mf)}(${fmt(s / r)})` : ''} = ½(${fmt(mEq)})v₂²`, r: `v₂ = ${fmt(v2)} ${u.V},  ω₂ = ${fmt(v2 / r)} rad/s` });
      out.unshift({ k: 'Speed of the block v₂', v: v2, u: u.V, hl: true }, { k: 'Angular velocity of the drum ω₂', v: v2 / r, u: 'rad/s', hl: true });
      out.push({ k: 'Time taken', v: t2, u: 's' });
      span = t2;
    } else if (st.method === 'impulse') {
      const t = +st.dt; if (!(t > 0)) return fail('Enter the time t.');
      v2 = v1 + a * t; t2 = t; s2 = v1 * t + 0.5 * a * t * t;
      S.add({ t: 'Principle of angular impulse and momentum about O (drum and block)', n: 'All the forces are constant. The momentum of the block about O is (m_Bv)r.', f: '(H_O)₁ + ΣM_O dt = (H_O)₂;  H_O = I_Oω + (m_Bv)r,  ω = v/r', s: `${fmt(IO)}(${fmt(v1 / r)}) + ${fmt(mb)}(${fmt(v1)})(${fmt(r)}) + (${fmt(Wb)}(${fmt(r)})${Mf ? ` − ${fmt(Mf)}` : ''})(${fmt(t)}) = [${fmt(IO)}/${fmt(r)} + ${fmt(mb)}(${fmt(r)})]v₂`, r: `v₂ = ${fmt(v2)} ${u.V},  ω₂ = ${fmt(v2 / r)} rad/s` });
      out.unshift({ k: 'Speed of the block v₂', v: v2, u: u.V, hl: true }, { k: 'Angular velocity of the drum ω₂', v: v2 / r, u: 'rad/s', hl: true });
      out.push({ k: 'Distance the block moves', v: s2, u: u.L });
      span = t;
    } else { span = 2; }
    return DY.result(st.method === 'force' ? `α = ${fmt(al)} rad/s², a = ${fmt(a)} ${u.A}, T = ${fmt(T)} ${u.F}` : `v₂ = ${fmt(v2)} ${u.V}`, 'ok', out, S, { scene: 'drum', u, IO, mD, mb, r, a, al, T, v1, span: [0, Math.max(span, 1e-6)], method: st.method }, []);
  }

  /* ---------------- Wheel or spool rolling ---------------- */
  function roll(st, u) {
    const S = Steps(), out = [], warn = [];
    const m = DY.toBase(+st.rm, 'M', u), k = +st.rk, R = +st.R, phi = (+st.phi || 0) * D2R, M = +st.RM || 0, P = +st.P || 0, yP = +st.yP || 0, cord = st.surf === 'cord';
    if (!(m > 0)) return fail(`Enter the ${u.us ? 'weight' : 'mass'} of the wheel.`);
    if (!(k > 0) || !(R > 0)) return fail('Enter the radius of gyration k_G and the radius r it rolls on.');
    const W = m * u.g, IG = m * k * k, N = W * Math.cos(phi), Ws = W * Math.sin(phi);
    S.add({ t: 'Free-body and kinetic diagrams', n: `x runs along the ${cord ? 'cord' : 'surface'}${phi ? `, down the ${fmt(+st.phi)}° slope` : ' to the right'}; a clockwise α is +. ${cord ? 'The cord is fixed, so the spool cannot slip on it; the cord tension takes the place of friction.' : 'Friction F at the contact A is taken + along x.'}`, f: 'I_G = mk_G²', s: `m = ${mtx(m, u)}`, r: `I_G = ${fmt(IG)} ${u.I},  N = W cos φ = ${fmt(N)} ${u.F}` });
    // no slipping: moments about the contact point
    S.add({ t: 'Kinematics of rolling', n: 'Without slipping the contact point A is the instantaneous centre of zero velocity.', f: 'v_G = ωr;  a_G = αr', s: `r = ${fmt(R)} ${u.L}` });
    const MA = M + P * (yP + R) + Ws * R, IA = IG + m * R * R;
    let al = MA / IA, aG = al * R, F = m * aG - P - Ws, slip = false;
    S.add({ t: 'Assume no slipping', f: 'ΣF_x = ma_G:  P + W sin φ + F = ma_G;   ΣM_G = I_Gα:  M + P y_P − F r = I_Gα;   a_G = αr', s: `ΣM_A = (I_G + mr²)α:  ${fmt(M)} + ${fmt(P)}(${fmt(yP + R)}) + ${fmt(Ws)}(${fmt(R)}) = (${fmt(IG)} + ${fmt(m)}(${fmt(R)})²)α`, r: `α = ${fmt(al)} rad/s²${sense(al)},  a_G = ${fmt(aG)} ${u.A},  F = ${fmt(F)} ${u.F}` });
    const mus = +st.mus, muk = +st.muk;
    if (!cord) {
      if (!(mus >= 0) || !(muk >= 0)) return fail('Enter the friction coefficients μ_s and μ_k.');
      if (Math.abs(F) <= mus * N + 1e-9) S.add({ t: 'Check the no-slip assumption', f: '|F| ≤ μ_sN', s: `${fmt(Math.abs(F))} ≤ ${fmt(mus)}(${fmt(N)}) = ${fmt(mus * N)}`, r: 'It rolls without slipping.' });
      else {
        slip = true;
        const Fk = Math.sign(F) * muk * N;
        S.add({ t: 'Check the no-slip assumption', f: '|F| ≤ μ_sN', s: `${fmt(Math.abs(F))} > ${fmt(mus)}(${fmt(N)}) = ${fmt(mus * N)}`, r: 'It slips, so a_G = αr no longer holds and F = μ_kN.' });
        F = Fk; aG = (P + Ws + F) / m; al = (M + P * yP - F * R) / IG;
        S.add({ t: 'Slipping', f: 'F = μ_kN (opposing the slip);  ΣF_x = ma_G;  ΣM_G = I_Gα', s: `F = ${fmt(F)};  a_G = (${fmt(P)} + ${fmt(Ws)} + ${fmt(F)})/${fmt(m)};  α = (${fmt(M)} + ${fmt(P)}(${fmt(yP)}) − ${fmt(F)}(${fmt(R)}))/${fmt(IG)}`, r: `a_G = ${fmt(aG)} ${u.A},  α = ${fmt(al)} rad/s²${sense(al)}` });
      }
    }
    out.push({ k: 'Acceleration of G, a_G', v: aG, u: u.A, hl: st.method === 'force' }, { k: 'Angular acceleration α (+ clockwise)', v: al, u: 'rad/s²', hl: st.method === 'force' }, { k: cord ? 'Cord tension (− means it pulls back up)' : 'Friction force F', v: F, u: u.F, hl: st.method === 'force' });
    if (!cord) out.push({ k: 'Normal force N', v: N, u: u.F }, { k: 'Rolling', v: slip ? 'slips' : 'without slipping', u: '' });
    const v1 = +st.rv1 || 0, w1 = slip ? 0 : v1 / R;
    let span = 2;
    if (st.method === 'energy') {
      const s = +st.rs; if (!(s > 0)) return fail('Enter the distance s that G moves.');
      let v2;
      if (!slip) {
        const mEq = m + IG / (R * R), U = s * (P * (1 + yP / R) + M / R + Ws);
        v2 = Math.sign(U || 1) * Math.sqrt(Math.max(0, v1 * v1 + (2 * U) / mEq));
        if (v1 * v1 + (2 * U) / mEq < 0) return fail('It stops before G moves that far.');
        S.add({ t: 'Principle of work and energy', n: 'Rolling without slipping: the contact point has no velocity, so friction (or the fixed cord) does no work. The point where P acts moves s(1 + y_P/r); the couple turns through θ = s/r.', f: 'T₁ + ΣU₁₋₂ = T₂;  T = ½mv_G² + ½I_Gω² = ½(m + I_G/r²)v_G²', s: `½(${fmt(mEq)})(${fmt(v1)})² + ${fmt(s)}[${fmt(P)}(1 + ${fmt(yP)}/${fmt(R)}) + ${fmt(M)}/${fmt(R)} + ${fmt(Ws)}] = ½(${fmt(mEq)})v₂²`, r: `v_G = ${fmt(v2)} ${u.V},  ω = ${fmt(v2 / R)} rad/s` });
        out.unshift({ k: 'Speed of G after s, v_G2', v: v2, u: u.V, hl: true }, { k: 'Angular velocity after s, ω₂', v: v2 / R, u: 'rad/s', hl: true });
      } else {
        const v22 = v1 * v1 + 2 * aG * s; if (v22 < 0) return fail('It stops before G moves that far.');
        v2 = Math.sqrt(v22);
        warn.push('It slips, so friction does work. The speed is found from the constant a_G of the force method.');
        S.add({ t: 'Slipping: speed from the constant acceleration', f: 'v_G² = v₁² + 2a_G s', s: `${fmt(v1)}² + 2(${fmt(aG)})(${fmt(s)})`, r: `v_G = ${fmt(v2)} ${u.V}` });
        out.unshift({ k: 'Speed of G after s, v_G2', v: v2, u: u.V, hl: true });
      }
      span = Math.abs(aG) > 1e-12 ? (v2 - v1) / aG : s / Math.max(1e-9, Math.abs(v1));
      out.push({ k: 'Time taken', v: span, u: 's' });
    } else if (st.method === 'impulse') {
      const t = +st.rt; if (!(t > 0)) return fail('Enter the time t.');
      const v2 = v1 + aG * t, w2 = w1 + al * t;
      if (!slip) S.add({ t: 'Principle of angular impulse and momentum about the contact point A', n: 'For rolling without slipping, sum the moments about the contact point: H_A = I_Gω + (mv_G)r = (I_G + mr²)ω.', f: '(H_A)₁ + ΣM_A dt = (H_A)₂', s: `(${fmt(IA)})(${fmt(w1)}) + (${fmt(MA)})(${fmt(t)}) = (${fmt(IA)})ω₂`, r: `ω₂ = ${fmt(w2)} rad/s,  v_G = ω₂r = ${fmt(v2)} ${u.V}` });
      else S.add({ t: 'Impulse and momentum with slipping', f: 'mv₁ + ΣF dt = mv₂;  I_Gω₁ + ΣM_G dt = I_Gω₂', s: `v₂ = ${fmt(v1)} + (${fmt(m * aG)}/${fmt(m)})(${fmt(t)})`, r: `v_G = ${fmt(v2)} ${u.V},  ω₂ = ${fmt(w2)} rad/s` });
      out.unshift({ k: 'Speed of G after t, v_G2', v: v2, u: u.V, hl: true }, { k: 'Angular velocity after t, ω₂', v: w2, u: 'rad/s', hl: true });
      out.push({ k: 'Distance G moves', v: v1 * t + 0.5 * aG * t * t, u: u.L });
      span = t;
    }
    const cls = warn.length ? 'warn' : 'ok';
    return DY.result(st.method === 'force' ? `a_G = ${fmt(aG)} ${u.A}, α = ${fmt(al)} rad/s²${slip ? ' (slips)' : ''}` : `${out[0].k.split(',')[0]} = ${fmt(out[0].v)} ${out[0].u}`, cls, out, S,
      { scene: 'roll', u, m, IG, R, Ro: Math.max(+st.Ro || 0, R), phi, M, P, yP, F, N, W, aG, al, v1, w1, slip, cord, span: [0, Math.max(span, 1e-6)], method: st.method }, warn);
  }

  const RbForce = { defaults, convertState, solve, SHAPES };
  root.RbForce = RbForce;
  if (typeof module !== 'undefined' && module.exports) module.exports = RbForce;
})(typeof window !== 'undefined' ? window : globalThis);
