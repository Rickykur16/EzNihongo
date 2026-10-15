import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const { db } = await import('../src/db.js');
const { finalizeN5B4KosoadoQuestions } = await import('../src/n5-b4-kosoado-questions.js');
export async function main(argv = process.argv.slice(2), { run = finalizeN5B4KosoadoQuestions } = {}) {
  if (argv.length !== 1 || argv[0] !== '--apply') throw Error('Usage: finalize-n5-b4-kosoado-questions.mjs --apply');
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL_required');
  return run();
}
// Runs on every deploy. Any failure is logged, never fatal: it only touches
// one dialogue's question set and must not block an unrelated release.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main()
  .then(report => console.log(JSON.stringify({ task: 'n5-b4-kosoado-questions', ...report })))
  .catch(error => console.error(JSON.stringify({ task: 'n5-b4-kosoado-questions', status: 'failed',
    code: error.message })))
  .finally(() => db.end().catch(() => {}));
