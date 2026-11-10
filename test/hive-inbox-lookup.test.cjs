'use strict';

/**
 * inboxMessagesById backs the readable inbox nudge in the Conversation view
 * (sender + subject instead of `📬 inbox: <ids>`). The agent has usually filed
 * the mail under inbox/.done by the time it is rendered, so the lookup must
 * find both, and must never read outside the inbox.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function freshHive(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-inbox-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'a1', name: 'A', provider: 'claude', cwd: home });
  const inbox = path.join(home, 'hive', 'agents', 'a1', 'inbox');
  return { hive, inbox };
}

const msg = (id, extra = {}) => ({
  id, conversation: id, in_reply_to: null, from: 'god', to: 'a1', act: 'request',
  subject: `subject ${id}`, body: 'body', hops: 0, requires_reply: false, needs_human: false,
  created_at: '2026-11-10T15:00:00.000Z', ...extra
});

test('finds pending and filed mail, in the order asked', async (t) => {
  const { hive, inbox } = await freshHive(t);
  fs.writeFileSync(path.join(inbox, 'm1.json'), JSON.stringify(msg('m1')));
  fs.writeFileSync(path.join(inbox, '.done', 'm2.json'), JSON.stringify(msg('m2', { from: 'b2' })));
  const got = hive.inboxMessagesById('a1', ['m2', 'm1', 'nope']);
  assert.deepEqual(got.map((m) => [m.id, m.from, m.subject]), [['m2', 'b2', 'subject m2'], ['m1', 'god', 'subject m1']]);
});

test('finds a message whose file was renamed when filed', async (t) => {
  const { hive, inbox } = await freshHive(t);
  fs.writeFileSync(path.join(inbox, '.done', 'handled-m3.json'), JSON.stringify(msg('m3')));
  assert.equal(hive.inboxMessagesById('a1', ['m3'])[0]?.subject, 'subject m3');
});

test('ignores ids that are not plain file names', async (t) => {
  const { hive } = await freshHive(t);
  assert.deepEqual(hive.inboxMessagesById('a1', ['../../registry', 'a/b']), []);
});
