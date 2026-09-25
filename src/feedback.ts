// Petits sons (générés, sans fichier audio) et vibrations.
// En phase 2, les vibrations passeront par @capacitor/haptics.
//
// Sons calmes mais jamais identiques : chaque pose joue une note douce d'une gamme
// pentatonique (qui sonne toujours juste), en se promenant d'une note à sa voisine,
// avec un léger écho. Hauteur, volume et timbre varient un peu à chaque fois.

import { storage } from './storage';

// Gamme pentatonique de ré, sur deux octaves, en hertz (registre médium, doux).
const SCALE = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880];

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
/** Position dans la gamme : elle avance au hasard, d'une ou deux notes à la fois. */
let step = 4;

function audio(): AudioContext | null {
  if (!storage.getSettings().sound) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // Sortie : un filtre qui adoucit les aigus, plus un petit écho.
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 2200;
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.27;
      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      soft.connect(master);
      soft.connect(delay);
      delay.connect(feedbackGain).connect(delay);
      delay.connect(wet).connect(master);
      master.connect(ctx.destination);
      out = soft;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const vary = (v: number, amount: number) => v * (1 + (Math.random() * 2 - 1) * amount);

/** Une note douce : sinus + un soupçon d'octave, attaque lente, extinction naturelle. */
function note(freq: number, delay = 0, duration = 0.6, volume = 0.1): void {
  const a = audio();
  if (!a || !out) return;
  const t = a.currentTime + delay;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vary(volume, 0.2), t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(out);
  const partials: [number, number][] = [
    [1, 1],
    [2, vary(0.12, 0.5)],
  ];
  for (const [mult, level] of partials) {
    const osc = a.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, t);
    osc.detune.setValueAtTime((Math.random() * 2 - 1) * 6, t);
    const g = a.createGain();
    g.gain.value = level;
    osc.connect(g).connect(gain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}

function wander(): number {
  step += Math.floor(Math.random() * 5) - 2; // -2 à +2
  step = Math.max(2, Math.min(SCALE.length - 3, step));
  return SCALE[step];
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
  /** Pose d'une pièce : une note, parfois accompagnée d'une seconde plus discrète. */
  place(cells = 1) {
    const f = wander();
    note(f, 0, vary(0.55, 0.2), 0.09);
    if (cells >= 3 && Math.random() < 0.4) note(SCALE[Math.min(SCALE.length - 1, step + 2)], 0.09, 0.5, 0.04);
    vibrate(12);
  },
  /** Forme terminée : un petit arpège, montant ou descendant, jamais tout à fait le même. */
  complete() {
    const root = Math.max(0, Math.min(SCALE.length - 5, step - 2 + Math.floor(Math.random() * 3)));
    const notes = [0, 1, 2, 4].map((k) => SCALE[root + k]);
    if (Math.random() < 0.4) notes.reverse();
    const gap = vary(0.11, 0.25);
    notes.forEach((f, k) => note(f, 0.08 + k * gap, 1.2, 0.07));
    vibrate([15, 40, 25]);
  },
  gameOver() {
    note(SCALE[2], 0, 1.4, 0.08);
    note(SCALE[0], 0.35, 1.8, 0.08);
    vibrate(40);
  },
};
