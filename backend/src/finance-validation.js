export function fail(status, message) { return Object.assign(new Error(message), { status }); }
export function amount(value) {
  if (!/^[1-9]\d{0,12}$/.test(String(value)) || Number(value) > 1e12) throw fail(400, 'finance_invalid_amount');
  return Number(value);
}
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw fail(400, 'finance_invalid_date');
  return value;
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw fail(400, 'finance_invalid_id');
  return value;
}
export function text(value, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08]/.test(value)) throw fail(400, 'finance_invalid_text');
  return value.trim();
}
export function range(query) {
  const from = date(query.from), to = date(query.to);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) throw fail(400, 'finance_invalid_period');
  return { from, to };
}
