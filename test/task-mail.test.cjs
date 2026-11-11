'use strict';

/**
 * Inbox cards lead with the title of the task a mail is about (from
 * hive/tasks.json) instead of the agents' own shorthand subject.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { findMailTask, cleanTaskTitle, looksFrench, frenchTaskLine } = loadTs('src/shared/taskMail.ts');

const tasks = [
  { id: 'O1', title: 'Opportunités : les vraies bonnes affaires partent trop vite' },
  { id: 'O1a', title: 'Opportunités : meilleures lignes vérifiées d\'abord' },
  { id: 'O1c', title: 'Opportunités : veille en direct des 5 meilleures lignes tant que l\'onglet est ouvert (choix de Damien)' },
  { id: 'FIN', title: 'Fin de l audit : push de main et nettoyage' },
  { id: 'broken' }
];

test('the first task id the subject names wins, as a whole token', () => {
  const subject = 'O1c terminé — feat/O1c-opp-veille @ aa9e2df (sur O1a ef28676), 1470 réussis / 0 échec';
  assert.equal(findMailTask(subject, 'O1', tasks)?.id, 'O1c');
  assert.equal(findMailTask('Rebase sur O1a puis O1c', '', tasks)?.id, 'O1a');
  assert.equal(findMailTask('QA O1c-verdict', '', tasks)?.id, 'O1c');
});

test('ids match case-sensitively, never inside a word or a longer id', () => {
  assert.equal(findMailTask('fin de journée', '', tasks), null);
  assert.equal(findMailTask('O1cx et O1b', '', tasks), null);
});

test('falls back on the conversation when it is a task id, else nothing', () => {
  assert.equal(findMailTask('Verdict QA', 'O1', tasks)?.id, 'O1');
  assert.equal(findMailTask('Verdict QA', 'random-conv', tasks), null);
  assert.equal(findMailTask('O1c', '', []), null);
});

test('the sentence reads naturally', () => {
  const title = cleanTaskTitle(tasks[2].title);
  assert.equal(title, 'Opportunités : veille en direct des 5 meilleures lignes tant que l\'onglet est ouvert');
  assert.equal(frenchTaskLine('done', title), `J'ai terminé « ${title} »`);
  assert.equal(cleanTaskTitle('Quatre choix (âge par ligne, veille en direct, lien avec la Chasse)'),
    'Quatre choix (âge par ligne, veille en direct, lien avec la Chasse)');
  assert.equal(looksFrench(title), true);
  assert.equal(looksFrench('Fix the search popup max button'), false);
});
