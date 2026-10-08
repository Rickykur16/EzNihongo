(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root?.document) return;
  let storage;
  try { storage = root.localStorage; } catch {}
  const queue = api.create({
    storage,
    getUserId: () => root.ezGetAuthenticatedUserId?.() || null,
    send: (payload, userId) => root.ezApi('/practice/attempts', {
      method: 'POST', expectedUserId: userId,
      body: JSON.stringify({ ...payload, expectedUserId: userId }),
    }),
    uuid: () => root.crypto.randomUUID(),
    onStatus: detail => root.dispatchEvent(new CustomEvent('ez:practice-sync', { detail })),
  });
  root.EzPracticeQueue = queue;
  for (const event of ['online', 'ez:auth-changed']) root.addEventListener(event, () => queue.flush());
  root.addEventListener('storage', event => { if (event.key?.startsWith(api.PREFIX)) queue.flush(); });
  root.document.addEventListener('visibilitychange', () => {
    if (root.document.visibilityState === 'visible') queue.flush();
  });
  queue.flush();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PREFIX = 'ez_practice_attempt_v1:';
  function create({ storage, getUserId, send, uuid, onStatus = () => {},
    now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
    const memory = new Map();
    let running = null, timer = null, failures = 0, lastOrder = 0;
    const prefix = userId => `${PREFIX}${userId}:`;
    const keyOf = record => `${prefix(record.userId)}${record.payload.eventId}`;
    function read(userId) {
      const records = new Map();
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key?.startsWith(prefix(userId))) continue;
          try {
            const value = JSON.parse(storage.getItem(key));
            if (value?.userId === userId && value.payload?.eventId && keyOf(value) === key) records.set(key, value);
          } catch {}
        }
      } catch {}
      for (const [key, value] of memory) if (value.userId === userId) records.set(key, value);
      return [...records.values()].sort((a, b) => a.order - b.order || a.payload.eventId.localeCompare(b.payload.eventId));
    }
    function persist(record) {
      const key = keyOf(record);
      try { storage.setItem(key, JSON.stringify(record)); memory.delete(key); return true; }
      catch { memory.set(key, record); return false; }
    }
    function status(userId, error = null) {
      if (getUserId() !== userId) return;
      const records = read(userId);
      onStatus({ pending: records.length, error: error || records.find(record => record.retryError)?.retryError || null,
        durable: records.every(record => !memory.has(keyOf(record))),
        blocked: records.filter(record => record.blocked).length });
    }
    function retry(delay) {
      if (timer !== null) cancel(timer);
      timer = schedule(() => { timer = null; flush(); }, delay);
    }
    function enqueue(payload) {
      const userId = getUserId();
      if (!userId) return false;
      // One key per event avoids a read/modify/write race between browser tabs.
      const record = { userId, order: lastOrder = Math.max(now(), lastOrder + 1),
        payload: { itemType: payload.itemType, itemId: payload.itemId, skill: payload.skill,
          isCorrect: !!payload.isCorrect, source: payload.source, lessonId: payload.lessonId,
          eventId: uuid() } };
      const durable = persist(record);
      status(userId, durable ? null : 'storage_unavailable');
      flush();
      return record.payload.eventId;
    }
    function flush() {
      if (timer !== null) { cancel(timer); timer = null; }
      if (running) return running;
      const userId = getUserId();
      if (!userId) { onStatus({ pending: 0, error: null, durable: true, blocked: 0 }); return Promise.resolve(); }
      running = (async () => {
        // Persist memory-only fallback again before each delivery attempt.
        for (const record of memory.values()) if (record.userId === userId) persist(record);
        let delivered = 0;
        while (getUserId() === userId) {
          const records = read(userId).filter(record => !record.blocked);
          const record = records.find(record => !record.retryAt || record.retryAt <= now());
          if (!record) {
            status(userId);
            if (records.length) retry(Math.max(0, Math.min(...records.map(record => record.retryAt)) - now()));
            return;
          }
          try {
            const response = await send(record.payload, userId);
            const body = await response.json();
            if (getUserId() !== userId) return;
            if (!response.ok || body?.ok !== true) {
              // One expired course must not delay answers from other courses.
              // Retain the event and periodically recheck entitlement.
              if (response.status === 403) {
                record.retryAt = now() + 60000;
                record.retryError = body?.error || 'http_403';
                persist(record); status(userId, record.retryError); continue;
              }
              // Keep rejected evidence for inspection; it must not block other
              // answers, disappear, or be silently rewritten to a new event ID.
              if ([400, 404, 409].includes(response.status)) {
                record.blocked = body?.error || `http_${response.status}`;
                persist(record); status(userId, record.blocked); continue;
              }
              throw new Error(body?.error || `http_${response.status}`);
            }
            // The server acknowledged this event; memory-only fallback no
            // longer needs retention even if browser storage cleanup fails.
            memory.delete(keyOf(record));
            storage?.removeItem(keyOf(record));
            failures = 0; status(userId);
            if (++delivered >= 100) { retry(0); return; }
          } catch (error) {
            if (getUserId() === userId) {
              status(userId, error?.message || 'network_error');
              retry(Math.min(60000, 1000 * 2 ** Math.min(failures++, 6)));
            }
            return;
          }
        }
      })().finally(() => {
        running = null;
        // Account B may have been verified while A's request was in flight.
        if (getUserId() && getUserId() !== userId) retry(0);
      });
      return running;
    }
    return { enqueue, flush, pending: () => getUserId() ? read(getUserId()).length : 0 };
  }
  return { create, PREFIX };
}));
