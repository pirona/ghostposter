# ghost-poster — Installation and configuration

## Prerequisites

Before starting, make sure you have the following tools installed:

- **Node.js** 20 LTS or higher (`node --version`)
- **npm** 10 or higher (bundled with Node.js)
- **Android Studio** with an Android API 34+ emulator configured, or a physical Android device with developer options and USB debugging enabled

For release builds (signed APK), see [`BUILD_LOCAL.md`](BUILD_LOCAL.md). For installation without development, download the APK directly from the [GitHub Releases page](https://github.com/pirona/ghost-poster/releases).

## Installation

Clone the repository and install dependencies:

```bash
git clone ssh://gitea@homegit.gyozamancave.fr:2222/billisdead/ghost-poster.git
cd ghost-poster
npm install
```

No additional environment configuration is required — there is no `.env` file. Secrets are managed at runtime through the app's interface.

## Ghost instance configuration

The app uses Ghost's **Admin API**. To generate an access key:

1. Log in to your Ghost Admin panel (`https://your-ghost.example.com/ghost/#/settings`)
2. Navigate to **Settings → Integrations**
3. Click **+ Add custom integration**
4. Give it a name (e.g. `ghost-poster`)
5. After creation, copy the value of the **Admin API key** field

The key is in `id:secret` format where both `id` and `secret` are hex strings. Example (fictional):

```
6ba7b810:9dad11d1b0004b00b0000c3f7edcfbadba0efbad
```

Keep this key safe — it cannot be retrieved once the window is closed (you will need to generate a new one).

## First launch

### On Android emulator

```bash
npx expo run:android
```

This compiles the native app and deploys it to the emulator. The first build takes several minutes (Gradle).

### On a physical device (USB)

Enable USB debugging on the device, connect it, then:

```bash
npx expo run:android --device
```

### Release APK build

To generate a signed APK ready for distribution, see [`BUILD_LOCAL.md`](BUILD_LOCAL.md) (local build) and [`RELEASE.md`](RELEASE.md) (automated release via GitHub Actions).

## Initial configuration

On first launch, the app automatically redirects to the **Ghost Instances** screen (Settings). Tap the **+** button and fill in:

- **Name**: a readable name to identify your instance (e.g. "My Blog")
- **Base URL**: the root URL of your Ghost instance without a trailing slash (e.g. `https://ghost.example.com`)
- **Admin API key**: the key copied from Ghost Admin (format `id:secret`)

The app tests the connection before saving. If it fails, verify that the Ghost instance is reachable from the device's network and that the key is correct.

## Variables and secrets

No environment variables are used. All secrets are stored in **expo-secure-store** (Android Keystore) under two keys:

| SecureStore key | Contents |
|---|---|
| `GHOST_INSTANCES` | Serialized JSON of the instance list (name, URL, API key) |
| `GHOST_ACTIVE_ID` | UUID of the currently active instance |

To fully reset the configuration (uninstall or debug):

```bash
# On emulator — clears all app data
adb shell pm clear fr.gyozamancave.ghostposter
```

On a physical device, uninstall and reinstall the app via Android settings.
