// Tirage des nouvelles formes : type, taille, orientation et position aléatoires.
// En général elles chevauchent la précédente de 10 à 20 % ; parfois elles sont posées
// à côté, séparées par un espace de 10 à 20 % de leur taille.

import {
  OVERLAP_MAX,
  OVERLAP_MIN,
  SPACED_SHAPE_CHANCE,
  SPACING_MAX,
  SPACING_MIN,
  SHAPE_COLORS,
  SHAPE_COLOR_WEIGHTS,
  SHAPE_MAX_CELLS,
  SHAPE_MAX_SPAN,
  SHAPE_MIN_CELLS,
} from './config';
import type { Rng } from './rng';
import { Shape, cellKey, type ShapeKind, type ShapeSpec } from './shapes';

const KINDS: ShapeKind[] = ['triangle', 'circle', 'halfDisc', 'quarterDisc', 'bullet', 'square', 'rect'];
const KIND_WEIGHTS = [1.4, 1, 1, 1, 0.9, 0.7, 0.8];

/** Nombre minimum de cellules à remplir dans une nouvelle forme. */
const MIN_FREE_CELLS = 6;

function randomSpec(rng: Rng, avoid?: ShapeKind): ShapeSpec {
  let kind = KINDS[rng.weighted(KIND_WEIGHTS)];
  if (kind === avoid) kind = KINDS[rng.weighted(KIND_WEIGHTS)];
  let a = 0;
  let b = 0;
  switch (kind) {
    case 'triangle':
      a = rng.int(4, 8);
      b = a;
      // Parfois une pente plus douce ou plus raide (côtés dans un rapport 2).
      if (rng.chance(0.3)) {
        if (a <= 5) b = a * 2;
        else b = Math.round(a / 2);
        if (rng.chance(0.5)) [a, b] = [b, a];
      }
      break;
    case 'circle':
      // b = 1 : centre au milieu d'une cellule (rayon en x,5), sinon sur un coin (rayon entier).
      b = rng.chance(0.5) ? 1 : 0;
      a = b === 1 ? rng.pick([1.5, 2.5, 3.5]) : rng.int(2, 3);
      break;
    case 'halfDisc':
      a = rng.int(3, 4);
      break;
    case 'quarterDisc':
      a = rng.int(4, 6);
      break;
    case 'bullet':
      b = rng.pick([2, 4]);
      a = b === 2 ? rng.int(4, 8) : rng.int(2, 5);
      break;
    case 'square':
      a = rng.int(4, 6);
      b = a;
      break;
    case 'rect':
      a = rng.int(2, 7);
      b = rng.int(2, 7);
      if (a === b) b = a + 1;
      break;
  }
  return { kind, a, b, rot: rng.int(0, 3), ox: 0, oy: 0 };
}

/** Couleur tirée au hasard, différente des couleurs à éviter (les deux formes précédentes). */
function pickColor(rng: Rng, avoid: string[] = []): string {
  const weights = SHAPE_COLORS.map((c, i) => (avoid.includes(c) ? 0 : SHAPE_COLOR_WEIGHTS[i]));
  return SHAPE_COLORS[rng.weighted(weights)];
}

/** Première forme de la partie, autour de l'origine. */
export function firstShape(rng: Rng): Shape {
  for (;;) {
    const shape = new Shape(randomSpec(rng), pickColor(rng));
    const n = shape.cells.size;
    if (n >= 14 && n <= 30 && fitsSpan(shape)) return shape;
  }
}

/** Vrai si la forme ne dépasse pas SHAPE_MAX_SPAN cases en largeur et en hauteur. */
function fitsSpan(shape: Shape): boolean {
  const b = shape.box;
  return b.x1 - b.x0 <= SHAPE_MAX_SPAN + 1e-9 && b.y1 - b.y0 <= SHAPE_MAX_SPAN + 1e-9;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Forme suivante. On essaie des formes au hasard ; pour chacune, on cherche les positions
 * où elle chevauche la précédente comme il faut, puis on en choisit une parmi celles
 * qui gardent la figure la plus compacte (pour que la caméra n'ait pas à trop reculer).
 *
 * @param avoidColors couleurs des dernières formes, à ne pas reprendre
 * @param figure cellules déjà couvertes par la figure
 * @param figureBox rectangle qui englobe la figure
 * @param aspect largeur / hauteur de la zone de jeu à l'écran
 */
export function nextShape(
  rng: Rng,
  previous: Shape,
  avoidColors: string[],
  figure: Set<string>,
  figureBox: Box,
  aspect: number,
): Shape {
  const spaced = rng.chance(SPACED_SHAPE_CHANCE);
  for (let attempt = 0; attempt < 300; attempt++) {
    // Si rien ne convient, on relâche peu à peu les contraintes.
    const phase = Math.floor(attempt / 100);
    const slack = phase === 0 ? 0 : 0.1;
    const figureMax = phase === 0 ? OVERLAP_MAX + 0.1 : 0.5;
    const base = new Shape(randomSpec(rng, previous.spec.kind), '');
    const cells = [...base.cells.values()];
    const n = cells.length;
    if (n < SHAPE_MIN_CELLS || n > SHAPE_MAX_CELLS || !fitsSpan(base)) continue;

    const fitOf = (dx: number, dy: number) => {
      const box = {
        x0: Math.min(figureBox.x0, base.box.x0 + dx),
        y0: Math.min(figureBox.y0, base.box.y0 + dy),
        x1: Math.max(figureBox.x1, base.box.x1 + dx),
        y1: Math.max(figureBox.y1, base.box.y1 + dy),
      };
      // Plus « fit » est grand, plus la figure reste grande à l'écran.
      const fit = Math.min(aspect / (box.x1 - box.x0), 1 / (box.y1 - box.y0));
      // À égalité, on préfère rester dans l'axe vertical de la figure (elle grandit en hauteur).
      const cx = (base.box.x0 + base.box.x1) / 2 + dx;
      const drift = Math.abs(cx - (figureBox.x0 + figureBox.x1) / 2) / (figureBox.x1 - figureBox.x0 + 1);
      return fit * (1 - 0.15 * drift);
    };

    // Forme espacée (si ça ne marche pas après quelques essais, on revient au chevauchement).
    const options: Option[] = spaced && attempt < 60 ? spacedOptions(base, previous, figure, fitOf) : [];
    if (spaced && attempt < 60 && !options.length) continue;
    // En dernier recours, on accepte de se poser n'importe où sur la figure.
    const pb = phase < 2 ? previous.box : figureBox;
    const bb = base.box;
    const overlapping = !options.length;
    for (let dy = Math.floor(pb.y0 - bb.y1); overlapping && dy <= Math.ceil(pb.y1 - bb.y0); dy++) {
      for (let dx = Math.floor(pb.x0 - bb.x1); dx <= Math.ceil(pb.x1 - bb.x0); dx++) {
        let onPrevious = 0;
        let onFigure = 0;
        for (const c of cells) {
          const k = cellKey(c.i + dx, c.j + dy);
          if (previous.cells.has(k)) onPrevious++;
          if (figure.has(k)) onFigure++;
        }
        const ratio = (phase < 2 ? onPrevious : onFigure) / n;
        if (ratio < OVERLAP_MIN - slack || ratio > OVERLAP_MAX + slack) continue;
        if (onFigure / n > figureMax) continue;
        if (n - onFigure < MIN_FREE_CELLS) continue;
        options.push({ dx, dy, fit: fitOf(dx, dy) });
      }
    }
    if (!options.length) continue;
    // On garde les positions qui laissent la figure la plus compacte, à la proportion
    // de l'écran (elle grandit donc surtout en hauteur), et on tire au hasard parmi elles.
    options.sort((p, q) => q.fit - p.fit);
    const best = options.slice(0, Math.max(1, Math.ceil(options.length * 0.06)));
    const { dx, dy } = rng.pick(best);
    return new Shape({ ...base.spec, ox: dx, oy: dy }, pickColor(rng, avoidColors));
  }
  throw new Error('Impossible de placer une nouvelle forme');
}

type Option = { dx: number; dy: number; fit: number };

/**
 * Positions où la forme est posée à côté de la précédente, sans la toucher :
 * séparée d'un espace de 10 à 20 % de sa taille (au moins une case), face à elle,
 * et à bonne distance de toute la figure.
 */
function spacedOptions(
  base: Shape,
  previous: Shape,
  figure: Set<string>,
  fitOf: (dx: number, dy: number) => number,
): Option[] {
  const bb = base.box;
  const pb = previous.box;
  const size = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const gapMin = Math.max(1, Math.round(SPACING_MIN * size));
  const gapMax = Math.max(gapMin, Math.round(SPACING_MAX * size));
  const cells = [...base.cells.values()];
  const options: Option[] = [];
  for (let dy = Math.floor(pb.y0 - bb.y1 - gapMax); dy <= Math.ceil(pb.y1 - bb.y0 + gapMax); dy++) {
    for (let dx = Math.floor(pb.x0 - bb.x1 - gapMax); dx <= Math.ceil(pb.x1 - bb.x0 + gapMax); dx++) {
      // Espace entre les deux rectangles englobants, horizontalement et verticalement.
      const gx = Math.max(pb.x0 - (bb.x1 + dx), bb.x0 + dx - pb.x1);
      const gy = Math.max(pb.y0 - (bb.y1 + dy), bb.y0 + dy - pb.y1);
      const sideBySide = gx >= gapMin && gx <= gapMax && gy <= -2;
      const aboveBelow = gy >= gapMin && gy <= gapMax && gx <= -2;
      if (!sideBySide && !aboveBelow) continue;
      // Aucune case de la figure trop près.
      let tooClose = false;
      for (const c of cells) {
        for (let a = -gapMin; a <= gapMin && !tooClose; a++) {
          for (let b = -gapMin; b <= gapMin; b++) {
            if (figure.has(cellKey(c.i + dx + a, c.j + dy + b))) {
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) break;
      }
      if (!tooClose) options.push({ dx, dy, fit: fitOf(dx, dy) });
    }
  }
  return options;
}
