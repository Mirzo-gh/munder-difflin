/**
 * "Compose the team" prompt builder + response parser. Dependency-free and pure
 * (imported by both main and renderer): no node:* imports, no I/O.
 *
 * The prompt is sent to Claude Code running read-only in the repo; its JSON
 * answer is untrusted and every agent goes through `validateHireManifest`.
 */

import {
  BUNDLED_SKILL_IDS,
  HIRE_LIMITS,
  HIRE_PROVIDERS,
  HIRE_SPEC_V1,
  SAFE_FLAG_NAMES,
  validateHireManifest,
  type HireManifest
} from './hire';
import { MCP_CATALOG } from './mcpCatalog';
import { EFFORT_LEVELS, effortLevelsFor } from './effort';

const MAX_ANALYSIS = 6000;
const MAX_QUESTIONS = 3;
const MAX_WHY = 200;

export interface TeamPromptInput {
  repoRoot: string;
  existingAgents: { name: string; description?: string }[];
  defaultModel?: string;
  /** Model ids the app offers per hire provider (from the model catalog), so the
   *  analysis picks real ids per role instead of inventing them. */
  models?: Record<string, string[]>;
  round: 1 | 2;
  analysis?: string;
  answers?: { question: string; answer: string }[];
}

export type TeamResponse =
  | { kind: 'questions'; analysis: string; questions: string[] }
  | { kind: 'agents'; agents: { manifest: HireManifest; why: string }[]; invalid: { name?: string; errors: string[] }[] }
  | { kind: 'error'; error: string };

export function buildTeamPrompt(input: TeamPromptInput): string {
  const L = HIRE_LIMITS;
  const lines: string[] = [];
  lines.push(
    `Tu es un responsable d'équipe technique. Analyse le dépôt situé à : ${input.repoRoot}`,
    '',
    'CONTRAINTES : travaille en LECTURE SEULE. Ne crée, ne modifie et ne supprime aucun fichier, ne lance aucune commande qui écrit dans le dépôt. Lis le code, la documentation et la configuration pour comprendre le projet.',
    '',
    'OBJECTIF : proposer une petite équipe d\'agents IA complémentaires, adaptés à ce projet (stack, conventions, zones à risque, besoins de revue/tests/documentation).',
    ''
  );

  if (input.existingAgents.length > 0) {
    lines.push('Agents déjà présents (ne pas les dupliquer, ni leur rôle) :');
    for (const a of input.existingAgents) lines.push(`- ${a.name}${a.description ? ` : ${a.description}` : ''}`);
    lines.push('');
  }
  lines.push(
    'MODÈLE ET EFFORT PAR RÔLE : pour CHAQUE agent, choisis `provider`, `model` et `effort` selon son rôle.',
    '- Rôles exigeants (architecture, revue, sécurité, débogage difficile, orchestration d\'un domaine) : modèle le plus capable, effort high à max.',
    '- Rôles courants (implémentation guidée, tests, refactors simples) : modèle intermédiaire, effort medium.',
    '- Rôles mécaniques ou volumineux (documentation, tri, mises à jour répétitives) : modèle rapide et économique, effort low.',
    '- Dis en une phrase dans `why` pourquoi ce modèle et cet effort conviennent au rôle.'
  );
  if (input.defaultModel) lines.push(`- Modèle par défaut de l'utilisateur : ${input.defaultModel}.`);
  const models = input.models ?? {};
  const offered = HIRE_PROVIDERS.filter((p) => (models[p] ?? []).length > 0);
  if (offered.length > 0) {
    lines.push('- `model` doit être un de ces ids exacts (n\'en invente pas) :');
    for (const p of offered) lines.push(`  - ${p} : ${(models[p] ?? []).join(', ')}`);
  }
  lines.push('');

  lines.push(
    `SPÉCIFICATION D'UN AGENT (${HIRE_SPEC_V1}) — objet JSON avec ces clés (en anglais) :`,
    `- "spec": "${HIRE_SPEC_V1}" (obligatoire)`,
    `- "name": obligatoire, ≤ ${L.name} caractères`,
    `- "description": ≤ ${L.description} caractères (rôle en une ligne)`,
    `- "goal": ≤ ${L.goal} caractères (mission permanente de l'agent, précise et spécifique au projet)`,
    `- "provider": parmi ${HIRE_PROVIDERS.join(', ')}`,
    `- "model": ≤ ${L.model} caractères`,
    `- "effort": parmi ${EFFORT_LEVELS.join(', ')} (claude : ${effortLevelsFor('claude').join(', ')} ; codex : ${effortLevelsFor('codex').join(', ')} ; ignoré par les autres providers)`,
    `- "commandFlags": ≤ ${L.commandFlags} éléments ; seuls ces flags sont autorisés : ${[...SAFE_FLAG_NAMES].join(', ')} (une valeur peut suivre un flag)`,
    `- "capabilities": ≤ ${L.capabilities} étiquettes de ≤ ${L.capabilityChars} caractères`,
    '- "isolate": booléen (travailler dans un worktree git isolé)',
    '- "tokenCap": entier positif (plafond de tokens)',
    `- "skills": ≤ ${L.skills} ids parmi : ${[...BUNDLED_SKILL_IDS].join(', ')}`,
    `- "mcpServers": ≤ ${L.mcpServers} ids parmi : ${MCP_CATALOG.map(e => `${e.id} (${e.tier})`).join(', ')}`,
    '- Ne PAS renseigner `character`, `accent`, `author`, `homepage`.',
    `- "why": ≤ ${MAX_WHY} caractères, pourquoi cet agent est utile à ce projet (champ en plus du manifeste).`,
    ''
  );

  if (input.round === 1) {
    lines.push(
      'FORMAT DE SORTIE : réponds UNIQUEMENT par un objet JSON strict (pas de texte autour), de l\'une de ces deux formes :',
      `1. Si des questions à l'utilisateur sont vraiment utiles (0 à ${MAX_QUESTIONS} maximum) : {"analysis": "<résumé de ton analyse du projet, ≤ ${MAX_ANALYSIS} caractères>", "questions": ["...", "..."]}`,
      '2. Sinon, directement : {"agents": [ { manifeste hire@1 + "why" }, ... ]}',
      'Propose 2 à 5 agents au plus.'
    );
  } else {
    lines.push(
      'ANALYSE DU PREMIER TOUR :',
      input.analysis ?? '(aucune)',
      '',
      'RÉPONSES DE L\'UTILISATEUR :'
    );
    const answers = input.answers ?? [];
    if (answers.length === 0) lines.push('(aucune)');
    for (const a of answers) lines.push(`- Q : ${a.question}`, `  R : ${a.answer}`);
    lines.push(
      '',
      'FORMAT DE SORTIE : réponds UNIQUEMENT par un objet JSON strict (pas de texte autour) : {"agents": [ { manifeste hire@1 + "why" }, ... ]}. Ne pose plus de questions.',
      'Propose 2 à 5 agents au plus.'
    );
  }
  return lines.join('\n');
}

/** First balanced top-level `{...}` in `text` (string/escape aware), parsed; null if none parses. */
function extractJsonObject(text: string): unknown | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

export function parseTeamResponse(text: string): TeamResponse {
  const obj = extractJsonObject(text);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { kind: 'error', error: 'no JSON object found in the response' };
  }
  const o = obj as Record<string, unknown>;

  if (Array.isArray(o.agents)) {
    const agents: { manifest: HireManifest; why: string }[] = [];
    const invalid: { name?: string; errors: string[] }[] = [];
    for (const raw of o.agents) {
      let why = '';
      let candidate: unknown = raw;
      if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        const { why: w, ...rest } = raw as Record<string, unknown>;
        if (typeof w === 'string') why = w.trim().slice(0, MAX_WHY);
        candidate = rest;
      }
      const v = validateHireManifest(candidate);
      if (v.ok && v.manifest) agents.push({ manifest: v.manifest, why });
      else {
        const n = (candidate as { name?: unknown } | null)?.name;
        invalid.push({ name: typeof n === 'string' ? n : undefined, errors: v.errors });
      }
    }
    return { kind: 'agents', agents, invalid };
  }

  if (Array.isArray(o.questions) || typeof o.analysis === 'string') {
    const questions = (Array.isArray(o.questions) ? o.questions : [])
      .filter((q): q is string => typeof q === 'string' && q.trim() !== '')
      .slice(0, MAX_QUESTIONS);
    const analysis = typeof o.analysis === 'string' ? o.analysis.slice(0, MAX_ANALYSIS) : '';
    return { kind: 'questions', analysis, questions };
  }

  return { kind: 'error', error: 'JSON has neither "agents" nor "questions"' };
}
