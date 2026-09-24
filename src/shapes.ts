// Les formes (triangle, cercle…) posées sur la grille globale, et le découpage en cellules.
//
// La grille : la cellule (i, j) est le carré [i, i+1] × [j, j+1] en « unités monde ».
// Chaque forme est convexe. Pour chaque cellule, on calcule le morceau « cellule ∩ forme » :
// s'il fait au moins 25 % de la cellule, la cellule appartient à la forme.

import { MIN_CELL_FRACTION } from './config';
import {
  area,
  arcPoints,
  bounds,
  circlePoly,
  clipHalfPlane,
  clipRect,
  insetConvex,
  type Poly,
  type Pt,
} from './geometry';

export type ShapeKind = 'triangle' | 'circle' | 'halfDisc' | 'quarterDisc' | 'bullet' | 'square' | 'rect';

export interface ShapeSpec {
  kind: ShapeKind;
  /** Dimensions, selon le type (voir localPolygon). */
  a: number;
  b: number;
  /** Rotation par quart de tour (0 à 3). */
  rot: number;
  /** Décalage entier sur la grille. */
  ox: number;
  oy: number;
}

export interface Cell {
  i: number;
  j: number;
  key: string;
  /** Signature de la géométrie du morceau : 'F' pour une cellule pleine, sinon le contour découpé. */
  sig: string;
  /** Part de la cellule couverte (0 à 1). */
  area: number;
}

export function cellKey(i: number, j: number): string {
  return i + ',' + j;
}

/**
 * Polygone d'une forme dans son repère local, rétréci de la distance d.
 * Rétrécir sert à dessiner les tuiles : chaque bord recule de la moitié du gap.
 */
function localPolygon(kind: ShapeKind, a: number, b: number, d: number): Poly {
  switch (kind) {
    case 'square':
    case 'rect':
      // Rectangle de a × b.
      return [
        { x: d, y: d },
        { x: a - d, y: d },
        { x: a - d, y: b - d },
        { x: d, y: b - d },
      ];
    case 'triangle':
      // Triangle rectangle, angle droit en (0,0), côtés a (horizontal) et b (vertical).
      return insetConvex(
        [
          { x: 0, y: 0 },
          { x: a, y: 0 },
          { x: 0, y: b },
        ],
        d,
      );
    case 'circle': {
      // Cercle de rayon a. Si b = 1, le centre est au milieu d'une cellule plutôt que sur un coin.
      const c = b === 1 ? 0.5 : 0;
      return circlePoly(c, c, a - d);
    }
    case 'halfDisc':
      // Demi-disque de rayon a, côté plat sur l'axe horizontal, arrondi vers le haut (y < 0).
      return clipHalfPlane(circlePoly(0, 0, a - d), 0, 1, -d);
    case 'quarterDisc': {
      // Quart de disque de rayon a, angle droit en (0,0).
      let p = circlePoly(0, 0, a - d);
      p = clipHalfPlane(p, -1, 0, -d);
      return clipHalfPlane(p, 0, -1, -d);
    }
    case 'bullet': {
      // Rectangle de longueur a et de largeur b, avec le bout droit en demi-cercle.
      const r = b / 2;
      const pts: Pt[] = [{ x: d, y: -r + d }];
      pts.push(...arcPoints(a, 0, r - d, -Math.PI / 2, Math.PI / 2, 128));
      pts.push({ x: d, y: r - d });
      return pts;
    }
  }
}

/** Quart de tour (rot fois), puis décalage. Garde les points entiers sur la grille. */
function transform(p: Pt, rot: number, ox: number, oy: number): Pt {
  let { x, y } = p;
  for (let k = 0; k < rot; k++) [x, y] = [-y, x];
  return { x: x + ox, y: y + oy };
}

export class Shape {
  readonly spec: ShapeSpec;
  readonly color: string;
  /** Contour exact de la forme. */
  readonly outline: Poly;
  /** Cellules de la forme, par clé "i,j". */
  readonly cells: Map<string, Cell>;
  readonly box: { x0: number; y0: number; x1: number; y1: number };
  private insetCache = new Map<number, Poly>();

  constructor(spec: ShapeSpec, color: string) {
    this.spec = spec;
    this.color = color;
    this.outline = this.polygon(0);
    this.box = bounds(this.outline);
    this.cells = computeCells(this.outline);
  }

  /** Contour rétréci de d (en unités monde). */
  polygon(d: number): Poly {
    let p = this.insetCache.get(d);
    if (!p) {
      const { kind, a, b, rot, ox, oy } = this.spec;
      p = localPolygon(kind, a, b, d).map((pt) => transform(pt, rot, ox, oy));
      this.insetCache.set(d, p);
    }
    return p;
  }

  /**
   * Tuile dessinée pour la cellule (i, j) : (cellule ∩ forme) réduite du gap g.
   * Revient à couper le carré rétréci de g/2 par la forme rétrécie de g/2.
   */
  tile(i: number, j: number, g: number): Poly {
    const h = g / 2;
    return clipRect(this.polygon(h), i + h, j + h, i + 1 - h, j + 1 - h);
  }

  /** Morceau exact de la cellule (i, j) dans la forme (sans gap). */
  piece(i: number, j: number): Poly {
    return clipRect(this.outline, i, j, i + 1, j + 1);
  }
}

function computeCells(outline: Poly): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  const b = bounds(outline);
  for (let j = Math.floor(b.y0); j < Math.ceil(b.y1); j++) {
    for (let i = Math.floor(b.x0); i < Math.ceil(b.x1); i++) {
      const piece = clipRect(outline, i, j, i + 1, j + 1);
      if (piece.length < 3) continue;
      const a = area(piece);
      if (a < MIN_CELL_FRACTION - 1e-6) continue;
      const key = cellKey(i, j);
      cells.set(key, { i, j, key, sig: signature(piece, i, j, a), area: a });
    }
  }
  return cells;
}

/**
 * Signature de la géométrie d'un morceau de cellule, dans le repère de la cellule.
 * Deux cellules ont la même signature si leurs morceaux sont exactement superposables :
 * c'est ce qui permet de vérifier qu'un bout pointu va bien sur une case pointue.
 */
function signature(piece: Poly, i: number, j: number, a: number): string {
  if (a > 1 - 1e-6) return 'F';
  // Coordonnées locales arrondies, sans points en double ni alignés.
  let pts = piece.map((p) => ({ x: Math.round((p.x - i) * 1000), y: Math.round((p.y - j) * 1000) }));
  pts = pts.filter((p, k) => {
    const q = pts[(k + pts.length - 1) % pts.length];
    return p.x !== q.x || p.y !== q.y;
  });
  pts = pts.filter((p, k) => {
    const prev = pts[(k + pts.length - 1) % pts.length];
    const next = pts[(k + 1) % pts.length];
    return (p.x - prev.x) * (next.y - prev.y) - (p.y - prev.y) * (next.x - prev.x) !== 0;
  });
  // Même point de départ pour tout le monde : le plus petit.
  let start = 0;
  pts.forEach((p, k) => {
    const s = pts[start];
    if (p.x < s.x || (p.x === s.x && p.y < s.y)) start = k;
  });
  const ordered = [...pts.slice(start), ...pts.slice(0, start)];
  return ordered.map((p) => p.x + ':' + p.y).join(' ');
}
