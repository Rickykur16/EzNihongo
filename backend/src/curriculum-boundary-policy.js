const MODES = new Set(['off', 'audit', 'warn', 'enforce']);
const OPERATIONS = new Set(['audit', 'generate', 'live_write', 'publish']);
const ALWAYS_BLOCK_CONTEXT = new Set([
  'boundary_context_mismatch', 'course_not_found', 'module_not_found', 'lesson_not_found',
  'grammar_not_found', 'vocabulary_lesson_owner_mismatch', 'grammar_lesson_owner_mismatch',
  'vocabulary_owner_unresolved', 'grammar_owner_unresolved',
]);

/** Decision only: report.valid remains the validator's judgment in every mode. */
export function decideBoundaryAction({ mode, operation, report, contentIsNewOrChanged = true }) {
  if (!MODES.has(mode) || !OPERATIONS.has(operation)) {
    return { decision: 'blocked', canProceed: false, statusCode: 422, code: 'boundary_policy_invalid' };
  }
  if (!report || !['evaluated', 'not_run', 'unavailable', 'context_invalid', 'schema_invalid', 'access_denied', 'version_conflict'].includes(report.status)) {
    return { decision: 'blocked', canProceed: false, statusCode: 422, code: 'boundary_report_invalid' };
  }
  if (report.status === 'evaluated' && typeof report.valid !== 'boolean') {
    return { decision: 'blocked', canProceed: false, statusCode: 422, code: 'boundary_report_invalid' };
  }
  if (report.status === 'schema_invalid') {
    return { decision: 'blocked', canProceed: false, statusCode: 422,
      code: report.violations?.[0]?.code || 'invalid_content_schema' };
  }
  if (report.status === 'access_denied') {
    return { decision: 'blocked', canProceed: false, statusCode: 403, code: 'access_denied' };
  }
  if (report.status === 'version_conflict') {
    return { decision: 'blocked', canProceed: false, statusCode: 409, code: 'version_conflict' };
  }
  if (report.status === 'context_invalid' &&
      (report.integrityIssues || []).some(item => ALWAYS_BLOCK_CONTEXT.has(item.code))) {
    return { decision: 'blocked', canProceed: false, statusCode: 422, code: 'boundary_context_invalid' };
  }
  if (mode === 'off' && report.status === 'not_run') {
    return { decision: 'allowed', canProceed: true, statusCode: 200, code: null };
  }
  if (report.status === 'unavailable' || report.status === 'context_invalid' || report.status === 'not_run') {
    if (mode === 'enforce' && operation !== 'audit' && (operation === 'generate' || contentIsNewOrChanged)) {
      return { decision: 'blocked', canProceed: false,
        statusCode: report.status === 'context_invalid' ? 422 : 503,
        code: report.status === 'context_invalid' ? 'boundary_context_invalid' : 'boundary_unavailable' };
    }
    return { decision: 'unavailable', canProceed: true, statusCode: 200, code: report.status };
  }
  const hasHard = report.valid === false || (report.violations || []).length > 0;
  const hasWarning = hasHard || (report.warnings || []).length > 0;
  if (mode === 'enforce' && hasHard && operation !== 'audit' && (operation === 'generate' || contentIsNewOrChanged)) {
    return { decision: 'blocked', canProceed: false, statusCode: 422, code: 'curriculum_boundary_violation' };
  }
  return { decision: hasWarning ? 'allowed_with_warning' : 'allowed', canProceed: true, statusCode: 200, code: null };
}
