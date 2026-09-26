// Author the JSON banks, then run: node scripts/build-chapter-assessments.mjs
// --check verifies that the committed migration matches the reviewed source.
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
  return ['A', 'B'].flatMap((form, fi) => bank.forms[form].map((item, i) => ({
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
  if (bank.version !== CHAPTER_ASSESSMENT_VERSION || bank.chapter !== 3) throw new Error('This release only accepts Bab 3');
  if (!bank.title?.trim() || !bank.boundary?.grammar?.length || !bank.boundary.notes?.trim() || !bank.transferTask?.prompt?.trim() || bank.transferTask.rubric?.length < 3) throw new Error(`Incomplete curriculum map: ${bank.chapter}`);
  if (bank.objectives?.some(o => !o.id || !o.canDo?.trim())) throw new Error('Invalid objectives');
  const rows = bankRows(bank);
  for (const form of ['A','B']) {
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
      const stimulus = `${item.prompt}|${item.passage || ''}|${item.audioScript || ''}`;
      if (seenPrompts.has(stimulus)) throw new Error(`Duplicate stimulus ${item.id}`);
      seenPrompts.add(stimulus);
      if (!Array.isArray(item.options) || item.options.length !== 4 || !Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3 || item.options.some(o => typeof o !== 'string' || !o.trim()) || new Set(item.options.map(o => o.normalize('NFKC').trim())).size !== 4 || item.distractorReasons?.length !== 4 || item.distractorReasons.some(r => !r?.trim())) throw new Error(`Invalid options/reasons ${item.id}`);
      if (item.category !== 'listening' && 'listeningFocus' in item) throw new Error(`Listening focus on non-listening item ${item.id}`);
      if (item.audioScript?.length > 1500) throw new Error(`Audio too long ${item.id}`);
    }
  }
  if (new Set(rows.map(q => q.id)).size !== 48) throw new Error('Duplicate IDs across forms');
  return rows;
}

const literal = value => value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;
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
  const sql = buildMigration(await readBanks());
  const target = new URL('../migrations/166_rebuild_n5_chapter_assessments.sql', import.meta.url);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')).replaceAll('\r\n','\n') !== sql) throw new Error('Migration drift: regenerate reviewed assessment banks');
  } else await writeFile(target, sql);
  console.log('Validated Bab 3: 2 forms, 48 items. Migration matches source.');
}
