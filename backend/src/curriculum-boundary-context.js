import { createHash } from 'node:crypto';

export class GroundedContextError extends Error {
  constructor(code) { super(code); this.name = 'GroundedContextError'; this.code = code; }
}

const sorted = rows => [...(rows || [])].sort((a, b) =>
  String(a.key ?? a.id ?? '').localeCompare(String(b.key ?? b.id ?? ''), 'en'));
const project = row => ({ key: row.key ?? null, japanese: row.japanese ?? null,
  reading: row.reading ?? null, indonesian: row.indonesian ?? null,
  meaning: row.meaning ?? null, sense: row.sense ?? null,
  character: row.character ?? null, pattern: row.pattern ?? null,
  sourceIds: row.sourceIds ?? [], introducedIn: row.earliestIntroduction ?? null });
const fingerprint = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const dialogueSourceFingerprint = sourceDialogue =>
  sourceDialogue == null ? null : fingerprint(sourceDialogue);

/** Prompt subset only. Callers must validate against the original full boundary. */
export function buildGroundedContext({ boundary, sourceDialogue = null, communicationGoal = '',
  scenario = '', maxPromptChars = 12000, maxSupportItems = 24,
  maxTargetVocabulary = 3 } = {}) {
  if (boundary?.status !== 'resolved' || !boundary.boundaryFingerprint) {
    throw new GroundedContextError('boundary_context_invalid');
  }
  if (!Number.isInteger(maxPromptChars) || maxPromptChars < 100 ||
      !Number.isInteger(maxSupportItems) || maxSupportItems < 0 ||
      !Number.isInteger(maxTargetVocabulary) || maxTargetVocabulary < 0) {
    throw new GroundedContextError('invalid_prompt_budget');
  }
  const mandatory = {
    boundaryFingerprint: boundary.boundaryFingerprint,
    course: boundary.course, module: boundary.currentModule, lesson: boundary.lesson,
    communicationGoal: String(communicationGoal || ''), scenario: String(scenario || ''),
    targetGrammar: sorted(boundary.target?.grammar).map(project),
    sourceDialogue,
  };
  const mandatoryText = JSON.stringify(mandatory);
  if (mandatoryText.length > maxPromptChars) {
    throw new GroundedContextError('mandatory_grounding_exceeds_budget');
  }
  const pools = {
    targetVocabulary: sorted(boundary.target?.vocabulary).map(project),
    supportVocabulary: sorted([...(boundary.previous?.vocabulary || []),
      ...(boundary.prerequisite?.vocabulary || [])]).map(project),
    allowedKanji: sorted(boundary.allowed?.kanji || [
      ...(boundary.target?.kanji || []), ...(boundary.previous?.kanji || []),
      ...(boundary.prerequisite?.kanji || []),
    ]).map(project),
    allowedGrammar: sorted(boundary.allowed?.grammar || [
      ...(boundary.target?.grammar || []), ...(boundary.previous?.grammar || []),
      ...(boundary.prerequisite?.grammar || []),
    ]).map(project),
    auxiliary: sorted((boundary.auxiliaryPolicy?.terms || []).map(term => ({
      ...term, key: term.surface, japanese: term.surface, sourceIds: [],
    }))).map(row => ({ surface: row.japanese, reading: row.reading,
      courseIds: row.courseIds, contentTypes: row.contentTypes, reason: row.reason })),
  };
  const subset = Object.fromEntries(Object.keys(pools).map(key => [key, []]));
  const omitted = Object.fromEntries(Object.keys(pools).map(key => [key, 0]));
  const budgeted = { ...mandatory, subset };
  for (const [key, entries] of Object.entries(pools)) {
    for (const entry of entries) {
      const cap = key === 'targetVocabulary' ? maxTargetVocabulary : maxSupportItems;
      if (subset[key].length >= cap) { omitted[key]++; continue; }
      subset[key].push(entry);
      if (JSON.stringify(budgeted).length > maxPromptChars) { subset[key].pop(); omitted[key]++; }
    }
  }
  const sourceFingerprint = dialogueSourceFingerprint(sourceDialogue);
  const makeContext = () => ({ ...budgeted,
    subsetIds: Object.fromEntries(Object.entries(subset).map(([key, entries]) =>
      [key, entries.flatMap(entry => entry.sourceIds || []).sort()])),
    omitted, sourceFingerprint });
  let context = makeContext();
  while (JSON.stringify(context).length > maxPromptChars) {
    const key = Object.keys(subset).reverse().find(name => subset[name].length);
    if (!key) throw new GroundedContextError('mandatory_grounding_exceeds_budget');
    subset[key].pop(); omitted[key]++;
    context = makeContext();
  }
  return { context, prompt: JSON.stringify(context), subsetIds: context.subsetIds, omitted,
    boundaryFingerprint: boundary.boundaryFingerprint,
    sourceFingerprint: context.sourceFingerprint };
}
