(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EzFinalExam = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const versions = ['jlpt-final-n5-v1', 'jlpt-final-n4-v1', 'jlpt-final-n5-v2', 'jlpt-final-n4-v2'];
  const categories = { vocabulary: 'Kosakata', grammar: 'Tata bahasa', reading: 'Membaca', listening: 'Menyimak' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isFinal = version => versions.includes(version);
  const isSimulation = rules => rules?.scoringVersion === 'jlpt-linear-v1';
  function scoringDescription(rules) {
    return `Lulus simulasi jika total minimal ${Number(rules.passingScore)}/180, gabungan kosakata, tata bahasa dan membaca minimal 38/120, serta menyimak minimal 19/60. Semua batas wajib terpenuhi. Skor simulasi dihitung dari proporsi jawaban benar per bagian; bukan skor resmi JLPT berbasis IRT.`;
  }
  function renderScoreReport(report) {
    return `<section class="exam-score-report" aria-label="Skor simulasi JLPT">
      <p class="quiz-results-kicker">Skor simulasi JLPT</p>
      <div class="quiz-results-score"><strong class="quiz-results-score-number">${Number(report.score)}<small> / 180</small></strong>
        <div class="quiz-results-score-detail"><strong>Minimum total ${Number(report.passingScore)} / 180</strong><span>Minimum kedua bagian juga wajib terpenuhi</span></div>
        <div class="quiz-results-meter" style="--result-progress:${Math.round(Number(report.score)/180*100)}%" aria-hidden="true"><span></span></div></div>
      <div class="quiz-results-breakdown"><h3>Nilai dua bagian</h3>${report.sections.map(s=>`
        <div class="quiz-result-row${s.passed?'':' is-focus'}"><span class="quiz-result-row-label">${escape(s.sectionLabel)}<small> · ${Number(s.rawScore)}/${Number(s.rawTotal)} jawaban benar</small></span>
          <strong class="quiz-result-row-score">${Number(s.score)} / ${Number(s.total)}<small> · minimum ${Number(s.minimumScore)} · ${s.passed?'Terpenuhi':'Belum terpenuhi'}</small></strong></div>`).join('')}</div>
      <details><summary>Cara menghitung skor simulasi</summary><p>Jumlah benar dibagi jumlah soal pada setiap bagian, lalu dikalikan 120 untuk bagian gabungan atau 60 untuk menyimak. Nilai tiap bagian dibulatkan ke bilangan bulat terdekat (0,5 ke atas), kemudian dijumlahkan. Ini konversi nilai latihan, bukan skor resmi atau prediksi JLPT yang sudah terkalibrasi.</p>
        <p><a href="https://www.jlpt.jp/e/guideline/results.html" target="_blank" rel="noopener">Batas kelulusan JLPT</a> · <a href="https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf" target="_blank" rel="noopener">Cara penilaian resmi dengan IRT</a></p></details>
      ${report.referenceResults?.length?`<details><summary>Rincian kemampuan A/B/C</summary><ul>${report.referenceResults.map(r=>`<li>${escape(categories[r.category]||r.category)}: <strong>${escape(r.band)}</strong> · ${Number(r.correct)}/${Number(r.total)} benar</li>`).join('')}</ul><p>A: ≥67% benar; B: ≥34% dan &lt;67%; C: &lt;34%. Informasi ini membantu memilih materi latihan dan tidak menentukan kelulusan.</p></details>`:''}
      <p class="exam-private-note">Skor simulasi EzNihongo. JLPT resmi menggunakan IRT berdasarkan pola jawaban.</p>
    </section>`;
  }
  const isFinalModule = m => isFinal((m.quiz_spec || m.quizSpec)?.version) || /^(n5|n4)-final-exam$/.test(m.slug || m.id || '');
  // Stable partition: preserve every ordinary section's editorial order.
  const orderModules = modules => [...modules.filter(m => !isFinalModule(m)), ...modules.filter(isFinalModule)];
  function summary(state) {
    const all = state.questions.map((q, index) => ({q, index, answered: !!state.answeredByIndex?.[index], flagged: !!state.finalFlags?.[q.questionId]}));
    return {total: all.length, answered: all.filter(x => x.answered).length,
      missing: all.filter(x => !x.answered), flagged: all.filter(x => x.flagged),
      categories: Object.entries(categories).map(([id, label]) => {
        const items = all.filter(x => x.q.category === id);
        return {id, label, items, answered: items.filter(x => x.answered).length};
      }).filter(c => c.items.length)};
  }
  const storageKey = state => `ez_final_navigation:${state.lessonApiId}:${state.attemptToken}`;
  function restore(state) {
    if (state.finalNavigationReady) return;
    state.finalNavigationReady = true;
    state.finalFlags = {};
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey(state)) || 'null'); } catch {}
    for (const id of Array.isArray(saved?.flags) ? saved.flags : []) {
      if (state.questions.some(q => q.questionId === id)) state.finalFlags[id] = true;
    }
    const previous = state.questions.findIndex(q => q.questionId === saved?.questionId);
    const missing = state.questions.findIndex((_, i) => !state.answeredByIndex?.[i]);
    state.idx = previous >= 0 ? previous : Math.max(0, missing);
  }
  function remember(state) {
    try { localStorage.setItem(storageKey(state), JSON.stringify({questionId: state.questions[state.idx]?.questionId, flags: Object.keys(state.finalFlags || {}).filter(id => state.finalFlags[id])})); } catch {}
  }
  function clear(state) { try { localStorage.removeItem(storageKey(state)); } catch {} }
  function numberButton(item, current) {
    const label = `Soal ${item.index + 1}, ${item.answered ? 'terjawab' : 'belum dijawab'}${item.flagged ? ', ditandai' : ''}`;
    return `<button type="button" class="exam-number ${item.answered ? 'is-answered' : ''} ${item.flagged ? 'is-flagged' : ''}" data-exam-action="jump" data-index="${item.index}" aria-label="${label}" ${current === item.index ? 'aria-current="step"' : ''}>${item.index + 1}${item.flagged ? '<span aria-hidden="true">•</span>' : ''}</button>`;
  }
  function navigation(state) {
    const s = summary(state), current = state.questions[state.idx];
    const category = s.categories.find(c => c.id === current?.category);
    return `<p class="exam-map-label">${escape(category?.label || '')}</p><div class="exam-number-grid">${(category?.items || []).map(item => numberButton(item, state.finalReview ? -1 : state.idx)).join('')}</div>
      <div class="exam-legend"><span><i class="done"></i>Terjawab</span><span><i></i>Belum dijawab</span><span><i class="flag"></i>Ditandai</span></div>
      <p class="exam-map-note">${s.missing.length} belum dijawab · ${s.flagged.length} ditandai</p>
      <button type="button" class="exam-btn exam-btn-wide" data-exam-action="missing" ${s.missing.length ? '' : 'disabled'}>Ke soal belum dijawab</button>`;
  }
  function review(state) {
    const s = summary(state);
    return `<div class="exam-review"><p class="exam-eyebrow">SEBELUM DIKIRIM</p><h2 id="exam-question-heading" tabindex="-1">Periksa jawabanmu</h2>
      <p>Pastikan semua soal sudah dijawab. Setelah dikirim, jawaban dikunci dan hasil serta pembahasan akan muncul.</p>
      <div class="exam-review-rows">${s.categories.map(c => `<button type="button" data-exam-action="category" data-category="${c.id}"><span>${c.label}</span><strong>${c.answered} / ${c.items.length}<small>${c.answered === c.items.length ? 'Lengkap' : `${c.items.length - c.answered} belum dijawab`}</small></strong><span aria-hidden="true">→</span></button>`).join('')}</div>
      ${s.missing.length ? `<h3>Belum dijawab (${s.missing.length})</h3><div class="exam-number-grid">${s.missing.map(i => numberButton(i, -1)).join('')}</div>` : '<p class="exam-ready">Semua soal sudah dijawab.</p>'}
      ${s.flagged.length ? `<h3>Tinjau lagi (${s.flagged.length})</h3><p>Penanda tidak memengaruhi nilai. Kamu tetap boleh mengirim jawaban.</p><div class="exam-number-grid">${s.flagged.map(i => numberButton(i, -1)).join('')}</div>` : ''}
      <div class="exam-review-actions"><button type="button" class="exam-btn" data-exam-action="back">Kembali ke soal</button><button type="button" class="exam-btn exam-btn-primary" data-exam-action="submit" ${s.missing.length || state.draftConflict || state.submitting ? 'disabled' : ''}>Kirim ${s.total} jawaban</button></div>
      ${s.missing.length ? '<p class="exam-help">Lengkapi soal yang belum dijawab untuk mengirim ujian.</p>' : ''}</div>`;
  }
  const mounted = new WeakMap();
  function bind(container, state, bridge) {
    container.querySelectorAll('[data-exam-action]').forEach(button => {
      button.onclick = () => {
        if (state.submitting || state.submitted || (bridge.isCurrent && !bridge.isCurrent())) return;
        const action = button.dataset.examAction;
        if (action === 'flag') {
          const id = state.questions[Number(button.dataset.index)]?.questionId;
          if (!id) return;
          state.finalFlags[id] = !state.finalFlags[id]; remember(state); update(container, state); return;
        }
        if (action === 'submit') {
          if (state.finalReview && !summary(state).missing.length && !state.draftConflict) bridge.submit();
          return;
        }
        let next = state.idx;
        if (action === 'jump') next = Number(button.dataset.index);
        if (action === 'prev' || action === 'next') {
          const sections = summary(state).categories;
          const ci = sections.findIndex(c => c.id === state.questions[state.idx].category);
          next = sections[ci + (action === 'prev' ? -1 : 1)]?.items[0]?.index ?? -1;
        }
        if (action === 'missing') {
          const missing = summary(state).missing;
          next = (missing.find(i => i.index > state.idx) || missing[0])?.index ?? state.idx;
        }
        if (action === 'category') {
          const items = summary(state).categories.find(c => c.id === button.dataset.category)?.items || [];
          next = (items.find(i => !i.answered) || items[0])?.index ?? state.idx;
        }
        if (!Number.isInteger(next) || next < 0 || next >= state.questions.length) return;
        const sameSection = !state.finalReview && state.questions[next].category === state.questions[state.idx].category && ['jump','missing'].includes(action);
        state.idx = next; state.finalReview = action === 'review'; remember(state);
        if (sameSection) update(container, state); else render(container, state, bridge);
        const heading = container.querySelector(state.finalReview ? '#exam-question-heading' : `#exam-question-${state.idx}`);
        heading?.focus({preventScroll:true});
        heading?.scrollIntoView({block:'start',behavior:'instant'});
      };
    });
  }
  function update(container, state) {
    const host = mounted.get(container);
    if (!host || host.state !== state || !container.querySelector('.final-exam')) return;
    const s = summary(state);
    const progress = container.querySelector('#exam-progress');
    if (progress) { progress.value = s.answered; progress.setAttribute('aria-label', `${s.answered} dari ${s.total} soal terjawab`); }
    const text = container.querySelector('#quiz-paper-progress');
    if (text) text.textContent = `${s.answered} / ${s.total} terjawab`;
    for (const c of s.categories) {
      const count = container.querySelector(`[data-exam-count="${c.id}"]`);
      if (count) count.textContent = `${c.answered}/${c.items.length}`;
    }
    const map = container.querySelector('#exam-map-content');
    if (map) map.innerHTML = navigation(state);
    container.querySelectorAll('[data-exam-action="flag"]').forEach(flag => {
      const flagged = !!state.finalFlags[state.questions[Number(flag.dataset.index)].questionId];
      flag.setAttribute('aria-pressed', String(flagged)); flag.textContent = flagged ? 'Ditandai untuk ditinjau' : 'Tandai untuk ditinjau';
    });
    container.querySelectorAll('[data-answer-status]').forEach(el => { el.textContent = state.answeredByIndex?.[Number(el.dataset.answerStatus)] ? 'Jawaban dipilih · bisa diubah' : 'Pilih satu jawaban'; });
    container.querySelectorAll('.quiz-option, .quiz-image-option').forEach(button => {
      const index = Number(button.closest('[data-question-index]')?.dataset.questionIndex);
      button.setAttribute('aria-pressed', String(Number(button.dataset.idx) === state.selectedByIndex?.[index]));
    });
    const retry = container.querySelector('.exam-save-retry');
    if (retry) retry.hidden = !state.draftDirty || state.draftSaving || state.draftConflict;
    const submit = container.querySelector('[data-exam-action="submit"]');
    if (submit) submit.disabled = s.missing.length > 0 || !!state.draftConflict || !!state.submitting;
    bind(container, state, host.bridge);
  }
  function questionGroups(items, bridge) {
    const sections = [];
    for (const item of items) {
      let section = sections.find(s => s.number === item.q.sectionNumber);
      if (!section) { section = {number:item.q.sectionNumber, items:[]}; sections.push(section); }
      section.items.push(item);
    }
    return sections.map(section => {
      const first = section.items[0].q;
      let previousPassage = null;
      const questions = section.items.map(({q,index}) => {
        const passage = (q.passage || '').trim();
        const passageHtml = passage && passage !== previousPassage ? `<div class="exam-reading-label">Bacaan untuk soal di bawah</div>${bridge.passage(passage)}` : '';
        previousPassage = passage;
        return `${passageHtml}<div class="exam-question-group"><div class="exam-question-top"><h3 id="exam-question-${index}" tabindex="-1">Soal ${index + 1}</h3><button type="button" class="exam-btn exam-flag" data-exam-action="flag" data-index="${index}" aria-pressed="false">Tandai untuk ditinjau</button></div>
          ${bridge.question(q,index,q.sectionNumber || 1,index+1)}<p class="exam-answer-status" data-answer-status="${index}" aria-live="polite"></p></div>`;
      }).join('');
      return `<section class="exam-section"><h2 lang="ja">${escape(first.sectionLabel || '')}</h2><p class="exam-instruction" lang="ja">${escape(first.sectionInstruction || '')}</p>
        ${first.category === 'listening' ? `<p class="exam-listening-help">Gunakan nomor audio untuk memilih soal. Audio boleh diulang.</p>${bridge.audio(section.items,section.number || 1)}` : ''}${questions}</section>`;
    }).join('');
  }
  function render(container, state, bridge) {
    restore(state); bridge.stopAudio();
    mounted.set(container, {state, bridge});
    const q = state.questions[state.idx], s = summary(state);
    state.activeCategory = q.category;
    const ci = s.categories.findIndex(c => c.id === q.category), category = s.categories[ci];
    const level = state.assessmentVersion.includes('-n5-') ? 'N5' : 'N4';
    const packageLabel = ['A','B'].includes(state.assessmentForm) ? ` · Paket ${state.assessmentForm}` : '';
    const compact = typeof matchMedia === 'function' && matchMedia('(max-width: 800px)').matches;
    container.innerHTML = `<div class="final-exam">
      <header class="exam-header"><div><p class="exam-eyebrow">EZNIHONGO · UJIAN AKHIR LEVEL${packageLabel}</p><h1>Final Exam ${level}</h1><p class="exam-subtitle">Kerjakan dengan tenang. Jawaban bisa diubah sebelum dikirim.</p></div><span class="exam-mode">Tanpa batas waktu</span></header>
      ${isSimulation(state.assessmentRules)?`<p class="exam-private-note">Skor simulasi JLPT · minimum ${Number(state.assessmentRules.passingScore)}/180; bagian gabungan 38/120 dan menyimak 19/60.</p>`:''}
      <div class="exam-progress-line"><span id="quiz-paper-progress">${s.answered} / ${s.total} terjawab</span><span>${s.total} soal · 4 bagian</span></div><progress id="exam-progress" max="${s.total}" value="${s.answered}" aria-label="${s.answered} dari ${s.total} soal terjawab"></progress>
      <nav class="exam-categories" aria-label="Bagian ujian">${s.categories.map(c => `<button type="button" class="exam-category" data-exam-action="category" data-category="${c.id}" ${q.category === c.id && !state.finalReview ? 'aria-current="true"' : ''}><span>${c.label}</span><small data-exam-count="${c.id}">${c.answered}/${c.items.length}</small></button>`).join('')}</nav>
      <div class="exam-layout"><section class="exam-workspace" aria-label="${state.finalReview ? 'Pemeriksaan akhir' : 'Soal ujian'}">
        ${state.finalReview ? review(state) : `<div class="exam-part-heading"><p class="exam-eyebrow">BAGIAN ${ci + 1} DARI ${s.categories.length}</p><h2 id="exam-question-heading" tabindex="-1">${escape(category.label)} <span>· ${category.items.length} soal</span></h2><p>Semua soal bagian ini ditampilkan di bawah. Gunakan peta soal untuk melompat.</p></div>
        ${questionGroups(category.items,bridge)}
        <div class="exam-paging"><button type="button" class="exam-btn" data-exam-action="prev" ${ci === 0 ? 'disabled' : ''}>← Bagian sebelumnya</button><button type="button" class="exam-btn exam-btn-primary" data-exam-action="${ci === s.categories.length - 1 ? 'review' : 'next'}">${ci === s.categories.length - 1 ? 'Periksa jawaban' : 'Bagian berikutnya →'}</button></div>`}
      </section><aside class="exam-sidebar"><details class="exam-map" ${compact ? '' : 'open'}><summary>Peta soal <span aria-hidden="true">⌄</span></summary><div id="exam-map-content">${navigation(state)}</div></details>
        <button type="button" class="exam-btn exam-btn-wide" data-exam-action="review">Periksa semua jawaban</button>
        <div class="exam-save"><span class="exam-save-label">Penyimpanan jawaban</span><p id="quiz-draft-status" role="status">${escape(state.draftStatus || 'Jawaban tersimpan otomatis setelah diisi.')}</p><button type="button" class="exam-save-retry">Coba simpan lagi</button></div>
        <p class="exam-private-note">Penanda tersimpan di perangkat ini. Kunci dan pembahasan tersedia setelah jawaban dikirim.</p></aside></div></div>`;
    container.querySelector('.exam-save-retry').onclick = () => { if (!bridge.isCurrent || bridge.isCurrent()) bridge.save(); };
    update(container, state); bridge.initAudio();
  }
  return {isFinal, isFinalModule, isSimulation, scoringDescription, renderScoreReport, orderModules, summary, questionGroups, render, update, clear};
}));
