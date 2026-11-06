'use strict';

/**
 * The inbox nudge is a one-liner ("📬 inbox: <ids>"), so the standing instruction
 * on what to do with it rides the injected prompt instead: every agent gets
 * INBOX_NUDGE_PROTOCOL, and only god also gets GOD_INBOX_REPORT (a short French
 * report for the human, never an echo of the mail).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');
const { INBOX_NUDGE_PROTOCOL, GOD_INBOX_REPORT } = loadTs('src/shared/hiveNudge.ts');

async function promptFor(t, meta) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-prompt-inbox-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  const inj = await hive.ensureAgent({ provider: 'claude', cwd: home, ...meta }, {});
  const i = inj.args.findIndex((a) => a === '--append-system-prompt' || a === '--prompt');
  assert.ok(i >= 0, 'the hive protocol must be on argv');
  return inj.args[i + 1];
}

test('god prompt carries the nudge protocol and the short-report rule', async (t) => {
  const prompt = await promptFor(t, { id: 'god-1', name: 'Michael', isGod: true });
  assert.ok(prompt.includes(INBOX_NUDGE_PROTOCOL));
  assert.ok(prompt.includes(GOD_INBOX_REPORT));
});

test('worker prompt carries the nudge protocol but not the god report rule', async (t) => {
  const prompt = await promptFor(t, { id: 'jim-1', name: 'Jim' });
  assert.ok(prompt.includes(INBOX_NUDGE_PROTOCOL));
  assert.ok(!prompt.includes(GOD_INBOX_REPORT));
});
