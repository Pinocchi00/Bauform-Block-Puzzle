// Point d'entrée : relie les règles (game.ts) à l'écran, au doigt et aux différents écrans.

import './style.css';
import {
  DRAG_LIFT_PX,
  FAKE_AD_SECONDS,
  GAP_PX,
  INTERSTITIAL_MIN_PLAY_SECONDS,
  MAX_CELL_PX,
  VIEW_CELLS,
} from './config';
import { feedback } from './feedback';
import { Game, type Piece } from './game';
import {
  ICONS,
  decorMarkup,
  figureBounds,
  posterShapes,
  figureMarkup,
  pieceMarkup,
  posterLinesMarkup,
  previewMarkup,
  type FigureMode,
} from './render';
import { Rng, randomSeed } from './rng';
import { storage, type GameStats, type SavedGame } from './storage';

// ---------- Éléments de la page ----------

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const app = $('#app');
const decor = $<SVGSVGElement>('#decor');
const cameraEl = $<SVGGElement>('#camera');
const figureEl = $<SVGGElement>('#figure');
const previewEl = $<SVGGElement>('#preview');
const dragPieceEl = $<SVGGElement>('#drag-piece');
const scoreEl = $('#score');
const gainEl = $('#gain');
const shapeNumberEl = $('#shape-number');
const shapeProgressEl = $('#shape-progress');
const shapeProgressFillEl = $('#shape-progress-fill');
const slots = [...document.querySelectorAll<HTMLElement>('.slot')];
const optSound = $<HTMLInputElement>('#opt-sound');
const optVibrations = $<HTMLInputElement>('#opt-vibrations');

$('#pause-btn').innerHTML = ICONS.pause;
$('#resume-btn').innerHTML = ICONS.play;
$('#expand-btn').innerHTML = ICONS.expand;
$('#share-btn').innerHTML = ICONS.share;
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = ICONS[el.dataset.icon as keyof typeof ICONS];
});
document.querySelectorAll<HTMLElement>('.crown').forEach((el) => (el.innerHTML = ICONS.crown));

const fmt = (n: number) => n.toLocaleString('fr-FR');

// ---------- État ----------

type Screen = 'play' | 'pause' | 'over' | 'full' | 'ad' | 'debug';
let screen: Screen = 'play';
let game: Game;
let gameId = '';
let startedAt = 0;
let recordAtStart = 0;
/** Vrai entre la dernière pose perdante et l'affichage de l'écran de fin. */
let ending = false;

// Chronomètre : ne compte que le temps passé à jouer.
let playMs = 0;
let clockStart: number | null = null;
function startClock() {
  clockStart ??= performance.now();
}
function stopClock() {
  if (clockStart !== null) {
    playMs += performance.now() - clockStart;
    clockStart = null;
  }
}

function setScreen(s: Screen) {
  screen = s;
  app.dataset.screen = s;
  if (s === 'play' && !ending && !game.over) startClock();
  else stopClock();
}

// ---------- Caméra ----------
// À l'écran : x = x_monde * s + tx. La caméra suit la forme à remplir, toujours au même
// zoom : la 7e forme s'affiche comme la 1re. La figure entière ne se voit qu'à la fin.

const cam = { s: 40, tx: 0, ty: 0 };
let camAnim = 0;
/** Échelle utilisée pour calculer le gap des tuiles de la figure. */
let figureScale = 0;

function viewport() {
  const hud = $('#hud').getBoundingClientRect();
  const tray = $('#tray').getBoundingClientRect();
  const pad = 20;
  const top = hud.bottom + 8;
  const bottom = tray.top - 24; // en dessous, les formes s'effacent en fondu
  return { x: pad, y: top, w: window.innerWidth - pad * 2, h: Math.max(80, bottom - top) };
}

function cameraTarget() {
  const v = viewport();
  const b = game.active.box;
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  // Même zoom pour toutes les formes (sauf si une forme ne rentre vraiment pas).
  const s = Math.min(MAX_CELL_PX, v.w / VIEW_CELLS, v.h / VIEW_CELLS, v.w / bw, v.h / bh);
  return { s, tx: v.x + (v.w - bw * s) / 2 - b.x0 * s, ty: v.y + (v.h - bh * s) / 2 - b.y0 * s };
}

function applyCamera() {
  cameraEl.setAttribute('transform', `translate(${cam.tx} ${cam.ty}) scale(${cam.s})`);
}

function fitCamera(animate: boolean) {
  const target = cameraTarget();
  cancelAnimationFrame(camAnim);
  if (Math.abs(target.s - figureScale) > 1e-3) {
    figureScale = target.s;
    renderFigure();
  }
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Object.assign(cam, target);
    applyCamera();
    return;
  }
  const from = { ...cam };
  const t0 = performance.now();
  const duration = 700;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    cam.s = from.s + (target.s - from.s) * e;
    cam.tx = from.tx + (target.tx - from.tx) * e;
    cam.ty = from.ty + (target.ty - from.ty) * e;
    applyCamera();
    if (t < 1) camAnim = requestAnimationFrame(step);
  };
  camAnim = requestAnimationFrame(step);
}

// ---------- Dessin ----------

function renderFigure() {
  figureEl.innerHTML = figureMarkup(game, GAP_PX / figureScale, 'play');
}

function trayCellPx(): number {
  const w = slots[0].getBoundingClientRect().width;
  return Math.max(14, Math.min(30, (w - 16) / 4));
}

function renderTray() {
  const cell = trayCellPx();
  slots.forEach((slot, i) => {
    const piece = game.hand[i];
    // Le rond sert pendant qu'on tient la pièce (classe « held ») ; il est caché sinon.
    slot.innerHTML = piece
      ? `<svg width="${piece.w * cell}" height="${piece.h * cell}">${pieceMarkup(piece, cell)}</svg><div class="marker"></div>`
      : '';
    slot.classList.toggle('held', drag?.slot === i);
    slot.classList.toggle('selected', selected === i);
  });
}

function renderScore() {
  scoreEl.textContent = fmt(game.score);
  shapeNumberEl.textContent = String(game.shapes.length).padStart(2, '0');
  const fraction = game.active.cells.size ? game.filled.size / game.active.cells.size : 0;
  const percentage = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  shapeProgressEl.setAttribute('aria-valuenow', String(percentage));
  shapeProgressFillEl.style.width = `${percentage}%`;
}

function showGain(gain: number) {
  gainEl.textContent = '+' + fmt(gain);
  gainEl.classList.remove('show');
  scoreEl.classList.remove('score-pop');
  void gainEl.offsetWidth; // relance les animations après chaque pose
  gainEl.classList.add('show');
  scoreEl.classList.add('score-pop');
}

function renderDecor() {
  const tray = $('#tray').getBoundingClientRect();
  decor.innerHTML = decorMarkup(window.innerWidth, window.innerHeight, new Rng(game.seed ^ 0x5bd1e995), tray.top);
}

/**
 * Dessine la figure entière dans un SVG (écran de fin, plein écran), comme une affiche :
 * les traits, propres à chaque partie, passent par-dessus les formes.
 */
function drawFigureInto(svg: SVGSVGElement, mode: FigureMode, pad: number) {
  const r = svg.getBoundingClientRect();
  svg.innerHTML = figureContent(r.width, r.height, pad, mode, svg.id, MAX_CELL_PX * 1.5).markup;
}

/** La figure entière, centrée dans un cadre de w × h pixels. */
function figureContent(w: number, h: number, pad: number, mode: FigureMode, id: string, maxScale = Infinity) {
  const b = figureBounds(posterShapes(game));
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const s = Math.max(1, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, maxScale));
  const tx = (w - bw * s) / 2 - b.x0 * s;
  const ty = (h - bh * s) / 2 - b.y0 * s;
  const lines = posterLinesMarkup(game, new Rng(game.seed ^ 0x27d4eb2f));
  const markup =
    `<g transform="translate(${tx} ${ty}) scale(${s})">` + figureMarkup(game, GAP_PX / s, mode, id) + lines + '</g>';
  return { markup, s };
}

// ---------- Partie ----------

function readSeedFromUrl(): number | null {
  const m = (location.hash + location.search).match(/seed=?(\d+)/);
  return m ? Number(m[1]) >>> 0 : null;
}

function newGame(seed = randomSeed()) {
  storage.clearSavedGame();
  // La figure finale est pensée pour l'écran entier (affiche de fin, en portrait).
  startGame(new Game(seed, window.innerWidth / window.innerHeight));
}

/** Reprend la partie laissée en cours (appli fermée, téléphone redémarré…). */
function resumeSavedGame(): boolean {
  const saved = storage.getSavedGame();
  const g = saved && Game.replay(saved.seed, saved.aspect, saved.moves);
  if (!saved || !g || g.over) {
    storage.clearSavedGame();
    return false;
  }
  startGame(g, saved);
  return true;
}

/** Enregistre la partie en cours, pour la retrouver au prochain lancement. */
function saveGame() {
  if (!game || game.over || ending || !game.history.length) return;
  const saved: SavedGame = {
    v: 1,
    id: gameId,
    seed: game.seed,
    aspect: game.aspect,
    moves: game.history,
    startedAt,
    playMs: Math.round(playMs + (clockStart === null ? 0 : performance.now() - clockStart)),
    recordAtStart,
  };
  storage.setSavedGame(saved);
}

function startGame(g: Game, saved?: SavedGame) {
  game = g;
  gameId = saved?.id ?? Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  startedAt = saved?.startedAt ?? Date.now();
  recordAtStart = saved?.recordAtStart ?? storage.getRecord();
  playMs = saved?.playMs ?? 0;
  clockStart = null;
  ending = false;
  app.classList.remove('form-complete');
  drag = null;
  selected = null;
  previewEl.innerHTML = '';
  dragPieceEl.innerHTML = '';
  figureScale = 0;
  renderDecor();
  fitCamera(false);
  renderTray();
  renderScore();
  gainEl.classList.remove('show');
  setScreen('play');
  showTutorial();
}

/** Relancer une partie, avec une pub interstitielle toutes les ~3 minutes de jeu. */
function relaunch() {
  stopClock();
  const played = storage.getPlaySinceAd() + playMs;
  if (played >= INTERSTITIAL_MIN_PLAY_SECONDS * 1000) {
    storage.setPlaySinceAd(0);
    showAd(() => newGame());
  } else {
    storage.setPlaySinceAd(played);
    newGame();
  }
}

function saveStats() {
  const stats: GameStats = {
    id: gameId,
    seed: game.seed,
    date: startedAt,
    durationMs: Math.round(playMs),
    shapesCompleted: game.shapesCompleted,
    piecesPlaced: game.piecesPlaced,
    score: game.score,
  };
  storage.saveStats(stats);
}

function showGameOver() {
  ending = false;
  stopClock();
  storage.clearSavedGame();
  saveStats();
  const isRecord = game.score > recordAtStart;
  if (game.score > storage.getRecord()) storage.setRecord(game.score);

  $('#over-score').textContent = fmt(game.score);
  $('#over-number').textContent = String(game.shapes.length).padStart(2, '0');
  $('#over-shapes').textContent = `${game.shapesCompleted} forme${game.shapesCompleted !== 1 ? 's' : ''}`;
  $('#over-pieces').textContent = `${game.piecesPlaced} pièce${game.piecesPlaced !== 1 ? 's' : ''}`;
  $('#over-record').innerHTML = isRecord
    ? `<span class="crown">${ICONS.crown}</span><span>Nouveau record</span>`
    : `<span class="crown">${ICONS.crown}</span><span>${fmt(storage.getRecord())}</span>`;
  $('#retry-btn').hidden = game.retryUsed;
  setScreen('over');
  drawFigureInto($<SVGSVGElement>('#over-figure'), 'end', 8);
}

// ---------- Pubs simulées ----------

let adTimer = 0;
function showAd(done: () => void) {
  // Aucune fausse publicité dans une version destinée aux joueurs.
  // L'intégration d'un vrai SDK publicitaire fera l'objet d'une version distincte.
  if (!import.meta.env.DEV) {
    done();
    return;
  }
  setScreen('ad');
  let left = FAKE_AD_SECONDS;
  const count = $('#ad-count');
  count.textContent = String(left);
  clearInterval(adTimer);
  adTimer = window.setInterval(() => {
    left--;
    count.textContent = String(left);
    if (left <= 0) {
      clearInterval(adTimer);
      done();
    }
  }, 1000);
}

// ---------- Guide du premier lancement ----------
// Une pièce fantôme part du plateau et se pose dans la forme, tant que le joueur n'a
// jamais posé de pièce. Il disparaît dès qu'on touche une pièce.

const tutorialEl = $('#tutorial');
const tutoGhost = $('#tuto-ghost');
const tutoPiece = $<SVGSVGElement>('#tuto-piece');
let tutoAnim: Animation | null = null;

function hideTutorial() {
  tutorialEl.hidden = true;
  tutoAnim?.cancel();
  tutoAnim = null;
}

function showTutorial() {
  hideTutorial();
  if (storage.getTutorialDone() || !game || game.over) return;
  const slot = game.hand.findIndex((p) => p && game.fits(p));
  const piece = game.hand[slot];
  if (!piece) return;
  const anchors = game.anchors(piece);
  const a = anchors[Math.floor(anchors.length / 2)];
  const s = cam.s;
  const r = slots[slot].getBoundingClientRect();
  const from = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
  // Le doigt arrive là où il serait en posant vraiment la pièce (elle flotte au-dessus).
  const to = `translate(${cam.tx + (a.x + piece.w / 2) * s}px, ${cam.ty + (a.y + piece.h) * s + DRAG_LIFT_PX}px)`;
  tutoPiece.setAttribute('width', String(piece.w * s));
  tutoPiece.setAttribute('height', String(piece.h * s));
  tutoPiece.style.left = `${(-piece.w * s) / 2}px`;
  tutoPiece.style.top = `${-DRAG_LIFT_PX - piece.h * s}px`;
  tutoPiece.innerHTML = pieceMarkup(piece, s);
  tutorialEl.hidden = false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tutoGhost.style.transform = to;
    return;
  }
  tutoAnim = tutoGhost.animate(
    [
      { transform: from, opacity: 0, offset: 0 },
      { transform: from, opacity: 1, offset: 0.12, easing: 'cubic-bezier(.45,0,.25,1)' },
      { transform: to, opacity: 1, offset: 0.6 },
      { transform: to, opacity: 0, offset: 0.82 },
      { transform: to, opacity: 0, offset: 1 },
    ],
    { duration: 2800, iterations: Infinity },
  );
}

// ---------- Partager l'affiche ----------

const POSTER_PAPER = '#e4dccd';

/** L'affiche de fin en image PNG (1080 × 1440), avec le nom du jeu et le score. */
async function posterPng(): Promise<Blob> {
  const W = 1080;
  const H = 1440;
  const side = 90;
  const top = 90;
  const bottom = 210;
  const fw = W - side * 2;
  const fh = H - top - bottom;
  const { markup, s } = figureContent(fw, fh, 0, 'poster', 'share');
  // Les traits ont une épaisseur fixe à l'écran : on la remet à l'échelle de l'image.
  const k = W / 390;
  const fixed = markup.replace(
    /stroke-width="([\d.]+)" vector-effect="non-scaling-stroke"/g,
    (_, w: string) => `stroke-width="${(Number(w) * k) / s}"`,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}">${fixed}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = POSTER_PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, side, top, fw, fh);

  try {
    await document.fonts.load('500 38px Jost');
  } catch {
    // police de secours
  }
  const y = H - bottom / 2 + 14;
  ctx.textBaseline = 'alphabetic';
  ctx.font = "500 38px Jost, 'Futura', sans-serif";
  ctx.letterSpacing = '9px';
  ctx.fillStyle = '#141414';
  ctx.textAlign = 'left';
  ctx.fillText('BAUFORM', side, y);
  ctx.font = "400 30px Jost, 'Futura', sans-serif";
  ctx.letterSpacing = '4px';
  ctx.fillStyle = '#5f5a51';
  ctx.textAlign = 'right';
  const number = String(game.shapes.length).padStart(2, '0');
  ctx.fillText(`Nº ${number}  ·  ${fmt(game.score)}`, W - side, y);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image impossible'))), 'image/png'),
  );
}

/** Partage l'affiche (menu de partage du téléphone) ou, à défaut, la télécharge. */
async function sharePoster() {
  const btn = $<HTMLButtonElement>('#share-btn');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const blob = await posterPng();
    const name = `bauform-${String(game.shapes.length).padStart(2, '0')}-${game.score}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Bauform' });
      } catch {
        // partage annulé : rien à faire
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Glisser-déposer ----------
// Au doigt, on utilise les événements « touch » (les plus fiables sur téléphone,
// y compris dans une page intégrée à une autre appli) ; à la souris, les « pointer ».
// Secours : toucher une pièce la sélectionne, toucher ensuite la forme la pose.

interface Drag {
  slot: number;
  piece: Piece;
  /** Identifiant du doigt (ou du pointeur souris) qui tient la pièce. */
  id: number;
  cellPx: number;
  anchor: { x: number; y: number } | null;
  startX: number;
  startY: number;
  moved: boolean;
  /** La pièce était déjà sélectionnée avant ce toucher. */
  wasSelected: boolean;
}
let drag: Drag | null = null;
/** Pièce sélectionnée par un simple toucher, en attente d'un toucher sur la forme. */
let selected: number | null = null;

function canInteract(): boolean {
  return screen === 'play' && !ending && !game.over;
}

function beginDrag(slotIndex: number, id: number, x: number, y: number): boolean {
  const piece = game.hand[slotIndex];
  if (!canInteract() || drag || !piece) return false;
  hideTutorial();
  drag = {
    slot: slotIndex,
    piece,
    id,
    cellPx: cam.s,
    anchor: null,
    startX: x,
    startY: y,
    moved: false,
    wasSelected: selected === slotIndex,
  };
  selected = null;
  dragPieceEl.innerHTML = pieceMarkup(piece, cam.s);
  // On ne redessine pas le plateau ici : l'élément touché doit rester en place,
  // sinon certains téléphones arrêtent de suivre le doigt.
  slots.forEach((s, k) => {
    s.classList.toggle('held', k === slotIndex);
    s.classList.remove('selected');
  });
  moveDrag(x, y);
  return true;
}

/** Position aimantée la plus proche pour une pièce dont le coin haut-gauche est à (left, top) en pixels. */
function snap(piece: Piece, left: number, top: number, radius: number) {
  const fx = (left - cam.tx) / cam.s;
  const fy = (top - cam.ty) / cam.s;
  let best: { x: number; y: number } | null = null;
  let bestDist = radius;
  for (let y = Math.floor(fy) - 1; y <= Math.ceil(fy) + 1; y++) {
    for (let x = Math.floor(fx) - 1; x <= Math.ceil(fx) + 1; x++) {
      const d = Math.hypot(x - fx, y - fy);
      if (d < bestDist && game.canPlace(piece, x, y)) {
        best = { x, y };
        bestDist = d;
      }
    }
  }
  return best;
}

function moveDrag(px: number, py: number) {
  if (!drag) return;
  const { piece, cellPx } = drag;
  if (Math.hypot(px - drag.startX, py - drag.startY) > 10) drag.moved = true;
  // La pièce flotte au-dessus du doigt, centrée horizontalement.
  const left = px - (piece.w * cellPx) / 2;
  const top = py - DRAG_LIFT_PX - piece.h * cellPx;
  dragPieceEl.setAttribute('transform', `translate(${left} ${top})`);

  // Emplacement aimanté : la position valide la plus proche, à moins de 3/4 de case.
  const best = snap(piece, left, top, 0.75);
  const same = best && drag.anchor && best.x === drag.anchor.x && best.y === drag.anchor.y;
  if (same || (!best && !drag.anchor)) return;
  drag.anchor = best;
  previewEl.innerHTML = best
    ? previewMarkup(piece, best.x, best.y, GAP_PX / figureScale)
    : '';
}

function endDrag(drop: boolean) {
  if (!drag) return;
  const { slot, anchor, moved, wasSelected } = drag;
  drag = null;
  previewEl.innerHTML = '';
  dragPieceEl.innerHTML = '';
  slots.forEach((s) => s.classList.remove('held'));
  if (drop && anchor && moved) {
    placePiece(slot, anchor);
  } else if (drop && !moved) {
    // Simple toucher : la pièce est sélectionnée (ou désélectionnée).
    selected = wasSelected ? null : slot;
  }
  renderTray();
  if (selected === null) showTutorial();
}

function placePiece(slot: number, anchor: { x: number; y: number }) {
  selected = null;
  const res = game.place(slot, anchor.x, anchor.y);
  if (!res) return;
  if (!storage.getTutorialDone()) {
    storage.setTutorialDone();
    hideTutorial();
  }
  // La note monte à mesure que la forme se remplit ; une forme finie joue son carillon.
  if (!res.completed) {
    const todo = game.active.cells.size - game.prefilled.size;
    feedback.place((game.filled.size - game.prefilled.size) / todo, game.active.color);
  }
  showGain(res.gain);
  renderScore();
  renderFigure();
  if (res.completed) {
    // Une micro-animation souligne la progression sans retarder la prochaine forme.
    app.classList.remove('form-complete');
    void app.offsetWidth;
    app.classList.add('form-complete');
    // La forme qui vient d'être finie est l'avant-dernière (une nouvelle vient d'apparaître).
    feedback.complete(game.shapes[game.shapes.length - 2].color);
    fitCamera(true);
  }
  if (!res.gameOver) saveGame();
  if (res.gameOver) {
    storage.clearSavedGame();
    ending = true;
    stopClock();
    setTimeout(() => {
      feedback.gameOver();
      showGameOver();
    }, 900);
  }
}

/** Toucher sur la forme alors qu'une pièce est sélectionnée : on la pose là (centrée sur le doigt). */
function tapBoard(x: number, y: number) {
  if (selected === null || !canInteract()) return;
  const piece = game.hand[selected];
  const s = cam.s;
  const anchor = piece && snap(piece, x - (piece.w * s) / 2, y - (piece.h * s) / 2, 1);
  if (piece && anchor) placePiece(selected, anchor);
  else selected = null;
  renderTray();
  if (selected === null) showTutorial();
}

const onControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('button, label, .slot');

// Doigt.
slots.forEach((slot, i) => {
  slot.addEventListener(
    'touchstart',
    (e) => {
      const t = e.changedTouches[0];
      if (beginDrag(i, t.identifier, t.clientX, t.clientY)) e.preventDefault();
    },
    { passive: false },
  );
});
document.addEventListener(
  'touchstart',
  (e) => {
    if (selected !== null && screen === 'play' && !onControl(e.target)) {
      e.preventDefault();
      const t = e.changedTouches[0];
      tapBoard(t.clientX, t.clientY);
    }
  },
  { passive: false },
);
document.addEventListener(
  'touchmove',
  (e) => {
    // En jeu, aucun geste ne doit faire défiler ou fermer la page.
    if (screen === 'play' && e.cancelable) e.preventDefault();
    if (!drag) return;
    for (const t of e.changedTouches) if (t.identifier === drag.id) moveDrag(t.clientX, t.clientY);
  },
  { passive: false },
);
document.addEventListener('touchend', (e) => {
  if (!drag) return;
  for (const t of e.changedTouches) {
    if (t.identifier === drag.id) {
      moveDrag(t.clientX, t.clientY);
      endDrag(true);
      return;
    }
  }
});
document.addEventListener('touchcancel', (e) => {
  if (drag && [...e.changedTouches].some((t) => t.identifier === drag!.id)) endDrag(false);
});

// Souris (ordinateur) : les événements « touch » s'occupent déjà du doigt.
slots.forEach((slot, i) => {
  slot.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    if (beginDrag(i, e.pointerId, e.clientX, e.clientY)) e.preventDefault();
  });
});
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' && !drag && !onControl(e.target)) tapBoard(e.clientX, e.clientY);
});
window.addEventListener('pointermove', (e) => {
  if (drag && e.pointerType !== 'touch' && e.pointerId === drag.id) moveDrag(e.clientX, e.clientY);
});
window.addEventListener('pointerup', (e) => {
  if (drag && e.pointerType !== 'touch' && e.pointerId === drag.id) endDrag(true);
});
window.addEventListener('pointercancel', (e) => {
  if (drag && e.pointerType !== 'touch' && e.pointerId === drag.id) endDrag(false);
});

// ---------- Boutons et écrans ----------

function openPause() {
  if (screen !== 'play' || ending) return;
  endDrag(false);
  $('#pause-score').textContent = fmt(game.score);
  $('#pause-record').textContent = fmt(Math.max(storage.getRecord(), game.score));
  const s = storage.getSettings();
  optSound.checked = s.sound;
  optVibrations.checked = s.vibrations;
  setScreen('pause');
}

$('#pause-btn').addEventListener('click', openPause);
$('#resume-btn').addEventListener('click', () => setScreen('play'));
$('#restart-btn').addEventListener('click', relaunch);
$('#replay-btn').addEventListener('click', relaunch);

for (const input of [optSound, optVibrations]) {
  input.addEventListener('change', () => {
    storage.setSettings({ sound: optSound.checked, vibrations: optVibrations.checked });
  });
}

$('#retry-btn').addEventListener('click', () => {
  if (game.retryUsed) return;
  showAd(() => {
    game.retryShape();
    renderFigure();
    renderTray();
    renderScore();
    fitCamera(false);
    setScreen('play');
    saveGame();
  });
});

$('#expand-btn').addEventListener('click', () => {
  setScreen('full');
  drawFigureInto($<SVGSVGElement>('#full-figure'), 'poster', 24);
});
$('#full-screen').addEventListener('click', () => setScreen('over'));
$('#share-btn').addEventListener('click', () => void sharePoster());

// On quitte l'app ou on change d'onglet : pause automatique (le chrono s'arrête).
// La partie est enregistrée à ce moment-là : Android peut fermer l'appli sans prévenir.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    openPause();
    saveGame();
  }
});
window.addEventListener('pagehide', saveGame);

window.addEventListener('resize', () => {
  if (!game) return;
  renderDecor();
  fitCamera(false);
  renderTray();
  if (!tutorialEl.hidden) showTutorial();
  if (screen === 'over') drawFigureInto($<SVGSVGElement>('#over-figure'), 'end', 8);
  if (screen === 'full') drawFigureInto($<SVGSVGElement>('#full-figure'), 'poster', 24);
});

// ---------- Écran de debug (appui long sur le score) ----------

let pressTimer = 0;
const scoreBox = $('#score-box');
// Réservé au développement : les joueurs n'ont pas accès à cet écran.
scoreBox.addEventListener('pointerdown', () => {
  if (import.meta.env.DEV) pressTimer = window.setTimeout(openDebug, 700);
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
  scoreBox.addEventListener(ev, () => clearTimeout(pressTimer));
}

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

function openDebug() {
  if (screen !== 'play' || ending) return;
  const list = storage.getStats();
  const avg = (f: (g: GameStats) => number) => (list.length ? list.reduce((a, g) => a + f(g), 0) / list.length : 0);
  $('#debug-summary').innerHTML = `
    <div>Durée moyenne<b>${list.length ? mmss(avg((g) => g.durationMs)) : '–'}</b></div>
    <div>Parties<b>${list.length}</b></div>
    <div>Formes (moy.)<b>${avg((g) => g.shapesCompleted).toFixed(1).replace('.', ',')}</b></div>
    <div>Pièces (moy.)<b>${Math.round(avg((g) => g.piecesPlaced))}</b></div>
    <div>Score (moy.)<b>${fmt(Math.round(avg((g) => g.score)))}</b></div>
    <div>Record<b>${fmt(storage.getRecord())}</b></div>`;
  $('#debug-table').innerHTML =
    '<tr><th>Date</th><th>Durée</th><th>Form.</th><th>Pièc.</th><th>Score</th><th>Seed</th></tr>' +
    list
      .map((g) => {
        const d = new Date(g.date);
        const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
          d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `<tr><td>${date}</td><td>${mmss(g.durationMs)}</td><td>${g.shapesCompleted}</td><td>${g.piecesPlaced}</td><td>${fmt(g.score)}</td><td>${g.seed}</td></tr>`;
      })
      .join('');
  $('#debug-current').textContent = `Partie en cours : seed ${game.seed}. Pour la rejouer, ajoutez #seed${game.seed} à l'adresse.`;
  setScreen('debug');
}

$('#debug-close').addEventListener('click', () => setScreen('play'));
$('#debug-clear').addEventListener('click', () => {
  storage.clearStats();
  setScreen('play');
  openDebug();
});

// ---------- C'est parti : directement en partie ----------

// Une seed dans l'adresse lance cette partie-là ; sinon on reprend la partie en cours, s'il y en a une.
const urlSeed = readSeedFromUrl();
if (urlSeed !== null || !resumeSavedGame()) newGame(urlSeed ?? randomSeed());

// En développement seulement : accès au jeu depuis la console, pour les tests.
if (import.meta.env.DEV) {
  const rerender = () => {
    renderFigure();
    renderTray();
    renderScore();
    fitCamera(false);
  };
  Object.assign(window, { bauform: { get game() { return game; }, cam, rerender, showGameOver } });
}
