/**
 * Conversation view of a Claude Code session — the chat-style alternative to the
 * raw xterm in the agent sidebar's Terminal tab.
 *
 * Claude Code appends every turn of a session to a JSONL transcript
 * (`~/.claude/projects/<key>/<session>.jsonl`). Each line is one record:
 * `type: 'user' | 'assistant' | 'system' | 'summary' | …` with an Anthropic-style
 * `message` whose `content` is a string or an array of blocks (`text`,
 * `thinking`, `tool_use`, `tool_result`, `image`). Assistant turns are streamed
 * as SEVERAL records (one per content block) sharing a `message.id`.
 *
 * This module is pure (no fs, no DOM) so main can parse and the renderer can
 * fold, and both halves are unit-testable from plain node.
 */

/** One raw item extracted from a transcript line, before tool results are
 *  folded into their tool call. */
export type RawConversationItem =
  | { kind: 'user'; id: string; ts?: string; text: string; images?: number }
  | { kind: 'assistant'; id: string; ts?: string; text: string }
  | { kind: 'thinking'; id: string; ts?: string; text: string }
  | { kind: 'tool'; id: string; ts?: string; name: string; summary: string; input: string; targets?: string[] }
  | { kind: 'toolResult'; toolUseId: string; text: string; isError: boolean }
  | { kind: 'event'; id: string; ts?: string; text: string };

/** What the view renders: a tool call carries its result once it arrives. */
export type ConversationEntry =
  | Exclude<RawConversationItem, { kind: 'tool' } | { kind: 'toolResult' }>
  | {
      kind: 'tool'; id: string; ts?: string; name: string; summary: string; input: string;
      targets?: string[]; result?: string; isError?: boolean;
    };

/** Long tool inputs/outputs are clipped: the view is for following along, the
 *  raw terminal (one click away) still has everything. */
export const MAX_DETAIL_CHARS = 6000;
/** Folded entries kept in memory per agent — the oldest fall off the top. */
export const MAX_ENTRIES = 1500;

function clip(s: string, max = MAX_DETAIL_CHARS): string {
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more chars)` : s;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/** One-line description of a tool call, shown next to its name. */
export function summarizeToolInput(name: string, input: unknown): string {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick =
    name === 'Bash' ? str(o.description) ?? str(o.command)
    : name === 'TodoWrite' ? (Array.isArray(o.todos) ? `${o.todos.length} todos` : undefined)
    : str(o.file_path) ?? str(o.notebook_path) ?? str(o.path) ?? str(o.pattern)
      ?? str(o.url) ?? str(o.query) ?? str(o.description) ?? str(o.command) ?? str(o.prompt);
  const fallback = pick ?? Object.values(o).find((v): v is string => typeof v === 'string' && !!v) ?? '';
  const oneLine = fallback.replace(/\s+/g, ' ').trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 159)}…` : oneLine;
}

/** Agents a tool call is addressed to. Hive agents message each other by writing
 *  a message JSON (`{ "to": "<agent id>", … }`) into their `outbox/`; MCP-style
 *  tools carry `to` / `agent_id` / `recipient` directly in their input. */
export function toolTargets(name: string, input: unknown): string[] {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const collect = (v: unknown): string[] =>
    typeof v === 'string' && v ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];
  const path = str(o.file_path) ?? '';
  if (name === 'Write' && /[\\/]outbox[\\/]/.test(path) && typeof o.content === 'string') {
    try {
      const msg = JSON.parse(o.content) as Record<string, unknown>;
      return collect(msg.to);
    } catch { return []; }
  }
  if (name.startsWith('mcp__')) return [...collect(o.to), ...collect(o.agent_id), ...collect(o.recipient)];
  return [];
}

/** A readable rendering of a tool's input for the expanded card. */
function formatToolInput(name: string, input: unknown): string {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if (name === 'Bash' && typeof o.command === 'string') return clip(`$ ${o.command}`);
  if (name === 'TodoWrite' && Array.isArray(o.todos)) {
    return clip(o.todos.map((t) => {
      const td = (t ?? {}) as Record<string, unknown>;
      const mark = td.status === 'completed' ? '[x]' : td.status === 'in_progress' ? '[~]' : '[ ]';
      return `${mark} ${String(td.content ?? '')}`;
    }).join('\n'));
  }
  if ((name === 'Edit' || name === 'MultiEdit') && typeof o.file_path === 'string') {
    const parts: string[] = [String(o.file_path)];
    const edits = Array.isArray(o.edits) ? o.edits : [o];
    for (const e of edits) {
      const ed = (e ?? {}) as Record<string, unknown>;
      if (typeof ed.old_string === 'string') parts.push(ed.old_string.split('\n').map((l) => `- ${l}`).join('\n'));
      if (typeof ed.new_string === 'string') parts.push(ed.new_string.split('\n').map((l) => `+ ${l}`).join('\n'));
    }
    return clip(parts.join('\n'));
  }
  try { return clip(JSON.stringify(input, null, 2) ?? ''); } catch { return ''; }
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return clip(content);
  if (Array.isArray(content)) {
    return clip(content.map((b) => {
      const blk = (b ?? {}) as Record<string, unknown>;
      if (blk.type === 'text' && typeof blk.text === 'string') return blk.text;
      if (blk.type === 'image') return '[image]';
      return '';
    }).filter(Boolean).join('\n'));
  }
  return '';
}

const TAG = (name: string, s: string): string | undefined => {
  const m = s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : undefined;
};

/** Turn a user-typed string into a renderable item — or nothing, for the
 *  plumbing Claude Code writes as "user" text (command echoes, reminders). */
function userString(id: string, ts: string | undefined, raw: string): RawConversationItem | null {
  const text = raw.trim();
  if (!text) return null;
  const cmd = TAG('command-name', text);
  if (cmd) {
    const args = TAG('command-args', text);
    return { kind: 'event', id, ts, text: args ? `${cmd} ${args}` : cmd };
  }
  const bash = TAG('bash-input', text);
  if (bash) return { kind: 'event', id, ts, text: `! ${bash}` };
  // Command stdout, bash stdout/stderr, system reminders, caveats: plumbing.
  if (/^<(local-command-stdout|local-command-stderr|bash-stdout|bash-stderr|system-reminder|command-message|local-command-caveat)>/.test(text)) {
    return null;
  }
  if (/^\[Request interrupted by user/.test(text)) return { kind: 'event', id, ts, text: 'Interrupted' };
  return { kind: 'user', id, ts, text };
}

/** Parse ONE transcript record into zero or more raw items. */
export function parseTranscriptRecord(rec: unknown): RawConversationItem[] {
  if (!rec || typeof rec !== 'object') return [];
  const r = rec as Record<string, unknown>;
  // Subagent (Task) traffic lives in the same file but is not this conversation.
  if (r.isSidechain === true) return [];
  const id = str(r.uuid) ?? str(r.id) ?? '';
  const ts = str(r.timestamp);
  const msg = (r.message ?? {}) as Record<string, unknown>;
  const content = msg.content;
  const out: RawConversationItem[] = [];

  if (r.type === 'user') {
    if (r.isCompactSummary === true) return [{ kind: 'event', id, ts, text: 'Context compacted' }];
    if (r.isMeta === true) return [];
    if (typeof content === 'string') {
      const item = userString(id, ts, content);
      return item ? [item] : [];
    }
    if (!Array.isArray(content)) return [];
    const texts: string[] = [];
    let images = 0;
    content.forEach((b, i) => {
      const blk = (b ?? {}) as Record<string, unknown>;
      if (blk.type === 'tool_result' && typeof blk.tool_use_id === 'string') {
        out.push({ kind: 'toolResult', toolUseId: blk.tool_use_id, text: toolResultText(blk.content), isError: blk.is_error === true });
      } else if (blk.type === 'text' && typeof blk.text === 'string') {
        const item = userString(`${id}:${i}`, ts, blk.text);
        if (item?.kind === 'user') texts.push(item.text);
        else if (item) out.push(item);
      } else if (blk.type === 'image') {
        images++;
      }
    });
    if (texts.length || images) {
      out.push({ kind: 'user', id, ts, text: texts.join('\n\n'), ...(images ? { images } : {}) });
    }
    return out;
  }

  if (r.type === 'assistant') {
    if (typeof content === 'string') return content.trim() ? [{ kind: 'assistant', id, ts, text: content }] : [];
    if (!Array.isArray(content)) return [];
    content.forEach((b, i) => {
      const blk = (b ?? {}) as Record<string, unknown>;
      const bid = `${id}:${i}`;
      if (blk.type === 'text' && typeof blk.text === 'string' && blk.text.trim()) {
        // Claude Code's synthetic "no response" filler is noise in a chat view.
        if (blk.text.trim() === 'No response requested.') return;
        out.push({ kind: 'assistant', id: bid, ts, text: blk.text });
      } else if (blk.type === 'thinking' && typeof blk.thinking === 'string' && blk.thinking.trim()) {
        out.push({ kind: 'thinking', id: bid, ts, text: clip(blk.thinking) });
      } else if (blk.type === 'tool_use' && typeof blk.name === 'string') {
        const targets = toolTargets(blk.name, blk.input);
        out.push({
          kind: 'tool', id: str(blk.id) ?? bid, ts, name: blk.name,
          summary: summarizeToolInput(blk.name, blk.input), input: formatToolInput(blk.name, blk.input),
          ...(targets.length ? { targets } : {})
        });
      }
    });
    return out;
  }

  if (r.type === 'system' && r.subtype === 'compact_boundary') {
    return [{ kind: 'event', id, ts, text: 'Context compacted' }];
  }
  return [];
}

/** Parse a chunk of complete JSONL lines. Malformed lines are skipped. */
export function parseTranscriptChunk(text: string): RawConversationItem[] {
  const out: RawConversationItem[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(...parseTranscriptRecord(JSON.parse(t))); } catch { /* torn / malformed line */ }
  }
  return out;
}

/** Fold freshly parsed items onto the entries already shown. Tool results attach
 *  to their call (even one from an earlier chunk); duplicate ids are replaced,
 *  never repeated; the list is capped at MAX_ENTRIES. Returns a NEW array. */
export function foldConversation(prev: readonly ConversationEntry[], items: readonly RawConversationItem[]): ConversationEntry[] {
  if (!items.length) return prev as ConversationEntry[];
  const next = prev.slice();
  const indexById = new Map<string, number>();
  next.forEach((e, i) => indexById.set(e.id, i));
  for (const it of items) {
    if (it.kind === 'toolResult') {
      const i = indexById.get(it.toolUseId);
      const call = i === undefined ? undefined : next[i];
      if (call && call.kind === 'tool') next[i!] = { ...call, result: it.text, isError: it.isError };
      continue;
    }
    const existing = indexById.get(it.id);
    if (existing !== undefined) { next[existing] = { ...it }; continue; }
    indexById.set(it.id, next.length);
    next.push({ ...it });
  }
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
}

/** Agents named in a message, in order of first mention. Matches an agent's
 *  display name (whole words, case-insensitive) or its id. Names shorter than 3
 *  characters are ignored — too likely to hit ordinary words. */
export function findAgentMentions<T extends { id: string; name: string }>(
  text: string, agents: readonly T[], selfId?: string
): T[] {
  const hits: Array<{ at: number; agent: T }> = [];
  const lower = text.toLowerCase();
  for (const a of agents) {
    if (a.id === selfId) continue;
    let at = a.id.length >= 3 ? lower.indexOf(a.id.toLowerCase()) : -1;
    const name = a.name.trim();
    if (name.length >= 3) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const m = new RegExp(`(^|[^\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`, 'iu').exec(text);
      if (m && (at < 0 || m.index < at)) at = m.index + m[1].length;
    }
    if (at >= 0) hits.push({ at, agent: a });
  }
  return hits.sort((x, y) => x.at - y.at).map((h) => h.agent);
}
