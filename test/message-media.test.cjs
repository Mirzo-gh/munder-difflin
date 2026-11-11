'use strict';

/**
 * Conversation view media: attached files shown as thumbnails / chips instead
 * of raw paths, and Claude artifact links shown as preview cards.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { splitAttachedFiles, findArtifactLinks, baseName, dirName, artifactHost } = loadTs('src/shared/messageMedia.ts');
const { parseTranscriptRecord } = loadTs('src/shared/conversation.ts');

test('the composer\'s "Attached files:" block becomes files, the typed text stays', () => {
  const msg = 'Regarde ça\n\nAttached files:\n- C:\\Users\\me\\AppData\\Local\\Temp\\cth-pastes\\paste-1.png (paste-1.png)\n- /home/me/notes.pdf (notes.pdf)';
  const { text, files } = splitAttachedFiles(msg);
  assert.equal(text, 'Regarde ça');
  assert.deepEqual(files, [
    { path: 'C:\\Users\\me\\AppData\\Local\\Temp\\cth-pastes\\paste-1.png', name: 'paste-1.png', image: true },
    { path: '/home/me/notes.pdf', name: 'notes.pdf', image: false }
  ]);
});

test('image only, parentheses inside the path, and no block at all', () => {
  const only = splitAttachedFiles('Attached files:\n- C:\\Program Files (x86)\\a b.JPG (a b.JPG)');
  assert.equal(only.text, '');
  assert.equal(only.files[0].path, 'C:\\Program Files (x86)\\a b.JPG');
  assert.equal(only.files[0].image, true);
  assert.deepEqual(splitAttachedFiles('Attached files: none'), { text: 'Attached files: none', files: [] });
  assert.deepEqual(splitAttachedFiles('bonjour'), { text: 'bonjour', files: [] });
});

test('a Claude Code [Image #N] placeholder is dropped (the picture is inline)', () => {
  const r = splitAttachedFiles('vois\n\nAttached files:\n- [Image #1] (paste-1.png)');
  assert.equal(r.text, 'vois');
  assert.deepEqual(r.files, []);
});

test('path helpers work for both separators', () => {
  assert.equal(baseName('C:\\a\\b.png'), 'b.png');
  assert.equal(dirName('C:\\a\\b.png'), 'C:\\a');
  assert.equal(dirName('C:\\b.png'), 'C:\\');
  assert.equal(dirName('/tmp/b.png'), '/tmp');
  assert.equal(dirName('/b.png'), '/');
});

test('artifact links are found once each, with their Markdown title', () => {
  const md = 'Voici le tableau : [Ventes **2026**](https://claude.ai/artifact/abc-123).\n' +
    'Encore https://claude.ai/artifact/abc-123 et https://claude.ai/code/artifact/0f2e-9a.\n' +
    'Pas un artefact : https://claude.ai/chat/xyz';
  assert.deepEqual(findArtifactLinks(md), [
    { url: 'https://claude.ai/artifact/abc-123', title: 'Ventes 2026' },
    { url: 'https://claude.ai/code/artifact/0f2e-9a' }
  ]);
  assert.deepEqual(findArtifactLinks('[https://claude.site/artifacts/x1](https://claude.site/artifacts/x1)'), [
    { url: 'https://claude.site/artifacts/x1' }
  ]);
  assert.equal(artifactHost('https://claude.site/artifacts/x1'), 'claude.site');
});

test('an image pasted straight into Claude Code keeps a data: URL for its thumbnail', () => {
  const items = parseTranscriptRecord({
    type: 'user', uuid: 'u1',
    message: { content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } },
      { type: 'image', source: { type: 'url', url: 'https://x/y.png' } },
      { type: 'text', text: 'regarde' }
    ] }
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].images, 2);
  assert.deepEqual(items[0].imageUrls, ['data:image/png;base64,iVBORw0KGgo=']);
});
