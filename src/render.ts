// Dessin en SVG : la figure, les pièces, l'aperçu de pose et le décor de fond.
// Ces fonctions renvoient du texte SVG ; main.ts le place dans la page.

import { COLORS, GAP_PX, OUTLINE_PX } from './config';
import type { Game, Piece } from './game';
import { area, bounds, clipConvex, polyPath, type Poly } from './geometry';
import type { Rng } from './rng';
import { cellKey, type Shape } from './shapes';

/** 'play' : en jeu. 'end' : écran de fin. 'poster' : plein écran. */
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
    d = polyPath(shape.tile(i, j, g));
    cache.set(id, d);
  }
  return d;
}

function tilesPath(shape: Shape, keys: Iterable<string>, g: number): string {
  let d = '';
  for (const k of keys) d += tilePath(shape, k, g);
  return d;
}

/**
 * Formes de l'affiche : seulement les formes terminées. La forme inachevée qui a causé la
 * défaite n'y figure pas (pas de trou ni de défaut). Si aucune forme n'a été terminée, la
 * première forme sert d'affiche.
 */
export function posterShapes(game: Game): Shape[] {
  const done = game.shapes.slice(0, -1);
  return done.length ? done : [game.shapes[0]];
}

/** Rectangle qui englobe des formes. */
export function figureBounds(shapes: Shape[]) {
  return {
    x0: Math.min(...shapes.map((s) => s.box.x0)),
    y0: Math.min(...shapes.map((s) => s.box.y0)),
    x1: Math.max(...shapes.map((s) => s.box.x1)),
    y1: Math.max(...shapes.map((s) => s.box.y1)),
  };
}

/** Deux couleurs superposées comme deux encres (« multiply ») : 255 × (a/255) × (b/255). */
export function inkMix(a: string, b: string): string {
  const ch = (c: string, k: number) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  let out = '#';
  for (let k = 0; k < 3; k++) out += Math.round((ch(a, k) * ch(b, k)) / 255).toString(16).padStart(2, '0');
  return out;
}

const boxesMeet = (p: { x0: number; y0: number; x1: number; y1: number }, q: typeof p) =>
  p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;

// Les formes terminées ne changent pas : on garde leur dessin, indexé par la dernière forme.
const inkCache = new WeakMap<Shape, string>();

/**
 * Formes terminées : des aplats unis. Là où elles se chevauchent, les couleurs se mélangent
 * comme de l'encre, comme sur les affiches. Le mélange est calculé ici (les formes sont
 * convexes, leurs intersections aussi) plutôt que confié au navigateur : même rendu partout,
 * sans effet de transparence qui peut mal s'afficher sur certains téléphones.
 */
function inkMarkup(shapes: Shape[]): string {
  if (!shapes.length) return '';
  const cached = inkCache.get(shapes[shapes.length - 1]);
  if (cached !== undefined) return cached;
  // Couche k : les zones communes à k+1 formes, dessinées par-dessus les couches d'avant.
  const layers: string[] = [];
  const visit = (poly: Poly, color: string, last: number, depth: number) => {
    layers[depth] = (layers[depth] ?? '') + `<path fill="${color}" d="${polyPath(poly)}"/>`;
    if (depth >= 3) return;
    const box = bounds(poly);
    for (let k = last + 1; k < shapes.length; k++) {
      if (!boxesMeet(box, shapes[k].box)) continue;
      const q = clipConvex(poly, shapes[k].outline);
      if (q.length < 3 || area(q) < 1e-4) continue;
      visit(q, inkMix(color, shapes[k].color), k, depth + 1);
    }
  };
  shapes.forEach((s, i) => visit(s.outline, s.color, i, 0));
  const out = layers.join('');
  inkCache.set(shapes[shapes.length - 1], out);
  return out;
}

/**
 * La figure, en unités monde (1 = une cellule). g = gap des tuiles en unités monde.
 *
 * En jeu, la forme en cours est une grille de tuiles opaques et nettes : crème si la case est
 * vide, couleur de la forme si on l'a remplie. Les cases déjà couvertes par la figure au départ
 * prennent la couleur qu'elles auront sur l'affiche (le mélange des encres). Les formes
 * terminées sont découpées autour de la forme en cours : aucune ne vient dessiner une courbe
 * ou un escalier dans la grille. Une fois la forme finie, elle devient un aplat.
 * À la fin (écran de fin, affiche), seules les formes terminées sont dessinées.
 * @param id préfixe unique (deux figures peuvent être dans la page en même temps)
 */
export function figureMarkup(game: Game, g: number, mode: FigureMode, id = 'fig'): string {
  if (mode !== 'play') return `<g>${inkMarkup(posterShapes(game))}</g>`;

  const active = game.active;
  const done = game.shapes.slice(0, -1);
  // Tuiles de la forme en cours, regroupées par couleur : une tuile par case.
  const groups = new Map<string, string[]>();
  const add = (color: string, key: string) => groups.set(color, [...(groups.get(color) ?? []), key]);
  for (const c of active.cells.values()) {
    if (!game.filled.has(c.key)) add(COLORS.shapeInside, c.key);
    else if (!game.prefilled.has(c.key)) add(active.color, c.key);
    else add(done.filter((s) => s.cells.has(c.key)).reduce((m, s) => inkMix(m, s.color), active.color), c.key);
  }
  let out = '<g>';
  for (const [color, keys] of groups) out += `<path fill="${color}" d="${tilesPath(active, keys, g)}"/>`;
  if (done.length) {
    // Formes terminées, découpées autour de la forme en cours (tout sauf son intérieur).
    const b = figureBounds(game.shapes);
    const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) + 10;
    const frame = `M${b.x0 - m} ${b.y0 - m}H${b.x1 + m}V${b.y1 + m}H${b.x0 - m}Z`;
    out +=
      `<clipPath id="${id}-out"><path clip-rule="evenodd" d="${frame}${polyPath(active.outline)}"/></clipPath>` +
      `<g clip-path="url(#${id}-out)">${inkMarkup(done)}</g>`;
  }
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
  const shapes = posterShapes(game);
  const b = figureBounds(shapes);
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const far = size * 20;
  const r = (a: number, c: number) => a + rng.next() * (c - a);
  const boxes = shapes.map((s) => s.box);
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
  share: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crown: `<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><path d="M1 15h22L21 3l-5 6-4-8-4 8-5-6z" fill="${COLORS.yellow}"/></svg>`,
};
