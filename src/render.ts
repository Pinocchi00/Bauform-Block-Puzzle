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
    const [i, j] = key.split(',').map(Number);
    d = shape.tile(i, j, g).map((p) => polyPath(p)).join('');
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

/**
 * Forme terminée : un aplat uni de sa couleur. Entre elles, les formes terminées se
 * superposent comme de l'encre (« multiply ») : là où elles se chevauchent, les couleurs
 * se mélangent, comme sur les affiches.
 */
function flatShape(shape: Shape): string {
  return `<path fill="${shape.color}" style="mix-blend-mode:multiply" d="${polyPath(shape.outline)}"/>`;
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
    `<path fill="${color}" style="mix-blend-mode:multiply" clip-path="url(#${id})" d="${polyPath(shape.outline)}"/>`
  );
}

/**
 * La figure, en unités monde (1 = une cellule). g = gap des tuiles en unités monde.
 *
 * En jeu, la forme en cours est une grille de tuiles opaques et nettes : crème si la case est
 * vide, couleur de la forme si elle est remplie (la zone qui chevauche la figure compte déjà
 * comme remplie). Les formes terminées sont masquées à l'intérieur : aucune autre forme ne
 * vient dessiner une courbe ou un escalier dans la grille, et rien de ce qu'on pose ne paraît
 * transparent. Une fois la forme finie, elle devient un aplat et les chevauchements
 * apparaissent dans leur vraie géométrie, les couleurs mêlées comme de l'encre.
 * @param id préfixe unique (deux figures peuvent être dans la page en même temps)
 */
export function figureMarkup(game: Game, g: number, mode: FigureMode, id = 'fig'): string {
  const last = game.shapes.length - 1;
  const active = game.active;
  let done = '<g style="isolation:isolate">';
  for (let idx = 0; idx < last; idx++) done += flatShape(game.shapes[idx]);

  if (mode !== 'play') {
    // Affiche : les formes terminées, puis ce qui a été rempli de la dernière forme.
    done += cellsFlat(active, game.filled, active.color, id + '-last');
    done += '</g>';
    if (mode === 'end') {
      done += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    }
    return `<g>${done}</g>`;
  }
  done += '</g>';

  // Tuiles de la forme en cours, regroupées par couleur : une tuile par case.
  const filled: string[] = [];
  const empty: string[] = [];
  for (const c of active.cells.values()) (game.filled.has(c.key) ? filled : empty).push(c.key);
  let out = '<g>';
  if (filled.length) out += `<path fill="${active.color}" d="${tilesPath(active, filled, g)}"/>`;
  out += `<path fill="${COLORS.shapeInside}" d="${tilesPath(active, empty, g)}"/>`;
  // Formes terminées, masquées à l'intérieur de la forme en cours.
  const b = figureBounds(game);
  const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) + 10;
  const [x, y, w, h] = [b.x0 - m, b.y0 - m, b.x1 - b.x0 + 2 * m, b.y1 - b.y0 + 2 * m];
  out +=
    `<mask id="${id}-hole" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>` +
    `<path d="${polyPath(active.outline)}" fill="#000"/></mask>` +
    `<g mask="url(#${id}-hole)">${done}</g>`;
  out += `<path d="${polyPath(active.outline)}" fill="none" stroke="${COLORS.black}" stroke-width="${OUTLINE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  return out + '</g>';
}

/**
 * Traits de l'affiche de fin, en unités monde, calés sur les bords des formes et posés
 * par-dessus, comme sur les affiches du Bauhaus : un axe vertical épais qui traverse la
 * composition, une horizontale, et selon la partie une seconde verticale fine, un faisceau
 * de trois lignes parallèles, un rectangle en simple contour, un grand arc de cercle.
 * Tirés au hasard à partir de la seed : chaque partie donne une composition différente.
 */
export function posterLinesMarkup(game: Game, rng: Rng): string {
  const b = figureBounds(game);
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const far = size * 20;
  const r = (a: number, c: number) => a + rng.next() * (c - a);
  const boxes = game.shapes.map((s) => s.box);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  // Bord de forme le plus proche d'une position voulue (les traits s'appuient sur les formes).
  const edgeNear = (axis: 'x' | 'y', target: number) => {
    const edges = boxes.flatMap((s) => (axis === 'x' ? [s.x0, s.x1] : [s.y0, s.y1]));
    return edges.reduce((best, e) => (Math.abs(e - target) < Math.abs(best - target) ? e : best));
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${width}" vector-effect="non-scaling-stroke"/>`;

  let out = `<g stroke="${COLORS.black}" fill="none" stroke-linecap="butt">`;
  // L'axe : une verticale épaisse près du centre, qui dépasse la figure en haut et en bas
  // (ou traverse toute l'affiche).
  const ax = edgeNear('x', cx + (b.x1 - b.x0) * r(-0.2, 0.2));
  const through = rng.chance(0.5);
  out += line(ax, through ? -far : b.y0 - r(1, 3), ax, through ? far : b.y1 + r(1, 3), 3);
  // Une seconde verticale fine, tout près ou ailleurs.
  if (rng.chance(0.5)) {
    const x2 = edgeNear('x', ax + (rng.chance(0.5) ? -1 : 1) * r(1, 4));
    if (Math.abs(x2 - ax) > 0.5) out += line(x2, -far, x2, far, 1);
  }
  // Une horizontale, qui part d'une forme et file d'un côté (ou traverse tout).
  const hy = edgeNear('y', cy + (b.y1 - b.y0) * r(-0.3, 0.3));
  if (rng.chance(0.5)) out += line(-far, hy, far, hy, 1.5);
  else out += rng.chance(0.5) ? line(ax, hy, b.x1 + r(1, 3), hy, 2.5) : line(b.x0 - r(1, 3), hy, ax, hy, 2.5);
  // Un faisceau de trois lignes parallèles, qui sort de la figure sur un côté.
  if (rng.chance(0.5)) {
    const s = rng.pick(boxes);
    const y0 = s.y0 + (s.y1 - s.y0) * r(0.2, 0.7);
    const left = rng.chance(0.5);
    const from = left ? b.x0 - r(1.5, 3) : s.x1;
    const to = left ? s.x0 : b.x1 + r(1.5, 3);
    for (let k = 0; k < 3; k++) out += line(from, y0 + k * 0.45, to, y0 + k * 0.45, 2);
  }
  // Un rectangle en simple contour, accroché au coin d'une forme.
  if (rng.chance(0.35)) {
    const s = rng.pick(boxes);
    const w = r(2, 4);
    const h = r(1.5, 3);
    const x = rng.chance(0.5) ? s.x1 : s.x0 - w;
    const y = rng.chance(0.5) ? s.y1 : s.y0 - h;
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }
  // Un grand arc de cercle fin, centré sur un coin de forme.
  if (rng.chance(0.55)) {
    const s = rng.pick(boxes);
    out += `<circle cx="${rng.pick([s.x0, s.x1])}" cy="${rng.pick([s.y0, s.y1])}" r="${size * r(0.35, 0.6)}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }
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
    tiles += shape.tile(i, j, g).map((p) => polyPath(p)).join('');
    // Contour : on ne garde que les côtés qui ne touchent pas une autre case de la pièce
    // (ni la case elle-même, quand sa tuile est faite de deux morceaux).
    for (const poly of shape.piece(i, j)) {
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k];
        const q = poly[(k + 1) % poly.length];
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        let sides: [number, number][] = [];
        if (Math.abs(p.x - q.x) < eps && Math.abs(p.x - Math.round(p.x)) < eps) {
          const x = Math.round(p.x);
          sides = [[x - 1, Math.floor(my)], [x, Math.floor(my)]];
        } else if (Math.abs(p.y - q.y) < eps && Math.abs(p.y - Math.round(p.y)) < eps) {
          const y = Math.round(p.y);
          sides = [[Math.floor(mx), y - 1], [Math.floor(mx), y]];
        }
        if (sides.length && sides.every(([si, sj]) => inPiece.has(shape.cellAt(si, sj) ?? ''))) continue;
        edges += `M${p.x} ${p.y}L${q.x} ${q.y}`;
      }
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
