import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { courseMidtransConfig, validCourseMidtransSignature, courseMidtransState } from './course-midtrans.js';

test('new course merchant never falls back to the Kanji merchant key', () => {
  process.env.MIDTRANS_SERVER_KEY = 'old-kanji-key';
  delete process.env.COURSE_MIDTRANS_SERVER_KEY;
  assert.throws(courseMidtransConfig, /course_midtrans_not_configured/);
  process.env.COURSE_MIDTRANS_SERVER_KEY = 'new-test-key';
  process.env.COURSE_MIDTRANS_BASE = 'https://app.sandbox.midtrans.com';
  assert.equal(courseMidtransConfig().apiBase, 'https://api.sandbox.midtrans.com');
  process.env.COURSE_MIDTRANS_BASE = 'https://app.midtrans.com';
  assert.equal(courseMidtransConfig().apiBase, 'https://api.midtrans.com');
  process.env.COURSE_MIDTRANS_BASE = 'https://attacker.invalid';
  assert.throws(courseMidtransConfig, /course_midtrans_invalid_config/);
});
test('signature uses the new key and compares a full SHA512 digest', () => {
  const p = { order_id: 'EZN-test', status_code: '200', gross_amount: '249000.00' };
  p.signature_key = crypto.createHash('sha512').update(p.order_id + p.status_code + p.gross_amount + 'new-key').digest('hex');
  assert.equal(validCourseMidtransSignature(p, 'new-key'), true);
  assert.equal(validCourseMidtransSignature(p, 'old-key'), false);
  assert.equal(validCourseMidtransSignature({ ...p, signature_key: 'bad' }, 'new-key'), false);
  assert.equal(validCourseMidtransSignature({ ...p, gross_amount: '1.00' }, 'new-key'), false);
});
test('exact order and amount, settlement and accepted capture are required', () => {
  const order = { order_number: 'EZN-test', amount_idr: 249000 };
  const p = { order_id: 'EZN-test', gross_amount: '249000.00', transaction_id: 'txn', transaction_status: 'settlement' };
  assert.equal(courseMidtransState(p, order).paid, true);
  for (const change of [{ gross_amount: '1.00' }, { gross_amount: '249000.01' }, { gross_amount: '2.49e5' }, { order_id: 'other' }, { currency: 'USD' }]) assert.throws(() => courseMidtransState({ ...p, ...change }, order));
  for (const state of ['pending', 'authorize', 'deny', 'expire']) assert.equal(courseMidtransState({ ...p, transaction_status: state }, order).paid, false);
  assert.equal(courseMidtransState({ ...p, transaction_status: 'capture', fraud_status: 'challenge' }, order).paid, false);
  assert.equal(courseMidtransState({ ...p, transaction_status: 'capture', fraud_status: 'accept' }, order).paid, true);
});
