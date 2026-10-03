#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { plan } from './plan.mjs';
import { build } from './build.mjs';
import { ideas, ideasMessage, loadIdea, remember } from './ideas.mjs';
import { runBot } from './bot.mjs';
import { sendFile, sendText, telegramEnabled } from './telegram.mjs';

const OUT = 'out';
const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));

const USAGE = `Pemakaian:
  npm run ideas                          Claude riset & usulkan 5 ide  → out/ideas/<tanggal>/ideas.md
  npm run ideas -- --notify              …lalu kirim ke Telegram (untuk cron mingguan)
  npm run plan -- --idea <nomor>         kerjakan ide terpilih → naskah + review.md
  npm run plan -- "topik bebas"          naskah dari topik sendiri
  npm run build -- [folder]              suara + foto + render (default: naskah terakhir)
  npm run bot                            bot Telegram: /ide, /buat <n>, /render`;

try {
  if (cmd === 'ideas') {
    const { dir, list } = await ideas({ outRoot: OUT });
    if (flags.has('--notify')) {
      if (!telegramEnabled()) throw new Error('--notify butuh TELEGRAM_BOT_TOKEN dan TELEGRAM_ADMIN_CHAT_ID.');
      await sendText(ideasMessage(list));
      await sendFile(path.join(dir, 'ideas.md'), { caption: 'Detail ide + sumber' });
    }
  } else if (cmd === 'plan' && flags.has('--idea') && args[0]) {
    const idea = await loadIdea(OUT, Number(args[0]));
    await plan(idea.title, { outRoot: OUT, idea });
  } else if (cmd === 'plan' && args.length) {
    await plan(args.join(' '), { outRoot: OUT });
  } else if (cmd === 'build') {
    const dir = args[0] || (await fs.readFile(path.join(OUT, 'latest-plan.txt'), 'utf8')).trim();
    await build(dir, { force: flags.has('--force') });
    const script = JSON.parse(await fs.readFile(path.join(dir, 'script.json'), 'utf8'));
    await remember(OUT, script.title);
  } else if (cmd === 'bot') {
    await runBot();
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exitCode = 1;
}
