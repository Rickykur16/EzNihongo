import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/db.js';
import { backfillDialogueQuestions, validateBackfillScope } from '../src/dialogue-question-backfill.js';

export function parseArgs(argv) {
  const options = { courseIds: [], moduleIds: [], lessonIds: [], apply: false };
  let mode = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply' || arg === '--dry-run') {
      const next = arg === '--apply' ? 'apply' : 'dry';
      if (mode && mode !== next) throw new Error('conflicting_backfill_mode');
      mode = next; options.apply = next === 'apply';
    } else if (['--course-id', '--module-id', '--lesson-id', '--run-id'].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`missing_value:${arg}`);
      if (arg === '--course-id') options.courseIds.push(value);
      if (arg === '--module-id') options.moduleIds.push(value);
      if (arg === '--lesson-id') options.lessonIds.push(value);
      if (arg === '--run-id') {
        if (options.runId) throw new Error('duplicate_run_id');
        options.runId = value;
      }
    } else throw new Error(`unknown_argument:${arg}`);
  }
  return validateBackfillScope(options);
}

export async function main(argv = process.argv.slice(2), {
  run = backfillDialogueQuestions, write = line => console.log(line),
} = {}) {
  const options = parseArgs(argv);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_required');
  const report = await run(options);
  for (const row of report.rows) write(JSON.stringify({ type: 'question', runId: report.runId,
    dryRun: report.dryRun, ...row }));
  write(JSON.stringify({ type: 'summary', ...report, rows: undefined }));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ type: 'error', code: error.message }));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
