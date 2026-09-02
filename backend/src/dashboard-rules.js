export function masteryDisplay({ attempts = 0, correct = 0 }) {
  if (attempts < 3) return { label: 'Belum cukup data', percentage: null, attempts };
  const percentage = Math.round((correct / attempts) * 100);
  if (percentage < 60) return { label: 'Perlu latihan', percentage, attempts };
  if (percentage < 80) return { label: 'Sedang berkembang', percentage, attempts };
  return { label: 'Kuat', percentage, attempts };
}

export function masteryDisplayFromPercentage({ attempts = 0, percentage = null }) {
  if (attempts < 3 || percentage == null) return { label: 'Belum cukup data', percentage: null, attempts };
  const rounded = Math.round(percentage);
  if (rounded < 60) return { label: 'Perlu latihan', percentage: rounded, attempts };
  if (rounded < 80) return { label: 'Sedang berkembang', percentage: rounded, attempts };
  return { label: 'Kuat', percentage: rounded, attempts };
}

export function weeklyInsight({ reviewDue = 0, activeDays = 0, attempts = 0, accuracy = null, accuracyTrend = null, focus = null }) {
  if (reviewDue > 0 && activeDays === 0) return { kind: 'small_review', message: 'Mulai pelan: selesaikan satu sesi Smart Review singkat hari ini.', action: 'review' };
  if (reviewDue > 0) return { kind: 'due_review', message: `${reviewDue} item sudah siap diulang. Prioritaskan Smart Review sebelum materi baru.`, action: 'review' };
  if (accuracyTrend != null && accuracyTrend <= -10) return { kind: 'declining_accuracy', message: 'Akurasi minggu ini menurun. Ulangi fokus belajarmu sebelum menambah materi baru.', action: focus?.action || 'review' };
  if (attempts >= 6 && accuracy != null && accuracy >= 80) return { kind: 'steady_progress', message: 'Retensimu minggu ini kuat. Pertahankan ritme belajar dan lanjutkan pelajaran berikutnya.', action: 'continue' };
  if (activeDays === 0) return { kind: 'low_activity', message: 'Belum ada aktivitas minggu ini. Mulai dari satu pelajaran atau satu review singkat.', action: 'continue' };
  return { kind: 'neutral', message: 'Lanjutkan belajar secara konsisten; Dashboard akan menampilkan fokus setelah bukti latihan bertambah.', action: 'continue' };
}

export function structuralProgressAndNext(rows) {
  const lessons = Array.isArray(rows) ? rows : [];
  const completedLessons = lessons.filter((row) => row.completed).length;
  return {
    completedLessons,
    totalLessons: lessons.length,
    percentage: lessons.length ? Math.round((completedLessons / lessons.length) * 100) : 0,
    next: lessons.find((row) => !row.completed) || null,
  };
}

export function isVisibleCurriculumLesson(row = {}) {
  const popupAfterLessonId = row.popup_after_lesson_id ?? row.popupAfterLessonId;
  return !(row.type === 'grammar_task' && popupAfterLessonId);
}
