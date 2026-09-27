import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/db.js';
import { prepareBab3LearningFlow, validateBab3PreparationOptions } from
  '../src/bab3-learning-flow-preparation.js';

export function parseArgs(argv) {
  const options = { apply: false };
  let mode = null;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--apply' || arg === '--dry-run') {
      const next = arg === '--apply' ? 'apply' : 'dry';
      if (mode && mode !== next) throw new Error('conflicting_preparation_mode');
      mode = next;
      options.apply = next === 'apply';
      continue;
    }
    if (!['--course-id', '--module-id', '--run-id'].includes(arg)) {
      throw new Error(`unknown_argument:${arg}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`missing_value:${arg}`);
    const key = arg === '--course-id' ? 'courseId' : arg === '--module-id' ? 'moduleId' : 'runId';
    if (options[key]) throw new Error(`duplicate_value:${arg}`);
    options[key] = value;
  }
  return validateBab3PreparationOptions(options);
}

export async function main(argv = process.argv.slice(2), {
  run = prepareBab3LearningFlow, write = value => console.log(value),
} = {}) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_required');
  const report = await run(parseArgs(argv));
  write(JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ type: 'error', code: error.message,
      readiness: error.readiness || undefined }, null, 2));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
