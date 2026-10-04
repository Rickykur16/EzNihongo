import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Menjalankan src/registration-form.js ASLI (dipakai checkout DAN dashboard)
// dengan ezApi/DOM tiruan — memastikan urutan kirimnya tidak berubah diam-diam.
const source = await readFile(new URL('../../src/registration-form.js', import.meta.url), 'utf8');

function setup(responses = {}) {
  const calls = [];
  const inputs = {};
  const document = {
    getElementById: (id) => (inputs[id] ||= { value: '', checked: id === 'c-consent' }),
  };
  const window = {
    ezApi: async (path, opts = {}) => {
      calls.push([opts.method || 'GET', path, opts.body ? JSON.parse(opts.body) : null]);
      const [status, body] = responses[path] || [200, {}];
      return { ok: status < 400, status, json: async () => body };
    },
  };
  const ctx = vm.createContext({ window, document, URLSearchParams });
  vm.runInContext(source, ctx);
  return { ctx, calls, inputs };
}

test('paid course: profile saved first, then an order; result carries the order id', async () => {
  const { ctx, calls } = setup({ '/orders': [201, { order: { id: 'o-1' } }] });
  const steps = [];
  const result = await ctx.submitCourseRegistration({ slug: 'n5', is_free: false }, { needsProfile: true, onStep: (s) => steps.push(s) });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { kind: 'order', orderId: 'o-1' });
  assert.deepEqual(calls.map(([m, p]) => `${m} ${p}`), ['PUT /profile/marketing', 'POST /orders']);
  assert.equal(calls[0][2].courseSlug, 'n5');
  assert.equal(calls[0][2].consent, true);
  assert.deepEqual(calls[1][2], { courseSlug: 'n5' });
  assert.deepEqual(steps, ['profile', 'order']);
});

test('free course without profile questions: straight to enrollment', async () => {
  const { ctx, calls } = setup();
  const result = await ctx.submitCourseRegistration({ slug: 'gratis', is_free: true }, { needsProfile: false });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { kind: 'enrolled', slug: 'gratis' });
  assert.deepEqual(calls.map(([m, p]) => `${m} ${p}`), ['POST /enrollments']);
});

test('server error code surfaces unchanged and stops before the order', async () => {
  const { ctx, calls } = setup({ '/profile/marketing': [400, { error: 'invalid_phone' }] });
  await assert.rejects(ctx.submitCourseRegistration({ slug: 'n5', is_free: false }, { needsProfile: true }), /invalid_phone/);
  assert.deepEqual(calls.map(([m, p]) => `${m} ${p}`), ['PUT /profile/marketing']);
  assert.equal(vm.runInContext("PROFILE_ERRORS.invalid_phone[0]", ctx), 'c-phone');
  assert.match(ctx.registrationErrorMessage('already_enrolled'), /sudah terdaftar/);
  assert.match(ctx.registrationErrorMessage('something_new'), /belum berhasil diproses/);
});

test('privacy link follows the page that renders the form', () => {
  const { ctx } = setup();
  assert.match(ctx.profileFieldsHtml(), /href="\.\.\/privacy\.html"/);
  assert.match(ctx.profileFieldsHtml({ privacyHref: 'privacy.html' }), /href="privacy\.html"/);
});
