import { createHash } from 'node:crypto';
import { basename, join, sep } from 'node:path';

/**
 * Which harness (home folder) a repo works in. A repo is linked to exactly one
 * harness (`config.repoHarnesses`); a repo seen for the first time adopts one:
 *   1. its saved link, if that folder still exists;
 *   2. a known harness (current or recent) named like the repo, unless another
 *      repo already owns it — e.g. repo `Terramorph` → harness `~/munder/Terramorph`;
 *   3. the current harness, if no repo owns it and it holds no team yet (first
 *      launch after onboarding);
 *   4. a new folder named after the repo under `defaultParent` (`~/munder/<repo>`),
 *      suffixed with a short hash when that name is taken (another repo's
 *      harness, a folder that is not a harness, or the repo itself).
 * Pure apart from the injected probes.
 */
export interface HarnessLookup {
  /** repoRoot → harness path. */
  mapping: Record<string, string>;
  current: string | null;
  recents: string[];
  exists: (path: string) => boolean;
  /** True when a harness holds no team at all (no roster, no per-repo rosters). */
  isUnused: (path: string) => boolean;
  /** True when an existing folder is a harness (or empty) and may be adopted. */
  looksLikeHarness: (path: string) => boolean;
  /** Where new harnesses are created (`~/munder`). */
  defaultParent: string;
}

export interface ResolvedHarness {
  harness: string;
  /** The folder does not exist yet and must be created. */
  create: boolean;
}

function shortHash(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 8);
}

export function resolveRepoHarness(repo: string, l: HarnessLookup): ResolvedHarness {
  const linked = l.mapping[repo];
  if (linked && l.exists(linked)) return { harness: linked, create: false };

  const ownedByOther = (h: string): boolean =>
    Object.entries(l.mapping).some(([r, hh]) => r !== repo && hh === h);

  const name = basename(repo);
  const known = [l.current, ...l.recents].filter((h): h is string => !!h);
  const sameName = known.find((h) => basename(h).toLowerCase() === name.toLowerCase() && !ownedByOther(h) && l.exists(h));
  if (sameName) return { harness: sameName, create: false };

  if (l.current && l.exists(l.current) && !ownedByOther(l.current) && l.isUnused(l.current)) {
    return { harness: l.current, create: false };
  }

  const overlaps = (h: string): boolean =>
    h === repo || h.startsWith(repo + sep) || repo.startsWith(h + sep);
  const taken = (h: string): boolean =>
    ownedByOther(h) || overlaps(h) || (l.exists(h) && !l.looksLikeHarness(h));
  let harness = join(l.defaultParent, name);
  if (taken(harness)) harness = join(l.defaultParent, `${name}-${shortHash(repo)}`);
  return { harness, create: !l.exists(harness) };
}

/** The repos whose saved harness is `harness`. */
export function reposOfHarness(mapping: Record<string, string>, harness: string): string[] {
  return Object.entries(mapping).filter(([, h]) => h === harness).map(([r]) => r);
}
