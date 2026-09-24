// Outils de géométrie : polygones convexes, découpe, aire.
// Toutes les formes du jeu sont convexes, ce qui rend les calculs simples et exacts.

export type Pt = { x: number; y: number };
export type Poly = Pt[];

/** Aire signée (positive ou négative selon le sens de parcours). */
export function signedArea(poly: Poly): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function area(poly: Poly): number {
  return Math.abs(signedArea(poly));
}

/**
 * Garde la partie du polygone où  nx*x + ny*y <= c  (découpe par un demi-plan).
 * Algorithme de Sutherland–Hodgman.
 */
export function clipHalfPlane(poly: Poly, nx: number, ny: number, c: number): Poly {
  const out: Poly = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const dp = nx * p.x + ny * p.y - c;
    const dq = nx * q.x + ny * q.y - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

/** Garde la partie du polygone à l'intérieur du rectangle [x0,x1] × [y0,y1]. */
export function clipRect(poly: Poly, x0: number, y0: number, x1: number, y1: number): Poly {
  let p = clipHalfPlane(poly, -1, 0, -x0);
  if (p.length) p = clipHalfPlane(p, 1, 0, x1);
  if (p.length) p = clipHalfPlane(p, 0, -1, -y0);
  if (p.length) p = clipHalfPlane(p, 0, 1, y1);
  return p;
}

/** Points d'un cercle (polygone très fin, invisible à l'œil). */
export function circlePoly(cx: number, cy: number, r: number, segments = 256): Poly {
  const pts: Poly = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Arc de cercle de l'angle a0 à a1 (radians), extrémités comprises. */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, segments: number): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/**
 * Rétrécit un polygone convexe à côtés droits de la distance d
 * (chaque côté recule de d vers l'intérieur).
 */
export function insetConvex(poly: Poly, d: number): Poly {
  if (d === 0) return poly;
  const sign = signedArea(poly) > 0 ? 1 : -1;
  const n = poly.length;
  // Chaque côté devient une droite décalée : point + direction.
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    // Normale vers l'intérieur.
    const nx = (-dy / len) * sign;
    const ny = (dx / len) * sign;
    return { px: p.x + nx * d, py: p.y + ny * d, dx, dy };
  });
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i + n - 1) % n];
    const b = lines[i];
    const den = a.dx * b.dy - a.dy * b.dx;
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
    out.push({ x: a.px + a.dx * t, y: a.py + a.dy * t });
  }
  return out;
}

/** Vrai si le point est dans le polygone convexe (bord compris). */
export function insideConvex(poly: Poly, x: number, y: number): boolean {
  const sign = signedArea(poly) > 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const cross = (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
    if (cross * sign < -1e-9) return false;
  }
  return true;
}

export function bounds(poly: Poly): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

/** Chemin SVG d'un polygone. */
export function polyPath(poly: Poly, dx = 0, dy = 0, scale = 1): string {
  if (!poly.length) return '';
  let s = '';
  for (let i = 0; i < poly.length; i++) {
    const x = (poly[i].x + dx) * scale;
    const y = (poly[i].y + dy) * scale;
    s += (i ? 'L' : 'M') + round(x) + ' ' + round(y);
  }
  return s + 'Z';
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
