import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseLearningFlowConfig } from './learning-flow-config.js';

// Runs the REAL admin.html code for the "Soal dialog untuk siswa" switch
// (Percakapan drawer) and the AI-tab overview against a fake DOM and API.
const html = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('./learning-flow-config.js', import.meta.url), 'utf8');
function slice(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from > 0 && to > from, `Missing source markers: ${start}`);
  return html.slice(from, to);
}
// Drawer switch and AI-tab overview live together in one block.
const flowSource = slice('// ── Soal dialog untuk siswa (alur komunikasi v2)', '// "+ Buat pelajaran Percakapan"');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const COURSE = '10000000-0000-4000-8000-000000000001';
const MODULE = '10000000-0000-4000-8000-000000000002';
const SOURCE = '10000000-0000-4000-8000-000000000003';
const OTHER = '10000000-0000-4000-8000-000000000009';
const GRAMMAR = '10000000-0000-4000-8000-000000000004';
const PATH = '/admin/settings/learning-flow-communication';
const empty = { enabled: false, courseIds: [], moduleIds: [], lessonIds: [] };

function element(extra = {}) {
  return { textContent: '', innerHTML: '', dataset: {}, ...extra };
}
function setup({ settings, preview, write, loadError } = {}) {
  const body = element(), actions = element(), oBody = element(), oActions = element();
  const panel = element({ dataset: { sourceId: SOURCE },
    querySelector: sel => ({ '#flow-switch-body': body, '#flow-switch-actions': actions })[sel] });
  const overview = element({
    querySelector: sel => ({ '#flow-overview-body': oBody, '#flow-overview-actions': oActions })[sel] });
  const state = { settings: settings || { config: { ...empty }, configRevision: 'rev-1',
      diagnostic: 'flow_config_missing', readiness: { ready: false, issues: [], lessons: [] },
      titles: { courses: {}, modules: {}, lessons: {} } },
    preview: preview || { readiness: { ready: true, issues: [], lessons: [{ lessonId: SOURCE, ready: true, issues: [] }] },
      titles: { courses: {}, modules: {}, lessons: {} } },
    calls: [], notices: [], confirms: [], confirmAnswer: true, write, loadError };
  const modules = [{ id: MODULE, course_id: COURSE, grammar: [{ id: GRAMMAR, pattern: '〜は〜です' }],
    lessons: [{ id: SOURCE, title: 'Tata Bahasa: です' }] }];
  const ctx = vm.createContext({
    window: {}, escapeHtml,
    document: { getElementById: id => ({ 'flow-switch': panel, 'flow-overview': overview })[id] || null },
    STATE: { modules, courses: [{ id: COURSE, slug: 'n5' }], selectedCourse: 'n5' },
    cbFindLesson: id => (id === SOURCE ? { lesson: modules[0].lessons[0], module: modules[0] } : null),
    notify: (message, error) => state.notices.push({ message, error: !!error }),
    confirm: message => { state.confirms.push(message); return state.confirmAnswer; },
    api: async (path, options) => {
      state.calls.push({ path, options });
      if (options?.method === 'PUT') {
        const body = JSON.parse(options.body);
        if (state.write) return state.write(body);
        return { config: body.config, configRevision: 'rev-2', readiness: { ready: true, issues: [], lessons: [] } };
      }
      if (state.loadError) throw state.loadError;
      if (path === PATH) return state.settings;
      if (path === `${PATH}/readiness?lessonId=${SOURCE}`) return state.preview;
      throw Error(`unexpected path ${path}`);
    },
  });
  vm.runInContext(`${flowSource}
    Object.assign(globalThis, { flowIssueText, flowNextConfig, flowSwitchState, flowReasonsHtml });`, ctx);
  Object.assign(ctx, ctx.window);
  return { ctx, state, panel, body, actions, overview, oBody, oActions };
}
const button = (markup, onclick) => markup.match(new RegExp(`<button[^>]*onclick="${onclick.replace(/[()]/g, '\\$&')}"[^>]*>`))?.[0] || null;
const puts = state => state.calls.filter(call => call.options?.method === 'PUT').map(call => JSON.parse(call.options.body));

test('every readiness code the server can return has an Indonesian explanation', () => {
  const { ctx } = setup();
  const codes = new Set([...serverSource.matchAll(/'(flow_[a-z_]+)'/g)].map(match => match[1]));
  // Codes that are not readiness findings (config/request errors handled elsewhere).
  for (const skip of ['flow_settings_schema_invalid', 'flow_scope_invalid', 'flow_readiness_failed',
    'flow_config_revision_conflict', 'flow_scope_changed', 'flow_scope_required', 'flow_disabled',
    'flow_scope_not_allowed']) codes.delete(skip);
  assert.ok(codes.size >= 20, `expected the server's readiness codes, got ${[...codes]}`);
  for (const code of codes) {
    const text = ctx.flowIssueText({ code, grammarId: GRAMMAR });
    assert.ok(text && !text.includes('flow_'), `${code} has no human text: ${text}`);
  }
  // Pattern names come from the issue itself, else from the loaded Bab.
  assert.match(ctx.flowIssueText({ code: 'flow_question_count_invalid', grammarId: GRAMMAR,
    comprehensionCount: 0, transferCount: 1 }), /«〜は〜です».*0 comprehension, 1 transfer/);
  assert.match(ctx.flowIssueText({ code: 'flow_task_dialogue_coverage_incomplete', pattern: '〜も' }), /«〜も»/);
  assert.match(ctx.flowIssueText({ code: 'flow_task_mapping_invalid', taskIds: [] }), /Tampilkan otomatis setelah pelajaran/);
  assert.match(ctx.flowIssueText({ code: 'flow_task_mapping_invalid', taskIds: ['a', 'b'] }), /2 Tugas Bunpou/);
  assert.match(ctx.flowIssueText({ code: 'flow_companion_not_current', publishedFingerprint: null }), /belum dipublikasikan/);
  assert.match(ctx.flowIssueText({ code: 'flow_companion_not_current', publishedFingerprint: 'x' }), /Publikasikan ulang/);
});

test('next config is always one the server parser accepts, and never revives a disabled list', () => {
  const { ctx } = setup();
  const plain = value => JSON.parse(JSON.stringify(value));
  const check = config => { assert.deepEqual(parseLearningFlowConfig(plain(config)), plain(config)); return plain(config); };
  // From missing/disabled (even with leftovers): only this lesson.
  assert.deepEqual(check(ctx.flowNextConfig(empty, SOURCE, true)),
    { enabled: true, courseIds: [], moduleIds: [], lessonIds: [SOURCE] });
  assert.deepEqual(check(ctx.flowNextConfig({ ...empty, lessonIds: [OTHER], moduleIds: [MODULE] }, SOURCE, true)),
    { enabled: true, courseIds: [], moduleIds: [], lessonIds: [SOURCE] });
  // Adding keeps others (sorted, no duplicates) and wider scopes.
  const on = { enabled: true, courseIds: [], moduleIds: [MODULE], lessonIds: [OTHER] };
  assert.deepEqual(check(ctx.flowNextConfig(on, SOURCE, true)).lessonIds, [SOURCE, OTHER]);
  assert.deepEqual(check(ctx.flowNextConfig({ ...on, lessonIds: [SOURCE] }, SOURCE, true)).lessonIds, [SOURCE]);
  // Removing the last lesson turns it off with an empty scope.
  assert.deepEqual(check(ctx.flowNextConfig({ ...empty, enabled: true, lessonIds: [SOURCE] }, SOURCE, false)), empty);
  assert.deepEqual(check(ctx.flowNextConfig(on, OTHER, false)),
    { enabled: true, courseIds: [], moduleIds: [MODULE], lessonIds: [] });
});

test('drawer: not ready shows the reasons in words and keeps the switch disabled', async () => {
  const { ctx, state, body, actions } = setup({ preview: { readiness: { ready: false, issues: [],
    lessons: [{ lessonId: SOURCE, ready: false, issues: [
      { code: 'flow_question_count_invalid', grammarId: GRAMMAR, comprehensionCount: 1, transferCount: 0 },
      { code: 'flow_question_stale', grammarId: GRAMMAR, questionId: 'q1' },
      { code: 'flow_question_stale', grammarId: GRAMMAR, questionId: 'q2' },
    ] }] }, titles: { courses: {}, modules: {}, lessons: {} } } });
  await ctx.flowSwitchLoad();
  assert.deepEqual(state.calls.map(call => call.path), [PATH, `${PATH}/readiness?lessonId=${SOURCE}`]);
  assert.match(body.innerHTML, /Nonaktif<\/strong> — belum bisa dinyalakan/);
  assert.match(body.innerHTML, /«〜は〜です»: perlu 1–2 pertanyaan comprehension/);
  assert.equal(body.innerHTML.match(/dialognya berubah/g).length, 1, 'duplicate reasons are merged');
  assert.match(button(actions.innerHTML, 'flowSwitchSave(true)'), /disabled/);
  assert.ok(!button(actions.innerHTML, 'flowSwitchSave(false)'));
});

test('drawer: ready lesson is switched on with the exact PUT body, then reloaded', async () => {
  const { ctx, state, body, actions } = setup();
  await ctx.flowSwitchLoad();
  assert.match(body.innerHTML, /siap dinyalakan/);
  assert.doesNotMatch(button(actions.innerHTML, 'flowSwitchSave(true)'), /disabled/);
  state.settings = { ...state.settings, config: { enabled: true, courseIds: [], moduleIds: [], lessonIds: [SOURCE] },
    configRevision: 'rev-2', diagnostic: null };
  await ctx.flowSwitchSave(true);
  assert.deepEqual(puts(state), [{ config: { enabled: true, courseIds: [], moduleIds: [], lessonIds: [SOURCE] },
    expectedConfigRevision: 'rev-1' }]);
  assert.deepEqual(state.notices, [{ message: 'Soal dialog dinyalakan untuk pelajaran ini.', error: false }]);
  assert.match(body.innerHTML, /● Aktif<\/strong> — siswa menjawab soal dialog/);
  assert.ok(button(actions.innerHTML, 'flowSwitchSave(false)'));
  // And off again: the lesson is removed, which empties and disables the config.
  await ctx.flowSwitchSave(false);
  assert.deepEqual(puts(state).at(-1), { config: empty, expectedConfigRevision: 'rev-2' });
});

test('drawer: a failing PUT names the OTHER active lesson that blocks it', async () => {
  const { ctx, body } = setup({ settings: { config: { enabled: true, courseIds: [], moduleIds: [], lessonIds: [OTHER] },
    configRevision: 'rev-1', diagnostic: null, readiness: { ready: true, issues: [], lessons: [] }, titles: {} } });
  const error = Object.assign(Error('flow_readiness_failed'), { status: 422, body: {
    error: 'flow_readiness_failed',
    readiness: { ready: false, issues: [], lessons: [
      { lessonId: SOURCE, ready: true, issues: [] },
      { lessonId: OTHER, ready: false, issues: [{ code: 'flow_companion_not_current', publishedFingerprint: 'old' }] }] },
    titles: { lessons: { [OTHER]: { title: 'Tata Bahasa: も', moduleTitle: 'Bab 3', conversationTitle: 'Percakapan: も' } } },
  } });
  await ctx.flowSwitchLoad();
  ctx.api = async () => { throw error; };
  await ctx.flowSwitchSave(true);
  assert.match(body.innerHTML, /Belum bisa dinyalakan:/);
  assert.match(body.innerHTML, /Bab 3 · Percakapan: も:/);
  assert.match(body.innerHTML, /Publikasikan ulang/);
  assert.match(body.innerHTML, /Pelajaran lain yang sudah aktif juga harus siap/);
});

test('drawer: revision conflict reloads instead of overwriting; module scope has no per-lesson switch', async () => {
  const conflict = setup();
  await conflict.ctx.flowSwitchLoad();
  conflict.state.write = () => { throw Object.assign(Error('flow_config_revision_conflict'),
    { status: 409, body: { error: 'flow_config_revision_conflict' } }); };
  await conflict.ctx.flowSwitchSave(true);
  assert.equal(conflict.state.notices.at(-1).error, true);
  assert.equal(conflict.state.calls.filter(call => call.path === PATH && !call.options).length, 2, 'reloaded');

  const wide = setup({ settings: { config: { enabled: true, courseIds: [], moduleIds: [MODULE], lessonIds: [] },
    configRevision: 'rev-1', diagnostic: null, readiness: { ready: true, issues: [], lessons: [] }, titles: {} } });
  await wide.ctx.flowSwitchLoad();
  assert.match(wide.body.innerHTML, /● Aktif/);
  assert.ok(!button(wide.actions.innerHTML, 'flowSwitchSave(false)'));
  assert.ok(!button(wide.actions.innerHTML, 'flowSwitchSave(true)'));
  assert.match(wide.actions.innerHTML, /matikan dari tab AI/);

  const staff = setup({ loadError: Object.assign(Error('forbidden'), { status: 403 }) });
  await staff.ctx.flowSwitchLoad();
  assert.match(staff.body.textContent, /Hanya pemilik/);
  assert.equal(staff.actions.innerHTML, '');
});

test('AI tab: lists active lessons by name and "Matikan semua" asks first', async () => {
  const { ctx, state, oBody, oActions } = setup({ settings: {
    config: { enabled: true, courseIds: [], moduleIds: [], lessonIds: [OTHER, SOURCE] }, configRevision: 'rev-7',
    diagnostic: null, readiness: { ready: false, issues: [], lessons: [
      { lessonId: SOURCE, ready: true, issues: [] },
      { lessonId: OTHER, ready: false, issues: [{ code: 'flow_question_stale', pattern: '〜も' }] }] },
    titles: { lessons: {
      [SOURCE]: { title: 'Tata Bahasa: です', moduleTitle: 'Bab 3', conversationTitle: 'Percakapan: です' },
      [OTHER]: { title: 'Tata Bahasa: も', moduleTitle: 'Bab 3', conversationTitle: null } } } } });
  await ctx.flowOverviewLoad();
  assert.match(oBody.innerHTML, /● Aktif<\/strong> untuk 2 pelajaran/);
  assert.match(oBody.innerHTML, /✓<\/span> Bab 3 · Percakapan: です/);
  assert.match(oBody.innerHTML, /⚠<\/span> Bab 3 · Tata Bahasa: も — <em>belum siap/);
  assert.match(oBody.innerHTML, /«〜も»: dialognya berubah/);
  state.confirmAnswer = false;
  await ctx.flowOverviewDisableAll();
  assert.equal(puts(state).length, 0);
  state.confirmAnswer = true;
  state.settings = { ...state.settings, config: { ...empty }, readiness: { ready: false, issues: [], lessons: [] } };
  await ctx.flowOverviewDisableAll();
  assert.deepEqual(puts(state), [{ config: empty, expectedConfigRevision: 'rev-7' }]);
  assert.match(oBody.innerHTML, /Nonaktif untuk semua pelajaran/);
  assert.ok(!button(oActions.innerHTML, 'flowOverviewDisableAll()'));
});
