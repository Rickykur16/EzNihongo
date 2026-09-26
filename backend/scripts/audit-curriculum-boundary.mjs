import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/db.js';
import { auditCurriculumBoundary } from '../src/curriculum-boundary-audit.js';

export function parseArgs(argv) {
  const options = { persistReports: false, pageSize: 100, format: 'jsonl' };
  let selectedMode = null;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--persist-reports') { options.persistReports = true; selectedMode = selectedMode || 'persist'; if (selectedMode !== 'persist') throw new Error('conflicting_audit_mode'); }
    else if (value === '--dry-run') { options.persistReports = false; selectedMode = selectedMode || 'dry'; if (selectedMode !== 'dry') throw new Error('conflicting_audit_mode'); }
    else if (value === '--course') options.course = argv[++i];
    else if (value === '--module-id') options.moduleId = argv[++i];
    else if (value === '--lesson-id') options.lessonId = argv[++i];
    else if (value === '--content-type') options.contentType = argv[++i];
    else if (value === '--run-id') options.auditRunId = argv[++i];
    else if (value === '--correlation-id') options.correlationId = argv[++i];
    else if (value === '--page-size') options.pageSize = Number(argv[++i]);
    else if (value === '--format') options.format = argv[++i];
    else throw new Error(`unknown_argument:${value}`);
  }
  if (!['jsonl', 'csv'].includes(options.format)) throw new Error('invalid_format');
  return options;
}

const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
function outputWriter(format) {
  if (format === 'jsonl') return {
    result: result => console.log(JSON.stringify({ type: 'content', ...result })),
    summary: summary => console.log(JSON.stringify({ type: 'summary', ...summary })),
  };
  console.log('type,content_type,content_id,status,valid,violation_count,warning_count,decision,content_fingerprint,boundary_fingerprint');
  return {
    result: result => console.log([
      'content', result.contentType, result.contentId, result.report.status, result.report.valid,
      result.report.violations?.length || 0, result.report.warnings?.length || 0, result.decision.decision,
      result.contentFingerprint, result.boundaryFingerprint,
    ].map(csv).join(',')),
    summary: summary => console.log([
      'summary', '', '', summary.dryRun ? 'dry_run' : 'persisted', '', summary.violations, summary.warnings,
      `scanned=${summary.scanned};inserted=${summary.insertedReports};skipped=${summary.skippedReports}`, '', '',
    ].map(csv).join(',')),
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_required');
  const options = parseArgs(argv);
  const output = outputWriter(options.format);
  const client = await db.connect();
  let pending = Promise.resolve();
  const serialQuery = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  try {
    await client.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${options.persistReports ? '' : ' READ ONLY'}`);
    const summary = await auditCurriculumBoundary(options, {
      dbQuery: serialQuery, onResult: output.result,
    });
    await client.query('COMMIT');
    output.summary(summary);
    return summary;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ type: 'error', code: error.message }));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
