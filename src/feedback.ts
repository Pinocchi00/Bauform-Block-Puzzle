// Petits sons (générés, sans fichier audio) et vibrations.
// En phase 2, les vibrations passeront par @capacitor/haptics.

import { storage } from './storage';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!storage.getSettings().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Une note courte et douce, comme un bloc de bois. */
function tone(freq: number, delay = 0, duration = 0.12, volume = 0.12): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function vibrate(pattern: number | number[]): void {
  if (!storage.getSettings().vibrations) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Pas de vibreur : tant pis.
  }
}

export const feedback = {
  place() {
    tone(330, 0, 0.1);
    vibrate(12);
  },
  complete() {
    tone(392, 0, 0.25, 0.1);
    tone(494, 0.07, 0.25, 0.1);
    tone(587, 0.14, 0.4, 0.1);
    vibrate([15, 40, 25]);
  },
  gameOver() {
    tone(220, 0, 0.5, 0.1);
    tone(165, 0.15, 0.7, 0.1);
    vibrate(40);
  },
};
