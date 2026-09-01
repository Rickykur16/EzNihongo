export function chapterStructuralProgress({ completed_lessons = 0, total_lessons = 0 } = {}) {
  const completedLessons = Number(completed_lessons) || 0;
  const totalLessons = Number(total_lessons) || 0;
  return { completedLessons, totalLessons, percentage: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0 };
}

export function chaptersBySection(chapters) {
  const groups = new Map();
  for (const chapter of chapters || []) {
    const section = chapter.section || 'Kurikulum';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(chapter);
  }
  return groups;
}
