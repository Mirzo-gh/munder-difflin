/**
 * Name the task a hive message is about, in words a person reads at a glance.
 *
 * Agents title their mail for each other ("O1c terminé — feat/O1c-opp-veille
 * @ aa9e2df (sur O1a ef28676), 1470 réussis / 0 échec"): ids, branches and
 * hashes that mean nothing to the human scrolling the Conversation view. When
 * the subject names a card of the task ledger (hive/tasks.json), the inbox card
 * leads with that card's title instead ("J'ai terminé « Opportunités : veille
 * en direct… »") and keeps the raw subject underneath.
 *
 * Pure functions, shared by main (the lookup) and the renderer (the wording).
 */
import type { MessageAct } from './messageAct';

export interface MailTask { id: string; title: string }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The ledger card a message is about: the task id the subject names first
 * (case-sensitive, as a whole token, so `O1` never matches inside `O1c` and a
 * card called `FIN` never matches the word "fin"), else the message's
 * conversation when it is itself a card id. `null` when neither names a card.
 */
export function findMailTask(
  subject: string | undefined,
  conversation: string | undefined,
  tasks: ReadonlyArray<{ id?: unknown; title?: unknown }>
): MailTask | null {
  const cards = tasks.filter(
    (t): t is MailTask => typeof t.id === 'string' && !!t.id.trim()
      && typeof t.title === 'string' && !!t.title.trim()
  );
  if (!cards.length) return null;
  const text = subject ?? '';
  let best: { at: number; task: MailTask } | null = null;
  for (const task of cards) {
    const m = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRe(task.id)}(?![\\p{L}\\p{N}_])`, 'u').exec(text);
    if (!m) continue;
    const at = m.index + m[0].length - task.id.length;
    if (!best || at < best.at || (at === best.at && task.id.length > best.task.id.length)) best = { at, task };
  }
  if (best) return { id: best.task.id, title: best.task.title };
  const conv = conversation?.trim();
  const byConversation = conv ? cards.find((t) => t.id === conv) : undefined;
  return byConversation ? { id: byConversation.id, title: byConversation.title } : null;
}

/** A card title as a sentence can quote it: trimmed, without a short trailing
 *  aside such as "(choix de Damien)". A long parenthesis carries content and stays. */
export function cleanTaskTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, ' ');
  const stripped = t.replace(/\s*\(([^()]{1,30})\)\s*$/, '');
  return stripped.length >= 8 ? stripped : t;
}

/** Does this text read as French? The hive writes in its own language,
 *  whatever the UI language is, and the sentence around a title follows it. */
export function looksFrench(text: string): boolean {
  if (/[àâçéèêëîïôûùœ«»]/i.test(text)) return true;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const fr = new Set(['le', 'la', 'les', 'des', 'du', 'une', 'et', 'pour', 'sur', 'dans', 'avec', "l'", 'au', 'aux']);
  return words.filter((w) => fr.has(w)).length >= 2;
}

/** The French sentence for each speech act, the title quoted. */
export function frenchTaskLine(act: MessageAct | string | undefined, title: string): string {
  const q = `« ${title} »`;
  switch (act) {
    case 'done': return `J'ai terminé ${q}`;
    case 'request': return `À faire : ${q}`;
    case 'inform': return `Point sur ${q}`;
    case 'propose': return `Proposition pour ${q}`;
    case 'query': return `Question sur ${q}`;
    case 'agree': return `D'accord pour ${q}`;
    case 'refuse': return `Je ne peux pas faire ${q}`;
    default: return q;
  }
}
