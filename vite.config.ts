import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le jeu marche aussi hors de la racine d'un site, et dans l'appli Android.
  base: './',
  build: {
    rollupOptions: {
      // Un seul fichier JavaScript (les parties « web » de Capacitor comprises) :
      // la version en un seul fichier HTML (npm run build:artifact) en a besoin.
      output: { inlineDynamicImports: true },
    },
  },
});
