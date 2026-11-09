/**
 * Pure state helpers for the "Compose the team" modal. No React, no window,
 * no I/O — loaded directly by test/compose-team-flow.test.cjs.
 */
import type { TeamResponse } from '@shared/teamPrompt';
import { HIRE_SPEC_V1, validateHireManifest, type HireManifest } from '@shared/hire';

export type ComposeStep = 'idle' | 'analyzing' | 'questions' | 'proposal' | 'written' | 'error';

/** Where an analysis (automatic) or a pasted answer (manual) leads. */
export function nextStep(_step: ComposeStep, res: TeamResponse): ComposeStep {
  switch (res.kind) {
    case 'questions': return 'questions';
    case 'agents': return 'proposal';
    default: return 'error';
  }
}

/** The floor's current team as the prompt sees it: every non-god agent. */
export function existingAgentsOf(
  agents: readonly { name: string; description?: string; isGod?: boolean }[]
): { name: string; description?: string }[] {
  return agents.filter((a) => !a.isGod).map((a) => ({ name: a.name, description: a.description }));
}

export interface ComposeCard {
  manifest: HireManifest;
  why: string;
  checked: boolean;
  /** True for an agent the parser rejected: shown unchecked, not writable. */
  invalid: boolean;
  errors: string[];
}

/** One card per proposed agent (checked), then one per rejected agent (unchecked). */
export function cardsFromResponse(res: TeamResponse): ComposeCard[] {
  if (res.kind !== 'agents') return [];
  return [
    ...res.agents.map((a) => ({ manifest: a.manifest, why: a.why, checked: true, invalid: false, errors: [] })),
    ...res.invalid.map((x) => ({
      manifest: { spec: HIRE_SPEC_V1, name: x.name ?? '?' } as HireManifest,
      why: '',
      checked: false,
      invalid: true,
      errors: x.errors
    }))
  ];
}

/** Revalidates the checked, edited cards. `manifests` are the ones to send;
 *  `cardErrors[i]` holds card i's errors (empty when it passed or is unchecked). */
export function prepareWrite(cards: readonly ComposeCard[]): { manifests: HireManifest[]; cardErrors: string[][] } {
  const manifests: HireManifest[] = [];
  const cardErrors = cards.map((c) => {
    if (!c.checked || c.invalid) return c.invalid ? c.errors : [];
    const v = validateHireManifest(c.manifest);
    if (v.ok && v.manifest) { manifests.push(v.manifest); return []; }
    return v.errors;
  });
  return { manifests, cardErrors };
}
