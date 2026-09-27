// Sons (générés, sans fichier audio) et vibrations.
// En phase 2, les vibrations passeront par @capacitor/haptics : dans une page web intégrée
// (comme l'aperçu Claude), Android bloque les vibrations.
//
// Inspirations :
//  - les briques : le « Bauspiel » d'Alma Siedhoff-Buscher (Bauhaus, 1923), un jeu de
//    construction en blocs de bois peints en rouge, jaune et bleu. Poser une pièce fait
//    le « toc » mat et chaud d'un bloc de bois : pas d'aigu, pas de son électronique.
//  - le Bauhaus : Kandinsky y associait chaque couleur à un son (le bleu profond comme un
//    violoncelle, le jaune vif, le rouge chaud et plein, le noir comme un silence).
//    Chaque forme a donc sa propre voix, selon sa couleur.
// Tout reste dans le grave et le médium (filtre à 1 800 Hz) pour ne jamais agresser l'oreille.

import { COLORS } from './config';
import { storage } from './storage';

/** La voix de chaque couleur : note de base (MIDI), durée de résonance, clarté du bois. */
interface Voice {
  base: number;
  ring: number;
  bright: number;
}

const VOICES: Record<string, Voice> = {
  [COLORS.blue]: { base: 48, ring: 0.55, bright: 0.25 }, // do grave, profond et long
  [COLORS.red]: { base: 53, ring: 0.4, bright: 0.45 }, // fa, chaud et plein
  [COLORS.yellow]: { base: 57, ring: 0.3, bright: 0.7 }, // la, vif et clair
  [COLORS.black]: { base: 45, ring: 0.18, bright: 0.15 }, // la grave, mat, presque un silence
  [COLORS.grey]: { base: 50, ring: 0.25, bright: 0.3 }, // ré, neutre et feutré
};

/** Pas de la gamme pentatonique (en demi-tons) : la note monte au plus d'une quinte. */
const STEPS = [0, 2, 4, 7];

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
      // Filtre doux (rien au-dessus de ~1 800 Hz) → volume général → limiteur (jamais de saturation).
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 1800;
      soft.Q.value = 0.5;
      const master = ctx.createGain();
      master.gain.value = 3.5;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 2;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
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
  band.frequency.value = 600 + 700 * voice.bright;
  band.Q.value = 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(volume * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(band).connect(g).connect(input);
  src.start(t);
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
   * Pose d'une pièce : le toc du bois, dans la voix de la couleur de la forme.
   * La note monte doucement (d'une quinte au plus) à mesure que la forme se remplit.
   * @param fill part de la forme remplie après la pose (0 à 1)
   */
  place(fill: number, color: string) {
    const voice = voiceOf(color);
    const step = STEPS[Math.min(STEPS.length - 1, Math.floor(Math.max(0, fill) * STEPS.length))];
    block(voice.base + 12 + step, 0, 0.5, voice);
    vibrate(15);
  },
  /**
   * Forme terminée : quelques blocs qui tombent en place, comme un petit mur qu'on finit
   * de monter (accord majeur égrené, de la voix de la forme), puis la basse qui assoit le tout.
   */
  complete(color: string) {
    const voice = voiceOf(color);
    const notes = [0, 4, 7, 12].map((n) => voice.base + 12 + n);
    notes.forEach((m, k) => block(m, k * 0.09, 0.15, { ...voice, ring: voice.ring + 0.5 }));
    block(voice.base, 0.36, 0.2, { ...voice, ring: 1.2, bright: 0.1 });
    vibrate([20, 60, 30]);
  },
  /** Défaite : deux blocs graves et mats, qui descendent. */
  gameOver() {
    const voice = VOICES[COLORS.black];
    block(52, 0, 0.3, { ...voice, ring: 0.6 });
    block(45, 0.3, 0.32, { ...voice, ring: 1.1 });
    vibrate(60);
  },
};
