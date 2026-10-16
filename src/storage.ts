// Sauvegarde locale (dans le navigateur) : record, réglages, statistiques des parties.
// En phase 2, ce fichier passera sur @capacitor/preferences.

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
  /** Temps de jeu effectif, en millisecondes (pauses et pubs exclues). */
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
  getRecord: (): number => read('record', 0),
  setRecord: (v: number) => write('record', v),

  getSettings: (): Settings => ({ sound: true, vibrations: true, ...read<Partial<Settings>>('settings', {}) }),
  setSettings: (s: Settings) => write('settings', s),

  /** Temps de jeu (millisecondes) depuis la dernière pub interstitielle. */
  getPlaySinceAd: (): number => read('playSinceAd', 0),
  setPlaySinceAd: (v: number) => write('playSinceAd', v),

  getStats: (): GameStats[] => read('stats', []),
  /** Ajoute ou met à jour une partie (même id), et garde les 20 dernières. */
  saveStats(s: GameStats): void {
    const list = storage.getStats().filter((x) => x.id !== s.id);
    list.unshift(s);
    write('stats', list.slice(0, STATS_KEEP));
  },
  clearStats: () => write('stats', []),

  getSavedGame: (): SavedGame | null => {
    const g = read<SavedGame | null>('current', null);
    return g && g.v === 1 && Array.isArray(g.moves) ? g : null;
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
  getTutorialDone: (): boolean => read('tutorialDone', false),
  setTutorialDone: () => write('tutorialDone', true),
};
