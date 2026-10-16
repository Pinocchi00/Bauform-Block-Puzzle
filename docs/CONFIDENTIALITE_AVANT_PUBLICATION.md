# Confidentialité — contrôles avant publication

⚠️ Ce fichier n'est **pas une politique de confidentialité prête à publier** : les déclarations dépendent du futur paquet Android, des fournisseurs (publicité, analytics, crash reports), des autorisations et de l'identité légale du développeur.

## Points techniques observés dans la version web

- Le code visible utilise `localStorage` pour conserver record, préférences et statistiques locales.
- La page référence les polices Google Fonts via des requêtes externes, à inspecter dans le paquet final.
- Le module publicitaire actuel simule des interstitiels ; aucun SDK publicitaire Android n'a été identifié dans `package.json`.
- Aucun système de comptes utilisateurs n'est documenté dans le README inspecté.

## À vérifier avant de rédiger le texte définitif

1. Le jeu envoie-t-il des données à un service externe après emballage Android ? Vérifier toutes les bibliothèques natives, crash reports, analytics, publicité et polices distantes.
2. Quelles données sont traitées ou stockées localement et pendant combien de temps ?
3. Quelles données sont partagées avec des tiers, et sur quelle base ?
4. Quelle est l'identité du responsable du traitement et comment le contacter ?
5. Comment l'utilisateur peut-il effacer ses données locales et exercer ses droits le cas échéant ?
6. Où héberger le texte public, accessible sans connexion à un compte ?
7. Comment le rendre accessible **depuis l'application** et depuis la fiche Play Store ?

Règles Google : https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB
