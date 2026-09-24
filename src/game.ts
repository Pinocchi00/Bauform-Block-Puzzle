// Les règles du jeu, sans aucun affichage : formes, pièces, score, défaite.

import {
  BONUS_PER_SHAPE_CELL,
  EDGE_PIECE_CHANCE,
  PIECE_SIZE_WEIGHTS,
  POINTS_PER_CELL,
} from './config';
import { firstShape, nextShape } from './generator';
import { Rng } from './rng';
import { Shape, cellKey, type Cell } from './shapes';

export interface PieceCell {
  /** Position dans la pièce. */
  dx: number;
  dy: number;
  /** Cellule de la forme d'où vient ce morceau (pour dessiner sa géométrie). */
  si: number;
  sj: number;
  sig: string;
}

export interface Piece {
  id: number;
  cells: PieceCell[];
  w: number;
  h: number;
  shape: Shape;
}

export interface MoveResult {
  gain: number;
  completed: boolean;
  gameOver: boolean;
}

export const HAND_SIZE = 3;
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class Game {
  readonly seed: number;
  private rng: Rng;
  /** Toutes les formes de la partie ; la dernière est la forme active. */
  readonly shapes: Shape[] = [];
  /** Cellules couvertes par les formes terminées. */
  private figure = new Set<string>();
  figureBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** Cellules remplies de la forme active (chevauchement compris). */
  filled = new Set<string>();
  /** Cellules de la forme active déjà couvertes par la figure au départ. */
  private prefilled = new Set<string>();
  hand: (Piece | null)[] = [];
  score = 0;
  piecesPlaced = 0;
  shapesCompleted = 0;
  over = false;
  retryUsed = false;
  private shapeStartScore = 0;
  private nextPieceId = 1;

  /** @param aspect largeur / hauteur de la zone de jeu, pour garder la figure compacte */
  constructor(seed: number, public aspect = 0.75) {
    this.seed = seed;
    this.rng = new Rng(seed);
    const first = firstShape(this.rng);
    this.shapes.push(first);
    this.figureBox = { ...first.box };
    this.dealHand();
  }

  get active(): Shape {
    return this.shapes[this.shapes.length - 1];
  }

  /** Vrai si la pièce peut être posée avec son coin haut-gauche en (ax, ay). */
  canPlace(piece: Piece, ax: number, ay: number): boolean {
    const shape = this.active;
    for (const c of piece.cells) {
      const key = cellKey(ax + c.dx, ay + c.dy);
      const target = shape.cells.get(key);
      if (!target || this.filled.has(key) || target.sig !== c.sig) return false;
    }
    return true;
  }

  /** Toutes les positions possibles de la pièce dans la forme active. */
  anchors(piece: Piece): { x: number; y: number }[] {
    const b = this.active.box;
    const out: { x: number; y: number }[] = [];
    for (let y = Math.floor(b.y0); y <= Math.ceil(b.y1) - piece.h; y++) {
      for (let x = Math.floor(b.x0); x <= Math.ceil(b.x1) - piece.w; x++) {
        if (this.canPlace(piece, x, y)) out.push({ x, y });
      }
    }
    return out;
  }

  fits(piece: Piece): boolean {
    return this.anchors(piece).length > 0;
  }

  /** Pose la pièce du plateau n° slot. Renvoie null si la pose est impossible. */
  place(slot: number, ax: number, ay: number): MoveResult | null {
    const piece = this.hand[slot];
    if (this.over || !piece || !this.canPlace(piece, ax, ay)) return null;

    for (const c of piece.cells) this.filled.add(cellKey(ax + c.dx, ay + c.dy));
    this.hand[slot] = null;
    this.piecesPlaced++;
    let gain = POINTS_PER_CELL * piece.cells.length;
    let completed = false;

    if (this.filled.size === this.active.cells.size) {
      // Forme pleine : bonus, puis nouvelle forme et nouvelles pièces.
      completed = true;
      gain += BONUS_PER_SHAPE_CELL * this.active.cells.size;
      this.shapesCompleted++;
      this.score += gain;
      this.startNextShape();
    } else {
      this.score += gain;
      // Les 3 pièces sont posées : on en distribue 3 nouvelles.
      if (this.hand.every((p) => !p)) this.dealHand();
    }

    this.over = !this.hand.some((p) => p && this.fits(p));
    return { gain, completed, gameOver: this.over };
  }

  /** « Réessayer la forme » : la forme active repart de son début. */
  retryShape(): void {
    this.filled = new Set(this.prefilled);
    this.score = this.shapeStartScore;
    this.retryUsed = true;
    this.over = false;
    this.dealHand();
  }

  /** Liste des formes avec leurs cellules remplies, pour l'affichage. */
  filledCells(index: number): Iterable<string> {
    return index === this.shapes.length - 1 ? this.filled : this.shapes[index].cells.keys();
  }

  private startNextShape(): void {
    const done = this.active;
    for (const key of done.cells.keys()) this.figure.add(key);
    const next = nextShape(this.rng, done, this.figure, this.figureBox, this.aspect);
    this.shapes.push(next);
    const b = this.figureBox;
    this.figureBox = {
      x0: Math.min(b.x0, next.box.x0),
      y0: Math.min(b.y0, next.box.y0),
      x1: Math.max(b.x1, next.box.x1),
      y1: Math.max(b.y1, next.box.y1),
    };
    // La zone qui chevauche la figure compte comme déjà remplie.
    this.prefilled = new Set([...next.cells.keys()].filter((k) => this.figure.has(k)));
    this.filled = new Set(this.prefilled);
    this.shapeStartScore = this.score;
    this.dealHand();
  }

  /**
   * Distribue 3 pièces. Chacune est tirée d'un groupe de cellules libres de la forme,
   * et les 3 groupes ne se chevauchent pas : au moment où elles arrivent, les 3 pièces
   * rentrent ensemble. C'est la façon de les poser qui peut ensuite en bloquer une.
   */
  private dealHand(): void {
    const reserved = new Set<string>();
    this.hand = [];
    for (let s = 0; s < HAND_SIZE; s++) this.hand.push(this.makePiece(reserved));
  }

  private makePiece(reserved: Set<string>): Piece | null {
    const shape = this.active;
    const free = [...shape.cells.values()].filter((c) => !this.filled.has(c.key) && !reserved.has(c.key));
    if (!free.length) return null;

    // Point de départ : souvent une case de bord (pointue ou arrondie), s'il en reste.
    const edges = free.filter((c) => c.sig !== 'F');
    const start = edges.length && this.rng.chance(EDGE_PIECE_CHANCE) ? this.rng.pick(edges) : this.rng.pick(free);
    const size = this.rng.weighted(PIECE_SIZE_WEIGHTS) + 1;

    // On fait grandir la pièce case par case, parmi les cases libres voisines.
    const freeKeys = new Set(free.map((c) => c.key));
    const group: Cell[] = [start];
    const inGroup = new Set([start.key]);
    while (group.length < size) {
      const frontier: Cell[] = [];
      for (const c of group) {
        for (const [di, dj] of DIRS) {
          const key = cellKey(c.i + di, c.j + dj);
          if (freeKeys.has(key) && !inGroup.has(key)) frontier.push(shape.cells.get(key)!);
        }
      }
      if (!frontier.length) break;
      const next = this.rng.pick(frontier);
      group.push(next);
      inGroup.add(next.key);
    }
    for (const c of group) reserved.add(c.key);

    const minI = Math.min(...group.map((c) => c.i));
    const minJ = Math.min(...group.map((c) => c.j));
    const cells = group
      .map((c) => ({ dx: c.i - minI, dy: c.j - minJ, si: c.i, sj: c.j, sig: c.sig }))
      .sort((p, q) => p.dy - q.dy || p.dx - q.dx);
    return {
      id: this.nextPieceId++,
      cells,
      w: Math.max(...cells.map((c) => c.dx)) + 1,
      h: Math.max(...cells.map((c) => c.dy)) + 1,
      shape,
    };
  }
}
