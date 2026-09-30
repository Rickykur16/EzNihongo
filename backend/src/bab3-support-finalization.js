import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { withTransaction } from './db.js';
import { lockCurriculumCourse } from './curriculum-content-service.js';
import { loadTaskConcepts, loadModulePool } from './routes/grammar-task.js';
import { contentRevisionId, validateCompanionEnvelope } from './bunpou-flow-service.js';
import { dialogueFingerprint, questionsRevision, saveDialogueQuestions } from './dialogue-question-service.js';
import { learningFlowReadiness } from './learning-flow-config.js';

const plan = JSON.parse(await readFile(new URL('../content/bab3/grammar-support.json', import.meta.url), 'utf8'));
const fail = (code, details) => { const error = new Error(code); error.details = details; throw error; };

// Called immediately after migrations and before the new backend restarts.
// No rollout flag or curriculum mode changes, and no writes to student history.
export async function finalizeBab3Support({ transaction = withTransaction } = {}) {
  return transaction(async client => {
    const installed = (await client.query("SELECT to_regclass('n5_b3_grammar_support_backup_180') AS source_backup")).rows[0];
    if (!installed?.source_backup) return { status: 'not_applicable', reason: 'migration_180_not_applied' };
    const scopes = (await client.query(`SELECT c.id AS course_id,m.id AS module_id
      FROM courses c JOIN modules m ON m.course_id=c.id
      WHERE c.slug='n5' AND m.slug='n5-b3'`)).rows;
    if (!scopes.length) return { status: 'not_applicable', reason: 'n5_bab3_not_present' };
    if (scopes.length !== 1) fail('bab3_support_scope_ambiguous', { count: scopes.length });
    const { course_id: courseId, module_id: moduleId } = scopes[0];
    await lockCurriculumCourse(client, courseId);
    const previous = (await client.query('SELECT report FROM n5_b3_support_finalization_182 WHERE module_id=$1', [moduleId])).rows[0];
    if (previous) return { status: 'already_finalized', moduleId };
    const applied = (await client.query(`SELECT count(*)::int AS count
      FROM n5_b3_grammar_support_backup_180 b JOIN module_grammar g ON g.id=b.grammar_id
      WHERE g.module_id=$1`, [moduleId])).rows[0].count;
    if (!applied) return { status: 'not_applicable', reason: 'migration_180_not_applied_to_module', moduleId };
    if (applied !== 6) fail('bab3_support_migration_180_incomplete');

    const sources = (await client.query(`SELECT s.*,t.id AS task_lesson_id,t.slug AS task_slug
      FROM lessons s JOIN lessons t ON t.popup_after_lesson_id=s.id
        AND t.module_id=s.module_id AND t.type='grammar_task'
      WHERE s.module_id=$1 AND s.slug=ANY($2::text[])
      ORDER BY s.slug FOR UPDATE OF s,t`, [moduleId, [...new Set(plan.items.map(item => item.lesson))]])).rows;
    if (sources.length !== 2 || new Set(sources.map(s => s.slug)).size !== 2) fail('bab3_support_source_mapping_invalid');
    const grammars = (await client.query(`SELECT g.* FROM module_grammar g
      WHERE g.lesson_id=ANY($1::uuid[]) ORDER BY g.lesson_id,g.sort_order,g.id FOR UPDATE`, [sources.map(s => s.id)])).rows;
    if (grammars.length !== 6) fail('bab3_support_grammar_count_invalid');
    const backups = (await client.query(`SELECT grammar_id FROM n5_b3_grammar_support_backup_180
      WHERE grammar_id=ANY($1::uuid[])`, [grammars.map(g => g.id)])).rows;
    const sourceBackups = (await client.query(`SELECT lesson_id FROM n5_b3_grammar_lessons_backup_180
      WHERE lesson_id=ANY($1::uuid[])`, [sources.map(s => s.id)])).rows;
    if (backups.length !== 6 || sourceBackups.length !== 2) fail('bab3_support_migration_180_incomplete');
    const oldQuestions = (await client.query(`SELECT * FROM grammar_dialog_questions
      WHERE grammar_id=ANY($1::uuid[]) ORDER BY grammar_id,kind,sort_order,id FOR UPDATE`, [grammars.map(g => g.id)])).rows;
    if (oldQuestions.some(q => q.state === 'active')) fail('bab3_support_unreviewed_active_questions');

    const prepared = [];
    for (const source of sources) {
      const expected = plan.items.filter(item => item.lesson === source.slug);
      if (expected.length !== 3 || expected.some(item => item.task !== source.task_slug)) fail('bab3_support_task_mapping_changed');
      const owned = grammars.filter(g => g.lesson_id === source.id);
      if (owned.length !== 3) fail('bab3_support_lesson_grammar_invalid');
      for (const item of expected) {
        const matches = owned.filter(g => g.pattern === item.pattern);
        if (matches.length !== 1) fail('bab3_support_pattern_changed', { pattern: item.pattern });
        const grammar = matches[0];
        const examples = (await client.query(`SELECT japanese,highlight,indonesian FROM grammar_examples
          WHERE grammar_id=$1 ORDER BY sort_order,id`, [grammar.id])).rows;
        if (grammar.notes !== item.notes || grammar.example !== item.examples[0].japanese ||
            grammar.communication_goal !== item.dialogue.situation ||
            grammar.recognition_distractors !== item.recognitionDistractors.join('\n') ||
            grammar.controlled_distractors !== item.controlledDistractors.join('\n') ||
            !isDeepStrictEqual(grammar.practice_config, item.drills) || grammar.example_dialog !== item.dialogue.japanese ||
            grammar.example_dialog_id !== item.dialogue.indonesian ||
            !isDeepStrictEqual(examples, item.examples)) fail('bab3_support_authored_source_changed', { grammarId: grammar.id });
        if (source.bunpou_flow_published?.objective !== plan.objective ||
            source.bunpou_flow_draft?.objective !== plan.objective ||
            source.bunpou_flow_published?.directions?.[grammar.id] !== item.direction ||
            source.bunpou_flow_draft?.directions?.[grammar.id] !== item.direction ||
            !isDeepStrictEqual(source.bunpou_flow_published?.dialogChecks?.[grammar.id], item.dialogChecks) ||
            !isDeepStrictEqual(source.bunpou_flow_draft?.dialogChecks?.[grammar.id], item.dialogChecks)) {
          fail('bab3_support_reviewed_checks_changed', { grammarId: grammar.id });
        }
        prepared.push({ grammar, item, source });
      }
      const query = client.query.bind(client);
      const items = await loadTaskConcepts(source.task_lesson_id, query);
      const pool = await loadModulePool(source.task_lesson_id, query);
      if (items.length !== 3 || items.some(i => !owned.some(g => g.id === i.id))) fail('bab3_support_task_membership_changed');
      for (const taskItem of items) {
        const authored = expected.find(item => item.pattern === taskItem.pattern);
        if (taskItem.instruction !== authored?.taskInstruction || taskItem.requiredCount !== 1) fail('bab3_support_task_instruction_changed');
      }
      const fingerprint = contentRevisionId(items, pool);
      const published = { ...source.bunpou_flow_published, sourceFingerprint: fingerprint };
      const draft = { ...source.bunpou_flow_draft, sourceFingerprint: fingerprint };
      for (const envelope of [published, draft]) {
        const report = validateCompanionEnvelope(envelope, owned.map(g => g.id));
        if (!report.ok) fail('bab3_support_companion_invalid', report.errors);
      }
      await client.query(`UPDATE lessons SET bunpou_flow_draft=$2::jsonb,
        bunpou_flow_published=$3::jsonb,updated_at=NOW() WHERE id=$1`,
      [source.id, JSON.stringify(draft), JSON.stringify(published)]);
    }

    const created = [];
    for (const { grammar, item, source } of prepared) {
      const rows = oldQuestions.filter(q => q.grammar_id === grammar.id);
      const questions = ['comprehension', 'comparison'].map(kind => ({
        ...item.dialogChecks[kind], kind: kind === 'comparison' ? 'transfer' : 'comprehension', sortOrder: 0,
      }));
      const result = await saveDialogueQuestions(grammar.id, {
        sourceLessonId: source.id,
        expectedDialogueFingerprint: dialogueFingerprint(grammar),
        expectedQuestionsRevision: questionsRevision(rows), questions,
      }, { transaction: fn => fn(client), rejectedReportTransaction: fn => fn(client) });
      if (result.questions.length !== 2) fail('bab3_support_question_write_incomplete');
      created.push(...result.questions.map(q => ({ grammarId: grammar.id, id: q.id, version: q.questionVersion })));
    }
    const readiness = await learningFlowReadiness(client, {
      enabled: true, courseIds: [], moduleIds: [moduleId], lessonIds: [],
    });
    if (!readiness.ready || readiness.lessons.length !== 2) fail('bab3_support_readiness_failed', readiness);
    const report = { status: 'finalized', courseId, moduleId, questionCount: created.length,
      questions: created, readiness };
    await client.query(`INSERT INTO n5_b3_support_finalization_182
      (module_id,before_lessons,before_questions,report) VALUES($1,$2::jsonb,$3::jsonb,$4::jsonb)`,
    [moduleId, JSON.stringify(sources), JSON.stringify(oldQuestions), JSON.stringify(report)]);
    return report;
  });
}
