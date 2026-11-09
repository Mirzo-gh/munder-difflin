# Étage = repo + « Composer l'équipe » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque étage est rattaché à un repo avec son propre roster persistant, chaque agent sait sur quel projet et dans quel mode (direct / worktree isolé) il travaille, et un bouton « Composer l'équipe » analyse le repo et produit des manifestes `hire@1` prêts à importer.

**Architecture:** Côté main, un roster par repo (`<harnessHome>/rosters/<slug>.json`, même `RosterStore` qu'aujourd'hui paramétré par chemin) et un registre fenêtre → repo qui route les IPC `roster:*` selon l'émetteur ; l'ancien `roster.json` est migré une fois, sans être modifié. L'identité hive (`identity.md`) gagne un bloc « Projet » calculé au spawn depuis git. « Composer l'équipe » = un prompt et un parseur purs dans `src/shared/teamPrompt.ts`, exécutés par `runHiddenClaude` côté main, et une modale renderer qui écrit les manifestes validés puis les pousse dans la file de revue d'import existante.

**Tech Stack:** Electron + electron-vite, React 18, TypeScript, zustand, tests `node --test` en `.cjs` avec `test/load-ts.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-09-etage-projet-et-equipe-design.md`

## Global Constraints

- `npm run typecheck` et `npm run test:focused` passent à la fin de chaque tâche. **État de départ : 1 échec préexistant** (`model picker options stay provider-specific`, catalogue de modèles) — ne pas le corriger ici, ne pas en ajouter.
- Utiliser Node 22 (nvm) pour `npm install` / `npm run dev` (Node 26 casse electron-rebuild).
- Plafonds `hire@1` (source unique `src/shared/hire.ts`) : `name` ≤ 40 requis, `description` ≤ 200, `goal` ≤ 4000, `character`/`accent` ≤ 24, `model` ≤ 80, `author` ≤ 80, `homepage` ≤ 300 https, `capabilities` ≤ 12 × 40, `commandFlags` ≤ 16 et allowlist, `skills` ≤ 8 ∈ `BUNDLED_SKILL_IDS`, `mcpServers` ≤ 8 ∈ `MCP_CATALOG`, `provider` ∈ claude/antigravity/codex/cursor, fichier ≤ 64 Ko.
- Un manifeste ne spawn jamais seul : tout passe par `enqueuePendingHires` → revue dans `AddAgentModal`.
- L'analyse ne doit jamais écrire dans le repo (`disallowedTools` par défaut de `runHiddenClaude` : `Edit`, `Write`, `NotebookEdit`).
- Aucun roster n'est jamais supprimé : l'ancien `roster.json` reste intact, backups append-only comme `roster.ts`.
- Textes UI via i18n, clés ajoutées dans `src/renderer/src/i18n/locales/en.json` (repli `en` pour les autres langues). Couleurs via tokens `--cth-*`.
- Un repo = au plus une fenêtre ouverte à la fois.
- Résumé `analysis` du 1ᵉʳ tour plafonné à 6000 caractères ; 0 à 3 questions max.
- Fichiers générés : `<harnessHome>/hires/<slug-du-repo>/<YYYY-MM-DD>-<slug-nom>.json`.

## Review Focus

1. **Deux fenêtres, deux repos, écritures entrelacées** → chaque roster ne contient que ses agents, aucun écrasement croisé. Test : Task 3 (`roster IPC routes writes by sender`).
2. **Repo choisi qui est un sous-dossier ou un worktree** (`~/code/app/src`, `<harnessHome>/worktrees/x`) → normalisé vers la racine du repo principal, donc même étage. Test : Task 3 (`normalizeFloorRepo`).
3. **Migration d'un roster avec god, agents isolés dont le worktree a disparu, files de messages** → god copié dans chaque groupe, agent sans worktree rattaché via son `cwd`, files suivent leurs agents, rien de perdu. Test : Task 2.
4. **Réponse du modèle avec texte autour du JSON, ou bloc ```json** → parsée quand même ; JSON vraiment invalide → une seule relance puis erreur lisible. Tests : Tasks 7 et 8.
5. **Agent proposé dépassant un plafond / avec un flag ou skill inventé** → carte marquée invalide avec l'erreur du validateur, les autres s'écrivent quand même. Test : Task 7 (`parseTeamResponse keeps invalid agents apart`).

---

## Partie A — Un étage = un repo

### Task 1: Rosters par repo (stockage)

**Files:**
- Modify: `src/main/roster.ts`
- Test: `test/repo-roster.test.cjs` (nouveau) ; `test/roster.test.cjs` doit rester vert inchangé

**Interfaces:**
- Produces:
  - `repoSlug(repoRoot: string): string` — `<basename slugifié a-z0-9-, max 40>-<8 premiers hex de sha1(repoRoot)>` ; stable, deux repos de même nom → slugs différents.
  - `repoRosterPath(home: string, repoRoot: string): string` → `<home>/rosters/<slug>.json`
  - `repoRosterBackupDir(home: string, repoRoot: string): string` → `<home>/rosters/backups/<slug>/`
  - `class RosterStore` : constructeur étendu `new RosterStore(getHome: () => string | null, repoRoot?: string)`. Sans `repoRoot` : comportement actuel identique (`roster.json`). Avec : lit/écrit `repoRosterPath`, backups dans `repoRosterBackupDir`, même empty-guard.
  - `RosterSnapshot` gagne `repoRoot?: string` (écrit par le store quand `repoRoot` est fourni).
  - `listRepoRosters(home: string): { repoRoot: string; slug: string; agentCount: number; savedAt: string }[]` — lit `rosters/*.json`, ignore fichiers illisibles, trié par `savedAt` décroissant.
  - `readAllRosterAgents(home: string): unknown[]` — agents de tous les rosters par repo **plus** ceux du `roster.json` legacy.

- [ ] **Step 1: Écrire les tests** dans `test/repo-roster.test.cjs` :
  - `repoSlug is stable and distinguishes same-named repos` : `repoSlug('/a/app') === repoSlug('/a/app')`, `repoSlug('/a/app') !== repoSlug('/b/app')`, match `/^app-[0-9a-f]{8}$/`.
  - `a repo store writes to rosters/<slug>.json and never touches roster.json` : home temp avec un `roster.json` legacy à 1 agent ; `new RosterStore(() => home, '/r/one').write(snap à 2 agents)` → `rosters/<slug>.json` contient 2 agents et `repoRoot: '/r/one'`, `roster.json` octet pour octet identique.
  - `two repo stores do not see each other` : écrire A et B, `read()` de chacun renvoie ses propres agents.
  - `the empty-guard applies per repo store` : fichier repo à 1 agent, nouvelle instance, `write` vide → `{ ok: false, skipped: 'empty-first-write' }`.
  - `listRepoRosters reports repo, count and skips garbage` : 2 rosters valides + 1 fichier `{` → 2 entrées avec `agentCount` corrects.
  - `readAllRosterAgents merges legacy and repo rosters`.
- [ ] **Step 2: Lancer** `node --test test/repo-roster.test.cjs` → FAIL (`repoSlug is not a function`).
- [ ] **Step 3: Implémenter** dans `src/main/roster.ts` (sha1 via `node:crypto`). La méthode privée `backup` prend le dossier de backup de l'instance.
- [ ] **Step 4: Lancer** `node --test test/repo-roster.test.cjs test/roster.test.cjs` → PASS.
- [ ] **Step 5: Commit** `feat(roster): un roster par repo`

### Task 2: Migration du roster legacy

**Files:**
- Create: `src/main/rosterMigration.ts`
- Test: `test/roster-migration.test.cjs`

**Interfaces:**
- Consumes: `RosterStore`, `repoRosterPath` (Task 1).
- Produces:
  - `planLegacyMigration(legacy: RosterSnapshot, resolveRepo: (agent: { cwd?: string; worktreePath?: string }) => Promise<string | null>): Promise<Map<string, RosterSnapshot>>` — pure (hors `resolveRepo`).
  - `migrateLegacyRoster(home: string, resolveRepo: …): Promise<{ migrated: boolean; repos: string[] }>` — no-op si `<home>/roster.json` absent ou si `<home>/rosters/.migrated` existe ; écrit chaque groupe via `new RosterStore(() => home, repoRoot)` puis crée `.migrated`. Ne modifie jamais `roster.json`.
- Règles de regroupement (`planLegacyMigration`) :
  - repo d'un agent = `resolveRepo(agent)` ; si `null` → son `cwd` tel quel (un dossier non-git est un projet).
  - entrées `isGod: true` : exclues du regroupement, **copiées dans chaque groupe**.
  - s'applique à `agents`, `archived`, `restorable` ; `queues[id]` suit l'agent `id` ; `selectedId` conservé seulement dans le groupe qui contient cet id.
  - agent sans `cwd` exploitable et sans repo → ignoré du découpage mais toujours présent dans `roster.json` (jamais perdu).
- `resolveRepo` réel (fourni par index.ts en Task 4) : `mainRepoRoot(agent.worktreePath ?? agent.cwd)` si le chemin existe, sinon `mainRepoRoot(agent.cwd)`, sinon `null`.

- [ ] **Step 1: Écrire les tests** (`resolveRepo` simulé par une table) :
  - `agents are grouped by resolved repo` : 3 agents sur 2 repos → 2 snapshots aux bons ids.
  - `god is copied into every group`.
  - `queues follow their agent and selectedId stays with its group`.
  - `an unresolvable agent falls back to its cwd as project`.
  - `migrateLegacyRoster writes repo rosters, leaves roster.json byte-identical, and runs once` : second appel → `{ migrated: false }`, fichiers inchangés.
- [ ] **Step 2: Lancer** `node --test test/roster-migration.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter** `src/main/rosterMigration.ts`.
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat(roster): migration du roster partagé vers les rosters par repo`

### Task 3: Registre fenêtre → repo

**Files:**
- Create: `src/main/floors.ts`
- Modify: `src/main/config.ts` (clé `openFloors`)
- Test: `test/floors.test.cjs`

**Interfaces:**
- Produces:
  - `normalizeFloorRepo(path: string, mainRoot: (p: string) => Promise<string | null>): Promise<string | null>` — `expandTilde` + `resolve` ; `null` si le dossier n'existe pas ; sinon `mainRoot(p) ?? p` (sous-dossier et worktree → racine du repo principal).
  - `class FloorRegistry` (sans Electron, ids numériques de `webContents`) :
    - `bind(ownerId: number, repoRoot: string): { ok: true } | { ok: false; ownerId: number }` — refuse si le repo est déjà lié à un **autre** owner et renvoie cet owner.
    - `unbind(ownerId: number): void`
    - `repoOf(ownerId: number): string | null`
    - `ownerOf(repoRoot: string): number | null`
    - `openRepos(): string[]` (ordre d'ouverture)
  - `HarnessConfig.openFloors?: string[]` (défaut `[]`, assaini comme `registeredRepos` dans le patch de config : chaînes absolues uniquement, dédoublonnées).

- [ ] **Step 1: Écrire les tests** :
  - `normalizeFloorRepo maps subfolders and worktrees to the main repo root` (vrai repo git temp + `git worktree add` ; `mainRoot` = `mainRepoRoot` de `src/main/git.ts`).
  - `normalizeFloorRepo returns null for a missing folder` et `keeps a non-git folder as is`.
  - `a repo can be bound to only one window` : `bind(1,'/r')` ok, `bind(2,'/r')` → `{ ok:false, ownerId:1 }`, après `unbind(1)` → `bind(2,'/r')` ok.
  - `openFloors survives a config round-trip` (via les helpers de patch de `config.ts` utilisés par `test/config-write-notify.test.cjs`).
- [ ] **Step 2: Lancer** `node --test test/floors.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter** `src/main/floors.ts` et la clé de config.
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat(floors): registre fenêtre → repo`

### Task 4: Câblage main (IPC, fenêtres, migration au démarrage)

**Files:**
- Modify: `src/main/index.ts` (zones : `const roster = …` ~l.281, `createWindow` ~l.2301, `openFloor` ~l.2456, IPC roster ~l.3451, reset ~l.3839, changeHome ~l.3276, `app.whenReady` ~l.5147, `before-quit` ~l.5197)
- Modify: `src/preload/index.ts`
- Test: `test/floor-ipc-wiring.test.cjs` (assertions sur le source, même style que `test/hire-import.test.cjs` « Electron picker and IPC… »)

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces (IPC + preload `window.cth`) :
  - `floorRepoSync(): string | null` — IPC sync `floor:repoSync` → `floors.repoOf(evt.sender.id)`.
  - `chooseFloorRepo(path: string): Promise<{ ok: true } | { ok: false; focused?: true; error?: string }>` — IPC `floor:chooseRepo` : `normalizeFloorRepo` ; si lié ailleurs → focus de cette fenêtre, `{ ok:false, focused:true }` ; sinon `bind`, persister `openFloors`, ajouter le repo en tête de `registeredRepos`, `win.setTitle('<basename> — Munder Difflin')`, `webContents.reload()`.
  - `listFloorRepos(): Promise<{ repoRoot: string; agentCount: number; open: boolean }[]>` — `listRepoRosters` ∪ `registeredRepos` (agentCount 0), `open` via `floors.ownerOf`.
  - `openFloorForRepo(path: string): Promise<{ ok: boolean; error?: string }>` — ouvre une nouvelle fenêtre déjà liée (ou focus si déjà ouverte).
- Comportements :
  - `roster:readSync` / `roster:read` / `roster:write` routés par `evt.sender.id` vers un `RosterStore(home, repoRoot)` mis en cache par repo (une instance par repo et par lancement, pour garder la sémantique de l'empty-guard). Fenêtre non liée : read → `null`, write → `{ ok:false, error:'no floor repo' }`.
  - `createWindow(opts: { floor?: boolean; repoRoot?: string })` : si `repoRoot`, `bind` avant `loadURL`/`loadFile`. Sur `closed` : `unbind`, et retirer de `openFloors` **sauf** si l'app est en train de quitter (`let appQuitting = false`, passé à `true` dans `before-quit` quand la sortie n'est pas empêchée et dans `teardownAndQuit`).
  - Démarrage (`whenReady`, avant `createWindow`) : `await migrateLegacyRoster(home, resolveRepo)` (erreurs loguées, jamais bloquantes) ; puis une fenêtre par repo de `openFloors` dont le dossier existe encore (la première = principale, sans `floor:true`) ; aucune → une fenêtre principale non liée.
  - `standingGoalFromRoster` : cherche dans `readAllRosterAgents(home)`.
  - Reset : `archive()` sur le store legacy **et** sur chaque store par repo connu (`listRepoRosters`).
  - changeHome `move` : ajouter `'rosters'` à la liste copiée.
  - `openFloor()` (menu « New Floor ») inchangé : ouvre une fenêtre non liée → elle affichera le sélecteur.

- [ ] **Step 1: Écrire les tests source** : `roster:write` utilise `evt.sender.id` ; `migrateLegacyRoster` est appelé avant le premier `createWindow(` dans `whenReady` ; `'rosters'` figure dans la liste copiée par changeHome ; preload expose `floorRepoSync`, `chooseFloorRepo`, `listFloorRepos`, `openFloorForRepo`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** `npm run typecheck && npm run test:focused` → seul l'échec préexistant.
- [ ] **Step 5: Commit** `feat(floors): IPC roster par fenêtre, réouverture des étages, migration au démarrage`

### Task 5: Renderer — sélecteur de repo, store, en-tête, préremplissage

**Files:**
- Modify: `src/renderer/src/store/rosterSource.ts`, `src/renderer/src/store/store.ts` (~l.353-410)
- Create: `src/renderer/src/components/FloorRepoPicker.tsx`
- Modify: `src/renderer/src/App.tsx`, `src/renderer/src/components/AddAgentModal.tsx` (~l.194), `src/renderer/src/i18n/locales/en.json`
- Test: `test/roster-source.test.cjs` (ajouts)

**Interfaces:**
- Consumes: preload de Task 4.
- Produces:
  - `RosterSourceInput.floorRepo: string | null` (nouveau champ). Règle : `floorRepo === null` → `{ useFileRoster:false, useLocalFallback:false }` ; `floorRepo` défini → fichier si non vide, **jamais** de repli localStorage (la partition d'une fenêtre peut contenir l'équipe d'un autre repo).
  - Store : `floorRepo: string | null` (lu une fois au chargement du module via `window.cth.floorRepoSync()`, à côté de `fileRoster`) ; `flushRosterNow` ne fait rien quand `floorRepo` est `null`.
  - `FloorRepoPicker` : liste `listFloorRepos()` (nom, chemin, nb d'agents, badge « ouvert ») + bouton « Choisir un dossier… » (`window.cth.chooseFolder()`), clic → `chooseFloorRepo(path)` ; `focused` → message « déjà ouvert dans une autre fenêtre ».
  - `App` : si `floorRepo === null` → rend uniquement `FloorRepoPicker` (pas d'étage, pas de boot de god). Sinon, en-tête affiche `basename(floorRepo)` avec le chemin en `title`.
  - `AddAgentModal` : `cwd` initial = `floorRepo ?? config.registeredRepos[0] ?? ''`.
  - `src/renderer/src/hooks/useHive.ts` (~l.383, branche « already running ») : si le PTY de god tourne déjà (lancé par un autre étage) mais qu'aucun agent `GOD_ID` n'est dans le store de cet étage, ajouter son entrée (même forme que celle créée au spawn ~l.430) — sinon un nouvel étage n'afficherait pas god. Le boot de god ne se fait que dans une fenêtre liée.

- [ ] **Step 1: Écrire les tests** dans `test/roster-source.test.cjs` : `an unbound window loads nothing`, `a bound window never falls back to localStorage` (fichier vide + `storedHome === currentHome` → `useLocalFallback:false`), `a bound window uses its populated file`. Les tests existants reçoivent tous `floorRepo: '/r'` ; ceux qui attendaient `useLocalFallback: true` attendent désormais `false` (règle changée volontairement : commentaire en tête de section expliquant pourquoi).
- [ ] **Step 2: Lancer** `node --test test/roster-source.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter** rosterSource, store, picker, App, modal, clés i18n (`floor.pickTitle`, `floor.pickHint`, `floor.chooseFolder`, `floor.alreadyOpen`, `floor.agents`).
- [ ] **Step 4: Lancer** `npm run typecheck && npm run test:focused` → seul l'échec préexistant.
- [ ] **Step 5: Vérification manuelle** (`npm run dev`, Node 22) : premier lancement → migration faite, sélecteur listant les repos migrés ; choisir A → son équipe, god visible ; ouvrir un repo C sans roster → god visible aussi ; Cmd+Shift+N → sélecteur ; choisir B → équipe B ; rechoisir A depuis une 3ᵉ fenêtre → focus de la fenêtre A ; quitter/relancer → A et B rouverts ; `roster.json` inchangé.
- [ ] **Step 6: Commit** `feat(ui): sélecteur de repo par étage`

---

## Partie B — L'agent connaît son projet

### Task 6: Bloc « Projet » dans l'identité

**Files:**
- Create: `src/main/projectInfo.ts`
- Modify: `src/main/hive.ts` (`AgentMeta` ~l.123, `identityText` ~l.1430), `src/main/index.ts` (spawn ~l.2708-2760)
- Test: `test/project-info.test.cjs`

**Interfaces:**
- Produces:
  - `interface ProjectInfo { repoRoot: string; isGit: boolean; isolated: boolean; worktreePath?: string; branch?: string; baseBranch?: string }`
  - `resolveProjectInfo(cwd: string, hint?: { baseBranch?: string }): Promise<ProjectInfo>` — `repoRoot = mainRepoRoot(cwd) ?? cwd` ; `isolated` = `cwd` est un worktree lié (son `git rev-parse --show-toplevel` ≠ `repoRoot`) ; `branch` = branche courante de `cwd` ; `baseBranch` = `hint.baseBranch` si fourni.
  - `projectBlock(info: ProjectInfo): string` — texte exact (FR, pour l'agent) :
    - direct git : ``Projet : `<basename>` (`<repoRoot>`). Tu travailles directement dans ce repo, branche `<branch>`. D'autres agents peuvent travailler dans le même arbre.``
    - isolé : ``Projet : `<basename>` (`<repoRoot>`). Tu travailles dans un worktree isolé `<worktreePath>`, branche `<branch>`[ créée depuis `<baseBranch>`]. Tes changements n'arrivent dans le repo qu'une fois mergés.``
    - non-git : ``Projet : `<repoRoot>`.``
  - `AgentMeta.project?: ProjectInfo` ; `identityText` insère `- ${projectBlock(meta.project)}` juste après la ligne `Working directory`, uniquement si `meta.project` est défini.
  - Spawn (`index.ts`) : après le bloc worktree, `const project = await resolveProjectInfo(opts.cwd, { baseBranch })` (`baseBranch` = celle calculée pour `addWorktree`, sinon absente) et `hive.ensureAgent({ ...opts.hive, cwd: opts.cwd, provider, project }, …)`. Erreur → spawn sans `project` (jamais bloquant). God exclu (`opts.hive.isGod`).

- [ ] **Step 1: Écrire les tests** (repo git temp avec un commit, worktree via `git worktree add -b agent/x`) :
  - `a direct checkout is not isolated` (+ `branch` = branche courante).
  - `a linked worktree is isolated and points at the main repo`.
  - `a plain folder is not git`.
  - `projectBlock` : les trois textes exacts ci-dessus (avec et sans `baseBranch`).
  - `identity.md carries the project block` : `HiveManager` sur home temp, `ensureAgent({ …, project })` → `identity.md` contient `Projet :` ; sans `project` → ne le contient pas.
- [ ] **Step 2: Lancer** `node --test test/project-info.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** `npm run typecheck && npm run test:focused` → seul l'échec préexistant.
- [ ] **Step 5: Commit** `feat(hive): l'agent connaît son projet et son mode d'isolation`

---

## Partie C — « Composer l'équipe »

### Task 7: Plafonds exportés, prompt et parseur

**Files:**
- Modify: `src/shared/hire.ts` (exporter les plafonds, les utiliser dans `validateHireManifest`)
- Create: `src/shared/teamPrompt.ts`
- Test: `test/team-prompt.test.cjs` ; `test/hire-validator-parity.test.cjs` doit rester vert

**Interfaces:**
- Produces:
  - `export const HIRE_LIMITS = { name: 40, description: 200, goal: 4000, character: 24, accent: 24, model: 80, author: 80, homepage: 300, capabilities: 12, capabilityChars: 40, commandFlags: 16, skills: 8, mcpServers: 8 } as const` ; `export const HIRE_PROVIDERS` ; `export const SAFE_FLAG_NAMES` (déjà défini, à exporter). `validateHireManifest` lit ces constantes (aucun changement de comportement).
  - `interface TeamPromptInput { repoRoot: string; existingAgents: { name: string; description?: string }[]; defaultModel?: string; round: 1 | 2; analysis?: string; answers?: { question: string; answer: string }[] }`
  - `buildTeamPrompt(input: TeamPromptInput): string` — contient : chemin du repo ; consigne lecture seule ; spec `hire@1` générée depuis `HIRE_LIMITS`, `HIRE_PROVIDERS`, `SAFE_FLAG_NAMES`, `BUNDLED_SKILL_IDS`, ids de `MCP_CATALOG` (avec leur tier) ; « ne pas renseigner `character`, `accent`, `author`, `homepage` » ; agents existants à ne pas dupliquer ; format de sortie JSON strict ; round 1 : `{"analysis": "...≤6000", "questions": [≤3]}` **ou** directement `{"agents": [...]}` si aucune question utile ; round 2 : inclut `analysis` + `answers` et exige `{"agents": [...]}`. Chaque agent = manifeste `hire@1` + `"why": "<≤200>"`.
  - `type TeamResponse = { kind: 'questions'; analysis: string; questions: string[] } | { kind: 'agents'; agents: { manifest: HireManifest; why: string }[]; invalid: { name?: string; errors: string[] }[] } | { kind: 'error'; error: string }`
  - `parseTeamResponse(text: string): TeamResponse` — extrait le premier objet JSON équilibré du texte (tolère texte autour et clôtures ```json) ; `questions` tronquées à 3, `analysis` tronquée à 6000 ; chaque agent passe dans `validateHireManifest` (le champ `why` est retiré avant, tronqué à 200).

- [ ] **Step 1: Écrire les tests** :
  - `HIRE_LIMITS drives the validator` : nom de 41 caractères → erreur `"name" exceeds 40 chars`.
  - `the prompt embeds every limit and allowlist` : `buildTeamPrompt` contient `4000`, `--model`, `md-audit`, chaque `MCP_CATALOG[i].id`, et le chemin du repo.
  - `round 2 carries analysis and answers`.
  - `parseTeamResponse reads JSON wrapped in prose and fences`.
  - `parseTeamResponse caps questions at 3 and analysis at 6000`.
  - `parseTeamResponse keeps invalid agents apart` : un agent valide + un avec `commandFlags: ['--dangerously-skip-permissions']` → 1 dans `agents`, 1 dans `invalid` avec son nom et l'erreur.
  - `parseTeamResponse reports non-JSON as error`.
- [ ] **Step 2: Lancer** `node --test test/team-prompt.test.cjs test/hire-validator-parity.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat(team): prompt et parseur de composition d'équipe`

### Task 8: Exécution main (analyse cachée, écriture des fichiers)

**Files:**
- Create: `src/main/teamComposer.ts`
- Modify: `src/main/index.ts` (IPC), `src/preload/index.ts`
- Test: `test/team-composer.test.cjs`

**Interfaces:**
- Consumes: Task 7 ; `runHiddenClaude` ; `repoSlug` (Task 1).
- Produces:
  - `runTeamAnalysis(input: TeamPromptInput, run: (prompt: string) => Promise<{ ok: boolean; text?: string; error?: string }>): Promise<TeamResponse>` — appelle `run(buildTeamPrompt(input))` ; si `parseTeamResponse` → `error`, **une** relance avec le prompt suivi de « Ta réponse précédente n'était pas un JSON valide : réponds uniquement avec l'objet JSON demandé. » ; second échec → `{ kind:'error', error }` lisible.
  - `writeTeamHires(home: string, repoRoot: string, manifests: HireManifest[], now?: Date): { written: string[]; errors: string[] }` — revalide chaque manifeste ; nom de fichier `<YYYY-MM-DD>-<slug-nom>.json` dans `<home>/hires/<repoSlug>/`, suffixe `-2`, `-3`… en cas de collision ; JSON indenté.
  - IPC / preload :
    - `teamAnalyze(input: Omit<TeamPromptInput, 'defaultModel'>): Promise<TeamResponse>` — main fournit `defaultModel` (config), lance `runHiddenClaude(prompt, { model: config.defaultModel ?? 'claude-fable-5', cwd: repoRoot, idleMs: 15000, timeoutMs: 600000 })`. Une seule analyse en cours par repo (deuxième appel → `{ kind:'error', error:'analysis already running' }`).
    - `teamCancel(repoRoot: string): void` — tue la session cachée en cours (ajouter un `AbortSignal` optionnel à `HiddenClaudeOptions` qui déclenche le kill existant).
    - `teamPrompt(input): Promise<string>` — `buildTeamPrompt` côté main (pour « Copier le prompt »).
    - `teamWrite(repoRoot: string, manifests: HireManifest[]): Promise<{ written: string[]; errors: string[] }>`
    - `teamOpenFolder(repoRoot: string): void` — `shell.openPath` du dossier hires du repo.

- [ ] **Step 1: Écrire les tests** (`run` simulé) :
  - `a valid first answer needs no retry` (run appelé 1 fois).
  - `invalid JSON is retried once then reported` (run appelé 2 fois, `kind:'error'`).
  - `writeTeamHires writes one file per manifest under hires/<slug>` et `does not overwrite on name collision` (2 × « Jim » → `…-jim.json` et `…-jim-2.json`).
  - `writeTeamHires rejects a manifest that fails validation` (dans `errors`, rien d'écrit pour lui).
  - `runHiddenClaude honours an abort signal` : test source (le signal déclenche le chemin `ensureKilled`).
- [ ] **Step 2: Lancer** `node --test test/team-composer.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** `npm run typecheck && npm run test:focused` → seul l'échec préexistant.
- [ ] **Step 5: Commit** `feat(team): analyse en arrière-plan et écriture des manifestes`

### Task 9: Modale « Composer l'équipe »

**Files:**
- Create: `src/renderer/src/components/ComposeTeamModal.tsx`
- Modify: `src/renderer/src/App.tsx` (bouton dans l'en-tête de l'étage + bouton principal sur l'écran « Empty floor »), `src/renderer/src/store/store.ts` (`composeTeamOpen: boolean`, `setComposeTeamOpen`), `src/renderer/src/i18n/locales/en.json`
- Test: `test/compose-team-flow.test.cjs` sur la machine d'états pure

**Interfaces:**
- Consumes: preload de Task 8, `parseTeamResponse` (mode collé), `enqueuePendingHires`, `setAddAgentOpen`.
- Produces:
  - `src/renderer/src/components/composeTeamFlow.ts` (pure) : `type ComposeStep = 'idle' | 'analyzing' | 'questions' | 'proposal' | 'written' | 'error'` et `nextStep(step: ComposeStep, res: TeamResponse): ComposeStep` (`questions` → `questions`, `agents` → `proposal`, `error` → `error`).
  - Modale, deux onglets : **Automatique** et **Manuel**.
    - Automatique : « Analyser » → `teamAnalyze({ repoRoot: floorRepo, round: 1, existingAgents })` avec spinner + « Annuler » (`teamCancel`). Questions → un champ texte par question, « Continuer » → round 2 avec `analysis` + `answers`.
    - Manuel : « Copier le prompt » (`teamPrompt` → presse-papiers), zone « Coller la réponse » → `parseTeamResponse` local ; si questions → afficher les champs puis « Copier le prompt du 2ᵉ tour ».
    - Proposition (commune) : une carte par agent, cochée par défaut, champs `name`/`description`/`goal`/`provider`/`model`/`isolate` éditables avec compteur `n / HIRE_LIMITS.x` (rouge si dépassé), ligne « pourquoi » ; cartes `invalid` affichées décochées avec l'erreur.
    - « Écrire les fichiers » → `teamWrite(floorRepo, cochés revalidés)` → étape `written` : liste des fichiers, erreurs éventuelles, boutons « Importer maintenant » (`enqueuePendingHires(manifests écrits)` puis `setAddAgentOpen(true)`, fermeture de la modale) et « Ouvrir le dossier » (`teamOpenFolder`).
  - `existingAgents` = agents non-god du store de l'étage (`name`, `description`).

- [ ] **Step 1: Écrire les tests** de `nextStep` (3 cas) et `existing agents exclude god`.
- [ ] **Step 2: Lancer** `node --test test/compose-team-flow.test.cjs` → FAIL.
- [ ] **Step 3: Implémenter** flux, modale, boutons, clés i18n (`team.*`).
- [ ] **Step 4: Lancer** `npm run typecheck && npm run test:focused` → seul l'échec préexistant.
- [ ] **Step 5: Vérification manuelle** (`npm run dev`, Node 22) sur un vrai repo : analyse → 0-3 questions → cartes → écrire → fichiers présents dans `<harnessHome>/hires/<slug>/` → « Importer maintenant » ouvre la revue sur le 1ᵉʳ agent ; `git status` du repo analysé reste propre ; mode manuel avec une réponse collée produit les mêmes cartes ; annulation pendant l'analyse ne laisse aucun process `claude` orphelin (`ps aux | grep claude`).
- [ ] **Step 6: Commit** `feat(ui): modale Composer l'équipe`
