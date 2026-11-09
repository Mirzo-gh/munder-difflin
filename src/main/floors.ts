import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { expandTilde } from './fs';

/**
 * Canonical repo root for a floor: `~` expanded, absolute, symlinks resolved,
 * no trailing slash. Subfolders and linked worktrees collapse to the main repo
 * root via `mainRoot`. Null when the folder does not exist.
 */
export async function normalizeFloorRepo(
  path: string,
  mainRoot: (p: string) => Promise<string | null>
): Promise<string | null> {
  const abs = resolve(expandTilde(path));
  if (!existsSync(abs)) return null;
  let real = abs;
  try {
    real = realpathSync(abs);
  } catch {
    /* keep abs */
  }
  const root = await mainRoot(real);
  if (!root) return real;
  try {
    return realpathSync(resolve(root));
  } catch {
    return resolve(root);
  }
}

/** window (webContents id) <-> repo registry. One repo = at most one window. */
export class FloorRegistry {
  private byOwner = new Map<number, string>();

  bind(ownerId: number, repoRoot: string): { ok: true } | { ok: false; ownerId: number } {
    const other = this.ownerOf(repoRoot);
    if (other !== null && other !== ownerId) return { ok: false, ownerId: other };
    this.byOwner.delete(ownerId);
    this.byOwner.set(ownerId, repoRoot);
    return { ok: true };
  }

  unbind(ownerId: number): void {
    this.byOwner.delete(ownerId);
  }

  repoOf(ownerId: number): string | null {
    return this.byOwner.get(ownerId) ?? null;
  }

  ownerOf(repoRoot: string): number | null {
    for (const [id, repo] of this.byOwner) if (repo === repoRoot) return id;
    return null;
  }

  openRepos(): string[] {
    return [...this.byOwner.values()];
  }
}
