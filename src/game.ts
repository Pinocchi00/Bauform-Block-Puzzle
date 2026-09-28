// Les règles du jeu, sans aucun affichage : formes, pièces, score, défaite.

import {
  BONUS_PER_SHAPE_CELL,
  COLORS,
  EXACT_PIECE_CHANCE,
  GRACE_SHAPES,
  NATURAL_PIECE_TRIES,
  RANDOM_REFILL_CHANCE,
  RANDOM_REFILL_CHANCE_MAX,
  DIFFICULTY_RAMP_END,
  DIFFICULTY_RAMP_START,
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
   * Pièce de remplacement, tirée comme dans un vrai jeu de pièces :
   *  1. on tire sa taille (1 à 4 cases ; le cube seul peut arriver à tout moment, rarement) ;
   *  2. on tire une pièce ordinaire de cette taille (barre, L, T, carré…), gardée si elle rentre
   *     quelque part, de préférence sans laisser de case isolée ;
   *  3. si aucune pièce de cette taille ne rentre et qu'une autre pièce en main rentre encore,
   *     on la donne quand même : rien n'est « taillé » pour finir la forme ;
   *  4. sinon seulement (plus rien ne rentre), un morceau découpé dans les cases libres.
   * De temps en temps, une pièce au hasard sans vérification : c'est ce qui rend la défaite
   * possible. De plus en plus souvent au fil des formes (voir randomChance).
   */
  /**
   * Probabilité qu'une nouvelle pièce soit tirée au hasard : nulle pendant les premières
   * formes, puis RANDOM_REFILL_CHANCE, qui monte doucement jusqu'à RANDOM_REFILL_CHANCE_MAX
   * dans les longues parties.
   */
  randomChance(): number {
    if (this.shapesCompleted < GRACE_SHAPES) return 0;
    const ramp = (this.shapesCompleted - DIFFICULTY_RAMP_START) / (DIFFICULTY_RAMP_END - DIFFICULTY_RAMP_START);
    const t = Math.max(0, Math.min(1, ramp));
    return RANDOM_REFILL_CHANCE + (RANDOM_REFILL_CHANCE_MAX - RANDOM_REFILL_CHANCE) * t;
  }

  private refillPiece(): Piece {
    const size = this.rng.weighted(PIECE_SIZE_WEIGHTS) + 1;
    if (this.rng.chance(this.randomChance())) return this.randomPiece(size);

    // Pas deux fois la même pièce en main, tant que c'est possible.
    const same = (p: Piece) => {
      const sig = pieceSignature(p);
      return this.hand.some((h) => h && pieceSignature(h) === sig);
    };
    let fallback: Piece | null = null;
    for (let t = 0; t < NATURAL_PIECE_TRIES; t++) {
      const p = this.randomPiece(size);
      if (t < NATURAL_PIECE_TRIES - 5 && same(p)) continue;
      const anchors = this.anchors(p);
      if (!anchors.length) continue;
      if (anchors.some((a) => this.isolatedAfter(p, a.x, a.y) === 0)) return p;
      fallback ??= p;
    }
    if (fallback) return fallback;

    const handFits = this.hand.some((p) => p && this.fits(p));
    if (handFits || !this.rng.chance(EXACT_PIECE_CHANCE)) return this.randomPiece(size);
    const reserved = new Set(
      this.hand.flatMap((p) => (p && p.source.every((k) => !this.filled.has(k)) ? p.source : [])),
    );
    return this.makePiece(reserved, true) ?? this.makePiece(new Set(), true) ?? this.randomPiece(size);
  }

  /** Nombre de cases libres qui resteraient isolées (sans voisine libre) après cette pose. */
  private isolatedAfter(piece: Piece, ax: number, ay: number): number {
    const taken = new Set(piece.cells.map((c) => cellKey(ax + c.dx, ay + c.dy)));
    const free = (k: string) => this.active.cells.has(k) && !this.filled.has(k) && !taken.has(k);
    let n = 0;
    for (const c of this.active.cells.values()) {
      if (!free(c.key)) continue;
      if (DIRS.every(([di, dj]) => !free(cellKey(c.i + di, c.j + dj)))) n++;
    }
    return n;
  }

  /** Pièce ordinaire au hasard de la taille donnée, sans lien avec les cases libres. */
  private randomPiece(size: number): Piece {
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

  /** Distribue 3 pièces neuves (début de forme, ou « réessayer la forme »). */
  private dealHand(): void {
    this.hand = [];
    for (let s = 0; s < HAND_SIZE; s++) this.hand.push(this.refillPiece());
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

  /**
   * Pièce découpée dans un groupe de cases libres (hors cases réservées), en dernier recours
   * quand plus rien ne rentre. Elle part de préférence d'un bord ou d'un cul-de-sac.
   * @param allowSingle accepte un cube seul ; sinon renvoie null s'il n'y a que des cases isolées
   */
  private makePiece(reserved: Set<string>, allowSingle: boolean): Piece | null {
    const shape = this.active;
    const free = [...shape.cells.values()].filter((c) => !this.filled.has(c.key) && !reserved.has(c.key));
    if (!free.length) return null;

    let size = this.rng.weighted(PIECE_SIZE_WEIGHTS) + 1;
    if (!allowSingle) size = Math.max(2, size);
    const freeKeys = new Set(free.map((c) => c.key));
    const neighbours = (c: Cell) =>
      DIRS.filter(([di, dj]) => freeKeys.has(cellKey(c.i + di, c.j + dj))).length;
    const onEdge = (c: Cell) =>
      c.area < 1 || DIRS.some(([di, dj]) => !shape.cells.has(cellKey(c.i + di, c.j + dj)));

    const connected = free.filter((c) => neighbours(c) > 0);
    if (!connected.length && !allowSingle) return null;
    const starts = connected.length && !(allowSingle && size === 1) ? connected : free;
    const weights = starts.map((c) => (neighbours(c) === 1 ? 3 : 1) * (onEdge(c) ? 3 : 1));

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
    if (group.length < 2 && !allowSingle) return null;
    for (const c of group) reserved.add(c.key);

    return this.buildPiece(
      group.map((c) => ({ dx: c.i, dy: c.j })),
      group.map((c) => c.key),
    );
  }
}
