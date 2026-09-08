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
    app.querySelector('#start-mixed')?.addEventListener('click', () => { unlockAudio(); start('mixed'); });
    app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { unlockAudio(); start(button.dataset.category); }));
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
  // "Dengar lalu tebak arti" (audio2id) sebelumnya hanya memanggil
  // speechSynthesis TANPA menyetel lang, jadi browser memakai suara default
  // pengguna (id-ID/en-US) untuk teks Jepang — di banyak perangkat hasilnya
  // senyap, dan infra TTS server tidak pernah dipakai sama sekali.
  //
  // Sekarang meniru playTTS()/speakJapanese() di welcome.html: ambil audio
  // dari /api/tts (ElevenLabs, di-cache di tabel tts_cache DAN di browser
  // selama setahun), dengan Web Speech ber-lang ja-JP sebagai cadangan kalau
  // endpoint-nya mati atau belum dikonfigurasi. Karena kunci cache-nya teks —
  // bukan fitur pemanggilnya — kata yang sudah pernah dibunyikan drill
  // pelajaran langsung terpakai ulang, tanpa generate baru.
  let ttsVersion = '';
  let ttsVersionAsked = false;
  async function initTtsVersion() {
    if (ttsVersionAsked) return;
    ttsVersionAsked = true;
    try {
      const response = await fetch(`${EZ_API_BASE}/tts/version`);
      if (response.ok) ttsVersion = String((await response.json()).version || '');
    } catch { /* versi hanya untuk cache-busting; tanpa itu tetap jalan */ }
  }
  initTtsVersion();

  // SATU elemen audio untuk seluruh halaman, bukan satu per soal. Safari iOS
  // hanya mengizinkan pemutaran otomatis pada elemen yang PERNAH diputar di
  // dalam call stack sebuah gesture, jadi elemen baru tiap soal tidak akan
  // pernah "unlocked" di sana. Diukur di Chromium ber-autoplay ketat, kedua
  // bentuk sama-sama jalan — jadi ini asuransi untuk iOS (yang tidak bisa
  // diuji dari sini), bukan perbaikan atas yang terukur.
  const player = new Audio();
  player.preload = 'auto';
  // WAV senyap 1 frame — cukup untuk membuka kunci elemen di dalam gesture.
  const SILENT = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';
  let unlocked = false;
  // WAJIB dipanggil di dalam handler klik dan SEBELUM `await` apa pun: setelah
  // start() menunggu fetch, aktivasi transient-nya sudah lewat.
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    try {
      player.src = SILENT;
      const promise = player.play();
      if (promise?.then) promise.then(() => player.pause()).catch(() => { /* noop */ });
    } catch { /* noop */ }
  }

  // Setiap pemutaran menaikkan generasi, supaya event dari src LAMA (error /
  // ended yang datang telat) tidak mengubah tombol soal yang sedang tampil.
  let audioGeneration = 0;
  const PLAY_LABEL = '🔊 Putar suara';
  const REPLAY_LABEL = '🔊 Putar lagi';
  const TAP_LABEL = '🔊 Ketuk untuk memutar';

  function stopAudio() {
    audioGeneration += 1;
    try { player.pause(); } catch { /* noop */ }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function speakFallback(text, btn) {
    if (!('speechSynthesis' in window)) { btn?.classList.remove('playing'); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    utterance.onend = () => btn?.classList.remove('playing');
    utterance.onerror = () => btn?.classList.remove('playing');
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  function playAudio(text, btn) {
    const plain = String(text || '').trim();
    if (!plain) return;
    stopAudio();
    const generation = audioGeneration;
    const stale = () => generation !== audioGeneration;
    btn?.classList.add('playing');
    btn?.classList.remove('needs-tap');

    // Jangan jatuh ke Web Speech kalau audio server sudah benar-benar
    // berbunyi: play() bisa menolak setelah pemutaran dimulai (quirk
    // autoplay), dan tanpa penjaga ini dua suara berbunyi bersamaan.
    let serverPlaying = false;
    let fellBack = false;
    const fallback = () => {
      if (stale() || serverPlaying || fellBack) return;
      fellBack = true;
      speakFallback(plain, btn);
    };
    // Autoplay yang DITOLAK kebijakan browser bukan kegagalan server, dan
    // Web Speech diblokir oleh aktivasi yang sama — memanggilnya cuma
    // menghasilkan senyap tanpa penjelasan. Yang benar: bilang ke siswa
    // bahwa audionya tinggal diketuk. Ini yang terjadi pada tautan
    // "Latihan Fokus" (review.html?category=…), yang memulai sesi tanpa
    // gesture apa pun di halaman itu.
    const askForTap = () => {
      if (stale()) return;
      btn?.classList.remove('playing');
      if (btn) { btn.classList.add('needs-tap'); btn.textContent = TAP_LABEL; }
    };
    try {
      player.src = `${EZ_API_BASE}/tts?text=${encodeURIComponent(plain)}${ttsVersion ? `&v=${encodeURIComponent(ttsVersion)}` : ''}`;
      player.onplaying = () => {
        if (stale()) return;
        serverPlaying = true;
        if (btn) { btn.classList.remove('needs-tap'); btn.textContent = REPLAY_LABEL; }
      };
      player.onended = () => { if (!stale()) btn?.classList.remove('playing'); };
      player.onerror = fallback;
      player.play().catch((error) => {
        if (error?.name === 'NotAllowedError') askForTap(); else fallback();
      });
    } catch { fallback(); }
  }
  // Susun-kalimat dua zona ala Duolingo: kata yang diketuk BERPINDAH ke baris
  // jawaban (bukan sekadar berubah warna di tempat), jadi kalimat yang sedang
  // disusun benar-benar terlihat dan bisa diperiksa sebelum dikirim. Ketuk
  // lagi di baris jawaban untuk mengembalikannya. Tetap ketuk, bukan drag —
  // target sentuhnya jauh lebih besar dan tidak butuh pustaka DnD.
  function renderArrange(question) {
    const tokens = question.tokens || [];
    const answerZone = document.getElementById('arrange-answer');
    const poolZone = document.getElementById('arrange');
    if (!answerZone || !poolZone) return;
    const chip = (tokenIndex, position) => `<button type="button" class="token" data-token="${tokenIndex}"${position === null ? '' : ` data-answer-pos="${position}"`}>${esc(tokens[tokenIndex])}</button>`;
    answerZone.innerHTML = selectedOrder.length
      ? selectedOrder.map((tokenIndex, position) => chip(tokenIndex, position)).join('')
      : '<span class="arrange-empty">Ketuk kata di bawah untuk menyusun kalimat.</span>';
    poolZone.innerHTML = tokens
      .map((_, tokenIndex) => tokenIndex)
      .filter((tokenIndex) => !selectedOrder.includes(tokenIndex))
      .map((tokenIndex) => chip(tokenIndex, null))
      .join('') || '<span class="arrange-empty">Semua kata sudah dipakai.</span>';
    answerZone.querySelectorAll('[data-answer-pos]').forEach((button) => button.addEventListener('click', () => {
      selectedOrder = selectedOrder.filter((_, position) => position !== Number(button.dataset.answerPos));
      renderArrange(question);
    }));
    poolZone.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => {
      selectedOrder = [...selectedOrder, Number(button.dataset.token)];
      renderArrange(question);
    }));
    // Server menilai susunan yang belum lengkap sebagai SALAH (panjangnya tidak
    // sama dengan jumlah kepingan), jadi jangan biarkan terkirim setengah jadi.
    const submit = document.getElementById('submit-arrange');
    if (submit) {
      const ready = selectedOrder.length === tokens.length && tokens.length > 0;
      submit.disabled = !ready;
      submit.style.opacity = ready ? '' : '0.5';
      submit.style.cursor = ready ? '' : 'not-allowed';
      submit.textContent = ready ? 'Periksa jawaban' : `Pakai semua kata (${selectedOrder.length}/${tokens.length})`;
    }
  }

  function renderQuestion() {
    const item = session.questions[index]; const question = item.question; const options = question.options || [];
    const tagLabel = item.category === 'kana' && question.script
      ? `${labels[item.category]} · ${question.script}`
      : labels[item.category];
    const arrange = question.variant === 'arrange';
    const answerUi = arrange
      ? `<div class="arrange-answer" id="arrange-answer" aria-label="Kalimat yang kamu susun"></div><div class="arrange" id="arrange" aria-label="Kepingan kata"></div><div class="answer-row"><button class="primary" id="submit-arrange" type="button">Periksa jawaban</button><button class="token" id="reset-arrange" type="button">Ulangi</button></div>`
      : `<div class="options">${options.map((option, optionIndex) => `<button class="option" type="button" data-option="${optionIndex}">${esc(option)}${question.optionReadings?.[optionIndex] && question.optionReadings[optionIndex] !== option ? `<small>${esc(question.optionReadings[optionIndex])}</small>` : ''}</button>`).join('')}</div>`;
    const progressPercent = Math.round(((index + 1) / session.questions.length) * 100);
    app.innerHTML = `<section class="question-card"><div class="progress">SOAL ${index + 1} DARI ${session.questions.length}</div><div class="review-progress-bar" role="progressbar" aria-label="Progres sesi review" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}"><i style="width:${progressPercent}%"></i></div><span class="tag">${esc(tagLabel)}</span><h1 class="prompt">${esc(question.prompt)}</h1>${question.instruction ? `<p class="hint">${esc(question.instruction)}</p>` : ''}${question.audioText ? '<button class="audio-btn" id="play-audio" type="button">🔊 Putar suara</button>' : ''}${question.reading ? `<p class="hint">${esc(question.reading)}</p>` : ''}${question.meaning ? `<p class="hint">${esc(question.meaning)}</p>` : ''}${question.example?.japanese ? `<p class="hint">${esc(question.example.japanese)}</p>` : ''}${question.example?.indonesian ? `<p class="hint">${esc(question.example.indonesian)}</p>` : ''}${question.sentence ? `<p class="hint">${esc(question.sentence)}</p>` : ''}${question.indonesian ? `<p class="hint">${esc(question.indonesian)}</p>` : ''}${answerUi}<p class="feedback" id="feedback" aria-live="polite"></p><div class="review-actions" id="answer-actions"></div></section>`;
    const audioBtn = app.querySelector('#play-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => playAudio(question.audioText, audioBtn));
      // Diputar sendiri begitu soal muncul, sama seperti drill di pelajaran
      // (renderDeckDrill di welcome.html).  Kebijakan autoplay browser bisa
      // menolaknya, dan tombolnya adalah jaring pengamannya.
      playAudio(question.audioText, audioBtn);
    }
    app.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => answer({ optionIndex: Number(button.dataset.option) }, button)));
    if (arrange) renderArrange(question);
    app.querySelector('#reset-arrange')?.addEventListener('click', () => { selectedOrder = []; renderArrange(question); });
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
      feedback.innerHTML = `Belum tepat. Soal ini akan diulang lebih cepat.${answerText ? `<span class="answer-key">Jawaban benar: <b>${esc(answerText)}</b></span>` : ''}`;
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
