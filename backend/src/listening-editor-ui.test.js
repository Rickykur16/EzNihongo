// Exercise the real shared editor and modal code in a minimal DOM fixture.
// Network/audio are stubbed; state transitions and serialized form writes are not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../../src/admin-dialogue-scene.js', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('./dialogue-catalog.json', import.meta.url), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
function slice(from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing source boundaries: ${from}`);
  return html.slice(start, end);
}
const editorSource = slice('const DIALOG_SPK_RE =', '// === Multi contoh grammar');
const modalSource = slice('let _modalDirty = false;', '// Toasts stack vertically');
const previewSource = slice('window.testTtsAudio =', 'window.clearTtsCacheCurrent =');
const generatedPreviewSource = slice('function listenGenRenderPreview()', '// Regenerate opsi + penjelasan');
const generatedSaveSource = slice('window.listenGenSave =', '// ─── Generate Soal JLPT');

const field = value => ({ value });
function audioElement() {
  return { src: '', style: {}, play: async () => {}, pause() {}, removeAttribute(name) { if (name === 'src') this.src = ''; } };
}
function setup({ script = 'A: はじめまして。\nF: どうぞよろしく。', scene = null } = {}) {
  const notifications = [], requests = [], furiganaCalls = [];
  const scriptField = field(script), sceneField = field(scene ? JSON.stringify(scene) : '');
  const form = {
    audioScript: scriptField,
    question: field('Unsaved question'),
    querySelector(selector) { return selector === '[name="dialog_scene"]' ? sceneField : null; },
  };
  const initialNodes = [form, { id: 'unsaved-sibling' }];
  const modalContent = {
    childNodes: [...initialNodes], className: 'modal question-editor', style: { maxWidth: '880px' },
    _html: '',
    set innerHTML(value) { this._html = value; this.childNodes = []; },
    get innerHTML() { return this._html; },
    replaceChildren(...nodes) { this.childNodes = nodes; this._html = ''; },
    querySelectorAll: () => [], addEventListener() {},
  };
  Object.defineProperty(form, 'isConnected', { get: () => modalContent.childNodes.includes(form) });
  const classes = new Set(['show']);
  const modal = { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }, addEventListener() {} };
  const elements = new Map([
    ['modal-content', modalContent], ['dlg-audio-0', audioElement()],
    ['ttsTestAudio', audioElement()], ['ttsTestStatus', { textContent: '' }],
  ]);
  const document = {
    getElementById(id) {
      if (id === 'question-form') return modalContent.childNodes.includes(form) ? form : null;
      if (id === 'audioScriptField') return scriptField;
      if (id === 'questionAudioScene') return sceneField;
      return elements.get(id) || null;
    },
    querySelectorAll: () => [], addEventListener() {},
  };
  const profiles = catalog.characters.map((c, i) => ({
    id: `profile-${i}`, character_key: c.key, default_display_name: c.displayName,
    voice_id: `voice-${c.key}`, voice_name: `Voice ${c.name}`, profile_version: 3,
  }));
  const voices = profiles.map(p => ({ voiceId: p.voice_id, name: p.voice_name }));
  voices.push({ voiceId: 'voice-custom', name: 'Custom voice' });
  const ctx = vm.createContext({
    window: null, document, modal, modalContent,
    confirm: () => true,
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    notify: (message, isError) => notifications.push({ message, isError: !!isError }),
    api: async path => {
      if (path === '/admin/dialogue-speakers') return { speakers: profiles };
      if (path === '/admin/elevenlabs/voices') return { voices };
      throw new Error(`Unexpected API call ${path}`);
    },
    ezApi: async (path, options) => {
      requests.push({ path, ...options, parsedBody: JSON.parse(options.body) });
      return { ok: true, blob: async () => ({ size: 1024 }) };
    },
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} },
  });
  ctx.window = ctx;
  ctx.EzDialogue = { catalog, esc: ctx.escapeHtml, html: () => '<div>stage fixture</div>', mount() {} };
  ctx.EzDialogueFuriganaAdmin = {
    load: () => furiganaCalls.push('load'), save: () => furiganaCalls.push('save'),
    fields: () => '', data: () => null, changed: () => furiganaCalls.push('changed'),
  };
  ctx.__dialogSpeakers = profiles;
  ctx.__elevenVoices = voices;
  vm.runInContext(modalSource, ctx, { filename: 'admin.html:modal' });
  vm.runInContext(editorSource, ctx, { filename: 'admin.html:dialogue-editor' });
  vm.runInContext(sceneSource, ctx, { filename: 'src/admin-dialogue-scene.js' });
  vm.runInContext(previewSource, ctx, { filename: 'admin.html:tts-preview' });
  vm.runInContext(generatedPreviewSource, ctx, { filename: 'admin.html:generated-listening-preview' });
  vm.runInContext(generatedSaveSource, ctx, { filename: 'admin.html:generated-listening-save' });
  return { ctx, form, scriptField, sceneField, modalContent, initialNodes, notifications, requests, profiles, furiganaCalls, elements };
}
function formState(h) {
  return { script: h.scriptField.value, scene: h.sceneField.value, question: h.form.question.value };
}

test('all real inline admin scripts and shared scene module parse as JavaScript', () => {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2], { filename: `admin.html:inline-${++count}` });
  }
  assert.ok(count > 0, 'No inline admin JavaScript was parsed');
  new vm.Script(sceneSource, { filename: 'src/admin-dialogue-scene.js' });
});

test('listening initializes A and F as distinct female profiles without touching the form', async () => {
  const h = setup(), before = formState(h);
  await h.ctx.quizManageListeningDialog();
  assert.equal(h.ctx.__dialogMode, 'listening');
  assert.deepEqual(plain(h.ctx.__dialogScene.participants.map(p => [p.speaker, p.characterKey, p.voiceId])), [
    ['A', 'anna-wijaya', 'voice-anna-wijaya'], ['F', 'aoi-takahashi', 'voice-aoi-takahashi'],
  ]);
  assert.equal(h.ctx.__dialogScene.backgroundKey, 'none');
  assert.deepEqual(formState(h), before);
  assert.match(h.modalContent.innerHTML, /Gunakan untuk soal/);
  assert.doesNotMatch(h.modalContent.innerHTML, /Translate semua|Tampilkan panggung dialog|ez-scene-backgrounds/);
  assert.deepEqual(h.furiganaCalls, []);
});

test('apply persists custom voice/name snapshot and reopening round-trips without refreshing profiles', async () => {
  const h = setup();
  await h.ctx.quizManageListeningDialog();
  await h.ctx.EzDialogueAdmin.custom(0, true);
  h.ctx.EzDialogueAdmin.field(0, 'displayName', 'ミカ');
  h.ctx.EzDialogueAdmin.voice(0, 'voice-custom');
  h.ctx.admDialogRowEdit(0, 'jp', 'ミカです。');
  assert.equal(h.sceneField.value, '', 'Draft scene must not write the parent before Apply');
  h.ctx.admDialogSave();
  assert.equal(h.scriptField.value, 'A: ミカです。\nF: どうぞよろしく。');
  const saved = JSON.parse(h.sceneField.value);
  assert.equal(saved.participants[0].voiceId, 'voice-custom');
  assert.equal(saved.participants[0].displayName, 'ミカ');
  assert.equal(saved.participants[0].custom, true);
  assert.equal(h.modalContent.childNodes[0], h.form, 'Original unsaved form node must be restored');
  assert.equal(h.modalContent.childNodes[1], h.initialNodes[1]);
  assert.equal(h.form.question.value, 'Unsaved question');
  h.profiles[0].voice_id = 'voice-new-profile';
  await h.ctx.quizManageListeningDialog();
  assert.deepEqual(plain(h.ctx.__dialogScene), saved, 'An existing saved scene wins over newer default profiles');
  assert.deepEqual(h.furiganaCalls, []);
});

test('cancel restores the live question form while discarding all script and voice edits', async () => {
  const h = setup(), before = formState(h);
  await h.ctx.quizManageListeningDialog();
  h.ctx.admDialogRowEdit(0, 'jp', 'キャンセルです。');
  h.ctx.EzDialogueAdmin.field(0, 'displayName', 'Discard this');
  h.ctx.EzDialogueAdmin.voice(0, 'voice-custom');
  h.ctx.closeModal();
  assert.deepEqual(formState(h), before);
  assert.equal(h.modalContent.childNodes[0], h.form);
  assert.equal(h.modalContent.className, 'modal question-editor');
  assert.equal(h.modalContent.style.maxWidth, '880px');
  await h.ctx.quizManageListeningDialog();
  assert.equal(h.ctx.__dialogRows[0].jp, 'はじめまして。');
  assert.equal(h.ctx.__dialogScene.participants[0].voiceId, 'voice-anna-wijaya');
});

test('listening and grammar modes load their own scene and never leak unsaved drafts', async () => {
  const h = setup();
  await h.ctx.quizManageListeningDialog();
  h.ctx.EzDialogueAdmin.voice(0, 'voice-custom');
  h.ctx.closeModal();
  const grammarFields = {
    'textarea[name="example_dialog"]': field('N: ばめんです。\nA: こんにちは。'),
    'textarea[name="example_dialog_id"]': field('N: Situasi.\nA: Halo.'),
    '[name="dialog_scene"]': field(''),
  };
  const tr = { querySelector: selector => grammarFields[selector] || null, closest: () => null };
  await h.ctx.grmrManageDialog({ closest: () => tr });
  assert.equal(h.ctx.__dialogMode, 'grammar');
  assert.equal(h.ctx.__dialogScene, null, 'Grammar without scene must not inherit listening scene');
  assert.equal(h.ctx.__dialogTargetTa.id, grammarFields['textarea[name="example_dialog_id"]']);
  assert.match(h.modalContent.innerHTML, /Translate semua/);
  assert.deepEqual(h.furiganaCalls, ['load']);
  h.ctx.EzDialogueAdmin.toggle(true);
  h.ctx.EzDialogueAdmin.field(0, 'displayName', 'Unsaved grammar actor');
  h.ctx.closeModal();
  h.modalContent.replaceChildren(...h.initialNodes);
  await h.ctx.quizManageListeningDialog();
  assert.equal(h.ctx.__dialogMode, 'listening');
  assert.equal(h.ctx.__dialogScene.participants[0].displayName, 'アンナ');
  assert.equal(h.ctx.__dialogScene.participants[0].voiceId, 'voice-anna-wijaya');
  assert.equal(h.ctx.__dialogTargetTa.id, null);
});

for (const [label, mutate, expected] of [
  ['missing voice', h => { h.ctx.__dialogScene.participants[0].voiceId = null; }, /Pilih suara ElevenLabs/],
  ['empty display name', h => { h.ctx.__dialogScene.participants[0].displayName = ' '; }, /Isi nama tampilan/],
  ['unmapped speaker', h => { h.ctx.__dialogRows[0].speaker = 'C'; }, /Petakan setiap pembicara/],
  ['oversized script', h => { h.ctx.__dialogRows[0].jp = 'あ'.repeat(1501); }, /maksimal 1500/],
  ['empty script', h => { h.ctx.__dialogRows.forEach(r => { r.jp = ' '; }); }, /Isi naskah listening/],
]) {
  test(`validation rejects ${label} before any parent form write`, async () => {
    const h = setup(), before = formState(h);
    await h.ctx.quizManageListeningDialog();
    mutate(h);
    h.ctx.admDialogSave();
    assert.deepEqual(formState(h), before);
    assert.match(h.notifications.at(-1)?.message || '', expected);
    assert.equal(h.notifications.at(-1)?.isError, true);
    assert.notEqual(h.ctx.__dialogParentModal, null, 'Invalid draft stays open for correction');
    assert.deepEqual(h.furiganaCalls, []);
  });
}

test('per-turn and whole-script previews send the matching explicit scene', async () => {
  const h = setup();
  await h.ctx.quizManageListeningDialog();
  h.ctx.EzDialogueAdmin.voice(0, 'voice-custom');
  const expected = plain(h.ctx.__dialogScene);
  const button = { textContent: 'Tes giliran ini', disabled: false };
  await h.ctx.admDialogRowTest(0, button);
  assert.equal(h.requests[0].path, '/admin/tts/preview');
  assert.deepEqual(h.requests[0].parsedBody, { text: 'A: はじめまして。', dialogScene: expected });
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Tes giliran ini');
  h.ctx.admDialogSave();
  await h.ctx.testTtsAudio();
  assert.deepEqual(h.requests[1].parsedBody, { text: h.scriptField.value, dialogScene: expected });
  assert.match(h.elements.get('ttsTestStatus').textContent, /^OK/);
});

test('an async profile load cannot reopen an obsolete question form', async () => {
  const h = setup();
  delete h.ctx.__dialogSpeakers;
  let resolve;
  h.ctx.api = () => new Promise(done => { resolve = done; });
  const pending = h.ctx.quizManageListeningDialog();
  const replacement = { id: 'different-form' };
  h.modalContent.replaceChildren(replacement);
  resolve({ speakers: h.profiles });
  await pending;
  assert.equal(h.modalContent.childNodes[0], replacement);
  assert.equal(h.ctx.__dialogParentModal, undefined);
  assert.equal(h.ctx.__dialogMode, undefined);
});

function generatedSetup() {
  const h = setup(), { ctx, elements, modalContent } = h;
  const cards = [0, 1].map(i => {
    const script = field(`A: ${i ? 'こんにちは' : 'はじめまして'}。\nF: よろしく。`), scene = field('');
    const include = { checked: true, dataset: { i: String(i) } };
    const card = { querySelector: selector => selector === '[name="dialog_scene"]' ? scene : null };
    Object.defineProperty(card, 'isConnected', { get: () => modalContent.childNodes.includes(card) });
    for (const [id, value] of Object.entries({
      [`lg_card_${i}`]: card, [`lg_audio_${i}`]: script, [`lg_scene_${i}`]: scene,
      [`lg_q_${i}`]: field(`Edited question ${i}`), [`lg_exp_${i}`]: field(`Explanation ${i}`),
      [`lg_player_${i}`]: audioElement(), [`lg_tts_status_${i}`]: { textContent: '' },
    })) elements.set(id, value);
    for (let j = 0; j < 4; j++) elements.set(`lg_opt_${i}_${j}`, field(`Option ${i}-${j}`));
    return { card, script, scene, include };
  });
  elements.set('lg-save', { disabled: false, textContent: 'Simpan ke kuis' });
  ctx.document.querySelectorAll = selector => selector === '.lg-inc:checked' ? cards.filter(c => c.include.checked).map(c => c.include) : [];
  ctx.document.querySelector = selector => {
    if (selector.startsWith('input[name="lg_correct_')) return { value: '2' };
    const match = selector.match(/^\.lg-inc\[data-i="(\d+)"\]$/);
    return match ? cards[Number(match[1])]?.include : null;
  };
  ctx._listenGenCtx = { lessonId: 'lesson-fixture', lessonTitle: 'Bab 3' };
  ctx._listenGenSection = { number: 4, label: 'Menyimak', instruction: 'Dengarkan audio.' };
  ctx._listenGenDrafts = cards.map(c => ({ question: 'Original question', audioScript: c.script.value, options: Array.from({ length: 4 }, (_, j) => ({ text: `Original ${j}`, isCorrect: j === 0 })) }));
  ctx.genOptionRows = () => '<div>Option fixture</div>';
  ctx.notifyLearningWarnings = () => {};
  const savedRequests = [], manageCalls = [];
  const originalApi = ctx.api;
  ctx.api = async (path, options) => {
    if (path === '/admin/lessons/lesson-fixture/quiz') return { questions: [] };
    if (path === '/admin/quiz-questions') { savedRequests.push(JSON.parse(options.body)); return { question: { id: 'saved' }, warnings: [] }; }
    return originalApi(path, options);
  };
  ctx.manageQuiz = (...args) => manageCalls.push(args);
  modalContent.replaceChildren(...cards.map(c => c.card));
  return { ...h, cards, savedRequests, manageCalls };
}

test('generated cards expose the shared editor and keep their script read-only', () => {
  const h = generatedSetup();
  h.ctx.listenGenRenderPreview();
  assert.match(h.modalContent.innerHTML, /quizManageListeningDraft\(0\)/);
  assert.match(h.modalContent.innerHTML, /id="lg_scene_0" name="dialog_scene" hidden/);
  assert.match(h.modalContent.innerHTML, /id="lg_audio_0"[^>]*readonly/);
});

test('generated draft cancel preserves the card; apply/reopen and audio preview preserve its custom scene', async () => {
  const h = generatedSetup(), card = h.cards[0];
  const initial = { script: card.script.value, scene: card.scene.value };
  await h.ctx.quizManageListeningDraft(0);
  h.ctx.admDialogRowEdit(1, 'jp', 'Discard this');
  h.ctx.EzDialogueAdmin.voice(1, 'voice-custom');
  h.ctx.closeModal();
  assert.equal(h.modalContent.childNodes[0], card.card);
  assert.deepEqual({ script: card.script.value, scene: card.scene.value }, initial);
  await h.ctx.quizManageListeningDraft(0);
  await h.ctx.EzDialogueAdmin.custom(1, true);
  h.ctx.EzDialogueAdmin.field(1, 'displayName', 'サリ');
  h.ctx.EzDialogueAdmin.voice(1, 'voice-custom');
  h.ctx.admDialogRowEdit(1, 'jp', 'サリです。');
  h.ctx.admDialogSave();
  const expectedScene = JSON.parse(card.scene.value);
  assert.equal(expectedScene.participants[1].displayName, 'サリ');
  assert.equal(expectedScene.participants[1].voiceId, 'voice-custom');
  assert.equal(card.script.value, 'A: はじめまして。\nF: サリです。');
  assert.equal(h.cards[1].scene.value, '', 'Applying one card must not alter a sibling card');
  await h.ctx.quizManageListeningDraft(0);
  assert.deepEqual(plain(h.ctx.__dialogScene), expectedScene);
  h.ctx.closeModal();
  await h.ctx.listenGenTestAudio(0);
  assert.deepEqual(h.requests[0].parsedBody, { text: card.script.value, dialogScene: expectedScene });
});

test('generated save blocks unconfigured selected cards then sends the edited script and exact audioScene', async () => {
  const h = generatedSetup(), card = h.cards[0];
  await h.ctx.quizManageListeningDraft(0);
  h.ctx.EzDialogueAdmin.voice(1, 'voice-custom');
  h.ctx.admDialogRowEdit(1, 'jp', 'サリです。');
  h.ctx.admDialogSave();
  await h.ctx.listenGenSave();
  assert.equal(h.savedRequests.length, 0, 'One unconfigured selected card blocks the complete batch before writes');
  assert.match(h.notifications.at(-1).message, /Pilih suara karakter/);
  h.cards[1].include.checked = false;
  const expected = JSON.parse(card.scene.value);
  await h.ctx.listenGenSave();
  assert.equal(h.savedRequests.length, 1);
  assert.equal(h.savedRequests[0].question, 'Edited question 0');
  assert.equal(h.savedRequests[0].audioScript, 'A: はじめまして。\nF: サリです。');
  assert.deepEqual(h.savedRequests[0].audioScene, expected);
  assert.deepEqual(h.savedRequests[0].options.map(o => o.isCorrect), [false, false, true, false]);
  assert.equal(card.include.checked, false);
  assert.deepEqual(h.manageCalls, [['lesson-fixture', 'Bab 3']]);
});
