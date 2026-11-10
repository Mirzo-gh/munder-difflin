/**
 * Detect an interactive choice the CLI is showing on its live screen — a
 * permission prompt, a "resume?" question, any numbered selection menu — so the
 * conversation view can mirror it as clickable buttons instead of leaving it
 * hidden in the raw terminal.
 *
 * Pure: takes the terminal's visible rows as plain text (no ANSI), returns the
 * menu or null. Claude Code's Select renders as:
 *
 *   │ Do you want to proceed?                      │
 *   │ ❯ 1. Yes                                     │
 *   │   2. Yes, and don't ask again for this cmd   │
 *   │   3. No, and tell Claude what to do (esc)    │
 *
 * (sometimes without the box). Only the LAST such block on screen counts, and
 * only when it sits near the bottom: an old menu scrolled up is history.
 */

export interface TerminalMenuOption {
  /** 0-based position in the menu. */
  index: number;
  /** The number the CLI prints before the label, when it prints one. */
  number?: number;
  label: string;
}

export interface TerminalMenu {
  /** The question above the options (may be empty when none is printed). */
  question: string;
  options: TerminalMenuOption[];
  /** Index of the option the cursor (❯) is on. */
  selected: number;
  /** Stable identity of this menu instance, to tell a new menu from a repaint. */
  key: string;
}

const CURSOR = /[❯›▶►>]/;
/** Box-drawing borders and the padding inside them. */
function unbox(line: string): string {
  return line
    .replace(/^[\s│┃|╭╰╮╯─━┌└┐┘]*[│┃|]\s?/, '')
    .replace(/\s?[│┃|]\s*$/, '')
    .replace(/\s+$/, '');
}

const OPTION_RE = new RegExp(`^(\\s*)(${CURSOR.source})?\\s*(\\d{1,2})[.)]\\s+(.+?)\\s*$`);

/** How many trailing rows may follow the menu (hints, footer, status line). */
const MAX_TRAILING_ROWS = 8;

export function detectTerminalMenu(screen: readonly string[]): TerminalMenu | null {
  const lines = screen.map(unbox);
  // Last non-empty row.
  let last = lines.length - 1;
  while (last >= 0 && !lines[last].trim()) last--;
  if (last < 0) return null;

  // Find the bottom-most run of numbered options with a cursor on one of them.
  for (let end = last; end >= 0 && last - end <= MAX_TRAILING_ROWS; end--) {
    if (!OPTION_RE.test(lines[end])) continue;
    let start = end;
    while (start - 1 >= 0 && (OPTION_RE.test(lines[start - 1]) || isContinuation(lines, start - 1))) start--;
    const options: TerminalMenuOption[] = [];
    let selected = -1;
    let expected: number | undefined;
    for (let i = start; i <= end; i++) {
      const m = lines[i].match(OPTION_RE);
      if (!m) {
        // Wrapped label: append to the previous option.
        if (options.length) options[options.length - 1].label += ` ${lines[i].trim()}`;
        continue;
      }
      const num = Number(m[3]);
      if (expected !== undefined && num !== expected) { options.length = 0; selected = -1; }
      expected = num + 1;
      if (m[2]) selected = options.length;
      options.push({ index: options.length, number: num, label: m[4] });
    }
    if (options.length < 2 || selected < 0) return null;
    // Question: the closest non-empty rows above the options (up to 3).
    const q: string[] = [];
    for (let i = start - 1; i >= 0 && q.length < 3; i--) {
      const t = lines[i].trim();
      if (!t) { if (q.length) break; continue; }
      if (/^[─━┄┈═╌-]{3,}$/.test(t)) break;
      q.unshift(t);
    }
    const question = q.join(' ');
    const key = `${question}|${options.map((o) => o.label).join('|')}`;
    return { question, options, selected, key };
  }
  return null;
}

/** A row inside a menu block that is a wrapped label, not an option: indented
 *  deeper than an option, directly between options. */
function isContinuation(lines: readonly string[], i: number): boolean {
  const l = lines[i];
  if (!l.trim() || OPTION_RE.test(l)) return false;
  const next = lines[i + 1];
  const prev = lines[i - 1];
  return !!next && !!prev && OPTION_RE.test(prev) && /^\s{4,}\S/.test(l);
}

const DOWN = '\x1b[B';
const UP = '\x1b[A';
const ENTER = '\r';

/** Keystrokes that move the cursor from `menu.selected` to `target` and confirm.
 *  Arrow keys rather than the digit: every Select honours arrows + Enter, while
 *  not every one maps digits. Returned as separate writes, to be sent spaced out
 *  so the TUI processes each key. */
export function menuKeystrokes(menu: TerminalMenu, target: number): string[] {
  const delta = target - menu.selected;
  const keys: string[] = [];
  for (let i = 0; i < Math.abs(delta); i++) keys.push(delta > 0 ? DOWN : UP);
  keys.push(ENTER);
  return keys;
}
