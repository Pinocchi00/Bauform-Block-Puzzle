// Tirage des nouvelles formes : type, taille, orientation et position aléatoires.
// Elles se collent contre la précédente, ou la chevauchent un peu sur des parties droites.

import {
  OVERLAP_MAX,
  OVERLAP_MIN,
  ADJACENT_SHAPE_CHANCE,
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
 * Forme suivante. Deux façons de la poser, comme sur une affiche Bauhaus :
 *  - collée contre la précédente (bord contre bord, sans espace ni chevauchement) ;
 *  - ou en chevauchant la précédente de 5 à 15 %, mais seulement sur des cases pleines des
 *    deux formes : jamais sur un arrondi ou une diagonale, qu'on ne peut pas découper en
 *    carrés sans que ça se voie.
 * Parmi les positions possibles, on garde celles qui laissent la figure la plus compacte
 * (à la proportion de l'écran, elle grandit donc surtout en hauteur).
 *
 * @param avoidColors couleurs des dernières formes, à ne pas reprendre
 * @param figure cellules déjà couvertes par la figure
 * @param figureBox rectangle qui englobe la figure
 * @param aspect largeur / hauteur de la zone de jeu à l'écran
 * @param touched cases touchées par la figure (même d'un petit bout), avec la plus petite
 *   part couverte par une forme
 */
export function nextShape(
  rng: Rng,
  previous: Shape,
  avoidColors: string[],
  figure: Set<string>,
  figureBox: Box,
  aspect: number,
  touched: Map<string, number> = new Map([...figure].map((k) => [k, 1])),
): Shape {
  const adjacentFirst = rng.chance(ADJACENT_SHAPE_CHANCE);
  for (let attempt = 0; attempt < 400; attempt++) {
    const base = new Shape(randomSpec(rng, previous.spec.kind), '');
    const n = base.cells.size;
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

    // Au-delà de 300 essais (très rare), on accepte de se coller n'importe où contre la figure.
    const target = attempt < 300 ? previous.box : figureBox;
    const overlap = () => (attempt < 300 ? overlapOptions(base, previous, figure, touched, fitOf) : []);
    const adjacent = () => adjacentOptions(base, target, touched, fitOf);
    let options = adjacentFirst ? adjacent() : overlap();
    if (!options.length) options = adjacentFirst ? overlap() : adjacent();
    if (!options.length) continue;

    options.sort((p, q) => q.fit - p.fit);
    const best = options.slice(0, Math.max(1, Math.ceil(options.length * 0.06)));
    const { dx, dy } = rng.pick(best);
    return new Shape({ ...base.spec, ox: dx, oy: dy }, pickColor(rng, avoidColors));
  }
  throw new Error('Impossible de placer une nouvelle forme');
}

type Option = { dx: number; dy: number; fit: number };

const FULL = 1 - 1e-6;
const keyOf = (k: string, dx: number, dy: number) => {
  const [i, j] = k.split(',').map(Number);
  return cellKey(i + dx, j + dy);
};

/**
 * Positions où la forme chevauche la précédente de 5 à 15 % de ses cases, uniquement sur
 * des cases pleines des deux côtés (aucun arrondi ni diagonale dans la zone commune).
 */
function overlapOptions(
  base: Shape,
  previous: Shape,
  figure: Set<string>,
  touched: Map<string, number>,
  fitOf: (dx: number, dy: number) => number,
): Option[] {
  const bb = base.box;
  const pb = previous.box;
  const n = base.cells.size;
  const options: Option[] = [];
  for (let dy = Math.floor(pb.y0 - bb.y1); dy <= Math.ceil(pb.y1 - bb.y0); dy++) {
    for (let dx = Math.floor(pb.x0 - bb.x1); dx <= Math.ceil(pb.x1 - bb.x0); dx++) {
      let shared = 0;
      let onPrevious = 0;
      let clean = true;
      for (const [k, a] of base.touched) {
        const other = touched.get(keyOf(k, dx, dy));
        if (other === undefined) continue;
        // Case commune : elle doit être pleine pour la nouvelle forme et pour la figure.
        if (a < FULL || other < FULL) {
          clean = false;
          break;
        }
        shared++;
        if (previous.cells.has(keyOf(k, dx, dy))) onPrevious++;
      }
      if (!clean || shared === 0) continue;
      const ratio = onPrevious / n;
      if (ratio < OVERLAP_MIN || ratio > OVERLAP_MAX) continue;
      if (shared / n > OVERLAP_MAX + 0.05) continue;
      let onFigure = 0;
      for (const k of base.cells.keys()) if (figure.has(keyOf(k, dx, dy))) onFigure++;
      if (n - onFigure < MIN_FREE_CELLS) continue;
      options.push({ dx, dy, fit: fitOf(dx, dy) });
    }
  }
  return options;
}

/**
 * Positions où la forme est collée contre la cible (bord contre bord de leurs rectangles,
 * face à face sur au moins deux cases), sans toucher aucune autre forme de la figure.
 */
function adjacentOptions(
  base: Shape,
  target: Box,
  touched: Map<string, number>,
  fitOf: (dx: number, dy: number) => number,
): Option[] {
  const bb = base.box;
  const options: Option[] = [];
  for (let dy = Math.floor(target.y0 - bb.y1); dy <= Math.ceil(target.y1 - bb.y0); dy++) {
    for (let dx = Math.floor(target.x0 - bb.x1); dx <= Math.ceil(target.x1 - bb.x0); dx++) {
      // Écart entre les deux rectangles englobants, horizontalement et verticalement.
      const gx = Math.max(target.x0 - (bb.x1 + dx), bb.x0 + dx - target.x1);
      const gy = Math.max(target.y0 - (bb.y1 + dy), bb.y0 + dy - target.y1);
      const sideBySide = Math.abs(gx) < 1e-9 && gy <= -2;
      const aboveBelow = Math.abs(gy) < 1e-9 && gx <= -2;
      if (!sideBySide && !aboveBelow) continue;
      let free = true;
      for (const k of base.touched.keys()) {
        if (touched.has(keyOf(k, dx, dy))) {
          free = false;
          break;
        }
      }
      if (free) options.push({ dx, dy, fit: fitOf(dx, dy) });
    }
  }
  return options;
}
