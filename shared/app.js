/* =====================================================================
 * Generic app shell used by every discipline (Statics, Dynamics,
 * Mechanics of Deformable Bodies): module tabs, units toggle, render
 * loop, results, messages, worked solution, Copy solution, Print PDF.
 *
 * A discipline page calls  MOB.start({ name, key, modules: [...] }).
 * A module is
 *   { id, title, defaults(), presets: [{ name, units, state, expect, fails }],
 *     controls(parent, C), compute(U) -> result, draw2D(svg, res, U, opt),
 *     draw3D(view3d, res, U, opt), plot(svg, res, U) [optional],
 *     onUnits(from, to), legend, hint, toggle, diagram(parent, C), cap2D, cap3D,
 *     onDrag(pt, phase) / onClick(pt) [optional], anim [optional] }
 * The app owns module.state and module.units.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Core, UI } = root;
  const { h } = UI;
  const $ = (id) => document.getElementById(id);
  const TITLE = Core.APP_TITLE;

  function start(cfg) {
    const App = {
      name: cfg.name, view: '2d', showP: true, active: null, res: null, modules: {},
      get units() { return this.mod().units; },
      U() { return Core.UNITS[this.mod().units]; },
      mod() { return this.modules[this.active]; },
    };
    root.App = App;
    cfg.modules.forEach((m) => { if (!m) return; m.state = m.defaults(); m.units = m.units || 'SI'; App.modules[m.id] = m; });
    App.active = Object.keys(App.modules)[0];
    const TAB_KEY = 'mob.' + cfg.key + '.tab';
    try { const t = localStorage.getItem(TAB_KEY); if (t && App.modules[t]) App.active = t; } catch (e) {}

    const view3d = new root.View3D($('cv3d'));
    App.view3d = view3d;
    const C = UI.Controls(App);
    const anim = root.Anim($('animBar'), (final) => (final ? App.rebuild(true) : App.update()));
    App.anim = anim;

    function buildTabs() {
      const t = $('tabs'); t.innerHTML = '';
      Object.values(App.modules).forEach((m, i) => {
        t.append(h('button', { type: 'button', role: 'tab', 'aria-selected': App.active === m.id ? 'true' : 'false', onclick: () => { anim.set(null); App.active = m.id; try { localStorage.setItem(TAB_KEY, m.id); } catch (e) {} buildTabs(); syncUnits(); App.rebuild(); } }, h('span', { class: 'n' }, String(i + 1)), m.title));
        if (App.active === m.id) $('modTitle').textContent = `${i + 1}. ${m.title}`;
      });
    }
    function buildExamples() {
      const sel = $('examples'); sel.innerHTML = '';
      sel.append(h('option', { value: '' }, 'Load example / test case…'));
      App.mod().presets.forEach((p, i) => sel.append(h('option', { value: i }, p.name)));
    }
    $('examples').addEventListener('change', (e) => {
      const i = e.target.value;
      if (i === '') return;
      App.loadPreset(+i);
      e.target.value = i;
    });
    /* A preset is a complete snapshot merged over fresh defaults, so no value can leak in from the preset loaded before it. */
    App.loadPreset = function (i) {
      const m = App.mod(), pr = m.presets[i];
      anim.set(null);
      m.state = Core.presetState(m.defaults, pr);
      m.units = pr.units || 'SI';
      syncUnits();
      App.rebuild(true);
    };

    function syncChrome() {
      const m = App.mod();
      const val = (x) => (typeof x === 'function' ? x.call(m) : x);
      const tg = val(m.toggle);
      $('showPWrap').hidden = !tg;
      if (tg) $('showPLabel').textContent = tg;
      $('diagOpts').hidden = !tg && $('diagCtl').children.length < 2;
      const lg = $('legend'); lg.innerHTML = '';
      const items = val(m.legend) || [];
      items.forEach(([c, t, k]) => lg.append(h('span', null, h('i', { class: k || '', style: { background: c } }), t)));
      lg.hidden = !items.length;
      const hint = val(m.hint);
      $('hint').textContent = (hint ? hint + ' ' : '') + '3D view: drag to rotate, scroll to zoom. Values are rounded to 4 significant figures.';
      $('svg2d').classList.toggle('drag', !!m.onDrag);
      $('viewSeg').querySelector('[data-v="2d"]').textContent = val(m.cap2D) || '2D diagram';
      $('viewSeg').querySelector('[data-v="3d"]').textContent = val(m.cap3D) || '3D view';
    }

    App.rebuild = function (keepExample) {
      const c = $('controls');
      const scroll = $('controlsPanel').scrollTop;
      c.innerHTML = '';
      const m = App.mod();
      m.controls(c, C);
      // diagram options: the shared values switch first, then the module's own display switches (M.diagram)
      const dc = $('diagCtl');
      [...dc.children].forEach((x) => { if (x.id !== 'showPWrap') x.remove(); });
      if (typeof m.diagram === 'function') m.diagram(dc, C);
      if (!keepExample) { buildExamples(); }
      $('controlsPanel').scrollTop = scroll;
      const a = typeof m.anim === 'function' ? m.anim() : m.anim;
      if (!anim.playing) anim.set(a || null);
      App.update();
    };

    App.update = function () {
      const U = App.U(), m = App.mod();
      let res;
      try { res = m.compute(U); } catch (e) { console.error(e); res = Core.fail('Computation error: ' + e.message); }
      App.res = res;
      syncChrome();
      renderResults(res, U);
      renderDiagram();
      anim.refresh();
    };

    function renderPlot() {
      const m = App.mod(), U = App.U(), res = App.res, pp = $('plotPanel'), svg = $('svgPlot');
      let any = false;
      pp.classList.toggle('tall', !!(typeof m.plotTall === 'function' ? m.plotTall() : m.plotTall));
      if (m.plot && res && res.ok) {
        pp.hidden = false;
        try { any = !!m.plot(svg, res, U); } catch (e) { console.error(e); any = false; }
      }
      pp.hidden = !any;
      return any;
    }
    function renderDiagram() {
      const m = App.mod(), U = App.U(), res = App.res;
      const svg = $('svg2d'), cv = $('cv3d');
      if (App.view === '2d') {
        svg.removeAttribute('hidden'); cv.setAttribute('hidden', '');
        $('resetIso').hidden = true;
        if (!res.ok) emptyMsg(svg, res);
        else m.draw2D(svg, res, U, { showP: App.showP });
      } else {
        svg.setAttribute('hidden', ''); cv.removeAttribute('hidden');
        $('resetIso').hidden = false;
        view3d.clear();
        if (res.ok) m.draw3D(view3d, res, U, { showP: App.showP });
        view3d.render();
      }
      renderPlot();
    }
    function emptyMsg(svg, res) {
      const D = UI.Draw2D(svg, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 });
      svg._inv = null;
      const msg = '⚠ ' + (res.err && res.err[0] ? res.err[0] : 'Invalid input');
      const per = Math.max(30, Math.floor(D.W / 8)), words = msg.split(' '), lines = [''];
      words.forEach((w) => { if ((lines[lines.length - 1] + ' ' + w).length > per) lines.push(w); else lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + w; });
      lines.slice(0, 4).forEach((ln, i) => D.text([D.W / 2, D.H / 2 + (i - (Math.min(4, lines.length) - 1) / 2) * 20], ln, { px: true, anchor: 'middle', color: '#c0392b', size: 14 }));
    }

    const val = (o) => (typeof o.v === 'string' ? o.v : Core.fmt(o.v));
    function stepTable(tb) {
      return h('div', { class: 'st-tbl' }, h('table', null,
        h('tr', null, ...tb.head.map((c) => h('th', null, c))),
        ...tb.rows.map((r) => h('tr', null, ...r.map((c) => h('td', null, c))))));
    }
    function renderResults(res) {
      const pill = $('statusPill');
      pill.className = 'pill ' + (res.ok ? (res.status ? res.status.cls : 'ok') : 'bad');
      pill.textContent = res.ok ? (res.status ? res.status.text : 'OK') : '⚠ Invalid state';
      const msgs = $('msgs'); msgs.innerHTML = '';
      (res.err || []).forEach((e) => msgs.append(h('div', { class: 'msg err' }, '⛔ ' + e)));
      (res.warn || []).forEach((w) => msgs.append(h('div', { class: 'msg warn' }, '⚠ ' + w)));
      const t = $('results'); t.innerHTML = '';
      (res.out || []).forEach((o) => t.append(h('tr', { class: o.hl ? 'hl' : '' }, h('td', null, o.k), h('td', { class: 'v' }, val(o)), h('td', { class: 'u' }, o.u || ''))));
      const ol = $('steps'); ol.innerHTML = '';
      (res.steps || []).forEach((s) => {
        ol.append(h('li', null,
          h('div', { class: 'st-t' }, s.t),
          s.n ? h('div', { class: 'st-n' }, s.n) : null,
          s.f ? h('div', { class: 'st-f' }, s.f) : null,
          s.s ? h('div', { class: 'st-s' }, s.s) : null,
          s.table ? stepTable(s.table) : null,
          s.r ? h('div', { class: 'st-r' }, '⇒ ' + s.r) : null));
      });
    }

    App.solutionText = function () {
      const res = App.res; if (!res) return '';
      const m = App.mod(), U = App.U();
      let txt = `${TITLE} by CEM Jumawan — ${App.name}: ${m.title} (${U.name})\n\n`;
      (res.err || []).forEach((e) => (txt += `ERROR: ${e}\n`));
      (res.warn || []).forEach((e) => (txt += `WARNING: ${e}\n`));
      txt += 'RESULTS\n';
      (res.out || []).forEach((o) => (txt += `  ${o.k}: ${val(o)} ${o.u || ''}\n`));
      txt += '\nSOLUTION\n';
      (res.steps || []).forEach((s, i) => {
        txt += `${i + 1}. ${s.t}\n`;
        if (s.n) txt += `   (${s.n})\n`;
        if (s.f) txt += `   ${s.f}\n`;
        if (s.s) txt += `   ${s.s}\n`;
        if (s.table) { txt += `   ${s.table.head.join(' | ')}\n`; s.table.rows.forEach((r) => (txt += `   ${r.join(' | ')}\n`)); }
        if (s.r) txt += `   => ${s.r}\n`;
      });
      return txt;
    };
    $('copySol').addEventListener('click', async () => {
      const txt = App.solutionText(); if (!txt) return;
      const btn = $('copySol');
      try { await navigator.clipboard.writeText(txt); btn.textContent = 'Copied ✓'; }
      catch (e) {
        const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = txt; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); btn.textContent = 'Copied ✓'; } catch (e2) { btn.textContent = 'Copy failed'; }
        ta.remove();
      }
      setTimeout(() => (btn.textContent = 'Copy solution'), 1500);
    });

    function syncUnits() { const u = App.mod().units; $('uSI').setAttribute('aria-pressed', u === 'SI'); $('uUS').setAttribute('aria-pressed', u === 'US'); }
    /* Switching units converts the current values, so the problem stays the same problem. */
    function setUnits(u) {
      const m = App.mod();
      if (u === m.units) return;
      const from = m.units; m.units = u;
      if (m.onUnits) m.onUnits(from, u);
      syncUnits(); App.rebuild(true);
    }
    App.setUnits = setUnits;
    $('uSI').addEventListener('click', () => setUnits('SI'));
    $('uUS').addEventListener('click', () => setUnits('US'));
    $('showP').addEventListener('change', (e) => { App.showP = e.target.checked; renderDiagram(); });
    try { if (localStorage.getItem('diagOptsClosed') === '1') $('diagOpts').open = false; } catch (e) { /* storage blocked */ }
    $('diagOpts').addEventListener('toggle', () => { try { localStorage.setItem('diagOptsClosed', $('diagOpts').open ? '0' : '1'); } catch (e) { /* storage blocked */ } });
    App.setView = function (v) {
      App.view = v;
      $('viewSeg').querySelectorAll('button').forEach((x) => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      renderDiagram();
    };
    $('viewSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => App.setView(b.dataset.v)));
    $('resetIso').addEventListener('click', () => view3d.reset());

    /* Pointer on the 2D diagram: a module may offer a drag (onDrag) or a click (onClick). */
    (function () {
      const svg = $('svg2d');
      let dragging = false;
      const world = (e) => {
        if (!svg._inv) return null;
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        return svg._inv(loc.x, loc.y);
      };
      svg.addEventListener('pointerdown', (e) => {
        const m = App.mod(); if (!m.onDrag || !App.res || !App.res.ok) return;
        const p = world(e); if (!p) return;
        anim.stop();
        if (m.onDrag(p, 'down', App.res)) { dragging = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} App.update(); e.preventDefault(); }
      });
      svg.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const p = world(e); if (p && App.mod().onDrag(p, 'move', App.res)) App.update();
      });
      const end = () => { if (!dragging) return; dragging = false; App.rebuild(true); };
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
      svg.addEventListener('click', (e) => {
        const m = App.mod(); if (!m.onClick || !App.res || !App.res.ok) return;
        const p = world(e); if (p && m.onClick(p, App.res)) App.rebuild(true);
      });
    })();

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderDiagram, 80); });

    /* PDF of the current solution: 2D diagram, charts and 3D view at 4×, always in the light palette. */
    App.reportData = async function () {
      const res = App.res || {}, m = App.mod(), U = App.U();
      const pick = (x) => (typeof x === 'function' ? x.call(m) : x);
      const was = App.view;
      anim.stop();
      let p2d, p3d, pPlot = null;
      try {
        App.view = '2d'; renderDiagram(); p2d = root.SolutionPDF.svgToPng($('svg2d'));
        if (!$('plotPanel').hidden) pPlot = root.SolutionPDF.svgToPng($('svgPlot'));
        App.view = '3d';
        let hi = false;
        try { Object.defineProperty(root, 'devicePixelRatio', { value: 4, configurable: true }); hi = true; } catch (e) { hi = false; }
        try { renderDiagram(); p3d = root.SolutionPDF.canvasToPng($('cv3d')); }
        finally { if (hi) { try { delete root.devicePixelRatio; } catch (e) {} } }
      } finally { App.view = was; renderDiagram(); }
      const images = [{ cap: pick(m.cap2D) || '2D diagram', src: await p2d }];
      if (pPlot) images.push({ cap: pick(m.plotCaption) || 'Charts', src: await pPlot });
      images.push({ cap: pick(m.cap3D) || '3D view', src: p3d });
      return {
        app: App.name, module: m.title, mode: $('statusPill').textContent, units: U.name,
        images,
        warnings: (res.err || []).map((e) => ({ lvl: 'err', text: e })).concat((res.warn || []).map((w) => ({ lvl: 'warn', text: w }))),
        results: (res.out || []).map((o) => ({ k: o.k, v: val(o), u: o.u || '', em: o.hl })),
        steps: (res.steps || []).map((s) => ({ t: s.t, f: s.f, s: s.s, r: s.r, n: s.n, table: s.table, rPrefix: '⇒ ' })),
        filename: `${cfg.key === 'st' ? 'statics' : cfg.key === 'dy' ? 'dynamics' : 'deformable-bodies'}-${root.SolutionPDF.slug(m.title)}.pdf`,
      };
    };
    if (root.SolutionPDF) root.SolutionPDF.wire($('pdfSol'), App.reportData);

    syncUnits();
    buildTabs();
    App.rebuild();
    return App;
  }

  root.MOB = { start };
})(window);
