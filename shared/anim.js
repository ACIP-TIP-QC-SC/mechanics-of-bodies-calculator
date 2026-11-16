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
  root.Anim = Anim;
})(window);
