// Simulation : des joueurs automatiques jouent 60 parties chacun, pour estimer la difficulté.
// Résultat affiché avec : npm run sim
//  - « au hasard » pose n'importe où (comme un joueur qui ne réfléchit pas) ;
//  - « soigneux » évite de bloquer ses autres pièces et de laisser des trous isolés ;
//  - « expert » évite en plus de couper l'espace libre en plusieurs morceaux.
// Plus l'écart entre les trois est grand, plus la partie dépend du joueur et pas de la chance.

import { it } from 'vitest';
import { Game } from '../src/game';
import { Rng } from '../src/rng';
import { cellKey } from '../src/shapes';

function isolatedCells(g: Game): number {
  return [...g.active.cells.values()].filter(
    (c) =>
      !g.filled.has(c.key) &&
      [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => {
        const k = cellKey(c.i + a, c.j + b);
        return !g.active.cells.has(k) || g.filled.has(k);
      }),
  ).length;
}

type Level = 'au hasard' | 'soigneux' | 'expert';

function play(seed: number, level: Level) {
  const g = new Game(seed, 0.46);
  const rng = new Rng(seed * 31);
  let moves = 0;
  let singles = 0;
  let dealt = 0;
  const seen = new Set<number>();
  while (!g.over && moves < 1000) {
    for (const p of g.hand) {
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        dealt++;
        if (p.cells.length === 1) singles++;
      }
    }
    const opts: { slot: number; x: number; y: number }[] = [];
    g.hand.forEach((p, slot) => {
      if (p) for (const a of g.anchors(p)) opts.push({ slot, ...a });
    });
    let best = rng.pick(opts);
    if (level !== 'au hasard') {
      let bestScore = -Infinity;
      for (const o of rng.shuffle(opts).slice(0, level === 'expert' ? 80 : 30)) {
        const saved = new Set(g.filled);
        for (const c of g.hand[o.slot]!.cells) g.filled.add(cellKey(o.x + c.dx, o.y + c.dy));
        let score = g.hand.filter((p, s) => s !== o.slot && p && g.fits(p)).length * 3 - isolatedCells(g) * 2;
        if (level === 'expert') {
          const regions = g.freeRegions();
          score -= Math.max(0, regions.length - 1) * 3 + regions.filter((r) => r.length <= 3).length * 2;
        }
        g.filled = saved;
        if (score > bestScore) [best, bestScore] = [o, score];
      }
    }
    g.place(best.slot, best.x, best.y);
    moves++;
  }
  return { shapes: g.shapesCompleted, moves, singles, dealt };
}

it('simulation de parties', () => {
  for (const level of ['au hasard', 'soigneux', 'expert'] as Level[]) {
    const runs = Array.from({ length: 60 }, (_, k) => play(k + 1, level));
    const avg = (f: (r: (typeof runs)[0]) => number) =>
      (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
    const shapes = runs.map((r) => r.shapes).sort((a, b) => a - b);
    const singles = runs.reduce((a, r) => a + r.singles, 0) / runs.reduce((a, r) => a + r.dealt, 0);
    console.warn(
      level.padEnd(9),
      '| formes moy', avg((r) => r.shapes),
      '| médiane', shapes[shapes.length >> 1],
      '| max', shapes[shapes.length - 1],
      '| poses moy', avg((r) => r.moves),
      '| cubes seuls', (singles * 100).toFixed(1) + ' %',
      '| ≤ 2 formes', runs.filter((r) => r.shapes <= 2).length + '/60',
      '| > 40 formes', runs.filter((r) => r.shapes > 40).length + '/60',
    );
  }
}, 120000);
