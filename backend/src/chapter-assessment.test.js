import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bankRows, readBanks, validateBank, buildMigration } from '../scripts/build-chapter-assessments.mjs';
import { createChapterSnapshot, publicChapterQuestions, gradeChapterAssessment, validateChapterDraft } from './chapter-assessment.js';

const banks = await readBanks();
const first = banks.find(b => b.chapter === 3);
const snapshot = () => createChapterSnapshot(first, bankRows(first), 'B');
const answers = (s, match = () => true) => new Map(s.questions.map(q => [q.id, { correct: match(q) }]));

test('the Bab 3 bank meets the blueprint and the checked-in migration matches the source', async () => {
  assert.equal(banks.length, 1);
  assert.equal(banks[0].chapter, 3);
  for (const bank of banks) assert.equal(validateBank(bank).length, 48, `chapter ${bank.chapter}`);
  const generated = buildMigration(banks);
  const committed = await readFile(new URL('../migrations/166_rebuild_n5_chapter_assessments.sql', import.meta.url), 'utf8');
  assert.ok(committed.replaceAll('\r\n','\n') === generated, 'Regenerate migration 166 after editing the reviewed JSON banks');
});

test('forms alternate, snapshot is isolated, and public questions reveal no answers or scripts', () => {
  const rows = bankRows(first);
  const a = createChapterSnapshot(first, rows, 'B');
  assert.equal(a.form, 'A');
  assert.equal(createChapterSnapshot(first, rows, a.form).form, 'B');
  rows[0].options[0].option_text = 'Edited after start';
  assert.notEqual(a.questions[0].options[0].option_text, rows[0].options[0].option_text);
  for (const q of publicChapterQuestions(a)) {
    for (const key of ['correct_answer','assessment_meta','explanation','audio_script','acceptedAnswers']) assert.equal(key in q, false, key);
    assert.ok(q.options.every(o => !('is_correct' in o)));
  }
  assert.equal(publicChapterQuestions(a).filter(q => q.has_audio).length, 4);
});

test('high totals cannot compensate for a missing assessment category', () => {
  const s = snapshot();
  for (const category of ['vocabulary','grammar','reading','listening']) {
    const grade = gradeChapterAssessment(s, answers(s, q => q.question_category !== category));
    assert.equal(grade.passed, false);
    assert.equal(grade.sectionResults.find(r => r.key === category).passed, false);
  }
  const perfect = gradeChapterAssessment(s, answers(s));
  assert.equal(perfect.passed, true);
  assert.equal(perfect.sectionResults.length, 4);
});

test('a missing learning objective is reported separately even when other areas compensate', () => {
  const s = snapshot();
  const goal = s.policy.objectives.at(-1).id;
  const grade = gradeChapterAssessment(s, answers(s, q => q.assessment_meta.objective !== goal));
  assert.equal(grade.passed, false);
  assert.equal(grade.objectiveResults.find(r => r.objectiveId === goal).passed, false);
});

test('draft validation rejects foreign options, duplicate questions, and mixed answer types', () => {
  const s = snapshot(), q = s.questions[0];
  const answer = { questionId: q.id, optionId: q.options[0].id };
  assert.equal(validateChapterDraft(s, [answer]), true);
  assert.equal(validateChapterDraft(s, []), true);
  assert.equal(validateChapterDraft(s, [answer, answer]), false);
  assert.equal(validateChapterDraft(s, [{...answer, optionId:s.questions[1].options[0].id}]), false);
  assert.equal(validateChapterDraft(s, [{...answer, textAnswer:'です'}]), false);
  assert.equal(validateChapterDraft(s, [{questionId:q.id,textAnswer:'です'}]), false);
});
