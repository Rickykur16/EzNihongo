import { validateContentAgainstBoundary } from './curriculum-boundary-validator.js';

function fieldsFrom(path, value) {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => fieldsFrom(`${path}[${index}]`, entry));
  if (value && typeof value === 'object') return Object.entries(value)
    .flatMap(([key, entry]) => fieldsFrom(`${path}.${key}`, entry));
  return [];
}

export function bunpouValidationParts(sanitized) {
  const parts = [
    { contentType: 'dialogue_comprehension', fields: fieldsFrom('bunpouFlowPublished.directions', sanitized.directions) },
    { contentType: 'dialogue_transfer', fields: [
      ...fieldsFrom('bunpouFlowPublished.objective', sanitized.objective),
      ...fieldsFrom('bunpouFlowPublished.overlays', sanitized.overlays),
    ] },
  ];
  for (const [grammarId, checks] of Object.entries(sanitized.dialogChecks || {})) {
    for (const [key, contentType] of [['comprehension', 'dialogue_comprehension'],
      ['comparison', 'dialogue_transfer']]) {
      if (!checks[key]) continue;
      parts.push({ contentType, question: checks[key],
        fields: fieldsFrom(`bunpouFlowPublished.dialogChecks.${grammarId}.${key}`, checks[key]) });
    }
  }
  return parts.filter(part => part.fields.length);
}

export function validateBunpouPublish(envelope) {
  const parts = bunpouValidationParts(envelope.sanitized);
  // An empty published envelope still needs structural validation.
  if (!parts.length) parts.push({ contentType: 'dialogue_transfer', fields: [] });
  const reports = parts.map(part => ({ contentType: part.contentType,
    report: validateContentAgainstBoundary({ ...envelope, ...part }) }));
  const rank = { schema_invalid: 6, context_invalid: 5, access_denied: 4,
    unavailable: 3, version_conflict: 2, evaluated: 1, not_run: 0 };
  const status = reports.reduce((chosen, { report }) =>
    (rank[report.status] ?? -1) > (rank[chosen] ?? -1) ? report.status : chosen, 'not_run');
  const first = reports[0].report;
  const tagged = key => reports.flatMap(({ contentType, report }) =>
    (report[key] || []).map(entry => ({ ...entry, contentType })));
  const usage = Object.fromEntries(Object.keys(first.usage || {}).map(key => [key,
    reports.flatMap(({ contentType, report }) => (report.usage?.[key] || [])
      .map(entry => ({ ...entry, contentType })))]));
  return { ...first, status,
    valid: status === 'evaluated' ? reports.every(({ report }) => report.valid === true) :
      status === 'schema_invalid' ? false : null,
    violations: tagged('violations'), warnings: tagged('warnings'),
    exceptions: tagged('exceptions'), usage,
    validationParts: reports.map(({ contentType, report }) => ({ contentType,
      status: report.status, valid: report.valid })) };
}
