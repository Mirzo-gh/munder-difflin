'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

// projectDir() resolves under os.homedir(): point HOME at a temp dir.
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hidden-home-'));
const realHome = process.env.HOME;
process.env.HOME = fakeHome;
test.after(() => {
  process.env.HOME = realHome;
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

const { hiddenClaudeArgs, extractLastAssistantText } = loadTs('src/main/hiddenClaude.ts');
const { projectDir } = loadTs('src/main/transcript.ts');

const line = (text) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

test('sessionId is passed as --session-id', () => {
  const args = hiddenClaudeArgs({ model: 'm', cwd: '/x', sessionId: 'abc-123' }, []);
  const i = args.indexOf('--session-id');
  assert.ok(i >= 0);
  assert.equal(args[i + 1], 'abc-123');
});

test('no sessionId → no --session-id flag (old behaviour)', () => {
  assert.ok(!hiddenClaudeArgs({ model: 'm', cwd: '/x' }, []).includes('--session-id'));
});

test('custom disallowedTools replace the default list', () => {
  const args = hiddenClaudeArgs({ model: 'm', cwd: '/x', disallowedTools: ['Edit', 'Write', 'NotebookEdit', 'Bash'] }, []);
  assert.deepEqual(args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--disallowedTools') + 5), ['Edit', 'Write', 'NotebookEdit', 'Bash']);
});

test('with a sessionId the answer comes from that transcript, not the newest one', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hidden-cwd-'));
  const dir = projectDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mine.jsonl'), line('my answer') + '\n');
  const later = new Date(Date.now() + 10_000);
  fs.writeFileSync(path.join(dir, 'other.jsonl'), line('someone else') + '\n');
  fs.utimesSync(path.join(dir, 'other.jsonl'), later, later);
  const t0 = Date.now() - 1000;
  assert.equal(extractLastAssistantText(cwd, t0), 'someone else');
  assert.equal(extractLastAssistantText(cwd, t0, 'mine'), 'my answer');
  assert.equal(extractLastAssistantText(cwd, t0, 'missing'), null);
});
