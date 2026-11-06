'use strict';

/**
 * Fork perso (chantier 4) : the app boots DARK by default, and an explicit
 * light choice persisted under `cth.theme` (or the legacy `cth.ptyTheme`) is
 * still honoured.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

function withStorage(entries, fn) {
  const prev = global.window;
  const store = new Map(Object.entries(entries));
  global.window = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } };
  try { return fn(); } finally { global.window = prev; }
}

const { load } = loadTs('src/renderer/src/design/theme.ts');

test('no stored theme → dark', () => {
  assert.equal(withStorage({}, () => load()), 'dark');
});

test('explicit cth.theme = light stays light', () => {
  assert.equal(withStorage({ 'cth.theme': 'light' }, () => load()), 'light');
});

test('legacy cth.ptyTheme = light is still honoured', () => {
  assert.equal(withStorage({ 'cth.ptyTheme': 'light' }, () => load()), 'light');
});

test('garbage value falls back to dark', () => {
  assert.equal(withStorage({ 'cth.theme': 'sepia' }, () => load()), 'dark');
});

test('unreadable storage falls back to dark', () => {
  const prev = global.window;
  global.window = { get localStorage() { throw new Error('denied'); } };
  try { assert.equal(load(), 'dark'); } finally { global.window = prev; }
});
