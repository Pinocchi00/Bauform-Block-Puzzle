import { describe, expect, it } from 'vitest';
import { GRACE_SHAPES } from '../src/config';
import { Game, type Piece, type PieceCell } from '../src/game';
import { canTile } from '../src/planner';
import { firstShape, nextShape } from '../src/generator';
import { Rng } from '../src/rng';
import { Shape, cellKey } from '../src/shapes';

const sig = (cells: PieceCell[]) => cells.map((c) => c.dx + ':' + c.dy).join(' ');

/** Toutes les pièces ordinaires de n cases (toutes orientations), cases triées ligne par ligne. */
function catalog(n: number): PieceCell[][] {
  let level: PieceCell[][] = [[{ dx: 0, dy: 0 }]];
  for (let k = 1; k < n; k++) {
    const next = new Map<string, PieceCell[]>();
    for (const p of level) {
      for (const c of p) {
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (p.some((q) => q.dx === c.dx + a && q.dy === c.dy + b)) continue;
          const raw = [...p, { dx: c.dx + a, dy: c.dy + b }];
          const x = Math.min(...raw.map((q) => q.dx));
          const y = Math.min(...raw.map((q) => q.dy));
          const cells = raw.map((q) => ({ dx: q.dx - x, dy: q.dy - y })).sort((u, v) => u.dy - v.dy || u.dx - v.dx);
          next.set(sig(cells), cells);
        }
      }
    }
    level = [...next.values()];
  }
  return level;
}

describe('aide discrète : peut-on encore finir ?', () => {
  const rect = (w: number, h: number) => new Set(Array.from({ length: w * h }, (_, k) => cellKey(k % w, Math.floor(k / w))));
  const fillers = [4, 3, 2].flatMap((n) => catalog(n));

  it('le catalogue compte 1, 2, 6 et 19 pièces de 1 à 4 cases', () => {
    expect([1, 2, 3, 4].map((n) => catalog(n).length)).toEqual([1, 2, 6, 19]);
  });

  it('un rectangle se remplit, avec ou sans pièce imposée qui y tient', () => {
    expect(canTile(rect(3, 4), [], fillers)).toBe(true);
    expect(canTile(rect(3, 4), [catalog(4).find((p) => sig(p) === '0:0 1:0 0:1 1:1')!], fillers)).toBe(true);
  });

  it('une pièce imposée trop grande, ou une croix sans cube, ne se remplit pas', () => {
    expect(canTile(rect(2, 2), [catalog(4).find((p) => sig(p) === '0:0 1:0 2:0 3:0')!], fillers)).toBe(false);
    const cross = new Set([cellKey(1, 0), cellKey(0, 1), cellKey(1, 1), cellKey(2, 1), cellKey(1, 2)]);
    expect(canTile(cross, [], fillers)).toBe(false);
    expect(canTile(cross, [[{ dx: 0, dy: 0 }]], fillers)).toBe(true);
  });

  it('une case déjà isolée peut compter sur un cube', () => {
    const cells = new Set([cellKey(0, 0), cellKey(1, 0), cellKey(5, 5)]);
    expect(canTile(cells, [], fillers)).toBe(true);
  });
});

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

  it('les formes tirées sont « propres » : chaque bout de forme est une vraie case', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new Rng(seed);
      let prev = firstShape(rng);
      const figure = new Set(prev.cells.keys());
      const box = { ...prev.box };
      for (let k = 0; k < 10; k++) {
        for (const [key, a] of prev.touched) {
          expect(prev.cells.has(key)).toBe(true);
          expect(a).toBeGreaterThanOrEqual(0.25 - 1e-6);
        }
        prev = nextShape(rng, prev, [], figure, box, 0.46);
        for (const key of prev.cells.keys()) figure.add(key);
        Object.assign(box, {
          x0: Math.min(box.x0, prev.box.x0),
          y0: Math.min(box.y0, prev.box.y0),
          x1: Math.max(box.x1, prev.box.x1),
          y1: Math.max(box.y1, prev.box.y1),
        });
      }
    }
  });

  it('une case carrée se pose sur n’importe quelle case libre, bords pointus ou arrondis compris', () => {
    const game = new Game(5);
    const single = { id: 0, cells: [{ dx: 0, dy: 0 }], w: 1, h: 1, shape: game.active };
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
  it('au début d’une forme, les 3 pièces distribuées rentrent', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const game = new Game(seed);
      for (const p of game.hand) expect(p && game.fits(p)).toBe(true);
    }
  });

  it('il y a toujours 3 pièces en main', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { game } = playCarefulGame(seed);
      expect(game.hand.filter((p) => p).length).toBe(3);
    }
  });

  it('les pièces grossissent et l’aide discrète joue moins dans les longues parties', () => {
    const game = new Game(1);
    const at = (n: number) => {
      game.shapesCompleted = n;
      return { big: game.sizeWeights()[3], help: game.helpChance() };
    };
    expect(at(0).help).toBe(1); // période de grâce
    expect(at(GRACE_SHAPES).big).toBe(at(10).big);
    expect(at(20).big).toBeGreaterThan(at(10).big);
    expect(at(20).help).toBeLessThan(at(10).help);
    expect(at(60)).toEqual(at(35));
  });

  it('les pièces rapetissent quand la forme est presque pleine', () => {
    const game = new Game(2);
    const start = game.sizeWeights();
    const cells = [...game.active.cells.keys()];
    for (const key of cells.slice(0, cells.length - 4)) game.filled.add(key);
    const end = game.sizeWeights();
    expect(end[3]).toBeLessThan(start[3]);
    expect(end[1]).toBeGreaterThan(start[1]);
  });

  it('l’aide discrète donne une pièce ordinaire qui garde la forme finissable avec la main', () => {
    const fillers = [4, 3, 2].flatMap((n) => catalog(n));
    let helped = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { game } = playCarefulGame(seed, 8);
      if (game.over) continue;
      const free = new Set([...game.active.cells.keys()].filter((k) => !game.filled.has(k)));
      const hand = game.hand.filter((p): p is Piece => !!p).map((p) => p.cells);
      if (!canTile(free, hand, fillers)) continue;
      const left = free.size - hand.reduce((n, c) => n + c.length, 0);
      const piece = game['helpedPiece'](2);
      if (!piece || left <= 0) continue;
      helped++;
      expect(catalog(piece.cells.length).map(sig)).toContain(sig(piece.cells));
      expect(canTile(free, [...hand, piece.cells], fillers)).toBe(true);
    }
    expect(helped).toBeGreaterThan(10);
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

  it('une nouvelle forme laisse toujours un seul espace libre d’un seul tenant', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { game } = playCarefulGame(seed, 150);
      // Chaque forme de la partie, telle qu'elle était à son arrivée.
      for (let k = 1; k < game.shapes.length; k++) {
        const covered = new Set(game.shapes.slice(0, k).flatMap((sh) => [...sh.cells.keys()]));
        const free = [...game.shapes[k].cells.keys()].filter((key) => !covered.has(key));
        const seen = new Set([free[0]]);
        const todo = [free[0]];
        while (todo.length) {
          const [i, j] = todo.pop()!.split(',').map(Number);
          for (const key of [cellKey(i + 1, j), cellKey(i - 1, j), cellKey(i, j + 1), cellKey(i, j - 1)]) {
            if (free.includes(key) && !seen.has(key)) {
              seen.add(key);
              todo.push(key);
            }
          }
        }
        expect(seen.size).toBe(free.length);
      }
    }
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
          // Collée : les rectangles englobants se touchent (à moins d'une demi-case près).
          const gx = Math.max(prev.box.x0 - cur.box.x1, cur.box.x0 - prev.box.x1);
          const gy = Math.max(prev.box.y0 - cur.box.y1, cur.box.y0 - prev.box.y1);
          expect(Math.abs(Math.max(gx, gy))).toBeLessThan(0.5);
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
