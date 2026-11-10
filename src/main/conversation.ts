import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { parseTranscriptChunk, type RawConversationItem } from '../shared/conversation';

/** On first open, at most this many trailing bytes of a transcript are parsed —
 *  a months-long session can be tens of MB, and the view only needs the tail. */
const INITIAL_TAIL_BYTES = 3 * 1024 * 1024;
/** Per poll, at most this many new bytes are read (the rest comes next poll). */
const MAX_READ_BYTES = 4 * 1024 * 1024;

export interface ConversationChunk {
  /** Items parsed from the bytes after `offset` (complete lines only). */
  items: RawConversationItem[];
  /** Byte offset to pass on the next call. Always on a line boundary. */
  offset: number;
  /** True when the caller must DROP what it shows: the file shrank (rewritten)
   *  or this is a first read that started past the beginning. */
  reset: boolean;
  /** True when older history exists before the first returned item. */
  truncated: boolean;
}

/** Incrementally read a Claude Code JSONL transcript from `offset`.
 *  `offset < 0` means "first read": start from the tail. Returns null when the
 *  file cannot be read (not created yet, permissions, …). */
export function readConversation(file: string, offset: number): ConversationChunk | null {
  let fd: number | undefined;
  try {
    fd = openSync(file, 'r');
    const size = fstatSync(fd).size;
    let start = offset;
    let reset = false;
    let truncated = false;
    if (start < 0 || start > size) {
      reset = true;
      start = Math.max(0, size - INITIAL_TAIL_BYTES);
      truncated = start > 0;
    }
    if (start >= size) return { items: [], offset: size, reset, truncated };
    const len = Math.min(size - start, MAX_READ_BYTES);
    const buf = Buffer.alloc(len);
    const read = readSync(fd, buf, 0, len, start);
    let text = buf.subarray(0, read).toString('utf8');
    let consumed = read;
    // Starting mid-file on a tail read: drop the partial first line.
    if (truncated) {
      const nl = text.indexOf('\n');
      if (nl < 0) return { items: [], offset: start, reset, truncated };
      text = text.slice(nl + 1);
    }
    // Only parse up to the last newline: a torn trailing line is re-read later.
    const lastNl = text.lastIndexOf('\n');
    if (lastNl < 0) {
      return { items: [], offset: truncated ? start + (buf.indexOf(10) + 1) : start, reset, truncated };
    }
    const tail = Buffer.byteLength(text.slice(lastNl + 1), 'utf8');
    consumed -= tail;
    return { items: parseTranscriptChunk(text.slice(0, lastNl)), offset: start + consumed, reset, truncated };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { closeSync(fd); } catch { /* already closed */ }
  }
}
