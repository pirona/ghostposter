# ghost-poster — Architecture

## Vue d'ensemble

ghost-poster est une application Android permettant de créer, éditer et publier des articles sur une instance Ghost auto-hébergée via l'Admin API. Elle couvre l'intégralité du cycle de vie d'un post : rédaction en Markdown, sauvegarde en brouillon, publication, dépublication et suppression. Elle ne remplace pas le panel d'administration Ghost — elle se concentre exclusivement sur la gestion du contenu éditorial.

L'application supporte plusieurs instances Ghost nommées, avec une instance active à la fois. La sélection de l'instance active réinitialise la liste des posts. Les credentials ne quittent jamais le stockage chiffré de l'appareil.

Ce que l'application ne fait pas (hors scope) : gestion des membres Ghost, configuration du thème, gestion des pages statiques, notifications push, édition enrichie (toolbar gras/italique), insertion d'image à la position du curseur.

## Stack technique

| Technologie | Rôle | Raison du choix |
|---|---|---|
| Expo SDK 52 (managed workflow) | Runtime et toolchain | Simplifie la gestion des dépendances natives, prebuild génère le projet Android sans Android Studio |
| Expo Router v4 | Navigation par fichiers | Cohérent avec la convention Expo SDK 52, routing déclaratif |
| React Native Paper | Composants UI Material Design 3 | Composants riches, accessible, thémable |
| Zustand v5 | State management | API minimaliste, pas de boilerplate Redux, `getState()` accessible hors React |
| Axios | Client HTTP | Intercepteurs de requêtes pour l'injection JWT, gestion centralisée des erreurs |
| expo-secure-store | Stockage des secrets | Chiffrement Android Keystore — jamais AsyncStorage pour les credentials |
| jose v5 | Signature JWT | Compatible Hermes (pas de dépendance Node.js crypto), ES Modules natifs |
| turndown | HTML → Markdown | Conversion fidèle pour charger les posts Ghost dans l'éditeur |
| marked | Markdown → HTML | Retourner le contenu édité vers l'API Ghost |
| react-native-webview | Aperçu HTML sandboxé | Rendu isolé, JS désactivé, aucun lien externe accessible |
| expo-image-picker | Sélection d'image galerie | Permission déclarée dans app.json, API cohérente Expo |
| expo-crypto | Génération UUID | randomUUID() natif compatible Hermes |
| TypeScript strict | Typage statique | Détection des erreurs à la compilation, pas d'`any` |

## Structure du projet

```
ghost-poster/
├── app/                          # Écrans et layouts (Expo Router)
│   ├── _layout.tsx               # Root layout : providers + chargement initial
│   ├── index.tsx                 # Redirect conditionnel (Settings / Posts)
│   ├── settings.tsx              # Gestionnaire d'instances Ghost
│   └── (drawer)/
│       ├── _layout.tsx           # Drawer navigator avec switcher d'instances
│       ├── compose.tsx           # Éditeur Markdown complet
│       └── posts.tsx             # Liste paginée des posts
├── src/
│   ├── api/
│   │   ├── ghostTypes.ts         # Types et classes d'erreurs Ghost Admin API
│   │   ├── ghostJwt.ts           # Génération JWT HS256 avec @noble/hashes
│   │   └── ghostClient.ts        # Client Axios + fonctions API
│   ├── components/
│   │   ├── StatusBadge.tsx       # Badge statut (draft/published/scheduled)
│   │   ├── PostListItem.tsx      # Carte post avec swipe-to-delete
│   │   ├── TagChipList.tsx       # Gestion des tags (chips + saisie)
│   │   ├── MarkdownPreview.tsx   # Aperçu HTML dans WebView sandboxée
│   │   ├── ImagePickerButton.tsx # Bouton upload image galerie
│   │   ├── FeatureImagePicker.tsx# Sélection et aperçu de l'image à la une
│   │   └── InstanceListItem.tsx  # Carte instance avec swipe-to-delete
│   ├── hooks/
│   │   ├── useInstances.ts       # Validation formulaire + test connexion
│   │   ├── useImageUpload.ts     # Permission + sélection + conversion + upload
│   │   ├── useFeatureImageUpload.ts # Upload image à la une (resize JPEG)
│   │   └── usePostEditor.ts      # Logique éditeur : dirty, validation, save
│   ├── store/
│   │   ├── instanceStore.ts      # Zustand : instances Ghost, instance active
│   │   └── postStore.ts          # Zustand : posts, édition en cours
│   ├── theme.ts                  # Thèmes light/dark React Native Paper
│   └── utils/
│       ├── secureStorage.ts      # Wrapper typé expo-secure-store
│       └── contentConverter.ts   # Conversion bidirectionnelle HTML ↔ Markdown
├── assets/                       # Icônes app (icon.png, adaptive-icon.png)
├── docs/                         # Documentation
├── scripts/
│   ├── configure-android.py      # Patch build.gradle après expo prebuild
│   └── release.sh                # Bump version + tag + push → déclenche CI
├── .github/workflows/
│   └── release.yml               # Build APK + GitHub Release sur tag v*
├── app.json                      # Configuration Expo
├── tsconfig.json                 # TypeScript strict
└── package.json
```

## Flux de données

Le flux respecte une séparation stricte des couches — un écran ne touche jamais le client HTTP directement.

```
┌─────────────────────────────────────────────┐
│                   Écrans                    │
│   app/(tabs)/compose.tsx                    │
│   app/(tabs)/posts.tsx                      │
│   app/settings.tsx                          │
└───────────────────┬─────────────────────────┘
                    │ dispatch actions
                    ▼
┌─────────────────────────────────────────────┐
│               Hooks (src/hooks/)            │
│   usePostEditor  useInstances  useImageUpload│
└───────────────────┬─────────────────────────┘
                    │ appels store + API
                    ▼
┌─────────────────────────────────────────────┐
│             Stores Zustand (src/store/)      │
│   postStore          instanceStore          │
└───────────────────┬─────────────────────────┘
                    │ appels ghostClient
                    ▼
┌─────────────────────────────────────────────┐
│           Client API (src/api/)             │
│   ghostClient.ts → ghostJwt.ts             │
└───────────────────┬─────────────────────────┘
                    │ HTTPS uniquement
                    ▼
┌─────────────────────────────────────────────┐
│           Instance Ghost Admin API          │
│   https://ghost.example.fr/ghost/api/admin/ │
└─────────────────────────────────────────────┘
```

## Couches applicatives

### Écrans (`app/`)

Les écrans orchestrent l'affichage et délèguent toute la logique aux hooks et stores. Ils ne contiennent ni appels API ni logique métier. Leur responsabilité se limite à : rendre les composants, consommer les stores via des sélecteurs, appeler les actions via les hooks.

### Hooks (`src/hooks/`)

Les hooks encapsulent la logique UI que les stores ne doivent pas connaître : validation de formulaire, confirmations Alert, test de connexion avant enregistrement, demandes de permission. Ils servent de couche d'adaptation entre les écrans et les stores.

### Stores Zustand (`src/store/`)

Les stores gèrent l'état global de l'application et appellent directement le client API. `postStore` contient la liste des posts et l'état de l'éditeur. `instanceStore` gère les instances Ghost et persiste dans SecureStore. Lorsque l'instance active change, `instanceStore` réinitialise `postStore` via un import dynamique pour éviter la dépendance circulaire au niveau du module.

### Client API (`src/api/`)

`ghostClient.ts` contient uniquement la logique HTTP : construction des requêtes, injection du JWT via l'intercepteur Axios, normalisation des erreurs HTTP en classes typées. Il ne contient aucune logique métier. `ghostJwt.ts` signe le JWT à chaque requête — le token n'est jamais mis en cache.

### Utilitaires (`src/utils/`)

Fonctions pures sans état. `secureStorage.ts` est le seul point d'entrée pour les opérations sur SecureStore. `contentConverter.ts` gère la conversion HTML↔Markdown.

## Sécurité

**Stockage des secrets.** Les instances Ghost (incluant les clés API) sont sérialisées en JSON et stockées dans `expo-secure-store` sous la clé `GHOST_INSTANCES`. Le stockage utilise Android Keystore via EncryptedSharedPreferences. Aucune clé API ne transite dans un log ou dans l'état Zustand non protégé.

**Génération JWT.** Le JWT Ghost est généré à chaque requête API avec une durée de vie de 5 minutes maximum. Il n'est jamais mis en cache entre les appels. La génération utilise `jose` v5 (HS256), compatible Hermes sans dépendance Node.js crypto. Le secret hexadécimal est décodé manuellement en `Uint8Array` pour éviter toute dépendance sur `Buffer`.

**Réseau.** Tous les appels réseau sont en HTTPS. L'URL de base de l'instance est validée (doit commencer par `https://`) avant enregistrement. Aucun fallback HTTP.

**WebView sandboxée.** L'aperçu Markdown est rendu dans une WebView avec `javaScriptEnabled={false}` et `originWhitelist={[]}` — aucun script exécuté, aucune navigation externe possible.

**Optimistic lock.** Le champ `updated_at` du post original est systématiquement renvoyé dans les requêtes PUT. Ghost rejette toute mise à jour dont ce champ ne correspond pas à la version serveur, ce qui protège contre les modifications concurrentes.

## Stratégie d'édition de contenu

Ghost stocke le contenu dans deux formats selon la version et le type d'éditeur : HTML (`html`) et Lexical (`lexical`). L'application travaille exclusivement avec le HTML.

**Chargement (Ghost → éditeur) :** Le HTML retourné par l'API est converti en Markdown via `turndown` (options : headings ATX, code blocks fenced). La conversion est fidèle pour le contenu courant (titres, listes, gras, italique, liens, images, code). Les éléments HTML non standard (iframes, widgets) sont supprimés par turndown.

**Sauvegarde (éditeur → Ghost) :** Le Markdown est converti en HTML via `marked` (GFM activé, retours à la ligne conservés) avant envoi à l'API. Ghost accepte le HTML même pour les posts originellement en Lexical, et le re-stocke dans les deux formats.

**Limites connues :** Les posts contenant du contenu Lexical avancé (cards Ghost, galeries) voient leur mise en forme simplifiée après un aller-retour via l'application. Ce comportement est documenté et prévu — l'application cible le contenu éditorial standard, pas les mises en page avancées.
