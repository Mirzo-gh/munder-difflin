/**
 * One-time split of the legacy shared `<home>/roster.json` into per-repo
 * rosters (`<home>/rosters/<slug>.json`). The legacy file is never modified or
 * deleted; a `.migrated` marker makes the migration run once.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { RosterStore, repoRosterPath, rosterPath, type RosterSnapshot } from './roster';

type AgentLike = { id?: unknown; cwd?: unknown; worktreePath?: unknown; isGod?: unknown; project?: unknown };
export type ResolveRepo = (agent: { cwd?: string; worktreePath?: string }) => Promise<string | null>;

/** Where an agent goes when its own folder can't be resolved. Group keys are
 *  never a path missing on disk: an isolated agent's cwd IS its worktree, which
 *  may be gone, and a roster keyed by a dead path is a floor nobody can open. */
export interface MigrationFallback {
  /** The harness home folder: always exists, the "no repo" floor. */
  home: string;
  /** Normalized registered repos; an agent's `project` name is matched against
   *  their basenames and used only when exactly one matches. */
  registeredRepos: string[];
  /** Injected for tests; defaults to `existsSync`. */
  exists?: (p: string) => boolean;
}

const LISTS = ['agents', 'archived', 'restorable'] as const;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function projectRepo(project: string | undefined, repos: string[], exists: (p: string) => boolean): string | null {
  if (!project) return null;
  const matches = [...new Set(repos)].filter((r) => basename(r) === project && exists(r));
  return matches.length === 1 ? matches[0] : null;
}

export async function planLegacyMigration(
  legacy: RosterSnapshot,
  resolveRepo: ResolveRepo,
  fallback?: MigrationFallback
): Promise<Map<string, RosterSnapshot>> {
  const exists = fallback?.exists ?? existsSync;
  const groups = new Map<string, RosterSnapshot>();
  const gods: Record<(typeof LISTS)[number], unknown[]> = { agents: [], archived: [], restorable: [] };
  const repoOfId = new Map<string, string>();
  const godIds = new Set<string>();

  const group = (repo: string): RosterSnapshot => {
    let g = groups.get(repo);
    if (!g) {
      g = { version: 1, savedAt: legacy.savedAt, agents: [], archived: [], restorable: [], queues: {}, selectedId: null };
      groups.set(repo, g);
    }
    return g;
  };

  for (const list of LISTS) {
    for (const entry of (legacy[list] ?? []) as AgentLike[]) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.isGod === true) {
        gods[list].push(entry);
        const gid = str(entry.id);
        if (gid) godIds.add(gid);
        continue;
      }
      const cwd = str(entry.cwd);
      const worktreePath = str(entry.worktreePath);
      let repo: string | null = null;
      try { repo = await resolveRepo({ cwd, worktreePath }); } catch { repo = null; }
      if (repo && !exists(repo)) repo = null;
      if (!repo && fallback) {
        repo = projectRepo(str(entry.project), fallback.registeredRepos, exists)
          ?? (exists(fallback.home) ? fallback.home : null);
      }
      if (!repo) continue; // no fallback: stays in roster.json only
      group(repo)[list].push(entry);
      const id = str(entry.id);
      if (id) repoOfId.set(id, repo);
    }
  }

  // God is copied into groups that exist from non-god agents; never creates one.
  for (const g of groups.values()) {
    for (const list of LISTS) g[list] = [...gods[list], ...g[list]];
  }

  for (const [id, q] of Object.entries(legacy.queues ?? {})) {
    if (godIds.has(id)) {
      for (const g of groups.values()) g.queues[id] = q;
      continue;
    }
    const repo = repoOfId.get(id);
    if (repo) group(repo).queues[id] = q;
  }
  if (legacy.selectedId) {
    if (godIds.has(legacy.selectedId)) {
      for (const g of groups.values()) g.selectedId = legacy.selectedId;
    } else {
      const repo = repoOfId.get(legacy.selectedId);
      if (repo) group(repo).selectedId = legacy.selectedId;
    }
  }
  return groups;
}

export async function migrateLegacyRoster(
  home: string,
  resolveRepo: ResolveRepo,
  fallback: Partial<MigrationFallback> = {}
): Promise<{ migrated: boolean; repos: string[] }> {
  const marker = join(home, 'rosters', '.migrated');
  const legacyFile = rosterPath(home);
  if (!existsSync(legacyFile) || existsSync(marker)) return { migrated: false, repos: [] };

  let legacy: RosterSnapshot;
  try {
    legacy = JSON.parse(readFileSync(legacyFile, 'utf8')) as RosterSnapshot;
  } catch {
    return { migrated: false, repos: [] };
  }
  if (!legacy || typeof legacy !== 'object') return { migrated: false, repos: [] };

  const plan = await planLegacyMigration(legacy, resolveRepo, {
    home: fallback.home ?? home,
    registeredRepos: fallback.registeredRepos ?? [],
    exists: fallback.exists
  });
  const repos: string[] = [];
  for (const [repoRoot, snap] of plan) {
    // Never overwrite a repo roster that already exists (retry after a partial
    // migration, or one the user has since modified).
    if (existsSync(repoRosterPath(home, repoRoot))) continue;
    const res = new RosterStore(() => home, repoRoot).write(snap);
    if (!res.ok) return { migrated: false, repos }; // no marker: retried next launch
    repos.push(repoRoot);
  }
  try {
    mkdirSync(join(home, 'rosters'), { recursive: true });
    writeFileSync(marker, new Date().toISOString(), 'utf8');
  } catch { /* rosters are written; a missing marker only means a harmless no-overwrite retry */ }
  return { migrated: true, repos };
}
