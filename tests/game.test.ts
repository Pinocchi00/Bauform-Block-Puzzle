import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { Rng } from '../src/rng';
import { Shape, cellKey } from '../src/shapes';

describe('formes et cellules', () => {
  it('un triangle rectangle 4×4 a des cases pleines et des demi-cases pointues identiques', () => {
    const t = new Shape({ kind: 'triangle', a: 4, b: 4, rot: 0, ox: 0, oy: 0 }, '#000');
    // 6 pleines + 4 demi-cases sur la diagonale.
    expect(t.cells.size).toBe(10);
    const half = [...t.cells.values()].filter((c) => c.sig !== 'F');
    expect(half.length).toBe(4);
    expect(new Set(half.map((c) => c.sig)).size).toBe(1);
  });

  it('exclut les miettes de moins de 25 %', () => {
    const c = new Shape({ kind: 'circle', a: 3, b: 0, rot: 0, ox: 0, oy: 0 }, '#000');
    for (const cell of c.cells.values()) expect(cell.area).toBeGreaterThanOrEqual(0.25 - 1e-6);
  });

  it('les cases arrondies d’un cercle sont toutes différentes', () => {
    const c = new Shape({ kind: 'circle', a: 3, b: 0, rot: 0, ox: 0, oy: 0 }, '#000');
    const round = [...c.cells.values()].filter((x) => x.sig !== 'F');
    expect(new Set(round.map((x) => x.sig)).size).toBe(round.length);
  });

  it('la signature ne dépend pas de la position sur la grille', () => {
    const a = new Shape({ kind: 'quarterDisc', a: 4, b: 0, rot: 1, ox: 0, oy: 0 }, '#000');
    const b = new Shape({ kind: 'quarterDisc', a: 4, b: 0, rot: 1, ox: 7, oy: -3 }, '#000');
    for (const cell of a.cells.values()) {
      expect(b.cells.get(cellKey(cell.i + 7, cell.j - 3))?.sig).toBe(cell.sig);
    }
  });
});

/** Un joueur automatique qui pose une pièce au hasard là où elle rentre. */
function playRandomGame(seed: number, maxMoves = 2000) {
  const game = new Game(seed);
  const rng = new Rng(seed ^ 0x9e3779b9);
  let moves = 0;
  while (!game.over && moves < maxMoves) {
    const options: { slot: number; x: number; y: number }[] = [];
    game.hand.forEach((p, slot) => {
      if (p) for (const a of game.anchors(p)) options.push({ slot, ...a });
    });
    expect(options.length).toBeGreaterThan(0);
    const o = rng.pick(options);
    const res = game.place(o.slot, o.x, o.y);
    expect(res).not.toBeNull();
    moves++;
  }
  return { game, moves };
}

describe('partie', () => {
  it('chaque pièce distribuée rentre dans la forme au moment où elle arrive', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const game = new Game(seed);
      for (const p of game.hand) if (p) expect(game.fits(p)).toBe(true);
    }
  });

  it('une pose invalide est refusée', () => {
    const game = new Game(42);
    const p = game.hand.find((x) => x)!;
    expect(game.place(game.hand.indexOf(p), 999, 999)).toBeNull();
  });

  it('les parties finissent par une défaite, avec un score cohérent', () => {
    let totalShapes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { game } = playRandomGame(seed);
      expect(game.over).toBe(true);
      expect(game.score).toBeGreaterThan(0);
      // Défaite = aucune pièce en main ne rentre.
      for (const p of game.hand) if (p) expect(game.fits(p)).toBe(false);
      totalShapes += game.shapesCompleted;
    }
    // Un joueur au hasard doit quand même finir quelques formes.
    expect(totalShapes).toBeGreaterThan(0);
  });

  it('la même seed donne la même partie', () => {
    const a = playRandomGame(7);
    const b = playRandomGame(7);
    expect(a.game.score).toBe(b.game.score);
    expect(a.moves).toBe(b.moves);
  });

  it('les nouvelles formes chevauchent la précédente de 10 à 30 % environ', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { game } = playRandomGame(seed);
      for (let k = 1; k < game.shapes.length; k++) {
        const cur = game.shapes[k];
        const prev = game.shapes[k - 1];
        const shared = [...cur.cells.keys()].filter((key) => prev.cells.has(key)).length;
        const ratio = shared / cur.cells.size;
        expect(ratio).toBeGreaterThanOrEqual(0.05);
        expect(ratio).toBeLessThanOrEqual(0.35);
      }
    }
  });

  it('réessayer la forme remet la forme active à son début', () => {
    const { game } = playRandomGame(3);
    const before = game.shapes.length;
    game.retryShape();
    expect(game.over).toBe(false);
    expect(game.shapes.length).toBe(before);
    expect(game.hand.some((p) => p && game.fits(p))).toBe(true);
  });
});
