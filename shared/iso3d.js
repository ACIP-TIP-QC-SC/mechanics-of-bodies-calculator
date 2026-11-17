/* =====================================================================
 * Tiny isometric / orthographic 3D renderer on <canvas>.
 * - Painter's algorithm with flat shading, translucent faces.
 * - Mouse drag = rotate, wheel = zoom, reset() = standard isometric view
 *   (yaw 45°, pitch 35.264° → the x and z axes project at 30° to horizontal).
 * World axes: x = right, y = up, z = toward the viewer (depth of the section).
 * ===================================================================== */
(function (root) {
  'use strict';
  const ISO_YAW = 45, ISO_PITCH = 35.264;

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  class View3D {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.faces = []; this.lines = []; this.labels = []; this.dims = [];
      this.center = [0, 0, 0]; this.radius = 1;
      this.reset(false);
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.yaw = drag.yaw - (e.clientX - drag.x) * 0.4;
        this.pitch = Math.max(-89, Math.min(89, drag.pitch + (e.clientY - drag.y) * 0.4));
        this.render();
      });
      const end = () => { drag = null; };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom = Math.max(0.3, Math.min(5, this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        this.render();
      }, { passive: false });
    }
    reset(r = true) { this.yaw = ISO_YAW; this.pitch = ISO_PITCH; this.zoom = 1; if (r) this.render(); }
    clear() { this.faces = []; this.lines = []; this.labels = []; this.dims = []; }

    /* ---------- scene building ---------- */
    /** layer: faces in a lower layer are always painted first (use -1 for floors and ground slabs). It may also be a
     *  function of facing(n) (> 0 when the normal n points toward the viewer), so that a solid something rests on is
     *  painted first when the contact plane faces the viewer and last when it faces away (see View3D.restLayer).
     *  out: the outward normal of a face on a closed solid; a face turned away from the viewer is then skipped. */
    face(pts, fill, alpha = 1, stroke = null, lw = 1, layer = 0, out = null) { this.faces.push({ pts, fill, alpha, stroke, lw, layer, out }); }
    line(pts, color = '#222', lw = 1.5, dash = null) { this.lines.push({ pts, color, lw, dash }); }
    label(p, text, color = '#111') { this.labels.push({ p, text, color }); }
    /** Dimension line between 3D points a and b, shifted by the 3D offset vector `off`. */
    dim(a, b, text, off = [0, 0, 0], color = '#34495e') {
      const sh = (p) => [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
      this.dims.push({ a, b, a2: sh(a), b2: sh(b), text, color });
    }

    box(x0, y0, z0, x1, y1, z1, fill, alpha = 1, stroke = '#333', opts = {}) {
      const P = (x, y, z) => [x, y, z];
      const f = [
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], // back z0
        [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], // front z1
        [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], // left
        [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], // right
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], // bottom
        [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], // top
      ];
      const sx = Math.sign(x1 - x0) || 1, sy = Math.sign(y1 - y0) || 1, sz = Math.sign(z1 - z0) || 1, closed = !opts.noTop;
      const N = [[0, 0, -sz], [0, 0, sz], [-sx, 0, 0], [sx, 0, 0], [0, -sy, 0], [0, sy, 0]];
      f.forEach((q, i) => { if (opts.noTop && i === 5) return; this.face(q, fill, alpha, stroke, 1, opts.layer || 0, closed ? N[i] : null); });
    }
    /** Extrude a 2D polygon in the x–y plane between z0 and z1. */
    extrude(poly, z0, z1, fill, alpha = 1, stroke = null, opts = {}) {
      const n = poly.length;
      if (n < 2) return;
      const closed = opts.caps !== false && !opts.open && n >= 3, sz = Math.sign(z1 - z0) || 1;
      let A2 = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; A2 += a[0] * b[1] - b[0] * a[1]; }
      const ccw = A2 >= 0;
      if (opts.caps !== false && n >= 3) {
        this.face(poly.map((p) => [p[0], p[1], z0]), fill, alpha, stroke, 1, opts.layer || 0, closed ? [0, 0, -sz] : null);
        this.face(poly.map((p) => [p[0], p[1], z1]), fill, alpha, stroke, 1, opts.layer || 0, closed ? [0, 0, sz] : null);
      }
      const m = opts.open ? n - 1 : n;
      for (let i = 0; i < m; i++) {
        const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 1e-9) continue;
        const out = closed ? (ccw ? [dy / L, -dx / L, 0] : [-dy / L, dx / L, 0]) : null;
        this.face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], fill, alpha, opts.sideStroke === undefined ? stroke : opts.sideStroke, 1, opts.layer || 0, out);
      }
    }
    /** Extrude a polygon given in the x–z plane between heights y0 and y1. */
    extrudeY(poly, y0, y1, fill, alpha = 1, stroke = null) {
      const n = poly.length;
      this.face(poly.map((p) => [p[0], y0, p[1]]), fill, alpha, stroke);
      this.face(poly.map((p) => [p[0], y1, p[1]]), fill, alpha, stroke);
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        this.face([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], fill, alpha, stroke);
      }
    }
    /** Revolve a profile [[r, y], …] about the vertical axis through (cx, cz). */
    lathe(profile, fill, alpha = 1, stroke = null, seg = 40, cx = 0, cz = 0, opts = {}) {
      const n = profile.length;
      const m = opts.open ? n - 1 : n;
      // a point inside the profile, revolved with each face, tells which way is out
      const rc = profile.reduce((a, p) => a + p[0], 0) / n, yc = profile.reduce((a, p) => a + p[1], 0) / n;
      for (let j = 0; j < seg; j++) {
        const t0 = (j / seg) * 2 * Math.PI, t1 = ((j + 1) / seg) * 2 * Math.PI;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        for (let i = 0; i < m; i++) {
          const a = profile[i], b = profile[(i + 1) % n];
          if (Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9) continue;
          const q = [[cx + a[0] * c0, a[1], cz + a[0] * s0], [cx + b[0] * c0, b[1], cz + b[0] * s0], [cx + b[0] * c1, b[1], cz + b[0] * s1], [cx + a[0] * c1, a[1], cz + a[0] * s1]];
          let out = null;
          if (!opts.open) {
            const nn = faceNormal(q), tm = (t0 + t1) / 2, I = [cx + rc * Math.cos(tm), yc, cz + rc * Math.sin(tm)], Q = q.reduce((acc, p) => [acc[0] + p[0] / 4, acc[1] + p[1] / 4, acc[2] + p[2] / 4], [0, 0, 0]);
            out = dot(nn, [Q[0] - I[0], Q[1] - I[1], Q[2] - I[2]]) < 0 ? nn.map((v) => -v) : nn;
          }
          this.face(q, fill, alpha, stroke, 1, 0, out);
        }
      }
    }
    circle(cx, y, cz, r, color, lw = 2, n = 48) {
      const pts = [];
      for (let i = 0; i <= n; i++) { const t = (i / n) * 2 * Math.PI; pts.push([cx + r * Math.cos(t), y, cz + r * Math.sin(t)]); }
      this.line(pts, color, lw);
    }
    setBounds(min, max) {
      this.center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
      this.radius = Math.max(1e-6, 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]));
    }
    autoBounds() {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      const upd = (p) => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); } };
      this.faces.forEach((f) => f.pts.forEach(upd));
      this.lines.forEach((l) => l.pts.forEach(upd));
      this.dims.forEach((d) => [d.a2, d.b2].forEach(upd));
      if (isFinite(mn[0])) this.setBounds(mn, mx);
    }

    /* ---------- projection & render ---------- */
    project(p) {
      const y = (this.yaw * Math.PI) / 180, t = (this.pitch * Math.PI) / 180;
      const x0 = p[0] - this.center[0], y0 = p[1] - this.center[1], z0 = p[2] - this.center[2];
      const X = x0 * Math.cos(y) - z0 * Math.sin(y);
      const Z = x0 * Math.sin(y) + z0 * Math.cos(y);
      const Y2 = y0 * Math.cos(t) - Z * Math.sin(t);
      const Z2 = y0 * Math.sin(t) + Z * Math.cos(t);
      return [this.ox + X * this.sc, this.oy - Y2 * this.sc, Z2];
    }
    render() {
      const cv = this.cv, dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round'; // mitred joins on thin pieces and label halos leave spikes
      this.ox = w / 2; this.oy = h / 2;
      this.sc = ((Math.min(w, h) * 0.46) / this.radius) * this.zoom;
      const L = norm([0.35, 0.85, 0.45]);
      const yawR = (this.yaw * Math.PI) / 180, pr = (this.pitch * Math.PI) / 180;
      const cy = Math.cos(yawR), sy = Math.sin(yawR), cpp = Math.cos(pr), spp = Math.sin(pr);
      const facing = (n) => n[1] * spp + (n[0] * sy + n[2] * cy) * cpp; // > 0: the normal points toward the viewer
      // Painter's algorithm: big faces are cut into small pieces, and edges into short segments, so that sorting by
      // depth stays right where solids touch or pass in front of large faces; faces turned away are skipped.
      const maxL = this.radius * 0.12, items = [], useLayer = this.pitch >= 0; // from below, floors are sorted like everything else
      const pz = (pts) => { let z = 0; const pp = pts.map((p) => { const q = this.project(p); z += q[2]; return q; }); return { pp, z: z / pts.length }; };
      for (const f of this.faces) {
        if (f.out && f.alpha >= 0.99 && facing(f.out) < -1e-9) continue;
        if (!f._nrm) f._nrm = f.out || faceNormal(f.pts);
        const shade = 0.62 + 0.38 * Math.abs(dot(f._nrm, L)), layer = typeof f.layer === 'function' ? f.layer(facing) : useLayer ? f.layer || 0 : 0;
        if (f._maxL !== maxL) { f._sub = f.alpha >= 0.99 ? splitFace(f.pts, maxL) : null; f._maxL = maxL; } // see-through faces stay whole (no seams)
        if (!f._sub) { const { pp, z } = pz(f.pts); items.push({ f, pp, z, shade, layer, stroke: true }); continue; }
        f._sub.forEach((pc) => { const { pp, z } = pz(pc.pts); items.push({ f, pp, z, shade, layer, seam: pc.inn.map(({ e, s0, s1 }) => [this.project(e[0]), this.project(e[1]), s0, s1]), bnd: f.stroke && pc.bnd.length ? pc.bnd.map((e) => [this.project(e[0]), this.project(e[1]), e[2], e[3]]) : null }); });
      }
      items.sort((a, b) => a.layer - b.layer || a.z - b.z);
      for (const it of items) {
        const { f, pp, shade } = it;
        ctx.beginPath();
        pp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        const [r, g, b] = hexToRgb(f.fill), col = `rgba(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)},${f.alpha})`;
        ctx.fillStyle = col;
        ctx.fill();
        if (it.seam && it.seam.length) {
          ctx.beginPath();
          it.seam.forEach(([a, b, s0, s1]) => {
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, c = Math.min(0.45, (f.lw * 0.5 + 0.4) / l);
            const ta = s0 && f.stroke ? c : 0, tb = s1 && f.stroke ? 1 - c : 1;
            ctx.moveTo(a[0] + (b[0] - a[0]) * ta, a[1] + (b[1] - a[1]) * ta); ctx.lineTo(a[0] + (b[0] - a[0]) * tb, a[1] + (b[1] - a[1]) * tb);
          }); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke(); }
        if (it.bnd) {
          // each outline piece runs a little past its ends along the same edge, over any corner of a neighbouring piece
          // that was painted later and clipped the line; at the face's own corners it stops
          ctx.beginPath();
          it.bnd.forEach(([a, b, ea, eb]) => {
            const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, x = Math.min(4, l) / l;
            ctx.moveTo(a[0] - (ea ? dx * x : 0), a[1] - (ea ? dy * x : 0)); ctx.lineTo(b[0] + (eb ? dx * x : 0), b[1] + (eb ? dy * x : 0));
          }); ctx.strokeStyle = f.stroke; ctx.lineWidth = f.lw; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, f.alpha + 0.35); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt'; }
        if (it.stroke && f.stroke) { ctx.strokeStyle = f.stroke; ctx.lineWidth = f.lw; ctx.globalAlpha = Math.min(1, f.alpha + 0.35); ctx.stroke(); ctx.globalAlpha = 1; }
      }
      for (const l of this.lines) {
        ctx.beginPath();
        l.pts.forEach((p, i) => { const q = this.project(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.strokeStyle = l.color; ctx.lineWidth = l.lw; ctx.setLineDash(l.dash || []); ctx.stroke(); ctx.setLineDash([]);
      }
      // dimension lines (drawn in screen space so arrowheads stay crisp)
      ctx.font = '600 11.5px system-ui, sans-serif';
      for (const d of this.dims) {
        const A = this.project(d.a), B = this.project(d.b), A2 = this.project(d.a2), B2 = this.project(d.b2);
        const L = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
        if (L < 3) continue;
        ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A2[0], A2[1]); ctx.moveTo(B[0], B[1]); ctx.lineTo(B2[0], B2[1]); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(A2[0], A2[1]); ctx.lineTo(B2[0], B2[1]); ctx.stroke();
        const ux = (B2[0] - A2[0]) / L, uy = (B2[1] - A2[1]) / L, hs = Math.min(8, L / 3);
        [[B2, ux, uy], [A2, -ux, -uy]].forEach(([P, vx, vy]) => {
          ctx.beginPath(); ctx.moveTo(P[0], P[1]);
          ctx.lineTo(P[0] - vx * hs - vy * hs * 0.4, P[1] - vy * hs + vx * hs * 0.4);
          ctx.lineTo(P[0] - vx * hs + vy * hs * 0.4, P[1] - vy * hs - vx * hs * 0.4); ctx.closePath(); ctx.fill();
        });
        const mx = (A2[0] + B2[0]) / 2, my = (A2[1] + B2[1]) / 2;
        const tw = ctx.measureText(d.text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(mx - tw / 2 - 3, my - 8, tw + 6, 15);
        ctx.fillStyle = d.color; ctx.textAlign = 'center'; ctx.fillText(d.text, mx, my + 4); ctx.textAlign = 'start';
      }
      ctx.font = '600 12px system-ui, sans-serif';
      // labels: nudged up or down, a line at a time, so that no two of them sit on top of each other
      const placed = [], hit = (x, y, w) => placed.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y - 12 < r.y && y > r.y - 12);
      for (const lb of this.labels) {
        const q = this.project(lb.p), w = ctx.measureText(lb.text).width;
        let x = Math.max(4, Math.min(q[0] + 4, cv.clientWidth - w - 4)), y = q[1] - 4;
        for (let k = 1; k <= 8 && hit(x, y, w); k++) { const dy = Math.ceil(k / 2) * 14 * (k % 2 ? 1 : -1); if (!hit(x, q[1] - 4 + dy, w)) { y = q[1] - 4 + dy; break; } }
        placed.push({ x, y, w });
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(lb.text, x, y);
        ctx.fillStyle = lb.color; ctx.fillText(lb.text, x, y);
      }
      // axis gizmo
      const gx = 46, gy = h - 40, s = 26;
      const ax = [[1, 0, 0, '#c0392b', 'x'], [0, 1, 0, '#27ae60', 'y'], [0, 0, 1, '#2c6fd1', 'z']];
      ax.forEach(([x, y, z, col, nm]) => {
        const X = x * Math.cos(yawR) - z * Math.sin(yawR), Z = x * Math.sin(yawR) + z * Math.cos(yawR);
        const Y2 = y * Math.cos(pr) - Z * Math.sin(pr);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + X * s, gy - Y2 * s); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = col; ctx.fillText(nm, gx + X * s * 1.2 - 3, gy - Y2 * s * 1.2 + 4);
      });
      ctx.fillStyle = '#667'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`yaw ${this.yaw.toFixed(0)}°  pitch ${this.pitch.toFixed(0)}°  — drag to rotate, wheel to zoom`, 10, 18);
    }
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** A convex face larger than maxL cut into pieces no larger than maxL, each with the parts of the face's outline
   *  it carries ({pts, bnd}); null when the face is small enough (or not convex). */
  function splitFace(pts, maxL) {
    const n = pts.length;
    let big = false; for (let i = 0; i < n; i++) if (len3(sub3(pts[(i + 1) % n], pts[i])) > maxL) { big = true; break; }
    if (!big || n < 3 || !convex(pts)) return null;
    // each piece keeps its edges on the face outline (bnd, drawn as the outline) apart from the inner ones (inn, painted
    // over in the fill colour to close hairline gaps), so a neighbour never paints across the outline
    const pts0 = pts, out = [], piece = (q, fl) => {
      const bnd = [], inn = [];
      q.forEach((a, i) => { const b = q[(i + 1) % q.length]; if (len3(sub3(b, a)) > 1e-12) (fl[i] ? bnd : inn).push([a, b]); });
      const onB = (p) => bnd.some((e) => e[0] === p || e[1] === p); // inner edges that end on the outline stop short of it
      const corner = (p) => pts0.some((v) => len3(sub3(p, v)) < 1e-9); // outline pieces run on past ends that are not corners
      out.push({ pts: q, bnd: bnd.map((e) => [e[0], e[1], !corner(e[0]), !corner(e[1])]), inn: inn.map((e) => ({ e, s0: onB(e[0]), s1: onB(e[1]) })) });
    };
    if (n === 3) {
      // a triangle is cut as a quad folded at the vertex opposite its longest side: a clean grid with no T-joints and no
      // slivers along the outline, so each outline piece meets its neighbours end to end
      const e = [0, 1, 2].map((i) => len3(sub3(pts[(i + 1) % 3], pts[i]))), k = e.indexOf(Math.max(...e));
      pts = [pts[k], pts[(k + 1) % 3], pts[(k + 2) % 3], pts[(k + 2) % 3]];
    }
    if (pts.length === 4) {
      const nu = Math.min(24, Math.ceil(Math.max(len3(sub3(pts[1], pts[0])), len3(sub3(pts[2], pts[3]))) / maxL)), nv = Math.min(24, Math.ceil(Math.max(len3(sub3(pts[3], pts[0])), len3(sub3(pts[2], pts[1]))) / maxL));
      const P = (u, v) => lerp3(lerp3(pts[0], pts[1], u), lerp3(pts[3], pts[2], u), v);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [P(i / nu, j / nv), P((i + 1) / nu, j / nv), P((i + 1) / nu, (j + 1) / nv), P(i / nu, (j + 1) / nv)];
        piece(q, [j === 0, i === nu - 1, j === nv - 1, i === 0]);
      }
      return out;
    }
    // fan into triangles, then halve the longest edge until every edge is short; fl marks edges on the outline
    const tri = (a, b, c, fl, d) => {
      const e = [len3(sub3(b, a)), len3(sub3(c, b)), len3(sub3(a, c))], k = e.indexOf(Math.max(...e));
      if (e[k] <= maxL || d > 9) { piece([a, b, c], fl); return; }
      if (k === 0) { const m = lerp3(a, b, 0.5); tri(a, m, c, [fl[0], false, fl[2]], d + 1); tri(m, b, c, [fl[0], fl[1], false], d + 1); }
      else if (k === 1) { const m = lerp3(b, c, 0.5); tri(a, b, m, [fl[0], fl[1], false], d + 1); tri(a, m, c, [false, fl[1], fl[2]], d + 1); }
      else { const m = lerp3(c, a, 0.5); tri(a, b, m, [fl[0], false, fl[2]], d + 1); tri(m, b, c, [false, fl[1], fl[2]], d + 1); }
    };
    for (let i = 1; i < n - 1; i++) tri(pts[0], pts[i], pts[i + 1], [i === 1, true, i === n - 2], 0);
    return out;
  }
  function convex(pts) {
    const n = pts.length, nn = faceNormal(pts); let sg = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n], u = sub3(b, a), v = sub3(c, b);
      const cr = dot([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], nn);
      if (Math.abs(cr) < 1e-12) continue;
      if (!sg) sg = Math.sign(cr); else if (Math.sign(cr) !== sg) return false;
    }
    return true;
  }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function faceNormal(p) {
    // Newell's method
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return norm([nx, ny, nz]);
  }
  /** Layer for a solid that other things rest on: n is the contact plane's normal pointing toward what rests on it.
   *  Everything resting lies on the n side of the plane and the solid on the other, so the plane decides the order. */
  View3D.restLayer = (n, k = 1) => (facing) => (facing(n) > 0 ? -k : k);
  root.View3D = View3D;
})(window);
