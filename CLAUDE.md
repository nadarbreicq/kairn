# Projet — Kairn (app sport open source)

## Règles de contribution (impératives)

1. **Aucun commit au nom de Claude, d'une IA ou d'un outil.** L'auteur et le committer sont toujours le compte de l'utilisateur (`user.name` / `user.email` configurés localement). Ne jamais définir, surcharger ou passer `--author`, `GIT_AUTHOR_*`, `GIT_COMMITTER_*`.
2. **Aucune trace d'IA nulle part** : ni dans les messages de commit, ni dans le code, ni dans les commentaires, la documentation, les notes de version, les descriptions de PR, les fichiers de configuration ou les métadonnées. Pas de `Co-Authored-By`, pas de `Generated with`, pas de mention d'assistant, de modèle ou de prompt.
3. Le dépôt public ne doit contenir **aucune donnée personnelle** : pas d'identifiant, de clé d'API, de jeton, de trace GPS réelle, de nom d'appareil, de chemin utilisateur. Les jeux de test sont des traces synthétiques.
4. Le projet reste **entièrement open source** : aucune dépendance propriétaire dans le code ni dans la chaîne de compilation.
5. Le projet doit rester **ouvrable et compilable dans VS Code** : dossier unique, `.vscode/launch.json` et `.vscode/tasks.json` versionnés, une tâche pour l'app mobile, une pour le poste de travail (Kairn Desk).

## Commandes

- `/commit` — voir `.claude/commands/commit.md`. À construire avec l'agent qui code l'app et l'interface web ; le fichier contient déjà le minimum attendu.
