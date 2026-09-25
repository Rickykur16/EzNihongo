const ASSESSMENT_KIND_BY_SLUG = Object.freeze({
  'assignment-bab-1-hiragana': 'hiragana',
  'assignment-bab-2-katakana': 'katakana',
});

export function kanaAssessmentKind(lessonSlug) {
  return ASSESSMENT_KIND_BY_SLUG[String(lessonSlug || '').trim()] || null;
}

export function passedKanaKinds(lessonSlugs) {
  return new Set((lessonSlugs || []).map(kanaAssessmentKind).filter(Boolean));
}

export function excludePlacedKana(rows, kinds) {
  const excluded = kinds instanceof Set ? kinds : new Set(kinds || []);
  return (rows || []).filter((row) => !excluded.has(row.kind));
}

export function normalizeKanaReading(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/sh([ayuo])/g, 'sy$1')
    .replace(/ch([ayuo])/g, 'ty$1')
    .replace(/j([ayuo])/g, 'zy$1')
    .replace(/shi/g, 'si')
    .replace(/chi/g, 'ti')
    .replace(/tsu/g, 'tu')
    .replace(/fu/g, 'hu')
    .replace(/ji/g, 'zi')
    .replace(/[^a-z]/g, '');
}

export function isKanaReadingCorrect(submitted, expected) {
  const answer = normalizeKanaReading(submitted);
  return answer.length > 0 && answer === normalizeKanaReading(expected);
}

export function gradeKanaPlacement(questions, answersByQuestion, passingScorePct = 85) {
  const correctByQuestion = {};
  const bySection = new Map();
  for (const question of questions || []) {
    const sectionNumber = Number(question.section_number) || 1;
    if (!bySection.has(sectionNumber)) {
      bySection.set(sectionNumber, {
        sectionNumber,
        sectionLabel: question.section_label || `Bagian ${sectionNumber}`,
        score: 0,
        total: 0,
      });
    }
    const section = bySection.get(sectionNumber);
    const correct = !!answersByQuestion.get(question.question_id)?.correct;
    correctByQuestion[question.question_id] = correct;
    section.total += 1;
    if (correct) section.score += 1;
  }
  const sectionResults = [...bySection.values()]
    .sort((a, b) => a.sectionNumber - b.sectionNumber)
    .map((section) => ({
      ...section,
      minimumCorrect: Math.ceil(section.total * 0.75),
      passed: section.score >= Math.ceil(section.total * 0.75),
    }));
  const score = Object.values(correctByQuestion).filter(Boolean).length;
  const total = (questions || []).length;
  const overallPassed = total > 0 && score * 100 / total >= passingScorePct;
  return {
    score,
    total,
    correctByQuestion,
    sectionResults,
    passed: overallPassed && sectionResults.length > 0 && sectionResults.every((section) => section.passed),
  };
}

function shuffled(values, random) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pull evenly from every assessment section. The production assessments use
// four questions per section: three typed readings and one multiple choice.
export function sampleKanaPlacementQuestions(rows, target, random = Math.random) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const limit = Math.min(rows.length, Math.max(0, Number(target) || rows.length));
  const bySection = new Map();
  for (const row of rows) {
    const section = Number(row.section_number) || 1;
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section).push(row);
  }
  const groups = [...bySection.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group);
  const baseQuota = Math.floor(limit / groups.length);
  const extraSections = limit % groups.length;
  const picked = groups.flatMap((group, index) => {
      const quota = baseQuota + (index < extraSections ? 1 : 0);
      const typed = shuffled(group.filter((row) => row.question_type === 'fill_blank'), random);
      const choices = shuffled(group.filter((row) => row.question_type !== 'fill_blank'), random);
      return [...typed.slice(0, Math.min(3, quota)), ...choices.slice(0, 1),
        ...typed.slice(Math.min(3, quota)), ...choices.slice(1)].slice(0, quota);
    });
  return shuffled(picked, random);
}

// A passing kana diagnostic proves the skill without pretending the student
// spent time in every introductory lesson. Progress is completed directly,
// while XP and learned-minute counters remain reserved for lessons undertaken.
export async function completeKanaPlacementLessons(client, {
  userId,
  assessmentLessonId,
  assessmentSlug,
}) {
  const kind = kanaAssessmentKind(assessmentSlug);
  if (!kind) return [];

  const candidates = await client.query(
    `SELECT l.id AS lesson_id, m.slug AS module_slug, l.slug AS lesson_slug
       FROM lessons assessment
       JOIN modules assessment_module ON assessment_module.id = assessment.module_id
       JOIN courses assessment_course ON assessment_course.id = assessment_module.course_id
       JOIN modules m ON m.course_id = assessment_module.course_id
       JOIN lessons l ON l.module_id = m.id
       JOIN lesson_kana_items lki ON lki.lesson_id = l.id
       JOIN kana_items k ON k.id = lki.kana_id
      WHERE assessment.id = $1
        AND assessment_course.slug = 'n5'
        AND l.type = 'kana'
        AND (
          m.sort_order < assessment_module.sort_order
          OR (m.id = assessment_module.id AND l.sort_order < assessment.sort_order)
        )
      GROUP BY l.id, m.slug, l.slug
     HAVING BOOL_AND(k.kind = $2)
      ORDER BY MIN(m.sort_order), MIN(l.sort_order), l.id`,
    [assessmentLessonId, kind]
  );

  const rows = candidates.rows || [];
  if (!rows.length) return [];
  await client.query(
    `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
     SELECT $1, candidate.lesson_id, TRUE, NOW()
       FROM UNNEST($2::uuid[]) AS candidate(lesson_id)
     ON CONFLICT (user_id, lesson_id) DO UPDATE
       SET completed = TRUE,
           completed_at = COALESCE(user_progress.completed_at, NOW()),
           updated_at = NOW()
       WHERE user_progress.completed IS DISTINCT FROM TRUE`,
    [userId, rows.map((row) => row.lesson_id)]
  );

  return rows.map((row) => ({
    lessonId: row.lesson_id,
    moduleSlug: row.module_slug,
    lessonSlug: row.lesson_slug,
  }));
}
