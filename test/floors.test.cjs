'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const loadTs = require('./load-ts.cjs');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'md-floors-ud-'));
const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { app: { getPath: () => userData } }
};

const { normalizeFloorRepo, FloorRegistry } = loadTs('src/main/floors.ts');
const { mainRepoRoot } = loadTs('src/main/git.ts');
const { writeConfig, readConfig } = loadTs('src/main/config.ts');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'md-floors-'));
test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(userData, { recursive: true, force: true });
});

test('normalizeFloorRepo maps subfolders and worktrees to the main repo root', async () => {
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(repo, 'sub'), { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const wt = path.join(tmp, 'wt');
  git('worktree', 'add', '-q', wt, '-b', 'feat');
  const real = fs.realpathSync(repo);
  assert.equal(await normalizeFloorRepo(repo, mainRepoRoot), real);
  assert.equal(await normalizeFloorRepo(repo + '/', mainRepoRoot), real);
  assert.equal(await normalizeFloorRepo(path.join(repo, 'sub'), mainRepoRoot), real);
  assert.equal(await normalizeFloorRepo(wt, mainRepoRoot), real);
});

test('normalizeFloorRepo returns null for a missing folder', async () => {
  assert.equal(await normalizeFloorRepo(path.join(tmp, 'nope'), mainRepoRoot), null);
});

test('normalizeFloorRepo keeps a non-git folder as is', async () => {
  const d = path.join(tmp, 'plain');
  fs.mkdirSync(d);
  assert.equal(await normalizeFloorRepo(d, mainRepoRoot), fs.realpathSync(d));
});

test('a repo can be bound to only one window', () => {
  const r = new FloorRegistry();
  assert.deepEqual(r.bind(1, '/r'), { ok: true });
  assert.deepEqual(r.bind(2, '/r'), { ok: false, ownerId: 1 });
  assert.equal(r.ownerOf('/r'), 1);
  r.unbind(1);
  assert.equal(r.repoOf(1), null);
  assert.deepEqual(r.bind(2, '/r'), { ok: true });
  assert.deepEqual(r.openRepos(), ['/r']);
});

test('openFloors survives a config round-trip', () => {
  writeConfig({});
  readConfig();
  assert.deepEqual(readConfig().openFloors, []);
  writeConfig({ openFloors: ['/a', '/a', 'rel', '/b'] });
  assert.deepEqual(readConfig().openFloors, ['/a', '/b']);
});
