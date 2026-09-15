import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query, withAdvisoryLock } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { isCanonicalUuid } from '../live-class-admin-rules.js';
import { legacyDraft, normalizeDraft, prepareDialogue, suggestReadings, vocabularyDictionary } from '../../../src/grammar-dialogue-core.mjs';
import { defaultDialogueVoices, audioFingerprint, generateDialogueAudio, sendAudioBytes } from '../grammar-dialogue-audio.js';

export const grammarDialogueAdminRouter = Router();
export const grammarDialoguePublicRouter = Router();
const admin = grammarDialogueAdminRouter, student = grammarDialoguePublicRouter;
const limited = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan audio. Coba beberapa saat lagi.' } });
const reportsLimited = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Batas laporan tercapai. Coba lagi nanti.' } });
const fail = (status, message) => Object.assign(new Error(message), { status });
const route = fn => asyncHandler(async (req, res) => {
  try {
    if (!isCanonicalUuid(req.params.id)) throw fail(400, 'ID grammar tidak valid.');
    await fn(req, res);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});
function parsedDraft(value) {
  try { return normalizeDraft(value); } catch (error) { throw fail(400, error.message); }
}
async function grammar(id, client = { query }) {
  const result = await client.query('SELECT id, pattern, example_dialog, example_dialog_id FROM module_grammar WHERE id=$1', [id]);
  if (!result.rows[0]) throw fail(404, 'Grammar tidak ditemukan.');
  return result.rows[0];
}
const versionColumns = 'id, draft_revision, engine, model, status, error, created_at, reviewed_at';
function audioUrls(id, version, adminMode = false) {
  const base = adminMode ? '/api/admin/grammar-dialogues/' : '/api/grammar-dialogues/';
  const root = base + id + '/audio/' + version.id;
  return {
    ...version.alignment,
    turns: version.alignment.turns.map(turn => ({
      ...turn, audioUrl: version.alignment.mode === 'segments' ? root + '?turn=' + encodeURIComponent(turn.id) : root,
    })),
    audioUrl: root,
  };
}
function publicSnapshot(snapshot) {
  return { scene: snapshot.scene, pattern: snapshot.pattern,
    speakers: snapshot.speakers.map(({ id, name, reading, role }) => ({ id, name, reading, role })),
    turns: snapshot.turns };
}

admin.get('/:id', route(async (req, res) => {
  const item = await grammar(req.params.id);
  const [draft, versions, published, reports] = await Promise.all([
    query('SELECT payload, revision FROM grammar_dialogue_drafts WHERE grammar_id=$1', [item.id]),
    query('SELECT ' + versionColumns + ' FROM grammar_dialogue_versions WHERE grammar_id=$1 ORDER BY created_at DESC LIMIT 30', [item.id]),
    query('SELECT version_id FROM grammar_dialogue_publications WHERE grammar_id=$1', [item.id]),
    query('SELECT id, version_id, turn_id, reason, note, created_at FROM grammar_dialogue_reports WHERE grammar_id=$1 AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 50', [item.id]),
  ]);
  res.set('Cache-Control', 'no-store').json({
    draft: draft.rows[0]?.payload || legacyDraft(item, defaultDialogueVoices()),
    revision: draft.rows[0]?.revision || 0, versions: versions.rows,
    publishedVersion: published.rows[0]?.version_id || null, reports: reports.rows,
    voices: defaultDialogueVoices(),
  });
}));

admin.put('/:id/draft', route(async (req, res) => {
  const payload = parsedDraft(req.body?.draft);
  const expected = Number(req.body?.revision);
  if (!Number.isSafeInteger(expected) || expected < 0) throw fail(400, 'Revisi draft tidak valid.');
  const revision = await withAdvisoryLock('grammar-dialogue:' + req.params.id, async client => {
    await grammar(req.params.id, client);
    const current = await client.query('SELECT revision FROM grammar_dialogue_drafts WHERE grammar_id=$1', [req.params.id]);
    if ((current.rows[0]?.revision || 0) !== expected) throw fail(409, 'Draft berubah di sesi lain. Buka ulang editor sebelum menyimpan.');
    const next = expected + 1;
    await client.query(
      'INSERT INTO grammar_dialogue_drafts(grammar_id,payload,revision) VALUES($1,$2,$3) ON CONFLICT(grammar_id) DO UPDATE SET payload=$2,revision=$3,updated_at=NOW()',
      [req.params.id, JSON.stringify(payload), next]);
    return next;
  });
  res.json({ revision });
}));

admin.post('/:id/suggest', route(async (req, res) => {
  await grammar(req.params.id);
  const draft = parsedDraft(req.body?.draft);
  const vocabulary = await query(
    'SELECT v.japanese,v.reading FROM module_vocabulary v JOIN modules m ON m.id=v.module_id WHERE m.course_id=(SELECT m2.course_id FROM module_grammar g JOIN modules m2 ON m2.id=g.module_id WHERE g.id=$1) AND v.reading IS NOT NULL LIMIT 5000',
    [req.params.id]);
  res.json({ draft: suggestReadings(draft, vocabularyDictionary(vocabulary.rows)) });
}));

admin.post('/:id/generate', limited, route(async (req, res) => {
  const engine = req.body?.engine;
  if (!['dialogue-v3', 'turns-v2'].includes(engine) || !isCanonicalUuid(req.body?.takeId)) throw fail(400, 'Mesin atau ID preview tidak valid.');
  const reservation = await withAdvisoryLock('grammar-dialogue:' + req.params.id, async client => {
    await grammar(req.params.id, client);
    const draft = (await client.query('SELECT payload,revision FROM grammar_dialogue_drafts WHERE grammar_id=$1', [req.params.id])).rows[0];
    if (!draft || draft.revision !== req.body?.revision) throw fail(409, 'Simpan draft terbaru sebelum membuat audio.');
    let prepared;
    try { prepared = prepareDialogue(draft.payload, defaultDialogueVoices(), engine); }
    catch (error) { throw fail(400, error.message); }
    const hash = audioFingerprint(prepared.draft, engine, req.body.takeId);
    const existing = (await client.query('SELECT ' + versionColumns + ' FROM grammar_dialogue_versions WHERE grammar_id=$1 AND content_hash=$2',
      [req.params.id, hash])).rows[0];
    if (existing) return { existing };
    const active = await client.query("SELECT id FROM grammar_dialogue_versions WHERE grammar_id=$1 AND status='processing' AND created_at>NOW()-INTERVAL '5 minutes'", [req.params.id]);
    if (active.rows.length) throw fail(409, 'Preview masih dibuat. Muat ulang daftar versi beberapa saat lagi.');
    await client.query("UPDATE grammar_dialogue_versions SET status='failed',error='Proses terputus. Periksa riwayat sebelum membuat ulang.' WHERE grammar_id=$1 AND status='processing'", [req.params.id]);
    const id = randomUUID();
    await client.query(
      'INSERT INTO grammar_dialogue_versions(id,grammar_id,draft_revision,content_hash,snapshot,engine,model) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, req.params.id, draft.revision, hash, JSON.stringify(prepared.draft), engine, engine === 'dialogue-v3' ? 'eleven_v3' : 'eleven_multilingual_v2']);
    return { id, draft: prepared.draft };
  });
  if (reservation.existing) return res.json({ version: reservation.existing });
  try {
    const output = await generateDialogueAudio(reservation.draft, engine);
    const result = await query("UPDATE grammar_dialogue_versions SET status='ready',audio=$2,alignment=$3 WHERE id=$1 RETURNING " + versionColumns,
      [reservation.id, output.audio, JSON.stringify(output.alignment)]);
    res.json({ version: result.rows[0] });
  } catch (error) {
    await query("UPDATE grammar_dialogue_versions SET status='failed',error=$2 WHERE id=$1", [reservation.id, error.message]);
    res.status(502).json({ error: error.message, versionId: reservation.id });
  }
}));

admin.get('/:id/versions/:versionId', route(async (req, res) => {
  if (!isCanonicalUuid(req.params.versionId)) throw fail(400, 'ID versi tidak valid.');
  const version = (await query('SELECT id,snapshot,alignment,status FROM grammar_dialogue_versions WHERE grammar_id=$1 AND id=$2',
    [req.params.id, req.params.versionId])).rows[0];
  if (!version || version.status !== 'ready') throw fail(404, 'Preview audio belum tersedia.');
  res.set('Cache-Control', 'no-store').json({ versionId: version.id, draft: version.snapshot, audio: audioUrls(req.params.id, version, true) });
}));

async function publish(req, res, restore = false) {
  if (!isCanonicalUuid(req.body?.versionId)) throw fail(400, 'Pilih versi audio.');
  await withAdvisoryLock('grammar-dialogue:' + req.params.id, async client => {
    const version = (await client.query('SELECT * FROM grammar_dialogue_versions WHERE grammar_id=$1 AND id=$2',
      [req.params.id, req.body.versionId])).rows[0];
    if (!version || version.status !== 'ready') throw fail(400, 'Audio belum siap.');
    if (restore) {
      if (!version.reviewed_at) throw fail(400, 'Versi ini belum pernah disetujui.');
    } else {
      const draft = (await client.query('SELECT revision FROM grammar_dialogue_drafts WHERE grammar_id=$1', [req.params.id])).rows[0];
      if (!draft || draft.revision !== version.draft_revision || draft.revision !== req.body.revision) throw fail(409, 'Draft berubah setelah audio dibuat. Buat preview baru.');
      if (req.body.reviewedAudio !== true) throw fail(400, 'Dengarkan dan setujui audio sebelum publikasi.');
      await client.query('UPDATE grammar_dialogue_versions SET reviewed_at=NOW(),reviewed_by=$2 WHERE id=$1', [version.id, req.user.id]);
    }
    await client.query('INSERT INTO grammar_dialogue_publications(grammar_id,version_id) VALUES($1,$2) ON CONFLICT(grammar_id) DO UPDATE SET version_id=$2,published_at=NOW()',
      [req.params.id, version.id]);
    // Keep legacy consumers in sync with the same immutable snapshot.
    const turns = version.snapshot.turns;
    await client.query('UPDATE module_grammar SET example_dialog=$2,example_dialog_id=$3,updated_at=NOW() WHERE id=$1',
      [req.params.id, turns.map(t => t.speaker + ': ' + t.japanese).join('\n'), turns.map(t => t.speaker + ': ' + t.translation).join('\n')]);
  });
  res.json({ publishedVersion: req.body.versionId });
}
admin.post('/:id/publish', route((req, res) => publish(req, res)));
admin.post('/:id/restore', route((req, res) => publish(req, res, true)));
admin.post('/:id/reports/:reportId/resolve', route(async (req, res) => {
  if (!isCanonicalUuid(req.params.reportId)) throw fail(400, 'ID laporan tidak valid.');
  await query('UPDATE grammar_dialogue_reports SET resolved_at=NOW() WHERE grammar_id=$1 AND id=$2', [req.params.id, req.params.reportId]);
  res.json({ ok: true });
}));

async function serveAudio(req, res, adminMode) {
  if (!isCanonicalUuid(req.params.versionId)) throw fail(400, 'ID versi tidak valid.');
  const version = (await query('SELECT id,audio,alignment,content_hash FROM grammar_dialogue_versions WHERE grammar_id=$1 AND id=$2 AND status=$3' +
    (adminMode ? '' : ' AND reviewed_at IS NOT NULL'), [req.params.id, req.params.versionId, 'ready'])).rows[0];
  if (!version) throw fail(404, 'Audio tidak tersedia.');
  let buffer = version.audio;
  if (version.alignment.mode === 'segments') {
    const segment = version.alignment.turns.find(turn => turn.id === req.query.turn);
    if (!segment) throw fail(400, 'Pilih ucapan yang akan diputar.');
    buffer = buffer.subarray(segment.byteStart, segment.byteEnd);
  }
  return sendAudioBytes(req, res, buffer, version.content_hash + ':' + (req.query.turn || 'all'), !adminMode);
}
admin.get('/:id/audio/:versionId', route((req, res) => serveAudio(req, res, true)));
student.get('/:id/audio/:versionId', route((req, res) => serveAudio(req, res, false)));

student.get('/:id', route(async (req, res) => {
  const item = await grammar(req.params.id);
  const version = (await query(
    "SELECT v.id,v.snapshot,v.alignment FROM grammar_dialogue_publications p JOIN grammar_dialogue_versions v ON v.id=p.version_id AND v.grammar_id=p.grammar_id WHERE p.grammar_id=$1 AND v.status='ready' AND v.reviewed_at IS NOT NULL",
    [item.id])).rows[0];
  res.set('Cache-Control', 'no-store').json(version
    ? { versionId: version.id, draft: publicSnapshot(version.snapshot), audio: audioUrls(item.id, version) }
    : { versionId: null, draft: publicSnapshot(legacyDraft(item)), audio: null });
}));
student.post('/:id/reports', reportsLimited, route(async (req, res) => {
  const { versionId, turnId, reason } = req.body || {};
  if (!isCanonicalUuid(versionId) || !['pronunciation', 'expression', 'timing', 'other'].includes(reason)) throw fail(400, 'Laporan tidak valid.');
  const version = (await query('SELECT snapshot FROM grammar_dialogue_versions WHERE grammar_id=$1 AND id=$2 AND reviewed_at IS NOT NULL', [req.params.id, versionId])).rows[0];
  if (!version || !version.snapshot.turns.some(turn => turn.id === turnId)) throw fail(400, 'Ucapan tidak ditemukan pada versi ini.');
  await query('INSERT INTO grammar_dialogue_reports(id,grammar_id,version_id,turn_id,reason,note) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), req.params.id, versionId, turnId, reason, String(req.body.note || '').slice(0, 800)]);
  res.status(201).json({ ok: true });
}));
