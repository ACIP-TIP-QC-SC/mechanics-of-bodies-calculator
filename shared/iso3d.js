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
    face(pts, fill, alpha = 1, stroke = null, lw = 1) { this.faces.push({ pts, fill, alpha, stroke, lw }); }
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
      f.forEach((q, i) => { if (opts.noTop && i === 5) return; this.face(q, fill, alpha, stroke); });
    }
    /** Extrude a 2D polygon in the x–y plane between z0 and z1. */
    extrude(poly, z0, z1, fill, alpha = 1, stroke = null, opts = {}) {
      const n = poly.length;
      if (n < 2) return;
      if (opts.caps !== false && n >= 3) {
        this.face(poly.map((p) => [p[0], p[1], z0]), fill, alpha, stroke);
        this.face(poly.map((p) => [p[0], p[1], z1]), fill, alpha, stroke);
      }
      const m = opts.open ? n - 1 : n;
      for (let i = 0; i < m; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9) continue;
        this.face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], fill, alpha, opts.sideStroke === undefined ? stroke : opts.sideStroke);
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
      for (let j = 0; j < seg; j++) {
        const t0 = (j / seg) * 2 * Math.PI, t1 = ((j + 1) / seg) * 2 * Math.PI;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        for (let i = 0; i < m; i++) {
          const a = profile[i], b = profile[(i + 1) % n];
          if (Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9) continue;
          const q = [[cx + a[0] * c0, a[1], cz + a[0] * s0], [cx + b[0] * c0, b[1], cz + b[0] * s0], [cx + b[0] * c1, b[1], cz + b[0] * s1], [cx + a[0] * c1, a[1], cz + a[0] * s1]];
          this.face(q, fill, alpha, stroke);
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
      this.ox = w / 2; this.oy = h / 2;
      this.sc = ((Math.min(w, h) * 0.46) / this.radius) * this.zoom;
      const L = norm([0.35, 0.85, 0.45]);
      const yawR = (this.yaw * Math.PI) / 180, pr = (this.pitch * Math.PI) / 180;
      const items = this.faces.map((f) => {
        const pp = f.pts.map((p) => this.project(p));
        let zs = 0; pp.forEach((q) => (zs += q[2]));
        const nrm = faceNormal(f.pts);
        const shade = 0.62 + 0.38 * Math.abs(dot(nrm, L));
        return { f, pp, z: zs / pp.length, shade };
      });
      items.sort((a, b) => a.z - b.z);
      for (const it of items) {
        const { f, pp, shade } = it;
        ctx.beginPath();
        pp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        const [r, g, b] = hexToRgb(f.fill);
        ctx.fillStyle = `rgba(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)},${f.alpha})`;
        ctx.fill();
        if (f.stroke) { ctx.strokeStyle = f.stroke; ctx.lineWidth = f.lw; ctx.globalAlpha = Math.min(1, f.alpha + 0.35); ctx.stroke(); ctx.globalAlpha = 1; }
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
      for (const lb of this.labels) {
        const q = this.project(lb.p);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(lb.text, q[0] + 4, q[1] - 4);
        ctx.fillStyle = lb.color; ctx.fillText(lb.text, q[0] + 4, q[1] - 4);
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
  root.View3D = View3D;
})(window);
