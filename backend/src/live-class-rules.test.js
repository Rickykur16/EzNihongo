import test from 'node:test';
import assert from 'node:assert/strict';
import { canJoinLiveClass, organizeStudentLiveClasses } from './live-class-rules.js';

const now = new Date('2026-09-01T12:00:00.000Z');

test('the next Live Class is the nearest non-expired scheduled class', () => {
  const lists = organizeStudentLiveClasses([
    { id: 'past', status: 'scheduled', startsAt: '2026-09-01T06:00:00Z', endsAt: '2026-09-01T07:00:00Z' },
    { id: 'later', status: 'scheduled', startsAt: '2026-09-03T12:00:00Z', endsAt: '2026-09-03T13:00:00Z' },
    { id: 'next', status: 'scheduled', startsAt: '2026-09-02T12:00:00Z', endsAt: '2026-09-02T13:00:00Z' },
  ], now);
  assert.equal(lists.next.id, 'next');
  assert.deepEqual(lists.upcoming.map((item) => item.id), ['next', 'later']);
});

test('student recordings contain only completed classes that have a recording URL', () => {
  const lists = organizeStudentLiveClasses([
    { id: 'recording', status: 'completed', startsAt: '2026-08-30T12:00:00Z', recordingUrl: 'https://example.test/recording' },
    { id: 'missing-url', status: 'completed', startsAt: '2026-08-31T12:00:00Z' },
    { id: 'scheduled', status: 'scheduled', startsAt: '2026-08-31T12:00:00Z', recordingUrl: 'https://example.test/not-ready' },
  ], now);
  assert.deepEqual(lists.recordings.map((item) => item.id), ['recording']);
});

test('Join Class opens only from fifteen minutes before the class until its end', () => {
  const item = { status: 'scheduled', meetingUrl: 'https://example.test/meet', startsAt: '2026-09-01T12:10:00Z', endsAt: '2026-09-01T13:00:00Z' };
  assert.equal(canJoinLiveClass(item, now), true);
  assert.equal(canJoinLiveClass(item, new Date('2026-09-01T11:54:00Z')), false);
  assert.equal(canJoinLiveClass(item, new Date('2026-09-01T13:01:00Z')), false);
});
