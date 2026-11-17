/* =====================================================================
 * Mohr's circle for a 2D symmetric tensor (physics only; browser + Node).
 * Used for moments of inertia (Statics 10.6, 10.7) and later for plane
 * stress and strain.
 *
 *   value on the axis at θ:  a(θ) = avg + d·cos 2θ + c·sin 2θ
 *   off-diagonal at θ:       o(θ) = −s·(d·sin 2θ − c·cos 2θ)   (see below)
 *
 * Inertia:  a = I_u, off = I_uv, with c = −I_xy
 *   I_u  = (Ix+Iy)/2 + (Ix−Iy)/2·cos 2θ − Ixy·sin 2θ
 *   I_uv = (Ix−Iy)/2·sin 2θ + Ixy·cos 2θ
 * Stress:   a = σ_x', off = τ_x'y', with c = τ_xy
 *   σ_x'   = (σx+σy)/2 + (σx−σy)/2·cos 2θ + τxy·sin 2θ
 *   τ_x'y' = −(σx−σy)/2·sin 2θ + τxy·cos 2θ
 * Angles are in degrees, counterclockwise positive from the x axis.
 * ===================================================================== */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180;

  function circle(ax, ay, c) {
    const avg = (ax + ay) / 2, d = (ax - ay) / 2, R = Math.hypot(d, c);
    // the larger principal value lies at 2θ = atan2(c, d)
    const thp = R > 1e-12 * Math.max(1, Math.abs(avg)) ? (0.5 * Math.atan2(c, d)) / DEG : 0;
    return { avg, d, R, max: avg + R, min: avg - R, thp, thp2: thp > 0 ? thp - 90 : thp + 90 };
  }
  /** Moments and product of inertia about axes rotated by θ. */
  function inertia(Ix, Iy, Ixy) {
    const m = circle(Ix, Iy, -Ixy);
    m.at = (th) => {
      const c2 = Math.cos(2 * th * DEG), s2 = Math.sin(2 * th * DEG);
      return { Iu: m.avg + m.d * c2 - Ixy * s2, Iv: m.avg - m.d * c2 + Ixy * s2, Iuv: m.d * s2 + Ixy * c2 };
    };
    return m;
  }
  /** Plane stress (or strain with γ/2 as the shear term) on an element rotated by θ. */
  function stress(sx, sy, txy) {
    const m = circle(sx, sy, txy);
    m.tmax = m.R;
    m.ths = m.thp - 45; // plane of maximum in-plane shear
    m.at = (th) => {
      const c2 = Math.cos(2 * th * DEG), s2 = Math.sin(2 * th * DEG);
      return { sx: m.avg + m.d * c2 + txy * s2, sy: m.avg - m.d * c2 - txy * s2, txy: -m.d * s2 + txy * c2 };
    };
    return m;
  }

  const Mohr = { circle, inertia, stress };
  root.Mohr = Mohr;
  if (typeof module !== 'undefined' && module.exports) module.exports = Mohr;
})(typeof window !== 'undefined' ? window : globalThis);
