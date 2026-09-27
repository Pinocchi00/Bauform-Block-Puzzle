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
   * Cases touchées par la forme, même d'un tout petit bout (pour mesurer les chevauchements
   * tels qu'on les voit).
   */
  readonly touched: Set<string>;
  /**
   * Bouts de forme trop petits pour être une case, rattachés à une case voisine :
   * clé de la case → cases voisines dont elle absorbe le bout. Sa tuile s'agrandit d'autant,
   * il ne reste ni trou ni petit coin isolé le long des arrondis et des pointes.
   */
  readonly absorbed: Map<string, { i: number; j: number }[]>;
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
   * Zone couverte par la case (i, j) : la case elle-même, agrandie des petits bouts voisins
   * qu'elle absorbe (un rectangle par bout, pour rester sans joint visible).
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
   * Tuiles dessinées pour la case (i, j) : (zone de la case ∩ forme), réduites du gap g.
   * Revient à couper chaque rectangle rétréci de g/2 par la forme rétrécie de g/2.
   */
  tiles(i: number, j: number, g: number): Poly[] {
    const h = g / 2;
    return this.rects(i, j).map((r) => clipRect(this.polygon(h), r.i0 + h, r.j0 + h, r.i1 + 1 - h, r.j1 + 1 - h));
  }

  /** Morceau exact de la cellule (i, j) dans la forme (sans gap). */
  piece(i: number, j: number): Poly {
    return clipRect(this.outline, i, j, i + 1, j + 1);
  }
}

function computeCells(outline: Poly) {
  const cells = new Map<string, Cell>();
  const touched = new Set<string>();
  const small: { i: number; j: number }[] = [];
  const b = bounds(outline);
  for (let j = Math.floor(b.y0); j < Math.ceil(b.y1); j++) {
    for (let i = Math.floor(b.x0); i < Math.ceil(b.x1); i++) {
      const piece = clipRect(outline, i, j, i + 1, j + 1);
      if (piece.length < 3) continue;
      const a = area(piece);
      if (a < 1e-4) continue;
      const key = cellKey(i, j);
      touched.add(key);
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
