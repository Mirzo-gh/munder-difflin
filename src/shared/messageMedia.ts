/**
 * Media inside chat messages, for the Conversation view.
 *
 * 1. Files you attach in the composer (or that arrive from Slack) travel to the
 *    agent as TEXT: a trailing block
 *
 *        Attached files:
 *        - C:\Users\me\AppData\Local\Temp\cth-pastes\paste-1731.png (paste-1731.png)
 *
 *    so Claude Code can Read them by path. The chat shows that block as
 *    thumbnails (images) and file chips (anything else) instead of raw paths.
 *
 * 2. An agent hands you a Claude artifact by putting its link in its reply,
 *    ideally as a Markdown link whose text is the title:
 *    `[Tableau des ventes](https://claude.ai/artifact/…)`. The chat shows each
 *    such link as a clickable preview card under the message.
 *
 * Pure (no fs, no DOM) so it is unit-testable from plain node.
 */
import { isImagePath } from './imageTypes';

export interface AttachedFile {
  path: string;
  name: string;
  image: boolean;
}

const HEADER = /(?:^|\n)\s*Attached files:[ \t]*\n((?:[ \t]*- .+(?:\n|$))+)\s*$/;
const LINE = /^[ \t]*- (.+?)(?: \(([^()\n]+)\))?[ \t]*$/;

/** Last path component, for either separator (Windows paths reach a POSIX
 *  renderer test and vice versa). */
export function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** The directory part of `p`, keeping its own separator style. '' for a bare name. */
export function dirName(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (i < 0) return '';
  // Keep the root's separator: '/x' → '/', 'C:\x' → 'C:\'.
  if (i === 0 || /^[A-Za-z]:$/.test(p.slice(0, i))) return p.slice(0, i + 1);
  return p.slice(0, i);
}

/** Split a user message into what was typed and the files attached to it. */
export function splitAttachedFiles(text: string): { text: string; files: AttachedFile[] } {
  const m = text.match(HEADER);
  if (!m || m.index === undefined) return { text, files: [] };
  const files: AttachedFile[] = [];
  let placeholders = 0;
  for (const line of m[1].split('\n')) {
    const lm = line.match(LINE);
    if (!lm) continue;
    const path = lm[1].trim();
    if (!path) continue;
    // Claude Code may swap a pasted image path for its own `[Image #N]`
    // placeholder and keep the picture inline; that one is shown from the
    // transcript's image block, so the line itself adds nothing.
    if (/^\[Image #\d+\]$/.test(path)) { placeholders++; continue; }
    files.push({ path, name: (lm[2] ?? '').trim() || baseName(path), image: isImagePath(path) });
  }
  if (!files.length && !placeholders) return { text, files: [] };
  return { text: text.slice(0, m.index).trimEnd(), files };
}

export interface ArtifactLink {
  url: string;
  /** The Markdown link text, when the agent gave one that is not the URL itself. */
  title?: string;
}

/** claude.ai/artifact/<id>, claude.ai/code/artifact/<id>,
 *  claude.ai/public/artifacts/<id>, claude.site/artifacts/<id>. */
const ARTIFACT_URL = /https:\/\/(?:www\.)?(?:claude\.ai\/(?:code\/|public\/)?artifacts?|claude\.site\/artifacts)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\?[^\s)<>\]"']*)?/g;

/** Every Claude artifact link in an agent's reply, once each, in order. */
export function findArtifactLinks(markdown: string): ArtifactLink[] {
  const out: ArtifactLink[] = [];
  const seen = new Set<string>();
  // Titled links first, so a bare repeat of the same URL keeps the title.
  const titles = new Map<string, string>();
  const md = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;
  for (let m; (m = md.exec(markdown)); ) {
    const title = m[1].replace(/[*_`]/g, '').trim();
    if (title && !/^https?:\/\//i.test(title) && !titles.has(m[2])) titles.set(m[2], title);
  }
  for (const m of markdown.matchAll(ARTIFACT_URL)) {
    const url = m[0].replace(/[.,;:!?]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    const title = titles.get(url);
    out.push(title ? { url, title } : { url });
  }
  return out;
}

/** "claude.ai" / "claude.site" — what the card shows under the title. */
export function artifactHost(url: string): string {
  const m = url.match(/^https:\/\/(?:www\.)?([^/]+)/);
  return m ? m[1] : url;
}
