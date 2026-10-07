import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import options from '../content/n4-support/comprehension-options.mjs';

// Match the pure fingerprint functions in dialogue-question-service.js. This
// content generator runs without installing the backend's database packages.
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value ?? null);
const hash = value => `sha256:${createHash('sha256').update(stable(value)).digest('hex')}`;
const dialogueTurns = grammar => {
  const names = new Map((grammar.dialog_scene?.participants || []).map(p =>
    [String(p?.speaker || ''), String(p?.displayName || p?.speaker || '')]));
  return String(grammar.example_dialog || '').split(/\r?\n/u).map(line => line.trim())
    .filter(Boolean).map(line => {
      const match = line.match(/^([^:：]{1,40})[:：]\s*(.*)$/u);
      const speaker = match ? match[1].trim() : '';
      return { speaker: names.get(speaker) || speaker,
        text: match ? match[2].trim() : line };
    });
};
const dialogueFingerprint = grammar => hash({ version: 1,
  dialogue: String(grammar.example_dialog || '').normalize('NFC'),
  translation: String(grammar.example_dialog_id || '').normalize('NFC'),
  goal: String(grammar.communication_goal || '').normalize('NFC'),
  turns: dialogueTurns(grammar) });
const questionFingerprint = question => hash({ version: 1, kind: question.kind,
  prompt: question.prompt, options: question.options,
  correctIndex: question.correctIndex, explanation: question.explanation,
  evidence: question.evidence || null });

const planUrl = new URL('../content/n4-support/dialogue-plan.json', import.meta.url);
const kanjiPlan = JSON.parse(await readFile(new URL('../content/n4-support/dialogue-kanji-plan.json', import.meta.url), 'utf8'));
const outputUrl = new URL('../migrations/193_n4_comprehension_questions.sql', import.meta.url);
const sourceKey = id => `n4-comprehension-193:${id}`;

export function buildQuestions(plan) {
  if (plan.items.length !== 47 || kanjiPlan.items.length !== 47 || options.length !== 47 ||
      new Set(options.map(([id]) => id)).size !== 47) throw Error('n4_comprehension_scope_invalid');
  const authored = new Map(options.map(([id, turns, wrongA, wrongB]) =>
    [id, { turns: Array.isArray(turns) ? turns : [turns], wrongA, wrongB }]));
  const kanjiById = new Map(kanjiPlan.items.map(item => [item.grammarId, item]));
  return plan.items.map((item, index) => {
    const choice = authored.get(item.grammarId);
    const kanji = kanjiById.get(item.grammarId);
    if (!choice || item.checks.length !== 2 ||
        kanji?.expected.example_dialog !== item.replacement.example_dialog ||
        kanji.expected.example_dialog_id !== item.replacement.example_dialog_id) {
      throw Error(`n4_comprehension_check_missing:${item.grammarId}`);
    }
    const currentDialogue = { ...item.replacement,
      example_dialog: kanji.replacement.example_dialog };
    const { prompt, answer, explanation } = item.checks[0];
    const turns = dialogueTurns(currentDialogue);
    const evidence = choice.turns.map(turnIndex => {
      if (!Number.isInteger(turnIndex) || !turns[turnIndex]?.text) {
        throw Error(`n4_comprehension_turn_invalid:${item.grammarId}`);
      }
      return { turnIndex, quote: turns[turnIndex].text };
    });
    const wrong = [choice.wrongA, choice.wrongB];
    if (wrong.some(value => typeof value !== 'string' || !value.trim()) ||
        new Set([answer, ...wrong].map(value => value.trim().toLocaleLowerCase())).size !== 3) {
      throw Error(`n4_comprehension_options_invalid:${item.grammarId}`);
    }
    const correctIndex = index % 3;
    const choices = [...wrong];
    choices.splice(correctIndex, 0, answer);
    const question = { kind: 'comprehension', prompt, options: choices,
      correctIndex, explanation, evidence, sortOrder: 0 };
    return { grammarId: item.grammarId, moduleId: item.moduleId,
      sourceLessonId: item.lessonId, sourceKey: sourceKey(item.grammarId),
      expected: { example_dialog: currentDialogue.example_dialog,
        example_dialog_id: item.replacement.example_dialog_id,
        communication_goal: item.replacement.communication_goal,
        participants: item.replacement.dialog_scene.participants.map(({ speaker, displayName }) =>
          ({ speaker, displayName })) },
      dialogueFingerprint: dialogueFingerprint(currentDialogue),
      questionFingerprint: questionFingerprint(question), question };
  });
}

export function questionSql(plan, items) {
  const payload = JSON.stringify({ courseId: plan.courseId, items }, null, 2);
  return `-- Give every authored N4 conversation one server-graded comprehension question.
-- The second existing reading check remains available as optional practice.
-- Abort if any dialogue or question was edited after the reviewed N4 snapshot.
DO $migration$
DECLARE p jsonb := $content$${payload}$content$::jsonb;
  item jsonb; existing_count integer; actual_participants jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || (p->>'courseId')));
  IF NOT EXISTS (SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4')
    THEN RAISE EXCEPTION '193: N4 course changed'; END IF;
  IF jsonb_array_length(p->'items') <> 47 OR
     (SELECT count(*) FROM n4_dialogue_backup_190) <> 47
    THEN RAISE EXCEPTION '193: N4 dialogues incomplete'; END IF;
  LOCK TABLE module_grammar,grammar_dialog_questions IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO existing_count FROM grammar_dialog_questions
    WHERE source_kind='manual' AND source_key LIKE 'n4-comprehension-193:%';
  IF existing_count NOT IN (0,47) THEN RAISE EXCEPTION '193: partial question set'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM module_grammar g
      JOIN modules m ON m.id=g.module_id
      JOIN lessons l ON l.id=g.lesson_id
      JOIN lessons c ON c.conversation_source_lesson_id=l.id AND c.type='conversation'
      WHERE g.id=(item->>'grammarId')::uuid
        AND g.module_id=(item->>'moduleId')::uuid
        AND g.lesson_id=(item->>'sourceLessonId')::uuid
        AND m.course_id=(p->>'courseId')::uuid AND l.module_id=m.id
        AND g.example_dialog=item->'expected'->>'example_dialog'
        AND g.example_dialog_id=item->'expected'->>'example_dialog_id'
        AND g.communication_goal=item->'expected'->>'communication_goal'
    ) THEN RAISE EXCEPTION '193: dialogue changed: %',item->>'grammarId'; END IF;
    SELECT jsonb_agg(jsonb_build_object('speaker',v.participant->>'speaker',
      'displayName',v.participant->>'displayName') ORDER BY v.position)
      INTO actual_participants
      FROM module_grammar g,
        jsonb_array_elements(g.dialog_scene->'participants') WITH ORDINALITY
          AS v(participant,position)
      WHERE g.id=(item->>'grammarId')::uuid;
    IF actual_participants IS DISTINCT FROM item->'expected'->'participants'
      THEN RAISE EXCEPTION '193: dialogue speakers changed: %',item->>'grammarId'; END IF;
    IF existing_count=47 THEN
      IF NOT EXISTS (SELECT 1 FROM grammar_dialog_questions q
          WHERE q.grammar_id=(item->>'grammarId')::uuid
            AND q.source_lesson_id=(item->>'sourceLessonId')::uuid
            AND q.source_kind='manual' AND q.source_key=item->>'sourceKey'
            AND q.state='active' AND q.kind='comprehension'
            AND q.question_fingerprint=item->>'questionFingerprint'
            AND q.dialogue_fingerprint=item->>'dialogueFingerprint')
        THEN RAISE EXCEPTION '193: applied question changed: %',item->>'grammarId'; END IF;
    ELSIF EXISTS (SELECT 1 FROM grammar_dialog_questions q
        WHERE q.grammar_id=(item->>'grammarId')::uuid)
      THEN RAISE EXCEPTION '193: question already authored: %',item->>'grammarId'; END IF;
  END LOOP;
  IF existing_count=47 THEN RETURN; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO grammar_dialog_questions
      (grammar_id,source_lesson_id,kind,prompt,options,correct_index,
       explanation,sort_order,question_fingerprint,dialogue_fingerprint,
       evidence,source_kind,source_key,state)
    VALUES ((item->>'grammarId')::uuid,(item->>'sourceLessonId')::uuid,
      'comprehension',item->'question'->>'prompt',item->'question'->'options',
      (item->'question'->>'correctIndex')::integer,
      item->'question'->>'explanation',0,item->>'questionFingerprint',
      item->>'dialogueFingerprint',item->'question'->'evidence',
      'manual',item->>'sourceKey','active');
  END LOOP;
END
$migration$;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(await readFile(planUrl, 'utf8'));
  const items = buildQuestions(plan);
  await writeFile(outputUrl, questionSql(plan, items));
  console.log(`Generated ${items.length} N4 comprehension questions`);
}
