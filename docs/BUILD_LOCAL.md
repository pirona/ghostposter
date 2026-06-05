# Local Android build — Ghost Poster

## Installed environment (sysadmin machine, WSL2 Debian 13)

| Tool | Version | Path |
|---|---|---|
| JDK | OpenJDK 21.0.11 | `/usr/lib/jvm/java-21-openjdk-amd64` |
| Android SDK | — | `~/Android/Sdk` |
| platforms | android-34 | `~/Android/Sdk/platforms/android-34` |
| build-tools | 34.0.0 | `~/Android/Sdk/build-tools/34.0.0` |
| NDK | 26.1.10909125 | `~/Android/Sdk/ndk/26.1.10909125` |
| CMake | 3.22.1 | `~/Android/Sdk/cmake/3.22.1` |
| Node.js | 22.x | — |

Variables added to `~/.bashrc`:
```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0
```

## Production keystore

File: `android/app/keystore/release.keystore` (gitignored — never commit)  
Alias: `af2ec445f739391a5c284c6c153b8018`  
Source: EAS keystore downloaded during the migration (2026-06-04) and stored locally.
On GitHub Actions, it is injected via the `RELEASE_KEYSTORE_BASE64` secret.

> Keep a copy of the `.jks` file and passwords in a password manager.
> Losing the keystore = unable to update the app on existing devices.

## Build procedure

```bash
# 1. Regenerate the android/ folder from app.json
npx expo prebuild --platform android --clean

# 2. Configure signing and APK naming
python3 scripts/configure-android.py

# 3. Build
cd android && ./gradlew assembleRelease
```

Output APK: `android/app/build/outputs/apk/release/ghost-poster-<version>.apk`

To install on a USB-connected device:
```bash
adb install android/app/build/outputs/apk/release/ghost-poster-*.apk
```

## Release procedure

```bash
# Bump patch (1.0.0 → 1.0.1), minor, or major
./scripts/release.sh patch

# Or explicit version
./scripts/release.sh 1.1.0
```

The script:
1. Verifies you are on `main` with a clean working tree
2. Updates `version` and `android.versionCode` in `app.json`
3. Commits, creates the `vX.Y.Z` tag, pushes `main` + the tag
4. The tag push triggers GitHub Actions → build APK → GitHub Release

## Rebuilding the environment from scratch

If you change machines, here is what needs to be reinstalled:

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

# 3. Environment variables (~/.bashrc)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0

# 4. SDK components + licenses
yes | sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125" "cmake;3.22.1" "platform-tools"

# 5. Keystore
# Retrieve the release.keystore file from the maintainer
# (or via: echo "$RELEASE_KEYSTORE_BASE64" | base64 -d > release.keystore)
# Place it at: android/app/keystore/release.keystore  (after expo prebuild)
```
