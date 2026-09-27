import { query } from './db.js';
import { loadCompanionContext } from './bunpou-flow-content.js';
import { deriveDrills } from './grammar-drills.js';

// Satu aturan untuk "apakah Pendamping Bunpou pelajaran ini tampil ke siswa".
// Tidak ada lagi saklar pilot satu-pelajaran: pendamping yang dipublikasikan
// langsung aktif, selama pelajarannya lolos cek kesiapan di bawah. Aturan ini
// dipakai BERSAMA oleh daftar status admin, payload pelajaran siswa, sesi
// Tugas Bunpou, dan Smart Review, supaya tidak mungkin "admin bilang aktif
// tapi siswa tidak melihatnya" karena dua salinan aturan yang berbeda.
//
// Kesiapan dicek ulang setiap kali dibaca, bukan dibekukan saat publish:
// materi yang berubah sesudah publikasi (sidik jari sumber tidak cocok lagi)
// otomatis berhenti tampil sampai ditinjau dan dipublikasikan ulang.
const LESSON_COLUMNS = `l.id, l.title, m.title AS "moduleTitle", c.title AS "courseTitle",
    c.level, c.is_published, c.is_available, l.video_url, l.video_source_id,
    l.bunpou_flow_published IS NOT NULL AS published
    FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
    WHERE l.type IN ('video','text')`;

// `code` membedakan pasangan Tugas Bunpou yang tidak sah (masalah integritas
// data, dijawab 404 seperti sebelumnya) dari alasan "belum siap tampil"
// lainnya (dijawab 403 supaya klien kembali ke drill lama dengan mulus).
async function readiness(lesson, dbQuery) {
  if (String(lesson.level).toUpperCase() !== 'N5') return { reason: 'Pendamping saat ini hanya untuk N5' };
  if (!lesson.is_published || !lesson.is_available) return { reason: 'Course belum aktif' };
  if (!lesson.video_source_id && !lesson.video_url?.trim()) return { reason: 'Video belum terhubung' };
  if (!lesson.published) return { reason: 'Pendamping belum dipublikasikan' };
  const context = await loadCompanionContext(lesson.id, dbQuery);
  if (!context) return { reason: 'Pasangan Tugas Bunpou belum valid', code: 'invalid_pair' };
  if (!context.current) return { reason: 'Materi perlu ditinjau dan dipublikasikan ulang' };
  if (!context.items.length || context.items.some(item => !item.examples.length || !item.example_dialog?.trim())) {
    return { reason: 'Contoh atau dialog tugas belum lengkap' };
  }
  const drills = deriveDrills(context.items, context.pool);
  if (context.items.some(item => !drills.get(item.id)?.step1 || !drills.get(item.id)?.step2)) {
    return { reason: 'Soal pengenalan atau latihan bentuk belum tersedia untuk semua pola' };
  }
  return { reason: null, context };
}

// Daftar admin: semua pelajaran Bunpou beserta status tampilnya. Pelajaran
// yang sudah dipublikasikan selalu ikut terdaftar walau pola grammarnya kini
// milik pelajaran lain, supaya publikasinya tetap bisa ditarik dari sini.
export async function loadCompanionLessonOptions(dbQuery = query) {
  const result = await dbQuery(`SELECT ${LESSON_COLUMNS}
      AND (l.bunpou_flow_published IS NOT NULL
        OR EXISTS (SELECT 1 FROM module_grammar g WHERE g.lesson_id = l.id))
    ORDER BY c.sort_order, c.id, m.sort_order, m.id, l.sort_order, l.id`);
  const options = [];
  for (const lesson of result.rows) {
    const { reason } = await readiness(lesson, dbQuery);
    options.push({ id: lesson.id, title: lesson.title, moduleTitle: lesson.moduleTitle,
      courseTitle: lesson.courseTitle, published: lesson.published, live: !reason, reason });
  }
  return options;
}

// Jalur siswa: dari sekumpulan pelajaran, kembalikan Map<lessonId, context>
// untuk yang pendampingnya sedang aktif. Pelajaran tanpa publikasi disaring
// di SQL, jadi pelajaran biasa tidak menambah biaya apa pun selain satu query.
export async function liveCompanionContexts(lessonIds, dbQuery = query) {
  const live = new Map();
  const ids = [...new Set((lessonIds || []).filter(Boolean))];
  if (!ids.length) return live;
  const result = await dbQuery(`SELECT ${LESSON_COLUMNS}
      AND l.bunpou_flow_published IS NOT NULL AND l.id = ANY($1::uuid[])`, [ids]);
  await Promise.all(result.rows.map(async (lesson) => {
    const { reason, context } = await readiness(lesson, dbQuery);
    if (!reason) live.set(lesson.id, context);
  }));
  return live;
}

export async function companionLiveCheck(lessonId, dbQuery = query) {
  const result = await dbQuery(`SELECT ${LESSON_COLUMNS} AND l.id = $1`, [lessonId]);
  if (!result.rows.length) return { reason: 'Pelajaran bukan pelajaran Bunpou' };
  const { reason, code } = await readiness(result.rows[0], dbQuery);
  return { reason, code: code || null };
}

export async function companionLiveReason(lessonId, dbQuery = query) {
  return (await companionLiveCheck(lessonId, dbQuery)).reason;
}
