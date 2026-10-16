import type { CapacitorConfig } from '@capacitor/cli';

// Version Android : le jeu web (dist/) emballé dans une appli native.
// appId est définitif une fois l'appli publiée sur Google Play.
const config: CapacitorConfig = {
  appId: 'io.github.pinocchi00.bauform',
  appName: 'Bauform',
  webDir: 'dist',
  backgroundColor: '#C1BAAE',
  android: {
    // Pas de contenu mixte ni de débogage web dans la version publiée.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Le jeu va sous la barre d'état et la barre de navigation ; il garde ses marges
    // grâce à env(safe-area-inset-*). Icônes sombres sur le fond clair du jeu.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: '#C1BAAE',
      showSpinner: false,
    },
  },
};

export default config;
