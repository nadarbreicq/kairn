# Kairn

Un cairn est un tas de pierres posé sur un chemin pour indiquer la voie. Personne ne le possède, chacun y ajoute une pierre en passant, et il ne sert qu'à ceux qui empruntent le même sentier.

**Kairn** est une application de suivi sportif (course, vélo, randonnée, trail, marche) qui garde vos séances sur votre téléphone : pas de compte à créer, pas de télémétrie, pas de serveur qui reçoit vos données. **Kairn Desk** est le complément sur ordinateur : un programme qui affiche vos séances en grand écran, sans compte non plus — il lit simplement le dossier où votre téléphone les a écrites.

Le projet est encore jeune : il n'y a pas encore de version toute prête à installer en un clic depuis le Play Store. Les étapes ci-dessous montrent comment l'installer et l'utiliser dès maintenant.

## Installer Kairn sur votre téléphone Android

Il faut, une seule fois, un ordinateur avec [Node.js](https://nodejs.org) installé (prenez la version « LTS ») pour préparer l'application — ensuite elle vit sur votre téléphone.

**Étape 1 — sur le téléphone :** installez l'application gratuite **Expo Go**, disponible sur le Play Store.

**Étape 2 — sur l'ordinateur :** ouvrez un terminal dans le dossier du projet et lancez :

```bash
npm install
npm run mobile:start
```

**Étape 3 :** un QR code s'affiche dans le terminal. Ouvrez Expo Go sur le téléphone et scannez-le (le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi). Kairn s'ouvre directement sur le téléphone.

C'est le moyen le plus rapide pour essayer l'application. Pour une installation autonome — un vrai fichier à garder sur le téléphone, qui ne dépend plus de l'ordinateur ensuite — voir [Obtenir un fichier installable (APK)](#obtenir-un-fichier-installable-apk) plus bas.

Une fois lancée, l'app propose un petit parcours de bienvenue puis l'écran d'accueil : un bouton central pour démarrer un enregistrement, l'historique de vos sorties, et les réglages où choisir où vos séances sont rangées.

## Utiliser Kairn Desk sur votre ordinateur

Kairn Desk affiche vos séances en grand : carte, allure par segment, dénivelé. Toujours avec [Node.js](https://nodejs.org) installé, depuis le dossier du projet :

```bash
npm install
npm run desk:dev
```

Un message indique que Kairn Desk est prêt : ouvrez **<http://localhost:7333>** dans votre navigateur. Un dossier `Kairn/sessions` est créé dans votre dossier personnel — c'est là que Kairn Desk regarde. Pour l'alimenter, transférez-y les fichiers `.gpx` exportés depuis l'app mobile (onglet Export/Import), ou pointez-le vers le dossier où votre téléphone les synchronise déjà (câble USB, Drive, WebDAV) avec le bouton « Changer de dossier » dans l'interface.

Rien de tout ça n'est envoyé sur Internet : le programme tourne uniquement sur votre ordinateur, et fermer le terminal l'arrête.

## Obtenir un fichier installable (APK)

Pour installer Kairn sur un téléphone sans repasser par l'ordinateur à chaque fois, il faut un fichier `.apk` — l'équivalent d'un fichier d'installation. Deux façons de l'obtenir :

- **Depuis GitHub, sans rien installer** : chaque envoi sur `main` déclenche automatiquement `.github/workflows/ci.yml`, qui compile l'APK debug. Une fois le dépôt en ligne : onglet **Actions** du dépôt → dernière exécution de *CI* → artefact `kairn-debug-apk` à télécharger (disponible seulement une fois l'exécution terminée, quelques minutes).
- **En le fabriquant vous-même**, avec en plus [Android Studio](https://developer.android.com/studio) (pour les outils Android) et un JDK 17 (par exemple [Temurin](https://adoptium.net)) installés sur l'ordinateur :

  ```bash
  cd apps/mobile
  npx expo prebuild --platform android
  cd android
  ./gradlew assembleDebug
  ```

  Le fichier apparaît dans `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

Une fois le fichier obtenu, transférez-le sur le téléphone (câble USB, ou toute autre méthode habituelle) puis ouvrez-le depuis le gestionnaire de fichiers du téléphone. Android demande la première fois d'autoriser « l'installation d'applications inconnues » pour cette source — c'est normal, c'est le prix de ne pas passer par un magasin d'applications.

## Ce que Kairn garantit

- **Rien ne quitte l'appareil sans un geste explicite.** Les séances sont écrites en local ; les envoyer ailleurs (export, Drive une fois activé) est toujours une action volontaire.
- **Le GPS fonctionne hors ligne.** Les cartes de la zone sont mises en cache avant la sortie ; pendant l'effort, aucune connexion n'est ouverte.
- **Aucune donnée de test réelle dans le code source** : les traces utilisées pour vérifier que l'application fonctionne sont générées, pas issues d'une vraie sortie de quelqu'un.

## Pour les personnes qui développent

Le reste de cette section suppose une certaine familiarité avec le développement logiciel.

### Architecture

```text
kairn/
├─ packages/core/    module d'analyse GPS — partagé tel quel entre le mobile et Kairn Desk
├─ apps/mobile/      application Android (Expo + React Native + TypeScript)
└─ apps/desk/        Kairn Desk : serveur local (Node/Express) + page web (localhost:7333)
```

**Le fichier GPX est la base de données.** Le mobile écrit un fichier `.gpx` par séance dans un dossier local ; ce même dossier, une fois synchronisé, est celui que Kairn Desk surveille. Les deux utilisent `packages/core` pour tout calcul — distance, allure, dénivelé, segments, tendances — donc aucune divergence possible entre ce qu'affiche le téléphone et ce qu'affiche l'ordinateur : c'est la règle que `CLAUDE.md` impose pour les tests (« le mobile et le poste de travail doivent produire les mêmes valeurs sur les traces de test »), garantie ici par construction plutôt que vérifiée après coup.

Aucune dépendance propriétaire : Expo, Express et le reste des paquets utilisés sont open source (MIT/Apache/BSD).

### Installer et tester le dépôt

```bash
npm install      # installe les trois paquets du monorepo (workspaces npm) d'un coup
npm test         # core + Kairn Desk + mobile, une centaine de tests
npm run lint     # oxlint sur tout le dépôt
```

Dans VS Code, ouvrir le dossier `kairn` directement : `.vscode/tasks.json` et `launch.json` exposent les mêmes commandes via `Terminal → Exécuter la tâche…` et le débogueur.

Émulateur Android plutôt qu'un téléphone : installer [Android Studio](https://developer.android.com/studio), créer un appareil virtuel (AVD), le démarrer, puis `npm run android --workspace apps/mobile`. Aperçu rapide dans un navigateur (sans stockage réel — le web n'est pas une cible du produit) : `npm run web --workspace apps/mobile`.

### Ce qui est implémenté

- **Module d'analyse (`packages/core`)** : lecture/écriture GPX 1.1 (avec import tolérant d'un GPX externe sans l'extension Kairn), export GeoJSON/CSV, distance (haversine), dénivelé (détection d'extrema à hystérésis — robuste aux montées longues et lentes comme au bruit GPS), découpage en segments à pas adaptatif (100 m / 200 m / 500 m / 1 km selon la distance, ou forcé), zones de vitesse, agrégats hebdomadaires (semaines ISO 8601), tendance de volume, progression par sport, records personnels (meilleur effort par distance, dénivelé max, plus longue sortie), anonymisation départ/arrivée. Entièrement testé (49 tests).
- **Kairn Desk** : liste des sessions groupées par semaine, détail d'une session (trace réelle projetée en SVG, allure par segment, altitude, zones de vitesse), changement de pas d'analyse, correction (masquage définitif + réécriture du fichier — c'est ce qui « renvoie » la correction vers le téléphone au prochain passage de la synchronisation), export GPX/GeoJSON/CSV, archive de sauvegarde (zip), changement de dossier surveillé à chaud. Interface en HTML/CSS/JS simple, sans framework ni étape de build.
- **Mobile** : les huit écrans du prototype (onboarding, accueil, préparation, enregistrement en direct avec position simulée pour développer sans GPS, résumé, analyse, historique en trois vues, export/import, réglages), navigation par état (comme le prototype), stockage GPX réel sur l'appareil, vérification de nouvelle version auprès de l'API publique des releases GitHub.

### Ce qui est délibérément hors de cette version

Le prototype liste ces pistes comme des décisions à trancher plus tard ; elles sont laissées en évidence dans l'interface (comme Google Drive, déjà marqué « Fermé ») plutôt qu'implémentées à moitié :

- **Fond de carte et relief 3D** : la trace GPS réelle est dessinée (projection équirectangulaire), mais sans tuiles OpenStreetMap ni modèle d'élévation — ça reste à décider (tuiles embarquées ? service à la demande ?).
- **Google Drive, chiffrement par phrase de passe, capteurs BLE, mode fantôme, segments personnels** : façades présentes, non actives.
- **Import FIT/TCX** : seul le GPX est lu pour l'instant.
- **Signature APK** : la vérification de mise à jour compare les versions et pourra vérifier une somme de contrôle ; la vérification de signature Android proprement dite reste à ajouter.

### Décisions prises pour cette première version (réversibles)

- **Kairn Desk = serveur local + page web**, pas d'exécutable natif packagé — plus simple à maintenir, cohérent avec « aucun port ouvert vers l'extérieur par défaut ».
- **Mobile en Expo/React Native** plutôt qu'en Kotlin natif — accélère l'implémentation des huit écrans sans dépendance propriétaire, et Expo tourne aussi bien en local qu'en CI.
- **Nom de paquet Android** (`app.kairn.mobile` dans `apps/mobile/app.json`) est une valeur provisoire — le prototype note lui-même que le nom « Kairn » reste à vérifier en dépôt, en paquet Android et en domaine avant de figer quoi que ce soit. Le dépôt GitHub utilisé pour la vérification de mise à jour (`apps/mobile/App.tsx`) suit le dépôt réel du projet.

### Contribuer

Voir `CLAUDE.md` à la racine : règles de contribution impératives (auteur des commits, absence de toute mention d'IA, aucune donnée personnelle, projet entièrement open source). La commande `/commit` est décrite dans `.claude/commands/commit.md`.
