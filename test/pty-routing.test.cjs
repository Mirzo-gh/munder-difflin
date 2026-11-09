'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const loadTs = require('./load-ts.cjs');

const { GOD_PTY_ID, isSharedPtySpawn, ptyOutputTargets, ptyOwnedBy } = loadTs('src/main/ptyRouting.ts');

const A = { name: 'A' };
const B = { name: 'B' };
const P = { name: 'primary' };

test('the god PTY is a shared (owner-less) spawn', () => {
  assert.equal(GOD_PTY_ID, 'pty-god');
  assert.equal(isSharedPtySpawn({ id: 'pty-god' }), true);
  assert.equal(isSharedPtySpawn({ id: 'pty-x', hive: { id: 'god', isGod: true } }), true);
  assert.equal(isSharedPtySpawn({ id: 'pty-x', hive: { id: 'x' } }), false);
  assert.equal(isSharedPtySpawn({ id: 'pty-x' }), false);
});

test('a shared PTY broadcasts to every window', () => {
  assert.deepEqual(ptyOutputTargets({ owner: null, shared: true }, P, () => [A, B, P]), [A, B, P]);
});

test('a shared PTY with no window list falls back to the primary sink', () => {
  assert.deepEqual(ptyOutputTargets({ owner: null, shared: true }, P, () => []), [P]);
  assert.deepEqual(ptyOutputTargets({ owner: null, shared: true }, null, () => []), []);
});

test('an owned PTY goes only to its owner; an owner-less one to the primary', () => {
  assert.deepEqual(ptyOutputTargets({ owner: A, shared: false }, P, () => [A, B, P]), [A]);
  assert.deepEqual(ptyOutputTargets({ owner: null }, P, () => [A, B, P]), [P]);
});

test('no window owns a shared PTY (floor close never kills or counts it)', () => {
  assert.equal(ptyOwnedBy({ owner: A, shared: true }, A), false);
  assert.equal(ptyOwnedBy({ owner: null, shared: true }, A), false);
  assert.equal(ptyOwnedBy({ owner: A }, A), true);
  assert.equal(ptyOwnedBy({ owner: A }, B), false);
});

test('PtyManager routes and kills through the helpers', () => {
  const src = fs.readFileSync('src/main/pty.ts', 'utf8');
  assert.match(src, /countByOwner[\s\S]{0,200}ptyOwnedBy\(s, wc\)/);
  assert.match(src, /killByOwner[\s\S]{0,200}ptyOwnedBy\(s, wc\)/);
  assert.match(src, /owner: shared \? null : owner/);
  assert.match(src, /this\.sendToSession\(session, `pty:data:\$\{opts\.id\}`/);
  assert.match(src, /this\.sendToSession\(session, `pty:exit:\$\{opts\.id\}`/);
});

test('main spawns the god owner-less and gives the PTY manager every window', () => {
  const src = fs.readFileSync('src/main/index.ts', 'utf8');
  assert.match(src, /ptyManager\.setBroadcastSinks\(/);
  assert.match(src, /const sharedPty = isSharedPtySpawn\(opts\)/);
  assert.equal((src.match(/ptyManager\.spawn\([\s\S]{0,400}?owner,\s*sharedPty\s*\)|ptyManager\.spawn\(opts, owner, sharedPty\)/g) || []).length, 2);
});
