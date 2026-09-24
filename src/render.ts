// Dessin en SVG : la figure, les pièces, l'aperçu de pose et le décor de fond.
// Ces fonctions renvoient du texte SVG ; main.ts le place dans la page.

import { COLORS, GAP_PX, OUTLINE_PX } from './config';
import type { Game, Piece } from './game';
import { polyPath } from './geometry';
import type { Rng } from './rng';
import { cellKey, type Shape } from './shapes';

/** 'play' : en jeu. 'end' : forme active en pointillés. 'poster' : formes terminées seulement. */
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
    d = polyPath(shape.tile(c.i, c.j, g));
    cache.set(id, d);
  }
  return d;
}

function tilesPath(shape: Shape, keys: Iterable<string>, g: number): string {
  let d = '';
  for (const k of keys) d += tilePath(shape, k, g);
  return d;
}

/** Rectangle qui englobe la figure (sans la forme active en mode 'poster'). */
export function figureBounds(game: Game, mode: FigureMode) {
  const shapes = mode === 'poster' && game.shapes.length > 1 ? game.shapes.slice(0, -1) : game.shapes;
  return {
    x0: Math.min(...shapes.map((s) => s.box.x0)),
    y0: Math.min(...shapes.map((s) => s.box.y0)),
    x1: Math.max(...shapes.map((s) => s.box.x1)),
    y1: Math.max(...shapes.map((s) => s.box.y1)),
  };
}

/**
 * La figure, en unités monde (1 = une cellule). g = gap en unités monde.
 * Chaque forme est un calque en « multiply » : là où deux formes se superposent,
 * les couleurs se mélangent comme de l'encre.
 */
export function figureMarkup(game: Game, g: number, mode: FigureMode): string {
  const last = game.shapes.length - 1;
  const showActive = mode === 'play' || (mode === 'poster' && last === 0);
  let out = '<g style="isolation:isolate">';
  game.shapes.forEach((shape, idx) => {
    if (idx === last && mode !== 'play') return;
    const d = tilesPath(shape, game.filledCells(idx), g);
    if (d) out += `<path fill="${shape.color}" style="mix-blend-mode:multiply" d="${d}"/>`;
  });
  const active = game.active;
  if (mode === 'play') {
    const empty = [...active.cells.keys()].filter((k) => !game.filled.has(k));
    out += `<path fill="${COLORS.shapeInside}" d="${tilesPath(active, empty, g)}"/>`;
    out += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="${OUTLINE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  } else if (mode === 'end' || showActive) {
    out += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
  }
  return out + '</g>';
}

/** Une pièce, en pixels, coin haut-gauche en (0,0). */
export function pieceMarkup(piece: Piece, cellPx: number): string {
  const g = GAP_PX / cellPx;
  let d = '';
  for (const c of piece.cells) {
    d += polyPath(piece.shape.tile(c.si, c.sj, g), c.dx - c.si, c.dy - c.sj, cellPx);
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
    tiles += polyPath(shape.tile(i, j, g));
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
