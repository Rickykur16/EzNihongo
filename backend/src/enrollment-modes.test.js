import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { enrollmentOffer, enrollmentModeFields } from './enrollment-modes.js';

const course = { slug: 'n5', title: 'Kelas N5', is_free: false, price_idr: 799000,
  self_learning_enabled: true, self_learning_price_idr: 249000, bootcamp_enabled: true };

test('Self Learning price is independent of Bootcamp and unknown modes fail closed', () => {
  assert.equal(enrollmentOffer(course, 'self_learning').priceIdr, 249000);
  assert.equal(enrollmentOffer(course, 'bootcamp').priceIdr, 799000);
  assert.equal(enrollmentOffer(course).mode, 'bootcamp');
  for (const mode of ['', null, 'free', {}, ['bootcamp']]) assert.equal(enrollmentOffer(course, mode).error, 'invalid_learning_mode');
  assert.equal(enrollmentOffer({ ...course, self_learning_enabled: false }, 'self_learning').error, 'learning_mode_unavailable');
  assert.equal(enrollmentOffer({ ...course, bootcamp_enabled: false }, 'bootcamp').error, 'learning_mode_unavailable');
  assert.equal(enrollmentOffer({ ...course, is_free: true }, 'self_learning').isFree, false);
  assert.equal(enrollmentOffer({ ...course, is_available: false }, 'self_learning').priceIdr, 249000);
  assert.equal(enrollmentOffer({ ...course, is_available: false }, 'bootcamp').error, 'course_not_available');
});

test('admin mode settings reject coercions, invalid money and partial updates preserve omitted fields', () => {
  assert.deepEqual(enrollmentModeFields({}), { bootcamp: null, self: null, price: null });
  assert.deepEqual(enrollmentModeFields({ bootcampEnabled: false, selfLearningEnabled: true, selfLearningPriceIdr: 249000 }), { bootcamp: false, self: true, price: 249000 });
  for (const value of [0, -1, 1.5, '249000', null, 2147483648]) assert.ok(enrollmentModeFields({ selfLearningPriceIdr: value }).error);
  assert.ok(enrollmentModeFields({ selfLearningEnabled: 'true' }).error);
});

test('both signup pages send the selected mode and Self Learning always uses orders', async () => {
  const calls = [];
  const context = vm.createContext({ window: { ezApi: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ order: { id: 'order-self' } }) };
  } } });
  vm.runInContext(await readFile(new URL('../../src/registration-form.js', import.meta.url), 'utf8'), context);
  const offers = context.registrationOptions({ ...course, is_free: true });
  assert.equal(offers.length, 2);
  assert.ok(offers[0].features.every(feature => !feature.includes('live class')));
  const result = await context.submitCourseRegistration(offers[0]);
  assert.equal(result.orderId, 'order-self');
  assert.deepEqual(calls, [{ url: '/orders', body: { courseSlug: 'n5', learningMode: 'self_learning' } }]);
  const unavailable = context.registrationOptions({ ...course, self_learning_enabled: false, bootcamp_enabled: false });
  assert.equal(unavailable.length, 0);
  const independentlyOpen = context.registrationOptions({ ...course, is_available: false });
  assert.equal(independentlyOpen.length, 1);
  assert.equal(independentlyOpen[0].learning_mode, 'self_learning');
  assert.equal(independentlyOpen[0].is_available, true);
});
