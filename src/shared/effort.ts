/**
 * Reasoning effort per agent. Dependency-free (shared by main, renderer and the
 * hire validator).
 *
 * Only two CLIs take it on the command line:
 *   - Claude Code: `--effort <low|medium|high|xhigh|max>`
 *   - Codex:       `-c model_reasoning_effort=<low|medium|high|xhigh>` (no `max`)
 * Every other provider ignores it — the UI hides the picker there.
 */

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];

export function isEffortLevel(v: unknown): v is EffortLevel {
  return typeof v === 'string' && (EFFORT_LEVELS as readonly string[]).includes(v);
}

/** The levels a provider's CLI accepts; empty = effort unsupported. */
export function effortLevelsFor(provider: string | undefined): readonly EffortLevel[] {
  if (provider === 'claude') return EFFORT_LEVELS;
  if (provider === 'codex') return ['low', 'medium', 'high', 'xhigh'];
  return [];
}

/** The level actually usable with `provider`: unsupported → undefined; a level
 *  above the provider's ceiling is clamped to its highest one (codex `max` → `xhigh`). */
export function effortFor(provider: string | undefined, effort: EffortLevel | undefined): EffortLevel | undefined {
  if (!effort) return undefined;
  const levels = effortLevelsFor(provider);
  if (levels.length === 0) return undefined;
  return levels.includes(effort) ? effort : levels[levels.length - 1];
}

/** Command-line fragment selecting the effort, or '' when it does not apply. */
export function effortArg(provider: string | undefined, effort: EffortLevel | undefined): string {
  const level = effortFor(provider, effort);
  if (!level) return '';
  return provider === 'codex' ? `-c model_reasoning_effort=${level}` : `--effort ${level}`;
}
