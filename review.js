(() => {
  const app = document.getElementById('review-app');
  const dashboardUrl = 'dashboard.html?v=20260902-4';
  let session = null;
  let index = 0;
  let selectedOrder = [];
  let correctAnswers = 0;
  const labels = { kana: 'Kana', vocabulary: 'Kosakata', kanji: 'Kanji', grammar: 'Grammar' };
  const api = async (path, options) => { const response = await ezApi(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(body.error || 'request_failed'), { status: response.status }); return body; };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  function errorCard(error, retry) {
    const expired = String(error?.message) === 'AUTH_EXPIRED';
    app.innerHTML = `<section class="empty-card"><div class="eyebrow">SMART REVIEW</div><h1 class="review-title">Review belum bisa dimuat</h1><p class="error">${esc(ezStudentErrorMessage(error, 'Smart Review'))}</p><div class="review-actions">${expired ? '<a class="back-link" href="login.html?next=review.html">Masuk kembali</a>' : '<button class="primary" id="retry-review" type="button">Coba lagi</button>'}<a class="back-link" href="${dashboardUrl}">Kembali ke Dashboard</a></div></section>`;
    document.getElementById('retry-review')?.addEventListener('click', retry);
  }
  async function loadHome() {
    app.innerHTML = '<p class="loading">Memuat Smart Review…</p>';
    try { renderHome(await api('/review/summary')); }
    catch (error) { errorCard(error, loadHome); }
  }
  function categoryButton(key, count) {
    return `<button class="count" type="button" data-category="${key}" ${count ? '' : 'disabled aria-disabled="true"'}><strong>${count}</strong><span>${labels[key]}</span></button>`;
  }
  function renderHome(summary) {
    const total = Number(summary.total) || 0;
    const counts = Object.keys(labels).map((key) => categoryButton(key, Number(summary.byCategory?.[key]) || 0)).join('');
    app.innerHTML = `<section class="summary-card"><div class="eyebrow">復習 · SMART REVIEW</div><h1 class="review-title">Ulangi yang sudah dipelajari.</h1><p class="total">${total ? `${total} item perlu direview` : 'Belum ada item review yang siap.'}</p><div class="counts" aria-label="Pilih kategori review">${counts}</div>${total ? '<button class="primary" id="start-mixed" type="button">Mulai Smart Review</button>' : '<p class="subtle">Review hari ini selesai. Lanjutkan belajar untuk membuka materi review berikutnya.</p>'}<div class="review-actions"><a class="back-link" href="${dashboardUrl}">Kembali ke Dashboard</a><a class="back-link" href="welcome.html">Lanjut Belajar</a></div></section>`;
    app.querySelector('#start-mixed')?.addEventListener('click', () => start('mixed'));
    app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => start(button.dataset.category)));
  }
  async function start(category) {
    app.innerHTML = '<p class="loading">Menyiapkan sesi review…</p>';
    try {
      session = await api('/review/sessions', { method: 'POST', body: JSON.stringify({ category, limit: 20 }) });
      index = 0; selectedOrder = []; correctAnswers = 0;
      if (!session.questions?.length) return renderHome(session.summary || { total: 0, byCategory: {} });
      renderQuestion();
    } catch (error) { errorCard(error, () => start(category)); }
  }
  function playAudio(text) { if ('speechSynthesis' in window && text) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
  function renderQuestion() {
    const item = session.questions[index]; const question = item.question; const options = question.options || [];
    const arrange = question.variant === 'arrange';
    const answerUi = arrange
      ? `<div class="arrange" id="arrange">${(question.tokens || []).map((token, itemIndex) => `<button type="button" class="token" data-token="${itemIndex}" aria-pressed="false">${esc(token)}</button>`).join('')}</div><div class="answer-row"><button class="primary" id="submit-arrange" type="button">Periksa jawaban</button><button class="token" id="reset-arrange" type="button">Ulangi</button></div>`
      : `<div class="options">${options.map((option, optionIndex) => `<button class="option" type="button" data-option="${optionIndex}">${esc(option)}${question.optionReadings?.[optionIndex] && question.optionReadings[optionIndex] !== option ? `<small>${esc(question.optionReadings[optionIndex])}</small>` : ''}</button>`).join('')}</div>`;
    const progressPercent = Math.round(((index + 1) / session.questions.length) * 100);
    app.innerHTML = `<section class="question-card"><div class="progress">SOAL ${index + 1} DARI ${session.questions.length}</div><div class="review-progress-bar" role="progressbar" aria-label="Progres sesi review" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}"><i style="width:${progressPercent}%"></i></div><span class="tag">${labels[item.category]}</span><h1 class="prompt">${esc(question.prompt)}</h1>${question.audioText ? '<button class="token" id="play-audio" type="button">▶ Putar audio</button>' : ''}${question.reading ? `<p class="hint">${esc(question.reading)}</p>` : ''}${question.meaning ? `<p class="hint">${esc(question.meaning)}</p>` : ''}${question.example?.japanese ? `<p class="hint">${esc(question.example.japanese)}</p>` : ''}${question.example?.indonesian ? `<p class="hint">${esc(question.example.indonesian)}</p>` : ''}${question.sentence ? `<p class="hint">${esc(question.sentence)}</p>` : ''}${question.indonesian ? `<p class="hint">${esc(question.indonesian)}</p>` : ''}${answerUi}<p class="feedback" id="feedback" aria-live="polite"></p><div class="review-actions" id="answer-actions"></div></section>`;
    app.querySelector('#play-audio')?.addEventListener('click', () => playAudio(question.audioText));
    app.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => answer({ optionIndex: Number(button.dataset.option) }, button)));
    app.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => { const token = Number(button.dataset.token); selectedOrder = selectedOrder.includes(token) ? selectedOrder.filter((value) => value !== token) : [...selectedOrder, token]; app.querySelectorAll('[data-token]').forEach((node) => { const selected = selectedOrder.includes(Number(node.dataset.token)); node.classList.toggle('selected', selected); node.setAttribute('aria-pressed', selected); }); }));
    app.querySelector('#reset-arrange')?.addEventListener('click', () => { selectedOrder = []; renderQuestion(); });
    app.querySelector('#submit-arrange')?.addEventListener('click', () => answer({ order: selectedOrder }, app.querySelector('#submit-arrange')));
  }
  function advance() {
    index += 1; selectedOrder = [];
    if (index < session.questions.length) renderQuestion(); else finish();
  }
  // Jawaban benar dalam bentuk teks. Untuk susun-kalimat inilah SATU-SATUNYA
  // tempat siswa bisa melihat urutan yang benar — `correctOrder` dikirim
  // server justru untuk ini, dan sebelumnya dibuang begitu saja.
  function correctAnswerText(question, result) {
    if (Array.isArray(result.correctOrder)) return result.correctOrder.join(' ');
    const options = question.options || [];
    return Number.isInteger(result.correctIndex) ? (options[result.correctIndex] || '') : '';
  }
  async function answer(payload, button) {
    const feedback = document.getElementById('feedback'); if (button) button.disabled = true;
    try {
      const result = await api(`/review/sessions/${session.sessionId}/answers`, { method: 'POST', body: JSON.stringify({ questionIndex: index, ...payload }) });
      if (result.passed) correctAnswers += 1;
      app.querySelectorAll('[data-option]').forEach((node) => { node.disabled = true; if (Number(node.dataset.option) === result.correctIndex) node.classList.add('correct'); });
      // Kepingan susun-kalimat juga dikunci: soal yang sudah dijawab tidak
      // boleh bisa diutak-atik lagi sambil siswa membaca pembahasannya.
      app.querySelectorAll('[data-token]').forEach((node) => { node.disabled = true; });
      app.querySelector('#reset-arrange')?.setAttribute('disabled', 'disabled');
      if (button && !result.passed) button.classList.add('wrong');
      if (result.passed) {
        feedback.textContent = 'Benar — review berikutnya akan dijadwalkan lebih jauh.';
        setTimeout(advance, 900);
        return;
      }
      // Salah: JANGAN pindah sendiri. Waktu untuk mencerna kesalahan adalah
      // milik siswa, bukan angka tebakan — tampilkan jawaban benarnya lalu
      // tunggu mereka menekan "Lanjut".
      const answerText = correctAnswerText(session.questions[index].question, result);
      feedback.innerHTML = `Belum tepat — item ini akan muncul lebih cepat.${answerText ? `<span class="answer-key">Jawaban benar: <b>${esc(answerText)}</b></span>` : ''}`;
      const actions = document.getElementById('answer-actions');
      if (actions) {
        actions.innerHTML = '<button class="primary" id="review-next" type="button">Lanjut →</button>';
        const nextButton = document.getElementById('review-next');
        nextButton.addEventListener('click', advance);
        nextButton.focus();
      } else {
        setTimeout(advance, 2500);
      }
    } catch (error) {
      feedback.textContent = ezStudentErrorMessage(error, 'Jawaban'); feedback.className = 'feedback error'; if (button) button.disabled = false;
    }
  }
  function finish() {
    app.innerHTML = `<section class="empty-card"><div class="eyebrow">SMART REVIEW</div><h1 class="review-title">Sesi selesai.</h1><p>Kamu menjawab ${correctAnswers} dari ${session.questions.length} item dengan benar.</p><p class="subtle">Hasil sesi ini sudah dipakai untuk menjadwalkan review berikutnya.</p><div class="review-actions"><button class="primary" id="back-home" type="button">Review Lagi</button><a class="back-link" href="${dashboardUrl}">Kembali ke Dashboard</a><a class="back-link" href="welcome.html">Lanjut Belajar</a></div></section>`;
    document.getElementById('back-home').addEventListener('click', loadHome);
  }
  document.getElementById('logout').addEventListener('click', () => ezLogout());
  (async () => { const user = await ezRequireAuth('login.html'); const category = new URLSearchParams(location.search).get('category'); if (user) (category && Object.hasOwn(labels, category) ? start(category) : loadHome()); })();
})();
