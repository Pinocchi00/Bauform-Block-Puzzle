// Ce qui change quand le jeu tourne dans l'appli Android (Capacitor) plutôt que dans un navigateur.
// Dans un navigateur, ces fonctions ne font rien de plus que la version web.

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Haptics } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

/** Vibration : [vibre, pause, vibre…] en millisecondes, comme navigator.vibrate. */
export function nativeVibrate(pattern: number | number[]): void {
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  let at = 0;
  steps.forEach((ms, i) => {
    if (i % 2 === 0) setTimeout(() => void Haptics.vibrate({ duration: ms }).catch(() => {}), at);
    at += ms;
  });
}

/** Partage une image avec le menu de partage d'Android. Renvoie false si le partage n'a pas pu s'ouvrir. */
export async function nativeSharePng(blob: Blob, name: string, title: string): Promise<boolean> {
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title, files: [file.uri], dialogTitle: title });
    return true;
  } catch (e) {
    // Partage annulé par le joueur : ce n'est pas une erreur.
    return /cancel/i.test(String(e));
  }
}

/** Bouton « retour » d'Android et passage en arrière-plan. */
export function onNativeEvents(handlers: { back: () => void; pause: () => void }): void {
  if (!isNative) return;
  void App.addListener('backButton', handlers.back);
  void App.addListener('pause', handlers.pause);
}

/** Met l'appli en arrière-plan (comme le bouton d'accueil), sans la fermer. */
export function minimizeApp(): void {
  if (isNative) void App.minimizeApp();
}
