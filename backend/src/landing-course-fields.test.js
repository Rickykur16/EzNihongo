import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingCourseFields } from './landing-course-fields.js';
test('existing clients cannot accidentally publish a price or erase its publication setting', () => {
  assert.deepEqual(landingCourseFields({}, true), { pricePublished: false, schedule: '' });
  assert.deepEqual(landingCourseFields({ title: 'Updated course' }), { pricePublished: null, schedule: null });
  assert.ok(landingCourseFields({ landingPricePublished: 'false' }).error);
});
test('admin can explicitly publish, hide, update, and clear landing information', () => {
  assert.deepEqual(landingCourseFields({ landingPricePublished: true, landingSchedule: '  Selasa & Kamis, 19.00 WIB  ' }), { pricePublished: true, schedule: 'Selasa & Kamis, 19.00 WIB' });
  assert.deepEqual(landingCourseFields({ landingPricePublished: false, landingSchedule: '' }), { pricePublished: false, schedule: '' });
  assert.ok(landingCourseFields({ landingSchedule: 'x'.repeat(241) }).error);
  assert.ok(landingCourseFields({ landingSchedule: {} }).error);
});
