export const LEARNING_MODES = ['self_learning', 'bootcamp'];

export function enrollmentOffer(course, mode = 'bootcamp') {
  if (!LEARNING_MODES.includes(mode)) return { error: 'invalid_learning_mode' };
  const self = mode === 'self_learning';
  // The legacy availability switch controls scheduled Bootcamp.
  if (!self && course.is_available === false) return { error: 'course_not_available' };
  if (self ? course.self_learning_enabled !== true : course.bootcamp_enabled === false) {
    return { error: 'learning_mode_unavailable' };
  }
  return {
    mode, label: self ? 'Self Learning' : 'Bootcamp',
    isFree: self ? false : course.is_free,
    priceIdr: self ? course.self_learning_price_idr : course.price_idr,
  };
}

export function enrollmentModeFields(body = {}) {
  for (const key of ['bootcampEnabled', 'selfLearningEnabled']) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') return { error: `${key} must be a boolean` };
  }
  if (body.selfLearningPriceIdr !== undefined && (!Number.isSafeInteger(body.selfLearningPriceIdr) || body.selfLearningPriceIdr <= 0 || body.selfLearningPriceIdr > 2147483647)) {
    return { error: 'selfLearningPriceIdr must be a positive integer' };
  }
  return { bootcamp: body.bootcampEnabled ?? null, self: body.selfLearningEnabled ?? null, price: body.selfLearningPriceIdr ?? null };
}
