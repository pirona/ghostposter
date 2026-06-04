# ghost-poster — Installation et configuration

## Prérequis

Avant de commencer, assurez-vous d'avoir les outils suivants installés :

- **Node.js** 20 LTS ou supérieur (`node --version`)
- **npm** 10 ou supérieur (livré avec Node.js)
- **Node.js** 20 LTS ou supérieur — requis pour le toolchain de build (`npx expo run:android`)
- **Android Studio** avec un émulateur Android API 34+ configuré, ou un appareil physique Android avec les options développeur et le débogage USB activés

Pour les builds de release (APK signé), voir [`BUILD_LOCAL.md`](BUILD_LOCAL.md). Pour l'installation sans développement, téléchargez directement l'APK depuis les [Releases GitHub](https://github.com/billisdead/ghost-poster/releases).

## Installation

Clonez le dépôt et installez les dépendances :

```bash
git clone git@homegit.gyozamancave.fr:antoine/ghost-poster.git
cd ghost-poster
npm install
```

Aucune configuration d'environnement supplémentaire n'est nécessaire — il n'y a pas de fichier `.env`. Les secrets sont gérés à l'exécution via l'interface de l'application.

## Configuration de l'instance Ghost

L'application utilise l'**Admin API** de Ghost. Pour générer une clé d'accès :

1. Connectez-vous à votre panel Ghost Admin (`https://votre-ghost.fr/ghost/#/settings`)
2. Naviguez vers **Paramètres → Intégrations**
3. Cliquez sur **+ Ajouter une intégration personnalisée**
4. Donnez-lui un nom (par exemple : `ghost-poster`)
5. Après création, copiez la valeur du champ **Clé Admin API**

La clé est au format `id:secret` où `id` et `secret` sont des chaînes hexadécimales. Exemple (fictif) :

```
6ba7b810:9dad11d1b0004b00b0000c3f7edcfbadba0efbad
```

Conservez cette clé — elle ne peut pas être récupérée une fois la fenêtre fermée (il faudra en générer une nouvelle).

## Premier lancement

### Sur émulateur Android

```bash
npx expo run:android
```

Cette commande compile l'application native et la déploie sur l'émulateur. Le premier build prend plusieurs minutes (Gradle).

### Sur appareil physique (USB)

Activez le débogage USB sur l'appareil, connectez-le, puis :

```bash
npx expo run:android --device
```

### Build APK de release

Pour générer un APK signé prêt à distribuer, voir [`BUILD_LOCAL.md`](BUILD_LOCAL.md) (build local) et [`RELEASE.md`](RELEASE.md) (release automatisée via GitHub Actions).

## Configuration au premier lancement

Au premier démarrage, l'application redirige automatiquement vers l'écran **Instances Ghost** (Settings). Appuyez sur le bouton **+** et renseignez :

- **Nom** : un nom lisible pour identifier votre instance (ex : "Billisdead")
- **URL de base** : l'URL racine de votre Ghost sans slash final (ex : `https://ghost.billisdead.com`)
- **Clé Admin API** : la clé copiée depuis Ghost Admin (format `id:secret`)

L'application teste la connexion avant d'enregistrer. En cas d'échec, vérifiez que l'instance Ghost est accessible depuis le réseau de l'appareil et que la clé est correcte.

## Variables et secrets

Aucune variable d'environnement n'est utilisée. Tous les secrets sont stockés dans **expo-secure-store** (Android Keystore) sous deux clés :

| Clé SecureStore | Contenu |
|---|---|
| `GHOST_INSTANCES` | JSON sérialisé de la liste des instances (nom, URL, clé API) |
| `GHOST_ACTIVE_ID` | UUID de l'instance actuellement active |

Pour réinitialiser complètement la configuration (désinstallation ou debug) :

```bash
# Sur émulateur — efface toutes les données de l'app
adb shell pm clear fr.gyozamancave.ghostposter
```

Sur appareil physique, désinstallez et réinstallez l'application via les paramètres Android.
