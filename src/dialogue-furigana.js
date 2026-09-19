(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EzFurigana = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function groups(text) {
    return [...String(text).matchAll(/\p{Script=Han}[\p{Script=Han}々〆ヶ]*/gu)]
      .map(m => ({start:m.index, end:m.index+m[0].length, text:m[0]}));
  }
  function validateReadings(text, entries) {
    if (!Array.isArray(entries) || entries.length > 100) throw new Error('Bacaan furigana tidak valid.');
    const spans = groups(text);
    let end = -1;
    return entries.map(r => {
      if (!r || !Number.isInteger(r.start) || !Number.isInteger(r.end) || r.start < end ||
          !spans.some(s => s.start === r.start && s.end === r.end) ||
          typeof r.reading !== 'string' || !r.reading.trim() || r.reading.length > 64 ||
          !/^[\p{Script=Hiragana}\p{Script=Katakana}\u3099\u309aー・ ]+$/u.test(r.reading)) {
        throw new Error('Isi bacaan furigana dengan hiragana atau katakana.');
      }
      end = r.end;
      return {start:r.start, end:r.end, reading:r.reading.trim()};
    });
  }
  function normalize(value) {
    if (value == null) return null;
    if (value.schemaVersion !== 1 || !Array.isArray(value.lines) || value.lines.length > 100) {
      throw new Error('Data furigana tidak valid.');
    }
    let size = 0;
    const lines = value.lines.map(line => {
      if (!line || typeof line.speaker !== 'string' || line.speaker.length > 30 ||
          typeof line.text !== 'string' || line.text.length > 2000) throw new Error('Baris furigana tidak valid.');
      size += line.text.length;
      if (size > 10000) throw new Error('Data furigana terlalu panjang.');
      return {speaker:line.speaker, text:line.text, readings:validateReadings(line.text,line.readings)};
    });
    return {schemaVersion:1, lines};
  }
  function lineFor(data, index, turn) {
    const line = data?.lines?.[index];
    return line?.speaker === turn?.speaker && line?.text === turn?.text ? line : null;
  }
  function html(text, line) {
    if (!line || line.text !== text) return escape(text);
    let readings;
    try { readings = validateReadings(text, line.readings); } catch { return escape(text); }
    let offset = 0, result = '';
    for (const r of readings) {
      result += escape(text.slice(offset,r.start)) + '<ruby>' + escape(text.slice(r.start,r.end)) +
        '<rp>(</rp><rt>' + escape(r.reading) + '</rt><rp>)</rp></ruby>';
      offset = r.end;
    }
    return result + escape(text.slice(offset));
  }
  function preference() {
    try { return localStorage.getItem('ez_dialog_furigana') !== 'off'; } catch { return true; }
  }
  function label(on) { return 'Furigana: ' + (on ? 'aktif' : 'nonaktif'); }
  function toggle() {
    const first = document.querySelector('.gk-furigana-toggle');
    const on = first ? first.getAttribute('aria-pressed') !== 'true' : !preference();
    try { localStorage.setItem('ez_dialog_furigana', on ? 'on' : 'off'); } catch {}
    document.querySelectorAll('.grammar-karaoke').forEach(el => { el.dataset.furigana = on ? 'on' : 'off'; });
    document.querySelectorAll('.gk-furigana-toggle').forEach(btn => { btn.textContent = label(on); btn.setAttribute('aria-pressed',String(on)); });
  }
  return {groups, normalize, lineFor, html, preference, label, toggle, escape};
});
