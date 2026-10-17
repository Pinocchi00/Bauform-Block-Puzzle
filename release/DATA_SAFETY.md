# Sécurité des données — réponses préparées, non soumises

Audit du code au 17 octobre 2026. À confirmer sur le paquet final installé, puis recopier dans les champs réellement affichés par la Console. Aucun compte développeur n'existe encore ; aucune déclaration n'a été envoyée.

| Champ / question | Réponse préparée | Fondement |
|---|---|---|
| Données collectées par l'app | Non | Aucun envoi applicatif identifié. Scores, réglages, historique et statistiques restent dans localStorage privé. |
| Données partagées avec des tiers | Non au sens du formulaire, sous réserve de l'exception ci-contre | Le seul partage est un export PNG explicitement demandé par le joueur ; le destinataire est choisi dans Android. Google prévoit une exception pour les actions volontaires attendues. |
| Types de données à déclarer | Aucun pour le fonctionnement audité | Ni analyse distante ni SDK publicitaire, compte ou serveur de jeu. |
| Création de compte | Non | Aucun compte applicatif. |
| Suppression de compte et URL associée | Non applicable | Pas de création de compte. Expliquer l'effacement local dans la politique. |
| Chiffrement en transit | Ne pas déclarer une certification ou un dispositif non testé | Pas de transmission applicative ; les champs conditionnels peuvent ne pas s'afficher. Le partage choisi suit le service tiers. |
| Audit de sécurité indépendant | Non | Aucun audit certifié effectué. |
| Publicités / identifiant publicitaire | Non / non utilisé | Pas de SDK publicitaire, permission AD_ID absente. |
| Achats intégrés / abonnements | Non | Aucun système de facturation. |
| Accès restreint | Aucun | App utilisable sans identifiants, abonnement, géoblocage applicatif ou code de connexion. |

Les courriels envoyés volontairement au support sont distincts de la télémétrie de l'app : prévoir une procédure de traitement et d'effacement. Refaire l'analyse si un formulaire de support, un service de crash reporting, une synchronisation ou un SDK est ajouté.

## Inventaire observé

Capacitor 8 : Android/Core, App (retour et cycle de vie), Filesystem (cache PNG), Haptics, Share et Splash Screen. Police Jost embarquée, licence OFL conservée. Sons Web Audio générés sur l'appareil. Aucune URL de collecte dans le code applicatif ; aucune requête distante observée pendant la QA web.

Permissions des manifestes source : INTERNET dans l'app et VIBRATE dans Haptics. L'APK de référence contient aussi une permission interne `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` d'AndroidX, de niveau signature, qui n'est pas une permission de collecte. Pas de caméra, micro, localisation, contacts, lecture photos ou stockage externe. FileProvider restreint au sous-dossier privé `cache/posters/`. `allowBackup=false` dans la branche de préparation. Manifeste fusionné du nouveau build encore à vérifier après compilation native.

## Références officielles

- Définition collecte, traitement local, partage volontaire : https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Politique de données et confidentialité : https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
