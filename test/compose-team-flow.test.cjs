'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const loadTs = require('./load-ts.cjs');
const { nextStep, existingAgentsOf, cardsFromResponse, prepareWrite } =
  loadTs('src/renderer/src/components/composeTeamFlow.ts');

const SPEC = 'munder-difflin/hire@1';

test('nextStep: questions → questions', () => {
  assert.equal(nextStep('analyzing', { kind: 'questions', analysis: 'a', questions: ['q?'] }), 'questions');
});

test('nextStep: agents → proposal', () => {
  assert.equal(nextStep('analyzing', { kind: 'agents', agents: [], invalid: [] }), 'proposal');
});

test('nextStep: error → error', () => {
  assert.equal(nextStep('analyzing', { kind: 'error', error: 'boom' }), 'error');
});

test('existing agents exclude god', () => {
  const agents = [
    { name: 'Michael', description: 'boss', isGod: true },
    { name: 'Jim', description: 'sales' },
    { name: 'Pam', description: '' }
  ];
  assert.deepEqual(existingAgentsOf(agents), [
    { name: 'Jim', description: 'sales' },
    { name: 'Pam', description: '' }
  ]);
});

test('cards: valid agents checked, invalid ones unchecked with their errors', () => {
  const cards = cardsFromResponse({
    kind: 'agents',
    agents: [{ manifest: { spec: SPEC, name: 'Jim', description: 'd' }, why: 'because' }],
    invalid: [{ name: 'Bad', errors: ['"goal" exceeds 4000 chars'] }]
  });
  assert.equal(cards.length, 2);
  assert.equal(cards[0].checked, true);
  assert.equal(cards[0].manifest.name, 'Jim');
  assert.equal(cards[0].why, 'because');
  assert.equal(cards[1].checked, false);
  assert.equal(cards[1].invalid, true);
  assert.deepEqual(cards[1].errors, ['"goal" exceeds 4000 chars']);
});

test('prepareWrite revalidates checked cards and drops the failing ones', () => {
  const cards = cardsFromResponse({
    kind: 'agents',
    agents: [
      { manifest: { spec: SPEC, name: 'Jim' }, why: '' },
      { manifest: { spec: SPEC, name: 'Pam' }, why: '' },
      { manifest: { spec: SPEC, name: 'Dwight' }, why: '' }
    ],
    invalid: []
  });
  cards[1].manifest = { ...cards[1].manifest, name: 'x'.repeat(41) };
  cards[2].checked = false;
  const r = prepareWrite(cards);
  assert.deepEqual(r.manifests.map((m) => m.name), ['Jim']);
  assert.equal(r.cardErrors[0].length, 0);
  assert.ok(r.cardErrors[1].length > 0);
  assert.equal(r.cardErrors[2].length, 0);
});
