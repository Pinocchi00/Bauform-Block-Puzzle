// L'aide discrète : vérifie en secret qu'une forme peut encore être finie.
// Question posée : peut-on remplir exactement les cases libres avec les pièces imposées (celles de
// la main) plus des pièces ordinaires de 2 à 4 cases ? Le cube seul n'est permis que pour une case
// déjà isolée : on ne compte pas sur des cubes qui n'arriveront peut-être jamais.

import { cellKey } from './shapes';

export interface PlanCell {
  dx: number;
  dy: number;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Vrai si les cases `free` (clés « i,j ») peuvent être remplies exactement en utilisant toutes les
 * pièces `required`, complétées par des pièces de `fillers`. Chaque pièce a ses cases triées
 * ligne par ligne (dy puis dx), comme le fait `normalize`.
 * La recherche s'arrête après `budget` essais : dans le doute, on répond non (pas d'aide).
 */
export function canTile(
  free: Set<string>,
  required: PlanCell[][],
  fillers: PlanCell[][],
  budget = 1200,
): boolean {
  const need = required.reduce((n, p) => n + p.length, 0);
  if (need > free.size) return false;

  const pos = [...free].map((k) => k.split(',').map(Number) as [number, number]);
  pos.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const open = new Set(free);
  const isolated = new Set(
    pos.filter(([i, j]) => DIRS.every(([a, b]) => !free.has(cellKey(i + a, j + b)))).map(([i, j]) => cellKey(i, j)),
  );
  const cube: PlanCell[] = [{ dx: 0, dy: 0 }];
  const used = required.map(() => false);
  let left = need;
  let nodes = 0;

  const tryPiece = (cells: PlanCell[], i: number, j: number, k: number): boolean => {
    // La première case de la pièce (en haut à gauche) tombe sur la première case libre.
    const ox = i - cells[0].dx;
    const oy = j - cells[0].dy;
    const keys = cells.map((c) => cellKey(ox + c.dx, oy + c.dy));
    if (!keys.every((key) => open.has(key))) return false;
    for (const key of keys) open.delete(key);
    const ok = search(k);
    for (const key of keys) open.add(key);
    return ok;
  };

  const search = (k: number): boolean => {
    if (++nodes > budget) return false;
    while (k < pos.length && !open.has(cellKey(pos[k][0], pos[k][1]))) k++;
    if (k === pos.length) return left === 0;
    if (left > open.size) return false;
    const [i, j] = pos[k];
    const seen = new Set<string>();
    for (let r = 0; r < required.length; r++) {
      const sig = required[r].map((c) => c.dx + ':' + c.dy).join(' ');
      if (used[r] || seen.has(sig)) continue;
      seen.add(sig);
      used[r] = true;
      left -= required[r].length;
      const ok = tryPiece(required[r], i, j, k);
      used[r] = false;
      left += required[r].length;
      if (ok) return true;
    }
    // Les cases qui ne sont pas réservées aux pièces de la main vont à des pièces ordinaires.
    if (open.size - left <= 0) return false;
    for (const cells of fillers) {
      if (cells.length > open.size - left) continue;
      if (tryPiece(cells, i, j, k)) return true;
    }
    return isolated.has(cellKey(i, j)) && open.size - left >= 1 && tryPiece(cube, i, j, k);
  };

  return search(0);
}
