/**
 * Multi-window PTY routing rules, kept pure for tests.
 *
 * Each floor owns its terminals: output goes only to the owning window and a
 * floor close kills them. The god agent is the exception — one PTY seen by
 * every floor — so it is SHARED: no owner, output broadcast to every window,
 * never killed by a floor close (only by app teardown).
 */

/** The god agent's PTY id (renderer: `pty-${GOD_ID}`). */
export const GOD_PTY_ID = 'pty-god';

export function isSharedPtySpawn(opts: { id: string; hive?: { isGod?: boolean } | null }): boolean {
  return opts.id === GOD_PTY_ID || opts.hive?.isGod === true;
}

export interface RoutableSession<W> {
  owner: W | null;
  shared?: boolean;
}

/** Windows a session's `pty:data` / `pty:exit` go to. */
export function ptyOutputTargets<W>(s: RoutableSession<W>, fallback: W | null, all: () => W[]): W[] {
  if (s.shared) {
    const every = all();
    if (every.length) return every;
    return fallback ? [fallback] : [];
  }
  const wc = s.owner ?? fallback;
  return wc ? [wc] : [];
}

/** Whether a window owns a session (close-confirmation count + floor-close kill). */
export function ptyOwnedBy<W>(s: RoutableSession<W>, wc: W): boolean {
  return !s.shared && s.owner === wc;
}
