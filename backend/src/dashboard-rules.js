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

function hasConversation(row) {
  return row.type !== 'grammar_task' && row.type !== 'quiz' &&
    (row.has_dialog === true || row.hasDialog === true);
}

// Rows arrive in the same module/lesson order as the public course DTO. A
// conversation is a view of its source row; it never enters the denominator.
export function projectDashboardLearningSteps(rows) {
  const modules = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = row.module_id ?? row.moduleId;
    if (!modules.has(key)) modules.set(key, []);
    modules.get(key).push(row);
  }
  const result = [];
  for (const lessons of modules.values()) {
    const bySource = new Map();
    for (const task of lessons) {
      const sourceId = task.popup_after_lesson_id ?? task.popupAfterLessonId;
      if (task.type !== 'grammar_task' || !sourceId) continue;
      const matches = lessons.filter(source => source.id === sourceId && hasConversation(source));
      if (matches.length !== 1) continue;
      bySource.set(matches[0], [...(bySource.get(matches[0]) || []), task]);
    }
    const moved = new Set([...bySource.values()].filter(tasks => tasks.length === 1)
      .map(tasks => tasks[0]));
    for (const lesson of lessons) {
      if (moved.has(lesson)) continue;
      result.push({ view: 'lesson', row: lesson });
      if (hasConversation(lesson)) result.push({ view: 'conversation', row: lesson });
      const linked = bySource.get(lesson);
      if (linked?.length === 1) result.push({ view: 'lesson', row: linked[0] });
    }
  }
  return result;
}

export function structuralProgressAndNext(rows) {
  const lessons = Array.isArray(rows) ? rows : [];
  const completedLessons = lessons.filter((row) => row.completed).length;
  const steps = projectDashboardLearningSteps(lessons);
  const dueIndex = steps.findIndex(step => step.view === 'lesson' && !step.row.completed);
  const due = steps[dueIndex];
  const before = steps[dueIndex - 1];
  const destination = before?.view === 'conversation' && due &&
    (before.row.module_id ?? before.row.moduleId) === (due.row.module_id ?? due.row.moduleId)
    ? before : due;
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
    sourceLessonId: structural.nextView === 'conversation' ? next.id : null,
    chapter: { id: next.module_id, slug: next.module_slug, title: next.module_title },
    lesson: { id: next.id, slug: next.slug, title: next.title, type: next.type } };
}

export function isVisibleCurriculumLesson() {
  // Every persisted lesson participates in the learner sequence. A task's
  // popup source is a relationship, not a reason to omit its completion.
  // Conversation views reuse a source lesson and create no persisted row.
  return true;
}
