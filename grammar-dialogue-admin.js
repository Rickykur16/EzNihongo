import { normalizeDraft, compileTurn, needsReading, tokenizeWithReadings, suggestReadings, INTENTS } from './src/grammar-dialogue-core.mjs';
import { escapeDialogue as esc } from './grammar-dialogue.js';

const apiPath = id => '/admin/grammar-dialogues/' + id;
const names = { neutral: 'Netral', curious: 'Penasaran', excited: 'Senang', sad: 'Sedih' };
const statusNames = { processing: 'Sedang dibuat', ready: 'Siap diperiksa', failed: 'Gagal' };
const field = (label, value, attrs, area = false) => '<label>' + label +
  (area ? '<textarea rows="2" ' + attrs + '>' + esc(value) + '</textarea>'
    : '<input value="' + esc(value) + '" ' + attrs + '>') + '</label>';

class DialogueEditor {
  constructor(id) {
    this.id = id; this.dirty = false; this.busy = false;
    this.urls = new Map(); this.controller = new AbortController();
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'gd-editor';
    this.dialog.setAttribute('aria-label', 'Editor bacaan dan audio dialog');
    this.dialog.innerHTML = '<p role="status">Memuat editor dialog...</p>';
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('click', event => this.click(event));
    this.dialog.addEventListener('input', event => this.input(event));
    this.dialog.addEventListener('dialogue-listened', () => {
      this.listened = true;
      const review = this.dialog.querySelector('[data-gde-review]');
      if (review) review.disabled = false;
      this.updateActions();
    });
    document.body.append(this.dialog);
    this.dialog.showModal();
  }
  async open() {
    try { await this.refresh(); this.render(); }
    catch (error) {
      this.dialog.innerHTML = '<p role="alert">' + esc(error.message) + '</p><button class="gd-button" data-gde-action="close">Tutup</button>';
    }
  }
  async refresh() {
    const data = await api(apiPath(this.id));
    this.state = data;
    this.draft = normalizeDraft(data.draft);
    this.revision = data.revision;
    this.dirty = false;
  }
  close() {
    if (this.dirty && !confirm('Ada perubahan draft yang belum disimpan. Tutup editor?')) return;
    this.dialog.querySelector('grammar-dialogue')?.stop();
    this.controller.abort();
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.dialog.close(); this.dialog.remove();
  }
  message(text, error = false) {
    const element = this.dialog.querySelector('[data-gde-status]');
    if (element) { element.textContent = text; element.classList.toggle('gd-error', error); }
  }
  markDirty() {
    this.dirty = true; this.listened = false;
    const review = this.dialog.querySelector('[data-gde-review]');
    if (review) { review.checked = false; review.disabled = true; }
    this.updateActions();
  }
  updateActions() {
    const review = this.dialog.querySelector('[data-gde-review]');
    const publish = this.dialog.querySelector('[data-gde-action="publish"]');
    if (publish) publish.disabled = this.busy || this.dirty || !this.listened || !review?.checked ||
      this.selected?.draft_revision !== this.revision;
    this.dialog.querySelectorAll('[data-gde-lock]').forEach(button => { button.disabled = this.busy; });
    const dirty = this.dialog.querySelector('[data-gde-dirty]');
    if (dirty) dirty.textContent = this.dirty ? 'Belum disimpan' : 'Draft revisi ' + this.revision;
  }
  render() {
    this.dialog.querySelector('grammar-dialogue')?.stop();
    this.preview = null; this.selected = null; this.listened = false;
    const draft = this.draft;
    this.dialog.innerHTML = '<div class="gd-editor-header"><div><small>GRAMMAR / AUDIO</small><h2>Editor contoh dialog</h2>' +
      '<p>Periksa bacaan, dengarkan percakapan, lalu publikasikan.</p></div><button class="gd-button" data-gde-action="close">Tutup</button></div>' +
      '<div class="gd-editor-layout"><section class="gd-editor-script">' +
      field('Pola yang dipelajari', draft.pattern, 'data-gde-root="pattern" maxlength="200"') +
      field('Situasi singkat (Bahasa Indonesia)', draft.scene, 'data-gde-root="scene" maxlength="1000"', true) +
      '<details class="gd-panel"><summary>Tokoh, bacaan nama, dan suara</summary><div class="gd-speaker-grid">' +
      draft.speakers.map((speaker, i) => '<div><strong>' + esc(speaker.id === 'N' ? 'Narator' : 'Pembicara ' + speaker.id) + '</strong>' +
        field('Nama tampilan', speaker.name, 'data-gde-speaker="' + i + '" data-gde-field="name" maxlength="80"') +
        field('Bacaan nama (kana)', speaker.reading, 'data-gde-speaker="' + i + '" data-gde-field="reading" maxlength="100" lang="ja"') +
        '<details><summary>Voice ID</summary>' + field('ElevenLabs Voice ID', speaker.voiceId,
          'data-gde-speaker="' + i + '" data-gde-field="voiceId" maxlength="64"') + '</details></div>').join('') +
      '</div></details><details class="gd-panel"><summary>Kamus bacaan dialog</summary>' +
      '<p>Koreksi pada ucapan didahulukan. Bacaan nama berlaku untuk semua pembicara.</p><div class="gd-dictionary">' +
      draft.dictionary.map((entry, i) => '<div>' + field('Kata / nama', entry.text, 'data-gde-dictionary="' + i + '" data-gde-field="text" lang="ja"') +
        field('Bacaan kana', entry.reading, 'data-gde-dictionary="' + i + '" data-gde-field="reading" lang="ja"') +
        '<button class="gd-button" data-gde-action="remove-word" data-index="' + i + '">Hapus</button></div>').join('') +
      '</div><button class="gd-button" data-gde-action="add-word">Tambah kata</button></details>' +
      '<div class="gd-controls"><button class="gd-button" data-gde-lock data-gde-action="suggest">Sarankan dari kosakata</button>' +
      '<button class="gd-button" data-gde-action="apply-dictionary">Terapkan kamus</button></div>' +
      '<p class="gd-hint">Saran tidak langsung disetujui. Periksa nama, kata ambigu, angka, dan akhiran kata kerja.</p>' +
      draft.turns.map((turn, i) => this.turnHtml(turn, i)).join('') +
      '<button class="gd-button" data-gde-action="add-turn">Tambah ucapan</button></section>' +
      '<aside class="gd-editor-preview"><h3>Preview &amp; publikasi</h3>' +
      '<label>Metode audio<select data-gde-engine><option value="dialogue-v3">Dialog utuh (v3)</option><option value="turns-v2">Per ucapan (v2, pembanding)</option></select></label>' +
      '<p class="gd-hint">Preview memakai kredit ElevenLabs dan membuat ulang seluruh dialog. Versi lama tetap tersimpan.</p>' +
      '<button class="gd-button gd-primary" data-gde-lock data-gde-action="generate">Buat preview baru</button>' +
      '<p data-gde-estimate></p><grammar-dialogue data-admin></grammar-dialogue>' +
      '<label class="gd-check"><input type="checkbox" data-gde-review disabled> Saya sudah mendengarkan seluruh dialog dan menyetujui bacaan serta ekspresinya.</label>' +
      '<button class="gd-button gd-primary" data-gde-action="publish" disabled>Publikasikan versi ini</button>' +
      '<h3>Versi audio</h3><button class="gd-button" data-gde-lock data-gde-action="refresh">Muat ulang daftar</button>' +
      '<div data-gde-versions>' + this.versionsHtml() + '</div>' +
      '<h3>Laporan siswa</h3>' + this.reportsHtml() +
      '</aside></div><footer class="gd-editor-footer"><span data-gde-dirty></span><p data-gde-status role="status"></p>' +
      '<button class="gd-button gd-primary" data-gde-lock data-gde-action="save">Simpan draft</button></footer>';
    this.updateEstimates(); this.updateActions();
  }
  turnHtml(turn, index) {
    return '<section class="gd-edit-turn" data-gde-turn-card="' + index + '"><div class="gd-turn-heading"><h3>Ucapan ' + (index + 1) + '</h3>' +
      '<div class="gd-controls"><button class="gd-button" data-gde-action="up" data-index="' + index + '"' + (index === 0 ? ' disabled' : '') + '>Naik</button>' +
      '<button class="gd-button" data-gde-action="remove-turn" data-index="' + index + '">Hapus</button></div></div>' +
      '<div class="gd-two-fields"><label>Pembicara<select data-gde-turn="' + index + '" data-gde-field="speaker">' +
      this.draft.speakers.map(s => '<option value="' + s.id + '"' + (s.id === turn.speaker ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') +
      '</select></label><label>Maksud ucapan<select data-gde-turn="' + index + '" data-gde-field="intent">' +
      INTENTS.map(intent => '<option value="' + intent + '"' + (intent === turn.intent ? ' selected' : '') + '>' + names[intent] + '</option>').join('') +
      '</select></label></div>' +
      field('Teks Jepang asli', turn.japanese, 'data-gde-turn="' + index + '" data-gde-field="japanese" lang="ja" maxlength="600"', true) +
      field('Terjemahan Indonesia', turn.translation, 'data-gde-turn="' + index + '" data-gde-field="translation" maxlength="1000"', true) +
      '<div class="gd-token-grid">' + turn.tokens.map((token, j) => '<div class="gd-token' + (needsReading(token.text) && !token.reading ? ' gd-needs-reading' : '') + '">' +
        '<span lang="ja">' + esc(token.text) + '</span>' +
        (needsReading(token.text) || token.reading ? '<input aria-label="Bacaan ' + esc(token.text) + '" value="' + esc(token.reading) +
          '" data-gde-turn="' + index + '" data-gde-token="' + j + '" data-gde-field="reading" lang="ja" placeholder="Isi kana">' : '') +
        '<label class="gd-check"><input type="checkbox" data-gde-turn="' + index + '" data-gde-token="' + j + '" data-gde-field="highlight"' +
        (token.highlight ? ' checked' : '') + '> Tandai pola</label></div>').join('') + '</div>' +
      '<p class="gd-hint">Teks yang dikirim ke TTS:</p><output class="gd-spoken" data-gde-spoken="' + index + '" lang="ja"></output>' +
      '<label class="gd-check"><input type="checkbox" data-gde-turn="' + index + '" data-gde-field="reviewed"' + (turn.reviewed ? ' checked' : '') +
      '> Bacaan dan terjemahan ucapan ini sudah saya periksa.</label></section>';
  }
  versionsHtml() {
    if (!this.state.versions.length) return '<p>Belum ada preview audio.</p>';
    return this.state.versions.map(version => '<article class="gd-version"><strong>' +
      (version.id === this.state.publishedVersion ? 'Aktif untuk siswa' : version.reviewed_at ? 'Pernah disetujui' : statusNames[version.status]) +
      '</strong><p>Revisi ' + version.draft_revision + ' / ' + esc(version.model) + '<br>' +
      esc(new Date(version.created_at).toLocaleString('id-ID')) + '</p>' +
      (version.error ? '<p class="gd-error">' + esc(version.error) + '</p>' : '') +
      (version.status === 'ready' ? '<button class="gd-button" data-gde-lock data-gde-action="preview" data-version="' + version.id + '">Dengarkan</button>' : '') +
      (version.reviewed_at && version.id !== this.state.publishedVersion ? '<button class="gd-button" data-gde-lock data-gde-action="restore" data-version="' + version.id + '">Aktifkan kembali</button>' : '') +
      '</article>').join('');
  }
  reportsHtml() {
    if (!this.state.reports.length) return '<p>Tidak ada laporan terbuka.</p>';
    return this.state.reports.map(report => '<article class="gd-version"><strong>' + esc(report.reason) + '</strong>' +
      '<p>Ucapan ' + esc(report.turn_id) + ' / versi ' + esc(report.version_id.slice(0, 8)) + '</p><p>' + esc(report.note) + '</p>' +
      '<button class="gd-button" data-gde-action="resolve" data-report="' + report.id + '">Tandai selesai</button></article>').join('');
  }
  updateEstimates() {
    let length = 0;
    this.draft.turns.forEach((turn, i) => {
      const output = this.dialog.querySelector('[data-gde-spoken="' + i + '"]');
      try {
        const spoken = compileTurn(turn);
        length += spoken.length;
        if (output) { output.textContent = spoken; output.classList.remove('gd-error'); }
      } catch (error) {
        if (output) { output.textContent = error.message; output.classList.add('gd-error'); }
      }
    });
    const estimate = this.dialog.querySelector('[data-gde-estimate]');
    if (estimate) estimate.textContent = length + ' karakter bacaan siap, belum termasuk arahan ekspresi. Batas input: 2.000 karakter.';
  }
  input(event) {
    const input = event.target;
    if (input.matches('[data-gde-review]')) { this.updateActions(); return; }
    if (this.busy) return;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    const data = input.dataset;
    if (data.gdeRoot) this.draft[data.gdeRoot] = value;
    else if (data.gdeSpeaker !== undefined) {
      this.draft.speakers[Number(data.gdeSpeaker)][data.gdeField] = value;
      this.draft.turns.forEach(turn => { turn.reviewed = false; });
      this.dialog.querySelectorAll('[data-gde-field="reviewed"]').forEach(el => { el.checked = false; });
    } else if (data.gdeDictionary !== undefined) {
      this.draft.dictionary[Number(data.gdeDictionary)][data.gdeField] = value;
    } else if (data.gdeTurn !== undefined) {
      const turn = this.draft.turns[Number(data.gdeTurn)];
      if (data.gdeToken !== undefined) {
        turn.tokens[Number(data.gdeToken)][data.gdeField] = value;
        turn.tokens[Number(data.gdeToken)].source = 'manual';
      }
      else turn[data.gdeField] = value;
      if (data.gdeField === 'japanese') {
        turn.tokens = tokenizeWithReadings(value, this.draft.dictionary);
        const temporary = document.createElement('div');
        temporary.innerHTML = this.turnHtml(turn, Number(data.gdeTurn));
        this.dialog.querySelector('[data-gde-turn-card="' + data.gdeTurn + '"] .gd-token-grid')
          .replaceWith(temporary.querySelector('.gd-token-grid'));
      }
      if (data.gdeField !== 'reviewed') {
        turn.reviewed = false;
        this.dialog.querySelector('[data-gde-turn="' + data.gdeTurn + '"][data-gde-field="reviewed"]').checked = false;
      }
    } else return;
    this.markDirty(); this.updateEstimates();
  }
  async save() {
    if (!this.dirty && this.revision > 0) return;
    const result = await api(apiPath(this.id) + '/draft', {
      method: 'PUT', body: JSON.stringify({ draft: this.draft, revision: this.revision }),
    });
    this.revision = result.revision; this.dirty = false;
    this.message('Draft disimpan. Versi siswa belum berubah.');
  }
  async previewVersion(id) {
    this.dialog.querySelector('grammar-dialogue')?.stop();
    this.preview = await api(apiPath(this.id) + '/versions/' + id);
    this.selected = this.state.versions.find(version => version.id === id);
    this.listened = false;
    const review = this.dialog.querySelector('[data-gde-review]');
    review.checked = false; review.disabled = true;
    this.dialog.querySelector('grammar-dialogue').setData(this.preview, async url => {
      if (this.urls.has(url)) return this.urls.get(url);
      const response = await ezApi(url.replace(/^\/api/, ''), { signal: this.controller.signal });
      if (!response.ok) throw new Error('Preview audio tidak dapat dimuat.');
      const objectUrl = URL.createObjectURL(await response.blob());
      this.urls.set(url, objectUrl);
      return objectUrl;
    });
    this.message('Dengarkan seluruh dialog untuk membuka persetujuan publikasi.');
  }
  async click(event) {
    const button = event.target.closest('[data-gde-action]');
    if (!button) return;
    const action = button.dataset.gdeAction;
    if (action === 'close') return this.close();
    if (this.busy) return;
    const index = Number(button.dataset.index);
    if (['add-turn', 'remove-turn', 'up', 'add-word', 'remove-word', 'apply-dictionary'].includes(action)) {
      if (action === 'add-turn') this.draft.turns.push({
        id: crypto.randomUUID(), speaker: 'A', japanese: '', translation: '', intent: 'neutral', tokens: [], reviewed: false,
      });
      if (action === 'remove-turn') {
        if (this.draft.turns[index].japanese && !confirm('Hapus ucapan ini dari draft?')) return;
        this.draft.turns.splice(index, 1);
      }
      if (action === 'up' && index > 0) [this.draft.turns[index - 1], this.draft.turns[index]] = [this.draft.turns[index], this.draft.turns[index - 1]];
      if (action === 'add-word') this.draft.dictionary.push({ text: '', reading: '' });
      if (action === 'remove-word') this.draft.dictionary.splice(index, 1);
      if (action === 'apply-dictionary') {
        this.draft.turns.forEach(turn => { turn.reviewed = false; });
        this.draft = suggestReadings(this.draft);
      }
      this.markDirty(); this.render(); return;
    }
    this.busy = true; this.updateActions();
    // Prevent edits while an asynchronous save/generation is using this revision.
    const editable = [...this.dialog.querySelectorAll('input,textarea,select')];
    const disabledBefore = editable.map(input => input.disabled);
    editable.forEach(input => { input.disabled = true; });
    try {
      if (action === 'save') await this.save();
      if (action === 'suggest') {
        const result = await api(apiPath(this.id) + '/suggest', { method: 'POST', body: JSON.stringify({ draft: this.draft }) });
        this.draft = result.draft; this.markDirty(); this.render();
        this.message('Saran dimasukkan. Bacaan yang ambigu tetap perlu diisi dan diperiksa.');
      }
      if (action === 'generate') {
        const engine = this.dialog.querySelector('[data-gde-engine]').value;
        await this.save();
        this.message('Membuat preview seluruh dialog. Ini dapat memerlukan waktu...');
        const result = await api(apiPath(this.id) + '/generate', {
          method: 'POST', body: JSON.stringify({ revision: this.revision, engine, takeId: crypto.randomUUID() }),
        });
        this.state.versions.unshift(result.version);
        this.dialog.querySelector('[data-gde-versions]').innerHTML = this.versionsHtml();
        await this.previewVersion(result.version.id);
      }
      if (action === 'preview') await this.previewVersion(button.dataset.version);
      if (action === 'publish') {
        await api(apiPath(this.id) + '/publish', { method: 'POST',
          body: JSON.stringify({ versionId: this.selected.id, revision: this.revision, reviewedAudio: true }) });
        await this.refresh(); this.render(); this.message('Versi yang diperiksa sekarang aktif untuk siswa.');
      }
      if (action === 'restore') {
        if (!confirm('Aktifkan kembali versi yang pernah disetujui ini? Draft terbaru tetap tersimpan.')) return;
        await this.save();
        await api(apiPath(this.id) + '/restore', { method: 'POST', body: JSON.stringify({ versionId: button.dataset.version }) });
        await this.refresh(); this.render(); this.message('Versi sebelumnya aktif kembali.');
      }
      if (action === 'refresh') {
        if (this.dirty) throw new Error('Simpan draft sebelum memuat ulang daftar versi.');
        await this.refresh(); this.render();
      }
      if (action === 'resolve') {
        await api(apiPath(this.id) + '/reports/' + button.dataset.report + '/resolve', { method: 'POST' });
        this.state.reports = this.state.reports.filter(report => report.id !== button.dataset.report);
        button.closest('article').remove();
      }
    } catch (error) { this.message(error.message, true); }
    finally {
      this.busy = false;
      editable.forEach((input, i) => { if (input.isConnected) input.disabled = disabledBefore[i]; });
      // The review checkbox depends on the selected version, never on a previous render.
      const review = this.dialog.querySelector('[data-gde-review]');
      if (review) review.disabled = !this.listened;
      this.updateActions();
    }
  }
}
window.GrammarDialogueAdmin = {
  open(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    const editor = new DialogueEditor(id);
    editor.open();
  },
};
