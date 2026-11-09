# Étage rattaché à un repo + « Composer l'équipe »

Date : 2026-11-09 — fork perso (branche à créer depuis `main`).

## Pourquoi

La façon de travailler de l'utilisateur : il ouvre un **étage** (fenêtre « New Floor », qui démarre vide) et y
travaille sur **un repo**. Deux frictions :

1. **Les agents ne savent pas, de base, sur quel projet ils bossent ni s'ils sont isolés.** Aujourd'hui
   l'identité injectée ne dit que `Working directory: <cwd>` (`src/main/hive.ts`, `identityText`). Pour un agent
   isolé, ce `cwd` est un worktree (`<harnessHome>/worktrees/<id>`) : rien ne lui dit que c'est un worktree du
   repo X sur la branche `agent/<id>` issue de `<base>`.
2. **Créer l'armée d'agents demande à chaque fois d'écrire à la main un prompt** « analyse la codebase et
   propose-moi des agents », puis de transformer la réponse en agents. Il veut le faire depuis l'app.

Succès : sur un repo neuf, ouvrir un étage, choisir le repo, cliquer un bouton, répondre à 0-3 questions,
cocher les agents proposés, importer — sans rien écrire soi-même. Et chaque agent démarre en sachant quel
projet et dans quel mode (repo direct / worktree isolé) il travaille.

## Ce qui existe déjà (à réutiliser, pas réinventer)

- **Manifeste d'agent** `munder-difflin/hire@1` — `src/shared/hire.ts`. Validateur unique
  `validateHireManifest` avec les plafonds : `name` ≤ 40 (requis), `description` ≤ 200, `goal` ≤ 4000,
  `character`/`accent` ≤ 24, `model` ≤ 80, `capabilities` ≤ 12 × 40, `commandFlags` ≤ 16 et allowlist,
  `skills`/`mcpServers` ≤ 8 et allowlists, `provider` ∈ claude/antigravity/codex/cursor, `isolate`, `tokenCap`,
  fichier ≤ 64 Ko.
- **Import multi-fichiers** : `hire:openFile` (main) → `importHireFiles` (preload) → file d'attente
  `enqueuePendingHires` → revue agent par agent dans `AddAgentModal`. **Un manifeste ne spawn jamais seul**,
  l'humain clique « spawn » : règle de sécurité à conserver.
- **Claude caché** : `runHiddenClaude` (`src/main/hiddenClaude.ts`) — session interactive éphémère dans un
  `cwd`, outils d'écriture interdits par défaut, renvoie le dernier texte assistant. Utilise le quota du plan
  interactif, pas les crédits SDK.
- **Étage** : `createWindow({ floor: true })` → partition `persist:floor-N`, état renderer isolé ; la hive sur
  disque (registry, mémoire, inbox) est partagée entre étages.
- `config.registeredRepos` : repos récents, déjà utilisés comme raccourcis dans `AddAgentModal`.

## Partie 1 — un étage = un repo

### Constat dans le code (vérifié)

Les étages ne sont pas isolés aujourd'hui : toutes les fenêtres lisent et écrivent le même
`<harnessHome>/roster.json` (`src/renderer/src/store/store.ts` ~l.353/398, `rosterSource.ts`). La partition
`persist:floor-N` n'isole plus que `localStorage` (devenu simple secours), `N` repart à 0 à chaque lancement
(`src/main/index.ts`, `floorSeq`), et les étages ne sont pas rouverts au relancement. Il n'y a donc **aucune
identité d'étage stable**.

### Modèle retenu (décidé par l'utilisateur)

**Un étage = un repo.** Le chemin absolu (normalisé) du repo est l'identité de l'étage.

- Ouvrir un étage = choisir un repo (liste `registeredRepos` + sélecteur de dossier).
- Chaque repo a **son propre roster** sur disque : `<harnessHome>/rosters/<slug-du-repo>.json` (agents,
  archivés, restaurables, files de messages, sélection), avec les mêmes garanties de durabilité que
  `roster.ts` aujourd'hui (backups append-only, écriture atomique, refus d'écraser un roster plein par un vide).
  Le contenu du fichier inclut le chemin complet du repo (le slug n'est qu'un nom de fichier).
- **Rouvrir le même repo plus tard ramène son équipe.** Deux étages = deux repos = deux rosters, sans
  écrasement mutuel.
- Le projet est **affiché** dans l'en-tête et le titre de la fenêtre.
- `AddAgentModal` : le dossier est **prérempli** avec le repo de l'étage. Toujours modifiable (un agent peut
  exceptionnellement viser un autre dossier ; il reste rangé dans le roster de l'étage).
- La hive sur disque (registry, mémoire, inbox, tâches) reste **partagée** entre étages, comme aujourd'hui.

### Choix de Claude (à relire)

- **Un repo ne peut être ouvert que dans un seul étage à la fois** : le rechoisir alors qu'il est déjà ouvert
  met sa fenêtre au premier plan au lieu d'en ouvrir une deuxième (deux fenêtres sur un même roster = le
  problème d'écrasement actuel).
- **Au lancement, l'app rouvre les étages qui étaient ouverts à la fermeture** (liste des repos persistée).
  La fenêtre principale est un étage comme les autres ; au tout premier lancement après la mise à jour elle
  demande un repo.
- **Migration de l'existant** : l'ancien `<harnessHome>/roster.json` n'est ni supprimé ni modifié. Au premier
  lancement, ses agents sont répartis dans les rosters par repo **d'après leur `cwd`** (ou le repo d'origine
  de leur worktree) ; ceux qu'on ne sait pas rattacher restent accessibles dans un étage « sans repo ».
  Rien n'est perdu ; l'ancien fichier reste comme sauvegarde.
- Changer le repo d'un étage ouvert n'est pas prévu : on ouvre un autre étage.

### Ce que l'agent sait

L'identité (`identityText`) et/ou le prompt système injecté gagnent un bloc « Projet » :

- Mode direct : `Projet : <nom> (<chemin du repo>). Tu travailles directement dans ce repo, branche courante
  <branche>. D'autres agents peuvent travailler dans le même arbre.`
- Mode isolé : `Projet : <nom> (<chemin du repo>). Tu travailles dans un worktree isolé <chemin>, branche
  agent/<id> créée depuis <base>. Tes changements n'apparaissent dans le repo qu'une fois mergés.`
- Hors repo git : seulement `Projet : <chemin>`.

Il faut donc que l'`AgentMeta` envoyé à `hive.ensureAgent` porte, en plus du `cwd`, le **repo d'origine**, le
**mode** (isolé ou non) et la **branche de base**. L'info existe déjà côté main au moment du spawn
(`worktreeOrigins`, `getBranch`). Les agents restaurés/reprises doivent retrouver la même info.

## Partie 2 — « Composer l'équipe »

### Parcours

1. Bouton **« Composer l'équipe »** sur l'étage (mis en avant quand l'étage n'a encore aucun agent).
2. **Analyse en arrière-plan** : un Claude caché, en lecture seule, dans le repo du projet. Indicateur de
   progression + annulation. L'utilisateur peut continuer à utiliser l'app.
3. **Questions** : si l'analyse a des doutes qui changent l'équipe, elle renvoie **0 à 3 questions** courtes
   (texte libre, éventuellement avec choix suggérés). L'utilisateur répond dans l'app. 0 question = on passe
   directement à la proposition.
4. **Proposition** : une liste d'agents, chacun affiché en carte : nom, rôle (description), mission (goal),
   provider/modèle, isolé ou non, capabilities, et une ligne « pourquoi cet agent ». Chaque carte est
   cochable et ses champs sont éditables, avec compteurs de caractères aux plafonds du manifeste.
5. **Valider** : les agents cochés sont passés dans `validateHireManifest`. Ceux valides sont **écrits en
   fichiers `.json`** (un par agent) ; les invalides sont signalés avec l'erreur, sans bloquer les autres.
6. **Importer** : bouton « Importer maintenant » qui enfile les manifestes écrits dans la revue existante
   (`enqueuePendingHires`) — même parcours qu'un import de fichiers. Les fichiers restent sur disque pour
   réimport ultérieur via l'import classique.

En parallèle, un mode **manuel** : bouton **« Copier le prompt »** (le même prompt que celui envoyé au Claude
caché, prêt à coller dans n'importe quel agent ou Claude Code) + un champ **« Coller la réponse »** dans l'app.
La réponse collée suit exactement le même parcours que le mode bouton (questions → cartes → valider → fichiers
→ importer). Si la réponse contient des questions, l'app les affiche, puis produit le prompt du 2ᵉ tour à
recopier. *(Choix de Claude : garder un seul prompt et un seul format pour les deux modes plutôt que demander à
l'agent externe d'écrire lui-même les fichiers.)*

### Le prompt d'analyse

- Contient : le chemin du projet, la spec `hire@1` avec **tous les plafonds et allowlists générés depuis
  `src/shared/hire.ts`** (pas recopiés à la main, pour ne pas dériver), les providers réellement configurés
  sur la machine, les agents déjà présents **dans le roster de cet étage** (pour ne pas proposer de doublons).
- Demande une sortie **JSON stricte** en deux formes possibles :
  `{ "analysis": "<résumé>", "questions": [...] }` ou `{ "agents": [ <manifeste hire@1 + champ "why"> ] }`.
- Le 2ᵉ tour (après réponses) envoie le prompt + **le résumé `analysis` du 1ᵉʳ tour** + les réponses, et
  exige `agents`. *(Choix de Claude : ne pas réanalyser tout le repo au 2ᵉ tour ; `runHiddenClaude` reste
  one-shot.)* Le résumé est plafonné (ex. 6000 caractères) pour garder le 2ᵉ prompt raisonnable.
- Tolérance : si la sortie n'est pas du JSON valide, une relance unique demandant de corriger ; sinon erreur
  lisible avec possibilité de réessayer.

### Où vont les fichiers (choix de Claude)

`<harnessHome>/hires/<slug-du-repo>/<date>-<slug-nom>.json`. Hors du repo pour ne pas le polluer ni
créer de fichiers non commités ; le dossier est ouvrable depuis l'app.

## Non-objectifs

- Pas de spawn automatique : l'import passe toujours par la revue humaine existante.
- Pas de nouveau format d'agent : on produit du `hire@1` tel quel.
- Pas de modification du « god » / orchestrateur ni de sa logique.
- Pas d'analyse continue ni de re-composition automatique quand le repo change.

## Anti-objectifs (échec même si « ça marche »)

- Des manifestes qui échouent à l'import parce que l'IA a dépassé un plafond ou inventé un flag/skill/MCP.
- Un parcours qui pose des questions évidentes ou plus de 3.
- L'analyse qui écrit dans le repo.
- Perdre ou faire disparaître des agents existants lors du passage aux rosters par repo.
- Deux étages qui s'écrasent mutuellement leurs agents.

## Laissé au builder

- Composant UI exact, emplacement du bouton, style (suivre le style Orca de `feat/ui-perso` déjà mergé).
- Modèle utilisé pour l'analyse (défaut raisonnable : le modèle Claude par défaut configuré).
- Réglage des délais de `runHiddenClaude` pour une analyse longue (l'idle de 3,5 s et le timeout de 180 s
  par défaut sont probablement trop courts pour explorer un gros repo).
- Format de la question (texte libre seul ou avec choix).
- Algorithme de slug du repo (stable, sans collision : ex. nom + hash court du chemin).
- Ordre de livraison conseillé : (1) étage = repo + rosters par repo + migration, (2) bloc « Projet » dans
  l'identité des agents, (3) « Composer l'équipe ». Chaque étape est utilisable seule.
