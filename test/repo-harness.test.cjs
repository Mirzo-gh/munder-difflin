'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./load-ts.cjs');

const { resolveRepoHarness, reposOfHarness } = loadTs('src/main/repoHarness.ts');

function lookup(over = {}) {
  const existing = new Set(over.existing ?? []);
  const unused = new Set(over.unused ?? []);
  const notHarness = new Set(over.notHarness ?? []);
  return {
    mapping: {},
    current: null,
    recents: [],
    defaultParent: '/home/u/munder',
    ...over,
    exists: (p) => existing.has(p),
    isUnused: (p) => unused.has(p),
    looksLikeHarness: (p) => !notHarness.has(p)
  };
}

test('a saved link wins when its folder exists', () => {
  const r = resolveRepoHarness('/code/app', lookup({
    mapping: { '/code/app': '/h/custom' }, current: '/h/other', existing: ['/h/custom', '/h/other']
  }));
  assert.deepEqual(r, { harness: '/h/custom', create: false });
});

test('a known harness named like the repo is adopted (case-insensitive)', () => {
  const r = resolveRepoHarness('/code/terramorph', lookup({
    current: '/h/munder/papymagic', recents: ['/h/munder/Terramorph'],
    existing: ['/h/munder/papymagic', '/h/munder/Terramorph']
  }));
  assert.deepEqual(r, { harness: '/h/munder/Terramorph', create: false });
});

test('a same-name harness owned by another repo is not adopted', () => {
  const r = resolveRepoHarness('/other/app', lookup({
    mapping: { '/code/app': '/home/u/munder/app' }, current: '/home/u/munder/app', existing: ['/home/u/munder/app']
  }));
  assert.equal(r.create, true);
  assert.match(r.harness, /^\/home\/u\/munder\/app-[0-9a-f]{8}$/);
});

test('an unowned, unused current harness is adopted by the first repo', () => {
  const r = resolveRepoHarness('/code/app', lookup({
    current: '/h/munder/fresh', existing: ['/h/munder/fresh'], unused: ['/h/munder/fresh']
  }));
  assert.deepEqual(r, { harness: '/h/munder/fresh', create: false });
});

test('a used current harness is not adopted: a new one is created under the default parent', () => {
  const r = resolveRepoHarness('/code/app', lookup({ current: '/h/munder/busy', existing: ['/h/munder/busy'] }));
  assert.deepEqual(r, { harness: '/home/u/munder/app', create: true });
});

test('an existing folder that is not a harness is never adopted', () => {
  const r = resolveRepoHarness('/code/app', lookup({ existing: ['/home/u/munder/app'], notHarness: ['/home/u/munder/app'] }));
  assert.equal(r.create, true);
  assert.match(r.harness, /^\/home\/u\/munder\/app-[0-9a-f]{8}$/);
});

test('the harness is never the repo itself', () => {
  const r = resolveRepoHarness('/home/u/munder/app', lookup({ existing: ['/home/u/munder/app'] }));
  assert.notEqual(r.harness, '/home/u/munder/app');
  assert.match(r.harness, /^\/home\/u\/munder\/app-[0-9a-f]{8}$/);
});

test('a stale link falls through; no current harness → default parent', () => {
  const r = resolveRepoHarness('/code/app', lookup({ mapping: { '/code/app': '/gone' } }));
  assert.deepEqual(r, { harness: '/home/u/munder/app', create: true });
});

test('reposOfHarness lists the repos linked to a harness', () => {
  assert.deepEqual(reposOfHarness({ '/a': '/h1', '/b': '/h2', '/c': '/h1' }, '/h1'), ['/a', '/c']);
});
