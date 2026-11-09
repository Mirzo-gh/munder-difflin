import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTeamPrompt, parseTeamResponse, type TeamPromptInput, type TeamResponse } from '../shared/teamPrompt';
import { HIRE_LIMITS, validateHireManifest, type HireManifest } from '../shared/hire';
import { repoSlug } from './roster';

export type TeamRunner = (prompt: string) => Promise<{ ok: boolean; text?: string; error?: string }>;

const RETRY_SUFFIX = "\n\nTa réponse précédente n'était pas un JSON valide : réponds uniquement avec l'objet JSON demandé.";

/** Runs the hidden analysis; one retry when the answer is not parseable JSON. */
export async function runTeamAnalysis(input: TeamPromptInput, run: TeamRunner): Promise<TeamResponse> {
  const prompt = buildTeamPrompt(input);
  let last: TeamResponse = { kind: 'error', error: 'no response' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await run(attempt === 0 ? prompt : prompt + RETRY_SUFFIX);
    if (!r.ok || !r.text) {
      last = { kind: 'error', error: r.error ?? 'no response' };
      // A cancelled/timed-out run is not a formatting problem: do not retry.
      if (!r.ok) return last;
      continue;
    }
    const parsed = parseTeamResponse(r.text);
    if (parsed.kind !== 'error') return parsed;
    last = parsed;
  }
  return last;
}

/** Caps on what the renderer may send to the team:* IPC handlers. */
export const TEAM_INPUT_CAPS = {
  existingAgents: 50,
  answers: 3,
  answerChars: 2000,
  analysisChars: 6000,
  manifests: 12
} as const;

/** Untrusted renderer input → a bounded TeamPromptInput for `repoRoot` (the
 *  sender's bound floor repo, never the path the renderer sent). */
export function sanitizeTeamInput(raw: unknown, repoRoot: string, defaultModel?: string): TeamPromptInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const C = TEAM_INPUT_CAPS;
  const o = raw as Partial<TeamPromptInput>;
  const round = o.round === 2 ? 2 : 1;
  const existingAgents = Array.isArray(o.existingAgents)
    ? o.existingAgents
        .filter((a): a is { name: string; description?: string } => !!a && typeof a.name === 'string')
        .slice(0, C.existingAgents)
        .map((a) => ({
          name: a.name.slice(0, 80),
          description: typeof a.description === 'string' ? a.description.slice(0, HIRE_LIMITS.description) : undefined
        }))
    : [];
  const answers = Array.isArray(o.answers)
    ? o.answers
        .filter((a) => !!a && typeof a.question === 'string' && typeof a.answer === 'string')
        .slice(0, C.answers)
        .map((a) => ({ question: a.question.slice(0, C.answerChars), answer: a.answer.slice(0, C.answerChars) }))
    : undefined;
  return {
    repoRoot, existingAgents, round,
    analysis: typeof o.analysis === 'string' ? o.analysis.slice(0, C.analysisChars) : undefined,
    answers,
    defaultModel
  };
}

export function hiresDir(home: string, repoRoot: string): string {
  return join(home, 'hires', repoSlug(repoRoot));
}

function nameSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '') || 'agent';
}

/** Writes each manifest (revalidated) as `<YYYY-MM-DD>-<slug>.json` strictly
 *  under `<home>/hires/<repoSlug>/`; never overwrites an existing file.
 *  `manifests` lists the validated manifests actually written, aligned with `written`. */
export function writeTeamHires(
  home: string,
  repoRoot: string,
  input: HireManifest[],
  now: Date = new Date()
): { written: string[]; errors: string[]; manifests: HireManifest[] } {
  const written: string[] = [];
  const errors: string[] = [];
  const manifests: HireManifest[] = [];
  const dir = hiresDir(home, repoRoot);
  const day = now.toISOString().slice(0, 10);
  for (const raw of input) {
    const v = validateHireManifest(raw);
    if (!v.ok) {
      const nm = raw && typeof (raw as { name?: unknown }).name === 'string' ? (raw as { name: string }).name.slice(0, 40) : '?';
      errors.push(`${nm}: ${v.errors.join('; ')}`);
      continue;
    }
    const manifest = v.manifest;
    if (!manifest) { errors.push('invalid manifest'); continue; }
    try {
      mkdirSync(dir, { recursive: true });
      const base = `${day}-${nameSlug(manifest.name)}`;
      let file = join(dir, `${base}.json`);
      for (let n = 2; existsSync(file); n++) file = join(dir, `${base}-${n}.json`);
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
      written.push(file);
      manifests.push(manifest);
    } catch (e) {
      errors.push(`${manifest.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { written, errors, manifests };
}
