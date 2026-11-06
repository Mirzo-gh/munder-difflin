'use strict';

/**
 * Fork perso (Task 6 révisée) : in `tui: "fullscreen"` (inherited from the
 * user's ~/.claude/settings.json) Claude Code's ScrollPin.repin() yanks the
 * conversation view back to the bottom whenever text is typed into an empty
 * prompt or submitted, which is exactly what the app does when it delivers an
 * inbox nudge or a queued message. Non-forced repins are gated on the Claude
 * Code setting `autoScrollEnabled`, so the per-session settings file turns it
 * off for every hive agent; the TUI's own "Jump to bottom" pill takes over.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron, filename: electron, loaded: true,
  exports: { Notification: class { show() {} static isSupported() { return false; } } }
};

const { HiveManager } = loadTs('src/main/hive.ts');

async function settingsFor(t, meta) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-autoscroll-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  const inj = await hive.ensureAgent({ provider: 'claude', cwd: home, ...meta }, {});
  const i = inj.args.indexOf('--settings');
  assert.ok(i >= 0, 'claude spawn carries --settings');
  return JSON.parse(fs.readFileSync(inj.args[i + 1], 'utf8'));
}

test('god settings turn the TUI auto-scroll off', async (t) => {
  const s = await settingsFor(t, { id: 'god-1', name: 'Michael', isGod: true });
  assert.equal(s.autoScrollEnabled, false);
});

test('worker settings turn the TUI auto-scroll off', async (t) => {
  const s = await settingsFor(t, { id: 'jim-1', name: 'Jim' });
  assert.equal(s.autoScrollEnabled, false);
});

test('the renderer mode is left to the user (tui is never forced)', async (t) => {
  const s = await settingsFor(t, { id: 'jim-1', name: 'Jim' });
  assert.equal('tui' in s, false);
});
