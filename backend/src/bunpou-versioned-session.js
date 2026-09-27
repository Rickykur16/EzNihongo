import { questionFingerprint as drillFingerprint, dialogCheckFamilyId,
  sessionRevisionId } from './bunpou-flow-service.js';
import { questionFingerprint as normalizedFingerprint } from './dialogue-question-service.js';
import { loadCompanionContext } from './bunpou-flow-content.js';

export function chooseSessionFlowVersion({ existing, placement, runtimeAvailable }) {
  if (existing) return 1;
  return runtimeAvailable && placement?.mode === 'inline' && placement.flowVersion === 2 ? 2 : 1;
}

// Diagnostic only: a published companion or normalized row can disappear
// after a v2 session was issued. Even a failing SQL read must not poison the
// transaction that resumes its immutable snapshot.
export async function currentSessionRevisionBestEffort(client, sourceLessonId, flowVersion,
  { loadContext = loadCompanionContext, loadTransfers = loadCurrentTransferRows } = {}) {
  await client.query('SAVEPOINT bunpou_current_revision');
  try {
    const context = await loadContext(sourceLessonId, client.query.bind(client));
    let revision = null;
    if (context?.current) {
      if (flowVersion === 1) {
        revision = sessionRevisionId(context.fingerprint, context.v1Published ?? context.published);
      } else if (flowVersion === 2) {
        const transfers = await loadTransfers(client, sourceLessonId,
          context.items.map(item => item.id));
        revision = versionedSessionRevision(context.fingerprint, context.published, 2, transfers);
      } else {
        throw new Error('invalid_flow_version');
      }
    }
    await client.query('RELEASE SAVEPOINT bunpou_current_revision');
    return revision;
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT bunpou_current_revision');
    await client.query('RELEASE SAVEPOINT bunpou_current_revision');
    return null;
  }
}

export async function loadCurrentTransferRows(client, sourceLessonId, grammarIds) {
  const rows = (await client.query(`SELECT * FROM grammar_dialog_questions
    WHERE grammar_id=ANY($1::uuid[]) AND kind='transfer' AND state='active'
    ORDER BY grammar_id,sort_order,id FOR SHARE`, [grammarIds])).rows;
  const byGrammar = new Map();
  for (const row of rows) {
    if (row.source_lesson_id !== sourceLessonId ||
        row.question_fingerprint !== normalizedFingerprint({ kind: row.kind,
          prompt: row.prompt, options: row.options, correctIndex: row.correct_index,
          explanation: row.explanation, evidence: row.evidence })) {
      throw new Error('normalized_transfer_not_current');
    }
    if (byGrammar.has(row.grammar_id)) throw new Error('normalized_transfer_ambiguous');
    byGrammar.set(row.grammar_id, row);
  }
  if (byGrammar.size !== new Set(grammarIds).size ||
      grammarIds.some(id => !byGrammar.has(id))) throw new Error('normalized_transfer_missing');
  return grammarIds.map(id => byGrammar.get(id));
}

export function planV2SessionItems(items, drillsByGrammar, transferRows) {
  const transfers = new Map(transferRows.map(row => [row.grammar_id, row]));
  const out = [];
  for (const item of items) {
    const drills = drillsByGrammar.get(item.id) || {};
    if (drills.step1) out.push({ grammarId: item.id, step: 1, drill: drills.step1 });
    if (drills.step2) out.push({ grammarId: item.id, step: 2, drill: drills.step2 });
  }
  for (const item of items) {
    const row = transfers.get(item.id);
    if (!row) throw new Error('normalized_transfer_missing');
    const provenance = { id: row.id, version: row.question_version,
      questionFingerprint: row.question_fingerprint,
      dialogueFingerprint: row.dialogue_fingerprint,
      boundaryFingerprint: row.boundary_fingerprint,
      sourceLessonId: row.source_lesson_id, kind: row.kind,
      sortOrder: row.sort_order, sourceKind: row.source_kind,
      sourceKey: row.source_key, sourceFingerprint: row.source_fingerprint,
      validatorVersion: row.validator_version };
    out.push({ grammarId: item.id, step: 5, drill: {
      variant: 'choice', step: 5, prompt: row.prompt, options: row.options,
      correctIndex: row.correct_index, checkKind: 'transfer',
      checkFamilyId: dialogCheckFamilyId({ options: row.options,
        correctIndex: row.correct_index }), explanation: row.explanation,
      normalizedQuestion: provenance,
    } });
  }
  return out;
}

export function versionedSessionRevision(fingerprint, published, flowVersion, transferRows = []) {
  return sessionRevisionId(fingerprint, published, flowVersion, transferRows);
}

export function versionedItemFingerprint(grammarId, step, drill, flowVersion) {
  if (flowVersion !== 1 && flowVersion !== 2) throw new Error('invalid_flow_version');
  // This is a semantic exposure-ledger key, not a source-provenance key.
  // A normalized transfer may be copied verbatim from a legacy comparison:
  // its earlier hint/reveal/pass must remain discoverable across versions.
  // The source identity and review fingerprints are pinned separately in the
  // v2 session revision and its private snapshot.
  return drillFingerprint(grammarId, step, drill);
}
