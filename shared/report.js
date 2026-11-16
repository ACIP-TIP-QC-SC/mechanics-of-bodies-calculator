/* =====================================================================
 * SolutionPDF — shared by every solver. Builds a printable report of the
 * current solution (header, diagram, results, worked steps), renders it
 * with html2canvas, paginates it on A4 with jsPDF (page breaks fall
 * between blocks) and hands the file to the viewer.
 * ===================================================================== */
(function (root) {
  'use strict';
  const CSS = `
    .sp-rep{position:fixed;left:-10000px;top:0;width:800px;background:#fff;color:#15242d;font:14px/1.45 "Source Sans 3","Segoe UI",system-ui,sans-serif;padding:0}
    .sp-rep *{box-sizing:border-box}
    .sp-blk{padding:6px 34px}
    .sp-hd{display:flex;align-items:center;gap:16px;padding-top:30px;border-bottom:3px solid #d4612a;padding-bottom:12px}
    .sp-hd img{width:70px;height:70px;object-fit:contain}
    .sp-hd h1{margin:0;font:700 28px/1.05 "Barlow Condensed","Arial Narrow",Arial,sans-serif}
    .sp-hd p.by{margin-top:1px;color:#d4612a;font-weight:600}
    .sp-hd p{margin:4px 0 0;font:500 15px "Barlow Condensed","Arial Narrow",Arial,sans-serif;color:#5a6b75;letter-spacing:.03em}
    .sp-meta{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#5a6b75;padding-top:10px}
    .sp-meta b{color:#15242d;font:600 20px "Barlow Condensed","Arial Narrow",Arial,sans-serif}
    .sp-ph{margin:0 auto;border:1px solid #d3dce0;background:#fbfcfd}
    .sp-cap{font:600 13px "Barlow Condensed","Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.1em;color:#5a6b75;margin:8px 0 4px}
    .sp-h2{font:600 13px "Barlow Condensed","Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.1em;color:#5a6b75;margin:10px 0 4px}
    .sp-w{border-left:4px solid;border-radius:5px;padding:6px 10px;font-size:13px;margin:3px 0}
    .sp-w.err{background:#fde8e6;color:#a3281f}.sp-w.warn{background:#fff3d9;color:#8a5a00}.sp-w.info{background:#e6f1f9;color:#1f5f8f}
    .sp-res{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
    .sp-res td{padding:3px 0;border-bottom:1px solid #e1e7ea}
    .sp-res td.v{text-align:right;font:13px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;padding-left:8px;white-space:nowrap}
    .sp-res td.u{font:11px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;color:#5a6b75;padding-left:6px;white-space:nowrap;width:70px}
    .sp-res tr.em td{font-weight:700}.sp-res tr.em td.v{color:#d4612a}
    .sp-st{display:grid;grid-template-columns:28px 1fr;gap:0 6px;border-top:1px solid #e1e7ea;padding:7px 0}
    .sp-st .n{width:22px;height:22px;border-radius:50%;background:#e8eef1;font:600 11px/22px "JetBrains Mono",monospace;text-align:center}
    .sp-st .t{font-weight:700}
    .sp-st .f,.sp-st .s{font:12px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;overflow-wrap:anywhere}
    .sp-st .s{color:#5a6b75}.sp-st .r{font:600 12.5px "JetBrains Mono",monospace;color:#d4612a}
    .sp-st .no{font-size:12px;color:#5a6b75;font-style:italic}
    .sp-st table{border-collapse:collapse;font:11px "JetBrains Mono",monospace;margin-top:4px}
    .sp-st th,.sp-st td{padding:1px 6px;border-bottom:1px solid #e1e7ea;text-align:right}.sp-st th{color:#5a6b75;font-weight:600}
    .sp-ft{font-size:11px;color:#5a6b75;text-align:center;padding:14px 34px 26px}`;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; }

  function build(o) {
    if (!document.getElementById('sp-style')) { const s = el('style'); s.id = 'sp-style'; s.textContent = CSS; document.head.appendChild(s); }
    const rep = el('div', 'sp-rep');
    const hd = el('div', 'sp-blk sp-hd');
    const img = el('img'); img.src = o.logo || '../logo.png'; img.alt = '';
    const tt = el('div'); const h1 = el('h1', null, 'Mechanics of Rigid and Deformable Bodies Calculator');
    tt.append(h1, el('p', null, 'American Concrete Institute Philippines T.I.P. QC Student Chapter'), el('p', 'by', 'by CEM Jumawan'));
    hd.append(img, tt); rep.append(hd);
    const meta = el('div', 'sp-blk sp-meta');
    const left = el('div'); left.append(el('b', null, o.module)); left.append(el('div', null, `${o.app}${o.mode ? ' · ' + o.mode : ''} · ${o.units}`));
    meta.append(left, el('div', null, new Date().toLocaleString()));
    rep.append(meta);
    (o.images || []).forEach((it) => {
      if (!it || !it.src) return;
      const b = el('div', 'sp-blk sp-img'); if (it.cap) b.append(el('div', 'sp-cap', it.cap));
      // An empty frame of the image's shape; the image itself is placed into the PDF at full resolution.
      const box = el('div', 'sp-ph'); const W = 732, maxH = 860;
      let w = W, h = W * it.h / it.w; if (h > maxH) { w = W * maxH / h; h = maxH; }
      box.style.width = w + 'px'; box.style.height = h + 'px'; box._img = it; b.append(box); rep.append(b);
    });
    if (o.warnings && o.warnings.length) {
      const b = el('div', 'sp-blk'); b.append(el('div', 'sp-h2', 'Checks & warnings'));
      o.warnings.forEach((w) => b.append(el('div', 'sp-w ' + (w.lvl || 'warn'), w.text))); rep.append(b);
    }
    if (o.results && o.results.length) {
      const b = el('div', 'sp-blk'); b.append(el('div', 'sp-h2', 'Results'));
      const t = el('table', 'sp-res');
      o.results.forEach((r) => { const tr = el('tr', r.em ? 'em' : ''); tr.append(el('td', null, r.k), el('td', 'v', r.v), el('td', 'u', r.u)); t.append(tr); });
      b.append(t); rep.append(b);
    }
    const sh = el('div', 'sp-blk'); sh.append(el('div', 'sp-h2', 'Step-by-step solution')); rep.append(sh);
    (o.steps || []).forEach((s, i) => {
      const b = el('div', 'sp-blk'); const row = el('div', 'sp-st');
      const body = el('div'); body.append(el('div', 't', s.t));
      if (s.f) body.append(el('div', 'f', s.f));
      if (s.s) body.append(el('div', 's', s.s));
      if (s.table) { const t = el('table'); const tr = el('tr'); s.table.head.forEach((h) => tr.append(el('th', null, h))); t.append(tr); s.table.rows.forEach((r) => { const rr = el('tr'); r.forEach((c) => rr.append(el('td', null, c))); t.append(rr); }); body.append(t); }
      if (s.r) body.append(el('div', 'r', (s.rPrefix || '= ') + s.r));
      if (s.n) body.append(el('div', 'no', s.n));
      row.append(el('div', 'n', String(i + 1)), body); b.append(row); rep.append(b);
    });
    rep.append(el('div', 'sp-ft', 'Generated by Mechanics of Rigid and Deformable Bodies Calculator by CEM Jumawan · values rounded to 4 significant figures'));
    document.body.appendChild(rep);
    return rep;
  }

  /** Hand the PDF to the viewer. Returns {status: saved|declined|failed, code?}. */
  async function save(filename, blob) {
    const P = (root.parent && root.parent !== root) ? root.parent : null;
    let res = null;
    // The top-level page owns the viewer's download permission.
    try { if (P && typeof P.MOB_save === 'function') res = await P.MOB_save(filename, blob); } catch (e) { res = { status: 'failed', code: (e && e.code) || 'error' }; }
    if (res && (res.status === 'saved' || res.status === 'declined')) return res;
    // No download permission here (or it failed): try a plain download link, from the top page first.
    try { if (P && typeof P.MOB_link === 'function' && P.MOB_link(filename, blob)) return { status: 'saved', via: 'link', code: res && res.code }; } catch (e) { /* fall through */ }
    try {
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000); return { status: 'saved', via: 'link', code: res && res.code };
    } catch (e) { return { status: 'failed', code: (res && res.code) || 'error' }; }
  }

  /** Diagonal blue "ACIP T.I.P. QC SC" watermark across the page, drawn over the content at low opacity. */
  const WM = 'ACIP T.I.P. QC SC';
  function watermark(pdf, pw, ph) {
    const ang = Math.atan2(ph, pw) * 180 / Math.PI, r = ang * Math.PI / 180; // along the page diagonal
    let gs = false;
    try { if (pdf.GState && pdf.setGState) { pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: 0.11 })); gs = true; } } catch (e) { gs = false; }
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(gs ? 0 : 214, gs ? 84 : 228, gs ? 166 : 245);
    pdf.setFontSize(100);
    const size = 100 * (0.78 * Math.hypot(pw, ph)) / pdf.getTextWidth(WM); pdf.setFontSize(size);
    const tw = pdf.getTextWidth(WM);
    // start point so the text's centre sits on the page centre
    const x = pw / 2 - (tw / 2) * Math.cos(r) + (size * 0.35) * Math.sin(r);
    const y = ph / 2 + (tw / 2) * Math.sin(r) + (size * 0.35) * Math.cos(r);
    pdf.text(WM, x, y, { angle: ang });
    if (gs) pdf.restoreGraphicsState();
    pdf.setFont('helvetica', 'normal');
  }

  /** Re-encode a diagram as a high-quality JPEG: jsPDF embeds JPEG as-is, so big images stay quick. */
  function toJpeg(im) { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.fillStyle = '#fbfcfd'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); return c.toDataURL('image/jpeg', 0.96); } catch (e) { return null; } }
  /** Load a data-URL image so its pixel size is known. */
  function dims(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, im }); im.onerror = () => res(null); im.src = src; }); }

  async function make(o) {
    if (!root.html2canvas || !root.jspdf) throw new Error('PDF library did not load');
    const imgs = [];
    for (const it of (o.images || [])) {
      const src = it && typeof it === 'object' ? it.src : it; if (!src) continue;
      const d = await dims(src); if (d) { const j = toJpeg(d.im); imgs.push({ src: j || src, fmt: j ? 'JPEG' : 'PNG', cap: it.cap, w: d.w, h: d.h }); }
    }
    const rep = build(Object.assign({}, o, { images: imgs }));
    try {
      await Promise.all([...rep.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const scale = 3;
      const canvas = await root.html2canvas(rep, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 800 });
      const { jsPDF } = root.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      const k = pw / 800; // pt per css px
      const pageCss = ph / k;
      const repTop = rep.getBoundingClientRect().top;
      const cuts = [...rep.children].map((c) => c.getBoundingClientRect().bottom - repTop);
      const boxes = [...rep.querySelectorAll('.sp-ph')].map((bx) => { const r = bx.getBoundingClientRect(); return { img: bx._img, x: r.left - rep.getBoundingClientRect().left + 1, y: r.top - repTop + 1, w: r.width - 2, h: r.height - 2 }; });
      const total = rep.scrollHeight;
      let y0 = 0, first = true;
      while (y0 < total - 1) {
        let y1 = y0 + pageCss;
        if (y1 < total) { const fit = cuts.filter((c) => c > y0 + 40 && c <= y1); if (fit.length) y1 = fit[fit.length - 1]; } else y1 = total;
        const sc = document.createElement('canvas');
        sc.width = canvas.width; sc.height = Math.max(1, Math.round((y1 - y0) * scale));
        const cx = sc.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, sc.width, sc.height);
        cx.drawImage(canvas, 0, Math.round(y0 * scale), canvas.width, sc.height, 0, 0, canvas.width, sc.height);
        if (!first) pdf.addPage();
        pdf.addImage(sc.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, (y1 - y0) * k);
        boxes.filter((bx) => bx.y >= y0 - 1 && bx.y + bx.h <= y1 + 1).forEach((bx) => {
          pdf.addImage(bx.img.src, bx.img.fmt, bx.x * k, (bx.y - y0) * k, bx.w * k, bx.h * k, undefined, 'FAST');
        });
        first = false; y0 = y1;
      }
      const n = pdf.getNumberOfPages();
      for (let i = 1; i <= n; i++) { pdf.setPage(i); watermark(pdf, pw, ph); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`Page ${i} of ${n}`, pw - 40, ph - 14, { align: 'right' }); }
      const blob = pdf.output('blob');
      return await save(o.filename, blob);
    } finally { rep.remove(); }
  }

  /** Snapshot an inline SVG (with its CSS label halo) as a PNG data URL. */
  function svgToPng(svg, scale) {
    const f = scale || 4;
    return new Promise((resolve) => {
      try {
        const w = svg.clientWidth || 800, h = svg.clientHeight || 560;
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', w); clone.setAttribute('height', h);
        const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        st.textContent = '.lbl{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;font-family:"Source Sans 3",system-ui,sans-serif}';
        clone.insertBefore(st, clone.firstChild);
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#fbfcfd');
        clone.insertBefore(bg, st.nextSibling);
        const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
        const im = new Image();
        im.onload = () => { const c = document.createElement('canvas'); c.width = w * f; c.height = h * f; const x = c.getContext('2d'); x.scale(f, f); x.drawImage(im, 0, 0, w, h); resolve(c.toDataURL('image/png')); };
        im.onerror = () => resolve(null);
        im.src = src;
      } catch (e) { resolve(null); }
    });
  }
  function canvasToPng(cv) { try { if (!cv || !cv.width) return null; const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.fillStyle = '#fbfcfd'; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, 0, 0); return c.toDataURL('image/png'); } catch (e) { return null; } }

  /** Wire a button: runs `collect()` → report options, shows progress on the button. */
  function wire(btn, collect) {
    if (!btn) return;
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Preparing PDF…';
      let msg = 'Saved ✓';
      try {
        const r = (await make(await collect())) || {};
        if (r.code) console.warn('PDF save:', r.code);
        if (r.status === 'declined') msg = 'Cancelled';
        else if (r.via === 'link') msg = 'Download started';
        else if (r.status === 'failed') msg = r.code === 'extension_not_enabled' ? 'PDF saving is off here' : 'Could not save (' + (r.code || 'error') + ')';
      } catch (e) { console.error(e); msg = 'PDF failed'; }
      btn.textContent = msg;
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, msg.length > 12 ? 4000 : 1800);
    });
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  root.SolutionPDF = { make, wire, svgToPng, canvasToPng, slug };
})(window);
