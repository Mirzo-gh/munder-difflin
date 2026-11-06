'use strict';

/**
 * Fork perso (Task 2) — the office scene and its TV-show themes are gone, but
 * configs and saved teams written by older builds must still load: a config
 * carrying `tvShowOffices` / `officeTheme` reads without throwing, and every
 * cast `character` a saved agent may carry is still a known name.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'md-legacy-cfg-'));
const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { app: { getPath: () => userData } }
};

const { OFFICE_CAST, DEFAULT_CHARACTER } = loadTs('src/renderer/src/agents/cast.ts');
const { readConfig } = loadTs('src/main/config.ts');

test.after(() => { fs.rmSync(userData, { recursive: true, force: true }); });

test('the cast survives the office scene: saved characters stay known', () => {
  for (const name of ['creed', 'meredith', 'michael', 'jim']) {
    assert.ok(OFFICE_CAST.some((c) => c.name === name), name);
  }
  assert.equal(DEFAULT_CHARACTER, 'jim');
});

test('a config persisted with tvShowOffices/officeTheme still loads', () => {
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({
    tvShowOffices: true,
    officeTheme: 'dunder',
    triggersMigratedV1: true,
    defaultModel: 'legacy-model'
  }));
  let cfg;
  assert.doesNotThrow(() => { cfg = readConfig(); });
  assert.equal(cfg.defaultModel, 'legacy-model');
  assert.equal(cfg.tvShowOffices, true);
});
