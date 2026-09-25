import { query } from './db.js';
import { extractKanjiCharacters } from './kanji-compounds.js';

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim();
}

function termKey(value) {
  return cleanText(value).toLocaleLowerCase('ja');
}

function uniqueTextFields(fields) {
  const seen = new Set();
  const out = [];
  for (const field of fields || []) {
    const text = cleanText(field?.text ?? field);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function firstIntroductions(rows, values) {
  const first = new Map();
  for (const row of rows || []) {
    for (const value of values(row)) {
      const key = termKey(value);
      if (!key) continue;
      const current = first.get(key);
      if (!current || Number(row.module_sort) < Number(current.module_sort)) {
        first.set(key, { ...row, value: String(value).trim() });
      }
    }
  }
  return first;
}

function readableChapter(row) {
  return `Bab ${Number(row.module_sort) || '?'}${row.module_title ? ` (${row.module_title})` : ''}`;
}

function isKanaDecodingAssessment(scope) {
  return scope?.course_slug === 'n5' && [
    'assignment-bab-1-hiragana',
    'assignment-bab-2-katakana',
  ].includes(scope?.lesson_slug);
}

// The warning is intentionally conservative and non-blocking. It only reports
// exact curriculum evidence: unseen kanji, vocabulary whose Japanese form or
// reading first appears later, and an explicitly linked future grammar item.
export function buildLearningScopeWarnings({ scope, fields, kanjiRows = [], vocabularyRows = [], linkedGrammar = null }) {
  if (!scope) return [];
  const targetSort = Number(scope.module_sort);
  const texts = uniqueTextFields(fields);
  const joined = texts.join('\n');
  const warnings = [];

  const kanjiFirst = firstIntroductions(kanjiRows, (row) => [row.character]);
  const futureKanji = [];
  const unknownKanji = [];
  for (const character of extractKanjiCharacters(joined)) {
    const intro = kanjiFirst.get(character);
    if (!intro) unknownKanji.push(character);
    else if (Number(intro.module_sort) > targetSort) futureKanji.push({ character, intro });
  }
  if (futureKanji.length) {
    const detail = futureKanji.slice(0, 8).map(({ character, intro }) => `${character} (${readableChapter(intro)})`).join(', ');
    warnings.push({
      code: 'future_kanji',
      message: `Kanji belum diajarkan sampai Bab ${targetSort}: ${detail}${futureKanji.length > 8 ? ', ...' : ''}.`,
    });
  }
  if (unknownKanji.length) {
    warnings.push({
      code: 'unregistered_kanji',
      message: `Kanji belum terdaftar di kurikulum kursus ini: ${unknownKanji.slice(0, 12).join('・')}${unknownKanji.length > 12 ? '...' : ''}.`,
    });
  }

  // Bab 1-2 N5 deliberately use familiar words and nonwords as carrier text:
  // the assessed skill is decoding kana, not understanding their meaning.
  // Kanji remains checked, but vocabulary progression must not create noise.
  if (!isKanaDecodingAssessment(scope)) {
    const vocabFirst = firstIntroductions(vocabularyRows, (row) => [row.japanese, row.reading]);
    const futureVocabulary = [];
    for (const [key, intro] of vocabFirst) {
      if (Number(intro.module_sort) <= targetSort || Array.from(key).length < 2) continue;
      if (texts.some((text) => text.toLocaleLowerCase('ja').includes(key))) futureVocabulary.push(intro);
    }
    const distinctFutureVocabulary = [...new Map(futureVocabulary
      .sort((a, b) => Number(a.module_sort) - Number(b.module_sort))
      .map((row) => [`${row.japanese}:${row.module_sort}`, row])).values()];
    if (distinctFutureVocabulary.length) {
      const detail = distinctFutureVocabulary.slice(0, 8)
        .map((row) => `${row.japanese}${row.reading ? ` (${row.reading})` : ''} - ${readableChapter(row)}`)
        .join(', ');
      warnings.push({
        code: 'future_vocabulary',
        message: `Kosakata dari bab berikutnya terdeteksi: ${detail}${distinctFutureVocabulary.length > 8 ? ', ...' : ''}.`,
      });
    }
  }

  if (linkedGrammar && (linkedGrammar.course_id !== scope.course_id || Number(linkedGrammar.module_sort) > targetSort)) {
    warnings.push({
      code: 'future_grammar',
      message: linkedGrammar.course_id !== scope.course_id
        ? 'Pola grammar yang ditautkan berasal dari kursus lain.'
        : `Pola grammar yang ditautkan baru diajarkan di ${readableChapter(linkedGrammar)}.`,
    });
  }

  return warnings;
}

async function curriculumRows(courseId, dbQuery) {
  const [kanji, vocabulary] = await Promise.all([
    dbQuery(
      `SELECT k.character, m.sort_order AS module_sort, m.title AS module_title
         FROM kanji_items k
         JOIN lessons l ON l.id = k.lesson_id
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
        ORDER BY m.sort_order, k.sort_order, k.id`,
      [courseId]
    ),
    dbQuery(
      `SELECT v.japanese, v.reading, m.sort_order AS module_sort, m.title AS module_title
         FROM module_vocabulary v
         JOIN modules m ON m.id = v.module_id
        WHERE m.course_id = $1
        ORDER BY m.sort_order, v.sort_order, v.id`,
      [courseId]
    ),
  ]);
  return { kanjiRows: kanji.rows, vocabularyRows: vocabulary.rows };
}

async function warningsForScope(scope, fields, grammarId, dbQuery) {
  if (!scope) return [];
  const [{ kanjiRows, vocabularyRows }, grammar] = await Promise.all([
    curriculumRows(scope.course_id, dbQuery),
    grammarId ? dbQuery(
      `SELECT g.id, m.course_id, m.sort_order AS module_sort, m.title AS module_title
         FROM module_grammar g JOIN modules m ON m.id = g.module_id
        WHERE g.id = $1`, [grammarId]
    ) : Promise.resolve({ rows: [] }),
  ]);
  return buildLearningScopeWarnings({
    scope,
    fields,
    kanjiRows,
    vocabularyRows,
    linkedGrammar: grammar.rows[0] || null,
  });
}

export async function quizLearningScopeWarnings(questionId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT q.question, q.audio_script, q.passage, q.explanation, q.grammar_id,
            c.slug AS course_slug, l.slug AS lesson_slug,
            m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM quiz_questions q
       JOIN lessons l ON l.id = q.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE q.id = $1`, [questionId]
  );
  const row = result.rows[0];
  if (!row) return [];
  const options = await dbQuery(
    `SELECT option_text FROM quiz_options WHERE question_id = $1 ORDER BY sort_order, id`,
    [questionId]
  );
  return warningsForScope(row, [
    { label: 'soal', text: row.question },
    { label: 'passage', text: row.passage },
    { label: 'audio/dialog', text: row.audio_script },
    ...options.rows.map((option) => ({ label: 'opsi', text: option.option_text })),
  ], row.grammar_id, dbQuery);
}

export async function grammarLearningScopeWarnings(grammarId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT g.example, g.example_dialog, m.course_id,
            m.sort_order AS module_sort, m.title AS module_title
       FROM module_grammar g JOIN modules m ON m.id = g.module_id
      WHERE g.id = $1`, [grammarId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [row.example, row.example_dialog], null, dbQuery);
}

export async function grammarExampleLearningScopeWarnings(exampleId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT e.japanese, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM grammar_examples e
       JOIN module_grammar g ON g.id = e.grammar_id
       JOIN modules m ON m.id = g.module_id
      WHERE e.id = $1`, [exampleId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [row.japanese], null, dbQuery);
}

export async function vocabularyExampleLearningScopeWarnings(exampleId, dbQuery = query) {
  const result = await dbQuery(
    `SELECT e.japanese, m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM vocabulary_examples e
       JOIN module_vocabulary v ON v.id = e.vocabulary_id
       JOIN modules m ON m.id = v.module_id
      WHERE e.id = $1`, [exampleId]
  );
  const row = result.rows[0];
  if (!row) return [];
  return warningsForScope(row, [row.japanese], null, dbQuery);
}

export async function lessonContentLearningScopeWarnings(lessonId, fields, dbQuery = query) {
  const result = await dbQuery(
    `SELECT c.slug AS course_slug, l.slug AS lesson_slug,
            m.course_id, m.sort_order AS module_sort, m.title AS module_title
       FROM lessons l JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1`, [lessonId]
  );
  const scope = result.rows[0];
  if (!scope) return [];
  return warningsForScope(scope, fields, null, dbQuery);
}
