// Sons (générés, sans fichier audio) et vibrations.
// En phase 2, les vibrations passeront par @capacitor/haptics.
//
// Esprit « musique de film » : tout suit une suite d'accords (la mineur, fa, do, sol),
// qui avance d'un accord à chaque forme terminée. Chaque pose joue une note douce et grave
// de l'accord en cours, dans une grande réverbération ; une forme terminée fait monter une
// nappe chaude de l'accord suivant. Pas d'aigus agressifs : tout passe par un filtre doux.

import { storage } from './storage';

/** Notes (numéros MIDI) de chaque accord, pour la mélodie, et sa basse. */
const CHORDS = [
  { bass: 45, notes: [57, 60, 64, 69, 72] }, // la mineur
  { bass: 41, notes: [57, 60, 65, 69, 72] }, // fa majeur
  { bass: 48, notes: [55, 60, 64, 67, 72] }, // do majeur
  { bass: 43, notes: [55, 59, 62, 67, 71] }, // sol majeur
];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;
let chord = 0;
/** Position dans l'accord : la mélodie avance d'une note voisine à la fois. */
let step = 2;

/** Réverbération : une « salle » fabriquée avec du bruit qui s'éteint lentement. */
function makeReverb(a: AudioContext, seconds: number): ConvolverNode {
  const rate = a.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = a.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  const conv = a.createConvolver();
  conv.buffer = buffer;
  return conv;
}

function audio(): AudioContext | null {
  if (!storage.getSettings().sound) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // Chaîne : filtre doux → (son direct + réverbération) → limiteur → haut-parleur.
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 1500;
      soft.Q.value = 0.3;
      const dry = ctx.createGain();
      dry.gain.value = 0.75;
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      const reverb = makeReverb(ctx, 3.2);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.ratio.value = 4;
      soft.connect(dry).connect(limiter);
      soft.connect(reverb).connect(wet).connect(limiter);
      limiter.connect(ctx.destination);
      input = soft;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Une note douce et ronde (sinus + un peu de triangle), qui s'éteint lentement. */
function pluck(freq: number, delay: number, volume: number, duration = 1.6): void {
  const a = audio();
  if (!a || !input) return;
  const t = a.currentTime + delay;
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  env.connect(input);
  for (const [type, level] of [
    ['sine', 1],
    ['triangle', 0.18],
  ] as const) {
    const osc = a.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = level;
    osc.connect(g).connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.1);
  }
}

/** Nappe : plusieurs voix légèrement désaccordées qui montent lentement puis s'éteignent. */
function swell(midis: number[], volume: number, attack: number, release: number): void {
  const a = audio();
  if (!a || !input) return;
  const t = a.currentTime;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.linearRampToValueAtTime(1100, t + attack);
  filter.frequency.linearRampToValueAtTime(400, t + attack + release);
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(volume, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  filter.connect(env).connect(input);
  for (const m of midis) {
    for (const detune of [-7, 7]) {
      const osc = a.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz(m);
      osc.detune.value = detune;
      const g = a.createGain();
      g.gain.value = 1 / (midis.length * 2);
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + attack + release + 0.1);
    }
  }
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
  /** Pose : une note de l'accord en cours, voisine de la précédente. */
  place(cells = 1) {
    const notes = CHORDS[chord].notes;
    step = Math.max(0, Math.min(notes.length - 1, step + (Math.random() < 0.5 ? -1 : 1)));
    pluck(hz(notes[step]), 0, 0.09);
    // Les grosses pièces ajoutent parfois la basse, très bas et très doux.
    if (cells >= 3 && Math.random() < 0.35) pluck(hz(CHORDS[chord].bass + 12), 0.02, 0.05, 2.2);
    vibrate(12);
  },
  /** Forme terminée : l'accord suivant monte en nappe, avec sa basse. */
  complete() {
    chord = (chord + 1) % CHORDS.length;
    const c = CHORDS[chord];
    swell([c.bass, c.bass + 12, ...c.notes.slice(0, 3)], 0.16, 0.9, 3.2);
    pluck(hz(c.notes[2]), 0.35, 0.06, 2.4);
    vibrate([15, 40, 25]);
  },
  gameOver() {
    chord = 0;
    swell([33, 45, 52, 57, 60], 0.14, 1.4, 4);
    vibrate(40);
  },
};
