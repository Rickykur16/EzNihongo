(() => {
  const app = document.getElementById('review-app');
  let session = null;
  let index = 0;
  let selectedOrder = [];
  const labels = { kana: 'Kana', vocabulary: 'Kosakata', kanji: 'Kanji', grammar: 'Grammar' };
  const api = async (path, options) => { const response = await ezApi(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(body.error || 'request_failed'), { status: response.status }); return body; };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);

  async function loadHome() {
    try {
      const summary = await api('/review/summary'); renderHome(summary);
    } catch (error) { app.innerHTML = `<section class="empty-card"><h1>Smart Review belum tersedia</h1><p class="error">${esc(error.message)}</p><a class="back-link" href="welcome.html">Kembali belajar</a></section>`; }
  }
  function renderHome(summary) {
    const counts = Object.entries(labels).map(([key, label]) => `<button class="count" type="button" data-category="${key}"><strong>${Number(summary.byCategory?.[key]) || 0}</strong><span>${label}</span></button>`).join('');
    const noItems = !summary.total;
    app.innerHTML = `<section class="summary-card"><div class="eyebrow">SMART REVIEW</div><h1 class="review-title">Ulangi yang sudah dipelajari.</h1><p class="total">${noItems ? 'Belum ada item review.' : `${summary.total} item perlu direview`}</p><div class="counts">${counts}</div>${noItems ? '<p class="subtle">Review hari ini selesai. Lanjutkan belajar untuk membuka materi review berikutnya.</p>' : '<button class="primary" id="start-mixed" type="button">Mulai Smart Review</button>'}<div class="category-row"><button type="button" data-category="kana">Kana</button><button type="button" data-category="vocabulary">Kosakata</button><button type="button" data-category="kanji">Kanji</button><button type="button" data-category="grammar">Grammar</button></div></section>`;
    app.querySelector('#start-mixed')?.addEventListener('click', () => start('mixed'));
    app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => start(button.dataset.category)));
  }
  async function start(category) {
    app.innerHTML = '<p class="loading">Menyiapkan sesi review…</p>';
    try { session = await api('/review/sessions', { method: 'POST', body: JSON.stringify({ category, limit: 20 }) }); index = 0; selectedOrder = []; if (!session.questions?.length) return renderHome(session.summary || { total: 0, byCategory: {} }); renderQuestion(); }
    catch (error) { app.innerHTML = `<p class="error">Tidak bisa memulai review: ${esc(error.message)}</p>`; }
  }
  function playAudio(text) { if ('speechSynthesis' in window && text) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
  function renderQuestion() {
    const item = session.questions[index]; const q = item.question; const options = q.options || [];
    const arrange = q.variant === 'arrange'; const answerUi = arrange
      ? `<div class="arrange" id="arrange">${(q.tokens || []).map((token, i) => `<button type="button" class="token" data-token="${i}">${esc(token)}</button>`).join('')}</div><div class="answer-row"><button class="primary" id="submit-arrange" type="button">Periksa jawaban</button><button class="token" id="reset-arrange" type="button">Ulangi</button></div>`
      : `<div class="options">${options.map((option, i) => `<button class="option" type="button" data-option="${i}">${esc(option)}${q.optionReadings?.[i] && q.optionReadings[i] !== option ? `<small>${esc(q.optionReadings[i])}</small>` : ''}</button>`).join('')}</div>`;
    app.innerHTML = `<section class="question-card"><div class="progress">${index + 1} / ${session.questions.length}</div><span class="tag">${labels[item.category]}</span><h1 class="prompt">${esc(q.prompt)}</h1>${q.audioText ? '<button class="token" id="play-audio" type="button">▶ Putar audio</button>' : ''}${q.reading ? `<p class="hint">${esc(q.reading)}</p>` : ''}${q.meaning ? `<p class="hint">${esc(q.meaning)}</p>` : ''}${q.example?.japanese ? `<p class="hint">${esc(q.example.japanese)}</p>` : ''}${q.example?.indonesian ? `<p class="hint">${esc(q.example.indonesian)}</p>` : ''}${q.sentence ? `<p class="hint">${esc(q.sentence)}</p>` : ''}${q.indonesian ? `<p class="hint">${esc(q.indonesian)}</p>` : ''}${answerUi}<p class="feedback" id="feedback"></p></section>`;
    app.querySelector('#play-audio')?.addEventListener('click', () => playAudio(q.audioText));
    app.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => answer({ optionIndex: Number(button.dataset.option) }, button)));
    app.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => { const n = Number(button.dataset.token); if (selectedOrder.includes(n)) selectedOrder = selectedOrder.filter((i) => i !== n); else selectedOrder.push(n); app.querySelectorAll('[data-token]').forEach((node) => node.classList.toggle('selected', selectedOrder.includes(Number(node.dataset.token)))); }));
    app.querySelector('#reset-arrange')?.addEventListener('click', () => { selectedOrder = []; renderQuestion(); });
    app.querySelector('#submit-arrange')?.addEventListener('click', () => answer({ order: selectedOrder }));
  }
  async function answer(payload, button) {
    const feedback = document.getElementById('feedback'); if (button) button.disabled = true;
    try {
      const result = await api(`/review/sessions/${session.sessionId}/answers`, { method: 'POST', body: JSON.stringify({ questionIndex: index, ...payload }) });
      const all = app.querySelectorAll('[data-option]'); all.forEach((node) => { node.disabled = true; if (Number(node.dataset.option) === result.correctIndex) node.classList.add('correct'); }); if (button && !result.passed) button.classList.add('wrong');
      feedback.textContent = result.passed ? 'Benar — review berikutnya akan dijadwalkan lebih jauh.' : 'Belum tepat — item ini akan muncul lebih cepat.';
      setTimeout(() => { index += 1; selectedOrder = []; if (index < session.questions.length) renderQuestion(); else finish(); }, 900);
    } catch (error) { feedback.textContent = `Jawaban belum tersimpan: ${error.message}`; feedback.className = 'feedback error'; if (button) button.disabled = false; }
  }
  function finish() { app.innerHTML = '<section class="empty-card"><div class="eyebrow">SMART REVIEW</div><h1 class="review-title">Sesi selesai.</h1><p>Terima kasih sudah mengulang materi yang telah dipelajari.</p><button class="primary" id="back-home" type="button">Lihat Review</button></section>'; document.getElementById('back-home').addEventListener('click', loadHome); }
  (async () => { const user = await ezRequireAuth('login.html'); if (user) loadHome(); })();
})();
