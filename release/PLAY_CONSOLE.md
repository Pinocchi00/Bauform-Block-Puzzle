# Plan Console — préparation uniquement

Aucun compte n'a été créé, aucune piste n'a été ouverte, aucun paquet n'a été envoyé. Ne rien publier sans la validation du créateur.

## Au moment de créer le compte

Choisir le type réel du compte : personnel ou organisation, selon la situation juridique et les justificatifs acceptés par Google. Un D-U-N-S ne prouve pas qu'un compte d'organisation a déjà été créé ou accepté. Les noms, adresse et justificatifs doivent correspondre ; les saisir directement chez Google, sans les mettre dans le dépôt. Prévoir les vérifications d'identité, d'adresse e-mail et de téléphone, le cas échéant d'appareil Android. Aucun abonnement payant ou service de test acheté pour cette préparation.

Pour un nouveau compte personnel, un test fermé avec au moins **12 testeurs inscrits en continu pendant 14 jours** est exigé avant demande d'accès à la production. Le test interne ne le remplace pas. L'exigence n'est pas générale pour les comptes d'organisation ; vérifier les étapes réellement demandées au compte.

## Parcours futur (aucune étape lancée)

1. Créer l'app : nom `Bauform: Block Puzzle`, langue principale français, type Jeu, gratuite. Choisir les déclarations légales en connaissance de cause.
2. Importer les textes `store/fr-FR` et `store/en-US`. La fiche anglaise précise que l'interface actuelle est en français.
3. Choisir Jeux > Réflexion / Puzzle et les tags disponibles correspondant au jeu. Le site Web est facultatif ; l'adresse de support et l'URL de confidentialité sont à finaliser.
4. Importer icône et bannière. Remplacer les captures web du kit par les quatre captures de l'APK final sur appareil/émulateur Android, au ratio 9:16.
5. Contenu de l'app : pas de publicité, pas d'achats, pas d'accès restreint. Reporter les réponses préparées dans `DATA_SAFETY.md` après vérification native finale.
6. Compléter IARC : puzzle abstrait, pas de violence, sexe, langage grossier, drogues, jeux d'argent, achats aléatoires, interaction entre joueurs, chat ou contenu communautaire. Déclarer honnêtement la fonction de partage externe d'une image si le questionnaire la demande. **Aucun âge de classification n'est garanti** : il sera attribué par le questionnaire.
7. Public cible proposé : ados et adultes (13–15, 16–17, 18+), cohérent avec le positionnement graphique. Cette sélection doit refléter le public réellement visé ; elle ne sert pas à contourner Families. Si le créateur vise aussi les enfants, refaire la déclaration et vérifier les règles Families.
8. Renseigner les déclarations conditionnelles réellement présentées : aucune fonctionnalité santé, financière, actualité, service gouvernemental, crédit ou réseau social. Ne pas sélectionner de statut légal non confirmé.
9. Générer/conserver la clé d'upload hors dépôt et configurer les secrets. Activer Play App Signing lors du parcours approprié. Ne pas remplacer une clé déjà utilisée.
10. Relancer le workflow en mode `require_signed=true`. Vérifier le build vert, la signature, le `versionCode` supérieur à tous les envois antérieurs et les contrôles de conformité. Le nom de version est `1.0.0`.
11. Envoyer sur la piste interne et exécuter `ANDROID_TESTS.md`. Examiner le rapport de pré-lancement. Si nécessaire, organiser ensuite le test fermé exigé pour le compte ; ne pas inventer de retours de testeurs.
12. Préparer le brouillon de production, pays, fiche finale et tous les champs. S'arrêter avant la soumission et le lancement publics : validation explicite du créateur requise.

## Confidentialité publique, à publier ultérieurement

`public/privacy.html` est prêt techniquement mais porte une mention préparatoire tant que les coordonnées ne sont pas complétées. Saisir l'identité de l'éditeur, le support et l'URL dans `release/config.json`, exécuter `npm run privacy:prepare`, relire puis héberger ce fichier HTML sur une page HTTPS publique, gratuite, sans connexion et sans restriction géographique (par exemple GitHub Pages). L'URL n'a pas été créée ni prétendue active. Le document est également accessible depuis la pause du jeu.

Avant la diffusion, mettre en place le traitement du support décrit (conservation prévue jusqu'à douze mois après clôture) et vérifier l'accessibilité publique de la politique. `npm run release:check` détecte les champs manquants ; il ne prouve ni l'hébergement effectif ni la conformité juridique complète.

## Exigences techniques vérifiées en ligne au 17/10/2026

- Nouvelle app mobile : cible Android 16 / API 36 ou plus depuis le 31/08/2026. Le projet utilise déjà 36.
- Google Play attend un Android App Bundle pour une nouvelle app. Le bundle doit être signé avec une clé d'upload appropriée.
- Support des pages mémoire 16 Ko à vérifier pour les apps ciblant Android 15+. La documentation actuelle mentionne le 01/02/2027 pour le blocage des mises à jour non compatibles. Aucun `.so` dans l'APK de référence ; réexaminer le nouveau bundle et tout SDK natif ajouté.
- Icône : 512 × 512 ; bannière : 1024 × 500 ; PNG RVB sans alpha. Captures : au moins deux, 320 à 3840 px et côté long au maximum double du côté court ; pour la mise en avant d'un jeu, au moins trois captures 9:16 en 1080 × 1920 recommandées/requises pour ces emplacements. Le kit en prépare quatre.
- Politique de confidentialité publique et accessible dans l'app, y compris si aucune donnée n'est collectée.

Sources officielles :
- API : https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
- Pages 16 Ko : https://developer.android.com/guide/practices/page-sizes
- Assets : https://support.google.com/googleplay/android-developer/answer/9866151?hl=en
- Compte : https://support.google.com/googleplay/android-developer/answer/13628312?hl=en
- Tests personnels : https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Audience : https://support.google.com/googleplay/android-developer/answer/9867159?hl=fr
- Classification : https://support.google.com/googleplay/android-developer/answer/9898843
- Données : https://support.google.com/googleplay/android-developer/answer/10787469?hl=en

Ces exigences et les formulaires peuvent changer ; vérifier les avertissements de la Console au moment du véritable envoi.
