import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLiveClassFields } from './live-class-admin-rules.js';

const valid = { courseId: '0d6d11d1-1111-4111-8111-111111111111', title: 'Grammar Live', startsAt: '2026-09-03T12:00:00Z', endsAt: '2026-09-03T13:00:00Z', status: 'scheduled', meetingUrl: 'https://example.test/meeting', recordingUrl: null };

test('Live Class admin validation accepts canonical course data and normalizes URLs', () => {
  const result = validateLiveClassFields(valid);
  assert.equal(result.ok, true);
  assert.equal(result.meetingUrl, 'https://example.test/meeting');
});

test('Live Class admin validation rejects invalid dates, status, URLs, and course IDs', () => {
  assert.equal(validateLiveClassFields({ ...valid, courseId: 'not-a-course' }).ok, false);
  assert.equal(validateLiveClassFields({ ...valid, endsAt: '2026-09-03T11:00:00Z' }).error, 'endsAt_must_be_after_startsAt');
  assert.equal(validateLiveClassFields({ ...valid, status: 'live-now' }).error, 'invalid_status');
  assert.equal(validateLiveClassFields({ ...valid, meetingUrl: 'javascript:alert(1)' }).error, 'invalid_meetingUrl');
});
