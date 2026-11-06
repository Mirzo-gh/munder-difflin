'use strict';

/**
 * Every literal `var(--cth-…)` the renderer uses must be DEFINED somewhere in
 * the renderer's CSS. An undefined one silently falls back to its inline
 * default, which was written for the old cream theme — on the dark Orca theme
 * that produced white text on a cream chip. Dynamic names (`var(--cth-${x})`)
 * are not literal and are skipped.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.(tsx?|css|html)$/.test(e.name) ? [p] : [];
});

test('every literal var(--cth-*) used in the renderer is defined', () => {
  const files = walk(path.join(root, 'src/renderer'));
  const defined = new Set();
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/(--cth-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }
  const missing = [];
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/var\(\s*(--cth-[a-z0-9-]+)(?![a-z0-9-]|\$)/g)) {
      if (!defined.has(m[1])) missing.push(`${m[1]} (${path.relative(root, f)})`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('the legacy aliases live in tokens.css for both themes', () => {
  const css = fs.readFileSync(path.join(root, 'src/renderer/src/design/tokens.css'), 'utf8');
  const dark = css.slice(css.indexOf(":root[data-cth-theme='dark']"));
  for (const name of ['--cth-mint-700', '--cth-danger']) {
    assert.match(css.slice(0, css.indexOf(":root[data-cth-theme='dark']")), new RegExp(`${name}:`), `${name} light`);
    assert.match(dark, new RegExp(`${name}:`), `${name} dark`);
  }
});
