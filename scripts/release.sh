#!/usr/bin/env bash
# Usage:
#   ./scripts/release.sh patch       # 1.0.0 → 1.0.1
#   ./scripts/release.sh minor       # 1.0.0 → 1.1.0
#   ./scripts/release.sh major       # 1.0.0 → 2.0.0
#   ./scripts/release.sh 1.2.3       # version explicite
set -euo pipefail

APP_JSON="app.json"
BUMP="${1:-patch}"

# Vérifier qu'on est sur main et propre
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "⚠️  Tu n'es pas sur main (branche courante : $BRANCH)" && exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Des modifications non commitées existent." && exit 1
fi

# Version courante
CURRENT=$(node -p "require('./$APP_JSON').expo.version")
CURRENT_CODE=$(node -p "require('./$APP_JSON').expo.android?.versionCode ?? 1")

# Calculer la nouvelle version
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$BUMP" in
    major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR+1)); PATCH=0 ;;
    patch) PATCH=$((PATCH+1)) ;;
    *) echo "Usage: $0 patch|minor|major|x.y.z" && exit 1 ;;
  esac
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

NEW_CODE=$((CURRENT_CODE+1))

echo "Version : $CURRENT → $NEW_VERSION  (versionCode $CURRENT_CODE → $NEW_CODE)"
read -r -p "Continuer ? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 0

# Mettre à jour app.json
node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('$APP_JSON', 'utf8'));
  app.expo.version = '$NEW_VERSION';
  app.expo.android = app.expo.android || {};
  app.expo.android.versionCode = $NEW_CODE;
  fs.writeFileSync('$APP_JSON', JSON.stringify(app, null, 2) + '\n');
  console.log('app.json mis à jour');
"

# Commit + tag + push
git add "$APP_JSON"
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

# Pousse aussi le tag directement sur GitHub pour déclencher GitHub Actions
# (le miroir Gitea ne transmet pas forcément les tags)
if git remote | grep -q "^github$"; then
  git push github main
  git push github "v$NEW_VERSION"
  echo ""
  echo "✓ Tag v$NEW_VERSION poussé sur Gitea + GitHub — GitHub Actions va builder."
else
  echo ""
  echo "✓ Tag v$NEW_VERSION poussé — ajoute 'github' comme remote si GitHub Actions ne se déclenche pas."
fi
