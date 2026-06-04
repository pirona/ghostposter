# Build local Android — Ghost Poster

## Environnement installé (machine sysadmin, WSL2 Debian 13)

| Outil | Version | Chemin |
|---|---|---|
| JDK | OpenJDK 21.0.11 | `/usr/lib/jvm/java-21-openjdk-amd64` |
| Android SDK | — | `~/Android/Sdk` |
| platforms | android-34 | `~/Android/Sdk/platforms/android-34` |
| build-tools | 34.0.0 | `~/Android/Sdk/build-tools/34.0.0` |
| NDK | 26.1.10909125 | `~/Android/Sdk/ndk/26.1.10909125` |
| CMake | 3.22.1 | `~/Android/Sdk/cmake/3.22.1` |
| Node.js | 22.x | — |

Variables ajoutées dans `~/.bashrc` :
```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0
```

## Keystore de production

Fichier : `android/app/keystore/release.keystore` (gitignore — ne jamais commiter)  
Alias : `af2ec445f739391a5c284c6c153b8018`  
Source : keystore EAS téléchargée lors de la migration (2026-06-04) et stockée localement.
Sur GitHub Actions, elle est injectée via le secret `RELEASE_KEYSTORE_BASE64`.

> Garde une copie du fichier `.jks` et des mots de passe dans un gestionnaire de mots de passe.
> Perdre la keystore = impossible de mettre à jour l'app sur les devices existants.

## Procédure de build

```bash
# 1. Regénérer le dossier android/ depuis l'app.json
npx expo prebuild --platform android --clean

# 2. Configurer la signature et le nommage APK
python3 scripts/configure-android.py

# 3. Builder
cd android && ./gradlew assembleRelease
```

APK produit : `android/app/build/outputs/apk/release/ghost-poster-<version>.apk`

Pour installer sur un device connecté en USB :
```bash
adb install android/app/build/outputs/apk/release/ghost-poster-*.apk
```

## Procédure de release

```bash
# Bump patch (1.0.0 → 1.0.1), minor ou major
./scripts/release.sh patch

# Ou version explicite
./scripts/release.sh 1.1.0
```

Le script :
1. Vérifie que tu es sur `main` et que le working tree est propre
2. Met à jour `version` et `android.versionCode` dans `app.json`
3. Commite, crée le tag `vX.Y.Z`, pousse sur `main` + le tag
4. Le push du tag déclenche GitHub Actions → build APK → GitHub Release

## Reconstruire l'environnement depuis zéro

Si tu changes de machine, voici ce qu'il faut réinstaller :

```bash
# 1. JDK 21
sudo apt-get install -y openjdk-21-jdk

# 2. Android cmdline-tools
mkdir -p ~/Android/Sdk/cmdline-tools
cd ~/Android/Sdk/cmdline-tools
curl -O https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
python3 -c "import zipfile; zipfile.ZipFile('commandlinetools-linux-11076708_latest.zip').extractall('.')"
mv cmdline-tools latest
chmod +x latest/bin/*
rm commandlinetools-linux-11076708_latest.zip

# 3. Variables d'environnement (~/.bashrc)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0

# 4. SDK components + licences
yes | sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125" "cmake;3.22.1" "platform-tools"

# 5. Keystore
# Récupérer le fichier release.keystore auprès du mainteneur
# (ou via : echo "$RELEASE_KEYSTORE_BASE64" | base64 -d > release.keystore)
# Placer dans : android/app/keystore/release.keystore  (après expo prebuild)
```
