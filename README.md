# Bauform: Block Puzzle

Puzzle mobile inspiré du Bauhaus : remplir des silhouettes géométriques pour composer progressivement une affiche. TypeScript, SVG, Vite et Capacitor 8 pour Android. Version 1.0 prévue gratuite, sans publicité ni achats intégrés.

## État et branches

- Base Android auditée : `ccr-65d37fd4-svnpwh`, commit `53d3859b9642cd1c5d857907bf4704ddf66bac83`.
- Préparation locale : `release/google-play-1.0` ; référence locale : branche/tag `reference/android-2026-10-17`.
- La branche par défaut distante `claude/phase-1-5nds4w` reste une ancienne version. Elle n'a pas été modifiée.
- `apk-test` contient l'ancien APK de test, pas la source de référence.
- L'écriture distante a été refusée (403) pendant cette préparation. Voir `release/REPORT.md` pour les statuts exacts. Aucun jeu publié ni compte développeur créé.

## Développement et vérifications

Node.js 22.12+ et npm. Installer les versions du lockfile :

```bash
npm ci
npm run dev
npm test
npm run sim
npm run build
npm run android:sync
```

| Commande | Résultat |
|---|---|
| `npm test` | Règles, reprise et stockage endommagé |
| `npm run sim` | 60 parties par stratégie, aléatoire et prudente |
| `npm run build` | TypeScript vérifié et build dans `dist/` |
| `npm run qa:mobile` | Interactions et captures du vrai jeu web sur six formats ; Chromium Playwright requis (`npx playwright install chromium`) |
| `node scripts/qa-production.mjs` | Smoke test du build, après la QA mobile |
| `npm run build:artifact` | Aperçu HTML et politique séparée dans `dist-artifact/` |
| `npm run privacy:prepare` | Génère le document local depuis `release/config.json` |
| `npm run release:check` | Refuse les coordonnées manquantes avant la préparation d'une release signée |

## Android et préparation Google Play

Projet dans `android/`, identifiant `io.github.pinocchi00.bauform`, API minimum 24, cible/compilation 36. La variante debug a le suffixe `.debug` et s'installe à côté de la production. Voir [documentation Android](docs/ANDROID.md).

Tout le dossier de préparation est dans [`release/`](release/REPORT.md) : textes FR/EN, ressources graphiques, politique, réponses Sécurité des données, plan Console et recette native. Les captures web sont clairement distinguées des futures captures Android. Le workflow construit des artefacts et **ne publie rien**.

## Organisation du jeu

| Fichier | Rôle |
|---|---|
| `src/game.ts` | Règles, pièces, score et seconde chance |
| `src/shapes.ts`, `geometry.ts`, `generator.ts`, `rng.ts` | Géométrie et génération déterministe |
| `src/render.ts` | Dessin SVG du jeu et des affiches |
| `src/main.ts` | Écrans, gestes, caméra, reprise et export |
| `src/storage.ts` | Sauvegardes et statistiques locales validées |
| `src/native.ts` | Cycle de vie Android, partage et vibrations |
| `src/feedback.ts` | Sons Web Audio et retours tactiles |
| `src/config.ts`, `style.css` | Réglages et identité visuelle |

Chaque partie conserve sa seed et ses coups ; une seed dans l'URL (`#seed17`) lance une partie déterministe. L'écran de diagnostic et le pilote de QA sont uniquement disponibles en développement, jamais dans le build de production.

La police Jost est embarquée avec sa licence OFL (`src/fonts/OFL.txt`). Aucun service d'analyse ou SDK publicitaire n'est intégré. Les sons sont générés sur l'appareil. La partie, le record et les vingt derniers résultats restent sur l'appareil. L'affiche PNG n'est partagée que sur action du joueur.
