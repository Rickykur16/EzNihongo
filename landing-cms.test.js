const { test } = require('node:test');
const assert = require('node:assert/strict');
const { courseView, coursePriceSummary } = require('./landing-cms.js');
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

test('FAQ prices match course cards while unpublished prices and courses stay private', () => {
  const courses = [
    { title: 'Kelas N4', sort_order: 2, price_idr: 449000, price_label: 'Rp 449rb', period_label: '/ bulan', landing_price_published: false },
    { title: 'Kelas N5', sort_order: 1, price_idr: 1500000, price_label: 'Rp1.500.000', period_label: '/ 3 bulan', landing_price_published: true, is_available: false },
    { title: 'Draf', is_published: false, price_label: 'Harga draf', landing_price_published: true },
  ];
  assert.equal(coursePriceSummary(courses), 'Kelas N5: Rp1.500.000 / 3 bulan. Kelas N4: harga belum diumumkan');
  assert.equal(coursePriceSummary([]), 'Rincian harga kelas belum diumumkan.');
  assert.equal(coursePriceSummary([{ title: 'Kelas contoh', landing_price_published: true, is_free: true, period_label: '/ bulan' }]), 'Kelas contoh: Gratis');
});
