import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { courseMerchantMode, courseMerchantEnv, validateCourseMerchant } from '../scripts/configure-course-midtrans.mjs';

test('merchant mode is recognized and malformed input cannot become shell or dotenv code', () => {
  assert.equal(courseMerchantMode('SB-Mid-server-dummy_key-1\n').mode, 'sandbox');
  assert.equal(courseMerchantMode('Mid-server-dummy_key-2').mode, 'production');
  for (const input of ['', 'Mid-client-test', 'Mid-server-test\nDATABASE_URL=changed', 'Mid-server-$(command)', 'not-a-key']) assert.throws(() => courseMerchantMode(input), /^Error: invalid_course_server_key_format$/);
});
test('only course settings are replaced; other accounts and database settings are preserved', () => {
  const original = '# existing\nDATABASE_URL=keep\nMIDTRANS_SERVER_KEY=keep-kanji\nCOURSE_MIDTRANS_SERVER_KEY=old\nexport COURSE_MIDTRANS_BASE=old\nCOURSE_MIDTRANS_SERVER_KEY=duplicate\nRELEASE_SHA=keep\n';
  const updated = courseMerchantEnv(original, courseMerchantMode('Mid-server-dummy'));
  assert.ok(updated.includes('MIDTRANS_SERVER_KEY=keep-kanji\n'));
  assert.ok(updated.includes('DATABASE_URL=keep\n'));
  assert.ok(updated.includes('RELEASE_SHA=keep\n'));
  assert.equal(updated.match(/^COURSE_MIDTRANS_SERVER_KEY=/gm).length, 1);
  assert.ok(updated.includes('COURSE_MIDTRANS_BASE=https://app.midtrans.com\n'));
});
test('merchant validation only reads a nonexistent order and rejects auth failures', async () => {
  const merchant = courseMerchantMode('SB-Mid-server-dummy');
  let address;
  await validateCourseMerchant(merchant, async (url, options) => {
    address = url; assert.equal(options.method, undefined); assert.equal(options.body, undefined);
    return new Response('{"status_code":"404"}', { status: 404 });
  });
  assert.match(address, /^https:\/\/api\.sandbox\.midtrans\.com\/v2\/EZN-CONFIG-CHECK-[a-f0-9-]+\/status$/);
  await assert.rejects(validateCourseMerchant(merchant, async () => new Response('{"status_code":"401"}', { status: 401 })), /course_merchant_key_rejected/);
  await assert.rejects(validateCourseMerchant(merchant, async () => { throw Error('network'); }), /course_merchant_verification_unavailable/);
});
test('installation is main-only, serialized and uses stdin with strict pinned host checking', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/configure-course-midtrans.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group: deploy-vps/); assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /printf '%s' "\$COURSE_MIDTRANS_SERVER_KEY" \|/);
  assert.doesNotMatch(workflow.split('run: |')[1], /\$\{\{\s*secrets\./);
});
