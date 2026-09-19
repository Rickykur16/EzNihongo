import { query } from './db.js';
import { loadCompanionContext } from './bunpou-flow-content.js';
import { deriveDrills } from './grammar-drills.js';

export async function loadPilotLessonOptions() {
  const result = await query(`SELECT l.id, l.title, m.title AS "moduleTitle", c.title AS "courseTitle",
    c.level, c.is_published, c.is_available, l.video_url, l.video_source_id,
    l.bunpou_flow_published IS NOT NULL AS published
    FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
    WHERE l.type IN ('video','text') AND EXISTS (SELECT 1 FROM module_grammar g WHERE g.lesson_id = l.id)
    ORDER BY c.sort_order, c.id, m.sort_order, m.id, l.sort_order, l.id`);
  const options = [];
  for (const lesson of result.rows) {
    let reason = null;
    if (String(lesson.level).toUpperCase() !== 'N5') reason = 'Pilot hanya untuk N5';
    else if (!lesson.is_published || !lesson.is_available) reason = 'Course belum aktif';
    else if (!lesson.video_source_id && !lesson.video_url?.trim()) reason = 'Video belum terhubung';
    else if (!lesson.published) reason = 'Pendamping belum dipublikasikan';
    else {
      const context = await loadCompanionContext(lesson.id);
      if (!context) reason = 'Pasangan Tugas Bunpou belum valid';
      else if (!context.current) reason = 'Materi perlu ditinjau dan dipublikasikan ulang';
      else if (!context.items.length || context.items.some(item => !item.examples.length || !item.example_dialog?.trim())) {
        reason = 'Contoh atau dialog tugas belum lengkap';
      } else {
        const drills = deriveDrills(context.items, context.pool);
        if (context.items.some(item => !drills.get(item.id)?.step1 || !drills.get(item.id)?.step2)) {
          reason = 'Soal pengenalan atau latihan bentuk belum tersedia untuk semua pola';
        }
      }
    }
    options.push({ id: lesson.id, title: lesson.title, moduleTitle: lesson.moduleTitle,
      courseTitle: lesson.courseTitle, ready: !reason, reason });
  }
  return options;
}
