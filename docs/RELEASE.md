# Release procedure

## Prerequisites

- On branch `main` with a clean working tree
- GitHub secrets configured (see [BUILD_LOCAL.md](BUILD_LOCAL.md))

## Command

```bash
./scripts/release.sh patch    # 1.0.0 → 1.0.1
./scripts/release.sh minor    # 1.0.0 → 1.1.0
./scripts/release.sh major    # 1.0.0 → 2.0.0
./scripts/release.sh 1.2.3    # explicit version
```

## Full flow

| # | Actor | Action | Detail |
|---|---|---|---|
| 1 | **You** | `./scripts/release.sh patch` | Run the script manually in your terminal |
| 2 | **Script** | Verifies repo state | Aborts if not on `main` or if there are uncommitted changes |
| 3 | **Script** | Asks for confirmation | Displays `1.0.0 → 1.0.1 — Continue? [y/N]` |
| 4 | **Script** | Bumps `app.json` | Updates `version` and `android.versionCode` |
| 5 | **Script** | Commits | `chore: release v1.0.1` |
| 6 | **Script** | Creates git tag | `git tag v1.0.1` |
| 7 | **Script** | Pushes | Sends the commit + tag to the GitHub remote |
| 8 | **GitHub** | Detects `v*` tag | Automatically triggers the `release.yml` workflow |
| 9 | **GitHub Actions** | Installs dependencies | `npm ci`, Java 21, Android SDK |
| 10 | **GitHub Actions** | Generates Android project | `expo prebuild --platform android --clean` |
| 11 | **GitHub Actions** | Configures signing | Decodes keystore from secrets + `configure-android.py` |
| 12 | **GitHub Actions** | Builds the APK | `./gradlew assembleRelease` |
| 13 | **GitHub Actions** | Creates GitHub Release | Publishes `ghost-poster-1.0.1.apk` under tag `v1.0.1` |
| 14 | **You** | Downloads the APK | From the Releases page of the GitHub repo |
