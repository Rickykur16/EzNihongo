(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const memory = new Map();
  let mounted = null;
  const staleCodes = new Set(['question_version_conflict', 'inline_placement_unavailable',
    'question_owner_changed', 'question_fingerprint_conflict', 'question_not_found',
    'flow_readiness_failed', 'flow_scope_not_allowed', 'flow_disabled']);

  function key(lessonId, grammarId, question) {
    return JSON.stringify([lessonId, grammarId, question.id, question.version]);
  }
  function feedback(state) {
    if (state.stale) return '<span class="dq-error">Soal atau penempatannya sudah berubah.</span> <button type="button" class="dq-reload" data-dq-reload>Muat ulang soal</button>';
    if (state.error) return '<span class="dq-error">Jawaban belum terkirim. Coba lagi.</span>';
    if (!state.result) return '';
    if (!state.result.correct) return '<span class="dq-try-again">Belum tepat. Coba lagi.</span>';
    return `<span class="dq-correct">Benar. ${esc(state.result.explanation || '')}</span>`;
  }
  function questionHtml(question, state, index) {
    const name = `dq-option-${esc(question.id)}`;
    const options = Array.isArray(question.options) ? question.options : [];
    return `<form class="dq-question" data-dq-question-id="${esc(question.id)}" data-dq-question-version="${esc(question.version)}">
      <fieldset ${state.stale || state.result?.correct ? 'disabled' : ''}>
        <legend>${index + 1}. ${esc(question.prompt)}</legend>
        <div class="dq-options">${options.map((option, optionIndex) => `
          <label class="dq-option" for="dq-${esc(question.id)}-${optionIndex}">
            <input id="dq-${esc(question.id)}-${optionIndex}" type="radio" name="${name}" value="${optionIndex}" ${state.selection === optionIndex ? 'checked' : ''}>
            <span>${esc(option)}</span>
          </label>`).join('')}</div>
      </fieldset>
      <button class="dq-submit" type="submit" ${state.stale || state.inFlight || state.result?.correct ? 'disabled' : ''}>${state.inFlight ? 'Mengirim…' : 'Periksa jawaban'}</button>
      <p class="dq-feedback" role="status" aria-live="polite" tabindex="-1">${feedback(state)}</p>
    </form>`;
  }
  function syncForm(form, state, focusFeedback = false) {
    const status = form.querySelector('.dq-feedback');
    if (status) status.innerHTML = feedback(state);
    if (focusFeedback) status?.focus?.();
    const button = form.querySelector('.dq-submit');
    if (button) { button.disabled = !!state.stale || !!state.inFlight || !!state.result?.correct;
      button.textContent = state.inFlight ? 'Mengirim…' : 'Periksa jawaban'; }
    const fieldset = form.querySelector('fieldset');
    if (fieldset) fieldset.disabled = !!state.stale || !!state.inFlight || !!state.result?.correct;
  }
  function active(context) { return mounted === context && !context.controller.signal.aborted; }
  function slot(root, attribute, grammarId) {
    return [...root.querySelectorAll(`[${attribute}]`)]
      .find(node => node.getAttribute(attribute) === grammarId);
  }
  function unmount() {
    if (!mounted) return;
    mounted.controller.abort();
    for (const info of mounted.questions.values()) info.state.inFlight = false;
    mounted.root.removeEventListener('submit', mounted.onSubmit);
    mounted.root.removeEventListener('change', mounted.onChange);
    mounted.root.removeEventListener('click', mounted.onClick);
    mounted = null;
  }
  async function mount({ root, lesson, openLegacyTask, onPlacement } = {}) {
    unmount();
    if (!root || !lesson?.apiId || !Array.isArray(lesson.grammar) ||
        !lesson.grammar.some(grammar => String(grammar.example_dialog || '').trim())) return;
    const context = { root, lessonId: lesson.apiId, controller: new AbortController(),
      questions: new Map(), openLegacyTask };
    mounted = context;
    context.onClick = event => {
      if (event.target.closest?.('[data-dq-reload]')) {
        window.location.reload();
        return;
      }
      if (event.target.closest?.('[data-dq-open-task]')) context.openLegacyTask?.();
    };
    context.onChange = event => {
      const form = event.target.closest?.('form.dq-question');
      if (!form || !active(context)) return;
      const info = context.questions.get(form.dataset.dqQuestionId);
      if (!info || info.state.stale) return;
      const selected = Number(event.target.value);
      if (!Number.isInteger(selected)) return;
      info.state.selection = selected;
      if (info.state.pending?.optionIndex !== selected) info.state.pending = null;
      if (!info.state.result?.correct) info.state.result = null;
      info.state.error = false;
      syncForm(form, info.state);
    };
    context.onSubmit = async event => {
      const form = event.target.closest?.('form.dq-question');
      if (!form || !active(context)) return;
      event.preventDefault();
      const info = context.questions.get(form.dataset.dqQuestionId);
      if (!info) return;
      const state = info.state;
      if (state.stale || state.inFlight || state.result?.correct) return;
      const checked = form.querySelector('input[type="radio"]:checked');
      const optionIndex = checked ? Number(checked.value) : null;
      if (!Number.isInteger(optionIndex) || optionIndex < 0 ||
          optionIndex >= info.question.options.length) {
        state.error = true; syncForm(form, state, true); return;
      }
      const payload = state.pending?.optionIndex === optionIndex ? state.pending : {
        questionVersion: info.question.version, optionIndex,
        requestId: window.crypto.randomUUID(),
      };
      state.pending = payload;
      state.inFlight = true;
      state.error = false;
      syncForm(form, state);
      try {
        const response = await window.ezApi(`/dialogue-questions/${encodeURIComponent(info.question.id)}/answer`, {
          method: 'POST', body: JSON.stringify(payload), signal: context.controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (active(context) && (response.status === 409 || response.status === 404) &&
              staleCodes.has(body?.error)) {
            state.stale = true;
            state.pending = null;
            state.result = null;
            return;
          }
          throw new Error('answer_failed');
        }
        const result = await response.json();
        if (!active(context)) return;
        // A response is authoritative only for the submitted version and ID.
        if (result.questionId !== info.question.id ||
            result.questionVersion !== info.question.version) throw new Error('answer_mismatch');
        state.result = result;
        state.pending = null;
      } catch {
        if (active(context)) state.error = true;
      } finally {
        state.inFlight = false;
        if (active(context)) syncForm(form, state, true);
      }
    };
    root.addEventListener('click', context.onClick);
    root.addEventListener('change', context.onChange);
    root.addEventListener('submit', context.onSubmit);
    try {
      const response = await window.ezApi(`/lessons/${encodeURIComponent(lesson.apiId)}/dialogue-questions`,
        { signal: context.controller.signal });
      if (!response.ok) return;
      const batch = await response.json();
      if (!active(context) || batch.lessonId !== lesson.apiId) return;
      onPlacement?.(batch.placement);
      if (batch.placement?.mode === 'legacy_session') {
        const notice = root.querySelector('.dq-legacy-session-slot');
        if (notice && typeof openLegacyTask === 'function') {
          notice.innerHTML = '<p>Sesi tugas Bunpou yang sedang berjalan tetap tersedia.</p><button type="button" data-dq-open-task>Buka tugas Bunpou</button>';
          notice.hidden = false;
        }
        return;
      }
      if (batch.placement?.mode !== 'inline') return;
      const byGrammar = new Map((batch.grammars || []).map(group => [group.grammarId, group.questions]));
      for (const grammar of lesson.grammar) {
        if (!String(grammar.example_dialog || '').trim()) continue;
        const goal = slot(root, 'data-dq-goal-for', grammar.id);
        const questionsSlot = slot(root, 'data-dq-questions-for', grammar.id);
        if (goal) {
          const text = String(grammar.communication_goal || '').trim() || 'Percakapan';
          goal.innerHTML = `<strong>Tujuan komunikasi</strong><p>${esc(text)}</p>`;
          goal.hidden = false;
        }
        const questions = byGrammar.get(grammar.id);
        if (!questionsSlot || !Array.isArray(questions) || questions.length < 1 || questions.length > 2) continue;
        const safeQuestions = questions.filter(question => question &&
          typeof question.id === 'string' && typeof question.version === 'string' &&
          typeof question.prompt === 'string' && Array.isArray(question.options) &&
          question.options.length >= 3 && question.options.length <= 4 &&
          question.options.every(option => typeof option === 'string'));
        if (safeQuestions.length !== questions.length) continue;
        for (const question of safeQuestions) {
          const stateKey = key(lesson.apiId, grammar.id, question);
          if (!memory.has(stateKey)) memory.set(stateKey, { selection: null,
            pending: null, result: null, inFlight: false, error: false, stale: false });
          context.questions.set(question.id, { question, state: memory.get(stateKey) });
        }
        questionsSlot.innerHTML = `<section class="dq-panel" aria-label="Pemahaman percakapan"><h4>Cek pemahaman percakapan</h4>${safeQuestions.map((question, index) =>
          questionHtml(question, context.questions.get(question.id).state, index)).join('')}</section>`;
        questionsSlot.hidden = false;
      }
    } catch { /* Static lesson and completion remain usable. */ }
  }
  window.EzDialogueQuestions = { mount, unmount };
})();
