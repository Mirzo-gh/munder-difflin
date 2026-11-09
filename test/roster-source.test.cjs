'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { chooseRosterSource } = loadTs('src/renderer/src/store/rosterSource.ts');

const HIVE_A = '/hives/a';
const HIVE_B = '/hives/b';
const REPO = '/r';

const file = (counts = {}) => ({
  agents: [], archived: [], restorable: [], ...counts
});
const someone = { id: 'agent-1', name: 'Dwight', cwd: HIVE_A };

// --- the file wins whenever it has a roster --------------------------------

test('a populated roster file is used, whatever localStorage says', () => {
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: file({ agents: [someone] }),
    currentHome: HIVE_A,
    storedHome: HIVE_B
  });
  assert.deepEqual(src, { useFileRoster: true, useLocalFallback: false });
});

test('a file holding only archived or only restorable entries still counts', () => {
  for (const slice of ['archived', 'restorable']) {
    const src = chooseRosterSource({
      floorRepo: REPO,
      fileRoster: file({ [slice]: [someone] }),
      currentHome: HIVE_A,
      storedHome: HIVE_A
    });
    assert.equal(src.useFileRoster, true, `${slice}-only roster should win`);
  }
});

// --- a bound floor never adopts localStorage --------------------------------
// Rule changed deliberately with per-repo floors: these cases used to expect
// `useLocalFallback: true`. localStorage is partitioned by origin, so every
// window — every floor, every repo — shares one. Whatever it holds was written
// by whichever floor saved last, i.e. possibly ANOTHER repo's team. A bound
// window therefore reads only its own repo's roster file (which main migrates
// from the old shared roster on first launch); an empty file means an empty
// floor, never a localStorage adoption.

test('localStorage is NOT adopted even in the hive it was written for', () => {
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: null, currentHome: HIVE_A, storedHome: HIVE_A
  });
  assert.deepEqual(src, { useFileRoster: false, useLocalFallback: false });
});

test('localStorage is NOT adopted in a different hive', () => {
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: null, currentHome: HIVE_B, storedHome: HIVE_A
  });
  assert.deepEqual(src, { useFileRoster: false, useLocalFallback: false },
    'a brand-new hive must open on an empty floor, not on the last one');
});

test('an empty roster file does not license a cross-hive read', () => {
  // The empty-guard says an empty file must not beat localStorage. It must not
  // turn into permission to read ANOTHER hive's localStorage either.
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: file(), currentHome: HIVE_B, storedHome: HIVE_A
  });
  assert.equal(src.useLocalFallback, false);
});

test('an empty roster file no longer yields to localStorage in its own hive', () => {
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: file(), currentHome: HIVE_A, storedHome: HIVE_A
  });
  assert.deepEqual(src, { useFileRoster: false, useLocalFallback: false });
});

// --- upgrading, and the dev ↔ packaged origin split ------------------------

test('an unstamped localStorage is not adopted by a bound floor', () => {
  // Upgraders are covered by main's migration of the shared roster into the
  // per-repo files, not by reading a localStorage that may hold another repo.
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: null, currentHome: HIVE_A, storedHome: null
  });
  assert.equal(src.useLocalFallback, false);
});

test('an origin with no roster of its own reads nothing and loses nothing', () => {
  // The packaged build on its first launch: its own localStorage is empty and
  // unstamped, so the fallback is allowed — and returns nothing. The roster
  // comes back from the file, which is what the mirror is for.
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: file({ agents: [someone] }), currentHome: HIVE_A, storedHome: null
  });
  assert.equal(src.useFileRoster, true);
});

test('no hive selected yet still does not fall back on a bound floor', () => {
  const src = chooseRosterSource({
    floorRepo: REPO,
    fileRoster: null, currentHome: null, storedHome: HIVE_A
  });
  assert.equal(src.useLocalFallback, false);
});

// --- per-repo floors: the window's binding decides -------------------------

test('an unbound window loads nothing', () => {
  // No repo chosen yet: main serves no roster and refuses writes, and the
  // window shows the repo picker. Neither store may leak a team onto it.
  for (const fileRoster of [null, file(), file({ agents: [someone] })]) {
    const src = chooseRosterSource({
      floorRepo: null, fileRoster, currentHome: HIVE_A, storedHome: HIVE_A
    });
    assert.deepEqual(src, { useFileRoster: false, useLocalFallback: false });
  }
});

test('a bound window never falls back to localStorage', () => {
  const src = chooseRosterSource({
    floorRepo: REPO, fileRoster: file(), currentHome: HIVE_A, storedHome: HIVE_A
  });
  assert.deepEqual(src, { useFileRoster: false, useLocalFallback: false });
});

test('a bound window uses its populated file', () => {
  const src = chooseRosterSource({
    floorRepo: REPO, fileRoster: file({ agents: [someone] }), currentHome: HIVE_A, storedHome: HIVE_B
  });
  assert.deepEqual(src, { useFileRoster: true, useLocalFallback: false });
});
