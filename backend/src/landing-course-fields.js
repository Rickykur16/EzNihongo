export function landingCourseFields(body = {}, creating = false) {
  const { landingPricePublished, landingSchedule } = body;
  if (landingPricePublished !== undefined && typeof landingPricePublished !== 'boolean') {
    return { error: 'landingPricePublished must be a boolean' };
  }
  if (landingSchedule !== undefined && (typeof landingSchedule !== 'string' || landingSchedule.trim().length > 240)) {
    return { error: 'landingSchedule must be text, at most 240 characters' };
  }
  return {
    pricePublished: landingPricePublished ?? (creating ? false : null),
    schedule: landingSchedule === undefined ? (creating ? '' : null) : landingSchedule.trim(),
  };
}
