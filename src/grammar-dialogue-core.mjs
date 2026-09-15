// Shared, side-effect-free rules for the editor, player, and API.
export const DIALOGUE_SCHEMA = 1;
export const INTENTS = ['neutral', 'curious', 'excited', 'sad'];
export const ROLES = { N: 'narrator', A: 'female', B: 'male' };
const HAN = /[\p{Script=Han}々〆]/u;
const SPEECH = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{M}\sー。、！？!?…「」『』（）()・〜～,.:：;；\-]+$/u;
const VOICE = /^[A-Za-z0-9]{10,64}$/;

export function toKatakana(value) {
  return String(value || '').normalize('NFC').replace(/[ぁ-ゖ]/g,
    c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
export function toHiragana(value) {
  return String(value || '').replace(/[ァ-ヶ]/g,
    c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
export function needsReading(text) {
  return HAN.test(text) || /[A-Za-z0-9０-９]/.test(text);
}
export function stripHints(text) {
  return String(text || '').replace(/\[[a-z_ ]{1,30}\]\s*/gi, '').trim();
}
export function parseLegacy(text) {
  const turns = [];
  for (const line of String(text || '').split('\n').map(s => s.trim()).filter(Boolean)) {
    const match = line.match(/^(N|A|B|女|男|女性|男性):\s*(.*)$/);
    if (match) {
      const speaker = /^(女|女性)$/.test(match[1]) ? 'A' : /^(男|男性)$/.test(match[1]) ? 'B' : match[1];
      turns.push({ speaker, text: stripHints(match[2]) });
    } else if (turns.length) turns[turns.length - 1].text += ' ' + stripHints(line);
    else turns.push({ speaker: 'N', text: stripHints(line) });
  }
  return turns;
}

// Only unambiguous vocabulary entries become suggestions.
export function vocabularyDictionary(rows) {
  const candidates = new Map();
  for (const row of rows) {
    if (!row.japanese || !row.reading) continue;
    const readings = candidates.get(row.japanese) || new Set();
    readings.add(toKatakana(row.reading.trim()));
    candidates.set(row.japanese, readings);
  }
  return [...candidates].filter(([, readings]) => readings.size === 1)
    .map(([text, readings]) => ({ text, reading: [...readings][0] }));
}

// Longest word wins; an explicit correction at a source offset wins over a dictionary.
export function tokenizeWithReadings(text, dictionary = [], previous = []) {
  const terms = new Map();
  for (const entry of dictionary) {
    if (entry.text && entry.reading) terms.set(entry.text, entry.reading);
  }
  const sorted = [...terms].sort((a, b) => b[0].length - a[0].length);
  const overrides = new Map();
  if (previous.map(t => t.text).join('') === text) {
    let offset = 0;
    for (const token of previous) {
      if ((token.reading && token.source !== 'dictionary') || (token.highlight && token.source !== 'dictionary')) overrides.set(offset, token);
      offset += token.text.length;
    }
  }
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const override = overrides.get(i);
    if (override) { tokens.push({ ...override }); i += override.text.length; continue; }
    const match = sorted.find(([surface]) => text.startsWith(surface, i));
    if (match) {
      tokens.push({ text: match[0], reading: needsReading(match[0]) ? match[1] : '', highlight: false, source: 'dictionary' });
      i += match[0].length;
      continue;
    }
    const start = i;
    const first = String.fromCodePoint(text.codePointAt(i));
    const type = needsReading(first);
    i += first.length;
    while (i < text.length && !overrides.has(i) && !sorted.some(([surface]) => text.startsWith(surface, i))) {
      const next = String.fromCodePoint(text.codePointAt(i));
      if (needsReading(next) !== type) break;
      i += next.length;
    }
    tokens.push({ text: text.slice(start, i), reading: '', highlight: false });
  }
  return tokens;
}

export function legacyDraft(grammar, voices = {}) {
  const japanese = parseLegacy(grammar.example_dialog);
  const translated = parseLegacy(grammar.example_dialog_id);
  const parallel = japanese.length === translated.length &&
    japanese.every((turn, i) => turn.speaker === translated[i].speaker);
  return {
    schema: DIALOGUE_SCHEMA, scene: '', pattern: grammar.pattern || '', dictionary: [],
    speakers: Object.entries(ROLES).map(([id, role]) => ({
      id, role, name: id === 'N' ? 'Narator' : 'Pembicara ' + id,
      reading: '', voiceId: voices[id] || '',
    })),
    turns: japanese.map((turn, i) => ({
      id: 'turn-' + (i + 1), speaker: turn.speaker, japanese: turn.text,
      translation: parallel ? translated[i].text : '', intent: 'neutral', reviewed: false,
      tokens: tokenizeWithReadings(turn.text),
    })),
  };
}

export function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 100000) throw new Error('Draft terlalu besar.');
  const bounded = (value, limit, label) => {
    const text = String(value ?? '');
    if (text.length > limit) throw new Error(label + ' terlalu panjang.');
    return text;
  };
  if (!Array.isArray(raw.speakers) || raw.speakers.length !== 3) throw new Error('Gunakan tiga profil N, A, dan B.');
  const speakers = Object.entries(ROLES).map(([id, role]) => {
    if (raw.speakers.filter(s => s.id === id).length !== 1) throw new Error('Profil speaker tidak valid.');
    const speaker = raw.speakers.find(s => s.id === id);
    const voiceId = String(speaker.voiceId || '').trim();
    if (voiceId && !VOICE.test(voiceId)) throw new Error('Voice ID tidak valid.');
    return { id, role, name: bounded(speaker.name, 80, 'Nama'), reading: bounded(speaker.reading, 100, 'Bacaan nama'), voiceId };
  });
  if (!Array.isArray(raw.turns) || raw.turns.length > 40) throw new Error('Maksimal 40 ucapan.');
  const seen = new Set();
  const turns = raw.turns.map(turn => {
    const id = String(turn.id || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || seen.has(id)) throw new Error('ID ucapan harus unik.');
    seen.add(id);
    if (!Object.hasOwn(ROLES, turn.speaker)) throw new Error('Speaker ucapan tidak valid.');
    const japanese = bounded(turn.japanese, 600, 'Ucapan');
    if (!Array.isArray(turn.tokens) || turn.tokens.length > 150) throw new Error('Potongan bacaan tidak valid.');
    return {
      id, speaker: turn.speaker, japanese,
      translation: bounded(turn.translation, 1000, 'Terjemahan'),
      intent: INTENTS.includes(turn.intent) ? turn.intent : 'neutral',
      reviewed: turn.reviewed === true,
      tokens: turn.tokens.map(token => ({
        text: bounded(token.text, 600, 'Kata'), reading: bounded(token.reading, 600, 'Bacaan'),
        highlight: token.highlight === true, source: token.source === 'dictionary' ? 'dictionary' : 'manual',
      })),
    };
  });
  if (!Array.isArray(raw.dictionary) || raw.dictionary.length > 200) throw new Error('Kamus maksimal 200 kata.');
  return {
    schema: DIALOGUE_SCHEMA, pattern: bounded(raw.pattern, 200, 'Pola'),
    scene: bounded(raw.scene, 1000, 'Situasi'), speakers, turns,
    dictionary: raw.dictionary.map(entry => ({
      text: bounded(entry.text, 100, 'Kata kamus'), reading: bounded(entry.reading, 200, 'Bacaan kamus'),
    })).filter(entry => entry.text.trim()),
  };
}

export function suggestReadings(draft, vocabulary = []) {
  const dictionary = [...vocabulary, ...draft.dictionary,
    ...draft.speakers.filter(s => s.reading).map(s => ({ text: s.name, reading: s.reading }))];
  return { ...draft, turns: draft.turns.map(turn => turn.reviewed ? turn : ({
    ...turn, tokens: tokenizeWithReadings(turn.japanese, dictionary, turn.tokens),
  })) };
}

export function compileTurn(turn) {
  if (!turn.japanese.trim()) throw new Error('Teks Jepang belum diisi.');
  if (turn.tokens.some(t => !t.text) || turn.tokens.map(t => t.text).join('') !== turn.japanese) {
    throw new Error('Potongan kata tidak cocok dengan teks Jepang. Perbarui bacaan.');
  }
  return turn.tokens.map(token => {
    if (needsReading(token.text) && !token.reading.trim()) throw new Error('Bacaan belum diisi: ' + token.text);
    const spoken = token.reading.trim() ? toKatakana(token.reading.trim()) : token.text;
    if (!SPEECH.test(spoken)) throw new Error('Gunakan bacaan kana untuk: ' + token.text);
    return spoken;
  }).join('');
}

export function prepareDialogue(raw, voices = {}, engine = 'dialogue-v3') {
  const draft = normalizeDraft(raw);
  if (!draft.turns.length) throw new Error('Tambahkan minimal satu ucapan.');
  draft.speakers = draft.speakers.map(s => ({ ...s, voiceId: s.voiceId || voices[s.id] || '' }));
  const inputs = draft.turns.map((turn, index) => {
    if (!turn.reviewed) throw new Error('Periksa dan setujui bacaan ucapan ' + (index + 1) + '.');
    if (!turn.translation.trim()) throw new Error('Terjemahan ucapan ' + (index + 1) + ' belum diisi.');
    const speaker = draft.speakers.find(s => s.id === turn.speaker);
    if (!speaker.name.trim() || !VOICE.test(speaker.voiceId)) throw new Error('Lengkapi nama dan Voice ID speaker ' + speaker.id + '.');
    const spoken = compileTurn(turn);
    const cue = engine === 'dialogue-v3' && turn.speaker !== 'N' && turn.intent !== 'neutral' ? '[' + turn.intent + '] ' : '';
    return { text: cue + spoken, voice_id: speaker.voiceId };
  });
  if (inputs.reduce((sum, input) => sum + input.text.length, 0) > 2000) throw new Error('Input audio melebihi 2.000 karakter. Pecah menjadi dialog lebih pendek.');
  const used = draft.speakers.filter(s => draft.turns.some(t => t.speaker === s.id));
  if (new Set(used.map(s => s.voiceId)).size !== used.length) throw new Error('Gunakan Voice ID berbeda untuk tiap speaker yang berbicara.');
  return { draft, inputs };
}

export function dialogueTimings(segments, turns) {
  if (!Array.isArray(segments)) throw new Error('Timestamp speaker tidak tersedia.');
  return turns.map((turn, i) => {
    const matches = segments.filter(s => s.dialogue_input_index === i);
    if (!matches.length) throw new Error('Timestamp ucapan ' + (i + 1) + ' tidak tersedia.');
    if (matches.some(s => !Number.isFinite(s.start_time_seconds) || !Number.isFinite(s.end_time_seconds) ||
      s.start_time_seconds < 0 || s.end_time_seconds <= s.start_time_seconds)) throw new Error('Timestamp audio tidak valid.');
    return { id: turn.id, start: Math.min(...matches.map(s => s.start_time_seconds)),
      end: Math.max(...matches.map(s => s.end_time_seconds)) };
  });
}
