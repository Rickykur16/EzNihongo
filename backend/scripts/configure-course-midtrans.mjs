import { readFile, stat, writeFile, rename, chown, chmod, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export function courseMerchantMode(input) {
  const key = input.trim();
  if (/^SB-Mid-server-[A-Za-z0-9_-]+$/.test(key)) return { key, mode: 'sandbox', base: 'https://app.sandbox.midtrans.com', api: 'https://api.sandbox.midtrans.com' };
  if (/^Mid-server-[A-Za-z0-9_-]+$/.test(key)) return { key, mode: 'production', base: 'https://app.midtrans.com', api: 'https://api.midtrans.com' };
  throw new Error('invalid_course_server_key_format');
}

export function courseMerchantEnv(original, merchant) {
  const keep = original.split(/\r?\n/).filter(line =>
    !/^\s*(?:export\s+)?COURSE_(?:MIDTRANS_SERVER_KEY|MIDTRANS_BASE|APP_URL)\s*=/.test(line));
  return keep.join('\n').trimEnd() + '\n' +
    'COURSE_MIDTRANS_SERVER_KEY="' + merchant.key + '"\n' +
    'COURSE_MIDTRANS_BASE=' + merchant.base + '\n' +
    'COURSE_APP_URL=https://eznihongo.com\n';
}

export async function validateCourseMerchant(merchant, request = fetch) {
  // Read-only lookup: no charge, session or transaction is created.
  let response, body;
  try {
    response = await request(merchant.api + '/v2/EZN-CONFIG-CHECK-' + randomUUID() + '/status', {
      headers: { Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(merchant.key + ':').toString('base64') },
      signal: AbortSignal.timeout(15000),
    });
    body = await response.json();
  } catch { throw new Error('course_merchant_verification_unavailable'); }
  if (![200, 404].includes(response.status) || String(body?.status_code) !== '404') throw new Error('course_merchant_key_rejected');
}

async function atomicEnv(path, text, attributes) {
  const temp = path + '.course-midtrans-' + randomUUID();
  try {
    await writeFile(temp, text, { flag: 'wx', mode: attributes.mode & 0o777 });
    await chown(temp, attributes.uid, attributes.gid);
    await chmod(temp, attributes.mode & 0o777);
    await rename(temp, path);
  } finally { await unlink(temp).catch(() => {}); }
}

async function healthy() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const health = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(3000) });
      const body = await health.json();
      const hook = await fetch('http://127.0.0.1:3001/api/course-payments/webhook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000),
      });
      if (health.ok && body.ok === true && hook.status === 403 && (await hook.json()).error === 'bad_signature') return true;
    } catch { /* API may still be starting. */ }
    await delay(2000);
  }
  return false;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 4096) throw new Error('invalid_course_server_key_format');
  }
  const merchant = courseMerchantMode(input);
  input = '';
  await validateCourseMerchant(merchant);
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  const [original, attributes] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
  if (!attributes.isFile()) throw new Error('server_env_is_not_a_file');
  await atomicEnv(path, courseMerchantEnv(original, merchant), attributes);
  try {
    execFileSync('systemctl', ['restart', 'eznihongo-api'], { stdio: 'ignore' });
    if (!(await healthy())) throw new Error('configured_api_health_check_failed');
  } catch {
    await atomicEnv(path, original, attributes);
    try { execFileSync('systemctl', ['restart', 'eznihongo-api'], { stdio: 'ignore' }); } catch {}
    throw new Error('configuration_failed_previous_env_restored');
  }
  console.log('Self Learning merchant configured: ' + merchant.mode + '; API healthy; unsigned notifications rejected.');
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Fixed codes only: never print secrets, provider responses, headers or .env.
    const allowed = ['invalid_course_server_key_format', 'course_merchant_verification_unavailable', 'course_merchant_key_rejected', 'server_env_is_not_a_file', 'configuration_failed_previous_env_restored'];
    console.error(allowed.includes(error.message) ? error.message : 'course_merchant_configuration_failed');
    process.exitCode = 1;
  });
}
