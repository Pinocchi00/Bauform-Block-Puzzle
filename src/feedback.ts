// Sons (générés, sans fichier audio) et vibrations.
// En phase 2, les vibrations passeront par @capacitor/haptics : dans une page web intégrée
// (comme l'aperçu Claude), Android bloque les vibrations.
//
// Chaque pose joue une note douce, comme une petite cloche en bois. Plus la forme se
// remplit, plus la note monte, sur une gamme qui sonne toujours juste (pentatonique).
// Une forme terminée joue un carillon lumineux.

import { storage } from './storage';

/** Gamme pentatonique de do, du do grave au do aigu (numéros MIDI). */
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;

/** Petite réverbération : un peu d'espace autour des notes, sans brouillard. */
function makeReverb(a: AudioContext, seconds: number): ConvolverNode {
  const length = Math.floor(a.sampleRate * seconds);
  const buffer = a.createBuffer(2, length, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
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
      const bus = ctx.createGain();
      bus.gain.value = 1;
      const dry = ctx.createGain();
      dry.gain.value = 1;
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      const reverb = makeReverb(ctx, 1.8);
      // Limiteur : on peut monter le volume sans que ça sature.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      const master = ctx.createGain();
      master.gain.value = 1.6;
      bus.connect(dry).connect(limiter);
      bus.connect(reverb).connect(wet).connect(limiter);
      limiter.connect(master).connect(ctx.destination);
      input = bus;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Une note de cloche douce : un son rond, quelques harmoniques légères, extinction lente. */
function bell(midi: number, delay: number, volume: number, duration = 1.3): void {
  const a = audio();
  if (!a || !input) return;
  const t = a.currentTime + delay;
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  env.connect(input);
  const partials: [number, number, number][] = [
    // [multiple de la fréquence, niveau, durée relative]
    [1, 1, 1],
    [2, 0.22, 0.6],
    [3, 0.06, 0.35],
  ];
  for (const [mult, level, life] of partials) {
    const osc = a.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz(midi) * mult;
    const g = a.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration * life);
    osc.connect(g).connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}

function vibrate(pattern: number | number[]): void {
  if (!storage.getSettings().vibrations) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Pas de vibreur ou vibrations bloquées : tant pis.
  }
}

export const feedback = {
  /**
   * Pose d'une pièce.
   * @param fill part de la forme remplie après la pose (0 à 1) : plus elle est grande, plus la note monte.
   */
  place(fill: number) {
    const step = Math.round(Math.max(0, Math.min(1, fill)) * (SCALE.length - 2));
    bell(SCALE[step], 0, 0.32);
    vibrate(15);
  },
  /** Forme terminée : un carillon qui monte jusqu'à l'aigu, puis un accord qui résonne. */
  complete() {
    const run = [72, 76, 79, 84, 88];
    run.forEach((m, k) => bell(m, k * 0.075, 0.2, 1.4));
    for (const m of [72, 76, 79]) bell(m, 0.42, 0.13, 2.4);
    vibrate([20, 60, 30]);
  },
  gameOver() {
    bell(67, 0, 0.25, 1.6);
    bell(64, 0.28, 0.25, 1.8);
    bell(60, 0.56, 0.28, 2.6);
    vibrate(60);
  },
};
