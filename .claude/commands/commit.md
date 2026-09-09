# /commit

Prépare et enregistre un commit des modifications en cours, dans le dépôt du projet Kairn.

Ce fichier est un socle minimal. Il sera complété avec l'agent qui développe l'application mobile
et l'interface web (Kairn Desk) : conventions de portée, hooks, tests à passer avant commit.

## Interdits absolus

- **Jamais de commit au nom de Claude, d'une IA ou d'un outil.** Auteur et committer = le compte de
  l'utilisateur, tel qu'il est configuré localement (`git config user.name`, `git config user.email`).
- Ne jamais définir, surcharger ni passer : `--author`, `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`,
  `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`.
- Aucune mention d'IA, d'assistant, de modèle ou de prompt : pas de `Co-Authored-By`, pas de
  `Generated with`, pas d'emoji de signature, pas de lien vers un outil. Ni dans le message, ni dans
  le code, ni dans les commentaires, la documentation ou les métadonnées.
- Aucun secret, jeton, clé d'API, identifiant, chemin utilisateur, nom d'appareil ni trace GPS réelle.
- Pas de `git push --force`, pas de réécriture d'historique, pas de commit sur `main` sans le demander.

## Déroulé attendu

1. Vérifier que `user.name` et `user.email` sont configurés. S'ils manquent, s'arrêter et le demander
   à l'utilisateur — ne jamais inventer d'identité.
2. Lire l'état du dépôt : `git status`, `git diff`, `git diff --staged`, `git log --oneline -10`
   (pour reprendre le style des messages existants).
3. Relire le diff et refuser d'indexer : fichiers de secrets (`.env`, clés, keystores), artefacts de
   compilation, dossiers d'IDE non versionnés, traces GPS réelles, fichiers volumineux.
4. Indexer uniquement les fichiers liés à la modification demandée. Ne pas faire de `git add -A`
   aveugle.
5. Découper en plusieurs commits si le diff couvre des sujets sans rapport.
6. Rédiger le message (voir format ci-dessous), commiter, puis afficher `git log -1 --stat` et
   `git status` pour confirmation.
7. Ne pousser que si l'utilisateur le demande explicitement.

## Format du message

```
<type>(<portée>): <résumé à l'impératif, minuscule, sans point final, ≤ 72 caractères>

<corps optionnel : ce qui change et pourquoi, en lignes de 72 caractères max>

Refs: #<numéro d'issue>
```

- Types : `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `chore`.
- Portées prévues : `mobile`, `desk`, `gpx`, `gps`, `carte`, `analyse`, `stockage`, `maj`, `ci`, `doc`.
- Le message décrit la modification, jamais la manière dont elle a été produite.
- Langue : française, comme le reste du dépôt.

## Contrôles avant commit (à compléter avec l'agent de développement)

- Compilation de l'app mobile et de Kairn Desk.
- Tests unitaires du module d'analyse (segments, allures, dénivelé) — le mobile et le poste de
  travail doivent produire les mêmes valeurs sur les traces de test.
- Recherche de secrets et de données personnelles dans le diff.
- Vérification qu'aucune mention d'IA n'a été introduite dans les fichiers modifiés.
