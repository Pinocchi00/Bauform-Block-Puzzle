# Bauform — préflight Google Play (16/10/2026)

## Position du projet

La branche inspectée contient un **prototype web TypeScript/Vite** : un moteur de puzzle, du SVG, des effets et des tests Vitest. Elle **ne contient pas** de projet Android Capacitor/Gradle ni de fichier AAB signé. Les pubs sont des démonstrations. Ce dossier ne prétend pas livrer une application Android téléversable telle quelle.

## Tests avant gel de version

- [ ] `npm ci`, `npm test`, `npm run sim` et `npm run build` sans erreur.
- [ ] Jouer au moins 20 parties manuelles sur le téléphone cible : pose, glissé et geste de sélection, pause/reprise, défaite, retry, record, reprise après mise en arrière-plan.
- [ ] Tester 320 × 568, 360 × 800, 390 × 844 et 412 × 915 (ainsi que les barres de navigation et les encoches).
- [ ] Vérifier le texte, la lisibilité, les contrastes, les vibrations, le son, les animations réduites et l'écran final sur un véritable Android.
- [ ] Tester sans connexion : attention, le HTML actuel charge la police Jost depuis Google Fonts ; pour un hors-ligne strict, intégrer légalement une police locale ou utiliser une police système.
- [ ] Ne pas activer de publicités réelles avant configuration du consentement, des déclarations sur les données, de la confidentialité et de tests conformes.
- [ ] Vérifier l'usage du nom « Bauform » et les droits de l'ensemble des ressources.

## Conversion Android

1. Créer un projet Android enveloppant le build web, par exemple avec **Capacitor**, une fois le gameplay gelé. Ne pas bricoler d'APK à partir de `index.html` seul.
2. Utiliser un **identifiant d'application stable** choisi avec soin avant le premier lancement.
3. Configurer **targetSdk 36 au minimum** pour une nouvelle publication sur Google Play (obligation depuis le 31 août 2026 pour les apps mobiles) : https://support.google.com/googleplay/android-developer/answer/11926878?hl=fr
4. Construire un **Android App Bundle (`.aab`)** de release signé, compatible Play App Signing : https://developer.android.com/guide/app-bundle?hl=fr
5. Installer une version de test sur un téléphone Android, contrôler les performances, la sortie / reprise et les gestuelles. Attention à la webview et au `viewport-fit=cover`.
6. Préparer icône (512×512 pour le Store), feature graphic, captures Android issues du **vrai jeu**, description courte et complète, classification, catégorie, coordonnées et adresse de support.
7. Préparer la **politique de confidentialité publique** et son accès depuis l'application, ainsi que les réponses exactes à la rubrique **Sécurité des données**. Les déclarations devront être refaites si un SDK publicitaire est ajouté : https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB
8. Si le compte Google Play est un **compte personnel créé après le 13 novembre 2023**, vérifier le test fermé requis (12 testeurs inscrits en continu pendant 14 jours) avant l'accès à la production. Cette obligation n'est pas générale pour les comptes d'organisation : https://support.google.com/googleplay/android-developer/answer/14151465?hl=fr-CA
9. Tester par la piste interne puis, le cas échéant, fermée. Ne diffuser en production qu'une fois les éléments légaux, visuels, techniques et le gameplay validés.

## Décisions produit recommandées

- **Version 1.0 :** puzzle gratuit, sans interstitiels fictifs. Laisser la monétisation à une mise à jour lorsque SDK, consentement et données sont correctement intégrés.
- **Pas d'ajouts mécaniques** avant la première sortie. Garder Cage Legacy hors de ce cycle.
- **Sortie graduelle :** bêta interne, corrections critiques, lancement. Une partie ne doit pas être empêchée par une publicité non disponible.

## Limites actuelles

Sans un environnement de build Android, un accès en écriture au dépôt, les ressources finales, les comptes et la signature de release, il n'est pas possible de publier le jeu ou de produire honnêtement un AAB validé.
