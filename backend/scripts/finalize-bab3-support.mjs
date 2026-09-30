import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const { db } = await import('../src/db.js');
const { finalizeBab3Support } = await import('../src/bab3-support-finalization.js');

export async function main(argv = process.argv.slice(2), { run = finalizeBab3Support } = {}) {
  if (argv.length !== 1 || argv[0] !== '--apply') throw new Error('Usage: finalize-bab3-support.mjs --apply');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_required');
  return run();
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error.message, details: error.details || error.report }));
    process.exitCode = 1;
  }).finally(() => db.end().catch(() => {}));
}
