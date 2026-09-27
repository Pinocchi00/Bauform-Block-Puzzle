import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { firstShape, nextShape } from '../src/generator';
import { Rng } from '../src/rng';
import { Shape, cellKey } from '../src/shapes';

describe('formes et cellules', () => {
  it('un triangle rectangle 4×4 a 6 cases pleines et 4 demi-cases pointues', () => {
    const t = new Shape({ kind: 'triangle', a: 4, b: 4, rot: 0, ox: 0, oy: 0 }, '#000');
    expect(t.cells.size).toBe(10);
    const half = [...t.cells.values()].filter((c) => c.area < 1);
    expect(half.length).toBe(4);
    for (const c of half) expect(c.area).toBeCloseTo(0.5);
  });

  it('exclut les miettes de moins de 25 %', () => {
    const c = new Shape({ kind: 'circle', a: 3, b: 0, rot: 0, ox: 0, oy: 0 }, '#000');
    for (const cell of c.cells.values()) expect(cell.area).toBeGreaterThanOrEqual(0.25 - 1e-6);
  });

  it('une case carrée se pose sur n’importe quelle case libre, bords pointus ou arrondis compris', () => {
    const game = new Game(5);
    const single = { id: 0, cells: [{ dx: 0, dy: 0 }], w: 1, h: 1, shape: game.active, source: [] };
    for (const c of game.active.cells.values()) {
      expect(game.canPlace(single, c.i, c.j)).toBe(!game.filled.has(c.key));
    }
    expect(game.canPlace(single, 999, 999)).toBe(false);
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

/** Un joueur automatique prudent : la pose qui laisse le plus d'autres pièces jouables. */
function playCarefulGame(seed: number, maxMoves = 400) {
  const game = new Game(seed);
  const rng = new Rng(seed * 31);
  let moves = 0;
  while (!game.over && moves < maxMoves) {
    const options: { slot: number; x: number; y: number }[] = [];
    game.hand.forEach((p, slot) => {
      if (p) for (const a of game.anchors(p)) options.push({ slot, ...a });
    });
    let best = options[0];
    let bestScore = -1;
    for (const o of rng.shuffle(options).slice(0, 30)) {
      const saved = new Set(game.filled);
      for (const c of game.hand[o.slot]!.cells) game.filled.add(cellKey(o.x + c.dx, o.y + c.dy));
      const score = game.hand.filter((p, s) => s !== o.slot && p && game.fits(p)).length;
      game.filled = saved;
      if (score > bestScore) [best, bestScore] = [o, score];
    }
    game.place(best.slot, best.x, best.y);
    moves++;
  }
  return { game, moves };
}

describe('partie', () => {
  it('les pièces distribuées rentrent presque toujours au moment où elles arrivent', () => {
    let fit = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const game = new Game(seed);
      for (const p of game.hand) {
        total++;
        if (p && game.fits(p)) fit++;
      }
    }
    // Seule une petite part est tirée au hasard sans vérification (c'est ce qui permet de perdre).
    expect(fit / total).toBeGreaterThan(0.85);
  });

  it('il y a toujours 3 pièces en main', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { game } = playCarefulGame(seed);
      expect(game.hand.filter((p) => p).length).toBe(3);
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

  it('les nouvelles formes chevauchent la précédente de 10 à 20 %, ou se collent contre elle', () => {
    let adjacent = 0;
    let overlapping = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const shapes = [firstShape(rng)];
      const figure = new Set<string>();
      const touched = new Map<string, number>();
      let box = { ...shapes[0].box };
      for (let k = 1; k <= 8; k++) {
        const prev = shapes[shapes.length - 1];
        for (const key of prev.cells.keys()) figure.add(key);
        for (const [key, a] of prev.touched) touched.set(key, Math.min(a, touched.get(key) ?? 1));
        const cur = nextShape(rng, prev, [], figure, box, 0.46, touched);
        shapes.push(cur);
        box = {
          x0: Math.min(box.x0, cur.box.x0),
          y0: Math.min(box.y0, cur.box.y0),
          x1: Math.max(box.x1, cur.box.x1),
          y1: Math.max(box.y1, cur.box.y1),
        };
        const onPrev = [...cur.cells.keys()].filter((key) => prev.cells.has(key)).length;
        const shared = [...cur.touched.keys()].filter((key) => touched.has(key)).length;
        if (shared === 0) {
          adjacent++;
          // Collée : les rectangles englobants se touchent.
          const gx = Math.max(prev.box.x0 - cur.box.x1, cur.box.x0 - prev.box.x1);
          const gy = Math.max(prev.box.y0 - cur.box.y1, cur.box.y0 - prev.box.y1);
          expect(Math.max(gx, gy)).toBeLessThanOrEqual(1e-9);
        } else {
          overlapping++;
          expect(onPrev / cur.cells.size).toBeGreaterThanOrEqual(0.1 - 1e-9);
          expect(onPrev / cur.cells.size).toBeLessThanOrEqual(0.2 + 1e-9);
        }
      }
    }
    expect(adjacent).toBeGreaterThan(0);
    expect(overlapping).toBeGreaterThan(adjacent);
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
