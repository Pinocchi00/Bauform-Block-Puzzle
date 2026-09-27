// Dessin en SVG : la figure, les pièces, l'aperçu de pose et le décor de fond.
// Ces fonctions renvoient du texte SVG ; main.ts le place dans la page.

import { COLORS, GAP_PX, OUTLINE_PX } from './config';
import type { Game, Piece } from './game';
import { polyPath } from './geometry';
import type { Rng } from './rng';
import { cellKey, type Shape } from './shapes';

/** 'play' : en jeu. 'end' : écran de fin (dernière forme en pointillés). 'poster' : plein écran. */
export type FigureMode = 'play' | 'end' | 'poster';

// Les tuiles d'une forme ne changent pas : on garde leurs chemins en mémoire.
const tileCache = new WeakMap<Shape, Map<string, string>>();

function tilePath(shape: Shape, key: string, g: number): string {
  let cache = tileCache.get(shape);
  if (!cache) tileCache.set(shape, (cache = new Map()));
  const id = g.toFixed(5) + '|' + key;
  let d = cache.get(id);
  if (d === undefined) {
    const c = shape.cells.get(key)!;
    d = shape.tiles(c.i, c.j, g).map((t) => polyPath(t)).join('');
    cache.set(id, d);
  }
  return d;
}

function tilesPath(shape: Shape, keys: Iterable<string>, g: number): string {
  let d = '';
  for (const k of keys) d += tilePath(shape, k, g);
  return d;
}

/** Rectangle qui englobe la figure. */
export function figureBounds(game: Game) {
  const shapes = game.shapes;
  return {
    x0: Math.min(...shapes.map((s) => s.box.x0)),
    y0: Math.min(...shapes.map((s) => s.box.y0)),
    x1: Math.max(...shapes.map((s) => s.box.x1)),
    y1: Math.max(...shapes.map((s) => s.box.y1)),
  };
}

/** Forme terminée : un aplat uni et opaque de sa couleur, sans tuiles. */
function flatShape(shape: Shape): string {
  return `<path fill="${shape.color}" d="${polyPath(shape.outline)}"/>`;
}

/**
 * Aplat uni de la forme limité à certaines cases (sans joints visibles entre elles).
 * Sert pour la forme inachevée à la fin : les cases vides restent des trous.
 */
function cellsFlat(shape: Shape, keys: Iterable<string>, color: string, id: string): string {
  const e = 0.002;
  let rects = '';
  for (const key of keys) {
    const c = shape.cells.get(key);
    if (!c) continue;
    for (const r of shape.rects(c.i, c.j)) {
      rects += `<rect x="${r.i0 - e}" y="${r.j0 - e}" width="${r.i1 - r.i0 + 1 + 2 * e}" height="${r.j1 - r.j0 + 1 + 2 * e}"/>`;
    }
  }
  if (!rects) return '';
  return (
    `<clipPath id="${id}">${rects}</clipPath>` +
    `<path fill="${color}" clip-path="url(#${id})" d="${polyPath(shape.outline)}"/>`
  );
}

/**
 * Cases de la forme active déjà couvertes par une ancienne forme, regroupées par couleur.
 * Elles prennent la couleur de cette ancienne forme : là où elle chevauche la nouvelle,
 * elle entre proprement dans sa grille, sans bouts d'une autre couleur qui dépassent.
 */
function prefilledByColor(game: Game): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of game.prefilled) {
    const color = game.coverColor(key);
    groups.set(color, [...(groups.get(color) ?? []), key]);
  }
  return groups;
}

/**
 * La figure, en unités monde (1 = une cellule). g = gap des tuiles en unités monde.
 * Couleurs pleines, sans transparence. Là où deux formes se chevauchent, la plus ancienne
 * reste entière, par-dessus : la nouvelle forme vient se glisser autour d'elle.
 * @param id préfixe unique (deux figures peuvent être dans la page en même temps)
 */
export function figureMarkup(game: Game, g: number, mode: FigureMode, id = 'fig'): string {
  const last = game.shapes.length - 1;
  const active = game.active;
  let out = '<g>';

  const placed = [...game.filled].filter((k) => !game.prefilled.has(k));
  const covered = prefilledByColor(game);
  if (mode === 'play') {
    // Forme en cours : des tuiles, pour voir les cases à remplir.
    const d = tilesPath(active, placed, g);
    if (d) out += `<path fill="${active.color}" d="${d}"/>`;
    const empty = [...active.cells.keys()].filter((k) => !game.filled.has(k));
    out += `<path fill="${COLORS.shapeInside}" d="${tilesPath(active, empty, g)}"/>`;
    // Là où une ancienne forme la chevauche, elle se cale sur la grille : des blocs unis de sa
    // couleur, case par case. Dans la forme en cours, on ne voit donc jamais une courbe ou une
    // diagonale d'une autre forme couper une case : elle retrouve sa géométrie une fois finie.
    let n = 0;
    for (const [color, keys] of covered) out += cellsFlat(active, keys, color, `${id}-cover${n++}`);
    // Formes terminées (la plus ancienne au-dessus), masquées à l'intérieur de la forme en cours.
    const b = figureBounds(game);
    const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) + 10;
    out +=
      `<mask id="${id}-hole" maskUnits="userSpaceOnUse" x="${b.x0 - m}" y="${b.y0 - m}" width="${b.x1 - b.x0 + 2 * m}" height="${b.y1 - b.y0 + 2 * m}">` +
      `<rect x="${b.x0 - m}" y="${b.y0 - m}" width="${b.x1 - b.x0 + 2 * m}" height="${b.y1 - b.y0 + 2 * m}" fill="#fff"/>` +
      `<path d="${polyPath(active.outline)}" fill="#000"/></mask><g mask="url(#${id}-hole)">`;
    for (let idx = last - 1; idx >= 0; idx--) out += flatShape(game.shapes[idx]);
    out += '</g>';
  } else {
    out += cellsFlat(active, placed, active.color, id + '-last');
    let n = 0;
    for (const [color, keys] of covered) out += cellsFlat(active, keys, color, `${id}-cover${n++}`);
    // Formes terminées : la plus ancienne en dernier, donc au-dessus.
    for (let idx = last - 1; idx >= 0; idx--) out += flatShape(game.shapes[idx]);
  }

  if (mode === 'play') {
    out += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="${OUTLINE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  } else if (mode === 'end') {
    out += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
  }
  return out + '</g>';
}

/**
 * Traits fins de l'affiche de fin, en unités monde, calés sur les bords des formes.
 * Tirés au hasard à partir de la seed : chaque partie donne une composition différente.
 */
export function posterLinesMarkup(game: Game, rng: Rng): string {
  const b = figureBounds(game);
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const far = size * 20;
  const r = (a: number, c: number) => a + rng.next() * (c - a);
  const shapeEdge = (axis: 'x' | 'y') => {
    const s = rng.pick(game.shapes).box;
    return axis === 'x' ? rng.pick([s.x0, s.x1]) : rng.pick([s.y0, s.y1]);
  };
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke"/>`;

  let out = `<g stroke="${COLORS.black}" stroke-width="1" fill="none">`;
  // Une verticale et une horizontale qui traversent toute l'affiche.
  const vx = shapeEdge('x');
  out += line(vx, -far, vx, far);
  const hy = shapeEdge('y');
  out += line(-far, hy, far, hy);
  // Un trait qui part de la figure et file vers un bord.
  if (rng.chance(0.7)) {
    const y = shapeEdge('y');
    out += rng.chance(0.5) ? line(b.x0 - r(1, 3), y, far, y) : line(-far, y, b.x1 + r(1, 3), y);
  } else {
    const x = shapeEdge('x');
    out += rng.chance(0.5) ? line(x, b.y0 - r(1, 3), x, far) : line(x, -far, x, b.y1 + r(1, 3));
  }
  // Un grand cercle, centré sur un coin d'une forme.
  const s = rng.pick(game.shapes).box;
  const cx = rng.pick([s.x0, s.x1]);
  const cy = rng.pick([s.y0, s.y1]);
  out += `<circle cx="${cx}" cy="${cy}" r="${size * r(0.35, 0.65)}" vector-effect="non-scaling-stroke"/>`;
  return out + '</g>';
}

/** Une pièce (toujours en cases carrées), en pixels, coin haut-gauche en (0,0). */
export function pieceMarkup(piece: Piece, cellPx: number): string {
  const h = GAP_PX / 2;
  let d = '';
  for (const c of piece.cells) {
    const x = c.dx * cellPx + h;
    const y = c.dy * cellPx + h;
    const w = cellPx - GAP_PX;
    d += `M${x} ${y}h${w}v${w}h${-w}Z`;
  }
  return `<path fill="${piece.shape.color}" d="${d}"/>`;
}

/** Aperçu aimanté : teinte légère + contour en pointillés, en unités monde. */
export function previewMarkup(piece: Piece, ax: number, ay: number, g: number): string {
  const shape = piece.shape;
  const inPiece = new Set(piece.cells.map((c) => cellKey(ax + c.dx, ay + c.dy)));
  let tiles = '';
  let edges = '';
  const eps = 1e-6;
  for (const c of piece.cells) {
    const i = ax + c.dx;
    const j = ay + c.dy;
    for (const t of shape.tiles(i, j, g)) tiles += polyPath(t);
    // Contour : on ne garde que les côtés qui ne touchent pas une autre case de la pièce.
    const poly = shape.piece(i, j);
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k];
      const q = poly[(k + 1) % poly.length];
      let neighbour: string | null = null;
      if (Math.abs(p.x - q.x) < eps && Math.abs(p.x - (i + 1)) < eps) neighbour = cellKey(i + 1, j);
      else if (Math.abs(p.x - q.x) < eps && Math.abs(p.x - i) < eps) neighbour = cellKey(i - 1, j);
      else if (Math.abs(p.y - q.y) < eps && Math.abs(p.y - (j + 1)) < eps) neighbour = cellKey(i, j + 1);
      else if (Math.abs(p.y - q.y) < eps && Math.abs(p.y - j) < eps) neighbour = cellKey(i, j - 1);
      if (neighbour && inPiece.has(neighbour)) continue;
      edges += `M${p.x} ${p.y}L${q.x} ${q.y}`;
    }
  }
  return (
    `<path fill="${shape.color}" fill-opacity="0.28" d="${tiles}"/>` +
    `<path d="${edges}" fill="none" stroke="${COLORS.black}" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`
  );
}

/** Décor de fond : quelques traits fins et un grand arc, placés au hasard à chaque partie. */
export function decorMarkup(w: number, h: number, rng: Rng, trayTop: number): string {
  const r = (a: number, b: number) => a + rng.next() * (b - a);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  let out = `<g stroke="${COLORS.lines}" stroke-width="1" fill="none">`;
  const xl = w * r(0.08, 0.2);
  out += line(xl, 0, xl, h * r(0.5, 0.75));
  const xr = w * r(0.78, 0.92);
  out += line(xr, h * r(0, 0.15), xr, h);
  const yt = h * r(0.1, 0.2);
  out += rng.chance(0.5) ? line(w * r(0.35, 0.6), yt, w, yt) : line(0, yt, w * r(0.4, 0.65), yt);
  out += line(0, trayTop, w, trayTop);
  if (rng.chance(0.6)) {
    const yb = trayTop + (h - trayTop) * r(0.35, 0.6);
    out += line(0, yb, w * r(0.25, 0.45), yb);
  }
  const radius = w * r(0.35, 0.6);
  const cx = rng.chance(0.5) ? w * r(0.7, 1.05) : w * r(-0.05, 0.3);
  const cy = h * r(0.82, 1.05);
  out += `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`;
  return out + '</g>';
}

export const ICONS = {
  pause: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M9 6v12M15 6v12" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`,
  restart: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>`,
  expand: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  crown: `<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><path d="M1 15h22L21 3l-5 6-4-8-4 8-5-6z" fill="${COLORS.yellow}"/></svg>`,
};
