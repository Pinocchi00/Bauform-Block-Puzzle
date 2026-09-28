// Les formes (triangle, cercle…) posées sur la grille globale, et le découpage en cellules.
//
// La grille : la cellule (i, j) est le carré [i, i+1] × [j, j+1] en « unités monde ».
// Chaque forme est convexe. Pour chaque cellule, on calcule le morceau « cellule ∩ forme » :
// s'il fait au moins 25 % de la cellule, la cellule appartient à la forme (une demi-case le long
// d'un arrondi est donc une vraie case, qu'on remplit comme les autres). Les bouts plus petits
// ne sont pas des cases : chacun agrandit légèrement la case voisine.

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

/** Rectangle en cases : de (i0, j0) à (i1, j1) inclus. */
export interface CellRect {
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

export class Shape {
  readonly spec: ShapeSpec;
  readonly color: string;
  /** Contour exact de la forme. */
  readonly outline: Poly;
  /** Cellules de la forme, par clé "i,j". */
  readonly cells: Map<string, Cell>;
  /**
   * Cases touchées par la forme, même d'un tout petit bout, avec la part couverte (0 à 1).
   * Sert à mesurer les chevauchements tels qu'on les voit.
   */
  readonly touched: Map<string, number>;
  /**
   * Bouts de forme trop petits pour être une case (moins de 25 %), rattachés à une case voisine :
   * clé de la case → bouts voisins. La tuile de la case s'étend un peu sur ses bouts : une
   * case = une seule tuile, légèrement plus grande. Une pièce de 2 cases remplit 2 tuiles,
   * et il ne reste ni mini-carré ni trou le long des arrondis.
   */
  readonly absorbed: Map<string, { i: number; j: number }[]>;
  /** Clé d'un petit bout → clé de la case qui l'a absorbé. */
  readonly ownerOf: Map<string, string>;
  readonly box: { x0: number; y0: number; x1: number; y1: number };
  private insetCache = new Map<number, Poly>();

  constructor(spec: ShapeSpec, color: string) {
    this.spec = spec;
    this.color = color;
    this.outline = this.polygon(0);
    this.box = bounds(this.outline);
    const { cells, touched, absorbed } = computeCells(this.outline);
    this.cells = cells;
    this.touched = touched;
    this.absorbed = absorbed;
    this.ownerOf = new Map();
    for (const [key, list] of absorbed) for (const b of list) this.ownerOf.set(cellKey(b.i, b.j), key);
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
   * Zone couverte par la case (i, j) et les petits bouts qu'elle entraîne, en rectangles
   * (pour les aplats de la fin, sans joint visible).
   */
  rects(i: number, j: number): CellRect[] {
    const extra = this.absorbed.get(cellKey(i, j));
    if (!extra) return [{ i0: i, j0: j, i1: i, j1: j }];
    return extra.map((e) => ({
      i0: Math.min(i, e.i),
      j0: Math.min(j, e.j),
      i1: Math.max(i, e.i),
      j1: Math.max(j, e.j),
    }));
  }

  /**
   * Tuile dessinée pour la case (i, j) : (case et ses petits bouts) ∩ forme, réduite du gap g.
   * Revient à couper le rectangle rétréci de g/2 par la forme rétrécie de g/2. Plusieurs
   * polygones seulement si la case a des bouts sur deux côtés ; ensemble, une seule tuile.
   */
  tile(i: number, j: number, g: number): Poly[] {
    const h = g / 2;
    const p = this.polygon(h);
    return this.rects(i, j)
      .map((r) => clipRect(p, r.i0 + h, r.j0 + h, r.i1 + 1 - h, r.j1 + 1 - h))
      .filter((q) => q.length >= 3);
  }

  /** Morceau exact de la case (i, j) dans la forme, petits bouts compris (sans gap). */
  piece(i: number, j: number): Poly[] {
    return this.rects(i, j)
      .map((r) => clipRect(this.outline, r.i0, r.j0, r.i1 + 1, r.j1 + 1))
      .filter((q) => q.length >= 3);
  }

  /** Case à laquelle appartient la cellule de grille (i, j) : elle-même, sa case, ou aucune. */
  cellAt(i: number, j: number): string | undefined {
    const key = cellKey(i, j);
    return this.cells.has(key) ? key : this.ownerOf.get(key);
  }
}

function computeCells(outline: Poly) {
  const cells = new Map<string, Cell>();
  const touched = new Map<string, number>();
  const small: { i: number; j: number }[] = [];
  const b = bounds(outline);
  for (let j = Math.floor(b.y0); j < Math.ceil(b.y1); j++) {
    for (let i = Math.floor(b.x0); i < Math.ceil(b.x1); i++) {
      const piece = clipRect(outline, i, j, i + 1, j + 1);
      if (piece.length < 3) continue;
      const a = area(piece);
      if (a < 1e-4) continue;
      const key = cellKey(i, j);
      touched.set(key, a);
      if (a < MIN_CELL_FRACTION - 1e-6) small.push({ i, j });
      else cells.set(key, { i, j, key, area: a });
    }
  }
  // Chaque petit bout est rattaché à la case voisine (côté commun) la plus grande.
  const absorbed = new Map<string, { i: number; j: number }[]>();
  for (const s of small) {
    let best: Cell | undefined;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = cells.get(cellKey(s.i + di, s.j + dj));
      if (c && (!best || c.area > best.area)) best = c;
    }
    if (best) absorbed.set(best.key, [...(absorbed.get(best.key) ?? []), s]);
  }
  return { cells, touched, absorbed };
}
