/**
 * The theme an agent's TUI is spawned with (Claude session `theme` setting and
 * COLORFGBG, see hive.ts). Fork perso: the app is DARK by default
 * (renderer design/theme.ts `load()`), so an unset `config.terminalTheme` — a
 * user who never touched the toggle — must resolve to dark too, or the TUI paints
 * its light palette on the dark terminal. An explicit 'light' stays light.
 */
export type TerminalTheme = 'light' | 'dark';

export function resolveTerminalTheme(configured: unknown): TerminalTheme {
  return configured === 'light' ? 'light' : 'dark';
}
