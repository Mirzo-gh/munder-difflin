/** Which store the roster is loaded FROM at boot — the file beside the hive, or
 *  this origin's localStorage.
 *
 *  Split out of store.ts because it is the one decision that has to be right on
 *  every launch and cannot be observed from the UI when it is wrong: the roster
 *  just appears, and nothing says where it came from.
 *
 *  localStorage is partitioned by ORIGIN, not by hive. Every hive this app ever
 *  opens shares exactly one of them, so it can only ever hold the roster of
 *  whichever hive wrote it last. Adopting it into a DIFFERENT hive is how one
 *  workspace's team turns up in another — restorable entries and all, each one
 *  still carrying the `cwd` of the workspace it was hired in. */

export interface RosterCounts {
  agents: unknown[];
  archived: unknown[];
  restorable: unknown[];
}

export interface RosterSourceInput {
  /** The repo this window's floor is bound to (`window.cth.floorRepoSync()`),
   *  or `null` for an unbound window, which shows the repo picker. */
  floorRepo: string | null;
  /** This floor's roster file as read at boot, or `null` when there is none. */
  fileRoster: RosterCounts | null;
  /** The hive this window is opening. `null` before onboarding picks one. */
  currentHome: string | null;
  /** The hive localStorage was last written for, or `null` when it predates the
   *  stamp (an install that upgraded into this behaviour). */
  storedHome: string | null;
}

export interface RosterSource {
  /** Load the slices out of the file. */
  useFileRoster: boolean;
  /** Load the slices out of localStorage. Always false since per-repo floors
   *  (see `chooseRosterSource`); kept so the store's loading code stays as is. */
  useLocalFallback: boolean;
}

/** Whether the file actually holds a roster (any of the three slices). */
function fileHasRoster(file: RosterCounts | null): boolean {
  return !!file
    && file.agents.length + file.archived.length + file.restorable.length > 0;
}

export function chooseRosterSource({
  floorRepo,
  fileRoster
}: RosterSourceInput): RosterSource {
  // Unbound window: main serves no roster and refuses writes; the window shows
  // the repo picker. Nothing may be loaded onto it, from either store.
  if (floorRepo === null) return { useFileRoster: false, useLocalFallback: false };

  // Bound window: its repo's roster file, or nothing. localStorage is shared by
  // every window of this origin — every floor, every repo — so it holds the
  // team of whichever floor saved last, possibly another repo's. Upgraders are
  // covered by main migrating the old shared roster into the per-repo files,
  // not by adopting localStorage here. (`currentHome`/`storedHome` therefore no
  // longer decide anything; the stamp is still written for older builds.)
  return { useFileRoster: fileHasRoster(fileRoster), useLocalFallback: false };
}
