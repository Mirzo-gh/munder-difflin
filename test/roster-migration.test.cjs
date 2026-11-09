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

// Group keys must exist on disk: the "repos" below are real temp dirs.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-repos-'));
const R = {};
for (const n of ['r1', 'r2', 'web', 'api', 'home', 'other/web']) {
  R[n] = path.join(root, n);
  fs.mkdirSync(R[n], { recursive: true });
}
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
const T = (m) => {
  const out = {};
  for (const [k, v] of Object.entries(m)) out[k] = R[v] ?? v;
  return table(out);
};
const ids = (s) => s.agents.map((a) => a.id);

test('agents are grouped by resolved repo', async () => {
  const legacy = snap({
    agents: [
      { id: 'a', cwd: '/r1' },
      { id: 'b', cwd: '/r1/sub' },
      { id: 'c', cwd: '/r2', worktreePath: '/wt/c' },
    ],
  });
  const plan = await planLegacyMigration(legacy, T({ '/r1': 'r1', '/r1/sub': 'r1', '/wt/c': 'r2' }));
  assert.deepEqual([...plan.keys()].sort(), [R.r1, R.r2].sort());
  assert.deepEqual(ids(plan.get(R.r1)), ['a', 'b']);
  assert.deepEqual(ids(plan.get(R.r2)), ['c']);
});

test('god is copied into every group', async () => {
  const legacy = snap({
    agents: [{ id: 'g', cwd: '/r1', isGod: true }, { id: 'a', cwd: '/r1' }, { id: 'c', cwd: '/r2' }],
  });
  const plan = await planLegacyMigration(legacy, T({ '/r1': 'r1', '/r2': 'r2' }));
  assert.deepEqual(ids(plan.get(R.r1)).sort(), ['a', 'g']);
  assert.deepEqual(ids(plan.get(R.r2)).sort(), ['c', 'g']);
});

test('god queue and god selection are copied into every group', async () => {
  const legacy = snap({
    agents: [{ id: 'g', cwd: '/r1', isGod: true }, { id: 'a', cwd: '/r1' }, { id: 'c', cwd: '/r2' }],
    queues: { g: [9] },
    selectedId: 'g',
  });
  const plan = await planLegacyMigration(legacy, T({ '/r1': 'r1', '/r2': 'r2' }));
  for (const r of [R.r1, R.r2]) {
    assert.deepEqual(plan.get(r).queues.g, [9]);
    assert.equal(plan.get(r).selectedId, 'g');
  }
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
  const plan = await planLegacyMigration(legacy, T({ '/r1': 'r1', '/r2': 'r2' }));
  assert.deepEqual(plan.get(R.r1).queues, { a: [1] });
  assert.equal(plan.get(R.r1).selectedId, null);
  assert.deepEqual(plan.get(R.r2).queues, { c: [2, 3] });
  assert.equal(plan.get(R.r2).selectedId, 'c');
  assert.deepEqual(plan.get(R.r2).archived.map((a) => a.id), ['z']);
});

test('without a fallback an unresolvable agent stays in roster.json only', async () => {
  const plan = await planLegacyMigration(snap({ agents: [{ id: 'a', cwd: '/plain' }, { id: 'n' }] }), table({}));
  assert.equal(plan.size, 0);
});

test('a resolved repo that does not exist on disk is never a group key', async () => {
  const plan = await planLegacyMigration(
    snap({ agents: [{ id: 'a', cwd: '/gone' }] }),
    table({ '/gone': path.join(root, 'missing') }),
    { home: R.home, registeredRepos: [] }
  );
  assert.deepEqual([...plan.keys()], [R.home]);
});

test('isolated agent whose worktree is gone goes to the repo matching its project', async () => {
  const wt = path.join(root, 'worktrees', 'agent-1'); // never created
  const legacy = snap({ agents: [{ id: 'a', cwd: wt, worktreePath: wt, project: 'web' }] });
  const plan = await planLegacyMigration(legacy, table({}), { home: R.home, registeredRepos: [R.web, R.api] });
  assert.deepEqual([...plan.keys()], [R.web]);
  assert.deepEqual(ids(plan.get(R.web)), ['a']);
});

test('an ambiguous or unknown project falls back to the home floor', async () => {
  const wt = path.join(root, 'worktrees', 'agent-2');
  const legacy = snap({
    agents: [
      { id: 'amb', cwd: wt, worktreePath: wt, project: 'web' },
      { id: 'unk', cwd: wt, worktreePath: wt, project: 'nope' },
      { id: 'nocwd', project: 'nope' },
      { id: 'bare' },
    ],
  });
  const plan = await planLegacyMigration(legacy, table({}), {
    home: R.home,
    registeredRepos: [R.web, R['other/web'], path.join(root, 'missing', 'nope')],
  });
  assert.deepEqual([...plan.keys()], [R.home]);
  assert.deepEqual(ids(plan.get(R.home)), ['amb', 'unk', 'nocwd', 'bare']);
});

test('no group key is ever a non-existent path', async () => {
  const wt = path.join(root, 'worktrees', 'agent-3');
  const legacy = snap({
    agents: [
      { id: 'ok', cwd: '/r1' },
      { id: 'wt', cwd: wt, worktreePath: wt, project: 'api' },
      { id: 'raw', cwd: '/definitely/not/here' },
      { id: 'n' },
    ],
  });
  const plan = await planLegacyMigration(legacy, T({ '/r1': 'r1' }), { home: R.home, registeredRepos: [R.api] });
  for (const k of plan.keys()) assert.ok(fs.existsSync(k), `${k} exists`);
  assert.deepEqual(ids(plan.get(R.api)), ['wt']);
  assert.deepEqual(ids(plan.get(R.home)), ['raw', 'n']);
});

test('migrateLegacyRoster writes repo rosters, leaves roster.json byte-identical, and runs once', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  const file = path.join(home, 'roster.json');
  fs.writeFileSync(file, JSON.stringify(snap({ agents: [{ id: 'a', cwd: R.r1 }, { id: 'c', cwd: R.r2 }] })));
  const before = fs.readFileSync(file);
  const resolve = table({ [R.r1]: R.r1, [R.r2]: R.r2 });
  const res = await migrateLegacyRoster(home, resolve);
  assert.equal(res.migrated, true);
  assert.deepEqual(res.repos.sort(), [R.r1, R.r2].sort());
  const r1 = JSON.parse(fs.readFileSync(repoRosterPath(home, R.r1), 'utf8'));
  assert.equal(r1.agents[0].id, 'a');
  assert.equal(r1.repoRoot, R.r1);
  assert.ok(fs.existsSync(path.join(home, 'rosters', '.migrated')));
  assert.deepEqual(fs.readFileSync(file), before);
  const r1Bytes = fs.readFileSync(repoRosterPath(home, R.r1));
  const again = await migrateLegacyRoster(home, resolve);
  assert.equal(again.migrated, false);
  assert.deepEqual(fs.readFileSync(repoRosterPath(home, R.r1)), r1Bytes);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('migrateLegacyRoster groups unresolvable agents under the home floor', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  fs.writeFileSync(path.join(home, 'roster.json'), JSON.stringify(snap({ agents: [{ id: 'x', cwd: '/gone' }] })));
  const res = await migrateLegacyRoster(home, async () => null);
  assert.deepEqual(res.repos, [home]);
  assert.equal(JSON.parse(fs.readFileSync(repoRosterPath(home, home), 'utf8')).agents[0].id, 'x');
});

test('migrateLegacyRoster is a no-op without roster.json', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  assert.deepEqual(await migrateLegacyRoster(home, async () => null), { migrated: false, repos: [] });
});

test('a retry never overwrites an existing repo roster', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-mig-'));
  fs.writeFileSync(path.join(home, 'roster.json'), JSON.stringify(snap({ agents: [{ id: 'a', cwd: R.r1 }, { id: 'c', cwd: R.r2 }] })));
  fs.mkdirSync(path.join(home, 'rosters'), { recursive: true });
  const existing = repoRosterPath(home, R.r1);
  fs.writeFileSync(existing, JSON.stringify(snap({ agents: [{ id: 'user-edit', cwd: R.r1 }], repoRoot: R.r1 })));
  const before = fs.readFileSync(existing);
  const res = await migrateLegacyRoster(home, table({ [R.r1]: R.r1, [R.r2]: R.r2 }));
  assert.equal(res.migrated, true);
  assert.deepEqual(fs.readFileSync(existing), before);
  assert.ok(fs.existsSync(repoRosterPath(home, R.r2)));
});
