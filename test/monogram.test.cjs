'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { monogramLetters } = loadTs('src/renderer/src/components/monogram.ts');

test('un mot → deux premières lettres en minuscules', () => assert.equal(monogramLetters('Jim'), 'ji'));
test('deux mots → initiales', () => assert.equal(monogramLetters('Jean Oscar'), 'jo'));
test('trois mots → initiales des deux premiers', () => assert.equal(monogramLetters('a b c'), 'ab'));
test('une lettre', () => assert.equal(monogramLetters('X'), 'x'));
test('accents conservés', () => assert.equal(monogramLetters('Élodie'), 'él'));
test('séparateurs - _ . comptent comme espaces', () => assert.equal(monogramLetters('api-server'), 'as'));
test('vide / sans alphanumérique', () => { assert.equal(monogramLetters(''), '??'); assert.equal(monogramLetters('🚀 !!'), '??'); });
test('espaces superflus ignorés', () => assert.equal(monogramLetters('  pam  '), 'pa'));
