// Author the JSON banks, then run: node scripts/build-chapter-assessments.mjs
// Migration 166 is immutable history. New Bab 3 support content is applied by
// additive migration 181; --check verifies both layers against the source.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CHAPTER_ASSESSMENT_VERSION, CHAPTER_POLICY, CHAPTER_LABELS, assertChapterForm } from '../src/chapter-assessment.js';

export function stableId(key) {
  const bytes = createHash('md5').update(`${CHAPTER_ASSESSMENT_VERSION}:${key}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function bankRows(bank) {
  return Object.keys(bank.forms).flatMap((form, fi) => bank.forms[form].map((item, i) => ({
    id: stableId(item.id), question: item.prompt,
    question_type: 'multiple_choice',
    question_category: item.category, section_number: Object.keys(CHAPTER_LABELS).indexOf(item.category) + 1,
    section_label: CHAPTER_LABELS[item.category],
    section_instruction: item.category === 'listening' ? 'Dengarkan audio lalu jawab. Audio boleh diputar ulang.' : 'Jawab sesuai konteks. Jawaban dapat diubah sebelum dikirim.',
    passage: item.passage || null, audio_script: item.audioScript || null,
    correct_answer: null, explanation: item.explanation,
    sort_order: fi * 24 + i + 1,
    assessment_meta: { version: bank.version, form, key: item.id, objective: item.objective,
      distractorReasons: item.distractorReasons, ...(item.listeningFocus ? { listeningFocus: item.listeningFocus } : {}) },
    options: item.options.map((text, oi) => ({ id: stableId(`${item.id}:o${oi}`), option_text: text, is_correct: oi === item.answer, sort_order: oi + 1 })),
  })));
}

export function validateBank(bank) {
  if (bank.version !== CHAPTER_ASSESSMENT_VERSION || !Number.isInteger(bank.chapter) || bank.chapter < 3 || bank.chapter > 20) throw new Error('Invalid N5 chapter');
  const forms = bank.chapter === 3 ? ['A', 'B'] : ['A'];
  if (JSON.stringify(Object.keys(bank.forms)) !== JSON.stringify(forms) || (bank.chapter !== 3 && bank.selection !== 'all')) throw new Error('Invalid chapter selection mode');
  if (!bank.title?.trim() || !bank.boundary?.grammar?.length || !bank.boundary.notes?.trim() || !bank.transferTask?.prompt?.trim() || bank.transferTask.rubric?.length < 3) throw new Error(`Incomplete curriculum map: ${bank.chapter}`);
  if (bank.objectives?.some(o => !o.id || !o.canDo?.trim())) throw new Error('Invalid objectives');
  const rows = bankRows(bank);
  for (const form of forms) {
    assertChapterForm(bank, rows.filter(q => q.assessment_meta.form === form));
    const passages = bank.forms[form].filter(q => q.category === 'reading').map(q => q.passage);
    if (new Set(passages).size !== 2 || [...new Set(passages)].some(p => passages.filter(v => v === p).length !== 2)) throw new Error(`Expected two passages with two questions each: ${bank.chapter}/${form}`);
    const audio = bank.forms[form].filter(q => q.category === 'listening').map(q => q.audioScript);
    if (new Set(audio).size !== 4) throw new Error(`Expected four independent audio stimuli: ${bank.chapter}/${form}`);
    const listeningFocus = bank.forms[form].filter(q => q.category === 'listening').map(q => q.listeningFocus);
    if (new Set(listeningFocus).size !== 4 || !['detail','intent','response','inference'].every(focus => listeningFocus.includes(focus))) throw new Error(`Expected balanced listening evidence: ${bank.chapter}/${form}`);
    const seenPrompts = new Set();
    for (const item of bank.forms[form]) {
      if (!new RegExp(`^b${String(bank.chapter).padStart(2,'0')}-${form.toLowerCase()}-`).test(item.id)) throw new Error(`Invalid item ID: ${item.id}`);
      if (!item.prompt?.trim() || !item.explanation?.trim() || item.mode !== 'choice' || 'acceptedAnswers' in item) throw new Error(`Every item must be multiple choice: ${item.id}`);
      // A vocabulary/grammar stem must not state the correct option in plain
      // text. Reading and listening deliberately put the answer in their
      // stimulus, so those categories are excluded from this guard.
      if (!['reading', 'listening'].includes(item.category) &&
          item.prompt.toLocaleLowerCase().includes(item.options[item.answer].toLocaleLowerCase())) {
        throw new Error(`Correct answer leaked into stem ${item.id}`);
      }
      const stimulus = `${item.prompt}|${item.passage || ''}|${item.audioScript || ''}`;
      if (seenPrompts.has(stimulus)) throw new Error(`Duplicate stimulus ${item.id}`);
      seenPrompts.add(stimulus);
      if (!Array.isArray(item.options) || item.options.length !== 4 || !Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3 || item.options.some(o => typeof o !== 'string' || !o.trim()) || new Set(item.options.map(o => o.normalize('NFKC').trim())).size !== 4 || item.distractorReasons?.length !== 4 || item.distractorReasons.some(r => !r?.trim())) throw new Error(`Invalid options/reasons ${item.id}`);
      if (item.category !== 'listening' && 'listeningFocus' in item) throw new Error(`Listening focus on non-listening item ${item.id}`);
      if (item.audioScript?.length > 1500) throw new Error(`Audio too long ${item.id}`);
    }
  }
  if (new Set(rows.map(q => q.id)).size !== 24 * forms.length) throw new Error('Duplicate IDs across forms');
  return rows;
}

const literal = value => value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;

// Only these two stems and the transfer activity changed after migration 166.
// Reconstructing its source lets the existing full-bank consistency check keep
// protecting all 48 questions, keys, options and IDs without rewriting history.
export const BAB3_SUPPORT_KEYS = Object.freeze(['b03-a-v04', 'b03-b-v04']);
export function historicalBab3Bank(bank) {
  const historical = structuredClone(bank);
  historical.forms.A.find(q => q.id === 'b03-a-v04').prompt = 'Lengkapi perkenalan profesi Deni: デニさんは（　）です。';
  historical.forms.B.find(q => q.id === 'b03-b-v04').prompt = 'Lengkapi kewarganegaraan Mina: ミナさんは（　）です。';
  historical.transferTask = {
    prompt: 'Latihan lisan opsional, di luar skor assessment: di pertemuan kelas pertama, gunakan kartu ini: Anda Rina, orang Indonesia, pelajar; Dodi juga pelajar; profesi Yuki belum diketahui. Perkenalkan diri, sampaikan persamaan dengan Dodi, lalu tanyakan profesi Yuki dengan beberapa kalimat pendek bahasa Jepang.',
    rubric: [
      'Nama, kewarganegaraan, dan profesi yang disampaikan sesuai kartu.',
      'Pola は…です, も, dan pertanyaan …ですか digunakan dengan tepat; formulasi sah yang setara diterima.',
      'Pertanyaan meminta informasi yang belum diketahui; pernyataan も benar-benar menyatakan kesamaan.',
    ],
  };
  return historical;
}

export function buildSupportMigration(bank) {
  if (bank.chapter !== 3) throw new Error('Support revision only applies to Bab 3');
  const revisions = validateBank(bank).filter(q => BAB3_SUPPORT_KEYS.includes(q.assessment_meta.key));
  if (revisions.length !== 2) throw new Error('Expected exactly two Bab 3 stimulus repairs');
  const plan = revisions.map(q => ({ id: q.id, key: q.assessment_meta.key, question: q.question }));
  return `-- Generated by scripts/build-chapter-assessments.mjs from n5-b03.json.
-- Add missing identity-card evidence and a concrete final communication task.
-- Source IDs, choices, answer keys, lesson IDs and frozen attempts stay intact.
CREATE TABLE IF NOT EXISTS n5_assessment_support_backup_181 (
  lesson_id UUID PRIMARY KEY,
  before_lesson JSONB NOT NULL,
  before_questions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $support$
DECLARE
  target UUID;
  targets INTEGER;
  revision JSONB;
  plan JSONB := ${json(plan)};
BEGIN
  SELECT count(*), (array_agg(l.id))[1] INTO targets, target
    FROM lessons l JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
    WHERE c.slug = 'n5' AND m.slug = 'n5-b3'
      AND l.slug = 'assignment-bab-3-perkenalan' AND l.type = 'quiz';
  IF targets <> 1 THEN
    RAISE EXCEPTION '181: expected one N5 Bab 3 assignment, found %', targets;
  END IF;
  PERFORM 1 FROM lessons WHERE id = target FOR UPDATE;
  -- A repeat preserves both the original backup and subsequent admin edits.
  IF EXISTS (SELECT 1 FROM n5_assessment_support_backup_181 WHERE lesson_id = target) THEN RETURN; END IF;
  IF (SELECT assessment_policy->>'version' FROM lessons WHERE id = target) IS DISTINCT FROM 'n5-assessment-v2' THEN
    RAISE EXCEPTION '181: unexpected Bab 3 assessment version';
  END IF;
  FOR revision IN SELECT value FROM jsonb_array_elements(plan) LOOP
    PERFORM 1 FROM quiz_questions q
      WHERE q.id = (revision->>'id')::uuid AND q.lesson_id = target
        AND q.assessment_meta->>'key' = revision->>'key'
        AND q.assessment_meta->>'version' = 'n5-assessment-v2'
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '181: missing or changed source question %', revision->>'key'; END IF;
  END LOOP;
  INSERT INTO n5_assessment_support_backup_181(lesson_id, before_lesson, before_questions)
    SELECT target, to_jsonb(l), (
      SELECT jsonb_agg(to_jsonb(q) || jsonb_build_object('options', (
        SELECT jsonb_agg(to_jsonb(o) ORDER BY o.sort_order, o.id)
          FROM quiz_options o WHERE o.question_id = q.id
      )) ORDER BY q.sort_order, q.id)
      FROM quiz_questions q
      WHERE q.lesson_id = target AND q.id IN (
        SELECT (value->>'id')::uuid FROM jsonb_array_elements(plan)
      )
    ) FROM lessons l WHERE l.id = target;

  FOR revision IN SELECT value FROM jsonb_array_elements(plan) LOOP
    UPDATE quiz_questions SET question = revision->>'question'
      WHERE id = (revision->>'id')::uuid AND lesson_id = target;
  END LOOP;
  UPDATE lessons SET assessment_policy = jsonb_set(assessment_policy, '{transferTask}', ${json(bank.transferTask)}, true),
    updated_at = NOW() WHERE id = target;
END;
$support$;
`;
}

export function buildMigration(banks) {
  if (banks.length !== 1 || banks[0].chapter !== 3) throw new Error('Exactly one Bab 3 bank is required');
  let sql = `-- Generated by scripts/build-chapter-assessments.mjs from reviewed JSON banks.\n-- Versioned inserts preserve legacy questions and every historical attempt.\n-- Existing N5 chapter assignment only; fail closed when the curriculum target is ambiguous.\n`;
  for (const bank of banks) {
    const rows = validateBank(bank);
    const policy = { version: bank.version, chapter: bank.chapter, title: bank.title,
      objectives: bank.objectives, boundary: bank.boundary, transferTask: bank.transferTask, ...CHAPTER_POLICY };
    sql += `\nDO $chapter$\nDECLARE v_lesson uuid; v_targets int;\nBEGIN\n  SELECT count(*), (array_agg(l.id))[1] INTO v_targets, v_lesson\n  FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id\n  WHERE c.slug='n5' AND l.type='quiz' AND l.slug LIKE 'assignment-bab-${bank.chapter}-%';\n  IF v_targets <> 1 THEN RAISE EXCEPTION 'Assessment Bab ${bank.chapter}: expected exactly one N5 assignment, found %', v_targets; END IF;\n`;
    for (const q of rows) {
      const fields = ['id','question','question_type','question_category','section_number','section_label','section_instruction','passage','audio_script','correct_answer','explanation','sort_order','assessment_meta'];
      const values = fields.map(k => k === 'assessment_meta' ? json(q[k]) : typeof q[k] === 'number' ? q[k] : literal(q[k]));
      sql += `  INSERT INTO quiz_questions (lesson_id,${fields.join(',')}) VALUES (v_lesson,${values.join(',')})\n  ON CONFLICT (id) DO UPDATE SET ${fields.filter(k=>k!=='id').map(k=>`${k}=EXCLUDED.${k}`).join(',')};\n`;
      for (const o of q.options) sql += `  INSERT INTO quiz_options (id,question_id,option_text,is_correct,sort_order) VALUES (${literal(o.id)},${literal(q.id)},${literal(o.option_text)},${o.is_correct},${o.sort_order})\n  ON CONFLICT (id) DO UPDATE SET option_text=EXCLUDED.option_text,is_correct=EXCLUDED.is_correct,sort_order=EXCLUDED.sort_order;\n`;
    }
    sql += `  UPDATE lessons SET assessment_policy=${json(policy)}, questions_per_attempt=24 WHERE id=v_lesson;\nEND\n$chapter$;\n`;
  }
  return sql;
}

export async function readBanks() {
  const root = new URL('../content/assessments/', import.meta.url);
  const names = (await readdir(root)).filter(n => n === 'n5-b03.json');
  return Promise.all(names.map(name => readFile(new URL(name, root), 'utf8').then(JSON.parse)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const banks = await readBanks();
  const historical = new URL('../migrations/166_rebuild_n5_chapter_assessments.sql', import.meta.url);
  if ((await readFile(historical, 'utf8')).replaceAll('\r\n','\n') !== buildMigration(banks.map(historicalBab3Bank))) {
    throw new Error('Historical migration 166 drift: changes outside the reviewed support revision require a new additive migration');
  }
  const sql = buildSupportMigration(banks[0]);
  const target = new URL('../migrations/181_bab3_assessment_support.sql', import.meta.url);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')).replaceAll('\r\n','\n') !== sql) throw new Error('Migration 181 drift: regenerate reviewed assessment support');
  } else await writeFile(target, sql);
  console.log('Validated Bab 3: 2 forms, 48 items. Historical migration 166 and additive migration 181 match the source.');
}
