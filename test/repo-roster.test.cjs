'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { RosterStore, repoSlug, repoRosterPath, repoRosterBackupDir, listRepoRosters, readAllRosterAgents } =
  loadTs('src/main/roster.ts');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'md-repo-roster-'));
}

function snapshot(agents = []) {
  return { version: 1, savedAt: new Date(0).toISOString(), agents, archived: [], restorable: [], queues: {}, selectedId: null };
}

test('repoSlug is stable and distinguishes same-named repos', () => {
  assert.equal(repoSlug('/a/app'), repoSlug('/a/app'));
  assert.notEqual(repoSlug('/a/app'), repoSlug('/b/app'));
  assert.match(repoSlug('/a/app'), /^app-[0-9a-f]{8}$/);
});

test('a repo store writes to rosters/<slug>.json and never touches roster.json', () => {
  const home = tmpHome();
  fs.writeFileSync(path.join(home, 'roster.json'), JSON.stringify(snapshot([{ id: 'legacy' }])));
  const before = fs.readFileSync(path.join(home, 'roster.json'));
  const store = new RosterStore(() => home, '/r/one');
  assert.equal(store.write(snapshot([{ id: 'a' }, { id: 'b' }])).ok, true);
  const p = repoRosterPath(home, '/r/one');
  assert.equal(p, path.join(home, 'rosters', `${repoSlug('/r/one')}.json`));
  const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(saved.agents.length, 2);
  assert.equal(saved.repoRoot, '/r/one');
  assert.deepEqual(fs.readFileSync(path.join(home, 'roster.json')), before);
  assert.ok(repoRosterBackupDir(home, '/r/one').startsWith(path.join(home, 'rosters', 'backups')));
});

test('two repo stores do not see each other', () => {
  const home = tmpHome();
  const a = new RosterStore(() => home, '/r/a');
  const b = new RosterStore(() => home, '/r/b');
  a.write(snapshot([{ id: 'a1' }]));
  b.write(snapshot([{ id: 'b1' }, { id: 'b2' }]));
  assert.equal(a.read().agents.length, 1);
  assert.equal(b.read().agents.length, 2);
  assert.equal(a.read().agents[0].id, 'a1');
});

test('the empty-guard applies per repo store', () => {
  const home = tmpHome();
  new RosterStore(() => home, '/r/one').write(snapshot([{ id: 'a' }]));
  const fresh = new RosterStore(() => home, '/r/one');
  assert.deepEqual(fresh.write(snapshot([])), { ok: false, skipped: 'empty-first-write' });
  assert.equal(fresh.read().agents.length, 1);
});

test('listRepoRosters reports repo, count and skips garbage', () => {
  const home = tmpHome();
  new RosterStore(() => home, '/r/a').write(snapshot([{ id: '1' }]));
  new RosterStore(() => home, '/r/b').write(snapshot([{ id: '1' }, { id: '2' }]));
  fs.writeFileSync(path.join(home, 'rosters', 'junk.json'), '{');
  const list = listRepoRosters(home);
  assert.equal(list.length, 2);
  const byRepo = Object.fromEntries(list.map((r) => [r.repoRoot, r]));
  assert.equal(byRepo['/r/a'].agentCount, 1);
  assert.equal(byRepo['/r/b'].agentCount, 2);
  assert.equal(byRepo['/r/a'].slug, repoSlug('/r/a'));
});

test('readAllRosterAgents merges legacy and repo rosters', () => {
  const home = tmpHome();
  fs.writeFileSync(path.join(home, 'roster.json'), JSON.stringify(snapshot([{ id: 'legacy' }])));
  new RosterStore(() => home, '/r/a').write(snapshot([{ id: 'a' }]));
  new RosterStore(() => home, '/r/b').write(snapshot([{ id: 'b' }]));
  const ids = readAllRosterAgents(home).map((a) => a.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'legacy']);
});
