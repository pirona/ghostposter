<p align="center">
  <img src="assets/icon.png" width="100" alt="Ghostposter" />
</p>

<h1 align="center">Ghostposter</h1>

<p align="center">An Android app to publish to your self-hosted Ghost instance from your phone.</p>

---

Write posts in Markdown, preview them, upload images, manage drafts and published articles — without ever opening the Ghost admin panel. Supports multiple Ghost instances from a single app.

**What it doesn't do:** manage members, newsletters, theme, or instance settings. This is a mobile publishing tool, not an embedded admin interface.

---

## Getting the app

Download the latest APK from the [Releases page](https://github.com/pirona/ghost-poster/releases) and install it on your Android device.

---

## Ghost configuration

Open the app, go to Settings, and add an instance:

1. Enter a display name, your Ghost instance URL, and an Admin API key
2. The key is in Ghost Admin → Settings → Integrations → Add custom integration
3. The app tests the connection before saving

API keys are stored in the Android Keystore — never in plaintext, never in logs.

---

## Stack

React Native · React Native Paper · Zustand · Axios · `@noble/hashes` · `expo-secure-store` · marked · TypeScript strict

---

## Development setup

```bash
git clone https://github.com/pirona/ghost-poster.git
cd ghost-poster
npm install
npx expo run:android   # requires Android Studio or a connected device
```

To build a signed release APK or publish a new version, see the [Build Local](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Build-Local) · [↗ GitHub](https://github.com/pirona/ghost-poster/wiki/Build-Local) and [Release](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Release) · [↗ GitHub](https://github.com/pirona/ghost-poster/wiki/Release) wiki pages.

---

## On the code

This app was built with **Claude Code**. I'm a Linux systems engineer — Kubernetes, Ansible, infrastructure — not a mobile developer. I had never written a line of React Native before this project.

The model generated the code from detailed prompts I wrote. What stayed on my side: architecture decisions, technical specifications, validation of every generated file, and debugging what the model couldn't resolve on its own.

**I think being honest about this matters.** The conversation about AI and code swings between two false extremes: "AI replaces developers" and "vibe coding has no value." Neither matches what I experienced.

What happened is closer to working with a skilled contractor: the value lies in defining the problem precisely, evaluating proposals critically, and making the structural decisions. Without that layer, LLM-generated code is generic or wrong.

The tool amplifies. It doesn't invent what you don't already know how to think.

---

## Documentation

Full documentation: [Gitea wiki](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki) · [GitHub wiki](https://github.com/pirona/ghost-poster/wiki)

| Page | Gitea | GitHub |
|------|-------|--------|
| Architecture | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Architecture) | [↗](https://github.com/pirona/ghost-poster/wiki/Architecture) |
| Setup | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Setup) | [↗](https://github.com/pirona/ghost-poster/wiki/Setup) |
| Build Local | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Build-Local) | [↗](https://github.com/pirona/ghost-poster/wiki/Build-Local) |
| Release | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Release) | [↗](https://github.com/pirona/ghost-poster/wiki/Release) |
| Ghost API | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Ghost-API) | [↗](https://github.com/pirona/ghost-poster/wiki/Ghost-API) |
| Contributing | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Contributing) | [↗](https://github.com/pirona/ghost-poster/wiki/Contributing) |
| Security | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Security) | [↗](https://github.com/pirona/ghost-poster/wiki/Security) |
| Reverse Proxy | [↗](https://homegit.gyozamancave.fr/billisdead/ghost-poster/wiki/Reverse-Proxy) | [↗](https://github.com/pirona/ghost-poster/wiki/Reverse-Proxy) |

---

## About

**billisdead** — visual artist and graphic designer, image generation with Flux.1/ComfyUI → [billisdead.com](https://billisdead.com)

→ **[Ko-fi](https://ko-fi.com/billisdead)**

Not commercial software. A tool built for personal use, published in case it's useful to others.

---

## License

GPL-3.0 — see [LICENSE](LICENSE)
