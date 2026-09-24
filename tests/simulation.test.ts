// Simulation : des joueurs automatiques jouent 60 parties, pour estimer leur longueur.
// Résultat affiché avec : npm run sim
import { it } from 'vitest';
import { Game } from '../src/game';
import { Rng } from '../src/rng';

// Bot "prudent" : préfère la pose qui laisse le plus de pièces jouables.
it('simulation de parties', () => {
  for (const mode of ['random', 'careful']) {
    const res: number[] = []; const moves: number[] = []; const kinds: Record<string, number> = {};
    for (let seed = 1; seed <= 60; seed++) {
      const g = new Game(seed); const rng = new Rng(seed * 31);
      let m = 0;
      while (!g.over && m < 3000) {
        const opts: any[] = [];
        g.hand.forEach((p, slot) => { if (p) for (const a of g.anchors(p)) opts.push({ slot, ...a }); });
        let o = rng.pick(opts);
        if (mode === 'careful') {
          let best = -1;
          for (const c of rng.shuffle(opts).slice(0, 40)) {
            const saved = new Set(g.filled);
            for (const pc of g.hand[c.slot]!.cells) g.filled.add(`${c.x + pc.dx},${c.y + pc.dy}`);
            const score = g.hand.filter((p, s) => s !== c.slot && p && g.fits(p)).length;
            g.filled = saved;
            if (score > best) { best = score; o = c; }
          }
        }
        g.place(o.slot, o.x, o.y); m++;
      }
      res.push(g.shapesCompleted); moves.push(m);
      for (const s of g.shapes) kinds[s.spec.kind] = (kinds[s.spec.kind] || 0) + 1;
    }
    const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
    console.warn([mode, 'formes moy', avg(res), 'max', Math.max(...res), 'poses moy', avg(moves), JSON.stringify(kinds)].join(' '));
  }
}, 120000);
