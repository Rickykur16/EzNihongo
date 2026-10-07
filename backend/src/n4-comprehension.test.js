import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildQuestions, questionSql } from '../scripts/build-n4-comprehension.mjs';
import { dialogueFingerprint, questionFingerprint, dialogueTurns } from './dialogue-question-service.js';

const plan = JSON.parse(await readFile(new URL('../content/n4-support/dialogue-plan.json', import.meta.url)));
const kanjiPlan = JSON.parse(await readFile(new URL('../content/n4-support/dialogue-kanji-plan.json', import.meta.url)));

test('all 47 N4 dialogues have a grounded, distinct comprehension question', () => {
  const items = buildQuestions(plan);
  assert.equal(items.length, 47);
  assert.equal(new Set(items.map(item => item.grammarId)).size, 47);
  for (const [index, item] of items.entries()) {
    const source = plan.items[index];
    const current = { ...source.replacement,
      example_dialog: kanjiPlan.items.find(row => row.grammarId === item.grammarId).replacement.example_dialog };
    const turns = dialogueTurns(current);
    const question = item.question;
    assert.equal(question.prompt, source.checks[0].prompt);
    assert.equal(question.options[question.correctIndex], source.checks[0].answer);
    assert.equal(question.explanation, source.checks[0].explanation);
    assert.equal(question.options.length, 3);
    assert.equal(new Set(question.options.map(value => value.toLocaleLowerCase())).size, 3);
    assert.ok(question.evidence.length >= 1);
    for (const evidence of question.evidence) {
      assert.ok(turns[evidence.turnIndex].text.includes(evidence.quote), item.grammarId);
    }
    assert.equal(item.dialogueFingerprint, dialogueFingerprint(current));
    assert.equal(item.questionFingerprint, questionFingerprint(question));
  }
});

test('committed migration matches the reviewed N4 authoring data', async () => {
  const generated = questionSql(plan, buildQuestions(plan));
  const committed = await readFile(new URL('../migrations/193_n4_comprehension_questions.sql', import.meta.url), 'utf8');
  assert.equal(committed, generated);
});
