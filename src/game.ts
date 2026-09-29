// Les règles du jeu, sans aucun affichage : formes, pièces, score, défaite.

import {
  BONUS_PER_SHAPE_CELL,
  COLORS,
  GRACE_SHAPES,
  DIFFICULTY_RAMP_END,
  DIFFICULTY_RAMP_START,
  END_SIZE_WEIGHTS,
  END_SMALL_CELLS,
  HELP_CHANCE,
  HELP_CHANCE_LATE,
  PIECE_SIZE_WEIGHTS,
  PIECE_SIZE_WEIGHTS_LATE,
  PIECE_TRIES,
  POINTS_PER_CELL,
} from './config';
import { firstShape, nextShape } from './generator';
import { canTile } from './planner';
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
  gameOver: boolean;
}

export const HAND_SIZE = 3;

/** Forme d'une pièce, sous forme de texte (deux pièces identiques ont la même). */
function signature(cells: PieceCell[]): string {
  return cells.map((c) => c.dx + ':' + c.dy).join(' ');
}
function pieceSignature(p: Piece): string {
  return signature(p.cells);
}

/** Les sous-ensembles d'une liste, du plus grand au plus petit (liste vide en dernier). */
function subsets<T>(items: T[]): T[][] {
  const all: T[][] = [[]];
  for (const item of items) all.push(...all.map((sub) => [...sub, item]));
  return all.sort((a, b) => b.length - a.length);
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
   * Pièce de remplacement. Sa taille (1 à 4 cases) est tirée sans regarder la forme, puis :
   *  - aide discrète (le plus souvent, voir helpChance) : une pièce ordinaire de cette taille qui
   *    garde la forme finissable avec les pièces déjà en main (voir helpedPiece) ;
   *  - sinon, une pièce ordinaire de cette taille qui rentre quelque part (voir naturalPiece).
   * Aucune pièce n'est taillée sur mesure.
   */
  private refillPiece(): Piece {
    const size = this.rng.weighted(this.sizeWeights()) + 1;
    const helped = this.rng.chance(this.helpChance()) ? this.helpedPiece(size) : null;
    return helped ?? this.naturalPiece(size);
  }

  /**
   * Probabilité que l'aide discrète joue : toujours pendant la période de grâce, puis
   * HELP_CHANCE, qui baisse jusqu'à HELP_CHANCE_LATE dans les longues parties.
   */
  helpChance(): number {
    if (this.shapesCompleted < GRACE_SHAPES) return 1;
    return HELP_CHANCE + (HELP_CHANCE_LATE - HELP_CHANCE) * this.lateness();
  }

  /**
   * Aide discrète : une pièce ordinaire telle qu'il existe encore une façon de finir la forme
   * avec les pièces en main, celle-ci, et d'autres pièces ordinaires. Les pièces qui finiront la
   * forme arrivent donc bien avant la fin, mêlées aux autres.
   * Ce qui ne doit pas se voir :
   *  - une pièce qui a exactement la forme d'un trou seulement en dernier recours ;
   *  - vers la fin de la forme, les pièces sont un peu plus petites (voir END_SMALL_CELLS) : elles
   *    arrivent avant que les derniers trous existent et laissent de la marge ;
   *  - quand les pièces en main suffisent déjà à finir, une petite pièce ordinaire qui rentre, en
   *    réserve, plutôt qu'une pièce choisie.
   * Si le joueur a posé une pièce de travers, on garde dans le plan le plus possible de pièces
   * de sa main. Renvoie null si rien ne convient (on donne alors une pièce ordinaire).
   */
  private helpedPiece(size: number): Piece | null {
    const free = new Set([...this.active.cells.keys()].filter((k) => !this.filled.has(k)));
    const hand = this.hand.filter((p): p is Piece => !!p).map((p) => p.cells);
    const fillers = [...PIECES[4], ...PIECES[3], ...PIECES[2]];
    const kept = subsets(hand).find((sub) => canTile(free, sub, fillers));
    if (!kept) return null;
    const left = free.size - kept.reduce((n, p) => n + p.length, 0);

    const weights = this.sizeWeights();
    const sizes = [size];
    while (sizes.length < 4) sizes.push(this.rng.weighted(weights.map((w, i) => (sizes.includes(i + 1) ? 0 : w))) + 1);

    const holes = new Set(this.freeRegions().map((r) => signature(normalize(r.map((c) => ({ dx: c.i, dy: c.j }))))));
    const inHand = new Set(hand.map(signature));
    // Dans l'ordre de préférence : pièce nouvelle en main, pièce déjà en main, et seulement en
    // dernier recours une pièce qui a la forme d'un trou.
    let double: PieceCell[] | null = null;
    let hole: PieceCell[] | null = null;
    for (const s of left > 0 ? sizes : [...sizes].sort((a, b) => a - b)) {
      if (left > 0 && s > left) continue;
      for (const cells of this.rng.shuffle([...PIECES[s]])) {
        if (!this.fits(this.buildPiece(cells))) continue;
        if (left > 0 && !canTile(free, [...kept, cells], fillers)) continue;
        if (holes.has(signature(cells))) hole ??= cells;
        else if (!inHand.has(signature(cells))) return this.buildPiece(cells);
        else double ??= cells;
      }
      if (double) return this.buildPiece(double);
    }
    return hole && this.buildPiece(hole);
  }

  /** Pièce ordinaire de cette taille qui rentre quelque part, parmi PIECE_TRIES essais ; sinon donnée quand même. */
  private naturalPiece(size: number): Piece {
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
   * PIECE_SIZE_WEIGHTS_LATE dans les longues parties (les grosses pièces demandent plus de place :
   * il faut jouer de plus en plus serré), et vers END_SIZE_WEIGHTS quand la forme est presque
   * pleine (voir END_SMALL_CELLS).
   */
  sizeWeights(): number[] {
    const t = this.lateness();
    const base = PIECE_SIZE_WEIGHTS.map((w, i) => w + (PIECE_SIZE_WEIGHTS_LATE[i] - w) * t);
    // Vers la fin de la forme, les tailles glissent doucement vers les petites pièces.
    const free = this.active.cells.size - this.filled.size;
    const [lo, hi] = END_SMALL_CELLS;
    const u = Math.max(0, Math.min(1, (hi - free) / (hi - lo)));
    return base.map((w, i) => w + (END_SIZE_WEIGHTS[i] - w) * u);
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
