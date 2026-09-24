import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le jeu marche aussi hors de la racine d'un site (et plus tard dans Capacitor).
  base: './',
});
