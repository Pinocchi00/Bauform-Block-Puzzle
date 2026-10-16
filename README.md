# Bauform

Jeu de puzzle mobile inspiré des affiches Bauhaus. Phase 1 : prototype web jouable dans le navigateur du téléphone.

## Lancer le jeu

Il faut [Node.js](https://nodejs.org) (version 20 ou plus).

```bash
npm install        # une seule fois, installe les outils
npm run dev        # lance le jeu sur http://localhost:5173
```

`npm run dev` affiche aussi une adresse « Network » (ex. `http://192.168.1.12:5173`) : ouvrez-la sur le téléphone, connecté au même Wi-Fi, pour jouer.

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | tests automatiques (règles du jeu) |
| `npm run sim` | simule 60 parties jouées par des robots, pour estimer leur longueur |
| `npm run build` | version finale du site, dans `dist/` |
| `npm run build:artifact` | version en un seul fichier HTML, dans `dist-artifact/` |

## Version Android

Le projet Android (Capacitor) est dans `android/`. GitHub construit l'APK de test et le fichier
Google Play à chaque modification : voir [docs/ANDROID.md](docs/ANDROID.md).

## Où régler quoi

Tous les réglages sont dans [`src/config.ts`](src/config.ts) : couleurs, gap entre tuiles, taille des formes, chevauchement, tailles des pièces, points, fréquence des pubs…

| Fichier | Contenu |
|---|---|
| `src/game.ts` | règles : pièces, pose, score, défaite |
| `src/shapes.ts` | formes et découpage en cellules sur la grille |
| `src/generator.ts` | tirage des nouvelles formes |
| `src/render.ts` | dessin SVG (tuiles, aperçu, décor) |
| `src/main.ts` | écrans, glisser-déposer, caméra |
| `src/storage.ts` | record, réglages, mesures (stockage local) |
| `src/feedback.ts` | sons et vibrations |

## Rejouer une partie précise

Chaque partie a une « seed ». Elle est visible dans l'écran de mesures (appui long sur le score). Ajouter `#seed123456` à l'adresse relance exactement la même suite de formes et de pièces.

## Partie en cours, guide, affiche

- La partie en cours est enregistrée après chaque pièce (seed + coups joués) et reprise au lancement suivant. Une seed dans l'adresse lance une nouvelle partie à la place.
- Au tout premier lancement, un guide montre comment glisser une pièce ; il disparaît dès la première pièce posée.
- Sur l'écran de fin, le bouton de partage crée une image de l'affiche (1080 × 1440) : menu de partage du téléphone, ou téléchargement.
- La police Jost est incluse dans le jeu (`src/fonts/`, licence OFL) : rien n'est chargé depuis Internet.
- Icônes et manifeste dans `public/` ; le dessin source est `public/favicon.svg`.

## Écran de mesures

En développement seulement (`npm run dev`). Appui long (0,7 s) sur le score : durée de jeu, formes terminées, pièces posées et score des 20 dernières parties, avec leurs moyennes. La durée ne compte que le temps de jeu (pauses et pubs exclues).
