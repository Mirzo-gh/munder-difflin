'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { EFFORT_LEVELS, effortLevelsFor, effortFor, effortArg } = loadTs('src/shared/effort.ts');
const { validateHireManifest } = loadTs('src/shared/hire.ts');
const { buildSpawnCommand } = loadTs('src/renderer/src/store/config.ts');

const cfg = { defaultCommand: 'claude', autoMode: false };

test('effort levels per provider: Claude all five, Codex up to xhigh, others none', () => {
  assert.deepEqual([...effortLevelsFor('claude')], [...EFFORT_LEVELS]);
  assert.deepEqual([...effortLevelsFor('codex')], ['low', 'medium', 'high', 'xhigh']);
  assert.deepEqual([...effortLevelsFor('cursor')], []);
  assert.deepEqual([...effortLevelsFor('antigravity')], []);
  assert.deepEqual([...effortLevelsFor(undefined)], []);
});

test('effortFor clamps above the ceiling and drops unsupported providers', () => {
  assert.equal(effortFor('codex', 'max'), 'xhigh');
  assert.equal(effortFor('codex', 'low'), 'low');
  assert.equal(effortFor('claude', 'max'), 'max');
  assert.equal(effortFor('cursor', 'high'), undefined);
  assert.equal(effortFor('claude', undefined), undefined);
});

test('effortArg renders each CLI flag', () => {
  assert.equal(effortArg('claude', 'high'), '--effort high');
  assert.equal(effortArg('codex', 'max'), '-c model_reasoning_effort=xhigh');
  assert.equal(effortArg('antigravity', 'high'), '');
});

test('buildSpawnCommand appends the effort after the model, before auto flags', () => {
  assert.equal(buildSpawnCommand(cfg, 'claude-opus-5-5', 'claude', 'xhigh'), 'claude --model claude-opus-5-5 --effort xhigh');
  assert.equal(
    buildSpawnCommand({ defaultCommand: 'claude', autoMode: true }, 'gpt-5.6-sol', 'codex', 'high'),
    'codex --model gpt-5.6-sol -c model_reasoning_effort=high -a never -s workspace-write'
  );
  assert.equal(buildSpawnCommand(cfg, undefined, 'claude', 'low'), 'claude --effort low');
  assert.equal(buildSpawnCommand(cfg, 'claude-opus-5-5', 'claude'), 'claude --model claude-opus-5-5');
  assert.ok(!buildSpawnCommand(cfg, 'x', 'cursor', 'high').includes('effort'));
});

test('hire@1 accepts a known effort and rejects anything else', () => {
  const base = { spec: 'munder-difflin/hire@1', name: 'Dwight' };
  const ok = validateHireManifest({ ...base, effort: 'high' });
  assert.equal(ok.ok, true);
  assert.equal(ok.manifest.effort, 'high');
  assert.equal(validateHireManifest({ ...base }).manifest.effort, undefined);
  const bad = validateHireManifest({ ...base, effort: 'turbo' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes('"effort"')));
});
