// Render editorial memory aids into the existing rich-text mnemonic field.
// Sources remain catalog metadata; only the learner-facing fields render here.
const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => value.replace(/[&<>"']/g, character => htmlEntities[character]);
const text = value => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new TypeError('Kanji memory fields must be text or null');
  return value.trim();
};

export function renderKanjiMemory(row) {
  const components = text(row.components);
  const componentNote = text(row.componentNote);
  const shapeHint = text(row.shapeHint);
  const mnemonic = text(row.mnemonic);
  if (!components && !shapeHint) {
    throw new Error('Kanji memory needs components or a shape hint');
  }
  const paragraphs = [];
  if (components) paragraphs.push(`<p><strong>Penyusun:</strong> ${escapeHtml(components)}</p>`);
  if (componentNote) paragraphs.push(`<p>${escapeHtml(componentNote)}</p>`);
  if (shapeHint) paragraphs.push(`<p><strong>Petunjuk bentuk:</strong> ${escapeHtml(shapeHint)}</p>`);
  if (mnemonic) paragraphs.push(`<p><strong>Cara ingat:</strong> ${escapeHtml(mnemonic)}</p>`);
  return paragraphs.join('');
}
