// Builds content/n4-support/dialogue-kanji-plan.json and migration 192 from
// content/n4-support/dialogue-kanji.mjs. `--check` fails when either output
// is out of date. See that content file for the markup.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import furigana from '../../src/dialogue-furigana.js';

const dir = new URL('../content/n4-support/', import.meta.url);
export const planUrl = new URL('dialogue-kanji-plan.json', dir);
export const migrationUrl = new URL('../migrations/192_n4_dialogue_kanji.sql', import.meta.url);

// Every N5 kanji (the cumulative whitelist of migration 089) and the N4 kanji
// per chapter as migration 155 stores them in kanji_items.
export const N5_KANJI = '先何語校国生学名人魚本花八三十九一五四二六七安高古新白長男女気下前外間右中左後上時分円百千万年月半歳午車東道駅行西電北南見読書週毎食飲立休入出言話聞買店会社日火水木金土子父母友手足口目耳大小多少雨天空山川来令';
export function n4ChapterKanji() {
  const sql = fs.readFileSync(new URL('../migrations/155_n4_kanji_distribution.sql', import.meta.url), 'utf8');
  const chapters = {};
  for (const m of sql.matchAll(/\((\d+), '[^']*', '[^']*', '([^']+)'\)/g)) chapters[m[1]] = m[2];
  if (Object.keys(chapters).length !== 24) throw Error('155 chapter kanji not found');
  return chapters;
}
export function taughtKanji(chapter, chapters = n4ChapterKanji()) {
  let set = N5_KANJI;
  for (let c = 1; c <= chapter; c++) set += chapters[c];
  return new Set(set);
}

const HAN = /\p{Script=Han}/u;
// '{K~r}' or '{K~r|original}' → segments; plain text between them.
export function parseMarked(line) {
  const segments = [];
  let last = 0;
  for (const m of line.matchAll(/\{([^~{}|]+)~([^~{}|]+)(?:\|([^{}]+))?\}/gu)) {
    if (m.index > last) segments.push({plain: line.slice(last, m.index)});
    segments.push({kanji: m[1], reading: m[2], original: m[3] ?? null});
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push({plain: line.slice(last)});
  return segments;
}

// The authored line must read back to the 190 line: plain text identical, each
// marked word spelled there as its reading, as itself, or as its |original.
function matchesOriginal(segments, original) {
  const go = (i, pos) => {
    if (i === segments.length) return pos === original.length;
    const s = segments[i];
    const options = s.plain != null ? [s.plain] : [s.original, s.reading, s.kanji].filter(Boolean);
    return options.some((o) => original.startsWith(o, pos) && go(i + 1, pos + o.length));
  };
  return go(0, 0);
}

export function buildLine(marked, original, taught, where) {
  const segments = parseMarked(marked);
  if (!matchesOriginal(segments, original)) throw Error(`${where}: does not read back to 190 text\n  ${marked}\n  ${original}`);
  let text = '';
  const readings = [];
  for (const s of segments) {
    if (s.plain != null) {
      if (HAN.test(s.plain)) throw Error(`${where}: kanji without furigana in "${s.plain}"`);
      text += s.plain;
      continue;
    }
    if (![...s.kanji].every((c) => HAN.test(c) || /[々]/u.test(c))) throw Error(`${where}: marked word must be kanji only: ${s.kanji}`);
    for (const c of s.kanji) if (!taught.has(c)) throw Error(`${where}: ${c} is not taught yet`);
    if (!/^[\p{Script=Hiragana}ー]+$/u.test(s.reading)) throw Error(`${where}: reading must be hiragana: ${s.reading}`);
    readings.push({start: text.length, end: text.length + s.kanji.length, reading: s.reading});
    text += s.kanji;
  }
  // Each reading must cover a whole run of kanji (dialogue-furigana.js).
  const groups = furigana.groups(text);
  if (groups.length !== readings.length || groups.some((g, i) => g.start !== readings[i].start || g.end !== readings[i].end)) {
    throw Error(`${where}: furigana must cover each kanji run exactly: ${marked}`);
  }
  return {text, readings};
}

const split = (dialog) => dialog.split('\n').map((line) => {
  const m = line.match(/^([AB]): (.+)$/u);
  if (!m) throw Error('Unexpected dialogue line: ' + line);
  return {speaker: m[1], text: m[2]};
});

export function buildPlan(source, authored, chapters = n4ChapterKanji()) {
  const ids = Object.keys(authored);
  if (ids.length !== source.items.length) throw Error('Expected a rewrite for every N4 dialogue');
  const items = source.items.map((item) => {
    const key = ids.find((k) => item.grammarId.startsWith(k));
    if (!key || ids.filter((k) => item.grammarId.startsWith(k)).length !== 1) throw Error('No unique rewrite for ' + item.grammarId);
    const before = split(item.replacement.example_dialog);
    const lines = authored[key].trim().split('\n');
    if (lines.length !== before.length) throw Error(`${key}: line count changed`);
    const taught = taughtKanji(item.chapter, chapters);
    const after = lines.map((line, i) => {
      const m = line.match(/^([AB]): (.+)$/u);
      if (!m || m[1] !== before[i].speaker) throw Error(`${key} line ${i + 1}: speaker changed`);
      return {speaker: m[1], ...buildLine(m[2], before[i].text, taught, `${key} line ${i + 1}`)};
    });
    const expressions = item.replacement.dialog_scene.expressions;
    if (!Array.isArray(expressions) || expressions.length !== before.length) throw Error(`${key}: expressions out of line`);
    return {
      grammarId: item.grammarId, chapter: item.chapter,
      expected: {example_dialog: item.replacement.example_dialog, example_dialog_id: item.replacement.example_dialog_id},
      replacement: {
        example_dialog: after.map((l) => `${l.speaker}: ${l.text}`).join('\n'),
        dialog_furigana: furigana.normalize({schemaVersion: 1, lines: after.map((l) => ({speaker: l.speaker, text: l.text, readings: l.readings}))}),
      },
      // Expression rows follow their line: old text → new text, by position.
      textChanges: before.map((b, i) => ({speaker: b.speaker, from: b.text, to: after[i].text})),
    };
  });
  return {schemaVersion: 1, courseId: source.courseId, items};
}

export function buildMigration(plan) {
  return `-- N4 dialogues use the kanji already taught at their chapter, with furigana.
-- Generated by scripts/build-n4-dialogue-kanji.mjs from
-- content/n4-support/dialogue-kanji.mjs; the same plan is read at runtime
-- (n4-dialogue-support.js) so the reading checks stay attached.
-- Only rows still holding the migration 190 text are changed: a dialogue an
-- admin has edited since is left alone (NOTICE), and so is one that has
-- dialogue questions (their fingerprint and quoted evidence would go stale).
-- Expression choices move to the rewritten text of the same line. Audio is
-- unchanged: kanji with furigana are voiced by their reading (routes/tts.js).
CREATE TABLE IF NOT EXISTS n4_dialogue_kanji_backup_192(grammar_id uuid PRIMARY KEY,before_data jsonb NOT NULL,created_at timestamptz DEFAULT now());
DO $kanji$
DECLARE p jsonb := $content$${JSON.stringify(plan)}$content$::jsonb; x jsonb; g record; changed int := 0; skipped int := 0;
BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  SELECT id, example_dialog, example_dialog_id, dialog_furigana, dialog_scene INTO g FROM module_grammar WHERE id=(x->>'grammarId')::uuid FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF g.example_dialog = x->'replacement'->>'example_dialog' THEN CONTINUE; END IF;
  IF g.example_dialog IS DISTINCT FROM x->'expected'->>'example_dialog'
     OR g.example_dialog_id IS DISTINCT FROM x->'expected'->>'example_dialog_id'
     OR g.dialog_furigana IS NOT NULL
     OR EXISTS(SELECT 1 FROM grammar_dialog_questions WHERE grammar_id=g.id) THEN
   skipped := skipped + 1;
   RAISE NOTICE '192: dialog % sudah diubah sejak 190, dilewati: %', g.id, split_part(coalesce(g.example_dialog,''), E'\\n', 1);
   CONTINUE;
  END IF;
  INSERT INTO n4_dialogue_kanji_backup_192 VALUES (g.id, jsonb_build_object('example_dialog',g.example_dialog,'dialog_furigana',g.dialog_furigana,'dialog_scene',g.dialog_scene), now())
   ON CONFLICT (grammar_id) DO NOTHING;
  UPDATE module_grammar SET
   example_dialog = x->'replacement'->>'example_dialog',
   dialog_furigana = x->'replacement'->'dialog_furigana',
   dialog_scene = CASE WHEN jsonb_typeof(g.dialog_scene->'expressions') = 'array' THEN jsonb_set(g.dialog_scene, '{expressions}', (
     SELECT coalesce(jsonb_agg(CASE WHEN e.value <> 'null'::jsonb
        AND e.value->>'speaker' = x->'textChanges'->((e.n-1)::int)->>'speaker'
        AND e.value->>'text' = x->'textChanges'->((e.n-1)::int)->>'from'
       THEN jsonb_set(e.value, '{text}', x->'textChanges'->((e.n-1)::int)->'to') ELSE e.value END ORDER BY e.n), '[]'::jsonb)
     FROM jsonb_array_elements(g.dialog_scene->'expressions') WITH ORDINALITY e(value, n))) ELSE g.dialog_scene END,
   updated_at = now()
  WHERE id = g.id;
  changed := changed + 1;
 END LOOP;
 RAISE NOTICE '192: % dialog N4 memakai kanji yang sudah diajarkan, % dilewati', changed, skipped;
END $kanji$;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(fs.readFileSync(new URL('dialogue-plan.json', dir), 'utf8'));
  const authored = (await import(new URL('dialogue-kanji.mjs', dir))).default;
  const plan = buildPlan(source, authored);
  const json = JSON.stringify(plan, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(planUrl, 'utf8') !== json) throw Error('Regenerate dialogue-kanji-plan.json');
    if (fs.readFileSync(migrationUrl, 'utf8') !== buildMigration(plan)) throw Error('Regenerate migration 192');
  } else {
    fs.writeFileSync(planUrl, json);
    fs.writeFileSync(migrationUrl, buildMigration(plan));
    const kanji = plan.items.reduce((n, i) => n + i.replacement.dialog_furigana.lines.reduce((m, l) => m + l.readings.length, 0), 0);
    console.log(JSON.stringify({dialogues: plan.items.length, kanjiWords: kanji}));
  }
}
