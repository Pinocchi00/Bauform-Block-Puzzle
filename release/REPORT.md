# Bauform — rapport de préparation 1.0

Préparation du 17 octobre 2026. **Aucun jeu publié, aucune création de compte développeur, aucun envoi Google Play.** Le créateur a précisé qu'il ne dispose pas encore du compte et demande uniquement la préparation.

## Résultat et limites

Le jeu web a été audité et corrigé sur une branche dédiée locale. Les tests, simulations, build TypeScript/Vite, synchronisation Capacitor et contrôles web mobiles passent. Le kit commercial et les documents sont préparés. **La nouvelle version Android n'a pas été compilée/installée ici et aucun AAB signé validé n'est livré.** Elle ne doit pas encore être présentée comme prête pour une soumission.

## Référence et liens GitHub

- Dépôt : https://github.com/Pinocchi00/Bauform-Block-Puzzle
- Source de référence : https://github.com/Pinocchi00/Bauform-Block-Puzzle/tree/ccr-65d37fd4-svnpwh
- Commit préservé : https://github.com/Pinocchi00/Bauform-Block-Puzzle/commit/53d3859b9642cd1c5d857907bf4704ddf66bac83
- Compilation de référence réussie : https://github.com/Pinocchi00/Bauform-Block-Puzzle/actions/runs/38979833553
- Ancien APK : https://github.com/Pinocchi00/Bauform-Block-Puzzle/tree/apk-test

La connexion indique des droits utilisateur mais l'API refuse la création d'une référence avec **403 Resource not accessible by integration**. L'envoi Git direct échoue aussi faute d'authentification. Aucun changement distant, aucune PR et aucune nouvelle branche distante n'ont donc été créés. Il n'existe pas de lien GitHub vers les modifications de cette mission.

La branche locale `release/google-play-1.0` et le tag local `reference/android-2026-10-17` conservent le travail et la base. Le kit fournit un patch Git complet et ses instructions d'intégration. Aucune branche existante n'a été supprimée ou écrasée. La branche par défaut distante reste l'ancienne `claude/phase-1-5nds4w` ; son remplacement attend la validation native finale.

## Modifications réalisées

| Domaine | Changement concret |
|---|---|
| Stockage | Validation des types du record, réglages, résultats et sauvegarde ; une valeur JSON corrompue n'empêche plus de démarrer ou terminer une partie. |
| Reprise | Rejet d'un historique qui prétend utiliser une seconde chance avant une défaite. Les replays valides restent identiques. |
| Partage | Une erreur native ou de génération d'image donne un message et libère le bouton ; le résultat d'échec n'est plus ignoré. |
| Fichiers partagés | PNG créé dans `cache/posters/` ; FileProvider limité à ce sous-dossier au lieu du stockage externe et de tout le cache. |
| Données locales | Sauvegarde Android automatique désactivée pour rendre la configuration cohérente avec la politique locale ; transferts constructeur à contrôler sur appareil. |
| Publicité | Suppression complète de la simulation, de son écran et des compteurs inutiles. Retry et relance immédiats, sans SDK ajouté. La version de production d'origine ignorait déjà la fausse pub ; le nettoyage supprime également le comportement de développement. |
| Tactile | Boutons d'icônes à 48 px ; proportions et identité conservées. Aucun remaniement des règles, couleurs ou de la génération. |
| Confidentialité | Document local FR/EN lié depuis la pause, générateur depuis trois champs explicites, contrôle qui refuse les champs incomplets. |
| Versions | Paquet web 1.0.0 et future version Android lisible 1.0.0 ; versionCode CI croissant conservé. |
| CI | Tests/simulation/sync, lint Android, vérification de signature, secrets passés via environnement et échappement Java properties ; AAB signé/non signé étiqueté clairement. |
| Déploiement | Suppression de la publication automatique de Releases et du push forcé de la branche APK. Workflow limité à produire des artefacts. |
| QA | Tests de régression, pilote tactile sur six formats, captures du vrai jeu et smoke test de production reproductibles. |
| Documentation | README, Android et anciens préflights remis en cohérence avec les sources actuelles. |

## Résultats des vérifications

| Contrôle | Résultat réel |
|---|---|
| `npm ci` | Réussi depuis le lockfile, Node 24.19 dans cet environnement. |
| `npm test` | **19 tests réussis**, 3 fichiers. Base avant modification : 15 tests réussis. |
| `npm run sim` | Réussi : 60 parties aléatoires et 60 prudentes. Moyennes 7,4 et 12 formes ; aucune partie ≤ 2 formes ou > 40 formes dans cet échantillon. |
| `npm run build` | Réussi, TypeScript sans erreur et Vite compilé. Avertissement de dépréciation préexistant `inlineDynamicImports`, non bloquant et sans changement de configuration inutile. |
| QA mobile web | **6 formats réussis** : 320×568, 360×640, 360×800, 390×844, 412×915, 800×1280. |
| Gestes web | Sélection puis toucher, véritable séquence tactile de glisser-déposer, pause, reprise, réglages, fin, retry/reprise, plein écran et export PNG réussis. |
| Réseau web | Aucune requête distante observée dans ce parcours. Le jeu déjà chargé fonctionne avec le réseau coupé. Ce n'est pas une capture de trafic Android. |
| Production | Reprise d'une vraie sauvegarde, tolérance des données corrompues, absence de pilote debug exposé et accès à la politique vérifiés dans le build. |
| `npm run android:sync` | Réussi ; cinq plugins Android Capacitor détectés et assets copiés. |
| YAML workflow | Analyse syntaxique réussie ; **le nouveau workflow n'a pas été exécuté sur GitHub**. |
| APK de référence | Archive lisible, manifeste extrait : `.debug`, versionCode 2, versionName 1.0.2, minimum 24, cible/compilation 36, aucun `.so`. Pas d'installation ni validation cryptographique indépendante de sa signature. |
| AAB de référence | Artefact présent sur la CI réussie, mais étape « Clé de signature » ignorée ; le bundle est à traiter comme non signé, pas comme fichier prêt pour Play. |
| Nouveau build Android | Tenté ; **échec avant compilation** : accès réseau Gradle indisponible. SDK Android absent, seul Java 17 disponible alors que le projet attend 21. Aucun nouveau APK/AAB validé. |
| `npm run release:check` | Échec attendu et explicite : éditeur, adresse de support et URL HTTPS absents ; document préparatoire. |

Les preuves textuelles, le manifeste de référence et les rapports sont dans `qa/`. Empreinte SHA-256 de l'APK de référence : `68274a3782eb7c21aa15a5edf41920029368687e6ec72f1c8fb3a654de6981b1`.

## Ressources et fiche commerciale

- Nom conservé : **Bauform: Block Puzzle**.
- Positionnement : puzzle géométrique qui révèle une affiche inspirée du Bauhaus.
- `store/fr-FR/` et `store/en-US/` : nom, description courte, description longue et notes 1.0. Champs dans leurs limites : noms 21 caractères, descriptions courtes 74 et 79 ; descriptions longues sous 4000.
- `store/metadata.json` : catégorie Puzzle, tags suggérés, gratuit, sans pub ni achat ; coordonnées et choix réglementaires non inventés.
- `graphics/play-icon-512.png` : icône actuelle vectorielle rasterisée, PNG RVB opaque 512×512.
- `graphics/feature-fr-1024x500.png` et `feature-en-1024x500.png` : bannières finales et sources SVG, police Jost licenciée.
- `graphics/screenshots-web/` : quatre captures **réelles du jeu web** à 1080×1920, sans fausse interface. Elles restent à remplacer par des captures Android natives pour satisfaire intégralement la mission.
- `graphics/exemple-affiche-1080x1440.png` : vrai export du jeu, usage promotionnel distinct des captures.

La fiche anglaise n'annonce pas une traduction inexistante : elle précise que l'interface du jeu reste en français.

## Confidentialité et conformité préparées

`public/privacy.html` est le document FR/EN lisible dans le jeu. Le kit en inclut une copie. Il décrit stockage local, vingt derniers résultats, cache PNG, partage volontaire, permissions, suppression des données et contact support. Il reste marqué préparatoire car l'identité publique et l'adresse de contact manquent. Aucune URL publique n'a été créée.

`DATA_SAFETY.md` prépare les réponses « pas de collecte » et « pas de partage à déclarer » au sens du formulaire pour le fonctionnement audité, en expliquant l'exception du partage volontaire. Cela doit être confirmé sur le paquet final ; aucune déclaration n'est déjà soumise ou certifiée.

`PLAY_CONSOLE.md` fournit le parcours futur et les sources Google vérifiées au 17/10/2026 : cible API 36, assets, confidentialité, classification, public réel visé et exigences conditionnelles du compte. La classification IARC n'est pas inventée. Le compte n'existe pas encore : on ne présume pas de son type ou de son exemption de test fermé.

## Étapes restantes, dans l'ordre

1. Rétablir l'écriture GitHub ou appliquer le patch sur la branche dédiée, sans toucher aux branches d'origine.
2. Construire le nouveau projet sur GitHub Actions ou Android Studio avec Java 21 et SDK 36 ; résoudre tout éventuel échec natif. Le workflow modifié n'est pas encore validé par une exécution.
3. Exécuter `ANDROID_TESTS.md` et remplacer les captures web par la série Android. Vibreur, partage natif, retour, barres système, démarrage hors ligne et durée doivent être contrôlés sur appareil.
4. Renseigner **l'identité publique exacte de l'éditeur et une adresse de support opérationnelle**. Les justificatifs et coordonnées privées de création de compte restent à saisir chez Google, pas dans ce kit.
5. Choisir l'hébergement gratuit de la politique, compléter son URL et y publier seulement le document final au moment approprié. Aucune publication effectuée dans cette mission.
6. Créer et conserver une clé d'upload en privé si elle n'existe pas déjà, configurer les secrets puis produire et vérifier l'AAB signé. Aucun mot de passe ou clé ne doit être envoyé dans la conversation.
7. Plus tard : créer/valider le compte Google Play. Si c'est un nouveau compte personnel, organiser les 12 testeurs inscrits continuellement 14 jours avant demande de production. Aucun testeur ou retour fictif.
8. Renseigner la Console et préparer le brouillon final ; intégrer la version principale seulement après les contrôles réussis. **Le créateur garde la décision finale de soumission et de diffusion publiques.**

Le kit contient des changements testés et une préparation commerciale utilisable ; il n'affirme pas que la publication Android est terminée.
