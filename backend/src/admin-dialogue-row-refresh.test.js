// Runs the real admin.html helpers that reload a Percakapan dialogue row from
// the server before it is shown or edited (Bab 19: the admin kept showing the
// pre-migration-186 cast while students saw the rewritten dialogue).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
function slice(from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing source boundaries: ${from}`);
  return html.slice(start, end);
}
const source = [
  slice('function updateSavedRowRevision', 'function markSavedRowValues'),
  slice('function dialogStatusHtml', 'function itemRowHtml'),
  slice('async function admReloadCourseState', 'window.grmrManageDialog'),
].join('\n');

const OLD = { example_dialog: 'A: やすみに、どこへいきたいですか。\nB: にほんへいきたいです。',
  dialog_scene: { participants: [{ characterKey: 'anna-wijaya' }, { characterKey: 'hadi-pratama' }] } };
const NEW = { example_dialog: 'A: やすみに なにを したいですか。\nB: うみへ いきたいです。\nA: いいですね。',
  dialog_scene: { participants: [{ characterKey: 'aoi-takahashi' }, { characterKey: 'anna-wijaya' }] } };

function input(value) { return { value, defaultValue: value }; }
function row(item, revision) {
  const fields = {
    pattern: input('〜たいです'),
    example_dialog: input(item.example_dialog),
    dialog_scene: input(JSON.stringify(item.dialog_scene)),
    sortOrder: input('0'),
  };
  const status = { innerHTML: '' };
  return { fields, status, dataset: { id: 'g1', revision },
    querySelector(selector) {
      if (selector === '.dialog-status') return status;
      return fields[selector.match(/name="([^"]+)"/)?.[1]] || null;
    },
    querySelectorAll: () => Object.values(fields) };
}
function setup({ modules, api } = {}) {
  const ctx = vm.createContext({
    STATE: { selectedCourse: 'n5', modules: modules || [] },
    GRAMMAR_FIELDS: [{ name: 'pattern' }, { name: 'example_dialog', type: 'textarea' }, { name: 'dialog_scene', type: 'textarea' }],
    itemFieldValue: (f, item) => ['dialog_scene', 'dialog_furigana'].includes(f.name) && item[f.name]
      ? JSON.stringify(item[f.name]) : (item[f.name] || ''),
    api: api || (async () => ({ course: { modules: modules || [] } })),
  });
  vm.runInContext(source, ctx, { filename: 'admin.html:row-refresh' });
  return ctx;
}
const stored = { id: 'g1', pattern: '〜たいです', sort_order: 0, updated_at: '2026-10-01T03:00:00.000Z', ...NEW };

test('a clean stale row takes the stored dialogue, cast and revision', () => {
  const ctx = setup({ modules: [{ grammar: [stored] }] });
  const tr = row(OLD, '2026-09-20T00:00:00.000Z');
  assert.equal(ctx.admApplyFreshGrammarRow(tr), 'refreshed');
  assert.equal(tr.fields.example_dialog.value, NEW.example_dialog);
  assert.match(tr.fields.dialog_scene.value, /aoi-takahashi/);
  assert.equal(tr.fields.dialog_scene.defaultValue, tr.fields.dialog_scene.value, 'refresh is not an unsaved edit');
  assert.equal(tr.dataset.revision, stored.updated_at, 'the next save sends the current revision');
  assert.equal(tr.status.innerHTML, '3 giliran');
});

test('a row already at the stored revision is left untouched', () => {
  const ctx = setup({ modules: [{ grammar: [stored] }] });
  const tr = row(OLD, '2026-10-01T03:00:00Z');
  assert.equal(ctx.admApplyFreshGrammarRow(tr), 'current');
  assert.equal(tr.fields.example_dialog.value, OLD.example_dialog);
});

test('unsaved edits are never overwritten by the refresh', () => {
  const ctx = setup({ modules: [{ grammar: [stored] }] });
  const tr = row(OLD, '2026-09-20T00:00:00.000Z');
  tr.fields.example_dialog.value = 'A: まだ ほぞんしていません。';
  assert.equal(ctx.admApplyFreshGrammarRow(tr), 'dirty');
  assert.equal(tr.fields.example_dialog.value, 'A: まだ ほぞんしていません。');
  assert.equal(tr.dataset.revision, '2026-09-20T00:00:00.000Z', 'its save stays guarded by the old revision');
});

test('a failed reload keeps the loaded curriculum', async () => {
  const modules = [{ grammar: [stored] }];
  const ctx = setup({ modules, api: async () => { throw new Error('offline'); } });
  assert.equal(await ctx.admReloadCourseState(), false);
  assert.equal(ctx.STATE.modules, modules);
  const fresh = [{ grammar: [] }];
  const ok = setup({ modules, api: async (path) => (assert.equal(path, '/courses/n5'), { course: { modules: fresh } }) });
  assert.equal(await ok.admReloadCourseState(), true);
  assert.equal(ok.STATE.modules, fresh);
});
