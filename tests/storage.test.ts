import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '../src/storage';
import { Game } from '../src/game';

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});

describe('stockage endommagé', () => {
  it('ne plante pas quand les statistiques ou le record ont un mauvais type', () => {
    values.set('bauform.stats', 'null');
    values.set('bauform.record', '"oops"');
    expect(storage.getRecord()).toBe(0);
    expect(storage.getStats()).toEqual([]);
    expect(() => storage.saveStats({ id: 'a', seed: 1, date: 1, durationMs: 0,
      shapesCompleted: 0, piecesPlaced: 1, score: 30 })).not.toThrow();
    expect(storage.getStats()).toHaveLength(1);
  });
  it('refuse une sauvegarde dont un coup, la seed ou le ratio est invalide', () => {
    const good = { v: 1, id: 'a', seed: 1, aspect: 0.46, moves: [[0, 1, 2]],
      startedAt: 1, playMs: 0, recordAtStart: 0 };
    for (const bad of [{ moves: [null] }, { moves: [[4, 1, 2]] }, { aspect: 0 }, { seed: 'oops' }]) {
      values.set('bauform.current', JSON.stringify({ ...good, ...bad }));
      expect(storage.getSavedGame()).toBeNull();
    }
    values.set('bauform.current', JSON.stringify(good));
    expect(storage.getSavedGame()).toEqual(good);
  });
  it('utilise les réglages par défaut quand les valeurs ne sont pas booléennes', () => {
    values.set('bauform.settings', '{"sound":"false","vibrations":false}');
    expect(storage.getSettings()).toEqual({ sound: true, vibrations: false });
  });
  it('refuse une reprise qui invente une seconde chance avant une défaite', () => {
    expect(Game.replay(1, 0.46, ['retry'])).toBeNull();
  });
});
