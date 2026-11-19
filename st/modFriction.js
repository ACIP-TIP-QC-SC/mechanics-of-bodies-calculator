/* =====================================================================
 * STATICS · Friction (inputs, free-body diagrams, presets)
 * Physics: st/friction.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI, Charts, Friction } = root;
  const { fmt } = Core;
  const { svgEl: s, COL } = UI;
  const T = Charts.text;
  const DEG = Math.PI / 180;
  const RCOL = COL.react, LCOL = COL.load, FCOL = '#8e44ad', CONE = '#e67e22';

  const M = { id: 'friction', title: 'Friction', defaults: Friction.defaults, units: 'SI' };
  const S = () => M.state;
  const mode = () => S().mode;

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */
  const massU = () => (M.units === 'US' ? 'slug' : 'kg');
  function weightIn(sec, C, o, F, label, by, mk, wk) {
    by = by || 'wBy'; mk = mk || 'm'; wk = wk || 'W';
    C.seg(sec, { label: `${label} given as`, get: () => o[by], set: (v) => (o[by] = v), options: [['mass', 'Mass'], ['force', 'Weight']] });
    if (o[by] === 'mass') C.num(sec, { label: `${label}: mass`, get: () => o[mk], set: (v) => (o[mk] = v), unit: massU() });
    else C.num(sec, { label: `${label}: weight`, get: () => o[wk], set: (v) => (o[wk] = v), unit: F });
  }
  M.controls = function (c, C) {
    const st = S(), U = Core.UNITS[M.units], Lu = U.len, Ls = U.lenS, F = st.fu;
    let sec = C.section(c, 'Problem');
    C.select(sec, { label: 'Type of problem', get: () => st.mode, set: (v) => (st.mode = v), options: [['block', 'Block on a floor or slope: slip or tip'], ['incline', 'Block sliding on an incline'], ['ladder', 'Ladder against a wall'], ['wedge', 'Wedge'], ['screw', 'Square-threaded screw'], ['belt', 'Belt, rope or V-belt over drums; band brakes'], ['vehicle', 'Vehicle on wheels (car, truck, cart)'], ['bearing', 'Bearings and rolling resistance'], ['two', 'Two bodies: joined or stacked blocks, person and crate'], ['round', 'Spool, hoop or disk against a floor and a wall'], ['brake', 'Block brake or pawl on a wheel']] });
    C.seg(sec, { label: 'Force unit', get: () => st.fu, set: (v) => (st.fu = v), options: U.forces.map((f) => [f, f]) });
    if (st.mode === 'block') {
      const q = st.bk;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['check', 'Does it move under P?'], ['findP', 'P that starts motion']] });
      sec = C.section(c, 'Block');
      weightIn(sec, C, q, F, 'Block');
      C.num(sec, { label: 'Width of the base b', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Height (G at half height)', get: () => q.H, set: (v) => (q.H = v), unit: Lu });
      C.num(sec, { label: 'Slope angle (0 = level floor)', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      sec = C.section(c, 'Force P on the left face');
      if (q.task === 'check') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
      C.num(sec, { label: 'Angle from the surface (+ away from it)', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
      C.num(sec, { label: 'Height above the base', get: () => q.hP, set: (v) => (q.hP = v), unit: Lu });
    } else if (st.mode === 'incline') {
      const q = st.ic;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['release', 'Does it slide?'], ['hold', 'Force to hold'], ['up', 'Force to push up'], ['mu', 'μs for impending motion']] });
      sec = C.section(c, 'Block and slope');
      weightIn(sec, C, q, F, 'Block');
      C.num(sec, { label: 'Slope angle φ', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      if (q.task !== 'mu') {
        C.num(sec, { label: 'Static friction μs', get: () => q.mus, set: (v) => (q.mus = v), unit: '' });
        C.num(sec, { label: 'Kinetic friction μk (while sliding)', get: () => q.muk, set: (v) => (q.muk = v), unit: '' });
      }
      if (q.task === 'release') C.num(sec, { label: 'Distance it slides d', get: () => q.d, set: (v) => (q.d = v), unit: Lu });
      else {
        sec = C.section(c, 'Force P');
        if (q.task === 'mu') C.num(sec, { label: 'P (0 = no force)', get: () => q.P, set: (v) => (q.P = v), unit: F });
        C.num(sec, { label: 'Angle from the slope (+ away from it)', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
        if (q.task === 'up') C.num(sec, { label: 'Acceleration up the slope (0 = steady speed)', get: () => q.acc, set: (v) => (q.acc = v), unit: U.acc });
      }
    } else if (st.mode === 'ladder') {
      const q = st.ld;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['minAngle', 'Smallest angle'], ['check', 'Friction needed at an angle']] });
      sec = C.section(c, 'Ladder');
      weightIn(sec, C, q, F, 'Ladder');
      C.num(sec, { label: 'Length L', get: () => q.L, set: (v) => (q.L = v), unit: Lu });
      if (q.task === 'check') C.num(sec, { label: 'Angle with the floor θ', get: () => q.th, set: (v) => (q.th = v), unit: '°' });
      C.num(sec, { label: 'μs at the floor (A)', get: () => q.muA, set: (v) => (q.muA = v), unit: '' });
      C.num(sec, { label: 'μs at the wall (B), 0 = smooth', get: () => q.muB, set: (v) => (q.muB = v), unit: '' });
      sec = C.section(c, 'Person on the ladder');
      C.toggle(sec, { label: 'Someone stands on the ladder', get: () => !!q.person, set: (v) => (q.person = v) });
      if (q.person) { weightIn(sec, C, q, F, 'Person', 'wpBy', 'mp', 'Wp'); C.num(sec, { label: 'Distance up the ladder from A', get: () => q.s, set: (v) => (q.s = v), unit: Lu }); }
    } else if (st.mode === 'wedge') {
      const q = st.wd;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Push to raise'], ['lower', 'Pull to remove']] });
      sec = C.section(c, 'Load on the wedge');
      C.seg(sec, { label: 'The wedge lifts', get: () => q.load, set: (v) => (q.load = v), options: [['lever', 'A lever pinned at A'], ['guide', 'A block in a guide']] });
      weightIn(sec, C, q, F, 'Load');
      if (q.load === 'lever') {
        C.num(sec, { label: 'Wedge contact B from the pin A', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
        C.num(sec, { label: 'Weight from the pin A', get: () => q.xW, set: (v) => (q.xW = v), unit: Lu });
      } else C.num(sec, { label: 'μs at the guide', get: () => q.muG, set: (v) => (q.muG = v), unit: '' });
      sec = C.section(c, 'Wedge');
      C.num(sec, { label: 'Wedge angle α', get: () => q.al, set: (v) => (q.al = v), unit: '°' });
      C.num(sec, { label: 'μs between wedge and load (B)', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.num(sec, { label: 'μs between wedge and floor (C)', get: () => q.muC, set: (v) => (q.muC = v), unit: '' });
    } else if (st.mode === 'screw') {
      const q = st.sc;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['raise', 'Moment to raise'], ['lower', 'Moment to lower or hold']] });
      sec = C.section(c, 'Screw');
      C.num(sec, { label: 'Axial load W', get: () => q.W, set: (v) => (q.W = v), unit: F });
      C.num(sec, { label: 'Mean radius r', get: () => q.r, set: (v) => (q.r = v), unit: Ls });
      C.num(sec, { label: 'Lead l (advance per turn)', get: () => q.l, set: (v) => (q.l = v), unit: Ls });
      C.num(sec, { label: 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      C.seg(sec, { label: 'Screws turned together', get: () => String(q.n), set: (v) => (q.n = +v), options: [['1', 'One'], ['2', 'Two (turnbuckle)']] });
    } else if (st.mode === 'bearing') {
      const q = st.be, FL = `${F}·${Lu}`;
      C.select(sec, { label: 'Bearing', get: () => q.kind, set: (v) => (q.kind = v), options: [['collar', 'Collar bearing (ring of radii R₁, R₂)'], ['disk', 'Disk or pivot bearing (solid circle)'], ['journal', 'Journal bearing (shaft in a loose hole)'], ['rolling', 'Rolling resistance of a wheel']] });
      if (q.kind !== 'rolling') C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['M', 'Moment to turn'], ['mu', 'μ from a measured moment']] });
      sec = C.section(c, q.kind === 'rolling' ? 'Wheel' : 'Bearing');
      if (q.kind === 'collar' || q.kind === 'disk') {
        C.num(sec, { label: 'Axial force P', get: () => q.P, set: (v) => (q.P = v), unit: F });
        if (q.kind === 'collar') C.num(sec, { label: 'Inner radius R₁', get: () => q.R1, set: (v) => (q.R1 = v), unit: Lu });
        C.num(sec, { label: q.kind === 'collar' ? 'Outer radius R₂' : 'Radius R', get: () => q.R2, set: (v) => (q.R2 = v), unit: Lu });
      } else if (q.kind === 'journal') {
        C.num(sec, { label: 'Load on the bearing R', get: () => q.W, set: (v) => (q.W = v), unit: F });
        C.num(sec, { label: 'Shaft radius r', get: () => q.rs, set: (v) => (q.rs = v), unit: Lu });
      } else {
        C.num(sec, { label: 'Load on the wheel W', get: () => q.W, set: (v) => (q.W = v), unit: F });
        C.num(sec, { label: 'Wheel radius r', get: () => q.rw, set: (v) => (q.rw = v), unit: Lu });
        C.num(sec, { label: 'Coefficient of rolling resistance a (ground)', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
        C.num(sec, { label: 'a_B at a load on top (0 = a wheel on an axle)', get: () => q.aB, set: (v) => (q.aB = v), unit: Lu });
      }
      if (q.kind !== 'rolling') {
        if (q.task === 'mu') C.num(sec, { label: 'Moment that turns it M', get: () => q.M, set: (v) => (q.M = v), unit: FL });
        else C.num(sec, { label: q.kind === 'journal' ? 'Kinetic friction μk' : 'Static friction μs', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      }
    } else if (st.mode === 'round') {
      const q = st.rd;
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['P', 'P that turns it'], ['check', 'Does P turn it?'], ['mu', 'μs at which P turns it']] });
      sec = C.section(c, 'Body');
      weightIn(sec, C, q, F, 'Body');
      C.num(sec, { label: 'Outer radius R (where it touches)', get: () => q.R, set: (v) => (q.R = v), unit: Lu });
      sec = C.section(c, 'Contacts');
      C.seg(sec, { label: 'The wall is on the', get: () => q.wall, set: (v) => (q.wall = v), options: [['left', 'Left (A)'], ['right', 'Right (A)']] });
      if (q.task !== 'mu') {
        C.num(sec, { label: 'μs on the floor at B (0 = smooth)', get: () => q.muF, set: (v) => (q.muF = v), unit: '' });
        C.num(sec, { label: 'μs on the wall at A (0 = smooth)', get: () => q.muW, set: (v) => (q.muW = v), unit: '' });
      } else C.note(sec, 'The same μs is found for the floor and the wall.');
      sec = C.section(c, 'Force P');
      if (q.task !== 'P') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
      C.num(sec, { label: 'Point of P: distance from the centre r_P', get: () => q.rP, set: (v) => (q.rP = v), unit: Lu });
      C.num(sec, { label: 'Point of P: angle from +x, counterclockwise', get: () => q.thP, set: (v) => (q.thP = v), unit: '°' });
      C.num(sec, { label: 'Direction of P, counterclockwise from +x', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
      C.note(sec, 'A wire pulled off the hub of a spool: r_P = hub radius, angle −90° (leaves at the bottom) or 90° (top). A push on the top of a hoop: r_P = R, angle 90°.');
    } else if (st.mode === 'brake' && st.br.kind === 'double') {
      const q = st.br, FLu = `${F}·${Lu}`;
      C.seg(sec, { label: 'Brake', get: () => q.kind, set: (v) => (q.kind = v), options: [['single', 'One shoe or a pawl'], ['double', 'Double-block brake']] });
      C.seg(sec, { label: 'Find', get: () => q.task2, set: (v) => (q.task2 = v), options: [['P', 'Handle force for M'], ['M', 'Torque a force resists']] });
      sec = C.section(c, 'Wheel');
      C.num(sec, { label: 'Radius of the wheel r', get: () => q.r2, set: (v) => (q.r2 = v), unit: Lu });
      C.num(sec, { label: 'μs between the shoes and the wheel', get: () => q.mu2, set: (v) => (q.mu2 = v), unit: '' });
      if (q.task2 === 'P') C.num(sec, { label: 'Torque on the wheel M', get: () => q.M2, set: (v) => (q.M2 = v), unit: FLu });
      C.seg(sec, { label: 'M turns the wheel', get: () => (q.rev2 ? 'cw' : 'ccw'), set: (v) => (q.rev2 = v === 'cw'), options: [['ccw', 'Counterclockwise'], ['cw', 'Clockwise']] });
      sec = C.section(c, 'Levers (pinned at A and B below the wheel)');
      C.num(sec, { label: 'Shoe H above A, h_H', get: () => q.hH, set: (v) => (q.hH = v), unit: Lu });
      C.num(sec, { label: 'Pin D (top of AD) above A, h_D', get: () => q.hD, set: (v) => (q.hD = v), unit: Lu });
      C.num(sec, { label: 'Shoe I above B, h_I', get: () => q.hI, set: (v) => (q.hI = v), unit: Lu });
      C.num(sec, { label: 'K (top of BK) above B, h_K', get: () => q.hK, set: (v) => (q.hK = v), unit: Lu });
      C.num(sec, { label: 'Shoe face from the lever line, t (0 in the book)', get: () => q.t2, set: (v) => (q.t2 = v), unit: Lu });
      sec = C.section(c, 'Bell-crank EDC and handle');
      C.note(sec, 'Arm DC points up from D and takes the horizontal link KC; arm DE points sideways and takes the vertical link EJ down to the handle.');
      C.num(sec, { label: 'Arm D to C, d_DC', get: () => q.dDC, set: (v) => (q.dDC = v), unit: Lu });
      C.num(sec, { label: 'Arm D to E, d_DE', get: () => q.dDE, set: (v) => (q.dDE = v), unit: Lu });
      C.num(sec, { label: 'P from the handle pivot, a_P', get: () => q.aP, set: (v) => (q.aP = v), unit: Lu });
      C.num(sec, { label: 'J from the handle pivot, a_J', get: () => q.aJ, set: (v) => (q.aJ = v), unit: Lu });
      if (q.task2 === 'M') C.num(sec, { label: 'Force on the handle P', get: () => q.P2, set: (v) => (q.P2 = v), unit: F });
    } else if (st.mode === 'brake') {
      const q = st.br, FLu = `${F}·${Lu}`;
      C.seg(sec, { label: 'Brake', get: () => q.kind || 'single', set: (v) => (q.kind = v), options: [['single', 'One shoe or a pawl'], ['double', 'Double-block brake']] });
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['P', 'Lever force for M'], ['M', 'Torque a force resists'], ['lock', 'Self-locking (pawl)']] });
      sec = C.section(c, 'Wheel');
      C.num(sec, { label: 'Radius of the wheel r', get: () => q.rW, set: (v) => (q.rW = v), unit: Lu });
      C.num(sec, { label: 'μs between the shoe and the wheel', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      if (q.task === 'P') C.num(sec, { label: 'Torque on the wheel M', get: () => q.M, set: (v) => (q.M = v), unit: FLu });
      C.toggle(sec, { label: 'The wheel turns the other way (reverses F)', get: () => !!q.rev, set: (v) => (q.rev = v) });
      sec = C.section(c, 'Lever (moments about its pivot O)');
      if (q.task === 'M') C.num(sec, { label: 'Force on the lever P (or spring force)', get: () => q.P, set: (v) => (q.P = v), unit: F });
      if (q.task !== 'lock') C.num(sec, { label: 'Moment arm of P, a', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
      C.num(sec, { label: 'Moment arm of the normal force N, b', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Moment arm of the friction force F, e', get: () => q.e, set: (v) => (q.e = v), unit: Lu });
      C.note(sec, 'Each arm is positive when that force on the lever turns it against P, negative when it helps P. e is the offset of the pivot from the line of the friction force. P a = N b + F e; when b + μs e ≤ 0 the lever locks by itself.');
    } else if (st.mode === 'two') {
      const q = st.tw, push = q.arr === 'push', nA = push ? 'Crate' : 'Block A', nB = push ? 'Person' : 'Block B';
      C.select(sec, { label: 'Arrangement', get: () => q.arr, set: (v) => (q.arr = v), options: [['inc', 'Two blocks on an incline, joined by a spring or cord'], ['stack', 'Block A on top of block B'], ['push', 'Person pushing or pulling a crate']] });
      if (q.arr === 'inc') C.seg(sec, { label: 'Find the angle θ at which', get: () => q.task, set: (v) => (q.task = v), options: [['first', 'One block slips'], ['both', 'Both blocks slip']] });
      sec = C.section(c, 'Bodies');
      C.seg(sec, { label: 'Given as', get: () => q.wBy, set: (v) => (q.wBy = v), options: [['mass', 'Masses'], ['force', 'Weights']] });
      [[nA, 'mA', 'WA', 'muA', push ? 'μs under the crate' : q.arr === 'stack' ? 'μs between A and B' : 'μs under A'], [nB, 'mB', 'WB', 'muB', push ? 'μs under the shoes μ′' : 'μs under B']].forEach(([n, mk, wk, uk, ul], i) => {
        if (q.wBy === 'mass') C.num(sec, { label: `${n}: mass`, get: () => q[mk], set: (v) => (q[mk] = v), unit: massU() });
        else C.num(sec, { label: `${n}: weight`, get: () => q[wk], set: (v) => (q[wk] = v), unit: F });
        if (!(q.arr === 'stack' && i === 1)) C.num(sec, { label: ul, get: () => q[uk], set: (v) => (q[uk] = v), unit: '' });
      });
      if (q.arr === 'stack') C.num(sec, { label: 'μs between B and the floor', get: () => q.muG, set: (v) => (q.muG = v), unit: '' });
      if (q.arr === 'inc') {
        sec = C.section(c, 'Connection');
        C.seg(sec, { label: 'Lower block on the slope', get: () => q.lower, set: (v) => (q.lower = v), options: [['A', 'A'], ['B', 'B']] });
        C.seg(sec, { label: 'Joined by', get: () => q.conn, set: (v) => (q.conn = v), options: [['spring', 'Spring'], ['cord', 'Cord']] });
        if (q.conn === 'spring') C.num(sec, { label: 'Spring stiffness k', get: () => q.k, set: (v) => (q.k = v), unit: `${F}/${Lu}` });
        C.note(sec, q.conn === 'spring' ? 'The spring is unstretched while the blocks are at rest, so it carries no force until one of them moves.' : 'A cord can only pull, so it holds the lower block back only when that block has the smaller μs.');
      } else if (q.arr === 'stack') {
        sec = C.section(c, 'Force P and the cord');
        C.toggle(sec, { label: 'Block A is tied to the wall by a cord', get: () => !!q.tie, set: (v) => { q.tie = v; if (v) q.Pon = 'B'; } });
        if (q.tie) C.num(sec, { label: 'Cord angle above the horizontal β', get: () => q.beta, set: (v) => (q.beta = v), unit: '°' });
        else C.seg(sec, { label: 'P pulls', get: () => q.Pon, set: (v) => (q.Pon = v), options: [['A', 'Block A (top)'], ['B', 'Block B (bottom)']] });
        C.num(sec, { label: 'Angle of P above the horizontal α', get: () => q.al, set: (v) => (q.al = v), unit: '°' });
      } else {
        sec = C.section(c, 'How the person acts on the crate');
        C.seg(sec, { label: 'The person', get: () => q.how, set: (v) => (q.how = v), options: [['push', 'Pushes it horizontally'], ['rope', 'Pulls a rope']] });
        if (q.how === 'rope') {
          C.num(sec, { label: 'Rope angle at the crate θ_c (above horizontal)', get: () => q.thC, set: (v) => (q.thC = v), unit: '°' });
          C.num(sec, { label: 'Rope angle at the person θ_m (above horizontal)', get: () => q.thM, set: (v) => (q.thM = v), unit: '°' });
          C.note(sec, 'Use the same angle for a straight rope; different angles for a rope over a pulley.');
        } else {
          C.toggle(sec, { label: 'Check whether the crate tips', get: () => !!q.tip, set: (v) => (q.tip = v) });
          if (q.tip) { C.num(sec, { label: 'Crate width b', get: () => q.b, set: (v) => (q.b = v), unit: Lu }); C.num(sec, { label: 'Height of the push h', get: () => q.h, set: (v) => (q.h = v), unit: Lu }); }
        }
      }
    } else if (st.mode === 'vehicle') {
      const q = st.vh, AX = [['free', 'Roll freely'], ['locked', 'Braked (locked)'], ['driven', 'Driven']];
      C.seg(sec, { label: 'Find', get: () => q.task, set: (v) => (q.task = v), options: [['park', 'Reactions when parked'], ['force', 'Force P to move it'], ['slope', 'Steepest slope']] });
      sec = C.section(c, 'Vehicle');
      weightIn(sec, C, q, F, 'Vehicle');
      C.num(sec, { label: 'G from axle A (along the road)', get: () => q.a, set: (v) => (q.a = v), unit: Lu });
      C.num(sec, { label: 'G from axle B (along the road)', get: () => q.b, set: (v) => (q.b = v), unit: Lu });
      C.num(sec, { label: 'Height of G above the road h', get: () => q.h, set: (v) => (q.h = v), unit: Lu });
      C.seg(sec, { label: 'Front of the vehicle at', get: () => q.front, set: (v) => (q.front = v), options: [['B', 'B (right)'], ['A', 'A (left)']] });
      sec = C.section(c, 'Wheels and road');
      C.seg(sec, { label: 'Wheels at A', get: () => q.axA, set: (v) => (q.axA = v), options: AX });
      C.seg(sec, { label: 'Wheels at B', get: () => q.axB, set: (v) => (q.axB = v), options: AX });
      C.num(sec, { label: 'Static friction μs (tires on the road)', get: () => q.mu, set: (v) => (q.mu = v), unit: '' });
      if (q.task !== 'slope') C.num(sec, { label: 'Slope angle φ (0 = level road)', get: () => q.phi, set: (v) => (q.phi = v), unit: '°' });
      C.seg(sec, { label: 'The road rises toward', get: () => q.rise, set: (v) => (q.rise = v), options: [['A', 'A (left)'], ['B', 'B (right)']] });
      if (q.task === 'park') { sec = C.section(c, 'Other force on the vehicle'); C.toggle(sec, { label: 'A force P acts (a tow rope, a push, a load)', get: () => !!q.hasP, set: (v) => (q.hasP = v) }); }
      else if (q.task === 'force') sec = C.section(c, 'Force P');
      if (q.task === 'force' || (q.task === 'park' && q.hasP)) {
        if (q.task === 'park') C.num(sec, { label: 'P', get: () => q.P, set: (v) => (q.P = v), unit: F });
        C.num(sec, { label: 'Point of P: distance from A along the road (− = beyond A)', get: () => q.xP, set: (v) => (q.xP = v), unit: Lu });
        C.num(sec, { label: 'Point of P: height above the road', get: () => q.yP, set: (v) => (q.yP = v), unit: Lu });
        C.num(sec, { label: 'Direction of P, counterclockwise from A → B', get: () => q.psi, set: (v) => (q.psi = v), unit: '°' });
        if (q.task === 'force') C.seg(sec, { label: 'The vehicle is about to move toward', get: () => q.move, set: (v) => (q.move = v), options: [['A', 'A'], ['B', 'B']] });
      }
    } else {
      const q = st.bt, FLu = `${F}·${Lu}`;
      sec = C.section(c, 'Set-up');
      C.toggle(sec, { label: 'Band on a wheel carrying a torque (band brake or belt drive)', get: () => !!q.wheel, set: (v) => { q.wheel = v; if (v) q.drums.splice(1); } });
      if (q.wheel) {
        C.seg(sec, { label: 'Find', get: () => q.task || 'T', set: (v) => (q.task = v), options: [['T', 'Tensions (and P) for a torque M'], ['M', 'Torque from a known tension'], ['lever', 'Torque a lever force P resists']] });
        C.num(sec, { label: 'Radius of the wheel r', get: () => q.rW, set: (v) => (q.rW = v), unit: Lu });
        if (q.task === 'T' || !q.task) C.num(sec, { label: 'Torque on the wheel M', get: () => q.M, set: (v) => (q.M = v), unit: FLu });
      }
      if (!q.wheel || q.task === 'M') {
        sec = C.section(c, 'Tension');
        C.seg(sec, { label: 'The known tension is', get: () => q.known, set: (v) => (q.known = v), options: [['high', 'The larger one T₂'], ['low', 'The smaller one T₁']] });
        C.num(sec, { label: 'Known tension', get: () => q.T, set: (v) => (q.T = v), unit: F });
      }
      if (q.wheel && q.task !== 'M') {
        sec = C.section(c, 'Lever that tightens the band');
        C.toggle(sec, { label: 'The band ends are pinned to a lever pulled by P', get: () => !!q.lever, set: (v) => (q.lever = v) });
        if (q.lever || q.task === 'lever') {
          if (q.task === 'lever') C.num(sec, { label: 'Force on the lever P', get: () => q.P, set: (v) => (q.P = v), unit: F });
          C.num(sec, { label: 'Moment arm of P about the pivot a', get: () => q.aL, set: (v) => (q.aL = v), unit: Lu });
          C.num(sec, { label: 'Moment arm of the tight end T₂, d_T', get: () => q.dT, set: (v) => (q.dT = v), unit: Lu });
          C.num(sec, { label: 'Moment arm of the slack end T₁, d_S', get: () => q.dS, set: (v) => (q.dS = v), unit: Lu });
          C.note(sec, 'Enter an arm as positive when that band tension turns the lever against P, negative when it helps P, and 0 when the band end is pinned at the pivot. Moments about the pivot: P a = d_T T₂ + d_S T₁.');
        }
      }
      sec = C.section(c, q.wheel ? 'Contact on the wheel' : 'Drums (in order from the known end)');
      C.list(sec, { items: q.drums, max: q.wheel ? 1 : 4, min: 1, color: () => '#e2cdef', title: (it, i) => (q.wheel ? 'Wheel' : `Drum ${i + 1}`), fields: () => [{ key: 'beta', label: 'Contact angle β', unit: '°' }, { key: 'turns', label: 'Extra full turns', unit: '' }, { key: 'mu', label: 'μs', unit: '' }, { key: 'alpha', label: 'V-groove angle α (0 = flat belt)', unit: '°' }], add: [['Drum', () => ({ beta: 180, turns: 0, mu: 0.3, alpha: 0 })]] });
    }
  };

  M.diagram = function (c, C) {
    const st = S();
    if (st.mode === 'brake' && st.br.kind === 'double') C.toggle(c, { label: 'Forces on the wheel and in the links (free-body view)', get: () => st.fbd2 !== false, set: (v) => (st.fbd2 = v), rebuild: false });
  };
  M.compute = (U) => Friction.solve(S(), U);
  M.onUnits = (from, to) => Friction.convertState(S(), from, to);
  M.toggle = 'Values on the diagram';
  M.cap2D = () => ({ block: 'Free-body diagram and friction cone', incline: 'Block on the incline', ladder: 'Free-body diagram of the ladder', wedge: 'Free-body diagram of the wedge and load', screw: 'Screw and the unwrapped thread', belt: 'Belt on the drums', vehicle: 'Free-body diagram of the vehicle', bearing: 'Bearing', two: 'Free-body diagrams of both bodies', round: 'Free-body diagram of the round body', brake: S().br.kind === 'double' ? 'Double-block brake' : 'Wheel and brake lever' }[mode()]);
  M.cap3D = '3D view';
  M.hint = () => ({
    block: 'Green: the normal force N at its position x and the friction force F. Orange dashed: the friction cone at ±φs = tan⁻¹ μs; while the resultant of N and F stays inside it, the block does not slip, and while N stays within the base, it does not tip.',
    incline: 'Purple: friction, which acts up the slope when the block slides or is about to slide down, and down the slope when it is pushed up. Orange dashed: the angle of repose φs = tan⁻¹ μs; a slope steeper than it lets the block slide by itself. Press Play to watch it move.',
    ladder: 'The foot slips away from the wall and the top slides down, so friction acts toward the wall at A and upward at B.',
    wedge: 'Friction opposes the motion that is about to happen on each surface. Purple arrows are friction forces.',
    screw: 'The thread is unwrapped into a slope of rise l over a run of 2πr. The resultant R of the normal and friction forces leans at φs from the normal.',
    belt: 'The tension grows by e^(μβ) over each drum, toward the side the belt is about to slip to. A V-belt wedged in a groove of angle α grips harder: μ is replaced by μ / sin(α/2). On a wheel carrying a torque M, (T₂ − T₁) r = M.',
    bearing: 'Collar and disk bearings: the axial force is spread uniformly over the ring, and friction on each ring dA acts at its radius. Journal bearings: the resultant R is tangent to the friction circle r_f = r sin φk. Rolling: the ground reaction acts a distance a ahead of the lowest point.',
    two: 'Green: normal forces. Purple: friction at its limit μs N wherever slipping is about to happen. On a joined pair the spring or cord pulls the two blocks toward each other when it is in tension.',
    round: 'Turning in place makes the rim slide over the floor and the wall at once, so friction at each rough contact is μs N against the sliding. The curved arrow shows the sense in which P turns the body.',
    brake: S().br.kind === 'double' ? 'P on the handle pulls link EJ down, which turns the bell-crank about D: link KC pulls lever BK in and the pin D pushes lever AD in, so both shoes squeeze the wheel. Friction on the wheel, μs N at each shoe, opposes M. Lengths follow the values you enter.' : 'Schematic lever: the pivot O, the shoe pressing on the wheel with N, the friction F = μs N dragged along by the wheel, and P. Distances on the lever follow the moment arms you enter.',
    vehicle: 'Green: the normal forces at the two axles. Purple: friction, which acts only at braked or driven wheels; freely rolling wheels carry none. A wheel marked with a cross is locked by its brake. For tipping sideways on a road tilted across it, enter half the track width as the distances from G to A and B.',
  }[mode()]);
  M.legend = () => [[LCOL, 'Loads'], [RCOL, 'Normal forces'], [FCOL, 'Friction']].concat(mode() === 'block' ? [[CONE, 'Friction cone', 'ln']] : mode() === 'incline' ? [[CONE, 'Angle of repose', 'ln']] : []);
  /* Play slides the block down the slope (released) or up it (pushed); the clock shows the real time. */
  let animGeo = null;
  const slide = { duration: 6, loop: true,
    frame(u) { S()._s = u; },
    label(u) {
      const g = animGeo; if (!g) return '';
      const U = Core.UNITS[M.units];
      if (g.task === 'release') { const t = u * g.t; return `t = ${fmt(t, 3)} s · v = ${fmt(g.a * t, 3)} ${U.vel}`; }
      return g.a > 0 ? `a = ${fmt(g.a, 3)} ${U.acc} up the slope` : 'Steady speed up the slope';
    } };
  M.anim = () => {
    if (mode() !== 'incline') return null;
    const r = Friction.solve(S(), Core.UNITS[M.units]);
    animGeo = r.ok && r.geo.moving ? r.geo : null;
    return animGeo ? slide : null;
  };

  /* ------------------------------------------------------------------ */
  /* 2D helpers                                                         */
  /* ------------------------------------------------------------------ */
  function arrowPx(g, x1, y1, x2, y2, color, w, hs) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L; hs = hs || 10;
    s('line', { x1, y1, x2: x2 - ux * hs * 0.8, y2: y2 - uy * hs * 0.8, stroke: color, 'stroke-width': w || 2.4, 'stroke-linecap': 'round' }, g);
    const px = -uy, py = ux;
    s('polygon', { points: `${x2},${y2} ${x2 - ux * hs + px * hs * 0.42},${y2 - uy * hs + py * hs * 0.42} ${x2 - ux * hs - px * hs * 0.42},${y2 - uy * hs - py * hs * 0.42}`, fill: color }, g);
  }
  const hatch = (svg) => { const d = s('defs', {}, svg), p = s('pattern', { id: 'hatchF', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); s('rect', { width: 7, height: 7, fill: '#dfe4e8' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#7f8c8d', 'stroke-width': 1.6 }, p); };
  let LW = 0;
  const lbl = (g, x, y, txt, o) => {
    o = Object.assign({ size: 11.5, weight: 700 }, o);
    if (LW) { const tw = txt.length * o.size * 0.56, a = o.anchor || 'start', l = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2; x += Math.max(0, 6 - l) - Math.max(0, l + tw - (LW - 6)); }
    return T(g, x, y, txt, o);
  };
  /** Arrow of fixed pixel length ending at (or, with out, starting from) a screen point, labelled at its free end. */
  function force(g, x, y, ux, uy, L, color, txt, out, gap) {
    gap = gap || 0;
    const tx = out ? x + ux * gap : x - ux * (L + gap), ty = out ? y + uy * gap : y - uy * (L + gap), hx = tx + ux * L, hy = ty + uy * L;
    arrowPx(g, tx, ty, hx, hy, color, 2.4, 10);
    if (!txt) return;
    const sg = out ? 1 : -1, ex = (out ? hx : tx) + sg * ux * 6, ey = (out ? hy : ty) + sg * uy * 6, dx = sg * ux, dy = sg * uy;
    lbl(g, ex, ey + (dy > 0.5 ? 12 : dy < -0.5 ? -3 : 4), txt, { anchor: dx > 0.4 ? 'start' : dx < -0.4 ? 'end' : 'middle', color });
  }
  function arcPx(g, cx, cy, r, a0, a1, color, w) {
    const n = 30, pts = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`); }
    s('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': w || 1.4 }, g);
  }
  const poly = (g, pts, o) => s('polygon', Object.assign({ points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }, o), g);

  M.draw2D = function (svg, res, U, opt) {
    LW = svg.clientWidth || 800;
    const g = res.geo;
    if (g.kind === 'block') return drawBlock(svg, g, opt);
    if (g.kind === 'incline') return drawIncline(svg, g, opt);
    if (g.kind === 'ladder') return drawLadder(svg, g, opt);
    if (g.kind === 'wedge') return drawWedge(svg, g, opt);
    if (g.kind === 'screw') return drawScrew(svg, g, opt);
    if (g.kind === 'vehicle') return drawVehicle(svg, g, opt);
    if (g.kind === 'bearing') return drawBearing(svg, g, opt);
    if (g.kind === 'two') return drawTwo(svg, g, opt);
    if (g.kind === 'round') return drawRound(svg, g, opt);
    if (g.kind === 'brake') return drawBrake(svg, g, opt);
    if (g.kind === 'brake2') return drawBrake2(svg, g, opt);
    return drawBelt(svg, g, opt);
  };

  /* -------- block -------- */
  function drawBlock(svg, g, opt) {
    const { F, Lu } = g.c, ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, v) => [u * cp - v * sp, u * sp + v * cp];
    const e = Math.max(g.b, g.H), ext = g.b * 0.9 + e * 0.6;
    const pts = [R(-ext, 0), R(ext, 0), R(-g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]).concat([R(-ext, 0)[1] - e * 0.25]);
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) + e * 0.35 }, { pad: 60 }); hatch(svg);
    const g0 = D.root, P = (u, v) => { const w = R(u, v); return [D.X(w[0]), D.Y(w[1])]; };
    // ground or slope
    const a = P(-ext, 0), b = P(ext, 0), n = [sp, cp]; // screen direction into the ground
    poly(g0, [a, b, [b[0] + n[0] * 10, b[1] + n[1] * 10], [a[0] + n[0] * 10, a[1] + n[1] * 10]], { fill: 'url(#hatchF)' });
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    if (g.phi > 0) { arcPx(g0, a[0], a[1], 46, 0, g.phi, '#5a6b75'); lbl(g0, a[0] + 52, a[1] - 6, `${fmt(g.phi)}°`, { color: '#5a6b75', size: 11 }); s('line', { x1: a[0], y1: a[1], x2: a[0] + 70, y2: a[1], stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g0); }
    // block
    poly(g0, [P(-g.b / 2, 0), P(g.b / 2, 0), P(g.b / 2, g.H), P(-g.b / 2, g.H)], { fill: '#d9b58a', 'fill-opacity': 0.55, stroke: '#8a6a3f', 'stroke-width': 1.6 });
    const G = P(0, g.H / 2); s('circle', { cx: G[0], cy: G[1], r: 4, fill: '#1d2733' }, g0); lbl(g0, G[0] + 7, G[1] - 6, 'G', { color: '#1d2733' });
    // weight
    const wl = Math.min(46, Math.max(24, D.sc * g.H * 0.5 - 16));
    force(g0, G[0], G[1], 0, 1, wl, LCOL, null, true, 6); lbl(g0, G[0] + 7, G[1] + 6 + wl * 0.6, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // P on the left face, pushing (ψ < 0 or 0) or pulling (ψ > 0)
    if (Math.abs(g.P) > 0) {
      const at = P(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)), ux = d[0], uy = -d[1];
      force(g0, at[0], at[1], ux * Math.sign(g.P), uy * Math.sign(g.P), 52, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', g.psi > 0, 2);
    }
    // N at x, F along the base, friction cone at x
    const xN = Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), o = P(xN, 0), up = [-sp, -cp]; // screen unit normal, out of the surface
    force(g0, o[0], o[1], up[0], up[1], 46, RCOL, opt.showP ? `N = ${fmt(g.N)} ${F}` : 'N', false, 2);
    if (Math.abs(g.Ff) > 1e-12) { const t = R(-Math.sign(g.Ff), 0); force(g0, o[0], o[1], t[0], -t[1], 44, FCOL, opt.showP ? `F = ${fmt(Math.abs(g.Ff))} ${F}` : 'F', true, 4); }
    const phs = Math.atan(g.mu), Lc = Math.min(110, Math.max(70, D.sc * g.H * 0.9));
    [-1, 1].forEach((sg) => { const ang = ph + Math.PI / 2 + sg * phs, dx = Math.cos(ang), dy = -Math.sin(ang); s('line', { x1: o[0], y1: o[1], x2: o[0] + dx * Lc, y2: o[1] + dy * Lc, stroke: CONE, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g0); });
    lbl(g0, o[0] + Math.cos(ph + Math.PI / 2 + phs) * (Lc + 4), o[1] - Math.sin(ph + Math.PI / 2 + phs) * (Lc + 4), `φs = ${fmt(phs / DEG)}°`, { anchor: 'end', color: CONE, size: 11 });
    // resultant direction of N and F inside or outside the cone
    const Rang = ph + Math.PI / 2 + Math.atan2(-g.Ff, g.N), Lr = Lc * 0.75;
    s('line', { x1: o[0], y1: o[1], x2: o[0] + Math.cos(Rang) * Lr, y2: o[1] - Math.sin(Rang) * Lr, stroke: RCOL, 'stroke-width': 1.6, 'stroke-dasharray': '2 3' }, g0);
    // x dimension from the centre line
    const c0 = P(0, 0), c1 = P(0, -g.H * 0.18), x1 = P(xN, -g.H * 0.18);
    s('line', { x1: c0[0], y1: c0[1], x2: c1[0], y2: c1[1], stroke: '#9aa5ad', 'stroke-dasharray': '3 3' }, g0);
    if (Math.abs(g.x) > 1e-9) { s('line', { x1: c1[0], y1: c1[1], x2: x1[0], y2: x1[1], stroke: '#5a6b75', 'stroke-width': 1.2 }, g0); lbl(g0, (c1[0] + x1[0]) / 2, (c1[1] + x1[1]) / 2 + 14, `x = ${fmt(g.x)} ${Lu}`, { anchor: 'middle', color: '#5a6b75', size: 11 }); }
    const vt = g.find ? `${g.verdict === 'tip' ? 'Tips' : 'Slips'} first, at P = ${fmt(g.P)} ${F}` : { none: 'No slipping or tipping', slip: 'Slips', tip: 'Tips', both: 'Slips and tips' }[g.verdict];
    lbl(g0, 14, 22, vt, { color: g.verdict === 'none' ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
  }


  /* -------- block on an incline -------- */
  /** Where the block's centre sits along the slope (0 = foot, 1 = top), following the animation. */
  function inclinePos(g) {
    const k = S()._s, s0 = 0.24, s1 = 0.8;
    if (k === undefined || !g.moving) return 0.55;
    const e = g.task === 'release' || g.a > 0 ? k * k : k;
    return g.task === 'release' ? s1 - (s1 - s0) * e : s0 + (s1 - s0) * e;
  }
  function drawIncline(svg, g, opt) {
    const { F } = g.c, U = g.c.U, ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp];
    const bs = 0.17, top = R(1, 0), xr = top[0] + 0.12;
    const D = UI.Draw2D(svg, { xmin: -0.3, xmax: xr, ymin: -0.1, ymax: top[1] + 0.32 }, { pad: 52 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])];
    // ground and the slope
    const gl = P([-0.3, 0]), gr = P([xr, 0]);
    poly(g0, [gl, gr, [gr[0], gr[1] + 12], [gl[0], gl[1] + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: gl[0], y1: gl[1], x2: gr[0], y2: gr[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    poly(g0, [P([0, 0]), P([top[0], 0]), P(top)], { fill: '#e3e9ed', stroke: '#4a5661', 'stroke-width': 1.8 });
    const o = P([0, 0]);
    arcPx(g0, o[0], o[1], 54, 0, g.phi, '#1d2733'); lbl(g0, o[0] + 60, o[1] - 6, `φ = ${fmt(g.phi)}°`, { color: '#1d2733', size: 11.5 });
    // angle of repose
    const rr = g.rep * DEG, Lr = 0.36;
    s('line', { x1: o[0], y1: o[1], x2: D.X(Lr * Math.cos(rr)), y2: D.Y(Lr * Math.sin(rr)), stroke: CONE, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g0);
    lbl(g0, D.X(Lr * Math.cos(rr)) + 4, D.Y(Lr * Math.sin(rr)) + (rr < ph ? 14 : -6), `φs = ${fmt(g.rep)}°`, { color: CONE, size: 11 });
    // block
    const sc = inclinePos(g), cn = [R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)].map(P);
    poly(g0, cn, { fill: '#d9b58a', 'fill-opacity': 0.75, stroke: '#8a6a3f', 'stroke-width': 1.6 });
    const G = P(R(sc, bs / 2)); s('circle', { cx: G[0], cy: G[1], r: 3.5, fill: '#1d2733' }, g0);
    const up = [cp, -sp], nrm = [-sp, -cp]; // screen: up the slope, out of the surface
    force(g0, G[0], G[1], 0, 1, 50, LCOL, null, true, 4); lbl(g0, G[0] + 7, G[1] + 50, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    const b0 = P(R(sc, 0));
    force(g0, b0[0], b0[1], nrm[0], nrm[1], 44, RCOL, opt.showP ? `N = ${fmt(g.N)} ${F}` : 'N', false, 2);
    if (g.Ff > 1e-12) { const fd = g.fUp ? up : [-up[0], -up[1]], fb = P(R(sc + (g.fUp ? 1 : -1) * bs * 0.5, -0.012)); force(g0, fb[0], fb[1], fd[0], fd[1], 46, FCOL, opt.showP ? `F = ${fmt(g.Ff)} ${F}` : 'F', true, 2); }
    if (g.task !== 'release' && g.P > 0) {
      const dw = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)), d = [dw[0], -dw[1]];
      if (g.psi > 0) { const at = P(R(sc + bs / 2, bs / 2)); force(g0, at[0], at[1], d[0], d[1], 52, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', true, 2); }
      else { const at = P(R(sc - bs / 2, bs / 2)); force(g0, at[0], at[1], d[0], d[1], 52, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', false, 2); }
    }
    // direction of motion
    if (g.moving) {
      const dn = g.task === 'release', a0 = P(R(sc + (dn ? 0.13 : -0.13), bs * 1.9)), a1 = P(R(sc + (dn ? -0.13 : 0.13), bs * 1.9));
      s('line', { x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1], stroke: '#1d2733', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, g0);
      arrowPx(g0, a1[0] - (a1[0] - a0[0]) * 0.15, a1[1] - (a1[1] - a0[1]) * 0.15, a1[0], a1[1], '#1d2733', 1.6, 9);
      lbl(g0, (a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 10, g.a > 0 ? `a = ${fmt(g.a)} ${U.acc}` : 'steady speed', { anchor: 'middle', color: '#1d2733', size: 11.5 });
    }
    const vt = g.task === 'release' ? (g.moving ? 'Slides down the slope' : 'Stays at rest') : g.task === 'hold' ? (g.P > 0 ? `Held by P = ${fmt(g.P)} ${F}` : 'Friction alone holds it') : `Pushed up by P = ${fmt(g.P)} ${F}`;
    lbl(g0, 14, 22, vt, { color: g.task === 'release' && g.moving ? '#a3281f' : '#1e7a45', size: 13, weight: 800 });
  }


  /* -------- two bodies -------- */
  function zigzag(g, a, b, color) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, n = 8, w = 6, pts = [a];
    for (let i = 1; i < 2 * n; i++) { const t = 0.15 + 0.7 * (i / (2 * n)), sg = i % 2 ? 1 : -1; pts.push([a[0] + ux * L * t - uy * w * sg, a[1] + uy * L * t + ux * w * sg]); }
    pts.push(b);
    s('polyline', { points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.8 }, g);
  }
  function drawTwo(svg, g, opt) {
    const { F } = g.c, v = (k, x) => (opt.showP ? `${k} = ${fmt(Math.abs(x))} ${F}` : k), WOODC = '#d9b58a', WEDGEC = '#8a6a3f';
    if (g.arr === 'inc') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], bs = 0.2, top = R(1, 0), xr = top[0] + 0.12;
      const D = UI.Draw2D(svg, { xmin: -0.3, xmax: xr, ymin: -0.16, ymax: top[1] + 0.4 }, { pad: 52 }); hatch(svg);
      const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])], gl = P([-0.3, 0]), gr = P([xr, 0]);
      poly(g0, [gl, gr, [gr[0], gr[1] + 12], [gl[0], gl[1] + 12]], { fill: 'url(#hatchF)' });
      s('line', { x1: gl[0], y1: gl[1], x2: gr[0], y2: gr[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
      poly(g0, [P([0, 0]), P([top[0], 0]), P(top)], { fill: '#e3e9ed', stroke: '#4a5661', 'stroke-width': 1.8 });
      const o = P([0, 0]); arcPx(g0, o[0], o[1], 54, 0, g.phi, '#1d2733'); lbl(g0, o[0] - 8, o[1] + 16, `θ = ${fmt(g.phi)}°`, { color: '#1d2733', size: 11.5, anchor: 'end' });
      const up = [cp, -sp], nrm = [-sp, -cp], blocks = g.low === 'A' ? [['A', 0.3], ['B', 0.7]] : [['B', 0.3], ['A', 0.7]];
      blocks.forEach(([n, sc]) => {
        poly(g0, [R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)].map(P), { fill: WOODC, 'fill-opacity': 0.75, stroke: WEDGEC, 'stroke-width': 1.6 });
        const G = P(R(sc, bs / 2)); lbl(g0, G[0], G[1] + 4, n, { anchor: 'middle', color: '#1d2733', size: 13, weight: 800 });
        const W = n === 'A' ? g.WA : g.WB, N = n === 'A' ? g.NA : g.NB, Ff = n === 'A' ? g.FA : g.FB;
        lbl(g0, G[0], G[1] - D.sc * bs * 0.5 - 8, v('W_' + n, W), { color: LCOL, anchor: 'middle', size: 11 });
        force(g0, G[0] - 14, G[1] + 8, 0, 1, 34, LCOL, null, true, 2);
        const b0 = P(R(sc + bs * 0.15, 0)); force(g0, b0[0], b0[1], nrm[0], nrm[1], 40, RCOL, v('N_' + n, N), false, 2);
        if (Ff > 1e-12) { const fb = P(R(sc - bs * 0.5, -0.012)); force(g0, fb[0], fb[1], up[0], up[1], 40, FCOL, v('F_' + n, Ff), false, 2); }
      });
      const a = P(R(0.3 + bs / 2, bs / 2)), b = P(R(0.7 - bs / 2, bs / 2));
      if (g.conn === 'spring') zigzag(g0, a, b, '#1d2733'); else s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#1d2733', 'stroke-width': 1.8 }, g0);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      lbl(g0, m[0] - 10, m[1] - 14, g.conn === 'spring' ? `k${opt.showP && Math.abs(g.Fs) > 1e-12 ? `, F_s = ${fmt(Math.abs(g.Fs))} ${F} (${g.Fs > 0 ? 'T' : 'C'})` : ''}` : (opt.showP ? `T = ${fmt(g.Fs)} ${F}` : 'cord'), { anchor: 'middle', color: '#1d2733', size: 11 });
      lbl(g0, 14, 22, g.task === 'first' ? `One block slips at θ = ${fmt(g.phi)}°` : `Both blocks slip at θ = ${fmt(g.phi)}°`, { color: '#a3281f', size: 13, weight: 800 });
      return;
    }
    if (g.arr === 'stack') {
      const D = UI.Draw2D(svg, { xmin: -1.6, xmax: 2.2, ymin: -0.5, ymax: 1.7 }, { pad: 40 }); hatch(svg);
      const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)], f0 = P(-1.6, 0), f1 = P(2.2, 0);
      poly(g0, [f0, f1, [f1[0], f1[1] + 12], [f0[0], f0[1] + 12]], { fill: 'url(#hatchF)' }); s('line', { x1: f0[0], y1: f0[1], x2: f1[0], y2: f1[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
      const rect = (x0, y0, x1, y1, n) => { poly(g0, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], { fill: WOODC, 'fill-opacity': n === 'A' ? 0.95 : 0.6, stroke: WEDGEC, 'stroke-width': 1.6 }); const c = P((x0 + x1) / 2, (y0 + y1) / 2); lbl(g0, c[0], c[1] + 5, n, { anchor: 'middle', color: '#1d2733', size: 14, weight: 800 }); };
      rect(-0.9, 0, 0.9, 0.5, 'B'); rect(-0.45, 0.5, 0.45, 0.95, 'A');
      if (g.tie) { const w = P(-1.5, 0.725 + 1.05 * Math.tan(g.beta * DEG)), a = P(-0.45, 0.725); poly(g0, [[w[0] - 10, w[1] - 30], [w[0], w[1] - 30], [w[0], w[1] + 30], [w[0] - 10, w[1] + 30]], { fill: 'url(#hatchF)' }); s('line', { x1: a[0], y1: a[1], x2: w[0], y2: w[1], stroke: '#1d2733', 'stroke-width': 1.8 }, g0); lbl(g0, (a[0] + w[0]) / 2, (a[1] + w[1]) / 2 - 8, opt.showP ? `T = ${fmt(g.T)} ${F}` : 'T', { anchor: 'middle', color: '#1d2733' }); }
      const pa = g.Pon === 'A' ? P(0.45, 0.725) : P(0.9, 0.25), ad = g.al * DEG;
      force(g0, pa[0], pa[1], Math.cos(ad), -Math.sin(ad), 56, LCOL, v('P', g.P), true, 2);
      const wA = P(0, 0.725), wB = P(0.55, 0.25);
      force(g0, wA[0], wA[1] + 8, 0, 1, 26, LCOL, null, true, 2); force(g0, wB[0], wB[1] + 8, 0, 1, 26, LCOL, null, true, 2);
      lbl(g0, wA[0] + 6, wA[1] + 34, v('W_A', g.WA), { color: LCOL, size: 11 }); lbl(g0, wB[0] + 6, wB[1] + 34, v('W_B', g.WB), { color: LCOL, size: 11 });
      const c1 = P(-0.2, 0.5), c2 = P(-0.5, 0);
      if (g.F1 > 1e-12) force(g0, c1[0], c1[1] - 4, -1, 0, 40, FCOL, v('F₁ (on B)', g.F1), true, 2);
      force(g0, c2[0], c2[1], 0, -1, 36, RCOL, v('N₂', g.N2), false, 4);
      if (g.F2 > 1e-12) force(g0, c2[0] - 6, c2[1] + 6, -1, 0, 40, FCOL, v('F₂', g.F2), true, 2);
      lbl(g0, 14, 22, `P = ${fmt(g.P)} ${F}: ${g.mech}`, { color: '#a3281f', size: 13, weight: 800 });
      return;
    }
    // person and crate: the rope runs from the crate to the hands, over a pulley when the two angles differ
    const cw = 1.1, ch = 1.1, xc = 0.4, cA = g.rope ? [xc, ch * 0.6] : [xc, 0.8];
    let hand, Q = null;
    if (!g.rope) hand = cA;
    else {
      const tc = g.thC * DEG, tm = g.thM * DEG, dc = [-Math.cos(tc), Math.sin(tc)], dm = [Math.cos(tm), Math.sin(tm)];
      if (Math.abs(g.thC - g.thM) < 0.5) hand = [cA[0] + dc[0] * 1.4, cA[1] + dc[1] * 1.4];
      else { Q = [cA[0] + dc[0] * 2.2, cA[1] + dc[1] * 2.2]; const t2 = dm[1] > 0.05 && Q[1] > 1.35 ? (Q[1] - 1.2) / dm[1] : 0.8; hand = [Q[0] - dm[0] * t2, Q[1] - dm[1] * t2]; }
    }
    const lean = g.rope ? -0.25 : 0.3, sh = [hand[0] - (g.rope ? 0.35 : 0.55), Math.max(1.45, hand[1] + 0.2)], hip = [sh[0] - lean * 0.5, 0.9], xf = sh[0] - lean;
    const xs = [xf - 0.6, xc + cw + 0.5].concat(Q ? [Q[0] - 0.3] : []), ys = [2.1].concat(Q ? [Q[1] + 0.3] : []);
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: -0.6, ymax: Math.max(...ys) }, { pad: 40 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)], f0 = P(Math.min(...xs), 0), f1 = P(Math.max(...xs), 0);
    poly(g0, [f0, f1, [f1[0], f1[1] + 12], [f0[0], f0[1] + 12]], { fill: 'url(#hatchF)' }); s('line', { x1: f0[0], y1: f0[1], x2: f1[0], y2: f1[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    poly(g0, [P(xc, 0), P(xc + cw, 0), P(xc + cw, ch), P(xc, ch)], { fill: WOODC, 'fill-opacity': 0.75, stroke: WEDGEC, 'stroke-width': 1.6 });
    const cc = P(xc + cw / 2, ch / 2); lbl(g0, cc[0], cc[1] + 5, 'crate', { anchor: 'middle', color: '#1d2733', size: 12, weight: 800 });
    const stroke = { stroke: '#1d2733', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' };
    const L = (a, b) => { const p = P(...a), q = P(...b); s('line', Object.assign({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] }, stroke), g0); };
    L([xf - 0.15, 0], hip); L([xf + 0.18, 0], hip); L(hip, sh); L(sh, hand);
    const head = P(sh[0] + lean * 0.15, sh[1] + 0.25); s('circle', { cx: head[0], cy: head[1], r: D.sc * 0.13, fill: '#fff', stroke: '#1d2733', 'stroke-width': 2.4 }, g0);
    const a = P(...cA);
    if (!g.rope) force(g0, a[0], a[1] - 14, 1, 0, 50, LCOL, v('P', g.Tneed), false, 0);
    else {
      const h = P(...hand);
      if (Q) { const q = P(...Q); s('polyline', { points: `${a[0]},${a[1]} ${q[0]},${q[1]} ${h[0]},${h[1]}`, fill: 'none', stroke: '#6b4f2a', 'stroke-width': 2 }, g0); s('line', { x1: q[0], y1: q[1], x2: q[0], y2: q[1] - 40, stroke: '#4a5661', 'stroke-width': 2 }, g0); s('circle', { cx: q[0], cy: q[1], r: 8, fill: '#e8eef1', stroke: '#4a5661', 'stroke-width': 1.6 }, g0); }
      else s('line', { x1: a[0], y1: a[1], x2: h[0], y2: h[1], stroke: '#6b4f2a', 'stroke-width': 2 }, g0);
      const tc = g.thC * DEG; force(g0, a[0], a[1], -Math.cos(tc), -Math.sin(tc), 48, LCOL, v('T', g.Tneed), true, 4);
    }
    const nc = P(xc + cw / 2, 0), nm = P(xf, 0);
    force(g0, nc[0], nc[1], 0, -1, 36, RCOL, 'N_c', false, 4); force(g0, nc[0] + 30, nc[1] + 6, -1, 0, 40, FCOL, 'F_c', true, 2);
    force(g0, nm[0], nm[1], 0, -1, 36, RCOL, 'N_m', false, 4); force(g0, nm[0] + (g.rope ? -4 : 4), nm[1] + 6, g.rope ? -1 : 1, 0, 40, FCOL, 'F_m', true, 2);
    lbl(g0, 14, 22, g.can ? 'The person can move the crate' : 'The person slips first: the crate does not move', { color: g.can ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
    lbl(g0, 14, 40, `needs ${fmt(g.Tneed)} ${F} · can give ${fmt(g.Tmax)} ${F}`, { color: '#1d2733', size: 11.5 });
  }

  /* -------- ladder -------- */
  function drawLadder(svg, g, opt) {
    const { F } = g.c, th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)];
    const D = UI.Draw2D(svg, { xmin: -L * 0.32, xmax: A[0] + L * 0.42, ymin: -L * 0.22, ymax: B[1] + L * 0.2 }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (p) => [D.X(p[0]), D.Y(p[1])], a = P(A), b = P(B), o = P([0, 0]);
    poly(g0, [[o[0] - 14, D.Y(B[1] + L * 0.15)], [o[0], D.Y(B[1] + L * 0.15)], [o[0], o[1]], [o[0] - 14, o[1]]], { fill: 'url(#hatchF)' });
    poly(g0, [[o[0] - 14, o[1]], [D.X(A[0] + L * 0.35), o[1]], [D.X(A[0] + L * 0.35), o[1] + 12], [o[0] - 14, o[1] + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: o[0], y1: o[1], x2: o[0], y2: D.Y(B[1] + L * 0.15), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: o[0], y1: o[1], x2: D.X(A[0] + L * 0.35), y2: o[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8a6a3f', 'stroke-width': 9, 'stroke-linecap': 'round' }, g0);
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#d9b58a', 'stroke-width': 6, 'stroke-linecap': 'round' }, g0);
    arcPx(g0, a[0], a[1], 40, 180 - g.th, 180, '#5a6b75'); lbl(g0, a[0] - 46, a[1] - 8, `θ = ${fmt(g.th)}°`, { anchor: 'end', color: '#5a6b75', size: 11.5 });
    lbl(g0, a[0] + 8, a[1] - 10, 'A', { color: '#1d2733', size: 13, weight: 800 }); lbl(g0, b[0] + 12, b[1] - 6, 'B', { color: '#1d2733', size: 13, weight: 800 });
    const m = P([A[0] / 2, B[1] / 2]);
    force(g0, m[0], m[1], 0, 1, 46, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', true, 6);
    if (g.Wp > 0) { const k = g.s / L, pp = P([A[0] * (1 - k), B[1] * k]); s('circle', { cx: pp[0], cy: pp[1], r: 5, fill: LCOL }, g0); force(g0, pp[0], pp[1], 0, 1, 40, LCOL, opt.showP ? `${fmt(g.Wp)} ${F}` : 'W_p', true, 6); }
    force(g0, a[0], a[1], 0, -1, 44, RCOL, opt.showP ? `N_A = ${fmt(g.NA)} ${F}` : 'N_A', false, 14);
    if (g.FA > 0) force(g0, a[0], a[1] + 6, -1, 0, 44, FCOL, opt.showP ? `F_A = ${fmt(g.FA)} ${F}` : 'F_A', false, 6);
    force(g0, b[0], b[1], 1, 0, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 8);
    if (g.FB > 0) force(g0, b[0] + 4, b[1], 0, -1, 40, FCOL, opt.showP ? `F_B = ${fmt(g.FB)} ${F}` : 'F_B', true, 8);
  }

  /* -------- wedge -------- */
  function drawWedge(svg, g, opt) {
    const { F } = g.c, ta = Math.tan(g.al * DEG), lever = g.load === 'lever';
    const Lw = lever ? Math.max(g.a * 0.55, 1e-6) : 1, t = Lw * Math.max(ta, 0.2); // thin wedges are drawn steeper so the forces can be read
    const xB = Lw * 0.5, yB = t * 0.5, sc0 = lever ? g.a : Lw;
    // the lever's end corner rests on the wedge face at B and the pin A is beyond it (mirror of the book figure; same equations)
    const xA = xB + (lever ? g.a : 0), yL = yB, hL = sc0 * 0.08;
    const xmin = -Lw * 0.5, xmax = lever ? xA + sc0 * 0.15 : Lw * 1.5;
    const D = UI.Draw2D(svg, { xmin, xmax, ymin: -sc0 * 0.25, ymax: yB + sc0 * (lever ? 0.45 : 0.9) }, { pad: 50 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)];
    poly(g0, [P(xmin, 0), P(xmax, 0), [D.X(xmax), D.Y(0) + 12], [D.X(xmin), D.Y(0) + 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: D.X(xmin), y1: D.Y(0), x2: D.X(xmax), y2: D.Y(0), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    // wedge: thick end at the left, top face falls to the right
    poly(g0, [P(0, 0), P(Lw, 0), P(0, t)], { fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.6 });
    lbl(g0, D.X(Lw * 0.12), D.Y(0) + 18, 'C', { color: '#1d2733', size: 12, weight: 800 });
    const B = P(xB, yB);
    if (lever) {
      poly(g0, [P(xB, yL), P(xA + sc0 * 0.06, yL), P(xA + sc0 * 0.06, yL + hL), P(xB, yL + hL)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      const A = P(xA, yL); poly(g0, [A, [A[0] - 11, D.Y(0)], [A[0] + 11, D.Y(0)]], { fill: '#e8eef1', stroke: COL.support, 'stroke-width': 1.4 }); s('circle', { cx: A[0], cy: A[1], r: 4, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.5 }, g0);
      lbl(g0, A[0] + 10, A[1] - 8, 'A', { color: '#1d2733', size: 12, weight: 800 });
      const Wp = P(xA - g.xW, yL + hL); force(g0, Wp[0], Wp[1], 0, 1, 44, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    } else {
      const bw = Lw * 0.36, bh = Lw * 0.4, x0 = xB - bw / 2, yb = t * (1 - x0 / Lw);
      poly(g0, [P(x0, yb), P(x0 + bw, t * (1 - (x0 + bw) / Lw)), P(x0 + bw, yb + bh), P(x0, yb + bh)], { fill: '#d9b58a', 'fill-opacity': 0.6, stroke: '#8a6a3f', 'stroke-width': 1.5 });
      [x0 - Lw * 0.03, x0 + bw + Lw * 0.03].forEach((xg, i) => poly(g0, [P(xg, yB + bh * 0.1), P(xg, yB + bh * 1.6), [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 1.6)], [D.X(xg) + (i ? 8 : -8), D.Y(yB + bh * 0.1)]], { fill: 'url(#hatchF)' }));
      const Wp = P(xB, yb + bh); force(g0, Wp[0], Wp[1], 0, 1, 40, LCOL, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', false, 0);
    }
    lbl(g0, B[0] + 6, B[1] + 18, 'B', { color: '#1d2733', size: 12, weight: 800 });
    // forces on the wedge: N_B (pressing down into the wedge) and friction at B; N_C and friction at C; P
    const sa = Math.sin(g.al * DEG), ca = Math.cos(g.al * DEG), raise = g.task === 'raise';
    force(g0, B[0], B[1], -sa, ca, 44, RCOL, opt.showP ? `N_B = ${fmt(g.NB)} ${F}` : 'N_B', true, 4);
    const tf = raise ? [-ca, -sa] : [ca, sa]; // friction on the wedge at B, along the face, opposing its slide (screen coordinates)
    force(g0, B[0], B[1], tf[0], tf[1], 40, FCOL, opt.showP ? `${fmt(g.mu * g.NB)} ${F}` : 'μN_B', true, 8);
    const Cp = P(Lw * 0.22, 0);
    force(g0, Cp[0], Cp[1], 0, -1, 40, RCOL, opt.showP ? `N_C = ${fmt(g.NC)} ${F}` : 'N_C', false, 16);
    force(g0, Cp[0] + 10, Cp[1] + 6, raise ? -1 : 1, 0, 40, FCOL, opt.showP ? `${fmt(g.muC * g.NC)} ${F}` : 'μN_C', true, 0);
    const Pp = P(0, t * 0.45), pull = g.P >= 0 ? !raise : raise;
    force(g0, Pp[0], Pp[1], pull ? -1 : 1, 0, 50, LCOL, opt.showP ? `P = ${fmt(Math.abs(g.P))} ${F}` : 'P', pull, 4);
    lbl(g0, D.X(Lw), D.Y(0) + 28, `α = ${fmt(g.al)}°`, { anchor: 'middle', color: '#1d2733', size: 11 });
  }

  /* -------- screw -------- */
  function drawScrew(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F, Ls } = g.c, stack = W < 600, pw = stack ? W : W * 0.42, ph = stack ? H * 0.45 : H;
    const g0 = s('g', {}, svg);
    T(g0, 12, 20, 'Screw', { color: '#5a6b75', size: 12, weight: 700 });
    const cx = pw / 2, top = ph * 0.3, bot = ph * 0.86, rw = Math.min(pw * 0.14, 46);
    s('rect', { x: cx - rw, y: top, width: 2 * rw, height: bot - top, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
    const pitch = Math.max(12, (bot - top) / 9), dz = Math.max(4, 2 * rw * Math.tan(g.th * DEG));
    for (let y = top + 6; y < bot - 4; y += pitch) s('line', { x1: cx - rw, y1: y + dz, x2: cx + rw, y2: y, stroke: '#4a5661', 'stroke-width': 1.3 }, g0);
    s('rect', { x: cx - rw * 1.9, y: bot, width: rw * 3.8, height: 10, fill: 'url(#hatchF)' }, g0);
    hatch(svg);
    s('rect', { x: cx - rw * 1.5, y: top - 18, width: rw * 3, height: 18, fill: '#d9b58a', stroke: '#8a6a3f' }, g0);
    arrowPx(g0, cx, top - 70, cx, top - 20, LCOL, 2.6, 11); lbl(g0, cx + 8, top - 56, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    // moment arrow around the axis
    const ey = (top + bot) / 2, ex = rw * 1.9;
    s('path', { d: `M ${cx - ex} ${ey} A ${ex} ${ex * 0.32} 0 0 0 ${cx + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
    arrowPx(g0, cx + ex - 2, ey - 8, cx + ex, ey + 1, FCOL, 2.2, 10);
    lbl(g0, cx + ex + 6, ey + 18, opt.showP ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', { color: FCOL });
    lbl(g0, cx, bot + 28, `r = ${fmt(g.r)} ${Ls},  l = ${fmt(g.l)} ${Ls}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
    // unwrapped thread with the force triangle
    const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? W : W - pw, qh = stack ? H - ph : H, g1 = s('g', {}, svg);
    s('line', { x1: ox + (stack ? 10 : 0), y1: oy + (stack ? 0 : 10), x2: stack ? W - 10 : ox, y2: stack ? oy : H - 10, stroke: '#e1e7ea' }, g1);
    T(g1, ox + 12, oy + 20, 'One turn of the thread, unwrapped', { color: '#5a6b75', size: 12, weight: 700 });
    const base = qw * 0.62, thv = Math.max(g.th, 3) * DEG, rise = base * Math.tan(thv), x0 = ox + qw * 0.16, y0 = oy + qh * 0.78;
    poly(g1, [[x0, y0], [x0 + base, y0], [x0 + base, y0 - rise]], { fill: '#eef2f4', stroke: '#4a5661', 'stroke-width': 1.5 });
    lbl(g1, x0 + base / 2, y0 + 18, '2πr', { anchor: 'middle', color: '#5a6b75', size: 11 }); lbl(g1, x0 + base + 6, y0 - rise / 2, 'l', { color: '#5a6b75', size: 11 });
    arcPx(g1, x0, y0, 54, 0, thv / DEG, '#5a6b75'); lbl(g1, x0 + 60, y0 - 6, `θ = ${fmt(g.th)}°`, { color: '#5a6b75', size: 11 });
    // block on the slope with W, the push M/r and the resultant R at φs from the normal
    const bx = x0 + base * 0.62, by = y0 - base * 0.62 * Math.tan(thv), up = g.task === 'raise' ? 1 : -1;
    const nA = Math.PI / 2 + thv, rA = nA + (g.task === 'raise' ? 1 : -1) * g.ph * DEG * (g.lock || g.task === 'raise' ? 1 : -1);
    s('rect', { x: bx - 13, y: by - 26, width: 26, height: 20, fill: '#d9b58a', stroke: '#8a6a3f', transform: `rotate(${-thv / DEG} ${bx} ${by})` }, g1);
    arrowPx(g1, bx, by - 70, bx, by - 30, LCOL, 2.4, 10); lbl(g1, bx + 6, by - 62, 'W', { color: LCOL });
    const Lr = Math.min(80, qh * 0.3); arrowPx(g1, bx - Math.cos(rA) * Lr * 0.1, by + Math.sin(rA) * Lr * 0.1 + 6, bx + Math.cos(rA) * Lr, by - Math.sin(rA) * Lr, RCOL, 2.4, 10);
    lbl(g1, bx + Math.cos(rA) * Lr + 6, by - Math.sin(rA) * Lr, 'R', { color: RCOL });
    s('line', { x1: bx, y1: by, x2: bx + Math.cos(nA) * Lr * 0.9, y2: by - Math.sin(nA) * Lr * 0.9, stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g1);
    lbl(g1, bx + Math.cos(nA) * Lr * 0.95 - 4, by - Math.sin(nA) * Lr * 0.95 - 4, `φs = ${fmt(g.ph)}°`, { anchor: 'end', color: CONE, size: 11 });
    const hx = up > 0 ? bx - 80 : bx + 80; arrowPx(g1, hx, by - 12, up > 0 ? bx - 16 : bx + 16, by - 12, FCOL, 2.4, 10); lbl(g1, hx, by - 20, 'M/r', { anchor: 'middle', color: FCOL });
    lbl(g1, ox + 12, oy + qh - 14, g.lock ? `Self-locking: φs ≥ θ` : 'Not self-locking: φs < θ', { color: g.lock ? '#1e7a45' : '#a3281f', size: 12, weight: 800 });
  }



  /* -------- bearings -------- */
  function drawBearing(svg, g, opt) {
    const { F, Lu, FL } = g.c, val = (k, t) => (opt.showP ? `${k} = ${t}` : k);
    if (g.type === 'collar' || g.type === 'disk') {
      const R2 = g.R2, R1 = g.R1, rs = R1 > 0 ? R1 * 0.8 : R2 * 0.3;
      const D = UI.Draw2D(svg, { xmin: -R2 * 1.6, xmax: R2 * 2.8, ymin: -R2 * 1.1, ymax: R2 * 2.4 }, { pad: 50 }); hatch(svg);
      const g0 = D.root, X = D.X, Y = D.Y;
      // side section: shaft on the bearing, support block below
      poly(g0, [[X(-R2 * 1.4), Y(0)], [X(R2 * 1.4), Y(0)], [X(R2 * 1.4), Y(-R2 * 0.7)], [X(-R2 * 1.4), Y(-R2 * 0.7)]], { fill: 'url(#hatchF)', stroke: '#4a5661' });
      if (R1 > 0) poly(g0, [[X(-R1), Y(0)], [X(R1), Y(0)], [X(R1), Y(-R2 * 0.7)], [X(-R1), Y(-R2 * 0.7)]], { fill: '#fff', stroke: '#4a5661' });
      poly(g0, [[X(-R2), Y(0)], [X(R2), Y(0)], [X(R2), Y(R2 * 0.25)], [X(-R2), Y(R2 * 0.25)]], { fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 });
      poly(g0, [[X(-rs), Y(R2 * 0.25)], [X(rs), Y(R2 * 0.25)], [X(rs), Y(R2 * 1.7)], [X(-rs), Y(R2 * 1.7)]], { fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 1.5 });
      arrowPx(g0, X(0), Y(R2 * 2.35), X(0), Y(R2 * 1.72), LCOL, 2.6, 11); lbl(g0, X(0) + 8, Y(R2 * 2.2), val('P', `${fmt(g.P)} ${F}`), { color: LCOL });
      const ey = Y(R2 * 1.2), ex = rs * D.sc + 26;
      s('path', { d: `M ${X(0) - ex} ${ey} A ${ex} ${ex * 0.3} 0 0 0 ${X(0) + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
      arrowPx(g0, X(0) + ex - 2, ey - 8, X(0) + ex, ey + 1, FCOL, 2.2, 10); lbl(g0, X(0) + ex + 6, ey + 16, val('M', `${fmt(g.M)} ${FL}`), { color: FCOL });
      // pressure on the contact surface
      for (let k = -6; k <= 6; k++) { const x = (k / 6) * R2; if (Math.abs(x) < R1 * 0.999) continue; arrowPx(g0, X(x), Y(-R2 * 0.3), X(x), Y(-0.02 * R2), RCOL, 1.4, 6); }
      lbl(g0, X(0), Y(-R2 * 0.95), 'uniform pressure p on the contact surface', { anchor: 'middle', color: RCOL, size: 11 });
      // plan view of the contact ring
      const cx = X(R2 * 2.1), cy = Y(R2 * 0.6), r2 = R2 * D.sc * 0.62, r1 = R1 * D.sc * 0.62;
      s('circle', { cx, cy, r: r2, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.4 }, g0); if (R1 > 0) s('circle', { cx, cy, r: r1, fill: '#fff', stroke: '#4a5661', 'stroke-width': 1.4 }, g0);
      arrowPx(g0, cx, cy, cx + r2, cy, '#1d2733', 1.3, 7); lbl(g0, cx + r2 / 2, cy - 5, R1 > 0 ? 'R₂' : 'R', { anchor: 'middle', color: '#1d2733', size: 11 });
      if (R1 > 0) { arrowPx(g0, cx, cy, cx - r1 * 0.7, cy + r1 * 0.7, '#1d2733', 1.3, 7); lbl(g0, cx - r1 * 0.5, cy + r1 * 0.5 + 14, 'R₁', { anchor: 'middle', color: '#1d2733', size: 11 }); }
      lbl(g0, cx, cy + r2 + 18, `contact area, μ = ${fmt(g.mu)}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
      return;
    }
    if (g.type === 'journal') {
      const r = 1, rf = Math.sin(g.ph * DEG), D = UI.Draw2D(svg, { xmin: -2.4, xmax: 2.4, ymin: -2.2, ymax: 2.2 }, { pad: 50 }), g0 = D.root, X = D.X, Y = D.Y, sc = D.sc;
      s('circle', { cx: X(0), cy: Y(0), r: 1.45 * sc, fill: '#e3e9ed', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
      const t = -g.ph * DEG, ox = Math.sin(t) * 0.12, oy = 0; // shaft rides up the side of the hole
      s('circle', { cx: X(ox), cy: Y(oy + 0.12), r: r * sc, fill: '#c9d3da', stroke: '#4a5661', 'stroke-width': 1.5 }, g0);
      s('circle', { cx: X(ox), cy: Y(oy + 0.12), r: Math.max(rf * sc, 3), fill: 'none', stroke: CONE, 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, g0);
      lbl(g0, X(ox) + rf * sc + 6, Y(oy + 0.12) - 4, `r_f = ${fmt(Math.sin(g.ph * DEG) * g.r)} ${Lu}`, { color: CONE, size: 11 });
      arrowPx(g0, X(ox - rf), Y(1.9), X(ox - rf), Y(0.12 + 0.05), LCOL, 2.4, 10); lbl(g0, X(ox - rf) - 6, Y(1.8), val('R (load)', `${fmt(g.R)} ${F}`), { anchor: 'end', color: LCOL });
      arrowPx(g0, X(ox - rf), Y(-2.0), X(ox - rf), Y(-0.9), RCOL, 2.4, 10); lbl(g0, X(ox - rf) + 6, Y(-1.9), 'R (bearing)', { color: RCOL });
      const ey = Y(0.12), ex = 0.6 * sc; s('path', { d: `M ${X(ox) - ex} ${ey} A ${ex} ${ex} 0 0 1 ${X(ox) + ex} ${ey}`, fill: 'none', stroke: FCOL, 'stroke-width': 2.2 }, g0);
      arrowPx(g0, X(ox) + ex - 1, ey - 8, X(ox) + ex, ey + 2, FCOL, 2.2, 10); lbl(g0, X(ox) - ex - 6, ey - ex * 0.6, val('M', `${fmt(g.M)} ${FL}`), { anchor: 'end', color: FCOL });
      lbl(g0, 14, 22, `φk = ${fmt(g.ph)}°: the shaft climbs the bearing until R is tangent to the friction circle`, { color: '#5a6b75', size: 11.5, weight: 700 });
      return;
    }
    const D = UI.Draw2D(svg, { xmin: -2.2, xmax: 2.6, ymin: -0.6, ymax: 2.6 }, { pad: 50 }); hatch(svg);
    const g0 = D.root, X = D.X, Y = D.Y, sc = D.sc, A = Math.max(0.12, Math.min(0.45, g.a / g.r));
    poly(g0, [[X(-2.2), Y(0)], [X(2.6), Y(0)], [X(2.6), Y(-0.25)], [X(-2.2), Y(-0.25)]], { fill: 'url(#hatchF)' });
    s('line', { x1: X(-2.2), y1: Y(0), x2: X(2.6), y2: Y(0), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('circle', { cx: X(0), cy: Y(1), r: sc, fill: '#3b444b', stroke: '#1d2733' }, g0); s('circle', { cx: X(0), cy: Y(1), r: sc * 0.4, fill: '#c9d3da' }, g0);
    arrowPx(g0, X(0), Y(2.5), X(0), Y(1.05), LCOL, 2.4, 10); lbl(g0, X(0) + 7, Y(2.35), val('W', `${fmt(g.W)} ${F}`), { color: LCOL });
    arrowPx(g0, X(-1.9), Y(1), X(-0.05), Y(1), LCOL, 2.4, 10); lbl(g0, X(-1.9), Y(1) - 8, val('P', `${fmt(g.P)} ${F}`), { color: LCOL });
    arrowPx(g0, X(A * 1.55), Y(-0.55), X(A), Y(0.02), RCOL, 2.4, 10); lbl(g0, X(A) + 6, Y(-0.4), 'R', { color: RCOL });
    s('line', { x1: X(0), y1: Y(-0.05), x2: X(A), y2: Y(-0.05), stroke: '#1d2733', 'stroke-width': 1.2 }, g0); lbl(g0, X(A / 2), Y(-0.05) + 14, `a = ${fmt(g.a)} ${Lu}`, { anchor: 'middle', color: '#1d2733', size: 11 });
    lbl(g0, X(0.95), Y(1.25), `r = ${fmt(g.r)} ${Lu}`, { color: '#5a6b75', size: 11 });
    lbl(g0, 14, 22, 'The ground reaction R acts a distance a ahead of the lowest point (a is drawn enlarged).', { color: '#5a6b75', size: 11.5, weight: 700 });
  }

  /* -------- vehicle -------- */
  /** Body outline in road axes (x from axle A to B, y up from the road); the hood is at the front end. */
  function carShape(g) {
    const L = g.L, rw = Math.min(L * 0.1, Math.max(g.h * 0.5, L * 0.07)), sh = Math.max(g.h * 1.25, rw * 2.3), top = sh + L * 0.2;
    const pts = [[-0.24 * L, rw * 0.75], [1.24 * L, rw * 0.75], [1.24 * L, sh * 0.95], [0.95 * L, sh], [0.72 * L, top], [0.18 * L, top], [-0.02 * L, sh * 1.02], [-0.24 * L, sh]];
    const fl = g.front === 'A';
    return { rw, sh, top, pts: fl ? pts.map(([x, y]) => [L - x, y]) : pts };
  }
  function drawVehicle(svg, g, opt) {
    const { F, Lu } = g.c, L = g.L, ang = (g.rise === 'B' ? 1 : -1) * g.phi * DEG, ca = Math.cos(ang), sa = Math.sin(ang), R = (u, v) => [u * ca - v * sa, u * sa + v * ca];
    const cs = carShape(g), ext = 0.55 * L, bb = [R(-ext, 0), R(L + ext, 0), R(-ext, cs.top), R(L + ext, cs.top), R(-0.3 * L, -0.3 * L), R(1.3 * L, -0.3 * L)];
    const D = UI.Draw2D(svg, { xmin: Math.min(...bb.map((p) => p[0])), xmax: Math.max(...bb.map((p) => p[0])), ymin: Math.min(...bb.map((p) => p[1])), ymax: Math.max(...bb.map((p) => p[1])) + L * 0.3 }, { pad: 56 }); hatch(svg);
    const g0 = D.root, P = (u, v) => { const w = R(u, v); return [D.X(w[0]), D.Y(w[1])]; }, sc = D.sc;
    const into = [sa, ca]; // screen direction into the road
    const r0 = P(-ext, 0), r1 = P(L + ext, 0);
    poly(g0, [r0, r1, [r1[0] + into[0] * 12, r1[1] + into[1] * 12], [r0[0] + into[0] * 12, r0[1] + into[1] * 12]], { fill: 'url(#hatchF)' });
    s('line', { x1: r0[0], y1: r0[1], x2: r1[0], y2: r1[1], stroke: '#4a5661', 'stroke-width': 2 }, g0);
    if (g.phi > 0) { const lo = ang > 0 ? r0 : r1, dir = ang > 0 ? 1 : -1; s('line', { x1: lo[0], y1: lo[1], x2: lo[0] + dir * 80, y2: lo[1], stroke: '#9aa5ad', 'stroke-dasharray': '4 3' }, g0); if (dir > 0) arcPx(g0, lo[0], lo[1], 56, 0, g.phi, '#1d2733'); else arcPx(g0, lo[0], lo[1], 56, 180 - g.phi, 180, '#1d2733'); lbl(g0, lo[0] + dir * 64, lo[1] - 6, `φ = ${fmt(g.phi)}°`, { anchor: dir > 0 ? 'start' : 'end', color: '#1d2733', size: 11.5 }); }
    poly(g0, cs.pts.map(([u, v]) => P(u, v)), { fill: '#7fb3d5', 'fill-opacity': 0.55, stroke: '#2e5f80', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
    [['A', 0], ['B', L]].forEach(([k, x]) => {
      const c = P(x, cs.rw); s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc, fill: '#3b444b', stroke: '#1d2733', 'stroke-width': 1.4 }, g0); s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc * 0.45, fill: '#c9d3da' }, g0);
      if (g['ax' + k] === 'locked') { const d = cs.rw * sc * 0.32; s('path', { d: `M ${c[0] - d} ${c[1] - d} L ${c[0] + d} ${c[1] + d} M ${c[0] + d} ${c[1] - d} L ${c[0] - d} ${c[1] + d}`, stroke: '#a3281f', 'stroke-width': 2.4 }, g0); }
      if (g['ax' + k] === 'driven') s('circle', { cx: c[0], cy: c[1], r: cs.rw * sc * 0.2, fill: '#1e7a45' }, g0);
      const t = P(x, 0); lbl(g0, t[0] + 6 * (k === 'A' ? -1 : 1), t[1] + 20, k, { anchor: k === 'A' ? 'end' : 'start', color: '#1d2733', size: 13, weight: 800 });
    });
    const G = P(g.a, g.h); s('circle', { cx: G[0], cy: G[1], r: 4.5, fill: '#1d2733' }, g0); lbl(g0, G[0] + 7, G[1] - 7, 'G', { color: '#1d2733' });
    force(g0, G[0], G[1], 0, 1, 52, LCOL, null, true, 6); lbl(g0, G[0] + 7, G[1] + 50, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { color: LCOL });
    const nrm = [-sa, -ca], tg = [ca, -sa]; // screen: out of the road, along +x
    [['A', 0, g.NA, g.FA], ['B', L, g.NB, g.FB]].forEach(([k, x, N, Ff]) => {
      const o = P(x, 0);
      force(g0, o[0], o[1], nrm[0] * Math.sign(N || 1), nrm[1] * Math.sign(N || 1), 44, RCOL, opt.showP ? `N_${k} = ${fmt(N)} ${F}` : `N_${k}`, false, 3);
      if (Math.abs(Ff) > 1e-9 * g.W) { const sg = Math.sign(Ff), q = P(x, -0.02 * L); force(g0, q[0], q[1], tg[0] * sg, tg[1] * sg, 44, FCOL, opt.showP ? `F_${k} = ${fmt(Math.abs(Ff))} ${F}` : `F_${k}`, true, 4); }
    });
    if (g.useP && g.P > 0) { const at = P(g.xP, g.yP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); s('circle', { cx: at[0], cy: at[1], r: 3, fill: LCOL }, g0); force(g0, at[0], at[1], d[0], -d[1], 56, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', true, 2); }
    // dimensions a, b along the road below it, and h
    const dy = cs.top + 0.14 * L, a0 = P(0, dy), a1 = P(g.a, dy), b1 = P(L, dy);
    [[0, a0], [g.a, a1], [L, b1]].forEach(([x, e]) => { const f = P(x, x === g.a ? g.h : cs.rw * 2); s('line', { x1: f[0], y1: f[1], x2: e[0], y2: e[1], stroke: '#c3ccd2', 'stroke-dasharray': '2 3' }, g0); });
    [[a0, a1, `${fmt(g.a)} ${Lu}`], [a1, b1, `${fmt(g.b)} ${Lu}`]].forEach(([p, q, t]) => { s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: '#5a6b75', 'stroke-width': 1.2 }, g0); [p, q].forEach((e) => s('circle', { cx: e[0], cy: e[1], r: 2.2, fill: '#5a6b75' }, g0)); lbl(g0, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 6, t, { anchor: 'middle', color: '#5a6b75', size: 11 }); });
    const hb = P(g.a, 0); s('line', { x1: hb[0], y1: hb[1], x2: G[0], y2: G[1], stroke: '#9aa5ad', 'stroke-dasharray': '3 3' }, g0); if (g.h > 0) lbl(g0, (hb[0] + G[0]) / 2 - 8, (hb[1] + G[1]) / 2 + 4, `h = ${fmt(g.h)} ${Lu}`, { anchor: 'end', color: '#5a6b75', size: 11 });
    const vt = g.task === 'slope' ? `${g.verdict === 'tip' ? 'Tips' : 'Slips'} first at φ = ${fmt(g.phi)}°` : g.task === 'force' ? (g.verdict === 'tip' ? 'An axle lifts off before the wheels slip' : `Starts to move toward ${g.move} at P = ${fmt(g.P)} ${F}`) : { none: 'Parked: no slipping or tipping', slip: 'The wheels slip', tip: 'The vehicle tips', roll: 'It rolls: no axle is braked' }[g.verdict];
    lbl(g0, 14, 22, vt, { color: g.verdict === 'none' || (g.task !== 'park' && g.verdict !== 'tip') ? '#1e7a45' : '#a3281f', size: 13, weight: 800 });
  }

  /* -------- round body on a floor and against a wall -------- */
  function drawRound(svg, g, opt) {
    const { F } = g.c, R = g.R, sw = g.s, pad = R * 0.9;
    const D = UI.Draw2D(svg, { xmin: -R - pad, xmax: R + pad, ymin: -R - R * 0.5, ymax: R + pad * 0.8 }, { pad: 46 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)], o = P(0, 0), rpx = D.X(R) - D.X(0), yF = D.Y(-R), xW = D.X(sw * R);
    // floor and wall with hatching on the solid side
    poly(g0, [[D.X(-R - pad), yF], [D.X(R + pad), yF], [D.X(R + pad), yF + 12], [D.X(-R - pad), yF + 12]], { fill: 'url(#hatchF)' });
    poly(g0, [[xW, yF], [xW, D.Y(R + pad * 0.6)], [xW + sw * 14, D.Y(R + pad * 0.6)], [xW + sw * 14, yF]], { fill: 'url(#hatchF)' });
    s('line', { x1: D.X(-R - pad), y1: yF, x2: D.X(R + pad), y2: yF, stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('line', { x1: xW, y1: yF, x2: xW, y2: D.Y(R + pad * 0.6), stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('circle', { cx: o[0], cy: o[1], r: rpx, fill: '#e6d3b3', stroke: '#8a6a3f', 'stroke-width': 2 }, g0);
    const rp = Math.hypot(g.xP, g.yP);
    if (rp > 1e-9 && rp < R * 0.995) s('circle', { cx: o[0], cy: o[1], r: rp * rpx / R, fill: '#d2b48a', stroke: '#8a6a3f', 'stroke-width': 1.4, 'stroke-dasharray': '5 3' }, g0);
    s('circle', { cx: o[0], cy: o[1], r: 4, fill: '#1d2733' }, g0);
    lbl(g0, o[0] + 8, o[1] - 7, 'O', { color: '#1d2733', size: 12.5, weight: 800 });
    // sense of turning, drawn in the upper part away from W, P at the hub and the contacts
    const ra = rpx * 0.66, a0 = g.om > 0 ? 100 : 165, a1 = g.om > 0 ? 165 : 100;
    arcPx(g0, o[0], o[1], ra, a0, a1, '#5a6b75', 1.8);
    { const ae = a1 * DEG, hx = o[0] + ra * Math.cos(ae), hy = o[1] - ra * Math.sin(ae), tx = -Math.sin(ae) * g.om, ty = -Math.cos(ae) * g.om; arrowPx(g0, hx - tx * 9, hy - ty * 9, hx, hy, '#5a6b75', 1.8, 9); }
    // contacts
    const B = [o[0], yF], A = [xW, o[1]], v = (x) => opt.showP && Number.isFinite(x);
    lbl(g0, B[0] - 10, B[1] + 26, 'B', { anchor: 'end', color: '#1d2733', size: 12.5, weight: 800 });
    lbl(g0, A[0] + sw * 20, A[1] + 22, 'A', { anchor: 'middle', color: '#1d2733', size: 12.5, weight: 800 });
    force(g0, B[0], B[1], 0, -1, 46, RCOL, v(g.NF) ? `N_B = ${fmt(g.NF)} ${F}` : 'N_B', false, 0);
    force(g0, A[0], A[1], -sw, 0, 46, RCOL, v(g.NW) ? `N_A = ${fmt(g.NW)} ${F}` : 'N_A', false, 0);
    // friction: along the floor just above it, and along the wall just inside the body, labelled away from the surface
    if (Math.abs(g.FF) > 1e-9 * g.W || (!Number.isFinite(g.FF) && g.muF > 0)) {
      const d = Number.isFinite(g.FF) ? Math.sign(g.FF) : -g.om, y0 = B[1] - 9;
      arrowPx(g0, B[0] + d * 6, y0, B[0] + d * 54, y0, FCOL, 2.4, 10);
      lbl(g0, B[0] + d * 58, y0 - 6, v(g.FF) ? `F_B = ${fmt(Math.abs(g.FF))} ${F}` : 'F_B', { anchor: d > 0 ? 'start' : 'end', color: FCOL });
    }
    if (Math.abs(g.FW) > 1e-9 * g.W || (!Number.isFinite(g.FW) && g.muW > 0)) {
      const d = Number.isFinite(g.FW) ? Math.sign(g.FW) : -g.om * sw, x0 = A[0] - sw * 9;
      arrowPx(g0, x0, A[1] - d * 6, x0, A[1] - d * 54, FCOL, 2.4, 10);
      lbl(g0, x0 - sw * 6, d > 0 ? A[1] + 18 : A[1] - 10, v(g.FW) ? `F_A = ${fmt(Math.abs(g.FW))} ${F}` : 'F_A', { anchor: sw > 0 ? 'end' : 'start', color: FCOL });
    }
    // weight at the centre
    arrowPx(g0, o[0], o[1] + 5, o[0], o[1] + 42, LCOL, 2.4, 10);
    lbl(g0, o[0] - 7, o[1] + 34, opt.showP ? `W = ${fmt(g.W)} ${F}` : 'W', { anchor: 'end', color: LCOL });
    const pp = P(g.xP, g.yP), ux = Math.cos(g.psi * DEG), uy = -Math.sin(g.psi * DEG);
    s('circle', { cx: pp[0], cy: pp[1], r: 4, fill: LCOL }, g0);
    // P pulls away from its point (a wire) unless that would cross the body's centre region; then it pushes on it
    force(g0, pp[0], pp[1], ux, uy, 56, LCOL, opt.showP && g.P > 0 ? `P = ${fmt(g.P)} ${F}` : 'P', true, 0);
    const vt = g.verdict === 'turns' ? `Turns ${g.om > 0 ? 'counterclockwise' : 'clockwise'} in place` : g.verdict === 'rest' ? 'Stays at rest' : `Turns ${g.om > 0 ? 'counterclockwise' : 'clockwise'} when P is reached`;
    lbl(g0, 14, 22, vt, { color: g.verdict === 'turns' ? '#a3281f' : '#1e7a45', size: 13, weight: 800 });
  }

  /* -------- block brake or pawl -------- */
  function drawBrake(svg, g, opt) {
    // friction on the shoe points along +x (wheel about to turn clockwise) or −x when reversed. Its moment about O
    // opposes P (e > 0) when the pivot sits above the contact line, so O is drawn e above it (e as entered).
    const { F } = g.c, r = g.r, sg = g.rev ? -1 : 1, xO = -g.b, yO = r + g.e * sg, xP = xO + (g.a || r);
    const yBar = r * 1.12, xs = [-r * 1.2, r * 1.2, xO, xP], ys = [-r * 1.15, yBar, yO];
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs) - r * 0.35, xmax: Math.max(...xs) + r * 0.35, ymin: Math.min(...ys) - r * 0.1, ymax: Math.max(...ys) + r * 0.75 }, { pad: 48 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)], o = P(0, 0), rpx = D.X(r) - D.X(0);
    s('circle', { cx: o[0], cy: o[1], r: rpx, fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('circle', { cx: o[0], cy: o[1], r: 4, fill: '#4a5661' }, g0);
    // torque M on the wheel: it would turn the wheel so that its top drags the shoe along F
    const ra = rpx * 0.5, aS = sg > 0 ? 140 : 40, aE = sg > 0 ? 40 : 140;
    arcPx(g0, o[0], o[1], ra, aS, aE, '#1d2733', 2);
    { const ae = aE * DEG, hx = o[0] + ra * Math.cos(ae), hy = o[1] - ra * Math.sin(ae), tx = Math.sin(ae) * sg, ty = Math.cos(ae) * sg; arrowPx(g0, hx - tx * 10, hy - ty * 10, hx, hy, '#1d2733', 2, 10); }
    lbl(g0, o[0], o[1] - ra - 6, opt.showP && Number.isFinite(g.M) ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', { anchor: 'middle', color: '#1d2733', size: 11.5 });
    // shoe, lever bar and pivot
    const c = P(0, r), sh = Math.max(8, (D.Y(r) - D.Y(yBar)));
    s('rect', { x: c[0] - 22, y: c[1] - sh, width: 44, height: sh, fill: '#a07a4a', stroke: '#6b5530', 'stroke-width': 1.4 }, g0);
    const b0 = P(Math.min(xO, 0, xP) - r * 0.08, yBar), b1 = P(Math.max(xO, 0, xP) + r * 0.08, yBar);
    s('rect', { x: b0[0], y: b0[1] - 10, width: b1[0] - b0[0], height: 10, rx: 4, fill: '#c9b48f', stroke: '#6b5530', 'stroke-width': 1.4 }, g0);
    const pO = P(xO, yO), pB = P(xO, yBar);
    if (Math.abs(yO - yBar) > 1e-9) s('line', { x1: pO[0], y1: pO[1], x2: pB[0], y2: pB[1] - 5, stroke: '#6b5530', 'stroke-width': 6, 'stroke-linecap': 'round' }, g0);
    const ts = yO < yBar - 1e-9 ? 1 : -1; // the support triangle points away from the lever bar
    poly(g0, [[pO[0], pO[1]], [pO[0] - 11, pO[1] + ts * 18], [pO[0] + 11, pO[1] + ts * 18]], { fill: '#dfe4e8', stroke: '#4a5661', 'stroke-width': 1.4 });
    s('line', { x1: pO[0] - 16, y1: pO[1] + ts * 18, x2: pO[0] + 16, y2: pO[1] + ts * 18, stroke: '#4a5661', 'stroke-width': 2 }, g0);
    s('circle', { cx: pO[0], cy: pO[1], r: 4.5, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.6 }, g0);
    lbl(g0, pO[0] - 14, pO[1] + 4, 'O', { anchor: 'end', color: '#1d2733', size: 12.5, weight: 800 });
    // forces on the lever: N up through the shoe, F along the contact, P down at its arm
    const vN = opt.showP && g.task !== 'lock' && Number.isFinite(g.N);
    force(g0, c[0] + 30, c[1] + 2, 0, -1, 42, RCOL, vN ? `N = ${fmt(g.N)} ${F}` : 'N', true, 0);
    force(g0, c[0], c[1] + 6, sg, 0, 46, FCOL, vN ? `F = ${fmt(g.Ff)} ${F}` : 'F = μs N', true, 26);
    if (g.a > 0 && g.task !== 'lock') { const pp = P(xP, yBar); force(g0, pp[0], pp[1] - 10, 0, 1, 50, LCOL, opt.showP && g.P > 0 ? `P = ${fmt(g.P)} ${F}` : 'P', false, 0); }
    lbl(g0, 14, 22, g.lock ? 'Self-locking for this sense of turning' : `a = ${fmt(g.a)}, b = ${fmt(g.b)}, e = ${fmt(g.e)} ${g.c.Lu}`, { color: g.lock ? '#1e7a45' : '#5a6b75', size: 12, weight: 700 });
  }

  /* -------- double-block brake -------- */
  /** Layout in lengths, origin at the wheel centre O, y up: pins A and B, shoes H and I, D, K, C, E, J and the handle. */
  function brake2Layout(g) {
    const r = g.r, sh = Math.max(g.t, 0.18 * r), xL = -(r + sh), xR = r + sh, yA = -g.hH, yB = -g.hI, yD = g.hD - g.hH;
    const yHnd = Math.min(yA, yB) + 0.12 * Math.min(g.hH, g.hI), xE = xL - g.dDE, xPiv = xE + g.aJ;
    return { r, sh, xL, xR, yA, yB, yD, yK: g.hK - g.hI, yC: yD + g.dDC, xE, yHnd, xPiv, xPend: xPiv - g.aP, floor: Math.min(yA, yB, yHnd) - 0.04 * r };
  }
  function drawBrake2(svg, g, opt) {
    const { F } = g.c, L = brake2Layout(g), r = g.r, fb = S().fbd2 !== false, sg = g.rev ? -1 : 1;
    const xs = [L.xPend, L.xE, L.xL, L.xR + 0.25 * r], ys = [L.floor - 0.1 * r, L.yK, L.yC, r];
    const D = UI.Draw2D(svg, { xmin: Math.min(...xs) - 0.25 * r, xmax: Math.max(...xs) + 1.1 * r, ymin: Math.min(...ys) - 0.15 * r, ymax: Math.max(...ys) + 0.35 * r }, { pad: 40 }); hatch(svg);
    const g0 = D.root, P = (x, y) => [D.X(x), D.Y(y)], o = P(0, 0), rpx = D.X(r) - D.X(0), ink = '#1d2733', wood = '#c9b48f', edge = '#6b5530';
    const bar = (a, b, w, col) => s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: col || edge, 'stroke-width': w || 7, 'stroke-linecap': 'round' }, g0);
    const pin = (p, tri) => { if (tri) { poly(g0, [[p[0], p[1]], [p[0] - 10, p[1] + 16], [p[0] + 10, p[1] + 16]], { fill: '#dfe4e8', stroke: '#4a5661', 'stroke-width': 1.4 }); s('line', { x1: p[0] - 15, y1: p[1] + 16, x2: p[0] + 15, y2: p[1] + 16, stroke: '#4a5661', 'stroke-width': 2 }, g0); } s('circle', { cx: p[0], cy: p[1], r: 4, fill: '#fff', stroke: ink, 'stroke-width': 1.5 }, g0); };
    const name = (p, txt, dx, dy, anchor) => lbl(g0, p[0] + dx, p[1] + dy, txt, { anchor: anchor || 'start', color: ink, size: 12, weight: 800 });
    // floor, wheel and torque M
    const f0 = P(Math.min(...xs) - 0.2 * r, L.floor), f1 = P(Math.max(...xs) + 0.4 * r, L.floor);
    s('rect', { x: f0[0], y: f0[1] + 16, width: f1[0] - f0[0], height: 8, fill: 'url(#hatchF)' }, g0);
    s('circle', { cx: o[0], cy: o[1], r: rpx, fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 2 }, g0); s('circle', { cx: o[0], cy: o[1], r: 4, fill: '#4a5661' }, g0);
    const ra = rpx * 0.55, aS = sg > 0 ? -60 : 240, aE = sg > 0 ? 200 : -20;
    arcPx(g0, o[0], o[1], ra, aS, aE, ink, 2);
    { const ae = aE * DEG, hx = o[0] + ra * Math.cos(ae), hy = o[1] - ra * Math.sin(ae), tx = -Math.sin(ae) * sg, ty = -Math.cos(ae) * sg; arrowPx(g0, hx - tx * 10, hy - ty * 10, hx, hy, ink, 2, 10); }
    lbl(g0, o[0], o[1] - ra - 7, opt.showP && Number.isFinite(g.M) ? `M = ${fmt(g.M)} ${g.c.FL}` : 'M', { anchor: 'middle', color: ink, size: 11.5 });
    name(o, 'O', 7, 15);
    // shoes H and I
    const shH = 0.32 * r, H0 = P(L.xL, shH), H1 = P(-r, -shH), I0 = P(r, shH), I1 = P(L.xR, -shH);
    s('rect', { x: H0[0], y: H0[1], width: H1[0] - H0[0], height: H1[1] - H0[1], fill: '#a07a4a', stroke: edge, 'stroke-width': 1.4 }, g0);
    s('rect', { x: I0[0], y: I0[1], width: I1[0] - I0[0], height: I1[1] - I0[1], fill: '#a07a4a', stroke: edge, 'stroke-width': 1.4 }, g0);
    // levers, bell-crank, links and handle
    const pA = P(L.xL, L.yA), pD = P(L.xL, L.yD), pB = P(L.xR, L.yB), pK = P(L.xR, L.yK), pC = P(L.xL, L.yC), pE = P(L.xE, L.yD), pJ = P(L.xE, L.yHnd), pV = P(L.xPiv, L.yHnd), pL = P(L.xPend, L.yHnd);
    bar(pA, pD, 8, edge); bar(pA, pD, 4, wood); bar(pB, pK, 8, edge); bar(pB, pK, 4, wood);
    bar(pK, pC, 3, ink); bar(pE, pJ, 3, ink);
    bar(pD, pC, 6, '#7f8c8d'); bar(pD, pE, 6, '#7f8c8d');
    bar(pL, pV, 7, '#5d6d7e');
    [pA, pB].forEach((p) => pin(p, true)); pin(P(L.xPiv, L.yHnd), true); [pD, pK, pC, pE, pJ].forEach((p) => pin(p));
    name(pA, 'A', 12, 12); name(pB, 'B', 12, 12); name(pD, 'D', 8, 14); name(pK, 'K', 8, -6); name(pC, 'C', -8, -6, 'end'); name(pE, 'E', -8, -6, 'end'); name(pJ, 'J', -8, 14, 'end');
    name(P(-r, 0), 'H', -6, -shH * D.sc - 4, 'end'); name(P(r, 0), 'I', 6, -shH * D.sc - 4); name(pL, 'L', -4, 16, 'end');
    // P on the end of the handle
    force(g0, pL[0], pL[1] - 4, 0, 1, 46, LCOL, opt.showP ? `P = ${fmt(g.P)} ${F}` : 'P', false, 0);
    if (fb && !g.lock) {
      const v = (k, x) => (opt.showP && LW >= 560 ? `${k} = ${fmt(x)} ${F}` : k); // names only on a narrow screen
      const clear = (D.X(L.xR) - D.X(r)) + 30; // the normal-force arrows start beyond the shoe and the lever
      force(g0, o[0] - rpx, o[1] - 10, 1, 0, clear, RCOL, v('N_H', g.NH), false, 0);
      force(g0, o[0] + rpx, o[1] - 10, -1, 0, clear, RCOL, v('N_I', g.NI), false, 0);
      // friction on the wheel opposes M: up at H and down at I for a counterclockwise M; labels inside the rim
      [[-1, -sg, 'F_H', g.NH], [1, sg, 'F_I', g.NI]].forEach(([side, dy, k, N]) => {
        const x = o[0] + side * (rpx - 5), y0 = o[1] + 6, y1 = y0 + dy * 38;
        arrowPx(g0, x, y0, x, y1, FCOL, 2.4, 10);
        lbl(g0, x - side * 6, Math.max(y0, y1) + 14, v(k, g.mu * N), { anchor: side < 0 ? 'start' : 'end', color: FCOL });
      });
      lbl(g0, (pK[0] + pC[0]) / 2, pK[1] - 7, v('F_KC', g.FKC), { anchor: 'middle', color: LCOL, size: 11 });
      lbl(g0, pE[0] - 6, (pE[1] + pJ[1]) / 2, v('F_EJ', g.FEJ), { anchor: 'end', color: LCOL, size: 11 });
    }
    lbl(g0, 14, 22, g.lock ? 'Self-locking for this sense of turning' : `μs = ${fmt(g.mu)}, M ${sg > 0 ? 'counterclockwise' : 'clockwise'}${g.t > 0 ? `, shoe faces ${fmt(g.t)} ${g.c.Lu} from the levers` : ''}`, { color: g.lock ? '#1e7a45' : '#5a6b75', size: 12, weight: 700 });
  }

  /* -------- belt -------- */
  function drawBelt(svg, g, opt) {
    const { W, H } = Charts.clear(svg), { F } = g.c, n = g.drums.length, gg = s('g', {}, svg), wh = g.wheel;
    const cell = wh ? (wh.lever ? W * 0.52 : W) : W / n, R = Math.min(cell * 0.22, H * 0.18), cy = H * 0.5;
    g.drums.forEach((d, i) => {
      const cx = cell * (i + 0.5), vis = Math.min(d.deg, 359.5), a0 = 90 + vis / 2, a1 = 90 - vis / 2;
      s('circle', { cx, cy, r: R, fill: '#dfe5ea', stroke: '#4a5661', 'stroke-width': 1.6 }, gg);
      s('circle', { cx, cy, r: 5, fill: '#4a5661' }, gg);
      arcPx(gg, cx, cy, R + 3, a1, a0, '#2c3e50', 4);
      if (d.deg >= 360) lbl(gg, cx, cy + 22, `${fmt(d.deg / 360, 3)} turns`, { anchor: 'middle', color: '#2c3e50', size: 11 });
      // the belt leaves tangentially at both ends of the contact
      const ends = [[a0, 1], [a1, -1]];
      ends.forEach(([a, sg], k) => {
        const ar = a * DEG, px = cx + (R + 3) * Math.cos(ar), py = cy - (R + 3) * Math.sin(ar), tx = -Math.sin(ar) * sg, ty = -Math.cos(ar) * sg, L = Math.min(cell * 0.3, 70);
        s('line', { x1: px, y1: py, x2: px + tx * L, y2: py + ty * L, stroke: '#2c3e50', 'stroke-width': 4 }, gg);
        const Tv = g.hi ? (k === 0 ? g.Ts[i] : g.Ts[i + 1]) : (k === 0 ? g.Ts[i + 1] : g.Ts[i]), big = g.hi ? k === 0 : k === 0;
        arrowPx(gg, px + tx * L * 0.4, py + ty * L * 0.4, px + tx * (L + 16), py + ty * (L + 16), big ? LCOL : RCOL, 2.4, 10);
        // ends that leave sideways are labelled beside their tip, so two ends crossing below the drum keep their labels apart
        const anc = tx > 0.25 ? 'start' : tx < -0.25 ? 'end' : 'middle', lx = px + tx * (L + 18) + (anc === 'start' ? 4 : anc === 'end' ? -4 : 0), ly = py + ty * (L + 18) + (ty > 0 ? 12 : -4);
        if (k === 0 && i > 0) return; // the cord between two drums carries one tension: it is labelled once, at the earlier drum
        lbl(gg, lx, ly, opt.showP ? `${big ? 'T₂' : 'T₁'} = ${fmt(Tv)} ${F}` : (big ? 'T₂' : 'T₁'), { anchor: anc, color: big ? LCOL : RCOL, size: 11.5 });
      });
      lbl(gg, cx, cy - R - 14, `β = ${fmt(d.deg)}°, μs = ${fmt(d.mu)}${d.al > 0 ? `, α = ${fmt(d.al)}°` : ''}`, { anchor: 'middle', color: '#5a6b75', size: 11 });
      lbl(gg, cx, cy - R - 30, wh ? `Wheel, r = ${fmt(wh.r)} ${g.c.Lu}` : `Drum ${i + 1}`, { anchor: 'middle', color: '#1d2733', size: 12, weight: 800 });
      if (wh) {
        // the torque M turns the wheel so that its rim moves from the tight end toward the slack end
        const rm = R * 0.58, aS = 150, aE = 30;
        arcPx(gg, cx, cy, rm, aS, aE + 8, '#1d2733', 2.2);
        const ae = aE * DEG, hx = cx + rm * Math.cos(ae), hy = cy - rm * Math.sin(ae);
        arrowPx(gg, hx - 10 * Math.sin(ae), hy - 10 * Math.cos(ae), hx, hy, '#1d2733', 2.2, 10);
        lbl(gg, cx, cy - rm - 6, opt.showP ? `M = ${fmt(wh.M)} ${g.c.FL}` : 'M', { anchor: 'middle', color: '#1d2733', size: 11.5 });
      }
    });
    if (wh && wh.lever) drawLever(gg, g, opt, W * 0.56, W - 16, H);
    lbl(gg, 12, 20, wh ? 'The band is about to slip toward the tight end T₂ (red); T₂ = T₁ e^(μβ) and (T₂ − T₁) r = M.' : 'Slip is about to happen toward the larger tension (red); e^(μβ) multiplies the tension over each drum.', { color: '#5a6b75', size: 11.5, weight: 600 });
  }
  /** Lever schematic: pivot O, the two band ends at their signed arms and P at arm a (positions to scale along the bar). */
  function drawLever(gg, g, opt, x0, x1, H) {
    const wh = g.wheel, F = g.c.F, xs = [0, wh.a, -wh.dT, -wh.dS], lo = Math.min(...xs), hi = Math.max(...xs), span = hi - lo || 1;
    const pad = 34, sc = (x1 - x0 - 2 * pad) / span, X = (x) => x0 + pad + (x - lo) * sc, y = H * 0.56;
    lbl(gg, (x0 + x1) / 2, H * 0.28, 'Lever (moments about O)', { anchor: 'middle', color: '#1d2733', size: 12, weight: 800 });
    s('rect', { x: X(lo) - 10, y: y - 5, width: X(hi) - X(lo) + 20, height: 10, rx: 4, fill: '#c9b48f', stroke: '#6b5530', 'stroke-width': 1.4 }, gg);
    poly(gg, [[X(0), y + 5], [X(0) - 10, y + 22], [X(0) + 10, y + 22]], { fill: '#dfe4e8', stroke: '#4a5661', 'stroke-width': 1.4 });
    s('circle', { cx: X(0), cy: y, r: 4, fill: '#fff', stroke: '#1d2733', 'stroke-width': 1.6 }, gg);
    lbl(gg, X(0), y + 38, 'O', { anchor: 'middle', color: '#1d2733', size: 12 });
    // P pulls down at a; the band ends pull down too, so an end that resists P sits on the other side of O
    arrowPx(gg, X(wh.a), y - 56, X(wh.a), y - 7, LCOL, 2.6, 11);
    lbl(gg, X(wh.a), y - 62, opt.showP && wh.P != null ? `P = ${fmt(wh.P)} ${F}` : 'P', { anchor: 'middle', color: LCOL, size: 11.5 });
    [[wh.dT, 'T₂', wh.T2, LCOL], [wh.dS, 'T₁', wh.T1, RCOL]].forEach(([d, nm, T, col], k) => {
      if (Math.abs(d) < 1e-12) { lbl(gg, X(0), y + 54 + 14 * k, `${nm} passes through O`, { anchor: 'middle', color: col, size: 10.5 }); return; }
      const xx = X(-d); // a band end pulling down opposes P (downward at +a) when it lies on the other side of O
      arrowPx(gg, xx, y + 7, xx, y + 52, col, 2.4, 10);
      lbl(gg, xx + (d > 0 ? 3 : -3), y + 66 + 14 * k, opt.showP ? `${nm} = ${fmt(T)} ${F}` : nm, { anchor: d > 0 ? 'end' : 'start', color: col, size: 11 });
    });
    lbl(gg, (x0 + x1) / 2, y + 104, `a = ${fmt(wh.a)}, d_T = ${fmt(wh.dT)}, d_S = ${fmt(wh.dS)} ${g.c.Lu}`, { anchor: 'middle', color: '#5a6b75', size: 10.5 });
  }

  /* ------------------------------------------------------------------ */
  /* 3D views                                                           */
  /* ------------------------------------------------------------------ */
  function arrow3(v, a, b, color, lw) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (!(L > 0)) return;
    v.line([a, b], color, lw || 2.4);
    const u = d.map((x) => x / L), hs = Math.min(L * 0.3, v._hs || L * 0.15), n = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], base = b.map((x, i) => x - u[i] * hs);
    [1, -1].forEach((sg) => v.line([b, base.map((x, i) => x + c[i] * sg * hs * 0.4)], color, lw || 2.4));
  }
  M.draw3D = function (v, res, U, opt) {
    const rest = root.View3D.restLayer;
    const g = res.geo, F = g.c.F, val = (k, txt) => (opt.showP ? `${k} = ${txt}` : k);
    const GROUND = '#dfe4e8', GEDGE = '#4a5661', WOOD = '#d9b58a', WEDGE = '#8a6a3f', STEEL = '#c9d3da';
    if (g.kind === 'block') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], e = Math.max(g.b, g.H), z = g.b * 0.6, ext = g.b * 0.9 + e * 0.6;
      v._hs = e * 0.08;
      const a = R(-ext, 0), b = R(ext, 0), yb = Math.min(a[1], b[1]) - e * 0.1;
      v.extrude([a, b, [b[0], yb], [a[0], yb]], -z * 1.4, z * 1.4, GROUND, 1, GEDGE, { layer: rest([-sp, cp, 0]) });
      v.extrude([R(-g.b / 2, 0), R(g.b / 2, 0), R(g.b / 2, g.H), R(-g.b / 2, g.H)], -z / 2, z / 2, WOOD, 1, WEDGE);
      const G = R(0, g.H / 2); arrow3(v, [G[0], G[1], 0], [G[0], G[1] - e * 0.45, 0], LCOL, 2.4); v.label([G[0], G[1] - e * 0.5, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const zf = z / 2 + 0.002, o = R(Math.max(-g.b / 2, Math.min(g.b / 2, g.x)), 0), nrm = R(0, 1), tg = R(1, 0);
      arrow3(v, [o[0] - nrm[0] * e * 0.4, o[1] - nrm[1] * e * 0.4, zf], [o[0], o[1], zf], RCOL, 2.4); v.label([o[0] - nrm[0] * e * 0.45, o[1] - nrm[1] * e * 0.45, zf], val('N', `${fmt(g.N)} ${F}`), RCOL);
      if (Math.abs(g.Ff) > 1e-12) { const sg = -Math.sign(g.Ff); arrow3(v, [o[0], o[1], zf], [o[0] + sg * tg[0] * e * 0.4, o[1] + sg * tg[1] * e * 0.4, zf], FCOL, 2.4); v.label([o[0] + sg * tg[0] * e * 0.45, o[1] + sg * tg[1] * e * 0.45, zf], val('F', `${fmt(Math.abs(g.Ff))} ${F}`), FCOL); }
      if (Math.abs(g.P) > 0) { const at = R(-g.b / 2, g.hP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); arrow3(v, [at[0] - d[0] * e * 0.5, at[1] - d[1] * e * 0.5, 0], [at[0], at[1], 0], LCOL, 2.6); v.label([at[0] - d[0] * e * 0.55, at[1] - d[1] * e * 0.55, 0], val('P', `${fmt(Math.abs(g.P))} ${F}`), LCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'incline') {
      const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], bs = 0.17, z = 0.3, zb = 0.1, top = R(1, 0);
      v._hs = 0.045;
      v.box(-0.3, -0.04, -z * 1.3, top[0] + 0.12, 0, z * 1.3, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude([[0, 0], [top[0], 0], top], -z, z, '#e3e9ed', 1, GEDGE, { layer: rest([-sp, cp, 0]) }); // the block rests on the slope
      const sc = inclinePos(g);
      v.extrude([R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)], -zb, zb, WOOD, 1, WEDGE);
      const G = R(sc, bs / 2), b0 = R(sc, 0), n = R(0, 1), t = R(1, 0), zf = zb + 0.002;
      arrow3(v, [G[0], G[1], 0], [G[0], G[1] - 0.25, 0], LCOL); v.label([G[0], G[1] - 0.28, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [b0[0] - n[0] * 0.22, b0[1] - n[1] * 0.22, zf], [b0[0], b0[1], zf], RCOL); v.label([b0[0] - n[0] * 0.25, b0[1] - n[1] * 0.25, zf], val('N', `${fmt(g.N)} ${F}`), RCOL);
      if (g.Ff > 1e-12) { const sg = g.fUp ? 1 : -1, f0 = R(sc + sg * bs * 0.5, 0); arrow3(v, [f0[0], f0[1], zf], [f0[0] + sg * t[0] * 0.24, f0[1] + sg * t[1] * 0.24, zf], FCOL); v.label([f0[0] + sg * t[0] * 0.27, f0[1] + sg * t[1] * 0.27, zf], val('F', `${fmt(g.Ff)} ${F}`), FCOL); }
      if (g.task !== 'release' && g.P > 0) {
        const d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG));
        if (g.psi > 0) { const at = R(sc + bs / 2, bs / 2); arrow3(v, [at[0], at[1], 0], [at[0] + d[0] * 0.28, at[1] + d[1] * 0.28, 0], LCOL, 2.6); v.label([at[0] + d[0] * 0.3, at[1] + d[1] * 0.3, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
        else { const at = R(sc - bs / 2, bs / 2); arrow3(v, [at[0] - d[0] * 0.28, at[1] - d[1] * 0.28, 0], [at[0], at[1], 0], LCOL, 2.6); v.label([at[0] - d[0] * 0.32, at[1] - d[1] * 0.32, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
      }
      v.autoBounds(); return;
    }
    if (g.kind === 'ladder') {
      const th = g.th * DEG, L = g.L, A = [L * Math.cos(th), 0], B = [0, L * Math.sin(th)], w = L * 0.12; v._hs = L * 0.05;
      v.box(-L * 0.04, 0, -L * 0.35, 0, B[1] * 1.2, L * 0.35, GROUND, 1, GEDGE);
      v.box(-L * 0.04, -L * 0.03, -L * 0.35, A[0] * 1.3, 0, L * 0.35, '#cfd8de', 1, GEDGE, { layer: -1 });
      [-w, w].forEach((zz) => v.line([[A[0], A[1], zz], [B[0], B[1], zz]], WEDGE, 4));
      for (let k = 1; k < 10; k++) { const t = k / 10; v.line([[A[0] * (1 - t), B[1] * t, -w], [A[0] * (1 - t), B[1] * t, w]], WEDGE, 2); }
      const m = [A[0] / 2, B[1] / 2, 0]; arrow3(v, m, [m[0], m[1] - L * 0.25, 0], LCOL, 2.4); v.label([m[0], m[1] - L * 0.28, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [A[0], -L * 0.25, 0], [A[0], 0, 0], RCOL, 2.4); v.label([A[0], -L * 0.28, 0], val('N_A', `${fmt(g.NA)} ${F}`), RCOL);
      if (g.FA > 0) { arrow3(v, [A[0] + L * 0.02, 0.01, w], [A[0] - L * 0.22, 0.01, w], FCOL, 2.4); v.label([A[0] - L * 0.3, 0.01, w], val('F_A', `${fmt(g.FA)} ${F}`), FCOL); }
      arrow3(v, [B[0] + L * 0.01, B[1], 0], [B[0] + L * 0.25, B[1], 0], RCOL, 2.4); v.label([B[0] + L * 0.28, B[1], 0], val('N_B', `${fmt(g.NB)} ${F}`), RCOL);
      if (g.FB > 0) { arrow3(v, [B[0] + 0.01, B[1] - L * 0.02, w], [B[0] + 0.01, B[1] + L * 0.2, w], FCOL, 2.4); v.label([B[0], B[1] + L * 0.23, w], val('F_B', `${fmt(g.FB)} ${F}`), FCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'wedge') {
      // the same layout as the 2D diagram: thick end at the left, face falling to the right, load resting on the face at B
      const lever = g.load === 'lever', ta = Math.tan(g.al * DEG), Lw = 1, t = Lw * Math.max(ta, 0.2), sa = Math.sin(g.al * DEG), ca = Math.cos(g.al * DEG);
      const k = lever ? 1 / (0.55 * g.a) : 1, a = lever ? g.a * k : 0, xB = Lw * 0.5, yB = t * 0.5, xA = xB + a, hL = (lever ? a : Lw) * 0.08;
      const zw = 0.3, xmin = -Lw * 0.6, xmax = lever ? xA + a * 0.15 : Lw * 1.5, face = (x) => t * (1 - x / Lw);
      v._hs = 0.06;
      v.box(xmin, -0.05, -0.5, xmax, 0, 0.5, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude([[0, 0], [Lw, 0], [0, t]], -zw, zw, STEEL, 1, GEDGE, { layer: rest([t, Lw, 0]) }); // the load rests on the sloped face
      let topW;
      if (lever) {
        const zl = 0.12;
        v.box(xB, yB, -zl, xA + a * 0.06, yB + hL, zl, WOOD, 1, WEDGE);
        v.extrude([[xA - 0.1, 0], [xA + 0.1, 0], [xA + 0.025, yB - 0.01], [xA - 0.025, yB - 0.01]], -0.09, 0.09, '#b9c4cc', 1, GEDGE);
        v.line([[xA, yB, -zl - 0.06], [xA, yB, zl + 0.06]], '#1d2733', 4);
        v.label([xA + 0.03, yB + hL + 0.02, zl], 'A', '#1d2733');
        const xw = xA - g.xW * k; topW = [xw, yB + hL, 0];
      } else {
        const bw = Lw * 0.36, bh = Lw * 0.4, x0 = xB - bw / 2, yt = face(x0) + bh, zb = 0.2;
        v.extrude([[x0, face(x0)], [x0 + bw, face(x0 + bw)], [x0 + bw, yt], [x0, yt]], -zb, zb, WOOD, 1, WEDGE);
        [[x0 - 0.06, x0 - 0.012], [x0 + bw + 0.012, x0 + bw + 0.06]].forEach(([u0, u1]) => v.box(u0, Math.max(yB + bh * 0.1, face(u0) + 0.03), -zw, u1, yB + bh * 1.6, zw, '#b9c4cc', 0.45, GEDGE));
        topW = [xB, yt, 0];
      }
      arrow3(v, [topW[0], topW[1] + 0.4, topW[2]], topW, LCOL, 2.6); v.label([topW[0], topW[1] + 0.44, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      // forces on the wedge at the front edge: N_B and friction at B, N_C, and the push or pull P at the thick end
      const zf = zw + 0.002, raise = g.task === 'raise', tf = raise ? [-ca, sa] : [ca, -sa];
      arrow3(v, [xB + sa * 0.3, yB + ca * 0.3, zf], [xB, yB, zf], RCOL); v.label([xB + sa * 0.33, yB + ca * 0.33, zf], val('N_B', `${fmt(g.NB)} ${F}`), RCOL);
      arrow3(v, [xB, yB, zf], [xB + tf[0] * 0.26, yB + tf[1] * 0.26, zf], FCOL); v.label([xB + tf[0] * 0.3, yB + tf[1] * 0.3 + 0.03, zf], 'μN_B', FCOL);
      v.label([xB - 0.02, yB - 0.06, zf], 'B', '#1d2733');
      arrow3(v, [Lw * 0.22, -0.3, zf], [Lw * 0.22, 0, zf], RCOL); v.label([Lw * 0.22, -0.34, zf], val('N_C', `${fmt(g.NC)} ${F}`), RCOL); v.label([Lw * 0.08, -0.02, zf], 'C', '#1d2733');
      const pull = g.P >= 0 ? !raise : raise, yP = t * 0.45;
      if (pull) arrow3(v, [0, yP, 0], [-0.45, yP, 0], LCOL, 2.8); else arrow3(v, [-0.45, yP, 0], [-0.005, yP, 0], LCOL, 2.8);
      v.label([-0.55, yP + 0.03, 0], val('P', `${fmt(Math.abs(g.P))} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'screw') {
      // jack: base, a square-threaded screw (pitch drawn from the lead angle), the load plate and the turning moment
      const r = 1, ri = 0.78, ro = 1.18, h = 3.6, pitch = Math.max(0.32, Math.min(1, 2 * Math.PI * r * Math.tan(g.th * DEG))), tw = pitch * 0.5, n = 40;
      v._hs = 0.22;
      v.lathe([[0, -1.1], [2.2, -1.1], [1.55, 0.15], [0, 0.15]], '#b9c4cc', 1, null, 40);
      v.lathe([[0, 0], [ri, 0], [ri, h], [0, h]], STEEL, 1, null, 36);
      const turns = Math.floor((h - 0.3) / pitch);
      for (let i = 0; i < turns * n; i++) {
        const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, y0 = 0.15 + (i / n) * pitch, y1 = 0.15 + ((i + 1) / n) * pitch;
        const P = (rr, a, y) => [rr * Math.cos(a), y, rr * Math.sin(a)];
        v.face([P(ro, a0, y0), P(ro, a1, y1), P(ro, a1, y1 + tw), P(ro, a0, y0 + tw)], '#aebbc4', 1, null);
        v.face([P(ri, a0, y0 + tw), P(ro, a0, y0 + tw), P(ro, a1, y1 + tw), P(ri, a1, y1 + tw)], '#d5dee4', 1, null);
        v.face([P(ri, a0, y0), P(ro, a0, y0), P(ro, a1, y1), P(ri, a1, y1)], '#9fadb7', 1, null);
      }
      v.box(-1.5, h, -1.5, 1.5, h + 0.35, 1.5, WOOD, 1, WEDGE);
      arrow3(v, [0, h + 2.2, 0], [0, h + 0.4, 0], LCOL, 2.6); v.label([0.2, h + 2.3, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const yM = h * 0.55, rm = 2.1, arc = [], sgn = g.task === 'raise' ? 1 : -1;
      for (let i = 0; i <= 40; i++) { const a = sgn * (i / 40) * 1.6 * Math.PI; arc.push([rm * Math.cos(a), yM, rm * Math.sin(a)]); }
      v.line(arc, FCOL, 2.4); arrow3(v, arc[arc.length - 3], arc[arc.length - 1], FCOL, 2.4);
      v.label([rm + 0.1, yM, 0], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'bearing') {
      v._hs = 0.12;
      if (g.type === 'collar' || g.type === 'disk') {
        const R2 = 1, R1 = g.R1 / g.R2, rs = R1 > 0 ? R1 * 0.8 : 0.3;
        v.lathe([[R1, -0.6], [1.5, -0.6], [1.5, 0], [R1, 0]], GROUND, 1, GEDGE, 40);
        v.lathe([[R1 * 0.999, 0], [R2, 0], [R2, 0.25], [0, 0.25], [0, 0.2], [R1 * 0.999, 0.2]].filter((p, i) => R1 > 0 || i < 4), STEEL, 1, null, 40);
        v.lathe([[0, 0.25], [rs, 0.25], [rs, 1.8], [0, 1.8]], '#dfe5ea', 1, null, 30);
        arrow3(v, [0, 2.8, 0], [0, 1.85, 0], LCOL, 2.6); v.label([0.12, 2.85, 0], val('P', `${fmt(g.P)} ${F}`), LCOL);
        const arc = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * 1.6 * Math.PI; arc.push([(rs + 0.45) * Math.cos(a), 1.2, (rs + 0.45) * Math.sin(a)]); }
        v.line(arc, FCOL, 2.4); arrow3(v, arc[37], arc[40], FCOL, 2.4); v.label([rs + 0.55, 1.25, 0], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
        v.autoBounds(); return;
      }
      if (g.type === 'journal') {
        const ring = (r, n) => { const p = []; for (let k = 0; k < n; k++) { const t = (k / n) * 2 * Math.PI; p.push([r * Math.cos(t), r * Math.sin(t)]); } return p; };
        v.box(-1.8, -1.9, -0.7, 1.8, -1.45, 0.7, GROUND, 1, GEDGE);
        v.extrude(ring(1, 36).map(([x, y]) => [x, y + 0.12]), -1.2, 1.2, STEEL, 1, null);
        arrow3(v, [0, 2.3, 0], [0, 1.2, 0], LCOL, 2.6); v.label([0.12, 2.35, 0], val('R', `${fmt(g.R)} ${F}`), LCOL);
        const arc = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * 1.6 * Math.PI; arc.push([1.35 * Math.cos(a), 1.35 * Math.sin(a), 1.25]); }
        v.line(arc, FCOL, 2.4); arrow3(v, arc[37], arc[40], FCOL, 2.4); v.label([1.4, 0.2, 1.25], val('M', `${fmt(g.M)} ${g.c.FL}`), FCOL);
        v.autoBounds(); return;
      }
      const ring = []; for (let k = 0; k < 36; k++) { const t = (k / 36) * 2 * Math.PI; ring.push([Math.cos(t), 1 + Math.sin(t)]); }
      v.box(-2.2, -0.15, -0.8, 2.6, 0, 0.8, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.extrude(ring, -0.3, 0.3, '#3b444b', 1, '#1d2733');
      arrow3(v, [0, 2.6, 0], [0, 2.02, 0], LCOL, 2.6); v.label([0.12, 2.65, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [-2, 1, 0.32], [-0.02, 1, 0.32], LCOL, 2.6); v.label([-2.1, 1.1, 0.32], val('P', `${fmt(g.P)} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'two') {
      v._hs = 0.06;
      if (g.arr === 'inc') {
        const ph = g.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph), R = (u, w) => [u * cp - w * sp, u * sp + w * cp], bs = 0.15, z = 0.3, top = R(1, 0);
        v.box(-0.3, -0.04, -z * 1.3, top[0] + 0.12, 0, z * 1.3, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
        v.extrude([[0, 0], [top[0], 0], top], -z, z, '#e3e9ed', 1, GEDGE, { layer: rest([-sp, cp, 0]) });
        const bl = g.low === 'A' ? [['A', 0.3], ['B', 0.7]] : [['B', 0.3], ['A', 0.7]];
        bl.forEach(([n, sc]) => { v.extrude([R(sc - bs / 2, 0), R(sc + bs / 2, 0), R(sc + bs / 2, bs), R(sc - bs / 2, bs)], -0.1, 0.1, WOOD, 1, WEDGE); const G = R(sc, bs / 2); v.label([G[0], G[1] + bs * 0.8, 0], n, '#1d2733'); arrow3(v, [G[0], G[1], 0.11], [G[0], G[1] - 0.2, 0.11], LCOL); });
        const a = R(0.3 + bs / 2, bs / 2), b = R(0.7 - bs / 2, bs / 2); v.line([[a[0], a[1], 0], [b[0], b[1], 0]], '#1d2733', 2.4);
      } else if (g.arr === 'stack') {
        v.box(-1.6, -0.05, -0.8, 2.2, 0, 0.8, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
        v.box(-0.9, 0, -0.45, 0.9, 0.5, 0.45, WOOD, 1, WEDGE); v.box(-0.45, 0.5, -0.3, 0.45, 0.95, 0.3, '#c9a06d', 1, WEDGE);
        v.label([0, 1.02, 0], 'A', '#1d2733'); v.label([0.7, 0.55, 0.45], 'B', '#1d2733');
        if (g.tie) { const yw = 0.725 + 1.05 * Math.tan(g.beta * DEG); v.box(-1.6, 0, -0.5, -1.5, yw + 0.4, 0.5, GROUND, 1, GEDGE); v.line([[-0.45, 0.725, 0], [-1.5, yw, 0]], '#1d2733', 2.4); }
        const pa = g.Pon === 'A' ? [0.45, 0.725, 0] : [0.9, 0.25, 0], ad = g.al * DEG; arrow3(v, pa, [pa[0] + 0.6 * Math.cos(ad), pa[1] + 0.6 * Math.sin(ad), 0], LCOL, 2.6); v.label([pa[0] + 0.66 * Math.cos(ad), pa[1] + 0.66 * Math.sin(ad), 0], val('P', `${fmt(g.P)} ${F}`), LCOL);
      } else {
        v.box(-2.4, -0.05, -0.9, 2.2, 0, 0.9, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
        v.box(0.4, 0, -0.55, 1.5, 1.1, 0.55, WOOD, 1, WEDGE);
        const xf = g.rope ? -1.6 : -0.6; v.box(xf - 0.15, 0, -0.15, xf + 0.15, 1.6, 0.15, '#7fb3d5', 1, '#2e5f80'); v.label([xf, 1.8, 0], 'person', '#1d2733');
        const a = g.rope ? [0.4, 0.66, 0] : [0.4, 1.25, 0], d = g.rope ? [-Math.cos(g.thC * DEG), Math.sin(g.thC * DEG)] : [1, 0];
        if (g.rope) { v.line([a, [xf + 0.2, 1.3, 0]], '#6b4f2a', 2.4); arrow3(v, a, [a[0] + d[0] * 0.6, a[1] + d[1] * 0.6, 0.2], LCOL, 2.6); }
        else arrow3(v, [a[0] - 0.7, a[1], 0], a, LCOL, 2.6);
        v.label([a[0] - 0.4, a[1] + 0.15, 0], val(g.rope ? 'T' : 'P', `${fmt(g.Tneed)} ${F}`), LCOL);
      }
      v.autoBounds(); return;
    }
    if (g.kind === 'vehicle') {
      const L = g.L, ang = (g.rise === 'B' ? 1 : -1) * g.phi * DEG, ca = Math.cos(ang), sa = Math.sin(ang), R = (u, w) => [u * ca - w * sa, u * sa + w * ca];
      const cs = carShape(g), zw = L * 0.32, ext = 0.55 * L; v._hs = L * 0.05;
      v.extrude([R(-ext, 0), R(L + ext, 0), R(L + ext, -0.06 * L), R(-ext, -0.06 * L)], -zw * 1.7, zw * 1.7, GROUND, 1, GEDGE, { layer: rest([-sa, ca, 0]) });
      v.extrude(cs.pts.map(([u, w]) => R(u, w)), -zw * 0.68, zw * 0.68, '#7fb3d5', 1, '#2e5f80');
      [0, L].forEach((x, i) => {
        const ring = []; for (let k = 0; k < 24; k++) { const t = (k / 24) * 2 * Math.PI; ring.push(R(x + cs.rw * Math.cos(t), cs.rw + cs.rw * Math.sin(t))); }
        [[zw * 0.7, zw * 1.02], [-zw * 1.02, -zw * 0.7]].forEach(([z0, z1]) => v.extrude(ring, z0, z1, '#3b444b', 1, '#1d2733'));
        if (g[i ? 'axB' : 'axA'] === 'locked') v.label([...R(x, cs.rw * 2.3), zw * 1.05], 'locked', '#a3281f');
      });
      const G = R(g.a, g.h), zf = zw * 1.04;
      arrow3(v, [G[0], G[1], 0], [G[0], G[1] - L * 0.35, 0], LCOL, 2.6); v.label([G[0], G[1] - L * 0.38, 0], val('W', `${fmt(g.W)} ${F}`), LCOL);
      const n = R(0, 1), t = R(1, 0);
      [['A', 0, g.NA, g.FA], ['B', L, g.NB, g.FB]].forEach(([k, x, N, Ff]) => {
        const o = R(x, 0), sN = Math.sign(N || 1);
        arrow3(v, [o[0] - n[0] * L * 0.3 * sN, o[1] - n[1] * L * 0.3 * sN, zf], [o[0], o[1], zf], RCOL, 2.4); v.label([o[0] - n[0] * L * 0.34, o[1] - n[1] * L * 0.34, zf], val(`N_${k}`, `${fmt(N)} ${F}`), RCOL);
        if (Math.abs(Ff) > 1e-9 * g.W) { const sg = Math.sign(Ff); arrow3(v, [o[0], o[1], zf], [o[0] + sg * t[0] * L * 0.28, o[1] + sg * t[1] * L * 0.28, zf], FCOL, 2.4); v.label([o[0] + sg * t[0] * L * 0.32, o[1] + sg * t[1] * L * 0.32, zf], val(`F_${k}`, `${fmt(Math.abs(Ff))} ${F}`), FCOL); }
      });
      if (g.useP && g.P > 0) { const at = R(g.xP, g.yP), d = R(Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)); arrow3(v, [at[0], at[1], 0], [at[0] + d[0] * L * 0.4, at[1] + d[1] * L * 0.4, 0], LCOL, 2.6); v.label([at[0] + d[0] * L * 0.44, at[1] + d[1] * L * 0.44, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
      v.autoBounds(); return;
    }
    if (g.kind === 'round') {
      const R = g.R, sw = g.s, zt = R * 0.45, ring = (rr) => { const p = []; for (let k = 0; k < 48; k++) { const t = (k / 48) * 2 * Math.PI; p.push([rr * Math.cos(t), rr * Math.sin(t)]); } return p; };
      v._hs = R * 0.1;
      v.box(-R * 2, -R - R * 0.08, -R * 1.1, R * 2, -R, R * 1.1, GROUND, 1, GEDGE, { layer: rest([0, 1, 0], 2) });
      v.box(sw > 0 ? R : -R - R * 0.08, -R, -R * 1.1, sw > 0 ? R + R * 0.08 : -R, R * 1.4, R * 1.1, '#cfd8de', 0.55, GEDGE, { layer: rest([-sw, 0, 0], 2) });
      v.extrude(ring(R), -zt, -zt * 0.6, WOOD, 1, WEDGE); v.extrude(ring(R), zt * 0.6, zt, WOOD, 1, WEDGE);
      const rp = Math.hypot(g.xP, g.yP); v.extrude(ring(Math.max(rp, R * 0.3)), -zt * 0.6, zt * 0.6, '#c9a978', 1, WEDGE);
      const zf = zt + R * 0.02, L = R * 0.6;
      arrow3(v, [0, 0, zf], [0, -R * 0.5, zf], LCOL); v.label([-R * 0.3, -R * 0.35, zf], val('W', `${fmt(g.W)} ${F}`), LCOL);
      arrow3(v, [0, -R - L, zf], [0, -R, zf], RCOL); v.label([0, -R - L - R * 0.1, zf], val('N_B', `${fmt(g.NF)} ${F}`), RCOL);
      arrow3(v, [sw * (R + L), 0, zf], [sw * R, 0, zf], RCOL); v.label([sw * (R + L * 1.15), R * 0.15, zf], val('N_A', `${fmt(g.NW)} ${F}`), RCOL);
      if (Number.isFinite(g.FF) && Math.abs(g.FF) > 1e-9 * g.W) { const d = Math.sign(g.FF); arrow3(v, [0, -R, zf], [d * L, -R, zf], FCOL); v.label([d * L * 1.2, -R, zf], val('F_B', `${fmt(Math.abs(g.FF))} ${F}`), FCOL); }
      if (Number.isFinite(g.FW) && Math.abs(g.FW) > 1e-9 * g.W) { const d = Math.sign(g.FW); arrow3(v, [sw * R, 0, zf], [sw * R, d * L, zf], FCOL); v.label([sw * R, d * L * 1.2, zf], val('F_A', `${fmt(Math.abs(g.FW))} ${F}`), FCOL); }
      const u = [Math.cos(g.psi * DEG), Math.sin(g.psi * DEG)];
      arrow3(v, [g.xP, g.yP, 0], [g.xP + u[0] * L * 1.2, g.yP + u[1] * L * 1.2, 0], LCOL, 2.6); v.label([g.xP + u[0] * L * 1.35, g.yP + u[1] * L * 1.35, 0], val('P', `${fmt(g.P)} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'brake2') {
      const L = brake2Layout(g), r = g.r, zt = r * 0.3, ring = []; for (let k = 0; k < 48; k++) { const t = (k / 48) * 2 * Math.PI; ring.push([r * Math.cos(t), r * Math.sin(t)]); }
      v._hs = r * 0.08;
      v.extrude(ring, -zt, zt, STEEL, 1, GEDGE);
      const bx = (x0, y0, x1, y1, z, col) => v.box(Math.min(x0, x1), Math.min(y0, y1), -z, Math.max(x0, x1), Math.max(y0, y1), z, col, 1, WEDGE);
      const w = r * 0.05, sh = 0.32 * r;
      bx(L.xL, -sh, -r, sh, zt * 0.9, '#a07a4a'); bx(r, -sh, L.xR, sh, zt * 0.9, '#a07a4a');
      bx(L.xL - w, L.yA, L.xL + w, L.yD, zt * 0.4, '#c9b48f'); bx(L.xR - w, L.yB, L.xR + w, L.yK, zt * 0.4, '#c9b48f');
      bx(L.xL - w * 0.7, L.yD, L.xL + w * 0.7, L.yC, zt * 0.5, '#aab7c4'); bx(L.xE, L.yD - w * 0.7, L.xL, L.yD + w * 0.7, zt * 0.5, '#aab7c4');
      v.line([[L.xL, L.yC, 0], [L.xR, L.yK, 0]], '#1d2733', 3); v.line([[L.xE, L.yD, 0], [L.xE, L.yHnd, 0]], '#1d2733', 3);
      bx(L.xPend, L.yHnd - w, L.xPiv, L.yHnd + w, zt * 0.4, '#5d6d7e');
      arrow3(v, [L.xPend, L.yHnd + r * 0.7, 0], [L.xPend, L.yHnd + w, 0], LCOL, 2.6); v.label([L.xPend, L.yHnd + r * 0.8, 0], val('P', `${fmt(g.P)} ${F}`), LCOL);
      v.autoBounds(); return;
    }
    if (g.kind === 'brake') {
      const r = g.r, sg = g.rev ? -1 : 1, xO = -g.b, yO = r + g.e * sg, xP = xO + (g.a || r), yBar = r * 1.12, zt = r * 0.3, ring = []; for (let k = 0; k < 48; k++) { const t = (k / 48) * 2 * Math.PI; ring.push([r * Math.cos(t), r * Math.sin(t)]); }
      v._hs = r * 0.08;
      v.extrude(ring, -zt, zt, STEEL, 1, GEDGE);
      v.box(-r * 0.2, r, -zt * 0.9, r * 0.2, yBar, zt * 0.9, '#a07a4a', 1, WEDGE);
      v.box(Math.min(xO, 0, xP) - r * 0.05, yBar, -zt * 0.4, Math.max(xO, 0, xP) + r * 0.05, yBar + r * 0.08, zt * 0.4, '#c9b48f', 1, WEDGE);
      if (Math.abs(yO - yBar) > 1e-9) v.box(xO - r * 0.03, Math.min(yO, yBar), -zt * 0.4, xO + r * 0.03, Math.max(yO, yBar), zt * 0.4, '#c9b48f', 1, WEDGE);
      v.line([[xO, yO, -zt], [xO, yO, zt]], '#1d2733', 4); v.label([xO - r * 0.15, yO, zt], 'O', '#1d2733');
      if (g.a > 0 && g.task !== 'lock') { arrow3(v, [xP, yBar + r * 0.7, 0], [xP, yBar + r * 0.08, 0], LCOL, 2.6); v.label([xP, yBar + r * 0.8, 0], val('P', `${fmt(g.P)} ${F}`), LCOL); }
      arrow3(v, [0, r, zt + 0.01], [sg * r * 0.6, r, zt + 0.01], FCOL); v.label([sg * r * 0.75, r, zt], g.task === 'lock' ? 'F' : val('F', `${fmt(g.Ff)} ${F}`), FCOL);
      v.autoBounds(); return;
    }
    // belt: each drum with the belt wrapped over its contact angle and the tensions on the two free ends
    const R = 1, rb = 1.04, zb = 0.28;
    v._hs = 0.16;
    g.drums.forEach((d, i) => {
      const cx = i * 3.6, ring = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * 2 * Math.PI; ring.push([cx + R * Math.cos(a), R * Math.sin(a)]); }
      v.extrude(ring, -0.45, 0.45, '#dfe5ea', 1, null);
      v.line([[cx, 0, -0.7], [cx, 0, 0.7]], '#1d2733', 4);
      const vis = Math.min(d.deg, 359.5), a0 = 90 + vis / 2, a1 = 90 - vis / 2, nseg = Math.max(6, Math.round(vis / 6));
      for (let k = 0; k < nseg; k++) {
        const p = (a1 + (vis * k) / nseg) * DEG, q = (a1 + (vis * (k + 1)) / nseg) * DEG;
        v.face([[cx + rb * Math.cos(p), rb * Math.sin(p), -zb], [cx + rb * Math.cos(q), rb * Math.sin(q), -zb], [cx + rb * Math.cos(q), rb * Math.sin(q), zb], [cx + rb * Math.cos(p), rb * Math.sin(p), zb]], '#2c3e50', 1, null);
      }
      [[a0, 1], [a1, -1]].forEach(([a, sg], kk) => {
        const ar = a * DEG, px = cx + rb * Math.cos(ar), py = rb * Math.sin(ar), tx = -Math.sin(ar) * sg, ty = Math.cos(ar) * sg, Lt = 1.1;
        v.face([[px, py, -zb], [px + tx * Lt, py + ty * Lt, -zb], [px + tx * Lt, py + ty * Lt, zb], [px, py, zb]], '#2c3e50', 1, null);
        const big = kk === 0, Tv = g.hi ? (kk === 0 ? g.Ts[i] : g.Ts[i + 1]) : (kk === 0 ? g.Ts[i + 1] : g.Ts[i]);
        arrow3(v, [px + tx * Lt * 0.6, py + ty * Lt * 0.6, zb + 0.01], [px + tx * (Lt + 0.5), py + ty * (Lt + 0.5), zb + 0.01], big ? LCOL : RCOL, 2.6);
        v.label([px + tx * (Lt + 0.6), py + ty * (Lt + 0.6), zb], opt.showP ? `${fmt(Tv)} ${F}` : (big ? 'T₂' : 'T₁'), big ? LCOL : RCOL);
      });
      v.label([cx - 0.3, -R - 0.35, 0.45], `Drum ${i + 1}`, '#1d2733');
    });
    v.autoBounds();
  };

  /* ------------------------------------------------------------------ */
  /* Presets                                                            */
  /* ------------------------------------------------------------------ */
  const B = (o) => ({ mode: 'block', fu: 'N', bk: o });
  const TW = (o, fu, units) => ({ mode: 'two', fu, tw: Object.assign({ arr: 'inc', wBy: 'force', muA: 0.3, muB: 0.3, lower: 'A', conn: 'spring', k: 2, task: 'both', Pon: 'B', al: 0, tie: true, beta: 30, muG: 0.3, how: 'push', thC: 0, thM: 0, tip: false, b: 1, h: 1 }, o) });
  M.presets = [
    { name: 'Test: Book Example 8.1, crate pushed at 30° (does it move?)', units: 'SI', state: B({ wBy: 'mass', m: 20, b: 0.8, H: 0.6, phi: 0, mu: 0.3, task: 'check', P: 80, psi: -30, hP: 0.2 }),
      expect: [{ k: 'Friction needed F', v: 69.28 }, { k: 'Normal force N', v: 236.2 }, { k: 'Position of N, x', v: -0.00908 }, { k: 'Largest friction μs N', v: 70.86 }] },
    { name: 'Test: Book Example 8.2, angle of repose on a 25° truck bed', units: 'US', state: { mode: 'block', fu: 'lb', bk: { wBy: 'force', W: 500, b: 3, H: 5, phi: 25, mu: 0.4663077, task: 'check', P: 0, psi: 0, hP: 0 } },
      expect: [{ k: 'Position of N, x', v: -1.166 }, { k: 'Normal force N', v: 453.15 }, { k: 'Friction needed F', v: -211.31 }] },
    { name: 'Test: closed form, block pushed at 0.8 m tips before it slips', units: 'SI', state: B({ wBy: 'force', W: 500, b: 0.6, H: 1, phi: 0, mu: 0.4, task: 'findP', psi: 0, hP: 0.8 }),
      expect: [{ k: 'P to tip', v: 187.5 }, { k: 'P to slip', v: 200 }] },
    { name: 'Block pushed up a 20° slope', units: 'SI', state: { mode: 'block', fu: 'kN', bk: { wBy: 'force', W: 2, b: 0.5, H: 0.8, phi: 20, mu: 0.35, task: 'findP', psi: 10, hP: 0.3 } } },
    { name: 'Test: closed form, 20 kg block released on a 30° slope slides 3 m', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.25, task: 'release', d: 3 } },
      expect: [{ k: 'Acceleration down the slope a', v: 2.7811 }, { k: 'Time to slide 3 m', v: 1.4688 }, { k: 'Speed after that distance', v: 4.0849 }, { k: 'Normal force N', v: 169.91 }] },
    { name: 'Test: Dynamics F13-1, 20 kg crate pulled up a 30° slope at 1.333 m/s²', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.3, task: 'up', psi: 0, acc: 1.333333 } },
      expect: [{ k: 'P to keep it moving up', v: 175.74 }, { k: 'Normal force N', v: 169.91 }] },
    { name: 'Test: Dynamics F14-10, 20 kg crate pushed up a 30° slope at steady speed', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.25, muk: 0.2, task: 'up', psi: 0, acc: 0 } },
      expect: [{ k: 'P to keep it moving up', v: 132.08 }, { k: 'Kinetic friction F', v: 33.98 }] },
    { name: 'Test: closed form, force to hold a 20 kg block on a 30° slope', units: 'SI', state: { mode: 'incline', fu: 'N', ic: { wBy: 'mass', m: 20, phi: 30, mus: 0.3, muk: 0.25, task: 'hold', psi: 0 } },
      expect: [{ k: 'P to hold the block', v: 47.126 }, { k: 'Largest P before it slides up', v: 149.07 }] },
    { name: 'Crate held on a 40° ramp by a rope at 20°', units: 'US', state: { mode: 'incline', fu: 'lb', ic: { wBy: 'force', W: 150, phi: 40, mus: 0.35, muk: 0.3, task: 'hold', psi: 20 } } },
    { name: 'Test: Book Example 8.3, smallest angle of a ladder on a smooth wall', units: 'SI', state: { mode: 'ladder', fu: 'N', ld: { wBy: 'mass', m: 10, L: 4, muA: 0.3, muB: 0, task: 'minAngle', person: false } },
      expect: [{ k: 'Smallest angle θ (from the floor)', v: 59.04 }, { k: 'N_A', v: 98.1 }, { k: 'F_A', v: 29.43 }, { k: 'N_B', v: 29.43 }] },
    { name: 'Ladder at 70° with a person three-quarters up, rough wall', units: 'US', state: { mode: 'ladder', fu: 'lb', ld: { wBy: 'force', W: 40, L: 16, muA: 0.25, muB: 0.2, task: 'check', th: 70, person: true, wpBy: 'force', Wp: 180, s: 12 } } },
    { name: 'Test: Book Example 8.6, pulling the wedge out from under a 500 kg stone', units: 'SI', state: { mode: 'wedge', fu: 'N', wd: { load: 'lever', wBy: 'mass', m: 500, al: 7, mu: 0.3, muC: 0.3, muG: 0, a: 1, xW: 0.5, task: 'lower' } },
      expect: [{ k: 'Pull to remove, P', v: 1154.9 }, { k: 'N_B', v: 2383.1 }, { k: 'N_C', v: 2452.5 }] },
    { name: 'Wedge raising a block in a guide', units: 'SI', state: { mode: 'wedge', fu: 'kN', wd: { load: 'guide', wBy: 'force', W: 8, al: 12, mu: 0.25, muC: 0.25, muG: 0.15, task: 'raise' } } },
    { name: 'Test: Book Example 8.7, turnbuckle with two screws', units: 'SI', state: { mode: 'screw', fu: 'N', sc: { W: 2000, r: 5, l: 2, mu: 0.25, n: 2, task: 'raise' } },
      expect: [{ k: 'Moment to raise M', v: 6.375 }, { k: 'Lead angle θ', v: 3.643 }, { k: 'Friction angle φs', v: 14.04 }] },
    { name: 'Screw with a steep thread that is not self-locking', units: 'US', state: { mode: 'screw', fu: 'lb', sc: { W: 1500, r: 0.4, l: 0.9, mu: 0.15, n: 1, task: 'lower' } } },
    { name: 'Test: Book Example 8.8, cord over two drums holding a hanging mass', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'high', T: 500, drums: [{ beta: 135, turns: 0, mu: 0.25 }, { beta: 135, turns: 0, mu: 0.25 }] } },
      expect: [{ k: 'Tension after drum 1', v: 277.4 }, { k: 'Tension after drum 2', v: 153.9 }, { k: 'Mass that can be held', v: 15.69 }] },
    { name: 'Test: V-belt in a 60° groove, 180° contact (Prob. 8-98 relation)', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'low', T: 100, drums: [{ beta: 180, turns: 0, mu: 0.3, alpha: 60 }] } },
      expect: [{ k: 'Tension after drum 1', v: 658.5 }, { k: 'Ratio of the tensions', v: 6.585 }] },
    { name: 'Test: Prob. 8-93, band brake: torque a 30 N lever force resists', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'high', T: 100, drums: [{ beta: 270, turns: 0, mu: 0.3, alpha: 0 }], wheel: true, task: 'lever', rW: 0.3, M: 50, P: 30, lever: true, aL: 0.7, dT: 0.025, dS: -0.06 } },
      expect: [{ k: 'Torque on the wheel M', v: 458.1 }] },
    { name: 'Test: Prob. 8-99, band brake: lever force to hold M = 50 N·m', units: 'SI', state: { mode: 'belt', fu: 'N', bt: { known: 'high', T: 100, drums: [{ beta: 270, turns: 0, mu: 0.3, alpha: 0 }], wheel: true, task: 'T', rW: 0.15, M: 50, P: 30, lever: true, aL: 0.4, dT: 0, dS: 0.2 } },
      expect: [{ k: 'Slack-side tension T₁', v: 107.14 }, { k: 'Force on the lever P', v: 53.57 }] },
    { name: 'Rope with two turns around a capstan', units: 'US', state: { mode: 'belt', fu: 'lb', bt: { known: 'low', T: 20, drums: [{ beta: 0, turns: 2, mu: 0.3 }] } } },
    { name: 'Test: Prob. 8-18, spool against a wall: force to pull the wire off', units: 'US', state: { mode: 'round', fu: 'lb', rd: { wBy: 'force', W: 300, R: 3, wall: 'right', muF: 0.25, muW: 0.25, task: 'P', rP: 1, thP: -90, psi: 0, P: 300 } },
      expect: [{ k: 'Force P to turn it', v: 1350 }, { k: 'N_B (floor)', v: 600 }, { k: 'N_A (wall)', v: 1200 }] },
    { name: 'Test: Prob. 8-19, spool with a smooth wall and P = 300 lb', units: 'US', state: { mode: 'round', fu: 'lb', rd: { wBy: 'force', W: 300, R: 3, wall: 'right', muF: 0.35, muW: 0, task: 'check', rP: 1, thP: -90, psi: 0, P: 300 } },
      expect: [{ k: 'N_A (wall)', v: 200 }, { k: 'N_B (floor)', v: 300 }, { k: 'F_B (floor)', v: 100 }] },
    { name: 'Test: Prob. 8-35, largest push on a 30 lb hoop before it turns', units: 'US', state: { mode: 'round', fu: 'lb', rd: { wBy: 'force', W: 30, R: 0.9843, wall: 'right', muF: 0.2, muW: 0.2, task: 'P', rP: 0.9843, thP: 90, psi: 0, P: 10 } },
      expect: [{ k: 'Force P to turn it', v: 8.182 }, { k: 'N_B (floor)', v: 27.27 }, { k: 'N_A (wall)', v: 13.64 }] },
    { name: 'Test: Prob. 8-34, μs at which the hoop turns under P = 0.2727 W', units: 'US', state: { mode: 'round', fu: 'lb', rd: { wBy: 'force', W: 30, R: 1, wall: 'right', muF: 0.2, muW: 0.2, task: 'mu', rP: 1, thP: 90, psi: 0, P: 8.1818 } },
      expect: [{ k: 'μs at which it just turns', v: 0.2 }] },
    { name: 'Test: Prob. 8-22, brake with a spring: force to resist 800 N·m', units: 'SI', state: { mode: 'brake', fu: 'N', br: { rW: 0.25, mu: 0.4, task: 'P', M: 800, P: 100, a: 0.2, b: 0.4, e: 0.05, rev: false } },
      expect: [{ k: 'Force on the lever P', v: 16800 }, { k: 'Normal force N', v: 8000 }] },
    { name: 'Test: Prob. 8-29, pawl: largest angle from the normal that binds (μs = 0.6)', units: 'SI', state: { mode: 'brake', fu: 'N', br: { rW: 0.25, mu: 0.6, task: 'lock', M: 800, P: 100, a: 0.2, b: 0.3, e: -0.6, rev: false } },
      expect: [{ k: 'Friction angle φs (largest pawl angle)', v: 30.96 }, { k: 'Smallest μs for self-locking', v: 0.5 }] },
    { name: 'Block brake turned the other way: self-energizing loses its help', units: 'SI', state: { mode: 'brake', fu: 'N', br: { rW: 0.25, mu: 0.4, task: 'M', M: 800, P: 16800, a: 0.2, b: 0.4, e: 0.05, rev: true } } },
    { name: 'Test: car parked on a 12° incline with the rear wheels locked (Ellis\'s Problem 14)', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 1500, a: 1.5, b: 3, h: 1.1, phi: 12, rise: 'A', mu: 0.6, axA: 'locked', axB: 'free', task: 'park', front: 'B', hasP: false } },
      expect: [{ k: 'Normal force at A, N_A', v: 8847.8 }, { k: 'Normal force at B, N_B', v: 5545.7 }, { k: 'Friction at A, F_A', v: -3059.4 }] },
    { name: 'Test: Prob. 8-3, mine car with both brakes locked and a 10 kN push (does it move?)', units: 'SI', state: { mode: 'vehicle', fu: 'kN', vh: { wBy: 'mass', m: 6000, a: 0.9, b: 0.6, h: 0.15, phi: 0, rise: 'B', mu: 0.4, axA: 'locked', axB: 'locked', task: 'park', front: 'B', hasP: true, P: 10, xP: 0, yP: 1.05, psi: 0 } },
      expect: [{ k: 'Normal force at A, N_A', v: 16.544 }, { k: 'Normal force at B, N_B', v: 42.316 }] },
    { name: 'Test: Prob. 8-5, towing force with the back brakes locked', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 2000, a: 1, b: 1.5, h: 0.6, phi: 0, rise: 'B', mu: 0.3, axA: 'free', axB: 'locked', task: 'force', front: 'A', xP: -0.75, yP: 0.3, psi: 150, move: 'A' } },
      expect: [{ k: 'Force P', v: 2762.7 }, { k: 'Normal force at B, N_B', v: 7975.3 }, { k: 'Normal force at A, N_A', v: 10263.3 }] },
    { name: 'Test: Prob. 8-6, towing force with all brakes locked', units: 'SI', state: { mode: 'vehicle', fu: 'N', vh: { wBy: 'mass', m: 2000, a: 1, b: 1.5, h: 0.6, phi: 0, rise: 'B', mu: 0.3, axA: 'locked', axB: 'locked', task: 'force', front: 'A', xP: -0.75, yP: 0.3, psi: 150, move: 'A' } },
      expect: [{ k: 'Force P', v: 5793.2 }] },
    { name: 'Test: Prob. 8-14, steepest road shoulder before the car slips or tips', units: 'US', state: { mode: 'vehicle', fu: 'lb', vh: { wBy: 'force', W: 3527, a: 2.5, b: 2.5, h: 2.5, rise: 'A', mu: 0.4, axA: 'locked', axB: 'locked', task: 'slope', front: 'B' } },
      expect: [{ k: 'Steepest slope φ_max', v: 21.801 }, { k: 'Slope at which it tips', v: 45 }] },
    { name: 'Test: Prob. 8-107, collar bearing carrying 5 kN', units: 'SI', state: { mode: 'bearing', fu: 'N', be: { kind: 'collar', P: 5000, R1: 0.075, R2: 0.1, mu: 0.3, task: 'M' } },
      expect: [{ k: 'Moment to turn M', v: 132.14 }] },
    { name: 'Test: Prob. 8-109, floor polisher (disk bearing, R = 1 ft)', units: 'US', state: { mode: 'bearing', fu: 'lb', be: { kind: 'disk', P: 80, R2: 1, mu: 0.3, task: 'M' } },
      expect: [{ k: 'Moment to turn M', v: 16 }] },
    { name: 'Test: Prob. 8-119, 50 kg disk on a 30 mm shaft (journal bearing)', units: 'SI', state: { mode: 'bearing', fu: 'N', be: { kind: 'journal', W: 490.5, rs: 0.015, mu: 0.15, task: 'M' } },
      expect: [{ k: 'Friction circle radius r_f', v: 0.0022251 }] },
    { name: 'Test: closed form, rolling resistance of a 16 000 lb tractor, a = 2 in., r = 2.5 ft', units: 'US', state: { mode: 'bearing', fu: 'lb', be: { kind: 'rolling', W: 16000, rw: 2.5, a: 0.1666667, aB: 0 } },
      expect: [{ k: 'Force to roll P', v: 1066.67 }] },
    { name: 'Test: μs for impending motion of a 200 lb crate on a 30° slope held by 76 lb', units: 'US', state: { mode: 'incline', fu: 'lb', ic: { wBy: 'force', W: 200, phi: 30, task: 'mu', P: 76, psi: 0 } },
      expect: [{ k: 'μs for impending motion', v: 0.13856 }] },
    { name: 'Test: Prob. 8-30, two blocks joined by a spring: angle when both slide, and the stretch', units: 'US', state: TW({ WA: 10, WB: 6, muA: 0.15, muB: 0.25, k: 2, task: 'both' }, 'lb'),
      expect: [{ k: 'Angle θ', v: 10.62 }, { k: 'Spring stretch needed', v: 0.1843 }] },
    { name: 'Test: Prob. 8-31, two blocks joined by a spring: angle when one slides', units: 'US', state: TW({ WA: 10, WB: 6, muA: 0.15, muB: 0.25, k: 2, task: 'first' }, 'lb'),
      expect: [{ k: 'Angle θ', v: 8.531 }, { k: 'Friction under A, F_A', v: 1.4834 }, { k: 'Friction under B, F_B', v: 0.89 }] },
    { name: 'Test: Prob. 8-33, can a 200 lb man push a 450 lb crate? (no)', units: 'US', state: TW({ arr: 'push', WA: 450, WB: 200, muA: 0.3, muB: 0.6, how: 'push', tip: true, b: 2, h: 3 }, 'lb'),
      expect: [{ k: 'Push needed to move the crate', v: 135 }, { k: 'Largest push before the person slips', v: 120 }] },
    { name: 'Test: Prob. 8-45, man pulling a 100 kg crate with a rope over a pulley (no)', units: 'SI', state: TW({ arr: 'push', wBy: 'mass', mA: 100, mB: 60, muA: 0.3, muB: 0.4, how: 'rope', thC: 30, thM: 45 }, 'N'),
      expect: [{ k: 'Rope tension needed to move the crate', v: 289.66 }, { k: 'Largest pull before the person slips', v: 237.83 }] },
    { name: 'Test: closed form, block B pulled out from under block A tied to the wall', units: 'SI', state: TW({ arr: 'stack', WA: 100, WB: 200, muA: 0.3, muG: 0.2, tie: true, beta: 30, Pon: 'B', al: 0 }, 'N'),
      expect: [{ k: 'Cord tension T', v: 29.527 }, { k: 'Force P to start motion', v: 82.618 }] },
    { name: 'Top block pulled: does it slide on the lower block or do both move?', units: 'SI', state: TW({ arr: 'stack', wBy: 'mass', mA: 20, mB: 30, muA: 0.4, muG: 0.15, tie: false, Pon: 'A', al: 20 }, 'N') },
    { name: 'Edge: a pull that lifts the block off the floor (fails on purpose)', units: 'SI', fails: true, state: B({ wBy: 'force', W: 100, b: 0.5, H: 0.5, phi: 0, mu: 0.3, task: 'check', P: 300, psi: 60, hP: 0.4 }) },
    { name: 'Test: Prob. 8-37, double-block brake: smallest handle force to hold 5 N·m counterclockwise (μs = 0.8)', units: 'SI', state: { mode: 'brake', fu: 'N', br: { kind: 'double', task2: 'P', r2: 0.2, M2: 5, rev2: false, mu2: 0.8, hH: 0.4, hD: 0.7, hI: 0.4, hK: 0.8, dDC: 0.1, dDE: 0.2, aP: 0.65, aJ: 0.15, t2: 0 } },
      expect: [{ k: 'Force on the handle P', v: 0.962 }, { k: 'Normal force at shoe I, N_I', v: 16.667 }, { k: 'Normal force at shoe H, N_H', v: 14.583 }, { k: 'Force in link EJ, F_EJ', v: 4.1667 }] },
    { name: 'Test: Prob. 8-38, the same double-block brake with the torque clockwise (P = 0.962 N)', units: 'SI', state: { mode: 'brake', fu: 'N', br: { kind: 'double', task2: 'P', r2: 0.2, M2: 5, rev2: true, mu2: 0.8, hH: 0.4, hD: 0.7, hI: 0.4, hK: 0.8, dDC: 0.1, dDE: 0.2, aP: 0.65, aJ: 0.15, t2: 0 } },
      expect: [{ k: 'Force on the handle P', v: 0.962 }, { k: 'Force in link KC, F_KC', v: 8.333 }] },
    { name: 'Double-block brake with thick shoes: torque a 40 lb pull on the handle holds', units: 'US', state: { mode: 'brake', fu: 'lb', br: { kind: 'double', task2: 'M', r2: 0.75, P2: 40, rev2: false, mu2: 0.5, hH: 1.5, hD: 2.5, hI: 1.5, hK: 3, dDC: 0.5, dDE: 0.8, aP: 2.4, aJ: 0.6, t2: 0.15 } } },
    { name: 'Edge: double-block brake whose link KC is not level (fails on purpose)', units: 'SI', fails: true, state: { mode: 'brake', fu: 'N', br: { kind: 'double', task2: 'P', r2: 0.2, M2: 5, hH: 0.4, hD: 0.7, hI: 0.4, hK: 0.9, dDC: 0.1, dDE: 0.2, aP: 0.65, aJ: 0.15 } } },
  ];

  root.SFriction = M;
})(window);
