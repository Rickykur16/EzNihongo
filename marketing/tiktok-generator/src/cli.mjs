#!/usr/bin/env node
import 'dotenv/config';
import { plan } from './plan.mjs';
import { build } from './build.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const arg = rest.filter((a) => a !== '--force').join(' ').trim();

try {
  if (cmd === 'plan' && arg) await plan(arg);
  else if (cmd === 'build' && arg) await build(arg, { force });
  else {
    console.log(`Pemakaian:
  npm run plan -- "topik atau berita"     riset + naskah → out/<tanggal-slug>/review.md
  npm run build -- out/<tanggal-slug>     suara + foto + render → video.mp4 (setelah review)`);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exitCode = 1;
}
