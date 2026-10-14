(function (root) {
  function render(forms, escape) {
    if (!forms) return '';
    return `<div class="deck-verb-forms">
      <div class="dv-form"><span class="dv-label">Bentuk biasa / kamus</span><span class="dv-word" lang="ja">${escape(forms.dictionary)}</span><span class="dv-reading" lang="ja">${escape(forms.dictionaryReading)}</span></div>
      <span class="dv-arrow" aria-hidden="true">→</span>
      <div class="dv-form"><span class="dv-label">Bentuk ます / sopan</span><span class="dv-word" lang="ja">${escape(forms.masu)}</span><span class="dv-reading" lang="ja">${escape(forms.masuReading)}</span></div>
    </div>`;
  }
  root.EzVocabularyVerbDisplay = Object.freeze({ render });
})(globalThis);
