// Sons (générés, sans fichier audio) et vibrations.
// Les vibrations utilisent Capacitor sur Android, navigator.vibrate sur le web.
//
// Inspirations :
//  - les briques : le « Bauspiel » d'Alma Siedhoff-Buscher (Bauhaus, 1923), un jeu de
//    construction en blocs de bois peints en rouge, jaune et bleu. Poser une pièce fait
//    le « toc » mat et chaud d'un bloc de bois : pas d'aigu, pas de son électronique.
//  - le Bauhaus : Kandinsky y associait chaque couleur à un son (le bleu profond comme un
//    violoncelle, le jaune vif, le rouge chaud et plein, le noir comme un silence).
//    Chaque forme a donc sa propre voix, selon sa couleur.
// Les notes restent dans le médium (entre 440 et 1 200 Hz environ) : c'est là qu'un haut-parleur
// de téléphone sonne bien, sans monter dans les aigus qui agressent l'oreille (filtre à 3 000 Hz).

import { COLORS } from './config';
import { isNative, nativeVibrate } from './native';
import { storage } from './storage';

/** La voix de chaque couleur : note de base (MIDI), durée de résonance, clarté du bois. */
interface Voice {
  base: number;
  ring: number;
  bright: number;
}

const VOICES: Record<string, Voice> = {
  [COLORS.blue]: { base: 48, ring: 0.6, bright: 0.25 }, // do grave, profond et long
  [COLORS.red]: { base: 52, ring: 0.45, bright: 0.4 }, // mi, chaud et plein
  [COLORS.yellow]: { base: 50, ring: 0.35, bright: 0.25 }, // ré, clair mais doux
  [COLORS.black]: { base: 45, ring: 0.22, bright: 0.15 }, // la grave, mat, presque un silence
  [COLORS.grey]: { base: 47, ring: 0.3, bright: 0.18 }, // si, neutre et feutré
};

/** Notes de la gamme pentatonique (en demi-tons au-dessus de la note de base). */
const STEPS = [0, 2, 4, 7];

/** Dernière note jouée, pour ne pas répéter la même deux fois de suite. */
let lastStep = -1;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const voiceOf = (color: string) => VOICES[color] ?? VOICES[COLORS.red];

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (!storage.getSettings().sound) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // Filtre doux (rien au-dessus de ~3 000 Hz) → volume général → limiteur (jamais de saturation).
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 3000;
      soft.Q.value = 0.5;
      const master = ctx.createGain();
      master.gain.value = 4;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 2;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.15;
      soft.connect(master).connect(limiter).connect(ctx.destination);
      input = soft;
      // Un court bruit blanc, pour le « toc » du bois.
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Un bloc de bois posé : un petit choc (le « toc »), puis le corps du bois qui résonne
 * brièvement. La hauteur tombe très légèrement au début, comme un vrai choc.
 */
function block(midi: number, delay: number, volume: number, voice: Voice): void {
  const a = audio();
  if (!a || !input || !noise) return;
  const t = a.currentTime + delay;
  const f = hz(midi);

  // Corps du bois : fondamentale + une harmonique « boisée » (non entière) qui s'éteint vite.
  for (const [mult, level, life] of [
    [1, 1, voice.ring],
    [2.4, 0.35 * voice.bright, voice.ring * 0.35],
  ]) {
    const osc = a.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * mult * 1.04, t);
    osc.frequency.exponentialRampToValueAtTime(f * mult, t + 0.03);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume * level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + life);
    osc.connect(g).connect(input);
    osc.start(t);
    osc.stop(t + life + 0.05);
  }

  // Le « toc » : un souffle très court, filtré dans le médium.
  const src = a.createBufferSource();
  src.buffer = noise;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1200 + 900 * voice.bright;
  band.Q.value = 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(volume * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(band).connect(g).connect(input);
  src.start(t);
}

function vibrate(pattern: number | number[]): void {
  if (!storage.getSettings().vibrations) return;
  if (isNative) {
    nativeVibrate(pattern);
    return;
  }
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Pas de vibreur ou vibrations bloquées : tant pis.
  }
}

export const feedback = {
  /**
   * Pose d'une pièce : le toc du bois, dans la voix de la couleur de la forme.
   * La mélodie flâne sur une gamme qui sonne toujours juste, en montant doucement à mesure
   * que la forme se remplit ; jamais deux fois la même note d'affilée, et chaque coup varie
   * un peu (force, résonance, bois), comme un vrai bloc posé à la main.
   * @param fill part de la forme remplie après la pose (0 à 1)
   */
  place(fill: number, color: string) {
    const voice = voiceOf(color);
    const center = Math.max(0, Math.min(1, fill)) * (STEPS.length - 1);
    let step = lastStep;
    for (let t = 0; t < 6 && step === lastStep; t++) {
      step = Math.round(center + (Math.random() * 2.4 - 1.2));
      step = Math.max(0, Math.min(STEPS.length - 1, step));
    }
    lastStep = step;
    const vary = (v: number, amount: number) => v * (1 + (Math.random() * 2 - 1) * amount);
    const touch = { ...voice, ring: vary(voice.ring, 0.15), bright: vary(voice.bright, 0.25) };
    block(voice.base + 24 + STEPS[step], 0, vary(0.65, 0.1), touch);
    // De temps en temps, le bloc « sonne » plus grave, comme posé sur un autre bloc.
    if (Math.random() < 0.25) block(voice.base + 12 + STEPS[step], 0.01, 0.15, { ...touch, bright: 0.1 });
    vibrate(15);
  },
  /**
   * Forme terminée : quelques blocs qui tombent en place, comme un petit mur qu'on finit
   * de monter (accord majeur égrené, de la voix de la forme), puis la basse qui assoit le tout.
   */
  complete(color: string) {
    const voice = voiceOf(color);
    const notes = [0, 4, 7, 12].map((n) => voice.base + 24 + n);
    notes.forEach((m, k) => block(m, k * 0.09, 0.1, { ...voice, ring: voice.ring + 0.5 }));
    block(voice.base + 12, 0.36, 0.11, { ...voice, ring: 1.2, bright: 0.1 });
    vibrate([20, 60, 30]);
  },
  /** Défaite : deux blocs graves et mats, qui descendent. */
  gameOver() {
    const voice = VOICES[COLORS.black];
    block(64, 0, 0.3, { ...voice, ring: 0.6 });
    block(57, 0.3, 0.32, { ...voice, ring: 1.1 });
    vibrate(60);
  },
};
