// Les règles du jeu, sans aucun affichage : formes, pièces, score, défaite.

import {
  BONUS_PER_SHAPE_CELL,
  COLORS,
  GRACE_SHAPES,
  DIFFICULTY_RAMP_END,
  DIFFICULTY_RAMP_START,
  CLOSE_MAX_CELLS,
  CLOSE_MAX_CELLS_LATE,
  PIECE_SIZE_WEIGHTS,
  PIECE_SIZE_WEIGHTS_LATE,
  PIECE_TRIES,
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
}

export interface MoveResult {
  gain: number;
  completed: boolean;
  /** La forme s'est refermée d'elle-même (sans bonus) : voir closeMax. */
  closed: boolean;
  gameOver: boolean;
}

export const HAND_SIZE = 3;

/** Forme d'une pièce, sous forme de texte (deux pièces identiques ont la même). */
function pieceSignature(p: Piece): string {
  return p.cells.map((c) => c.dx + ':' + c.dy).join(' ');
}
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Cases remises en coin haut-gauche (0, 0) et triées : deux pièces identiques s'écrivent pareil. */
function normalize(raw: PieceCell[]): PieceCell[] {
  const minX = Math.min(...raw.map((c) => c.dx));
  const minY = Math.min(...raw.map((c) => c.dy));
  return raw.map((c) => ({ dx: c.dx - minX, dy: c.dy - minY })).sort((p, q) => p.dy - q.dy || p.dx - q.dx);
}

/**
 * Toutes les pièces ordinaires de 1 à 4 cases (cube, domino, barres, L, T, carré, S…),
 * dans toutes leurs orientations : PIECES[n] = les pièces de n cases.
 */
const PIECES: PieceCell[][][] = (() => {
  const bySize: PieceCell[][][] = [[], [[{ dx: 0, dy: 0 }]]];
  for (let n = 2; n <= 4; n++) {
    const found = new Map<string, PieceCell[]>();
    for (const p of bySize[n - 1]) {
      for (const c of p) {
        for (const [di, dj] of DIRS) {
          const x = c.dx + di;
          const y = c.dy + dj;
          if (p.some((q) => q.dx === x && q.dy === y)) continue;
          const cells = normalize([...p, { dx: x, dy: y }]);
          found.set(cells.map((q) => q.dx + ':' + q.dy).join(' '), cells);
        }
      }
    }
    bySize.push([...found.values()]);
  }
  return bySize;
})();

export class Game {
  readonly seed: number;
  private rng: Rng;
  /** Toutes les formes de la partie ; la dernière est la forme active. */
  readonly shapes: Shape[] = [];
  /** Cellules couvertes par les formes terminées. */
  private figure = new Set<string>();
  /**
   * Cases touchées par la figure, même d'un petit bout, avec la plus petite part couverte
   * par une forme (1 = case pleine pour toutes les formes qui la touchent).
   */
  private figureTouched = new Map<string, number>();
  /** Cases touchées par les formes noires terminées (rien ne les chevauche). */
  private blackTouched = new Set<string>();
  figureBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** Cellules remplies de la forme active (chevauchement compris). */
  filled = new Set<string>();
  /** Cellules de la forme active déjà couvertes par la figure au départ. */
  prefilled = new Set<string>();
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
    let closed = false;

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
      if (!this.hand.some((p) => p && this.fits(p)) && this.canClose()) {
        // Bloqué avec seulement quelques cases libres : la forme se referme, sans bonus.
        completed = closed = true;
        this.shapesCompleted++;
        this.startNextShape();
      }
    }

    this.over = !this.hand.some((p) => p && this.fits(p));
    return { gain, completed, closed, gameOver: this.over };
  }

  /** « Réessayer la forme » : la forme active repart de son début. */
  retryShape(): void {
    this.filled = new Set(this.prefilled);
    this.score = this.shapeStartScore;
    this.retryUsed = true;
    this.over = false;
    this.dealHand();
  }

  private startNextShape(): void {
    const done = this.active;
    for (const key of done.cells.keys()) this.figure.add(key);
    for (const [key, a] of done.touched) {
      this.figureTouched.set(key, Math.min(a, this.figureTouched.get(key) ?? 1));
      if (done.color === COLORS.black) this.blackTouched.add(key);
    }
    const lastColors = this.shapes.slice(-2).map((s) => s.color);
    const next = nextShape(
      this.rng,
      done,
      lastColors,
      this.figure,
      this.figureBox,
      this.aspect,
      this.figureTouched,
      this.blackTouched,
    );
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
   * Pièce de remplacement, tirée comme dans un vrai jeu de pièces :
   *  1. on tire sa taille (1 à 4 cases), sans regarder la forme ;
   *  2. on essaie des pièces ordinaires de cette taille (au plus PIECE_TRIES, dans le désordre)
   *     et on garde la première qui rentre quelque part ;
   *  3. si aucune ne rentre, la pièce est donnée quand même.
   * Pas de pièce taillée sur mesure, pas de taille choisie selon les trous. Dans un grand espace
   * libre et compact, presque toute taille rentre ; dans des petits trous ou des couloirs,
   * rarement. Perdre vient donc surtout de la façon dont on a rempli la forme.
   */
  private refillPiece(): Piece {
    const size = this.rng.weighted(this.sizeWeights()) + 1;
    const inHand = new Set(this.hand.map((p) => p && pieceSignature(p)));
    const tries = this.rng.shuffle([...PIECES[size]]).slice(0, PIECE_TRIES);
    let double: Piece | null = null;
    for (const cells of tries) {
      const piece = this.buildPiece(cells);
      if (!this.fits(piece)) continue;
      if (!inHand.has(pieceSignature(piece))) return piece;
      double ??= piece;
    }
    return double ?? this.buildPiece(tries[0]);
  }

  /**
   * Probabilités des tailles de pièce (1 à 4 cases) : de PIECE_SIZE_WEIGHTS au début à
   * PIECE_SIZE_WEIGHTS_LATE dans les longues parties. Les grosses pièces demandent plus de place :
   * il faut jouer de plus en plus serré.
   */
  sizeWeights(): number[] {
    const t = this.lateness();
    return PIECE_SIZE_WEIGHTS.map((w, i) => w + (PIECE_SIZE_WEIGHTS_LATE[i] - w) * t);
  }

  /** Nombre de cases libres jusqu'auquel une forme bloquée se referme d'elle-même (voir canClose). */
  closeMax(): number {
    return Math.round(CLOSE_MAX_CELLS + (CLOSE_MAX_CELLS_LATE - CLOSE_MAX_CELLS) * this.lateness());
  }

  /**
   * Vrai si, bloqué, on peut refermer la forme plutôt que perdre : il reste au plus closeMax()
   * cases libres, ou on est encore dans les GRACE_SHAPES premières formes.
   */
  private canClose(): boolean {
    const left = this.active.cells.size - this.filled.size;
    return left <= this.closeMax() || this.shapesCompleted < GRACE_SHAPES;
  }

  /** Avancée dans la montée en difficulté : 0 avant DIFFICULTY_RAMP_START, 1 à partir de DIFFICULTY_RAMP_END. */
  private lateness(): number {
    const ramp = (this.shapesCompleted - DIFFICULTY_RAMP_START) / (DIFFICULTY_RAMP_END - DIFFICULTY_RAMP_START);
    return Math.max(0, Math.min(1, ramp));
  }

  /** Cases libres de la forme active, groupées en espaces d'un seul tenant. */
  freeRegions(): Cell[][] {
    const shape = this.active;
    const seen = new Set<string>();
    const regions: Cell[][] = [];
    for (const start of shape.cells.values()) {
      if (this.filled.has(start.key) || seen.has(start.key)) continue;
      const region = [start];
      seen.add(start.key);
      for (let k = 0; k < region.length; k++) {
        for (const [di, dj] of DIRS) {
          const next = shape.cells.get(cellKey(region[k].i + di, region[k].j + dj));
          if (next && !this.filled.has(next.key) && !seen.has(next.key)) {
            seen.add(next.key);
            region.push(next);
          }
        }
      }
      regions.push(region);
    }
    return regions;
  }

  private buildPiece(cells: PieceCell[]): Piece {
    return {
      id: this.nextPieceId++,
      cells,
      w: Math.max(...cells.map((c) => c.dx)) + 1,
      h: Math.max(...cells.map((c) => c.dy)) + 1,
      shape: this.active,
    };
  }

  /** Distribue 3 pièces neuves (début de forme, ou « réessayer la forme »). */
  private dealHand(): void {
    this.hand = [];
    for (let s = 0; s < HAND_SIZE; s++) this.hand.push(this.refillPiece());
  }
}
