# Fork perso : monogrammes, mise en page sans bureau, sans mode vocal

Date : 2026-11-05 · Auteur : Valentin Estreguil (avec Claude)

## Intention

Fork personnel de Munder Difflin. Deux irritants :

1. Les têtes d'agent en pixel art sont jugées moches.
2. La vue « bureau » où les agents se déplacent n'apporte rien et prend la plus grande zone de l'écran.

On remplace les têtes par un monogramme sobre, on supprime le bureau, et on profite de la place pour mettre la liste d'agents (aujourd'hui en bas) en colonne à gauche. On retire aussi le mode vocal du boss, inutilisé, dont le compteur en dollars inquiète pour rien (l'usage Claude se fait sur abonnement).

## Objectifs

- **Monogramme façon terminal** à la place de chaque `SpritePortrait`.
- **Suppression du bureau animé** (scène Pixi, personnages, bulles, enveloppes, thèmes de bureau).
- **Colonne d'agents à gauche** avec les cartes complètes empilées ; le panneau de l'agent sélectionné (terminal) occupe tout le reste.
- **Suppression du mode vocal** (« Realtime Michael ») et de la dictée Free Flow.
- **Habillage sobre façon Orca**, thème sombre par défaut, à la place du pixel art.
- **Moins de bruit dans le terminal de l'agent principal** : consigne d'inbox courte, compte rendu court, plus de retour forcé en bas.

## Non-objectifs

- L'interruption de la saisie de l'utilisateur par une consigne automatique : une protection existe déjà (`isTerminalAutomationSafe`, `terminalPool.ts`) ; son défaut n'a pas pu être caractérisé et l'utilisateur a écarté ce point.
- Un fil d'affichage des messages bruts entre agents : l'utilisateur ne veut pas voir cette « tambouille interne ».
- La barre de commande sous le terminal : l'utilisateur s'en sert peu, mais on la garde telle quelle.
- Nettoyer le modèle de données des agents.

## Anti-objectifs

- Casser les équipes déjà sauvegardées ou la restauration d'équipe : le champ `Agent.character` (`OfficeCharacterName`) **reste** dans le store et dans la persistance, même s'il n'est plus affiché.
- Perdre une info aujourd'hui visible sur une carte d'agent (statut, projet / action, note, jauge de contexte, tâches en cours, renommage, réordonnancement).
- Diverger de l'upstream plus que nécessaire dans les fichiers partagés. L'utilisateur accepte qu'on supprime franchement le code mort (les conflits de suppression se résolvent facilement), mais les fichiers modifiés doivent rester lisibles par rapport à l'upstream.

## Contraintes

- App Electron + React (electron-vite), TypeScript. `npm run typecheck` et `npm run test:focused` doivent passer.
- Couleurs via les tokens existants (`--cth-<accent>`, `--cth-ink-900`, etc., cf. `DESIGN.md`) ; accents disponibles : `AccentColorName` dans `src/renderer/src/design/tokens.ts`.
- Textes UI via i18n (`react-i18next`) comme le reste de l'app.

## Chantier 1 : monogramme

**Décidé avec l'utilisateur :**

- Carré sombre (`#262626` en thème sombre, `#171717` en thème clair, cf. chantier 4), coins arrondis (environ 7px à 30px de côté), deux lettres en police mono (`--cth-font-mono`, SF Mono après le chantier 4), teintées de la couleur d'accent de l'agent (`--cth-<accent>`). Rendu validé sur maquette : par exemple « ji » en turquoise pour Jim.
- Lettres dérivées du **nom de l'agent**, sans inférence de rôle.

**Choix de Claude :**

- Nouveau composant `AgentMonogram` (`src/renderer/src/components/AgentMonogram.tsx`), props `name`, `accent`, `size`. Il remplace `SpritePortrait` à chaque usage :
  - `AgentCard.tsx`
  - `AgentDetailPanel.tsx`
  - `CommandCenterPanel.tsx` (3 usages)
  - `FullscreenTerminal.tsx`
  - `AddAgentModal.tsx`, `EditAgentModal.tsx` (sélecteurs de personnage)
  - `OnboardingWizard.tsx` (portrait de Michael, 2 usages)
- Règle des lettres : en minuscules ; deux mots ou plus → initiales des deux premiers ; un seul mot → ses deux premières lettres ; une seule lettre → cette lettre ; aucun caractère alphanumérique → « ?? ». Le monogramme suit les renommages.
- Le carré est **pixel-net** : pas d'anti-crénelage particulier, mais pas de rendu `pixelated`.
- **Sélecteurs de personnage** dans `AddAgentModal` / `EditAgentModal` : on retire la grille de personnages. Seuls le nom et l'accent comptent ; un aperçu du monogramme s'affiche à côté du champ nom. À la création, `character` prend une valeur par défaut (`DEFAULT_CHARACTER` ou la logique d'attribution existante) ; à l'édition, il reste inchangé.
- Dans l'onboarding, le portrait de Michael devient le monogramme du nom du boss configuré (ou « mi » à défaut).
- `SpritePortrait.tsx` est supprimé. `portraitArt.ts` et `paintCastPortrait` sont supprimés s'ils n'ont plus d'usage après le chantier 2.

## Chantier 2 : mise en page sans bureau, sans vocal

**Décidé avec l'utilisateur :**

- Disposition (maquette « A, cartes complètes ») : colonne d'agents à gauche (environ 260px), terminal de l'agent sélectionné à droite sur toute la largeur restante.
- Cartes complètes empilées verticalement : monogramme, nom (renommable), statut, projet / action, note, jauge de contexte, pastille de tâches en cours.
- Le bureau disparaît entièrement, y compris le sélecteur de thème de bureau.
- Le mode vocal disparaît : bouton voix, compteur en dollars (carte du boss, en-tête du mode focus, réglages).

**Choix de Claude :**

- **`App.tsx`** : la zone principale devient `[colonne d'agents] [splitter] [AgentDetailPanel ou état vide]`. `AgentStrip` n'est plus monté en bas de l'écran ; on le transforme en colonne verticale (ou on crée un `AgentColumn`, au choix du constructeur), avec défilement vertical. Le `SidebarSplitter` existant passe entre la colonne et le terminal et règle désormais la largeur de **la colonne** (aujourd'hui il stocke celle du panneau terminal) : défaut 260, sous une nouvelle clé de persistance pour ne pas réinterpréter l'ancienne valeur.
- Dans la colonne :
  - Le glisser-déposer reste, avec une ligne d'insertion horizontale (en haut de la cible) au lieu de verticale.
  - « Ajouter un agent », « Tout restaurer » et les agents congédiés restent dans la colonne, en bas.
  - Le popover d'édition de note s'ouvre à droite de la carte au lieu d'au-dessus.
  - Les cartes prennent toute la largeur de la colonne (largeur fixe actuelle remplacée par 100 %).
- **États vides** : le message « EMPTY FLOOR » (aucun agent) et `MichaelBooting` s'affichent dans la zone de droite, à la place des panneaux « NO AGENT SELECTED » et « WAKING THE FLOOR » actuels. `MemoryPanel` s'ouvre en surimpression de la zone de droite.
- **Code du bureau** à supprimer :
  - `src/renderer/src/scene/office/*`, sauf ce qui reste importé ailleurs. `cast.ts` garde au minimum `OfficeCharacterName`, `OFFICE_CAST`, `DEFAULT_CHARACTER`, nécessaires au store et à la persistance ; tout ce qui sert au rendu Pixi part.
  - `OfficeThemePicker.tsx` et son entrée dans `SettingsModal`.
  - La synchro du thème de bureau dans `App.tsx`.
  - La dépendance `pixi.js` si plus rien ne l'importe.
  - Les champs du store propres à la scène (`currentStation`, `carrying`…) restent (non-objectif).
  - Le compteur « Ask Me » du tableau blanc et les raccourcis cliquables du bureau vers les onglets triggers / tâches / Ask Me disparaissent sans remplacement (décidé avec l'utilisateur, qui ne s'en sert pas) ; ces onglets restent accessibles via le Command Center.
- **Vocal** à supprimer côté interface :
  - `RealtimeMichaelToggle`, tout le dossier `src/renderer/src/realtime/` (dont `CostHud`, `DevicePicker`, `CompletionToast`, `session.ts`, `tools.ts`, `actions.ts`, `costStore.ts`), le bloc Realtime Michael de l'onglet « Voice » de `SettingsModal` et l'appel `realtimeHasOpenAiKey` dans `App.tsx`.
  - **Dictée Free Flow** (décidé avec l'utilisateur : supprimée aussi) : bouton micro et indice de configuration dans `MessageQueueComposer`, maintien de ⌥ pour parler (`useHoldOptionToTalk`, `src/renderer/src/freeflow/`), drapeaux associés du store et de la config, `src/main/freeflow.ts`, IPC et preload correspondants, gestion de la permission micro dans `main/index.ts`. L'onglet « Voice » de `SettingsModal` disparaît entièrement. **Attention :** `groq.ts` et la clé Groq servent peut-être aussi à autre chose (références dans `hive.ts`, `AiEnginesSettings.tsx`, `ossModels.ts`) ; on ne retire que ce qui est propre à la dictée.
  - Sur la carte du boss, la ligne voix + coût disparaît. On garde la mise en forme « BOSS » ; la ligne libérée peut accueillir la note comme sur les autres cartes.
  - Côté main process (`src/main/realtime*.ts`, IPC associés) : à supprimer si c'est séparable proprement, sinon laisser inerte. Au choix du constructeur ; le critère est que le typecheck passe et qu'aucune UI vocale ne reste.

## Chantier 3 : messages vers l'agent principal, moins de bruit

Contexte : les autres agents écrivent dans la boîte de réception de l'agent principal (god). Quand il est au repos, le renderer tape dans son terminal la consigne `inboxNudgeText` (`src/shared/hiveNudge.ts`), un long paragraphe anglais « You have new hive inbox message(s)… », puis Entrée. God lit alors tout d'un coup et répond en un gros bloc, et le terminal ramène l'utilisateur en bas même s'il était remonté pour lire.

**Décidé avec l'utilisateur :**

- Ce qui compte, c'est l'**interprétation** de god, pas les messages bruts.
- La consigne « new hive inbox message » agace et doit être réduite au minimum.
- Ne plus être ramené en bas de force quand on est remonté pour lire.

**Choix de Claude :**

- **Compte rendu court** : on ajoute au prompt injecté de god (`injectedPrompt`, `src/main/hive.ts`, branche god) une consigne. Quand il traite sa boîte, il ne recopie pas les messages reçus ; il termine par un compte rendu de 1 à 3 lignes pour l'humain (qui a dit quoi en substance, ce qu'il a décidé ou relancé), en français. Les workers ne sont pas concernés.
- **Claude uniquement** (décidé avec l'utilisateur, qui ne fait tourner que des agents Claude) : le prompt injecté passe par `--append-system-prompt` et persiste toute la session, donc la consigne courte suffit. Pas de branche par provider : les autres providers ne sont pas une cible de ce fork.
- **Consigne raccourcie** : `inboxNudgeText` devient une ligne courte, par exemple `📬 inbox: <ids>`. Les instructions détaillées actuellement portées par la consigne (lire la boîte, traiter ce qui est en attente, déplacer dans `inbox/.done/`, la boîte fait foi, ignorer un id déjà traité) passent dans le prompt injecté de **tous** les agents, pour que le comportement reste identique. `isInboxNudge` doit reconnaître la nouvelle tête ; le nudge watchdog côté main (`nudgeWorker`, `src/main/index.ts`) utilise la même fonction. Attention à garder un texte sur une seule ligne (pas de bracketed paste, cf. `submitToPty`). L'emoji est au choix du constructeur s'il pose problème à un TUI.
- **On ne réintroduit pas** la livraison par hook `Stop` : elle a été retirée volontairement en amont (`src/main/hooks.ts`, contournait la protection brouillon / HITL et dépensait des crédits).
- **Scroll** : quand l'utilisateur a remonté le terminal (viewport au-dessus du bas), aucune sortie entrante ne doit le ramener en bas. Un bouton flottant « nouveau contenu ↓ » apparaît en bas du terminal ; il défile jusqu'en bas et disparaît. Revenir en bas manuellement le masque aussi. La cause exacte du saut (repaint du TUI Claude, `scrollToBottom` dans `PtyTerminalView.tsx` / `terminalPool.ts`, ou comportement par défaut de xterm) **doit être identifiée avant de corriger**. Note : `shouldFollowTerminalOutput` (`terminalPool.ts`) bloque déjà le suivi quand on est remonté, donc le saut vient probablement d'ailleurs. Le comportement s'applique à tous les terminaux d'agent, pas seulement à god.
  - *Choix de Claude :* « nouveau contenu » = de nouvelles lignes ajoutées au scrollback, pas un repaint d'écran (spinner, ligne de statut).
  - *Choix de Claude :* si la cause est le TUI lui-même (effacement du scrollback, redessin plein écran), on **ne réécrit pas** les séquences d'échappement et on ne bufferise pas la sortie. On s'arrête, on documente la cause et on revient vers l'utilisateur avec les options.

## Chantier 4 : habillage sobre façon Orca

**Décidé avec l'utilisateur :**

- Abandon du style pixel art / rétro dans toute l'app, au profit d'un look sobre d'outil de travail, inspiré d'**Orca** (installé sur la machine, `/Applications/Orca.app`).
- Maquette validée : **thème sombre** (maquette « A, sombre » de la session de brainstorming, `.superpowers/brainstorm/*/content/orca-style.html`).

**Référence Orca** (relevée dans son CSS, palette neutre type shadcn) :

| Rôle | Sombre | Clair |
|---|---|---|
| Fond app / terminal | `#0a0a0a` | `#ffffff` |
| Colonne latérale, cartes, popovers | `#171717` | `#fafafa` / `#ffffff` |
| Surface atténuée, sélection, monogramme | `#262626` | `#f5f5f5` (monogramme `#171717`) |
| Texte | `#fafafa` | `#0a0a0a` |
| Texte secondaire | `#a1a1a1` | `#737373` |
| Bordures | `#ffffff12` | `#e5e5e5` |
| Champs de saisie | `#ffffff26` | `#e5e5e5` |
| Anneau de focus | `#737373` | `#a1a1a1` |

- Polices : `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` pour l'UI ; `"SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace` pour le code, les terminaux et le monogramme.
- Rayon : 10px (panneaux), 6 à 8px (boutons, cartes), bordures 1px.
- Statuts : travaille = jaune `#edb200`, attend l'humain = orange `#f05100`, au repos = gris (`#525252` en sombre), erreur ou bloqué = rouge `#fb2c36`, succès = vert `#00c758`.

**Choix de Claude :**

- **Thème sombre par défaut.** Le thème clair existant (`src/renderer/src/design/theme.ts`) reste disponible avec la palette claire d'Orca ; le coût est faible puisque ce ne sont que des valeurs de tokens.
- **On garde les noms de tokens et de composants** pour limiter la divergence avec l'upstream : on redéfinit les **valeurs** des variables `--cth-*` (crème → surfaces neutres, encre → gris de texte) pour les deux thèmes, et on réécrit l'**intérieur** de `PixelPanel`, `PixelButton` et `PixelBadge` (1px de bordure, coins arrondis, pas de bordure à trois couches ni d'ombre en escalier) sans changer leurs props.
- **Les accents d'agent** (`coral`, `mint`, `sky`, `lemon`, `lilac`, `peach`) sont remappés vers des teintes Orca lisibles sur fond sombre (par exemple `sky` → `#00bcfe`, `mint` → `#00d294`, `lemon` → `#fcbb00`, `coral` → `#ff667f`, `lilac` → `#a685ff`, `peach` → `#ff8b1a`). Ils ne servent qu'aux lettres du monogramme et à de rares surlignages, plus jamais en fond de carte.
- **Les polices pixel** (`Press Start 2P`, `Pixelify Sans`, `VT323`, embarquées localement, cf. `src/renderer/index.html`) sont retirées. Geist est embarquée localement de la même manière (pas de Google Fonts, bloqué dans certains environnements selon le commentaire de `index.html`), sinon on se rabat sur la pile système. Les variables `--cth-font-display`, `--cth-font-ui` et `--cth-font-mono` pointent vers les nouvelles piles. Les tailles « display » (8 à 16px, calibrées pour la police pixel) sont réajustées (environ 11 à 15px) et les libellés en MAJUSCULES forcées passent en casse normale.
- **Animations** : les transitions `steps(…)` deviennent des transitions douces et courtes (environ 120 à 150ms, `ease-out`).
- **Cartes d'agent** dans la colonne (cf. maquette) : lignes sans bordure, fond `--muted` pour l'agent sélectionné, nom en 13px medium, pastille de statut ronde à droite, étiquette « boss » discrète, sous-ligne action / projet, note en italique, jauge de contexte fine (3px, grise). Toutes les infos du chantier 2 restent.
- **Terminaux xterm** : thème sombre sur fond `#0a0a0a` avec police SF Mono ; thème clair sur fond blanc.
- **Styles en ligne** : beaucoup de composants codent en dur des styles pixel (tailles 7 à 10px, `fontFamily: 'var(--cth-font-display)'`, ombres en escalier, `imageRendering: 'pixelated'`). Le constructeur balaie le renderer pour les harmoniser. Le critère : plus aucun rendu pixel, rien d'illisible.
- `DESIGN.md` reçoit un court avertissement en tête qui renvoie à ce document pour le fork ; on ne réécrit pas le fichier.

## Laissé au constructeur

- Le nom et le découpage exacts des composants (`AgentColumn` ou réécriture d'`AgentStrip`).
- Le détail visuel du monogramme : rayon, tailles par usage (environ 36px sur la carte, 24px dans les listes compactes du `CommandCenterPanel`).
- La façon de neutraliser les références restantes à la scène, par exemple les actions du store qui pilotaient les personnages.
- Les clés i18n à ajouter ou retirer.

## Vérification

- `npm run typecheck` et `npm run test:focused` passent. Les tests qui ciblaient du code supprimé sont retirés avec lui.
- `npm run dev` : l'app démarre, la colonne d'agents est à gauche, le terminal à droite, aucune scène de bureau ni aucune UI vocale ne reste, et les monogrammes s'affichent partout où il y avait des portraits.
- Une équipe sauvegardée avant le changement se restaure sans erreur.
- Aucune police pixel, bordure à trois couches ou rendu `pixelated` ne reste à l'écran (en-tête, colonne, terminal, Command Center, modales de création / édition / réglages, onboarding) ; rendu conforme à la maquette sombre, et thème clair cohérent.
- Avec un god et au moins un worker : quand le worker envoie un message, la consigne tapée chez god est une ligne courte, god traite la boîte et finit par un compte rendu court. Un worker qui reçoit du courrier le traite toujours correctement avec la consigne courte.
- En remontant dans le terminal de god pendant qu'il produit de la sortie, la vue ne bouge pas et le bouton « nouveau contenu ↓ » apparaît.
