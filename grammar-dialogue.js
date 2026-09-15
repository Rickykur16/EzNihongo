import { legacyDraft, toHiragana } from './src/grammar-dialogue-core.js';

export const escapeDialogue = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function dialogueTokensHtml(tokens) {
  return tokens.map(token => {
    const word = token.reading && /[\p{Script=Han}々〆]/u.test(token.text)
      ? '<ruby>' + escapeDialogue(token.text) + '<rt>' + escapeDialogue(toHiragana(token.reading)) + '</rt></ruby>'
      : escapeDialogue(token.text);
    return token.highlight ? '<mark class="gd-grammar">' + word + '</mark>' : word;
  }).join('');
}
const players = new Set();
window.GrammarDialogue = {
  stopAll(except) { for (const player of players) if (player !== except) player.stop(); },
};
window.addEventListener('pagehide', () => window.GrammarDialogue.stopAll());
const preference = (name, fallback) => { try { return localStorage.getItem(name) || fallback; } catch { return fallback; } };
const remember = (name, value) => { try { localStorage.setItem(name, value); } catch {} };

class GrammarDialogue extends HTMLElement {
  constructor() {
    super();
    this.session = 0;
    this.rate = [0.75, 0.9, 1].includes(Number(preference('ez_dialog_reviewed_speed', '1')))
      ? Number(preference('ez_dialog_reviewed_speed', '1')) : 1;
    this.addEventListener('click', event => this.onClick(event));
    this.addEventListener('change', event => {
      if (event.target.matches('[data-gd-speed]')) {
        this.rate = Number(event.target.value);
        remember('ez_dialog_reviewed_speed', String(this.rate));
        if (this.audio) this.audio.playbackRate = this.rate;
      }
    });
    this.addEventListener('submit', event => {
      if (event.target.matches('[data-gd-report]')) { event.preventDefault(); this.sendReport(event.target); }
    });
  }
  connectedCallback() {
    players.add(this);
    if (this.hasAttribute('data-admin')) return;
    this.controller = new AbortController();
    this.setData({
      draft: legacyDraft({ example_dialog: this.dataset.legacy || '', example_dialog_id: this.dataset.translation || '',
        pattern: this.dataset.pattern || '' }),
      audio: null, versionId: null,
    });
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { this.observer.disconnect(); this.load(); }
      });
      this.observer.observe(this);
    } else this.load();
  }
  disconnectedCallback() {
    this.stop(); this.controller?.abort(); this.observer?.disconnect(); players.delete(this);
  }
  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const response = await fetch('/api/grammar-dialogues/' + encodeURIComponent(this.dataset.grammarId),
        { cache: 'no-store', signal: this.controller.signal });
      if (!response.ok) throw new Error('Audio belum dapat dimuat. Teks dialog tetap tersedia.');
      const data = await response.json();
      if (!this.isConnected) return;
      this.setData(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        this.status(error.message);
        const status = this.querySelector('.gd-status');
        if (status) status.insertAdjacentHTML('beforeend', ' <button type="button" class="gd-link" data-gd-action="retry">Coba lagi</button>');
      }
    } finally { this.loading = false; }
  }
  setData(data, resolver) {
    this.stop();
    this.data = data;
    this.resolver = resolver;
    this.render();
  }
  render() {
    if (!this.data?.draft) return;
    const { draft, audio } = this.data;
    this.dataset.furigana = preference('ez_dialog_furigana', 'on');
    this.innerHTML = '<div class="gd-player">' +
      (draft.scene ? '<p class="gd-scene">' + escapeDialogue(draft.scene) + '</p>' : '') +
      '<div class="gd-controls">' +
      '<button type="button" class="gd-button gd-primary" data-gd-action="play"' + (audio ? '' : ' disabled') + '>Putar dialog</button>' +
      '<label>Kecepatan <select data-gd-speed aria-label="Kecepatan audio">' +
      [0.75, 0.9, 1].map(rate => '<option value="' + rate + '"' + (this.rate === rate ? ' selected' : '') + '>' + rate + 'x</option>').join('') +
      '</select></label><button type="button" class="gd-button" data-gd-action="furigana" aria-pressed="' + (this.dataset.furigana === 'on') + '">Furigana</button>' +
      '<button type="button" class="gd-button" data-gd-action="translations" aria-pressed="false">Terjemahan</button></div>' +
      '<p class="gd-status" role="status">' + (audio ? 'Siap diputar.' : 'Audio belum tersedia untuk dialog ini.') + '</p>' +
      '<div class="gd-transcript">' + draft.turns.map((turn, index) => {
        const speaker = draft.speakers.find(s => s.id === turn.speaker);
        return '<article class="gd-turn gd-speaker-' + escapeDialogue(turn.speaker) + '" data-gd-turn="' + index + '">' +
          '<div class="gd-turn-heading"><strong>' + escapeDialogue(speaker?.name || turn.speaker) + '</strong>' +
          '<button type="button" class="gd-button gd-replay" data-gd-action="replay" data-index="' + index + '"' +
          (audio ? '' : ' disabled') + ' aria-label="Dengarkan ulang ucapan ' + (index + 1) + '">Dengarkan ulang</button></div>' +
          '<div class="gd-japanese" lang="ja">' + dialogueTokensHtml(turn.tokens) + '</div>' +
          (turn.translation ? '<details class="gd-translation"><summary>Lihat arti</summary><p>' + escapeDialogue(turn.translation) + '</p></details>' : '') +
          (audio && !this.hasAttribute('data-admin') ? '<button type="button" class="gd-link" data-gd-action="report" data-index="' + index + '">Laporkan audio ucapan ini</button>' : '') +
          '</article>';
      }).join('') + '</div>' +
      (draft.pattern ? '<p class="gd-pattern">Pola yang dipelajari: <strong>' + escapeDialogue(draft.pattern) + '</strong></p>' : '') +
      '</div>';
  }
  status(message) {
    const element = this.querySelector('.gd-status');
    if (element) element.textContent = message;
  }
  stop(resetPass = true) {
    this.session++;
    cancelAnimationFrame(this.frame);
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = null; }
    if (resetPass) this.fullPass = false;
    this.active = -1;
    this.querySelectorAll('.gd-is-active').forEach(el => { el.classList.remove('gd-is-active'); el.removeAttribute('aria-current'); });
    const play = this.querySelector('[data-gd-action="play"]');
    if (play) play.textContent = 'Putar dialog';
  }
  async play(index = 0, single = false, continuing = false) {
    if (!this.data?.audio) return;
    window.GrammarDialogue.stopAll(this);
    this.stop(!continuing);
    if (!continuing) this.fullPass = index === 0 && !single;
    const session = this.session;
    const segment = this.data.audio.turns[index];
    if (!segment) return;
    this.status('Memuat audio...');
    try {
      const source = this.resolver ? await this.resolver(segment.audioUrl) : segment.audioUrl;
      if (session !== this.session || !this.isConnected) return;
      const audio = new Audio(source);
      this.audio = audio;
      audio.preload = 'metadata';
      audio.playbackRate = this.rate;
      audio.preservesPitch = true;
      const continuous = this.data.audio.mode === 'continuous';
      audio.addEventListener('loadedmetadata', () => {
        if (this.audio === audio) audio.currentTime = continuous ? segment.start : 0;
      }, { once: true });
      audio.addEventListener('error', () => {
        if (this.audio === audio) { this.stop(); this.status('Audio gagal diputar. Tekan Putar dialog untuk mencoba lagi.'); }
      }, { once: true });
      audio.addEventListener('ended', () => {
        if (this.audio !== audio) return;
        if (!single && !continuous && index < this.data.audio.turns.length - 1) {
          this.play(index + 1, false, true);
        } else {
          const completed = this.fullPass && !single;
          this.stop();
          this.status('Selesai. Kamu bisa mengulang ucapan tertentu.');
          if (completed) this.dispatchEvent(new CustomEvent('dialogue-listened', { bubbles: true }));
        }
      }, { once: true });
      await audio.play();
      if (session !== this.session) return;
      this.status('Audio sedang diputar.');
      this.querySelector('[data-gd-action="play"]').textContent = 'Jeda';
      const tick = () => {
        if (this.audio !== audio || audio.paused) return;
        const current = continuous
          ? this.data.audio.turns.findIndex(t => audio.currentTime >= t.start && audio.currentTime < t.end)
          : index;
        if (current !== this.active) {
          this.active = current;
          this.querySelectorAll('[data-gd-turn]').forEach((element, i) => {
            element.classList.toggle('gd-is-active', i === current);
            if (i === current) element.setAttribute('aria-current', 'true'); else element.removeAttribute('aria-current');
          });
        }
        if (single && continuous && audio.currentTime >= segment.end) {
          this.stop(); this.status('Ucapan selesai.'); return;
        }
        this.frame = requestAnimationFrame(tick);
      };
      this.tick = tick;
      this.frame = requestAnimationFrame(tick);
    } catch (error) {
      if (session === this.session) { this.stop(); this.status(error.message || 'Audio gagal diputar. Coba lagi.'); }
    }
  }
  async onClick(event) {
    const button = event.target.closest('[data-gd-action]');
    if (!button || !this.contains(button)) return;
    const action = button.dataset.gdAction;
    if (action === 'retry') return this.load();
    if (action === 'replay') return this.play(Number(button.dataset.index), true);
    if (action === 'play') {
      if (!this.audio) return this.play();
      if (!this.audio.paused) { this.audio.pause(); cancelAnimationFrame(this.frame); button.textContent = 'Lanjutkan'; this.status('Audio dijeda.'); }
      else {
        try { await this.audio.play(); button.textContent = 'Jeda'; this.status('Audio sedang diputar.'); this.frame = requestAnimationFrame(this.tick); }
        catch { this.status('Tekan Lanjutkan untuk mencoba lagi.'); }
      }
    }
    if (action === 'furigana') {
      this.dataset.furigana = this.dataset.furigana === 'on' ? 'off' : 'on';
      remember('ez_dialog_furigana', this.dataset.furigana);
      button.setAttribute('aria-pressed', String(this.dataset.furigana === 'on'));
    }
    if (action === 'translations') {
      const show = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(show));
      this.querySelectorAll('.gd-translation').forEach(element => { element.open = show; });
    }
    if (action === 'report') {
      this.querySelector('[data-gd-report]')?.remove();
      const index = Number(button.dataset.index);
      button.insertAdjacentHTML('afterend', '<form class="gd-report" data-gd-report data-index="' + index + '">' +
        '<label>Masalah <select name="reason"><option value="pronunciation">Bacaan salah</option><option value="expression">Ekspresi tidak sesuai</option>' +
        '<option value="timing">Highlight tidak sesuai</option><option value="other">Lainnya</option></select></label>' +
        '<label>Catatan (opsional)<textarea name="note" maxlength="800" rows="2"></textarea></label>' +
        '<button class="gd-button" type="submit">Kirim laporan</button><p role="status"></p></form>');
      button.nextElementSibling.querySelector('select').focus();
    }
  }
  async sendReport(form) {
    const button = form.querySelector('button');
    button.disabled = true;
    const message = form.querySelector('[role="status"]');
    try {
      const response = await fetch('/api/grammar-dialogues/' + encodeURIComponent(this.dataset.grammarId) + '/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: this.data.versionId,
          turnId: this.data.draft.turns[Number(form.dataset.index)].id, reason: form.elements.reason.value, note: form.elements.note.value }),
      });
      if (!response.ok) throw new Error('Laporan belum terkirim. Coba lagi nanti.');
      message.textContent = 'Terima kasih. Ucapan dan versi audio sudah dicatat.';
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  }
}
customElements.define('grammar-dialogue', GrammarDialogue);
