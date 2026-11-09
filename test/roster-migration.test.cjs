'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { planLegacyMigration, migrateLegacyRoster } = loadTs('src/main/rosterMigration.ts');
const { repoRosterPath } = loadTs('src/main/roster.ts');

function snap(over = {}) {
  return { version: 1, savedAt: new Date(0).toISOString(), agents: [], archived: [], restorable: [], queues: {}, selectedId: null, ...over };
}
const table = (m) => async (a) => (a.worktreePath && m[a.worktreePath]) || m[a.cwd] || null;
const ids = (s) => s.agents.map((a) => a.id);

test('agents are grouped by resolved repo', async () => {
  const legacy = snap({
    agents: [
      { id: 'a', cwd: '/r1' },
      { id: 'b', cwd: '/r1/sub' },
      { id: 'c', cwd: '/r2', worktreePath: '/wt/c' },
    ],
  });
  const plan = await planLegacyMigration(legacy, table({ '/r1': '/r1', '/r1/sub': '/r1', '/wt/c': '/r2' }));
  assert.deepEqual([...plan.keys()].sort(), ['/r1', '/r2']);
  assert.deepEqual(ids(plan.get('/r1')), ['a', 'b']);
  assert.deepEqual(ids(plan.get('/r2')), ['c']);
});

test('god is copied into every group', async () => {
  const legacy = snap({
    agents: [{ id: 'g', cwd: '/r1', isGod: true }, { id: 'a', cwd: '/r1' }, { id: 'c', cwd: '/r2' }],
  });
  const plan = await planLegacyMigration(legacy, table({ '/r1': '/r1', '/r2': '/r2' }));
  assert.deepEqual(ids(plan.get('/r1')).sort(), ['a', 'g']);
  assert.deepEqual(ids(plan.get('/r2')).sort(), ['c', 'g']);
});

test('a god-only roster creates no group', async () => {
  const plan = await planLegacyMigration(snap({ agents: [{ id: 'g', cwd: '/r1', isGod: true }] }), table({}));
  assert.equal(plan.size, 0);
});

test('queues follow their agent and selectedId stays with its group', async () => {
  const legacy = snap({
    agents: [{ id: 'a', cwd: '/r1' }, { id: 'c', cwd: '/r2' }],
    archived: [{ id: 'z', cwd: '/r2' }],
    queues: { a: [1], c: [2, 3] },
    selectedId: 'c',
  });
  const plan = await planLegacyMigration(legacy, table({ '/r1': '/r1', '/r2': '/r2' }));
  assert.deepEqual(plan.get('/r1').queues, { a: [1] });
  assert.equal(plan.get('/r1').selectedId, null);
  assert.deepEqual(plan.get('/r2').queues, { c: [2, 3] });
  assert.equal(plan.get('/r2').selectedId, 'c');
  assert.deepEqual(plan.get('/r2').archived.map((a) => a.id), ['z']);
});

test('an unresolvable agent falls back to its cwd as project', async () => {
  const plan = await planLegacyMigration(snap({ agents: [{ id: 'a', cwd: '/plain' }, { id: 'n' }] }), table({}));
  assert.deepEqual([...plan.keys()], ['/plain']);
  assert.deepEqual(ids(plan.get('/plain')), ['a']);
});

test('migrateLegacyRoster writes repo rosters, leaves roster.json byte-identical, and runs once', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  const file = path.join(home, 'roster.json');
  fs.writeFileSync(file, JSON.stringify(snap({ agents: [{ id: 'a', cwd: '/r1' }, { id: 'c', cwd: '/r2' }] })));
  const before = fs.readFileSync(file);
  const resolve = table({ '/r1': '/r1', '/r2': '/r2' });
  const res = await migrateLegacyRoster(home, resolve);
  assert.equal(res.migrated, true);
  assert.deepEqual(res.repos.sort(), ['/r1', '/r2']);
  const r1 = JSON.parse(fs.readFileSync(repoRosterPath(home, '/r1'), 'utf8'));
  assert.equal(r1.agents[0].id, 'a');
  assert.equal(r1.repoRoot, '/r1');
  assert.ok(fs.existsSync(path.join(home, 'rosters', '.migrated')));
  assert.deepEqual(fs.readFileSync(file), before);
  const r1Bytes = fs.readFileSync(repoRosterPath(home, '/r1'));
  const again = await migrateLegacyRoster(home, resolve);
  assert.equal(again.migrated, false);
  assert.deepEqual(fs.readFileSync(repoRosterPath(home, '/r1')), r1Bytes);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('migrateLegacyRoster is a no-op without roster.json', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  assert.deepEqual(await migrateLegacyRoster(home, async () => null), { migrated: false, repos: [] });
});
