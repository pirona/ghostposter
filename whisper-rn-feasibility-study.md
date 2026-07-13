# Étude de faisabilité — migration vers whisper.rn (on-device)

> Étude technique uniquement. Aucun fichier source modifié, aucune dépendance installée.
> Portée : `ghost-poster` (objectif principal) et `sheethappens` (comparaison, même dette technique).
> Date : 2026-07-13.

---

## 1. Pourquoi cette étude

`expo-speech-recognition` (moteur natif Android — `SpeechRecognizer` système, confirmé en usage réel via logcat : `SodaSpeechRecognizer`/`RecognitionServiceImpl`, hybride online/offline Samsung) reconnaît mal les termes techniques (HAProxy, n8n, Kubernetes...) même avec le biasing `contextualStrings` (`EXTRA_BIASING_STRINGS`, Android 13+) ajouté récemment. Le biasing influence les probabilités du moteur système, mais n'entraîne pas de vocabulaire dédié — il reste plafonné par ce que Google/Samsung expose.

`whisper.rn` (binding React Native de `whisper.cpp`, inference locale du modèle OpenAI Whisper) tourne 100% on-device, sans dépendance à un moteur système, avec un vocabulaire déterminé uniquement par le modèle choisi — potentiellement meilleur sur le jargon technique, indépendamment de ce que l'OEM installe.

---

## 2. État actuel — tableau récapitulatif

| | **ghost-poster** | **sheethappens** |
|---|---|---|
| Moteur STT | `expo-speech-recognition@^56.0.1` (Android `SpeechRecognizer` système) | `expo-speech-recognition@~56.0.1` (idem) |
| Point d'entrée unique | `src/hooks/useVoice.ts` → `app/(drawer)/compose.tsx` | `hooks/useVoice.ts` |
| Vocabulaire custom (`contextualStrings`) | ✅ Oui (Settings > Reconnaissance vocale, ajouté récemment) | ❌ Non — hook quasi identique à la version *pré-fix* de ghost-poster |
| Expo SDK / RN / React | 52 / 0.76.9 / 18.3.1 | 56 / 0.85.3 / 19.2.3 |
| Workflow natif | `android/` gitignoré, régénéré par `expo prebuild` en CI (pas de bare workflow committé) | Idem (`android/` gitignoré) |
| `eas.json` | Absent — build 100% GitHub Actions + gradlew | Non vérifié dans le détail, mais build géré par script custom (`build-apk.sh`) |
| CI build natif réel ? | ✅ Oui — `expo prebuild --platform android --clean` puis `./gradlew assembleRelease` (`.github/workflows/release.yml`) | ✅ Oui — `./build-apk.sh` (via gradlew), `.github/workflows/build-android.yml` |
| `ndkVersion` | `26.1.10909125` (root `build.gradle`) | Non extrait (à vérifier avant migration réelle) |
| New Architecture (`newArchEnabled`) | `false` (gradle.properties) | Non vérifié |
| Patch Android 15 (16KB page size) | Non présent | ✅ Présent en CI, pour `react-native-worklets`/`react-native-reanimated` |
| Dev client (`expo-dev-client`) | Absent des deps — jamais passé par Expo Go de toute façon (module natif tiers déjà présent) | Idem |

**Correction d'une hypothèse du brief initial** : la CI des deux projets fait un **build natif complet** (prebuild + gradlew), pas juste `tsc`+lint. Une régression native introduite par whisper.rn serait donc détectée en CI, contrairement au risque générique "CI verte alors qu'un build natif casse" évoqué dans le prompt de départ.

---

## 3. whisper.rn — ce qu'il faut savoir avant d'intégrer

Source : registre npm (`whisper.rn@0.6.0`, publié 2026-05-14) + README du paquet.

- **Peer dependencies très permissives** : `react: *`, `react-native: *` — pas de contrainte de version bloquante a priori.
- **`codegenConfig` présent** (`RNWhisperSpec`, type `modules`) → compatible New Architecture (TurboModules). Compatibilité avec l'ancienne architecture (`newArchEnabled=false`, cas de ghost-poster) **non garantie à 100%** par la seule présence du codegen — à vérifier par un build réel avant d'aller plus loin.
- **Nécessite `expo prebuild`** (pas d'usage possible en Expo Go) — sans impact ici puisque les deux projets prebuild déjà en CI.
- **Règle Proguard à ajouter** : `-keep class com.rnwhisper.** { *; }` dans `android/app/proguard-rules.pro` — mineur, mais à ne pas oublier (release build avec minification activée).
- **`ndkVersion` recommandé ≥ 24.0.8215888** — ghost-poster est déjà sur `26.1.10909125`, compatible.
- **Alignement mémoire 16KB (Android 15+)** : sheethappens patche déjà `react-native-worklets`/`reanimated` pour ça en CI. Il faudra vérifier si les `.so` livrés par whisper.rn 0.6.0 sont déjà compilés avec cet alignement (projet activement maintenu, probable, mais **non vérifié** — à tester avant tout déploiement visant des devices Android 15+).

### 3.1 Deux modes d'usage très différents

**Mode fichier (API par défaut)** — `whisperContext.transcribe(filePath, options)` : transcrit un fichier audio déjà enregistré. Simple, mais implique un flux "enregistrer un .wav → puis transcrire", pas une dictée live avec résultats intermédiaires comme l'UX actuelle (`interimResults: true` sur `expo-speech-recognition`).

**Mode temps réel** — `RealtimeTranscriber` (nouveau, avec VAD intégré, auto-slicing). C'est l'équivalent fonctionnel de ce qu'utilise l'app aujourd'hui. **Mais il nécessite deux dépendances natives supplémentaires**, non incluses dans whisper.rn :

| Dépendance requise | Rôle | Dernière publication npm | Statut |
|---|---|---|---|
| `@fugood/react-native-audio-pcm-stream` | Capture du flux micro en PCM brut | **2023-03-23** (aucune `peerDependencies` déclarée) | ⚠️ Non maintenu depuis 3+ ans |
| `react-native-fs` (suggéré par la doc) | Écriture des fichiers audio temporaires | **2022-05-04** | ⚠️ Non maintenu depuis 4+ ans |

C'est le **risque concret le plus sérieux de cette migration** : le binding whisper.rn lui-même est activement maintenu (dernière release il y a ~2 mois), mais la fonctionnalité dont l'app a réellement besoin (dictée live) dépend de deux paquets satellites à l'arrêt depuis plusieurs années. Pas de garantie de compatibilité avec RN 0.76.9/0.85.3, New Arch, ou les futures versions d'Android — à tester en profondeur (build + exécution réelle sur device) avant tout engagement, pas seulement `npm install`.

**Piste à explorer, non confirmée** : whisper.rn documente une interface fs "compatible" injectable (voir `src/utils/WavFileWriter.ts` dans le repo whisper.rn) plutôt qu'une dépendance dure à `react-native-fs`. Les deux projets ont déjà `expo-file-system` en dépendance active et maintenue — un adaptateur custom implémentant cette interface pourrait éviter d'ajouter `react-native-fs`. Cela ne résout pas le problème de `@fugood/react-native-audio-pcm-stream`, qui reste la seule voie documentée pour la capture PCM live.

---

## 4. Tailles des modèles (vérifiées, Hugging Face `ggerganov/whisper.cpp`)

Seuls les modèles **multilingues** sont pertinents (l'app dicte en français) — écarter les variantes `.en`.

| Modèle | Poids original (fp16) | Quantisé q8_0 | Quantisé q5_1 |
|---|---|---|---|
| tiny | 77.7 MB | 43.5 MB | 32.2 MB |
| base | 148.0 MB | 81.8 MB | 59.7 MB |
| small | 487.6 MB | 264.5 MB | 190.1 MB |

Pour référence, l'APK debug local actuel (build de test, non représentatif d'une release) pèse 132 MB. **La taille de l'APK release réelle n'a pas été mesurée dans le cadre de cette étude** — donnée manquante à collecter avant de statuer précisément sur l'impact relatif.

---

## 5. Risques concrets identifiés (récapitulatif)

1. **Dépendances non maintenues pour le mode temps réel** (`@fugood/react-native-audio-pcm-stream`, `react-native-fs`) — risque le plus sérieux, détaillé section 3.1.
2. **Compatibilité New Architecture incertaine** avec `newArchEnabled=false` sur ghost-poster — codegen présent côté whisper.rn ne garantit pas un fonctionnement testé en ancienne architecture.
3. **Alignement mémoire 16KB (Android 15+)** non vérifié pour les `.so` de whisper.rn — sheethappens a déjà dû patcher d'autres libs natives pour cette contrainte.
4. **Taille d'app** : même avec le modèle le plus compact pertinent (tiny q5_1, 32 MB), c'est un ajout net non négligeable par rapport à une lib système gratuite en taille (expo-speech-recognition n'embarque aucun modèle, il délègue à l'OS).
5. **Changement d'UX potentiel** : le mode fichier de whisper.rn ne donne pas nativement de résultats intermédiaires token-par-token comme `interimResults` actuel — le mode temps réel (`RealtimeTranscriber`) le permet mais réintroduit le risque n°1.
6. **Refonte de `useVoice.ts` nécessaire dans les deux projets** — l'API `whisper.rn` (contexts, transcribe/stop, VAD) n'a pas la même forme que `expo-speech-recognition`.

---

## 6. Plan de migration proposé (étape par étape)

### Étape 0 — Preuve de concept isolée, hors des deux repos
Avant de toucher à `ghost-poster` ou `sheethappens` : créer un projet Expo minimal jetable, faire `expo prebuild`, ajouter whisper.rn + `@fugood/react-native-audio-pcm-stream` + un adaptateur fs custom sur `expo-file-system` (ou `react-native-fs` en secours), et valider concrètement :
- Que le build Gradle passe avec `newArchEnabled=false` (config par défaut ghost-poster).
- Que `RealtimeTranscriber` fonctionne réellement sur un device Android récent (pas juste en théorie).
- Le temps de chargement du modèle + la latence de transcription en conditions réelles, avec du vocabulaire technique français.

Cette étape seule tranche la faisabilité — si `@fugood/react-native-audio-pcm-stream` casse au build ou en usage, toute la suite est à reconsidérer (retour à un fork maintenu, ou abandon du mode temps réel au profit d'un flux "enregistrer puis transcrire").

### Étape 1 — Choix du projet pilote
Deux options, avec un trade-off réel plutôt qu'un choix imposé :
- **ghost-poster d'abord** : app déjà publiée avec utilisateurs réels — une régression vocale a un coût direct (cf. l'incident récent du bug de dictée déjà vécu sur ce projet). Stack plus ancienne (Expo 52/RN 0.76.9), donc plus de risque de friction de compatibilité avec whisper.rn 0.6.0 qui cible probablement des versions plus récentes.
- **sheethappens d'abord** : stack plus fraîche (Expo 56/RN 0.85.3), donc a priori moins de friction de compatibilité, et pas encore d'utilisateurs à risque — terrain d'essai à moindre conséquence.

Recommandation : **sheethappens comme terrain d'essai**, puis report sur ghost-poster une fois la preuve de concept validée en conditions réelles sur la stack la plus récente. Réduit le risque de casser une app déjà en usage avec un binding dont la compatibilité "ancienne archi + RN 0.76" n'est pas vérifiée.

### Étape 2 — Intégration whisper.rn (mode fichier d'abord)
Intégrer whisper.rn en mode `transcribe(filePath)` simple avant de se lancer dans `RealtimeTranscriber` — valide le binding natif, le modèle, le proguard, la taille d'app, sans dépendre des paquets non maintenus. Permet de livrer une dictée "enregistrer puis transcrire" (UX dégradée par rapport à l'actuel mais fonctionnelle) comme filet de sécurité.

### Étape 3 — Intégration `RealtimeTranscriber` si l'étape 0 l'a validé
Seulement si la preuve de concept (étape 0) a confirmé que `@fugood/react-native-audio-pcm-stream` fonctionne de façon fiable. Sinon, évaluer des alternatives de capture PCM (écrire un module natif minimal maison, ou explorer si un fork communautaire plus récent de la lib existe).

### Étape 4 — Bascule de `useVoice.ts`
Réécrire le hook pour exposer la même interface (`state`, `transcript`, `start`, `stop`, `reset`) mais adossée à whisper.rn en interne, pour minimiser l'impact sur `compose.tsx` des deux projets.

### Étape 5 — Report sur le second projet
Une fois validé en production sur le pilote, porter le même hook sur l'autre projet.

---

## 7. Recommandation de modèle

**Modèle recommandé par défaut : `base` quantisé q5_1 (~60 MB).**

Justification :
- `tiny` (32 MB en q5_1) est nettement plus léger mais reste le modèle le plus faible en précision, y compris pour du vocabulaire courant — peu de raisons de penser qu'il ferait mieux que le moteur système actuel sur du jargon technique.
- `base` en q5_1 (~60 MB) reste un ajout d'app raisonnable pour un usage personnel (README : "Not commercial software. A tool built for personal use") tout en offrant un saut de qualité réel par rapport à `tiny`, sur toutes les langues supportées dont le français.
- `small` en q5_1 (~190 MB) serait probablement le meilleur choix pur précision, mais représente un ajout de poids d'app disproportionné pour une app perso mono-utilisateur — à ne considérer **qu'en secours** si `base` s'avère insuffisant sur les termes techniques visés (HAProxy, n8n, etc.) en usage réel.

Recommandation opérationnelle : démarrer avec `base` q5_1 lors de la preuve de concept (étape 0), et ne monter à `small` q5_1 que si un test réel avec le vocabulaire technique du quotidien de l'utilisateur montre que `base` ne suffit pas.

---

## 8. Ce que cette étude n'a pas pu vérifier

- Taille exacte de l'APK release actuel de ghost-poster (seul un debug build local, non représentatif, a été mesuré).
- Compatibilité effective de whisper.rn 0.6.0 avec `newArchEnabled=false` — nécessite un build réel (étape 0 du plan).
- Alignement 16KB des `.so` whisper.rn pour Android 15+.
- Fiabilité réelle de `@fugood/react-native-audio-pcm-stream` malgré son absence de maintenance depuis 2023 — seul un test manuel le confirmera.
- Détail du `.github/workflows` de sheethappens au-delà de ce qui a été lu (contenu de `build-apk.sh` non audité).
