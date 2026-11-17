/* =====================================================================
 * Animation loop: Play / Pause, Reset, speed and a clock.
 * A module that can animate gives the app
 *   anim: { duration: seconds for one pass, loop: true|false,
 *           frame(u, t)  — set the module state for progress u in [0, 1],
 *           label(u, t)  — text for the clock }
 * The animation is paused until the viewer presses Play, so the PDF and
 * the preset checks always see a fixed frame.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { h } = root.UI;

  function Anim(bar, onFrame) {
    let cfg = null, t = 0, playing = false, last = 0, raf = 0, speed = 1;
    const play = h('button', { type: 'button', class: 'btn small' }, '▶ Play');
    const reset = h('button', { type: 'button', class: 'btn small' }, 'Reset');
    const sel = h('select', { 'aria-label': 'Animation speed' }, ...[0.25, 0.5, 1, 2, 4].map((v) => h('option', { value: v, selected: v === 1 }, v + '×')));
    const clock = h('span', { class: 'clock' }, '');
    bar.append(play, reset, sel, clock);

    const u = () => (cfg ? Math.min(1, t / cfg.duration) : 0);
    function show() {
      play.textContent = playing ? '❚❚ Pause' : '▶ Play';
      clock.textContent = cfg && cfg.label ? cfg.label(u(), t) : '';
    }
    function tick(now) {
      if (!playing || !cfg) return;
      t += ((now - last) / 1000) * speed; last = now;
      if (t >= cfg.duration) { if (cfg.loop) t %= cfg.duration; else { t = cfg.duration; playing = false; } }
      cfg.frame(u(), t); onFrame(!playing); show();
      if (playing) raf = root.requestAnimationFrame(tick);
    }
    const A = {
      get playing() { return playing; },
      /** Attach a module's animation (or null to hide the bar). */
      set(c) { if (c && c === cfg) { bar.hidden = false; show(); return; } A.stop(); cfg = c || null; t = 0; bar.hidden = !cfg; show(); },
      start() { if (!cfg || playing) return; if (t >= cfg.duration) t = 0; playing = true; last = root.performance.now(); show(); raf = root.requestAnimationFrame(tick); },
      stop() { playing = false; root.cancelAnimationFrame(raf); show(); },
      reset() { A.stop(); t = 0; if (cfg) { cfg.frame(0, 0); onFrame(true); } show(); },
      refresh: show,
    };
    play.addEventListener('click', () => (playing ? (A.stop(), onFrame(true)) : A.start()));
    reset.addEventListener('click', () => A.reset());
    sel.addEventListener('change', () => { speed = parseFloat(sel.value) || 1; });
    return A;
  }
  /* Deflection "gif", shared by every module that shows a deflected shape: 10 s a loop at 1×,
   * 4 s from the straight member to the deflected shape, a 1 s hold, 4 s back and a 1 s hold.
   * It keeps the fraction of the full deflection in state._k; Reset clears it, which gives the static view. */
  const ease = (t) => t * t * (3 - 2 * t);
  Anim.deflK = (u) => (u < 0.4 ? ease(u / 0.4) : u < 0.5 ? 1 : u < 0.9 ? ease((0.9 - u) / 0.4) : 0);
  Anim.deflection = (state) => ({
    duration: 10, loop: true,
    frame(u) { const st = state(); if (u <= 0) delete st._k; else st._k = Anim.deflK(u); },
    label() { const k = state()._k; return k === undefined ? 'full deflected shape' : `deflection ${Math.round(k * 100)} % of full`; },
  });
  /** Contour colour for a deflection ratio t in [0, 1]: blue (none) through green and yellow to red (largest). */
  const STOPS = [[0, [44, 123, 182]], [0.25, [0, 166, 202]], [0.5, [0, 204, 140]], [0.7, [170, 220, 80]], [0.85, [249, 208, 87]], [1, [215, 25, 28]]];
  Anim.contour = (t) => {
    t = Math.max(0, Math.min(1, t || 0));
    let i = 1; while (i < STOPS.length - 1 && t > STOPS[i][0]) i++;
    const [t0, a] = STOPS[i - 1], [t1, b] = STOPS[i], f = (t - t0) / (t1 - t0 || 1);
    return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('');
  };
  root.Anim = Anim;
})(window);
