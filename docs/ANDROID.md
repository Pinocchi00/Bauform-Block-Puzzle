# Android — préparation 1.0 (17/10/2026)

Le projet Android et la préparation 1.0 sont sur la branche `ccr-65d37fd4-svnpwh`. GitHub Actions construit l'APK de test et le bundle Google Play à chaque modification.

| Élément | Valeur |
|---|---|
| Production | `io.github.pinocchi00.bauform` |
| Debug | `io.github.pinocchi00.bauform.debug` (« Bauform test ») |
| SDK minimum | 24 (Android 7) |
| SDK cible / compilation | 36 |
| JDK de construction | 21 |
| Version lisible prévue | 1.0.0 |
| versionCode CI | numéro d'exécution, toujours supérieur au dernier code envoyé sur Play |
| Compilation | GitHub Actions (Java 21, SDK 36) ; en local, Android Studio |

## Installer l'APK de test sur un téléphone

Après chaque construction réussie, l'APK de test (« Bauform test ») est disponible :

- depuis le téléphone : https://github.com/Pinocchi00/Bauform-Block-Puzzle/releases/download/test/bauform-test.apk (pré-version « test » de l'onglet Releases) ;
- dans les artefacts de l'exécution (onglet Actions) et sur la branche `apk-test`.

L'AAB des artefacts porte la mention `signed` ou `UNSIGNED-do-not-upload` : seul le premier peut être envoyé sur Google Play.

## Construire après intégration

```bash
npm ci
npm test
npm run sim
npm run android:sync
cd android
./gradlew assembleDebug bundleRelease lintRelease -PversionCode=3 -PversionName=1.0.0
```

Sous Windows, utiliser `gradlew.bat`. `3` est seulement un exemple supérieur au code 2 de l'APK de référence ; utiliser un code supérieur à **tous** les envois Play réels au moment venu. Les futurs artefacts CI portent clairement la mention signed ou UNSIGNED.

## Clé d'upload — jamais dans le dépôt ou le chat

Une clé d'upload stable reste nécessaire. Ne pas réutiliser la clé de debug, ne pas remplacer une clé déjà utilisée sur Google Play. Si aucune clé n'existe, en créer une localement avec l'outil officiel Java, en saisissant les mots de passe dans les invites :

```bash
keytool -genkeypair -v -keystore bauform-upload.jks -alias bauform -keyalg RSA -keysize 2048 -validity 10000
```

Conserver le fichier et ses mots de passe dans un endroit sûr avec sauvegarde. Une clé d'upload (`bauform-upload.jks`, alias `bauform`, empreinte SHA-256 `AC:6B:D6:DC:…:DC:89`) a été créée le 16/10/2026 et remise au créateur avec ses valeurs de secrets ; elle n'est pas dans le dépôt.

Pour construire localement, créer `android/keystore.properties` (ignoré par git) avec `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Le chemin storeFile est relatif au dossier Android. Ne jamais committer ce fichier.

Pour GitHub Actions, saisir directement dans Settings > Secrets and variables > Actions :

| Secret | Contenu privé |
|---|---|
| ANDROID_KEYSTORE_BASE64 | Octets du keystore encodés en base64 |
| ANDROID_KEYSTORE_PASSWORD | Mot de passe du keystore |
| ANDROID_KEY_ALIAS | Alias de la clé |
| ANDROID_KEY_PASSWORD | Mot de passe de la clé |

Sous PowerShell, l'encodage peut aller directement dans le presse-papiers sans être affiché :
`[Convert]::ToBase64String([IO.File]::ReadAllBytes('bauform-upload.jks')) | Set-Clipboard`

Le workflow utilise les secrets via l'environnement, échappe les valeurs Java properties, vérifie la signature et supprime les fichiers temporaires. La construction n'a que le droit de lecture ; seul le job `publish-test-apk`, après une construction réussie (jamais sur une PR), écrit la pré-version « test » et la branche `apk-test`. Rien n'est envoyé sur Google Play.

Le lancement manuel `require_signed=true` vérifie aussi les champs de confidentialité. Ce contrôle ne publie rien, mais ne remplace ni les tests natifs ni le contrôle du fichier par Play.

## Recette native requise

Suivre [`release/ANDROID_TESTS.md`](../release/ANDROID_TESTS.md). Le vibreur, le partage Android, le bouton retour, l'installation et les barres système restent à valider sur le nouveau paquet. Ne pas confondre une synchronisation Capacitor réussie avec une compilation Android réussie.
