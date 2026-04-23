// import-curriculum.mjs — parse EzNihongo_{N3,N4,N5}_Curriculum.xlsx and rebuild
// courses, modules, lessons, module_vocabulary, module_grammar in Postgres.
//
// Each L-sheet → 1 module + many bite-sized lessons:
//   - 1 intro lesson (can-do + scenario + skill distribution rendered in content)
//   - 1..N vocabulary lessons (grouped by category; chunked ≤12 per lesson)
//   - 1 lesson per grammar pattern
//   - 1 quiz placeholder lesson
//
// Transactional per level. DELETE FROM modules WHERE course_id=$1 cascades
// through lessons + quiz + vocab + grammar, so re-running is safe.
//
// Usage (on VPS or any host with DATABASE_URL):
//   cd backend && node scripts/import-curriculum.mjs [--files <dir>]
//
// Default --files resolves to ~/Downloads/files kurikulum.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import XLSX from 'xlsx';
import { db } from '../src/db.js';

const argv = process.argv.slice(2);
const filesArg = argv.indexOf('--files');
const FILES_DIR = filesArg >= 0
  ? argv[filesArg + 1]
  : resolve(homedir(), 'Downloads', 'files kurikulum');

const LEVELS = [
  { slug: 'n5', file: 'EzNihongo_N5_Curriculum.xlsx', title: 'Kelas N5', level: 'N5', sortOrder: 1 },
  { slug: 'n4', file: 'EzNihongo_N4_Curriculum.xlsx', title: 'Kelas N4', level: 'N4', sortOrder: 2 },
  { slug: 'n3', file: 'EzNihongo_N3_Curriculum.xlsx', title: 'Kelas N3', level: 'N3', sortOrder: 3 },
];

const VOCAB_CHUNK = 12; // above this, split one category across multiple lessons

// ---------------------------------------------------------------------------
// xlsx parsing
// ---------------------------------------------------------------------------

function normRow(r) {
  return (Array.isArray(r) ? r : []).map((c) => (c == null ? '' : String(c).trim()));
}

function sectionStart(row, marker) {
  return row[0] && row[0].includes(marker);
}

function parseLessonSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true }).map(normRow);

  // Row 0: "L1 — Title ID"
  const titleRow = rows[0]?.[0] || '';
  const match = titleRow.match(/^(L\d+)\s*[—-]\s*(.+)$/);
  const lessonCode = match ? match[1] : rows[0]?.[0] || '';
  const titleId = match ? match[2] : titleRow;
  const titleEn = rows[1]?.[0] || '';

  // Metadata (rows 3-7): pairs [label, value]
  const meta = {};
  for (let i = 2; i < 10; i++) {
    const [k, v] = rows[i] || [];
    if (!k) continue;
    meta[k.toLowerCase()] = v;
  }
  const jfTopic = meta['jf topic'] || null;
  const cefrLevel = meta['cefr level'] || null;
  // "Estimated teaching hours" dari xlsx di-ignore — durasi modul sekarang
  // dihitung dari SUM(lessons.duration_minutes) di runtime.

  // Section parser: walk top-down, cut sections by markers in column A.
  const markers = {
    cando: '✓ CAN-DO',
    skill: 'SKILL DISTRIBUTION',
    vocab: '📚 VOCABULARY',
    grammar: '📖 GRAMMAR',
    scenario: '💬 REAL-LIFE',
    quiz: '📝 QUIZ',
  };
  const sections = {};
  let current = null;
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i][0] || '';
    let matched = null;
    for (const [key, mk] of Object.entries(markers)) {
      if (first.includes(mk)) { matched = key; break; }
    }
    if (matched) {
      current = matched;
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(rows[i]);
  }

  // Can-Do: rows that start with "N." or non-empty first col
  const candoStatements = (sections.cando || [])
    .map((r) => {
      const numbered = (r[1] || '').trim();
      if (numbered) return numbered;
      return (r[0] || '').replace(/^\d+\./, '').trim();
    })
    .filter((s) => s && !s.includes('CAN-DO'));

  // Skill distribution: rows like ["Listening 聞く", "", 0.35]
  const skillDistribution = {};
  for (const r of sections.skill || []) {
    const label = r[0] || '';
    const pct = Number(r[2]);
    if (!label || Number.isNaN(pct)) continue;
    const key = label.toLowerCase().split(/[\s　]/)[0]; // "listening"/"reading"/etc.
    skillDistribution[key] = pct;
  }

  // Vocabulary: skip header row ["Japanese","Reading",...], then data rows.
  const vocabRaw = sections.vocab || [];
  const vocab = [];
  for (const r of vocabRaw) {
    const [jp, reading, id, category, note] = r;
    if (!jp) continue;
    if (jp === 'Japanese') continue; // header
    vocab.push({
      japanese: jp,
      reading: reading || null,
      indonesian: id || null,
      category: category || 'umum',
      note: note || null,
    });
  }

  // Grammar: skip header ["Pattern","Meaning",...], then data.
  const grammarRaw = sections.grammar || [];
  const grammar = [];
  for (const r of grammarRaw) {
    const [pattern, meaning, example, notes] = r;
    if (!pattern) continue;
    if (pattern === 'Pattern') continue;
    grammar.push({
      pattern,
      meaning: meaning || null,
      example: example || null,
      notes: notes || null,
    });
  }

  // Scenario: first non-empty row in that section.
  const scenario = (sections.scenario || [])
    .map((r) => r[0])
    .filter(Boolean)
    .join('\n\n') || null;

  // Quiz spec rows: [label, "", "", value, ""]
  const quizSections = [];
  let quizTotal = null;
  let quizPass = null;
  for (const r of sections.quiz || []) {
    const label = r[0] || '';
    const value = r[3] || '';
    if (!label) continue;
    if (/^Total/i.test(label)) {
      const n = String(value).match(/(\d+)/);
      quizTotal = n ? Number(n[1]) : null;
    } else if (/Pass/i.test(label)) {
      quizPass = value || null;
    } else {
      const n = String(value).match(/(\d+)/);
      quizSections.push({ label, count: n ? Number(n[1]) : null });
    }
  }
  const quizSpec = { sections: quizSections, total: quizTotal, passThreshold: quizPass };

  return {
    lessonCode,
    titleId,
    titleEn,
    jfTopic,
    cefrLevel,
    candoStatements,
    skillDistribution,
    vocab,
    grammar,
    scenario,
    quizSpec,
  };
}

// ---------------------------------------------------------------------------
// Lesson breakdown
// ---------------------------------------------------------------------------

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'lesson';
}

function renderIntroContent(m) {
  const skillBars = Object.entries(m.skillDistribution || {})
    .map(([k, v]) => `- ${k}: ${Math.round(v * 100)}%`).join('\n');
  const candoList = (m.candoStatements || []).map((c, i) => `${i + 1}. ${c}`).join('\n');
  const parts = [
    `## Tentang ${m.lessonCode} — ${m.titleId}`,
    m.titleEn ? `_${m.titleEn}_` : '',
    m.jfTopic ? `**JF Topic:** ${m.jfTopic} · **CEFR:** ${m.cefrLevel || '-'}` : '',
    '',
    '### Setelah modul ini kamu akan bisa',
    candoList,
    '',
    m.scenario ? `### Konteks nyata\n${m.scenario}` : '',
    '',
    skillBars ? `### Distribusi skill\n${skillBars}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

function renderVocabLessonContent(category, count) {
  return `Kosakata untuk kategori **${category}** — ${count} item. ` +
    `Pelajari masing-masing kosakata di daftar di bawah, lalu lanjutkan ke lesson grammar.`;
}

function renderGrammarLessonContent(g) {
  const parts = [
    `## ${g.pattern}`,
    g.meaning ? `**Arti:** ${g.meaning}` : '',
    g.example ? `**Contoh:**\n\n> ${g.example}` : '',
    g.notes ? `**Catatan sensei:** ${g.notes}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

function renderQuizContent(quizSpec) {
  const lines = (quizSpec.sections || []).map((s) => `- ${s.label}: ${s.count ?? '?'} soal`);
  const total = quizSpec.total ? `\n\n**Total: ${quizSpec.total} soal**` : '';
  const pass = quizSpec.passThreshold ? ` · **Lulus: ${quizSpec.passThreshold}**` : '';
  return [
    'Kuis akhir modul untuk mengecek pemahaman. Soal akan diisi oleh admin.',
    '',
    lines.join('\n') + total + pass,
  ].join('\n');
}

function groupBy(arr, keyFn) {
  const out = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Build lesson definitions for a module. Each returned object is:
 *   { slug, title, type, content, durationMinutes, kind, ref }
 * where `kind` is 'intro'|'vocab'|'grammar'|'quiz' and `ref` is used to
 * back-link vocab/grammar rows to this lesson after insert.
 */
function buildLessonDefs(m) {
  const defs = [];
  let sort = 0;

  // Intro
  defs.push({
    slug: 'intro',
    title: `Intro — ${m.titleId}`,
    type: 'text',
    content: renderIntroContent(m),
    durationMinutes: 10,
    sortOrder: sort++,
    kind: 'intro',
    ref: null,
  });

  // Vocab — group by category, chunk >12 per category
  const byCat = groupBy(m.vocab, (v) => v.category || 'umum');
  for (const [category, items] of byCat) {
    const chunks = chunk(items, VOCAB_CHUNK);
    chunks.forEach((piece, idx) => {
      const suffix = chunks.length > 1 ? ` (${idx + 1}/${chunks.length})` : '';
      defs.push({
        slug: slugify(`vocab-${category}${suffix ? '-' + (idx + 1) : ''}`),
        title: `Kosakata — ${category}${suffix}`,
        type: 'text',
        content: renderVocabLessonContent(category + suffix, piece.length),
        durationMinutes: 15,
        sortOrder: sort++,
        kind: 'vocab',
        ref: { category, chunkIndex: idx, chunkTotal: chunks.length, items: piece },
      });
    });
  }

  // Grammar — one lesson per pattern
  m.grammar.forEach((g, i) => {
    defs.push({
      slug: slugify(`grammar-${g.pattern}-${i + 1}`),
      title: `Grammar — ${g.pattern}`,
      type: 'text',
      content: renderGrammarLessonContent(g),
      durationMinutes: 15,
      sortOrder: sort++,
      kind: 'grammar',
      ref: { grammarIndex: i, grammar: g },
    });
  });

  // Quiz
  defs.push({
    slug: 'quiz',
    title: `Kuis — ${m.titleId}`,
    type: 'quiz',
    content: renderQuizContent(m.quizSpec),
    durationMinutes: 30,
    sortOrder: sort++,
    kind: 'quiz',
    ref: null,
  });

  return defs;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function upsertCourse(client, { slug, title, level, sortOrder, description }) {
  const res = await client.query(
    `INSERT INTO courses (slug, title, description, level, sort_order, is_published)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = COALESCE(EXCLUDED.description, courses.description),
       level = EXCLUDED.level,
       sort_order = EXCLUDED.sort_order,
       is_published = TRUE,
       updated_at = NOW()
     RETURNING id`,
    [slug, title, description, level, sortOrder]
  );
  return res.rows[0].id;
}

async function importLevel(client, level, filePath) {
  const wb = XLSX.readFile(filePath);

  let description = null;
  const readme = wb.Sheets['📖 README'];
  if (readme) {
    const rr = XLSX.utils.sheet_to_json(readme, { header: 1, defval: '' }).map(normRow);
    // Find row after "PURPOSE" label, take next 2-3 text rows.
    const purposeIdx = rr.findIndex((r) => (r[0] || '').trim() === 'PURPOSE');
    if (purposeIdx >= 0) {
      description = rr.slice(purposeIdx + 1, purposeIdx + 4)
        .map((r) => r[0]).filter(Boolean).join(' ').slice(0, 300);
    }
  }

  const courseId = await upsertCourse(client, {
    slug: level.slug,
    title: level.title,
    level: level.level,
    sortOrder: level.sortOrder,
    description,
  });

  // Nuke all existing modules for this course — cascade to lessons/vocab/grammar/quiz.
  await client.query(`DELETE FROM modules WHERE course_id = $1`, [courseId]);

  const lSheets = wb.SheetNames.filter((s) => /^L\d+$/.test(s));
  let totalLessons = 0;
  let totalVocab = 0;
  let totalGrammar = 0;

  for (let idx = 0; idx < lSheets.length; idx++) {
    const sheetName = lSheets[idx];
    const parsed = parseLessonSheet(wb.Sheets[sheetName]);
    const moduleSlug = slugify(parsed.lessonCode);
    const moduleTitle = `${parsed.lessonCode} — ${parsed.titleId}`;

    const modIns = await client.query(
      `INSERT INTO modules (
         course_id, slug, title, description, sort_order,
         jf_topic, cefr_level, title_en, scenario,
         cando_statements, skill_distribution, quiz_spec
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)
       RETURNING id`,
      [
        courseId, moduleSlug, moduleTitle, parsed.titleEn || null, idx + 1,
        parsed.jfTopic, parsed.cefrLevel, parsed.titleEn, parsed.scenario,
        JSON.stringify(parsed.candoStatements || []),
        JSON.stringify(parsed.skillDistribution || {}),
        JSON.stringify(parsed.quizSpec || {}),
      ]
    );
    const moduleId = modIns.rows[0].id;

    const lessonDefs = buildLessonDefs(parsed);
    const vocabLessonByCategory = new Map(); // category+chunk → lessonId
    const grammarLessonByIndex = new Map();  // grammar pattern index → lessonId

    for (const def of lessonDefs) {
      const ins = await client.query(
        `INSERT INTO lessons (module_id, slug, title, type, content, duration_minutes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [moduleId, def.slug, def.title, def.type, def.content, def.durationMinutes, def.sortOrder]
      );
      const lessonId = ins.rows[0].id;
      totalLessons++;

      if (def.kind === 'vocab') {
        const key = `${def.ref.category}::${def.ref.chunkIndex}`;
        vocabLessonByCategory.set(key, lessonId);
      } else if (def.kind === 'grammar') {
        grammarLessonByIndex.set(def.ref.grammarIndex, lessonId);
      }
    }

    let vocabSort = 0;
    const byCat = groupBy(parsed.vocab, (v) => v.category || 'umum');
    for (const [category, items] of byCat) {
      const chunks = chunk(items, VOCAB_CHUNK);
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const piece = chunks[chunkIdx];
        const lessonId = vocabLessonByCategory.get(`${category}::${chunkIdx}`) || null;
        for (const v of piece) {
          await client.query(
            `INSERT INTO module_vocabulary
               (module_id, lesson_id, japanese, reading, indonesian, category, note, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [moduleId, lessonId, v.japanese, v.reading, v.indonesian, v.category, v.note, vocabSort++]
          );
        }
      }
    }

    totalVocab += parsed.vocab.length;
    totalGrammar += parsed.grammar.length;

    // Grammar rows
    for (let gi = 0; gi < parsed.grammar.length; gi++) {
      const g = parsed.grammar[gi];
      const lessonId = grammarLessonByIndex.get(gi) || null;
      await client.query(
        `INSERT INTO module_grammar
           (module_id, lesson_id, pattern, meaning, example, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [moduleId, lessonId, g.pattern, g.meaning, g.example, g.notes, gi]
      );
    }
  }

  return { modules: lSheets.length, lessons: totalLessons, vocab: totalVocab, grammar: totalGrammar };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL not set.');
    process.exit(1);
  }

  const client = await db.connect();
  try {
    for (const level of LEVELS) {
      const filePath = resolve(FILES_DIR, level.file);
      try {
        readFileSync(filePath); // existence check
      } catch {
        console.warn(`⚠️  ${level.slug.toUpperCase()}: file not found at ${filePath}, skipping`);
        continue;
      }
      console.log(`→ Importing ${level.slug.toUpperCase()} from ${filePath} ...`);
      await client.query('BEGIN');
      try {
        const summary = await importLevel(client, level, filePath);
        await client.query('COMMIT');
        console.log(
          `✔ ${level.slug.toUpperCase()}: ${summary.modules} modules, ` +
          `${summary.lessons} lessons, ${summary.vocab} vocab, ${summary.grammar} grammar`
        );
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`✗ ${level.slug.toUpperCase()} failed, rolled back:`, e.message);
        throw e;
      }
    }
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
