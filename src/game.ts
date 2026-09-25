// Les règles du jeu, sans aucun affichage : formes, pièces, score, défaite.

import {
  BONUS_PER_SHAPE_CELL,
  RANDOM_REFILL_CHANCE,
  PIECE_SIZE_WEIGHTS,
  POINTS_PER_CELL,
} from './config';
import { firstShape, nextShape } from './generator';
import { Rng } from './rng';
import { Shape, cellKey, type Cell } from './shapes';

/** Une case de pièce (toujours carrée), repérée par sa position dans la pièce. */
export interface PieceCell {
  dx: number;
  dy: number;
}

export interface Piece {
  id: number;
  cells: PieceCell[];
  w: number;
  h: number;
  shape: Shape;
  /** Cases libres de la forme d'où la pièce a été tirée (vide pour une pièce au hasard). */
  source: string[];
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

  /**
   * Vrai si la pièce peut être posée avec son coin haut-gauche en (ax, ay) :
   * chacune de ses cases tombe sur une case libre de la forme active.
   * Les pièces sont carrées ; une fois posée, une case de bord prend la découpe de la forme.
   */
  canPlace(piece: Piece, ax: number, ay: number): boolean {
    const shape = this.active;
    for (const c of piece.cells) {
      const key = cellKey(ax + c.dx, ay + c.dy);
      if (!shape.cells.has(key) || this.filled.has(key)) return false;
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
      // Toujours 3 pièces en main : la pièce posée est remplacée tout de suite.
      this.hand[slot] = this.refillPiece();
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
    const lastColors = this.shapes.slice(-2).map((s) => s.color);
    const next = nextShape(this.rng, done, lastColors, this.figure, this.figureBox, this.aspect);
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
   * Pièce de remplacement. Le plus souvent, elle est tirée des cases libres (elle rentre).
   * Parfois (RANDOM_REFILL_CHANCE), c'est une pièce au hasard qui peut ne rentrer nulle part :
   * sans cette part de hasard, la pièce qui arrive rentrerait toujours et on ne pourrait
   * jamais perdre. Il faut donc garder de la place pour les pièces qui viennent.
   */
  private refillPiece(): Piece | null {
    if (this.rng.chance(RANDOM_REFILL_CHANCE)) return this.randomPiece();
    // On évite les cases d'où viennent les autres pièces en main, si c'est possible.
    const reserved = new Set(
      this.hand.flatMap((p) => (p ? p.source : [])).filter((k) => !this.filled.has(k)),
    );
    return this.makePiece(reserved) ?? this.makePiece(new Set());
  }

  /** Pièce au hasard (1 à 4 cases), sans lien avec les cases libres. */
  private randomPiece(): Piece {
    const size = this.rng.weighted(PIECE_SIZE_WEIGHTS) + 1;
    const cells = [{ dx: 0, dy: 0 }];
    const has = (x: number, y: number) => cells.some((c) => c.dx === x && c.dy === y);
    while (cells.length < size) {
      const from = this.rng.pick(cells);
      const [di, dj] = this.rng.pick(DIRS);
      if (!has(from.dx + di, from.dy + dj)) cells.push({ dx: from.dx + di, dy: from.dy + dj });
    }
    return this.buildPiece(cells, []);
  }

  private buildPiece(raw: { dx: number; dy: number }[], source: string[]): Piece {
    const minX = Math.min(...raw.map((c) => c.dx));
    const minY = Math.min(...raw.map((c) => c.dy));
    const cells = raw
      .map((c) => ({ dx: c.dx - minX, dy: c.dy - minY }))
      .sort((p, q) => p.dy - q.dy || p.dx - q.dx);
    return {
      id: this.nextPieceId++,
      cells,
      w: Math.max(...cells.map((c) => c.dx)) + 1,
      h: Math.max(...cells.map((c) => c.dy)) + 1,
      shape: this.active,
      source,
    };
  }

  /**
   * Distribue 3 pièces neuves (début de forme, ou « réessayer la forme »). Chacune est tirée
   * d'un groupe de cellules libres de la forme, si possible sans se chevaucher : au moment
   * où elles arrivent, les 3 pièces rentrent ensemble.
   */
  private dealHand(): void {
    const reserved = new Set<string>();
    this.hand = [];
    // Les 3 pièces viennent de cases différentes si possible ; sinon elles peuvent se recouper.
    for (let s = 0; s < HAND_SIZE; s++) this.hand.push(this.makePiece(reserved) ?? this.makePiece(new Set()));
  }

  /** Fait grandir un groupe case par case, parmi les cases libres voisines. */
  private growGroup(start: Cell, size: number, freeKeys: Set<string>): Cell[] {
    const shape = this.active;
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
    return group;
  }

  private makePiece(reserved: Set<string>): Piece | null {
    const shape = this.active;
    const free = [...shape.cells.values()].filter((c) => !this.filled.has(c.key) && !reserved.has(c.key));
    if (!free.length) return null;

    const size = this.rng.weighted(PIECE_SIZE_WEIGHTS) + 1;
    const freeKeys = new Set(free.map((c) => c.key));
    const neighbours = (c: Cell) =>
      DIRS.filter(([di, dj]) => freeKeys.has(cellKey(c.i + di, c.j + dj))).length;

    // Point de départ : de préférence un cul-de-sac (une seule case libre voisine),
    // pour éviter de laisser des cases isolées qui ne pourraient recevoir qu'un cube seul.
    // Une case déjà isolée n'est prise que s'il n'y a rien d'autre.
    const connected = free.filter((c) => neighbours(c) > 0);
    const starts = connected.length ? connected : free;
    const weights = starts.map((c) => (neighbours(c) === 1 ? 3 : 1));

    // Plusieurs essais : on garde le groupe le plus proche de la taille voulue et qui,
    // une fois retiré, laisse le moins de cases isolées (futurs cubes seuls).
    let group: Cell[] = [];
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 10; attempt++) {
      const g = this.growGroup(starts[this.rng.weighted(weights)], size, freeKeys);
      const taken = new Set(g.map((c) => c.key));
      const isolated = free.filter(
        (c) => !taken.has(c.key) && DIRS.every(([di, dj]) => {
          const k = cellKey(c.i + di, c.j + dj);
          return !freeKeys.has(k) || taken.has(k);
        }),
      ).length;
      const score = (size - g.length) * 10 + isolated * 3;
      if (score < bestScore) [group, bestScore] = [g, score];
    }
    for (const c of group) reserved.add(c.key);

    return this.buildPiece(
      group.map((c) => ({ dx: c.i, dy: c.j })),
      group.map((c) => c.key),
    );
  }
}
