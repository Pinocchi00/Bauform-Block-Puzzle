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
  figureMarkup,
  oldColorAt,
  pieceMarkup,
  posterLinesMarkup,
  previewMarkup,
  type FigureMode,
} from './render';
import { Rng, randomSeed } from './rng';
import { storage, type GameStats } from './storage';

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
const slots = [...document.querySelectorAll<HTMLElement>('.slot')];
const optSound = $<HTMLInputElement>('#opt-sound');
const optVibrations = $<HTMLInputElement>('#opt-vibrations');

$('#pause-btn').innerHTML = ICONS.pause;
$('#resume-btn').innerHTML = ICONS.play;
$('#expand-btn').innerHTML = ICONS.expand;
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
}

function showGain(gain: number) {
  gainEl.textContent = '+' + fmt(gain);
  gainEl.classList.remove('show');
  void gainEl.offsetWidth; // relance l'animation
  gainEl.classList.add('show');
}

function renderDecor() {
  const tray = $('#tray').getBoundingClientRect();
  decor.innerHTML = decorMarkup(window.innerWidth, window.innerHeight, new Rng(game.seed ^ 0x5bd1e995), tray.top);
}

/**
 * Dessine la figure entière dans un SVG (écran de fin, plein écran), comme une affiche :
 * les traits fins, propres à chaque partie, passent derrière les formes.
 */
function drawFigureInto(svg: SVGSVGElement, mode: FigureMode, pad: number) {
  const r = svg.getBoundingClientRect();
  const b = figureBounds(game);
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const s = Math.max(1, Math.min((r.width - pad * 2) / bw, (r.height - pad * 2) / bh, MAX_CELL_PX * 1.5));
  const tx = (r.width - bw * s) / 2 - b.x0 * s;
  const ty = (r.height - bh * s) / 2 - b.y0 * s;
  const lines = posterLinesMarkup(game, new Rng(game.seed ^ 0x27d4eb2f));
  svg.innerHTML =
    `<g transform="translate(${tx} ${ty}) scale(${s})">` +
    lines +
    figureMarkup(game, GAP_PX / s, mode, svg.id) +
    '</g>';
}

// ---------- Partie ----------

function readSeedFromUrl(): number | null {
  const m = (location.hash + location.search).match(/seed=?(\d+)/);
  return m ? Number(m[1]) >>> 0 : null;
}

function newGame(seed = randomSeed()) {
  // La figure finale est pensée pour l'écran entier (affiche de fin, en portrait).
  game = new Game(seed, window.innerWidth / window.innerHeight);
  gameId = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  startedAt = Date.now();
  recordAtStart = storage.getRecord();
  playMs = 0;
  clockStart = null;
  ending = false;
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
  saveStats();
  const isRecord = game.score > recordAtStart;
  if (game.score > storage.getRecord()) storage.setRecord(game.score);

  $('#over-score').textContent = fmt(game.score);
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
    ? previewMarkup(piece, best.x, best.y, GAP_PX / figureScale, (k) => oldColorAt(game, k) !== null)
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
}

function placePiece(slot: number, anchor: { x: number; y: number }) {
  selected = null;
  const res = game.place(slot, anchor.x, anchor.y);
  if (!res) return;
  // La note monte à mesure que la forme se remplit ; une forme finie joue son carillon.
  if (!res.completed) {
    const todo = game.active.cells.size - game.prefilled.size;
    feedback.place((game.filled.size - game.prefilled.size) / todo, game.active.color);
  }
  showGain(res.gain);
  renderScore();
  renderFigure();
  if (res.completed) {
    // La forme qui vient d'être finie est l'avant-dernière (une nouvelle vient d'apparaître).
    feedback.complete(game.shapes[game.shapes.length - 2].color);
    fitCamera(true);
  }
  if (res.gameOver) {
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
  });
});

$('#expand-btn').addEventListener('click', () => {
  setScreen('full');
  drawFigureInto($<SVGSVGElement>('#full-figure'), 'poster', 24);
});
$('#full-screen').addEventListener('click', () => setScreen('over'));

// On quitte l'app ou on change d'onglet : pause automatique (le chrono s'arrête).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) openPause();
});

window.addEventListener('resize', () => {
  if (!game) return;
  renderDecor();
  fitCamera(false);
  renderTray();
  if (screen === 'over') drawFigureInto($<SVGSVGElement>('#over-figure'), 'end', 8);
  if (screen === 'full') drawFigureInto($<SVGSVGElement>('#full-figure'), 'poster', 24);
});

// ---------- Écran de debug (appui long sur le score) ----------

let pressTimer = 0;
const scoreBox = $('#score-box');
scoreBox.addEventListener('pointerdown', () => {
  pressTimer = window.setTimeout(openDebug, 700);
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
    '<tr><th>Date</th><th>Durée</th><th>Formes</th><th>Pièces</th><th>Score</th><th>Seed</th></tr>' +
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

newGame(readSeedFromUrl() ?? randomSeed());

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
