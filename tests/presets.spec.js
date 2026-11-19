/* Preset sweep in a headless browser. Run: node tests/presets.spec.js [--shots dir] [--only st|dy|md] [--mod id]
 * Starts a local static server, opens every discipline that is built and, for every module and
 * preset, in the 2D and the 3D view, checks: no console errors, no NaN / undefined / blank values,
 * the diagram has content, "Test" presets match their expected values (0.5 %), and presets
 * marked `fails` show their error. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
/* --only dy runs one discipline, --mod rect one module (while working on it); the full sweep runs everything. */
const DISCIPLINES = ['st', 'dy', 'md'].filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html')) && (!arg('--only') || arg('--only') === d));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const shotsAt = process.argv.indexOf('--shots'), SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = []; let checks = 0, failures = 0;
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const bad = (msg) => { failures++; console.log('  FAIL ' + msg); };
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  for (const d of DISCIPLINES) {
    await page.goto(`${base}/${d}/index.html`);
    await page.waitForFunction(() => window.App && window.App.res);
    // a script that fails to load drops its module silently, so loading must be clean
    if (errors.length) bad(`${d}: error while loading the page: ${errors[0]}`);
    errors.length = 0;
    const mods = await page.evaluate(() => Object.values(App.modules).map((m) => ({ id: m.id, title: m.title, presets: m.presets.map((p) => ({ name: p.name, fails: !!p.fails, expect: p.expect || [] })) })));
    for (const m of mods) {
      if (arg('--mod') && arg('--mod') !== m.id) continue;
      console.log(`${d} / ${m.title}: ${m.presets.length} presets`);
      if (m.presets.filter((p) => /^Test/.test(p.name)).length < 3) bad(`${m.title}: fewer than three "Test" presets`);
      for (let i = 0; i < m.presets.length; i++) {
        const pr = m.presets[i], tag = `${m.title} › ${pr.name}`;
        for (const view of ['2d', '3d']) {
          errors.length = 0;
          const r = await page.evaluate(([id, i, view]) => {
            App.active = id; App.loadPreset(i); App.setView(view);
            const res = App.res, txt = document.getElementById('right').innerText;
            const svg = document.getElementById('svg2d'), cv = document.getElementById('cv3d');
            let ink = 0;
            if (view === '2d') ink = svg.querySelectorAll('*').length;
            else { const c = cv.getContext('2d'), w = cv.width, h = cv.height, dd = c.getImageData(0, 0, w, h).data; for (let k = 3; k < dd.length; k += 4 * 97) if (dd[k]) ink++; }
            return { ok: res.ok, err: res.err, out: (res.out || []).map((o) => ({ k: o.k, v: o.v })), steps: (res.steps || []).length, txt, ink,
              svgText: view === '2d' ? svg.textContent : '', pill: document.getElementById('statusPill').textContent, sol: App.solutionText() };
          }, [m.id, i, view]);
          checks++;
          if (errors.length) bad(`${tag} [${view}]: console error: ${errors[0]}`);
          if (/NaN|undefined|Infinity|\[object/.test(r.txt + r.svgText + r.sol)) bad(`${tag} [${view}]: NaN / undefined in the page`);
          if (pr.fails) {
            if (r.ok || !r.err.length || !/Invalid state/.test(r.pill)) bad(`${tag}: expected to fail, but it did not`);
          } else {
            if (!r.ok) bad(`${tag} [${view}]: ${r.err.join(' | ')}`);
            if (!r.out.length || r.steps < 3) bad(`${tag}: results or steps are missing`);
            if (r.out.some((o) => o.v === '' || o.v === null || (typeof o.v === 'number' && !isFinite(o.v)))) bad(`${tag}: blank value in the results`);
            if (r.ink < (view === '2d' ? 12 : 40)) bad(`${tag} [${view}]: the diagram is empty`);
            for (const e of pr.expect) {
              const o = r.out.find((x) => x.k === e.k);
              if (!o) bad(`${tag}: result "${e.k}" not found`);
              else if (Math.abs(o.v - e.v) > 0.005 * Math.max(Math.abs(e.v), 1e-9) + (e.v === 0 ? 1e-9 : 0)) bad(`${tag}: ${e.k} = ${o.v}, expected ${e.v}`);
            }
            if (/^Test/.test(pr.name) && !pr.expect.length) bad(`${tag}: a "Test" preset needs expected values`);
          }
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${d}-${m.id}-${String(i + 1).padStart(2, '0')}-${view}.png`) });
        }
        // switching units and back must keep the results
        if (!pr.fails) {
          const rt = await page.evaluate(([id, i]) => {
            App.active = id; App.loadPreset(i); App.setView('2d');
            const a = App.res.out.map((o) => o.v), u = App.units;
            App.setUnits(u === 'SI' ? 'US' : 'SI'); const mid = App.res.ok;
            App.setUnits(u); const b = App.res.out.map((o) => o.v);
            return { mid, same: a.length === b.length && a.every((v, k) => typeof v !== 'number' || Math.abs(v - b[k]) <= 2e-4 * Math.max(1, Math.abs(v))) };
          }, [m.id, i]);
          checks++;
          if (!rt.mid || !rt.same) bad(`${tag}: switching units changed the problem`);
        }
      }
    }
  }
  await browser.close(); srv.close();
  console.log(`\n${checks} preset checks, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
