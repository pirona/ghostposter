# ghost-poster — Architecture

## Overview

ghost-poster is an Android app for creating, editing, and publishing posts to a self-hosted Ghost instance via the Admin API. It covers the full post lifecycle: writing in Markdown, saving as draft, publishing, unpublishing, and deleting. It does not replace the Ghost admin panel — it focuses exclusively on editorial content management.

The app supports multiple named Ghost instances, with one active at a time. Switching the active instance resets the post list. Credentials never leave the device's encrypted storage.

Out of scope: Ghost member management, theme configuration, static page management, push notifications, rich editing toolbar (bold/italic), image insertion at cursor position.

## Tech stack

| Technology | Role | Reason |
|---|---|---|
| Expo SDK 52 (managed workflow) | Runtime and toolchain | Simplifies native dependency management; prebuild generates the Android project without Android Studio |
| Expo Router v4 | File-based navigation | Consistent with Expo SDK 52 conventions; declarative routing |
| React Native Paper | Material Design 3 UI components | Rich, accessible, themeable components |
| Zustand v5 | State management | Minimal API, no Redux boilerplate, `getState()` accessible outside React |
| Axios | HTTP client | Request interceptors for JWT injection, centralized error handling |
| expo-secure-store | Secret storage | Android Keystore encryption — never AsyncStorage for credentials |
| jose v5 | JWT signing | Hermes-compatible (no Node.js crypto dependency), native ES Modules |
| turndown | HTML → Markdown | Faithful conversion for loading Ghost posts into the editor |
| marked | Markdown → HTML | Converts edited content back to the Ghost API format |
| react-native-webview | Sandboxed HTML preview | Isolated rendering, JS disabled, no external links reachable |
| expo-image-picker | Gallery image selection | Permission declared in app.json, unified Android/iOS API |
| expo-crypto | UUID generation | Native randomUUID() compatible with Hermes |
| TypeScript strict | Static typing | Compile-time error detection, no `any` |

## Project structure

```
ghost-poster/
├── app/                          # Screens and layouts (Expo Router)
│   ├── _layout.tsx               # Root layout: providers + initial load
│   ├── index.tsx                 # Conditional redirect (Settings / Posts)
│   ├── settings.tsx              # Ghost instance manager
│   └── (drawer)/
│       ├── _layout.tsx           # Drawer navigator with instance switcher
│       ├── compose.tsx           # Full Markdown editor
│       └── posts.tsx             # Paginated post list
├── src/
│   ├── api/
│   │   ├── ghostTypes.ts         # Ghost Admin API types and error classes
│   │   ├── ghostJwt.ts           # JWT HS256 generation with @noble/hashes
│   │   └── ghostClient.ts        # Axios client + API functions
│   ├── components/
│   │   ├── StatusBadge.tsx       # Status badge (draft/published/scheduled)
│   │   ├── PostListItem.tsx      # Post card with swipe-to-delete
│   │   ├── TagChipList.tsx       # Tag management (chips + input)
│   │   ├── MarkdownPreview.tsx   # HTML preview in sandboxed WebView
│   │   ├── ImagePickerButton.tsx # Gallery image upload button
│   │   ├── FeatureImagePicker.tsx# Feature image selection and preview
│   │   └── InstanceListItem.tsx  # Instance card with swipe-to-delete
│   ├── hooks/
│   │   ├── useInstances.ts       # Form validation + connection test
│   │   ├── useImageUpload.ts     # Permission + selection + conversion + upload
│   │   ├── useFeatureImageUpload.ts # Feature image upload (JPEG resize)
│   │   └── usePostEditor.ts      # Editor logic: dirty state, validation, save
│   ├── store/
│   │   ├── instanceStore.ts      # Zustand: Ghost instances, active instance
│   │   └── postStore.ts          # Zustand: posts, current edit
│   ├── theme.ts                  # Light/dark React Native Paper themes
│   └── utils/
│       ├── secureStorage.ts      # Typed expo-secure-store wrapper
│       └── contentConverter.ts   # Bidirectional HTML ↔ Markdown conversion
├── assets/                       # App icons (icon.png, adaptive-icon.png)
├── docs/                         # Documentation
├── scripts/
│   ├── configure-android.py      # Patch build.gradle after expo prebuild
│   └── release.sh                # Bump version + tag + push → triggers CI
├── .github/workflows/
│   └── release.yml               # Build APK + GitHub Release on v* tag
├── app.json                      # Expo configuration
├── tsconfig.json                 # TypeScript strict
└── package.json
```

## Data flow

The flow enforces strict layer separation — a screen never touches the HTTP client directly.

```
┌─────────────────────────────────────────────┐
│                   Screens                   │
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
                    │ store + API calls
                    ▼
┌─────────────────────────────────────────────┐
│             Zustand stores (src/store/)      │
│   postStore          instanceStore          │
└───────────────────┬─────────────────────────┘
                    │ ghostClient calls
                    ▼
┌─────────────────────────────────────────────┐
│           API client (src/api/)             │
│   ghostClient.ts → ghostJwt.ts             │
└───────────────────┬─────────────────────────┘
                    │ HTTPS only
                    ▼
┌─────────────────────────────────────────────┐
│           Ghost Admin API instance          │
│   https://ghost.example.com/ghost/api/admin/│
└─────────────────────────────────────────────┘
```

## Application layers

### Screens (`app/`)

Screens orchestrate rendering and delegate all logic to hooks and stores. They contain no API calls or business logic. Their responsibility is limited to: rendering components, consuming stores via selectors, and calling actions via hooks.

### Hooks (`src/hooks/`)

Hooks encapsulate UI logic that stores should not know about: form validation, Alert confirmations, connection testing before saving, permission requests. They serve as the adaptation layer between screens and stores.

### Zustand stores (`src/store/`)

Stores manage global application state and call the API client directly. `postStore` holds the post list and editor state. `instanceStore` manages Ghost instances and persists to SecureStore. When the active instance changes, `instanceStore` resets `postStore` via a dynamic import to avoid a module-level circular dependency.

### API client (`src/api/`)

`ghostClient.ts` contains only HTTP logic: request construction, JWT injection via the Axios interceptor, normalization of HTTP errors into typed classes. It contains no business logic. `ghostJwt.ts` signs the JWT on every request — the token is never cached.

### Utilities (`src/utils/`)

Stateless pure functions. `secureStorage.ts` is the single entry point for SecureStore operations. `contentConverter.ts` handles HTML↔Markdown conversion.

## Security

**Secret storage.** Ghost instances (including API keys) are serialized as JSON and stored in `expo-secure-store` under the key `GHOST_INSTANCES`. Storage uses Android Keystore via EncryptedSharedPreferences. No API key ever appears in a log or in unprotected Zustand state.

**JWT generation.** The Ghost JWT is generated on every API request with a maximum lifetime of 5 minutes. It is never cached between calls. Generation uses `jose` v5 (HS256), compatible with Hermes without a Node.js crypto dependency. The hex secret is manually decoded to `Uint8Array` to avoid any dependency on `Buffer`.

**Network.** All network calls are over HTTPS. The instance base URL is validated (must start with `https://`) before saving. No HTTP fallback.

**Sandboxed WebView.** The Markdown preview renders in a WebView with `javaScriptEnabled={false}` and `originWhitelist={[]}` — no scripts execute, no external navigation is possible.

**Optimistic lock.** The `updated_at` field of the original post is always sent back in PUT requests. Ghost rejects any update where this field does not match the server version, protecting against concurrent modifications.

## Content editing strategy

Ghost stores content in two formats depending on the version and editor type: HTML (`html`) and Lexical (`lexical`). The app works exclusively with HTML.

**Loading (Ghost → editor):** The HTML returned by the API is converted to Markdown via `turndown` (options: ATX headings, fenced code blocks). The conversion is faithful for standard content (headings, lists, bold, italic, links, images, code). Non-standard HTML elements (iframes, widgets) are dropped by turndown.

**Saving (editor → Ghost):** Markdown is converted to HTML via `marked` (GFM enabled, line breaks preserved) before being sent to the API. Ghost accepts HTML even for posts originally in Lexical, and re-stores it in both formats.

**Known limitations:** Posts containing advanced Lexical content (Ghost cards, galleries) have their formatting simplified after a round-trip through the app. This behavior is documented and expected — the app targets standard editorial content, not advanced layouts.
