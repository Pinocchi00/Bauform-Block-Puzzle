// Sauvegarde locale (dans le navigateur) : record, réglages, statistiques des parties.
// Les valeurs relues sont validées : une sauvegarde endommagée ne doit pas bloquer le lancement.

import { STATS_KEEP } from './config';
import type { Move } from './game';

export interface Settings {
  sound: boolean;
  vibrations: boolean;
}

export interface GameStats {
  id: string;
  seed: number;
  date: number;
  /** Temps de jeu effectif, en millisecondes (pauses exclues). */
  durationMs: number;
  shapesCompleted: number;
  piecesPlaced: number;
  score: number;
}

/** Partie en cours, pour la reprendre si l'appli est fermée. */
export interface SavedGame {
  v: 1;
  id: string;
  seed: number;
  aspect: number;
  moves: Move[];
  startedAt: number;
  playMs: number;
  recordAtStart: number;
}

const PREFIX = 'bauform.';
const nonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function validMove(m: unknown): m is Move {
  return m === 'retry' || (Array.isArray(m) && m.length === 3 && m.every(Number.isSafeInteger)
    && m[0] >= 0 && m[0] < 3);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée…) : le jeu marche quand même.
  }
}

export const storage = {
  getRecord: (): number => {
    const value = read<unknown>('record', 0);
    return nonNegative(value) ? value : 0;
  },
  setRecord: (v: number) => write('record', v),

  getSettings: (): Settings => {
    const value = read<Partial<Settings> | null>('settings', null);
    return { sound: typeof value?.sound === 'boolean' ? value.sound : true,
      vibrations: typeof value?.vibrations === 'boolean' ? value.vibrations : true };
  },
  setSettings: (s: Settings) => write('settings', s),

  getStats: (): GameStats[] => {
    const list = read<unknown>('stats', []);
    return Array.isArray(list) ? list.filter((s): s is GameStats => !!s && typeof s.id === 'string'
      && [s.seed, s.date, s.durationMs, s.shapesCompleted, s.piecesPlaced, s.score].every(nonNegative)).slice(0, STATS_KEEP) : [];
  },
  /** Ajoute ou met à jour une partie (même id), et garde les 20 dernières. */
  saveStats(s: GameStats): void {
    const list = storage.getStats().filter((x) => x.id !== s.id);
    list.unshift(s);
    write('stats', list.slice(0, STATS_KEEP));
  },
  clearStats: () => write('stats', []),

  getSavedGame: (): SavedGame | null => {
    const g = read<SavedGame | null>('current', null);
    return g && g.v === 1 && typeof g.id === 'string' && Number.isInteger(g.seed)
      && g.seed >= 0 && g.seed <= 0xffffffff && Number.isFinite(g.aspect) && g.aspect > 0
      && [g.startedAt, g.playMs, g.recordAtStart].every(nonNegative)
      && Array.isArray(g.moves) && g.moves.every(validMove) ? g : null;
  },
  setSavedGame: (g: SavedGame) => write('current', g),
  clearSavedGame: () => {
    try {
      localStorage.removeItem(PREFIX + 'current');
    } catch {
      // rien à faire
    }
  },

  /** Le petit guide du premier lancement a déjà été suivi. */
  getTutorialDone: (): boolean => read<unknown>('tutorialDone', false) === true,
  setTutorialDone: () => write('tutorialDone', true),
};
