const { test } = require('node:test');
const assert = require('node:assert/strict');
const { courseView } = require('./landing-cms.js');
test('legacy prices stay hidden until explicitly published by admin', () => {
  const course = { slug: 'n5', price_idr: 899, price_label: 'Old price', period_label: '/ bulan', is_available: true };
  assert.equal(courseView(course).price, '');
  assert.equal(courseView(course).canOpenDetails, false);
  assert.equal(courseView({ ...course, landing_price_published: 'true' }).price, '');
  assert.equal(courseView({ ...course, landing_price_published: true }).price, 'Old price');
  assert.equal(courseView({ ...course, landing_price_published: true, is_available: false }).canOpenDetails, false);
});
test('published price handles free, unset, and unsafe course slugs', () => {
  assert.equal(courseView({ landing_price_published: true, is_free: true }).price, 'Gratis');
  assert.equal(courseView({ landing_price_published: true, price_idr: null }).price, '');
  assert.equal(courseView({ landing_price_published: true, price_label: 'Set by admin', slug: '../admin' }).canOpenDetails, false);
});
