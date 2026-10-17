# Recette Android finale — NON ENCORE EXÉCUTÉE

La QA web ne valide pas le vibreur, la WebView Android, les barres système ou le menu natif de partage. Aucun résultat ci-dessous n'est coché par anticipation.

Tester l'APK reconstruit depuis la branche de préparation (pas seulement l'ancien APK `apk-test`) sur un téléphone réel récent et si possible Android 7/8 ou émulateur API 24, plus API 35/36. Contrôler petit écran, grand écran, navigation par gestes et trois boutons, encoche et tablette. Les formats web vérifiés sont détaillés dans `qa/mobile-report.json`.

| Vérification | Critère de réussite | Statut |
|---|---|---|
| Installation / lancement sans réseau | Plateau, police et sons disponibles en mode avion | À tester |
| Tutoriel et première pose | Pièce visible au-dessus du doigt, guide disparaît après pose | À tester |
| Pose par toucher et glissement | Pas de défilement, pas de doublon, annulation propre | À tester |
| Pause et arrière-plan | Pas de temps de jeu compté en pause, reprise sans perte | À tester |
| Fermeture forcée / redémarrage | Même seed, mêmes pièces, même score après reprise | À tester |
| Retour Android | Jeu → pause ; pause/fin → arrière-plan ; plein écran → fin | À tester |
| Politique de confidentialité | Accessible depuis pause, retour au jeu sans perdre la partie | À tester |
| Son / vibrations | Réglages persistants ; vibration native coupée si désactivée | À tester sur appareil réel |
| Fin, retry et nouvelle partie | Retry unique gratuit ; reprise correcte après retry ; pas d'annonce | À tester |
| Partage natif | PNG 1080 × 1440 lisible dans une appli destinataire ; annulation sans erreur | À tester |
| Partage absent / erreur | Message français visible, bouton réutilisable, pas de crash | À tester |
| Affiche / plein écran | Pas de coupe, boutons accessibles, retour correct | À tester |
| Barres système / API 36 | Score et commandes hors des encoches/barres, contraste lisible | À tester |
| Partie longue et 20 relances | Pas de blocage ou chauffe anormale ; record cohérent | À tester |
| Mise à jour de version | Record/réglages conservés à identifiant et signature identiques | À tester |
| Rapport Play de pré-lancement | Aucun crash/ANR ou problème bloquant non résolu | Après création du compte |

Captures Android : quatre PNG RVB 1080 × 1920 du vrai APK, sans interface ajoutée : plateau, progression, fin et affiche plein écran. Utiliser un émulateur 9:16 si le téléphone produit un ratio hors des limites Google. Ne pas étirer une capture pour changer son ratio.

Pour enregistrer une capture via ADB sur Windows sans corruption des octets par PowerShell :
`powershell -File scripts/capture-android.ps1 -Name 01-puzzle`
Le script capture uniquement ; il ne déploie ni ne publie le jeu. Installer les outils officiels Android avant usage.
