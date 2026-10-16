# Bauform — version Android

Le jeu web (`dist/`) est emballé dans une appli Android avec [Capacitor](https://capacitorjs.com) 8.
Le projet Android est dans `android/`.

| | |
|---|---|
| Identifiant de l'appli | `io.github.pinocchi00.bauform` (définitif après la 1re publication) |
| Version de test | `io.github.pinocchi00.bauform.debug`, nommée « Bauform test » : s'installe à côté de la vraie |
| Android minimum | 7.0 (API 24) |
| Android ciblé | API 36 (exigé par Google Play depuis le 31 août 2026) |
| Orientation | portrait |

## 1. Installer la version de test sur ton téléphone

GitHub construit l'appli à chaque modification du jeu.

1. Sur github.com, ouvrir le dépôt, onglet **Actions**, puis la dernière exécution **Android** (coche verte).
2. En bas de la page, dans **Artifacts**, télécharger **bauform-test-apk** (un .zip qui contient l'APK).
3. Envoyer l'APK sur le téléphone (ou le télécharger depuis le téléphone), l'ouvrir, et accepter
   « installer des applis de sources inconnues » quand Android le demande.

Pour relancer une construction sans rien modifier : onglet **Actions** > **Android** > **Run workflow**.

## 2. Créer la clé de signature (une seule fois)

Google Play n'accepte que des fichiers signés. La clé reste chez toi : elle n'est jamais dans le dépôt.

Sur un ordinateur avec Java installé :

```bash
keytool -genkeypair -v -keystore bauform-upload.jks -alias bauform -keyalg RSA -keysize 2048 -validity 10000
```

Garde `bauform-upload.jks` et ses mots de passe en lieu sûr (gestionnaire de mots de passe + une copie de sauvegarde).
Avec la signature d'applications par Google Play (activée par défaut), une clé perdue peut être remplacée
en contactant le support, mais c'est long.

## 3. Donner la clé à GitHub

Dépôt > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**, quatre secrets :

| Nom | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le fichier .jks encodé en base64 (voir ci-dessous) |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du fichier |
| `ANDROID_KEY_ALIAS` | `bauform` |
| `ANDROID_KEY_PASSWORD` | le mot de passe de la clé (souvent le même) |

Encoder le fichier : sous Windows (PowerShell)
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("bauform-upload.jks")) | Set-Clipboard`,
sous macOS `base64 -i bauform-upload.jks | pbcopy`, sous Linux `base64 -w0 bauform-upload.jks`.

Ensuite, chaque construction produit **bauform-play-aab** signé : c'est le fichier à envoyer sur Google Play.
Sans ces secrets, le .aab est produit mais non signé (Google Play le refusera).

## 4. Numéro de version

Chaque envoi sur Google Play doit avoir un `versionCode` plus grand que le précédent.
Sur GitHub, c'est automatique : le numéro de l'exécution (`1.0.<n>`).
En local : `./gradlew bundleRelease -PversionCode=12 -PversionName=1.0.12`.

## Construire sur son ordinateur (facultatif)

Il faut Android Studio (il installe le SDK Android et Java).

```bash
npm ci
npm run android:sync     # construit le jeu et le copie dans android/
npm run android:open     # ouvre le projet dans Android Studio (bouton ▶ pour lancer sur un téléphone branché)
```

Pour signer en local, créer `android/keystore.properties` (ignoré par git) :

```properties
storeFile=../chemin/vers/bauform-upload.jks
storePassword=...
keyAlias=bauform
keyPassword=...
```

## Ce qui est propre à l'appli

- Bouton retour d'Android : en jeu, il ouvre la pause ; sur la pause ou l'écran de fin, il met l'appli en arrière-plan ; en plein écran, il revient à l'écran de fin.
- Passer en arrière-plan met en pause et enregistre la partie.
- Les vibrations passent par le vibreur du téléphone (réglables dans la pause).
- Partager l'affiche ouvre le menu de partage d'Android.
- Le jeu s'affiche sous les barres système et garde ses marges (encoche, barre de navigation).
- Aucune connexion Internet n'est utilisée (police incluse, pas de pub, pas de statistiques envoyées).
  La permission INTERNET reste déclarée par Capacitor, mais rien ne s'en sert.

## Après une modification du jeu

`npm run android:sync`, puis reconstruire (ou pousser sur GitHub : l'APK est reconstruit tout seul).
Les icônes Android sont dans `android/app/src/main/res/mipmap-*`, tirées de `public/favicon.svg`.
