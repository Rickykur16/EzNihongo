import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { summarizeLearningFlowBaseline } from '../src/learning-flow-baseline.js';

export function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index], value = argv[index + 1];
    if (!['--input', '--environment', '--commit'].includes(flag) ||
        !value || value.startsWith('--') || Object.hasOwn(values, flag)) {
      throw new Error('baseline_arguments_invalid');
    }
    values[flag] = value;
  }
  if (Object.keys(values).length !== 3) throw new Error('baseline_arguments_invalid');
  return { input: values['--input'], environment: values['--environment'],
    commitSha: values['--commit'] };
}

export async function main(argv = process.argv.slice(2)) {
  const { input, environment, commitSha } = parseArgs(argv);
  let file, contents;
  try { file = await stat(input); }
  catch { throw new Error('baseline_input_invalid'); }
  if (!file.isFile() || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('baseline_input_invalid');
  }
  try { contents = await readFile(input, 'utf8'); }
  catch { throw new Error('baseline_input_invalid'); }
  const lines = contents.trim().split(/\r?\n/u);
  const summary = summarizeLearningFlowBaseline(lines, { environment, commitSha });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  });
}
