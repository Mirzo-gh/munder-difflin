'use strict';

/**
 * Fork perso (Task 7, fix round 2) : the app is dark by default (design/theme.ts
 * load()). The main process must agree when it spawns an agent, or a user who
 * never touched the theme toggle (config.terminalTheme unset) gets a Claude TUI
 * painting its LIGHT palette (settings theme + COLORFGBG '0;15') on the dark
 * xterm. An explicit 'light' choice stays light.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { resolveTerminalTheme } = loadTs('src/shared/terminalTheme.ts');

test('nothing configured → dark', () => {
  assert.equal(resolveTerminalTheme(undefined), 'dark');
  assert.equal(resolveTerminalTheme(null), 'dark');
});

test('explicit light stays light', () => {
  assert.equal(resolveTerminalTheme('light'), 'light');
});

test('explicit dark stays dark, garbage → dark', () => {
  assert.equal(resolveTerminalTheme('dark'), 'dark');
  assert.equal(resolveTerminalTheme('sepia'), 'dark');
});
