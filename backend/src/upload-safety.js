import multer from 'multer';

// All current upload forms use one file and flat, short text fields.
// Keep binary limits per route; bound the rest of the multipart body too.
export function uploadLimits(fileSize, fields = 0) {
  return {
    fileSize,
    files: 1,
    fields,
    parts: fields + 2,
    fieldNameSize: 64,
    fieldSize: 1024,
    fieldNestingDepth: 0,
    fieldArrayIndexLimit: 0,
  };
}

const MALFORMED_MULTIPART = new Set([
  'Multipart: Boundary not found',
  'Malformed part header',
  'Unexpected end of form',
  'Unexpected end of file',
]);

// Parser/limit failures are bad requests. Storage and other unexpected
// failures still reach the API's server-error handler.
export function uploadErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message, code: err.code });
  }
  if (MALFORMED_MULTIPART.has(err?.message)) {
    return res.status(400).json({ error: 'Invalid multipart upload', code: 'INVALID_MULTIPART' });
  }
  next(err);
}
