import { realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { getBranch, mainRepoRoot, runGit } from './git';

/** Which project an agent works on, and whether it sits in its own worktree. */
export interface ProjectInfo {
  repoRoot: string;
  isGit: boolean;
  isolated: boolean;
  worktreePath?: string;
  branch?: string;
  baseBranch?: string;
}

function canon(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}

export async function resolveProjectInfo(
  cwd: string,
  hint?: { baseBranch?: string }
): Promise<ProjectInfo> {
  const root = await mainRepoRoot(cwd);
  if (!root) return { repoRoot: canon(cwd), isGit: false, isolated: false };
  const repoRoot = canon(root);
  const top = await runGit(cwd, ['rev-parse', '--show-toplevel']);
  const toplevel = top.ok ? canon(top.stdout.trim()) : repoRoot;
  const isolated = toplevel !== repoRoot;
  const br = await getBranch(cwd);
  const info: ProjectInfo = { repoRoot, isGit: true, isolated };
  if (isolated) info.worktreePath = toplevel;
  if ('current' in br && br.current) info.branch = br.current;
  if (hint?.baseBranch) info.baseBranch = hint.baseBranch;
  return info;
}

/** Agent-facing description (French, like the rest of identity.md prose). */
export function projectBlock(info: ProjectInfo): string {
  if (!info.isGit) return `Projet : \`${info.repoRoot}\`.`;
  const head = `Projet : \`${basename(info.repoRoot)}\` (\`${info.repoRoot}\`).`;
  if (!info.isolated) {
    return `${head} Tu travailles directement dans ce repo, branche \`${info.branch ?? 'inconnue'}\`. D'autres agents peuvent travailler dans le même arbre.`;
  }
  const from = info.baseBranch ? ` créée depuis \`${info.baseBranch}\`` : '';
  return `${head} Tu travailles dans un worktree isolé \`${info.worktreePath}\`, branche \`${info.branch ?? 'inconnue'}\`${from}. Tes changements n'arrivent dans le repo qu'une fois mergés.`;
}
