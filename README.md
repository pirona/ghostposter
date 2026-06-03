# ghost-poster

**An Android app to publish to your self-hosted Ghost instance from your phone.**

Full post lifecycle — Markdown editing, live preview, image upload, draft and published post management, multi-instance support — without ever opening the Ghost admin panel.

---

## What it does

- Write posts in Markdown with real-time rendered preview
- Publish, unpublish, save as draft
- Upload images from your gallery
- Manage multiple Ghost instances from one place
- Store API keys securely (Android Keystore via expo-secure-store, never in plaintext)

What it doesn't do: access the Ghost admin panel, manage members, newsletters, or instance settings. This is a mobile publishing tool, not an embedded admin interface.

---

## Stack

Expo SDK 52 · React Native Paper · Zustand · Axios · jose · expo-secure-store · turndown · marked · expo-web-view · expo-image-picker · TypeScript strict

---

## Installation

```bash
git clone https://github.com/billisdead/ghost-poster.git
cd ghost-poster
npm install
npx expo run:android
```

Requirements: Node.js 20+, Android Studio or a physical device in developer mode.

To build a test APK:

```bash
eas build --platform android --profile preview
```

## Ghost configuration

Open the app, go to Settings, and add an instance:

1. Enter a display name, your Ghost instance URL, and an Admin API key
2. The key is found in Ghost Admin → Settings → Integrations → Add custom integration
3. The app tests the connection before saving

The key is stored in the Android Keystore via `expo-secure-store`. It never appears in any log, environment variable, or plaintext file.

---

## On the code and how it was built

This app was built with **Claude Code**, Anthropic's agentic coding interface, with architecture and design decisions worked out upfront in **Claude claude.ai**.

I'm a Linux systems engineer by trade — Kubernetes, Ansible, infrastructure, security. Not a mobile developer. I had never written a line of React Native before this project.

What Claude Code did: generate the entire codebase from detailed prompts I wrote, iterate on bugs, and propose fixes.

What I did:

- Design the architecture (layer separation, multi-instance model, HTML↔Markdown content strategy, security by design)
- Write the precise technical specifications that guided generation (choosing `jose` over `jsonwebtoken` for Hermes compatibility, Ghost optimistic lock strategy, SecureStore isolation)
- Make all functional design decisions
- Read, understand, and validate every generated file
- Debug issues the model couldn't resolve on its own

The model executed. The engineering — knowing what to build, why, under what constraints, and how to verify it's correct — stayed on my side.

**I think being honest about this matters.** The mainstream conversation about AI and code swings between two equally false extremes: "AI will replace developers" and "vibe coding has no value, anyone can do it." Neither matches what I actually experienced here.

What happened is closer to what happens when an experienced engineer works with a highly skilled contractor: the value lies in the ability to define the problem precisely, evaluate proposals critically, identify what's wrong, and make the structural decisions. Without that layer, LLM-generated code is either generic, or incorrect, or both.

The tool amplifies. It doesn't invent what you don't already know how to think.

The prompts used to generate this project are available in [`docs/PROMPTS.md`](docs/PROMPTS.md).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, data flow, application layers
- [`docs/SETUP.md`](docs/SETUP.md) — full installation and Ghost configuration guide
- [`docs/GHOST_API.md`](docs/GHOST_API.md) — Ghost API reference, error handling
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — guide to extending or modifying the app
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — the Claude Code prompts used to generate the project
- [`docs/SECURITY.md`](docs/SECURITY.md) — security architecture: credential storage, JWT, network constraints

---

## About

This project is signed **billisdead** — visual artist and graphic designer, image generation with Flux.1/ComfyUI → [billisdead.com](https://billisdead.com)

If the app is useful to you and you'd like to support the work:

→ **[Ko-fi](https://ko-fi.com/billisdead)**

This is not commercial software. It's a tool I built for my own use, published because it might be useful to others, with full transparency about how it was made.

---

## License

GPL-3.0 — see [LICENSE](LICENSE)
