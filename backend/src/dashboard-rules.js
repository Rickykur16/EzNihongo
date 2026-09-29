export function masteryDisplay({ attempts = 0, correct = 0 }) {
  if (attempts < 3) return { label: 'Belum cukup latihan', percentage: null, attempts };
  const percentage = Math.round((correct / attempts) * 100);
  if (percentage < 60) return { label: 'Perlu diperkuat', percentage, attempts };
  if (percentage < 80) return { label: 'Berkembang', percentage, attempts };
  if (percentage < 90) return { label: 'Baik', percentage, attempts };
  return { label: 'Sangat baik', percentage, attempts };
}

export function masteryDisplayFromPercentage({ attempts = 0, percentage = null }) {
  if (attempts < 3 || percentage == null) return { label: 'Belum cukup latihan', percentage: null, attempts };
  const rounded = Math.round(percentage);
  if (rounded < 60) return { label: 'Perlu diperkuat', percentage: rounded, attempts };
  if (rounded < 80) return { label: 'Berkembang', percentage: rounded, attempts };
  if (rounded < 90) return { label: 'Baik', percentage: rounded, attempts };
  return { label: 'Sangat baik', percentage: rounded, attempts };
}

export function weeklyInsight({ reviewDue = 0, activeDays = 0, attempts = 0, accuracy = null, accuracyTrend = null, focus = null }) {
  if (reviewDue > 0 && activeDays === 0) return { kind: 'small_review', message: 'Mulai pelan: selesaikan satu sesi Smart Review singkat hari ini.', action: 'review' };
  if (reviewDue > 0) return { kind: 'due_review', message: `${reviewDue} item sudah siap diulang. Prioritaskan Smart Review sebelum materi baru.`, action: 'review' };
  if (accuracyTrend != null && accuracyTrend <= -10) return { kind: 'declining_accuracy', message: 'Akurasi minggu ini menurun. Ulangi fokus belajarmu sebelum menambah materi baru.', action: focus?.action || 'review' };
  if (attempts >= 6 && accuracy != null && accuracy >= 80) return { kind: 'steady_progress', message: 'Hasil latihanmu minggu ini sangat baik. Pertahankan ritmenya dan lanjutkan ke pelajaran berikutnya.', action: 'continue' };
  if (activeDays === 0) return { kind: 'low_activity', message: 'Belum ada aktivitas minggu ini. Mulai dari satu pelajaran atau satu review singkat.', action: 'continue' };
  return { kind: 'neutral', message: 'Lanjutkan belajar secara konsisten. Rekomendasi berikutnya akan muncul setelah kamu menyelesaikan lebih banyak latihan.', action: 'continue' };
}

const sourceOf = row => row.conversation_source_lesson_id ?? row.conversationSourceLessonId ?? null;
const popupOf = row => row.popup_after_lesson_id ?? row.popupAfterLessonId ?? null;

// Rows arrive in the same module/lesson order as the public course DTO. A
// Percakapan is a real lesson (migration 178) pointing at its grammar source;
// a Tugas Bunpou popped up after that source is placed right after the
// source's Percakapan, so the path reads grammar → conversation → task.
export function projectDashboardLearningSteps(rows) {
  const modules = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = row.module_id ?? row.moduleId;
    if (!modules.has(key)) modules.set(key, []);
    modules.get(key).push(row);
  }
  const result = [];
  for (const lessons of modules.values()) {
    const conversationBySource = new Map();
    for (const row of lessons) {
      if (row.type !== 'conversation' || !sourceOf(row)) continue;
      if (!lessons.some(source => source.id === sourceOf(row))) continue;
      conversationBySource.set(sourceOf(row), row);
    }
    const byAnchor = new Map();
    for (const task of lessons) {
      if (task.type !== 'grammar_task' || !popupOf(task)) continue;
      const anchor = conversationBySource.get(popupOf(task));
      if (!anchor) continue; // No Percakapan for that source: keep CMS order.
      byAnchor.set(anchor, [...(byAnchor.get(anchor) || []), task]);
    }
    const moved = new Set([...byAnchor.values()].filter(tasks => tasks.length === 1)
      .map(tasks => tasks[0]));
    for (const lesson of lessons) {
      if (moved.has(lesson)) continue;
      result.push({ view: 'lesson', row: lesson });
      const linked = byAnchor.get(lesson);
      if (linked?.length === 1) result.push({ view: 'lesson', row: linked[0] });
    }
  }
  return result;
}

export function structuralProgressAndNext(rows) {
  const lessons = Array.isArray(rows) ? rows : [];
  const completedLessons = lessons.filter((row) => row.completed).length;
  const steps = projectDashboardLearningSteps(lessons);
  const destination = steps.find(step => !step.row.completed);
  return {
    completedLessons,
    totalLessons: lessons.length,
    percentage: lessons.length ? Math.round((completedLessons / lessons.length) * 100) : 0,
    next: destination?.row || null,
    nextView: destination?.view || null,
  };
}

export function continueLearningDto(structural) {
  const next = structural?.next;
  if (!next) return null;
  return { section: next.section_name || null,
    view: structural.nextView,
    chapter: { id: next.module_id, slug: next.module_slug, title: next.module_title },
    lesson: { id: next.id, slug: next.slug, title: next.title, type: next.type } };
}

export function isVisibleCurriculumLesson() {
  // Every persisted lesson participates in the learner sequence. A task's
  // popup source and a Percakapan's grammar source are relationships, not
  // reasons to omit a lesson's completion.
  return true;
}
